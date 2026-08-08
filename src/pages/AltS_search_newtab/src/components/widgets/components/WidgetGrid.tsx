import type * as React from 'react';
import type { RefObject } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactGridLayout, { noCompactor, useContainerWidth } from 'react-grid-layout';
import WidgetCard from './WidgetCard';
import { WIDGET_GRID_COLUMNS } from '../engine/widgetDashboardData';
import { normalizeWidgetLayout, resolveDropCollision } from '../engine/widgetLayoutEngine';
import type { WidgetGridPosition, WidgetInstance, WidgetSizePreset } from '../widgetDashboard.types';

import type { CommandId } from '../../../../../../shared-components/searchBarMain/commandConfigurations/commands';
import type { LocalCommandId } from '../../../../../../shared-components/searchBarMain/commandConfigurations/localCommands';

interface WidgetGridProps {
  widgets: WidgetInstance[];
  layout: WidgetGridPosition[];
  scrollContainerRef: RefObject<HTMLElement | null>;
  isEditMode?: boolean;
  selectedWidgetId: string | null;
  onSelectWidget: (widgetId: string | null) => void;
  onCommitLayout: (layout: WidgetGridPosition[]) => void;
  onCommitResize: (layout: WidgetGridPosition[], widgetId: string | undefined) => void;
  onDeleteWidget: (widgetId: string) => void;
  onApplyPreset: (widgetId: string, preset: WidgetSizePreset) => void;
  onQuickCommandSelect?: (commandId: CommandId | LocalCommandId | 'ai' | 'collections') => void;
}

const GRID_ROW_HEIGHT = 42;
const GRID_MARGIN: [number, number] = [24, 24];
const GRID_PADDING: [number, number] = [0, 0];
const RESTING_CANVAS_PADDING_ROWS = 1;
const DRAG_CANVAS_PADDING_ROWS = 8;
const AUTO_SCROLL_EDGE = 96;
const AUTO_SCROLL_MAX_SPEED = 22;

const getDisplaySizePreset = (position: WidgetGridPosition | undefined, fallback: WidgetSizePreset): WidgetSizePreset => {
  if (!position) return fallback;
  if (position.w <= 3 && position.h <= 3) return 'small';
  if (position.w >= 6 || position.h >= 6) return 'large';
  return 'medium';
};

const toWidgetGridPositions = (
  layout: readonly WidgetGridPosition[],
  sourceLayout: readonly WidgetGridPosition[],
): WidgetGridPosition[] =>
  layout
    .map(position => {
      const sourcePosition = sourceLayout.find(item => item.i === position.i);
      return {
        i: position.i,
        viewId: sourcePosition?.viewId || position.viewId,
        categoryId: sourcePosition?.categoryId || position.categoryId,
        x: position.x,
        y: position.y,
        w: position.w,
      h: position.h,
      minW: position.minW,
      maxW: position.maxW,
      minH: position.minH,
      maxH: position.maxH,
      isDraggable: position.isDraggable,
      isResizable: position.isResizable,
      static: position.static,
    };
    });

const WidgetGrid: React.FC<WidgetGridProps> = ({
  widgets,
  layout,
  scrollContainerRef,
  isEditMode = false,
  selectedWidgetId,
  onSelectWidget,
  onCommitLayout,
  onCommitResize,
  onDeleteWidget,
  onApplyPreset,
  onQuickCommandSelect,
}) => {
  const { width, containerRef, mounted } = useContainerWidth();
  const [viewportHeight, setViewportHeight] = useState(0);
  const dragStartLayoutRef = useRef<WidgetGridPosition[] | null>(null);
  const pointerYRef = useRef<number | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const [activeDragBottomRow, setActiveDragBottomRow] = useState(0);

  const stopAutoScroll = () => {
    pointerYRef.current = null;
    if (autoScrollFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  };

  const runAutoScroll = () => {
    const scrollContainer = scrollContainerRef.current;
    const pointerY = pointerYRef.current;
    if (!scrollContainer || pointerY === null) {
      autoScrollFrameRef.current = null;
      return;
    }

    const bounds = scrollContainer.getBoundingClientRect();
    let scrollDelta = 0;

    if (pointerY > bounds.bottom - AUTO_SCROLL_EDGE) {
      const strength = Math.min(1, (pointerY - (bounds.bottom - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE);
      scrollDelta = Math.max(4, Math.round(AUTO_SCROLL_MAX_SPEED * strength));
    } else if (pointerY < bounds.top + AUTO_SCROLL_EDGE) {
      const strength = Math.min(1, ((bounds.top + AUTO_SCROLL_EDGE) - pointerY) / AUTO_SCROLL_EDGE);
      scrollDelta = -Math.max(4, Math.round(AUTO_SCROLL_MAX_SPEED * strength));
    }

    if (scrollDelta !== 0) scrollContainer.scrollTop += scrollDelta;
    autoScrollFrameRef.current = requestAnimationFrame(runAutoScroll);
  };

  const getDragEventClientY = (event: Event) => {
    if ('clientY' in event && typeof event.clientY === 'number') return event.clientY;
    const touchEvent = event as Event & {
      touches?: ArrayLike<{ clientY: number }>;
      changedTouches?: ArrayLike<{ clientY: number }>;
    };
    if (touchEvent.touches?.[0] && typeof touchEvent.touches[0].clientY === 'number') return touchEvent.touches[0].clientY;
    if (touchEvent.changedTouches?.[0] && typeof touchEvent.changedTouches[0].clientY === 'number') return touchEvent.changedTouches[0].clientY;
    return null;
  };

  const updateAutoScrollPointer = (event: Event) => {
    const clientY = getDragEventClientY(event);
    if (typeof clientY !== 'number') return;

    pointerYRef.current = clientY;
    if (autoScrollFrameRef.current === null) {
      autoScrollFrameRef.current = requestAnimationFrame(runAutoScroll);
    }
  };

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return undefined;

    const syncViewportHeight = () => setViewportHeight(scrollContainer.clientHeight);
    syncViewportHeight();

    const observer = new ResizeObserver(syncViewportHeight);
    observer.observe(scrollContainer);

    return () => observer.disconnect();
  }, [scrollContainerRef]);

  useEffect(() => stopAutoScroll, []);

  useEffect(() => {
    if (isEditMode) return;
    stopAutoScroll();
    dragStartLayoutRef.current = null;
    setActiveDragBottomRow(0);
  }, [isEditMode]);

  const canvasMinHeight = useMemo(() => {
    const rowUnit = GRID_ROW_HEIGHT + GRID_MARGIN[1];
    const minRows = Math.max(1, Math.ceil(Math.max(viewportHeight - GRID_PADDING[1] * 2, 0) / rowUnit));
    const lowestWidgetRow = Math.max(0, ...layout.map(item => item.y + item.h));
    const restingRows = Math.max(minRows, lowestWidgetRow + RESTING_CANVAS_PADDING_ROWS);
    const draggingRows = activeDragBottomRow > 0 ? activeDragBottomRow + DRAG_CANVAS_PADDING_ROWS : 0;
    const canvasRows = Math.max(restingRows, draggingRows);

    return canvasRows * GRID_ROW_HEIGHT + Math.max(0, canvasRows - 1) * GRID_MARGIN[1];
  }, [activeDragBottomRow, layout, viewportHeight]);

  const gridLayout = useMemo(
    () =>
      layout.map(position => ({
        ...position,
        isDraggable: position.isDraggable !== false && isEditMode,
        isResizable: position.isResizable !== false && isEditMode,
      })),
    [isEditMode, layout],
  );

  return (
    <div
      ref={containerRef}
      className="relative min-h-full w-full px-8 py-6"
      onMouseDown={() => {
        if (isEditMode) onSelectWidget(null);
      }}
      data-widget-grid-canvas="true">
      {mounted && (
        <div className="relative" style={{ minHeight: canvasMinHeight }}>
          {isEditMode && <div className="widget-grid-edit-guide" aria-hidden="true" />}
          <ReactGridLayout
            width={width}
            layout={gridLayout}
            className="relative z-10"
            style={{ minHeight: canvasMinHeight }}
            gridConfig={{
              cols: WIDGET_GRID_COLUMNS,
              rowHeight: GRID_ROW_HEIGHT,
              margin: GRID_MARGIN,
              containerPadding: GRID_PADDING,
            }}
            dragConfig={{
              enabled: isEditMode,
              cancel: '.widget-toolbar, button, input, textarea, select, a, [data-no-widget-drag]',
              bounded: true,
            }}
            resizeConfig={{
              enabled: isEditMode,
            }}
            onDragStart={dragLayout => {
              if (!isEditMode) return;
              dragStartLayoutRef.current = toWidgetGridPositions(dragLayout as readonly WidgetGridPosition[], layout);
            }}
            onDrag={(_nextLayout, _oldItem, newItem, _placeholder, event) => {
              if (!isEditMode) return;
              setActiveDragBottomRow(newItem ? newItem.y + newItem.h : 0);
              updateAutoScrollPointer(event);
            }}
            onDragStop={(nextLayout, _oldItem, newItem) => {
              stopAutoScroll();
              setActiveDragBottomRow(0);
              if (!isEditMode) {
                dragStartLayoutRef.current = null;
                return;
              }
              const startingLayout = dragStartLayoutRef.current ?? layout;
              dragStartLayoutRef.current = null;
              onCommitLayout(
                resolveDropCollision(
                  startingLayout,
                  toWidgetGridPositions(nextLayout as readonly WidgetGridPosition[], layout),
                  newItem?.i,
                ),
              );
            }}
            onResizeStop={nextLayout => {
              if (!isEditMode) return;
              const resizedLayout = toWidgetGridPositions(nextLayout as readonly WidgetGridPosition[], layout);
              const resizedItem = resizedLayout.find(position => {
                const previousPosition = layout.find(item => item.i === position.i);
                return previousPosition && (previousPosition.w !== position.w || previousPosition.h !== position.h);
              });
              onCommitResize(
                normalizeWidgetLayout(resizedLayout, resizedItem?.i),
                resizedItem?.i,
              );
            }}>
            {widgets.map((widget, index) => (
              <div key={widget.id}>
                <WidgetCard
                  widget={{
                    ...widget,
                    sizePreset: getDisplaySizePreset(layout.find(position => position.i === widget.id), widget.sizePreset),
                  }}
                  isEditMode={isEditMode}
                  selected={selectedWidgetId === widget.id}
                  onSelect={onSelectWidget}
                  onDelete={onDeleteWidget}
                  onApplyPreset={onApplyPreset}
                  animationIndex={index}
                  onQuickCommandSelect={onQuickCommandSelect}
                />
              </div>
            ))}
          </ReactGridLayout>
        </div>
      )}
    </div>
  );
};

export default WidgetGrid;
