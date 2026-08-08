import { useEffect, useMemo, useState } from 'react';
import { getDailyUsageGrid, getUsageForDay } from '../../triggers';
import type { DayUsageDetails } from '../../triggers';
import type { UsageCalendarData } from '../types';
import { buildCalendarDays } from '../utils/buildCalendarDays';
import { buildMonthLabels } from '../utils/buildMonthLabels';
import { calculateUsageTotals } from '../utils/calculateUsageTotals';
import { groupCalendarWeeks } from '../utils/groupCalendarWeeks';

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getYearRange = (year: number) => ({
  start: `${year}-01-01`,
  end: `${year}-12-31`,
});

export function useShortcutCalendar(userId: string = 'local_user') {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(() => formatDateKey(new Date()));
  const [data, setData] = useState<UsageCalendarData | null>(null);
  const [selectedDetails, setSelectedDetails] = useState<DayUsageDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const range = useMemo(() => getYearRange(year), [year]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getDailyUsageGrid(range.start, range.end, userId)
      .then(items => {
        if (cancelled) return;
        const days = buildCalendarDays(items, range.start);
        setData({
          range,
          days,
          weeks: groupCalendarWeeks(days),
          months: buildMonthLabels(days),
          totals: calculateUsageTotals(days),
        });
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, userId]);

  useEffect(() => {
    let cancelled = false;
    getUsageForDay(selectedDate, userId).then(details => {
      if (!cancelled) setSelectedDetails(details);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, userId]);

  return {
    data,
    isLoading,
    selectedDate,
    selectedDetails,
    year,
    selectDate: setSelectedDate,
    goPreviousYear: () => setYear(value => value - 1),
    goNextYear: () => setYear(value => Math.min(new Date().getFullYear(), value + 1)),
    goToday: () => {
      const today = new Date();
      setYear(today.getFullYear());
      setSelectedDate(formatDateKey(today));
    },
  };
}
