
import Fuse, { type IFuseOptions } from 'fuse.js';
import type { CommandDefinition, CommandId } from '../commandConfigurations/commands';
import { findCommandByAnyId } from '../../../shared-components/commands';
/** Inlined from background/src/automationExecutor to avoid cross-package import */
interface ModuleDefinition {
  module_id: string;
  name: string;
  execution_steps: { action: string;[key: string]: any }[];
  version: number;
}
import { LOCAL_COMMANDS, type LocalCommandDefinition, type LocalCommandId } from '../commandConfigurations/localCommands';
import type { CommonCommandEntry } from './commonResults';
import type { HistoryItem } from './historyAlgo';
import {
  preprocessHistoryItems,
  isGoogleSearchResult,
  isDomainPrefixMatch,
  getDomainPrefixScore,
  isLikelyNavigationQuery,
  isDeepPath,
} from './historyAlgo';

// ============================================================================
// TYPES
// ============================================================================

export type SearchResultKind = 'command' | 'history' | 'bookmark' | 'common_command' | 'module';

export interface CommandSearchResult {
  _kind: 'command';
  commandType: 'remote' | 'local' | 'aggregate';
  id: string;  // Widened from CommandId | LocalCommandId | 'ai' — registry IDs are plain strings
  label: string;
  prefix: string;
  score: number;
  command?: CommandDefinition | LocalCommandDefinition;
  description?: string;
}

export interface HistorySearchResult {
  _kind: 'history';
  id: string;
  title: string;
  url: string;
  lastVisitTime: number;
  visitCount: number;
  frecencyScore?: number;
  score: number;
  /** If true, this result belongs to the "Other results" section at the bottom */
  isOtherResult?: boolean;
  /** ID of a command that is mapped to this result's domain */
  commandId?: string;  // Widened from CommandId | LocalCommandId | 'ai'
}

export interface BookmarkSearchResult {
  _kind: 'bookmark';
  id: string;
  title: string;
  url: string;
  score: number;
  /** ID of a command that is mapped to this result's domain */
  commandId?: string;  // Widened from CommandId | LocalCommandId | 'ai'
}

export interface CommonCommandSearchResult {
  _kind: 'common_command';
  id: CommandId;
  label: string;
  description: string;
  command: CommandDefinition;
  query: string;
}

export interface AutomationSearchResult {
  _kind: 'automation';
  automation: SavedAutomation;
  score: number;
}

export interface ModuleSearchResult {
  _kind: 'module';
  module: InstalledModule;
  score: number;
}

export interface AgentCollectionSearchResult {
  _kind: 'agent_collection';
  title: string;
  itemCount: number;
  score: number;
}

export interface NoteSearchResult {
  _kind: 'note';
  id: string;
  title: string;
  body: string;
  score: number;
}

export interface LinkSearchResult {
  _kind: 'link';
  id: string;
  title: string;
  score: number;
}

export interface SnippetSearchResult {
  _kind: 'snippet';
  id: string;
  title: string;
  score: number;
}

export interface SessionSearchResult {
  _kind: 'session';
  id: string;
  title: string;
  score: number;
}

export interface PromptSearchResult {
  _kind: 'prompt';
  id: string;
  title: string;
  score: number;
}

export type UnifiedSearchResult =
  | CommandSearchResult
  | HistorySearchResult
  | BookmarkSearchResult
  | CommonCommandSearchResult
  | AutomationSearchResult
  | ModuleSearchResult
  | AgentCollectionSearchResult
  | NoteSearchResult
  | LinkSearchResult
  | SnippetSearchResult
  | SessionSearchResult
  | PromptSearchResult;

export interface SearchOptions {
  commands: CommandDefinition[];
  localCommands?: LocalCommandDefinition[];
  historyItems: HistoryItem[] | null;

  bookmarks: Array<{ id: string; title: string; url: string }>;
  commonCommands: CommonCommandEntry[];
  automations?: SavedAutomation[];
  agents?: any[];
  modules?: InstalledModule[];
  notes?: Array<{ id: string; title: string; body: string }>;
  links?: Array<{ id: string; title: string }>;
  snippets?: Array<{ id: string; title: string }>;
  sessions?: Array<{ id: string; title: string }>;
  prompts?: Array<{ id: string; title: string }>;
  lockedCommand?: CommandId | LocalCommandId | 'ai' | null;
  selectedFolder?: { folder_id: string } | null;
  selectedTeam?: { workspaces?: Array<{ folders?: Array<{ folder_id: string; folders?: any[] }> }> } | null;
  includeCommonIfEmpty?: boolean;
  returnAllIfEmpty?: boolean;
}

export interface PinnedCommandInfo {
  pinned: CommandDefinition | null;
  searchQuery: string;
  isExplicit: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_RESULTS = 27;
const COMMON_RESULTS_COUNT = 5;
const HISTORY_PRIORITY_THRESHOLD = 0.3; // Fuse score (lower = better match)
const TOP_HISTORY_COUNT = 1; // First 1 history result at the top (position 1), position 2 is for saved link if matched
const HISTORY_AFTER_COMMANDS_COUNT = 1; // Only 1 more history after Google command
const MAX_MAIN_HISTORY = 3; // Max history in main section (top 1 + possibly 1 fallback + 1 after Google)
const MAX_OTHER_HISTORY = 5; // Max history in "Other results" section
const MAX_TOTAL_HISTORY = 8; // Total max history results (3 main + 5 other)
const GOOGLE_POSITION = 1; // 0-indexed, so position 2 (after history)
const MAX_QUERY_LENGTH = 25; // Skip heavy searches for queries longer than this to prevent lag
const HISTORY_RECENT_WINDOW = 200; // Only evaluate the most recent N history entries

// Category filter keywords
const CATEGORY_KEYWORDS = {
  note: 'note' as const,
  notes: 'note' as const,
  snippet: 'snippet' as const,
  snippets: 'snippet' as const,
  link: 'link' as const,
  links: 'link' as const,
  history: 'history' as const,
};

export type CategoryFilter = 'note' | 'snippet' | 'link' | 'history' | null;

// Fuse.js options for different data sources
// Lower threshold = stricter matching (0.0 = exact match, 1.0 = match anything)
const COMMAND_FUSE_OPTIONS: IFuseOptions<CommandDefinition> = {
  includeScore: true,
  threshold: 0.3,
  ignoreLocation: true,
  minMatchCharLength: 1,
  keys: ['label', 'id', 'prefix', 'keywords'] as const,
};

const LOCAL_COMMAND_FUSE_OPTIONS: IFuseOptions<LocalCommandDefinition> = {
  includeScore: true,
  threshold: 0.3,
  ignoreLocation: true,
  minMatchCharLength: 1,
  keys: ['label', 'id', 'prefix', 'keywords'] as const,
};

// Stricter threshold for history to avoid irrelevant results
// We search on title and domain only, not the full URL path
const HISTORY_FUSE_OPTIONS: IFuseOptions<HistoryItem> = {
  includeScore: true,
  threshold: 0.25,
  ignoreLocation: true,
  minMatchCharLength: 2,
  keys: ['title', 'domain', 'url'] as const,
};

/**
 * Extract base URL from a URL (protocol + hostname only, no path or query)
 * Example: "https://mail.google.com/inbox?page=1" → "https://mail.google.com"
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    // Return origin (protocol + hostname) for better searchability
    return urlObj.origin;
  } catch {
    // Fallback: try to extract base URL manually
    const match = url.match(/^(https?:\/\/)?(?:www\.)?([^/]+)/i);
    if (match) {
      const protocol = match[1] || 'https://';
      return `${protocol}${match[2]}`;
    }
    return url;
  }
}

/**
 * Find a command that matches the domain of a given URL.
 */
export function findCommandByUrl(
  url: string,
  availableCommands: (CommandDefinition | LocalCommandDefinition)[],
): CommandDefinition | LocalCommandDefinition | undefined {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace(/^www\./, '');

    // Exact match or subdomain match
    return availableCommands.find(cmd => {
      const iconHost = (cmd as any).iconHost;
      if (!iconHost) return false;
      const cmdHost = (iconHost as string).replace(/^www\./, '');
      // Match exact domain (youtube.com) or subdomains (m.youtube.com)
      return hostname === cmdHost || hostname.endsWith('.' + cmdHost);
    });
  } catch {
    return undefined;
  }
}

import type { SavedAutomation } from '../../../allObjectFolder/src/createObject/automationBeta/utilities/automation';

export type ContextualMatch = {
  id: string;
  label: string;
  type: 'command' | 'automation' | 'agent' | 'module';
  command?: CommandDefinition;
  automation?: SavedAutomation;
  agent?: any; // AgentCollectionSuggestionItem
  module?: InstalledModule;
};

export type InstalledModule = ModuleDefinition & {
  module_key?: string;
  description?: string;
  icon_host?: string;
  parent_description?: string;
  parent_icon_host?: string;
  variables?: any[];
};

/**
 * Find matching commands and automations for a result.
 */
export function findContextualMatches(
  item: any,
  commands: CommandDefinition[],
  automations: SavedAutomation[],
): ContextualMatch[] {
  const matches: ContextualMatch[] = [];
  const url = item.url;
  if (!url) return matches;

  // 1. Find Commands by URL Domain
  const matchedCmd = findCommandByUrl(url, commands);
  if (matchedCmd && matchedCmd.id !== 'createnotes' && matchedCmd.id !== 'createlinks' && matchedCmd.id !== 'createsession') {
    matches.push({
      id: matchedCmd.id,
      label: matchedCmd.label,
      type: 'command',
      command: matchedCmd as CommandDefinition,
    });
  }

  // 2. Find Automations by name matching domain
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname
      .toLowerCase()
      .replace(/^www\./, '')
      .split('.')[0];
    if (domain && domain.length > 2) {
      automations.forEach(auto => {
        if (!auto || !auto.name) return;
        if (String(auto.name).toLowerCase().includes(domain) && !matches.some(m => m.id === auto.id)) {
          matches.push({
            id: String(auto.id),
            label: auto.name,
            type: 'automation',
            automation: auto,
          });
        }
      });
    }
  } catch (e) {
    /* ignore */
  }

  return matches;
}

// HistoryItem now includes an optional domain field



const BOOKMARK_FUSE_OPTIONS: IFuseOptions<{ id: string; title: string; url: string }> = {
  includeScore: true,
  threshold: 0.25,
  ignoreLocation: true,
  minMatchCharLength: 2,
  keys: ['title', 'url'] as const,
};

// ============================================================================
// FUSE.JS INSTANCE CACHE
// Cache Fuse instances to prevent memory leaks from creating new instances
// on every keystroke. Only rebuild when underlying data changes.
// ============================================================================

type BookmarkItem = { id: string; title: string; url: string };

interface FuseCache {
  commands: {
    instance: Fuse<CommandDefinition> | null;
    dataRef: CommandDefinition[] | null;
  };
  localCommands: {
    instance: Fuse<LocalCommandDefinition> | null;
    initialized: boolean;
  };
  history: {
    instance: Fuse<HistoryItem> | null;
    dataRef: HistoryItem[] | null;
    processedItems: HistoryItem[] | null; // This now holds pre-processed items to avoid rebuilding Fuse on every keystroke
    dataLength: number;
  };

  bookmarks: {
    instance: Fuse<BookmarkItem> | null;
    dataRef: BookmarkItem[] | null;
    dataLength: number;
  };
}

const fuseCache: FuseCache = {
  commands: { instance: null, dataRef: null },
  localCommands: { instance: null, initialized: false },
  history: { instance: null, dataRef: null, processedItems: null, dataLength: 0 },

  bookmarks: { instance: null, dataRef: null, dataLength: 0 },
};



// ============================================================================
// QUERY TOKEN VALIDATION
// ============================================================================

/**
 * Extracts meaningful tokens from a query string.
 * Filters out common stop words and short tokens.
 */
function extractQueryTokens(query: string): string[] {
  const stopWords = new Set([
    'a',
    'an',
    'the',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'shall',
    'can',
    'need',
    'dare',
    'ought',
    'used',
    'to',
    'of',
    'in',
    'for',
    'on',
    'with',
    'at',
    'by',
    'from',
    'as',
    'into',
    'through',
    'during',
    'before',
    'after',
    'above',
    'below',
    'between',
    'under',
    'again',
    'further',
    'then',
    'once',
    'here',
    'there',
    'when',
    'where',
    'why',
    'how',
    'all',
    'each',
    'few',
    'more',
    'most',
    'other',
    'some',
    'such',
    'no',
    'nor',
    'not',
    'only',
    'own',
    'same',
    'so',
    'than',
    'too',
    'very',
    's',
    't',
    'just',
    'don',
    'now',
    'my',
    'your',
    'his',
    'her',
    'its',
    'our',
    'their',
    'this',
    'that',
    'these',
    'those',
    'am',
    'it',
    'i',
    'me',
    'we',
    'you',
    'he',
    'she',
    'they',
    'them',
    'what',
    'which',
    'who',
    'whom',
    'and',
    'but',
    'if',
    'or',
    'because',
    'until',
    'while',
    'about',
    'against',
    'also',
  ]);

  return query
    .toLowerCase()
    .split(/\s+/)
    .map(token => token.replace(/[^a-z0-9]/g, ''))
    .filter(token => token.length >= 1 && !stopWords.has(token));
}

/**
 * Validates that a text string contains at least one of the query tokens.
 * This helps filter out false positives from Fuse.js fuzzy matching.
 */
function textContainsAnyToken(text: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const lowerText = text.toLowerCase();
  return tokens.some(token => lowerText.includes(token));
}

/**
 * Validates that a text string contains tokens that START with the query tokens.
 * More strict than simple includes - requires word boundary match.
 */
function textContainsTokenPrefix(text: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const lowerText = text.toLowerCase();
  // Split text into words
  const textWords = lowerText.split(/[^a-z0-9]+/).filter(w => w.length > 0);

  // For each query token, check if any text word starts with it
  return tokens.some(token => textWords.some(word => word.startsWith(token) || word === token));
}

/**
 * Validates that a text string contains ALL query tokens (in any order).
 * This allows matching "chatgpt api" when user types "api chatgpt".
 * Each token must be found as a prefix of at least one word in the text.
 */
function textContainsAllTokensInAnyOrder(text: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const lowerText = text.toLowerCase();
  // Split text into words
  const textWords = lowerText.split(/[^a-z0-9]+/).filter(w => w.length > 0);

  // Every query token must match at least one word (as prefix or exact)
  return tokens.every(token => textWords.some(word => word.startsWith(token) || word === token));
}

// ============================================================================
// CATEGORY FILTER DETECTION
// ============================================================================

export interface CategoryFilterInfo {
  category: CategoryFilter;
  filteredQuery: string;
}

/**
 * Detect if the query contains a category filter keyword (note, notes, link, links, history).
 * The keyword can appear anywhere in the query.
 *
 * Examples:
 * - "figma note" → category: 'snippet', filteredQuery: 'figma'
 * - "note figma" → category: 'snippet', filteredQuery: 'figma'
 * - "api history" → category: 'history', filteredQuery: 'api'
 * - "link github" → category: 'link', filteredQuery: 'github'
 */
export function detectCategoryFilter(query: string): CategoryFilterInfo {
  const words = query.toLowerCase().trim().split(/\s+/);

  // Find the first category keyword in the query
  let detectedCategory: CategoryFilter = null;
  let keywordIndex = -1;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word in CATEGORY_KEYWORDS) {
      detectedCategory = CATEGORY_KEYWORDS[word as keyof typeof CATEGORY_KEYWORDS];
      keywordIndex = i;
      break;
    }
  }

  if (detectedCategory === null) {
    return { category: null, filteredQuery: query.trim() };
  }

  // Remove the keyword from the query (preserve original case)
  const originalWords = query.trim().split(/\s+/);
  const filteredWords = originalWords.filter((_, i) => i !== keywordIndex);
  const filteredQuery = filteredWords.join(' ').trim();

  return { category: detectedCategory, filteredQuery };
}

// ============================================================================
// COMMAND PIN DETECTION
// ============================================================================
/**
 * Detect if the query contains an explicit (/cmd) or implicit (cmd query / query cmd) command pin.
 *
 * Explicit: /g what is weather → pin Google, searchQuery = "what is weather"
 * Implicit (prefix): g what is weather → pin Google, searchQuery = "what is weather"
 * Implicit (suffix): what is weather g → pin Google, searchQuery = "what is weather"
 */
export function detectPinnedCommand(query: string, commands: CommandDefinition[]): PinnedCommandInfo {
  const trimmed = query.trim();

  if (!trimmed) {
    return { pinned: null, searchQuery: '', isExplicit: false };
  }


  // Implicit: first or last token matches a command prefix
  const spaceIndex = trimmed.indexOf(' ');
  if (spaceIndex === -1) {
    // Single word - don't treat as implicit command unless it's an exact match
    // and the user is clearly trying to use a command
    return { pinned: null, searchQuery: trimmed, isExplicit: false };
  }

  // Check first token (prefix position: "g what is weather")
  const firstToken = trimmed.slice(0, spaceIndex).toLowerCase();
  const searchQueryFromPrefix = trimmed.slice(spaceIndex + 1).trim();

  const cmdFromFirst = findCommandByAnyId(commands, firstToken) || findCommandByAnyId(LOCAL_COMMANDS as any, firstToken);

  if (cmdFromFirst) {
    return { pinned: cmdFromFirst, searchQuery: searchQueryFromPrefix, isExplicit: false };
  }

  // Check last token (suffix position: "what is weather g")
  const lastSpaceIndex = trimmed.lastIndexOf(' ');
  const lastToken = trimmed.slice(lastSpaceIndex + 1).toLowerCase();
  const searchQueryFromSuffix = trimmed.slice(0, lastSpaceIndex).trim();

  const cmdFromLast = findCommandByAnyId(commands, lastToken) || findCommandByAnyId(LOCAL_COMMANDS as any, lastToken);

  if (cmdFromLast) {
    return { pinned: cmdFromLast, searchQuery: searchQueryFromSuffix, isExplicit: false };
  }

  return { pinned: null, searchQuery: trimmed, isExplicit: false };
}

// ============================================================================
// SEARCH FUNCTIONS
// ============================================================================

/**
 * Checks if a command matches all query tokens (word-order-independent).
 * This allows "notes create" to match "Create Notes" command.
 */
function commandMatchesAllTokens(label: string, keywords: string[] | undefined, queryTokens: string[]): boolean {
  if (queryTokens.length === 0) return false;

  // Combine label and keywords into searchable text
  const searchableText = [label, ...(keywords || [])].join(' ').toLowerCase();
  const textWords = searchableText.split(/[^a-z0-9]+/).filter(w => w.length > 0);

  // Every query token must match at least one word (as prefix or exact)
  return queryTokens.every(token => textWords.some(word => word.startsWith(token) || word === token));
}

/**
 * Search remote commands using Fuse.js with word-order-independent matching.
 * This allows queries like "notes create" to match "Create Notes" command.
 */
function searchRemoteCommands(query: string, commands: CommandDefinition[], limit: number = 10): CommandSearchResult[] {
  if (!query.trim() || commands.length === 0) {
    return [];
  }

  const queryTokens = extractQueryTokens(query);

  // Use cached Fuse instance - only rebuild if commands array reference changed
  if (fuseCache.commands.dataRef !== commands) {
    fuseCache.commands.instance = new Fuse(commands, COMMAND_FUSE_OPTIONS);
    fuseCache.commands.dataRef = commands;
  }
  const fuseResults = fuseCache.commands.instance!.search(query, { limit: limit * 2 });

  // Also find commands that match all tokens in any order
  const tokenMatchedCommands = commands.filter(cmd => commandMatchesAllTokens(cmd.label, cmd.keywords, queryTokens));

  // Build result map (use command ID as key for deduplication)
  const resultMap = new Map<string, CommandSearchResult>();

  // Add Fuse results first (they have scores)
  for (const result of fuseResults) {
    resultMap.set(String(result.item.id), {
      _kind: 'command' as const,
      commandType: 'remote' as const,
      id: result.item.id,
      label: result.item.label,
      prefix: result.item.prefix,
      score: result.score ?? 1,
      command: result.item,
    });
  }

  // Add token-matched commands with a good score (if not already present)
  for (const cmd of tokenMatchedCommands) {
    if (!resultMap.has(String(cmd.id))) {
      resultMap.set(String(cmd.id), {
        _kind: 'command' as const,
        commandType: 'remote' as const,
        id: cmd.id,
        label: cmd.label,
        prefix: cmd.prefix,
        score: 0.2, // Give a good score for token matches
        command: cmd,
      });
    }
  }

  // Convert to array, sort by score, and limit
  const results = Array.from(resultMap.values())
    .filter(res => !['gpt', 'perplexity', 'gemini'].includes(res.id))
    .sort((a, b) => a.score - b.score);

  return results.slice(0, limit);
}

/**
 * Search local commands using Fuse.js with word-order-independent matching.
 * This allows queries like "notes create" to match "Create Notes" command.
 */
function searchLocalCommands(query: string, limit: number = 10): CommandSearchResult[] {
  if (!query.trim() || LOCAL_COMMANDS.length === 0) {
    return [];
  }

  const queryTokens = extractQueryTokens(query);

  // Use cached Fuse instance - LOCAL_COMMANDS is static, only initialize once
  if (!fuseCache.localCommands.initialized) {
    fuseCache.localCommands.instance = new Fuse(LOCAL_COMMANDS, LOCAL_COMMAND_FUSE_OPTIONS);
    fuseCache.localCommands.initialized = true;
  }
  const fuseResults = fuseCache.localCommands.instance!.search(query, { limit: limit * 2 });

  // Also find commands that match all tokens in any order
  const tokenMatchedCommands = LOCAL_COMMANDS.filter(cmd =>
    commandMatchesAllTokens(cmd.label, cmd.keywords, queryTokens),
  );

  // Build result map (use command ID as key for deduplication)
  const resultMap = new Map<string, CommandSearchResult>();

  // Add Fuse results first (they have scores)
  for (const result of fuseResults) {
    resultMap.set(String(result.item.id), {
      _kind: 'command' as const,
      commandType: 'local' as const,
      id: result.item.id,
      label: result.item.label,
      prefix: result.item.prefix,
      score: result.score ?? 1,
      command: result.item,
    });
  }

  // Add token-matched commands with a good score (if not already present)
  for (const cmd of tokenMatchedCommands) {
    if (!resultMap.has(String(cmd.id))) {
      resultMap.set(String(cmd.id), {
        _kind: 'command' as const,
        commandType: 'local' as const,
        id: cmd.id,
        label: cmd.label,
        prefix: cmd.prefix,
        score: 0.2, // Give a good score for token matches
        command: cmd,
      });
    }
  }

  // Convert to array, sort by score, and limit
  return Array.from(resultMap.values())
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}

/**
 * Chrome Omnibox-like Frecency Algorithm for History Search
 *
 * This algorithm mimics Chrome's omnibox behavior by combining:
 * 1. Prefix matching (like Chrome's typed URL boost)
 * 2. Domain-level matching with bonuses
 * 3. Frecency = Frequency × Recency with exponential decay
 * 4. Word boundary matching for better relevance
 *
 * Score calculation (lower = better, consistent with Fuse.js):
 * - Base score from text matching (0-1)
 * - Subtract frecency bonus (frequency + recency)
 * - Subtract prefix/domain match bonuses
 */

/**
 * Calculate frecency bonus based on Chrome's model
 * - Frequency: Log-scaled visit count (prevents domination by very high counts)
 * - Recency: Exponential decay based on time since last visit
 */
function calculateFrecencyBonus(visitCount: number, lastVisitTime: number): number {
  const now = Date.now();
  const hoursSinceVisit = (now - lastVisitTime) / (1000 * 60 * 60);

  // Recency weight using exponential decay (Chrome-like)
  // Recent visits (today) get maximum weight, older visits decay exponentially
  let recencyWeight: number;
  if (hoursSinceVisit < 4) {
    // Visited in last 4 hours - maximum recency bonus
    recencyWeight = 1.0;
  } else if (hoursSinceVisit < 24) {
    // Visited today - very high recency
    recencyWeight = 0.9;
  } else if (hoursSinceVisit < 24 * 7) {
    // Visited this week - good recency
    recencyWeight = 0.7;
  } else if (hoursSinceVisit < 24 * 30) {
    // Visited this month - moderate recency
    recencyWeight = 0.5;
  } else if (hoursSinceVisit < 24 * 90) {
    // Visited in last 3 months - low recency
    recencyWeight = 0.3;
  } else {
    // Older than 3 months - minimal recency
    recencyWeight = 0.1;
  }

  // Frequency weight using logarithmic scale
  // visitCount: 1 → 0.0, 5 → 0.7, 10 → 1.0, 50 → 1.7, 100 → 2.0, 1000 → 3.0
  const frequencyWeight = Math.log10(Math.max(1, visitCount));

  // Combine frequency and recency (Chrome uses multiplication in frecency)
  // Max possible: ~3.0 (frequency) × 1.0 (recency) = 3.0
  // We normalize to 0-0.5 range for score subtraction
  const frecencyScore = (frequencyWeight * recencyWeight) / 6;

  return Math.min(0.5, frecencyScore);
}

/**
 * Calculate prefix/domain match bonus (simulates Chrome's "typed URL" behavior)
 * When user types "gi" and "github.com" appears first, it's because of prefix matching
 */
function calculatePrefixBonus(query: string, title: string, url: string): number {
  const normalizedQuery = query.toLowerCase().trim();
  const normalizedTitle = title.toLowerCase();

  let bonus = 0;

  // Extract domain from URL
  let domain = '';
  let domainWithoutWww = '';
  try {
    const urlObj = new URL(url);
    domain = urlObj.hostname.toLowerCase();
    domainWithoutWww = domain.replace(/^www\./, '');
  } catch {
    domain = url.toLowerCase();
    domainWithoutWww = domain;
  }

  // HIGHEST PRIORITY: Exact domain match (e.g., "github" → "github.com")
  if (domainWithoutWww === normalizedQuery || domainWithoutWww === normalizedQuery + '.com') {
    bonus += 0.4;
  }
  // Domain starts with query (e.g., "git" → "github.com") - Chrome's primary ranking signal
  else if (domainWithoutWww.startsWith(normalizedQuery)) {
    bonus += 0.35;
  }
  // Subdomain match (e.g., "mail" → "mail.google.com")
  else if (domain.startsWith(normalizedQuery)) {
    bonus += 0.3;
  }

  // Title starts with query - second highest priority
  if (normalizedTitle.startsWith(normalizedQuery)) {
    bonus += 0.25;
  }
  // Title contains query at word boundary (e.g., "inbox" in "Gmail - Inbox")
  else {
    const words = normalizedTitle.split(/[\s\-_|:,./]+/);
    if (words.some(word => word.startsWith(normalizedQuery))) {
      bonus += 0.15;
    }
  }

  // URL path contains query as word start (e.g., "repo" in "/username/repository")
  const urlPath = url.toLowerCase().split('?')[0]; // Remove query params
  const pathWords = urlPath.split(/[\/\-_]+/).filter(w => w.length > 0);
  if (pathWords.some(word => word.startsWith(normalizedQuery))) {
    bonus += 0.05;
  }

  return Math.min(0.5, bonus);
}

/**
 * Check if result matches ALL query tokens (for multi-word queries)
 * E.g., "github settings" should match pages with both "github" AND "settings"
 */
function matchesAllQueryTokens(
  title: string,
  domain: string | undefined,
  url: string,
  tokens: string[],
): { matches: boolean; matchQuality: number } {
  if (tokens.length === 0) return { matches: true, matchQuality: 1 };

  const combinedText = `${title} ${domain || ''} ${url}`.toLowerCase();
  const words = combinedText.split(/[\s\-_|:,./]+/).filter(w => w.length > 0);

  let matchedTokens = 0;
  let prefixMatches = 0;

  for (const token of tokens) {
    // Check if word starts with token.
    // Also allow a very narrow plural fallback (e.g., "mails" -> "mail").
    const hasPrefixMatch = words.some(word => {
      if (word.startsWith(token)) return true;

      // Strict plural tolerance only: avoid matching long tokens to tiny URL fragments
      // like "zxcvb" -> "z" which causes false positives.
      if (word.length < 3) return false;
      const isSimplePlural = token.length === word.length + 1 && token.startsWith(word) && token.endsWith('s');
      return isSimplePlural;
    });
    // Check if combined text contains this token anywhere
    const hasSubstringMatch = combinedText.includes(token);

    if (hasPrefixMatch) {
      matchedTokens++;
      prefixMatches++;
    } else if (hasSubstringMatch) {
      matchedTokens++;
    }
  }

  if (matchedTokens < tokens.length) {
    return { matches: false, matchQuality: 0 };
  }

  // Higher quality for more prefix matches
  const matchQuality = 0.5 + (prefixMatches / tokens.length) * 0.5;
  return { matches: true, matchQuality };
}

/**
 * Search browser history using Chrome Omnibox-like frecency algorithm.
 *
 * Ranking priority (from highest to lowest):
 * 1. Domain prefix matches (early return, skip Fuse for instant results)
 * 2. Typed URL boost (domain-only visits, short paths)
 * 3. Frecency (frequency × recency)
 * 4. General text match quality
 *
 * Filtering:
 * - Google search results are filtered out (but Google apps like Gmail are kept)
 * - URLs are deduplicated by canonical form
 * - Token coverage threshold reduces junk matches
 */
function searchHistory(query: string, historyItems: HistoryItem[] | null, limit: number = 10): HistorySearchResult[] {
  if (!query.trim() || !historyItems || historyItems.length === 0) {
    return [];
  }

  const recentHistoryItems = [...historyItems]
    .sort((a, b) => (b.lastVisitTime || 0) - (a.lastVisitTime || 0))
    .slice(0, HISTORY_RECENT_WINDOW);

  if (recentHistoryItems.length === 0) {
    return [];
  }

  const normalizedQuery = query.toLowerCase().trim();
  const queryTokens = extractQueryTokens(query);
  const navMode = isLikelyNavigationQuery(normalizedQuery);

  // Use cached Fuse instance - rebuild if history array changed (reference or length)
  const needsRebuild =
    fuseCache.history.dataRef !== historyItems || fuseCache.history.dataLength !== recentHistoryItems.length;
  if (needsRebuild) {
    const preprocessed = preprocessHistoryItems(recentHistoryItems);

    // Ensure all items have a domain for Fuse indexing - modify in place since it's our cache
    preprocessed.forEach((item: HistoryItem) => {
      if (!item.domain) {
        item.domain = extractDomain(item.url);
      }
    });

    fuseCache.history.instance = new Fuse(preprocessed, HISTORY_FUSE_OPTIONS as any);
    fuseCache.history.processedItems = preprocessed;
    fuseCache.history.dataRef = historyItems;
    fuseCache.history.dataLength = recentHistoryItems.length;
  }

  // Step 2: Intelligent Early Return (Destination + High Popularity) - DISABLED/COMMENTED OUT
  /*
  const domainPrefixMatches = (fuseCache.history.processedItems || [])
    .filter(item => {
      // Allow if domain matches prefix OR (if navMode) title matches prefix
      const dMatch = isDomainPrefixMatch(item.url, normalizedQuery);
      const tMatch = (item.title || '').toLowerCase().startsWith(normalizedQuery);
      return dMatch || (navMode && tMatch);
    })
    .map(item => {
      let score = getDomainPrefixScore(item.url, normalizedQuery);
      const title = (item.title || '').toLowerCase();
      const isTitlePrefixMatch = title.startsWith(normalizedQuery);

      // Dual Match Bonus: Significant signal, but don't let it drown out high-frequency domains
      if (score > 0 && isTitlePrefixMatch) {
        score += 0.15; // Reduced from 0.4
      } else if (isTitlePrefixMatch) {
        // Simple title prefix match
        score += 0.08; // Reduced from 0.15
      }

      // POPULARITY WEIGHT: Heavily reward high-frequency destinations
      // Use steeper curve for power-user sites (0.5 max)
      const popularityScore = Math.min(0.5, Math.log10(Math.max(1, item.visitCount)) / 5);
      score += popularityScore;

      // PATH DEPTH PENALTY: Reward destinations over deep-content paths
      try {
        const u = new URL(item.url);
        const segments = u.pathname.split('/').filter(Boolean).length;
        if (segments === 0) score += 0.15; // Root domain boost
        if (segments > 2) score -= 0.15; // Deep path penalty
        if (segments > 4) score -= 0.3; // Very deep path penalty
      } catch { }

      // Accidental Mobile Subdomain Penalty (Already implemented)
      try {
        const u = new URL(item.url);
        const hostParts = u.hostname
          .toLowerCase()
          .replace(/^www\./, '')
          .split('.');
        if ((hostParts[0] === 'm' || hostParts[0] === 'mobile') && !title.includes(normalizedQuery)) {
          score -= 0.3;
        }
      } catch { }

      return { item, prefixScore: score };
    })
    .sort((a, b) => {
      const aFrecency = typeof a.item.frecencyScore === 'number' ? a.item.frecencyScore : 0;
      const bFrecency = typeof b.item.frecencyScore === 'number' ? b.item.frecencyScore : 0;
      if (Math.abs(aFrecency - bFrecency) > 1e-6) return bFrecency - aFrecency;

      // Primary: Intelligent Confidence Score
      // If score is very close, use visitCount as tie-breaker
      if (Math.abs(a.prefixScore - b.prefixScore) > 0.01) return b.prefixScore - a.prefixScore;

      // Secondary: Absolute Visit Count
      if (a.item.visitCount !== b.item.visitCount) return b.item.visitCount - a.item.visitCount;
      // Tertiary: Recency
      return b.item.lastVisitTime - a.item.lastVisitTime;
    })
    .slice(0, limit);

  // mentor-fix: Exclusive Domain Return
  if (navMode && domainPrefixMatches.length > 0) {
    return domainPrefixMatches.map(({ item, prefixScore }) => ({
      _kind: 'history' as const,
      id: `history-${item.id}`,
      title: item.title,
      url: item.url,
      lastVisitTime: item.lastVisitTime,
      visitCount: item.visitCount,
      frecencyScore: item.frecencyScore,
      score: Math.max(0, 0.1 - prefixScore),
    }));
  }
  */

  const domainPrefixMatches: any[] = [];
  const domainPrefixIds = new Set<string>();

  // Step 3: Get Fuse.js results for fuzzy matching (for non-domain-prefix matches)
  const fuseResults = fuseCache.history.instance!.search(query, { limit: limit * 4 });

  // also do direct token-prefix matching on all history items (multi-token robust)
  const directTokenMatches = (fuseCache.history.processedItems || [])
    .filter(item => {
      if (domainPrefixIds.has(item.id)) return false; // Skip already matched
      const { matches } = matchesAllQueryTokens(item.title, item.domain, item.url, queryTokens);
      return matches;
    })
    .slice(0, limit);

  // Combine all candidates (excluding domain prefix matches)
  const allCandidates = new Map<string, { item: HistoryItem; fuseScore: number }>();

  // Add Fuse results
  for (const result of fuseResults) {
    if (domainPrefixIds.has(result.item.id)) continue; // Skip domain prefix matches
    allCandidates.set(result.item.id, {
      item: result.item,
      fuseScore: result.score ?? 1,
    });
  }

  // Add direct token matches (with low base score since they're strong matches)
  for (const item of directTokenMatches) {
    if (!allCandidates.has(item.id)) {
      allCandidates.set(item.id, {
        item,
        fuseScore: 0.05, // Very strong match for direct token prefixes
      });
    }
  }

  // Step 4: Score all candidates with token coverage filter
  const scoredResults: Array<{
    item: HistoryItem;
    finalScore: number;
    frecencyBonus: number;
    prefixBonus: number;
  }> = [];

  for (const [, { item, fuseScore }] of allCandidates) {
    // mentor-fix: Penalize deep paths during navigation intent (don't filter)
    const navPenalty = navMode && isDeepPath(item.url) ? 0.15 : 0;

    // Filter: Check if all query tokens match
    const { matches, matchQuality } = matchesAllQueryTokens(item.title, item.domain, item.url, queryTokens);
    if (!matches) continue;

    // Calculate bonuses - DISABLED/COMMENTED OUT
    /*
    const frecencyBonus = calculateFrecencyBonus(item.visitCount, item.lastVisitTime);
    const prefixBonus = calculatePrefixBonus(normalizedQuery, item.title, item.url);
    */
    const frecencyBonus = 0;
    const prefixBonus = 0;

    // Final score: lower is better
    const baseScore = fuseScore * (2 - matchQuality);
    const finalScore = Math.max(0, baseScore - frecencyBonus - prefixBonus + navPenalty);

    scoredResults.push({
      item,
      finalScore,
      frecencyBonus,
      prefixBonus,
    });
  }

  // Sort purely by text score (lower is better)
  scoredResults.sort((a, b) => {
    return a.finalScore - b.finalScore;
  });

  // Step 5: Combine results
  const finalResults: HistorySearchResult[] = [];

  // Add remaining scored results
  for (const { item, finalScore } of scoredResults) {
    if (finalResults.length >= limit) break;
    finalResults.push({
      _kind: 'history' as const,
      id: `history-${item.id}`,
      title: item.title,
      url: item.url,
      lastVisitTime: item.lastVisitTime,
      visitCount: item.visitCount,
      frecencyScore: item.frecencyScore,
      score: finalScore,
    });
  }

  return finalResults.slice(0, limit);
}

/**
 * Recursively collects all folder IDs from a folder and all its sub-folders
 */
function collectFolderIds(
  folder: { folder_id: string; folders?: Array<{ folder_id: string; folders?: any[] }> },
  folderIdSet: Set<string>,
): void {
  folderIdSet.add(folder.folder_id);
  if (folder.folders && folder.folders.length > 0) {
    folder.folders.forEach(subFolder => {
      collectFolderIds(subFolder, folderIdSet);
    });
  }
}




/**
 * Search bookmarks using Fuse.js
 */
function searchBookmarks(
  query: string,
  bookmarks: Array<{ id: string; title: string; url: string }>,
  limit: number = 5,
): BookmarkSearchResult[] {
  if (!query.trim() || bookmarks.length === 0) {
    return [];
  }

  // Use cached Fuse instance - rebuild if bookmarks array changed
  const needsRebuild = fuseCache.bookmarks.dataRef !== bookmarks || fuseCache.bookmarks.dataLength !== bookmarks.length;
  if (needsRebuild) {
    fuseCache.bookmarks.instance = new Fuse(bookmarks, BOOKMARK_FUSE_OPTIONS);
    fuseCache.bookmarks.dataRef = bookmarks;
    fuseCache.bookmarks.dataLength = bookmarks.length;
  }
  const results = fuseCache.bookmarks.instance!.search(query, { limit });

  return results.map(result => ({
    _kind: 'bookmark' as const,
    id: result.item.id,
    title: result.item.title,
    url: result.item.url,
    score: result.score ?? 1,
  }));
}

/**
 * Build common command results (ChatGPT, Perplexity, and optionally Google)
 * @param query - The search query
 * @param commonCommands - Available common command entries
 * @param excludeGoogle - If true, excludes Google from results (used when Fuse search is active to avoid duplication)
 */
function buildCommonResults(
  query: string,
  commonCommands: CommonCommandEntry[],
  excludeGoogle: boolean = false,
  allowEmpty: boolean = false, // New parameter
): CommonCommandSearchResult[] {
  if (!query.trim() && !allowEmpty) {
    return [];
  }

  // Filter out Google when Fuse search is active (Google already shows at position 3)
  const filteredCommands = excludeGoogle
    ? commonCommands.filter(entry => entry.id !== 'google' && entry.id !== 'g')
    : commonCommands;

  return filteredCommands.map(entry => ({
    _kind: 'common_command' as const,
    id: entry.command.id,
    label: entry.label,
    description: entry.description,
    command: entry.command,
    query: query.trim(),
  }));
}



/**
 * Search automations by name matching query.
 */
function searchAutomations(query: string, automations: SavedAutomation[] | undefined): AutomationSearchResult[] {
  if (!query.trim() || !automations || automations.length === 0) {
    return [];
  }
  const normalized = query.toLowerCase();
  return automations
    .filter(auto => auto && auto.name && String(auto.name).toLowerCase().includes(normalized))
    .map(auto => ({
      _kind: 'automation' as const,
      automation: auto,
      score: 0.5,
    }));
}

/**
 * Search installed modules by name/description matching query.
 */
function searchModules(query: string, modules: InstalledModule[] | undefined): ModuleSearchResult[] {
  if (!query.trim() || !modules || modules.length === 0) {
    return [];
  }
  const normalized = query.toLowerCase();
  return modules
    .filter(module => {
      if (!module) return false;
      const name = String(module.name || module.module_key || '').toLowerCase();
      const desc = String(module.description || module.parent_description || '').toLowerCase();
      return (name && name.includes(normalized)) || (desc && desc.includes(normalized));
    })
    .map(module => ({
      _kind: 'module' as const,
      module,
      score: 0.5,
    }));
}

/**
 * Search agent collections by title matching query.
 */
function searchAgentCollections(query: string, agents: any[] | undefined): AgentCollectionSearchResult[] {
  if (!query.trim() || !agents || agents.length === 0) {
    return [];
  }
  const normalized = query.toLowerCase();
  return agents
    .filter(agent => agent && agent.title && String(agent.title).toLowerCase().includes(normalized))
    .map(agent => ({
      _kind: 'agent_collection' as const,
      title: agent.title,
      itemCount: agent.itemCount || 0,
      score: 0.5,
    }));
}

// ============================================================================
// MAIN SEARCH ORCHESTRATOR
// ============================================================================

/**
 * Main search function that orchestrates all data sources and applies custom ordering rules.
 *
 * CATEGORY RANKING (not filter!):
 * - "figma note" or "note figma" → Commands first, then notes with "figma", then other results
 * - "figma link" or "link figma" → Commands first, then links with "figma", then other results
 * - "figma history" → Commands first, then history with "figma", then other results
 * - "note" alone → Normal search (category keyword ignored when no other words)
 * - "Create note" → Shows "Create note" command (commands use original query)
 *
 * ORDERING RULES (when no category keyword):
 * 1. Position 1-2: Top 2 history results (if matched)
 * 2. Position 3: Google Search (ALWAYS fixed)
 * 3. Position 4+: Commands (excluding Google)
 * 4. After commands: 1 more history result (total 3 in main section)
 * 5. Then: Notes/Links → Bookmarks
 * 6. "Other results" section: Up to 5 more history (marked with isOtherResult=true)
 * 7. Automations, Modules & Agents: Up to matching count, before common results
 * 8. Last 5 positions: Common Results (ChatGPT, Perplexity, Gemini, etc.)
 * 9. Total limit: 27 results
 * 10. Max history: 8 total (3 main + 5 "Other results")
 * 11. Pinned command (explicit /cmd or implicit cmd) overrides position 1
 */
export function searchAll(query: string, options: SearchOptions): UnifiedSearchResult[] {
  const {
    commands,
    historyItems,
    bookmarks,
    commonCommands,
    lockedCommand,
    selectedFolder,
    selectedTeam,
  } = options;

  // If a command is already locked, don't show suggestions
  if (lockedCommand) {
    return [];
  }

  const trimmedQuery = query.trim();
  if (!trimmedQuery && !options.returnAllIfEmpty) {


    // If we have an empty query but want common commands (e.g. for drag & drop or initial load)
    // If we have an empty query but want common commands (e.g. for drag & drop or initial load)
    if (options.includeCommonIfEmpty) {
      const results: UnifiedSearchResult[] = [];

      // 1. Common AI Tools
      // Allow empty query for generating common results
      // options.commonCommands now includes usage context if needed, but here we just want the list
      // The list is controlled by COMMON_COMMAND_IDS in commonResults.ts
      const commonResults = buildCommonResults('', options.commonCommands, false, true);
      for (const common of commonResults) {
        results.push(common);
      }

      return results;
    }
    return [];
  }

  // Performance optimization: Skip heavy searches (history, snippets, bookmarks) for long queries
  // to prevent lag. Only return common results (GPT, Perplexity, Google, Gemini) for quick access.
  if (trimmedQuery.length > MAX_QUERY_LENGTH) {
    // Build only common results for long queries (no expensive Fuse.js searches)
    // Include Google here since Fuse search is skipped and Google won't show at position 3
    const commonResults = buildCommonResults(trimmedQuery, options.commonCommands, false);
    return commonResults.slice(0, COMMON_RESULTS_COUNT);
  }

  // Check for category filter keywords (note, notes, link, links, history)
  // ONLY apply if there's actual content besides the keyword
  const { category: categoryFilter, filteredQuery: categoryFilteredQuery } = detectCategoryFilter(trimmedQuery);

  // If the filtered query is empty, it means only a category keyword was typed
  // In this case, ignore the category filter and search normally
  const hasCategoryFilter = categoryFilter !== null && categoryFilteredQuery.trim().length > 0;

  // For command detection, use ORIGINAL query so "Create note" still matches the command
  const queryForPinDetection = trimmedQuery;

  // Check for explicit/implicit command pin
  const { pinned, searchQuery, isExplicit } = detectPinnedCommand(queryForPinDetection, commands);

  // If we have a pinned command with explicit syntax, only show that command
  if (pinned && isExplicit && !searchQuery) {
    return [
      {
        _kind: 'command',
        commandType: 'remote',
        id: pinned.id,
        label: pinned.label,
        prefix: pinned.prefix,
        score: 0,
        command: pinned,
      },
    ];
  }

  // Use the search query (with command prefix stripped if pinned)
  // For category filter, use filtered query for data searches but original for commands
  const effectiveQuery = pinned ? searchQuery : hasCategoryFilter ? categoryFilteredQuery : trimmedQuery;

  if (!effectiveQuery) {
    // Just the command prefix typed - show the pinned command
    if (pinned) {
      return [
        {
          _kind: 'command',
          commandType: 'remote',
          id: pinned.id,
          label: pinned.label,
          prefix: pinned.prefix,
          score: 0,
          command: pinned,
        },
      ];
    }
    
    // [NEW] If returnAllIfEmpty is true, fetch all items from each category instead of returning empty array
    if (options.returnAllIfEmpty) {
      
      const allResults: UnifiedSearchResult[] = [];
      

      
      // All remote commands
      if (commands) {
        const filteredCommands = commands.filter(c => c.prefix && c.prefix.trim() !== '');
        allResults.push(...filteredCommands.map(c => ({
          _kind: 'command' as const,
          commandType: 'remote' as const,
          id: c.id,
          label: c.label,
          prefix: c.prefix,
          score: 1,
          command: c
        })));
      }

      // All local commands
      const localCmds = options.localCommands && options.localCommands.length ? options.localCommands : (typeof LOCAL_COMMANDS !== 'undefined' && LOCAL_COMMANDS ? LOCAL_COMMANDS : []);
      if (localCmds.length > 0) {
        allResults.push(...localCmds.map(c => ({
          _kind: 'command' as const,
          commandType: 'local' as const,
          id: c.id,
          label: c.label,
          prefix: c.prefix,
          score: 1,
          command: c
        })));
      }

      // All common commands (browser/AI tools)
      if (options.commonCommands) {
        const common = buildCommonResults('', options.commonCommands, false, true);
        allResults.push(...common.map(c => ({ ...c, score: 1 })));
      }

      // All history items
      if (options.historyItems) {
        allResults.push(...options.historyItems.map(h => ({
          _kind: 'history' as const,
          id: String(h.id),
          title: h.title,
          url: h.url,
          lastVisitTime: h.lastVisitTime,
          visitCount: h.visitCount,
          score: 1
        })));
      }
      
      // All bookmarks
      if (options.bookmarks) {
        allResults.push(...options.bookmarks.map(b => ({
          _kind: 'bookmark' as const,
          id: b.id,
          title: b.title,
          url: b.url,
          score: 1
        })));
      }

      // All automations
      if (options.automations) {
        allResults.push(...options.automations.map(a => ({
          _kind: 'automation' as const,
          automation: a,
          score: 1
        })));
      }

      // All agents
      if (options.agents) {
        allResults.push(...options.agents.map((a: any) => ({
          _kind: 'agent_collection' as const,
          title: a.title,
          itemCount: a.items?.length || 0,
          score: 1,
          ...a
        })));
      }

 
      

      return allResults;
    }

    return [];
  }

  // Search all data sources
  // Commands use ORIGINAL query so "Create note" still matches the "Create note" command
  const remoteCommandResults = searchRemoteCommands(trimmedQuery, commands, 15);
  const localCommandResults = searchLocalCommands(trimmedQuery, 10);
  // Combine remote and local commands, sorted by score
  const commandResults = [...remoteCommandResults, ...localCommandResults]
    .sort((a, b) => a.score - b.score) // Lower score = better match in Fuse.js
    .slice(0, 15);

  // For history, snippets, bookmarks - use the filtered query if category filter is active
  const dataQuery = hasCategoryFilter ? categoryFilteredQuery : effectiveQuery;
  const historyResults: HistorySearchResult[] = [];
  const bookmarkResults = searchBookmarks(dataQuery, bookmarks, 5);
  const automationResults = searchAutomations(dataQuery, options.automations);
  const agentResults = searchAgentCollections(dataQuery, options.agents);
  const moduleResults = searchModules(dataQuery, options.modules);

  // Helper: search a flat array of items by title substring match
  function searchByTitle<T extends { _kind: any }>(
    items: any[] | undefined,
    kind: T['_kind'],
    q: string,
  ): T[] {
    if (!q || !items?.length) return [];
    return items.reduce<T[]>((acc, item) => {
      const titleLower = (item.title || '').toLowerCase();
      if (titleLower.includes(q)) {
        const score = titleLower.startsWith(q) ? 0.1 : 0.3;
        acc.push({ ...item, _kind: kind, id: item.id, title: item.title, score } as unknown as T);
      }
      return acc;
    }, []);
  }

  const q = dataQuery.toLowerCase();

  // Search notes by title/body match
  const noteResults: NoteSearchResult[] = dataQuery
    ? (options.notes || []).reduce<NoteSearchResult[]>((acc, note) => {
        const titleLower = (note.title || '').toLowerCase();
        const bodyLower = (note.body || '').toLowerCase();
        if (titleLower.includes(q) || bodyLower.includes(q)) {
          const titleScore = titleLower.startsWith(q) ? 0.1 : titleLower.includes(q) ? 0.3 : 0.5;
          acc.push({ ...note, _kind: 'note', id: note.id, title: note.title, body: note.body, score: titleScore } as unknown as NoteSearchResult);
        }
        return acc;
      }, [])
    : [];

  const linkResults = searchByTitle<LinkSearchResult>(options.links, 'link', q);
  const snippetResults = searchByTitle<SnippetSearchResult>(options.snippets, 'snippet', q);
  const sessionResults = searchByTitle<SessionSearchResult>(options.sessions, 'session', q);
  const promptResults = searchByTitle<PromptSearchResult>(options.prompts, 'prompt', q);

  // Exclude Google from common results since it already shows at position 3 (Fuse search is active)
  const commonResults = buildCommonResults(effectiveQuery, commonCommands, true);

  // --- Domain-to-Command Mapping & Ranking Boost ---
  // Identify if any history/bookmark items have associated commands for contextual actions
  // Only check remote (user) commands as per user request
  const allAvailableCommands = commands;

  historyResults.forEach(hist => {
    const matchedCmd = findCommandByUrl(hist.url, allAvailableCommands);
    if (matchedCmd) {
      hist.commandId = matchedCmd.id;
      // Intelligent Ranking Boost: Prioritize results with associated commands
      // A score reduction of 0.2 is significant in Fuse.js (lower is better)
      hist.score = Math.max(0, hist.score - 0.2);
    }
  });

  bookmarkResults.forEach(bm => {
    const matchedCmd = findCommandByUrl(bm.url, allAvailableCommands);
    if (matchedCmd) {
      bm.commandId = matchedCmd.id;
      bm.score = Math.max(0, bm.score - 0.2);
    }
  });

  // Re-sort history results after boost to ensure best matches stay on top
  historyResults.sort((a, b) => a.score - b.score);
  historyResults.sort((a, b) => {
    const aFrecency = typeof a.frecencyScore === 'number' ? a.frecencyScore : 0;
    const bFrecency = typeof b.frecencyScore === 'number' ? b.frecencyScore : 0;
    if (Math.abs(aFrecency - bFrecency) > 1e-6) return bFrecency - aFrecency;
    if (a.score !== b.score) return a.score - b.score;
    return b.lastVisitTime - a.lastVisitTime;
  });

  const goodHistoryResults = historyResults.filter(h => h.score <= HISTORY_PRIORITY_THRESHOLD);


  // Combine all results into a single flat array
  const allRawResults: UnifiedSearchResult[] = [
    ...(pinned ? [{
      _kind: 'command' as const,
      commandType: 'remote' as const,
      id: pinned.id,
      label: pinned.label,
      prefix: pinned.prefix,
      score: 0,
      command: pinned,
    }] : []),
    ...commandResults,
    ...noteResults,
    ...linkResults,
    ...snippetResults,
    ...sessionResults,
    ...promptResults,
    ...bookmarkResults,
    ...automationResults,
    ...agentResults,
    ...moduleResults,
    ...commonResults,
    ...goodHistoryResults,
  ];

  // Deduplicate and sort purely by score
  const finalResults: UnifiedSearchResult[] = [];
  const usedIds = new Set<string>();

  // Helper to get unique ID for deduplication
  function getResultId(result: UnifiedSearchResult): string {
    switch (result._kind) {
      case 'command':
        return String(result.id);
      case 'history':
        return result.id;

      case 'bookmark':
        return result.id;
      case 'common_command':
        return `common-${result.id}`;

      case 'automation':
        return `auto-${result.automation.id}`;
      case 'module':
        return `module-${result.module.module_id}`;
      case 'agent_collection':
        return `agent-${result.title}`;
      case 'note':
        return `note-${result.id}`;
      case 'link':
        return `link-${result.id}`;
      case 'snippet':
        return `snippet-${result.id}`;
      case 'session':
        return `session-${result.id}`;
      case 'prompt':
        return `prompt-${result.id}`;
      default:
        return '';
    }
  }

  // Sort: lower score is better. Default score is 1.0.
  const sortedRawResults = allRawResults.sort((a, b) => {
    const scoreA = 'score' in a ? a.score : 1.0;
    const scoreB = 'score' in b ? b.score : 1.0;
    return scoreA - scoreB;
  });

  for (const res of sortedRawResults) {
    const key = `${res._kind}-${getResultId(res)}`;
    if (!usedIds.has(key)) {
      usedIds.add(key);
      finalResults.push(res);
    }
  }

  return finalResults.slice(0, MAX_RESULTS);
}

/**
 * Pre-indexes history items outside of the search loop to avoid lag
 * when the user first starts typing.
 */
export function preIndexHistory(historyItems: HistoryItem[]): void {
  if (!historyItems || historyItems.length === 0) return;

  const recentHistoryItems = [...historyItems]
    .sort((a, b) => (b.lastVisitTime || 0) - (a.lastVisitTime || 0))
    .slice(0, HISTORY_RECENT_WINDOW);

  if (recentHistoryItems.length === 0) return;

  // Step 1: Preprocess history items (filters Google searches + deduplicates)
  const preprocessed = preprocessHistoryItems(recentHistoryItems);

  // Ensure all items have a domain for Fuse indexing
  preprocessed.forEach((item: HistoryItem) => {
    if (!item.domain) {
      item.domain = extractDomain(item.url);
    }
  });

  // Rebuild Fuse index
  fuseCache.history.instance = new Fuse(preprocessed, HISTORY_FUSE_OPTIONS as any);
  fuseCache.history.processedItems = preprocessed;
  fuseCache.history.dataRef = historyItems;
  fuseCache.history.dataLength = recentHistoryItems.length;
}

/**
 * Dedicated search for commands, automations, and agents.
 * This is used for the secondary popout panel.
 */
export function searchDedicatedPanel(
  query: string,
  _commands: CommandDefinition[],
  automations: SavedAutomation[],
  _agents: any[], // AgentCollectionSuggestionItem[]
  modules: InstalledModule[] = [],
): ContextualMatch[] {
  const trimmed = query.trim().toLowerCase().replace(/^\//, '');
  if (!trimmed) return [];

  const matches: (ContextualMatch & { score: number })[] = [];

  // Search Automations only (contextual popup excludes commands/agents)
  automations.forEach(auto => {
    if (!auto || !auto.name) return;
    const name = String(auto.name).toLowerCase();

    let score = -1;
    if (name === trimmed) score = 0;
    else if (name.startsWith(trimmed)) score = 1;
    else if (name.includes(trimmed)) score = 2;

    if (score !== -1) {
      matches.push({
        id: `auto-${auto.id}`,
        label: auto.name,
        type: 'automation',
        automation: auto,
        score,
      });
    }
  });

  // Search Installed Modules
  modules.forEach(module => {
    const rawName = module?.name || module?.module_key;
    if (!rawName) return;
    const name = String(rawName).toLowerCase();

    let score = -1;
    if (name === trimmed) score = 0;
    else if (name.startsWith(trimmed)) score = 1;
    else if (name.includes(trimmed)) score = 2;

    if (score !== -1) {
      matches.push({
        id: `module-${module.module_id}`,
        label: String(rawName),
        type: 'module',
        module,
        score,
      });
    }
  });

  // Sort by score and limit
  return matches
    .sort((a, b) => a.score - b.score)
    .slice(0, 10)
    .map(({ score, ...rest }) => rest);
}

// ============================================================================
// EXPORTS FOR BACKWARD COMPATIBILITY
// ============================================================================

export { HISTORY_PRIORITY_THRESHOLD, MAX_RESULTS, COMMON_RESULTS_COUNT, MAX_QUERY_LENGTH };
