import * as React from 'react';
import { useEffect, useMemo, useState, useRef, useLayoutEffect, useCallback } from 'react';
import { useAppearance } from '@extension/ui';
import { FaSearch,
  FaTimes,
  FaFilter,
  FaCode,
  FaLink,
  FaBookmark,
  FaTerminal,
  FaGlobe,
  FaLock,
  FaUsers,
  FaCheck,
  FaRegStar } from 'react-icons/fa';
import { FiFilter, FiSettings, FiZap, FiChevronDown, FiX, FiHelpCircle } from 'react-icons/fi';
import { BsStarFill, BsCalendarCheck } from 'react-icons/bs';
import { MdOutlineShortcut } from 'react-icons/md';
import { LuSparkles } from 'react-icons/lu';
import { CustomSearchPrefixesForOmniboxStorage, CustomOmniboxPrefixes } from '../../../storage/localStorage/customSearchPrefixesForOmniboxStorage';
import NotesIcon from '../../../shared-components/icons/notesIcon';
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
  const { isPickerOpen, pickerRowIndex, closePicker, updateRowLocation, openPicker, searchTerm, setSearchTerm, setSelectedCell } = useSpreadsheetStore();
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

  const notes = useDbStore(state => state.notes);
  const links = useDbStore(state => state.links);
  const snippets = useDbStore(state => state.snippets);
  const workspaces = useDbStore(state => state.workspaces);
  const folders = useDbStore(state => state.folders);
  const favorites = useDbStore(state => state.favorites);
  const hotkeysMap = useDbStore(state => state.hotkeysMap);
  const shortcutsMap = useDbStore(state => state.shortcutsMap);

  // Initial Load of Favorites, Hotkeys and Shortcuts
  useEffect(() => {
    const flattenBookmarks = (nodes: any, result: any[] = []) => {
      if (!nodes) return result;
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

    const handleOutsideClick = (e: MouseEvent) => {
      if (useUIStore.getState().activeEditor) {
        return;
      }

      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[data-ignore-grid-nav="true"]')) {
        return;
      }

      const container = document.getElementById('sheet-ui-container');
      if (container && !container.contains(e.target as Node)) {
        const store = useSpreadsheetStore.getState();
        store.setSelectedCell(null);
        store.setEditingCell(null);

        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
    };
    window.addEventListener('mousedown', handleOutsideClick, true);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick, true);
    };
  }, []);

  // Sync Logic
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

  const handleOpenTutorial = async () => {
    window.dispatchEvent(new CustomEvent('openTutorial'));
  };

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
        <svg className="w-4 h-4 shrink-0 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      )},
      { type: 'category' as const, id: 'note', label: 'Notes', icon: <NotesIcon className="w-4 h-4 shrink-0 text-white" /> },
      { type: 'category' as const, id: 'snippet', label: 'Text Expanders', icon: <FaCode className="w-4 h-4 shrink-0 text-white" /> },
      { type: 'category' as const, id: 'todo', label: 'Todos', icon: <BsCalendarCheck className="w-4 h-4 shrink-0 text-white" /> },
      { type: 'category' as const, id: 'link', label: 'Links', icon: <FaLink className="w-4 h-4 shrink-0 text-white" /> },
      { type: 'category' as const, id: 'session', label: 'Collections', icon: <SessionGridIcon className="w-4 h-4 shrink-0 text-white" /> },
      { type: 'category' as const, id: 'general_commands', label: 'System Commands', icon: <FaTerminal className="w-4 h-4 shrink-0 text-white" /> },
      { type: 'category' as const, id: 'commands', label: 'Browser Commands', icon: <FaTerminal className="w-4 h-4 shrink-0 text-white" /> },
      {
        type: 'category' as const,
        id: 'automation',
        label: 'Automations',
        icon: <FiZap className="w-4 h-4 shrink-0 text-white" />,
      },
      {
        type: 'category' as const,
        id: 'agent',
        label: 'Chat Agents',
        icon: <LuSparkles className="w-4 h-4 shrink-0 text-white" />,
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
        icon: <BsCalendarCheck className="text-[11px]" />,
      },
      {
        type: 'feature' as const,
        id: 'shortcuts',
        label: 'Shortcuts',
        icon: <MdOutlineShortcut className="text-[11px]" />,
      },
    ];

    if (isEmbedded) {
      return allOptions.filter(opt => {
        if (opt.type === 'category' && (opt.id === 'commands' || opt.id === 'general_commands')) {
          return false;
        }
        return true;
      });
    }

    return allOptions;
  }, [isEmbedded]);

  const sidebarCategories = useMemo(() => filterOptions.filter(o => o.type === 'category'), [filterOptions]);

  const isSelected = useCallback((opt: any) => {
    if (opt.type === 'space') return spaceFilter.includes(opt.id!);
    if (opt.type === 'category') return categoryFilter.includes(opt.id!);
    if (opt.type === 'visibility') return visibilityFilter.includes(opt.id!);
    if (opt.type === 'feature') {
      if (opt.id === 'favorites') return showFavoritesOnly;
      if (opt.id === 'hotkeys') return showHotkeysOnly;
      if (opt.id === 'shortcuts') return showShortcutsOnly;
    }
    return false;
  }, [categoryFilter, spaceFilter, visibilityFilter, showFavoritesOnly, showHotkeysOnly, showShortcutsOnly]);

  // Responsive Overflow Calculation for Horizontal Category Navigation
  const categoryNavRef = useRef<HTMLDivElement>(null);
  const measuringRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState<number>(sidebarCategories.length);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const calculateOverflow = useCallback(() => {
    if (!categoryNavRef.current || !measuringRef.current) return;

    const availableWidth = categoryNavRef.current.clientWidth;
    const itemNodes = Array.from(measuringRef.current.children) as HTMLElement[];
    if (itemNodes.length === 0) return;

    const MORE_BTN_ESTIMATED_WIDTH = 85;
    const widths = itemNodes.map(node => node.offsetWidth + 8); // 8px gap

    const totalWidth = widths.reduce((acc, w) => acc + w, 0);

    if (totalWidth <= availableWidth) {
      setVisibleCount(sidebarCategories.length);
    } else {
      let currentWidth = 0;
      let count = 0;
      for (let i = 0; i < widths.length; i++) {
        if (currentWidth + widths[i] + MORE_BTN_ESTIMATED_WIDTH <= availableWidth) {
          currentWidth += widths[i];
          count++;
        } else {
          break;
        }
      }
      setVisibleCount(Math.max(1, count));
    }
  }, [sidebarCategories.length]);

  useLayoutEffect(() => {
    calculateOverflow();
  }, [calculateOverflow, sidebarCategories]);

  useEffect(() => {
    const navEl = categoryNavRef.current;
    if (!navEl) return;
    const observer = new ResizeObserver(() => {
      calculateOverflow();
    });
    observer.observe(navEl);
    return () => {
      observer.disconnect();
    };
  }, [calculateOverflow]);

  // Escape Key & Click-Outside Handlers for More Dropdown
  useEffect(() => {
    if (!isMoreOpen) return;

    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      setIsMoreOpen(false);
      return true;
    });

    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setIsMoreOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      unregister();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMoreOpen]);

  // Auto-focus search input and select Title cell of 1st item on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      const searchInput = document.getElementById('sheet-search-name') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }, 50);

    // Select Title cell (colIndex 2) of 1st row (rowIndex 0)
    useSpreadsheetStore.getState().setSelectedCell({ rowIndex: 0, colIndex: 2 });

    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      id="sheet-ui-container"
      tabIndex={-1}
      className={clsx(
        "flex overflow-hidden relative flex-col text-[var(--color-textPrimary)] font-sans text-[13px] antialiased focus:outline-none",
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

      {/* Row 1: Top Header Row */}
      <div className="w-full flex items-center justify-between px-6 pt-3 pb-2 shrink-0 z-[200] gap-4">
        {/* Left: Branding */}
        <div className="flex items-center shrink-0">
          <Branding textColor="text-[var(--color-textPrimary)] font-bold tracking-wide" />
        </div>

        {/* Right: Help & Close Button */}
        <div className="flex items-center justify-end shrink-0 gap-1.5">
          {!isEmbedded && (
            <button
              onClick={handleOpenTutorial}
              className="p-1.5 rounded-md transition-colors focus:outline-none flex items-center justify-center text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] cursor-pointer"
              aria-label="Help"
              title="Open Tutorial">
              <FiHelpCircle size={17} />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-[var(--color-hoverBg)] text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] transition-colors focus:outline-none flex items-center justify-center cursor-pointer"
              aria-label="Close"
              title="Close (Esc)">
              <FiX size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Horizontal Search, Category Navigation, and Filter */}
      <div className="w-full flex items-center px-6 py-2 shrink-0 z-[150] gap-3 border-b border-[var(--color-borderDefault)] relative overflow-visible">
        {/* Search Field */}
        <div className="shrink-0 w-[240px] min-[1680px]:w-[280px]">
          <div
            id="sheet-search-wrapper"
            className={clsx(
              "w-full flex flex-start px-3 gap-2.5 rounded-lg border shadow-sm transition-all items-center",
              "min-h-[34px] min-[1680px]:min-h-[38px]",
              tutorialStep === 0
                ? "border-[#22c55e]"
                : "border-[var(--color-borderDefault)] focus-within:border-[var(--color-borderActive)] focus-within:bg-[var(--color-popupBg)]",
              "bg-[var(--color-inputBg)] backdrop-blur-xl text-[var(--color-textPrimary)]"
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
                "text-[13px] min-[1680px]:text-[14px]",
                "text-[var(--color-textPrimary)] placeholder-[var(--color-textPlaceholder)]"
              )}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className={clsx(
                  "p-1 rounded-md transition-colors",
                  "text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)]"
                )}
                title="Clear search"
              >
                <FaTimes size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Category Navigation Wrapper: Inner overflow-hidden container for category buttons, unclipped for More button */}
        <div ref={categoryNavRef} className="flex-1 flex items-center gap-2 min-w-0 relative overflow-visible">
          {/* Visible Category Buttons (clipped inside inner container) */}
          <div className="flex items-center gap-2 overflow-hidden min-w-0">
            {sidebarCategories.slice(0, visibleCount).map(opt => {
              const active = isSelected(opt);
              return (
                <button
                  key={`${opt.type}-${opt.id}`}
                  onClick={() => {
                    setCategoryFilter([opt.id!]);
                  }}
                  className={clsx(
                    "flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium rounded-lg transition-all cursor-pointer border whitespace-nowrap shrink-0",
                    active
                      ? "bg-transparent text-[var(--color-textPrimary)] border-[var(--color-borderActive)]"
                      : "bg-transparent text-[var(--color-textSecondary)] border-[var(--color-borderDefault)] hover:text-[var(--color-textPrimary)] hover:border-[var(--color-borderActive)]"
                  )}
                >
                  <span className={clsx("flex justify-center shrink-0 text-[13px]", active ? "text-[var(--color-textPrimary)] [&_svg]:text-[var(--color-textPrimary)]" : "text-[var(--color-iconDefault)] [&_svg]:text-[var(--color-iconDefault)]")}>
                    {opt.icon}
                  </span>
                  <span className="leading-none">{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* More Overflow Button: Unclipped overflow-visible container positioned directly inline beside category buttons */}
          {visibleCount < sidebarCategories.length && (
            <div ref={moreRef} className="relative shrink-0 overflow-visible z-[600]">
              <button
                onClick={() => setIsMoreOpen(!isMoreOpen)}
                className={clsx(
                  "flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg transition-all cursor-pointer border whitespace-nowrap",
                  isMoreOpen || sidebarCategories.slice(visibleCount).some(opt => isSelected(opt))
                    ? "bg-transparent text-[var(--color-textPrimary)] border-[var(--color-borderActive)]"
                    : "bg-transparent text-[var(--color-textSecondary)] border-[var(--color-borderDefault)] hover:text-[var(--color-textPrimary)] hover:border-[var(--color-borderActive)]"
                )}
              >
                <span>More</span>
                <FiChevronDown size={14} className={clsx("transition-transform duration-150", isMoreOpen && "rotate-180")} />
              </button>

              {/* More Dropdown Menu */}
              {isMoreOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-[220px] py-1.5 px-1 rounded-lg border shadow-2xl z-[9999] bg-[var(--color-popupBg)] border-[var(--color-borderDefault)] flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-1 duration-100">
                  {sidebarCategories.slice(visibleCount).map(opt => {
                    const active = isSelected(opt);
                    return (
                      <button
                        key={`more-${opt.type}-${opt.id}`}
                        onClick={() => {
                          setCategoryFilter([opt.id!]);
                          setIsMoreOpen(false);
                        }}
                        className={clsx(
                          "flex items-center gap-2.5 px-2.5 py-2 text-[12px] font-medium rounded-md border transition-all cursor-pointer text-left w-full",
                          active
                            ? "bg-[var(--color-popupBg)] text-[var(--color-textPrimary)] border-[var(--color-borderActive)]"
                            : "bg-[var(--color-popupBg)] text-[var(--color-textSecondary)] border-transparent hover:text-[var(--color-textPrimary)] hover:border-[var(--color-borderDefault)]"
                        )}
                      >
                        <span className={clsx("w-4 flex justify-center shrink-0 text-[13px]", active ? "text-[var(--color-textPrimary)] [&_svg]:text-[var(--color-textPrimary)]" : "text-[var(--color-iconDefault)] [&_svg]:text-[var(--color-iconDefault)]")}>
                          {opt.icon}
                        </span>
                        <span className="flex-1 whitespace-nowrap">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Far Right: Filter Toolbar Button */}
        <div className="shrink-0">
          <SpreadsheetToolbar
            hideHelp={true}
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
        </div>

        {/* Off-screen Measuring Container */}
        <div
          ref={measuringRef}
          aria-hidden="true"
          className="absolute top-[-9999px] left-[-9999px] visibility-hidden flex gap-2 pointer-events-none"
        >
          {sidebarCategories.map(opt => (
            <div
              key={`measure-${opt.type}-${opt.id}`}
              className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium border whitespace-nowrap"
            >
              <span>icon</span>
              <span>{opt.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Row 3: Spreadsheet Table Area (Full Width) */}
      <div className="flex-1 w-full flex flex-col relative z-0 min-h-0 overflow-hidden">
        <div className="w-full h-full overflow-hidden flex flex-row min-h-0 relative">
          <div className="flex-1 overflow-auto custom-scrollbar dark-scrollbar relative">
            <SpreadsheetTable
              onClose={onClose}
              tutorialStep={tutorialStep}
              setTutorialStep={setTutorialStep}
              isEmbedded={isEmbedded}
            />
          </div>
        </div>

      </div>

      <SpreadsheetQuickAddModal />

    </div>
  );
};

export default SpreadsheetMainContainer;
