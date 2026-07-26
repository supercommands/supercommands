import { getLocalCommandDefinitions } from '../../../shared-components/commands';
import { normalizePrefix } from '../../../shared-components/commands/utils';
import { useDbStore } from '../../../storage/store/useDbStore';

export type LocalCommandId =
  | 'agent'
  | 'ai'
  | 'gpt'
  | 'claude'
  | 'gemini'
  | 'perplexity'
  | 'bookmarks'
  | 'calendar'
  | 'upload_drive'
  | 'delete_link'
  | 'createnotes'
  | 'createlinks'
  | 'createsession'
  | 'createprompt'
  | 'createfolder'
  | 'createworkspace'
  | 'capture_screenshot'
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

export type LocalCommandScope = 'workspace' | 'folder' | 'snippet' | 'bookmark';
export type LocalCommandAction = 'rename' | 'delete';
export type LocalCommandBehavior = 'entity' | 'instant' | 'locked';

export interface LocalCommandDefinition {
  id: string; // Changed from LocalCommandId to string to allow newly registered commands
  label: string;
  prefix: string;
  behavior: LocalCommandBehavior;
  keywords?: string[]; // Search keywords for fuzzy matching
  // entity-selection behavior
  scope?: LocalCommandScope;
  action?: LocalCommandAction;
  // instant behavior identifier; consumers can route by this id
  executeId?: string;
  url?: string; // optional: open this URL directly for instant commands
  getDynamicLabel?: (context: any) => string;
  hotkey?: string; // User-defined hotkey (optional)
  icon?: React.ReactNode | React.ComponentType<{ className?: string; size?: number }>;
  showInDashboard?: boolean;
  category?: string;
  isAvailable?: (webContext?: any) => boolean;
}

const BASE_LOCAL_COMMANDS_BY_ID = new Map<string, LocalCommandDefinition>(
  (getLocalCommandDefinitions() as unknown as LocalCommandDefinition[]).map(cmd => [cmd.id, cmd]),
);

const ALL_LOCAL_COMMANDS_INTERNAL: LocalCommandDefinition[] = [];
const LOCAL_COMMANDS_INTERNAL: LocalCommandDefinition[] = [];

export const ALL_LOCAL_COMMANDS: LocalCommandDefinition[] = ALL_LOCAL_COMMANDS_INTERNAL;
export const LOCAL_COMMANDS: LocalCommandDefinition[] = LOCAL_COMMANDS_INTERNAL;

const syncLocalCommandCaches = () => {
  const records = useDbStore.getState().commands || [];
  const recordMap = new Map(records.map(r => [r.id, r]));

  // Start with all base commands and override with custom records
  const allBase = Array.from(BASE_LOCAL_COMMANDS_BY_ID.values()).map(base => {
    const record = recordMap.get(base.id);
    if (!record) return base;
    return {
      ...(base || {}),
      id: record.id,
      label: record.label || base.label || record.id,
      prefix: normalizePrefix(record.prefix ?? base?.prefix ?? `/${record.id}`),
      behavior: (base.behavior || 'instant') as LocalCommandBehavior,
      keywords: base.keywords || ([record.id, record.label, record.prefix].filter(Boolean) as string[]),
      hotkey: (record as any).hotkey || base.hotkey,
      icon: record.icon || base.icon,
      showInDashboard: base.showInDashboard,
      category: record.category || base.category,
      isAvailable: base.isAvailable,
      scope: base.scope,
      action: base.action,
      executeId: base.executeId,
      url: (record as any).urlTemplate || base.url,
    } as LocalCommandDefinition;
  });

  // Append any custom records that are not in base
  const customOnly = records
    .filter(r => !BASE_LOCAL_COMMANDS_BY_ID.has(r.id))
    .map(
      record =>
        ({
          ...record,
          label: record.label || record.id,
          prefix: record.prefix ?? `/${record.id}`,
          behavior: 'instant' as LocalCommandBehavior,
          keywords: [record.id, record.label, record.prefix].filter(Boolean) as string[],
          hotkey: (record as any).hotkey,
          url: (record as any).urlTemplate,
        }) as LocalCommandDefinition,
    );

  const all = [...allBase, ...customOnly];

  ALL_LOCAL_COMMANDS_INTERNAL.splice(0, ALL_LOCAL_COMMANDS_INTERNAL.length, ...all);
  LOCAL_COMMANDS_INTERNAL.splice(
    0,
    LOCAL_COMMANDS_INTERNAL.length,
    ...all.filter(cmd => {
      const record = records.find(r => r.id === cmd.id);
      return record?.surface !== 'website';
    }),
  );
};

syncLocalCommandCaches();
useDbStore.subscribe(() => {
  syncLocalCommandCaches();
});
/**
 * Get local commands with user customizations applied
 * (Synchronous version using the Dexie-backed command table)
 */
export const getLocalCommandsSync = async (): Promise<LocalCommandDefinition[]> => {
  return LOCAL_COMMANDS;
};

export const filterLocalCommands = (query: string): LocalCommandDefinition[] => {
  const core = normalizePrefix(query).toLowerCase();
  if (!core) return LOCAL_COMMANDS;
  return LOCAL_COMMANDS.filter(
    c => c.id.includes(core) || c.label.toLowerCase().includes(core) || normalizePrefix(c.prefix).includes(core),
  );
};

export const isLocalCommandId = (id: string | null | undefined): id is LocalCommandId => {
  if (!id) return false;
  return (LOCAL_COMMANDS as LocalCommandDefinition[]).some(c => c.id === id);
};
