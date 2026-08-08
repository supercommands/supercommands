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

import type { StructuredVersionHistory } from '../../../../shared-components/versionHistory/structuredVersionHistory';

export interface SessionSnapshot {
  title: string;
  description?: string;
  urls: LinkItem[];
  workspaceId: string;
  folderId: string | null;
  tagIds: string[];
  sessionOpenSettings?: SessionOpenSettings;
  windowId?: number;
  shortcut?: string;
}

export interface SessionRecord {
  id: string;
  workspaceId: string;
  folderId: string | null;

  title: string;
  description?: string;
  urls: LinkItem[];
  tagIds: string[];
  sessionOpenSettings?: SessionOpenSettings;
  windowId?: number;
  shortcut?: string;

  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;

  versionHistory?: StructuredVersionHistory<SessionSnapshot>;
}

export interface CreateSessionInput {
  id?: string;
  workspaceId?: string;
  folderId?: string | null;
  title: string;
  description?: string;
  urls: LinkItem[];
  tagIds?: string[];
  sessionOpenSettings?: SessionOpenSettings;
  windowId?: number;
  shortcut?: string;
}

export interface UpdateSessionInput {
  title?: string;
  description?: string;
  urls?: LinkItem[];
  workspaceId?: string;
  folderId?: string | null;
  tagIds?: string[];
  sessionOpenSettings?: SessionOpenSettings;
  windowId?: number;
  shortcut?: string;
  expectedUpdatedAt?: number;
}
