import * as React from 'react';
import { createPortal } from 'react-dom';
import type { CalendarDay } from '../types';

type CalendarTooltipProps = {
  day: CalendarDay | null;
  rect: DOMRect | null;
};

export const CalendarTooltip: React.FC<CalendarTooltipProps> = ({ day, rect }) => {
  if (!day || !rect) return null;
  if (typeof document === 'undefined' || typeof window === 'undefined') return null;

  const date = new Date(`${day.date}T00:00:00`);
  const label = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  const tooltipWidth = 210;
  const tooltipHeight = day.total ? 76 : 54;
  const gap = 10;
  const viewportPadding = 8;
  const canPlaceRight = rect.right + gap + tooltipWidth <= window.innerWidth - viewportPadding;
  const canPlaceLeft = rect.left - gap - tooltipWidth >= viewportPadding;
  const left = canPlaceRight
    ? rect.right + gap
    : canPlaceLeft
      ? rect.left - tooltipWidth - gap
      : Math.max(viewportPadding, Math.min(rect.left, window.innerWidth - tooltipWidth - viewportPadding));
  const top = Math.max(
    viewportPadding,
    Math.min(rect.top + rect.height / 2 - tooltipHeight / 2, window.innerHeight - tooltipHeight - viewportPadding),
  );

  return createPortal(
    <div
      className="fixed z-[9999] pointer-events-none rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-popupBg)] px-3 py-2 text-xs shadow-2xl text-[var(--color-textPrimary)]"
      style={{ left, top, width: tooltipWidth }}>
      <div className="font-bold whitespace-nowrap">{label}</div>
      <div className="mt-1 text-[var(--color-textSecondary)] whitespace-nowrap">
        {day.total ? `${day.total} assigned trigger use${day.total === 1 ? '' : 's'}` : 'No assigned trigger usage'}
      </div>
      {!!day.total && (
        <div className="mt-1 text-[10px] text-[var(--color-textMuted)] whitespace-nowrap">
          {day.hotkeyCount} hotkeys - {day.textShortcutCount} text shortcuts
          {day.failureCount ? ` - ${day.failureCount} failed` : ''}
        </div>
      )}
    </div>,
    document.body,
  );
};
