import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'pathe';

import { detectMonorepo, findProjectRoot, getActiveWorkspace } from '../../src/project';

const roots: string[] = [];

function tmpRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ref-detect-'));
  roots.push(dir);
  return dir;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

describe('findProjectRoot', () => {
  it('walks up to the directory containing .git', async () => {
    const root = tmpRoot();
    mkdirSync(join(root, '.git'));
    const nested = join(root, 'packages', 'app');
    mkdirSync(nested, { recursive: true });
    expect(await findProjectRoot(nested)).toBe(root);
  });

  it('falls back to cwd when no .git is found', async () => {
    const root = tmpRoot();
    const nested = join(root, 'a', 'b');
    mkdirSync(nested, { recursive: true });
    expect(await findProjectRoot(nested)).toBe(nested);
  });
});

describe('detectMonorepo', () => {
  it('detects pnpm workspaces and reads its package globs', async () => {
    const root = tmpRoot();
    writeFileSync(
      join(root, 'pnpm-workspace.yaml'),
      'packages:\n  - "packages/*"\n  - "apps/*"\n',
      'utf8',
    );
    const info = await detectMonorepo(root);
    expect(info?.type).toBe('pnpm');
    expect(info?.workspaceGlobs).toEqual(['packages/*', 'apps/*']);
  });

  it('detects turborepo, nx and lerna', async () => {
    const turbo = tmpRoot();
    writeFileSync(join(turbo, 'turbo.json'), '{}', 'utf8');
    expect((await detectMonorepo(turbo))?.type).toBe('turborepo');

    const nx = tmpRoot();
    writeFileSync(join(nx, 'nx.json'), '{}', 'utf8');
    expect((await detectMonorepo(nx))?.type).toBe('nx');

    const lerna = tmpRoot();
    writeFileSync(join(lerna, 'lerna.json'), '{}', 'utf8');
    expect((await detectMonorepo(lerna))?.type).toBe('lerna');
  });

  it('detects an npm/bun workspaces array in the root package.json', async () => {
    const root = tmpRoot();
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: 'monorepo', workspaces: ['mobile', 'web', 'alf', 'packages/*'] }),
      'utf8',
    );
    const info = await detectMonorepo(root);
    expect(info?.type).toBe('npm');
    expect(info?.workspaceGlobs).toEqual(['mobile', 'web', 'alf', 'packages/*']);
  });

  it('detects the yarn-classic workspaces object form', async () => {
    const root = tmpRoot();
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: 'monorepo', workspaces: { packages: ['packages/*'] } }),
      'utf8',
    );
    const info = await detectMonorepo(root);
    expect(info?.type).toBe('npm');
    expect(info?.workspaceGlobs).toEqual(['packages/*']);
  });

  it('fills turborepo workspace globs from the root package.json workspaces', async () => {
    const root = tmpRoot();
    writeFileSync(join(root, 'turbo.json'), '{}', 'utf8');
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ name: 'monorepo', workspaces: ['apps/*'] }),
      'utf8',
    );
    const info = await detectMonorepo(root);
    expect(info?.type).toBe('turborepo');
    expect(info?.workspaceGlobs).toEqual(['apps/*']);
  });

  it('returns null for a non-monorepo', async () => {
    expect(await detectMonorepo(tmpRoot())).toBeNull();
  });

  it('returns null when package.json has no workspaces field', async () => {
    const root = tmpRoot();
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'solo' }), 'utf8');
    expect(await detectMonorepo(root)).toBeNull();
  });
});

describe('getActiveWorkspace', () => {
  it('returns the nearest package directory inside the monorepo', async () => {
    const root = tmpRoot();
    const workspace = join(root, 'packages', 'core');
    const deep = join(workspace, 'src', 'nested');
    mkdirSync(deep, { recursive: true });
    writeFileSync(join(workspace, 'package.json'), '{"name":"core"}', 'utf8');

    const active = await getActiveWorkspace(deep, {
      type: 'pnpm',
      root,
      workspaceGlobs: ['packages/*'],
    });
    expect(active).toBe(workspace);
  });

  it('returns null when cwd is not inside any workspace package', async () => {
    const root = tmpRoot();
    const deep = join(root, 'docs');
    mkdirSync(deep, { recursive: true });
    const active = await getActiveWorkspace(deep, {
      type: 'pnpm',
      root,
      workspaceGlobs: ['packages/*'],
    });
    expect(active).toBeNull();
  });
});
