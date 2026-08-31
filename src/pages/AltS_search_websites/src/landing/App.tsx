import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAppData } from '../hooks/useAppData';
import { useAppearance } from '@extension/ui';
import {
  FiZap,
  FiPlus,
  FiTerminal,
  FiFileText,
  FiSend,
  FiSearch,
} from 'react-icons/fi';
import { BsCalendarCheck } from 'react-icons/bs';
import {
  FaCode,
  FaLink,
  FaCheckCircle,
  FaCheck,
  FaRegFileAlt,
  FaLayerGroup,
  FaBookmark,
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
  FaCamera,
  FaCopy,
  FaExpand,
  FaImages,
  FaTable,
  FaObjectGroup,
  FaClone,
  FaVolumeMute,
  FaVolumeUp,
  FaTimes,
} from 'react-icons/fa';
import { stripCmdStatus } from '../../../../shared-components/searchBarMain/utilityFunctions/utils';
import {
  extractUrlsFromSnippet,
} from '../../../../allObjectFolder/src/createObject/snippets/SnippetClickActions';
import { getUserId } from '../../../../storage/API/core/api';
import { SHARED_ALL_COMMANDS, THIS_SECTION_ACTION_PREFIXES } from '../../../../shared-components/commands';
import { extractSnippetIdFromCompoundId, getItemCompoundId } from '../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import cmdOSLogo from '../../../../shared-components/assets/cmdOS_logo.png';
import { useUIStore } from '../../../../shared-components/uiStateManager';
import { launchSessionSmart } from '../../../../shared-components/sessions/launchSessionSmart';



import { useDbStore } from '../../../../storage/store/useDbStore';
import { resolveEntityById } from '../../../../shared-components/utils/entityResolver';
import { runAiPrompt } from '../../../../allObjectFolder/src/createObject/aiPrompt/runAiPrompt';
import type { AiPromptRecord } from '../../../../allObjectFolder/src/createObject/aiPrompt/aiPromptTypes';
import type { ChatAgentRecord } from '../../../../allObjectFolder/src/createObject/ChatAgent/chatAgentTypes';
import type { NoteRecord } from '../../../../allObjectFolder/src/createObject/notes/noteTypes';
import type { LinkRecord } from '../../../../allObjectFolder/src/createObject/links/linkTypes';
import type { SnippetRecord } from '../../../../allObjectFolder/src/createObject/snippets/snippetTypes';
import type { TodoRecord } from '../../../../allObjectFolder/src/createObject/todos/todoTypes';
import { extractTextFromHTML } from '../../../../allObjectFolder/src/createObject/notes/noteHelpers';
import { NewDueDateDropdown } from '../../../../allObjectFolder/src/createObject/todos/ui/newDueDateDropdown';
import { parseDueDateInput } from '../../../../allObjectFolder/src/createObject/todos/utils/dueDateParser';

import { LuSparkles } from 'react-icons/lu';
import { PAGE_ACTION_ITEMS, executePageActionCommand, type AltQPageActionItem } from '../commands/pageActions';
import { CustomSearchPrefixesForOmniboxStorage } from '../../../../storage/localStorage/customSearchPrefixesForOmniboxStorage';
import { useSearchbarSuggestions } from '../../../../shared-components/searchBarMain/keyboardAndUiHooks/useSearchbarSuggestions';
import { createCommandIndex } from '../../../../shared-components/searchBarMain/searchLogicAndAlgorithms/commandSearch';
import { searchAll } from '../../../../shared-components/searchBarMain/searchLogicAndAlgorithms/searchEngine';
import { buildCommonCommandEntries } from '../../../../shared-components/searchBarMain/searchLogicAndAlgorithms/commonResults';
import { extractPlainTextFromSnippetConfig } from '../../../../shared-components/spreadsheetUi/logic/spreadsheetHelpers';
import { EditablePrefixKey } from '../../../../shared-components/shortcuts/ui/EditablePrefixKey';
import StackedLinkIcon from '../../../../shared-components/icons/stackedLinkIcon';
import CreateCollectionDialog, {
  createEmptySessionDraft,
  type CreateCollectionDialogState,
  type CreateSessionDraft,
} from '../../../AltS_search_newtab/src/components/altsNewtabSidebar/CreateCollectionDialog';
import AltSEditorOverlayShell from '../components/AltSEditorOverlayShell';
import { DEFAULT_VIEW_ICON_ID } from '../../../AltS_search_newtab/src/components/altsNewtabSidebar/dashboardViewIcons';
import { WIDGET_CATALOG_CATEGORIES, type WidgetCatalogItem } from '../../../AltS_search_newtab/src/components/widgets/widgetCatalog';
import { FIXED_SESSION_STRIP_SESSION_SETTING_KEY } from '../../../../storage/localStorage/widgetDashboardStorage';
import AltSSubcommandSearch from '../components/subcommands/AltSSubcommandSearch';
import {
  COMPACT_DROPDOWN_ITEM_BASE_CLASS,
  COMPACT_DROPDOWN_ITEM_CONTENT_CLASS,
  COMPACT_DROPDOWN_ITEM_ICON_CLASS,
  COMPACT_DROPDOWN_ITEM_LABEL_CLASS,
  COMPACT_DROPDOWN_ITEM_PRIMARY_CLASS,
  COMPACT_DROPDOWN_ITEM_RIGHT_META_CLASS,
  COMPACT_DROPDOWN_ITEM_SELECTED_CLASS,
  COMPACT_DROPDOWN_ITEM_TEXT_CLASS,
  COMPACT_DROPDOWN_ITEM_UNSELECTED_CLASS,
  CompactDropdownSectionHeader,
  EmptySubmodeState,
  CATEGORY_PREFIX_KEY_BY_OPTION,
  CATEGORY_SUBCOMMAND_BY_NORMALIZED_NAME,
  NormalModeActionRow,
  NormalModeCategoryRow,
  NormalModeResultRow,
  getIconTileCategory,
} from '../components/normalMode/NormalModeDropdownPrimitives';
import { useShortcutValidation } from '../../../../shared-components/shortcuts';
import { useHotkeyValidation } from '../../../../shared-components/hotkeys';
import { normalizeHotkeyString } from '../../../../shared-components/hotkeys/core/eventParser';
import { generateEntityId } from '../../../../shared-components/utils/idGenerator';
import {
  buildShortcutPrefixRegistry,
  getCommandSpacePrefix,
  getQuickCreatePrefixLabels,
  getNoteQuickCreatePrefixLabels,
  matchesShortcutCategory,
  parseNoteQuickCreateFields,
  parseTodoQuickCreateFields,
  parseShortcutInvocation,
  recordAssignedTriggerUsage,
} from '../../../../shared-components/triggers';
import { normalizeShortcutTrigger } from '../../../../shared-components/shortcuts/core/shortcutDbData';
import type { CategorySubcommandItem } from '../state/altSCommandTypes';
import { useAltSCommandStore } from '../state/useAltSCommandStore';

let linkEditorViewPromise: Promise<typeof import('../../../../allObjectFolder/src/createObject/links/ui/LinkEditorView')> | null = null;
let createTodoViewPromise: Promise<typeof import('../../../../allObjectFolder/src/createObject/todos/ui/CreateTodoView')> | null = null;
let noteEditorViewPromise: Promise<typeof import('../../../../allObjectFolder/src/createObject/notes/ui/NoteEditorView')> | null = null;
let snippetEditorViewPromise: Promise<typeof import('../../../../allObjectFolder/src/createObject/snippets/SnippetEditorScreen')> | null = null;
let aiPromptEditorViewPromise: Promise<typeof import('../../../../allObjectFolder/src/createObject/aiPrompt/ui/AiPromptEditorView')> | null = null;

const preloadLinkEditorView = () => {
  linkEditorViewPromise ||= import('../../../../allObjectFolder/src/createObject/links/ui/LinkEditorView');
  return linkEditorViewPromise;
};

const preloadCreateTodoView = () => {
  createTodoViewPromise ||= import('../../../../allObjectFolder/src/createObject/todos/ui/CreateTodoView');
  return createTodoViewPromise;
};

const preloadNoteEditorView = () => {
  noteEditorViewPromise ||= import('../../../../allObjectFolder/src/createObject/notes/ui/NoteEditorView');
  return noteEditorViewPromise;
};

const preloadSnippetEditorView = () => {
  snippetEditorViewPromise ||= import('../../../../allObjectFolder/src/createObject/snippets/SnippetEditorScreen');
  return snippetEditorViewPromise;
};

const preloadAiPromptEditorView = () => {
  aiPromptEditorViewPromise ||= import('../../../../allObjectFolder/src/createObject/aiPrompt/ui/AiPromptEditorView');
  return aiPromptEditorViewPromise;
};

const LinkEditorView = React.lazy(preloadLinkEditorView);
const CreateTodoView = React.lazy(preloadCreateTodoView);
const NoteEditorView = React.lazy(() =>
  preloadNoteEditorView().then(module => ({ default: module.NoteEditorView })),
);
const SnippetEditorScreen = React.lazy(() =>
  preloadSnippetEditorView().then(module => ({ default: module.EditSnippetScreen })),
);
const AiPromptEditorView = React.lazy(() =>
  preloadAiPromptEditorView().then(module => ({ default: module.AiPromptEditorView })),
);

let altSEditorPreloadScheduled = false;

const scheduleAltSEditorPreload = () => {
  if (altSEditorPreloadScheduled || typeof window === 'undefined') return;
  altSEditorPreloadScheduled = true;
  const run = () => {
    void preloadLinkEditorView();
    void preloadCreateTodoView();
    void preloadNoteEditorView();
    void preloadSnippetEditorView();
    void preloadAiPromptEditorView();
  };
  const requestIdle = (window as any).requestIdleCallback;
  if (typeof requestIdle === 'function') {
    requestIdle(run, { timeout: 1500 });
  } else {
    window.setTimeout(run, 250);
  }
};

scheduleAltSEditorPreload();

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
  ai: <LuSparkles size={22} className="text-[var(--color-iconDefault)] object-contain" />,
};

// Icons for page-action commands (screenshot / download)
const PAGE_ACTION_ICONS: Record<string, React.ReactNode> = {
  capture_screenshot: <FaCamera size={14} className="text-current" />,
  capture_clip_screenshot: <FaCopy size={14} className="text-current" />,
  capture_full_screenshot: <FaExpand size={14} className="text-current" />,
  downloadallimages: <FaImages size={14} className="text-current" />,
  downloadalltables: <FaTable size={14} className="text-current" />,
  merge_windows: <FaObjectGroup size={14} className="text-current" />,
  close_duplicate_tabs: <FaClone size={14} className="text-current" />,
  mute_all_tabs: <FaVolumeMute size={14} className="text-current" />,
  unmute_all_tabs: <FaVolumeUp size={14} className="text-current" />,
};

const getDefaultWidgetSettings = (type: string | undefined) =>
  type === 'link-library' ||
  type === 'ai-prompt-library' ||
  type === 'snippet-library' ||
  type === 'note-library'
    ? {
        sourceMode: 'all' as const,
        selectedCollectionIds: [],
        selectedPromptIds: [],
        selectedSnippetIds: [],
        selectedNoteIds: [],
        selectedTagIds: [],
        tagMatchMode: 'any' as const,
        sortBy: 'saved-order' as const,
        enableSearch: false,
      }
    : {};

// Alias map: alias (uppercase) to section name
const SECTION_ALIASES: Record<string, string> = {
  A: 'all',
  TS: 'thissite',
  T: 'todos',
  C: 'commands',
  L: 'links',
  N: 'notes',
  AU: 'automations',
  CO: 'sessions',
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
  s: 'Collections',
  co: 'Collections',
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
    session: 'Collections',
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
      if (!(key in categoryToLabel)) continue;
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
      if (!(key in categoryToLabel)) continue;
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
    session: 'Collections',
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
      if (!(key in categoryToLabel)) continue;
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
      if (!(key in categoryToLabel)) continue;
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
  | 'collection'
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

const escapeHtml = (value: string): string =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildAltSPageLinkHtml = (target: { url: string; title: string }): string => {
  const url = String(target.url || '').trim();
  const label = String(target.title || target.url || 'Saved page').trim();
  if (!url) return '';
  return `<p><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a></p>`;
};

const buildQuickCreateNoteBodyHtml = (description: string): string => {
  const lines = String(description || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  return lines.map(line => `<p>${escapeHtml(line)}</p>`).join('');
};

const isExtractionCommandItem = (item: any): boolean => item?.category === 'page_action';

/** Build a { actionId -> prefix } map from current omniboxPrefixes (falls back to empty string). */
const getActionPrefixMap = (omniboxPrefixes: any): Record<string, string> => {
  const map: Record<string, string> = {};
  map['capture_screenshot'] = omniboxPrefixes?.capture_screenshot || 'visiblescreen';
  map['capture_clip_screenshot'] = omniboxPrefixes?.capture_clip_screenshot || 'screen';
  map['capture_full_screenshot'] = omniboxPrefixes?.capture_full_screenshot || 'fullscreen';
  map['downloadallimages'] = omniboxPrefixes?.downloadallimages || 'dp';
  map['downloadalltables'] = omniboxPrefixes?.downloadalltables || 'tables';
  map['save_link'] = omniboxPrefixes?.save_link || 'ls';
  map['save_todo'] = omniboxPrefixes?.save_todo || 'td';
  map['save_note'] = omniboxPrefixes?.save_note || 'cn';
  map['save_snippet'] = omniboxPrefixes?.save_snippet || 'cs';
  map['save_chat'] = omniboxPrefixes?.save_chat || 'save_agent';
  map['add_to_existing'] = omniboxPrefixes?.add_to_existing || 'elc';
  map['send_to_agent'] = omniboxPrefixes?.send_to_agent || 'send_agent';
  map['summarize_page'] = omniboxPrefixes?.summarize_page || 'summ';
  map['capture_element_screenshot'] = omniboxPrefixes?.capture_element_screenshot || 'element';
  map['merge_windows'] = omniboxPrefixes?.merge_windows || 'merge';
  map['close_duplicate_tabs'] = omniboxPrefixes?.close_duplicate_tabs || 'duplicate';
  map['mute_all_tabs'] = omniboxPrefixes?.mute_all_tabs || 'mute';
  map['unmute_all_tabs'] = omniboxPrefixes?.unmute_all_tabs || 'unmute';
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
    'collection',
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
  if (!nestedPrefixes.some(entry => entry.prefix === 'ca')) {
    nestedPrefixes.push({ key: 'agent', prefix: 'ca' });
  }

  let activeCategoryFilter: WebsiteCommandSpaceCategory | null = null;
  let actualQuery = queryAfterCommand.trim();

  for (const { key, prefix } of nestedPrefixes) {
    if (queryAfterCommandLower.startsWith(`${prefix} `)) {
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
  sessions: { title: 'Collections', icon: <FaLayerGroup className="w-4 h-4 shrink-0" /> },
  snippets: { title: 'Text Expanders', icon: <FaCode className="w-4 h-4 shrink-0" /> },
  bookmarks: { title: 'Bookmarks', icon: <FaBookmark className="w-4 h-4 shrink-0" /> },
  commands: { title: 'Commands', icon: <FiTerminal className="w-4 h-4 shrink-0" /> },
  system_commands: { title: 'System Commands', icon: <FiTerminal className="w-4 h-4 shrink-0" /> },
  chat_agents: { title: 'Chat Agents', icon: <LuSparkles className="w-4 h-4 shrink-0" /> },
};

const isSupportedAiChatSaveUrl = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    const path = url.pathname;

    if (host === 'chatgpt.com' || host.endsWith('.chatgpt.com') || host === 'chat.openai.com') {
      return /^\/c\/[^/]+/.test(path);
    }
    if (host === 'claude.ai' || host.endsWith('.claude.ai')) {
      return /^\/chat\/[^/]+/.test(path);
    }
    if (host === 'gemini.google.com' || host.endsWith('.gemini.google.com')) {
      return /^\/app\/[^/]+/.test(path);
    }
    if (host === 'perplexity.ai' || host === 'www.perplexity.ai' || host.endsWith('.perplexity.ai')) {
      return /^\/search\/[^/]+/.test(path);
    }
  } catch {
    return false;
  }
  return false;
};

const DROPDOWN_SECTION_HEADER_CLASS = 'mx-2 px-1 py-0.5 flex items-center justify-between mt-1';
const DROPDOWN_SECTION_HEADER_TEXT_CLASS = 'text-[14px] font-semibold text-[#A1A6B3] tracking-tight';
const DROPDOWN_ITEM_BASE_CLASS =
  'w-full appearance-none border-0 bg-transparent px-4 py-2 flex items-center justify-between cursor-pointer transition-colors mx-2 rounded-lg font-normal text-left group';
const DROPDOWN_ITEM_SELECTED_CLASS = 'bg-[#eee8d5]/50 dark:bg-white/10 text-[var(--color-textPrimary)]';
const DROPDOWN_ITEM_UNSELECTED_CLASS =
  'text-[#A1A6B3] hover:bg-[#eee8d5]/30 dark:hover:bg-white/5 hover:text-[var(--color-textPrimary)]';
const DROPDOWN_ITEM_LABEL_CLASS = 'text-[13.5px] font-semibold truncate';
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

const getTodoDueBadge = (item: any): { text: string; tone: 'overdue' | 'upcoming' } | null => {
  const rawSchedule =
    typeof item?.scheduleTime === 'number' && Number.isFinite(item.scheduleTime)
      ? item.scheduleTime
      : item?.event_deadline
        ? String(item.event_deadline)
        : null;

  if (!rawSchedule || item?.isDone || item?.is_done) return null;

  const dueDate =
    typeof rawSchedule === 'number'
      ? new Date(rawSchedule)
      : new Date(String(rawSchedule).replace(' ', 'T'));

  if (Number.isNaN(dueDate.getTime()) || dueDate.getFullYear() >= 2035) return null;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const hasExplicitTime = typeof rawSchedule === 'number' || String(rawSchedule).includes(':');
  const isOverdue =
    dueDate.getTime() < now.getTime() &&
    (dueDay.getTime() < startOfToday.getTime() || hasExplicitTime);

  const timeText = dueDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const isToday = dueDay.getTime() === startOfToday.getTime();
  const tomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const isTomorrow = dueDay.getTime() === tomorrow.getTime();
  const dateText = isToday
    ? 'Today'
    : isTomorrow
      ? 'Tomorrow'
      : dueDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return {
    text: `${dateText}, ${timeText}`,
    tone: isOverdue ? 'overdue' : 'upcoming',
  };
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

type NormalCompactResultKind =
  | 'site-action'
  | 'category'
  | 'update-note'
  | 'command'
  | 'collection'
  | 'note'
  | 'link'
  | 'snippet'
  | 'todo'
  | 'bookmark'
  | 'prompt';

type NormalCompactResult = CategorySubcommandItem & {
  kind: NormalCompactResultKind;
};

type NormalCompactGroup = {
  id: string;
  title: string;
  items: NormalCompactResult[];
};

type WebsitePopupDbSnapshot = {
  workspaces: any[];
  links: any[];
  notes: any[];
  snippets: any[];
  todos: any[];
  automations: any[];
  chatAgents: any[];
  aiPrompts: any[];
  userShortcuts: any[];
  commands: any[];
  sessions: any[];
  widgets: any[];
  widgetViews: any[];
  prefixSettings: any[];
};

const normalizeWebsiteCategory = (category?: string | null): string => {
  const normalized = String(category || '').trim().toLowerCase();
  if (normalized === 'notes') return 'note';
  if (normalized === 'links') return 'link';
  if (normalized === 'snippets') return 'snippet';
  if (normalized === 'todos') return 'todo';
  if (normalized === 'bookmarks') return 'bookmark';
  if (normalized === 'commands') return 'command';
  if (['session', 'sessions', 'tab session', 'tabgroup', 'collection', 'collections', 'collection_view'].includes(normalized)) {
    return 'session';
  }
  if (['prompt', 'prompts', 'ai_prompt', 'aiprompt'].includes(normalized)) return 'prompt';
  if (['agent', 'agents', 'chat_agent', 'chat_agents'].includes(normalized)) return 'agent';
  return normalized;
};

const getNoteDescription = (item: Pick<NoteRecord, 'body'>): string => {
  return extractTextFromHTML(item.body || '').replace(/\s+/g, ' ').trim();
};

const getSnippetDescription = (item: Pick<SnippetRecord, 'config'>): string => {
  return extractPlainTextFromSnippetConfig(item.config).replace(/\s+/g, ' ').trim();
};

const getTodoDescription = (item: Pick<TodoRecord, 'description'>): string => {
  return extractTextFromHTML(item.description || '').replace(/\s+/g, ' ').trim();
};

const getAiPromptDescription = (item: Pick<AiPromptRecord, 'prompt' | 'rules'>): string => {
  return extractTextFromHTML(item.prompt || item.rules || '').replace(/\s+/g, ' ').trim();
};

const getLinkUrls = (item: Pick<LinkRecord, 'urls'>): string[] =>
  (Array.isArray(item.urls) ? item.urls : [])
    .map((entry: any) => (typeof entry === 'string' ? entry : entry?.url))
    .map((url: any) => String(url || '').trim())
    .filter(Boolean);

const getLinkDomains = (item: Pick<LinkRecord, 'urls'>): string => {
  const domains = getLinkUrls(item)
    .map(url => {
      try {
        const normalized = /^[a-zA-Z]+:\/\//.test(url) ? url : `https://${url}`;
        return new URL(normalized).hostname.replace(/^www\./i, '');
      } catch {
        return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
      }
    })
    .filter(Boolean);

  return Array.from(new Set(domains)).join(', ');
};

const getBookmarkUrl = (item: any): string => String(item?.url || '').trim();

const getBookmarkMeta = (item: any): string => {
  const url = getBookmarkUrl(item);
  const folderPath = String(item?.folderPath || '').trim();
  let domain = '';
  if (url) {
    try {
      const normalized = /^[a-zA-Z]+:\/\//.test(url) ? url : `https://${url}`;
      domain = new URL(normalized).hostname.replace(/^www\./i, '');
    } catch {
      domain = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
    }
  }
  return [domain, folderPath && folderPath !== 'Bookmarks' ? folderPath : ''].filter(Boolean).join(' - ');
};

// ─────────────────────────────────────────────────────────────────────────────

interface AppProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
  initialCommand?: string;
}

const App: React.FC<AppProps> = ({ isOpen, onClose, theme, initialCommand }) => {
  const { theme: appearanceTheme } = useAppearance();
  const altsTone = (appearanceTheme as any)?.isDark === false || theme === 'light' ? 'light' : 'dark';
  const altsPaletteStyle = useMemo(
    () =>
      ({
        '--alts-popup-bg': 'var(--color-altsPopupBg)',
        '--alts-search-bg': 'var(--color-altsSearchBg)',
        '--alts-list-bg': 'var(--color-altsListBg)',
        '--alts-row-hover-bg': 'var(--color-altsRowHoverBg)',
        '--alts-row-selected-bg': 'var(--color-altsRowSelectedBg)',
        '--alts-border-color': 'var(--color-altsBorderColor)',
        '--alts-divider-color': 'var(--color-altsDividerColor)',
        '--alts-focus-color': 'var(--color-altsFocusColor)',
        '--alts-selected-edge': 'var(--color-altsSelectedEdge)',
        '--alts-text-primary': 'var(--color-altsTextPrimary)',
        '--alts-text-secondary': 'var(--color-altsTextSecondary)',
        '--alts-text-section': 'var(--color-altsTextSection)',
        '--alts-text-placeholder': 'var(--color-altsTextPlaceholder)',
        '--alts-icon-color': 'var(--color-altsIconColor)',
        '--alts-icon-selected': 'var(--color-altsIconSelected)',
        '--alts-shortcut-text': 'var(--color-altsShortcutText)',
        '--alts-shortcut-bg': 'var(--color-altsShortcutBg)',
        '--alts-shortcut-border': 'var(--color-altsShortcutBorder)',
        '--alts-icon-tile-save-bg': 'var(--color-altsIconTileSaveBg)',
        '--alts-icon-tile-save-fg': 'var(--color-altsIconTileSaveFg)',
        '--alts-icon-tile-save-selected-bg': 'var(--color-altsIconTileSaveSelectedBg)',
        '--alts-icon-tile-save-selected-fg': 'var(--color-altsIconTileSaveSelectedFg)',
        '--alts-icon-tile-ai-bg': 'var(--color-altsIconTileAiBg)',
        '--alts-icon-tile-ai-fg': 'var(--color-altsIconTileAiFg)',
        '--alts-icon-tile-ai-selected-bg': 'var(--color-altsIconTileAiSelectedBg)',
        '--alts-icon-tile-ai-selected-fg': 'var(--color-altsIconTileAiSelectedFg)',
        '--alts-icon-tile-summarize-bg': 'var(--color-altsIconTileSummarizeBg)',
        '--alts-icon-tile-summarize-fg': 'var(--color-altsIconTileSummarizeFg)',
        '--alts-icon-tile-summarize-selected-bg': 'var(--color-altsIconTileSummarizeSelectedBg)',
        '--alts-icon-tile-summarize-selected-fg': 'var(--color-altsIconTileSummarizeSelectedFg)',
        '--alts-icon-tile-capture-bg': 'var(--color-altsIconTileCaptureBg)',
        '--alts-icon-tile-capture-fg': 'var(--color-altsIconTileCaptureFg)',
        '--alts-icon-tile-capture-selected-bg': 'var(--color-altsIconTileCaptureSelectedBg)',
        '--alts-icon-tile-capture-selected-fg': 'var(--color-altsIconTileCaptureSelectedFg)',
        '--alts-icon-tile-extract-bg': 'var(--color-altsIconTileExtractBg)',
        '--alts-icon-tile-extract-fg': 'var(--color-altsIconTileExtractFg)',
        '--alts-icon-tile-extract-selected-bg': 'var(--color-altsIconTileExtractSelectedBg)',
        '--alts-icon-tile-extract-selected-fg': 'var(--color-altsIconTileExtractSelectedFg)',
        '--alts-icon-tile-action-bg': 'var(--color-altsIconTileActionBg)',
        '--alts-icon-tile-action-fg': 'var(--color-altsIconTileActionFg)',
        '--alts-icon-tile-action-selected-bg': 'var(--color-altsIconTileActionSelectedBg)',
        '--alts-icon-tile-action-selected-fg': 'var(--color-altsIconTileActionSelectedFg)',
        '--alts-scrollbar-thumb': 'var(--color-altsScrollbarThumb)',
        '--alts-scrollbar-thumb-hover': 'var(--color-altsScrollbarThumbHover)',
        '--alts-popup-shadow': 'var(--color-altsPopupShadow)',
        '--alts-scrollbar-track': 'transparent',
        '--alts-input-bg': 'var(--alts-search-bg)',
        '--alts-selected-bg': 'var(--alts-row-selected-bg)',
        '--alts-text-muted': 'var(--alts-text-placeholder)',
        '--alts-icon-fg': 'var(--alts-icon-color)',
        '--alts-focus-ring': 'var(--alts-focus-color)',
        '--alts-border': 'var(--alts-border-color)',
        '--color-editorBg': 'var(--alts-popup-bg)',
        '--color-modalBg': 'var(--alts-popup-bg)',
        '--color-popupBg': 'var(--alts-popup-bg)',
        '--color-contextMenuBg': 'var(--alts-popup-bg)',
        '--color-containerBg': 'var(--alts-popup-bg)',
        '--color-inputBg': 'var(--alts-search-bg)',
        '--color-hoverBg': 'var(--alts-row-hover-bg)',
        '--color-selectedBg': 'var(--alts-row-selected-bg)',
        '--color-borderDefault': 'var(--alts-border-color)',
        '--color-borderActive': 'var(--alts-focus-color)',
        '--color-textPrimary': 'var(--alts-text-primary)',
        '--color-textSecondary': 'var(--alts-text-secondary)',
        '--color-textMuted': 'var(--alts-text-placeholder)',
        '--color-textPlaceholder': 'var(--alts-text-placeholder)',
        '--color-iconDefault': 'var(--alts-icon-color)',
        '--color-focusRing': 'var(--alts-focus-color)',
        '--alts-icon-tile-width': '28px',
        '--alts-icon-tile-height': '28px',
        '--alts-icon-tile-radius': '7px',
        '--alts-icon-size': '15px',
        colorScheme: altsTone,
      }) as React.CSSProperties,
    [altsTone],
  );
  const altsEditorSuspenseFallback = useMemo(
    () => (
      <div className="flex h-full min-h-0 w-full items-center justify-center bg-transparent text-[11px] font-semibold text-[var(--alts-text-placeholder,var(--color-altsTextPlaceholder))]">
        Preparing editor...
      </div>
    ),
    [],
  );
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearchValue, setDebouncedSearchValue] = useState('');

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



  const shouldShowDefaultPopup = (_val: string) => true;

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

  const [, setIsDropdownVisible] = useState(true);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const compactPopupSurfaceRef = useRef<HTMLDivElement | null>(null);
  const compactDropdownRef = useRef<HTMLDivElement | null>(null);

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
  const dropdownSelectedIndex = useAltSCommandStore(state => state.dropdownSelectedIndex);
  const setDropdownSelectedIndex = useAltSCommandStore(state => state.setDropdownSelectedIndex);
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
  const [dashboardWidgets, setDashboardWidgets] = useState<any[]>([]);
  const compactSubcommandMode = useAltSCommandStore(state => state.compactSubcommandMode);
  const setCompactSubcommandMode = useAltSCommandStore(state => state.setCompactSubcommandMode);
  const collectionSearchValue = useAltSCommandStore(state => state.collectionSearchValue);
  const setCollectionSearchValue = useAltSCommandStore(state => state.setCollectionSearchValue);
  const linkSaveSearchValue = useAltSCommandStore(state => state.linkSaveSearchValue);
  const setLinkSaveSearchValue = useAltSCommandStore(state => state.setLinkSaveSearchValue);
  const todoSaveSearchValue = useAltSCommandStore(state => state.todoSaveSearchValue);
  const setTodoSaveSearchValue = useAltSCommandStore(state => state.setTodoSaveSearchValue);
  const noteSaveSearchValue = useAltSCommandStore(state => state.noteSaveSearchValue);
  const setNoteSaveSearchValue = useAltSCommandStore(state => state.setNoteSaveSearchValue);
  const snippetSaveSearchValue = useAltSCommandStore(state => state.snippetSaveSearchValue);
  const setSnippetSaveSearchValue = useAltSCommandStore(state => state.setSnippetSaveSearchValue);
  const agentSearchValue = useAltSCommandStore(state => state.agentSearchValue);
  const setAgentSearchValue = useAltSCommandStore(state => state.setAgentSearchValue);
  const categorySearchValue = useAltSCommandStore(state => state.categorySearchValue);
  const setCategorySearchValue = useAltSCommandStore(state => state.setCategorySearchValue);
  const existingCollectionTarget = useAltSCommandStore(state => state.existingCollectionTarget);
  const linkSaveTarget = useAltSCommandStore(state => state.linkSaveTarget);
  const todoSaveTarget = useAltSCommandStore(state => state.todoSaveTarget);
  const noteSaveTarget = useAltSCommandStore(state => state.noteSaveTarget);
  const snippetSaveTarget = useAltSCommandStore(state => state.snippetSaveTarget);
  const sendToAgentTarget = useAltSCommandStore(state => state.sendToAgentTarget);
  const overlayMode = useAltSCommandStore(state => state.overlayMode);
  const linkEditorTarget = useAltSCommandStore(state => state.linkEditorTarget);
  const todoEditorTarget = useAltSCommandStore(state => state.todoEditorTarget);
  const noteEditorTarget = useAltSCommandStore(state => state.noteEditorTarget);
  const snippetEditorTarget = useAltSCommandStore(state => state.snippetEditorTarget);
  const aiPromptEditorTarget = useAltSCommandStore(state => state.aiPromptEditorTarget);
  const openSubcommandMode = useAltSCommandStore(state => state.openSubcommandMode);
  const openLinkEditorOverlay = useAltSCommandStore(state => state.openLinkEditorOverlay);
  const openTodoEditorOverlay = useAltSCommandStore(state => state.openTodoEditorOverlay);
  const openNoteEditorOverlay = useAltSCommandStore(state => state.openNoteEditorOverlay);
  const openSnippetEditorOverlay = useAltSCommandStore(state => state.openSnippetEditorOverlay);
  const openAiPromptEditorOverlay = useAltSCommandStore(state => state.openAiPromptEditorOverlay);
  const closeOverlayToPreviousSubcommand = useAltSCommandStore(state => state.closeOverlayToPreviousSubcommand);
  const completeOverlay = useAltSCommandStore(state => state.completeOverlay);
  const resetSubcommandMode = useAltSCommandStore(state => state.resetSubcommandMode);

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

  const appData = useAppData();
  const [popupDbSnapshot, setPopupDbSnapshot] = useState<WebsitePopupDbSnapshot | null>(null);
  const safeList = (list: any) => (Array.isArray(list) ? list : []);
  const selectedTeam = useUIStore((s: any) => s.selectedTeam) as any;
  const storeWorkspaces = useDbStore(state => state.workspaces);
  const storeSessions = useDbStore(state => state.sessions);
  const storeWidgetViews = useDbStore(state => state.widgetViews);
  const storeChatAgents = useDbStore(state => state.chatAgents);
  const storeAiPrompts = useDbStore(state => state.aiPrompts);
  const storeUserShortcuts = useDbStore(state => state.userShortcuts);
  const storeCommands = useDbStore(state => state.commands);
  const storePrefixSettings = useDbStore(state => state.prefixSettings);
  const automations = popupDbSnapshot?.automations ?? appData.automations;
  const notes = popupDbSnapshot?.notes ?? appData.notes;
  const snippets = popupDbSnapshot?.snippets ?? appData.snippets;
  const todos = popupDbSnapshot?.todos ?? appData.todos;
  const links = popupDbSnapshot?.links ?? appData.links;
  const toggleTodoOptimistic = appData.toggleTodoOptimistic;
  const allWorkspaces = popupDbSnapshot?.workspaces ?? storeWorkspaces;
  const dbSessions = popupDbSnapshot?.sessions ?? storeSessions;
  const dbWidgetViews = popupDbSnapshot?.widgetViews ?? storeWidgetViews;
  const dbChatAgents = popupDbSnapshot?.chatAgents ?? storeChatAgents;
  const dbAiPrompts = popupDbSnapshot?.aiPrompts ?? storeAiPrompts;
  const userShortcuts = popupDbSnapshot?.userShortcuts ?? storeUserShortcuts;
  const commandRecords = popupDbSnapshot?.commands ?? storeCommands;
  const prefixSettings = popupDbSnapshot?.prefixSettings ?? storePrefixSettings;
  const commands = useMemo(() => {
    const baseCommandsById = new Map((SHARED_ALL_COMMANDS as any[]).map(command => [command.id, command]));
    return safeList(commandRecords).map((record: any) => ({
      ...(baseCommandsById.get(record.id) || {}),
      ...record,
      label: record.label || baseCommandsById.get(record.id)?.label || record.id,
      prefix: record.prefix ?? baseCommandsById.get(record.id)?.prefix ?? '',
      keywords:
        record.keywords ||
        baseCommandsById.get(record.id)?.keywords ||
        [record.id, record.label, record.prefix].filter(Boolean),
    }));
  }, [commandRecords]);
  const altsConvertibleItems = useMemo(() => {
    const items: any[] = [];

    safeList(notes).forEach((note: any) => {
      items.push({
        id: note.id,
        name: note.title || note.name || 'Untitled Note',
        category: 'note',
        data: note,
      });
    });

    safeList(snippets).forEach((snippet: any) => {
      if (snippet.is_todo_type || snippet.category === 'task') return;
      items.push({
        id: snippet.id,
        name: snippet.key || snippet.title || snippet.name || 'Untitled Snippet',
        category: snippet.category || 'snippet',
        data: snippet,
      });
    });

    safeList(links).forEach((link: any) => {
      items.push({
        id: link.id,
        name: link.title || link.name || link.key || 'Untitled Link',
        category: 'link',
        data: link,
      });
    });

    safeList(commands).forEach((command: any) => {
      items.push({
        id: `cmd-${command.id}`,
        name: command.label || command.prefix || 'Untitled Command',
        category: 'command',
        data: { ...command, key: command.label || command.prefix, value: command.id },
      });
    });

    safeList(automations).forEach((automation: any) => {
      const steps = automation.automation_steps || automation.steps || [];
      const isAiAgent =
        Array.isArray(steps) &&
        steps.some(
          (step: any) =>
            String(step.module_id || step.moduleId) === '5' ||
            step.config?.agentId === 'all_ai' ||
            step.config?.isAllAi,
        );
      items.push({
        id: `auto-${automation.id}`,
        name: automation.name || 'Untitled Automation',
        category: isAiAgent ? 'agent' : 'automation',
        data: automation,
      });
    });

    safeList(dbChatAgents).forEach((agent: any) => {
      items.push({
        id: `agent-${agent.id}`,
        name: agent.title || agent.name || 'Untitled Agent',
        category: 'agent',
        data: agent,
      });
    });

    safeList(dbAiPrompts).forEach((prompt: any) => {
      items.push({
        id: prompt.id,
        name: prompt.title || prompt.name || 'Untitled Prompt',
        category: 'aiPrompt',
        data: prompt,
      });
    });

    safeList(dbSessions).forEach((session: any) => {
      items.push({
        id: `session-${session.id}`,
        name: session.title || session.name || 'Untitled Tab Session',
        category: 'tabgroup',
        data: session,
      });
    });

    return items;
  }, [automations, commands, dbAiPrompts, dbChatAgents, dbSessions, links, notes, snippets]);
  const commandIndex = useMemo(() => createCommandIndex(commands), [commands]);
  const commonCommandEntries = useMemo(() => buildCommonCommandEntries(commands), [commands]);
  const isExistingCollectionMode = compactSubcommandMode === 'existing_collection';
  const isLinkSaveMode = compactSubcommandMode === 'save_link';
  const isTodoSaveMode = compactSubcommandMode === 'save_todo';
  const isNoteSaveMode = compactSubcommandMode === 'save_note';
  const isSnippetSaveMode = compactSubcommandMode === 'save_snippet';
  const isChatSaveMode = compactSubcommandMode === 'save_chat';
  const isSendToAgentMode = compactSubcommandMode === 'send_to_agent';
  const isLinkEditorOverlayOpen = overlayMode === 'create_link';
  const isTodoEditorOverlayOpen = overlayMode === 'create_todo';
  const isNoteEditorOverlayOpen = overlayMode === 'create_note';
  const isSnippetEditorOverlayOpen = overlayMode === 'create_snippet';
  const isAiPromptEditorOverlayOpen = overlayMode === 'create_ai_prompt';
  const isNoteCategoryMode = compactSubcommandMode === 'category_note';
  const isLinkCategoryMode = compactSubcommandMode === 'category_link';
  const isSnippetCategoryMode = compactSubcommandMode === 'category_snippet';
  const isTodoCategoryMode = compactSubcommandMode === 'category_todo';
  const isBookmarkCategoryMode = compactSubcommandMode === 'category_bookmark';
  const isCollectionCategoryMode = compactSubcommandMode === 'category_collection';
  const isPromptCategoryMode = compactSubcommandMode === 'category_prompt';
  const isCommandCategoryMode = compactSubcommandMode === 'category_command';
  const isCompactSubcommandMode = compactSubcommandMode !== 'none';

  useEffect(() => {
    if (!isOpen) return;
    void preloadLinkEditorView();
    void preloadCreateTodoView();
    void preloadNoteEditorView();
    void preloadSnippetEditorView();
    void preloadAiPromptEditorView();
  }, [isOpen]);

  const linkedCollectionViewIdsBySessionId = useMemo(() => {
    const map = new Map<string, string[]>();
    const addLinkedView = (sessionId: any, viewId: any) => {
      const normalizedSessionId = String(sessionId || '').trim();
      const normalizedViewId = String(viewId || '').trim();
      if (!normalizedSessionId || !normalizedViewId) return;
      const existing = map.get(normalizedSessionId) || [];
      if (!existing.includes(normalizedViewId)) {
        map.set(normalizedSessionId, [...existing, normalizedViewId]);
      }
    };

    (dbWidgetViews || []).forEach((view: any) => {
      addLinkedView(view?.settings?.[FIXED_SESSION_STRIP_SESSION_SETTING_KEY], view?.id);
    });

    (dashboardWidgets || []).forEach((widget: any) => {
      const sessionId = widget?.sessionId || (widget?.referenceType === 'session' ? widget?.referenceId : '');
      addLinkedView(sessionId, widget?.viewId);
    });

    return map;
  }, [dashboardWidgets, dbWidgetViews]);
  const commandSearchShortcuts = useMemo(() => {
    const sessionIdByCollectionViewId = new Map<string, string>();
    linkedCollectionViewIdsBySessionId.forEach((viewIds, sessionId) => {
      viewIds.forEach(viewId => sessionIdByCollectionViewId.set(viewId, sessionId));
    });

    return safeList(userShortcuts).map((record: any) => {
      if (normalizeWebsiteCategory(record?.referenceType) !== 'session') return record;
      const referenceId = String(record?.referenceId || '').trim();
      return {
        ...record,
        referenceId: sessionIdByCollectionViewId.get(referenceId) || referenceId,
        referenceType: 'session',
      };
    });
  }, [linkedCollectionViewIdsBySessionId, userShortcuts]);

  const findSubcommandShortcut = useCallback(
    (item: any, categoryFilter: 'note' | 'link' | 'snippet' | 'todo' | 'collection' | 'prompt') => {
      const compoundId = getItemCompoundId(item);
      const directSessionIds = [
        item?.id,
        item?.session_id,
        item?.session?.id,
        item?.item?.id,
        item?.data?.id,
      ]
        .filter(Boolean)
        .map(String);
      const linkedCollectionViewIds =
        categoryFilter === 'collection'
          ? directSessionIds.flatMap(id => linkedCollectionViewIdsBySessionId.get(id) || [])
          : [];
      const rawIds = [
        compoundId,
        extractSnippetIdFromCompoundId(compoundId),
        ...linkedCollectionViewIds,
        item?.id,
        item?.snippet_id,
        item?.linkid,
        item?.session_id,
        item?.item?.id,
        item?.snippet?.id,
        item?.session?.id,
        item?.data?.id,
      ]
        .filter(Boolean)
        .map(String);
      const candidateIds = new Set<string>();
      rawIds.forEach(id => {
        candidateIds.add(id);
        candidateIds.add(extractSnippetIdFromCompoundId(id));
      });
      return (userShortcuts || []).find((record: any) => {
        if (!record?.trigger || !record?.referenceId) return false;
        const referenceId = String(record.referenceId);
        const referenceMatches =
          candidateIds.has(referenceId) || candidateIds.has(extractSnippetIdFromCompoundId(referenceId));
        if (!referenceMatches) return false;
        if (matchesShortcutCategory(String(record.referenceType || ''), categoryFilter)) return true;
        return categoryFilter === 'collection' && ['session', 'sessions', 'tab session', 'tabgroup'].includes(String(record.referenceType || '').toLowerCase());
      });
    },
    [linkedCollectionViewIdsBySessionId, userShortcuts],
  );

  const getSubcommandShortcutDisplay = useCallback(
    (item: any, categoryFilter: 'note' | 'link' | 'snippet' | 'todo' | 'collection' | 'prompt') => {
      const getCategoryPrefix = () =>
        categoryFilter === 'note'
          ? omniboxPrefixes?.note
          : categoryFilter === 'link'
            ? omniboxPrefixes?.link
            : categoryFilter === 'snippet'
              ? omniboxPrefixes?.snippet
              : categoryFilter === 'todo'
                ? omniboxPrefixes?.todo
                : categoryFilter === 'prompt'
                  ? omniboxPrefixes?.prompt
                  : omniboxPrefixes?.collection;

      const formatShortcutDisplay = (value: any) => {
        const shortcutValue = String(value || '').trim();
        if (!shortcutValue) return '';
        const commandPrefix = getCommandSpacePrefix(omniboxPrefixes);
        const normalizedShortcutValue = shortcutValue.toLowerCase();
        if (normalizedShortcutValue === commandPrefix || normalizedShortcutValue.startsWith(`${commandPrefix} `)) {
          return shortcutValue;
        }
        return `${commandPrefix} ${String(getCategoryPrefix() || '').trim().toLowerCase()} ${shortcutValue}`.trim();
      };

      const shortcut = findSubcommandShortcut(item, categoryFilter);
      if (!shortcut?.trigger) return '';

      const display = formatShortcutDisplay(shortcut.trigger);
      return display;
    },
    [findSubcommandShortcut, omniboxPrefixes],
  );
  const filteredExistingCollections = useMemo(() => {
    const query = collectionSearchValue.trim();
    const sessions = safeList(dbSessions);
    if (!query) return sessions;
    const searchableSessions = sessions.map((sessionItem: any) => ({
      ...sessionItem,
      _displayShortcut: getSubcommandShortcutDisplay(sessionItem, 'collection'),
    }));
    return searchAll(query, {
      commands: [],
      historyItems: null,
      bookmarks: [],
      commonCommands: [],
      sessions: searchableSessions,
      lockedCommand: null,
    }).filter((result: any) => result?._kind === 'session');
  }, [collectionSearchValue, dbSessions, getSubcommandShortcutDisplay]);
  const agentPickerItems = useMemo(() => {
    const prompts = Array.isArray(dbAiPrompts) ? dbAiPrompts : [];
    const agents = Array.isArray(dbChatAgents) ? dbChatAgents : [];

    return [
      ...prompts.map((prompt: AiPromptRecord) => ({
        id: `prompt:${prompt.id}`,
        kind: 'prompt' as const,
        title: prompt.title || 'Untitled Prompt',
        record: prompt,
      })),
      ...agents.map((agent: ChatAgentRecord) => ({
        id: `agent:${agent.id}`,
        kind: 'agent' as const,
        title: agent.title || 'Untitled Agent',
        record: agent,
      })),
    ];
  }, [dbAiPrompts, dbChatAgents]);
  const filteredAgentPickerItems = useMemo(() => {
    const query = agentSearchValue.trim().toLowerCase();
    if (!query) return agentPickerItems;
    return agentPickerItems.filter(item => {
      const record: any = item.record;
      const searchable = [
        item.title,
        item.kind,
        record?.prompt,
        record?.rules,
        Array.isArray(record?.urls) ? record.urls.join(' ') : '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [agentPickerItems, agentSearchValue]);

  const filteredSaveChatItems = filteredAgentPickerItems;

  const searchCategoryWithSharedEngine = useCallback(
    (
      query: string,
      kind: 'note' | 'link' | 'snippet' | 'todo' | 'bookmark' | 'collection' | 'prompt',
      sourceItems: any[],
    ): CategorySubcommandItem[] => {
      const items = safeList(sourceItems);
      if (!query.trim()) {
        return items.map((item: any, originalIndex: number) => ({
          item: { ...item, category: kind },
          originalIndex,
        }));
      }

      const decoratedItems = items.map((item: any) => ({
        ...item,
        _displayShortcut:
          kind === 'bookmark' ? '' : getSubcommandShortcutDisplay(item, kind),
      }));
      const options = {
        commands: [],
        historyItems: null,
        bookmarks:
          kind === 'bookmark'
            ? decoratedItems.map(item => ({
                id: String(item.id),
                title: String(item.title || ''),
                url: String(item.url || ''),
                folderPath: String(item.folderPath || ''),
              }))
            : [],
        commonCommands: [],
        notes: kind === 'note' ? decoratedItems : [],
        links: kind === 'link' ? decoratedItems : [],
        snippets: kind === 'snippet' ? decoratedItems : [],
        sessions: kind === 'collection' ? decoratedItems : [],
        prompts: kind === 'prompt' ? decoratedItems : [],
        todos: kind === 'todo' ? decoratedItems : [],
        lockedCommand: null,
      };
      const resultKind = kind === 'bookmark' ? 'bookmark' : kind === 'collection' ? 'session' : kind;
      return searchAll(query, options)
        .filter((result: any) => result?._kind === resultKind)
        .map((result: any, originalIndex: number) => {
          const sourceItem = items.find((item: any) =>
            kind === 'bookmark'
              ? String(item?.id || '') === String(result?.id || '') || String(item?.url || '') === String(result?.url || '')
              : String(item?.id || item?.todo_id || item?.snippet_id || '') === String(result?.id || ''),
          );
          return {
            item: { ...sourceItem, ...result, category: kind },
            originalIndex,
          };
        });
    },
    [getSubcommandShortcutDisplay],
  );

  const noteQuickCreateFields = useMemo(
    () =>
      parseNoteQuickCreateFields(categorySearchValue, {
        prefixSettings,
        prefixes: omniboxPrefixes,
      }),
    [categorySearchValue, omniboxPrefixes, prefixSettings],
  );

  const noteCategorySearchValue = noteQuickCreateFields.hasCreateIntent
    ? noteQuickCreateFields.searchText
    : categorySearchValue;

  const noteQuickCreatePrefixLabels = useMemo(
    () =>
      getNoteQuickCreatePrefixLabels({
        prefixSettings,
        prefixes: omniboxPrefixes,
      }),
    [omniboxPrefixes, prefixSettings],
  );

  const noteQuickCreatePlaceholder = useMemo(() => {
    const labels = noteQuickCreatePrefixLabels;
    return `Search notes or type ${labels.title} title required, ${labels.description} description, ${labels.tag} tags`;
  }, [noteQuickCreatePrefixLabels]);

  const noteQuickCreateRowMeta = useMemo(() => {
    const fieldSummary = [
      noteQuickCreateFields.title ? `Title: ${noteQuickCreateFields.title}` : null,
      noteQuickCreateFields.description ? `Description: ${noteQuickCreateFields.description}` : null,
      noteQuickCreateFields.tagNames.length > 0 ? `Tags: ${noteQuickCreateFields.tagNames.join(', ')}` : null,
    ]
      .filter(Boolean)
      .join('  |  ');

    if (fieldSummary) return fieldSummary;

    return `Tab: ${noteQuickCreatePrefixLabels.title} title required, ${noteQuickCreatePrefixLabels.description} description, ${noteQuickCreatePrefixLabels.tag} work, client`;
  }, [noteQuickCreateFields, noteQuickCreatePrefixLabels]);

  const nextNoteQuickCreateField = useMemo(() => {
    const sequence = [
      { field: 'title' as const, prefix: noteQuickCreatePrefixLabels.title },
      { field: 'description' as const, prefix: noteQuickCreatePrefixLabels.description },
      { field: 'tag' as const, prefix: noteQuickCreatePrefixLabels.tag },
    ];
    const presentFields = new Set(noteQuickCreateFields.presentFields);
    return sequence.find(entry => !presentFields.has(entry.field)) || null;
  }, [noteQuickCreateFields.presentFields, noteQuickCreatePrefixLabels]);

  const noteQuickCreateSearchHint = useMemo(() => {
    if (!nextNoteQuickCreateField) return null;
    const label =
      nextNoteQuickCreateField.field === 'title'
        ? 'title'
        : nextNoteQuickCreateField.field === 'description'
          ? 'description'
          : 'tags';
    return (
      <span className="flex max-w-[240px] items-center gap-1.5 truncate text-right">
        <span className="rounded border border-[var(--alts-border-color)] bg-[var(--alts-row-hover-bg)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[var(--alts-text-primary)]">
          Tab
        </span>
        <span className="min-w-0 truncate">{nextNoteQuickCreateField.prefix} {label}</span>
      </span>
    );
  }, [nextNoteQuickCreateField]);

  const focusNoteQuickCreateInput = useCallback((nextValue: string, cursorPosition: number) => {
    openSubcommandMode('category_note', { query: nextValue });
    setDropdownSelectedIndex(0);
    setIsDropdownVisible(true);
    window.requestAnimationFrame(() => {
      const state = useAltSCommandStore.getState();
      if (state.compactSubcommandMode !== 'category_note' || state.categorySearchValue !== nextValue) {
        state.openSubcommandMode('category_note', { query: nextValue });
      }
      setIsDropdownVisible(true);
      const input = searchInputRef.current;
      input?.focus();
      input?.setSelectionRange(cursorPosition, cursorPosition);
    });
  }, [openSubcommandMode, setDropdownSelectedIndex]);

  const startNoteQuickCreateCommand = useCallback(() => {
    const titleFieldPrefix = `${noteQuickCreatePrefixLabels.title} `;
    const existingValue = categorySearchValue.trim();
    const titlePrefix = noteQuickCreatePrefixLabels.title;
    const alreadyAtTitleField = existingValue === titlePrefix || existingValue.startsWith(titleFieldPrefix);
    const nextValue = existingValue && !alreadyAtTitleField ? `${titleFieldPrefix}${existingValue}` : existingValue || titleFieldPrefix;
    focusNoteQuickCreateInput(nextValue, titleFieldPrefix.length);
  }, [categorySearchValue, focusNoteQuickCreateInput, noteQuickCreatePrefixLabels.title]);

  const insertNextNoteQuickCreateField = useCallback(() => {
    if (!isNoteCategoryMode) return;
    if (!nextNoteQuickCreateField) return;

    const baseValue = categorySearchValue.trim();
    const insertion = `${nextNoteQuickCreateField.prefix} `;
    const separator = baseValue ? ' ' : '';
    const nextValue = `${baseValue}${separator}${insertion}`;
    focusNoteQuickCreateInput(nextValue, nextValue.length);
  }, [
    categorySearchValue,
    focusNoteQuickCreateInput,
    isNoteCategoryMode,
    nextNoteQuickCreateField,
  ]);

  const noteHasLeadingCreateRow = isNoteCategoryMode;

  const filteredCategoryNoteItems = useMemo<CategorySubcommandItem[]>(() => {
    return searchCategoryWithSharedEngine(noteCategorySearchValue, 'note', notes);
  }, [noteCategorySearchValue, notes, searchCategoryWithSharedEngine]);
  const filteredCategoryLinkItems = useMemo<CategorySubcommandItem[]>(() => {
    return searchCategoryWithSharedEngine(categorySearchValue, 'link', links);
  }, [categorySearchValue, links, searchCategoryWithSharedEngine]);
  const filteredSaveLinkItems = useMemo<CategorySubcommandItem[]>(() => {
    return searchCategoryWithSharedEngine(linkSaveSearchValue, 'link', links);
  }, [linkSaveSearchValue, links, searchCategoryWithSharedEngine]);
  const filteredSaveTodoItems = useMemo<CategorySubcommandItem[]>(() => {
    return searchCategoryWithSharedEngine(todoSaveSearchValue, 'todo', todos);
  }, [todoSaveSearchValue, todos, searchCategoryWithSharedEngine]);
  const filteredSaveNoteItems = useMemo<CategorySubcommandItem[]>(() => {
    return searchCategoryWithSharedEngine(noteSaveSearchValue, 'note', notes);
  }, [noteSaveSearchValue, notes, searchCategoryWithSharedEngine]);
  const filteredSaveSnippetItems = useMemo<CategorySubcommandItem[]>(() => {
    return searchCategoryWithSharedEngine(snippetSaveSearchValue, 'snippet', snippets);
  }, [searchCategoryWithSharedEngine, snippetSaveSearchValue, snippets]);
  const filteredCategorySnippetItems = useMemo<CategorySubcommandItem[]>(() => {
    return searchCategoryWithSharedEngine(categorySearchValue, 'snippet', snippets);
  }, [categorySearchValue, searchCategoryWithSharedEngine, snippets]);
  const filteredCategoryTodoItems = useMemo<CategorySubcommandItem[]>(() => {
    return searchCategoryWithSharedEngine(categorySearchValue, 'todo', todos);
  }, [categorySearchValue, searchCategoryWithSharedEngine, todos]);

  const todoQuickCreateFields = useMemo(
    () =>
      parseTodoQuickCreateFields(categorySearchValue, {
        prefixSettings,
        prefixes: omniboxPrefixes,
      }),
    [categorySearchValue, omniboxPrefixes, prefixSettings],
  );

  const todoQuickCreatePrefixLabels = useMemo(
    () =>
      getQuickCreatePrefixLabels('todo', {
        prefixSettings,
        prefixes: omniboxPrefixes,
      }),
    [omniboxPrefixes, prefixSettings],
  );

  const todoQuickCreatePlaceholder = useMemo(() => {
    const labels = todoQuickCreatePrefixLabels;
    return `Search todos or type ${labels.title} title, ${labels.description} description, ${labels.recurring}, ${labels.time}, ${labels.reference}, ${labels.tag} tags`;
  }, [todoQuickCreatePrefixLabels]);

  const todoQuickCreateRowMeta = useMemo(() => {
    const fieldSummary = [
      todoQuickCreateFields.title ? `Title: ${todoQuickCreateFields.title}` : null,
      todoQuickCreateFields.description ? `Description: ${todoQuickCreateFields.description}` : null,
      todoQuickCreateFields.recurring ? `Recurring: ${todoQuickCreateFields.recurring}` : null,
      todoQuickCreateFields.time ? `Time: ${todoQuickCreateFields.time}` : null,
      todoQuickCreateFields.reference ? `Attach: ${todoQuickCreateFields.reference}` : null,
      todoQuickCreateFields.tagNames.length > 0 ? `Tags: ${todoQuickCreateFields.tagNames.join(', ')}` : null,
    ]
      .filter(Boolean)
      .join('  |  ');

    if (fieldSummary) return fieldSummary;

    return `Tab: ${todoQuickCreatePrefixLabels.title} title, ${todoQuickCreatePrefixLabels.description} description, ${todoQuickCreatePrefixLabels.recurring}, ${todoQuickCreatePrefixLabels.time}, ${todoQuickCreatePrefixLabels.reference}, ${todoQuickCreatePrefixLabels.tag} work, client`;
  }, [todoQuickCreateFields, todoQuickCreatePrefixLabels]);

  const nextTodoQuickCreateField = useMemo(() => {
    const sequence = [
      { field: 'title' as const, prefix: todoQuickCreatePrefixLabels.title, label: 'title' },
      { field: 'description' as const, prefix: todoQuickCreatePrefixLabels.description, label: 'description' },
      { field: 'recurring' as const, prefix: todoQuickCreatePrefixLabels.recurring, label: 'recurring' },
      { field: 'time' as const, prefix: todoQuickCreatePrefixLabels.time, label: 'time' },
      { field: 'reference' as const, prefix: todoQuickCreatePrefixLabels.reference, label: 'attach' },
      { field: 'tag' as const, prefix: todoQuickCreatePrefixLabels.tag, label: 'tags' },
    ];
    const presentFields = new Set(todoQuickCreateFields.presentFields);
    return sequence.find(entry => !presentFields.has(entry.field)) || null;
  }, [todoQuickCreateFields.presentFields, todoQuickCreatePrefixLabels]);

  const todoQuickCreateSearchHint = useMemo(() => {
    if (!nextTodoQuickCreateField) return null;
    return (
      <span className="flex max-w-[280px] items-center gap-1.5 truncate text-right">
        <span className="rounded border border-[var(--alts-border-color)] bg-[var(--alts-row-hover-bg)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[var(--alts-text-primary)]">
          Tab
        </span>
        <span className="min-w-0 truncate">{nextTodoQuickCreateField.prefix} {nextTodoQuickCreateField.label}</span>
      </span>
    );
  }, [nextTodoQuickCreateField]);

  const todoHasLeadingCreateRow = isTodoCategoryMode;
  const filteredCategoryBookmarkItems = useMemo<CategorySubcommandItem[]>(() => {
    return searchCategoryWithSharedEngine(categorySearchValue, 'bookmark', allBookmarks);
  }, [allBookmarks, categorySearchValue, searchCategoryWithSharedEngine]);
  const filteredCategoryCollectionItems = useMemo<CategorySubcommandItem[]>(() => {
    return searchCategoryWithSharedEngine(categorySearchValue, 'collection', dbSessions);
  }, [categorySearchValue, dbSessions, searchCategoryWithSharedEngine]);
  const filteredCategoryPromptItems = useMemo<CategorySubcommandItem[]>(() => {
    return searchCategoryWithSharedEngine(categorySearchValue, 'prompt', dbAiPrompts);
  }, [categorySearchValue, dbAiPrompts, searchCategoryWithSharedEngine]);

  // Derive the workspace to save new links into.
  // Prefer the selected team's first workspace, otherwise fall back to the first Dexie workspace.
  const defaultWorkspaceId = useMemo(() => {
    const selectedWorkspaceId = selectedTeam?.workspaces?.[0]?.workspace_id;
    if (selectedWorkspaceId) return selectedWorkspaceId;
    return allWorkspaces[0]?.id || null;
  }, [allWorkspaces, selectedTeam]);

  const { validateShortcut } = useShortcutValidation();
  const { validateHotkey } = useHotkeyValidation();
  const [createCollectionDialog, setCreateCollectionDialog] = useState<CreateCollectionDialogState | null>(null);
  const [createCollectionDraft, setCreateCollectionDraft] = useState<CreateSessionDraft>(createEmptySessionDraft);
  const [stagedCreateCollectionWidgets, setStagedCreateCollectionWidgets] = useState<WidgetCatalogItem[]>([]);
  const [pendingCreateCollectionActionId, setPendingCreateCollectionActionId] = useState<string | null>(null);
  const [createCollectionActionError, setCreateCollectionActionError] = useState<string | null>(null);
  const [pendingCreateCollectionWidgetIds, setPendingCreateCollectionWidgetIds] = useState<Set<string>>(() => new Set());

  const [optimisticSavedUrls, setOptimisticSavedUrls] = useState<string[]>([]);
  const globalCommands = useDbStore(state => state.commands);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const isBackspaceHandlingRef = useRef(false);
  const dropdownActionGuardRef = useRef<{ id: string; ts: number } | null>(null);
  const altSEditorRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [todoQuickCreatePopup, setTodoQuickCreatePopup] = useState<'recurring' | 'time' | 'reference' | null>(null);
  const [todoQuickCreateSchedule, setTodoQuickCreateSchedule] = useState<{
    date: string;
    time: string | null;
    isAnytime: boolean;
  } | null>(null);
  const [todoQuickCreateRecurring, setTodoQuickCreateRecurring] = useState<'one-time' | 'daily' | 'weekly' | 'monthly' | null>(null);
  const [todoQuickCreateReferences, setTodoQuickCreateReferences] = useState<any[]>([]);
  const [todoQuickCreateReferenceQuery, setTodoQuickCreateReferenceQuery] = useState('');
  const [todoQuickCreateReferenceIndex, setTodoQuickCreateReferenceIndex] = useState(0);
  const [todoQuickCreateReferenceCategory, setTodoQuickCreateReferenceCategory] = useState<
    'all' | 'note' | 'snippet' | 'link' | 'tabgroup' | 'automation' | 'aiPrompt' | 'agent'
  >('all');
  const [todoQuickCreatePopupPosition, setTodoQuickCreatePopupPosition] = useState({ top: 0, left: 0 });
  const todoQuickCreateRecurringRef = useRef<HTMLDivElement | null>(null);
  const todoQuickCreateReferenceInputRef = useRef<HTMLInputElement | null>(null);
  const dismissedTodoQuickCreatePopupRef = useRef<{
    field: 'recurring' | 'time' | 'reference';
    value: string;
  } | null>(null);

  const closeTodoQuickCreatePopup = useCallback((options: { focusSearch?: boolean } = {}) => {
    const activeField = todoQuickCreatePopup;
    if (activeField) {
      dismissedTodoQuickCreatePopupRef.current = {
        field: activeField,
        value: categorySearchValue,
      };
    }
    setTodoQuickCreatePopup(null);
    if (options.focusSearch !== false) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [categorySearchValue, todoQuickCreatePopup]);

  useEffect(() => {
    const dismissed = dismissedTodoQuickCreatePopupRef.current;
    if (dismissed && dismissed.value !== categorySearchValue) {
      dismissedTodoQuickCreatePopupRef.current = null;
    }
  }, [categorySearchValue]);

  useEffect(() => {
    if (!todoQuickCreatePopup || !searchContainerRef.current) return;

    const updatePosition = () => {
      const rect = searchContainerRef.current?.getBoundingClientRect();
      const hostRect = mainContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setTodoQuickCreatePopupPosition({
        top: hostRect ? rect.bottom - hostRect.top + 4 : rect.bottom + 4,
        left: hostRect ? rect.left - hostRect.left + 12 : rect.left + 12,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [todoQuickCreatePopup]);

  useEffect(() => {
    if (!todoQuickCreatePopup) return;

    const frameId = window.requestAnimationFrame(() => {
      if (todoQuickCreatePopup === 'recurring') {
        const selectedOption =
          todoQuickCreateRecurringRef.current?.querySelector<HTMLButtonElement>('[data-todo-recurring-option][aria-selected="true"]');
        const firstOption =
          todoQuickCreateRecurringRef.current?.querySelector<HTMLButtonElement>('[data-todo-recurring-option]');
        (selectedOption || firstOption)?.focus();
      } else if (todoQuickCreatePopup === 'reference') {
        todoQuickCreateReferenceInputRef.current?.focus();
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [todoQuickCreatePopup]);

  useEffect(() => {
    if (!todoQuickCreatePopup) return;

    const handlePointerOutside = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const path = event.composedPath();
      const insidePopup = path.some(node => {
        if (!(node instanceof Element)) return false;
        return Boolean(node.closest('[data-todo-quick-create-popup]'));
      });
      const insideSearch = path.some(node => {
        if (!(node instanceof Node)) return false;
        return node === searchContainerRef.current || Boolean(searchContainerRef.current?.contains(node));
      });
      if (insidePopup || insideSearch) return;
      closeTodoQuickCreatePopup({ focusSearch: false });
    };

    document.addEventListener('mousedown', handlePointerOutside, true);
    return () => document.removeEventListener('mousedown', handlePointerOutside, true);
  }, [closeTodoQuickCreatePopup, todoQuickCreatePopup]);

  const todoQuickCreateReferenceItems = useMemo(() => {
    const toReferenceItem = (item: any, category: string) => {
      const id = String(item?.id || item?.snippet_id || item?.note_id || item?.todo_id || '').trim();
      const name = String(item?.title || item?.name || item?.label || item?.key || '').trim();
      if (!id || !name) return null;
      return {
        id,
        name,
        title: name,
        category,
        type: category,
        data: item,
      };
    };

    return [
      ...safeList(notes).map(item => toReferenceItem(item, 'note')),
      ...safeList(links).map(item => toReferenceItem(item, 'link')),
      ...safeList(snippets).map(item => toReferenceItem(item, 'snippet')),
      ...safeList(dbAiPrompts).map(item => toReferenceItem(item, 'aiPrompt')),
      ...safeList(dbChatAgents).map(item => toReferenceItem(item, 'agent')),
      ...safeList(dbWidgetViews).map(item => toReferenceItem(item, 'tabgroup')),
    ].filter(Boolean) as any[];
  }, [dbAiPrompts, dbChatAgents, dbWidgetViews, links, notes, snippets]);

  const filteredTodoQuickCreateReferenceItems = useMemo(() => {
    const query = todoQuickCreateReferenceQuery.trim().toLowerCase();
    if (!query) return todoQuickCreateReferenceItems.slice(0, 40);
    return todoQuickCreateReferenceItems.filter(item =>
      [item.name, item.category].join(' ').toLowerCase().includes(query),
    ).slice(0, 40);
  }, [todoQuickCreateReferenceItems, todoQuickCreateReferenceQuery]);

  const todoQuickCreateReferenceCategories = useMemo(() => {
    const categories = {
      all: [] as any[],
      note: [] as any[],
      snippet: [] as any[],
      link: [] as any[],
      tabgroup: [] as any[],
      automation: [] as any[],
      aiPrompt: [] as any[],
      agent: [] as any[],
    };

    filteredTodoQuickCreateReferenceItems.forEach(item => {
      const category = String(item.category || '').toLowerCase();
      categories.all.push(item);
      if (category === 'note') categories.note.push(item);
      else if (category === 'snippet') categories.snippet.push(item);
      else if (category === 'link') categories.link.push(item);
      else if (category === 'tabgroup' || category === 'session') categories.tabgroup.push(item);
      else if (category === 'automation') categories.automation.push(item);
      else if (category === 'aiprompt' || category === 'ai_prompt' || category === 'prompt') categories.aiPrompt.push(item);
      else if (category === 'agent' || category === 'chat_agent') categories.agent.push(item);
    });

    return categories;
  }, [filteredTodoQuickCreateReferenceItems]);

  const todoQuickCreateActiveReferenceItems =
    todoQuickCreateReferenceCategories[todoQuickCreateReferenceCategory] || todoQuickCreateReferenceCategories.all;

  const todoQuickCreateReferenceCategoryRows = useMemo(
    () => [
      { key: 'all' as const, label: 'All', items: todoQuickCreateReferenceCategories.all, icon: <FaObjectGroup className="w-3.5 h-3.5 shrink-0 text-[var(--color-iconDefault,var(--alts-icon-color))]" /> },
      { key: 'note' as const, label: 'Notes', items: todoQuickCreateReferenceCategories.note, icon: <FiFileText className="w-3.5 h-3.5 shrink-0 text-[var(--color-iconDefault,var(--alts-icon-color))]" /> },
      { key: 'snippet' as const, label: 'Text Expanders', items: todoQuickCreateReferenceCategories.snippet, icon: <FaCode className="w-3.5 h-3.5 shrink-0 text-[var(--color-iconDefault,var(--alts-icon-color))]" /> },
      { key: 'link' as const, label: 'Links', items: todoQuickCreateReferenceCategories.link, icon: <FaLink className="w-3.5 h-3.5 shrink-0 text-[var(--color-iconDefault,var(--alts-icon-color))]" /> },
      { key: 'tabgroup' as const, label: 'Tab Sessions', items: todoQuickCreateReferenceCategories.tabgroup, icon: <FaLayerGroup className="w-3.5 h-3.5 shrink-0 text-[var(--color-iconDefault,var(--alts-icon-color))]" /> },
      { key: 'automation' as const, label: 'Automations', items: todoQuickCreateReferenceCategories.automation, icon: <FaCog className="w-3.5 h-3.5 shrink-0 text-[var(--color-iconDefault,var(--alts-icon-color))]" /> },
      { key: 'aiPrompt' as const, label: 'AI Prompts', items: todoQuickCreateReferenceCategories.aiPrompt, icon: <LuSparkles className="w-3.5 h-3.5 shrink-0 text-[var(--color-iconDefault,var(--alts-icon-color))]" /> },
      { key: 'agent' as const, label: 'Chat Agents', items: todoQuickCreateReferenceCategories.agent, icon: <LuSparkles className="w-3.5 h-3.5 shrink-0 text-[var(--color-iconDefault,var(--alts-icon-color))]" /> },
    ],
    [todoQuickCreateReferenceCategories],
  );

  useEffect(() => {
    setTodoQuickCreateReferenceIndex(prev => {
      if (todoQuickCreateActiveReferenceItems.length === 0) return 0;
      return Math.max(0, Math.min(prev, todoQuickCreateActiveReferenceItems.length - 1));
    });
  }, [todoQuickCreateActiveReferenceItems.length]);

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

  const syncDbFromBackground = useCallback(() => {
    chrome.runtime.sendMessage({ action: 'db_get_all_records' }, res => {
      if (res && res.success) {
        const toList = (list: any) => (Array.isArray(list) ? list : []);
        const hkMap: Record<string, string> = {};
        (res.userHotkeys || []).forEach((hk: any) => {
          hkMap[hk.referenceId] = hk.combination;
        });
        const scMap: Record<string, string> = {};
        (res.userShortcuts || []).forEach((sc: any) => {
          scMap[sc.referenceId] = sc.trigger;
        });
        setDashboardWidgets(Array.isArray(res.widgets) ? res.widgets : []);
        setPopupDbSnapshot({
          workspaces: toList(res.workspaces),
          links: toList(res.links),
          notes: toList(res.notes),
          snippets: toList(res.snippets),
          todos: toList(res.todos),
          automations: toList(res.automations),
          chatAgents: toList(res.chatAgents),
          aiPrompts: toList(res.aiPrompts),
          userShortcuts: toList(res.userShortcuts),
          commands: toList(res.commands),
          sessions: toList(res.sessions),
          widgets: toList(res.widgets),
          widgetViews: toList(res.widgetViews),
          prefixSettings: toList(res.prefixSettings),
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
          widgetViews: res.widgetViews || [],
          commands: res.commands || [],
          prefixSettings: res.prefixSettings || [],
          isInitialized: true,
        });
      }
    });
  }, []);

  const scheduleAltSEditorDbRefresh = useCallback(
    (delay = 300) => {
      if (altSEditorRefreshTimerRef.current) {
        clearTimeout(altSEditorRefreshTimerRef.current);
      }
      altSEditorRefreshTimerRef.current = setTimeout(() => {
        altSEditorRefreshTimerRef.current = null;
        syncDbFromBackground();
      }, delay);
    },
    [syncDbFromBackground],
  );

  useEffect(() => {
    return () => {
      if (altSEditorRefreshTimerRef.current) {
        clearTimeout(altSEditorRefreshTimerRef.current);
        altSEditorRefreshTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      syncDbFromBackground();

      const dbChangedListener = (message: any) => {
        if (message && message.action === 'db_changed') {
          const activeOverlayMode = String(useAltSCommandStore.getState().overlayMode || '');
          if (['create_link', 'create_todo', 'create_note', 'create_snippet', 'create_ai_prompt'].includes(activeOverlayMode)) {
            scheduleAltSEditorDbRefresh();
            return;
          }
          syncDbFromBackground();
        }
      };

      chrome.runtime.onMessage.addListener(dbChangedListener);
      return () => {
        chrome.runtime.onMessage.removeListener(dbChangedListener);
      };
    }
    return undefined;
  }, [isOpen, scheduleAltSEditorDbRefresh, syncDbFromBackground]);

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

  const commandSpace = useMemo(
    () => parseWebsiteCommandSpace(searchValue, omniboxPrefixes),
    [searchValue, omniboxPrefixes],
  );
  const debouncedCommandSpace = useMemo(
    () => parseWebsiteCommandSpace(debouncedSearchValue, omniboxPrefixes),
    [debouncedSearchValue, omniboxPrefixes],
  );
  const autoTriggeredThisSectionInputRef = useRef<string | null>(null);
  const bookmarkSuggestionsForSearch = useMemo(
    () =>
      safeList(allBookmarks).map((bookmark: any) => ({
        _kind: 'bookmark' as const,
        id: String(bookmark.id || bookmark.url || ''),
        title: String(bookmark.title || bookmark.url || ''),
        url: String(bookmark.url || ''),
      })),
    [allBookmarks],
  );
  const commandSubmodeSearchValue = `${getCommandSpacePrefix(omniboxPrefixes)} ${
    isCommandCategoryMode ? categorySearchValue : ''
  }`;
  const commandSubmodeSuggestionState = useSearchbarSuggestions({
    value: isCommandCategoryMode ? commandSubmodeSearchValue : '',
    lockedCommand: null,
    lockedLocalDef: null,
    selectedTeam: null,
    searchTeamLike: null,
    dbWorkspaces: [],
    selectedFolder: null,
    isInitialAltSFocus: false,
    isFocused: isCommandCategoryMode,
    isSearchFocusEnabled: true,
    selectedImages: [],
    commands,
    commandIndex,
    bookmarkSuggestions: bookmarkSuggestionsForSearch,
    commonCommandEntries,
    automationSuggestions: safeList(automations),
    agentCollectionSuggestions: [],
    moduleSuggestions: [],
    selectedAtCommand: null,
    activeSnippetCommandId: null,
    isSnippetCommand: false,
    commandKey: getCommandSpacePrefix(omniboxPrefixes),
    workspaceItemIndex: [],
    userDbShortcuts: commandSearchShortcuts,
    userDbHotkeys: [],
    customPrefixes: omniboxPrefixes,
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

    const isChatSite = isSupportedAiChatSaveUrl(activeTabUrl);

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
        id: 'add_to_existing',
        name: 'Existing Collection',
        category: 'thissite_action',
        icon: <FaLayerGroup className="w-4 h-4 shrink-0 text-gray-400" />,
      });
      thisSiteItems.push({
        id: 'save_link',
        name: 'Save Link',
        category: 'thissite_action',
        icon: <FaLink className="w-4 h-4 shrink-0 text-gray-400" />,
      });
      thisSiteItems.push({
        id: 'save_todo',
        name: 'To Do',
        category: 'thissite_action',
        icon: <BsCalendarCheck className="w-4 h-4 shrink-0 text-gray-400" />,
      });
      thisSiteItems.push({
        id: 'save_note',
        name: 'Save Note',
        category: 'thissite_action',
        icon: <FiFileText className="w-4 h-4 shrink-0 text-gray-400" />,
      });
      thisSiteItems.push({
        id: 'save_snippet',
        name: 'Save Text Expander',
        category: 'thissite_action',
        icon: <FaCode className="w-4 h-4 shrink-0 text-gray-400" />,
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
        id: 'send_to_agent',
        name: 'Send to Agent',
        category: 'thissite_action',
        icon: <FiSend className="w-4 h-4 shrink-0 text-gray-400" />,
      });
      thisSiteItems.push({
        id: 'summarize_page',
        name: 'Summarize This Page',
        category: 'thissite_action',
        icon: <FiFileText className="w-4 h-4 shrink-0 text-gray-400" />,
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
            item.name.toLowerCase().startsWith(lower) ||
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

  const filteredCategoryCommandItems = useMemo<CategorySubcommandItem[]>(() => {
    const query = categorySearchValue.trim().toLowerCase();
    const sharedRows = safeList(commandSubmodeSuggestionState.allSuggestions).map(
      (suggestion: any, originalIndex: number) => {
        const proxyEntity = suggestion?.commandType === 'proxy' ? suggestion.proxyEntity : null;
        const directEntityKinds = new Set(['note', 'link', 'snippet', 'todo', 'prompt', 'session', 'automation', 'agent']);
        const workspaceResult =
          suggestion?._kind === 'workspace_item'
            ? suggestion
            : proxyEntity?._kind === 'workspace_item'
              ? proxyEntity
              : null;
        const directEntity = directEntityKinds.has(String(suggestion?._kind || '')) ? suggestion : null;
        const entityItem =
          workspaceResult?.item ||
          proxyEntity?.snippet ||
          directEntity ||
          suggestion?.item ||
          suggestion?.record ||
          suggestion?.automation ||
          suggestion?.agent ||
          null;
        const commandItem =
          suggestion?.command?.definition ||
          suggestion?.command ||
          suggestion?.definition?.command ||
          suggestion?.definition ||
          suggestion;
        const normalizedItem = entityItem
          ? {
              ...entityItem,
              category: entityItem.category || entityItem.referenceType || directEntity?._kind,
              _commandProxy: true,
            }
          : {
              ...commandItem,
              category: commandItem?.category || suggestion?.category || 'command',
              _commandProxy: false,
            };
        if (
          !normalizedItem.title &&
          !normalizedItem.key &&
          !normalizedItem.name &&
          !normalizedItem.label
        ) {
          console.warn('[AltS Website Commands] Unresolved command suggestion', suggestion);
        }
        return {
          item: normalizedItem,
          suggestion,
          originalIndex,
        };
      },
    );
    const defaultActionRows = safeList(filteredThisSite)
      .filter((action: any) => {
        if (!query) return true;
        const shortcut = String(action?._displayShortcut || '').toLowerCase();
        return (
          String(action?.name || '').toLowerCase().includes(query) ||
          String(action?.id || '').toLowerCase().includes(query) ||
          shortcut.includes(query)
        );
      })
      .map((action: any, index: number) => ({
        item: { ...(action.item || action), _displayShortcut: action._displayShortcut, _websiteAction: true },
        suggestion: action,
        originalIndex: sharedRows.length + index,
      }));

    const seen = new Set<string>();
    return [...sharedRows, ...defaultActionRows].filter((row: CategorySubcommandItem) => {
      const item = row.item || {};
      const shortcutRecord = row.suggestion?._userShortcutRecord || item._userShortcutRecord;
      const key = item._commandProxy
        ? `shortcut:${shortcutRecord?.referenceType || item.category}:${shortcutRecord?.referenceId || item.id}`
        : `command:${item.id || item.name || row.suggestion?.id}`;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [categorySearchValue, commandSubmodeSuggestionState.allSuggestions, filteredThisSite]);



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
      const nameMatch = item.name.toLowerCase().startsWith(filterText);
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

    const categoryNames = ['todos', 'commands', 'links', 'notes', 'bookmarks', 'snippets', 'sessions', 'chat_agents'];
    const categoryPrefixByName: Record<string, string[]> = {
      todos: [omniboxPrefixes?.todo || 't'],
      commands: [omniboxPrefixes?.command || 'c'],
      links: [omniboxPrefixes?.link || 'l'],
      notes: [omniboxPrefixes?.note || 'n'],
      bookmarks: [omniboxPrefixes?.bookmark || 'bk'],
      snippets: [omniboxPrefixes?.snippet || 'text'],
      sessions: [omniboxPrefixes?.collection || 'collect'],
      chat_agents: [omniboxPrefixes?.prompt || 'p', omniboxPrefixes?.agent || 'g'],
    };
    const shouldShowCategories = !debouncedCommandSpace.isActive || !debouncedCommandSpace.activeCategoryFilter;
    const categories = shouldShowCategories
      ? categoryNames
          .filter(name => {
            if (!filterText) return true;
            const normalizedName = name.toLowerCase();
            const displayName = SECTION_META[name]?.title?.toLowerCase() || normalizedName;
            const prefixes = categoryPrefixByName[name] || [];
            return (
              normalizedName.startsWith(filterText) ||
              displayName.startsWith(filterText) ||
              prefixes.some(prefix => String(prefix || '').trim().toLowerCase().startsWith(filterText))
            );
          })
          .map(name => ({
            type: 'category',
            id: name,
            name: name,
          }))
      : [];

    const thisSiteActions = [...siteCommandActions, ...extractionActions];

    return {
      thisSiteActions,
      siteCommandActions,
      extractionActions,
      categories,
      totalList: [...thisSiteActions, ...categories],
    };
  }, [debouncedSearchValue, filteredThisSite, debouncedCommandSpace, omniboxPrefixes]);

  const isCommandCategoryPrefixSearch = useMemo(() => {
    if (!debouncedCommandSpace.isActive || debouncedCommandSpace.activeCategoryFilter) return false;
    const query = debouncedCommandSpace.actualQuery.trim().toLowerCase();
    if (!query) return false;
    return Object.keys(buildShortcutPrefixRegistry(omniboxPrefixes)).some(prefix => prefix.startsWith(query));
  }, [debouncedCommandSpace.activeCategoryFilter, debouncedCommandSpace.actualQuery, debouncedCommandSpace.isActive, omniboxPrefixes]);

  const normalSearchQuery = useMemo(() => {
    const trimmed = debouncedSearchValue.trim();
    if (isCompactSubcommandMode) return '';
    if (debouncedCommandSpace.isActive) {
      if (debouncedCommandSpace.activeCategoryFilter || isCommandCategoryPrefixSearch) return '';
      return debouncedCommandSpace.actualQuery.trim();
    }
    if (!trimmed || trimmed.startsWith('/')) return '';
    return trimmed;
  }, [
    debouncedCommandSpace.activeCategoryFilter,
    debouncedCommandSpace.actualQuery,
    debouncedCommandSpace.isActive,
    debouncedSearchValue,
    isCommandCategoryPrefixSearch,
    isCompactSubcommandMode,
  ]);

  const normalCompactGroups = useMemo<NormalCompactGroup[]>(() => {
    const query = normalSearchQuery;
    if (!query) return [];
    const isBareCommandSpaceSearch = debouncedCommandSpace.isActive && !debouncedCommandSpace.activeCategoryFilter;
    const commandPrefix = getCommandSpacePrefix(omniboxPrefixes);
    const rawCommandSpaceInput = debouncedSearchValue.replace(/\u00A0/g, ' ');
    const rawAfterCommand = rawCommandSpaceInput.toLowerCase().startsWith(`${commandPrefix} `)
      ? rawCommandSpaceInput.slice(commandPrefix.length + 1)
      : '';

    const engineResults = searchAll(query, {
      commands,
      historyItems: null,
      bookmarks: isBareCommandSpaceSearch
        ? []
        : safeList(allBookmarks).map((bookmark: any) => ({
            id: String(bookmark?.id || bookmark?.url || ''),
            title: String(bookmark?.title || bookmark?.url || ''),
            url: String(bookmark?.url || ''),
            folderPath: String(bookmark?.folderPath || ''),
          })),
      commonCommands: commonCommandEntries,
      automations: isBareCommandSpaceSearch ? [] : safeList(automations),
      notes: isBareCommandSpaceSearch ? [] : safeList(notes),
      links: isBareCommandSpaceSearch ? [] : safeList(links),
      snippets: isBareCommandSpaceSearch ? [] : safeList(snippets),
      sessions: isBareCommandSpaceSearch ? [] : safeList(dbSessions),
      prompts: isBareCommandSpaceSearch ? [] : safeList(dbAiPrompts),
      todos: isBareCommandSpaceSearch ? [] : safeList(todos),
      lockedCommand: null,
    });

    const normalizeEntityId = (value: any) => extractSnippetIdFromCompoundId(String(value || '').trim());
    const entityIdsMatch = (left: any, right: any) => {
      const normalizedLeft = normalizeEntityId(left);
      const normalizedRight = normalizeEntityId(right);
      return !!normalizedLeft && !!normalizedRight && normalizedLeft === normalizedRight;
    };
    const findByEntityId = (items: any[], id: any) =>
      safeList(items).find(
        (candidate: any) =>
          entityIdsMatch(candidate?.id, id) ||
          entityIdsMatch(candidate?.snippet_id, id) ||
          entityIdsMatch(candidate?.linkid, id) ||
          entityIdsMatch(candidate?.todo_id, id) ||
          entityIdsMatch(candidate?.prompt_id, id) ||
          entityIdsMatch(candidate?.session_id, id),
      );
    const hydrateNormalItem = (kind: NormalCompactResultKind, item: any) => {
      if (kind === 'site-action') return item;
      if (kind === 'update-note') return findByEntityId(notes, item?.id || item?.snippet_id) || item;
      if (kind === 'note') return findByEntityId(notes, item?.id || item?.snippet_id) || item;
      if (kind === 'link') return findByEntityId(links, item?.id || item?.snippet_id || item?.linkid) || item;
      if (kind === 'snippet') return findByEntityId(snippets, item?.id || item?.snippet_id) || item;
      if (kind === 'todo') return findByEntityId(todos, item?.id || item?.todo_id || item?.snippet_id) || item;
      if (kind === 'prompt') return findByEntityId(dbAiPrompts, item?.id || item?.prompt_id) || item;
      if (kind === 'collection') return findByEntityId(dbSessions, item?.id || item?.session_id) || item;
      if (kind === 'bookmark') {
        return (
          safeList(allBookmarks).find(
            (bookmark: any) =>
              String(bookmark?.id || '').trim() === String(item?.id || '').trim() ||
              String(bookmark?.url || '').trim() === String(item?.url || '').trim(),
          ) || item
        );
      }
      return item;
    };

    const getShortcutReferenceId = (shortcut: any) =>
      String(shortcut?.referenceId || shortcut?.entityId || shortcut?.targetId || '').trim();

    const resolveNormalResultKind = (item: any): NormalCompactResultKind | null => {
      const category = normalizeWebsiteCategory(item?.category || item?.referenceType || item?._kind);
      if (category === 'command') return 'command';
      if (category === 'note') return 'note';
      if (category === 'link') return 'link';
      if (category === 'snippet') return 'snippet';
      if (category === 'todo') return 'todo';
      if (category === 'bookmark') return 'bookmark';
      if (category === 'prompt' || category === 'agent') return 'prompt';
      if (category === 'session' || category === 'collection') return 'collection';
      return null;
    };

    const getCommandShortcutDisplay = (shortcut: any, kind: NormalCompactResultKind) => {
      const trigger = normalizeShortcutTrigger(String(shortcut?.trigger || ''));
      if (!trigger) return '';
      if (kind === 'command') return `${getCommandSpacePrefix(omniboxPrefixes)} ${trigger}`.trim();
      const categoryPrefix =
        kind === 'note'
          ? omniboxPrefixes?.note
          : kind === 'link'
            ? omniboxPrefixes?.link
            : kind === 'snippet'
              ? omniboxPrefixes?.snippet
              : kind === 'todo'
                ? omniboxPrefixes?.todo
                : kind === 'prompt'
                  ? omniboxPrefixes?.prompt
                  : kind === 'bookmark'
                    ? omniboxPrefixes?.bookmark
                    : omniboxPrefixes?.collection;
      return `${getCommandSpacePrefix(omniboxPrefixes)} ${String(categoryPrefix || '').trim().toLowerCase()} ${trigger}`.trim();
    };

    const findShortcutTarget = (kind: NormalCompactResultKind, shortcut: any) => {
      const referenceId = getShortcutReferenceId(shortcut);
      if (!referenceId) return null;
      if (kind === 'command') {
        return safeList(commands).find((command: any) => String(command?.id || '').trim() === referenceId) || null;
      }
      if (kind === 'note') return findByEntityId(notes, referenceId) || null;
      if (kind === 'link') return findByEntityId(links, referenceId) || null;
      if (kind === 'snippet') return findByEntityId(snippets, referenceId) || null;
      if (kind === 'todo') return findByEntityId(todos, referenceId) || null;
      if (kind === 'prompt') return findByEntityId(dbAiPrompts, referenceId) || null;
      if (kind === 'collection') return findByEntityId(dbSessions, referenceId) || null;
      if (kind === 'bookmark') {
        return (
          safeList(allBookmarks).find(
            (bookmark: any) =>
              String(bookmark?.id || '').trim() === referenceId ||
              String(bookmark?.url || '').trim() === referenceId,
          ) || null
        );
      }
      return null;
    };

    const getSuggestionRow = (suggestion: any, originalIndex: number): NormalCompactResult | null => {
      if (suggestion?._kind === 'command') {
        const commandItem = suggestion.command || suggestion.definition || suggestion;
        return {
          kind: 'command',
          item: { ...commandItem, category: commandItem?.category || 'command' },
          suggestion,
          originalIndex,
        };
      }

      if (suggestion?._kind === 'bookmark') {
        return {
          kind: 'bookmark',
          item: { ...suggestion, category: 'bookmark' },
          suggestion,
          originalIndex,
        };
      }

      if (['note', 'link', 'snippet', 'todo', 'prompt', 'session'].includes(suggestion?._kind)) {
        const kind = resolveNormalResultKind(suggestion);
        if (!kind) return null;
        const hydratedItem = hydrateNormalItem(kind, suggestion);
        return {
          kind,
          item: { ...hydratedItem, category: kind },
          suggestion,
          originalIndex,
        };
      }

      const workspaceSuggestion =
        suggestion?._kind === 'workspace_item'
          ? suggestion
          : suggestion?._kind === 'command' && suggestion?.proxyEntity?._kind === 'workspace_item'
            ? suggestion.proxyEntity
            : null;
      const item = workspaceSuggestion?.item;
      if (!item) return null;

      const kind = resolveNormalResultKind(item);
      if (!kind) return null;
      const hydratedItem = hydrateNormalItem(kind, item);
      return {
        kind,
        item: { ...hydratedItem, category: kind },
        suggestion: workspaceSuggestion,
        originalIndex,
      };
    };

    const groupedRows = new Map<string, NormalCompactResult[]>();
    const getRowStableId = (row: NormalCompactResult) =>
      String(
        row.item?.id ||
          row.item?.snippet_id ||
          row.item?.linkid ||
          row.item?.todo_id ||
          row.item?.prompt_id ||
          row.item?.session_id ||
          row.item?.url ||
          `${row.kind}-${row.originalIndex}`,
      );
    const addGroupedRow = (row: NormalCompactResult | null) => {
      if (!row) return;
      const id = getRowStableId(row);
      const bucket = groupedRows.get(row.kind) || [];
      if (!bucket.some(existing => getRowStableId(existing) === id)) {
        bucket.push(row);
      }
      groupedRows.set(row.kind, bucket);
    };

    safeList(engineResults).forEach((suggestion: any, originalIndex: number) => {
      addGroupedRow(getSuggestionRow(suggestion, originalIndex));
    });

    const updateNoteRows: NormalCompactResult[] = [];
    const textCommandRows: NormalCompactResult[] = [];
    if (isBareCommandSpaceSearch) {
      const normalizedQuery = normalizeShortcutTrigger(query);
      const seenShortcuts = new Set<string>();
      safeList(commandSearchShortcuts).forEach((shortcut: any, originalIndex: number) => {
        const trigger = normalizeShortcutTrigger(String(shortcut?.trigger || ''));
        if (!trigger || !normalizedQuery) return;
        const rawAfterTrigger = rawAfterCommand.slice(trigger.length);
        const isUpdateNoteCommand =
          normalizeWebsiteCategory(shortcut?.referenceType) === 'note' &&
          rawAfterCommand.toLowerCase().startsWith(trigger) &&
          rawAfterTrigger.length > 0 &&
          /^\s/.test(rawAfterTrigger);
        if (!isUpdateNoteCommand && !trigger.includes(normalizedQuery)) return;
        const kind = resolveNormalResultKind({
          category: shortcut?.referenceType,
          referenceType: shortcut?.referenceType,
        });
        if (!kind) return;
        const target = findShortcutTarget(kind, shortcut);
        if (!target) return;
        const referenceId = getShortcutReferenceId(shortcut);
        const key = `${kind}:${referenceId}:${trigger}`;
        if (seenShortcuts.has(key)) return;
        seenShortcuts.add(key);
        const displayShortcut = getCommandShortcutDisplay(shortcut, kind);
        const updateFields = isUpdateNoteCommand
          ? parseNoteQuickCreateFields(rawAfterTrigger.trimStart(), {
              prefixSettings,
              prefixes: omniboxPrefixes,
            })
          : null;
        const updateRowMeta =
          updateFields && (updateFields.description || updateFields.tagNames.length > 0)
            ? [
                updateFields.description ? `Append: ${updateFields.description}` : null,
                updateFields.tagNames.length > 0 ? `Tags: ${updateFields.tagNames.join(', ')}` : null,
              ]
                .filter(Boolean)
                .join('  |  ')
            : `Tab: ${noteQuickCreatePrefixLabels.description} append description, ${noteQuickCreatePrefixLabels.tag} work, client`;
        const shortcutRow: NormalCompactResult = {
          kind: isUpdateNoteCommand ? 'update-note' : kind,
          item: {
            ...target,
            category: isUpdateNoteCommand ? 'update-note' : kind,
            _displayShortcut: displayShortcut,
            _userShortcutRecord: shortcut,
            _noteUpdateFields: updateFields,
            _noteUpdateCommandBase: `${commandPrefix} ${trigger}`,
            _noteUpdateRowMeta: updateRowMeta,
          },
          suggestion: {
            _kind: 'workspace_item',
            item: target,
            _userShortcutRecord: shortcut,
          },
          originalIndex,
        };
        if (isUpdateNoteCommand) {
          updateNoteRows.push(shortcutRow);
        } else {
          textCommandRows.push(shortcutRow);
        }
      });

      dropdownOptions.categories.forEach((category: any, originalIndex: number) => {
        addGroupedRow({
          kind: 'category',
          item: { ...category, category: 'category' },
          suggestion: category,
          originalIndex,
        });
      });
    }

    const groups: NormalCompactGroup[] = [
      {
        id: 'site-actions',
        title: 'This Site',
        items: dropdownOptions.thisSiteActions.map((opt: any, originalIndex: number) => ({
          kind: 'site-action',
          item: opt.item || opt,
          originalIndex,
        })),
      },
      {
        id: 'update-notes',
        title: 'Update Note',
        items: updateNoteRows,
      },
      {
        id: 'text-commands',
        title: 'Text Commands',
        items: textCommandRows,
      },
      {
        id: 'commands',
        title: 'Commands',
        items: groupedRows.get('command') || [],
      },
      {
        id: 'categories',
        title: 'Categories',
        items: groupedRows.get('category') || [],
      },
      {
        id: 'notes',
        title: 'Notes',
        items: groupedRows.get('note') || [],
      },
      {
        id: 'links',
        title: 'Links',
        items: groupedRows.get('link') || [],
      },
      {
        id: 'snippets',
        title: 'Text Expanders',
        items: groupedRows.get('snippet') || [],
      },
      {
        id: 'todos',
        title: 'Todos',
        items: groupedRows.get('todo') || [],
      },
      {
        id: 'bookmarks',
        title: 'Bookmarks',
        items: groupedRows.get('bookmark') || [],
      },
      {
        id: 'prompts',
        title: 'Chat Agents',
        items: groupedRows.get('prompt') || [],
      },
      {
        id: 'collections',
        title: 'Collections',
        items: groupedRows.get('collection') || [],
      },
    ];

    return groups.filter(group => group.items.length > 0);
  }, [
    allBookmarks,
    automations,
    commands,
    commonCommandEntries,
    commandSearchShortcuts,
    dbAiPrompts,
    dbSessions,
    debouncedCommandSpace.activeCategoryFilter,
    debouncedCommandSpace.isActive,
    debouncedSearchValue,
    dropdownOptions.categories,
    dropdownOptions.thisSiteActions,
    links,
    normalSearchQuery,
    notes,
    noteQuickCreatePrefixLabels.description,
    noteQuickCreatePrefixLabels.tag,
    omniboxPrefixes,
    prefixSettings,
    snippets,
    todos,
  ]);

  const normalCompactResults = useMemo(
    () => normalCompactGroups.flatMap(group => group.items),
    [normalCompactGroups],
  );
  const isNormalGroupedSearchMode = normalSearchQuery.length > 0;
  const selectedNormalCompactResult = useMemo(() => {
    if (!isNormalGroupedSearchMode || normalCompactResults.length === 0) return null;
    const selectedIndex = Math.max(0, Math.min(dropdownSelectedIndex, normalCompactResults.length - 1));
    return normalCompactResults[selectedIndex] || null;
  }, [dropdownSelectedIndex, isNormalGroupedSearchMode, normalCompactResults]);

  const getNextUpdateNoteField = useCallback(
    (fields: any) => {
      if (!String(fields?.description || '').trim()) {
        return {
          prefix: noteQuickCreatePrefixLabels.description,
          label: 'append description',
        };
      }
      if (!Array.isArray(fields?.tagNames) || fields.tagNames.length === 0) {
        return {
          prefix: noteQuickCreatePrefixLabels.tag,
          label: 'tags',
        };
      }
      return null;
    },
    [noteQuickCreatePrefixLabels.description, noteQuickCreatePrefixLabels.tag],
  );

  const selectedUpdateNoteSearchHint = useMemo(() => {
    if (selectedNormalCompactResult?.kind !== 'update-note') return null;
    const item = selectedNormalCompactResult.item || {};
    const nextField = getNextUpdateNoteField(item._noteUpdateFields);
    return nextField ? `Tab: ${nextField.prefix} ${nextField.label}` : null;
  }, [getNextUpdateNoteField, selectedNormalCompactResult]);

  // Reset dropdown selected index when search value changes so that it always starts at the first item (Categories)
  useEffect(() => {
    setDropdownSelectedIndex(0);
  }, [searchValue]);

  useEffect(() => {
    if (isCompactSubcommandMode) {
      setDropdownSelectedIndex(0);
    }
  }, [agentSearchValue, categorySearchValue, collectionSearchValue, isCompactSubcommandMode, linkSaveSearchValue, todoSaveSearchValue]);

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
      const sessionName = item.key || item.name || item.title || 'Untitled Collection';
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

      void launchSessionSmart({
        sessionId,
        sessionName,
        workspaceId,
        folderId: folderId || null,
        teamId: selectedTeam?.team_id,
        storageMode: selectedTeam?.storageMode ?? 'local',
        initialUrls,
        initialNames,
        openSettings,
        source: 'website',
      }).then(response => {
        if (!response?.ok || response?.skipped) return;
        const count = initialUrls.length;
        useUIStore.getState().queueNotification({
          message: `🚀 Collection "${sessionName}" started with ${count} tab${count !== 1 ? 's' : ''}`,
          type: 'success',
        });
      });

      onClose();
    },
    [defaultWorkspaceId, selectedTeam, onClose],
  );

  const exitCompactSubcommandMode = useCallback(() => {
    resetSubcommandMode();
    setIsDropdownVisible(true);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [resetSubcommandMode]);

  const openExistingCollectionSubcommand = useCallback(
    (url: string, title: string, query = '') => {
      if (!url) {
        useUIStore.getState().queueNotification({ message: 'Unable to detect page URL to add', type: 'error' });
        return;
      }
      openSubcommandMode('existing_collection', { query, target: { url, title: title || 'Untitled Page' } });
      setSearchValue('');
      setSelectedSidebarSection('all');
      setShowSidebarSectionPill(false);
      setIsDropdownVisible(true);
      setTimeout(() => searchInputRef.current?.focus(), 0);
    },
    [openSubcommandMode],
  );

  const openLinkSaveSubcommand = useCallback((url: string, title: string, query = '') => {
    if (!url) {
      useUIStore.getState().queueNotification({ message: 'Unable to detect page URL to save', type: 'error' });
      return;
    }
    void preloadLinkEditorView();
    openSubcommandMode('save_link', { query, target: { url, title: title || 'Untitled Page' } });
    setSearchValue('');
    setSelectedSidebarSection('all');
    setShowSidebarSectionPill(false);
    setIsDropdownVisible(true);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [openSubcommandMode]);

  const openTodoSaveSubcommand = useCallback((url: string, title: string, query = '') => {
    if (!url) {
      useUIStore.getState().queueNotification({ message: 'Unable to detect page URL to save', type: 'error' });
      return;
    }
    void preloadCreateTodoView();
    openSubcommandMode('save_todo', { query, target: { url, title: title || 'Untitled Page' } });
    setSearchValue('');
    setSelectedSidebarSection('all');
    setShowSidebarSectionPill(false);
    setIsDropdownVisible(true);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [openSubcommandMode]);

  const openNoteSaveSubcommand = useCallback((url: string, title: string, query = '') => {
    if (!url) {
      useUIStore.getState().queueNotification({ message: 'Unable to detect page URL to save', type: 'error' });
      return;
    }
    void preloadNoteEditorView();
    openSubcommandMode('save_note', { query, target: { url, title: title || 'Untitled Page' } });
    setSearchValue('');
    setSelectedSidebarSection('all');
    setShowSidebarSectionPill(false);
    setIsDropdownVisible(true);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [openSubcommandMode]);

  const openSnippetSaveSubcommand = useCallback((url: string, title: string, query = '') => {
    if (!url) {
      useUIStore.getState().queueNotification({ message: 'Unable to detect page URL to save', type: 'error' });
      return;
    }
    void preloadSnippetEditorView();
    openSubcommandMode('save_snippet', { query, target: { url, title: title || 'Untitled Page' } });
    setSearchValue('');
    setSelectedSidebarSection('all');
    setShowSidebarSectionPill(false);
    setIsDropdownVisible(true);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [openSubcommandMode]);

  const openCategorySubcommand = useCallback((category: string, query = '') => {
    const normalizedCategory = normalizeWebsiteCategory(category);
    if (
      normalizedCategory !== 'note' &&
      normalizedCategory !== 'link' &&
      normalizedCategory !== 'snippet' &&
      normalizedCategory !== 'todo' &&
      normalizedCategory !== 'bookmark' &&
      normalizedCategory !== 'session' &&
      normalizedCategory !== 'prompt' &&
      normalizedCategory !== 'command' &&
      normalizedCategory !== 'agent'
    ) return;
    const mode =
      normalizedCategory === 'link'
        ? 'category_link'
        : normalizedCategory === 'snippet'
          ? 'category_snippet'
          : normalizedCategory === 'todo'
            ? 'category_todo'
            : normalizedCategory === 'bookmark'
              ? 'category_bookmark'
              : normalizedCategory === 'session'
                ? 'category_collection'
              : normalizedCategory === 'command'
                ? 'category_command'
              : normalizedCategory === 'prompt' || normalizedCategory === 'agent'
                ? 'category_prompt'
                : 'category_note';
    openSubcommandMode(mode, { query });
    setSearchValue('');
    setSelectedSidebarSection('all');
    setShowSidebarSectionPill(false);
    setIsDropdownVisible(true);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [openSubcommandMode]);

  const activateNormalCategorySelection = useCallback((
    categoryName: string,
    options: { clearSidebarPill?: boolean } = {},
  ) => {
    const { clearSidebarPill = true } = options;
    const normalizedCategory = normalizeWebsiteCategory(categoryName);
    const categorySubcommandMode = CATEGORY_SUBCOMMAND_BY_NORMALIZED_NAME[normalizedCategory];

    if (categorySubcommandMode) {
      openCategorySubcommand(categorySubcommandMode);
      return;
    }

    setSelectedSidebarSection(categoryName);
    if (clearSidebarPill) {
      setShowSidebarSectionPill(false);
    }
    const alias = SECTION_ALIAS_DISPLAY[categoryName];
    const newSearchValue = categoryName === 'all' || !alias ? '' : `/${alias.toLowerCase()} `;
    setSearchValue(newSearchValue);
    setDropdownSelectedIndex(-1);
    setIsDropdownVisible(newSearchValue.trim() === '');
  }, [openCategorySubcommand, setDropdownSelectedIndex]);

  const isCurrentAiChatSite = useMemo(() => {
    return isSupportedAiChatSaveUrl(activeTabUrl);
  }, [activeTabUrl]);

  useEffect(() => {
    if (!isOpen || isCompactSubcommandMode || !searchValue.trim()) return;

    if (commandSpace.isActive && normalizeWebsiteCategory(commandSpace.activeCategoryFilter) === 'note') {
      openCategorySubcommand('note', commandSpace.actualQuery);
      return;
    }

    if (commandSpace.isActive && normalizeWebsiteCategory(commandSpace.activeCategoryFilter) === 'link') {
      openCategorySubcommand('link', commandSpace.actualQuery);
      return;
    }

    if (commandSpace.isActive && normalizeWebsiteCategory(commandSpace.activeCategoryFilter) === 'snippet') {
      openCategorySubcommand('snippet', commandSpace.actualQuery);
      return;
    }

    if (commandSpace.isActive && normalizeWebsiteCategory(commandSpace.activeCategoryFilter) === 'todo') {
      openCategorySubcommand('todo', commandSpace.actualQuery);
      return;
    }

    if (commandSpace.isActive && normalizeWebsiteCategory(commandSpace.activeCategoryFilter) === 'bookmark') {
      openCategorySubcommand('bookmark', commandSpace.actualQuery);
      return;
    }

    if (
      commandSpace.isActive &&
      ['prompt', 'agent'].includes(normalizeWebsiteCategory(commandSpace.activeCategoryFilter))
    ) {
      if (normalizeWebsiteCategory(commandSpace.activeCategoryFilter) === 'agent' && isCurrentAiChatSite) {
        const targetUrl =
          activeTabUrl ||
          (window.location.href.startsWith('chrome-extension://') ? '' : window.location.href);
        const targetTitle = activeTabTitle || document.title || 'Untitled Chat';
        openSubcommandMode('save_chat', {
          query: commandSpace.actualQuery,
          target: { url: targetUrl, title: targetTitle },
        });
        setSearchValue('');
        setSelectedSidebarSection('all');
        setShowSidebarSectionPill(false);
        setIsDropdownVisible(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
        return;
      }
      openCategorySubcommand('prompt', commandSpace.actualQuery);
      return;
    }

    if (commandSpace.isActive && normalizeWebsiteCategory(commandSpace.activeCategoryFilter) === 'session') {
      openCategorySubcommand('collection', commandSpace.actualQuery);
      return;
    }

    const slashMode = parseAtMode(searchValue, omniboxPrefixes);
    if (slashMode.activeSection && normalizeWebsiteCategory(slashMode.activeSection) === 'note') {
      openCategorySubcommand('note', slashMode.searchQuery);
      return;
    }

    if (slashMode.activeSection && normalizeWebsiteCategory(slashMode.activeSection) === 'link') {
      openCategorySubcommand('link', slashMode.searchQuery);
      return;
    }

    if (slashMode.activeSection && normalizeWebsiteCategory(slashMode.activeSection) === 'snippet') {
      openCategorySubcommand('snippet', slashMode.searchQuery);
      return;
    }

    if (slashMode.activeSection && normalizeWebsiteCategory(slashMode.activeSection) === 'todo') {
      openCategorySubcommand('todo', slashMode.searchQuery);
      return;
    }

    if (slashMode.activeSection && normalizeWebsiteCategory(slashMode.activeSection) === 'bookmark') {
      openCategorySubcommand('bookmark', slashMode.searchQuery);
      return;
    }

    if (
      searchValue.startsWith('/') &&
      slashMode.activeSection &&
      normalizeWebsiteCategory(slashMode.activeSection) === 'command'
    ) {
      openCategorySubcommand('command', slashMode.searchQuery);
      return;
    }

    if (slashMode.activeSection && ['prompt', 'agent'].includes(normalizeWebsiteCategory(slashMode.activeSection))) {
      openCategorySubcommand('prompt', slashMode.searchQuery);
      return;
    }

    if (slashMode.activeSection && normalizeWebsiteCategory(slashMode.activeSection) === 'session') {
      openCategorySubcommand('collection', slashMode.searchQuery);
    }
  }, [
    commandSpace,
    activeTabTitle,
    activeTabUrl,
    isCurrentAiChatSite,
    isCompactSubcommandMode,
    isOpen,
    omniboxPrefixes,
    openCategorySubcommand,
    openSubcommandMode,
    searchValue,
  ]);

  const openSendToAgentSubcommand = useCallback(
    (url: string, title: string) => {
      if (!url) {
        useUIStore.getState().queueNotification({ message: 'Unable to detect page URL to send', type: 'error' });
        return;
      }
      openSubcommandMode('send_to_agent', { target: { url, title: title || 'Untitled Page' } });
      setSearchValue('');
      setSelectedSidebarSection('all');
      setShowSidebarSectionPill(false);
      setIsDropdownVisible(true);
      setTimeout(() => searchInputRef.current?.focus(), 0);
    },
    [openSubcommandMode],
  );

  const openCreateCollectionDialog = useCallback(() => {
    const targetUrl =
      existingCollectionTarget?.url ||
      activeTabUrl ||
      (window.location.href.startsWith('chrome-extension://') ? '' : window.location.href);
    const targetTitle = existingCollectionTarget?.title || activeTabTitle || document.title || 'Untitled Page';
    const typedTitle = collectionSearchValue.trim();
    const urls = targetUrl
      ? [
          {
            id: generateEntityId('linkItem'),
            title: targetTitle,
            url: targetUrl,
          },
        ]
      : [];

    setCreateCollectionDraft({
      ...createEmptySessionDraft(),
      title: typedTitle,
      urls,
      workspaceId: defaultWorkspaceId,
    });
    setStagedCreateCollectionWidgets([]);
    setCreateCollectionActionError(null);
    setCreateCollectionDialog({
      mode: 'create',
      title: typedTitle,
      shortcut: '',
      hotkey: '',
      viewIconId: DEFAULT_VIEW_ICON_ID,
    });
    setCompactSubcommandMode('none');
    setCollectionSearchValue('');
    setSearchValue('');
    setDropdownSelectedIndex(-1);
    setIsDropdownVisible(false);
  }, [activeTabTitle, activeTabUrl, collectionSearchValue, defaultWorkspaceId, existingCollectionTarget]);

  const closeCreateCollectionDialog = useCallback(() => {
    setCreateCollectionDialog(null);
    setCreateCollectionActionError(null);
    setStagedCreateCollectionWidgets([]);
    setCreateCollectionDraft(createEmptySessionDraft());
    setPendingCreateCollectionWidgetIds(new Set());
    setCompactSubcommandMode('existing_collection');
    setIsDropdownVisible(true);
    setDropdownSelectedIndex(0);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  }, []);

  const handleStageCreateCollectionWidget = useCallback((item: WidgetCatalogItem) => {
    setStagedCreateCollectionWidgets(prev => [...prev, item]);
  }, []);

  const handleRemoveStagedCreateCollectionWidget = useCallback((index: number) => {
    setStagedCreateCollectionWidgets(prev => prev.filter((_, itemIndex) => itemIndex !== index));
  }, []);

  const handleSubmitCreateCollectionDialog = useCallback(async () => {
    if (!createCollectionDialog) return;

    setPendingCreateCollectionActionId('create');
    setCreateCollectionActionError(null);
    try {
      const workspaceId = defaultWorkspaceId || allWorkspaces[0]?.id || 'default';
      const shortcut = createCollectionDialog.shortcut || '';
      const hotkey = createCollectionDialog.hotkey ? normalizeHotkeyString(createCollectionDialog.hotkey) : '';
      const widgets = stagedCreateCollectionWidgets.map(item => {
        const categoryId = WIDGET_CATALOG_CATEGORIES.find(category =>
          category.items.some(categoryItem => categoryItem.id === item.id),
        )?.id;
        return {
          widgetInput: {
            categoryId,
            title: item.title,
            type: item.type,
            settings: getDefaultWidgetSettings(item.type),
            sizePreset: item.sizePreset,
          },
          layout: item.layout,
        };
      });

      setPendingCreateCollectionWidgetIds(new Set(stagedCreateCollectionWidgets.map(item => item.id)));
      const chromeAny = (window as any).chrome;
      if (!chromeAny?.runtime?.sendMessage) {
        throw new Error('Extension background is unavailable.');
      }
      const response = await chromeAny.runtime.sendMessage({
        action: 'alts_create_collection_view',
        userId: userId || 'local_user',
        payload: {
          title: createCollectionDialog.title,
          viewIconId: createCollectionDialog.viewIconId,
          workspaceId,
          shortcut,
          hotkey,
          draftSession: {
            title: createCollectionDraft.title,
            urls: createCollectionDraft.urls,
            sessionOpenSettings: createCollectionDraft.sessionOpenSettings,
            workspaceId: createCollectionDraft.workspaceId || workspaceId,
            folderId: createCollectionDraft.folderId,
            tagIds: createCollectionDraft.tagIds,
          },
          widgets,
        },
      });
      if (!response?.success) throw new Error(response?.error || 'Failed to create collection');

      syncDbFromBackground();
      useUIStore.getState().queueNotification({
        message: `Created "${createCollectionDialog.title || 'Collection'}" successfully`,
        type: 'success',
      });
      setCreateCollectionDialog(null);
      setCreateCollectionActionError(null);
      setStagedCreateCollectionWidgets([]);
      setCreateCollectionDraft(createEmptySessionDraft());
      setPendingCreateCollectionWidgetIds(new Set());
      setSearchValue('');
      resetSubcommandMode();
      setIsDropdownVisible(true);
    } catch (error: any) {
      console.error('[AltS Website] Failed to create collection:', error);
      setCreateCollectionActionError(error?.message || 'Failed to create collection');
    } finally {
      setPendingCreateCollectionActionId(null);
      setPendingCreateCollectionWidgetIds(new Set());
    }
  }, [
    allWorkspaces,
    closeCreateCollectionDialog,
    createCollectionDialog,
    createCollectionDraft,
    defaultWorkspaceId,
    onClose,
    resetSubcommandMode,
    stagedCreateCollectionWidgets,
    syncDbFromBackground,
    userId,
  ]);

  useEffect(() => {
    let active = true;
    const checkShortcut = async () => {
      if (!createCollectionDialog) return;
      const shortcut = createCollectionDialog.shortcut || '';
      if (!shortcut) {
        setCreateCollectionDialog(prev =>
          prev ? { ...prev, shortcutError: null, isShortcutOverrideable: false, shortcutConflictId: null } : prev,
        );
        return;
      }
      const result = await validateShortcut(shortcut, 'new');
      if (!active) return;
      setCreateCollectionDialog(prev =>
        prev
          ? {
              ...prev,
              shortcutError: result.isValid ? null : result.errorMessage || 'This shortcut is already taken.',
              isShortcutOverrideable: !!result.isOverrideable,
              shortcutConflictId: result.conflictId || null,
            }
          : prev,
      );
    };
    void checkShortcut();
    return () => {
      active = false;
    };
  }, [createCollectionDialog?.shortcut, validateShortcut]);

  useEffect(() => {
    let active = true;
    const checkHotkey = async () => {
      if (!createCollectionDialog) return;
      const result = await validateHotkey(createCollectionDialog.hotkey || '', 'new');
      if (!active) return;
      setCreateCollectionDialog(prev =>
        prev ? { ...prev, hotkeyError: result.isValid ? null : result.errorMessage || 'This hotkey is already taken.' } : prev,
      );
    };
    void checkHotkey();
    return () => {
      active = false;
    };
  }, [createCollectionDialog?.hotkey, validateHotkey]);

  const buildWebpageAgentContext = useCallback((basePrompt: string, url: string, title: string) => {
    const directDomText = document.body
      ? (document.body.innerText || document.body.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 12000)
      : '';
    const promptText = String(basePrompt || '').trim() || 'Use this webpage context.';

    return directDomText
      ? `${promptText}

Triggered from Alt+S Website Popup: Send to Agent

Webpage:
Title: ${title || 'Untitled Page'}
URL: ${url}

Page content:
---
${directDomText}
---`
      : `${promptText}

Triggered from Alt+S Website Popup: Send to Agent

Webpage:
Title: ${title || 'Untitled Page'}
URL: ${url}`;
  }, []);

  const inferAutoSubmitKindFromUrl = useCallback((url: string): 'chatgpt' | 'claude' | 'gemini' | 'perplexity' => {
    const lower = url.toLowerCase();
    if (lower.includes('claude.ai')) return 'claude';
    if (lower.includes('gemini.google.com')) return 'gemini';
    if (lower.includes('perplexity.ai')) return 'perplexity';
    return 'chatgpt';
  }, []);

  const inferModelIdFromUrl = useCallback((url: string) => {
    const lower = url.toLowerCase();
    if (lower.includes('claude.ai')) return 'claude';
    if (lower.includes('gemini.google.com')) return 'gemini';
    if (lower.includes('perplexity.ai')) return 'perplexity';
    return 'gpt';
  }, []);

  const openChatAgentWithPrompt = useCallback(
    async (agentRecord: ChatAgentRecord, promptText: string) => {
      const chromeApi = globalThis.chrome;
      const urls = (Array.isArray(agentRecord.urls) ? agentRecord.urls : [])
        .filter((rawUrl: string) => typeof rawUrl === 'string' && rawUrl.trim())
        .map((rawUrl: string) => stripCmdStatus(rawUrl));

      if (!chromeApi?.runtime?.sendMessage || urls.length === 0) {
        throw new Error('No runnable chat agent URLs were found.');
      }

      const openedTabs = await Promise.all(
        urls.map(
          (url: string) =>
            new Promise<{ tabId: number; modelId: string } | null>(resolve => {
              const modelId = inferModelIdFromUrl(url);
              chromeApi.runtime.sendMessage(
                {
                  action: 'open_tab_with_auto_submit',
                  url,
                  autoSubmit: {
                    kind: inferAutoSubmitKindFromUrl(url),
                    prompt: promptText,
                  },
                  forceNewTab: true,
                },
                (response: any) => {
                  if (chromeApi.runtime.lastError) {
                    console.error('[AltS-Website] Failed to launch chat agent URL:', chromeApi.runtime.lastError.message);
                    resolve(null);
                    return;
                  }
                  resolve(typeof response?.tabId === 'number' ? { tabId: response.tabId, modelId } : null);
                },
              );
            }),
        ),
      );

      const successfulTabs = openedTabs.filter(
        (entry): entry is { tabId: number; modelId: string } => entry !== null,
      );
      if (successfulTabs.length > 0) {
        chromeApi.runtime.sendMessage({
          action: 'track_ai_session',
          prompt: promptText,
          tabIds: successfulTabs.map(entry => entry.tabId),
          models: successfulTabs.map(entry => entry.modelId),
        });
      }
    },
    [inferAutoSubmitKindFromUrl, inferModelIdFromUrl],
  );

  const sendPageToAgentPickerItem = useCallback(
    async (pickerItem: { kind: 'prompt' | 'agent'; record: AiPromptRecord | ChatAgentRecord; title: string }) => {
      try {
        const targetUrl =
          sendToAgentTarget?.url ||
          activeTabUrl ||
          (window.location.href.startsWith('chrome-extension://') ? '' : window.location.href);
        const targetTitle = sendToAgentTarget?.title || activeTabTitle || document.title || 'Untitled Page';

        if (!targetUrl) {
          useUIStore.getState().queueNotification({ message: 'Unable to detect page URL to send', type: 'error' });
          return;
        }

        if (pickerItem.kind === 'prompt') {
          const promptRecord = pickerItem.record as AiPromptRecord;
          const rulesText = String(promptRecord.rules || '').trim();
          const pageContext = buildWebpageAgentContext(
            rulesText ? `Instructions:\n${rulesText}` : '',
            targetUrl,
            targetTitle,
          );
          await runAiPrompt(promptRecord, pageContext);
        } else {
          const promptText = buildWebpageAgentContext('', targetUrl, targetTitle);
          await openChatAgentWithPrompt(pickerItem.record as ChatAgentRecord, promptText);
        }

        resetSubcommandMode();
        setSearchValue('');
        setDropdownSelectedIndex(-1);
        setIsDropdownVisible(false);
        onClose();
      } catch (err) {
        console.error('[AltS-Website] Failed to send page to agent:', err);
        useUIStore.getState().queueNotification({ message: 'Failed to send page to agent', type: 'error' });
      }
    },
    [
      activeTabTitle,
      activeTabUrl,
      buildWebpageAgentContext,
      onClose,
      openChatAgentWithPrompt,
      resetSubcommandMode,
      sendToAgentTarget,
    ],
  );

  const savePageToExistingCollection = useCallback(
    async (sessionItem: any) => {
      try {
        const targetUrl =
          existingCollectionTarget?.url ||
          activeTabUrl ||
          (window.location.href.startsWith('chrome-extension://') ? '' : window.location.href);
        const targetTitle = existingCollectionTarget?.title || activeTabTitle || document.title || 'Untitled Page';

        if (!targetUrl) {
          useUIStore.getState().queueNotification({ message: 'Unable to detect page URL to add', type: 'error' });
          return;
        }

        const currentUrls = Array.isArray(sessionItem.urls) ? sessionItem.urls : [];
        const newItem = {
          id: generateEntityId('linkItem'),
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
        resetSubcommandMode();
        setSearchValue('');
        setDropdownSelectedIndex(-1);
        setIsDropdownVisible(false);

        useUIStore.getState().queueNotification({
          message: `Added to "${sessionItem.title || sessionItem.sessionName || 'Collection'}" successfully`,
          type: 'success',
        });
      } catch (err) {
        console.error('Failed to add url to existing session:', err);
        useUIStore.getState().queueNotification({ message: 'Failed to add URL to collection', type: 'error' });
      }
    },
    [activeTabTitle, activeTabUrl, existingCollectionTarget, resetSubcommandMode, syncDbFromBackground],
  );

  const createLinkRecordForPage = useCallback(
    async (target: { url: string; title: string }, titleOverride?: string) => {
      const targetUrl = target.url;
      const targetTitle = target.title || 'Untitled Page';

      if (!targetUrl) {
        throw new Error('Unable to detect page URL to save');
      }

      setOptimisticSavedUrls(prev => [...prev, targetUrl]);
      const wsId = defaultWorkspaceId || allWorkspaces[0]?.id || null;
      const response: any = await new Promise(resolve => {
        chrome.runtime.sendMessage(
          {
            action: 'db_create_link',
            input: {
              workspaceId: wsId || undefined,
              title: String(titleOverride || '').trim() || targetTitle,
              urls: [
                {
                  id: generateEntityId('linkItem'),
                  title: targetTitle,
                  name: targetTitle,
                  url: targetUrl,
                  source: 'tab',
                },
              ],
              tagIds: [],
            },
          },
          resolve,
        );
      });

      if (!response?.success || !response?.link) {
        throw new Error(response?.error || 'Failed to create link via background');
      }

      return response.link;
    },
    [allWorkspaces, defaultWorkspaceId],
  );

  const saveLinkFromAltSOverlay = useCallback(
    async ({ mode, linkId, input }: { mode: 'create' | 'update'; linkId?: string; input: any }) => {
      const chromeAny = (window as any).chrome;
      if (!chromeAny?.runtime?.sendMessage) {
        throw new Error('Extension background is unavailable.');
      }

      const response: any = await new Promise(resolve => {
        chromeAny.runtime.sendMessage(
          mode === 'update'
            ? { action: 'db_update_link', linkId, input }
            : { action: 'db_create_link', input },
          resolve,
        );
      });

      if (!response?.success || !response?.link) {
        throw new Error(response?.error || 'Failed to save link via background');
      }

      const createdUrls = Array.isArray(response.link.urls)
        ? response.link.urls.map((item: any) => item?.url).filter(Boolean)
        : [];
      if (createdUrls.length > 0) {
        setOptimisticSavedUrls(prev => [...prev, ...createdUrls]);
      }
      scheduleAltSEditorDbRefresh();
      return response.link;
    },
    [scheduleAltSEditorDbRefresh],
  );

  const sendAltSPropertyPersistenceMessage = useCallback(
    async (action: string, payload: Record<string, any>) => {
      const chromeAny = (window as any).chrome;
      if (!chromeAny?.runtime?.sendMessage) {
        throw new Error('Extension background is unavailable.');
      }

      const response: any = await new Promise(resolve => {
        chromeAny.runtime.sendMessage({ action, payload, userId: userId || 'local_user' }, resolve);
      });

      if (!response?.success) {
        throw new Error(response?.error || `Failed to persist ${action}`);
      }

      scheduleAltSEditorDbRefresh();
      return response;
    },
    [scheduleAltSEditorDbRefresh, userId],
  );

  const altsPropertyPersistenceAdapter = useMemo(
    () => ({
      saveHotkey: ({ id, referenceId, hotkey, type }: { id: string; referenceId: string; hotkey: string; type: string }) =>
        sendAltSPropertyPersistenceMessage('api_save_hotkey', { id, referenceId, hotkey, type }),
      clearHotkey: ({ id, referenceId, type }: { id: string; referenceId: string; type: string }) =>
        sendAltSPropertyPersistenceMessage('api_clear_hotkey', { id, referenceId, type }),
      saveShortcut: ({
        id,
        referenceId,
        shortcut,
        label,
        type,
      }: {
        id: string;
        referenceId: string;
        shortcut: string;
        label: string;
        type: string;
      }) =>
        sendAltSPropertyPersistenceMessage('api_save_shortcut', {
          id,
          referenceId,
          trigger: shortcut,
          shortcut,
          label,
          type,
        }),
      clearShortcut: ({ id, referenceId, type }: { id: string; referenceId: string; type: string }) =>
        sendAltSPropertyPersistenceMessage('api_clear_shortcut', { id, referenceId, type }),
      addFavorite: ({ referenceId, referenceType, label }: { referenceId: string; referenceType: string; label: string }) =>
        sendAltSPropertyPersistenceMessage('api_add_favorite', { referenceId, referenceType, label }),
      removeFavorite: ({ referenceId }: { referenceId: string }) =>
        sendAltSPropertyPersistenceMessage('api_remove_favorite', { referenceId }),
      createTag: async ({ name, workspaceId }: { name: string; workspaceId: string }) => {
        const response = await sendAltSPropertyPersistenceMessage('api_create_tag', { name, workspaceId });
        return response.tag;
      },
      updateTag: ({ tagId, updates }: { tagId: string; updates: Record<string, any> }) =>
        sendAltSPropertyPersistenceMessage('api_update_tag', { tagId, updates }),
      deleteTag: ({ tagId }: { tagId: string }) =>
        sendAltSPropertyPersistenceMessage('api_delete_tag', { tagId }),
      createTodo: async ({
        title,
        references,
        scheduleType,
        scheduleTime,
        recurringCycle,
        description,
        tagIds,
        shortcut,
        workspaceId,
        folderId,
      }: {
        title: string;
        references: Array<{ type: string; id: string; name: string }>;
        scheduleType: string;
        scheduleTime: number;
        recurringCycle?: string;
        description?: string;
        tagIds?: string[];
        shortcut?: string;
        workspaceId?: string | null;
        folderId?: string | null;
      }) => {
        const response = await sendAltSPropertyPersistenceMessage('db_create_todo', {
          title,
          references,
          scheduleType,
          scheduleTime,
          recurringCycle,
          description,
          tagIds,
          shortcut,
          workspaceId,
          folderId,
        });
        return response.todo;
      },
    }),
    [sendAltSPropertyPersistenceMessage],
  );

  const closeLinkEditorOverlay = useCallback(() => {
    closeOverlayToPreviousSubcommand();
    setIsDropdownVisible(true);
    setDropdownSelectedIndex(0);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [closeOverlayToPreviousSubcommand, setDropdownSelectedIndex]);

  const completeLinkEditorOverlay = useCallback(() => {
    completeOverlay();
    setSearchValue('');
    setDropdownSelectedIndex(-1);
    setIsDropdownVisible(false);
    useUIStore.getState().queueNotification({ message: 'Link saved', type: 'success' });
    onClose();
  }, [completeOverlay, onClose, setDropdownSelectedIndex]);

  const closeTodoEditorOverlay = useCallback(() => {
    closeOverlayToPreviousSubcommand();
    setIsDropdownVisible(true);
    setDropdownSelectedIndex(0);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [closeOverlayToPreviousSubcommand, setDropdownSelectedIndex]);

  const closeNoteEditorOverlay = useCallback(() => {
    closeOverlayToPreviousSubcommand();
    setIsDropdownVisible(true);
    setDropdownSelectedIndex(0);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [closeOverlayToPreviousSubcommand, setDropdownSelectedIndex]);

  const completeTodoEditorOverlay = useCallback(() => {
    completeOverlay();
    setSearchValue('');
    setDropdownSelectedIndex(-1);
    setIsDropdownVisible(false);
    useUIStore.getState().queueNotification({ message: 'Todo saved', type: 'success' });
    onClose();
  }, [completeOverlay, onClose, setDropdownSelectedIndex]);

  const closeSnippetEditorOverlay = useCallback(() => {
    closeOverlayToPreviousSubcommand();
    setIsDropdownVisible(true);
    setDropdownSelectedIndex(0);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [closeOverlayToPreviousSubcommand, setDropdownSelectedIndex]);

  const closeAiPromptEditorOverlay = useCallback(() => {
    closeOverlayToPreviousSubcommand();
    setIsDropdownVisible(true);
    setDropdownSelectedIndex(0);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [closeOverlayToPreviousSubcommand, setDropdownSelectedIndex]);

  const getTodoSaveTarget = useCallback(() => {
    const targetUrl =
      todoSaveTarget?.url ||
      activeTabUrl ||
      (window.location.href.startsWith('chrome-extension://') ? '' : window.location.href);
    const targetTitle = todoSaveTarget?.title || activeTabTitle || document.title || 'Untitled Page';
    return { url: targetUrl, title: targetTitle };
  }, [activeTabTitle, activeTabUrl, todoSaveTarget]);

  const getNoteSaveTarget = useCallback(() => {
    const targetUrl =
      noteSaveTarget?.url ||
      activeTabUrl ||
      (window.location.href.startsWith('chrome-extension://') ? '' : window.location.href);
    const targetTitle = noteSaveTarget?.title || activeTabTitle || document.title || 'Untitled Page';
    return { url: targetUrl, title: targetTitle };
  }, [activeTabTitle, activeTabUrl, noteSaveTarget]);

  const getSnippetSaveTarget = useCallback(() => {
    const targetUrl =
      snippetSaveTarget?.url ||
      activeTabUrl ||
      (window.location.href.startsWith('chrome-extension://') ? '' : window.location.href);
    const targetTitle = snippetSaveTarget?.title || activeTabTitle || document.title || 'Untitled Page';
    return { url: targetUrl, title: targetTitle };
  }, [activeTabTitle, activeTabUrl, snippetSaveTarget]);

  const getChatSaveTarget = useCallback(() => {
    const targetUrl =
      sendToAgentTarget?.url ||
      activeTabUrl ||
      (window.location.href.startsWith('chrome-extension://') ? '' : window.location.href);
    const targetTitle = sendToAgentTarget?.title || activeTabTitle || document.title || 'Untitled Page';
    return { url: targetUrl, title: targetTitle };
  }, [activeTabTitle, activeTabUrl, sendToAgentTarget]);

  const createSavedLinkFromCurrentPage = useCallback(
    async () => {
      const targetUrl =
        linkSaveTarget?.url ||
        activeTabUrl ||
        (window.location.href.startsWith('chrome-extension://') ? '' : window.location.href);
      const targetTitle = linkSaveTarget?.title || activeTabTitle || document.title || 'Untitled Page';

      if (!targetUrl) {
        useUIStore.getState().queueNotification({ message: 'Unable to detect page URL to save', type: 'error' });
        return;
      }

      await preloadLinkEditorView();
      openLinkEditorOverlay(
        { url: targetUrl, title: targetTitle },
        { previousMode: 'save_link' },
      );
      setSearchValue('');
      setDropdownSelectedIndex(-1);
      setIsDropdownVisible(false);
    },
    [activeTabTitle, activeTabUrl, linkSaveTarget, openLinkEditorOverlay, setDropdownSelectedIndex],
  );

  const openTodoEditorFromCurrentPage = useCallback(
    async () => {
      const target = getTodoSaveTarget();
      if (!target.url) {
        useUIStore.getState().queueNotification({ message: 'Unable to detect page URL to save', type: 'error' });
        return;
      }

      await preloadCreateTodoView();
      openTodoEditorOverlay(target, { previousMode: 'save_todo' });
      setSearchValue('');
      setDropdownSelectedIndex(-1);
      setIsDropdownVisible(false);
    },
    [getTodoSaveTarget, openTodoEditorOverlay, setDropdownSelectedIndex],
  );

  const openNoteEditorFromCurrentPage = useCallback(
    async () => {
      const target = getNoteSaveTarget();
      if (!target.url) {
        useUIStore.getState().queueNotification({ message: 'Unable to detect page URL to save', type: 'error' });
        return;
      }

      await preloadNoteEditorView();
      openNoteEditorOverlay(target, { previousMode: 'save_note' });
      setSearchValue('');
      setDropdownSelectedIndex(-1);
      setIsDropdownVisible(false);
    },
    [getNoteSaveTarget, openNoteEditorOverlay, setDropdownSelectedIndex],
  );

  const openSnippetEditorFromCurrentPage = useCallback(
    async () => {
      const target = getSnippetSaveTarget();

      await preloadSnippetEditorView();
      openSnippetEditorOverlay(target, { previousMode: 'save_snippet' });
      setSearchValue('');
      setDropdownSelectedIndex(-1);
      setIsDropdownVisible(false);
    },
    [getSnippetSaveTarget, openSnippetEditorOverlay, setDropdownSelectedIndex],
  );

  const openChatSaveSubcommand = useCallback(
    (url: string, title: string) => {
      if (!url || !isSupportedAiChatSaveUrl(url)) {
        useUIStore.getState().queueNotification({ message: 'Unable to detect AI chat URL to save', type: 'error' });
        return;
      }
      openSubcommandMode('save_chat', { target: { url, title: title || 'Untitled Chat' } });
      setSearchValue('');
      setSelectedSidebarSection('all');
      setShowSidebarSectionPill(false);
      setIsDropdownVisible(true);
      setTimeout(() => searchInputRef.current?.focus(), 0);
    },
    [openSubcommandMode],
  );

  const createChatAgentFromCurrentPage = useCallback(
    async () => {
      const target = getChatSaveTarget();
      if (!target.url || !isSupportedAiChatSaveUrl(target.url)) {
        useUIStore.getState().queueNotification({ message: 'Unable to detect AI chat URL to save', type: 'error' });
        return;
      }

      await preloadAiPromptEditorView();
      openAiPromptEditorOverlay(target, { previousMode: 'save_chat' });
      setSearchValue('');
      setDropdownSelectedIndex(-1);
      setIsDropdownVisible(false);
    },
    [getChatSaveTarget, openAiPromptEditorOverlay, setDropdownSelectedIndex],
  );

  const saveNoteFromAltSOverlay = useCallback(
    async ({ mode, noteId, input }: { mode: 'create' | 'update'; noteId?: string; input: any }) => {
      const chromeAny = (window as any).chrome;
      if (!chromeAny?.runtime?.sendMessage) {
        throw new Error('Extension background is unavailable.');
      }
      const wsId = input?.workspaceId || defaultWorkspaceId || allWorkspaces[0]?.id || undefined;
      const response: any = await new Promise(resolve => {
        chromeAny.runtime.sendMessage(
          mode === 'update'
            ? { action: 'db_update_note', noteId, input: { ...input, workspaceId: wsId } }
            : { action: 'db_create_note', input: { ...input, workspaceId: wsId } },
          resolve,
        );
      });

      if (!response?.success || !response?.note) {
        throw new Error(response?.error || 'Failed to save note via background');
      }

      scheduleAltSEditorDbRefresh();
      return response.note;
    },
    [allWorkspaces, defaultWorkspaceId, scheduleAltSEditorDbRefresh],
  );

  const createNoteFromCategoryCommand = useCallback(async () => {
    if (!noteQuickCreateFields.hasCreateIntent) return;
    const title = noteQuickCreateFields.title.trim();
    if (!title) {
      startNoteQuickCreateCommand();
      useUIStore.getState().queueNotification({
        message: `Add a title with ${noteQuickCreatePrefixLabels.title} before creating the note`,
        type: 'error',
      });
      return;
    }

    try {
      const workspaceId = defaultWorkspaceId || allWorkspaces[0]?.id || undefined;
      const tagIds: string[] = [];

      if (workspaceId) {
        for (const tagName of noteQuickCreateFields.tagNames) {
          const response = await sendAltSPropertyPersistenceMessage('api_create_tag', {
            name: tagName,
            workspaceId,
          });
          if (response?.tag?.id) {
            tagIds.push(response.tag.id);
          }
        }
      }

      const note = await saveNoteFromAltSOverlay({
        mode: 'create',
        input: {
          workspaceId,
          title,
          body: buildQuickCreateNoteBodyHtml(noteQuickCreateFields.description),
          tagIds,
        },
      });

      syncDbFromBackground();
      resetSubcommandMode();
      setSearchValue('');
      setDropdownSelectedIndex(-1);
      setIsDropdownVisible(false);
      useUIStore.getState().queueNotification({
        message: `Created "${note.title || 'Note'}" successfully`,
        type: 'success',
      });
      onClose();
    } catch (err) {
      console.error('[AltS-Website] Failed to quick-create note:', err);
      useUIStore.getState().queueNotification({ message: 'Failed to create note', type: 'error' });
    }
  }, [
    allWorkspaces,
    defaultWorkspaceId,
    noteQuickCreateFields,
    noteQuickCreatePrefixLabels.title,
    onClose,
    resetSubcommandMode,
    saveNoteFromAltSOverlay,
    sendAltSPropertyPersistenceMessage,
    setDropdownSelectedIndex,
    startNoteQuickCreateCommand,
    syncDbFromBackground,
  ]);

  const noteQuickCreateAction = useCallback(() => {
    if (noteQuickCreateFields.hasCreateIntent) {
      void createNoteFromCategoryCommand();
      return;
    }
    startNoteQuickCreateCommand();
  }, [createNoteFromCategoryCommand, noteQuickCreateFields.hasCreateIntent, startNoteQuickCreateCommand]);

  const focusTodoQuickCreateInput = useCallback((nextValue: string, cursorPosition: number) => {
    openSubcommandMode('category_todo', { query: nextValue });
    setDropdownSelectedIndex(0);
    setIsDropdownVisible(true);
    window.requestAnimationFrame(() => {
      const state = useAltSCommandStore.getState();
      if (state.compactSubcommandMode !== 'category_todo' || state.categorySearchValue !== nextValue) {
        state.openSubcommandMode('category_todo', { query: nextValue });
      }
      setIsDropdownVisible(true);
      const input = searchInputRef.current;
      input?.focus();
      input?.setSelectionRange(cursorPosition, cursorPosition);
    });
  }, [openSubcommandMode, setDropdownSelectedIndex]);

  const insertNextTodoQuickCreateField = useCallback(() => {
    if (!isTodoCategoryMode || !nextTodoQuickCreateField) return;

    const baseValue = categorySearchValue.trim();
    const insertion = `${nextTodoQuickCreateField.prefix} `;
    const separator = baseValue ? ' ' : '';
    const nextValue = `${baseValue}${separator}${insertion}`;
    focusTodoQuickCreateInput(nextValue, nextValue.length);
    if (['recurring', 'time', 'reference'].includes(nextTodoQuickCreateField.field)) {
      setTodoQuickCreatePopup(nextTodoQuickCreateField.field as 'recurring' | 'time' | 'reference');
    }
  }, [
    categorySearchValue,
    focusTodoQuickCreateInput,
    isTodoCategoryMode,
    nextTodoQuickCreateField,
  ]);

  const getTodoQuickCreatePrefixEntries = useCallback(() => {
    return [
      { field: 'title' as const, prefix: todoQuickCreatePrefixLabels.title, label: 'title' },
      { field: 'description' as const, prefix: todoQuickCreatePrefixLabels.description, label: 'description' },
      { field: 'recurring' as const, prefix: todoQuickCreatePrefixLabels.recurring, label: 'recurring' },
      { field: 'time' as const, prefix: todoQuickCreatePrefixLabels.time, label: 'time' },
      { field: 'reference' as const, prefix: todoQuickCreatePrefixLabels.reference, label: 'attach' },
      { field: 'tag' as const, prefix: todoQuickCreatePrefixLabels.tag, label: 'tags' },
    ].filter(entry => String(entry.prefix || '').trim());
  }, [todoQuickCreatePrefixLabels]);

  const replaceTodoQuickCreateFieldValue = useCallback((
    field: 'recurring' | 'time' | 'reference',
    value: string,
    options: { advance?: boolean; focusSearch?: boolean } = {},
  ) => {
    const entries = getTodoQuickCreatePrefixEntries();
    const target = entries.find(entry => entry.field === field);
    if (!target) return;

    const source = categorySearchValue;
    const lowerSource = source.toLowerCase();
    const targetPrefix = String(target.prefix).toLowerCase();
    let targetStart = -1;

    for (let index = 0; index < source.length; index += 1) {
      if (index > 0 && !/\s/.test(source[index - 1])) continue;
      if (!lowerSource.startsWith(targetPrefix, index)) continue;
      const nextChar = source[index + targetPrefix.length];
      if (nextChar !== undefined && !/\s/.test(nextChar)) continue;
      targetStart = index;
    }

    let nextValue = '';
    const fieldValue = String(value || '').trim();
    const segment = fieldValue ? `${target.prefix} ${fieldValue}` : `${target.prefix} `;
    let nextPopupField: 'recurring' | 'time' | 'reference' | null = null;

    if (targetStart >= 0) {
      let nextMarkerStart = source.length;
      for (let index = targetStart + targetPrefix.length; index < source.length; index += 1) {
        if (index > 0 && !/\s/.test(source[index - 1])) continue;
        const marker = entries.find(entry => {
          const prefix = String(entry.prefix || '').toLowerCase();
          if (!prefix) return false;
          if (!lowerSource.startsWith(prefix, index)) return false;
          const nextChar = source[index + prefix.length];
          return nextChar === undefined || /\s/.test(nextChar);
        });
        if (marker) {
          nextMarkerStart = index;
          break;
        }
      }

      const head = source.slice(0, targetStart).trimEnd();
      const tail = source.slice(nextMarkerStart).trimStart();
      nextValue = [head, segment.trimEnd(), tail].filter(Boolean).join(' ');
    } else {
      nextValue = [source.trim(), segment.trimEnd()].filter(Boolean).join(' ');
    }

    if (options.advance) {
      const parsed = parseTodoQuickCreateFields(nextValue, {
        prefixSettings,
        prefixes: omniboxPrefixes,
      });
      const presentFields = new Set(parsed.presentFields);
      const nextField = getTodoQuickCreatePrefixEntries().find(entry => !presentFields.has(entry.field));
      if (nextField) {
        nextValue = `${nextValue.trim()} ${nextField.prefix} `;
        if (['recurring', 'time', 'reference'].includes(nextField.field)) {
          nextPopupField = nextField.field as 'recurring' | 'time' | 'reference';
        }
      }
    }

    if (options.focusSearch === false) {
      openSubcommandMode('category_todo', { query: nextValue });
      setDropdownSelectedIndex(0);
      setIsDropdownVisible(true);
      if (nextPopupField) {
        setTodoQuickCreatePopup(nextPopupField);
      }
      return;
    }

    focusTodoQuickCreateInput(nextValue, nextValue.length);
    setTodoQuickCreatePopup(nextPopupField);
  }, [
    categorySearchValue,
    focusTodoQuickCreateInput,
    getTodoQuickCreatePrefixEntries,
    omniboxPrefixes,
    openSubcommandMode,
    prefixSettings,
    setDropdownSelectedIndex,
  ]);

  const formatTodoQuickCreateScheduleValue = useCallback((selection: {
    date: string;
    time: string | null;
    isAnytime: boolean;
  }) => {
    return selection.time && !selection.isAnytime ? `${selection.date} ${selection.time}` : selection.date;
  }, []);

  const selectTodoQuickCreateRecurring = useCallback((recurringId: 'one-time' | 'daily' | 'weekly' | 'monthly') => {
    setTodoQuickCreateRecurring(recurringId);
    setTodoQuickCreatePopup(null);
    setDropdownSelectedIndex(0);
    replaceTodoQuickCreateFieldValue('recurring', recurringId, { advance: true });
  }, [replaceTodoQuickCreateFieldValue, setDropdownSelectedIndex]);

  const removeTodoQuickCreateFieldAtCursor = useCallback((
    cursorPosition?: number | null,
    options: { forceField?: 'recurring' | 'time' | 'reference' } = {},
  ) => {
    if (!isTodoCategoryMode) return false;

    const entries = getTodoQuickCreatePrefixEntries();
    const source = categorySearchValue;
    const lowerSource = source.toLowerCase();
    const markers: Array<{ field: string; start: number; prefix: string; value: string; end: number }> = [];

    for (let index = 0; index < source.length; index += 1) {
      if (index > 0 && !/\s/.test(source[index - 1])) continue;
      const marker = entries.find(entry => {
        const prefix = String(entry.prefix || '').toLowerCase();
        if (!prefix || !lowerSource.startsWith(prefix, index)) return false;
        const nextChar = source[index + prefix.length];
        return nextChar === undefined || /\s/.test(nextChar);
      });
      if (!marker) continue;
      markers.push({
        field: marker.field,
        start: index,
        prefix: marker.prefix,
        value: '',
        end: source.length,
      });
      index += Math.max(String(marker.prefix).length - 1, 0);
    }

    if (markers.length === 0) return false;

    const nextMarkers = markers.map((marker, index) => {
      const nextMarker = markers[index + 1];
      const end = nextMarker?.start ?? source.length;
      return {
        ...marker,
        value: source.slice(marker.start + marker.prefix.length, end).trim(),
        end,
      };
    });
    const cursor = cursorPosition ?? source.length;
    const activeMarker = options.forceField
      ? nextMarkers.find(marker => marker.field === options.forceField)
      : nextMarkers.find(marker => cursor >= marker.start && cursor <= marker.end);

    if (!activeMarker) return false;

    const prefixEnd = activeMarker.start + activeMarker.prefix.length;
    const cursorIsAtEmptyField =
      cursor >= prefixEnd &&
      source.slice(prefixEnd, cursor).trim() === '' &&
      activeMarker.value === '';

    if (!options.forceField && !cursorIsAtEmptyField) return false;

    const head = source.slice(0, activeMarker.start).trimEnd();
    const tail = source.slice(activeMarker.end).trimStart();
    const nextValue = [head, tail].filter(Boolean).join(' ');
    focusTodoQuickCreateInput(nextValue, nextValue.length);

    if (activeMarker.field === 'recurring') {
      setTodoQuickCreateRecurring(null);
    } else if (activeMarker.field === 'time') {
      setTodoQuickCreateSchedule(null);
    } else if (activeMarker.field === 'reference') {
      setTodoQuickCreateReferences([]);
      setTodoQuickCreateReferenceQuery('');
    }
    setTodoQuickCreatePopup(null);
    return true;
  }, [
    categorySearchValue,
    focusTodoQuickCreateInput,
    getTodoQuickCreatePrefixEntries,
    isTodoCategoryMode,
  ]);

  useEffect(() => {
    if (!isTodoCategoryMode) {
      setTodoQuickCreatePopup(null);
      return;
    }

    const prefixCandidates = [
      { field: 'recurring' as const, prefix: todoQuickCreatePrefixLabels.recurring },
      { field: 'time' as const, prefix: todoQuickCreatePrefixLabels.time },
      { field: 'reference' as const, prefix: todoQuickCreatePrefixLabels.reference },
    ]
      .filter(entry => String(entry.prefix || '').trim())
      .sort((a, b) => String(b.prefix).length - String(a.prefix).length);
    const source = categorySearchValue;
    const lowerValue = source.toLowerCase();
    const markers: Array<{ field: 'recurring' | 'time' | 'reference'; start: number; prefix: string }> = [];

    for (let index = 0; index < source.length; index += 1) {
      if (index > 0 && !/\s/.test(source[index - 1])) continue;
      const marker = prefixCandidates.find(entry => {
        const prefix = String(entry.prefix || '').toLowerCase();
        if (!prefix || !lowerValue.startsWith(prefix, index)) return false;
        const nextChar = source[index + prefix.length];
        return nextChar === undefined || /\s/.test(nextChar);
      });
      if (!marker) continue;
      markers.push({ field: marker.field, start: index, prefix: marker.prefix });
      index += Math.max(String(marker.prefix).length - 1, 0);
    }

    const inputRoot = searchInputRef.current?.getRootNode();
    const activeElement =
      inputRoot instanceof ShadowRoot
        ? inputRoot.activeElement
        : document.activeElement;
    const documentActiveElement = document.activeElement;
    const popupOwnsFocus =
      [activeElement, documentActiveElement].some(
        element =>
          element instanceof HTMLElement &&
          (element.closest('[data-todo-quick-create-popup]') || element.hasAttribute('data-todo-recurring-option')),
      );
    const cursorPosition = activeElement === searchInputRef.current ? searchInputRef.current?.selectionStart ?? source.length : null;
    const cursorMarker = markers.find((marker, index) => {
      const nextMarker = markers[index + 1];
      const end = nextMarker?.start ?? source.length;
      return cursorPosition !== null && cursorPosition >= marker.start && cursorPosition <= end;
    });
    const trimmedSource = source.trimEnd().toLowerCase();
    const trailingPopupMarker = markers.find(marker => {
      const markerEnd = marker.start + marker.prefix.length;
      return markerEnd <= trimmedSource.length && trimmedSource.slice(marker.start).trim() === marker.prefix.toLowerCase();
    });
    const activeField = cursorMarker?.field || trailingPopupMarker?.field || (popupOwnsFocus ? todoQuickCreatePopup : null);
    const dismissedPopup = dismissedTodoQuickCreatePopupRef.current;
    if (activeField && dismissedPopup?.field === activeField && dismissedPopup.value === source) {
      setTodoQuickCreatePopup(null);
      return;
    }
    setTodoQuickCreatePopup(activeField);
  }, [
    categorySearchValue,
    isTodoCategoryMode,
    todoQuickCreatePopup,
    todoQuickCreatePrefixLabels.recurring,
    todoQuickCreatePrefixLabels.reference,
    todoQuickCreatePrefixLabels.time,
  ]);

  const createTodoFromCategoryCommand = useCallback(async () => {
    const hasIntent = todoQuickCreateFields.hasCreateIntent || categorySearchValue.trim() === '';
    if (!hasIntent) return;

    const fallbackReferenceTitle = todoQuickCreateReferences[0]?.name || todoQuickCreateReferences[0]?.title || '';
    const title = todoQuickCreateFields.title.trim() || fallbackReferenceTitle;
    if (!title.trim()) {
      insertNextTodoQuickCreateField();
      useUIStore.getState().queueNotification({
        message: `Add a title with ${todoQuickCreatePrefixLabels.title} before creating the todo`,
        type: 'error',
      });
      return;
    }

    try {
      const workspaceId = defaultWorkspaceId || allWorkspaces[0]?.id || undefined;
      const tagIds: string[] = [];

      if (workspaceId) {
        for (const tagName of todoQuickCreateFields.tagNames) {
          const response = await sendAltSPropertyPersistenceMessage('api_create_tag', {
            name: tagName,
            workspaceId,
          });
          if (response?.tag?.id && !tagIds.includes(response.tag.id)) {
            tagIds.push(response.tag.id);
          }
        }
      }

      const parsedTime = todoQuickCreateSchedule
        ? todoQuickCreateSchedule
        : todoQuickCreateFields.time
          ? (() => {
              const parsed = parseDueDateInput(todoQuickCreateFields.time);
              return parsed.valid
                ? { date: parsed.value.date, time: parsed.value.time, isAnytime: parsed.value.time === null }
                : null;
            })()
          : null;
      const scheduleDate = parsedTime?.date || new Date().toISOString().slice(0, 10);
      const scheduleTimeText = parsedTime?.time || '09:00';
      const parsedScheduleTime = new Date(`${scheduleDate}T${scheduleTimeText}:00`).getTime();
      const recurringText = (todoQuickCreateRecurring || todoQuickCreateFields.recurring || '').trim().toLowerCase();
      const recurringCycle = ['daily', 'weekly', 'monthly'].includes(recurringText) ? recurringText : undefined;
      const scheduleType = recurringCycle ? 'recurring' : 'one-time';
      const references = todoQuickCreateReferences.map(item => ({
        type: item.category || item.type || 'note',
        id: String(item.id || item.value || item.data?.id || ''),
        name: item.name || item.title || item.key || item.label || item.data?.title || 'Saved item',
      }));

      const response: any = await sendAltSPropertyPersistenceMessage('db_create_todo', {
        title: title.trim(),
        description: todoQuickCreateFields.description,
        references,
        scheduleType,
        scheduleTime: Number.isFinite(parsedScheduleTime) ? parsedScheduleTime : Date.now(),
        recurringCycle,
        tagIds,
        workspaceId,
        folderId: null,
      });

      if (!response?.success || !response?.todo) {
        throw new Error(response?.error || 'Failed to create todo');
      }

      const savedTodo = response.todo;
      const alarmTime = Number.isFinite(parsedScheduleTime) ? parsedScheduleTime : Date.now();
      await new Promise(resolve => {
        const chromeAny = (window as any).chrome;
        chromeAny?.runtime?.sendMessage?.({
          action: 'schedule_todo_alarm',
          todoId: String(savedTodo.id),
          deadline: new Date(alarmTime).toISOString(),
          is_anytime: !!parsedTime?.isAnytime,
        }, resolve);
      });

      syncDbFromBackground();
      resetSubcommandMode();
      setTodoQuickCreatePopup(null);
      setTodoQuickCreateSchedule(null);
      setTodoQuickCreateRecurring(null);
      setTodoQuickCreateReferences([]);
      setTodoQuickCreateReferenceQuery('');
      setSearchValue('');
      setDropdownSelectedIndex(-1);
      setIsDropdownVisible(false);
      useUIStore.getState().queueNotification({
        message: `Created "${savedTodo.name || title || 'Todo'}" successfully`,
        type: 'success',
      });
      onClose();
    } catch (err) {
      console.error('[AltS-Website] Failed to quick-create todo:', err);
      useUIStore.getState().queueNotification({ message: 'Failed to create todo', type: 'error' });
    }
  }, [
    allWorkspaces,
    categorySearchValue,
    defaultWorkspaceId,
    insertNextTodoQuickCreateField,
    onClose,
    resetSubcommandMode,
    sendAltSPropertyPersistenceMessage,
    setDropdownSelectedIndex,
    syncDbFromBackground,
    todoQuickCreateFields,
    todoQuickCreatePrefixLabels.title,
    todoQuickCreateRecurring,
    todoQuickCreateReferences,
    todoQuickCreateSchedule,
  ]);

  const todoQuickCreateAction = useCallback(() => {
    if (todoQuickCreateFields.hasCreateIntent || categorySearchValue.trim() === '') {
      void createTodoFromCategoryCommand();
      return;
    }
    insertNextTodoQuickCreateField();
  }, [
    categorySearchValue,
    createTodoFromCategoryCommand,
    insertNextTodoQuickCreateField,
    todoQuickCreateFields.hasCreateIntent,
  ]);

  const insertUpdateNoteField = useCallback((item: any) => {
    const base = String(item?._noteUpdateCommandBase || searchValue).trim();
    const nextField = getNextUpdateNoteField(item?._noteUpdateFields);
    if (!nextField) return;
    const currentValue = searchValue.trim();
    const nextPrefix = nextField.prefix;
    const nextValue =
      currentValue && currentValue.toLowerCase().startsWith(base.toLowerCase())
        ? `${currentValue}${currentValue.endsWith(nextPrefix) ? '' : ` ${nextPrefix}`} `
        : `${base} ${nextPrefix} `;
    setSearchValue(nextValue);
    setIsDropdownVisible(true);
    setDropdownSelectedIndex(0);
    window.requestAnimationFrame(() => {
      const input = searchInputRef.current;
      input?.focus();
      input?.setSelectionRange(nextValue.length, nextValue.length);
    });
  }, [getNextUpdateNoteField, searchValue, setDropdownSelectedIndex]);

  const updateNoteFromCommandRow = useCallback(
    async (row: CategorySubcommandItem | undefined) => {
      const noteItem = row?.item || {};
      const noteId = String(noteItem?.id || noteItem?.note_id || '').trim();
      const updateFields = noteItem._noteUpdateFields || parseNoteQuickCreateFields('', {
        prefixSettings,
        prefixes: omniboxPrefixes,
      });
      const appendDescription = String(updateFields?.description || '').trim();
      const tagNames = Array.isArray(updateFields?.tagNames) ? updateFields.tagNames : [];

      if (!appendDescription && tagNames.length === 0) {
        insertUpdateNoteField(noteItem);
        return;
      }

      if (!noteId) {
        useUIStore.getState().queueNotification({ message: 'Could not find note', type: 'error' });
        return;
      }

      try {
        const workspaceId = noteItem.workspaceId || defaultWorkspaceId || allWorkspaces[0]?.id || undefined;
        const tagIds = Array.from(new Set(safeList(noteItem.tagIds).map((id: any) => String(id || '').trim()).filter(Boolean)));

        if (workspaceId) {
          for (const tagName of tagNames) {
            const response = await sendAltSPropertyPersistenceMessage('api_create_tag', {
              name: tagName,
              workspaceId,
            });
            if (response?.tag?.id && !tagIds.includes(response.tag.id)) {
              tagIds.push(response.tag.id);
            }
          }
        }

        const input: any = {};
        if (appendDescription) {
          const currentBody = String(noteItem.body || '');
          const appendHtml = buildQuickCreateNoteBodyHtml(appendDescription);
          const needsSpacer = currentBody.trim() && !currentBody.endsWith('</p>');
          input.body = currentBody.trim()
            ? `${currentBody}${needsSpacer ? '<p><br></p>' : ''}${appendHtml}`
            : appendHtml;
        }
        if (tagNames.length > 0) input.tagIds = tagIds;

        const updatedNote = await saveNoteFromAltSOverlay({
          mode: 'update',
          noteId,
          input,
        });

        syncDbFromBackground();
        resetSubcommandMode();
        setSearchValue('');
        setDropdownSelectedIndex(-1);
        setIsDropdownVisible(false);
        useUIStore.getState().queueNotification({
          message: `Updated "${updatedNote.title || noteItem.title || 'Note'}" successfully`,
          type: 'success',
        });
        onClose();
      } catch (err) {
        console.error('[AltS-Website] Failed to update note from command row:', err);
        useUIStore.getState().queueNotification({ message: 'Failed to update note', type: 'error' });
      }
    },
    [
      allWorkspaces,
      defaultWorkspaceId,
      insertUpdateNoteField,
      omniboxPrefixes,
      onClose,
      prefixSettings,
      resetSubcommandMode,
      saveNoteFromAltSOverlay,
      sendAltSPropertyPersistenceMessage,
      setDropdownSelectedIndex,
      syncDbFromBackground,
    ],
  );

  const saveSnippetFromAltSOverlay = useCallback(
    async ({ mode, snippetId, input }: { mode: 'create' | 'update'; snippetId?: string; input: any }) => {
      const chromeAny = (window as any).chrome;
      if (!chromeAny?.runtime?.sendMessage) {
        throw new Error('Extension background is unavailable.');
      }
      const wsId = input?.workspaceId || defaultWorkspaceId || allWorkspaces[0]?.id || undefined;
      const response: any = await new Promise(resolve => {
        chromeAny.runtime.sendMessage(
          mode === 'update'
            ? { action: 'db_update_snippet', snippetId, input: { ...input, workspaceId: wsId } }
            : { action: 'db_create_snippet', input: { ...input, workspaceId: wsId } },
          resolve,
        );
      });

      if (!response?.success || !response?.snippet) {
        throw new Error(response?.error || 'Failed to save text expander via background');
      }

      scheduleAltSEditorDbRefresh();
      return response.snippet;
    },
    [allWorkspaces, defaultWorkspaceId, scheduleAltSEditorDbRefresh],
  );

  const saveAiPromptFromAltSOverlay = useCallback(
    async ({ mode, aiPromptId, input }: { mode: 'create' | 'update'; aiPromptId?: string; input: any }) => {
      const chromeAny = (window as any).chrome;
      if (!chromeAny?.runtime?.sendMessage) {
        throw new Error('Extension background is unavailable.');
      }
      const wsId = input?.workspaceId || defaultWorkspaceId || allWorkspaces[0]?.id || undefined;
      const response: any = await new Promise(resolve => {
        chromeAny.runtime.sendMessage(
          mode === 'update'
            ? { action: 'db_update_ai_prompt', aiPromptId, input: { ...input, workspaceId: wsId } }
            : { action: 'db_create_ai_prompt', input: { ...input, workspaceId: wsId } },
          resolve,
        );
      });

      if (!response?.success || !response?.prompt) {
        throw new Error(response?.error || 'Failed to save chat agent via background');
      }

      scheduleAltSEditorDbRefresh();
      return response.prompt;
    },
    [allWorkspaces, defaultWorkspaceId, scheduleAltSEditorDbRefresh],
  );

  const saveTodoFromAltSOverlay = useCallback(
    async (data: any) => {
      const target = todoEditorTarget || getTodoSaveTarget();
      const chromeAny = (window as any).chrome;
      if (!chromeAny?.runtime?.sendMessage) {
        throw new Error('Extension background is unavailable.');
      }
      if (!target.url) {
        throw new Error('Unable to detect page URL to save');
      }

      let createdLink: any = null;
      try {
        createdLink = await createLinkRecordForPage(target, data?.title);
      } catch (err) {
        console.error('[AltS-Website] Failed to create page link before todo save; saving todo with raw URL reference.', err);
      }
      const linkTitle = createdLink?.title || target.title || String(data?.title || '').trim() || 'Untitled Page';
      const rawReferences = Array.isArray(data?.selectedItems) ? data.selectedItems : [];
      const references = [
        {
          type: 'link',
          id: createdLink?.id || target.url,
          name: linkTitle,
          url: target.url,
        },
        ...rawReferences
          .filter((item: any) => item?.id && item.id !== createdLink?.id && item.id !== target.url)
          .map((item: any) => ({
            type: item.type || item.category || item.data?.category || 'note',
            id: String(item.id || item.value || item.data?.id || ''),
            name: item.name || item.title || item.key || item.label || item.data?.title || 'Saved item',
          })),
      ];
      const parsedScheduleTime = (() => {
        if (typeof data?.scheduleTime === 'number' && Number.isFinite(data.scheduleTime)) return data.scheduleTime;
        if (data?.isAnytime) return Date.now();
        const date = String(data?.date || '').trim();
        const time = String(data?.time || '').trim();
        if (date) {
          const parsed = new Date(`${date}T${time || '09:00'}`).getTime();
          if (Number.isFinite(parsed)) return parsed;
        }
        return Date.now();
      })();
      const wsId = data?.workspaceId || defaultWorkspaceId || allWorkspaces[0]?.id || undefined;
      const response: any = await new Promise(resolve => {
        chromeAny.runtime.sendMessage(
          data?.todoId
            ? {
                action: 'db_update_todo_content',
                todoId: data.todoId,
                updates: {
                  name: String(data?.title || '').trim() || linkTitle,
                  description: data?.description || '',
                  references,
                  scheduleType: data?.scheduleType || 'one-time',
                  scheduleTime: parsedScheduleTime,
                  recurringType: data?.recurringCycle,
                  tagIds: Array.isArray(data?.tagIds) ? data.tagIds : [],
                  shortcut: data?.shortcut || '',
                  workspaceId: wsId,
                  folderId: data?.folderId || null,
                },
              }
            : {
                action: 'db_create_todo',
                input: {
                  title: String(data?.title || '').trim() || linkTitle,
                  description: data?.description || '',
                  references,
                  scheduleType: data?.scheduleType || 'one-time',
                  scheduleTime: parsedScheduleTime,
                  recurringCycle: data?.recurringCycle,
                  tagIds: Array.isArray(data?.tagIds) ? data.tagIds : [],
                  shortcut: data?.shortcut || '',
                  workspaceId: wsId,
                  folderId: data?.folderId || null,
                },
              },
          resolve,
        );
      });

      if (!response?.success || !response?.todo) {
        throw new Error(response?.error || 'Failed to save todo via background');
      }

      const savedTodo = response.todo;
      try {
        if (savedTodo?.id && Number.isFinite(parsedScheduleTime)) {
          chromeAny.runtime.sendMessage({
            action: 'schedule_todo_alarm',
            todoId: String(savedTodo.id),
            deadline: new Date(parsedScheduleTime).toISOString(),
            is_anytime: !!data?.isAnytime,
          });
        }
      } catch (err) {
        console.error('[AltS-Website] Failed to schedule todo alarm after save:', err);
      }

      const todoCompoundId = getItemCompoundId({
        id: savedTodo.id,
        workspace_id: savedTodo.workspaceId || wsId || null,
        folder_id: savedTodo.folderId || data?.folderId || null,
        snippet: { id: savedTodo.id, category: 'todo' },
      });

      const shortcutWasProvided = Object.prototype.hasOwnProperty.call(data || {}, 'shortcut');
      const normalizedShortcut = String(data?.shortcut || '')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '');
      if (shortcutWasProvided) {
        if (normalizedShortcut) {
          await sendAltSPropertyPersistenceMessage('api_save_shortcut', {
            id: savedTodo.id,
            referenceId: todoCompoundId,
            trigger: normalizedShortcut,
            shortcut: normalizedShortcut,
            label: savedTodo.name || savedTodo.title || String(data?.title || '').trim() || linkTitle,
            type: 'todo',
          });
        }
      }

      const hotkeyWasProvided = Object.prototype.hasOwnProperty.call(data || {}, 'hotkey');
      const normalizedHotkey = String(data?.hotkey || '').trim();
      if (hotkeyWasProvided) {
        if (normalizedHotkey) {
          await sendAltSPropertyPersistenceMessage('api_save_hotkey', {
            id: savedTodo.id,
            referenceId: todoCompoundId,
            hotkey: normalizedHotkey,
            type: 'todo',
          });
        }
      }

      const favoriteWasProvided = Object.prototype.hasOwnProperty.call(data || {}, 'isFavorite');
      if (favoriteWasProvided) {
        if (data?.isFavorite) {
          await sendAltSPropertyPersistenceMessage('api_add_favorite', {
            referenceId: todoCompoundId,
            referenceType: 'todo',
            label: savedTodo.name || savedTodo.title || String(data?.title || '').trim() || linkTitle,
          });
        }
      }

      scheduleAltSEditorDbRefresh();
      return savedTodo;
    },
    [
      allWorkspaces,
      createLinkRecordForPage,
      defaultWorkspaceId,
      getTodoSaveTarget,
      scheduleAltSEditorDbRefresh,
      sendAltSPropertyPersistenceMessage,
      todoEditorTarget,
    ],
  );

  const savePageLinkToExistingTodo = useCallback(
    async (todoRow: CategorySubcommandItem | any) => {
      try {
        const todoItem = todoRow?.item || todoRow;
        const todoId = String(todoItem?.id || todoItem?.todo_id || '').trim();
        const target = getTodoSaveTarget();

        if (!todoId) {
          useUIStore.getState().queueNotification({ message: 'Could not find todo', type: 'error' });
          return;
        }

        if (!target.url) {
          useUIStore.getState().queueNotification({ message: 'Unable to detect page URL to save', type: 'error' });
          return;
        }

        const createdLink = await createLinkRecordForPage(target);
        const linkTitle = createdLink.title || target.title || 'Untitled Page';
        const currentReferences = Array.isArray(todoItem.references) ? todoItem.references : [];
        const response: any = await new Promise(resolve => {
          chrome.runtime.sendMessage(
            {
              action: 'db_update_todo_content',
              todoId,
              updates: {
                references: [
                  ...currentReferences,
                  { type: 'link', id: createdLink.id, name: linkTitle },
                ],
              },
            },
            resolve,
          );
        });

        if (!response?.success) {
          throw new Error(response?.error || 'Failed to update todo via background');
        }

        syncDbFromBackground();
        resetSubcommandMode();
        setSearchValue('');
        setDropdownSelectedIndex(-1);
        setIsDropdownVisible(false);
        useUIStore.getState().queueNotification({
          message: `Added to "${todoItem.name || todoItem.title || 'Todo'}" successfully`,
          type: 'success',
        });
        onClose();
      } catch (err) {
        console.error('[AltS-Website] Failed to add page link to todo:', err);
        useUIStore.getState().queueNotification({ message: 'Failed to add link to todo', type: 'error' });
      }
    },
    [createLinkRecordForPage, getTodoSaveTarget, onClose, resetSubcommandMode, syncDbFromBackground],
  );

  const savePageLinkToExistingNote = useCallback(
    async (noteRow: CategorySubcommandItem | any) => {
      try {
        const noteItem = noteRow?.item || noteRow;
        const noteId = String(noteItem?.id || noteItem?.note_id || '').trim();
        const target = getNoteSaveTarget();

        if (!noteId) {
          useUIStore.getState().queueNotification({ message: 'Could not find note', type: 'error' });
          return;
        }

        if (!target.url) {
          useUIStore.getState().queueNotification({ message: 'Unable to detect page URL to save', type: 'error' });
          return;
        }

        const currentBody = String(noteItem.body || '');
        const pageHtml = buildAltSPageLinkHtml(target);
        const needsSpacer = currentBody.trim() && !currentBody.endsWith('</p>');
        const nextBody = currentBody.trim() ? `${currentBody}${needsSpacer ? '<p><br></p>' : ''}${pageHtml}` : pageHtml;
        const chromeAny = (window as any).chrome;
        const response: any = await new Promise(resolve => {
          chromeAny.runtime.sendMessage(
            {
              action: 'db_update_note',
              noteId,
              input: {
                body: nextBody,
              },
            },
            resolve,
          );
        });

        if (!response?.success || !response?.note) {
          throw new Error(response?.error || 'Failed to update note via background');
        }

        syncDbFromBackground();
        resetSubcommandMode();
        setSearchValue('');
        setDropdownSelectedIndex(-1);
        setIsDropdownVisible(false);
        useUIStore.getState().queueNotification({
          message: `Added to "${noteItem.title || noteItem.name || 'Note'}" successfully`,
          type: 'success',
        });
        onClose();
      } catch (err) {
        console.error('[AltS-Website] Failed to add page link to note:', err);
        useUIStore.getState().queueNotification({ message: 'Failed to add link to note', type: 'error' });
      }
    },
    [getNoteSaveTarget, onClose, resetSubcommandMode, setDropdownSelectedIndex, syncDbFromBackground],
  );

  const savePageToExistingLink = useCallback(
    async (linkRow: CategorySubcommandItem | any) => {
      try {
        const linkItem = linkRow?.item || linkRow;
        const linkId = String(linkItem?.id || linkItem?.snippet_id || linkItem?.linkid || '').trim();
        const targetUrl =
          linkSaveTarget?.url ||
          activeTabUrl ||
          (window.location.href.startsWith('chrome-extension://') ? '' : window.location.href);
        const targetTitle = linkSaveTarget?.title || activeTabTitle || document.title || 'Untitled Page';

        if (!linkId) {
          useUIStore.getState().queueNotification({ message: 'Could not find saved link', type: 'error' });
          return;
        }

        if (!targetUrl) {
          useUIStore.getState().queueNotification({ message: 'Unable to detect page URL to save', type: 'error' });
          return;
        }

        const currentUrls = Array.isArray(linkItem.urls) ? linkItem.urls : [];
        const response: any = await new Promise(resolve => {
          chrome.runtime.sendMessage(
            {
              action: 'db_update_link',
              linkId,
              input: {
                urls: [
                  ...currentUrls,
                  {
                    id: generateEntityId('linkItem'),
                    title: targetTitle,
                    name: targetTitle,
                    url: targetUrl,
                    source: 'tab',
                  },
                ],
              },
            },
            resolve,
          );
        });

        if (!response?.success) {
          throw new Error(response?.error || 'Failed to update link via background');
        }

        syncDbFromBackground();
        resetSubcommandMode();
        setSearchValue('');
        setDropdownSelectedIndex(-1);
        setIsDropdownVisible(false);
        useUIStore.getState().queueNotification({
          message: `Added to "${linkItem.title || linkItem.name || 'Link'}" successfully`,
          type: 'success',
        });
        onClose();
      } catch (err) {
        console.error('[AltS-Website] Failed to add URL to saved link:', err);
        useUIStore.getState().queueNotification({ message: 'Failed to add URL to link', type: 'error' });
      }
    },
    [activeTabTitle, activeTabUrl, linkSaveTarget, onClose, resetSubcommandMode, syncDbFromBackground],
  );

  const saveCurrentAiUrlToExistingAgent = useCallback(
    async (agentItem: any) => {
      try {
        const target = getChatSaveTarget();
        const record = agentItem?.record || agentItem?.item || agentItem;
        const id = String(record?.id || '').trim();

        if (!id) {
          useUIStore.getState().queueNotification({ message: 'Could not find chat agent', type: 'error' });
          return;
        }

        if (!target.url || !isSupportedAiChatSaveUrl(target.url)) {
          useUIStore.getState().queueNotification({ message: 'Unable to detect AI chat URL to save', type: 'error' });
          return;
        }

        const isPromptRecord = agentItem?.kind === 'prompt' || record?.modelUrls;
        const response: any = await new Promise(resolve => {
          if (isPromptRecord) {
            const modelId = inferModelIdFromUrl(target.url);
            const providerMeta: Record<string, { name: string; host: string }> = {
              gpt: { name: 'ChatGPT', host: 'chatgpt.com' },
              claude: { name: 'Claude', host: 'claude.ai' },
              gemini: { name: 'Gemini', host: 'gemini.google.com' },
              perplexity: { name: 'Perplexity', host: 'perplexity.ai' },
            };
            const currentModelUrls = record.modelUrls || {};
            const currentCustomModels = Array.isArray(record.customModels) ? record.customModels : [];
            const alreadySavedModelId = Object.entries(currentModelUrls).find(
              ([, url]) => String(url || '').trim() === target.url,
            )?.[0];
            const baseModelUrl = String(currentModelUrls[modelId] || '').trim();
            const shouldUseBaseModelSlot = !baseModelUrl || baseModelUrl === target.url;
            const nextModelId = alreadySavedModelId || (
              shouldUseBaseModelSlot ? modelId : generateEntityId(`${modelId}CustomModel`)
            );
            const nextCustomModels =
              nextModelId === modelId || currentCustomModels.some((model: any) => model?.id === nextModelId)
                ? currentCustomModels
                : [
                    ...currentCustomModels,
                    {
                      id: nextModelId,
                      name: providerMeta[modelId]?.name || 'AI Model',
                      host: providerMeta[modelId]?.host || 'chatgpt.com',
                    },
                  ];
            chrome.runtime.sendMessage(
              {
                action: 'db_update_ai_prompt',
                aiPromptId: id,
                input: {
                  modelUrls: {
                    ...currentModelUrls,
                    [nextModelId]: target.url,
                  },
                  customModels: nextCustomModels,
                  enabledModelIds: Array.from(new Set([...(record.enabledModelIds || []), nextModelId])),
                },
              },
              resolve,
            );
            return;
          }

          const currentUrls = Array.isArray(record.urls) ? record.urls : [];
          const nextUrls = currentUrls.includes(target.url) ? currentUrls : [...currentUrls, target.url];
          chrome.runtime.sendMessage(
            {
              action: 'db_update_chat_agent',
              agentId: id,
              input: {
                urls: nextUrls,
              },
            },
            resolve,
          );
        });

        if (!response?.success) {
          throw new Error(response?.error || 'Failed to update chat agent via background');
        }

        syncDbFromBackground();
        resetSubcommandMode();
        setSearchValue('');
        setDropdownSelectedIndex(-1);
        setIsDropdownVisible(false);
        useUIStore.getState().queueNotification({
          message: `Added URL to "${record.title || record.name || 'Chat Agent'}" successfully`,
          type: 'success',
        });
        onClose();
      } catch (err) {
        console.error('[AltS-Website] Failed to add AI URL to chat agent:', err);
        useUIStore.getState().queueNotification({ message: 'Failed to add URL to chat agent', type: 'error' });
      }
    },
    [getChatSaveTarget, inferModelIdFromUrl, onClose, resetSubcommandMode, syncDbFromBackground],
  );

  const handleExecute = (item: any, e?: React.MouseEvent | KeyboardEvent) => {
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
          const finalUrl =
            url ||
            activeTabUrl ||
            (window.location.href.startsWith('chrome-extension://') ? '' : window.location.href);
          const finalTitle = title || activeTabTitle || document.title || 'Untitled Page';
          openLinkSaveSubcommand(finalUrl, finalTitle);
          return;
        } else if (item.id === 'save_todo') {
          const finalUrl =
            url ||
            activeTabUrl ||
            (window.location.href.startsWith('chrome-extension://') ? '' : window.location.href);
          const finalTitle = title || activeTabTitle || document.title || 'Untitled Page';
          openTodoSaveSubcommand(finalUrl, finalTitle);
          return;
        } else if (item.id === 'save_note') {
          const finalUrl =
            url ||
            activeTabUrl ||
            (window.location.href.startsWith('chrome-extension://') ? '' : window.location.href);
          const finalTitle = title || activeTabTitle || document.title || 'Untitled Page';
          openNoteSaveSubcommand(finalUrl, finalTitle);
          return;
        } else if (item.id === 'save_snippet') {
          const finalUrl =
            url ||
            activeTabUrl ||
            (window.location.href.startsWith('chrome-extension://') ? '' : window.location.href);
          const finalTitle = title || activeTabTitle || document.title || 'Untitled Page';
          openSnippetSaveSubcommand(finalUrl, finalTitle);
          return;
        } else if (item.id === 'save_chat') {
          const finalUrl =
            url ||
            activeTabUrl ||
            (window.location.href.startsWith('chrome-extension://') ? '' : window.location.href);
          const finalTitle = title || activeTabTitle || document.title || 'Untitled Chat';
          openChatSaveSubcommand(finalUrl, finalTitle);
          return;
        } else if (item.id === 'add_to_existing') {
          const finalUrl =
            url ||
            activeTabUrl ||
            (window.location.href.startsWith('chrome-extension://') ? '' : window.location.href);
          const finalTitle = title || activeTabTitle || document.title || 'Untitled Page';
          openExistingCollectionSubcommand(finalUrl, finalTitle);
        } else if (item.id === 'send_to_agent') {
          const finalUrl =
            url ||
            activeTabUrl ||
            (window.location.href.startsWith('chrome-extension://') ? '' : window.location.href);
          const finalTitle = title || activeTabTitle || document.title || 'Untitled Page';
          openSendToAgentSubcommand(finalUrl, finalTitle);
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

    // Standard compact rows use dedicated URL-trigger helpers instead of an expanded results view.
    return false;
  };

  const openWebsiteNote = useCallback(
    (row: CategorySubcommandItem) => {
      const item = row.suggestion?.item || row.item || {};
      const rawId = item.snippet_id || item.id || item.todo_id || row.suggestion?.id || '';
      const noteId = extractSnippetIdFromCompoundId(rawId);
      if (!noteId) {
        useUIStore.getState().queueNotification({
          message: 'Could not open note',
          type: 'error',
        });
        return;
      }

      const url = chrome.runtime.getURL(
        `AltS_search_newtab/index.html?alts_action=true&type=note&entityId=${encodeURIComponent(noteId)}`,
      );
      chrome.runtime.sendMessage({ action: 'open_tab', url, active: true }, () => {
        if (chrome.runtime.lastError) {
          window.open(url, '_blank');
        }
      });
      setSearchValue('');
      setDropdownSelectedIndex(-1);
      setIsDropdownVisible(false);
      onClose();
    },
    [onClose],
  );

  const openWebsiteLink = useCallback(
    (row: CategorySubcommandItem) => {
      const item = row.suggestion?.item || row.item || {};
      const linkId = item.id || item.snippet_id || item.linkid || row.suggestion?.id || '';
      if (!linkId) {
        useUIStore.getState().queueNotification({
          message: 'Could not open link',
          type: 'error',
        });
        return;
      }

      const url = chrome.runtime.getURL(
        `AltS_search_newtab/index.html?alts_action=true&type=link&entityId=${encodeURIComponent(String(linkId))}`,
      );
      chrome.runtime.sendMessage({ action: 'open_tab', url, active: true }, () => {
        if (chrome.runtime.lastError) {
          window.open(url, '_blank');
        }
      });
      setSearchValue('');
      setDropdownSelectedIndex(-1);
      setIsDropdownVisible(false);
      onClose();
    },
    [onClose],
  );

  const openWebsiteSnippet = useCallback(
    (row: CategorySubcommandItem) => {
      const item = row.suggestion?.item || row.item || {};
      const rawId = item.snippet_id || item.id || row.suggestion?.id || '';
      const snippetId = extractSnippetIdFromCompoundId(rawId);
      if (!snippetId) {
        useUIStore.getState().queueNotification({
          message: 'Could not open text expander',
          type: 'error',
        });
        return;
      }

      const url = chrome.runtime.getURL(
        `AltS_search_newtab/index.html?alts_action=true&type=snippet&entityId=${encodeURIComponent(snippetId)}`,
      );
      chrome.runtime.sendMessage({ action: 'open_tab', url, active: true }, () => {
        if (chrome.runtime.lastError) {
          window.open(url, '_blank');
        }
      });
      setSearchValue('');
      setDropdownSelectedIndex(-1);
      setIsDropdownVisible(false);
      onClose();
    },
    [onClose],
  );

  const openWebsiteTodo = useCallback(
    (row: CategorySubcommandItem) => {
      const item = row.suggestion?.item || row.item || {};
      const rawId = item.todo_id || item.id || item.snippet_id || row.suggestion?.id || '';
      const todoId = extractSnippetIdFromCompoundId(rawId);
      if (!todoId) {
        useUIStore.getState().queueNotification({
          message: 'Could not open todo',
          type: 'error',
        });
        return;
      }

      const references = Array.isArray(item.references)
        ? item.references
        : Array.isArray(item.config?.id)
          ? item.config.id.map((id: string) => ({ id }))
          : [];

      const openUrl = (url: string) => {
        if (!url) return;
        chrome.runtime.sendMessage({ action: 'open_tab', url, active: true }, () => {
          if (chrome.runtime.lastError) {
            window.open(url, '_blank');
          }
        });
      };

      const normalizeReferenceId = (value: unknown) =>
        String(value || '')
          .trim()
          .replace(/^(auto-|cmd-|mod-|agent-|prompt-|session-)/, '');

      const findReferenceItem = (reference: any) => {
        const referenceId = normalizeReferenceId(reference?.id || reference?.value || reference?.referenceId);
        const referenceType = normalizeWebsiteCategory(reference?.type || reference?.category || reference?.referenceType);
        return altsConvertibleItems.find(candidate => {
          const candidateId = normalizeReferenceId(candidate.id || candidate.data?.id || candidate.data?.snippet_id);
          const candidateType = normalizeWebsiteCategory(candidate.category || candidate.data?.category || candidate.data?.type);
          const idMatches = candidateId && referenceId && candidateId === referenceId;
          const typeMatches = !referenceType || candidateType === referenceType;
          return idMatches && typeMatches;
        });
      };

      if (references.length > 0) {
        let executedReference = false;
        references.forEach((reference: any) => {
          const matched = findReferenceItem(reference);
          const referenceType = normalizeWebsiteCategory(reference?.type || reference?.category || matched?.category);
          const entityId = normalizeReferenceId(matched?.id || matched?.data?.id || reference?.id || reference?.value);
          const data = matched?.data || reference;

          if (['session', 'collection', 'tabgroup', 'collection_view'].includes(referenceType)) {
            executedReference = true;
            void handleStartSession(data);
            return;
          }

          if (referenceType === 'link') {
            const linkUrls = getLinkUrls(data);
            const fallbackUrl = data.url || data.link || data.value;
            const urls = linkUrls.length > 0 ? linkUrls : fallbackUrl ? [String(fallbackUrl)] : [];
            urls.forEach(openUrl);
            executedReference = executedReference || urls.length > 0;
            return;
          }

          if (referenceType === 'note' || referenceType === 'snippet') {
            if (!entityId) return;
            const targetUrl = chrome.runtime.getURL(
              `AltS_search_newtab/index.html?alts_action=true&type=${referenceType}&entityId=${encodeURIComponent(entityId)}`,
            );
            openUrl(targetUrl);
            executedReference = true;
            return;
          }

          if (referenceType === 'prompt') {
            if (!entityId) return;
            const targetUrl = chrome.runtime.getURL(
              `AltS_search_newtab/index.html?alts_action=true&type=prompt&entityId=${encodeURIComponent(entityId)}&omnibox=true&runPrompt=true`,
            );
            openUrl(targetUrl);
            executedReference = true;
            return;
          }

          if (['command', 'automation', 'agent', 'module'].includes(referenceType)) {
            if (!entityId) return;
            const targetUrl = chrome.runtime.getURL(
              `AltS_search_newtab/index.html?trigger_hotkey=true&type=${encodeURIComponent(referenceType)}&id=${encodeURIComponent(entityId)}`,
            );
            openUrl(targetUrl);
            executedReference = true;
          }
        });

        if (executedReference) {
          setSearchValue('');
          setDropdownSelectedIndex(-1);
          setIsDropdownVisible(false);
          onClose();
          return;
        }
      }

      const url = chrome.runtime.getURL(
        `AltS_search_newtab/index.html?alts_action=true&type=todo&entityId=${encodeURIComponent(todoId)}`,
      );
      chrome.runtime.sendMessage({ action: 'open_tab', url, active: true }, () => {
        if (chrome.runtime.lastError) {
          window.open(url, '_blank');
        }
      });
      setSearchValue('');
      setDropdownSelectedIndex(-1);
      setIsDropdownVisible(false);
      onClose();
    },
    [altsConvertibleItems, handleStartSession, onClose],
  );

  const openWebsiteBookmark = useCallback(
    (row: CategorySubcommandItem) => {
      const item = row.suggestion?.item || row.item || {};
      const url = getBookmarkUrl(item);
      if (!url) {
        useUIStore.getState().queueNotification({
          message: 'Could not open bookmark',
          type: 'error',
        });
        return;
      }

      chrome.runtime.sendMessage({ action: 'open_tab', url, active: true }, () => {
        if (chrome.runtime.lastError) {
          window.open(url, '_blank');
        }
      });
      setSearchValue('');
      setDropdownSelectedIndex(-1);
      setIsDropdownVisible(false);
      onClose();
    },
    [onClose],
  );

  const openWebsiteAiPrompt = useCallback(
    (row: CategorySubcommandItem) => {
      const item = row.suggestion?.item || row.item || {};
      const promptId = extractSnippetIdFromCompoundId(item.id || item.prompt_id || row.suggestion?.id || '');
      if (!promptId) {
        useUIStore.getState().queueNotification({
          message: 'Could not open prompt',
          type: 'error',
        });
        return;
      }

      const url = chrome.runtime.getURL(
        `AltS_search_newtab/index.html?alts_action=true&type=prompt&entityId=${encodeURIComponent(promptId)}&omnibox=true&runPrompt=true`,
      );
      chrome.runtime.sendMessage({ action: 'open_tab', url, active: true }, () => {
        if (chrome.runtime.lastError) {
          window.open(url, '_blank');
        }
      });
      setSearchValue('');
      setDropdownSelectedIndex(-1);
      setIsDropdownVisible(false);
      onClose();
    },
    [onClose],
  );

  const openWebsiteCollection = useCallback(
    (row: CategorySubcommandItem) => {
      const item = row.suggestion?.item || row.item || {};
      const sessionId = String(item.id || item.session_id || item.session?.id || row.suggestion?.id || '').trim();
      const collectionViewId = (sessionId && linkedCollectionViewIdsBySessionId.get(sessionId)?.[0]) || sessionId;
      if (!collectionViewId) {
        useUIStore.getState().queueNotification({
          message: 'Could not open collection',
          type: 'error',
        });
        return;
      }

      const url = chrome.runtime.getURL(
        `AltS_search_newtab/index.html?alts_action=true&type=collection&entityId=${encodeURIComponent(collectionViewId)}`,
      );
      chrome.runtime.sendMessage({ action: 'open_tab', url, active: true }, () => {
        if (chrome.runtime.lastError) {
          window.open(url, '_blank');
        }
      });
      setSearchValue('');
      setDropdownSelectedIndex(-1);
      setIsDropdownVisible(false);
      onClose();
    },
    [linkedCollectionViewIdsBySessionId, onClose],
  );

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

        if (['collection', 'collections', 'collection_view'].includes(String(matchedShortcut.referenceType || '').toLowerCase())) {
          const targetUrl = chrome.runtime.getURL(
            `AltS_search_newtab/index.html?trigger_hotkey=true&type=collection&id=${encodeURIComponent(String(matchedShortcut.referenceId || ''))}`,
          );
          chrome.runtime.sendMessage({ action: 'open_tab', url: targetUrl, active: true }, () => {
            if (chrome.runtime.lastError) window.open(targetUrl, '_blank');
          });
          setSearchValue('');
          setDropdownSelectedIndex(-1);
          setIsDropdownVisible(false);
          onClose();
          return;
        }
      }
      handleExecute(item);
      if (
        item?.id === 'save_link' ||
        item?.id === 'save_todo' ||
        item?.id === 'save_note' ||
        item?.id === 'save_snippet' ||
        item?.id === 'save_chat' ||
        item?.id === 'add_to_existing' ||
        item?.id === 'send_to_agent'
      ) {
        window.setTimeout(() => {
          if (dropdownActionGuardRef.current?.id === itemId) {
            dropdownActionGuardRef.current = null;
          }
        }, 0);
        return;
      }
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

  const executeCommandSubmodeItem = useCallback(
    (row: CategorySubcommandItem | undefined) => {
      if (!row) return;
      const item = row.item || {};
      if (item._websiteAction || item.category === 'page_action') {
        executeDropdownItem(item);
        return;
      }
      if (item._commandProxy) {
        const category = normalizeWebsiteCategory(item.category || item.referenceType || item.type);
        if (category === 'note') return openWebsiteNote(row);
        if (category === 'link') return openWebsiteLink(row);
        if (category === 'snippet') return openWebsiteSnippet(row);
        if (category === 'todo') return openWebsiteTodo(row);
        if (category === 'prompt') return openWebsiteAiPrompt(row);
        if (category === 'session') return openWebsiteCollection(row);

        const entityId = String(item.id || item.automation_id || item.agent_id || '').trim();
        if (entityId && (category === 'automation' || category === 'agent')) {
          const targetUrl = chrome.runtime.getURL(
            `AltS_search_newtab/index.html?trigger_hotkey=true&type=${encodeURIComponent(category)}&id=${encodeURIComponent(entityId)}`,
          );
          chrome.runtime.sendMessage({ action: 'open_tab', url: targetUrl, active: true }, () => {
            if (chrome.runtime.lastError) window.open(targetUrl, '_blank');
          });
          onClose();
        }
        return;
      }

      const commandId = String(item.id || row.suggestion?.id || '').replace(/^proxy_/, '').trim();
      if (!commandId) return;
      const targetUrl = chrome.runtime.getURL(
        `AltS_search_newtab/index.html?trigger_hotkey=true&type=command&id=${encodeURIComponent(commandId)}`,
      );
      chrome.runtime.sendMessage({ action: 'open_tab', url: targetUrl, active: true }, () => {
        if (chrome.runtime.lastError) window.open(targetUrl, '_blank');
      });
      onClose();
    },
    [
      executeDropdownItem,
      onClose,
      openWebsiteAiPrompt,
      openWebsiteCollection,
      openWebsiteLink,
      openWebsiteNote,
      openWebsiteSnippet,
      openWebsiteTodo,
    ],
  );

  const executeNormalCompactResult = useCallback(
    (result: NormalCompactResult | undefined) => {
      if (!result) return;
      const row: CategorySubcommandItem = {
        item: result.item,
        suggestion: result.suggestion,
        originalIndex: result.originalIndex,
      };
      if (result.kind === 'site-action') {
        executeDropdownItem(result.item);
      } else if (result.kind === 'category') {
        activateNormalCategorySelection(result.item?.id || result.item?.name, { clearSidebarPill: true });
      } else if (result.kind === 'update-note') {
        void updateNoteFromCommandRow(row);
      } else if (result.kind === 'command') {
        executeCommandSubmodeItem(row);
      } else if (result.kind === 'note') {
        openWebsiteNote(row);
      } else if (result.kind === 'link') {
        openWebsiteLink(row);
      } else if (result.kind === 'snippet') {
        openWebsiteSnippet(row);
      } else if (result.kind === 'todo') {
        openWebsiteTodo(row);
      } else if (result.kind === 'bookmark') {
        openWebsiteBookmark(row);
      } else if (result.kind === 'prompt') {
        openWebsiteAiPrompt(row);
      } else if (result.kind === 'collection') {
        openWebsiteCollection(row);
      }
    },
    [
      activateNormalCategorySelection,
      executeCommandSubmodeItem,
      executeDropdownItem,
      openWebsiteAiPrompt,
      openWebsiteBookmark,
      openWebsiteCollection,
      openWebsiteLink,
      openWebsiteNote,
      openWebsiteSnippet,
      openWebsiteTodo,
      updateNoteFromCommandRow,
    ],
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
        if (isLinkEditorOverlayOpen) {
          closeLinkEditorOverlay();
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (isTodoEditorOverlayOpen) {
          closeTodoEditorOverlay();
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (isNoteEditorOverlayOpen) {
          closeNoteEditorOverlay();
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (isSnippetEditorOverlayOpen) {
          closeSnippetEditorOverlay();
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (isAiPromptEditorOverlayOpen) {
          closeAiPromptEditorOverlay();
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (createCollectionDialog) {
          closeCreateCollectionDialog();
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (isCompactSubcommandMode) {
          exitCompactSubcommandMode();
          e.preventDefault();
          e.stopPropagation();
          return;
        }
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
  }, [
    exitCompactSubcommandMode,
    isCompactSubcommandMode,
    isOpen,
    onClose,
    isSettingsDropdownOpen,
    createCollectionDialog,
    closeCreateCollectionDialog,
    isLinkEditorOverlayOpen,
    closeLinkEditorOverlay,
    isTodoEditorOverlayOpen,
    closeTodoEditorOverlay,
    isNoteEditorOverlayOpen,
    closeNoteEditorOverlay,
    isSnippetEditorOverlayOpen,
    closeSnippetEditorOverlay,
    isAiPromptEditorOverlayOpen,
    closeAiPromptEditorOverlay,
  ]);

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

  const activeTypedTag = getActiveTagInfo(searchValue, commandSpace.commandPrefix, omniboxPrefixes);
  const aiPromptInitialModelUrls = useMemo(() => {
    if (!aiPromptEditorTarget?.url) return undefined;
    return {
      [inferModelIdFromUrl(aiPromptEditorTarget.url)]: aiPromptEditorTarget.url,
    };
  }, [aiPromptEditorTarget?.url, inferModelIdFromUrl]);

  const isCompactDropdownOpen =
    isCompactSubcommandMode ||
    isNormalGroupedSearchMode ||
    dropdownOptions.totalList.length > 0 ||
    (searchValue.startsWith('/') &&
      searchValue.trim() !== '' &&
      !parseAtMode(searchValue, omniboxPrefixes).activeSection);
  const compactDropdownContentHeight = isCompactSubcommandMode || isNormalGroupedSearchMode
    ? 400
    : 400;

  const compactSubcommandItems = useMemo(() => {
    if (isExistingCollectionMode) return filteredExistingCollections;
    if (isLinkSaveMode) return filteredSaveLinkItems;
    if (isTodoSaveMode) return filteredSaveTodoItems;
    if (isNoteSaveMode) return filteredSaveNoteItems;
    if (isSnippetSaveMode) return filteredSaveSnippetItems;
    if (isChatSaveMode) return filteredSaveChatItems;
    if (isSendToAgentMode) return filteredAgentPickerItems;
    if (isLinkCategoryMode) return filteredCategoryLinkItems;
    if (isSnippetCategoryMode) return filteredCategorySnippetItems;
    if (isTodoCategoryMode) return filteredCategoryTodoItems;
    if (isBookmarkCategoryMode) return filteredCategoryBookmarkItems;
    if (isCommandCategoryMode) return filteredCategoryCommandItems;
    if (isCollectionCategoryMode) return filteredCategoryCollectionItems;
    if (isPromptCategoryMode) return filteredCategoryPromptItems;
    return filteredCategoryNoteItems;
  }, [
    filteredAgentPickerItems,
    filteredCategoryBookmarkItems,
    filteredCategoryCollectionItems,
    filteredCategoryCommandItems,
    filteredCategoryLinkItems,
    filteredCategoryNoteItems,
    filteredCategoryPromptItems,
    filteredCategorySnippetItems,
    filteredCategoryTodoItems,
    filteredExistingCollections,
    filteredSaveLinkItems,
    filteredSaveNoteItems,
    filteredSaveChatItems,
    filteredSaveSnippetItems,
    filteredSaveTodoItems,
    isBookmarkCategoryMode,
    isCollectionCategoryMode,
    isCommandCategoryMode,
    isExistingCollectionMode,
    isLinkCategoryMode,
    isLinkSaveMode,
    isNoteSaveMode,
    isChatSaveMode,
    isPromptCategoryMode,
    isSendToAgentMode,
    isSnippetCategoryMode,
    isSnippetSaveMode,
    isTodoCategoryMode,
    isTodoSaveMode,
  ]);

  const compactSubcommandValue = isExistingCollectionMode
    ? collectionSearchValue
    : isLinkSaveMode
      ? linkSaveSearchValue
      : isTodoSaveMode
        ? todoSaveSearchValue
        : isNoteSaveMode
          ? noteSaveSearchValue
          : isSnippetSaveMode
            ? snippetSaveSearchValue
          : isChatSaveMode
            ? agentSearchValue
          : isSendToAgentMode
            ? agentSearchValue
            : categorySearchValue;

  const setCompactSubcommandValue = isExistingCollectionMode
    ? setCollectionSearchValue
    : isLinkSaveMode
      ? setLinkSaveSearchValue
      : isTodoSaveMode
        ? setTodoSaveSearchValue
        : isNoteSaveMode
        ? setNoteSaveSearchValue
        : isSnippetSaveMode
          ? setSnippetSaveSearchValue
          : isChatSaveMode
            ? setAgentSearchValue
          : isSendToAgentMode
            ? setAgentSearchValue
            : setCategorySearchValue;

  const handleSubcommandEnter = useCallback(() => {
    if (isTodoCategoryMode && todoQuickCreatePopup) return;

    const totalList = compactSubcommandItems;
    if (isExistingCollectionMode) {
      if (dropdownSelectedIndex === 0) {
        openCreateCollectionDialog();
      } else {
        const collectionItem = filteredExistingCollections[dropdownSelectedIndex - 1];
        if (collectionItem) void savePageToExistingCollection(collectionItem);
      }
      return;
    }

    if (isLinkSaveMode) {
      if (dropdownSelectedIndex === 0) {
        void createSavedLinkFromCurrentPage();
      } else {
        const linkItem = filteredSaveLinkItems[dropdownSelectedIndex - 1];
        if (linkItem) void savePageToExistingLink(linkItem);
      }
      return;
    }

    if (isTodoSaveMode) {
      if (dropdownSelectedIndex === 0) {
        void openTodoEditorFromCurrentPage();
      } else {
        const todoItem = filteredSaveTodoItems[dropdownSelectedIndex - 1];
        if (todoItem) void savePageLinkToExistingTodo(todoItem);
      }
      return;
    }

    if (isNoteSaveMode) {
      if (dropdownSelectedIndex === 0) {
        void openNoteEditorFromCurrentPage();
      } else {
        const noteItem = filteredSaveNoteItems[dropdownSelectedIndex - 1];
        if (noteItem) void savePageLinkToExistingNote(noteItem);
      }
      return;
    }

    if (isSnippetSaveMode) {
      if (dropdownSelectedIndex === 0) {
        void openSnippetEditorFromCurrentPage();
      } else {
        const snippetItem = filteredSaveSnippetItems[dropdownSelectedIndex - 1];
        if (snippetItem) openWebsiteSnippet(snippetItem);
      }
      return;
    }

    if (isChatSaveMode) {
      if (dropdownSelectedIndex === 0) {
        void createChatAgentFromCurrentPage();
      } else {
        const agentItem = filteredSaveChatItems[dropdownSelectedIndex - 1];
        if (agentItem) void saveCurrentAiUrlToExistingAgent(agentItem);
      }
      return;
    }

    if (isNoteCategoryMode) {
      if (dropdownSelectedIndex === 0) {
        noteQuickCreateAction();
      } else {
        const noteItem = filteredCategoryNoteItems[dropdownSelectedIndex - 1];
        if (noteItem) openWebsiteNote(noteItem as CategorySubcommandItem);
      }
      return;
    }

    if (isTodoCategoryMode) {
      if (dropdownSelectedIndex === 0) {
        todoQuickCreateAction();
      } else {
        const todoItem = filteredCategoryTodoItems[dropdownSelectedIndex - 1];
        if (todoItem) openWebsiteTodo(todoItem as CategorySubcommandItem);
      }
      return;
    }

    if (totalList.length === 0) return;
    const selectedIdx = Math.max(0, Math.min(dropdownSelectedIndex, totalList.length - 1));
    const selectedItem = totalList[selectedIdx];
    if (isSendToAgentMode) void sendPageToAgentPickerItem(selectedItem as any);
    else if (isNoteCategoryMode) openWebsiteNote(selectedItem as CategorySubcommandItem);
    else if (isLinkCategoryMode) openWebsiteLink(selectedItem as CategorySubcommandItem);
    else if (isSnippetCategoryMode) openWebsiteSnippet(selectedItem as CategorySubcommandItem);
    else if (isTodoCategoryMode) openWebsiteTodo(selectedItem as CategorySubcommandItem);
    else if (isBookmarkCategoryMode) openWebsiteBookmark(selectedItem as CategorySubcommandItem);
    else if (isCommandCategoryMode) executeCommandSubmodeItem(selectedItem as CategorySubcommandItem);
    else if (isCollectionCategoryMode) openWebsiteCollection(selectedItem as CategorySubcommandItem);
    else if (isPromptCategoryMode) openWebsiteAiPrompt(selectedItem as CategorySubcommandItem);
  }, [
    compactSubcommandItems,
    createSavedLinkFromCurrentPage,
    dropdownSelectedIndex,
    executeCommandSubmodeItem,
    filteredExistingCollections,
    filteredCategoryNoteItems,
    filteredCategoryTodoItems,
    filteredSaveLinkItems,
    filteredSaveNoteItems,
    filteredSaveChatItems,
    filteredSaveSnippetItems,
    filteredSaveTodoItems,
    isBookmarkCategoryMode,
    isCollectionCategoryMode,
    isCommandCategoryMode,
    isExistingCollectionMode,
    isLinkCategoryMode,
    isLinkSaveMode,
    isNoteCategoryMode,
    isNoteSaveMode,
    isSnippetSaveMode,
    isPromptCategoryMode,
    isSendToAgentMode,
    isChatSaveMode,
    isSnippetCategoryMode,
    isTodoCategoryMode,
    isTodoSaveMode,
    todoQuickCreatePopup,
    noteQuickCreateAction,
    noteQuickCreateFields.hasCreateIntent,
    openCreateCollectionDialog,
    openTodoEditorFromCurrentPage,
    openNoteEditorFromCurrentPage,
    openSnippetEditorFromCurrentPage,
    createChatAgentFromCurrentPage,
    openWebsiteSnippet,
    openWebsiteAiPrompt,
    openWebsiteBookmark,
    openWebsiteCollection,
    openWebsiteLink,
    openWebsiteNote,
    openWebsiteTodo,
    savePageLinkToExistingTodo,
    savePageLinkToExistingNote,
    savePageToExistingCollection,
    savePageToExistingLink,
    saveCurrentAiUrlToExistingAgent,
    sendPageToAgentPickerItem,
    todoQuickCreateAction,
  ]);

  useEffect(() => {
    if (isOpen && isCompactDropdownOpen) {
      setDropdownSelectedIndex(0);
    }
  }, [isOpen, isCompactDropdownOpen]);

  // Auto-scroll selected dropdown item into view when keyboard navigating.
  useEffect(() => {
    if (dropdownSelectedIndex < 0 || !isCompactDropdownOpen) return;
    const timer = window.setTimeout(() => {
      const dropdown = compactDropdownRef.current;
      if (!dropdown) return;
      const selectedRow = Array.from(dropdown.querySelectorAll<HTMLElement>('[id^="alts-dropdown-item-"]')).find(
        row => row.id === `alts-dropdown-item-${dropdownSelectedIndex}`,
      );
      if (!selectedRow) return;

      const padding = 8;
      const rowTop = selectedRow.offsetTop;
      const rowBottom = rowTop + selectedRow.offsetHeight;
      const viewTop = dropdown.scrollTop;
      const viewBottom = viewTop + dropdown.clientHeight;

      if (rowTop < viewTop + padding) {
        dropdown.scrollTop = Math.max(0, rowTop - padding);
      } else if (rowBottom > viewBottom - padding) {
        dropdown.scrollTop = rowBottom - dropdown.clientHeight + padding;
      }
    }, 20);
    return () => clearTimeout(timer);
  }, [dropdownSelectedIndex, isCompactDropdownOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className={clsx(
          'fixed inset-0 flex z-[2147483647]',
          'items-start justify-center pt-[clamp(56px,calc(50vh-248px),150px)] bg-transparent pointer-events-auto',
        )}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          .alts-popup-root {
            color: var(--alts-text-primary);
            background: transparent;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px;
            font-style: normal;
            font-weight: 400;
            line-height: normal;
            letter-spacing: normal;
            text-align: left;
            text-rendering: geometricPrecision;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            -webkit-text-size-adjust: 100%;
            text-size-adjust: 100%;
            isolation: isolate;
          }
          .alts-popup-root,
          .alts-popup-root * {
            box-sizing: border-box;
          }
          .alts-popup-root button,
          .alts-popup-root input,
          .alts-popup-root textarea,
          .alts-popup-root select {
            font: inherit;
            color: inherit;
            letter-spacing: inherit;
          }
          .alts-popup-root button {
            appearance: none;
            -webkit-appearance: none;
          }
          .alts-popup-root .alts-search-shell::after {
            content: "";
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            height: 1px;
            background: var(--alts-divider-color);
            pointer-events: none;
          }
          .alts-popup-root .alts-command-row {
            background: transparent;
            color: var(--alts-text-primary);
          }
          .alts-popup-root .alts-command-row:hover {
            background: var(--alts-row-hover-bg);
          }
          .alts-popup-root .alts-command-row[aria-selected="true"] {
            background: var(--alts-row-selected-bg) !important;
            color: var(--alts-text-primary) !important;
          }
          .alts-popup-root .alts-compact-list {
            scrollbar-width: thin;
            scrollbar-color: var(--alts-scrollbar-thumb) var(--alts-scrollbar-track);
            overscroll-behavior: contain;
          }
          .alts-popup-root .alts-compact-list:hover {
            scrollbar-color: var(--alts-scrollbar-thumb-hover) var(--alts-scrollbar-track);
          }
          .alts-popup-root .alts-compact-list::-webkit-scrollbar {
            width: 4px;
          }
          .alts-popup-root .alts-compact-list::-webkit-scrollbar-track {
            background: var(--alts-scrollbar-track);
          }
          .alts-popup-root .alts-compact-list::-webkit-scrollbar-thumb {
            background: var(--alts-scrollbar-thumb);
            background-clip: padding-box;
            border: 1px solid transparent;
            border-radius: 999px;
          }
          .alts-popup-root .alts-compact-list:hover::-webkit-scrollbar-thumb {
            background: var(--alts-scrollbar-thumb-hover);
            background-clip: padding-box;
          }
          .alts-popup-root .alts-compact-list::-webkit-scrollbar-thumb:hover {
            background: var(--alts-scrollbar-thumb-hover);
            background-clip: padding-box;
            border: 1px solid transparent;
          }
          .alts-popup-root .alts-icon-tile {
            width: var(--alts-icon-tile-width);
            height: var(--alts-icon-tile-height);
            flex: 0 0 var(--alts-icon-tile-width);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: var(--icon-tile-fg);
            background: var(--icon-tile-bg);
            border: 0;
            border-radius: var(--alts-icon-tile-radius);
            box-shadow: none;
            transition: color 80ms ease, background-color 80ms ease;
          }
          .alts-popup-root .alts-icon-tile svg {
            width: var(--alts-icon-size);
            height: var(--alts-icon-size);
            color: inherit;
            stroke: currentColor;
          }
          .alts-popup-root .alts-icon-tile[data-category="save"],
          .alts-popup-root .alts-icon-tile[data-category="collection"] {
            --icon-tile-bg: var(--alts-icon-tile-save-bg);
            --icon-tile-fg: var(--alts-icon-tile-save-fg);
            --icon-tile-selected-bg: var(--alts-icon-tile-save-selected-bg);
            --icon-tile-selected-fg: var(--alts-icon-tile-save-selected-fg);
          }
          .alts-popup-root .alts-icon-tile[data-category="save-action"] {
            --icon-tile-bg: color-mix(in srgb, var(--color-success) 72%, var(--alts-popup-bg));
            --icon-tile-fg: var(--alts-icon-tile-save-fg);
            --icon-tile-selected-bg: color-mix(in srgb, var(--color-success) 82%, var(--alts-popup-bg));
            --icon-tile-selected-fg: var(--alts-icon-tile-save-selected-fg);
          }
          .alts-popup-root .alts-icon-tile[data-category="ai"],
          .alts-popup-root .alts-icon-tile[data-category="agent"] {
            --icon-tile-bg: var(--alts-icon-tile-ai-bg);
            --icon-tile-fg: var(--alts-icon-tile-ai-fg);
            --icon-tile-selected-bg: var(--alts-icon-tile-ai-selected-bg);
            --icon-tile-selected-fg: var(--alts-icon-tile-ai-selected-fg);
          }
          .alts-popup-root .alts-icon-tile[data-category="summarize"] {
            --icon-tile-bg: var(--alts-icon-tile-summarize-bg);
            --icon-tile-fg: var(--alts-icon-tile-summarize-fg);
            --icon-tile-selected-bg: var(--alts-icon-tile-summarize-selected-bg);
            --icon-tile-selected-fg: var(--alts-icon-tile-summarize-selected-fg);
          }
          .alts-popup-root .alts-icon-tile[data-category="capture"],
          .alts-popup-root .alts-icon-tile[data-category="screenshot"] {
            --icon-tile-bg: var(--alts-icon-tile-capture-bg);
            --icon-tile-fg: var(--alts-icon-tile-capture-fg);
            --icon-tile-selected-bg: var(--alts-icon-tile-capture-selected-bg);
            --icon-tile-selected-fg: var(--alts-icon-tile-capture-selected-fg);
          }
          .alts-popup-root .alts-icon-tile[data-category="download"],
          .alts-popup-root .alts-icon-tile[data-category="extract"] {
            --icon-tile-bg: var(--alts-icon-tile-extract-bg);
            --icon-tile-fg: var(--alts-icon-tile-extract-fg);
            --icon-tile-selected-bg: var(--alts-icon-tile-extract-selected-bg);
            --icon-tile-selected-fg: var(--alts-icon-tile-extract-selected-fg);
          }
          .alts-popup-root .alts-icon-tile[data-category="action"],
          .alts-popup-root .alts-icon-tile:not([data-category]) {
            --icon-tile-bg: var(--alts-icon-tile-action-bg);
            --icon-tile-fg: var(--alts-icon-tile-action-fg);
            --icon-tile-selected-bg: var(--alts-icon-tile-action-selected-bg);
            --icon-tile-selected-fg: var(--alts-icon-tile-action-selected-fg);
          }
          .alts-popup-root .alts-command-row[aria-selected="true"] .alts-icon-tile {
            color: var(--icon-tile-selected-fg);
            background: var(--icon-tile-selected-bg);
          }
          .alts-popup-root[data-alts-tone="light"] .alts-icon-tile {
            box-shadow: none;
          }
        `}</style>
        {!createCollectionDialog && !isLinkEditorOverlayOpen && !isTodoEditorOverlayOpen && !isNoteEditorOverlayOpen && !isSnippetEditorOverlayOpen && !isAiPromptEditorOverlayOpen && <div className="absolute inset-0" onClick={onClose} />}

        {!createCollectionDialog && !isLinkEditorOverlayOpen && !isTodoEditorOverlayOpen && !isNoteEditorOverlayOpen && !isSnippetEditorOverlayOpen && !isAiPromptEditorOverlayOpen && (
          <motion.div
            ref={mainContainerRef}
            initial={{ scale: 0.96, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 15 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={clsx(
              "relative font-['Inter',_sans-serif] text-[14px] leading-normal text-left text-[var(--color-textPrimary)] antialiased box-border m-0 p-0 transition-all duration-200",
              'alts-popup-root w-[min(760px,calc(100vw-32px))] h-auto shadow-none',
            )}>
          {/* Compact content container */}
          <div
            ref={compactPopupSurfaceRef}
            data-alts-tone={altsTone}
            className={clsx(
              'z-[2] flex flex-col transition-all duration-200',
              'relative w-full overflow-hidden border border-[var(--alts-border-color)] rounded-[8px] shadow-none bg-[var(--alts-popup-bg)]',
            )}
            style={{
              ...altsPaletteStyle,
              backgroundColor: 'var(--alts-popup-bg)',
              color: 'var(--alts-text-primary)',
              boxShadow: 'var(--alts-popup-shadow)',
              minHeight: isCompactDropdownOpen
                ? `calc(64px + min(${compactDropdownContentHeight}px, calc(100vh - 144px)))`
                : undefined,
              opacity: 1,
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
            }}>
            <div
              className={clsx(
                'shrink-0 relative w-full',
                'p-0',
                'flex justify-center',
              )}>
              <div
                ref={searchContainerRef}
                className={clsx(
                  'alts-search-shell relative flex items-center group transition-colors shadow-none z-[60]',
                  isCompactSubcommandMode ? 'min-h-[52px] px-3' : 'min-h-[60px] px-4',
                  'w-full bg-[var(--alts-search-bg)] border-0',
                  isCompactDropdownOpen
                    ? 'rounded-none border-b border-b-[var(--alts-divider-color)]'
                    : 'rounded-none border-b border-b-[var(--alts-divider-color)]',
                )}
                style={{
                  backgroundColor: 'var(--alts-search-bg)',
                  opacity: 1,
                  backdropFilter: 'none',
                  WebkitBackdropFilter: 'none',
                }}>
                <div className="relative flex-1 h-full flex items-center">
                  {(() => {
                    if (isCompactSubcommandMode) {
                      return (
                        <div className="relative flex-1">
                          <AltSSubcommandSearch
                            inputRef={searchInputRef}
                            mode={compactSubcommandMode}
                            value={compactSubcommandValue}
                            items={compactSubcommandItems}
                            selectedIndex={dropdownSelectedIndex}
                            setSelectedIndex={setDropdownSelectedIndex}
                            setDropdownVisible={setIsDropdownVisible}
                            setValue={setCompactSubcommandValue}
                            onExit={exitCompactSubcommandMode}
                            onEnter={handleSubcommandEnter}
                            onTab={
                              isNoteCategoryMode
                                ? insertNextNoteQuickCreateField
                                : isTodoCategoryMode
                                  ? insertNextTodoQuickCreateField
                                  : undefined
                            }
                            onBackspace={
                              isTodoCategoryMode
                                ? (_value, cursorPosition) => removeTodoQuickCreateFieldAtCursor(cursorPosition)
                                : undefined
                            }
                            hasLeadingCreateRow={noteHasLeadingCreateRow || todoHasLeadingCreateRow}
                            placeholder={
                              isNoteCategoryMode
                                ? noteQuickCreatePlaceholder
                                : isTodoCategoryMode
                                  ? todoQuickCreatePlaceholder
                                  : undefined
                            }
                            rightHint={
                              isNoteCategoryMode
                                ? noteQuickCreateSearchHint
                                : isTodoCategoryMode
                                  ? todoQuickCreateSearchHint
                                  : undefined
                            }
                          />
                          {isTodoCategoryMode && todoQuickCreatePopup === 'time'
                            ? ReactDOM.createPortal(
                                <NewDueDateDropdown
                                  isOpen
                                  onClose={() => closeTodoQuickCreatePopup()}
                                  onSelect={selection => {
                                    setTodoQuickCreateSchedule(selection);
                                    setTodoQuickCreatePopup(null);
                                    setDropdownSelectedIndex(0);
                                    replaceTodoQuickCreateFieldValue(
                                      'time',
                                      formatTodoQuickCreateScheduleValue(selection),
                                      { advance: true },
                                    );
                                  }}
                                  currentDate={todoQuickCreateSchedule?.date}
                                  currentTime={todoQuickCreateSchedule?.time || undefined}
                                  initialQuery={todoQuickCreateFields.time}
                                  onBackspaceEmpty={() => removeTodoQuickCreateFieldAtCursor(null, { forceField: 'time' })}
                                  rootDataAttributes={{ 'data-todo-quick-create-popup': '' }}
                                  closeOnSelect={false}
                                  rootStyle={{
                                    ...altsPaletteStyle,
                                    position: 'absolute',
                                    top: `${todoQuickCreatePopupPosition.top}px`,
                                    left: `${todoQuickCreatePopupPosition.left}px`,
                                  }}
                                  positionClassName=""
                                />,
                                mainContainerRef.current || document.body,
                              )
                            : null}
                          {isTodoCategoryMode && todoQuickCreatePopup === 'recurring' ? (
                            <div
                              ref={todoQuickCreateRecurringRef}
                              data-todo-quick-create-popup
                              onMouseDown={e => e.stopPropagation()}
                              className="absolute left-3 top-full mt-1 w-[160px] rounded-xl shadow-2xl z-[99999] bg-[var(--color-contextMenuBg,var(--alts-popup-bg))] backdrop-blur-md border border-[var(--color-borderDefault,var(--alts-border-color))] overflow-hidden text-[var(--color-textPrimary,var(--alts-text-primary))]">
                              {[
                                { id: 'one-time', label: 'Once' },
                                { id: 'daily', label: 'Daily' },
                                { id: 'weekly', label: 'Weekly' },
                                { id: 'monthly', label: 'Monthly' },
                              ].map((opt, idx) => {
                                const isSelected = (todoQuickCreateRecurring || 'one-time') === opt.id;
                                return (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    aria-selected={isSelected}
                                    onMouseDown={e => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      selectTodoQuickCreateRecurring(opt.id as 'one-time' | 'daily' | 'weekly' | 'monthly');
                                    }}
                                    onClick={e => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                    }}
                                    onKeyDown={e => {
                                      if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Backspace'].includes(e.key)) return;
                                      if (e.key === 'Backspace' && removeTodoQuickCreateFieldAtCursor(null, { forceField: 'recurring' })) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        return;
                                      }
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (e.key === 'Enter') {
                                        selectTodoQuickCreateRecurring(opt.id as 'one-time' | 'daily' | 'weekly' | 'monthly');
                                        return;
                                      }
                                      if (e.key === 'Escape') {
                                        closeTodoQuickCreatePopup();
                                        return;
                                      }
                                      const buttons = Array.from(
                                        e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[data-todo-recurring-option]') || [],
                                      );
                                      const currentIndex = buttons.indexOf(e.currentTarget);
                                      const offset = e.key === 'ArrowDown' ? 1 : -1;
                                      const nextIndex = (currentIndex + offset + buttons.length) % buttons.length;
                                      buttons[nextIndex]?.focus();
                                    }}
                                    data-todo-recurring-option
                                    className={clsx(
                                      'w-full flex items-center gap-2 px-3 py-2 text-left text-[12.5px] font-medium transition-colors cursor-pointer',
                                      isSelected
                                        ? 'bg-[var(--alts-row-hover-bg)] text-[var(--alts-text-primary)]'
                                        : 'text-[var(--alts-text-primary)] hover:bg-[var(--alts-row-hover-bg)]',
                                    )}
                                    autoFocus={idx === 0}>
                                    <BsCalendarCheck className="w-3.5 h-3.5 shrink-0 text-current" />
                                    <span>{opt.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                          {isTodoCategoryMode && todoQuickCreatePopup === 'reference'
                            ? ReactDOM.createPortal(
                                <div
                                  data-todo-quick-create-popup
                                  style={{
                                    ...altsPaletteStyle,
                                    position: 'absolute',
                                    top: `${todoQuickCreatePopupPosition.top}px`,
                                    left: `${todoQuickCreatePopupPosition.left}px`,
                                  }}
                                  className="w-[600px] max-w-[80vw] rounded-2xl shadow-2xl z-[99999] bg-[var(--color-contextMenuBg,var(--alts-popup-bg))] backdrop-blur-md border border-[var(--color-borderDefault,var(--alts-border-color))] overflow-hidden flex flex-col font-sans text-[var(--alts-text-primary)]"
                                  onMouseDown={e => e.stopPropagation()}>
                              <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--alts-border-color)] bg-[var(--alts-search-bg)]">
                                <FiSearch className="w-3.5 h-3.5 shrink-0 text-[var(--alts-text-secondary)]" />
                                <input
                                  ref={todoQuickCreateReferenceInputRef}
                                  type="text"
                                  placeholder="Search and select files..."
                                  value={todoQuickCreateReferenceQuery}
                                  onChange={e => {
                                    setTodoQuickCreateReferenceQuery(e.target.value);
                                    setTodoQuickCreateReferenceIndex(0);
                                  }}
                                  onKeyDown={e => {
                                    e.stopPropagation();
                                    if (e.key === 'Backspace' && todoQuickCreateReferenceQuery === '') {
                                      if (removeTodoQuickCreateFieldAtCursor(null, { forceField: 'reference' })) {
                                        e.preventDefault();
                                        return;
                                      }
                                    }
                                    if (!['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) return;
                                    e.preventDefault();
                                    if (e.key === 'ArrowDown') {
                                      setTodoQuickCreateReferenceIndex(prev =>
                                        todoQuickCreateActiveReferenceItems.length === 0
                                          ? 0
                                          : Math.min(prev + 1, todoQuickCreateActiveReferenceItems.length - 1),
                                      );
                                      return;
                                    }
                                    if (e.key === 'ArrowUp') {
                                      setTodoQuickCreateReferenceIndex(prev => Math.max(prev - 1, 0));
                                      return;
                                    }
                                    if (e.key === 'Escape') {
                                      closeTodoQuickCreatePopup();
                                      return;
                                    }
                                    const highlightedReference = todoQuickCreateActiveReferenceItems[todoQuickCreateReferenceIndex];
                                    const acceptedReferences =
                                      todoQuickCreateReferences.length > 0
                                        ? todoQuickCreateReferences
                                        : highlightedReference
                                          ? [highlightedReference]
                                          : [];
                                    if (acceptedReferences.length > 0) {
                                      setTodoQuickCreateReferences(acceptedReferences);
                                      replaceTodoQuickCreateFieldValue(
                                        'reference',
                                        acceptedReferences.map(item => item.name).join(', '),
                                        { advance: true },
                                      );
                                    } else {
                                      replaceTodoQuickCreateFieldValue('reference', todoQuickCreateReferenceQuery, { advance: true });
                                    }
                                    setTodoQuickCreatePopup(null);
                                  }}
                                  className="flex-1 min-w-0 bg-transparent border-none text-[13px] font-medium text-[var(--alts-text-primary)] placeholder:text-[var(--alts-text-placeholder)] focus:outline-none"
                                  autoFocus
                                />
                                {todoQuickCreateReferences.length > 0 ? (
                                  <span className="shrink-0 rounded-lg border border-[var(--alts-border-color)] bg-[var(--alts-row-hover-bg)] px-2.5 py-1 text-[11px] text-[var(--alts-text-secondary)]">
                                    {todoQuickCreateReferences.length} selected
                                  </span>
                                ) : null}
                                <button
                                  type="button"
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  onClick={() => closeTodoQuickCreatePopup()}
                                  className="p-1 text-[var(--alts-text-secondary)] hover:text-[var(--alts-text-primary)]">
                                  <FaTimes className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="flex h-[250px]">
                                <div className="w-[150px] shrink-0 flex flex-col gap-0.5 py-2 px-1.5 border-r border-[var(--alts-border-color)] bg-[var(--alts-popup-bg)] overflow-y-auto no-scrollbar">
                                  {todoQuickCreateReferenceCategoryRows.map(row => {
                                    const isActive = todoQuickCreateReferenceCategory === row.key;
                                    return (
                                      <button
                                        key={row.key}
                                        type="button"
                                        onMouseDown={e => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setTodoQuickCreateReferenceCategory(row.key);
                                          setTodoQuickCreateReferenceIndex(0);
                                        }}
                                        onClick={e => e.stopPropagation()}
                                        className={clsx(
                                          'flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-all border',
                                          isActive
                                            ? 'bg-[var(--alts-row-hover-bg)] text-[var(--alts-text-primary)] font-semibold border-[var(--alts-border-color)]'
                                            : 'text-[var(--alts-text-secondary)] hover:bg-[var(--alts-row-hover-bg)] hover:text-[var(--alts-text-primary)] border-transparent',
                                        )}>
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          {row.icon}
                                          <span className="text-[12px] truncate font-normal">{row.label}</span>
                                        </div>
                                        <span className="text-[9.5px] text-[var(--alts-text-secondary)] tabular-nums font-normal">
                                          {row.items.length}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="flex-1 flex flex-col bg-transparent overflow-hidden">
                                  <div className="flex items-center gap-1.5 px-4 py-2 border-b border-[var(--alts-border-color)] bg-[var(--alts-search-bg)] shrink-0">
                                    <span className="text-[10px] font-semibold text-[var(--alts-text-secondary)] uppercase tracking-wider">
                                      {todoQuickCreateReferenceCategoryRows.find(row => row.key === todoQuickCreateReferenceCategory)?.label || 'All'}
                                    </span>
                                    <span className="text-[var(--alts-text-secondary)] font-normal">·</span>
                                    <span className="text-[10px] text-[var(--alts-text-secondary)] tabular-nums font-normal">
                                      {todoQuickCreateActiveReferenceItems.length} items
                                    </span>
                                  </div>
                                  <div className="overflow-y-auto no-scrollbar flex flex-col flex-1">
                                    {todoQuickCreateActiveReferenceItems.length === 0 ? (
                                      <div className="h-full flex items-center justify-center">
                                        <span className="text-[12px] text-[var(--alts-text-secondary)] font-normal">
                                          Nothing here
                                        </span>
                                      </div>
                                    ) : (
                                      todoQuickCreateActiveReferenceItems.map((item, idx) => {
                                        const isSelected = todoQuickCreateReferences.some(ref => ref.id === item.id);
                                        const isHighlighted = idx === todoQuickCreateReferenceIndex;
                                        return (
                                          <button
                                            key={`${item.category}:${item.id}`}
                                            type="button"
                                            onMouseEnter={() => setTodoQuickCreateReferenceIndex(idx)}
                                            onMouseDown={e => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              const nextReferences = todoQuickCreateReferences.some(ref => ref.id === item.id)
                                                ? todoQuickCreateReferences.filter(ref => ref.id !== item.id)
                                                : [...todoQuickCreateReferences, item];
                                              setTodoQuickCreateReferences(nextReferences);
                                              setTodoQuickCreateReferenceQuery('');
                                              setTodoQuickCreateReferenceIndex(0);
                                              replaceTodoQuickCreateFieldValue(
                                                'reference',
                                                nextReferences.map(ref => ref.name).join(', '),
                                                { focusSearch: false },
                                              );
                                            }}
                                            onClick={e => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                            }}
                                            className={clsx(
                                              'flex items-center gap-3 px-4 py-2.5 border-b border-[var(--alts-border-color)] text-left transition-all cursor-pointer',
                                              isSelected
                                                ? 'bg-[var(--alts-row-hover-bg)] text-[var(--alts-text-primary)] font-medium'
                                                : isHighlighted
                                                  ? 'bg-[var(--alts-row-hover-bg)] text-[var(--alts-text-primary)] font-medium'
                                                  : 'text-[var(--alts-text-primary)] hover:bg-[var(--alts-row-hover-bg)]',
                                            )}>
                                            <span
                                              className={clsx(
                                                'w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center shrink-0 transition-all',
                                                isSelected
                                                  ? 'bg-[var(--alts-text-primary)] border-[var(--alts-text-primary)] text-[var(--alts-popup-bg)]'
                                                  : 'border-[var(--alts-border-color)] bg-transparent',
                                              )}>
                                              {isSelected ? <FaCheck className="w-2 h-2" /> : null}
                                            </span>
                                            <span className={COMPACT_DROPDOWN_ITEM_ICON_CLASS} data-category="action">
                                              {item.category === 'link' ? (
                                                <FaLink className="w-4 h-4 shrink-0 text-current" />
                                              ) : item.category === 'snippet' ? (
                                                <FaCode className="w-4 h-4 shrink-0 text-current" />
                                              ) : item.category === 'tabgroup' ? (
                                                <FaLayerGroup className="w-4 h-4 shrink-0 text-current" />
                                              ) : item.category === 'agent' || item.category === 'aiPrompt' ? (
                                                <LuSparkles className="w-4 h-4 shrink-0 text-current" />
                                              ) : (
                                                <FiFileText className="w-4 h-4 shrink-0 text-current" />
                                              )}
                                            </span>
                                            <span className="min-w-0 flex-1 truncate text-[12.5px] font-normal leading-snug">
                                              {item.name}
                                            </span>
                                            {todoQuickCreateReferenceCategory === 'all' && item.category ? (
                                              <span className="text-[10px] text-[var(--alts-text-secondary)] font-normal shrink-0 ml-1.5 opacity-70">
                                                {item.category === 'aiPrompt' ? 'AI Prompt' : item.category === 'tabgroup' ? 'Tab Session' : String(item.category).charAt(0).toUpperCase() + String(item.category).slice(1)}
                                              </span>
                                            ) : null}
                                          </button>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>
                              </div>
                                </div>,
                                mainContainerRef.current || document.body,
                              )
                            : null}
                        </div>
                      );
                    }

                    const activeTag = showSidebarSectionPill
                      ? activeTypedTag ||
                        (searchValue.trim() === '' ? getSidebarSectionTagInfo(selectedSidebarSection) : null)
                      : null;
                    if (!activeTag) {
                      const showCompactBrandIcon = searchValue.trim().length === 0;
                      return (
                        <>
                          {showCompactBrandIcon && (
                            <span className="mr-3 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md">
                              <img src={cmdOSLogo} alt="cmdOS" className="h-full w-full object-contain opacity-80" />
                            </span>
                          )}
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
                              const totalList = isNormalGroupedSearchMode
                                ? normalCompactResults
                                : dropdownOptions.totalList;
                              if (e.key === 'Tab' && isNormalGroupedSearchMode && totalList.length > 0) {
                                const selectedIdx = Math.max(
                                  0,
                                  Math.min(dropdownSelectedIndex, totalList.length - 1),
                                );
                                const chosen = totalList[selectedIdx] as NormalCompactResult;
                                if (chosen?.kind === 'update-note') {
                                  e.preventDefault();
                                  insertUpdateNoteField(chosen.item);
                                  return;
                                }
                              }
                              if (totalList.length > 0) {
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
                                    const chosen = totalList[selectedIdx] as any;
                                    if (isNormalGroupedSearchMode) {
                                      executeNormalCompactResult(chosen as NormalCompactResult);
                                      return;
                                    }
                                    if (chosen.type.includes('action')) {
                                      handleExecute((chosen as any).item || chosen);
                                      if (
                                        ((chosen as any).item || chosen)?.id === 'add_to_existing' ||
                                        ((chosen as any).item || chosen)?.id === 'send_to_agent' ||
                                        ((chosen as any).item || chosen)?.id === 'save_chat'
                                      ) {
                                        return;
                                      }
                                      setSearchValue('');
                                      setShowSidebarSectionPill(false);
                                      setDropdownSelectedIndex(-1);
                                      setIsDropdownVisible(false);
                                    } else {
                                      activateNormalCategorySelection(chosen.id, { clearSidebarPill: true });
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
                            placeholder="Search actions, collections, agents..."
                            className="flex-1 min-w-0 bg-transparent border-none text-[19px] font-normal caret-[var(--alts-text-primary)] placeholder-[var(--alts-text-placeholder)] focus:outline-none focus:ring-0 h-full z-10 text-[var(--alts-text-primary)]"
                          />
                          {selectedUpdateNoteSearchHint ? (
                            <div className="ml-3 hidden max-w-[300px] shrink-0 items-center gap-1.5 truncate text-right text-[11px] font-medium text-[var(--alts-shortcut-text)] sm:flex">
                              {selectedUpdateNoteSearchHint.startsWith('Tab:') ? (
                                <>
                                  <span className="rounded border border-[var(--alts-border-color)] bg-[var(--alts-row-hover-bg)] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[var(--alts-text-primary)]">
                                    Tab
                                  </span>
                                  <span className="min-w-0 truncate">
                                    {selectedUpdateNoteSearchHint.replace(/^Tab:\s*/, '')}
                                  </span>
                                </>
                              ) : (
                                <span className="min-w-0 truncate">{selectedUpdateNoteSearchHint}</span>
                              )}
                            </div>
                          ) : null}
                        </>
                      );
                    }

                    return (
                      <div className="flex-1 flex items-center h-full">
                        <div className="flex items-center gap-1.5 mr-2 bg-[var(--alts-shortcut-bg)] border border-[var(--alts-shortcut-border)] rounded-md px-2.5 py-0.5 shadow-none text-[var(--alts-shortcut-text)] select-none">
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
                            const totalList = isNormalGroupedSearchMode
                              ? normalCompactResults
                              : dropdownOptions.totalList;
                            if (totalList.length > 0) {
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
                                  const chosen = totalList[selectedIdx] as any;
                                  if (isNormalGroupedSearchMode) {
                                    executeNormalCompactResult(chosen as NormalCompactResult);
                                    return;
                                  }
                                  if (chosen.type === 'action') {
                                    handleExecute((chosen as any).item);
                                    if (
                                      ((chosen as any).item || chosen)?.id === 'add_to_existing' ||
                                      ((chosen as any).item || chosen)?.id === 'send_to_agent' ||
                                      ((chosen as any).item || chosen)?.id === 'save_chat'
                                    ) {
                                      return;
                                    }
                                    setSearchValue('');
                                    setDropdownSelectedIndex(-1);
                                    setIsDropdownVisible(false);
                                  } else {
                                    activateNormalCategorySelection(chosen.id, { clearSidebarPill: false });
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
                          className="flex-1 min-w-0 bg-transparent border-none text-[19px] font-normal caret-[var(--alts-text-primary)] placeholder-[var(--alts-text-placeholder)] focus:outline-none focus:ring-0 h-full z-10 text-[var(--alts-text-primary)]"
                        />
                      </div>
                    );
                  })()}
                </div>

                {isCompactDropdownOpen && (
                    <div
                      ref={compactDropdownRef}
                      id={isCompactSubcommandMode ? 'alts-submode-results' : undefined}
                      role={isCompactSubcommandMode ? 'listbox' : undefined}
                      aria-busy={isCompactSubcommandMode ? false : undefined}
                      className={clsx(
                        'alts-compact-list absolute top-[100%] left-0 w-full border-0 rounded-none shadow-none z-[70] flex flex-col pt-1 pb-1.5 max-h-[400px] overflow-y-auto overflow-x-hidden group/sidebar',
                        'bg-[var(--alts-list-bg)]',
                      )}
                      style={{
                        backgroundColor: 'var(--alts-list-bg)',
                        maxHeight: `${compactDropdownContentHeight}px`,
                        opacity: 1,
                        backdropFilter: 'none',
                        WebkitBackdropFilter: 'none',
                      }}>
                      {(() => {
                        const DROPDOWN_ITEM_BASE_CLASS = COMPACT_DROPDOWN_ITEM_BASE_CLASS;
                        const DROPDOWN_ITEM_SELECTED_CLASS = COMPACT_DROPDOWN_ITEM_SELECTED_CLASS;
                        const DROPDOWN_ITEM_UNSELECTED_CLASS = COMPACT_DROPDOWN_ITEM_UNSELECTED_CLASS;
                        const DROPDOWN_ITEM_LABEL_CLASS = COMPACT_DROPDOWN_ITEM_LABEL_CLASS;
                        const DROPDOWN_ITEM_CONTENT_CLASS = COMPACT_DROPDOWN_ITEM_CONTENT_CLASS;
                        const DROPDOWN_ITEM_PRIMARY_CLASS = COMPACT_DROPDOWN_ITEM_PRIMARY_CLASS;
                        const DROPDOWN_ITEM_TEXT_CLASS = COMPACT_DROPDOWN_ITEM_TEXT_CLASS;
                        const DROPDOWN_ITEM_ICON_CLASS = COMPACT_DROPDOWN_ITEM_ICON_CLASS;
                        const DROPDOWN_ITEM_RIGHT_META_CLASS = COMPACT_DROPDOWN_ITEM_RIGHT_META_CLASS;
                        const DropdownSectionHeader = CompactDropdownSectionHeader;

                        const renderNormalCompactResult = (result: NormalCompactResult, resultIndex: number) => {
                          const item = result.item || {};
                          const isSelected = dropdownSelectedIndex === resultIndex;
                          const commonProps = {
                            id: `alts-dropdown-item-${resultIndex}`,
                            role: 'option',
                            'aria-selected': isSelected,
                            tabIndex: -1,
                            onMouseDown: (e: React.MouseEvent) => {
                              e.preventDefault();
                              e.stopPropagation();
                            },
                            onMouseEnter: () => setDropdownSelectedIndex(resultIndex),
                            className: clsx(
                              DROPDOWN_ITEM_BASE_CLASS,
                              isSelected ? DROPDOWN_ITEM_SELECTED_CLASS : DROPDOWN_ITEM_UNSELECTED_CLASS,
                            ),
                          };

                          if (result.kind === 'site-action') {
                            const actionPrefixVal = getActionPrefixMap(omniboxPrefixes)[item.id] || item.prefix || '';
                            const icon =
                              PAGE_ACTION_ICONS[item.id] ||
                              (item.id === 'add_to_existing' ? (
                                <FaLayerGroup className="w-4 h-4 shrink-0 text-current" />
                              ) : item.id === 'save_link' ? (
                                <FaLink className="w-4 h-4 shrink-0 text-current" />
                              ) : item.id === 'save_todo' ? (
                                <BsCalendarCheck className="w-4 h-4 shrink-0 text-current" />
                              ) : item.id === 'save_note' ? (
                                <FiFileText className="w-4 h-4 shrink-0 text-current" />
                              ) : item.id === 'save_snippet' ? (
                                <FaCode className="w-4 h-4 shrink-0 text-current" />
                              ) : item.id === 'save_chat' ? (
                                <LuSparkles className="w-4 h-4 shrink-0 text-current" />
                              ) : item.id === 'send_to_agent' ? (
                                <FiSend className="w-4 h-4 shrink-0 text-current" />
                              ) : (
                                <FaRegFileAlt className="w-4 h-4 shrink-0 text-current" />
                              ));
                            return (
                              <button
                                type="button"
                                key={`normal-site-${item.id || resultIndex}`}
                                {...commonProps}
                                onClick={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  executeNormalCompactResult(result);
                                }}>
                                <div className={DROPDOWN_ITEM_CONTENT_CLASS}>
                                  <div className={DROPDOWN_ITEM_PRIMARY_CLASS}>
                                    <span className={DROPDOWN_ITEM_ICON_CLASS} data-category={getIconTileCategory(item.id)}>
                                      {icon}
                                    </span>
                                    <div className={DROPDOWN_ITEM_TEXT_CLASS}>
                                      <span className={clsx(DROPDOWN_ITEM_LABEL_CLASS, 'min-w-0 truncate')}>
                                        {item.name || item.title || 'Action'}
                                      </span>
                                    </div>
                                  </div>
                                  <span
                                    onClick={e => e.stopPropagation()}
                                    onMouseDown={e => e.stopPropagation()}
                                    className={DROPDOWN_ITEM_RIGHT_META_CLASS}
                                  >
                                    {actionPrefixVal ? (
                                      <EditablePrefixKey
                                        category={item.id as any}
                                        currentValue={actionPrefixVal}
                                        alwaysVisible
                                        variant="compactPalette"
                                      />
                                    ) : null}
                                  </span>
                                </div>
                              </button>
                            );
                          }

                          if (result.kind === 'category') {
                            const optionName = String(item.id || item.name || '');
                            const categoryKey = CATEGORY_PREFIX_KEY_BY_OPTION[optionName];
                            const prefixValue = categoryKey ? String((omniboxPrefixes as any)?.[categoryKey] || '') : '';
                            const title = SECTION_META[optionName]?.title || optionName;
                            const icon = SECTION_META[optionName]?.icon || <FiFileText className="w-4 h-4 shrink-0" />;
                            return (
                              <NormalModeCategoryRow
                                key={`normal-category-${optionName || resultIndex}`}
                                optionName={optionName}
                                globalIdx={resultIndex}
                                isSelected={isSelected}
                                title={title}
                                icon={icon}
                                categoryKey={categoryKey}
                                prefixValue={prefixValue}
                                onActivate={(categoryName) =>
                                  activateNormalCategorySelection(categoryName, { clearSidebarPill: true })
                                }
                                onSelect={setDropdownSelectedIndex}
                              />
                            );
                          }

                          const title =
                            result.kind === 'command'
                              ? item.label || item.name || item.title || 'Untitled Command'
                              : result.kind === 'todo'
                              ? item.name || item.title || item.key || 'Untitled Todo'
                              : result.kind === 'snippet'
                                ? item.title || item.key || item.name || 'Untitled Text Expander'
                                : result.kind === 'bookmark'
                                  ? item.title || item.url || 'Untitled Bookmark'
                                  : result.kind === 'collection'
                                    ? item.title || item.sessionName || item.name || 'Untitled Collection'
                                    : result.kind === 'prompt'
                                      ? item.title || item.name || 'Untitled Prompt'
                                      : result.kind === 'link'
                                        ? item.title || item.name || 'Untitled Link'
                                        : item.title || item.name || 'Untitled Note';
                          const description =
                            result.kind === 'command'
                              ? String(item.description || '')
                              : result.kind === 'note' || result.kind === 'update-note'
                              ? getNoteDescription(item)
                              : result.kind === 'link'
                                ? getLinkDomains(item)
                                : result.kind === 'snippet'
                                  ? getSnippetDescription(item)
                                  : result.kind === 'todo'
                                    ? getTodoDescription(item)
                                    : result.kind === 'bookmark'
                                      ? getBookmarkMeta(item)
                                      : result.kind === 'prompt'
                                      ? getAiPromptDescription(item)
                                        : '';
                          const updateNoteRowMeta =
                            result.kind === 'update-note'
                              ? item._noteUpdateRowMeta ||
                                [
                                  item._noteUpdateFields?.description
                                    ? `Append: ${item._noteUpdateFields.description}`
                                    : null,
                                  Array.isArray(item._noteUpdateFields?.tagNames) &&
                                  item._noteUpdateFields.tagNames.length > 0
                                    ? `Tags: ${item._noteUpdateFields.tagNames.join(', ')}`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join('  |  ') ||
                                `Tab: ${noteQuickCreatePrefixLabels.description} append description, ${noteQuickCreatePrefixLabels.tag} work, client`
                              : '';
                          const shortcutDisplay =
                            updateNoteRowMeta
                              ? String(updateNoteRowMeta)
                              : item._displayShortcut
                                ? String(item._displayShortcut)
                              : result.kind === 'bookmark'
                              ? ''
                              : result.kind === 'command'
                                ? `${getCommandSpacePrefix(omniboxPrefixes)} ${String(item.prefix || '').trim()}`.trim()
                              : result.kind === 'collection'
                                ? getSubcommandShortcutDisplay(item, 'collection')
                                : result.kind === 'prompt'
                                  ? getSubcommandShortcutDisplay(item, 'prompt')
                                  : getSubcommandShortcutDisplay(item, result.kind as any);
                          const urls =
                            result.kind === 'bookmark'
                              ? [getBookmarkUrl(item)].filter(Boolean)
                              : result.kind === 'link'
                                ? getLinkUrls(item)
                                : [];
                          const icon =
                            result.kind === 'link' || result.kind === 'bookmark' ? (
                              <span className="w-8 h-5 flex items-center shrink-0">
                                <StackedLinkIcon urls={urls} size={18} fallback="link" />
                              </span>
                            ) : (
                              <span
                                className={DROPDOWN_ITEM_ICON_CLASS}
                                data-category={result.kind === 'prompt' ? 'ai' : result.kind === 'collection' ? 'save' : 'action'}
                              >
                                {result.kind === 'snippet' ? (
                                  <FaCode className="w-4 h-4 shrink-0 text-current" />
                                ) : result.kind === 'command' ? (
                                  <FiTerminal className="w-4 h-4 shrink-0 text-current" />
                                ) : result.kind === 'todo' ? (
                                  <BsCalendarCheck className="w-4 h-4 shrink-0 text-current" />
                                ) : result.kind === 'prompt' ? (
                                  <LuSparkles className="w-4 h-4 shrink-0 text-current" />
                                ) : result.kind === 'collection' ? (
                                  <FaLayerGroup className="w-4 h-4 shrink-0 text-current" />
                                ) : (
                                  <FiFileText className="w-4 h-4 shrink-0 text-current" />
                                )}
                              </span>
                            );

                          return (
                            <NormalModeResultRow
                              key={`normal-${result.kind}-${item.id || item.url || resultIndex}`}
                              rowKey={`normal-${result.kind}-${item.id || item.url || resultIndex}`}
                              itemIndex={resultIndex}
                              isSelected={isSelected}
                              icon={icon}
                              title={title}
                              description={description}
                              shortcutDisplay={shortcutDisplay}
                              shortcutDisplayClassName={
                                result.kind === 'update-note'
                                  ? 'mr-3 ml-auto flex min-w-0 max-w-[360px] flex-1 justify-end truncate text-right text-[11px] font-medium text-[var(--alts-shortcut-text)]'
                                  : undefined
                              }
                              stacked
                              onExecute={() => executeNormalCompactResult(result)}
                              onSelect={setDropdownSelectedIndex}
                            />
                          );
                        };

                        if (isNormalGroupedSearchMode) {
                          if (normalCompactGroups.length === 0) {
                            return (
                              <EmptySubmodeState
                                title="No matching results"
                                detail={`No item matches "${normalSearchQuery}".`}
                              />
                            );
                          }

                          let resultIndex = 0;
                          return (
                            <>
                              {normalCompactGroups.map((group, groupIndex) => (
                                <React.Fragment key={group.id}>
                                  <DropdownSectionHeader title={group.title} separated={groupIndex > 0} />
                                  {group.items.map(result => {
                                    const currentIndex = resultIndex;
                                    resultIndex += 1;
                                    return renderNormalCompactResult(result, currentIndex);
                                  })}
                                </React.Fragment>
                              ))}
                            </>
                          );
                        }

                        if (isExistingCollectionMode) {
                          const query = collectionSearchValue.trim();
                          return (
                            <>
                              <button
                                type="button"
                                id="alts-dropdown-item-0"
                                aria-selected={dropdownSelectedIndex === 0}
                                onMouseDown={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onClick={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openCreateCollectionDialog();
                                }}
                                onMouseEnter={() => setDropdownSelectedIndex(0)}
                                className={clsx(
                                  DROPDOWN_ITEM_BASE_CLASS,
                                  dropdownSelectedIndex === 0
                                    ? DROPDOWN_ITEM_SELECTED_CLASS
                                    : DROPDOWN_ITEM_UNSELECTED_CLASS,
                                )}>
                                <div className={DROPDOWN_ITEM_CONTENT_CLASS}>
                                  <div className={DROPDOWN_ITEM_PRIMARY_CLASS}>
                                    <span className="w-5 h-5 flex items-center justify-center shrink-0 text-emerald-500 dark:text-emerald-400">
                                      <FiPlus className="w-4 h-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
                                    </span>
                                    <div className={DROPDOWN_ITEM_TEXT_CLASS}>
                                      <span className={clsx(DROPDOWN_ITEM_LABEL_CLASS, 'min-w-0 truncate text-emerald-500 dark:text-emerald-400 font-medium')}>
                                        Create Collection
                                      </span>
                                      {query && (
                                        <span className="ml-2 min-w-0 truncate text-[12px] font-medium text-[var(--alts-text-secondary)]">
                                          "{query}"
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </button>
                              {filteredExistingCollections.length > 0 && (
                                <DropdownSectionHeader title="Save to existing" separated />
                              )}
                              {filteredExistingCollections.map((sessionItem: any, idx: number) => {
                                const itemIndex = idx + 1;
                                const isSelected = dropdownSelectedIndex === itemIndex;
                                const collectionTitle =
                                  sessionItem.title || sessionItem.sessionName || sessionItem.name || 'Untitled Collection';
                                const shortcutDisplay = getSubcommandShortcutDisplay(sessionItem, 'collection');
                                return (
                                  <NormalModeResultRow
                                    key={sessionItem.id || idx}
                                    rowKey={sessionItem.id || idx}
                                    itemIndex={itemIndex}
                                    role="option"
                                    tabIndex={-1}
                                    isSelected={isSelected}
                                    icon={(
                                      <span className={DROPDOWN_ITEM_ICON_CLASS} data-category="save">
                                        <FaLayerGroup className="w-4 h-4 shrink-0 text-current" />
                                      </span>
                                    )}
                                    title={collectionTitle}
                                    shortcutDisplay={shortcutDisplay}
                                    onExecute={() => void savePageToExistingCollection(sessionItem)}
                                    onSelect={setDropdownSelectedIndex}
                                  />
                                );
                              })}
                            </>
                          );
                        }

                        if (isLinkSaveMode) {
                          const query = linkSaveSearchValue.trim();
                          return (
                            <>
                              <button
                                type="button"
                                id="alts-dropdown-item-0"
                                aria-selected={dropdownSelectedIndex === 0}
                                onMouseDown={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onClick={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  void createSavedLinkFromCurrentPage();
                                }}
                                onMouseEnter={() => setDropdownSelectedIndex(0)}
                                className={clsx(
                                  DROPDOWN_ITEM_BASE_CLASS,
                                  dropdownSelectedIndex === 0
                                    ? DROPDOWN_ITEM_SELECTED_CLASS
                                    : DROPDOWN_ITEM_UNSELECTED_CLASS,
                                )}>
                                <div className={DROPDOWN_ITEM_CONTENT_CLASS}>
                                  <div className={DROPDOWN_ITEM_PRIMARY_CLASS}>
                                    <span className="w-5 h-5 flex items-center justify-center shrink-0 text-emerald-500 dark:text-emerald-400">
                                      <FiPlus className="w-4 h-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
                                    </span>
                                    <div className={DROPDOWN_ITEM_TEXT_CLASS}>
                                      <span className={clsx(DROPDOWN_ITEM_LABEL_CLASS, 'min-w-0 truncate text-emerald-500 dark:text-emerald-400 font-medium')}>
                                        Create Link
                                      </span>
                                      {query && (
                                        <span className="ml-2 min-w-0 truncate text-[12px] font-medium text-[var(--alts-text-secondary)]">
                                          "{query}"
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </button>
                              {filteredSaveLinkItems.length > 0 && (
                                <DropdownSectionHeader title="Save to existing" separated />
                              )}
                              {filteredSaveLinkItems.map((linkRow, idx: number) => {
                                const itemIndex = idx + 1;
                                const item = linkRow.item || {};
                                const isSelected = dropdownSelectedIndex === itemIndex;
                                const title = item.title || item.name || 'Untitled Link';
                                const urls = getLinkUrls(item);
                                const domains = getLinkDomains(item);
                                const shortcutDisplay = getSubcommandShortcutDisplay(item, 'link');
                                return (
                                  <NormalModeResultRow
                                    key={item.id || item.snippet_id || idx}
                                    rowKey={item.id || item.snippet_id || idx}
                                    itemIndex={itemIndex}
                                    role="option"
                                    tabIndex={-1}
                                    isSelected={isSelected}
                                    icon={(
                                      <span className="w-8 h-5 flex items-center shrink-0">
                                        <StackedLinkIcon urls={urls} size={18} fallback="link" />
                                      </span>
                                    )}
                                    title={title}
                                    description={domains}
                                    shortcutDisplay={shortcutDisplay}
                                    stacked
                                    onExecute={() => void savePageToExistingLink(linkRow)}
                                    onSelect={setDropdownSelectedIndex}
                                  />
                                );
                              })}
                            </>
                          );
                        }

                        if (isTodoSaveMode) {
                          const query = todoSaveSearchValue.trim();
                          return (
                            <>
                              <button
                                type="button"
                                id="alts-dropdown-item-0"
                                aria-selected={dropdownSelectedIndex === 0}
                                onMouseDown={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onClick={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  void openTodoEditorFromCurrentPage();
                                }}
                                onMouseEnter={() => setDropdownSelectedIndex(0)}
                                className={clsx(
                                  DROPDOWN_ITEM_BASE_CLASS,
                                  dropdownSelectedIndex === 0
                                    ? DROPDOWN_ITEM_SELECTED_CLASS
                                    : DROPDOWN_ITEM_UNSELECTED_CLASS,
                                )}>
                                <div className={DROPDOWN_ITEM_CONTENT_CLASS}>
                                  <div className={DROPDOWN_ITEM_PRIMARY_CLASS}>
                                    <span className="w-5 h-5 flex items-center justify-center shrink-0 text-emerald-500 dark:text-emerald-400">
                                      <FiPlus className="w-4 h-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
                                    </span>
                                    <div className={DROPDOWN_ITEM_TEXT_CLASS}>
                                      <span className={clsx(DROPDOWN_ITEM_LABEL_CLASS, 'min-w-0 truncate text-emerald-500 dark:text-emerald-400 font-medium')}>
                                        Create Todo
                                      </span>
                                      {query && (
                                        <span className="ml-2 min-w-0 truncate text-[12px] font-medium text-[var(--alts-text-secondary)]">
                                          "{query}"
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </button>
                              {filteredSaveTodoItems.length > 0 && (
                                <DropdownSectionHeader title="Save to existing" separated />
                              )}
                              {filteredSaveTodoItems.map((todoRow, idx: number) => {
                                const itemIndex = idx + 1;
                                const item = todoRow.item || {};
                                const isSelected = dropdownSelectedIndex === itemIndex;
                                const title = item.name || item.title || 'Untitled Todo';
                                const description = getTodoDescription(item);
                                const shortcutDisplay = getSubcommandShortcutDisplay(item, 'todo');
                                const dueBadge = getTodoDueBadge(item);
                                return (
                                  <NormalModeResultRow
                                    key={item.id || item.todo_id || idx}
                                    rowKey={item.id || item.todo_id || idx}
                                    itemIndex={itemIndex}
                                    role="option"
                                    tabIndex={-1}
                                    isSelected={isSelected}
                                    icon={(
                                      <span className={DROPDOWN_ITEM_ICON_CLASS} data-category="action">
                                        <BsCalendarCheck className="w-4 h-4 shrink-0 text-current" />
                                      </span>
                                    )}
                                    title={(
                                      <span className="flex min-w-0 max-w-full items-center gap-2 leading-4">
                                        <span className="min-w-0 truncate">{title}</span>
                                        {dueBadge ? (
                                          <span
                                            className={clsx(
                                              'shrink-0 truncate text-[10.5px] font-semibold leading-4',
                                              dueBadge.tone === 'overdue'
                                                ? 'text-[var(--color-error)]'
                                                : 'text-[var(--color-success)]',
                                            )}>
                                            {dueBadge.text}
                                          </span>
                                        ) : null}
                                      </span>
                                    )}
                                    description={description}
                                    shortcutDisplay={shortcutDisplay}
                                    stacked
                                    onExecute={() => void savePageLinkToExistingTodo(todoRow)}
                                    onSelect={setDropdownSelectedIndex}
                                  />
                                );
                              })}
                            </>
                          );
                        }

                        if (isNoteSaveMode) {
                          const query = noteSaveSearchValue.trim();
                          return (
                            <>
                              <button
                                type="button"
                                id="alts-dropdown-item-0"
                                aria-selected={dropdownSelectedIndex === 0}
                                onMouseDown={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onClick={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  void openNoteEditorFromCurrentPage();
                                }}
                                onMouseEnter={() => setDropdownSelectedIndex(0)}
                                className={clsx(
                                  DROPDOWN_ITEM_BASE_CLASS,
                                  dropdownSelectedIndex === 0
                                    ? DROPDOWN_ITEM_SELECTED_CLASS
                                    : DROPDOWN_ITEM_UNSELECTED_CLASS,
                                )}>
                                <div className={DROPDOWN_ITEM_CONTENT_CLASS}>
                                  <div className={DROPDOWN_ITEM_PRIMARY_CLASS}>
                                    <span className="w-5 h-5 flex items-center justify-center shrink-0 text-emerald-500 dark:text-emerald-400">
                                      <FiPlus className="w-4 h-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
                                    </span>
                                    <div className={DROPDOWN_ITEM_TEXT_CLASS}>
                                      <span className={clsx(DROPDOWN_ITEM_LABEL_CLASS, 'min-w-0 truncate text-emerald-500 dark:text-emerald-400 font-medium')}>
                                        Create Note
                                      </span>
                                      {query && (
                                        <span className="ml-2 min-w-0 truncate text-[12px] font-medium text-[var(--alts-text-secondary)]">
                                          "{query}"
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </button>
                              {filteredSaveNoteItems.length > 0 && (
                                <DropdownSectionHeader title="Save to existing" separated />
                              )}
                              {filteredSaveNoteItems.map((noteRow, idx: number) => {
                                const itemIndex = idx + 1;
                                const item = noteRow.item || {};
                                const isSelected = dropdownSelectedIndex === itemIndex;
                                const title = item.title || item.name || 'Untitled Note';
                                const description = getNoteDescription(item);
                                const shortcutDisplay = getSubcommandShortcutDisplay(item, 'note');
                                return (
                                  <NormalModeResultRow
                                    key={item.id || item.note_id || idx}
                                    rowKey={item.id || item.note_id || idx}
                                    itemIndex={itemIndex}
                                    role="option"
                                    tabIndex={-1}
                                    isSelected={isSelected}
                                    icon={(
                                      <span className={DROPDOWN_ITEM_ICON_CLASS} data-category="action">
                                        <FiFileText className="w-4 h-4 shrink-0 text-current" />
                                      </span>
                                    )}
                                    title={title}
                                    description={description}
                                    shortcutDisplay={shortcutDisplay}
                                    stacked
                                    onExecute={() => void savePageLinkToExistingNote(noteRow)}
                                    onSelect={setDropdownSelectedIndex}
                                  />
                                );
                              })}
                            </>
                          );
                        }

                        if (isSnippetSaveMode) {
                          const query = snippetSaveSearchValue.trim();
                          return (
                            <>
                              <button
                                type="button"
                                id="alts-dropdown-item-0"
                                aria-selected={dropdownSelectedIndex === 0}
                                onMouseDown={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onClick={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  void openSnippetEditorFromCurrentPage();
                                }}
                                onMouseEnter={() => setDropdownSelectedIndex(0)}
                                className={clsx(
                                  DROPDOWN_ITEM_BASE_CLASS,
                                  dropdownSelectedIndex === 0
                                    ? DROPDOWN_ITEM_SELECTED_CLASS
                                    : DROPDOWN_ITEM_UNSELECTED_CLASS,
                                )}>
                                <div className={DROPDOWN_ITEM_CONTENT_CLASS}>
                                  <div className={DROPDOWN_ITEM_PRIMARY_CLASS}>
                                    <span className="w-5 h-5 flex items-center justify-center shrink-0 text-emerald-500 dark:text-emerald-400">
                                      <FiPlus className="w-4 h-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
                                    </span>
                                    <div className={DROPDOWN_ITEM_TEXT_CLASS}>
                                      <span className={clsx(DROPDOWN_ITEM_LABEL_CLASS, 'min-w-0 truncate text-emerald-500 dark:text-emerald-400 font-medium')}>
                                        Create Text Expander
                                      </span>
                                      {query && (
                                        <span className="ml-2 min-w-0 truncate text-[12px] font-medium text-[var(--alts-text-secondary)]">
                                          "{query}"
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </button>
                              {filteredSaveSnippetItems.length > 0 && (
                                <DropdownSectionHeader title="Open existing" separated />
                              )}
                              {filteredSaveSnippetItems.map((snippetRow, idx: number) => {
                                const itemIndex = idx + 1;
                                const item = snippetRow.item || {};
                                const isSelected = dropdownSelectedIndex === itemIndex;
                                const title = item.title || item.key || item.name || 'Untitled Text Expander';
                                const description = getSnippetDescription(item);
                                const shortcutDisplay = getSubcommandShortcutDisplay(item, 'snippet');
                                return (
                                  <NormalModeResultRow
                                    key={item.id || item.snippet_id || idx}
                                    rowKey={item.id || item.snippet_id || idx}
                                    itemIndex={itemIndex}
                                    role="option"
                                    tabIndex={-1}
                                    isSelected={isSelected}
                                    icon={(
                                      <span className={DROPDOWN_ITEM_ICON_CLASS} data-category="action">
                                        <FaCode className="w-4 h-4 shrink-0 text-current" />
                                      </span>
                                    )}
                                    title={title}
                                    description={description}
                                    shortcutDisplay={shortcutDisplay}
                                    stacked
                                    onExecute={() => openWebsiteSnippet(snippetRow)}
                                    onSelect={setDropdownSelectedIndex}
                                  />
                                );
                              })}
                            </>
                          );
                        }

                        if (isChatSaveMode) {
                          const query = agentSearchValue.trim();
                          return (
                            <>
                              <button
                                type="button"
                                id="alts-dropdown-item-0"
                                aria-selected={dropdownSelectedIndex === 0}
                                onMouseDown={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onClick={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  void createChatAgentFromCurrentPage();
                                }}
                                onMouseEnter={() => setDropdownSelectedIndex(0)}
                                className={clsx(
                                  DROPDOWN_ITEM_BASE_CLASS,
                                  dropdownSelectedIndex === 0
                                    ? DROPDOWN_ITEM_SELECTED_CLASS
                                    : DROPDOWN_ITEM_UNSELECTED_CLASS,
                                )}>
                                <div className={DROPDOWN_ITEM_CONTENT_CLASS}>
                                  <div className={DROPDOWN_ITEM_PRIMARY_CLASS}>
                                    <span className="w-5 h-5 flex items-center justify-center shrink-0 text-emerald-500 dark:text-emerald-400">
                                      <FiPlus className="w-4 h-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
                                    </span>
                                    <div className={DROPDOWN_ITEM_TEXT_CLASS}>
                                      <span className={clsx(DROPDOWN_ITEM_LABEL_CLASS, 'min-w-0 truncate text-emerald-500 dark:text-emerald-400 font-medium')}>
                                        Create Chat Agent
                                      </span>
                                      {query && (
                                        <span className="ml-2 min-w-0 truncate text-[12px] font-medium text-[var(--alts-text-secondary)]">
                                          "{query}"
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </button>
                              {filteredSaveChatItems.length > 0 && (
                                <DropdownSectionHeader title="Save to existing" separated />
                              )}
                              {filteredSaveChatItems.map((agentItem, idx: number) => {
                                const itemIndex = idx + 1;
                                const record: any = agentItem.record || {};
                                const isSelected = dropdownSelectedIndex === itemIndex;
                                const title = agentItem.title || record.title || record.name || 'Untitled Chat Agent';
                                const description =
                                  agentItem.kind === 'prompt'
                                    ? getAiPromptDescription(record)
                                    : Array.isArray(record.urls) && record.urls.length > 0
                                      ? `${record.urls.length} saved URL${record.urls.length === 1 ? '' : 's'}`
                                      : '';
                                return (
                                  <NormalModeResultRow
                                    key={agentItem.id || record.id || idx}
                                    rowKey={agentItem.id || record.id || idx}
                                    itemIndex={itemIndex}
                                    role="option"
                                    tabIndex={-1}
                                    isSelected={isSelected}
                                    icon={(
                                      <span className={DROPDOWN_ITEM_ICON_CLASS} data-category="ai">
                                        <LuSparkles className="w-4 h-4 shrink-0 text-current" />
                                      </span>
                                    )}
                                    title={title}
                                    description={description}
                                    stacked
                                    onExecute={() => void saveCurrentAiUrlToExistingAgent(agentItem)}
                                    onSelect={setDropdownSelectedIndex}
                                  />
                                );
                              })}
                            </>
                          );
                        }

                        if (isSendToAgentMode) {
                          const query = agentSearchValue.trim();
                          return (
                            <>
                              {filteredAgentPickerItems.length === 0 ? (
                                query ? (
                                  <EmptySubmodeState
                                    title="No agents found"
                                    detail={`No agent matches "${query}".`}
                                  />
                                ) : (
                                  <EmptySubmodeState
                                    title="No agents yet"
                                    detail="Create an agent in the main app and it will appear here."
                                  />
                                )
                              ) : (
                                filteredAgentPickerItems.map((agentItem, idx: number) => {
                                  const isSelected = dropdownSelectedIndex === idx;
                                  return (
                                    <NormalModeResultRow
                                      key={agentItem.id || idx}
                                      rowKey={agentItem.id || idx}
                                      itemIndex={idx}
                                      role="option"
                                      tabIndex={-1}
                                      isSelected={isSelected}
                                      icon={(
                                        <span className={DROPDOWN_ITEM_ICON_CLASS} data-category="ai">
                                          <FiSend className="w-4 h-4 shrink-0 text-current" />
                                        </span>
                                      )}
                                      title={agentItem.title}
                                      onExecute={() => void sendPageToAgentPickerItem(agentItem)}
                                      onSelect={setDropdownSelectedIndex}
                                    />
                                  );
                                })
                              )}
                            </>
                          );
                        }

                        if (isCommandCategoryMode) {
                          const query = categorySearchValue.trim();
                          return filteredCategoryCommandItems.length === 0 ? (
                            query ? (
                              <EmptySubmodeState title="No text commands found" detail={`No text command matches "${query}".`} />
                            ) : (
                              <EmptySubmodeState
                                title="No text commands yet"
                                detail="Assign a text command to an item and it will appear here."
                              />
                            )
                          ) : (
                            filteredCategoryCommandItems.map((commandRow, idx: number) => {
                              const item = commandRow.item || {};
                              const suggestion = commandRow.suggestion || {};
                              const category = normalizeWebsiteCategory(item.category || item.referenceType || item.type);
                              const isSelected = dropdownSelectedIndex === idx;
                              const title =
                                item.title ||
                                item.key ||
                                item.name ||
                                item.label ||
                                suggestion.label ||
                                suggestion.title ||
                                suggestion.item?.title ||
                                suggestion.item?.name ||
                                suggestion.command?.label ||
                                suggestion.definition?.label ||
                                suggestion.proxyEntity?.item?.title ||
                                suggestion.proxyEntity?.item?.name ||
                                suggestion.proxyEntity?.snippet?.title ||
                                suggestion.proxyEntity?.snippet?.name ||
                                'Untitled';
                              const description =
                                category === 'note'
                                  ? getNoteDescription(item)
                                  : category === 'link'
                                    ? getLinkDomains(item)
                                    : category === 'snippet'
                                      ? getSnippetDescription(item)
                                      : category === 'todo'
                                        ? getTodoDescription(item)
                                        : category === 'prompt'
                                          ? getAiPromptDescription(item)
                                          : String(item.description || '');
                              const commandPrefix = getCommandSpacePrefix(omniboxPrefixes);
                              const shortcutDisplay =
                                item._displayShortcut ||
                                (item.prefix ? `${commandPrefix} ${String(item.prefix).trim()}`.trim() : '');
                              const urls = category === 'link' ? getLinkUrls(item) : [];
                              const icon =
                                category === 'link' ? (
                                  <span className="w-8 h-5 flex items-center shrink-0">
                                    <StackedLinkIcon urls={urls} size={18} fallback="link" />
                                  </span>
                                ) : (
                                  <span
                                    className={DROPDOWN_ITEM_ICON_CLASS}
                                    data-category={category === 'prompt' || category === 'agent' ? 'ai' : 'action'}>
                                    {category === 'snippet' ? (
                                      <FaCode className="w-4 h-4 shrink-0 text-current" />
                                    ) : category === 'todo' ? (
                                      <BsCalendarCheck className="w-4 h-4 shrink-0 text-current" />
                                    ) : category === 'prompt' || category === 'agent' ? (
                                      <LuSparkles className="w-4 h-4 shrink-0 text-current" />
                                    ) : category === 'session' ? (
                                      <FaLayerGroup className="w-4 h-4 shrink-0 text-current" />
                                    ) : category === 'automation' ? (
                                      <FiZap className="w-4 h-4 shrink-0 text-current" />
                                    ) : category === 'command' || !item._commandProxy ? (
                                      <FiTerminal className="w-4 h-4 shrink-0 text-current" />
                                    ) : (
                                      <FiFileText className="w-4 h-4 shrink-0 text-white" />
                                    )}
                                  </span>
                                );

                              return (
                                <button
                                  type="button"
                                  key={suggestion.id || item.id || item.snippet_id || idx}
                                  id={`alts-dropdown-item-${idx}`}
                                  role="option"
                                  aria-selected={isSelected}
                                  tabIndex={-1}
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  onClick={e => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    executeCommandSubmodeItem(commandRow);
                                  }}
                                  onMouseEnter={() => setDropdownSelectedIndex(idx)}
                                  className={clsx(
                                    DROPDOWN_ITEM_BASE_CLASS,
                                    isSelected ? DROPDOWN_ITEM_SELECTED_CLASS : DROPDOWN_ITEM_UNSELECTED_CLASS,
                                  )}>
                                  <div className={DROPDOWN_ITEM_CONTENT_CLASS}>
                                    <div className={DROPDOWN_ITEM_PRIMARY_CLASS}>
                                      {icon}
                                      <div className={clsx(DROPDOWN_ITEM_TEXT_CLASS, 'flex-col items-start')}>
                                        <span className={clsx(DROPDOWN_ITEM_LABEL_CLASS, 'min-w-0 truncate leading-4')}>
                                          {title}
                                        </span>
                                        {isSelected && description ? (
                                          <span className="min-w-0 truncate text-[12px] font-medium leading-4 text-[var(--alts-text-secondary)]">
                                            {description}
                                          </span>
                                        ) : null}
                                      </div>
                                    </div>
                                    {shortcutDisplay ? (
                                      <span className={DROPDOWN_ITEM_RIGHT_META_CLASS}>{shortcutDisplay}</span>
                                    ) : null}
                                  </div>
                                </button>
                              );
                            })
                          );
                        }

                        if (isCollectionCategoryMode) {
                          const query = categorySearchValue.trim();
                          return filteredCategoryCollectionItems.length === 0 ? (
                            query ? (
                              <EmptySubmodeState
                                title="No collections found"
                                detail={`No collection matches "${query}".`}
                              />
                            ) : (
                              <EmptySubmodeState
                                title="No collections yet"
                                detail="Create a collection in the main app and it will appear here."
                              />
                            )
                          ) : (
                            filteredCategoryCollectionItems.map((collectionRow, idx: number) => {
                              const item = collectionRow.item || {};
                              const isSelected = dropdownSelectedIndex === idx;
                              const title = item.title || item.sessionName || item.name || 'Untitled Collection';
                              const shortcutDisplay = getSubcommandShortcutDisplay(item, 'collection');
                              return (
                                <button
                                  type="button"
                                  key={item.id || item.session_id || idx}
                                  id={`alts-dropdown-item-${idx}`}
                                  role="option"
                                  aria-selected={isSelected}
                                  tabIndex={-1}
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  onClick={e => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    openWebsiteCollection(collectionRow);
                                  }}
                                  onMouseEnter={() => setDropdownSelectedIndex(idx)}
                                  className={clsx(
                                    DROPDOWN_ITEM_BASE_CLASS,
                                    isSelected ? DROPDOWN_ITEM_SELECTED_CLASS : DROPDOWN_ITEM_UNSELECTED_CLASS,
                                  )}>
                                  <div className={DROPDOWN_ITEM_CONTENT_CLASS}>
                                    <div className={DROPDOWN_ITEM_PRIMARY_CLASS}>
                                      <span className={DROPDOWN_ITEM_ICON_CLASS} data-category="save">
                                        <FaLayerGroup className="w-4 h-4 shrink-0 text-current" />
                                      </span>
                                      <div className={DROPDOWN_ITEM_TEXT_CLASS}>
                                        <span className={clsx(DROPDOWN_ITEM_LABEL_CLASS, 'min-w-0 truncate')}>
                                          {title}
                                        </span>
                                      </div>
                                    </div>
                                    {shortcutDisplay ? (
                                      <span className={DROPDOWN_ITEM_RIGHT_META_CLASS}>{shortcutDisplay}</span>
                                    ) : null}
                                  </div>
                                </button>
                              );
                            })
                          );
                        }

                        if (isNoteCategoryMode) {
                          const query = categorySearchValue.trim();
                          const hasQuickCreate = noteHasLeadingCreateRow;
                          return (
                            <>
                              {hasQuickCreate ? (
                                <button
                                  type="button"
                                  key="note-quick-create"
                                  id="alts-dropdown-item-0"
                                  role="option"
                                  aria-selected={dropdownSelectedIndex === 0}
                                  tabIndex={-1}
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  onClick={e => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    noteQuickCreateAction();
                                  }}
                                  onMouseEnter={() => setDropdownSelectedIndex(0)}
                                  className={clsx(
                                    DROPDOWN_ITEM_BASE_CLASS,
                                    dropdownSelectedIndex === 0
                                      ? DROPDOWN_ITEM_SELECTED_CLASS
                                      : DROPDOWN_ITEM_UNSELECTED_CLASS,
                                  )}>
                                  <div className={DROPDOWN_ITEM_CONTENT_CLASS}>
                                    <div className={DROPDOWN_ITEM_PRIMARY_CLASS}>
                                      <span className="w-5 h-5 flex items-center justify-center shrink-0 text-emerald-500 dark:text-emerald-400">
                                        <FiPlus className="w-4 h-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
                                      </span>
                                      <div className={DROPDOWN_ITEM_TEXT_CLASS}>
                                        <span className={clsx(DROPDOWN_ITEM_LABEL_CLASS, 'min-w-0 truncate text-emerald-500 dark:text-emerald-400 font-medium')}>
                                          Create Note
                                        </span>
                                      </div>
                                    </div>
                                    <span
                                      className={clsx(
                                        DROPDOWN_ITEM_RIGHT_META_CLASS,
                                        'ml-auto min-w-0 flex-1 truncate text-right',
                                      )}>
                                      {noteQuickCreateRowMeta}
                                    </span>
                                  </div>
                                </button>
                              ) : null}
                              {filteredCategoryNoteItems.length === 0 && !hasQuickCreate ? (
                                query ? (
                                  <EmptySubmodeState title="No notes found" detail={`No note matches "${query}".`} />
                                ) : (
                                  <EmptySubmodeState
                                    title="No notes yet"
                                    detail="Create a note in the main app and it will appear here."
                                  />
                                )
                              ) : (
                                filteredCategoryNoteItems.map((noteRow, idx: number) => {
                                  const item = noteRow.item || {};
                                  const itemIndex = hasQuickCreate ? idx + 1 : idx;
                                  const isSelected = dropdownSelectedIndex === itemIndex;
                                  const title = item.title || item.key || item.name || 'Untitled Note';
                                  const description = getNoteDescription(item);
                                  const shortcutDisplay = getSubcommandShortcutDisplay(item, 'note');
                                  return (
                                    <button
                                      type="button"
                                      key={item.id || item.snippet_id || idx}
                                      id={`alts-dropdown-item-${itemIndex}`}
                                      role="option"
                                      aria-selected={isSelected}
                                      tabIndex={-1}
                                      onMouseDown={e => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                      }}
                                      onClick={e => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        openWebsiteNote(noteRow);
                                      }}
                                      onMouseEnter={() => setDropdownSelectedIndex(itemIndex)}
                                      className={clsx(
                                        DROPDOWN_ITEM_BASE_CLASS,
                                        isSelected ? DROPDOWN_ITEM_SELECTED_CLASS : DROPDOWN_ITEM_UNSELECTED_CLASS,
                                      )}>
                                      <div className={DROPDOWN_ITEM_CONTENT_CLASS}>
                                        <div className={DROPDOWN_ITEM_PRIMARY_CLASS}>
                                          <span className={DROPDOWN_ITEM_ICON_CLASS} data-category="action">
                                            <FiFileText className="w-4 h-4 shrink-0 text-white" />
                                          </span>
                                          <div className={clsx(DROPDOWN_ITEM_TEXT_CLASS, 'flex-col items-start')}>
                                            <span className={clsx(DROPDOWN_ITEM_LABEL_CLASS, 'min-w-0 truncate leading-4')}>
                                              {title}
                                            </span>
                                            {isSelected && description ? (
                                              <span className="min-w-0 truncate text-[12px] font-medium leading-4 text-[var(--alts-text-secondary)]">
                                                {description}
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                        {shortcutDisplay ? (
                                          <span className={DROPDOWN_ITEM_RIGHT_META_CLASS}>{shortcutDisplay}</span>
                                        ) : null}
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </>
                          );
                        }

                        if (isLinkCategoryMode) {
                          const query = categorySearchValue.trim();
                          return (
                            <>
                              {filteredCategoryLinkItems.length === 0 ? (
                                query ? (
                                  <EmptySubmodeState title="No links found" detail={`No link matches "${query}".`} />
                                ) : (
                                  <EmptySubmodeState
                                    title="No links yet"
                                    detail="Create a link in the main app and it will appear here."
                                  />
                                )
                              ) : (
                                filteredCategoryLinkItems.map((linkRow, idx: number) => {
                                  const item = linkRow.item || {};
                                  const isSelected = dropdownSelectedIndex === idx;
                                  const title = item.title || item.name || 'Untitled Link';
                                  const urls = getLinkUrls(item);
                                  const domains = getLinkDomains(item);
                                  const shortcutDisplay = getSubcommandShortcutDisplay(item, 'link');
                                  return (
                                    <button
                                      type="button"
                                      key={item.id || item.snippet_id || idx}
                                      id={`alts-dropdown-item-${idx}`}
                                      role="option"
                                      aria-selected={isSelected}
                                      tabIndex={-1}
                                      onMouseDown={e => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                      }}
                                      onClick={e => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        openWebsiteLink(linkRow);
                                      }}
                                      onMouseEnter={() => setDropdownSelectedIndex(idx)}
                                      className={clsx(
                                        DROPDOWN_ITEM_BASE_CLASS,
                                        isSelected && domains ? 'min-h-[42px] py-1' : '',
                                        isSelected ? DROPDOWN_ITEM_SELECTED_CLASS : DROPDOWN_ITEM_UNSELECTED_CLASS,
                                      )}>
                                      <div className={DROPDOWN_ITEM_CONTENT_CLASS}>
                                        <div className={DROPDOWN_ITEM_PRIMARY_CLASS}>
                                          <span className="w-8 h-5 flex items-center shrink-0">
                                            <StackedLinkIcon urls={urls} size={18} fallback="link" />
                                          </span>
                                          <div className={clsx(DROPDOWN_ITEM_TEXT_CLASS, 'flex-col items-start')}>
                                            <span className={clsx(DROPDOWN_ITEM_LABEL_CLASS, 'min-w-0 truncate leading-4')}>
                                              {title}
                                            </span>
                                            {isSelected && domains ? (
                                              <span className="min-w-0 max-w-full truncate text-[11px] font-medium leading-3 text-[var(--alts-text-secondary)]">
                                                {domains}
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                        {shortcutDisplay ? (
                                          <span className={DROPDOWN_ITEM_RIGHT_META_CLASS}>{shortcutDisplay}</span>
                                        ) : null}
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </>
                          );
                        }

                        if (isSnippetCategoryMode) {
                          const query = categorySearchValue.trim();
                          return (
                            <>
                              {filteredCategorySnippetItems.length === 0 ? (
                                query ? (
                                  <EmptySubmodeState
                                    title="No text expanders found"
                                    detail={`No text expander matches "${query}".`}
                                  />
                                ) : (
                                  <EmptySubmodeState
                                    title="No text expanders yet"
                                    detail="Create a text expander in the main app and it will appear here."
                                  />
                                )
                              ) : (
                                filteredCategorySnippetItems.map((snippetRow, idx: number) => {
                                  const item = snippetRow.item || {};
                                  const isSelected = dropdownSelectedIndex === idx;
                                  const title = item.title || item.key || item.name || 'Untitled Text Expander';
                                  const description = getSnippetDescription(item);
                                  const shortcutDisplay = getSubcommandShortcutDisplay(item, 'snippet');
                                  return (
                                    <button
                                      type="button"
                                      key={item.id || item.snippet_id || idx}
                                      id={`alts-dropdown-item-${idx}`}
                                      role="option"
                                      aria-selected={isSelected}
                                      tabIndex={-1}
                                      onMouseDown={e => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                      }}
                                      onClick={e => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        openWebsiteSnippet(snippetRow);
                                      }}
                                      onMouseEnter={() => setDropdownSelectedIndex(idx)}
                                      className={clsx(
                                        DROPDOWN_ITEM_BASE_CLASS,
                                        isSelected && description ? 'min-h-[42px] py-1' : '',
                                        isSelected ? DROPDOWN_ITEM_SELECTED_CLASS : DROPDOWN_ITEM_UNSELECTED_CLASS,
                                      )}>
                                      <div className={DROPDOWN_ITEM_CONTENT_CLASS}>
                                        <div className={DROPDOWN_ITEM_PRIMARY_CLASS}>
                                          <span className={DROPDOWN_ITEM_ICON_CLASS} data-category="action">
                                            <FaCode className="w-4 h-4 shrink-0 text-current" />
                                          </span>
                                          <div className={clsx(DROPDOWN_ITEM_TEXT_CLASS, 'flex-col items-start')}>
                                            <span className={clsx(DROPDOWN_ITEM_LABEL_CLASS, 'min-w-0 truncate leading-4')}>
                                              {title}
                                            </span>
                                            {isSelected && description ? (
                                              <span className="min-w-0 max-w-full truncate text-[11px] font-medium leading-3 text-[var(--alts-text-secondary)]">
                                                {description}
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                        {shortcutDisplay ? (
                                          <span className={DROPDOWN_ITEM_RIGHT_META_CLASS}>{shortcutDisplay}</span>
                                        ) : null}
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </>
                          );
                        }

                        if (isTodoCategoryMode) {
                          const query = categorySearchValue.trim();
                          const hasQuickCreate = todoHasLeadingCreateRow;
                          return (
                            <>
                              {hasQuickCreate ? (
                                <button
                                  type="button"
                                  key="todo-quick-create"
                                  id="alts-dropdown-item-0"
                                  role="option"
                                  aria-selected={dropdownSelectedIndex === 0}
                                  tabIndex={-1}
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  onClick={e => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    todoQuickCreateAction();
                                  }}
                                  onMouseEnter={() => setDropdownSelectedIndex(0)}
                                  className={clsx(
                                    DROPDOWN_ITEM_BASE_CLASS,
                                    dropdownSelectedIndex === 0
                                      ? DROPDOWN_ITEM_SELECTED_CLASS
                                      : DROPDOWN_ITEM_UNSELECTED_CLASS,
                                  )}>
                                  <div className="grid w-full min-w-0 grid-cols-[max-content_minmax(0,1fr)] items-center gap-4 overflow-hidden">
                                    <div className="flex min-w-0 items-center gap-3 overflow-visible">
                                      <span className="w-5 h-5 flex items-center justify-center shrink-0 text-emerald-500 dark:text-emerald-400">
                                        <FiPlus className="w-4 h-4 shrink-0 text-emerald-500 dark:text-emerald-400" />
                                      </span>
                                      <div className="flex min-w-0 items-baseline overflow-visible">
                                        <span className="whitespace-nowrap text-emerald-500 dark:text-emerald-400 font-medium leading-5">
                                          Create Todo
                                        </span>
                                      </div>
                                    </div>
                                    <span
                                      className="block min-w-0 overflow-hidden truncate whitespace-nowrap text-right text-[11px] font-medium text-[var(--alts-shortcut-text)]">
                                      {todoQuickCreateRowMeta}
                                    </span>
                                  </div>
                                </button>
                              ) : null}
                              {filteredCategoryTodoItems.length === 0 && !hasQuickCreate ? (
                                query ? (
                                  <EmptySubmodeState title="No todos found" detail={`No todo matches "${query}".`} />
                                ) : (
                                  <EmptySubmodeState
                                    title="No todos yet"
                                    detail="Create a todo in the main app and it will appear here."
                                  />
                                )
                              ) : (
                                filteredCategoryTodoItems.map((todoRow, idx: number) => {
                                  const item = todoRow.item || {};
                                  const itemIndex = hasQuickCreate ? idx + 1 : idx;
                                  const isSelected = dropdownSelectedIndex === itemIndex;
                                  const title = item.name || item.title || item.key || 'Untitled Todo';
                                  const description = getTodoDescription(item);
                                  const shortcutDisplay = getSubcommandShortcutDisplay(item, 'todo');
                                  const dueBadge = getTodoDueBadge(item);
                                  return (
                                    <button
                                      type="button"
                                      key={item.id || item.todo_id || item.snippet_id || idx}
                                      id={`alts-dropdown-item-${itemIndex}`}
                                      role="option"
                                      aria-selected={isSelected}
                                      tabIndex={-1}
                                      onMouseDown={e => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                      }}
                                      onClick={e => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        openWebsiteTodo(todoRow);
                                      }}
                                      onMouseEnter={() => setDropdownSelectedIndex(itemIndex)}
                                      className={clsx(
                                        DROPDOWN_ITEM_BASE_CLASS,
                                        isSelected && description ? 'min-h-[42px] py-1' : '',
                                        isSelected ? DROPDOWN_ITEM_SELECTED_CLASS : DROPDOWN_ITEM_UNSELECTED_CLASS,
                                      )}>
                                      <div className={DROPDOWN_ITEM_CONTENT_CLASS}>
                                        <div className={DROPDOWN_ITEM_PRIMARY_CLASS}>
                                          <span className={DROPDOWN_ITEM_ICON_CLASS} data-category="action">
                                            <BsCalendarCheck className="w-4 h-4 shrink-0 text-current" />
                                          </span>
                                          <div className={clsx(DROPDOWN_ITEM_TEXT_CLASS, 'flex-col items-start')}>
                                            <span className="flex min-w-0 max-w-full items-center gap-2 leading-4">
                                              <span className={clsx(DROPDOWN_ITEM_LABEL_CLASS, 'min-w-0 truncate leading-4')}>
                                                {title}
                                              </span>
                                              {dueBadge ? (
                                                <span
                                                  className={clsx(
                                                    'shrink-0 truncate text-[10.5px] font-semibold leading-4',
                                                    dueBadge.tone === 'overdue'
                                                      ? 'text-[var(--color-error)]'
                                                      : 'text-[var(--color-success)]',
                                                  )}>
                                                  {dueBadge.text}
                                                </span>
                                              ) : null}
                                            </span>
                                            {isSelected && description ? (
                                              <span className="min-w-0 max-w-full truncate text-[11px] font-medium leading-3 text-[var(--alts-text-secondary)]">
                                                {description}
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                        {shortcutDisplay ? (
                                          <span className={DROPDOWN_ITEM_RIGHT_META_CLASS}>{shortcutDisplay}</span>
                                        ) : null}
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </>
                          );
                        }

                        if (isBookmarkCategoryMode) {
                          const query = categorySearchValue.trim();
                          return (
                            <>
                              {filteredCategoryBookmarkItems.length === 0 ? (
                                query ? (
                                  <EmptySubmodeState
                                    title="No bookmarks found"
                                    detail={`No bookmark matches "${query}".`}
                                  />
                                ) : (
                                  <EmptySubmodeState
                                    title="No bookmarks yet"
                                    detail="Chrome bookmarks will appear here."
                                  />
                                )
                              ) : (
                                filteredCategoryBookmarkItems.map((bookmarkRow, idx: number) => {
                                  const item = bookmarkRow.item || {};
                                  const isSelected = dropdownSelectedIndex === idx;
                                  const title = item.title || item.url || 'Untitled Bookmark';
                                  const url = getBookmarkUrl(item);
                                  const meta = getBookmarkMeta(item);
                                  return (
                                    <button
                                      type="button"
                                      key={item.id || item.url || idx}
                                      id={`alts-dropdown-item-${idx}`}
                                      role="option"
                                      aria-selected={isSelected}
                                      tabIndex={-1}
                                      onMouseDown={e => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                      }}
                                      onClick={e => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        openWebsiteBookmark(bookmarkRow);
                                      }}
                                      onMouseEnter={() => setDropdownSelectedIndex(idx)}
                                      className={clsx(
                                        DROPDOWN_ITEM_BASE_CLASS,
                                        isSelected && meta ? 'min-h-[42px] py-1' : '',
                                        isSelected ? DROPDOWN_ITEM_SELECTED_CLASS : DROPDOWN_ITEM_UNSELECTED_CLASS,
                                      )}>
                                      <div className={DROPDOWN_ITEM_CONTENT_CLASS}>
                                        <div className={DROPDOWN_ITEM_PRIMARY_CLASS}>
                                          <span className="w-8 h-5 flex items-center shrink-0">
                                            <StackedLinkIcon urls={url ? [url] : []} size={18} fallback="link" />
                                          </span>
                                          <div className={clsx(DROPDOWN_ITEM_TEXT_CLASS, 'flex-col items-start')}>
                                            <span className={clsx(DROPDOWN_ITEM_LABEL_CLASS, 'min-w-0 truncate leading-4')}>
                                              {title}
                                            </span>
                                            {isSelected && meta ? (
                                              <span className="min-w-0 max-w-full truncate text-[11px] font-medium leading-3 text-[var(--alts-text-secondary)]">
                                                {meta}
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </>
                          );
                        }

                        if (isPromptCategoryMode) {
                          const query = categorySearchValue.trim();
                          return (
                            <>
                              {filteredCategoryPromptItems.length === 0 ? (
                                query ? (
                                  <EmptySubmodeState title="No prompts found" detail={`No prompt matches "${query}".`} />
                                ) : (
                                  <EmptySubmodeState
                                    title="No prompts yet"
                                    detail="Create an AI prompt in the main app and it will appear here."
                                  />
                                )
                              ) : (
                                filteredCategoryPromptItems.map((promptRow, idx: number) => {
                                  const item = promptRow.item || {};
                                  const isSelected = dropdownSelectedIndex === idx;
                                  const title = item.title || item.name || 'Untitled Prompt';
                                  const description = getAiPromptDescription(item);
                                  const shortcutDisplay = getSubcommandShortcutDisplay(item, 'prompt');
                                  return (
                                    <button
                                      type="button"
                                      key={item.id || item.prompt_id || idx}
                                      id={`alts-dropdown-item-${idx}`}
                                      role="option"
                                      aria-selected={isSelected}
                                      tabIndex={-1}
                                      onMouseDown={e => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                      }}
                                      onClick={e => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        openWebsiteAiPrompt(promptRow);
                                      }}
                                      onMouseEnter={() => setDropdownSelectedIndex(idx)}
                                      className={clsx(
                                        DROPDOWN_ITEM_BASE_CLASS,
                                        isSelected && description ? 'min-h-[42px] py-1' : '',
                                        isSelected ? DROPDOWN_ITEM_SELECTED_CLASS : DROPDOWN_ITEM_UNSELECTED_CLASS,
                                      )}>
                                      <div className={DROPDOWN_ITEM_CONTENT_CLASS}>
                                        <div className={DROPDOWN_ITEM_PRIMARY_CLASS}>
                                          <span className={DROPDOWN_ITEM_ICON_CLASS} data-category="ai">
                                            <LuSparkles className="w-4 h-4 shrink-0 text-current" />
                                          </span>
                                          <div className={clsx(DROPDOWN_ITEM_TEXT_CLASS, 'flex-col items-start')}>
                                            <span className={clsx(DROPDOWN_ITEM_LABEL_CLASS, 'min-w-0 truncate leading-4')}>
                                              {title}
                                            </span>
                                            {isSelected && description ? (
                                              <span className="min-w-0 max-w-full truncate text-[11px] font-medium leading-3 text-[var(--alts-text-secondary)]">
                                                {description}
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                        {shortcutDisplay ? (
                                          <span className={DROPDOWN_ITEM_RIGHT_META_CLASS}>{shortcutDisplay}</span>
                                        ) : null}
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </>
                          );
                        }

                        if (dropdownOptions.totalList.length === 0) {
                          return (
                            <div className="px-4 py-3 text-[13px] font-normal text-[var(--alts-text-secondary)]">
                              No matching categories or actions
                            </div>
                          );
                        }

                        const saveAsActionIds = new Set(['save_link', 'save_todo', 'save_note', 'save_snippet', 'save_chat', 'add_to_existing', 'saved_indicator']);
                        const indexedSiteCommandActions = dropdownOptions.siteCommandActions.map((opt: any, idx: number) => ({
                          opt,
                          globalIdx: idx,
                        }));
                        const saveAsActions = indexedSiteCommandActions.filter(({ opt }) => saveAsActionIds.has(opt.id));
                        const pageActions = indexedSiteCommandActions.filter(({ opt }) => !saveAsActionIds.has(opt.id));

                        const renderActionRow = (opt: any, globalIdx: number) => {
                          const isSelected = dropdownSelectedIndex === globalIdx;
                          const icon =
                            PAGE_ACTION_ICONS[opt.id] ||
                            (opt.id === 'saved_indicator' ? (
                              <FaCheck className="w-4 h-4 shrink-0 text-current" />
                            ) : opt.id === 'add_to_existing' ? (
                              <FaLayerGroup className="w-4 h-4 shrink-0 text-current" />
                            ) : opt.id === 'save_link' ? (
                              <FaLink className="w-4 h-4 shrink-0 text-current" />
                            ) : opt.id === 'save_todo' ? (
                              <BsCalendarCheck className="w-4 h-4 shrink-0 text-current" />
                            ) : opt.id === 'save_note' ? (
                              <FiFileText className="w-4 h-4 shrink-0 text-current" />
                            ) : opt.id === 'save_snippet' ? (
                              <FaCode className="w-4 h-4 shrink-0 text-current" />
                            ) : opt.id === 'save_chat' ? (
                              <LuSparkles className="w-4 h-4 shrink-0 text-current" />
                            ) : opt.id === 'summarize_page' ? (
                              <FiFileText className="w-4 h-4 shrink-0 text-current" />
                            ) : opt.id === 'send_to_agent' ? (
                              <FiSend className="w-4 h-4 shrink-0 text-current" />
                            ) : (
                              <FaRegFileAlt className="w-4 h-4 shrink-0 text-current" />
                            ));

                          const actionPrefixVal =
                            getActionPrefixMap(omniboxPrefixes)[opt.id] || opt.item?.prefix || '';

                          return (
                            <NormalModeActionRow
                              key={opt.id}
                              opt={opt}
                              globalIdx={globalIdx}
                              isSelected={isSelected}
                              icon={icon}
                              actionPrefixVal={actionPrefixVal}
                              onExecute={executeDropdownItem}
                              onSelect={setDropdownSelectedIndex}
                            />
                          );
                        };

                        return (
                          <>
                            {saveAsActions.length > 0 && (
                              <>
                                <DropdownSectionHeader title="Save As" />
                                {saveAsActions.map(({ opt, globalIdx }) => renderActionRow(opt, globalIdx))}
                              </>
                            )}

                            {pageActions.length > 0 && (
                              <>
                                <DropdownSectionHeader title="Page Actions" separated={saveAsActions.length > 0} />
                                {pageActions.map(({ opt, globalIdx }) => renderActionRow(opt, globalIdx))}
                              </>
                            )}

                            {dropdownOptions.extractionActions.length > 0 && (
                              <>
                                <DropdownSectionHeader
                                  title="Page Extraction"
                                  separated={saveAsActions.length > 0 || pageActions.length > 0}
                                />
                                {dropdownOptions.extractionActions.map((opt: any, idx: number) =>
                                  renderActionRow(opt, dropdownOptions.siteCommandActions.length + idx),
                                )}
                              </>
                            )}

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

                                    const categoryKey = CATEGORY_PREFIX_KEY_BY_OPTION[optName];
                                    const prefixVal =
                                      categoryKey && omniboxPrefixes ? omniboxPrefixes[categoryKey] : '';
                                    const activateCategory = (
                                      categoryName: string,
                                      event: React.MouseEvent<HTMLDivElement> | React.PointerEvent<HTMLDivElement>,
                                    ) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      activateNormalCategorySelection(categoryName, { clearSidebarPill: true });
                                    };

                                    return (
                                      <NormalModeCategoryRow
                                        key={optName}
                                        optionName={optName}
                                        globalIdx={globalIdx}
                                        isSelected={isSelected}
                                        title={meta.title}
                                        icon={meta.icon}
                                        categoryKey={categoryKey}
                                        prefixValue={prefixVal}
                                        onActivate={activateCategory}
                                        onSelect={setDropdownSelectedIndex}
                                      />
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
          </div>
          </motion.div>
        )}

        {createCollectionDialog && (
          <AltSEditorOverlayShell
            ariaLabel="Close create collection"
            onClose={closeCreateCollectionDialog}
            appearanceTokens={altsPaletteStyle}>
            <CreateCollectionDialog
              dialog={createCollectionDialog}
              setDialog={setCreateCollectionDialog}
              onClose={closeCreateCollectionDialog}
              onSubmit={handleSubmitCreateCollectionDialog}
              actionError={createCollectionActionError}
              pendingActionId={pendingCreateCollectionActionId}
              onOverrideShortcut={null}
              stagedWidgets={stagedCreateCollectionWidgets}
              pendingWidgetIds={pendingCreateCollectionWidgetIds}
              draftSession={createCollectionDraft}
              onDraftSessionChange={setCreateCollectionDraft}
              onStageWidget={handleStageCreateCollectionWidget}
              onRemoveStagedWidget={handleRemoveStagedCreateCollectionWidget}
              position="centered"
              appearanceScope="alts"
              appearanceTokens={altsPaletteStyle}
              embeddedInAltSShell
              portalContainer={
                (window as any).__ALTS_MODAL_PORTAL_HOST__ ||
                (window as any).__ALTQ_MODAL_PORTAL_HOST__ ||
                (window as any).__ALTS_PORTAL_HOST__ ||
                (window as any).__ALTQ_PORTAL_HOST__ ||
                null
              }
            />
          </AltSEditorOverlayShell>
        )}

        {isLinkEditorOverlayOpen && linkEditorTarget && (
          <AltSEditorOverlayShell
            ariaLabel="Close create link"
            onClose={closeLinkEditorOverlay}
            appearanceTokens={altsPaletteStyle}
            padding="0px">
            <React.Suspense fallback={altsEditorSuspenseFallback}>
              <LinkEditorView
                isOpen
                onClose={closeLinkEditorOverlay}
                onSavedClose={completeLinkEditorOverlay}
                link={null}
                prefill={{
                  key: '',
                  value: linkEditorTarget.url,
                  category: 'link',
                }}
                onLinkCreated={() => {
                  scheduleAltSEditorDbRefresh();
                }}
                reload={syncDbFromBackground}
                isOverlay
                hideRightPanel
                appearanceScope="alts"
                appearanceTokens={altsPaletteStyle}
                saveLinkAdapter={saveLinkFromAltSOverlay}
                propertyPersistenceAdapter={altsPropertyPersistenceAdapter}
              />
            </React.Suspense>
          </AltSEditorOverlayShell>
        )}

        {isTodoEditorOverlayOpen && todoEditorTarget && (
          <AltSEditorOverlayShell
            ariaLabel="Close create todo"
            onClose={closeTodoEditorOverlay}
            appearanceTokens={altsPaletteStyle}
            padding="0px">
            <React.Suspense fallback={altsEditorSuspenseFallback}>
              <CreateTodoView
                items={altsConvertibleItems}
                onCreateTodo={saveTodoFromAltSOverlay}
                onClose={closeTodoEditorOverlay}
                onSavedClose={completeTodoEditorOverlay}
                isOverlay
                hideRightPanel
                appearanceScope="alts"
                appearanceTokens={altsPaletteStyle}
                propertyPersistenceAdapter={altsPropertyPersistenceAdapter}
                existingTodos={[]}
                hotkeysMap={{}}
                initialItem={{
                  name: '',
                  description: '',
                  scheduleType: 'one-time',
                  scheduleTime: Date.now(),
                  references: [
                    {
                      id: todoEditorTarget.url,
                      type: 'link',
                      category: 'link',
                      name: todoEditorTarget.title || todoEditorTarget.url,
                      title: todoEditorTarget.title || todoEditorTarget.url,
                      url: todoEditorTarget.url,
                    },
                  ],
                }}
              />
            </React.Suspense>
          </AltSEditorOverlayShell>
        )}

        {isNoteEditorOverlayOpen && noteEditorTarget && (
          <AltSEditorOverlayShell
            ariaLabel="Close create note"
            onClose={closeNoteEditorOverlay}
            appearanceTokens={altsPaletteStyle}
            padding="0px">
            <React.Suspense fallback={altsEditorSuspenseFallback}>
              <NoteEditorView
                noteId={null}
                onBack={closeNoteEditorOverlay}
                initialDraftKey=""
                initialDraftContent=""
                initialTagIds={[]}
                onNoteCreated={() => {
                  scheduleAltSEditorDbRefresh();
                }}
                isOverlay
                hideRightPanel
                appearanceScope="alts"
                appearanceTokens={altsPaletteStyle}
                saveNoteAdapter={saveNoteFromAltSOverlay}
                propertyPersistenceAdapter={altsPropertyPersistenceAdapter}
              />
            </React.Suspense>
          </AltSEditorOverlayShell>
        )}

        {isSnippetEditorOverlayOpen && snippetEditorTarget && (
          <AltSEditorOverlayShell
            ariaLabel="Close create text expander"
            onClose={closeSnippetEditorOverlay}
            appearanceTokens={altsPaletteStyle}
            padding="0px">
            <React.Suspense fallback={altsEditorSuspenseFallback}>
              <SnippetEditorScreen
                selectedSnippet={null}
                isCreatingNew
                snippetBreadCrum={null}
                snippets={[]}
                showFolderStructure={false}
                reload={syncDbFromBackground}
                favoritesMapping={{}}
                setFavoritesMapping={() => {}}
                onBack={closeSnippetEditorOverlay}
                initialDraftKey=""
                initialDraftContent=""
                initialTagIds={[]}
                onSnippetCreated={() => {
                  scheduleAltSEditorDbRefresh();
                }}
                isOverlay
                hideRightPanel
                appearanceScope="alts"
                appearanceTokens={altsPaletteStyle}
                saveSnippetAdapter={saveSnippetFromAltSOverlay}
                propertyPersistenceAdapter={altsPropertyPersistenceAdapter}
                category="snippet"
              />
            </React.Suspense>
          </AltSEditorOverlayShell>
        )}

        {isAiPromptEditorOverlayOpen && aiPromptEditorTarget && (
          <AltSEditorOverlayShell
            ariaLabel="Close create chat agent"
            onClose={closeAiPromptEditorOverlay}
            appearanceTokens={altsPaletteStyle}
            padding="0px">
            <React.Suspense fallback={altsEditorSuspenseFallback}>
              <AiPromptEditorView
                aiPromptId={null}
                onBack={closeAiPromptEditorOverlay}
                initialTitle=""
                initialPrompt=""
                initialModelUrls={aiPromptInitialModelUrls}
                initialTagIds={[]}
                onAiPromptCreated={() => {
                  scheduleAltSEditorDbRefresh();
                }}
                isOverlay
                hideRightPanel
                appearanceScope="alts"
                appearanceTokens={altsPaletteStyle}
                saveAiPromptAdapter={saveAiPromptFromAltSOverlay}
                propertyPersistenceAdapter={altsPropertyPersistenceAdapter}
              />
            </React.Suspense>
          </AltSEditorOverlayShell>
        )}

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
    </AnimatePresence>
  );
};

export default App;
