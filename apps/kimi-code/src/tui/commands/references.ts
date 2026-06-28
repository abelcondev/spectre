import type { Session } from '@moonshot-ai/kimi-code-sdk';

import { ChoicePickerComponent } from '../components/dialogs/choice-picker';
import { UsagePanelComponent } from '../components/messages/usage-panel';
import { currentTheme } from '../theme';
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
      await handleRefresh(host, session, pkg);
      return;
    }
    if (sub === 'clear') {
      await session.clearReferences(pkg);
      host.showStatus(
        pkg ? `Cleared cached reference for ${pkg}.` : 'Cleared all cached references.',
      );
      return;
    }
    await showReferencePanel(host, session);
  } catch (error) {
    host.showError(`References command failed: ${formatErrorMessage(error)}`);
  }
}

async function handleRefresh(
  host: SlashCommandHost,
  session: Session,
  pkg: string | undefined,
): Promise<void> {
  if (pkg) {
    const spinner = host.showProgressSpinner(`Refreshing ${pkg}…`);
    try {
      await session.refreshReferences(pkg);
      spinner.stop({ ok: true, label: `Refreshed ${pkg}` });
    } catch (error) {
      spinner.stop({ ok: false, label: `Failed: ${formatErrorMessage(error)}` });
      return;
    }
    await showReferencePanel(host, session);
    return;
  }

  const refs = await session.listReferences();
  if (refs.length === 0) {
    host.showStatus('No referenceable dependencies detected in this workspace.');
    return;
  }

  const pending = refs.filter((r) => r.status === 'pending');
  const indexed = refs.filter((r) => r.status === 'indexed');

  // Preview panel showing what will be downloaded
  const previewPanel = new UsagePanelComponent(
    () => buildRefreshPreviewLines(refs),
    'primary',
    ' Reference Index ',
  );
  host.state.transcriptContainer.addChild(previewPanel);
  host.state.ui.requestRender();

  const actionLabel =
    pending.length > 0
      ? `Download ${pending.length} package${pending.length === 1 ? '' : 's'}`
      : `Re-index all ${refs.length} packages`;

  const confirmed = await new Promise<boolean>((resolve) => {
    const picker = new ChoicePickerComponent({
      title: pending.length > 0 ? 'Index dependency references?' : 'Re-index all references?',
      hint: 'Enter confirm · Esc cancel',
      notice:
        pending.length > 0
          ? `${indexed.length} already indexed · ${pending.length} pending`
          : `All ${refs.length} packages already indexed`,
      options: [
        {
          value: 'yes',
          label: actionLabel,
          description:
            pending.length > 0
              ? 'Source code fetched via npm pack or git clone into ~/.spectre/references'
              : 'All cached files will be deleted and re-downloaded',
        },
        { value: 'no', label: 'Cancel', tone: 'danger' as const },
      ],
      currentValue: 'yes',
      onSelect: (value) => {
        host.restoreEditor();
        resolve(value === 'yes');
      },
      onCancel: () => {
        host.restoreEditor();
        resolve(false);
      },
    });
    host.mountEditorReplacement(picker);
  });

  if (!confirmed) {
    host.showStatus('Cancelled.');
    return;
  }

  const spinner = host.showProgressSpinner('Indexing dependency references…');
  try {
    await session.refreshReferences();
    spinner.stop({ ok: true, label: 'References indexed' });
  } catch (error) {
    spinner.stop({ ok: false, label: `Failed: ${formatErrorMessage(error)}` });
    return;
  }
  await showReferencePanel(host, session);
}

async function showReferencePanel(host: SlashCommandHost, session: Session): Promise<void> {
  const refs = await session.listReferences();
  if (refs.length === 0) {
    host.showStatus('No referenceable dependencies detected in this workspace.');
    return;
  }

  const panel = new UsagePanelComponent(
    () => buildReferenceLines(refs),
    'primary',
    ' References ',
  );
  host.state.transcriptContainer.addChild(panel);
  host.state.ui.requestRender();
}

function buildReferenceLines(refs: readonly ReferenceInfo[]): string[] {
  const text = (s: string) => currentTheme.fg('text', s);
  const muted = (s: string) => currentTheme.fg('textDim', s);
  const dim = (s: string) => currentTheme.fg('textMuted', s);
  const success = (s: string) => currentTheme.fg('success', s);
  const warn = (s: string) => currentTheme.fg('warning', s);
  const err = (s: string) => currentTheme.fg('error', s);

  const indexed = refs.filter((r) => r.status === 'indexed');
  const pending = refs.filter((r) => r.status === 'pending');
  const errored = refs.filter((r) => r.status === 'error');

  const nameWidth = Math.max(...refs.map((r) => `${r.package}@${r.version}`.length));

  const lines: string[] = [];

  const addGroup = (group: ReferenceInfo[], icon: string, colorize: (s: string) => string) => {
    for (const ref of group) {
      const name = `${ref.package}@${ref.version}`.padEnd(nameWidth);
      const files =
        ref.fileCount !== undefined ? `${ref.fileCount.toLocaleString()} files` : '';
      const size = ref.size !== undefined ? formatBytes(ref.size) : '';
      const src = ref.source ?? '';
      lines.push(
        `  ${colorize(icon)}  ${text(name)}  ${muted(files.padStart(10))}  ${muted(size.padStart(8))}  ${dim(src)}`,
      );
    }
  };

  if (indexed.length > 0) {
    addGroup(indexed, '✓', success);
  }

  if (pending.length > 0) {
    if (lines.length > 0) lines.push('');
    for (const ref of pending) {
      const name = `${ref.package}@${ref.version}`.padEnd(nameWidth);
      lines.push(`  ${warn('○')}  ${muted(name)}  ${muted('not indexed')}`);
    }
  }

  if (errored.length > 0) {
    if (lines.length > 0) lines.push('');
    for (const ref of errored) {
      const name = `${ref.package}@${ref.version}`.padEnd(nameWidth);
      lines.push(`  ${err('✗')}  ${err(name)}  ${muted('error')}`);
    }
  }

  lines.push('');
  const totalSize = indexed.reduce((sum, r) => sum + (r.size ?? 0), 0);
  const summary = [
    muted(`${indexed.length}/${refs.length} indexed`),
    muted('·'),
    muted(`${formatBytes(totalSize)} cached`),
  ].join('  ');
  lines.push(`  ${summary}`);

  if (pending.length > 0) {
    lines.push(
      `  ${muted(`Run /references refresh to download ${pending.length} pending package${pending.length === 1 ? '' : 's'}`)}`,
    );
  }

  return lines;
}

function buildRefreshPreviewLines(refs: readonly ReferenceInfo[]): string[] {
  const text = (s: string) => currentTheme.fg('text', s);
  const muted = (s: string) => currentTheme.fg('textDim', s);
  const success = (s: string) => currentTheme.fg('success', s);
  const warn = (s: string) => currentTheme.fg('warning', s);

  const indexed = refs.filter((r) => r.status === 'indexed');
  const pending = refs.filter((r) => r.status === 'pending');

  const lines: string[] = [];

  lines.push(
    muted(
      `  ${refs.length} package${refs.length === 1 ? '' : 's'} found in package.json`,
    ),
  );

  if (pending.length > 0) {
    lines.push('');
    lines.push(warn(`  ${pending.length} to download`));
    for (const ref of pending) {
      lines.push(`    ${muted('·')} ${text(`${ref.package}@${ref.version}`)}`);
    }
  }

  if (indexed.length > 0) {
    lines.push('');
    lines.push(success(`  ${indexed.length} already indexed`));
  }

  return lines;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
