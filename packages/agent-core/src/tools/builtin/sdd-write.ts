/**
 * SddWriteTool — write files to sdd/ directory with optional auto-commit.
 *
 * Validates all paths are under sdd/, writes files, and commits if autocommit
 * is enabled in config. This ensures SDD changes are tracked without requiring
 * manual git operations.
 */

import type { Kaos } from '@moonshot-ai/kaos';
import { spawn } from 'node:child_process';
import { dirname } from 'pathe';
import { z } from 'zod';

import type { BuiltinTool } from '../../agent/tool';
import type { ExecutableToolResult, ToolExecution } from '../../loop/types';
import { ToolAccesses } from '../../loop/tool-access';
import { resolvePathAccessPath } from '../policies/path-access';
import { toInputJsonSchema } from '../support/input-schema';
import { literalRulePattern, matchesPathRuleSubject } from '../support/rule-match';
import type { WorkspaceConfig } from '../support/workspace';

const SddFileSchema = z.object({
  path: z.string().describe('Relative path under sdd/ directory'),
  content: z.string().describe('File content to write'),
});

export const SddWriteInputSchema = z.object({
  files: z
    .array(SddFileSchema)
    .min(1)
    .describe('Array of files to write under sdd/ directory'),
  commitMessage: z
    .string()
    .min(1)
    .describe('Git commit message (used when autocommit is enabled)'),
});

export const SddWriteOutputSchema = z.object({
  writtenFiles: z.array(z.string()),
  committed: z.boolean(),
  commitHash: z.string().optional(),
});

export type SddWriteInput = z.infer<typeof SddWriteInputSchema>;
export type SddWriteOutput = z.infer<typeof SddWriteOutputSchema>;

export class SddWriteTool implements BuiltinTool<SddWriteInput> {
  readonly name = 'SddWrite' as const;
  readonly description = `Write files to the sdd/ directory with optional auto-commit. Use this tool when updating proposal.md, memory.md, decisions/, or tasks/ files. All file paths must be under sdd/. When autocommit is enabled in config.toml, changes are automatically committed with your provided message.

Example:
{
  "files": [
    { "path": "sdd/decisions/007-auth-flow.md", "content": "# Decision 007..." },
    { "path": "sdd/proposal.md", "content": "# Proposal\\n\\n<!-- cleared -->" }
  ],
  "commitMessage": "docs(sdd): archive decision 007-auth-flow and clear proposal"
}`;
  readonly parameters: Record<string, unknown> = toInputJsonSchema(SddWriteInputSchema);

  constructor(
    private readonly kaos: Kaos,
    private readonly workspace: WorkspaceConfig,
    private readonly autocommit: boolean = false,
  ) {}

  resolveExecution(args: SddWriteInput): ToolExecution {
    // Validate all paths are under sdd/
    for (const file of args.files) {
      const normalized = file.path.replace(/\\/g, '/');
      if (!normalized.startsWith('sdd/')) {
        const errorPath = resolvePathAccessPath('sdd', {
          kaos: this.kaos,
          workspace: this.workspace,
          operation: 'write',
        });
        return {
          accesses: ToolAccesses.none(),
          description: `Invalid path: ${file.path}`,
          approvalRule: literalRulePattern(this.name, errorPath),
          matchesRule: (ruleArgs) =>
            matchesPathRuleSubject(ruleArgs, errorPath, {
              cwd: this.workspace.workspaceDir,
              pathClass: this.kaos.pathClass(),
              homeDir: this.kaos.gethome(),
            }),
          execute: async () => ({
            isError: true,
            output: `Error: SddWrite only allows files under sdd/ directory. Invalid path: ${file.path}`,
          }),
        };
      }
    }

    const paths = args.files.map((file) =>
      resolvePathAccessPath(file.path, {
        kaos: this.kaos,
        workspace: this.workspace,
        operation: 'write',
      }),
    );

    const firstPath = paths[0]!;
    const firstFile = args.files[0]!;

    return {
      accesses: ToolAccesses.writeFile(firstPath),
      description: `Writing ${args.files.length} SDD file(s)`,
      display: { kind: 'file_io', operation: 'write', path: firstPath, content: firstFile.content },
      approvalRule: literalRulePattern(this.name, firstPath),
      matchesRule: (ruleArgs) =>
        matchesPathRuleSubject(ruleArgs, firstPath, {
          cwd: this.workspace.workspaceDir,
          pathClass: this.kaos.pathClass(),
          homeDir: this.kaos.gethome(),
        }),
      execute: () => this.execution(args, paths),
    };
  }

  private async execution(args: SddWriteInput, safePaths: string[]): Promise<ExecutableToolResult> {
    const writtenFiles: string[] = [];

    // Write each file
    for (let i = 0; i < args.files.length; i++) {
      const file = args.files[i];
      const safePath = safePaths[i];
      if (!file || !safePath) continue;

      const parent = dirname(safePath);

      // Check parent directory exists
      try {
        const stat = await this.kaos.stat(parent);
        if ((stat.stMode & 0o170000) !== 0o040000) {
          return {
            isError: true,
            output: `Parent path is not a directory: ${parent}`,
          };
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return {
            isError: true,
            output: `Parent directory does not exist: ${parent}. Create it before writing this file.`,
          };
        }
      }

      try {
        await this.kaos.writeText(safePath, file.content);
        writtenFiles.push(file.path);
      } catch (error) {
        return {
          isError: true,
          output: `Failed to write ${file.path}: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }

    // If autocommit is disabled, just report success
    if (!this.autocommit) {
      return {
        output: `Written ${writtenFiles.length} file(s):\n${writtenFiles.map((f) => `- ${f}`).join('\n')}`,
      };
    }

    // Autocommit is enabled, try to commit
    try {
      const commitHash = await this.gitCommit(writtenFiles, args.commitMessage);
      return {
        output: `Written and committed ${writtenFiles.length} file(s):\n${writtenFiles.map((f) => `- ${f}`).join('\n')}\n\nCommit: ${commitHash} - ${args.commitMessage}`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        output: `Written ${writtenFiles.length} file(s), but commit failed: ${msg}\n\nFiles written:\n${writtenFiles.map((f) => `- ${f}`).join('\n')}\n\nPlease commit manually with:\ngit add ${writtenFiles.join(' ')}\ngit commit -m "${args.commitMessage}"`,
      };
    }
  }

  private async gitCommit(files: string[], message: string): Promise<string> {
    const cwd = this.workspace.workspaceDir;

    // git add files
    await this.runGitCommand(['add', ...files], cwd);

    // git commit
    await this.runGitCommand(['commit', '-m', message], cwd);

    // Get commit hash
    const hash = await this.runGitCommand(['rev-parse', '--short', 'HEAD'], cwd);
    return hash.trim();
  }

  private runGitCommand(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('git', args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.setEncoding('utf-8');
      child.stderr.setEncoding('utf-8');

      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
      });

      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
      });

      child.once('error', (error) => {
        reject(new Error(`Git command failed: ${error.message}`));
      });

      child.once('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Git command failed with exit code ${code}: ${stderr}`));
        } else {
          resolve(stdout);
        }
      });
    });
  }
}
