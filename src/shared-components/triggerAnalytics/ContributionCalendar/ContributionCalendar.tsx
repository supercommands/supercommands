import * as React from 'react';
import type { CalendarDay as CalendarDayType, UsageCalendarData } from '../types';
import { CalendarEmptyState } from './CalendarEmptyState';
import { CalendarGrid } from './CalendarGrid';
import { CalendarHeader } from './CalendarHeader';
import { CalendarLegend } from './CalendarLegend';
import { CalendarTooltip } from './CalendarTooltip';

type ContributionCalendarProps = {
  data: UsageCalendarData | null;
  isLoading: boolean;
  selectedDate: string;
  year: number;
  onSelectDate: (date: string) => void;
  onPreviousYear: () => void;
  onNextYear: () => void;
  onToday: () => void;
};

export const ContributionCalendar: React.FC<ContributionCalendarProps> = ({
  data,
  isLoading,
  selectedDate,
  year,
  onSelectDate,
  onPreviousYear,
  onNextYear,
  onToday,
}) => {
  const [hoveredDay, setHoveredDay] = React.useState<CalendarDayType | null>(null);
  const [hoverRect, setHoverRect] = React.useState<DOMRect | null>(null);

  return (
    <div className="rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] p-4">
      <CalendarHeader
        year={year}
        disableNext={year >= new Date().getFullYear()}
        onPrevious={onPreviousYear}
        onNext={onNextYear}
        onToday={onToday}
      />
      <div className="mt-4">
        {isLoading && <div className="text-xs text-[var(--color-textSecondary)]">Loading activity...</div>}
        {!isLoading && data && (
          <>
            <CalendarGrid
              data={data}
              selectedDate={selectedDate}
              onSelectDate={onSelectDate}
              onHoverDay={(day, rect) => {
                setHoveredDay(day);
                setHoverRect(rect || null);
              }}
            />
            {data.totals.usages === 0 && (
              <div className="mt-3">
                <CalendarEmptyState />
              </div>
            )}
          </>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="text-[10px] text-[var(--color-textMuted)]">
          {data ? `${data.totals.activeDays} active days - ${data.totals.usages} uses` : ''}
        </div>
        <CalendarLegend />
      </div>
      <CalendarTooltip day={hoveredDay} rect={hoverRect} />
    </div>
  );
};
