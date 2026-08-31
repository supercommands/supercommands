/**
 * @file tagTypes.ts
 * @description Defines the TypeScript interface for Tag entities,
 * including tag IDs, names, associated workspace IDs, and timestamps.
 * 
 * @usage
 * ```ts
 * import type { TagRecord } from './tagTypes';
 * ```
 */

export interface TagRecord {

  id: string; // tag_id
  name: string; // name
  workspaceId: string;
  createdAt: number;
  updatedAt: number;
}

export const TAG_COMPARISON_FIELDS = ['id', 'name', 'workspaceId'] as const satisfies readonly (keyof TagRecord)[];
