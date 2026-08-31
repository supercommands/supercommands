import { db } from '../indexDB/dbConfig';

export type DashboardViewGroup = 'work' | 'personal' | 'college';

export const ROLE_TO_DASHBOARD_GROUP = {
  founder: 'work',
  developer: 'work',
  product: 'work',
  design: 'work',
  finance: 'work',
  student: 'college',
  personal: 'personal',
} as const;

export type OnboardingRoleId = keyof typeof ROLE_TO_DASHBOARD_GROUP;

export const DASHBOARD_VIEW_GROUP_LABELS: Record<DashboardViewGroup, string> = {
  work: 'Work',
  personal: 'Personal',
  college: 'College',
};

export const getDashboardViewGroupHeaderId = (group: DashboardViewGroup): string => `header-custom_${group}`;

export const getDashboardViewGroupStorageId = (group: DashboardViewGroup): string => `custom_${group}`;

export interface EnsureDashboardViewGroupInput {
  workspaceId: string;
  group: DashboardViewGroup;
  viewIds: string[];
  preferredViewOrder?: string[];
}

const getChromeStorage = (): any =>
  typeof globalThis !== 'undefined' ? (globalThis as any).chrome?.storage?.local : undefined;

const ENABLE_DASHBOARD_GROUP_PERF_LOGS = false;

const dashboardGroupPerf = (label: string, data?: Record<string, unknown>) => {
  if (!ENABLE_DASHBOARD_GROUP_PERF_LOGS) return;
  console.log('[SidebarPerf][DashboardGroupStorage]', label, JSON.stringify(data || {}));
};

const DASHBOARD_VIEW_RECONCILIATION_STORAGE_KEY = 'dashboard_views_reconciliation_v1';
const DASHBOARD_VIEW_RECONCILIATION_VERSION = 1;
const DASHBOARD_VIEW_RECONCILIATION_MEMORY_KEY_PREFIX = 'cmdos_dashboard_views_reconciliation_v1:';

export interface ReconcileDashboardViewsResult {
  viewIds: string[];
  changed: boolean;
}

const getDashboardViewReconciliationSignature = (
  views: Array<{ id: string; isDefault?: boolean; title?: string; settings?: any }>,
): string =>
  JSON.stringify(
    views
      .map(view => ({
        id: view.id,
        isDefault: Boolean(view.isDefault),
        legacyDefaultTitle: view.title === 'Default',
        source: view.settings?.source || null,
        templateId: view.settings?.templateId || null,
        templateVersion: Number(view.settings?.templateVersion || 0),
        role: view.settings?.role || null,
        viewGroup: view.settings?.viewGroup || null,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  );

const getReconciliationMemoryKey = (workspaceId: string): string =>
  `${DASHBOARD_VIEW_RECONCILIATION_MEMORY_KEY_PREFIX}${workspaceId}`;

const readReconciliationMemorySignature = (workspaceId: string): string | null => {
  try {
    return typeof window !== 'undefined'
      ? window.localStorage.getItem(getReconciliationMemoryKey(workspaceId))
      : null;
  } catch {
    return null;
  }
};

const writeReconciliationMemorySignature = (workspaceId: string, signature: string): void => {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(getReconciliationMemoryKey(workspaceId), signature);
    }
  } catch {
    // Chrome storage remains the persistent fallback when localStorage is unavailable.
  }
};

const summarizeOrder = (order: readonly string[]) => ({
  length: order.length,
  headers: order.filter(id => id.startsWith('header-')).length,
  views: order.filter(id => !id.startsWith('header-')).length,
  firstItems: order.slice(0, 8),
});

export interface NormalizeDashboardViewsOrderInput {
  workspaceId?: string;
  views: Array<{ id: string; isDefault?: boolean; title?: string; settings?: any }>;
  currentOrder: string[];
  customGroupNames?: Record<string, string>;
  visibleItems?: Record<string, boolean>;
  targetRoleHeaderId?: string;
  onboardingViewIds?: string[];
}

export interface NormalizeDashboardViewsOrderResult {
  order: string[];
  customGroupNames: Record<string, string>;
  visibleItems: Record<string, boolean>;
  isChanged: boolean;
}

/**
 * Idempotent, centralized dashboard-order normalization function.
 * Every collection is placed in a named user group. The removed legacy
 * Default group is deliberately discarded from persisted sidebar order.
 */
export function normalizeDashboardViewsOrder({
  views,
  currentOrder = [],
  customGroupNames = {},
  visibleItems = {},
  targetRoleHeaderId,
  onboardingViewIds = [],
}: NormalizeDashboardViewsOrderInput): NormalizeDashboardViewsOrderResult {
  const validViewIds = new Set(views.map(v => v.id));

  const nextNames: Record<string, string> = { ...customGroupNames };
  delete nextNames['custom_default'];
  const defaultView = views.find(v => v.isDefault === true);
  let adjustedOrder = [...currentOrder];
  
  const defaultViewId = defaultView?.id;
  const pHeaderIdx = adjustedOrder.indexOf('header-custom_personal');
  if (pHeaderIdx !== -1) {
    const viewsInPersonal: string[] = [];
    let nextHeaderIdx = pHeaderIdx + 1;
    while (nextHeaderIdx < adjustedOrder.length && !adjustedOrder[nextHeaderIdx].startsWith('header-')) {
      viewsInPersonal.push(adjustedOrder[nextHeaderIdx]);
      nextHeaderIdx++;
    }
    
    for (const viewId of viewsInPersonal) {
      if (viewId !== defaultViewId) {
        const idx = adjustedOrder.indexOf(viewId);
        if (idx !== -1) {
          adjustedOrder.splice(idx, 1);
        }
      }
    }
  }
  
  if (defaultViewId) {
    const currentIdx = adjustedOrder.indexOf(defaultViewId);
    const personalHeaderIdx = adjustedOrder.indexOf('header-custom_personal');
    
    let isUnderPersonal = false;
    if (personalHeaderIdx !== -1 && currentIdx !== -1 && currentIdx > personalHeaderIdx) {
      let hasHeaderBetween = false;
      for (let i = personalHeaderIdx + 1; i < currentIdx; i++) {
        if (adjustedOrder[i].startsWith('header-')) {
          hasHeaderBetween = true;
          break;
        }
      }
      if (!hasHeaderBetween) {
        isUnderPersonal = true;
      }
    }
    
    if (!isUnderPersonal) {
      if (currentIdx !== -1) {
        adjustedOrder.splice(currentIdx, 1);
      }
      
      let targetHeaderIdx = adjustedOrder.indexOf('header-custom_personal');
      if (targetHeaderIdx === -1) {
        adjustedOrder.push('header-custom_personal');
        targetHeaderIdx = adjustedOrder.indexOf('header-custom_personal');
      }
      adjustedOrder.splice(targetHeaderIdx + 1, 0, defaultViewId);
    }
  }

  const sanitizedSeen = new Set<string>();
  const sanitized: string[] = [];

  for (const id of adjustedOrder) {
    if (id === 'header-custom_default') continue;

    if (id.startsWith('header-')) {
      const groupId = id.replace('header-', '');
      if (
        groupId === 'custom_default' ||
        groupId === 'custom_work' ||
        groupId === 'custom_personal' ||
        groupId === 'custom_college' ||
        Boolean(nextNames[groupId]?.trim())
      ) {
        if (!sanitizedSeen.has(id)) {
          sanitizedSeen.add(id);
          sanitized.push(id);
        }
      }
    } else if (validViewIds.has(id)) {
      if (!sanitizedSeen.has(id)) {
        sanitizedSeen.add(id);
        sanitized.push(id);
      }
    }
  }

  // Construct final order
  const seen = new Set<string>();
  const finalOrder: string[] = [];

  // Handle targetRoleHeaderId if provided
  if (targetRoleHeaderId) {
    const groupKey = targetRoleHeaderId.replace('header-', '');
    if (groupKey === 'custom_work' || groupKey === 'work') {
      nextNames['custom_work'] = nextNames['custom_work'] || 'Work';
    } else if (groupKey === 'custom_personal' || groupKey === 'personal') {
      nextNames['custom_personal'] = nextNames['custom_personal'] || 'Personal';
    } else if (groupKey === 'custom_college' || groupKey === 'college') {
      nextNames['custom_college'] = nextNames['custom_college'] || 'College';
    }

    if (!seen.has(targetRoleHeaderId)) {
      finalOrder.push(targetRoleHeaderId);
      seen.add(targetRoleHeaderId);
    }
  }

  // Insert items from sanitized
  for (const item of sanitized) {
    if (!seen.has(item)) {
      finalOrder.push(item);
      seen.add(item);
    }
  }

  // Insert onboardingViewIds under targetRoleHeaderId if provided
  if (targetRoleHeaderId && onboardingViewIds.length > 0) {
    const headerIdx = finalOrder.indexOf(targetRoleHeaderId);
    if (headerIdx !== -1) {
      let insertIdx = headerIdx + 1;
      for (const viewId of onboardingViewIds) {
        if (validViewIds.has(viewId) && !finalOrder.includes(viewId)) {
          finalOrder.splice(insertIdx, 0, viewId);
          seen.add(viewId);
          insertIdx++;
        }
      }
    }
  }

  // Ensure all valid workspace views are present in finalOrder
  for (const view of views) {
    if (!seen.has(view.id)) {
      const role = view.settings?.role;
      const viewGroup = view.settings?.viewGroup;

      // Only place under a role header if the view has an explicit group/role assignment.
      // Views with no explicit assignment are appended at the end (ungrouped) to avoid
      if (viewGroup === 'college') {
        const targetHeader = 'header-custom_college';
        nextNames['custom_college'] = nextNames['custom_college'] || 'College';
        if (!finalOrder.includes(targetHeader)) {
          finalOrder.push(targetHeader);
          seen.add(targetHeader);
        }
        const hIdx = finalOrder.indexOf(targetHeader);
        let insertIdx = hIdx + 1;
        while (insertIdx < finalOrder.length && !finalOrder[insertIdx].startsWith('header-')) insertIdx++;
        finalOrder.splice(insertIdx, 0, view.id);
      } else if (viewGroup === 'personal' || role === 'personal') {
        if (view.id !== defaultViewId) {
          const targetHeader = 'header-custom_work';
          nextNames['custom_work'] = nextNames['custom_work'] || 'Work';
          if (!finalOrder.includes(targetHeader)) {
            finalOrder.push(targetHeader);
            seen.add(targetHeader);
          }
          const hIdx = finalOrder.indexOf(targetHeader);
          let insertIdx = hIdx + 1;
          while (insertIdx < finalOrder.length && !finalOrder[insertIdx].startsWith('header-')) insertIdx++;
          finalOrder.splice(insertIdx, 0, view.id);
        } else {
          const targetHeader = 'header-custom_personal';
          nextNames['custom_personal'] = nextNames['custom_personal'] || 'Personal';
          if (!finalOrder.includes(targetHeader)) {
            finalOrder.push(targetHeader);
            seen.add(targetHeader);
          }
          const hIdx = finalOrder.indexOf(targetHeader);
          let insertIdx = hIdx + 1;
          while (insertIdx < finalOrder.length && !finalOrder[insertIdx].startsWith('header-')) insertIdx++;
          finalOrder.splice(insertIdx, 0, view.id);
        }
      } else if (viewGroup === 'work' || (role && role !== 'student' && role !== 'personal' && role !== 'college')) {
        const targetHeader = 'header-custom_work';
        nextNames['custom_work'] = nextNames['custom_work'] || 'Work';
        if (!finalOrder.includes(targetHeader)) {
          finalOrder.push(targetHeader);
          seen.add(targetHeader);
        }
        const hIdx = finalOrder.indexOf(targetHeader);
        let insertIdx = hIdx + 1;
        while (insertIdx < finalOrder.length && !finalOrder[insertIdx].startsWith('header-')) insertIdx++;
        finalOrder.splice(insertIdx, 0, view.id);
      } else if (view.isDefault === true) {
        // The default view (Main Dashboard) has no explicit group/role.
        // It was previously stored under the now-removed header-custom_default.
        // Always migrate it to Personal so it shows there without the user
        // needing to delete and re-add it.
        const targetHeader = 'header-custom_personal';
        nextNames['custom_personal'] = nextNames['custom_personal'] || 'Personal';
        if (!finalOrder.includes(targetHeader)) {
          finalOrder.push(targetHeader);
          seen.add(targetHeader);
        }
        const hIdx = finalOrder.indexOf(targetHeader);
        let insertIdx = hIdx + 1;
        while (insertIdx < finalOrder.length && !finalOrder[insertIdx].startsWith('header-')) insertIdx++;
        finalOrder.splice(insertIdx, 0, view.id);
      } else {
        // No explicit group — append after the last item in the list (preserve user's implicit ordering)
        finalOrder.push(view.id);
      }
      seen.add(view.id);
    }
  }

  const personalHeaderIndex = finalOrder.indexOf('header-custom_personal');
  if (personalHeaderIndex > 0) {
    let personalBlockEnd = personalHeaderIndex + 1;
    while (personalBlockEnd < finalOrder.length && !finalOrder[personalBlockEnd].startsWith('header-')) {
      personalBlockEnd++;
    }
    const personalBlock = finalOrder.splice(personalHeaderIndex, personalBlockEnd - personalHeaderIndex);
    finalOrder.unshift(...personalBlock);
  }

  // Update visibleItems with nullish assignment
  const nextVisible = { ...visibleItems };
  delete nextVisible['header-custom_default'];
  for (const item of finalOrder) {
    nextVisible[item] ??= true;
  }

  // The default view must always be visible in Personal — force it true
  // only on first migration (when it was not already tracked in the stored order).
  // This ensures it's discoverable after being moved out of the deleted Default group.
  if (defaultView) {
    const wasAlreadyInOrder = currentOrder.includes(defaultView.id);
    if (!wasAlreadyInOrder) {
      nextVisible[defaultView.id] = true;
    }
  }
  const isOrderEqual =
    currentOrder.length === finalOrder.length && currentOrder.every((val, idx) => val === finalOrder[idx]);
  const isNamesEqual = JSON.stringify(customGroupNames) === JSON.stringify(nextNames);
  const isVisibleEqual = JSON.stringify(visibleItems) === JSON.stringify(nextVisible);
  const isChanged = !isOrderEqual || !isNamesEqual || !isVisibleEqual;

  return {
    order: finalOrder,
    customGroupNames: nextNames,
    visibleItems: nextVisible,
    isChanged,
  };
}

export async function ensureDashboardViewsInGroup({
  workspaceId,
  group,
  viewIds,
  preferredViewOrder = [],
}: EnsureDashboardViewGroupInput): Promise<void> {
  if (!workspaceId) return;

  const storage = getChromeStorage();
  if (!storage) return;

  const storageData = await new Promise<Record<string, any>>(resolve => {
    storage.get(
      ['dashboard_views_items_order', 'sidebar_view_visible_items', 'customGroupNames'],
      (res: Record<string, any>) => resolve(res || {}),
    );
  });

  const existingOrder: string[] = storageData.dashboard_views_items_order || [];
  const visibleItems: Record<string, boolean> = storageData.sidebar_view_visible_items || {};
  const customGroupNames: Record<string, string> = storageData.customGroupNames || {};

  const workspaceViews = await db.widgetViews.where('workspaceId').equals(workspaceId).toArray();
  const targetHeaderId = getDashboardViewGroupHeaderId(group);

  const normalized = normalizeDashboardViewsOrder({
    workspaceId,
    views: workspaceViews,
    currentOrder: existingOrder,
    customGroupNames,
    visibleItems,
    targetRoleHeaderId: targetHeaderId,
    onboardingViewIds: viewIds,
  });

  dashboardGroupPerf('ensure-group:save-order', {
    workspaceId,
    group,
    viewIds,
    changed: normalized.isChanged,
    previous: summarizeOrder(existingOrder),
    next: summarizeOrder(normalized.order),
  });

  await new Promise<void>(resolve => {
    storage.set(
      {
        dashboard_views_items_order: normalized.order,
        sidebar_view_visible_items: normalized.visibleItems,
        customGroupNames: normalized.customGroupNames,
      },
      () => resolve(),
    );
  });
}

export async function reconcileExistingOnboardingViews(workspaceId: string): Promise<ReconcileDashboardViewsResult> {
  if (!workspaceId) return { viewIds: [], changed: false };

  const startedAt = performance.now();
  dashboardGroupPerf('reconcile:start', { workspaceId });

  let views = await db.widgetViews.where('workspaceId').equals(workspaceId).toArray();
  if (views.length === 0) {
    dashboardGroupPerf('reconcile:skip-no-views', {
      durationMs: Math.round(performance.now() - startedAt),
      workspaceId,
    });
    return { viewIds: [], changed: false };
  }

  const currentSignature = getDashboardViewReconciliationSignature(views);
  if (readReconciliationMemorySignature(workspaceId) === currentSignature) {
    dashboardGroupPerf('reconcile:skip-memory', {
      durationMs: Math.round(performance.now() - startedAt),
      workspaceId,
    });
    return { viewIds: views.map(view => view.id), changed: false };
  }

  const storage = getChromeStorage();
  let existingOrder: string[] = [];
  let visibleItems: Record<string, boolean> = {};
  let customGroupNames: Record<string, string> = {};
  let reconciliationVersions: Record<string, { version: number; signature: string }> = {};

  if (storage) {
    const existingData = await new Promise<Record<string, any>>(resolve => {
      storage.get(
        [
          'dashboard_views_items_order',
          'sidebar_view_visible_items',
          'customGroupNames',
          DASHBOARD_VIEW_RECONCILIATION_STORAGE_KEY,
        ],
        (res: Record<string, any>) => resolve(res || {}),
      );
    });
    existingOrder = existingData?.dashboard_views_items_order || [];
    visibleItems = existingData?.sidebar_view_visible_items || {};
    customGroupNames = existingData?.customGroupNames || {};
    reconciliationVersions = existingData?.[DASHBOARD_VIEW_RECONCILIATION_STORAGE_KEY] || {};
  }

  const completedReconciliation = reconciliationVersions[workspaceId];
  if (
    completedReconciliation?.version === DASHBOARD_VIEW_RECONCILIATION_VERSION &&
    completedReconciliation.signature === currentSignature
  ) {
    writeReconciliationMemorySignature(workspaceId, currentSignature);
    dashboardGroupPerf('reconcile:skip-complete', {
      durationMs: Math.round(performance.now() - startedAt),
      workspaceId,
    });
    return { viewIds: views.map(view => view.id), changed: false };
  }

  let dashboardDataChanged = false;

  const founderTemplateIds = new Set([
    'founder-command-center',
    'build-and-ship',
    'capital-and-runway',
    'team-and-culture',
  ]);

  const onboardingViews = views.filter(
    v =>
      v.settings?.source === 'onboarding' ||
      (v.settings?.templateId && founderTemplateIds.has(v.settings.templateId as string)),
  );

  const onboardingDefaultView = onboardingViews.find(view => view.isDefault);
  const replacementDefaultView = onboardingDefaultView || onboardingViews[0];
  const legacyMainDashboardViews = replacementDefaultView
    ? views.filter(
        view =>
          view.id !== replacementDefaultView.id &&
          view.settings?.source !== 'onboarding' &&
          view.title === 'Main Dashboard',
      )
    : [];

  if (legacyMainDashboardViews.length > 0) {
    dashboardDataChanged = true;
    const legacyIds = legacyMainDashboardViews.map(view => view.id);
    await db.transaction('rw', [db.widgetViews, db.widgets, db.widgetLayouts], async () => {
      for (const legacyId of legacyIds) {
        await db.widgets.where('viewId').equals(legacyId).delete();
        await db.widgetLayouts.where('viewId').equals(legacyId).delete();
        await db.widgetViews.delete(legacyId);
      }
      await db.widgetViews.update(replacementDefaultView.id, {
        isDefault: true,
        updatedAt: Date.now(),
      });
    });
    views = await db.widgetViews.where('workspaceId').equals(workspaceId).toArray();
    existingOrder = existingOrder.filter(id => !legacyIds.includes(id) && id !== 'header-custom_default');
    for (const legacyId of legacyIds) delete visibleItems[legacyId];
    delete visibleItems['header-custom_default'];
    delete customGroupNames['custom_default'];
  }

  const workViewIds: string[] = [];
  const personalViewIds: string[] = [];
  const collegeViewIds: string[] = [];

  for (const view of onboardingViews) {
    let role = (view.settings?.role as OnboardingRoleId) || 'founder';
    if (
      !view.settings?.role &&
      view.settings?.templateId &&
      founderTemplateIds.has(view.settings.templateId as string)
    ) {
      role = 'founder';
    }

    const shouldMigrateLegacyDefaultTitle =
      view.settings?.source === 'onboarding' &&
      Number(view.settings?.templateVersion || 0) < 6 &&
      view.title === 'Default';
    const group: DashboardViewGroup =
      (view.settings?.viewGroup as DashboardViewGroup) || ROLE_TO_DASHBOARD_GROUP[role] || 'work';

    // The template ID is the permanent identity. Only migrate the old generated
    // title once; after that, preserve any name the user chooses.
    const migratedTitle = shouldMigrateLegacyDefaultTitle ? 'Main Dashboard' : view.title;
    if (view.settings?.viewGroup !== group || view.settings?.role !== role || view.title !== migratedTitle) {
      dashboardDataChanged = true;
      await db.widgetViews.update(view.id, {
        title: migratedTitle,
        settings: {
          ...view.settings,
          role,
          viewGroup: group,
        },
        updatedAt: Date.now(),
      });
    }

    if (shouldMigrateLegacyDefaultTitle) {
      dashboardDataChanged = true;
      const entityIds = (view.settings?.onboardingEntityIds || {}) as Record<string, string>;
      const now = Date.now();
      const note = entityIds.noteId ? await db.notes.get(entityIds.noteId) : undefined;

      await Promise.all([
        entityIds.noteId
          ? db.notes.update(entityIds.noteId, {
              title: 'Main Dashboard Notes',
              ...(note?.body?.startsWith('# Default Notes')
                ? { body: note.body.replace(/^# Default Notes/, '# Main Dashboard Notes') }
                : {}),
              updatedAt: now,
            })
          : Promise.resolve(),
        entityIds.sessionId
          ? db.sessions.update(entityIds.sessionId, { title: 'Main Dashboard', updatedAt: now })
          : Promise.resolve(),
        entityIds.linkId
          ? db.links.update(entityIds.linkId, { title: 'Main Dashboard Links', updatedAt: now })
          : Promise.resolve(),
      ]);

      await db.widgets.where('viewId').equals(view.id).modify(widget => {
        if (widget.type === 'note-library') widget.title = 'Main Dashboard Notes';
        if (widget.type === 'session-item') widget.title = 'Main Dashboard';
        if (widget.type === 'link-library') widget.title = 'Main Dashboard Links';
        widget.updatedAt = now;
      });

      const existingShortcut = await db.userShortcuts.where('referenceId').equals(view.id).first();
      if (existingShortcut?.trigger === 'default') {
        const shortcutConflict = await db.userShortcuts.where('trigger').equals('maindashboard').first();
        if (!shortcutConflict || shortcutConflict.id === existingShortcut.id) {
          await db.userShortcuts.update(existingShortcut.id, { trigger: 'maindashboard', updatedAt: now });
        }
      }
    }

    if (group === 'personal') {
      personalViewIds.push(view.id);
    } else if (group === 'college') {
      collegeViewIds.push(view.id);
    } else {
      workViewIds.push(view.id);
    }
  }

  let normalized = normalizeDashboardViewsOrder({
    workspaceId,
    views,
    currentOrder: existingOrder,
    customGroupNames,
    visibleItems,
  });
  let anyGroupChanged = normalized.isChanged;

  const groupedViewIds: Array<[DashboardViewGroup, string[]]> = [
    ['work', workViewIds],
    ['college', collegeViewIds],
    ['personal', personalViewIds],
  ];

  for (const [group, viewIds] of groupedViewIds) {
    if (viewIds.length === 0) continue;
    const next = normalizeDashboardViewsOrder({
      workspaceId,
      views,
      currentOrder: normalized.order,
      customGroupNames: normalized.customGroupNames,
      visibleItems: normalized.visibleItems,
      targetRoleHeaderId: getDashboardViewGroupHeaderId(group),
      onboardingViewIds: viewIds,
    });
    anyGroupChanged = anyGroupChanged || next.isChanged;
    normalized = next;
  }

  normalized = { ...normalized, isChanged: anyGroupChanged };

  const changed = dashboardDataChanged || normalized.isChanged;
  const refreshedViews = dashboardDataChanged
    ? await db.widgetViews.where('workspaceId').equals(workspaceId).toArray()
    : views;
  const nextReconciliationVersions = {
    ...reconciliationVersions,
    [workspaceId]: {
      version: DASHBOARD_VIEW_RECONCILIATION_VERSION,
      signature: getDashboardViewReconciliationSignature(refreshedViews),
    },
  };

  if (storage) {
    dashboardGroupPerf('reconcile:save', {
      durationMs: Math.round(performance.now() - startedAt),
      workspaceId,
      changed,
      viewCount: views.length,
      onboardingViewCount: onboardingViews.length,
      previous: summarizeOrder(existingOrder),
      next: summarizeOrder(normalized.order),
    });
    await new Promise<void>(resolve => {
      storage.set(
        {
          dashboard_views_items_order: normalized.order,
          sidebar_view_visible_items: normalized.visibleItems,
          customGroupNames: normalized.customGroupNames,
          [DASHBOARD_VIEW_RECONCILIATION_STORAGE_KEY]: nextReconciliationVersions,
        },
        () => resolve(),
      );
    });
  }

  writeReconciliationMemorySignature(
    workspaceId,
    nextReconciliationVersions[workspaceId].signature,
  );

  dashboardGroupPerf('reconcile:done', {
    durationMs: Math.round(performance.now() - startedAt),
    workspaceId,
    changed,
    viewCount: views.length,
    onboardingViewCount: onboardingViews.length,
  });

  return {
    viewIds: [...workViewIds, ...personalViewIds, ...collegeViewIds],
    changed,
  };
}
