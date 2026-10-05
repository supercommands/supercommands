import { CollectionStorageError } from './collectionErrors';

/** Shape normalization only. Tag existence and ownership belong to persistence. */
export function normalizeCollectionItemTagIds(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new CollectionStorageError('INVALID_INPUT', 'tagIds must be an array of tag IDs.');
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    if (typeof candidate !== 'string' || !candidate.trim())
      throw new CollectionStorageError('INVALID_INPUT', 'Each tag ID must be nonempty text.');
    const id = candidate.trim();
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/** Preserve omission in update inputs; an explicit empty array clears all associations. */
export function normalizeCollectionItemTagIdsPatch(value: unknown): string[] | undefined {
  return value === undefined ? undefined : normalizeCollectionItemTagIds(value);
}
