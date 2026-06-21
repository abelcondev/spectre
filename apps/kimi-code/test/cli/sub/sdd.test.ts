import { execFile } from 'node:child_process';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { SDD_ASSETS } from '@moonshot-ai/kimi-code-sdk';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { handleSddInit, handleSddStatus, type SddDeps } from '#/cli/sub/sdd';

const execFileAsync = promisify(execFile);

class ExitCalled extends Error {
  constructor(readonly code: number) {
    super(`exit(${code})`);
  }
}

interface TestDeps extends SddDeps {
  readonly capturedStdout: () => string;
  readonly capturedStderr: () => string;
}

function createTestDeps(cwd: string): TestDeps {
  let stdout = '';
  let stderr = '';
  return {
    cwd: () => cwd,
    stdout: {
      write(chunk: string): boolean {
        stdout += chunk;
        return true;
      },
    },
    stderr: {
      write(chunk: string): boolean {
        stderr += chunk;
        return true;
      },
    },
    exit: (code: number) => {
      throw new ExitCalled(code);
    },
    capturedStdout: () => stdout,
    capturedStderr: () => stderr,
  };
}

async function initGitRepo(dir: string): Promise<void> {
  await execFileAsync('git', ['init'], { cwd: dir });
  await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: dir });
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

describe('spectre sdd init asset bundle', () => {
  it('does not bundle legacy sdd-worktree.sh or sdd-move.sh scripts', () => {
    const paths = SDD_ASSETS.map((asset) => asset.path);

    expect(paths).not.toContain('scripts/sdd-worktree.sh');
    expect(paths).not.toContain('scripts/sdd-move.sh');
  });
});

describe('spectre sdd init', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'spectre-sdd-test-'));
    await initGitRepo(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('installs the SDD harness and does not create legacy scripts', async () => {
    const deps = createTestDeps(tempDir);

    const code = await handleSddInit(deps, { force: false });

    expect(code).toBe(0);
    expect(deps.capturedStdout()).toContain('SDD framework installed');
    expect(await pathExists(join(tempDir, 'sdd', 'README.md'))).toBe(true);
    expect(await pathExists(join(tempDir, 'init.sh'))).toBe(true);
    expect(await pathExists(join(tempDir, 'scripts', 'sdd-worktree.sh'))).toBe(false);
    expect(await pathExists(join(tempDir, 'scripts', 'sdd-move.sh'))).toBe(false);
  });

  it('dry-run reports assets without writing files', async () => {
    const deps = createTestDeps(tempDir);

    const code = await handleSddInit(deps, { force: false, dryRun: true });

    expect(code).toBe(0);
    expect(deps.capturedStdout()).toContain('would be installed');
    expect(await pathExists(join(tempDir, 'sdd'))).toBe(false);
    expect(await pathExists(join(tempDir, 'init.sh'))).toBe(false);
  });
});

describe('spectre sdd status', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'spectre-sdd-status-test-'));
    await initGitRepo(tempDir);
    const deps = createTestDeps(tempDir);
    const code = await handleSddInit(deps, { force: false });
    if (code !== 0) {
      throw new Error(`handleSddInit failed with exit code ${code}: ${deps.capturedStderr()}`);
    }
    // AGENTS.md is project-specific and not installed by the generic harness.
    await writeFile(join(tempDir, 'AGENTS.md'), '# AGENTS.md\n\nProject-specific agent guide.\n');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('passes on a freshly initialized harness', async () => {
    const deps = createTestDeps(tempDir);

    const code = await handleSddStatus(deps);

    expect(code).toBe(0);
    expect(deps.capturedStdout()).toContain('[OK] SDD harness ready');
  });
});
