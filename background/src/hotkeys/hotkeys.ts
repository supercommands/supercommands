/**
 * @file hotkeys.ts
 * @description Manages keyboard shortcuts and hotkeys.
 *
 * This module is responsible for interpreting and executing global hotkeys
 * triggered by the user. It resolves snippet IDs to URLs, handles navigation
 * or opening notes based on the hotkey context, and interacts with local storage
 * to fetch user-specific shortcut mappings.
 */
import { extractSnippetId as extractEntityId } from '@todos/todos';

import { createNotification } from '@notifications/notifications';
import { db } from '../../../src/storage/indexDB/dbConfig';
import { resolveEntityById } from '../../../src/shared-components/utils/entityResolver';
import { handleSessionMessage } from '@browserWindows/sessions';

let cachedHotkeysMap: Record<string, { id: string; type: string }> | null = null;

const extractSessionLaunchPayload = (sessionRecord: any) => {
  let initialUrls: string[] = [];
  let initialNames: string[] = [];

  if (Array.isArray(sessionRecord?.urls)) {
    sessionRecord.urls.forEach((entry: any) => {
      const url = typeof entry === 'string' ? entry : entry?.url;
      if (!url) return;
      initialUrls.push(url);
      initialNames.push(typeof entry === 'string' ? '' : entry?.title || entry?.name || '');
    });
  }

  if (initialUrls.length === 0) {
    const value = sessionRecord?.value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          initialUrls = parsed.map((entry: any) => entry?.url || entry).filter(Boolean);
          initialNames = parsed
            .map((entry: any) => entry?.name || entry?.title || '')
            .filter((_: any, index: number) => !!initialUrls[index]);
        } else if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.urls)) initialUrls = parsed.urls.filter(Boolean);
          if (Array.isArray(parsed.names)) initialNames = parsed.names;
        }
      } catch {
        if (value.startsWith('http')) {
          initialUrls = [value];
          initialNames = [''];
        }
      }
    } else if (value && typeof value === 'object' && Array.isArray(value.urls)) {
      initialUrls = value.urls.filter(Boolean);
      initialNames = Array.isArray(value.names) ? value.names : [];
    }
  }

  return { initialUrls, initialNames };
};

/**
 * Message handler for executing hotkeys. Supports triggering UI-bound commands
 * as well as background snippet resolutions (extracting URLs from snippets and opening them).
 *
 * @param request The message payload (actions: `trigger_hotkey`, `execute_global_hotkey`, `GET_ALL_HOTKEYS`).
 * @param sender Information about the script context that sent the message.
 * @param sendResponse Callback function to send a JSON response back to the caller.
 * @returns {boolean | undefined} Returns true if the message handler is responding asynchronously.
 */
export function handleHotkeyMessage(
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void,
): boolean | undefined {
  if (request.action === 'GET_ALL_HOTKEYS') {
    if (cachedHotkeysMap) {
      sendResponse({ hotkeysMap: cachedHotkeysMap });
      return false; // synchronous
    }

    db.userHotkeys
      .toArray()
      .then(hotkeys => {
        const hotkeysMap: Record<string, { id: string; type: string }> = {};

        hotkeys.forEach(hk => {
          hotkeysMap[hk.combination] = { id: hk.referenceId, type: hk.referenceType };
        });

        cachedHotkeysMap = hotkeysMap;
        sendResponse({ hotkeysMap });
      })
      .catch(err => {
        console.error('Failed to get hotkeys from DB:', err);
        sendResponse({ error: err.message });
      });
    return true; // Keep channel open for async response
  }

  if (request.action === 'INVALIDATE_HOTKEYS_CACHE') {
    cachedHotkeysMap = null;

    // Broadcast to all tabs to reload their local hotkeys map
    chrome.tabs.query({}, tabs => {
      tabs.forEach(tab => {
        if (tab.id) chrome.tabs.sendMessage(tab.id, { action: 'RELOAD_HOTKEYS' }).catch(() => {});
      });
    });

    sendResponse({ success: true });
    return false;
  }

  if (request.action === 'trigger_hotkey') {
    const { type, id } = request;
    const senderTabId = sender.tab?.id;
    // For commands, automations, agents and modules, open the AltS_search_newtab page with trigger params (needs UI)
    if (['command', 'module', 'automation', 'agent', 'chat_agent'].includes(type)) {
      // Normalize ID (strip slashes and all common UI/internal prefixes)
      let normalizedId = String(id || '');
      if (normalizedId.startsWith('/')) normalizedId = normalizedId.substring(1);
      normalizedId = normalizedId
        .replace(/^cmd-/, '')
        .replace(/^lcmd-/, '')
        .replace(/^auto-/, '')
        .replace(/^agent-/, '');

      const url = chrome.runtime.getURL(
        `AltS_search_newtab/index.html?trigger_hotkey=true&type=${type}&id=${encodeURIComponent(normalizedId)}`,
      );
      chrome.tabs.create({ url, active: true });
      sendResponse({ ok: true });
      return true;
    }

    // For links and notes, open directly in current tab (omnibox-style)
    // Reuse the execute_global_hotkey logic
    const compoundId = id as string;

    if (!compoundId) {
      sendResponse({ ok: false, error: 'missing_id' });
      return false;
    }

    // Fetch the entity data natively from the central entity resolver (checks all Dexie stores)
    resolveEntityById(compoundId).then(resolved => {
      try {
        if (!resolved) {
          console.warn('[Background] trigger_hotkey: Entity not found in Dexie:', { compoundId });
          sendResponse({ ok: false, error: 'entity_not_found' });
          return;
        }

        const foundEntity = resolved.entity as any;
        const actualEntityId = foundEntity.id || foundEntity.snippet_id || compoundId;
        const type = resolved.type;

        if (type === 'session') {
          const { initialUrls, initialNames } = extractSessionLaunchPayload(foundEntity);
          const sessionRequest = {
            action: 'start_session',
            sessionId: actualEntityId,
            sessionName: foundEntity.title || foundEntity.key || foundEntity.name || 'Untitled Tab Session',
            workspaceId: foundEntity.workspaceId || foundEntity.workspace_id || null,
            folderId: foundEntity.folderId || foundEntity.folder_id || null,
            teamId: 'local',
            storageMode: 'local',
            initialUrls,
            initialNames,
            openSettings: foundEntity.sessionOpenSettings,
            isInlineCreation: true,
          };

          const result = handleSessionMessage(sessionRequest, sender, sendResponse);
          if (result !== undefined) {
            return;
          }
        }

        // Helper function to extract URLs from a snippet/link/note/etc.
        const extractUrls = (entityData: any, entityType: string): string[] => {
          if (entityType === 'link' && Array.isArray(entityData?.urls)) {
            return entityData.urls.map((u: any) => (typeof u === 'string' ? u : u.url)).filter(Boolean);
          }
          if (entityType === 'session' && Array.isArray(entityData?.urls)) {
            return entityData.urls.map((u: any) => (typeof u === 'string' ? u : u.url)).filter(Boolean);
          }

          const value = entityData?.value;
          if (!value) return [];

          // If value is a string, try to parse as JSON
          if (typeof value === 'string') {
            try {
              const parsed = JSON.parse(value);
              if (parsed?.urls && Array.isArray(parsed.urls)) {
                return parsed.urls.filter(
                  (u: any) => typeof u === 'string' && (u.startsWith('http') || u.startsWith('note:')),
                );
              }
            } catch {
              // If it's a plain URL string
              if (value.startsWith('http') || value.startsWith('note:')) {
                return [value];
              }
            }
            return [];
          }

          // If value is an object with urls array
          if (typeof value === 'object' && value?.urls && Array.isArray(value.urls)) {
            return value.urls.filter(
              (u: any) => typeof u === 'string' && (u.startsWith('http') || u.startsWith('note:')),
            );
          }

          return [];
        };

        let urls = extractUrls(foundEntity, type);

        // Handle Note/Snippet category - construct internal URL
        if (urls.length === 0 && (type === 'note' || type === 'snippet' || type === 'todo' || type === 'chatAgent')) {
          const noteUrl = chrome.runtime.getURL(
            `AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(actualEntityId)}`,
          );
          urls = [noteUrl];
        }

        if (!urls.length) {
          sendResponse({ ok: false, error: 'no_urls_found' });
          return;
        }

        // Resolve note: URLs to full extension URLs
        const resolvedUrls: string[] = urls.map(url => {
          if (url.startsWith('note:')) {
            const noteId = url.substring(5);
            return chrome.runtime.getURL(`AltS_search_newtab/index.html?open_note=true&noteid=${noteId}`);
          }
          return url;
        });

        // Always open in new tabs to avoid disturbing current activity (back to original behavior)
        if (resolvedUrls.length > 0) {
          resolvedUrls.forEach((url, index) => {
            chrome.tabs.create({ url, active: index === 0 }, () => {
              if (index === resolvedUrls.length - 1) {
                sendResponse({ ok: true, openedUrls: resolvedUrls.length });
              }
            });
          });
        }
      } catch (err) {
        console.error('[Background] trigger_hotkey error:', err);
        sendResponse({ ok: false, error: String(err) });
      }
    });

    return true; // async
  }

  // Execute global hotkey - called from content scripts when user triggers a hotkey on any website
  if (request.action === 'execute_global_hotkey') {
    const compoundId = request.snippetId as string;
    if (!compoundId) {
      sendResponse({ ok: false, error: 'missing_snippet_id' });
      return false;
    }

    resolveEntityById(compoundId).then(resolved => {
      try {
        if (!resolved) {
          console.warn('[Background] execute_global_hotkey: Entity not found in Dexie:', { compoundId });
          sendResponse({ ok: false, error: 'entity_not_found' });
          return;
        }

        const foundEntity = resolved.entity as any;
        const actualEntityId = foundEntity.id || foundEntity.snippet_id || compoundId;
        const type = resolved.type;

        if (type === 'session') {
          const { initialUrls, initialNames } = extractSessionLaunchPayload(foundEntity);
          const sessionRequest = {
            action: 'start_session',
            sessionId: actualEntityId,
            sessionName: foundEntity.title || foundEntity.key || foundEntity.name || 'Untitled Tab Session',
            workspaceId: foundEntity.workspaceId || foundEntity.workspace_id || null,
            folderId: foundEntity.folderId || foundEntity.folder_id || null,
            teamId: 'local',
            storageMode: 'local',
            initialUrls,
            initialNames,
            openSettings: foundEntity.sessionOpenSettings,
            isInlineCreation: true,
          };

          const result = handleSessionMessage(sessionRequest, sender, sendResponse);
          if (result !== undefined) {
            return;
          }
        }

        const extractUrls = (entityData: any, entityType: string): string[] => {
          if (entityType === 'link' && Array.isArray(entityData?.urls)) {
            return entityData.urls.map((u: any) => (typeof u === 'string' ? u : u.url)).filter(Boolean);
          }
          if (entityType === 'session' && Array.isArray(entityData?.tabs)) {
            return entityData.tabs.map((t: any) => t.url).filter(Boolean);
          }

          const value = entityData?.value;
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
              if (value.startsWith('http') || value.startsWith('note:')) {
                return [value];
              }
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

        let urls = extractUrls(foundEntity, type);

        if (urls.length === 0 && (type === 'note' || type === 'snippet' || type === 'todo' || type === 'chatAgent')) {
          const noteUrl = chrome.runtime.getURL(
            `AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(actualEntityId)}`,
          );
          urls = [noteUrl];
        }

        if (!urls.length) {
          sendResponse({ ok: false, error: 'no_urls_found' });
          return;
        }

        chrome.tabs.query({ active: true, currentWindow: true }, async tabs => {
          const currentTab = tabs?.[0];
          const resolvedUrls: string[] = [];

          for (const url of urls) {
            if (url.startsWith('note:')) {
              const noteId = url.substring(5);
              const noteUrl = chrome.runtime.getURL(`AltS_search_newtab/index.html?open_note=true&noteid=${noteId}`);
              resolvedUrls.push(noteUrl);
            } else {
              resolvedUrls.push(url);
            }
          }

          if (resolvedUrls.length === 1) {
            if (currentTab?.id) {
              chrome.tabs.update(currentTab.id, { url: resolvedUrls[0] }, () => {
                sendResponse({ ok: true, openedUrls: resolvedUrls.length });
              });
            } else {
              chrome.tabs.create({ url: resolvedUrls[0] }, () => {
                sendResponse({ ok: true, openedUrls: resolvedUrls.length });
              });
            }
          } else if (resolvedUrls.length > 1) {
            const [firstUrl, ...restUrls] = resolvedUrls;

            const openRest = () => {
              restUrls.forEach(url => {
                chrome.tabs.create({ url, active: false });
              });
              sendResponse({ ok: true, openedUrls: resolvedUrls.length });
            };

            if (currentTab?.id) {
              chrome.tabs.update(currentTab.id, { url: firstUrl }, () => {
                openRest();
              });
            } else {
              chrome.tabs.create({ url: firstUrl }, () => {
                openRest();
              });
            }
          }
        });
      } catch (err) {
        console.error('[Background] execute_global_hotkey error:', err);
        sendResponse({ ok: false, error: String(err) });
      }
    });

    return true;
  }

  return undefined;
}
