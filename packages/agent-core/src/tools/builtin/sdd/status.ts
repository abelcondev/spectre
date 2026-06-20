/**
 * SddStatusTool — verify that the SDD harness is present and consistent.
 *
 * This is the native equivalent of running `./init.sh`. It checks files,
 * directories, and the state layout without spawning a shell script.
 */

import type { Kaos } from '@moonshot-ai/kaos';
import { join } from 'pathe';
import { z } from 'zod';

import type { BuiltinTool } from '../../../agent/tool';
import type { ExecutableToolResult, ToolExecution } from '../../../loop/types';
import { toInputJsonSchema } from '../../support/input-schema';
import { findProjectRoot, pathExists } from './sdd-utils';
import DESCRIPTION from './status.md?raw';

export const SddStatusInputSchema = z.object({});

export type SddStatusInput = z.infer<typeof SddStatusInputSchema>;

const REQUIRED_FILES = [
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

export class SddStatusTool implements BuiltinTool<SddStatusInput> {
  readonly name = 'SddStatus' as const;
  readonly description = DESCRIPTION;
  readonly parameters: Record<string, unknown> = toInputJsonSchema(SddStatusInputSchema);

  constructor(
    private readonly kaos: Kaos,
    private readonly cwd: string,
  ) {}

  resolveExecution(_args: SddStatusInput): ToolExecution {
    return {
      description: 'Verifying SDD harness',
      approvalRule: this.name,
      execute: () => this.execution(),
    };
  }

  private async execution(): Promise<ExecutableToolResult> {
    const repoRoot = await findProjectRoot(this.kaos, this.cwd);
    if (repoRoot === null) {
      return {
        isError: true,
        output: 'Not inside a Git repository.',
      };
    }

    const errors: string[] = [];
    const ok: string[] = [];

    for (const file of REQUIRED_FILES) {
      if (await pathExists(this.kaos, join(repoRoot, file))) {
        ok.push(`[OK] ${file}`);
      } else {
        errors.push(`[FAIL] Missing ${file}`);
      }
    }

    if (await pathExists(this.kaos, join(repoRoot, 'sdd/features'))) {
      ok.push('[OK] sdd/features/ exists');
    } else {
      errors.push('[FAIL] Missing sdd/features/');
    }

    if (await pathExists(this.kaos, join(repoRoot, 'sdd/decisions'))) {
      ok.push('[OK] sdd/decisions/ exists');
    } else {
      errors.push('[WARN] Missing sdd/decisions/');
    }

    // Validate init.sh is executable.
    const initShPath = join(repoRoot, 'init.sh');
    if (await pathExists(this.kaos, initShPath)) {
      const statResult = await this.kaos.stat(initShPath);
      const isExecutable = (statResult.stMode & 0o111) !== 0;
      if (isExecutable) {
        ok.push('[OK] init.sh is executable');
      } else {
        errors.push('[FAIL] init.sh is not executable');
      }
    }

    const output = [...ok, ...errors].join('\n');
    if (errors.length > 0) {
      return {
        isError: true,
        output: `${output}\n\n[FAIL] SDD harness is not ready — ${errors.length} error(s)`,
      };
    }

    return {
      output: `${output}\n\n[OK] SDD harness ready`,
    };
  }
}
