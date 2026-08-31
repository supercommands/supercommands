import Dexie, { type Table } from 'dexie';
import type { WorkspaceData } from '../../settings/allWorkspaceManager/workspaces/workspaceTypes';
import type { FolderData } from '../../settings/allWorkspaceManager/folders/folderTypes';
import type { NoteRecord } from '../../allObjectFolder/src/createObject/notes/noteTypes';
import type { LinkRecord } from '../../allObjectFolder/src/createObject/links/linkTypes';
import type { AutomationRecord } from '../../allObjectFolder/src/createObject/automationBeta/automationTypes';
import type { ChatAgentRecord } from '../../allObjectFolder/src/createObject/ChatAgent/chatAgentTypes';
import type { AiPromptRecord } from '../../allObjectFolder/src/createObject/aiPrompt/aiPromptTypes';
import type { SnippetRecord } from '../../allObjectFolder/src/createObject/snippets/snippetTypes';
import type { TodoRecord } from '../../allObjectFolder/src/createObject/todos/todoTypes';
import type { TagRecord } from '../../allObjectFolder/src/createObject/tags/tagTypes';
import type { FavoriteCategoryRecord } from '../../allObjectFolder/src/createObject/favoriteCategory/favoriteCategoryTypes';

import type { UserHotkeyRecord } from '../../shared-components/hotkeys/core/hotkeyDbTypes';
import type { UserShortcutRecord } from '../../shared-components/shortcuts/core/shortcutDbTypes';
import type {
  TriggerDailyBreakdownRecord,
  TriggerDailySummaryRecord,
} from '../../shared-components/triggers/types';
import type { FavoriteRecord } from '../../shared-components/favorites/favoriteTypes';
import type { CommandRecord } from '../../allObjectFolder/src/createObject/commands/commandTypes';
import type { SessionRecord } from '../../allObjectFolder/src/createObject/session/sessionTypes';
import type { AssetRecord } from '../assets/assetTypes';
import {
  normalizeCollectionLaunchSettings,
  type WidgetRecord,
  type WidgetLayoutRecord,
  type WidgetViewRecord,
} from '../../allObjectFolder/src/createObject/widgets/widgetTypes';
import type { PrefixSettingRecord } from '../../allObjectFolder/src/createObject/prefixSettings/prefixSettingTypes';

export class CmdOSDatabase extends Dexie {
  workspaces!: Table<WorkspaceData, string>;
  folders!: Table<FolderData, string>;
  notes!: Table<NoteRecord, string>;
  links!: Table<LinkRecord, string>;
  automations!: Table<AutomationRecord, string>;
  chatAgents!: Table<ChatAgentRecord, string>;
  aiPrompts!: Table<AiPromptRecord, string>;
  snippets!: Table<SnippetRecord, string>;
  todos!: Table<TodoRecord, string>;
  tags!: Table<TagRecord, string>;
  favoriteCategories!: Table<FavoriteCategoryRecord, string>;
  userHotkeys!: Table<UserHotkeyRecord, string>;
  userShortcuts!: Table<UserShortcutRecord, string>;
  triggerDailySummary!: Table<TriggerDailySummaryRecord, string>;
  triggerDailyBreakdown!: Table<TriggerDailyBreakdownRecord, string>;
  favorites!: Table<FavoriteRecord, string>;
  commands!: Table<CommandRecord, string>;
  sessions!: Table<SessionRecord, string>;
  assets!: Table<AssetRecord, string>;
  widgets!: Table<WidgetRecord, string>;
  widgetLayouts!: Table<WidgetLayoutRecord, string>;
  widgetViews!: Table<WidgetViewRecord, string>;
  prefixSettings!: Table<PrefixSettingRecord, string>;

  constructor() {
    super('cmdOS');

    this.version(1).stores({
      workspaces: 'id, workspaceName, updatedAt',
      folders: 'id, workspaceId, folderName, updatedAt',
      notes: 'id, workspaceId, folderId, updatedAt, [workspaceId+updatedAt], [workspaceId+folderId]',
      links: 'id, workspaceId, folderId, updatedAt, [workspaceId+updatedAt], [workspaceId+folderId]',
      automations: 'id, workspaceId, folderId, updatedAt, [workspaceId+updatedAt], [workspaceId+folderId]',
      snippets: 'id, workspaceId, folderId, updatedAt, [workspaceId+updatedAt], [workspaceId+folderId]',
      chatAgents: 'id, workspaceId, folderId, updatedAt, [workspaceId+updatedAt], [workspaceId+folderId]',
      aiPrompts: 'id, workspaceId, folderId, updatedAt, [workspaceId+updatedAt], [workspaceId+folderId]',
      todos: 'id, scheduleTime, updatedAt',
      tags: 'id, workspaceId, name, updatedAt, [workspaceId+updatedAt]',
      favoriteCategories: 'id, userId, name, updatedAt, [userId+updatedAt]',
      userHotkeys: 'id, userId, combination, referenceId, referenceType, updatedAt',
      userShortcuts: 'id, userId, trigger, referenceId, referenceType, updatedAt',
      favorites:
        'id, user_id, reference_id, reference_type, favoriteCategoryId, updatedAt, [user_id+reference_id], [user_id+favoriteCategoryId], [user_id+updatedAt]',
      commands: 'id, prefix, label, behavior, surface, enabled, updatedAt',
    });

    this.version(2).stores({
      notes:
        'id, workspaceId, folderId, updatedAt, [workspaceId+updatedAt], [workspaceId+folderId], [workspaceId+folderId+updatedAt]',
    });

    this.version(3).stores({
      sessions: 'id, workspaceId, folderId, updatedAt, [workspaceId+updatedAt], [workspaceId+folderId]',
    });

    this.version(4).stores({
      favoriteCategories: 'id, userId, name, updatedAt, [userId+updatedAt]',
    });

    this.version(5)
      .stores({
        favoriteCategories: 'id, userId, name, updatedAt, [userId+updatedAt]',
      })
      .upgrade(async tx => {
        await tx
          .table('favoriteCategories')
          .toCollection()
          .modify((cat: any) => {
            if (!cat.userId && cat.workspaceId) {
              cat.userId = cat.workspaceId;
            }
            delete cat.workspaceId;
          });
      });

    this.version(6)
      .stores({
        favorites:
          'id, user_id, reference_id, reference_type, favoriteCategoryId, updatedAt, [user_id+reference_id], [user_id+favoriteCategoryId], [user_id+updatedAt]',
      })
      .upgrade(async tx => {
        await tx
          .table('favorites')
          .toCollection()
          .modify((fav: any) => {
            if (fav.favoriteCategoryId === undefined) {
              fav.favoriteCategoryId = null;
            }
          });
      });

    this.version(7)
      .stores({
        notes:
          'id, workspaceId, folderId, updatedAt, [workspaceId+updatedAt], [workspaceId+folderId], [workspaceId+folderId+updatedAt], *assetIds',
        assets: 'id, hash, createdAt, pendingDeletionAt',
      })
      .upgrade(async tx => {
        await tx
          .table('notes')
          .toCollection()
          .modify((note: any) => {
            if (!note.assetIds) {
              note.assetIds = [];
            }
          });
      });

    // incorporate notes version history
    this.version(8).upgrade(async tx => {
      await tx
        .table('notes')
        .toCollection()
        .modify((note: any) => {
          if (!note.versionHistory) {
            note.versionHistory = {
              lastSavedText: note.body || '',
              historyBuffer: [],
              lastCheckpointAt: note.updatedAt || Date.now(),
            };
          }
        });
    });

    // incorporate structured version history for todos, snippets, links, sessions
    this.version(9).upgrade(async tx => {
      const initVersionHistory = (record: any) => {
        if (!record.versionHistory) {
          record.versionHistory = {
            schemaVersion: 1,
            lastCheckpointAt: record.updatedAt || record.createdAt || Date.now(),
            versions: [],
          };
        }
      };

      await tx.table('todos').toCollection().modify(initVersionHistory);
      await tx.table('snippets').toCollection().modify(initVersionHistory);
      await tx.table('links').toCollection().modify(initVersionHistory);
      await tx.table('sessions').toCollection().modify(initVersionHistory);
    });

    this.version(10).stores({
      triggerDailySummary: 'id, [userId+dateKey], dateKey, userId',
      triggerDailyBreakdown:
        'id, [userId+dateKey], [userId+referenceId+dateKey], [userId+triggerKind+triggerValue+dateKey], [userId+triggerKind+dateKey]',
    });

    this.version(11)
      .stores({
        favoriteCategories:
          'id, user_id, userId, name, createdAt, updatedAt, [userId+name], [user_id+name]',
        favorites:
          'id, user_id, reference_id, reference_type, favoriteCategoryId, updatedAt, [user_id+reference_id], [user_id+updatedAt], [user_id+favoriteCategoryId]',
      })
      .upgrade(async tx => {
        await tx
          .table('favoriteCategories')
          .toCollection()
          .modify((group: any) => {
            if (!Array.isArray(group.filterTagIds)) {
              group.filterTagIds = [];
            }
          });
      });

    this.version(12).stores({
      widgets:
        'id, workspaceId, viewId, type, referenceId, referenceType, updatedAt, [workspaceId+updatedAt], [workspaceId+viewId], [referenceType+referenceId]',
      widgetLayouts:
        'id, workspaceId, viewId, widgetId, updatedAt, [workspaceId+viewId], [workspaceId+updatedAt]',
      widgetViews: 'id, workspaceId, isDefault, updatedAt, [workspaceId+updatedAt]',
    });

    this.version(13).stores({
      prefixSettings: 'id, prefix, category, scope, targetType, enabled, updatedAt',
    });

    this.version(14)
      .stores({
        prefixSettings: 'id, prefix, category, enabled, updatedAt',
      })
      .upgrade(async tx => {
        await tx
          .table('prefixSettings')
          .toCollection()
          .modify((setting: any) => {
            delete setting.scope;
            delete setting.workspaceId;
            delete setting.siteHost;
            delete setting.targetType;
            delete setting.system;
            delete setting.settings;
          });
      });

    this.version(15)
      .stores({
        prefixSettings: 'id, type, prefix, category, enabled, updatedAt',
      })
      .upgrade(async tx => {
        const actionKeys = new Set([
          'capture_screenshot',
          'capture_clip_screenshot',
          'capture_full_screenshot',
          'capture_element_screenshot',
          'downloadallimages',
          'downloadalltables',
          'save_link',
          'save_todo',
          'save_note',
          'save_snippet',
          'save_chat',
          'add_to_existing',
          'send_to_agent',
          'summarize_page',
          'merge_windows',
          'close_duplicate_tabs',
          'mute_all_tabs',
          'unmute_all_tabs',
        ]);
        await tx
          .table('prefixSettings')
          .toCollection()
          .modify((setting: any) => {
            setting.type = actionKeys.has(setting.category) ? 'action' : 'category';
          });
      });

    this.version(16).upgrade(async tx => {
      await tx
        .table('widgetViews')
        .toCollection()
        .modify((view: any) => {
          view.collectionLaunchSettings = normalizeCollectionLaunchSettings(view.collectionLaunchSettings);
          delete view.collectionLaunchSettings.saveBehavior;
        });
    });
  }
}

export const db = new CmdOSDatabase();

import { migrateWidgetsFromLocalStorageToDexie } from './migrateWidgetsToDexie';
import { migratePrefixSettingsFromLocalStorageToDexie } from '../../allObjectFolder/src/createObject/prefixSettings/prefixSettingData';

if (typeof indexedDB !== 'undefined') {
  // Open the database immediately so it creates the schema and is visible in Chrome DevTools
  db.open()
    .then(() => {
      void migrateWidgetsFromLocalStorageToDexie().catch(err => {
        console.error('[Dexie] Widget migration failed:', err);
      });
      void migratePrefixSettingsFromLocalStorageToDexie().catch(err => {
        console.error('[Dexie] Prefix settings migration failed:', err);
      });
    })
    .catch(err => {
      console.error('[Dexie] Failed to open database cmdOS:', err);
    });
}

export async function deleteItemAssociations(itemId: string): Promise<void> {
  if (!itemId) return;
  try {
    const [favsToDelete, hotkeysToDelete, shortcutsToDelete, refWidgets, filteredWidgets] = await Promise.all([
      db.favorites.filter(f => f.reference_id === itemId || f.reference_id.endsWith(`-${itemId}`)).toArray(),
      db.userHotkeys.filter(hk => hk.referenceId === itemId || hk.referenceId.endsWith(`-${itemId}`)).toArray(),
      db.userShortcuts.filter(sc => sc.referenceId === itemId || sc.referenceId.endsWith(`-${itemId}`)).toArray(),
      db.widgets.where('referenceId').equals(itemId).toArray(),
      db.widgets.filter(w => (w as any).noteId === itemId || (w as any).sessionId === itemId || (w as any).linkId === itemId).toArray(),
    ]);

    const widgetMap = new Map<string, any>();
    refWidgets.forEach(w => widgetMap.set(w.id, w));
    filteredWidgets.forEach(w => widgetMap.set(w.id, w));
    const widgetIds = Array.from(widgetMap.keys());

    const cleanupPromises: Promise<any>[] = [];

    if (favsToDelete.length > 0) {
      cleanupPromises.push(
        db.favorites.bulkDelete(favsToDelete.map(f => f.id)).then(() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('favoritesUpdated'));
            window.dispatchEvent(new CustomEvent('favorites-changed'));
          }
        })
      );
    }
    if (hotkeysToDelete.length > 0) {
      cleanupPromises.push(
        db.userHotkeys.bulkDelete(hotkeysToDelete.map(h => h.id)).then(() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('hotkeysUpdated'));
            window.dispatchEvent(new CustomEvent('hotkey-changed'));
          }
        })
      );
    }
    if (shortcutsToDelete.length > 0) {
      cleanupPromises.push(
        db.userShortcuts.bulkDelete(shortcutsToDelete.map(s => s.id)).then(() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('shortcutsUpdated'));
            window.dispatchEvent(new CustomEvent('shortcut-changed'));
          }
        })
      );
    }
    if (widgetIds.length > 0) {
      cleanupPromises.push(
        db.transaction('rw', [db.widgets, db.widgetLayouts], async () => {
          await db.widgets.bulkDelete(widgetIds);
          await db.widgetLayouts.bulkDelete(widgetIds);
        }).then(() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('widget-dashboard-layout-change'));
          }
        })
      );
    }

    await Promise.all(cleanupPromises);
  } catch (error) {
    console.error(`[dbConfig.deleteItemAssociations] Failed for ${itemId}:`, error);
  }
}
