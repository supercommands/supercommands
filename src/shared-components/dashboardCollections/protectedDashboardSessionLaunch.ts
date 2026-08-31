import { db } from '../../storage/indexDB/dbConfig';
import type { CollectionOpenBehavior } from '../../allObjectFolder/src/createObject/widgets/widgetTypes';
import { launchSessionSmartWithReferences } from '../../allObjectFolder/src/createObject/session/sessionReferenceActions';

type ExtensionTabContext = {
  currentTabId?: number;
  currentWindowId?: number;
  currentPageUrl?: string;
};

type ProtectedLaunchOptions = {
  viewId: string;
  workspaceId: string;
  openBehavior?: CollectionOpenBehavior;
};

type ProtectedDashboardSessionLaunchResult =
  | { handled: false }
  | { handled: true; ok: true; switchCurrentView: boolean }
  | { handled: true; ok: false; error: string };

const applyCollectionOpenBehaviorToSessionSettings = (
  sessionOpenSettings: any,
  openBehavior?: CollectionOpenBehavior,
) => {
  const baseSettings = { ...(sessionOpenSettings || {}) };

  if (openBehavior === 'respect_session') {
    return baseSettings;
  }

  if (openBehavior === 'new_window') {
    return {
      ...baseSettings,
      openMode: 'new_window',
      focusWindow: false,
    };
  }

  if (openBehavior === 'focus_mode') {
    return {
      ...baseSettings,
      openMode: 'same_window',
      focusWindow: true,
    };
  }

  if (openBehavior === 'same_window') {
    return {
      ...baseSettings,
      openMode: 'same_window',
      focusWindow: false,
    };
  }

  return baseSettings;
};

const getCurrentExtensionTabContext = async (): Promise<ExtensionTabContext> => {
  const chromeAny = (window as any).chrome;
  const fallbackToCurrentWindow = () =>
    new Promise<ExtensionTabContext>(resolve => {
      if (!chromeAny?.windows?.getCurrent) {
        resolve({ currentPageUrl: window.location.href });
        return;
      }

      chromeAny.windows.getCurrent((win: any) => {
        resolve({
          currentWindowId: win?.id,
          currentPageUrl: window.location.href,
        });
      });
    });

  if (!chromeAny?.tabs?.getCurrent) {
    return fallbackToCurrentWindow();
  }

  return new Promise(resolve => {
    chromeAny.tabs.getCurrent((tab: any) => {
      if (typeof tab?.windowId !== 'number') {
        fallbackToCurrentWindow().then(resolve);
        return;
      }

      resolve({
        currentTabId: tab?.id,
        currentWindowId: tab?.windowId,
        currentPageUrl: tab?.url || window.location.href,
      });
    });
  });
};

const getSessionIdFromWidget = (widget: any): string | null => {
  const sessionId = widget?.sessionId || (widget?.referenceType === 'session' ? widget?.referenceId : undefined);
  return typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : null;
};

const getFirstSessionForView = async (
  viewId: string,
  workspaceId: string,
) => {
  const widgets = await db.widgets.where('[workspaceId+viewId]').equals([workspaceId, viewId]).toArray();
  const sessionIds = widgets
    .filter(widget => widget.type === 'session-item')
    .map(getSessionIdFromWidget)
    .filter((sessionId): sessionId is string => Boolean(sessionId));

  if (sessionIds.length === 0) return null;

  const uniqueSessionIds = Array.from(new Set(sessionIds));
  const sessions = (await db.sessions.bulkGet(uniqueSessionIds)).filter(Boolean);
  const sessionsById = new Map(sessions.map(session => [String((session as any).id), session]));

  return uniqueSessionIds
    .map(sessionId => sessionsById.get(sessionId))
    .find(Boolean) || null;
};

export const launchDashboardViewSessionSmart = async ({
  viewId,
  workspaceId,
  openBehavior,
}: ProtectedLaunchOptions): Promise<ProtectedDashboardSessionLaunchResult> => {
  const chromeAny = (window as any).chrome;
  if (!chromeAny?.runtime?.sendMessage) return { handled: false };

  const sessionToRun = await getFirstSessionForView(viewId, workspaceId);
  if (!sessionToRun?.id) return { handled: false };

  const currentTabContext = await getCurrentExtensionTabContext();
  const launchOpenSettings = applyCollectionOpenBehaviorToSessionSettings(
    sessionToRun.sessionOpenSettings,
    openBehavior,
  );

  try {
    const response = await launchSessionSmartWithReferences(sessionToRun, {
      teamId: undefined,
      storageMode: 'local',
      openSettings: launchOpenSettings,
      source: 'dashboard_view',
      dashboardViewId: viewId,
      context: currentTabContext,
      requireAutoSave: false,
    });

    if (response?.ok && typeof response?.windowId === 'number') {
      const switchCurrentView =
        typeof currentTabContext.currentWindowId === 'number' &&
        response.windowId === currentTabContext.currentWindowId &&
        response.openedInNewWindow !== true &&
        response.focusedExisting !== true;
      return { handled: true, ok: true, switchCurrentView };
    }

    return {
      handled: true,
      ok: false,
      error: response?.error || 'Could not open this auto-run session in a new window.',
    };
  } catch (error) {
    console.error('[DashboardAutoRun][protected] protected launch failed', {
      viewId,
      sessionId: sessionToRun.id,
      error,
    });
    return {
      handled: true,
      ok: false,
      error: error instanceof Error ? error.message : 'Could not open this auto-run session in a new window.',
    };
  }
};
