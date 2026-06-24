/**
 * Context7Tool — builtin tool for direct Context7 API queries.
 */

import { z } from 'zod';

import type { BuiltinTool } from '../../../agent/tool';
import { ToolAccesses } from '../../../loop/tool-access';
import type { ExecutableToolContext, ExecutableToolResult, ToolExecution } from '../../../loop/types';
import type { Context7ApiProvider } from '../../../tools/providers/context7-api';
import { toInputJsonSchema } from '../../support/input-schema';
import { ToolResultBuilder } from '../../support/result-builder';
import DESCRIPTION from './context7.md?raw';

export { Context7ApiProvider } from '../../../tools/providers/context7-api';

// ── Input schema ─────────────────────────────────────────────────────

export const Context7InputSchema = z.discriminatedUnion('operation', [
  z.object({
    operation: z.literal('search'),
    query: z.string().describe('Library name to search for, e.g. "next.js" or "react-native".'),
  }),
  z.object({
    operation: z.literal('query'),
    libraryId: z.string().describe('Context7 library id returned by a previous search.'),
    query: z.string().describe('Focused question about the library, e.g. "latest stable version and Expo SDK compatibility".'),
  }),
]);

export type Context7Input = z.infer<typeof Context7InputSchema>;

// ── Implementation ───────────────────────────────────────────────────

export class Context7Tool implements BuiltinTool<Context7Input> {
  readonly name = 'Context7' as const;
  readonly description: string = DESCRIPTION;
  readonly parameters: Record<string, unknown> = toInputJsonSchema(Context7InputSchema);

  constructor(private readonly provider: Context7ApiProvider) {}

  resolveExecution(args: Context7Input): ToolExecution {
    const preview =
      args.operation === 'search'
        ? `search: ${args.query}`
        : `query ${args.libraryId}: ${args.query}`;
    return {
      accesses: ToolAccesses.none(),
      description: `Context7 ${preview}`,
      approvalRule: 'Context7',
      execute: (ctx) => this.execution(args, ctx),
    };
  }

  private async execution(
    args: Context7Input,
    _ctx: ExecutableToolContext,
  ): Promise<ExecutableToolResult> {
    try {
      if (args.operation === 'search') {
        const libraries = await this.provider.searchLibraries(args.query);
        const builder = new ToolResultBuilder({ maxLineLength: null });
        if (libraries.length === 0) {
          builder.write(`No Context7 libraries found for "${args.query}".`);
          return builder.ok();
        }
        for (const lib of libraries.slice(0, 10)) {
          builder.write(
            `- id: ${lib.id}\n  name: ${lib.name ?? 'unknown'}\n  versions: ${Array.isArray(lib.versions) ? lib.versions.join(', ') : 'unknown'}\n  lastUpdate: ${lib.lastUpdateDate ?? 'unknown'}`,
          );
        }
        return builder.ok('Use the `id` field with operation "query" to ask documentation questions.');
      }

      const texts = await this.provider.queryContext(args.libraryId, args.query);
      const builder = new ToolResultBuilder({ maxLineLength: null });
      if (texts.length === 0) {
        builder.write('No relevant documentation excerpts found.');
        return builder.ok();
      }
      for (const [i, text] of texts.entries()) {
        builder.write(`--- Excerpt ${String(i + 1)} ---\n${text}`);
      }
      return builder.ok();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        isError: true,
        output: msg,
      };
    }
  }
}
