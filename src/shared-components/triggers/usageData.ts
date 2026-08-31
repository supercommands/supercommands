import { db } from '../../storage/indexDB/dbConfig';
import { generateEntityId } from '../utils';
import { extractSnippetIdFromCompoundId } from '../utils/idGenerator';
import type {
  DailyUsageGridItem,
  DayUsageDetails,
  RecordAssignedTriggerUsageInput,
  TriggerDailyBreakdownRecord,
  TriggerDailySummaryRecord,
} from './types';

const DEFAULT_USER = 'local_user';
const recentCorrelationIds = new Map<string, number>();
const CORRELATION_TTL_MS = 15000;

export const getLocalDateKey = (timestamp: number = Date.now()): string => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const normalizeTrackedShortcut = (value: string): string =>
  String(value || '')
    .trim()
    .replace(/^\/+/, '')
    .toLowerCase();

export const normalizeTrackedHotkey = (value: string): string => String(value || '').trim();

export const extractUrlHost = (url?: string): string => {
  if (!url && typeof window !== 'undefined') url = window.location?.href;
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'chrome-extension:' || parsed.protocol === 'chrome:') return parsed.protocol.replace(':', '');
    return parsed.hostname;
  } catch {
    return '';
  }
};

const cleanupCorrelationIds = (now: number) => {
  recentCorrelationIds.forEach((createdAt, id) => {
    if (now - createdAt > CORRELATION_TTL_MS) recentCorrelationIds.delete(id);
  });
};

const makeBreakdownId = (input: RecordAssignedTriggerUsageInput, dateKey: string) => {
  const source = [
    input.userId || DEFAULT_USER,
    dateKey,
    input.triggerKind,
    input.triggerValue,
    input.triggerSource,
    input.referenceType,
    input.referenceId,
  ]
    .map(value => encodeURIComponent(String(value || 'none')))
    .join('__');
  return `trigger_breakdown_${source}`;
};

const looksLikeRawReferenceId = (value: string, referenceId: string) => {
  const normalized = value.trim();
  if (!normalized) return true;
  if (normalized === referenceId) return true;
  return /^(workspace|folder|note|snippet|link|collection|automation|module|todo|prompt|aiPrompt)_/i.test(normalized);
};

const getReadableReferenceFallback = (referenceType: string, referenceId: string) => {
  const typeLabel = String(referenceType || 'item')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());

  return typeLabel || referenceId;
};

const getEntityLabel = (entity: any) =>
  entity?.title || entity?.name || entity?.label || entity?.key || entity?.displayName || entity?.url || entity?.id || '';

const resolveCurrentTargetLabel = async (row: TriggerDailyBreakdownRecord) => {
  const currentSnapshot = String(row.targetLabelSnapshot || '').trim();
  if (!looksLikeRawReferenceId(currentSnapshot, row.referenceId)) return currentSnapshot;

  const lookupIds = Array.from(new Set([row.referenceId, extractSnippetIdFromCompoundId(row.referenceId)].filter(Boolean)));
  const lookup = async (table: any) => {
    for (const id of lookupIds) {
      const entity = await table.get(id);
      const label = getEntityLabel(entity);
      if (label && !looksLikeRawReferenceId(String(label), row.referenceId)) return String(label);
    }
    return '';
  };

  const referenceType = String(row.referenceType || '').toLowerCase();
  if (referenceType === 'note') return (await lookup(db.notes)) || getReadableReferenceFallback(row.referenceType, row.referenceId);
  if (referenceType === 'link') return (await lookup(db.links)) || getReadableReferenceFallback(row.referenceType, row.referenceId);
  if (referenceType === 'snippet') return (await lookup(db.snippets)) || getReadableReferenceFallback(row.referenceType, row.referenceId);
  if (referenceType === 'collection') return (await lookup(db.widgetViews)) || getReadableReferenceFallback(row.referenceType, row.referenceId);
  if (referenceType === 'automation') return (await lookup(db.automations)) || getReadableReferenceFallback(row.referenceType, row.referenceId);
  if (referenceType === 'aiprompt' || referenceType === 'prompt') {
    return (await lookup(db.aiPrompts)) || getReadableReferenceFallback(row.referenceType, row.referenceId);
  }
  if (referenceType === 'todo') return (await lookup(db.todos)) || getReadableReferenceFallback(row.referenceType, row.referenceId);
  if (referenceType === 'command') return (await lookup(db.commands)) || getReadableReferenceFallback(row.referenceType, row.referenceId);

  return getReadableReferenceFallback(row.referenceType, row.referenceId);
};

export async function recordAssignedTriggerUsage(input: RecordAssignedTriggerUsageInput): Promise<void> {
  const now = input.timestamp || Date.now();
  if (input.correlationId) {
    cleanupCorrelationIds(now);
    if (recentCorrelationIds.has(input.correlationId)) return;
    recentCorrelationIds.set(input.correlationId, now);
  }

  const userId = input.userId?.trim() || DEFAULT_USER;
  const dateKey = getLocalDateKey(now);
  const success = input.success !== false;
  const urlHost = input.urlHost ?? extractUrlHost(input.url);
  const triggerValue =
    input.triggerKind === 'user_shortcut'
      ? normalizeTrackedShortcut(input.triggerValue)
      : normalizeTrackedHotkey(input.triggerValue);
  if (!triggerValue || !input.referenceId) return;
  const referenceId = String(input.referenceId);
  const providedTargetLabel = String(input.targetLabelSnapshot || '').trim();
  const targetLabelSnapshot = looksLikeRawReferenceId(providedTargetLabel, referenceId)
    ? getReadableReferenceFallback(input.referenceType, referenceId)
    : providedTargetLabel;

  await db.transaction('rw', db.triggerDailySummary, db.triggerDailyBreakdown, async () => {
    const summaryId = `trigger_summary_${userId}_${dateKey}`;
    const existingSummary = await db.triggerDailySummary.get(summaryId);
    const targetIds = new Set(existingSummary?.targetIds || []);
    targetIds.add(String(input.referenceId));

    const summaryPatch: TriggerDailySummaryRecord = {
      id: summaryId,
      dateKey,
      userId,
      shortcutUses:
        (existingSummary?.shortcutUses || 0) + (input.triggerKind === 'user_shortcut' && success ? 1 : 0),
      hotkeyUses: (existingSummary?.hotkeyUses || 0) + (input.triggerKind === 'user_hotkey' && success ? 1 : 0),
      successCount: (existingSummary?.successCount || 0) + (success ? 1 : 0),
      failureCount: (existingSummary?.failureCount || 0) + (success ? 0 : 1),
      uniqueTargets: targetIds.size,
      targetIds: Array.from(targetIds),
      firstUsedAt: existingSummary?.firstUsedAt || now,
      lastUsedAt: now,
      updatedAt: now,
    };
    await db.triggerDailySummary.put(summaryPatch);

    const breakdownId = makeBreakdownId({ ...input, triggerValue, userId, urlHost }, dateKey);
    const existingBreakdown = await db.triggerDailyBreakdown.get(breakdownId);
    const breakdownPatch: TriggerDailyBreakdownRecord = {
      id: breakdownId,
      dateKey,
      userId,
      triggerKind: input.triggerKind,
      triggerValue,
      triggerSource: input.triggerSource,
      referenceId: String(input.referenceId),
      referenceType: input.referenceType,
      targetLabelSnapshot,
      triggerLabelSnapshot: input.triggerLabelSnapshot || triggerValue,
      surface: input.surface,
      urlHost,
      successCount: (existingBreakdown?.successCount || 0) + (success ? 1 : 0),
      failureCount: (existingBreakdown?.failureCount || 0) + (success ? 0 : 1),
      lastErrorCode: success ? existingBreakdown?.lastErrorCode : input.errorCode || 'execution_failed',
      firstUsedAt: existingBreakdown?.firstUsedAt || now,
      lastUsedAt: now,
      updatedAt: now,
    };
    await db.triggerDailyBreakdown.put(breakdownPatch);
  });
}

export async function getDailyUsageGrid(
  startDate: string,
  endDate: string,
  userId: string = DEFAULT_USER,
): Promise<DailyUsageGridItem[]> {
  const rows = await db.triggerDailySummary.where('[userId+dateKey]').between([userId, startDate], [userId, endDate], true, true).toArray();
  const byDate = new Map(rows.map(row => [row.dateKey, row]));
  const days: DailyUsageGridItem[] = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  while (cursor <= end) {
    const date = getLocalDateKey(cursor.getTime());
    const row = byDate.get(date);
    days.push({
      date,
      total: (row?.successCount || 0) + (row?.failureCount || 0),
      hotkeyCount: row?.hotkeyUses || 0,
      textShortcutCount: row?.shortcutUses || 0,
      failureCount: row?.failureCount || 0,
      uniqueTargets: row?.uniqueTargets || 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

export async function getUsageForDay(dateKey: string, userId: string = DEFAULT_USER): Promise<DayUsageDetails> {
  const rows = await db.triggerDailyBreakdown.where('[userId+dateKey]').equals([userId, dateKey]).toArray();
  const enrichedRows = await Promise.all(
    rows.map(async row => ({
      ...row,
      targetLabelSnapshot: await resolveCurrentTargetLabel(row),
    })),
  );
  const groupedRows = Array.from(
    enrichedRows
      .reduce((map, row) => {
        const key = [
          row.dateKey,
          row.userId,
          row.triggerKind,
          row.triggerValue,
          row.triggerSource,
          row.referenceType,
          row.referenceId,
        ].join('__');
        const existing = map.get(key);
        if (!existing) {
          map.set(key, { ...row });
          return map;
        }

        existing.successCount += row.successCount;
        existing.failureCount += row.failureCount;
        existing.firstUsedAt = Math.min(existing.firstUsedAt, row.firstUsedAt);
        existing.lastUsedAt = Math.max(existing.lastUsedAt, row.lastUsedAt);
        existing.updatedAt = Math.max(existing.updatedAt, row.updatedAt);
        existing.lastErrorCode = row.lastErrorCode || existing.lastErrorCode;
        if (!existing.targetLabelSnapshot && row.targetLabelSnapshot) existing.targetLabelSnapshot = row.targetLabelSnapshot;
        if (!existing.triggerLabelSnapshot && row.triggerLabelSnapshot) existing.triggerLabelSnapshot = row.triggerLabelSnapshot;
        if (!existing.urlHost && row.urlHost) existing.urlHost = row.urlHost;
        if (existing.surface === 'background' && row.surface !== 'background') existing.surface = row.surface;
        return map;
      }, new Map<string, TriggerDailyBreakdownRecord>())
      .values(),
  );
  const hotkeyUses = rows
    .filter(row => row.triggerKind === 'user_hotkey')
    .reduce((sum, row) => sum + row.successCount + row.failureCount, 0);
  const shortcutUses = rows
    .filter(row => row.triggerKind === 'user_shortcut')
    .reduce((sum, row) => sum + row.successCount + row.failureCount, 0);
  const failureCount = rows.reduce((sum, row) => sum + row.failureCount, 0);

  return {
    dateKey,
    totalUses: hotkeyUses + shortcutUses,
    hotkeyUses,
    shortcutUses,
    failureCount,
    rows: groupedRows.sort((a, b) => b.successCount + b.failureCount - (a.successCount + a.failureCount)),
  };
}

export async function getUnusedAssignedTriggers(startDate: string, endDate: string, userId: string = DEFAULT_USER) {
  const [hotkeys, shortcuts, usage] = await Promise.all([
    db.userHotkeys.where('userId').equals(userId).toArray(),
    db.userShortcuts.where('userId').equals(userId).toArray(),
    db.triggerDailyBreakdown.where('[userId+dateKey]').between([userId, startDate], [userId, endDate], true, true).toArray(),
  ]);
  const used = new Set(usage.map(row => `${row.triggerKind}:${row.triggerValue}:${row.referenceId}`));
  return {
    hotkeys: hotkeys.filter(row => !used.has(`user_hotkey:${normalizeTrackedHotkey(row.combination)}:${row.referenceId}`)),
    shortcuts: shortcuts.filter(row => !used.has(`user_shortcut:${normalizeTrackedShortcut(row.trigger)}:${row.referenceId}`)),
  };
}

export const makeTriggerCorrelationId = (prefix: string = 'trigger') => `${prefix}_${generateEntityId('usage')}`;
