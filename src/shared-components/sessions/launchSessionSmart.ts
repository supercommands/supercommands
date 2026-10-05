import type { LinkItem } from '../../allObjectFolder/src/createObject/links/linkTypes';
import { BRAND } from '../brandingConfig';
export type SessionLaunchSource = 'session_editor' | 'dashboard_view' | 'autosave_tracking' | 'hotkey' | 'shortcut' | 'omnibox' | 'url_trigger' | 'favorite' | 'board' | 'search' | 'todo' | 'website';
export type ExtensionTabContext = {
    currentTabId?: number | null;
    currentWindowId?: number | null;
    currentPageUrl?: string;
};
type SessionControlActionItem = Pick<LinkItem, 'url' | 'name' | 'title' | 'originalData'>;
const LARGE_SESSION_CONFIRMATION_THRESHOLD = 12;
export type LaunchSessionSmartInput = {
    sessionId: string;
    sessionName?: string;
    organisationId?: string | null;
    storageMode?: 'local' | 'cloud';
    initialUrls?: string[];
    initialNames?: string[];
    openUrls?: string[];
    openNames?: string[];
    openSettings?: any;
    source: SessionLaunchSource;
    workspaceId?: string | null;
    context?: ExtensionTabContext;
    requireAutoSave?: boolean;
    isInlineCreation?: boolean;
    sessionReferenceItems?: SessionControlActionItem[];
    skipLargeLaunchConfirmation?: boolean;
};
const getSessionLaunchUrlCount = (input: LaunchSessionSmartInput): number => {
    const urls = Array.isArray(input.openUrls) ? input.openUrls : input.initialUrls;
    return (urls || []).filter(Boolean).length;
};
const requestLargeSessionLaunchConfirmation = async ({ sessionName, urlCount, }: {
    sessionName: string;
    urlCount: number;
}): Promise<boolean> => {
    if (typeof document === 'undefined')
        return true;
    return new Promise(resolve => {
        const existing = document.getElementById(BRAND.dom.largeSessionLaunchConfirmation) || document.getElementById('cmdos-large-session-launch-confirmation');
        if (existing)
            existing.remove();
        const overlay = document.createElement('div');
        overlay.id = BRAND.dom.largeSessionLaunchConfirmation;
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Confirm session launch');
        overlay.style.cssText = [
            'position:fixed',
            'inset:0',
            'z-index:2147483647',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'padding:24px',
            'background:color-mix(in srgb, var(--color-rootBg) 72%, transparent)',
            'font-family:inherit'
        ].join(';');
        const panel = document.createElement('div');
        panel.style.cssText = [
            'width:min(420px, 100%)',
            'border-radius:8px',
            'border:1px solid var(--color-borderDefault)',
            'background:var(--color-modalBg, var(--color-cardBg))',
            'box-shadow:0 18px 48px var(--color-widgetShadow)',
            'color:var(--color-textPrimary)',
            'overflow:hidden'
        ].join(';');
        const body = document.createElement('div');
        body.style.cssText = 'padding:20px 20px 16px 20px';
        const title = document.createElement('div');
        title.textContent = `Open ${urlCount} tabs?`;
        title.style.cssText = [
            'font-size:16px',
            'line-height:1.35',
            'font-weight:700',
            'color:var(--color-textPrimary)',
            'margin-bottom:8px'
        ].join(';');
        const description = document.createElement('div');
        description.textContent = `${sessionName} will open ${urlCount} tabs. The first tabs open immediately, then the rest open progressively so Chrome stays responsive.`;
        description.style.cssText = [
            'font-size:13px',
            'line-height:1.5',
            'font-weight:500',
            'color:var(--color-textSecondary)'
        ].join(';');
        const actions = document.createElement('div');
        actions.style.cssText = [
            'display:flex',
            'justify-content:flex-end',
            'gap:10px',
            'padding:14px 20px 20px 20px',
            'border-top:1px solid var(--color-borderDefault)'
        ].join(';');
        const finish = (confirmed: boolean) => {
            document.removeEventListener('keydown', onKeyDown, true);
            overlay.remove();
            resolve(confirmed);
        };
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.textContent = 'Cancel';
        cancelButton.style.cssText = [
            'height:34px',
            'padding:0 14px',
            'border-radius:8px',
            'border:1px solid var(--color-borderDefault)',
            'background:var(--color-hoverBg)',
            'color:var(--color-textSecondary)',
            'font-size:12px',
            'font-weight:700',
            'cursor:pointer'
        ].join(';');
        cancelButton.onclick = () => finish(false);
        const continueButton = document.createElement('button');
        continueButton.type = 'button';
        continueButton.textContent = 'Continue';
        continueButton.style.cssText = [
            'height:34px',
            'padding:0 14px',
            'border-radius:8px',
            'border:1px solid var(--color-borderActive)',
            'background:var(--color-accent)',
            'color:var(--color-buttonText, var(--color-textPrimary))',
            'font-size:12px',
            'font-weight:700',
            'cursor:pointer',
            'box-shadow:0 0 0 1px var(--color-focusRing)'
        ].join(';');
        continueButton.onclick = () => finish(true);
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                event.preventDefault();
                finish(false);
            }
        }
        overlay.addEventListener('click', event => {
            if (event.target === overlay)
                finish(false);
        });
        document.addEventListener('keydown', onKeyDown, true);
        body.append(title, description);
        actions.append(cancelButton, continueButton);
        panel.append(body, actions);
        overlay.append(panel);
        document.body.append(overlay);
        continueButton.focus();
    });
};
const isSessionControlActionItem = (item: SessionControlActionItem): boolean => {
    if (item?.originalData?.sessionAgentSnapshot)
        return true;
    try {
        const parsed = new URL(String(item?.url || ''), 'chrome-extension://session-reference/');
        const type = parsed.searchParams.get('type');
        return Boolean(type && type !== 'note' && type !== 'snippet');
    }
    catch {
        return false;
    }
};
const resolveSessionControlActionItems = async (input: LaunchSessionSmartInput) => {
    const items = [...(input.sessionReferenceItems || [])];
    const addUniqueItem = (item: SessionControlActionItem) => {
        const key = `${item.url}:${item.originalData?.sessionAgentSnapshot?.providerId || ''}`;
        const exists = items.some(existing => `${existing.url}:${existing.originalData?.sessionAgentSnapshot?.providerId || ''}` === key);
        if (!exists)
            items.push(item);
    };
    try {
        const { db } = await import('../../storage/indexDB/dbConfig');
        const session = await db.workspaceSessions.get(input.sessionId);
        const sessionItems = (session?.urls || [])
            .map((item, index) => typeof item === 'string'
            ? { id: `session-url-${index}`, url: item, title: item, name: item, source: 'custom' as const }
            : item)
            .filter(item => Boolean(item?.url)) as LinkItem[];
        sessionItems.filter(isSessionControlActionItem).forEach(addUniqueItem);
        const { buildSessionAgentSuggestions, getSessionAgentUrlComparisonKey } = await import('../../allObjectFolder/src/createObject/session/sessionAgentSnapshot');
        const [chatAgents, aiPrompts] = await Promise.all([db.chatAgents.toArray(), db.aiPrompts.toArray()]);
        const promptsWithEveryStoredTarget = aiPrompts.map(prompt => ({
            ...prompt,
            enabledModelIds: Array.from(new Set([...Object.keys(prompt.modelUrls || {}), ...(prompt.customModels || []).map(model => model.id)])),
        }));
        const suggestions = buildSessionAgentSuggestions({
            chatAgents,
            aiPrompts: promptsWithEveryStoredTarget,
            excludedModelIds: [],
        });
        const targetsByUrl = new Map<string, {
            suggestion: (typeof suggestions)[number];
            target: (typeof suggestions)[number]['targets'][number];
        }>();
        suggestions.forEach(suggestion => {
            suggestion.targets.forEach(target => {
                const key = getSessionAgentUrlComparisonKey(target.url);
                if (key && !targetsByUrl.has(key))
                    targetsByUrl.set(key, { suggestion, target });
            });
        });
        const inferredItems: SessionControlActionItem[] = [];
        sessionItems.forEach(item => {
            if (isSessionControlActionItem(item))
                return;
            const match = targetsByUrl.get(getSessionAgentUrlComparisonKey(item.url));
            if (!match)
                return;
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
    }
    catch (error) {
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
        if (!chromeAny?.windows?.getCurrent)
            return { currentPageUrl };
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
        organisationId: session?.organisationId || session?.organisation_id,
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
    if (input.requireAutoSave === true && input.openSettings?.autoSaveMode !== 'auto_save') {
        return { ok: true, skipped: true, reason: 'auto_save_off', sessionId: input.sessionId };
    }
    const context = input.context || await getCurrentExtensionTabContext();
    const sessionReferenceItems = await resolveSessionControlActionItems(input);
    const launchUrlCount = getSessionLaunchUrlCount(input);
    if (!input.skipLargeLaunchConfirmation && launchUrlCount >= LARGE_SESSION_CONFIRMATION_THRESHOLD) {
        const confirmed = await requestLargeSessionLaunchConfirmation({
            sessionName: input.sessionName || 'Untitled Tab Session',
            urlCount: launchUrlCount,
        });
        if (!confirmed) {
            return {
                ok: true,
                skipped: true,
                reason: 'large_session_cancelled',
                sessionId: input.sessionId,
            };
        }
    }
    return chromeAny.runtime.sendMessage({
        action: 'start_workspace',
        workspaceId: input.sessionId,
        sessionId: input.sessionId,
        sessionName: input.sessionName || 'Untitled Tab Session',
        organisationId: input.organisationId,
        storageMode: input.storageMode || 'local',
        initialUrls: input.initialUrls || [],
        initialNames: input.initialNames || [],
        openUrls: input.openUrls,
        openNames: input.openNames,
        openSettings: input.openSettings,
        sessionLaunchSource: input.source,
        launchWorkspaceId: input.workspaceId,
        smartLaunch: true,
        isInlineCreation: input.isInlineCreation,
        sessionReferenceItems,
        currentTabId: typeof context.currentTabId === 'number' ? context.currentTabId : undefined,
        currentWindowId: typeof context.currentWindowId === 'number' ? context.currentWindowId : undefined,
        currentPageUrl: context.currentPageUrl,
    });
};
