import type { CalendarDay, CalendarMonthLabel } from '../types';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function buildMonthLabels(days: CalendarDay[]): CalendarMonthLabel[] {
  const labels: CalendarMonthLabel[] = [];
  let lastMonth = -1;

  days.forEach(day => {
    const date = new Date(`${day.date}T00:00:00`);
    const month = date.getMonth();
    if (month !== lastMonth) {
      labels.push({
        label: monthNames[month],
        month,
        year: date.getFullYear(),
        weekIndex: day.weekIndex,
      });
      lastMonth = month;
    }
  });

  return labels;
}
