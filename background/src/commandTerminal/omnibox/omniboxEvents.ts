/**
 * @file omniboxEvents.ts
 * @description Handles Chrome omnibox API events and interactions.
 */
import 'webextension-polyfill';
import { triggerInPlaceCommand } from '../inPlaceCommands/triggerInPlaceCommand';
import { handleAiTabMessage } from '../../browserWindows/chatRuntimeEngine';
import {
  getAllUserShortcuts,
  normalizeShortcutTrigger,
} from '../../../../src/shared-components/shortcuts/core/shortcutDbData';
import {
  CustomSearchPrefixesForOmniboxStorage,
  DEFAULT_OMNIBOX_PREFIXES as STORED_DEFAULT_OMNIBOX_PREFIXES,
  type CustomOmniboxPrefixes,
} from '../../../../src/storage/localStorage/customSearchPrefixesForOmniboxStorage';

import type { NoteRecord } from '../../../../src/allObjectFolder/src/createObject/notes/noteTypes';
import type { LinkRecord } from '../../../../src/allObjectFolder/src/createObject/links/linkTypes';
import type { CommandRecord } from '../../../../src/allObjectFolder/src/createObject/commands/commandTypes';
import type { SessionRecord } from '../../../../src/allObjectFolder/src/createObject/session/sessionTypes';
import type { AiPromptRecord } from '../../../../src/allObjectFolder/src/createObject/aiPrompt/aiPromptTypes';
import type { ChatAgentRecord } from '../../../../src/allObjectFolder/src/createObject/ChatAgent/chatAgentTypes';
import type { AutomationRecord } from '../../../../src/allObjectFolder/src/createObject/automationBeta/automationTypes';
import type { SnippetRecord } from '../../../../src/allObjectFolder/src/createObject/snippets/snippetTypes';
import type { TodoRecord } from '../../../../src/allObjectFolder/src/createObject/todos/todoTypes';
import type { PrefixSettingRecord } from '../../../../src/allObjectFolder/src/createObject/prefixSettings/prefixSettingTypes';

import { db } from '../../../../src/storage/indexDB/dbConfig';
import { handleSessionMessage } from '../../browserWindows/sessions';
import {
  buildShortcutPrefixRegistry,
  getNoteQuickCreatePrefixLabels,
  parseNoteQuickCreateFields,
  recordAssignedTriggerUsage,
} from '../../../../src/shared-components/triggers';
import { injectLinkQueryValues } from './linkQueryInjection';
import { syncCommandsFromSource } from '../../../../src/allObjectFolder/src/createObject/commands/commandData';
import { createNote, updateNote } from '../../../../src/allObjectFolder/src/createObject/notes/noteData';
import { createTag } from '../../../../src/allObjectFolder/src/createObject/tags/tagData';

const SESSION_SUGGESTION_ID_PREFIX = 'id:';

type WidgetViewRecord = {
  id: string;
  title?: string;
  workspaceId?: string;
  isDefault?: boolean;
  createdAt?: number;
  updatedAt?: number;
};

type CollectionOpenBehavior = 'focus_mode';

const normalizeWidgetViewsForOmnibox = (widgetViews: WidgetViewRecord[]): WidgetViewRecord[] => {
  const seenDefaultViews = new Set<string>();
  const seenViewIds = new Set<string>();

  return [...(widgetViews || [])]
    .sort((a, b) => {
      if (!!a.isDefault !== !!b.isDefault) return a.isDefault ? -1 : 1;
      return (a.createdAt || 0) - (b.createdAt || 0);
    })
    .filter(view => {
      const viewId = String(view?.id || '').trim();
      if (viewId) {
        if (seenViewIds.has(viewId)) return false;
        seenViewIds.add(viewId);
      }

      if (!view?.isDefault) return true;
      const workspaceId = String(view.workspaceId || 'global');
      const title = String(view.title || '').trim().toLowerCase() || 'main dashboard';
      const key = `${workspaceId}:${title}`;
      if (seenDefaultViews.has(key)) return false;
      seenDefaultViews.add(key);
      return true;
    });
};

export function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

const buildQuickCreateNoteBodyHtml = (description: string): string => {
  const lines = String(description || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  return lines.map(line => `<p>${escapeXml(line)}</p>`).join('');
};

const appendNoteBodyHtml = (currentBody: string, appendedDescription: string): string => {
  const appendHtml = buildQuickCreateNoteBodyHtml(appendedDescription);
  if (!appendHtml) return currentBody;
  const trimmedBody = String(currentBody || '').trim();
  if (!trimmedBody) return appendHtml;
  const needsSpacer = !trimmedBody.endsWith('</p>');
  return `${trimmedBody}${needsSpacer ? '<p><br></p>' : ''}${appendHtml}`;
};

export function formatSuggestionDescription(title: string, category: string, prefix: string, isAlreadyEscaped = false): string {
  let emoji = '🔍'; // fallback
  switch (category) {
    case 'Notes': emoji = '📄'; break;
    case 'Links': emoji = '🔗'; break;
    case 'System': emoji = '⚙\uFE0E'; break;
    case 'Collections': emoji = '⊞'; break; // Looks like the 2x2 grid
    case 'Prompts': emoji = '💬'; break;
    case 'Automations': emoji = '⚡'; break;
    case 'Agents': emoji = '🤖'; break;
    case 'Todos': emoji = '☑️'; break; // Checkbox
    case 'Snippets': emoji = 'SN'; break; // Text Expander icon
    case 'Shortcuts': emoji = '⌘'; break; // Command icon
  }
  const safeTitle = isAlreadyEscaped ? title : escapeXml(title);
  return `${escapeXml(emoji)}  <match>${safeTitle}</match>  <dim>  ${escapeXml(category)}  (c ${escapeXml(prefix)})</dim>`;
}

// AI_COMMANDS and URL_COMMANDS are commented out — both branches in executeCommand are unreachable:
// • AI command IDs (gpt, claude, gemini, perplexity) are blocked by HIDDEN_OMNIBOX_COMMAND_IDS
//   so they are never surfaced as omnibox suggestions.
// • URL_COMMANDS entries (google, youtube, etc.) are not stored as CommandRecords in the DB.
//
// const AI_COMMANDS: Record<string, string> = {
//   gpt: 'chatgpt', chatgpt: 'chatgpt', gemini: 'gemini', claude: 'claude', perplexity: 'perplexity',
// };
//
// const URL_COMMANDS: Record<string, string> = {
//   google: 'https://google.com/search?q={query}',
//   youtube: 'https://www.youtube.com/results?search_query={query}',
//   history: 'chrome://history', downloads: 'chrome://downloads',
//   extensions: 'chrome://extensions', settings: 'chrome://settings',
// };

const findBestShortcutMatch = (input: string, userShortcuts: any[], referenceType?: string) => {
  const normalizedInput = normalizeShortcutTrigger(input);
  if (!normalizedInput) return null;

  const matches = (userShortcuts || [])
    .filter((s: any) => !referenceType || getShortcutTargetType(s) === normalizeOmniboxEntityType(referenceType))
    .map((s: any) => {
      const trigger = normalizeShortcutTrigger(s.trigger || '');
      if (!trigger) return null;
      let rank = 0;
      if (trigger === normalizedInput) rank = 0;
      else if (trigger.startsWith(normalizedInput)) rank = 1;
      else if (normalizedInput.length >= 2 && trigger.includes(normalizedInput)) rank = 2;
      else return null;
      return { shortcut: s, trigger, rank };
    })
    .filter(Boolean) as Array<{ shortcut: any; trigger: string; rank: number }>;

  matches.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.trigger.length - b.trigger.length;
  });

  return matches[0]?.shortcut || null;
};

const HIDDEN_OMNIBOX_COMMAND_IDS = new Set(['gpt', 'claude', 'gemini', 'perplexity', 'capture_element_screenshot']);

const isOmniboxVisibleCommand = (command: CommandRecord | null | undefined) => {
  if (command?.showInDashboard === false) return false;
  if (HIDDEN_OMNIBOX_COMMAND_IDS.has(String(command?.id || '').toLowerCase())) return false;
  return Boolean(command?.prefix && command.prefix.trim().length > 0);
};

// ─── Registry: short key → content type ──────────────────────────────────────
// Locked for now. Will be user-configurable in the future.
// Registry and helper config remains at module level
// ─── Data helpers ─────────────────────────────────────────────────────────────

/**
 * Queries the 'cmdOS' IndexedDB database via Dexie.
 */
function queryIndexedDB<T>(storeName: string): Promise<T[]> {
  return db
    .table(storeName)
    .toArray()
    .catch(err => {
      console.warn(`[Omnibox] Store ${storeName} not ready or query failed:`, err);
      return [];
    }) as Promise<T[]>;
}

/** Fetches the local DB-backed data used by omnibox suggestions. */
async function getLocalData(): Promise<OmniboxLocalData> {
  const [links, notes, commands, sessions, widgetViews, userShortcuts, aiPrompts, chatAgents, automations, snippets, todos, prefixSettings, workspaces] =
    await Promise.all([
      queryIndexedDB<LinkRecord & { isSession?: boolean }>('links').catch(() => []),
      queryIndexedDB<NoteRecord>('notes').catch(() => []),
      queryIndexedDB<CommandRecord>('commands')
        .then(rows => rows.filter(isOmniboxVisibleCommand))
        .catch(() => []),
      queryIndexedDB<SessionRecord>('sessions').catch(() => []),
      queryIndexedDB<WidgetViewRecord>('widgetViews').catch(() => []),
      getAllUserShortcuts().catch(() => []),
      queryIndexedDB<AiPromptRecord>('aiPrompts').catch(() => []),
      queryIndexedDB<ChatAgentRecord>('chatAgents').catch(() => []),
      queryIndexedDB<AutomationRecord>('automations').catch(() => []),
      queryIndexedDB<SnippetRecord>('snippets').catch(() => []),
      queryIndexedDB<TodoRecord>('todos').catch(() => []),
      queryIndexedDB<PrefixSettingRecord>('prefixSettings').catch(() => []),
      queryIndexedDB<any>('workspaces').catch(() => []),
    ]);

  return {
    links,
    notes,
    commands,
    sessions,
    widgetViews: normalizeWidgetViewsForOmnibox(widgetViews),
    userShortcuts,
    aiPrompts,
    chatAgents,
    automations,
    snippets,
    todos,
    prefixSettings,
    workspaces,
  };
}

/** Extracts URLs from a link or tabgroup snippet */
function extractUrls(snippet: any): string[] {
  try {
    // 1. Direct .urls array on the link record (most common for LinkRecord)
    if (Array.isArray(snippet?.urls)) {
      return snippet.urls
        .map((u: any) => (typeof u === 'string' ? u : u?.url))
        .filter((u: any) => typeof u === 'string' && (u.startsWith('http') || u.startsWith('note:')));
    }

    // 2. .value field — could be a JSON string or object
    const value = snippet?.value;
    if (!value) return [];

    if (typeof value === 'string') {
      // Plain URL string
      if (value.startsWith('http') || value.startsWith('note:')) return [value];

      // JSON string: { urls: [...] } or [...]
      const parsed = JSON.parse(value);
      if (parsed && Array.isArray(parsed.urls)) {
        return parsed.urls.filter((u: any) => typeof u === 'string');
      }
      if (Array.isArray(parsed)) {
        return parsed.filter((u: any) => typeof u === 'string');
      }
      return [];
    }

    if (typeof value === 'object' && Array.isArray(value?.urls)) {
      return value.urls.filter((u: any) => typeof u === 'string');
    }

    return [];
  } catch (err) {
    console.error('[Omnibox] Failed to parse URLs from link:', snippet);
    return [];
  }
}

// ─── Input parser ─────────────────────────────────────────────────────────────

/**
 * Builds the dynamic registry from stored custom prefixes.
 * Default values come from customSearchPrefixesForOmniboxStorage, not local fallback aliases.
 */
export function buildRegistry(
  _commands: CommandRecord[],
  customPrefixes: CustomOmniboxPrefixes | null,
): Record<string, 'note' | 'link' | 'command' | 'collection' | 'prompt' | 'agent' | 'todo' | 'snippet'> {
  type OmniboxRegistryType = 'note' | 'link' | 'command' | 'collection' | 'prompt' | 'agent' | 'todo' | 'snippet';
  const allowedTypes = new Set<OmniboxRegistryType>([
    'note',
    'link',
    'command',
    'collection',
    'prompt',
    'agent',
    'todo',
    'snippet',
  ]);

  return Object.entries(buildShortcutPrefixRegistry(customPrefixes)).reduce<Record<string, OmniboxRegistryType>>(
    (registry, [prefix, type]) => {
      if (allowedTypes.has(type as OmniboxRegistryType)) {
        registry[prefix] = type as OmniboxRegistryType;
      }
      return registry;
    },
    {},
  );
}

type ResolvedOmniboxInput = {
  prefix: string;
  type: 'note' | 'link' | 'command' | 'collection' | 'prompt' | 'agent' | 'todo' | 'snippet' | null;
  query: string;
};

const isSymbolPrefix = (value: string) => /^[^a-z0-9]+$/i.test(value);

/** Resolves both token prefixes ("n note") and glued prefixes (".note", "@note"). */
export function parseInput(text: string, registry: Record<string, string>): ResolvedOmniboxInput {
  const trimmed = text.trim().replace(/\s+/g, ' '); // Collapse multiple spaces
  if (!trimmed) return { prefix: '', type: null, query: '' };

  const candidatePrefixes = Object.keys(registry).sort((a, b) => b.length - a.length);
  const lowerTrimmed = trimmed.toLowerCase();

  for (const prefix of candidatePrefixes) {
    const lowerPrefix = prefix.toLowerCase();
    if (!lowerPrefix) continue;

    if (isSymbolPrefix(lowerPrefix)) {
      if (lowerTrimmed.startsWith(lowerPrefix)) {
        return {
          prefix: prefix,
          type: registry[prefix] as any,
          query: trimmed.slice(prefix.length).trimStart(),
        };
      }
      continue;
    }

    if (lowerTrimmed === lowerPrefix) {
      return { prefix, type: registry[prefix] as any, query: '' };
    }

    if (lowerTrimmed.startsWith(`${lowerPrefix} `)) {
      return {
        prefix,
        type: registry[prefix] as any,
        query: trimmed.slice(prefix.length).trimStart(),
      };
    }
  }

  return { prefix: '', type: null, query: '' };
}


// Extract raw snippet UUID from compound ID (e.g. folderId-UUID)
function extractSnippetId(compoundId: string): string {
  if (!compoundId || !compoundId.includes('-')) return compoundId;
  const parts = compoundId.split('-');
  // UUIDs have 5 parts separated by dashes
  return parts.slice(-1)[0].length > 8 ? parts.slice(-5).join('-') : compoundId;
}

// ─── Omnibox event listeners ──────────────────────────────────────────────────

let cachedState: ResolvedOmniboxState = {
  localData: { links: [], notes: [], commands: [], sessions: [], widgetViews: [], userShortcuts: [], prefixSettings: [], workspaces: [] },
  customPrefixes: null,
};
let isCacheReady = false;
let activeFetchPromise: Promise<ResolvedOmniboxState> | null = null;

async function fetchAndApplyState(): Promise<ResolvedOmniboxState> {
  try {
    // Seed/sync commands from the central catalog to ensure they are present in IndexedDB on worker startup
    await syncCommandsFromSource().catch(err => {
      console.error('[Omnibox] Failed to sync/seed commands catalog:', err);
    });

    const [localData, customPrefixes] = await Promise.all([
      getLocalData().catch(err => {
        console.error('[Omnibox] Failed to load local data:', err);
        return cachedState.localData;
      }),
      CustomSearchPrefixesForOmniboxStorage.getPrefixes().catch(() => STORED_DEFAULT_OMNIBOX_PREFIXES),
    ]);

    const virtualCommands: any[] = [
      {
        id: 'save_link',
        label: 'Save Link',
        prefix: (customPrefixes as any)?.save_link || 'ls',
        behavior: 'instant' as const,
        showInDashboard: true,
      },
      {
        id: 'save_todo',
        label: 'To Do',
        prefix: (customPrefixes as any)?.save_todo || 'td',
        behavior: 'instant' as const,
        showInDashboard: true,
      },
      {
        id: 'save_snippet',
        label: 'Save Text Expander',
        prefix: (customPrefixes as any)?.save_snippet || 'cs',
        behavior: 'instant' as const,
        showInDashboard: true,
      },
      {
        id: 'save_chat',
        label: 'Save Chat Agent',
        prefix: (customPrefixes as any)?.save_chat || 'save_agent',
        behavior: 'instant' as const,
        showInDashboard: true,
      },
      {
        id: 'add_to_existing',
        label: 'Add to Existing',
        prefix: (customPrefixes as any)?.add_to_existing || 'elc',
        behavior: 'instant' as const,
        showInDashboard: true,
      },
      {
        id: 'add_to_existing_session',
        label: 'Add to Existing Collection',
        prefix: (customPrefixes as any)?.add_to_existing_session || 'es',
        behavior: 'instant' as const,
        showInDashboard: true,
      },
      {
        id: 'summarize_page',
        label: 'Summarize Page',
        prefix: (customPrefixes as any)?.summarize_page || 'summ',
        behavior: 'instant' as const,
        surface: 'website' as const,
        showInDashboard: true,
      },
      {
        id: 'downloadallimages',
        label: 'Download All Images',
        prefix: (customPrefixes as any)?.downloadallimages || 'dp',
        behavior: 'instant' as const,
        surface: 'website' as const,
        showInDashboard: true,
      },
      {
        id: 'downloadalltables',
        label: 'Download All Tables',
        prefix: (customPrefixes as any)?.downloadalltables || 'tables',
        behavior: 'instant' as const,
        surface: 'website' as const,
        showInDashboard: true,
      },
      {
        id: 'capture_full_screenshot',
        label: 'Capture Full Screenshot',
        prefix: (customPrefixes as any)?.capture_full_screenshot || 'fullscreen',
        keywords: ['ca', 'cap', 'capture', 'sc', 'fullscreen', 'fps', 'fullpage', 'full', 'screenshot'],
        behavior: 'instant' as const,
        surface: 'website' as const,
        showInDashboard: true,
      },
      {
        id: 'capture_screenshot',
        label: 'Capture Visible Screenshot',
        prefix: (customPrefixes as any)?.capture_screenshot || 'visiblescreen',
        keywords: ['ca', 'cap', 'capture', 'sc', 'visiblescreen', 'screenshot', 'visible'],
        behavior: 'instant' as const,
        surface: 'website' as const,
        showInDashboard: true,
      },
      {
        id: 'capture_clip_screenshot',
        label: 'Clip & Download Screenshot',
        prefix: (customPrefixes as any)?.capture_clip_screenshot || 'screen',
        keywords: ['ca', 'cap', 'capture', 'sc', 'screen', 'cc', 'clip', 'clipboard', 'screenshot'],
        behavior: 'instant' as const,
        surface: 'website' as const,
        showInDashboard: true,
      },
      {
        id: 'capture_element_screenshot',
        label: 'Capture Element',
        prefix: (customPrefixes as any)?.capture_element_screenshot || 'element',
        keywords: ['ca', 'cap', 'capture', 'sc', 'element', 'part', 'section', 'select', 'screenshot'],
        behavior: 'instant' as const,
        surface: 'website' as const,
        showInDashboard: false,
      },
      {
        id: 'merge_windows',
        label: 'Merge All Windows',
        prefix: (customPrefixes as any)?.merge_windows || 'merge',
        keywords: ['merge', 'windows', 'tabs', 'consolidate'],
        behavior: 'instant' as const,
        surface: 'website' as const,
        showInDashboard: true,
      },
      {
        id: 'close_duplicate_tabs',
        label: 'Close Duplicate Tabs',
        prefix: (customPrefixes as any)?.close_duplicate_tabs || 'duplicate',
        keywords: ['close', 'duplicate', 'tabs'],
        behavior: 'instant' as const,
        surface: 'website' as const,
        showInDashboard: true,
      },
      {
        id: 'mute_all_tabs',
        label: 'Mute All Tabs',
        prefix: (customPrefixes as any)?.mute_all_tabs || 'mute',
        keywords: ['mute', 'tabs', 'silence'],
        behavior: 'instant' as const,
        surface: 'website' as const,
        showInDashboard: true,
      },
      {
        id: 'unmute_all_tabs',
        label: 'Unmute All Tabs',
        prefix: (customPrefixes as any)?.unmute_all_tabs || 'unmute',
        keywords: ['unmute', 'tabs', 'sound'],
        behavior: 'instant' as const,
        surface: 'website' as const,
        showInDashboard: true,
      },
    ];
    const virtualCommandMap = new Map(virtualCommands.map(v => [v.id, v]));
    const filteredLocalCommands = (localData.commands || []).filter(c => !virtualCommandMap.has(c.id));
    localData.commands = [...filteredLocalCommands, ...virtualCommands];

    cachedState = { localData, customPrefixes };
    isCacheReady = true;
    return cachedState;
  } finally {
    activeFetchPromise = null;
  }
}

async function warmCache(): Promise<ResolvedOmniboxState> {
  if (!activeFetchPromise) {
    activeFetchPromise = fetchAndApplyState();
  }
  return activeFetchPromise;
}

async function getResolvedOmniboxState({ forceFresh = false } = {}): Promise<ResolvedOmniboxState> {
  if (isCacheReady && !forceFresh) {
    return cachedState;
  }
  return warmCache();
}

chrome.runtime.onMessage.addListener(message => {
  if (
    message.action === 'INVALIDATE_OMNIBOX_CACHE' ||
    message.action === 'DATA_CHANGED' ||
    (message.action === 'db_changed' && message.table === 'prefixSettings')
  ) {
    isCacheReady = false;
    warmCache();
  }
});

function normalizeOmniboxKey(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export function isSameSnippetIdentity(left: any, right: any): boolean {
  const leftId = normalizeOmniboxKey(left);
  const rightId = normalizeOmniboxKey(right);
  if (!leftId || !rightId) return false;

  if (leftId === rightId) return true;

  const leftSnippetId = extractSnippetId(leftId);
  const rightSnippetId = extractSnippetId(rightId);
  return leftSnippetId === rightSnippetId || leftSnippetId === rightId || leftId === rightSnippetId;
}

type LooseMatchKind =
  | 'shortcut'
  | 'note'
  | 'link'
  | 'command'
  | 'collection'
  | 'prompt'
  | 'automation'
  | 'agent'
  | 'todo'
  | 'snippet';
type LooseMatchCandidate = {
  kind: LooseMatchKind;
  rank: number;
  content: string;
  description: string;
  titleKey: string;
  target: any;
};

type OmniboxLocalData = {
  links: any[];
  notes: any[];
  commands: CommandRecord[];
  sessions: SessionRecord[];
  widgetViews?: WidgetViewRecord[];
  userShortcuts: any[];
  aiPrompts?: AiPromptRecord[];
  chatAgents?: ChatAgentRecord[];
  automations?: AutomationRecord[];
  snippets?: SnippetRecord[];
  todos?: TodoRecord[];
  prefixSettings?: PrefixSettingRecord[];
  workspaces?: any[];
};

type ResolvedOmniboxState = {
  localData: OmniboxLocalData;
  customPrefixes: CustomOmniboxPrefixes | null;
};

const normalizeSearchText = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase();


const rankByQuery = (value: string, query: string): number | null => {
  const normalizedValue = normalizeSearchText(value);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedValue || !normalizedQuery) return null;

  // Tier 0: Exact match
  if (normalizedValue === normalizedQuery) return 0;

  // Tier 1: Starts with query
  if (normalizedValue.startsWith(normalizedQuery)) return 1;

  // Tier 2: Word-boundary match (e.g. "cap" matches "Capture Screenshot")
  const words = normalizedValue.split(/[\s\-_]+/);
  if (words.some(word => word.startsWith(normalizedQuery))) return 2;

  // Tier 3: Substring match (works for ALL query lengths, including 1-char)
  if (normalizedValue.includes(normalizedQuery)) return 3;

  // Tier 4: All characters present in order — fuzzy subsequence
  // (e.g. "cfs" matches "Capture Full Screenshot")
  let qi = 0;
  for (let i = 0; i < normalizedValue.length && qi < normalizedQuery.length; i++) {
    if (normalizedValue[i] === normalizedQuery[qi]) qi++;
  }
  if (qi === normalizedQuery.length) return 4;

  return null;
};

const bestRankByQuery = (query: string, ...values: string[]) => {
  const ranks = values.map(value => rankByQuery(value, query)).filter((rank): rank is number => rank !== null);

  return ranks.length > 0 ? Math.min(...ranks) : null;
};

const getAssignedCommandIds = (userShortcuts: any[]) =>
  new Set(
    (userShortcuts || [])
      .filter((shortcut: any) => getShortcutTargetType(shortcut) === 'command')
      .map((shortcut: any) => String(shortcut.referenceId || '')),
  );

const getSessionSearchTitle = (session: SessionRecord | null | undefined) => String(session?.title || '').trim();

const getCollectionSearchTitle = (view: WidgetViewRecord | null | undefined) =>
  String(view?.title || '').trim();

const getCollectionSuggestionContent = (prefix: string, viewId: string) =>
  `${prefix} ${SESSION_SUGGESTION_ID_PREFIX}${viewId}`;


const collectIdentityKeys = (...values: any[]) => {
  const keys = new Set<string>();
  values.forEach(value => {
    const normalized = normalizeOmniboxKey(value);
    if (!normalized) return;
    keys.add(normalized);
    keys.add(extractSnippetId(normalized).toLowerCase());
  });
  return keys;
};

const getItemIdentityKeys = (item: any) =>
  collectIdentityKeys(
    item?.id,
    item?.snippet_id,
    item?.note_id,
    item?.link_id,
    item?.session_id,
    item?.automation_id,
    item?.chat_agent_id,
    item?.todo_id,
    item?.prompt_id,
  );

const getShortcutTargetIdentityKeys = (shortcut: any) =>
  collectIdentityKeys(shortcut?.referenceId, shortcut?.reference_id, shortcut?.targetId, shortcut?.target_id);

const normalizeOmniboxEntityType = (value: any): string => {
  const normalized = normalizeOmniboxKey(value).replace(/[\s-]+/g, '_');
  switch (normalized) {
    case 'collections':
    case 'dashboard_view':
    case 'dashboard_views':
    case 'widget_view':
    case 'widget_views':
      return 'collection';
    case 'notes':
      return 'note';
    case 'links':
      return 'link';
    case 'commands':
    case 'system':
    case 'system_command':
    case 'system_commands':
      return 'command';
    case 'prompts':
    case 'ai_prompt':
    case 'ai_prompts':
    case 'aiprompt':
    case 'aiprompts':
      return 'prompt';
    case 'automations':
      return 'automation';
    case 'agents':
    case 'chat_agent':
    case 'chat_agents':
      return 'agent';
    case 'todos':
      return 'todo';
    case 'snippets':
      return 'snippet';
    default:
      return normalized;
  }
};

const getShortcutTargetType = (shortcut: any) =>
  normalizeOmniboxEntityType(shortcut?.referenceType || shortcut?.reference_type || shortcut?.targetType || shortcut?.target_type);

const getLooseCandidateEntityType = (candidate: LooseMatchCandidate) =>
  candidate.kind === 'shortcut' ? getShortcutTargetType(candidate.target) : normalizeOmniboxEntityType(candidate.kind);

const getLooseCandidateEntityKeys = (candidate: LooseMatchCandidate) =>
  candidate.kind === 'shortcut' ? getShortcutTargetIdentityKeys(candidate.target) : getItemIdentityKeys(candidate.target);

const isSameLooseCandidateEntity = (left: LooseMatchCandidate, right: LooseMatchCandidate) => {
  const leftType = getLooseCandidateEntityType(left);
  const rightType = getLooseCandidateEntityType(right);
  if (!leftType || !rightType || leftType !== rightType) return false;

  const leftKeys = getLooseCandidateEntityKeys(left);
  const rightKeys = getLooseCandidateEntityKeys(right);
  if (leftKeys.size === 0 || rightKeys.size === 0) return false;

  for (const leftKey of leftKeys) {
    if (rightKeys.has(leftKey)) return true;
  }
  return false;
};

const shouldReplaceLooseCandidate = (existing: LooseMatchCandidate, next: LooseMatchCandidate) => {
  if (next.kind === 'shortcut' && existing.kind !== 'shortcut') return true;
  if (existing.kind === 'shortcut' && next.kind !== 'shortcut') return false;
  if (next.rank !== existing.rank) return next.rank < existing.rank;
  const nextTitleLength = String(next.titleKey || '').length;
  const existingTitleLength = String(existing.titleKey || '').length;
  return nextTitleLength > 0 && nextTitleLength < existingTitleLength;
};

const shouldHideItemBecauseShortcutExists = (item: any, shortcuts: any[], expectedType?: string) => {
  const itemKeys = getItemIdentityKeys(item);
  if (itemKeys.size === 0) return false;

  return shortcuts.some(shortcut => {
    const shortcutType = getShortcutTargetType(shortcut);
    const shortcutKeys = getShortcutTargetIdentityKeys(shortcut);
    if (shortcutKeys.size === 0) return false;

    const itemType = normalizeOmniboxEntityType(expectedType || item?.category || item?.type || item?.referenceType);
    if (shortcutType && itemType && shortcutType !== itemType) {
      return false;
    }

    for (const key of shortcutKeys) {
      if (itemKeys.has(key)) return true;
    }
    return false;
  });
};

const getSessionInitialUrls = (session: SessionRecord | null | undefined) =>
  (session?.urls || [])
    .map(item => item?.url)
    .filter((url): url is string => typeof url === 'string' && url.length > 0);

const getSessionInitialNames = (session: SessionRecord | null | undefined) =>
  (session?.urls || []).map(item => {
    if (typeof item?.name === 'string' && item.name.trim()) return item.name.trim();
    if (typeof item?.title === 'string' && item.title.trim()) return item.title.trim();
    return typeof item?.url === 'string' ? item.url : '';
  });

const resolveSessionIdFromQuery = (query: string) => {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery.toLowerCase().startsWith(SESSION_SUGGESTION_ID_PREFIX)) {
    return null;
  }

  return normalizedQuery.slice(SESSION_SUGGESTION_ID_PREFIX.length).trim() || null;
};

const findSessionByQuery = (query: string, sessions: SessionRecord[]) => {
  const directId = resolveSessionIdFromQuery(query);
  if (directId) {
    return sessions.find(session => String(session.id) === directId) || null;
  }

  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return null;

  return (
    sessions.find(session => normalizeSearchText(getSessionSearchTitle(session)) === normalizedQuery) ||
    sessions
      .map(session => ({ session, rank: rankByQuery(getSessionSearchTitle(session), normalizedQuery) }))
      .filter((entry): entry is { session: SessionRecord; rank: number } => entry.rank !== null)
      .sort(
        (a, b) => a.rank - b.rank || getSessionSearchTitle(a.session).length - getSessionSearchTitle(b.session).length,
      )[0]?.session ||
    null
  );
};

const findSessionByReferenceId = (referenceId: string, sessions: SessionRecord[]) => {
  const rawReferenceId = String(referenceId || '').trim();
  if (!rawReferenceId) return null;

  const extractedId = extractSnippetId(rawReferenceId);
  return (
    sessions.find(session => {
      const sessionId = String(session.id || '');
      return isSameSnippetIdentity(sessionId, rawReferenceId) || extractSnippetId(sessionId) === extractedId;
    }) || null
  );
};

const findCollectionViewByQuery = (query: string, widgetViews: WidgetViewRecord[]) => {
  const directId = resolveSessionIdFromQuery(query);
  if (directId) {
    return widgetViews.find(view => String(view.id) === directId) || null;
  }

  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return null;

  return (
    widgetViews.find(view => normalizeSearchText(getCollectionSearchTitle(view)) === normalizedQuery) ||
    widgetViews
      .map(view => ({ view, rank: rankByQuery(getCollectionSearchTitle(view), normalizedQuery) }))
      .filter((entry): entry is { view: WidgetViewRecord; rank: number } => entry.rank !== null)
      .sort(
        (a, b) => a.rank - b.rank || getCollectionSearchTitle(a.view).length - getCollectionSearchTitle(b.view).length,
      )[0]?.view ||
    null
  );
};

const findCollectionViewByReferenceId = (referenceId: string, widgetViews: WidgetViewRecord[]) => {
  const rawReferenceId = String(referenceId || '').trim();
  if (!rawReferenceId) return null;

  return widgetViews.find(view => String(view.id || '') === rawReferenceId) || null;
};

const findAiPromptByReferenceId = (referenceId: string, prompts: AiPromptRecord[]) =>
  prompts.find(prompt => isSameSnippetIdentity(prompt.id, referenceId)) || null;

const isShortcutOfType = (shortcut: any, referenceType: string) => {
  return getShortcutTargetType(shortcut) === normalizeOmniboxEntityType(referenceType);
};

const findAiPromptShortcutInvocation = (rawQuery: string, localData: OmniboxLocalData) => {
  const lowerQuery = rawQuery.toLowerCase();
  return (localData.userShortcuts || [])
    .map((shortcut: any) => {
      const referenceType = getShortcutTargetType(shortcut);
      if (referenceType !== 'prompt' && referenceType !== 'automation') return null;

      const trigger = normalizeShortcutTrigger(shortcut.trigger || '');
      if (!trigger || !lowerQuery.startsWith(trigger)) return null;
      if (lowerQuery.length > trigger.length && !/\s/.test(rawQuery.charAt(trigger.length))) return null;

      const promptRecord = findAiPromptByReferenceId(String(shortcut.referenceId || ''), localData.aiPrompts || []);
      if (!promptRecord) return null;

      return {
        shortcut,
        promptRecord,
        trigger,
        triggerLength: trigger.length,
        temporaryPrompt: rawQuery.slice(trigger.length).replace(/^\s+/, ''),
      };
    })
    .filter(
      (
        match,
      ): match is {
        shortcut: any;
        promptRecord: AiPromptRecord;
        trigger: string;
        triggerLength: number;
        temporaryPrompt: string;
      } => match !== null,
    )
    .sort((a, b) => b.triggerLength - a.triggerLength)[0] || null;
};

const findNoteShortcutUpdateInvocation = (
  rawQuery: string,
  localData: OmniboxLocalData,
  customPrefixes: CustomOmniboxPrefixes | null,
) => {
  const lowerQuery = rawQuery.toLowerCase();
  return (localData.userShortcuts || [])
    .map((shortcut: any) => {
      if (getShortcutTargetType(shortcut) !== 'note') return null;

      const trigger = normalizeShortcutTrigger(shortcut.trigger || '');
      if (!trigger || !lowerQuery.startsWith(trigger)) return null;
      const rawAfterTrigger = rawQuery.slice(trigger.length);
      if (!rawAfterTrigger || !/^\s/.test(rawAfterTrigger)) return null;

      const note = (localData.notes || []).find((candidate: any) => {
        const candidateId = candidate.id ?? candidate.note_id ?? '';
        return (
          isSameSnippetIdentity(candidateId, shortcut.referenceId) ||
          extractSnippetId(candidateId) === extractSnippetId(shortcut.referenceId)
        );
      });
      if (!note) return null;

      return {
        shortcut,
        note,
        trigger,
        triggerLength: trigger.length,
        fields: parseNoteQuickCreateFields(rawAfterTrigger.trimStart(), {
          prefixSettings: localData.prefixSettings || [],
          prefixes: customPrefixes,
        }),
      };
    })
    .filter(
      (
        match,
      ): match is {
        shortcut: any;
        note: NoteRecord;
        trigger: string;
        triggerLength: number;
        fields: ReturnType<typeof parseNoteQuickCreateFields>;
      } => match !== null,
    )
    .sort((a, b) => b.triggerLength - a.triggerLength)[0] || null;
};

const getNoteUpdateSuggestionText = (
  fields: ReturnType<typeof parseNoteQuickCreateFields>,
  localData: OmniboxLocalData,
  customPrefixes: CustomOmniboxPrefixes | null,
) => {
  const labels = getNoteQuickCreatePrefixLabels({
    prefixSettings: localData.prefixSettings || [],
    prefixes: customPrefixes,
  });
  if (!fields.description.trim()) return `${labels.description} append description`;
  if (!fields.tagNames.length) return `${labels.tag} tags`;
  return '';
};

const getDefaultWorkspaceId = (localData: OmniboxLocalData) =>
  String(localData.workspaces?.[0]?.id || localData.notes?.[0]?.workspaceId || '').trim() || undefined;

const getNoteCreateFieldHelpText = (
  localData: OmniboxLocalData,
  customPrefixes: CustomOmniboxPrefixes | null,
) => {
  const labels = getNoteQuickCreatePrefixLabels({
    prefixSettings: localData.prefixSettings || [],
    prefixes: customPrefixes,
  });
  return `title required; type ${labels.title} title, ${labels.description} description, ${labels.tag} work, client`;
};

const getNotePrefixLabel = (customPrefixes: CustomOmniboxPrefixes | null) =>
  String(customPrefixes?.note || STORED_DEFAULT_OMNIBOX_PREFIXES.note || 'n').trim() || 'n';

const getNoteCreateTitleRequiredDescription = (
  localData: OmniboxLocalData,
  customPrefixes: CustomOmniboxPrefixes | null,
) => {
  return formatSuggestionDescription(
    `Create Note <dim>- ${escapeXml(getNoteCreateFieldHelpText(localData, customPrefixes))}</dim>`,
    'Notes',
    getNotePrefixLabel(customPrefixes),
    true,
  );
};

const getNoteShortcutOpenDescription = (
  title: string,
  trigger: string,
  localData: OmniboxLocalData,
  customPrefixes: CustomOmniboxPrefixes | null,
) => {
  const fields = parseNoteQuickCreateFields('', {
    prefixSettings: localData.prefixSettings || [],
    prefixes: customPrefixes,
  });
  const nextHint = getNoteUpdateSuggestionText(fields, localData, customPrefixes);
  return formatSuggestionDescription(
    `${escapeXml(title)} <dim>- Type ${escapeXml(nextHint)}</dim>`,
    'Notes',
    trigger,
    true,
  );
};

const resolveTagIds = async (workspaceId: string | undefined, tagNames: string[], existingTagIds: string[] = []) => {
  const tagIds = Array.from(new Set(existingTagIds.map(id => String(id || '').trim()).filter(Boolean)));
  if (!workspaceId) return tagIds;

  for (const tagName of tagNames) {
    const tag = await createTag(tagName, workspaceId);
    if (tag?.id && !tagIds.includes(tag.id)) {
      tagIds.push(tag.id);
    }
  }

  return tagIds;
};

const createNoteFromOmniboxFields = async (
  fields: ReturnType<typeof parseNoteQuickCreateFields>,
  localData: OmniboxLocalData,
) => {
  const title = fields.title.trim();
  if (!title) throw new Error('Note title is required.');

  const workspaceId = getDefaultWorkspaceId(localData);
  const note = await createNote({
    workspaceId,
    title,
    body: buildQuickCreateNoteBodyHtml(fields.description),
    tagIds: [],
  });
  const tagIds = await resolveTagIds(note.workspaceId, fields.tagNames);
  return tagIds.length > 0 ? updateNote(note.id, { tagIds }) : note;
};

const updateNoteFromOmniboxFields = async (
  note: NoteRecord,
  fields: ReturnType<typeof parseNoteQuickCreateFields>,
) => {
  const appendDescription = fields.description.trim();
  const tagIds = await resolveTagIds(note.workspaceId, fields.tagNames, note.tagIds || []);
  const input: any = {};

  if (appendDescription) {
    input.body = appendNoteBodyHtml(note.body || '', appendDescription);
  }
  if (fields.tagNames.length > 0) {
    input.tagIds = tagIds;
  }

  if (Object.keys(input).length === 0) {
    throw new Error('No note update fields provided.');
  }

  return updateNote(note.id, input);
};

export function buildLooseCandidates(
  query: string,
  state: OmniboxLocalData,
  customPrefixes: CustomOmniboxPrefixes | null = null,
): LooseMatchCandidate[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  const candidates: LooseMatchCandidate[] = [];
  const assignedCommandIds = getAssignedCommandIds(state.userShortcuts || []);
  const prefixMap = { ...STORED_DEFAULT_OMNIBOX_PREFIXES, ...(customPrefixes || {}) };

  const matchingShortcuts: any[] = [];
  for (const shortcut of state.userShortcuts || []) {
    const trigger = normalizeShortcutTrigger(shortcut.trigger || '');
    const rank = rankByQuery(trigger, normalizedQuery);
    if (rank === null) continue;

    const effectiveReferenceType = getShortcutTargetType(shortcut);
    const normalizedReferenceType = effectiveReferenceType;
    const promptTarget = findAiPromptByReferenceId(String(shortcut.referenceId || ''), state.aiPrompts || []);
    const isAiPromptShortcut =
      ['prompt', 'aiprompt', 'ai_prompt'].includes(normalizedReferenceType) ||
      (normalizedReferenceType === 'automation' && !!promptTarget);

    const targetTitle =
      isAiPromptShortcut
        ? promptTarget?.title || shortcut.targetLabelSnapshot || shortcut.label || trigger
        : effectiveReferenceType === 'note'
        ? (state.notes || []).find((n: any) => {
            const nid = n.id ?? '';
            return isSameSnippetIdentity(nid, shortcut.referenceId);
          })?.title || 'Untitled Note'
        : effectiveReferenceType === 'link'
          ? (state.links || []).find((l: any) => {
              const lid = l.id ?? l.snippet_id ?? '';
              return isSameSnippetIdentity(lid, shortcut.referenceId);
            })?.title || 'Untitled Link'
          : effectiveReferenceType === 'collection'
            ? findCollectionViewByReferenceId(String(shortcut.referenceId || ''), state.widgetViews || [])?.title ||
              'Untitled Collection'
            : effectiveReferenceType === 'command'
              ? (state.commands || []).find(
                  (command: any) => String(command.id || '') === String(shortcut.referenceId || ''),
                )?.label ||
                shortcut.referenceId ||
                'Untitled Command'
              : 'Untitled';
    const isCommandShortcut = effectiveReferenceType === 'command';

    let targetCategory = 'Shortcuts';
    if (effectiveReferenceType === 'note') { targetCategory = 'Notes'; }
    else if (effectiveReferenceType === 'link') { targetCategory = 'Links'; }
    else if (effectiveReferenceType === 'collection') { targetCategory = 'Collections'; }
    else if (effectiveReferenceType === 'command') { targetCategory = 'System'; }
    else if (isAiPromptShortcut) { targetCategory = 'AI Prompts'; }

    candidates.push({
      kind: 'shortcut',
      rank: rank + (isCommandShortcut ? -30 : 0),
      content: `[Command] ${trigger}`,
      description: effectiveReferenceType === 'note'
        ? getNoteShortcutOpenDescription(targetTitle, trigger, state, customPrefixes)
        : formatSuggestionDescription(targetTitle, targetCategory, trigger),
      titleKey: targetTitle,
      target: shortcut,
    });
    matchingShortcuts.push(shortcut);
  }

  for (const note of state.notes || []) {
    const title = String(note.title || '').trim();
    const rank = rankByQuery(title, normalizedQuery);
    if (rank === null) continue;
    if (shouldHideItemBecauseShortcutExists(note, matchingShortcuts, 'note')) continue;

    candidates.push({
      kind: 'note',
      rank: rank + 10,
      content: `[Note] ${title}`,
      description: formatSuggestionDescription(title || note.id || 'Untitled', 'Notes', prefixMap.note || 'n'),
      titleKey: title,
      target: note,
    });
  }

  for (const link of state.links || []) {
    const title = String(link.title || '').trim();
    const rank = rankByQuery(title, normalizedQuery);
    if (rank === null) continue;
    if (shouldHideItemBecauseShortcutExists(link, matchingShortcuts, 'link')) continue;

    candidates.push({
      kind: 'link',
      rank: rank + 10,
      content: `[Link] ${title}`,
      description: formatSuggestionDescription(title || link.id || 'Untitled', 'Links', prefixMap.link || 'l'),
      titleKey: title,
      target: link,
    });
  }

  for (const command of (state.commands || []).filter(isOmniboxVisibleCommand)) {
    const label = String(command.label || '').trim();
    const prefix = String(command.prefix || '').trim();
    const id = String(command.id || '').trim();
    const rank = bestRankByQuery(normalizedQuery, label, prefix, id);
    if (rank === null || rank === undefined) continue;
    if (shouldHideItemBecauseShortcutExists(command, matchingShortcuts, 'command')) continue;
    const hasAssignedShortcut = assignedCommandIds.has(id);

    candidates.push({
      kind: 'command',
      rank: rank + (hasAssignedShortcut ? 15 : 30),
      content: `[Command] ${label || id}`,
      description: formatSuggestionDescription(label || id, 'System', command.prefix || 'c'),
      titleKey: label || id,
      target: command,
    });
  }

  for (const view of state.widgetViews || []) {
    const title = getCollectionSearchTitle(view);
    const rank = rankByQuery(title, normalizedQuery);
    if (rank === null) continue;
    if (shouldHideItemBecauseShortcutExists(view, matchingShortcuts, 'collection')) continue;

    candidates.push({
      kind: 'collection',
      rank: rank + 10,
      content: `[Collection] ${title}`,
      description: formatSuggestionDescription(
        title || view.id || 'Untitled Collection',
        'Collections',
        prefixMap.collection || 'co',
      ),
      titleKey: title,
      target: view,
    });
  }

  const typeBuckets: Array<{
    kind: 'prompt' | 'automation' | 'agent' | 'todo' | 'snippet';
    label: string;
    items: any[];
  }> = [
    { kind: 'prompt', label: 'Prompt', items: state.aiPrompts || [] },
    { kind: 'automation', label: 'Automation', items: state.automations || [] },
    { kind: 'agent', label: 'Agent', items: state.chatAgents || [] },
    { kind: 'todo', label: 'Todo', items: state.todos || [] },
    { kind: 'snippet', label: 'Snippet', items: state.snippets || [] },
  ];

  for (const bucket of typeBuckets) {
    for (const item of bucket.items || []) {
      const title = String(item?.title || item?.name || item?.label || '').trim();
      const rank = rankByQuery(title, normalizedQuery);
      if (rank === null) continue;
      if (shouldHideItemBecauseShortcutExists(item, matchingShortcuts, bucket.kind)) continue;

      const bucketPrefixMap: Record<string, string> = {
        prompt: prefixMap.prompt || 'p',
        agent: prefixMap.agent || 'g',
        todo: prefixMap.todo || 't',
        snippet: prefixMap.snippet || 'sn',
      };
      const prefix = bucketPrefixMap[bucket.kind] || '';

      candidates.push({
        kind: bucket.kind,
        rank: rank + 10,
        content: `[${bucket.label}] ${title}`,
        description: formatSuggestionDescription(title || item?.id || 'Untitled', bucket.label + 's', prefix),
        titleKey: title,
        target: item,
      });
    }
  }

  // Deduplicate by backing entity, not by displayed label. A shortcut and its target entity
  // should appear once, while two different entities with the same title should both remain.
  const uniqueCandidates: LooseMatchCandidate[] = [];
  for (const candidate of candidates) {
    const duplicateIndex = uniqueCandidates.findIndex(existing => isSameLooseCandidateEntity(existing, candidate));
    if (duplicateIndex >= 0) {
      if (shouldReplaceLooseCandidate(uniqueCandidates[duplicateIndex], candidate)) {
        uniqueCandidates[duplicateIndex] = candidate;
      }
      continue;
    }

    const fallbackKey = `${candidate.kind}:${String(candidate.titleKey || '').trim().toLowerCase()}`;
    const fallbackDuplicateIndex = uniqueCandidates.findIndex(existing => {
      if (getLooseCandidateEntityKeys(existing).size > 0 || getLooseCandidateEntityKeys(candidate).size > 0) {
        return false;
      }
      return `${existing.kind}:${String(existing.titleKey || '').trim().toLowerCase()}` === fallbackKey;
    });
    if (fallbackDuplicateIndex >= 0) {
      if (shouldReplaceLooseCandidate(uniqueCandidates[fallbackDuplicateIndex], candidate)) {
        uniqueCandidates[fallbackDuplicateIndex] = candidate;
      }
      continue;
    }

    uniqueCandidates.push(candidate);
  }

  uniqueCandidates.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    // Tiebreak: prefer shorter titles, then more recently modified
    if (a.titleKey.length !== b.titleKey.length) return a.titleKey.length - b.titleKey.length;
    const aTime = a.target?.updatedAt || a.target?.createdAt || 0;
    const bTime = b.target?.updatedAt || b.target?.createdAt || 0;
    return bTime - aTime; // More recent first
  });

  return uniqueCandidates;
}

type LooseCandidateHandlers = {
  executeShortcut: (shortcut: any) => boolean;
  executeCollectionView: (view: WidgetViewRecord) => boolean;
  openNote: (noteId: string) => void;
  openUrls: (urls: string[]) => void;
  openEntitySearch: (type: 'collection' | 'prompt' | 'automation' | 'agent' | 'todo' | 'snippet', query: string) => void;
  executeCommand: (command: CommandRecord) => void;
};

export function runLooseCandidates(candidates: LooseMatchCandidate[], handlers: LooseCandidateHandlers): boolean {
  for (const candidate of candidates) {
    if (candidate.kind === 'shortcut') {
      if (handlers.executeShortcut(candidate.target)) {
        return true;
      }
      continue;
    }

    if (candidate.kind === 'note') {
      handlers.openNote(candidate.target.id);
      return true;
    }

    if (candidate.kind === 'collection') {
      if (handlers.executeCollectionView(candidate.target as WidgetViewRecord)) {
        return true;
      }
      continue;
    }

    if (candidate.kind === 'link') {
      const urls = extractUrls(candidate.target);
      if (urls.length > 0) {
        handlers.openUrls(urls);
        return true;
      }
      continue;
    }

    if (
      candidate.kind === 'prompt' ||
      candidate.kind === 'automation' ||
      candidate.kind === 'agent' ||
      candidate.kind === 'todo' ||
      candidate.kind === 'snippet'
    ) {
      const title = String(
        candidate.target?.title || candidate.target?.name || candidate.target?.label || candidate.target?.id || '',
      ).trim();
      if (title) {
        handlers.openEntitySearch(candidate.kind, title);
        return true;
      }
      continue;
    }

    if (candidate.kind === 'command') {
      handlers.executeCommand(candidate.target as CommandRecord);
      return true;
    }
  }

  return false;
}

/**
 * Builds the omnibox hint string dynamically from the user's actual registry.
 * E.g. "like c, n, l, df, sn, p, a, g, t" — uses real user-configured prefixes.
 */
function buildDynamicHint(registry: Record<string, string>): string {
  // Ordered list of types to show in the hint
  const typeOrder: Array<'note' | 'link' | 'collection' | 'snippet' | 'prompt' | 'automation' | 'agent' | 'todo'> = [
    'note', 'link', 'collection', 'snippet', 'prompt', 'automation', 'agent', 'todo',
  ];

  const prefixParts: string[] = [];
  for (const type of typeOrder) {
    const key = Object.keys(registry).find(k => registry[k] === type);
    if (key) prefixParts.push(key);
  }

  const examplePrefixes = prefixParts.join(', ');
  return `cmdOS: <match>Press Space</match> to browse commands, or type a prefix (like ${examplePrefixes})`;
}

// ─── Concurrency guard ────────────────────────────────────────────────────────
// Monotonically increasing counter. Every onInputChanged listener call increments
// this. When an async suggestion function resolves, it checks whether its captured
// generation is still the latest. If not, the result is stale and discarded.
let suggestionGeneration = 0;

// Maximum number of suggestions to pass to Chrome's suggest() callback.
// Chrome only displays ~5-8 suggestions, so sending more wastes memory.
const MAX_OMNIBOX_RESULTS = 10;

// ─── Suggestion Registry Map (Phase 3) ────────────────────────────────────────
// Maps clean human-readable suggestion content to the corresponding execution target.
// Keyed by lowercase content string. This avoids the ugly visual encoding leaks
// in the Chrome URL bar when navigating dropdown suggestions using arrow keys.
const lastSuggestionMap = new Map<
  string,
  | { kind: 'command'; target: CommandRecord; prompt?: string }
  | { kind: 'shortcut'; target: any; temporaryPrompt?: string; linkQueryInput?: string; openBehavior?: any }
  | { kind: 'note_create'; fields: ReturnType<typeof parseNoteQuickCreateFields> }
  | { kind: 'note_update'; target: NoteRecord; fields: ReturnType<typeof parseNoteQuickCreateFields>; trigger: string }
  | { kind: 'note'; target: string }
  | { kind: 'link'; target: string[] }
  | { kind: 'collection'; target: WidgetViewRecord; openBehavior?: any }
  | { kind: 'entity_search'; type: string; query: string }
>();

function registerSuggestion(
  content: string,
  entry:
    | { kind: 'command'; target: CommandRecord; prompt?: string }
    | { kind: 'shortcut'; target: any; temporaryPrompt?: string; linkQueryInput?: string; openBehavior?: any }
    | { kind: 'note_create'; fields: ReturnType<typeof parseNoteQuickCreateFields> }
    | { kind: 'note_update'; target: NoteRecord; fields: ReturnType<typeof parseNoteQuickCreateFields>; trigger: string }
    | { kind: 'note'; target: string }
    | { kind: 'link'; target: string[] }
    | { kind: 'collection'; target: WidgetViewRecord; openBehavior?: any }
    | { kind: 'entity_search'; type: string; query: string }
): string {
  let clean = content.trim();
  let testKey = clean.toLowerCase();
  let suffix = 2;
  while (lastSuggestionMap.has(testKey)) {
    clean = `${content.trim()} (${suffix})`;
    testKey = clean.toLowerCase();
    suffix++;
  }
  lastSuggestionMap.set(testKey, entry);
  return clean;
}

export function setupOmnibox() {
  // Set a placeholder hint immediately (before cache loads). Updated dynamically once cache is ready.
  chrome.omnibox.setDefaultSuggestion({
    description: 'cmdOS: <match>Press Space</match> to browse, or type a prefix to filter by category',
  });

  // Pre-warm cache immediately when the service worker starts (before user even opens omnibox)
  warmCache();

  // Re-warm on each activation to pick up any data changes, then update hint with real prefixes.
  // IMPORTANT: We do NOT set isCacheReady = false here. The old cache is served instantly for
  // the current session while a background refresh loads new data for subsequent keystrokes.
  // This eliminates the delay window where keystrokes pile up waiting for IndexedDB.
  chrome.omnibox.onInputStarted.addListener(() => {
    const startGeneration = suggestionGeneration;
    warmCache().then(({ localData, customPrefixes }) => {
      if (startGeneration !== suggestionGeneration) return;
      const registry = buildRegistry(localData.commands || [], customPrefixes);
      chrome.omnibox.setDefaultSuggestion({
        description: buildDynamicHint(registry),
      });
    });
    // Trigger a background refresh so new data is ready for the next keystroke
    fetchAndApplyState();
  });

  // ── onInputChanged: load from cache with promise fallback ────────────────
  chrome.omnibox.onInputChanged.addListener((text, suggest) => {
    // Capture generation at the moment this keystroke fires.
    // If a newer keystroke arrives while we're awaiting, this becomes stale.
    const myGeneration = ++suggestionGeneration;

    // Clear mapping cache for the new query input
    lastSuggestionMap.clear();

    // Staleness-guarded suggest: silently discards results if a newer keystroke
    // has already fired. This eliminates the "dispensary" flickering effect.
    const safeSuggest = (results: chrome.omnibox.SuggestResult[]) => {
      if (myGeneration !== suggestionGeneration) return;
      suggest(results.slice(0, MAX_OMNIBOX_RESULTS));
    };

    const safeSetDefault = (description: string) => {
      if (myGeneration !== suggestionGeneration) return;
      chrome.omnibox.setDefaultSuggestion({ description });
    };

    const runSuggestions = async () => {
      const { localData, customPrefixes } = await getResolvedOmniboxState();

      // STALENESS CHECK: If a newer keystroke fired while we were awaiting,
      // discard this entire computation silently — it's outdated.
      if (myGeneration !== suggestionGeneration) return;

      const registry = buildRegistry(localData.commands || [], customPrefixes);
      const { prefix, type, query } = parseInput(text, registry);


      // No recognised prefix yet — show navigation hint or match prefix-less shortcuts
      if (!type) {
        const rawText = text.replace(/\u00A0/g, ' ');
        const trimmedText = text.trim();
        if (trimmedText === '') {
          // Update hint with real user prefixes then show command list
          safeSetDefault(buildDynamicHint(registry));
          handleTypedInput('', 'command', '', safeSuggest, localData, customPrefixes, undefined, safeSetDefault);
          return;
        }

        // Guard: if the text matches a known prefix exactly (user still typing, no space yet),
        // treat it as entering that mode with empty query — avoids incorrect loose/global matches.
        const lowerTrimmedText = trimmedText.toLowerCase();
        const matchedPrefix = Object.keys(registry).find(k => k.toLowerCase() === lowerTrimmedText);
        if (matchedPrefix) {
          handleTypedInput(matchedPrefix, registry[matchedPrefix] as any, '', safeSuggest, localData, customPrefixes, undefined, safeSetDefault);
          return;
        }

        const normalizedText = normalizeShortcutTrigger(trimmedText);
        if (!normalizedText) {
          safeSuggest([]);
          return;
        }

        const noteUpdateInvocation = findNoteShortcutUpdateInvocation(rawText, localData, customPrefixes);
        if (noteUpdateInvocation) {
          const nextHint = getNoteUpdateSuggestionText(noteUpdateInvocation.fields, localData, customPrefixes);
          const noteTitle = noteUpdateInvocation.note.title || 'Untitled Note';
          const detail = noteUpdateInvocation.fields.description.trim()
            ? `append: ${noteUpdateInvocation.fields.description.trim()}`
            : nextHint
              ? `Type ${nextHint}`
              : 'ready to update';
          const description = formatSuggestionDescription(
            `${escapeXml(noteTitle)} <dim>- ${escapeXml(detail)}</dim>`,
            'Notes',
            noteUpdateInvocation.trigger,
            true,
          );
          safeSetDefault(description);
          safeSuggest([]);
          return;
        }

        const promptInvocation = findAiPromptShortcutInvocation(trimmedText, localData);
        if (promptInvocation && promptInvocation.temporaryPrompt) {
          const title =
            promptInvocation.promptRecord.title || promptInvocation.promptRecord.id || promptInvocation.trigger;
          safeSetDefault(
            formatSuggestionDescription(
              `${escapeXml(title)} <dim>- prompt: <match>${escapeXml(promptInvocation.temporaryPrompt)}</match></dim>`,
              'AI Prompts',
              promptInvocation.trigger,
              true,
            ),
          );
          safeSuggest([]);
          return;
        }

        const looseCandidates = buildLooseCandidates(normalizedText, localData, customPrefixes);

        if (looseCandidates.length > 0) {
          const suggestions = looseCandidates.map((candidate) => {
            const content = `${trimmedText} > ${candidate.content}`;
            let entry: any;
            if (candidate.kind === 'shortcut') {
              entry = { kind: 'shortcut', target: candidate.target };
            } else if (candidate.kind === 'note') {
              entry = { kind: 'note', target: candidate.target.id };
            } else if (candidate.kind === 'collection') {
              entry = { kind: 'collection', target: candidate.target };
            } else if (candidate.kind === 'link') {
              entry = { kind: 'link', target: extractUrls(candidate.target) };
            } else if (['prompt', 'automation', 'agent', 'todo', 'snippet'].includes(candidate.kind)) {
              const title = String(candidate.target?.title || candidate.target?.name || candidate.target?.label || candidate.target?.id || '').trim();
              entry = { kind: 'entity_search', type: candidate.kind, query: title };
            } else if (candidate.kind === 'command') {
              entry = { kind: 'command', target: candidate.target };
            }
            const cleanContent = registerSuggestion(content, entry);
            return {
              content: cleanContent,
              description: candidate.description,
            };
          });
          safeSetDefault(suggestions[0].description);
          safeSuggest(suggestions.slice(1));
          return;
        }

        safeSuggest([]);
        return;
      }

      handleTypedInput(prefix, type, query, safeSuggest, localData, customPrefixes, text, safeSetDefault);
    };

    void runSuggestions();
  });

  // Extract the main suggestion logic to a separate helper function
  function handleTypedInput(
    prefix: string,
    type: 'note' | 'link' | 'command' | 'collection' | 'prompt' | 'automation' | 'agent' | 'todo' | 'snippet',
    query: string,
    suggest: (suggestResults: chrome.omnibox.SuggestResult[]) => void,
    localData: OmniboxLocalData,
    customPrefixes: CustomOmniboxPrefixes | null,
    rawText?: string,
    setDefault?: (description: string) => void,
  ) {
    const applyDefault = (description: string) => {
      if (setDefault) {
        setDefault(description);
      } else {
        chrome.omnibox.setDefaultSuggestion({ description });
      }
    };

    // ── Notes / Links ──────────────────────────────────────────────────────
    if (type === 'link' || type === 'note') {
      if (query.trim() === '') {
        const allItems: any[] = type === 'link' ? localData.links || [] : localData.notes || [];
        const prefixChar = prefix;
        const noteCreateDescription = type === 'note'
          ? getNoteCreateTitleRequiredDescription(localData, customPrefixes)
          : null;

        // User-assigned shortcuts for this type — shown first
        const emptyShortcuts = (localData.userShortcuts || []).filter(
          (s: any) => getShortcutTargetType(s) === normalizeOmniboxEntityType(type),
        );

        // Items that don't have a shortcut assigned
        const itemsWithoutShortcut = allItems.filter(
          (item: any) => !shouldHideItemBecauseShortcutExists(item, emptyShortcuts, type),
        );

        const allSuggestions: Array<{ content: string; description: string }> = [
          ...emptyShortcuts.map((s: any) => {
            const refUuid = extractSnippetId(s.referenceId);
            let targetTitle = 'Untitled';
            const foundItem = allItems.find((item: any) => {
              const itemId = item.id ?? item.snippet_id ?? '';
              return isSameSnippetIdentity(itemId, s.referenceId) || extractSnippetId(itemId) === refUuid;
            });
            if (foundItem) targetTitle = foundItem.title || 'Untitled';
            const trigger = normalizeShortcutTrigger(s.trigger || '');
            const content = `${prefixChar} ${trigger}`;
            const cleanContent = registerSuggestion(content, { kind: 'shortcut', target: s });
            return {
              content: cleanContent,
              description: formatSuggestionDescription(targetTitle, type === 'link' ? 'Links' : 'Notes', trigger),
            };
          }),
          ...itemsWithoutShortcut.slice(0, 40).map((item: any) => {
            const content = `${prefixChar} ${item.title || ''}`;
            const entry = type === 'link'
              ? { kind: 'link' as const, target: extractUrls(item) }
              : { kind: 'note' as const, target: item.id };
            const cleanContent = registerSuggestion(content, entry);
            return {
              content: cleanContent,
              description: formatSuggestionDescription(item.title || item.id || 'Untitled', type === 'link' ? 'Links' : 'Notes', prefixChar),
            };
          }),
        ];

        if (noteCreateDescription) {
          applyDefault(noteCreateDescription);
          suggest(allSuggestions.slice(0, MAX_OMNIBOX_RESULTS));
        } else if (allSuggestions.length > 0) {
          applyDefault(allSuggestions[0].description);
          suggest(allSuggestions.slice(1));
        } else {
          applyDefault(`No ${type}s saved yet`);
          suggest([]);
        }
        return;
      }

      const allItems: any[] = type === 'link' ? localData.links || [] : localData.notes || [];

      if (type === 'note') {
        const createFields = parseNoteQuickCreateFields(query, {
          prefixSettings: localData.prefixSettings || [],
          prefixes: customPrefixes,
        });
        if (createFields.hasCreateIntent || query.trim().startsWith('-')) {
          const title = createFields.title.trim();
          const detail = title
            ? [
                `title: ${title}`,
                createFields.description ? `description: ${createFields.description}` : null,
                createFields.tagNames.length > 0 ? `tags: ${createFields.tagNames.join(', ')}` : null,
              ]
                .filter(Boolean)
                .join(', ')
            : getNoteCreateFieldHelpText(localData, customPrefixes);
          const description = formatSuggestionDescription(
            `Create Note <dim>- ${escapeXml(detail)}</dim>`,
            'Notes',
            getNotePrefixLabel(customPrefixes),
            true,
          );
          applyDefault(description);
          suggest([]);
          return;
        }
      }

      const rawTitleMatches: any[] = allItems
        .map(item => ({ item, rank: rankByQuery(item.title || '', query) }))
        .filter((entry): entry is { item: any; rank: number } => entry.rank !== null)
        .sort((a, b) => a.rank - b.rank || String(a.item.title || '').length - String(b.item.title || '').length)
        .map(entry => entry.item);

      // Match user shortcuts for this type
      const shortcutMatches = (localData.userShortcuts || [])
        .map((s: any) => ({
          shortcut: s,
          rank: rankByQuery(s.trigger || '', query),
        }))
        .filter(
          (entry): entry is { shortcut: any; rank: number } =>
            getShortcutTargetType(entry.shortcut) === normalizeOmniboxEntityType(type) && entry.rank !== null,
        )
        .sort(
          (a, b) =>
            a.rank - b.rank || String(a.shortcut.trigger || '').length - String(b.shortcut.trigger || '').length,
        )
        .map(entry => entry.shortcut);

      // De-duplicate: each item appears exactly once (as shortcut if it has one, otherwise as title)
      const titleMatches = rawTitleMatches.filter(
        (item: any) => !shouldHideItemBecauseShortcutExists(item, shortcutMatches, type),
      );

      if (titleMatches.length === 0 && shortcutMatches.length === 0) {
        applyDefault(query ? `No ${type}s found matching <match>${query}</match>` : `No ${type}s saved yet`);
        suggest([]);
        return;
      }

      const prefixChar = prefix || (type === 'link' ? 'l' : 'n');

      const allSuggestions: Array<{ content: string; description: string }> = [
        // Shortcuts first (ranked higher)
        ...shortcutMatches.map((s: any) => {
          const refUuid = extractSnippetId(s.referenceId);
          let targetTitle = 'Untitled';
          if (getShortcutTargetType(s) === 'note') {
            const note = (localData.notes || []).find((n: any) => {
              const nid = n.id ?? '';
              return isSameSnippetIdentity(nid, s.referenceId) || extractSnippetId(nid) === refUuid;
            });
            if (note) targetTitle = note.title || 'Untitled Note';
          } else if (getShortcutTargetType(s) === 'link') {
            const link = (localData.links || []).find((l: any) => {
              const lid = l.id ?? l.snippet_id ?? '';
              return isSameSnippetIdentity(lid, s.referenceId) || extractSnippetId(lid) === refUuid;
            });
            if (link) targetTitle = link.title || 'Untitled Link';
          }
          const content = `${prefixChar} ${normalizeShortcutTrigger(s.trigger || '')}`;
          const cleanContent = registerSuggestion(content, { kind: 'shortcut', target: s });
          return {
            content: cleanContent,
            description: formatSuggestionDescription(targetTitle, type === 'link' ? 'Links' : 'Notes', normalizeShortcutTrigger(s.trigger || '')),
          };
        }),
        // Then items without shortcuts (no duplicates)
        ...titleMatches.map((item: any) => {
          const content = `${prefixChar} ${item.title || ''}`;
          const entry = type === 'link'
            ? { kind: 'link' as const, target: extractUrls(item) }
            : { kind: 'note' as const, target: item.id };
          const cleanContent = registerSuggestion(content, entry);
          return {
            content: cleanContent,
            description: formatSuggestionDescription(item.title || item.id || 'Untitled', type === 'link' ? 'Links' : 'Notes', prefixChar),
          };
        }),
      ];

      if (allSuggestions.length > 0) {
        applyDefault(allSuggestions[0].description);
      }
      suggest(allSuggestions.slice(1));
      return;
    }

    // ── Commands ─────────────────────────────────────────────────────────
    if (type === 'collection') {
      if (query.trim() === '') {
        const collectionPrefix = prefix || 'co';
        // User-assigned collection shortcuts — shown first
        const emptyCollectionShortcuts = (localData.userShortcuts || []).filter(
          (s: any) => isShortcutOfType(s, 'collection'),
        );

        // Collections without a shortcut assigned
        const collectionsWithoutShortcut = (localData.widgetViews || []).filter(
          (view: WidgetViewRecord) => !shouldHideItemBecauseShortcutExists(view, emptyCollectionShortcuts, 'collection'),
        );

        const allSuggestions: Array<{ content: string; description: string }> = [
          ...emptyCollectionShortcuts.map((shortcut: any) => {
            const targetView = findCollectionViewByReferenceId(String(shortcut.referenceId || ''), localData.widgetViews || []);
            const collectionTitle = getCollectionSearchTitle(targetView) || 'Untitled Collection';
            const trigger = normalizeShortcutTrigger(shortcut.trigger || '');
            const content = `${collectionPrefix} ${trigger}`;
            const cleanContent = registerSuggestion(content, { kind: 'shortcut', target: shortcut });
            return {
              content: cleanContent,
              description: formatSuggestionDescription(collectionTitle, 'Collections', trigger),
            };
          }),
          ...collectionsWithoutShortcut.slice(0, 40).map((view: WidgetViewRecord) => {
            const content = `${collectionPrefix} ${getCollectionSearchTitle(view) || view.id}`;
            const cleanContent = registerSuggestion(content, { kind: 'collection', target: view });
            return {
              content: cleanContent,
              description: formatSuggestionDescription(getCollectionSearchTitle(view) || String(view.id || 'Untitled Collection'), 'Collections', collectionPrefix),
            };
          }),
        ];

        if (allSuggestions.length > 0) {
          applyDefault(allSuggestions[0].description);
          suggest(allSuggestions.slice(1));
        } else {
          applyDefault('No collections saved yet');
          suggest([]);
        }
        return;
      }

      const collectionMatches = (localData.widgetViews || [])
        .map((view: WidgetViewRecord) => ({
          view,
          rank: rankByQuery(getCollectionSearchTitle(view), query),
        }))
        .filter((entry): entry is { view: WidgetViewRecord; rank: number } => entry.rank !== null)
        .sort(
          (a, b) =>
            a.rank - b.rank || getCollectionSearchTitle(a.view).length - getCollectionSearchTitle(b.view).length,
        )
        .map(entry => entry.view);

      const shortcutMatches = (localData.userShortcuts || [])
        .map((s: any) => ({
          shortcut: s,
          rank: rankByQuery(s.trigger || '', query),
        }))
        .filter(
          (entry): entry is { shortcut: any; rank: number } =>
            isShortcutOfType(entry.shortcut, 'collection') && entry.rank !== null,
        )
        .sort(
          (a, b) =>
            a.rank - b.rank || String(a.shortcut.trigger || '').length - String(b.shortcut.trigger || '').length,
        )
        .map(entry => entry.shortcut);

      const titleMatches = collectionMatches.filter(
        (view: WidgetViewRecord) => !shouldHideItemBecauseShortcutExists(view, shortcutMatches, 'collection'),
      );

      if (titleMatches.length === 0 && shortcutMatches.length === 0) {
        applyDefault(`No collections found matching <match>${query}</match>`);
        suggest([]);
        return;
      }

      const collectionPrefix = prefix || 'co';
      const allSuggestions: Array<{ content: string; description: string }> = [
        ...shortcutMatches.map((shortcut: any) => {
          const targetView = findCollectionViewByReferenceId(String(shortcut.referenceId || ''), localData.widgetViews || []);
          const collectionTitle = getCollectionSearchTitle(targetView) || 'Untitled Collection';
          const content = `${collectionPrefix} ${normalizeShortcutTrigger(shortcut.trigger || '')}`;
          const cleanContent = registerSuggestion(content, { kind: 'shortcut', target: shortcut });
          return {
            content: cleanContent,
            description: formatSuggestionDescription(collectionTitle, 'Collections', normalizeShortcutTrigger(shortcut.trigger || '')),
          };
        }),
        ...titleMatches.map((view: WidgetViewRecord) => {
          const content = `${collectionPrefix} ${getCollectionSearchTitle(view) || view.id}`;
          const cleanContent = registerSuggestion(content, { kind: 'collection', target: view });
          return {
            content: cleanContent,
            description: formatSuggestionDescription(getCollectionSearchTitle(view) || String(view.id || 'Untitled Collection'), 'Collections', collectionPrefix),
          };
        }),
      ];

      applyDefault(allSuggestions[0].description);
      suggest(allSuggestions.slice(1));
      return;
    }

    if (type === 'command') {
      const commandQueryForIntent =
        rawText && rawText.toLowerCase().startsWith(`${prefix.toLowerCase()} `)
          ? rawText.slice(prefix.length + 1)
          : query;
      const nestedNoteInput = parseInput(commandQueryForIntent, buildRegistry(localData.commands || [], customPrefixes));
      if (nestedNoteInput.type === 'note') {
        handleTypedInput(
          nestedNoteInput.prefix,
          'note',
          nestedNoteInput.query,
          suggest,
          localData,
          customPrefixes,
          rawText,
          setDefault,
        );
        return;
      }

      const noteUpdateInvocation = findNoteShortcutUpdateInvocation(commandQueryForIntent, localData, customPrefixes);
      if (noteUpdateInvocation) {
        const nextHint = getNoteUpdateSuggestionText(noteUpdateInvocation.fields, localData, customPrefixes);
        const noteTitle = noteUpdateInvocation.note.title || 'Untitled Note';
        const detail = noteUpdateInvocation.fields.description.trim()
          ? `append: ${noteUpdateInvocation.fields.description.trim()}`
          : nextHint
            ? `Type ${nextHint}`
            : 'ready to update';
        const description = formatSuggestionDescription(
          `${escapeXml(noteTitle)} <dim>- ${escapeXml(detail)}</dim>`,
          'Notes',
          noteUpdateInvocation.trigger,
          true,
        );
        applyDefault(description);
        suggest([]);
        return;
      }

      const spaceIdx = query.indexOf(' ');
      const commandKey = spaceIdx !== -1 ? query.slice(0, spaceIdx).toLowerCase() : query.toLowerCase();
      const prompt = spaceIdx !== -1 ? query.slice(spaceIdx + 1) : '';

      if (commandKey.trim() === '') {
        const assignedCommandIds = getAssignedCommandIds(localData.userShortcuts || []);
        const commandPrefix = prefix || 'c';

        const allSuggestions = (localData.commands || [])
          .filter(isOmniboxVisibleCommand)
          .sort((a, b) => {
            const aAssigned = assignedCommandIds.has(String(a.id || '')) ? 0 : 1;
            const bAssigned = assignedCommandIds.has(String(b.id || '')) ? 0 : 1;
            if (aAssigned !== bAssigned) return aAssigned - bAssigned;
            return String(a.label || a.id || '').localeCompare(String(b.label || b.id || ''));
          })
          .slice(0, 50)
          .map((c: CommandRecord) => {
            const content = `${commandPrefix} ${c.label || c.id}`;
            const cleanContent = registerSuggestion(content, { kind: 'command', target: c });
            return {
              content: cleanContent,
              description: formatSuggestionDescription(c.label || c.id, 'System', c.prefix || commandPrefix),
            };
          });

        if (allSuggestions.length > 0) {
          applyDefault(allSuggestions[0].description);
          suggest(allSuggestions.slice(1));
        } else {
          applyDefault('No commands saved yet');
          suggest([]);
        }
        return;
      }

      const assignedCommandIds = getAssignedCommandIds(localData.userShortcuts || []);
      const commandMatches = (localData.commands || [])
        .filter(isOmniboxVisibleCommand)
        .map((command: CommandRecord) => ({
          command,
          rank: bestRankByQuery(
            commandKey,
            command.label || '',
            command.prefix || '',
            command.id || '',
            ...((command as any).keywords || []),
          ),
        }))
        .filter((entry): entry is { command: CommandRecord; rank: number } => entry.rank !== null)
        .sort((a, b) => {
          const aAssigned = assignedCommandIds.has(String(a.command.id || '')) ? 0 : 1;
          const bAssigned = assignedCommandIds.has(String(b.command.id || '')) ? 0 : 1;
          if (aAssigned !== bAssigned) return aAssigned - bAssigned;
          if (a.rank !== b.rank) return a.rank - b.rank;
          return String(a.command.label || a.command.id || '').localeCompare(
            String(b.command.label || b.command.id || ''),
          );
        })
        .map(entry => entry.command);

      const commandShortcutMatches = (localData.userShortcuts || [])
        .map((s: any) => ({
          shortcut: s,
          rank: rankByQuery(s.trigger || '', commandKey),
        }))
        .filter(
          (entry): entry is { shortcut: any; rank: number } =>
            getShortcutTargetType(entry.shortcut) === 'command' && entry.rank !== null,
        )
        .sort(
          (a, b) =>
            a.rank - b.rank || String(a.shortcut.trigger || '').length - String(b.shortcut.trigger || '').length,
        )
        .map(entry => entry.shortcut);

      if (commandMatches.length === 0 && commandShortcutMatches.length === 0) {
        applyDefault(commandKey ? `No commands found matching <match>${commandKey}</match>` : 'No commands saved yet');
        suggest([]);
        return;
      }

      // Commands use c <id> format — ID is already the stable key
      const commandPrefix = prefix || 'c';
      // Chrome requires every suggest() content to start with what the user typed.
      // Use rawText as the content prefix so Chrome never filters out our suggestions.
      const contentBase = rawText ?? `${commandPrefix} ${commandKey}`;
      const allSuggestions: Array<{ content: string; description: string }> = [
        ...commandShortcutMatches.map((s: any) => {
          const trigger = normalizeShortcutTrigger(s.trigger || '');
          const command = localData.commands.find(c => String(c.id || '') === String(s.referenceId || ''));
          const targetTitle = command ? (command.label || command.id) : trigger;
          const content = `${contentBase} > ${targetTitle}`;
          const cleanContent = registerSuggestion(content, { kind: 'shortcut', target: s, temporaryPrompt: prompt });
          return {
            content: cleanContent,
            description: formatSuggestionDescription(targetTitle, 'System', trigger),
          };
        }),
        ...commandMatches.map((c: CommandRecord) => {
          const content = `${contentBase} > ${c.label || c.id}`;
          const cleanContent = registerSuggestion(content, { kind: 'command', target: c, prompt });
          return {
            content: cleanContent,
            description: prompt
              ? formatSuggestionDescription(escapeXml(c.label || c.id) + ` <dim>- prompt: <match>${escapeXml(prompt)}</match></dim>`, 'System', c.prefix || commandPrefix, true)
              : formatSuggestionDescription(c.label || c.id, 'System', c.prefix || commandPrefix),
          };
        }),
      ];

      if (allSuggestions.length > 0) {
        applyDefault(allSuggestions[0].description);
        suggest(allSuggestions.slice(1));
      } else {
        applyDefault('No commands saved yet');
        suggest([]);
      }
    }

    // ── Other Types (Prompt, Automation, Agent, Todo, Snippet) ──
    if (['prompt', 'automation', 'agent', 'todo', 'snippet'].includes(type)) {
      let items: any[] = [];
      const typeLabel =
        type === 'prompt'
          ? 'Prompt'
          : type === 'automation'
            ? 'Automation'
            : type === 'agent'
              ? 'Agent'
              : type === 'todo'
                ? 'Todo'
                : 'Snippet';

      if (type === 'prompt') items = localData.aiPrompts || [];
      else if (type === 'agent') items = localData.chatAgents || [];
      else if (type === 'automation') items = localData.automations || [];
      else if (type === 'snippet') items = localData.snippets || [];
      else if (type === 'todo') items = localData.todos || [];

      if (type === 'prompt') {
        const promptInvocation = findAiPromptShortcutInvocation(query, localData);
        if (promptInvocation && promptInvocation.temporaryPrompt) {
          const title =
            promptInvocation.promptRecord.title || promptInvocation.promptRecord.id || promptInvocation.trigger;
          const description = formatSuggestionDescription(
            `${escapeXml(title)} <dim>- prompt: <match>${escapeXml(promptInvocation.temporaryPrompt)}</match></dim>`,
            'AI Prompts',
            promptInvocation.trigger,
            true,
          );
          applyDefault(description);
          suggest([]);
          return;
        }
      }

      if (query.trim() === '') {
        // User-assigned shortcuts for this type — shown first
        const emptyTypeShortcuts = (localData.userShortcuts || []).filter(
          (s: any) => getShortcutTargetType(s) === normalizeOmniboxEntityType(type),
        );

        // Items that don't have a shortcut assigned
        const itemsWithoutShortcut = items.filter(
          (item: any) => !shouldHideItemBecauseShortcutExists(item, emptyTypeShortcuts, type),
        );

        const allSuggestions: Array<{ content: string; description: string }> = [
          ...emptyTypeShortcuts.map((s: any) => {
            const trigger = normalizeShortcutTrigger(s.trigger || '');
            const refItem = items.find((item: any) => String(item.id || '') === String(s.referenceId || ''));
            const targetTitle = refItem
              ? refItem.title || refItem.name || refItem.id || 'Untitled'
              : trigger;
            const content = `${prefix} ${trigger}`;
            const cleanContent = registerSuggestion(content, { kind: 'shortcut', target: s });
            return {
              content: cleanContent,
              description: formatSuggestionDescription(targetTitle, typeLabel + 's', trigger),
            };
          }),
          ...itemsWithoutShortcut.slice(0, 40).map((item: any) => {
            const title = item.title || item.name || item.id || 'Untitled';
            const content = `${prefix} ${title}`;
            const cleanContent = registerSuggestion(content, { kind: 'entity_search', type, query: title });
            return {
              content: cleanContent,
              description: formatSuggestionDescription(title, typeLabel + 's', prefix),
            };
          }),
        ];

        if (allSuggestions.length > 0) {
          applyDefault(allSuggestions[0].description);
          suggest(allSuggestions.slice(1));
        } else {
          applyDefault(`No ${type}s saved yet`);
          suggest([]);
        }
        return;
      }

      const rawTitleMatches: any[] = items
        .map(item => ({ item, rank: rankByQuery(item.title || item.name || '', query) }))
        .filter((entry): entry is { item: any; rank: number } => entry.rank !== null)
        .sort(
          (a, b) =>
            a.rank - b.rank ||
            String(a.item.title || a.item.name || '').length - String(b.item.title || b.item.name || '').length,
        )
        .map(entry => entry.item);

      // Also match user-assigned shortcut triggers for this type
      const shortcutMatches = (localData.userShortcuts || [])
        .map((s: any) => ({
          shortcut: s,
          rank: rankByQuery(s.trigger || '', query),
        }))
        .filter(
          (entry): entry is { shortcut: any; rank: number } =>
            getShortcutTargetType(entry.shortcut) === normalizeOmniboxEntityType(type) && entry.rank !== null,
        )
        .sort(
          (a, b) =>
            a.rank - b.rank || String(a.shortcut.trigger || '').length - String(b.shortcut.trigger || '').length,
        )
        .map(entry => entry.shortcut);

      // De-duplicate: if an item already has a shortcut match, don't show it again as a title match
      const titleMatches = rawTitleMatches.filter(
        (item: any) => !shouldHideItemBecauseShortcutExists(item, shortcutMatches, type),
      );

      if (titleMatches.length === 0 && shortcutMatches.length === 0) {
        applyDefault(`No ${type}s found matching <match>${query}</match>`);
        suggest([]);
        return;
      }

      const allSuggestions: Array<{ content: string; description: string }> = [
        // Shortcut triggers first
        ...shortcutMatches.map((s: any) => {
          const trigger = normalizeShortcutTrigger(s.trigger || '');
          const refItem = items.find((item: any) => String(item.id || '') === String(s.referenceId || ''));
          const targetTitle = refItem
            ? refItem.title || refItem.name || refItem.id || 'Untitled'
            : trigger;
          const content = `${prefix} ${trigger}`;
          const cleanContent = registerSuggestion(content, { kind: 'shortcut', target: s });
          return {
            content: cleanContent,
            description: formatSuggestionDescription(targetTitle, typeLabel + 's', trigger),
          };
        }),
        // Then title matches (no duplicates)
        ...titleMatches.map(item => {
          const title = item.title || item.name || item.id || 'Untitled';
          const content = `${prefix} ${title}`;
          const cleanContent = registerSuggestion(content, { kind: 'entity_search', type, query: title });
          return {
            content: cleanContent,
            description: formatSuggestionDescription(title, typeLabel + 's', prefix),
          };
        }),
      ];

      applyDefault(allSuggestions[0].description);
      suggest(allSuggestions.slice(1));
      return;
    }

    // Remove In-Place Commands block (now handled dynamically via Commands)
  }

  // Execute on Enter — use cache first, re-fetch only if cache is stale
  chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
    // Always ensure cache is warm; getResolvedOmniboxState() handles this nicely
    const { localData, customPrefixes } = await getResolvedOmniboxState();

    const userShortcuts = localData.userShortcuts || [];
    const extUrl = chrome.runtime.getURL('AltS_search_newtab/index.html');

    const openUrls = (urls: string[]) => {
      urls.forEach((url, index) => {
        if (index === 0) {
          if (disposition === 'currentTab') {
            chrome.tabs.update({ url });
          } else {
            chrome.tabs.create({ url, active: disposition === 'newForegroundTab' });
          }
        } else {
          chrome.tabs.create({ url, active: false });
        }
      });
    };

    const executeCommand = (command: CommandRecord, prompt = '') => {
      // NOTE: AI_COMMANDS branch removed — those command IDs are hidden from omnibox.
      // NOTE: URL_COMMANDS branch removed — those entries don't exist as DB CommandRecords.

      // Intercept In-Place Commands
      if (
        command.id === 'save_link' ||
        command.id === 'save_todo' ||
        command.id === 'save_chat' ||
        command.id === 'add_to_existing' ||
        command.id === 'add_to_existing_session' ||
        command.id === 'summarize_page' ||
        command.id === 'downloadallimages' ||
        command.id === 'downloadalltables' ||
        command.id === 'capture_full_screenshot' ||
        command.id === 'capture_screenshot' ||
        command.id === 'capture_clip_screenshot' ||
        command.id === 'capture_element_screenshot' ||
        command.id === 'merge_windows' ||
        command.id === 'close_duplicate_tabs' ||
        command.id === 'mute_all_tabs' ||
        command.id === 'unmute_all_tabs'
      ) {
        triggerInPlaceCommand(command.id);
        return true;
      }

      const targetUrl = `${extUrl}?omnibox=true&type=command&id=${command.id}${prompt ? `&query=${encodeURIComponent(prompt)}` : ''}`;
      console.log('[OmniboxCommandTrigger][background] command target prepared', {
        commandId: command.id,
        prompt,
        disposition,
        targetUrl,
      });
      if (disposition === 'currentTab') {
        chrome.tabs.update({ url: targetUrl });
      } else {
        chrome.tabs.create({ url: targetUrl, active: disposition !== 'newBackgroundTab' });
      }
      return true;
    };

    const executeSession = (session: SessionRecord) => {
      const sessionId = String(session.id || '').trim();
      if (!sessionId) return false;
      if ((session as any).sessionOpenSettings?.autoSaveMode !== 'auto_save') return false;

      chrome.windows.getLastFocused({ populate: true }, focusedWindow => {
        const activeTab = focusedWindow?.tabs?.find(tab => tab.active);
        handleSessionMessage(
          {
            action: 'start_session',
            sessionId,
            sessionName: getSessionSearchTitle(session) || 'Untitled Session',
            workspaceId: session.workspaceId || null,
            folderId: session.folderId || null,
            initialUrls: getSessionInitialUrls(session),
            initialNames: getSessionInitialNames(session),
            openSettings: session.sessionOpenSettings,
            sessionLaunchSource: 'omnibox',
            smartLaunch: true,
            currentTabId: activeTab?.id,
            currentWindowId: focusedWindow?.id,
            currentPageUrl: activeTab?.url || activeTab?.pendingUrl,
          },
          {} as chrome.runtime.MessageSender,
          () => {},
        );
      });
      return true;
    };

    const executeCollectionView = (view: WidgetViewRecord, openBehavior?: CollectionOpenBehavior) => {
      const viewId = String(view.id || '').trim();
      if (!viewId) return false;
      const openBehaviorParam = openBehavior ? `&openBehavior=${encodeURIComponent(openBehavior)}` : '';
      const targetUrl = `${extUrl}?trigger_hotkey=true&type=collection&id=${encodeURIComponent(viewId)}${openBehaviorParam}`;
      if (disposition === 'currentTab') {
        chrome.tabs.update({ url: targetUrl });
      } else {
        chrome.tabs.create({ url: targetUrl, active: disposition !== 'newBackgroundTab' });
      }
      return true;
    };

    const executeAiPrompt = (promptRecord: AiPromptRecord, temporaryPrompt = '', runFromCommandShortcut = false) => {
      const temporaryParam = temporaryPrompt
        ? `&temporaryPrompt=${encodeURIComponent(temporaryPrompt)}`
        : '';
      const runParam = runFromCommandShortcut ? '&runPrompt=true' : '';
      const targetUrl = `${extUrl}?omnibox=true&type=prompt&id=${encodeURIComponent(promptRecord.id)}${temporaryParam}${runParam}`;
      if (disposition === 'currentTab') {
        chrome.tabs.update({ url: targetUrl });
      } else {
        chrome.tabs.create({ url: targetUrl, active: disposition !== 'newBackgroundTab' });
      }
      return true;
    };

    const executeShortcut = (
      shortcut: any,
      temporaryPrompt = '',
      runFromCommandShortcut = false,
      linkQueryInput?: string,
      collectionOpenBehavior?: CollectionOpenBehavior,
    ) => {
      const rawSnippetId = extractSnippetId(shortcut.referenceId);
      const recordShortcutUse = (success = true, errorCode?: string, targetLabelSnapshot?: string) => {
        recordAssignedTriggerUsage({
          triggerKind: 'user_shortcut',
          triggerValue: shortcut.trigger,
          triggerSource: 'omnibox',
          referenceId: shortcut.referenceId,
          referenceType: shortcut.referenceType,
          surface: 'omnibox',
          success,
          errorCode,
          targetLabelSnapshot: targetLabelSnapshot || shortcut.referenceId,
          triggerLabelSnapshot: shortcut.trigger,
        }).catch(err => console.warn('[Omnibox] Failed to record shortcut usage:', err));
      };

      const normalizedReferenceType = getShortcutTargetType(shortcut);
      if (normalizedReferenceType === 'prompt' || normalizedReferenceType === 'automation') {
        const promptRecord = (localData.aiPrompts || []).find((prompt: AiPromptRecord) =>
          isSameSnippetIdentity(prompt.id, shortcut.referenceId),
        );
        if (promptRecord) {
          const ok = executeAiPrompt(promptRecord, temporaryPrompt, runFromCommandShortcut);
          recordShortcutUse(ok, ok ? undefined : 'execution_failed', promptRecord.title || promptRecord.id);
          return ok;
        }
      }

      if (normalizedReferenceType === 'note') {
        const note = localData.notes.find((n: any) => {
          const nid = n.id ?? '';
          return isSameSnippetIdentity(nid, shortcut.referenceId) || extractSnippetId(nid) === rawSnippetId;
        });
        if (note) {
          const targetUrl = `${extUrl}?omnibox=true&type=note&id=${encodeURIComponent(note.id)}`;
          if (disposition === 'currentTab') {
            chrome.tabs.update({ url: targetUrl });
          } else {
            chrome.tabs.create({ url: targetUrl, active: disposition !== 'newBackgroundTab' });
          }
          recordShortcutUse(true, undefined, note.title || note.id);
          return true;
        }
      }
      if (normalizedReferenceType === 'link') {
        const link = localData.links.find((l: any) => {
          const lid = l.id ?? l.snippet_id ?? '';
          return isSameSnippetIdentity(lid, shortcut.referenceId) || extractSnippetId(lid) === rawSnippetId;
        });

        if (link) {
          const urls = extractUrls(link);
          if (urls && urls.length > 0) {
            const injectionResult = injectLinkQueryValues(urls, linkQueryInput ?? '');
            if (!injectionResult.ok) {
              recordShortcutUse(
                false,
                injectionResult.errorCode,
                (link as any).title || (link as any).name || shortcut.referenceId,
              );
              return true;
            }

            openUrls(injectionResult.urls);
            recordShortcutUse(true, undefined, (link as any).title || (link as any).name || shortcut.referenceId);
            return true;
          }
        }

        console.warn('[Omnibox] Link not found or has no URLs for shortcut:', shortcut);
        recordShortcutUse(false, 'no_urls_found');
      }
      if (normalizedReferenceType === 'command') {
        const command = localData.commands.find(
          (c: CommandRecord) => String(c.id || '') === String(shortcut.referenceId || ''),
        );
        if (command) {
          const ok = executeCommand(command);
          recordShortcutUse(ok, ok ? undefined : 'execution_failed', command.label || command.id);
          return ok;
        }

        console.warn('[Omnibox] Command not found for shortcut:', shortcut);
        recordShortcutUse(false, 'command_not_found');
      }
      if (normalizedReferenceType === 'collection') {
        const view = findCollectionViewByReferenceId(String(shortcut.referenceId || ''), localData.widgetViews || []);
        if (view) {
          const ok = executeCollectionView(view, collectionOpenBehavior);
          recordShortcutUse(ok, ok ? undefined : 'execution_failed', getCollectionSearchTitle(view));
          return ok;
        }

        console.warn('[Omnibox] Collection view not found for shortcut:', shortcut);
        recordShortcutUse(false, 'entity_not_found');
      }
      return false;
    };

    // Clean Registry lookup (Phase 3)
    const matched = lastSuggestionMap.get(text.trim().toLowerCase());
    if (matched) {
      if (matched.kind === 'command') {
        executeCommand(matched.target, matched.prompt);
        return;
      }
      if (matched.kind === 'shortcut') {
        executeShortcut(
          matched.target,
          matched.temporaryPrompt,
          true,
          matched.linkQueryInput,
          matched.openBehavior
        );
        return;
      }
      if (matched.kind === 'note_create') {
        if (!matched.fields.title.trim()) {
          chrome.omnibox.setDefaultSuggestion({
            description: getNoteCreateTitleRequiredDescription(localData, customPrefixes),
          });
          return;
        }
        await createNoteFromOmniboxFields(matched.fields, localData);
        fetchAndApplyState().catch(err => console.warn('[Omnibox] Failed to refresh cache after note create:', err));
        return;
      }
      if (matched.kind === 'note_update') {
        if (!matched.fields.description.trim() && matched.fields.tagNames.length === 0) {
          const nextHint = getNoteUpdateSuggestionText(matched.fields, localData, customPrefixes);
          chrome.omnibox.setDefaultSuggestion({
            description: formatSuggestionDescription(
              `${escapeXml(matched.target.title || 'Untitled Note')} <dim>- Type ${escapeXml(nextHint)}</dim>`,
              'Notes',
              matched.trigger,
              true,
            ),
          });
          return;
        }
        await updateNoteFromOmniboxFields(matched.target, matched.fields);
        fetchAndApplyState().catch(err => console.warn('[Omnibox] Failed to refresh cache after note update:', err));
        return;
      }
      if (matched.kind === 'note') {
        openUrls([`${extUrl}?omnibox=true&type=note&id=${encodeURIComponent(matched.target)}`]);
        return;
      }
      if (matched.kind === 'link') {
        openUrls(matched.target);
        return;
      }
      if (matched.kind === 'collection') {
        executeCollectionView(matched.target, matched.openBehavior);
        return;
      }
      if (matched.kind === 'entity_search') {
        const targetUrl = `${extUrl}?omnibox=true&type=${matched.type}&query=${encodeURIComponent(matched.query)}`;
        if (disposition === 'currentTab') {
          chrome.tabs.update({ url: targetUrl });
        } else {
          chrome.tabs.create({ url: targetUrl, active: disposition !== 'newBackgroundTab' });
        }
        return;
      }
    }

    const findAiPromptCommandInvocation = (rawQuery: string) => {
      const lowerQuery = rawQuery.toLowerCase();
      return (userShortcuts || [])
        .map((shortcut: any) => {
          const referenceType = getShortcutTargetType(shortcut);
          if (referenceType !== 'prompt' && referenceType !== 'automation') return null;

          const trigger = normalizeShortcutTrigger(shortcut.trigger || '');
          if (!trigger || !lowerQuery.startsWith(trigger)) return null;
          if (lowerQuery.length > trigger.length && !/\s/.test(rawQuery.charAt(trigger.length))) return null;

          const promptRecord = (localData.aiPrompts || []).find((prompt: AiPromptRecord) =>
            isSameSnippetIdentity(prompt.id, shortcut.referenceId),
          );
          if (!promptRecord) return null;

          return {
            shortcut,
            triggerLength: trigger.length,
            temporaryPrompt: rawQuery.slice(trigger.length).replace(/^\s+/, ''),
          };
        })
        .filter(
          (
            match,
          ): match is { shortcut: any; triggerLength: number; temporaryPrompt: string } => match !== null,
        )
        .sort((a, b) => b.triggerLength - a.triggerLength)[0] || null;
    };

    const findLinkCommandInvocation = (rawQuery: string) => {
      const lowerQuery = rawQuery.toLowerCase();
      return (userShortcuts || [])
        .map((shortcut: any) => {
          if (getShortcutTargetType(shortcut) !== 'link') return null;

          const trigger = normalizeShortcutTrigger(shortcut.trigger || '');
          if (!trigger || !lowerQuery.startsWith(trigger)) return null;
          if (lowerQuery.length > trigger.length && !/\s/.test(rawQuery.charAt(trigger.length))) return null;

          const rawSnippetId = extractSnippetId(shortcut.referenceId);
          const link = localData.links.find((candidate: any) => {
            const candidateId = candidate.id ?? candidate.snippet_id ?? '';
            return (
              isSameSnippetIdentity(candidateId, shortcut.referenceId) ||
              extractSnippetId(candidateId) === rawSnippetId
            );
          });
          if (!link) return null;

          return {
            shortcut,
            triggerLength: trigger.length,
            queryInput: rawQuery.slice(trigger.length).replace(/^\s+/, ''),
          };
        })
        .filter(
          (match): match is { shortcut: any; triggerLength: number; queryInput: string } => match !== null,
        )
        .sort((a, b) => b.triggerLength - a.triggerLength)[0] || null;
    };

    const findCollectionCommandInvocation = (rawQuery: string) => {
      const parts = rawQuery.trim().split(/\s+/).filter(Boolean);
      const triggerInput = normalizeShortcutTrigger(parts[0] || '');
      const optionInput = normalizeShortcutTrigger(parts[1] || '');
      if (!triggerInput || parts.length > 2) return null;
      if (optionInput && optionInput !== 'f') return null;

      return (userShortcuts || [])
        .map((shortcut: any) => {
          if (getShortcutTargetType(shortcut) !== 'collection') return null;

          const trigger = normalizeShortcutTrigger(shortcut.trigger || '');
          if (!trigger || trigger !== triggerInput) return null;

          const view = findCollectionViewByReferenceId(String(shortcut.referenceId || ''), localData.widgetViews || []);
          if (!view) return null;

          return {
            shortcut,
            triggerLength: trigger.length,
            openBehavior: optionInput === 'f' ? 'focus_mode' as const : undefined,
          };
        })
        .filter(
          (
            match,
          ): match is { shortcut: any; triggerLength: number; openBehavior: CollectionOpenBehavior | undefined } =>
            match !== null,
        )
        .sort((a, b) => b.triggerLength - a.triggerLength)[0] || null;
    };

    // ─── Decode our encoded suggestion content strings ───────────────────────
    // Content format: "c cap__cmd_0_capture_full_screenshot" or "c cap__shortcut_mytrigger"
    const cmdEncode = text.indexOf('__cmd_');
    if (cmdEncode !== -1) {
      const afterMarker = text.slice(cmdEncode + '__cmd_'.length);
      // strip leading index "0_", "1_", etc.
      const underscoreIdx = afterMarker.indexOf('_');
      const commandId = underscoreIdx !== -1 ? afterMarker.slice(underscoreIdx + 1) : afterMarker;
      const command = localData.commands.find((c: CommandRecord) => String(c.id || '') === commandId.trim());
      if (command) {
        executeCommand(command);
        return;
      }
    }
    const shortcutEncode = text.indexOf('__shortcut_');
    if (shortcutEncode !== -1) {
      const trigger = text.slice(shortcutEncode + '__shortcut_'.length).trim();
      const shortcut = userShortcuts.find(
        (s: any) => normalizeShortcutTrigger(s.trigger || '') === normalizeShortcutTrigger(trigger),
      );
      if (shortcut && executeShortcut(shortcut, '', true)) return;
    }

    // ─── Decode __loose_ encoded suggestion (from buildLooseCandidates) ──────
    const looseEncode = text.indexOf('__loose_');
    if (looseEncode !== -1) {
      const afterMarker = text.slice(looseEncode + '__loose_'.length);
      // strip leading index "0_", "1_", etc.
      const underscoreIdx = afterMarker.indexOf('_');
      const encodedContent = underscoreIdx !== -1 ? afterMarker.slice(underscoreIdx + 1) : afterMarker;
      const decodedContent = decodeURIComponent(encodedContent);
      // Re-use the existing [Command]/[Note]/[Link]/[Collection] parsing path by
      // overwriting `text` with the decoded real content and falling through.
      const reText = decodedContent;

      if (reText.startsWith('[Shortcut] ') || reText.startsWith('[Command] ')) {
        const prefixLength = reText.startsWith('[Shortcut] ') ? '[Shortcut] '.length : '[Command] '.length;
        const cmdKey = reText.slice(prefixLength).trim();
        const shortcut = userShortcuts.find(
          (s: any) => normalizeShortcutTrigger(s.trigger || '') === normalizeShortcutTrigger(cmdKey),
        );
        if (shortcut && executeShortcut(shortcut, '', true)) return;
        const command = localData.commands.find(
          (c: CommandRecord) => (c.label || '').trim() === cmdKey || String(c.id) === cmdKey,
        );
        if (command) { executeCommand(command); return; }
      }
      if (reText.startsWith('[Note] ')) {
        const title = reText.slice('[Note] '.length);
        const note = localData.notes.find(
          (n: any) => (n.title || '').trim() === title.trim() || String(n.id) === title.trim(),
        );
        if (note) { openUrls([`${extUrl}?omnibox=true&type=note&id=${encodeURIComponent(note.id)}`]); return; }
      }
      if (reText.startsWith('[Link] ')) {
        const title = reText.slice('[Link] '.length);
        const link = (localData.links as any[]).find(
          (l: any) => (l.title || '').trim() === title.trim() || String(l.id ?? l.snippet_id) === title.trim(),
        );
        if (link) { const urls = extractUrls(link); if (urls.length > 0) { openUrls(urls); return; } }
      }
      if (reText.startsWith('[Collection] ') || reText.startsWith('[Session] ')) {
        const title = reText.startsWith('[Collection] ')
          ? reText.slice('[Collection] '.length)
          : reText.slice('[Session] '.length);
        const view = findCollectionViewByQuery(title, localData.widgetViews || []);
        if (view) { executeCollectionView(view); return; }
      }
      return;
    }

    // ─── First parse bracketed loose match content ───────────────────────────
    if (text.startsWith('[Shortcut] ') || text.startsWith('[Command] ')) {
      const prefixLength = text.startsWith('[Shortcut] ') ? '[Shortcut] '.length : '[Command] '.length;
      const cmdKey = text.slice(prefixLength).trim();

      const shortcut = userShortcuts.find(
        s => normalizeShortcutTrigger(s.trigger || '') === normalizeShortcutTrigger(cmdKey),
      );
      if (shortcut && executeShortcut(shortcut, '', true)) return;

      const command = localData.commands.find(c => (c.label || '').trim() === cmdKey || String(c.id) === cmdKey);
      if (command) {
        executeCommand(command);
        return;
      }
    }
    if (text.startsWith('[Note] ')) {
      const title = text.slice('[Note] '.length);
      const note = localData.notes.find(n => (n.title || '').trim() === title.trim() || String(n.id) === title.trim());
      if (note) {
        const targetUrl = `${extUrl}?omnibox=true&type=note&id=${encodeURIComponent(note.id)}`;
        openUrls([targetUrl]);
        return;
      }
    }
    if (text.startsWith('[Link] ')) {
      const title = text.slice('[Link] '.length);
      const link = localData.links.find(
        l => (l.title || '').trim() === title.trim() || String(l.id || l.snippet_id) === title.trim(),
      );
      if (link) {
        const urls = extractUrls(link);
        if (urls && urls.length > 0) {
          openUrls(urls);
          return;
        }
      }
    }

    const registry = buildRegistry(localData.commands || [], customPrefixes);
    const { type, query: rawQuery } = parseInput(text, registry);
    const query = rawQuery.trim(); // guard against extra whitespace from suggestion content
    const rawTextForEnter = text.replace(/\u00A0/g, ' ');
    const commandPrefixForEnter =
      type === 'command'
        ? Object.entries(registry)
            .filter(([, registryType]) => registryType === 'command')
            .sort(([leftPrefix], [rightPrefix]) => rightPrefix.length - leftPrefix.length)
            .find(([candidatePrefix]) =>
              rawTextForEnter.toLowerCase().startsWith(`${candidatePrefix.toLowerCase()} `),
            )?.[0] || ''
        : '';
    const rawCommandQuery =
      commandPrefixForEnter
        ? rawTextForEnter.slice(commandPrefixForEnter.length + 1)
        : query;

    if (!type) {
      const trimmedText = text.trim();
      const normalizedText = normalizeShortcutTrigger(trimmedText);
      if (!normalizedText) {
        return;
      }
      const noteUpdateInvocation = findNoteShortcutUpdateInvocation(rawTextForEnter, localData, customPrefixes);
      if (noteUpdateInvocation) {
        const { fields, note } = noteUpdateInvocation;
        const nextHint = getNoteUpdateSuggestionText(fields, localData, customPrefixes);
        if (!fields.description.trim() && fields.tagNames.length === 0) {
          chrome.omnibox.setDefaultSuggestion({
            description: formatSuggestionDescription(
              `${escapeXml(note.title || 'Untitled Note')} <dim>- Type ${escapeXml(nextHint)}</dim>`,
              'Notes',
              noteUpdateInvocation.trigger,
              true,
            ),
          });
          return;
        }
        await updateNoteFromOmniboxFields(note, fields);
        fetchAndApplyState().catch(err => console.warn('[Omnibox] Failed to refresh cache after note update:', err));
        return;
      }
      const linkInvocation = findLinkCommandInvocation(trimmedText);
      if (linkInvocation) {
        // A recognized link command is always consumed. Invalid query input must
        // not fall through to title matching, loose matching, or another command.
        executeShortcut(linkInvocation.shortcut, '', false, linkInvocation.queryInput);
        return;
      }
      const promptInvocation = findAiPromptCommandInvocation(trimmedText);
      if (
        promptInvocation &&
        executeShortcut(promptInvocation.shortcut, promptInvocation.temporaryPrompt, true)
      ) {
        return;
      }
      const collectionInvocation = findCollectionCommandInvocation(trimmedText);
      if (
        collectionInvocation &&
        executeShortcut(collectionInvocation.shortcut, '', false, undefined, collectionInvocation.openBehavior)
      ) {
        return;
      }
      const looseCandidates = buildLooseCandidates(normalizedText, localData, customPrefixes);
      runLooseCandidates(looseCandidates, {
        executeShortcut,
        executeCollectionView: view => {
          executeCollectionView(view);
          return true;
        },
        openNote: noteId => {
          const targetUrl = `${extUrl}?omnibox=true&type=note&id=${encodeURIComponent(noteId)}`;
          if (disposition === 'currentTab') {
            chrome.tabs.update({ url: targetUrl });
          } else {
            chrome.tabs.create({ url: targetUrl, active: disposition !== 'newBackgroundTab' });
          }
        },
        openUrls,
        openEntitySearch: (searchType, searchQuery) => {
          const targetUrl = `${extUrl}?omnibox=true&type=${searchType}&query=${encodeURIComponent(searchQuery)}`;
          if (disposition === 'currentTab') {
            chrome.tabs.update({ url: targetUrl });
          } else {
            chrome.tabs.create({ url: targetUrl, active: disposition !== 'newBackgroundTab' });
          }
        },
        executeCommand,
      });
      return; // no prefix and no shortcut match — do nothing
    }

    // Prefix-only input is a prompt, not an action.
    if (!query) {
      return;
    }

    if (type === 'command') {
      const nestedNoteInput = parseInput(rawCommandQuery, registry);
      if (nestedNoteInput.type === 'note' && nestedNoteInput.query.trim()) {
        const createFields = parseNoteQuickCreateFields(nestedNoteInput.query, {
          prefixSettings: localData.prefixSettings || [],
          prefixes: customPrefixes,
        });
        if (createFields.hasCreateIntent) {
          if (!createFields.title.trim()) {
            chrome.omnibox.setDefaultSuggestion({
              description: getNoteCreateTitleRequiredDescription(localData, customPrefixes),
            });
            return;
          }
          await createNoteFromOmniboxFields(createFields, localData);
          fetchAndApplyState().catch(err => console.warn('[Omnibox] Failed to refresh cache after note create:', err));
          return;
        }
      }

      const noteUpdateInvocation = findNoteShortcutUpdateInvocation(rawCommandQuery, localData, customPrefixes);
      if (noteUpdateInvocation) {
        const { fields, note } = noteUpdateInvocation;
        if (!fields.description.trim() && fields.tagNames.length === 0) {
          const nextHint = getNoteUpdateSuggestionText(fields, localData, customPrefixes);
          chrome.omnibox.setDefaultSuggestion({
            description: formatSuggestionDescription(
              `${escapeXml(note.title || 'Untitled Note')} <dim>- Type ${escapeXml(nextHint)}</dim>`,
              'Notes',
              noteUpdateInvocation.trigger,
              true,
            ),
          });
          return;
        }
        await updateNoteFromOmniboxFields(note, fields);
        fetchAndApplyState().catch(err => console.warn('[Omnibox] Failed to refresh cache after note update:', err));
        return;
      }
    }

    if (type === 'note') {
      const createFields = parseNoteQuickCreateFields(query, {
        prefixSettings: localData.prefixSettings || [],
        prefixes: customPrefixes,
      });
      if (createFields.hasCreateIntent) {
        if (!createFields.title.trim()) {
          chrome.omnibox.setDefaultSuggestion({
            description: getNoteCreateTitleRequiredDescription(localData, customPrefixes),
          });
          return;
        }
        await createNoteFromOmniboxFields(createFields, localData);
        fetchAndApplyState().catch(err => console.warn('[Omnibox] Failed to refresh cache after note create:', err));
        return;
      }
    }

    // 1. Try User Shortcuts First (match exact trigger)
    const normalizedQuery = normalizeShortcutTrigger(query);
    const collectionInvocation = type === 'collection' ? findCollectionCommandInvocation(query) : null;
    if (
      collectionInvocation &&
      executeShortcut(collectionInvocation.shortcut, '', false, undefined, collectionInvocation.openBehavior)
    ) {
      return;
    }

    const shortcutMatch =
      type === 'command'
        ? findBestShortcutMatch(normalizedQuery, userShortcuts, 'command')
        : type === 'collection'
          ? (userShortcuts || [])
              .filter((shortcut: any) => isShortcutOfType(shortcut, 'collection'))
              .map((shortcut: any) => ({
                shortcut,
                rank: rankByQuery(shortcut.trigger || '', normalizedQuery),
              }))
              .filter((entry): entry is { shortcut: any; rank: number } => entry.rank !== null)
              .sort(
                (a, b) =>
                  a.rank - b.rank || String(a.shortcut.trigger || '').length - String(b.shortcut.trigger || '').length,
              )[0]?.shortcut || null
          : findBestShortcutMatch(normalizedQuery, userShortcuts, type);

    if (shortcutMatch && executeShortcut(shortcutMatch)) {
      return;
    }

    // 2. Try Title Match — exact first, then partial fallback
    if (type === 'note' || type === 'link' || type === 'collection') {
      if (type === 'note') {
        const target =
          localData.notes.find((n: NoteRecord) => (n.title || '').toLowerCase() === normalizedQuery) ??
          localData.notes
            .map((n: NoteRecord) => ({ note: n, rank: rankByQuery(n.title || '', normalizedQuery) }))
            .filter((entry): entry is { note: NoteRecord; rank: number } => entry.rank !== null)
            .sort((a, b) => a.rank - b.rank || String(a.note.title || '').length - String(b.note.title || '').length)[0]
            ?.note;
        if (target) {
          const targetUrl = `${extUrl}?omnibox=true&type=note&id=${encodeURIComponent(target.id)}`;
          if (disposition === 'currentTab') {
            chrome.tabs.update({ url: targetUrl });
          } else {
            chrome.tabs.create({ url: targetUrl, active: disposition !== 'newBackgroundTab' });
          }
          return;
        }
      } else if (type === 'link') {
        const target =
          (localData.links as any[]).find((l: any) => (l.title || '').toLowerCase() === normalizedQuery) ??
          (localData.links as any[])
            .map((l: any) => ({ link: l, rank: rankByQuery(l.title || '', normalizedQuery) }))
            .filter((entry): entry is { link: any; rank: number } => entry.rank !== null)
            .sort((a, b) => a.rank - b.rank || String(a.link.title || '').length - String(b.link.title || '').length)[0]
            ?.link;
        if (target) {
          const urls = extractUrls(target);
          if (urls && urls.length > 0) {
            openUrls(urls);
            return;
          }
        }
      } else if (type === 'collection') {
        const target = findCollectionViewByQuery(query, localData.widgetViews || []);
        if (target) {
          executeCollectionView(target);
          return;
        }
      }
    }

    if (type === 'prompt') {
      const target =
        (localData.aiPrompts || []).find(
          (prompt: AiPromptRecord) => (prompt.title || '').toLowerCase() === normalizedQuery,
        ) ??
        (localData.aiPrompts || [])
          .map((prompt: AiPromptRecord) => ({ prompt, rank: rankByQuery(prompt.title || '', normalizedQuery) }))
          .filter((entry): entry is { prompt: AiPromptRecord; rank: number } => entry.rank !== null)
          .sort(
            (a, b) =>
              a.rank - b.rank || String(a.prompt.title || '').length - String(b.prompt.title || '').length,
          )[0]?.prompt;
      if (target) {
        executeAiPrompt(target);
        return;
      }
    }

    // If no match found at all for link/note, open the extension search page instead of newtab
    if (
      type === 'link' ||
      type === 'note' ||
      type === 'collection' ||
      type === 'prompt' ||
      type === 'agent' ||
      type === 'todo' ||
      type === 'snippet'
    ) {
      const targetUrl = `${extUrl}?omnibox=true&type=${type}&query=${encodeURIComponent(query)}`;
      if (disposition === 'currentTab') {
        chrome.tabs.update({ url: targetUrl });
      } else {
        chrome.tabs.create({ url: targetUrl, active: disposition !== 'newBackgroundTab' });
      }
      return;
    } else if (type === 'command') {
      const spaceIdx = query.indexOf(' ');
      const commandKey = spaceIdx !== -1 ? query.slice(0, spaceIdx).toLowerCase() : query.toLowerCase();
      const prompt = spaceIdx !== -1 ? query.slice(spaceIdx + 1) : '';

      const assignedCommandIds = getAssignedCommandIds(localData.userShortcuts || []);
      const matches = (localData.commands || [])
        .map((command: CommandRecord) => ({
          command,
          rank: bestRankByQuery(
            commandKey,
            command.label || '',
            command.prefix || '',
            command.id || '',
            ...((command as any).keywords || []),
          ),
        }))
        .filter((entry): entry is { command: CommandRecord; rank: number } => entry.rank !== null)
        .sort((a, b) => {
          const aAssigned = assignedCommandIds.has(String(a.command.id || '')) ? 0 : 1;
          const bAssigned = assignedCommandIds.has(String(b.command.id || '')) ? 0 : 1;
          if (aAssigned !== bAssigned) return aAssigned - bAssigned;
          if (a.rank !== b.rank) return a.rank - b.rank;
          return String(a.command.label || a.command.id || '').localeCompare(
            String(b.command.label || b.command.id || ''),
          );
        })
        .map(entry => entry.command);

      const found = matches[0];
      if (!found) {
        // No command matched — open extension search page so user can see results
        const fallbackUrl = `${extUrl}?omnibox=true&type=command&query=${encodeURIComponent(query)}`;
        if (disposition === 'currentTab') {
          chrome.tabs.update({ url: fallbackUrl });
        } else {
          chrome.tabs.create({ url: fallbackUrl, active: disposition !== 'newBackgroundTab' });
        }
        return;
      }

      executeCommand(found, prompt);
      return;
    }
  });
}
