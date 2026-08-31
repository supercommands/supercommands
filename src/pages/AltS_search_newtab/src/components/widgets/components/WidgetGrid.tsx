import type * as React from 'react';
import type { RefObject } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactGridLayout, { noCompactor, useContainerWidth } from 'react-grid-layout';
import WidgetCard from './WidgetCard';
import AddWidgetSlot from './AddWidgetSlot';
import {
  inferPresetFromWidth,
  isWidgetSizePresetAllowed,
  snapManualWidgetSize,
  snapToAllowedColumn,
  snapToAllowedWidth,
  WIDGET_CONSTRAINTS,
  WIDGET_GRID_COLUMNS,
} from '../engine/widgetDashboardData';
import {
  getIncompleteWidgetRowSlots,
  normalizeWidgetLayout,
  resolveDropCollision,
  type EmptyWidgetSlot,
} from '../engine/widgetLayoutEngine';
import type { WidgetGridPosition, WidgetInstance, WidgetSizePreset } from '../widgetDashboard.types';
import type { WidgetCatalogItem } from '../widgetCatalog';

import type { CommandId } from '../../../../../../shared-components/searchBarMain/commandConfigurations/commands';
import type { LocalCommandId } from '../../../../../../shared-components/searchBarMain/commandConfigurations/localCommands';

interface WidgetGridProps {
  widgets: WidgetInstance[];
  layout: WidgetGridPosition[];
  scrollContainerRef: RefObject<HTMLElement | null>;
  isEditMode?: boolean;
  onEnterWidgetEditMode?: (widgetId?: string) => void;
  onExitWidgetEditMode?: () => void;
  selectedWidgetId: string | null;
  onSelectWidget: (widgetId: string | null) => void;
  onCommitLayout: (layout: WidgetGridPosition[]) => void;
  onCommitResize: (layout: WidgetGridPosition[], widgetId: string | undefined) => void;
  onDeleteWidget: (widgetId: string) => void;
  onApplyPreset: (widgetId: string, preset: WidgetSizePreset) => void;
  onApplyCustom: (widgetId: string) => void;
  pendingCatalogWidgetIds: ReadonlySet<string>;
  getCatalogWidgetCount: (widget: WidgetCatalogItem) => number;
  isCatalogWidgetDisabled: (widget: WidgetCatalogItem, count: number) => boolean;
  onAddWidgetFromSlot: (widget: WidgetCatalogItem, slot: EmptyWidgetSlot) => void;
  onQuickCommandSelect?: (commandId: CommandId | LocalCommandId | 'ai' | 'collections') => void;
}

const GRID_ROW_HEIGHT = 34;
const GRID_MARGIN: [number, number] = [24, 24];
const GRID_PADDING: [number, number] = [24, 24];
const RESTING_CANVAS_PADDING_ROWS = 1;
const DRAG_CANVAS_PADDING_ROWS = 8;
const AUTO_SCROLL_EDGE = 96;
const AUTO_SCROLL_MAX_SPEED = 22;

type AutoScrollBounds = {
  top: number;
  bottom: number;
};

const getDisplaySizePreset = (
  position: WidgetGridPosition | undefined,
  fallback: WidgetSizePreset,
  widgetType?: string,
): WidgetSizePreset => {
  const rawPreset = position ? inferPresetFromWidth(position.w) : fallback;
  if (!isWidgetSizePresetAllowed(widgetType, rawPreset)) {
    return 'medium';
  }
  return rawPreset;
};

const toWidgetGridPositions = (
  layoutList: readonly WidgetGridPosition[],
  sourceLayout: readonly WidgetGridPosition[],
): WidgetGridPosition[] =>
  layoutList.map(position => {
    const sourcePosition = sourceLayout.find(item => item.i === position.i);
    const { gridVersion, ...rest } = position;
    return {
      ...rest,
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
  onEnterWidgetEditMode,
  onExitWidgetEditMode,
  selectedWidgetId,
  onSelectWidget,
  onCommitLayout,
  onCommitResize,
  onDeleteWidget,
  onApplyPreset,
  onApplyCustom,
  pendingCatalogWidgetIds,
  getCatalogWidgetCount,
  isCatalogWidgetDisabled,
  onAddWidgetFromSlot,
  onQuickCommandSelect,
}) => {
  const { width, containerRef, mounted } = useContainerWidth();
  const [viewportHeight, setViewportHeight] = useState(0);
  const dragStartLayoutRef = useRef<WidgetGridPosition[] | null>(null);
  const pointerYRef = useRef<number | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const autoScrollBoundsRef = useRef<AutoScrollBounds | null>(null);
  const viewportMeasureFrameRef = useRef<number | null>(null);
  const hydrationTransitionFrameRef = useRef<number | null>(null);
  const hydrationTransitionSecondFrameRef = useRef<number | null>(null);
  const [activeDragBottomRow, setActiveDragBottomRow] = useState(0);
  const [isHydratingLayout, setIsHydratingLayout] = useState(true);

  const setDragBottomRow = (nextBottomRow: number) => {
    setActiveDragBottomRow(currentBottomRow => (currentBottomRow === nextBottomRow ? currentBottomRow : nextBottomRow));
  };

  const cacheAutoScrollBounds = () => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) {
      autoScrollBoundsRef.current = null;
      return;
    }

    const bounds = scrollContainer.getBoundingClientRect();
    autoScrollBoundsRef.current = {
      top: bounds.top,
      bottom: bounds.bottom,
    };
  };

  const stopAutoScroll = () => {
    pointerYRef.current = null;
    autoScrollBoundsRef.current = null;
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

    const bounds = autoScrollBoundsRef.current;
    if (!bounds) {
      autoScrollFrameRef.current = requestAnimationFrame(runAutoScroll);
      return;
    }

    let scrollDelta = 0;

    if (pointerY > bounds.bottom - AUTO_SCROLL_EDGE) {
      const strength = Math.min(1, (pointerY - (bounds.bottom - AUTO_SCROLL_EDGE)) / AUTO_SCROLL_EDGE);
      scrollDelta = Math.max(4, Math.round(AUTO_SCROLL_MAX_SPEED * strength));
    } else if (pointerY < bounds.top + AUTO_SCROLL_EDGE) {
      const strength = Math.min(1, (bounds.top + AUTO_SCROLL_EDGE - pointerY) / AUTO_SCROLL_EDGE);
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

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;

      const nextViewportHeight = Math.round(entry.contentRect.height);
      setViewportHeight(currentHeight => (currentHeight === nextViewportHeight ? currentHeight : nextViewportHeight));

      if (viewportMeasureFrameRef.current !== null) {
        cancelAnimationFrame(viewportMeasureFrameRef.current);
      }
      viewportMeasureFrameRef.current = requestAnimationFrame(() => {
        viewportMeasureFrameRef.current = null;
        cacheAutoScrollBounds();
      });
    });

    observer.observe(scrollContainer);

    return () => {
      observer.disconnect();
      if (viewportMeasureFrameRef.current !== null) {
        cancelAnimationFrame(viewportMeasureFrameRef.current);
        viewportMeasureFrameRef.current = null;
      }
    };
  }, [scrollContainerRef]);

  useEffect(() => stopAutoScroll, []);

  useEffect(() => {
    if (isEditMode) return;
    stopAutoScroll();
    dragStartLayoutRef.current = null;
    setDragBottomRow(0);
  }, [isEditMode]);

  const canvasMinHeight = useMemo(() => {
    const rowUnit = GRID_ROW_HEIGHT + GRID_MARGIN[1];
    const minRows = Math.max(1, Math.ceil(Math.max(viewportHeight - GRID_PADDING[1] * 2, 0) / rowUnit));
    const visibleAddSlots = isEditMode ? getIncompleteWidgetRowSlots(layout) : [];
    const lowestWidgetRow = Math.max(
      0,
      ...layout.map(item => item.y + item.h),
      ...visibleAddSlots.map(item => item.y + item.h),
    );
    const restingRows = Math.max(minRows, lowestWidgetRow + RESTING_CANVAS_PADDING_ROWS);
    const draggingRows = activeDragBottomRow > 0 ? activeDragBottomRow + DRAG_CANVAS_PADDING_ROWS : 0;
    const canvasRows = Math.max(restingRows, draggingRows);

    return canvasRows * GRID_ROW_HEIGHT + Math.max(0, canvasRows - 1) * GRID_MARGIN[1];
  }, [activeDragBottomRow, isEditMode, layout, viewportHeight]);

  const gridLayout = useMemo(
    () =>
      layout.map(position => ({
        ...position,
        minW: WIDGET_CONSTRAINTS.minW,
        maxW: WIDGET_CONSTRAINTS.maxW,
        minH: WIDGET_CONSTRAINTS.minH,
        maxH: WIDGET_CONSTRAINTS.maxH,
        isDraggable: position.isDraggable !== false && isEditMode,
        isResizable: position.isResizable !== false && isEditMode,
      })),
    [isEditMode, layout],
  );

  const [windowWidth, setWindowWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1366);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const currentCols = WIDGET_GRID_COLUMNS;

  const emptySlots = useMemo(
    () => (isEditMode ? getIncompleteWidgetRowSlots(layout) : []),
    [isEditMode, layout],
  );

  const getEmptySlotStyle = (slot: EmptyWidgetSlot): React.CSSProperties => {
    const columnWidth = (
      width - GRID_PADDING[0] * 2 - GRID_MARGIN[0] * (currentCols - 1)
    ) / currentCols;
    return {
      position: 'absolute',
      zIndex: 20,
      left: GRID_PADDING[0] + slot.x * (columnWidth + GRID_MARGIN[0]),
      top: GRID_PADDING[1] + slot.y * (GRID_ROW_HEIGHT + GRID_MARGIN[1]),
      width: slot.w * columnWidth + (slot.w - 1) * GRID_MARGIN[0],
      height: slot.h * GRID_ROW_HEIGHT + (slot.h - 1) * GRID_MARGIN[1],
    };
  };

  useEffect(() => {
    if (!mounted || isEditMode) {
      setIsHydratingLayout(false);
      return undefined;
    }

    setIsHydratingLayout(true);
    if (hydrationTransitionFrameRef.current !== null) {
      cancelAnimationFrame(hydrationTransitionFrameRef.current);
    }
    if (hydrationTransitionSecondFrameRef.current !== null) {
      cancelAnimationFrame(hydrationTransitionSecondFrameRef.current);
    }

    hydrationTransitionFrameRef.current = requestAnimationFrame(() => {
      hydrationTransitionSecondFrameRef.current = requestAnimationFrame(() => {
        hydrationTransitionFrameRef.current = null;
        hydrationTransitionSecondFrameRef.current = null;
        setIsHydratingLayout(false);
      });
    });

    return () => {
      if (hydrationTransitionFrameRef.current !== null) {
        cancelAnimationFrame(hydrationTransitionFrameRef.current);
        hydrationTransitionFrameRef.current = null;
      }
      if (hydrationTransitionSecondFrameRef.current !== null) {
        cancelAnimationFrame(hydrationTransitionSecondFrameRef.current);
        hydrationTransitionSecondFrameRef.current = null;
      }
    };
  }, [gridLayout, isEditMode, mounted]);

  return (
    <div
      ref={containerRef}
      className="relative min-h-full w-full max-w-[960px] mx-auto px-8 py-6"
      onMouseDown={() => {
        if (isEditMode) onSelectWidget(null);
      }}
      data-widget-grid-canvas="true"
      style={{
        zoom: windowWidth < 1200 ? 0.76 : windowWidth < 1366 ? 0.88 : windowWidth < 1500 ? 0.94 : 1,
      }}>
      {mounted && (
        <div
          className="relative"
          style={{ minHeight: canvasMinHeight }}
          data-widget-grid-static={!isEditMode ? 'true' : undefined}
          data-widget-grid-hydrating={isHydratingLayout ? 'true' : undefined}>
          {isEditMode && (
            <div
              className="widget-grid-edit-guide"
              style={{ left: GRID_PADDING[0], right: GRID_PADDING[0] }}
              aria-hidden="true"
            />
          )}
          {emptySlots.map((slot, index) => (
            <div key={`__add-widget-${slot.y}-${slot.x}`} style={getEmptySlotStyle(slot)}>
              <AddWidgetSlot
                pendingWidgetIds={pendingCatalogWidgetIds}
                getWidgetCount={getCatalogWidgetCount}
                isWidgetDisabled={isCatalogWidgetDisabled}
                onSelectWidget={widget => onAddWidgetFromSlot(widget, slot)}
                autoOpenCatalog={isEditMode && layout.length === 0 && index === 0}
              />
            </div>
          ))}
          <ReactGridLayout
            width={width}
            layout={gridLayout}
            compactor={noCompactor}
            className="relative z-10"
            style={{ minHeight: canvasMinHeight }}
             gridConfig={{
              cols: currentCols,
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
              cacheAutoScrollBounds();
              dragStartLayoutRef.current = toWidgetGridPositions(dragLayout as readonly WidgetGridPosition[], layout);
            }}
            onDrag={(_nextLayout, _oldItem, newItem, _placeholder, event) => {
              if (!isEditMode) return;
              setDragBottomRow(newItem ? newItem.y + newItem.h : 0);
              updateAutoScrollPointer(event);
            }}
            onDragStop={(nextLayout, _oldItem, newItem) => {
              stopAutoScroll();
              setDragBottomRow(0);
              dragStartLayoutRef.current = null;
              if (!isEditMode) return;

              const finalLayout = normalizeWidgetLayout(
                toWidgetGridPositions(nextLayout as readonly WidgetGridPosition[], layout),
                newItem?.i,
              );
              onCommitLayout(finalLayout);
            }}
            onResize={(_nextLayout, _oldItem, newItem) => {
              if (!isEditMode) return;
              setDragBottomRow(newItem ? newItem.y + newItem.h : 0);
            }}
            onResizeStop={nextLayout => {
              setDragBottomRow(0);
              if (!isEditMode) return;
              const rawResizedLayout = toWidgetGridPositions(nextLayout as readonly WidgetGridPosition[], layout);
              const resizedItem = rawResizedLayout.find(position => {
                const previousPosition = layout.find(item => item.i === position.i);
                return previousPosition && (previousPosition.w !== position.w || previousPosition.h !== position.h);
              });
              if (!resizedItem) return;

              const snapped = snapManualWidgetSize(resizedItem.w, resizedItem.h, resizedItem.x);
              const w = snapped.w;
              const h = snapped.h;
              const x = Math.min(Math.max(Math.round(resizedItem.x), 0), WIDGET_GRID_COLUMNS - w);
              const y = Math.max(Math.round(resizedItem.y), 0);

              const freeItem: WidgetGridPosition = {
                ...resizedItem,
                x,
                y,
                w,
                h,
                ...WIDGET_CONSTRAINTS,
              };

              const freeLayout = rawResizedLayout.map(pos =>
                pos.i === resizedItem.i ? freeItem : pos,
              );

              onCommitResize(
                normalizeWidgetLayout(freeLayout, resizedItem.i),
                resizedItem.i,
              );
            }}>
            {widgets.map((widget, index) => (
              <div key={widget.id}>
                <WidgetCard
                  widget={{
                    ...widget,
                    sizePreset: getDisplaySizePreset(layout.find(position => position.i === widget.id), widget.sizePreset, widget.type),
                  }}
                  gridPos={layout.find(position => position.i === widget.id)}
                  isEditMode={isEditMode}
                  onEnterWidgetEditMode={onEnterWidgetEditMode}
                  onExitWidgetEditMode={onExitWidgetEditMode}
                  selected={selectedWidgetId === widget.id}
                  onSelect={onSelectWidget}
                  onDelete={onDeleteWidget}
                  onApplyPreset={onApplyPreset}
                  onApplyCustom={onApplyCustom}
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
