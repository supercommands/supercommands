/**
 * @file sessionData.ts
 * @description Handles CRUD database operations for Session (Tab Session) records in IndexedDB.
 * Supports loading by workspace, folder, or at root levels.
 * 
 * @usage
 * ```ts
 * import { createSession, getSession } from './sessionData';
 * const session = await getSession(id);
 * ```
 */

import Dexie from 'dexie';

import type { SessionRecord, CreateSessionInput, UpdateSessionInput, SessionSnapshot } from './sessionTypes';
import { generateEntityId } from '../../../../shared-components/utils';
import { db, deleteItemAssociations } from '../../../../storage/indexDB/dbConfig';
import { getSmartDefaultWorkspace } from '../../../../storage/localStorage/lastUsedWorkspace';
import {
  createInitialHistory,
  normalizeHistory,
  upsertVersionForChange,
} from '../../../../shared-components/versionHistory/structuredVersionHistory';

import { getSessionTabTitle } from './sessionHelpers';

function extractSessionSnapshot(session: SessionRecord): SessionSnapshot {
  return {
    title: session.title,
    description: session.description || '',
    urls: (session.urls || []).map(u => ({
      ...u,
      title: getSessionTabTitle(u),
    })),
    workspaceId: session.workspaceId,
    folderId: session.folderId,
    tagIds: [...(session.tagIds || [])],
    sessionOpenSettings: session.sessionOpenSettings ? { ...session.sessionOpenSettings } : undefined,
    windowId: session.windowId,
    shortcut: session.shortcut || '',
  };
}

/**
 * Creates a new session record.
 */
export async function createSession(input: CreateSessionInput): Promise<SessionRecord> {
  const defaultWorkspace = input.workspaceId
    ? null
    : await getSmartDefaultWorkspace();

  const workspaceId = input.workspaceId ?? defaultWorkspace?.id;

  if (!workspaceId) {
    throw new Error('A workspace is required.');
  }

  const now = Date.now();
  const folderId = input.folderId ?? null;

  const session: SessionRecord = {
    id: input.id || generateEntityId('session'),
    workspaceId,
    folderId,

    title: input.title.trim() || 'Untitled Tab Session',
    description: input.description?.trim() || '',
    urls: (input.urls ?? []).map(u => ({
      ...u,
      title: getSessionTabTitle(u),
    })),
    tagIds: input.tagIds ?? [],
    sessionOpenSettings: input.sessionOpenSettings,
    windowId: input.windowId,
    shortcut: input.shortcut || '',

    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    versionHistory: undefined as any,
  };

  session.versionHistory = createInitialHistory<SessionSnapshot>(extractSessionSnapshot(session), now);

  try {
    await db.sessions.add(session);
    return session;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error('[sessionData.createSession] Failed:', message);
    throw error;
  }
}

export class ConflictError extends Error {
  remoteSession?: SessionRecord;

  constructor(message: string, remoteSession?: SessionRecord) {
    super(message);
    this.name = 'ConflictError';
    this.remoteSession = remoteSession;
  }
}

/**
 * Updates an existing session record.
 */
export async function updateSession(sessionId: string, input: UpdateSessionInput): Promise<SessionRecord> {
  const now = Date.now();
  const changes: Partial<SessionRecord> = {
    updatedAt: now,
  };

  if (input.title !== undefined) {
    changes.title = input.title.trim() || 'Untitled Tab Session';
  }

  if (input.description !== undefined) {
    changes.description = input.description.trim();
  }

  if (input.urls !== undefined) {
    changes.urls = input.urls.map(u => ({
      ...u,
      title: getSessionTabTitle(u),
    }));
  }

  if (input.workspaceId !== undefined) changes.workspaceId = input.workspaceId;
  if (input.folderId !== undefined) changes.folderId = input.folderId;
  if (input.tagIds !== undefined) changes.tagIds = input.tagIds;
  if (input.sessionOpenSettings !== undefined) changes.sessionOpenSettings = input.sessionOpenSettings;
  if (input.windowId !== undefined) changes.windowId = input.windowId;
  if (input.shortcut !== undefined) changes.shortcut = input.shortcut;

  try {
    return await db.transaction('rw', db.sessions, async () => {
      const existing = await db.sessions.get(sessionId);
      if (!existing) {
        throw new Error('Session not found.');
      }

      if (input.expectedUpdatedAt !== undefined && existing.updatedAt !== input.expectedUpdatedAt) {
        throw new ConflictError('Session was modified in another tab.', existing);
      }

      const nextRecord: SessionRecord = {
        ...existing,
        ...changes,
        updatedAt: now,
      };

      const prevSnapshot = extractSessionSnapshot(existing);
      const nextSnapshot = extractSessionSnapshot(nextRecord);

      const { history: nextHistory } = upsertVersionForChange<SessionSnapshot>(
        existing.versionHistory,
        prevSnapshot,
        nextSnapshot,
        now
      );

      nextRecord.versionHistory = nextHistory;
      await db.sessions.put(nextRecord);
      return nextRecord;
    });
  } catch (error: unknown) {
    if (error instanceof ConflictError) throw error;
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error('[sessionData.updateSession] Failed:', message);
    throw error;
  }
}

/**
 * Retrieves a specific Session by its ID.
 */
export async function getSession(id: string): Promise<SessionRecord | undefined> {
  try {
    return await db.sessions.get(id);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[sessionData.getSession] Failed: ${message}`);
    throw error;
  }
}

/**
 * Retrieves all Sessions inside a specific Workspace (regardless of folder).
 */
export async function getSessionsForWorkspace(workspaceId: string): Promise<SessionRecord[]> {
  try {
    return await db.sessions
      .where('[workspaceId+updatedAt]')
      .between([workspaceId, Dexie.minKey], [workspaceId, Dexie.maxKey])
      .reverse()
      .toArray();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[sessionData.getSessionsForWorkspace] Failed: ${message}`);
    throw error;
  }
}

/**
 * Retrieves all Sessions that are strictly at the ROOT of a workspace (folderId is null).
 */
export async function getSessionsForWorkspaceRoot(workspaceId: string): Promise<SessionRecord[]> {
  try {
    const allWorkspaceSessions = await getSessionsForWorkspace(workspaceId);
    return allWorkspaceSessions.filter(session => session.folderId == null);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[sessionData.getSessionsForWorkspaceRoot] Failed: ${message}`);
    throw error;
  }
}

/**
 * Retrieves all Sessions that belong to a specific Folder.
 */
export async function getSessionsForFolder(workspaceId: string, folderId: string): Promise<SessionRecord[]> {
  try {
    const sessions = await db.sessions
      .where('[workspaceId+folderId]')
      .equals([workspaceId, folderId])
      .toArray();
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[sessionData.getSessionsForFolder] Failed: ${message}`);
    throw error;
  }
}

/**
 * Deletes a Session from the Dexie database.
 */
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    await deleteItemAssociations(sessionId);
    await db.sessions.delete(sessionId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error('[sessionData.deleteSession] Failed:', message);
    throw error;
  }
}

/**
 * Retrieves all sessions across the entire database.
 */
export async function getAllSessions(): Promise<SessionRecord[]> {
  try {
    return await db.sessions.orderBy('updatedAt').reverse().toArray();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown database error';
    console.error(`[sessionData.getAllSessions] Failed: ${message}`);
    throw error;
  }
}
