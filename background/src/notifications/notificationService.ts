/**
 * @file notificationService.ts
 * @description Centralized service for ingesting, activating, dismissing, and cleaning
 * notifications backed by the Dexie notifications table.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { db } from '../../../src/storage/indexDB/dbConfig';
import type { NotificationRecord, NotificationSourceType } from '../../../src/storage/indexDB/notificationTypes';
import type { NotificationDeliveryJob } from '../../../src/storage/indexDB/notificationDeliveryTypes';
import { generateEntityId } from '../../../src/shared-components/utils/idGenerator';
import { executeTodoNotificationAction } from '@todos/todos';
import { showInTabToast } from '@notifications/inTabToasts';
import {
  dismissNotificationRecord,
  dismissNotificationsBySourceId,
  pruneOldNotifications,
} from '../../../src/allObjectFolder/src/createObject/notifications/notificationData';
import {
  processAvailableJobs,
  pruneOldDeliveryJobs,
} from './notificationDeliveryService';

const CLAIM_TIMEOUT_MS = 15000; // 15s to recover if service worker terminated mid-execution
const CHROME_NOTIFICATIONS_ENABLED_KEY = 'todo_chrome_alarm_notifications_enabled';

async function shouldEnqueueChromeNotification(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get([CHROME_NOTIFICATIONS_ENABLED_KEY]);
    return result[CHROME_NOTIFICATIONS_ENABLED_KEY] === true;
  } catch (err) {
    console.warn('[NotificationService] Failed to read Chrome notification setting:', err);
    return false;
  }
}

async function getActiveUserId(): Promise<string> {
  try {
    const result = await chrome.storage.local.get(['userId', 'current_user_id', 'user']);
    const id = result?.userId || result?.current_user_id || result?.user?.id;
    return id ? String(id) : 'local_default';
  } catch {
    return 'local_default';
  }
}

/**
 * Creates a notification and enqueues its desktop delivery job in a single Dexie transaction.
 * Post-commit, triggers in-tab toast and starts queue processing.
 */
export async function createAndEnqueueNotification(input: {
  ownerId: string;
  sourceType: NotificationSourceType;
  sourceId: string;
  dedupeKey: string;
  title: string;
  message?: string;
  occurrenceAt: number;
  chromeEligible?: boolean;
  showInTab?: boolean;
}): Promise<NotificationRecord | null> {
  const now = Date.now();
  const notificationId = generateEntityId('notif');
  const shouldCreateDeliveryJob = input.chromeEligible !== false && await shouldEnqueueChromeNotification();

  const record = await db.transaction('rw', [db.notifications, db.notificationDeliveryJobs], async () => {
    // 1. Check existing notification by dedupeKey
    const existing = await db.notifications.where('dedupeKey').equals(input.dedupeKey).first();
    let parentNotification: NotificationRecord;

    if (existing) {
      parentNotification = existing;
    } else {
      parentNotification = {
        ...input,
        id: notificationId,
        status: 'unread',
        createdAt: now,
        actionState: 'pending',
      };
      await db.notifications.add(parentNotification);
    }

    // 2. Enqueue delivery job (job.id directly matches parentNotification.id)
    const existingJob = await db.notificationDeliveryJobs.get(parentNotification.id);
    if (shouldCreateDeliveryJob && !existingJob) {
      const deliveryJob: NotificationDeliveryJob = {
        id: parentNotification.id,
        channel: 'desktop',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        nextAttemptAt: now,
      };
      await db.notificationDeliveryJobs.add(deliveryJob);
    }

    return parentNotification;
  });

  if (record) {
    // Best-effort in-tab presentation toast
    if (input.showInTab !== false) {
      try {
        showInTabToast('SuperCommands Notification', record.title);
      } catch {}
    }

    // Trigger queue drain
    void processAvailableJobs();
  }

  return record;
}

export async function createDurableNotification(input: {
  sourceType: NotificationSourceType;
  sourceId: string;
  dedupeKey: string;
  title: string;
  message?: string;
  occurrenceAt?: number;
  chromeEligible?: boolean;
  showInTab?: boolean;
  ownerId?: string;
}): Promise<NotificationRecord | null> {
  const ownerId = input.ownerId || await getActiveUserId();

  return createAndEnqueueNotification({
    ownerId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    dedupeKey: input.dedupeKey,
    title: input.title,
    message: input.message,
    occurrenceAt: input.occurrenceAt || Date.now(),
    chromeEligible: input.chromeEligible,
    showInTab: input.showInTab,
  });
}

/**
 * Ingests a new notification when a scheduled alarm fires.
 * Deduplicates using alarm.scheduledTime and &dedupeKey.
 */
export async function handleAlarmFired(alarm: chrome.alarms.Alarm) {
  const parts = alarm.name.split('|');
  const todoId = parts[1];
  if (!todoId) return;

  try {
    const todo = await db.todos.get(todoId);
    if (!todo || todo.isDone) return;

    const occurrenceAt = alarm.scheduledTime || todo.scheduleTime || Date.now();
    const dedupeKey = `todo:${todoId}:${occurrenceAt}`;

    const ownerId = await getActiveUserId();
    const key = todo.name || 'Task Due';
    const message = todo.description || 'Task is due';

    await createAndEnqueueNotification({
      ownerId,
      sourceType: 'todo',
      sourceId: todoId,
      dedupeKey,
      title: key,
      message,
      occurrenceAt,
    });
  } catch (err) {
    console.error('[NotificationService] handleAlarmFired failed:', err);
  }
}

/**
 * Centralized activation handler (called by OS banner clicks and Bell item clicks).
 * Uses an atomic write transaction to claim execution and avoid double execution.
 */
export async function activateNotification(notificationId: string): Promise<boolean> {
  const now = Date.now();

  const current = await db.notifications.get(notificationId);
  if (current && current.sourceType !== 'todo') {
    await db.notifications.update(notificationId, {
      status: 'read',
      readAt: current.readAt || now,
    });

    try {
      chrome.notifications.clear(notificationId);
    } catch {}

    return true;
  }

  const claimed = await db.transaction('rw', db.notifications, async () => {
    const notif = await db.notifications.get(notificationId);
    if (!notif) return null;

    if (notif.actionState === 'executed') return null;

    if (notif.actionState === 'executing') {
      const isStale = notif.actionStartedAt && (now - notif.actionStartedAt > CLAIM_TIMEOUT_MS);
      if (!isStale) return null;
    }

    await db.notifications.update(notificationId, {
      status: 'read',
      readAt: notif.readAt || now,
      actionState: 'executing',
      actionStartedAt: now,
    });

    return notif;
  });

  if (!claimed) return false;

  try {
    if (claimed.sourceType === 'todo' && claimed.sourceId) {
      await executeTodoNotificationAction(claimed.sourceId);
    }

    await db.notifications.update(notificationId, {
      actionState: 'executed',
      actionExecutedAt: Date.now(),
    });
  } catch (err) {
    console.error('[NotificationService] Action failed:', err);
    await db.notifications.update(notificationId, {
      actionState: 'failed',
    });
    return false;
  } finally {
    try {
      chrome.notifications.clear(notificationId);
    } catch {}
  }

  return true;
}

/**
 * Dismisses a single notification and clears its OS banner.
 */
export async function dismissNotification(notificationId: string) {
  await dismissNotificationRecord(notificationId);
}

/**
 * Dismisses all active notifications for a given source entity (e.g. when Todo is completed/deleted/rescheduled).
 */
export async function dismissNotificationsForSource(sourceType: 'todo', sourceId: string) {
  await dismissNotificationsBySourceId(sourceType, sourceId);
}

/**
 * Prunes read and dismissed notifications strictly from previous calendar days,
 * and prunes completed delivery jobs older than 1 day.
 */
export async function cleanupOldAndReadNotifications() {
  await pruneOldNotifications();
  await pruneOldDeliveryJobs();
}

/**
 * Reconciles alarms on service worker startup by checking active scheduled Todos against chrome.alarms.
 */
export async function reconcileTodoAlarms() {
  try {
    const activeTodos = await db.todos
      .filter(todo => !todo.isDone)
      .toArray();
    const alarms = await chrome.alarms.getAll();
    const alarmNames = new Set(alarms.map(a => a.name));

    const now = Date.now();
    for (const todo of activeTodos) {
      if (todo.scheduleTime && todo.scheduleTime > now) {
        const name = `todo|${todo.id}`;
        if (!alarmNames.has(name)) {
          chrome.alarms.create(name, { when: todo.scheduleTime });
        }
      }
    }
  } catch (err) {
    console.error('[NotificationService] reconcileTodoAlarms failed:', err);
  }
}
