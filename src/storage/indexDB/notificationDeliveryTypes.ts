/**
 * @file notificationDeliveryTypes.ts
 * @description Type definitions for the background notification delivery queue.
 * Decouples user-visible inbox state (db.notifications) from delivery pipeline mechanics.
 */
export type NotificationDeliveryChannel = 'desktop';
export type NotificationDeliveryStatus = 'pending' | 'processing' | 'sent' | 'failed';
export interface NotificationDeliveryJob {
    /** The notification ID (e.g. "notif_123"), directly matching NotificationRecord.id */
    id: string;
    channel: NotificationDeliveryChannel;
    status: NotificationDeliveryStatus;
    createdAt: number;
    updatedAt: number;
    /** Timestamp when this job should be attempted; used for FIFO indexing */
    nextAttemptAt: number;
    processingStartedAt?: number;
    deliveredAt?: number;
    lastError?: string;
}
