import { executeScriptAdapter } from '@extension/browser';

/**
 * Triggers an in-place command on the active tab using JIT injection.
 * @param creatorType The command ID to trigger (e.g., 'save_link', 'add_to_existing')
 */
export const triggerInPlaceCommand = (creatorType: string) => {
  chrome.tabs.query({ active: true, currentWindow: true }, async tabs => {
    const activeTab = tabs[0];
    if (!activeTab || typeof activeTab.id !== 'number') return;
    const url = activeTab.url || '';
    const title = activeTab.title || 'Untitled Page';

    switch (creatorType) {
      case 'save_link':
        // Handle saving-related navigation
        const targetUrl = chrome.runtime.getURL(`AltS_search_newtab/index.html?create_link=true&active_tab_url=${encodeURIComponent(url)}&active_tab_title=${encodeURIComponent(title)}`);
        chrome.tabs.create({ url: targetUrl, active: true });
        return;
      
      case 'save_todo':
      case 'save_snippet':
      case 'save_chat':
      case 'add_to_existing':
      case 'add_to_existing_session':
      case 'summarize_page':
      case 'downloadallimages':
      case 'downloadalltables':
      case 'capture_full_screenshot':
      case 'capture_screenshot':
      case 'capture_clip_screenshot':
      case 'capture_element_screenshot':
      case 'merge_windows':
      case 'close_duplicate_tabs':
      case 'mute_all_tabs':
      case 'unmute_all_tabs':
        // These commands are entirely handled by the AltQ website UI.
        // We just pass the command ID to the popup and break to let the JIT injector mount it.
        break;

      default:
        // Any unknown commands also fall through to be handled by the UI or ignored
        break;
    }

    const msg = { type: 'tasklabs:toggle-altq-popup', creatorType };

    chrome.tabs.sendMessage(activeTab.id, msg, () => {
      if (chrome.runtime.lastError) {
        if (url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
          console.warn('[triggerInPlaceCommand] Cannot inject into restricted URL:', url);
          return;
        }

        executeScriptAdapter({
          target: { tabId: activeTab.id! },
          files: ['alt-s-website.js'],
        })
          .then(() => {
            setTimeout(() => {
              chrome.tabs.sendMessage(activeTab.id!, msg).catch(() => {});
            }, 50);
          })
          .catch(err => {
            console.error('[triggerInPlaceCommand] Failed to inject script:', err);
          });
      }
    });
  });
};
