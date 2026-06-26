import type { ContextMessage } from '#/agent/context';

import { DynamicInjector } from './injector';

const CODE_QUALITY_REVIEW_VARIANT = 'code_quality_review';

/**
 * Minimum line counts that trigger a review.
 *
 * - `WRITE_RESULT_LINES`: when a **Write** creates/overwrites a file whose
 *   resulting content exceeds this many lines.
 * - `EDIT_MODIFIED_LINES`: when an **Edit**'s `new_string` exceeds this many
 *   lines (proxy for "lines modified").
 */
const WRITE_RESULT_LINES = 150;
const EDIT_MODIFIED_LINES = 80;

/** Extensions considered "code" — non-code files (markdown, config, etc.) are ignored. */
const CODE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs',
  'svelte', 'vue', 'astro',
]);

type FileWriteToolName = 'Write' | 'Edit';

interface QualifyingWrite {
  readonly path: string;
  readonly toolName: FileWriteToolName;
}

/**
 * Injects a quality-checklist reminder after the agent writes a substantial
 * code file. The reminder fires once per qualifying write — it does not repeat
 * until a new qualifying write follows.
 *
 * Non-code files (markdown, json, yaml, etc.) are ignored. Small edits under
 * the thresholds are ignored. The goal is to catch large or structurally
 * significant changes while they are fresh in context, before the agent moves
 * on to unrelated work.
 */
export class CodeQualityReviewInjector extends DynamicInjector {
  protected override readonly injectionVariant = CODE_QUALITY_REVIEW_VARIANT;

  protected override getInjection(): string | undefined {
    const write = findUnreviewedWrite(this.agent.context.history);
    if (write === null) return undefined;
    return renderReviewReminder(write.path);
  }
}

// ---------------------------------------------------------------------------
// History scanning
// ---------------------------------------------------------------------------

/**
 * Scans history backwards looking for the most recent qualifying code write
 * that has not yet been reviewed. Returns `null` when:
 *  - there is no qualifying write in history, or
 *  - our own injection appears after the most recent qualifying write
 *    (i.e. that write was already reviewed).
 */
function findUnreviewedWrite(history: readonly ContextMessage[]): QualifyingWrite | null {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    const message = history[i];
    if (message === undefined) continue;

    // Encountering our own injection before a qualifying write means
    // everything since that injection has been reviewed (or was non-code).
    if (isCodeQualityReview(message)) return null;

    if (message.role === 'assistant') {
      const write = extractQualifyingWrite(message);
      if (write !== null) return write;
    }
  }

  return null;
}

function isCodeQualityReview(message: ContextMessage): boolean {
  return (
    message.origin?.kind === 'injection' &&
    message.origin.variant === CODE_QUALITY_REVIEW_VARIANT
  );
}

function extractQualifyingWrite(message: ContextMessage): QualifyingWrite | null {
  for (const toolCall of message.toolCalls) {
    if (toolCall.name !== 'Write' && toolCall.name !== 'Edit') continue;
    if (typeof toolCall.arguments !== 'string') continue;

    try {
      const args = JSON.parse(toolCall.arguments) as Record<string, unknown>;
      const path = args['path'];
      if (typeof path !== 'string' || !isCodeFile(path)) continue;

      if (toolCall.name === 'Write') {
        const content = args['content'];
        if (typeof content !== 'string') continue;
        if (countLines(content) < WRITE_RESULT_LINES) continue;
      } else {
        const newString = args['new_string'];
        if (typeof newString !== 'string') continue;
        if (countLines(newString) < EDIT_MODIFIED_LINES) continue;
      }

      return { path, toolName: toolCall.name };
    } catch {
      continue;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isCodeFile(path: string): boolean {
  const dot = path.lastIndexOf('.');
  if (dot === -1) return false;
  const ext = path.slice(dot + 1).toLowerCase();
  return CODE_EXTENSIONS.has(ext);
}

function countLines(text: string): number {
  let count = 1;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '\n') count += 1;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Reminder text
// ---------------------------------------------------------------------------

function renderReviewReminder(path: string): string {
  return `You just modified \`${path}\`. Before continuing, quickly verify this change against the checklist below. If any check fails, fix it now — do not move on to new work.

Quality checks:
- **Single Responsibility**: does this file/component/hook have one clear job? Separate UI rendering from business logic, data fetching, and state management. If a component or hook does too much, split it.
- **Size**: if the file exceeds ~200 lines, consider splitting it into smaller, focused modules. Large files are harder to test and maintain.
- **Duplication**: does similar logic already exist elsewhere? Search before duplicating. Copy-pasted code is a maintenance burden.
- **Coupling**: does this create unnecessary dependencies between modules or layers? Prefer composition over direct cross-boundary imports.
- **Error & loading states**: for async operations (API calls, database queries, auth flows), are loading, error, and edge-case states all handled? Never assume success.
- **Type safety**: avoid \`any\`. Define explicit types for props, API responses, state, and external data.
- **Side effects**: are effect cleanups present where needed? Are side effects isolated from pure rendering logic?

If any check reveals a problem, fix it immediately. Then continue with the task.`;
}
