import { ChoicePickerComponent } from '../components/dialogs/choice-picker';
import { formatErrorMessage } from '../utils/event-payload';
import type { SlashCommandHost } from './dispatch';
import { promptApiKey } from './prompts';

/**
 * `/context7` — configure the Context7 API key for library documentation lookups.
 *
 * Flow:
 *   1. Read current config to check if a key is already set.
 *   2. If set → offer to change or remove via a choice picker.
 *   3. If not set → directly prompt for the API key.
 *   4. Persist via `setConfig`.
 */
export async function handleContext7Command(host: SlashCommandHost): Promise<void> {
  const config = await host.harness.getConfig();
  const currentKey = config.services?.context7?.apiKey;
  const hasKey = currentKey !== undefined && currentKey.length > 0 && currentKey !== 'YOUR_CONTEXT7_API_KEY';

  if (hasKey) {
    await handleExistingKey(host);
  } else {
    await promptAndSaveKey(host);
  }
}

async function handleExistingKey(host: SlashCommandHost): Promise<void> {
  const choice = await new Promise<string | undefined>((resolve) => {
    const picker = new ChoicePickerComponent({
      title: 'Context7 API key',
      hint: 'A key is already configured. What would you like to do?',
      options: [
        { value: 'change', label: 'Change API key' },
        { value: 'remove', label: 'Remove API key' },
        { value: 'cancel', label: 'Cancel' },
      ],
      onSelect: (value) => {
        host.restoreEditor();
        resolve(value);
      },
      onCancel: () => {
        host.restoreEditor();
        resolve(undefined);
      },
    });
    host.mountEditorReplacement(picker);
  });

  if (choice === 'change') {
    await promptAndSaveKey(host);
  } else if (choice === 'remove') {
    await removeKey(host);
  }
}

async function promptAndSaveKey(host: SlashCommandHost): Promise<void> {
  const key = await promptApiKey(host, 'Context7', [
    'Get your API key at https://context7.com',
    'Your key will be saved to ~/.spectre/config.toml',
  ]);
  if (key === undefined) return;

  try {
    await host.harness.setConfig({
      services: { context7: { apiKey: key } },
    });
    host.track('context7_configured');
    host.showStatus('Context7 API key saved. The Context7 tool is now available.', 'success');
  } catch (error) {
    host.showError(`Failed to save Context7 API key: ${formatErrorMessage(error)}`);
  }
}

async function removeKey(host: SlashCommandHost): Promise<void> {
  try {
    await host.harness.setConfig({
      services: { context7: { apiKey: '' } },
    });
    host.track('context7_removed');
    host.showStatus('Context7 API key removed.');
  } catch (error) {
    host.showError(`Failed to remove Context7 API key: ${formatErrorMessage(error)}`);
  }
}
