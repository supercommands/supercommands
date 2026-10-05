import { db } from '../../../../../storage/indexDB/dbConfig';
import type { TodoRecord } from '../todoTypes';

const localDay = (time: number) => {
    const date = new Date(time);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

const localDateKey = (time: number) => {
    const date = new Date(time);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const nextDailyTime = (time: number) => {
    const next = new Date(time);
    next.setDate(next.getDate() + 1);
    return next.getTime();
};

export const dailyOccurrenceId = (seriesId: string, time: number) => `${seriesId}:daily:${localDateKey(time)}`;

const makeOccurrence = (series: TodoRecord, time: number, isDone: boolean, now: number): TodoRecord => ({
    ...series,
    id: dailyOccurrenceId(series.id, time),
    isDone,
    scheduleType: 'one-time',
    recurringType: undefined,
    scheduleTime: time,
    dailySeriesId: series.id,
    dailyOccurrenceDate: localDateKey(time),
    shortcut: '',
    createdAt: now,
    updatedAt: now,
    versionHistory: undefined,
});

/** Save missed days before moving the daily series forward. Safe to call again or from another tab. */
export const materializeDailyTodoOccurrences = async (now = Date.now()): Promise<void> => {
    const today = localDay(now);
    await db.transaction('rw', db.todos, async () => {
        const series = (await db.todos.toArray()).filter(todo =>
            todo.scheduleType === 'recurring' && todo.recurringType === 'daily' && !todo.dailySeriesId
            && (!todo.isDone || localDay(todo.scheduleTime) < today));
        for (const todo of series) {
            if (!Number.isFinite(new Date(todo.scheduleTime).getTime()))
                continue;
            let due = todo.scheduleTime;
            if (!todo.dailyOccurrencesStartedAt) {
                if (localDay(due) < today) {
                    const id = dailyOccurrenceId(todo.id, due);
                    if (!(await db.todos.get(id)))
                        await db.todos.add(makeOccurrence(todo, due, !!todo.isDone, now));
                    const current = new Date(due);
                    const todayDate = new Date(today);
                    current.setFullYear(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate());
                    due = current.getTime();
                }
                await db.todos.update(todo.id, { dailyOccurrencesStartedAt: now, scheduleTime: due, isDone: false, updatedAt: now });
                continue;
            }
            while (localDay(due) < today) {
                const id = dailyOccurrenceId(todo.id, due);
                if (!(await db.todos.get(id))) {
                    await db.todos.add(makeOccurrence(todo, due, !!todo.isDone, now));
                }
                due = nextDailyTime(due);
            }
            if (due !== todo.scheduleTime) {
                await db.todos.update(todo.id, { scheduleTime: due, isDone: false, updatedAt: now });
            }
        }
    });
};

/** Complete one day while leaving the recurring series ready for its next day. */
export const completeDailyTodoOccurrence = async (seriesId: string, now = Date.now()): Promise<number | null> => {
    const selectedDue = (await db.todos.get(seriesId))?.scheduleTime;
    await materializeDailyTodoOccurrences(now);
    return db.transaction('rw', db.todos, async () => {
        const series = await db.todos.get(seriesId);
        if (!series || series.scheduleType !== 'recurring' || series.recurringType !== 'daily')
            return null;
        if (selectedDue && localDay(selectedDue) < localDay(now)) {
            const missedId = dailyOccurrenceId(seriesId, selectedDue);
            if (await db.todos.get(missedId))
                await db.todos.update(missedId, { isDone: true, updatedAt: now });
            return series.scheduleTime;
        }
        const due = series.scheduleTime;
        const id = dailyOccurrenceId(series.id, due);
        if (!(await db.todos.get(id)))
            await db.todos.add(makeOccurrence(series, due, true, now));
        else
            await db.todos.update(id, { isDone: true, updatedAt: now });
        const next = nextDailyTime(due);
        await db.todos.update(series.id, { scheduleTime: next, isDone: false, updatedAt: now });
        return next;
    });
};
