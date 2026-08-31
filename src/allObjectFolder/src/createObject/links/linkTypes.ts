/**
 * @file linkTypes.ts
 * @description Defines TypeScript types and interfaces for Link items and records.
 * Includes data models for browser tab representations and UI layouts.
 * 
 * @usage
 * ```ts
 * import type { LinkRecord, LinkItem } from './linkTypes';
 * ```
 */

export interface LinkItem {

  id: string;
  title?: string;
  name?: string;
  url: string;
  favIconUrl?: string;
  source?: 'tab' | 'custom' | 'note' | 'link' | 'snippet' | 'agent' | 'history' | 'bookmark';
  originalData?: any;
}

export type SelectedLink = LinkItem;

import type { StructuredVersionHistory } from '../../../../shared-components/versionHistory/structuredVersionHistory';

export interface LinkSnapshot {
  title: string;
  urls: LinkItem[];
  workspaceId: string;
  folderId: string | null;
  tagIds: string[];
  shortcut?: string;
}

export interface LinkRecord {
  id: string;
  workspaceId: string;
  folderId: string | null;

  title: string;
  urls: LinkItem[];
  tagIds: string[];
  shortcut?: string;

  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;

  versionHistory?: StructuredVersionHistory<LinkSnapshot>;
}

export const LINK_COMPARISON_FIELDS = ['id', 'workspaceId', 'folderId', 'title', 'urls', 'tagIds', 'shortcut', 'deletedAt'] as const satisfies readonly (keyof LinkRecord)[];

export interface CreateLinkInput {
  id?: string;
  workspaceId?: string;
  folderId?: string | null;
  title: string;
  urls: LinkItem[];
  tagIds?: string[];
  shortcut?: string;
}

export interface UpdateLinkInput {
  title?: string;
  urls?: LinkItem[];
  workspaceId?: string;
  folderId?: string | null;
  tagIds?: string[];
  shortcut?: string;
  expectedUpdatedAt?: number;
}

export type BrowserTab = {
  id: number;
  url: string;
  title: string;
  favIconUrl?: string;
  windowId: number;
  active: boolean;
  highlighted?: boolean;
  index?: number;
};

// Content bar tab type
export type ContentTab = 'Current Tabs' | 'Selected tabs' | 'All saved files';
