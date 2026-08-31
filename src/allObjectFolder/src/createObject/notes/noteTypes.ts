/**
 * @file noteTypes.ts
 * @description Defines TypeScript interfaces for the Note entity,
 * including representations for stored notes and input validation models.
 *
 * @usage
 * ```ts
 * import type { NoteRecord, CreateNoteInput } from './noteTypes';
 * ```
 */

import type { StructuredVersionHistory } from '../../../../shared-components/versionHistory/structuredVersionHistory';

export interface NoteSnapshot {
  entityType: 'note';
  title: string;
  body: string;
  shortcut?: string;
  workspaceId: string;
  folderId: string | null;
  tagIds: string[];
}

export interface NoteRecord {
  id: string;
  workspaceId: string;
  folderId: string | null;

  title: string;
  body: string;
  shortcut?: string;
  tagIds: string[];
  assetIds: string[];

  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;

  versionHistory: NoteVersionHistory;
}

export const NOTE_COMPARISON_FIELDS = ['id', 'workspaceId', 'folderId', 'title', 'body', 'shortcut', 'tagIds', 'assetIds', 'deletedAt'] as const satisfies readonly (keyof NoteRecord)[];

export interface NoteVersionHistory {
  lastSavedText: string;
  historyBuffer: string[];
  lastCheckpointAt: number;
  structuredHistory?: StructuredVersionHistory<NoteSnapshot>;
}

export interface CreateNoteInput {
  workspaceId?: string;
  folderId?: string | null;
  title: string;
  body: string;
  shortcut?: string;
  tagIds?: string[];
  assetIds?: string[];
}

export interface UpdateNoteInput {
  title?: string;
  body?: string;
  shortcut?: string;
  workspaceId?: string;
  folderId?: string | null;
  tagIds?: string[];
  assetIds?: string[];
  expectedUpdatedAt?: number;
}
