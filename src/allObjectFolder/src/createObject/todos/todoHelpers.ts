/**
 * @file todoHelpers.ts
 * @description Helper functions for managing task/todo dates,
 * including date parsing and same-day/today checker utilities.
 *
 * @usage
 * ```ts
 * import { isToday } from './todoHelpers';
 * const result = isToday(someDate);
 * ```
 */
export const parseTaskDate = (d: string) => {
    if (!d)
        return new Date(0);
    const date = new Date(d.replace(' ', 'T'));
    return isNaN(date.getTime()) ? new Date(0) : date;
};
export const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
};
export const isToday = (d: Date) => {
    return isSameDay(d, new Date());
};
