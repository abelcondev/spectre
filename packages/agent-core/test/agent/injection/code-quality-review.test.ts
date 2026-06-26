import { describe, expect, it } from 'vitest';

import type { Agent } from '../../../src/agent';
import type { ContextMessage } from '../../../src/agent/context';
import { CodeQualityReviewInjector } from '../../../src/agent/injection/code-quality-review';

// ---------------------------------------------------------------------------
// Stub agent
// ---------------------------------------------------------------------------

function reviewAgent(history: ContextMessage[]): Agent {
  return {
    context: {
      get history() {
        return history;
      },
      appendSystemReminder: (content: string, origin: ContextMessage['origin']) => {
        history.push({
          role: 'user',
          content: [{ type: 'text', text: `<system-reminder>\n${content}\n</system-reminder>` }],
          toolCalls: [],
          origin,
        });
      },
    },
  } as unknown as Agent;
}

// ---------------------------------------------------------------------------
// Message builders
// ---------------------------------------------------------------------------

function assistantMessage(): ContextMessage {
  return {
    role: 'assistant',
    content: [{ type: 'text', text: 'working' }],
    toolCalls: [],
  };
}

function writeCall(path: string, lineCount: number): ContextMessage {
  const content = `${'export const x = 1;\n'.repeat(lineCount)}`;
  return {
    role: 'assistant',
    content: [],
    toolCalls: [
      {
        type: 'function',
        id: `call_write_${path}`,
        name: 'Write',
        arguments: JSON.stringify({ path, content }),
      },
    ],
  };
}

function editCall(path: string, newStringLines: number): ContextMessage {
  const newString = `${'const y = 2;\n'.repeat(newStringLines)}`;
  return {
    role: 'assistant',
    content: [],
    toolCalls: [
      {
        type: 'function',
        id: `call_edit_${path}`,
        name: 'Edit',
        arguments: JSON.stringify({ path, old_string: 'old', new_string: newString }),
      },
    ],
  };
}

function priorReview(): ContextMessage {
  return {
    role: 'user',
    content: [{ type: 'text', text: '<system-reminder>\nPrior review\n</system-reminder>' }],
    toolCalls: [],
    origin: { kind: 'injection', variant: 'code_quality_review' },
  };
}

function lastReminderText(history: readonly ContextMessage[]): string {
  const message = history.findLast((entry) => entry.origin?.variant === 'code_quality_review');
  return message?.content.map((part) => (part.type === 'text' ? part.text : '')).join('') ?? '';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CodeQualityReviewInjector', () => {
  describe('trigger conditions', () => {
    it('does not inject when there is no Write/Edit in history', async () => {
      const history = [assistantMessage(), assistantMessage()];
      const agent = reviewAgent(history);
      const injector = new CodeQualityReviewInjector(agent);

      await injector.inject();

      expect(history).toHaveLength(2);
    });

    it('does not inject for a markdown file', async () => {
      const history = [writeCall('README.md', 200)];
      const agent = reviewAgent(history);
      const injector = new CodeQualityReviewInjector(agent);

      await injector.inject();

      expect(history).toHaveLength(1);
    });

    it('does not inject for a json file', async () => {
      const history = [writeCall('package.json', 200)];
      const agent = reviewAgent(history);
      const injector = new CodeQualityReviewInjector(agent);

      await injector.inject();

      expect(history).toHaveLength(1);
    });

    it('does not inject when Write is below the line threshold', async () => {
      const history = [writeCall('src/app.ts', 100)];
      const agent = reviewAgent(history);
      const injector = new CodeQualityReviewInjector(agent);

      await injector.inject();

      expect(history).toHaveLength(1);
    });

    it('injects when Write exceeds the line threshold for a .ts file', async () => {
      const history = [writeCall('src/components/Form.tsx', 160)];
      const agent = reviewAgent(history);
      const injector = new CodeQualityReviewInjector(agent);

      await injector.inject();

      const text = lastReminderText(history);
      expect(text).toContain('src/components/Form.tsx');
      expect(text).toContain('Quality checks');
      expect(text).toContain('Single Responsibility');
      expect(text).toContain('fix it now');
    });

    it('injects when Write exceeds the line threshold for a .svelte file', async () => {
      const history = [writeCall('src/routes/+page.svelte', 200)];
      const agent = reviewAgent(history);
      const injector = new CodeQualityReviewInjector(agent);

      await injector.inject();

      const text = lastReminderText(history);
      expect(text).toContain('+page.svelte');
    });

    it('injects when Edit new_string exceeds the line threshold', async () => {
      const history = [editCall('src/hooks/useAuth.ts', 85)];
      const agent = reviewAgent(history);
      const injector = new CodeQualityReviewInjector(agent);

      await injector.inject();

      const text = lastReminderText(history);
      expect(text).toContain('useAuth.ts');
    });

    it('does not inject when Edit is below the line threshold', async () => {
      const history = [editCall('src/hooks/useAuth.ts', 50)];
      const agent = reviewAgent(history);
      const injector = new CodeQualityReviewInjector(agent);

      await injector.inject();

      expect(history).toHaveLength(1);
    });
  });

  describe('throttle / dedup', () => {
    it('does not re-inject after already reviewing the most recent write', async () => {
      const history: ContextMessage[] = [
        writeCall('src/app.ts', 160),
        priorReview(),
        assistantMessage(),
      ];
      const agent = reviewAgent(history);
      const injector = new CodeQualityReviewInjector(agent);

      await injector.inject();

      expect(history).toHaveLength(3);
    });

    it('injects again when a new qualifying write follows a prior review', async () => {
      const history: ContextMessage[] = [
        writeCall('src/old.ts', 160),
        priorReview(),
        writeCall('src/new.ts', 180),
      ];
      const agent = reviewAgent(history);
      const injector = new CodeQualityReviewInjector(agent);

      await injector.inject();

      const text = lastReminderText(history);
      expect(text).toContain('src/new.ts');
    });

    it('does not inject when the last write was below threshold after a prior review', async () => {
      const history: ContextMessage[] = [
        writeCall('src/old.ts', 160),
        priorReview(),
        writeCall('src/small.ts', 50),
      ];
      const agent = reviewAgent(history);
      const injector = new CodeQualityReviewInjector(agent);

      await injector.inject();

      // The small write doesn't qualify, and the prior review covers the big one.
      expect(history).toHaveLength(3);
    });

    it('skips non-code writes when scanning backwards and finds the code write behind them', async () => {
      const history: ContextMessage[] = [
        writeCall('src/app.ts', 160),
        writeCall('README.md', 300),
      ];
      const agent = reviewAgent(history);
      const injector = new CodeQualityReviewInjector(agent);

      await injector.inject();

      const text = lastReminderText(history);
      expect(text).toContain('src/app.ts');
    });
  });

  describe('reminder content', () => {
    it('includes the file path in the reminder', async () => {
      const history = [writeCall('src/lib/api/client.ts', 200)];
      const agent = reviewAgent(history);
      const injector = new CodeQualityReviewInjector(agent);

      await injector.inject();

      const text = lastReminderText(history);
      expect(text).toContain('src/lib/api/client.ts');
    });

    it('includes all checklist items', async () => {
      const history = [writeCall('src/app.ts', 200)];
      const agent = reviewAgent(history);
      const injector = new CodeQualityReviewInjector(agent);

      await injector.inject();

      const text = lastReminderText(history);
      expect(text).toContain('Single Responsibility');
      expect(text).toContain('Size');
      expect(text).toContain('Duplication');
      expect(text).toContain('Coupling');
      expect(text).toContain('Error & loading states');
      expect(text).toContain('Type safety');
      expect(text).toContain('Side effects');
    });
  });
});
