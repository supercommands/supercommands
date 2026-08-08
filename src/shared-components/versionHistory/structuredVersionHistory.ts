export interface StructuredVersionEntry<T = any> {
  id: string;
  savedAt: number;
  snapshot: T;
  label?: string;
  windowStartedAt: number;
  lastUpdatedAt: number;
  isInitial?: boolean;
}

export interface StructuredVersionHistory<T = any> {
  versions: StructuredVersionEntry<T>[];
  maxHistorySize?: number;
  lastCheckpointAt?: number;
}

export type VersionHistorySnapshot =
  | { entityType: 'note'; title?: string; body: string; workspaceId?: string; folderId?: string | null; tagIds?: string[]; shortcut?: string }
  | { entityType: 'todo'; name: string; description?: string; isDone?: boolean; scheduleTime?: number; scheduleType?: string; recurringType?: string; shortcut?: string; references?: any[]; tagIds?: string[]; workspaceId?: string; folderId?: string | null }
  | { entityType: 'snippet'; title: string; config: any; shortcut?: string; workspaceId?: string; folderId?: string | null; tagIds?: string[] }
  | { entityType: 'link'; title: string; urls: any[]; workspaceId?: string; folderId?: string | null; tagIds?: string[]; shortcut?: string }
  | { entityType: 'session'; title: string; description?: string; shortcut?: string; urls: any[]; workspaceId?: string; folderId?: string | null; sessionOpenSettings?: any; windowId?: number };

const DEFAULT_MAX_HISTORY_SIZE = 25;
export const VERSION_HISTORY_CHECKPOINT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function deepCloneSnapshot<T = any>(val: T): T {
  if (val === null || typeof val !== 'object') return val;
  try {
    return JSON.parse(JSON.stringify(val));
  } catch {
    return val;
  }
}

/**
 * Normalizes a snapshot for equality comparison by ignoring transient fields
 * (like updatedAt, createdAt) and providing consistent defaults for missing properties.
 */
export function normalizeSnapshotForComparison<T = any>(snapshot: T): any {
  if (snapshot === null || typeof snapshot !== 'object') return snapshot;
  const cloned: any = deepCloneSnapshot(snapshot);

  delete cloned.updatedAt;
  delete cloned.createdAt;
  delete cloned.deletedAt;
  delete cloned.expectedUpdatedAt;
  delete cloned._kind;

  // Normalize string fields to trimmed strings or ""
  for (const key of Object.keys(cloned)) {
    if (typeof cloned[key] === 'string') {
      cloned[key] = cloned[key].trim();
    } else if (cloned[key] === undefined) {
      cloned[key] = null;
    }
  }

  return cloned;
}

export function snapshotsAreEqual<T = any>(prevSnapshot: T, nextSnapshot: T): boolean {
  if (prevSnapshot === nextSnapshot) return true;
  if (!prevSnapshot || !nextSnapshot) return false;
  const normPrev = normalizeSnapshotForComparison(prevSnapshot);
  const normNext = normalizeSnapshotForComparison(nextSnapshot);
  return JSON.stringify(normPrev) === JSON.stringify(normNext);
}

export function getVersionsNewestFirst<T = any>(
  history: StructuredVersionHistory<T> | undefined | null
): StructuredVersionEntry<T>[] {
  if (!history || !Array.isArray(history.versions)) return [];
  return [...history.versions].reverse();
}

export function deriveLastCheckpointAt(history: any): number {
  if (!history || !Array.isArray(history.versions) || history.versions.length === 0) {
    return 0;
  }
  if (typeof history.lastCheckpointAt === 'number' && Number.isFinite(history.lastCheckpointAt)) {
    return history.lastCheckpointAt;
  }
  const lastEntry = history.versions[history.versions.length - 1];
  if (lastEntry && typeof lastEntry.id === 'string' && lastEntry.id.startsWith('v_')) {
    const parts = lastEntry.id.split('_');
    if (parts.length >= 2) {
      const parsedTime = parseInt(parts[1], 10);
      if (Number.isFinite(parsedTime) && parsedTime > 0) {
        return parsedTime;
      }
    }
  }
  return lastEntry?.savedAt || Date.now();
}

export function normalizeHistory<T = any>(
  rawHistory: any,
  fallbackTimestamp: number = Date.now()
): StructuredVersionHistory<T> {
  if (rawHistory && Array.isArray(rawHistory.versions) && rawHistory.versions.length > 0) {
    const maxAllowed = rawHistory.maxHistorySize || DEFAULT_MAX_HISTORY_SIZE;
    const normalizedVersions: StructuredVersionEntry<T>[] = rawHistory.versions.map((v: any, idx: number) => {
      let timeFromId = 0;
      if (typeof v.id === 'string' && v.id.startsWith('v_')) {
        const parts = v.id.split('_');
        if (parts.length >= 2) {
          const parsed = parseInt(parts[1], 10);
          if (Number.isFinite(parsed) && parsed > 0) timeFromId = parsed;
        }
      }
      const savedAt = v.savedAt || timeFromId || fallbackTimestamp;
      // Legacy entries without explicit windowStartedAt are assigned windowStartedAt = 0 so they are frozen and never updated retroactively
      const windowStartedAt = typeof v.windowStartedAt === 'number' ? v.windowStartedAt : 0;
      const lastUpdatedAt = v.lastUpdatedAt || savedAt;
      const isInitial = idx === 0 ? true : Boolean(v.isInitial);

      return {
        id: String(v.id || `v_${savedAt}_${idx + 1}`),
        label: v.label || `Version ${idx + 1}`,
        snapshot: deepCloneSnapshot(v.snapshot),
        savedAt,
        windowStartedAt,
        lastUpdatedAt,
        isInitial,
      };
    });

    const lastCheckpointAt = normalizedVersions[normalizedVersions.length - 1].lastUpdatedAt;

    return {
      ...rawHistory,
      versions: normalizedVersions,
      maxHistorySize: maxAllowed,
      lastCheckpointAt,
    };
  }

  return {
    versions: [
      {
        id: `v_${fallbackTimestamp}_1`,
        savedAt: fallbackTimestamp,
        windowStartedAt: fallbackTimestamp,
        lastUpdatedAt: fallbackTimestamp,
        snapshot: {} as T,
        label: 'Version 1',
        isInitial: true,
      },
    ],
    maxHistorySize: DEFAULT_MAX_HISTORY_SIZE,
    lastCheckpointAt: fallbackTimestamp,
  };
}

/**
 * Creates an initial version history with Version 1 containing the real initial snapshot.
 */
export function createInitialStructuredVersionHistory<T = any>(
  initialSnapshotOrTime?: T | number,
  savedAtOrMaxSize?: number,
  maxSize: number = DEFAULT_MAX_HISTORY_SIZE
): StructuredVersionHistory<T> {
  let snapshot: any;
  let savedAt: number;
  let resolvedMaxSize: number = maxSize;

  if (typeof initialSnapshotOrTime === 'number') {
    snapshot = {};
    savedAt = initialSnapshotOrTime;
    if (typeof savedAtOrMaxSize === 'number') resolvedMaxSize = savedAtOrMaxSize;
  } else if (initialSnapshotOrTime !== undefined && initialSnapshotOrTime !== null) {
    snapshot = deepCloneSnapshot(initialSnapshotOrTime);
    savedAt = typeof savedAtOrMaxSize === 'number' ? savedAtOrMaxSize : Date.now();
  } else {
    snapshot = {};
    savedAt = Date.now();
    if (typeof savedAtOrMaxSize === 'number') resolvedMaxSize = savedAtOrMaxSize;
  }

  return {
    versions: [
      {
        id: `v_${savedAt}_1`,
        savedAt,
        windowStartedAt: savedAt,
        lastUpdatedAt: savedAt,
        snapshot,
        label: 'Version 1',
        isInitial: true,
      },
    ],
    maxHistorySize: resolvedMaxSize,
    lastCheckpointAt: savedAt,
  };
}

export interface UpsertVersionResult<T = any> {
  history: StructuredVersionHistory<T>;
  action: 'none' | 'created' | 'updated';
}

/**
 * Centralized Open Version Window function:
 * - At most 1 version number is created per 5-minute window.
 * - Sub-edits within the 5-minute window update the active version IN PLACE with the latest snapshot.
 * - Edits after 5 minutes expire create a new version number.
 * - Version 1 is immutable (isInitial: true) and never overwritten.
 */
export function upsertVersionForChange<T = any>(
  history: StructuredVersionHistory<T> | undefined | null,
  previousSnapshot: T | undefined | null,
  nextSnapshot: T,
  now: number = Date.now(),
  options: { maxHistorySize?: number } = {}
): UpsertVersionResult<T> {
  const normHistory = normalizeHistory<T>(history, now);
  const maxAllowed = options.maxHistorySize || normHistory.maxHistorySize || DEFAULT_MAX_HISTORY_SIZE;
  const versions = [...normHistory.versions];

  // 1. If previous and next snapshot are identical, or newest version snapshot equals next snapshot, do nothing
  if (previousSnapshot && snapshotsAreEqual(previousSnapshot, nextSnapshot)) {
    return { history: normHistory, action: 'none' };
  }

  if (versions.length > 0) {
    const newest = versions[versions.length - 1];
    if (snapshotsAreEqual(newest.snapshot, nextSnapshot)) {
      return { history: normHistory, action: 'none' };
    }
  }

  // 2. If history has no versions, create Version 1 initial, then Version 2
  if (versions.length === 0) {
    const v1: StructuredVersionEntry<T> = {
      id: `v_${now}_1`,
      label: 'Version 1',
      snapshot: deepCloneSnapshot(previousSnapshot || nextSnapshot),
      savedAt: now,
      windowStartedAt: now,
      lastUpdatedAt: now,
      isInitial: true,
    };
    const v2: StructuredVersionEntry<T> = {
      id: `v_${now}_2`,
      label: 'Version 2',
      snapshot: deepCloneSnapshot(nextSnapshot),
      savedAt: now,
      windowStartedAt: now,
      lastUpdatedAt: now,
    };
    const updated = [v1, v2];
    if (updated.length > maxAllowed) updated.splice(0, updated.length - maxAllowed);
    return {
      history: {
        ...normHistory,
        versions: updated,
        lastCheckpointAt: now,
      },
      action: 'created',
    };
  }

  const newest = versions[versions.length - 1];

  // 3. If newest version is Version 1 (isInitial), create Version 2 immediately for nextSnapshot (do NOT wait 5 mins!)
  if (newest.isInitial || versions.length === 1) {
    const versionNum = versions.length + 1;
    const vNew: StructuredVersionEntry<T> = {
      id: `v_${now}_${versionNum}`,
      label: `Version ${versionNum}`,
      snapshot: deepCloneSnapshot(nextSnapshot),
      savedAt: now,
      windowStartedAt: now,
      lastUpdatedAt: now,
    };
    const updated = [...versions, vNew];
    if (updated.length > maxAllowed) updated.splice(0, updated.length - maxAllowed);
    return {
      history: {
        ...normHistory,
        versions: updated,
        lastCheckpointAt: now,
      },
      action: 'created',
    };
  }

  // 4. If newest version window is open (< 5 minutes), update newest version IN PLACE!
  const windowStartedAt = newest.windowStartedAt || newest.savedAt || now;
  const isWindowOpen = now - windowStartedAt < VERSION_HISTORY_CHECKPOINT_INTERVAL_MS;

  if (isWindowOpen) {
    const updatedNewest: StructuredVersionEntry<T> = {
      ...newest,
      snapshot: deepCloneSnapshot(nextSnapshot),
      lastUpdatedAt: now,
      savedAt: now,
    };
    versions[versions.length - 1] = updatedNewest;

    return {
      history: {
        ...normHistory,
        versions,
        lastCheckpointAt: now,
      },
      action: 'updated',
    };
  }

  // 5. If 5 minutes elapsed (window expired), create Version N+1
  const versionNum = versions.length + 1;
  const vNext: StructuredVersionEntry<T> = {
    id: `v_${now}_${versionNum}`,
    label: `Version ${versionNum}`,
    snapshot: deepCloneSnapshot(nextSnapshot),
    savedAt: now,
    windowStartedAt: now,
    lastUpdatedAt: now,
  };
  const updated = [...versions, vNext];
  if (updated.length > maxAllowed) updated.splice(0, updated.length - maxAllowed);

  return {
    history: {
      ...normHistory,
      versions: updated,
      lastCheckpointAt: now,
    },
    action: 'created',
  };
}

export function shouldCreateCheckpoint<T = any>(
  history: StructuredVersionHistory<T> | undefined | null,
  prevSnapshot: T,
  nextSnapshot: T,
  now: number = Date.now(),
  minIntervalMs: number = VERSION_HISTORY_CHECKPOINT_INTERVAL_MS
): boolean {
  const result = upsertVersionForChange<T>(history, prevSnapshot, nextSnapshot, now, { maxHistorySize: DEFAULT_MAX_HISTORY_SIZE });
  return result.action !== 'none';
}

export function appendCheckpoint<T = any>(
  history: StructuredVersionHistory<T> | undefined | null,
  snapshot: T,
  prevTimestamp?: number,
  now: number = Date.now(),
  maxSize: number = DEFAULT_MAX_HISTORY_SIZE
): StructuredVersionHistory<T> {
  const result = upsertVersionForChange<T>(history, undefined, snapshot, now, { maxHistorySize: maxSize });
  return result.history;
}

export function getSnapshotById<T = any>(
  history: StructuredVersionHistory<T> | undefined | null,
  versionId: string
): T | null {
  if (!history || !Array.isArray(history.versions)) return null;
  const match = history.versions.find(v => v.id === versionId);
  return match ? match.snapshot : null;
}

export const createInitialHistory = createInitialStructuredVersionHistory;
