/** Transitional adapter for older callers. New typed callers use note exclusively. */
export function normalizeCollectionItemNote(value: Record<string, unknown>): Record<string, unknown> {
  const { description, ...input } = value;
  if (input.note === undefined && description !== undefined) input.note = description;
  return input;
}
