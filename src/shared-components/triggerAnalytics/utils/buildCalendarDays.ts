import type { DailyUsageGridItem } from '../../triggers';
import type { CalendarDay } from '../types';
import { getUsageLevel } from './getUsageLevel';

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function buildCalendarDays(items: DailyUsageGridItem[], startDate: string): CalendarDay[] {
  const todayKey = formatDateKey(new Date());
  const start = new Date(`${startDate}T00:00:00`);

  return items.map(item => {
    const date = new Date(`${item.date}T00:00:00`);
    const diffDays = Math.floor((date.getTime() - start.getTime()) / 86400000);
    const weekIndex = Math.floor(diffDays / 7);
    const dayOfWeek = date.getDay();
    return {
      date: item.date,
      total: item.total,
      hotkeyCount: item.hotkeyCount,
      textShortcutCount: item.textShortcutCount,
      failureCount: item.failureCount,
      uniqueTargets: item.uniqueTargets,
      level: getUsageLevel(item.total),
      dayOfWeek,
      weekIndex,
      isToday: item.date === todayKey,
      isFuture: item.date > todayKey,
    };
  });
}
