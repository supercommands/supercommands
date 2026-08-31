import { switchWidgetDashboardViewAsync } from '../../storage/localStorage/widgetDashboardStorage';
import { useDbStore } from '../../storage/store/useDbStore';
import { db } from '../../storage/indexDB/dbConfig';
import {
  normalizeCollectionLaunchSettings,
  type CollectionOpenBehavior,
} from '../../allObjectFolder/src/createObject/widgets/widgetTypes';
import { useUIStore } from '../uiStateManager';
import { launchDashboardViewSessionSmart } from './protectedDashboardSessionLaunch';

type DashboardCollectionLaunchMode = 'open' | 'edit';

type DashboardCollectionLaunchOptions = {
  workspaceId?: string | null;
  mode?: DashboardCollectionLaunchMode;
  openBehavior?: CollectionOpenBehavior;
};

const resolveDashboardCollectionView = (viewId: string, workspaceId?: string | null) => {
  const normalizedViewId = String(viewId || '').trim();
  if (!normalizedViewId) return null;

  const state = useDbStore.getState();
  const view =
    (state.widgetViews || []).find(candidate => String(candidate.id) === normalizedViewId) ||
    null;
  const resolvedWorkspaceId = String(view?.workspaceId || workspaceId || state.workspaces?.[0]?.id || 'default');

  return {
    view,
    viewId: String(view?.id || normalizedViewId),
    workspaceId: resolvedWorkspaceId,
  };
};

const resolveDashboardCollectionViewAsync = async (viewId: string, workspaceId?: string | null) => {
  const resolvedFromStore = resolveDashboardCollectionView(viewId, workspaceId);
  if (resolvedFromStore?.view) return resolvedFromStore;

  const normalizedViewId = String(viewId || '').trim();
  if (!normalizedViewId) return null;

  const view =
    (await db.widgetViews.get(normalizedViewId)) ||
    (await db.widgetViews
      .filter(candidate => String(candidate.title || '').toLowerCase().trim() === normalizedViewId.toLowerCase())
      .first()) ||
    null;
  const state = useDbStore.getState();
  const resolvedWorkspaceId = String(view?.workspaceId || workspaceId || state.workspaces?.[0]?.id || 'default');

  return {
    view,
    viewId: String(view?.id || normalizedViewId),
    workspaceId: resolvedWorkspaceId,
  };
};

export const launchDashboardCollectionView = async (
  viewId: string,
  options: DashboardCollectionLaunchOptions = {},
) => {
  const resolved = await resolveDashboardCollectionViewAsync(viewId, options.workspaceId);
  if (!resolved?.viewId) return false;

  const mode = options.mode || 'open';
  const openBehavior =
    options.openBehavior ||
    normalizeCollectionLaunchSettings(resolved.view?.collectionLaunchSettings).openBehavior;

  if (mode === 'open') {
    const protectedLaunch = await launchDashboardViewSessionSmart({
      viewId: resolved.viewId,
      workspaceId: resolved.workspaceId,
      openBehavior,
    });
    if (protectedLaunch.handled && !protectedLaunch.ok) {
      return false;
    }
    if (protectedLaunch.handled && protectedLaunch.ok && !protectedLaunch.switchCurrentView) {
      return true;
    }
  }

  await switchWidgetDashboardViewAsync(resolved.viewId, resolved.workspaceId, {
    trigger: 'system',
    forceDispatch: true,
  });

  const uiStore = useUIStore.getState();
  uiStore.closeEditor();
  uiStore.setView({ type: 'home' });
  uiStore.setDashboardViewIntent({
    workspaceId: resolved.workspaceId,
    viewId: resolved.viewId,
    mode,
    openBehavior,
  });

  return true;
};
