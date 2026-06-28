import { spawn } from 'node:child_process';
import { promises as fsp } from 'node:fs';
import { join } from 'node:path';

import {
  detectMonorepo,
  findProjectRoot,
  getActiveWorkspace,
  getProductionDependencies,
  isWorkspaceDependency,
  parsePackageJson,
  resolveDependencyVersion,
} from '../../project';

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
const BACKGROUND_INDEX_CONCURRENCY = 3;

interface PackageDep {
  readonly name: string;
  readonly version: string;
}

/**
 * Minimal logging surface so the service does not depend on the DI container.
 * Matches the shape of the app's root `Logger` (message first, payload second).
 */
export interface ReferenceLogger {
  debug(message: string, payload?: object): void;
  info(message: string, payload?: object): void;
  warn(message: string, payload?: object): void;
  error(message: string, payload?: object): void;
}

const noopLogger: ReferenceLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

export class ReferenceService implements IReferenceService {
  readonly _serviceBrand: undefined;

  private readonly baseDir: string;
  private readonly manifestPath: string;

  private manifest: ReferenceManifest | undefined;
  private activePackages: Map<string, PackageDep> = new Map();
  private readonly inFlight = new Map<string, Promise<CachedReference | undefined>>();

  constructor(
    homeDir: string,
    private readonly logger: ReferenceLogger = noopLogger,
  ) {
    this.baseDir = join(homeDir, 'references');
    this.manifestPath = join(this.baseDir, MANIFEST_FILENAME);
  }

  async initialize(cwd: string): Promise<void> {
    this.activePackages = new Map();

    // Resolve the package whose dependencies are in scope. In a monorepo this is
    // the workspace package containing `cwd`, not the repo root — so we only
    // ground against deps the active package actually declares.
    let workspaceDir = cwd;
    try {
      const root = await findProjectRoot(cwd);
      const monorepo = await detectMonorepo(root);
      if (monorepo) {
        workspaceDir = (await getActiveWorkspace(cwd, monorepo)) ?? cwd;
      }
    } catch (error) {
      this.logger.debug('project detection failed; falling back to cwd', {
        cwd,
        error: String(error),
      });
    }

    const pkg = await parsePackageJson(workspaceDir);
    if (!pkg) {
      this.logger.warn('no usable package.json; reference service has no active packages', {
        workspaceDir,
      });
      return;
    }

    const ranges: Record<string, string | undefined> = {
      ...getProductionDependencies(pkg),
      ...pkg.devDependencies,
    };

    const deps = new Map<string, PackageDep>();
    for (const [name, range] of Object.entries(ranges)) {
      if (typeof range !== 'string') continue;
      if (isWorkspaceDependency(range) || !isIndexableRange(range)) continue;
      if (deps.has(name)) continue;
      deps.set(name, { name, version: cleanVersion(resolveDependencyVersion(name, range)) });
    }
    this.activePackages = deps;
    this.logger.debug('reference service initialized with active packages', {
      count: deps.size,
      workspaceDir,
    });

    // Warm the cache for not-yet-indexed deps without blocking session start.
    void this.indexActiveInBackground();
  }

  async listActive(): Promise<ReferenceSummary[]> {
    await this.ensureManifest();
    const results: ReferenceSummary[] = [];

    for (const [name, dep] of this.activePackages) {
      const cached = this.manifest!.references[manifestKey(name, dep.version)];
      const status = referenceStatus(cached);
      results.push({
        package: name,
        version: dep.version,
        status,
        indexedAt: cached?.indexedAt,
        size: status === 'indexed' ? cached?.size : undefined,
        fileCount: status === 'indexed' ? cached?.fileCount : undefined,
        source: status === 'indexed' ? cached?.source : undefined,
      });
    }

    return results;
  }

  async get(packageName: string): Promise<ReferenceDetail | undefined> {
    await this.ensureManifest();
    const dep = this.activePackages.get(packageName);
    if (!dep) return undefined;

    const cached = await this.ensureIndexed(dep.name, dep.version);
    if (!cached || referenceStatus(cached) !== 'indexed') return undefined;

    return {
      package: dep.name,
      version: dep.version,
      status: 'indexed',
      indexedAt: cached.indexedAt,
      size: cached.size,
      fileCount: cached.fileCount,
      source: cached.source,
      cachePath: this.packageCachePath(dep.name, dep.version),
      repo: cached.repo,
      summaryText: buildSummaryText(dep.name, dep.version, cached),
    };
  }

  async search(packageName: string, query: string): Promise<SearchResult[]> {
    await this.ensureManifest();
    const dep = this.activePackages.get(packageName);
    if (!dep) return [];

    // Lazy-index on first search so the model can reach for a dependency that
    // the background warm-up has not gotten to (or that previously failed) yet.
    const cached = await this.ensureIndexed(dep.name, dep.version);
    if (!cached || referenceStatus(cached) !== 'indexed') return [];

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
        if (buffer.trim()) {
          const parsed = parseRgLine(buffer, dep.name, dep.version);
          if (parsed) results.push(parsed);
        }
        resolve(results);
      });

      proc.on('error', (err) => {
        this.logger.warn('rg process failed during reference search', { err: String(err) });
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

      await fsp.rm(cachePath, { recursive: true, force: true }).catch(() => {});
      delete this.manifest!.references[key];
      this.inFlight.delete(key);

      await this.ensureIndexed(dep.name, dep.version);
    }

    await this.writeManifest();
  }

  async clear(packageName?: string): Promise<void> {
    await this.ensureManifest();

    if (packageName) {
      const dep = this.activePackages.get(packageName);
      if (!dep) return;
      const key = manifestKey(dep.name, dep.version);
      await fsp
        .rm(this.packageCachePath(dep.name, dep.version), { recursive: true, force: true })
        .catch(() => {});
      delete this.manifest!.references[key];
      this.inFlight.delete(key);
    } else {
      await fsp.rm(this.baseDir, { recursive: true, force: true }).catch(() => {});
      this.manifest = { version: 1, references: {} };
      this.inFlight.clear();
    }

    await this.writeManifest();
  }

  async getSummary(): Promise<string> {
    await this.ensureManifest();

    const entries: string[] = [];
    for (const [name, dep] of this.activePackages) {
      const cached = this.manifest!.references[manifestKey(name, dep.version)];
      if (!cached || referenceStatus(cached) !== 'indexed') continue;
      entries.push(
        `- **${name}** v${dep.version} (${cached.fileCount} files, ${formatBytes(cached.size)}, source: ${cached.source})`,
      );
    }
    if (entries.length === 0) return '';

    return [
      '## Available Reference Sources',
      '',
      ...entries,
      '',
      'Source code for these packages is cached and available for deep reference via the reference tools.',
    ].join('\n');
  }

  dispose(): void {
    this.manifest = undefined;
    this.activePackages.clear();
    this.inFlight.clear();
  }

  // -- Private helpers --

  private async indexActiveInBackground(): Promise<void> {
    try {
      await this.ensureManifest();
    } catch {
      return;
    }

    // Skip anything already attempted (indexed or errored) so we don't retry a
    // failing clone on every session start.
    const pending = Array.from(this.activePackages.values()).filter(
      (dep) => this.manifest!.references[manifestKey(dep.name, dep.version)] === undefined,
    );
    if (pending.length === 0) return;

    await runWithConcurrency(pending, BACKGROUND_INDEX_CONCURRENCY, (dep) =>
      this.ensureIndexed(dep.name, dep.version).then(
        () => undefined,
        () => undefined,
      ),
    );
  }

  /**
   * Index a package at most once concurrently. Returns the cached entry, or
   * `undefined` if indexing failed (a failure is persisted as an `error` entry
   * so the background warm-up does not keep retrying it).
   */
  private ensureIndexed(name: string, version: string): Promise<CachedReference | undefined> {
    const key = manifestKey(name, version);
    const existing = this.manifest?.references[key];
    if (existing && referenceStatus(existing) === 'indexed') {
      return Promise.resolve(existing);
    }

    const inflight = this.inFlight.get(key);
    if (inflight) return inflight;

    const promise = this.indexPackage(name, version)
      .catch(async (error: unknown) => {
        this.logger.warn('failed to index reference', {
          package: name,
          version,
          error: String(error),
        });
        await this.recordError(name, version, String(error));
        return undefined;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
  }

  private async recordError(name: string, version: string, error: string): Promise<void> {
    await this.ensureManifest();
    this.manifest!.references[manifestKey(name, version)] = {
      package: name,
      version,
      source: 'npm',
      clonedAt: new Date().toISOString(),
      size: 0,
      fileCount: 0,
      status: 'error',
      error,
    };
    await this.writeManifest();
  }

  private async ensureManifest(): Promise<void> {
    if (this.manifest !== undefined) return;
    await fsp.mkdir(this.baseDir, { recursive: true });
    try {
      const raw = await fsp.readFile(this.manifestPath, 'utf8');
      const parsed = JSON.parse(raw) as ReferenceManifest;
      this.manifest =
        parsed.version === 1 && typeof parsed.references === 'object'
          ? parsed
          : { version: 1, references: {} };
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
    await this.resetDir(cachePath);

    let repo: string | undefined;
    let source: 'npm' | 'git' | 'local' = 'npm';

    try {
      repo = await this.resolveRepoUrl(name);
    } catch {
      // npm view failed; fall through to npm pack
    }

    if (repo) {
      const cloned = await this.tryGitClone(repo, version, cachePath);
      if (cloned) {
        source = 'git';
      } else {
        repo = undefined;
      }
    }

    if (source !== 'git') {
      await this.npmPackAndExtract(name, version, cachePath);
    }

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
      status: 'indexed',
    };

    this.manifest!.references[manifestKey(name, version)] = entry;
    await this.writeManifest();

    this.logger.info('reference indexed', { name, version, source, fileCount });
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
          if (
            url &&
            (url.startsWith('git+') || url.startsWith('git://') || url.includes('github.com'))
          ) {
            resolve(normalizeGitUrl(url));
          } else {
            resolve(undefined);
          }
        } catch {
          resolve(undefined);
        }
      });

      proc.on('error', () => {
        resolve(undefined);
      });
    });
  }

  /**
   * Clone a version-accurate snapshot. We try the version tag first (`vX.Y.Z`
   * then `X.Y.Z`) so the cached source matches the resolved version, and only
   * fall back to the default branch when no matching tag exists.
   */
  private async tryGitClone(repo: string, version: string, dest: string): Promise<boolean> {
    if (version !== 'latest') {
      for (const ref of [`v${version}`, version]) {
        try {
          await this.gitClone(repo, dest, ref);
          return true;
        } catch {
          await this.resetDir(dest);
        }
      }
    }

    try {
      await this.gitClone(repo, dest);
      return true;
    } catch (error) {
      this.logger.debug('git clone failed, falling back to npm pack', {
        repo,
        error: String(error),
      });
      await this.resetDir(dest);
      return false;
    }
  }

  private async gitClone(repoUrl: string, dest: string, ref?: string): Promise<void> {
    const args = ['clone', '--depth', '1'];
    if (ref) args.push('--branch', ref);
    args.push(repoUrl, dest);

    return new Promise<void>((resolve, reject) => {
      const proc = spawn('git', args, {
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

    const files = await fsp.readdir(tmpDir);
    const tarball = files.find((f) => f.endsWith('.tgz'));
    if (!tarball) {
      throw new Error(`npm pack did not produce a tarball for ${spec}`);
    }

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(
        'tar',
        ['xzf', join(tmpDir, tarball), '-C', dest, '--strip-components', '1'],
        {
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: CLONE_TIMEOUT_MS,
        },
      );

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`tar extract exited with code ${code}`));
        } else {
          resolve();
        }
      });

      proc.on('error', reject);
    });

    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }

  private async resetDir(dir: string): Promise<void> {
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
    await fsp.mkdir(dir, { recursive: true });
  }

  private packageCachePath(name: string, version: string): string {
    return join(this.baseDir, name, version);
  }

  /**
   * Create a ReferenceService for the CLI / SDK path (no DI container).
   */
  static createStandalone(homeDir: string, logger?: ReferenceLogger): ReferenceService {
    return new ReferenceService(homeDir, logger);
  }
}

// -- Module-level helpers --

function manifestKey(name: string, version: string): string {
  return `${name}@${version}`;
}

function referenceStatus(cached: CachedReference | undefined): 'indexed' | 'pending' | 'error' {
  if (!cached) return 'pending';
  // Entries written before `status` existed are indexed.
  return cached.status ?? 'indexed';
}

function cleanVersion(version: string): string {
  let v = version.trim();
  // `npm:` aliases embed the real spec after the last `@`, e.g. `npm:foo@^1.2`.
  if (v.startsWith('npm:')) {
    const at = v.lastIndexOf('@');
    v = at > 4 ? v.slice(at + 1) : '';
  }
  v = resolveDependencyVersion('', v).trim();
  if (v === '' || v === '*' || v.toLowerCase() === 'x') return 'latest';
  return v;
}

/** Ranges npm can resolve to a published tarball. Excludes VCS/file/url specs. */
function isIndexableRange(range: string): boolean {
  const r = range.trim();
  if (r === '') return false;
  if (/^(git\+|git:|file:|link:|portal:|https?:|ssh:)/.test(r)) return false;
  if (r.includes('://')) return false;
  return true;
}

function normalizeGitUrl(url: string): string {
  let normalized = url.replace(/^git\+/, '').replace(/\.git$/, '');
  if (normalized.startsWith('ssh://git@')) {
    normalized = normalized.replace('ssh://git@', 'https://');
  }
  if (normalized.startsWith('git://')) {
    normalized = normalized.replace('git://', 'https://');
  }
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

async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  const runners: Array<Promise<void>> = [];
  const count = Math.min(limit, queue.length);
  for (let i = 0; i < count; i++) {
    runners.push(
      (async () => {
        while (queue.length > 0) {
          const item = queue.shift()!;
          await worker(item);
        }
      })(),
    );
  }
  await Promise.all(runners);
}

async function whichBinary(name: string): Promise<string | null> {
  const PATH = process.env['PATH'] ?? '';
  const sep = process.platform === 'win32' ? ';' : ':';
  const exts =
    process.platform === 'win32'
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
