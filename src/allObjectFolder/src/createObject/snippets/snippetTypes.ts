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
    organisationId: string;
    tagIds: string[];
    shortcut?: string;
}
export interface SnippetRecord {
    id: string;
    organisationId: string;
    title: string;
    config: string | Record<string, any>; // The main data payload for Snippets (AST/JSON)
    tagIds: string[];
    shortcut?: string;
    createdAt: number;
    updatedAt: number;
    deletedAt: number | null;
    versionHistory?: StructuredVersionHistory<SnippetSnapshot>;
}
export const SNIPPET_COMPARISON_FIELDS = ['id', 'organisationId', 'title', 'config', 'tagIds', 'shortcut', 'deletedAt'] as const satisfies readonly (keyof SnippetRecord)[];
export interface CreateSnippetInput {
    organisationId?: string;
    title: string;
    config: string | Record<string, any>;
    tagIds?: string[];
    shortcut?: string;
}
export interface UpdateSnippetInput {
    expectedUpdatedAt?: number;
    title?: string;
    config?: string | Record<string, any>;
    organisationId?: string;
    tagIds?: string[];
    shortcut?: string;
}
