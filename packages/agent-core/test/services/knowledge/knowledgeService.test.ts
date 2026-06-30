import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { join } from 'pathe';

import { KnowledgeService } from '../../../src/services/knowledge/knowledgeService';

const dirs: string[] = [];

function tmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'knowledge-'));
  dirs.push(dir);
  return dir;
}

/** Build a project with a populated sdd/ OKF bundle and return its root. */
function tmpBundle(): string {
  const root = tmpDir();
  const sdd = join(root, 'sdd');
  mkdirSync(join(sdd, 'decisions'), { recursive: true });
  mkdirSync(join(sdd, 'tasks'), { recursive: true });

  // Index and log have no frontmatter — they are bundle scaffolding, not concepts.
  writeFileSync(join(sdd, 'index.md'), '# Project knowledge\n\nMentions Supabase too.\n');
  writeFileSync(join(sdd, 'log.md'), '# Log\n');

  writeFileSync(
    join(sdd, 'proposal.md'),
    '---\ntype: Proposal\ntitle: MVP\ndescription: Initial proposal\nstatus: draft\n---\n# Proposal\nUse Supabase for auth.\n',
  );
  writeFileSync(
    join(sdd, 'decisions', '001-stack.md'),
    '---\ntype: Decision\ntitle: Stack\ndescription: Chose Expo + Supabase\nstatus: approved\ntags: [stack]\n---\n# Decision\nWe picked Supabase.\n',
  );
  writeFileSync(
    join(sdd, 'tasks', 'login.md'),
    '---\ntype: Task\ntitle: Login\ndescription: Email auth\nstatus: pending\n---\n# Acceptance criteria\n- Given a user, When valid creds, Then session.\n',
  );
  return root;
}

afterEach(() => {
  while (dirs.length > 0) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe('listConcepts', () => {
  it('indexes typed concepts and excludes frontmatter-less files', async () => {
    const svc = KnowledgeService.createStandalone();
    await svc.initialize(tmpBundle());

    const concepts = (await svc.listConcepts()).toSorted((a, b) => a.type.localeCompare(b.type));
    expect(concepts.map((c) => c.type)).toEqual(['Decision', 'Proposal', 'Task']);

    const decision = concepts.find((c) => c.type === 'Decision');
    expect(decision).toMatchObject({
      title: 'Stack',
      description: 'Chose Expo + Supabase',
      status: 'approved',
      path: 'sdd/decisions/001-stack.md',
    });
    expect(decision?.tags).toEqual(['stack']);
  });

  it('finds the bundle when initialized from a subdirectory', async () => {
    const root = tmpBundle();
    const sub = join(root, 'apps', 'web');
    mkdirSync(sub, { recursive: true });

    const svc = KnowledgeService.createStandalone();
    await svc.initialize(sub);

    expect(await svc.listConcepts()).toHaveLength(3);
  });
});

describe('getSummary', () => {
  it('groups concepts by type with descriptions and status', async () => {
    const svc = KnowledgeService.createStandalone();
    await svc.initialize(tmpBundle());

    const summary = await svc.getSummary();
    expect(summary).toContain('## Project Knowledge');
    expect(summary).toContain('### Decision');
    expect(summary).toContain('`sdd/decisions/001-stack.md`');
    expect(summary).toContain('Chose Expo + Supabase');
    expect(summary).toContain('[status: approved]');
  });

  it('returns an empty string when there is no bundle', async () => {
    const svc = KnowledgeService.createStandalone();
    await svc.initialize(tmpDir());

    expect(await svc.getSummary()).toBe('');
    expect(await svc.listConcepts()).toHaveLength(0);
  });
});

describe('search', () => {
  it('matches across the whole bundle and reports project-relative paths', async () => {
    const svc = KnowledgeService.createStandalone();
    await svc.initialize(tmpBundle());

    const files = (await svc.search('supabase')).map((r) => r.file);
    // Matches in proposal, decision, and the index (case-insensitive).
    expect(files).toContain('sdd/proposal.md');
    expect(files).toContain('sdd/decisions/001-stack.md');
    expect(files).toContain('sdd/index.md');
  });

  it('scopes the search to a concept type', async () => {
    const svc = KnowledgeService.createStandalone();
    await svc.initialize(tmpBundle());

    const results = await svc.search('supabase', 'Decision');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.file === 'sdd/decisions/001-stack.md')).toBe(true);
  });

  it('returns nothing for an empty query', async () => {
    const svc = KnowledgeService.createStandalone();
    await svc.initialize(tmpBundle());

    expect(await svc.search('   ')).toHaveLength(0);
  });
});
