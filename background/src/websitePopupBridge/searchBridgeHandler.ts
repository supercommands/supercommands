/**
 * Background authority for the popup free-text search snapshot.
 *
 * This handler is the only new search layer that reads IndexedDB or Chrome
 * Bookmarks. The content UI receives a typed snapshot and performs no storage
 * operations of its own.
 */
import { db } from '../../../src/storage/indexDB/dbConfig';
import { getSmartDefaultOrganisation } from '../../../src/storage/localStorage/lastUsedOrganisation';
import { getInternalDashboardSessionIds } from '../../../src/allObjectFolder/src/createObject/widgets/widgetTypes';
import { getAllUserShortcuts } from '../../../src/shared-components/shortcuts/core/shortcutDbData';
import { selectVisibleWebCollectionRecords } from '../../../src/shared-components/collections/webCollectionSearch';
import {
  isWebsitePopupSearchBridgeRequest,
  type WebsitePopupBookmarkSearchRecord,
  type WebsitePopupSearchBridgeResponse,
} from '../../../src/shared-components/websitePopup/contracts/websitePopupSearchBridgeContract';

type SearchBridgeSendResponse = (response: WebsitePopupSearchBridgeResponse) => void;

const readBookmarks = (): Promise<WebsitePopupBookmarkSearchRecord[]> => new Promise(resolve => {
  if (!chrome.bookmarks?.getTree) {
    resolve([]);
    return;
  }

  chrome.bookmarks.getTree(tree => {
    const bookmarks: WebsitePopupBookmarkSearchRecord[] = [];
    const visit = (nodes: chrome.bookmarks.BookmarkTreeNode[], path: string[] = []) => {
      nodes.forEach(node => {
        if (node.url) {
          bookmarks.push({
            id: node.id,
            title: node.title || node.url,
            url: node.url,
            folderPath: path.join(' / ') || 'Bookmarks',
          });
        }
        if (node.children) {
          visit(node.children, node.parentId === '0' ? [] : [...path, node.title]);
        }
      });
    };
    visit(tree[0]?.children || []);
    resolve(bookmarks);
  });
});

export function handleWebsitePopupSearchBridgeMessage(
  message: unknown,
  sendResponse: SearchBridgeSendResponse,
): boolean {
  if (!isWebsitePopupSearchBridgeRequest(message)) return false;

  void (async () => {
    try {
      const [notes, links, snippets, todos, bookmarks, prompts, agents, sessions, widgetViews, tags, shortcuts, defaultOrganisation, dashboards, newCollections, collectionItems] =
        await Promise.all([
          db.notes.toArray(),
          db.links.toArray(),
          db.snippets.toArray(),
          db.todos.toArray(),
          readBookmarks(),
          db.aiPrompts.toArray(),
          db.chatAgents.toArray(),
          db.workspaceSessions.toArray(),
          db.workspaceViews.toArray(),
          db.tags.toArray(),
          getAllUserShortcuts(),
          getSmartDefaultOrganisation(),
          db.widgetDashboards.toArray(),
          db.collections.toArray(),
          db.collectionItems.toArray(),
        ]);

      const organisationViewIds = new Set(
        widgetViews
          .filter(view => view.organisationId === defaultOrganisation?.id)
          .map(view => String(view.id)),
      );
      const createVisibleTags = tags.filter(tag =>
        !tag.workspaceId || organisationViewIds.has(tag.workspaceId),
      );

      const internalSessionIds = getInternalDashboardSessionIds(dashboards);
      const visibleWebCollections = selectVisibleWebCollectionRecords(newCollections, collectionItems, defaultOrganisation?.id);

      sendResponse({
        success: true,
        snapshot: {
          defaultOrganisationId: defaultOrganisation?.id ?? null,
          notes,
          links,
          snippets,
          todos,
          bookmarks,
          prompts,
          agents,
          collections: sessions.filter(session => !internalSessionIds.has(String(session.id))),
          newCollections: visibleWebCollections.collections,
          collectionItems: visibleWebCollections.items,
          tags: createVisibleTags,
          shortcuts,
        },
      });
    } catch (error: unknown) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();

  return true;
}
