/** Open only an explicitly selected saved note; a bare Notes tab starts with a blank editor. */
export function selectWorkspaceNoteId(items: readonly {id: string}[], selectedId: string | null, isCreating: boolean): string | null {
  if (isCreating) return null;
  return items.find(item => item.id === selectedId)?.id || null;
}
