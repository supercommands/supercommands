import * as React from 'react';
import type { CalendarDay as CalendarDayType, UsageCalendarData } from '../types';
import { CalendarDay } from './CalendarDay';

type CalendarGridProps = {
  data: UsageCalendarData;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onHoverDay: (day: CalendarDayType | null, rect?: DOMRect) => void;
};

const weekdayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const CalendarGrid: React.FC<CalendarGridProps> = ({ data, selectedDate, onSelectDate, onHoverDay }) => (
  <div className="overflow-x-auto pb-2">
    <div className="min-w-max">
      <div className="ml-6 mb-1 grid h-4" style={{ gridTemplateColumns: `repeat(${data.weeks.length}, 15px)` }}>
        {data.months.map(month => (
          <div
            key={`${month.year}-${month.month}-${month.weekIndex}`}
            className="text-[10px] text-[var(--color-textMuted)]"
            style={{ gridColumnStart: month.weekIndex + 1 }}>
            {month.label}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="grid grid-rows-7 gap-[3px] text-[9px] text-[var(--color-textMuted)] pr-1">
          {weekdayLabels.map((label, index) => (
            <div key={`${label}-${index}`} className="h-3 leading-3">
              {index % 2 === 1 ? label : ''}
            </div>
          ))}
        </div>
        <div className="flex gap-[3px]">
          {data.weeks.map(week => (
            <div key={week.weekIndex} className="grid grid-rows-7 gap-[3px]">
              {week.days.map(day => (
                <CalendarDay
                  key={day.date}
                  day={day}
                  selected={selectedDate === day.date}
                  onSelect={onSelectDate}
                  onHover={onHoverDay}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
