import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { join } from 'pathe';

import {
  buildSearchPattern,
  ReferenceService,
} from '../../../src/services/reference/referenceService';
import type { CachedReference } from '../../../src/services/reference/types';

// Keep the suite hermetic: no real `git` / `npm` / `tar` / `rg` processes. The
// fake child exits non-zero on the next tick, so any spawn-based step (repo
// lookup, git clone, npm pack, rg) resolves as "unavailable" instead of hitting
// the network — letting indexing fall through to the local node_modules path.
// `vi.mock` is hoisted above the imports by vitest regardless of placement.
vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    setImmediate(() => child.emit('close', 1));
    return child;
  }),
}));

const homes: string[] = [];

function tmpHome(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ref-svc-'));
  homes.push(dir);
  return dir;
}

function tmpProject(pkg: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'ref-proj-'));
  homes.push(dir);
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg), 'utf8');
  return dir;
}

function writeManifest(home: string, references: Record<string, CachedReference>): void {
  const refDir = join(home, 'references');
  mkdirSync(refDir, { recursive: true });
  writeFileSync(join(refDir, 'manifest.json'), JSON.stringify({ version: 1, references }), 'utf8');
}

function indexed(pkg: string, version: string, fileCount: number, size: number): CachedReference {
  return {
    package: pkg,
    version,
    source: 'git',
    clonedAt: '2026-01-01T00:00:00.000Z',
    indexedAt: '2026-01-01T00:00:00.000Z',
    size,
    fileCount,
    status: 'indexed',
  };
}

function errored(pkg: string, version: string): CachedReference {
  return {
    package: pkg,
    version,
    source: 'npm',
    clonedAt: '2026-01-01T00:00:00.000Z',
    size: 0,
    fileCount: 0,
    status: 'error',
    error: 'boom',
  };
}

afterEach(() => {
  while (homes.length > 0) rmSync(homes.pop()!, { recursive: true, force: true });
});

describe('buildSearchPattern', () => {
  it('passes a single term through untouched so it can act as a regex', () => {
    expect(buildSearchPattern('GlassView')).toBe('GlassView');
    expect(buildSearchPattern('useEffect.*cleanup')).toBe('useEffect.*cleanup');
    expect(buildSearchPattern('  trimmed  ')).toBe('trimmed');
  });

  it('OR-joins multiple keywords instead of matching them as one literal phrase', () => {
    // This is the regression: the whole space-joined string used to reach rg as
    // a single pattern and match nothing.
    expect(buildSearchPattern('GlassView GlassContainer isLiquidGlassAvailable')).toBe(
      'GlassView|GlassContainer|isLiquidGlassAvailable',
    );
  });

  it('escapes regex metacharacters in each OR-ed term', () => {
    expect(buildSearchPattern('z.object parse()')).toBe('z\\.object|parse\\(\\)');
    expect(buildSearchPattern('foo[] bar+')).toBe('foo\\[\\]|bar\\+');
  });

  it('collapses arbitrary whitespace between terms', () => {
    expect(buildSearchPattern('a\t b\n  c')).toBe('a|b|c');
  });
});

describe('getSummary', () => {
  it('scopes the summary to the active package, not the global cache', async () => {
    const home = tmpHome();
    // lodash is cached globally but is NOT a dependency of the active project.
    writeManifest(home, {
      'zod@3.22.4': indexed('zod', '3.22.4', 10, 2048),
      'react@18.2.0': indexed('react', '18.2.0', 50, 100_000),
      'lodash@4.17.21': indexed('lodash', '4.17.21', 300, 500_000),
    });
    const project = tmpProject({ dependencies: { zod: '^3.22.4', react: '^18.2.0' } });

    const svc = ReferenceService.createStandalone(home);
    await svc.initialize(project);

    const summary = await svc.getSummary();
    expect(summary).toContain('zod');
    expect(summary).toContain('react');
    expect(summary).not.toContain('lodash');
  });

  it('returns an empty string when no active dependency is indexed', async () => {
    const home = tmpHome();
    writeManifest(home, {});
    // Both deps are non-indexable, so the active set is empty.
    const project = tmpProject({
      dependencies: { internal: 'workspace:*', local: 'file:../local' },
    });

    const svc = ReferenceService.createStandalone(home);
    await svc.initialize(project);

    expect(await svc.getSummary()).toBe('');
    expect(await svc.listActive()).toHaveLength(0);
  });
});

describe('listActive', () => {
  it('reports indexed and error status for active dependencies', async () => {
    const home = tmpHome();
    writeManifest(home, {
      'a@1.0.0': indexed('a', '1.0.0', 7, 1024),
      'c@3.0.0': errored('c', '3.0.0'),
    });
    const project = tmpProject({ dependencies: { a: '^1.0.0', c: '^3.0.0' } });

    const svc = ReferenceService.createStandalone(home);
    await svc.initialize(project);

    const list = (await svc.listActive()).toSorted((x, y) => x.package.localeCompare(y.package));
    expect(list).toHaveLength(2);

    expect(list[0]).toMatchObject({ package: 'a', status: 'indexed', fileCount: 7, size: 1024 });
    expect(list[1]).toMatchObject({ package: 'c', status: 'error' });
    // Error entries must not surface stale size/file counts.
    expect(list[1]?.fileCount).toBeUndefined();
    expect(list[1]?.size).toBeUndefined();
  });

  it('excludes devDependencies from the active set', async () => {
    const home = tmpHome();
    writeManifest(home, { 'zod@3.22.4': indexed('zod', '3.22.4', 10, 2048) });
    const project = tmpProject({
      dependencies: { zod: '^3.22.4' },
      devDependencies: { eslint: '^9.0.0', typescript: '^6.0.0' },
    });

    const svc = ReferenceService.createStandalone(home);
    await svc.initialize(project);

    const list = await svc.listActive();
    expect(list.map((r) => r.package)).toEqual(['zod']);
  });

  it('cleans version ranges and skips workspace/file dependencies', async () => {
    const home = tmpHome();
    writeManifest(home, {
      'zod@3.22.4': indexed('zod', '3.22.4', 10, 2048),
      'left-pad@2.0.0': indexed('left-pad', '2.0.0', 1, 64),
    });
    const project = tmpProject({
      dependencies: {
        zod: '^3.22.4',
        'left-pad': 'npm:pad@~2.0.0',
        internal: 'workspace:*',
        local: 'file:../local',
      },
    });

    const svc = ReferenceService.createStandalone(home);
    await svc.initialize(project);

    const list = (await svc.listActive()).toSorted((x, y) => x.package.localeCompare(y.package));
    expect(list.map((r) => `${r.package}@${r.version}`)).toEqual(['left-pad@2.0.0', 'zod@3.22.4']);
  });
});

describe('node_modules-first indexing', () => {
  it('indexes from an installed node_modules copy without git/npm, skipping nested node_modules', async () => {
    const home = tmpHome();
    const project = tmpProject({ dependencies: { mylib: '^1.0.0' } });

    const libDir = join(project, 'node_modules', 'mylib');
    mkdirSync(libDir, { recursive: true });
    writeFileSync(join(libDir, 'index.js'), 'export const hello = () => 42;', 'utf8');
    // Nested node_modules must be pruned from the cached copy.
    mkdirSync(join(libDir, 'node_modules', 'dep'), { recursive: true });
    writeFileSync(join(libDir, 'node_modules', 'dep', 'x.js'), 'nested', 'utf8');

    const svc = ReferenceService.createStandalone(home);
    await svc.initialize(project);
    // Background warm-up copies from node_modules (no child processes involved).
    await svc.whenWarm();

    const list = await svc.listActive();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ package: 'mylib', status: 'indexed', source: 'local' });
    // Only index.js — the nested node_modules file was filtered out.
    expect(list[0]?.fileCount).toBe(1);
  });
});

describe('monorepo dependency aggregation', () => {
  it('grounds against dependencies from every workspace, not just the active one', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ref-mono-'));
    homes.push(root);
    // `.git` so findProjectRoot stops here; pnpm-workspace marks it a monorepo.
    mkdirSync(join(root, '.git'), { recursive: true });
    writeFileSync(join(root, 'pnpm-workspace.yaml'), 'packages:\n  - "packages/*"\n', 'utf8');
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'root' }), 'utf8');

    const pkgA = join(root, 'packages', 'a');
    const pkgB = join(root, 'packages', 'b');
    mkdirSync(pkgA, { recursive: true });
    mkdirSync(pkgB, { recursive: true });
    writeFileSync(join(pkgA, 'package.json'), JSON.stringify({ dependencies: { zod: '^3.22.4' } }));
    writeFileSync(join(pkgB, 'package.json'), JSON.stringify({ dependencies: { react: '^18.2.0' } }));

    const home = tmpHome();
    writeManifest(home, {
      'zod@3.22.4': indexed('zod', '3.22.4', 10, 2048),
      'react@18.2.0': indexed('react', '18.2.0', 50, 100_000),
    });

    const svc = ReferenceService.createStandalone(home);
    // Initialize from workspace A — react (declared only in B) must still be active.
    await svc.initialize(pkgA);

    const list = (await svc.listActive()).toSorted((x, y) => x.package.localeCompare(y.package));
    expect(list.map((r) => r.package)).toEqual(['react', 'zod']);
  });
});

describe('clear', () => {
  it('removes all cached references and empties the manifest', async () => {
    const home = tmpHome();
    writeManifest(home, { 'zod@3.22.4': indexed('zod', '3.22.4', 10, 2048) });
    const project = tmpProject({ dependencies: { zod: '^3.22.4' } });

    const svc = ReferenceService.createStandalone(home);
    await svc.initialize(project);
    await svc.clear();

    const raw = readFileSync(join(home, 'references', 'manifest.json'), 'utf8');
    expect(JSON.parse(raw).references).toEqual({});
    expect(await svc.getSummary()).toBe('');
  });
});
