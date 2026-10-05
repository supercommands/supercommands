/**
 * Typed content/background contract for the popup free-text search snapshot.
 *
 * Background code owns IndexedDB and Chrome Bookmarks. The content surface
 * receives only the records consumed by the shared in-memory search engine.
 */
import type { AiPromptRecord } from '../../../allObjectFolder/src/createObject/aiPrompt/aiPromptTypes';
import type { ChatAgentRecord } from '../../../allObjectFolder/src/createObject/ChatAgent/chatAgentTypes';
import type { LinkRecord } from '../../../allObjectFolder/src/createObject/links/linkTypes';
import type { NoteRecord } from '../../../allObjectFolder/src/createObject/notes/noteTypes';
import type { SessionRecord } from '../../../allObjectFolder/src/createObject/session/sessionTypes';
import type { CollectionRecord, CollectionItemRecord } from '../../../allObjectFolder/src/createObject/collections/collectionTypes';
import type { SnippetRecord } from '../../../allObjectFolder/src/createObject/snippets/snippetTypes';
import type { TodoRecord } from '../../../allObjectFolder/src/createObject/todos/todoTypes';
import type { TagRecord } from '../../../allObjectFolder/src/createObject/tags/tagTypes';
import type { UserShortcutRecord } from '../../shortcuts/core/shortcutDbTypes';
export const WEBSITE_POPUP_SEARCH_BRIDGE_ACTION = 'website_popup:search' as const;
export type WebsitePopupBookmarkSearchRecord = {
    id: string;
    title: string;
    url: string;
};
export type WebsitePopupSearchSnapshot = {
    defaultOrganisationId?: string | null;
    notes: NoteRecord[];
    links: LinkRecord[];
    snippets: SnippetRecord[];
    todos: TodoRecord[];
    bookmarks: WebsitePopupBookmarkSearchRecord[];
    prompts: AiPromptRecord[];
    agents: ChatAgentRecord[];
    collections: SessionRecord[];
    newCollections: CollectionRecord[];
    collectionItems: CollectionItemRecord[];
    tags: TagRecord[];
    shortcuts: UserShortcutRecord[];
};
export const EMPTY_WEBSITE_POPUP_SEARCH_SNAPSHOT: WebsitePopupSearchSnapshot = {
    defaultOrganisationId: null,
    notes: [],
    links: [],
    snippets: [],
    todos: [],
    bookmarks: [],
    prompts: [],
    agents: [],
    collections: [],
    newCollections: [],
    collectionItems: [],
    tags: [],
    shortcuts: [],
};
/**
 * Background snapshots can cross a content-script reload boundary. Normalize
 * every collection so an older or partial response cannot crash search while
 * the popup is already open.
 */
export function normalizeWebsitePopupSearchSnapshot(snapshot: Partial<WebsitePopupSearchSnapshot> | null | undefined): WebsitePopupSearchSnapshot {
    return {
        defaultOrganisationId: typeof snapshot?.defaultOrganisationId === 'string' ? snapshot.defaultOrganisationId : null,
        notes: Array.isArray(snapshot?.notes) ? snapshot.notes : [],
        links: Array.isArray(snapshot?.links) ? snapshot.links : [],
        snippets: Array.isArray(snapshot?.snippets) ? snapshot.snippets : [],
        todos: Array.isArray(snapshot?.todos) ? snapshot.todos : [],
        bookmarks: Array.isArray(snapshot?.bookmarks) ? snapshot.bookmarks : [],
        prompts: Array.isArray(snapshot?.prompts) ? snapshot.prompts : [],
        agents: Array.isArray(snapshot?.agents) ? snapshot.agents : [],
        collections: Array.isArray(snapshot?.collections) ? snapshot.collections : [],
        newCollections: Array.isArray(snapshot?.newCollections) ? snapshot.newCollections : [],
        collectionItems: Array.isArray(snapshot?.collectionItems) ? snapshot.collectionItems : [],
        tags: Array.isArray(snapshot?.tags) ? snapshot.tags : [],
        shortcuts: Array.isArray(snapshot?.shortcuts) ? snapshot.shortcuts : [],
    };
}
export type WebsitePopupSearchBridgeRequest = {
    action: typeof WEBSITE_POPUP_SEARCH_BRIDGE_ACTION;
    operation: 'read-snapshot';
};
export type WebsitePopupSearchBridgeResponse = {
    success: true;
    snapshot: WebsitePopupSearchSnapshot;
} | {
    success: false;
    error: string;
};
export function isWebsitePopupSearchBridgeRequest(value: unknown): value is WebsitePopupSearchBridgeRequest {
    if (!value || typeof value !== 'object')
        return false;
    const request = value as Partial<WebsitePopupSearchBridgeRequest>;
    return request.action === WEBSITE_POPUP_SEARCH_BRIDGE_ACTION
        && request.operation === 'read-snapshot';
}
