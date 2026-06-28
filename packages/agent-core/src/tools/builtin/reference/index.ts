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
  query: z.string().describe('What to search for in the package source, e.g. "parse function signature", "useState implementation", "discriminatedUnion types".'),
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
        builder.write(`No results found in ${args.package} for "${args.query}".`);
        builder.write('');
        builder.write('This could mean:');
        builder.write('- The package is not indexed yet (use /references to check status)');
        builder.write('- The search query does not match any code in the package');
        builder.write('- Try a different search term or check the package name');
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
}
