import { db } from '../../../../storage/indexDB/dbConfig';
import { generateEntityId } from '../../../../shared-components/utils';
import type {
  CreatePrefixSettingInput,
  PrefixSettingAction,
  PrefixSettingCategory,
  PrefixSettingKey,
  PrefixSettingRecord,
  PrefixSettingSubcommand,
  UpdatePrefixSettingInput,
} from './prefixSettingTypes';

export const PREFIX_SETTING_STORAGE_KEY = 'custom_search_prefixes_for_omnibox';

export type CustomOmniboxPrefixes = {
  note: string;
  link: string;
  command: string;
  system_command?: string;
  session?: string;
  collection?: string;
  automation?: string;
  agent?: string;
  snippet?: string;
  todo?: string;
  bookmark?: string;
  prompt?: string;
  capture_screenshot?: string;
  capture_clip_screenshot?: string;
  capture_full_screenshot?: string;
  capture_element_screenshot?: string;
  downloadallimages?: string;
  downloadalltables?: string;
  save_link?: string;
  save_todo?: string;
  save_note?: string;
  save_snippet?: string;
  save_chat?: string;
  add_to_existing?: string;
  send_to_agent?: string;
  summarize_page?: string;
  merge_windows?: string;
  close_duplicate_tabs?: string;
  mute_all_tabs?: string;
  unmute_all_tabs?: string;
  field_title?: string;
  field_description?: string;
  field_tag?: string;
  field_time?: string;
  field_recurring?: string;
  field_reference?: string;
};

export const DEFAULT_OMNIBOX_PREFIXES: Required<CustomOmniboxPrefixes> = {
  note: 'n',
  link: 'l',
  command: 'c',
  system_command: 'sc',
  session: '',
  collection: 'collect',
  automation: '',
  agent: '',
  snippet: 'text',
  todo: 't',
  bookmark: 'bk',
  prompt: 'p',
  capture_screenshot: 'visiblescreen',
  capture_clip_screenshot: 'screen',
  capture_full_screenshot: 'fullscreen',
  capture_element_screenshot: 'element',
  downloadallimages: 'dp',
  downloadalltables: 'tables',
  save_link: 'ls',
  save_todo: 'td',
  save_note: 'cn',
  save_snippet: 'cs',
  save_chat: 'save_agent',
  add_to_existing: 'elc',
  send_to_agent: 'send_agent',
  summarize_page: 'summ',
  merge_windows: 'merge',
  close_duplicate_tabs: 'duplicate',
  mute_all_tabs: 'mute',
  unmute_all_tabs: 'unmute',
  field_title: '-t',
  field_description: '-d',
  field_tag: '-tag',
  field_time: '-time',
  field_recurring: '-r',
  field_reference: '-ref',
};

export const PREFIX_SETTING_CATEGORIES = [
  'note',
  'link',
  'collection',
  'todo',
  'bookmark',
  'command',
  'system_command',
  'snippet',
  'agent',
  'prompt',
] as const satisfies readonly PrefixSettingCategory[];

export const PREFIX_SETTING_ACTIONS = [
  'capture_screenshot',
  'capture_clip_screenshot',
  'capture_full_screenshot',
  'capture_element_screenshot',
  'downloadallimages',
  'downloadalltables',
  'save_link',
  'save_todo',
  'save_note',
  'save_snippet',
  'save_chat',
  'add_to_existing',
  'send_to_agent',
  'summarize_page',
  'merge_windows',
  'close_duplicate_tabs',
  'mute_all_tabs',
  'unmute_all_tabs',
] as const satisfies readonly PrefixSettingAction[];

export const PREFIX_SETTING_SUBCOMMANDS = [
  'field_title',
  'field_description',
  'field_tag',
  'field_time',
  'field_recurring',
  'field_reference',
] as const satisfies readonly PrefixSettingSubcommand[];

const DEFAULT_PREFIX_ROWS: ReadonlyArray<Omit<PrefixSettingRecord, 'createdAt' | 'updatedAt'>> = [
  { id: 'prefix_note', type: 'category', category: 'note', label: 'Notes', prefix: 'n', enabled: true },
  { id: 'prefix_link', type: 'category', category: 'link', label: 'Links', prefix: 'l', enabled: true },
  { id: 'prefix_collection', type: 'category', category: 'collection', label: 'Collections', prefix: 'collect', enabled: true },
  { id: 'prefix_todo', type: 'category', category: 'todo', label: 'Todos', prefix: 't', enabled: true },
  { id: 'prefix_bookmark', type: 'category', category: 'bookmark', label: 'Bookmarks', prefix: 'bk', enabled: true },
  { id: 'prefix_command', type: 'category', category: 'command', label: 'Commands', prefix: 'c', enabled: true },
  { id: 'prefix_system_command', type: 'category', category: 'system_command', label: 'System Commands', prefix: 'sc', enabled: true },
  { id: 'prefix_snippet', type: 'category', category: 'snippet', label: 'Text Expanders', prefix: 'text', enabled: true },
  { id: 'prefix_agent', type: 'category', category: 'agent', label: 'Chat Agents', prefix: '', enabled: true },
  { id: 'prefix_prompt', type: 'category', category: 'prompt', label: 'Chat Agents', prefix: 'p', enabled: true },
  { id: 'prefix_action_capture_screenshot', type: 'action', category: 'capture_screenshot', label: 'Capture Visible Screenshot', prefix: 'visiblescreen', enabled: true },
  { id: 'prefix_action_capture_clip_screenshot', type: 'action', category: 'capture_clip_screenshot', label: 'Clip & Download Screenshot', prefix: 'screen', enabled: true },
  { id: 'prefix_action_capture_full_screenshot', type: 'action', category: 'capture_full_screenshot', label: 'Capture Full Screenshot', prefix: 'fullscreen', enabled: true },
  { id: 'prefix_action_capture_element_screenshot', type: 'action', category: 'capture_element_screenshot', label: 'Capture Element', prefix: 'element', enabled: true },
  { id: 'prefix_action_downloadallimages', type: 'action', category: 'downloadallimages', label: 'Download All Images', prefix: 'dp', enabled: true },
  { id: 'prefix_action_downloadalltables', type: 'action', category: 'downloadalltables', label: 'Download All Tables', prefix: 'tables', enabled: true },
  { id: 'prefix_action_save_link', type: 'action', category: 'save_link', label: 'Save Link', prefix: 'ls', enabled: true },
  { id: 'prefix_action_save_todo', type: 'action', category: 'save_todo', label: 'To Do', prefix: 'td', enabled: true },
  { id: 'prefix_action_save_note', type: 'action', category: 'save_note', label: 'Save Note', prefix: 'cn', enabled: true },
  { id: 'prefix_action_save_snippet', type: 'action', category: 'save_snippet', label: 'Save Text Expander', prefix: 'cs', enabled: true },
  { id: 'prefix_action_save_chat', type: 'action', category: 'save_chat', label: 'Save Chat Agent', prefix: 'save_agent', enabled: true },
  { id: 'prefix_action_add_to_existing', type: 'action', category: 'add_to_existing', label: 'Existing Link Collection', prefix: 'elc', enabled: true },
  { id: 'prefix_action_send_to_agent', type: 'action', category: 'send_to_agent', label: 'Send to Agent', prefix: 'send_agent', enabled: true },
  { id: 'prefix_action_summarize_page', type: 'action', category: 'summarize_page', label: 'Summarize Page', prefix: 'summ', enabled: true },
  { id: 'prefix_action_merge_windows', type: 'action', category: 'merge_windows', label: 'Merge All Windows', prefix: 'merge', enabled: true },
  { id: 'prefix_action_close_duplicate_tabs', type: 'action', category: 'close_duplicate_tabs', label: 'Close Duplicate Tabs', prefix: 'duplicate', enabled: true },
  { id: 'prefix_action_mute_all_tabs', type: 'action', category: 'mute_all_tabs', label: 'Mute All Tabs', prefix: 'mute', enabled: true },
  { id: 'prefix_action_unmute_all_tabs', type: 'action', category: 'unmute_all_tabs', label: 'Unmute All Tabs', prefix: 'unmute', enabled: true },
  { id: 'prefix_subcommand_field_title', type: 'subcommand', category: 'field_title', label: 'Title Field', prefix: '-t', enabled: true },
  { id: 'prefix_subcommand_field_description', type: 'subcommand', category: 'field_description', label: 'Description Field', prefix: '-d', enabled: true },
  { id: 'prefix_subcommand_field_tag', type: 'subcommand', category: 'field_tag', label: 'Tag Field', prefix: '-tag', enabled: true },
  { id: 'prefix_subcommand_field_time', type: 'subcommand', category: 'field_time', label: 'Time Field', prefix: '-time', enabled: true },
  { id: 'prefix_subcommand_field_recurring', type: 'subcommand', category: 'field_recurring', label: 'Recurring Field', prefix: '-r', enabled: true },
  { id: 'prefix_subcommand_field_reference', type: 'subcommand', category: 'field_reference', label: 'Reference Field', prefix: '-ref', enabled: true },
];

const LEGACY_DEFAULT_PREFIXES_BY_ID: Record<string, string> = {
  prefix_collection: 'co',
  prefix_bookmark: 'bm',
  prefix_snippet: 'sn',
  prefix_agent: 'g',
  prefix_action_capture_screenshot: 'cs',
  prefix_action_capture_clip_screenshot: 'ccs',
  prefix_action_capture_full_screenshot: 'cfp',
  prefix_action_capture_element_screenshot: 'ces',
  prefix_action_downloadallimages: 'dai',
  prefix_action_downloadalltables: 'dat',
  prefix_action_save_link: 'clc',
  prefix_action_save_chat: 'stc',
  prefix_action_send_to_agent: 'sta',
  prefix_action_summarize_page: 'smm',
  prefix_action_merge_windows: 'mw',
  prefix_action_close_duplicate_tabs: 'cdt',
  prefix_action_mute_all_tabs: 'mat',
  prefix_action_unmute_all_tabs: 'umat',
};

const normalizePrefix = (value: string | null | undefined) =>
  String(value || '')
    .trim()
    .replace(/^\/+/, '')
    .toLowerCase();

const isSupportedCategory = (category: string): category is PrefixSettingCategory =>
  (PREFIX_SETTING_CATEGORIES as readonly string[]).includes(category);

const isSupportedAction = (category: string): category is PrefixSettingAction =>
  (PREFIX_SETTING_ACTIONS as readonly string[]).includes(category);

const isSupportedSubcommand = (category: string): category is PrefixSettingSubcommand =>
  (PREFIX_SETTING_SUBCOMMANDS as readonly string[]).includes(category);

const isSupportedPrefixKey = (category: string): category is PrefixSettingKey =>
  isSupportedCategory(category) || isSupportedAction(category) || isSupportedSubcommand(category);

const toPrefixSettingRecord = (row: PrefixSettingRecord): PrefixSettingRecord => ({
  id: row.id,
  type: row.type || (isSupportedAction(row.category) ? 'action' : isSupportedSubcommand(row.category) ? 'subcommand' : 'category'),
  category: row.category,
  label: row.label,
  prefix: normalizePrefix(row.prefix),
  enabled: row.enabled,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toRequiredPrefixMap = (rows: PrefixSettingRecord[]): Required<CustomOmniboxPrefixes> => {
  const map: Required<CustomOmniboxPrefixes> = { ...DEFAULT_OMNIBOX_PREFIXES };
  for (const row of rows) {
    if (!row.enabled || !isSupportedPrefixKey(row.category)) continue;
    (map as any)[row.category] = normalizePrefix(row.prefix);
  }
  map.session = '';
  map.automation = '';
  return map;
};

export function getDefaultPrefixSettings(): PrefixSettingRecord[] {
  const now = Date.now();
  return DEFAULT_PREFIX_ROWS.map(row => ({
    ...row,
    createdAt: now,
    updatedAt: now,
  }));
}

export async function createPrefixSetting(input: CreatePrefixSettingInput): Promise<PrefixSettingRecord> {
  const now = Date.now();
  const record = toPrefixSettingRecord({
    ...input,
    id: input.id || generateEntityId('prefix_setting'),
    prefix: normalizePrefix(input.prefix),
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  });
  await validateUniquePrefixSettings(record);
  await db.prefixSettings.put(record);
  return record;
}

export async function updatePrefixSetting(
  id: string,
  patch: UpdatePrefixSettingInput,
): Promise<PrefixSettingRecord> {
  const existing = await db.prefixSettings.get(id);
  if (!existing) throw new Error(`Prefix setting ${id} not found.`);

  const updated: PrefixSettingRecord = {
    ...existing,
    ...patch,
    prefix: patch.prefix !== undefined ? normalizePrefix(patch.prefix) : existing.prefix,
    updatedAt: Date.now(),
  };

  const normalized = toPrefixSettingRecord(updated);
  await validateUniquePrefixSettings(normalized);
  await db.prefixSettings.put(normalized);
  await cleanupTextShortcutsForReservedPrefixes();
  return normalized;
}

export async function getPrefixSettings(): Promise<PrefixSettingRecord[]> {
  await syncPrefixSettingsFromSource();
  return db.prefixSettings.orderBy('category').toArray();
}

export async function getEnabledPrefixSettings(): Promise<PrefixSettingRecord[]> {
  const rows = await getPrefixSettings();
  return rows.filter(row => row.enabled);
}

export async function getCategoryPrefixSettings(): Promise<PrefixSettingRecord[]> {
  const rows = await getPrefixSettings();
  return rows.filter(row => row.type === 'category');
}

export async function getActionPrefixSettings(): Promise<PrefixSettingRecord[]> {
  const rows = await getPrefixSettings();
  return rows.filter(row => row.type === 'action');
}

export async function getSubcommandPrefixSettings(): Promise<PrefixSettingRecord[]> {
  const rows = await getPrefixSettings();
  return rows.filter(row => row.type === 'subcommand');
}

export async function getPrefixes(): Promise<Required<CustomOmniboxPrefixes>> {
  const rows = await getPrefixSettings();
  return toRequiredPrefixMap(rows);
}

export async function setPrefixes(prefixes: CustomOmniboxPrefixes): Promise<void> {
  await syncPrefixSettingsFromSource();
  const rows = await db.prefixSettings.toArray();
  const now = Date.now();
  const updatedRows = rows.map(row => {
    if (!isSupportedPrefixKey(row.category)) return row;
    const nextPrefix = (prefixes as any)[row.category];
    if (nextPrefix === undefined) return row;
    return {
      ...row,
      prefix: normalizePrefix(nextPrefix),
      updatedAt: now,
    };
  });

  await validateUniquePrefixSettings(updatedRows);
  await db.prefixSettings.bulkPut(updatedRows);
  await cleanupTextShortcutsForReservedPrefixes();
}

export async function syncPrefixSettingsFromSource(): Promise<PrefixSettingRecord[]> {
  const now = Date.now();
  const existingRows = await db.prefixSettings.toArray();
  const existingById = new Map(existingRows.map(row => [row.id, row]));
  const nextRows: PrefixSettingRecord[] = [];

  for (const defaultRow of DEFAULT_PREFIX_ROWS) {
    const existing = existingById.get(defaultRow.id);
    if (existing) {
      const existingPrefix = normalizePrefix(existing.prefix);
      const legacyDefaultPrefix = LEGACY_DEFAULT_PREFIXES_BY_ID[defaultRow.id];
      const shouldUseNewDefault =
        legacyDefaultPrefix !== undefined && existingPrefix === normalizePrefix(legacyDefaultPrefix);
      nextRows.push(toPrefixSettingRecord({
        id: defaultRow.id,
        type: defaultRow.type,
        category: defaultRow.category,
        label: existing.label || defaultRow.label,
        prefix: shouldUseNewDefault ? defaultRow.prefix : existing.prefix || defaultRow.prefix,
        enabled: existing.enabled ?? defaultRow.enabled,
        createdAt: existing.createdAt || now,
        updatedAt: shouldUseNewDefault ? now : existing.updatedAt || now,
      }));
    } else {
      nextRows.push({
        ...defaultRow,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  if (nextRows.length > 0) {
    await db.prefixSettings.bulkPut(nextRows);
  }

  return db.prefixSettings.orderBy('category').toArray();
}

export async function migratePrefixSettingsFromLocalStorageToDexie(): Promise<{ migratedCount: number; purged: boolean }> {
  await syncPrefixSettingsFromSource();

  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return { migratedCount: 0, purged: false };
  }

  const storedData = await chrome.storage.local.get(PREFIX_SETTING_STORAGE_KEY);
  const legacy = storedData[PREFIX_SETTING_STORAGE_KEY] as Partial<CustomOmniboxPrefixes> | undefined;

  let migratedCount = 0;
  if (legacy && typeof legacy === 'object') {
    const rows = await db.prefixSettings.toArray();
    const now = Date.now();
    const updatedRows = rows.map(row => {
      if (!isSupportedPrefixKey(row.category)) return row;
      const legacyPrefix = (legacy as any)[row.category];
      if (legacyPrefix === undefined) return row;
      migratedCount += 1;
      return toPrefixSettingRecord({
        ...row,
        prefix: normalizePrefix(legacyPrefix),
        updatedAt: now,
      });
    });

    await validateUniquePrefixSettings(updatedRows);
    await db.prefixSettings.bulkPut(updatedRows);
  }

  await chrome.storage.local.remove(PREFIX_SETTING_STORAGE_KEY);
  await cleanupTextShortcutsForReservedPrefixes();
  return { migratedCount, purged: true };
}

export async function validateUniquePrefixSettings(rowsOrRow?: PrefixSettingRecord | PrefixSettingRecord[]): Promise<void> {
  let rows: PrefixSettingRecord[];
  if (Array.isArray(rowsOrRow)) {
    rows = rowsOrRow;
  } else if (rowsOrRow) {
    const existingRows = await db.prefixSettings.toArray();
    const foundExisting = existingRows.some(row => row.id === rowsOrRow.id);
    rows = foundExisting
      ? existingRows.map(row => (row.id === rowsOrRow.id ? rowsOrRow : row))
      : [...existingRows, rowsOrRow];
  } else {
    rows = await db.prefixSettings.toArray();
  }

  const values = rows
    .filter(row => row.enabled)
    .map(row => normalizePrefix(row.prefix))
    .filter(Boolean);
  if (new Set(values).size !== values.length) {
    throw new Error('Duplicate prefixes are not allowed. Each prefix must be unique.');
  }
}

export async function cleanupTextShortcutsForReservedPrefixes(): Promise<void> {
  const rows = await db.prefixSettings.toArray();
  const reserved = new Set(
    rows
      .filter(row => row.enabled)
      .map(row => normalizePrefix(row.prefix))
      .filter(Boolean),
  );

  const shortcuts = await db.userShortcuts.toArray();
  const conflicts = shortcuts.filter(shortcut => reserved.has(normalizePrefix(shortcut.trigger)));
  if (conflicts.length > 0) {
    await db.userShortcuts.bulkDelete(conflicts.map(shortcut => shortcut.id));
  }
}
