import { db } from '../../../../../storage/indexDB/dbConfig';
import type { TimelineKind } from './timelineActivity';

export interface TimelineItem {
    kind: TimelineKind;
    id: string;
    title: string;
    description: string;
    organisationId: string;
    location: string;
    createdAt: number;
    collectionId?: string;
    urls?: string[];
    faviconUrls?: string[];
    tagIds?: string[];
}

const asText = (value: unknown): string => typeof value === 'string' ? value : '';
const plainText = (value: unknown): string => asText(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);

export async function loadTimelineItems(): Promise<TimelineItem[]> {
    const [organisations, notes, links, todos, snippets, prompts, collections, collectionItems] = await Promise.all([
        db.organisations.toArray(), db.notes.toArray(), db.links.toArray(), db.todos.toArray(),
        db.snippets.toArray(), db.aiPrompts.toArray(),
        db.collections.toArray(), db.collectionItems.toArray(),
    ]);
    const organisationNames = new Map(organisations.map(item => [item.id, item.organisationName]));
    const collectionNames = new Map(collections.map(item => [item.id, item.name]));
    const items: TimelineItem[] = [];
    const add = (kind: TimelineKind, record: { id: string; organisationId?: string; createdAt: number; deletedAt?: number | null; tagIds?: string[] }, title: string, description = '', collectionId?: string, urls?: string[], faviconUrls?: string[]) => {
        if (record.deletedAt != null || !record.id) return;
        // Older saved records can lack a reliable creation timestamp. They can
        // still appear in Recently opened, but cannot be dated in Created.
        const createdAt = Number.isFinite(record.createdAt) && record.createdAt > 0 && record.createdAt <= Date.now() ? record.createdAt : 0;
        items.push({ kind, id: record.id, title: title.trim() || 'Untitled', description: plainText(description),
            organisationId: record.organisationId || '', location: collectionId ? collectionNames.get(collectionId) || 'Webclip' : organisationNames.get(record.organisationId || '') || 'Organisation',
            createdAt, ...(collectionId ? { collectionId } : {}), ...(urls ? { urls } : {}), ...(faviconUrls ? { faviconUrls } : {}),
            ...(Array.isArray(record.tagIds) ? { tagIds: record.tagIds } : {}) });
    };
    notes.forEach(item => add('note', item, item.title, item.body));
    links.forEach(item => {
        const validUrls = item.urls.filter(url => Boolean(url.url));
        add('link', item, item.title, item.urls.map(url => url.title || url.url).join(', '), undefined,
            validUrls.map(url => url.url), validUrls.map(url => url.favIconUrl || ''));
    });
    todos.forEach(item => add('todo', item, item.name, item.description));
    snippets.forEach(item => add('snippet', item, item.title, typeof item.config === 'string' ? item.config : ''));
    prompts.forEach(item => {
        const urls = Object.entries(item.modelUrls || {})
            .filter(([modelId, url]) => Boolean(url) && (!Array.isArray(item.enabledModelIds) || item.enabledModelIds.includes(modelId)))
            .map(([, url]) => url);
        add('aiPrompt', item, item.title, item.prompt, undefined, urls,
            urls.length === 1 ? [item.favIconUrl || ''] : undefined);
    });
    collections.forEach(item => add('collection', item, item.name));
    collectionItems.forEach(item => add('collectionItem', item, item.title, item.note || (item.type === 'article' || item.type === 'text' ? item.data.text : item.url), item.collectionId));
    return items.sort((a, b) => b.createdAt - a.createdAt);
}
