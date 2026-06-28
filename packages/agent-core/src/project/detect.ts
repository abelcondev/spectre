/**
 * Project root and monorepo detection utilities.
 *
 * Walks up the directory tree to find the project root (`.git` marker),
 * detects monorepo tooling (pnpm workspaces, Turborepo, Nx), and resolves
 * the active workspace package within a monorepo.
 */
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, normalize } from 'pathe';
import { load as loadYaml } from 'js-yaml';

export interface MonorepoInfo {
  readonly type: 'pnpm' | 'turborepo' | 'nx' | 'lerna';
  readonly root: string;
  readonly workspaceGlobs: readonly string[];
}

/**
 * Find the project root by walking up looking for `.git`.
 * Falls back to the original `cwd` if no `.git` is found.
 */
export async function findProjectRoot(cwd: string): Promise<string> {
  const start = normalize(cwd);
  let current = start;
  while (true) {
    if (await pathExists(join(current, '.git'))) return current;
    const parent = dirname(current);
    if (parent === current) return start;
    current = parent;
  }
}

/**
 * Detect if the project root is a monorepo.
 * Checks for `pnpm-workspace.yaml`, `turbo.json`, `nx.json`, or `lerna.json`.
 * Returns `null` if none of the known monorepo markers are found.
 */
export async function detectMonorepo(projectRoot: string): Promise<MonorepoInfo | null> {
  // Check pnpm-workspace.yaml first (most common in this project's ecosystem)
  const pnpmWorkspacePath = join(projectRoot, 'pnpm-workspace.yaml');
  if (await pathExists(pnpmWorkspacePath)) {
    const content = await readFile(pnpmWorkspacePath, 'utf-8');
    const parsed = loadYaml(content) as { packages?: string[] } | null;
    return {
      type: 'pnpm',
      root: projectRoot,
      workspaceGlobs: parsed?.packages ?? [],
    };
  }

  // Check turbo.json
  if (await pathExists(join(projectRoot, 'turbo.json'))) {
    return { type: 'turborepo', root: projectRoot, workspaceGlobs: [] };
  }

  // Check nx.json
  if (await pathExists(join(projectRoot, 'nx.json'))) {
    return { type: 'nx', root: projectRoot, workspaceGlobs: [] };
  }

  // Check lerna.json
  if (await pathExists(join(projectRoot, 'lerna.json'))) {
    return { type: 'lerna', root: projectRoot, workspaceGlobs: [] };
  }

  return null;
}

/**
 * Determine which workspace the current `cwd` belongs to in a monorepo.
 * Walks up from `cwd` to the monorepo root, returning the first directory
 * that contains a `package.json`. Returns `null` if `cwd` is not inside
 * any workspace package.
 */
export async function getActiveWorkspace(
  cwd: string,
  monorepo: MonorepoInfo,
): Promise<string | null> {
  let current = normalize(cwd);
  const root = normalize(monorepo.root);

  while (current.startsWith(root) && current !== root) {
    const pkgJsonPath = join(current, 'package.json');
    if (await pathExists(pkgJsonPath)) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error: unknown) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code: unknown }).code
        : undefined;
    if (code === 'ENOENT' || code === 'ENOTDIR') return false;
    throw error;
  }
}
