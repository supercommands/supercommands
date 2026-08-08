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

import { db } from '../../../../src/storage/indexDB/dbConfig';
import { handleSessionMessage } from '../../browserWindows/sessions';
import { buildShortcutPrefixRegistry, recordAssignedTriggerUsage } from '../../../../src/shared-components/triggers';
import { injectLinkQueryValues } from './linkQueryInjection';

const SESSION_SUGGESTION_ID_PREFIX = 'id:';

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

export function formatSuggestionDescription(title: string, category: string, prefix: string, isAlreadyEscaped = false): string {
  let emoji = '🔍'; // fallback
  switch (category) {
    case 'Notes': emoji = '📄'; break;
    case 'Links': emoji = '🔗'; break;
    case 'System': emoji = '⚙\uFE0E'; break;
    case 'Sessions': emoji = '⊞'; break; // Looks like the 2x2 grid
    case 'Prompts': emoji = '💬'; break;
    case 'Automations': emoji = '⚡'; break;
    case 'Agents': emoji = '🤖'; break;
    case 'Todos': emoji = '☑️'; break; // Checkbox
    case 'Snippets': emoji = '</>'; break; // Text Expander icon
    case 'Shortcuts': emoji = '⌘'; break; // Command icon
  }
  const safeTitle = isAlreadyEscaped ? title : escapeXml(title);
  return `${emoji}  <match>${safeTitle}</match>  <dim>  ${escapeXml(category)}  (c ${escapeXml(prefix)})</dim>`;
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
    .filter((s: any) => !referenceType || s.referenceType === referenceType)
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
  if (command?.category === 'browser') {
    return Boolean(command.prefix && command.prefix.trim().length > 0);
  }
  return true;
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
  const [links, notes, commands, sessions, userShortcuts, aiPrompts, chatAgents, automations, snippets, todos] =
    await Promise.all([
      queryIndexedDB<LinkRecord & { isSession?: boolean }>('links').catch(() => []),
      queryIndexedDB<NoteRecord>('notes').catch(() => []),
      queryIndexedDB<CommandRecord>('commands')
        .then(rows => rows.filter(isOmniboxVisibleCommand))
        .catch(() => []),
      queryIndexedDB<SessionRecord>('sessions').catch(() => []),
      getAllUserShortcuts().catch(() => []),
      queryIndexedDB<AiPromptRecord>('aiPrompts').catch(() => []),
      queryIndexedDB<ChatAgentRecord>('chatAgents').catch(() => []),
      queryIndexedDB<AutomationRecord>('automations').catch(() => []),
      queryIndexedDB<SnippetRecord>('snippets').catch(() => []),
      queryIndexedDB<TodoRecord>('todos').catch(() => []),
    ]);

  return { links, notes, commands, sessions, userShortcuts, aiPrompts, chatAgents, automations, snippets, todos };
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
): Record<string, 'note' | 'link' | 'command' | 'session' | 'prompt' | 'automation' | 'agent' | 'todo' | 'snippet'> {
  type OmniboxRegistryType = 'note' | 'link' | 'command' | 'session' | 'prompt' | 'automation' | 'agent' | 'todo' | 'snippet';
  const allowedTypes = new Set<OmniboxRegistryType>([
    'note',
    'link',
    'command',
    'session',
    'prompt',
    'automation',
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
  type: 'note' | 'link' | 'command' | 'session' | 'prompt' | 'automation' | 'agent' | 'todo' | 'snippet' | null;
  query: string;
};

const isSymbolPrefix = (value: string) => /^[^a-z0-9]+$/i.test(value);

/** Resolves both token prefixes ("n note") and glued prefixes (".note", "@note"). */
export function parseInput(text: string, registry: Record<string, string>): ResolvedOmniboxInput {
  const trimmed = text.trim();
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
  localData: { links: [], notes: [], commands: [], sessions: [], userShortcuts: [] },
  customPrefixes: null,
};
let isCacheReady = false;
let activeFetchPromise: Promise<ResolvedOmniboxState> | null = null;

async function fetchAndApplyState(): Promise<ResolvedOmniboxState> {
  try {
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
        prefix: (customPrefixes as any)?.save_link || 'clc',
        behavior: 'instant' as const,
        showInDashboard: true,
      },
      {
        id: 'save_chat',
        label: 'Save Chat Agent',
        prefix: (customPrefixes as any)?.save_chat || 'csc',
        behavior: 'instant' as const,
        showInDashboard: true,
      },
      {
        id: 'add_to_existing',
        label: 'Add to Existing',
        prefix: (customPrefixes as any)?.add_to_existing || 'cae',
        behavior: 'instant' as const,
        showInDashboard: true,
      },
      {
        id: 'add_to_existing_session',
        label: 'Add to Existing Session',
        prefix: (customPrefixes as any)?.add_to_existing_session || 'caes',
        behavior: 'instant' as const,
        showInDashboard: true,
      },
      {
        id: 'summarize_page',
        label: 'Summarize Page',
        prefix: (customPrefixes as any)?.summarize_page || 'csp',
        behavior: 'instant' as const,
        surface: 'website' as const,
        showInDashboard: true,
      },
      {
        id: 'downloadallimages',
        label: 'Download All Images',
        prefix: (customPrefixes as any)?.downloadallimages || 'dai',
        behavior: 'instant' as const,
        surface: 'website' as const,
        showInDashboard: true,
      },
      {
        id: 'downloadalltables',
        label: 'Download All Tables',
        prefix: (customPrefixes as any)?.downloadalltables || 'dat',
        behavior: 'instant' as const,
        surface: 'website' as const,
        showInDashboard: true,
      },
      {
        id: 'capture_full_screenshot',
        label: 'Capture Full Screenshot',
        prefix: (customPrefixes as any)?.capture_full_screenshot || 'cfp',
        keywords: ['ca', 'cap', 'capture', 'sc', 'cfp', 'fps', 'fullpage', 'full', 'screenshot'],
        behavior: 'instant' as const,
        surface: 'website' as const,
        showInDashboard: true,
      },
      {
        id: 'capture_screenshot',
        label: 'Capture Visible Screenshot',
        prefix: (customPrefixes as any)?.capture_screenshot || 'cs',
        keywords: ['ca', 'cap', 'capture', 'sc', 'cs', 'screenshot', 'visible'],
        behavior: 'instant' as const,
        surface: 'website' as const,
        showInDashboard: true,
      },
      {
        id: 'capture_clip_screenshot',
        label: 'Clip & Download Screenshot',
        prefix: (customPrefixes as any)?.capture_clip_screenshot || 'ccs',
        keywords: ['ca', 'cap', 'capture', 'sc', 'ccs', 'cc', 'clip', 'clipboard', 'screenshot'],
        behavior: 'instant' as const,
        surface: 'website' as const,
        showInDashboard: true,
      },
      {
        id: 'capture_element_screenshot',
        label: 'Capture Element',
        prefix: (customPrefixes as any)?.capture_element_screenshot || 'ces',
        keywords: ['ca', 'cap', 'capture', 'sc', 'ces', 'element', 'part', 'section', 'select', 'screenshot'],
        behavior: 'instant' as const,
        surface: 'website' as const,
        showInDashboard: false,
      },
      {
        id: 'merge_windows',
        label: 'Merge All Windows',
        prefix: (customPrefixes as any)?.merge_windows || 'mw',
        keywords: ['merge', 'windows', 'tabs', 'consolidate', 'mw'],
        behavior: 'instant' as const,
        surface: 'website' as const,
        showInDashboard: true,
      },
      {
        id: 'close_duplicate_tabs',
        label: 'Close Duplicate Tabs',
        prefix: (customPrefixes as any)?.close_duplicate_tabs || 'cdt',
        keywords: ['close', 'duplicate', 'tabs', 'cdt'],
        behavior: 'instant' as const,
        surface: 'website' as const,
        showInDashboard: true,
      },
      {
        id: 'mute_all_tabs',
        label: 'Mute All Tabs',
        prefix: (customPrefixes as any)?.mute_all_tabs || 'mat',
        keywords: ['mute', 'tabs', 'silence', 'mat'],
        behavior: 'instant' as const,
        surface: 'website' as const,
        showInDashboard: true,
      },
      {
        id: 'unmute_all_tabs',
        label: 'Unmute All Tabs',
        prefix: (customPrefixes as any)?.unmute_all_tabs || 'umat',
        keywords: ['unmute', 'tabs', 'sound', 'umat'],
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
  if (message.action === 'INVALIDATE_OMNIBOX_CACHE' || message.action === 'DATA_CHANGED') {
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
  | 'session'
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
  userShortcuts: any[];
  aiPrompts?: AiPromptRecord[];
  chatAgents?: ChatAgentRecord[];
  automations?: AutomationRecord[];
  snippets?: SnippetRecord[];
  todos?: TodoRecord[];
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
  if (normalizedValue === normalizedQuery) return 0;
  if (normalizedValue.startsWith(normalizedQuery)) return 1;
  if (normalizedQuery.length >= 2 && normalizedValue.includes(normalizedQuery)) return 2;
  return null;
};

const bestRankByQuery = (query: string, ...values: string[]) => {
  const ranks = values.map(value => rankByQuery(value, query)).filter((rank): rank is number => rank !== null);

  return ranks.length > 0 ? Math.min(...ranks) : null;
};

const getAssignedCommandIds = (userShortcuts: any[]) =>
  new Set(
    (userShortcuts || [])
      .filter((shortcut: any) => shortcut.referenceType === 'command')
      .map((shortcut: any) => String(shortcut.referenceId || '')),
  );

const getSessionSearchTitle = (session: SessionRecord | null | undefined) => String(session?.title || '').trim();

const getSessionSuggestionContent = (prefix: string, sessionId: string) =>
  `${prefix} ${SESSION_SUGGESTION_ID_PREFIX}${sessionId}`;


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

const getShortcutTargetType = (shortcut: any) =>
  isLegacySessionShortcut(shortcut) ? 'session' : String(shortcut?.referenceType || '').toLowerCase();

const shouldHideItemBecauseShortcutExists = (item: any, shortcuts: any[], expectedType?: string) => {
  const itemKeys = getItemIdentityKeys(item);
  if (itemKeys.size === 0) return false;

  return shortcuts.some(shortcut => {
    const shortcutType = getShortcutTargetType(shortcut);
    const shortcutKeys = getShortcutTargetIdentityKeys(shortcut);
    if (shortcutKeys.size === 0) return false;

    const itemType = String(expectedType || item?.category || item?.type || item?.referenceType || '').toLowerCase();
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

const findAiPromptByReferenceId = (referenceId: string, prompts: AiPromptRecord[]) =>
  prompts.find(prompt => isSameSnippetIdentity(prompt.id, referenceId)) || null;

const isSessionReferenceId = (referenceId: string | null | undefined) => {
  const rawReferenceId = String(referenceId || '').trim();
  if (!rawReferenceId) return false;

  const extractedId = extractSnippetId(rawReferenceId);
  return extractedId.startsWith('session_') || rawReferenceId.includes('session_');
};

const isLegacySessionShortcut = (shortcut: any) =>
  shortcut?.referenceType === 'note' && isSessionReferenceId(shortcut?.referenceId);

const isShortcutOfType = (shortcut: any, referenceType: string) => {
  if (referenceType === 'session') {
    return shortcut?.referenceType === 'session' || isLegacySessionShortcut(shortcut);
  }

  return shortcut?.referenceType === referenceType;
};

export function buildLooseCandidates(query: string, state: OmniboxLocalData): LooseMatchCandidate[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  const candidates: LooseMatchCandidate[] = [];
  const assignedCommandIds = getAssignedCommandIds(state.userShortcuts || []);

  for (const shortcut of state.userShortcuts || []) {
    const trigger = normalizeShortcutTrigger(shortcut.trigger || '');
    const rank = rankByQuery(trigger, normalizedQuery);
    if (rank === null) continue;

    const effectiveReferenceType = isLegacySessionShortcut(shortcut) ? 'session' : shortcut.referenceType;
    const normalizedReferenceType = String(effectiveReferenceType || '').toLowerCase();
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
          : effectiveReferenceType === 'session'
            ? findSessionByReferenceId(String(shortcut.referenceId || ''), state.sessions || [])?.title ||
              'Untitled Session'
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
    else if (effectiveReferenceType === 'session') { targetCategory = 'Sessions'; }
    else if (effectiveReferenceType === 'command') { targetCategory = 'System'; }
    else if (isAiPromptShortcut) { targetCategory = 'AI Prompts'; }

    candidates.push({
      kind: 'shortcut',
      rank: rank + (isCommandShortcut ? -30 : 0),
      content: `[Command] ${trigger}`,
      description: formatSuggestionDescription(targetTitle, targetCategory, trigger),
      titleKey: targetTitle,
      target: shortcut,
    });
  }

  for (const note of state.notes || []) {
    const title = String(note.title || '').trim();
    const rank = rankByQuery(title, normalizedQuery);
    if (rank === null) continue;
    if (shouldHideItemBecauseShortcutExists(note, state.userShortcuts || [], 'note')) continue;

    candidates.push({
      kind: 'note',
      rank: rank + 10,
      content: `[Note] ${title}`,
      description: formatSuggestionDescription(title || note.id || 'Untitled', 'Notes', 'n'),
      titleKey: title,
      target: note,
    });
  }

  for (const link of state.links || []) {
    const title = String(link.title || '').trim();
    const rank = rankByQuery(title, normalizedQuery);
    if (rank === null) continue;
    if (shouldHideItemBecauseShortcutExists(link, state.userShortcuts || [], 'link')) continue;

    candidates.push({
      kind: 'link',
      rank: rank + 10,
      content: `[Link] ${title}`,
      description: formatSuggestionDescription(title || link.id || 'Untitled', 'Links', 'l'),
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
    if (shouldHideItemBecauseShortcutExists(command, state.userShortcuts || [], 'command')) continue;
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

  for (const session of state.sessions || []) {
    const title = getSessionSearchTitle(session);
    const rank = rankByQuery(title, normalizedQuery);
    if (rank === null) continue;
    if (shouldHideItemBecauseShortcutExists(session, state.userShortcuts || [], 'session')) continue;

    candidates.push({
      kind: 'session',
      rank: rank + 10,
      content: `[Session] ${title}`,
      description: formatSuggestionDescription(title || session.id || 'Untitled Session', 'Sessions', 's'),
      titleKey: title,
      target: session,
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
      if (shouldHideItemBecauseShortcutExists(item, state.userShortcuts || [], bucket.kind)) continue;

      const prefixMap: Record<string, string> = { prompt: 'p', automation: 'a', agent: 'g', todo: 't', snippet: 'sn' };
      const prefix = prefixMap[bucket.kind] || 'x';

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

  candidates.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.titleKey.length - b.titleKey.length;
  });

  return candidates;
}

type LooseCandidateHandlers = {
  executeShortcut: (shortcut: any) => boolean;
  executeSession: (session: SessionRecord) => boolean;
  openNote: (noteId: string) => void;
  openUrls: (urls: string[]) => void;
  openEntitySearch: (type: 'session' | 'prompt' | 'automation' | 'agent' | 'todo' | 'snippet', query: string) => void;
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

    if (candidate.kind === 'session') {
      if (handlers.executeSession(candidate.target as SessionRecord)) {
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
  const typeOrder: Array<'note' | 'link' | 'session' | 'snippet' | 'prompt' | 'automation' | 'agent' | 'todo'> = [
    'note', 'link', 'session', 'snippet', 'prompt', 'automation', 'agent', 'todo',
  ];

  const prefixParts: string[] = [];
  for (const type of typeOrder) {
    const key = Object.keys(registry).find(k => registry[k] === type);
    if (key) prefixParts.push(key);
  }

  const examplePrefixes = prefixParts.join(', ');
  return `cmdOS: <match>Press Space</match> to browse commands, or type a prefix (like ${examplePrefixes})`;
}

export function setupOmnibox() {
  // Set a placeholder hint immediately (before cache loads). Updated dynamically once cache is ready.
  chrome.omnibox.setDefaultSuggestion({
    description: 'cmdOS: <match>Press Space</match> to browse, or type a prefix to filter by category',
  });

  // Pre-warm cache immediately when the service worker starts (before user even opens omnibox)
  warmCache();

  // Re-warm on each activation to pick up any data changes, then update hint with real prefixes
  chrome.omnibox.onInputStarted.addListener(() => {
    isCacheReady = false;
    warmCache().then(({ localData, customPrefixes }) => {
      const registry = buildRegistry(localData.commands || [], customPrefixes);
      chrome.omnibox.setDefaultSuggestion({
        description: buildDynamicHint(registry),
      });
    });
  });

  // ── onInputChanged: load from cache with promise fallback ────────────────
  chrome.omnibox.onInputChanged.addListener((text, suggest) => {
    const runSuggestions = async () => {
      const { localData, customPrefixes } = await getResolvedOmniboxState();
      const registry = buildRegistry(localData.commands || [], customPrefixes);
      const { prefix, type, query } = parseInput(text, registry);


      // No recognised prefix yet — show navigation hint or match prefix-less shortcuts
      if (!type) {
        const trimmedText = text.trim();
        if (trimmedText === '') {
          // Update hint with real user prefixes then show command list
          chrome.omnibox.setDefaultSuggestion({ description: buildDynamicHint(registry) });
          handleTypedInput('', 'command', '', suggest, localData);
          return;
        }

        // Guard: if the text matches a known prefix exactly (user still typing, no space yet),
        // treat it as entering that mode with empty query — avoids incorrect loose/global matches.
        const lowerTrimmedText = trimmedText.toLowerCase();
        const matchedPrefix = Object.keys(registry).find(k => k.toLowerCase() === lowerTrimmedText);
        if (matchedPrefix) {
          handleTypedInput(matchedPrefix, registry[matchedPrefix] as any, '', suggest, localData);
          return;
        }

        const normalizedText = normalizeShortcutTrigger(trimmedText);
        if (!normalizedText) {
          suggest([]);
          return;
        }
        const looseCandidates = buildLooseCandidates(normalizedText, localData);

        if (looseCandidates.length > 0) {
          // Chrome requires every suggest() content to start with what the user typed.
          // Encode the real content after a delimiter so Chrome never filters these out.
          const suggestions = looseCandidates.map((candidate, idx) => ({
            content: `${trimmedText}__loose_${idx}_${encodeURIComponent(candidate.content)}`,
            description: candidate.description,
          }));
          chrome.omnibox.setDefaultSuggestion({ description: suggestions[0].description });
          suggest(suggestions.slice(1));
          return;
        }

        suggest([]);
        return;
      }

      handleTypedInput(prefix, type, query, suggest, localData, text);
    };

    void runSuggestions();
  });

  // Extract the main suggestion logic to a separate helper function
  function handleTypedInput(
    prefix: string,
    type: 'note' | 'link' | 'command' | 'session' | 'prompt' | 'automation' | 'agent' | 'todo' | 'snippet',
    query: string,
    suggest: (suggestResults: chrome.omnibox.SuggestResult[]) => void,
    localData: OmniboxLocalData,
    rawText?: string,
  ) {
    // ── Notes / Links ──────────────────────────────────────────────────────
    if (type === 'link' || type === 'note') {
      const typeLabel = type === 'link' ? 'Link' : 'Note';

      if (query.trim() === '') {
        const allItems: any[] = type === 'link' ? localData.links || [] : localData.notes || [];
        const prefixChar = prefix;

        // User-assigned shortcuts for this type — shown first
        const emptyShortcuts = (localData.userShortcuts || []).filter(
          (s: any) => s.referenceType === type,
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
            return {
              content: `${prefixChar} ${trigger}`,
              description: formatSuggestionDescription(targetTitle, type === 'link' ? 'Links' : 'Notes', trigger),
            };
          }),
          ...itemsWithoutShortcut.slice(0, 40).map((item: any) => ({
            content: `${prefixChar} ${item.title || ''}`,
            description: formatSuggestionDescription(item.title || item.id || 'Untitled', type === 'link' ? 'Links' : 'Notes', prefixChar),
          })),
        ];

        if (allSuggestions.length > 0) {
          chrome.omnibox.setDefaultSuggestion({ description: allSuggestions[0].description });
          suggest(allSuggestions.slice(1));
        } else {
          chrome.omnibox.setDefaultSuggestion({ description: `No ${type}s saved yet` });
          suggest([]);
        }
        return;
      }

      const allItems: any[] = type === 'link' ? localData.links || [] : localData.notes || [];

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
            entry.shortcut.referenceType === type && entry.rank !== null,
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
        chrome.omnibox.setDefaultSuggestion({
          description: query ? `No ${type}s found matching <match>${query}</match>` : `No ${type}s saved yet`,
        });
        suggest([]);
        return;
      }

      const prefixChar = prefix || (type === 'link' ? 'l' : 'n');

      const allSuggestions: Array<{ content: string; description: string }> = [
        // Shortcuts first (ranked higher)
        ...shortcutMatches.map((s: any) => {
          const refUuid = extractSnippetId(s.referenceId);
          let targetTitle = 'Untitled';
          if (s.referenceType === 'note') {
            const note = (localData.notes || []).find((n: any) => {
              const nid = n.id ?? '';
              return isSameSnippetIdentity(nid, s.referenceId) || extractSnippetId(nid) === refUuid;
            });
            if (note) targetTitle = note.title || 'Untitled Note';
          } else if (s.referenceType === 'link') {
            const link = (localData.links || []).find((l: any) => {
              const lid = l.id ?? l.snippet_id ?? '';
              return isSameSnippetIdentity(lid, s.referenceId) || extractSnippetId(lid) === refUuid;
            });
            if (link) targetTitle = link.title || 'Untitled Link';
          }
          return {
            content: `${prefixChar} ${normalizeShortcutTrigger(s.trigger || '')}`,
            description: formatSuggestionDescription(targetTitle, type === 'link' ? 'Links' : 'Notes', normalizeShortcutTrigger(s.trigger || '')),
          };
        }),
        // Then items without shortcuts (no duplicates)
        ...titleMatches.map((item: any) => ({
          content: `${prefixChar} ${item.title || ''}`,
          description: formatSuggestionDescription(item.title || item.id || 'Untitled', type === 'link' ? 'Links' : 'Notes', prefixChar),
        })),
      ];

      if (allSuggestions.length > 0) {
        chrome.omnibox.setDefaultSuggestion({ description: allSuggestions[0].description });
      }
      suggest(allSuggestions.slice(1));
      return;
    }

    // ── Commands ─────────────────────────────────────────────────────────
    if (type === 'session') {
      if (query.trim() === '') {
        const sessionPrefix = prefix || 's';
        // User-assigned session shortcuts — shown first
        const emptySessionShortcuts = (localData.userShortcuts || []).filter(
          (s: any) => isShortcutOfType(s, 'session'),
        );

        // Sessions without a shortcut assigned
        const sessionsWithoutShortcut = (localData.sessions || []).filter(
          (session: SessionRecord) => !shouldHideItemBecauseShortcutExists(session, emptySessionShortcuts, 'session'),
        );

        const allSuggestions: Array<{ content: string; description: string }> = [
          ...emptySessionShortcuts.map((shortcut: any) => {
            const targetSession = findSessionByReferenceId(String(shortcut.referenceId || ''), localData.sessions || []);
            const sessionTitle = getSessionSearchTitle(targetSession) || 'Untitled Session';
            const trigger = normalizeShortcutTrigger(shortcut.trigger || '');
            return {
              content: `${sessionPrefix} ${trigger}`,
              description: formatSuggestionDescription(sessionTitle, 'Sessions', trigger),
            };
          }),
          ...sessionsWithoutShortcut.slice(0, 40).map((session: SessionRecord) => ({
            content: getSessionSuggestionContent(sessionPrefix, String(session.id || '')),
            description: formatSuggestionDescription(getSessionSearchTitle(session) || String(session.id || 'Untitled Session'), 'Sessions', sessionPrefix),
          })),
        ];

        if (allSuggestions.length > 0) {
          chrome.omnibox.setDefaultSuggestion({ description: allSuggestions[0].description });
          suggest(allSuggestions.slice(1));
        } else {
          chrome.omnibox.setDefaultSuggestion({ description: 'No sessions saved yet' });
          suggest([]);
        }
        return;
      }

      const sessionMatches = (localData.sessions || [])
        .map((session: SessionRecord) => ({
          session,
          rank: rankByQuery(getSessionSearchTitle(session), query),
        }))
        .filter((entry): entry is { session: SessionRecord; rank: number } => entry.rank !== null)
        .sort(
          (a, b) =>
            a.rank - b.rank || getSessionSearchTitle(a.session).length - getSessionSearchTitle(b.session).length,
        )
        .map(entry => entry.session);

      const shortcutMatches = (localData.userShortcuts || [])
        .map((s: any) => ({
          shortcut: s,
          rank: rankByQuery(s.trigger || '', query),
        }))
        .filter(
          (entry): entry is { shortcut: any; rank: number } =>
            isShortcutOfType(entry.shortcut, 'session') && entry.rank !== null,
        )
        .sort(
          (a, b) =>
            a.rank - b.rank || String(a.shortcut.trigger || '').length - String(b.shortcut.trigger || '').length,
        )
        .map(entry => entry.shortcut);

      const titleMatches = sessionMatches.filter(
        (session: SessionRecord) => !shouldHideItemBecauseShortcutExists(session, shortcutMatches, 'session'),
      );

      if (titleMatches.length === 0 && shortcutMatches.length === 0) {
        chrome.omnibox.setDefaultSuggestion({
          description: `No sessions found matching <match>${query}</match>`,
        });
        suggest([]);
        return;
      }

      const sessionPrefix = prefix || 's';
      const allSuggestions: Array<{ content: string; description: string }> = [
        ...shortcutMatches.map((shortcut: any) => {
          const targetSession = findSessionByReferenceId(String(shortcut.referenceId || ''), localData.sessions || []);
          const sessionTitle = getSessionSearchTitle(targetSession) || 'Untitled Session';
          return {
            content: `${sessionPrefix} ${normalizeShortcutTrigger(shortcut.trigger || '')}`,
            description: formatSuggestionDescription(sessionTitle, 'Sessions', normalizeShortcutTrigger(shortcut.trigger || '')),
          };
        }),
        ...titleMatches.map((session: SessionRecord) => ({
          content: getSessionSuggestionContent(sessionPrefix, String(session.id || '')),
          description: formatSuggestionDescription(getSessionSearchTitle(session) || String(session.id || 'Untitled Session'), 'Sessions', sessionPrefix),
        })),
      ];

      chrome.omnibox.setDefaultSuggestion({ description: allSuggestions[0].description });
      suggest(allSuggestions.slice(1));
      return;
    }

    if (type === 'command') {
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
          .map((c: CommandRecord) => ({
            content: `${commandPrefix} ${c.id}`,
            description: formatSuggestionDescription(c.label || c.id, 'System', c.prefix || commandPrefix),
          }));

        if (allSuggestions.length > 0) {
          chrome.omnibox.setDefaultSuggestion({ description: allSuggestions[0].description });
          suggest(allSuggestions.slice(1));
        } else {
          chrome.omnibox.setDefaultSuggestion({
            description: 'No commands saved yet',
          });
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
            entry.shortcut.referenceType === 'command' && entry.rank !== null,
        )
        .sort(
          (a, b) =>
            a.rank - b.rank || String(a.shortcut.trigger || '').length - String(b.shortcut.trigger || '').length,
        )
        .map(entry => entry.shortcut);

      if (commandMatches.length === 0 && commandShortcutMatches.length === 0) {
        chrome.omnibox.setDefaultSuggestion({
          description: commandKey ? `No commands found matching <match>${commandKey}</match>` : 'No commands saved yet',
        });
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
          return {
            content: `${contentBase}__shortcut_${trigger}`,
            description: formatSuggestionDescription(targetTitle, 'System', trigger),
          };
        }),
        ...commandMatches.map((c: CommandRecord, idx: number) => ({
          content: `${contentBase}__cmd_${idx}_${c.id}`,
          description: prompt 
            ? formatSuggestionDescription(escapeXml(c.label || c.id) + ` <dim>- prompt: <match>${escapeXml(prompt)}</match></dim>`, 'System', c.prefix || commandPrefix, true)
            : formatSuggestionDescription(c.label || c.id, 'System', c.prefix || commandPrefix),
        })),
      ];

      if (allSuggestions.length > 0) {
        chrome.omnibox.setDefaultSuggestion({ description: allSuggestions[0].description });
        suggest(allSuggestions.slice(1));
      } else {
        chrome.omnibox.setDefaultSuggestion({
          description: 'No commands saved yet',
        });
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

      if (query.trim() === '') {
        // User-assigned shortcuts for this type — shown first
        const emptyTypeShortcuts = (localData.userShortcuts || []).filter(
          (s: any) => s.referenceType === type,
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
            return {
              content: `${prefix} ${trigger}`,
              description: formatSuggestionDescription(targetTitle, typeLabel + 's', trigger),
            };
          }),
          ...itemsWithoutShortcut.slice(0, 40).map((item: any) => ({
            content: `${prefix} ${item.title || item.name || item.id || ''}`,
            description: formatSuggestionDescription(item.title || item.name || item.id || 'Untitled', typeLabel + 's', prefix),
          })),
        ];

        if (allSuggestions.length > 0) {
          chrome.omnibox.setDefaultSuggestion({ description: allSuggestions[0].description });
          suggest(allSuggestions.slice(1));
        } else {
          chrome.omnibox.setDefaultSuggestion({ description: `No ${type}s saved yet` });
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
            entry.shortcut.referenceType === type && entry.rank !== null,
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
        chrome.omnibox.setDefaultSuggestion({
          description: `No ${type}s found matching <match>${query}</match>`,
        });
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
          return {
            content: `${prefix} ${trigger}`,
            description: formatSuggestionDescription(targetTitle, typeLabel + 's', trigger),
          };
        }),
        // Then title matches (no duplicates)
        ...titleMatches.map(item => ({
          content: `${prefix} ${item.title || item.name || ''}`,
          description: formatSuggestionDescription(item.title || item.name || item.id || 'Untitled', typeLabel + 's', prefix),
        })),
      ];

      chrome.omnibox.setDefaultSuggestion({ description: allSuggestions[0].description });
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
        },
        {} as chrome.runtime.MessageSender,
        () => {},
      );
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

      if (isLegacySessionShortcut(shortcut)) {
        const session = findSessionByReferenceId(String(shortcut.referenceId || ''), localData.sessions || []);
        if (session) {
          const ok = executeSession(session);
          recordShortcutUse(ok, ok ? undefined : 'execution_failed', getSessionSearchTitle(session));
          return ok;
        }
      }

      const normalizedReferenceType = String(shortcut.referenceType || '').toLowerCase();
      if (['prompt', 'aiprompt', 'ai_prompt'].includes(normalizedReferenceType) || normalizedReferenceType === 'automation') {
        const promptRecord = (localData.aiPrompts || []).find((prompt: AiPromptRecord) =>
          isSameSnippetIdentity(prompt.id, shortcut.referenceId),
        );
        if (promptRecord) {
          const ok = executeAiPrompt(promptRecord, temporaryPrompt, runFromCommandShortcut);
          recordShortcutUse(ok, ok ? undefined : 'execution_failed', promptRecord.title || promptRecord.id);
          return ok;
        }
      }

      if (shortcut.referenceType === 'note') {
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
      if (shortcut.referenceType === 'link') {
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
      if (shortcut.referenceType === 'command') {
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
      if (shortcut.referenceType === 'session') {
        const session = findSessionByReferenceId(String(shortcut.referenceId || ''), localData.sessions || []);
        if (session) {
          const ok = executeSession(session);
          recordShortcutUse(ok, ok ? undefined : 'execution_failed', getSessionSearchTitle(session));
          return ok;
        }

        console.warn('[Omnibox] Session not found for shortcut:', shortcut);
        recordShortcutUse(false, 'entity_not_found');
      }
      return false;
    };

    const findAiPromptCommandInvocation = (rawQuery: string) => {
      const lowerQuery = rawQuery.toLowerCase();
      return (userShortcuts || [])
        .map((shortcut: any) => {
          const referenceType = String(shortcut.referenceType || '').toLowerCase();
          if (!['prompt', 'aiprompt', 'ai_prompt', 'automation'].includes(referenceType)) return null;

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
          if (String(shortcut.referenceType || '').toLowerCase() !== 'link') return null;

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
      // Re-use the existing [Command]/[Note]/[Link]/[Session] parsing path by
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
      if (reText.startsWith('[Session] ')) {
        const title = reText.slice('[Session] '.length);
        const session = findSessionByQuery(title, localData.sessions || []);
        if (session) { executeSession(session); return; }
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

    if (!type) {
      const trimmedText = text.trim();
      const normalizedText = normalizeShortcutTrigger(trimmedText);
      if (!normalizedText) {
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
      const looseCandidates = buildLooseCandidates(normalizedText, localData);
      runLooseCandidates(looseCandidates, {
        executeShortcut,
        executeSession: session => {
          executeSession(session);
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

    // 1. Try User Shortcuts First (match exact trigger)
    const normalizedQuery = normalizeShortcutTrigger(query);
    const shortcutMatch =
      type === 'command'
        ? findBestShortcutMatch(normalizedQuery, userShortcuts, 'command')
        : type === 'session'
          ? (userShortcuts || [])
              .filter((shortcut: any) => isShortcutOfType(shortcut, 'session'))
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
    if (type === 'note' || type === 'link' || type === 'session') {
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
      } else if (type === 'session') {
        const target = findSessionByQuery(query, localData.sessions || []);
        if (target) {
          executeSession(target);
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
      type === 'session' ||
      type === 'prompt' ||
      type === 'automation' ||
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
