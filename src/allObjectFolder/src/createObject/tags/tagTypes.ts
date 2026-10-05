export type TagAppearance =
    | { kind: 'color'; value: 'textMuted' | 'success' | 'warning' | 'error' }
    | { kind: 'icon'; value: 'tag' | 'work' | 'idea' | 'research' | 'book' | 'code' | 'bug' | 'star' | 'target' | 'personal' }
    | { kind: 'image'; assetId: string };

/** Upload bytes belong to the editor draft, never to a persisted tag. */
export type TagAppearanceDraft = TagAppearance | { kind: 'image'; value: string };
export type TagUpdateInput = Omit<Partial<TagRecord>, 'appearance'> & { appearance?: TagAppearanceDraft };
/**
 * @file tagTypes.ts
 * @description Defines the TypeScript interface for Tag entities,
 * including tag IDs, names, optional dashboard ownership, and timestamps.
 *
 * @usage
 * ```ts
 * import type { TagRecord } from './tagTypes';
 * ```
 */
export interface TagRecord {
    id: string; // tag_id
    name: string; // name
    workspaceId: string | null;
    appearance?: TagAppearance;
    createdAt: number;
    updatedAt: number;
}
export const TAG_COMPARISON_FIELDS = ['id', 'name', 'workspaceId', 'appearance'] as const satisfies readonly (keyof TagRecord)[];
