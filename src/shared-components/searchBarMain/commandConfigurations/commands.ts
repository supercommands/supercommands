import { useDbStore } from '../../../storage/store/useDbStore';
import type { CommandRecord } from '../../../allObjectFolder/src/createObject/commands/commandTypes';
import { SHARED_ALL_COMMANDS, AI_GROUP, DEFAULT_SELECTED_AIS } from '../../../shared-components/commands';
import { normalizePrefix } from '../../../shared-components/commands/utils';

export type CommandId =
  | 'agent'
  | 'ai'
  | 'gpt'
  | 'claude'
  | 'gemini'
  | 'perplexity'
  | 'store'
  | 'saved-automation'
  | 'calendar'
  | 'upload_drive'
  | 'showallnotes'
  | 'showalllinks'
  | 'todo'
  | 'createnotes'
  | 'createsnippet'
  | 'createlinks'
  | 'createprompt'
  | 'createfolder'
  | 'capture_screenshot'
  | 'capture_clip_screenshot'
  | 'capture_element_screenshot'
  | 'capture_full_screenshot'
  | 'history'
  | 'extensions'
  | 'downloads'
  | 'passwords'
  | 'flags'
  | 'inspect'
  | 'version'
  | 'gpu'
  | 'dino'
  | 'about';

export type AutoSubmitKind = 'chatgpt' | 'claude' | 'gemini' | 'perplexity' | 'calendar';

export interface CommandDefinition {
  id: CommandId;
  label: string;
  prefix: string; // e.g., 'gpt'
  urlTemplate: string; // e.g. "https://google.com/search?q={query}"
  iconHost: string; // Used for favicon unless custom icon is provided
  icon?: React.ReactNode | React.ComponentType<{ className?: string; size?: number }>; // Custom icon override
  type?: 'general' | 'ai' | 'social' | 'dev' | 'shopping' | 'news' | 'tabgroup';
  autoSubmit?: AutoSubmitKind;
  keywords: string[];
  category?: string;
  hotkey?: string;
  showInDashboard?: boolean;
}

export const BASE_COMMANDS_BY_ID = new Map<string, CommandDefinition>(
  (SHARED_ALL_COMMANDS as CommandDefinition[]).map(cmd => [cmd.id, { ...cmd, prefix: normalizePrefix(cmd.prefix) }]),
);

const ALL_REMOTE_COMMANDS_INTERNAL: CommandDefinition[] = [];
const COMMANDS_INTERNAL: CommandDefinition[] = [];

export const ALL_REMOTE_COMMANDS: CommandDefinition[] = ALL_REMOTE_COMMANDS_INTERNAL;
export const COMMANDS: CommandDefinition[] = COMMANDS_INTERNAL;
export const BROWSER_NAME = 'Chrome';
export { AI_GROUP, DEFAULT_SELECTED_AIS };

const toCommandDefinition = (record: CommandRecord): CommandDefinition => {
  const base = BASE_COMMANDS_BY_ID.get(record.id);
  return {
    id: record.id as CommandId,
    label: record.label || base?.label || record.id,
    prefix: record.prefix !== undefined ? normalizePrefix(record.prefix) : (base?.prefix !== undefined ? normalizePrefix(base.prefix) : `/${record.id}`),
    urlTemplate: (record.urlTemplate as string | undefined) || base?.urlTemplate || '',
    iconHost: record.iconHost || base?.iconHost || '',
    icon: record.icon || base?.icon,
    type: (record.type as CommandDefinition['type']) || base?.type,
    autoSubmit: base?.autoSubmit,
    keywords: (record as any).keywords || base?.keywords || [record.id, record.label, record.prefix].filter(Boolean) as string[],
    category: (record.category as CommandDefinition['category']) || base?.category,
    hotkey: (record as any).hotkey || base?.hotkey,
    showInDashboard: base?.showInDashboard,
  };
};

const syncCommandCaches = () => {
  const records = useDbStore.getState().commands || [];
  const activeRecords = records.filter(record => record.id !== 'createsession');
  const all = activeRecords.map(toCommandDefinition);
  ALL_REMOTE_COMMANDS_INTERNAL.splice(0, ALL_REMOTE_COMMANDS_INTERNAL.length, ...all);
  COMMANDS_INTERNAL.splice(0, COMMANDS_INTERNAL.length, ...all.filter((_cmd, index) => activeRecords[index]?.surface !== 'website'));
};

syncCommandCaches();
useDbStore.subscribe(() => {
  syncCommandCaches();
});

export const findCommandByPrefix = (
  input: string,
  commands: CommandDefinition[] = COMMANDS,
): CommandDefinition | undefined => {
  const trimmed = normalizePrefix(input);
  return commands.find(cmd => trimmed.startsWith(normalizePrefix(cmd.prefix)));
};

export const filterCommands = (query: string, commands: CommandDefinition[] = COMMANDS): CommandDefinition[] => {
  const core = normalizePrefix(query).toLowerCase();
  if (!core) return commands;
  return commands.filter(
    c => c.id.includes(core) || c.label.toLowerCase().includes(core) || normalizePrefix(c.prefix).includes(core),
  );
};

export const buildUrl = (template: string, prompt: string): string => {
  const encoded = encodeURIComponent(prompt);
  // Robustly replace common placeholder variations
  const url = template
    .replace(/\{query\s*\}/gi, encoded)
    .replace(/\[query\s*\]/gi, encoded)
    .replace(/\{content\s*\}/gi, encoded)
    .replace(/\{prompt\s*\}/gi, encoded);
  return url;
};
