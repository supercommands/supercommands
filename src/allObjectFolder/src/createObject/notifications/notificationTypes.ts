export type NotificationStatus = 'unread' | 'read' | 'dismissed';
export type ActionExecutionState = 'pending' | 'executing' | 'executed' | 'failed';
export type NotificationSourceType = 'todo' | 'backup' | 'restore' | 'import' | 'export' | 'system';
export interface NotificationRecord {
    id: string; // Unique ID (e.g., "notif_1718293819_xyz")
    ownerId: string; // User ID or 'local_default' for multi-account scoping
    sourceType: NotificationSourceType;
    sourceId: string;
    dedupeKey: string;
    title: string;
    message?: string;
    status: NotificationStatus;
    occurrenceAt: number; // Exact scheduled occurrence timestamp from alarm
    createdAt: number; // Ingestion timestamp
    readAt?: number; // When viewed or opened
    dismissedAt?: number; // When dismissed via 'X' or when Todo completed/deleted elsewhere
    actionState: ActionExecutionState;
    actionStartedAt?: number; // Timestamp when claim was made (for worker recovery)
    actionExecutedAt?: number; // Timestamp when action completed successfully
}
