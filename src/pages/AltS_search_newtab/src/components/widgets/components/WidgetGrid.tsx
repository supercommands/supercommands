import * as React from 'react';
import type { RefObject } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactGridLayout, { noCompactor } from 'react-grid-layout';
import WidgetCard from './WidgetCard';
import AddWidgetSlot from './AddWidgetSlot';
import { inferPresetFromWidth, getAllowedWidgetSizePresets, isWidgetSizePresetAllowed, snapManualWidgetSize, snapToAllowedColumn, snapToAllowedWidth, WIDGET_CONSTRAINTS, WIDGET_GRID_COLUMNS, WIDGET_SIZE_PRESETS, } from '../engine/widgetDashboardData';
import { getIncompleteWidgetRowSlots, normalizeWidgetLayout, projectWidgetLayout, resolveDropCollision, type EmptyWidgetSlot, } from '../engine/widgetLayoutEngine';
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
const GRID_ROW_HEIGHT = 48;
const GRID_MARGIN: [
    number,
    number
] = [16, 16];
const GRID_PADDING: [
    number,
    number
] = [16, 16];
const DRAG_CANVAS_PADDING_ROWS = 8;
const AUTO_SCROLL_EDGE = 96;
const AUTO_SCROLL_MAX_SPEED = 22;
type AutoScrollBounds = {
    top: number;
    bottom: number;
};
const getDisplaySizePreset = (position: WidgetGridPosition | undefined, fallback: WidgetSizePreset, widgetType?: string): WidgetSizePreset => {
    const rawPreset = position ? inferPresetFromWidth(position.w) : fallback;
    if (!isWidgetSizePresetAllowed(widgetType, rawPreset)) {
        return 'medium';
    }
    return rawPreset;
};
const toWidgetGridPositions = (layoutList: readonly WidgetGridPosition[], sourceLayout: readonly WidgetGridPosition[]): WidgetGridPosition[] => layoutList.map(position => {
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
const applyDragPreview = (gridLayout: WidgetGridPosition[], previousLayout: readonly WidgetGridPosition[], draggedWidgetId: string | undefined, sourceLayout: readonly WidgetGridPosition[]): WidgetGridPosition[] => {
    const resolved = resolveDropCollision(previousLayout, toWidgetGridPositions(gridLayout, sourceLayout), draggedWidgetId);
    const positionsById = new Map(resolved.map(position => [position.i, position]));
    gridLayout.forEach(position => {
        const next = positionsById.get(position.i);
        if (next)
            Object.assign(position, { x: next.x, y: next.y });
    });
    return resolved;
};
const WidgetGrid: React.FC<WidgetGridProps> = ({ widgets, layout, scrollContainerRef, isEditMode = false, onEnterWidgetEditMode, onExitWidgetEditMode, selectedWidgetId, onSelectWidget, onCommitLayout, onCommitResize, onDeleteWidget, onApplyPreset, onApplyCustom, pendingCatalogWidgetIds, getCatalogWidgetCount, isCatalogWidgetDisabled, onAddWidgetFromSlot, onQuickCommandSelect, }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);
    const mounted = width > 0;
    const [viewportHeight, setViewportHeight] = useState(0);
    const dragStartLayoutRef = useRef<WidgetGridPosition[] | null>(null);
    const pointerYRef = useRef<number | null>(null);
    const autoScrollFrameRef = useRef<number | null>(null);
    const autoScrollBoundsRef = useRef<AutoScrollBounds | null>(null);
    const viewportMeasureFrameRef = useRef<number | null>(null);
    const [activeDragBottomRow, setActiveDragBottomRow] = useState(0);
    const didResetInitialScrollRef = useRef(false);
    useLayoutEffect(() => {
        const node = containerRef.current;
        if (!node)
            return undefined;
        let frame: number | null = null;
        const measure = () => {
            const style = getComputedStyle(node);
            const contentWidth = node.getBoundingClientRect().width
                - Number.parseFloat(style.paddingLeft || '0')
                - Number.parseFloat(style.paddingRight || '0');
            const nextWidth = Math.max(0, Math.round(contentWidth));
            setWidth(previous => previous === nextWidth ? previous : nextWidth);
        };
        const scheduleMeasure = () => {
            if (frame !== null)
                cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                frame = null;
                measure();
            });
        };
        const observer = new ResizeObserver(scheduleMeasure);
        observer.observe(node);
        window.addEventListener('resize', scheduleMeasure);
        window.visualViewport?.addEventListener('resize', scheduleMeasure);
        measure();
        return () => {
            observer.disconnect();
            if (frame !== null)
                cancelAnimationFrame(frame);
            window.removeEventListener('resize', scheduleMeasure);
            window.visualViewport?.removeEventListener('resize', scheduleMeasure);
        };
    }, []);
    useLayoutEffect(() => {
        if (!mounted || isEditMode || widgets.length === 0 || didResetInitialScrollRef.current)
            return undefined;
        const scrollContainer = scrollContainerRef.current;
        if (!scrollContainer)
            return undefined;
        didResetInitialScrollRef.current = true;
        let userInteracted = false;
        const markInteraction = () => { userInteracted = true; };
        const resetRestoredScroll = () => {
            if (!userInteracted)
                scrollContainer.scrollTop = 0;
        };
        window.addEventListener('pointerdown', markInteraction, { once: true });
        window.addEventListener('wheel', markInteraction, { once: true, passive: true });
        window.addEventListener('touchstart', markInteraction, { once: true, passive: true });
        window.addEventListener('keydown', markInteraction, { once: true });
        resetRestoredScroll();
        const frame = requestAnimationFrame(resetRestoredScroll);
        const lateReset = window.setTimeout(resetRestoredScroll, 500);
        return () => {
            cancelAnimationFrame(frame);
            clearTimeout(lateReset);
            window.removeEventListener('pointerdown', markInteraction);
            window.removeEventListener('wheel', markInteraction);
            window.removeEventListener('touchstart', markInteraction);
            window.removeEventListener('keydown', markInteraction);
        };
    }, [mounted, isEditMode, scrollContainerRef, widgets.length]);
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
        }
        else if (pointerY < bounds.top + AUTO_SCROLL_EDGE) {
            const strength = Math.min(1, (bounds.top + AUTO_SCROLL_EDGE - pointerY) / AUTO_SCROLL_EDGE);
            scrollDelta = -Math.max(4, Math.round(AUTO_SCROLL_MAX_SPEED * strength));
        }
        if (scrollDelta !== 0)
            scrollContainer.scrollTop += scrollDelta;
        autoScrollFrameRef.current = requestAnimationFrame(runAutoScroll);
    };
    const getDragEventClientY = (event: Event) => {
        if ('clientY' in event && typeof event.clientY === 'number')
            return event.clientY;
        const touchEvent = event as Event & {
            touches?: ArrayLike<{
                clientY: number;
            }>;
            changedTouches?: ArrayLike<{
                clientY: number;
            }>;
        };
        if (touchEvent.touches?.[0] && typeof touchEvent.touches[0].clientY === 'number')
            return touchEvent.touches[0].clientY;
        if (touchEvent.changedTouches?.[0] && typeof touchEvent.changedTouches[0].clientY === 'number')
            return touchEvent.changedTouches[0].clientY;
        return null;
    };
    const updateAutoScrollPointer = (event: Event) => {
        const clientY = getDragEventClientY(event);
        if (typeof clientY !== 'number')
            return;
        pointerYRef.current = clientY;
        if (autoScrollFrameRef.current === null) {
            autoScrollFrameRef.current = requestAnimationFrame(runAutoScroll);
        }
    };
    useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        if (!scrollContainer)
            return undefined;
        const observer = new ResizeObserver(entries => {
            const entry = entries[0];
            if (!entry)
                return;
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
        if (isEditMode)
            return;
        stopAutoScroll();
        dragStartLayoutRef.current = null;
        setDragBottomRow(0);
    }, [isEditMode]);
    const currentCols: 4 | 8 | 12 = width >= 832 ? 12 : width >= 560 ? 8 : 4;
    const displayLayout = useMemo(() => projectWidgetLayout(layout, currentCols), [layout, currentCols]);
    const settledBottomRow = Math.max(0, ...displayLayout.map(item => item.y + item.h));
    const canvasMinHeight = useMemo(() => {
        const rowUnit = GRID_ROW_HEIGHT + GRID_MARGIN[1];
        const visibleAddSlots = isEditMode ? getIncompleteWidgetRowSlots(displayLayout, currentCols) : [];
        const lowestWidgetRow = Math.max(0, ...displayLayout.map(item => item.y + item.h), ...visibleAddSlots.map(item => item.y + item.h));
        const draggingBottomRow = activeDragBottomRow > 0 ? activeDragBottomRow + DRAG_CANVAS_PADDING_ROWS : 0;
        const bottomRow = Math.max(lowestWidgetRow, draggingBottomRow);
        const occupiedHeight = bottomRow > 0
            ? GRID_PADDING[1] * 2 + bottomRow * rowUnit - GRID_MARGIN[1]
            : 0;
        return Math.max(0, viewportHeight - 48, occupiedHeight);
    }, [activeDragBottomRow, isEditMode, displayLayout, currentCols, viewportHeight]);
    const gridLayout = useMemo(() => displayLayout.map(position => {
        const widget = widgets.find(item => item.id === position.i);
        const allowedWidths = getAllowedWidgetSizePresets(widget?.type).map(preset => WIDGET_SIZE_PRESETS[preset].w);
        return {
            ...position,
            minW: Math.min(Math.min(...allowedWidths), currentCols),
            maxW: Math.min(Math.max(...allowedWidths), currentCols),
            minH: WIDGET_CONSTRAINTS.minH,
            maxH: WIDGET_CONSTRAINTS.maxH,
            isDraggable: position.isDraggable !== false && isEditMode,
            isResizable: position.isResizable !== false && isEditMode && currentCols === 12,
        };
    }), [isEditMode, displayLayout, currentCols, widgets]);
    const emptySlots = useMemo(() => (isEditMode ? getIncompleteWidgetRowSlots(displayLayout, currentCols) : []), [isEditMode, displayLayout, currentCols]);
    const getEmptySlotStyle = (slot: EmptyWidgetSlot): React.CSSProperties => {
        const columnWidth = (width - GRID_PADDING[0] * 2 - GRID_MARGIN[0] * (currentCols - 1)) / currentCols;
        return {
            position: 'absolute',
            zIndex: 20,
            left: GRID_PADDING[0] + slot.x * (columnWidth + GRID_MARGIN[0]),
            top: GRID_PADDING[1] + slot.y * (GRID_ROW_HEIGHT + GRID_MARGIN[1]),
            width: slot.w * columnWidth + (slot.w - 1) * GRID_MARGIN[0],
            height: slot.h * GRID_ROW_HEIGHT + (slot.h - 1) * GRID_MARGIN[1],
        };
    };
    return (<div ref={containerRef} className="relative min-h-full w-full max-w-5xl mx-auto px-6 py-6" onMouseDown={() => {
            if (isEditMode)
                onSelectWidget(null);
        }} data-widget-grid-canvas="true" data-grid-measured-width={width} data-grid-columns={currentCols}>
      {mounted && (<div className="relative" style={{ minHeight: canvasMinHeight }} data-widget-grid-static={!isEditMode ? 'true' : undefined}>
          {activeDragBottomRow === 0 && emptySlots.map(slot => (<div key={`__add-widget-${slot.y}-${slot.x}`} style={getEmptySlotStyle(slot)}>
              <AddWidgetSlot pendingWidgetIds={pendingCatalogWidgetIds} getWidgetCount={getCatalogWidgetCount} isWidgetDisabled={isCatalogWidgetDisabled} onSelectWidget={widget => onAddWidgetFromSlot(widget, slot)}/>
            </div>))}
          <ReactGridLayout width={width} layout={gridLayout} compactor={noCompactor} className="relative z-10" style={{ minHeight: canvasMinHeight }} gridConfig={{
                cols: currentCols,
                rowHeight: GRID_ROW_HEIGHT,
                margin: GRID_MARGIN,
                containerPadding: GRID_PADDING,
            }} dragConfig={{
                enabled: isEditMode,
                cancel: '.widget-toolbar, button, input, textarea, select, a, [data-no-widget-drag]',
                bounded: true,
            }} resizeConfig={{
                enabled: isEditMode && currentCols === 12,
            }} onDragStart={dragLayout => {
                if (!isEditMode)
                    return;
                cacheAutoScrollBounds();
                dragStartLayoutRef.current = toWidgetGridPositions(dragLayout as readonly WidgetGridPosition[], displayLayout);
                setDragBottomRow(settledBottomRow + 5);
            }} onDrag={(nextLayout, _oldItem, newItem, _placeholder, event) => {
                if (!isEditMode)
                    return;
                applyDragPreview(nextLayout as WidgetGridPosition[], dragStartLayoutRef.current || displayLayout, newItem?.i, displayLayout);
                setDragBottomRow(Math.max(settledBottomRow + 5, newItem ? newItem.y + newItem.h : 0));
                updateAutoScrollPointer(event);
            }} onDragStop={(nextLayout, _oldItem, newItem) => {
                stopAutoScroll();
                setDragBottomRow(0);
                const previousLayout = dragStartLayoutRef.current || displayLayout;
                dragStartLayoutRef.current = null;
                if (!isEditMode)
                    return;
                const finalLayout = applyDragPreview(nextLayout as WidgetGridPosition[], previousLayout, newItem?.i, displayLayout);
                onCommitLayout(normalizeWidgetLayout(finalLayout.map(position => ({
                    ...position,
                    w: layout.find(item => item.i === position.i)?.w || position.w,
                    h: layout.find(item => item.i === position.i)?.h || position.h,
                }))));
            }} onResize={(_nextLayout, _oldItem, newItem) => {
                if (!isEditMode)
                    return;
                setDragBottomRow(newItem ? newItem.y + newItem.h : 0);
            }} onResizeStop={nextLayout => {
                setDragBottomRow(0);
                if (!isEditMode)
                    return;
                const rawResizedLayout = toWidgetGridPositions(nextLayout as readonly WidgetGridPosition[], displayLayout);
                const resizedItem = rawResizedLayout.find(position => {
                    const previousPosition = displayLayout.find(item => item.i === position.i);
                    return previousPosition && (previousPosition.w !== position.w || previousPosition.h !== position.h);
                });
                if (!resizedItem)
                    return;
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
                const freeLayout = rawResizedLayout.map(pos => pos.i === resizedItem.i ? freeItem : pos);
                onCommitResize(normalizeWidgetLayout(freeLayout, resizedItem.i), resizedItem.i);
            }}>
            {widgets.map(widget => (<div key={widget.id}>
                <WidgetCard widget={{
                    ...widget,
                    sizePreset: getDisplaySizePreset(layout.find(position => position.i === widget.id), widget.sizePreset, widget.type),
                }} gridPos={displayLayout.find(position => position.i === widget.id)} isEditMode={isEditMode} onEnterWidgetEditMode={onEnterWidgetEditMode} onExitWidgetEditMode={onExitWidgetEditMode} selected={selectedWidgetId === widget.id} onSelect={onSelectWidget} onDelete={onDeleteWidget} onApplyPreset={onApplyPreset} onApplyCustom={onApplyCustom} onQuickCommandSelect={onQuickCommandSelect}/>
              </div>))}
          </ReactGridLayout>
        </div>)}
    </div>);
};
export default React.memo(WidgetGrid);
