import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'pathe';

import {
  getProductionDependencies,
  getRepositoryUrl,
  isWorkspaceDependency,
  parsePackageJson,
  resolveDependencyVersion,
} from '../../src/project';

const dirs: string[] = [];

function tmpProject(pkg: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'ref-deps-'));
  dirs.push(dir);
  if (pkg !== undefined) {
    writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg), 'utf8');
  }
  return dir;
}

afterEach(() => {
  while (dirs.length > 0) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe('parsePackageJson', () => {
  it('parses a valid package.json', async () => {
    const dir = tmpProject({ name: 'demo', version: '1.0.0' });
    const pkg = await parsePackageJson(dir);
    expect(pkg?.name).toBe('demo');
  });

  it('returns null when the file is missing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ref-deps-empty-'));
    dirs.push(dir);
    expect(await parsePackageJson(dir)).toBeNull();
  });

  it('returns null when the file is malformed', async () => {
    const dir = tmpProject(undefined);
    writeFileSync(join(dir, 'package.json'), '{ not json', 'utf8');
    expect(await parsePackageJson(dir)).toBeNull();
  });
});

describe('getProductionDependencies', () => {
  it('merges dependencies and peerDependencies but excludes devDependencies', () => {
    const result = getProductionDependencies({
      dependencies: { zod: '^3.0.0' },
      peerDependencies: { react: '^18.0.0' },
      devDependencies: { vitest: '^1.0.0' },
    });
    expect(result).toEqual({ zod: '^3.0.0', react: '^18.0.0' });
    expect(result).not.toHaveProperty('vitest');
  });
});

describe('isWorkspaceDependency', () => {
  it('detects the workspace protocol', () => {
    expect(isWorkspaceDependency('workspace:*')).toBe(true);
    expect(isWorkspaceDependency('^1.2.3')).toBe(false);
  });
});

describe('resolveDependencyVersion', () => {
  it('strips range prefixes', () => {
    expect(resolveDependencyVersion('x', '^1.2.3')).toBe('1.2.3');
    expect(resolveDependencyVersion('x', '>=2.0.0')).toBe('2.0.0');
    expect(resolveDependencyVersion('x', '1.0.0')).toBe('1.0.0');
  });
});

describe('getRepositoryUrl', () => {
  it('returns a string repository as-is', () => {
    expect(getRepositoryUrl({ repository: 'https://github.com/a/b' })).toBe(
      'https://github.com/a/b',
    );
  });

  it('normalizes an object repository url', () => {
    expect(
      getRepositoryUrl({ repository: { type: 'git', url: 'git+https://github.com/a/b.git' } }),
    ).toBe('https://github.com/a/b');
  });

  it('returns null when no repository is present', () => {
    expect(getRepositoryUrl({ name: 'x' })).toBeNull();
  });
});
