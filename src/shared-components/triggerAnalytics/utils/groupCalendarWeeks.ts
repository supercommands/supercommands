import type { CalendarDay, CalendarWeek } from '../types';

export function groupCalendarWeeks(days: CalendarDay[]): CalendarWeek[] {
  const weeks = new Map<number, CalendarDay[]>();
  days.forEach(day => {
    const existing = weeks.get(day.weekIndex) || [];
    existing.push(day);
    weeks.set(day.weekIndex, existing);
  });

  return Array.from(weeks.entries()).map(([weekIndex, weekDays]) => ({
    weekIndex,
    startDate: weekDays[0]?.date || '',
    days: weekDays.sort((a, b) => a.dayOfWeek - b.dayOfWeek),
  }));
}
