import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useAppearance } from '@extension/ui';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { FiZap, FiCommand, FiFolder, FiBriefcase, FiArrowLeft, FiChevronUp, FiChevronDown } from 'react-icons/fi';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { useSpreadsheetStore } from '../../../../../shared-components/spreadsheetUi/logic/spreadsheetStateStore';
import { FaCaretDown, FaCaretRight, FaCode, FaLink } from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import { BsCalendarCheck } from 'react-icons/bs';
import NotesIcon from '../../../../../shared-components/icons/notesIcon';
import { SessionGridIcon } from '../../../../../shared-components/icons/sessionGridIcon';

import {
  getSidebarStorageData,
  setSidebarStorageData,
} from '../../../../../storage/localStorage/sidebarCustomizationStorage';
import {
  getMyLibrarySectionCollapsed,
  MY_LIBRARY_SECTION_COLLAPSED_STORAGE_KEY,
  setMyLibrarySectionCollapsed,
} from '../../../../../storage/localStorage/myLibrarySectionCollapseStorage';

interface ViewMenuPanelProps {
  searchbarRef?: React.RefObject<any>;
  openSpreadsheetView?: (section?: string) => void;
}

export const ViewMenuPanel: React.FC<ViewMenuPanelProps> = ({ searchbarRef, openSpreadsheetView }) => {
  const { theme } = useAppearance();
  const isDark = theme.isDark;

  const [expandedCategory, setExpandedCategory] = useState<'folders' | 'organizations' | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isMyLibraryExpanded, setIsMyLibraryExpanded] = useState<boolean>(true);
  const workspaces = useDbStore(state => state.workspaces) || [];
  const folders = useDbStore(state => state.folders) || [];

  const [visibleViewItems, setVisibleViewItems] = useState<Record<string, boolean>>({
    all: true,
    notes: true,
    snippets: true,
    links: true,
    chat_agents: true,
    todos: true,
    automations: true,
    sessions: true,
    folders: true,
    organizations: true,
    all_shortcuts: true,
  });

  const [customGroupNames, setCustomGroupNames] = useState<Record<string, string>>({});

  const [viewItemsOrder, setViewItemsOrder] = useState<string[]>([
    'all',
    'sessions',
    'notes',
    'todos',
    'links',
    'chat_agents',
    'snippets',
    'automations',
    'folders',
    'organizations',
    'all_shortcuts',
  ]);

  // Load preferences from local storage and listen to changes
  useEffect(() => {
    const loadPreferences = async () => {
      const isMyLibraryCollapsed = await getMyLibrarySectionCollapsed();
      setIsMyLibraryExpanded(!isMyLibraryCollapsed);

      const result = await getSidebarStorageData([
        'sidebar_view_visible_items',
        'sidebar_view_items_order',
        'customGroupNames',
        'viewGroupsOrder',
      ]);

      if (result.customGroupNames) {
        setCustomGroupNames(result.customGroupNames);
      }
      const hasFolders = result.sidebar_view_items_order?.includes('folders');
      const hasAllShortcuts = result.sidebar_view_items_order?.includes('all_shortcuts');
      const isOldDefault = result.sidebar_view_items_order?.[1] === 'notes';

      if (
        !result.sidebar_view_items_order ||
        result.sidebar_view_items_order.length < 9 ||
        !hasAllShortcuts ||
        isOldDefault ||
        !hasFolders
      ) {
        const newOrder = [
          'all',
          'sessions',
          'notes',
          'todos',
          'links',
          'chat_agents',
          'snippets',
          'automations',
          'folders',
          'organizations',
          'all_shortcuts',
        ];
        setViewItemsOrder(newOrder);
        setSidebarStorageData({ sidebar_view_items_order: newOrder });

        const newVisible = {
          ...result.sidebar_view_visible_items,
          sessions: result.sidebar_view_visible_items?.sessions ?? true,
          chat_agents: result.sidebar_view_visible_items?.chat_agents ?? true,
          folders: true,
          organizations: true,
          all_shortcuts: true,
        };
        setVisibleViewItems(newVisible);
        setSidebarStorageData({ sidebar_view_visible_items: newVisible });
      } else {
        if (result.sidebar_view_visible_items) {
          setVisibleViewItems(result.sidebar_view_visible_items);
        }
        if (result.sidebar_view_items_order) {
          setViewItemsOrder(result.sidebar_view_items_order);
        }
      }
    };

    loadPreferences();

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.sidebar_view_visible_items) {
        setVisibleViewItems(changes.sidebar_view_visible_items.newValue);
      }
      if (changes.sidebar_view_items_order) {
        setViewItemsOrder(changes.sidebar_view_items_order.newValue);
      }
      if (changes.customGroupNames) {
        setCustomGroupNames(changes.customGroupNames.newValue);
      }
      if (changes[MY_LIBRARY_SECTION_COLLAPSED_STORAGE_KEY]) {
        setIsMyLibraryExpanded(changes[MY_LIBRARY_SECTION_COLLAPSED_STORAGE_KEY].newValue !== true);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const [isViewExpanded, setIsViewExpanded] = useState<boolean>(false);

  const rawOptions = useMemo(
    () => [
      {
        id: 'all',
        label: 'All',
        slash: '/a ',
        icon: (
          <svg
            className="w-3.5 h-3.5 shrink-0 text-[var(--color-iconDefault)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
          </svg>
        ),
      },
      {
        id: 'sessions',
        label: 'Tab Sessions',
        slash: '/se ',
        icon: <SessionGridIcon size={14} className="text-[var(--color-iconDefault)] shrink-0" />,
      },
      {
        id: 'notes',
        label: 'Notes',
        slash: '/n ',
        icon: <NotesIcon size={14} className="shrink-0 text-[var(--color-iconDefault)]" />,
      },
      {
        id: 'todos',
        label: 'Todos',
        slash: '/t ',
        icon: <BsCalendarCheck size={14} className="text-[var(--color-iconDefault)] shrink-0" />,
      },
      {
        id: 'links',
        label: 'Links',
        slash: '/l ',
        icon: <FaLink size={14} className="text-[var(--color-iconDefault)] shrink-0" />,
      },
      {
        id: 'chat_agents',
        label: 'Chat Agents',
        slash: '/ca ',
        icon: <LuSparkles size={14} className="text-[var(--color-iconDefault)] shrink-0" />,
      },
      {
        id: 'snippets',
        label: 'Text Expanders',
        slash: '/s ',
        icon: <FaCode size={14} className="text-[var(--color-iconDefault)] shrink-0" />,
      },

      {
        id: 'folders',
        label: 'Folders',
        slash: '/f ',
        icon: <FiFolder size={14} className="text-[var(--color-iconDefault)] shrink-0" />,
      },
      {
        id: 'organizations',
        label: 'Organizations',
        slash: '/org ',
        icon: <FiBriefcase size={14} className="text-[var(--color-iconDefault)] shrink-0" />,
      },
      {
        id: 'all_shortcuts',
        label: 'All Shortcuts',
        slash: '',
        icon: <FiCommand size={14} className="text-[var(--color-iconDefault)] shrink-0" />,
      },
    ],
    [],
  );

  const mainItems = useMemo(() => {
    return viewItemsOrder
      .filter(id => visibleViewItems[id])
      .map(id => rawOptions.find(o => o.id === id))
      .filter(Boolean) as any[];
  }, [viewItemsOrder, visibleViewItems, rawOptions]);

  const collapsedItems = useMemo(() => {
    return viewItemsOrder
      .filter(id => !visibleViewItems[id])
      .map(id => rawOptions.find(o => o.id === id))
      .filter(Boolean) as any[];
  }, [viewItemsOrder, visibleViewItems, rawOptions]);

  const handleToggleMyLibraryExpanded = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsMyLibraryExpanded(prev => {
      const next = !prev;
      setMyLibrarySectionCollapsed(!next);
      return next;
    });
  };

  const handleViewClick = (slash: string, optionId?: string) => {
    if (optionId === 'folders') {
      setExpandedCategory(prev => (prev === 'folders' ? null : 'folders'));
      return;
    }
    if (optionId === 'organizations') {
      setExpandedCategory(prev => (prev === 'organizations' ? null : 'organizations'));
      return;
    }

    setExpandedCategory(null);

    if (optionId === 'all_shortcuts') {
      openSpreadsheetView?.('collections');
      return;
    }

    useUIStore.getState().closeEditor();
    useUIStore.getState().closeSheet();

    // Clear workspace and folder filter so clicking "All" or other views resets to global search results
    useUIStore.getState().setSelectedWorkspaceId(null);
    useUIStore.getState().setSelectedFolderId(null);

    // Redirect to board view (same pattern as onShortcutBoardView in AppMainContent)
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.storage?.local) {
      chromeAny.storage.local.set({ new_tab_is_board_view_enabled: true });
    }

    if (searchbarRef?.current) {
      searchbarRef.current.setValue(slash);
      setTimeout(() => {
        searchbarRef.current?.focus();
      }, 50);
    }
  };

  const renderFolderItem = (folder: any) => (
    <div
      key={folder.id}
      className="flex items-center cursor-pointer group py-[4px] pr-[8px] pl-[34px] gap-2.5 rounded-md hover:bg-[var(--color-hoverBg)] active:bg-[var(--color-selectedBg)] transition-colors duration-150"
      onClick={e => {
        e.stopPropagation();
        if (openSpreadsheetView) {
          openSpreadsheetView();
        } else {
          useUIStore.getState().openSheet();
        }
        setTimeout(() => {
          useSpreadsheetStore.getState().setSearchTerm(folder.folderName || '');
        }, 100);
      }}>
      <div className="w-4 h-4 flex items-center justify-center shrink-0">
        <FiFolder size={14} className="text-[var(--color-iconDefault)] group-hover:text-[var(--color-textPrimary)] transition-colors shrink-0" />
      </div>
      <span className="text-[12px] font-semibold tracking-tight text-[var(--color-textSecondary)] group-hover:text-[var(--color-textPrimary)] transition-colors truncate">
        {folder.folderName || 'Untitled'}
      </span>
    </div>
  );

  const renderWorkspaceItem = (ws: any) => (
    <div
      key={ws.id}
      className="flex items-center cursor-pointer group py-[4px] pr-[8px] pl-[34px] gap-2.5 rounded-md hover:bg-[var(--color-hoverBg)] active:bg-[var(--color-selectedBg)] transition-colors duration-150"
      onClick={e => {
        e.stopPropagation();
        useUIStore.getState().setView({
          type: 'settings',
          section: 'allWorkspaces',
        });
      }}>
      <div className="w-4 h-4 flex items-center justify-center shrink-0">
        <FiBriefcase size={14} className="text-[var(--color-iconDefault)] group-hover:text-[var(--color-textPrimary)] transition-colors shrink-0" />
      </div>
      <span className="text-[12px] font-semibold tracking-tight text-[var(--color-textSecondary)] group-hover:text-[var(--color-textPrimary)] transition-colors truncate">
        {ws.workspaceName || 'Untitled'}
      </span>
    </div>
  );

  const renderViewOptionItem = (opt: any, isIndented: boolean = false) => {
    const paddingClass = isIndented ? 'pl-[28px]' : 'pl-[12px]';
    return (
      <React.Fragment key={opt.id}>
        <div
          className={`flex items-center cursor-pointer group py-[4px] pr-[8px] ${paddingClass} gap-2.5 rounded-md hover:bg-[var(--color-hoverBg)] active:bg-[var(--color-selectedBg)] transition-colors duration-150`}
          onClick={e => {
            e.stopPropagation();
            handleViewClick(opt.slash, opt.id);
          }}>
          <div className="w-4 h-4 flex items-center justify-center shrink-0">{opt.icon}</div>
          <span className="text-[12px] font-semibold tracking-tight transition-colors duration-150 text-[var(--color-textSecondary)] group-hover:text-[var(--color-textPrimary)]">
            {opt.label}
          </span>
        </div>

        {opt.id === 'folders' && expandedCategory === 'folders' && (
          <div className="flex flex-col mt-0.5 mb-1 max-h-[300px] overflow-y-auto">
            {folders.length > 0 ? (
              folders.map(renderFolderItem)
            ) : (
              <div className="pl-[34px] py-1 text-[11px] text-neutral-400">No folders found</div>
            )}
          </div>
        )}

        {opt.id === 'organizations' && expandedCategory === 'organizations' && (
          <div className="flex flex-col mt-0.5 mb-1 max-h-[300px] overflow-y-auto">
            {workspaces.length > 0 ? (
              workspaces.map(renderWorkspaceItem)
            ) : (
              <div className="pl-[34px] py-1 text-[11px] text-neutral-400">No organizations found</div>
            )}
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="flex flex-col select-none">
      {/* Header */}
      <div className="px-3 pt-1 pb-1">
        <button
          type="button"
          aria-label={isMyLibraryExpanded ? 'Collapse My Library' : 'Expand My Library'}
          aria-expanded={isMyLibraryExpanded}
          onClick={handleToggleMyLibraryExpanded}
          className="w-full flex items-center gap-1.5 px-1 py-1 rounded-lg hover:bg-[var(--color-hoverBg)] transition-colors text-left">
          <span className="text-[11px] font-bold tracking-wider capitalize text-[var(--color-textMuted)]">
            My Library
          </span>
          <span className="w-4 h-4 flex items-center justify-center text-[var(--color-textMuted)]">
            {isMyLibraryExpanded ? <FaCaretDown size={12} /> : <FaCaretRight size={12} />}
          </span>
        </button>
      </div>

      {/* Items list */}
      {isMyLibraryExpanded && (
        <div className="flex flex-col px-3 pt-1 pb-2 gap-0.5">
          {(() => {
            let hasSeenHeader = false;
            return viewItemsOrder.map((id, index) => {
              if (id.startsWith('header-')) {
                // A header is visible if any of its children are visible
                let isVisible = false;
                for (let i = index + 1; i < viewItemsOrder.length; i++) {
                  if (viewItemsOrder[i].startsWith('header-')) break;
                  if (visibleViewItems[viewItemsOrder[i]] || isExpanded) {
                    isVisible = true;
                    break;
                  }
                }

                if (isVisible) {
                  hasSeenHeader = true;
                  const groupId = id.replace('header-', '');
                  const title = customGroupNames[groupId] || groupId;
                  return (
                    <div key={id} className="flex items-center gap-2 mt-2 mb-1 px-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      <span className="text-[11px] font-bold tracking-wider capitalize text-[var(--color-textMuted)]">
                        {title}
                      </span>
                    </div>
                  );
                }
                return null;
              } else {
                const isBeforeFirstHeader = !viewItemsOrder.slice(0, index).some(x => x.startsWith('header-'));
                const isVisible = isBeforeFirstHeader ? true : visibleViewItems[id];
                if (!isVisible && !isExpanded) return null;
                const opt = rawOptions.find(o => o.id === id);
                if (!opt) return null;
                return renderViewOptionItem(opt, hasSeenHeader);
              }
            });
          })()}

          {viewItemsOrder.some((id, index) => {
            if (id.startsWith('header-')) return false;
            const isBeforeFirstHeader = !viewItemsOrder.slice(0, index).some(x => x.startsWith('header-'));
            const isVisible = isBeforeFirstHeader ? true : visibleViewItems[id];
            return !isVisible;
          }) && (
            <div className="flex justify-center mt-1">
              <button
                onClick={e => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className={`p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${isDark ? 'text-neutral-500 hover:text-neutral-300' : 'text-neutral-400 hover:text-neutral-600'}`}>
                {isExpanded ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ViewMenuPanel;
