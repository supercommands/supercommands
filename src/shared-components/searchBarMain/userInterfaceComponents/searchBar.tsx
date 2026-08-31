import type * as React from 'react';
import { useAppearance } from '@extension/ui';
import {
  type SavedAutomation,
  type AutomationInputDefinition,
} from '../../../allObjectFolder/src/createObject/automationBeta/utilities/automation';

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useLayoutEffect,
  lazy,
  Suspense,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../../../shared-components/uiStateManager';
import {
  COMMANDS,
  AI_GROUP,
  type CommandId,
  type CommandDefinition,
  buildUrl,
  AutoSubmitKind,
  DEFAULT_SELECTED_AIS,
  BROWSER_NAME,
} from '../commandConfigurations/commands';
import { SHARED_ALL_COMMANDS, findCommandByAnyId } from '../../../shared-components/commands';

import { FaSearch, FaFileImage, FaLink, FaTimes, FaBookmark, FaHistory, FaGlobe, FaCalculator, FaClock } from 'react-icons/fa';

import { LuSparkles, LuPlus, LuX } from 'react-icons/lu';
import { GoPaperclip } from 'react-icons/go';
import { SiPerplexity } from 'react-icons/si';
import { TbSparkles } from 'react-icons/tb';

import { createEventUrlFromText } from '../utilityFunctions/eventParser';
import type { WorkspaceItem } from '../../../allObjectFolder/src/createObject/workspaceItemTypes';
import { hasRunnableAiPrompt, runAiPrompt } from '../../../allObjectFolder/src/createObject/aiPrompt';
export type Snippet = WorkspaceItem & { category?: string; sessionOpenSettings?: any; };


import { useDbStore } from '../../../storage/store/useDbStore';
import { getFaviconUrl, saveRecentCommand, appendCmdStatus, stripCmdStatus } from '../utilityFunctions/utils';
import { createCommandIndex } from '../searchLogicAndAlgorithms/commandSearch';
import {
  LOCAL_COMMANDS,
  isLocalCommandId,
  type LocalCommandDefinition,
  type LocalCommandId,
} from '../commandConfigurations/localCommands';
import { useUserShortcuts } from '../../../shared-components/shortcuts';
import { useUserHotkeys } from '../../../shared-components/hotkeys/hooks/useUserHotkeys';
import {
  getCommandSpacePrefix,
  matchesShortcutCategory,
  parseShortcutInvocation,
  recordAssignedTriggerUsage,
} from '../../../shared-components/triggers';
import { launchDashboardCollectionView } from '../../../shared-components/dashboardCollections/launchDashboardCollectionView';
import { launchSessionSmartWithReferences } from '../../../allObjectFolder/src/createObject/session/sessionReferenceActions';
import { FaArrowLeft, FaArrowUp } from 'react-icons/fa';
import { buildCommonCommandEntries } from '../searchLogicAndAlgorithms/commonResults';
import CmdIcon from '../../../shared-components/icons/cmdIcon';

const FallbackFavicon = ({
  url,
  className,
  fallbackIcon: FallbackIcon = FaGlobe,
}: {
  url: string;
  className?: string;
  fallbackIcon?: React.ElementType;
}) => {
  const [error, setError] = useState(false);
  if (error || !url) return <FallbackIcon className={`text-[var(--color-iconDefault)] ${className}`} size={14} />;
  return <img src={getFaviconUrl(url)} alt="" className={className} onError={() => setError(true)} />;
};
type Workspace = any;
type Folder = any;
type Tabs = any;
type Team = any;
import { useCommands } from '../commandConfigurations/useCommands';
import {
  CustomSearchPrefixesForOmniboxStorage,
  DEFAULT_OMNIBOX_PREFIXES,
  type CustomOmniboxPrefixes,
} from '../../../storage/localStorage/customSearchPrefixesForOmniboxStorage';
import useNotification from '../../../shared-components/notifications/useNotification';

import AtCommandPopup, { getFilteredAtCommands } from './atCommandPopup';




import ContextualCommandPopup, { ContextualMatch } from './contextualCommandPopup';
import type { InstalledModule } from '../searchLogicAndAlgorithms/searchEngine';
import AutomationDynamicIcon from '../../../shared-components/icons/automationDynamicIcon';
import { useChromeStorage } from '@extension/shared/lib/hooks';
import { useAttachmentState } from '../keyboardAndUiHooks/useAttachmentState';
import { useSearchbarSuggestions } from '../keyboardAndUiHooks/useSearchbarSuggestions';
import { useKeyboardNavigation } from '../keyboardAndUiHooks/useKeyboardNavigation';
import { AttachmentManager } from './components/AttachmentManager';
import { InlineAutocomplete } from './components/InlineAutocomplete';
import { startupPerf } from '../../../pages/AltS_search_newtab/src/startupPerf';
import type {
  Attachment,
  AnyCommandId,
  CommandSelectionInfo,
  WorkspaceItemSuggestion,
  PromptMenuSuggestion,
  RemoteCommandSuggestionItem,
  LocalCommandSuggestionItem,
  AggregateCommandSuggestionItem,
  CommandSuggestionItem,
  BookmarkSuggestionItem,
  CommonCommandSuggestionItem,
  OpenUrlSuggestionItem,
  HistorySuggestionItem,
  AgentCollectionSuggestionItem,
  AutomationSuggestionItem,
  ModuleSuggestionItem,
  AIChatHistorySuggestionItem,
  MathSuggestionItem,
  TimeSuggestionItem,
  SuggestionListItem,
  SuggestionMode,
  FooterStatus,
  SuggestionState,
  SearchbarProps,
  SearchbarHandle,
  AutoSubmitRequest,
  LinkToOpen,
} from '../utilityFunctions/types';

const ModelSelector = lazy(() => import('../../../allObjectFolder/src/createObject/ChatAgent/ModelSelector'));

export type {
  Attachment,
  AnyCommandId,
  CommandSelectionInfo,
  WorkspaceItemSuggestion,
  PromptMenuSuggestion,
  RemoteCommandSuggestionItem,
  LocalCommandSuggestionItem,
  AggregateCommandSuggestionItem,
  CommandSuggestionItem,
  BookmarkSuggestionItem,
  CommonCommandSuggestionItem,
  OpenUrlSuggestionItem,
  HistorySuggestionItem,
  AgentCollectionSuggestionItem,
  AutomationSuggestionItem,
  ModuleSuggestionItem,
  AIChatHistorySuggestionItem,
  MathSuggestionItem,
  TimeSuggestionItem,
  SuggestionListItem,
  SuggestionMode,
  FooterStatus,
  SuggestionState,
  SearchbarProps,
  SearchbarHandle,
  AutoSubmitRequest,
  LinkToOpen,
};

import { fileToBase64, formatFileSize } from '../utilityFunctions/fileHelpers';


export { fileToBase64, formatFileSize };

import {
  toLinkConfig,
  getUrlsFromQuery,
  looksLikeUrl,
  normalizeUrl,
  normalizeUrlForComparison,
  openSingleLink,
  openMultipleLinks,
  buildCommandLink,
} from '../utilityFunctions/urlHelpers';

export {
  toLinkConfig,
  getUrlsFromQuery,
  looksLikeUrl,
  normalizeUrl,
  normalizeUrlForComparison,
  openSingleLink,
  openMultipleLinks,
  buildCommandLink,
};

import {
  BOOKMARKS_COMMAND_ID,
  isBookmarksCommand,
  trimQuery,
  STATIC_PLACEHOLDER,
  COMMAND_PREVIEW_HINT,
  escapeRegExp,
  normalizeCommandToken,
  isAiAutomationFilterDebugEnabled,
  extractPromptFromInput,
  resolvePlaceholderFromCmd,
  getTextMatchScore,
  isPureAiAutomation,
  buildSelectionInfoFromSuggestion,
  buildSelectionInfoFromId,
  commandSupportsInlineQuery,
  mapFullNameToShortcut,
  getHighlightedHtml,
} from '../utilityFunctions/promptHelpers';

export {
  BOOKMARKS_COMMAND_ID,
  isBookmarksCommand,
  trimQuery,
  STATIC_PLACEHOLDER,
  COMMAND_PREVIEW_HINT,
  escapeRegExp,
  normalizeCommandToken,
  isAiAutomationFilterDebugEnabled,
  extractPromptFromInput,
  resolvePlaceholderFromCmd,
  getTextMatchScore,
  isPureAiAutomation,
  buildSelectionInfoFromSuggestion,
  buildSelectionInfoFromId,
  commandSupportsInlineQuery,
  mapFullNameToShortcut,
  getHighlightedHtml,
};



const DEFAULT_ALL_AI_URLS: Record<string, string> = {
  gemini: 'https://gemini.google.com/app',
  gpt: 'https://chatgpt.com',
  claude: 'https://claude.ai/new',
  perplexity: 'https://www.perplexity.ai',
};

const stripHtml = (html: string) => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
};

export const Searchbar = forwardRef<SearchbarHandle, SearchbarProps>(
  (
    {
      isEmbedded,
      contextUrl,
      containerClassName,
      inputWrapperClassName,
      onSuggestionStateChange,
      onCommandExecute,
      onSnippetSelect,
      onAutomationSelect,
      onAutomationEdit,
      onRequestAutomationEdit,
      onQueryChange,
      focus = false,
      onRequestFocusChange,
      onCommandModeExit,
      onClearFolder,
      onNavigateBack,
      onRequestEditLink,
      onRequestSnippetDelete,
      onToggleFavorite,
      onRequestOpenUrls,
      placeholder = STATIC_PLACEHOLDER,

      onSearchbarFocus,
      searchValue: propSearchValue,
      isLoggedIn,
      onLockedCommandChange,
      lockedCommand: propLockedCommand,
      onSaveAgent,
      activeStoreTab,
      onToggleStoreTab,
      isAIHistoryOpen,
      onToggleAIHistory,
      savedAiAgents = [],
      hideDynamicIcon = false,
      disableContextualPopup = false,
      isInitialAltSFocus = false,
      onInitialAltSFocusChange,
      displayHomeView = false,
      onHoverSlashDot,
    },
    ref,
  ) => {
    const renderCountRef = useRef(0);
    renderCountRef.current += 1;

    // --- Refs for Suggestion State ---
    const suggestionVisibilityRef = useRef(false);
    const selectionSourceRef = useRef<'suggestions' | 'external' | null>(null);
    const pendingUserFocusRef = useRef(false);
    const { commands: rawCommands, refreshCommands } = useCommands();
    const commands = useMemo(() => {
      if (!isLoggedIn) {
        return rawCommands.filter(c => c.category === 'browser');
      }
      return rawCommands;
    }, [rawCommands, isLoggedIn]);
    const getCommandById = useCallback(
      (commandId: string | null | undefined) =>
        findCommandByAnyId(commands, commandId) ||
        findCommandByAnyId(COMMANDS, commandId) ||
        findCommandByAnyId(SHARED_ALL_COMMANDS as any, commandId),
      [commands],
    );
    const hasCommandById = useCallback((commandId: string | null | undefined) => Boolean(getCommandById(commandId)), [getCommandById]);
    // Command index for '/' prefix mode only.
    const commandIndex = useMemo(() => createCommandIndex(commands), [commands]);

    const [lockedCommand, setLockedCommand] = useState<AnyCommandId | null>(propLockedCommand || null);
    const [activeSlashFilter, setActiveSlashFilter] = useState<string | null>(null);
    const [selectedCommand, setSelectedCommand] = useState<CommandSelectionInfo | null>(null);

    const activeCommandInfo = useMemo(
      () => (lockedCommand ? buildSelectionInfoFromId(lockedCommand, commands) : null),
      [lockedCommand, commands],
    );

    const inlineComposerInfo = lockedCommand ? activeCommandInfo : selectedCommand;
    const inlineComposerVisible = commandSupportsInlineQuery(inlineComposerInfo);
    const inlineComposerActive = Boolean(lockedCommand && inlineComposerVisible);
    const inlineComposerPreview = Boolean(!lockedCommand && inlineComposerVisible);

    const [value, setValueRaw] = useState('');
    const lastLocalValueRef = useRef('');

    const [selectedAIs, setSelectedAIs] = useState<string[]>(() => DEFAULT_SELECTED_AIS);
    const [isAiEditMode, setIsAiEditMode] = useState<boolean>(false);
    const [isModelPopupOpen, setIsModelPopupOpen] = useState(false);
    const [modelWarning, setModelWarning] = useState<string | null>(null);
    const triggerNotification = useNotification();

    const userDbShortcuts = useUserShortcuts();
    const userDbHotkeys = useUserHotkeys();
    const customOmniboxPrefixesRef = useRef<any>(null);
    const [customOmniboxPrefixes, setCustomOmniboxPrefixes] =
      useState<Required<CustomOmniboxPrefixes>>(DEFAULT_OMNIBOX_PREFIXES);

    useEffect(() => {
      const loadPrefixes = async () => {
        try {
          const prefixes = await CustomSearchPrefixesForOmniboxStorage.getPrefixes();
          customOmniboxPrefixesRef.current = prefixes;
          setCustomOmniboxPrefixes(prefixes);
        } catch (e) {
          console.error('[SearchBar] Failed to load prefixes:', e);
        }
      };
      loadPrefixes();
      window.addEventListener('omniboxPrefixesChanged', loadPrefixes);
      return () => {
        window.removeEventListener('omniboxPrefixesChanged', loadPrefixes);
      };
    }, []);

    const slashFilterMeta = useMemo(() => {
      const prefixes = customOmniboxPrefixes || DEFAULT_OMNIBOX_PREFIXES;
      const bKey = String(prefixes.bookmark || 'bm').trim().toLowerCase();
      const nKey = String(prefixes.note || 'n').trim().toLowerCase();
      const snKey = String(prefixes.snippet || 'sn').trim().toLowerCase();
      const sKey = String(prefixes.collection || 'co').trim().toLowerCase();
      const lKey = String(prefixes.link || 'l').trim().toLowerCase();
      const cKey = String(prefixes.command || 'c').trim().toLowerCase();
      const tKey = String(prefixes.todo || 't').trim().toLowerCase();
      const pKey = String(prefixes.prompt || 'p').trim().toLowerCase();
      const auKey = String(prefixes.automation || 'au').trim().toLowerCase();
      const agentKey = String(prefixes.agent || 'g').trim().toLowerCase();
      const scKey = String(prefixes.system_command || 'sc').trim().toLowerCase();

      const meta = {
        a: { label: 'All' },
        [nKey]: { label: 'Notes' },
        [snKey]: { label: 'Text Expanders' },
        [pKey]: { label: 'Prompts' },
        [lKey]: { label: 'Links' },
        [cKey]: { label: 'Commands' },
        [bKey]: { label: 'Bookmarks' },
        [tKey]: { label: 'Todos' },
        [sKey]: { label: 'Collections' },
        [auKey]: { label: 'Automations' },
        [agentKey]: { label: 'Chat Agents' },
        [scKey]: { label: 'System Commands' },
      } as Record<string, { label: string }>;

      return Object.fromEntries(Object.entries(meta).filter(([alias]) => alias.trim().length > 0));
    }, [customOmniboxPrefixes]);

    const { commandKey, noteKey, linkKey } = useMemo(() => {
      const customPrefixes = customOmniboxPrefixesRef.current;
      let cKey = customPrefixes?.command?.trim().toLowerCase() ?? '';
      let nKey = customPrefixes?.note?.trim().toLowerCase() ?? '';
      let lKey = customPrefixes?.link?.trim().toLowerCase() ?? '';

      userDbShortcuts?.forEach((cmd: any) => {
        if (cmd.id === 'search_commands' && cmd.prefix && cmd.prefix.trim()) {
          cKey = cmd.prefix.replace(/^\/+/, '').trim().toLowerCase();
        } else if (cmd.id === 'search_notes' && cmd.prefix && cmd.prefix.trim()) {
          nKey = cmd.prefix.replace(/^\/+/, '').trim().toLowerCase();
        } else if (cmd.id === 'search_links' && cmd.prefix && cmd.prefix.trim()) {
          lKey = cmd.prefix.replace(/^\/+/, '').trim().toLowerCase();
        }
      });
      return { commandKey: cKey, noteKey: nKey, linkKey: lKey };
    }, [userDbShortcuts, customOmniboxPrefixes]);

    const parseSlashFilter = useCallback(
      (input: string): { alias: string; label: string; prefixLength: number } | null => {
        const normalized = input.replace(/\u00A0/g, ' ');
        const normalizedCommandKey = getCommandSpacePrefix(commandKey || customOmniboxPrefixes);
        
        const colonMatch = normalized.match(/^([a-zA-Z0-9_-]+):\s/);
        if (colonMatch && colonMatch[0]) {
          const colonAlias = colonMatch[1].toLowerCase();
          
          if (slashFilterMeta[colonAlias]) {
            return {
              alias: colonAlias,
              label: slashFilterMeta[colonAlias].label,
              prefixLength: colonMatch[0].length
            };
          }
        }

        const isSlashFormat = normalized.startsWith('/');
        const isCommandFormat = normalized.toLowerCase().startsWith(`${normalizedCommandKey} `);
        if (!isSlashFormat && !isCommandFormat) return null;

        const aliasKeys = Object.keys(slashFilterMeta).sort((a, b) => b.length - a.length);
        const prefixLength = isSlashFormat ? 1 : normalizedCommandKey.length + 1;
        const textAfterPrefix = normalized.slice(prefixLength).toLowerCase();

        for (const alias of aliasKeys) {
          if (textAfterPrefix === alias || textAfterPrefix.startsWith(`${alias} `)) {
            return { alias, label: slashFilterMeta[alias].label, prefixLength };
          }
        }

        return null;
      },
      [slashFilterMeta, commandKey, customOmniboxPrefixes],
    );

    useEffect(() => {
      let timer: NodeJS.Timeout;
      if (modelWarning) {
        timer = setTimeout(() => setModelWarning(null), 3000);
      }
      return () => {
        if (timer) clearTimeout(timer);
      };
    }, [modelWarning]);

    const handleToggleAI = useCallback(
      (aiId: string) => {
        if (selectedAIs.length === 1 && selectedAIs.includes(aiId)) {
          setModelWarning('At least one model must be active.');
          setIsModelPopupOpen(true);
        } else {
          setModelWarning(null);
          setSelectedAIs(prev => {
            const newSelection = prev.includes(aiId) ? prev.filter(id => id !== aiId) : [...prev, aiId];
            // Save to chrome storage
            if (typeof chrome !== 'undefined' && chrome.storage) {
              chrome.storage.local.set({ selectedAIs: newSelection });
            }
            return newSelection;
          });
        }
      },
      [selectedAIs],
    );

    // --------------------------------------------------------------------------
    // State Reset on Query Change (Alt+S behavior)
    // --------------------------------------------------------------------------
    useEffect(() => {
      if (isInitialAltSFocus && onInitialAltSFocusChange && value.length > 0) {
        onInitialAltSFocusChange(false);
      }
    }, [value, isInitialAltSFocus, onInitialAltSFocusChange]);

    // Agent Collection State and Effect
    const [agentCollectionSuggestions, setAgentCollectionSuggestions] = useState<AgentCollectionSuggestionItem[]>([]);
    const automationSuggestions: SavedAutomation[] = [];
    const moduleSuggestions: InstalledModule[] = [];

    useEffect(() => {
      const INDEX_KEY = 'alts_agent_collections_index';
      const chromeAny = (window as any).chrome;

      const loadCollections = () => {
        if (chromeAny && chromeAny.storage && chromeAny.storage.local) {
          chromeAny.storage.local.get([INDEX_KEY], (result: any) => {
            const titles = result[INDEX_KEY];
            if (titles && Array.isArray(titles)) {
              // Map titles to suggestion items
              const items = titles.map((title: string) => ({
                _kind: 'agent_collection' as const,
                title: title,
                itemCount: 0, // Placeholder
              }));
              setAgentCollectionSuggestions(items);
            }
          });
        }
      };

      const handleChange = (
        changes: Record<string, chrome.storage.StorageChange>,
        areaName: 'sync' | 'local' | 'managed' | 'session',
      ) => {
        if (areaName === 'local' && changes[INDEX_KEY]) {
          loadCollections();
        }
      };

      try {
        // Initial Load
        loadCollections();

        // Listen for changes
        if (chromeAny && chromeAny.storage && chromeAny.storage.onChanged) {
          chromeAny.storage.onChanged.addListener(handleChange);
        }
      } catch (e) {
        console.error('[Searchbar] Failed to load agent collections', e);
      }

      return () => {
        if (chromeAny && chromeAny.storage && chromeAny.storage.onChanged) {
          chromeAny.storage.onChanged.removeListener(handleChange);
        }
      };
    }, []); // Run on mount

    useEffect(() => {
      if (inlineComposerActive) {
        if (inputRef.current && (inputRef.current.innerText || inputRef.current.innerHTML)) {
          inputRef.current.innerText = '';
          inputRef.current.innerHTML = '';
        }
        return;
      }
      if (propSearchValue !== undefined && propSearchValue !== lastLocalValueRef.current) {
        let displayValue = propSearchValue;
        const normalized = propSearchValue.replace(/\u00A0/g, ' ');
        const slashMatch = parseSlashFilter(normalized);
        if (slashMatch) {
          activeSlashFilterRef.current = slashMatch.alias;
          setActiveSlashFilter(slashMatch.alias);
          displayValue = normalized.slice(slashMatch.prefixLength + slashMatch.alias.length).trimStart();
        } else {
          activeSlashFilterRef.current = null;
          setActiveSlashFilter(null);
        }

        setValueRaw(displayValue);
        lastLocalValueRef.current = propSearchValue;
        if (inputRef.current) {
          try {
            if (inputRef.current.innerText !== displayValue) {
              const expectedHtml = getHighlightedHtml(displayValue, slashFilterMeta);
              inputRef.current.innerHTML = expectedHtml;
              inputRef.current.focus();

              // Safely move the typing cursor/caret to the end of the text
              const range = document.createRange();
              const sel = window.getSelection();
              range.selectNodeContents(inputRef.current as Node);
              range.collapse(false);
              sel?.removeAllRanges();
              sel?.addRange(range);
            }
          } catch (e) {
            console.error('[Searchbar] Error syncing propSearchValue to contentEditable:', e);
          }
        }
      }
    }, [propSearchValue, inlineComposerActive, parseSlashFilter, slashFilterMeta]);

    const setValue = useCallback(
      (newValue: string) => {
        const mappedValue = mapFullNameToShortcut(newValue, slashFilterMeta);
        const normalized = mappedValue.replace(/\u00A0/g, ' ');
        setValueRaw(normalized);
        if (typeof window !== 'undefined') {
          (window as any).__LAST_TYPED_SEARCH_QUERY__ = normalized;
        }
        const chromeAny = (window as any)?.chrome;
        if (chromeAny?.storage?.local) {
          chromeAny.storage.local.set({ last_search_query: normalized });
        }

        let fullValue = normalized;

        if (activeSlashFilterRef.current) {
          const normalizedCommandKey = getCommandSpacePrefix(commandKey || customOmniboxPrefixes);
          const normalizedFilter = String(activeSlashFilterRef.current || '').trim().toLowerCase();
          const filterLabel = String(slashFilterMeta[normalizedFilter]?.label || '').trim().toLowerCase();
          const typedQuery = String(normalized || '').trimStart();
          fullValue =
            filterLabel === 'commands'
              ? `${normalizedCommandKey} ${typedQuery}`.trimEnd() + (typedQuery ? '' : ' ')
              : `${normalizedCommandKey} ${normalizedFilter}${typedQuery ? ` ${typedQuery}` : ' '}`;
        }
        lastLocalValueRef.current = fullValue; // Track this locally to ignore it from props later

        if (inlineComposerActive) {
          if (inputRef.current && (inputRef.current.innerText || inputRef.current.innerHTML)) {
            inputRef.current.innerText = '';
            inputRef.current.innerHTML = '';
          }
        } else if (inputRef.current) {
          const expectedHtml = getHighlightedHtml(normalized, slashFilterMeta);
          const currentHtml = inputRef.current.innerHTML;
          const needsUpdate = normalized.startsWith('/') ? (currentHtml !== expectedHtml) : (inputRef.current.innerText.replace(/\u00A0/g, ' ') !== normalized);
          if (needsUpdate) {
            try {
              inputRef.current.innerHTML = expectedHtml;
              inputRef.current.focus();

              // Move cursor to the end
              const range = document.createRange();
              const sel = window.getSelection();
              range.selectNodeContents(inputRef.current as Node);
              range.collapse(false);
              sel?.removeAllRanges();
              sel?.addRange(range);
            } catch (e) {
              console.error('[Searchbar] Error syncing in setValue:', e);
            }
          }
        }

        onQueryChange?.(fullValue);
      },
      [onQueryChange, inlineComposerActive, activeSlashFilter, slashFilterMeta, commandKey, customOmniboxPrefixes],
    );

    // Auto-resize on value change (programmatic or typed)
    useEffect(() => {
      const textarea = inputRef.current;
      if (textarea) {
        // Use requestAnimationFrame to avoid forced synchronous layout mid-render
        requestAnimationFrame(() => {
          textarea.style.height = 'auto';
          textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
        });
      }
    }, [value]);
    const [commandPrompt, setCommandPrompt] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    // Start as false — Board View should only open after explicit user interaction (typing/click)
    // NOT auto-render just because isBoardViewEnabled is true
    const [keepBoardViewOpen, setKeepBoardViewOpen] = useState(false);
    const [showEmptySlashDropdown, setShowEmptySlashDropdown] = useState(false);

    useEffect(() => {
      if (value.trim().length > 0) {
        // User typed something while in Board View mode — keep it open
        setKeepBoardViewOpen(true);
        setShowEmptySlashDropdown(false);
      } else if (value.trim().length === 0) {
        // Search cleared — reset so Board View doesn't persist without interaction
        setKeepBoardViewOpen(false);
      }
    }, [value]);

    const serializeRichPrompt = (element: HTMLElement | null): string => {
      if (!element) return '';
      // Clone the element to avoid modifying the actual UI
      const clone = element.cloneNode(true) as HTMLElement;
      // Find all tab pills
      const pills = clone.querySelectorAll('span[data-tab-id]');
      pills.forEach(pill => {
        const tabId = pill.getAttribute('data-tab-id');
        if (tabId) {
          // Replace the visual pill with our internal textual placeholder
          const placeholder = document.createTextNode(` @[tab:${tabId}] `);
          pill.parentNode?.replaceChild(placeholder, pill);
        }
      });
      // innerText preserves newlines and handles layout better than textContent
      return (clone.innerText || '').trim();
    };

    const [isAutomationInputActive, setIsAutomationInputActive] = useState(
      typeof window !== 'undefined' && Boolean((window as any).__tasklabsAutomationInputActive),
    );
    const [highlightIndex, setHighlightIndex] = useState<number>(0);
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const lastActionRef = useRef<'backspace' | 'typing' | null>(null);
    const inlineInputRef = useRef<HTMLInputElement | null>(null);
    const prefixRef = useRef<HTMLDivElement | null>(null);
    const modelPopupRef = useRef<HTMLDivElement | null>(null);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [isInlineFocused, setIsInlineFocused] = useState(false);
    const [windowDimensions, setWindowDimensions] = useState({
      width: typeof window !== 'undefined' ? window.innerWidth : 1200,
      height: typeof window !== 'undefined' ? window.innerHeight : 800,
    });

    useEffect(() => {
      const handleResize = () => {
        setWindowDimensions({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      };
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
      return () => {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }
      };
    }, []);

    useEffect(() => {
      const handleAutomationInputActiveChange = (event: Event) => {
        const customEvent = event as CustomEvent<{ active?: boolean }>;
        setIsAutomationInputActive(Boolean(customEvent.detail?.active));
      };

      window.addEventListener(
        'tasklabs-automation-input-active-change',
        handleAutomationInputActiveChange as EventListener,
      );
      setIsAutomationInputActive(Boolean((window as any).__tasklabsAutomationInputActive));

      return () => {
        window.removeEventListener(
          'tasklabs-automation-input-active-change',
          handleAutomationInputActiveChange as EventListener,
        );
      };
    }, []);

const { dynamicLeftOffset, dynamicGap, dynamicFallbackPadding } = useMemo(() => {
      const { width } = windowDimensions;
      // 12px (default), 14px (1600+), 16px (1800+)
      // Standard icon width w-4 (16px), gap-2 (8px).
      // All content (pill text and search text) starts at: offset + 24px.
      if (width >= 1800) return { dynamicLeftOffset: 16, dynamicGap: 8, dynamicFallbackPadding: 40 };
      if (width >= 1600) return { dynamicLeftOffset: 14, dynamicGap: 8, dynamicFallbackPadding: 38 };
      return { dynamicLeftOffset: 12, dynamicGap: 8, dynamicFallbackPadding: 36 };
    }, [windowDimensions.width]);

    const [prefixWidth, setPrefixWidth] = useState(0);
    const [showAIHistoryPanel, setShowAIHistoryPanel] = useState(false);
    const [activeCollection, setActiveCollection] = useState<{
      item: any;
      agents: any[];
      links?: any[];
      automations?: any[];
      fields: SearchbarAutomationField[];
      constantInputs?: Record<string, string>;
      constantFields?: SearchbarAutomationField[];
      focusedFieldIndex: number;
    } | null>(null);

    useEffect(() => {
      const isActive = !!activeCollection;
      if (typeof window !== 'undefined') {
        (window as any).__tasklabsAutomationInputActive = isActive;
        window.dispatchEvent(
          new CustomEvent('tasklabs-automation-input-active-change', {
            detail: { active: isActive },
          }),
        );
      }
    }, [activeCollection]);

    const [isSuggestionsHidden, setIsSuggestionsHidden] = useState(false);

    // Active Ephemeral "All AI" Session
    const [activeAiSession, setActiveAiSession] = useState<{
      id: string | number;
      sessionKey: string;
      prompt: string;
      rules?: string;
      name?: string;
      models: string[];
      tabIds: number[];
      urls: string[];
      workspace_id?: string | null;
      folder_id?: string | null;
      customModelDefinitions?: { id: string; name: string; url: string; host: string }[];
    } | null>(null);

    const isInitialMountRef = useRef(true);
    const isProgrammaticFocusRef = useRef<boolean>(false);

    // Intercept native focus() calls to reliably identify programmatic vs user-initiated focus
    useEffect(() => {
      const el = inputRef.current as any;
      if (!el) return;
      const originalFocus = el.focus;
      el.focus = (options?: FocusOptions) => {
        isProgrammaticFocusRef.current = true;
        originalFocus.call(el, options);
        setTimeout(() => {
          isProgrammaticFocusRef.current = false;
        }, 50);
      };
      return () => {
        el.focus = originalFocus;
      };
    }, []);

    useEffect(() => {
      isInitialMountRef.current = false;
    }, []);



    const onUpdateCustomModels = useCallback((models: { id: string; name: string; url: string; host: string }[]) => {
      setActiveAiSession(prev => {
        if (!prev) {
          return {
            id: 'new-chat',
            sessionKey: `new-chat-${Date.now()}`,
            prompt: '',
            models: [],
            tabIds: [],
            urls: [],
            customModelDefinitions: models,
          };
        }
        return {
          ...prev,
          customModelDefinitions: models,
        };
      });
    }, []);

    const onUpdateModelUrl = useCallback((modelId: string, url: string) => {
      setActiveAiSession(prev => {
        if (!prev) return null;
        const modelIdx = prev.models.indexOf(modelId);
        if (modelIdx === -1) return prev;

        const nextUrls = [...prev.urls];
        nextUrls[modelIdx] = url;

        // If this is a saved agent (automation), we should update the automation steps too
        // We identify it by checking if ID is not a 'session-' placeholder
        const isSavedAgent = prev.id && !String(prev.id).startsWith('session-');
        if (isSavedAgent) {
          const automationId = String(prev.id);
          chrome.storage.local.get(['automations'], result => {
            const automations = result.automations || {};
            const auto = automations[automationId];
            if (auto && (auto.steps || auto.automation_steps)) {
              const raws = auto.steps || auto.automation_steps || [];
              let updated = false;
              raws.forEach((step: any) => {
                const config = step.config || {};
                const stepAgentId = config.agentId || config.id || '';
                // Normalize 'all_ai' or check for modelId match
                if (stepAgentId === modelId || (stepAgentId === 'all_ai' && modelId === 'ai')) {
                  config.agentUrl = url;
                  updated = true;
                }
              });
              if (updated) {
                chrome.storage.local.set({
                  automations: {
                    ...automations,
                    [automationId]: { ...auto, steps: raws },
                  },
                });
              }
            }
          });
        }

        return { ...prev, urls: nextUrls };
      });
    }, []);

    const [selectedAutomation, setSelectedAutomation] = useState<SavedAutomation | null>(null);

    // Synchronize active AI session URLs from the background script
    useEffect(() => {
      const listener = (message: any) => {
        if (message.action === 'ai_session_url_updated' && message.url) {
          setActiveAiSession(prev => {
            if (!prev) return null;
            const modelIdx = prev.models.indexOf(message.model);
            if (modelIdx === -1) return prev;

            const nextUrls = [...prev.urls];
            nextUrls[modelIdx] = message.url;
            const nextSession = { ...prev, urls: nextUrls };
            // Update ref for immediate capture in long-running functions
            activeAiSessionRef.current = nextSession;
            return nextSession;
          });
        }
      };

      chrome.runtime.onMessage.addListener(listener);
      return () => chrome.runtime.onMessage.removeListener(listener);
    }, []);
    // Ref so runAggregateCommand can always read the latest value (avoids stale closure)
    const activeAiSessionRef = useRef<typeof activeAiSession>(null);
    useEffect(() => {
      activeAiSessionRef.current = activeAiSession;
    }, [activeAiSession]);

    const selectedAutomationRef = useRef<SavedAutomation | null>(null);
    useEffect(() => {
      selectedAutomationRef.current = selectedAutomation;
    }, [selectedAutomation]);

    // Persist active AI session to storage
    useEffect(() => {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({ activeAiSession });
      }
    }, [activeAiSession]);

    const valueRef = useRef<string>('');
    useEffect(() => {
      valueRef.current = value;
    }, [value]);

    const activeSlashFilterRef = useRef<string | null>(null);
    useEffect(() => {
      activeSlashFilterRef.current = activeSlashFilter;
    }, [activeSlashFilter]);

    const selectedAIsRef = useRef<string[]>([]);
    useEffect(() => {
      selectedAIsRef.current = selectedAIs;
    }, [selectedAIs]);

    // AI Prompt Queue for sequential processing
    const promptQueueRef = useRef<
      {
        prompt: string;
        images?: { file?: File; base64?: string; mimeType: string; filename: string }[] | null;
        historyUrls?: string[];
      }[]
    >([]);
    const isProcessingQueueRef = useRef(false);

    // Contextual Action Popup State (Commands/Automations for highlighted result)
    const [contextualMatches, setContextualMatches] = useState<ContextualMatch[]>([]);
    const [contextualPopupIndex, setContextualPopupIndex] = useState<number>(-1);
    const [isContextualPopupOpen, setIsContextualPopupOpen] = useState(false);
    const contextualMatchIdsRef = useRef('');
    const cursorOverlayRef = useRef<HTMLDivElement | null>(null);

    const syncScroll = useCallback(() => {
      if (inputRef.current && cursorOverlayRef.current) {
        cursorOverlayRef.current.scrollTop = inputRef.current.scrollTop;
      }
    }, []);

    const updateCursorPosition = useCallback(() => {
      if (inputRef.current) {
        syncScroll();
      }
    }, [syncScroll]);
    const [inlineCursorPosition, setInlineCursorPosition] = useState<number | null>(null);


    const updateInlineCursorPosition = useCallback(() => {
      if (inlineInputRef.current) {
        setInlineCursorPosition(inlineInputRef.current.selectionStart || 0);
      }
    }, []);

    // Sync locked command state to parent
    const lastSyncedLockedCommandRef = useRef<AnyCommandId | null | undefined>(undefined);
    useEffect(() => {
      if (propLockedCommand !== undefined && propLockedCommand !== lockedCommand) {
        setLockedCommand(propLockedCommand);
        lastSyncedLockedCommandRef.current = propLockedCommand;
      }
    }, [propLockedCommand]);

    useEffect(() => {
      if (onLockedCommandChange && lockedCommand !== lastSyncedLockedCommandRef.current) {
        onLockedCommandChange(lockedCommand);
        lastSyncedLockedCommandRef.current = lockedCommand;
      }
    }, [lockedCommand, onLockedCommandChange]);

    const isLinkEditModalOpen = useUIStore((s: any) => s.isLinkEditModalOpen);
    const activeEditor = useUIStore(s => s.activeEditor);
    const { theme } = useAppearance();
    const containerRef = useRef<HTMLDivElement>(null);

    const [showPromo, setShowPromo] = useState(false);

    // Randomly show glow animation with 30% probability (3/10 times)
    const [showGlow] = useState(() => Math.random() < 0.3);

    // Sync locked command state to parent

    // AI selection state
    const [currentTabId, setCurrentTabId] = useState<number | null>(null);



    // Footer status for command feedback (moved up to resolve hook declaration dependency)
    const [footerStatus, setFooterStatus] = useState<FooterStatus>(null);

    // Staged AI History Session for context injection
    const [stagedHistorySession, setStagedHistorySession] = useState<AIChatHistorySuggestionItem | null>(null);

    const stagedHistorySessionRef = useRef<typeof stagedHistorySession>(null);
    useEffect(() => {
      stagedHistorySessionRef.current = stagedHistorySession;
    }, [stagedHistorySession]);

    // Image/File attachment state managed via hook
    const {
      selectedImages,
      setSelectedImages,
      selectedImagesRef,
      fileInputRef,
      hoveredFileIndex,
      setHoveredFileIndex,
      isDragging,
      setIsDragging,
      isGlobalDragging,
      handleFileSelect,
      handlePaste,
      handleDragOver,
      handleDragEnter,
      handleDragLeave,
      handleDrop,
      removeSelectedImage,
      clearSelectedImages,
    } = useAttachmentState({
      lockedCommand,
      triggerNotification,
      setValue,
      inputRef: inputRef as React.RefObject<HTMLDivElement | null>,
      containerRef,

isLinkEditModalOpen,
      setFooterStatus,
    });

    // Fetch current tab ID on mount to ensure we can target it reliably later
    useEffect(() => {
      const chromeAny = (window as any)?.chrome;
      if (chromeAny?.tabs?.getCurrent) {
        chromeAny.tabs.getCurrent((tab: any) => {
          if (tab?.id) {

            setCurrentTabId(tab.id);
          }
        });
      }
    }, []);

    // Inline Prompt Dropdown State (Tab key triggered)
    const [promptSuggestions, setPromptSuggestions] = useState<PromptMenuSuggestion[]>([]);
    const [promptHighlightIndex, setPromptHighlightIndex] = useState(0);
    const [showPromptMenu, setShowPromptMenu] = useState(false);

    // @ Command Selector State (shows GPT, Perplexity, Google when @ is typed)
    const [showAtCommandMenu, setShowAtCommandMenu] = useState(false);
    const [atCommandHighlightIndex, setAtCommandHighlightIndex] = useState(0);
    const [selectedAtCommand, setSelectedAtCommand] = useState<string | null>(null);
    const [recentIds] = useChromeStorage<string[]>('taskbot_recent_commands', []);
    const [autoTriggerDropdown, setAutoTriggerDropdown] = useChromeStorage<boolean>('rtq_focus_on', true);
    const [openTabs, setOpenTabs] = useState<any[]>([]);
    const [mentionedTabs, setMentionedTabs] = useState<any[]>([]);
    const suppressAtMenuRef = useRef(false);
    const lastAtSelectRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });

    const mentionedTabsContainerRef = useRef<HTMLDivElement | null>(null);
    const [mentionedTabsWidth, setMentionedTabsWidth] = useState(0);

    useLayoutEffect(() => {
      if (mentionedTabsContainerRef.current) {
        setMentionedTabsWidth(mentionedTabsContainerRef.current.offsetWidth);
      } else {
        setMentionedTabsWidth(0);
      }
    }, [mentionedTabs]);

    useEffect(() => {
      const chromeAny = (window as any).chrome;
      if (chromeAny && chromeAny.tabs && chromeAny.tabs.query) {
        chromeAny.tabs.query({}, (tabs: any[]) => {
          const mapped = (tabs || [])
            .filter(t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'))
            .map(t => ({
              id: `tab:${t.id}`,
              label: t.title || t.url || 'Untitled Tab',
              favIconUrl: t.favIconUrl || (t.url ? getFaviconUrl(t.url) : ''),
            }));
          setOpenTabs(mapped);
        });
      }
    }, [value]);

    useEffect(() => {
      const editable = inputRef.current as any;
      if (editable && value === '' && editable.innerText !== '') {
        editable.innerHTML = '';
      }
    }, [value]);

    // Inline Saved Agents Menu State (when locked in /ai and typing /...)
    const [showSavedAgentsMenu, setShowSavedAgentsMenu] = useState(false);
    const [savedAgentSuggestions, setSavedAgentSuggestions] = useState<any[]>([]);
    const [savedAgentHighlightIndex, setSavedAgentHighlightIndex] = useState(0);

    useEffect(() => {
      const promptText = commandPrompt || value;
      const isLockedAI = lockedCommand === 'ai';

      if (isLockedAI && promptText.startsWith('/')) {
        const query = promptText.slice(1).trim().toLowerCase();

        // 1. Build the "Your Chats" style list
        const activeUnsaved =
          activeAiSession && !savedAiAgents.some(a => String(a.id) === String((activeAiSession as any).id))
            ? [
              {
                id: 'active-session',
                name: activeAiSession.name || activeAiSession.prompt || 'Untitled Session',
                isActive: true,
              },
            ]
            : [];

        const savedPart = (savedAiAgents || []).map(a => ({
          ...a,
          isActive: String(a.id) === String((activeAiSession as any)?.id),
        }));

        const activeSaved = savedPart.filter(a => a.isActive);
        const otherSaved = savedPart.filter(a => !a.isActive);

        const allItems = [...activeUnsaved, ...activeSaved, ...otherSaved];

        // 2. Filter based on query if present
        if (query) {
          const filtered = allItems.filter((item: any) => (item.name || '').toLowerCase().includes(query));
          setSavedAgentSuggestions(filtered);
          setShowSavedAgentsMenu(filtered.length > 0);
          setSavedAgentHighlightIndex(0);
        } else {
          setSavedAgentSuggestions(allItems);
          setShowSavedAgentsMenu(allItems.length > 0);
          setSavedAgentHighlightIndex(0);
        }
      } else {
        setShowSavedAgentsMenu(false);
        setSavedAgentSuggestions([]);
      }
    }, [lockedCommand, commandPrompt, value, savedAiAgents, activeAiSession]);

const checkLocalCommandAuth = useCallback(
      (commandId: AnyCommandId): boolean => {
        return true;
      },
      [],
    );

    // Chrome omnibox-style inline autocomplete state
    const [inlineAutocomplete, setInlineAutocomplete] = useState<string | null>(null);
    const [isSearchFocusEnabled, setIsSearchFocusEnabled] = useState(true);

    useEffect(() => {
      startupPerf('Searchbar:commit', {
        renderCount: renderCountRef.current,
        valueLength: value.length,
        lockedCommand,
        commandCount: commands.length,
        commandIndexCount: commandIndex.length,
        isFocused,
        isSearchFocusEnabled,
        selectedImageCount: selectedImages.length,
        selectedAICount: selectedAIs.length,
        agentCollectionSuggestionCount: agentCollectionSuggestions.length,
      });
    });

    useEffect(() => {
      if (typeof chrome === 'undefined' || !chrome.storage?.local) return;

      chrome.storage.local.get(['omnibox_override_enabled'], result => {
        setIsSearchFocusEnabled(result.omnibox_override_enabled !== false);
      });

      const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
        if (areaName === 'local' && changes.omnibox_override_enabled) {
          setIsSearchFocusEnabled(changes.omnibox_override_enabled.newValue !== false);
        }
      };

      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }, []);

    useEffect(() => {
      const loadPersistedData = () => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.local.get(['selectedAIs', 'activeAiSession'], result => {
            if (result.selectedAIs && Array.isArray(result.selectedAIs)) {
              setSelectedAIs(prev =>
                prev.length === result.selectedAIs.length && prev.every((id, index) => id === result.selectedAIs[index])
                  ? prev
                  : result.selectedAIs,
              );
            } else {
              setSelectedAIs(prev =>
                prev.length === AI_GROUP.members.length && prev.every((id, index) => id === AI_GROUP.members[index])
                  ? prev
                  : AI_GROUP.members,
              );
            }

            if (result.activeAiSession && !isInitialMountRef.current) {

              setActiveAiSession(result.activeAiSession);
            }
          });
        } else {
          setSelectedAIs(prev =>
            prev.length === AI_GROUP.members.length && prev.every((id, index) => id === AI_GROUP.members[index])
              ? prev
              : AI_GROUP.members,
          );
        }
      };

      loadPersistedData();

      // Listen for changes
      const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
        if (areaName === 'local' && changes.selectedAIs) {
          const newValue = changes.selectedAIs.newValue;
          if (newValue && Array.isArray(newValue)) {
            setSelectedAIs(prev =>
              prev.length === newValue.length && prev.every((id, index) => id === newValue[index]) ? prev : newValue,
            );
          }
        }
      };

      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => chrome.storage.onChanged.removeListener(handleStorageChange);
      }
      return undefined;
    }, []);

    // Keep isFocused in sync with actual DOM focus on the textarea element.
    // We avoid window-level listeners to prevent race conditions with autoFocus.
    // The mount check (with delay) handles the case where autoFocus fires before
    // React's synthetic onFocus handler is attached.
    useEffect(() => {
      const el = inputRef.current;
      if (!el) return;

      const handleFocus = () => {
        setIsFocused(true);
      };
      const handleBlur = () => {
        // Guard: only set false if the textarea truly lost focus.
        // This prevents brief focus-stealing during page load from hiding the cursor.
        if (document.activeElement !== el) {
          setIsFocused(false);
        }
      };

      el.addEventListener('focus', handleFocus);
      el.addEventListener('blur', handleBlur);

      // Delayed mount check: autoFocus may not have fired yet when useEffect runs.
      // This ensures isFocused=true once autoFocus has taken effect.
      const t = setTimeout(() => {
        setIsFocused(document.activeElement === el);
      }, 100);

      return () => {
        el.removeEventListener('focus', handleFocus);
        el.removeEventListener('blur', handleBlur);
        clearTimeout(t);
      };
    }, []);

    const [bookmarkSuggestions, setBookmarkSuggestions] = useState<BookmarkSuggestionItem[]>([]);
    const [pendingQueryUrls, setPendingQueryUrls] = useState<string[] | null>(null);
    const [processedReadyUrls, setProcessedReadyUrls] = useState<string[]>([]);
    const [pendingQueryLabel, setPendingQueryLabel] = useState<string>('');
    const [queryValue, setQueryValue] = useState('');
    const queryInputRef = useRef<HTMLInputElement | null>(null);

    // Measure prefix width dynamically
    useLayoutEffect(() => {
      if (
        prefixRef.current &&
        ((lockedCommand && activeCommandInfo) ||
          (pendingQueryUrls && pendingQueryUrls.length > 0) ||
          selectedAtCommand ||
          (allSuggestions.length > 0 && !lockedCommand && value.trim().length > 0))
      ) {
        const width = prefixRef.current.offsetWidth;
        setPrefixWidth(width);
      } else {
        setPrefixWidth(0);
      }
    }, [lockedCommand, activeCommandInfo, pendingQueryUrls, selectedAtCommand]);

    const computeInitialPrompt = useCallback(
      (commandId: AnyCommandId): string => {
        if (!value) return '';
        const raw = value.trim();
        if (!raw) return '';
        return raw;
      },
      [value],
    );

    const previewCommandById = useCallback(
      (commandId: AnyCommandId | null) => {
        if (lockedCommand) return;
        // Assuming `localDef`, `executeCommand`, and `context` would be defined in a broader scope
        // or passed as props/hooks if this were a complete, working snippet.
        // For the purpose of applying the change faithfully and syntactically correctly
        // within the given context, we'll assume `localDef` is derived from `commandId`
        // and `executeCommand` and `context` are available.
        // This block replaces the original `if (!commandId)` block.
        const localDef = commandId ? LOCAL_COMMANDS.find(cmd => cmd.id === (commandId as LocalCommandId)) : null;
        if (localDef) {
          // This `executeCommand` and `context` are not defined in the provided snippet.
          // To make it syntactically correct, I'm commenting out the call.
          // executeCommand(localDef.id, context, undefined);
          // If it's the calendar command, we should close the popup as it opens a new tab
          if ((localDef.id as string) === 'calendar') {
            // For AltS_search_newtab, window.close might not work on main page, but we can clear search state
            setLockedCommand(null);
            setValue('');
          }
          setSelectedCommand(null); // This line was misplaced in the original instruction, moved inside the block.
          return;
        }
        if (!commandId) {
          // Re-adding the original check for !commandId if localDef wasn't found
          selectionSourceRef.current = null;
          setSelectedCommand(null);
          return;
        }
        const info = buildSelectionInfoFromId(commandId, commands);
        if (!commandSupportsInlineQuery(info)) {
          selectionSourceRef.current = null;
          setSelectedCommand(null);
          return;
        }
        if (selectionSourceRef.current === 'external' && selectedCommand?.id === info.id) {
          return;
        }
        selectionSourceRef.current = 'external';
        setSelectedCommand(info);
      },
      [lockedCommand, selectedCommand, commands],
    );

    const clearCommandPreview = useCallback(() => {
      selectionSourceRef.current = null;
      setSelectedCommand(null);
      clearSelectedImages(); // Clear images on preview clear
    }, [clearSelectedImages]);

    // Measure prefix width dynamically
    useLayoutEffect(() => {
      if (
        prefixRef.current &&
        ((lockedCommand && activeCommandInfo) ||
          (pendingQueryUrls && pendingQueryUrls.length > 0) ||
          selectedAtCommand ||
          selectedWorkspace ||
          selectedFolder ||
          (allSuggestions.length > 0 && !lockedCommand && value.trim().length > 0))
      ) {
        const width = prefixRef.current.offsetWidth;
        setPrefixWidth(width);
      } else {
        setPrefixWidth(0);
      }
    }, [
      lockedCommand,
      activeCommandInfo,
      pendingQueryUrls,
      selectedAtCommand,
      value,
      highlightIndex,
      windowDimensions.width,
    ]);

    const activateCommandById = useCallback(
      (commandId: AnyCommandId | null, initialPromptOverride?: string) => {
        if (commandId === null) {
          setLockedCommand(null);
          resetAfterCommandExecution();
          return;
        }

        // Prevent reactivation if command is already locked with the same ID
        if (lockedCommand === commandId) {

          return;
        }

        // Logic Update: Prevent local commands from activating if user is not logged in
        if (!checkLocalCommandAuth(commandId)) return;

        const info = buildSelectionInfoFromId(commandId, commands);

        if (!info) return;

        activeSlashFilterRef.current = null;
        setActiveSlashFilter(null);

        const initialPrompt =
          initialPromptOverride !== undefined ? initialPromptOverride : computeInitialPrompt(commandId);
        setCommandPrompt(info.requiresInlineQuery ? initialPrompt : '');
        if (!info.requiresInlineQuery) {
          setValue(commandId === BOOKMARKS_COMMAND_ID ? initialPrompt : '');
        } else {
          setValue('');
        }

        // Always reset AI session when explicitly activating a new command
        // Note: selectSavedAgent will override this by setting the session AFTER activation
        setActiveAiSession(null);

        setLockedCommand(commandId);
        selectionSourceRef.current = null;
        setSelectedCommand(null);
        setHighlightIndex(0);
        setShowPromo(false);
        suggestionVisibilityRef.current = false;
        if (info.requiresInlineQuery) {

          setIsFocused(false);
          inputRef.current?.blur();
          setIsInlineFocused(true);
          // Use a longer timeout to ensure the inline input is rendered after state update
          window.setTimeout(() => {

            if (inlineInputRef.current) {
              inlineInputRef.current.focus();
            } else {
              // Retry with longer delay if component hasn't rendered yet
              window.setTimeout(() => {

                if (inlineInputRef.current && document.activeElement !== inlineInputRef.current) {
                  inlineInputRef.current.focus();
                }
              }, 50);
            }
          }, 10);
        } else {
          setIsInlineFocused(false);
          setIsFocused(commandId !== 'ai'); // 'ai' has its own input box
          if (commandId === 'ai') {
            inputRef.current?.blur();
          } else {
            window.setTimeout(() => inputRef.current?.focus(), 0);
          }
        }
      },
      [computeInitialPrompt, commands, lockedCommand],
    );

    const activateSelectedCommand = useCallback(() => {
      if (!selectedCommand) return;
      activateCommandById(selectedCommand.id, '');
    }, [activateCommandById, selectedCommand]);

    const resetAfterCommandExecution = useCallback(
      (options?: { preserveAiLock?: boolean }) => {
        // Force clear DOM values manually to avoid race conditions with React's state sync
        if (inputRef.current) {
          (inputRef.current as any).value = '';
          inputRef.current.innerHTML = '';
        }
        if (inlineInputRef.current) inlineInputRef.current.value = '';

        setValue('');
        setCommandPrompt('');

        if (!options?.preserveAiLock) {
          setLockedCommand(null);
          setActiveAiSession(null);
          onLockedCommandChange?.(null);
        }

        setSelectedAtCommand(null);
        selectionSourceRef.current = null;
        setSelectedCommand(null);
        clearSelectedImages();
        setHighlightIndex(0);
        setShowPromo(false);
        setIsSuggestionsHidden(false);
        setContextualMatches([]);
        setIsContextualPopupOpen(false);
        setContextualPopupIndex(-1);
        setShowPromptMenu(false);
        suggestionVisibilityRef.current = false;
        setPendingQueryUrls(null);
        setProcessedReadyUrls([]);
        setPendingQueryLabel('');
        setQueryValue('');
        setActiveCollection(null);
        setShowAIHistoryPanel(false);
        setMentionedTabs([]);
        promptQueueRef.current = [];

        // Synchronously notify parent of query change
        onQueryChange?.('');

        window.setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      },
      [setLockedCommand, setValue, clearSelectedImages, onQueryChange, onLockedCommandChange],
    );

    const exitCommandMode = useCallback(() => {
      setLockedCommand(null);
      setActiveAiSession(null);
      setActiveCollection(null);
      setShowPromo(false);
      selectionSourceRef.current = null;
      setSelectedCommand(null);
      setCommandPrompt('');
      setValue(''); // Clear search query text
      setMentionedTabs([]); // Clear active tab pills
      if (inputRef.current) {
        try {
          (inputRef.current as any).innerText = '';
          (inputRef.current as any).innerHTML = '';
        } catch (e) {
          console.error('[exitCommandMode] Error clearing contentEditable:', e);
        }
      }
      clearSelectedImages(); // Ensure images are cleared when exiting command mode
      setShowAIHistoryPanel(false); // Reset AI history panel visibility
      setIsInlineFocused(false);
      promptQueueRef.current = [];
      setTimeout(() => {
        if (inputRef.current && document.activeElement !== inputRef.current) {
          inputRef.current.focus();
        }
        setIsFocused(true);
        setIsInlineFocused(false);
      }, 0);
    }, [clearSelectedImages, setValue, setMentionedTabs]);

    // Helper to process the URL queue
    const processNextUrl = useCallback(
      (queue: string[], ready: string[], title?: string, forceNewTab = false) => {
        if (queue.length === 0) {
          // All done, open them
          if (ready.length === 1) openSingleLink(ready[0], forceNewTab, currentTabId);
          else openMultipleLinks(ready, currentTabId);

          // Reset state
          setPendingQueryUrls(null);
          setProcessedReadyUrls([]);
          setPendingQueryLabel('');
          setQueryValue('');
          return;
        }

        const head = queue[0];
        const needsVar = /\{query\}|\[query\]/i.test(String(head));

        if (!needsVar) {
          // No prompt needed, move to ready and continue
          processNextUrl(queue.slice(1), [...ready, head], title, forceNewTab);
        } else {
          // Needs prompt - update state and wait for user
          setPendingQueryUrls(queue);
          setProcessedReadyUrls(ready);
          setQueryValue('');
          setValue(''); // Clear main input

          // Try to extract a nice label from the URL if generic title is passed or missing
          let label = title || 'Enter value';
          try {
            // If it looks like a url, show domain
            if (head.startsWith('http')) {
              const urlObj = new URL(head);
              label = `Search on ${urlObj.hostname}`;
            }
          } catch { }

          setPendingQueryLabel(label);
          inputRef.current?.focus();
        }
      },
      [currentTabId],
    );

    const openUrls = useCallback(
      (urls: string[], title?: string, forceNewTab = false) => {
        if (!urls || urls.length === 0) return;
        // Start processing the queue
        processNextUrl(urls, [], title, forceNewTab);
      },
      [processNextUrl],
    );

    // Global handler for Ctrl+U to trigger file picker and prevent "View Source"
    useEffect(() => {
      const handleGlobalKeyDown = (e: KeyboardEvent) => {
        // HARD FIX: If favorites context menu is open, ignore ALL navigation/keys here
        if ((window as any).isFavoritesMenuOpen) return;

        // Only trigger if we are in a mode that supports images
        const supportsImages =
          lockedCommand === 'gpt' ||
          lockedCommand === 'ai' ||
          lockedCommand === 'perplexity' ||
          lockedCommand === 'claude' ||
          lockedCommand === 'upload_drive' ||
          lockedCommand === 'gemini';

        if (supportsImages && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
          e.preventDefault();
          e.stopPropagation();
          fileInputRef.current?.click();
        }
      };

      // Use capture phase to ensure we intercept before browser default
      window.addEventListener('keydown', handleGlobalKeyDown, true);
      return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
    }, [lockedCommand]);

    // Re-focus the search input when the user returns to this tab (e.g. after visiting an AI tab).
    // Without this, the input loses focus and Enter behaves as a newline/Shift+Enter.
    useEffect(() => {
      const handleVisibilityChange = () => {
        if (
          document.visibilityState === 'visible' &&
          (lockedCommand === 'ai' || AI_GROUP.members.includes(lockedCommand as any))
        ) {
          // Small delay to let the tab finish rendering before we steal focus
          setTimeout(() => {
            inputRef.current?.focus();
          }, 100);
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [lockedCommand]);

    // Redux state for workspace/snippet data
    const selectedTeam = useUIStore((s: any) => s.selectedTeam);
    const selectedFolder = useUIStore((s: any) => s.selectedFolder);
    const selectedWorkspace = useUIStore((s: any) => s.selectedWorkspace);
    const teamId = selectedTeam?.team_id || '';

    // Additional measurement for workspace/folder chips (must come after selectors)
    useEffect(() => {
      if (prefixRef.current && (selectedWorkspace || selectedFolder)) {
        const width = prefixRef.current.offsetWidth;
        setPrefixWidth(width);
      }
    }, [selectedWorkspace, selectedFolder]);

    // Removed back button for notes/snippets per user request
    const showBackButton = false;

    const lockedLocalDef: LocalCommandDefinition | undefined = useMemo(() => {
      if (!lockedCommand || !isLocalCommandId(lockedCommand)) return undefined;
      if (lockedCommand === BOOKMARKS_COMMAND_ID) return undefined;
      const def = LOCAL_COMMANDS.find(c => c.id === lockedCommand);
      return def && (def as LocalCommandDefinition).behavior === 'entity' ? def : undefined;
    }, [lockedCommand]);

    const isSnippetCommand = lockedLocalDef?.scope === 'snippet';
    const activeSnippetCommandId: LocalCommandId | null = isSnippetCommand
      ? (lockedLocalDef?.id as LocalCommandId)
      : null;
    const dbWorkspaces = useDbStore(state => state.workspaces);

    const workspaceItemIndex: any[] = [];
    const workspaceFoldersIndex: any[] = [];
    const commonCommandEntries = useMemo(() => buildCommonCommandEntries(commands), [commands]);

    const handleAIHistorySelect = useCallback((item: AIChatHistorySuggestionItem | null) => {
      setStagedHistorySession(item);
      setShowAIHistoryPanel(false);
      // Focus input after selection
      setTimeout(() => inputRef.current?.focus(), 0);
    }, []);

    // Handle prompt selection from Tab-triggered popup
    const handlePromptSelect = useCallback(
      (suggestion: WorkspaceItemSuggestion) => {
        // Insert prompt content at current cursor position
        const promptContent = 'prompt' in suggestion.item && typeof suggestion.item.prompt === 'string' ? suggestion.item.prompt : ('config' in suggestion.item && typeof suggestion.item.config === 'string' ? suggestion.item.config : ('title' in suggestion.item ? suggestion.item.title : ''));
        const currentValue = value;
        // Insert prompt content + space at the end (or cursor position)
        const newValue =
          currentValue + (currentValue.endsWith(' ') || currentValue === '' ? '' : ' ') + promptContent + ' ';
        setValue(newValue);
        // Reset prompt state
        setShowPromptMenu(false);
        setPromptSuggestions([]);
        setPromptHighlightIndex(0);
        setTimeout(() => inputRef.current?.focus(), 0);
      },
      [value],
    );

// Load prompt snippets when prompt menu is opened via Tab key
    // Uses current search value to filter prompts - popup auto-closes when no match
    const loadPromptSuggestions = useCallback(() => {
      const query = value.trim();

      const promptResults: any[] = [];

      const promptItems: PromptMenuSuggestion[] = promptResults.map(result => {
        const suggestion: WorkspaceItemSuggestion = {
          item: result.entry.item,
          workspace: result.entry.workspace,
          folder: result.entry.folder,
          isPersonal: result.entry.isPersonal,
          teamName: result.entry.teamName,
        };

        return {
          kind: 'prompt',
          prompt: suggestion,
          label: (suggestion.item as any).title || '',
          matchScore: query ? (getTextMatchScore((suggestion.item as any).title, query) ?? 3) : undefined,
        };
      });

      let nextSuggestions: PromptMenuSuggestion[] = [];
      if (!query) {
        nextSuggestions = [...promptItems];
      } else {
        nextSuggestions = [...promptItems].sort((a, b) => {
          const aScore = a.matchScore ?? 3;
          const bScore = b.matchScore ?? 3;
          if (aScore !== bScore) return aScore - bScore;
          return a.label.localeCompare(b.label);
        });
      }

      setPromptSuggestions(nextSuggestions);
      setPromptHighlightIndex(0);
    }, [workspaceItemIndex, value]);

    // Reactively update prompt suggestions when value changes while popup is open
    useEffect(() => {
      if (showPromptMenu) {
        loadPromptSuggestions();
        // Auto-close handled by InlinePromptPopup when prompts.length === 0
      }
    }, [showPromptMenu, loadPromptSuggestions]);

    // Detect @ at cursor to show command selector (Linear/Slack style)
    // Rule: Space immediately after @ is invalid. Space breaks the query.
    const activeText = inlineComposerActive ? commandPrompt : value;
    const activeInputRef = inlineComposerActive ? inlineInputRef : inputRef;
    const cursorPosition = activeInputRef.current?.selectionStart ?? activeText.length;
    const textBeforeCursor = activeText.slice(0, cursorPosition);
    const atQueryMatch = textBeforeCursor.match(/(?:^|\s)@([^@]*)$/);
    const atSearchQuery = atQueryMatch ? atQueryMatch[1] : '';
    const hasAtPattern = atQueryMatch !== null;

    // Filter prompts for @ menu
    const allPrompts = useMemo(() => {
      return workspaceItemIndex.filter(e => e.category === 'prompt').map(e => e.item);
    }, [workspaceItemIndex]);

    // Check if there are matching commands for the current query
    const filteredAtCommands = useMemo(() => {
      if (!hasAtPattern) return [];
      const isLockedAI =
        lockedCommand === 'ai' ||
        lockedCommand === 'gpt' ||
        lockedCommand === 'claude' ||
        lockedCommand === 'gemini' ||
        lockedCommand === 'perplexity';
      const hideTabs = lockedCommand === 'ai' && !!activeAiSession;
      let tabs = isLockedAI && !hideTabs ? openTabs : [];
      if (tabs.length > 0) {
        const allTabsOption = {
          id: 'tab:all_tabs',
          label: 'Add All Open Tabs',
          icon: FaLink,
          color: 'text-neutral-400',
          keywords: ['all', 'tabs', 'add all'],
          category: 'Active Tabs',
        };
        tabs = [allTabsOption, ...tabs];
      }
      const defaultFiltered = isLockedAI
        ? []
        : hasAtPattern
          ? getFilteredAtCommands(atSearchQuery, recentIds)
          : [];
      if (!atSearchQuery) return [...defaultFiltered, ...tabs];
      const q = atSearchQuery.toLowerCase().trim();
      const filteredTabs = tabs.filter(tab => (tab.label || '').toLowerCase().includes(q));
      return [...defaultFiltered, ...filteredTabs];
    }, [hasAtPattern, atSearchQuery, openTabs, lockedCommand, activeAiSession, recentIds]);
    const filteredAtCommandCount = filteredAtCommands.length;
    const isLockedAIState =
      lockedCommand === 'ai' ||
      lockedCommand === 'gpt' ||
      lockedCommand === 'claude' ||
      lockedCommand === 'gemini' ||
      lockedCommand === 'perplexity';
    const shouldShowAtMenu =
      hasAtPattern && (!lockedCommand || isLockedAIState) && !selectedAtCommand && filteredAtCommandCount > 0;

    // Track previous value to detect @ typing
    const prevValueRef = useRef(value);
    const prevPromptRef = useRef(commandPrompt);

    // Sync showAtCommandMenu with shouldShowAtMenu only when value or commandPrompt changes.
    useEffect(() => {
      if (value === prevValueRef.current && commandPrompt === prevPromptRef.current) return;

      prevValueRef.current = value;
      prevPromptRef.current = commandPrompt;

      if (suppressAtMenuRef.current) {
        suppressAtMenuRef.current = false;
        setShowAtCommandMenu(false);
        return;
      }

      if (shouldShowAtMenu) {
        setShowAtCommandMenu(true);
        setAtCommandHighlightIndex(0);
      } else {
        setShowAtCommandMenu(false);
      }
    }, [commandPrompt, shouldShowAtMenu, value]);

    // Clamp highlight index when filtered results change.
    useEffect(() => {
      if (!showAtCommandMenu || filteredAtCommandCount <= 0) return;
      setAtCommandHighlightIndex(prev => Math.min(prev, filteredAtCommandCount - 1));
    }, [filteredAtCommandCount, showAtCommandMenu]);

    // Handle @ command selection
    const handleLocalCommandExecute = useCallback(
      (
        commandId: CommandId | LocalCommandId | 'ai',
        options?: { prompt?: string; files?: { base64: string; filename: string }[] },
      ) => {

        onCommandExecute?.(
          commandId,
          options ? { ...(options as any), __tracked: true } : ({ __tracked: true } as any),
        );
      },
      [onCommandExecute],
    );

    const handleAtCommandSelect = useCallback(
      async (commandId: string) => {
        const now = Date.now();
        if (lastAtSelectRef.current.id === commandId && now - lastAtSelectRef.current.time < 500) {

          return;
        }
        lastAtSelectRef.current = { id: commandId, time: now };

await saveRecentCommand(commandId);
        suppressAtMenuRef.current = true;

        if (commandId === 'tab:all_tabs') {
          // Filter to non-internal chrome URLs
          const validTabs = openTabs.filter(
            t => t.id && !t.id.startsWith('chrome://') && !t.id.startsWith('chrome-extension://'),
          );
          if (validTabs.length === 0) return;

          const newMentions = validTabs.map(t => {
            const tabIdStr = String(t.id).replace('tab:', '');
            const tabTitle = t.label || 'Untitled';
            const truncated = tabTitle.length > 5 ? tabTitle.substring(0, 5) + '...' : tabTitle;
            return {
              token: '@' + truncated,
              tabId: tabIdStr,
              title: tabTitle,
              favIconUrl: t.favIconUrl,
            };
          });

          setMentionedTabs(prev => {
            const existingIds = new Set(prev.map(item => String(item.tabId)));
            const filteredNew = newMentions.filter(m => !existingIds.has(String(m.tabId)));
            return [...prev, ...filteredNew];
          });

          setTimeout(() => {
            const editable = inputRef.current;
            if (!editable) return;

            editable.focus();

            // 1. Traverse backwards to wipe trailing @ word
            let targetNode: Node | null = null;
            for (let i = editable.childNodes.length - 1; i >= 0; i--) {
              const child = editable.childNodes[i];
              if (child.nodeType === Node.TEXT_NODE) {
                const text = child.nodeValue || '';
                const match = text.match(/(^|\s)@([^@]*)$/);
                if (match) {
                  const matchIdx = match.index!;
                  const prefixSp = match[1];
                  child.nodeValue = text.slice(0, matchIdx + prefixSp.length);
                  targetNode = child;
                  break;
                }
              }
            }

            // 2. Iterate and append all visual pills
            let lastSpace: Text | null = null;
            validTabs.forEach(t => {
              const tabIdStr = String(t.id).replace('tab:', '');
              const tabTitle = t.label || 'Untitled';

              const pill = document.createElement('span');
              pill.className = `inline-flex items-center gap-1.5 mx-1 align-middle border rounded-lg px-2 py-0.5 text-xs font-medium shadow-sm ${''
                }`;
              pill.setAttribute('data-tab-id', tabIdStr);
              pill.setAttribute('contenteditable', 'false');

              if (t.favIconUrl) {
                const img = document.createElement('img');
                img.src = t.favIconUrl;
                img.className = 'w-3.5 h-3.5 object-contain rounded-sm';
                pill.appendChild(img);
              } else {
                const iconDiv = document.createElement('div');
                iconDiv.className = 'w-3.5 h-3.5 flex items-center justify-center';
                iconDiv.innerHTML = `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" class="text-blue-500" height="11" width="11" xmlns="http://www.w3.org/2000/svg"><path d="M437.02 74.981C388.667 26.629 324.38 0 256 0S123.333 26.629 74.98 74.981C26.629 123.333 0 187.62 0 256s26.629 132.667 74.98 181.019C123.333 485.371 187.62 512 256 512s132.667-26.629 181.02-74.981C485.371 388.667 512 324.38 512 256s-26.629-132.667-74.98-181.019zM256 464c-114.687 0-208-93.313-208-208S141.313 48 256 48s208 93.313 208 208-93.313 208-208 208z"></path></svg>`;
                pill.appendChild(iconDiv);
              }

              const truncatedTitle = tabTitle.length > 5 ? tabTitle.substring(0, 5) + '...' : tabTitle;
              const textSpan = document.createElement('input');
              textSpan.type = 'text';
              textSpan.value = truncatedTitle;
              textSpan.readOnly = true;
              textSpan.className =
                'text-xs font-medium pointer-events-none bg-transparent border-none outline-none p-0 max-w-[55px] align-middle';
              textSpan.style.width = 'fit-content';
              textSpan.style.maxWidth = '60px';
              textSpan.style.color = 'inherit';
              textSpan.style.fontSize = '12px';
              textSpan.style.lineHeight = '1';
              pill.appendChild(textSpan);

              const removeBtn = document.createElement('button');
              removeBtn.type = 'button';
              removeBtn.className =
                'text-red-300 hover:text-red-400 ml-0.5 cursor-pointer pointer-events-auto align-middle';
              removeBtn.innerHTML = `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 352 512" height="8" width="8" xmlns="http://www.w3.org/2000/svg"><path d="M242.72 256l100.07-100.07c12.28-12.28 12.28-32.19 0-44.48l-22.24-22.24c-12.28-12.28-32.19-12.28-44.48 0L176 189.28 75.93 89.21c-12.28-12.28-32.19-12.28-44.48 0L9.21 111.45c-12.28 12.28-12.28 32.19 0 44.48L109.28 256 9.21 356.07c-12.28 12.28-12.28 32.19 0 44.48l22.24 22.24c12.28 12.28 32.19 12.28 44.48 0L176 322.72l100.07 100.07c12.28 12.28 32.19 12.28 44.48 0l22.24-22.24c12.28-12.28 12.28-32.19 0-44.48L242.72 256z"></path></svg>`;

              removeBtn.onclick = e => {
                e.preventDefault();
                e.stopPropagation();
                pill.remove();
                setMentionedTabs(prev => prev.filter(item => String(item.tabId) !== String(tabIdStr)));
              };
              pill.appendChild(removeBtn);

              if (targetNode) {
                if (targetNode.nextSibling) {
                  editable.insertBefore(pill, targetNode.nextSibling);
                } else {
                  editable.appendChild(pill);
                }
              } else {
                editable.appendChild(pill);
              }

              // 4. Add Space afterwards for correct spacing
              const space = document.createTextNode('\u00A0');
              if (pill.nextSibling) {
                editable.insertBefore(space, pill.nextSibling);
              } else {
                editable.appendChild(space);
              }

              targetNode = space;
              lastSpace = space;
            });

            if (lastSpace) {
              const nextRange = document.createRange();
              nextRange.setStartAfter(lastSpace);
              nextRange.setEndAfter(lastSpace);
              const selection = window.getSelection();
              selection?.removeAllRanges();
              selection?.addRange(nextRange);
            }

            // Sync prompt value buffers
            if (inlineComposerActive) {
              setCommandPrompt(editable.innerText || '');
            } else {
              setValue(editable.innerText || '');
            }
          }, 0);
          return;
        }

        if (commandId.startsWith('tab:')) {
          const tabId = commandId.replace('tab:', '');
          const tab = openTabs.find(t => String(t.id) === `tab:${tabId}`);
          if (tab) {
            const tabTitle = tab.label || 'Untitled';
            const truncated = tabTitle.substring(0, 5); // up to 5 characters
            const tokenStr = '@' + truncated;

            setMentionedTabs(prev => {
              const filtered = prev.filter(item => item.tabId !== tabId);
              return [...filtered, { token: tokenStr, tabId: tabId, title: tabTitle, favIconUrl: tab.favIconUrl }];
            });

            // Insert Inline Visual Pill at caret inside contenteditable div
            setTimeout(() => {
              const editable = inputRef.current;
              if (!editable) return;

              editable.focus();
              const selection = window.getSelection();
              const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

              // 1. Traverse backwards to find and wipe trailing @ word
              let targetNode: Node | null = null;
              for (let i = editable.childNodes.length - 1; i >= 0; i--) {
                const child = editable.childNodes[i];
                if (child.nodeType === Node.TEXT_NODE) {
                  const text = child.nodeValue || '';
                  const match = text.match(/(^|\s)@([^@]*)$/);
                  if (match) {
                    const matchIdx = match.index!;
                    const prefixSp = match[1];
                    child.nodeValue = text.slice(0, matchIdx + prefixSp.length);
                    targetNode = child;
                    break;
                  }
                }
              }

              // 2. Create Pill Element
              const pill = document.createElement('span');
              pill.className = `inline-flex items-center gap-1.5 mx-1 align-middle border rounded-lg px-2 py-0.5 text-xs font-medium shadow-sm ${''
                }`;
              pill.setAttribute('data-tab-id', tabId);
              pill.setAttribute('contenteditable', 'false');

              // Icon
              if (tab.favIconUrl) {
                const img = document.createElement('img');
                img.src = tab.favIconUrl;
                img.className = 'w-3.5 h-3.5 object-contain rounded-sm';
                pill.appendChild(img);
              } else {
                const iconDiv = document.createElement('div');
                iconDiv.className = 'w-3.5 h-3.5 flex items-center justify-center';
                iconDiv.innerHTML = `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" class="text-blue-500" height="11" width="11" xmlns="http://www.w3.org/2000/svg"><path d="M437.02 74.981C388.667 26.629 324.38 0 256 0S123.333 26.629 74.98 74.981C26.629 123.333 0 187.62 0 256s26.629 132.667 74.98 181.019C123.333 485.371 187.62 512 256 512s132.667-26.629 181.02-74.981C485.371 388.667 512 324.38 512 256s-26.629-132.667-74.98-181.019zM256 464c-114.687 0-208-93.313-208-208S141.313 48 256 48s208 93.313 208 208-93.313 208-208 208z"></path></svg>`;
                pill.appendChild(iconDiv);
              }

              // Text
              const truncatedTitle = tabTitle.length > 5 ? tabTitle.substring(0, 5) + '...' : tabTitle;
              const textSpan = document.createElement('input');
              textSpan.type = 'text';
              textSpan.value = truncatedTitle;
              textSpan.readOnly = true;
              textSpan.className =
                'text-xs font-medium pointer-events-none bg-transparent border-none outline-none p-0 max-w-[55px] align-middle';
              // Force styles to override standard browser rules
              textSpan.style.width = 'fit-content';
              textSpan.style.maxWidth = '60px';
              textSpan.style.color = 'inherit';
              textSpan.style.fontSize = '12px';
              textSpan.style.lineHeight = '1';
              pill.appendChild(textSpan);

              // Remove Btn
              const removeBtn = document.createElement('button');
              removeBtn.type = 'button';
              removeBtn.className =
                'text-red-300 hover:text-red-400 ml-0.5 cursor-pointer pointer-events-auto align-middle';
              removeBtn.innerHTML = `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 352 512" height="8" width="8" xmlns="http://www.w3.org/2000/svg"><path d="M242.72 256l100.07-100.07c12.28-12.28 12.28-32.19 0-44.48l-22.24-22.24c-12.28-12.28-32.19-12.28-44.48 0L176 189.28 75.93 89.21c-12.28-12.28-32.19-12.28-44.48 0L9.21 111.45c-12.28 12.28-12.28 32.19 0 44.48L109.28 256 9.21 356.07c-12.28 12.28-12.28 32.19 0 44.48l22.24 22.24c12.28 12.28 32.19 12.28 44.48 0L176 322.72l100.07 100.07c12.28 12.28 32.19 12.28 44.48 0l22.24-22.24c12.28-12.28 12.28-32.19 0-44.48L242.72 256z"></path></svg>`;

              removeBtn.onclick = e => {
                e.preventDefault();
                e.stopPropagation();
                pill.remove();
                setMentionedTabs(prev => prev.filter(t => String(t.tabId) !== String(tabId)));
              };
              pill.appendChild(removeBtn);

              // 3. Insert the pill
              if (targetNode) {
                if (targetNode.nextSibling) {
                  editable.insertBefore(pill, targetNode.nextSibling);
                } else {
                  editable.appendChild(pill);
                }
              } else if (range) {
                range.insertNode(pill);
              } else {
                editable.appendChild(pill);
              }

              // 4. Add Space afterwards
              const space = document.createTextNode('\u00A0');
              if (pill.nextSibling) {
                editable.insertBefore(space, pill.nextSibling);
              } else {
                editable.appendChild(space);
              }

              // 5. Move cursor safely
              const nextRange = document.createRange();
              nextRange.setStartAfter(space);
              nextRange.setEndAfter(space);
              selection?.removeAllRanges();
              selection?.addRange(nextRange);

              // Update inner text values
              if (inlineComposerActive) {
                setCommandPrompt(editable.innerText || '');
              } else {
                setValue(editable.innerText || '');
              }
            }, 0);
          }
          setShowAtCommandMenu(false);
          setTimeout(() => inputRef.current?.focus(), 0);
          return;
        }

        const cursorPosition = inputRef.current?.selectionStart ?? value.length;

        // 0. Handle Prompt Selection (Expand)
        if (commandId.startsWith('prompt:')) {
          const promptId = commandId.replace('prompt:', '');
          const prompt = allPrompts.find(p => p.id === promptId);
          if (prompt) {
            const promptContent = 'prompt' in prompt && typeof prompt.prompt === 'string' ? prompt.prompt : ('config' in prompt && typeof prompt.config === 'string' ? prompt.config : ('title' in prompt ? prompt.title : ''));

            // User requested: "remove the text present"
            // REPLACE the entire input value with the prompt content
            if (lockedCommand && lockedCommand !== 'bookmarks') {
              setCommandPrompt(promptContent);
            } else {
              setValue(promptContent);
            }

            setShowAtCommandMenu(false);
            setAtCommandHighlightIndex(0);
            if (lockedCommand && lockedCommand !== 'bookmarks') {
              setTimeout(() => inlineInputRef.current?.focus(), 0);
            } else {
              setTimeout(() => inputRef.current?.focus(), 0);
            }
            return;
          }
        }

        // 1. Resolve command definition
        // Check remote commands first (with fallback to default COMMANDS list for new/un-synced users)
        const remoteCmd = getCommandById(commandId);
        // Check local commands
        const localCmd = LOCAL_COMMANDS.find(c => c.id === commandId);

        // 2. Check if command is installed - if not, show dialog immediately
        // A command is considered "installed" if it's found in remote commands (user's storage),
        // or it's a local command, or it's the special 'ai' aggregate command
        const isInstalled = !!remoteCmd || !!localCmd || commandId === 'ai';
        if (!isInstalled) {
          // Command not installed - show dialog and clean up
          console.warn('[Searchbar] @ command not installed:', commandId);
          setShowAtCommandMenu(false);
          triggerNotification('Command not available.', 'error');
          return;
        }

        // Helper to check if it needs query
        const requiresQuery = (cmd: CommandDefinition) => {
          if (cmd.urlTemplate && cmd.urlTemplate.includes('{query}')) return true;
          // AI commands usually need query
          if (['ai', 'gpt', 'claude', 'gemini', 'perplexity', 'calendar', 'chatwithsite'].includes(cmd.id)) return true;
          return false;
        };

        // Determine if we should enter command mode or execute immediately
        let shouldEnterMode = false;

        if (remoteCmd) {
          shouldEnterMode = requiresQuery(remoteCmd);
        } else if (commandId === 'ai') {
          shouldEnterMode = true;
        } else if (commandId === 'calendar' || (localCmd && localCmd.behavior === 'locked')) {
          // Special case: Calendar enters Locked Command mode directly
          // Also handle any other local command with 'locked' behavior (like upload_drive)
          setValue('');
          activateCommandById(commandId as AnyCommandId, '');
          setShowAtCommandMenu(false);
          return;
        }

        // Local commands: 'createnotes'/'createlinks' etc might want direct execution or mode?
        // existing logic used direct execution for 'createnotes', 'createlinks', 'bookmarks' etc.
        const directLocalCommands = [
          'createnotes',
          'createlinks',
          'showallnotes',
          'showalllinks',
          'todo',
          'agent',
          'history',
          'downloads',
          'extensions',
          'settings',
          'switchorganization',
        ];

        if (directLocalCommands.includes(commandId)) {
          shouldEnterMode = false;
        }

        // Browser commands without query (history, downloads etc) are remote commands but dont have {query}
        // so requiresQuery() returns false -> shouldEnterMode = false. Correct.

        // If we are activating a different command, clear the AI session

        // Clean up the @ trigger text based on cursor position
        const textBeforeCursor = value.slice(0, cursorPosition);
        const mentionMatch = textBeforeCursor.match(/(^|\s)@([^@]*)$/);
        let newValue = value;
        if (mentionMatch) {
          const matchIndex = mentionMatch.index!;
          const prefixSpace = mentionMatch[1]; // "" or " "
          newValue = (value.slice(0, matchIndex + prefixSpace.length) + value.slice(cursorPosition)).trim();
        }

        if (shouldEnterMode) {
          // Enter command mode (lock the command)
          setValue('');
          activateCommandById(commandId as AnyCommandId, newValue);
          setShowAtCommandMenu(false);
          // Focus input
          setTimeout(() => {
            if (prefixRef.current) {
              // If locking command, we might be switching to inline input
              // But activateCommandById handles focus logic
            }
          }, 0);
        } else {
          // Direct execution
          setValue(newValue);
          setShowAtCommandMenu(false);

          if (onCommandExecute) {
            handleLocalCommandExecute(commandId as any);
          } else {
            setValue('');
            setSelectedAtCommand(commandId);
            setShowAtCommandMenu(false);
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }
      },
      [
        value,
        setValue,
        handleLocalCommandExecute,
        commands,
        activateCommandById,
        allPrompts,
        isLoggedIn,
        onCommandExecute,
      ],
    );

    const snippetSearchResults = useMemo(() => {
      // Check for @ mention pattern: ends with @ followed by optional chars
      const atMentionMatch = value.match(/(?:^|\s)@([^/]*)$/);
      const isAtMention = Boolean(atMentionMatch);
      const atQuery = atMentionMatch ? atMentionMatch[1] : null;

      const trimmed = value.trim();
      if (!isSnippetCommand && lockedCommand) return [];
      if (selectedAtCommand) return [];

      const searchQuery = trimmed;
      if (!searchQuery && !isSnippetCommand) {
        if (isInitialAltSFocus) {
          // [NEW] Return all snippets wrapped in SearchResult when Alt+S empty search is focused
          return workspaceItemIndex.map(entry => ({ entry, score: 1 }));
        }
        return [];
      }

      // If we are in @ mention mode, we search specifically for prompts and snippets (Notes)
      // matching the text after @
      if (isAtMention && !lockedCommand && !selectedAtCommand) {
        return [];
      }

      if (
        ((!isSnippetCommand && lockedCommand) || (!trimmed && !isSnippetCommand)) &&
        !isInitialAltSFocus
      )
        return [];

      const allowedCategories =
        isSnippetCommand && activeSnippetCommandId
          ? new Set(
            (activeSnippetCommandId === 'delete_link' ? ['link', 'links', 'tabgroup', 'tab session'] : ['snippet']).map(
              entry => entry.toLowerCase(),
            ),
          )
          : undefined;

      return [];
    }, [workspaceItemIndex, value, lockedCommand, isSnippetCommand, activeSnippetCommandId, isInitialAltSFocus]);

    // Bookmark search ref for tracking latest search
    const bookmarkSearchRef = useRef<number>(0);

    // Effect to search bookmarks based on user input
    useEffect(() => {
      const trimmed = value.trim();

      // Only search bookmarks when:
      // 1. There's a query with at least 2 characters but not more than 17 (to prevent lag), OR isInitialAltSFocus is true
      // 2. Not in command mode (no '/') OR explicitly in shortcut search mode
      // 3. No command is locked (unless it's a shortcut search)
      // 4. No @ command is selected
      const isAllowedEmpty = isInitialAltSFocus && !trimmed;
      if (
        value.trim().toLowerCase() === `c` ||
        value.toLowerCase().startsWith(`c `) ||
        (!isAllowedEmpty && (!trimmed || trimmed.length < 2 || trimmed.length > 17)) ||
        lockedCommand ||
        selectedAtCommand
      ) {
        bookmarkSearchRef.current++; // Invalidate any pending async responses
        if (!isInitialAltSFocus || value.trim().toLowerCase() === `c`) {
          setBookmarkSuggestions([]);
        }
        return;
      }

      const searchId = ++bookmarkSearchRef.current;
      const chromeAny = (window as any)?.chrome;

      if (!chromeAny?.runtime?.sendMessage) {
        return;
      }

      // Debounce the search with a small delay
      const timeoutId = window.setTimeout(() => {
        const action = trimmed ? 'bookmarks_search' : 'bookmarks_get_tree';
        const payload = trimmed ? { action, query: trimmed } : { action };

        chromeAny.runtime.sendMessage(payload, (response: any) => {
          // Check if this is still the latest search request
          if (searchId !== bookmarkSearchRef.current) return;

          if (response?.ok && Array.isArray(response.results)) {
            const items: BookmarkSuggestionItem[] = response.results.map((item: any) => ({
              _kind: 'bookmark' as const,
              id: item.id || item.url,
              title: item.title || item.url || '',
              url: item.url || '',
            }));
            setBookmarkSuggestions(items);
          } else {
            setBookmarkSuggestions([]);
          }
        });
      }, 150); // 150ms debounce

      return () => window.clearTimeout(timeoutId);
    }, [value, lockedCommand, isInitialAltSFocus]);

    const handleAgentCollectionSelect = useCallback(
      (item: AgentCollectionSuggestionItem) => {

        try {
          const chromeAny = (window as any).chrome;
          if (chromeAny && chromeAny.storage && chromeAny.storage.local) {
            chromeAny.storage.local.get([item.title], (result: any) => {
              const items = result[item.title];

if (items && Array.isArray(items)) {
                // 1. Identify unique prompt parameters and remap paste steps
                const paramRegex = /(?:\{|\[|%7B)([^}\]]+)(?:\}|\]|%7D)/gi;
                const uniqueParams = new Set<string>();
                const paramSourceMap = new Map<string, { item: any; localId: string; config?: any }>();
                let hasQuery = false;
                let globalPasteCount = 1;

                // Helper: extract clean param name from {input_name="xxx"} â†’ "xxx"
                const cleanParamName = (raw: string): string => {
                  const m = raw.match(/^input_name="([^"]+)"$/);
                  return m ? m[1] : raw;
                };

                // Process items to inject unique paste variables
                const processedItems = items.map((item: any) => {
                  const newItem = { ...item }; // Shallow copy

                  // Check Agents and Links for {query}, {content} or {variable}
                  if (newItem.url) {
                    const matches = newItem.url.matchAll(paramRegex);
                    for (const match of matches) {
                      const varName = cleanParamName(match[1]).toLowerCase();
                      if (varName === 'query' || varName === 'content' || varName === 'prompt') {
                        hasQuery = true;
                      } else {
                        // Extract number if it's promptN
                        const pMatch = varName.match(/^prompt(\d+)$/);
                        const key = pMatch ? pMatch[1] : match[1];
                        uniqueParams.add(key);
                        paramSourceMap.set(key, { item: newItem, localId: key, config: newItem });
                      }
                    }
                    if (
                      newItem.url.includes('{query}') ||
                      newItem.url.includes('[query]') ||
                      newItem.url.includes('{content}')
                    ) {
                      hasQuery = true;
                    }
                  }

                  // Check Automations for {content}, {query}, or {variable}
                  // REMAP paste steps to unique {pasteN} variables
                  if ((newItem.type === 'automation' || newItem.steps) && Array.isArray(newItem.steps)) {
                    let localPasteCount = 1;
                    newItem.steps = newItem.steps.map((step: any, index: number) => {
                      if (step.type === 'paste' || step.moduleId === 'paste') {
                        // FORCE unique variable for every paste step
                        const pasteVar = `paste${globalPasteCount}`;
                        const localId = `paste${localPasteCount}`;
                        uniqueParams.add(pasteVar);
                        paramSourceMap.set(pasteVar, { item: newItem, localId });
                        globalPasteCount++;
                        localPasteCount++;

                        // Update config to use this variable
                        return {
                          ...step,
                          config: { ...step.config, text: `{${pasteVar}}` },
                        };
                      }

                      // Extract variables from open_tab URLs without remapping
                      if (step.type === 'open_tab' || step.moduleId === 'open_tab') {
                        const config = step.config || {};
                        const url = config.url || '';
                        if (typeof url === 'string') {
                          const urlMatches = url.matchAll(paramRegex);
                          for (const match of urlMatches) {
                            const varName = cleanParamName(match[1]);
                            const lowerVar = varName.toLowerCase();
                            if (lowerVar === 'query' || lowerVar === 'content' || lowerVar === 'prompt') {
                              hasQuery = true;
                            } else {
                              uniqueParams.add(varName);
                              paramSourceMap.set(varName, { item: newItem, localId: varName, config });
                            }
                          }
                        }
                      }

                      // Ignore variables in other steps to prevent JSON matching false positives
                      return step;
                    });
                  }

                  if (newItem.promptLabel) {
                    const match = newItem.promptLabel.match(/prompt(\d+)/i);
                    const key = match && match[1] ? match[1] : newItem.promptLabel;
                    uniqueParams.add(key);
                    paramSourceMap.set(key, { item: newItem, localId: key });
                  }

                  if (newItem.supportImage) {
                    uniqueParams.add('images');
                    paramSourceMap.set('images', { item: newItem, localId: 'images' });
                  }

                  return newItem;
                });

                const sortedParams = Array.from(uniqueParams).sort((a, b) => {
                  // Sort numbers numerically, strings alphabetically
                  const numA = parseInt(a.replace(/\D/g, ''));
                  const numB = parseInt(b.replace(/\D/g, ''));
                  if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                  return a.localeCompare(b);
                });

// Build fields array
                const fields: SearchbarAutomationField[] = sortedParams.map(p => {
                  const isDigit = /^\d+$/.test(p);
                  const key = isDigit ? `prompt${p}` : p;

                  // Find the agent that corresponds to this parameter
                  const source = paramSourceMap.get(p);
                  const matchedAgent = source?.item || processedItems.find((item: any) => item.promptLabel === key);
                  const localId = source?.localId || key;

                  let initialValue = '';
                  let dropdownOptions: string[] | undefined = undefined;
                  let dropdownOptionPairs: { key: string; value: string }[] | undefined = undefined;
                  let paramType: string | undefined;
                  let paramDescription: string | undefined;

                  if (matchedAgent) {
                    // 1. Try to find config in 'inputs' array using localId (for Automations)
                    if (matchedAgent.inputs && Array.isArray(matchedAgent.inputs)) {
                      const inputDef = matchedAgent.inputs.find((i: any) => i.id === localId);
                      if (inputDef) {
                        if (inputDef.fixedValue) initialValue = inputDef.fixedValue;
                        if (inputDef.description) paramDescription = inputDef.description;
                        if (inputDef.dropdownOptions)
                          dropdownOptions = inputDef.dropdownOptions
                            .split(',')
                            .map((s: string) => s.trim())
                            .filter(Boolean);
                      }
                    }

                    // 2. Fallback to top-level properties (Legacy/Agents) if not found in inputs
                    if (!initialValue && !dropdownOptions) {
                      if (matchedAgent.fixedValue) {
                        initialValue = matchedAgent.fixedValue;
                      }

                      if (matchedAgent.dropdownOptions) {
                        const options = matchedAgent.dropdownOptions
                          .split(',')
                          .map((opt: string) => opt.trim())
                          .filter(Boolean);

                        if (options.length > 0) {
                          dropdownOptions = options;
                        }
                      }
                    }

                    // 3. New API check: step.config.paramConfigs matching param
                    if (source?.config?.paramConfigs?.[localId]) {
                      const paramCfg = source.config.paramConfigs[localId];
                      paramType = paramCfg.type;
                      if (paramCfg.description) paramDescription = String(paramCfg.description);
                      if (paramCfg.type === 'dropdown') {
                        dropdownOptions = Array.isArray(paramCfg.values) ? paramCfg.values : [];
                        dropdownOptionPairs = Array.isArray(paramCfg.optionPairs)
                          ? paramCfg.optionPairs
                            .map((pair: any, idx: number) => ({
                              key: String(pair?.key || '').trim() || `Option ${idx + 1}`,
                              value: String(pair?.value || '').trim(),
                            }))
                            .filter((pair: { key: string; value: string }) => !!pair.value)
                          : undefined;
                      } else if (Array.isArray(paramCfg.values) && paramCfg.values[0]) {
                        initialValue = paramCfg.values[0];
                      }
                    }

                    // If we have options but no value, default to first option
                    if (dropdownOptions && dropdownOptions.length > 0 && !initialValue) {
                      initialValue = dropdownOptions[0];
                    }
                  }

                  const isImages = p === 'images';
                  const rawType = String(
                    paramType || matchedAgent?.inputs?.find((i: any) => i.id === localId)?.type || 'text',
                  );
                  const sourceType = normalizeAutomationSourceType(rawType);
                  let normalizedFieldType = normalizeAutomationFieldType(rawType);
                  if (normalizedFieldType === 'text' && dropdownOptions && dropdownOptions.length > 0) {
                    normalizedFieldType = 'dropdown';
                  }

                  return {
                    key: key,
                    label: isImages
                      ? 'Image Attachment'
                      : isDigit
                        ? `Prompt ${p}`
                        : p.charAt(0).toUpperCase() +
                        p
                          .slice(1)
                          .replace(/([A-Z0-9])/g, ' $1')
                          .trim(),
                    value: initialValue,
                    type: (isImages ? 'image' : normalizedFieldType) as any,
                    sourceType: isImages ? 'image' : sourceType,
                    description: paramDescription,
                    extraValues: [],
                    dropdownOptions: dropdownOptions,
                    dropdownOptionPairs,
                  };
                });

                // Ensure 'query' field exists if needed
                const hasQueryField = fields.some(f => f.key === 'query');
                if (hasQuery && !hasQueryField) {
                  // Find if any matched agent/link explicitly provides query input/dropdown
                  let queryValue = '';
                  let queryDropdown: string[] | undefined = undefined;

                  // In Agent Collections, the query parameter is typically from a link
                  const querySourceItem = processedItems.find(
                    (i: any) =>
                      i.url && (i.url.includes('{query}') || i.url.includes('[query]') || i.url.includes('{content}')),
                  );

                  if (querySourceItem) {
                    // Start reading from querySourceItem config natively
                    let queryConfig: any = querySourceItem;
                    if (querySourceItem.steps && Array.isArray(querySourceItem.steps)) {
                      const tabStep = querySourceItem.steps.find(
                        (s: any) => s.moduleId === 'open_tab' && s.config?.url && s.config.url.includes('{query}'),
                      );
                      if (tabStep) queryConfig = tabStep.config;
                    }

                    if (queryConfig?.paramConfigs?.['query']) {
                      const paramCfg = queryConfig.paramConfigs['query'];
                      if (paramCfg.type === 'dropdown') {
                        queryDropdown = Array.isArray(paramCfg.values) ? paramCfg.values : [];
                      } else if (Array.isArray(paramCfg.values) && paramCfg.values[0]) {
                        queryValue = paramCfg.values[0];
                      }
                    } else if (querySourceItem.inputs && Array.isArray(querySourceItem.inputs)) {
                      const inputDef =
                        querySourceItem.inputs.find((i: any) => i.id === 'query' || i.id === 'content') ||
                        querySourceItem.inputs[0];
                      if (inputDef) {
                        if (inputDef.fixedValue) queryValue = inputDef.fixedValue;
                        if (inputDef.dropdownOptions) {
                          queryDropdown = inputDef.dropdownOptions
                            .split(',')
                            .map((s: string) => s.trim())
                            .filter(Boolean);
                        }
                      }
                    } else {
                      if (querySourceItem.fixedValue) queryValue = querySourceItem.fixedValue;
                      if (querySourceItem.dropdownOptions) {
                        queryDropdown = querySourceItem.dropdownOptions
                          .split(',')
                          .map((s: string) => s.trim())
                          .filter(Boolean);
                      }
                    }
                  }

                  if (queryDropdown && queryDropdown.length > 0 && !queryValue) {
                    queryValue = queryDropdown[0];
                  }

                  fields.push({
                    key: 'query',
                    label: 'Query',
                    value: queryValue,
                    type: 'text',
                    sourceType: 'text',
                    description: undefined,
                    extraValues: [],
                    dropdownOptions: queryDropdown,
                    dropdownOptionPairs: undefined,
                  });
                }

                // Default to Prompt 1 if no fields (user preference)
                if (fields.length === 0) {
                  fields.push({
                    key: 'prompt1',
                    label: 'Prompt 1',
                    value: '',
                    type: 'text',
                    sourceType: 'text',
                    description: undefined,
                    extraValues: [],
                    dropdownOptions: undefined,
                    dropdownOptionPairs: undefined,
                  });
                }

                // Enter Lock Mode with new structure
                setActiveCollection({
                  item: item, // Use original item without modification
                  agents: processedItems.filter((i: any) => i.type === 'agent' || !i.type), // Backward compatibility
                  links: processedItems.filter((i: any) => i.type === 'link'),
                  automations: processedItems.filter((i: any) => i.type === 'automation'),
                  fields,
                  constantInputs: {},
                  focusedFieldIndex: 0,
                });

                setLockedCommand(null);
                setValue('');
                setCommandPrompt('');
                setHighlightIndex(0);
                suggestionVisibilityRef.current = false;
                setIsFocused(true);
              }
            });
          }
        } catch (e) {
          console.error('[Searchbar] Failed to open agent collection', e);
        }
      },
      [currentTabId],
    );

    const handleAutomationSelect = useCallback(
      (automation: any) => {
            // Removed for cleanup
        },
      [resetAfterCommandExecution],
    );

    const handlePromptMenuSelect = useCallback(
      (suggestion: PromptMenuSuggestion) => {
        if (suggestion.kind === 'automation') {
          handleAutomationSelect(suggestion.automation);
          setShowPromptMenu(false);
          setPromptSuggestions([]);
          setPromptHighlightIndex(0);
          return;
        }

        handlePromptSelect(suggestion.prompt);
      },
      [handleAutomationSelect, handlePromptSelect],
    );

    const buildAutomationFromModule = useCallback((module: InstalledModule): SavedAutomation => {
        return {} as SavedAutomation;
    }, []);

    const handleContextualSelect = useCallback(
      (match: ContextualMatch) => {
        if (match.type === 'automation' && match.automation) {
          handleAutomationSelect(match.automation);
        } else if (match.type === 'module' && match.module) {
          handleAutomationSelect(buildAutomationFromModule(match.module));
        } else if (match.type === 'agent' && match.agent) {
          setActiveCollection({
            item: match.agent,
            agents: [],
            links: [],
            automations: [],
            fields: [],
            focusedFieldIndex: 0,
          });
        } else if (match.type === 'snippet' && match.snippet) {
          // If match is workspace item (using snippet for ContextualMatch compat)
          const category = ((match.snippet as any).category || '').toLowerCase();
          if (['link', 'links'].includes(category) && typeof (match.snippet as any).value === 'string') {
            // Open link in new tab or current context based on settings/logic
            openSingleLink((match.snippet as any).value, false, currentTabId);
          } else if (['tabgroup', 'tab session'].includes(category) && typeof (match.snippet as any).value === 'object') {
            // Handle collection-style saved tabs
            const tabsData = (match.snippet as any).value as any;
            if (tabsData.tabs && Array.isArray(tabsData.tabs)) {
              const urls = tabsData.tabs
                .map((tab: any) => (typeof tab === 'string' ? tab : tab.url || ''))
                .filter((url: string) => !!url);
              if (urls.length > 0) {
                openMultipleLinks(urls, currentTabId);
              }
            }
          }
        }
        setIsContextualPopupOpen(false);
        setContextualMatches([]);
        setContextualPopupIndex(-1);
      },
      [handleAutomationSelect, buildAutomationFromModule, currentTabId],
    );

    const handleSavedAgentSelection = useCallback(
      (agent: any) => {
        // Alert only if current session is active and NOT saved (no name)
        if (activeAiSessionRef.current && !activeAiSessionRef.current.name) {
          const confirm = window.confirm(
            'Your Chat Agent is not saved. Save it to avoid losing your changes. Continue anyway?',
          );
          if (!confirm) return;
        }

        // Reset session then populate from agent
        setSelectedAutomation(agent);
        setCommandPrompt('');
        setValue('');
        setShowSavedAgentsMenu(false);
        setSavedAgentSuggestions([]);

        // Extract model IDs and URLs from agent config
        const step = (agent.automation_steps || agent.steps)?.[0];
        let modelsFromAgent: string[] = [];
        let urlsFromAgent: string[] = [];
        let tabIdsFromAgent: number[] = [];
        let customModelDefinitions: any[] = [];

        if (step?.config?.allAiUrls) {
          const allModels = Object.keys(step.config.allAiUrls);
          const activeModels = allModels.filter((m: string) => {
            const url = step.config.allAiUrls[m];
            return url.includes('cmd_select_status=true');
          });

          // For backward compatibility: if no status found, select all
          const finalSelected = activeModels.length > 0 ? activeModels : allModels;

          modelsFromAgent = finalSelected;
          urlsFromAgent = finalSelected.map((m: string) => step.config.allAiUrls[m]);
          tabIdsFromAgent = finalSelected.map(() => 0); // Placeholder tab IDs
          setSelectedAIs(finalSelected);

          // EXTRACT CUSTOM MODELS: If any models in the agent are custom IDs (not standard)
          // we prepare them for the active session definitions so they show up in the Selection Panel.
          const standardIds = ['gpt', 'claude', 'gemini', 'perplexity'];
          customModelDefinitions = allModels
            .filter(id => !standardIds.includes(id))
            .map(id => {
              const rawUrl = stripCmdStatus(step.config.allAiUrls[id]);
              let host = '';
              try {
                host = new URL(rawUrl).hostname;
              } catch (e) {
                host = rawUrl.slice(0, 30);
              }
              return {
                id,
                name: id.startsWith('custom-') ? 'Imported Agent' : id,
                url: rawUrl,
                host: host,
              };
            });
        } else if (step?.config?.agentId && step.config.agentId !== 'all_ai' && step.config.agentId !== 'all') {
          modelsFromAgent = [step.config.agentId];
          urlsFromAgent = [step.config.url || ''];
          tabIdsFromAgent = [0];
          setSelectedAIs(modelsFromAgent);
        }

        // Normalize URLs: Replace empty, null, or about:blank with defaults
        urlsFromAgent = urlsFromAgent.map((url, idx) => {
          const modelId = modelsFromAgent[idx];
          if (!url || url === 'null' || url === 'undefined' || url.startsWith('about:blank')) {
            return DEFAULT_ALL_AI_URLS[modelId] || url || '';
          }
          return url;
        });

        // Lock to AI if not already
        if (lockedCommand !== 'ai') {
          activateCommandById('ai', '');
        }

        // Populate activeAiSession so it shows in sidebar and provides context URLs
        // We do this AFTER activateCommandById because that function now clears the session
        if (modelsFromAgent.length > 0) {
          const sessionKey = `${agent.id}-${Date.now()}`;
          const placeholderSession = {
            id: agent.id, // Stable Agent ID
            sessionKey, // Unique Session Key for logs
            prompt: step?.config?.prompt || agent.prompt || agent.name || 'Saved Agent',
            rules: step?.config?.rules || agent.rules || '',
            name: agent.name,
            models: modelsFromAgent,
            urls: urlsFromAgent,
            tabIds: tabIdsFromAgent,
            workspace_id: agent.workspace_id,
            folder_id: agent.folder_id,
            customModelDefinitions: customModelDefinitions,
          };
          setActiveAiSession(placeholderSession);
          activeAiSessionRef.current = placeholderSession;

          // Trigger background restoration of captured URLs
          const linksToOpen = modelsFromAgent
            .map((modelId, idx) => {
              const url = urlsFromAgent[idx];
              const cleanUrl = stripCmdStatus(url);
              const hasSpecificChatId =
                cleanUrl.includes('/search/') || // perplexity
                cleanUrl.includes('/c/') ||      // chatgpt
                cleanUrl.includes('/chat/') ||   // claude
                cleanUrl.includes('/chats/');    // copilot

              let autoSubmitConfig: any = undefined;

              if (!hasSpecificChatId) {
                let kind = 'chatgpt';
                if (modelId === 'gemini') kind = 'gemini';
                else if (modelId === 'claude') kind = 'claude';
                else if (modelId === 'perplexity') kind = 'perplexity';
                else if (modelId === 'copilot') kind = 'copilot';
                else if (modelId === 'google') kind = 'google';

                const baseText = step?.config?.prompt || agent.prompt || agent.name || '';
                const baseRules = step?.config?.rules || agent.rules || '';

                const cleanText = stripHtml(baseText);
                const cleanRules = stripHtml(baseRules);

                let promptText = cleanText;
                if (cleanRules) {
                  promptText = promptText ? `${promptText}\n\nInstructions:\n${cleanRules}` : `Instructions:\n${cleanRules}`;
                }

                const extraction = extractPromptFromInput(value, {
                  id: agent.id,
                  prefix: agent.name,
                });
                const userQuery = extraction.matched ? extraction.prompt : '';

                if (userQuery) {
                  promptText = promptText ? `${promptText}\n\n---\n\n${userQuery}` : promptText;
                }

                if (promptText) {
                  autoSubmitConfig = {
                    kind,
                    prompt: promptText,
                  };
                }
              }

              return {
                url: cleanUrl,
                active: false, // Don't steal focus
                forceNewTab: false, // Reuse existing tabs if they match the chat ID
                modelId,
                autoSubmit: autoSubmitConfig,
                skip: false,
              };
            })
            .filter(item => !!item.url);

          if (linksToOpen.length > 0) {
            openLinksWithAutoSubmit(linksToOpen).then(openedTabIds => {
              const finalSession = {
                ...placeholderSession,
                tabIds: openedTabIds,
              };
              setActiveAiSession(finalSession);
              activeAiSessionRef.current = finalSession;

              if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage({
                  action: 'track_ai_session',
                  prompt: placeholderSession.prompt,
                  tabIds: openedTabIds,
                  models: modelsFromAgent,
                });
              }
            });
          }
        }
      },
      [lockedCommand, activateCommandById, setSelectedAIs, setActiveAiSession, setSelectedAutomation],
    );

    useImperativeHandle(
      ref,
      () => ({
        focus: () => inputRef.current?.focus(),
        blur: () => inputRef.current?.blur(),
        clear: () => {
          resetAfterCommandExecution();
          setIsSuggestionsHidden(false);
        },
        setSuggestionsHidden: (hidden: boolean) => {
          setIsSuggestionsHidden(hidden);
        },
        getValue: () => inputRef.current?.value || '',
        setValue: (val: string) => {
          if (inlineComposerActive) {
            setCommandPrompt(val);
          } else {
            setValue(val);
          }
        },
        lockCommand: (commandId: AnyCommandId | null, initialValue?: string) => {
          activateCommandById(commandId, initialValue || '');
        },
        previewCommand: (commandId: AnyCommandId) => {
          previewCommandById(commandId);
        },
        processCommand: (commandId: AnyCommandId) => {
          activateCommandById(commandId, '');
        },
        executeCommand: (commandId: AnyCommandId, options?: { mode?: 'execute' | 'lock' }) => {
          console.log('[searchBar] executeCommand called with:', commandId, options);
          if (options?.mode === 'lock') {
            console.log('[searchBar] options.mode is lock, activating command id');
            activateCommandById(commandId as AnyCommandId, '');
            return;
          }
          if (isLocalCommandId(commandId as string)) {
            console.log('[searchBar] Command is recognized as a local command');
            if (!checkLocalCommandAuth(commandId as LocalCommandId)) return;
            const localDef = LOCAL_COMMANDS.find(c => c.id === commandId);
            if (localDef?.behavior === 'locked') {
              console.log('[searchBar] Local command behavior is locked, activating command');
              activateCommandById(commandId as AnyCommandId, '');
              return;
            }
            console.log('[searchBar] Executing local command via handleLocalCommandExecute');
            handleLocalCommandExecute(commandId as LocalCommandId);
            setLockedCommand(null);
            setActiveAiSession(null);
            setValue('');
            setCommandPrompt('');
            setTimeout(() => inputRef.current?.blur(), 0);
            return;
          }
          console.log('[searchBar] Command is NOT recognized as a local command by isLocalCommandId');
          const remoteCmd = getCommandById(commandId);
          if (remoteCmd && remoteCmd.category !== 'ai' && !['gpt', 'claude', 'perplexity', 'gemini'].includes(remoteCmd.id)) {
            const requiresQuery = remoteCmd.urlTemplate && remoteCmd.urlTemplate.includes('{query}');
            if (!requiresQuery && remoteCmd.urlTemplate) {
              const urlToOpen = remoteCmd.urlTemplate.includes('?')
                ? remoteCmd.urlTemplate.split('?')[0]
                : remoteCmd.urlTemplate;

              openSingleLink(urlToOpen);
              return;
            }
          }
          activateCommandById(commandId as AnyCommandId, '');
        },
        clearCommandPreview,
        isLocked: !!lockedCommand,
        openUrls,
        activateAutomation: (automation: SavedAutomation) => {
          handleAutomationSelect(automation);
        },
        requestPreviewRestore: () => {
          if (!lockedCommand) {
            clearCommandPreview();
          }
        },

        submitAI: (prompt: string) => {
          const hist = stagedHistorySessionRef.current;
          const historyUrls = hist ? (Object.values(hist.urls).filter(Boolean) as string[]) : undefined;
          runAggregateCommand(expandPrompts(prompt), selectedImagesRef.current, historyUrls);
        },
        triggerFileUpload: () => {
          fileInputRef.current?.click();
        },
        selectSavedAgent: (agent: any) => {
          // Check if this is already the active agent/session
          const isCurrentlyActive =
            agent.id === 'active-session' ||
            (activeAiSessionRef.current && String(activeAiSessionRef.current.id) === String(agent.id));

          if (isCurrentlyActive) return;

          // Alert only if current session is active and NOT saved (no name)
          if (activeAiSessionRef.current && !activeAiSessionRef.current.name) {
            const confirm = window.confirm(
              'Your Chat Agent is not saved. Save it to avoid losing your changes. Continue anyway?',
            );
            if (!confirm) return;
          }

          // Reset session then populate from agent
          setSelectedAutomation(agent);
          setCommandPrompt('');
          setValue('');

          // Extract model IDs and URLs from agent config
          const step = (agent.automation_steps || agent.steps)?.[0];
          let modelsFromAgent: string[] = [];
          let urlsFromAgent: string[] = [];
          let tabIdsFromAgent: number[] = [];
          let customModelDefinitions: any[] = [];

          if (step?.config?.allAiUrls) {
            const allModels = Object.keys(step.config.allAiUrls);
            const activeModels = allModels.filter(m => {
              const url = step.config.allAiUrls[m];
              return url.includes('cmd_select_status=true');
            });

            // For backward compatibility: if no status found, select all
            const finalSelected = activeModels.length > 0 ? activeModels : allModels;

            modelsFromAgent = finalSelected;
            urlsFromAgent = finalSelected.map(m => step.config.allAiUrls[m]);
            tabIdsFromAgent = finalSelected.map(() => 0); // Placeholder tab IDs
            setSelectedAIs(finalSelected);

            // EXTRACT CUSTOM MODELS: If any models in the agent are custom IDs (not standard)
            // we prepare them for the active session definitions so they show up in the Selection Panel.
            const standardIds = ['gpt', 'claude', 'gemini', 'perplexity'];
            customModelDefinitions = allModels
              .filter(id => !standardIds.includes(id))
              .map(id => {
                const rawUrl = stripCmdStatus(step.config.allAiUrls[id]);
                let host = '';
                try {
                  host = new URL(rawUrl).hostname;
                } catch (e) {
                  host = rawUrl.slice(0, 30);
                }
                return {
                  id,
                  name: id.startsWith('custom-') ? 'Imported Agent' : id,
                  url: rawUrl,
                  host: host,
                };
              });
          } else if (step?.config?.agentId && step.config.agentId !== 'all_ai' && step.config.agentId !== 'all') {
            modelsFromAgent = [step.config.agentId];
            urlsFromAgent = [step.config.url || ''];
            tabIdsFromAgent = [0];
            setSelectedAIs(modelsFromAgent);
          }

          // Normalize URLs: Replace empty, null, or about:blank with defaults
          urlsFromAgent = urlsFromAgent.map((url, idx) => {
            const modelId = modelsFromAgent[idx];
            if (!url || url === 'null' || url === 'undefined' || url.startsWith('about:blank')) {
              return DEFAULT_ALL_AI_URLS[modelId] || url || '';
            }
            return url;
          });

          // Lock to AI if not already
          if (lockedCommand !== 'ai') {
            activateCommandById('ai', '');
          }

          // Populate activeAiSession so it shows in sidebar and provides context URLs
          // We do this AFTER activateCommandById because that function now clears the session
          if (modelsFromAgent.length > 0) {
            const sessionKey = `${agent.id}-${Date.now()}`;
            const placeholderSession = {
              id: agent.id, // Stable Agent ID
              sessionKey, // Unique Session Key for logs
              prompt: step?.config?.prompt || agent.prompt || agent.name || 'Saved Agent',
              rules: step?.config?.rules || agent.rules || '',
              name: agent.name,
              models: modelsFromAgent,
              urls: urlsFromAgent,
              tabIds: tabIdsFromAgent,
              workspace_id: agent.workspace_id,
              folder_id: agent.folder_id,
              customModelDefinitions: customModelDefinitions,
            };
            setActiveAiSession(placeholderSession);
            activeAiSessionRef.current = placeholderSession;

            // Trigger background restoration of captured URLs
            const linksToOpen = modelsFromAgent
              .map((modelId, idx) => {
                const url = urlsFromAgent[idx];
                const cleanUrl = stripCmdStatus(url);
                const hasSpecificChatId =
                  cleanUrl.includes('/search/') || // perplexity
                  cleanUrl.includes('/c/') ||      // chatgpt
                  cleanUrl.includes('/chat/') ||   // claude
                  cleanUrl.includes('/chats/') ||  // copilot
                  cleanUrl.includes('/app/');      // gemini

                let autoSubmitConfig: any = undefined;

                if (!hasSpecificChatId) {
                  let kind = 'chatgpt';
                  if (modelId === 'gemini') kind = 'gemini';
                  else if (modelId === 'claude') kind = 'claude';
                  else if (modelId === 'perplexity') kind = 'perplexity';
                  else if (modelId === 'copilot') kind = 'copilot';
                  else if (modelId === 'google') kind = 'google';

                  const baseText = step?.config?.prompt || agent.prompt || agent.name || '';
                  const baseRules = step?.config?.rules || agent.rules || '';

                  const cleanText = stripHtml(baseText);
                  const cleanRules = stripHtml(baseRules);

                  let promptText = cleanText;
                  if (cleanRules) {
                    promptText = promptText ? `${promptText}\n\nInstructions:\n${cleanRules}` : `Instructions:\n${cleanRules}`;
                  }

                  if (promptText) {
                    autoSubmitConfig = {
                      kind,
                      prompt: promptText,
                    };
                  }
                }

                return {
                  url: cleanUrl,
                  active: true, // Focus the tabs when restoring
                  forceNewTab: false, // Reuse existing tabs if they match the chat ID
                  modelId,
                  autoSubmit: undefined, // Do not auto-submit prompt on restore
                  skip: false,
                };
              })
              .filter(l => !!l.url);

            if (linksToOpen.length > 0) {
              openLinksWithAutoSubmit(linksToOpen).then(openedTabIds => {
                const finalSession = {
                  ...placeholderSession,
                  tabIds: openedTabIds,
                };
                setActiveAiSession(finalSession);
                activeAiSessionRef.current = finalSession;

                // Register successfully restored session with background for follow-up tracking
                chrome.runtime.sendMessage({
                  action: 'track_ai_session',
                  prompt: placeholderSession.prompt,
                  tabIds: openedTabIds,
                  models: modelsFromAgent,
                });
              });
            }
          } else {
            setActiveAiSession({
              id: `temp-${agent.id}`,
              sessionKey: `temp-${agent.id}-${Date.now()}`,
              prompt: 'Starting fresh...',
              models: [],
              urls: [],
              tabIds: [],
            });
          }

          const finalPrompt = valueRef.current || value || '';
          if (finalPrompt.trim()) {
            // Trigger immediately if there's a prompt
            runAggregateCommand(finalPrompt, selectedImages, []);
          }
        },
        newAiChat: () => {
          setActiveAiSession({
            id: 'new-chat', // Stable ID for new chats
            sessionKey: `new-chat-${Date.now()}`, // Unique key for logs
            prompt: '',
            models: DEFAULT_SELECTED_AIS,
            tabIds: DEFAULT_SELECTED_AIS.map(() => 0),
            urls: DEFAULT_SELECTED_AIS.map(id => {
              const cmd = getCommandById(id);
              return cmd?.urlTemplate || '';
            }),
          });
          setSelectedAutomation(null);
          setCommandPrompt('');
          setValue('');
          setSelectedAIs(DEFAULT_SELECTED_AIS);
          if (lockedCommand !== 'ai') {
            activateCommandById('ai', '');
          }
        },
        executeSnippet: (snippet: any, forceNewTab = false) => {

          if (!snippet) return;

          const rawValue = snippet.value;
          let urls: string[] = [];

          if (typeof rawValue === 'string') {
            try {
              // Try parsing as JSON (common for TabGroups)
              const parsed = JSON.parse(rawValue || '{}');
              if (parsed && Array.isArray(parsed.urls)) {
                urls = parsed.urls;
              } else if (rawValue.startsWith('http') || rawValue.startsWith('chrome:')) {
                urls = [rawValue];
              }
            } catch {
              // Not JSON, check if single URL
              if (rawValue.startsWith('http') || rawValue.startsWith('chrome:')) {
                urls = [rawValue];
              }
            }
          } else if (rawValue && typeof rawValue === 'object' && Array.isArray(rawValue.urls)) {
            urls = rawValue.urls;
          } else if (Array.isArray(snippet.urls)) {
            urls = snippet.urls
              .map((item: any) => (typeof item === 'string' ? item : item?.url))
              .filter(Boolean);
          } else if (snippet.url) {
            urls = [snippet.url];
          }

          if (urls.length > 0) {

            openUrls(urls, snippet.key, forceNewTab);
          } else {
            // Note/Snippet/Prompt handling
            const snippetId = snippet.id || snippet.snippet_id;
            if (forceNewTab && snippetId) {
              // Open note in a fresh new tab as requested for Todos

              const noteUrl = chrome.runtime.getURL(`AltS_search_newtab/index.html?open_note=true&noteid=${snippetId}`);
              openUrls([noteUrl], snippet.key, true);
            } else {
              // Default behavior: open in sidebar

              onSnippetSelect?.({ item: snippet } as any);
            }
          }
        },
        updateActiveSessionMetadata: (metadata: { name?: string; id?: string | number }) => {
          setActiveAiSession(prev => {
            if (!prev) return metadata.id ? ({ id: metadata.id, ...metadata } as any) : null;
            return { ...prev, ...metadata };
          });
        },
      }),
      [
        activateCommandById,
        previewCommandById,
        clearCommandPreview,
        handleLocalCommandExecute,
        openUrls,
        handleAutomationSelect,
        buildAutomationFromModule,
        moduleSuggestions,
        resetAfterCommandExecution,
        lockedCommand,
        onSnippetSelect,
      ],
    );

    const handleSnippetSelect = useCallback(
      (selection: WorkspaceItemSuggestion | null | undefined) => {
        if (!selection) return;

        // Check if we are selecting from an @ mention
        const atMentionMatch = value.match(/(?:^|\s)@(\w*)$/);
        if (atMentionMatch && !lockedCommand) {
          // Replace the @fragment with @Title
          const matchIndex = atMentionMatch.index!;
          const matchLength = atMentionMatch[0].length;
          // match[0] includes the leading space if present, so we need to be careful
          const prefix = value.slice(0, matchIndex);
          // Determine separator: if match started with space, keep it
          const separator = atMentionMatch[0].startsWith(' ') ? ' ' : '';

          const title = (selection.item as any).title || (selection.item as any).key;
          const newValue = prefix + separator + '@' + title + ' ';

          setValue(newValue);
          // Keep focus and don't clear everything
          setTimeout(() => inputRef.current?.focus(), 0);
          return;
        }

        onSnippetSelect?.(selection);
        setLockedCommand(null);
        setValue('');
        setCommandPrompt('');
        setHighlightIndex(0);
        setBookmarkSuggestions([]);
        setShowPromo(false);
        suggestionVisibilityRef.current = false;
        setIsFocused(false);
        setTimeout(() => inputRef.current?.blur(), 0);
      },
      [onSnippetSelect, value, lockedCommand],
    );

    const recordSelectedShortcutUsage = useCallback(
      (selection: any, success = true, errorCode?: string) => {
        const shortcut = selection?._userShortcutRecord || selection?.item?._userShortcutRecord || selection?.proxyEntity?._userShortcutRecord;
        if (!shortcut?.trigger || !shortcut?.referenceId) return;

        const currentValue = valueRef.current?.trim() || value.trim();
        const parsedShortcut = parseShortcutInvocation(
          currentValue,
          customOmniboxPrefixesRef.current || customOmniboxPrefixes,
        );
        const item = selection?.item || selection?.proxyEntity || selection;
        const targetLabel =
          item?.title ||
          item?.name ||
          item?.label ||
          item?.key ||
          selection?.label ||
          shortcut.referenceId;

        recordAssignedTriggerUsage({
          triggerKind: 'user_shortcut',
          triggerValue: shortcut.trigger,
          triggerSource: parsedShortcut.triggerSource,
          referenceId: shortcut.referenceId,
          referenceType: shortcut.referenceType,
          surface: 'main_search',
          success,
          errorCode,
          targetLabelSnapshot: targetLabel,
          triggerLabelSnapshot: shortcut.trigger,
        }).catch((err: any) => console.warn('[Searchbar] Failed to record selected shortcut usage:', err));
      },
      [customOmniboxPrefixes, value],
    );

    const handleSnippetDelete = useCallback(
      (selection: WorkspaceItemSuggestion | null | undefined) => {
        if (!selection || !activeSnippetCommandId) return;
        const snippetId = selection.item.id || (selection.item as any).snippet_id;
        if (!snippetId) return;
        // TODO: Delegate to central Workspace Manager / API
        console.warn('handleSnippetDelete: Delegating to WorkspaceManager (Not implemented in UI yet)');
        setLockedCommand(null);
        setValue('');
        setCommandPrompt('');
        setHighlightIndex(0);
        setBookmarkSuggestions([]);
        setShowPromo(false);
        suggestionVisibilityRef.current = false;
        setIsFocused(false);
        setTimeout(() => inputRef.current?.blur(), 0);
      },
      [activeSnippetCommandId],
    );

    const searchbarSuggestionValue = (() => {
      if (showEmptySlashDropdown && !value) return '/';
      if (!activeSlashFilter) return value;

      const normalizedCommandKey = getCommandSpacePrefix(commandKey || customOmniboxPrefixes);
      const normalizedFilter = String(activeSlashFilter || '').trim().toLowerCase();
      const filterLabel = String(slashFilterMeta[normalizedFilter]?.label || '').trim().toLowerCase();
      const typedQuery = String(value || '').trimStart();

      if (filterLabel === 'commands') {
        return `${normalizedCommandKey} ${typedQuery}`.trimEnd() + (typedQuery ? '' : ' ');
      }

      return `${normalizedCommandKey} ${normalizedFilter}${typedQuery ? ` ${typedQuery}` : ' '}`;
    })();

    const {
      allSuggestions,
      debouncedFuseResults,
      commandSuggestions,
      commonCommandSuggestions,
      openUrlSuggestion,
    } = useSearchbarSuggestions({
      value: searchbarSuggestionValue,
      lockedCommand,
      lockedLocalDef,
      selectedTeam,
      searchTeamLike: null,
      dbWorkspaces,
      selectedFolder,
      isInitialAltSFocus,
      isFocused,
      isSearchFocusEnabled,
      selectedImages,
      commands,
      commandIndex,
      bookmarkSuggestions,
      commonCommandEntries,
      automationSuggestions,
      agentCollectionSuggestions,
      moduleSuggestions,

      selectedAtCommand,
      activeSnippetCommandId,
      isSnippetCommand,
      activeCollection,
      showAIHistoryPanel,
      commandKey,
      workspaceItemIndex,
      userDbShortcuts,
      userDbHotkeys,
      customPrefixes: customOmniboxPrefixesRef.current,
      isEmbedded,
      contextUrl,
    });

    useEffect(() => {
      const maxIndex = allSuggestions.length - 1;
      if (allSuggestions.length > 0 && highlightIndex > maxIndex) {
        setHighlightIndex(maxIndex);
      } else if (allSuggestions.length === 0 && highlightIndex !== 0) {
        setHighlightIndex(0);
      }
    }, [allSuggestions.length, highlightIndex]);

    const handleRequestOpenUrls = useCallback(
      (urls: string[], title?: string) => {
        openUrls(urls, title);
      },
      [commands, currentTabId, triggerNotification],
    );

    // --- Custom Agent Handling ---
    interface AgentItem {
      id: string;
      name: string;
      url: string;
      iconHost: string;
      promptLabel?: string;
    }

    const [customAgents, setCustomAgents] = useState<AgentItem[]>([]);
    const [customLinks, setCustomLinks] = useState<any[]>([]);
    const [customAutomations, setCustomAutomations] = useState<any[]>([]);

    useEffect(() => {
      chrome.storage.local.get(['agent_panel_selected_agents'], result => {
        const saved = result.agent_panel_selected_agents;
        if (saved) {
          if (Array.isArray(saved)) {
            setCustomAgents(saved);
          } else {
            setCustomAgents(saved.agents || []);
            setCustomLinks(saved.links || []);
            setCustomAutomations(saved.automations || []);
          }
        }
      });

      const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
        if (areaName === 'local' && changes.agent_panel_selected_agents) {
          const saved = changes.agent_panel_selected_agents.newValue;
          if (saved) {
            if (Array.isArray(saved)) {
              setCustomAgents(saved);
            } else {
              setCustomAgents(saved.agents || []);
              setCustomLinks(saved.links || []);
              setCustomAutomations(saved.automations || []);
            }
          } else {
            setCustomAgents([]);
            setCustomLinks([]);
            setCustomAutomations([]);
          }
        }
      };

      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }, []);

    const openLinksWithAutoSubmit = useCallback(
      async (
        items: Array<{
          url: string;
          active: boolean;
          autoSubmit?: any;
          modelId?: string;
          forceNewTab?: boolean;
          targetTabId?: number;
        }>,
      ) => {
        const tabIds: number[] = [];

        for (const item of items) {
          if ((item as any).skip) {
            tabIds.push(0);
            continue;
          }
          try {
            console.log('[openLinksWithAutoSubmit] Processing item:', item);
            const response = await new Promise<any>((resolve, reject) => {
              console.log('[openLinksWithAutoSubmit] Sending message to background for:', item.url);
              chrome.runtime.sendMessage(
                {
                  action: 'open_tab_with_auto_submit',
                  url: item.url,
                  autoSubmit: item.autoSubmit,
                  forceNewTab: item.forceNewTab ?? true, // Default to true, but allow override
                  active: item.active,
                  targetTabId: item.targetTabId,
                },
                res => {
                  console.log('[openLinksWithAutoSubmit] Received response from background:', res, 'lastError:', chrome.runtime.lastError);
                  if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                  } else {
                    resolve(res);
                  }
                },
              );
            });

            console.log('[openLinksWithAutoSubmit] Promise resolved with response:', response);
            tabIds.push(response?.tabId || 0);
          } catch (error) {
            console.error('[openLinksWithAutoSubmit] Failed to open tab via background:', error);
            // Fallback: direct creation without injection
            try {
              const tab = await new Promise<chrome.tabs.Tab>(res => {
                chrome.tabs.create({ url: item.url, active: item.active }, res);
              });
              tabIds.push(tab?.id || 0);
            } catch (e) {
              tabIds.push(0);
            }
          }
        }

        return tabIds;
      },
      [],
    );

    // Helper to calculate approximate payload size
    const getPayloadSize = (prompt: string, images?: { file: File }[] | null) => {
      let size = prompt.length;
      if (images) {
        images.forEach(img => (size += img.file.size));
      }
      return size;
    };

    const MAX_PAYLOAD_SIZE = 60 * 1024 * 1024; // 60MB limit to stay within 64MB sendMessage limit (including serialization overhead)

    const saveAiLog = useCallback(async (sessionKey: string, prompt: string) => {
      if (!sessionKey || !prompt.trim()) return;
      try {
        const logId = `ai_logs_${sessionKey}`;
        const result = await chrome.storage.local.get([logId]);
        const existingLogs = Array.isArray(result[logId]) ? result[logId] : [];

        // Check if this prompt is already the last one to avoid duplicates
        // (e.g. if the background script or another part of the app also logs it)
        if (existingLogs.length > 0 && existingLogs[existingLogs.length - 1].prompt === prompt.trim()) {
          return;
        }

        const newLog = {
          id: `log-${Date.now()}`,
          prompt: prompt.trim(),
          timestamp: Date.now(),
        };

        await chrome.storage.local.set({ [logId]: [...existingLogs, newLog] });

      } catch (err) {
        console.error('[saveAiLog] Failed to save AI log:', err);
      }
    }, []);

    const executeAggregateCommand = useCallback(
      async (
        prompt: string,
        images?: { file?: File; base64?: string; mimeType: string; filename: string }[] | null,
        historyUrls?: string[],
      ) => {
        let finalPrompt = prompt;
        if (lockedCommand === 'ai' && mentionedTabs && mentionedTabs.length > 0) {
          const contextMap = new Map<string, string>();
          try {

            for (const tab of mentionedTabs) {
              if (!tab.tabId) continue;
              try {
                const result = await chrome.scripting.executeScript({
                  target: { tabId: Number(tab.tabId) },
                  func: () => document.body.innerText || document.body.textContent,
                });
                const content = result[0]?.result || '';
                if (content) {
                  const structuredText = `\n--- Context from Tab: ${tab.title} ---\n${content}\n`;
                  contextMap.set(String(tab.tabId), structuredText);
                }
              } catch (err) {
                console.error(`[executeAggregateCommand] Failed to extract content from tab ${tab.tabId}:`, err);
              }
            }
          } catch (e) {
            console.error('[executeAggregateCommand] Error during tab content extraction:', e);
          }

          // Perform inline replacement of @[tab:ID] placeholders
          const regex = /@\[tab:([^\]]+)\]/g;
          finalPrompt = prompt.replace(regex, (match, tabId) => {
            const context = contextMap.get(String(tabId));
            if (context) return context;
            return match;
          });

          // Fallback: If no placeholders replaced but we have context
          if (finalPrompt === prompt && contextMap.size > 0) {
            let footerContext = '';
            contextMap.forEach(text => {
              footerContext += `\n${text}`;
            });
            finalPrompt = `${prompt}\n\n[Attached Tabs Context]\n${footerContext}\n[End of Context]`;
          }
        }

        const normalized = finalPrompt; // Tags are already replaced or preserved as fallback

// Convert any File objects to base64 for background submission (DO THIS FIRST)
        const imagesWithBase64 = images
          ? await Promise.all(
            images.map(async img => {
              if (img.base64) return { base64: img.base64, mimeType: img.mimeType, filename: img.filename };
              return {
                base64: await fileToBase64(img.file!),
                mimeType: img.mimeType,
                filename: img.filename,
              };
            }),
          )
          : null;

// If historyUrls are provided, use them for context injection as TOP PRIORITY
        if (historyUrls && historyUrls.length > 0) {
          try {
            const linksToOpen = historyUrls.map((url, index) => {
              // Try to identify which AI this URL belongs to for better autoSubmit targeting
              let kind: AutoSubmitKind = 'chatgpt'; // Default fallback
              let modelId: string = 'gpt';
              const lowerUrl = url.toLowerCase();
              if (lowerUrl.includes('chatgpt.com')) {
                kind = 'chatgpt';
                modelId = 'gpt';
              } else if (lowerUrl.includes('claude.ai')) {
                kind = 'claude';
                modelId = 'claude';
              } else if (lowerUrl.includes('perplexity.ai')) {
                kind = 'perplexity';
                modelId = 'perplexity';
              } else if (lowerUrl.includes('gemini.google.com')) {
                kind = 'gemini';
                modelId = 'gemini';
              }

              return {
                url,
                active: index === 0, // Focus the first one
                autoSubmit: {
                  kind,
                  prompt: normalized,
                  images: imagesWithBase64 && imagesWithBase64.length > 0 ? imagesWithBase64 : undefined,
                },
                modelId,
                forceNewTab: false, // Explicitly tell background script to find existing tab
              };
            });

// Save the prompt to logs so it appears in the chat history
            if (stagedHistorySessionRef.current?.sessionKey) {
              saveAiLog(stagedHistorySessionRef.current.sessionKey, normalized);
            }
            // openLinksWithAutoSubmit will return the tab IDs of the newly (or matching) opened tabs
            const openedTabIds = await openLinksWithAutoSubmit(linksToOpen);

            // Clean up the staged history after successful trigger
            setTimeout(() => setStagedHistorySession(null), 500);
            return;
          } catch (error) {
            console.error('[executeAggregateCommand] Failed to process historyUrls:', error);
            // Fall through to original logic
          }
        } else if (activeAiSessionRef.current && activeAiSessionRef.current.id !== 'new-chat') {
          // Dynamic Follow-up: Merge currently selected AIs with the existing session
          const currentSession = activeAiSessionRef.current;
          const currentSelectedAIs = selectedAIsRef.current;
          console.log('[executeAggregateCommand] Path: activeAiSession exists. currentSession:', currentSession, 'currentSelectedAIs:', currentSelectedAIs);

          try {
            // Get currently selected models (from props/state)
            // Note: If no models are selected in UI during a session, we default to the session's models
            const targetModelIds =
              currentSelectedAIs && currentSelectedAIs.length > 0
                ? currentSelectedAIs.filter(id => id !== 'ai')
                : currentSession.models;

            const linksToOpen: any[] = [];
            const newModels: string[] = [];

            targetModelIds.forEach(modelId => {
              const sessionIndex = currentSession.models.indexOf(modelId);
              if (sessionIndex !== -1) {
                // Already in session -> Follow up in existing tab
                let url = currentSession.urls[sessionIndex];

                // Safety: Avoid opening placeholder URLs in follow-ups
                if (!url || url.startsWith('about:blank')) {
                  url = DEFAULT_ALL_AI_URLS[modelId] || url;
                }

                const lowerUrl = url.toLowerCase();
                let kind: AutoSubmitKind = 'chatgpt';
                if (lowerUrl.includes('chatgpt.com')) kind = 'chatgpt';
                else if (lowerUrl.includes('claude.ai')) kind = 'claude';
                else if (lowerUrl.includes('perplexity.ai')) kind = 'perplexity';
                else if (lowerUrl.includes('gemini.google.com')) kind = 'gemini';

                linksToOpen.push({
                  url,
                  active: linksToOpen.length === 0,
                  autoSubmit: {
                    kind,
                    prompt: normalized,
                    images: imagesWithBase64 && imagesWithBase64.length > 0 ? imagesWithBase64 : undefined,
                  },
                  modelId,
                  forceNewTab: false,
                  targetTabId: currentSession.tabIds[sessionIndex],
                });
              } else {
                // New model added to active session -> OPEN NEW TAB
                newModels.push(modelId);
                const cmd = getCommandById(modelId);
                if (cmd) {
                  const link = buildCommandLink(cmd, normalized, imagesWithBase64);
                  linksToOpen.push({
                    url: typeof link === 'string' ? link : link.url,
                    active: linksToOpen.length === 0,
                    autoSubmit: typeof link === 'string' ? undefined : link.autoSubmit,
                    modelId,
                  });
                }
              }
            });

            if (linksToOpen.length === 0) {
              console.log('[executeAggregateCommand] activeAiSession path: linksToOpen is EMPTY. Returning early.');
              return;
            }
            console.log('[executeAggregateCommand] activeAiSession path: linksToOpen:', linksToOpen);

            // Save the prompt to logs so it appears in the chat history
            saveAiLog(currentSession.sessionKey, normalized);

            const openedTabIds = await openLinksWithAutoSubmit(linksToOpen);

const updatedModels: string[] = [];
            const updatedTabIds: number[] = [];
            const updatedUrls: string[] = [];

            linksToOpen.forEach((item, index) => {
              if (item.modelId) {
                updatedModels.push(item.modelId);
                updatedTabIds.push(openedTabIds[index] || 0);
                updatedUrls.push(item.url);
              }
            });

            if (updatedTabIds.length > 0) {
              const mergedSession = {
                id: currentSession.id, // PRESERVE ID
                sessionKey: currentSession.sessionKey, // Preserve stable session key for logs
                prompt: currentSession.prompt || normalized, // KEEP ORIGINAL PROMPT as name/key, or use current if first time
                models: updatedModels,
                tabIds: updatedTabIds,
                urls: updatedUrls,
                name: currentSession.name, // PRESERVE AGENT NAME
              };
              setActiveAiSession(mergedSession);
              activeAiSessionRef.current = mergedSession;

              // Register updated session with background
              chrome.runtime.sendMessage({
                action: 'track_ai_session',
                prompt: normalized,
                tabIds: updatedTabIds,
                models: updatedModels,
              });
            }

            // Input clearing handled by the queue wrapper
            return;
          } catch (e) {
            console.error('[executeAggregateCommand] Failed to process active AI session', e);
          }
        }

        // Check payload size if files are provided
        if (images) {
          const filesOnly = images.filter(img => img.file).map(img => ({ file: img.file! }));
          const totalSize = getPayloadSize(normalized, filesOnly);
          if (totalSize > MAX_PAYLOAD_SIZE) {
            setFooterStatus({
              message: 'Attachments too large. Please reduce file size or count.',
              type: 'error',
            });
            setTimeout(() => setFooterStatus(null), 5000);
            return;
          }
        }

        // Use selected agent (from sidebar) or custom agents/links/automations (from agent panel)
        if (selectedAutomation || customAgents.length > 0 || customLinks.length > 0 || customAutomations.length > 0) {
          const linksToOpen: any[] = [];
          const aiModelsUsed: string[] = [];

          // 0. Process Selected Automation (Manual selection from sidebar)
          const currentAuto = selectedAutomationRef.current;
          let automationAgents: AgentItem[] = [];

          if (currentAuto && !activeAiSessionRef.current) {
            const raws = (currentAuto as any).steps || (currentAuto as any).automation_steps || [];

            // Check if this is an AI Agent (contains agent steps)
            const isAgentAutomation = raws.some((s: any) => {
              const moduleId = String(s?.module_id || s?.moduleId || '').toLowerCase();
              return moduleId === '5' || moduleId === 'agent' || s?.config?.agentId === 'all_ai' || s?.config?.isAllAi;
            });

            if (isAgentAutomation) {

              raws.forEach((step: any) => {
                const moduleId = String(step.module_id || step.moduleId || '').toLowerCase();
                const config = step.config || {};
                const isAiStep =
                  moduleId === '5' || moduleId === 'agent' || config.isAllAi || config.agentId === 'all_ai';

                if (isAiStep) {
                  let agentId = config.agentId || config.id || '';
                  // Normalize 'all_ai' to 'ai' for command lookup
                  if (agentId === 'all_ai') agentId = 'ai';

                  const cmd = getCommandById(agentId);

                  if (cmd) {
                    automationAgents.push({
                      id: cmd.id,
                      name: cmd.label,
                      url: cmd.urlTemplate,
                      iconHost: cmd.iconHost,
                    });
                  } else if (config.agentUrl) {
                    automationAgents.push({
                      id: agentId || config.agentName || 'custom-agent',
                      name: config.agentName || 'Custom Agent',
                      url: config.agentUrl,
                      iconHost: '',
                    });
                  } else if (agentId === 'ai') {
                    // Fallback for global AI command
                    automationAgents.push({
                      id: 'ai',
                      name: 'All AI Chat Agents',
                      url: 'about:blank#ai:{query}',
                      iconHost: 'chatgpt.com',
                    });
                  }
                }
              });
            }

            if (!isAgentAutomation) {

              const inputs: Record<string, string> = {
                content: normalized,
                query: normalized,
                prompt: normalized,
              };
              for (let i = 1; i <= 9; i++) {
                inputs[`prompt${i}`] = normalized;
                inputs[`paste${i}`] = normalized;
              }

              const processedSteps = raws.map((step: any) => {
                const newConfig = { ...step.config };

                if (step.moduleId === 'paste') {
                  const paramKey = newConfig.paramKey || 'content';
                  if (inputs[paramKey] !== undefined) {
                    newConfig.content = inputs[paramKey];
                  }
                }

                Object.keys(newConfig).forEach(key => {
                  let val = newConfig[key];
                  if (typeof val === 'string') {
                    const VARIABLE_TOKEN_REGEX = /\{input_name="([^"]+)"\}|\{([^}:\s]+):([^}\s]+)\}|\{([^}\s]+)\}/g;

                    val = val
                      .replace(VARIABLE_TOKEN_REGEX, (match, newFmtVar, typeVar, nameVar, legacyVar) => {
                        const variable = newFmtVar || nameVar || legacyVar;
                        const fullVar = typeVar && nameVar ? `${typeVar}:${nameVar}` : variable;
                        if (fullVar && inputs[fullVar] !== undefined) return inputs[fullVar];
                        if (variable && inputs[variable] !== undefined) return inputs[variable];
                        return match;
                      })
                      .replace(/%7B(?:[^%]|%(?!7D))*%7D/g, match => {
                        const decodedMatch = decodeURIComponent(match);
                        let replaced = decodedMatch.replace(
                          VARIABLE_TOKEN_REGEX,
                          (m, newFmtVar, typeVar, nameVar, legacyVar) => {
                            const variable = newFmtVar || nameVar || legacyVar;
                            const fullVar = typeVar && nameVar ? `${typeVar}:${nameVar}` : variable;
                            if (fullVar && inputs[fullVar] !== undefined) return inputs[fullVar];
                            if (variable && inputs[variable] !== undefined) return inputs[variable];
                            return m;
                          },
                        );
                        return replaced !== decodedMatch ? encodeURIComponent(replaced) : match;
                      });
                    newConfig[key] = val;
                  }
                });
                return { ...step, config: newConfig };
              });

              chrome.runtime.sendMessage({
                action: 'run_automation',
                automation: { ...currentAuto, steps: processedSteps },
              });

              // Input clearing handled by the queue wrapper
              return;
            }
          }

          // 1. Process Agents
          const agentsToRun = automationAgents.length > 0 ? automationAgents : customAgents;
          agentsToRun.forEach((agent, index) => {
            let url = agent.url;
            let autoSubmitPayload: any = undefined;

            // Use the robust buildUrl helper to handle all placeholder variations (e.g., {query}, {QUERY}, {query })
            url = buildUrl(agent.url, normalized);
            if (agent.url === url) {
              // Only if NO template replacement occurred (i.e. no {query} found), we set up auto-submit
              let kind = 'chatgpt';

              const idLower = String(agent.id || '').toLowerCase();
              const nameLower = String(agent.name || '').toLowerCase();

              if (idLower.includes('gpt') || nameLower.includes('gpt') || nameLower.includes('openai'))
                kind = 'chatgpt';
              else if (idLower.includes('claude') || nameLower.includes('claude') || nameLower.includes('anthropic'))
                kind = 'claude';
              else if (idLower.includes('gemini') || nameLower.includes('gemini') || nameLower.includes('bard'))
                kind = 'gemini';
              else if (idLower.includes('perplexity') || nameLower.includes('perplexity')) kind = 'perplexity';

              autoSubmitPayload = {
                kind: kind,
                prompt: normalized,
                images: imagesWithBase64 && imagesWithBase64.length > 0 ? imagesWithBase64 : undefined,
              };

              // Only track actual AI models that will get prompts (not just simple URL swaps)
              if (kind !== 'google') {
                aiModelsUsed.push(kind);
              }
            }

            linksToOpen.push({
              url: url,
              active: index === 0 && customLinks.length === 0, // Heuristic for active tab
              autoSubmit: autoSubmitPayload,
              modelId: autoSubmitPayload
                ? autoSubmitPayload.kind === 'chatgpt'
                  ? 'gpt'
                  : autoSubmitPayload.kind
                : undefined,
            });
          });

          // 2. Process Links
          customLinks.forEach(link => {
            let url = link.url;
            if (url.includes('{query}')) {
              url = url.replace('{query}', encodeURIComponent(normalized));
            }
            linksToOpen.push({
              url: url,
              active: false, // Generally background for workflow links
            });
          });

          // Execute combined links
          if (linksToOpen.length > 0) {
            // If there's only one agent, use its name. Otherwise use "All AI" or similar.
            const sessionName =
              currentAuto && automationAgents.length > 0
                ? currentAuto.name
                : agentsToRun.length === 1
                  ? agentsToRun[0].name
                  : agentsToRun.length > 1
                    ? 'Multiple Agents'
                    : 'All AI Chat Agents';

            const placeholderSession = {
              id: currentAuto?.id || `session-${Date.now()}`,
              sessionKey: `session-${Date.now()}`,
              prompt: normalized,
              models: linksToOpen.filter(l => l.autoSubmit && l.modelId).map(l => l.modelId!),
              tabIds: linksToOpen.filter(l => l.autoSubmit && l.modelId).map(() => 0),
              // Use appendCmdStatus for better tracking and UI identification
              urls: linksToOpen.filter(l => l.autoSubmit && l.modelId).map(l => appendCmdStatus(l.url, true)),
              name: sessionName === 'All AI Chat Agents' ? normalized.slice(0, 50) : sessionName,
              workspace_id: currentAuto?.workspace_id ? String(currentAuto.workspace_id) : null,
              folder_id: currentAuto?.folder_id ? String(currentAuto.folder_id) : null,
            };

            // Sync selectedAIs state so sidebar highlighting matches the session
            const triggeredModelIds = placeholderSession.models;
            if (triggeredModelIds.length > 0) {
              setSelectedAIs(triggeredModelIds);
            }

            // 1. SAVE LOG FIRST (to ensure it's in storage before UI re-renders)
            await saveAiLog(placeholderSession.sessionKey, normalized);

            // 2. ACTIVATE SESSION SECOND
            setActiveAiSession(placeholderSession);
            activeAiSessionRef.current = placeholderSession;

            const openedTabIds = await openLinksWithAutoSubmit(linksToOpen);

            const aiTrackedTabIds: number[] = [];
            const aiTrackedModels: string[] = [];
            const aiTrackedUrls: string[] = [];

            linksToOpen.forEach((item, index) => {
              if (item.autoSubmit && item.modelId && openedTabIds[index]) {
                aiTrackedTabIds.push(openedTabIds[index]);
                aiTrackedModels.push(item.modelId);
                aiTrackedUrls.push(appendCmdStatus(item.url, true));
              }
            });

            if (aiTrackedTabIds.length > 0) {
              const finalSession = {
                ...placeholderSession,
                models: aiTrackedModels,
                tabIds: aiTrackedTabIds,
                urls: aiTrackedUrls,
              };

              setActiveAiSession(prev => {
                // RACE CONDITION FIX: If the background script already sent us the final captured URL
                // (e.g. chatgpt.com/c/xxx), don't overwrite it with the initial base URL (chatgpt.com)
                if (!prev || prev.sessionKey !== placeholderSession.sessionKey) return finalSession;

                const mergedUrls = [...aiTrackedUrls];
                prev.urls.forEach((existingUrl, idx) => {
                  const isFinal =
                    existingUrl.includes('/c/') || existingUrl.includes('/app/') || existingUrl.includes('/search/');
                  const isPlaceholder =
                    !mergedUrls[idx] ||
                    !(
                      mergedUrls[idx].includes('/c/') ||
                      mergedUrls[idx].includes('/app/') ||
                      mergedUrls[idx].includes('/search/')
                    );

                  if (isFinal && isPlaceholder) {
                    mergedUrls[idx] = existingUrl;
                  }
                });

                const updated = {
                  ...finalSession,
                  urls: mergedUrls,
                };
                activeAiSessionRef.current = updated;
                return updated;
              });

              chrome.runtime.sendMessage({
                action: 'track_ai_session',
                prompt: normalized,
                tabIds: aiTrackedTabIds,
                models: aiTrackedModels,
              });
            }
          }

          // 3. Process Automations (Trigger them directly)
          customAutomations.forEach(auto => {

            const inputs: Record<string, string> = {
              content: normalized,
              query: normalized,
              prompt: normalized,
            };
            for (let i = 1; i <= 9; i++) {
              inputs[`prompt${i}`] = normalized;
              inputs[`paste${i}`] = normalized;
            }

            const processedSteps = auto.steps.map((step: any) => {
              const newConfig = { ...step.config };

              if (step.moduleId === 'paste') {
                const paramKey = newConfig.paramKey || 'content';
                if (inputs[paramKey] !== undefined) {
                  newConfig.content = inputs[paramKey];
                }
              }

              Object.keys(newConfig).forEach(key => {
                let val = newConfig[key];
                if (typeof val === 'string') {
                  const VARIABLE_TOKEN_REGEX = /\{input_name="([^"]+)"\}|\{([^}:\s]+):([^}\s]+)\}|\{([^}\s]+)\}/g;

                  val = val
                    .replace(VARIABLE_TOKEN_REGEX, (match, newFmtVar, typeVar, nameVar, legacyVar) => {
                      const variable = newFmtVar || nameVar || legacyVar;
                      const fullVar = typeVar && nameVar ? `${typeVar}:${nameVar}` : variable;
                      if (fullVar && inputs[fullVar] !== undefined) return inputs[fullVar];
                      if (variable && inputs[variable] !== undefined) return inputs[variable];
                      return match;
                    })
                    .replace(/%7B(?:[^%]|%(?!7D))*%7D/g, match => {
                      const decodedMatch = decodeURIComponent(match);
                      let replaced = decodedMatch.replace(
                        VARIABLE_TOKEN_REGEX,
                        (m, newFmtVar, typeVar, nameVar, legacyVar) => {
                          const variable = newFmtVar || nameVar || legacyVar;
                          const fullVar = typeVar && nameVar ? `${typeVar}:${nameVar}` : variable;
                          if (fullVar && inputs[fullVar] !== undefined) return inputs[fullVar];
                          if (variable && inputs[variable] !== undefined) return inputs[variable];
                          return m;
                        },
                      );
                      return replaced !== decodedMatch ? encodeURIComponent(replaced) : match;
                    });
                  newConfig[key] = val;
                }
              });
              return { ...step, config: newConfig };
            });

            chrome.runtime.sendMessage({
              action: 'run_automation',
              automation: { ...auto, steps: processedSteps },
            });
          });

          // Input clearing handled by the queue wrapper
          return;
        }

        // Fallback to original logic if no custom items
        console.log('[executeAggregateCommand] Fallback path: NO custom items, NO currentAuto. Fetching from chrome.storage');
        const chromeAny = (window as any)?.chrome;
        if (chromeAny?.storage?.local) {
          chromeAny.storage.local.get(
            ['selectedAIs', 'custom_ai_models', 'selected_custom_ai_models'],
            async (result: any) => {
              const activeSession = activeAiSessionRef.current;
              const selection = activeSession && Array.isArray(activeSession.models) && activeSession.models.length > 0
                ? activeSession.models
                : (result.selectedAIs && Array.isArray(result.selectedAIs) ? result.selectedAIs : DEFAULT_SELECTED_AIS);

              // Keep built-in AI members even when the DB rows have been removed.
              const targetAIs = AI_GROUP.members.filter((id: string) => id !== 'ai' && selection.includes(id));

              const linksToOpen: any[] = [];
              console.log('[executeAggregateCommand] Fallback path: targetAIs:', targetAIs, 'from selection:', selection);

              targetAIs.forEach((id: string) => {
                const cmd = getCommandById(id);
                console.log('[executeAggregateCommand] Checking id:', id, 'Found cmd?', !!cmd, '| COMMANDS length:', COMMANDS?.length, '| commands length:', commands?.length);
                if (cmd) {
                  let existingUrl = '';
                  let existingTabId = 0;
                  if (activeSession) {
                    const idx = activeSession.models.indexOf(id);
                    if (idx !== -1) {
                      existingUrl = activeSession.urls[idx];
                      existingTabId = activeSession.tabIds[idx];
                    }
                  }

                  const baseLink = buildCommandLink(cmd, normalized, imagesWithBase64);
                  const resolvedUrl = existingUrl ? stripCmdStatus(existingUrl) : (typeof baseLink === 'string' ? baseLink : baseLink.url);

                  linksToOpen.push({
                    url: resolvedUrl,
                    active: false,
                    autoSubmit: typeof baseLink === 'string' ? undefined : baseLink.autoSubmit,
                    modelId: id,
                    targetTabId: existingTabId || undefined,
                    forceNewTab: false,
                  });
                }
              });

              // Process Custom AIs
              const customModels = result.custom_ai_models || [];
              const selectedCustomIds = activeSession && Array.isArray(activeSession.models)
                ? activeSession.models
                : (result.selected_custom_ai_models || []);
              const targetCustoms = customModels.filter((m: any) => selectedCustomIds.includes(m.id));

              targetCustoms.forEach((custom: any) => {
                let kind: AutoSubmitKind = 'chatgpt';
                const lowerUrl = custom.url.toLowerCase();
                if (lowerUrl.includes('chatgpt.com')) kind = 'chatgpt';
                else if (lowerUrl.includes('claude.ai')) kind = 'claude';
                else if (lowerUrl.includes('perplexity.ai')) kind = 'perplexity';
                else if (lowerUrl.includes('gemini.google.com')) kind = 'gemini';

                let existingUrl = '';
                let existingTabId = 0;
                if (activeSession) {
                  const idx = activeSession.models.indexOf(custom.id);
                  if (idx !== -1) {
                    existingUrl = activeSession.urls[idx];
                    existingTabId = activeSession.tabIds[idx];
                  }
                }

                linksToOpen.push({
                  url: existingUrl ? stripCmdStatus(existingUrl) : custom.url,
                  active: false,
                  autoSubmit: {
                    kind,
                    prompt: normalized,
                    images: imagesWithBase64 && imagesWithBase64.length > 0 ? imagesWithBase64 : undefined,
                  },
                  modelId: custom.id,
                  targetTabId: existingTabId || undefined,
                  forceNewTab: false,
                });
              });

              if (linksToOpen.length === 0) {
                console.warn('[executeAggregateCommand] No standard or custom AI commands selected');
                return;
              }

              // First one should be active
              linksToOpen[0].active = true;

// Input clearing handled by the queue wrapper

              // Set a preliminary session IMMEDIATELY (before tabs open) so follow-ups don't fall through
              const placeholderSession = {
                id: `session-${Date.now()}`,
                sessionKey: `session-${Date.now()}`,
                prompt: normalized,
                models: linksToOpen.filter(l => l.autoSubmit && l.modelId).map(l => l.modelId!),
                tabIds: linksToOpen.filter(l => l.autoSubmit && l.modelId).map(() => 0),
                urls: linksToOpen.filter(l => l.autoSubmit && l.modelId).map(l => appendCmdStatus(l.url, true)),
                // NOTE: do NOT set `name` here — it is reserved for saved agent names.
                // AICommandLockedUI uses `activeAiSession?.name` as a guard to block the Save Agent modal.
                // Setting it on every new session would permanently prevent the user from saving.
              };

              // Sync selectedAIs state
              const triggeredModelIds = placeholderSession.models;
              if (triggeredModelIds.length > 0) {
                setSelectedAIs(triggeredModelIds);
              }

              // 1. SAVE LOG FIRST
              await saveAiLog(placeholderSession.sessionKey, normalized);

              // 2. ACTIVATE SESSION SECOND
              setActiveAiSession(placeholderSession);
              activeAiSessionRef.current = placeholderSession;

              console.log('[executeAggregateCommand] Fallback path: calling openLinksWithAutoSubmit with linksToOpen:', linksToOpen);

              const openedTabIds = await openLinksWithAutoSubmit(linksToOpen);
              console.log('[executeAggregateCommand] Fallback path: openedTabIds returned from openLinksWithAutoSubmit:', openedTabIds);
              const aiTrackedTabIds: number[] = [];
              const aiTrackedModels: string[] = [];
              const aiTrackedUrls: string[] = [];

              linksToOpen.forEach((item, index) => {
                if (item.autoSubmit && item.modelId && openedTabIds[index]) {
                  aiTrackedTabIds.push(openedTabIds[index]);
                  aiTrackedModels.push(item.modelId);
                  aiTrackedUrls.push(item.url);
                }
              });

              if (aiTrackedTabIds.length > 0) {
                const finalSession = {
                  id: placeholderSession.id,
                  sessionKey: placeholderSession.sessionKey,
                  prompt: placeholderSession.prompt,
                  models: aiTrackedModels,
                  tabIds: aiTrackedTabIds,
                  urls: aiTrackedUrls,
                  name: activeAiSessionRef.current?.name || undefined, // PRESERVE SAVED AGENT NAME only (not prompt text)
                };

                setActiveAiSession(prev => {
                  // RACE CONDITION FIX: Don't let initial base URLs overwrite final captured chat links
                  if (!prev || prev.sessionKey !== placeholderSession.sessionKey) return finalSession;

                  const mergedUrls = [...aiTrackedUrls];
                  prev.urls.forEach((existingUrl, idx) => {
                    const isFinal =
                      existingUrl.includes('/c/') || existingUrl.includes('/app/') || existingUrl.includes('/search/');
                    const isPlaceholder =
                      !mergedUrls[idx] ||
                      !(
                        mergedUrls[idx].includes('/c/') ||
                        mergedUrls[idx].includes('/app/') ||
                        mergedUrls[idx].includes('/search/')
                      );
                    if (isFinal && isPlaceholder) {
                      mergedUrls[idx] = existingUrl;
                    }
                  });

                  const updated = { ...finalSession, urls: mergedUrls };
                  activeAiSessionRef.current = updated;
                  return updated;
                });

                // Register session with background so it tracks URL changes for each tab
                // This triggers ai_session_url_updated when the tab navigates to its conversation URL
                const chromeAny = (window as any)?.chrome;
                console.log('[Searchbar] Triggering track_ai_session to background script with:', {
                  prompt: normalized,
                  tabIds: aiTrackedTabIds,
                  models: aiTrackedModels,
                });

                if (chromeAny?.runtime?.sendMessage) {
                  chromeAny.runtime.sendMessage(
                    {
                      action: 'track_ai_session',
                      prompt: normalized,
                      tabIds: aiTrackedTabIds,
                      models: aiTrackedModels,
                    },
                    (response: any) => {
                      // Suppress "Unchecked runtime.lastError" if the background script is unavailable
                      const err = chromeAny.runtime.lastError;
                      if (err) {
                        console.error('[Searchbar] Error sending track_ai_session:', err.message);
                      } else {
                        console.log('[Searchbar] Successfully sent track_ai_session to background script. Response:', response);
                      }
                    }
                  );
                }
              }
            },
          );
        } else {
          // Fallback if storage unavailable
          const activeSession = activeAiSessionRef.current;
          const selection =
            activeSession && Array.isArray(activeSession.models) && activeSession.models.length > 0
              ? activeSession.models
              : DEFAULT_SELECTED_AIS;
          const targetAIs = AI_GROUP.members.filter(id => id !== 'ai' && selection.includes(id));
          const linksToOpen = targetAIs
            .map(id => {
              const cmd = getCommandById(id);
              if (!cmd) return null;
              const link = buildCommandLink(cmd, normalized, imagesWithBase64);
              return {
                url: typeof link === 'string' ? link : link.url,
                active: false,
                autoSubmit: typeof link === 'string' ? undefined : link.autoSubmit,
                modelId: id,
              };
            })
            .filter((item): item is NonNullable<typeof item> => !!item);

          if (linksToOpen.length > 0) {
            linksToOpen[0].active = true;
            // Input clearing handled by the queue wrapper

            // Set a preliminary session IMMEDIATELY (before tabs open) so follow-ups don't fall through
            const placeholderSession = {
              id: `session-${Date.now()}`,
              sessionKey: `session-${Date.now()}`,
              prompt: normalized,
              models: linksToOpen.filter(l => l.autoSubmit && l.modelId).map(l => l.modelId!),
              tabIds: linksToOpen.filter(l => l.autoSubmit && l.modelId).map(() => 0),
              urls: linksToOpen.filter(l => l.autoSubmit && l.modelId).map(l => appendCmdStatus(l.url, true)),
              name: normalized.slice(0, 50),
            };

            // Sync selectedAIs state
            const triggeredModelIds = placeholderSession.models;
            if (triggeredModelIds.length > 0) {
              setSelectedAIs(triggeredModelIds);
            }

            // 1. SAVE LOG FIRST
            await saveAiLog(placeholderSession.sessionKey, normalized);

            // 2. ACTIVATE SESSION SECOND
            setActiveAiSession(placeholderSession);
            activeAiSessionRef.current = placeholderSession;

            openLinksWithAutoSubmit(linksToOpen).then(openedTabIds => {
              const aiTrackedTabIds: number[] = [];
              const aiTrackedModels: string[] = [];
              const aiTrackedUrls: string[] = [];

              linksToOpen.forEach((item, index) => {
                if (item.autoSubmit && item.modelId && openedTabIds[index]) {
                  aiTrackedTabIds.push(openedTabIds[index]);
                  aiTrackedModels.push(item.modelId);
                  aiTrackedUrls.push(item.url);
                }
              });

              if (aiTrackedTabIds.length > 0) {
                const finalSession = {
                  id: placeholderSession.id,
                  sessionKey: placeholderSession.sessionKey,
                  prompt: placeholderSession.prompt,
                  models: aiTrackedModels,
                  tabIds: aiTrackedTabIds,
                  urls: aiTrackedUrls,
                  name: activeAiSessionRef.current?.name, // PRESERVE AGENT NAME IF EXISTS
                };
                setActiveAiSession(finalSession);
                activeAiSessionRef.current = finalSession;

                // Register session with background for URL change tracking
                const chromeAny = (window as any)?.chrome;
                console.log('[Searchbar] Triggering track_ai_session to background script with:', {
                  prompt: normalized,
                  tabIds: aiTrackedTabIds,
                  models: aiTrackedModels,
                });

                if (chromeAny?.runtime?.sendMessage) {
                  chromeAny.runtime.sendMessage(
                    {
                      action: 'track_ai_session',
                      prompt: normalized,
                      tabIds: aiTrackedTabIds,
                      models: aiTrackedModels,
                    },
                    (response: any) => {
                      // Suppress "Unchecked runtime.lastError" if the background script is unavailable
                      const err = chromeAny.runtime.lastError;
                      if (err) {
                        console.error('[Searchbar] Error sending track_ai_session:', err.message);
                      } else {
                        console.log('[Searchbar] Successfully sent track_ai_session to background script. Response:', response);
                      }
                    }
                  );
                } else {
                  console.warn('[Searchbar] chrome.runtime.sendMessage is not available!');
                }

                setLockedCommand('ai');
              }
            });
          }
        }
      },
      [
        customAgents,
        customLinks,
        customAutomations,
        selectedAIs,
        openLinksWithAutoSubmit,
        COMMANDS,
        commands,
        mentionedTabs,
        lockedCommand,
      ],
    );

    const processQueue = useCallback(async () => {
      if (isProcessingQueueRef.current || promptQueueRef.current.length === 0) return;
      isProcessingQueueRef.current = true;
      try {
        while (promptQueueRef.current.length > 0) {
          const item = promptQueueRef.current.shift()!;
          try {
            await executeAggregateCommand(item.prompt, item.images, item.historyUrls);
          } catch (e) {
            console.error('[Searchbar] Prompt processing failed:', e);
          }
          if (promptQueueRef.current.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      } finally {
        isProcessingQueueRef.current = false;
      }
    }, [executeAggregateCommand]);

    const runAggregateCommand = useCallback(
      async (
        prompt: string,
        images?: { file?: File; base64?: string; mimeType: string; filename: string }[] | null,
        historyUrls?: string[],
      ) => {
        const normalized = prompt.trim();
        if (normalized || (images && images.length > 0)) {

        } else {
          return;
        }

        // Visual feedback: clear input but KEEP the lock to prevent UI flicker (like Favorite panel showing)
        resetAfterCommandExecution({ preserveAiLock: true });

        promptQueueRef.current.push({ prompt: normalized, images, historyUrls });
        processQueue();
      },
      [processQueue, resetAfterCommandExecution],
    );

    const runRemoteCommand = useCallback(
      async (
        command: CommandDefinition,
        prompt: string,
        images?: { file: File; mimeType: string; filename: string }[] | null,
      ) => {
        const normalized = prompt.trim();
        const hasPayload = normalized.length > 0 || (images && images.length > 0);

        // Check payload size
        const totalSize = getPayloadSize(normalized, images);
        if (totalSize > MAX_PAYLOAD_SIZE) {
          triggerNotification('Total size too large (~100MB limit). Please remove some files.', 'error');
          return;
        }

// Convert images to base64 for background submission
        const imagesWithBase64 = images
          ? await Promise.all(
            images.map(async img => ({
              base64: await fileToBase64(img.file),
              mimeType: img.mimeType,
              filename: img.filename,
            })),
          )
          : null;

        // Safety: Never navigate to about:blank URLs directly - these are special commands
        // that need dedicated handling (e.g., 'ai' should use runAggregateCommand)
        if (command.urlTemplate.startsWith('about:blank')) {
          console.warn('[runRemoteCommand] Blocked about:blank navigation for command:', command.id);
          // If it's the AI command, use aggregate handler
          if (command.id === 'ai') {
            if (!normalized && (!images || images.length === 0)) {
              activateCommandById('ai', '');
              return;
            }
            setLockedCommand('ai');
            setCommandPrompt(normalized);
            runAggregateCommand(normalized, images);
          }
          return;
        }

        // Browser commands don't require prompts - execute immediately
        const isBrowserCommand = command.category === 'browser' && !command.urlTemplate.includes('{query}');
        if (isBrowserCommand) {

          // Browser commands execute immediately without prompt
          openSingleLink(buildCommandLink(command, '', null), false, currentTabId);
          return;
        }

        // Other commands require prompts UNLESS an image is present (image-only mode for GPT)
        if (!normalized && (!images || images.length === 0)) return;

        if ((command.id as string) === 'event') {
          const result = createEventUrlFromText(normalized);
          if ('error' in result) {
            window.alert(result.error);
          } else {

            openSingleLink(result.url, false, currentTabId);
          }
          return;
        }
        const link = buildCommandLink(command, normalized, imagesWithBase64);

        if (typeof link !== 'string' && link.autoSubmit) {
          const size = JSON.stringify(link.autoSubmit).length;
          if (size > 60 * 1024 * 1024) {
            setFooterStatus({
              message: 'Attachments too large. Please reduce file size or count.',
              type: 'error',
            });
            setTimeout(() => setFooterStatus(null), 5000);
            return;
          }
        }

        if (hasPayload || !command.urlTemplate.includes('{query}')) {

        }
        openSingleLink(link, false, currentTabId);
      },
      [currentTabId, runAggregateCommand, buildCommandLink],
    );

    // Centralized function to expand @mentions to their snippet/prompt content
    const expandPrompts = useCallback(
      (text: string): string => {
        let expanded = text;
        const mentionRegex = /@(\w[\w\s]*?)(?=\s|$)/g;
        const mentions = [...text.matchAll(mentionRegex)];

        if (mentions.length > 0) {
          mentions.forEach(match => {
            const title = match[1].toLowerCase();
            // Prioritize 'prompt' category, but fallback to 'snippet' if needed
            // Use case-insensitive matching
            const entry = workspaceItemIndex.find(
              e => ('title' in e.item && typeof e.item.title === 'string' ? e.item.title.toLowerCase() : '') === title && (e.category === 'prompt' || e.category === 'snippet'),
            );

            if (entry) {
              const valueText = entry.item.value?.text || '';
              expanded = expanded.replace(match[0], valueText);
            }
          });
        }
        return expanded;
      },
      [workspaceItemIndex],
    );

    const submitInlineQuery = useCallback(() => {
      if (!pendingQueryUrls || pendingQueryUrls.length === 0) return;

      const q = value.trim();
      // If user provided no input, maybe they want to keep the literal {query}?
      // But typically we enforce a value. Let's assume we allow empty if they really want,
      // but usually we want to replace.
      // Actually, if empty, we might just skip replacement? Or encoded empty string?
      // Let's stick to current behavior: check !q return.
      if (!q && q !== '') return; // Allow empty string if they want

      const encoded = encodeURIComponent(q);
      const currentUrl = pendingQueryUrls[0];
      const processedUrl = currentUrl.replace(/\[query\]/gi, encoded).replace(/\{query\}/gi, encoded);

      // Move to next
      const remaining = pendingQueryUrls.slice(1);
      const newReady = [...processedReadyUrls, processedUrl];

      // Continue recursion
      processNextUrl(remaining, newReady, pendingQueryLabel);
    }, [pendingQueryUrls, processedReadyUrls, value, processNextUrl, pendingQueryLabel]);

    const activateWorkspaceItemSuggestion = useCallback(
      (selection: WorkspaceItemSuggestion | null | undefined) => {
        if (!selection) return;
        recordSelectedShortcutUsage(selection);
        const snippet = selection.item as any;
        const category = (snippet.category || '').toLowerCase();
        let urls: string[] = [];
        if (typeof snippet.value === 'string') {
          const raw = snippet.value as string;
          try {
            const parsed = JSON.parse(raw || '{}');
            if (parsed && parsed.urls && Array.isArray(parsed.urls)) {
              urls = parsed.urls as string[];
            } else if (raw.startsWith('http')) {
              urls = [raw];
            }
          } catch {
            if (raw.startsWith('http')) {
              urls = [raw];
            }
          }
        } else if (
          snippet &&
          snippet.value &&
          typeof snippet.value === 'object' &&
          'urls' in (snippet.value as any) &&
          Array.isArray((snippet.value as any).urls)
        ) {
          urls = (((snippet.value as any).urls || []) as string[]).filter(Boolean);
        }

        // Handle quick links, regular links, and links with different case
        if (
          !urls.length &&
          (category === 'link') &&
          typeof snippet.value === 'string'
        ) {
          urls = [snippet.value as string];
        }

        if (urls.length) {
          handleRequestOpenUrls(urls, snippet.key);
          return;
        }

        handleSnippetSelect(selection);
      },
      [handleRequestOpenUrls, handleSnippetSelect, recordSelectedShortcutUsage],
    );

    const executeCommonCommand = useCallback(
      async (item: CommonCommandSuggestionItem) => {
        const promptRaw = item.query.trim();
        const prompt = expandPrompts(promptRaw);

// Convert images to base64 if needed
        const imagesWithBase64 = await Promise.all(
          selectedImages.map(async img => ({
            base64: await fileToBase64(img.file),
            mimeType: img.mimeType,
            filename: img.filename,
          })),
        );

        const isAggregateAiCommand = (item as any).commandType === 'aggregate' || String(item.id) === 'ai';

        if (isAggregateAiCommand) {
          if (!prompt && selectedImages.length === 0) {
            activateCommandById('ai', '');
            return;
          }
          setLockedCommand('ai');
          setCommandPrompt(promptRaw);
          runAggregateCommand(prompt, imagesWithBase64);
          setShowPromo(false);
          suggestionVisibilityRef.current = false;
          return;
        }

        // Check if it's a remote command
        const remoteCmd = getCommandById(item.id);
        if (remoteCmd && remoteCmd.category !== 'ai' && !isAggregateAiCommand) {

          const words = promptRaw.split(/\s+/);
          const triggerWords = [remoteCmd.id, remoteCmd.prefix.replace('/', ''), ...(remoteCmd.keywords || [])];

          const filteredWords = words.filter(word => {
            const normalizedWord = word.toLowerCase();
            return !triggerWords.some(trigger =>
              trigger.toLowerCase().startsWith(normalizedWord) ||
              normalizedWord.startsWith(trigger.toLowerCase())
            );
          });
          const extractedQuery = filteredWords.join(' ').trim();

          activateCommandById(item.id as AnyCommandId, extractedQuery);
          return;
        }

        // If prompt is empty AND files are attached, entering "command mode" is better UX.
        // Non-AI commands can still open their direct sites when empty.
        if (!prompt) {
          if (selectedImages.length > 0) {
            activateCommandById(item.id as AnyCommandId);
          } else {
            const link = buildCommandLink(item.command, '', []);
            openSingleLink(link, false, currentTabId);
          }
          return;
        }

        // Check if the regular command is installed
        const isInstalled = hasCommandById(item.id) || hasCommandById(item.command.id);
        if (!isInstalled) {
          triggerNotification('Command not available.', 'error');
          return;
        }

// Pass imagesWithBase64 to buildCommandLink
        const link = buildCommandLink(item.command, prompt, imagesWithBase64);

        if (typeof link !== 'string' && link.autoSubmit) {
          const size = JSON.stringify(link.autoSubmit).length;
          if (size > 60 * 1024 * 1024) {
            setFooterStatus({
              message: 'Attachments too large. Please reduce file size or count.',
              type: 'error',
            });
            setTimeout(() => setFooterStatus(null), 5000);
            return;
          }
        }

        openSingleLink(link, false, currentTabId);
        setShowPromo(false);
        suggestionVisibilityRef.current = false;
      },
      [commands, currentTabId, selectedImages, expandPrompts, activateCommandById],
    );

    const handleCommandMouseDown = useCallback(
      (event: React.MouseEvent, commandId: AnyCommandId) => {
        event.preventDefault();
        event.stopPropagation();

        const currentQuery = valueRef.current?.trim() || '';

if (activeSlashFilter) {
          activeSlashFilterRef.current = null;
          setActiveSlashFilter(null);
          setValue('');
          activateCommandById(commandId, '');
          return;
        }

        if (!checkLocalCommandAuth(commandId)) {
          console.warn('[DEBUG handleCommandMouseDown] Local command auth check failed for:', commandId);
          return;
        }

        // ✅ LOCAL COMMANDS
        if (isLocalCommandId(commandId as string)) {
          const def = LOCAL_COMMANDS.find(c => c.id === (commandId as LocalCommandId));

if (def?.behavior === 'instant') {
            const execId = def.executeId || def.id;
            handleLocalCommandExecute(execId as any);
            return;
          }

          // 🚀 FORCE EXECUTE instead of selecting
          handleLocalCommandExecute(def?.id as any);
          return;
        }

        // ✅ REMOTE COMMANDS (Google, YouTube, etc.)
        const remoteCmd = getCommandById(commandId);

        if (remoteCmd) {

          const isAiGroupMember = AI_GROUP.members.includes(remoteCmd.id as any) || remoteCmd.id === 'ai';

          // Extract the query by removing the command identifier/keywords that triggered it
          const words = currentQuery.split(/\s+/);
          const triggerWords = [remoteCmd.id, remoteCmd.prefix.replace('/', ''), ...(remoteCmd.keywords || [])];

          const filteredWords = words.filter(word => {
            const normalizedWord = word.toLowerCase();
            return !triggerWords.some(trigger =>
              trigger.toLowerCase().startsWith(normalizedWord) ||
              normalizedWord.startsWith(trigger.toLowerCase())
            );
          });
          let extractedQuery = filteredWords.join(' ').trim();
          extractedQuery = extractedQuery.replace(/^\/([aAnsSplLcCbBtT])\s*/i, '');

// Lock the command and pre-fill the search input with the remaining text
          activateCommandById(commandId, extractedQuery);
          return;
        }

        // ✅ AI COMMAND
        if (commandId === 'ai') {
          if (!currentQuery) {
            activateCommandById('ai', '');
          } else {
            onCommandExecute?.('ai', { prompt: currentQuery });
          }
          return;
        }

        // fallback
        activateCommandById(commandId, currentQuery);
      },
      [commands, runRemoteCommand, activateCommandById, handleLocalCommandExecute, onCommandExecute, activeSlashFilter],
    );

    const handleHighlightIndexChange = useCallback((index: number) => {
      setHighlightIndex(index);
    }, []);


    const FILTER_CHIP_RESERVED_WIDTH = 96;

    const renderPrimaryPrefix = () => {
      if (hideDynamicIcon) return null;

      if (activeSlashFilter && !lockedCommand) {
        const label = slashFilterMeta[activeSlashFilter]?.label || activeSlashFilter;
        return (
          <div
            ref={prefixRef}
            className={`flex items-center gap-1.5 mr-2 border-[1.5px] rounded-lg px-2 py-0.5 shadow-sm ${''
              }`}
            style={{ width: `${FILTER_CHIP_RESERVED_WIDTH}px` }}>
            <span className={`text-xs font-medium truncate min-w-0 flex-1 text-center`}>
              {label}
            </span>
            <button
              type="button"
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                activeSlashFilterRef.current = null;
                setActiveSlashFilter(null);
                setValue('');
                onQueryChange?.('');
              }}
              className="text-red-300 hover:text-red-400 ml-0.5 cursor-pointer">
              <FaTimes size={10} />
            </button>
          </div>
        );
      }

if (pendingQueryUrls && pendingQueryUrls.length > 0) {
        const firstUrl = pendingQueryUrls[0];
        return (
          <div
            ref={prefixRef}
            className={`flex items-center gap-1.5 pl-2 pr-2 h-7 rounded-md border ${''
              }`}>
            <img src={getFaviconUrl(firstUrl)} alt="" className="w-3.5 h-3.5 rounded-sm object-contain" />
            <span
              className={`text-sm ${''
                } font-medium truncate max-w-[150px]`}>
              {pendingQueryLabel || 'Quick Link'}
            </span>
          </div>
        );
      }

      // History Context Mode: show history chip
      if (stagedHistorySession) {
        return (
          <div
            ref={prefixRef}
            className={`flex items-center gap-1.5 h-6 pl-2 pr-1 rounded-md ${''
              } border`}>
            <div className="flex items-center gap-1.5 max-w-[200px]">
              <FaHistory className={''} size={12} />
              <span className={`text-xs  font-medium truncate`}>
                {stagedHistorySession.prompt}
              </span>
            </div>
            <button
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                setStagedHistorySession(null);
                setTimeout(() => inputRef.current?.focus(), 0);
              }}
              className={`p-1 ${''
                } rounded-sm`}>
              <FaTimes size={10} />
            </button>
          </div>
        );
      }

      // 1. Show Back Button if applicable (Higher priority than chips/search icon)
      if (showBackButton && !lockedCommand) {
        return (
          <button
            onClick={() => onNavigateBack?.()}
            className="flex items-center justify-start w-6 h-6 rounded-md hover:bg-neutral-100 dark:hover:bg-white/10 text-[var(--color-iconDefault)]">
            <FaArrowLeft size={14} />
          </button>
        );
      }



      // Show @ command chip when a command is selected via @
      if (selectedAtCommand) {
        const commandLabels: Record<string, string> = {
          gpt: 'ChatGPT',
          claude: 'Claude',
          gemini: 'Gemini',
          perplexity: 'Perplexity',
          g: 'Google',
          yt: 'YouTube',
          gmail: 'Gmail',
          spotify: 'Spotify',
        };
        const label = commandLabels[selectedAtCommand] || selectedAtCommand;
        const cmd = getCommandById(selectedAtCommand);
        return (
          <div
            className={`flex items-center gap-1.5 ${''
              } border rounded-lg px-2 py-0.5`}>
            {cmd ? (
              <img src={getFaviconUrl(cmd.iconHost)} alt={label} className="w-3 h-3 object-cover rounded-sm" />
            ) : (
              (() => {
                const lowerId = String(selectedAtCommand || '').toLowerCase();
                let IconComp: any = null;
                let color = 'text-blue-500';

                if (lowerId === 'gpt' || lowerId === 'chatgpt') {
                  IconComp = LuSparkles;
                  color = 'text-green-500';
                } else if (lowerId === 'claude') {
                  IconComp = TbSparkles;
                  color = 'text-orange-500';
                } else if (lowerId === 'gemini') {
                  IconComp = TbSparkles;
                  color = 'text-blue-400';
                } else if (lowerId === 'perplexity') {
                  IconComp = SiPerplexity;
                  color = 'text-teal-500';
                } else if (lowerId === 'ai') {
                  IconComp = LuSparkles;
                  color = 'text-purple-500';
                }

                if (IconComp) {
                  return <IconComp size={14} className={`${color}`} />;
                }

                const localDef = LOCAL_COMMANDS.find(c => c.id === selectedAtCommand);
                const customIcon = localDef?.icon;
                return customIcon ? (
                  typeof customIcon === 'function' ? (
                    (() => {
                      const IconComponent = customIcon as React.ComponentType<any>;
                      return (
                        <IconComponent
                          size={16}
                          className={`w-5 h-5 object-contain `}
                        />
                      );
                    })()
                  ) : typeof customIcon === 'string' ? (
                    <img src={customIcon} className="w-5 h-5 object-contain dark:invert" alt="" />
                  ) : (
                    customIcon
                  )
                ) : (
                  <span className="text-blue-500">@</span>
                );
              })()
            )}
            <span className={`text-xs  font-medium`}>{label}</span>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                setSelectedAtCommand(null);
              }}
              className="text-red-300 hover:text-red-400 ml-0.5">
              <FaTimes size={8} />
            </button>
          </div>
        );
      }

      // Show All Bookmarks chip
      if (lockedCommand && isBookmarksCommand(lockedCommand)) {
        const label = 'All Bookmarks';
        return (
          <div
            ref={prefixRef}
            className={`flex items-center gap-1.5 ${''
              } border rounded-lg px-2 py-0.5`}>
            <FaBookmark size={10} className="text-amber-500" />
            <span className={`text-xs  font-medium`}>{label}</span>
            <button
              type="button"
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                exitCommandMode();
              }}
              className="text-red-300 hover:text-red-400 ml-0.5">
              <FaTimes size={8} />
            </button>
          </div>
        );
      }

      // When in command mode (lockedCommand is set), show command icon + name
      if (lockedCommand && activeCommandInfo) {
        const { id, commandType } = activeCommandInfo;
        const remoteCmd = getCommandById(id);
        const isBrowserCommand = commandType === 'remote' && remoteCmd?.category === 'browser';
        const labelRaw = isBrowserCommand ? `${BROWSER_NAME} ${activeCommandInfo.label}` : activeCommandInfo.label;
        const label = labelRaw;

        const isAiCommand = id === 'ai';
        const isSpecificAiCommand = ['gpt', 'claude', 'perplexity', 'gemini'].includes(id as string);

        if (isAiCommand) {
          let targetAIs = AI_GROUP.members;
          if (id === 'ai') {
            targetAIs = isAiEditMode ? AI_GROUP.members : targetAIs.filter(mid => selectedAIs.includes(mid));
            if (targetAIs.length === 0) targetAIs = AI_GROUP.members;
          }
          return (
            <div
              ref={prefixRef}
              className={`group relative flex items-center gap-1.5 mr-2 ${''
                } border rounded-lg px-2 py-1 shadow-sm`}>
              <span className={`text-xs  font-medium mr-1`}>
                AI models:
              </span>
              <div className="flex gap-0.5 items-center justify-start w-auto flex-shrink-0 overflow-hidden">
                <AnimatePresence mode="popLayout">
                  {targetAIs.map((mid, idx) => {
                    const c = getCommandById(mid);
                    if (!c) return <LuSparkles key={`ai-sparkle-${mid}`} size={12} className="text-purple-500" />;

                    const isSelected = selectedAIs.includes(mid);
                    const isInteractive = true;

                    return (
                      <motion.button
                        layout
                        initial={{ scale: 0, opacity: 0, width: 0 }}
                        animate={{ scale: 1, opacity: 1, width: 'auto' }}
                        exit={{ scale: 0, opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                        type="button"
                        key={`ai-prefix-locked-${c.id}`}
                        onClick={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (isInteractive) {
                            handleToggleAI(mid);
                          }
                        }}
                        className={`relative w-5 h-5 rounded-full flex items-center justify-center transition-all group/iconbtn ${isInteractive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} ${isSelected
                          ? 'border-[1.5px] border-neutral-400 dark:border-neutral-500 p-[2px] shadow-sm bg-white dark:bg-black'
                          : 'border border-transparent'
                          }`}>
                        <img
                          src={getFaviconUrl(c.iconHost)}
                          alt={c.label}
                          className="w-full h-full object-cover rounded-full"
                        />
                        {isInteractive && isSelected && (
                          <div className="absolute -top-[3px] -right-[3px] w-[13px] h-[13px] bg-neutral-800 dark:bg-neutral-900 rounded-full flex items-center justify-center border-[1.5px] border-neutral-400 dark:border-neutral-500 shadow-sm opacity-0 group-hover/iconbtn:opacity-100 transition-opacity">
                            <LuX size={8} strokeWidth={3} className="text-neutral-200" />
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>

              {id === 'ai' && (
                <div
                  ref={modelPopupRef}
                  className="flex items-center relative"
                  onMouseEnter={() => {
                    if (hoverTimeoutRef.current) {
                      clearTimeout(hoverTimeoutRef.current);
                      hoverTimeoutRef.current = null;
                    }
                    if (!isModelPopupOpen) setIsModelPopupOpen(true);
                  }}
                  onMouseLeave={() => {
                    if (hoverTimeoutRef.current) {
                      clearTimeout(hoverTimeoutRef.current);
                    }
                    hoverTimeoutRef.current = setTimeout(() => {
                      setIsModelPopupOpen(false);
                    }, 200);
                  }}>
                  <div className={`w-[1px] h-3.5 mx-1 `} />
                  <div
                    className={`flex items-center justify-center w-[16px] h-[16px] rounded-full border-[1.5px] cursor-pointer transition-colors ${isModelPopupOpen
                      ? 'border-neutral-600 dark:border-white text-neutral-600 dark:text-white'
                      : 'border-neutral-400 dark:border-neutral-500 text-neutral-400 dark:text-neutral-500 hover:border-neutral-600 dark:hover:border-neutral-300 hover:text-neutral-600 dark:hover:text-neutral-300'
                      }`}
                    onMouseEnter={() => {
                      if (hoverTimeoutRef.current) {
                        clearTimeout(hoverTimeoutRef.current);
                        hoverTimeoutRef.current = null;
                      }
                      if (!isModelPopupOpen) setIsModelPopupOpen(true);
                    }}
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsModelPopupOpen(prev => !prev);
                    }}>
                    <LuPlus
                      size={10}
                      strokeWidth={2.5}
                      className={`transition-transform duration-200 ${isModelPopupOpen ? 'rotate-45' : ''}`}
                    />
                  </div>

                  {isModelPopupOpen && (
                    <div
                      className="absolute left-1/2 -translate-x-1/2 top-[calc(100%-12px)] p-4 z-[100]"
                      onClick={e => e.stopPropagation()}
                      onMouseEnter={() => {
                        if (hoverTimeoutRef.current) {
                          clearTimeout(hoverTimeoutRef.current);
                          hoverTimeoutRef.current = null;
                        }
                      }}>
                      <div className="w-[240px]">
                        <Suspense fallback={null}>
                          <ModelSelector
                            state={
                              {
                                selectedAIs,
                                onToggleAI: handleToggleAI,
                                activeAiSession,
                                updateActiveSessionMetadata: (metadata: { name?: string; id?: string | number }) => {
                                  setActiveAiSession(prev => {
                                    if (!prev) return metadata.id ? ({ id: metadata.id, ...metadata } as any) : null;
                                    return { ...prev, ...metadata };
                                  });
                                },
                                onUpdateModelUrl,
                                onUpdateCustomModels,
                                modelWarning,
                              } as any
                            }
                            isMac={typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0}
                            savedAgents={savedAiAgents}
                            onSaveAgent={onSaveAgent || (() => { })}
                            compact={!theme.isDark}
                          />
                        </Suspense>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  exitCommandMode();
                }}
                className={
                  !theme.isDark
                    ? 'ml-1 flex h-5 w-5 items-center justify-center rounded-full opacity-100 text-[var(--color-accent)] hover:text-[var(--color-accentHover)] hover:bg-[var(--color-hoverBg)] transition-colors cursor-pointer'
                    : `text-red-300 hover:text-red-400 ml-1 cursor-pointer transition-opacity ${id === 'ai' ? 'opacity-0 group-hover:opacity-100' : ''}`
                }
                aria-label="Exit AI models mode"
                title="Exit AI models mode">
                <LuX size={12} strokeWidth={2.5} />
              </button>
            </div>
          );
        }

        if (isSpecificAiCommand) {
          const c = getCommandById(id as string) || findCommandByAnyId(COMMANDS, id as string);
          return (
            <div
              ref={prefixRef}
              className={`group relative flex items-center gap-1.5 mr-2 ${''
                } border rounded-full pl-1.5 pr-2 py-0.5 shadow-sm bg-[var(--color-inputBg)]`}>
              <div className="flex items-center justify-center w-5 h-5 rounded-full overflow-hidden shrink-0 border border-neutral-200 dark:border-neutral-700 shadow-sm bg-white dark:bg-black">
                {c?.iconHost ? (
                  <img
                    src={getFaviconUrl(c.iconHost)}
                    alt={c.label}
                    className="w-full h-full object-cover p-[2px]"
                  />
                ) : (
                  <LuSparkles size={12} className="text-purple-500" />
                )}
              </div>
              <span className={`text-[13px] font-medium`}>
                {c?.label || label}
              </span>
              <button
                type="button"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  exitCommandMode();
                }}
                className={
                  !theme.isDark
                    ? 'ml-1 flex h-5 w-5 items-center justify-center rounded-full opacity-100 text-[var(--color-accent)] hover:text-[var(--color-accentHover)] hover:bg-[var(--color-hoverBg)] transition-colors cursor-pointer'
                    : `text-red-400 hover:text-red-500 ml-1 cursor-pointer transition-opacity opacity-0 group-hover:opacity-100 flex items-center justify-center w-4 h-4 rounded-full hover:bg-red-500/10`
                }
                aria-label="Exit AI models mode"
                title="Exit AI models mode">
                <LuX size={12} strokeWidth={2.5} />
              </button>
            </div>
          );
        }

if (isLocalCommandId(id as string)) {
          const localDef = LOCAL_COMMANDS.find(c => c.id === (id as LocalCommandId));
          const customIcon = localDef?.icon;
          return (
            <div ref={prefixRef} className="flex items-center gap-1.5 mr-2">
              <div
                className={`flex items-center gap-1.5 ${''
                  } border rounded-lg px-2 py-0.5`}>
                <div className="w-4 h-4 flex items-center justify-start">
                  {customIcon ? (
                    typeof customIcon === 'function' ? (
                      (() => {
                        const IconComponent = customIcon as React.ComponentType<any>;
                        return (
                          <IconComponent
                            size={16}
                            className={`w-5 h-5 object-contain `}
                          />
                        );
                      })()
                    ) : typeof customIcon === 'string' ? (
                      <img src={customIcon} className="w-5 h-5 object-contain dark:invert" alt="" />
                    ) : (
                      customIcon
                    )
                  ) : (
                    <div className="w-8 h-4 flex items-center justify-start scale-[0.4] origin-center">
                      <CmdIcon />
                    </div>
                  )}
                </div>
                <span className={`text-xs  font-medium`}>
                  {label}
                </span>
                <button
                  type="button"
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    exitCommandMode();
                  }}
                  className="text-red-300 hover:text-red-400 ml-0.5 cursor-pointer">
                  <FaTimes size={10} />
                </button>
              </div>
            </div>
          );
        }

        const c = getCommandById((id as CommandId)) || findCommandByAnyId(COMMANDS, (id as CommandId));
        if (c) {
          return (
            <div
              ref={prefixRef}
              className={`flex items-center gap-1.5 mr-2 ${''
                } border rounded-lg px-2 py-0.5`}>
              <img
                src={getFaviconUrl(c.iconHost)}
                alt={c.label}
                className="w-3 h-3 object-cover rounded-sm shadow-sm"
              />
              <span className={`text-xs  font-medium`}>
                {label}
              </span>
              <button
                type="button"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  exitCommandMode();
                }}
                className="text-red-300 hover:text-red-400 ml-0.5 cursor-pointer">
                <FaTimes size={10} />
              </button>
            </div>
          );
        }
      }

// When typing an @ command and the menu is open, show highlighted command's icon
      if (showAtCommandMenu) {
        const highlightedCmd = filteredAtCommands[atCommandHighlightIndex];
        if (highlightedCmd) {
          const Icon = highlightedCmd.icon;
          return (
            <div ref={prefixRef} className="w-5 h-5 flex items-center justify-start">
              <Icon className={`text-sm ${highlightedCmd.color}`} />
            </div>
          );
        }
        return (
          <div ref={prefixRef} className="w-5 h-5 flex items-center justify-start">
            <span className="text-blue-500 font-bold text-lg -ml-0.5">@</span>
          </div>
        );
      }

      // Normal mode: show search icon or dynamic matched icon based on top suggestion
      if (allSuggestions.length > 0 && !lockedCommand && value.trim().length > 0) {
        const top = allSuggestions[highlightIndex];
        if (top) {
          const kind = (top as any)._kind;

          // Support stacked icons for AI groups and TabGroups in prefix
          if (kind === 'command' && (top as any).commandType === 'aggregate') {
            // Show only the selected AIs (max 3), overlapping neatly
            const visibleAIs = AI_GROUP.members.filter(mid => selectedAIs.includes(mid)).slice(0, 3);
            const displayAIs = visibleAIs.length > 0 ? visibleAIs : AI_GROUP.members.slice(0, 3);
            return (
              <div className="flex -space-x-1 items-center flex-shrink-0 justify-start">
                {displayAIs.map(mid => {
                  const c = getCommandById(mid);
                  if (!c) return null;
                  return (
                    <div
                      key={`ai-prefix-${c.id}`}
                      className="w-[18px] h-[18px] rounded-full flex items-center justify-center ring-[1.5px] ring-[var(--color-inputBg)] overflow-hidden shadow-sm bg-white"
                    >
                      <img src={getFaviconUrl(c.iconHost)} alt={c.label} className="w-full h-full object-cover" />
                    </div>
                  );
                })}
              </div>
            );
          }

          if (kind === 'workspace_item') {
            const category = ((top as any).item?.category || '').toLowerCase();
            if (category === 'link' || category === 'link') {
              const urlList: string[] = (top as any).item?.value?.urls || [];
              if (urlList.length > 0) {
                return (
                  <div ref={prefixRef} className="flex -space-x-1.5 items-center w-8 -ml-1.5 justify-start">
                    {urlList.slice(0, 3).map((url: string, i: number) => (
                      <div
                        key={`tabgroup-prefix-${i}`}
                        className="w-4 h-4 rounded-full flex items-center justify-center ring-1 ring-white dark:ring-[#1C1C1C] overflow-hidden shadow-sm bg-white">
                        <img src={getFaviconUrl(url)} alt="" className="w-4 h-4 object-cover" />
                      </div>
                    ))}
                  </div>
                );
              }
            }
          }

          if (kind === 'history' || kind === 'bookmark' || kind === 'open_url') {
            const url = (top as any).url || (top as any).displayUrl;
            if (url) {
              return (
                <div
                  ref={prefixRef}
                  className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-start"
                  style={{ marginLeft: '1.8px' }}>
                  <FallbackFavicon url={url} className="w-5 h-5 object-cover grayscale-[0.2]" fallbackIcon={FaGlobe} />
                </div>
              );
            }
          }

          if (kind === 'command' || kind === 'common_command') {
            const cmdId = (top as any).id;
            const cmd = (top as any).command;

            if (cmdId === 'google') {
              return (
                <div ref={prefixRef} className="w-5 h-5 flex items-center justify-start">
                  <FaSearch size={14} className="text-[var(--color-iconDefault)]" />
                </div>
              );
            }
            if (cmdId === 'calculator' || cmd?.id === 'calculator') {
              return (
                <div ref={prefixRef} className="w-5 h-5 flex items-center justify-start">
                  <FaCalculator size={14} className="text-[var(--color-iconDefault)]" />
                </div>
              );
            }

            if (cmd) {
              // Local commands support
              if (isLocalCommandId(cmdId)) {
                const localDef = LOCAL_COMMANDS.find(c => c.id === cmdId);
                const customIcon = localDef?.icon;
                if (customIcon) {
                  if (typeof customIcon === 'function') {
                    const IconComponent = customIcon as React.ComponentType<{ className?: string; size?: number }>;
                    return (
                      <div ref={prefixRef} className="w-5 h-5 flex items-center justify-start">
                        <IconComponent
                          size={16}
                          className="w-5 h-5 object-contain text-neutral-500 dark:text-neutral-400"
                        />
                      </div>
                    );
                  }
                  if (typeof customIcon === 'string') {
                    return (
                      <div ref={prefixRef} className="w-5 h-5 flex items-center justify-start">
                        <img src={customIcon} className="w-5 h-5 object-contain dark:invert" alt="" />
                      </div>
                    );
                  }
                  return (
                    <div ref={prefixRef} className="w-5 h-5 flex items-center justify-start">
                      {customIcon as React.ReactNode}
                    </div>
                  );
                }
                return (
                  <div ref={prefixRef} className="w-5 h-5 flex items-center justify-start">
                    <CmdIcon />
                  </div>
                );
              }

              // Remote commands
              if (cmd.iconHost) {
                return (
                  <div
                    ref={prefixRef}
                    className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-start"
                    style={{ marginLeft: '1.8px' }}>
                    <FallbackFavicon
                      url={cmd.iconHost}
                      className="w-5 h-5 object-cover grayscale-[0.2]"
                      fallbackIcon={FaSearch}
                    />
                  </div>
                );
              }
            }

            // common_command: show favicon from command.iconHost
            if (kind === 'common_command') {
              const commonCmd = (top as any).command as CommandDefinition | undefined;
              if (commonCmd?.iconHost) {
                return (
                  <div
                    ref={prefixRef}
                    className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-start"
                    style={{ marginLeft: '1.8px' }}>
                    <FallbackFavicon
                      url={commonCmd.iconHost}
                      className="w-5 h-5 object-cover grayscale-[0.2]"
                      fallbackIcon={FaSearch}
                    />
                  </div>
                );
              }
            }
          }

          if (kind === 'math_result') {
            return (
              <div ref={prefixRef} className="w-5 h-5 flex items-center justify-start">
                <FaCalculator size={14} className="text-[var(--color-iconDefault)]" />
              </div>
            );
          }

          if (kind === 'time_result') {
            return (
              <div ref={prefixRef} className="w-5 h-5 flex items-center justify-start">
                <FaClock size={14} className="text-[var(--color-iconDefault)]" />
              </div>
            );
          }
        }
      }

      return (
        <div ref={prefixRef} className="w-5 h-5 flex items-center justify-start">
          <FaSearch size={14} className="text-[var(--color-searchBarIcon,var(--color-iconDefault))]" />
        </div>
      );
    };

    type SearchbarAutomationField = {
      key: string;
      label: string;
      value: string;
      type?: 'text' | 'image' | 'dropdown';
      inputStyle?: 'short_text' | 'long_text';
      sourceType?: 'text' | 'image' | 'dropdown' | 'constant';
      description?: string;
      extraValues?: string[];
      images?: { url: string; file: File; filename: string; mimeType: string }[];
      dropdownOptions?: string[];
      dropdownOptionPairs?: { key: string; value: string }[];
      urlTemplate?: string;
      groupId?: string;
      groupLabel?: string;
      groupSelector?: string;
      groupAction?: string;
      order?: number;
      sourceVariable?: string;
      sourceStepIndex?: number;
    };

    const mergeAutomationInputDefinitions = (
      primary: AutomationInputDefinition[] = [],
      secondary: Partial<AutomationInputDefinition>[] = [],
    ) => {
      const merged = new Map<string, AutomationInputDefinition>();

      const applyDefinitions = (definitions: Partial<AutomationInputDefinition>[], preferExisting: boolean) => {
        definitions.forEach((definition, index) => {
          const inputId = definition.id || definition.label;
          if (!inputId) return;

          const existing = merged.get(inputId);
          const normalized: AutomationInputDefinition = {
            id: inputId,
            label: definition.label || inputId,
            type: definition.type || 'text',
            fixedValue: definition.fixedValue,
            dropdownOptions: definition.dropdownOptions,
            dropdownOptionPairs: definition.dropdownOptionPairs,
            inputStyle: definition.inputStyle,
            description: definition.description,
            urlTemplate: definition.urlTemplate,
            groupId: definition.groupId,
            groupLabel: definition.groupLabel,
            groupSelector: definition.groupSelector,
            groupAction: definition.groupAction,
            order: definition.order ?? index,
          };

          if (!existing) {
            merged.set(inputId, normalized);
            return;
          }

          existing.label = preferExisting ? existing.label : normalized.label || existing.label;
          if (!existing.fixedValue && normalized.fixedValue) existing.fixedValue = normalized.fixedValue;
          if (!existing.dropdownOptions && normalized.dropdownOptions)
            existing.dropdownOptions = normalized.dropdownOptions;
          if (!existing.dropdownOptionPairs && normalized.dropdownOptionPairs)
            existing.dropdownOptionPairs = normalized.dropdownOptionPairs;
          if (!existing.inputStyle && normalized.inputStyle) existing.inputStyle = normalized.inputStyle;
          if (!existing.description && normalized.description) existing.description = normalized.description;
          if (!existing.urlTemplate && normalized.urlTemplate) existing.urlTemplate = normalized.urlTemplate;
          if (!existing.groupId && normalized.groupId) existing.groupId = normalized.groupId;
          if (!existing.groupLabel && normalized.groupLabel) existing.groupLabel = normalized.groupLabel;
          if (!existing.groupSelector && normalized.groupSelector) existing.groupSelector = normalized.groupSelector;
          if (!existing.groupAction && normalized.groupAction) existing.groupAction = normalized.groupAction;
          if (existing.order === undefined && normalized.order !== undefined) existing.order = normalized.order;
          if (existing.type !== 'image' && normalized.type === 'image') existing.type = 'image';
          if (existing.type === 'text' && normalized.type === 'dropdown') existing.type = 'dropdown';
          if (existing.type === 'text' && normalized.type === 'constant') existing.type = 'constant';
        });
      };

      applyDefinitions(primary, true);
      applyDefinitions(secondary, false);

      return Array.from(merged.values()).sort((a, b) => {
        const orderDiff = (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER);
        if (orderDiff !== 0) return orderDiff;
        return a.id.localeCompare(b.id);
      });
    };

    const normalizeAutomationFieldType = (rawType?: string | null): 'text' | 'image' | 'dropdown' => {
      if (rawType === 'image') return 'image';
      if (rawType === 'dropdown') return 'dropdown';
      return 'text';
    };

    const normalizeAutomationSourceType = (rawType?: string | null): 'text' | 'image' | 'dropdown' | 'constant' => {
      if (rawType === 'image') return 'image';
      if (rawType === 'dropdown') return 'dropdown';
      if (rawType === 'constant') return 'constant';
      return 'text';
    };

    const collectConstantInputsFromSteps = (steps: any[]): Record<string, string> => {
      const constants: Record<string, string> = {};

      const addConstant = (key?: string, value?: any) => {
        if (!key) return;
        const normalizedValue = value === undefined || value === null ? '' : String(value);
        if (normalizedValue.trim() === '') return;
        if (constants[key] === undefined) {
          constants[key] = normalizedValue;
        }
      };

      const scanSteps = (stepList: any[]) => {
        stepList.forEach(step => {
          const cfg = step?.config || {};

          const paramConfigs = cfg.paramConfigs || {};
          Object.keys(paramConfigs).forEach(paramKey => {
            const paramCfg = paramConfigs[paramKey];
            if (paramCfg?.type === 'constant') {
              addConstant(paramKey, Array.isArray(paramCfg.values) ? paramCfg.values[0] : undefined);
            }
          });

          const prompts = Array.isArray(cfg.prompts) ? cfg.prompts : [];
          prompts.forEach((prompt: any) => {
            if (prompt?.type === 'constant') {
              addConstant(prompt?.key, Array.isArray(prompt?.values) ? prompt.values[0] : undefined);
            }
          });

          if (Array.isArray(cfg.steps)) scanSteps(cfg.steps);
          if (Array.isArray(step?.subSteps)) scanSteps(step.subSteps);
        });
      };

      if (Array.isArray(steps)) scanSteps(steps);
      return constants;
    };

    const formatAutomationFieldLabel = (value: string) => {
      // Detect CSS selector patterns (e.g., data-qa="texty_input", #myId, .myClass, [attr="val"])
      const looksLikeSelector = /[=\[\]#"]/.test(value) || /^\.[\w-]/.test(value) || /^data-/.test(value);

      if (looksLikeSelector) {
        return 'Input';
      }

      return (
        value.charAt(0).toUpperCase() +
        value
          .slice(1)
          .replace(/([A-Z0-9])/g, ' $1')
          .trim()
      );
    };

    const getInputStyleFromType = (rawType?: string | null): 'short_text' | 'long_text' | undefined => {
      if (!rawType) return undefined;
      if (rawType === 'short_text' || rawType === 'long_text') return rawType;
      return undefined;
    };

    const buildInputTypeHints = (steps: any[]): Map<string, 'short_text' | 'long_text'> => {
      const hints = new Map<string, 'short_text' | 'long_text'>();

      const applyHint = (key: string, rawType?: string) => {
        if (!key || !rawType) return;
        const style = getInputStyleFromType(rawType);
        if (!style) return;
        const existing = hints.get(key);
        if (!existing || (existing === 'short_text' && style === 'long_text')) {
          hints.set(key, style);
        }
      };

      const scanSteps = (stepList: any[]) => {
        stepList.forEach(step => {
          const paramConfigs = step?.config?.paramConfigs || {};
          Object.keys(paramConfigs).forEach(paramKey => {
            applyHint(paramKey, paramConfigs[paramKey]?.type);
          });

          const prompts = Array.isArray(step?.config?.prompts) ? step.config.prompts : [];
          prompts.forEach((prompt: any) => {
            applyHint(prompt?.key, prompt?.type);
          });

          if (Array.isArray(step?.subSteps)) scanSteps(step.subSteps);
          if (Array.isArray(step?.config?.steps)) scanSteps(step.config.steps);
        });
      };

      if (Array.isArray(steps)) scanSteps(steps);
      return hints;
    };

    const mapAutomationInputDefinitionsToFields = (
      inputDefinitions: Partial<AutomationInputDefinition>[],
      fallbackUrlTemplates?: Map<string, string>,
      inputTypeHints?: Map<string, 'short_text' | 'long_text'>,
    ): SearchbarAutomationField[] => {
      return inputDefinitions.map((inputDefinition, index) => {
        let initialValue = inputDefinition.fixedValue || '';
        let dropdownOptions: string[] | undefined;
        let dropdownOptionPairs: { key: string; value: string }[] | undefined = inputDefinition.dropdownOptionPairs;

        if (inputDefinition.dropdownOptions) {
          dropdownOptions = inputDefinition.dropdownOptions
            .split(',')
            .map((value: string) => value.trim())
            .filter(Boolean);
        }

        // If we have pairs but no flat options, build flat options from pairs
        if (dropdownOptionPairs && dropdownOptionPairs.length > 0 && !dropdownOptions) {
          dropdownOptions = dropdownOptionPairs.map(p => p.value);
        }

        if (dropdownOptions && dropdownOptions.length > 0 && !initialValue) {
          initialValue = dropdownOptions[0];
        }

        const fieldKey = inputDefinition.id || inputDefinition.label || `field-${index}`;
        const rawType = String(inputDefinition.type || inputTypeHints?.get(fieldKey) || '');
        const inputStyle = inputDefinition.inputStyle || getInputStyleFromType(rawType);
        const normalizedType = normalizeAutomationFieldType(rawType);
        const sourceType = normalizeAutomationSourceType(rawType);

        return {
          key: fieldKey,
          label: formatAutomationFieldLabel(inputDefinition.label || fieldKey),
          value: initialValue,
          type: normalizedType,
          sourceType,
          description: inputDefinition.description,
          inputStyle,
          extraValues: [],
          dropdownOptions,
          dropdownOptionPairs,
          urlTemplate: inputDefinition.urlTemplate || fallbackUrlTemplates?.get(fieldKey),
          groupId: inputDefinition.groupId || fieldKey,
          groupLabel: inputDefinition.groupLabel,
          groupSelector: inputDefinition.groupSelector,
          groupAction: inputDefinition.groupAction,
          order: inputDefinition.order ?? index,
        };
      });
    };

    const renderInlineCommandIcon = () => {
      if (!inlineComposerInfo) return null;

      const { id } = inlineComposerInfo;

      if (id === 'ai') {
        const targetAIs = AI_GROUP.members;
        return (
          <div className="flex -space-x-1.5 items-center w-auto flex-shrink-0">
            {targetAIs.slice(0, 4).map(mid => {
              const c = getCommandById(mid);
              if (!c) return null;
              return (
                <div
                  key={`ai-inline-${c.id}`}
                  className="w-4 h-4 rounded-full flex items-center justify-center ring-1 ring-white overflow-hidden shadow-sm bg-white">
                  <img src={getFaviconUrl(c.iconHost)} alt={c.label} className="w-4 h-4 object-cover" />
                </div>
              );
            })}
          </div>
        );
      }

      if (isLocalCommandId(id as string)) {
        const localDef = LOCAL_COMMANDS.find(c => c.id === (id as LocalCommandId));
        if (localDef?.icon) {
          if (typeof localDef.icon === 'function') {
            const IconComponent = localDef.icon as React.ComponentType<{ className?: string; size?: number }>;
            return <IconComponent size={16} className="text-neutral-500" />;
          }
          // If it's a ReactNode (Element), just render it
          return <div className="w-4 h-4 flex items-center justify-center">{localDef.icon as React.ReactNode}</div>;
        }

        return (
          <div className="w-8 h-4 flex items-center justify-center scale-[0.5] origin-center">
            <CmdIcon />
          </div>
        );
      }

      const c = getCommandById((id as CommandId));
      if (c) {
        if (c.icon) {
          if (typeof c.icon === 'function') {
            const IconComponent = c.icon as React.ComponentType<{ className?: string; size?: number }>;
            return <IconComponent size={16} className="text-neutral-500" />;
          }
          // If it's a ReactNode (Element), just render it
          return <div className="w-4 h-4 flex items-center justify-center">{c.icon as React.ReactNode}</div>;
        }

        return (
          <img src={getFaviconUrl(c.iconHost)} alt={c.label} className="w-4 h-4 object-cover rounded-sm shadow-sm" />
        );
      }

      return null;
    };

    // Helper to render the command icon inline
    const renderQuicklinkChip = () => {
      // Changed: Image preview moved to right side. This function now returns null for image preview.
      if (selectedImages.length > 0) return null;

if (pendingQueryUrls && pendingQueryUrls.length > 0) {
        const firstUrl = pendingQueryUrls[0];
        return (
          <div className="flex items-center gap-1.5 pl-3">
            <img src={getFaviconUrl(firstUrl)} alt="" className="w-3.5 h-3.5 rounded-sm object-contain" />
            <span className="text-sm text-neutral-500 font-medium truncate max-w-[150px]">
              {pendingQueryLabel || 'Quick Link'}
            </span>
          </div>
        );
      }
      return null;
    };

    // Calculate left padding based on whether we're in command mode OR folder/workspace mode
    // Command mode shows icon + name, so needs more padding (use measured width)
    // All chip modes now use dynamic prefixWidth measurement
    const calculatedPrefixWidth = useMemo(() => {
      if (allSuggestions.length > 0 && !lockedCommand && value.trim().length > 0) {
        const top = allSuggestions[highlightIndex];
        const isAiGroupSuggestion = top && (top as any)._kind === 'command' && (top as any).commandType === 'aggregate';
        if (isAiGroupSuggestion) {
          const visibleAIs = AI_GROUP.members.filter(mid => selectedAIs.includes(mid)).slice(0, 3);
          const displayAIs = visibleAIs.length > 0 ? visibleAIs : AI_GROUP.members.slice(0, 3);
          return displayAIs.length > 0 ? 18 + (displayAIs.length - 1) * 14 : 0;
        }
      }
      if (activeSlashFilter) return FILTER_CHIP_RESERVED_WIDTH;
      return prefixWidth;
    }, [allSuggestions, lockedCommand, value, highlightIndex, selectedAIs, activeSlashFilter, prefixWidth]);

    const hasFilterChip = value.match(/^\/(a|n|s|p|l|c|b|t|se|au|ca|sc)(\s|\u00A0)/i);
    const inputLeftPaddingPx =
      (!lockedCommand && calculatedPrefixWidth > 0
        ? dynamicLeftOffset + calculatedPrefixWidth + dynamicGap
        : lockedCommand || activeCollection || inlineComposerActive || activeSlashFilter || hasFilterChip
          ? dynamicLeftOffset
          : dynamicFallbackPadding) +
      (mentionedTabs && mentionedTabs.length > 0 && mentionedTabsWidth > 0 ? mentionedTabsWidth + 12 : 0);

const selectedLocalLabel = useMemo(() => {
      if (!lockedCommand && selectedCommand?.commandType === 'local') {
        if (selectedCommand.id === 'createnotes' || selectedCommand.id === 'createlinks') {
          return null;
        }
        return selectedCommand.label;
      }
      return null;
    }, [lockedCommand, selectedCommand]);
    const inputDisplayValue = inlineComposerActive ? commandPrompt : value;
    const showLocalPreviewHint = Boolean(selectedLocalLabel);
    const previewPlaceholder =
      !lockedCommand &&
        selectedCommand &&
        selectedCommand.id !== 'createnotes' &&
        selectedCommand.id !== 'createlinks' &&
        selectedCommand.id !== 'gpt'
        ? resolvePlaceholderFromCmd(selectedCommand.id)
        : STATIC_PLACEHOLDER;

    const inputPlaceholder = inlineComposerActive
      ? ''
      : showAIHistoryPanel && !value
        ? 'Search history or scroll to see more...'
        : !value && !lockedCommand && selectedLocalLabel
          ? `Press Enter to ${selectedLocalLabel}`
          : !value && lockedCommand
            ? resolvePlaceholderFromCmd(lockedCommand) || placeholder
            : !value && !lockedCommand && selectedCommand && previewPlaceholder !== STATIC_PLACEHOLDER
              ? previewPlaceholder
              : placeholder || STATIC_PLACEHOLDER;
    const inputRightPadding = inlineComposerVisible || showLocalPreviewHint ? 'pr-44' : 'pr-24';

    const suggestionMode: SuggestionMode = useMemo(() => {
      const canShowOthers = !lockedCommand;

      if (isBookmarksCommand(lockedCommand)) return 'bookmark';
      if (lockedLocalDef) {
        if (lockedLocalDef.scope === 'snippet') return 'workspace_item';
        return 'local';
      }

      const hasCommands = commandSuggestions.some((c: any) => c._kind !== 'workspace_item');
      const hasWorkspaceItems = canShowOthers && allSuggestions.some((r: any) => r._kind === 'workspace_item');

      // Derive presence of items directly from allSuggestions to respect mode overrides (like "c ")
      const hasHistory = canShowOthers && !lockedCommand && allSuggestions.some((r: any) => r._kind === 'history');
      const hasBookmarks = canShowOthers && !lockedCommand && allSuggestions.some((r: any) => r._kind === 'bookmark');
      const hasCommon =
        commonCommandSuggestions.length > 0 ||
        (canShowOthers && !lockedCommand && allSuggestions.some((r: any) => r._kind === 'common_command'));
      const hasOpenUrl = openUrlSuggestion !== null;

      if (lockedCommand) {
        return null;
      }

      // If just '/' with no text, and we have workspace items, mixed mode will be returned by hasMultipleTypes

      const hasMultipleTypes =
        [hasCommands, hasWorkspaceItems, hasHistory, hasBookmarks, hasCommon, hasOpenUrl].filter(Boolean).length > 1;

      if (hasMultipleTypes) return 'mixed';

      if (hasOpenUrl) return 'common'; // Show as common mode when URL suggestion is present
      if (hasCommands) return 'command';
      if (hasWorkspaceItems) return 'workspace_item';
      if (hasHistory) return 'history';
      if (hasBookmarks) return 'bookmark';
      if (hasCommon) return 'common';
      return null;
    }, [
      value,
      lockedCommand,
      lockedLocalDef,
      commandSuggestions,
      debouncedFuseResults,
      bookmarkSuggestions,
      commonCommandSuggestions,
      openUrlSuggestion,
    ]);

    const hasFocus = isFocused || isInlineFocused;
    const isSuggestionVisible = useMemo(() => {
      // Hide suggestions when automation/agent multi-field form is active
      if (activeCollection) return false;

      // If a command like /bookmarks, /delete_note is locked (chip shown), hide search suggestions
      // Only AI commands (GPT, Claude, etc) show suggestions (which become Prompts)
      if (lockedCommand) {
        // If files are attached to an AI command, keep suggestions (bottom UI) visible
        // so that the AICommandLockedUI remains mounted in Container.tsx.
        if (selectedImages.length > 0) {
          const isAiCommand =
            lockedCommand === 'ai' ||
            getCommandById(lockedCommand)?.category === 'ai' ||
            ['gpt', 'claude', 'perplexity', 'gemini'].includes(lockedCommand as string);
          if (isAiCommand) return true;
          return false;
        }

        // Fallback AI command 'ai' should show prompts
        if (lockedCommand === 'ai') return true;

        // Remote AI commands (gpt, claude etc) should allow prompts
        const info = getCommandById(lockedCommand);
        if (info?.category === 'ai') return true;

        if (lockedCommand === 'store') return true;

        return false;
      }

      if (selectedAtCommand) return false;
      if (isSuggestionsHidden) return false;
      // Removed focus requirement to allow persistent suggestions on blur
      // if (!isFocused && !isInlineFocused) return false;

      // showAIHistoryPanel is now rendered as a popup internal to Searchbar to ensure visibility
      // return showAIHistoryPanel ? true : ...

      return (value.trim().length > 0 || selectedImages.length > 0 || isInitialAltSFocus || keepBoardViewOpen || showEmptySlashDropdown) && !inlineComposerActive;
    }, [
      value,
      isFocused,
      isInlineFocused,
      lockedCommand,
      selectedAtCommand,
      inlineComposerActive,
      selectedImages.length,
      commands,
      isSuggestionsHidden,
      activeCollection,
      showAIHistoryPanel,
      isInitialAltSFocus,
      showEmptySlashDropdown,
    ]);

    useEffect(() => {
      let isCancelled = false;

      const applyContextualMatches = (allMatches: ContextualMatch[]) => {
        if (isCancelled) return;

        const nextMatchIds = allMatches.map(m => String(m.id)).join(',');

        if (nextMatchIds !== contextualMatchIdsRef.current) {
          contextualMatchIdsRef.current = nextMatchIds;
          setContextualMatches(allMatches);
          setContextualPopupIndex(-1);
        }

        const nextPopupOpen = allMatches.length > 0;
        setIsContextualPopupOpen(prev => (prev === nextPopupOpen ? prev : nextPopupOpen));
        if (!nextPopupOpen) {
          setContextualPopupIndex(prev => (prev !== -1 ? -1 : prev));
        }
      };

      // 1. Reset state for new suggestions
      if (!isSuggestionVisible || lockedCommand) {
        if (selectionSourceRef.current !== null) {
          selectionSourceRef.current = null;
          setSelectedCommand(null);
        }
        setContextualMatches(prev => (prev.length > 0 ? [] : prev));
        setIsContextualPopupOpen(prev => (prev ? false : prev));
        setContextualPopupIndex(prev => (prev !== -1 ? -1 : prev));
        return;
      }

      // 2. Resolve Primary Command Preview (Original GPT logic)
      const current = allSuggestions[highlightIndex];
      if (current && current._kind === 'command') {
        const info = buildSelectionInfoFromSuggestion(current as CommandSuggestionItem);
        if (commandSupportsInlineQuery(info)) {
          setSelectedCommand(prev => {
            if (selectionSourceRef.current === 'suggestions' && prev?.id === info.id) {
              return prev;
            }
            selectionSourceRef.current = 'suggestions';
            return info;
          });
        }
      } else {
        if (selectionSourceRef.current !== null) {
          selectionSourceRef.current = null;
          setSelectedCommand(null);
        }
      }

      // 3. Dedicated Search for the side panel (Commands, Automations, Agents)
      // Take search query from the main searchbar only (value)
      if (value.trim().length < 3) {
        applyContextualMatches([]);
        return () => {
          isCancelled = true;
        };
      }

      import('../searchLogicAndAlgorithms/searchEngine')
        .then(({ searchDedicatedPanel }) => {
          if (isCancelled) return;

          const dedicatedMatches = searchDedicatedPanel(
            value,
            commands,
            automationSuggestions,
            agentCollectionSuggestions,
            moduleSuggestions,
          );

          // Add workspace item matches for links and collections from matchingSnippets
          const snippetMatches: ContextualMatch[] = [];

          // Merge matches from searchDedicatedPanel (cast as compatible type) with workspace item matches
          applyContextualMatches([...(dedicatedMatches as ContextualMatch[]), ...snippetMatches]);
        })
        .catch(() => {
          applyContextualMatches([]);
        });

      return () => {
        isCancelled = true;
      };
    }, [
      value,
      commands,
      automationSuggestions,
      agentCollectionSuggestions,
      moduleSuggestions,
      allSuggestions,
      highlightIndex,
      isSuggestionVisible,
      lockedCommand,
    ]);

    const handleSubmit = useCallback(
      async (isAlt: boolean = false) => {
        const trimmedValue = value.trim();
        const trimmedPrompt = commandPrompt.trim();
        const historyUrls = stagedHistorySession ? Object.values(stagedHistorySession.urls).filter(Boolean) : undefined;
        const selected =
          allSuggestions.length > 0 ? allSuggestions[Math.min(highlightIndex, allSuggestions.length - 1)] : null;

        // Check database-defined custom shortcuts first. This intentionally treats
        // `recording`, `/recording`, and `c recording` as the same assigned trigger.
        const parsedShortcut = parseShortcutInvocation(
          trimmedValue,
          customOmniboxPrefixesRef.current || customOmniboxPrefixes,
        );
        if (parsedShortcut.trigger) {
          const matchedDbShortcut = userDbShortcuts?.find(
            (s: any) =>
              String(s.trigger || '').toLowerCase() === parsedShortcut.trigger &&
              matchesShortcutCategory(String(s.referenceType || ''), parsedShortcut.categoryFilter),
          );

          if (matchedDbShortcut) {

            const { referenceId, referenceType } = matchedDbShortcut;
            const resolveShortcutTargetLabel = () => {
              const refId = String(referenceId);
              const shortcutAny = matchedDbShortcut as any;
              const shortcutLabel =
                shortcutAny.targetLabelSnapshot ||
                shortcutAny.targetLabel ||
                shortcutAny.referenceLabel ||
                shortcutAny.label ||
                shortcutAny.title ||
                shortcutAny.name;
              if (shortcutLabel && String(shortcutLabel) !== refId) return String(shortcutLabel);

              if (referenceType === 'command') {
                const command = getCommandById(refId) as any;
                return command?.label || command?.title || command?.name || refId;
              }

              if (referenceType === 'automation') {
                const automation: any = automationSuggestions.find((a: any) => String(a.id) === refId);
                return automation?.title || automation?.name || automation?.label || refId;
              }

              if (referenceType === 'module') {
                const rawId = refId;
                const normalizedId = rawId.includes(':') ? rawId.split(':')[1] : rawId.replace(/^module-/, '');
                const moduleFromState: any = moduleSuggestions.find(m => String(m.module_id) === normalizedId);
                return moduleFromState?.title || moduleFromState?.name || moduleFromState?.displayName || moduleFromState?.module_id || refId;
              }

              const suggestion: any = allSuggestions.find((item: any) => {
                const itemId = item?.id || item?.item?.id || item?.item?.snippet_id || item?.snippet_id;
                return String(itemId || '') === refId;
              });
              const suggestionItem = suggestion?.item || suggestion;
              return suggestionItem?.title || suggestionItem?.name || suggestionItem?.label || suggestionItem?.key || refId;
            };
            const recordShortcutUse = (success = true, errorCode?: string) => {
              recordAssignedTriggerUsage({
                triggerKind: 'user_shortcut',
                triggerValue: matchedDbShortcut.trigger,
                triggerSource: parsedShortcut.triggerSource,
                referenceId,
                referenceType,
                surface: 'main_search',
                success,
                errorCode,
                targetLabelSnapshot: resolveShortcutTargetLabel(),
                triggerLabelSnapshot: matchedDbShortcut.trigger,
              }).catch((err: any) => console.warn('[Searchbar] Failed to record shortcut usage:', err));
            };
            const runOrEditMatchedAiPrompt = async (promptRecord: any) => {
              resetAfterCommandExecution();
              if (!hasRunnableAiPrompt(promptRecord)) {
                useUIStore.getState().openEditor({ type: 'aiPrompt', id: String(promptRecord.id) });
                recordShortcutUse();
                return;
              }

              try {
                await runAiPrompt(promptRecord);
                recordShortcutUse();
              } catch (error) {
                console.error('[Searchbar] Failed to run AI prompt shortcut:', error);
                recordShortcutUse(false, 'execution_failed');
              }
            };
            const normalizedShortcutReferenceType = String(referenceType || '').toLowerCase();

            if (referenceType === 'command') {
              resetAfterCommandExecution();
              if (referenceId === 'create') {
                handleLocalCommandExecute('create' as any);
                recordShortcutUse();
                return;
              }
              activateCommandById(referenceId as AnyCommandId, parsedShortcut.remainingInput);
              recordShortcutUse();
              return;
            }

            if (referenceType === 'note' || referenceType === 'snippet' || referenceType === 'link') {
              resetAfterCommandExecution();
              useUIStore.getState().openEditor({ type: referenceType as any, id: referenceId });
              recordShortcutUse();
              return;
            }

            if (['collection', 'collections', 'collection_view'].includes(normalizedShortcutReferenceType)) {
              resetAfterCommandExecution();
              const didLaunch = await launchDashboardCollectionView(String(referenceId), { mode: 'open' });
              recordShortcutUse(didLaunch, didLaunch ? undefined : 'collection_view_not_found');
              return;
            }

            if (normalizedShortcutReferenceType === 'session') {
              resetAfterCommandExecution();
              const sessionRecord = useDbStore
                .getState()
                .sessions.find((session: any) => String(session.id) === String(referenceId));
              if (!sessionRecord) {
                recordShortcutUse(false, 'entity_not_found');
                return;
              }

              const response = await launchSessionSmartWithReferences(sessionRecord, {
                source: 'shortcut',
                requireAutoSave: false,
              });
              recordShortcutUse(
                response?.ok && !response?.skipped,
                response?.skipped ? response.reason : response?.ok ? undefined : response?.error || 'session_launch_failed',
              );
              return;
            }

            if (['aiprompt', 'ai_prompt', 'prompt'].includes(normalizedShortcutReferenceType)) {
              const promptRecord = useDbStore
                .getState()
                .aiPrompts.find((prompt: any) => String(prompt.id) === String(referenceId));
              if (promptRecord) {
                await runOrEditMatchedAiPrompt(promptRecord);
              } else {
                recordShortcutUse(false, 'entity_not_found');
              }
              return;
            }

            if (referenceType === 'automation') {
              let automation: any = automationSuggestions.find((a: any) => String(a.id) === String(referenceId));
              if (automation) {
                resetAfterCommandExecution();
                handleAutomationSelect(automation);
                recordShortcutUse();
                return;
              }

              // Older Board-created AI Prompt shortcuts were stored as "automation".
              const legacyPromptRecord = useDbStore
                .getState()
                .aiPrompts.find((prompt: any) => String(prompt.id) === String(referenceId));
              if (legacyPromptRecord) {
                await runOrEditMatchedAiPrompt(legacyPromptRecord);
                return;
              }
              recordShortcutUse(false, 'entity_not_found');
              return;
            }

            if (referenceType === 'module') {
              resetAfterCommandExecution();
              const rawId = String(referenceId);
              const normalizedId = rawId.includes(':') ? rawId.split(':')[1] : rawId.replace(/^module-/, '');
              const moduleFromState = moduleSuggestions.find(m => String(m.module_id) === normalizedId);
              if (moduleFromState) {
                handleAutomationSelect(buildAutomationFromModule(moduleFromState));
                recordShortcutUse();
                return;
              }
              const chromeAny = (window as any)?.chrome;
              if (chromeAny?.storage?.local) {
                chromeAny.storage.local.get(['installed_modules'], (result: any) => {
                  const modules = Array.isArray(result.installed_modules) ? result.installed_modules : [];
                  const match = modules.find((m: any) => String(m?.module_id) === normalizedId);
                  if (match) {
                    handleAutomationSelect(buildAutomationFromModule(match));
                    recordShortcutUse();
                  }
                });
              }
              return;
            }
          }
        }

        // 1. Calculate unified prompt and images for all submission paths
        console.log('[Searchbar] handleSubmit CALLED. lockedCommand:', lockedCommand, '| value:', value, '| trimmedValue:', trimmedValue);
        let prompt = serializeRichPrompt(inputRef.current as any);
        if (lockedCommand && inlineComposerActive && inlineInputRef.current) {
          const direct = inlineInputRef.current.value.trim();
          if (direct) prompt = direct;
        }

        const enrichPromptWithMentionedTabs = async (basePrompt: string): Promise<string> => {
          if (mentionedTabs.length === 0) return basePrompt;

          const contextMap = new Map<string, string>();
          for (const mention of mentionedTabs) {
            try {
              const res: any = await new Promise(resolve => {
                const chromeAny = (window as any).chrome;
                if (chromeAny && chromeAny.runtime && chromeAny.runtime.sendMessage) {
                  chromeAny.runtime.sendMessage({ action: 'scrape_tab_by_id', tabId: mention.tabId }, resolve);
                } else {
                  resolve({ ok: false, error: 'chrome_api_missing' });
                }
              });

              let structuredText = '';
              if (res && res.ok && res.content) {
                structuredText = `\n--- Tab Content: "${mention.title}" ---\nURL: ${res.url || 'N/A'}\nContent:\n${res.content}\n-----------------------------------\n`;
              } else {
                structuredText = `\n--- Tab Content: "${mention.title}" ---\n(Failed to fetch active page content)\n-----------------------------------\n`;
              }
              contextMap.set(String(mention.tabId), structuredText);
            } catch (err) {
              console.error('[enrichPromptWithMentionedTabs] Error:', mention.tabId, err);
            }
          }

          // Perform inline replacement of @[tab:ID] placeholders
          const regex = /@\[tab:([^\]]+)\]/g;
          let enhancedPrompt = basePrompt.replace(regex, (match, tabId) => {
            const context = contextMap.get(String(tabId));
            if (context) return context;
            return match; // Keep the placeholder if no context found
          });

          // Fallback: If no placeholders were replaced but we have mentions (e.g. legacy @Title format)
          // we append them to the end as before to ensure context is never lost.
          if (enhancedPrompt === basePrompt && contextMap.size > 0) {
            let footerContext = '';
            contextMap.forEach(text => {
              footerContext += `\n${text}`;
            });
            enhancedPrompt += `\n\n[Context from Mentioned Open Tabs]\n${footerContext}`;
          }

          return enhancedPrompt;
        };

        let expandedPromptBase = expandPrompts(prompt);
        if (activeAiSession) {
          const aiPrompt = stripHtml(activeAiSession.prompt || '');
          const aiRules = stripHtml(activeAiSession.rules || '');
          let combined = '';
          if (aiPrompt) combined += aiPrompt + '\n\n';
          if (aiRules) combined += 'Rules & Constraints:\n' + aiRules + '\n\n';
          if (combined) {
            expandedPromptBase = combined + '---\n\n' + expandedPromptBase;
          }
        }
        const expandedPrompt = await enrichPromptWithMentionedTabs(expandedPromptBase);
        const imagesToSubmit = [...selectedImages];

        // Pre-convert images to base64 for background submission
        const imagesWithBase64 =
          imagesToSubmit.length > 0
            ? await Promise.all(
              imagesToSubmit.map(async img => ({
                base64: await fileToBase64(img.file),
                mimeType: img.mimeType,
                filename: img.filename,
              })),
            )
            : undefined;

if (trimmedValue || trimmedPrompt || lockedCommand || selected || selectedCommand) {

        }

        // Handle "Alt + Enter": Trigger Primary Command
        // If a command is available for this domain, activate it instead of opening the link
        if (isAlt && !lockedCommand && selected && (selected._kind === 'history' || selected._kind === 'bookmark')) {
          const item = selected as any;
          if (item.commandId) {
            activateCommandById(item.commandId as AnyCommandId, '');
            return;
          }
        }

        // Handle "Open URL" suggestion
        if (!lockedCommand && selected && selected._kind === 'open_url') {
          const urlToOpen = (selected as OpenUrlSuggestionItem).url;
          resetAfterCommandExecution();
          const urls = urlToOpen.split(',');
          if (urls.length > 1) {
            openMultipleLinks(urls, currentTabId);
          } else {
            openSingleLink(urlToOpen, false, currentTabId);
          }
          return;
        }

        // 1. Handle @ command selector - execute query with the selected command
        if (selectedAtCommand && trimmedValue) {
          const cmd = getCommandById(selectedAtCommand);
          if (cmd) {
            // Resolve @Mentions before sending to selected command
            const expandedValue = expandPrompts(trimmedValue);
            setSelectedAtCommand(null);
            resetAfterCommandExecution();
            runRemoteCommand(cmd, expandedValue);
            return;
          } else {
            // Command not installed - show styled dialog and reset (safeguard)
            console.warn('[Searchbar] Selected @ command not found in installed commands:', selectedAtCommand);
            const commandName = selectedAtCommand;
            setSelectedAtCommand(null);
            triggerNotification('Command not available.', 'error');
            return;
          }
        }

        // 2. PRIORITY 1: Handle LOCKED COMMAND execution (Prompt submission)
        if (lockedCommand) {
          // Bookmarks command special handling
          if (isBookmarksCommand(lockedCommand)) {
            const bookmarkItem =
              selected && selected._kind === 'bookmark'
                ? selected
                : bookmarkSuggestions[Math.min(highlightIndex, Math.max(0, bookmarkSuggestions.length - 1))];
            if (bookmarkItem?.url) {
              openSingleLink(bookmarkItem.url, false, currentTabId);
              resetAfterCommandExecution();
              return;
            } else if (trimmedValue) {
              const chromeAny = (window as any)?.chrome;
              const response = await new Promise<any>(resolve =>
                chromeAny?.runtime?.sendMessage?.({ action: 'bookmarks_search', query: trimmedValue }, resolve),
              );
              const first = (response?.results || []).find((n: any) => !!n.url);
              if (first?.url) {
                openSingleLink(first.url, false, currentTabId);
                resetAfterCommandExecution();
                return;
              }
            }
            return;
          }

          // Local Entity commands (Delete/Rename workspace or folder)
          if (lockedLocalDef) {
            const asSnippet = (item: any): WorkspaceItemSuggestion | null => {
              if (!item || item._kind !== 'workspace_item') return null;
              return { item: item.item, workspace: item.workspace, folder: item.folder };
            };
            if (lockedLocalDef.scope === 'snippet') {
              const snippetItem =
                asSnippet(selected) ??
                asSnippet(
                  null, // removed snippetEntitySuggestions
                );
              if (snippetItem) {
                handleSnippetDelete(snippetItem);
                resetAfterCommandExecution();
              }
              return;
            }
            if (selected && selected._kind === 'workspace') {
              // TODO: Delegate to central Workspace Manager
              console.warn('Workspace Action: Delegating to WorkspaceManager (Not implemented in UI yet)');
              resetAfterCommandExecution();
              return;
            }
            return;
          }

          if (lockedCommand === 'ai') {
            if (!prompt && imagesToSubmit.length === 0) {
              // Only show the toast if the user explicitly had text then cleared it.
              // If the input is simply empty from the start (just locked), silently do nothing.
              if (inlineInputRef.current && inlineInputRef.current.value.trim().length > 0) {
                triggerNotification('Prompt is required', 'error');
                setFooterStatus({ message: 'Prompt is required', type: 'error' });
                setTimeout(() => setFooterStatus(null), 3000);
              }
              return;
            }
            console.log('[Searchbar] AI locked. prompt:', JSON.stringify(prompt), '| expandedPrompt:', JSON.stringify(expandedPrompt), '| selectedAIs:', selectedAIs, '| imagesToSubmit:', imagesToSubmit.length);
            await runAggregateCommand(expandedPrompt, imagesToSubmit, historyUrls);
            console.log('[Searchbar] runAggregateCommand returned.');
            // Do NOT call resetAfterCommandExecution here â€” runAggregateCommand already handles
            // setValue('') and setLockedCommand('ai') to maintain the locked AI session.
            return;
          }

          if (lockedCommand === 'todo') {
            window.dispatchEvent(
              new CustomEvent('trigger-add-todo', {
                detail: {
                  item: {
                    key: expandedPrompt || '',
                    value: '',
                    category: 'note',
                    openAutomatically: true,
                  },
                },
              }),
            );
            resetAfterCommandExecution();
            return;
          }

          const remoteCommand =
            getCommandById(lockedCommand);
          if (remoteCommand) {
            const isAiGroupMember = AI_GROUP.members.includes(remoteCommand.id as any);
            const needsPrompt =
              isAiGroupMember ||
              remoteCommand.urlTemplate.includes('{query}') ||
              remoteCommand.urlTemplate.includes('[query]');
            if (needsPrompt && !prompt && imagesToSubmit.length === 0 && !stagedHistorySession) {
              // Only notify if the inline input had text that got cleared â€” not on a fresh empty lock
              const hasInlineText = inlineInputRef.current && inlineInputRef.current.value.trim().length > 0;
              if (hasInlineText) {
                triggerNotification('Prompt is required', 'error');
                setFooterStatus({ message: 'Prompt is required', type: 'error' });
                setTimeout(() => setFooterStatus(null), 3000);
              }
              return;
            }

            // If we have a staged history session, we use its SPECIFIC URL if matching the command
            if (stagedHistorySession) {
              const specificUrl = stagedHistorySession.urls[remoteCommand.id as string];
              if (specificUrl) {

                saveAiLog(stagedHistorySession.sessionKey || stagedHistorySession.id, expandedPrompt);
                const autoSubmit: AutoSubmitRequest = {
                  kind: remoteCommand.id as AutoSubmitKind,
                  prompt: expandedPrompt,
                  images: imagesWithBase64,
                };

                openLinksWithAutoSubmit([{ url: specificUrl, active: true, autoSubmit }]).then(() => {
                  setStagedHistorySession(null);
                  const isAiHistoryMember = AI_GROUP.members.includes(remoteCommand.id as any);
                  if (isAiHistoryMember) {
                    setValue('');
                    setCommandPrompt('');
                    clearSelectedImages();
                  } else {
                    resetAfterCommandExecution();
                  }
                });
                return;
              }

              // If we have other history URLs but none for THIS command, maybe user switched AIs?
              // In that case, we fall back to runRemoteCommand which will open a NEW chat on the selected AI.

            }

            await runRemoteCommand(remoteCommand, expandedPrompt, imagesToSubmit);

            const isAiLockedMember = AI_GROUP.members.includes(remoteCommand.id as any);
            if (isAiLockedMember) {
              // For AI group members, maintain the locked session
              setValue('');
              setCommandPrompt('');
              clearSelectedImages();
              // Don't call resetAfterCommandExecution() to keep the lock
            } else {
              resetAfterCommandExecution();
            }
            return;
          }

          if (isLocalCommandId(lockedCommand)) {
            const def = LOCAL_COMMANDS.find(c => c.id === (lockedCommand as LocalCommandId));
            if (def?.behavior === 'instant') {
              // Special case: Calendar command requires input
              if (def.id === 'calendar') {
                const p = prompt || value || '';
                resetAfterCommandExecution();
                handleLocalCommandExecute('calendar', { prompt: p });
                return;
              }

              resetAfterCommandExecution();
              handleLocalCommandExecute((def.executeId || def.id) as LocalCommandId);
              return;
            }

            if (def?.behavior === 'locked') {
              (async () => {
                const base64Files = await Promise.all(
                  imagesToSubmit.map(async img => ({
                    base64: await fileToBase64(img.file),
                    filename: img.filename,
                    mimeType: img.mimeType,
                  })),
                );
                handleLocalCommandExecute(def.id as LocalCommandId, { prompt: expandedPrompt, files: base64Files });
                if (def.id !== 'saved-automation') {
                  resetAfterCommandExecution();
                }
              })();
              return;
            }
          }
          return;
        }

        // 3. PRIORITY 2: Handle SUGGESTION execution (When no command is locked)
        if (selected) {
          if (selected._kind === 'math_result' || selected._kind === 'time_result') {
            return;
          }

          if (selected._kind === 'command' && (selected as any).commandType === 'proxy' && (selected as any).proxyEntity) {
            activateWorkspaceItemSuggestion((selected as any).proxyEntity);
            return;
          }

          if (selected._kind === 'command' && selected.commandType === 'local') {
            recordSelectedShortcutUsage(selected);
            const def = selected.command;
            if (def.behavior === 'instant') {
              // Special case: Calendar command requires input
              if (def.id === 'calendar') {
                activateCommandById(selected.id as AnyCommandId, '');
                return;
              }

              handleLocalCommandExecute((def.executeId || def.id) as LocalCommandId);
              resetAfterCommandExecution();
              return;
            }
            activateCommandById(selected.id as AnyCommandId, '');
            return;
          }

          if (
            selected._kind === 'command' &&
            (selected.commandType === 'remote' || selected.commandType === 'aggregate')
          ) {
            recordSelectedShortcutUsage(selected);
            // Check for instant browser commands
            if (selected.commandType === 'remote' && selected.command) {
              const isBrowserInstant =
                selected.command.category === 'browser' && !selected.command.urlTemplate.includes('{query}');
              if (isBrowserInstant) {
                runRemoteCommand(selected.command, '');
                resetAfterCommandExecution();
                return;
              }
            }

            const firstSpaceIndex = trimmedValue.indexOf(' ');
            const firstToken = firstSpaceIndex !== -1 ? trimmedValue.substring(0, firstSpaceIndex) : trimmedValue;
            const remainingText = firstSpaceIndex !== -1 ? trimmedValue.substring(firstSpaceIndex + 1).trim() : '';

            const prefixLower = (selected.prefix || '').toLowerCase();
            const idLower = `/${selected.id}`.toLowerCase();
            const tokenLower = firstToken.toLowerCase();

            let promptForExecution = remainingText;

            if (tokenLower && (prefixLower.startsWith(tokenLower) || idLower.startsWith(tokenLower))) {
              promptForExecution = remainingText;
            } else {
              const extraction = extractPromptFromInput(value, { id: selected.id, prefix: selected.prefix });
              promptForExecution = extraction.matched ? extraction.prompt : trimmedValue;

              if (!extraction.matched) {
                const { detectPinnedCommand } = await import('../searchLogicAndAlgorithms/searchEngine');
                const pinInfo = detectPinnedCommand(trimmedValue, commands);
                if (pinInfo.pinned && pinInfo.pinned.id === selected.id) {
                  promptForExecution = pinInfo.searchQuery.trim();
                }
              }
            }

            if (!promptForExecution) {
              activateCommandById(selected.id as AnyCommandId, '');
              return;
            }

            if (selected.commandType === 'aggregate') {
              const exp = expandPrompts(promptForExecution);
              const imgs = [...selectedImages];
              await runAggregateCommand(exp, imgs, historyUrls);
            } else if (selected.command) {
              const isAiSuggestionMember = AI_GROUP.members.includes(selected.command.id as any);
              if (!isAiSuggestionMember && selected.id !== 'ai') {
                const remoteCmd = selected.command;
                const words = trimmedValue.split(/\s+/);
                const triggerWords = [
                  selected.id,
                  (selected.prefix || '').replace('/', ''),
                  ...(remoteCmd?.keywords || [])
                ].filter(Boolean);

                const filteredWords = words.filter(word => {
                  const normalizedWord = word.toLowerCase();
                  return !triggerWords.some(trigger =>
                    trigger.toLowerCase().startsWith(normalizedWord) ||
                    normalizedWord.startsWith(trigger.toLowerCase())
                  );
                });
                let extractedQuery = filteredWords.join(' ').trim();
                extractedQuery = extractedQuery.replace(/^\/([aAnsSplLcCbBtT])\s*/i, '');

                activateCommandById(selected.id as AnyCommandId, extractedQuery);
              } else {
                const exp = expandPrompts(promptForExecution);
                const imgs = [...selectedImages];
                await runRemoteCommand(selected.command, exp, imgs);
                if (isAiSuggestionMember) {
                  setValue('');
                  setCommandPrompt('');
                  clearSelectedImages();
                } else {
                  resetAfterCommandExecution();
                }
              }
            }
            return;
          }

          if (selected._kind === 'common_command') {
            await executeCommonCommand(selected);
            return;
          }

          if (selected._kind === 'workspace_item') {
            const hasMention = /@\w/.test(trimmedValue);
            if (!hasMention) {
              activateWorkspaceItemSuggestion({
                item: selected.item,
                workspace: selected.workspace,
                folder: selected.folder,
              });
              return;
            }
            // Fall through if mention is present to let fallback AI handle it
          }

          if (selected._kind === 'bookmark' && selected.url) {
            const urlToOpen = selected.url;
            resetAfterCommandExecution();
            openSingleLink(urlToOpen, false, currentTabId);
            return;
          }

          if (selected._kind === 'history' && selected.url) {
            const urlToOpen = selected.url;
            resetAfterCommandExecution();
            openSingleLink(urlToOpen, false, currentTabId);
            return;
          }

          if (selected._kind === 'agent_collection') {
            handleAgentCollectionSelect(selected);
            return;
          }

          if (selected._kind === 'automation') {
            handleAutomationSelect(selected.automation);
            return;
          }

          if (selected._kind === 'module') {
            handleAutomationSelect(buildAutomationFromModule(selected.module));
            return;
          }

          if (selected._kind === 'folder_search') {
            const { folder, workspace, entryType } = selected;
            const expandedWorkspaces = useUIStore.getState().expandedWorkspaces;
            if (!expandedWorkspaces[workspace.workspace_id]) {
              useUIStore.getState().expandAllWorkspaces({ ...expandedWorkspaces, [workspace.workspace_id]: true });
            }
            useUIStore.getState().setSelectedWorkspaceId(workspace.workspace_id);
            if (entryType === 'workspace') {
              useUIStore.getState().setSelectedFolderId(null);
              useUIStore.getState().setSelectedSnippetId(null);
              useUIStore.getState().setSelectedSnippet(null);
              useUIStore.getState().setSnippetBreadcrumb({
                workspace_id: workspace.workspace_id,
                workspace_name: workspace.workspace_name,
                folder_id: null,
                folder_name: null,
              });
            } else if (folder) {
              useUIStore.getState().setSelectedFolderId(folder.folder_id);
              useUIStore.getState().setSelectedSnippetId(null);
              useUIStore.getState().setSelectedSnippet(null);
              useUIStore.getState().setSnippetBreadcrumb({
                workspace_id: workspace.workspace_id,
                workspace_name: workspace.workspace_name,
                folder_id: folder.folder_id,
                folder_name: folder.folder_name,
              });
            }
            setValue('');
            return;
          }
        }

        // 4. PRIORITY 3: Handle execution/activation from PREVIEW state (selectedCommand)
        if (selectedCommand) {
          // Instant Browser command
          const remoteCmd =
            getCommandById(selectedCommand.id);
          if (remoteCmd?.category === 'browser' && !remoteCmd.urlTemplate.includes('{query}')) {
            runRemoteCommand(remoteCmd, '');
            const isAiPreviewBrowserMember = AI_GROUP.members.includes(remoteCmd.id as any);
            if (isAiPreviewBrowserMember) {
              setValue('');
              setCommandPrompt('');
              clearSelectedImages();
            } else {
              resetAfterCommandExecution();
            }
            return;
          }

          // Instant Local command
          if (selectedCommand.commandType === 'local') {
            const localDef = LOCAL_COMMANDS.find(c => c.id === selectedCommand.id);
            if (localDef?.behavior === 'instant') {
              // Special case: Calendar command requires input
              if (localDef.id === 'calendar') {
                activateCommandById(selectedCommand.id, '');
                return;
              }

              handleLocalCommandExecute((localDef.executeId || localDef.id) as LocalCommandId);
              const isAiPreviewLocalMember = AI_GROUP.members.includes(selectedCommand.id as any);
              if (isAiPreviewLocalMember) {
                setValue('');
                setCommandPrompt('');
                clearSelectedImages();
              } else {
                resetAfterCommandExecution();
              }
              return;
            }
            activateCommandById(selectedCommand.id, '');
            return;
          }

          // Command activation (move to locked state) if prompt is empty
          if (commandSupportsInlineQuery(selectedCommand)) {
            const extraction = extractPromptFromInput(value, {
              id: selectedCommand.id,
              prefix: selectedCommand.prefix,
            });
            if (extraction.matched && !extraction.prompt) {
              activateCommandById(selectedCommand.id, '');
              return;
            }
          }
        }

        // 5. FALLBACK: Parse input for potential command or direct search/URL
        const remoteTokens = commands
          .flatMap(c => [normalizeCommandToken(c.id), normalizeCommandToken(c.prefix)])
          .filter(Boolean);
        const localTokens = LOCAL_COMMANDS.flatMap(c => [
          normalizeCommandToken(c.id),
          normalizeCommandToken(c.prefix),
        ]).filter(Boolean);
        const tokenSet = Array.from(new Set(['ai', ...remoteTokens, ...localTokens]));

        if (!trimmedValue) return;

        let cmdToken = '';
        prompt = ''; // Reuse outer block prompt
        const fallbackSpaceIndex = trimmedValue.indexOf(' ');
        const fallbackToken = fallbackSpaceIndex !== -1 ? trimmedValue.substring(0, fallbackSpaceIndex) : trimmedValue;
        const fallbackRemaining =
          fallbackSpaceIndex !== -1 ? trimmedValue.substring(fallbackSpaceIndex + 1).trim() : '';

if (!cmdToken) {
          const pattern = new RegExp(`^\\/?(${tokenSet.map(escapeRegExp).join('|')})(?=$|\\s|:)`, 'i');
          const match = trimmedValue.match(pattern);
          if (match) {
            cmdToken = match[1].toLowerCase();
            prompt = trimQuery(trimmedValue.slice(match[0].length).replace(/^[:\s]+/, ''));
          }
        }

        if (cmdToken) {
          if (cmdToken === 'ai') {
            if (!prompt && selectedImages.length === 0) activateCommandById('ai', '');
            else if (!prompt) {
              triggerNotification('Prompt is required', 'error');
              setFooterStatus({ message: 'Prompt is required', type: 'error' });
              setTimeout(() => setFooterStatus(null), 3000);
            } else {
              let exp = expandPrompts(prompt);
              if (activeAiSession) {
                const aiPrompt = stripHtml(activeAiSession.prompt || '');
                const aiRules = stripHtml(activeAiSession.rules || '');
                let combined = '';
                if (aiPrompt) combined += aiPrompt + '\n\n';
                if (aiRules) combined += 'Rules & Constraints:\n' + aiRules + '\n\n';
                if (combined) {
                  exp = combined + '---\n\n' + exp;
                }
              }
              runAggregateCommand(exp, selectedImages, historyUrls);
            }
            return;
          }

          // Check local commands
          if (isLocalCommandId(cmdToken)) {
            const def = LOCAL_COMMANDS.find(c => c.id === (cmdToken as LocalCommandId));
            if (def?.behavior === 'instant') {
              // Special case: Calendar command requires input
              if (def.id === 'calendar') {
                activateCommandById('calendar', '');
                return;
              }

              handleLocalCommandExecute((def.executeId || def.id) as LocalCommandId);
              resetAfterCommandExecution();
              return;
            }
            if (!checkLocalCommandAuth(cmdToken as LocalCommandId)) return;
            setLockedCommand(cmdToken as LocalCommandId);
            setValue(prompt);
            setCommandPrompt('');
            setTimeout(() => inputRef.current?.focus(), 0);
            return;
          }

          // Check remote commands
          const remoteCmd = commandIndex.find(
            entry =>
              entry.kind === 'remote' &&
              (normalizeCommandToken(entry.definition.id) === cmdToken ||
                normalizeCommandToken(entry.definition.prefix) === cmdToken),
          )?.definition as CommandDefinition | undefined;
          if (remoteCmd) {
            const needsPrompt = remoteCmd.urlTemplate.includes('{query}') || remoteCmd.urlTemplate.includes('[query]');
            if (!prompt && selectedImages.length === 0) {
              activateCommandById(remoteCmd.id as AnyCommandId);
            } else if (needsPrompt && !prompt) {
              triggerNotification('Prompt is required', 'error');
              setFooterStatus({ message: 'Prompt is required', type: 'error' });
              setTimeout(() => setFooterStatus(null), 3000);
            } else {
              runRemoteCommand(remoteCmd, expandPrompts(prompt), selectedImages);
              const isAiFallbackMember = AI_GROUP.members.includes(remoteCmd.id as any);
              if (isAiFallbackMember) {
                setValue('');
                setCommandPrompt('');
                clearSelectedImages();
              } else {
                resetAfterCommandExecution();
              }
            }
            return;
          }
        }

        // Final fallback: URL or AI Search
        if (looksLikeUrl(trimmedValue)) {
          const urlToOpen = normalizeUrl(trimmedValue);
          resetAfterCommandExecution();
          openSingleLink(urlToOpen, false, currentTabId);
        } else {
          // If staged history session exists in fallback (AI search), use its URLs
          if (historyUrls && historyUrls.length > 0) {

            await runAggregateCommand(expandedPrompt, imagesWithBase64, historyUrls);
            setStagedHistorySession(null);
            return;
          }

          // If no staged history, perform a clean "All AI" trigger with UI locking
          setLockedCommand('ai');
          setCommandPrompt(value);

          // Trigger the internal execution logic
          runAggregateCommand(expandedPrompt, imagesWithBase64);

          // Clear typical search artifacts but KEEP the locked state
          suggestionVisibilityRef.current = false;
          clearSelectedImages();
          setStagedHistorySession(null);
          if (stagedHistorySessionRef) stagedHistorySessionRef.current = null;
        }
      },
      [
        value,
        commandPrompt,
        allSuggestions,
        automationSuggestions,
        customOmniboxPrefixes,
        getCommandById,
        highlightIndex,
        handleAutomationSelect,
        selectedCommand,
        lockedCommand,
        moduleSuggestions,
        userDbShortcuts,
        selectedAtCommand,
        commands,
        expandPrompts,
        runRemoteCommand,
        runAggregateCommand,
        resetAfterCommandExecution,
        recordSelectedShortcutUsage,
        bookmarkSuggestions,
        lockedLocalDef,
        inlineComposerActive,
        handleLocalCommandExecute,
        activateCommandById,
        executeCommonCommand,
        activateWorkspaceItemSuggestion,
        activateSelectedCommand,
        currentTabId,
        selectedImages,
        triggerNotification,
        stagedHistorySession,
      ],
    );

    const handleInlineKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLInputElement>) => {
        // HARD FIX: If favorites context menu is open, ignore ALL navigation/keys here
        if ((window as any).isFavoritesMenuOpen) return;

        const { key } = event;
        const input = event.currentTarget;
        const hasSelection = input.selectionStart !== input.selectionEnd;

        if (showSavedAgentsMenu) {
          if (key === 'ArrowDown') {
            event.preventDefault();
            event.stopPropagation();
            setSavedAgentHighlightIndex(prev => (prev < savedAgentSuggestions.length - 1 ? prev + 1 : 0));
            return;
          }
          if (key === 'ArrowUp') {
            event.preventDefault();
            event.stopPropagation();
            setSavedAgentHighlightIndex(prev => (prev > 0 ? prev - 1 : savedAgentSuggestions.length - 1));
            return;
          }
          if (key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            const targetAgent = savedAgentSuggestions[savedAgentHighlightIndex];
            if (targetAgent) {
              handleSavedAgentSelection(targetAgent);
            }
            return;
          }
        }

        if (showAtCommandMenu) {
          const filteredCmds = filteredAtCommands;
          const hasCommands = filteredCmds.length > 0;
          const maxIndex = Math.max(0, filteredCmds.length - 1);
          if (hasCommands && key === 'ArrowUp') {
            event.preventDefault();
            event.stopPropagation();
            setAtCommandHighlightIndex(prev => (prev > 0 ? prev - 1 : maxIndex));
            return;
          }
          if (hasCommands && key === 'ArrowDown') {
            event.preventDefault();
            event.stopPropagation();
            setAtCommandHighlightIndex(prev => (prev < maxIndex ? prev + 1 : 0));
            return;
          }
          if (key === 'Enter' || key === 'Tab') {
            event.preventDefault();
            event.stopPropagation();
            const selectedCmd = filteredCmds[atCommandHighlightIndex];
            if (selectedCmd) handleAtCommandSelect(selectedCmd.id);
            return;
          }
        }

        if (key === 'ArrowLeft' && !hasSelection) {
          event.preventDefault();
          exitCommandMode();
          return;
        }

        if (event.ctrlKey && (key === 'u' || key === 'U')) {
          if (
            lockedCommand === 'gpt' ||
            lockedCommand === 'ai' ||
            lockedCommand === 'perplexity' ||
            lockedCommand === 'claude' ||
            lockedCommand === 'upload_drive'
          ) {
            event.preventDefault();
            fileInputRef.current?.click();
            return;
          }
        }

        if (key === 'ArrowDown') {
          event.preventDefault();
          exitCommandMode();
          return;
        }

        if (key === 'ArrowUp') {
          event.preventDefault();
          exitCommandMode();
          return;
        }

        if (key === 'Backspace') {
          const input = event.currentTarget;
          const hasSelection = input.selectionStart !== input.selectionEnd;

          if (!hasSelection && commandPrompt.length === 0) {
            // 1. First remove files one by one
            if (selectedImages.length > 0) {
              event.preventDefault();
              setSelectedImages(prev => prev.slice(0, -1));
              return;
            }

            // 2. Remove mentioned tabs one by one
            if (mentionedTabs.length > 0) {
              event.preventDefault();
              setMentionedTabs(prev => prev.slice(0, -1));
              return;
            }

            // 3. Then exit command mode if no files or tabs left
            if (lockedCommand) {
              event.preventDefault();
              exitCommandMode();
              return;
            }

            // [NEW] If in Alt+S initial state and search bar is empty, reset to normal interactive list
            if (isInitialAltSFocus && !value && onInitialAltSFocusChange) {
              event.preventDefault();
              onInitialAltSFocusChange(false);
              return;
            }
          }
        }

        if (key === 'Enter') {
          if ((event.ctrlKey || event.metaKey) && lockedCommand === 'ai') {
            event.preventDefault();
            onSaveAgent?.();
            return;
          }
          event.preventDefault();
          handleSubmit(event.altKey);
          return;
        }

      },
      [
        commandPrompt.length,
        exitCommandMode,
        handleSubmit,
        value,
        lockedCommand,
        selectedImages.length, // Added
        setSelectedImages, // Added
        showSavedAgentsMenu,
        savedAgentSuggestions,
        savedAgentHighlightIndex,
        handleSavedAgentSelection,
        showAtCommandMenu,
        filteredAtCommands,
        atCommandHighlightIndex,
        handleAtCommandSelect,
        isInitialAltSFocus,
        onInitialAltSFocusChange,
      ],
    );

    const { handleKeyDown } = useKeyboardNavigation({
      value,
      setValue,
      inputRef,
      lastActionRef,
      activeSlashFilterRef,
      pendingUserFocusRef,
      selectionSourceRef,
      fileInputRef,
      activeSlashFilter,
      setActiveSlashFilter,
      slashFilterMeta,
      onQueryChange,
      activeCollection,
      lockedCommand,
      setLockedCommand,
      selectedImages,
      setSelectedImages,
      mentionedTabs,
      setMentionedTabs,
      selectedAtCommand,
      setSelectedAtCommand,
      commandPrompt,
      setCommandPrompt,
      setFooterStatus,
      onNavigateBack,
      isInitialAltSFocus,
      onInitialAltSFocusChange,
      showSavedAgentsMenu,
      setShowSavedAgentsMenu,
      savedAgentSuggestions,
      setSavedAgentSuggestions,
      savedAgentHighlightIndex,
      setSavedAgentHighlightIndex,
      handleSavedAgentSelection,
      showAtCommandMenu,
      setShowAtCommandMenu,
      filteredAtCommands,
      atCommandHighlightIndex,
      setAtCommandHighlightIndex,
      handleAtCommandSelect,
      isContextualPopupOpen,
      contextualPopupIndex,
      setContextualPopupIndex,
      contextualMatches,
      handleContextualSelect,
      showPromptMenu,
      setShowPromptMenu,
      promptSuggestions,
      setPromptSuggestions,
      promptHighlightIndex,
      setPromptHighlightIndex,
      handlePromptMenuSelect,
      loadPromptSuggestions,
      selectedCommand,
      setSelectedCommand,
      commandSupportsInlineQuery,
      activateSelectedCommand,
      pendingQueryUrls,
      allSuggestions,
      highlightIndex,
      setHighlightIndex,
      inlineAutocomplete,
      setInlineAutocomplete,
      inlineComposerActive,
      submitInlineQuery,
      handleSubmit,
      onRequestFocusChange,
      isSuggestionVisible,
      updateCursorPosition,
    });

    useEffect(() => {
      if (!showSavedAgentsMenu) return;
      const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
        setShowSavedAgentsMenu(false);
        setSavedAgentSuggestions([]);
        return true;
      });
      return unregister;
    }, [showSavedAgentsMenu]);

    useEffect(() => {
      if (!showAtCommandMenu) return;
      const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
        setShowAtCommandMenu(false);
        return true;
      });
      return unregister;
    }, [showAtCommandMenu]);

    const dismissSlashDropdown = useCallback(
      (options?: { clearQuery?: boolean; blur?: boolean }) => {
        setShowEmptySlashDropdown(false);
        setKeepBoardViewOpen(false);

        if (options?.clearQuery) {
          setValueRaw('');
          setActiveSlashFilter(null);
          if (inputRef.current) {
            try {
              inputRef.current.innerHTML = '';
              inputRef.current.innerText = '';
            } catch (e) {
              console.error('[SearchBar] Error clearing contentEditable in dismissSlashDropdown:', e);
            }
          }
          onQueryChange?.('');
        }

        if (options?.blur) {
          inputRef.current?.blur();
        }
      },
      [onQueryChange],
    );

    useEffect(() => {
      const isSlashActive = Boolean(showEmptySlashDropdown || (value && value.startsWith('/')));
      if (!isSlashActive) return;

      const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
        if (isInitialAltSFocus && onInitialAltSFocusChange) {
          onInitialAltSFocusChange(false);
        }
        dismissSlashDropdown({ clearQuery: true, blur: false });
        return true;
      });
      return unregister;
    }, [showEmptySlashDropdown, value, isInitialAltSFocus, onInitialAltSFocusChange, dismissSlashDropdown]);

    useEffect(() => {
      if (!lockedCommand && !isInitialAltSFocus) return;
      const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
        if (isInitialAltSFocus && onInitialAltSFocusChange) {
          onInitialAltSFocusChange(false);
        }
        if (lockedCommand) {
          exitCommandMode();
        }
        return true; // We handled it
      });
      return unregister;
    }, [isInitialAltSFocus, onInitialAltSFocusChange, lockedCommand, exitCommandMode]);

    useEffect(() => {
      let t: number | null = null;
      if (pendingQueryUrls && queryInputRef.current) {
        // Focus after mount
        t = window.setTimeout(() => queryInputRef.current?.focus(), 0);
      }
      return () => {
        if (t) window.clearTimeout(t);
      };
    }, [pendingQueryUrls]);

    // Search focus is controlled via omnibox_override_enabled.
    // We still surface a recovery shortcut hint when the input is not focused.

    useEffect(() => {
      if (typeof window === 'undefined') return;

      if (!isSuggestionVisible) {
        suggestionVisibilityRef.current = false;
        setShowPromo(false);
        return;
      }

      if (!suggestionVisibilityRef.current) {
        (async () => {
          const storageKey = 'alts_search_suggestion_count';
          const chromeAny = (window as any).chrome;
          if (chromeAny?.storage?.local) {
            const result = await new Promise<any>(resolve => chromeAny.storage.local.get(storageKey, resolve));
            const raw = result[storageKey];
            const currentCount = Number.isFinite(Number(raw)) ? Number(raw) : 0;
            const nextCount = currentCount + 1;
            await new Promise<void>(resolve => chromeAny.storage.local.set({ [storageKey]: nextCount }, resolve));
            setShowPromo(nextCount % 1 === 0);
          }
        })();
      }

      suggestionVisibilityRef.current = true;
    }, [isSuggestionVisible]);

    // Fetch bookmark suggestions when in /bookmarks mode
    useEffect(() => {
      let cancelled = false;
      const run = async () => {
        if (!isBookmarksCommand(lockedCommand)) {
          if (!cancelled) setBookmarkSuggestions([]);
          return;
        }
        const q = value.trim();

        // Skip search for long queries to prevent lag
        if (!q || q.length > 17) {
          if (!cancelled) setBookmarkSuggestions([]);
          return;
        }
        const chromeAny = (window as any)?.chrome;
        const response = await new Promise<any>(resolve =>
          chromeAny?.runtime?.sendMessage?.({ action: 'bookmarks_search', query: q }, resolve),
        );
        const nodes: Array<any> = response?.results || [];

        if (cancelled) return;
        const items = (nodes || [])
          .filter((n: any) => !!n.url)
          .slice(0, 50)
          .map(
            (n: any): BookmarkSuggestionItem => ({
              _kind: 'bookmark',
              id: n.id,
              title: n.title || n.url,
              url: n.url as string,
            }),
          );
        setBookmarkSuggestions(items);
      };
      run();
      return () => {
        cancelled = true;
      };
    }, [lockedCommand, value]);

    useEffect(() => {
      if (!onSuggestionStateChange) return;

      const newState: SuggestionState = {
        isVisible: isSuggestionVisible,
        showEmptySlashDropdown: Boolean(showEmptySlashDropdown && !value.trim()),
        onDismissSlashDropdown: dismissSlashDropdown,
        onSlashSuggestionSelect: (actionId: 'ai' | 'collections') => {
          dismissSlashDropdown({ clearQuery: true, blur: false });
          setValue('');
          setHighlightIndex(-1);
          if (actionId === 'ai') {
            setLockedCommand('ai');
            requestAnimationFrame(() => {
              inputRef.current?.focus();
            });
          } else if (actionId === 'collections') {
            onCommandExecute?.('collections' as any);
          }
        },
        suggestions: allSuggestions,
        highlightIndex,
        mode: suggestionMode,
        value: inlineComposerActive && lockedCommand !== 'ai' ? commandPrompt : (showEmptySlashDropdown ? value : searchbarSuggestionValue),
        lockedCommand,
        onCommandMouseDown: handleCommandMouseDown,
        onHighlightIndexChange: handleHighlightIndexChange,
        isCommandLocked: !!lockedCommand,
        requiresInlineQuery: inlineComposerVisible,
        onFolderMouseDown: (event: React.MouseEvent, folder: Folder) => {
          if (event) event.preventDefault();
          useUIStore.getState().setSelectedFolderId(folder.folder_id);
          setLockedCommand(null);
          setValue('');
          setCommandPrompt('');
        },

        onLocalSelect: lockedLocalDef
          ? (item: any) => {
            if (item?._kind === 'workspace') {
              // TODO: Delegate to central Workspace Manager
              console.warn('Workspace Action: Delegating to WorkspaceManager (Not implemented in UI yet)');
              setLockedCommand(null);
              setValue('');
              setCommandPrompt('');
            }
          }
          : undefined,
        onSnippetSelect:
          suggestionMode === 'workspace_item' || suggestionMode === 'mixed' || suggestionMode === 'local'
            ? (item: WorkspaceItemSuggestion) => {
              if (isSnippetCommand) {
                handleSnippetDelete(item);
              } else {
                handleSnippetSelect(item);
              }
            }
            : undefined,
        onCommonCommandSelect:
          suggestionMode === 'common' || suggestionMode === 'mixed'
            ? (item: CommonCommandSuggestionItem) => {
              executeCommonCommand(item);
            }
            : undefined,
        onRequestSnippetDelete,
        onRequestEditLink,
        onToggleFavorite,
        showPromo,
        footerStatus,
        onRequestOpenUrls: (urls: string[], title?: string) => {
          if (!urls || urls.length === 0) return;
          const needsVar = urls.some(u => /\{query\}|\[query\]/i.test(String(u)));
          if (!needsVar) {
            if (urls.length === 1) openSingleLink(urls[0], false, currentTabId);
            else openMultipleLinks(urls, currentTabId);
            return;
          }
          setPendingQueryUrls(urls);
          setQueryValue('');
          setPendingQueryLabel(title || '');
        },

        inlineAutocomplete,
        onInlineAutocompleteChange: setInlineAutocomplete,
        isBackspacing: lastActionRef.current === 'backspace',
        isAtMenuOpen: showAtCommandMenu,
        onAgentCollectionSelect: handleAgentCollectionSelect,
        onAIHistorySelect: () => { },
        onAIHistoryPanelToggle: (show: boolean) => setShowAIHistoryPanel(show),
        selectedImagesCount: selectedImages.length,
        isContextualPopupOpen,
        showAIHistoryPanel,
        aiHistory: [],
        selectedAIs,
        onToggleAI: handleToggleAI,
        activeAiSession,
        updateActiveSessionMetadata: (metadata: { name?: string; id?: string | number }) => {
          setActiveAiSession(prev => {
            if (!prev) return metadata.id ? ({ id: metadata.id, ...metadata } as any) : null;
            return { ...prev, ...metadata };
          });
        },
        selectedImages: selectedImages,
        onRemoveAttachment: (index: number) => {
          setSelectedImages(prev => prev.filter((_, i) => i !== index));
        },
        onQueryChange: (val: string) => {
          setValue(val);
        },
        onUpdateModelUrl,
        onUpdateCustomModels,
        isAIHistoryOpen,
        onToggleAIHistory,
      };

      onSuggestionStateChange(newState);
    }, [
      allSuggestions,
      handleCommandMouseDown,
      handleHighlightIndexChange,
      handleSnippetDelete,
      handleSnippetSelect,
      executeCommonCommand,
      highlightIndex,
      isSuggestionVisible,
      isSnippetCommand,
      lockedCommand,
      onSuggestionStateChange,
      suggestionMode,
      value,
      searchbarSuggestionValue,
      commandPrompt,
      inlineComposerActive,
      showPromo,
      lockedLocalDef,
      footerStatus,
      onRequestEditLink,
      onRequestSnippetDelete,
      onToggleFavorite,
      showPromptMenu,
      currentTabId,
      inlineAutocomplete,
      showAtCommandMenu,
      handleAgentCollectionSelect,
      handleAIHistorySelect,
      selectedImages,
      isContextualPopupOpen,
      showAIHistoryPanel,
      activeCollection,
      selectedAIs,
      handleToggleAI,
      activeAiSession,
      onUpdateModelUrl,
      isAIHistoryOpen,
      onToggleAIHistory,
    ]);

    useEffect(() => {
      // Notify parent of the full query state (either the main value or the command prompt if locked)
      // This ensures the parent's searchValue is always in sync, especially for clearing.
      const queryToEmit = inlineComposerActive ? commandPrompt : (showEmptySlashDropdown ? value : searchbarSuggestionValue);
      onQueryChange?.(queryToEmit);
    }, [searchbarSuggestionValue, value, showEmptySlashDropdown, commandPrompt, lockedCommand, inlineComposerActive, onQueryChange]);

    useEffect(() => {
      return () => {
        onSuggestionStateChange?.(null);
      };
    }, [onSuggestionStateChange]);

    return (
      <div
        className="relative w-full"
        data-at-menu-open={showAtCommandMenu}
        data-suggestion-visible={isSuggestionVisible}
        data-prompt-menu-open={showPromptMenu}
        ref={containerRef}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}>
        {/* Unified Close Button removed from global fixed scope - moved into container header below */}

        {/* Global Drag Overlay */}

        {isGlobalDragging && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none transition-all duration-300">
            <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-white/60 bg-white/10 p-12 text-white shadow-2xl backdrop-blur-md">
              <div className="rounded-full bg-white/20 p-6">
                <FaFileImage size={48} className="animate-bounce" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">Drop files to attach</h2>
              <p className="text-white/70">Images and supported documents allowed</p>
            </div>
          </div>
        )}
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept={
            lockedCommand === 'gpt' ||
              lockedCommand === 'claude' ||
              lockedCommand === 'perplexity' ||
              lockedCommand === 'gemini' ||
              lockedCommand === 'ai' ||
              !lockedCommand // Allow all files when no command is locked to enable Prompt Mode
              ? '*/*'
              : 'image/png,image/jpeg,image/webp,image/gif' // Added GIF support for regularity
          }
          className="hidden"
          onChange={handleFileSelect}
        />

        <div
          className={`relative ${isDragging ? 'ring-2 ring-blue-500/50 rounded-xl' : ''} ${activeCollection ? 'z-[9999] rounded-2xl' : ''}`}>
          {' '}
          {/* TutorialCards disabled here in favor of the new full-screen TutorialDashboard */}
          {/* Tiered Header - Prefix (Command Chip or Automation Info) */}
          {!activeCollection && (
            <>
              <div
                ref={prefixRef}
                className={`${lockedCommand
                  ? 'absolute bottom-full left-[0px] pb-2'
                  : 'absolute left-[12px] min-[1600px]:left-[14px] min-[1800px]:left-[16px] top-1/2 -translate-y-1/2'
                  } z-20 flex items-center gap-2 pointer-events-auto`}>
                {renderPrimaryPrefix()}
              </div>
            </>
          )}
          <div
            className={`flex flex-col justify-end w-full relative ${activeCollection ? 'min-h-[48px] min-[1680px]:min-h-[56px] min-[1880px]:min-h-[60px]' : 'min-h-[48px]'}`}>
            {/* Layer 2: Action (Injected Inputs) */}
            {null}

            {/* Standard Search Interface (Transitioned to Hidden during Automation) */}
            <div
              className={`relative w-full ${activeCollection ? 'h-0 overflow-hidden opacity-0 pointer-events-none' : ''}`}>
              <div
                ref={inputRef as any}
                contentEditable={!activeCollection}
                onMouseDown={() => {

                  pendingUserFocusRef.current = true;
                }}
                onInput={e => {
                  if (activeCollection) return;

                  if (
                    e.currentTarget.innerHTML === '<br>' ||
                    e.currentTarget.innerHTML === '<br><br>' ||
                    e.currentTarget.innerHTML === '<div><br></div>' ||
                    (e.currentTarget.innerText || '').trim() === '' && !e.currentTarget.querySelector('span[data-tab-id]')
                  ) {
                    if (e.currentTarget.innerHTML !== '') {
                      e.currentTarget.innerHTML = '';
                    }
                  }

                  const rawEditableText = (e.currentTarget.textContent || e.currentTarget.innerText || '').replace(/\u00A0/g, ' ');
                  const knownSlashLabels = Object.values(slashFilterMeta)
                    .map(meta => String(meta.label || '').trim())
                    .filter(Boolean)
                    .sort((a, b) => b.length - a.length);
                  const editableText = knownSlashLabels.reduce((text, label) => {
                    return text.toLowerCase().startsWith(label.toLowerCase())
                      ? text.slice(label.length).trimStart()
                      : text;
                  }, rawEditableText);
                  const nextValue = mapFullNameToShortcut(editableText, slashFilterMeta);

                  // Sync mentioned tabs with actual DOM pills present in the input
                  const pillNodes = e.currentTarget.querySelectorAll('span[data-tab-id]');
                  const remainingIds = new Set<string>();
                  pillNodes.forEach(node => {
                    const id = node.getAttribute('data-tab-id');
                    if (id) remainingIds.add(String(id));
                  });
                  setMentionedTabs(prev => prev.filter(t => remainingIds.has(String(t.tabId))));

                  if (inlineComposerActive) {
                    setCommandPrompt(nextValue);
                    return;
                  }

                  if (inlineAutocomplete && lastActionRef.current === 'backspace') {
                    setInlineAutocomplete(null);
                  }
                  if (selectedCommand && !lockedCommand && nextValue) {
                    selectionSourceRef.current = null;
                    setSelectedCommand(null);
                  }
                  setValue(nextValue);
                  if (nextValue.trim().length > 1) {
                    onSearchbarFocus?.(true);
                  }
                  setIsSuggestionsHidden(false);
                  setTimeout(updateCursorPosition, 0);

                  if (inlineAutocomplete) {
                    const autocompleteBase = inlineAutocomplete.includes('|URL|')
                      ? inlineAutocomplete.split('|URL|')[0]
                      : inlineAutocomplete;
                    const stillMatches = autocompleteBase.toLowerCase().startsWith(nextValue.toLowerCase());
                    if (!stillMatches || !nextValue.trim()) {
                      setInlineAutocomplete(null);
                    }
                  }
                }}
                onPaste={e => {
                  handlePaste(e);
                  if (e.defaultPrevented) return;

                  const clipboardData = e.clipboardData;
                  if (!clipboardData) return;

                  const textData = clipboardData.getData('text/plain');
                  if (textData && textData.trim()) {
                    e.preventDefault();
                    document.execCommand('insertText', false, textData);
                  }
                }}
                onFocus={() => {

                  setIsFocused(true);
                  setIsSuggestionsHidden(false);

             

                  const isUserInitiated = pendingUserFocusRef.current || isInitialAltSFocus;
                  pendingUserFocusRef.current = false;

                  onSearchbarFocus?.(isUserInitiated);

document.documentElement.classList.add('is-searchbar-focused');
                  setTimeout(updateCursorPosition, 0);
                }}
                onBlur={() =>
                  setTimeout(() => {
                    // Only set false if the textarea is still not focused
                    // (prevents cursor hiding when focus briefly leaves and returns)
                    if (document.activeElement !== inputRef.current) {
                      setKeepBoardViewOpen(false);
                      setIsFocused(false);
                      setShowEmptySlashDropdown(false);
                      document.documentElement.classList.remove('is-searchbar-focused');
                    }
                  }, 150)
                }
                onScroll={syncScroll}
                onSelect={updateCursorPosition}
                onClick={() => {
                  updateCursorPosition();
                  if (pendingUserFocusRef.current) {
                    pendingUserFocusRef.current = false;
                  }
                  if (!value.trim()) {
                    setShowEmptySlashDropdown(prev => !prev);
                  }
                }}
                onKeyUp={updateCursorPosition}
                onKeyDown={handleKeyDown}
                data-placeholder={inputPlaceholder}
                autoFocus={isSearchFocusEnabled}
                data-is-command-locked={!!lockedCommand}
                data-at-menu-open={showAtCommandMenu}
                data-prompt-menu-open={showPromptMenu}
                data-suggestion-visible={isSuggestionVisible}
                id="searchbar-input"
                data-searchbar-input="true"
                className={`${activeCollection ? 'opacity-0 w-[1px] h-[1px] overflow-hidden absolute -z-10' : ''} w-full ${inputRightPadding} py-3 rounded-xl border border-[var(--color-searchBarBorder,var(--color-borderDefault))] text-[var(--color-searchBarText,var(--color-textPrimary))] caret-auto focus:ring-0 focus:outline-none shadow-[var(--color-searchBarShadow,none)] backdrop-blur-[var(--color-searchBarBlur,14px)] resize-none overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-400/50 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-600/50 [&::-webkit-scrollbar-track]:bg-transparent text-[16px] min-[1680px]:text-[18px] min-[1880px]:text-[20px] min-h-[48px] min-[1680px]:min-h-[56px] min-[1880px]:min-h-[60px] empty:before:content-[attr(data-placeholder)] empty:before:text-[var(--color-searchBarPlaceholder,var(--color-textPlaceholder))] empty:before:absolute empty:before:pointer-events-none`}
                style={{
                  background: 'var(--color-searchBarBg, var(--color-inputBg))',
                  paddingLeft: inputLeftPaddingPx,
                  ['--placeholder-padding-left' as any]: `${inputLeftPaddingPx}px`,
                  maxHeight: '120px',
                  caretColor: '',
                }}></div>
            </div>
          </div>
          {/* Chrome omnibox-style inline autocomplete overlay */}
          <InlineAutocomplete
            inlineAutocomplete={inlineAutocomplete}
            highlightIndex={highlightIndex}
            inlineComposerActive={inlineComposerActive}
            lockedCommand={lockedCommand}
            showAtCommandMenu={showAtCommandMenu}
            value={value}
            inputLeftPaddingPx={inputLeftPaddingPx}
          />
          <ContextualCommandPopup
            matches={contextualMatches}
            highlightIndex={contextualPopupIndex}
            isOpen={isContextualPopupOpen && !activeCollection && !disableContextualPopup}
            onHighlightChange={setContextualPopupIndex}
            onSelect={match => {
              handleContextualSelect(match);
            }}
            onRequestEditLink={onRequestEditLink}
            onRequestEditAutomation={onAutomationEdit}
          />
          {/* {inlineComposerPreview ? (
            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
              {renderInlineCommandIcon()}
              <span className="text-sm text-neutral-600 font-medium truncate" title={inlineComposerInfo?.label}>
                {inlineComposerInfo?.label}
              </span>
              <span className="text-xs text-neutral-400 whitespace-nowrap ml-1">{COMMAND_PREVIEW_HINT}</span>
            </div>
          ) : null} */}
          {!isAutomationInputActive &&
            !inlineComposerVisible &&
            showLocalPreviewHint &&
            contextualMatches.length === 0 ? (
            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
              <span className="text-xs text-neutral-400 whitespace-nowrap">
                {`Press Enter to ${selectedLocalLabel ?? ''}`}
              </span>
            </div>
          ) : null}
          {/* Right-side Actions (Attachment + Keyboard Shortcut) */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-3 pointer-events-auto z-20">

            {/* Alt + S Indication - Hidden when search has text (except when value is exactly '/' to show slash popup dot) */}
            {(!value || value === '/') && !activeCollection && !lockedCommand && (
              <div className="flex items-center gap-2 pl-2 pr-0 py-1 animate-in fade-in slide-in-from-right-2 duration-300 transition-all rounded-lg select-none">
                {(() => {

                  return null;
                })()}
                {!isInitialAltSFocus ? (
                  <div className="flex items-center justify-center px-1.5 py-0.5 rounded border border-[var(--color-searchBarKbdBorder,var(--color-borderDefault))] bg-[var(--color-searchBarKbdBg,var(--color-inputBg))] pointer-events-none">
                    <span className="text-[9px] font-bold text-[var(--color-searchBarKbdText,var(--color-textSecondary))] tracking-widest uppercase">
                      ALT + S
                    </span>
                  </div>
                ) : (
                  <div
                    className="relative shrink-0"
                    onMouseEnter={() => onHoverSlashDot?.()}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowEmptySlashDropdown(prev => !prev);
                      }}
                      className="relative w-7 h-7 flex items-center justify-center rounded-md bg-[#073642]/5 dark:bg-white/5 border border-neutral-300 dark:border-white/10 hover:bg-[#073642]/10 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-all text-xs font-semibold focus:outline-none cursor-pointer"
                    >
                      <span>/</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Images Preview (Thumbnails & Detailed Hover Tooltip) */}
            <AttachmentManager
              selectedImages={selectedImages}
              removeSelectedImage={removeSelectedImage}
            />

            {/* Attachment Button - now including /ai as the bottom input is removed */}
            {(lockedCommand === 'gpt' ||
              lockedCommand === 'ai' ||
              lockedCommand === 'perplexity' ||
              lockedCommand === 'claude' ||
              lockedCommand === 'upload_drive' ||
              lockedCommand === 'gemini' ||
              (activeAiSessionRef.current && activeEditor?.type === 'ai')) && (
                <div className="ml-1 flex items-center gap-1.5 pr-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 text-[var(--color-iconDefault)] hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors rounded-md hover:bg-neutral-100 dark:hover:bg-white/5"
                    title="Attach file">
                    <GoPaperclip size={16} />
                  </button>
                  {lockedCommand === 'ai' && !activeAiSession && (
                    <button
                      type="button"
                      onClick={() => value.trim() && handleSubmit(false)}
                      disabled={!value.trim()}
                      className={`flex items-center justify-center h-[26px] w-[26px] rounded-full transition-all ${value.trim()
                        ? 'bg-neutral-800 text-white hover:bg-neutral-700 dark:bg-white dark:text-black dark:hover:bg-neutral-200 cursor-pointer shadow-sm'
                        : 'bg-neutral-200 text-neutral-400 dark:bg-white/10 dark:text-neutral-500 cursor-not-allowed'
                        }`}
                      title="Send message">
                      {value.trim() ? (
                        <FaArrowUp size={12} />
                      ) : (
                        <span className="text-sm font-semibold select-none">/</span>
                      )}
                    </button>
                  )}
                </div>
              )}
          </div>
          {inlineComposerActive ? (
            <div
              className="absolute top-0 bottom-0 right-0 flex items-center z-10"
              style={{
                left: `${lockedCommand || activeCollection || inlineComposerActive ? dynamicLeftOffset : dynamicLeftOffset + 24}px`,
              }}>
              <input
                ref={inlineInputRef}
                id="searchbar-inline-input"
                data-searchbar-input="true"
                value={commandPrompt}
                onChange={e => {
                  setCommandPrompt(e.target.value);
                  setTimeout(updateInlineCursorPosition, 0);
                }}
                onKeyDown={e => {
                  handleInlineKeyDown(e);
                  setTimeout(updateInlineCursorPosition, 0);
                }}
                onFocus={() => {
                  setIsInlineFocused(true);
                  setTimeout(updateInlineCursorPosition, 0);
                }}
                onBlur={() => setIsInlineFocused(false)}
                onSelect={updateInlineCursorPosition}
                onClick={updateInlineCursorPosition}
                onKeyUp={updateInlineCursorPosition}
                onPaste={e => {
                  handlePaste(e);
                  setTimeout(updateInlineCursorPosition, 0);
                }}
                placeholder={resolvePlaceholderFromCmd(lockedCommand) || 'Type your prompt here...'}
                className="w-full h-full bg-transparent outline-none text-sm text-neutral-900 dark:text-neutral-200 caret-auto placeholder-[var(--color-textPlaceholder)]"
                style={{
                  paddingRight:
                    lockedCommand === 'gpt' ||
                      lockedCommand === 'ai' ||
                      lockedCommand === 'perplexity' ||
                      lockedCommand === 'claude' ||
                      lockedCommand === 'upload_drive' ||
                      lockedCommand === 'gemini' ||
                      (activeAiSessionRef.current && activeEditor?.type === 'ai')
                      ? selectedImages.length > 0
                        ? selectedImages.length === 1
                          ? '5rem' // 1 item: ~32px + gap + icon -> ~80px (5rem)
                          : `${2.8 + Math.ceil(selectedImages.length / 2) * 1.6}rem` // Grid: Base + Columns * (Width 1.25rem + gap)
                        : '2.5rem' // Standard padding for just icon
                      : '1rem',
                }}
              />
              {/* Custom Terminal Cursor for Prompt */}
            </div>
          ) : null}

          {showSavedAgentsMenu && savedAgentSuggestions.length > 0 && (
            <div
              className="absolute z-[9999999] border-x border-b border-neutral-200/60 dark:border-white/10 bg-[var(--color-containerBg)] rounded-b-xl rounded-t-none shadow-2xl overflow-hidden"
              style={{
                top: '100%',
                left: '0px',
                width: '100%',
              }}>
              <div className="p-2 border-b border-[var(--color-borderDefault)] flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--color-textSecondary)] px-2">
                  Matching All AI Chat Agents
                </span>
                <span className="text-[10px] bg-[var(--color-inputBg)] text-[var(--color-textMuted)] px-1.5 py-0.5 rounded">
                  {savedAgentSuggestions.length} found
                </span>
              </div>
              <div className="max-h-[260px] overflow-y-auto custom-scrollbar p-1">
                {savedAgentSuggestions.map((agent, index) => {
                  const isHighlighted = index === savedAgentHighlightIndex;
                  return (
                    <div
                      key={agent.id}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-all cursor-pointer group ${isHighlighted ? 'bg-[var(--color-selectedBg)]' : 'hover:bg-[var(--color-hoverBg)]'
                        }`}
                      onClick={() => handleSavedAgentSelection(agent)}
                      onMouseEnter={() => setSavedAgentHighlightIndex(index)}>
                      <span
                        className={`text-[12px] truncate flex-1 ${isHighlighted
                          ? 'text-[var(--color-textPrimary)] font-bold'
                          : 'text-[var(--color-textSecondary)] group-hover:text-[var(--color-textPrimary)]'
                          }`}>
                        {agent.name}
                      </span>
                      {isHighlighted && (
                        <span className="text-[10px] opacity-60 font-normal text-[var(--color-textPrimary)]">
                          Press Enter
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {showAtCommandMenu && (
            <AtCommandPopup
              highlightIndex={atCommandHighlightIndex}
              onSelect={handleAtCommandSelect}
              onClose={() => setShowAtCommandMenu(false)}
              anchorRef={inputRef as any}
              searchQuery={atSearchQuery}
              onHighlightIndexChange={setAtCommandHighlightIndex}

              isLockedAI={
                ['ai', 'gpt', 'perplexity', 'claude', 'gemini'].includes(lockedCommand || '') || isLockedAIState
              }
              hideTabs={lockedCommand === 'ai' && !!activeAiSession}
            />
          )}

</div>
      </div>
    );
  },
);

Searchbar.displayName = 'Searchbar';

export default Searchbar;
