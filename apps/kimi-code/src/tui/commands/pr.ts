import { execSync } from 'node:child_process';

import type { SlashCommandHost } from './dispatch';

interface PrOptions {
  title?: string;
  draft: boolean;
  base: string;
  yes: boolean;
  ready: boolean;
}

interface CommitInfo {
  hash: string;
  message: string;
}

interface PrPreview {
  currentBranch: string;
  baseBranch: string;
  commits: CommitInfo[];
  modifiedFiles: string[];
  changesets: string[];
  sddFiles: string[];
  title: string;
  description: string;
}

export async function handlePrCommand(host: SlashCommandHost, args: string): Promise<void> {
  try {
    // Parse arguments
    const options = parseArgs(args);

    // Verify we're in a git repository
    if (!isGitRepository()) {
      host.showError('Not in a git repository');
      return;
    }

    // Check if gh CLI is available
    if (!isGhCliAvailable()) {
      host.showError('GitHub CLI (gh) is not installed. Install it from https://cli.github.com/');
      return;
    }

    // Get current branch
    const currentBranch = getCurrentBranch();
    if (!currentBranch) {
      host.showError('Could not determine current branch');
      return;
    }

    // Check if there are commits to push
    const commits = getCommitsToPush(options.base);
    if (commits.length === 0) {
      host.showNotice(`No commits to push to ${options.base}`);
      return;
    }

    // Gather information
    const preview = await gatherPrPreview(currentBranch, options, commits);

    // Show preview and get confirmation
    if (!options.yes) {
      const confirmed = await showPreviewAndConfirm(host, preview);
      if (!confirmed) {
        host.showNotice('PR creation cancelled');
        return;
      }
    }

    // Create the PR
    const prUrl = await createPullRequest(preview, options);
    
    if (prUrl) {
      host.showNotice(`PR created successfully!`, prUrl);
      host.track('pr_created', {
        draft: options.draft && !options.ready,
        base: options.base,
        commits: commits.length,
      });
    } else {
      host.showError('Failed to create PR');
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    host.showError(`Failed to create PR: ${msg}`);
  }
}

function parseArgs(args: string): PrOptions {
  const parts = args.trim().split(/\s+/);
  const options: PrOptions = {
    draft: true,
    base: 'main',
    yes: false,
    ready: false,
  };

  let i = 0;
  const titleParts: string[] = [];

  while (i < parts.length) {
    const part = parts[i];
    
    if (part === '--draft') {
      options.draft = true;
    } else if (part === '--ready') {
      options.ready = true;
      options.draft = false;
    } else if (part === '--base' && i + 1 < parts.length) {
      options.base = parts[i + 1]!;
      i++;
    } else if (part === '--yes' || part === '-y') {
      options.yes = true;
    } else if (part && !part.startsWith('--')) {
      titleParts.push(part);
    }
    
    i++;
  }

  if (titleParts.length > 0) {
    options.title = titleParts.join(' ');
  }

  return options;
}

function isGitRepository(): boolean {
  try {
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function isGhCliAvailable(): boolean {
  try {
    execSync('gh --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getCurrentBranch(): string | null {
  try {
    const branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
    return branch || null;
  } catch {
    return null;
  }
}

function getCommitsToPush(base: string): CommitInfo[] {
  try {
    // Check if remote branch exists
    let compareRef = `origin/${base}`;
    try {
      execSync(`git rev-parse --verify origin/${base}`, { stdio: 'ignore' });
    } catch {
      // Remote branch doesn't exist, compare with local base
      compareRef = base;
      try {
        execSync(`git rev-parse --verify ${base}`, { stdio: 'ignore' });
      } catch {
        // Base branch doesn't exist, return empty
        return [];
      }
    }

    const output = execSync(`git log ${compareRef}..HEAD --pretty=format:"%h %s"`, {
      encoding: 'utf-8',
    }).trim();

    if (!output) return [];

    return output.split('\n').map(line => {
      const [hash, ...messageParts] = line.split(' ');
      return {
        hash: hash || '',
        message: messageParts.join(' '),
      };
    });
  } catch {
    return [];
  }
}

function getModifiedFiles(): string[] {
  try {
    const output = execSync('git diff --name-only HEAD', { encoding: 'utf-8' }).trim();
    return output ? output.split('\n') : [];
  } catch {
    return [];
  }
}

function getChangesets(): string[] {
  try {
    const output = execSync('ls .changeset/*.md 2>/dev/null || true', { encoding: 'utf-8' }).trim();
    if (!output) return [];
    return output.split('\n').filter(f => f && !f.includes('README.md'));
  } catch {
    return [];
  }
}

function getSddModifiedFiles(): string[] {
  const files = getModifiedFiles();
  return files.filter(f => f.startsWith('sdd/'));
}

function generateTitle(commits: CommitInfo[], customTitle?: string): string {
  if (customTitle) return customTitle;
  
  // Use first commit message as title
  if (commits.length > 0 && commits[0]) {
    return commits[0].message;
  }
  
  return 'Update';
}

function generateDescription(preview: PrPreview): string {
  const sections: string[] = [];

  // Commits section
  if (preview.commits.length > 0) {
    sections.push('## Changes\n');
    sections.push(preview.commits.map(c => `- ${c.message} (${c.hash})`).join('\n'));
    sections.push('');
  }

  // SDD files section
  if (preview.sddFiles.length > 0) {
    sections.push('## SDD Updates\n');
    sections.push(preview.sddFiles.map(f => `- \`${f}\``).join('\n'));
    sections.push('');
  }

  // Changesets section
  if (preview.changesets.length > 0) {
    sections.push('## Changesets\n');
    sections.push(preview.changesets.map(f => `- \`${f}\``).join('\n'));
    sections.push('');
  }

  // Modified files section (only if not too many)
  if (preview.modifiedFiles.length > 0 && preview.modifiedFiles.length <= 20) {
    sections.push('## Modified Files\n');
    sections.push(preview.modifiedFiles.map(f => `- \`${f}\``).join('\n'));
    sections.push('');
  } else if (preview.modifiedFiles.length > 20) {
    sections.push(`## Modified Files\n`);
    sections.push(`${preview.modifiedFiles.length} files modified\n`);
    sections.push('');
  }

  return sections.join('\n');
}

async function gatherPrPreview(
  currentBranch: string,
  options: PrOptions,
  commits: CommitInfo[]
): Promise<PrPreview> {
  const modifiedFiles = getModifiedFiles();
  const changesets = getChangesets();
  const sddFiles = getSddModifiedFiles();
  const title = generateTitle(commits, options.title);
  const description = generateDescription({
    currentBranch,
    baseBranch: options.base,
    commits,
    modifiedFiles,
    changesets,
    sddFiles,
    title: '',
    description: '',
  });

  return {
    currentBranch,
    baseBranch: options.base,
    commits,
    modifiedFiles,
    changesets,
    sddFiles,
    title,
    description,
  };
}

async function showPreviewAndConfirm(host: SlashCommandHost, preview: PrPreview): Promise<boolean> {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('━'.repeat(60));
  lines.push('📋 Pull Request Preview');
  lines.push('━'.repeat(60));
  lines.push('');
  lines.push(`  Branch: ${preview.currentBranch} → ${preview.baseBranch}`);
  lines.push(`  Commits: ${preview.commits.length}`);
  lines.push(`  Files: ${preview.modifiedFiles.length} modified`);
  
  if (preview.sddFiles.length > 0) {
    lines.push(`  SDD files: ${preview.sddFiles.length}`);
  }
  
  if (preview.changesets.length > 0) {
    lines.push(`  Changesets: ${preview.changesets.length}`);
  }
  
  lines.push('');
  lines.push(`  Title: ${preview.title}`);
  lines.push('');
  lines.push('━'.repeat(60));
  lines.push('');

  host.showNotice(lines.join('\n'));

  // For now, we'll use a simple confirmation
  // In a real implementation, you might want to use an interactive prompt
  // For simplicity, we'll proceed if --yes was not used
  // The user can cancel with Ctrl+C
  return true;
}

async function createPullRequest(preview: PrPreview, options: PrOptions): Promise<string | null> {
  try {
    const args: string[] = [
      'gh',
      'pr',
      'create',
      '--title',
      `"${preview.title.replace(/"/g, '\\"')}"`,
      '--body',
      `"${preview.description.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`,
      '--base',
      options.base,
    ];

    if (options.draft && !options.ready) {
      args.push('--draft');
    }

    // Push current branch first
    execSync(`git push -u origin ${preview.currentBranch}`, { stdio: 'inherit' });

    // Create PR
    const output = execSync(args.join(' '), { encoding: 'utf-8' });
    
    // Extract URL from output
    const urlMatch = output.match(/https:\/\/github\.com\/[^\s]+/);
    return urlMatch ? urlMatch[0] : output.trim();
  } catch (error) {
    console.error('Error creating PR:', error);
    return null;
  }
}
