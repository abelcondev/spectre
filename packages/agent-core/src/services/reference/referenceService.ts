import { spawn } from 'node:child_process';
import { promises as fsp } from 'node:fs';
import { join } from 'node:path';

import { Disposable, InstantiationType, registerSingleton } from '../../di';

import { IEnvironmentService } from '../environment/environment';
import { ILogService } from '../logger/logger';

import { IReferenceService } from './reference';
import type {
  CachedReference,
  ReferenceDetail,
  ReferenceManifest,
  ReferenceSummary,
  SearchResult,
} from './types';

const MANIFEST_FILENAME = 'manifest.json';
const SEARCH_TIMEOUT_MS = 10_000;
const CLONE_TIMEOUT_MS = 60_000;

interface PackageDep {
  readonly name: string;
  readonly version: string;
}

export class ReferenceService extends Disposable implements IReferenceService {
  readonly _serviceBrand: undefined;

  private readonly baseDir: string;
  private readonly manifestPath: string;

  private manifest: ReferenceManifest | undefined;
  private activePackages: Map<string, PackageDep> = new Map();

  constructor(
    @IEnvironmentService env: IEnvironmentService,
    @ILogService private readonly logger: ILogService,
  ) {
    super();
    this.baseDir = join(env.homeDir, 'references');
    this.manifestPath = join(this.baseDir, MANIFEST_FILENAME);
  }

  async initialize(cwd: string): Promise<void> {
    const pkgPath = join(cwd, 'package.json');
    let raw: string;
    try {
      raw = await fsp.readFile(pkgPath, 'utf8');
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        this.logger.warn({ cwd }, 'no package.json found; reference service has no active packages');
        return;
      }
      throw err;
    }

    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      this.logger.warn({ cwd }, 'package.json malformed; reference service has no active packages');
      return;
    }

    const deps = new Map<string, PackageDep>();
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
      const block = pkg[field];
      if (block && typeof block === 'object') {
        for (const [name, version] of Object.entries(block as Record<string, string>)) {
          if (typeof version === 'string' && !deps.has(name)) {
            deps.set(name, { name, version: cleanVersion(version) });
          }
        }
      }
    }
    this.activePackages = deps;
    this.logger.debug(
      { count: deps.size },
      'reference service initialized with active packages',
    );
  }

  async listActive(): Promise<ReferenceSummary[]> {
    await this.ensureManifest();
    const results: ReferenceSummary[] = [];

    for (const [name, dep] of this.activePackages) {
      const key = manifestKey(name, dep.version);
      const cached = this.manifest!.references[key];
      results.push({
        package: name,
        version: dep.version,
        status: cached ? 'indexed' : 'pending',
        indexedAt: cached?.indexedAt,
        size: cached?.size,
        fileCount: cached?.fileCount,
        source: cached?.source,
      });
    }

    return results;
  }

  async get(packageName: string): Promise<ReferenceDetail | undefined> {
    await this.ensureManifest();
    const dep = this.activePackages.get(packageName);
    if (!dep) return undefined;

    const key = manifestKey(dep.name, dep.version);
    let cached = this.manifest!.references[key];

    if (!cached) {
      try {
        cached = await this.indexPackage(dep.name, dep.version);
      } catch (err) {
        this.logger.warn({ packageName, err: String(err) }, 'failed to index reference');
        return undefined;
      }
    }

    const cachePath = this.packageCachePath(dep.name, dep.version);
    const summaryText = buildSummaryText(dep.name, dep.version, cached);

    return {
      package: dep.name,
      version: dep.version,
      status: 'indexed',
      indexedAt: cached.indexedAt,
      size: cached.size,
      fileCount: cached.fileCount,
      source: cached.source,
      cachePath,
      repo: cached.repo,
      summaryText,
    };
  }

  async search(packageName: string, query: string): Promise<SearchResult[]> {
    await this.ensureManifest();
    const dep = this.activePackages.get(packageName);
    if (!dep) return [];

    const key = manifestKey(dep.name, dep.version);
    const cached = this.manifest!.references[key];
    if (!cached) return [];

    const cachePath = this.packageCachePath(dep.name, dep.version);
    const rgBinary = await whichBinary('rg');
    if (!rgBinary) {
      this.logger.warn('rg (ripgrep) not found on PATH; reference search unavailable');
      return [];
    }

    return new Promise<SearchResult[]>((resolve) => {
      const results: SearchResult[] = [];
      const proc = spawn(rgBinary, ['--json', '--max-count', '25', query, cachePath], {
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: SEARCH_TIMEOUT_MS,
      });

      let buffer = '';

      proc.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const parsed = parseRgLine(line, dep.name, dep.version);
          if (parsed) results.push(parsed);
        }
      });

      proc.on('close', () => {
        // process any remaining buffer
        if (buffer.trim()) {
          const parsed = parseRgLine(buffer, dep.name, dep.version);
          if (parsed) results.push(parsed);
        }
        resolve(results);
      });

      proc.on('error', (err) => {
        this.logger.warn({ err: String(err) }, 'rg process failed during reference search');
        resolve(results);
      });
    });
  }

  async refresh(packageName?: string): Promise<void> {
    await this.ensureManifest();

    const targets = packageName
      ? [this.activePackages.get(packageName)].filter((d): d is PackageDep => d !== undefined)
      : Array.from(this.activePackages.values());

    for (const dep of targets) {
      const key = manifestKey(dep.name, dep.version);
      const cachePath = this.packageCachePath(dep.name, dep.version);

      // remove existing cache
      try {
        await fsp.rm(cachePath, { recursive: true, force: true });
      } catch {
        // ignore
      }
      delete this.manifest!.references[key];

      try {
        await this.indexPackage(dep.name, dep.version);
      } catch (err) {
        this.logger.warn(
          { packageName: dep.name, err: String(err) },
          'failed to re-index reference during refresh',
        );
      }
    }

    await this.writeManifest();
  }

  async clear(packageName?: string): Promise<void> {
    await this.ensureManifest();

    if (packageName) {
      const dep = this.activePackages.get(packageName);
      if (!dep) return;
      const key = manifestKey(dep.name, dep.version);
      const cachePath = this.packageCachePath(dep.name, dep.version);
      try {
        await fsp.rm(cachePath, { recursive: true, force: true });
      } catch {
        // ignore
      }
      delete this.manifest!.references[key];
    } else {
      // clear everything
      try {
        await fsp.rm(this.baseDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
      this.manifest = { version: 1, references: {} };
    }

    await this.writeManifest();
  }

  async getSummary(): Promise<string> {
    await this.ensureManifest();
    const refs = Object.values(this.manifest!.references);
    if (refs.length === 0) return '';

    const lines = ['## Available Reference Sources', ''];
    for (const ref of refs) {
      const line = `- **${ref.package}** v${ref.version} (${ref.fileCount} files, ${formatBytes(ref.size)}, source: ${ref.source})`;
      lines.push(line);
    }
    lines.push('');
    lines.push('Source code for these packages is cached and available for deep reference via the reference tools.');
    return lines.join('\n');
  }

  // -- Private helpers --

  private async ensureManifest(): Promise<void> {
    if (this.manifest !== undefined) return;
    await fsp.mkdir(this.baseDir, { recursive: true });
    let raw: string;
    try {
      raw = await fsp.readFile(this.manifestPath, 'utf8');
      this.manifest = JSON.parse(raw) as ReferenceManifest;
      if (this.manifest.version !== 1 || typeof this.manifest.references !== 'object') {
        this.manifest = { version: 1, references: {} };
      }
    } catch {
      this.manifest = { version: 1, references: {} };
    }
  }

  private async writeManifest(): Promise<void> {
    if (!this.manifest) return;
    await fsp.mkdir(this.baseDir, { recursive: true });
    const tmpPath = `${this.manifestPath}.tmp`;
    await fsp.writeFile(tmpPath, JSON.stringify(this.manifest, null, 2), 'utf8');
    await fsp.rename(tmpPath, this.manifestPath);
  }

  private async indexPackage(name: string, version: string): Promise<CachedReference> {
    const cachePath = this.packageCachePath(name, version);
    await fsp.mkdir(cachePath, { recursive: true });

    // try git clone first if we can find a repo URL
    let repo: string | undefined;
    let source: 'npm' | 'git' | 'local' = 'npm';

    try {
      repo = await this.resolveRepoUrl(name);
    } catch {
      // npm view failed, fall through to npm pack
    }

    if (repo) {
      try {
        await this.gitClone(repo, cachePath);
        source = 'git';
      } catch (err) {
        this.logger.debug(
          { name, repo, err: String(err) },
          'git clone failed, falling back to npm pack',
        );
        // clean up failed clone
        try {
          await fsp.rm(cachePath, { recursive: true, force: true });
          await fsp.mkdir(cachePath, { recursive: true });
        } catch {
          // ignore
        }
        repo = undefined;
      }
    }

    if (source !== 'git') {
      await this.npmPackAndExtract(name, version, cachePath);
    }

    // compute stats
    const { size, fileCount } = await computeDirStats(cachePath);
    const now = new Date().toISOString();

    const entry: CachedReference = {
      package: name,
      version,
      source,
      repo,
      clonedAt: now,
      size,
      fileCount,
      indexedAt: now,
    };

    const key = manifestKey(name, version);
    this.manifest!.references[key] = entry;
    await this.writeManifest();

    this.logger.info({ name, version, source, fileCount }, 'reference indexed');
    return entry;
  }

  private async resolveRepoUrl(name: string): Promise<string | undefined> {
    return new Promise<string | undefined>((resolve) => {
      const proc = spawn('npm', ['view', name, 'repository.url', '--json'], {
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: CLONE_TIMEOUT_MS,
      });

      let stdout = '';
      proc.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });

      proc.on('close', (code) => {
        if (code !== 0 || !stdout.trim()) {
          resolve(undefined);
          return;
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          const url = typeof parsed === 'string' ? parsed : undefined;
          if (url && (url.startsWith('git+') || url.startsWith('git://') || url.includes('github.com'))) {
            resolve(normalizeGitUrl(url));
          } else {
            resolve(undefined);
          }
        } catch {
          resolve(undefined);
        }
      });

      proc.on('error', () => resolve(undefined));
    });
  }

  private async gitClone(repoUrl: string, dest: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const proc = spawn('git', ['clone', '--depth', '1', repoUrl, dest], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: CLONE_TIMEOUT_MS,
      });

      let stderr = '';
      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`git clone exited with code ${code}: ${stderr.trim()}`));
        } else {
          resolve();
        }
      });

      proc.on('error', reject);
    });
  }

  private async npmPackAndExtract(name: string, version: string, dest: string): Promise<void> {
    // use a temp directory for the tarball
    const tmpDir = join(dest, '.npm-pack-tmp');
    await fsp.mkdir(tmpDir, { recursive: true });

    const spec = `${name}@${version}`;

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('npm', ['pack', spec, '--pack-destination', tmpDir], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: CLONE_TIMEOUT_MS,
      });

      let stderr = '';
      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8');
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`npm pack exited with code ${code}: ${stderr.trim()}`));
        } else {
          resolve();
        }
      });

      proc.on('error', reject);
    });

    // extract the tarball
    const files = await fsp.readdir(tmpDir);
    const tarball = files.find((f) => f.endsWith('.tgz'));
    if (!tarball) {
      throw new Error(`npm pack did not produce a tarball for ${spec}`);
    }

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('tar', ['xzf', join(tmpDir, tarball), '-C', dest, '--strip-components', '1'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: CLONE_TIMEOUT_MS,
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`tar extract exited with code ${code}`));
        } else {
          resolve();
        }
      });

      proc.on('error', reject);
    });

    // clean up temp dir
    try {
      await fsp.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  private packageCachePath(name: string, version: string): string {
    return join(this.baseDir, name, version);
  }

  /**
   * Create a standalone ReferenceService without DI.
   * Used by createRuntimeConfig for the CLI / SDK path.
   */
  static createStandalone(homeDir: string): ReferenceService {
    const noopLogger = {
      debug() {},
      info() {},
      warn() {},
      error() {},
      fatal() {},
      trace() {},
      child() { return noopLogger; },
      attachSession() { return undefined; },
    } as unknown as ILogService;

    const env = { homeDir } as IEnvironmentService;
    return new ReferenceService(env, noopLogger);
  }

  override dispose(): void {
    if (this._store.isDisposed) return;
    this.manifest = undefined;
    this.activePackages.clear();
    super.dispose();
  }
}

registerSingleton(IReferenceService, ReferenceService, InstantiationType.Delayed);

// -- Module-level helpers --

function manifestKey(name: string, version: string): string {
  return `${name}@${version}`;
}

function cleanVersion(version: string): string {
  // strip range prefixes like ^, ~, >=, etc.
  return version.replace(/^[\^~>=<]+/, '').trim();
}

function normalizeGitUrl(url: string): string {
  // strip git+ prefix and .git suffix, convert shorthand to full URL
  let normalized = url.replace(/^git\+/, '').replace(/\.git$/, '');
  if (normalized.startsWith('ssh://git@')) {
    normalized = normalized.replace('ssh://git@', 'https://');
  }
  if (normalized.startsWith('git://')) {
    normalized = normalized.replace('git://', 'https://');
  }
  // handle github shorthand: git@github.com:user/repo
  const sshMatch = normalized.match(/^git@([^:]+):(.+)$/);
  if (sshMatch) {
    normalized = `https://${sshMatch[1]}/${sshMatch[2]}`;
  }
  return normalized;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildSummaryText(name: string, version: string, cached: CachedReference): string {
  return `${name} v${version} — ${cached.fileCount} files cached (${formatBytes(cached.size)}), source: ${cached.source}${cached.repo ? `, repo: ${cached.repo}` : ''}`;
}

interface RgMatchMessage {
  type: 'match';
  data: {
    path: { text: string };
    line_number: number;
    lines: { text: string };
  };
}

function parseRgLine(line: string, packageName: string, version: string): SearchResult | null {
  try {
    const msg = JSON.parse(line);
    if (msg.type !== 'match') return null;
    const data = (msg as RgMatchMessage).data;
    return {
      file: data.path.text,
      line: data.line_number,
      snippet: data.lines.text.trimEnd(),
      package: packageName,
      version,
    };
  } catch {
    return null;
  }
}

async function computeDirStats(dir: string): Promise<{ size: number; fileCount: number }> {
  let size = 0;
  let fileCount = 0;

  async function walk(d: string): Promise<void> {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fsp.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        // skip .git and node_modules
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        await walk(full);
      } else if (entry.isFile()) {
        try {
          const stat = await fsp.stat(full);
          size += stat.size;
          fileCount++;
        } catch {
          // skip inaccessible
        }
      }
    }
  }

  await walk(dir);
  return { size, fileCount };
}

async function whichBinary(name: string): Promise<string | null> {
  const PATH = process.env['PATH'] ?? '';
  const sep = process.platform === 'win32' ? ';' : ':';
  const exts = process.platform === 'win32'
    ? (process.env['PATHEXT'] ?? '.EXE;.CMD;.BAT;.COM').split(';')
    : [''];
  for (const dir of PATH.split(sep)) {
    if (dir === '') continue;
    for (const ext of exts) {
      const candidate = join(dir, name + ext);
      try {
        const st = await fsp.stat(candidate);
        if (st.isFile()) return candidate;
      } catch {
        // not found in this dir
      }
    }
  }
  return null;
}
