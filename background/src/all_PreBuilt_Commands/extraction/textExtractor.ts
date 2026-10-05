/**
 * @file textScraper.ts
 * @description Background service utility for extracting plain text content from web pages.
 */

/**
 * Injects a script into the specified tab to clone the DOM, strip out non-content
 * elements (scripts, styles, hidden elements), and extract normalized plain text.
 * Truncates the text if it exceeds 12,000 characters to prevent message passing limits.
 *
 * @param tabId The ID of the tab to scrape.
 * @param cb Callback function to return the scraped content, title, and url.
 */
export const executeScrapeScript = (tabId: number, cb: (res: any) => void) => {
  chrome.tabs.sendMessage(tabId, { action: 'scrape_page_content' }, response => {
    const lastError = chrome.runtime.lastError;
    if (lastError) {
      console.error('[Background] executeScrapeScript content-script error:', lastError);
      cb({ ok: false, error: lastError.message });
      return;
    }

    if (response?.ok) {
      cb(response);
    } else {
      cb({ ok: false, error: response?.error || 'no_content_extracted' });
    }
  });
};

/**
 * Message handler for initiating text scraping on a specific tab or the currently active tab.
 *
 * @param request The message payload containing the action type (`scrape_page_content`, `scrape_tab_by_id`).
 * @param sender Information about the sender (for fallback tab resolution).
 * @param sendResponse Callback function to respond asynchronously with the scraped text.
 * @returns {boolean | undefined} Returns true if the request is handled asynchronously.
 */
export const handleTextScraperMessage = (
  request: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void,
): boolean | undefined => {
  if (request.action === 'scrape_page_content') {
    const senderTabId = sender.tab?.id;
    if (senderTabId) {
      executeScrapeScript(senderTabId, sendResponse);
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        const activeTab = tabs?.[0];
        if (activeTab?.id) {
          executeScrapeScript(activeTab.id, sendResponse);
        } else {
          sendResponse({ ok: false, error: 'no_active_tab' });
        }
      });
    }
    return true;
  }

  if (request.action === 'scrape_tab_by_id') {
    const tabId = parseInt(request.tabId, 10);
    if (tabId) {
      executeScrapeScript(tabId, sendResponse);
    } else {
      sendResponse({ ok: false, error: 'invalid_tab_id' });
    }
    return true;
  }
  return false;
};
