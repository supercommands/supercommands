import React, { useRef, useEffect } from 'react';
import { useAppearance } from '@extension/ui';
import ScatteredDotsPattern from '../../../../../../settings/uiPersonalization/ScatteredDotsPattern';
import WidgetFloatingToolbar from './WidgetFloatingToolbar';
import EditableWidgetTitle from './EditableWidgetTitle';
import { getWidgetTypeLabel } from '../utils/widgetTypeLabel';
import { getWidgetHeaderIcon } from '../utils/widgetHeaderIcons';
import { normalizeWidgetCustomSize, getAllowedWidgetSizePresets } from '../engine/widgetDashboardData';
import type { WidgetInstance, WidgetSizePreset } from '../widgetDashboard.types';
import { deriveLayoutInfoFromWidget } from '../utils/widgetLayoutInfo';
import { getWidgetPerfId, widgetPerf } from '../utils/widgetPerf';
import type { CommandId } from '../../../../../../shared-components/searchBarMain/commandConfigurations/commands';
import type { LocalCommandId } from '../../../../../../shared-components/searchBarMain/commandConfigurations/localCommands';
import WeatherWidgetContent from '../items/WeatherWidget';
import NoteWidgetContent from '../items/NoteWidget';
import FavoritesWidgetContent from '../items/FavoritesWidget';
import TodoWidgetContent from '../items/TodoWidget';
import DailyQuoteWidgetContent from '../items/DailyQuoteWidget';
import TimeWidgetContent from '../items/TimeWidget';
import NewsWidgetContent from '../items/NewsWidget';
import HtmlWidgetContent from '../items/HtmlWidget';
import LinkLibraryWidgetContent from '../items/LinkLibraryWidget';
import AiPromptLibraryWidgetContent from '../items/AiPromptLibraryWidget';
import SnippetLibraryWidgetContent from '../items/SnippetLibraryWidget';
import NoteLibraryWidgetContent from '../items/NoteLibraryWidget';
import YearProgressWidgetContent from '../items/YearProgressWidget';
const createInstrumentedWidget = <P extends Record<string, any>>(widgetType: string, LoadedWidget: React.ComponentType<P>) => {
    const InstrumentedWidget: React.FC<P> = props => {
        const widget = props.widget as WidgetInstance | undefined;
        useEffect(() => {
            widgetPerf('component:mounted', {
                widgetType,
                widgetId: getWidgetPerfId(widget),
            });
        }, [widget?.id]);
        return <LoadedWidget {...props}/>;
    };
    return InstrumentedWidget;
};
const WeatherWidget = createInstrumentedWidget('weather', WeatherWidgetContent);
const NoteWidget = createInstrumentedWidget('note-item', NoteWidgetContent);
const FavoritesWidget = createInstrumentedWidget('favorites', FavoritesWidgetContent);
const TodoWidget = createInstrumentedWidget('todo-list', TodoWidgetContent);
const DailyQuoteWidget = createInstrumentedWidget('daily-quote', DailyQuoteWidgetContent);
const TimeWidget = createInstrumentedWidget('time', TimeWidgetContent);
const NewsWidget = createInstrumentedWidget('news', NewsWidgetContent);
const HtmlWidget = createInstrumentedWidget('html', HtmlWidgetContent);
const LinkLibraryWidget = createInstrumentedWidget('link-library', LinkLibraryWidgetContent);
const AiPromptLibraryWidget = createInstrumentedWidget('ai-prompt-library', AiPromptLibraryWidgetContent);
const SnippetLibraryWidget = createInstrumentedWidget('snippet-library', SnippetLibraryWidgetContent);
const NoteLibraryWidget = createInstrumentedWidget('note-library', NoteLibraryWidgetContent);
const YearProgressWidget = createInstrumentedWidget('year-progress', YearProgressWidgetContent);
interface WidgetCardProps {
    widget: WidgetInstance;
    gridPos?: {
        w?: number;
        h?: number;
    };
    isEditMode?: boolean;
    onEnterWidgetEditMode?: (widgetId?: string) => void;
    onExitWidgetEditMode?: () => void;
    selected: boolean;
    onSelect: (widgetId: string | null) => void;
    onDelete: (widgetId: string) => void;
    onApplyPreset: (widgetId: string, preset: WidgetSizePreset) => void;
    onApplyCustom: (widgetId: string) => void;
    onQuickCommandSelect?: (commandId: CommandId | LocalCommandId | 'ai' | 'collections') => void;
}
const LONG_PRESS_DURATION = 600;
const MOVEMENT_TOLERANCE_PX = 10;
const WidgetCard: React.FC<WidgetCardProps> = ({ widget, gridPos, isEditMode = false, onEnterWidgetEditMode, onExitWidgetEditMode, selected, onSelect, onDelete, onApplyPreset, onApplyCustom, onQuickCommandSelect, }) => {
    const { theme } = useAppearance();
    const showScatteredDots = theme.isDark && theme.pattern === 'scattered-dots';
    const hasCustomSize = Boolean(normalizeWidgetCustomSize(widget.customSize));
    const isCustomActive = widget.expansionMode === 'free' && hasCustomSize;
    const resolvedWidget: WidgetInstance = {
        ...widget,
        sessionId: widget.sessionId || (widget.referenceType === 'session' ? widget.referenceId : undefined),
        noteId: widget.noteId || (widget.referenceType === 'note' ? widget.referenceId : undefined),
        linkId: (widget as any).linkId || (widget.referenceType === 'link' ? widget.referenceId : undefined),
    };
    const layoutInfo = deriveLayoutInfoFromWidget(resolvedWidget, gridPos);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const startPosRef = useRef<{
        x: number;
        y: number;
    } | null>(null);
    const isLongPressTriggeredRef = useRef<boolean>(false);
    const clearTimer = () => {
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };
    useEffect(() => {
        widgetPerf('card:mounted', {
            widgetType: widget.type,
            widgetId: widget.id,
            viewId: widget.viewId,
            gridW: gridPos?.w,
            gridH: gridPos?.h,
        });
        return () => {
            clearTimer();
        };
    }, [gridPos?.h, gridPos?.w, widget.id, widget.type, widget.viewId]);
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        clearTimer();
        if (!isEditMode) {
            onEnterWidgetEditMode?.(widget.id);
        }
        onSelect(widget.id);
    };
    const handlePointerDown = (e: React.PointerEvent) => {
        // Ignore right clicks for long-press timer since contextMenu handles them
        if (e.button === 2)
            return;
        if (e.pointerType === 'mouse' || e.clientY > e.currentTarget.getBoundingClientRect().top + 48)
            return;
        if (e.target instanceof Element && e.target.closest('button, input, textarea, select, a, [contenteditable], [data-no-widget-drag]'))
            return;
        clearTimer();
        isLongPressTriggeredRef.current = false;
        startPosRef.current = { x: e.clientX, y: e.clientY };
        timerRef.current = setTimeout(() => {
            isLongPressTriggeredRef.current = true;
            if (!isEditMode) {
                onEnterWidgetEditMode?.(widget.id);
            }
            onSelect(widget.id);
        }, LONG_PRESS_DURATION);
    };
    const handlePointerMove = (e: React.PointerEvent) => {
        if (!timerRef.current || !startPosRef.current)
            return;
        const dx = Math.abs(e.clientX - startPosRef.current.x);
        const dy = Math.abs(e.clientY - startPosRef.current.y);
        if (dx > MOVEMENT_TOLERANCE_PX || dy > MOVEMENT_TOLERANCE_PX) {
            clearTimer();
        }
    };
    const handlePointerUp = () => {
        clearTimer();
    };
    const handlePointerCancel = () => {
        clearTimer();
    };
    const handlePointerLeave = () => {
        clearTimer();
    };
    const handleClick = (e: React.MouseEvent) => {
        if (isLongPressTriggeredRef.current) {
            e.preventDefault();
            e.stopPropagation();
            isLongPressTriggeredRef.current = false;
            return;
        }
        if (isEditMode) {
            onSelect(widget.id);
        }
    };
    const cardStyle = {
        background: 'var(--color-widgetBg)',
        borderColor: 'var(--color-widgetBorder)',
        borderStyle: 'solid',
        borderWidth: '1px',
        boxShadow: '0 2px 4px var(--color-widgetShadow), 0 10px 24px var(--color-widgetShadow)',
    } as React.CSSProperties;
    return (<article className={`group relative h-full w-full overflow-hidden rounded-[26px] text-[var(--color-textPrimary)] ${isEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'} ${selected && isEditMode ? 'ring-2 ring-[var(--color-borderActive)]' : ''}`} style={cardStyle} data-widget-card="true" data-widget-id={widget.id} data-no-widget-drag={!isEditMode ? 'true' : undefined} onContextMenu={handleContextMenu} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerCancel} onPointerLeave={handlePointerLeave} onClick={handleClick}>
      {showScatteredDots && (<div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 opacity-40">
          <ScatteredDotsPattern />
        </div>)}
      <div className={`relative z-0 flex h-full flex-col ${widget.type === 'todo-list' || widget.type === 'time' || widget.type === 'news' || widget.type === 'html' || widget.type === 'session-item' || widget.type === 'note-item' || widget.type === 'link-item' || widget.type === 'link-library' || widget.type === 'ai-prompt-library' || widget.type === 'snippet-library' || widget.type === 'note-library' ? 'p-0' : 'px-5 pt-2.5 pb-4'}`}>
        {widget.type !== 'note-item' &&
            widget.type !== 'note-library' &&
            widget.type !== 'session-item' &&
            widget.type !== 'link-library' &&
            widget.type !== 'ai-prompt-library' &&
            widget.type !== 'snippet-library' &&
            widget.type !== 'todo-list' &&
            widget.type !== 'time' &&
            widget.type !== 'news' &&
            widget.type !== 'html' &&
            widget.type !== 'favorites' &&
            widget.type !== 'year-progress' && (<div className="pl-1 mb-2">
              <EditableWidgetTitle viewId={resolvedWidget.viewId} widgetId={resolvedWidget.id} initialTitle={resolvedWidget.title} isEditMode={isEditMode} icon={getWidgetHeaderIcon(widget.type)} typeLabel={getWidgetTypeLabel(widget.type)} className="text-xs font-bold uppercase tracking-wider text-[var(--color-textPrimary)]"/>
            </div>)}

        <React.Suspense fallback={null}>
          {widget.type === 'note-item' ? (<div className="flex-1 min-h-0 w-full overflow-hidden">
                <NoteWidget widget={resolvedWidget} isEditMode={isEditMode} layoutInfo={layoutInfo}/>
              </div>) : widget.type === 'note-library' ? (<div className="flex-1 min-h-0 w-full overflow-hidden">
                <NoteLibraryWidget widget={resolvedWidget} isEditMode={isEditMode} layoutInfo={layoutInfo}/>
              </div>) : widget.type === 'session-item' ? (<div className="flex-1 min-h-0 w-full overflow-hidden">
                {null}
              </div>) : widget.type === 'weather' ? (<div className="flex-1 min-h-0 w-full overflow-hidden">
                <WeatherWidget widget={resolvedWidget} sizePreset={widget.sizePreset} layoutInfo={layoutInfo}/>
              </div>) : widget.type === 'time' ? (<div className="flex-1 min-h-0 w-full overflow-hidden">
                <TimeWidget widget={resolvedWidget} sizePreset={widget.sizePreset} isEditMode={isEditMode} layoutInfo={layoutInfo}/>
              </div>) : widget.type === 'news' ? (<div className="flex-1 min-h-0 w-full overflow-hidden">
                <NewsWidget widget={resolvedWidget} sizePreset={widget.sizePreset} isEditMode={isEditMode} layoutInfo={layoutInfo}/>
              </div>) : widget.type === 'favorites' ? (<div className="flex-1 min-h-0 w-full overflow-hidden">
                <FavoritesWidget widget={resolvedWidget} isEditMode={isEditMode} layoutInfo={layoutInfo}/>
              </div>) : widget.type === 'todo-list' ? (<div className="flex-1 min-h-0 w-full overflow-hidden">
                <TodoWidget widget={resolvedWidget} isEditMode={isEditMode} layoutInfo={layoutInfo}/>
              </div>) : widget.type === 'quote-of-the-day' || widget.type === 'daily-quote' ? (<div className="flex-1 min-h-0 w-full overflow-hidden">
                <DailyQuoteWidget widget={resolvedWidget} sizePreset={widget.sizePreset} isEditMode={isEditMode} layoutInfo={layoutInfo}/>
              </div>) : widget.type === 'html' ? (<div className="flex-1 min-h-0 w-full overflow-hidden">
                <HtmlWidget widget={resolvedWidget} isEditMode={isEditMode} layoutInfo={layoutInfo}/>
              </div>) : widget.type === 'link-library' ? (<div className="flex-1 min-h-0 w-full overflow-hidden">
                <LinkLibraryWidget widget={resolvedWidget} isEditMode={isEditMode} layoutInfo={layoutInfo}/>
              </div>) : widget.type === 'ai-prompt-library' ? (<div className="flex-1 min-h-0 w-full overflow-hidden ">
                <AiPromptLibraryWidget widget={resolvedWidget} isEditMode={isEditMode} layoutInfo={layoutInfo}/>
              </div>) : widget.type === 'snippet-library' ? (<div className="flex-1 min-h-0 w-full overflow-hidden ">
                <SnippetLibraryWidget widget={resolvedWidget} isEditMode={isEditMode} layoutInfo={layoutInfo}/>
              </div>) : widget.type === 'year-progress' ? (<div className="flex-1 min-h-0 w-full overflow-hidden">
                <YearProgressWidget widget={resolvedWidget} sizePreset={widget.sizePreset} isEditMode={isEditMode} layoutInfo={layoutInfo}/>
              </div>) : (<div className="flex flex-1 min-h-0 w-full flex-col items-center justify-center rounded-2xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] dark:bg-[var(--color-widgetInnerBg)] px-4 text-center">
                <div className="text-sm font-semibold text-[var(--color-textPrimary)]">{widget.title}</div>
                <div className="mt-1 text-xs font-medium text-[var(--color-textMuted)]">Widget unavailable</div>
              </div>)}
        </React.Suspense>
      </div>

      {isEditMode && (<div className="relative z-[1000] pointer-events-auto opacity-100 scale-100 translate-y-0 blur-0 transition-all duration-200 ease-out">
          <WidgetFloatingToolbar activePreset={widget.sizePreset} allowedPresets={getAllowedWidgetSizePresets(widget.type)} isCustomActive={isCustomActive} hasCustomSize={hasCustomSize} onApplyPreset={preset => onApplyPreset(widget.id, preset)} onApplyCustom={() => onApplyCustom(widget.id)} onDelete={() => onDelete(widget.id)}/>
        </div>)}
    </article>);
};
const areWidgetCardPropsEqual = (prevProps: Readonly<WidgetCardProps>, nextProps: Readonly<WidgetCardProps>): boolean => {
    return (prevProps.widget.id === nextProps.widget.id &&
        prevProps.widget.type === nextProps.widget.type &&
        prevProps.widget.title === nextProps.widget.title &&
        prevProps.widget.sizePreset === nextProps.widget.sizePreset &&
        prevProps.widget.viewId === nextProps.widget.viewId &&
        prevProps.widget.referenceId === nextProps.widget.referenceId &&
        prevProps.widget.referenceType === nextProps.widget.referenceType &&
        prevProps.widget.noteId === nextProps.widget.noteId &&
        prevProps.widget.sessionId === nextProps.widget.sessionId &&
        prevProps.widget.linkId === nextProps.widget.linkId &&
        prevProps.widget.categoryId === nextProps.widget.categoryId &&
        prevProps.widget.expansionMode === nextProps.widget.expansionMode &&
        prevProps.widget.customSize === nextProps.widget.customSize &&
        prevProps.widget.settings === nextProps.widget.settings &&
        prevProps.widget.updatedAt === nextProps.widget.updatedAt &&
        prevProps.widget.createdAt === nextProps.widget.createdAt &&
        prevProps.gridPos?.w === nextProps.gridPos?.w &&
        prevProps.gridPos?.h === nextProps.gridPos?.h &&
        prevProps.isEditMode === nextProps.isEditMode &&
        prevProps.selected === nextProps.selected &&
        prevProps.onEnterWidgetEditMode === nextProps.onEnterWidgetEditMode &&
        prevProps.onExitWidgetEditMode === nextProps.onExitWidgetEditMode &&
        prevProps.onSelect === nextProps.onSelect &&
        prevProps.onDelete === nextProps.onDelete &&
        prevProps.onApplyPreset === nextProps.onApplyPreset &&
        prevProps.onApplyCustom === nextProps.onApplyCustom &&
        prevProps.onQuickCommandSelect === nextProps.onQuickCommandSelect);
};
export default React.memo(WidgetCard, areWidgetCardPropsEqual);
