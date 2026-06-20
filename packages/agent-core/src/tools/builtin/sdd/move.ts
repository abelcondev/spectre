/**
 * SddMoveTool — move an SDD Issue between state folders and commit the change.
 *
 * Replaces `./scripts/sdd-move.sh` with native file/Git operations through Kaos.
 */

import type { Kaos } from '@moonshot-ai/kaos';
import { join } from 'pathe';
import { z } from 'zod';

import type { BuiltinTool } from '../../../agent/tool';
import type { ExecutableToolResult, ToolExecution } from '../../../loop/types';
import { toInputJsonSchema } from '../../support/input-schema';
import { findProjectRoot, issueTypeFor, pathExists, runGit } from './sdd-utils';
import DESCRIPTION from './move.md?raw';

export const SddMoveInputSchema = z.object({
  featureSlug: z.string().describe('Feature project slug.'),
  issueName: z.string().describe('Issue file name without .md extension.'),
  sourceState: z.string().describe('Current state path, e.g. "design/spec-needed".'),
  targetState: z.string().describe('Target state path, e.g. "design/designing".'),
});

export type SddMoveInput = z.infer<typeof SddMoveInputSchema>;

export class SddMoveTool implements BuiltinTool<SddMoveInput> {
  readonly name = 'SddMove' as const;
  readonly description = DESCRIPTION;
  readonly parameters: Record<string, unknown> = toInputJsonSchema(SddMoveInputSchema);

  constructor(
    private readonly kaos: Kaos,
    private readonly cwd: string,
  ) {}

  resolveExecution(args: SddMoveInput): ToolExecution {
    return {
      description: `Moving ${args.issueName} ${args.sourceState} → ${args.targetState}`,
      approvalRule: this.name,
      execute: () => this.execution(args),
    };
  }

  private async execution(args: SddMoveInput): Promise<ExecutableToolResult> {
    const repoRoot = await findProjectRoot(this.kaos, this.cwd);
    if (repoRoot === null) {
      return { isError: true, output: 'Not inside a Git repository.' };
    }

    const sourceType = issueTypeFor(args.sourceState);
    const targetType = issueTypeFor(args.targetState);

    if (sourceType === null) {
      return { isError: true, output: `Invalid source state: ${args.sourceState}` };
    }
    if (targetType === null) {
      return { isError: true, output: `Invalid target state: ${args.targetState}` };
    }
    if (sourceType !== targetType) {
      return {
        isError: true,
        output: `Cannot move ${sourceType} issue to ${targetType} state.`,
      };
    }

    const projectPath = join(repoRoot, 'sdd/features', args.featureSlug);
    const sourceFile = join(projectPath, args.sourceState, `${args.issueName}.md`);
    const targetFile = join(projectPath, args.targetState, `${args.issueName}.md`);

    if (!(await pathExists(this.kaos, sourceFile))) {
      return { isError: true, output: `File does not exist: ${sourceFile}` };
    }
    if (await pathExists(this.kaos, targetFile)) {
      return { isError: true, output: `File already exists: ${targetFile}` };
    }

    // Ensure target parent directory exists.
    await this.kaos.mkdir(join(targetFile, '..'), { parents: true, existOk: true });

    // Move using git mv if the source is tracked; otherwise plain move.
    const tracked = await this.isTracked(repoRoot, sourceFile);
    if (tracked) {
      const mv = await runGit(this.kaos, repoRoot, ['mv', sourceFile, targetFile]);
      if (mv.exitCode !== 0) {
        return { isError: true, output: mv.stderr };
      }
    } else {
      const content = await this.kaos.readText(sourceFile);
      await this.kaos.writeText(targetFile, content);
      await this.kaos.writeText(sourceFile, '');
      await runGit(this.kaos, repoRoot, ['rm', '--cached', sourceFile]);
    }

    // Update State: line in the target file.
    await this.updateStateLine(targetFile, args.targetState);

    // Stage target file.
    await runGit(this.kaos, repoRoot, ['add', targetFile]);

    const issueTypeLabel = sourceType === 'product' ? '[Product]' : sourceType === 'design' ? '[Design]' : '[Dev]';
    const commitMsg = `chore(sdd): ${args.issueName} ${issueTypeLabel} ${args.sourceState} → ${args.targetState}`;
    const commit = await runGit(this.kaos, repoRoot, ['commit', '-m', commitMsg, '--', targetFile]);
    if (commit.exitCode !== 0) {
      return { isError: true, output: commit.stderr };
    }

    return {
      output: `Moved ${args.issueName} ${issueTypeLabel}: ${args.sourceState} → ${args.targetState}`,
    };
  }

  private async isTracked(repoRoot: string, path: string): Promise<boolean> {
    const result = await runGit(this.kaos, repoRoot, ['ls-files', '--error-unmatch', path]);
    return result.exitCode === 0;
  }

  private async updateStateLine(filePath: string, state: string): Promise<void> {
    try {
      const content = await this.kaos.readText(filePath);
      const updated = content.replace(/^State: ["`].*["`]$/m, `State: "${state}"`);
      if (updated !== content) {
        await this.kaos.writeText(filePath, updated);
      }
    } catch {
      // If the file does not have a State: line, leave it unchanged.
    }
  }
}
