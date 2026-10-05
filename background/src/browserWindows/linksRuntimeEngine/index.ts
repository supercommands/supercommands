/**
 * @file index.ts
 * @description Entry point for the links runtime execution engine.
 */
import { pendingAutoSubmitTabs, tabPromptQueues, processTabQueue } from '@chatAgents/runtimeExecutionEngine';
import { findMatchingTab } from '../chatRuntimeEngine';
import { activeSessions, getValidatedActiveSessionForWindow, openOrReuseNoteSnippetTabInWindow } from '@browserWindows/sessions';
import { db } from '../../../../src/storage/indexDB/dbConfig';
import { getAllUserShortcuts } from '../../../../src/shared-components/shortcuts/core/shortcutDbData';
import { extractSnippetIdFromCompoundId } from '../../../../src/shared-components/utils/idGenerator';

const SESSION_REFERENCE_TYPES = new Set(['note', 'link', 'snippet', 'agent']);
const WEBSITE_SHORTCUT_TYPES = new Set(['note', 'notes', 'snippet', 'snippets', 'link', 'links', 'tabgroup']);

const normalizeWebsiteShortcutType = (referenceType: unknown) => {
  const type = String(referenceType || '').toLowerCase();
  if (type === 'note' || type === 'notes') return 'note';
  if (type === 'snippet' || type === 'snippets') return 'snippet';
  if (type === 'link' || type === 'links' || type === 'tabgroup') return 'link';
  return '';
};

const isSessionReferenceUrl = (url?: string): boolean => {
  if (!url) return false;
  try {
    const parsed = new URL(url, 'chrome-extension://session-reference/');
    const type = parsed.searchParams.get('type');
    const id =
      parsed.searchParams.get('id') ||
      parsed.searchParams.get('entityId') ||
      parsed.searchParams.get('noteid') ||
      parsed.searchParams.get('linkid') ||
      parsed.searchParams.get('snippetid') ||
      parsed.searchParams.get('agentid');
    return Boolean(type && id && SESSION_REFERENCE_TYPES.has(type));
  } catch {
    return false;
  }
};

export function handleLinksMessage(
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void,
): boolean | undefined {
  if (request.action === 'open_tab_in_workspace') {
    request = {...request, action: 'open_tab_in_session', sessionId: request.workspaceId};
  }
  if (request.action === 'get_website_snippet_links') {
    void (async () => {
      try {
        const links = await db.links.toArray();
        const sanitizedLinks = links
          .filter(link => !link.deletedAt)
          .map(link => ({
            id: link.id,
            title: link.title,
            tagIds: Array.isArray(link.tagIds) ? link.tagIds : [],
            urls: Array.isArray(link.urls)
              ? link.urls
                .map(urlItem => ({
                  id: urlItem?.id,
                  title: urlItem?.title,
                  name: urlItem?.name,
                  url: typeof urlItem?.url === 'string' ? urlItem.url : '',
                  favIconUrl: urlItem?.favIconUrl,
                }))
                .filter(urlItem => urlItem.url.trim())
              : [],
            updatedAt: link.updatedAt,
          }))
          .filter(link => link.urls.length > 0);

        sendResponse({ ok: true, links: sanitizedLinks });
      } catch (error) {
        console.error('[LinksRuntime] Failed to load website snippet links:', error);
        sendResponse({ ok: false, links: [], error: String(error) });
      }
    })();
    return true;
  }

  if (request.action === 'get_website_snippet_shortcuts') {
    void (async () => {
      try {
        const [shortcuts, snippets, links, notes] = await Promise.all([
          getAllUserShortcuts().catch(() => []),
          db.snippets.toArray(),
          db.links.toArray(),
          db.notes.toArray(),
        ]);

        const snippetIds = new Set(
          snippets
            .filter(snippet => !snippet.deletedAt)
            .map(snippet => String((snippet as any).snippet_id || snippet.id || '').trim())
            .filter(Boolean),
        );
        const linkIds = new Set(
          links
            .filter(link => !link.deletedAt)
            .map(link => String(link.id || '').trim())
            .filter(Boolean),
        );
        const noteIds = new Set(
          notes
            .filter(note => !note.deletedAt)
            .map(note => String(note.id || '').trim())
            .filter(Boolean),
        );

        const websiteShortcuts = shortcuts
          .map(shortcut => {
            const type = normalizeWebsiteShortcutType(shortcut.referenceType);
            const referenceId = String(shortcut.referenceId || '').trim();
            const actualReferenceId = extractSnippetIdFromCompoundId(referenceId);
            const trigger = String(shortcut.trigger || '').trim().toLowerCase();
            if (!trigger || !type || !WEBSITE_SHORTCUT_TYPES.has(String(shortcut.referenceType || '').toLowerCase())) return null;

            const ids = type === 'snippet' ? snippetIds : type === 'link' ? linkIds : noteIds;
            const hasReference = ids.has(referenceId) || ids.has(actualReferenceId);
            if (!hasReference) return null;

            return {
              trigger,
              referenceId,
              actualReferenceId,
              referenceType: type,
            };
          })
          .filter(Boolean);

        sendResponse({
          ok: true,
          shortcuts: websiteShortcuts,
          snippets: snippets
            .filter(snippet => !snippet.deletedAt)
            .map(snippet => ({ id: snippet.id, title: snippet.title, config: snippet.config, tagIds: snippet.tagIds })),
          notes: notes
            .filter(note => !note.deletedAt)
            .map(note => ({ id: note.id, title: note.title, body: note.body, tagIds: note.tagIds })),
        });
      } catch (error) {
        console.error('[LinksRuntime] Failed to load website snippet shortcuts:', error);
        sendResponse({ ok: false, shortcuts: [], error: String(error) });
      }
    })();
    return true;
  }

  if (request.action === 'open_multiple_links') {
    const { links, delay = 200 } = request;
    if (!Array.isArray(links)) {
      sendResponse({ ok: false, error: 'invalid_links' });
      return false;
    }

    links.forEach((linkObj, index) => {
      const url = typeof linkObj === 'string' ? linkObj : linkObj.url;
      const autoSubmit = typeof linkObj === 'string' ? null : linkObj.autoSubmit;

      setTimeout(() => {
        try {
          const urlObj = new URL(url);
          chrome.tabs.query({ url: `${urlObj.origin}/*` }, tabs => {
            const match = findMatchingTab(url, tabs || []);
            if (match && match.id) {
              chrome.tabs.update(match.id, { active: index === 0 });
              if (autoSubmit) {
                const q = tabPromptQueues.get(match.id) || [];
                q.push(autoSubmit as any);
                tabPromptQueues.set(match.id, q);

                if (match.status === 'complete') {
                  processTabQueue(match.id);
                }
              }
            } else {
              chrome.tabs.create({ url, active: index === 0 }, tab => {
                if (autoSubmit && tab?.id) {
                  const q = tabPromptQueues.get(tab.id) || [];
                  q.push(autoSubmit as any);
                  tabPromptQueues.set(tab.id, q);

                  if (tab.status === 'complete') {
                    processTabQueue(tab.id);
                  }
                }
              });
            }
          });
        } catch (e) {
          chrome.tabs.query({ url: url }, tabs => {
            if (tabs && tabs.length > 0) {
              const tab = tabs[0];
              if (tab.id) {
                chrome.tabs.update(tab.id, { active: index === 0 });
                if (autoSubmit) {
                  const q = tabPromptQueues.get(tab.id) || [];
                  q.push(autoSubmit as any);
                  tabPromptQueues.set(tab.id, q);

                  if (tab.status === 'complete') {
                    processTabQueue(tab.id);
                  }
                }
              }
            } else {
              chrome.tabs.create({ url, active: index === 0 }, tab => {
                if (autoSubmit && tab?.id) {
                  pendingAutoSubmitTabs.set(tab.id, autoSubmit);
                }
              });
            }
          });
        }
      }, index * delay);
    });

    sendResponse({ ok: true });
    return true;
  }

  if (request.action === 'focus_or_open_tab') {
    const url = typeof request.url === 'string' ? request.url : '';
    if (!url) {
      sendResponse({ ok: false, error: 'missing_url' });
      return false;
    }

    chrome.tabs.query({}, tabs => {
      const existingTab = tabs.find(t => t.url === url || t.url === url + '/');
      if (existingTab && existingTab.id) {
        chrome.tabs.update(existingTab.id, { active: true }, () => {
          chrome.windows.update(existingTab.windowId, { focused: true });
          sendResponse({ ok: true, focused: true });
        });
      } else {
        chrome.tabs.create({ url }, () => {
          sendResponse({ ok: true, focused: false });
        });
      }
    });
    return true;
  }

  if (request.action === 'open_tab') {
    const debugMessages: string[] = [];
    debugMessages.push(`[DEBUG] Background: open_tab received\nurl: ${request.url}`);

    if (!chrome.tabs?.create) {
      debugMessages.push('[DEBUG] Background: tabs API unavailable');
      sendResponse({ ok: false, error: 'tabs_api_unavailable', debugMessages });
      return false;
    }

    const url = typeof request.url === 'string' ? request.url : '';
    if (!url) {
      debugMessages.push('[DEBUG] Background: Missing URL');
      sendResponse({ ok: false, error: 'missing_url', debugMessages });
      return false;
    }

    debugMessages.push(`[DEBUG] Background: Creating tab\nurl: ${url}`);

    const sourceTabId = request.sourceTabId;

    void (async () => {
      let windowId = typeof sender?.tab?.windowId === 'number' ? sender.tab.windowId : undefined;
      if (typeof windowId !== 'number' && typeof sourceTabId === 'number') {
        const sourceTab = await chrome.tabs.get(sourceTabId).catch(() => null);
        windowId = sourceTab?.windowId;
      }
      if (typeof windowId !== 'number') {
        const currentWindow = await chrome.windows.getLastFocused().catch(() => null);
        windowId = currentWindow?.id;
      }

      const reuseResult = await openOrReuseNoteSnippetTabInWindow(url, {
        windowId,
        active: request.active !== undefined ? request.active : true,
        createIfMissing: false,
      });
      if (reuseResult.reused) {
        debugMessages.push(`[DEBUG] Background: Reused note/snippet tab\ntabId: ${reuseResult.tab?.id ?? null}`);
        sendResponse({ ok: true, tabId: reuseResult.tab?.id ?? null, reused: true, debugMessages });
        return;
      }

      if (sourceTabId) {
        chrome.tabs.update(sourceTabId, { url }, tab => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            chrome.tabs.create({ url, active: request.active !== undefined ? request.active : true }, () =>
              sendResponse({ ok: true, debugMessages }),
            );
          } else {
            sendResponse({ ok: true, tabId: sourceTabId, debugMessages });
          }
        });
        return;
      }

      chrome.tabs.create({ url, active: request.active !== undefined ? request.active : true }, tab => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          debugMessages.push(`[DEBUG] Background: tabs.create failed\n${lastError.message}`);
          debugMessages.push(`[DEBUG] Background: Attempted URL was: ${url}`);
          debugMessages.push(`[DEBUG] Background: Extension ID: ${chrome.runtime.id}`);

          try {
            const manifestUrl = chrome.runtime.getURL('manifest.json');
            debugMessages.push(`[DEBUG] Background: Manifest URL: ${manifestUrl}`);
          } catch (e) {
            debugMessages.push(`[DEBUG] Background: Could not get manifest URL`);
          }

          sendResponse({ ok: false, error: lastError.message || 'tabs_create_failed', debugMessages });
          return;
        }
        debugMessages.push(`[DEBUG] Background: Tab created successfully\ntabId: ${tab?.id ?? null}\nurl: ${url}`);
        sendResponse({ ok: true, tabId: tab?.id ?? null, debugMessages });
      });
    })();

    return true;
  }

  if (request.action === 'tabs_query') {
    if (!chrome.tabs?.query) {
      sendResponse({ ok: false, results: [], error: 'tabs_api_unavailable' });
      return false;
    }
    try {
      chrome.tabs.query(request.queryOptions || {}, tabs => {
        const sanitized = (tabs || []).map(tab => ({
          id: tab.id ?? -1,
          url: tab.url ?? '',
          title: tab.title ?? '',
          favIconUrl: tab.favIconUrl ?? '',
          windowId: tab.windowId ?? -1,
          active: Boolean(tab.active),
          index: tab.index ?? 0,
        }));
        sendResponse({ ok: true, results: sanitized });
      });
      return true;
    } catch (err) {
      sendResponse({ ok: false, results: [], error: String(err) });
      return false;
    }
  }

  if (request.action === 'open_tab_in_session') {
    const { sessionId, url } = request;
    if (isSessionReferenceUrl(url)) {
      sendResponse({ ok: false, error: 'session_reference_url_not_openable' });
      return false;
    }

    void (async () => {
      let matchedSession: any = null;
      for (const windowId of Array.from(activeSessions.keys())) {
        const session = await getValidatedActiveSessionForWindow(windowId);
        if (session?.sessionId === sessionId) {
          matchedSession = session;
          break;
        }
      }

      if (!matchedSession?.windowId) {
        sendResponse({ ok: false, error: 'session_not_found' });
        return;
      }

      const tab = await chrome.tabs.create({ windowId: matchedSession.windowId, url, active: true });
      sendResponse({ ok: true, tabId: tab?.id });
    })().catch(error => {
      console.error('[LinksRuntime] Failed to open tab in validated session:', error);
      sendResponse({ ok: false, error: 'open_tab_in_session_failed' });
    });
    return true;
  }

  return undefined;
}
