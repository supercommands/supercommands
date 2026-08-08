import * as React from 'react';
import { forwardRef, useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { getFaviconUrl } from '../../../../../shared-components/searchBarMain/utilityFunctions/utils';
import { useAppearance } from '@extension/ui';

import {
  AI_GROUP,
  type CommandId,
} from '../../../../../shared-components/searchBarMain/commandConfigurations/commands';
import { getCommandKeywords } from '../../../../../shared-components/searchBarMain/commandConfigurations/commandKeywords';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
type Folder = any;
type Workspace = any;
type Snippet = any;
import DefaultContainer, {
  type CommandInteractiveItem,
  type DefaultContainerHandle,
  type DefaultContainerProps,
  type InteractiveSection,
  type SnippetInteractiveItem,
  type InteractiveItem,
} from './defaultContainer';

import {
  extractUrlsFromSnippet,
} from '../../../../../allObjectFolder/src/createObject/snippets/SnippetClickActions';
import type {
  SnippetActionDetail,
  SnippetSuggestion,
} from '../../../../../allObjectFolder/src/createObject/snippets/SnippetClickActions';
import type { LocalCommandId } from '../../../../../shared-components/searchBarMain/commandConfigurations/localCommands';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import type { CommandRecord } from '../../../../../allObjectFolder/src/createObject/commands/commandTypes';
import { useFavorites, useUser } from '../../../../../shared-components/favorites/favoriteHooks';


import { useChromeStorage } from '@extension/shared/lib/hooks';
import { isSameDay } from 'date-fns';

interface HomeViewProps {
  onQuickCommandSelect?: (commandId: CommandId | LocalCommandId | 'ai' | 'collections') => void;
  onCommandPreview?: (commandId: CommandId | LocalCommandId | 'ai' | 'collections' | null) => void;
  onSnippetSelect: (item: SnippetSuggestion) => void;
  onRequestSnippetDelete: (detail: SnippetActionDetail) => void;
  onRequestFocusSearch?: () => void;
  onRequestOpenUrls?: (urls: string[], title?: string) => void;
  onRequestLinkEdit?: (suggestion: SnippetSuggestion) => void;
  onHighlightChange?: (item: InteractiveItem | null) => void;
  inlineNotification?: { message: string; type: 'success' | 'error' | 'info' | 'warning' } | null;
  isCommandLocked?: boolean;
  isPromptMenuOpen?: boolean;
  isAtMenuOpen?: boolean;
  isSuggestionVisible?: boolean;
  onNavigateToListView?: (category: 'commands', section?: string) => void;
  isLoggedIn: boolean;
  onOpenContextMenu?: (x: number, y: number, fav: any) => void;
  onExecuteFavorite?: (fav: any, e?: React.MouseEvent) => void;
}

export type HomeViewHandle = DefaultContainerHandle;


const useHomeSnippets = () => {
  const selectedFolderId = useUIStore((s: any) => s.selectedFolderId);
  const workspaces = useDbStore(state => state.workspaces);
  const folders = useDbStore(state => state.folders);
  const snippets = useDbStore(state => state.snippets);

  return useMemo(() => {
    const folderById = new Map(folders.map(folder => [folder.id, folder]));
    const workspaceById = new Map(workspaces.map(workspace => [workspace.id, workspace]));
    const visibleSnippets = selectedFolderId
      ? snippets.filter(snippet => String(snippet.folderId ?? '') === String(selectedFolderId))
      : snippets;

    return visibleSnippets
      .map(snippet => {
        const workspaceRecord = workspaceById.get(snippet.workspaceId);
        if (!workspaceRecord) return null;

        const folderRecord = snippet.folderId ? (folderById.get(snippet.folderId) ?? null) : null;
        const snippetDate = new Date(snippet.updatedAt || snippet.createdAt || Date.now()).toISOString();
        return {
          workspace: {
            workspace_id: workspaceRecord.id,
            workspace_name: workspaceRecord.workspaceName,
            folders: [],
            workspace_snippets: [],
            workspace_automations: [],
          } as Workspace,
          folder: folderRecord
            ? ({
              folder_id: folderRecord.id,
              folder_name: folderRecord.folderName,
              snippets: [],
              automations: [],
              folders: [],
            } as Folder)
            : null,
          snippet: {
            id: snippet.id,
            key: snippet.title,
            value: snippet.config,
            category: 'snippet',
            user_id: '',
            first_name: '',
            last_name: null,
            created_at: snippetDate,
            updated_at: snippetDate,
            tags: null,
            snippet_id: snippet.id,
            workspaceId: snippet.workspaceId,
            folderId: snippet.folderId,
            title: snippet.title,
            config: snippet.config,
            tagIds: snippet.tagIds,
          } as Snippet,
        };
      })
      .filter(Boolean) as Array<{ workspace: Workspace; folder: Folder | null; snippet: Snippet }>;
  }, [selectedFolderId, workspaces, folders, snippets]);
};

const HomeView = React.memo(
  forwardRef<HomeViewHandle, HomeViewProps>(
    (
      {
        onQuickCommandSelect,
        onCommandPreview,
        onSnippetSelect,
        onRequestSnippetDelete,
        onRequestFocusSearch,
        onRequestOpenUrls,
        onRequestLinkEdit,
        onHighlightChange,
        inlineNotification,
        isCommandLocked,
        isAtMenuOpen,
        isSuggestionVisible,
        onNavigateToListView,
        isLoggedIn,
        onOpenContextMenu,
        onExecuteFavorite,
      },
      ref,
    ) => {
      const teamSnippets = useHomeSnippets();
      const { favorites, toggleFavorite } = useFavorites();
      const { theme, wallpaperId } = useAppearance();
      const isDark = theme.isDark;
      const isCarRace = wallpaperId === 'Car Race.png' || wallpaperId === 'car-race.png';
      const selectedFolderId = useUIStore((s: any) => s.selectedFolderId);
      const commandStatus = useUIStore((s: any) => s.commandStatus);
      const selectedFolderRecord = useDbStore(state =>
        selectedFolderId ? (state.folders.find(folder => folder.id === selectedFolderId) ?? null) : null,
      );

      const [todoCounts, setTodoCounts] = useState<{ overdue: number; done: number; total: number }>({
        overdue: 0,
        done: 0,
        total: 0,
      });

      // Helper to parse task dates safely
      const parseTaskDate = (d: string | undefined) => {
        if (!d) return new Date(0);
        return new Date(String(d).replace(' ', 'T'));
      };

      // Unified Todo Synchronization for HomeView (matches SideBar)
      useEffect(() => {
        const chromeAny = (window as any).chrome;

        const updateTodoMetrics = async () => {
          if (!chromeAny?.storage?.local) return;

          try {
            const result = await new Promise<any>(resolve =>
              chromeAny.storage.local.get(['local_todos', 'cached_todos'], resolve),
            );
            const allTasks = [...(result.cached_todos || []), ...(result.local_todos || [])];

            // 1. Deduplicate by ID
            const uniqueTasks = Array.from(new Map(allTasks.map(t => [String(t.id || t.snippet_id), t])).values());
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

            // 2. Calculate Counts & Stats
            const metrics = uniqueTasks.reduce(
              (acc: any, t: any) => {
                const deadline = parseTaskDate(t.event_deadline);
                if (isNaN(deadline.getTime())) return acc;

                const isAnytime = !!(
                  t.is_anytime ||
                  (t.event_deadline && String(t.event_deadline).substring(0, 4) >= '2035')
                );
                const isFutureDay = !isSameDay(deadline, now) && deadline > now;

                const isActiveToday =
                  !t.is_done && !isFutureDay && (isSameDay(deadline, now) || deadline < now || isAnytime);
                const isDoneToday = t.is_done && isSameDay(deadline, now);
                const isPast = deadline < now && !isAnytime;

                if (isActiveToday || isDoneToday) {
                  acc.todayTotal++;
                  if (t.is_done) {
                    acc.todayDone++;
                  } else if (isPast) {
                    acc.overdue++;
                  }
                } else if (!t.is_done && deadline < startOfToday && !isAnytime) {
                  acc.overdue++;
                }
                return acc;
              },
              { overdue: 0, todayTotal: 0, todayDone: 0 },
            );

            setTodoCounts({ overdue: metrics.overdue, done: metrics.todayDone, total: metrics.todayTotal });
          } catch (e) {
            console.error('[HomeView] Failed to update todo metrics:', e);
          }
        };

        updateTodoMetrics();
        window.addEventListener('todosUpdated', updateTodoMetrics);

        const handleStorageChange = (changes: any, area: string) => {
          if (area === 'local' && (changes.local_todos || changes.cached_todos)) {
            updateTodoMetrics();
          }
        };
        chromeAny.storage.onChanged.addListener(handleStorageChange);

        return () => {
          window.removeEventListener('todosUpdated', updateTodoMetrics);
          chromeAny.storage.onChanged.removeListener(handleStorageChange);
        };
      }, []);

      const commands = useDbStore(state => state.commands);

      const userCommandsMap = useMemo(() => {
        const map: Record<string, CommandRecord> = {};
        commands.forEach(c => {
          map[c.id] = c;
        });
        return map;
      }, [commands]);

      const favoriteIdSet = useMemo(() => {
        const set = new Set<string>();
        favorites.forEach(fav => {
          if (fav.reference_id) set.add(fav.reference_id);
        });
        return set;
      }, [favorites]);

      // AI selection state for dynamic icons (Migrated to chrome.storage.local)
      const [selectedAIs, setSelectedAIs] = useChromeStorage<string[]>('selectedAIs', AI_GROUP.members);
      const AI_ICON_HOSTS = ['chatgpt.com', 'claude.ai', 'gemini.google.com', 'perplexity.ai'];

      const handleToggleAI = useCallback(
        (aiId: string) => {
          setSelectedAIs(prev => {
            const newSelection = prev.includes(aiId) ? prev.filter(id => id !== aiId) : [...prev, aiId];
            return newSelection;
          });
        },
        [setSelectedAIs],
      );

      const toggleFavoriteForItem = useCallback(
        async (item: InteractiveItem) => {
          try {
            function showToast(msg: string) {
              useUIStore.getState().setCommandStatus({ status: 'success', message: msg });
              setTimeout(() => {
                useUIStore.getState().setCommandStatus({ status: 'idle', message: '' });
              }, 2000);
            }

            try {
              let itemId: string;
              let itemType: string;

              if (item.kind === 'command') {
                itemType = 'command';
                itemId = item.commandId;
              } else {
                const snippet: any = (item.suggestion as any).item || (item.suggestion as any).snippet;
                itemType = snippet.category || 'snippet';
                itemId = snippet?.id || snippet?.snippet_id;
              }

              const isNowFav = !favoriteIdSet.has(itemId);
              await toggleFavorite(
                itemId,
                itemType,
                item.kind === 'command'
                  ? item.label
                  : (item.suggestion as any).item?.title || (item.suggestion as any).snippet?.key,
              );

              if (isNowFav) {
                showToast(`Added to favorites`);
              } else {
                showToast(`Removed from favorites`);
              }
            } catch (err) {
              console.error('[HomeView] Toggle Error', err);
            }
          } catch (outerErr) {
            console.error(outerErr);
          }
        },
        [favoriteIdSet, toggleFavorite],
      );

      // Track focused item kind for dynamic label
      const [focusedItemKind, setFocusedItemKind] = useState<'link' | 'note' | 'command' | 'folder' | 'session' | null>(
        null,
      );

      const handleHighlightChange = useCallback(
        (item: InteractiveItem | null) => {
          if (onHighlightChange) {
            onHighlightChange(item);
          }
          if (item) {
            setFocusedItemKind(item.kind);
          } else {
            setFocusedItemKind(null);
          }
        },
        [onHighlightChange],
      );

      const handleSnippetOpen = useCallback(
        (item: SnippetSuggestion) => {
          const snippet: any = (item as any).item || (item as any).snippet;
          const category = (snippet?.category || '').toLowerCase();
          const snippetId = snippet?.snippet_id || snippet?.id || '';

          if (category === 'link' || category === 'session') {
            const urls = extractUrlsFromSnippet(snippet);
          } else {
          }

          onSnippetSelect(item);
        },
        [onSnippetSelect],
      );

      const handleOpenUrls = useCallback(
        (urls: string[], title?: string) => {
          if (urls?.length) {
          }
          onRequestOpenUrls?.(urls, title);
        },
        [onRequestOpenUrls],
      );

      const getDynamicActionLabel = () => {
        return 'Options';
      };

      if (isCommandLocked || isAtMenuOpen) {
        return null;
      }

      return (
        <div className="w-full flex flex-col relative">

        </div>
      );
    },
  ),
);

HomeView.displayName = 'HomeView';

export default HomeView;
