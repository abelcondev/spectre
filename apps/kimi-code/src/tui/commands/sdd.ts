import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { SlashCommandHost } from './dispatch';

const SDD_DIR = 'sdd';

const TEMPLATES: { path: string; content: string }[] = [
  {
    path: 'memory.md',
    content: `# Project memory

<!-- Update this file as the project evolves. Spectre reads it for context. -->

## Overview

- **Name**: (project name)
- **Vision**: (one or two sentences)
- **Current focus**: (what we are working on right now)

## Current stack (summary)

<!-- Quick reference to the active stack. Full details live in decisions/. -->

- **Language**: (e.g. TypeScript)
- **Framework**: (e.g. Expo + React Native)
- **Backend**: (e.g. Supabase)
- **Package manager**: (e.g. pnpm)
- **Key decisions**: see [decisions/](decisions/)

## Active proposal

- See [proposal.md](proposal.md).

## Active tasks

- See [tasks/](tasks/).
`,
  },
  {
    path: 'proposal.md',
    content: `# Proposal

<!-- Spectre writes proposals here. The human reviews and approves before action is taken.
     This is a living document — it changes with each phase or task.
     Once approved, the key decisions are archived in decisions/ and this file is cleared
     for the next proposal. -->

## Status: draft

<!-- Status can be: draft | in review | approved | archived -->

## Summary

<!-- 2-3 sentences describing what this proposal is about. -->

## Proposal content

<!-- Spectre fills this section with the relevant details for the current phase:
     - Stack choices with versions and justification
     - Package manager selection
     - Dependency compatibility (verified, not assumed)
     - Proposed file/folder structure
     - Testing and verification strategy
     - Implementation steps -->

## Options considered

<!-- If applicable, list alternatives that were discussed and why they were not chosen. -->

## Next steps

<!-- Concrete actions to take once approved. -->
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
    for (const template of TEMPLATES) {
      const filePath = join(sddRoot, template.path);
      if (!existsSync(filePath)) {
        await writeFile(filePath, template.content, 'utf-8');
        created.push(`sdd/${template.path}`);
      }
    }

    if (created.length === 0) {
      host.showStatus('Mini-SDD already exists in sdd/.', 'success');
    } else {
      host.showStatus(`Mini-SDD created: ${created.join(', ')}`, 'success');
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    host.showError(`Failed to set up mini-SDD: ${msg}`);
  }
}

export async function handleSddStatusCommand(host: SlashCommandHost): Promise<void> {
  const workDir = host.state.appState.workDir;
  const sddRoot = join(workDir, SDD_DIR);

  const missingSddFiles = TEMPLATES.map((t) => t.path).filter((p) => !existsSync(join(sddRoot, p)));
  const missingDirs = REQUIRED_DIRS.filter((d) => !existsSync(join(sddRoot, d)));
  const missingRootAgMd = !existsSync(join(workDir, 'AGENTS.md'));

  const missing: string[] = [
    ...missingSddFiles.map((p) => `sdd/${p}`),
    ...missingDirs.map((d) => `sdd/${d}/`),
    ...(missingRootAgMd ? ['AGENTS.md (root)'] : []),
  ];

  if (missing.length === 0) {
    host.showStatus('Mini-SDD is ready.', 'success');
  } else {
    host.showStatus(`Mini-SDD missing: ${missing.join(', ')}`, 'warning');
  }
}
