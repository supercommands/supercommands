/**
 * @file notifications.ts
 * @description Handles Chrome notification click events for the extension.
 *
 * Notification creation is routed through notificationService and delivery channels.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { executeTodoNotificationAction } from '@todos/todos';

import { activateNotification } from './notificationService';

/**
 * Global handler for clicks on system notifications.
 * Routes to NotificationService.activateNotification, falling back to legacy ID formats if necessary.
 *
 * @param notificationId The ID of the clicked notification.
 */
export async function handleNotificationClick(notificationId: string) {
  try {
    const handled = await activateNotification(notificationId);
    if (handled) return;
  } catch (err) {
    console.error('[Notifications] activateNotification error:', err);
  }

  // Legacy fallback for pre-v18 notification IDs
  if (
    notificationId.startsWith('todo-') ||
    notificationId.startsWith('reminder-') ||
    notificationId.startsWith('alarm-') ||
    notificationId.startsWith('immediate-')
  ) {
    const firstDash = notificationId.indexOf('-');
    const lastDash = notificationId.lastIndexOf('-');
    const todoId = notificationId.substring(firstDash + 1, lastDash);

    if (todoId) {
      executeTodoNotificationAction(todoId)
        .catch(err => console.error('[Notifications] Failed to execute legacy todo notification action:', err))
        .finally(() => chrome.notifications.clear(notificationId));
    }
  }
}
