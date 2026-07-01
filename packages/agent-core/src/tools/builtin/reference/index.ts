/**
 * ReferenceTool — search dependency source code for real implementation details.
 *
 * Uses the ReferenceService to search within cached source code of project
 * dependencies. The service handles cloning, indexing, and searching.
 */

import { z } from 'zod';

import type { BuiltinTool } from '../../../agent/tool';
import { ToolAccesses } from '../../../loop/tool-access';
import type { ExecutableToolContext, ExecutableToolResult, ToolExecution } from '../../../loop/types';
import type { IReferenceService } from '../../../services/reference';
import { toInputJsonSchema } from '../../support/input-schema';
import { literalRulePattern, matchesGlobRuleSubject } from '../../support/rule-match';
import { ToolResultBuilder } from '../../support/result-builder';
import DESCRIPTION from './reference.md?raw';

// ── Input schema ─────────────────────────────────────────────────────

export const ReferenceInputSchema = z.object({
  package: z.string().describe('Package name to search in, e.g. "zod", "react", "@tanstack/react-query".'),
  query: z
    .string()
    .describe(
      'What to search for. Best results come from a single symbol or short identifier — e.g. "GlassView", "useState", "discriminatedUnion". Multiple words are matched as OR (any term), so prefer specific API names over natural-language phrases. Supports regex when you pass a single term (e.g. "useEffect.*cleanup").',
    ),
});

export type ReferenceInput = z.infer<typeof ReferenceInputSchema>;

// ── Implementation ───────────────────────────────────────────────────

export class ReferenceTool implements BuiltinTool<ReferenceInput> {
  readonly name = 'Reference' as const;
  readonly description: string = DESCRIPTION;
  readonly parameters: Record<string, unknown> = toInputJsonSchema(ReferenceInputSchema);

  constructor(private readonly service: IReferenceService) {}

  resolveExecution(args: ReferenceInput): ToolExecution {
    const preview = args.query.length > 40 ? `${args.query.slice(0, 40)}…` : args.query;
    return {
      accesses: ToolAccesses.none(),
      description: `Searching ${args.package}: ${preview}`,
      display: { kind: 'search', query: `${args.package}: ${args.query}` },
      approvalRule: literalRulePattern(this.name, `${args.package}: ${args.query}`),
      matchesRule: (ruleArgs) => matchesGlobRuleSubject(ruleArgs, args.query),
      execute: (ctx) => this.execution(args, ctx),
    };
  }

  private async execution(
    args: ReferenceInput,
    _ctx: ExecutableToolContext,
  ): Promise<ExecutableToolResult> {
    try {
      const results = await this.service.search(args.package, args.query);
      const builder = new ToolResultBuilder({ maxLineLength: null });

      if (results.length === 0) {
        await this.writeEmptyExplanation(builder, args);
        return builder.ok();
      }

      builder.write(`Found ${results.length} result${results.length === 1 ? '' : 's'} in ${args.package}:\n`);

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
        output: `Reference search failed: ${msg}`,
      };
    }
  }

  /**
   * Explain an empty result accurately. The service returns no results in three
   * very different situations; conflating them (the old generic message) sent
   * callers chasing "maybe it's not indexed" when the real cause was the query.
   */
  private async writeEmptyExplanation(
    builder: ToolResultBuilder,
    args: ReferenceInput,
  ): Promise<void> {
    const active = await this.service.listActive().catch(() => []);
    const entry = active.find((r) => r.package === args.package);

    if (!entry) {
      builder.write(`"${args.package}" is not a tracked dependency of this project.`);
      builder.write('');
      builder.write('Only production/peer dependencies are indexed. Run /references to see');
      builder.write('the available packages, and check the package name for typos.');
      return;
    }

    if (entry.status === 'pending') {
      builder.write(`"${args.package}" is still being indexed. Try the search again shortly.`);
      return;
    }

    if (entry.status === 'error') {
      builder.write(`"${args.package}" failed to index, so its source is not searchable.`);
      builder.write('Run /references to inspect status, or refresh it and retry.');
      return;
    }

    builder.write(`No matches for "${args.query}" in ${args.package} (v${entry.version}).`);
    builder.write('');
    builder.write('The package is indexed — this is a query miss, not a missing source.');
    builder.write('Try a single API symbol or identifier (e.g. one export name) rather than a');
    builder.write('phrase; multiple words match as OR, and a lone term can be a regex.');
  }
}
