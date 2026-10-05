import { switchWidgetDashboardViewAsync } from '../../storage/localStorage/widgetDashboardStorage';
import { useDbStore } from '../../storage/store/useDbStore';
import { db } from '../../storage/indexDB/dbConfig';
import { normalizeCollectionLaunchSettings, type CollectionOpenBehavior, } from '../../allObjectFolder/src/createObject/widgets/widgetTypes';
import { useUIStore } from '../uiStateManager';
import { launchDashboardViewSessionSmart } from './protectedDashboardSessionLaunch';
import { DASHBOARD_COLLECTION_RENAME_REQUEST_EVENT } from './dashboardCollectionEvents';
import { isMainDashboardView } from '../../pages/AltS_search_newtab/src/components/widgets/engine/widgetDashboardData';
type DashboardCollectionLaunchMode = 'open' | 'edit' | 'dialog';
type DashboardCollectionLaunchOptions = {
    organisationId?: string | null;
    mode?: DashboardCollectionLaunchMode;
    openBehavior?: CollectionOpenBehavior;
};
const resolveDashboardCollectionView = (viewId: string, organisationId?: string | null) => {
    const normalizedViewId = String(viewId || '').trim();
    if (!normalizedViewId)
        return null;
    const state = useDbStore.getState();
    const view = (state.widgetViews || []).find(candidate => String(candidate.id) === normalizedViewId);
    const resolvedOrganisationId = String(view?.organisationId || organisationId || state.organisations?.[0]?.id || 'default');
    return {
        view,
        viewId: String(view?.id || normalizedViewId),
        organisationId: resolvedOrganisationId,
    };
};
const resolveDashboardCollectionViewAsync = async (viewId: string, organisationId?: string | null) => {
    const resolvedFromStore = resolveDashboardCollectionView(viewId, organisationId);
    if (resolvedFromStore?.view)
        return resolvedFromStore;
    const normalizedViewId = String(viewId || '').trim();
    if (!normalizedViewId)
        return null;
    const view = await db.workspaceViews.get(normalizedViewId);
    const state = useDbStore.getState();
    const resolvedOrganisationId = String(view?.organisationId || organisationId || state.organisations?.[0]?.id || 'default');
    return {
        view,
        viewId: String(view?.id || normalizedViewId),
        organisationId: resolvedOrganisationId,
    };
};
export const launchDashboardCollectionView = async (viewId: string, options: DashboardCollectionLaunchOptions = {}) => {
    const resolved = await resolveDashboardCollectionViewAsync(viewId, options.organisationId);
    // Home is an internal landing view, never a collection that can be opened,
    // edited, or targeted through a shortcut/search result.
    if (!resolved?.view) throw new Error('This Workspace no longer exists.');
    if (!resolved?.viewId || isMainDashboardView(resolved.view))
        return false;
    const mode = options.mode || 'open';
    const openBehavior = options.openBehavior ||
        normalizeCollectionLaunchSettings(resolved.view?.collectionLaunchSettings).openBehavior;
    if (mode === 'open') {
        const protectedLaunch = await launchDashboardViewSessionSmart({
            viewId: resolved.viewId,
            organisationId: resolved.organisationId,
            openBehavior,
        });
        if (protectedLaunch.handled && !protectedLaunch.ok) {
            return false;
        }
        if (protectedLaunch.handled && protectedLaunch.ok && !protectedLaunch.switchCurrentView) {
            return true;
        }
    }
    if (mode === 'dialog') {
        const uiStore = useUIStore.getState();
        uiStore.closeEditor();
        uiStore.setView({ type: 'home' });
        window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent(DASHBOARD_COLLECTION_RENAME_REQUEST_EVENT, {
                detail: { viewId: resolved.viewId },
            }));
        }, 0);
        return true;
    }
    await switchWidgetDashboardViewAsync(resolved.viewId, resolved.organisationId, {
        trigger: 'system',
        forceDispatch: true,
    });
    const uiStore = useUIStore.getState();
    uiStore.closeEditor();
    uiStore.setView({ type: 'home' });
    uiStore.setDashboardViewIntent({
        organisationId: resolved.organisationId,
        viewId: resolved.viewId,
        mode,
        openBehavior,
    });
    return true;
};
