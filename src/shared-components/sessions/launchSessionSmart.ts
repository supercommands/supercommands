import type { LinkItem } from '../../allObjectFolder/src/createObject/links/linkTypes';

export type SessionLaunchSource =
  | 'session_editor'
  | 'dashboard_view'
  | 'autosave_tracking'
  | 'hotkey'
  | 'shortcut'
  | 'omnibox'
  | 'url_trigger'
  | 'favorite'
  | 'board'
  | 'search'
  | 'todo'
  | 'website';

export type ExtensionTabContext = {
  currentTabId?: number | null;
  currentWindowId?: number | null;
  currentPageUrl?: string;
};

type SessionControlActionItem = Pick<LinkItem, 'url' | 'name' | 'title' | 'originalData'>;

export type LaunchSessionSmartInput = {
  sessionId: string;
  sessionName?: string;
  workspaceId?: string | null;
  folderId?: string | null;
  teamId?: string | null;
  storageMode?: 'local' | 'cloud';
  initialUrls?: string[];
  initialNames?: string[];
  openUrls?: string[];
  openNames?: string[];
  openSettings?: any;
  source: SessionLaunchSource;
  dashboardViewId?: string | null;
  context?: ExtensionTabContext;
  requireAutoSave?: boolean;
  isInlineCreation?: boolean;
  sessionReferenceItems?: SessionControlActionItem[];
};

const isSessionControlActionItem = (item: SessionControlActionItem): boolean => {
  if (item?.originalData?.sessionAgentSnapshot) return true;
  try {
    const parsed = new URL(String(item?.url || ''), 'chrome-extension://session-reference/');
    const type = parsed.searchParams.get('type');
    return Boolean(type && type !== 'note' && type !== 'snippet');
  } catch {
    return false;
  }
};

const resolveSessionControlActionItems = async (input: LaunchSessionSmartInput) => {
  const items = [...(input.sessionReferenceItems || [])];
  const addUniqueItem = (item: SessionControlActionItem) => {
    const key = `${item.url}:${item.originalData?.sessionAgentSnapshot?.providerId || ''}`;
    const exists = items.some(
      existing => `${existing.url}:${existing.originalData?.sessionAgentSnapshot?.providerId || ''}` === key,
    );
    if (!exists) items.push(item);
  };

  try {
    const { db } = await import('../../storage/indexDB/dbConfig');
    const session = await db.sessions.get(input.sessionId);
    const sessionItems = (session?.urls || [])
      .map((item, index) =>
        typeof item === 'string'
          ? { id: `session-url-${index}`, url: item, title: item, name: item, source: 'custom' as const }
          : item,
      )
      .filter(item => Boolean(item?.url)) as LinkItem[];

    sessionItems.filter(isSessionControlActionItem).forEach(addUniqueItem);

    const { buildSessionAgentSuggestions, getSessionAgentUrlComparisonKey } = await import(
      '../../allObjectFolder/src/createObject/session/sessionAgentSnapshot'
    );
    const [chatAgents, aiPrompts] = await Promise.all([db.chatAgents.toArray(), db.aiPrompts.toArray()]);
    const promptsWithEveryStoredTarget = aiPrompts.map(prompt => ({
      ...prompt,
      enabledModelIds: Array.from(
        new Set([...Object.keys(prompt.modelUrls || {}), ...(prompt.customModels || []).map(model => model.id)]),
      ),
    }));
    const suggestions = buildSessionAgentSuggestions({
      chatAgents,
      aiPrompts: promptsWithEveryStoredTarget,
      excludedModelIds: [],
    });
    const targetsByUrl = new Map<
      string,
      { suggestion: (typeof suggestions)[number]; target: (typeof suggestions)[number]['targets'][number] }
    >();

    suggestions.forEach(suggestion => {
      suggestion.targets.forEach(target => {
        const key = getSessionAgentUrlComparisonKey(target.url);
        if (key && !targetsByUrl.has(key)) targetsByUrl.set(key, { suggestion, target });
      });
    });

    const inferredItems: SessionControlActionItem[] = [];
    sessionItems.forEach(item => {
      if (isSessionControlActionItem(item)) return;
      const match = targetsByUrl.get(getSessionAgentUrlComparisonKey(item.url));
      if (!match) return;
      const originalData = item.originalData && typeof item.originalData === 'object' ? item.originalData : {};
      const inferredItem = {
        ...item,
        originalData: {
          ...originalData,
          sessionAgentSnapshot: {
            sourceId: match.suggestion.id,
            sourceTitle: match.suggestion.title,
            providerId: match.target.id,
            providerName: match.target.name,
            providerKind: match.target.kind,
            prompt: match.suggestion.prompt,
          },
        },
      };
      inferredItems.push(inferredItem);
      addUniqueItem(inferredItem);
    });
    console.info('[SessionLaunchTrace] resolved session control actions', {
      sessionId: input.sessionId,
      sessionUrlCount: sessionItems.length,
      storedAgentTargetCount: targetsByUrl.size,
      inferredItems: inferredItems.map(item => ({
        url: item.url,
        sourceId: item.originalData?.sessionAgentSnapshot?.sourceId,
        providerId: item.originalData?.sessionAgentSnapshot?.providerId,
      })),
      actionItemCount: items.length,
    });
  } catch (error) {
    console.warn('[SessionLaunchTrace] failed to resolve session control actions', {
      sessionId: input.sessionId,
      error,
    });
    // Draft and isolated launch surfaces can rely on explicitly supplied items.
  }
  return items;
};

export const getCurrentExtensionTabContext = async (): Promise<ExtensionTabContext> => {
  const chromeAny = (globalThis as any)?.chrome;
  const currentPageUrl = typeof window !== 'undefined' ? window.location.href : undefined;

  if (!chromeAny?.tabs?.getCurrent) {
    if (!chromeAny?.windows?.getCurrent) return { currentPageUrl };

    return new Promise(resolve => {
      chromeAny.windows.getCurrent((win: any) => {
        resolve({
          currentWindowId: win?.id,
          currentPageUrl,
        });
      });
    });
  }

  return new Promise(resolve => {
    chromeAny.tabs.getCurrent((tab: any) => {
      if (typeof tab?.windowId === 'number') {
        resolve({
          currentTabId: tab?.id,
          currentWindowId: tab.windowId,
          currentPageUrl: tab?.url || currentPageUrl,
        });
        return;
      }

      if (!chromeAny?.windows?.getCurrent) {
        resolve({ currentPageUrl });
        return;
      }

      chromeAny.windows.getCurrent((win: any) => {
        resolve({
          currentWindowId: win?.id,
          currentPageUrl,
        });
      });
    });
  });
};

export const buildSessionLaunchPayload = (session: any) => {
  const urls = Array.isArray(session?.urls) ? session.urls : [];
  return {
    sessionId: String(session?.id || session?.snippet_id || '').trim(),
    sessionName: session?.title || session?.key || session?.name || 'Untitled Tab Session',
    workspaceId: session?.workspaceId || session?.workspace_id || null,
    folderId: session?.folderId || session?.folder_id || null,
    initialUrls: urls.map((link: any) => (typeof link === 'string' ? link : link?.url)).filter(Boolean),
    initialNames: urls.map((link: any) => (typeof link === 'string' ? '' : link?.title || link?.name || '')),
    openSettings: session?.sessionOpenSettings,
  };
};

export const launchSessionSmart = async (input: LaunchSessionSmartInput): Promise<any> => {
  const chromeAny = (globalThis as any)?.chrome;
  if (!input.sessionId || !chromeAny?.runtime?.sendMessage) {
    return { ok: false, error: 'missing_session_launch_context' };
  }

  if (input.requireAutoSave !== false && input.openSettings?.autoSaveMode !== 'auto_save') {
    return { ok: true, skipped: true, reason: 'auto_save_off', sessionId: input.sessionId };
  }

  const context = input.context || await getCurrentExtensionTabContext();
  const sessionReferenceItems = await resolveSessionControlActionItems(input);

  return chromeAny.runtime.sendMessage({
    action: 'start_session',
    sessionId: input.sessionId,
    sessionName: input.sessionName || 'Untitled Tab Session',
    workspaceId: input.workspaceId || null,
    folderId: input.folderId || null,
    teamId: input.teamId || 'local',
    storageMode: input.storageMode || 'local',
    initialUrls: input.initialUrls || [],
    initialNames: input.initialNames || [],
    openUrls: input.openUrls,
    openNames: input.openNames,
    openSettings: input.openSettings,
    sessionLaunchSource: input.source,
    dashboardViewId: input.dashboardViewId || undefined,
    smartLaunch: true,
    isInlineCreation: input.isInlineCreation,
    sessionReferenceItems,
    currentTabId: typeof context.currentTabId === 'number' ? context.currentTabId : undefined,
    currentWindowId: typeof context.currentWindowId === 'number' ? context.currentWindowId : undefined,
    currentPageUrl: context.currentPageUrl,
  });
};
