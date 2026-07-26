/**
 * @file todos.ts
 * @description Core logic and operations for handling todo entities.
 */
// Removed nowUtc and isLocalEntityId

/**
 * @file todos.ts
 * @description Manages tasks and todo logic, including background syncing and execution.
 *
 * This module is responsible for syncing todos with the backend, maintaining recurring
 * tasks, resolving snippet data across multiple storage locations, and executing actions
 * associated with a task (like opening URLs, automating clicks, or showing notes).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createNotification } from '@notifications/notifications';
import { showInTabToast } from '@notifications/inTabToasts';
import { db } from '../../../src/storage/indexDB/dbConfig';

/**
 * Extract actual snippet ID - safely handles UUIDs and prefixed IDs
 */
export function extractSnippetId(id: string): string {
  if (!id) return '';
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const match = id.match(uuidRegex);
  return match ? match[0] : id;
}

export async function backgroundSync() {
  try {
    // API logic removed
    // Also process todo maintenance (auto-done for overdue tasks)
    await processTodoMaintenance();
  } catch (err) {
    console.error('[BackgroundSync] Error:', err);
  }
}

export async function processTodoMaintenance() {
  try {
    const result = await chrome.storage.local.get(['local_todos']);
    const localTodos = result.local_todos || [];
    let changed = false;

    const nowStr = new Date().toDateString();

    const filteredLocalTodos = localTodos.filter((todo: any) => {
      if (todo.is_done) {
        // Erase old done tasks from previous days
        const completionDateStr = todo.updated_at || todo.event_deadline || new Date().toISOString();
        const completionDate = new Date(completionDateStr.replace(' ', 'T'));
        if (!isNaN(completionDate.getTime()) && completionDate.toDateString() !== nowStr) {
          changed = true;
          return false;
        }
      }
      return true;
    });

    const updated = await Promise.all(
      filteredLocalTodos.map(async (todo: any) => {
        return todo;
      }),
    );

    if (changed) {
      await chrome.storage.local.set({ local_todos: updated });
      chrome.tabs.query({}, tabs => {
        tabs.forEach(tab => {
          if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'TODOS_UPDATED' }).catch(() => {});
        });
      });
    }
  } catch (err) {
    console.error('[TodoMaintenance] Error:', err);
  }
}

/**
 * Automatically completes a todo (used for notification clicks)
 * Exactly mirrors the logic in TodosList.tsx
 */
export async function completeTodoInBg(todoId: string) {
  try {
    const todo = await findTodoById(todoId);
    if (!todo) {
      console.warn('[Background] completeTodoInBg: Todo not found', todoId);
      return;
    }

    const sid = String(todo.snippet_id || todo.id);
    const isRecurring = !!(todo.is_recurring || todo.recurring);
    const recurringCycle = (todo.recurring_cycle || todo.recurring_frequency || 'none').toLowerCase();

    let nextDeadline = todo.event_deadline;
    let newDoneStatus = true;
    let historyTask: any = null;

    if (isRecurring && recurringCycle !== 'none') {
      const now = Date.now();
      const deadlineStr = todo.event_deadline || new Date().toISOString();
      let nextRunTime = new Date(deadlineStr.replace(' ', 'T')).getTime();

      // If it is a dummy "anytime" year (>= 2035), base the next recurrence on current time instead of 2075
      if (new Date(nextRunTime).getFullYear() >= 2035) {
        nextRunTime = now;
      }

      if (isNaN(nextRunTime)) nextRunTime = now;

      const MIN_GAP = 60 * 1000;
      while (nextRunTime <= now + MIN_GAP) {
        if (recurringCycle === 'daily') nextRunTime += 24 * 60 * 60 * 1000;
        else if (recurringCycle === 'weekly') nextRunTime += 7 * 24 * 60 * 60 * 1000;
        else if (recurringCycle === 'monthly') {
          const tempDate = new Date(nextRunTime);
          tempDate.setMonth(tempDate.getMonth() + 1);
          nextRunTime = tempDate.getTime();
        } else {
          nextRunTime += 24 * 60 * 60 * 1000;
          break;
        }
      }

      nextDeadline = new Date(nextRunTime).toISOString();
      newDoneStatus = false; // Stay active for next cycle (rescheduled)

      // 2. Create a "History" task for today's record
      historyTask = {
        ...todo,
        snippet_id: `hist-${Date.now()}`,
        id: `hist-${Date.now()}`,
        is_done: true,
        is_recurring: false, // History item is a one-time record
        event_deadline: todo.event_deadline, // Keep original deadline for today's record
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    // 3. Update Local Storage
    const result = await chrome.storage.local.get(['local_todos']);
    let localTodos = result.local_todos || [];

    localTodos = localTodos.map((t: any) =>
      String(t.id || t.snippet_id) === sid
        ? { ...t, is_done: newDoneStatus, event_deadline: nextDeadline, updated_at: new Date().toISOString() }
        : t,
    );

    if (historyTask) {
      localTodos = [historyTask, ...localTodos];
    }

    await chrome.storage.local.set({ local_todos: localTodos });

    // Cloud Sync removed

    // 5. Alarm Management
    if (newDoneStatus && !isRecurring) {
      chrome.alarms.clear(`todo|${sid}`);
    } else if (isRecurring) {
      // Reschedule alarm for next occurrence
      chrome.alarms.create(`todo|${sid}`, { when: new Date(nextDeadline).getTime() });
    }

    // 6. Notify all open tabs to refresh UI
    chrome.tabs.query({}, tabs => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'TODOS_UPDATED' }).catch(() => {});
        }
      });
    });
  } catch (err) {
    console.error('[Background] completeTodoInBg failed:', err);
  }
}

/**
 * Helper to update local_todos in storage from background
 */
export async function updateLocalTodo(todoId: string, updates: any) {
  try {
    const result = await chrome.storage.local.get(['local_todos']);
    const localTodos = result.local_todos || [];
    const actualId = extractSnippetId(todoId);

    let found = false;
    const updated = localTodos.map((t: any) => {
      const tid = String(t.id || t.snippet_id);
      if (tid === String(todoId) || tid === String(actualId)) {
        found = true;
        return { ...t, ...updates };
      }
      return t;
    });

    if (!found) {
      // If not in local_todos yet, add it as a new tracking entry
      updated.push({
        snippet_id: todoId,
        id: todoId,
        is_todo_type: true,
        ...updates,
      });
    }

    await chrome.storage.local.set({ local_todos: updated });
  } catch (err) {
    console.error('[Background] Failed to update local storage:', err);
  }
}

/**
 * Deep search for a todo object in all available caches
 */
export async function findTodoById(todoId: string): Promise<any | null> {
  try {
    const actualId = extractSnippetId(todoId);

    // Check Dexie database
    const todo = (await db.todos.get(actualId)) || (await db.todos.get(todoId));

    if (todo) {
      return {
        ...todo,
        id: todo.id,
        snippet_id: todo.id,
        todo_id: todo.id,
        key: todo.name, // Map name to key/title
        title: todo.name,
        category: 'custom',
        value: todo.description || '',
        is_done: todo.isDone,
        is_recurring: todo.scheduleType === 'recurring',
        recurring_cycle: todo.recurringType || null,
        event_deadline: new Date(todo.scheduleTime).toISOString(),
        created_at: new Date(todo.createdAt).toISOString(),
        updated_at: new Date(todo.updatedAt).toISOString(),
      };
    }
  } catch (e) {
    console.error('[Background] Failed to pull from dexie', e);
  }
  return null;
}

/**
 * Execute the action associated with a Todo (Open URL, Note, or Automation)
 */
export async function executeTodoAction(todoId: string) {
  try {
    const todo = await findTodoById(todoId);
    if (!todo) {
      console.warn('[Background] Cannot execute action: Todo not found:', todoId);
      return;
    }

    // A. Check if this is a config-based multi-item todo
    let config = todo.config;
    if (typeof config === 'string' && config.trim().startsWith('{')) {
      try {
        config = JSON.parse(config);
      } catch (e) {
        console.error('[Background] Failed to parse todo config:', config, e);
      }
    }

    const configIds = config?.id;
    if (Array.isArray(configIds) && configIds.length > 0) {
      const storageResult = await new Promise<any>(resolve => {
        chrome.storage.local.get(['myCachedAllData', 'myFavouriteItems', 'local_todos', 'alts_commands'], resolve);
      });

      const allData = storageResult.myCachedAllData || [];
      const favourites = storageResult.myFavouriteItems || {};
      const altsCommands = storageResult.alts_commands || [];

      const findItemDetails = (itemId: string) => {
        const cidStr = String(itemId);
        const strippedCid = cidStr.replace(/^(auto-|cmd-|mod-)/, '');

        let matched = altsCommands.find((c: any) => {
          const cIdStr = String(c.id || '');
          const strippedCId = cIdStr.replace(/^(auto-|cmd-|mod-)/, '');
          return cIdStr === cidStr || strippedCId === strippedCid;
        });
        if (matched) return matched;

        for (const userId of Object.keys(favourites)) {
          const userFavs = favourites[userId];
          if (Array.isArray(userFavs)) {
            matched = userFavs.find((item: any) => {
              const itemIdStr = String(item.id || item.snippet_id || '');
              const strippedItemId = itemIdStr.replace(/^(auto-|cmd-|mod-)/, '');
              return itemIdStr === cidStr || strippedItemId === strippedCid;
            });
            if (matched) return matched;
          }
        }

        if (Array.isArray(allData)) {
          for (const team of allData) {
            for (const workspace of team.workspaces || []) {
              const wsSnippets = workspace.workspace_snippets || [];
              matched = wsSnippets.find((s: any) => {
                const sIdStr = String(s.id || s.snippet_id || '');
                const strippedSId = sIdStr.replace(/^(auto-|cmd-|mod-)/, '');
                return sIdStr === cidStr || strippedSId === strippedCid;
              });
              if (matched) return matched;

              const wsAutos = workspace.workspace_automations || [];
              matched = wsAutos.find((a: any) => {
                const aIdStr = String(a.id || a.automation_id || '');
                const strippedAId = aIdStr.replace(/^(auto-|cmd-|mod-)/, '');
                return aIdStr === cidStr || strippedAId === strippedCid;
              });
              if (matched) return matched;

              for (const folder of workspace.folders || []) {
                const folderSnippets = folder.snippets || [];
                matched = folderSnippets.find((s: any) => {
                  const sIdStr = String(s.id || s.snippet_id || '');
                  const strippedSId = sIdStr.replace(/^(auto-|cmd-|mod-)/, '');
                  return sIdStr === cidStr || strippedSId === strippedCid;
                });
                if (matched) return matched;
              }
            }
          }
        }

        return null;
      };

      for (const cid of configIds) {
        const matched = findItemDetails(cid);
        if (matched) {
          const matchedCat = (matched.category || matched.snippet_category || '').toLowerCase();
          const itemVal = matched.value || matched.data?.value || matched.data?.url || matched.data?.link || '';
          const itemId = matched.id || matched.snippet_id;

          if (
            ['link', 'tabgroup', 'Tab Session', 'links', 'quicklink', 'collection', 'agent_collection'].includes(
              matchedCat,
            )
          ) {
            const urls: string[] = [];
            if (typeof itemVal === 'string') {
              try {
                if (itemVal.trim().startsWith('{') || itemVal.trim().startsWith('[')) {
                  const parsed = JSON.parse(itemVal);
                  if (parsed?.urls) {
                    parsed.urls.forEach((u: any) => urls.push(u));
                  }
                } else if (itemVal.startsWith('http')) {
                  urls.push(itemVal);
                }
              } catch (e) {
                if (itemVal.startsWith('http')) {
                  urls.push(itemVal);
                }
              }
            }
            urls.forEach(url => {
              if (url && typeof url === 'string') {
                chrome.tabs.create({ url });
              }
            });
          } else if (['note', 'snippet', 'prompt', 'custom'].includes(matchedCat)) {
            chrome.tabs.create({
              url: chrome.runtime.getURL(
                `AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(itemId)}`,
              ),
            });
          } else {
            chrome.tabs.create({
              url: chrome.runtime.getURL(
                `AltS_search_newtab/index.html?trigger_hotkey=true&type=${matchedCat}&id=${encodeURIComponent(itemId)}`,
              ),
            });
          }
        }
      }

      const todoStore = await chrome.storage.local.get(['local_todos']);
      const localTodos = (todoStore.local_todos || []).map((t: any) =>
        t.id === todoId || t.snippet_id === todoId ? { ...t, is_done: true } : t,
      );
      await chrome.storage.local.set({ local_todos: localTodos });
      return;
    }

    const category = (todo.category || todo.snippet_category || 'note').toLowerCase();
    const value = todo.value;
    const snippetId = todo.snippet_id || todo.id;
    if (
      ['link', 'tabgroup', 'Tab Session', 'links', 'quicklink', 'collection', 'agent_collection'].includes(category)
    ) {
      // Handle URLs
      let urls: string[] = [];
      try {
        if (typeof value === 'string' && (value.trim().startsWith('{') || value.trim().startsWith('['))) {
          const parsed = JSON.parse(value);
          urls = parsed.urls || [];
        } else if (typeof value === 'string' && value.startsWith('http')) {
          urls = [value];
        } else if (todo.urls) {
          urls = todo.urls;
        }
      } catch (e) {}

      urls.forEach(url => {
        if (url && typeof url === 'string') {
          chrome.tabs.create({ url });
        }
      });
    } else if (['note', 'snippet', 'prompt'].includes(category)) {
      const url = chrome.runtime.getURL(
        `AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(snippetId)}`,
      );
      chrome.tabs.create({ url });
    } else if (['command', 'module', 'automation', 'install', 'agent', 'chat_agent'].includes(category)) {
      const url = chrome.runtime.getURL(
        `AltS_search_newtab/index.html?trigger_hotkey=true&type=${category}&id=${encodeURIComponent(value || snippetId)}`,
      );
      chrome.tabs.create({ url });
    }

    // Mark as done locally
    const todoStore = await chrome.storage.local.get(['local_todos']);
    const localTodos = (todoStore.local_todos || []).map((t: any) =>
      t.id === todoId || t.snippet_id === todoId ? { ...t, is_done: true } : t,
    );
    await chrome.storage.local.set({ local_todos: localTodos });
  } catch (err) {
    console.error('[Background] executeTodoAction failed:', err);
  }
}

/**
 * Shared logic to resolve a snippet/tabgroup/note by ID and execute it (multiple tabs, etc.)
 */
export function resolveAndExecuteSnippet(compoundId: string, sendResponse?: (res: any) => void) {
  if (!compoundId) {
    if (sendResponse) sendResponse({ ok: false, error: 'missing_snippet_id' });
    return;
  }

  const actualSnippetId = extractSnippetId(compoundId);

  chrome.storage.local.get(['myFavouriteItems', 'myCachedAllData', 'local_todos'], result => {
    try {
      let foundSnippet: any = null;

      const extractUrls = (snippet: any): string[] => {
        const value = snippet?.value;
        if (!value) return [];
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            if (parsed?.urls && Array.isArray(parsed.urls)) {
              return parsed.urls.filter(
                (u: any) => typeof u === 'string' && (u.startsWith('http') || u.startsWith('note:')),
              );
            }
          } catch {
            if (value.startsWith('http') || value.startsWith('note:')) return [value];
          }
          return [];
        }
        if (typeof value === 'object' && value?.urls && Array.isArray(value.urls)) {
          return value.urls.filter(
            (u: any) => typeof u === 'string' && (u.startsWith('http') || u.startsWith('note:')),
          );
        }
        return [];
      };

      // 1. Search Local Todos
      const localTodos = result?.local_todos || [];
      foundSnippet = localTodos.find((t: any) => t.id === compoundId || t.id === actualSnippetId);

      // 2. Search Favourites
      if (!foundSnippet) {
        const favourites = result?.myFavouriteItems;
        if (favourites && typeof favourites === 'object') {
          for (const userId of Object.keys(favourites)) {
            const userFavs = favourites[userId];
            if (Array.isArray(userFavs)) {
              for (const item of userFavs) {
                const itemId = item?.id || item?.snippet_id;
                if (itemId === compoundId || itemId === actualSnippetId) {
                  foundSnippet = item;
                  break;
                }
              }
            }
            if (foundSnippet) break;
          }
        }
      }

      // 3. Search All Cached Data
      if (!foundSnippet) {
        const allData = result?.myCachedAllData;
        if (Array.isArray(allData)) {
          for (const team of allData) {
            if (!team?.workspaces) continue;
            for (const workspace of team.workspaces) {
              const wsSnippets = workspace?.workspace_snippets || [];
              for (const snippet of wsSnippets) {
                const snipId = snippet?.id || snippet?.snippet_id;
                if (snipId === compoundId || snipId === actualSnippetId) {
                  foundSnippet = snippet;
                  break;
                }
              }
              if (foundSnippet) break;

              const folders = workspace?.folders || [];
              for (const folder of folders) {
                const folderSnippets = folder?.snippets || [];
                for (const snippet of folderSnippets) {
                  const snipId = snippet?.id || snippet?.snippet_id;
                  if (snipId === compoundId || snipId === actualSnippetId) {
                    foundSnippet = snippet;
                    break;
                  }
                }
                if (foundSnippet) break;
              }
              if (foundSnippet) break;
            }
            if (foundSnippet) break;
          }
        }
      }

      if (!foundSnippet) {
        console.warn('[Background] Snippet not found:', { compoundId });
        if (sendResponse) sendResponse({ ok: false, error: 'snippet_not_found' });
        return;
      }

      let urls = extractUrls(foundSnippet);
      const category = (foundSnippet.category || foundSnippet.snippet_category || '').toLowerCase();

      if (urls.length === 0 && (category === 'note' || category === 'snippet')) {
        const snippetId = foundSnippet.id || foundSnippet.snippet_id;
        if (snippetId) {
          urls = [
            chrome.runtime.getURL(
              `AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(snippetId)}`,
            ),
          ];
        }
      }

      if (!urls.length) {
        if (sendResponse) sendResponse({ ok: false, error: 'no_urls_found' });
        return;
      }

      chrome.tabs.query({ active: true, currentWindow: true }, async tabs => {
        const currentTab = tabs?.[0];
        const resolvedUrls: string[] = [];

        for (const url of urls) {
          if (url.startsWith('note:')) {
            const noteId = url.substring(5);
            const allData = result?.myCachedAllData;
            let foundNote: any = null;
            if (Array.isArray(allData)) {
              for (const team of allData) {
                for (const ws of team.workspaces || []) {
                  for (const snip of ws.workspace_snippets || []) {
                    if ((snip.id || snip.snippet_id) === noteId) {
                      foundNote = snip;
                      break;
                    }
                  }
                  if (foundNote) break;
                }
                if (foundNote) break;
              }
            }
            if (foundNote) {
              await chrome.storage.local.set({
                editSnippetData: {
                  snippet_id: noteId,
                  key: foundNote.key || foundNote.title || '',
                  category: foundNote.category || 'snippet',
                },
              });
            }
            resolvedUrls.push(chrome.runtime.getURL(`AltS_search_newtab/index.html?open_note=true&noteid=${noteId}`));
          } else {
            resolvedUrls.push(url);
          }
        }

        if (resolvedUrls.length === 1) {
          if (currentTab?.id) {
            chrome.tabs.update(currentTab.id, { url: resolvedUrls[0] }, () => sendResponse?.({ ok: true }));
          } else {
            chrome.tabs.create({ url: resolvedUrls[0] }, () => sendResponse?.({ ok: true }));
          }
        } else {
          const [first, ...rest] = resolvedUrls;
          if (currentTab?.id) {
            chrome.tabs.update(currentTab.id, { url: first }, () => {
              rest.forEach(u => chrome.tabs.create({ url: u, active: false }));
              sendResponse?.({ ok: true });
            });
          } else {
            chrome.tabs.create({ url: first }, () => {
              rest.forEach(u => chrome.tabs.create({ url: u, active: false }));
              sendResponse?.({ ok: true });
            });
          }
        }
      });
    } catch (err) {
      console.error('[Background] resolveAndExecuteSnippet error:', err);
      if (sendResponse) sendResponse({ ok: false, error: String(err) });
    }
  });
}

/**
 * Message handler for todo events triggered from the UI or content scripts.
 * Supports scheduling (`schedule_todo_alarm`) and clearing (`clear_todo_alarm`)
 * alarms and immediate notifications.
 *
 * @param request The message payload.
 * @param sender Information about the script context that sent the message.
 * @param sendResponse Callback function to send a JSON response back to the caller.
 * @returns {boolean | undefined} Returns true if the message handler is responding asynchronously.
 */
export function handleTodoMessage(
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (res: any) => void,
): boolean | undefined {
  if (request.action === 'schedule_newtodo_alarm') {
    const { todoId, scheduleTime } = request;
    if (todoId && scheduleTime) {
      const finalScheduleTime = Math.max(scheduleTime, Date.now() + 1000);
      chrome.alarms.create(`todo|${todoId}`, { when: finalScheduleTime });
    }
    sendResponse({ ok: true });
    return false;
  }

  if (request.action === 'clear_newtodo_alarm') {
    const { todoId } = request;
    if (todoId) {
      chrome.alarms.clear(`todo|${todoId}`);
    }
    sendResponse({ ok: true });
    return false;
  }

  if (request.action === 'schedule_todo_alarm') {
    const { todoId, deadline } = request;

    if (todoId && deadline) {
      const timestamp = new Date(deadline).getTime();
      const isImmediate = !!request.immediate;

      // Handle Anytime Tasks (suppress alarms)
      if (request.is_anytime) {
        chrome.alarms.clear(`todo|${todoId}`);
        sendResponse({ ok: true, skipped: true });
        return false; // Sync response
      }

      if (isImmediate) {
        // Trigger notification immediately
        (async () => {
          const todo = await findTodoById(todoId);
          if (todo) {
            const key = todo.key || todo.title || 'Task Reminder';
            const category = (todo.category || todo.snippet_category || '').toLowerCase();
            const value = todo.value || '';
            const isCustom = category === 'note' || category === 'snippet' || category === '';

            let displayMessage = key;
            if (isCustom && value && value !== key) {
              displayMessage += `\n${value}`;
            }

            const iconUrl = chrome.runtime.getURL('icon.png');
            createNotification(`immediate-${todoId}-${Date.now()}`, {
              type: 'basic',
              iconUrl,
              title: 'cmdOS Notification',
              message: displayMessage,
              priority: 2,
            });

            // Reschedule if recurring
            const isRecurring = !!(todo.is_recurring || todo.recurring);
            const recurringCycle = (todo.recurring_cycle || todo.recurring_frequency || 'none').toLowerCase();

            if (isRecurring && recurringCycle !== 'none') {
              const now = new Date();
              const nextRun = new Date();
              if (recurringCycle === 'daily') nextRun.setDate(nextRun.getDate() + 1);
              else if (recurringCycle === 'weekly') nextRun.setDate(nextRun.getDate() + 7);
              else if (recurringCycle === 'monthly') nextRun.setMonth(nextRun.getMonth() + 1);
              else nextRun.setDate(nextRun.getDate() + 1);
              // Create future alarm
              chrome.alarms.create(`todo|${todoId}`, { when: nextRun.getTime() });

              // Update storage via specialized Todo endpoint (ONLY if cloud-synced)
              // API logic removed

              // Update Dexie database directly
              await db.todos.update(todoId, {
                scheduleTime: nextRun.getTime(),
                isDone: false,
                updatedAt: Date.now(),
              });
            }
          }
        })();
        sendResponse({ ok: true });
        return true;
      }

      const now = Date.now();
      const GRACE_PERIOD = 10000; // 10 seconds

      if (timestamp > now || now - timestamp < GRACE_PERIOD) {
        // If it's within the grace period (e.g., just missed it), schedule it for 1 second from now
        const effectiveTimestamp = Math.max(timestamp, now + 1000);

        chrome.alarms.getAll(alarms => {
          const existingAlarms = alarms.filter(
            a =>
              a.name === `todo|${todoId}` ||
              a.name === `reminder|${todoId}` ||
              a.name.includes(`|${todoId}|`) ||
              a.name.endsWith(`|${todoId}`),
          );
          existingAlarms.forEach(a => {
            chrome.alarms.clear(a.name);
          });

          // Main alarm
          const alarmName = `todo|${todoId}`;
          chrome.alarms.create(alarmName, { when: effectiveTimestamp });

          sendResponse({ ok: true });
        });
        return true; // Keep channel open for async response
      } else {
        console.warn(`[Background] Cannot schedule alarm in the past: ${deadline}`);
        sendResponse({ ok: false, error: 'past_deadline' });
        return true;
      }
    }
    sendResponse({ ok: false, error: 'missing_data' });
    return true;
  }

  if (request.action === 'clear_todo_alarm') {
    const { todoId } = request;
    if (todoId) {
      // 1. Clear Alarms
      chrome.alarms.getAll(alarms => {
        const existingAlarms = alarms.filter(
          a =>
            a.name === `todo|${todoId}` ||
            a.name === `reminder|${todoId}` ||
            a.name.includes(`|${todoId}|`) ||
            a.name.endsWith(`|${todoId}`),
        );
        existingAlarms.forEach(a => {
          chrome.alarms.clear(a.name);
        });
      });

      // 2. Clear visible Desktop Notifications
      chrome.notifications.getAll(notifications => {
        Object.keys(notifications).forEach(notifId => {
          if (notifId.includes(`-${todoId}-`) || notifId.endsWith(`-${todoId}`)) {
            chrome.notifications.clear(notifId);
          }
        });
      });
    }
    sendResponse({ ok: true });
    return true;
  }

  return undefined;
}

/**
 * Triggered by the Chrome Alarms API when a scheduled task hits its deadline.
 * Generates user notifications, displays in-tab toasts, and handles
 * recurring task rescheduling.
 *
 * @param alarm The alarm object provided by the Chrome API.
 */
export async function handleTodoAlarm(alarm: chrome.alarms.Alarm) {
  const todoId = alarm.name.split('|')[1];
  if (!todoId) return;

  try {
    const todo = await findTodoById(todoId);
    if (!todo) {
      console.warn('[Background] Alarm triggered but Todo not found:', todoId);
      return;
    }

    if (todo.is_done) return;

    const key = todo.key || todo.title || 'Task Due';
    const category = (todo.category || todo.snippet_category || '').toLowerCase();
    const value = todo.value || '';
    const isCustom = category === 'note' || category === 'snippet' || category === '';

    let displayMessage = key;
    if (isCustom && value && value !== key) {
      displayMessage += '\n' + value;
    }

    const iconUrl = chrome.runtime.getURL('icon.png');

    createNotification(`alarm-${todoId}-${Date.now()}`, {
      type: 'basic',
      iconUrl,
      title: 'cmdOS Notification',
      message: displayMessage,
      priority: 2,
    });

    showInTabToast('cmdOS Notification', key);

    const isRecurring = !!(todo.is_recurring || todo.recurring);
    const recurringCycle = (todo.recurring_cycle || todo.recurring_frequency || 'none').toLowerCase();

    if (isRecurring && recurringCycle !== 'none') {
      const now = Date.now();
      let nextRunTime = alarm.scheduledTime || now;
      const MIN_GAP = 60 * 1000;

      while (nextRunTime <= now + MIN_GAP) {
        if (recurringCycle === 'daily') nextRunTime += 24 * 60 * 60 * 1000;
        else if (recurringCycle === 'weekly') nextRunTime += 7 * 24 * 60 * 60 * 1000;
        else if (recurringCycle === 'monthly') {
          const tempDate = new Date(nextRunTime);
          tempDate.setMonth(tempDate.getMonth() + 1);
          nextRunTime = tempDate.getTime();
        } else {
          nextRunTime += 24 * 60 * 60 * 1000;
          break;
        }
      }
      chrome.alarms.create(`todo|${todoId}`, { when: nextRunTime });

      // Update Dexie database directly
      await db.todos.update(todoId, {
        scheduleTime: nextRunTime,
        isDone: false,
        updatedAt: Date.now(),
      });

      // API logic removed
    }
  } catch (err) {
    console.error('[Background] handleTodoAlarm failed:', err);
  }
}
