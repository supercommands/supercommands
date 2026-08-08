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
  }
}

export const db = new CmdOSDatabase();

if (typeof indexedDB !== 'undefined') {
  // Open the database immediately so it creates the schema and is visible in Chrome DevTools
  db.open().catch(err => {
    console.error('[Dexie] Failed to open database cmdOS:', err);
  });
}

export async function deleteItemAssociations(itemId: string): Promise<void> {
  if (!itemId) return;
  try {
    // 1. Delete matching favorites (reference_id matches itemId, or ends with itemId)
    const favsToDelete = await db.favorites
      .filter(f => f.reference_id === itemId || f.reference_id.endsWith(`-${itemId}`))
      .toArray();
    if (favsToDelete.length > 0) {
      await db.favorites.bulkDelete(favsToDelete.map(f => f.id));
    }

    // 2. Delete matching hotkeys (referenceId matches itemId, or ends with itemId)
    const hotkeysToDelete = await db.userHotkeys
      .filter(hk => hk.referenceId === itemId || hk.referenceId.endsWith(`-${itemId}`))
      .toArray();
    if (hotkeysToDelete.length > 0) {
      await db.userHotkeys.bulkDelete(hotkeysToDelete.map(h => h.id));
    }

    // 3. Delete matching shortcuts (referenceId matches itemId, or ends with itemId)
    const shortcutsToDelete = await db.userShortcuts
      .filter(sc => sc.referenceId === itemId || sc.referenceId.endsWith(`-${itemId}`))
      .toArray();
    if (shortcutsToDelete.length > 0) {
      await db.userShortcuts.bulkDelete(shortcutsToDelete.map(s => s.id));
    }
  } catch (error) {
    console.error(`[dbConfig.deleteItemAssociations] Failed for ${itemId}:`, error);
  }
}
