/** One broadcast contract for popup writes and browser-data invalidation. */
import { invalidateHotkeysCache } from '../hotkeys/hotkeys';
export async function broadcastWebsitePopupEntityChanges(tables: readonly string[]) {
  const uniqueTables = [...new Set(tables)];
  if (!uniqueTables.length) return;
  if (uniqueTables.includes('hotkeysMap') || uniqueTables.includes('userHotkeys')) invalidateHotkeysCache();
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.flatMap(tab => {
    if (tab.id === undefined) return [];
    const messages = uniqueTables.map(table =>
      chrome.tabs.sendMessage(tab.id!, { action: 'db_changed', table }).catch(() => undefined),
    );
    if (uniqueTables.includes('todos')) {
      messages.push(chrome.tabs.sendMessage(tab.id, { type: 'TODOS_UPDATED' }).catch(() => undefined));
    }
    return messages;
  }));
}

/** Register once in the background, so website and New Tab see the same changes. */
export function registerWebsitePopupBookmarkInvalidation() {
  const invalidate = () => { void broadcastWebsitePopupEntityChanges(['bookmarks']).catch(() => undefined); };
  chrome.bookmarks?.onCreated.addListener(invalidate);
  chrome.bookmarks?.onRemoved.addListener(invalidate);
  chrome.bookmarks?.onChanged.addListener(invalidate);
  chrome.bookmarks?.onMoved.addListener(invalidate);
}
