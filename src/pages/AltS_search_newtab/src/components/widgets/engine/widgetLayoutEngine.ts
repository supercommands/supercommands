import { WIDGET_CONSTRAINTS, WIDGET_GRID_COLUMNS } from './widgetDashboardData';
import type { WidgetGridPosition } from '../widgetDashboard.types';

export const clampWidgetPosition = (position: WidgetGridPosition): WidgetGridPosition => {
  const rawWidth = Number.isFinite(position.w) ? Math.round(position.w) : WIDGET_CONSTRAINTS.minW;
  const rawHeight = Number.isFinite(position.h) ? Math.round(position.h) : WIDGET_CONSTRAINTS.minH;
  const w = Math.min(Math.max(rawWidth, WIDGET_CONSTRAINTS.minW), WIDGET_CONSTRAINTS.maxW, WIDGET_GRID_COLUMNS);
  const h = Math.min(Math.max(rawHeight, WIDGET_CONSTRAINTS.minH), WIDGET_CONSTRAINTS.maxH);
  const maxX = Math.max(WIDGET_GRID_COLUMNS - w, 0);
  const rawX = Number.isFinite(position.x) ? Math.round(position.x) : 0;
  const rawY = Number.isFinite(position.y) ? Math.round(position.y) : 0;

  return {
    ...position,
    x: Math.min(Math.max(rawX, 0), maxX),
    y: Math.max(rawY, 0),
    w,
    h,
    ...WIDGET_CONSTRAINTS,
  };
};

export const hasWidgetLayoutOverlap = (first: WidgetGridPosition, second: WidgetGridPosition) =>
  first.x < second.x + second.w &&
  first.x + first.w > second.x &&
  first.y < second.y + second.h &&
  first.y + first.h > second.y;

const getColumnOrder = (preferredColumn: number, widgetWidth: number) => {
  const lastColumn = Math.max(WIDGET_GRID_COLUMNS - widgetWidth, 0);
  const safePreferredColumn = Math.max(0, Math.min(preferredColumn, lastColumn));

  return [
    safePreferredColumn,
    ...Array.from({ length: lastColumn + 1 }, (_, column) => column).filter(column => column !== safePreferredColumn),
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
    if (!resolvedPositions.some(current => hasWidgetLayoutOverlap(position, current))) {
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
  previousLayout: readonly WidgetGridPosition[],
  nextLayout: readonly WidgetGridPosition[],
  draggedWidgetId: string | undefined,
): WidgetGridPosition[] => {
  if (!draggedWidgetId) return normalizeWidgetLayout(nextLayout);

  const previousDraggedPosition = previousLayout.find(position => position.i === draggedWidgetId);
  const droppedPosition = nextLayout.find(position => position.i === draggedWidgetId);

  if (!previousDraggedPosition || !droppedPosition) return normalizeWidgetLayout(nextLayout, draggedWidgetId);

  const candidateLayout = previousLayout.map(position =>
    position.i === draggedWidgetId
      ? clampWidgetPosition({ ...position, ...droppedPosition })
      : { ...position },
  );

  return resolveWidgetLayout(candidateLayout, draggedWidgetId);
};
