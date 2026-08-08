/**
 * @file snippetTypes.ts
 * @description Defines TypeScript interfaces for Snippet records, representing code fragments,
 * configurations, templates, or parsed AST payloads, alongside CRUD inputs.
 * 
 * @usage
 * ```ts
 * import type { SnippetRecord, CreateSnippetInput } from './snippetTypes';
 * ```
 */

import type { StructuredVersionHistory } from '../../../../shared-components/versionHistory/structuredVersionHistory';

export interface SnippetSnapshot {
  title: string;
  config: string | Record<string, any>;
  workspaceId: string;
  folderId: string | null;
  tagIds: string[];
  shortcut?: string;
}

export interface SnippetRecord {

  id: string;
  workspaceId: string;
  folderId: string | null;

  title: string;
  config: string | Record<string, any>; // The main data payload for Snippets (AST/JSON)
  tagIds: string[];
  shortcut?: string;

  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;

  versionHistory?: StructuredVersionHistory<SnippetSnapshot>;
}

export interface CreateSnippetInput {
  workspaceId?: string;
  folderId?: string | null;
  title: string;
  config: string | Record<string, any>;
  tagIds?: string[];
  shortcut?: string;
}

export interface UpdateSnippetInput {
  title?: string;
  config?: string | Record<string, any>;
  workspaceId?: string;
  folderId?: string | null;
  tagIds?: string[];
  shortcut?: string;
}
