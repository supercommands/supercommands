/** Tag IDs are a path: their position determines the right-side hierarchy. */
export const sameTagOrder = (left: readonly string[], right: readonly string[]) =>
    left.length === right.length && left.every((id, index) => id === right[index]);

/** Insert a new tag, or move an already selected tag, to a selected gap. */
export function insertTagAt<T extends { id: string }>(tags: readonly T[], tag: T, gapIndex: number): T[] {
    const previousIndex = tags.findIndex(item => item.id === tag.id);
    const withoutTag = tags.filter(item => item.id !== tag.id);
    const adjustedIndex = previousIndex >= 0 && previousIndex < gapIndex ? gapIndex - 1 : gapIndex;
    const index = Math.max(0, Math.min(adjustedIndex, withoutTag.length));
    withoutTag.splice(index, 0, tag);
    return withoutTag;
}
