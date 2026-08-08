import * as React from 'react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAppData } from '../hooks/useAppData';
import { useAppearance } from '@extension/ui';
import WallpaperLayer from '../../../../settings/uiPersonalization/WallpaperLayer';
import {
  FiZap,
  FiPlus,
  FiSearch,
  FiX,
  FiFilter,
  FiLayers,
  FiSettings,
  FiPlay,
  FiStar,
  FiCommand,
  FiCheckSquare,
  FiTerminal,
  FiFileText,
} from 'react-icons/fi';
import { BsCalendarCheck } from 'react-icons/bs';
import {
  FaCode,
  FaLink,
  FaCheckCircle,
  FaCheck,
  FaRegFileAlt,
  FaTerminal,
  FaBookmark,
  FaChevronDown,
  FaChevronUp,
  FaHistory,
  FaDownload,
  FaCog,
  FaPuzzlePiece,
  FaFlag,
  FaTag,
  FaInfoCircle,
  FaMemory,
  FaMicrochip,
  FaGamepad,
  FaKey,
  FaQuestionCircle,
  FaRobot,
  FaGithub,
  FaCamera,
  FaCopy,
  FaExpand,
  FaImages,
  FaTable
} from 'react-icons/fa';
import NotesIcon from '../components/NotesIcon';
import { getFaviconUrl } from '../../../../shared-components/searchBarMain/utilityFunctions/utils';
import {
  extractUrlsFromSnippet,
  type SnippetActionDetail,
} from '../../../../allObjectFolder/src/createObject/snippets/SnippetClickActions';
import { getUserId } from '../../../../storage/API/core/api';
import { buildUrl, SHARED_ALL_COMMANDS, THIS_SECTION_ACTION_PREFIXES } from '../../../../shared-components/commands';
import { extractSnippetIdFromCompoundId } from '../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import cmdOSLogo from '../../../../shared-components/assets/cmdOS_logo.png';
import { useUIStore } from '../../../../shared-components/uiStateManager';
import { executeItemDelete } from '../../../../shared-components/utils/itemDelete';



import { useDbStore } from '../../../../storage/store/useDbStore';
import { resolveEntityById } from '../../../../shared-components/utils/entityResolver';

import { BsKeyboard } from 'react-icons/bs';
import { LuSparkles } from 'react-icons/lu';
import { PAGE_ACTION_ITEMS, executePageActionCommand, type AltQPageActionItem } from '../commands/pageActions';
import { CustomSearchPrefixesForOmniboxStorage } from '../../../../storage/localStorage/customSearchPrefixesForOmniboxStorage';
import { createCommandIndex } from '../../../../shared-components/searchBarMain/searchLogicAndAlgorithms/commandSearch';
import BoardView from '../../../../shared-components/BoardView/BoardView';
import SpreadsheetMainContainer from '../../../../shared-components/spreadsheetUi/ui/spreadsheetMainContainer';
import { EditablePrefixKey } from '../../../../shared-components/shortcuts/ui/EditablePrefixKey';
import { SessionGridIcon } from '../../../../shared-components/icons/sessionGridIcon';
import { useSearchbarSuggestions } from '../../../../shared-components/searchBarMain/keyboardAndUiHooks/useSearchbarSuggestions';
import {
  buildShortcutPrefixRegistry,
  getCommandSpacePrefix,
  matchesShortcutCategory,
  parseShortcutInvocation,
  recordAssignedTriggerUsage,
} from '../../../../shared-components/triggers';

// Map command IDs to specific React Icons
const BROWSER_ICONS: Record<string, React.ReactNode> = {
  history: <FaHistory size={22} className="text-[var(--color-iconDefault)]" />,
  downloads: <FaDownload size={22} className="text-[var(--color-iconDefault)]" />,
  settings: <FaCog size={22} className="text-[var(--color-iconDefault)]" />,
  extensions: <FaPuzzlePiece size={22} className="text-[var(--color-iconDefault)]" />,
  bookmarks: <FaBookmark size={22} className="text-[var(--color-iconDefault)]" />,
  flags: <FaFlag size={22} className="text-[var(--color-iconDefault)]" />,
  inspect: <FaCode size={22} className="text-[var(--color-iconDefault)]" />,
  version: <FaTag size={22} className="text-[var(--color-iconDefault)]" />,
  about: <FaInfoCircle size={22} className="text-[var(--color-iconDefault)]" />,
  tasks: <FaMemory size={22} className="text-[var(--color-iconDefault)]" />,
  gpu: <FaMicrochip size={22} className="text-[var(--color-iconDefault)]" />,
  dino: <FaGamepad size={22} className="text-[var(--color-iconDefault)]" />,
  passwords: <FaKey size={22} className="text-[var(--color-iconDefault)]" />,
  help: <FaQuestionCircle size={22} className="text-[var(--color-iconDefault)]" />,
  ai: <FaRobot size={22} className="text-[var(--color-iconDefault)] object-contain" />,
};

// Icons for page-action commands (screenshot / download)
const PAGE_ACTION_ICONS: Record<string, React.ReactNode> = {
  capture_screenshot: <FaCamera size={14} className="text-[var(--color-iconDefault)]" />,
  capture_clip_screenshot: <FaCopy size={14} className="text-[var(--color-iconDefault)]" />,
  capture_full_screenshot: <FaExpand size={14} className="text-[var(--color-iconDefault)]" />,
  downloadallimages: <FaImages size={14} className="text-[var(--color-iconDefault)]" />,
  downloadalltables: <FaTable size={14} className="text-[var(--color-iconDefault)]" />,
};

// Alias map: alias (uppercase) to section name
const SECTION_ALIASES: Record<string, string> = {
  A: 'all',
  TS: 'thissite',
  T: 'todos',
  C: 'commands',
  L: 'links',
  N: 'notes',
  AU: 'automations',
  SE: 'sessions',
  S: 'sessions',
  SN: 'snippets',
  P: 'prompts',
  CA: 'chat_agents',
  SC: 'system_commands',
  BM: 'bookmarks',
};
// Reverse map: section name → alias display string
const SECTION_ALIAS_DISPLAY: Record<string, string> = Object.fromEntries(
  Object.entries(SECTION_ALIASES).map(([alias, section]) => [section, alias]),
);

const mapFullNameToShortcut = (text: string): string => {
  const mapping: Record<string, string> = {
    all: 'a',
    todos: 't',
    notes: 'n',
    automations: 'au',
    snippets: 'sn',
    prompts: 'p',
    links: 'l',
    commands: 'c',
    bookmarks: 'bm',
  };
  const lower = text.toLowerCase();
  for (const [fullName, shortcut] of Object.entries(mapping)) {
    if (lower === fullName || lower.startsWith(fullName + ' ')) {
      return shortcut + text.slice(fullName.length);
    }
  }
  return text;
};

// All valid filter shortcuts derived from SECTION_ALIASES
const FILTER_SHORTCUTS: string[] = Object.keys(SECTION_ALIASES).map(a => a.toLowerCase());

const FILTER_LABELS: Record<string, string> = {
  a: 'All',
  ts: 'This Site',
  s: 'Tab Sessions',
  t: 'Todos',
  c: 'Commands',
  sc: 'System Commands',
  l: 'Links',
  n: 'Notes',
  au: 'Automations',
  b: 'Bookmarks',
  bm: 'Bookmarks',
  sn: 'Text Expanders',
  p: 'Prompts',
};

function getActiveTagInfo(
  searchValue: string,
  commandPrefix = 'c',
  omniboxPrefixes?: Record<string, string>
): { prefix: string; label: string; query: string } | null {
  const categoryToLabel: Record<string, string> = {
    note: 'Notes',
    link: 'Links',
    bookmark: 'Bookmarks',
    todo: 'Todos',
    command: 'Commands',
    session: 'Tab Sessions',
    automation: 'Automations',
    agent: 'Chat Agents',
    snippet: 'Text Expanders',
    prompt: 'Prompts',
  };

  // 1. Check custom colon prefix
  const colonMatch = searchValue.match(/^([a-zA-Z0-9_-]+):\s/);
  if (colonMatch && colonMatch[0] && omniboxPrefixes) {
    const colonAlias = colonMatch[1].toLowerCase();
    let matchedCategory = '';
    for (const [key, val] of Object.entries(omniboxPrefixes)) {
      if (val && val.toLowerCase() === colonAlias) {
        matchedCategory = key;
        break;
      }
    }
    if (matchedCategory) {
      const prefix = colonMatch[0];
      const rest = searchValue.slice(prefix.length);
      const label = categoryToLabel[matchedCategory] || matchedCategory;
      return {
        prefix: prefix.trim(),
        label,
        query: rest,
      };
    }
  }

  // 2. Existing slash matching
  const hasLeadingSlash = searchValue.startsWith('/');
  const textToMatch = hasLeadingSlash ? searchValue.slice(1) : searchValue;
  const match = textToMatch.match(/^[a-zA-Z]+/);
  if (!match) return null;

  const prefix = match[0];
  const rest = textToMatch.slice(prefix.length);
  const lowerPrefix = prefix.toLowerCase();
  
  if (!hasLeadingSlash && lowerPrefix === commandPrefix.toLowerCase()) return null;
  if (lowerPrefix === 'a') return null;

  // Try custom slash matching first
  if (omniboxPrefixes) {
    let matchedCategory = '';
    for (const [key, val] of Object.entries(omniboxPrefixes)) {
      if (val && val.toLowerCase() === lowerPrefix) {
        matchedCategory = key;
        break;
      }
    }
    if (matchedCategory) {
      const isValid = hasLeadingSlash ? (rest === '' || rest.startsWith(' ')) : rest.startsWith(' ');
      if (isValid) {
        return {
          prefix: hasLeadingSlash ? `/${prefix}` : prefix,
          label: categoryToLabel[matchedCategory] || matchedCategory,
          query: rest.startsWith(' ') ? rest.slice(1) : '',
        };
      }
    }
  }

  // Allow 'ts' (This Site) as a fixed fallback since it has no custom prefix
  if (lowerPrefix === 'ts') {
    const isValid = hasLeadingSlash ? (rest === '' || rest.startsWith(' ')) : rest.startsWith(' ');
    if (isValid) {
      return {
        prefix: hasLeadingSlash ? `/${prefix}` : prefix,
        label: 'This Site',
        query: rest.startsWith(' ') ? rest.slice(1) : '',
      };
    }
  }
  return null;
}

function getSidebarSectionTagInfo(section: string): { prefix: string; label: string; query: string } | null {
  if (section === 'all') return null;
  const alias = SECTION_ALIAS_DISPLAY[section];
  if (!alias) return null;
  const label = SECTION_META[section]?.title || section;
  return {
    prefix: `/${alias.toLowerCase()}`,
    label,
    query: '',
  };
}

const normalizeUrl = (urlStr: unknown): string => {
  if (!urlStr || typeof urlStr !== 'string') return '';
  let target = urlStr.trim();
  if (!/^[a-zA-Z]+:\/\//.test(target)) {
    target = 'https://' + target;
  }
  try {
    const url = new URL(target);
    return `${url.origin}${url.pathname.replace(/\/$/, '')}${url.search}${url.hash}`;
  } catch {
    return urlStr;
  }
};

const getDomain = (urlStr: string) => {
  try {
    return new URL(urlStr).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/**
 * Parse the current search value to determine the mode state:
 *   - atDropdown: true when we show the category picker (no space yet)
 *   - activeSection: category activated by ALIAS+Space, or null
 *   - searchQuery: text typed after the space for within-category search
 */
function parseAtMode(
  searchValue: string,
  omniboxPrefixes?: Record<string, string>
): {
  atDropdown: boolean;
  activeSection: string | null;
  searchQuery: string;
} {
  const textAfterAt = searchValue;

  let bestAlias = '';
  let activeSection: string | null = null;

  const hasLeadingSlash = textAfterAt.startsWith('/');
  const textToMatch = hasLeadingSlash ? textAfterAt.slice(1) : textAfterAt;
  const upperText = textToMatch.toUpperCase();

  const categoryToLabel: Record<string, string> = {
    note: 'Notes',
    link: 'Links',
    bookmark: 'Bookmarks',
    todo: 'Todos',
    command: 'Commands',
    session: 'Tab Sessions',
    automation: 'Automations',
    agent: 'Chat Agents',
    snippet: 'Snippets',
    prompt: 'Prompts',
  };

  // 1. Check custom colon prefix first
  const colonMatch = searchValue.match(/^([a-zA-Z0-9_-]+):\s/);
  if (colonMatch && colonMatch[0] && omniboxPrefixes) {
    const colonAlias = colonMatch[1].toLowerCase();
    for (const [key, value] of Object.entries(omniboxPrefixes)) {
      if (value && value.toLowerCase() === colonAlias) {
        let query = searchValue.slice(colonMatch[0].length);
        return {
          atDropdown: false,
          activeSection: categoryToLabel[key] || key,
          searchQuery: query,
        };
      }
    }
  }

  // 1. Try matching custom prefix
  if (omniboxPrefixes) {
    for (const [key, value] of Object.entries(omniboxPrefixes)) {
      if (!value) continue;
      const upperAlias = value.toUpperCase();
      const matchWithSpace = upperText.startsWith(upperAlias + ' ');

      if (matchWithSpace) {
        if (value.length > bestAlias.length) {
          bestAlias = value;
          activeSection = categoryToLabel[key] || key;
        }
      }
    }
  }

  // Allow 'ts' (This Site) as a fixed fallback
  if (!activeSection) {
    if (upperText.startsWith('TS ')) {
      bestAlias = 'ts';
      activeSection = 'This Site';
    }
  }

  if (activeSection) {
    let query = textToMatch.slice(bestAlias.length);
    if (query.startsWith(' ')) {
      query = query.slice(1);
    }
    return { atDropdown: false, activeSection, searchQuery: query };
  }

  return {
    atDropdown: searchValue === '/',
    activeSection: null,
    searchQuery: textAfterAt,
  };
}

type WebsiteCommandSpaceCategory =
  | 'note'
  | 'link'
  | 'bookmark'
  | 'snippet'
  | 'session'
  | 'prompt'
  | 'automation'
  | 'agent'
  | 'todo'
  | 'system_command'
  | 'command';

type WebsiteCommandSpaceState = {
  isActive: boolean;
  commandPrefix: string;
  activeCategoryFilter: WebsiteCommandSpaceCategory | null;
  actualQuery: string;
  normalizedInput: string;
  exactThisSectionActionId: string | null;
};

const normalizeCommandSpaceText = (value: string): string =>
  value
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const isExtractionCommandItem = (item: any): boolean => item?.category === 'page_action';

/** Build a { actionId -> prefix } map from current omniboxPrefixes (falls back to empty string). */
const getActionPrefixMap = (omniboxPrefixes: any): Record<string, string> => {
  const map: Record<string, string> = {};
  map['capture_screenshot'] = omniboxPrefixes?.capture_screenshot || 'cs';
  map['capture_clip_screenshot'] = omniboxPrefixes?.capture_clip_screenshot || 'ccs';
  map['capture_full_screenshot'] = omniboxPrefixes?.capture_full_screenshot || 'cfp';
  map['downloadallimages'] = omniboxPrefixes?.downloadallimages || 'dai';
  map['downloadalltables'] = omniboxPrefixes?.downloadalltables || 'dat';
  map['save_link'] = omniboxPrefixes?.save_link || 'clc';
  map['save_session'] = omniboxPrefixes?.save_session || 'cls';
  map['save_chat'] = omniboxPrefixes?.save_chat || 'csc';
  map['add_to_existing'] = omniboxPrefixes?.add_to_existing || 'cae';
  map['add_to_existing_session'] = omniboxPrefixes?.add_to_existing_session || 'caes';
  map['summarize_page'] = omniboxPrefixes?.summarize_page || 'csp';
  return map;
};

function parseWebsiteCommandSpace(searchValue: string, omniboxPrefixes: any): WebsiteCommandSpaceState {
  const normalizedValue = searchValue.replace(/\u00A0/g, ' ');
  const commandPrefix = getCommandSpacePrefix(omniboxPrefixes);

  if (!normalizedValue.toLowerCase().startsWith(`${commandPrefix} `)) {
    return {
      isActive: false,
      commandPrefix,
      activeCategoryFilter: null,
      actualQuery: '',
      normalizedInput: normalizeCommandSpaceText(normalizedValue),
      exactThisSectionActionId: null,
    };
  }

  const queryAfterCommand = normalizedValue.slice(commandPrefix.length + 1);
  const queryAfterCommandLower = queryAfterCommand.toLowerCase();

  const allowedCategories = new Set<WebsiteCommandSpaceCategory>([
    'snippet',
    'note',
    'link',
    'bookmark',
    'session',
    'prompt',
    'automation',
    'agent',
    'todo',
    'system_command',
    'command',
  ]);
  const nestedPrefixes = Object.entries(buildShortcutPrefixRegistry(omniboxPrefixes))
    .filter(([, key]) => allowedCategories.has(key as WebsiteCommandSpaceCategory))
    .map(([prefix, key]) => ({ key: key as WebsiteCommandSpaceCategory, prefix }))
    .sort((a, b) => b.prefix.length - a.prefix.length);

  let activeCategoryFilter: WebsiteCommandSpaceCategory | null = null;
  let actualQuery = queryAfterCommand.trim();

  for (const { key, prefix } of nestedPrefixes) {
    if (queryAfterCommandLower === prefix || queryAfterCommandLower.startsWith(`${prefix} `)) {
      activeCategoryFilter = key;
      actualQuery = queryAfterCommand.slice(prefix.length).trim();
      break;
    }
  }

  let exactThisSectionActionId: string | null = null;
  if (!activeCategoryFilter) {
    const normalizedShortcut = normalizeCommandSpaceText(queryAfterCommand);
    const actionPrefixMap = getActionPrefixMap(omniboxPrefixes);
    const exactMatchEntry = Object.entries(actionPrefixMap).find(
      ([, shortcut]) => normalizeCommandSpaceText(shortcut) === normalizedShortcut,
    );
    exactThisSectionActionId = exactMatchEntry?.[0] || null;
  }

  return {
    isActive: true,
    commandPrefix,
    activeCategoryFilter,
    actualQuery,
    normalizedInput: normalizeCommandSpaceText(normalizedValue),
    exactThisSectionActionId,
  };
}

const SECTION_META: Record<string, { title: string; icon: React.ReactNode }> = {
  thissite: { title: 'This Site', icon: <FaRegFileAlt className="w-4 h-4 shrink-0" /> },
  todos: { title: 'Todos', icon: <BsCalendarCheck className="w-4 h-4 shrink-0" /> },
  automations: { title: 'Automations', icon: <FiZap className="w-4 h-4 shrink-0" /> },
  notes: { title: 'Notes', icon: <FiFileText className="w-4 h-4 shrink-0" /> },
  links: { title: 'Links', icon: <FaLink className="w-4 h-4 shrink-0" /> },
  sessions: { title: 'Tab Sessions', icon: <SessionGridIcon className="w-4 h-4 shrink-0" /> },
  snippets: { title: 'Text Expanders', icon: <FaCode className="w-4 h-4 shrink-0" /> },
  commands: { title: 'Commands', icon: <FiTerminal className="w-4 h-4 shrink-0" /> },
  system_commands: { title: 'System Commands', icon: <FiTerminal className="w-4 h-4 shrink-0" /> },
  chat_agents: { title: 'Chat Agents', icon: <FaRobot className="w-4 h-4 shrink-0" /> },
};

const DROPDOWN_SECTION_HEADER_CLASS = 'mx-2 px-1 py-0.5 flex items-center justify-between mt-1';
const DROPDOWN_SECTION_HEADER_TEXT_CLASS = 'text-[14px] font-medium text-[#A1A6B3] tracking-tight';
const DROPDOWN_ITEM_BASE_CLASS =
  'w-full appearance-none border-0 bg-transparent px-4 py-2 flex items-center justify-between cursor-pointer transition-colors mx-2 rounded-lg font-normal text-left group';
const DROPDOWN_ITEM_SELECTED_CLASS = 'bg-[#eee8d5]/50 dark:bg-white/10 text-[var(--color-textPrimary)]';
const DROPDOWN_ITEM_UNSELECTED_CLASS =
  'text-[#A1A6B3] hover:bg-[#eee8d5]/30 dark:hover:bg-white/5 hover:text-[var(--color-textPrimary)]';
const DROPDOWN_ITEM_LABEL_CLASS = 'text-[13px] font-normal truncate';
const DROPDOWN_ITEM_SHORTCUT_CLASS =
  'shrink-0 inline-flex items-center justify-center px-1.5 py-0 rounded border border-white/5 bg-white/5 text-[13px] font-light font-mono text-[var(--color-textPrimary)] lowercase opacity-70';

function DropdownSectionHeader({ title }: { title: string }) {
  return (
    <div className="flex flex-col w-full">
      <div className={DROPDOWN_SECTION_HEADER_CLASS}>
        <span className={DROPDOWN_SECTION_HEADER_TEXT_CLASS}>{title}</span>
      </div>
      <div className="h-[1px] bg-white/10 mx-6 mt-1 mb-2" />
    </div>
  );
}

const formatTodoDate = (deadlineStr?: string, isDone?: boolean) => {
  if (!deadlineStr) return { text: 'No due date', badge: 'Anytime', isToday: false };
  try {
    const date = new Date(deadlineStr.replace(' ', 'T'));
    if (isNaN(date.getTime())) return { text: deadlineStr, badge: 'Due', isToday: false };

    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const isTomorrow =
      date.getDate() === tomorrow.getDate() &&
      date.getMonth() === tomorrow.getMonth() &&
      date.getFullYear() === tomorrow.getFullYear();

    if (isDone) {
      return { text: `Completed · ${timeStr}`, badge: 'Done', isToday: false };
    }

    if (isToday) {
      return { text: `Due ${timeStr}`, badge: 'Today', isToday: true };
    } else if (isTomorrow) {
      return { text: `Due ${timeStr}`, badge: 'Tomorrow', isToday: false };
    } else {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayName = days[date.getDay()];
      return { text: `Due ${timeStr}`, badge: dayName, isToday: false };
    }
  } catch {
    return { text: 'No due date', badge: 'Anytime', isToday: false };
  }
};

const extractTodoMetadata = (item: any) => {
  let linkCount = 0;
  let autoCount = 0;
  let noteCount = 0;

  const urls = extractUrlsFromSnippet(item);
  if (urls && urls.length > 0) {
    linkCount = urls.length;
  }

  if (
    item.automation_id ||
    item.automation ||
    (item.automation_steps && item.automation_steps.length > 0) ||
    (item.steps && item.steps.length > 0)
  ) {
    autoCount = item.automation_steps?.length || item.steps?.length || 1;
  }

  if (
    item.category?.toLowerCase() === 'note' ||
    (typeof item.value === 'string' && item.value.length > 50 && !urls.length)
  ) {
    noteCount = 1;
  }

  return { linkCount, autoCount, noteCount };
};

// ── Multi-strategy fuzzy search ──────────────────────────────────────────────
/**
 * Returns a relevance score (0 = no match) for `query` against `text`.
 * Higher score = better match.
 *
 * Strategy (in priority order):
 *  1. Exact substring     → 100
 *  2. Word-prefix match   → 80  (any query word prefixes a text word)
 *  3. Acronym/initials    → 60  (query chars match word initials)
 *  4. Levenshtein fuzzy   → 40  (edit-distance ≤ 2 on individual words)
 */
function fuzzyScore(text: string, query: string): number {
  if (!text || !query) return 0;
  const t = text.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 0;

  // 1. Exact substring
  if (t.includes(q)) return 100;

  const words = t.split(/[\s\-_/.,;:]+/).filter(Boolean);
  const qWords = q.split(/\s+/).filter(Boolean);

  // 2. Every query word prefixes at least one text word
  const allPrefixMatch = qWords.every(qw => words.some(tw => tw.startsWith(qw)));
  if (allPrefixMatch) return 80;

  // 3. Acronym / initials match (single-token query)
  if (qWords.length === 1) {
    const initials = words.map(w => w[0] || '').join('');
    if (initials.includes(q)) return 60;
  }

  // 4. Levenshtein fuzzy: every query word must be close to some text word
  const levenshtein = (a: string, b: string): number => {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const dp: number[][] = [];
    for (let i = 0; i <= b.length; i++) dp[i] = [i];
    for (let j = 0; j <= a.length; j++) dp[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        dp[i][j] =
          b[i - 1] === a[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[b.length][a.length];
  };

  const maxDist = (qw: string) => (qw.length <= 3 ? 1 : 2);
  const allFuzzyMatch = qWords.every(qw =>
    words.some(tw => {
      // Anchor: first character must match — prevents "testg" from matching "best"
      // (they share e,s,t but start differently, giving a false distance-2 match)
      if (!tw || tw[0] !== qw[0]) return false;
      return levenshtein(qw, tw.slice(0, qw.length + maxDist(qw))) <= maxDist(qw);
    }),
  );
  if (allFuzzyMatch) return 40;

  return 0;
}

/**
 * Build a composite searchable string from an item, covering all relevant fields:
 * name/title/key/label, description, value, URLs (inside link collections),
 * tags, and rich-text body/content.
 */
function getItemSearchText(item: any): string {
  const parts: string[] = [];
  if (item._displayShortcut) parts.push(String(item._displayShortcut));
  // Primary identifiers
  if (item.name) parts.push(String(item.name));
  if (item.key) parts.push(String(item.key));
  if (item.title) parts.push(String(item.title));
  if (item.label) parts.push(String(item.label));
  // Secondary
  if (item.description) parts.push(String(item.description));
  if (typeof item.value === 'string') parts.push(item.value);
  // Body / rich-text content
  if (item.content) parts.push(String(item.content));
  if (item.body) parts.push(String(item.body));
  // Direct URL
  if (item.url) parts.push(String(item.url));
  // URL arrays inside link/session collections
  if (Array.isArray(item.urls)) {
    item.urls.forEach((u: any) => {
      if (typeof u === 'string') parts.push(u);
      else {
        if (u.url) parts.push(String(u.url));
        if (u.title) parts.push(String(u.title));
        if (u.name) parts.push(String(u.name));
      }
    });
  }
  // Tags
  if (Array.isArray(item.tags)) {
    item.tags.forEach((tag: any) => {
      if (typeof tag === 'string') parts.push(tag);
      else if (tag?.name) parts.push(String(tag.name));
    });
  }
  return parts.join(' ');
}
// ─────────────────────────────────────────────────────────────────────────────

interface AppProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
  initialCommand?: string;
}

const App: React.FC<AppProps> = ({ isOpen, onClose, theme, initialCommand }) => {
  const { theme: appearanceTheme } = useAppearance();
  const hasWallpaper = !!appearanceTheme?.wallpaper?.src;
  const containerBackground = appearanceTheme?.tokens?.containerBg || 'var(--color-containerBg)';
  const inputBackground = appearanceTheme?.tokens?.inputBg || 'var(--color-inputBg)';
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearchValue, setDebouncedSearchValue] = useState('');
  const [showSpreadsheet, setShowSpreadsheet] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchValue(searchValue);
    }, 100);
    return () => clearTimeout(handler);
  }, [searchValue]);

  // initialCommand effect moved to below handleExecute

  const [autoTriggerDropdown, setAutoTriggerDropdown] = useState(true);

  const updateSearchValue = (val: string) => {
    setSearchValue(val);
  };



  const shouldShowDefaultPopup = (val: string) => val.trim() === '';

  const showDropdownIfNotFiltered = (val: string) => {
    setIsDropdownVisible(shouldShowDefaultPopup(val));
  };

  // Load autoTriggerDropdown and view mode preference on mount
  useEffect(() => {
    chrome.storage.local.get(['rtq_focus_on', 'rtq_view_mode'], res => {
      if (res.rtq_focus_on !== undefined) {
        setAutoTriggerDropdown(res.rtq_focus_on);
      }
      if (res.rtq_view_mode !== undefined) {
      }
    });
  }, []);

  const [isDropdownVisible, setIsDropdownVisible] = useState(true);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  // Click outside listener for search dropdown container
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Autofill search bar when opened if auto-trigger is enabled
  useEffect(() => {
    if (isOpen) {
      setIsDropdownVisible(true);
      if (autoTriggerDropdown) {
        setSearchValue('');
        // Focus the input and position cursor at the end
        setTimeout(() => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
            const len = searchInputRef.current.value.length;
            searchInputRef.current.setSelectionRange(len, len);
          }
        }, 10);
      } else {
        setSearchValue('');
      }
    }
  }, [isOpen, autoTriggerDropdown]);

  const [showAllSections, setShowAllSections] = useState(false);
  const [dropdownSelectedIndex, setDropdownSelectedIndex] = useState(0);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [selectedSidebarSection, setSelectedSidebarSection] = useState<string>('all');
  const [showSidebarSectionPill, setShowSidebarSectionPill] = useState(false);
  const showDefaultPopup = () => {
    setSearchValue('');
    setSelectedSidebarSection('all');
    setShowSidebarSectionPill(false);
    setDropdownSelectedIndex(0);
    setIsDropdownVisible(true);
  };
  const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = useState(false);
  const settingsDropdownRef = useRef<HTMLDivElement | null>(null);
  const [recordingState, setRecordingState] = useState<any>(null);
  const [draftStepsCount, setDraftStepsCount] = useState<number>(0);

  // Click outside listener for settings dropdown
  useEffect(() => {
    if (!isSettingsDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsDropdownRef.current) {
        const path = event.composedPath();
        if (!path.includes(settingsDropdownRef.current)) {
          setIsSettingsDropdownOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsDropdownOpen]);
  const [allBookmarks, setAllBookmarks] = useState<any[]>([]);
  const [showAddExistingModal, setShowAddExistingModal] = useState(false);
  const [showAddExistingSessionModal, setShowAddExistingSessionModal] = useState(false);
  const [addExistingUrl, setAddExistingUrl] = useState('');
  const [addExistingTitle, setAddExistingTitle] = useState('');

  const [activeTabUrl, setActiveTabUrl] = useState('');
  const [activeTabTitle, setActiveTabTitle] = useState('');

  const [omniboxPrefixes, setOmniboxPrefixes] = useState<any>(null);



  useEffect(() => {
    const loadPrefixes = async () => {
      try {
        const p = await CustomSearchPrefixesForOmniboxStorage.getPrefixes();
        setOmniboxPrefixes(p);
      } catch (err) {
        console.error('Failed to load omnibox prefixes:', err);
      }
    };
    loadPrefixes();

    const handlePrefixChange = () => {
      loadPrefixes();
    };
    window.addEventListener('omniboxPrefixesChanged', handlePrefixChange);
    return () => {
      window.removeEventListener('omniboxPrefixesChanged', handlePrefixChange);
    };
  }, []);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userId, setUserId] = useState('local_user');
  useEffect(() => {
    getUserId()
      .then(uid => setUserId(uid))
      .catch(() => setUserId(''));
  }, []);

  const selectedTeam = useUIStore((s: any) => s.selectedTeam) as any;
  const allWorkspaces = useDbStore(state => state.workspaces);
  const dbSessions = useDbStore(state => state.sessions);
  const userShortcuts = useDbStore(state => state.userShortcuts);

  // Derive the workspace to save new links into.
  // Prefer the selected team's first workspace, otherwise fall back to the first Dexie workspace.
  const defaultWorkspaceId = useMemo(() => {
    const selectedWorkspaceId = selectedTeam?.workspaces?.[0]?.workspace_id;
    if (selectedWorkspaceId) return selectedWorkspaceId;
    return allWorkspaces[0]?.id || null;
  }, [allWorkspaces, selectedTeam]);

  const [optimisticSavedUrls, setOptimisticSavedUrls] = useState<string[]>([]);
  const { automations, notes, snippets, todos, links, toggleTodoOptimistic } = useAppData();
  const globalCommands = useDbStore(state => state.commands);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const boardViewRef = useRef<any>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const isBackspaceHandlingRef = useRef(false);
  const dropdownActionGuardRef = useRef<{ id: string; ts: number } | null>(null);

  // Fetch bookmarks from Chrome API when popup opens
  useEffect(() => {
    if (!isOpen) return;
    const chromeAny = (window as any)?.chrome;

    if (chromeAny?.bookmarks?.getTree) {
      chromeAny.bookmarks.getTree((tree: any) => {
        const list: any[] = [];
        const traverse = (nodes: any[]) => {
          nodes.forEach(node => {
            if (node.url) {
              list.push({
                id: `bookmark-${node.id}`,
                _kind: 'bookmark',
                type: 'bookmark',
                title: node.title || node.url,
                name: node.title || node.url,
                url: node.url,
                isBookmark: true,
              });
            }
            if (node.children) {
              traverse(node.children);
            }
          });
        };
        traverse(tree);
        setAllBookmarks(list);
      });
      return;
    }

    if (chromeAny?.runtime?.sendMessage) {
      chromeAny.runtime.sendMessage({ action: 'bookmarks_get_tree' }, (response: any) => {
        if (chromeAny.runtime.lastError || !response?.ok || !Array.isArray(response.results)) {
          return;
        }
        const list = response.results.map((n: any) => ({
          id: `bookmark-${n.id || n.url}`,
          _kind: 'bookmark',
          type: 'bookmark',
          title: (n.title || '').trim() || n.url,
          name: (n.title || '').trim() || n.url,
          url: n.url,
          isBookmark: true,
        }));
        setAllBookmarks(list);
      });
    }

    try {
      const topUrl =
        window.location?.href && !window.location.href.startsWith('chrome-extension://')
          ? window.location.href
          : (window.top as any)?.location?.href || '';
      const topTitle = document.title || (window.top as any)?.document?.title || 'Untitled Page';
      if (topUrl && !topUrl.startsWith('chrome-extension://')) {
        setActiveTabUrl(topUrl);
        setActiveTabTitle(topTitle);
      } else {
        throw new Error('Fallback');
      }
    } catch (_) {
      const chromeAny = (window as any)?.chrome;
      if (chromeAny?.runtime?.sendMessage) {
        chromeAny.runtime.sendMessage(
          { action: 'tabs_query', queryOptions: { active: true, lastFocusedWindow: true } },
          (response: any) => {
            const activeTab = response?.results?.[0];
            if (activeTab && activeTab.url && !activeTab.url.startsWith('chrome-extension://')) {
              setActiveTabUrl(activeTab.url);
              setActiveTabTitle(activeTab.title || 'Untitled Page');
            }
          },
        );
      }
    }
  }, [isOpen]);

  const syncDbFromBackground = () => {
    console.log('[WebsitePopup] syncDbFromBackground: Sending db_get_all_records message...');
    chrome.runtime.sendMessage({ action: 'db_get_all_records' }, res => {
      console.log('[WebsitePopup] syncDbFromBackground: Received response:', res);
      if (res && res.success) {
        const hkMap: Record<string, string> = {};
        (res.userHotkeys || []).forEach((hk: any) => {
          hkMap[hk.referenceId] = hk.combination;
        });
        const scMap: Record<string, string> = {};
        (res.userShortcuts || []).forEach((sc: any) => {
          scMap[sc.referenceId] = sc.trigger;
        });

        useDbStore.setState({
          workspaces: res.workspaces || [],
          links: res.links || [],
          notes: res.notes || [],
          tags: res.tags || [],
          snippets: res.snippets || [],
          todos: res.todos || [],
          folders: res.folders || [],
          automations: res.automations || [],
          chatAgents: res.chatAgents || [],
          aiPrompts: res.aiPrompts || [],
          favorites: res.favorites || [],
          userHotkeys: res.userHotkeys || [],
          userShortcuts: res.userShortcuts || [],
          hotkeysMap: hkMap,
          shortcutsMap: scMap,
          sessions: res.sessions || [],
          commands: res.commands || [],
          isInitialized: true,
        });
      }
    });
  };

  useEffect(() => {
    if (isOpen) {
      syncDbFromBackground();

      const dbChangedListener = (message: any) => {
        if (message && message.action === 'db_changed') {
          syncDbFromBackground();
        }
      };

      chrome.runtime.onMessage.addListener(dbChangedListener);
      return () => {
        chrome.runtime.onMessage.removeListener(dbChangedListener);
      };
    }
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    chrome.storage.local.get(['accessToken'], res => {
      setIsLoggedIn(!!res.accessToken);
    });
    const listener = (changes: any, areaName: string) => {
      if (areaName === 'local') {
        if (changes.accessToken) {
          setIsLoggedIn(!!changes.accessToken.newValue);
        }
      }
    };
    const chromeAny = (window as any)?.chrome;
    chromeAny?.storage?.onChanged?.addListener(listener);
    return () => {
      chromeAny?.storage?.onChanged?.removeListener(listener);
    };
  }, []);

  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.get(['automation_recording_state', 'automation_draft_steps_count'], (res: any) => {
        setRecordingState(res.automation_recording_state || null);
        setDraftStepsCount(res.automation_draft_steps_count || 0);
      });
      const handleChange = (changes: any, area: string) => {
        if (area === 'local') {
          if (changes.automation_recording_state) {
            setRecordingState(changes.automation_recording_state.newValue || null);
          }
          if (changes.automation_draft_steps_count) {
            setDraftStepsCount(changes.automation_draft_steps_count.newValue || 0);
          }
        }
      };
      chromeAny.storage.onChanged.addListener(handleChange);
      return () => chromeAny.storage.onChanged.removeListener(handleChange);
    }
    return undefined;
  }, []);

  const safeList = (list: any) => (Array.isArray(list) ? list : []);
  const commandSpace = useMemo(
    () => parseWebsiteCommandSpace(searchValue, omniboxPrefixes),
    [searchValue, omniboxPrefixes],
  );
  const debouncedCommandSpace = useMemo(
    () => parseWebsiteCommandSpace(debouncedSearchValue, omniboxPrefixes),
    [debouncedSearchValue, omniboxPrefixes],
  );
  const autoTriggeredThisSectionInputRef = useRef<string | null>(null);

  const allCommands = useMemo(() => {
    const map = new Map();
    SHARED_ALL_COMMANDS.forEach(c => map.set(c.id, { ...c, isGlobal: false, name: c.label }));
    globalCommands.forEach(c => map.set(c.id, { ...c, isGlobal: true, name: c.label }));
    // Page-action commands (screenshot, download) — always available, run in current page context
    PAGE_ACTION_ITEMS.forEach(c => map.set(c.id, c));

    return Array.from(map.values());
  }, [globalCommands]);

  const commandIndex = useMemo(() => createCommandIndex(allCommands), [allCommands]);

  const suggestionState = useSearchbarSuggestions({
    value: debouncedSearchValue,
    lockedCommand: null,
    lockedLocalDef: null,
    selectedTeam: null,
    searchTeamLike: null,
    dbWorkspaces: [],
    selectedFolder: null,
    isInitialAltSFocus: false,
    isFocused: true,
    isSearchFocusEnabled: true,
    selectedImages: [],
    commands: allCommands,
    commandIndex: commandIndex,
    bookmarkSuggestions: [],
    commonCommandEntries: [],
    automationSuggestions: automations || [],
    agentCollectionSuggestions: [],
    moduleSuggestions: [],
    selectedAtCommand: null,
    activeSnippetCommandId: null,
    isSnippetCommand: false,
    activeCollection: null,
    showAIHistoryPanel: false,
    commandKey: getCommandSpacePrefix(omniboxPrefixes),
    workspaceItemIndex: [],
    userDbShortcuts: userShortcuts || [],
    userDbHotkeys: [],
    customPrefixes: omniboxPrefixes || {},
    isEmbedded: true,
    contextUrl: activeTabUrl,
  });

  const filteredThisSite = useMemo(() => {
    const { atDropdown, activeSection, searchQuery } = debouncedCommandSpace.isActive
      ? { atDropdown: false, activeSection: null, searchQuery: debouncedSearchValue }
      : parseAtMode(debouncedSearchValue, omniboxPrefixes);

    const effectiveSearchValue = atDropdown ? '' : activeSection !== null ? searchQuery : debouncedSearchValue;

    const fuzzyFilter = (list: any[], queryOverride?: string) => {
      const query = (queryOverride ?? effectiveSearchValue).trim();
      if (!query) return list;
      return list
        .map(item => ({ item, score: fuzzyScore(getItemSearchText(item), query) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .map(({ item }) => item);
    };

    const activeDomain = getDomain(activeTabUrl);
    const activeNormalized = normalizeUrl(activeTabUrl);

    // Detect AI chat sites
    const isChatSite =
      activeDomain &&
      ['chatgpt.com', 'claude.ai', 'gemini.google.com', 'chat.openai.com', 'perplexity.ai'].some(domain =>
        activeDomain.includes(domain),
      );

    const thisSiteItems: any[] = [];
    if (activeNormalized && activeDomain && !activeTabUrl.startsWith('chrome-extension://')) {
      if (isChatSite) {
        thisSiteItems.push({
          id: 'save_chat',
          name: 'Chat agent',
          category: 'thissite_action',
          icon: <FaLink className="w-4 h-4 shrink-0 text-gray-400" />,
        });
      }
      thisSiteItems.push({
        id: 'save_link',
        name: 'Link collection',
        category: 'thissite_action',
        icon: <FaLink className="w-4 h-4 shrink-0 text-gray-400" />,
      });
      thisSiteItems.push({
        id: 'save_session',
        name: 'Tab Session',
        category: 'thissite_action',
        icon: <SessionGridIcon className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" />,
      });
      thisSiteItems.push({
        id: 'add_to_existing',
        name: 'Existing link collection',
        category: 'thissite_action',
        icon: <FiPlus className="w-4 h-4 shrink-0 text-gray-400" />,
      });
      thisSiteItems.push({
        id: 'add_to_existing_session',
        name: 'Existing Session',
        category: 'thissite_action',
        icon: <SessionGridIcon className="w-4 h-4 shrink-0 text-gray-400" />,
      });
      PAGE_ACTION_ITEMS.forEach((item: any) => {
        thisSiteItems.push({
          id: item.id,
          name: item.name,
          category: 'page_action',
          item: item,
          icon: PAGE_ACTION_ICONS[item.id] || <FaRegFileAlt className="w-4 h-4 shrink-0 text-gray-400" />,
        });
      });
      thisSiteItems.push({
        id: 'summarize_page',
        name: 'Summarize This Page',
        category: 'thissite_action',
        icon: <FaInfoCircle className="w-4 h-4 shrink-0 text-gray-400" />,
      });
    }

    const actionPrefixMap = getActionPrefixMap(omniboxPrefixes);
    const visibleThisSiteItems = thisSiteItems.map(item => {
      const actionPrefix = actionPrefixMap[item.id];
      if (!actionPrefix) return item;
      return {
        ...item,
        _displayShortcut: `${debouncedCommandSpace.commandPrefix} ${actionPrefix.toLowerCase()}`,
      };
    });

    if (debouncedCommandSpace.isActive) {
      const commandQuery = debouncedCommandSpace.actualQuery;
      if (debouncedCommandSpace.activeCategoryFilter === 'command' || !debouncedCommandSpace.activeCategoryFilter) {
        if (!commandQuery.trim()) return visibleThisSiteItems;
        const lower = commandQuery.toLowerCase();
        return visibleThisSiteItems.filter(
          item =>
            item.name.toLowerCase().includes(lower) ||
            (THIS_SECTION_ACTION_PREFIXES[item.id]?.toLowerCase().startsWith(lower) ?? false) ||
            (actionPrefixMap[item.id]?.toLowerCase().startsWith(lower) ?? false),
        );
      }
      return [];
    }

    if (activeSection && activeSection === 'thissite') {
      return effectiveSearchValue.trim() ? fuzzyFilter(visibleThisSiteItems, searchQuery) : visibleThisSiteItems;
    }

    return effectiveSearchValue.trim() ? fuzzyFilter(visibleThisSiteItems) : visibleThisSiteItems;
  }, [
    debouncedSearchValue,
    activeTabUrl,
    debouncedCommandSpace,
    omniboxPrefixes,
  ]);



  const dropdownOptions = useMemo(() => {
    const cleanSearch = debouncedCommandSpace.isActive
      ? debouncedCommandSpace.actualQuery.trim()
      : debouncedSearchValue.startsWith('/')
        ? debouncedSearchValue.slice(1)
        : debouncedSearchValue;
    const filterText = cleanSearch.toLowerCase();

    const baseSiteItems = filteredThisSite || [];

    const actionPrefixMap = getActionPrefixMap(omniboxPrefixes);

    const matchedSiteItems = baseSiteItems.filter((item: any) => {
      if (!filterText) return true;
      const nameMatch = item.name.toLowerCase().includes(filterText);
      const shortPrefix = actionPrefixMap[item.id]?.toLowerCase() || '';
      const prefixMatch = shortPrefix && shortPrefix.startsWith(filterText);
      return nameMatch || prefixMatch;
    });

    const siteCommandActions = matchedSiteItems
      .filter((item: any) => !isExtractionCommandItem(item))
      .map((item: any) => ({
        type: 'site-action',
        id: item.id,
        name: item.name,
        item,
      }));

    const extractionActions = matchedSiteItems
      .filter((item: any) => isExtractionCommandItem(item))
      .map((item: any) => ({
        type: 'extraction-action',
        id: item.id,
        name: item.name,
        item: item.item || item,
        wrappedItem: item,
      }));

    const categoryNames = [
      'all',
      'todos',
      'commands',
      'links',
      'notes',
      'automations',
      'bookmarks',
      'snippets',
      'sessions',
      'chat_agents',
    ];
    const categories = debouncedCommandSpace.isActive
      ? []
      : categoryNames
        .filter(name => {
          if (!filterText) return true;
          return name.toLowerCase().startsWith(filterText);
        })
        .map(name => ({
          type: 'category',
          id: name,
          name: name,
        }));

    const thisSiteActions = [...siteCommandActions, ...extractionActions];

    return {
      thisSiteActions,
      siteCommandActions,
      extractionActions,
      categories,
      totalList: [...thisSiteActions, ...categories],
    };
  }, [debouncedSearchValue, filteredThisSite, debouncedCommandSpace, omniboxPrefixes]);

  // Reset dropdown selected index when search value changes so that it always starts at the first item (Categories)
  useEffect(() => {
    setDropdownSelectedIndex(0);
  }, [searchValue]);

  // Auto-scroll selected dropdown item into view when keyboard navigating
  useEffect(() => {
    if (dropdownSelectedIndex < 0) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`alts-dropdown-item-${dropdownSelectedIndex}`);
      if (el) {
        el.scrollIntoView({
          behavior: 'auto',
          block: 'nearest',
        });
      }
    }, 40);
    return () => clearTimeout(timer);
  }, [dropdownSelectedIndex]);

  const handleCreateNew = (type: string) => {
    const typeMap: Record<string, string> = {
      link: 'createlinks',
      note: 'createnotes',
      snippet: 'createsnippet',

      todo: 'createtodo',
    };
    const mappedType = typeMap[type.toLowerCase()];
    if (!mappedType) return;
    onClose();
  };

  const handleStartSession = useCallback(
    async (item: any, e?: React.MouseEvent) => {
      e?.stopPropagation();
      const sessionId = item.snippet_id || item.id;
      const sessionName = item.key || item.name || item.title || 'Untitled Tab Session';
      const workspaceId = item.workspace_id || defaultWorkspaceId;
      const folderId = item.folder_id || null;

      let initialUrls: string[] = [];
      let initialNames: string[] = [];
      let openSettings = item.sessionOpenSettings;

      try {
        const resolved = await resolveEntityById(sessionId);
        const sessionRecord = resolved?.entity as any;
        if (sessionRecord) {
          openSettings = sessionRecord.sessionOpenSettings || openSettings;
          if (Array.isArray(sessionRecord.urls)) {
            initialUrls = sessionRecord.urls.map((u: any) => u.url);
            initialNames = sessionRecord.urls.map((u: any) => u.title || u.name || '');
          }
        }
      } catch (err) { }

      if (initialUrls.length === 0) {
        try {
          const parsed = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
          if (Array.isArray(parsed)) {
            initialUrls = parsed.map((l: any) => l.url || l);
            initialNames = parsed.map((l: any) => l.name || '');
          } else if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed.urls)) initialUrls = parsed.urls;
            if (Array.isArray(parsed.names)) initialNames = parsed.names;
          }
        } catch (err) { }
      }

      if (initialUrls.length === 0) {
        initialUrls = extractUrlsFromSnippet(item);
      }

      chrome.runtime.sendMessage(
        {
          action: 'start_session',
          sessionId,
          sessionName,
          workspaceId,
          folderId: folderId || null,
          teamId: selectedTeam?.team_id,
          storageMode: selectedTeam?.storageMode ?? 'local',
          initialUrls,
          initialNames,
          openSettings,
        },
        response => {
          const count = initialUrls.length;
          useUIStore.getState().queueNotification({
            message: `🚀 Tab Session "${sessionName}" started with ${count} tab${count !== 1 ? 's' : ''}`,
            type: 'success',
          });
        },
      );

      onClose();
    },
    [defaultWorkspaceId, selectedTeam, onClose],
  );

  const handleExecute = (item: any, e?: React.MouseEvent | KeyboardEvent) => {
    console.log('[handleExecute] Raw item received:', item);

    e?.preventDefault();
    const isCtrl = e && 'ctrlKey' in e && (e.ctrlKey || e.metaKey);

    // ── Page-action commands (screenshot / download) ──────────────────────
    // These run directly on the current page via chrome.runtime.sendMessage.
    // They cannot be routed through AltS_search_newtab/index.html.
    if (item.category === 'page_action') {
      e?.stopPropagation();
      const actualItem = item.item || item;
      executePageActionCommand(actualItem as AltQPageActionItem, onClose);
      return true;
    }

    if (item.category === 'thissite_indicator') {
      e?.stopPropagation();
      return true;
    }

    if (item.category === 'thissite_action') {
      e?.stopPropagation();
      if (item.id === 'recording-action') {
        onClose();
        const chromeAny = (window as any).chrome;
        if (chromeAny?.runtime && chromeAny?.storage?.local) {
          chromeAny.runtime.sendMessage({ type: 'GET_TAB_ID' }, (tabId: any) => {
            chromeAny.storage.local.get(['automation_recording_state'], (res: any) => {
              const currentState = res.automation_recording_state;
              if (currentState) {
                chromeAny.storage.local.set({
                  automation_recording_state: {
                    ...currentState,
                    select_mode: true,
                    targetTabId: tabId,
                    timestamp: Date.now(),
                  },
                });
              }
            });
          });
        }
        return true;
      }

      let tabUrl = activeTabUrl;
      let tabTitle = activeTabTitle;

      if (!tabUrl || tabUrl.startsWith('chrome-extension://')) {
        try {
          const pageUrl = window.location.href;
          if (pageUrl && !pageUrl.startsWith('chrome-extension://')) {
            tabUrl = pageUrl;
            tabTitle = document.title || 'Untitled Page';
          }
        } catch (_) { }
      }

      const getFallbackWorkspaceId = (): string | null => defaultWorkspaceId || allWorkspaces[0]?.id || null;

      const proceed = async (url: string, title: string) => {
        if (item.url) {
          chrome.runtime.sendMessage({ action: 'open_tab', url: item.url, active: !isCtrl }, () => {
            if (chrome.runtime.lastError && !isCtrl) {
              window.open(item.url, '_blank');
            }
          });
          onClose();
          return;
        }

        if (item.id === 'save_link') {
          const targetUrl = chrome.runtime.getURL(
            `AltS_search_newtab/index.html?create_link=true&active_tab_url=${encodeURIComponent(url)}&active_tab_title=${encodeURIComponent(title)}`,
          );
          try {
            chrome.runtime.sendMessage({ action: 'open_tab', url: targetUrl, active: true });
          } catch {
            window.open(targetUrl, '_blank');
          }
          onClose();
          return;
        }

        if (item.id === 'save_session') {
          const targetUrl = chrome.runtime.getURL('newtab.html?omnibox=true&type=command&id=createsession');
          try {
            chrome.runtime.sendMessage({ action: 'open_tab', url: targetUrl, active: true });
          } catch {
            window.open(targetUrl, '_blank');
          }
          onClose();
          return;
        }

        if (item.id === 'save_chat') {
          try {
            setOptimisticSavedUrls(prev => [...prev, url]);
            const wsId = getFallbackWorkspaceId();
            const response: any = await new Promise(resolve => {
              chrome.runtime.sendMessage(
                {
                  action: 'db_create_chat_agent',
                  input: {
                    workspaceId: wsId || undefined,
                    title,
                    urls: [url],
                    tagIds: [],
                  },
                },
                resolve,
              );
            });
            if (response && response.success && response.agent) {
              const targetUrl = chrome.runtime.getURL(
                `AltS_search_newtab/index.html?edit_agent=${encodeURIComponent(response.agent.id)}`,
              );
              try {
                chrome.runtime.sendMessage({ action: 'open_tab', url: targetUrl, active: true });
              } catch {
                window.open(targetUrl, '_blank');
              }
            } else {
              throw new Error(response?.error || 'Failed to create chat agent via background');
            }
          } catch (err) {
            console.warn('[AltQ-Trigger] createChatAgent failed:', err);
          }
          onClose();
          return;
        } else if (item.id === 'add_to_existing') {
          const finalUrl =
            url ||
            activeTabUrl ||
            (window.location.href.startsWith('chrome-extension://') ? '' : window.location.href);
          const finalTitle = title || activeTabTitle || document.title || 'Untitled Page';
          setAddExistingUrl(finalUrl);
          setAddExistingTitle(finalTitle);
          setShowAddExistingModal(true);
        } else if (item.id === 'add_to_existing_session') {
          const finalUrl =
            url ||
            activeTabUrl ||
            (window.location.href.startsWith('chrome-extension://') ? '' : window.location.href);
          const finalTitle = title || activeTabTitle || document.title || 'Untitled Page';
          setAddExistingUrl(finalUrl);
          setAddExistingTitle(finalTitle);
          setShowAddExistingSessionModal(true);
        } else if (item.id === 'summarize_page') {
          // Perform full context scraping and AI dispatching
          const defaultPrompt = 'Summarize the main points, key takeaways, and outline of this page.';

          const directDomText = document.body
            ? (document.body.innerText || document.body.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 12000)
            : '';

          const enhancedPrompt = directDomText
            ? `User Question: ${defaultPrompt}

I'm looking at a webpage titled "${title}" (${url}).

Here is the page content for context:
---
${directDomText}
---`
            : `Summarize this page for me: ${url}`;

          chrome.storage.local.get('selectedAIs', (result: any) => {
            const raw = result?.selectedAIs;
            const userSelectedIds = Array.isArray(raw) ? raw.filter((x: any) => typeof x === 'string') : [];
            const finalIds = userSelectedIds.length > 0 ? userSelectedIds : ['gpt'];

            const aiFallbacks: Record<string, { url: string; kind: 'chatgpt' | 'claude' | 'gemini' | 'perplexity' }> = {
              gpt: { url: 'https://chatgpt.com/', kind: 'chatgpt' },
              claude: { url: 'https://claude.ai/new', kind: 'claude' },
              gemini: { url: 'https://gemini.google.com/app', kind: 'gemini' },
              perplexity: { url: 'https://www.perplexity.ai/', kind: 'perplexity' },
            };

            const getBaseAIUrl = (kind?: string): string => {
              if (kind === 'chatgpt') return 'https://chatgpt.com/';
              if (kind === 'claude') return 'https://claude.ai/new';
              if (kind === 'gemini') return 'https://gemini.google.com/app';
              if (kind === 'perplexity') return 'https://www.perplexity.ai/';
              return '';
            };

            const links = finalIds
              .map((id: string) => {
                const fallback = aiFallbacks[id];
                if (fallback) {
                  return {
                    id,
                    label: id,
                    urlTemplate: fallback.url,
                    autoSubmit: fallback.kind,
                  };
                }

                const cmd = globalCommands.find(c => c.id === id);
                if (cmd) return cmd;

                return null;
              })
              .filter((cmd: any): cmd is any => Boolean(cmd))
              .map((cmd: any) => {
                const targetUrl = cmd.autoSubmit
                  ? getBaseAIUrl(cmd.autoSubmit) || cmd.urlTemplate.replace('{query}', '')
                  : cmd.urlTemplate.replace('{query}', encodeURIComponent(enhancedPrompt));

                if (cmd.autoSubmit) {
                  return {
                    url: targetUrl,
                    autoSubmit: {
                      kind: cmd.autoSubmit,
                      prompt: enhancedPrompt,
                    },
                  };
                }
                return { url: targetUrl };
              });

            if (links.length > 0) {
              const hasAutoSubmit = links.some((l: any) => Boolean(l.autoSubmit));
              const delay = hasAutoSubmit ? 1200 : 200;

              chrome.runtime.sendMessage({
                action: 'open_multiple_links',
                links,
                delay,
              });
            } else {
              chrome.runtime.sendMessage({
                action: 'open_tab_with_auto_submit',
                url: 'https://chatgpt.com/',
                autoSubmit: {
                  kind: 'chatgpt',
                  prompt: enhancedPrompt,
                },
                active: true,
              });
            }
          });

          onClose();
        }
      };

      if (tabUrl) {
        proceed(tabUrl, tabTitle);
      } else {
        chrome.runtime.sendMessage(
          { action: 'tabs_query', queryOptions: { active: true, currentWindow: true } },
          response => {
            const activeTab = response?.results?.[0];
            proceed(activeTab?.url || '', activeTab?.title || 'Untitled Page');
          },
        );
      }
      return true;
    }

    if (item.isNew) {
      handleCreateNew(item.section);
      return true;
    }

    // Delegate all standard items (todos, commands, notes, links, sessions, ai, etc.)
    // to BoardView.tsx to avoid duplication and maintain a single source of truth.
    return false;
  };

  const executeDropdownItem = useCallback(
    (item: any) => {
      const itemId = String(item?.id || item?.snippet_id || item?.todo_id || '');
      const now = Date.now();
      const last = dropdownActionGuardRef.current;
      if (last && last.id === itemId && now - last.ts < 400) {
        return;
      }

      dropdownActionGuardRef.current = { id: itemId, ts: now };
      const parsedShortcut = parseShortcutInvocation(searchValue, omniboxPrefixes);
      const matchedShortcut = parsedShortcut.trigger
        ? (userShortcuts || []).find(
            (shortcut: any) =>
              String(shortcut.trigger || '').toLowerCase() === parsedShortcut.trigger &&
              matchesShortcutCategory(String(shortcut.referenceType || ''), parsedShortcut.categoryFilter),
          )
        : null;
      if (matchedShortcut && String(matchedShortcut.referenceId || '') === itemId) {
        recordAssignedTriggerUsage({
          triggerKind: 'user_shortcut',
          triggerValue: matchedShortcut.trigger,
          triggerSource: parsedShortcut.triggerSource === 'command_space' ? 'command_space' : 'website_popup',
          referenceId: matchedShortcut.referenceId,
          referenceType: matchedShortcut.referenceType,
          surface: 'website_popup',
          url: activeTabUrl,
          targetLabelSnapshot: item?.name || item?.title || item?.key || itemId,
          triggerLabelSnapshot: matchedShortcut.trigger,
        }).catch(err => console.warn('[AltS-Website] Failed to record shortcut usage:', err));
      }
      handleExecute(item);
      setSearchValue('');
      setDropdownSelectedIndex(-1);
      setIsDropdownVisible(false);

      window.setTimeout(() => {
        if (dropdownActionGuardRef.current?.id === itemId) {
          dropdownActionGuardRef.current = null;
        }
      }, 0);
    },
    [activeTabUrl, handleExecute, omniboxPrefixes, searchValue, userShortcuts],
  );

  const handleWebsiteDeleteRequest = useCallback(
    async (detail: SnippetActionDetail) => {
      const result = await executeItemDelete(detail, 'AltS-Website');
      if (result.status !== 'skipped') {
        syncDbFromBackground();
      }
    },
    [syncDbFromBackground],
  );

  const handleContextMenu = useCallback((e: React.MouseEvent, item: any, title: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (boardViewRef.current) {
      boardViewRef.current.openContextMenu(e.clientX, e.clientY, item);
    }
  }, []);

  const handleToggleFavorite = useCallback(
    async (item: any) => {
      if (!userId) {
        return;
      }

      try {
        const actualItem = item?.item || item?.snippet || item?.session || item?.data || item;
        const category = String(
          actualItem?.category || item?.category || item?._kind || item?.type || '',
        ).toLowerCase();
        console.log('[AltS-Website][BoardView][Favorite] handleToggleFavorite start', {
          item,
          actualItem,
          derivedCategory: category,
          userId,
        });
        const isCommand =
          item?.source === 'last_used' ||
          item?.id === 'ai' ||
          item?.type === 'command' ||
          item?._kind === 'command' ||
          item?.category === 'command';

        let itemType = 'snippet';
        let itemId = '';

        if (isCommand) {
          itemType = 'command';
          itemId = item?.id || actualItem?.id || '';
        } else if (category === 'link') {
          itemType = 'link';
          itemId = actualItem?.snippet_id || actualItem?.id || actualItem?.todo_id || '';
        } else if (category === 'note') {
          itemType = 'note';
          itemId = actualItem?.snippet_id || actualItem?.id || actualItem?.todo_id || '';
        } else if (category === 'session' || category === 'sessions' || category === 'tabgroup') {
          itemType = 'session';
          itemId = actualItem?.id || actualItem?.session_id || item?.session?.id || '';
        } else if (category === 'snippet') {
          itemType = 'snippet';
          itemId = actualItem?.snippet_id || actualItem?.id || actualItem?.todo_id || '';
        } else if (category === 'chat_agent' || category === 'agent') {
          itemType = 'chat_agent';
          itemId = actualItem?.id || '';
        } else if (category === 'aiprompt' || category === 'prompt') {
          itemType = 'aiPrompt';
          itemId = actualItem?.id || '';
        } else if (category === 'automation') {
          itemType = 'automation';
          itemId = actualItem?.id || '';
        } else {
          itemType = 'note';
          itemId = actualItem?.snippet_id || actualItem?.id || actualItem?.todo_id || '';
        }

        console.log('[AltS-Website][BoardView][Favorite] resolved target', {
          itemType,
          itemIdBeforeNormalize: itemId,
          actualItem,
        });

        itemId = extractSnippetIdFromCompoundId(itemId);
        if (!itemId) {
          console.warn('[AltS-Website][BoardView][Favorite] aborting because itemId is empty after normalization', {
            item,
            actualItem,
            category,
            itemType,
          });
          return;
        }

        const label =
          item?.label ||
          item?.snippet?.key ||
          item?.snippet?.title ||
          item?.snippet?.name ||
          item?.key ||
          item?.title ||
          item?.name ||
          actualItem?.title ||
          actualItem?.name ||
          '';

        chrome.runtime.sendMessage(
          {
            action: 'db_toggle_favorite',
            userId: userId || 'local_user',
            referenceId: itemId,
            referenceType: itemType,
            label,
          },
          res => {
            console.log('[AltS-Website][BoardView][Favorite] db_toggle_favorite response', {
              itemType,
              itemId,
              label,
              response: res,
              runtimeError: chrome.runtime?.lastError?.message || null,
            });
            if (res && res.success) {
              syncDbFromBackground();
              useUIStore.getState().queueNotification({
                message: res.isFavorited ? 'Added to favorites' : 'Removed from favorites',
                type: 'success',
              });
            } else {
              useUIStore.getState().queueNotification({
                message: 'Failed to update favorites',
                type: 'error',
              });
            }
          },
        );
      } catch (error) {
        console.error('[AltQ] Failed to update favorites:', error);
        useUIStore.getState().queueNotification({ message: 'Failed to update favorites', type: 'error' });
      }
    },
    [userId],
  );

  const handleToggleTodo = async (e: React.MouseEvent, item: any) => {
    e.stopPropagation();
    const sid = String(item.id || item.snippet_id || item.todo_id);
    const newStatus = !item.is_done;
    toggleTodoOptimistic(sid, newStatus);
    try {
      const chromeAny = (window as any).chrome;
      if (chromeAny?.storage?.local) {
        const storage = await new Promise<any>(resolve =>
          chromeAny.storage.local.get(['local_todos', 'cached_todos'], resolve),
        );
        const updateTodoList = (list: any[] = []) =>
          list.map(todo => {
            const todoId = String(todo.id || todo.snippet_id || todo.todo_id);
            return todoId === sid ? { ...todo, is_done: newStatus } : todo;
          });

        await new Promise<void>(resolve =>
          chromeAny.storage.local.set(
            {
              local_todos: updateTodoList(storage.local_todos || []),
              cached_todos: updateTodoList(storage.cached_todos || []),
            },
            resolve,
          ),
        );
      }
      window.dispatchEvent(new CustomEvent('todosUpdated'));
    } catch (err) {
      console.warn('[AltQ] Failed to toggle todo status:', err);
      toggleTodoOptimistic(sid, !newStatus);
    }
  };

  useEffect(() => {
    if (!commandSpace.isActive || commandSpace.activeCategoryFilter || !commandSpace.exactThisSectionActionId) {
      if (!commandSpace.isActive) {
        autoTriggeredThisSectionInputRef.current = null;
      }
      return;
    }

    const normalizedInput = commandSpace.normalizedInput;
    if (autoTriggeredThisSectionInputRef.current === normalizedInput) {
      return;
    }

    const exactAction =
      PAGE_ACTION_ITEMS.find(item => item.id === commandSpace.exactThisSectionActionId) ||
      filteredThisSite.find((item: any) => item.id === commandSpace.exactThisSectionActionId);

    if (!exactAction) {
      return;
    }

    autoTriggeredThisSectionInputRef.current = normalizedInput;
    setSearchValue('');
    handleExecute((exactAction as any).item || exactAction);
  }, [commandSpace, filteredThisSite, handleExecute]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isSettingsDropdownOpen) {
          setIsSettingsDropdownOpen(false);
          e.stopPropagation();
          return;
        }
        onClose();
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose, isSettingsDropdownOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle initialCommand
  useEffect(() => {
    let timer: any;
    if (initialCommand && isOpen) {
      timer = setTimeout(() => {
        // Find the matching item from PAGE_ACTION_ITEMS or construct a minimal one for thisSiteItems
        const item = PAGE_ACTION_ITEMS.find((i: any) => i.id === initialCommand) || {
          id: initialCommand,
          category: 'thissite_action'
        };
        handleExecute(item);
      }, 50);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [initialCommand, isOpen]);

  if (!isOpen) return null;

  const isDropdownActive = parseAtMode(searchValue, omniboxPrefixes).atDropdown;
  const activeTypedTag = getActiveTagInfo(searchValue, commandSpace.commandPrefix, omniboxPrefixes);

  const isExpanded =
    searchValue.trim().length > 0 ||
    (selectedSidebarSection !== 'all' && selectedSidebarSection !== '');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className={clsx(
          'fixed inset-0 flex z-[2147483647]',
          isExpanded
            ? 'items-center justify-center bg-black/60 backdrop-blur-[1px]'
            : 'items-start justify-center pt-[12vh] bg-transparent pointer-events-auto',
        )}>
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          ref={mainContainerRef}
          initial={{ scale: 0.96, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 15 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className={clsx(
            "relative font-['Inter',_sans-serif] text-[14px] leading-normal text-left text-white antialiased box-border m-0 p-0 transition-all duration-200",
            isExpanded
              ? 'w-[75vw] min-w-[900px] max-w-[95vw] h-[85vh] max-h-[800px] rounded-none shadow-2xl popup-main-container'
              : 'w-[650px] max-w-[90vw] h-auto shadow-2xl',
          )}>
          {/* Layer 1: Wallpaper image — sits behind everything, outside overflow:hidden */}
          {isExpanded && <WallpaperLayer />}

          {/* Layer 2: Heavy blur overlay — blurs the wallpaper at 60px so it's atmospheric but not distracting */}
          {isExpanded && hasWallpaper && (
            <div
              className="absolute inset-0 z-[1] pointer-events-none"
              style={{
                backdropFilter: 'blur(60px) saturate(1.4)',
                WebkitBackdropFilter: 'blur(60px) saturate(1.4)',
              }}
            />
          )}

          {/* Layer 3: Content container */}
          <div
            className={clsx(
              'z-[2] flex flex-col transition-all duration-200',
              isExpanded
                ? 'absolute inset-0 rounded-none overflow-hidden border border-[var(--color-borderDefault)] bg-[var(--color-containerBg)]'
                : 'relative w-full rounded-xl bg-[var(--color-containerBg)] overflow-visible border-none shadow-none',
            )}
            style={{
              backgroundColor: containerBackground,
              opacity: 1,
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
            }}>
            {/* Top Left Branding */}
            {isExpanded && !showSpreadsheet && (
              <div className="absolute top-7 left-8 flex items-center z-50 select-none">
                <div className="w-6 h-6 rounded-md flex items-center justify-center">
                  <img src={cmdOSLogo} alt="cmdOS" className="w-full h-full object-contain" />
                </div>
                <span className="text-lg font-bold text-[var(--color-textPrimary)] tracking-wide ml-2">cmdOS</span>
              </div>
            )}

            {/* Top Right Action Buttons */}
            {isExpanded && !showSpreadsheet && (
              <div className="absolute top-6 right-6 flex items-center gap-1.5 z-[100]">
                <button
                  onClick={onClose}
                  className="w-9 h-9 flex items-center justify-center bg-transparent hover:bg-[var(--color-hoverBg)] text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] transition-colors rounded-lg cursor-pointer focus:outline-none"
                  title="Close (Esc)">
                  <FiX className="w-5 h-5" />
                </button>
              </div>
            )}
            <div
              className={clsx(
                'shrink-0 relative w-full',
                isExpanded ? 'pt-6 pb-0 px-8' : 'p-0',
                showSpreadsheet ? 'hidden' : 'flex justify-center',
              )}>
              <div
                ref={searchContainerRef}
                className={clsx(
                  'relative flex items-center border border-[var(--color-borderDefault)] min-h-[48px] min-[1680px]:min-h-[56px] min-[1880px]:min-h-[60px] px-6 group transition-colors shadow-none focus-within:ring-1 focus-within:ring-white/10 z-[60]',
                  isExpanded ? 'w-[50%] bg-[var(--color-inputBg)]' : 'w-full bg-[var(--color-inputBg)] shadow-2xl',
                  isDropdownVisible &&
                    (dropdownOptions.totalList.length > 0 ||
                      (searchValue.startsWith('/') &&
                        searchValue.trim() !== '' &&
                        !parseAtMode(searchValue, omniboxPrefixes).activeSection))
                    ? 'rounded-t-xl'
                    : 'rounded-xl',
                )}
                style={{
                  backgroundColor: inputBackground,
                  opacity: 1,
                  backdropFilter: 'none',
                  WebkitBackdropFilter: 'none',
                }}>
                <div className="relative flex-1 h-full flex items-center">
                  {(() => {
                    const activeTag = showSidebarSectionPill
                      ? activeTypedTag ||
                        (searchValue.trim() === '' ? getSidebarSectionTagInfo(selectedSidebarSection) : null)
                      : null;
                    if (!activeTag) {
                      return (
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={searchValue}
                          onFocus={() => showDropdownIfNotFiltered(searchValue)}
                          onClick={() => showDropdownIfNotFiltered(searchValue)}
                          onChange={e => {
                            const val = e.target.value;
                            setSearchValue(val);
                            setIsDropdownVisible(shouldShowDefaultPopup(val));
                            if (val === '') {
                              setSelectedSidebarSection('all');
                              setShowSidebarSectionPill(false);
                            }
                          }}
                          onKeyDown={e => {
                            e.stopPropagation();
                            if (e.key === 'Backspace') {
                              const trimmed = searchValue.trim();
                              const lower = trimmed.toLowerCase();
                              const isShortcut =
                                FILTER_SHORTCUTS.includes(lower) ||
                                (lower.startsWith('/') && FILTER_SHORTCUTS.includes(lower.slice(1)));
                              if (isShortcut && (searchValue === trimmed || searchValue === trimmed + ' ')) {
                                e.preventDefault();
                                showDefaultPopup();
                                return;
                              }
                            }
                            if (dropdownOptions.totalList.length > 0) {
                              const totalList = dropdownOptions.totalList;
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setIsDropdownVisible(true);
                                setDropdownSelectedIndex(prev => (prev + 1) % totalList.length);
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setIsDropdownVisible(true);
                                setDropdownSelectedIndex(prev => (prev - 1 + totalList.length) % totalList.length);
                              } else if (e.key === 'Enter') {
                                e.preventDefault();
                                if (totalList.length > 0) {
                                  const selectedIdx = Math.max(
                                    0,
                                    Math.min(dropdownSelectedIndex, totalList.length - 1),
                                  );
                                  const chosen = totalList[selectedIdx];
                                  if (chosen.type.includes('action')) {
                                    handleExecute((chosen as any).item || chosen);
                                    setSearchValue('');
                                    setShowSidebarSectionPill(false);
                                    setDropdownSelectedIndex(-1);
                                    setIsDropdownVisible(false);
                                  } else {
                                    setSelectedSidebarSection(chosen.id);
                                    setShowSidebarSectionPill(false);
                                    const alias = SECTION_ALIAS_DISPLAY[chosen.id];
                                    const newSearchValue =
                                      chosen.id === 'all' || !alias ? '' : `/${alias.toLowerCase()} `;
                                    setSearchValue(newSearchValue);
                                    setDropdownSelectedIndex(-1);
                                    setIsDropdownVisible(newSearchValue.trim() === '');
                                  }
                                }
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setSearchValue('');
                                setShowSidebarSectionPill(false);
                                setDropdownSelectedIndex(-1);
                                setIsDropdownVisible(false);
                              }
                            }
                          }}
                          onKeyUp={e => e.stopPropagation()}
                          placeholder="Type to search"
                          className="flex-1 min-w-0 bg-transparent border-none text-[16px] min-[1680px]:text-[18px] min-[1880px]:text-[20px] font-medium caret-white placeholder-[var(--color-textPlaceholder)] focus:outline-none focus:ring-0 h-full z-10 text-[var(--color-textPrimary)]"
                        />
                      );
                    }

                    return (
                      <div className="flex-1 flex items-center h-full">
                        <div className="flex items-center gap-1.5 mr-2 bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] rounded-lg px-2.5 py-0.5 shadow-sm text-[var(--color-textPrimary)] select-none">
                          <span className="text-xs font-medium">{activeTag.label}</span>
                        </div>
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={activeTag.query}
                          onFocus={() => showDropdownIfNotFiltered(searchValue)}
                          onClick={() => showDropdownIfNotFiltered(searchValue)}
                          onChange={e => {
                            const val = e.target.value;
                            const newVal = activeTag.prefix + ' ' + val;
                            setSearchValue(newVal);
                            setIsDropdownVisible(shouldShowDefaultPopup(newVal));
                          }}
                          onKeyDown={e => {
                            e.stopPropagation();
                            if (e.key === 'Backspace' && activeTag.query === '') {
                              e.preventDefault();
                              showDefaultPopup();
                              return;
                            }
                            if (dropdownOptions.totalList.length > 0) {
                              const totalList = dropdownOptions.totalList;
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setIsDropdownVisible(true);
                                setDropdownSelectedIndex(prev => (prev + 1) % totalList.length);
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setIsDropdownVisible(true);
                                setDropdownSelectedIndex(prev => (prev - 1 + totalList.length) % totalList.length);
                              } else if (e.key === 'Enter') {
                                e.preventDefault();
                                if (totalList.length > 0) {
                                  const selectedIdx = Math.max(
                                    0,
                                    Math.min(dropdownSelectedIndex, totalList.length - 1),
                                  );
                                  const chosen = totalList[selectedIdx];
                                  if (chosen.type === 'action') {
                                    handleExecute((chosen as any).item);
                                    setSearchValue('');
                                    setDropdownSelectedIndex(-1);
                                    setIsDropdownVisible(false);
                                  } else {
                                    setSelectedSidebarSection(chosen.id);
                                    const alias = SECTION_ALIAS_DISPLAY[chosen.id];
                                    const newSearchValue =
                                      chosen.id === 'all' || !alias ? '' : `/${alias.toLowerCase()} `;
                                    setSearchValue(newSearchValue);
                                    setDropdownSelectedIndex(-1);
                                    setIsDropdownVisible(newSearchValue.trim() === '');
                                  }
                                }
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                setSearchValue('');
                                setDropdownSelectedIndex(-1);
                                setIsDropdownVisible(false);
                              }
                            }
                          }}
                          onKeyUp={e => e.stopPropagation()}
                          className="flex-1 min-w-0 bg-transparent border-none text-[16px] min-[1680px]:text-[18px] min-[1880px]:text-[20px] font-medium caret-white placeholder-[var(--color-textPlaceholder)] focus:outline-none focus:ring-0 h-full z-10 text-[var(--color-textPrimary)]"
                        />
                      </div>
                    );
                  })()}
                </div>

                {isDropdownVisible &&
                  (dropdownOptions.totalList.length > 0 ||
                    (searchValue.startsWith('/') &&
                      searchValue.trim() !== '' &&
                      !parseAtMode(searchValue, omniboxPrefixes).activeSection)) && (
                    <div
                      className={clsx(
                        'absolute top-[100%] left-0 w-full border border-[var(--color-borderDefault)] rounded-b-xl shadow-2xl z-[70] overflow-hidden flex flex-col pt-0 pb-2 max-h-[360px] overflow-y-auto custom-scrollbar group/sidebar',
                        'bg-[var(--color-containerBg)]',
                      )}
                      style={{
                        backgroundColor: containerBackground,
                        opacity: 1,
                        backdropFilter: 'none',
                        WebkitBackdropFilter: 'none',
                      }}>
                      {(() => {
                        if (dropdownOptions.totalList.length === 0) {
                          return (
                            <div className="px-4 py-3 text-[13px] text-[var(--color-textSecondary)]">
                              No matching categories or actions
                            </div>
                          );
                        }

                        const DROPDOWN_ITEM_BASE_CLASS =
                          'w-full appearance-none border-0 px-3 py-2 flex items-center justify-between cursor-pointer transition-colors mx-2 rounded-xl font-normal text-left text-[13px] group';
                        const DROPDOWN_ITEM_SELECTED_CLASS =
                          'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)] shadow-md border border-[var(--color-borderActive)]';
                        const DROPDOWN_ITEM_UNSELECTED_CLASS =
                          'bg-transparent text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] border border-transparent';
                        const DROPDOWN_ITEM_LABEL_CLASS = 'truncate text-[var(--color-textPrimary)]';
                        const DROPDOWN_ITEM_SHORTCUT_CLASS =
                          'ml-auto flex items-center justify-center gap-1 px-1.5 py-0 rounded border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] text-[13px] font-light font-mono text-[var(--color-textSecondary)] select-none lowercase';

                        const DropdownSectionHeader = ({ title }: { title: string }) => (
                          <div className="text-[10px] font-bold tracking-[0.08em] text-[var(--color-textMuted)] px-4 py-1 mt-1">
                            {title}
                          </div>
                        );

                        return (
                          <>
                            {/* 1. "Site Commands" Heading and Action Items */}
                            {dropdownOptions.siteCommandActions.length > 0 &&
                              (() => {
                                return (
                                  <>
                                    <DropdownSectionHeader title=" Actions (Save current tab as) " />
                                    {dropdownOptions.siteCommandActions.map((opt: any, idx: number) => {
                                      const globalIdx = idx;
                                      const isSelected = dropdownSelectedIndex === globalIdx;
                                      const allowContextMenu = opt.id !== 'saved_indicator';
                                      const icon =
                                        PAGE_ACTION_ICONS[opt.id] ||
                                        (opt.id === 'save_link' ? (
                                          <FaLink className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" />
                                        ) : opt.id === 'save_session' ? (
                                          <SessionGridIcon className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" />
                                        ) : opt.id === 'saved_indicator' ? (
                                          <FaCheck className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" />
                                        ) : opt.id === 'add_to_existing' ? (
                                          <FaLink className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" />
                                        ) : opt.id === 'add_to_existing_session' ? (
                                          <SessionGridIcon className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" />
                                        ) : opt.id === 'summarize_page' ? (
                                          <LuSparkles className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" />
                                        ) : (
                                          <FaRegFileAlt className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" />
                                        ));

                                      const actionPrefixVal =
                                        THIS_SECTION_ACTION_PREFIXES[opt.id] || opt.item?.prefix || '';
                                      const actionShortcutDisplay = actionPrefixVal
                                        ? `${commandSpace.commandPrefix} ${actionPrefixVal.toLowerCase()}`
                                        : '';

                                      return (
                                        <button
                                          type="button"
                                          key={opt.id}
                                          id={`alts-dropdown-item-${globalIdx}`}
                                          onMouseDown={e => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                          }}
                                          onClick={e => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            executeDropdownItem(opt.item);
                                          }}
                                          onContextMenu={
                                            allowContextMenu
                                              ? e => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleContextMenu(e, opt.item, opt.name);
                                              }
                                              : undefined
                                          }
                                          onMouseEnter={() => setDropdownSelectedIndex(globalIdx)}
                                          className={clsx(
                                            DROPDOWN_ITEM_BASE_CLASS,
                                            isSelected ? DROPDOWN_ITEM_SELECTED_CLASS : DROPDOWN_ITEM_UNSELECTED_CLASS,
                                          )}>
                                          <div className="flex items-center gap-3 min-w-0">
                                            {icon}
                                            <span className={clsx(DROPDOWN_ITEM_LABEL_CLASS, 'w-[230px] shrink-0')}>
                                              {opt.name}
                                            </span>
                                            {actionShortcutDisplay && (
                                              <span className={DROPDOWN_ITEM_SHORTCUT_CLASS}>
                                                {actionShortcutDisplay}
                                              </span>
                                            )}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </>
                                );
                              })()}

                            {/* 2. "Extraction Commands" Heading and Action Items */}
                            {dropdownOptions.extractionActions.length > 0 &&
                              (() => {
                                return (
                                  <>
                                    <DropdownSectionHeader title="Extraction Commands" />
                                    {dropdownOptions.extractionActions.map((opt: any, idx: number) => {
                                      const globalIdx = dropdownOptions.siteCommandActions.length + idx;
                                      const isSelected = dropdownSelectedIndex === globalIdx;
                                      const allowContextMenu = opt.id !== 'saved_indicator';
                                      const icon =
                                        PAGE_ACTION_ICONS[opt.id] ||
                                        (opt.id === 'save_link' ? (
                                          <FaLink className="w-4 h-4 shrink-0 text-current opacity-80" />
                                        ) : opt.id === 'save_session' ? (
                                          <SessionGridIcon className="w-4 h-4 shrink-0 text-current opacity-80" />
                                        ) : opt.id === 'saved_indicator' ? (
                                          <FaCheck className="w-4 h-4 shrink-0 text-current opacity-80" />
                                        ) : opt.id === 'add_to_existing' ? (
                                          <FaLink className="w-4 h-4 shrink-0 text-current opacity-80" />
                                        ) : opt.id === 'add_to_existing_session' ? (
                                          <SessionGridIcon className="w-4 h-4 shrink-0 text-current opacity-80" />
                                        ) : opt.id === 'summarize_page' ? (
                                          <LuSparkles className="w-4 h-4 shrink-0 text-current opacity-80" />
                                        ) : (
                                          <FaRegFileAlt className="w-4 h-4 shrink-0 text-current opacity-80" />
                                        ));

                                      const actionPrefixVal =
                                        THIS_SECTION_ACTION_PREFIXES[opt.id] || opt.item?.prefix || '';
                                      const actionShortcutDisplay = actionPrefixVal
                                        ? `${commandSpace.commandPrefix} ${actionPrefixVal.toLowerCase()}`
                                        : '';

                                      return (
                                        <button
                                          type="button"
                                          key={opt.id}
                                          id={`alts-dropdown-item-${globalIdx}`}
                                          onMouseDown={e => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                          }}
                                          onClick={e => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            executeDropdownItem(opt.item);
                                          }}
                                          onContextMenu={
                                            allowContextMenu
                                              ? e => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleContextMenu(e, opt.item, opt.name);
                                              }
                                              : undefined
                                          }
                                          onMouseEnter={() => setDropdownSelectedIndex(globalIdx)}
                                          className={clsx(
                                            DROPDOWN_ITEM_BASE_CLASS,
                                            isSelected ? DROPDOWN_ITEM_SELECTED_CLASS : DROPDOWN_ITEM_UNSELECTED_CLASS,
                                          )}>
                                          <div className="flex items-center gap-3 min-w-0">
                                            {icon}
                                            <span className={clsx(DROPDOWN_ITEM_LABEL_CLASS, 'w-[230px] shrink-0')}>
                                              {opt.name}
                                            </span>
                                            {actionShortcutDisplay && (
                                              <span className={DROPDOWN_ITEM_SHORTCUT_CLASS}>
                                                {actionShortcutDisplay}
                                              </span>
                                            )}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </>
                                );
                              })()}

                            {/* 3. "Categories" Heading and Category Options */}
                            {dropdownOptions.categories.length > 0 && (
                              <>
                                <DropdownSectionHeader title="Categories" />
                                {(() => {
                                  return dropdownOptions.categories.map((opt: any, idx: number) => {
                                    const globalIdx = dropdownOptions.thisSiteActions.length + idx;
                                    const isSelected = dropdownSelectedIndex === globalIdx;
                                    const optName = opt.name;
                                    const isAll = optName === 'all';
                                    const meta = isAll
                                      ? {
                                        title: 'All',
                                        icon: (
                                          <svg
                                            className="w-4 h-4 shrink-0"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2">
                                            <rect x="3" y="3" width="7" height="7" rx="1" />
                                            <rect x="14" y="3" width="7" height="7" rx="1" />
                                            <rect x="14" y="14" width="7" height="7" rx="1" />
                                            <rect x="3" y="14" width="7" height="7" rx="1" />
                                          </svg>
                                        ),
                                      }
                                      : SECTION_META[optName] || {
                                        title: optName,
                                        icon: <FaCheckCircle className="w-4 h-4 shrink-0" />,
                                      };

                                    const categoryPrefixMap: Record<string, string> = {
                                      todos: 'todo',
                                      notes: 'note',
                                      links: 'link',
                                      save_session: 'save_session',
                                      commands: 'command',
                                      sessions: 'session',
                                      automations: 'automation',
                                      chat_agents: 'agent',
                                      snippets: 'snippet',
                                      prompts: 'prompt',
                                    };
                                    const categoryKey = categoryPrefixMap[optName];
                                    const prefixVal =
                                      categoryKey && omniboxPrefixes ? omniboxPrefixes[categoryKey] : '';

                                    return (
                                      <div
                                        key={optName}
                                        id={`alts-dropdown-item-${globalIdx}`}
                                        onPointerDown={e => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setSelectedSidebarSection(optName);
                                          setShowSidebarSectionPill(false);
                                          const alias = SECTION_ALIAS_DISPLAY[optName];
                                          const newSearchValue =
                                            optName === 'all' || !alias ? '' : `/${alias.toLowerCase()} `;
                                          setSearchValue(newSearchValue);
                                          setDropdownSelectedIndex(-1);
                                          setIsDropdownVisible(newSearchValue.trim() === '');
                                        }}
                                        onClick={e => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setSelectedSidebarSection(optName);
                                          setShowSidebarSectionPill(false);
                                          const alias = SECTION_ALIAS_DISPLAY[optName];
                                          const newSearchValue =
                                            optName === 'all' || !alias ? '' : `/${alias.toLowerCase()} `;
                                          setSearchValue(newSearchValue);
                                          setDropdownSelectedIndex(-1);
                                          setIsDropdownVisible(newSearchValue.trim() === '');
                                        }}
                                        onMouseDown={e => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setSelectedSidebarSection(optName);
                                          setShowSidebarSectionPill(false);
                                          const alias = SECTION_ALIAS_DISPLAY[optName];
                                          const newSearchValue =
                                            optName === 'all' || !alias ? '' : `/${alias.toLowerCase()} `;
                                          setSearchValue(newSearchValue);
                                          setDropdownSelectedIndex(-1);
                                          setIsDropdownVisible(newSearchValue.trim() === '');
                                        }}
                                        onMouseEnter={() => setDropdownSelectedIndex(globalIdx)}
                                        className={clsx(
                                          DROPDOWN_ITEM_BASE_CLASS,
                                          isSelected ? DROPDOWN_ITEM_SELECTED_CLASS : DROPDOWN_ITEM_UNSELECTED_CLASS,
                                        )}>
                                        <div className="flex items-center gap-3 min-w-0">
                                          {meta.icon}
                                          <span className={clsx(DROPDOWN_ITEM_LABEL_CLASS, 'w-[230px] shrink-0')}>
                                            {meta.title}
                                          </span>
                                          {prefixVal && (
                                            <div
                                              onClick={e => e.stopPropagation()}
                                              onMouseDown={e => e.stopPropagation()}
                                              className="flex items-center gap-1 select-none">
                                              <EditablePrefixKey
                                                category={categoryKey as any}
                                                currentValue={prefixVal}
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  });
                                })()}
                              </>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
              </div>
            </div>
            {/* Scrollable Content Area */}
            {isExpanded &&
              !(
                isDropdownVisible &&
                (dropdownOptions.totalList.length > 0 ||
                  (searchValue.startsWith('/') && searchValue.trim() !== '' && !parseAtMode(searchValue, omniboxPrefixes).activeSection))
              ) && (
                <div className={clsx('flex-1 min-h-0 w-full flex flex-col', showSpreadsheet ? 'p-0' : 'px-8 py-6')}>
                  {showSpreadsheet ? (
                    <SpreadsheetMainContainer
                      isEmbedded={true}
                      onClose={onClose}
                      isLoggedIn={isLoggedIn}
                      onBoardViewRedirect={() => setShowSpreadsheet(false)}
                      onCreateOrganization={() => {
                        const url = chrome.runtime.getURL('AltS_search_newtab/index.html');
                        chrome.runtime.sendMessage({ action: 'open_tab', url, active: true });
                      }}
                      onOrganizationSettings={(orgId, orgName) => {
                        const url = chrome.runtime.getURL('AltS_search_newtab/index.html');
                        chrome.runtime.sendMessage({ action: 'open_tab', url, active: true });
                      }}
                      onCreateWorkspace={() => {
                        const url = chrome.runtime.getURL('AltS_search_newtab/index.html');
                        chrome.runtime.sendMessage({ action: 'open_tab', url, active: true });
                      }}
                    />
                  ) : (
                    <BoardView
                      ref={boardViewRef}
                      hideCloseButton={true}
                      isEmbedded={true}
                      forceNativeStyling={true}
                      includeWebsitePageActions={true}
                      searchValue={debouncedSearchValue}
                      unfilteredSuggestions={[]}
                      externalBookmarks={allBookmarks}
                      isLoggedIn={isLoggedIn}
                      onClose={onClose}
                      onExecuteItem={handleExecute}
                      onSheetRedirect={() => {
                        setShowSpreadsheet(true);
                      }}
                      state={
                        {
                          value: debouncedSearchValue,
                          isVisible: true,
                          suggestions: suggestionState.debouncedFuseResults,
                          highlightIndex: 0,
                          mode: 'mixed',
                          onQueryChange: (val: string) => {
                            updateSearchValue(val);
                          },
                          onSidebarSectionSelect: (sectionId: string) => {
                            setSelectedSidebarSection(sectionId);
                            setShowSidebarSectionPill(sectionId !== 'all');
                          },
                          onSnippetSelect: (item: any) => handleExecute(item),
                          onCommonCommandSelect: (item: any) => handleExecute(item),
                          onRequestSnippetDelete: handleWebsiteDeleteRequest,
                          onToggleFavorite: handleToggleFavorite,
                          onRequestOpenUrls: (urls: string[], title?: string) => {
                            if (urls && urls.length > 0) {
                              chrome.tabs.create({ url: urls[0] });
                              if (onClose) onClose();
                            }
                          },
                        } as any
                      }
                      extraGroups={[
                        {
                          title: 'This Site',
                          items: filteredThisSite,
                          icon: <FaRegFileAlt className="w-4 h-4 shrink-0 text-[#A1A6B3]" />,
                        },
                      ]}
                      portalContainer={
                        (window as any).__ALTS_PORTAL_HOST__ || (window as any).__ALTQ_PORTAL_HOST__ || document.body
                      }
                    />
                  )}
                </div>
              )}
            {/* Footer Indications */}
            {!isDropdownActive &&
              !showSpreadsheet &&
              !(
                dropdownOptions.totalList.length > 0 ||
                (searchValue.startsWith('/') && searchValue.trim() !== '' && !parseAtMode(searchValue, omniboxPrefixes).activeSection)
              ) && (
                <div
                  className={clsx(
                    'relative flex items-center justify-between gap-3 px-8 py-2.5 border-t border-[#2A2B33] bg-[#0E0F14]/85 backdrop-blur text-[10px] font-medium flex-shrink-0 text-[#8B8F9D]',
                  )}>
                  {/* Left: Keyboard shortcuts */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-[#A1A6B3]">Navigate</span>
                      <span className="flex items-center gap-0.5">
                        <span className="px-1.5 py-0.5 rounded border border-[#2A2B33] bg-[#171821] font-mono text-[9px] font-bold text-white">
                          ↑
                        </span>
                        <span className="px-1.5 py-0.5 rounded border border-[#2A2B33] bg-[#171821] font-mono text-[9px] font-bold text-white">
                          ↓
                        </span>
                        <span className="px-1.5 py-0.5 rounded border border-[#2A2B33] bg-[#171821] font-mono text-[9px] font-bold text-white">
                          ←
                        </span>
                        <span className="px-1.5 py-0.5 rounded border border-[#2A2B33] bg-[#171821] font-mono text-[9px] font-bold text-white">
                          →
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-[#A1A6B3]">Select</span>
                      <span className="px-1.5 py-0.5 rounded border border-[#2A2B33] bg-[#171821] font-mono text-[9px] font-bold text-white">
                        Enter
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-[#A1A6B3]">Close</span>
                      <span className="px-1.5 py-0.5 rounded border border-[#2A2B33] bg-[#171821] font-mono text-[9px] font-bold text-white">
                        Esc
                      </span>
                    </div>
                  </div>

                  {/* Right: Options */}
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[#A1A6B3]">Options</span>
                    <span className="flex items-center gap-0.5">
                      <span className="px-1.5 py-0.5 rounded border border-[#2A2B33] bg-[#171821] font-mono text-[9px] font-bold text-white">
                        Right Click
                      </span>
                    </span>
                  </div>
                </div>
              )}
          </div>
        </motion.div>

        <style
          dangerouslySetInnerHTML={{
            __html: `
          .no-scrollbar::-webkit-scrollbar { display: none !important; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          
          .custom-horizontal-scrollbar::-webkit-scrollbar {
            height: 8px;
            width: 0px;
          }
          .custom-horizontal-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-horizontal-scrollbar::-webkit-scrollbar-thumb {
            background-color: rgba(255, 255, 255, 0.2);
            border-radius: 9999px;
          }
          .custom-horizontal-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: rgba(255, 255, 255, 0.5);
          }
        `,
          }}
        />
      </motion.div>
      {showAddExistingModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[2147483647] bg-black/60 backdrop-blur-[1px]">
          <div className="absolute inset-0" onClick={() => setShowAddExistingModal(false)} />
          <div className="bg-[#171821] border border-white/10 rounded-2xl w-[400px] max-w-[90vw] p-6 shadow-2xl flex flex-col gap-4 text-white font-sans animate-in fade-in zoom-in-95 duration-150 z-10 relative">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Existing Links</h3>
              <button
                onClick={() => setShowAddExistingModal(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors cursor-pointer">
                <FiX size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-1.5 max-h-[250px] overflow-y-auto custom-scrollbar pr-1">
              {links.length === 0 ? (
                <div className="text-neutral-500 text-sm py-6 text-center">No existing link collections found.</div>
              ) : (
                links.map(linkItem => (
                  <button
                    key={linkItem.id}
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      try {
                        const targetUrl =
                          addExistingUrl ||
                          activeTabUrl ||
                          (window.location.href.startsWith('chrome-extension://') ? '' : window.location.href);
                        const targetTitle = addExistingTitle || activeTabTitle || document.title || 'Untitled Page';

                        if (!targetUrl) {
                          useUIStore.getState().queueNotification({ message: 'Unable to detect page URL to add', type: 'error' });
                          return;
                        }

                        const currentUrls = Array.isArray(linkItem.urls) ? linkItem.urls : [];
                        const newItem = {
                          id: 'link_item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                          title: targetTitle,
                          url: targetUrl,
                        };

                        const response: any = await new Promise(resolve => {
                          chrome.runtime.sendMessage(
                            {
                              action: 'db_update_link',
                              linkId: linkItem.id,
                              input: {
                                urls: [...currentUrls, newItem],
                              },
                            },
                            res => resolve(res),
                          );
                        });
                        if (response && response.success === false) {
                          throw new Error(response.error || 'Failed to update link via background');
                        }
                        syncDbFromBackground();
                        setShowAddExistingModal(false);

                        useUIStore.getState().queueNotification({
                          message: `Added to "${linkItem.title}" successfully`,
                          type: 'success',
                        });
                      } catch (err) {
                        console.error('Failed to add url to existing link:', err);
                        useUIStore.getState().queueNotification({ message: 'Failed to add URL to link collection', type: 'error' });
                      }
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-neutral-300 hover:text-white transition-all text-sm font-medium flex items-center justify-between cursor-pointer">
                    <span className="truncate">{linkItem.title}</span>
                    <span className="text-xs text-neutral-500 font-mono">({linkItem.urls?.length || 0})</span>
                  </button>
                ))
              )}
            </div>

            <button
              onClick={() => setShowAddExistingModal(false)}
              className="w-full mt-2 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-neutral-400 hover:text-white transition-colors text-sm font-semibold cursor-pointer">
              Cancel
            </button>
          </div>
        </div>
      )}

      {showAddExistingSessionModal && (
        <div className="fixed inset-0 flex items-center justify-center z-[2147483647] bg-black/60 backdrop-blur-[1px]">
          <div className="absolute inset-0" onClick={() => setShowAddExistingSessionModal(false)} />
          <div className="bg-[#171821] border border-white/10 rounded-2xl w-[400px] max-w-[90vw] p-6 shadow-2xl flex flex-col gap-4 text-white font-sans animate-in fade-in zoom-in-95 duration-150 z-10 relative">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Existing Session</h3>
              <button
                onClick={() => setShowAddExistingSessionModal(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors cursor-pointer">
                <FiX size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-1.5 max-h-[250px] overflow-y-auto custom-scrollbar pr-1">
              {dbSessions.length === 0 ? (
                <div className="text-neutral-500 text-sm py-6 text-center">No existing sessions found.</div>
              ) : (
                dbSessions.map(sessionItem => (
                  <button
                    key={sessionItem.id}
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      try {
                        const targetUrl =
                          addExistingUrl ||
                          activeTabUrl ||
                          (window.location.href.startsWith('chrome-extension://') ? '' : window.location.href);
                        const targetTitle = addExistingTitle || activeTabTitle || document.title || 'Untitled Page';

                        if (!targetUrl) {
                          useUIStore.getState().queueNotification({ message: 'Unable to detect page URL to add', type: 'error' });
                          return;
                        }

                        const currentUrls = Array.isArray(sessionItem.urls) ? sessionItem.urls : [];
                        const newItem = {
                          id: 'link_item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                          title: targetTitle,
                          url: targetUrl,
                        };

                        const response: any = await new Promise(resolve => {
                          chrome.runtime.sendMessage(
                            {
                              action: 'db_update_session',
                              sessionId: sessionItem.id,
                              input: {
                                urls: [...currentUrls, newItem],
                              },
                            },
                            res => resolve(res),
                          );
                        });
                        if (response && response.success === false) {
                          throw new Error(response.error || 'Failed to update session via background');
                        }
                        syncDbFromBackground();
                        setShowAddExistingSessionModal(false);

                        useUIStore.getState().queueNotification({
                          message: `Added to "${sessionItem.title}" successfully`,
                          type: 'success',
                        });
                      } catch (err) {
                        console.error('Failed to add url to existing session:', err);
                        useUIStore.getState().queueNotification({ message: 'Failed to add URL to session', type: 'error' });
                      }
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-neutral-300 hover:text-white transition-all text-sm font-medium flex items-center justify-between cursor-pointer">
                    <span className="truncate">{sessionItem.title}</span>
                    <span className="text-xs text-neutral-500 font-mono">({sessionItem.urls?.length || 0})</span>
                  </button>
                ))
              )}
            </div>

            <button
              onClick={() => setShowAddExistingSessionModal(false)}
              className="w-full mt-2 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-neutral-400 hover:text-white transition-colors text-sm font-semibold cursor-pointer">
              Cancel
            </button>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default App;
