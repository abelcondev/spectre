/**
 * KnowledgeTool — search the project's OKF knowledge bundle (`sdd/`).
 *
 * Uses the KnowledgeService to search the indexed concepts (decisions, tasks,
 * proposal) so the agent can recall prior decisions and context instead of
 * re-reading files or re-asking the user.
 */

import { z } from 'zod';

import type { BuiltinTool } from '../../../agent/tool';
import { ToolAccesses } from '../../../loop/tool-access';
import type { ExecutableToolContext, ExecutableToolResult, ToolExecution } from '../../../loop/types';
import type { IKnowledgeService } from '../../../services/knowledge';
import { toInputJsonSchema } from '../../support/input-schema';
import { literalRulePattern, matchesGlobRuleSubject } from '../../support/rule-match';
import { ToolResultBuilder } from '../../support/result-builder';
import DESCRIPTION from './knowledge.md?raw';

// ── Input schema ─────────────────────────────────────────────────────

export const KnowledgeInputSchema = z.object({
  query: z
    .string()
    .describe('What to search for in the project knowledge bundle, e.g. "auth decision", "login acceptance criteria".'),
  type: z
    .string()
    .optional()
    .describe('Optional concept type to scope the search, e.g. "Decision", "Task", "Proposal".'),
});

export type KnowledgeInput = z.infer<typeof KnowledgeInputSchema>;

// ── Implementation ───────────────────────────────────────────────────

export class KnowledgeTool implements BuiltinTool<KnowledgeInput> {
  readonly name = 'Knowledge' as const;
  readonly description: string = DESCRIPTION;
  readonly parameters: Record<string, unknown> = toInputJsonSchema(KnowledgeInputSchema);

  constructor(private readonly service: IKnowledgeService) {}

  resolveExecution(args: KnowledgeInput): ToolExecution {
    const preview = args.query.length > 40 ? `${args.query.slice(0, 40)}…` : args.query;
    const subject = args.type ? `${args.type}: ${args.query}` : args.query;
    return {
      accesses: ToolAccesses.none(),
      description: `Searching project knowledge: ${preview}`,
      display: { kind: 'search', query: subject },
      approvalRule: literalRulePattern(this.name, subject),
      matchesRule: (ruleArgs) => matchesGlobRuleSubject(ruleArgs, args.query),
      execute: (ctx) => this.execution(args, ctx),
    };
  }

  private async execution(
    args: KnowledgeInput,
    _ctx: ExecutableToolContext,
  ): Promise<ExecutableToolResult> {
    try {
      const results = await this.service.search(args.query, args.type);
      const builder = new ToolResultBuilder({ maxLineLength: null });

      if (results.length === 0) {
        builder.write(`No matches in the project knowledge bundle for "${args.query}".`);
        builder.write('');
        builder.write('This could mean:');
        builder.write('- The `sdd/` bundle is empty or not set up (use /sdd-status to check)');
        builder.write('- The concept does not exist yet');
        builder.write('- The query does not match — try different terms or browse sdd/index.md');
        return builder.ok();
      }

      builder.write(
        `Found ${results.length} match${results.length === 1 ? '' : 'es'} in the project knowledge bundle:\n`,
      );

      for (const result of results) {
        builder.write(`## ${result.file}:${result.line}`);
        builder.write('```');
        builder.write(result.snippet);
        builder.write('```\n');
      }

      return builder.ok();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        output: `Knowledge search failed: ${msg}`,
      };
    }
  }
}
