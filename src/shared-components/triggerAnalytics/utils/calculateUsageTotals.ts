import type { CalendarDay } from '../types';

export function calculateUsageTotals(days: CalendarDay[]) {
  return days.reduce(
    (totals, day) => ({
      usages: totals.usages + day.total,
      hotkeys: totals.hotkeys + day.hotkeyCount,
      textShortcuts: totals.textShortcuts + day.textShortcutCount,
      activeDays: totals.activeDays + (day.total > 0 ? 1 : 0),
      failures: totals.failures + day.failureCount,
    }),
    { usages: 0, hotkeys: 0, textShortcuts: 0, activeDays: 0, failures: 0 },
  );
}
