/**
 * @file index.ts
 * @description Entry point for the links runtime execution engine.
 */
import { pendingAutoSubmitTabs } from '@automation/runtime_Execution_Engine/runner';
import { tabPromptQueues, processTabQueue } from '@chatAgents/runtimeExecutionEngine';
import { findMatchingTab } from '../chatRuntimeEngine';
import { activeSessions, getValidatedActiveSessionForWindow } from '@browserWindows/sessions';

const SESSION_REFERENCE_TYPES = new Set(['note', 'link', 'snippet', 'agent']);

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
      return true;
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
