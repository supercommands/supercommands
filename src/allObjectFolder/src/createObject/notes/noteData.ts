
import Dexie from 'dexie';
import { extractSnippetIdFromCompoundId } from '../../../../shared-components/utils/idGenerator';
import { toNoteEditorRecord } from './noteRecordAdapter';
import { updateSnippet } from '../snippets/snippetData';
import { updateTodoContent } from '../todos/todoData';
import type { NoteRecord, CreateNoteInput, UpdateNoteInput } from './noteTypes';
import { generateEntityId } from '../../../../shared-components/utils/idGenerator';
import { db, deleteItemAssociations } from '../../../../storage/indexDB/dbConfig';
import { getSmartDefaultOrganisation } from '../../../../storage/localStorage/lastUsedOrganisation';
import { normalizeNoteBody } from './noteHelpers';
import { runAssetGarbageCollection } from '../../../../storage/assets/assetGarbageCollector';
import { createCheckpoint, createInitialHistory, shouldCreateCheckpoint, extractNoteSnapshotFromRecord } from './noteHistory';
import { removeSessionReferencesForEntity } from '../session/sessionReferenceUtils';
/**
 * Creates a new note record.
 */
export async function createNote(input: CreateNoteInput): Promise<NoteRecord> {
    const defaultOrganisation = input.organisationId ? null : await getSmartDefaultOrganisation();
    const organisationId = input.organisationId ?? defaultOrganisation?.id;
    if (!organisationId) {
        throw new Error('An organisation is required.');
    }
    const now = Date.now();
    const body = normalizeNoteBody(input.body);
    const note: NoteRecord = {
        id: generateEntityId('note'),
        organisationId,
        title: input.title.trim() || 'Untitled Note',
        body,
        shortcut: input.shortcut || '',
        tagIds: input.tagIds ?? [],
        assetIds: input.assetIds ?? [],
        versionHistory: undefined as any,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
    };
    const initialSnapshot = extractNoteSnapshotFromRecord(note);
    note.versionHistory = createInitialHistory(initialSnapshot, now);
    try {
        await db.notes.add(note);
        return note;
    }
    catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown database error';
        console.error('[noteData.createNote] Failed:', message);
        throw error;
    }
}
export class ConflictError extends Error {
    remoteNote?: NoteRecord;
    constructor(message: string, remoteNote?: NoteRecord) {
        super(message);
        this.name = 'ConflictError';
        this.remoteNote = remoteNote;
    }
}
/**
 * Updates an existing note record.
 */
export async function updateNote(noteId: string, input: UpdateNoteInput): Promise<NoteRecord> {
    noteId = extractSnippetIdFromCompoundId(noteId);
    const now = Date.now();
    const changes: Partial<NoteRecord> = {
        updatedAt: now,
    };
    let shouldRunAssetGarbageCollection = false;
    if (input.title !== undefined)
        changes.title = input.title.trim() || 'Untitled Note';
    if (input.body !== undefined)
        changes.body = normalizeNoteBody(input.body);
    if (input.shortcut !== undefined)
        changes.shortcut = input.shortcut;
    if (input.organisationId !== undefined)
        changes.organisationId = input.organisationId;
    if (input.tagIds !== undefined)
        changes.tagIds = input.tagIds;
    if (input.assetIds !== undefined)
        changes.assetIds = input.assetIds;
    try {
        const updatedNote = await db.transaction('rw', [db.notes, db.snippets, db.todos], async () => {
            let existing = await db.notes.get(noteId);
            if (existing) {
                if (input.expectedUpdatedAt !== undefined && existing.updatedAt !== input.expectedUpdatedAt) {
                    throw new ConflictError('Note was modified in another tab.', existing);
                }
                if (input.assetIds !== undefined) {
                    const nextAssetIds = new Set(input.assetIds);
                    shouldRunAssetGarbageCollection = (existing.assetIds ?? []).some(id => !nextAssetIds.has(id));
                }
                const canonicalExisting = toNoteEditorRecord(existing);
                const prevSnapshot = extractNoteSnapshotFromRecord(canonicalExisting);
                const nextSnapshot = extractNoteSnapshotFromRecord({ ...canonicalExisting, ...changes });
                let newHistoryState = existing.versionHistory;
                if (!newHistoryState || typeof newHistoryState.lastSavedText !== 'string') {
                    newHistoryState = createInitialHistory(prevSnapshot, existing.updatedAt || now);
                }
                newHistoryState = createCheckpoint(nextSnapshot, newHistoryState, now, prevSnapshot);
                const changesWithVersionHistory = { ...changes, versionHistory: newHistoryState };
                await db.notes.update(noteId, changesWithVersionHistory);
                return toNoteEditorRecord({ ...existing, ...changesWithVersionHistory });
            }
            const existingSnippet = await db.snippets.get(noteId);
            const existingTodo = existingSnippet ? undefined : await db.todos.get(noteId);
            const fallback = existingSnippet ?? existingTodo;
            if (fallback) {
                const sourceType = existingSnippet ? 'snippet' : 'todo';
                if (input.expectedUpdatedAt !== undefined && fallback.updatedAt !== input.expectedUpdatedAt) {
                    throw new ConflictError('Note was modified in another tab.', toNoteEditorRecord(fallback, sourceType));
                }
                // Native writers retain each category's own snapshot/history contract.
                const saved = existingSnippet
                    ? await updateSnippet(noteId, {
                        ...input,
                        config: input.body,
                    })
                    : await updateTodoContent(noteId, {
                        ...(input.title !== undefined ? { name: input.title.trim() || 'Untitled Task' } : {}),
                        ...(input.body !== undefined ? { description: input.body } : {}),
                        ...(input.organisationId !== undefined ? { organisationId: input.organisationId } : {}),
                        ...({}),
                        ...(input.tagIds !== undefined ? { tagIds: input.tagIds, tags: input.tagIds } : {}),
                        ...(input.shortcut !== undefined ? { shortcut: input.shortcut } : {}),
                        expectedUpdatedAt: input.expectedUpdatedAt,
                    });
                if (input.assetIds !== undefined) {
                    const table = existingSnippet ? db.snippets : db.todos;
                    await table.update(noteId, { assetIds: input.assetIds } as any);
                    return toNoteEditorRecord({ ...saved, assetIds: input.assetIds }, sourceType);
                }
                return toNoteEditorRecord(saved, sourceType);
            }
            throw new Error('Note not found.');
        });
        if (shouldRunAssetGarbageCollection) {
            runAssetGarbageCollection().catch(err => {
                console.error('[updateNote] GC failed:', err);
            });
        }
        return updatedNote;
    }
    catch (error: unknown) {
        if (error instanceof ConflictError)
            throw error;
        const message = error instanceof Error ? error.message : 'Unknown database error';
        console.error('[noteData.updateNote] Failed:', message);
        throw error;
    }
}
/**
 * Retrieves a specific Note by its ID.
 */
export async function getNote(id: string): Promise<NoteRecord | undefined> {
    try {
        const cleanId = extractSnippetIdFromCompoundId(id);
        const note = await db.notes.get(cleanId);
        if (note)
            return toNoteEditorRecord(note);
        const snippet = await db.snippets.get(cleanId);
        if (snippet)
            return toNoteEditorRecord(snippet, 'snippet');
        const todo = await db.todos.get(cleanId);
        if (todo)
            return toNoteEditorRecord(todo, 'todo');
        return undefined;
    }
    catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown database error';
        console.error(`[noteData.getNote] Failed: ${message}`);
        throw error;
    }
}

export async function getNotesForOrganisation(organisationId: string): Promise<NoteRecord[]> {
    try {
        return await db.notes
            .where('[organisationId+updatedAt]')
            .between([organisationId, Dexie.minKey], [organisationId, Dexie.maxKey])
            .reverse()
            .toArray();
    }
    catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown database error';
        console.error(`[noteData.getNotesForWorkspace] Failed: ${message}`);
        throw error;
    }
}
/**
 * Deletes a Note from the Dexie database.
 */
export async function deleteNote(noteId: string): Promise<void> {
    noteId = extractSnippetIdFromCompoundId(noteId);
    try {
        await deleteItemAssociations(noteId);
        const note = await db.notes.get(noteId);
        if (note) {
            await db.notes.delete(noteId);
            await removeSessionReferencesForEntity('note', noteId);
            // Run GC to clean up any orphaned images that only belonged to this note
            runAssetGarbageCollection().catch(err => {
                console.error('[deleteNote] GC failed:', err);
            });
            return;
        }
        const snippet = await db.snippets.get(noteId);
        if (snippet) {
            await db.snippets.delete(noteId);
            await removeSessionReferencesForEntity('snippet', noteId);
            return;
        }
        const todo = await db.todos.get(noteId);
        if (todo) {
            await db.todos.delete(noteId);
            return;
        }
    }
    catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown database error';
        console.error('[noteData.deleteNote] Failed:', message);
        throw error;
    }
}
/**
 * Retrieves all notes across the entire database.
 */
export async function getAllNotes(): Promise<NoteRecord[]> {
    try {
        return await db.notes.orderBy('updatedAt').reverse().toArray();
    }
    catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown database error';
        console.error(`[noteData.getAllNotes] Failed: ${message}`);
        throw error;
    }
}
