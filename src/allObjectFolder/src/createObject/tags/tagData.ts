/**
 * @file tagData.ts
 * @description Handles IndexedDB transactions (CRUD) for Tag records.
 *
 * @usage
 * ```ts
 * import { createTag, updateTag } from './tagData';
 * const tag = await createTag('work');
 * ```
 */
import { generateEntityId } from '../../../../shared-components/utils/idGenerator';
import { db } from '../../../../storage/indexDB/dbConfig';
import { validateTagAppearance } from './tagAppearanceValidation';
import type { TagRecord, TagUpdateInput, TagAppearance } from './tagTypes';
import { assetStore } from '../../../../storage/assets/assetStore';
import { tagThumbnailToBlob, validateTagImageBlob } from './tagImagePayload';
import { removeCollectionItemTagReferences } from '../collections/collectionTagData';
export const createTag = async (name: string, workspaceId: string | null = null): Promise<TagRecord> => {
    try {
        const trimmed = name.trim();
        if (!trimmed)
            throw new Error('Tag name cannot be empty');
        const normalizedWorkspaceId = workspaceId;
        // Tags are unique within their scope: globally or within one Workspace.
        return db.transaction('rw', [db.tags, db.workspaces], async () => {
            if (workspaceId && !await db.workspaces.get(workspaceId)) throw new Error('The Workspace no longer exists.');
            const allTags = await db.tags.toArray();
            const existing = allTags.find(t => t.name.trim().toLowerCase() === trimmed.toLowerCase() &&
                (t.workspaceId ?? null) === normalizedWorkspaceId);
            if (existing)
                return existing;
            const now = Date.now();
            const newTag: TagRecord = {
                id: generateEntityId('tag'),
                name: trimmed,
                workspaceId: normalizedWorkspaceId,
                createdAt: now,
                updatedAt: now,
            };
            await db.tags.add(newTag);
            return newTag;
        });
    }
    catch (e) {
        console.error('Failed to create tag in Dexie', e);
        throw e;
    }
};
export const updateTag = async (tagId: string, updates: TagUpdateInput): Promise<TagRecord> => {
    try {
        if ('name' in updates && (typeof updates.name !== 'string' || !updates.name.trim())) throw new Error('Tag name cannot be empty');
        if ('appearance' in updates) {
            const persist = (appearance: TagAppearance) => db.transaction('rw', [db.tags, db.workspaces], async () => {
                const tag = await db.tags.get(tagId);
                if (!tag) throw new Error('This tag no longer exists');
                if (tag.workspaceId && !await db.workspaces.get(tag.workspaceId)) throw new Error('The linked workspace no longer exists');
                if (typeof updates.name === 'string') await renameTag(tagId, updates.name);
                await db.tags.update(tagId, { appearance, updatedAt: Date.now() });
                return (await db.tags.get(tagId))!;
            });
            const draft = updates.appearance;
            if (draft?.kind === 'image' && 'value' in draft) {
                if (Object.keys(draft).length !== 2 || 'assetId' in draft) throw new Error('Choose a valid tag image.');
                const blob = await tagThumbnailToBlob(draft.value);
                return await assetStore.withAsset({blob, mimeType: blob.type}, asset => persist({kind: 'image', assetId: asset.id}));
            }
            const appearance = validateTagAppearance(draft);
            if (appearance.kind === 'image') {
                return await assetStore.withAsset({assetId: appearance.assetId}, async asset => {
                    await validateTagImageBlob(asset.blob!);
                    return persist({kind: 'image', assetId: asset.id});
                });
            }
            return await persist(appearance);
        }
        return await db.transaction('rw', [db.tags, db.workspaces], async () => {
            if (!await db.tags.get(tagId)) throw new Error('This tag no longer exists');
            if (typeof updates.name === 'string' && Object.keys(updates).every(key => key === 'name')) {
                await renameTag(tagId, updates.name);
                return (await db.tags.get(tagId))!;
            }
            const { appearance: _appearance, ...storedUpdates } = updates;
            await db.tags.update(tagId, {
                ...storedUpdates,
                updatedAt: Date.now()
            });
            return (await db.tags.get(tagId))!;
        });
    }
    catch (e) {
        console.error('Failed to update tag in Dexie', e);
        throw e;
    }
};
/** Rename one existing tag without replacing its ID or memberships. */
export const renameTag = async (tagId: string, name: string): Promise<void> => {
    const trimmed = name.trim();
    if (!trimmed)
        throw new Error('Tag name cannot be empty');
    await db.transaction('rw', [db.tags, db.workspaces], async () => {
        const tag = await db.tags.get(tagId);
        if (!tag)
            throw new Error('This tag no longer exists');
        const duplicate = (await db.tags.toArray()).some(candidate => candidate.id !== tagId &&
            (candidate.workspaceId ?? null) === (tag.workspaceId ?? null) &&
            candidate.name.trim().toLowerCase() === trimmed.toLowerCase());
        if (duplicate)
            throw new Error('A tag with this name already exists in this scope');
        if (tag.workspaceId) {
            const view = await db.workspaces.get(tag.workspaceId);
            if (!view)
                throw new Error('The linked collection no longer exists');
            const viewDuplicate = (await db.workspaces.where('organisationId').equals(view.organisationId).toArray())
                .some(candidate => candidate.id !== view.id && candidate.workspaceName.trim().toLowerCase() === trimmed.toLowerCase());
            if (viewDuplicate)
                throw new Error('A collection with this name already exists in this organisation');
            await db.workspaces.update(view.id, { workspaceName: trimmed, updatedAt: Date.now() });
        }
        await db.tags.update(tagId, { name: trimmed, updatedAt: Date.now() });
    });
};
export const deleteTag = async (tagId: string): Promise<void> => {
    try {
        if (!tagId)
            return;
        // Delete only the requested record. Same-name global and dashboard tags are distinct.
        const targetIds = new Set<string>([tagId]);
        const targetIdArray = Array.from(targetIds);
        // 2. Perform cascade cleanup in a single transaction across all relevant tables
        await db.transaction('rw', [
            db.tags,
            db.notes,
            db.links,
            db.snippets,
            db.todos,
            db.workspaceSessions,
            db.aiPrompts,
            db.chatAgents,
            db.collectionItems
        ], async () => {
            await removeCollectionItemTagReferences(targetIdArray);
            // Delete the tag record(s)
            for (const id of targetIdArray) {
                await db.tags.delete(id);
            }
            // Helper to strip tag IDs from an array
            const stripTags = (existingTagIds?: string[]): string[] | null => {
                if (!Array.isArray(existingTagIds) || existingTagIds.length === 0)
                    return null;
                const filtered = existingTagIds.filter(id => !targetIds.has(id));
                return filtered.length !== existingTagIds.length ? filtered : null;
            };
            // Cascade remove from notes
            await db.notes.toCollection().modify(note => {
                const cleaned = stripTags(note.tagIds);
                if (cleaned !== null) {
                    note.tagIds = cleaned;
                }
            });
            // Cascade remove from links
            await db.links.toCollection().modify(link => {
                const cleaned = stripTags(link.tagIds);
                if (cleaned !== null) {
                    link.tagIds = cleaned;
                }
            });
            // Cascade remove from snippets
            await db.snippets.toCollection().modify(snippet => {
                const cleaned = stripTags(snippet.tagIds);
                if (cleaned !== null) {
                    snippet.tagIds = cleaned;
                }
            });
            // Cascade remove from todos by ID. Legacy name arrays are intentionally left alone
            // because global and dashboard tags may share the same name.
            await db.todos.toCollection().modify(todo => {
                const cleanedIds = stripTags(todo.tagIds);
                if (cleanedIds !== null) {
                    todo.tagIds = cleanedIds;
                    todo.updatedAt = Date.now();
                }
            });
            // Cascade remove from sessions
            await db.workspaceSessions.toCollection().modify(session => {
                const cleaned = stripTags(session.tagIds);
                if (cleaned !== null) {
                    session.tagIds = cleaned;
                }
            });
            // Cascade remove from aiPrompts
            await db.aiPrompts.toCollection().modify(prompt => {
                const cleaned = stripTags(prompt.tagIds);
                if (cleaned !== null) {
                    prompt.tagIds = cleaned;
                }
            });
            // Cascade remove from chatAgents
            await db.chatAgents.toCollection().modify(agent => {
                const cleaned = stripTags(agent.tagIds);
                if (cleaned !== null) {
                    agent.tagIds = cleaned;
                }
            });
        });
    }
    catch (e) {
        console.error('Failed to delete tag and clean up references in Dexie', e);
        throw e;
    }
};
