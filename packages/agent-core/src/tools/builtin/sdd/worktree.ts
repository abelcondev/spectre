/**
 * SddWorktreeTool — manage feature worktrees for the SDD flow.
 *
 * Replaces `./scripts/sdd-worktree.sh` with native Git operations through Kaos.
 */

import type { Kaos } from '@moonshot-ai/kaos';
import { basename, dirname, join } from 'pathe';
import { z } from 'zod';

import type { BuiltinTool } from '../../../agent/tool';
import type { ExecutableToolResult, ToolExecution } from '../../../loop/types';
import { toInputJsonSchema } from '../../support/input-schema';
import {
  findProjectRoot,
  installDependencies,
  pathExists,
  requireCleanMain,
  runCommand,
  runGit,
  validateFeatureSlug,
  worktreePathFor,
} from './sdd-utils';
import DESCRIPTION from './worktree.md?raw';

export const SddWorktreeInputSchema = z.object({
  command: z
    .enum(['create', 'remove', 'list', 'status'])
    .describe('Worktree operation to perform.'),
  featureSlug: z
    .string()
    .optional()
    .describe('Feature slug (kebab-case). Required for create, remove, and status.'),
});

export type SddWorktreeInput = z.infer<typeof SddWorktreeInputSchema>;

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

export class SddWorktreeTool implements BuiltinTool<SddWorktreeInput> {
  readonly name = 'SddWorktree' as const;
  readonly description = DESCRIPTION;
  readonly parameters: Record<string, unknown> = toInputJsonSchema(SddWorktreeInputSchema);

  constructor(
    private readonly kaos: Kaos,
    private readonly cwd: string,
  ) {}

  resolveExecution(args: SddWorktreeInput): ToolExecution {
    return {
      description: `SDD worktree ${args.command}`,
      approvalRule: this.name,
      execute: () => this.execution(args),
    };
  }

  private async execution(args: SddWorktreeInput): Promise<ExecutableToolResult> {
    const repoRoot = await findProjectRoot(this.kaos, this.cwd);
    if (repoRoot === null) {
      return { isError: true, output: 'Not inside a Git repository.' };
    }

    switch (args.command) {
      case 'create':
        if (!args.featureSlug) {
          return { isError: true, output: 'featureSlug is required for create.' };
        }
        return this.createWorktree(repoRoot, args.featureSlug);
      case 'remove':
        if (!args.featureSlug) {
          return { isError: true, output: 'featureSlug is required for remove.' };
        }
        return this.removeWorktree(repoRoot, args.featureSlug);
      case 'list':
        return this.listWorktrees(repoRoot);
      case 'status':
        if (!args.featureSlug) {
          return { isError: true, output: 'featureSlug is required for status.' };
        }
        return this.statusWorktree(repoRoot, args.featureSlug);
      default:
        return { isError: true, output: `Unknown command: ${String(args.command)}` };
    }
  }

  private async createWorktree(repoRoot: string, slug: string): Promise<ExecutableToolResult> {
    validateFeatureSlug(slug);

    const cleanCheck = await requireCleanMain(this.kaos, repoRoot);
    if (!cleanCheck.ok) {
      return { isError: true, output: cleanCheck.reason };
    }

    const productPath = join(repoRoot, 'sdd/product.md');
    if (!(await pathExists(this.kaos, productPath))) {
      return {
        isError: true,
        output:
          'No global product definition found.\n' +
          'Define the product first by running SddInit with product_answers.\n' +
          'A feature can only be created after sdd/product.md exists.',
      };
    }

    const repoName = basename(repoRoot);
    const branchName = `feature/${slug}`;
    const worktreePath = worktreePathFor(repoRoot, repoName, slug);
    const projectPath = join(worktreePath, 'sdd/features', slug);

    if (await pathExists(this.kaos, worktreePath)) {
      return {
        isError: true,
        output: `Worktree for '${slug}' already exists at ${worktreePath}`,
      };
    }

    const branchExists = await this.branchExists(repoRoot, branchName);
    if (branchExists) {
      return {
        isError: true,
        output: `Branch '${branchName}' already exists. Remove the previous worktree or use another slug.`,
      };
    }

    const mainBranch = await this.getMainBranch(repoRoot);
    if (mainBranch === null) {
      return {
        isError: true,
        output:
          'No main or master branch found in this repository.\n' +
          'Run SddInit first to install the SDD framework and create the base branch, ' +
          'or create an initial commit manually on main/master.',
      };
    }

    const createBranch = await runGit(this.kaos, repoRoot, ['branch', branchName, mainBranch]);
    if (createBranch.exitCode !== 0) {
      return { isError: true, output: createBranch.stderr };
    }

    const createWt = await runGit(this.kaos, repoRoot, ['worktree', 'add', worktreePath, branchName]);
    if (createWt.exitCode !== 0) {
      // Rollback branch on failure.
      await runGit(this.kaos, repoRoot, ['branch', '-D', branchName]);
      return { isError: true, output: createWt.stderr };
    }

    // Create state directories.
    for (const state of PRODUCT_STATES) {
      await this.kaos.mkdir(join(projectPath, 'product', state), { parents: true, existOk: true });
    }
    for (const state of DESIGN_STATES) {
      await this.kaos.mkdir(join(projectPath, 'design', state), { parents: true, existOk: true });
    }
    for (const state of DEV_STATES) {
      await this.kaos.mkdir(join(projectPath, 'dev', state), { parents: true, existOk: true });
    }

    // Write project README.
    const readmePath = join(projectPath, 'README.md');
    await this.kaos.writeText(readmePath, projectReadme(slug));

    // Commit the scaffold in the worktree.
    const addResult = await runGit(this.kaos, worktreePath, ['add', `sdd/features/${slug}/`]);
    if (addResult.exitCode === 0) {
      await runGit(this.kaos, worktreePath, [
        'commit',
        '-m',
        `chore(sdd): create project ${slug}`,
      ]);
    }

    // Install dependencies so the worktree is ready for development.
    const installResult = await installDependencies(this.kaos, worktreePath);
    const installMessage =
      installResult.exitCode === 0
        ? `Dependencies installed (${installResult.stdout.trim() || 'ok'}).`
        : `Dependency install failed:\n${installResult.stderr}`;

    return {
      output:
        `Feature '${slug}' has been created in its own worktree.\n\n` +
        `  Path:    ${worktreePath}\n` +
        `  Branch:  ${branchName}\n` +
        `  Project: ${projectPath}\n\n` +
        `${installMessage}\n\n` +
        'STOP — switch to the worktree to continue working on this feature:\n' +
        `  cd "${worktreePath}"\n\n` +
        'All product-level context lives in the main repo; feature-specific Issues live inside the worktree under sdd/features/.',
    };
  }

  private async removeWorktree(repoRoot: string, slug: string): Promise<ExecutableToolResult> {
    validateFeatureSlug(slug);

    const repoName = basename(repoRoot);
    const branchName = `feature/${slug}`;
    const worktreePath = worktreePathFor(repoRoot, repoName, slug);

    if (await pathExists(this.kaos, worktreePath)) {
      const remove = await runGit(this.kaos, repoRoot, ['worktree', 'remove', '--force', worktreePath]);
      if (remove.exitCode !== 0) {
        return { isError: true, output: remove.stderr };
      }
    }

    await runGit(this.kaos, repoRoot, ['worktree', 'prune']);

    if (await this.branchExists(repoRoot, branchName)) {
      await runGit(this.kaos, repoRoot, ['branch', '-D', branchName]);
    }

    if (await pathExists(this.kaos, worktreePath)) {
      await runCommand(this.kaos, dirname(worktreePath), ['rm', '-rf', worktreePath]);
    }

    return { output: `Worktree and branch for '${slug}' removed.` };
  }

  private async listWorktrees(repoRoot: string): Promise<ExecutableToolResult> {
    const list = await runGit(this.kaos, repoRoot, ['worktree', 'list', '--porcelain']);
    if (list.exitCode !== 0) {
      return { isError: true, output: list.stderr };
    }

    const repoName = basename(repoRoot);
    const prefix = `${dirname(repoRoot)}/${repoName}-`;
    const lines = list.stdout.split('\n').filter((line) => line.startsWith('worktree '));
    const featureLines = lines
      .map((line) => line.slice('worktree '.length).trim())
      .filter((path) => path.startsWith(prefix))
      .map((path) => `  📁 ${path.slice(prefix.length)} — ${path}`);

    if (featureLines.length === 0) {
      return { output: 'Active feature worktrees:\n  (none)' };
    }
    return { output: `Active feature worktrees:\n${featureLines.join('\n')}` };
  }

  private async statusWorktree(repoRoot: string, slug: string): Promise<ExecutableToolResult> {
    validateFeatureSlug(slug);

    const repoName = basename(repoRoot);
    const worktreePath = worktreePathFor(repoRoot, repoName, slug);
    if (!(await pathExists(this.kaos, worktreePath))) {
      return {
        isError: true,
        output: `No worktree exists for '${slug}'. Create it with SddWorktree command=create.`,
      };
    }

    const branch = await runGit(this.kaos, worktreePath, ['branch', '--show-current']);
    const diff = await runGit(this.kaos, worktreePath, ['diff', '--quiet']);
    const cached = await runGit(this.kaos, worktreePath, ['diff', '--cached', '--quiet']);
    const dirty = diff.exitCode !== 0 || cached.exitCode !== 0 ? ' (with uncommitted changes)' : 'clean';

    let output = `Worktree '${slug}' status:\n`;
    output += `  Path:   ${worktreePath}\n`;
    output += `  Branch: ${branch.stdout.trim()}\n`;
    output += `  Git:    ${dirty}\n`;

    // Run init.sh if available.
    const initPath = join(worktreePath, 'init.sh');
    if (await pathExists(this.kaos, initPath)) {
      const init = await runCommand(this.kaos, worktreePath, ['./init.sh'], 60_000);
      output += `\ninit.sh:\n${init.stdout}\n${init.stderr}`;
      if (init.exitCode !== 0) {
        return { isError: true, output };
      }
    }

    return { output };
  }

  private async getMainBranch(repoRoot: string): Promise<string | null> {
    for (const branch of ['main', 'master']) {
      const result = await runGit(this.kaos, repoRoot, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]);
      if (result.exitCode === 0) return branch;
    }
    return null;
  }

  private async branchExists(repoRoot: string, branchName: string): Promise<boolean> {
    const result = await runGit(this.kaos, repoRoot, ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`]);
    return result.exitCode === 0;
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
