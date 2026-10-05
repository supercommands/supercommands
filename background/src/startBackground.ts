import { handleCollectionMessage } from './collections/collectionBridgeHandler';
import { handleTagImageMessage } from './tags/tagImageBridgeHandler';
import { handleCollectionScreenshotCapture } from './collections/collectionScreenshotCaptureHandler';
import { NEW_TAB_SCREENSHOT_SHORTCUT_RETRY } from '../../src/shared-components/websitePopup/contracts/websitePopupScreenshotBridgeContract';
import { handleWorkspaceMessage } from './browserWindows/workspaceBridgeHandler';
import { broadcastWebsitePopupEntityChanges, registerWebsitePopupBookmarkInvalidation } from './websitePopupBridge/broadcastWebsitePopupChanges';
import { sendWebsitePopupToggle } from './websitePopupBridge/websitePopupTabRuntime';
import 'webextension-polyfill';
import { handleTodoAlarm } from '@todos/todos';
import { setupContextMenus, attachContextMenuListeners } from '@chatAgents/contextMenus';
import { CMDOS_INSTALL_URL } from '@config/apiConfig';
import { BRAND } from '../../src/shared-components/brandingConfig';
import { setupOmnibox } from './commandTerminal/omnibox/omniboxEvents';
import { backgroundSync, handleTodoMessage, findTodoById } from '@todos/todos';
import { handleNotificationClick } from '@notifications/notifications';
import { db } from '../../src/storage/indexDB/dbConfig';
import { createChatAgent, updateChatAgent } from '../../src/allObjectFolder/src/createObject/ChatAgent/chatAgentData';
import { createAiPrompt, updateAiPrompt } from '../../src/allObjectFolder/src/createObject/aiPrompt/aiPromptData';
import { updateSession } from '../../src/allObjectFolder/src/createObject/session/sessionData';
import {
  addFavoriteRecord,
  removeFavoriteRecord,
  toggleFavoriteRecord,
} from '../../src/shared-components/favorites/favoriteData';
import { createTag, deleteTag, updateTag } from '../../src/allObjectFolder/src/createObject/tags/tagData';
import { saveUserHotkey, deleteUserHotkeyByReference } from '../../src/shared-components/hotkeys/core/hotkeyDbData';
import {
  getAllUserShortcuts,
  saveUserShortcut,
  deleteUserShortcutByReference,
} from '../../src/shared-components/shortcuts/core/shortcutDbData';
import { clearHotkey as apiClearHotkey, saveHotkey as apiSaveHotkey } from '../../src/shared-components/hotkeys';
import {
  clearShortcut as apiClearShortcut,
  saveShortcut as apiSaveShortcut,
} from '../../src/shared-components/shortcuts';
import {
  addWidgetInstanceAsync,
  createWidgetDashboardViewAsync,
} from '../../src/storage/localStorage/widgetDashboardStorage';
import {
  handleSessionMessage,
  activeSessions,
  persistActiveSessions,
  saveSessionToDb,
  syncFocusSessionTabs,
  refreshDeepFocusForRelevantTabs,
  handleDeepFocusNavigation,
  handleDeepFocusTabCreated,
  handleDeepFocusWindowCreated,
  registerSessionControlPort,
  isTrackableSessionAutosaveUrl,
  getTrackableSessionAutosaveTabUrl,
  getValidatedActiveSessionForWindow,
  stopActiveSessionRuntimeForWindow,
  isSessionControlTabUrl,
} from '@browserWindows/sessions';
import {
  pendingAiSessions,
  pendingAutoSubmitTabs,
  tabPromptQueues,
  processingTabs,
  ensureStateRestored,
  processTabQueue,
  executeAutoSubmit,
  handleAiMessage,
} from '@chatAgents/runtimeExecutionEngine';
import type { PendingAiSession } from '@chatAgents/runtimeExecutionEngine';
import { handleBrowserWindowMessage } from '@browserWindows/index';
import { setupWindowManager } from './all_PreBuilt_Commands/system/windowManager';
import { handleSearchMessage } from '@browserData/index';
import { handleHotkeyMessage, invalidateHotkeysCache } from '@hotkeys/hotkeys';
import { generateEntityId } from '../../src/shared-components/utils/idGenerator';
import {
  createInitialHistory,
  upsertVersionForChange,
} from '../../src/shared-components/versionHistory/structuredVersionHistory';
import { handleExtractorMessage } from '@preBuiltCommands/extraction/index';
import { handleNewTodoAlarm } from './todos/newTodos';
import { handleBackupAlarm, reconcileAutoBackupAlarm } from '../../src/settings/backup/logic/scheduler';
import {
  getPrefixes,
  setPrefixes,
  syncPrefixSettingsFromSource,
  type CommandTerminalPrefixes,
} from '../../src/allObjectFolder/src/createObject/prefixSettings/prefixSettingData';
import { handleWebsitePopupPrefixSettingsBridgeMessage } from './websitePopupBridge/prefixSettingsBridgeHandler';
import {
  clearWebsitePopupHotkeyCaptureForTab,
  handleWebsitePopupHotkeyBridgeMessage,
  isWebsitePopupHotkeyCaptureActive,
} from './websitePopupBridge/websitePopupHotkeyBridgeHandler';
import { handleWebsitePopupSearchBridgeMessage } from './websitePopupBridge/searchBridgeHandler';
import { handleWebsitePopupExecutionBridgeMessage } from './websitePopupBridge/executionBridgeHandler';
import { handleWebsitePopupCreateOptionsBridgeMessage } from './websitePopupBridge/createOptionsBridgeHandler';
import { handleWebsitePopupTextCommandBridgeMessage } from './websitePopupBridge/textCommandBridgeHandler';

const LEGACY_AUTOMATION_STORAGE_KEYS = [
  'automations',
  'saved_automations',
  'installed_modules',
  'modules_metadata',
  'automation_recording_state',
  'pending_automation_state',
  'automation_recorded_selector',
  'automation_draft_steps_count',
  'active_automation_status',
  'stop_automation_requested',
  'alts_automation_hotkeys',
  'alts_automation_shortcuts',
  'alts_module_hotkeys',
  'last_module_fetch_timestamp',
];

const getTodoReferenceDisplayName = (ref: any): string => {
  const data = ref?.data || {};
  const value = ref?.value ?? data?.value;
  const directName =
    ref?.name ||
    ref?.title ||
    ref?.key ||
    ref?.label ||
    ref?.prefix ||
    data?.name ||
    data?.title ||
    data?.key ||
    data?.label ||
    data?.prefix ||
    data?.sessionName;

  if (directName) return String(directName);

  if (value && typeof value === 'object') {
    if (Array.isArray(value.names) && value.names.length > 0) return String(value.names[0]);
    if (Array.isArray(value.urls) && value.urls.length > 0) return String(value.urls[0]);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed?.names) && parsed.names.length > 0) return String(parsed.names[0]);
        if (Array.isArray(parsed?.urls) && parsed.urls.length > 0) return String(parsed.urls[0]);
      } catch {
        // Fall back to the reference category name below.
      }
    }
  }

  const category = String(ref?.type || ref?.category || data?.category || '').toLowerCase();
  if (category === 'note') return 'Saved note';
  if (category === 'snippet') return 'Saved snippet';
  if (category === 'link') return 'Saved link';
  if (category === 'command') return 'Saved command';
  if (category === 'agent' || category === 'chat_agent') return 'Saved agent';
  if (category === 'prompt' || category === 'aiprompt' || category === 'ai_prompt') return 'Saved prompt';
  if (category === 'tabgroup' || category === 'session') return 'Saved session';
  return 'Saved item';
};

const mapTodoReferencesForBackground = (references: any[] = []) =>
  references.map((ref: any) => ({
    id: String(ref.id || ref.value || ref.snippet_id || ref.data?.id || ''),
    type: ref.type || ref.category || ref.data?.category || 'note',
    name: getTodoReferenceDisplayName(ref),
  }));

const extractTodoSnapshotForBackground = (todo: any) => ({
  name: todo.name,
  description: todo.description,
  references: todo.references || [],
  isDone: !!todo.isDone,
  scheduleType: todo.scheduleType,
  recurringType: todo.recurringType,
  scheduleTime: todo.scheduleTime,
  tags: todo.tags,
  tagIds: todo.tagIds,
  shortcut: todo.shortcut,
  organisationId: todo.organisationId,
  
});

import { reconcileTodoAlarms } from '@notifications/notificationService';
import { initializeNotificationDelivery } from '@notifications/notificationDeliveryService';
import { initializeBackupRestoreRecovery } from '../../src/settings/backup/logic/backupRestoreJournal';

let hasStarted = false;
export function startBackground() {
  if (hasStarted) return;
  hasStarted = true;

  setupWindowManager();
  reconcileAutoBackupAlarm();
  cleanupStaleNewTabFocusKeys();
  cleanupLegacyAutomationStorageKeys();
  void reconcileTodoAlarms();
  void initializeNotificationDelivery();
  initializeBackupRestoreRecovery();

  /**
   * @file index.ts
   * @description Main entry point for the extension service worker / background script.
   * Acts as the central event router for Chrome extension lifecycle events (installation,
   * messaging, tab/window updates, commands, and alarms) and delegates execution to
   * specific domain controllers.
   */

  /* eslint-disable @typescript-eslint/no-explicit-any */
  /* eslint-disable @typescript-eslint/no-unused-vars */

  setupOmnibox();

  const temporaryCommandTabIds = new Set<number>();

  // import { editTodo, updateSnippetRealtime, createSnippet } from '../../src/storage/API/features/snippetApi';
  // import { cleanupStaleSnapshots } from '../../src/storage/API/services/backupService';

  // import { runDrivePullCheck } from '../../src/storage/API/services/backup/continuationSync';

  let newTabKeystrokeRecordingTabId: number | null = null;
  // Initial sync
  backgroundSync();
  attachContextMenuListeners();
  // cleanupStaleSnapshots().catch(() => {});

  const TOGGLE_ALTS_MESSAGE = 'supercommands:toggle-alts';
  const CHROME_NOTIFICATIONS_ENABLED_KEY = 'todo_chrome_alarm_notifications_enabled';

  chrome.runtime.onConnect.addListener(port => {
    const match = /^session-control:(\d+)$/.exec(port.name || '');
    if (!match) return;
    registerSessionControlPort(Number(match[1]), port);
  });

  chrome.runtime.onInstalled.addListener(async details => {
    setupContextMenus();

    // Create periodic alarm for background sync (every 30 minutes)
    chrome.alarms.create('cmdos-periodic-sync', { periodInMinutes: 30 });

    if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
      await chrome.storage.local.set({
        omnibox_override_enabled: false,
        [CHROME_NOTIFICATIONS_ENABLED_KEY]: false,
      });

      const tutorialUrl = CMDOS_INSTALL_URL;

      if (chrome.tabs?.create) {
        chrome.tabs.create({ url: tutorialUrl }, () => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            console.warn('[onInstalled] failed to open tutorials tab:', lastError.message);
          }
        });
      } else {
        console.warn('[onInstalled] chrome.tabs unavailable; unable to auto-open tutorials.');
      }
    }

    const result = await chrome.storage.local.get(['myFavouriteItems']);

    // Set uninstall redirect URL to feedback form
    const uninstallFeedbackUrl = 'https://docs.google.com/forms/d/1YAm02YiQfcc4HoV-XtN1WMkihAL__GH2nwDKkWsMNgI/edit';
    if (chrome.runtime?.setUninstallURL) {
      chrome.runtime.setUninstallURL(uninstallFeedbackUrl, () => {
        if (chrome.runtime.lastError) {
          console.warn('[onInstalled] Failed to set uninstall URL:', chrome.runtime.lastError.message);
        }
      });
    }
  });

  // Listen for create actions from the content script overlay
  registerWebsitePopupBookmarkInvalidation();

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (handleTagImageMessage(message, sendResponse)) return true;
    if (handleCollectionScreenshotCapture(message, sender, sendResponse)) return true;
    if (handleCollectionMessage(message, sendResponse, sender)) return true;
    if (handleWorkspaceMessage(message, sendResponse)) return true;
    if (handleWebsitePopupExecutionBridgeMessage(message, sender, sendResponse)) {
      return true;
    }

    // New Tab's temporary-prompt attachments share this metadata bridge, so it
    // must remain available even in builds where the popup website popup is off.
    if (handleWebsitePopupCreateOptionsBridgeMessage(message, sender, sendResponse)) {
      return true;
    }

    if (handleWebsitePopupTextCommandBridgeMessage(message, sendResponse)) {
      return true;
    }

    if (handleWebsitePopupHotkeyBridgeMessage(message, sender, sendResponse)) {
      return true;
    }

    if (handleWebsitePopupSearchBridgeMessage(message, sendResponse)) {
      return true;
    }

    if (handleWebsitePopupPrefixSettingsBridgeMessage(message, sendResponse)) {
      return true;
    }

    if (message && message.action === 'alts_get_chrome_tabs') {
      (async () => {
        try {
          const tabs = await chrome.tabs.query({});
          let currentWindowId = sender.tab?.windowId ?? null;
          if (typeof currentWindowId !== 'number') {
            const currentWindow = await chrome.windows.getLastFocused({ populate: false }).catch(() => null);
            currentWindowId = currentWindow?.id ?? null;
          }
          sendResponse({ success: true, tabs, currentWindowId });
        } catch (err: any) {
          console.error('[Background] alts_get_chrome_tabs failed:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    if (
      message &&
      (message.type === 'supercommands:execute-create-action' || message.type === 'cmdos:execute-create-action')
    ) {
      const action = message.action; // e.g., 'createnotes', 'createlinks'
      const extensionUrl = chrome.runtime.getURL(`AltS_search_newtab/index.html?open_sheet=${action}`);
      chrome.tabs.create({ url: extensionUrl, active: true });
    }

    if (message && message.action === 'db_changed') {
      chrome.tabs.query({}, tabs => {
        tabs.forEach(tab => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: message.table }).catch(() => {});
          }
        });
      });
    }

    if (message && message.action === 'db_update_prefix_setting_value') {
      (async () => {
        try {
          const category = String(message.category || '').trim() as keyof CommandTerminalPrefixes;
          const prefix = String(message.prefix || '')
            .trim()
            .toLowerCase();
          if (!category || !prefix) {
            throw new Error('Prefix category and value are required.');
          }

          const prefixes = await getPrefixes();
          await setPrefixes({ ...prefixes, [category]: prefix });
          const updatedPrefixes = await getPrefixes();

          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              if (tab.id) {
                chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'prefixSettings' }).catch(() => {});
              }
            });
          });

          sendResponse({ success: true, prefixes: updatedPrefixes });
        } catch (err: any) {
          console.error('[Background] Failed to update prefix setting:', err);
          sendResponse({ success: false, error: err?.message || String(err) });
        }
      })();
      return true;
    }

    if (message && message.action === 'db_create_link') {
      (async () => {
        try {
          const input = message.input || {};
          let organisationId = input.organisationId;
          if (!organisationId) {
            const organisations = await db.organisations.toArray();
            organisationId = organisations
              .filter((organisation: any) => organisation?.id)
              .sort((a: any, b: any) => Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0))[0]?.id;
          }
          if (!organisationId) throw new Error('An organisation is required.');

          const now = Date.now();
          
          const title = String(input.title || '').trim() || 'Untitled Link';
          const urls = Array.isArray(input.urls) ? input.urls : [];
          const tagIds = Array.isArray(input.tagIds) ? input.tagIds : [];
          const shortcut = input.shortcut || '';
          const linkSnapshot = {
            title,
            urls: urls.map((item: any) => ({ ...item })),
            organisationId,
            
            tagIds,
            shortcut,
          };
          const link = {
            id: input.id || generateEntityId('link'),
            organisationId,
            
            title,
            urls,
            tagIds,
            shortcut,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            versionHistory: createInitialHistory(linkSnapshot, now),
          };

          await db.links.add(link as any);
          sendResponse({ success: true, link });
          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              if (tab.id) {
                chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'links' }).catch(() => {});
              }
            });
          });
        } catch (err: any) {
          console.error('[Background] db_create_link failed:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true; // keep channel open for async response
    }

    if (message && message.action === 'db_update_link') {
      (async () => {
        try {
          const linkId = String(message.linkId || '');
          if (!linkId) throw new Error('linkId is required');

          const input = message.input || {};
          const existing = await db.links.get(linkId);
          if (!existing) throw new Error('Link not found.');
          if (input.expectedUpdatedAt !== undefined && existing.updatedAt !== input.expectedUpdatedAt) {
            const error: any = new Error('Link was modified in another tab.');
            error.remoteLink = existing;
            throw error;
          }

          const now = Date.now();
          const changes: any = { updatedAt: now };
          if (input.title !== undefined) changes.title = String(input.title || '').trim() || 'Untitled Link';
          if (input.urls !== undefined) changes.urls = Array.isArray(input.urls) ? input.urls : [];
          if (input.organisationId !== undefined) changes.organisationId = input.organisationId;
          
          if (input.tagIds !== undefined) changes.tagIds = Array.isArray(input.tagIds) ? input.tagIds : [];
          if (input.shortcut !== undefined) changes.shortcut = input.shortcut || '';

          const link = { ...existing, ...changes };
          const prevSnapshot = {
            title: existing.title,
            urls: (existing.urls || []).map((item: any) => ({ ...item })),
            organisationId: existing.organisationId,
            
            tagIds: existing.tagIds || [],
            shortcut: existing.shortcut || '',
          };
          const nextSnapshot = {
            title: link.title,
            urls: (link.urls || []).map((item: any) => ({ ...item })),
            organisationId: link.organisationId,
            
            tagIds: link.tagIds || [],
            shortcut: link.shortcut || '',
          };
          const { history: nextHistory } = upsertVersionForChange(
            existing.versionHistory,
            prevSnapshot,
            nextSnapshot,
            now,
          );
          link.versionHistory = nextHistory;

          await db.links.put(link as any);
          sendResponse({ success: true, link });
          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              if (tab.id) {
                chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'links' }).catch(() => {});
              }
            });
          });
        } catch (err: any) {
          console.error('[Background] db_update_link failed:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true; // keep channel open for async response
    }

    if (message && message.action === 'db_create_todo') {
      (async () => {
        try {
          const input = message.input || message.payload || {};
          const references = mapTodoReferencesForBackground(Array.isArray(input.references) ? input.references : []);
          const now = Date.now();
          const title = String(input.title || input.name || '').trim() || references[0]?.name || 'Untitled Todo';
          const todo = {
            id: input.id || generateEntityId('todo'),
            name: title,
            description: input.description,
            references,
            isDone: false,
            scheduleType: input.scheduleType || 'one-time',
            recurringType: input.recurringCycle,
            scheduleTime: typeof input.scheduleTime === 'number' ? input.scheduleTime : Date.now(),
            tagIds: Array.isArray(input.tagIds) ? input.tagIds : [],
            tags: Array.isArray(input.tagIds) ? input.tagIds : [],
            shortcut: input.shortcut || '',
            organisationId: input.organisationId,
            
            createdAt: now,
            updatedAt: now,
            versionHistory: undefined as any,
          };
          todo.versionHistory = createInitialHistory(extractTodoSnapshotForBackground(todo), now);

          await db.todos.add(todo as any);
          sendResponse({ success: true, todo });
          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              if (tab.id) {
                chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'todos' }).catch(() => {});
                chrome.tabs.sendMessage(tab.id, { type: 'TODOS_UPDATED' }).catch(() => {});
              }
            });
          });
        } catch (err: any) {
          console.error('[Background] db_create_todo failed:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    if (message && message.action === 'db_update_todo_content') {
      (async () => {
        try {
          const todoId = String(message.todoId || '');
          if (!todoId) throw new Error('todoId is required');

          const existing = await db.todos.get(todoId);
          if (!existing) throw new Error('Todo not found after update');

          const now = Date.now();
          const updates = message.updates || {};
          const nextRecord = {
            ...existing,
            ...updates,
            updatedAt: now,
          };
          if (Array.isArray(updates.references)) {
            nextRecord.references = mapTodoReferencesForBackground(updates.references);
          }

          const { history: nextHistory } = upsertVersionForChange(
            existing.versionHistory,
            extractTodoSnapshotForBackground(existing),
            extractTodoSnapshotForBackground(nextRecord),
            now,
          );
          nextRecord.versionHistory = nextHistory;

          await db.todos.put(nextRecord as any);
          const todo = nextRecord;
          sendResponse({ success: true, todo });
          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              if (tab.id) {
                chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'todos' }).catch(() => {});
                chrome.tabs.sendMessage(tab.id, { type: 'TODOS_UPDATED' }).catch(() => {});
              }
            });
          });
        } catch (err: any) {
          console.error('[Background] db_update_todo_content failed:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    if (message && message.action === 'db_create_note') {
      (async () => {
        try {
          const input = message.input || {};
          let organisationId = input.organisationId;
          if (!organisationId) {
            const organisations = await db.organisations.toArray();
            organisationId = organisations
              .filter((organisation: any) => organisation?.id)
              .sort((a: any, b: any) => Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0))[0]?.id;
          }
          if (!organisationId) throw new Error('An organisation is required.');

          const now = Date.now();
          const body = String(input.body || '')
            .trim()
            .replace(/(<p><br><\/p>)+$/, '')
            .replace(/(<br\s*\/?>\s*)+<\/p>$/, '</p>');
          const title = String(input.title || '').trim() || 'Untitled Note';
          const noteSnapshot = {
            entityType: 'note',
            title,
            body,
            shortcut: input.shortcut || '',
            organisationId,
            
            tagIds: Array.isArray(input.tagIds) ? input.tagIds : [],
          };
          const note = {
            id: generateEntityId('note'),
            organisationId,
            
            title,
            body,
            shortcut: input.shortcut || '',
            tagIds: Array.isArray(input.tagIds) ? input.tagIds : [],
            assetIds: Array.isArray(input.assetIds) ? input.assetIds : [],
            versionHistory: {
              lastCheckpointAt: now,
              lastSavedText: body,
              historyBuffer: [],
              structuredHistory: {
                versions: [
                  {
                    id: `v_${now}_1`,
                    label: 'Initial version',
                    snapshot: noteSnapshot,
                    savedAt: now,
                    windowStartedAt: now,
                    lastUpdatedAt: now,
                    isInitial: true,
                  },
                ],
                maxHistorySize: 25,
                lastCheckpointAt: now,
              },
            },
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          };

          await db.notes.add(note as any);
          sendResponse({ success: true, note });
          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              if (tab.id) {
                chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'notes' }).catch(() => {});
              }
            });
          });
        } catch (err: any) {
          console.error('[Background] db_create_note failed:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    if (message && message.action === 'db_update_note') {
      (async () => {
        try {
          const noteId = String(message.noteId || '');
          if (!noteId) throw new Error('noteId is required');

          const input = message.input || {};
          const existing = await db.notes.get(noteId);
          if (!existing) throw new Error('Note not found.');
          if (input.expectedUpdatedAt !== undefined && existing.updatedAt !== input.expectedUpdatedAt) {
            const error: any = new Error('Note was modified in another tab.');
            error.name = 'ConflictError';
            throw error;
          }

          const now = Date.now();
          const changes: any = { updatedAt: now };
          if (input.title !== undefined) changes.title = String(input.title || '').trim() || 'Untitled Note';
          if (input.body !== undefined) {
            changes.body = String(input.body || '')
              .trim()
              .replace(/(<p><br><\/p>)+$/, '')
              .replace(/(<br\s*\/?>\s*)+<\/p>$/, '</p>');
            changes.assetIds = Array.isArray(input.assetIds) ? input.assetIds : [];
          }
          if (input.shortcut !== undefined) changes.shortcut = input.shortcut || '';
          if (input.organisationId !== undefined) changes.organisationId = input.organisationId;
          
          if (input.tagIds !== undefined) changes.tagIds = Array.isArray(input.tagIds) ? input.tagIds : [];

          const note = { ...existing, ...changes };
          await db.notes.put(note);
          sendResponse({ success: true, note });
          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              if (tab.id) {
                chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'notes' }).catch(() => {});
              }
            });
          });
        } catch (err: any) {
          console.error('[Background] db_update_note failed:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    if (message && message.action === 'db_create_snippet') {
      (async () => {
        try {
          const input = message.input || {};
          let organisationId = input.organisationId;
          if (!organisationId) {
            const organisations = await db.organisations.toArray();
            organisationId = organisations
              .filter((organisation: any) => organisation?.id)
              .sort((a: any, b: any) => Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0))[0]?.id;
          }
          if (!organisationId) throw new Error('An organisation is required.');

          const now = Date.now();
          const title = String(input.title || '').trim() || 'Untitled Snippet';
          
          const config = input.config ?? '';
          const tagIds = Array.isArray(input.tagIds) ? input.tagIds : [];
          const shortcut = input.shortcut || '';
          const snippetSnapshot = {
            entityType: 'snippet',
            title,
            config,
            organisationId,
            
            tagIds,
            shortcut,
          };
          const snippet = {
            id: generateEntityId('snippet'),
            organisationId,
            
            title,
            config,
            tagIds,
            shortcut,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            versionHistory: createInitialHistory(snippetSnapshot, now),
          };

          await db.snippets.add(snippet as any);
          sendResponse({ success: true, snippet });
          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              if (tab.id) {
                chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'snippets' }).catch(() => {});
              }
            });
          });
        } catch (err: any) {
          console.error('[Background] db_create_snippet failed:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    if (message && message.action === 'db_create_chat_agent') {
      (async () => {
        try {
          const agent = await createChatAgent(message.input);
          sendResponse({ success: true, agent });
          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              if (tab.id) {
                chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'chatAgents' }).catch(() => {});
              }
            });
          });
        } catch (err: any) {
          console.error('[Background] db_create_chat_agent failed:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    if (message && message.action === 'db_update_chat_agent') {
      (async () => {
        try {
          const agentId = String(message.agentId || '');
          if (!agentId) throw new Error('agentId is required');
          const agent = await updateChatAgent(agentId, message.input || {});
          sendResponse({ success: true, agent });
          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              if (tab.id) {
                chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'chatAgents' }).catch(() => {});
              }
            });
          });
        } catch (err: any) {
          console.error('[Background] db_update_chat_agent failed:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    if (message && message.action === 'db_update_ai_prompt') {
      (async () => {
        try {
          const aiPromptId = String(message.aiPromptId || '');
          if (!aiPromptId) throw new Error('aiPromptId is required');
          const prompt = await updateAiPrompt(aiPromptId, message.input || {});
          sendResponse({ success: true, prompt });
          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              if (tab.id) {
                chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'aiPrompts' }).catch(() => {});
              }
            });
          });
        } catch (err: any) {
          console.error('[Background] db_update_ai_prompt failed:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    if (message && message.action === 'db_create_ai_prompt') {
      (async () => {
        try {
          const prompt = await createAiPrompt(message.input || {});
          sendResponse({ success: true, prompt });
          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              if (tab.id) {
                chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'aiPrompts' }).catch(() => {});
              }
            });
          });
        } catch (err: any) {
          console.error('[Background] db_create_ai_prompt failed:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    if (message && message.action === 'db_update_snippet') {
      (async () => {
        try {
          const snippetId = String(message.snippetId || '');
          if (!snippetId) throw new Error('snippetId is required');

          const input = message.input || {};
          const existing = await db.snippets.get(snippetId);
          if (!existing) throw new Error('Snippet not found.');

          const now = Date.now();
          const changes: any = { updatedAt: now };
          if (input.title !== undefined) changes.title = String(input.title || '').trim() || 'Untitled Snippet';
          if (input.config !== undefined) changes.config = input.config;
          if (input.organisationId !== undefined) changes.organisationId = input.organisationId;
          
          if (input.tagIds !== undefined) changes.tagIds = Array.isArray(input.tagIds) ? input.tagIds : [];
          if (input.shortcut !== undefined) changes.shortcut = input.shortcut || '';

          const snippet = { ...existing, ...changes };
          const prevSnapshot = {
            entityType: 'snippet',
            title: existing.title,
            config: existing.config,
            organisationId: existing.organisationId,
            
            tagIds: existing.tagIds || [],
            shortcut: existing.shortcut || '',
          };
          const nextSnapshot = {
            entityType: 'snippet',
            title: snippet.title,
            config: snippet.config,
            organisationId: snippet.organisationId,
            
            tagIds: snippet.tagIds || [],
            shortcut: snippet.shortcut || '',
          };
          const { history: nextHistory } = upsertVersionForChange(
            existing.versionHistory,
            prevSnapshot,
            nextSnapshot,
            now,
          );
          snippet.versionHistory = nextHistory;

          await db.snippets.put(snippet as any);
          sendResponse({ success: true, snippet });
          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              if (tab.id) {
                chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'snippets' }).catch(() => {});
              }
            });
          });
        } catch (err: any) {
          console.error('[Background] db_update_snippet failed:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }

    if (message && message.action === 'db_update_session') {
      (async () => {
        try {
          const existingSession = await db.workspaceSessions.get(message.sessionId);
          if (!existingSession) throw new Error('Session not found');

          const updatedUrls = message.input.urls;

          await db.workspaceSessions.update(message.sessionId, {
            urls: updatedUrls,
            updatedAt: Date.now(),
          });

          sendResponse({ success: true });
          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              if (tab.id) {
                chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'workspaces' }).catch(() => {});
              }
            });
          });
        } catch (err: any) {
          console.error('[Background] db_update_session failed:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true; // keep channel open for async response
    }

    if (message && message.action === 'db_toggle_favorite') {
      (async () => {
        try {
          const isFavorited = await toggleFavoriteRecord(
            message.userId,
            message.referenceId,
            message.referenceType,
            message.label,
          );
          sendResponse({ success: true, isFavorited });
          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              if (tab.id) {
                chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'favorites' }).catch(() => {});
              }
            });
          });
        } catch (err: any) {
          console.error('[Background] db_toggle_favorite failed:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true; // keep channel open for async response
    }

    if (message && message.action === 'api_add_favorite') {
      addFavoriteRecord(
        message.userId || 'local_user',
        message.payload.referenceId,
        message.payload.referenceType,
        message.payload.label,
      )
        .then(favorite => {
          sendResponse({ success: true, favorite });
          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              if (tab.id) chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'favorites' }).catch(() => {});
            });
          });
        })
        .catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }

    if (message && message.action === 'api_remove_favorite') {
      removeFavoriteRecord(message.userId || 'local_user', message.payload.referenceId)
        .then(() => {
          sendResponse({ success: true });
          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              if (tab.id) chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'favorites' }).catch(() => {});
            });
          });
        })
        .catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }

    if (message && message.action === 'api_create_tag') {
      createTag(message.payload.name, message.payload.workspaceId || null)
        .then(tag => {
          sendResponse({ success: true, tag });
          void broadcastWebsitePopupEntityChanges(['tags']).catch(() => undefined);
        })
        .catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }

    if (message && message.action === 'api_update_tag') {
      updateTag(message.payload.tagId, message.payload.updates || {})
        .then(tag => {
          sendResponse({ success: true, tag });
          void broadcastWebsitePopupEntityChanges(['tags',
            ...(typeof message.payload.updates?.name === 'string' ? ['workspaces'] : []),
          ]).catch(() => undefined);
        })
        .catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }

    if (message && message.action === 'api_delete_tag') {
      deleteTag(message.payload.tagId)
        .then(() => {
          sendResponse({ success: true });
          const modifiedTables = ['tags', 'notes', 'links', 'snippets', 'todos', 'sessions', 'aiPrompts', 'chatAgents', 'collectionItems'];
          void broadcastWebsitePopupEntityChanges(modifiedTables).catch(() => undefined);
        })
        .catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }

    if (message && message.action === 'db_update_todo') {
      (async () => {
        try {
          const todoId = String(message.todoId || '');
          if (!todoId) throw new Error('todoId is required');

          const existing = await db.todos.get(todoId);
          if (!existing) throw new Error('Todo not found after update');

          const now = Date.now();
          const nextRecord = {
            ...existing,
            isDone: Boolean(message.status),
            ...(message.nextDeadline ? { scheduleTime: new Date(message.nextDeadline).getTime() } : {}),
            updatedAt: now,
          };
          const { history: nextHistory } = upsertVersionForChange(
            existing.versionHistory,
            extractTodoSnapshotForBackground(existing),
            extractTodoSnapshotForBackground(nextRecord),
            now,
          );
          nextRecord.versionHistory = nextHistory;

          await db.todos.put(nextRecord as any);
          sendResponse({ success: true });
          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              if (tab.id) {
                chrome.tabs.sendMessage(tab.id, { type: 'TODOS_UPDATED' }).catch(() => {});
              }
            });
          });
        } catch (err: any) {
          console.error('[Background] db_update_todo failed:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true; // keep channel open for async response
    }

    if (message && message.action === 'db_get_all_records') {
      (async () => {
        try {
          const safeQuery = async (table: any) => {
            try {
              return await table.toArray();
            } catch (e) {
              console.error(`[Background] Failed to query table:`, e);
              return [];
            }
          };

          console.log('[Background] db_get_all_records querying tables...');
          const syncedPrefixSettings = await syncPrefixSettingsFromSource().catch(err => {
            console.warn('[Background] Failed to sync prefix settings before snapshot:', err);
            return null;
          });
          const [
            organisations,
            links,
            notes,
            tags,
            snippets,
            todos,
            chatAgents,
            aiPrompts,
            favorites,
            userHotkeys,
            userShortcuts,
            sessions,
            widgets,
            widgetViews,
            commands,
            rawPrefixSettings,
          ] = await Promise.all([
            safeQuery(db.organisations),
            safeQuery(db.links),
            safeQuery(db.notes),
            safeQuery(db.tags),
            safeQuery(db.snippets),
            safeQuery(db.todos),
            safeQuery(db.chatAgents),
            safeQuery(db.aiPrompts),
            safeQuery(db.favorites),
            safeQuery(db.userHotkeys),
            safeQuery(db.userShortcuts),
            safeQuery(db.workspaceSessions),
            safeQuery(db.widgets),
            safeQuery(db.workspaceViews),
            safeQuery(db.commands),
            syncedPrefixSettings ? Promise.resolve(syncedPrefixSettings) : safeQuery(db.prefixSettings),
          ]);
          const prefixSettings = Array.isArray(syncedPrefixSettings) ? syncedPrefixSettings : rawPrefixSettings;
          console.log('[Background] db_get_all_records counts:', {
            organisations: organisations.length,
            links: links.length,
            notes: notes.length,
            tags: tags.length,
            snippets: snippets.length,
            todos: todos.length,
            chatAgents: chatAgents.length,
            aiPrompts: aiPrompts.length,
            favorites: favorites.length,
            userHotkeys: userHotkeys.length,
            userShortcuts: userShortcuts.length,
            sessions: sessions.length,
            widgets: widgets.length,
            widgetViews: widgetViews.length,
            commands: commands.length,
            prefixSettings: prefixSettings.length,
          });
          sendResponse({
            success: true,
            organisations,
            links,
            notes,
            tags,
            snippets,
            todos,
            chatAgents,
            aiPrompts,
            favorites,
            userHotkeys,
            userShortcuts,
            sessions,
            widgets,
            widgetViews,
            commands,
            prefixSettings,
          });
        } catch (err: any) {
          console.error('[Background] db_get_all_records failed:', err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true; // keep channel open for async response
    }

    // Drive Continuation: manual trigger from BackupPanel "Check Now" button
    if (message && message.type === 'TRIGGER_DRIVE_PULL_CHECK') {
      (async () => {
        try {
          // const result = await runDrivePullCheck();
          // console.log('[DriveContinuation] Manual pull result:', result);
          sendResponse({ result: 'temporarily disabled' });
        } catch (err) {
          console.error('[DriveContinuation] Manual pull failed:', err);
          sendResponse({ result: 'error' });
        }
      })();
      return true; // keep message channel open for async response
    }

    if (message && message.action === 'save_user_hotkey') {
      saveUserHotkey(
        message.payload.hotkeyValue,
        message.payload.referenceId,
        message.payload.referenceType,
        message.userId || 'local_user',
      )
        .then(() => {
          invalidateHotkeysCache();
          sendResponse({ success: true });
          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              if (tab.id)
                chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'hotkeysMap' }).catch(() => {});
            });
          });
        })
        .catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }

    if (message && message.action === 'delete_user_hotkey') {
      deleteUserHotkeyByReference(message.payload.referenceId, message.userId || 'local_user')
        .then(() => {
          invalidateHotkeysCache();
          sendResponse({ success: true });
        })
        .catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }

    if (message && message.action === 'save_user_shortcut') {
      saveUserShortcut(
        message.payload.normalized,
        message.payload.referenceId,
        message.payload.type,
        message.userId || 'local_user',
      )
        .then(() => {
          sendResponse({ success: true });
          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              if (tab.id)
                chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'shortcutsMap' }).catch(() => {});
            });
          });
        })
        .catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }

    if (message && message.action === 'delete_user_shortcut') {
      deleteUserShortcutByReference(message.payload.referenceId, message.userId || 'local_user')
        .then(() => sendResponse({ success: true }))
        .catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }

    if (message && message.action === 'GET_ALL_SHORTCUTS') {
      getAllUserShortcuts(message.userId || 'local_user')
        .then(shortcuts => {
          const shortcutsMap: Record<string, string> = {};
          shortcuts.forEach(shortcut => {
            if (shortcut.referenceId && shortcut.trigger) {
              shortcutsMap[shortcut.referenceId] = shortcut.trigger;
            }
          });
          db.commands
            .toArray()
            .then(commands => {
              commands.forEach((command: any) => {
                const shortcut = command?.prefix || '';
                if (command?.id && shortcut && !shortcutsMap[command.id]) {
                  shortcutsMap[command.id] = shortcut;
                }
              });
              sendResponse({ success: true, shortcutsMap });
            })
            .catch(() => {
              sendResponse({ success: true, shortcutsMap });
            });
        })
        .catch(e => {
          sendResponse({ success: false, error: e.message });
        });
      return true;
    }

    if (message && message.action === 'api_save_shortcut') {
      apiSaveShortcut(
        message.payload.id,
        message.payload.referenceId,
        message.payload.trigger,
        message.payload.label,
        message.payload.type,
        message.userId || 'local_user',
      )
        .then(() => {
          sendResponse({ success: true });
          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              if (tab.id)
                chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'shortcutsMap' }).catch(() => {});
            });
          });
        })
        .catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }

    if (message && message.action === 'api_clear_shortcut') {
      apiClearShortcut(
        message.payload.id,
        message.payload.referenceId,
        message.payload.type,
        message.userId || 'local_user',
      )
        .then(() => {
          sendResponse({ success: true });
          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              if (tab.id)
                chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'shortcutsMap' }).catch(() => {});
            });
          });
        })
        .catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }

    if (message && message.action === 'api_save_hotkey') {
      apiSaveHotkey(
        message.payload.id,
        message.payload.referenceId,
        message.payload.hotkey,
        message.payload.type,
        message.userId || 'local_user',
      )
        .then(() => {
          invalidateHotkeysCache();
          sendResponse({ success: true });
          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              if (tab.id)
                chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'hotkeysMap' }).catch(() => {});
            });
          });
        })
        .catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }

    if (message && message.action === 'api_clear_hotkey') {
      apiClearHotkey(
        message.payload.id,
        message.payload.referenceId,
        message.payload.type,
        message.userId || 'local_user',
      )
        .then(() => {
          invalidateHotkeysCache();
          sendResponse({ success: true });
          chrome.tabs.query({}, tabs => {
            tabs.forEach(tab => {
              if (tab.id)
                chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'hotkeysMap' }).catch(() => {});
            });
          });
        })
        .catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }

    if (message && message.action === 'alts_create_collection_view') {
      (async () => {
        try {
          const payload = message.payload || {};
          const organisationId = payload.organisationId || 'default';
          const result = await createWidgetDashboardViewAsync(payload.title || 'Untitled Workspace', organisationId, {
            viewIconId: payload.viewIconId,
          });
          const newViewId = result.state.activeViewId;

          if (payload.shortcut && newViewId) {
            await saveUserShortcut(payload.shortcut, newViewId, 'collection', message.userId || 'local_user');
          }
          if (payload.hotkey && newViewId) {
            await saveUserHotkey(payload.hotkey, newViewId, 'collection', message.userId || 'local_user');
            invalidateHotkeysCache();
          }

          const draftSession = payload.draftSession || {};
          const hasSessionDraftChanges =
            (Array.isArray(draftSession.urls) && draftSession.urls.length > 0) ||
            Boolean(draftSession.sessionOpenSettings);
          if (result.createdSessionId && hasSessionDraftChanges) {
            await updateSession(result.createdSessionId, {
              title: payload.title || draftSession.title || 'Untitled Workspace',
              urls: Array.isArray(draftSession.urls) ? draftSession.urls : [],
              sessionOpenSettings: draftSession.sessionOpenSettings,
              organisationId: draftSession.organisationId || organisationId,
              
              tagIds: draftSession.tagIds,
            });
          }

          // Compatibility request creates only a Workspace; widget payloads are retired.

          sendResponse({
            success: true,
            viewId: newViewId,
            createdSessionId: result.createdSessionId,
            state: result.state,
          });
          chrome.tabs.query({}, tabs => {
            const changedTables = ['widgetDashboard', 'workspaces', 'shortcutsMap', 'hotkeysMap'];
            tabs.forEach(tab => {
              changedTables.forEach(table => {
                if (tab.id) chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table }).catch(() => {});
              });
            });
          });
        } catch (e: any) {
          console.error('[Background] alts_create_collection_view failed:', e);
          sendResponse({ success: false, error: e?.message || 'Failed to create collection view' });
        }
      })();
      return true;
    }

    if (message && message.action === 'toggle_favorite') {
      toggleFavoriteRecord(
        'local_user',
        message.payload.targetReferenceId,
        message.payload.referenceType,
        message.payload.label,
      )
        .then(() => sendResponse({ success: true }))
        .catch(e => sendResponse({ success: false, error: e.message }));
      return true;
    }

    return false; // sync handlers — no async response needed
  });

  /**
   * Safely removes stale per-tab focus keys from chrome.storage.local.
   * Only keys matching strict /^new_tab_focus_\d+$/ pattern whose numeric tab ID is NOT
   * currently among open Chrome tabs will be removed.
   */
  function cleanupStaleNewTabFocusKeys(): void {
    if (!chrome.storage?.local || !chrome.tabs?.query) return;

    chrome.storage.local.get(null, items => {
      if (chrome.runtime.lastError) {
        console.warn(
          '[cleanup] error reading storage snapshot for stale focus keys:',
          chrome.runtime.lastError.message,
        );
        return;
      }
      if (!items || typeof items !== 'object') return;

      const keyPattern = /^new_tab_focus_\d+$/;
      const focusKeys = Object.keys(items).filter(key => keyPattern.test(key));
      if (focusKeys.length === 0) return;

      chrome.tabs.query({}, openTabs => {
        if (chrome.runtime.lastError) {
          console.warn('[cleanup] error querying open tabs for stale focus keys:', chrome.runtime.lastError.message);
          return;
        }
        if (!openTabs) return;

        const openTabIdSet = new Set<number>(
          openTabs.map(tab => tab.id).filter((id): id is number => typeof id === 'number'),
        );

        const staleKeys = focusKeys.filter(key => {
          const numericTabId = parseInt(key.replace('new_tab_focus_', ''), 10);
          return !isNaN(numericTabId) && !openTabIdSet.has(numericTabId);
        });

        if (staleKeys.length > 0) {
          chrome.storage.local.remove(staleKeys, () => {
            if (chrome.runtime.lastError) {
              console.warn('[cleanup] error removing stale focus keys:', chrome.runtime.lastError.message);
            } else {
              console.log(`[cleanup] successfully removed ${staleKeys.length} stale focus key(s).`);
            }
          });
        }
      });
    });
  }

  function cleanupLegacyAutomationStorageKeys(): void {
    if (!chrome.storage?.local) return;

    chrome.storage.local.remove(LEGACY_AUTOMATION_STORAGE_KEYS, () => {
      if (chrome.runtime.lastError) {
        console.warn('[cleanup] error removing legacy automation storage keys:', chrome.runtime.lastError.message);
      }
    });
  }

  // Clean up per-tab focus flags whenever any tab is closed
  chrome.tabs.onRemoved.addListener((closedTabId, _removeInfo) => {
    if (typeof closedTabId === 'number') {
      temporaryCommandTabIds.delete(closedTabId);

      const focusKey = `new_tab_focus_${closedTabId}`;
      chrome.storage.local.remove(focusKey, () => {
        if (chrome.runtime.lastError) {
          console.warn(
            '[cleanup] error removing focus key for closed tab',
            closedTabId,
            ':',
            chrome.runtime.lastError.message,
          );
        }
      });
    }
  });

  chrome.commands?.onCommand?.addListener(command => {
    console.log('[commands] Received command:', command);
    if (!chrome.tabs?.query) return;

    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      console.log('[commands] active tab query result:', tabs?.[0]);
      const activeTab = tabs?.[0];
      const activeTabId = activeTab?.id;
      if (typeof activeTabId === 'number' && isWebsitePopupHotkeyCaptureActive(activeTabId)) {
        return;
      }
      const activeUrl = activeTab?.url || '';
      const isNewTabPage = activeUrl.startsWith(chrome.runtime.getURL('AltS_search_newtab/'));

      if (typeof activeTabId === 'number' && newTabKeystrokeRecordingTabId === activeTabId && isNewTabPage) {
        return;
      }
      const isPopupCommand = command === 'open_alts';

      if (isPopupCommand) {
        const isActualNewTabPage =
          isNewTabPage ||
          activeUrl.startsWith('chrome://newtab') ||
          activeUrl.startsWith('chrome://new-tab-page') ||
          activeUrl.startsWith('about:blank');

        if (isActualNewTabPage && typeof activeTabId === 'number') {
          temporaryCommandTabIds.add(activeTabId);
          const openPopupUrl = chrome.runtime.getURL('AltS_search_newtab/index.html?open_popup=true');
          const openExplicitNewTab = () => {
            chrome.tabs.create({ url: openPopupUrl, active: true }, () => {
              chrome.tabs.remove(activeTabId);
            });
          };
          const deliverPopupToggle = () => {
            const toggle = () => {
              chrome.runtime.sendMessage({ type: TOGGLE_ALTS_MESSAGE, targetTabId: activeTabId }, response => {
                const lastError = chrome.runtime.lastError;
                if (lastError || response?.success !== true) {
                  if (isNewTabPage) chrome.tabs.update(activeTabId, { url: openPopupUrl });
                  else openExplicitNewTab();
                }
              });
            };
            if (isPopupCommand) {
              chrome.runtime.sendMessage({ type: NEW_TAB_SCREENSHOT_SHORTCUT_RETRY, targetTabId: activeTabId }, response => {
                const error = chrome.runtime.lastError;
                if (error || response?.resumed !== true) toggle();
              });
            } else toggle();
          };
          if (isNewTabPage) {
            deliverPopupToggle();
          } else {
            const focusKey = `new_tab_focus_${activeTabId}`;
            chrome.storage.local.get([focusKey, 'new_tab_has_page_focus'], result => {
              const hasFocus = result?.[focusKey] === true || result?.new_tab_has_page_focus === true;
              if (hasFocus) deliverPopupToggle();
              else openExplicitNewTab();
            });
          }
        } else if (isActualNewTabPage) {
          console.warn('[commands] Website Popup is unavailable in this build.');
        } else {
          console.log('[commands] We are on external site. Triggering website Alt + S Search for tab:', activeTabId);
          if (typeof activeTabId === 'number') {
            const popupMessageType = TOGGLE_ALTS_MESSAGE;
            void sendWebsitePopupToggle(activeTabId, activeUrl, { type: popupMessageType })
              .catch(error => console.warn('[commands] Alt+S website popup failed:', error instanceof Error ? error.message : String(error)));
          }
        }
      }
    });
  });

  /**
   * Standardizes a URL by converting it to lowercase, removing protocols (http/https),
   * striping 'www.' prefix, and removing trailing slashes for clean and reliable URL comparisons.
   *
   * @param urlStr Raw URL string to normalize.
   * @returns {string} Normalized URL string.
   */
  function normalizeUrlForComparison(urlStr: string): string {
    try {
      let u = urlStr.toLowerCase();
      u = u.replace(/^https?:\/\//, '');
      u = u.replace(/^www\./, '');
      u = u.replace(/\/$/, '');
      return u;
    } catch {
      return urlStr.toLowerCase();
    }
  }

  chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    await ensureStateRestored();

    if (changeInfo.pinned === false) {
      const session = activeSessions.get(tab.windowId);
      if (session?.pinnedTabId === tabId) {
        await stopActiveSessionRuntimeForWindow(tab.windowId, 'control_tab_unpinned');
      }
      return;
    }

    if (typeof changeInfo.discarded === 'boolean') {
      const session = activeSessions.get(tab.windowId);
      const item = session?.focusItems?.find(candidate => candidate.tabId === tabId);
      if (item && session?.focusLaunchSettled) {
        item.tier = changeInfo.discarded ? 'warm' : 'hot';
        item.loadStatus = changeInfo.discarded ? 'idle' : 'loading';
        persistActiveSessions();
      }
    }

    if (!changeInfo.url && !changeInfo.status) return; // Early return for irrelevant changes

    const navigationUrl = changeInfo.url || tab.url || '';
    const activeSession = activeSessions.get(tab.windowId);
    if (activeSession?.pinnedTabId === tabId && navigationUrl && !isSessionControlTabUrl(navigationUrl)) {
      await stopActiveSessionRuntimeForWindow(tab.windowId, 'control_tab_navigated_away');
      return;
    }

    if (navigationUrl && (await handleDeepFocusNavigation(tabId, navigationUrl))) {
      return;
    }

    // 1. AI Chat History Tracking logic (ALWAYS run for registered sessions)
    if ((changeInfo.url || changeInfo.status) && pendingAiSessions.size > 0) {
      const url = changeInfo.url || tab.url || '';
      for (const [sessionId, session] of pendingAiSessions.entries()) {
        const tabIndex = session.tabIds.indexOf(tabId);
        if (tabIndex !== -1) {
          const model = session.models[tabIndex];

          if (changeInfo.url) {
          }

          let isFinal = false;
          // Refined patterns for SPA transitions (supporting custom model IDs containing provider keywords)
          if (model.includes('gpt') && url.includes('chatgpt.com/c/')) isFinal = true;
          else if (model.includes('gemini') && url.match(/gemini\.google\.com\/app\/([a-zA-Z0-9_-]+)/)) isFinal = true;
          else if (
            model.includes('perplexity') &&
            url.includes('perplexity.ai/search/') &&
            !url.includes('/search/new/') // Exclude the intermediate /search/new/UUID loading URL
          )
            isFinal = true;
          else if (model.includes('claude') && url.includes('claude.ai/chat/')) isFinal = true;
          else if (model.includes('google') && url.includes('google.com/search?q=')) isFinal = true;
          else if (model.includes('copilot') && url.includes('copilot.microsoft.com/chats/')) isFinal = true;

          if (isFinal) {
            // tabs.onUpdated can fire repeatedly for the same navigation (URL,
            // loading, complete). Persist and broadcast only an actual URL change.
            if (session.urls[model] === url) continue;

            session.urls[model] = url; // Always update to the latest final URL
            pendingAiSessions.set(sessionId, session);

            // Update the database directly if we have an aiPromptId
            if (session.aiPromptId) {
              db.aiPrompts.get(session.aiPromptId).then(existingPrompt => {
                if (existingPrompt) {
                  const nextModelUrls = { ...existingPrompt.modelUrls, [model]: url };
                  db.aiPrompts
                    .update(session.aiPromptId!, {
                      modelUrls: nextModelUrls,
                      updatedAt: Date.now(),
                    })
                    .then(() => {
                      console.log(`[BG] Successfully updated aiPrompt ${session.aiPromptId} with ${model} URL: ${url}`);
                    })
                    .catch(err => {
                      console.error('[BG] Failed to update aiPrompt in Dexie:', err);
                    });
                }
              });
            }

            // Notify AltS_search_newtab page with updated session URL so it can track the real chat link.
            // We use chrome.runtime.sendMessage to broadcast to all extension pages (like AltS_search_newtab)
            // because chrome.tabs.query might fail to find "AltS_search_newtab" tabs which Chrome often
            // masks as chrome://newtab/ instead of the extension URL.
            chrome.runtime
              .sendMessage({
                action: 'ai_session_url_updated',
                sessionId,
                model,
                url,
                tabId,
              })
              .catch(() => {});
          }
        }
      }
    }

    // 2. Sequential Queue Trigger Logic
    if (changeInfo.status === 'complete') {
      // Fail-safe: If a page load completes, the previous script context or navigation is finished.
      // We clear the processing flag to ensure the queue doesn't stay blocked if the
      // injection script was killed by the navigation.
      if (processingTabs.has(tabId)) {
        processingTabs.delete(tabId);
      }

      const queue = tabPromptQueues.get(tabId);
      if (queue && queue.length > 0) {
        processTabQueue(tabId);
      }
    }

    // ─── Session Tab Capture ─────────────────────────────────────────────────────
    const isComplete = changeInfo.status === 'complete';
    const hasNewUrl = !!changeInfo.url;

    if ((isComplete || hasNewUrl) && tab.url && tab.windowId) {
      const session = await getValidatedActiveSessionForWindow(tab.windowId);
      if (session) {
        // Skip the pinned tracker tab itself
        if (tabId === session.pinnedTabId) return;

        // Skip initial seeding loads to prevent duplicate captures of the initial tabs
        if (session.initialTabUrls && tabId in session.initialTabUrls) {
          const seededUrl = session.initialTabUrls[tabId];
          const normalizedTab = normalizeUrlForComparison(tab.url);
          const normalizedSeed = normalizeUrlForComparison(seededUrl);
          if (normalizedTab === normalizedSeed) {
            // If the tab finished loading its seeded URL, we can stop ignoring it for future updates
            if (changeInfo.status === 'complete') {
              delete session.initialTabUrls[tabId];
              activeSessions.set(tab.windowId, session);
              persistActiveSessions();
            } else {
              return;
            }
          } else {
            // The user navigated away from the seeded URL, stop ignoring
            delete session.initialTabUrls[tabId];
            activeSessions.set(tab.windowId, session);
            persistActiveSessions();
          }
        }

        if (!isTrackableSessionAutosaveUrl(tab.windowId, tab.url)) return;

        const title = tab.title || new URL(tab.url).hostname;

        const mode = session.openSettings?.autoSaveMode;

        if (session.focusItems && mode !== 'auto_save') {
          await syncFocusSessionTabs(tab.windowId);
          return;
        }

        if (mode === 'dont_save') {
          return;
        }

        if (mode === 'auto_save') {
          if (session.focusItems) {
            const currentSession = await syncFocusSessionTabs(tab.windowId);
            if (currentSession) {
              void chrome.runtime.sendMessage({
                action: 'session_tab_captured',
                sessionId: currentSession.sessionId,
                windowId: tab.windowId,
                capturedUrls: currentSession.capturedUrls,
                capturedNames: currentSession.capturedNames,
              }).catch(() => {});
            }
            return;
          }
          chrome.tabs.query({ windowId: tab.windowId }, async tabs => {
            const currentSession = await getValidatedActiveSessionForWindow(tab.windowId);
            if (!currentSession || currentSession.sessionId !== session.sessionId) return;
            const capturedTabs = tabs
              .filter(t => t.id !== currentSession.pinnedTabId)
              .map(t => ({ tab: t, url: getTrackableSessionAutosaveTabUrl(tab.windowId, t) }))
              .filter(entry => Boolean(entry.url));
            currentSession.capturedUrls = capturedTabs.map(entry => entry.url);
            currentSession.capturedNames = capturedTabs.map(
              entry => entry.tab.title || new URL(entry.url).hostname || entry.url,
            );
            currentSession.capturedTabIds = capturedTabs.map(entry => entry.tab.id ?? -1);
            activeSessions.set(tab.windowId, currentSession);
            persistActiveSessions();
            void saveSessionToDb(currentSession);
            chrome.runtime
              .sendMessage({
                action: 'session_tab_captured',
                sessionId: currentSession.sessionId,
                windowId: tab.windowId,
                tabId,
                url: tab.url,
                title: title,
                favIconUrl: tab.favIconUrl,
                capturedUrls: currentSession.capturedUrls,
                capturedNames: currentSession.capturedNames,
              })
              .catch(() => {});
          });
          return;
        }
      }
    }
    // ─── End Session Tab Capture ──────────────────────────────────────────────────
  });

  chrome.tabs.onCreated.addListener(tab => {
    void ensureStateRestored()
      .then(() => handleDeepFocusTabCreated(tab))
      .catch(error => console.error('[DeepFocus] tabs.onCreated failed:', error));
  });

  chrome.windows.onCreated.addListener(window => {
    void ensureStateRestored()
      .then(() => handleDeepFocusWindowCreated(window))
      .catch(error => console.error('[DeepFocus] windows.onCreated failed:', error));
  });

  chrome.windows.onFocusChanged.addListener(windowId => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) return;

    void (async () => {
      try {
        const storageKey = 'widget-dashboard-window-views-v1';
        const stored = await chrome.storage.local.get(storageKey);
        const current = stored[storageKey];
        const activeViewByWindow =
          current?.activeViewByWindow &&
          typeof current.activeViewByWindow === 'object' &&
          !Array.isArray(current.activeViewByWindow)
            ? current.activeViewByWindow
            : {};
        const focusedWindowView = activeViewByWindow[String(windowId)];
        if (!focusedWindowView) return;

        await chrome.storage.local.set({
          [storageKey]: {
            activeViewByWindow,
            lastKnownView: {
              ...focusedWindowView,
              updatedAt: Date.now(),
            },
          },
        });
      } catch (error) {
        console.error('[WidgetDashboardWindowView] failed to promote focused window view:', error);
      }
    })();
  });

  chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
    await ensureStateRestored();
    const session = await getValidatedActiveSessionForWindow(windowId);
    const item = session?.focusItems?.find(candidate => candidate.tabId === tabId);
    if (!item) return;
    item.userActivated = true;
    persistActiveSessions();
  });

  chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
    await ensureStateRestored();
    clearWebsitePopupHotkeyCaptureForTab(tabId);
    if (newTabKeystrokeRecordingTabId === tabId) {
      newTabKeystrokeRecordingTabId = null;
    }
    pendingAutoSubmitTabs.delete(tabId);
    tabPromptQueues.delete(tabId);

    // Check if this was a session's pinned tab
    for (const [windowId, session] of activeSessions.entries()) {
      if (session.pinnedTabId === tabId) {
        await stopActiveSessionRuntimeForWindow(windowId, 'control_tab_closed');
        break;
      }
    }

    if (removeInfo?.isWindowClosing) return;

    // Handle 'last_saved' live tracking when a normal tab is closed
    if (removeInfo && removeInfo.windowId) {
      const session = await getValidatedActiveSessionForWindow(removeInfo.windowId);
      if (session) {
        if (session.snapshotItemsByTabId?.[tabId]) {
          delete session.snapshotItemsByTabId[tabId];
        }
        const mode = session.openSettings?.autoSaveMode;
        if (session.focusItems && mode !== 'auto_save') {
          await syncFocusSessionTabs(removeInfo.windowId, tabId);
          return;
        }
        if (mode === 'auto_save') {
          if (session.focusItems) {
            const currentSession = await syncFocusSessionTabs(removeInfo.windowId, tabId);
            if (currentSession) {
              void chrome.runtime.sendMessage({
                action: 'session_tab_captured',
                sessionId: currentSession.sessionId,
                windowId: removeInfo.windowId,
                capturedUrls: currentSession.capturedUrls,
                capturedNames: currentSession.capturedNames,
              }).catch(() => {});
            }
            return;
          }
          chrome.tabs.query({ windowId: removeInfo.windowId }, async tabs => {
            const currentSession = await getValidatedActiveSessionForWindow(removeInfo.windowId);
            if (!currentSession || currentSession.sessionId !== session.sessionId) return;

            const capturedTabs = tabs
              .filter(t => t.id !== currentSession.pinnedTabId)
              .map(t => ({ tab: t, url: getTrackableSessionAutosaveTabUrl(removeInfo.windowId, t) }))
              .filter(entry => Boolean(entry.url));
            currentSession.capturedUrls = capturedTabs.map(entry => entry.url);
            currentSession.capturedNames = capturedTabs.map(
              entry => entry.tab.title || new URL(entry.url).hostname || entry.url,
            );
            currentSession.capturedTabIds = capturedTabs.map(entry => entry.tab.id ?? -1);
            activeSessions.set(removeInfo.windowId, currentSession);
            persistActiveSessions();
            void saveSessionToDb(currentSession);
            chrome.runtime
              .sendMessage({
                action: 'session_tab_captured',
                sessionId: currentSession.sessionId,
                windowId: removeInfo.windowId,
                url: '',
                title: '',
                favIconUrl: '',
                capturedUrls: currentSession.capturedUrls,
                capturedNames: currentSession.capturedNames,
              })
              .catch(() => {});
          });
        }
      }
    }
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'loading' || changeInfo.url) {
      clearWebsitePopupHotkeyCaptureForTab(tabId);
    }
  });

  chrome.windows.onRemoved.addListener(async windowId => {
    await ensureStateRestored();
    try {
      const storageKey = 'widget-dashboard-window-views-v1';
      const stored = await chrome.storage.local.get(storageKey);
      const current = stored[storageKey];
      const activeViewByWindow =
        current?.activeViewByWindow &&
        typeof current.activeViewByWindow === 'object' &&
        !Array.isArray(current.activeViewByWindow)
          ? { ...current.activeViewByWindow }
          : {};

      if (Object.prototype.hasOwnProperty.call(activeViewByWindow, String(windowId))) {
        delete activeViewByWindow[String(windowId)];
        await chrome.storage.local.set({
          [storageKey]: {
            activeViewByWindow,
            lastKnownView: current?.lastKnownView,
          },
        });
      }
    } catch (error) {
      console.error('[WidgetDashboardWindowView] failed to cleanup removed window view:', error);
    }

    await stopActiveSessionRuntimeForWindow(windowId, 'window_closed');
  });

  // Internal message listener for the popup to check auth
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    ensureStateRestored().catch(() => {}); // Ensure state starts restoring but don't block sync responses

    const sessionResult = handleSessionMessage(request, sender, sendResponse);
    if (sessionResult !== undefined) return sessionResult;

    // Handle pin_extension_tab: Pin the sender tab (Workona-style persistent pinned manager)
    if (request.action === 'pin_extension_tab') {
      const tabId = sender?.tab?.id;
      console.log('[SessionFlow][background] pin_extension_tab received. tabId:', tabId);
      if (tabId) {
        chrome.tabs.update(tabId, { pinned: true }, () => {
          if (chrome.runtime.lastError) {
            console.error('[SessionFlow][background] pin_extension_tab FAILED:', chrome.runtime.lastError.message);
            sendResponse({ ok: false, error: chrome.runtime.lastError.message });
          } else {
            console.log('[SessionFlow][background] ✓ tab pinned successfully. tabId:', tabId);
            sendResponse({ ok: true });
          }
        });
        return true; // async
      }
      console.warn('[SessionFlow][background] ⚠ pin_extension_tab: no tabId in sender');
      sendResponse({ ok: false, error: 'no_tab_id' });
      return false;
    }

    const todoResult = handleTodoMessage(request, sender, sendResponse);
    if (todoResult !== undefined) return todoResult;

    const aiResult = handleAiMessage(request, sender, sendResponse);
    if (aiResult !== undefined) return aiResult;

    const browserWindowResult = handleBrowserWindowMessage(request, sender, sendResponse);
    if (browserWindowResult !== undefined) return browserWindowResult;

    const searchResult = handleSearchMessage(request, sender, sendResponse);
    if (searchResult !== undefined) return searchResult;

    const hotkeyResult = handleHotkeyMessage(request, sender, sendResponse);
    if (hotkeyResult !== undefined) return hotkeyResult;

    if (handleExtractorMessage(request, sender, sendResponse)) return true;


    if (request.action === 'track_ai_session') {
      const { prompt, tabIds, models, aiPromptId } = request;
      const sessionId = generateEntityId('aiSession');
      const session: PendingAiSession = {
        id: sessionId,
        prompt,
        models,
        tabIds,
        urls: {},
        timestamp: Date.now(),
        aiPromptId,
      };
      pendingAiSessions.set(sessionId, session);

      // Timeout: cleanup tracking after 2 minutes
      setTimeout(() => {
        pendingAiSessions.delete(sessionId);
      }, 120000);

      sendResponse({ ok: true, sessionId });
      return true;
    }

    if (request.action === 'get_tab_id') {
      sendResponse({ tabId: sender.tab?.id });
      return true;
    }

    if (request.type === 'inject_auto_submit') {
      const { tabId, request: nestedRequest } = request;
      if (tabId && nestedRequest) {
        executeAutoSubmit(tabId, nestedRequest)
          .then(() => {
            sendResponse({ success: true });
          })
          .catch(error => {
            console.error('[Background] executeAutoSubmit error:', error);
            sendResponse({ success: false, error: String(error) });
          });
        return true;
      }
    }

    if (request.type === 'GET_TAB_ID' || request.action === 'GET_TAB_ID') {
      if (sender.tab?.id) {
        sendResponse(sender.tab.id);
        return false;
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
          sendResponse(tabs[0]?.id);
        });
        return true; // Keep channel open for async response
      }
    }

    return true;
  });

  // --- ALARM LISTENER ---
  chrome.alarms.onAlarm.addListener(async alarm => {
    if (alarm.name === BRAND.alarms.periodicSync || alarm.name === BRAND.legacyAlarms.periodicSync) {
      console.log('[BackgroundSync] Periodic sync alarm fired');
      await backgroundSync();
      return;
    }

    if (alarm.name === BRAND.alarms.driveBackup || alarm.name === BRAND.legacyAlarms.driveBackup) {
      await handleBackupAlarm(alarm);
      return;
    }

    if (alarm.name.startsWith('todo|')) {
      handleTodoAlarm(alarm);
      return;
    }

    if (alarm.name.startsWith('newtodo|')) {
      handleNewTodoAlarm(alarm);
      return;
    }

    if (alarm.name === BRAND.alarms.drivePull || alarm.name === BRAND.legacyAlarms.drivePull) {
      console.log('[DriveContinuation] Hourly Drive pull alarm fired');
      try {
        // const result = await runDrivePullCheck();
        // console.log('[DriveContinuation] Pull cycle result:', result);
      } catch (err) {
        console.error('[DriveContinuation] Error during pull alarm handler:', err);
      }
      return;
    }

    if (alarm.name === BRAND.alarms.autoBackup || alarm.name === BRAND.legacyAlarms.autoBackup) {
      console.log('[AutoBackup] Triggering scheduled Google Drive backup');
      // try {
      //   const { uploadToGoogleDrive } = await import('../../src/storage/API/services/backup/drive');
      //   const { updateAutoBackupSettings } = await import('../../src/storage/API/services/backup/autoBackup');
      //   const { nowUtc } = await import('../../src/storage/API/services/metadataService');
      //
      //   const success = await uploadToGoogleDrive();
      //   if (success) {
      //     console.log('[AutoBackup] Upload successful');
      //     await updateAutoBackupSettings({ lastAutoBackupAt: nowUtc() });
      //   } else {
      //     console.warn('[AutoBackup] Upload failed or no connection');
      //   }
      // } catch (err) {
      //   console.error('[AutoBackup] Error during scheduled backup:', err);
      // }
    }
  });

  // --- NOTIFICATION CLICK LISTENER ---
  chrome.notifications.onClicked.addListener(handleNotificationClick);

  let lastModifiedWriteTime = 0;
  const BACKUP_SYSTEM_KEYS = [
    'lastModifiedAt',
    'lastBackupAt',
    'lastUploadedFingerprint',
    'globalDataVersion',
    'restore_rollback_snapshot',
    // Drive continuation keys — must not trigger lastModifiedAt updates
    'lastDriveCheckAttemptAt',
    'lastDriveCheckSuccessAt',
    'lastImportedDriveBackupAt',
    'pending_drive_merge_plan',
  ];
  const SYSTEM_PREFIXES = ['backup_', 'sync_', 'restore_'];

  /**
   * Determines if a storage key is a system-level key that should not trigger
   * user data modification timestamps (e.g., backup or sync metadata).
   *
   * @param key The local storage key string.
   * @returns {boolean} True if the key is a system key, otherwise false.
   */
  function isSystemKey(key: string): boolean {
    if (BACKUP_SYSTEM_KEYS.includes(key)) return true;
    return SYSTEM_PREFIXES.some(prefix => key.startsWith(prefix));
  }

  chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'local') {
      const alteredKeys = Object.keys(changes);
      const hasUserDataChanges = alteredKeys.some(key => !isSystemKey(key));

      if (hasUserDataChanges) {
        const now = Date.now();
        if (now - lastModifiedWriteTime > 2000) {
          lastModifiedWriteTime = now;
          chrome.storage.local.set({ lastModifiedAt: new Date().toISOString() });
        }
      }
    }
  });
}
