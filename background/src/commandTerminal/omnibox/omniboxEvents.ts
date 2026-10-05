import { getInternalDashboardSessionIds, type WidgetDashboardRecord } from '../../../../src/allObjectFolder/src/createObject/widgets/widgetTypes';
/**
 * @file omniboxEvents.ts
 * @description Handles Chrome omnibox API events and interactions.
 */
import 'webextension-polyfill';
import { liveQuery, type Subscription } from 'dexie';
import { triggerInPlaceCommand } from '../inPlaceCommands/triggerInPlaceCommand';
import {
  getAllUserShortcuts,
  normalizeShortcutTrigger,
} from '../../../../src/shared-components/shortcuts/core/shortcutDbData';
import {
  CommandTerminalPrefixStorage,
  type CommandTerminalPrefixes,
} from '../../../../src/storage/commandTerminal/commandTerminalPrefixAdapter';

import type { NoteRecord } from '../../../../src/allObjectFolder/src/createObject/notes/noteTypes';
import type { LinkRecord } from '../../../../src/allObjectFolder/src/createObject/links/linkTypes';
import type { CommandRecord } from '../../../../src/allObjectFolder/src/createObject/commands/commandTypes';
import type { SessionRecord } from '../../../../src/allObjectFolder/src/createObject/session/sessionTypes';
import type { AiPromptRecord } from '../../../../src/allObjectFolder/src/createObject/aiPrompt/aiPromptTypes';
import type { ChatAgentRecord } from '../../../../src/allObjectFolder/src/createObject/ChatAgent/chatAgentTypes';
import type { SnippetRecord } from '../../../../src/allObjectFolder/src/createObject/snippets/snippetTypes';
import type { TodoRecord } from '../../../../src/allObjectFolder/src/createObject/todos/todoTypes';
import type { CollectionRecord, CollectionItemRecord } from '../../../../src/allObjectFolder/src/createObject/collections/collectionTypes';
import type { PrefixSettingRecord } from '../../../../src/allObjectFolder/src/createObject/prefixSettings/prefixSettingTypes';

import { db } from '../../../../src/storage/indexDB/dbConfig';
import { getSmartDefaultOrganisation } from '../../../../src/storage/localStorage/lastUsedOrganisation';
import { handleSessionMessage, openOrReuseNoteSnippetTabInWindow } from '../../browserWindows/sessions';
import {
  buildShortcutPrefixRegistry,
  getCommandSpacePrefix,
  getMatchingShortcutAssignments,
  getNoteQuickCreatePrefixLabels,
  parseNoteQuickCreateFields,
  recordAssignedTriggerUsage,
  resolveShortcutPrefix,
} from '../../../../src/shared-components/triggers';
import { injectLinkQueryValues } from './linkQueryInjection';
import { getAllCommands, syncCommandsFromSource } from '../../../../src/allObjectFolder/src/createObject/commands/commandData';
import { createNote, updateNote } from '../../../../src/allObjectFolder/src/createObject/notes/noteData';
import { createTag } from '../../../../src/allObjectFolder/src/createObject/tags/tagData';
import {
  buildCommandTerminalNewtabPath,
  resolveCommandTerminalCommandLaunch,
} from '../../../../src/shared-components/commandTerminal/runtime';
import { isRetiredCreateCommandId } from '../../../../src/shared-components/commands/prefixCategoryReplacements';
import {
  createCommandTerminalSearchData,
  findBestCommandTerminalItemMatch,
  searchCommandTerminalCommands,
  searchCommandTerminalItems,
} from '../../../../src/shared-components/commandTerminal/search';
import { getOrganisationDashboardViews } from '../../../../src/pages/AltS_search_newtab/src/components/widgets/engine/widgetDashboardData';
import { openTextCommandEntity } from '../../websitePopupBridge/resultExecutionHandler';
import { openWebCollection } from '../../collections/openWebCollection';
import { getWebCollectionSearchFields, selectVisibleWebCollectionRecords, withWebCollectionNames } from '../../../../src/shared-components/collections/webCollectionSearch';

const SESSION_SUGGESTION_ID_PREFIX = 'id:';

type WidgetViewRecord = {
  id: string;
  title?: string;
  organisationId?: string;
  settings?: Record<string, unknown>;
  createdAt?: number;
  updatedAt?: number;
};

type CollectionOpenBehavior = 'focus_mode';
type OmniboxCreateAction = 'note' | 'link' | 'todo' | 'snippet' | 'prompt' | 'agent';

const OMNIBOX_CREATE_ACTION_META: Record<OmniboxCreateAction, { label: string; category: string }> = {
  note: { label: 'Create Note', category: 'Notes' },
  link: { label: 'Create Link', category: 'Links' },
  todo: { label: 'Create Todo', category: 'Todos' },
  snippet: { label: 'Create Text Expander', category: 'Snippets' },
  prompt: { label: 'Create AI Prompt', category: 'AI Prompts' },
  agent: { label: 'Create Chat Agent', category: 'Chat Agents' },
};

const isOmniboxCreateAction = (type: string | null | undefined): type is OmniboxCreateAction =>
  type === 'note' || type === 'link' || type === 'todo' || type === 'snippet' || type === 'prompt' || type === 'agent';

const normalizeWidgetViewsForOmnibox = (widgetViews: WidgetViewRecord[]): WidgetViewRecord[] => {
  const seenViewIds = new Set<string>();

  return getOrganisationDashboardViews(widgetViews)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .filter(view => {
      const viewId = String(view?.id || '').trim();
      if (viewId) {
        if (seenViewIds.has(viewId)) return false;
        seenViewIds.add(viewId);
      }
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

export function formatSuggestionDescription(title: string, category: string, prefix: string, isAlreadyEscaped = false, commandPrefix = 'c'): string {
  let emoji = '🔍'; // fallback
  switch (category) {
    case 'Notes': emoji = '📄'; break;
    case 'Links': emoji = '🔗'; break;
    case 'System': emoji = '⚙\uFE0E'; break;
    case 'Collections': emoji = '⊞'; break; // Looks like the 2x2 grid
    case 'Web Collections': emoji = '⊞'; break;
    case 'Web Collection Items': emoji = '⊞'; break;
    case 'Prompts': emoji = '💬'; break;
    case 'Agents': emoji = '🤖'; break;
    case 'Todos': emoji = '☑️'; break; // Checkbox
    case 'Snippets': emoji = 'SN'; break; // Text Expander icon
    case 'Shortcuts': emoji = '⌘'; break; // Command icon
  }
  const safeTitle = isAlreadyEscaped ? title : escapeXml(title);
  return `${escapeXml(emoji)}  <match>${safeTitle}</match>  <dim>  ${escapeXml(category)}${prefix ? `  (${escapeXml(commandPrefix)} ${escapeXml(prefix)})` : ''}</dim>`;
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
  if (command?.enabled === false) return false;
  if (command?.showInDashboard === false) return false;
  if (HIDDEN_OMNIBOX_COMMAND_IDS.has(String(command?.id || '').toLowerCase())) return false;
  if (isRetiredCreateCommandId(command?.id)) return false;
  return Boolean(command?.prefix && command.prefix.trim().length > 0);
};

// ─── Data helpers ─────────────────────────────────────────────────────────────

/**
 * Queries the 'cmdOS' IndexedDB database via Dexie.
 */
function queryIndexedDB<T>(storeName: string): Promise<T[]> {
  return db.table(storeName).toArray() as Promise<T[]>;
}

/** Fetches the local DB-backed data used by omnibox suggestions. */
async function getLocalData(): Promise<OmniboxLocalData> {
  const [links, notes, commands, sessions, widgetViews, userShortcuts, aiPrompts, chatAgents, snippets, todos, prefixSettings, organisations, dashboards, defaultOrganisation, collections, collectionItems] =
    await Promise.all([
      queryIndexedDB<LinkRecord & { isSession?: boolean }>('links'),
      queryIndexedDB<NoteRecord>('notes'),
      getAllCommands().then(rows => rows.filter(isOmniboxVisibleCommand)),
      db.workspaceSessions.toArray(),
      db.workspaceViews.toArray(),
      getAllUserShortcuts(),
      queryIndexedDB<AiPromptRecord>('aiPrompts'),
      queryIndexedDB<ChatAgentRecord>('chatAgents'),
      queryIndexedDB<SnippetRecord>('snippets'),
      queryIndexedDB<TodoRecord>('todos'),
      queryIndexedDB<PrefixSettingRecord>('prefixSettings'),
      queryIndexedDB<any>('organisations'),
      queryIndexedDB<WidgetDashboardRecord>('widgetDashboards'),
      getSmartDefaultOrganisation(),
      db.collections.toArray(),
      db.collectionItems.toArray(),
    ]);

  const visibleWidgetViews = normalizeWidgetViewsForOmnibox(widgetViews);
  const visibleCollectionIds = new Set(visibleWidgetViews.map(view => String(view.id || '').trim()));
  const scopedWebCollections = selectVisibleWebCollectionRecords(collections, collectionItems, defaultOrganisation?.id);
  const visibleWebCollections = scopedWebCollections.collections;
  const visibleWebCollectionIds = new Set(visibleWebCollections.map(collection => collection.id));

  return {
    links,
    notes,
    commands,
    sessions: sessions.filter(session => !getInternalDashboardSessionIds(dashboards).has(session.id)),
    widgetViews: visibleWidgetViews,
    userShortcuts: userShortcuts.filter((shortcut: any) => {
      const type = String(shortcut?.referenceType || shortcut?.type || '').toLowerCase();
      if (type === 'webcollection') return visibleWebCollectionIds.has(String(shortcut?.referenceId || ''));
      return type !== 'collection' || visibleCollectionIds.has(String(shortcut?.referenceId || '').trim());
    }),
    webCollections: visibleWebCollections,
    collectionItems: scopedWebCollections.items,
    aiPrompts,
    chatAgents,
    snippets,
    todos,
    prefixSettings,
    organisations,
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
 * Default values come from the command-terminal prefix adapter, not local fallback aliases.
 */
export function buildRegistry(
  _commands: CommandRecord[],
  customPrefixes: CommandTerminalPrefixes | null,
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
  // Normalize separators for lookup without rewriting authored argument text.
  const trimmed = text.replace(/\u00a0/g, ' ').trim();
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

    if (lowerTrimmed.startsWith(lowerPrefix) && /\s/.test(trimmed.charAt(prefix.length))) {
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
  localData: { links: [], notes: [], commands: [], sessions: [], widgetViews: [], userShortcuts: [], prefixSettings: [], organisations: [] },
  customPrefixes: null,
};
let isCacheReady = false;
let activeFetchPromise: Promise<ResolvedOmniboxState> | null = null;
let cacheRevision = 0;
let refreshActiveQuery: (() => void) | null = null;
let commandCatalogInitialized = false;

async function loadStateSnapshot(): Promise<ResolvedOmniboxState> {
  do {
    const revision = cacheRevision;
    // Seed/sync commands from the central catalog to ensure they are present in IndexedDB on worker startup
    if (!commandCatalogInitialized) {
      await syncCommandsFromSource();
      commandCatalogInitialized = true;
    }

    const [localData, customPrefixes] = await Promise.all([
      getLocalData(),
      CommandTerminalPrefixStorage.getPrefixes(),
    ]);

    if (revision !== cacheRevision) continue;
    cachedState = { localData, customPrefixes };
    isCacheReady = true;
    return cachedState;
  } while (true);
}

async function warmCache(): Promise<ResolvedOmniboxState> {
  if (!activeFetchPromise) {
    activeFetchPromise = loadStateSnapshot().finally(() => { activeFetchPromise = null; });
  }
  return activeFetchPromise;
}

// Existing mutation call sites use the same serialized refresh path as activation.
async function fetchAndApplyState(): Promise<ResolvedOmniboxState> {
  cacheRevision++;
  isCacheReady = false;
  return warmCache();
}

async function getResolvedOmniboxState({ forceFresh = false } = {}): Promise<ResolvedOmniboxState> {
  if (isCacheReady && !forceFresh) {
    return cachedState;
  }
  return warmCache();
}

export function invalidateOmniboxCache(): void {
  cacheRevision++;
  isCacheReady = false;
  void warmCache().then(() => refreshActiveQuery?.()).catch(error => {
    console.warn('[Omnibox] Could not refresh data; retaining the last successful snapshot:', error);
  });
}

chrome.runtime.onMessage.addListener(message => {
  if (
    message.action === 'INVALIDATE_OMNIBOX_CACHE' ||
    message.action === 'DATA_CHANGED' ||
    message.action === 'db_changed'
  ) {
    invalidateOmniboxCache();
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
  | 'webCollection'
  | 'collectionItem'
  | 'webCollection'
  | 'collectionItem'
  | 'prompt'
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
  webCollections?: CollectionRecord[];
  collectionItems?: CollectionItemRecord[];
  userShortcuts: any[];
  aiPrompts?: AiPromptRecord[];
  chatAgents?: ChatAgentRecord[];
  snippets?: SnippetRecord[];
  todos?: TodoRecord[];
  prefixSettings?: PrefixSettingRecord[];
  organisations?: any[];
};

type ResolvedOmniboxState = {
  localData: OmniboxLocalData;
  customPrefixes: CommandTerminalPrefixes | null;
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
    case 'webcollection':
    case 'web_collection':
      return 'webCollection';
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

// Shared text commands open in the same category order as the user's workflow.
// Saved sessions use the collection position; unlisted target types follow it.
const SHARED_COMMAND_OPEN_ORDER = ['note', 'link', 'collection', 'webCollection', 'todo', 'snippet', 'agent'];
const getSharedCommandOpenPriority = (type: string) => {
  const normalized = type === 'session' ? 'collection' : normalizeOmniboxEntityType(type);
  const index = SHARED_COMMAND_OPEN_ORDER.indexOf(normalized);
  return index < 0 ? SHARED_COMMAND_OPEN_ORDER.length : index;
};

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
      if (referenceType !== 'prompt') return null;

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

const findNoteShortcutUpdateInvocations = (
  rawQuery: string,
  localData: OmniboxLocalData,
  customPrefixes: CommandTerminalPrefixes | null,
) => {
  const lowerQuery = rawQuery.toLowerCase();
  return (localData.userShortcuts || [])
    .map((shortcut: any) => {
      if (getShortcutTargetType(shortcut) !== 'note') return null;

      const trigger = normalizeShortcutTrigger(shortcut.trigger || '');
      if (!trigger || !lowerQuery.startsWith(trigger)) return null;
      const rawAfterTrigger = rawQuery.slice(trigger.length);
      if (!rawAfterTrigger || !/^\s/.test(rawAfterTrigger)) return null;
      const fields = parseNoteQuickCreateFields(rawAfterTrigger.trimStart(), {
        prefixSettings: localData.prefixSettings || [], prefixes: customPrefixes,
      });
      if (!fields.presentFields.some(field => field === 'description' || field === 'tag')) return null;

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
        fields,
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
    .sort((a, b) => b.triggerLength - a.triggerLength);
};

const findNoteShortcutUpdateInvocation = (
  rawQuery: string, localData: OmniboxLocalData, customPrefixes: CommandTerminalPrefixes | null,
) => findNoteShortcutUpdateInvocations(rawQuery, localData, customPrefixes)[0] || null;

function renderNoteShortcutUpdates(
  rawQuery: string, localData: OmniboxLocalData, customPrefixes: CommandTerminalPrefixes | null,
  suggest: (rows: chrome.omnibox.SuggestResult[]) => void,
  setDefault: (description: string, entry: OmniboxSuggestionEntry | null) => void,
): boolean {
  const matches = findNoteShortcutUpdateInvocations(rawQuery, localData, customPrefixes);
  if (!matches.length) return false;
  const longest = matches[0].triggerLength;
  const rows = matches.filter(match => match.triggerLength === longest).map(match => {
    const title = match.note.title || 'Untitled Note';
    const detail = match.fields.description.trim() ? `append: ${match.fields.description.trim()}`
      : `Type ${getNoteUpdateSuggestionText(match.fields, localData, customPrefixes)}`;
    const entry: OmniboxSuggestionEntry | null = match.fields.description.trim() || match.fields.tagNames.length
      ? { kind: 'note_update', target: match.note, fields: match.fields, trigger: match.trigger } : null;
    const content = entry ? registerSuggestion(`${rawQuery.trim()} > [Note] ${title}`, entry) : rawQuery;
    return { content, description: formatSuggestionDescription(`${escapeXml(title)} <dim>- ${escapeXml(detail)}</dim>`,
      'Notes', match.trigger, true), entry };
  });
  setDefault(rows[0].description, rows[0].entry);
  suggest(rows.slice(1).filter(row => row.entry).map(({ content, description }) => ({ content, description })));
  return true;
}

const getNoteUpdateSuggestionText = (
  fields: ReturnType<typeof parseNoteQuickCreateFields>,
  localData: OmniboxLocalData,
  customPrefixes: CommandTerminalPrefixes | null,
) => {
  const labels = getNoteQuickCreatePrefixLabels({
    prefixSettings: localData.prefixSettings || [],
    prefixes: customPrefixes,
  });
  if (!fields.description.trim()) return `${labels.description} append description`;
  if (!fields.tagNames.length) return `${labels.tag} tags`;
  return '';
};

const getDefaultOrganisationId = (localData: OmniboxLocalData) =>
  String(localData.organisations?.[0]?.id || localData.notes?.[0]?.organisationId || '').trim() || undefined;

const buildOmniboxCreateActionPath = (entity: OmniboxCreateAction) => {
  if (entity === 'note') return buildCommandTerminalNewtabPath({ createNote: true, omnibox: true });
  if (entity === 'link') return buildCommandTerminalNewtabPath({ createLink: true, omnibox: true });
  if (entity === 'todo') return buildCommandTerminalNewtabPath({ createTodo: true, omnibox: true });
  if (entity === 'snippet') return buildCommandTerminalNewtabPath({ createSnippet: true, omnibox: true });
  if (entity === 'prompt') return buildCommandTerminalNewtabPath({ createPrompt: true, omnibox: true });
  return buildCommandTerminalNewtabPath({ createChatAgent: true, omnibox: true });
};

const getNoteCreateFieldHelpText = (
  localData: OmniboxLocalData,
  customPrefixes: CommandTerminalPrefixes | null,
) => {
  const labels = getNoteQuickCreatePrefixLabels({
    prefixSettings: localData.prefixSettings || [],
    prefixes: customPrefixes,
  });
  return `title required; type ${labels.title} title, ${labels.description} description, ${labels.tag} work, client`;
};

const getNotePrefixLabel = (customPrefixes: CommandTerminalPrefixes | null) =>
  resolveShortcutPrefix(customPrefixes, 'note');

const getNoteCreateTitleRequiredDescription = (
  localData: OmniboxLocalData,
  customPrefixes: CommandTerminalPrefixes | null,
) => {
  return formatSuggestionDescription(
    `Create Note <dim>- ${escapeXml(getNoteCreateFieldHelpText(localData, customPrefixes))}</dim>`,
    'Notes',
    getNotePrefixLabel(customPrefixes),
    true,
  );
};

const buildCreateActionDescription = (entity: OmniboxCreateAction, prefix: string) => {
  const meta = OMNIBOX_CREATE_ACTION_META[entity];
  return formatSuggestionDescription(meta.label, meta.category, prefix, true);
};

const getNoteShortcutOpenDescription = (
  title: string,
  trigger: string,
  _localData: OmniboxLocalData,
  _customPrefixes: CommandTerminalPrefixes | null,
) => {
  return formatSuggestionDescription(title, 'Notes', trigger);
};

const resolveTagIds = async (organisationId: string | undefined, tagNames: string[], existingTagIds: string[] = []) => {
  const tagIds = Array.from(new Set(existingTagIds.map(id => String(id || '').trim()).filter(Boolean)));
  for (const tagName of tagNames) {
    const tag = await createTag(tagName);
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

  const organisationId = getDefaultOrganisationId(localData);
  const note = await createNote({
    organisationId,
    title,
    body: buildQuickCreateNoteBodyHtml(fields.description),
    tagIds: [],
  });
  const tagIds = await resolveTagIds(note.organisationId, fields.tagNames);
  return tagIds.length > 0 ? updateNote(note.id, { tagIds }) : note;
};

const updateNoteFromOmniboxFields = async (
  note: NoteRecord,
  fields: ReturnType<typeof parseNoteQuickCreateFields>,
) => {
  const appendDescription = fields.description.trim();
  const tagIds = await resolveTagIds(note.organisationId, fields.tagNames, note.tagIds || []);
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
  customPrefixes: CommandTerminalPrefixes | null = null,
): LooseMatchCandidate[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  const candidates: LooseMatchCandidate[] = [];
  const assignedCommandIds = getAssignedCommandIds(state.userShortcuts || []);
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
      (false);

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
            : effectiveReferenceType === 'webCollection'
              ? state.webCollections?.find(item => item.id === shortcut.referenceId)?.name ||
                shortcut.targetLabelSnapshot || 'Untitled Web Collection'
            : effectiveReferenceType === 'command'
              ? (state.commands || []).find(
                  (command: any) => String(command.id || '') === String(shortcut.referenceId || ''),
                )?.label ||
                shortcut.referenceId ||
                'Untitled Command'
              : effectiveReferenceType === 'agent'
                ? (state.chatAgents || []).find(item => isSameSnippetIdentity(item.id, shortcut.referenceId))?.title || shortcut.targetLabelSnapshot || 'Untitled Agent'
                : effectiveReferenceType === 'todo'
                  ? (state.todos || []).find(item => isSameSnippetIdentity(item.id, shortcut.referenceId))?.title || shortcut.targetLabelSnapshot || 'Untitled Todo'
                  : effectiveReferenceType === 'snippet'
                    ? (state.snippets || []).find(item => isSameSnippetIdentity(item.id, shortcut.referenceId))?.title || shortcut.targetLabelSnapshot || 'Untitled Snippet'
                    : shortcut.targetLabelSnapshot || shortcut.label || trigger;
    const isCommandShortcut = effectiveReferenceType === 'command';

    let targetCategory = 'Shortcuts';
    if (effectiveReferenceType === 'note') { targetCategory = 'Notes'; }
    else if (effectiveReferenceType === 'link') { targetCategory = 'Links'; }
    else if (effectiveReferenceType === 'collection') { targetCategory = 'Collections'; }
    else if (effectiveReferenceType === 'webCollection') { targetCategory = 'Web Collections'; }
    else if (effectiveReferenceType === 'command') { targetCategory = 'System'; }
    else if (isAiPromptShortcut) { targetCategory = 'AI Prompts'; }
    else if (effectiveReferenceType === 'agent') { targetCategory = 'Agents'; }
    else if (effectiveReferenceType === 'todo') { targetCategory = 'Todos'; }
    else if (effectiveReferenceType === 'snippet') { targetCategory = 'Snippets'; }

    candidates.push({
      kind: 'shortcut',
      rank: rank + (isCommandShortcut ? -30 : 0),
      content: `[Command] ${trigger}`,
      description: effectiveReferenceType === 'note'
        ? getNoteShortcutOpenDescription(targetTitle, trigger, state, customPrefixes)
        : formatSuggestionDescription(targetTitle, targetCategory, trigger, false, getCommandSpacePrefix(customPrefixes)),
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
      description: formatSuggestionDescription(title || note.id || 'Untitled', 'Notes', resolveShortcutPrefix(customPrefixes, 'note')),
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
      description: formatSuggestionDescription(title || link.id || 'Untitled', 'Links', resolveShortcutPrefix(customPrefixes, 'link')),
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
      description: formatSuggestionDescription(label || id, 'System', command.prefix || getCommandSpacePrefix(customPrefixes)),
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
        resolveShortcutPrefix(customPrefixes, 'collection'),
      ),
      titleKey: title,
      target: view,
    });
  }

  for (const collection of state.webCollections || []) {
    const title = String(collection.name || '').trim();
    const rank = bestRankByQuery(normalizedQuery, ...getWebCollectionSearchFields(collection));
    if (rank === null) continue;
    if (shouldHideItemBecauseShortcutExists(collection, matchingShortcuts, 'webCollection')) continue;
    candidates.push({ kind: 'webCollection', rank: rank + 10, content: `[Web Collection] ${title}`,
      description: formatSuggestionDescription(title || collection.id, 'Web Collections', '', false, getCommandSpacePrefix(customPrefixes)), titleKey: title, target: collection });
  }

  for (const item of withWebCollectionNames(state.collectionItems || [], state.webCollections || [])) {
    if (!item.collectionName) continue;
    const title = String(item.title || '').trim();
    const rank = bestRankByQuery(normalizedQuery, ...getWebCollectionSearchFields(item));
    if (rank === null) continue;
    candidates.push({ kind: 'collectionItem', rank: rank + 10, content: `[Web Collection Item] ${title}`,
      description: formatSuggestionDescription(`${title || item.id} — ${item.collectionName}`, 'Web Collection Items', '', false, getCommandSpacePrefix(customPrefixes)),
      titleKey: title, target: item });
  }

  const typeBuckets: Array<{
    kind: 'prompt' | 'agent' | 'todo' | 'snippet';
    label: string;
    items: any[];
  }> = [
    { kind: 'prompt', label: 'Prompt', items: state.aiPrompts || [] },
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
        prompt: resolveShortcutPrefix(customPrefixes, 'prompt'),
        agent: resolveShortcutPrefix(customPrefixes, 'agent'),
        todo: resolveShortcutPrefix(customPrefixes, 'todo'),
        snippet: resolveShortcutPrefix(customPrefixes, 'snippet'),
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
  openEntitySearch: (type: 'collection' | 'prompt' | 'agent' | 'todo' | 'snippet', query: string, entityId?: string) => void;
  executeCommand: (command: CommandRecord) => void;
  openWebCollection?: (collection: CollectionRecord) => void;
  openCollectionItem?: (item: CollectionItemRecord) => void;
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

    if (candidate.kind === 'webCollection' && handlers.openWebCollection) {
      handlers.openWebCollection(candidate.target as CollectionRecord);
      return true;
    }
    if (candidate.kind === 'collectionItem' && handlers.openCollectionItem) {
      handlers.openCollectionItem(candidate.target as CollectionItemRecord);
      return true;
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
      candidate.kind === 'agent' ||
      candidate.kind === 'todo' ||
      candidate.kind === 'snippet'
    ) {
      const title = String(
        candidate.target?.title || candidate.target?.name || candidate.target?.label || candidate.target?.id || '',
      ).trim();
      if (title) {
        handlers.openEntitySearch(candidate.kind, title, String(candidate.target.id || ''));
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
  const typeOrder: Array<'note' | 'link' | 'collection' | 'snippet' | 'prompt' | 'agent' | 'todo'> = [
    'note', 'link', 'collection', 'snippet', 'prompt', 'agent', 'todo',
  ];

  const prefixParts: string[] = [];
  for (const type of typeOrder) {
    const key = Object.keys(registry).find(k => registry[k] === type);
    if (key) prefixParts.push(key);
  }

  const examplePrefixes = escapeXml(prefixParts.join(', '));
  return `SuperCommands: <match>Press Space</match> to browse commands, or type a prefix (like ${examplePrefixes})`;
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
type OmniboxSuggestionEntry =
  | { kind: 'open_all'; targets: { type: string; id: string }[] }
  | { kind: 'web_collection'; id: string }
  | { kind: 'collection_item'; id: string; collectionId: string }
  | { kind: 'command'; target: CommandRecord; prompt?: string }
  | { kind: 'shortcut'; target: any; temporaryPrompt?: string; linkQueryInput?: string; openBehavior?: any }
  | { kind: 'note_create'; fields: ReturnType<typeof parseNoteQuickCreateFields> }
  | { kind: 'note_update'; target: NoteRecord; fields: ReturnType<typeof parseNoteQuickCreateFields>; trigger: string }
  | { kind: 'note'; target: string }
  | { kind: 'link'; target: string[]; id?: string }
  | { kind: 'collection'; target: WidgetViewRecord; openBehavior?: any }
  | { kind: 'entity'; type: string; id: string }
  | { kind: 'search'; type: string; query: string }
  | { kind: 'create'; type: OmniboxCreateAction };
let lastSuggestionMap = new Map<string, OmniboxSuggestionEntry>();
let defaultSuggestion: { text: string; entry: OmniboxSuggestionEntry | null } | null = null;
const OMNIBOX_SELECTION_SESSION_KEY = 'omnibox_selection_intents_v1';

// Persist identities and argument fields only; command records can contain
// hydrated UI values that do not belong in Chrome storage.
function serializeSelection(entry: OmniboxSuggestionEntry): OmniboxSuggestionEntry {
  if (entry.kind === 'command' || entry.kind === 'collection' || entry.kind === 'note_update') {
    return { ...entry, target: { id: entry.target.id } } as OmniboxSuggestionEntry;
  }
  if (entry.kind === 'shortcut') {
    return { ...entry, target: { id: entry.target.id, referenceId: entry.target.referenceId } };
  }
  return entry;
}

/** Every shared owner gets a distinct, ID-bound suggestion and preserves its arguments. */
function buildSharedShortcutSuggestions(input: string, data: OmniboxLocalData, prefixes: CommandTerminalPrefixes | null, category?: string, completed = false) {
  const resolved = getMatchingShortcutAssignments(input, data.userShortcuts || [], prefixes);
  const matches = resolved.matches
    .filter(shortcut => !category || getShortcutTargetType(shortcut) === category)
    .sort((left, right) => getSharedCommandOpenPriority(getShortcutTargetType(left)) - getSharedCommandOpenPriority(getShortcutTargetType(right)));
  if (matches.length < (completed ? 1 : 2)) return null;
  const suffix = resolved.invocation.remainingInput;
  const labels: Record<string, string> = { note: 'Notes', link: 'Links', snippet: 'Snippets', todo: 'Todos', prompt: 'Prompts', agent: 'Agents', collection: 'Collections', webCollection: 'Web Collections', bookmark: 'Bookmarks' };
  const suggestions = matches.flatMap(shortcut => {
    const type = getShortcutTargetType(shortcut);
    const source = type === 'note' ? data.notes : type === 'link' ? data.links : type === 'snippet' ? data.snippets
      : type === 'todo' ? data.todos : type === 'prompt' ? data.aiPrompts : type === 'agent' ? data.chatAgents : [];
    const record = type === 'bookmark' ? { id: extractSnippetId(shortcut.referenceId), title: shortcut.label || 'Bookmark' }
      : type === 'webCollection' ? data.webCollections?.find(item => item.id === shortcut.referenceId)
      : type === 'collection' ? findCollectionViewByReferenceId(String(shortcut.referenceId), data.widgetViews || [])
        || data.sessions.find(item => isSameSnippetIdentity(item.id, shortcut.referenceId))
      : (source || []).find((item: any) => isSameSnippetIdentity(item.id ?? item.snippet_id, shortcut.referenceId));
    const title = String((record as any)?.title || (record as any)?.name || (record as any)?.key
      || shortcut.targetLabelSnapshot || shortcut.label || record?.id || shortcut.referenceId);
    const noteFields = type === 'note' ? parseNoteQuickCreateFields(suffix, {
      prefixSettings: data.prefixSettings || [], prefixes,
    }) : null;
    const isNoteUpdate = noteFields?.presentFields.some(field => field === 'description' || field === 'tag');
    const entry: OmniboxSuggestionEntry = type === 'webCollection' && record ? { kind: 'web_collection', id: String(record.id) }
      : type === 'bookmark' ? { kind: 'entity', type: 'bookmark', id: String(record.id) }
      : isNoteUpdate && record ? { kind: 'note_update', target: record as NoteRecord, fields: noteFields!, trigger: resolved.invocation.trigger }
      : { kind: 'shortcut', target: shortcut,
      temporaryPrompt: type === 'prompt' ? suffix : undefined, linkQueryInput: type === 'link' ? suffix : undefined,
      openBehavior: type === 'collection' && suffix.toLowerCase() === 'f' ? 'focus_mode' : undefined };
    const description = formatSuggestionDescription(title + (record ? (suffix ? ' — ' + suffix : '') : ' — unavailable'), labels[type] || type, resolved.invocation.trigger, false, getCommandSpacePrefix(prefixes));
    const content = registerSuggestion(input.trim() + ' > ' + title + ' [' + type + ':' + shortcut.referenceId + ']', entry);
    const openTarget = record && (labels[type] || type === 'webCollection') ? {
      type: type === 'collection' && data.sessions.some(item => String(item.id) === String(record.id)) ? 'session' : type,
      id: String(record.id),
    } : undefined;
    return [{ content, description, entry, openTarget }];
  });
  if (!completed && suggestions.length > MAX_OMNIBOX_RESULTS + 1) {
    const entry: OmniboxSuggestionEntry = { kind: 'search', type: 'command', query: input };
    const content = registerSuggestion(input.trim() + ' > Show all assigned items', entry);
    return [...suggestions.slice(0, MAX_OMNIBOX_RESULTS), {
      content, description: formatSuggestionDescription('Show all assigned items', 'Text Commands', resolved.invocation.trigger), entry,
    }];
  }
  return suggestions;
}

/** Chrome consumes its manifest keyword; an exact command opens all of its assigned items. */
function buildExactTextCommandSuggestions(input: string, data: OmniboxLocalData, prefixes: CommandTerminalPrefixes | null) {
  const source = input.replace(/\u00a0/g, ' ');
  const resolved = getMatchingShortcutAssignments(source, data.userShortcuts || [], prefixes);
  if (!resolved.invocation.trigger || resolved.invocation.remainingInput.trim() || !resolved.matches.length) return null;
  const rows = buildSharedShortcutSuggestions(source, data, prefixes, undefined, true)!;
  const targets = rows.flatMap(row => 'openTarget' in row && row.openTarget ? [row.openTarget] : []);
  if (!targets.length) return null;
  const entry: OmniboxSuggestionEntry = { kind: 'open_all', targets };
  const label = targets.length > 1 ? 'Open all' : 'Open';
  const content = registerSuggestion(`${source.trim()} > ${label}`, entry);
  return [{ content, description: formatSuggestionDescription(`${label} — ${targets.length} assigned item${targets.length > 1 ? 's' : ''}`, 'Text Commands', resolved.invocation.trigger), entry }, ...rows];
}

let bulkActivationPending = false;
async function activateOmniboxOpenAll(targets: { type: string; id: string }[]) {
  if (bulkActivationPending) return [];
  bulkActivationPending = true;
  const seen = new Set<string>();
  const failures: string[] = [];
  try {
    for (const target of [...targets].sort((left, right) => getSharedCommandOpenPriority(left.type) - getSharedCommandOpenPriority(right.type))) {
      const identity = `${target.type}:${target.id}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      try { await openTextCommandEntity(target.type, target.id); }
      catch (error) { failures.push(error instanceof Error ? error.message : String(error)); }
    }
    return failures;
  } finally { bulkActivationPending = false; }
}

/** Resolve the original shared trigger before consuming a category prefix. */
function resolveSharedOmniboxSuggestions(input: string, data: OmniboxLocalData, prefixes: CommandTerminalPrefixes | null) {
  const direct = buildSharedShortcutSuggestions(input, data, prefixes);
  if (direct) return direct;
  const parsed = parseInput(input, buildRegistry(data.commands || [], prefixes));
  return parsed.type && parsed.type !== 'command' && parsed.query
    ? buildSharedShortcutSuggestions(parsed.query, data, prefixes, parsed.type) : null;
}

/** Parse argument-bearing shortcuts once for both preview and execution. */
function resolveArgumentInvocation(input: string, data: OmniboxLocalData, category?: string): { description: string; entry: OmniboxSuggestionEntry | null } | null {
  const query = input.replace(/\u00a0/g, ' ').trim();
  const invocation = (data.userShortcuts || []).map(shortcut => {
    const type = getShortcutTargetType(shortcut);
    if (category && type !== category) return null;
    if (!['link', 'prompt', 'command', 'collection'].includes(type)) return null;
    const trigger = normalizeShortcutTrigger(shortcut.trigger || '');
    if (!trigger || !query.toLowerCase().startsWith(trigger)) return null;
    if (query.length > trigger.length && !/\s/.test(query.charAt(trigger.length))) return null;
    const suffix = query.slice(trigger.length).trimStart();
    // Ordinary exact triggers remain in the regular ranked list. Link commands
    // need preview validation even before their placeholder values are supplied.
    if (!suffix && type !== 'link') return null;
    if (type === 'collection' && suffix.toLowerCase() !== 'f') return null;
    return { shortcut, type, trigger, suffix };
  }).filter((value): value is { shortcut: any; type: string; trigger: string; suffix: string } => Boolean(value))
    .sort((a, b) => b.trigger.length - a.trigger.length)[0];
  if (!invocation) return null;
  const { shortcut, type, trigger, suffix } = invocation;
  const target = type === 'link' ? data.links.find(item => isSameSnippetIdentity(item.id ?? item.snippet_id, shortcut.referenceId))
    : type === 'prompt' ? findAiPromptByReferenceId(String(shortcut.referenceId), data.aiPrompts || [])
      : type === 'command' ? data.commands.find(item => String(item.id) === String(shortcut.referenceId))
        : findCollectionViewByReferenceId(String(shortcut.referenceId), data.widgetViews || []);
  if (!target) return null;
  const title = String((target as any).title || (target as any).label || target.id);
  const description = formatSuggestionDescription(title + (suffix ? ` — ${suffix}` : ''),
    type === 'link' ? 'Links' : type === 'prompt' ? 'AI Prompts' : type === 'command' ? 'System' : 'Collections', trigger);
  if (type === 'link') {
    const injection = injectLinkQueryValues(extractUrls(target), suffix);
    if (!injection.ok) return { description: `${description} <dim>— Supply query values after the text command</dim>`, entry: null };
  }
  return { description, entry: { kind: 'shortcut', target: shortcut,
    temporaryPrompt: type === 'prompt' || type === 'command' ? suffix : undefined,
    linkQueryInput: type === 'link' ? suffix : undefined,
    openBehavior: type === 'collection' ? 'focus_mode' : undefined } };
}

/** A complete label is a search; only an exact configured prefix/ID starts arguments. */
function resolveCommandQuery(input: string, commands: CommandRecord[]): { commandKey: string; prompt: string } {
  const query = input.trim();
  if (commands.some(command => normalizeSearchText(command.label) === normalizeSearchText(query))) return { commandKey: query, prompt: '' };
  const keys = commands.flatMap(command => [command.prefix, command.id]).filter(Boolean).sort((a, b) => b.length - a.length);
  const key = keys.find(value => query.toLowerCase().startsWith(value.toLowerCase()) && /\s/.test(query.charAt(value.length)));
  return key ? { commandKey: key, prompt: query.slice(key.length).trimStart() } : { commandKey: query, prompt: '' };
}

function registerSuggestion(
  content: string,
  entry: OmniboxSuggestionEntry,
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
  let observer: Subscription | null = null;
  const publishedSuggestions = new Map<string, OmniboxSuggestionEntry>();
  let selectionWritePromise: Promise<unknown> = Promise.resolve();
  const clearStoredSelections = () => {
    selectionWritePromise = selectionWritePromise.then(() => chrome.storage.session.remove(OMNIBOX_SELECTION_SESSION_KEY))
      .catch(error => console.warn('[Omnibox] Could not clear stored selections:', error));
  };
  let activeInput: { text: string; suggest: (rows: chrome.omnibox.SuggestResult[]) => void } | null = null;
  const clearSession = () => {
    suggestionGeneration++;
    activeInput = null;
    defaultSuggestion = null;
    lastSuggestionMap.clear();
    publishedSuggestions.clear();
    refreshActiveQuery = null;
    observer?.unsubscribe();
    observer = null;
  };
  // Set a placeholder hint immediately (before cache loads). Updated dynamically once cache is ready.
  chrome.omnibox.setDefaultSuggestion({
    description: 'SuperCommands: <match>Press Space</match> to browse, or type a prefix to filter by category',
  });

  // Pre-warm cache immediately when the service worker starts (before user even opens omnibox)
  void warmCache().catch(error => console.warn('[Omnibox] Startup data unavailable:', error));

  // A new session awaits a fresh snapshot; subsequent database changes rerender
  // the same input rather than requiring an extra keystroke.
  chrome.omnibox.onInputStarted.addListener(() => {
    clearSession();
    clearStoredSelections();
    refreshActiveQuery = () => {
      if (activeInput) updateSuggestions(activeInput.text, activeInput.suggest);
    };
    invalidateOmniboxCache();
    let firstSnapshot = true;
    // Observe relevant Dexie tables only while keyword input is active. This
    // includes writes made by background bridges and other extension tabs.
    observer = liveQuery(getLocalData).subscribe({
      next: () => {
        if (firstSnapshot) { firstSnapshot = false; return; }
        invalidateOmniboxCache();
      },
      error: error => console.warn('[Omnibox] Data observation failed:', error),
    });
  });
  chrome.omnibox.onInputCancelled.addListener(clearSession);

  // ── onInputChanged: load from cache with promise fallback ────────────────
  function updateSuggestions(text: string, suggest: (rows: chrome.omnibox.SuggestResult[]) => void) {
    activeInput = { text, suggest };
    // Chrome can send a selected row's content back as changed input before
    // Enter. Keep its published identity instead of parsing that display text.
    if (publishedSuggestions.has(text.trim().toLowerCase())) {
      suggestionGeneration++;
      return;
    }
    defaultSuggestion = null;
    // Capture generation at the moment this keystroke fires.
    // If a newer keystroke arrives while we're awaiting, this becomes stale.
    const myGeneration = ++suggestionGeneration;

    // Clear mapping cache for the new query input
    lastSuggestionMap.clear();

    // Staleness-guarded suggest: silently discards results if a newer keystroke
    // has already fired. This eliminates the "dispensary" flickering effect.
    const safeSuggest = (results: chrome.omnibox.SuggestResult[]) => {
      if (myGeneration !== suggestionGeneration) return;
      const rows = results.slice(0, MAX_OMNIBOX_RESULTS);
      for (const row of rows) {
        const key = row.content.trim().toLowerCase();
        const entry = lastSuggestionMap.get(key);
        if (entry) publishedSuggestions.set(key, entry);
      }
      const entries = Object.fromEntries(rows.map(row => {
        const key = row.content.trim().toLowerCase();
        const entry = publishedSuggestions.get(key);
        return [key, entry ? serializeSelection(entry) : null];
      }));
      selectionWritePromise = selectionWritePromise
        .then(() => chrome.storage.session.set({ [OMNIBOX_SELECTION_SESSION_KEY]: entries }))
        .catch(error => console.warn('[Omnibox] Could not retain selected-row identities:', error));
      void selectionWritePromise.then(() => {
        if (myGeneration !== suggestionGeneration) return;
        // Shared-command rows also carry internal routing metadata. Chrome
        // validates SuggestResult strictly; keep that metadata in our maps.
        suggest(rows.map(({ content, description, deletable }) => ({
          content,
          description,
          ...(deletable === undefined ? {} : { deletable }),
        })));
      }).catch(error => console.warn('[Omnibox] Could not publish suggestions:', error));
    };

    const safeSetDefault = (description: string, entry?: OmniboxSuggestionEntry | null) => {
      if (myGeneration !== suggestionGeneration) return;
      defaultSuggestion = { text, entry: entry === undefined ? lastSuggestionMap.values().next().value || null : entry };
      chrome.omnibox.setDefaultSuggestion({ description });
    };

    const runSuggestions = async () => {
      const { localData, customPrefixes } = await getResolvedOmniboxState();

      // STALENESS CHECK: If a newer keystroke fired while we were awaiting,
      // discard this entire computation silently — it's outdated.
      if (myGeneration !== suggestionGeneration) return;

      const registry = buildRegistry(localData.commands || [], customPrefixes);
      const { prefix, type, query } = parseInput(text, registry);
      const sharedSuggestions = buildExactTextCommandSuggestions(text, localData, customPrefixes)
        || resolveSharedOmniboxSuggestions(text, localData, customPrefixes);
      if (sharedSuggestions) {
        if (sharedSuggestions.length) {
          safeSetDefault(sharedSuggestions[0].description, sharedSuggestions[0].entry);
          safeSuggest(sharedSuggestions.slice(1));
        } else { safeSetDefault('The assigned items are no longer available.', null); safeSuggest([]); }
        return;
      }


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

        if (renderNoteShortcutUpdates(rawText, localData, customPrefixes, safeSuggest, safeSetDefault)) return;

        const argumentInvocation = resolveArgumentInvocation(trimmedText, localData);
        if (argumentInvocation) {
          safeSetDefault(argumentInvocation.description, argumentInvocation.entry);
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
            { kind: 'shortcut', target: promptInvocation.shortcut, temporaryPrompt: promptInvocation.temporaryPrompt },
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
            } else if (candidate.kind === 'webCollection') {
              entry = { kind: 'web_collection', id: candidate.target.id };
            } else if (candidate.kind === 'collectionItem') {
              entry = { kind: 'collection_item', id: candidate.target.id, collectionId: candidate.target.collectionId };
            } else if (candidate.kind === 'link') {
              entry = { kind: 'link', target: extractUrls(candidate.target), id: String(candidate.target.id) };
            } else if (['prompt', 'agent', 'todo', 'snippet'].includes(candidate.kind)) {
              const title = String(candidate.target?.title || candidate.target?.name || candidate.target?.label || candidate.target?.id || '').trim();
              entry = { kind: 'entity', type: candidate.kind, id: String(candidate.target.id) };
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

        safeSetDefault(`No results found matching <match>${escapeXml(trimmedText)}</match>`, null);
        safeSuggest([]);
        return;
      }

      handleTypedInput(prefix, type, query, safeSuggest, localData, customPrefixes, text, safeSetDefault);
    };

    void runSuggestions().catch(error => {
      safeSetDefault('SuperCommands: Could not load results. Try again.', null);
      safeSuggest([]);
      console.error('[Omnibox] Suggestion load failed:', error);
    });
  }
  chrome.omnibox.onInputChanged.addListener(updateSuggestions);

  // Extract the main suggestion logic to a separate helper function
  function handleTypedInput(
    prefix: string,
    type: 'note' | 'link' | 'command' | 'collection' | 'prompt' | 'agent' | 'todo' | 'snippet',
    query: string,
    suggest: (suggestResults: chrome.omnibox.SuggestResult[]) => void,
    localData: OmniboxLocalData,
    customPrefixes: CommandTerminalPrefixes | null,
    rawText?: string,
    setDefault?: (description: string, entry?: OmniboxSuggestionEntry | null) => void,
  ) {
    const sharedSearchData = createCommandTerminalSearchData(localData);
    const applyDefault = (description: string, entry?: OmniboxSuggestionEntry | null) => {
      if (setDefault) {
        setDefault(description, entry);
      } else {
        chrome.omnibox.setDefaultSuggestion({ description });
      }
    };
    const sharedSuggestions = buildSharedShortcutSuggestions(query, localData, customPrefixes, type === 'command' ? undefined : type);
    if (sharedSuggestions) {
      if (sharedSuggestions.length) { applyDefault(sharedSuggestions[0].description, sharedSuggestions[0].entry); suggest(sharedSuggestions.slice(1)); }
      else { applyDefault('The assigned items are no longer available.', null); suggest([]); }
      return;
    }
    const argumentInvocation = resolveArgumentInvocation(query, localData, type);
    if (argumentInvocation) {
      applyDefault(argumentInvocation.description, argumentInvocation.entry);
      suggest([]);
      return;
    }

    // ── Notes / Links ──────────────────────────────────────────────────────
    if (type === 'link' || type === 'note') {
      if (query.trim() === '') {
        const allItems: any[] = type === 'link' ? localData.links || [] : localData.notes || [];
        const prefixChar = prefix;
        const createActionDescription = buildCreateActionDescription(type, prefixChar);

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
              ? { kind: 'link' as const, target: extractUrls(item), id: String(item.id) }
              : { kind: 'note' as const, target: item.id };
            const cleanContent = registerSuggestion(content, entry);
            return {
              content: cleanContent,
              description: formatSuggestionDescription(item.title || item.id || 'Untitled', type === 'link' ? 'Links' : 'Notes', prefixChar),
            };
          }),
        ];

        if (allSuggestions.length > 0) {
          applyDefault(createActionDescription, { kind: 'create', type });
          suggest(allSuggestions.slice(0, MAX_OMNIBOX_RESULTS));
        } else {
          applyDefault(createActionDescription, { kind: 'create', type });
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
          applyDefault(description, createFields.title.trim() ? { kind: 'note_create', fields: createFields } : null);
          suggest([]);
          return;
        }
      }

      const rawTitleMatches: any[] = searchCommandTerminalItems(type, query, sharedSearchData);

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
        applyDefault(query ? `No ${type}s found matching <match>${escapeXml(query)}</match>` : `No ${type}s saved yet`, query ? { kind: 'search', type, query } : null);
        suggest([]);
        return;
      }

      const prefixChar = prefix || resolveShortcutPrefix(customPrefixes, type === 'link' ? 'link' : 'note');

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
            ? { kind: 'link' as const, target: extractUrls(item), id: String(item.id) }
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
        const collectionPrefix = prefix || resolveShortcutPrefix(customPrefixes, 'collection');
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

      const collectionMatches = searchCommandTerminalItems<WidgetViewRecord>(
        'session',
        query,
        sharedSearchData,
      );

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
        applyDefault(`No collections found matching <match>${escapeXml(query)}</match>`, { kind: 'search', type, query });
        suggest([]);
        return;
      }

      const collectionPrefix = prefix || resolveShortcutPrefix(customPrefixes, 'collection');
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
      const nestedEntityInput = parseInput(commandQueryForIntent, buildRegistry(localData.commands || [], customPrefixes));
      if (nestedEntityInput.type && nestedEntityInput.type !== 'command') {
        handleTypedInput(
          nestedEntityInput.prefix,
          nestedEntityInput.type,
          nestedEntityInput.query,
          suggest,
          localData,
          customPrefixes,
          rawText,
          setDefault,
        );
        return;
      }

      if (renderNoteShortcutUpdates(commandQueryForIntent, localData, customPrefixes, suggest, applyDefault)) return;

      const { commandKey, prompt } = resolveCommandQuery(query, localData.commands || []);

      if (commandKey.trim() === '') {
        const assignedCommandIds = getAssignedCommandIds(localData.userShortcuts || []);
        const commandPrefix = prefix || getCommandSpacePrefix(customPrefixes);

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
      const commandMatches = searchCommandTerminalCommands(
        commandKey,
        (localData.commands || []).filter(isOmniboxVisibleCommand),
      )
        .map((command: CommandRecord, searchRank: number) => ({
          command,
          assignedRank: assignedCommandIds.has(String(command.id || '')) ? 0 : 1,
          searchRank,
        }))
        .sort((a, b) => {
          if (a.searchRank !== b.searchRank) return a.searchRank - b.searchRank;
          if (a.assignedRank !== b.assignedRank) return a.assignedRank - b.assignedRank;
          return String(a.command.label || a.command.id || '').localeCompare(
            String(b.command.label || b.command.id || ''),
          );
        })
        .map(entry => entry.command);
      const resolvedCommandMatches = commandMatches;

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

      if (resolvedCommandMatches.length === 0 && commandShortcutMatches.length === 0) {
        applyDefault(commandKey ? `No commands found matching <match>${escapeXml(commandKey)}</match>` : 'No commands saved yet', commandKey ? { kind: 'search', type, query } : null);
        suggest([]);
        return;
      }

      // Commands use c <id> format — ID is already the stable key
      const commandPrefix = prefix || getCommandSpacePrefix(customPrefixes);
      // Keep the current query visible while selecting an ordinary suggestion.
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
        ...resolvedCommandMatches.map((c: CommandRecord) => {
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
    if (['prompt', 'agent', 'todo', 'snippet'].includes(type)) {
      let items: any[] = [];
      const typeLabel =
        type === 'prompt'
          ? 'Prompt'
          : type === 'agent'
              ? 'Agent'
              : type === 'todo'
                ? 'Todo'
                : 'Snippet';

      if (type === 'prompt') items = localData.aiPrompts || [];
      else if (type === 'agent') items = localData.chatAgents || [];
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
          applyDefault(description, { kind: 'shortcut', target: promptInvocation.shortcut, temporaryPrompt: promptInvocation.temporaryPrompt });
          suggest([]);
          return;
        }
      }

      if (query.trim() === '') {
        const createActionDescription = isOmniboxCreateAction(type)
          ? buildCreateActionDescription(type, prefix)
          : null;

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
            const cleanContent = registerSuggestion(content, { kind: 'entity', type, id: String(item.id) });
            return {
              content: cleanContent,
              description: formatSuggestionDescription(title, typeLabel + 's', prefix),
            };
          }),
        ];

        if (allSuggestions.length > 0) {
          applyDefault(createActionDescription || allSuggestions[0].description, isOmniboxCreateAction(type) ? { kind: 'create', type } : undefined);
          suggest(allSuggestions.slice(0, MAX_OMNIBOX_RESULTS));
        } else {
          applyDefault(createActionDescription || `No ${type}s saved yet`, isOmniboxCreateAction(type) ? { kind: 'create', type } : null);
          suggest([]);
        }
        return;
      }

      const searchResultKind = type === 'agent' ? 'agent_collection' : type as 'prompt' | 'todo' | 'snippet';
      const rawTitleMatches: any[] = searchCommandTerminalItems(searchResultKind, query, sharedSearchData);

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
        applyDefault(`No ${type}s found matching <match>${escapeXml(query)}</match>`, { kind: 'search', type, query });
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
          const cleanContent = registerSuggestion(content, { kind: 'entity', type, id: String(item.id) });
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
    const selectedEntry = publishedSuggestions.get(text.trim().toLowerCase()) || lastSuggestionMap.get(text.trim().toLowerCase());
    const displayedDefault = defaultSuggestion?.text === text ? defaultSuggestion : null;
    let acceptedEntry = selectedEntry || displayedDefault?.entry;
    clearSession();
    try {
    await selectionWritePromise;
    if (!acceptedEntry && !displayedDefault) {
      try {
        const stored = await chrome.storage.session.get(OMNIBOX_SELECTION_SESSION_KEY);
        acceptedEntry = stored[OMNIBOX_SELECTION_SESSION_KEY]?.[text.trim().toLowerCase()] || undefined;
      } catch (error) {
        console.warn('[Omnibox] Could not recover selected-row identity:', error);
      }
    }
    clearStoredSelections();
    // Always ensure cache is warm; getResolvedOmniboxState() handles this nicely
    const { localData, customPrefixes } = await getResolvedOmniboxState({ forceFresh: true });
    if (displayedDefault && !acceptedEntry) return;

    const userShortcuts = localData.userShortcuts || [];
    const extUrl = chrome.runtime.getURL('AltS_search_newtab/index.html');
    const sharedSearchData = createCommandTerminalSearchData(localData);

    const openNewtabPath = (path: string) => {
      const targetUrl = chrome.runtime.getURL(path);
      if (disposition === 'currentTab') {
        chrome.tabs.update({ url: targetUrl });
      } else {
        chrome.tabs.create({ url: targetUrl, active: disposition !== 'newBackgroundTab' });
      }
    };
    const reportUnavailable = (message = 'The selected item is no longer available.') => {
      openNewtabPath(`${buildCommandTerminalNewtabPath({ omnibox: true })}&omnibox_error=${encodeURIComponent(message)}`);
    };
    const openSavedCollection = async (id: string, organisationId: string, itemId?: string) => {
      try { await openWebCollection(id, organisationId, itemId); }
      catch (error) { reportUnavailable(error instanceof Error ? error.message : String(error)); }
    };

    const openUrls = (urls: string[]) => {
      chrome.windows.getLastFocused({ populate: true }, focusedWindow => {
        const activeTab = focusedWindow?.tabs?.find(tab => tab.active);
        const windowId = focusedWindow?.id;

        void (async () => {
          for (let index = 0; index < urls.length; index += 1) {
            const url = urls[index];
            if (index === 0) {
              if (disposition === 'currentTab') {
                const reuseResult = await openOrReuseNoteSnippetTabInWindow(url, {
                  windowId,
                  active: true,
                  createIfMissing: false,
                });
                if (reuseResult.reused) continue;
                if (activeTab?.id) {
                  chrome.tabs.update(activeTab.id, { url });
                } else {
                  chrome.tabs.update({ url });
                }
              } else {
                await openOrReuseNoteSnippetTabInWindow(url, {
                  windowId,
                  active: disposition === 'newForegroundTab',
                });
              }
            } else {
              await openOrReuseNoteSnippetTabInWindow(url, {
                windowId,
                active: false,
              });
            }
          }
        })();
      });
    };

    const executeCommand = (command: CommandRecord, prompt = '') => {
      // NOTE: AI_COMMANDS branch removed — those command IDs are hidden from omnibox.
      // NOTE: URL_COMMANDS branch removed — those entries don't exist as DB CommandRecords.

      chrome.windows.getLastFocused({ populate: true }, focusedWindow => {
        const activeTab = focusedWindow?.tabs?.find(tab => tab.active);
        const launchTarget = resolveCommandTerminalCommandLaunch(command, {
          prompt,
          activeTabUrl: activeTab?.url || activeTab?.pendingUrl || '',
          activeTabTitle: activeTab?.title || '',
        });
        if (launchTarget.kind === 'website-popup') {
          void triggerInPlaceCommand(launchTarget.creatorType).catch(error => {
            reportUnavailable(error instanceof Error ? error.message : 'The page command could not be opened.');
          });
          return;
        }

        const targetUrl = chrome.runtime.getURL(launchTarget.path);
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
      });
      return true;
    };

    const executeSession = (session: SessionRecord) => {
      const sessionId = String(session.id || '').trim();
      if (!sessionId) return false;
      chrome.windows.getLastFocused({ populate: true }, focusedWindow => {
        const activeTab = focusedWindow?.tabs?.find(tab => tab.active);
        handleSessionMessage(
          {
            action: 'start_workspace',
            workspaceId: sessionId,
            sessionName: getSessionSearchTitle(session) || 'Untitled Session',
            organisationId: session.organisationId || null,
            
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
      if (normalizedReferenceType === 'webCollection') {
        const collection = localData.webCollections?.find(item => item.id === shortcut.referenceId);
        if (!collection) { recordShortcutUse(false, 'entity_not_found'); return false; }
        void openWebCollection(collection.id, collection.organisationId)
          .then(() => recordShortcutUse(true, undefined, collection.name))
          .catch(error => {
            recordShortcutUse(false, 'execution_failed', collection.name);
            reportUnavailable(error instanceof Error ? error.message : String(error));
          });
        return true;
      }
      if (normalizedReferenceType === 'prompt') {
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
          openUrls([targetUrl]);
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
          const ok = executeCommand(command, temporaryPrompt);
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

        const session = localData.sessions.find(item => isSameSnippetIdentity(item.id, shortcut.referenceId));
        if (session) {
          const ok = executeSession(session);
          recordShortcutUse(ok, ok ? undefined : 'execution_failed', getSessionSearchTitle(session));
          return ok;
        }

        console.warn('[Omnibox] Collection view not found for shortcut:', shortcut);
        recordShortcutUse(false, 'entity_not_found');
      }
      if (normalizedReferenceType === 'agent' || normalizedReferenceType === 'todo' || normalizedReferenceType === 'snippet') {
        const items = normalizedReferenceType === 'agent' ? localData.chatAgents || []
          : normalizedReferenceType === 'todo' ? localData.todos || [] : localData.snippets || [];
        const target = items.find(item => isSameSnippetIdentity(item.id, shortcut.referenceId));
        if (target) {
          openNewtabPath(buildCommandTerminalNewtabPath({ omnibox: true, type: normalizedReferenceType, entityId: String(target.id) }));
          recordShortcutUse(true, undefined, target.title || target.id);
          return true;
        }
      }
      recordShortcutUse(false, 'entity_not_found');
      return false;
    };

    // Clean Registry lookup (Phase 3)
    let resolvedEntry = acceptedEntry;
    if (!resolvedEntry && !displayedDefault && !/__cmd_|__shortcut_|__loose_/.test(text) && !text.startsWith('[')) {
      const registry = buildRegistry(localData.commands || [], customPrefixes);
      const parsed = parseInput(text, registry);
      const shared = buildExactTextCommandSuggestions(text, localData, customPrefixes)
        || resolveSharedOmniboxSuggestions(text, localData, customPrefixes);
      if (shared) {
        if (!shared.length) { reportUnavailable(); return; }
        resolvedEntry = shared[0].entry;
      } else if (parsed.type || !text.trim()) {
        // Enter can arrive before the first asynchronous preview. Reuse the
        // existing suggestion builder with an isolated registry and no UI writes.
        const sessionMap = lastSuggestionMap;
        lastSuggestionMap = new Map();
        try {
          handleTypedInput(parsed.prefix, parsed.type || 'command', parsed.query, () => {}, localData, customPrefixes, text,
            (_description, entry) => { resolvedEntry = entry === undefined ? lastSuggestionMap.values().next().value : entry || undefined; });
        } finally {
          lastSuggestionMap = sessionMap;
        }
      } else {
        const invocation = resolveArgumentInvocation(text, localData);
        if (invocation) { resolvedEntry = invocation.entry || undefined; if (!resolvedEntry) return; }
      }
    }
    const matched = resolvedEntry;
    if (matched) {
      if (matched.kind === 'open_all') {
        const failures = await activateOmniboxOpenAll(matched.targets);
        if (failures.length) reportUnavailable(failures.join(' '));
        return;
      }
      if (matched.kind === 'create') {
        openNewtabPath(buildOmniboxCreateActionPath(matched.type));
        return;
      }
      if (matched.kind === 'command') {
        const command = localData.commands.find(item => String(item.id) === String(matched.target.id));
        if (command) executeCommand(command, matched.prompt); else reportUnavailable();
        return;
      }
      if (matched.kind === 'shortcut') {
        const shortcut = userShortcuts.find(item => String(item.id) === String(matched.target.id)
          && String(item.referenceId) === String(matched.target.referenceId));
        if (!shortcut || !executeShortcut(
          shortcut,
          matched.temporaryPrompt,
          true,
          matched.linkQueryInput,
          matched.openBehavior
        )) reportUnavailable();
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
        const note = localData.notes.find(item => String(item.id) === String(matched.target.id));
        if (!note) { reportUnavailable(); return; }
        await updateNoteFromOmniboxFields(note, matched.fields);
        fetchAndApplyState().catch(err => console.warn('[Omnibox] Failed to refresh cache after note update:', err));
        return;
      }
      if (matched.kind === 'note') {
        openUrls([`${extUrl}?omnibox=true&type=note&id=${encodeURIComponent(matched.target)}`]);
        return;
      }
      if (matched.kind === 'link') {
        const link = matched.id ? localData.links.find(item => String(item.id) === matched.id) : null;
        if (matched.id && !link) { reportUnavailable(); return; }
        openUrls(link ? extractUrls(link) : matched.target);
        return;
      }
      if (matched.kind === 'collection') {
        const view = (localData.widgetViews || []).find(item => String(item.id) === String(matched.target.id));
        if (view) executeCollectionView(view, matched.openBehavior); else reportUnavailable();
        return;
      }
      if (matched.kind === 'web_collection') {
        const collection = localData.webCollections?.find(item => item.id === matched.id);
        if (collection) await openSavedCollection(collection.id, collection.organisationId);
        else reportUnavailable();
        return;
      }
      if (matched.kind === 'collection_item') {
        const item = localData.collectionItems?.find(record => record.id === matched.id && record.collectionId === matched.collectionId);
        const collection = localData.webCollections?.find(record => record.id === item?.collectionId && record.organisationId === item?.organisationId);
        if (item && collection) await openSavedCollection(collection.id, collection.organisationId, item.id);
        else reportUnavailable();
        return;
      }
      if (matched.kind === 'search') {
        openNewtabPath(buildCommandTerminalNewtabPath({ omnibox: true, type: matched.type, query: matched.query }));
        return;
      }
      if (matched.kind === 'entity') {
        const targetUrl = chrome.runtime.getURL(buildCommandTerminalNewtabPath({ omnibox: true, type: matched.type, entityId: matched.id }));
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
          if (referenceType !== 'prompt') return null;

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
    let { type, query: rawQuery } = parseInput(text, registry);
    if (type === 'command') {
      const nested = parseInput(rawQuery, registry);
      if (nested.type && nested.type !== 'command') { type = nested.type; rawQuery = nested.query; }
    }
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
        openWebCollection: collection => { void openSavedCollection(collection.id, collection.organisationId); },
        openCollectionItem: item => { void openSavedCollection(item.collectionId, item.organisationId, item.id); },
        openNote: noteId => {
          const targetUrl = `${extUrl}?omnibox=true&type=note&id=${encodeURIComponent(noteId)}`;
          openUrls([targetUrl]);
        },
        openUrls,
        openEntitySearch: (searchType, searchQuery, entityId) => {
          const targetUrl = chrome.runtime.getURL(buildCommandTerminalNewtabPath({ omnibox: true, type: searchType, entityId, query: entityId ? undefined : searchQuery }));
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

    // Prefix-only entity input opens the virtual create action shown at the top of the dropdown.
    if (!query) {
      if (isOmniboxCreateAction(type)) {
        openNewtabPath(buildOmniboxCreateActionPath(type));
      }
      return;
    }

    if (type === 'command') {
      const nestedEntityInput = parseInput(rawCommandQuery, registry);
      if (isOmniboxCreateAction(nestedEntityInput.type)) {
        if (!nestedEntityInput.query.trim()) {
          openNewtabPath(buildOmniboxCreateActionPath(nestedEntityInput.type));
          return;
        }

        if (nestedEntityInput.type === 'note') {
          const createFields = parseNoteQuickCreateFields(nestedEntityInput.query, {
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

    const typedArgumentInvocation = resolveArgumentInvocation(query, localData, type);
    if (typedArgumentInvocation) {
      if (typedArgumentInvocation.entry?.kind === 'shortcut') {
        const invocation = typedArgumentInvocation.entry;
        executeShortcut(invocation.target, invocation.temporaryPrompt, true, invocation.linkQueryInput, invocation.openBehavior);
      }
      return;
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
        const target = findBestCommandTerminalItemMatch<NoteRecord>('note', normalizedQuery, sharedSearchData);
        if (target) {
          const targetUrl = `${extUrl}?omnibox=true&type=note&id=${encodeURIComponent(target.id)}`;
          openUrls([targetUrl]);
          return;
        }
      } else if (type === 'link') {
        const target = findBestCommandTerminalItemMatch<any>('link', normalizedQuery, sharedSearchData);
        if (target) {
          const urls = extractUrls(target);
          if (urls && urls.length > 0) {
            openUrls(urls);
            return;
          }
        }
      } else if (type === 'collection') {
        const target = findBestCommandTerminalItemMatch<WidgetViewRecord>('session', query, sharedSearchData);
        if (target) {
          executeCollectionView(target);
          return;
        }
      }
    }

    if (type === 'prompt') {
      const target = findBestCommandTerminalItemMatch<AiPromptRecord>('prompt', normalizedQuery, sharedSearchData);
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
      const argumentInvocation = resolveArgumentInvocation(query, localData, 'command');
      if (argumentInvocation) {
        if (argumentInvocation.entry?.kind === 'shortcut') executeShortcut(argumentInvocation.entry.target, argumentInvocation.entry.temporaryPrompt, true);
        return;
      }
      const { commandKey, prompt } = resolveCommandQuery(query, localData.commands || []);

      const assignedCommandIds = getAssignedCommandIds(localData.userShortcuts || []);
      const matches = searchCommandTerminalCommands(
        commandKey,
        (localData.commands || []).filter(isOmniboxVisibleCommand),
      )
        .map((command: CommandRecord, searchRank: number) => ({
          command,
          searchRank,
        }))
        .sort((a, b) => {
          const aAssigned = assignedCommandIds.has(String(a.command.id || '')) ? 0 : 1;
          const bAssigned = assignedCommandIds.has(String(b.command.id || '')) ? 0 : 1;
          if (a.searchRank !== b.searchRank) return a.searchRank - b.searchRank;
          if (aAssigned !== bAssigned) return aAssigned - bAssigned;
          return String(a.command.label || a.command.id || '').localeCompare(
            String(b.command.label || b.command.id || ''),
          );
        })
        .map(entry => entry.command);

      const found = matches[0];
      if (!found) {
        // No command matched — open extension search page so user can see results
        const fallbackUrl = chrome.runtime.getURL(
          buildCommandTerminalNewtabPath({
            omnibox: true,
            type: 'command',
            query,
          }),
        );
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
    } catch (error) {
      console.error('[Omnibox] Execution failed:', error);
      const url = chrome.runtime.getURL(buildCommandTerminalNewtabPath({
        omnibox: true,
        omnibox_error: 'SuperCommands could not complete this action. Try again.',
      }));
      void chrome.tabs.create({ url, active: disposition !== 'newBackgroundTab' })
        .catch(reportError => console.warn('[Omnibox] Could not show the execution error:', reportError));
    }
  });
}
