import { useState, useRef, useEffect, useMemo } from 'react';
import type {
  SuggestionListItem,
  CommandSuggestionItem,
  CommonCommandSuggestionItem,
  HistorySuggestionItem,
  BookmarkSuggestionItem,
  OpenUrlSuggestionItem,
  WorkspaceItemSuggestion,
  AnyCommandId,
  Attachment,
} from '../utilityFunctions/types';
import type { CommandDefinition, CommandId } from '../commandConfigurations/commands';
import { AI_GROUP, AI_GROUP as commandsAI_GROUP, BASE_COMMANDS_BY_ID } from '../commandConfigurations/commands';
import { normalizeShortcutTrigger } from '../../../shared-components/shortcuts/core/shortcutDbData';
import { extractSnippetIdFromCompoundId } from '../../../shared-components/utils/idGenerator';
import { useDbStore } from '../../../storage/store/useDbStore';
import type { LocalCommandId, LocalCommandDefinition } from '../commandConfigurations/localCommands';
import { LOCAL_COMMANDS } from '../commandConfigurations/localCommands';
import type { SavedAutomation } from '../../../allObjectFolder/src/createObject/automationBeta/utilities/automation';

import type { WorkspaceData } from '../../../settings/allWorkspaceManager/workspaces/workspaceTypes';
import type { InstalledModule, UnifiedSearchResult } from '../searchLogicAndAlgorithms/searchEngine';
import {
  searchAll as fuseSearchAll,
  preIndexHistory,
} from '../searchLogicAndAlgorithms/searchEngine';
import { searchCommands } from '../searchLogicAndAlgorithms/commandSearch';
import { isBookmarksCommand, trimQuery } from '../utilityFunctions/promptHelpers';
import { getUrlsFromQuery } from '../utilityFunctions/urlHelpers';
import type { HistoryItem } from '../searchLogicAndAlgorithms/historyAlgo';
import type { CommonCommandEntry } from '../searchLogicAndAlgorithms/commonResults';

interface UseSearchbarSuggestionsProps {
  value: string;
  lockedCommand: AnyCommandId | null;
  lockedLocalDef: LocalCommandDefinition | null | undefined;
  selectedTeam: any | null;
  searchTeamLike: any | null;
  dbWorkspaces: WorkspaceData[];
  selectedFolder: any | null;
  isInitialAltSFocus: boolean;
  isFocused: boolean;
  isSearchFocusEnabled: boolean;
  selectedImages: Attachment[];
  commands: CommandDefinition[];
  commandIndex: any;
  bookmarkSuggestions: BookmarkSuggestionItem[];
  commonCommandEntries: CommonCommandEntry[];
  automationSuggestions: SavedAutomation[];
  agentCollectionSuggestions: any[];
  moduleSuggestions: InstalledModule[];

  selectedAtCommand: string | null;
  activeSnippetCommandId: string | null;
  isSnippetCommand: boolean;
  activeCollection?: any;
  showAIHistoryPanel?: boolean;
  commandKey?: string;
  workspaceItemIndex?: any[];
  userDbShortcuts?: any[];
  userDbHotkeys?: any[];
  customPrefixes?: any;
}
const isSameSnippetIdentity = (left: any, right: any): boolean => {
  const leftId = String(left ?? '').trim().toLowerCase();
  const rightId = String(right ?? '').trim().toLowerCase();
  if (!leftId || !rightId) return false;
  if (leftId === rightId) return true;
  const leftSnippetId = extractSnippetIdFromCompoundId(leftId);
  const rightSnippetId = extractSnippetIdFromCompoundId(rightId);
  return leftSnippetId === rightSnippetId || leftSnippetId === rightId || leftId === rightSnippetId;
};

export function useSearchbarSuggestions({
  value,
  lockedCommand,
  lockedLocalDef,
  selectedTeam,
  searchTeamLike,
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
  customPrefixes,
}: UseSearchbarSuggestionsProps) {
  // History cache state
  const [historyItems, setHistoryItems] = useState<HistoryItem[] | null>(null);
  const isFetchingHistoryRef = useRef<boolean>(false);

  // Debounced search results
  const [debouncedFuseResults, setDebouncedFuseResults] = useState<SuggestionListItem[]>([]);
  const fuseSearchTimeoutRef = useRef<number | null>(null);

  // Effect to prefetch history when search focus is enabled
  useEffect(() => {
    if (!isSearchFocusEnabled) {
      setHistoryItems(null);
      isFetchingHistoryRef.current = false;
      return;
    }

    if (historyItems || isFetchingHistoryRef.current) return;

    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.runtime?.sendMessage) return;

    isFetchingHistoryRef.current = true;
    chromeAny.runtime.sendMessage(
      { action: 'history_search', query: '', maxResults: 2000, includeFrecency: true, halfLifeHours: 2 },
      (response: any) => {
        isFetchingHistoryRef.current = false;
        if (response?.ok && Array.isArray(response.results)) {
          const items: HistoryItem[] = response.results.map((item: any) => ({
            id: item.id || item.url,
            title: item.title || item.url || '',
            url: item.url || '',
            lastVisitTime: item.lastVisitTime || 0,
            visitCount: item.visitCount || 0,
            frecencyScore: typeof item.frecencyScore === 'number' ? item.frecencyScore : undefined,
          }));

          preIndexHistory(items);
          setHistoryItems(items);
        }
      },
    );
  }, [historyItems, isSearchFocusEnabled]);

  const commandQuery = useMemo(() => {
    return value;
  }, [value]);

  const commonCommandSuggestions = useMemo<CommonCommandSuggestionItem[]>(() => {
    const trimmed = trimQuery(value);
    const searchQuery = trimmed;
    if ((!searchQuery && selectedImages.length === 0) || lockedCommand) return [];
    return commonCommandEntries.map(entry => ({
      _kind: 'common_command' as const,
      id: entry.command.id,
      label: entry.label,
      description: entry.description,
      command: entry.command,
      query: searchQuery,
    }));
  }, [commonCommandEntries, value, lockedCommand, selectedImages.length]);



  const commandSuggestions = useMemo<CommandSuggestionItem[]>(() => {
    if (lockedLocalDef || isBookmarksCommand(lockedCommand)) return [];

    const safeCommandKey = (commandKey || 'c').trim().toLowerCase();
    const safeSystemKey = (customPrefixes?.system_command || 'sc').trim().toLowerCase();
    const valLower = value.toLowerCase();

    const isCommandTrigger =
      valLower.startsWith(`${safeCommandKey} `) ||
      valLower.startsWith(`${safeSystemKey} `) ||
      valLower.startsWith('system commands') ||
      valLower.startsWith('system command') ||
      valLower.startsWith('commands') ||
      valLower.startsWith('/sc') ||
      valLower.startsWith('/c');
    
    if (!isCommandTrigger) {
      return [];
    }

    const trimmedQuery = commandQuery.trim().toLowerCase();
    let queryAfterCmd = valLower.startsWith('system commands ')
      ? 'sc ' + valLower.slice('system commands '.length)
      : valLower.startsWith('system commands')
      ? 'sc' + valLower.slice('system commands'.length)
      : valLower.startsWith('system command ')
      ? 'sc ' + valLower.slice('system command '.length)
      : valLower.startsWith('system command')
      ? 'sc' + valLower.slice('system command'.length)
      : valLower.startsWith('/')
      ? valLower.slice(1)
      : valLower.startsWith(`${safeCommandKey} `)
      ? valLower.slice(safeCommandKey.length + 1)
      : valLower;

    let activeCategoryFilter: 'note' | 'link' | 'snippet' | 'session' | 'automation' | 'agent' | 'command' | 'todo' | 'system_command' | 'bookmark' | null = null;
    let actualQuery = queryAfterCmd.trim(); // trimmed version for actual searching
    
    if (isCommandTrigger) {
      // All prefixes come from centralized storage (customSearchPrefixesForOmniboxStorage).
      // Defaults are defined there — never hardcode fallbacks here.
      const notePrefix = customPrefixes?.note?.trim()?.toLowerCase();
      const linkPrefix = customPrefixes?.link?.trim()?.toLowerCase();
      const sessionPrefix = customPrefixes?.session?.trim()?.toLowerCase();
      const automationPrefix = customPrefixes?.automation?.trim()?.toLowerCase();
      const agentPrefix = customPrefixes?.agent?.trim()?.toLowerCase();
      const commandPrefix = customPrefixes?.command?.trim()?.toLowerCase();
      const snippetPrefix = customPrefixes?.snippet?.trim()?.toLowerCase();
      const todoPrefix = customPrefixes?.todo?.trim()?.toLowerCase();
      const systemCommandPrefix = customPrefixes?.system_command?.trim()?.toLowerCase() || 'sc';
      const bookmarkPrefix = customPrefixes?.bookmark?.trim()?.toLowerCase() || 'bm';

      const matchPrefix = (prefix: string | undefined): boolean => {
        if (!prefix) return false;
        if (value.startsWith('/')) {
          return queryAfterCmd === prefix || queryAfterCmd.startsWith(`${prefix} `);
        }
        return queryAfterCmd.startsWith(`${prefix} `);
      };

      const getSlicedQuery = (prefix: string): string => {
        return queryAfterCmd === prefix ? '' : queryAfterCmd.slice(prefix.length).trim();
      };

      // Order by longest prefix first so 'sn' (snippet) is checked before 's' (session)
      if (matchPrefix(systemCommandPrefix)) {
         activeCategoryFilter = 'system_command';
         actualQuery = getSlicedQuery(systemCommandPrefix!);
      } else if (matchPrefix(automationPrefix)) {
         activeCategoryFilter = 'automation';
         actualQuery = getSlicedQuery(automationPrefix!);
      } else if (matchPrefix(snippetPrefix) || matchPrefix('sn')) {
         activeCategoryFilter = 'snippet';
         actualQuery = getSlicedQuery(queryAfterCmd.startsWith('sn') ? 'sn' : snippetPrefix || 'sn');
      } else if (matchPrefix(bookmarkPrefix) || matchPrefix('bm') || matchPrefix('b')) {
         activeCategoryFilter = 'bookmark';
         actualQuery = getSlicedQuery(queryAfterCmd.startsWith('bm') ? 'bm' : queryAfterCmd.startsWith('b') ? 'b' : bookmarkPrefix);
      } else if (matchPrefix(sessionPrefix) || matchPrefix('se')) {
         activeCategoryFilter = 'session';
         actualQuery = getSlicedQuery(queryAfterCmd.startsWith('se') ? 'se' : sessionPrefix || 's');
      } else if (matchPrefix(notePrefix) || matchPrefix('nm')) {
         activeCategoryFilter = 'note';
         actualQuery = getSlicedQuery(queryAfterCmd.startsWith('nm') ? 'nm' : notePrefix || 'n');
      } else if (matchPrefix(linkPrefix)) {
         activeCategoryFilter = 'link';
         actualQuery = getSlicedQuery(linkPrefix!);
      } else if (matchPrefix(agentPrefix) || matchPrefix('ca') || matchPrefix('g')) {
         activeCategoryFilter = 'agent';
         actualQuery = getSlicedQuery(queryAfterCmd.startsWith('ca') ? 'ca' : queryAfterCmd.startsWith('g') ? 'g' : agentPrefix || 'ca');
      } else if (matchPrefix(todoPrefix)) {
         activeCategoryFilter = 'todo';
         actualQuery = getSlicedQuery(todoPrefix!);
      } else if (matchPrefix(commandPrefix)) {
         activeCategoryFilter = 'command';
         actualQuery = getSlicedQuery(commandPrefix!);
      }

      console.log('[SlashFilter Debug][Suggestions] value:', `"${value}"`, 'activeCategoryFilter:', activeCategoryFilter, 'actualQuery:', `"${actualQuery}"`);
    }

    const results: any[] = [];
    
    // Exact logic from omniboxEvents.ts
    const normalizeSearchText = (val: string) => String(val || '').trim().toLowerCase();
    const rankByQuery = (val: string, q: string): number | null => {
      const normalizedValue = normalizeSearchText(val);
      const normalizedQuery = normalizeSearchText(q);
      if (!normalizedValue || !normalizedQuery) return null;
      if (normalizedValue === normalizedQuery) return 0;
      if (normalizedValue.startsWith(normalizedQuery)) return 1;
      if (normalizedQuery.length >= 2 && normalizedValue.includes(normalizedQuery)) return 2;
      return null;
    };
    
    // Extract raw snippet UUID from compound ID (e.g. folderId-UUID)
    // We now use the centralized extractSnippetIdFromCompoundId from idGenerator
    
    // Inject User Assigned Entities (Shortcuts & Hotkeys)
    const userEntities: any[] = [];
    const addedUserEntities = new Set<string>();

    const processUserRecord = (record: any, isHotkey: boolean) => {
      // If it is a shortcut (not a hotkey) and the text trigger is empty/whitespace, do not show it in c space
      if (!isHotkey && (!record.trigger || !record.trigger.trim())) { 
        return;
      }

      if (activeCategoryFilter) {
          if (activeCategoryFilter === 'command') return; // Hide user shortcuts completely if filtering for base commands
          
          const refType = record.referenceType?.toLowerCase() || '';
          const isNote = refType === 'note' || refType === 'notes';
          const isLink = refType === 'link' || refType === 'links';
          const isSnippet = refType === 'snippet' || refType === 'snippets';
          const isSession = refType === 'session' || refType === 'sessions';
          const isPrompt = refType === 'ai_prompt' || refType === 'prompt' || refType === 'aiprompt';
          const isAutomation = refType === 'automation' || refType === 'automations';
          const isAgent = refType === 'chat_agent' || refType === 'agent';
          const isTodo = refType === 'todo' || refType === 'todos';
          
          if (activeCategoryFilter === 'note' && !isNote) return;
          if (activeCategoryFilter === 'link' && !isLink) return;
          if (activeCategoryFilter === 'snippet' && !isSnippet) return;
          if (activeCategoryFilter === 'session' && !isSession) return;
          if (activeCategoryFilter === 'automation' && !isAutomation) return;
          if (activeCategoryFilter === 'agent' && !isAgent && !isPrompt) return;
          if (activeCategoryFilter === 'todo' && !isTodo) return;
      }

      const { referenceId, referenceType } = record;
      if (!referenceId || !referenceType || addedUserEntities.has(referenceId)) return;
      addedUserEntities.add(referenceId);

      let entity: any = null;
      // Fetch directly from Zustand state to avoid redundant React subscriptions (which the user objected to)
      // We must use the full database because matchingSnippets is heavily filtered by the search query!
      const dbState = useDbStore.getState();
      
      let commandMatch: any = null;
      if (referenceType === 'command') {
          commandMatch = commandIndex.find((c: any) => c.definition.id === referenceId);
          if (!commandMatch) {
             const fallbackCommand = dbState.commands?.find((c: any) => c.id === referenceId);
             if (fallbackCommand) {
                 commandMatch = {
                     kind: 'local',
                     definition: fallbackCommand,
                     score: 1000,
                     matchedTokens: []
                 };
             }
          }
      } else {
          // Synchronously resolve the entity across all tables, acting exactly like entityResolver.ts
          entity = dbState.notes?.find((n: any) => isSameSnippetIdentity(n.id, referenceId))
                || dbState.links?.find((l: any) => isSameSnippetIdentity(l.id || l.snippet_id, referenceId))
                || dbState.snippets?.find((s: any) => isSameSnippetIdentity(s.id, referenceId))
                || dbState.sessions?.find((s: any) => isSameSnippetIdentity(s.id, referenceId))
                || dbState.automations?.find((a: any) => isSameSnippetIdentity(a.id, referenceId))
                || dbState.chatAgents?.find((c: any) => isSameSnippetIdentity(c.id, referenceId))
                || dbState.aiPrompts?.find((p: any) => isSameSnippetIdentity(p.id, referenceId))
                || dbState.todos?.find((t: any) => isSameSnippetIdentity(t.id, referenceId));

          if (!entity) {
              const staticViews = ['all', 'todos', 'notes', 'snippets', 'links', 'sessions', 'bookmarks'];
              if (staticViews.includes(referenceId)) {
                  entity = {
                      id: referenceId,
                      title: referenceId.charAt(0).toUpperCase() + referenceId.slice(1),
                      _kind: 'static_view'
                  };
              }
          }
      }

      if (entity || commandMatch) {
        // Evaluate ranking if there is a query
        let rank: number | null = null;
        
        if (actualQuery) {
           rank = rankByQuery(record.trigger || '', actualQuery);
        }
        
        // Fallback: If it didn't match the stripped query, try matching the full raw input value.
        // We skip this if we are actively filtering by category to avoid false matches with "c n".
        if (rank === null && value && !activeCategoryFilter) {
           const fullRank = rankByQuery(record.trigger || '', value);
           if (fullRank !== null) {
              rank = fullRank;
           }
        }

        // If the query is completely empty after the command/filter, show by default (rank 0)
        if (rank === null && !actualQuery) {
            rank = 0;
        }

        if (rank !== null) {
          if (commandMatch) {
             console.log('[Suggestions Debug] Pushing commandMatch:', commandMatch.definition.id, 'rank:', rank);
             userEntities.push({
               kind: commandMatch.kind,
               definition: commandMatch.definition,
               score: 1000 - rank,
               matchedTokens: []
             });
          } else {
              const isWorkspaceItemType =
                referenceType === 'note' ||
                referenceType === 'link' ||
                referenceType === 'snippet' ||
                referenceType === 'session' ||
                referenceType === 'aiPrompt' ||
                referenceType === 'ai_prompt' ||
                referenceType === 'prompt' ||
                referenceType === 'agent' ||
                referenceType === 'chat_agent' ||
                referenceType === 'todo';

              if (isWorkspaceItemType) {
                let prefixChar = '';
                if (referenceType === 'note') prefixChar = customPrefixes?.note?.trim()?.toLowerCase() ?? '';
                else if (referenceType === 'link') prefixChar = customPrefixes?.link?.trim()?.toLowerCase() ?? '';
                else if (referenceType === 'snippet') prefixChar = customPrefixes?.snippet?.trim()?.toLowerCase() ?? '';
                else if (referenceType === 'session') prefixChar = customPrefixes?.session?.trim()?.toLowerCase() ?? '';
                else if (referenceType === 'prompt' || referenceType === 'aiPrompt' || referenceType === 'ai_prompt') prefixChar = customPrefixes?.prompt?.trim()?.toLowerCase() ?? '';
                else if (referenceType === 'agent' || referenceType === 'chat_agent') prefixChar = customPrefixes?.agent?.trim()?.toLowerCase() ?? '';
                else if (referenceType === 'automation') prefixChar = customPrefixes?.automation?.trim()?.toLowerCase() ?? '';
                else if (referenceType === 'todo') prefixChar = customPrefixes?.todo?.trim()?.toLowerCase() ?? '';
                  
                let shortcutDisplay = '';
                if (!isHotkey && record.trigger) {
                   shortcutDisplay = `${safeCommandKey}${prefixChar ? ` ${prefixChar}` : ''} ${record.trigger}`.trim();
                } else if (!isHotkey) {
                   shortcutDisplay = `${safeCommandKey}${prefixChar ? ` ${prefixChar}` : ''}`.trim();
                }
                
                const normalizedCategory =
                  referenceType === 'ai_prompt' || referenceType === 'prompt'
                    ? 'aiPrompt'
                    : referenceType === 'chat_agent'
                    ? 'agent'
                    : referenceType;

                const nativeItem: any = {
                  _kind: 'workspace_item',
                  item: {
                    ...entity,
                    category: normalizedCategory,
                  },
                  workspace: { id: entity.workspaceId, workspace_id: entity.workspaceId },
                  folder: entity.folderId ? { id: entity.folderId, folder_id: entity.folderId } : null,
                  id: referenceId,
                  score: 1000 - rank,
                  matchedTokens: []
                };

                if (shortcutDisplay) {
                  nativeItem.item._displayShortcut = shortcutDisplay;
                }

                userEntities.push(nativeItem);
               // Also register the resolved entity's actual DB id so the dedup check
               // in matchingCategoryItems works (referenceId may differ from entity.id)
               if (entity.id && entity.id !== referenceId) {
                 addedUserEntities.add(entity.id);
               }
             } else {
               userEntities.push({
                 _kind: 'command', // Map it as a command so it appears in the commands column
                 commandType: 'proxy', // Indicate it's a proxy for native rendering
                 id: `proxy_${referenceId}`,
                 label: entity.title || entity.name || 'Untitled',
                 score: 1000 - rank, // Massive score boost for user assigned, minus rank so closer match is higher
                 matchedTokens: [],
                 proxyEntity: {
                   ...entity,
                   _kind: 'snippet',
                   snippet: { ...entity, category: referenceType }, // Native rendering expects this
                 }
               });
             }
          }
        }
      }
    };

    (userDbShortcuts || []).forEach(record => processUserRecord(record, false));
    // Exclude hotkeys from c space command suggestions as they are keyboard action triggers, not text command shortcuts
    // (userDbHotkeys || []).forEach(record => processUserRecord(record, true));

    // When "c " is typed (no sub-category), everything goes into ONE Commands section.
    // Force all user shortcuts (even notes/links) to _kind:'command' so BoardView shows a single list.
    // When "c n ", "c l " etc. is typed, only show shortcuts for that category (as workspace_items).
    let filteredUserEntities: any[];
    if (activeCategoryFilter) {
      // Normalize the category stored on item.category to match activeCategoryFilter
      // e.g. item.category may be 'aiPrompt' but filter is 'prompt'; 'agent'/'chat_agent' for 'agent' etc.
      const normalizeCategory = (cat: string): string => {
        const c = (cat || '').toLowerCase();
        if (c === 'aiprompt' || c === 'ai_prompt' || c === 'prompt' || c === 'chat_agent' || c === 'agent') return 'agent';
        if (c === 'notes') return 'note';
        if (c === 'links') return 'link';
        if (c === 'sessions') return 'session';
        if (c === 'snippets') return 'snippet';
        if (c === 'automations') return 'automation';
        if (c === 'todos') return 'todo';
        if (c === 'system_commands' || c === 'system_command' || c === 'system') return 'system_command';
        return c;
      };
      filteredUserEntities = userEntities.filter((e: any) =>
        e._kind === 'workspace_item' && normalizeCategory(e.item?.category) === activeCategoryFilter,
      );
    } else {
      // No category filter → convert ALL user shortcuts into command-type so they appear in Commands section
      filteredUserEntities = userEntities.map((e: any) => {
        if (e._kind === 'workspace_item') {
          return {
            _kind: 'command' as const,
            commandType: 'proxy',
            id: `proxy_${e.id || e.item?.id}`,
            label: e.item?.title || e.item?.name || 'Untitled',
            score: e.score || 1000,
            matchedTokens: [],
            // Wrap as workspace_item so unwrapProxy resolves it correctly for
            // icon rendering, click, and double-click based on category (note/link/snippet etc.)
            proxyEntity: {
              _kind: 'workspace_item',
              item: e.item,
              workspace: e.workspace,
              folder: e.folder || null,
            },
          };
        }
        return e;
      });
    }
    results.push(...filteredUserEntities);

    console.log('[Suggestions Debug] value:', `"${value}"`, 'fixed trigger:', `"${safeCommandKey} "`);

    if (value === `${safeCommandKey} ` || (!queryAfterCmd && !activeCategoryFilter)) {
      const baseCmds = searchCommands(commandIndex, '').filter(cmd => {
        if (cmd.definition.category === 'browser' && (!cmd.definition.prefix || cmd.definition.prefix.trim() === '')) return false;
        // If system_command filter is not active, include only user-customized commands in 'c '
        if (activeCategoryFilter !== 'system_command') {
          const baseDef = BASE_COMMANDS_BY_ID.get(cmd.definition.id);
          const normPfx = (p: string | undefined) => String(p || '').trim().toLowerCase().replace(/^\/+/, '');
          const isCustomized = baseDef && (
            normPfx(cmd.definition.prefix) !== normPfx(baseDef.prefix) ||
            String(cmd.definition.label || '').trim() !== String(baseDef.label || '').trim()
          );
          if (!isCustomized) return false;
        }
        return true;
      });
      baseCmds.forEach(cmd => {
          const label = cmd.definition.label || '';
          const category = cmd.definition.category || '';
          const isBrowser = category === 'browser';
          const isCreate = label.startsWith('Create');
          
          if (isCreate) {
             cmd.score = 300;
          } else if (isBrowser) {
             cmd.score = 200;
          } else {
             cmd.score = 100;
          }
      });
      results.push(...baseCmds);
    } else if (!activeCategoryFilter || activeCategoryFilter === 'command' || activeCategoryFilter === 'system_command') {
      let filteredBaseCommands = searchCommands(commandIndex, actualQuery).filter(cmd => {
        if (cmd.definition.category === 'browser' && (!cmd.definition.prefix || cmd.definition.prefix.trim() === '')) return false;
        if (activeCategoryFilter !== 'system_command') {
          const baseDef = BASE_COMMANDS_BY_ID.get(cmd.definition.id);
          const normPfx = (p: string | undefined) => String(p || '').trim().toLowerCase().replace(/^\/+/, '');
          const isCustomized = baseDef && (
            normPfx(cmd.definition.prefix) !== normPfx(baseDef.prefix) ||
            String(cmd.definition.label || '').trim() !== String(baseDef.label || '').trim()
          );
          if (!isCustomized) return false;
        }
        return true;
      });

      filteredBaseCommands.forEach(cmd => {
          const label = cmd.definition.label || '';
          const category = cmd.definition.category || '';
          const isBrowser = category === 'browser';
          const isCreate = label.startsWith('Create');
          
          if (isCreate) {
             cmd.score = (cmd.score || 0) + 500;
          } else if (isBrowser) {
             cmd.score = (cmd.score || 0) + 200;
          } else {
             cmd.score = (cmd.score || 0) + 100;
          }
      });

      // Boost specific keywords manually just to make sure they show at the top during exact matches
      const exactQueryMatch = actualQuery.trim().toLowerCase();
      filteredBaseCommands.sort((a, b) => {
          const aLabel = a.definition.label.toLowerCase();
          const bLabel = b.definition.label.toLowerCase();
          if (aLabel === exactQueryMatch && bLabel !== exactQueryMatch) return -1;
          if (bLabel === exactQueryMatch && aLabel !== exactQueryMatch) return 1;
          return (b.score || 0) - (a.score || 0);
      });
      results.push(...filteredBaseCommands);
    } else if (activeCategoryFilter) {
      // Scenario 3: Category Search (c n )
      const dbState = useDbStore.getState();
      let sourceArray: any[] = [];
      
      switch (activeCategoryFilter) {
        case 'note': sourceArray = dbState.notes || []; break;
        case 'link': sourceArray = dbState.links || []; break;
        case 'snippet': sourceArray = dbState.snippets || []; break;
        case 'session': sourceArray = dbState.sessions || []; break;
        case 'automation': sourceArray = dbState.automations || []; break;
        case 'agent': sourceArray = [...(dbState.chatAgents || []), ...(dbState.aiPrompts || [])]; break;
        case 'todo': sourceArray = dbState.todos || []; break;
        case 'bookmark': sourceArray = []; break;
      }

      const matchingCategoryItems = sourceArray.map(item => {
         const id = item.id || item.snippet_id || item.todo_id || '';
         const title = item.key || item.title || item.name || item.snippet_title || '';
         
         // Fuzzy search score
         let score = rankByQuery(title, actualQuery);
         if (score === null && actualQuery) {
            // Not a match
            return null;
         }
         
         score = score !== null ? (10 - score) : 0; // Baseline score
         
         // Check if this item has a user-assigned shortcut
         // We do this by checking if it's already in addedUserEntities
         if (addedUserEntities.has(id)) {
            score += 1000; // Pin to top
            return null; // Already in userEntities, no need to duplicate!
         }

         return {
           _kind: 'workspace_item',
           item: {
             ...item,
             category: activeCategoryFilter,
           },
           workspace: { id: item.workspaceId, workspace_id: item.workspaceId },
           folder: item.folderId ? { id: item.folderId, folder_id: item.folderId } : null,
           id: id,
           score: score,
           matchedTokens: []
         };
      }).filter(Boolean);
      
      results.push(...matchingCategoryItems);
    }

    const seenCommandIds = new Set<string>();
    let filteredResults = results.filter((r: any) => {
      const id = r.definition?.id || r.id;
      if (id === 'ai') return false;
      
      // Deduplicate overlapping remote and local commands
      if (id && (r._kind === 'command' || r.definition)) {
        if (seenCommandIds.has(id)) return false;
        seenCommandIds.add(id);
      }
      return true;
    });

    // Only collapse to exact shortcut match when the user types a real search query
    // (e.g. "c n cinema"). When just "c n " is typed with no further query,
    // show user shortcuts first then ALL remaining items from the DB.
    const hasExactUserMatch = filteredResults.some(r => (r.score || 0) >= 1000);
    const isActivelyQuerying = !!actualQuery && trimmedQuery !== safeCommandKey && value !== `${safeCommandKey} `;
    
    if (hasExactUserMatch && isActivelyQuerying) {
       filteredResults = filteredResults.filter(r => (r.score || 0) >= 1000);
    }

    // Sort by score (which includes rank for proxy items)
    filteredResults.sort((a, b) => (b.score || 0) - (a.score || 0));

    const converted: CommandSuggestionItem[] = filteredResults.map((match: any) => {
      if (match.commandType === 'proxy') return match;
      if (match.kind === 'remote') {
        return {
          _kind: 'command' as const,
          commandType: 'remote' as const,
          id: match.definition.id,
          label: match.definition.label,
          prefix: match.definition.prefix,
          score: match.score,
          matchedTokens: match.matchedTokens,
          command: match.definition,
        };
      }
      if (match._kind === 'workspace_item') {
        return match;
      }
      if (match.commandType === 'proxy') {
        return match;
      }
      return {
        _kind: 'command' as const,
        commandType: 'local' as const,
        id: match.definition.id as LocalCommandId,
        label: match.definition.label,
        prefix: match.definition.prefix,
        score: match.score,
        matchedTokens: match.matchedTokens,
        command: match.definition,
      };
    });
    
    // Sort so proxies (score=1000) stay at the top, followed by normal commands
    converted.sort((a, b) => (b.score || 0) - (a.score || 0));

    const shouldIncludeAiAggregate = () => {
      if (lockedLocalDef || isBookmarksCommand(lockedCommand)) return false;
      if (converted.some(item => item.id === 'ai')) return false;
      if (!queryAfterCmd) return false;
      return queryAfterCmd.includes('ai') || queryAfterCmd.includes('assistant') || value.includes('@');
    };

    return shouldIncludeAiAggregate()
      ? [
          {
            _kind: 'command' as const,
            commandType: 'aggregate' as const,
            id: 'ai' as const,
            label: AI_GROUP.label,
            prefix: AI_GROUP.prefix,
            score: queryAfterCmd ? 6 : 1,
            matchedTokens: queryAfterCmd ? [queryAfterCmd] : [],
          },
          ...converted,
        ]
      : converted;
  }, [commandQuery, lockedCommand, lockedLocalDef, value, commandIndex]);

  const historySuggestions = useMemo<HistorySuggestionItem[]>(() => {
    if (
      value.trim() === `c` ||
      lockedLocalDef ||
      isBookmarksCommand(lockedCommand) ||
      value.trim().length === 0 ||
      selectedImages.length > 0 ||
      commandSuggestions.some(cmd => cmd.id === 'ai') ||
      activeSnippetCommandId
    ) {
      return [];
    }
    const q = value.trim().toLowerCase();
    
    return (historyItems || [])
      .filter(item => {
        if (!q) return false;
        
        const inTitle = (item.title || '').toLowerCase().includes(q);
        const inUrl = (item.url || '').toLowerCase().includes(q);
        return inTitle || inUrl;
      })
      .map(item => ({
        _kind: 'history' as const,
        id: item.id || item.url,
        title: item.title,
        url: item.url,
        lastVisitTime: item.lastVisitTime,
        visitCount: item.visitCount,
        frecencyScore: item.frecencyScore,
      }));
  }, [value, lockedLocalDef, lockedCommand, selectedImages.length, commandSuggestions, activeSnippetCommandId, historyItems]);

  const localEntitySuggestions = useMemo(() => {
    if (!lockedLocalDef) return [];
    if (value.trim() === `c`) return [];
    const q = value.trim().toLowerCase();
    if (lockedLocalDef.scope === 'workspace') {
      const action = lockedLocalDef.action;
      if (!action) return [];
      const items = dbWorkspaces.map(ws => ({
        _kind: 'workspace' as const,
        workspace: {
          id: ws.id,
          workspace_id: ws.id,
          workspace_name: ws.workspaceName,
          folders: [],
          workspace_snippets: [],
          workspace_automations: [],
        } as any,
        action,
      }));
      if (!q) return items;
      return items.filter(it => (it.workspace.workspace_name || '').toLowerCase().includes(q));
    }
    if (lockedLocalDef.scope === 'snippet') {
      const dbState = useDbStore.getState();
      const allowedCategories =
        activeSnippetCommandId === 'delete_link'
          ? new Set(['link', 'links', 'tabgroup', 'Tab Session'])
          : new Set(['snippet']);
          
      let items: any[] = [];
      if (allowedCategories.has('link')) items = [...items, ...(dbState.links || []), ...(dbState.sessions || [])];
      if (allowedCategories.has('snippet')) items = [...items, ...(dbState.snippets || [])];
      
      const q = value.trim().toLowerCase();
      
      return items.filter(item => {
         const title = String(item.title || item.name || item.snippet_title || '').toLowerCase();
         return !q || title.includes(q);
      }).map(item => ({
        _kind: 'workspace_item' as const,
        item: { ...item, category: activeSnippetCommandId === 'delete_link' ? 'link' : 'snippet' },
        workspace: { id: item.workspaceId, workspace_id: item.workspaceId },
        folder: item.folderId ? { id: item.folderId, folder_id: item.folderId } : null,
      }));
    }
    return [];
  }, [dbWorkspaces, lockedLocalDef, activeSnippetCommandId, value]);

  // Effect to run debounced Fuse.js search
  useEffect(() => {
    if (fuseSearchTimeoutRef.current) {
      window.clearTimeout(fuseSearchTimeoutRef.current);
      fuseSearchTimeoutRef.current = null;
    }

    const shouldSkip =
      isInitialAltSFocus || isFocused
        ? false
        : isBookmarksCommand(lockedCommand) ||
          lockedLocalDef ||
          lockedCommand ||
          selectedAtCommand ||
          (lockedCommand !== 'calendar' && !value.trim() && selectedImages.length === 0);

    if (shouldSkip) {
      setDebouncedFuseResults([]);
      return;
    }

    fuseSearchTimeoutRef.current = window.setTimeout(async () => {
      const bookmarksForSearch = bookmarkSuggestions.map(b => ({
        id: b.id,
        title: b.title,
        url: b.url,
      }));

      const fuseResults = fuseSearchAll(value, {
        commands,
        localCommands: LOCAL_COMMANDS,
        historyItems: isSearchFocusEnabled ? historyItems : null,
        bookmarks: bookmarksForSearch,
        commonCommands: commonCommandEntries,
        automations: automationSuggestions,
        agents: agentCollectionSuggestions,
        modules: moduleSuggestions,
        notes: useDbStore.getState().notes || [],
        links: useDbStore.getState().links || [],
        snippets: useDbStore.getState().snippets || [],
        sessions: useDbStore.getState().sessions || [],
        prompts: useDbStore.getState().aiPrompts || [],
        lockedCommand: null,
        selectedFolder: selectedFolder ?? null,
        selectedTeam: searchTeamLike ?? selectedTeam ?? null,
        includeCommonIfEmpty: selectedImages.length > 0,
        returnAllIfEmpty: isInitialAltSFocus || !value.trim(),
      });

      const converted: SuggestionListItem[] = [];

      for (const result of fuseResults) {
        switch (result._kind) {
          case 'command':
            converted.push({
              _kind: 'command' as const,
              commandType: result.commandType,
              id: result.id,
              label: result.label,
              prefix: result.prefix,
              score: result.score,
              matchedTokens: [],
              command: result.command,
              description: result.description,
            } as CommandSuggestionItem);
            break;

          case 'history':
            converted.push({
              _kind: 'history' as const,
              id: result.id,
              title: result.title,
              url: result.url,
              lastVisitTime: result.lastVisitTime,
              visitCount: result.visitCount,
              frecencyScore: result.frecencyScore,
              isOtherResult: result.isOtherResult,
              commandId: result.commandId,
            } as HistorySuggestionItem);
            break;



          case 'bookmark':
            converted.push({
              _kind: 'bookmark' as const,
              id: result.id,
              title: result.title,
              url: result.url,
              commandId: result.commandId,
            } as BookmarkSuggestionItem);
            break;

          case 'common_command':
            converted.push({
              _kind: 'common_command' as const,
              id: result.id,
              label: result.label,
              description: result.description,
              command: result.command,
              query: result.query,
            } as CommonCommandSuggestionItem);
            break;


          case 'automation':
            converted.push({
              _kind: 'automation' as const,
              automation: result.automation,
            });
            break;
          case 'module':
            converted.push({
              _kind: 'module' as const,
              id: `module:${result.module.module_id}`,
              module: result.module,
            });
            break;

          case 'note':
            converted.push({
              _kind: 'workspace_item' as const,
              item: { ...result, category: 'note' } as any,
              workspace: { id: (result as any).workspaceId, workspace_id: (result as any).workspaceId },
              folder: (result as any).folderId ? { id: (result as any).folderId, folder_id: (result as any).folderId } : null,
            });
            break;

          case 'link':
            converted.push({
              _kind: 'workspace_item' as const,
              item: { ...result, category: 'link' } as any,
              workspace: { id: (result as any).workspaceId, workspace_id: (result as any).workspaceId },
              folder: (result as any).folderId ? { id: (result as any).folderId, folder_id: (result as any).folderId } : null,
            });
            break;

          case 'snippet':
            converted.push({
              _kind: 'workspace_item' as const,
              item: { ...result, category: 'snippet' } as any,
              workspace: { id: (result as any).workspaceId, workspace_id: (result as any).workspaceId },
              folder: (result as any).folderId ? { id: (result as any).folderId, folder_id: (result as any).folderId } : null,
            });
            break;

          case 'session':
            converted.push({
              _kind: 'workspace_item' as const,
              item: { ...result, category: 'session' } as any,
              workspace: { id: (result as any).workspaceId, workspace_id: (result as any).workspaceId },
              folder: (result as any).folderId ? { id: (result as any).folderId, folder_id: (result as any).folderId } : null,
            });
            break;

          case 'prompt':
            converted.push({
              _kind: 'workspace_item' as const,
              item: { ...result, category: 'aiPrompt' } as any,
              workspace: { id: (result as any).workspaceId, workspace_id: (result as any).workspaceId },
              folder: (result as any).folderId ? { id: (result as any).folderId, folder_id: (result as any).folderId } : null,
            });
            break;
          case 'agent_collection':
            converted.push({
              _kind: 'agent_collection' as const,
              title: result.title,
              itemCount: result.itemCount,
            });
            break;
        }
      }

      // De-duplicate snippets and inject shortcuts
      const snippetIds = new Set();
      const safeCommandKey = (commandKey || 'c').trim();

      const finalResults = converted.filter(item => {
        if (item._kind === 'workspace_item') {
          const sid = item.item.id || (item.item as any).snippet_id || (item.item as any).title || '';
          if (snippetIds.has(sid)) return false;
          snippetIds.add(sid);

          // Inject shortcut/hotkey info for global search results
          const category = (item.item as any).category;
          const entityId = item.item.id || (item as any).id;
          
          let prefixChar = '';
          if (category === 'note') prefixChar = customPrefixes?.note?.trim()?.toLowerCase() ?? '';
          else if (category === 'link') prefixChar = customPrefixes?.link?.trim()?.toLowerCase() ?? '';
          else if (category === 'snippet') prefixChar = customPrefixes?.snippet?.trim()?.toLowerCase() ?? '';
          else if (category === 'session') prefixChar = customPrefixes?.session?.trim()?.toLowerCase() ?? '';
          else if (category === 'aiPrompt' || category === 'ai_prompt' || category === 'prompt') prefixChar = customPrefixes?.prompt?.trim()?.toLowerCase() ?? '';
          else if (category === 'agent' || category === 'chat_agent') prefixChar = customPrefixes?.agent?.trim()?.toLowerCase() ?? '';
          else if (category === 'automation') prefixChar = customPrefixes?.automation?.trim()?.toLowerCase() ?? '';
          else if (category === 'todo') prefixChar = customPrefixes?.todo?.trim()?.toLowerCase() ?? '';

          const shortcutRecord = userDbShortcuts?.find(s => isSameSnippetIdentity(s.referenceId, entityId));
          if (shortcutRecord) {
             if (shortcutRecord.trigger) {
                (item.item as any)._displayShortcut = `${safeCommandKey} ${prefixChar ? `${prefixChar} ` : ''}${shortcutRecord.trigger}`.trim();
             } else {
                (item.item as any)._displayShortcut = `${safeCommandKey} ${prefixChar}`.trim();
             }
          }
          
          // Exclude hotkey display decoration from c space command/shortcut visual decoration
          // const hotkeyRecord = userDbHotkeys?.find(h => isSameSnippetIdentity(h.referenceId, entityId));
          // if (hotkeyRecord) {
          //    (item.item as any)._displayShortcut = `${safeCommandKey} ${prefixChar}`;
          //    (item.item as any).isHotkey = true;
          // }
        }
        return true;
      });

      

      setDebouncedFuseResults(finalResults);
    }, 300);

    return () => {
      if (fuseSearchTimeoutRef.current) {
        window.clearTimeout(fuseSearchTimeoutRef.current);
      }
    };
  }, [
    value,
    lockedCommand,
    lockedLocalDef,
    commands,

    commonCommandEntries,
    bookmarkSuggestions,
    selectedFolder,
    selectedImages.length,
    historyItems,
    isSearchFocusEnabled,
    automationSuggestions,
    agentCollectionSuggestions,
    moduleSuggestions,
    isInitialAltSFocus,
    isFocused,
  ]);

  const openUrlSuggestion = useMemo<OpenUrlSuggestionItem | null>(() => {
    const trimmed = value.trim();
    if (!trimmed || lockedCommand) return null;
    const urls = getUrlsFromQuery(trimmed);
    if (urls.length > 0) {
      return {
        _kind: 'open_url',
        url: urls.join(','),
        displayUrl: trimmed,
      };
    }
    return null;
  }, [value, lockedCommand]);

  const allSuggestions = useMemo<SuggestionListItem[]>(() => {
    if (activeCollection) {
      return [];
    }

    if (selectedAtCommand) {
      return [];
    }

    if (isBookmarksCommand(lockedCommand)) {
      return bookmarkSuggestions;
    }

    if (lockedLocalDef && lockedCommand !== 'store') {
      return localEntitySuggestions;
    }

    if (showAIHistoryPanel) {
      return [];
    }

    if (lockedCommand === 'ai' || lockedCommand === 'store') {
      return [];
    }


    if (!lockedCommand && (value.trim() || selectedImages.length > 0 || isInitialAltSFocus)) {
      if (selectedImages.length > 0) {
        return commonCommandSuggestions.filter(s => AI_GROUP.members.includes(s.id as CommandId) || s.id === 'ai');
      }

      const safeKey = (commandKey || 'c').trim().toLowerCase();
      const safeSystemKey = (customPrefixes?.system_command || 'sc').trim().toLowerCase();
      const valLower = value.toLowerCase();

      if (
        valLower.startsWith(`${safeKey} `) ||
        valLower.startsWith(`${safeSystemKey} `) ||
        valLower.startsWith('system commands') ||
        valLower.startsWith('system command') ||
        valLower.startsWith('/sc') ||
        valLower.startsWith('/c') ||
        commandSuggestions.length > 0
      ) {
        return commandSuggestions;
      }

      let results = debouncedFuseResults;
      if (openUrlSuggestion) {
        results = [openUrlSuggestion, ...results];
      }

      return results;
    }

    return [];
  }, [
    value,
    lockedCommand,
    commandSuggestions,
    lockedLocalDef,
    localEntitySuggestions,
    bookmarkSuggestions,
    openUrlSuggestion,
    selectedAtCommand,
    selectedImages,
    debouncedFuseResults,
    commonCommandSuggestions,
    showAIHistoryPanel,
    isInitialAltSFocus,
    activeCollection,
  ]);

  return {
    allSuggestions,
    historyItems,
    setHistoryItems,
    debouncedFuseResults,
    setDebouncedFuseResults,
    commandSuggestions,
    commonCommandSuggestions,
    openUrlSuggestion,
  };
}
