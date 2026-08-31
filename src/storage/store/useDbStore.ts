import { create } from 'zustand';
import { liveQuery } from 'dexie';
import { db } from '../indexDB/dbConfig';

// Import Types
import { NoteRecord } from '../../allObjectFolder/src/createObject/notes/noteTypes';
import { LinkRecord } from '../../allObjectFolder/src/createObject/links/linkTypes';

import { SnippetRecord } from '../../allObjectFolder/src/createObject/snippets/snippetTypes';
import { CommandRecord } from '../../allObjectFolder/src/createObject/commands/commandTypes';
import { TagRecord } from '../../allObjectFolder/src/createObject/tags/tagTypes';
import { FavoriteCategoryRecord } from '../../allObjectFolder/src/createObject/favoriteCategory/favoriteCategoryTypes';
import { TodoRecord } from '../../allObjectFolder/src/createObject/todos/todoTypes';
import { AutomationRecord } from '../../allObjectFolder/src/createObject/automationBeta/automationTypes';
import { ChatAgentRecord } from '../../allObjectFolder/src/createObject/ChatAgent/chatAgentTypes';
import { AiPromptRecord } from '../../allObjectFolder/src/createObject/aiPrompt/aiPromptTypes';
import { UserHotkeyRecord } from '../../shared-components/hotkeys/core/hotkeyDbTypes';
import { UserShortcutRecord } from '../../shared-components/shortcuts/core/shortcutDbTypes';
import { WorkspaceData } from '../../settings/allWorkspaceManager/workspaces/workspaceTypes';
import { FolderData } from '../../settings/allWorkspaceManager/folders/folderTypes';
import { FavoriteRecord } from '../../shared-components/favorites/favoriteTypes';
import { syncCommandsFromSource } from '../../allObjectFolder/src/createObject/commands/commandData';
import type { UpdateCommandInput } from '../../allObjectFolder/src/createObject/commands/commandTypes';
import { storageDebug } from '../../shared-components/utils/storageDebugLogger';
import { SessionRecord } from '../../allObjectFolder/src/createObject/session/sessionTypes';
import {
  normalizeCollectionLaunchSettings,
  type WidgetViewRecord,
} from '../../allObjectFolder/src/createObject/widgets/widgetTypes';
import type { PrefixSettingCategory, PrefixSettingRecord } from '../../allObjectFolder/src/createObject/prefixSettings/prefixSettingTypes';
import {
  syncPrefixSettingsFromSource,
  updatePrefixSetting as updatePrefixSettingData,
} from '../../allObjectFolder/src/createObject/prefixSettings/prefixSettingData';
import { normalizePrefix } from '../../shared-components/commands/utils';

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const ENABLE_DEXIE_STORE_PERF_LOGS = false;

const dexieStorePerf = (label: string, data?: Record<string, unknown>) => {
  if (!ENABLE_DEXIE_STORE_PERF_LOGS) return;
  if (data) {
    console.log('[NewTabPerf][DexieStore]', label, data);
  } else {
    console.log('[NewTabPerf][DexieStore]', label);
  }
};

const normalizeWidgetViewsForStore = (widgetViews: WidgetViewRecord[]): WidgetViewRecord[] => {
  const seenDefaultViews = new Set<string>();
  return [...(widgetViews || [])]
    .sort((a, b) => {
      if (!!a.isDefault !== !!b.isDefault) return a.isDefault ? -1 : 1;
      return (a.createdAt || 0) - (b.createdAt || 0);
    })
    .map(view => ({
      ...view,
      collectionLaunchSettings: normalizeCollectionLaunchSettings(view.collectionLaunchSettings),
    }))
    .filter(view => {
      if (!view?.isDefault) return true;
      const workspaceId = String(view.workspaceId || 'global');
      const title = String(view.title || '').trim().toLowerCase() || 'main dashboard';
      const key = `${workspaceId}:${title}`;
      if (seenDefaultViews.has(key)) return false;
      seenDefaultViews.add(key);
      return true;
    });
};

interface DbStoreState {
  notes: NoteRecord[];
  links: LinkRecord[];
  tags: TagRecord[];
  favoriteCategories: FavoriteCategoryRecord[];

  snippets: SnippetRecord[];
  commands: CommandRecord[];
  todos: TodoRecord[];
  automations: AutomationRecord[];
  chatAgents: ChatAgentRecord[];
  aiPrompts: AiPromptRecord[];
  workspaces: WorkspaceData[];
  folders: FolderData[];
  userHotkeys: UserHotkeyRecord[];
  userShortcuts: UserShortcutRecord[];
  favorites: FavoriteRecord[];
  hotkeysMap: Record<string, string>;
  shortcutsMap: Record<string, string>;
  isInitialized: boolean;
  widgetViews: WidgetViewRecord[];
  prefixSettings: PrefixSettingRecord[];
  
  // Method to start listening to the database
  initDbSync: () => void;

  // Flat lookup helpers for the local-first entity model
  getWorkspaceById: (workspaceId: string | null | undefined) => WorkspaceData | null;
  getFolderById: (folderId: string | null | undefined) => FolderData | null;
  getNoteById: (noteId: string | null | undefined) => NoteRecord | null;
  getLinkById: (linkId: string | null | undefined) => LinkRecord | null;
  getSnippetById: (snippetId: string | null | undefined) => SnippetRecord | null;
  getCommandById: (commandId: string | null | undefined) => CommandRecord | null;
  getSessionById: (sessionId: string | null | undefined) => SessionRecord | null;
  getFoldersByWorkspaceId: (workspaceId: string | null | undefined) => FolderData[];
  getSnippetsByWorkspaceId: (workspaceId: string | null | undefined) => SnippetRecord[];
  getNotesByWorkspaceId: (workspaceId: string | null | undefined) => NoteRecord[];
  getLinksByWorkspaceId: (workspaceId: string | null | undefined) => LinkRecord[];
  getSessionsByWorkspaceId: (workspaceId: string | null | undefined) => SessionRecord[];
  getWidgetViewsByWorkspaceId: (workspaceId: string | null | undefined) => WidgetViewRecord[];
  getPrefixSettingByCategory: (category: PrefixSettingCategory | null | undefined) => PrefixSettingRecord | null;
  getEnabledPrefixSettings: () => PrefixSettingRecord[];
  getCategoryPrefixSettings: () => PrefixSettingRecord[];
  getActionPrefixSettings: () => PrefixSettingRecord[];
  getPrefixMap: () => Record<string, string>;
  updatePrefixSettingRecord: (id: string, patch: Partial<PrefixSettingRecord>) => Promise<PrefixSettingRecord>;
  updateCommandRecord: (commandId: string, input: UpdateCommandInput & { hotkey?: string | null; keywords?: string[] | null }) => Promise<CommandRecord>;
  sessions: SessionRecord[];
}

export const useDbStore = create<DbStoreState>((set, get) => ({
  notes: [],
  links: [],
  tags: [],
  favoriteCategories: [],

  snippets: [],
  commands: [],
  todos: [],
  automations: [],
  chatAgents: [],
  aiPrompts: [],
  workspaces: [],
  folders: [],
  userHotkeys: [],
  userShortcuts: [],
  favorites: [],
  sessions: [],
  widgetViews: [],
  prefixSettings: [],
  hotkeysMap: {},
  shortcutsMap: {},
  isInitialized: false,

  getWorkspaceById: workspaceId => {
    if (!workspaceId) return null;
    return get().workspaces.find(workspace => workspace.id === workspaceId) ?? null;
  },

  getFolderById: folderId => {
    if (!folderId) return null;
    return get().folders.find(folder => folder.id === folderId) ?? null;
  },

  getNoteById: noteId => {
    if (!noteId) return null;
    return get().notes.find(note => note.id === noteId) ?? null;
  },

  getLinkById: linkId => {
    if (!linkId) return null;
    return get().links.find(link => link.id === linkId) ?? null;
  },

  getSnippetById: snippetId => {
    if (!snippetId) return null;
    return get().snippets.find(snippet => snippet.id === snippetId) ?? null;
  },

  getSessionById: sessionId => {
    if (!sessionId) return null;
    return get().sessions.find(session => session.id === sessionId) ?? null;
  },

  getCommandById: commandId => {
    if (!commandId) return null;
    return get().commands.find(command => command.id === commandId) ?? null;
  },

  getFoldersByWorkspaceId: workspaceId => {
    if (!workspaceId) return [];
    return get().folders.filter(folder => folder.workspaceId === workspaceId);
  },

  getSnippetsByWorkspaceId: workspaceId => {
    if (!workspaceId) return [];
    return get().snippets.filter(snippet => snippet.workspaceId === workspaceId);
  },

  getNotesByWorkspaceId: workspaceId => {
    if (!workspaceId) return [];
    return get().notes.filter(note => note.workspaceId === workspaceId);
  },

  getLinksByWorkspaceId: workspaceId => {
    if (!workspaceId) return [];
    return get().links.filter(link => link.workspaceId === workspaceId);
  },

  getSessionsByWorkspaceId: workspaceId => {
    if (!workspaceId) return [];
    return get().sessions.filter(session => session.workspaceId === workspaceId);
  },

  getWidgetViewsByWorkspaceId: workspaceId => {
    if (!workspaceId) return [];
    return get().widgetViews.filter(view => view.workspaceId === workspaceId);
  },

  getPrefixSettingByCategory: category => {
    if (!category) return null;
    return get().prefixSettings.find(setting => setting.category === category) ?? null;
  },

  getEnabledPrefixSettings: () => {
    return get().prefixSettings.filter(setting => setting.enabled);
  },

  getCategoryPrefixSettings: () => {
    return get().prefixSettings.filter(setting => setting.type === 'category');
  },

  getActionPrefixSettings: () => {
    return get().prefixSettings.filter(setting => setting.type === 'action');
  },

  getPrefixMap: () => {
    return get().prefixSettings.reduce<Record<string, string>>((map, setting) => {
      if (setting.enabled && setting.prefix) {
        map[setting.category] = setting.prefix;
      }
      return map;
    }, {});
  },

  updatePrefixSettingRecord: async (id, patch) => {
    return updatePrefixSettingData(id, patch as any);
  },

  updateCommandRecord: async (commandId, input) => {
    let existing = await db.commands.get(commandId);
    if (!existing) {
      await syncCommandsFromSource();
      existing = await db.commands.get(commandId);
    }

    if (!existing) {
      throw new Error(`Command ${commandId} not found.`);
    }

    const nextRecord: CommandRecord = {
      ...existing,
      label: input.label !== undefined ? input.label.trim() : existing.label,
      prefix: input.prefix !== undefined ? normalizePrefix(input.prefix) : existing.prefix,
      behavior: input.behavior ?? existing.behavior,
      surface: input.surface !== undefined ? input.surface : existing.surface,
      site: input.site !== undefined ? input.site : existing.site,
      pageType: input.pageType !== undefined ? input.pageType : existing.pageType,
      iconHost: input.iconHost !== undefined ? input.iconHost : existing.iconHost,
      icon: input.icon !== undefined ? input.icon : existing.icon,
      category: input.category !== undefined ? input.category : existing.category,
      type: input.type !== undefined ? input.type : existing.type,
      urlTemplate: input.urlTemplate !== undefined ? input.urlTemplate : existing.urlTemplate,
      enabled: input.enabled ?? existing.enabled,
      updatedAt: Date.now(),
      ...(input.hotkey !== undefined ? { hotkey: input.hotkey } : {}),
      ...(input.keywords !== undefined ? { keywords: input.keywords } : {}),
    } as any;

    await db.commands.put(nextRecord as any);
    return nextRecord;
  },

  initDbSync: () => {
    if (get().isInitialized) {
      storageDebug.log('useDbStore.initDbSync', 'Skipped because DB sync is already initialized');
      dexieStorePerf('initDbSync:skipped');
      return;
    }
    
    const startedAt = performance.now();
    dexieStorePerf('initDbSync:start');
    set({ isInitialized: true });
    storageDebug.log('useDbStore.initDbSync', 'Starting Dexie liveQuery subscriptions');

    const notifyDbChanged = (table: string) => {
      try {
        const chromeAny = (window as any).chrome;
        if (chromeAny?.runtime?.sendMessage) {
          chromeAny.runtime.sendMessage({ action: 'db_changed', table }).catch(() => {});
        }
      } catch (err) {
        // Safe catch for environment differences
      }
    };

    syncCommandsFromSource().catch(err => {
      console.error('Failed to sync commands to Dexie:', err);
      storageDebug.error('useDbStore.syncCommandsFromSource', 'Failed to sync commands to Dexie', err);
    });

    syncPrefixSettingsFromSource().catch(err => {
      console.error('Failed to sync prefix settings to Dexie:', err);
      storageDebug.error('useDbStore.syncPrefixSettingsFromSource', 'Failed to sync prefix settings to Dexie', err);
    });

    // Subscribe to Dexie changes and push them to Zustand
    let isInitNotes = true;
    liveQuery(() => db.notes.toArray()).subscribe((notes) => {
      storageDebug.log('useDbStore.liveQuery.notes', 'Dexie emitted notes', { count: notes.length });
      set(state => {
        if (sameJson(state.notes, notes)) return state;
        if (!isInitNotes) notifyDbChanged('notes');
        isInitNotes = false;
        return { notes };
      });
    });

    let isInitLinks = true;
    liveQuery(() => db.links.toArray()).subscribe((links) => {
      storageDebug.log('useDbStore.liveQuery.links', 'Dexie emitted links', { count: links.length });
      set(state => {
        if (sameJson(state.links, links)) return state;
        if (!isInitLinks) notifyDbChanged('links');
        isInitLinks = false;
        return { links };
      });
    });

    let isInitTags = true;
    liveQuery(() => db.tags.toArray()).subscribe((tags) => {
      storageDebug.log('useDbStore.liveQuery.tags', 'Dexie emitted tags', { count: tags.length });
      set(state => {
        if (sameJson(state.tags, tags)) return state;
        if (!isInitTags) notifyDbChanged('tags');
        isInitTags = false;
        return { tags };
      });
    });

    let isInitFavoriteCategories = true;
    liveQuery(() => db.favoriteCategories.toArray()).subscribe((favoriteCategories) => {
      storageDebug.log('useDbStore.liveQuery.favoriteCategories', 'Dexie emitted favorite categories', {
        count: favoriteCategories.length,
      });
      set(state => {
        if (sameJson(state.favoriteCategories, favoriteCategories)) return state;
        if (!isInitFavoriteCategories) notifyDbChanged('favoriteCategories');
        isInitFavoriteCategories = false;
        return { favoriteCategories };
      });
    });

    let isInitSnippets = true;
    liveQuery(() => db.snippets.toArray()).subscribe((snippets) => {
      storageDebug.log('useDbStore.liveQuery.snippets', 'Dexie emitted snippets', { count: snippets.length });
      set(state => {
        if (sameJson(state.snippets, snippets)) return state;
        if (!isInitSnippets) notifyDbChanged('snippets');
        isInitSnippets = false;
        return { snippets };
      });
      try {
        const chromeAny = (window as any).chrome;
        if (chromeAny?.storage?.local) {
          const localAstsRecord: Record<string, any> = {};
          snippets.forEach(s => {
            localAstsRecord[s.id] = {
              snippet_id: s.id,
              key: s.title,
              value: typeof s.config === 'string' ? s.config : JSON.stringify(s.config),
              config: s.config,
              tags: s.tagIds,
              category: 'snippet'
            };
          });
          chromeAny.storage.local.get(['local_ast_snippets'], (result: { local_ast_snippets?: Record<string, any> }) => {
            if (!sameJson(result.local_ast_snippets ?? {}, localAstsRecord)) {
              chromeAny.storage.local.set({ local_ast_snippets: localAstsRecord });
            }
          });
        }
      } catch (e) {
        console.error('Failed to sync snippets to chrome.storage.local:', e);
        storageDebug.error('useDbStore.liveQuery.snippets', 'Failed to mirror snippets into chrome.storage.local', e);
      }
    });

    let isInitCommands = true;
    liveQuery(() => db.commands.toArray()).subscribe((commands) => {
      storageDebug.log('useDbStore.liveQuery.commands', 'Dexie emitted commands', { count: commands.length });
      set(state => {
        if (sameJson(state.commands, commands)) return state;
        if (!isInitCommands) notifyDbChanged('commands');
        isInitCommands = false;
        return { commands };
      });
    });

    let isInitPrefixSettings = true;
    liveQuery(() => db.prefixSettings.toArray()).subscribe(prefixSettings => {
      storageDebug.log('useDbStore.liveQuery.prefixSettings', 'Dexie emitted prefix settings', {
        count: prefixSettings.length,
      });
      set(state => {
        if (sameJson(state.prefixSettings, prefixSettings)) return state;
        if (!isInitPrefixSettings) notifyDbChanged('prefixSettings');
        isInitPrefixSettings = false;
        return { prefixSettings };
      });
    });

    let isInitTodos = true;
    liveQuery(() => db.todos.toArray()).subscribe((todos) => {
      storageDebug.log('useDbStore.liveQuery.todos', 'Dexie emitted todos', { count: todos.length });
      set(state => {
        if (sameJson(state.todos, todos)) return state;
        if (!isInitTodos) notifyDbChanged('todos');
        isInitTodos = false;
        return { todos };
      });
    });

    let isInitAutomations = true;
    liveQuery(() => db.automations.toArray()).subscribe((automations) => {
      storageDebug.log('useDbStore.liveQuery.automations', 'Dexie emitted automations', { count: automations.length });
      set(state => {
        if (sameJson(state.automations, automations)) return state;
        if (!isInitAutomations) notifyDbChanged('automations');
        isInitAutomations = false;
        return { automations };
      });
    });

    let isInitChatAgents = true;
    liveQuery(() => db.chatAgents.toArray()).subscribe((chatAgents) => {
      storageDebug.log('useDbStore.liveQuery.chatAgents', 'Dexie emitted chat agents', { count: chatAgents.length });
      set(state => {
        if (sameJson(state.chatAgents, chatAgents)) return state;
        if (!isInitChatAgents) notifyDbChanged('chatAgents');
        isInitChatAgents = false;
        return { chatAgents };
      });
    });

    let isInitAiPrompts = true;
    liveQuery(() => db.aiPrompts.toArray()).subscribe((aiPrompts) => {
      storageDebug.log('useDbStore.liveQuery.aiPrompts', 'Dexie emitted AI prompts', { count: aiPrompts.length });
      set(state => {
        if (sameJson(state.aiPrompts, aiPrompts)) return state;
        if (!isInitAiPrompts) notifyDbChanged('aiPrompts');
        isInitAiPrompts = false;
        return { aiPrompts };
      });
    });

    let isInitWorkspaces = true;
    liveQuery(() => db.workspaces.toArray()).subscribe((workspaces) => {
      storageDebug.log('useDbStore.liveQuery.workspaces', 'Dexie emitted workspaces', {
        count: workspaces.length,
        ids: workspaces.map(workspace => workspace.id),
      });
      set(state => {
        if (sameJson(state.workspaces, workspaces)) return state;
        if (!isInitWorkspaces) notifyDbChanged('workspaces');
        isInitWorkspaces = false;
        return { workspaces };
      });
    });

    let isInitFolders = true;
    liveQuery(() => db.folders.toArray()).subscribe((folders) => {
      storageDebug.log('useDbStore.liveQuery.folders', 'Dexie emitted folders', {
        count: folders.length,
        ids: folders.map(folder => folder.id),
        workspaceIds: Array.from(new Set(folders.map(folder => folder.workspaceId))),
      });
      set(state => {
        if (sameJson(state.folders, folders)) return state;
        if (!isInitFolders) notifyDbChanged('folders');
        isInitFolders = false;
        return { folders };
      });
    });

    let isInitFavorites = true;
    liveQuery(() => db.favorites.toArray()).subscribe((favorites) => {
      storageDebug.log('useDbStore.liveQuery.favorites', 'Dexie emitted favorites', { count: favorites.length });
      set(state => {
        if (sameJson(state.favorites, favorites)) return state;
        if (!isInitFavorites) notifyDbChanged('favorites');
        isInitFavorites = false;
        return { favorites };
      });
    });

    let isInitUserHotkeys = true;
    liveQuery(() => db.userHotkeys.toArray()).subscribe((userHotkeys) => {
      storageDebug.log('useDbStore.liveQuery.userHotkeys', 'Dexie emitted user hotkeys', { count: userHotkeys.length });
      const map: Record<string, string> = {};
      userHotkeys.forEach(hk => {
        map[hk.referenceId] = hk.combination;
      });
      set(state => {
        const changed = !sameJson(state.userHotkeys, userHotkeys) || !sameJson(state.hotkeysMap, map);
        if (changed && !isInitUserHotkeys) notifyDbChanged('userHotkeys');
        isInitUserHotkeys = false;
        return changed ? { userHotkeys, hotkeysMap: map } : state;
      });
    });
    
    let isInitUserShortcuts = true;
    liveQuery(() => db.userShortcuts.toArray()).subscribe((userShortcuts) => {
      storageDebug.log('useDbStore.liveQuery.userShortcuts', 'Dexie emitted user shortcuts', { count: userShortcuts.length });
      const map: Record<string, string> = {};
      userShortcuts.forEach(sc => {
        map[sc.referenceId] = sc.trigger;
      });
      set(state => {
        const changed = !sameJson(state.userShortcuts, userShortcuts) || !sameJson(state.shortcutsMap, map);
        if (changed && !isInitUserShortcuts) notifyDbChanged('userShortcuts');
        isInitUserShortcuts = false;
        return changed ? { userShortcuts, shortcutsMap: map } : state;
      });
    });

    let isInitSessions = true;
    liveQuery(() => db.sessions.toArray()).subscribe((sessions) => {
      storageDebug.log('useDbStore.liveQuery.sessions', 'Dexie emitted sessions', { count: sessions.length });
      set(state => {
        if (sameJson(state.sessions, sessions)) return state;
        if (!isInitSessions) notifyDbChanged('sessions');
        isInitSessions = false;
        return { sessions };
      });
    });

    let isInitWidgetViews = true;
    liveQuery(() => db.widgetViews.toArray()).subscribe((widgetViews) => {
      const normalizedWidgetViews = normalizeWidgetViewsForStore(widgetViews);
      storageDebug.log('useDbStore.liveQuery.widgetViews', 'Dexie emitted widget views', {
        count: normalizedWidgetViews.length,
        rawCount: widgetViews.length,
      });
      set(state => {
        if (sameJson(state.widgetViews, normalizedWidgetViews)) return state;
        if (!isInitWidgetViews) notifyDbChanged('widgetViews');
        isInitWidgetViews = false;
        return { widgetViews: normalizedWidgetViews };
      });
    });

    dexieStorePerf('initDbSync:subscriptionsRegistered', {
      durationMs: Math.round(performance.now() - startedAt),
    });
  }
}));
