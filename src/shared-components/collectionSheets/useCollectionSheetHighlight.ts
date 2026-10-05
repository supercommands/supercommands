import * as React from 'react';
type HighlightSource = 'keyboard' | 'mouse';
/** Keeps the visual highlight source exclusive without changing the selected cell. */
export const useCollectionSheetHighlight = () => {
    const [source, setSource] = React.useState<HighlightSource>('keyboard');
    const [hoveredRowIndex, setHoveredRowIndex] = React.useState<number | null>(null);
    const markKeyboard = React.useCallback(() => setSource('keyboard'), []);
    const handleRowPointerActivity = React.useCallback((event: React.PointerEvent<HTMLTableRowElement>, rowIndex: number) => {
        if (event.pointerType !== 'mouse')
            return;
        setSource('mouse');
        setHoveredRowIndex(rowIndex);
    }, []);
    const handleRowPointerLeave = React.useCallback((event: React.PointerEvent<HTMLTableRowElement>, rowIndex: number) => {
        if (event.pointerType !== 'mouse')
            return;
        const nextRow = event.relatedTarget instanceof Element
            ? event.relatedTarget.closest('[data-collection-sheet-row="true"]')
            : null;
        if (nextRow)
            return;
        setHoveredRowIndex(current => (current === rowIndex ? null : current));
        setSource('keyboard');
    }, []);
    return {
        isKeyboardHighlight: source === 'keyboard',
        isHoveredRow: (rowIndex: number) => source === 'mouse' && hoveredRowIndex === rowIndex,
        markKeyboard,
        rowPointerProps: (rowIndex: number) => ({
            onPointerEnter: (event: React.PointerEvent<HTMLTableRowElement>) => handleRowPointerActivity(event, rowIndex),
            onPointerMove: (event: React.PointerEvent<HTMLTableRowElement>) => handleRowPointerActivity(event, rowIndex),
            onPointerLeave: (event: React.PointerEvent<HTMLTableRowElement>) => handleRowPointerLeave(event, rowIndex),
            onKeyDownCapture: markKeyboard,
            onFocusCapture: (event: React.FocusEvent<HTMLTableRowElement>) => {
                if (event.target instanceof HTMLElement && event.target.matches(':focus-visible'))
                    markKeyboard();
            },
        }),
    };
};
export const COLLECTION_SHEET_HOVERED_CELL_CLASS = 'border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)]';
