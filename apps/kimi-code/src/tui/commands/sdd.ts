import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { SlashCommandHost } from './dispatch';

const SDD_DIR = 'sdd';

interface Template {
  readonly path: string;
  readonly content: string;
}

// Core files that define the OKF bundle. `/sdd-status` checks these exist.
const CORE_TEMPLATES: Template[] = [
  {
    // OKF bundle index — no frontmatter. Spectre reads this first at session
    // start: project overview plus links to the typed concepts in the bundle.
    path: 'index.md',
    content: `# Project knowledge

<!-- OKF bundle index. Spectre reads this first at session start.
     Keep it concise: overview + links to concepts. Do NOT duplicate details
     that live in the linked files (proposal.md, decisions/, tasks/). -->

## Overview

- **Name**: (project name)
- **Vision**: (one or two sentences)
- **Current focus**: (what we are working on right now)

## Stack (summary)

- **Language**: (e.g. TypeScript)
- **Framework**: (e.g. Expo + React Native)
- **Backend**: (e.g. Supabase)
- **Package manager**: (e.g. pnpm)
- Full rationale in [decisions/](decisions/).

## Concepts

### Active proposal

- [proposal.md](proposal.md) — current proposal under review.

### Decisions

<!-- Link approved decisions here as they are archived. -->

### Tasks

<!-- Link active tasks here. -->

## Changelog

- See [log.md](log.md).
`,
  },
  {
    // OKF log convention — no frontmatter. Append-only history.
    path: 'log.md',
    content: `# Log

<!-- Append-only history of significant changes to this knowledge bundle:
     proposals approved, decisions archived, tasks created or completed.
     Newest first. One line each: \`YYYY-MM-DD — what changed\`. -->
`,
  },
  {
    // Typed OKF concept — transient living document.
    path: 'proposal.md',
    content: `---
type: Proposal
title: (short title)
description: (2-3 sentence summary of what this proposal is about)
status: draft
timestamp: (ISO 8601, e.g. 2026-06-30T16:00:00Z)
---

# Proposal

<!-- Living, transient document. Status: draft | in review | approved | archived.
     Once approved, key decisions are archived to decisions/ and this file is
     cleared for the next proposal. -->

## Summary

<!-- 2-3 sentences describing what this proposal is about. -->

## Proposal content

<!-- Fill the relevant details for the current phase:
     - Stack choices with versions and justification
     - Package manager selection
     - Dependency compatibility (verified, not assumed)
     - Proposed file/folder structure
     - Testing and verification strategy
     - Implementation steps -->

## Options considered

<!-- Alternatives discussed and why they were not chosen. -->

## Next steps

<!-- Concrete actions to take once approved. -->
`,
  },
];

// Starter templates — created on setup as examples, meant to be copied and then
// deleted. NOT checked by `/sdd-status` (deleting them is expected).
const STARTER_TEMPLATES: Template[] = [
  {
    path: 'decisions/_template.md',
    content: `---
type: Decision
title: (decision title)
description: (one-sentence summary of what was decided)
resource: file://sdd/decisions/NNN-name.md
tags: []
status: approved
timestamp: (ISO 8601)
supersedes: []
---

# Decision

<!-- One file per decision, numbered sequentially (001-, 002-, …).
     Delete this template after creating your first decision.
     What was decided. -->

# Context

<!-- The situation and constraints that led to this decision. -->

# Citations

<!-- Links to the proposal or sources behind it, e.g. [proposal](../proposal.md). -->
`,
  },
  {
    path: 'tasks/_template.md',
    content: `---
type: Task
title: (feature name)
description: (2-3 sentences describing the feature)
tags: []
status: pending
timestamp: (ISO 8601)
---

# Acceptance criteria

<!-- One file per feature task. Status: pending | in-progress | done.
     Delete this template after creating your first task. -->

- Given (precondition), When (action), Then (expected result)
- Given ..., When ..., Then ...

# Dependencies

<!-- Links to decisions/tasks this depends on,
     e.g. [Initial stack](../decisions/001-stack.md). -->
`,
  },
];

const REQUIRED_DIRS = ['tasks', 'decisions'];

export async function handleSddSetupCommand(host: SlashCommandHost): Promise<void> {
  const workDir = host.state.appState.workDir;
  const sddRoot = join(workDir, SDD_DIR);

  try {
    await mkdir(sddRoot, { recursive: true });
    for (const dir of REQUIRED_DIRS) {
      await mkdir(join(sddRoot, dir), { recursive: true });
    }

    const created: string[] = [];
    for (const template of [...CORE_TEMPLATES, ...STARTER_TEMPLATES]) {
      const filePath = join(sddRoot, template.path);
      if (!existsSync(filePath)) {
        await writeFile(filePath, template.content, 'utf-8');
        created.push(`sdd/${template.path}`);
      }
    }

    if (created.length === 0) {
      host.showStatus('OKF bundle already exists in sdd/.', 'success');
    } else {
      host.showStatus(`OKF bundle created: ${created.join(', ')}`, 'success');
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    host.showError(`Failed to set up sdd/ OKF bundle: ${msg}`);
  }
}

export async function handleSddStatusCommand(host: SlashCommandHost): Promise<void> {
  const workDir = host.state.appState.workDir;
  const sddRoot = join(workDir, SDD_DIR);

  // Only the core bundle files are required; starter templates are disposable.
  const missingCore = CORE_TEMPLATES.map((t) => t.path).filter(
    (p) => !existsSync(join(sddRoot, p)),
  );
  const missingDirs = REQUIRED_DIRS.filter((d) => !existsSync(join(sddRoot, d)));
  const missingRootAgMd = !existsSync(join(workDir, 'AGENTS.md'));

  const missing: string[] = [
    ...missingCore.map((p) => `sdd/${p}`),
    ...missingDirs.map((d) => `sdd/${d}/`),
    ...(missingRootAgMd ? ['AGENTS.md (root)'] : []),
  ];

  if (missing.length === 0) {
    host.showStatus('sdd/ OKF bundle is ready.', 'success');
  } else {
    host.showStatus(`sdd/ OKF bundle missing: ${missing.join(', ')}`, 'warning');
  }
}
