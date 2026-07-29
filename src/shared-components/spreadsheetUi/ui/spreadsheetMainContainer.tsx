import React, { useEffect, useMemo } from 'react';
import { useAppearance } from '@extension/ui';
import { useState } from 'react';
import { FaSearch,
  FaTimes,
  FaFilter,
  FaCode,
  FaLink,
  FaBookmark,
  FaTerminal,
  FaRobot,
  FaGlobe,
  FaLock,
  FaUsers,
  FaCheck,
  FaRegStar,
  FaPuzzlePiece } from 'react-icons/fa';
import { FiFilter, FiSettings, FiZap, FiChevronLeft, FiChevronRight, FiCommand, FiX } from 'react-icons/fi';
import { BsStarFill, BsKeyboard, BsCalendarCheck } from 'react-icons/bs';
import { MdOutlineShortcut } from 'react-icons/md';
import { LuArrowRightLeft } from 'react-icons/lu';
import { CustomSearchPrefixesForOmniboxStorage, CustomOmniboxPrefixes } from '../../../storage/localStorage/customSearchPrefixesForOmniboxStorage';
import { VisualKeyDisplay } from '../../../shared-components/hotkeys/ui/VisualKeyDisplay';
import { EditablePrefixKey } from '../../../shared-components/shortcuts/ui/EditablePrefixKey';
import NotesIcon from '../../../shared-components/icons/notesIcon';
import StackedLinkIcon from '../../../shared-components/icons/stackedLinkIcon';
import clsx from 'clsx';
import SpreadsheetTable from './spreadsheetTable';
import { useSpreadsheetStore } from '../logic/spreadsheetStateStore';
import { useDbStore } from '../../../storage/store/useDbStore';
import { useUser } from '../../../shared-components/favorites/favoriteHooks';

import { useUIStore } from '../../../shared-components/uiStateManager';
import SpreadsheetToolbar from './spreadsheetToolbar';
import SpreadsheetQuickAddModal from './spreadsheetQuickAddModal';
import Branding from '../../../shared-components/Branding';
import { SessionGridIcon } from '../../icons/sessionGridIcon';


interface SheetUIProps {
  onClose?: () => void;
  savedAutomations?: any[];
  savedAgents?: any[];
  onCreateOrganization?: () => void;
  onOrganizationSettings?: (orgId: string, orgName: string) => void;
  onCreateWorkspace?: () => void;
  isLoggedIn?: boolean;
  onRequireLogin?: () => void;
  onBoardViewRedirect?: () => void;
  isEmbedded?: boolean;
}

const EMPTY_ARRAY: any[] = [];

const SpreadsheetMainContainer: React.FC<SheetUIProps> = ({
  onClose,
  savedAutomations = EMPTY_ARRAY,
  savedAgents = EMPTY_ARRAY,
  onCreateOrganization,
  onOrganizationSettings,
  onCreateWorkspace,
  isLoggedIn,
  onRequireLogin,
  onBoardViewRedirect,
  isEmbedded = false,
}) => {
  const syncRealNotes = useSpreadsheetStore(state => state.syncRealNotes);
  const { isPickerOpen, pickerRowIndex, closePicker, updateRowLocation, openPicker, searchTerm, setSearchTerm, setSelectedCell, isCompactMode, toggleCompactMode } = useSpreadsheetStore();
    const { theme } = useAppearance();
    const [bookmarks, setBookmarks] = React.useState<any[]>([]);
  const [tutorialStep, setTutorialStep] = React.useState<number | null>(null);
  const [cardPos, setCardPos] = React.useState<{ top: number; left: number; right?: number } | null>(null);
  const [omniboxPrefixes, setOmniboxPrefixes] = useState<CustomOmniboxPrefixes | null>(null);

  React.useEffect(() => {
    if (isEmbedded !== undefined) {
      useSpreadsheetStore.getState().setIsEmbedded(isEmbedded);
    }
  }, [isEmbedded]);

  React.useEffect(() => {
    const loadPrefixes = () => {
      CustomSearchPrefixesForOmniboxStorage.getPrefixes().then(prefixes => {
        setOmniboxPrefixes(prefixes);
      }).catch(console.error);
    };
    
    loadPrefixes();
    window.addEventListener('omniboxPrefixesChanged', loadPrefixes);
    
    return () => {
      window.removeEventListener('omniboxPrefixesChanged', loadPrefixes);
    };
  }, []);

  React.useEffect(() => {
    if (tutorialStep === null) {
      setCardPos(null);
      return;
    }

    const updatePosition = () => {
      const ids = ['sheet-search-wrapper', 'sheet-toolbar-add-btn', 'sheet-toolbar-filter-btn'];
      const targetId = ids[tutorialStep];
      const el = document.getElementById(targetId);
      if (el) {
        const rect = el.getBoundingClientRect();
        // Focus the search input if step is 0
        if (tutorialStep === 0) {
          const inputEl = document.getElementById('sheet-search-name');
          if (inputEl instanceof HTMLElement) {
            inputEl.focus();
          }
        } else if (el instanceof HTMLElement) {
          el.focus();
        }

        const container = document.getElementById('sheet-ui-container');
        if (container) {
          const cRect = container.getBoundingClientRect();
          const computedZoom = window.getComputedStyle(container).zoom;
          const zoom = parseFloat(computedZoom) || 1;

          if (tutorialStep === 0) {
            // Pointing to Search Input (from top)
            // Center horizontally, position below the element
            setCardPos({
              top: (rect.bottom - cRect.top + 10) / zoom,
              left: (rect.left - cRect.left + rect.width / 2) / zoom,
            });
          } else {
            // Pointing to Toolbar buttons (from right)
            // Align vertically with center, position to the left of the element
            setCardPos({
              top: (rect.top - cRect.top + rect.height / 2) / zoom,
              left: (rect.left - cRect.left - 10) / zoom,
            });
          }
        }
      }
    };

    // Recalculate position on window resize for perfect alignment
    window.addEventListener('resize', updatePosition);

    // Stable delay to ensure render and layout are completely settled
    const timer = setTimeout(updatePosition, 250);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
    };
  }, [tutorialStep]);

    const userId = useUser();
    // removed local hotkeys and shortcuts state

  const notes = useDbStore(state => state.notes);
  const links = useDbStore(state => state.links);
  const snippets = useDbStore(state => state.snippets);
  const workspaces = useDbStore(state => state.workspaces);
  const folders = useDbStore(state => state.folders);
  const favorites = useDbStore(state => state.favorites);
  const hotkeysMap = useDbStore(state => state.hotkeysMap);
  const shortcutsMap = useDbStore(state => state.shortcutsMap);


  
  // 1. Initial Load of Favorites, Hotkeys and Shortcuts
  useEffect(() => {
    
    // Moved loadKeys to a separate useEffect that depends on isLoggedIn

    // Fetch Bookmarks
    const flattenBookmarks = (nodes: any, result: any[] = []) => {
      if (!nodes) return result;
      // If the response is wrapped in an object like { tree: [...] }
      if (!Array.isArray(nodes) && Array.isArray(nodes.tree)) {
        nodes = nodes.tree;
      }
      if (!Array.isArray(nodes)) return result;
      
      nodes.forEach((node: any) => {
        if (node.url) {
          result.push(node);
        }
        if (node.children) {
          flattenBookmarks(node.children, result);
        }
      });
      return result;
    };

    const loadBookmarks = () => {
      const chromeAny = (window as any).chrome;
      if (chromeAny?.bookmarks?.getTree) {
        chromeAny.bookmarks.getTree((tree: any) => {
          const flattened = flattenBookmarks(tree);
          setBookmarks(flattened);
        });
      } else if (chromeAny?.runtime?.sendMessage) {
        chromeAny.runtime.sendMessage({ action: 'bookmarks_get_tree' }, (response: any) => {
          if (!chromeAny.runtime.lastError && response?.ok && Array.isArray(response.results)) {
            // response.results is already flattened from the background script
            setBookmarks(response.results);
          }
        });
      }
    };

    loadBookmarks();

    if (chrome.bookmarks?.onRemoved) {
      chrome.bookmarks.onRemoved.addListener(loadBookmarks);
      chrome.bookmarks.onCreated.addListener(loadBookmarks);
      chrome.bookmarks.onChanged.addListener(loadBookmarks);
    }

    // 🚀 Handle click outside to clear all focus/selection
    const handleOutsideClick = (e: MouseEvent) => {
      // If an overlay editor is currently open, do not intercept clicks or blur elements
      if (useUIStore.getState().activeEditor) {
        return;
      }

      const container = document.getElementById('sheet-ui-container');
      if (container && !container.contains(e.target as Node)) {
        const store = useSpreadsheetStore.getState();
        store.setSelectedCell(null);
        store.setEditingCell(null);

        // Force blur any active elements to ensure focus is truly gone
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };
    window.addEventListener('mousedown', handleOutsideClick, true); // Use capture phase
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick, true);
    };
  }, []);

  // 3. Sync Logic
  useEffect(() => {
    syncRealNotes(
      notes,
      links,
      snippets,
      workspaces,
      folders,
      userId || 'local_user',
        favorites,
        hotkeysMap,
      shortcutsMap,
      savedAutomations,
      savedAgents,
      bookmarks,
    );
  }, [
    notes,
    links,
    snippets,
    workspaces,
    folders,
    userId,
      favorites,
      hotkeysMap,
    shortcutsMap,
    syncRealNotes,
    savedAutomations,
    savedAgents,
    bookmarks,
  ]);

  const pickerRow = pickerRowIndex !== null ? useSpreadsheetStore.getState().tableData[pickerRowIndex] : null;

  const handleOpenTutorial = async () => {
    window.dispatchEvent(new CustomEvent('openTutorial'));
  };

  const handleCloseTutorial = () => {
    setTutorialStep(null);
  };

  const handleNextStep = (step: number) => {
    if (step < 2) {
      setTutorialStep(step + 1);
    } else {
      handleCloseTutorial();
    }
  };

  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = React.useState(false);
  const [swapMenuOpen, setSwapMenuOpen] = React.useState<string | null>(null);

  const {
    categoryFilter,
    setCategoryFilter,
    visibilityFilter,
    setVisibilityFilter,
    showFavoritesOnly,
    setShowFavoritesOnly,
    showHotkeysOnly,
    setShowHotkeysOnly,
    showShortcutsOnly,
    setShowShortcutsOnly,
    spaceFilter,
    setSpaceFilter,
  } = useSpreadsheetStore();

  const filterOptions = React.useMemo(() => {
    const allOptions = [
      // Spaces
      { type: 'space', id: 'all', label: 'All Spaces', icon: <FaFilter className="text-[10px]" /> },
      {
        type: 'space' as const,
        id: 'none_org',
        label: 'Personal Space',
        icon: (
          <div className="w-3.5 h-3.5 rounded-full bg-neutral-400 flex items-center justify-center font-bold text-[6px] text-white">N</div>
        )
      },
      // Categories
      { type: 'category' as const, id: 'all', label: 'All', icon: (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      )},
      { type: 'category' as const, id: 'note', label: 'Notes', icon: <NotesIcon className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" /> },
      { type: 'category' as const, id: 'snippet', label: 'Snippets', icon: <FaCode className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" /> },
      { type: 'category' as const, id: 'todo', label: 'Todos', icon: <BsCalendarCheck className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" /> },
      { type: 'category' as const, id: 'link', label: 'Links', icon: <FaLink className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" /> },
      { type: 'category' as const, id: 'session', label: 'Tab Sessions', icon: <SessionGridIcon className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" /> },
      { type: 'category' as const, id: 'general_commands', label: 'System Commands', icon: <FaTerminal className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" /> },
      { type: 'category' as const, id: 'commands', label: 'Browser Commands', icon: <FaTerminal className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" /> },
      {
        type: 'category' as const,
        id: 'automation',
        label: 'Automations',
        icon: <FiZap className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" />,
      },
      {
        type: 'category' as const,
        id: 'agent',
        label: 'Chat Agents',
        icon: <FaRobot className="w-4 h-4 shrink-0 text-[var(--color-iconDefault)]" />,
      },
      // Visibility
      { type: 'visibility' as const, id: 'all', label: 'All Scopes', icon: <FaGlobe className="text-[10px]" /> },
      { type: 'visibility' as const, id: 'private', label: 'Private', icon: <FaLock className="text-[10px]" /> },
      { type: 'visibility' as const, id: 'public', label: 'Public', icon: <FaGlobe className="text-[10px]" /> },
      { type: 'visibility' as const, id: 'shared', label: 'Shared', icon: <FaUsers className="text-[10px]" /> },
      // Features (Quick Filters)
      {
        type: 'feature' as const,
        id: 'favorites',
        label: 'Favorites',
        icon: <FaRegStar className="text-[11px]" />,
        activeIcon: <BsStarFill className="text-[11px]" />,
      },
      {
        type: 'feature' as const,
        id: 'hotkeys',
        label: 'Hotkeys',
        icon: <BsKeyboard className="text-[11px]" />,
      },
      {
        type: 'feature' as const,
        id: 'shortcuts',
        label: 'Shortcuts',
        icon: <MdOutlineShortcut className="text-[11px]" />,
      },
    ];

    if (isEmbedded) {
      // Filter out categories not supported or not desired in the embedded website context
      return allOptions.filter(opt => {
        if (opt.type === 'category' && (opt.id === 'commands' || opt.id === 'general_commands')) {
          return false;
        }
        return true;
      });
    }

    return allOptions;
  }, [isEmbedded]);

  const isSelected = (opt: any) => {
    if (opt.type === 'space') return spaceFilter.includes(opt.id!);
    if (opt.type === 'category') return categoryFilter.includes(opt.id!);
    if (opt.type === 'visibility') return visibilityFilter.includes(opt.id!);
    if (opt.type === 'feature') {
      if (opt.id === 'favorites') return showFavoritesOnly;
      if (opt.id === 'hotkeys') return showHotkeysOnly;
      if (opt.id === 'shortcuts') return showShortcutsOnly;
    }
    return false;
  };

  const handleSelect = (opt: any) => {
    if (opt.type === 'space') {
      if (opt.id === 'all') setSpaceFilter(['all']);
      else {
        let next = spaceFilter.filter(x => x !== 'all');
        if (next.includes(opt.id!)) {
          next = next.filter(x => x !== opt.id);
          if (next.length === 0) next = ['all'];
        } else {
          next.push(opt.id!);
        }
        setSpaceFilter(next);
      }
    } else if (opt.type === 'category') {
      if (opt.id === 'all') setCategoryFilter(['all']);
      else {
        let next = categoryFilter.filter(x => x !== 'all');
        if (next.includes(opt.id!)) {
          next = next.filter(x => x !== opt.id);
          if (next.length === 0) next = ['all'];
        } else {
          next.push(opt.id!);
        }
        setCategoryFilter(next);
      }
    } else if (opt.type === 'visibility') {
      if (opt.id === 'all') setVisibilityFilter(['all']);
      else {
        let next = visibilityFilter.filter(x => x !== 'all');
        if (next.includes(opt.id!)) {
          next = next.filter(x => x !== opt.id);
          if (next.length === 0) next = ['all'];
        } else {
          next.push(opt.id!);
        }
        setVisibilityFilter(next);
      }
    } else if (opt.type === 'feature') {
      if (opt.id === 'favorites') setShowFavoritesOnly(!showFavoritesOnly);
      if (opt.id === 'hotkeys') setShowHotkeysOnly(!showHotkeysOnly);
      if (opt.id === 'shortcuts') setShowShortcutsOnly(!showShortcutsOnly);
    }
  };

  const handleClearAll = () => {
    setCategoryFilter(['all']);
    setVisibilityFilter(['all']);
    setSpaceFilter(['all']);
    setShowFavoritesOnly(false);
    setShowHotkeysOnly(false);
    setShowShortcutsOnly(false);
  };

  const sidebarCategories = filterOptions.filter(o => o.type === 'category');

  return (
    <div
      id="sheet-ui-container"
      tabIndex={-1}
      className={clsx(
        "flex overflow-hidden relative flex-col text-white font-sans text-[13px] antialiased focus:outline-none",
        isEmbedded 
          ? "w-full flex-1 min-h-0"
          : "h-full w-full min-[1600px]:[zoom:1.2] min-[1800px]:[zoom:1.28] flex-1 min-h-0"
      )}
      style={!isEmbedded ? {
        backgroundColor: theme?.tokens?.sheetBg || 'var(--color-sheetBg)',
        opacity: 1,
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
      } : {}}>

      {/* Top Header Row */}
      <div className="w-full flex items-center justify-between px-6 pt-3 pb-2 shrink-0 z-[200] gap-4">
        {/* Left: Branding */}
        <div className="flex items-center shrink-0 w-[200px]">
          <Branding textColor="text-white font-bold tracking-wide" />
        </div>

        {/* Center: Search Bar */}
        <div className="flex-1 flex justify-center">
          <div className="w-full max-w-[420px]">
            <div
              id="sheet-search-wrapper"
              className={clsx(
                "w-full flex flex-start px-3 gap-2.5 rounded-lg border shadow-sm transition-all items-center",
                "min-h-[36px] min-[1680px]:min-h-[40px] min-[1880px]:min-h-[44px]",
                tutorialStep === 0
                  ? "border-[#22c55e]"
                  : "border-white/10 focus-within:border-white/20 focus-within:bg-[var(--color-popupBg)]",
                "bg-[var(--color-inputBg)] backdrop-blur-xl text-neutral-200"
              )}
            >
              <div className="flex items-center justify-center shrink-0">
                <FaSearch size={13} className="text-[var(--color-iconDefault)]" />
              </div>
              <input
                id="sheet-search-name"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search "
                className={clsx(
                  "flex-1 bg-transparent font-medium outline-none border-none",
                  "text-[14px] min-[1680px]:text-[15px] min-[1880px]:text-[16px]",
                  "text-neutral-200 placeholder:text-neutral-400"
                )}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className={clsx(
                    "p-1 rounded-md transition-colors",
                    "text-[var(--color-iconDefault)] hover:text-white hover:bg-white/10"
                  )}
                  title="Clear search"
                >
                  <FaTimes size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Toolbar & Close Button */}
        <div className="flex items-center justify-end shrink-0 w-[200px] gap-2">
          <SpreadsheetToolbar
            onCreateOrganization={onCreateOrganization}
            onOrganizationSettings={onOrganizationSettings}
            onCreateWorkspace={onCreateWorkspace}
            onOpenTutorial={handleOpenTutorial}
            tutorialStep={tutorialStep}
            setTutorialStep={setTutorialStep}
            isLoggedIn={isLoggedIn}
            onRequireLogin={onRequireLogin}
            onBoardViewRedirect={onBoardViewRedirect}
            isEmbedded={isEmbedded}
          />
          {onClose && !isEmbedded && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-white/10 text-neutral-500 hover:text-white transition-colors focus:outline-none flex items-center justify-center"
              aria-label="Close"
              title="Close">
              <FiX size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Combined Card Wrapper to allow overflow of the toggle button */}
      <div 
        className="flex-1 w-full flex flex-col relative z-0 min-h-0 transition-all duration-300"
      >
        <div className="w-full h-full overflow-hidden flex flex-row border-t border-white/10 min-h-0 relative">
        

        
        {/* LEFT SIDEBAR (Inside Card) */}
        <div className="w-[175px] shrink-0 flex flex-col relative overflow-visible bg-transparent group/sidebar">
          {/* Categories List Scrollable */}
          <div className="flex-1 overflow-y-auto hover-scrollbar px-3 py-4 flex flex-col justify-center gap-0.5">
            {sidebarCategories.map(opt => {
              const active = isSelected(opt);
              return (
                <button
                  key={`${opt.type}-${opt.id}`}
                  onClick={() => {
                    // Sidebar category acts as a single-selection filter
                    setCategoryFilter([opt.id!]);
                  }}
                  className={clsx(
                    "flex items-center gap-2.5 px-2.5 py-2 text-[11px] font-medium rounded-lg transition-all cursor-pointer text-left w-full group border",
                    active
                      ? "bg-white/[0.12] text-white border-white/10 shadow-sm"
                      : "text-neutral-300/80 border-transparent hover:bg-white/[0.06] hover:border-white/5 hover:text-white"
                  )}
                >
                  <span className={clsx("w-4 flex justify-center shrink-0 text-[14px] transition-colors", active ? "text-white" : "text-neutral-400 group-hover:text-neutral-200")}>
                    {opt.icon}
                  </span>
                  <span className={clsx("flex-1 truncate leading-tight tracking-[0.01em]", active ? "text-white" : "text-neutral-300 group-hover:text-white")}>
                    {opt.label}
                  </span>
                  {omniboxPrefixes && (opt.id === 'note' || opt.id === 'snippet' || opt.id === 'todo' || opt.id === 'link' || opt.id === 'session' || opt.id === 'general_commands' || opt.id === 'commands' || opt.id === 'automation' || opt.id === 'agent') && (
                    <span className="ml-2 hidden items-center gap-1 group-hover/sidebar:flex focus-within:flex">
                      <EditablePrefixKey 
                        category={
                          opt.id === 'note' ? 'note' :
                          opt.id === 'snippet' ? 'snippet' :
                          opt.id === 'todo' ? 'todo' :
                          opt.id === 'link' ? 'link' :
                          opt.id === 'session' ? 'session' :
                          opt.id === 'automation' ? 'automation' :
                          opt.id === 'agent' ? 'agent' :
                          opt.id === 'commands' ? 'command' :
                          opt.id === 'general_commands' ? 'system_command' : 'link'
                        }
                        currentValue={
                          opt.id === 'note' ? (omniboxPrefixes.note || '') :
                          opt.id === 'snippet' ? (omniboxPrefixes.snippet || '') :
                          opt.id === 'todo' ? (omniboxPrefixes.todo || 't') :
                          opt.id === 'link' ? (omniboxPrefixes.link || '') :
                          opt.id === 'session' ? (omniboxPrefixes.session || '') :
                          opt.id === 'automation' ? (omniboxPrefixes.automation || '') :
                          opt.id === 'agent' ? (omniboxPrefixes.agent || '') :
                          opt.id === 'commands' ? (omniboxPrefixes.command || '') :
                          opt.id === 'general_commands' ? (omniboxPrefixes.system_command || '') : ''
                        }
                      />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="pt-2 mt-auto flex items-center gap-2 px-3 pb-3 select-none shrink-0">
             <button
                onClick={(e) => {
                   e.stopPropagation();
                   useUIStore.getState().closeEditor();
                   useUIStore.getState().closeSheet();
                   if (onBoardViewRedirect) onBoardViewRedirect();
                   const chromeAny = (window as any)?.chrome;
                   if (chromeAny?.storage?.local) {
                     chromeAny.storage.local.set({ new_tab_is_board_view_enabled: true });
                   }
                }}
                className="w-[24px] h-[24px] rounded-lg flex items-center justify-center cursor-pointer transition-all hover:scale-105 active:scale-95 bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white focus:outline-none"
                title="Board (Kanban)"
             >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="2" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="2" fill="none" />
                  <line x1="9" y1="2" x2="9" y2="22" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="15" y1="2" x2="15" y2="22" stroke="currentColor" strokeWidth="1.5" />
                  <rect x="4" y="5" width="3" height="4" rx="0.5" fill="currentColor" />
                  <rect x="4" y="11" width="3" height="6" rx="0.5" fill="currentColor" />
                  <rect x="10" y="5" width="3" height="7" rx="0.5" fill="currentColor" />
                  <rect x="10" y="14" width="3" height="5" rx="0.5" fill="currentColor" />
                  <rect x="17" y="5" width="3" height="5" rx="0.5" fill="currentColor" />
                  <rect x="17" y="12" width="3" height="4" rx="0.5" fill="currentColor" />
                </svg>
             </button>
          </div>
        </div>

        {/* SPREADSHEET TABLE AREA */}
        <div className="flex-1 overflow-auto custom-scrollbar dark-scrollbar relative">
          <SpreadsheetTable
            onClose={onClose}
            tutorialStep={tutorialStep}
            setTutorialStep={setTutorialStep}
            isEmbedded={isEmbedded}
          />
        </div>
        </div>

        {/* Floating Collapse / Expand Edge Button - HIDDEN AS REQUESTED */}
        {false && (
          <button
            onClick={toggleCompactMode}
            className="absolute left-full top-1/2 -translate-y-1/2 -translate-x-1/2 z-[300] w-8 h-8 flex items-center justify-center rounded-full border border-[var(--color-borderDefault)] bg-[var(--color-sheetBg)] text-[var(--color-iconDefault)] hover:text-[var(--color-textMain)] hover:bg-white/10 transition-all shadow-lg cursor-pointer focus:outline-none"
            style={{
              backdropFilter: 'blur(24px) saturate(1.2)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
            }}
            title={isCompactMode ? "Expand" : "Collapse"}>
            {isCompactMode ? <FiChevronRight size={18} /> : <FiChevronLeft size={18} />}
          </button>
        )}
      </div>

      <SpreadsheetQuickAddModal />

    </div>
  );
};

export default SpreadsheetMainContainer;
