export type RecurringCycle = 'daily' | 'weekly' | 'monthly' | string | null | undefined;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const startOfLocalDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const endOfLocalDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
export const addRecurringCycle = (timeMs: number, cycle: RecurringCycle): number => {
    const date = new Date(timeMs);
    if (!Number.isFinite(date.getTime()))
        return timeMs;
    if (cycle === 'daily') {
        return timeMs + MS_PER_DAY;
    }
    if (cycle === 'weekly') {
        return timeMs + 7 * MS_PER_DAY;
    }
    if (cycle === 'monthly') {
        const originalDay = date.getDate();
        const next = new Date(date);
        next.setDate(1);
        next.setMonth(next.getMonth() + 1);
        next.setDate(Math.min(originalDay, daysInMonth(next.getFullYear(), next.getMonth())));
        return next.getTime();
    }
    return timeMs;
};
export const getEffectiveRecurringScheduleTime = (scheduleTime: number, cycle: RecurringCycle, nowDate: Date = new Date()): number => {
    const original = new Date(scheduleTime);
    if (!Number.isFinite(original.getTime()))
        return scheduleTime;
    const now = nowDate.getTime();
    const nowDayStart = startOfLocalDay(nowDate);
    if (startOfLocalDay(original) > nowDayStart)
        return scheduleTime;
    const hour = original.getHours();
    const minute = original.getMinutes();
    const second = original.getSeconds();
    const millisecond = original.getMilliseconds();
    if (cycle === 'daily') {
        if (startOfLocalDay(original) > nowDayStart)
            return scheduleTime;
        return new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), hour, minute, second, millisecond).getTime();
    }
    if (cycle === 'weekly') {
        const dayDiff = original.getDay() - nowDate.getDay();
        const occurrence = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() + dayDiff, hour, minute, second, millisecond);
        if (endOfLocalDay(occurrence) < nowDayStart) {
            occurrence.setDate(occurrence.getDate() + 7);
        }
        return occurrence.getTime();
    }
    if (cycle === 'monthly') {
        const occurrenceDay = Math.min(original.getDate(), daysInMonth(nowDate.getFullYear(), nowDate.getMonth()));
        const occurrence = new Date(nowDate.getFullYear(), nowDate.getMonth(), occurrenceDay, hour, minute, second, millisecond);
        if (endOfLocalDay(occurrence) < nowDayStart) {
            occurrence.setDate(1);
            occurrence.setMonth(occurrence.getMonth() + 1);
            occurrence.setDate(Math.min(original.getDate(), daysInMonth(occurrence.getFullYear(), occurrence.getMonth())));
        }
        return occurrence.getTime();
    }
    return scheduleTime > now ? scheduleTime : now;
};
export const getNextRecurringAlarmTime = (scheduleTime: number, cycle: RecurringCycle, nowDate: Date = new Date()): number => {
    let nextRunTime = getEffectiveRecurringScheduleTime(scheduleTime, cycle, nowDate);
    const minGap = 60 * 1000;
    const now = nowDate.getTime();
    while (nextRunTime <= now + minGap) {
        nextRunTime = addRecurringCycle(nextRunTime, cycle);
    }
    return nextRunTime;
};
