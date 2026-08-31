import React, { useRef, useEffect } from 'react';
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

const createInstrumentedLazyWidget = <P extends Record<string, any>>(
  widgetType: string,
  loader: () => Promise<{ default: React.ComponentType<P> }>,
) =>
  React.lazy(async () => {
    widgetPerf('lazyImport:requested', { widgetType });
    const startedAt = performance.now();
    const module = await loader();
    widgetPerf('lazyImport:loaded', {
      widgetType,
      durationMs: Math.round(performance.now() - startedAt),
    });
    const LoadedWidget = module.default;
    const InstrumentedWidget: React.FC<P> = props => {
      const widget = props.widget as WidgetInstance | undefined;
      useEffect(() => {
        widgetPerf('lazyComponent:mounted', {
          widgetType,
          widgetId: getWidgetPerfId(widget),
        });
      }, [widget?.id]);
      return <LoadedWidget {...props} />;
    };
    return { default: InstrumentedWidget };
  });

const WeatherWidget = createInstrumentedLazyWidget('weather', () => import('../items/WeatherWidget'));
const NoteWidget = createInstrumentedLazyWidget('note-item', () => import('../items/NoteWidget'));
const SessionWidget = createInstrumentedLazyWidget('session-item', () => import('../items/SessionWidget'));
const FavoritesWidget = createInstrumentedLazyWidget('favorites', () => import('../items/FavoritesWidget'));
const TodoWidget = createInstrumentedLazyWidget('todo-list', () => import('../items/TodoWidget'));
const DailyQuoteWidget = createInstrumentedLazyWidget('daily-quote', () => import('../items/DailyQuoteWidget'));
const TimeWidget = createInstrumentedLazyWidget('time', () => import('../items/TimeWidget'));
const NewsWidget = createInstrumentedLazyWidget('news', () => import('../items/NewsWidget'));
const HtmlWidget = createInstrumentedLazyWidget('html', () => import('../items/HtmlWidget'));
const LinkLibraryWidget = createInstrumentedLazyWidget('link-library', () => import('../items/LinkLibraryWidget'));
const AiPromptLibraryWidget = createInstrumentedLazyWidget('ai-prompt-library', () => import('../items/AiPromptLibraryWidget'));
const SnippetLibraryWidget = createInstrumentedLazyWidget('snippet-library', () => import('../items/SnippetLibraryWidget'));
const NoteLibraryWidget = createInstrumentedLazyWidget('note-library', () => import('../items/NoteLibraryWidget'));

interface WidgetCardProps {
  widget: WidgetInstance;
  gridPos?: { w?: number; h?: number };
  isEditMode?: boolean;
  onEnterWidgetEditMode?: (widgetId?: string) => void;
  onExitWidgetEditMode?: () => void;
  selected: boolean;
  onSelect: (widgetId: string | null) => void;
  onDelete: (widgetId: string) => void;
  onApplyPreset: (widgetId: string, preset: WidgetSizePreset) => void;
  onApplyCustom: (widgetId: string) => void;
  animationIndex?: number;
  onQuickCommandSelect?: (commandId: CommandId | LocalCommandId | 'ai' | 'collections') => void;
}

const LONG_PRESS_DURATION = 600;
const MOVEMENT_TOLERANCE_PX = 10;

const WidgetCard: React.FC<WidgetCardProps> = ({
  widget,
  gridPos,
  isEditMode = false,
  onEnterWidgetEditMode,
  onExitWidgetEditMode,
  selected,
  onSelect,
  onDelete,
  onApplyPreset,
  onApplyCustom,
  animationIndex = 0,
  onQuickCommandSelect,
}) => {
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
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
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
    if (e.button === 2) return;

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
    if (!timerRef.current || !startPosRef.current) return;
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

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const cardStyle = isDark ? {
    background: `linear-gradient(180deg, rgba(255, 255, 255, 0.145) 0%, rgba(255, 255, 255, 0.11) 55%, rgba(255, 255, 255, 0.085) 100%)`,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderStyle: 'solid',
    borderWidth: '1px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.16), 0 12px 28px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.035)',
    '--widget-edit-wiggle-delay': `${Math.min(animationIndex, 6) * 45}ms`,
  } as React.CSSProperties & Record<'--widget-edit-wiggle-delay', string> : {
    background: 'var(--color-widgetBg)',
    borderColor: 'var(--color-widgetBorder)',
    borderStyle: 'solid',
    borderWidth: '1px',
    boxShadow: '0 2px 4px rgba(15, 23, 42, 0.05), 0 10px 24px var(--color-widgetShadow), inset 0 1px 0 rgba(255, 255, 255, 0.65)',
    '--widget-edit-wiggle-delay': `${Math.min(animationIndex, 6) * 45}ms`,
  } as React.CSSProperties & Record<'--widget-edit-wiggle-delay', string>;

  return (
    <article
      className={`group relative h-full w-full overflow-hidden rounded-[26px] text-[var(--color-textPrimary)] ${
        isEditMode ? 'cursor-grab active:cursor-grabbing widget-edit-mode-wiggle' : 'cursor-default'
      } ${selected && isEditMode ? 'ring-2 ring-[var(--color-borderActive)]' : ''}`}
      style={cardStyle}
      data-widget-card="true"
      data-widget-id={widget.id}
      data-no-widget-drag={!isEditMode ? 'true' : undefined}
      onContextMenu={handleContextMenu}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}>
      <div
        className={`relative z-0 flex h-full flex-col ${widget.type === 'todo-list' || widget.type === 'time' || widget.type === 'news' || widget.type === 'html' || widget.type === 'session-item' || widget.type === 'note-item' || widget.type === 'link-item' || widget.type === 'link-library' || widget.type === 'ai-prompt-library' || widget.type === 'snippet-library' || widget.type === 'note-library' ? 'p-0' : 'px-5 pt-2.5 pb-4'}`}>
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
          widget.type !== 'favorites' && (
            <div className="pl-1 mb-2">
              <EditableWidgetTitle
                viewId={resolvedWidget.viewId}
                widgetId={resolvedWidget.id}
                initialTitle={resolvedWidget.title}
                isEditMode={isEditMode}
                icon={getWidgetHeaderIcon(widget.type)}
                typeLabel={getWidgetTypeLabel(widget.type)}
                className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-textMuted)]"
              />
            </div>
          )}

        <React.Suspense fallback={null}>
          {widget.type === 'note-item' ? (
            <div className="flex-1 min-h-0 w-full overflow-hidden">
              <NoteWidget widget={resolvedWidget} isEditMode={isEditMode} layoutInfo={layoutInfo} />
            </div>
          ) : widget.type === 'note-library' ? (
            <div className="flex-1 min-h-0 w-full overflow-hidden">
              <NoteLibraryWidget widget={resolvedWidget} isEditMode={isEditMode} layoutInfo={layoutInfo} />
            </div>
          ) : widget.type === 'session-item' ? (
            <div className="flex-1 min-h-0 w-full overflow-hidden">
              <SessionWidget widget={resolvedWidget} isEditMode={isEditMode} layoutInfo={layoutInfo} />
            </div>
          ) : widget.type === 'weather' ? (
            <div className="flex-1 min-h-0 w-full overflow-hidden">
              <WeatherWidget widget={resolvedWidget} sizePreset={widget.sizePreset} layoutInfo={layoutInfo} />
            </div>
          ) : widget.type === 'time' ? (
            <div className="flex-1 min-h-0 w-full overflow-hidden">
              <TimeWidget widget={resolvedWidget} sizePreset={widget.sizePreset} isEditMode={isEditMode} layoutInfo={layoutInfo} />
            </div>
          ) : widget.type === 'news' ? (
            <div className="flex-1 min-h-0 w-full overflow-hidden">
              <NewsWidget widget={resolvedWidget} sizePreset={widget.sizePreset} isEditMode={isEditMode} layoutInfo={layoutInfo} />
            </div>
          ) : widget.type === 'favorites' ? (
            <div className="flex-1 min-h-0 w-full overflow-hidden">
              <FavoritesWidget widget={resolvedWidget} isEditMode={isEditMode} layoutInfo={layoutInfo} />
            </div>
          ) : widget.type === 'todo-list' ? (
            <div className="flex-1 min-h-0 w-full overflow-hidden">
              <TodoWidget widget={resolvedWidget} isEditMode={isEditMode} layoutInfo={layoutInfo} />
            </div>
          ) : widget.type === 'quote-of-the-day' || widget.type === 'daily-quote' ? (
            <div className="flex-1 min-h-0 w-full overflow-hidden">
              <DailyQuoteWidget widget={resolvedWidget} sizePreset={widget.sizePreset} isEditMode={isEditMode} layoutInfo={layoutInfo} />
            </div>
          ) : widget.type === 'html' ? (
            <div className="flex-1 min-h-0 w-full overflow-hidden">
              <HtmlWidget widget={resolvedWidget} isEditMode={isEditMode} layoutInfo={layoutInfo} />
            </div>
          ) : widget.type === 'link-library' ? (
            <div className="flex-1 min-h-0 w-full overflow-hidden">
              <LinkLibraryWidget widget={resolvedWidget} isEditMode={isEditMode} layoutInfo={layoutInfo} />
            </div>
          ) : widget.type === 'ai-prompt-library' ? (
            <div className="flex-1 min-h-0 w-full overflow-hidden ">
              <AiPromptLibraryWidget widget={resolvedWidget} isEditMode={isEditMode} layoutInfo={layoutInfo} />
            </div>
          ) : widget.type === 'snippet-library' ? (
            <div className="flex-1 min-h-0 w-full overflow-hidden ">
              <SnippetLibraryWidget widget={resolvedWidget} isEditMode={isEditMode} layoutInfo={layoutInfo} />
            </div>
          ) : (
            <div className="flex flex-1 min-h-0 w-full flex-col items-center justify-center rounded-2xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-4 text-center">
              <div className="text-sm font-semibold text-[var(--color-textPrimary)]">{widget.title}</div>
              <div className="mt-1 text-xs font-medium text-[var(--color-textMuted)]">Widget unavailable</div>
            </div>
          )}
        </React.Suspense>
      </div>

      {isEditMode && (
        <div className="relative z-[1000] pointer-events-auto opacity-100 scale-100 translate-y-0 blur-0 transition-all duration-200 ease-out">
          <WidgetFloatingToolbar
            activePreset={widget.sizePreset}
            allowedPresets={getAllowedWidgetSizePresets(widget.type)}
            isCustomActive={isCustomActive}
            hasCustomSize={hasCustomSize}
            onApplyPreset={preset => onApplyPreset(widget.id, preset)}
            onApplyCustom={() => onApplyCustom(widget.id)}
            onDelete={() => onDelete(widget.id)}
          />
        </div>
      )}
    </article>
  );
};

export default WidgetCard;
