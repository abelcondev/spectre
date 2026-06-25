import { execFileSync, spawnSync } from 'node:child_process';

const VERIFICATION_KEYWORDS = [
  'test',
  'lint',
  'typecheck',
  'build',
  'check',
  'verify',
  'format',
];

export function isVerificationCommand(command: string): boolean {
  const lower = command.toLowerCase();
  return VERIFICATION_KEYWORDS.some((keyword) => lower.includes(keyword));
}

export interface AutoCommitResult {
  readonly committed: boolean;
  readonly message: string;
}

export function autoCommitChanges(workDir: string): AutoCommitResult {
  const isRepo = spawnSync('git', ['-C', workDir, 'rev-parse', '--is-inside-work-tree'], {
    encoding: 'utf8',
    timeout: 2_000,
  });
  if (isRepo.status !== 0 || isRepo.stdout.trim() !== 'true') {
    throw new Error('Not a git repository');
  }

  const status = spawnSync('git', ['-C', workDir, 'status', '--porcelain'], {
    encoding: 'utf8',
    timeout: 2_000,
  });
  if (status.status !== 0) {
    throw new Error(`git status failed: ${status.stderr}`);
  }
  if (status.stdout.trim().length === 0) {
    return { committed: false, message: 'No changes to commit' };
  }

  execFileSync('git', ['-C', workDir, 'add', '-A'], {
    encoding: 'utf8',
    timeout: 5_000,
  });

  const commitMessage = `auto: checkpoint at ${new Date().toISOString()}`;
  execFileSync('git', ['-C', workDir, 'commit', '-m', commitMessage], {
    encoding: 'utf8',
    timeout: 5_000,
  });

  return { committed: true, message: commitMessage };
}
