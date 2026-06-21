/**
 * `spectre sdd` sub-command.
 *
 * Offline SDD lifecycle management: install, verify, worktree, and move issues.
 * Uses the bundled SDD assets from `@moonshot-ai/kimi-code-sdk` so it works
 * without fetching from GitHub.
 */

import { execFile } from 'node:child_process';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';

import { SDD_ASSETS, SDD_EMPTY_DIRS, type SddAsset } from '@moonshot-ai/kimi-code-sdk';
import type { Command } from 'commander';

export interface SddDeps {
  readonly cwd: () => string;
  readonly stdout: { write(chunk: string): boolean };
  readonly stderr: { write(chunk: string): boolean };
  readonly exit: (code: number) => never;
}

const PRODUCT_STATES = ['discovery', 'product-ready'];
const DESIGN_STATES = ['spec-needed', 'designing', 'design-ready'];
const DEV_STATES = [
  'backlog',
  'spec-needed',
  'spec-ready',
  'implementing',
  'blocked',
  'review',
  'rejected',
  'testing',
  'done',
  'cancelled',
];

export function registerSddCommand(parent: Command): void {
  const sdd = parent.command('sdd').description('Manage the SDD framework in the current project.');

  sdd
    .command('init')
    .description('Install the bundled SDD framework into the current Git repository.')
    .option('-f, --force', 'Overwrite existing SDD files.')
    .option('--dry-run', 'Show what files would be written without modifying the repository.')
    .action(async (options: { force?: boolean; dryRun?: boolean }) => {
      await runSddCommand((deps) =>
        handleSddInit(deps, { force: options.force === true, dryRun: options.dryRun === true }),
      );
    });

  sdd
    .command('status')
    .description('Verify the SDD harness in the current project.')
    .action(async () => {
      await runSddCommand((deps) => handleSddStatus(deps));
    });

  sdd
    .command('worktree')
    .description('Manage SDD feature worktrees.')
    .argument('<command>', 'One of: create, remove, list, status')
    .argument('[slug]', 'Feature slug (required for create, remove, status)')
    .action(async (command: string, slug: string | undefined) => {
      await runSddCommand((deps) => handleSddWorktree(deps, command, slug));
    });

  sdd
    .command('move')
    .description('Move an SDD Issue between state folders and commit.')
    .argument('<slug>', 'Feature slug')
    .argument('<issue>', 'Issue file name without .md')
    .argument('<source>', 'Current state path, e.g. design/spec-needed')
    .argument('<target>', 'Target state path, e.g. design/designing')
    .action(async (slug: string, issue: string, source: string, target: string) => {
      await runSddCommand((deps) => handleSddMove(deps, slug, issue, source, target));
    });
}

function createDefaultDeps(): SddDeps {
  return {
    cwd: () => process.cwd(),
    stdout: process.stdout,
    stderr: process.stderr,
    exit: (code) => process.exit(code),
  };
}

async function runSddCommand(handler: (deps: SddDeps) => Promise<number>): Promise<void> {
  const deps = createDefaultDeps();
  const code = await handler(deps);
  if (code !== 0) deps.exit(code);
}

export async function handleSddInit(
  deps: SddDeps,
  options: { force: boolean; dryRun?: boolean },
): Promise<number> {
  const cwd = deps.cwd();
  const repoRoot = await findGitRoot(cwd);
  if (repoRoot === null) {
    deps.stderr.write('error: not inside a Git repository.\n');
    return 1;
  }

  const sddDir = join(repoRoot, 'sdd');
  if (!options.force && !options.dryRun && (await pathExists(sddDir))) {
    deps.stderr.write(
      'error: SDD is already installed. Use --force to overwrite or run "spectre sdd status".\n',
    );
    return 1;
  }

  if (options.dryRun) {
    deps.stdout.write(
      `SDD framework would be installed in ${repoRoot}.\n` +
        `${SDD_ASSETS.length} files would be written:\n` +
        SDD_ASSETS.map((asset) => `  ${asset.path}`).join('\n') +
        '\n',
    );
    return 0;
  }

  try {
    for (const asset of SDD_ASSETS) {
      await writeAsset(repoRoot, asset);
    }
    for (const dir of SDD_EMPTY_DIRS) {
      await mkdir(join(repoRoot, dir), { recursive: true });
    }
  } catch (error) {
    deps.stderr.write(`error: failed to write SDD files: ${formatError(error)}\n`);
    return 1;
  }

  const addResult = await git(repoRoot, ['add', '.']);
  if (addResult.exitCode !== 0) {
    deps.stderr.write(`warning: files written but git add failed: ${addResult.stderr}\n`);
    return 0;
  }

  deps.stdout.write(
    `SDD framework installed in ${repoRoot}.\n` +
      `${SDD_ASSETS.length} files written and staged.\n` +
      'Review the changes with "git diff --cached" and commit when ready.\n',
  );
  return 0;
}

export async function handleSddStatus(deps: SddDeps): Promise<number> {
  const cwd = deps.cwd();
  const repoRoot = await findGitRoot(cwd);
  if (repoRoot === null) {
    deps.stderr.write('error: not inside a Git repository.\n');
    return 1;
  }

  const requiredFiles = [
    'AGENTS.md',
    'CLAUDE.md',
    'init.sh',
    'sdd/README.md',
    'sdd/workflow.md',
    'sdd/architecture.md',
    'sdd/conventions.md',
    'sdd/quality-gates.md',
    'sdd/testing.md',
    'sdd/security.md',
    'sdd/delivery.md',
  ];

  const errors: string[] = [];
  const ok: string[] = [];

  for (const file of requiredFiles) {
    if (await pathExists(join(repoRoot, file))) {
      ok.push(`[OK] ${file}`);
    } else {
      errors.push(`[FAIL] Missing ${file}`);
    }
  }

  if (await pathExists(join(repoRoot, 'sdd/features'))) {
    ok.push('[OK] sdd/features/ exists');
  } else {
    errors.push('[FAIL] Missing sdd/features/');
  }

  if (await pathExists(join(repoRoot, 'sdd/decisions'))) {
    ok.push('[OK] sdd/decisions/ exists');
  } else {
    errors.push('[WARN] Missing sdd/decisions/');
  }

  const output = [...ok, ...errors].join('\n');
  if (errors.length > 0) {
    deps.stderr.write(`${output}\n\n[FAIL] SDD harness is not ready — ${errors.length} error(s)\n`);
    return 1;
  }

  deps.stdout.write(`${output}\n\n[OK] SDD harness ready\n`);
  return 0;
}

async function handleSddWorktree(
  deps: SddDeps,
  command: string,
  slug: string | undefined,
): Promise<number> {
  const cwd = deps.cwd();
  const repoRoot = await findGitRoot(cwd);
  if (repoRoot === null) {
    deps.stderr.write('error: not inside a Git repository.\n');
    return 1;
  }

  switch (command) {
    case 'create': {
      if (!slug) {
        deps.stderr.write('error: feature slug is required for "create".\n');
        return 1;
      }
      return sddWorktreeCreate(deps, repoRoot, slug);
    }
    case 'remove': {
      if (!slug) {
        deps.stderr.write('error: feature slug is required for "remove".\n');
        return 1;
      }
      return sddWorktreeRemove(deps, repoRoot, slug);
    }
    case 'list':
      return sddWorktreeList(deps, repoRoot);
    case 'status': {
      if (!slug) {
        deps.stderr.write('error: feature slug is required for "status".\n');
        return 1;
      }
      return sddWorktreeStatus(deps, repoRoot, slug);
    }
    default:
      deps.stderr.write(`error: unknown worktree command: ${command}\n`);
      return 1;
  }
}

async function sddWorktreeCreate(deps: SddDeps, repoRoot: string, slug: string): Promise<number> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    deps.stderr.write('error: invalid slug. Use kebab-case lowercase.\n');
    return 1;
  }

  const repoName = basename(repoRoot);
  const branchName = `feature/${slug}`;
  const worktreePath = join(dirname(repoRoot), `${repoName}-${slug}`);
  const projectPath = join(worktreePath, 'sdd/features', slug);

  if (await pathExists(worktreePath)) {
    deps.stderr.write(`error: worktree already exists at ${worktreePath}\n`);
    return 1;
  }

  const branchExists = (await git(repoRoot, ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`])).exitCode === 0;
  if (branchExists) {
    deps.stderr.write(`error: branch '${branchName}' already exists.\n`);
    return 1;
  }

  const mainBranch = await getMainBranch(repoRoot);
  if (mainBranch === null) {
    deps.stderr.write('error: neither main nor master branch found.\n');
    return 1;
  }

  const createBranch = await git(repoRoot, ['branch', branchName, mainBranch]);
  if (createBranch.exitCode !== 0) {
    deps.stderr.write(`error: ${createBranch.stderr}\n`);
    return 1;
  }

  const createWt = await git(repoRoot, ['worktree', 'add', worktreePath, branchName]);
  if (createWt.exitCode !== 0) {
    await git(repoRoot, ['branch', '-D', branchName]);
    deps.stderr.write(`error: ${createWt.stderr}\n`);
    return 1;
  }

  for (const state of PRODUCT_STATES) {
    await mkdir(join(projectPath, 'product', state), { recursive: true });
  }
  for (const state of DESIGN_STATES) {
    await mkdir(join(projectPath, 'design', state), { recursive: true });
  }
  for (const state of DEV_STATES) {
    await mkdir(join(projectPath, 'dev', state), { recursive: true });
  }

  await writeFile(join(projectPath, 'README.md'), projectReadme(slug));

  const add = await git(worktreePath, ['add', `sdd/features/${slug}/`]);
  if (add.exitCode === 0) {
    await git(worktreePath, ['commit', '-m', `chore(sdd): create project ${slug}`]);
  }

  deps.stdout.write(
    `Worktree ready for feature '${slug}'\n` +
      `  Path:    ${worktreePath}\n` +
      `  Branch:  ${branchName}\n` +
      `  Project: ${projectPath}\n`,
  );
  return 0;
}

async function sddWorktreeRemove(deps: SddDeps, repoRoot: string, slug: string): Promise<number> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    deps.stderr.write('error: invalid slug. Use kebab-case lowercase.\n');
    return 1;
  }

  const repoName = basename(repoRoot);
  const branchName = `feature/${slug}`;
  const worktreePath = join(dirname(repoRoot), `${repoName}-${slug}`);

  if (await pathExists(worktreePath)) {
    const remove = await git(repoRoot, ['worktree', 'remove', '--force', worktreePath]);
    if (remove.exitCode !== 0) {
      deps.stderr.write(`error: ${remove.stderr}\n`);
      return 1;
    }
  }

  await git(repoRoot, ['worktree', 'prune']);

  const branchExists = (await git(repoRoot, ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`])).exitCode === 0;
  if (branchExists) {
    await git(repoRoot, ['branch', '-D', branchName]);
  }

  deps.stdout.write(`Worktree and branch for '${slug}' removed.\n`);
  return 0;
}

async function sddWorktreeList(deps: SddDeps, repoRoot: string): Promise<number> {
  const list = await git(repoRoot, ['worktree', 'list', '--porcelain']);
  if (list.exitCode !== 0) {
    deps.stderr.write(`error: ${list.stderr}\n`);
    return 1;
  }

  const repoName = basename(repoRoot);
  const prefix = `${dirname(repoRoot)}/${repoName}-`;
  const lines = list.stdout
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => line.slice('worktree '.length).trim())
    .filter((path) => path.startsWith(prefix))
    .map((path) => `  📁 ${path.slice(prefix.length)} — ${path}`);

  if (lines.length === 0) {
    deps.stdout.write('Active feature worktrees:\n  (none)\n');
  } else {
    deps.stdout.write(`Active feature worktrees:\n${lines.join('\n')}\n`);
  }
  return 0;
}

async function sddWorktreeStatus(deps: SddDeps, repoRoot: string, slug: string): Promise<number> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    deps.stderr.write('error: invalid slug. Use kebab-case lowercase.\n');
    return 1;
  }

  const repoName = basename(repoRoot);
  const worktreePath = join(dirname(repoRoot), `${repoName}-${slug}`);
  if (!(await pathExists(worktreePath))) {
    deps.stderr.write(`error: no worktree exists for '${slug}'.\n`);
    return 1;
  }

  const branch = await git(worktreePath, ['branch', '--show-current']);
  const diff = await git(worktreePath, ['diff', '--quiet']);
  const cached = await git(worktreePath, ['diff', '--cached', '--quiet']);
  const dirty = diff.exitCode !== 0 || cached.exitCode !== 0 ? ' (with uncommitted changes)' : 'clean';

  deps.stdout.write(
    `Worktree '${slug}' status:\n` +
      `  Path:   ${worktreePath}\n` +
      `  Branch: ${branch.stdout.trim()}\n` +
      `  Git:    ${dirty}\n`,
  );
  return 0;
}

async function handleSddMove(
  deps: SddDeps,
  slug: string,
  issue: string,
  source: string,
  target: string,
): Promise<number> {
  const cwd = deps.cwd();
  const repoRoot = await findGitRoot(cwd);
  if (repoRoot === null) {
    deps.stderr.write('error: not inside a Git repository.\n');
    return 1;
  }

  const sourceType = issueTypeFor(source);
  const targetType = issueTypeFor(target);
  if (sourceType === null || targetType === null || sourceType !== targetType) {
    deps.stderr.write('error: source and target states must belong to the same issue type.\n');
    return 1;
  }

  const sourceFile = join(repoRoot, 'sdd/features', slug, source, `${issue}.md`);
  const targetFile = join(repoRoot, 'sdd/features', slug, target, `${issue}.md`);

  if (!(await pathExists(sourceFile))) {
    deps.stderr.write(`error: source file does not exist: ${relative(repoRoot, sourceFile)}\n`);
    return 1;
  }
  if (await pathExists(targetFile)) {
    deps.stderr.write(`error: target file already exists: ${relative(repoRoot, targetFile)}\n`);
    return 1;
  }

  await mkdir(dirname(targetFile), { recursive: true });

  const tracked = (await git(repoRoot, ['ls-files', '--error-unmatch', sourceFile])).exitCode === 0;
  if (tracked) {
    const mv = await git(repoRoot, ['mv', sourceFile, targetFile]);
    if (mv.exitCode !== 0) {
      deps.stderr.write(`error: ${mv.stderr}\n`);
      return 1;
    }
  } else {
    const content = await (await import('node:fs/promises')).readFile(sourceFile, 'utf-8');
    await writeFile(targetFile, content);
    await writeFile(sourceFile, '');
    await git(repoRoot, ['rm', '--cached', sourceFile]);
  }

  await updateStateLine(targetFile, target);
  await git(repoRoot, ['add', targetFile]);

  const label = sourceType === 'product' ? '[Product]' : sourceType === 'design' ? '[Design]' : '[Dev]';
  const commit = await git(repoRoot, [
    'commit',
    '-m',
    `chore(sdd): ${issue} ${label} ${source} → ${target}`,
    '--',
    targetFile,
  ]);
  if (commit.exitCode !== 0) {
    deps.stderr.write(`error: ${commit.stderr}\n`);
    return 1;
  }

  deps.stdout.write(`Moved ${issue} ${label}: ${source} → ${target}\n`);
  return 0;
}

// ─── Helpers ───────────────────────────────────────────────────────────

async function writeAsset(repoRoot: string, asset: SddAsset): Promise<void> {
  const targetPath = join(repoRoot, asset.path);
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, asset.content);
  if (asset.executable) {
    await chmodExecutable(targetPath);
  }
}

async function chmodExecutable(path: string): Promise<void> {
  const { chmod } = await import('node:fs/promises');
  await chmod(path, 0o755);
}

async function findGitRoot(start: string): Promise<string | null> {
  try {
    const result = await execFileText('git', ['-C', start, 'rev-parse', '--show-toplevel']);
    return resolve(result.trim());
  } catch {
    return null;
  }
}

async function getMainBranch(repoRoot: string): Promise<string | null> {
  for (const branch of ['main', 'master']) {
    const result = await git(repoRoot, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]);
    if (result.exitCode === 0) return branch;
  }
  return null;
}

async function git(cwd: string, args: readonly string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  try {
    const stdout = await execFileText('git', ['-C', cwd, ...args]);
    return { exitCode: 0, stdout, stderr: '' };
  } catch (error) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
    };
  }
}

function execFileText(command: string, args: readonly string[]): Promise<string> {
  return new Promise((resolveOutput, reject) => {
    execFile(command, [...args], { encoding: 'utf-8' }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolveOutput(stdout);
    });
  });
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function issueTypeFor(state: string): 'product' | 'design' | 'dev' | null {
  if (PRODUCT_STATES.includes(state)) return 'product';
  if (DESIGN_STATES.includes(state)) return 'design';
  if (DEV_STATES.includes(state)) return 'dev';
  return null;
}

async function updateStateLine(filePath: string, state: string): Promise<void> {
  const { readFile } = await import('node:fs/promises');
  try {
    const content = await readFile(filePath, 'utf-8');
    const updated = content.replace(/^State: ["`].*["`]$/m, `State: "${state}"`);
    if (updated !== content) {
      await writeFile(filePath, updated);
    }
  } catch {
    // ignore
  }
}

function projectReadme(slug: string): string {
  return `# ${slug}

Slug: \`${slug}\`

## Context

Brief description of the business problem or opportunity.

## Scope

- Included functionality 1.
- Included functionality 2.

## Out of scope

- Future functionality 1.

## Milestones

1. MVP: ...
2. Iteration 2: ...

## Affected modules

- \`<path-to-module>/\` — create / modify
- \`<path-to-module>/\` — reuse (do not modify)

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| ... | high/medium/low | ... |

## Issues

- Product: \`sdd/features/${slug}/product/\`
- Design: \`sdd/features/${slug}/design/\`
- Dev: \`sdd/features/${slug}/dev/\`
`;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
