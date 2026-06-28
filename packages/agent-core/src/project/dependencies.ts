/**
 * Package.json parsing and dependency resolution utilities.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'pathe';

export interface PackageJson {
  readonly name?: string;
  readonly version?: string;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
  readonly main?: string;
  readonly types?: string;
  readonly exports?: Record<string, unknown> | string;
  readonly repository?: string | { type?: string; url?: string };
  readonly workspaces?: readonly string[];
}

/**
 * Parse a `package.json` file from the given directory.
 * Returns `null` if the file does not exist or cannot be parsed.
 */
export async function parsePackageJson(dirPath: string): Promise<PackageJson | null> {
  try {
    const content = await readFile(join(dirPath, 'package.json'), 'utf-8');
    return JSON.parse(content) as PackageJson;
  } catch {
    return null;
  }
}

/**
 * Get all production dependencies from a `package.json`.
 * Includes `dependencies` and `peerDependencies` (not `devDependencies`).
 */
export function getProductionDependencies(
  pkg: PackageJson,
): Record<string, string> {
  return {
    ...(pkg.dependencies ?? {}),
    ...(pkg.peerDependencies ?? {}),
  };
}

/**
 * Resolve a dependency version range to its bare version string.
 * Strips common range prefixes (`^`, `~`, `>=`, etc.).
 * In the future this could read lockfiles for exact pinning.
 */
export function resolveDependencyVersion(
  _name: string,
  versionRange: string,
): string {
  return versionRange.replace(/^[\^~>=<]*/, '');
}

/**
 * Check if a dependency uses the `workspace:` protocol (monorepo internal).
 */
export function isWorkspaceDependency(version: string): boolean {
  return version.startsWith('workspace:');
}

/**
 * Extract the repository URL from a `package.json`.
 * Normalizes common Git URL formats to HTTPS.
 */
export function getRepositoryUrl(pkg: PackageJson): string | null {
  if (typeof pkg.repository === 'string') return pkg.repository;
  if (pkg.repository?.url) {
    return pkg.repository.url
      .replace(/^git\+/, '')
      .replace(/^git:\/\//, 'https://')
      .replace(/\.git$/, '');
  }
  return null;
}
