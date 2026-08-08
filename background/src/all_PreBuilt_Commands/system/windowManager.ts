import 'webextension-polyfill';

export async function mergeAllWindows(): Promise<void> {
  console.log('[windowManager] Starting mergeAllWindows...');
  
  // 1. Get the current (target) window
  const currentWindow = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
  console.log('[windowManager] Current target window:', currentWindow.id);
  
  // 2. Get all open normal windows
  const allWindows = await chrome.windows.getAll({ windowTypes: ['normal'] });
  console.log('[windowManager] Found normal windows:', allWindows.map(w => w.id));
  
  // 3. For each window that is not the current window, move its tabs
  for (const win of allWindows) {
    if (win.id && win.id !== currentWindow.id) {
      // Get all tabs in this window
      const tabs = await chrome.tabs.query({ windowId: win.id });
      const tabIds = tabs.map(t => t.id).filter((id): id is number => id !== undefined);
      
      console.log(`[windowManager] Moving ${tabIds.length} tabs from window ${win.id} to window ${currentWindow.id}...`);
      
      if (tabIds.length > 0) {
        // Move all tabs to the end of the current window
        await chrome.tabs.move(tabIds, { windowId: currentWindow.id, index: -1 });
        console.log(`[windowManager] Successfully moved tabs from window ${win.id}.`);
      }
    }
  }
  
  console.log('[windowManager] Finished mergeAllWindows.');
}

export async function closeDuplicateTabs(): Promise<number> {
  console.log('[windowManager] Starting closeDuplicateTabs...');
  const currentWindow = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
  if (!currentWindow || !currentWindow.id) return 0;

  const windowTabs = await chrome.tabs.query({ windowId: currentWindow.id });
  
  const seenUrls = new Set<string>();
  const duplicateTabIds: number[] = [];
  
  // First, always prioritize keeping the active tab if possible
  const activeTab = windowTabs.find(t => t.active);
  if (activeTab && activeTab.url) {
    seenUrls.add(activeTab.url);
  }
  
  for (const tab of windowTabs) {
    if (!tab.url || !tab.id) continue;
    
    // Skip if it's the active tab (we already handled its URL above, so we don't want to close it)
    if (tab.active) continue;
    
    // Ignore empty/newtab pages
    if (tab.url === 'chrome://newtab/' || tab.url === 'about:blank' || tab.url === 'edge://newtab/') {
      continue;
    }
    
    const url = tab.url;
    
    if (seenUrls.has(url)) {
      duplicateTabIds.push(tab.id);
    } else {
      seenUrls.add(url);
    }
  }
  
  if (duplicateTabIds.length > 0) {
    console.log(`[windowManager] Found ${duplicateTabIds.length} duplicate tabs in window ${currentWindow.id}. Closing them...`);
    await chrome.tabs.remove(duplicateTabIds);
  } else {
    console.log('[windowManager] No duplicate tabs found in current window.');
  }
  
  return duplicateTabIds.length;
}

async function setTabsMutedState(shouldMute: boolean): Promise<number> {
  const actionName = shouldMute ? 'muteAllTabs' : 'unmuteAllTabs';
  console.log(`[windowManager] Starting ${actionName}...`);
  const currentWindow = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
  if (!currentWindow || !currentWindow.id) return 0;

  const windowTabs = await chrome.tabs.query({ windowId: currentWindow.id });
  
  // Find tabs that are not in the desired state
  const targetTabs = windowTabs.filter(t => t.id && (!!t.mutedInfo?.muted) !== shouldMute);
  
  // Do the actual updating asynchronously so we don't block the response
  Promise.all(targetTabs.map(tab => chrome.tabs.update(tab.id!, { muted: shouldMute })))
    .then(() => console.log(`[windowManager] Successfully updated ${targetTabs.length} tabs to muted=${shouldMute} in window ${currentWindow.id}.`))
    .catch(err => console.error(`[windowManager] Error during async ${actionName}:`, err));
  
  return targetTabs.length;
}

export async function muteAllTabs(): Promise<number> {
  return setTabsMutedState(true);
}

export async function unmuteAllTabs(): Promise<number> {
  return setTabsMutedState(false);
}

/**
 * Registers the listener for the 'execute_merge_windows' action from the AltQ page action popup.
 */
export function setupWindowManager() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'execute_merge_windows') {
      console.log('[windowManager] Received execute_merge_windows message from popup!');
      mergeAllWindows()
        .then(() => sendResponse({ success: true }))
        .catch(error => {
          console.error('[windowManager] Error merging windows:', error);
          sendResponse({ success: false, error: String(error) });
        });
      return true; // Indicates async response
    } else if (request.action === 'execute_close_duplicate_tabs') {
      console.log('[windowManager] Received execute_close_duplicate_tabs message from popup!');
      closeDuplicateTabs()
        .then(count => sendResponse({ success: true, count }))
        .catch(error => {
          console.error('[windowManager] Error closing duplicate tabs:', error);
          sendResponse({ success: false, error: String(error) });
        });
      return true;
    } else if (request.action === 'execute_mute_all_tabs') {
      console.log('[windowManager] Received execute_mute_all_tabs message from popup!');
      muteAllTabs()
        .then(count => sendResponse({ success: true, count }))
        .catch(error => {
          console.error('[windowManager] Error muting all tabs:', error);
          sendResponse({ success: false, error: String(error) });
        });
      return true;
    } else if (request.action === 'execute_unmute_all_tabs') {
      console.log('[windowManager] Received execute_unmute_all_tabs message from popup!');
      unmuteAllTabs()
        .then(count => sendResponse({ success: true, count }))
        .catch(error => {
          console.error('[windowManager] Error unmuting all tabs:', error);
          sendResponse({ success: false, error: String(error) });
        });
      return true;
    }
    
    return false;
  });
}
