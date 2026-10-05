/**
 * @file index.ts
 * @description Entry point for the chat agent runtime execution engine.
 */
import { pendingAutoSubmitTabs, tabPromptQueues, processTabQueue } from '@chatAgents/runtimeExecutionEngine';

export const extractChatId = (urlString: string): string | null => {
  try {
    const url = new URL(urlString);
    const path = url.pathname;
    if (url.hostname.includes('perplexity.ai')) {
      const parts = path.split('-');
      if (parts.length > 1) return parts[parts.length - 1].replace(/\/$/, '');
      const slashParts = path.split('/');
      return slashParts[slashParts.length - 1] || null;
    }
    if (url.hostname.includes('chatgpt.com')) {
      const match = path.match(/\/c\/([^/]+)/);
      if (match) return match[1];
    }
    if (url.hostname.includes('claude.ai')) {
      const match = path.match(/\/chat\/([^/]+)/);
      if (match) return match[1];
    }
    return null;
  } catch (e) {
    return null;
  }
};

export const findMatchingTab = (targetUrl: string, tabs: chrome.tabs.Tab[]): chrome.tabs.Tab | undefined => {
  const targetId = extractChatId(targetUrl);

  if (targetId) {
    return tabs.find(t => {
      if (!t.url) return false;
      return extractChatId(t.url) === targetId;
    });
  }

  try {
    const target = new URL(targetUrl);
    const normalizedTarget = target.origin + target.pathname.replace(/\/$/, '');

    return tabs.find(t => {
      if (!t.url) return false;
      try {
        const tUrl = new URL(t.url);
        const normalizedTUrl = tUrl.origin + tUrl.pathname.replace(/\/$/, '');
        return normalizedTarget === normalizedTUrl;
      } catch (e) {
        return false;
      }
    });
  } catch (e) {
    return tabs.find(t => t.url === targetUrl);
  }
};

export function handleAiTabMessage(
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void,
): boolean | undefined {
  if (request.action === 'open_tab_with_auto_submit') {
    console.log('[BG] Received open_tab_with_auto_submit:', request);
    const url = typeof request.url === 'string' ? request.url : '';
    const forceNewTab = request.forceNewTab === true;
    const active = request.active !== undefined ? request.active : !forceNewTab;
    if (!url) {
      sendResponse({ ok: false, error: 'missing_url' });
      return false;
    }

    const rawAutoSubmit = request.autoSubmit;
    const isValidKind = (kind: unknown): kind is string =>
      typeof kind === 'string' &&
      ['chatgpt', 'claude', 'gemini', 'perplexity', 'mistral', 'copilot', 'google', 'calendar'].includes(kind);

    const autoSubmit =
      rawAutoSubmit && typeof rawAutoSubmit === 'object' && isValidKind((rawAutoSubmit as { kind?: unknown }).kind)
        ? {
            kind: (rawAutoSubmit as { kind: string }).kind,
            prompt: ((rawAutoSubmit as { prompt: string }).prompt || '').trim(),
            images: (rawAutoSubmit as { images?: any[] }).images,
          }
        : null;

    const sourceTabId = request.sourceTabId;
    const targetTabId = typeof request.targetTabId === 'number' ? request.targetTabId : null;

    // Helper to set pending and respond
    const handleTabCreated = (tab: chrome.tabs.Tab | undefined) => {
      console.log('[BG] handleTabCreated called, tab:', tab?.id);
      if (autoSubmit && tab?.id) {
        const q = tabPromptQueues.get(tab.id) || [];
        q.push(autoSubmit as any);
        tabPromptQueues.set(tab.id, q);

        // If tab is already complete, trigger right away
        if (tab.status === 'complete') {
          processTabQueue(tab.id);
        }
      }
      console.log('[BG] Calling sendResponse for handleTabCreated');
      sendResponse({ ok: true, tabId: tab?.id });
    };

    // If a specific targetTabId is provided, inject directly into that tab
    if (targetTabId && !forceNewTab && autoSubmit) {
      chrome.tabs.get(targetTabId, tab => {
        if (chrome.runtime.lastError || !tab) {
          // Tab no longer exists, fall through to create a new one
          console.warn('[BG-v2] targetTabId not found, creating new tab');
          chrome.tabs.create({ url, active }, handleTabCreated);
          return;
        }
        // Focus the tab
        chrome.tabs.update(targetTabId, { active: request.active !== false });
        if (tab.windowId) chrome.windows.update(tab.windowId, { focused: true });
        // Inject the prompt
        const q = tabPromptQueues.get(targetTabId) || [];
        q.push(autoSubmit as any);
        tabPromptQueues.set(targetTabId, q);

        if (tab.status === 'complete') {
          processTabQueue(targetTabId);
        }
        sendResponse({ ok: true, tabId: targetTabId });
      });
      return true;
    }

    const handleExistingTab = (tab: chrome.tabs.Tab) => {
      if (!tab.id) return;
      if (active) {
        chrome.tabs.update(tab.id, { active: true });
        if (tab.windowId) {
          chrome.windows.update(tab.windowId, { focused: true });
        }
      }

      if (autoSubmit) {
        const q = tabPromptQueues.get(tab.id) || [];
        q.push(autoSubmit as any);
        tabPromptQueues.set(tab.id, q);

        if (tab.status === 'complete') {
          processTabQueue(tab.id);
        }
      }
      console.log('[BG] Calling sendResponse for handleExistingTab');
      sendResponse({ ok: true, tabId: tab.id });
    };

    if (sourceTabId && !forceNewTab) {
      chrome.tabs.update(sourceTabId, { url, active: true }, tab => {
        if (chrome.runtime.lastError) {
          console.error('[BG-v2] Update tab failed:', chrome.runtime.lastError);
          chrome.tabs.create({ url, active: true }, handleTabCreated);
          return;
        }
        handleTabCreated(tab);
      });
    } else {
      // Query all tabs with the same origin to do a manual fuzzy match
      try {
        const urlObj = new URL(url);
        const pattern = `${urlObj.origin}/*`;
        console.log('[BG] Querying tabs for pattern:', pattern);
        chrome.tabs.query({ url: pattern }, tabs => {
          console.log('[BG] Query result tabs:', tabs?.length);
          const match = findMatchingTab(url, tabs || []);
          if (match) {
            console.log('[BG] Found matching tab, handling existing:', match.id);
            handleExistingTab(match);
          } else {
            console.log('[BG] No match, creating new tab for URL:', url);
            chrome.tabs.create({ url, active }, handleTabCreated);
          }
        });
      } catch (e) {
        console.log('[BG] URL parse error, falling back to query by exact url:', url);
        chrome.tabs.query({ url: url }, tabs => {
          if (tabs && tabs.length > 0) {
            handleExistingTab(tabs[0]);
          } else {
            chrome.tabs.create({ url, active }, handleTabCreated);
          }
        });
      }
    }
    return true;
  }

  return undefined;
}
