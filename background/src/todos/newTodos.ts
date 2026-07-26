/**
 * @file newTodos.ts
 * @description Handles creation and management of new todo items.
 */
import { db } from '../../../src/storage/indexDB/dbConfig';
import { createNotification } from '../notifications/notifications';

export async function handleNewTodoAlarm(alarm: chrome.alarms.Alarm) {
  const todoId = alarm.name.split('|')[1];

  if (!todoId) return;

  try {
    const todo = await db.todos.get(todoId);
    if (!todo) return;

    const refCount = todo.references ? todo.references.length : 0;

    // Show notification using the proven wrapper
    createNotification(`newtodo-${todoId}-${Date.now()}`, {
      title: 'Task Reminder: ' + (todo.name || 'Untitled'),
      message: `You have ${refCount} reference(s) attached.`,
    });

    // Reschedule if recurring
    if (todo.scheduleType === 'recurring' && todo.recurringType) {
      const nextRun = new Date(todo.scheduleTime);

      if (todo.recurringType === 'daily') {
        nextRun.setDate(nextRun.getDate() + 1);
      } else if (todo.recurringType === 'weekly') {
        nextRun.setDate(nextRun.getDate() + 7);
      } else if (todo.recurringType === 'monthly') {
        nextRun.setMonth(nextRun.getMonth() + 1);
      }

      const nextTime = nextRun.getTime();

      // Update Dexie
      await db.todos.update(todoId, {
        scheduleTime: nextTime,
        updatedAt: Date.now(),
      });

      // Schedule next alarm
      chrome.alarms.create(`newtodo|${todoId}`, { when: nextTime });
    }
  } catch (err) {
    console.error('[NewTodos Background] Error handling alarm:', err);
  }
}
