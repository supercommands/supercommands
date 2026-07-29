/**
 * @file omniboxEvents.ts
 * @description Handles Chrome omnibox API events and interactions.
 */
import 'webextension-polyfill';
import { handleAiTabMessage } from '../../browserWindows/chatRuntimeEngine';
import {
  getAllUserShortcuts,
  normalizeShortcutTrigger,
} from '../../../../src/shared-components/shortcuts/core/shortcutDbData';
import {
  CustomSearchPrefixesForOmniboxStorage,
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

const SESSION_SUGGESTION_ID_PREFIX = 'id:';

export function formatSuggestionDescription(title: string, category: string, prefix: string): string {
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
  return `${emoji}  <match>${title}</match>  <dim>  ${category} - (c ${prefix})</dim>`;
}

const AI_COMMANDS: Record<string, string> = {
  gpt: 'chatgpt',
  chatgpt: 'chatgpt',
  gemini: 'gemini',
  claude: 'claude',
  perplexity: 'perplexity',
};

const URL_COMMANDS: Record<string, string> = {
  google: 'https://google.com/search?q={query}',
  youtube: 'https://www.youtube.com/results?search_query={query}',
  history: 'chrome://history',
  downloads: 'chrome://downloads',
  extensions: 'chrome://extensions',
  settings: 'chrome://settings',
};

const OMNIBOX_STATE_TTL_MS = 300;
const DEFAULT_OMNIBOX_PREFIXES: {
  note: readonly string[];
  link: readonly string[];
  command: readonly string[];
  session: readonly string[];
  prompt: readonly string[];
  automation: readonly string[];
  agent: readonly string[];
  todo: readonly string[];
  snippet: readonly string[];
} = {
  note: ['n', 'note'],
  link: ['l', 'link'],
  command: ['c', 'cmd', 'command'],
  session: ['s', 'session'],
  prompt: ['p', 'prompt'],
  automation: ['a', 'auto', 'automation', 'agent'],
  agent: ['g', 'chat'],
  todo: ['t', 'todo'],
  snippet: ['sn', 'snippet'],
} as const;

const HIDDEN_OMNIBOX_COMMAND_IDS = new Set(['gpt', 'claude', 'gemini', 'perplexity']);

const isDashboardVisibleCommand = (command: CommandRecord | null | undefined) => command?.showInDashboard !== false;

const isOmniboxVisibleCommand = (command: CommandRecord | null | undefined) => {
  if (!isDashboardVisibleCommand(command) || command?.surface === 'website') return false;
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

/** Best-effort title for a snippet — covers all known field names */
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
 * Builds the dynamic registry from local commands.
 * Each content type (note, link, command) gets exactly ONE prefix.
 * Priority: commands table > customPrefixes > built-in default.
 * If the user changes the prefix (e.g. note: n → d), 'n' is NOT added.
 */
export function buildRegistry(
  commands: CommandRecord[],
  customPrefixes: CustomOmniboxPrefixes | null,
): Record<string, 'note' | 'link' | 'command' | 'session' | 'prompt' | 'automation' | 'agent' | 'todo' | 'snippet'> {
  // Start from commands table (highest priority — these are user-edited command prefixes)
  let noteKey: string | null = null;
  let linkKey: string | null = null;
  let commandKey: string | null = null;

  for (const cmd of commands.filter(isOmniboxVisibleCommand)) {
    if (cmd.id === 'search_notes' && cmd.prefix && cmd.prefix.trim()) {
      noteKey = cmd.prefix.replace(/^\/+/, '').trim().toLowerCase();
    } else if (cmd.id === 'search_links' && cmd.prefix && cmd.prefix.trim()) {
      linkKey = cmd.prefix.replace(/^\/+/, '').trim().toLowerCase();
    } else if (cmd.id === 'search_commands' && cmd.prefix && cmd.prefix.trim()) {
      commandKey = cmd.prefix.replace(/^\/+/, '').trim().toLowerCase();
    }
  }

  let sessionKey = 's';
  let promptKey = 'p';
  let automationKey = 'a';
  let agentKey = 'g';
  let todoKey = 't';
  let snippetKey = 'sn';

  // Then check customPrefixes (user omnibox settings) — overrides commands table
  if (customPrefixes?.note && customPrefixes.note.trim()) noteKey = customPrefixes.note.trim().toLowerCase();
  if (customPrefixes?.link && customPrefixes.link.trim()) linkKey = customPrefixes.link.trim().toLowerCase();
  if (customPrefixes?.command && customPrefixes.command.trim())
    commandKey = customPrefixes.command.trim().toLowerCase();
  if (customPrefixes?.session && customPrefixes.session.trim())
    sessionKey = customPrefixes.session.trim().toLowerCase();
  if (customPrefixes?.prompt && customPrefixes.prompt.trim()) promptKey = customPrefixes.prompt.trim().toLowerCase();
  if (customPrefixes?.automation && customPrefixes.automation.trim())
    automationKey = customPrefixes.automation.trim().toLowerCase();
  if (customPrefixes?.agent && customPrefixes.agent.trim()) agentKey = customPrefixes.agent.trim().toLowerCase();
  if (customPrefixes?.todo && customPrefixes.todo.trim()) todoKey = customPrefixes.todo.trim().toLowerCase();
  if (customPrefixes?.snippet && customPrefixes.snippet.trim())
    snippetKey = customPrefixes.snippet.trim().toLowerCase();

  // Build registry with exactly one entry per type.
  // Only fall back to built-in default (n/l/c) if user hasn't configured ANYTHING.
  const registry: Record<string, string> = {};
  const usedPrefixes = new Set<string>();

  registry[resolveUniquePrefix('note', [noteKey, 'n', 'note'], usedPrefixes)] = 'note';
  registry[resolveUniquePrefix('link', [linkKey, 'l', 'link'], usedPrefixes)] = 'link';
  registry[resolveUniquePrefix('command', [commandKey, 'c', 'cmd', 'command'], usedPrefixes)] = 'command';
  registry[resolveUniquePrefix('session', [sessionKey, 's', 'session'], usedPrefixes)] = 'session';
  registry[resolveUniquePrefix('prompt', [promptKey, 'p', 'prompt'], usedPrefixes)] = 'prompt';
  registry[resolveUniquePrefix('automation', [automationKey, 'a', 'auto', 'automation', 'agent'], usedPrefixes)] =
    'automation';
  registry[resolveUniquePrefix('agent', [agentKey, 'g', 'chat'], usedPrefixes)] = 'agent';
  registry[resolveUniquePrefix('todo', [todoKey, 't', 'todo'], usedPrefixes)] = 'todo';
  registry[resolveUniquePrefix('snippet', [snippetKey, 'sn', 'snippet'], usedPrefixes)] = 'snippet';

  return registry as Record<
    string,
    'note' | 'link' | 'command' | 'session' | 'prompt' | 'automation' | 'agent' | 'todo' | 'snippet'
  >;
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
      CustomSearchPrefixesForOmniboxStorage.getPrefixes().catch(() => ({ note: 'n', link: 'l', command: 'c' })),
    ]);

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

function resolveUniquePrefix(
  type: 'note' | 'link' | 'command' | 'session' | 'prompt' | 'automation' | 'agent' | 'todo' | 'snippet',
  candidates: Array<string | null | undefined>,
  usedPrefixes: Set<string>,
): string {
  for (const candidate of candidates) {
    const normalized = normalizeOmniboxKey(candidate);
    if (!normalized) continue;
    if (usedPrefixes.has(normalized)) continue;

    usedPrefixes.add(normalized);
    return normalized;
  }

  const fallback =
    DEFAULT_OMNIBOX_PREFIXES[type].find(prefix => !usedPrefixes.has(prefix)) ?? `${type}-${usedPrefixes.size}`;
  usedPrefixes.add(fallback);
  console.warn(`[Omnibox] Prefix collision for ${type}; falling back to "${fallback}"`);
  return fallback;
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

const pushCandidate = (candidates: LooseMatchCandidate[], candidate: LooseMatchCandidate | null) => {
  if (candidate) candidates.push(candidate);
};

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

const normalizeIdentityKey = (value: any) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const collectIdentityKeys = (...values: any[]) => {
  const keys = new Set<string>();
  values.forEach(value => {
    const normalized = normalizeIdentityKey(value);
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

    const targetTitle =
      effectiveReferenceType === 'note'
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

    pushCandidate(candidates, {
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

    pushCandidate(candidates, {
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

    pushCandidate(candidates, {
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

    pushCandidate(candidates, {
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

    pushCandidate(candidates, {
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

      pushCandidate(candidates, {
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

export function setupOmnibox() {
  // Set the default suggestion globally so Chrome registers it immediately before the user even types
  chrome.omnibox.setDefaultSuggestion({
    description: 'cmdOS: <match>Press Space</match> to view your commands, or type a prefix (like p, n, l)',
  });

  // Pre-warm cache immediately when the service worker starts (before user even opens omnibox)
  warmCache();

  // Re-warm on each activation to pick up any data changes
  chrome.omnibox.onInputStarted.addListener(() => {
    isCacheReady = false;
    warmCache();
  });

  // ── onInputChanged: load from cache with promise fallback ────────────────
  chrome.omnibox.onInputChanged.addListener((text, suggest) => {
    const runSuggestions = async () => {
      const { localData, customPrefixes } = await getResolvedOmniboxState();
      const registry = buildRegistry(localData.commands || [], customPrefixes);
      const { prefix, type, query } = parseInput(text, registry);

      const notePrefix = Object.keys(registry).find(k => registry[k] === 'note') || 'n';
      const linkPrefix = Object.keys(registry).find(k => registry[k] === 'link') || 'l';

      // No recognised prefix yet — show navigation hint or match prefix-less shortcuts
      if (!type) {
        const trimmedText = text.trim();
        if (trimmedText === '') {
          // When the user freshly enters extension mode (empty text), immediately show all commands.
          handleTypedInput('', 'command', '', suggest, localData);
          return;
        }

        const normalizedText = normalizeShortcutTrigger(trimmedText);
        if (!normalizedText) {
          suggest([]);
          return;
        }
        const looseCandidates = buildLooseCandidates(normalizedText, localData);

        if (looseCandidates.length > 0) {
          const suggestions = looseCandidates.map(candidate => ({
            content: candidate.content,
            description: candidate.description,
          }));
          chrome.omnibox.setDefaultSuggestion({ description: suggestions[0].description });
          suggest(suggestions.slice(1));
          return;
        }

        suggest([]);
        return;
      }

      handleTypedInput(prefix, type, query, suggest, localData);
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
  ) {
    // ── Notes / Links ──────────────────────────────────────────────────────
    if (type === 'link' || type === 'note') {
      const typeLabel = type === 'link' ? 'Link' : 'Note';

      if (query.trim() === '') {
        const allItems: any[] = type === 'link' ? localData.links || [] : localData.notes || [];

        const prefixChar = prefix || (type === 'link' ? 'l' : 'n');

        const allSuggestions = allItems.slice(0, 50).map(item => ({
          content: `${prefixChar} ${item.title || ''}`,
          description: formatSuggestionDescription(item.title || item.id || 'Untitled', type === 'link' ? 'Links' : 'Notes', prefixChar),
        }));

        if (allSuggestions.length > 0) {
          chrome.omnibox.setDefaultSuggestion({ description: allSuggestions[0].description });
          suggest(allSuggestions.slice(1));
        } else {
          chrome.omnibox.setDefaultSuggestion({
            description: `No ${type}s saved yet`,
          });
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

      // De-duplicate: collect the snippet IDs already covered by a shortcut entry
      // so each item appears exactly once (as shortcut if it has one, otherwise as title)
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

      // Suggestions are ranked by shortcut first, then deterministic title matches.
      // — no fragile title matching needed even when titles are empty or partial
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

    // ── Commands ───────────────────────────────────────────────────────────
    if (type === 'session') {
      if (query.trim() === '') {
        const sessionPrefix = prefix || 's';
        const allSuggestions = (localData.sessions || []).slice(0, 50).map((session: SessionRecord) => ({
          content: getSessionSuggestionContent(sessionPrefix, String(session.id || '')),
          description: formatSuggestionDescription(getSessionSearchTitle(session) || String(session.id || 'Untitled Session'), 'Sessions', sessionPrefix),
        }));

        if (allSuggestions.length > 0) {
          chrome.omnibox.setDefaultSuggestion({ description: allSuggestions[0].description });
          suggest(allSuggestions.slice(1));
        } else {
          chrome.omnibox.setDefaultSuggestion({
            description: 'No sessions saved yet',
          });
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
      suggest(allSuggestions);
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
        .map((command: CommandRecord) => ({
          command,
          rank: bestRankByQuery(commandKey, command.label || '', command.prefix || '', command.id || ''),
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
      const allSuggestions: Array<{ content: string; description: string }> = [
        ...commandShortcutMatches.map((s: any) => {
          const trigger = normalizeShortcutTrigger(s.trigger || '');
          const command = localData.commands.find(c => String(c.id || '') === String(s.referenceId || ''));
          const targetTitle = command ? (command.label || command.id) : trigger;
          
          return {
            content: `${commandPrefix} ${trigger}`,
            description: formatSuggestionDescription(targetTitle, 'System', trigger),
          };
        }),
        ...commandMatches.map((c: CommandRecord) => ({
          content: `${commandPrefix} ${c.id}${prompt ? ' ' + prompt : ''}`,
          description: prompt 
            ? formatSuggestionDescription((c.label || c.id) + ` <dim>- prompt: <match>${prompt}</match></dim>`, 'System', c.prefix || commandPrefix)
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
        const allSuggestions = items.slice(0, 50).map(item => ({
          content: `${prefix} ${item.title || item.name || item.id || ''}`,
          description: formatSuggestionDescription(item.title || item.name || item.id || 'Untitled', typeLabel + 's', prefix),
        }));

        if (allSuggestions.length > 0) {
          chrome.omnibox.setDefaultSuggestion({ description: allSuggestions[0].description });
          suggest(allSuggestions.slice(1));
        } else {
          chrome.omnibox.setDefaultSuggestion({
            description: `No ${type}s saved yet`,
          });
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

      if (rawTitleMatches.length === 0) {
        chrome.omnibox.setDefaultSuggestion({
          description: `No ${type}s found matching <match>${query}</match>`,
        });
        suggest([]);
        return;
      }

      const allSuggestions = rawTitleMatches.map(item => ({
        content: `${prefix} ${item.title || item.name || ''}`,
        description: formatSuggestionDescription(item.title || item.name || item.id || 'Untitled', typeLabel + 's', prefix),
      }));

      chrome.omnibox.setDefaultSuggestion({ description: allSuggestions[0].description });
      suggest(allSuggestions.slice(1));
      return;
    }
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
      const aiKind = AI_COMMANDS[command.id];
      if (aiKind) {
        let url = 'https://chatgpt.com';
        if (aiKind === 'gemini') url = 'https://gemini.google.com/app';
        if (aiKind === 'claude') url = 'https://claude.ai/new';
        if (aiKind === 'perplexity') url = 'https://www.perplexity.ai/';

        handleAiTabMessage(
          {
            action: 'open_tab_with_auto_submit',
            url,
            autoSubmit: { kind: aiKind, prompt },
            forceNewTab: disposition !== 'currentTab',
          },
          {} as any,
          () => {},
        );
        return true;
      }

      const urlTemplate = URL_COMMANDS[command.id];
      if (urlTemplate) {
        let finalUrl = urlTemplate;
        if (prompt && finalUrl.includes('{query}')) {
          finalUrl = finalUrl.replace('{query}', encodeURIComponent(prompt));
        }

        if (disposition === 'currentTab') {
          chrome.tabs.update({ url: finalUrl });
        } else {
          chrome.tabs.create({ url: finalUrl, active: disposition !== 'newBackgroundTab' });
        }
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

    const executeShortcut = (shortcut: any) => {
      const rawSnippetId = extractSnippetId(shortcut.referenceId);

      if (isLegacySessionShortcut(shortcut)) {
        const session = findSessionByReferenceId(String(shortcut.referenceId || ''), localData.sessions || []);
        if (session) {
          return executeSession(session);
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
            openUrls(urls);
            return true;
          }
        }

        console.warn('[Omnibox] Link not found or has no URLs for shortcut:', shortcut);
      }
      if (shortcut.referenceType === 'command') {
        const command = localData.commands.find(
          (c: CommandRecord) => String(c.id || '') === String(shortcut.referenceId || ''),
        );
        if (command) {
          return executeCommand(command);
        }

        console.warn('[Omnibox] Command not found for shortcut:', shortcut);
      }
      if (shortcut.referenceType === 'session') {
        const session = findSessionByReferenceId(String(shortcut.referenceId || ''), localData.sessions || []);
        if (session) {
          return executeSession(session);
        }

        console.warn('[Omnibox] Session not found for shortcut:', shortcut);
      }
      return false;
    };

    // ─── First parse bracketed loose match content ───────────────────────────
    if (text.startsWith('[Shortcut] ') || text.startsWith('[Command] ')) {
      const prefixLength = text.startsWith('[Shortcut] ') ? '[Shortcut] '.length : '[Command] '.length;
      const cmdKey = text.slice(prefixLength).trim();

      const shortcut = userShortcuts.find(
        s => normalizeShortcutTrigger(s.trigger || '') === normalizeShortcutTrigger(cmdKey),
      );
      if (shortcut && executeShortcut(shortcut)) return;

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
          rank: bestRankByQuery(commandKey, command.label || '', command.prefix || '', command.id || ''),
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
