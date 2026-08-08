import * as React from 'react';
import type { CalendarDay as CalendarDayType } from '../types';

type CalendarDayProps = {
  day: CalendarDayType;
  selected: boolean;
  onSelect: (date: string) => void;
  onHover: (day: CalendarDayType | null, rect?: DOMRect) => void;
};

const formatLabel = (day: CalendarDayType) => {
  const date = new Date(`${day.date}T00:00:00`);
  const dateText = date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  if (day.isFuture) return `${dateText}: Future date`;
  if (!day.total) return `${dateText}: No shortcut usage`;
  return `${dateText}: ${day.total} uses, ${day.hotkeyCount} hotkeys, ${day.textShortcutCount} text shortcuts`;
};

export const CalendarDay: React.FC<CalendarDayProps> = ({ day, selected, onSelect, onHover }) => (
  <button
    type="button"
    aria-label={formatLabel(day)}
    disabled={day.isFuture}
    data-level={day.level}
    onClick={() => !day.isFuture && onSelect(day.date)}
    onMouseEnter={event => onHover(day, event.currentTarget.getBoundingClientRect())}
    onMouseLeave={() => onHover(null)}
    onFocus={event => onHover(day, event.currentTarget.getBoundingClientRect())}
    onBlur={() => onHover(null)}
    className={`h-3 w-3 rounded-[2px] border transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focusRing)] ${
      selected ? 'ring-2 ring-[var(--color-focusRing)] ring-offset-1 ring-offset-[var(--color-editorBg)]' : ''
    } ${day.isFuture ? 'cursor-default opacity-40' : 'cursor-pointer hover:scale-125'}`}
    style={{
      backgroundColor: `var(--usage-level-${day.level})`,
      borderColor: selected ? 'var(--color-focusRing)' : 'var(--usage-border)',
    }}
  />
);
