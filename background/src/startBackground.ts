import 'webextension-polyfill';
import { executeScriptAdapter } from '@extension/browser';
import { handleTodoAlarm } from '@todos/todos';
import { handleAutomationAlarm } from '@automation/runtime_Execution_Engine/runner';
import { setupContextMenus, attachContextMenuListeners } from '@chatAgents/contextMenus';
import { CMDOS_INSTALL_URL } from '@config/apiConfig';
import { setupOmnibox } from './commandTerminal/omnibox/omniboxEvents';
import {
  backgroundSync,
  handleTodoMessage,
  findTodoById,
} from '@todos/todos';
import { createNotification, handleNotificationClick } from '@notifications/notifications';
import { db } from '../../src/storage/indexDB/dbConfig';
import { createLink, updateLink } from '../../src/allObjectFolder/src/createObject/links/linkData';
import { createChatAgent } from '../../src/allObjectFolder/src/createObject/ChatAgent/chatAgentData';
import { toggleFavoriteRecord } from '../../src/shared-components/favorites/favoriteData';
import { saveUserHotkey, deleteUserHotkeyByReference } from '../../src/shared-components/hotkeys/core/hotkeyDbData';
import { saveUserShortcut, deleteUserShortcutByReference } from '../../src/shared-components/shortcuts/core/shortcutDbData';
import { saveShortcut as apiSaveShortcut } from '../../src/shared-components/shortcuts';
import { handleSessionMessage, activeSessions, persistActiveSessions, saveSessionToDb } from '@browserWindows/sessions';
import {
  executeAutomation,
  stopCurrentAutomation,
  pendingAutoSubmitTabs,
} from '@automation/runtime_Execution_Engine/runner';
import {
  handleDriveMessage,
} from '@automation/integrations/googleDriveSync';
import {
  pendingAiSessions,
  tabPromptQueues,
  processingTabs,
  ensureStateRestored,
  processTabQueue,
  executeAutoSubmit,
  handleAiMessage,
} from '@chatAgents/runtimeExecutionEngine';
import type { PendingAiSession } from '@chatAgents/runtimeExecutionEngine';
import { handleBrowserWindowMessage } from '@browserWindows/index';
import { handleSearchMessage } from '@browserData/index';
import { handleHotkeyMessage } from '@hotkeys/hotkeys';
import { handleExtractorMessage } from '@preBuiltCommands/extraction/index';
import { handleElementPickerMessage } from '@automation/domSelector/visualPicker';
import { handleAuthMessage } from '@_authentication/auth';
import { handleNewTodoAlarm } from './todos/newTodos';
import { handleBackupAlarm } from '../../src/settings/backup/logic/scheduler';

let hasStarted = false;
export function startBackground() {
  if (hasStarted) return;
  hasStarted = true;
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

const TOGGLE_ALTS_MESSAGE = 'tasklabs:toggle-alts-popup';
const TOGGLE_ALTQ_MESSAGE = 'tasklabs:toggle-altq-popup';

chrome.runtime.onInstalled.addListener(async details => {
  setupContextMenus();

  // Create periodic alarm for background sync (every 30 minutes)
  chrome.alarms.create('tasklabs-periodic-sync', { periodInMinutes: 30 });

  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    await chrome.storage.local.set({ omnibox_override_enabled: false });

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
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'tasklabs:execute-create-action') {
    const action = message.action; // e.g., 'createnotes', 'createlinks'
    const extensionUrl = chrome.runtime.getURL(`AltS_search_newtab/index.html?open_sheet=${action}`);
    chrome.tabs.create({ url: extensionUrl, active: true });
  }

  if (message && message.action === 'db_changed') {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: message.table }).catch(() => {});
        }
      });
    });
  }

  if (message && message.action === 'db_create_link') {
    (async () => {
      try {
        const { createLink } = await import('../../src/allObjectFolder/src/createObject/links/linkData');
        const link = await createLink(message.input);
        sendResponse({ success: true, link });
        chrome.tabs.query({}, (tabs) => {
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
        const link = await updateLink(message.linkId, message.input);
        sendResponse({ success: true, link });
        chrome.tabs.query({}, (tabs) => {
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

  if (message && message.action === 'db_create_note') {
    (async () => {
      try {
        const { createNote } = await import('../../src/allObjectFolder/src/createObject/notes/noteData');
        const note = await createNote(message.input);
        sendResponse({ success: true, note });
        chrome.tabs.query({}, (tabs) => {
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
        const { updateNote } = await import('../../src/allObjectFolder/src/createObject/notes/noteData');
        const note = await updateNote(message.noteId, message.input);
        sendResponse({ success: true, note });
        chrome.tabs.query({}, (tabs) => {
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
        const { createSnippet } = await import('../../src/allObjectFolder/src/createObject/snippets/snippetData');
        const snippet = await createSnippet(message.input);
        sendResponse({ success: true, snippet });
        chrome.tabs.query({}, (tabs) => {
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
        chrome.tabs.query({}, (tabs) => {
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

  if (message && message.action === 'db_update_snippet') {
    (async () => {
      try {
        const { updateSnippet } = await import('../../src/allObjectFolder/src/createObject/snippets/snippetData');
        const snippet = await updateSnippet(message.snippetId, message.input);
        sendResponse({ success: true, snippet });
        chrome.tabs.query({}, (tabs) => {
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
        const existingSession = await db.sessions.get(message.sessionId);
        if (!existingSession) throw new Error('Session not found');

        const updatedUrls = message.input.urls;

        await db.sessions.update(message.sessionId, {
          urls: updatedUrls,
          updatedAt: Date.now()
        });

        sendResponse({ success: true });
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'sessions' }).catch(() => {});
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
          message.label
        );
        sendResponse({ success: true, isFavorited });
        chrome.tabs.query({}, (tabs) => {
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

  if (message && message.action === 'db_update_todo') {
    (async () => {
      try {
        const { updateTodo } = await import('../../src/allObjectFolder/src/createObject/todos/todoData');
        await updateTodo(message.todoId, message.status);
        sendResponse({ success: true });
        chrome.tabs.query({}, (tabs) => {
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
        const [
          workspaces,
          links,
          notes,
          tags,
          snippets,
          todos,
          folders,
          automations,
          chatAgents,
          aiPrompts,
          favorites,
          userHotkeys,
          userShortcuts,
          sessions,
          commands
        ] = await Promise.all([
          safeQuery(db.workspaces),
          safeQuery(db.links),
          safeQuery(db.notes),
          safeQuery(db.tags),
          safeQuery(db.snippets),
          safeQuery(db.todos),
          safeQuery(db.folders),
          safeQuery(db.automations),
          safeQuery(db.chatAgents),
          safeQuery(db.aiPrompts),
          safeQuery(db.favorites),
          safeQuery(db.userHotkeys),
          safeQuery(db.userShortcuts),
          safeQuery(db.sessions),
          safeQuery(db.commands),
        ]);
        console.log('[Background] db_get_all_records counts:', {
          workspaces: workspaces.length,
          links: links.length,
          notes: notes.length,
          tags: tags.length,
          snippets: snippets.length,
          todos: todos.length,
          folders: folders.length,
          automations: automations.length,
          chatAgents: chatAgents.length,
          aiPrompts: aiPrompts.length,
          favorites: favorites.length,
          userHotkeys: userHotkeys.length,
          userShortcuts: userShortcuts.length,
          sessions: sessions.length,
          commands: commands.length,
        });
        sendResponse({
          success: true,
          workspaces,
          links,
          notes,
          tags,
          snippets,
          todos,
          folders,
          automations,
          chatAgents,
          aiPrompts,
          favorites,
          userHotkeys,
          userShortcuts,
          sessions,
          commands,
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
    saveUserHotkey(message.payload.hotkeyValue, message.payload.referenceId, message.payload.referenceType, message.userId || 'local_user')
      .then(() => {
        sendResponse({ success: true });
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            if (tab.id) chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'hotkeysMap' }).catch(() => {});
          });
        });
      })
      .catch((e) => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (message && message.action === 'delete_user_hotkey') {
    deleteUserHotkeyByReference(message.payload.referenceId, message.userId || 'local_user').then(() => sendResponse({ success: true })).catch((e) => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (message && message.action === 'save_user_shortcut') {
    saveUserShortcut(message.payload.normalized, message.payload.referenceId, message.payload.type, message.userId || 'local_user')
      .then(() => {
        sendResponse({ success: true });
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            if (tab.id) chrome.tabs.sendMessage(tab.id, { action: 'db_changed', table: 'shortcutsMap' }).catch(() => {});
          });
        });
      })
      .catch((e) => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (message && message.action === 'delete_user_shortcut') {
    deleteUserShortcutByReference(message.payload.referenceId, message.userId || 'local_user').then(() => sendResponse({ success: true })).catch((e) => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (message && message.action === 'api_save_shortcut') {
    apiSaveShortcut(message.payload.id, message.payload.referenceId, message.payload.trigger, message.payload.label, message.payload.type, message.userId || 'local_user').then(() => sendResponse({ success: true })).catch((e) => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (message && message.action === 'toggle_favorite') {
    toggleFavoriteRecord('local_user', message.payload.targetReferenceId, message.payload.referenceType, message.payload.label).then(() => sendResponse({ success: true })).catch((e) => sendResponse({ success: false, error: e.message }));
    return true;
  }

  return false; // sync handlers — no async response needed
});



// Clean up per-tab focus flags when a temporary New-Tab page is closed
chrome.tabs.onRemoved.addListener((closedTabId, removeInfo) => {
  if (!temporaryCommandTabIds.has(closedTabId)) return;
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
});

chrome.commands?.onCommand?.addListener(command => {
  console.log('[commands] Received command:', command);
  if (!chrome.tabs?.query) return;

  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    console.log('[commands] active tab query result:', tabs?.[0]);
    const activeTab = tabs?.[0];
    const activeTabId = activeTab?.id;
    const activeUrl = activeTab?.url || '';
    const isNewTabPage = activeUrl.startsWith(chrome.runtime.getURL('AltS_search_newtab/'));

    if (typeof activeTabId === 'number' && newTabKeystrokeRecordingTabId === activeTabId && isNewTabPage) {
      return;
    }
    if (command === 'open_alt_q') {
      const isActualNewTabPage =
        isNewTabPage ||
        activeUrl.startsWith('chrome://newtab') ||
        activeUrl.startsWith('chrome://new-tab-page') ||
        activeUrl.startsWith('about:blank');

      if (isNewTabPage && typeof activeTabId === 'number') {
        temporaryCommandTabIds.add(activeTabId);
        chrome.tabs.sendMessage(activeTabId, { type: 'tasklabs:force-board-view' }, () => {
          const lastError = chrome.runtime.lastError;
          if (lastError) console.warn('[commands] open_alt_q message error:', lastError.message);
        });
      } else if (isActualNewTabPage && typeof activeTabId === 'number') {
        temporaryCommandTabIds.add(activeTabId);
        // Build per-tab storage key
        const focusKey = `new_tab_focus_${activeTabId}`;
        // Try reading the per-tab key first; if undefined, fall back to the old shared key
        chrome.storage.local.get([focusKey, 'new_tab_has_page_focus'], result => {
          const hasFocus = result?.[focusKey] === true || result?.new_tab_has_page_focus === true;
          if (hasFocus) {
            chrome.tabs.sendMessage(activeTabId, { type: 'tasklabs:force-board-view' }, () => {
              const lastError = chrome.runtime.lastError;
              if (lastError) console.warn('[commands] open_alt_q message error:', lastError.message);
            });
          } else {
            // Cursor is stuck in the Omnibox — must replace tab to steal focus back.
            const extensionUrl = chrome.runtime.getURL('AltS_search_newtab/index.html?force_board_view=true');
            chrome.tabs.create({ url: extensionUrl, active: true }, () => {
              chrome.tabs.remove(activeTabId);
            });
          }
        });
      } else {
        console.log('[commands] We are on external site. Triggering Alt+S injection for tab:', activeTabId);
        // We are on an external site! Trigger Alt+S functionality (Command Palette)
        if (typeof activeTabId === 'number') {
          chrome.tabs.sendMessage(activeTabId, { type: TOGGLE_ALTQ_MESSAGE }, () => {
            console.log('[commands] First sendMessage callback. lastError:', chrome.runtime.lastError?.message);
            if (chrome.runtime.lastError) {
              // Script is likely not injected yet, inject it programmatically
              console.log('[commands] Injecting alt-s-website.js into tab:', activeTabId);
              executeScriptAdapter({
                target: { tabId: activeTabId },
                files: ['alt-s-website.js'],
              })
                .then(() => {
                  console.log('[commands] Successfully injected alt-s-website.js! Sending toggle message in 50ms.');
                  setTimeout(() => {
                    chrome.tabs.sendMessage(activeTabId, { type: TOGGLE_ALTQ_MESSAGE }, () => {
                      console.log('[commands] Second sendMessage callback. lastError:', chrome.runtime.lastError?.message);
                    });
                  }, 50);
                })
                .catch((err: any) => {
                  console.warn('[commands] failed to inject alt_q script:', err?.message || err);
                });
            }
          });
        }
      }
    }

    if (command === 'open_create') {
      if (!chrome.tabs?.query) return;

      const isActualNewTabPage =
        isNewTabPage ||
        activeUrl.startsWith('chrome://newtab') ||
        activeUrl.startsWith('chrome://new-tab-page') ||
        activeUrl.startsWith('about:blank');

      if (isNewTabPage && typeof activeTabId === 'number') {
        chrome.tabs.sendMessage(activeTabId, { type: 'tasklabs:open-create-menu' }, () => {
          const lastError = chrome.runtime.lastError;
          if (lastError) console.warn('[commands] open_create message error:', lastError.message);
        });
      } else if (isActualNewTabPage && typeof activeTabId === 'number') {
        // Build per-tab storage key
        const focusKey = `new_tab_focus_${activeTabId}`;
        chrome.storage.local.get([focusKey, 'new_tab_has_page_focus'], result => {
          const hasFocus = result?.[focusKey] === true || result?.new_tab_has_page_focus === true;
          if (hasFocus) {
            chrome.tabs.sendMessage(activeTabId, { type: 'tasklabs:open-create-menu' }, () => {
              const lastError = chrome.runtime.lastError;
              if (lastError) console.warn('[commands] open_create message error:', lastError.message);
            });
          } else {
            // Cursor is stuck in the Omnibox — must replace tab to steal focus back.
            const extensionUrl = chrome.runtime.getURL('AltS_search_newtab/index.html?open_create=true');
            chrome.tabs.create({ url: extensionUrl, active: true }, () => {
              chrome.tabs.remove(activeTabId);
            });
          }
        });
      } else {
        // Send message to active tab to open the overlay menu
        if (typeof activeTabId === 'number') {
          chrome.tabs.sendMessage(activeTabId, { type: 'tasklabs:open-create-menu' }, () => {
            const lastError = chrome.runtime.lastError;
            if (lastError) {
              console.log('[commands] Injecting content-ui.js into tab:', activeTabId);
              executeScriptAdapter({
                target: { tabId: activeTabId },
                files: ['content-ui.js'],
              })
                .then(() => {
                  setTimeout(() => {
                    chrome.tabs.sendMessage(activeTabId, { type: 'tasklabs:open-create-menu' }, () => {
                      if (chrome.runtime.lastError) console.warn('[commands] open_create message error after inject:', chrome.runtime.lastError.message);
                    });
                  }, 50);
                })
                .catch((err: any) => {
                  console.warn('[commands] failed to inject content-ui script:', err?.message || err);
                });
            }
          });
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

  if (!changeInfo.url && !changeInfo.status) return; // Early return for irrelevant changes

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
          session.urls[model] = url; // Always update to the latest final URL
          pendingAiSessions.set(sessionId, session);

          // Update the database directly if we have an aiPromptId
          if (session.aiPromptId) {
            db.aiPrompts.get(session.aiPromptId).then(existingPrompt => {
              if (existingPrompt) {
                const nextModelUrls = { ...existingPrompt.modelUrls, [model]: url };
                db.aiPrompts.update(session.aiPromptId!, {
                  modelUrls: nextModelUrls,
                  updatedAt: Date.now()
                }).then(() => {
                  console.log(`[BG] Successfully updated aiPrompt ${session.aiPromptId} with ${model} URL: ${url}`);
                }).catch(err => {
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
    const session = activeSessions.get(tab.windowId);
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

      // Skip all non-real URLs
      if (
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('chrome://') ||
        tab.url.startsWith('about:') ||
        tab.url === 'chrome://newtab/'
      )
        return;

      const title = tab.title || new URL(tab.url).hostname;

      const mode = session.openSettings?.autoSaveMode;

      if (mode === 'dont_save') {
        return;
      }

      if (mode === 'auto_save') {
        chrome.tabs.query({ windowId: tab.windowId }, (tabs) => {
          const nonPinnedTabs = tabs.filter(t => t.id !== session.pinnedTabId && !t.url?.startsWith('chrome'));
          session.capturedUrls = nonPinnedTabs.map(t => t.url || '');
          session.capturedNames = nonPinnedTabs.map(t => t.title || (t.url ? new URL(t.url).hostname : ''));
          activeSessions.set(tab.windowId, session);
          persistActiveSessions();
          chrome.runtime.sendMessage({
            action: 'session_tab_captured',
            sessionId: session.sessionId,
            tabId,
            url: tab.url,
            title: title,
            favIconUrl: tab.favIconUrl,
            capturedUrls: session.capturedUrls,
            capturedNames: session.capturedNames,
          }).catch(() => {});
        });
        return;
      }
    }
  }
  // ─── End Session Tab Capture ──────────────────────────────────────────────────
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  await ensureStateRestored();
  if (newTabKeystrokeRecordingTabId === tabId) {
    newTabKeystrokeRecordingTabId = null;
  }
  pendingAutoSubmitTabs.delete(tabId);
  tabPromptQueues.delete(tabId);

  // Check if this was a session's pinned tab
  for (const [windowId, session] of activeSessions.entries()) {
    if (session.pinnedTabId === tabId) {
      saveSessionToDb(session);
      activeSessions.delete(windowId);
      persistActiveSessions();
      break;
    }
  }

  // Handle 'last_saved' live tracking when a normal tab is closed
  if (removeInfo && removeInfo.windowId) {
    const session = activeSessions.get(removeInfo.windowId);
    if (session) {
      const mode = session.openSettings?.autoSaveMode;
      if (mode === 'auto_save') {
      chrome.tabs.query({ windowId: removeInfo.windowId }, (tabs) => {
        // Ensure the session is still active and hasn't been closed by the pinned tab check above
        if (!activeSessions.has(removeInfo.windowId)) return;
        
        const nonPinnedTabs = tabs.filter(t => t.id !== session.pinnedTabId && !t.url?.startsWith('chrome'));
        session.capturedUrls = nonPinnedTabs.map(t => t.url || '');
        session.capturedNames = nonPinnedTabs.map(t => t.title || (t.url ? new URL(t.url).hostname : ''));
        activeSessions.set(removeInfo.windowId, session);
        persistActiveSessions();
        chrome.runtime.sendMessage({
          action: 'session_tab_captured',
          sessionId: session.sessionId,
          url: '',
          title: '',
          favIconUrl: '',
          capturedUrls: session.capturedUrls,
          capturedNames: session.capturedNames,
        }).catch(() => {});
      });
      }
    }
  }
});

chrome.windows.onRemoved.addListener(async windowId => {
  await ensureStateRestored();
  const session = activeSessions.get(windowId);
  if (!session) return;

  saveSessionToDb(session);
  activeSessions.delete(windowId);
  persistActiveSessions();
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

  const driveResult = handleDriveMessage(request, sender, sendResponse);
  if (driveResult !== undefined) return driveResult;

  const aiResult = handleAiMessage(request, sender, sendResponse);
  if (aiResult !== undefined) return aiResult;

  const browserWindowResult = handleBrowserWindowMessage(request, sender, sendResponse);
  if (browserWindowResult !== undefined) return browserWindowResult;

  const searchResult = handleSearchMessage(request, sender, sendResponse);
  if (searchResult !== undefined) return searchResult;

  const hotkeyResult = handleHotkeyMessage(request, sender, sendResponse);
  if (hotkeyResult !== undefined) return hotkeyResult;

  if (handleExtractorMessage(request, sender, sendResponse)) return true;
  if (handleElementPickerMessage(request, sender, sendResponse)) return true;

  const authResult = handleAuthMessage(request, sender, sendResponse);
  if (authResult !== undefined) return authResult;

  if (request.action === 'track_ai_session') {
    const { prompt, tabIds, models, aiPromptId } = request;
    const sessionId = Date.now().toString();
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



  if (request.action === 'run_automation') {
    executeAutomation(request.automation).catch(console.error);
    sendResponse({ ok: true });
    return true;
  }

  if (request.action === 'stop_automation') {
    stopCurrentAutomation();
    sendResponse({ ok: true });
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
  if (alarm.name === 'tasklabs-periodic-sync') {
    console.log('[BackgroundSync] Periodic sync alarm fired');
    await backgroundSync();
    return;
  }

  if (alarm.name === 'cmdos-drive-backup-alarm') {
    await handleBackupAlarm(alarm);
    return;
  }

  if (alarm.name.startsWith('automation_')) {
    handleAutomationAlarm(alarm);
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
  
  if (alarm.name === 'tasklabs-drive-pull') {
    console.log('[DriveContinuation] Hourly Drive pull alarm fired');
    try {
      // const result = await runDrivePullCheck();
      // console.log('[DriveContinuation] Pull cycle result:', result);
    } catch (err) {
      console.error('[DriveContinuation] Error during pull alarm handler:', err);
    }
    return;
  }

  if (alarm.name === 'tasklabs-auto-backup') {
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
