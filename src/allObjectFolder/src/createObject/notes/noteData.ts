/**
 * @file noteData.ts
 * @description Handles CRUD database operations for Note records in IndexedDB.
 * Supports retrieval scoped to workspaces, specific folders, or at the workspace root.
 *
 * @usage
 * ```ts
 * import { createNote, updateNote, getNote } from './noteData';
 * const newNote = await createNote({ title: 'My Note', body: 'Hello' });
 * ```
 */

import Dexie from 'dexie';

import type { NoteRecord, CreateNoteInput, UpdateNoteInput } from './noteTypes';
import { generateEntityId } from '../../../../shared-components/utils';
import { db, deleteItemAssociations } from '../../../../storage/indexDB/dbConfig';
import { getSmartDefaultWorkspace } from '../../../../storage/localStorage/lastUsedWorkspace';
import { normalizeNoteBody } from './noteHelpers';
import { runAssetGarbageCollection } from '../../../../storage/assets/assetGarbageCollector';
import { createCheckpoint, createInitialHistory, shouldCreateCheckpoint, extractNoteSnapshotFromRecord } from './noteHistory';

/**
 * Creates a new note record.
 */
export async function createNote(input: CreateNoteInput): Promise<NoteRecord> {
  const defaultWorkspace = input.workspaceId ? null : await getSmartDefaultWorkspace();

  const workspaceId = input.workspaceId ?? defaultWorkspace?.id;

  if (!workspaceId) {
    throw new Error('A workspace is required.');
  }

  const now = Date.now();
  const folderId = input.folderId ?? null;
  const body = normalizeNoteBody(input.body);
  const note: NoteRecord = {
    id: generateEntityId('note'),
    workspaceId,
    folderId,

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
  } catch (error: unknown) {
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
  const now = Date.now();
  const changes: Partial<NoteRecord> = {
    updatedAt: now,
  };
  let shouldRunAssetGarbageCollection = false;

  if (input.title !== undefined) changes.title = input.title.trim() || 'Untitled Note';
  if (input.body !== undefined) changes.body = normalizeNoteBody(input.body);
  if (input.shortcut !== undefined) changes.shortcut = input.shortcut;
  if (input.workspaceId !== undefined) changes.workspaceId = input.workspaceId;
  if (input.folderId !== undefined) changes.folderId = input.folderId;
  if (input.tagIds !== undefined) changes.tagIds = input.tagIds;
  if (input.assetIds !== undefined) changes.assetIds = input.assetIds;

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

        const prevSnapshot = extractNoteSnapshotFromRecord(existing);
        const nextSnapshot = extractNoteSnapshotFromRecord({ ...existing, ...changes });

        let newHistoryState = existing.versionHistory;
        if (!newHistoryState || typeof newHistoryState.lastSavedText !== 'string') {
          newHistoryState = createInitialHistory(prevSnapshot, existing.updatedAt || now);
        }

        newHistoryState = createCheckpoint(nextSnapshot, newHistoryState, now, prevSnapshot);

        const changesWithVersionHistory = { ...changes, versionHistory: newHistoryState };

        await db.notes.update(noteId, changesWithVersionHistory);
        return { ...existing, ...changesWithVersionHistory } as NoteRecord;
      }

      const existingSnippet = await db.snippets.get(noteId);
      if (existingSnippet) {
        const snippetChanges: any = {};
        if (input.title !== undefined) snippetChanges.title = input.title.trim();
        if (input.body !== undefined) snippetChanges.config = input.body;
        if (input.workspaceId !== undefined) snippetChanges.workspaceId = input.workspaceId;
        if (input.folderId !== undefined) snippetChanges.folderId = input.folderId;
        await db.snippets.update(noteId, snippetChanges);
        const configStr =
          snippetChanges.config ??
          (typeof existingSnippet.config === 'string'
            ? existingSnippet.config
            : JSON.stringify(existingSnippet.config || ''));
        return {
          ...existingSnippet,
          ...snippetChanges,
          title: snippetChanges.title ?? existingSnippet.title,
          body: configStr ?? '',
          updatedAt: Date.now(),
        } as any;
      }

      const existingTodo = await db.todos.get(noteId);
      if (existingTodo) {
        const todoChanges: any = {
          updatedAt: Date.now(),
        };
        if (input.title !== undefined) todoChanges.name = input.title.trim();
        if (input.body !== undefined) todoChanges.description = input.body;

        await db.todos.update(noteId, todoChanges);
        return {
          id: noteId,
          title: todoChanges.name ?? existingTodo.name,
          body: todoChanges.description ?? existingTodo.description ?? '',
          workspaceId: null,
          folderId: null,
          tagIds: [],
          updatedAt: todoChanges.updatedAt,
          createdAt: existingTodo.createdAt,
        } as any;
      }

      throw new Error('Note not found.');
    });

    if (shouldRunAssetGarbageCollection) {
      runAssetGarbageCollection().catch(err => {
        console.error('[updateNote] GC failed:', err);
      });
    }

    return updatedNote;
  } catch (error: unknown) {
    if (error instanceof ConflictError) throw error;
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
    const note = await db.notes.get(id);
    if (note) return note;

    const snippet = await db.snippets.get(id);
    if (snippet) {
      const configStr = typeof snippet.config === 'string' ? snippet.config : JSON.stringify(snippet.config || '');
      return {
        ...snippet,
        body: configStr ?? '',
      } as any;
    }

    const todo = await db.todos.get(id);
    if (todo) {
      return {
        id: todo.id,
        title: todo.name,
        body: todo.description || '',
        workspaceId: null,
        folderId: null,
        tagIds: [],
        updatedAt: todo.updatedAt,
        createdAt: todo.createdAt,
      } as any;
    }

    return undefined;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[noteData.getNote] Failed: ${message}`);
    throw error;
  }
}

/**
 * Retrieves all Notes inside a specific Workspace (regardless of folder).
 */
export async function getNotesForWorkspace(workspaceId: string): Promise<NoteRecord[]> {
  try {
    return await db.notes
      .where('[workspaceId+updatedAt]')
      .between([workspaceId, Dexie.minKey], [workspaceId, Dexie.maxKey])
      .reverse()
      .toArray();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[noteData.getNotesForWorkspace] Failed: ${message}`);
    throw error;
  }
}

/**
 * Retrieves all Notes that are strictly at the ROOT of a workspace (folderId is null).
 */
export async function getNotesForWorkspaceRoot(workspaceId: string): Promise<NoteRecord[]> {
  try {
    return await db.notes
      .where('[workspaceId+folderId+updatedAt]')
      .between([workspaceId, null, Dexie.minKey], [workspaceId, null, Dexie.maxKey])
      .reverse()
      .toArray();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[noteData.getNotesForWorkspaceRoot] Failed: ${message}`);
    throw error;
  }
}

/**
 * Retrieves all Notes that belong to a specific Folder.
 */
export async function getNotesForFolder(workspaceId: string, folderId: string): Promise<NoteRecord[]> {
  try {
    return await db.notes
      .where('[workspaceId+folderId+updatedAt]')
      .between([workspaceId, folderId, Dexie.minKey], [workspaceId, folderId, Dexie.maxKey])
      .reverse()
      .toArray();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[noteData.getNotesForFolder] Failed: ${message}`);
    throw error;
  }
}

/**
 * Deletes a Note from the Dexie database.
 */
export async function deleteNote(noteId: string): Promise<void> {
  try {
    await deleteItemAssociations(noteId);
    const note = await db.notes.get(noteId);
    if (note) {
      await db.notes.delete(noteId);
      // Run GC to clean up any orphaned images that only belonged to this note
      runAssetGarbageCollection().catch(err => {
        console.error('[deleteNote] GC failed:', err);
      });
      return;
    }
    const snippet = await db.snippets.get(noteId);
    if (snippet) {
      await db.snippets.delete(noteId);
      return;
    }
    const todo = await db.todos.get(noteId);
    if (todo) {
      await db.todos.delete(noteId);
      return;
    }
  } catch (error: unknown) {
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[noteData.getAllNotes] Failed: ${message}`);
    throw error;
  }
}
