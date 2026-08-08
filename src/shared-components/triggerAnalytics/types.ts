export type UsageLevel = 0 | 1 | 2 | 3 | 4;

export interface CalendarDay {
  date: string;
  total: number;
  hotkeyCount: number;
  textShortcutCount: number;
  failureCount: number;
  uniqueTargets: number;
  level: UsageLevel;
  dayOfWeek: number;
  weekIndex: number;
  isToday: boolean;
  isFuture: boolean;
}

export interface CalendarWeek {
  weekIndex: number;
  startDate: string;
  days: CalendarDay[];
}

export interface CalendarMonthLabel {
  label: string;
  month: number;
  year: number;
  weekIndex: number;
}

export interface UsageCalendarData {
  range: {
    start: string;
    end: string;
  };
  days: CalendarDay[];
  weeks: CalendarWeek[];
  months: CalendarMonthLabel[];
  totals: {
    usages: number;
    hotkeys: number;
    textShortcuts: number;
    activeDays: number;
    failures: number;
  };
}
