import type * as React from 'react';
import WidgetFloatingToolbar from './WidgetFloatingToolbar';
import DefaultCommandsWidget from '../items/DefaultCommandsWidget';
import WeatherWidget from '../items/WeatherWidget';
import NoteWidget from '../items/NoteWidget';
import FavoritesWidget from '../items/FavoritesWidget';
import TodoWidget from '../items/TodoWidget';
import DailyQuoteWidget from '../items/DailyQuoteWidget';
import TimeWidget from '../items/TimeWidget';
import NewsWidget from '../items/NewsWidget';
import HtmlWidget from '../items/HtmlWidget';
import type { WidgetInstance, WidgetSizePreset } from '../widgetDashboard.types';

import type { CommandId } from '../../../../../../shared-components/searchBarMain/commandConfigurations/commands';
import type { LocalCommandId } from '../../../../../../shared-components/searchBarMain/commandConfigurations/localCommands';

interface WidgetCardProps {
  widget: WidgetInstance;
  isEditMode?: boolean;
  selected: boolean;
  onSelect: (widgetId: string | null) => void;
  onDelete: (widgetId: string) => void;
  onApplyPreset: (widgetId: string, preset: WidgetSizePreset) => void;
  animationIndex?: number;
  onQuickCommandSelect?: (commandId: CommandId | LocalCommandId | 'ai' | 'collections') => void;
}

const WidgetCard: React.FC<WidgetCardProps> = ({
  widget,
  isEditMode = false,
  selected,
  onSelect,
  onDelete,
  onApplyPreset,
  animationIndex = 0,
  onQuickCommandSelect,
}) => {
  const handleSelect = () => {
    if (isEditMode) onSelect(widget.id);
  };

  const cardStyle = {
    backgroundColor: 'var(--color-widgetBg)',
    borderColor: 'var(--color-widgetBorder)',
    boxShadow: '0 18px 38px var(--color-widgetShadow)',
    backdropFilter: 'var(--glass-blur, blur(12px) saturate(1.2))',
    WebkitBackdropFilter: 'var(--glass-blur, blur(12px) saturate(1.2))',
    '--widget-edit-wiggle-delay': `${Math.min(animationIndex, 6) * 45}ms`,
  } as React.CSSProperties & Record<'--widget-edit-wiggle-delay', string>;

  return (
    <article
      className={`group relative h-full w-full overflow-hidden rounded-[26px] border text-[var(--color-textPrimary)] transition duration-200 ${
        isEditMode ? 'cursor-grab active:cursor-grabbing widget-edit-mode-wiggle' : 'cursor-default'
      } ${selected && isEditMode ? 'ring-2 ring-[var(--color-borderActive)]' : ''}`}
      style={cardStyle}
      data-widget-card="true"
      data-no-widget-drag={!isEditMode ? 'true' : undefined}
      onClick={handleSelect}>
      <div
        className={`relative z-0 flex h-full flex-col ${widget.type === 'todo-list' || widget.type === 'time' || widget.type === 'news' || widget.type === 'html' ? 'p-0' : 'p-5'}`}>
        {widget.type !== 'note-item' &&
          widget.type !== 'todo-list' &&
          widget.type !== 'time' &&
          widget.type !== 'news' &&
          widget.type !== 'html' &&
          widget.type !== 'favorites' && (
            <div className="pl-1 mb-2 text-xs font-bold uppercase tracking-normal text-[var(--color-textMuted)]">
              {widget.title}
            </div>
          )}

        {widget.type === 'note-item' ? (
          <div className="flex-1 min-h-0 w-full overflow-hidden">
            <NoteWidget widget={widget} isEditMode={isEditMode} />
          </div>
        ) : widget.type === 'weather' ? (
          <div className="flex-1 min-h-0 w-full overflow-hidden">
            <WeatherWidget sizePreset={widget.sizePreset} />
          </div>
        ) : widget.type === 'time' ? (
          <div className="flex-1 min-h-0 w-full overflow-hidden">
            <TimeWidget sizePreset={widget.sizePreset} isEditMode={isEditMode} />
          </div>
        ) : widget.type === 'news' ? (
          <div className="flex-1 min-h-0 w-full overflow-hidden">
            <NewsWidget sizePreset={widget.sizePreset} isEditMode={isEditMode} />
          </div>
        ) : widget.type === 'favorites' ? (
          <div className="flex-1 min-h-0 w-full overflow-hidden">
            <FavoritesWidget widget={widget} isEditMode={isEditMode} />
          </div>
        ) : widget.type === 'todo-list' ? (
          <div className="flex-1 min-h-0 w-full overflow-hidden">
            <TodoWidget widget={widget} isEditMode={isEditMode} />
          </div>
        ) : widget.type === 'quote-of-the-day' || widget.type === 'daily-quote' ? (
          <div className="flex-1 min-h-0 w-full overflow-hidden">
            <DailyQuoteWidget sizePreset={widget.sizePreset} isEditMode={isEditMode} />
          </div>
        ) : widget.type === 'html' ? (
          <div className="flex-1 min-h-0 w-full overflow-hidden">
            <HtmlWidget widget={widget} isEditMode={isEditMode} />
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 w-full flex-col items-center justify-center rounded-2xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-4 text-center">
            <div className="text-sm font-semibold text-[var(--color-textPrimary)]">{widget.title}</div>
            <div className="mt-1 text-xs font-medium text-[var(--color-textMuted)]">Widget unavailable</div>
          </div>
        )}
      </div>

      {isEditMode && (
        <div
          className={`relative z-[1000] transition-all duration-200 ease-out ${
            selected
              ? 'pointer-events-auto opacity-100 scale-100 translate-y-0 blur-0'
              : 'pointer-events-none opacity-0 scale-95 translate-y-2 blur-[2px] group-hover:pointer-events-auto group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0 group-hover:blur-0 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-focus-within:scale-100 group-focus-within:translate-y-0 group-focus-within:blur-0'
          }`}>
          <WidgetFloatingToolbar
            activePreset={widget.sizePreset}
            onApplyPreset={preset => onApplyPreset(widget.id, preset)}
            onDelete={() => onDelete(widget.id)}
          />
        </div>
      )}
    </article>
  );
};

export default WidgetCard;
