import type { ActiveSessionEntry } from './index';
import type { LinkItem } from '../../../../src/allObjectFolder/src/createObject/links/linkTypes';
import { getSessionLaunchPacing } from './sessionLaunchPacing';

export type FocusLaunchItem = {
  id: string;
  url: string;
  savedUrl?: string;
  legacyIndex?: number;
  title: string;
  favIconUrl?: string;
  tabId?: number;
  tier: 'hot' | 'warm' | 'cold';
  autoOpened?: boolean;
  openedAt?: number;
  userActivated?: boolean;
  loadStatus?: 'idle' | 'loading' | 'ready' | 'stalled' | 'error';
};

export function mergeFocusItemsWithSaved(
  savedUrls: LinkItem[],
  runtimeItems: FocusLaunchItem[],
  removedItemIds: string[],
): { urls: LinkItem[]; changed: boolean } {
  const byId = new Map(runtimeItems.map(item => [item.id, item]));
  const byLegacyIndex = new Map(runtimeItems
    .filter(item => typeof item.legacyIndex === 'number')
    .map(item => [item.legacyIndex!, item]));
  const removed = new Set(removedItemIds);
  const existingIds = new Set(savedUrls.map(item => item.id));
  byLegacyIndex.forEach(item => existingIds.add(item.id));
  const urls = savedUrls
    .map((item, index) => ({ item, index }))
    .filter(({ item, index }) => !removed.has(item.id) && !removed.has(byLegacyIndex.get(index)?.id || ''))
    .map(({ item, index }) => {
      const runtime = byId.get(item.id) || byLegacyIndex.get(index);
      return runtime && runtime.savedUrl !== undefined && runtime.url !== runtime.savedUrl
        ? { ...item, id: runtime.id, url: runtime.url, title: runtime.title }
        : runtime && !item.id ? { ...item, id: runtime.id } : item;
    });
  for (const item of runtimeItems) {
    if (existingIds.has(item.id) || removed.has(item.id)) continue;
    urls.push({ id: item.id, url: item.url, title: item.title, source: 'tab', favIconUrl: item.favIconUrl });
  }
  const changed = urls.length !== savedUrls.length || urls.some((item, index) =>
    item.id !== savedUrls[index]?.id || item.url !== savedUrls[index]?.url,
  );
  return { urls, changed };
}

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;
const MIN_WARM_TAB_COST = 128 * MIB;
const MAX_MEMORY_DROP_SAMPLES = 3;
// Observe memory after each wave while counting still-loading tabs as pending memory.
const FOCUS_BATCH_OBSERVATION_MS = 500;
// The final wave has no next-wave check, so keep a longer last observation.
const FOCUS_FINAL_BATCH_OBSERVATION_MS = 800;
// Focus alone starts the next wave sooner than the shared non-Focus pacing.
const FOCUS_BATCH_DELAY_REDUCTION_MS = 300;
const focusMemoryDrops: number[] = [];
const focusPageCostSamples: number[] = [];
let focusBatchTail: Promise<unknown> = Promise.resolve();
let activeFocusLaunches = 0;

const readMemory = async (): Promise<{ capacity: number; availableCapacity: number } | null> => {
  try {
    const info = await chrome.system?.memory?.getInfo();
    if (!info || !Number.isFinite(info.capacity) || !Number.isFinite(info.availableCapacity)) return null;
    if (info.capacity <= 0 || info.availableCapacity < 0 || info.availableCapacity > info.capacity) return null;
    return info;
  } catch {
    return null;
  }
};

export const getFocusMemoryBoundaries = (capacity: number) => ({
  hot: Math.max(GIB, capacity * 0.15),
  warm: Math.max(768 * MIB, capacity * 0.1),
});

export const getWarmLaunchBudget = (initialAvailable: number, capacity: number) => {
  const { hot, warm } = getFocusMemoryBoundaries(capacity);
  return Math.max(0, Math.min(initialAvailable - warm, hot - warm));
};

const getNextBatchAllowance = () => Math.max(256 * MIB, 1.5 * Math.max(0, ...focusMemoryDrops));
const getEstimatedWarmTabCost = () => Math.max(MIN_WARM_TAB_COST, ...focusPageCostSamples);
const getUnrealizedLoadReserve = (outstanding: number) =>
  outstanding * Math.max(0, MIN_WARM_TAB_COST - Math.max(0, ...focusPageCostSamples));

export const getRemainingFocusBatchDelay = (delayMs: number, startedAt: number, now = Date.now()) =>
  Math.max(0, delayMs - Math.max(0, now - startedAt));

const runExclusiveBatch = async <T>(callback: () => Promise<T>): Promise<T> => {
  const result = focusBatchTail.then(callback, callback);
  focusBatchTail = result.catch(() => undefined);
  return result;
};

const countOutstandingLoads = async (items: FocusLaunchItem[]): Promise<number> => {
  const tabs = await Promise.all(items
    .filter(item => item.autoOpened && item.tabId && item.tier === 'hot')
    .map(item => chrome.tabs.get(item.tabId!).catch(() => null)));
  return tabs.filter(tab => tab && !tab.discarded && tab.status === 'loading').length;
};

export async function launchFocusItems({
  session,
  items,
  shouldContinue,
  onTabCreated,
  onChange,
  onTrace,
  getReclaimCandidates,
  matchesExistingTab,
}: {
  session: ActiveSessionEntry;
  items: FocusLaunchItem[];
  shouldContinue: () => boolean;
  onTabCreated: (tab: chrome.tabs.Tab, item: FocusLaunchItem) => void;
  onChange: () => void;
  onTrace?: (event: string, details: Record<string, unknown>) => void;
  getReclaimCandidates: () => FocusLaunchItem[];
  matchesExistingTab?: (url: string, tab: chrome.tabs.Tab) => boolean;
}): Promise<void> {
  const trace = (event: string, details: Record<string, unknown> = {}) => onTrace?.(event, details);
  if (activeFocusLaunches === 0) {
    focusMemoryDrops.length = 0;
    focusPageCostSamples.length = 0;
  }
  activeFocusLaunches++;
  try {
    const existingTabs = await chrome.tabs.query({ windowId: session.windowId }).catch(() => []);
    const usedExistingTabIds = new Set<number>();
    for (const item of items) {
      const existing = existingTabs.find(tab =>
        typeof tab.id === 'number' && tab.id !== session.pinnedTabId &&
        !usedExistingTabIds.has(tab.id) && (matchesExistingTab?.(item.url, tab) ?? (tab.pendingUrl || tab.url) === item.url),
      );
      if (!existing?.id) continue;
      usedExistingTabIds.add(existing.id);
      item.tabId = existing.id;
      item.tier = existing.discarded ? 'warm' : 'hot';
    }
    onChange();
    const remainingItems = items.filter(item => !item.tabId);
    const pacing = getSessionLaunchPacing(remainingItems.length);
    const focusBatchDelayMs = Math.max(0, pacing.delayMs - FOCUS_BATCH_DELAY_REDUCTION_MS);
    const initialMemory = await runExclusiveBatch(readMemory);
    if (!initialMemory) {
      trace('memory unavailable; destinations remain cold', { remaining: remainingItems.length });
      return;
    }
    const { hot: hotFloor, warm: warmFloor } = getFocusMemoryBoundaries(initialMemory.capacity);
    const warmBudget = getWarmLaunchBudget(initialMemory.availableCapacity, initialMemory.capacity);
    trace('launch budget', {
      totalItems: items.length,
      reused: items.length - remainingItems.length,
      capacityMiB: Math.round(initialMemory.capacity / MIB),
      availableMiB: Math.round(initialMemory.availableCapacity / MIB),
      availablePercent: Math.round(initialMemory.availableCapacity / initialMemory.capacity * 1000) / 10,
      hotFloorMiB: Math.round(hotFloor / MIB),
      warmFloorMiB: Math.round(warmFloor / MIB),
      warmBudgetMiB: Math.round(warmBudget / MIB),
      firstBatch: pacing.immediateCount,
      laterBatch: pacing.batchSize,
      batchDelayMs: focusBatchDelayMs,
      observationMs: FOCUS_BATCH_OBSERVATION_MS,
    });
    let nextIndex = 0;
    let hotStoppedByPressure = false;
    while (nextIndex < remainingItems.length && shouldContinue()) {
      const waveStartedAt = Date.now();
      const waveSize = nextIndex === 0 ? pacing.immediateCount : pacing.batchSize;
      const batch = remainingItems.slice(nextIndex, nextIndex + waveSize);
      const observationMs = nextIndex + batch.length >= remainingItems.length
        ? FOCUS_FINAL_BATCH_OBSERVATION_MS
        : FOCUS_BATCH_OBSERVATION_MS;
      const result = await runExclusiveBatch(async (): Promise<{ processed: number; reason: 'continue' | 'pressure' | 'unavailable' | 'cancelled' }> => {
        let processed = 0;
        if (!shouldContinue()) return { processed, reason: 'cancelled' };
        const before = await readMemory();
        if (!before) return { processed, reason: 'unavailable' };
        if (before.availableCapacity <= hotFloor + getNextBatchAllowance()) {
          trace('hot boundary before batch', {
            availableMiB: Math.round(before.availableCapacity / MIB),
            requiredMiB: Math.round((hotFloor + getNextBatchAllowance()) / MIB),
          });
          return { processed, reason: 'pressure' };
        }
        const outstanding = await countOutstandingLoads(getReclaimCandidates());
        const pendingReserve = getUnrealizedLoadReserve(outstanding);
        if (before.availableCapacity - pendingReserve <= hotFloor + getNextBatchAllowance()) {
          trace('hot outstanding-memory guard', {
            outstanding,
            pendingReserveMiB: Math.round(pendingReserve / MIB),
            availableMiB: Math.round(before.availableCapacity / MIB),
          });
          return { processed, reason: 'pressure' };
        }

        for (const item of batch) {
          if (!shouldContinue()) return { processed, reason: 'cancelled' };
          const beforeItem = await readMemory();
          if (!beforeItem) return { processed, reason: 'unavailable' };
          const outstandingItem = await countOutstandingLoads(getReclaimCandidates());
          const pendingItemReserve = getUnrealizedLoadReserve(outstandingItem);
          if (beforeItem.availableCapacity - pendingItemReserve <= hotFloor + getEstimatedWarmTabCost()) {
            trace('hot boundary before item', {
              availableMiB: Math.round(beforeItem.availableCapacity / MIB),
              outstanding: outstandingItem,
              pendingReserveMiB: Math.round(pendingItemReserve / MIB),
              requiredMiB: Math.round((hotFloor + getEstimatedWarmTabCost()) / MIB),
            });
            return { processed, reason: 'pressure' };
          }
          const tab = await chrome.tabs.create({ windowId: session.windowId, url: item.url, active: false }).catch(() => null);
          if (!shouldContinue()) {
            if (tab?.id) await chrome.tabs.remove(tab.id).catch(() => {});
            return { processed, reason: 'cancelled' };
          }
          processed++;
          if (!tab?.id) {
            item.loadStatus = 'error';
            continue;
          }
          item.tabId = tab.id;
          item.tier = 'hot';
          item.autoOpened = true;
          item.openedAt = Date.now();
          item.loadStatus = 'loading';
          onTabCreated(tab, item);
          onChange();
        }
        if (!shouldContinue()) return { processed, reason: 'cancelled' };
        await new Promise(resolve => setTimeout(resolve, observationMs));
        await Promise.all(batch.map(async item => {
          if (!item.tabId || item.loadStatus !== 'loading') return;
          const tab = await chrome.tabs.get(item.tabId).catch(() => null);
          if (!tab) item.loadStatus = 'error';
          else if (tab.status === 'complete') item.loadStatus = 'ready';
        }));
        onChange();
        const after = await readMemory();
        if (!after) return { processed, reason: 'unavailable' };
        const drop = Math.max(0, before.availableCapacity - after.availableCapacity);
        focusMemoryDrops.push(drop);
        if (focusMemoryDrops.length > MAX_MEMORY_DROP_SAMPLES) focusMemoryDrops.shift();
        if (processed > 0) {
          focusPageCostSamples.push(drop / processed);
          if (focusPageCostSamples.length > MAX_MEMORY_DROP_SAMPLES) focusPageCostSamples.shift();
        }
        trace('hot batch completed', {
          processed,
          availableBeforeMiB: Math.round(before.availableCapacity / MIB),
          availableAfterMiB: Math.round(after.availableCapacity / MIB),
          availableAfterPercent: Math.round(after.availableCapacity / after.capacity * 1000) / 10,
          observedDropMiB: Math.round(drop / MIB),
          nextAllowanceMiB: Math.round(getNextBatchAllowance() / MIB),
        });
        return { processed, reason: after.availableCapacity <= hotFloor + getNextBatchAllowance() ? 'pressure' : 'continue' };
      });
      nextIndex += result.processed;
      if (result.reason !== 'continue') {
        trace('hot phase stopped', { reason: result.reason, openedOrAttempted: nextIndex, remaining: remainingItems.length - nextIndex });
        hotStoppedByPressure = result.reason === 'pressure';
        break;
      }
      if (nextIndex < remainingItems.length && focusBatchDelayMs > 0) {
        const remainingDelay = getRemainingFocusBatchDelay(focusBatchDelayMs, waveStartedAt);
        if (remainingDelay > 0) await new Promise(resolve => setTimeout(resolve, remainingDelay));
      }
    }

    if (!shouldContinue() || !hotStoppedByPressure) return;
    const reclaimToWarmBoundary = async () => runExclusiveBatch(async () => {
      let reclaimed = 0;
      const candidates = getReclaimCandidates()
        .filter(item => item.autoOpened && !item.userActivated && item.tier === 'hot' && item.tabId)
        .sort((left, right) => (left.openedAt || 0) - (right.openedAt || 0));
      for (const item of candidates) {
        if (!shouldContinue()) break;
        const before = await readMemory();
        if (!before || before.availableCapacity > warmFloor + getEstimatedWarmTabCost()) break;
        if (!/^https?:\/\//i.test(item.url)) continue;
        const tab = await chrome.tabs.get(item.tabId!).catch(() => null);
        if (!tab || tab.active || tab.pinned || tab.audible || tab.discarded || tab.autoDiscardable === false ||
          (tab.pendingUrl || tab.url) !== item.url) continue;
        const discarded = await chrome.tabs.discard(tab.id).catch(() => undefined);
        const confirmed = discarded?.discarded === true ||
          (await chrome.tabs.get(tab.id).catch(() => null))?.discarded === true;
        if (!confirmed) continue;
        item.tier = 'warm';
        item.loadStatus = 'idle';
        reclaimed++;
        onChange();
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      if (reclaimed > 0) trace('reclaimed hot tabs', { reclaimed });
    });
    await reclaimToWarmBoundary();

    let warmSpent = 0;
    while (nextIndex < remainingItems.length && shouldContinue()) {
      const item = remainingItems[nextIndex];
      const result = await runExclusiveBatch(async (): Promise<{ cost: number; processed: boolean; continueWarm: boolean }> => {
        const estimate = getEstimatedWarmTabCost();
        if (!shouldContinue() || warmSpent + estimate > warmBudget || !/^https?:\/\//i.test(item.url)) {
          trace('warm phase stopped before create', {
            reason: !shouldContinue() ? 'cancelled' : warmSpent + estimate > warmBudget ? 'budget' : 'non-http-url',
            spentMiB: Math.round(warmSpent / MIB),
            estimateMiB: Math.round(estimate / MIB),
            budgetMiB: Math.round(warmBudget / MIB),
          });
          return { cost: 0, processed: false, continueWarm: false };
        }
        const before = await readMemory();
        if (!before || before.availableCapacity <= warmFloor + estimate) {
          trace('warm phase stopped at memory boundary', {
            availableMiB: before ? Math.round(before.availableCapacity / MIB) : null,
            requiredMiB: Math.round((warmFloor + estimate) / MIB),
          });
          return { cost: 0, processed: false, continueWarm: false };
        }
        const outstanding = await countOutstandingLoads(getReclaimCandidates());
        const pendingReserve = getUnrealizedLoadReserve(outstanding);
        if (before.availableCapacity - pendingReserve <= warmFloor + estimate) {
          trace('warm outstanding-memory guard', {
            outstanding,
            pendingReserveMiB: Math.round(pendingReserve / MIB),
            availableMiB: Math.round(before.availableCapacity / MIB),
          });
          return { cost: 0, processed: false, continueWarm: false };
        }
        const tab = await chrome.tabs.create({ windowId: session.windowId, url: item.url, active: false }).catch(() => null);
        if (!tab?.id) {
          trace('warm tab create failed');
          item.loadStatus = 'error';
          return { cost: 0, processed: false, continueWarm: false };
        }
        if (!shouldContinue()) {
          await chrome.tabs.remove(tab.id).catch(() => {});
          return { cost: 0, processed: false, continueWarm: false };
        }
        item.tabId = tab.id;
        item.tier = 'hot';
        item.autoOpened = true;
        item.openedAt = Date.now();
        item.loadStatus = 'loading';
        onTabCreated(tab, item);
        onChange();
        await new Promise(resolve => setTimeout(resolve, 250));
        if (!shouldContinue()) {
          item.loadStatus = 'loading';
          onChange();
          return { cost: estimate, processed: true, continueWarm: false };
        }
        const afterCreate = await readMemory();
        const cost = Math.max(estimate,
          afterCreate ? Math.max(0, before.availableCapacity - afterCreate.availableCapacity) : estimate);
        const current = await chrome.tabs.get(tab.id).catch(() => null);
        if (!current || current.active || current.pinned || current.audible || current.autoDiscardable === false ||
          item.userActivated || (current.pendingUrl || current.url) !== item.url) {
          trace('warm candidate protected or changed', { tabId: tab.id, tabPresent: Boolean(current) });
          item.loadStatus = current?.status === 'complete' ? 'ready' : 'loading';
          onChange();
          return { cost, processed: true, continueWarm: false };
        }
        const discarded = await chrome.tabs.discard(tab.id).catch(() => undefined);
        const confirmed = discarded?.discarded === true ||
          (await chrome.tabs.get(tab.id).catch(() => null))?.discarded === true;
        if (!confirmed) {
          trace('native discard failed', { tabId: tab.id });
          item.loadStatus = current.status === 'complete' ? 'ready' : 'loading';
          onChange();
          return { cost, processed: true, continueWarm: false };
        }
        item.tier = 'warm';
        item.loadStatus = 'idle';
        trace('warm tab discarded', { tabId: tab.id, costMiB: Math.round(cost / MIB) });
        onChange();
        const afterDiscard = await readMemory();
        return { cost, processed: true, continueWarm: Boolean(afterDiscard && afterDiscard.availableCapacity > warmFloor + getEstimatedWarmTabCost()) };
      });
      warmSpent += result.cost;
      if (result.processed) nextIndex++;
      if (!result.continueWarm) break;
    }
    await reclaimToWarmBoundary();
    onChange();
  } finally {
    trace('launch settled', {
      hot: items.filter(item => item.tier === 'hot').length,
      warm: items.filter(item => item.tier === 'warm').length,
      cold: items.filter(item => item.tier === 'cold').length,
      stillActive: shouldContinue(),
    });
    activeFocusLaunches--;
  }
}
