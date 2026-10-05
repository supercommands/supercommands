/**
 * @file notificationData.ts
 * @description Handles IndexedDB transactions (CRUD) and lifecycle operations
 * for Notification records in cmdOS.
 *
 * @usage
 * ```ts
 * import {
 *   createNotificationRecord,
 *   markNotificationsAsRead,
 *   dismissNotificationRecord,
 *   dismissNotificationsBySourceId,
 *   clearAllVisibleNotifications,
 *   pruneOldNotifications,
 * } from './notificationData';
 * ```
 */
import { db } from '../../../../storage/indexDB/dbConfig';
import type { NotificationRecord, NotificationSourceType, NotificationStatus } from './notificationTypes';
import { generateEntityId } from '../../../../shared-components/utils/idGenerator';
/**
 * Creates a new notification record in Dexie.
 * Deduplicates using the unique `&dedupeKey` constraint.
 */
export const createNotificationRecord = async (input: Omit<NotificationRecord, 'id' | 'createdAt' | 'actionState' | 'status'> & {
    id?: string;
    status?: NotificationStatus;
}): Promise<NotificationRecord | null> => {
    try {
        const id = input.id || generateEntityId('notif');
        const record: NotificationRecord = {
            ...input,
            id,
            status: input.status || 'unread',
            createdAt: Date.now(),
            actionState: 'pending',
        };
        await db.notifications.add(record);
        return record;
    }
    catch (err: any) {
        if (err?.name === 'ConstraintError' || err?.message?.includes('ConstraintError')) {
            console.log('[notificationData] Harmless duplicate caught by dedupeKey:', input.dedupeKey);
            return null;
        }
        console.error('[notificationData] Failed to create notification in Dexie:', err);
        throw err;
    }
};
/**
 * Marks viewed notifications as 'read', including when opening the notification dropdown.
 */
export const markNotificationsAsRead = async (notificationIds: string[]): Promise<void> => {
    try {
        if (!notificationIds || notificationIds.length === 0)
            return;
        const now = Date.now();
        await db.notifications.where('id').anyOf(notificationIds).modify({
            status: 'read',
            readAt: now,
        });
        // Best-effort clear matching desktop OS banners
        notificationIds.forEach(id => {
            try {
                if (typeof chrome !== 'undefined' && chrome.notifications) {
                    chrome.notifications.clear(id);
                }
            }
            catch { }
        });
    }
    catch (err) {
        console.error('[notificationData] Failed to mark notifications as read:', err);
    }
};
/**
 * Dismisses a single notification record by ID.
 */
export const dismissNotificationRecord = async (notificationId: string): Promise<void> => {
    try {
        if (!notificationId)
            return;
        await db.notifications.update(notificationId, {
            status: 'dismissed',
            dismissedAt: Date.now(),
        });
        try {
            if (typeof chrome !== 'undefined' && chrome.notifications) {
                chrome.notifications.clear(notificationId);
            }
        }
        catch { }
    }
    catch (err) {
        console.error('[notificationData] Failed to dismiss notification:', err);
    }
};
/**
 * Dismisses all active notifications for a given source entity (e.g. when a Todo is completed, deleted, or rescheduled).
 */
export const dismissNotificationsBySourceId = async (sourceType: NotificationSourceType, sourceId: string): Promise<void> => {
    try {
        if (!sourceId)
            return;
        const active = await db.notifications
            .where('[sourceType+sourceId]')
            .equals([sourceType, sourceId])
            .filter(n => n.status !== 'dismissed')
            .toArray();
        if (active.length > 0) {
            const now = Date.now();
            await db.notifications
                .where('id')
                .anyOf(active.map(a => a.id))
                .modify({ status: 'dismissed', dismissedAt: now });
            active.forEach(item => {
                try {
                    if (typeof chrome !== 'undefined' && chrome.notifications) {
                        chrome.notifications.clear(item.id);
                    }
                }
                catch { }
            });
        }
    }
    catch (err) {
        console.error('[notificationData] Failed to dismiss notifications by sourceId:', err);
    }
};
/**
 * Dismisses all currently visible/passed notifications.
 */
export const clearAllVisibleNotifications = async (notificationIds: string[]): Promise<void> => {
    try {
        if (!notificationIds || notificationIds.length === 0)
            return;
        const now = Date.now();
        await db.notifications.where('id').anyOf(notificationIds).modify({
            status: 'dismissed',
            dismissedAt: now,
        });
        notificationIds.forEach(id => {
            try {
                if (typeof chrome !== 'undefined' && chrome.notifications) {
                    chrome.notifications.clear(id);
                }
            }
            catch { }
        });
    }
    catch (err) {
        console.error('[notificationData] Failed to clear all notifications:', err);
    }
};
/**
 * Prunes read and dismissed notifications from previous calendar days.
 * An item read or dismissed today remains visible for the remainder of today.
 */
export const pruneOldNotifications = async (): Promise<void> => {
    try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const startOfTodayMs = startOfToday.getTime();
        await db.notifications
            .where('status')
            .equals('read')
            .and(n => (n.readAt || 0) < startOfTodayMs)
            .delete();
        await db.notifications
            .where('status')
            .equals('dismissed')
            .and(n => (n.dismissedAt || 0) < startOfTodayMs)
            .delete();
    }
    catch (err) {
        console.error('[notificationData] Failed to prune old notifications:', err);
    }
};
