import { invalid, revision } from '../collectionValidation';

/** Blank labels use the common default; property identity never depends on the label. */
export function normalizeCollectionPropertyLabel(label: string): string {
  return label.trim() || 'Untitled';
}
export function collectionPropertyLabel(value: unknown, allowOmitted = false): string {
  if (value === undefined && allowOmitted) return normalizeCollectionPropertyLabel('');
  if (typeof value !== 'string') invalid('Property label must be text.');
  return normalizeCollectionPropertyLabel(value);
}

export function collectionPropertyRevision(value: unknown): number {
  const expected = revision(value);
  if (expected === undefined) invalid('expectedUpdatedAt is required for property changes.');
  return expected;
}

export function collectionPropertyTextValue(value: unknown): string | null {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') invalid('Property value must be text or null.');
  return value;
}
