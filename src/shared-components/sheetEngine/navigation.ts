export type SheetCellPosition = {
    rowIndex: number;
    colIndex: number;
};
export const getNextSheetCell = (current: SheetCellPosition, rowCount: number, visibleColumnIndexes: readonly number[], rowDelta: number, columnDelta: number): SheetCellPosition | null => {
    if (rowCount < 1 || visibleColumnIndexes.length < 1)
        return null;
    const rowIndex = Math.max(0, Math.min(rowCount - 1, current.rowIndex + rowDelta));
    const visibleIndex = visibleColumnIndexes.indexOf(current.colIndex);
    const columnIndex = Math.max(0, Math.min(visibleColumnIndexes.length - 1, (visibleIndex < 0 ? 0 : visibleIndex) + columnDelta));
    return { rowIndex, colIndex: visibleColumnIndexes[columnIndex] };
};
export const getSheetArrowDelta = (key: string): readonly [
    number,
    number
] | null => {
    switch (key) {
        case 'ArrowUp':
            return [-1, 0];
        case 'ArrowDown':
            return [1, 0];
        case 'ArrowLeft':
            return [0, -1];
        case 'ArrowRight':
            return [0, 1];
        default:
            return null;
    }
};
export const isSheetTypingKey = (event: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'isComposing'>) => event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.isComposing;
