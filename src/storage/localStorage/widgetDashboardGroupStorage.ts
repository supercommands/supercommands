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
    personal: 'Personal Workspace',
    college: 'College',
};
export const getDashboardViewGroupHeaderId = (group: DashboardViewGroup): string => `header-custom_${group}`;
export const getDashboardViewGroupStorageId = (group: DashboardViewGroup): string => `custom_${group}`;
export interface EnsureDashboardViewGroupInput {
    organisationId: string;
    group: DashboardViewGroup;
    viewIds: string[];
    preferredViewOrder?: string[];
}
const getChromeStorage = (): any => typeof globalThis !== 'undefined' ? (globalThis as any).chrome?.storage?.local : undefined;
const ENABLE_DASHBOARD_GROUP_PERF_LOGS = false;
const dashboardGroupPerf = (label: string, data?: Record<string, unknown>) => {
    if (!ENABLE_DASHBOARD_GROUP_PERF_LOGS)
        return;
    console.log('[SidebarPerf][DashboardGroupStorage]', label, JSON.stringify(data || {}));
};
import { BRAND } from '../../shared-components/brandingConfig';
const DASHBOARD_VIEW_RECONCILIATION_STORAGE_KEY = 'dashboard_views_reconciliation_v1';
const DASHBOARD_VIEW_RECONCILIATION_VERSION = 2;
const DASHBOARD_VIEW_RECONCILIATION_MEMORY_KEY_PREFIX = BRAND.storageKeys.dashboardViewReconciliationPrefix;
export interface ReconcileDashboardViewsResult {
    viewIds: string[];
    changed: boolean;
}
const getDashboardViewReconciliationSignature = (views: Array<{
    id: string;
    settings?: any;
}>): string => JSON.stringify(views
    .map(view => ({
    id: view.id,
    source: view.settings?.source,
    templateId: view.settings?.templateId,
    templateVersion: Number(view.settings?.templateVersion || 0),
    role: view.settings?.role,
    viewGroup: view.settings?.viewGroup,
}))
    .sort((left, right) => left.id.localeCompare(right.id)));
const getReconciliationMemoryKey = (organisationId: string): string => `${DASHBOARD_VIEW_RECONCILIATION_MEMORY_KEY_PREFIX}${organisationId}`;
const readReconciliationMemorySignature = (organisationId: string): string | null => {
    try {
        return typeof window !== 'undefined'
            ? window.localStorage.getItem(getReconciliationMemoryKey(organisationId))
            : null;
    }
    catch {
        return null;
    }
};
const writeReconciliationMemorySignature = (organisationId: string, signature: string): void => {
    try {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(getReconciliationMemoryKey(organisationId), signature);
        }
    }
    catch {
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
    organisationId?: string;
    views: Array<{
        id: string;
        title?: string;
        settings?: any;
    }>;
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
export function normalizeDashboardViewsOrder({ views, currentOrder = [], customGroupNames = {}, visibleItems = {}, targetRoleHeaderId, onboardingViewIds = [], }: NormalizeDashboardViewsOrderInput): NormalizeDashboardViewsOrderResult {
    const validViewIds = new Set(views.map(v => v.id));
    const nextNames: Record<string, string> = { ...customGroupNames };
    delete nextNames['custom_default'];
    let adjustedOrder = [...currentOrder];
    const sanitizedSeen = new Set<string>();
    const sanitized: string[] = [];
    for (const id of adjustedOrder) {
        if (id === 'header-custom_default')
            continue;
        if (id.startsWith('header-')) {
            const groupId = id.replace('header-', '');
            if (groupId === 'custom_default' ||
                groupId === 'custom_work' ||
                groupId === 'custom_personal' ||
                groupId === 'custom_college' ||
                Boolean(nextNames[groupId]?.trim())) {
                if (!sanitizedSeen.has(id)) {
                    sanitizedSeen.add(id);
                    sanitized.push(id);
                }
            }
        }
        else if (validViewIds.has(id)) {
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
        }
        else if (groupKey === 'custom_personal' || groupKey === 'personal') {
            nextNames['custom_personal'] = nextNames['custom_personal'] || 'Personal Workspace';
        }
        else if (groupKey === 'custom_college' || groupKey === 'college') {
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
            // Onboarding collections are intentionally left as ordinary ungrouped views.
            if (view.settings?.source === 'onboarding') {
                finalOrder.push(view.id);
                // Only place non-onboarding views under a role header when they have an
                // explicit group or role assignment.
            }
            else if (viewGroup === 'college') {
                const targetHeader = 'header-custom_college';
                nextNames['custom_college'] = nextNames['custom_college'] || 'College';
                if (!finalOrder.includes(targetHeader)) {
                    finalOrder.push(targetHeader);
                    seen.add(targetHeader);
                }
                const hIdx = finalOrder.indexOf(targetHeader);
                let insertIdx = hIdx + 1;
                while (insertIdx < finalOrder.length && !finalOrder[insertIdx].startsWith('header-'))
                    insertIdx++;
                finalOrder.splice(insertIdx, 0, view.id);
            }
            else if (viewGroup === 'personal' || role === 'personal') {
                const targetHeader = 'header-custom_personal';
                nextNames['custom_personal'] = nextNames['custom_personal'] || 'Personal Workspace';
                if (!finalOrder.includes(targetHeader)) {
                    finalOrder.push(targetHeader);
                    seen.add(targetHeader);
                }
                const hIdx = finalOrder.indexOf(targetHeader);
                let insertIdx = hIdx + 1;
                while (insertIdx < finalOrder.length && !finalOrder[insertIdx].startsWith('header-'))
                    insertIdx++;
                finalOrder.splice(insertIdx, 0, view.id);
            }
            else if (viewGroup === 'work' || (role && role !== 'student' && role !== 'personal' && role !== 'college')) {
                const targetHeader = 'header-custom_work';
                nextNames['custom_work'] = nextNames['custom_work'] || 'Work';
                if (!finalOrder.includes(targetHeader)) {
                    finalOrder.push(targetHeader);
                    seen.add(targetHeader);
                }
                const hIdx = finalOrder.indexOf(targetHeader);
                let insertIdx = hIdx + 1;
                while (insertIdx < finalOrder.length && !finalOrder[insertIdx].startsWith('header-'))
                    insertIdx++;
                finalOrder.splice(insertIdx, 0, view.id);
            }
            else {
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
    const isOrderEqual = currentOrder.length === finalOrder.length && currentOrder.every((val, idx) => val === finalOrder[idx]);
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
export async function ensureDashboardViewsInGroup({ organisationId, group, viewIds, preferredViewOrder = [], }: EnsureDashboardViewGroupInput): Promise<void> {
    if (!organisationId)
        return;
    const storage = getChromeStorage();
    if (!storage)
        return;
    const storageData = await new Promise<Record<string, any>>(resolve => {
        storage.get(['dashboard_views_items_order', 'sidebar_view_visible_items', 'customGroupNames'], (res: Record<string, any>) => resolve(res || {}));
    });
    const existingOrder: string[] = storageData.dashboard_views_items_order || [];
    const visibleItems: Record<string, boolean> = storageData.sidebar_view_visible_items || {};
    const customGroupNames: Record<string, string> = storageData.customGroupNames || {};
    const organisationViews = await db.workspaceViews.where('organisationId').equals(organisationId).toArray();
    const targetHeaderId = getDashboardViewGroupHeaderId(group);
    const normalized = normalizeDashboardViewsOrder({
        organisationId,
        views: organisationViews,
        currentOrder: existingOrder,
        customGroupNames,
        visibleItems,
        targetRoleHeaderId: targetHeaderId,
        onboardingViewIds: viewIds,
    });
    dashboardGroupPerf('ensure-group:save-order', {
        organisationId,
        group,
        viewIds,
        changed: normalized.isChanged,
        previous: summarizeOrder(existingOrder),
        next: summarizeOrder(normalized.order),
    });
    await new Promise<void>(resolve => {
        storage.set({
            dashboard_views_items_order: normalized.order,
            sidebar_view_visible_items: normalized.visibleItems,
            customGroupNames: normalized.customGroupNames,
        }, () => resolve());
    });
}
export async function reconcileExistingOnboardingViews(organisationId: string): Promise<ReconcileDashboardViewsResult> {
    if (!organisationId)
        return { viewIds: [], changed: false };
    const startedAt = performance.now();
    dashboardGroupPerf('reconcile:start', { organisationId });
    let views = await db.workspaceViews.where('organisationId').equals(organisationId).toArray();
    if (views.length === 0) {
        dashboardGroupPerf('reconcile:skip-no-views', {
            durationMs: Math.round(performance.now() - startedAt),
            organisationId,
        });
        return { viewIds: [], changed: false };
    }
    const currentSignature = getDashboardViewReconciliationSignature(views);
    if (readReconciliationMemorySignature(organisationId) === currentSignature) {
        dashboardGroupPerf('reconcile:skip-memory', {
            durationMs: Math.round(performance.now() - startedAt),
            organisationId,
        });
        return { viewIds: views.map(view => view.id), changed: false };
    }
    const storage = getChromeStorage();
    let existingOrder: string[] = [];
    let visibleItems: Record<string, boolean> = {};
    let customGroupNames: Record<string, string> = {};
    let reconciliationVersions: Record<string, {
        version: number;
        signature: string;
    }> = {};
    if (storage) {
        const existingData = await new Promise<Record<string, any>>(resolve => {
            storage.get([
                'dashboard_views_items_order',
                'sidebar_view_visible_items',
                'customGroupNames',
                DASHBOARD_VIEW_RECONCILIATION_STORAGE_KEY
            ], (res: Record<string, any>) => resolve(res || {}));
        });
        existingOrder = existingData?.dashboard_views_items_order || [];
        visibleItems = existingData?.sidebar_view_visible_items || {};
        customGroupNames = existingData?.customGroupNames || {};
        reconciliationVersions = existingData?.[DASHBOARD_VIEW_RECONCILIATION_STORAGE_KEY] || {};
    }
    const completedReconciliation = reconciliationVersions[organisationId];
    if (completedReconciliation?.version === DASHBOARD_VIEW_RECONCILIATION_VERSION &&
        completedReconciliation.signature === currentSignature) {
        writeReconciliationMemorySignature(organisationId, currentSignature);
        dashboardGroupPerf('reconcile:skip-complete', {
            durationMs: Math.round(performance.now() - startedAt),
            organisationId,
        });
        return { viewIds: views.map(view => view.id), changed: false };
    }
    let dashboardDataChanged = false;
    const founderTemplateIds = new Set([
        'founder-command-center',
        'build-and-ship',
        'capital-and-runway',
        'team-and-culture'
    ]);
    const onboardingViews = views.filter(v => v.settings?.source === 'onboarding' ||
        (v.settings?.templateId && founderTemplateIds.has(v.settings.templateId as string)));
    const onboardingViewIds = new Set(onboardingViews.map(view => view.id));
    for (const view of onboardingViews) {
        let role = (view.settings?.role as OnboardingRoleId) || 'founder';
        if (!view.settings?.role &&
            view.settings?.templateId &&
            founderTemplateIds.has(view.settings.templateId as string)) {
            role = 'founder';
        }
        const hasViewGroup = Object.prototype.hasOwnProperty.call(view.settings || {}, 'viewGroup');
        const isLegacyOnboardingView = view.settings?.source !== 'onboarding';
        if (hasViewGroup || view.settings?.role !== role || isLegacyOnboardingView) {
            const settingsWithoutViewGroup = { ...(view.settings || {}) };
            delete settingsWithoutViewGroup.viewGroup;
            dashboardDataChanged = true;
            await db.workspaceViews.update(view.id, {
                settings: {
                    ...settingsWithoutViewGroup,
                    source: 'onboarding',
                    role,
                },
                updatedAt: Date.now(),
            });
        }
    }
    if (dashboardDataChanged) {
        views = await db.workspaceViews.where('organisationId').equals(organisationId).toArray();
    }
    // Pull onboarding collections out of their former group blocks. Empty built-in
    // onboarding headers are removed; headers containing user-managed views remain.
    const orderWithoutOnboardingViews = existingOrder.filter(id => !onboardingViewIds.has(id));
    const reservedOnboardingHeaders = new Set(['header-custom_work', 'header-custom_college', 'header-custom_personal']);
    const ungroupedOrder = orderWithoutOnboardingViews.filter((id, index, order) => {
        if (!reservedOnboardingHeaders.has(id))
            return true;
        const nextItem = order[index + 1];
        return Boolean(nextItem && !nextItem.startsWith('header-'));
    });
    const normalized = normalizeDashboardViewsOrder({
        organisationId,
        views,
        currentOrder: ungroupedOrder,
        customGroupNames,
        visibleItems,
    });
    const changed = dashboardDataChanged || normalized.isChanged;
    const refreshedViews = views;
    const nextReconciliationVersions = {
        ...reconciliationVersions,
        [organisationId]: {
            version: DASHBOARD_VIEW_RECONCILIATION_VERSION,
            signature: getDashboardViewReconciliationSignature(refreshedViews),
        },
    };
    if (storage) {
        dashboardGroupPerf('reconcile:save', {
            durationMs: Math.round(performance.now() - startedAt),
            organisationId,
            changed,
            viewCount: views.length,
            onboardingViewCount: onboardingViews.length,
            previous: summarizeOrder(existingOrder),
            next: summarizeOrder(normalized.order),
        });
        await new Promise<void>(resolve => {
            storage.set({
                dashboard_views_items_order: normalized.order,
                sidebar_view_visible_items: normalized.visibleItems,
                customGroupNames: normalized.customGroupNames,
                [DASHBOARD_VIEW_RECONCILIATION_STORAGE_KEY]: nextReconciliationVersions,
            }, () => resolve());
        });
    }
    writeReconciliationMemorySignature(organisationId, nextReconciliationVersions[organisationId].signature);
    dashboardGroupPerf('reconcile:done', {
        durationMs: Math.round(performance.now() - startedAt),
        organisationId,
        changed,
        viewCount: views.length,
        onboardingViewCount: onboardingViews.length,
    });
    return {
        viewIds: onboardingViews.map(view => view.id),
        changed,
    };
}
