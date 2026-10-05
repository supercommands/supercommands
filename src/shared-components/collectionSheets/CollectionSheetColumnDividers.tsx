import * as React from 'react';
type CollectionSheetColumnDividersProps = {
    offsets: number[];
};
export const COLLECTION_SHEET_ROW_HOVER_CELL_CLASS = 'relative border-y border-r border-transparent transition-colors first:border-l first:rounded-l-md last:rounded-r-md';
/**
 * Keeps the frame and column separators independent of individual records,
 * without changing table dimensions or intercepting cell interactions.
 */
export const useCollectionSheetColumnDividerOffsets = (tableRef: React.RefObject<HTMLTableElement | null>, dividerColumnIndexes: readonly number[]) => {
    const [offsets, setOffsets] = React.useState<number[]>([]);
    React.useLayoutEffect(() => {
        const table = tableRef.current;
        if (!table)
            return;
        const updateOffsets = () => {
            const firstDataRow = table.querySelector<HTMLTableRowElement>('[data-collection-sheet-row="true"]');
            const tableRect = table.getBoundingClientRect();
            // Divider positions use local CSS coordinates even when the sheet is scaled.
            const coordinateScale = tableRect.width > 0 ? table.offsetWidth / tableRect.width : 1;
            const cells = firstDataRow
                ? Array.from(firstDataRow.cells)
                : Array.from(table.querySelectorAll<HTMLTableColElement>('col'));
            setOffsets(dividerColumnIndexes.flatMap(index => {
                const cell = cells[index];
                return cell ? [Math.round((cell.getBoundingClientRect().right - tableRect.left) * coordinateScale)] : [];
            }));
        };
        updateOffsets();
        const observer = new ResizeObserver(updateOffsets);
        observer.observe(table);
        return () => observer.disconnect();
    }, [dividerColumnIndexes, tableRef]);
    return offsets;
};
export function CollectionSheetColumnDividers({ offsets }: CollectionSheetColumnDividersProps) {
    return (<div aria-hidden="true" className="pointer-events-none absolute inset-0 z-30">
      <span className="absolute inset-0 rounded-lg border border-[var(--color-borderDefault)]"/>
      {offsets.map(offset => (<span key={offset} className="absolute inset-y-0 w-px bg-[var(--color-borderDefault)] opacity-40" style={{ left: offset }}/>))}
    </div>);
}
