import { convertFineGridToLegacyPosition, getAllowedWidgetColumns, snapToAllowedColumn, snapToAllowedWidth, WIDGET_MACRO_ROW_HEIGHT, WIDGET_SIZE_PRESETS, WIDGET_CONSTRAINTS, WIDGET_GRID_COLUMNS, } from './widgetDashboardLogic';
import type { WidgetGridPosition } from './widgetDashboardRuntimeTypes';
export const clampWidgetPosition = (position: WidgetGridPosition): WidgetGridPosition => {
    const currentPos = position.gridVersion === 2 ? convertFineGridToLegacyPosition(position) : position;
    const rawWidth = Number.isFinite(currentPos.w) ? Math.round(currentPos.w) : WIDGET_CONSTRAINTS.minW;
    const rawHeight = Number.isFinite(currentPos.h) ? Math.round(currentPos.h) : WIDGET_CONSTRAINTS.minH;
    const minW = Number.isFinite(currentPos.minW) ? Math.min(WIDGET_GRID_COLUMNS, Math.max(WIDGET_CONSTRAINTS.minW, Math.round(currentPos.minW!))) : WIDGET_CONSTRAINTS.minW;
    const maxW = Number.isFinite(currentPos.maxW) ? Math.min(WIDGET_GRID_COLUMNS, Math.max(minW, Math.round(currentPos.maxW!))) : WIDGET_CONSTRAINTS.maxW;
    const minH = Number.isFinite(currentPos.minH) ? Math.min(WIDGET_CONSTRAINTS.maxH, Math.max(WIDGET_CONSTRAINTS.minH, Math.round(currentPos.minH!))) : WIDGET_CONSTRAINTS.minH;
    const maxH = Number.isFinite(currentPos.maxH) ? Math.min(WIDGET_CONSTRAINTS.maxH, Math.max(minH, Math.round(currentPos.maxH!))) : WIDGET_CONSTRAINTS.maxH;
    const w = snapToAllowedWidth(Math.min(Math.max(rawWidth, minW), maxW));
    const h = Math.min(Math.max(Math.round(Math.min(Math.max(rawHeight, minH), maxH) / WIDGET_MACRO_ROW_HEIGHT) * WIDGET_MACRO_ROW_HEIGHT, WIDGET_CONSTRAINTS.minH), WIDGET_CONSTRAINTS.maxH);
    const rawX = Number.isFinite(currentPos.x) ? Math.round(currentPos.x) : 0;
    const rawY = Number.isFinite(currentPos.y) ? Math.round(currentPos.y) : 0;
    const clampedX = snapToAllowedColumn(Math.min(Math.max(rawX, 0), WIDGET_GRID_COLUMNS - w), w);
    const { gridVersion, ...rest } = currentPos;
    return {
        ...rest,
        x: clampedX,
        y: Math.floor(Math.max(rawY, 0) / WIDGET_MACRO_ROW_HEIGHT) * WIDGET_MACRO_ROW_HEIGHT,
        w,
        h,
        minW,
        maxW,
        minH,
        maxH,
    };
};
export const hasWidgetLayoutOverlap = (first: WidgetGridPosition, second: WidgetGridPosition) => first.x < second.x + second.w &&
    first.x + first.w > second.x &&
    first.y < second.y + second.h &&
    first.y + first.h > second.y;
export type EmptyWidgetSlot = Pick<WidgetGridPosition, 'x' | 'y' | 'w' | 'h'>;
/** A read-only projection of the 12-column layout into one, two, or three visible tiles. */
export const projectWidgetLayout = (layout: readonly WidgetGridPosition[], visibleColumns: 4 | 8 | 12): WidgetGridPosition[] => {
    if (visibleColumns === 12)
        return normalizeWidgetLayout(layout);
    const placed: WidgetGridPosition[] = [];
    const ordered = [...layout].sort((a, b) => a.y - b.y || a.x - b.x || a.i.localeCompare(b.i));
    for (const source of ordered) {
        const width = Math.min(source.w, visibleColumns);
        const xOptions = Array.from({ length: visibleColumns / 4 - width / 4 + 1 }, (_, index) => index * 4);
        const preferredX = Math.min(source.x, visibleColumns - width);
        xOptions.sort((a, b) => Math.abs(a - preferredX) - Math.abs(b - preferredX) || a - b);
        let placedItem: WidgetGridPosition | undefined;
        for (let y = 0; !placedItem; y += WIDGET_MACRO_ROW_HEIGHT) {
            for (const x of xOptions) {
                const candidate = { ...source, x, y, w: width };
                if (!placed.some(other => hasWidgetLayoutOverlap(candidate, other))) {
                    placedItem = candidate;
                    break;
                }
            }
        }
        placed.push(placedItem);
    }
    return placed;
};
/** Show every free small-widget cell in occupied rows and one new-row entry. */
export const getIncompleteWidgetRowSlots = (layout: readonly WidgetGridPosition[], visibleColumns: 4 | 8 | 12 = 12): EmptyWidgetSlot[] => {
    const smallSize = WIDGET_SIZE_PRESETS.small;
    const slotColumns = getAllowedWidgetColumns(smallSize.w).filter(x => x + smallSize.w <= visibleColumns);
    if (layout.length === 0) {
        return [{
                x: 0,
                y: 0,
                ...smallSize,
            }];
    }
    const lastOccupiedRow = Math.max(0, ...layout.map(position => Math.ceil((position.y + position.h) / WIDGET_MACRO_ROW_HEIGHT) - 1));
    const availableSlots: EmptyWidgetSlot[] = [];
    for (let row = 0; row <= lastOccupiedRow; row += 1) {
        const y = row * WIDGET_MACRO_ROW_HEIGHT;
        if (!layout.some(position => position.y < y + smallSize.h && position.y + position.h > y))
            continue;
        for (const x of slotColumns) {
            const candidate = { x, y, ...smallSize };
            if (!layout.some(position => hasWidgetLayoutOverlap({ ...candidate, i: '__empty-slot__', viewId: position.viewId }, position))) {
                availableSlots.push(candidate);
            }
        }
    }
    return [
        ...availableSlots,
        { x: slotColumns[0] || 0, y: (lastOccupiedRow + 1) * WIDGET_MACRO_ROW_HEIGHT, ...smallSize }
    ];
};
/** Revalidates a requested position against the latest persisted dashboard layout. */
export const findNextAvailableWidgetPosition = (requested: WidgetGridPosition, occupied: readonly WidgetGridPosition[], preferRequestedPosition = false): WidgetGridPosition => {
    const candidate = clampWidgetPosition(requested);
    const lowestOccupiedRow = Math.max(0, ...occupied.map(position => position.y + position.h));
    const finalSearchRow = Math.ceil(Math.max(lowestOccupiedRow, preferRequestedPosition ? candidate.y : 0) / WIDGET_MACRO_ROW_HEIGHT) * WIDGET_MACRO_ROW_HEIGHT;
    const allowedColumns = getAllowedWidgetColumns(candidate.w);
    const preferredX = snapToAllowedColumn(candidate.x, candidate.w);
    const columns = [preferredX, ...allowedColumns.filter(column => column !== preferredX)];
    for (let y = preferRequestedPosition ? candidate.y : 0; y <= finalSearchRow; y += WIDGET_MACRO_ROW_HEIGHT) {
        for (const x of columns) {
            const nextCandidate = clampWidgetPosition({ ...candidate, x, y });
            if (!occupied.some(position => hasWidgetLayoutOverlap(nextCandidate, position))) {
                return nextCandidate;
            }
        }
    }
    return clampWidgetPosition({ ...candidate, x: columns[0] || 0, y: finalSearchRow });
};
const getColumnOrder = (preferredColumn: number, widgetWidth: number) => {
    const maxAllowedX = Math.max(0, WIDGET_GRID_COLUMNS - widgetWidth);
    const safePreferredColumn = Math.min(Math.max(preferredColumn, 0), maxAllowedX);
    const allColumns = Array.from({ length: maxAllowedX + 1 }, (_, i) => i);
    return [
        safePreferredColumn,
        ...allColumns.filter(column => column !== safePreferredColumn)
    ];
};
const findFirstAvailablePosition = (item: WidgetGridPosition, occupied: WidgetGridPosition[]): WidgetGridPosition => {
    const clampedItem = clampWidgetPosition(item);
    const lowestOccupiedRow = Math.max(0, ...occupied.map(position => position.y + position.h));
    const columns = getColumnOrder(clampedItem.x, clampedItem.w);
    for (let y = 0; y <= lowestOccupiedRow; y += WIDGET_MACRO_ROW_HEIGHT) {
        for (const x of columns) {
            const candidate = clampWidgetPosition({ ...clampedItem, x, y });
            if (!occupied.some(position => hasWidgetLayoutOverlap(candidate, position)))
                return candidate;
        }
    }
    return clampWidgetPosition({ ...clampedItem, x: columns[0], y: lowestOccupiedRow });
};
export const normalizeWidgetLayout = (layout: readonly WidgetGridPosition[], priorityWidgetId?: string): WidgetGridPosition[] => {
    const viewIds = Array.from(new Set(layout.map(position => position.viewId)));
    if (viewIds.length > 1) {
        return viewIds.flatMap(viewId => normalizeWidgetLayout(layout.filter(position => position.viewId === viewId), priorityWidgetId));
    }
    const seenIds = new Set<string>();
    const clampedLayout = layout
        .filter(position => {
        if (!position.i || seenIds.has(position.i))
            return false;
        seenIds.add(position.i);
        return true;
    })
        .map(clampWidgetPosition);
    const orderedPositions = clampedLayout.sort((first, second) => first.y - second.y || first.x - second.x || (first.i === priorityWidgetId ? -1 : second.i === priorityWidgetId ? 1 : first.i.localeCompare(second.i)));
    const resolvedPositions: WidgetGridPosition[] = [];
    orderedPositions.forEach(position => {
        resolvedPositions.push(resolvedPositions.some(other => hasWidgetLayoutOverlap(position, other))
            ? findFirstAvailablePosition(position, resolvedPositions)
            : position);
    });
    const occupiedRows = new Set<number>();
    for (const position of resolvedPositions) {
        for (let row = position.y; row < position.y + position.h; row += WIDGET_MACRO_ROW_HEIGHT) {
            occupiedRows.add(row);
        }
    }
    const compactRowIndex = new Map([...occupiedRows].sort((first, second) => first - second).map((row, index) => [row, index]));
    return resolvedPositions
        .map(position => ({
        ...position,
        y: (compactRowIndex.get(position.y) || 0) * WIDGET_MACRO_ROW_HEIGHT,
    }))
        .sort((first, second) => first.y - second.y || first.x - second.x || first.i.localeCompare(second.i));
};
export const resolveWidgetLayout = (candidateLayout: readonly WidgetGridPosition[], priorityWidgetId: string): WidgetGridPosition[] => normalizeWidgetLayout(candidateLayout, priorityWidgetId);
export const resolveDropCollision = (previousLayout: readonly WidgetGridPosition[], nextLayout: readonly WidgetGridPosition[], draggedWidgetId: string | undefined): WidgetGridPosition[] => {
    if (!draggedWidgetId)
        return normalizeWidgetLayout(nextLayout);
    const previousPositions = previousLayout.map(clampWidgetPosition);
    const nextPositions = nextLayout.map(clampWidgetPosition);
    const draggedPrevious = previousPositions.find(position => position.i === draggedWidgetId);
    const draggedNext = nextPositions.find(position => position.i === draggedWidgetId);
    if (!draggedPrevious || !draggedNext) {
        return normalizeWidgetLayout(nextPositions, draggedWidgetId);
    }
    const wasMoved = draggedPrevious.x !== draggedNext.x || draggedPrevious.y !== draggedNext.y;
    if (!wasMoved)
        return normalizeWidgetLayout(previousPositions);
    const displaced = previousPositions
        .filter(position => position.i !== draggedWidgetId && hasWidgetLayoutOverlap(draggedNext, position))
        .sort((first, second) => first.y - second.y || first.x - second.x);
    if (displaced.length > 0) {
        const displacedIds = new Set(displaced.map(position => position.i));
        const settled = [
            ...previousPositions.filter(position => position.i !== draggedWidgetId && !displacedIds.has(position.i)),
            draggedNext
        ];
        const lowestRow = Math.max(draggedPrevious.y + draggedPrevious.h, draggedNext.y + draggedNext.h, ...previousPositions.map(position => position.y + position.h));
        for (const position of displaced) {
            const columns = getAllowedWidgetColumns(position.w);
            const vacatedCells: Array<{
                x: number;
                y: number;
            }> = [];
            for (let y = draggedPrevious.y; y + position.h <= draggedPrevious.y + draggedPrevious.h; y += WIDGET_MACRO_ROW_HEIGHT) {
                for (const x of columns) {
                    if (x >= draggedPrevious.x && x + position.w <= draggedPrevious.x + draggedPrevious.w) {
                        vacatedCells.push({ x, y });
                    }
                }
            }
            const nearbyCells: Array<{
                x: number;
                y: number;
            }> = [];
            for (let y = 0; y <= lowestRow; y += WIDGET_MACRO_ROW_HEIGHT) {
                for (const x of columns)
                    nearbyCells.push({ x, y });
            }
            nearbyCells.sort((first, second) => (Math.abs(first.y - draggedPrevious.y) + Math.abs(first.x - draggedPrevious.x)) -
                (Math.abs(second.y - draggedPrevious.y) + Math.abs(second.x - draggedPrevious.x)) ||
                first.y - second.y || first.x - second.x);
            const nextPosition = [...vacatedCells, ...nearbyCells]
                .map(({ x, y }) => clampWidgetPosition({ ...position, x, y }))
                .find(candidate => !settled.some(other => hasWidgetLayoutOverlap(candidate, other)));
            if (nextPosition)
                settled.push(nextPosition);
            else
                settled.push(findFirstAvailablePosition(position, settled));
        }
        return normalizeWidgetLayout(settled, draggedWidgetId);
    }
    // Vacated cells in the same lane move upward, while a deliberate drop into
    // a later occupied row keeps that row instead of being packed back to row 0.
    const otherPositions = previousPositions
        .filter(position => position.i !== draggedWidgetId)
        .sort((first, second) => first.y - second.y || first.x - second.x || first.i.localeCompare(second.i));
    const settled: WidgetGridPosition[] = [];
    for (const position of otherPositions) {
        let nextY = position.y;
        if (position.x === draggedPrevious.x && position.y > draggedPrevious.y) {
            for (let candidateY = 0; candidateY <= position.y; candidateY += WIDGET_MACRO_ROW_HEIGHT) {
                if (!settled.some(other => hasWidgetLayoutOverlap({ ...position, y: candidateY }, other))) {
                    nextY = candidateY;
                    break;
                }
            }
        }
        settled.push({ ...position, y: nextY });
    }
    const bottomOfOtherWidgets = Math.max(0, ...settled.map(position => position.y + position.h));
    const requestedY = Math.min(draggedNext.y, bottomOfOtherWidgets);
    let settledDragged = { ...draggedNext, y: requestedY };
    while (settled.some(position => hasWidgetLayoutOverlap(settledDragged, position))) {
        settledDragged = { ...settledDragged, y: settledDragged.y + WIDGET_MACRO_ROW_HEIGHT };
    }
    return normalizeWidgetLayout([...settled, settledDragged], draggedWidgetId);
};
export const compactLayoutVertically = (layout: readonly WidgetGridPosition[]): WidgetGridPosition[] => {
    const views = Array.from(new Set(layout.map(p => p.viewId).filter(Boolean)));
    if (views.length === 0)
        return [...layout];
    return views.flatMap(viewId => {
        const viewLayout = layout.filter(p => p.viewId === viewId);
        const sorted = [...viewLayout].sort((first, second) => first.y - second.y || first.x - second.x);
        const compacted: WidgetGridPosition[] = [];
        sorted.forEach(item => {
            let targetY = 0;
            while (compacted.some(other => hasWidgetLayoutOverlap({ ...item, y: targetY }, other))) {
                targetY += 1;
            }
            compacted.push({ ...item, y: targetY });
        });
        return compacted;
    });
};
