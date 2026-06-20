/**
 * SddInitTool — install the SDD framework into the current Git repository.
 *
 * The framework files are bundled as static assets so Specter can bootstrap
 * SDD offline, without fetching from GitHub.
 */

import type { Kaos } from '@moonshot-ai/kaos';
import { join } from 'pathe';
import { z } from 'zod';

import type { BuiltinTool } from '../../../agent/tool';
import type { ExecutableToolResult, ToolExecution } from '../../../loop/types';
import { toInputJsonSchema } from '../../support/input-schema';
import { SDD_ASSETS, SDD_EMPTY_DIRS } from './sdd-assets';
import {
  findProjectRoot,
  pathExists,
  runCommand,
  runGit,
} from './sdd-utils';
import DESCRIPTION from './init.md?raw';

export const SddInitInputSchema = z.object({
  force: z
    .boolean()
    .optional()
    .describe('Overwrite existing SDD files if they already exist.'),
});

export type SddInitInput = z.infer<typeof SddInitInputSchema>;

export class SddInitTool implements BuiltinTool<SddInitInput> {
  readonly name = 'SddInit' as const;
  readonly description = DESCRIPTION;
  readonly parameters: Record<string, unknown> = toInputJsonSchema(SddInitInputSchema);

  constructor(
    private readonly kaos: Kaos,
    private readonly cwd: string,
  ) {}

  resolveExecution(args: SddInitInput): ToolExecution {
    return {
      description: 'Installing SDD framework into the current project',
      approvalRule: this.name,
      execute: () => this.execution(args),
    };
  }

  private async execution(args: SddInitInput): Promise<ExecutableToolResult> {
    const repoRoot = await findProjectRoot(this.kaos, this.cwd);
    if (repoRoot === null) {
      return {
        isError: true,
        output:
          'The current directory is not inside a Git repository. Initialize a Git repo first (`git init`).',
      };
    }

    const sddDir = join(repoRoot, 'sdd');
    if (!args.force && (await pathExists(this.kaos, sddDir))) {
      return {
        isError: true,
        output:
          'SDD is already installed in this project. Pass force=true to overwrite, or run SddStatus to verify.',
      };
    }

    const written: string[] = [];
    for (const asset of SDD_ASSETS) {
      const targetPath = join(repoRoot, asset.path);
      await this.kaos.mkdir(join(targetPath, '..'), { parents: true, existOk: true });
      await this.kaos.writeText(targetPath, asset.content);
      if (asset.executable) {
        await runCommand(this.kaos, repoRoot, ['chmod', '+x', targetPath]);
      }
      written.push(asset.path);
    }

    for (const dir of SDD_EMPTY_DIRS) {
      await this.kaos.mkdir(join(repoRoot, dir), { parents: true, existOk: true });
    }

    // Stage the new files so the human can review the diff before committing.
    const addResult = await runGit(this.kaos, repoRoot, ['add', '.']);
    if (addResult.exitCode !== 0) {
      return {
        isError: false,
        output:
          `SDD files written, but could not stage them:\n${addResult.stderr}\n\n` +
          `Written files:\n${written.map((p) => `  ${p}`).join('\n')}`,
      };
    }

    return {
      output:
        `SDD framework installed in ${repoRoot}.\n` +
        `${written.length} files written and staged.\n` +
        'Review the changes with `git diff --cached` and commit when ready.',
    };
  }
}
