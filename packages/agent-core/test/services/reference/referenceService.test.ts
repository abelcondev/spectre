import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { join } from 'pathe';

import { ReferenceService } from '../../../src/services/reference/referenceService';
import type { CachedReference } from '../../../src/services/reference/types';

// Keep the suite hermetic: no real `git` / `npm` / `tar` / `rg` processes. The
// fake child never emits, so any accidental indexing hangs harmlessly (and
// never mutates the manifest) instead of hitting the network. `vi.mock` is
// hoisted above the imports above by vitest regardless of placement.
vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: EventEmitter;
      stderr: EventEmitter;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
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
