import * as React from 'react';
import { getNextSheetCell, getSheetArrowDelta, isSheetTypingKey, type SheetCellPosition } from './navigation';
export type SheetCellKind = 'text' | 'popup' | 'toggle' | 'action' | 'readonly';
type SheetEngineOptions = {
    rowCount: number;
    rowIds?: readonly string[];
    visibleColumnIndexes: readonly number[];
    selectedCell: SheetCellPosition | null;
    editingCell: SheetCellPosition | null;
    onSelect: (cell: SheetCellPosition, edit: boolean) => void;
    onKeyboardNavigation?: () => void;
};
/** Shared keyboard transitions for sheets. Each feature still renders and saves its own fields. */
export const useSheetEngine = ({ rowCount, rowIds, visibleColumnIndexes, selectedCell, editingCell, onSelect, onKeyboardNavigation, }: SheetEngineOptions) => {
    const [initialTypedValue, setInitialTypedValue] = React.useState<string | null>(null);
    const selectedRef = React.useRef(selectedCell);
    selectedRef.current = selectedCell;
    const previousRowsRef = React.useRef(rowIds);
    React.useLayoutEffect(() => {
        const previousRows = previousRowsRef.current;
        previousRowsRef.current = rowIds;
        if (!rowIds || !previousRows || !selectedCell)
            return;
        if (rowIds.length === previousRows.length && rowIds.every((id, index) => id === previousRows[index]))
            return;
        if (rowIds.length === 0)
            return;
        const previousId = previousRows[selectedCell.rowIndex];
        const matchingIndex = previousId ? rowIds.indexOf(previousId) : -1;
        const nextIndex = matchingIndex >= 0 ? matchingIndex : Math.min(selectedCell.rowIndex, rowIds.length - 1);
        if (nextIndex !== selectedCell.rowIndex || matchingIndex < 0) {
            onSelect({ rowIndex: nextIndex, colIndex: selectedCell.colIndex }, false);
        }
    }, [onSelect, rowIds, selectedCell]);
    React.useEffect(() => {
        if (!editingCell)
            setInitialTypedValue(null);
    }, [editingCell]);
    const moveCell = React.useCallback((rowDelta: number, columnDelta: number) => {
        const current = selectedRef.current;
        if (!current)
            return;
        const next = getNextSheetCell(current, rowCount, visibleColumnIndexes, rowDelta, columnDelta);
        if (!next)
            return;
        if (next.rowIndex === current.rowIndex && next.colIndex === current.colIndex) {
            if (editingCell)
                onSelect(current, false);
            return;
        }
        onKeyboardNavigation?.();
        selectedRef.current = next;
        onSelect(next, false);
    }, [editingCell, onKeyboardNavigation, onSelect, rowCount, visibleColumnIndexes]);
    const handleCellKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLElement>, cell: SheetCellPosition, kind: SheetCellKind, onActivate?: () => void) => {
        if (event.target !== event.currentTarget || editingCell)
            return false;
        if (event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing)
            return false;
        const delta = getSheetArrowDelta(event.key);
        if (delta && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
            event.preventDefault();
            event.stopPropagation();
            moveCell(...delta);
            return true;
        }
        if (event.key === 'Tab') {
            const current = selectedRef.current;
            const visibleIndex = visibleColumnIndexes.indexOf(current?.colIndex ?? -1);
            const nextIndex = visibleIndex + (event.shiftKey ? -1 : 1);
            if (current && nextIndex >= 0 && nextIndex < visibleColumnIndexes.length) {
                event.preventDefault();
                event.stopPropagation();
                const next = { rowIndex: current.rowIndex, colIndex: visibleColumnIndexes[nextIndex] };
                selectedRef.current = next;
                onSelect(next, false);
                return true;
            }
            return false;
        }
        if (event.key === 'Enter' || event.key === 'F2' || (event.key === ' ' && kind !== 'text')) {
            if (event.key === 'F2' && (kind === 'toggle' || kind === 'action'))
                return false;
            event.preventDefault();
            event.stopPropagation();
            setInitialTypedValue(null);
            if (kind === 'toggle' || kind === 'action')
                onActivate?.();
            else if (kind !== 'readonly')
                onSelect(cell, true);
            return true;
        }
        if (kind === 'text' && isSheetTypingKey(event.nativeEvent)) {
            event.preventDefault();
            event.stopPropagation();
            setInitialTypedValue(event.key);
            onSelect(cell, true);
            return true;
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            return true;
        }
        return false;
    }, [editingCell, moveCell, onSelect, visibleColumnIndexes]);
    return { moveCell, handleCellKeyDown, initialTypedValue };
};
