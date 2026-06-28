import type { SlashCommandHost } from './dispatch';

/**
 * `/references` — show information about cached dependency references.
 *
 * This command displays which packages have their source code cached and
 * available for the Reference tool. Users can use this to understand what
 * dependencies are indexed and manage the cache.
 */
export async function handleReferencesCommand(host: SlashCommandHost): Promise<void> {
  const session = host.requireSession();
  
  // For now, show a simple status message. The ReferenceService is initialized
  // in the session, but we don't have direct RPC access to list references yet.
  // In a future iteration, we can add a proper RPC method to list/manage references.
  
  host.showStatus(
    'Reference system is active. Use the Reference tool to search dependency source code.',
  );
  host.showStatus(
    'Run `/references refresh` to re-index, or `/references clear` to remove cached references.',
  );
  
  // TODO: Add proper RPC integration to list and manage references
  // This would involve:
  // 1. Adding a listReferences() method to Session RPC
  // 2. Building a panel similar to showMcpServers
  // 3. Supporting subcommands like refresh, clear, etc.
}
