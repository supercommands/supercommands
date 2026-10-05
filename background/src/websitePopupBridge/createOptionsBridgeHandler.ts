/** Background authority for popup Create option sources. */
import {
  isWebsitePopupCreateOptionsBridgeRequest,
  type WebsitePopupCreateOptionsBridgeResponse,
  type WebsitePopupOpenTabOption,
  type WebsitePopupUrlSuggestion,
  type WebsitePopupAttachmentOption,
} from '../../../src/shared-components/websitePopup/contracts/websitePopupCreateOptionsBridgeContract';
import { db } from '../../../src/storage/indexDB/dbConfig';
import { createTag } from '../../../src/allObjectFolder/src/createObject/tags/tagData';
import { broadcastWebsitePopupEntityChanges } from './broadcastWebsitePopupChanges';

type CreateOptionsSendResponse = (response: WebsitePopupCreateOptionsBridgeResponse) => void;

const isExternalHttpUrl = (value: string) => /^https?:\/\//i.test(value);
const previewText = (value: unknown) => String(value || '').replace(/<[^>]*>/g, ' ').slice(0, 160);

export function handleWebsitePopupCreateOptionsBridgeMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: CreateOptionsSendResponse,
): boolean {
  if (!isWebsitePopupCreateOptionsBridgeRequest(message)) return false;

  void (async () => {
    try {
      if (message.operation === 'create-tag') {
        const tag = await createTag(message.name, null);
        sendResponse({ success: true, tag });
        void broadcastWebsitePopupEntityChanges(['tags']).catch(() => undefined);
        return;
      }
      if (message.operation === 'list-todo-attachments') {
        const [notes, links, prompts, agents] = await Promise.all([
          db.notes.toArray(), db.links.toArray(), db.aiPrompts.toArray(), db.chatAgents.toArray(),
        ]);
        const attachments: WebsitePopupAttachmentOption[] = [
          ...notes.filter(item => item.deletedAt == null).map(item => ({ id: item.id, type: 'note' as const, label: item.title, detail: previewText(item.body) })),
          ...links.filter(item => item.deletedAt == null).map(item => ({ id: item.id, type: 'link' as const, label: item.title, detail: item.urls[0]?.url })),
          ...prompts.filter(item => item.deletedAt == null).map(item => ({ id: item.id, type: 'aiPrompt' as const, label: item.title, detail: previewText(item.prompt) })),
          ...agents.filter(item => item.deletedAt == null).map(item => ({ id: item.id, type: 'agent' as const, label: item.title, detail: previewText(item.prompt) })),
        ].filter(item => item.id && item.label);
        sendResponse({ success: true, attachments });
        return;
      }
      if (message.operation === 'search-link-urls') {
        const query = message.query.trim();
        if (!query) {
          sendResponse({ success: true, suggestions: [] });
          return;
        }
        const [bookmarks, history] = await Promise.all([
          new Promise<chrome.bookmarks.BookmarkTreeNode[]>(resolve =>
            chrome.bookmarks.search(query, items => resolve(items || []))),
          new Promise<chrome.history.HistoryItem[]>(resolve =>
            chrome.history.search({ text: query, maxResults: 10 }, items => resolve(items || []))),
        ]);
        const seenUrls = new Set<string>();
        const suggestions: WebsitePopupUrlSuggestion[] = [];
        for (const item of [
          ...bookmarks.map(bookmark => ({ id: bookmark.id, title: bookmark.title, url: bookmark.url, source: 'bookmark' as const })),
          ...history.map(visit => ({ id: visit.id, title: visit.title, url: visit.url, source: 'history' as const })),
        ]) {
          const url = String(item.url || '').trim();
          const key = url.toLowerCase().replace(/\/$/, '');
          if (!isExternalHttpUrl(url) || seenUrls.has(key)) continue;
          seenUrls.add(key);
          suggestions.push({ id: `${item.source}:${item.id || key}`, title: String(item.title || url), url, source: item.source });
          if (suggestions.length >= 5) break;
        }
        sendResponse({ success: true, suggestions });
        return;
      }
      const currentWindowId = sender.tab?.windowId ?? null;
      const tabs = await chrome.tabs.query({});
      const candidates = tabs.flatMap(tab => {
        const url = String(tab.url || '').trim();
        if (!tab.id || !isExternalHttpUrl(url)) return [];
        return [{
          id: `tab:${tab.id}`,
          tabId: tab.id,
          title: String(tab.title || url),
          url,
          favIconUrl: String(tab.favIconUrl || '').trim() || undefined,
          windowId: tab.windowId,
          index: tab.index,
          active: Boolean(tab.active),
        } satisfies WebsitePopupOpenTabOption];
      });
      candidates.sort((left, right) => {
        const leftCurrent = left.windowId === currentWindowId ? 0 : 1;
        const rightCurrent = right.windowId === currentWindowId ? 0 : 1;
        if (leftCurrent !== rightCurrent) return leftCurrent - rightCurrent;
        const leftActive = left.active ? 0 : 1;
        const rightActive = right.active ? 0 : 1;
        if (leftActive !== rightActive) return leftActive - rightActive;
        if (left.windowId !== right.windowId) return left.windowId - right.windowId;
        return left.index - right.index;
      });
      sendResponse({ success: true, tabs: candidates });
    } catch (error: unknown) {
      sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
  })();

  return true;
}
