import { findCommandByAnyId } from '../../../shared-components/commands';
import { type CommandDefinition } from '../commandConfigurations/commands';

export interface CommonCommandEntry {
  id: string;
  label: string;
  description: string;
  command: CommandDefinition;
}

// Google is included but will be filtered out for short queries (when Fuse search is active)
// to avoid duplication since Google appears at position 2 in Fuse results
export const COMMON_COMMAND_IDS = ['google', 'ai', 'claude'] as const;

const HIDDEN_COMMON_COMMAND_IDS = new Set(['ai', 'claude']);

const COMMON_COMMAND_MAP: Record<(typeof COMMON_COMMAND_IDS)[number], { label: string; description: string }> = {
  ai: { label: 'All AI Chat Agents', description: 'Ask all AI assistants at once' },
  claude: { label: 'Ask Claude', description: 'Ask Claude about this topic' },
  google: { label: 'Search Google', description: 'Search Google' },
};

/**
 * Build common command entries for display in search suggestions.
 * @param commands - All available command definitions
 * @param excludeIds - Optional set of command IDs to exclude (e.g., 'google' when Fuse is active)
 */
export const buildCommonCommandEntries = (
  commands: CommandDefinition[],
  excludeIds?: Set<string>,
): CommonCommandEntry[] => {
  const entries: CommonCommandEntry[] = [];
  COMMON_COMMAND_IDS.forEach(id => {
    if (HIDDEN_COMMON_COMMAND_IDS.has(id)) return;
    // Skip excluded IDs (e.g., skip Google when Fuse search is active to avoid duplication)
    if (excludeIds?.has(id)) return;

    const command = findCommandByAnyId(commands, id);
    if (!command) return;
    const meta = COMMON_COMMAND_MAP[id];
    entries.push({
      id,
      label: meta.label,
      description: meta.description,
      command,
    });
  });
  return entries;
};
