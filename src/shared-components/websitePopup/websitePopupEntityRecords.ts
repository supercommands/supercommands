import { getWebsitePopupEntityLabel } from './websitePopupLabels';
import type { WebsitePopupEntityKind, WebsitePopupTextCommandTargetEntity } from './contracts/websitePopupExecutionTypes';
import type { WebsitePopupSearchSnapshot } from './contracts/websitePopupSearchBridgeContract';
export const WEBSITE_POPUP_ENTITY_SOURCES = {
    note: { snapshot: 'notes', table: 'notes', label: 'Note' },
    link: { snapshot: 'links', table: 'links', label: getWebsitePopupEntityLabel('link') },
    snippet: { snapshot: 'snippets', table: 'snippets', label: 'Text Expander' },
    todo: { snapshot: 'todos', table: 'todos', label: 'Todo' },
    bookmark: { snapshot: 'bookmarks', table: 'bookmarks', label: 'Bookmark' },
    prompt: { snapshot: 'prompts', table: 'aiPrompts', label: 'AI Prompt' },
    agent: { snapshot: 'agents', table: 'chatAgents', label: 'Chat Agent' },
    collection: { snapshot: 'collections', table: 'workspaces', label: 'Workspace Session' },
    webCollection: { snapshot: 'newCollections', table: 'collections', label: getWebsitePopupEntityLabel('webCollection') },
} as const satisfies Record<WebsitePopupTextCommandTargetEntity, {
    snapshot: keyof WebsitePopupSearchSnapshot;
    table: string;
    label: string;
}>;
export function getWebsitePopupSnapshotRecord(snapshot: WebsitePopupSearchSnapshot, entity: WebsitePopupEntityKind, targetId: string) {
    return snapshot[WEBSITE_POPUP_ENTITY_SOURCES[entity].snapshot].find(record => String(record.id) === targetId);
}
/** The popup's historical `collection` entity points to Workspace Sessions, not CollectionRecord. */
export function getWebsitePopupEntityLaunchType(entity: WebsitePopupEntityKind) {
    return entity === 'collection' ? 'session' : entity;
}
export type WebsitePopupStoredRecord = WebsitePopupSearchSnapshot['notes' | 'links' | 'snippets' | 'todos' | 'prompts' | 'agents' | 'collections'][number];
