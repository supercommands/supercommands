import {
  convertFineGridToLegacyPosition,
  getAllowedWidgetColumns,
  snapToAllowedColumn,
  snapToAllowedWidth,
  WIDGET_MACRO_ROW_HEIGHT,
  WIDGET_SIZE_PRESETS,
  WIDGET_CONSTRAINTS,
  WIDGET_GRID_COLUMNS,
} from './widgetDashboardData';
import type { WidgetGridPosition } from '../widgetDashboard.types';

export const clampWidgetPosition = (position: WidgetGridPosition): WidgetGridPosition => {
  const currentPos = position.gridVersion === 2 ? convertFineGridToLegacyPosition(position) : position;

  const rawWidth = Number.isFinite(currentPos.w) ? Math.round(currentPos.w) : WIDGET_CONSTRAINTS.minW;
  const rawHeight = Number.isFinite(currentPos.h) ? Math.round(currentPos.h) : WIDGET_CONSTRAINTS.minH;

  const minW = currentPos.minW ? Math.max(WIDGET_CONSTRAINTS.minW, Math.round(currentPos.minW)) : WIDGET_CONSTRAINTS.minW;
  const maxW = currentPos.maxW ? Math.round(currentPos.maxW) : WIDGET_CONSTRAINTS.maxW;
  const minH = currentPos.minH ? Math.max(WIDGET_CONSTRAINTS.minH, Math.round(currentPos.minH)) : WIDGET_CONSTRAINTS.minH;
  const maxH = currentPos.maxH ? Math.round(currentPos.maxH) : WIDGET_CONSTRAINTS.maxH;

  const w = Math.min(Math.max(rawWidth, minW), maxW, WIDGET_GRID_COLUMNS);
  const h = Math.min(Math.max(rawHeight, minH), maxH);

  const rawX = Number.isFinite(currentPos.x) ? Math.round(currentPos.x) : 0;
  const rawY = Number.isFinite(currentPos.y) ? Math.round(currentPos.y) : 0;
  const clampedX = Math.min(Math.max(rawX, 0), WIDGET_GRID_COLUMNS - w);

  const { gridVersion, ...rest } = currentPos;

  return {
    ...rest,
    x: clampedX,
    y: Math.max(rawY, 0),
    w,
    h,
    minW,
    maxW,
    minH,
    maxH,
  };
};

export const hasWidgetLayoutOverlap = (first: WidgetGridPosition, second: WidgetGridPosition) =>
  first.x < second.x + second.w &&
  first.x + first.w > second.x &&
  first.y < second.y + second.h &&
  first.y + first.h > second.y;

export type EmptyWidgetSlot = Pick<WidgetGridPosition, 'x' | 'y' | 'w' | 'h'>;

/** Returns first-row slots for an empty layout, gaps in incomplete rows, or a fresh row when every existing row is full. */
export const getIncompleteWidgetRowSlots = (
  layout: readonly WidgetGridPosition[],
): EmptyWidgetSlot[] => {
  const smallSize = WIDGET_SIZE_PRESETS.small;
  if (layout.length === 0) {
    return getAllowedWidgetColumns(smallSize.w).map(x => ({
      x,
      y: 0,
      ...smallSize,
    }));
  }

  const occupiedRows = new Set<number>();

  layout.forEach(position => {
    const startRow = Math.max(0, Math.floor(position.y / WIDGET_MACRO_ROW_HEIGHT));
    const endRow = Math.max(
      startRow,
      Math.ceil((position.y + position.h) / WIDGET_MACRO_ROW_HEIGHT) - 1,
    );
    for (let row = startRow; row <= endRow; row += 1) occupiedRows.add(row);
  });

  const emptySlots = Array.from(occupiedRows)
    .sort((first, second) => first - second)
    .flatMap(row => {
      const y = row * WIDGET_MACRO_ROW_HEIGHT;
      return getAllowedWidgetColumns(smallSize.w)
        .map(x => ({ x, y, ...smallSize }))
        .filter(candidate =>
          !layout.some(position =>
            hasWidgetLayoutOverlap(
              { ...candidate, i: '__empty-slot__', viewId: position.viewId },
              position,
            ),
          ),
        );
    });

  if (emptySlots.length > 0) return emptySlots;

  const nextRowY = Math.ceil(
    Math.max(0, ...layout.map(position => position.y + position.h)) / WIDGET_MACRO_ROW_HEIGHT,
  ) * WIDGET_MACRO_ROW_HEIGHT;

  return getAllowedWidgetColumns(smallSize.w).map(x => ({
    x,
    y: nextRowY,
    ...smallSize,
  }));
};

/** Revalidates a requested position against the latest persisted dashboard layout. */
export const findNextAvailableWidgetPosition = (
  requested: WidgetGridPosition,
  occupied: readonly WidgetGridPosition[],
): WidgetGridPosition => {
  const candidate = clampWidgetPosition(requested);
  const requestedY = Number.isFinite(candidate.y) && candidate.y < 100000
    ? Math.max(0, Math.floor(candidate.y / WIDGET_MACRO_ROW_HEIGHT) * WIDGET_MACRO_ROW_HEIGHT)
    : 0;
  const lowestOccupiedRow = Math.max(0, ...occupied.map(position => position.y + position.h));
  const finalSearchRow = Math.ceil(lowestOccupiedRow / WIDGET_MACRO_ROW_HEIGHT) * WIDGET_MACRO_ROW_HEIGHT;
  const allowedColumns = getAllowedWidgetColumns(candidate.w);
  const preferredX = snapToAllowedColumn(candidate.x, candidate.w);
  const columns = [preferredX, ...allowedColumns.filter(column => column !== preferredX)];

  for (let y = requestedY; y <= finalSearchRow; y += WIDGET_MACRO_ROW_HEIGHT) {
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
    ...allColumns.filter(column => column !== safePreferredColumn),
  ];
};

const findFirstAvailablePosition = (
  item: WidgetGridPosition,
  occupied: WidgetGridPosition[],
): WidgetGridPosition => {
  const clampedItem = clampWidgetPosition(item);
  const lowestOccupiedRow = Math.max(0, ...occupied.map(position => position.y + position.h));
  const columns = getColumnOrder(clampedItem.x, clampedItem.w);

  for (let y = 0; y <= lowestOccupiedRow; y += 1) {
    for (const x of columns) {
      const candidate = clampWidgetPosition({ ...clampedItem, x, y });
      if (!occupied.some(position => hasWidgetLayoutOverlap(candidate, position))) return candidate;
    }
  }

  return clampWidgetPosition({ ...clampedItem, x: columns[0], y: lowestOccupiedRow });
};

export const normalizeWidgetLayout = (
  layout: readonly WidgetGridPosition[],
  priorityWidgetId?: string,
): WidgetGridPosition[] => {
  const seenIds = new Set<string>();
  const clampedLayout = layout
    .filter(position => {
      if (!position.i || seenIds.has(position.i)) return false;
      seenIds.add(position.i);
      return true;
    })
    .map(clampWidgetPosition);

  const priorityPosition = priorityWidgetId
    ? clampedLayout.find(position => position.i === priorityWidgetId)
    : undefined;
  const remainingPositions = clampedLayout
    .filter(position => position.i !== priorityWidgetId)
    .sort((first, second) => first.y - second.y || first.x - second.x);
  const orderedPositions = priorityPosition
    ? [priorityPosition, ...remainingPositions]
    : remainingPositions;
  const resolvedPositions: WidgetGridPosition[] = [];
  orderedPositions.forEach(position => {
    const isUnplaced = position.y > 100000;
    if (!isUnplaced && !resolvedPositions.some(current => hasWidgetLayoutOverlap(position, current))) {
      resolvedPositions.push(position);
      return;
    }
    resolvedPositions.push(findFirstAvailablePosition(position, resolvedPositions));
  });

  return resolvedPositions;
};

export const resolveWidgetLayout = (
  candidateLayout: readonly WidgetGridPosition[],
  priorityWidgetId: string,
): WidgetGridPosition[] => normalizeWidgetLayout(candidateLayout, priorityWidgetId);

export const resolveDropCollision = (
  _previousLayout: readonly WidgetGridPosition[],
  nextLayout: readonly WidgetGridPosition[],
  draggedWidgetId: string | undefined,
): WidgetGridPosition[] => {
  return normalizeWidgetLayout(nextLayout, draggedWidgetId);
};

export const compactLayoutVertically = (layout: readonly WidgetGridPosition[]): WidgetGridPosition[] => {
  const views = Array.from(new Set(layout.map(p => p.viewId).filter(Boolean)));
  if (views.length === 0) return [...layout];

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
