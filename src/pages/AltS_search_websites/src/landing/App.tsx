import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
} from 'react-icons/fi';
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
  FaLayerGroup,
  FaGithub,
  FaCamera,
  FaExpand,
  FaImages,
  FaTable,
} from 'react-icons/fa';
import NotesIcon from '../components/NotesIcon';
import { getFaviconUrl } from '../../../../shared-components/searchBarMain/utilityFunctions/utils';
import { extractUrlsFromSnippet } from '../../../../allObjectFolder/src/createObject/snippets/SnippetClickActions';
import { getUserId } from '../../../../storage/API/core/api';
import { buildUrl, SHARED_ALL_COMMANDS, THIS_SECTION_ACTION_PREFIXES } from '../../../../shared-components/commands';
import { extractSnippetIdFromCompoundId } from '../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { db } from '../../../../storage/indexDB/dbConfig';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import cmdOSLogo from '../../../../shared-components/assets/tasklabs_logo.png';
import { useUIStore } from '../../../../shared-components/uiStateManager';
import NotificationContainer from '../../../../shared-components/notifications/NotificationContainer';

const showWebsiteToast = (message: string, bg = '#1a73e8') => {
  const container = (window as any).__ALTS_PORTAL_HOST__ || (window as any).__ALTQ_PORTAL_HOST__ || document.body;
  const toastId = `alts-website-toast-${Date.now()}`;
  const toast = document.createElement('div');
  toast.id = toastId;
  toast.textContent = message;
  toast.style.cssText = [
    'position:fixed',
    'bottom:24px',
    'left:50%',
    'transform:translateX(-50%)',
    `background:${bg}`,
    'color:white',
    'padding:10px 22px',
    'border-radius:20px',
    'z-index:2147483647',
    'font-family:system-ui,sans-serif',
    'font-size:13px',
    'font-weight:600',
    'box-shadow:0 8px 24px rgba(0,0,0,0.4)',
    'pointer-events:none',
    'transition:opacity 0.2s ease-in-out',
  ].join(';');
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 2500);
};
import { useDbStore } from '../../../../storage/store/useDbStore';
import { resolveEntityById } from '../../../../shared-components/utils/entityResolver';

import { BsKeyboard } from 'react-icons/bs';
import { LuSparkles } from 'react-icons/lu';
import { PAGE_ACTION_ITEMS, executePageActionCommand, type AltQPageActionItem } from '../commands/pageActions';
import { CustomSearchPrefixesForOmniboxStorage } from '../../../../storage/localStorage/customSearchPrefixesForOmniboxStorage';
import BoardView from '../../../../shared-components/BoardView/BoardView';
import SpreadsheetMainContainer from '../../../../shared-components/spreadsheetUi/ui/spreadsheetMainContainer';
import { EditablePrefixKey } from '../../../../shared-components/shortcuts/ui/EditablePrefixKey';

// Map command IDs to specific React Icons
const BROWSER_ICONS: Record<string, React.ReactNode> = {
  history: <FaHistory size={22} className="text-[#586e75] dark:text-neutral-400" />,
  downloads: <FaDownload size={22} className="text-[#586e75] dark:text-neutral-400" />,
  settings: <FaCog size={22} className="text-[#586e75] dark:text-neutral-400" />,
  extensions: <FaPuzzlePiece size={22} className="text-[#586e75] dark:text-neutral-400" />,
  bookmarks: <FaBookmark size={22} className="text-[#586e75] dark:text-neutral-400" />,
  flags: <FaFlag size={22} className="text-[#586e75] dark:text-neutral-400" />,
  inspect: <FaCode size={22} className="text-[#586e75] dark:text-neutral-400" />,
  version: <FaTag size={22} className="text-[#586e75] dark:text-neutral-400" />,
  about: <FaInfoCircle size={22} className="text-[#586e75] dark:text-neutral-400" />,
  tasks: <FaMemory size={22} className="text-[#586e75] dark:text-neutral-400" />,
  gpu: <FaMicrochip size={22} className="text-[#586e75] dark:text-neutral-400" />,
  dino: <FaGamepad size={22} className="text-[#586e75] dark:text-neutral-400" />,
  passwords: <FaKey size={22} className="text-[#586e75] dark:text-neutral-400" />,
  help: <FaQuestionCircle size={22} className="text-[#586e75] dark:text-neutral-400" />,
  ai: <FaRobot size={22} className="text-[#586e75] dark:text-neutral-400 object-contain" />,
};

// Icons for page-action commands (screenshot / download)
const PAGE_ACTION_ICONS: Record<string, React.ReactNode> = {
  capture_screenshot: <FaCamera size={14} className="text-[#A1A6B3]" />,
  capture_full_screenshot: <FaExpand size={14} className="text-[#A1A6B3]" />,
  downloadallimages: <FaImages size={14} className="text-[#A1A6B3]" />,
  downloadalltables: <FaTable size={14} className="text-[#A1A6B3]" />,
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
  sn: 'Snippets',
  p: 'Prompts',
};

function getActiveTagInfo(
  searchValue: string,
  commandPrefix = 'c',
): { prefix: string; label: string; query: string } | null {
  const hasLeadingSlash = searchValue.startsWith('/');
  const textToMatch = hasLeadingSlash ? searchValue.slice(1) : searchValue;
  const match = textToMatch.match(/^[a-zA-Z]+/);
  if (!match) return null;
  const prefix = match[0];
  const rest = textToMatch.slice(prefix.length);
  const lowerPrefix = prefix.toLowerCase();
  if (!hasLeadingSlash && lowerPrefix === commandPrefix.toLowerCase()) return null;
  if (lowerPrefix === 'a') return null;
  if (FILTER_SHORTCUTS.includes(lowerPrefix) && (rest === '' || rest.startsWith(' '))) {
    return {
      prefix: hasLeadingSlash ? `/${prefix}` : prefix,
      label: FILTER_LABELS[lowerPrefix] || prefix,
      query: rest.startsWith(' ') ? rest.slice(1) : '',
    };
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
function parseAtMode(searchValue: string): {
  atDropdown: boolean;
  activeSection: string | null;
  searchQuery: string;
} {
  const textAfterAt = searchValue;

  // Find longest matching alias prefix
  let bestAlias = '';
  let activeSection: string | null = null;

  // Support both with and without leading slash (e.g. "N " or "/N ")
  const hasLeadingSlash = textAfterAt.startsWith('/');
  const textToMatch = hasLeadingSlash ? textAfterAt.slice(1) : textAfterAt;

  for (const [alias, section] of Object.entries(SECTION_ALIASES)) {
    const upperText = textToMatch.toUpperCase();
    const upperAlias = alias.toUpperCase();

    // Active if matches exactly followed by a space
    const matchWithSpace = upperText.startsWith(upperAlias + ' ');

    if (matchWithSpace) {
      if (alias.length > bestAlias.length) {
        bestAlias = alias;
        activeSection = section;
      }
    }
  }

  if (activeSection) {
    // Slice off the alias (+ optional slash prefix) + trailing space
    let query = textToMatch.slice(bestAlias.length);
    if (query.startsWith(' ')) {
      query = query.slice(1);
    }
    return { atDropdown: false, activeSection, searchQuery: query };
  }

  return { atDropdown: false, activeSection: null, searchQuery: searchValue };
}

type WebsiteCommandSpaceCategory =
  | 'note'
  | 'link'
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
  const ACTION_KEYS = [
    'capture_screenshot',
    'capture_full_screenshot',
    'downloadallimages',
    'downloadalltables',
    'save_link',
    'save_session',
    'save_chat',
    'add_to_existing',
    'add_to_existing_session',
    'summarize_page',
  ] as const;
  const map: Record<string, string> = {};
  for (const key of ACTION_KEYS) {
    if (omniboxPrefixes?.[key]) map[key] = omniboxPrefixes[key];
  }
  return map;
};

function parseWebsiteCommandSpace(searchValue: string, omniboxPrefixes: any): WebsiteCommandSpaceState {
  const normalizedValue = searchValue.replace(/\u00A0/g, ' ');
  const commandPrefix = omniboxPrefixes?.command?.trim().toLowerCase() || 'c';

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

  const nestedPrefixes: Array<{ key: WebsiteCommandSpaceCategory; prefix: string }> = [
    { key: 'snippet', prefix: omniboxPrefixes?.snippet?.trim().toLowerCase() || 'sn' },
    { key: 'note', prefix: omniboxPrefixes?.note?.trim().toLowerCase() || 'n' },
    { key: 'link', prefix: omniboxPrefixes?.link?.trim().toLowerCase() || 'l' },
    { key: 'session', prefix: omniboxPrefixes?.session?.trim().toLowerCase() || 's' },
    { key: 'prompt', prefix: omniboxPrefixes?.prompt?.trim().toLowerCase() || 'p' },
    { key: 'automation', prefix: omniboxPrefixes?.automation?.trim().toLowerCase() || 'a' },
    { key: 'agent', prefix: omniboxPrefixes?.agent?.trim().toLowerCase() || 'g' },
    { key: 'todo', prefix: omniboxPrefixes?.todo?.trim().toLowerCase() || 't' },
    { key: 'system_command', prefix: omniboxPrefixes?.system_command?.trim().toLowerCase() || 'sc' },
    { key: 'command', prefix: commandPrefix },
  ];

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
  todos: { title: 'Todos', icon: <FaCheckCircle className="w-4 h-4 shrink-0" /> },
  automations: { title: 'Automations', icon: <FiZap className="w-4 h-4 shrink-0" /> },
  notes: { title: 'Notes', icon: <NotesIcon className="w-4 h-4 shrink-0" /> },
  links: { title: 'Links', icon: <FaLink className="w-4 h-4 shrink-0" /> },
  sessions: { title: 'Tab Sessions', icon: <FaLayerGroup className="w-4 h-4 shrink-0" /> },
  snippets: { title: 'Snippets', icon: <FaCode className="w-4 h-4 shrink-0" /> },
  commands: { title: 'Commands', icon: <FaTerminal className="w-4 h-4 shrink-0" /> },
  system_commands: { title: 'System Commands', icon: <FaTerminal className="w-4 h-4 shrink-0" /> },
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
}

const App: React.FC<AppProps> = ({ isOpen, onClose, theme }) => {
  const { theme: appearanceTheme } = useAppearance();
  const hasWallpaper = !!appearanceTheme?.wallpaper?.src;
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearchValue, setDebouncedSearchValue] = useState('');
  const [showSpreadsheet, setShowSpreadsheet] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchValue(searchValue);
    }, 100);
    return () => clearTimeout(handler);
  }, [searchValue]);

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
                id: node.id,
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
          id: n.id || String(Math.random()),
          name: (n.title || '').trim() || n.url,
          url: n.url,
          isBookmark: true,
        }));
        setAllBookmarks(list);
      });
    }

    try {
      const topUrl = (window.top as any)?.location?.href || window.location.href || '';
      const topTitle = (window.top as any)?.document?.title || document.title || 'Untitled Page';
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
          { action: 'tabs_query', queryOptions: { active: true, currentWindow: true } },
          (response: any) => {
            const activeTab = response?.results?.[0];
            if (activeTab) {
              setActiveTabUrl(activeTab.url || '');
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

  const filteredCommands = useMemo(() => {
    if (
      debouncedCommandSpace.isActive &&
      debouncedCommandSpace.activeCategoryFilter &&
      debouncedCommandSpace.activeCategoryFilter !== 'command'
    ) {
      return [];
    }

    // Always separate page-action commands — they must never be sliced away
    const pageActionCmds = allCommands.filter(c => (c as any).category === 'page_action');
    const otherCmds = allCommands.filter(c => (c as any).category !== 'page_action');

    const effectiveSearchValue = debouncedCommandSpace.isActive
      ? debouncedCommandSpace.actualQuery
      : debouncedSearchValue;

    const getCategoryPriority = (c: any) => {
      const cat = (c.category || '').toLowerCase();
      if (cat === 'page_action') return 1;
      if (cat === 'ai' && c.id !== 'ai') return 2;
      if (cat === 'browser') return 3;
      if (c.isGlobal === false) return 4; // Local app commands
      if (cat === 'thissite_action') return 5;
      return 6; // Other global commands
    };

    if (!effectiveSearchValue.trim()) {
      const sortedCmds = [...pageActionCmds, ...otherCmds].sort((a, b) => {
        return getCategoryPriority(a) - getCategoryPriority(b);
      });

      return sortedCmds.slice(0, 40);
    }

    const lower = effectiveSearchValue.toLowerCase();
    const core = lower.replace(/^\//, '');

    // Match page-action items against label, prefix, id AND keywords
    const matchedPageActions = pageActionCmds.filter(
      c =>
        c.label.toLowerCase().includes(core) ||
        c.prefix.toLowerCase().includes(core) ||
        String(c.id).toLowerCase().includes(core) ||
        (THIS_SECTION_ACTION_PREFIXES[c.id]?.toLowerCase().startsWith(core) ?? false) ||
        ((c as any).keywords as string[] | undefined)?.some((kw: string) => kw.toLowerCase().includes(core)),
    );

    const matchedOthers = otherCmds.filter(
      c =>
        c.id !== 'ai' &&
        (c.label.toLowerCase().includes(core) ||
          c.prefix.toLowerCase().includes(core) ||
          String(c.id).toLowerCase().includes(core)),
    );

    const matchedAll = [...matchedPageActions, ...matchedOthers].sort((a, b) => {
      return getCategoryPriority(a) - getCategoryPriority(b);
    });

    return matchedAll.slice(0, 40);
  }, [allCommands, debouncedSearchValue, debouncedCommandSpace]);

  const filtered = useMemo(() => {
    const { atDropdown, activeSection, searchQuery } = debouncedCommandSpace.isActive
      ? { atDropdown: false, activeSection: null, searchQuery: debouncedSearchValue }
      : parseAtMode(debouncedSearchValue);

    // When a section is activated via /ALIAS+Space, use searchQuery for filtering
    // When normal search, use searchValue directly
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
    // Keep 'filter' as an alias so call-sites below don't need renaming
    const filter = fuzzyFilter;

    const allSnippets = safeList(snippets);
    const actualSnippets = allSnippets.filter(s => (s.category || '').toLowerCase() !== 'prompt');
    const actualPrompts = allSnippets.filter(s => (s.category || '').toLowerCase() === 'prompt');
    const allSessions = safeList(dbSessions);

    const activeDomain = getDomain(activeTabUrl);
    const activeNormalized = normalizeUrl(activeTabUrl);

    // Detect AI chat sites
    const isChatSite =
      activeDomain &&
      ['chatgpt.com', 'claude.ai', 'gemini.google.com', 'chat.openai.com', 'perplexity.ai'].some(domain =>
        activeDomain.includes(domain),
      );

    // Use raw links (not filtered) so saved-state is NEVER affected by search input.
    const allRawLinks = safeList(links);
    const filteredLinks = filter(allRawLinks);

    // isAlreadySaved is computed against the full raw link list, independent of search.
    const isAlreadySaved = !!(
      activeNormalized &&
      (optimisticSavedUrls.some(u => normalizeUrl(u) === activeNormalized) ||
        allRawLinks.some(link => {
          const urls = [...extractUrlsFromSnippet(link), ...(link.urls || []).map((u: any) => u.url || u)];
          return urls.some((u: string) => normalizeUrl(u) === activeNormalized);
        }))
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
        icon: <FaLayerGroup className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" />,
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
        icon: <FaLayerGroup className="w-4 h-4 shrink-0 text-gray-400" />,
      });
      // Directly include page action extraction commands under "This Site"
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
        category: 'page_action',
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
      const matchThisSiteItems = (items: any[]) => {
        if (!commandQuery.trim()) return items;
        const lower = commandQuery.toLowerCase();
        return items.filter(
          item =>
            item.name.toLowerCase().includes(lower) ||
            (THIS_SECTION_ACTION_PREFIXES[item.id]?.toLowerCase().startsWith(lower) ?? false),
        );
      };

      const emptyResult = {
        thissite: [] as any[],
        automations: [] as any[],
        notes: [] as any[],
        todos: [] as any[],
        links: [] as any[],
        snippets: [] as any[],
        prompts: [] as any[],
        sessions: [] as any[],
        bookmarks: [] as any[],
        commands: [] as any[],
        system_commands: [] as any[],
      };

      switch (debouncedCommandSpace.activeCategoryFilter) {
        case 'note':
          return { ...emptyResult, notes: filter(safeList(notes), commandQuery).slice(0, 30) };
        case 'link':
          return { ...emptyResult, links: filter(allRawLinks, commandQuery).slice(0, 30) };
        case 'snippet':
          return { ...emptyResult, snippets: filter(actualSnippets, commandQuery).slice(0, 30) };
        case 'session':
          return { ...emptyResult, sessions: filter(allSessions, commandQuery).slice(0, 30) };
        case 'prompt':
          return { ...emptyResult, prompts: filter(actualPrompts, commandQuery).slice(0, 30) };
        case 'automation':
          return { ...emptyResult, automations: filter(safeList(automations), commandQuery).slice(0, 30) };
        case 'agent':
          return emptyResult;
        case 'system_command':
          return {
            ...emptyResult,
            system_commands: filter(allCommands, commandQuery).slice(0, 40),
          };
        case 'command':
          return {
            ...emptyResult,
            thissite: matchThisSiteItems(visibleThisSiteItems),
            commands: filteredCommands,
          };
        default:
          return {
            ...emptyResult,
            thissite: matchThisSiteItems(visibleThisSiteItems),
            commands: filteredCommands,
          };
      }
    }

    if (activeSection && activeSection !== 'all') {
      const emptyResult = {
        thissite: [] as any[],
        automations: [] as any[],
        notes: [] as any[],
        todos: [] as any[],
        links: [] as any[],
        snippets: [] as any[],
        prompts: [] as any[],
        sessions: [] as any[],
        bookmarks: [] as any[],
        commands: [] as any[],
        system_commands: [] as any[],
      };

      switch (activeSection) {
        case 'thissite':
          return {
            ...emptyResult,
            thissite: effectiveSearchValue.trim() ? filter(visibleThisSiteItems, searchQuery) : visibleThisSiteItems,
          };
        case 'todos':
          return {
            ...emptyResult,
            todos: filter(
              safeList(todos).filter(t => !t.is_done),
              searchQuery,
            ).slice(0, 30),
          };
        case 'commands':
          return {
            ...emptyResult,
            commands: filter(allCommands, searchQuery).slice(0, 40),
          };
        case 'system_commands':
          return {
            ...emptyResult,
            system_commands: filter(allCommands, searchQuery).slice(0, 40),
          };
        case 'links':
          return {
            ...emptyResult,
            links: filter(allRawLinks, searchQuery).slice(0, 30),
          };
        case 'notes':
          return {
            ...emptyResult,
            notes: filter(safeList(notes), searchQuery).slice(0, 30),
          };
        case 'sessions':
          return {
            ...emptyResult,
            sessions: filter(allSessions, searchQuery).slice(0, 30),
          };
        case 'automations':
          return {
            ...emptyResult,
            automations: filter(safeList(automations), searchQuery).slice(0, 30),
          };
        case 'bookmarks':
          return {
            ...emptyResult,
            bookmarks: filter(safeList(allBookmarks), searchQuery).slice(0, 30),
          };
        case 'snippets':
          return {
            ...emptyResult,
            snippets: filter(actualSnippets, searchQuery).slice(0, 30),
          };
        case 'prompts':
          return {
            ...emptyResult,
            prompts: filter(actualPrompts, searchQuery).slice(0, 30),
          };
        default:
          return emptyResult;
      }
    }

    return {
      thissite: effectiveSearchValue.trim() ? filter(visibleThisSiteItems) : visibleThisSiteItems,
      automations: filter(safeList(automations)).slice(0, 30),
      notes: filter(safeList(notes)).slice(0, 30),
      todos: filter(safeList(todos).filter(t => !t.is_done)).slice(0, 30),
      links: filteredLinks.slice(0, 30),
      snippets: filter(actualSnippets).slice(0, 30),
      prompts: filter(actualPrompts).slice(0, 30),
      sessions: filter(allSessions).slice(0, 30),
      bookmarks: filter(safeList(allBookmarks)).slice(0, 30),
      commands: filteredCommands,
      system_commands: [],
    };
  }, [
    automations,
    allCommands,
    notes,
    snippets,
    todos,
    links,
    debouncedSearchValue,
    allBookmarks,
    filteredCommands,
    activeTabUrl,
    optimisticSavedUrls,
    isLoggedIn,
    dbSessions,
    debouncedCommandSpace,
  ]);

  const sections = useMemo(() => {
    let currentStart = 0;
    const result: { name: string; start: number; count: number }[] = [];

    // When command-space is active (e.g. "c n "), parseAtMode would mis-read
    // "c" as the 'commands' alias — so skip slash-mode parsing in that case.
    const { activeSection: slashActiveSection, searchQuery } = debouncedCommandSpace.isActive
      ? { activeSection: null, searchQuery: debouncedSearchValue }
      : parseAtMode(debouncedSearchValue);

    // The query that is actually used for filtering content
    const effectiveSearchValue = slashActiveSection !== null ? searchQuery : debouncedSearchValue;

    const addSection = (name: string) => {
      if (result.some(s => s.name === name)) return;
      const itemsLength = filtered[name as keyof typeof filtered]?.length || 0;

      // During search: only show sections that have matching results.
      if (effectiveSearchValue.trim() && itemsLength === 0) {
        return;
      }

      const hasNewButton = name !== 'bookmarks' && name !== 'commands' && name !== 'system_commands';
      // During search, don't add "new" button slot — only real items count
      const count = effectiveSearchValue.trim() ? itemsLength : itemsLength + (hasNewButton ? 1 : 0);

      if (count > 0) {
        result.push({ name, start: currentStart, count });
        currentStart += count;
      }
    };

    const allKeys = [
      'thissite',
      'todos',
      'commands',
      'system_commands',
      'links',
      'notes',
      'sessions',
      'automations',
      'bookmarks',
      'snippets',
      'prompts',
    ];

    if (slashActiveSection && slashActiveSection !== 'all') {
      // /ALIAS+Space mode (e.g. "/N ") — show ONLY that one section
      addSection(slashActiveSection);
    } else if (
      showAllSections ||
      slashActiveSection === 'all' ||
      effectiveSearchValue.trim() ||
      debouncedCommandSpace.isActive
    ) {
      // Normal search, "all" alias, command-space mode — show all sections that have items
      allKeys.forEach(name => addSection(name));
    } else {
      // Empty search, no alias — only show This Site contextual actions
      if ((filtered.thissite?.length || 0) > 0) {
        addSection('thissite');
      }
    }

    return result;
  }, [filtered, showAllSections, debouncedSearchValue, debouncedCommandSpace]);

  const dropdownOptions = useMemo(() => {
    const cleanSearch = debouncedCommandSpace.isActive
      ? debouncedCommandSpace.actualQuery.trim()
      : debouncedSearchValue.startsWith('/')
        ? debouncedSearchValue.slice(1)
        : debouncedSearchValue;
    const filterText = cleanSearch.toLowerCase();

    const baseSiteItems = filtered.thissite || [];

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
  }, [debouncedSearchValue, filtered.thissite, debouncedCommandSpace, omniboxPrefixes]);

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
    chrome.runtime.sendMessage({ type: 'tasklabs:open-create-menu', creatorType: mappedType });
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
      } catch (err) {}

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
        } catch (err) {}
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
          showWebsiteToast(
            `🚀 Tab Session "${sessionName}" started with ${count} tab${count !== 1 ? 's' : ''}`,
            '#10b981',
          );
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

      if (!tabUrl) {
        try {
          tabUrl = (window.top as any)?.location?.href || window.location.href || '';
          tabTitle = (window.top as any)?.document?.title || document.title || 'Untitled Page';
        } catch (_) {}
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
          setAddExistingUrl(url);
          setAddExistingTitle(title);
          setShowAddExistingModal(true);
        } else if (item.id === 'add_to_existing_session') {
          setAddExistingUrl(url);
          setAddExistingTitle(title);
          setShowAddExistingSessionModal(true);
        } else if (item.id === 'summarize_page') {
          // Perform full context scraping and AI dispatching
          const defaultPrompt = 'Summarize the main points, key takeaways, and outline of this page.';

          chrome.runtime.sendMessage({ action: 'scrape_page_content' }, (scrapeRes: any) => {
            const pageContent = scrapeRes?.ok && typeof scrapeRes.content === 'string' ? scrapeRes.content : '';

            const enhancedPrompt = pageContent
              ? `User Question: ${defaultPrompt}

I'm looking at a webpage titled "${title}" (${url}).

Here is the page content for context:
---
${pageContent}
---`
              : `Summarize this page for me: ${url}`;

            chrome.storage.local.get('selectedAIs', (result: any) => {
              const finalIds = ['gpt'];
              const aiFallbacks: Record<string, { url: string; kind: 'chatgpt' | 'claude' | 'gemini' | 'perplexity' }> =
                {
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
                // Fallback to ChatGPT
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
    [handleExecute],
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
            }
          },
        );

        showWebsiteToast('Favorites updated');
        useUIStore.getState().queueNotification({ message: 'Favorites updated', type: 'info' });
      } catch (error) {
        console.error('[AltQ] Failed to update favorites:', error);
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
      filtered.thissite.find((item: any) => item.id === commandSpace.exactThisSectionActionId);

    if (!exactAction) {
      return;
    }

    autoTriggeredThisSectionInputRef.current = normalizedInput;
    setSearchValue('');
    handleExecute((exactAction as any).item || exactAction);
  }, [commandSpace, filtered.thissite, handleExecute]);

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

  if (!isOpen) return null;

  const isDropdownActive = parseAtMode(searchValue).atDropdown;
  const [isExplicitlyExpanded, setIsExplicitlyExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsExplicitlyExpanded(false);
    }
  }, [isOpen]);

  const isExpanded =
    isExplicitlyExpanded ||
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
                ? 'absolute inset-0 rounded-none overflow-hidden border border-[var(--color-borderDefault)] bg-[#171821]'
                : 'relative w-full rounded-xl bg-transparent overflow-visible border-none shadow-none',
            )}
            style={{
              background: isExpanded ? '#171821' : 'transparent',
              opacity: 1,
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
            }}>
            {/* Top Left Branding */}
            {isExpanded && !showSpreadsheet && (
              <div className="absolute top-7 left-8 flex items-center z-50 select-none">
                <img src={cmdOSLogo} alt="cmdOS" className="h-6 w-auto" />
                <span className="text-lg font-bold text-white tracking-wide ml-2">cmdOS</span>
              </div>
            )}

            {/* Top Right Action Buttons */}
            {isExpanded && (
              <div className="absolute top-6 right-6 flex items-center gap-1.5 z-[100]">
                <button
                  onClick={onClose}
                  className="w-9 h-9 flex items-center justify-center bg-transparent hover:bg-white/5 text-neutral-500 hover:text-neutral-300 transition-colors rounded-lg cursor-pointer focus:outline-none"
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
                  isExpanded ? 'w-[50%] bg-[var(--color-inputBg)] backdrop-blur-xl' : 'w-full bg-[#171821] shadow-2xl',
                  isDropdownVisible &&
                    (dropdownOptions.totalList.length > 0 ||
                      (searchValue.startsWith('/') &&
                        searchValue.trim() !== '' &&
                        !parseAtMode(searchValue).activeSection))
                    ? 'rounded-t-xl'
                    : 'rounded-xl',
                )}>
                <div className="relative flex-1 h-full flex items-center">
                  {(() => {
                    const activeTag =
                      getActiveTagInfo(searchValue, commandSpace.commandPrefix) ||
                      (searchValue.trim() === '' ? getSidebarSectionTagInfo(selectedSidebarSection) : null);
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
                                setSearchValue('');
                                setSelectedSidebarSection('all');
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
                                    setDropdownSelectedIndex(-1);
                                    setIsDropdownVisible(false);
                                  } else {
                                    setSelectedSidebarSection(chosen.id);
                                    const alias = SECTION_ALIAS_DISPLAY[chosen.id];
                                    const newSearchValue =
                                      chosen.id === 'all' || !alias ? '' : `/${alias.toLowerCase()} `;
                                    setSearchValue(newSearchValue);
                                    setDropdownSelectedIndex(-1);
                                    setIsDropdownVisible(false);
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
                          placeholder="Type to search"
                          className="flex-1 min-w-0 bg-transparent border-none text-[16px] min-[1680px]:text-[18px] min-[1880px]:text-[20px] font-medium caret-white placeholder-[var(--color-textPlaceholder)] focus:outline-none focus:ring-0 h-full z-10 text-[var(--color-textPrimary)]"
                        />
                      );
                    }

                    return (
                      <div className="flex-1 flex items-center h-full">
                        <div className="flex items-center gap-1.5 mr-2 bg-[#eee8d5]/10 dark:bg-white/10 border border-[#eee8d5]/20 dark:border-white/20 rounded-lg px-2.5 py-0.5 shadow-sm text-white select-none">
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
                              setSearchValue('');
                              setSelectedSidebarSection('all');
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
                                    setIsDropdownVisible(false);
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
                      !parseAtMode(searchValue).activeSection)) && (
                    <div
                      className={clsx(
                        'absolute top-[100%] left-0 w-full border border-[var(--color-borderDefault)] rounded-b-xl shadow-2xl z-[70] overflow-hidden flex flex-col pt-0 pb-2 max-h-[360px] overflow-y-auto custom-scrollbar group/sidebar',
                        isExpanded ? 'bg-[var(--color-containerBg)] backdrop-blur-xl' : 'bg-[#171821]',
                      )}>
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
                        const DROPDOWN_ITEM_SELECTED_CLASS = 'bg-white/10 text-white shadow-md border border-white/10';
                        const DROPDOWN_ITEM_UNSELECTED_CLASS =
                          'bg-transparent text-[#d1d5db] hover:bg-white/5 hover:text-white border border-transparent';
                        const DROPDOWN_ITEM_LABEL_CLASS = 'truncate';
                        const DROPDOWN_ITEM_SHORTCUT_CLASS =
                          'ml-auto flex items-center justify-center gap-1 px-1.5 py-0 rounded border border-white/5 bg-white/5 text-[13px] font-light font-mono text-[var(--color-textPrimary)] opacity-70 select-none lowercase';

                        const DropdownSectionHeader = ({ title }: { title: string }) => (
                          <div className="text-[10px] font-bold tracking-[0.08em] text-[#8b949e] px-4 py-1 mt-1">
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
                                    <DropdownSectionHeader title=" Save as Commands (Current tab)" />
                                    {dropdownOptions.siteCommandActions.map((opt: any, idx: number) => {
                                      const globalIdx = idx;
                                      const isSelected = dropdownSelectedIndex === globalIdx;
                                      const allowContextMenu = opt.id !== 'saved_indicator';
                                      const icon =
                                        PAGE_ACTION_ICONS[opt.id] ||
                                        (opt.id === 'save_link' ? (
                                          <FaLink className="w-4 h-4 shrink-0 text-current opacity-80" />
                                        ) : opt.id === 'save_session' ? (
                                          <FaLayerGroup className="w-4 h-4 shrink-0 text-current opacity-80" />
                                        ) : opt.id === 'saved_indicator' ? (
                                          <FaCheck className="w-4 h-4 shrink-0 text-current opacity-80" />
                                        ) : opt.id === 'add_to_existing' ? (
                                          <FaLink className="w-4 h-4 shrink-0 text-current opacity-80" />
                                        ) : opt.id === 'add_to_existing_session' ? (
                                          <FaLayerGroup className="w-4 h-4 shrink-0 text-current opacity-80" />
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
                                          onPointerDown={e => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            executeDropdownItem(opt.item);
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
                                          <FaLayerGroup className="w-4 h-4 shrink-0 text-current opacity-80" />
                                        ) : opt.id === 'saved_indicator' ? (
                                          <FaCheck className="w-4 h-4 shrink-0 text-current opacity-80" />
                                        ) : opt.id === 'add_to_existing' ? (
                                          <FaLink className="w-4 h-4 shrink-0 text-current opacity-80" />
                                        ) : opt.id === 'add_to_existing_session' ? (
                                          <FaLayerGroup className="w-4 h-4 shrink-0 text-current opacity-80" />
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
                                          onPointerDown={e => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            executeDropdownItem(opt.item);
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
                                          setIsExplicitlyExpanded(true);
                                          const alias = SECTION_ALIAS_DISPLAY[optName];
                                          const newSearchValue =
                                            optName === 'all' || !alias ? '' : `/${alias.toLowerCase()} `;
                                          setSearchValue(newSearchValue);
                                          setDropdownSelectedIndex(-1);
                                          setIsDropdownVisible(false);
                                        }}
                                        onClick={e => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setSelectedSidebarSection(optName);
                                          setIsExplicitlyExpanded(true);
                                          const alias = SECTION_ALIAS_DISPLAY[optName];
                                          const newSearchValue =
                                            optName === 'all' || !alias ? '' : `/${alias.toLowerCase()} `;
                                          setSearchValue(newSearchValue);
                                          setDropdownSelectedIndex(-1);
                                          setIsDropdownVisible(false);
                                        }}
                                        onMouseDown={e => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setSelectedSidebarSection(optName);
                                          setIsExplicitlyExpanded(true);
                                          const alias = SECTION_ALIAS_DISPLAY[optName];
                                          const newSearchValue =
                                            optName === 'all' || !alias ? '' : `/${alias.toLowerCase()} `;
                                          setSearchValue(newSearchValue);
                                          setDropdownSelectedIndex(-1);
                                          setIsDropdownVisible(false);
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
                  (searchValue.startsWith('/') && searchValue.trim() !== '' && !parseAtMode(searchValue).activeSection))
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
                        suggestions: [
                          ...filtered.todos.map(t => ({ ...t, _kind: 'todo', type: 'todo' })),
                          ...filtered.notes.map(n => ({ ...n, _kind: 'note', type: 'note', note: n })),
                          ...filtered.links.map(l => ({ ...l, _kind: 'link', type: 'link' })),
                          ...filtered.sessions.map((s: any) => ({
                            ...s,
                            _kind: 'session',
                            type: 'session',
                            session: s,
                            data: s,
                            category: 'session',
                          })),
                          ...filtered.snippets.map(s => ({ ...s, _kind: 'snippet', type: 'snippet', snippet: s })),
                          ...filtered.commands.map(c => ({ ...c, _kind: 'command', command: c })),
                          ...filtered.system_commands.map((c: any) => ({ ...c, _kind: 'command', command: c })),
                          ...filtered.automations.map(a => ({
                            ...a,
                            _kind: 'automation',
                            type: 'automation',
                            automation: a,
                          })),
                          ...filtered.bookmarks.map(b => ({ ...b, _kind: 'bookmark', type: 'bookmark' })),
                          ...filtered.prompts.map(p => ({ ...p, _kind: 'prompt', type: 'prompt', prompt: p })),
                        ],
                        highlightIndex: 0,
                        mode: 'mixed',
                        onQueryChange: (val: string) => {
                          updateSearchValue(val);
                        },
                        onSnippetSelect: (item: any) => handleExecute(item),
                        onCommonCommandSelect: (item: any) => handleExecute(item),
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
                        items: filtered.thissite,
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
                (searchValue.startsWith('/') && searchValue.trim() !== '' && !parseAtMode(searchValue).activeSection)
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
                    onClick={async () => {
                      try {
                        const currentUrls = linkItem.urls || [];
                        const response: any = await new Promise(resolve => {
                          chrome.runtime.sendMessage(
                            {
                              action: 'db_update_link',
                              linkId: linkItem.id,
                              input: {
                                urls: [
                                  ...currentUrls,
                                  {
                                    id: 'link_item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                                    title: addExistingTitle,
                                    url: addExistingUrl,
                                  },
                                ],
                              },
                            },
                            resolve,
                          );
                        });
                        if (response && !response.success) {
                          throw new Error(response.error || 'Failed to update link via background');
                        }
                        syncDbFromBackground();
                        setShowAddExistingModal(false);

                        // Show success toast
                        showWebsiteToast(`Added to "${linkItem.title}" successfully`);
                        useUIStore.getState().queueNotification({
                          message: `Added to "${linkItem.title}" successfully`,
                          type: 'success',
                        });
                      } catch (err) {
                        console.error('Failed to add url to existing link:', err);
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
                    onClick={async () => {
                      try {
                        const currentUrls = sessionItem.urls || [];
                        const response: any = await new Promise(resolve => {
                          chrome.runtime.sendMessage(
                            {
                              action: 'db_update_session',
                              sessionId: sessionItem.id,
                              input: {
                                urls: [
                                  ...currentUrls,
                                  {
                                    id: 'link_item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                                    title: addExistingTitle,
                                    url: addExistingUrl,
                                  },
                                ],
                              },
                            },
                            resolve,
                          );
                        });
                        if (response && !response.success) {
                          throw new Error(response.error || 'Failed to update session via background');
                        }
                        syncDbFromBackground();
                        setShowAddExistingSessionModal(false);

                        // Show success toast
                        showWebsiteToast(`Added to "${sessionItem.title}" successfully`);
                        useUIStore.getState().queueNotification({
                          message: `Added to "${sessionItem.title}" successfully`,
                          type: 'success',
                        });
                      } catch (err) {
                        console.error('Failed to add url to existing session:', err);
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
      <NotificationContainer />
    </AnimatePresence>
  );
};

export default App;
