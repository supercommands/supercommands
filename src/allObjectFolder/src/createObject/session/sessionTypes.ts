/**
 * @file sessionTypes.ts
 * @description Defines TypeScript types and interfaces for saved Session entities 
 * (Tab Sessions), including metadata fields, window preferences, and CRUD inputs.
 * 
 * @usage
 * ```ts
 * import type { SessionRecord, CreateSessionInput } from './sessionTypes';
 * ```
 */

import { LinkItem } from '../links/linkTypes';

import { SessionOpenSettings } from './sessionSettings';

export interface SessionRecord {
  id: string;
  workspaceId: string;
  folderId: string | null;

  title: string;
  urls: LinkItem[];
  tagIds: string[];
  sessionOpenSettings?: SessionOpenSettings;
  windowId?: number;

  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface CreateSessionInput {
  id?: string;
  workspaceId?: string;
  folderId?: string | null;
  title: string;
  urls: LinkItem[];
  tagIds?: string[];
  sessionOpenSettings?: SessionOpenSettings;
  windowId?: number;
}

export interface UpdateSessionInput {
  title?: string;
  urls?: LinkItem[];
  workspaceId?: string;
  folderId?: string | null;
  tagIds?: string[];
  sessionOpenSettings?: SessionOpenSettings;
  windowId?: number;
  expectedUpdatedAt?: number;
}
