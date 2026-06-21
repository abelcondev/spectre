import type { Kaos, KaosProcess } from '@moonshot-ai/kaos';
import { dirname, join } from 'pathe';

const DEFAULT_TIMEOUT_MS = 30_000;

export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export async function runCommand(
  kaos: Kaos,
  cwd: string,
  args: readonly string[],
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<CommandResult> {
  let proc: KaosProcess | undefined;
  try {
    proc = await kaos.execWithEnv([...args], {
      ...process.env,
      NO_COLOR: '1',
      TERM: 'dumb',
      GIT_TERMINAL_PROMPT: process.env['GIT_TERMINAL_PROMPT'] ?? '0',
      SHELL: kaos.osEnv.shellPath,
    });
  } catch (error) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
    };
  }

  try {
    proc.stdin.end();
  } catch {
    /* ignore */
  }

  const work = Promise.all([collectStream(proc.stdout), collectStream(proc.stderr), proc.wait()]);
  work.catch(() => {});

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Command timed out: ${args.join(' ')}`));
      }, timeoutMs);
    });
    const [stdout, stderr, exitCode] = await Promise.race([work, timeout]);
    return { stdout, stderr, exitCode };
  } catch (error) {
    try {
      await proc.kill('SIGKILL');
    } catch {
      /* ignore */
    }
    return {
      exitCode: 1,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function runGit(
  kaos: Kaos,
  cwd: string,
  args: readonly string[],
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<CommandResult> {
  return runCommand(kaos, cwd, ['git', '-C', cwd, ...args], timeoutMs);
}

function collectStream(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stream.on('error', reject);
  });
}

export async function isGitRepo(kaos: Kaos, cwd: string): Promise<boolean> {
  const result = await runGit(kaos, cwd, ['rev-parse', '--git-dir']);
  return result.exitCode === 0;
}

export async function findProjectRoot(kaos: Kaos, cwd: string): Promise<string | null> {
  const result = await runGit(kaos, cwd, ['rev-parse', '--show-toplevel']);
  if (result.exitCode !== 0) return null;
  return result.stdout.trim();
}

export async function hasMainOrMasterBranch(kaos: Kaos, cwd: string): Promise<boolean> {
  for (const branch of ['main', 'master']) {
    const result = await runGit(kaos, cwd, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]);
    if (result.exitCode === 0) return true;
  }
  return false;
}

export async function initGitRepo(kaos: Kaos, cwd: string): Promise<CommandResult> {
  return runGit(kaos, cwd, ['init']);
}

export async function ensureMainBranch(kaos: Kaos, cwd: string): Promise<CommandResult> {
  // Ensure a base branch exists. git checkout -B main creates it if missing.
  return runGit(kaos, cwd, ['checkout', '-B', 'main']);
}

export async function commitSddFramework(kaos: Kaos, cwd: string): Promise<CommandResult> {
  // Commit only the framework files so the install is isolated from other
  // uncommitted changes the user may have in the working directory.
  const add = await runGit(kaos, cwd, ['add', 'AGENTS.md', 'init.sh', 'sdd/']);
  if (add.exitCode !== 0) return add;
  return runGit(kaos, cwd, ['commit', '-m', 'chore(sdd): install framework']);
}

export function validateFeatureSlug(slug: string): void {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(
      `Invalid slug "${slug}". Use kebab-case lowercase (e.g. login-y-dashboard-layout).`,
    );
  }
}

export function worktreePathFor(repoRoot: string, repoName: string, slug: string): string {
  const parent = dirname(repoRoot);
  return join(parent, `${repoName}-${slug}`);
}

export interface SddState {
  readonly issueType: 'product' | 'design' | 'dev' | null;
  readonly valid: boolean;
}

export function issueTypeFor(state: string): SddState['issueType'] {
  if (
    state === 'discovery' ||
    state === 'product-ready'
  ) {
    return 'product';
  }
  if (state === 'spec-needed' || state === 'designing' || state === 'design-ready') {
    return 'design';
  }
  if (
    [
      'backlog',
      'spec-needed',
      'spec-ready',
      'implementing',
      'blocked',
      'review',
      'rejected',
      'testing',
      'done',
      'cancelled',
    ].includes(state)
  ) {
    return 'dev';
  }
  return null;
}

export async function pathExists(kaos: Kaos, path: string): Promise<boolean> {
  try {
    await kaos.stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function ensureParentDir(kaos: Kaos, path: string): Promise<void> {
  await kaos.mkdir(dirname(path), { parents: true, existOk: true });
}
