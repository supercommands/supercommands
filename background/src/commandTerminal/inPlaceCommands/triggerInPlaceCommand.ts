/**
 * Triggers an in-place command on the active tab using JIT injection.
 * @param creatorType The command ID to trigger (e.g., 'save_link', 'add_to_existing')
 */
import { buildCommandTerminalNewtabPath } from '../../../../src/shared-components/commandTerminal/runtime/launch';
import { BRAND } from '../../../../src/shared-components/brandingConfig';
import { sendWebsitePopupToggle } from '../../websitePopupBridge/websitePopupTabRuntime';

export const triggerInPlaceCommand = async (creatorType: string): Promise<void> => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    if (!activeTab || typeof activeTab.id !== 'number') throw new Error('No active tab is available for this page command.');
    const url = activeTab.url || '';
    const title = activeTab.title || 'Untitled Page';
    if (creatorType === 'save_link') {
      const path = buildCommandTerminalNewtabPath({
        createLink: true,
        activeTabUrl: url,
        activeTabTitle: title,
      });
      await chrome.tabs.create({ url: chrome.runtime.getURL(path), active: true });
      return;
    }

    const msg = { type: BRAND.events.toggleAlts, creatorType };

    await sendWebsitePopupToggle(activeTab.id, url, msg);
};
