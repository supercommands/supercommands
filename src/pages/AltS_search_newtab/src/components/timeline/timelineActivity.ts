export type TimelineKind = 'note' | 'link' | 'todo' | 'snippet' | 'aiPrompt' | 'collection' | 'collectionItem';

export interface TimelineOpen {
    kind: TimelineKind;
    id: string;
    openedAt: number;
}

const STORAGE_KEY = 'supercommands.timeline.recentOpens.v2';
const LEGACY_STORAGE_KEY = 'supercommands.timeline.recentOpens.v1';
const ACTIVE_DAYS = 5;
export const TIMELINE_ACTIVITY_EVENT = 'supercommands:timeline-activity';

const isTimelineKind = (value: unknown): value is TimelineKind =>
    ['note', 'link', 'todo', 'snippet', 'aiPrompt', 'collection', 'collectionItem'].includes(String(value));

export const timelineKey = (kind: TimelineKind, id: string) => `${kind}:${id}`;

/** Use local calendar dates so days with no opens never consume a history slot. */
const localDayKey = (timestamp: number): string => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

/** Keep the latest open for each item on each of the five most recent active days. */
const normalizeHistory = (stored: unknown, now: number): TimelineOpen[] => {
    const byItemAndDay = new Map<string, TimelineOpen>();
    if (Array.isArray(stored)) for (const value of stored) {
        if (!isTimelineKind(value?.kind) || typeof value?.id !== 'string' || !value.id ||
            !Number.isFinite(value?.openedAt) || value.openedAt <= 0 || value.openedAt > now) continue;
        const key = `${localDayKey(value.openedAt)}:${timelineKey(value.kind, value.id)}`;
        if ((byItemAndDay.get(key)?.openedAt || 0) < value.openedAt) byItemAndDay.set(key, {
            kind: value.kind, id: value.id, openedAt: value.openedAt,
        });
    }
    const sorted = [...byItemAndDay.values()].sort((a, b) => b.openedAt - a.openedAt);
    const activeDays = new Set<string>();
    return sorted.filter(open => {
        const day = localDayKey(open.openedAt);
        if (!activeDays.has(day) && activeDays.size >= ACTIVE_DAYS) return false;
        activeDays.add(day);
        return true;
    });
};

const readHistory = (now: number): TimelineOpen[] => {
    const current = localStorage.getItem(STORAGE_KEY);
    // A missing v2 cache is the only migration case. An empty v2 cache is authoritative.
    const stored = JSON.parse(current ?? localStorage.getItem(LEGACY_STORAGE_KEY) ?? '[]');
    const history = normalizeHistory(stored, now);
    if (current === null || JSON.stringify(stored) !== JSON.stringify(history)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    }
    return history;
};

export function readRecentOpens(now = Date.now()): TimelineOpen[] {
    try {
        const byItem = new Map<string, TimelineOpen>();
        for (const open of readHistory(now)) {
            const key = timelineKey(open.kind, open.id);
            if (!byItem.has(key)) byItem.set(key, open);
        }
        return [...byItem.values()];
    } catch {
        return [];
    }
}

export function recordTimelineOpen(kind: TimelineKind, id: string): void {
    if (!id || id === 'new' || id === 'todo-create') return;
    const now = Date.now();
    try {
        const next = normalizeHistory([...readHistory(now), { kind, id, openedAt: now }], now);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event(TIMELINE_ACTIVITY_EVENT));
    } catch {
        // Timeline history is a cache; opening an item must still succeed if storage is unavailable.
    }
}
