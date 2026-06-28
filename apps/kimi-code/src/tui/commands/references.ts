import type { Session } from '@moonshot-ai/kimi-code-sdk';

import { formatErrorMessage } from '../utils/event-payload';
import type { SlashCommandHost } from './dispatch';

type ReferenceInfo = Awaited<ReturnType<Session['listReferences']>>[number];

/**
 * `/references` — show and manage cached dependency references.
 *
 *   /references              list active dependencies and their cache status
 *   /references refresh [pkg] re-index all references, or just one package
 *   /references clear   [pkg] remove cached references, or just one package
 */
export async function handleReferencesCommand(
  host: SlashCommandHost,
  args = '',
): Promise<void> {
  const session = host.requireSession();
  const tokens = args.trim().split(/\s+/).filter(Boolean);
  const sub = tokens[0];
  const pkg = tokens.slice(1).join(' ').trim() || undefined;

  try {
    if (sub === 'refresh') {
      host.showStatus(pkg ? `Refreshing reference for ${pkg}…` : 'Refreshing all references…');
      await session.refreshReferences(pkg);
      await showReferenceList(host, session);
      return;
    }
    if (sub === 'clear') {
      await session.clearReferences(pkg);
      host.showStatus(
        pkg ? `Cleared cached reference for ${pkg}.` : 'Cleared all cached references.',
      );
      return;
    }
    await showReferenceList(host, session);
  } catch (error) {
    host.showError(`References command failed: ${formatErrorMessage(error)}`);
  }
}

async function showReferenceList(host: SlashCommandHost, session: Session): Promise<void> {
  const refs = await session.listReferences();
  if (refs.length === 0) {
    host.showStatus('No referenceable dependencies detected in this workspace.');
    return;
  }

  const indexed = refs.filter((r) => r.status === 'indexed').length;
  host.showStatus(`Dependency references (${indexed}/${refs.length} indexed):`);
  for (const ref of refs) {
    host.showStatus(formatReferenceLine(ref));
  }
  host.showStatus(
    'Use `/references refresh [pkg]` to re-index or `/references clear [pkg]` to remove.',
  );
}

function formatReferenceLine(ref: ReferenceInfo): string {
  const name = `${ref.package}@${ref.version}`;
  switch (ref.status) {
    case 'indexed':
      return `  [indexed] ${name} — ${ref.fileCount ?? 0} files, ${formatBytes(ref.size ?? 0)}${ref.source ? `, ${ref.source}` : ''}`;
    case 'error':
      return `  [error]   ${name} — failed to index`;
    case 'pending':
      return `  [pending] ${name}`;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
