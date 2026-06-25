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

## Key decisions

- See [decisions/](decisions/).

## Active tasks

- See [tasks/](tasks/).
`,
  },
  {
    path: 'stack.md',
    content: `# Tech stack

<!-- Document chosen technologies, versions, compatibility notes, and rules. -->

## Core stack

- **Language**: (e.g. TypeScript)
- **Framework**: (e.g. SvelteKit)
- **Database**: (e.g. PostgreSQL)
- **Package manager**: (e.g. pnpm)
- **Deployment**: (e.g. Docker)

## Versions and compatibility

<!-- Add version constraints and compatibility notes discovered during research. -->

## Testing rules

<!-- What tests are required and how they are run. -->

## Security rules

<!-- Security conventions specific to this project. -->

## Architecture notes

<!-- High-level architecture decisions and diagrams. -->
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
