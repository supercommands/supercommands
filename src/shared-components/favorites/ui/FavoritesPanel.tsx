import { useUIStore } from '../../uiStateManager';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useState, useRef, memo } from 'react';

import { useAppearance } from '@extension/ui';

import { Reorder, motion, useDragControls } from 'framer-motion';
import { StorageManager } from '../../../storage/localStorage/storageManager';
import { updateSnippet } from '../../../allObjectFolder/src/createObject/snippets/snippetData';
import { updateLink } from '../../../allObjectFolder/src/createObject/links/linkData';
import FavoriteItem from './FavoriteItem';
import { CreateMenuPanel } from '../../../pages/AltS_search_newtab/src/components/altsNewtabSidebar/createMenuPanel';
import { SidebarDashboardViewsSection } from '../../../pages/AltS_search_newtab/src/components/altsNewtabSidebar/sidebarDashboardViewsSection';
import { SidebarSettingsDropdown } from '../../../pages/AltS_search_newtab/src/components/altsNewtabSidebar/sidebarSettingsDropdown';
import { EditorItemsPanel } from '../../../pages/AltS_search_newtab/src/landingPage/AppSidebar/EditorItemsPanel';

import { getFaviconUrl, stripCmdStatus } from '../../../shared-components/searchBarMain/utilityFunctions/utils';
import type { FolderData } from '../../../settings/allWorkspaceManager/folders/folderTypes';
import type { SnippetRecord } from '../../../allObjectFolder/src/createObject/snippets/snippetTypes';
import { HiOutlineStar, HiArrowsUpDown } from 'react-icons/hi2';
import { FaCheck, FaTimes } from 'react-icons/fa';
import {
  FiEdit2,
  FiTrash2,
  FiPlus,
  FiLink,
  FiFileText,
  FiCode,
  FiZap,
  FiChevronDown,
  FiChevronUp,
  FiChevronRight,
  FiCheckSquare,
} from 'react-icons/fi';
import { LuSparkles } from 'react-icons/lu';
import { readAllHotkeys, readAllShortcuts, getItemCompoundId } from '../../hotkeys/utils/hotkeyUtils';
import { useFavorites, useUser } from '../favoriteHooks';
import { useDbStore } from '../../../storage/store/useDbStore';
import { resolveEntityById } from '../../utils/entityResolver';

type Snippet = SnippetRecord & {
  key?: string;
  value?: string | { urls: string[]; names: string[] } | any;
  snippet_id?: string;
  id?: string;
  category?: string;
  type?: string;
  label?: string;
};

type Folder = FolderData;

const chromeAny = chrome as any;

const extractUrlNamePair = (snippet: Snippet): { url: string; name: string }[] => {
  if (!snippet?.value) return [];

  let urls: string[] = [];
  let names: string[] = [];

  if (typeof snippet.value === 'string') {
    const raw = snippet.value.trim();
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.urls)) {
          urls = parsed.urls;
        }
        if (Array.isArray(parsed.names)) {
          names = parsed.names;
        }
      }
    } catch {
      if (raw.startsWith('http') || raw.startsWith('note:') || raw.startsWith('agent_chat')) {
        urls = [raw];
      }
    }
    if (urls.length === 0 && (raw.startsWith('http') || raw.startsWith('note:') || raw.startsWith('agent_chat'))) {
      urls = [raw];
    }
  } else if (typeof snippet.value === 'object' && snippet.value) {
    if ('urls' in snippet.value && Array.isArray((snippet.value as any).urls)) {
      urls = (snippet.value as any).urls;
    }
    if ('names' in snippet.value && Array.isArray((snippet.value as any).names)) {
      names = (snippet.value as any).names;
    }
  }

  return urls.map((url, idx) => {
    let name = names[idx] || '';
    let targetUrl = url;

    // Convert note: URLs to correct full URLs
    if (url && url.startsWith('note:')) {
      const sid = url.replace('note:', '');
      targetUrl = chrome.runtime.getURL(`AltS_search_newtab/index.html?open_note=true&noteid=${sid}`);
      if (!name) name = 'Note';
    }

    if (!name && url) {
      try {
        const cleanUrl = url.trim();
        const hasProtocol = /^[a-z]+:\/\//i.test(cleanUrl);
        const urlToParse = hasProtocol ? cleanUrl : `https://${cleanUrl}`;
        const urlObj = new URL(urlToParse);
        name = urlObj.hostname.replace('www.', '');
      } catch {
        name = url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0] || 'Link';
      }
    }
    return { url: targetUrl, name };
  });
};

export interface FavoritesPanelProps {
  searchbarRef?: React.RefObject<any>;
  reload: () => void;
  onCommandSelect: (id: string) => void;
  onSelectSavedAgent?: (agent: any) => void;
  onAutomationSelect?: (automation: any) => void;
  onOpenUrls?: (urls: string[], title?: string) => void;
  onNavigateToListView?: (type: 'notes' | 'links' | 'commands', section?: string) => void;
  onRequestEditLink?: (suggestion: { snippet: any; workspace: any; folder: any }) => void;
  isSidebar?: boolean;
  forceMode?: 'favorites' | 'notes' | 'links' | 'snippets';
  openSpreadsheetView?: (section?: string) => void;
  hideCreatePanelItems?: boolean;
}

const FavoritesPanel = ({
  searchbarRef,
  reload,
  onCommandSelect,
  onSelectSavedAgent,
  onAutomationSelect,
  onOpenUrls,
  onNavigateToListView,
  onRequestEditLink,
  isSidebar = false,
  forceMode = 'favorites',
  openSpreadsheetView,
  hideCreatePanelItems = false,
}: FavoritesPanelProps) => {
  const { theme } = useAppearance();
  const isDark = theme.isDark;
  const isMac =
    typeof navigator !== 'undefined' &&
    (navigator.platform.toLowerCase().includes('mac') || navigator.userAgent.toLowerCase().includes('mac'));
  const showFavorites = useUIStore(state => state.showFavorites);
  const selectedSnippet = useUIStore(state => state.selectedSnippet);
  const activeEditor = useUIStore(state => state.activeEditor);
  const activeView = useUIStore(state => state.activeView);
  const savedAgentSelect = onSelectSavedAgent;

  const handleStartExistingSession = useCallback(
    async (suggestion: { snippet: Snippet | any; workspace: any; folder: any }) => {
      const { snippet, workspace, folder } = suggestion;
      const sessionId = snippet.snippet_id || snippet.id;
      const sessionName = snippet.title || snippet.key || snippet.name || 'Untitled Tab Session';
      const workspaceId = workspace?.workspace_id || workspace?.id;
      const folderId = folder?.folder_id || folder?.id;

      let initialUrls: string[] = [];
      let initialNames: string[] = [];
      let openSettings = snippet.sessionOpenSettings;
      const extractSessionUrlPayload = (entries: any[] | undefined | null) => {
        if (!Array.isArray(entries)) {
          return { urls: [] as string[], names: [] as string[] };
        }

        const urls: string[] = [];
        const names: string[] = [];

        entries.forEach((entry: any) => {
          const url = typeof entry === 'string' ? entry : entry?.url;
          if (!url) return;
          urls.push(url);
          names.push(typeof entry === 'string' ? '' : entry?.title || entry?.name || '');
        });

        return { urls, names };
      };

      try {
        const resolved = await resolveEntityById(sessionId);
        const sessionRecord = resolved?.entity as any;
        if (sessionRecord) {
          openSettings = sessionRecord.sessionOpenSettings || openSettings;
          const resolvedPayload = extractSessionUrlPayload(sessionRecord.urls);
          if (resolvedPayload.urls.length > 0) {
            initialUrls = resolvedPayload.urls;
            initialNames = resolvedPayload.names;
          }
        }
      } catch (err) {}

      if (initialUrls.length === 0) {
        const snippetPayload = extractSessionUrlPayload(snippet.urls);
        if (snippetPayload.urls.length > 0) {
          initialUrls = snippetPayload.urls;
          initialNames = snippetPayload.names;
        } else {
          try {
            const parsed = typeof snippet.value === 'string' ? JSON.parse(snippet.value) : snippet.value;
            if (Array.isArray(parsed)) {
              initialUrls = parsed.map((l: any) => l.url || l);
              initialNames = parsed.map((l: any) => l.name || '');
            } else if (parsed && typeof parsed === 'object') {
              if (Array.isArray(parsed.urls)) initialUrls = parsed.urls;
              if (Array.isArray(parsed.names)) initialNames = parsed.names;
            }
          } catch (e) {}
        }
      }

      const activeTabContext = await new Promise<{
        currentTabId: number | null;
        currentWindowId: number | null;
        currentPageUrl: string;
      }>(resolve => {
        const chromeAny = (window as any)?.chrome;
        if (!chromeAny?.tabs?.query) {
          resolve({
            currentTabId: null,
            currentWindowId: null,
            currentPageUrl: window.location.href,
          });
          return;
        }

        chromeAny.tabs.query({ active: true, currentWindow: true }, (tabs: any[]) => {
          const activeTab = tabs?.[0];
          resolve({
            currentTabId: activeTab?.id ?? null,
            currentWindowId: activeTab?.windowId ?? null,
            currentPageUrl: activeTab?.url || window.location.href,
          });
        });
      });

      chrome.runtime.sendMessage(
        {
          action: 'start_session',
          sessionId,
          sessionName,
          workspaceId,
          folderId: folderId || null,
          teamId: 'local',
          storageMode: 'local',
          initialUrls,
          initialNames,
          openSettings,
          isInlineCreation: true,
          ...activeTabContext,
        },
        response => {
          if (response?.ok && openSettings?.openMode === 'same_window') {
            if (response?.reused || response?.reusedCurrentTab) {
              return;
            }
            const encodedName = encodeURIComponent(sessionName);
            window.history.replaceState(
              null,
              '',
              `?session_mode=true&session_id=${sessionId}&session_name=${encodedName}`,
            );
            useUIStore.getState().openEditor({
              type: 'session',
              id: sessionId,
              props: {
                session: {
                  id: sessionId,
                  title: sessionName,
                },
              },
            });
          }
        },
      );
    },
    [],
  );

  const teamId = 'local';

  const [userId, setUserId] = useState<string>('');
  const { hotkeysMap, shortcutsMap, links, notes, snippets, commands } = useDbStore();
  const [sectionsOrder, setSectionsOrder] = useState<string[]>(['create', 'favorites', 'view']);
  const [showFavoritesSection, setShowFavoritesSection] = useState<boolean>(true);
  const [showCreateSection, setShowCreateSection] = useState<boolean>(true);
  const [showViewSection, setShowViewSection] = useState<boolean>(false);

  useEffect(() => {
    StorageManager.getItem([
      'sidebar_sections_order',
      'sidebar_show_favorites_section_v2',
      'sidebar_show_create_section',
      'sidebar_show_view_section',
    ]).then(result => {
      if (result.sidebar_sections_order) {
        const savedOrder: string[] = result.sidebar_sections_order;
        // Always ensure 'favorites' is present in the order
        if (!savedOrder.includes('favorites')) {
          savedOrder.splice(1, 0, 'favorites');
        }
        setSectionsOrder(savedOrder);
      }
      // If the favorites section was explicitly set to false in a previous session,
      // respect that choice. Otherwise default to visible.
      if (result.sidebar_show_favorites_section_v2 === false) {
        setShowFavoritesSection(false);
      } else {
        setShowFavoritesSection(true);
      }
      if (result.sidebar_show_create_section !== undefined) {
        setShowCreateSection(result.sidebar_show_create_section);
      }
      if (result.sidebar_show_view_section !== undefined) {
        setShowViewSection(result.sidebar_show_view_section);
      } else {
        setShowViewSection(false);
      }
    });
  }, []);

  const handleSectionsReorder = (newOrder: string[]) => {
    setSectionsOrder(newOrder);
    StorageManager.setItem('sidebar_sections_order', newOrder);
  };

  const handleToggleFavoritesSection = (visible: boolean) => {
    setShowFavoritesSection(visible);
    StorageManager.setItem('sidebar_show_favorites_section_v2', visible);
  };

  const handleToggleCreateSection = (visible: boolean) => {
    setShowCreateSection(visible);
    StorageManager.setItem('sidebar_show_create_section', visible);
  };

  const handleToggleViewSection = (visible: boolean) => {
    setShowViewSection(visible);
    StorageManager.setItem('sidebar_show_view_section', visible);
  };

  const createDragControls = useDragControls();
  const favoritesDragControls = useDragControls();
  const viewDragControls = useDragControls();

  const DragHandleIcon = () => (
    <svg
      width="8"
      height="12"
      viewBox="0 0 8 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="opacity-40 hover:opacity-100 transition-opacity">
      <circle cx="2" cy="2" r="1" fill="currentColor" />
      <circle cx="2" cy="6" r="1" fill="currentColor" />
      <circle cx="2" cy="10" r="1" fill="currentColor" />
      <circle cx="6" cy="2" r="1" fill="currentColor" />
      <circle cx="6" cy="6" r="1" fill="currentColor" />
      <circle cx="6" cy="10" r="1" fill="currentColor" />
    </svg>
  );

  // Quick-create menu state removed — items are now shown inline
  const userCommandsMap = useMemo(() => {
    const map: Record<string, any> = {};
    commands.forEach(c => {
      map[c.id] = c;
    });
    return map;
  }, [commands]);

  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [hasBeenExpanded, setHasBeenExpanded] = useState<boolean>(false);
  const [isReordering, setIsReordering] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<'hotkeys' | 'alphabetic' | 'custom' | 'type'>('hotkeys');
  const [favoritesItemsOrder, setFavoritesItemsOrder] = useState<string[]>([]);
  const [visibleFavoritesItems, setVisibleFavoritesItems] = useState<Record<string, boolean>>({});
  const [favoritesCustomGroupNames, setFavoritesCustomGroupNames] = useState<Record<string, string>>({});
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);
  const prevFavIdsRef = useRef<string>('');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const reorderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [hoveredLinkItem, setHoveredLinkItem] = useState<{
    item: Snippet;
    top: number;
    viewportTop: number;
    height: number;
    maxHeight?: number;
  } | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editUrlValue, setEditUrlValue] = useState<string>('');
  const [isAddingNewUrl, setIsAddingNewUrl] = useState<boolean>(false);
  const [newUrlValue, setNewUrlValue] = useState<string>('');

  // Global uiState
  // We use the forceMode passed from AppSidebar to determine the mode.
  const isNotesMode = forceMode === 'notes';
  const isSessionMode = forceMode === 'links';
  const isSnippetsMode = forceMode === 'snippets';
  const isPromptsMode = false; // explicitly disabled per request

  const activeLinkSnippet = useUIStore(state => state.activeLinkSnippet);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    const checkCurrentWindowSession = async () => {
      try {
        const currentWindow = await new Promise<chrome.windows.Window>(resolve => {
          chrome.windows.getCurrent({}, w => resolve(w));
        });
        if (currentWindow?.id) {
          StorageManager.getItem('active_sessions').then((result: any) => {
            const sessions = result || [];
            const matchedSession = sessions.find((s: any) => s.windowId === currentWindow.id);
            if (matchedSession) {
              setActiveSessionId(matchedSession.sessionId);
            } else {
              setActiveSessionId(null);
            }
          });
        }
      } catch (err) {}
    };

    checkCurrentWindowSession();

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.active_sessions) {
        checkCurrentWindowSession();
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  // Load userId and sync populatedFavorites to favoritesMapping
  const { populatedFavorites, removeFavorite } = useFavorites();

  const handleInlineEditLink = useCallback((item: any | null, element: HTMLElement | null) => {
    if (!item || !element) {
      setHoveredLinkItem(null);
      return;
    }

    const category = item.category?.toLowerCase() || item.type?.toLowerCase();
    const isLink = category === 'link';

    if (!isLink) {
      setHoveredLinkItem(null);
      return;
    }

    const elementRect = element.getBoundingClientRect();
    const height = elementRect.height;

    // Use the same coordinate trick as the Create menu:
    // store the viewport y of the item so the absolute-positioned popup
    // (whose containing block starts at yΓëê0) renders at the right place.
    // Centre the popup on the item vertically.
    const pairs = extractUrlNamePair(item);
    const urlCount = pairs.length;
    const estimatedHeight = Math.min(300, Math.max(1, urlCount) * 38 + 36);
    const viewportHeight = window.innerHeight;

    // mid-point of item in viewport coordinates
    let viewportTop = elementRect.top + height / 2 - estimatedHeight / 2;

    // clamp so popup stays on screen
    if (viewportTop + estimatedHeight > viewportHeight - 8) {
      viewportTop = viewportHeight - 8 - estimatedHeight;
    }
    if (viewportTop < 8) viewportTop = 8;

    const safeMaxHeight = Math.min(320, viewportHeight - 32);

    setHoveredLinkItem({
      item,
      top: viewportTop, // used as absolute top (same trick as createMenuPos.top)
      viewportTop,
      height,
      maxHeight: safeMaxHeight,
    });
  }, []);

  // Prevent global/parent keyboard actions when the URLs popover or edit mode is open
  useEffect(() => {
    if (hoveredLinkItem !== null) {
      (window as any).isFavoritesMenuOpen = true;
    } else {
      (window as any).isFavoritesMenuOpen = false;
    }
    return () => {
      (window as any).isFavoritesMenuOpen = false;
    };
  }, [hoveredLinkItem]);

  const getRawUrl = (snippet: Snippet, index: number): string => {
    if (!snippet?.value) return '';
    try {
      if (typeof snippet.value === 'string') {
        const raw = snippet.value.trim();
        if (raw.startsWith('{')) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && Array.isArray(parsed.urls)) {
            return parsed.urls[index] || '';
          }
        }
        return raw;
      } else if (typeof snippet.value === 'object' && snippet.value) {
        const parsed = snippet.value as any;
        if (Array.isArray(parsed.urls)) {
          return parsed.urls[index] || '';
        }
      }
    } catch {}
    return '';
  };

  const handleStartEdit = (index: number) => {
    if (!hoveredLinkItem?.item) return;
    const rawUrl = getRawUrl(hoveredLinkItem.item, index);
    setEditUrlValue(rawUrl);
    setEditingIndex(index);
  };

  const handleSaveUrl = async (index: number, manualUrl?: string) => {
    if (!hoveredLinkItem?.item || editingIndex === null) return;
    const updatedUrl = (manualUrl !== undefined ? manualUrl : editUrlValue).trim();
    if (!updatedUrl) {
      setEditingIndex(null);
      return;
    }

    let normalizedUrl = updatedUrl;
    if (
      !/^[a-z]+:\/\//i.test(normalizedUrl) &&
      !normalizedUrl.startsWith('note:') &&
      !normalizedUrl.startsWith('agent_chat')
    ) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    try {
      const linkRecord = hoveredLinkItem.item as any;
      const linkId = linkRecord.id || linkRecord.snippet_id;

      let newHostName = '';
      try {
        const urlObj = new URL(normalizedUrl);
        newHostName = urlObj.hostname.replace('www.', '');
      } catch {
        newHostName = normalizedUrl.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0] || 'Link';
      }

      const currentUrls = Array.isArray(linkRecord.urls) ? [...linkRecord.urls] : [];
      if (currentUrls[index]) {
        currentUrls[index] = { ...currentUrls[index], url: normalizedUrl, title: newHostName };
      }

      await updateLink(linkId, { urls: currentUrls });

      setHoveredLinkItem(prev => {
        if (!prev) return null;
        return {
          ...prev,
          item: {
            ...prev.item,
            urls: currentUrls,
          },
        };
      });

      reload();
    } catch (err) {
      console.error('Failed to update inline URL:', err);
    } finally {
      setEditingIndex(null);
    }
  };

  const handleAddNewSave = async (newUrl: string) => {
    if (!hoveredLinkItem?.item) return;
    const trimmed = newUrl.trim();
    if (!trimmed) {
      setIsAddingNewUrl(false);
      setNewUrlValue('');
      return;
    }

    let normalizedUrl = trimmed;
    if (
      !/^[a-z]+:\/\//i.test(normalizedUrl) &&
      !normalizedUrl.startsWith('note:') &&
      !normalizedUrl.startsWith('agent_chat')
    ) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    try {
      const linkRecord = hoveredLinkItem.item as any;
      const linkId = linkRecord.id || linkRecord.snippet_id;

      let newHostName = '';
      try {
        const urlObj = new URL(normalizedUrl);
        newHostName = urlObj.hostname.replace('www.', '');
      } catch {
        newHostName = normalizedUrl.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0] || 'Link';
      }

      const currentUrls = Array.isArray(linkRecord.urls) ? [...linkRecord.urls] : [];
      currentUrls.push({ id: Date.now().toString(), url: normalizedUrl, title: newHostName });

      await updateLink(linkId, { urls: currentUrls });

      setHoveredLinkItem(prev => {
        if (!prev) return null;
        return {
          ...prev,
          item: {
            ...prev.item,
            urls: currentUrls,
          },
        };
      });

      reload();
    } catch (err) {
      console.error('Failed to add new URL:', err);
    } finally {
      setIsAddingNewUrl(false);
      setNewUrlValue('');
    }
  };

  const handleDeleteUrl = async (index: number) => {
    if (!hoveredLinkItem?.item) return;
    const linkRecord = hoveredLinkItem.item as any;
    const linkId = linkRecord.id || linkRecord.snippet_id;

    try {
      const currentUrls = Array.isArray(linkRecord.urls) ? [...linkRecord.urls] : [];
      const updatedUrls = currentUrls.filter((_, i) => i !== index);

      if (updatedUrls.length === 0) {
        // No URLs left - remove from favorites completely
        removeFavorite(linkId).catch(console.error);
        setHoveredLinkItem(null);
      } else {
        await updateLink(linkId, { urls: updatedUrls });

        setHoveredLinkItem(prev => {
          if (!prev) return null;
          return {
            ...prev,
            item: {
              ...prev.item,
              urls: updatedUrls,
            },
          };
        });
      }

      reload();
    } catch (err) {
      console.error('Failed to delete inline URL:', err);
    }
  };

  // Load sort order and custom favorites layout data
  useEffect(() => {
    StorageManager.getItem([
      'favoritesSortOrder',
      'favorites_items_order',
      'favorites_visible_items',
      'favorites_custom_group_names',
    ]).then(result => {
      if (result.favoritesSortOrder) {
        setSortOrder(result.favoritesSortOrder);
      }
      if (result.favorites_items_order) {
        setFavoritesItemsOrder(result.favorites_items_order);
      }
      if (result.favorites_visible_items) {
        setVisibleFavoritesItems(result.favorites_visible_items);
      }
      if (result.favorites_custom_group_names) {
        setFavoritesCustomGroupNames(result.favorites_custom_group_names);
      }
      setHasLoadedStorage(true);
    });

    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.favoritesSortOrder) {
        setSortOrder(changes.favoritesSortOrder.newValue);
      }
      if (changes.favorites_items_order) {
        setFavoritesItemsOrder(changes.favorites_items_order.newValue || []);
      }
      if (changes.favorites_visible_items) {
        setVisibleFavoritesItems(changes.favorites_visible_items.newValue || {});
      }
      if (changes.favorites_custom_group_names) {
        setFavoritesCustomGroupNames(changes.favorites_custom_group_names.newValue || {});
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);

    // Close menu on click outside
    const handleClickOutside = (event: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedStorage) return;

    const dbFavIds = populatedFavorites.map(f => f.compoundId).filter(Boolean);
    const favIdsStr = JSON.stringify(dbFavIds);

    if (favIdsStr === prevFavIdsRef.current) {
      return;
    }
    prevFavIdsRef.current = favIdsStr;

    // Filter out any IDs in favoritesItemsOrder that are no longer in the DB (except headers)
    let cleanedOrder = favoritesItemsOrder.filter(id => id.startsWith('header-') || dbFavIds.includes(id));

    // Add any new DB favorites that are not in cleanedOrder yet
    const missingFavs = dbFavIds.filter(id => !favoritesItemsOrder.includes(id));
    if (missingFavs.length > 0) {
      cleanedOrder = [...missingFavs, ...cleanedOrder];
      setFavoritesItemsOrder(cleanedOrder);
      StorageManager.setItem('favorites_items_order', cleanedOrder);
    }
  }, [populatedFavorites, favoritesItemsOrder, hasLoadedStorage]);

  const handleSortChange = (newOrder: 'hotkeys' | 'alphabetic' | 'custom' | 'type') => {
    setSortOrder(newOrder);
    StorageManager.setItem('favoritesSortOrder', newOrder);
    setShowSortMenu(false);
  };

  // Track if panel has been expanded by hover
  useEffect(() => {
    if (isHovered && !showFavorites) {
      setHasBeenExpanded(true);
    }
  }, [isHovered, showFavorites]);

  // Reset expanded state when showFavorites is toggled on
  useEffect(() => {
    if (showFavorites) {
      setHasBeenExpanded(false);
    }
  }, [showFavorites]);

  const showFavoritesTutorial = useUIStore(state => state.activeTutorial) === 'favorites';

  // Tutorial event listeners handled centrally in App.tsx

  // Initialize default favorites once for new installations
  useEffect(() => {
    if (!userId) return;
  }, [userId]);

  // Sync with storage on mount and when teamId changes
  useEffect(() => {}, []);

  const favoritesWithFolders = useMemo(() => {
    // Merge and deduplicate by ID
    const combinedFavs: any[] = [...populatedFavorites];
    const seenIds = new Set(populatedFavorites.map(f => f.id || f.snippet_id));

    const results: { item: Snippet | any; folder: Folder | null; workspace: any; compoundId: string }[] = [];

    combinedFavs.forEach(item => {
      // If it's a command or agent/automation item, bypass workspace check and inject live prefix
      if (('type' in item && item.type === 'command') || item.category === 'automation' || item.category === 'agent') {
        const storedCmd = userCommandsMap[item.id];
        const dynamicPrefix = storedCmd ? storedCmd.prefix : item.commandPrefix;
        results.push({
          item: { ...item, commandPrefix: dynamicPrefix },
          folder: null,
          workspace: null,
          compoundId: item.compoundId || item.id || item.automation_id || item.snippet_id,
        });
        return;
      }

      // Otherwise, assume it's just a regular snippet/link
      const id = item.id || item.snippet_id;

      const liveItem = {
        ...item,
        key: item.key || item.title || item.name || 'Untitled',
        favourite_id: item.favourite_id || item.favorite_id,
      };

      // Build compound ID using workspace/folder from the item itself
      const cId =
        item.compoundId ||
        getItemCompoundId({
          _kind: 'snippet',
          snippet: { ...item, id },
          workspace: item.workspaceId ? { workspace_id: item.workspaceId } : null,
          folder: item.folderId ? { folder_id: item.folderId } : null,
        }) ||
        id;

      results.push({ item: liveItem, folder: null, workspace: null, compoundId: cId });
    });

    if (sortOrder === 'custom') {
      return results;
    }

    const getItemGroupType = (item: any): string => {
      const category = (item.category || item.type || '').toLowerCase();
      if (category === 'link') return 'links';
      if (category === 'note') return 'notes';
      if (category === 'snippet') return 'snippets';
      if (category === 'session') return 'sessions';
      return 'automations';
    };

    return results.sort((a, b) => {
      const nameA = (a.item.label || a.item.key || '').toLowerCase();
      const nameB = (b.item.label || b.item.key || '').toLowerCase();

      if (sortOrder === 'type') {
        const groupWeights: Record<string, number> = { links: 1, notes: 2, snippets: 3, sessions: 4, automations: 5 };
        const groupA = getItemGroupType(a.item);
        const groupB = getItemGroupType(b.item);
        if (groupA !== groupB) {
          return groupWeights[groupA] - groupWeights[groupB];
        }
        return nameA.localeCompare(nameB);
      }

      if (sortOrder === 'hotkeys') {
        const hasHotkeyA = !!hotkeysMap[a.compoundId];
        const hasHotkeyB = !!hotkeysMap[b.compoundId];

        if (hasHotkeyA && !hasHotkeyB) return -1;
        if (!hasHotkeyA && hasHotkeyB) return 1;
        // Both have or both don't have: sort by name
        return nameA.localeCompare(nameB);
      }

      if (sortOrder === 'alphabetic') {
        return nameA.localeCompare(nameB);
      }

      return 0;
    });
  }, [populatedFavorites, userCommandsMap, userId, sortOrder, hotkeysMap]);

  const allLinksWithFolders = useMemo(() => {
    const results = links.map(snip => {
      const cId = getItemCompoundId({
        _kind: 'snippet',
        snippet: { ...snip, category: 'link' },
        workspace: (snip as any).workspaceId ? { workspace_id: (snip as any).workspaceId } : null,
        folder: (snip as any).folderId ? { folder_id: (snip as any).folderId } : null,
      });
      return {
        item: { ...snip, key: snip.title || (snip as any).url || 'Untitled Link', type: 'link' },
        folder: null,
        workspace: null,
        compoundId: cId || snip.id || '',
      };
    });

    if (sortOrder === 'custom') return results;

    return results.sort((a, b) => {
      const nameA = (a.item.key || '').toLowerCase();
      const nameB = (b.item.key || '').toLowerCase();

      if (sortOrder === 'hotkeys') {
        const hasHotkeyA = !!hotkeysMap[a.compoundId];
        const hasHotkeyB = !!hotkeysMap[b.compoundId];
        if (hasHotkeyA && !hasHotkeyB) return -1;
        if (!hasHotkeyA && hasHotkeyB) return 1;
        return nameA.localeCompare(nameB);
      }
      return nameA.localeCompare(nameB);
    });
  }, [links, sortOrder, hotkeysMap]);

  const allNotesWithFolders = useMemo(() => {
    const results = notes.map(snip => {
      const cId = getItemCompoundId({
        _kind: 'snippet',
        snippet: { ...snip, category: 'note' },
        workspace: (snip as any).workspaceId ? { workspace_id: (snip as any).workspaceId } : null,
        folder: (snip as any).folderId ? { folder_id: (snip as any).folderId } : null,
      });
      return {
        item: { ...snip, key: snip.title || 'Untitled Note', type: 'note' },
        folder: null,
        workspace: null,
        compoundId: cId || snip.id || '',
      };
    });

    if (sortOrder === 'custom') return results;

    return results.sort((a, b) => {
      const nameA = (a.item.key || '').toLowerCase();
      const nameB = (b.item.key || '').toLowerCase();

      if (sortOrder === 'hotkeys') {
        const hasHotkeyA = !!hotkeysMap[a.compoundId];
        const hasHotkeyB = !!hotkeysMap[b.compoundId];
        if (hasHotkeyA && !hasHotkeyB) return -1;
        if (!hasHotkeyA && hasHotkeyB) return 1;
        return nameA.localeCompare(nameB);
      }
      return nameA.localeCompare(nameB);
    });
  }, [notes, sortOrder, hotkeysMap]);

  const allSnippetsWithFolders = useMemo(() => {
    const results = snippets.map(snip => {
      const cId = getItemCompoundId({
        _kind: 'snippet',
        snippet: { ...snip, category: (snip as any).category || 'snippet' },
        workspace: (snip as any).workspaceId ? { workspace_id: (snip as any).workspaceId } : null,
        folder: (snip as any).folderId ? { folder_id: (snip as any).folderId } : null,
      });
      return {
        item: { ...snip, key: snip.title || 'Untitled Snippet', type: 'snippet' },
        folder: null,
        workspace: null,
        compoundId: cId || snip.id || '',
      };
    });

    if (sortOrder === 'custom') return results;

    return results.sort((a, b) => {
      const nameA = (a.item.key || '').toLowerCase();
      const nameB = (b.item.key || '').toLowerCase();

      if (sortOrder === 'hotkeys') {
        const hasHotkeyA = !!hotkeysMap[a.compoundId];
        const hasHotkeyB = !!hotkeysMap[b.compoundId];
        if (hasHotkeyA && !hasHotkeyB) return -1;
        if (!hasHotkeyA && hasHotkeyB) return 1;
        return nameA.localeCompare(nameB);
      }
      return nameA.localeCompare(nameB);
    });
  }, [snippets, sortOrder, hotkeysMap]);

  const handleAddNewFavorite = () => {
    useUIStore.getState().openEditor({ type: 'link', id: 'new' });
  };

  const urlPairs = useMemo(() => {
    if (!hoveredLinkItem?.item) return [];
    return extractUrlNamePair(hoveredLinkItem.item);
  }, [hoveredLinkItem]);

  // Show collapsed star icon when showFavorites is disabled
  const shouldShowCollapsed = false;
  const shouldExpand = isHovered || showFavorites || hasBeenExpanded;

  const visibleSections = sectionsOrder.filter(id => {
    if (id === 'create') return showCreateSection;
    if (id === 'favorites') return showFavoritesSection;
    if (id === 'view') return showViewSection;
    return false;
  });
  const firstVisibleSectionId = visibleSections[0];

  return (
    <div
      className={`relative overflow-visible favorites-panel-container flex flex-col ${isSidebar ? '' : 'transition-all duration-500'} ${showFavoritesTutorial ? 'z-[9999]' : 'z-40'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: '100%',
        height: isSidebar ? '100%' : undefined,
      }}>
      {shouldShowCollapsed && !shouldExpand && !isSidebar ? (
        // Collapsed state - just show star icon (but hover area is full width)
        <div className="w-full h-full flex items-start justify-start pt-0">
          <div className="pointer-events-auto flex items-center justify-center w-12 h-12 rounded-r-xl cursor-pointer">
            <HiOutlineStar className="w-5 h-5 text-[var(--color-iconDefault)]" />
          </div>
        </div>
      ) : (
        // Expanded state - show full panel
        <div
          className={`relative flex flex-col w-full ${isSidebar ? '' : 'transition-all duration-500'}
            ${isSidebar ? 'h-full border-0 rounded-none bg-transparent overflow-visible' : 'h-auto min-h-[160px] max-h-[55vh] border rounded-r-xl rounded-br-none ml-0 mr-auto overflow-visible'}
            ${showFavoritesTutorial ? 'z-[9999] border-[#22c55e] ring-1 ring-[#22c55e]/20 bg-black/60 rounded-r-2xl pointer-events-none' : !isSidebar && isDark ? 'bg-frostedwhite border-white/10 shadow-sm pointer-events-auto' : 'pointer-events-auto'}`}
          style={{
            background: !showFavoritesTutorial && !isDark && !isSidebar ? 'var(--color-cardBg)' : '',
            ...(!showFavoritesTutorial && !isDark && !isSidebar ? { borderColor: 'var(--color-borderDefault)' } : {}),
            ...(showFavoritesTutorial ? { borderColor: '#22c55e' } : {}),
          }}>
          {/* Settings — rendered ONCE at top-right of the entire panel, never inside sections, to prevent unmounting */}
          {!hideCreatePanelItems && (
            <div className="absolute top-[14px] right-4 z-50 flex items-center gap-0.5">
              <SidebarSettingsDropdown
                showFavoritesSection={showFavoritesSection}
                onToggleFavoritesSection={handleToggleFavoritesSection}
                showCreateSection={showCreateSection}
                onToggleCreateSection={handleToggleCreateSection}
                showViewSection={showViewSection}
                onToggleViewSection={handleToggleViewSection}
                sectionsOrder={sectionsOrder}
                onSectionsReorder={handleSectionsReorder}
                isHovered={isHovered}
              />
            </div>
          )}

          {!hideCreatePanelItems && (
            <Reorder.Group
              axis="y"
              values={sectionsOrder}
              onReorder={handleSectionsReorder}
              className={`flex flex-col gap-0 w-full ${isSidebar ? 'overflow-y-auto clean-scrollbar h-full pb-12 pr-1' : ''}`}>
              {sectionsOrder.map(sectionId => {
                if (sectionId === 'create') {
                  return (
                    <Reorder.Item
                      key="create"
                      value="create"
                      className="list-none"
                      dragListener={false}
                      dragControls={createDragControls}
                      transition={{ type: 'just', duration: 0 }}>
                      <CreateMenuPanel onCommandSelect={onCommandSelect} />
                    </Reorder.Item>
                  );
                }
                if (sectionId === 'favorites') {
                  // Favorites are now displayed in the Home View grid card — not in the sidebar
                  return null;
                }
                if (sectionId === 'view') {
                  return (
                    <Reorder.Item
                      key="view"
                      value="view"
                      className="list-none"
                      dragListener={false}
                      dragControls={viewDragControls}
                      transition={{ type: 'just', duration: 0 }}>
                      {(() => {
                        let effectiveEditor = activeEditor;
                        if (!effectiveEditor && activeView) {
                          if (activeView.type === 'createFolder' || activeView.type === 'sharedFolderCreation') {
                            effectiveEditor = { type: 'folder', id: '' } as any;
                          } else if (
                            activeView.type === 'createWorkspace' ||
                            activeView.type === 'organizationSettings'
                          ) {
                            effectiveEditor = { type: 'workspace', id: '' } as any;
                          }
                        }

                        // Render the related items panel for ALL editor types (nodes, links, etc.)
                        return effectiveEditor ? (
                          <EditorItemsPanel
                            activeEditor={effectiveEditor}
                            onOpenUrls={onOpenUrls}
                            onRequestEditLink={onRequestEditLink}
                            onStartExistingSession={handleStartExistingSession as any}
                            searchbarRef={searchbarRef}
                            openSpreadsheetView={openSpreadsheetView}
                          />
                        ) : null;
                      })()}
                      <SidebarDashboardViewsSection />
                    </Reorder.Item>
                  );
                }
                return null;
              })}
            </Reorder.Group>
          )}
        </div>
      )}

      {/* URL Preview Popover — absolute positioning, mirrors Create menu exactly */}
      {hoveredLinkItem && urlPairs.length > 0 && (
        <div
          className={`absolute left-[280px] z-[9999] p-0 rounded-r-lg border-t border-b border-r shadow-xl flex flex-col w-[300px] overflow-y-auto overflow-x-hidden default-visible-scrollbar transition-all duration-200 select-none
            ${
              isDark
                ? 'border-white/10 text-neutral-400 shadow-black/80'
                : 'border-[var(--color-borderDefault)] text-[var(--color-textSecondary)] shadow-neutral-400/20'
            }`}
          style={{
            top: `${hoveredLinkItem.top}px`,
            maxHeight: `${hoveredLinkItem.maxHeight || 280}px`,
            backgroundColor: isDark ? '#080808' : 'var(--color-popupBg)',
          }}>
          <div className="flex justify-between items-center p-2 sticky top-0 bg-inherit z-10 border-b border-black/5 dark:border-white/5 mb-1">
            <span
              className={`text-[12px] font-bold tracking-tight px-1 ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>
              Edit Link
            </span>
            <button
              onClick={() => {
                setHoveredLinkItem(null);
                setEditingIndex(null);
                setEditUrlValue('');
                setIsAddingNewUrl(false);
                setNewUrlValue('');
              }}
              className={`p-1 rounded-full transition-colors ${
                isDark
                  ? 'hover:bg-white/10 text-neutral-400 hover:text-white'
                  : 'hover:bg-black/5 text-[#586e75] hover:text-black'
              }`}>
              <FaTimes size={12} />
            </button>
          </div>
          {urlPairs.map((pair, idx) => (
            <div
              key={idx}
              onDoubleClick={e => {
                e.stopPropagation();
                if (editingIndex !== idx) {
                  handleStartEdit(idx);
                }
              }}
              className={`group flex items-center gap-2 px-3 py-2 transition-colors duration-150 border-b last:border-b-0 w-full min-h-[36px] shrink-0 box-border
                ${isDark ? 'hover:bg-white/5 border-white/5' : 'hover:bg-black/5 border-black/5'}`}>
              {/* Favicon */}
              <img
                src={getFaviconUrl(pair.url)}
                alt=""
                className={`w-4 h-4 rounded-sm object-contain shrink-0 transition-opacity duration-150 ${isDark ? 'opacity-50 group-hover:opacity-80' : 'opacity-60 group-hover:opacity-90'}`}
                onError={e => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
              {/* URL label or Input */}
              {editingIndex === idx ? (
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onDoubleClick={e => {
                    e.stopPropagation();
                    handleSaveUrl(idx, e.currentTarget.textContent || '');
                  }}
                  onKeyDown={e => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveUrl(idx, e.currentTarget.textContent || '');
                    } else if (e.key === 'Escape') {
                      setEditingIndex(null);
                    }
                  }}
                  onBlur={() => {
                    setEditingIndex(null);
                  }}
                  onClick={e => e.stopPropagation()}
                  className={`text-[12px] font-medium tracking-tight bg-transparent outline-none flex-1 min-w-0 w-full px-1 py-0.5 rounded break-all whitespace-normal
                    ${isDark ? 'text-white bg-white/10' : 'text-[#073642] bg-black/5'}`}
                  ref={el => {
                    if (el && editingIndex === idx) {
                      el.focus();
                      try {
                        const range = document.createRange();
                        const sel = window.getSelection();
                        range.selectNodeContents(el);
                        range.collapse(false);
                        sel?.removeAllRanges();
                        sel?.addRange(range);
                      } catch (err) {
                        console.error('Failed to set contentEditable caret position:', err);
                      }
                    }
                  }}>
                  {getRawUrl(hoveredLinkItem.item, idx)}
                </div>
              ) : (
                <a
                  href={pair.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className={`text-[12px] font-medium tracking-tight whitespace-nowrap overflow-hidden text-ellipsis flex-1 min-w-0 no-underline transition-colors duration-150
                    ${isDark ? 'text-neutral-400 group-hover:text-neutral-200' : 'text-[#586e75] group-hover:text-[#073642]'}`}>
                  {stripCmdStatus(pair.url).replace(/^(https?:\/\/)?(www\.)?/i, '')}
                </a>
              )}
              {/* Edit + Delete ΓÇö only visible on row hover when not editing */}
              {editingIndex !== idx && (
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <button
                    title="Edit URL"
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleStartEdit(idx);
                    }}
                    className={`p-1 rounded transition-colors duration-150 text-[var(--color-iconDefault)] ${isDark ? 'hover:text-neutral-300 hover:bg-white/10' : 'hover:text-neutral-600 hover:bg-black/10'}`}>
                    <FiEdit2 size={12} />
                  </button>
                  <button
                    title="Remove URL"
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteUrl(idx);
                    }}
                    className={`p-1 rounded transition-colors duration-150 text-[var(--color-iconDefault)] ${isDark ? 'hover:text-red-400 hover:bg-red-500/10' : 'hover:text-red-500 hover:bg-red-50'}`}>
                    <FiTrash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Add new URL ΓÇö plus button or inline input */}
          {!isAddingNewUrl ? (
            <button
              onClick={e => {
                e.stopPropagation();
                setIsAddingNewUrl(true);
              }}
              className={`group flex items-center justify-center gap-2 px-3 py-2 w-full text-[12px] font-semibold tracking-tight border-t transition-colors duration-150 shrink-0
      ${
        isDark
          ? 'border-white/5 text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400'
          : 'border-black/5 text-emerald-600 hover:bg-emerald-50/80 hover:text-emerald-700'
      }`}>
              {/* Swapped text-gray-400 out for a matching green text scale */}
              <FiPlus size={13} className="shrink-0 text-emerald-500 dark:text-emerald-400" />
              <span>Add URL</span>
            </button>
          ) : (
            <div
              className={`flex items-center gap-2 px-3 py-2 border-t w-full min-h-[36px] shrink-0 box-border
                ${isDark ? 'border-white/5' : 'border-black/5'}`}>
              <FiPlus size={13} className="shrink-0 text-[var(--color-iconDefault)]" />
              <div
                contentEditable
                suppressContentEditableWarning
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddNewSave(e.currentTarget.textContent || '');
                  } else if (e.key === 'Escape') {
                    setIsAddingNewUrl(false);
                    setNewUrlValue('');
                  }
                }}
                onDoubleClick={e => {
                  e.stopPropagation();
                  handleAddNewSave(e.currentTarget.textContent || '');
                }}
                onBlur={() => {
                  setIsAddingNewUrl(false);
                  setNewUrlValue('');
                }}
                onInput={e => {
                  setNewUrlValue((e.currentTarget as HTMLElement).textContent || '');
                }}
                onClick={e => e.stopPropagation()}
                className={`text-[12px] font-medium tracking-tight bg-transparent outline-none flex-1 min-w-0 w-full px-1 py-0.5 rounded break-all whitespace-normal
                  ${isDark ? 'text-neutral-300' : 'text-[#073642]'}`}
                ref={el => {
                  if (el) {
                    el.focus();
                  }
                }}
                data-placeholder="Type URL and press Enter"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(FavoritesPanel);
