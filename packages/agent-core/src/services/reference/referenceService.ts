import { spawn } from 'node:child_process';
import { promises as fsp } from 'node:fs';
import { join, relative } from 'node:path';

import picomatch from 'picomatch';

import {
  detectMonorepo,
  findProjectRoot,
  getActiveWorkspace,
  getProductionDependencies,
  isWorkspaceDependency,
  type MonorepoInfo,
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
// Above this, a git clone is discarded in favor of the version-scoped npm
// tarball — keeps the cache from filling up with large standalone repos.
const MAX_INDEX_BYTES = 50 * 1024 * 1024;

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
  // Roots under which to look for an installed `node_modules/<pkg>` copy. In a
  // monorepo this is the active workspace plus the repo root (hoisted deps).
  private moduleResolveRoots: string[] = [];
  // Settles when the background warm-up started by `initialize` finishes.
  private warmupPromise: Promise<void> = Promise.resolve();

  constructor(
    homeDir: string,
    private readonly logger: ReferenceLogger = noopLogger,
  ) {
    this.baseDir = join(homeDir, 'references');
    this.manifestPath = join(this.baseDir, MANIFEST_FILENAME);
  }

  async initialize(cwd: string): Promise<void> {
    this.activePackages = new Map();
    this.moduleResolveRoots = [];

    // Decide which package.json files contribute dependencies, and which roots
    // hold an installed `node_modules`. In a monorepo we ground against EVERY
    // workspace package (plus the repo root) so a dependency is referenceable
    // from any folder — not just the workspace that happens to declare it.
    let scanDirs: string[] = [cwd];
    let resolveRoots: string[] = [cwd];
    try {
      const root = await findProjectRoot(cwd);
      const monorepo = await detectMonorepo(root);
      if (monorepo) {
        const workspaceDir = (await getActiveWorkspace(cwd, monorepo)) ?? cwd;
        const workspaceDirs = await enumerateWorkspaceDirs(monorepo);
        // Active workspace first so its version wins when a dep is declared with
        // different ranges across packages; then the repo root; then siblings.
        scanDirs = uniqueStrings([workspaceDir, monorepo.root, ...workspaceDirs]);
        resolveRoots = uniqueStrings([workspaceDir, monorepo.root]);
      } else {
        resolveRoots = uniqueStrings([cwd, root]);
      }
    } catch (error) {
      this.logger.debug('project detection failed; falling back to cwd', {
        cwd,
        error: String(error),
      });
    }

    // Only production + peer dependencies. devDependencies are build/lint
    // tooling (eslint, typescript, type stubs) the agent rarely needs grounded
    // against, and pulling their source is mostly noise.
    const deps = new Map<string, PackageDep>();
    for (const dir of scanDirs) {
      const pkg = await parsePackageJson(dir);
      if (!pkg) continue;
      const ranges: Record<string, string | undefined> = getProductionDependencies(pkg);
      for (const [name, range] of Object.entries(ranges)) {
        if (typeof range !== 'string') continue;
        if (isWorkspaceDependency(range) || !isIndexableRange(range)) continue;
        if (deps.has(name)) continue;
        deps.set(name, { name, version: cleanVersion(resolveDependencyVersion(name, range)) });
      }
    }

    if (deps.size === 0) {
      this.logger.warn('no usable dependencies; reference service has no active packages', {
        cwd,
        scanned: scanDirs.length,
      });
      return;
    }

    this.activePackages = deps;
    this.moduleResolveRoots = resolveRoots;
    this.logger.debug('reference service initialized with active packages', {
      count: deps.size,
      scanned: scanDirs.length,
    });

    // Warm the cache for not-yet-indexed deps without blocking session start.
    // Held so the session can await it and refresh the prompt summary.
    this.warmupPromise = this.indexActiveInBackground();
  }

  async whenWarm(): Promise<void> {
    await this.warmupPromise.catch(() => {});
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

    // 1. Prefer the full upstream source from git: the richest context — original
    //    (uncompiled) source with comments, tests, and internal modules — pinned
    //    to a version-accurate tag. Monorepo subpackages (npm reports a
    //    `directory`) are skipped here: cloning would pull the whole monorepo.
    const repository = await this.resolveRepository(name).catch(
      (): { url?: string; directory?: string } => ({}),
    );
    if (repository.url && !repository.directory) {
      const cloned = await this.tryGitClone(repository.url, version, cachePath);
      if (cloned) {
        const stats = await computeDirStats(cachePath);
        if (stats.size <= MAX_INDEX_BYTES) {
          return this.recordIndexed(name, version, 'git', repository.url, stats.size, stats.fileCount);
        }
        this.logger.debug('git clone exceeds size cap; trying installed copy', {
          name,
          size: stats.size,
        });
        await this.resetDir(cachePath);
      }
    }

    // 2. Fall back to the installed node_modules copy: offline, no network, and
    //    the exact version the project runs against. Strictly better than an npm
    //    fetch as a fallback (same published artifact, but version-exact + local).
    if (await this.tryLocalNodeModules(name, cachePath)) {
      const { size, fileCount } = await computeDirStats(cachePath);
      return this.recordIndexed(name, version, 'local', undefined, size, fileCount);
    }

    // 3. Last resort: fetch the published tarball (package not installed and no
    //    cloneable repo — e.g. a dependency the agent wants to study but the user
    //    has not installed yet).
    await this.npmPackAndExtract(name, version, cachePath);
    const { size, fileCount } = await computeDirStats(cachePath);
    return this.recordIndexed(name, version, 'npm', undefined, size, fileCount);
  }

  /**
   * Copy an installed `node_modules/<pkg>` into the cache when present. Tries
   * each resolve root (active workspace, then repo root for hoisted deps) and
   * follows symlinks so pnpm's `.pnpm` store layout resolves. Nested
   * `node_modules` and `.git` are skipped. Returns false when not installed
   * locally or the copy exceeds the size cap, so the caller falls back to git/npm.
   */
  private async tryLocalNodeModules(name: string, cachePath: string): Promise<boolean> {
    for (const root of this.moduleResolveRoots) {
      const src = join(root, 'node_modules', name);
      try {
        const st = await fsp.stat(src); // follows symlinks (pnpm)
        if (!st.isDirectory()) continue;
      } catch {
        continue;
      }

      const stats = await computeDirStats(src);
      if (stats.size > MAX_INDEX_BYTES) {
        this.logger.debug('node_modules copy exceeds size cap; using published source', {
          name,
          size: stats.size,
        });
        return false;
      }

      try {
        await fsp.cp(src, cachePath, {
          recursive: true,
          dereference: true,
          // Prune nested `node_modules`/`.git` — but only BELOW the package root,
          // since the source path itself lives inside a `node_modules` tree.
          filter: (source) => {
            const rel = relative(src, source);
            return (
              rel === '' ||
              !rel.split(/[/\\]/).some((seg) => seg === 'node_modules' || seg === '.git')
            );
          },
        });
        return true;
      } catch (error) {
        this.logger.debug('node_modules copy failed; falling back to git/npm', {
          name,
          error: String(error),
        });
        await this.resetDir(cachePath);
        return false;
      }
    }
    return false;
  }

  private async recordIndexed(
    name: string,
    version: string,
    source: 'npm' | 'git' | 'local',
    repo: string | undefined,
    size: number,
    fileCount: number,
  ): Promise<CachedReference> {
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

  private async resolveRepository(
    name: string,
  ): Promise<{ url?: string; directory?: string }> {
    return new Promise((resolve) => {
      const proc = spawn('npm', ['view', name, 'repository', '--json'], {
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: CLONE_TIMEOUT_MS,
      });

      let stdout = '';
      proc.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });

      proc.on('close', (code) => {
        if (code !== 0 || !stdout.trim()) {
          resolve({});
          return;
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          if (typeof parsed === 'string') {
            resolve(isCloneableUrl(parsed) ? { url: normalizeGitUrl(parsed) } : {});
            return;
          }
          if (parsed && typeof parsed === 'object') {
            const url = typeof parsed.url === 'string' ? parsed.url : undefined;
            const directory =
              typeof parsed.directory === 'string' ? parsed.directory : undefined;
            resolve(url && isCloneableUrl(url) ? { url: normalizeGitUrl(url), directory } : {});
            return;
          }
          resolve({});
        } catch {
          resolve({});
        }
      });

      proc.on('error', () => {
        resolve({});
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

function isCloneableUrl(url: string): boolean {
  return url.startsWith('git+') || url.startsWith('git://') || url.includes('github.com');
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

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/**
 * Expand a monorepo's workspace globs to the directories they match. Only pnpm
 * exposes globs today; other tools return an empty list (the active workspace
 * and repo root are still scanned by `initialize`). Skips `node_modules`,
 * `.git`, and dotfolders. Recursion is bounded for `**` globs.
 */
async function enumerateWorkspaceDirs(monorepo: MonorepoInfo): Promise<string[]> {
  const out: string[] = [];
  for (const glob of monorepo.workspaceGlobs) {
    if (typeof glob !== 'string' || glob.length === 0 || glob.startsWith('!')) continue;
    const segments = glob.split('/');
    const wildAt = segments.findIndex((s) => s.includes('*'));
    if (wildAt === -1) {
      out.push(join(monorepo.root, glob));
      continue;
    }
    const baseDir = join(monorepo.root, ...segments.slice(0, wildAt));
    const matcher = picomatch(glob);
    const deep = segments.slice(wildAt).some((s) => s.includes('**'));
    await collectMatchingDirs(monorepo.root, baseDir, matcher, deep, out, 0);
  }
  return out;
}

async function collectMatchingDirs(
  root: string,
  dir: string,
  matcher: (path: string) => boolean,
  deep: boolean,
  out: string[],
  depth: number,
): Promise<void> {
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.startsWith('.')) {
      continue;
    }
    const full = join(dir, entry.name);
    if (matcher(relative(root, full))) out.push(full);
    if (deep && depth < 4) {
      await collectMatchingDirs(root, full, matcher, deep, out, depth + 1);
    }
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
