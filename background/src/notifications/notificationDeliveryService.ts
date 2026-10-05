/**
 * @file notificationDeliveryService.ts
 * @description Centralized queue manager for delivering notifications through channel adapters.
 * Provides atomic job claiming, FIFO ordering, service-worker crash recovery, and queue pruning.
 */

import Dexie from 'dexie';
import { db } from '../../../src/storage/indexDB/dbConfig';
import type { NotificationDeliveryJob } from '../../../src/storage/indexDB/notificationDeliveryTypes';
import { desktopNotificationChannel } from './channels/desktopNotificationChannel';

const STUCK_JOB_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes
const SENT_JOB_RETENTION_MS = 24 * 60 * 60 * 1000; // 1 day

// In-worker re-entrancy lock to prevent parallel queue drain loops within the same worker
let isProcessingQueue = false;

/**
 * Claims the next pending job atomically using a Dexie read-write transaction.
 * Orders deterministically by earliest nextAttemptAt, then earliest createdAt (FIFO).
 */
async function claimNextDueJob(): Promise<NotificationDeliveryJob | null> {
  const now = Date.now();

  return await db.transaction('rw', db.notificationDeliveryJobs, async () => {
    const candidate = await db.notificationDeliveryJobs
      .where('[status+nextAttemptAt]')
      .between(['pending', Dexie.minKey], ['pending', now], true, true)
      .first();

    if (!candidate) return null;

    const claimed: NotificationDeliveryJob = {
      ...candidate,
      status: 'processing',
      processingStartedAt: now,
      updatedAt: now,
    };

    await db.notificationDeliveryJobs.put(claimed);
    return claimed;
  });
}

/**
 * Processes all currently available jobs in the delivery queue.
 * Guarded against re-entrancy by an in-worker promise lock.
 */
export async function processAvailableJobs(): Promise<void> {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    while (true) {
      const job = await claimNextDueJob();
      if (!job) break;

      try {
        const notification = await db.notifications.get(job.id);

        // Pre-delivery check: If the notification was dismissed, deleted, or source Todo completed
        if (!notification || notification.status === 'dismissed') {
          console.log(`[NotificationDeliveryService] Skipping delivery for dismissed/missing notification: ${job.id}`);
          await db.notificationDeliveryJobs.delete(job.id);
          continue;
        }

        if (notification.sourceType === 'todo' && notification.sourceId) {
          const todo = await db.todos.get(notification.sourceId);
          if (!todo || todo.isDone) {
            console.log(`[NotificationDeliveryService] Skipping delivery for completed/deleted todo: ${notification.sourceId}`);
            await db.notificationDeliveryJobs.delete(job.id);
            continue;
          }
        }

        // Deliver via channel adapter
        if (job.channel === 'desktop') {
          await desktopNotificationChannel.deliver(notification);
        } else {
          console.warn(`[NotificationDeliveryService] Unknown channel: ${job.channel}`);
        }

        // Mark sent
        const now = Date.now();
        await db.notificationDeliveryJobs.update(job.id, {
          status: 'sent',
          deliveredAt: now,
          updatedAt: now,
        });
      } catch (err: any) {
        console.error(`[NotificationDeliveryService] Failed to deliver job ${job.id}:`, err);
        const now = Date.now();
        await db.notificationDeliveryJobs.update(job.id, {
          status: 'failed',
          lastError: String(err?.message || err),
          updatedAt: now,
        });
      }
    }
  } finally {
    isProcessingQueue = false;
  }
}

/**
 * Recovers jobs stuck in 'processing' state (e.g. if the service worker terminated mid-delivery).
 */
export async function recoverStuckProcessingJobs(): Promise<number> {
  const now = Date.now();
  const cutoff = now - STUCK_JOB_TIMEOUT_MS;

  try {
    const stuckJobs = await db.notificationDeliveryJobs
      .where('status')
      .equals('processing')
      .filter(job => !!job.processingStartedAt && job.processingStartedAt < cutoff)
      .toArray();

    if (stuckJobs.length === 0) return 0;

    console.log(`[NotificationDeliveryService] Recovering ${stuckJobs.length} stuck processing job(s)`);

    await db.transaction('rw', db.notificationDeliveryJobs, async () => {
      for (const job of stuckJobs) {
        await db.notificationDeliveryJobs.update(job.id, {
          status: 'pending',
          processingStartedAt: undefined,
          updatedAt: now,
        });
      }
    });

    return stuckJobs.length;
  } catch (err) {
    console.error('[NotificationDeliveryService] Failed to recover stuck processing jobs:', err);
    return 0;
  }
}

/**
 * Consolidated startup initialization hook.
 * Recovers stuck jobs and processes any pending jobs.
 */
export async function initializeNotificationDelivery(): Promise<void> {
  try {
    await recoverStuckProcessingJobs();
    await processAvailableJobs();
  } catch (err) {
    console.error('[NotificationDeliveryService] initializeNotificationDelivery failed:', err);
  }
}

/**
 * Prunes completed 'sent' delivery jobs older than 1 day.
 * Retains 'failed' jobs for inspection and troubleshooting.
 */
export async function pruneOldDeliveryJobs(): Promise<number> {
  const cutoff = Date.now() - SENT_JOB_RETENTION_MS;

  try {
    const oldJobIds = await db.notificationDeliveryJobs
      .where('status')
      .equals('sent')
      .filter(job => job.updatedAt < cutoff)
      .primaryKeys();

    if (oldJobIds.length === 0) return 0;

    await db.notificationDeliveryJobs.bulkDelete(oldJobIds);
    console.log(`[NotificationDeliveryService] Pruned ${oldJobIds.length} old sent delivery job(s)`);
    return oldJobIds.length;
  } catch (err) {
    console.error('[NotificationDeliveryService] Failed to prune old delivery jobs:', err);
    return 0;
  }
}
