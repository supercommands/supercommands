import { useEffect, useRef } from 'react';
import { useSpreadsheetStore } from '../../../../../shared-components/spreadsheetUi/logic/spreadsheetStateStore';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { extractSnippetIdFromCompoundId } from '../../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { db } from '../../../../../storage/indexDB/dbConfig';
import { getCollectionWidgetViews, useDbStore } from '../../../../../storage/store/useDbStore';
import { commandRegistry } from '../../../../../shared-components/commands';
import { launchDashboardCollectionView } from '../../../../../shared-components/dashboardCollections/launchDashboardCollectionView';
import { handleSessionReferenceLaunchActions, launchSessionSmartWithReferences, } from '../../../../../allObjectFolder/src/createObject/session/sessionReferenceActions';
import type { CollectionOpenBehavior } from '../../../../../allObjectFolder/src/createObject/widgets/widgetTypes';
import type { AiPromptRecord } from '../../../../../allObjectFolder/src/createObject/aiPrompt/aiPromptTypes';
import { getCommandTerminalUrlRouteReadiness, parseCommandTerminalUrlRoute, type CommandTerminalRouteEntityType, } from '../../../../../shared-components/commandTerminal/runtime';
import { hasCollectionItemRoute, readCollectionItemRoute } from '../../components/collections/collectionItemRoute';
export interface MissingAiPromptInputRequest {
    promptRecord: AiPromptRecord;
    promptId: string;
    editorProps?: unknown;
    initialPrompt?: string;
}
interface UseUrlTriggersProps {
    userId: string;
    openSpreadsheetView: (section?: string) => void;
    searchbarRef: React.MutableRefObject<any>;
    setIsGlobalCreateMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
    requestMissingAiPromptInput?: (request: MissingAiPromptInputRequest) => void;
}
const ENABLE_SESSION_FLOW_URL_TRIGGER_LOGS = false;
const sessionFlowUrlTriggerDebug = (...args: unknown[]) => {
    if (!ENABLE_SESSION_FLOW_URL_TRIGGER_LOGS)
        return;
    console.log(...args);
};
const normalizeText = (value: unknown): string => {
    if (typeof value !== 'string')
        return '';
    return value.toLowerCase().trim();
};
const includesQuery = (value: unknown, query: string): boolean => Boolean(query) && normalizeText(value).includes(query);
const getLinkSearchText = (item: any): string => {
    const parts = [item?.title, item?.name];
    if (typeof item?.url === 'string')
        parts.push(item.url);
    if (Array.isArray(item?.urls)) {
        for (const link of item.urls) {
            if (typeof link?.title === 'string')
                parts.push(link.title);
            if (typeof link?.name === 'string')
                parts.push(link.name);
            if (typeof link?.url === 'string')
                parts.push(link.url);
        }
    }
    return parts.filter(Boolean).join(' ');
};
const inferAiModelIdFromUrl = (url: string, index: number): string => {
    const normalized = String(url || '').toLowerCase();
    if (normalized.includes('claude.ai'))
        return 'claude';
    if (normalized.includes('gemini.google.com'))
        return 'gemini';
    if (normalized.includes('perplexity.ai'))
        return 'perplexity';
    if (normalized.includes('chatgpt.com') || normalized.includes('chat.openai.com'))
        return 'gpt';
    return `custom-${index + 1}`;
};
const normalizeChatAgentForAiPanel = (agent: any) => {
    const urls: string[] = Array.isArray(agent?.urls)
        ? (agent.urls as unknown[]).map((url: unknown) => String(url || '').trim()).filter(Boolean)
        : [];
    const allAiUrls: Record<string, string> = urls.reduce((acc: Record<string, string>, url, index) => {
        const modelId = inferAiModelIdFromUrl(url, index);
        const uniqueModelId = acc[modelId] ? `${modelId}-${index + 1}` : modelId;
        acc[uniqueModelId] = url;
        return acc;
    }, {});
    return {
        ...agent,
        name: agent?.name || agent?.title || 'Untitled Agent',
        title: agent?.title || agent?.name || 'Untitled Agent',
        organisation_id: agent?.organisation_id || agent?.organisationId,
        category: 'agent',
        type: 'chat_agent',
        automation_steps: [
            {
                config: {
                    allAiUrls,
                    prompt: agent?.prompt || '',
                    rules: agent?.rules || '',
                },
            }
        ],
    };
};
const matchesEntityId = (item: any, entityId: string | null): boolean => {
    if (!item || !entityId)
        return false;
    const candidateIds = [item.id, item.snippet_id, item.todo_id, item.linkid, item.noteid].filter(Boolean);
    return candidateIds.some(candidateId => String(candidateId) === String(entityId));
};
/** Explicit route IDs must resolve in their own live table, not a stale UI snapshot. */
const resolveRouteEntityById = async (type: CommandTerminalRouteEntityType, id: string) => {
    const tables = {
        note: db.notes, link: db.links, snippet: db.snippets, todo: db.todos,
        session: db.workspaceSessions, agent: db.chatAgents, prompt: db.aiPrompts, collection: db.workspaceViews,
    };
    const entity = await tables[type].get(extractSnippetIdFromCompoundId(id));
    if (!entity)
        return null;
    if (type === 'collection' && !getCollectionWidgetViews([entity]).length)
        return null;
    return { entity, type: type === 'agent' ? 'chatAgent' : type === 'prompt' ? 'aiPrompt' : type };
};
type RouteEntityCandidateSnapshot = {
    notes: any[];
    links: any[];
    snippets: any[];
    chatAgents: any[];
    aiPrompts: any[];
    todos: any[];
    sessions: any[];
    widgetViews: any[];
};
const readRouteTableIfStoreIsEmpty = async <T,>(storeItems: T[], readTable: () => Promise<T[]>, tableName: string): Promise<T[]> => {
    if (storeItems.length > 0)
        return storeItems;
    try {
        return await readTable();
    }
    catch (error) {
        console.warn('[useUrlTriggers] Failed to read route candidates from IndexedDB:', {
            tableName,
            error,
        });
        return storeItems;
    }
};
/**
 * Loads candidate rows for the parsed command-terminal route.
 *
 * `useDbStore.isInitialized` can become true before every liveQuery snapshot has
 * populated Zustand. For URL-triggered routes, read the relevant Dexie table
 * directly when the in-memory array is still empty so title/id routing works on
 * first newtab load for every entity type, not only prompts.
 */
const getRouteEntityCandidateSnapshot = async (entityType: CommandTerminalRouteEntityType | null, state: ReturnType<typeof useDbStore.getState>): Promise<RouteEntityCandidateSnapshot> => {
    const snapshot: RouteEntityCandidateSnapshot = {
        notes: [...(state.notes || [])],
        links: [...(state.links || [])],
        snippets: [...(state.snippets || [])],
        chatAgents: [...(state.chatAgents || [])],
        aiPrompts: [...(state.aiPrompts || [])],
        todos: [...(state.todos || [])],
        sessions: [...(state.sessions || [])],
        widgetViews: [...(state.widgetViews || [])],
    };
    switch (entityType) {
        case 'note':
            snapshot.notes = await readRouteTableIfStoreIsEmpty(snapshot.notes, () => db.notes.toArray(), 'notes');
            snapshot.snippets = await readRouteTableIfStoreIsEmpty(snapshot.snippets, () => db.snippets.toArray(), 'snippets');
            break;
        case 'link':
            snapshot.links = await readRouteTableIfStoreIsEmpty(snapshot.links, () => db.links.toArray(), 'links');
            snapshot.snippets = await readRouteTableIfStoreIsEmpty(snapshot.snippets, () => db.snippets.toArray(), 'snippets');
            break;
        case 'snippet':
            snapshot.snippets = await readRouteTableIfStoreIsEmpty(snapshot.snippets, () => db.snippets.toArray(), 'snippets');
            snapshot.notes = await readRouteTableIfStoreIsEmpty(snapshot.notes, () => db.notes.toArray(), 'notes');
            break;
        case 'todo':
            snapshot.todos = await readRouteTableIfStoreIsEmpty(snapshot.todos, () => db.todos.toArray(), 'todos');
            break;
        case 'collection':
            snapshot.widgetViews = await readRouteTableIfStoreIsEmpty(snapshot.widgetViews, () => db.workspaceViews.toArray(), 'widgetViews');
            break;
        case 'session':
            snapshot.sessions = await readRouteTableIfStoreIsEmpty(snapshot.sessions, () => db.workspaceSessions.toArray(), 'sessions');
            break;
        case 'prompt':
            snapshot.aiPrompts = await readRouteTableIfStoreIsEmpty(snapshot.aiPrompts, () => db.aiPrompts.toArray(), 'aiPrompts');
            break;
        case 'agent':
            snapshot.chatAgents = await readRouteTableIfStoreIsEmpty(snapshot.chatAgents, () => db.chatAgents.toArray(), 'chatAgents');
            snapshot.aiPrompts = await readRouteTableIfStoreIsEmpty(snapshot.aiPrompts, () => db.aiPrompts.toArray(), 'aiPrompts');
            break;
        default:
            break;
    }
    return snapshot;
};
const openNoteById = (noteId: string, resolvedNote?: any) => {
    const foundNote = resolvedNote || useDbStore
        .getState()
        .notes.find(note => String(note.id) === String(noteId) || String((note as any).snippet_id || '') === String(noteId));
    useUIStore.getState().setView({ type: 'home' });
    useUIStore.getState().openItemEditor('note', noteId, {
        props: foundNote ? { snippet: foundNote, category: 'note', editMode: true } : { category: 'note' },
    });
};
const openSnippetById = (snippetId: string, resolvedSnippet?: any) => {
    const actualSnippetId = extractSnippetIdFromCompoundId(snippetId);
    const foundSnippet = resolvedSnippet ||
        useDbStore
            .getState()
            .snippets.find(snippet => String(snippet.id) === String(actualSnippetId) ||
            String((snippet as any).snippet_id || '') === String(actualSnippetId));
    useUIStore.getState().setView({ type: 'home' });
    useUIStore.getState().openEditor({
        type: 'snippet',
        id: String(foundSnippet?.id || actualSnippetId || snippetId),
        props: foundSnippet
            ? { snippet: foundSnippet, item: foundSnippet, editMode: true, category: 'snippet' }
            : { editMode: true, category: 'snippet' },
    });
};
const openLinkById = (linkId: string, resolvedLink?: any) => {
    const actualLinkId = extractSnippetIdFromCompoundId(linkId);
    const foundLink = resolvedLink ||
        useDbStore
            .getState()
            .links.find(link => String(link.id) === String(actualLinkId) ||
            String((link as any).linkid || '') === String(actualLinkId));
    useUIStore.getState().setView({ type: 'home' });
    useUIStore.getState().openEditor({
        type: 'link',
        id: String(foundLink?.id || actualLinkId || linkId),
        props: foundLink
            ? { snippet: foundLink, item: foundLink, editMode: true, category: 'link' }
            : { editMode: true, category: 'link' },
    });
};
const getCollectionOpenBehaviorFromUrl = (urlParams: URLSearchParams): CollectionOpenBehavior | undefined => {
    return urlParams.get('openBehavior') === 'focus_mode' ? 'focus_mode' : undefined;
};
const launchCollectionViewById = async (referenceId: string, openBehavior?: CollectionOpenBehavior, mode: 'open' | 'edit' | 'dialog' = 'open'): Promise<boolean> => {
    return launchDashboardCollectionView(referenceId, { mode, openBehavior });
};
const getCurrentExtensionTabContext = async () => {
    const chromeAny = (window as any).chrome;
    const fallbackToCurrentWindow = () => new Promise<{
        currentTabId?: number;
        currentWindowId?: number;
        currentPageUrl?: string;
    }>(resolve => {
        if (!chromeAny?.windows?.getCurrent) {
            resolve({ currentPageUrl: window.location.href });
            return;
        }
        chromeAny.windows.getCurrent({ populate: false }, (win: any) => {
            resolve({
                currentWindowId: win?.id,
                currentPageUrl: window.location.href,
            });
        });
    });
    if (!chromeAny?.tabs?.getCurrent) {
        return fallbackToCurrentWindow();
    }
    return new Promise<{
        currentTabId?: number;
        currentWindowId?: number;
        currentPageUrl?: string;
    }>(resolve => {
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
const hasCommandQueryPlaceholder = (url: string): boolean => /\{query\s*\}|\[query\s*\]|\{content\s*\}|\{prompt\s*\}/i.test(url);
const tryRunDirectUrlCommand = async (commandId?: string | null): Promise<boolean> => {
    const normalizedCommandId = String(commandId || '').trim();
    if (!normalizedCommandId)
        return false;
    const command = commandRegistry.get(normalizedCommandId);
    const url = String((command as any)?.urlTemplate || (command as any)?.url || '').trim();
    if (!url || hasCommandQueryPlaceholder(url)) {
        console.log('[UrlTrigger][direct-command] skipped', {
            commandId: normalizedCommandId,
            hasCommand: Boolean(command),
            url,
            reason: !url ? 'no_direct_url' : 'query_placeholder',
        });
        return false;
    }
    console.log('[UrlTrigger][direct-command] attempting', {
        commandId: normalizedCommandId,
        url,
    });
    const chromeAny = (window as any).chrome;
    if (chromeAny?.tabs?.getCurrent && chromeAny?.tabs?.update) {
        const updated = await new Promise<boolean>(resolve => {
            chromeAny.tabs.getCurrent((tab: any) => {
                if (chromeAny.runtime?.lastError || typeof tab?.id !== 'number') {
                    console.warn('[UrlTrigger][direct-command] current tab unavailable', {
                        commandId: normalizedCommandId,
                        runtimeError: chromeAny.runtime?.lastError?.message,
                    });
                    resolve(false);
                    return;
                }
                chromeAny.tabs.update(tab.id, { url }, () => {
                    const ok = !chromeAny.runtime?.lastError;
                    console.log('[UrlTrigger][direct-command] current tab update result', {
                        commandId: normalizedCommandId,
                        tabId: tab.id,
                        ok,
                        runtimeError: chromeAny.runtime?.lastError?.message,
                    });
                    resolve(ok);
                });
            });
        });
        if (updated)
            return true;
    }
    if (chromeAny?.tabs?.create) {
        console.log('[UrlTrigger][direct-command] opening new tab fallback', {
            commandId: normalizedCommandId,
            url,
        });
        chromeAny.tabs.create({ url, active: true });
        return true;
    }
    console.log('[UrlTrigger][direct-command] window.location fallback', {
        commandId: normalizedCommandId,
        url,
    });
    window.location.href = url;
    return true;
};
const replaceTriggerUrlWithNormalNewtabUrl = () => {
    window.history.replaceState({}, '', window.location.pathname);
};
export const useUrlTriggers = ({ userId, openSpreadsheetView, searchbarRef, setIsGlobalCreateMenuOpen, requestMissingAiPromptInput, }: UseUrlTriggersProps) => {
    const handledUrlTriggerKeyRef = useRef<string | null>(null);
    const isHandlingUrlTrigger = useRef(false);
    const openedSessionFromUrlRef = useRef<string | null>(null);
    const handledSessionReferenceDispatchesRef = useRef<Set<string>>(new Set());
    const dbNotes = useDbStore(state => state.notes);
    const dbLinks = useDbStore(state => state.links);
    const dbSnippets = useDbStore(state => state.snippets);
    const dbSessions = useDbStore(state => state.sessions);
    const isDbInitialized = useDbStore(state => state.isInitialized);
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (hasCollectionItemRoute(urlParams)) {
            const collectionRoute = readCollectionItemRoute(urlParams);
            if (!collectionRoute) {
                window.history.replaceState({}, '', window.location.pathname);
                return;
            }
            if (!isDbInitialized) return;
            const routeKey = `${window.location.pathname}${window.location.search}`;
            if (handledUrlTriggerKeyRef.current === routeKey) return;
            handledUrlTriggerKeyRef.current = routeKey;
            // Without itemId, CollectionsView opens this collection's item list.
            useUIStore.getState().setView({ type: 'collections', ...collectionRoute });
            window.history.replaceState({}, '', window.location.pathname);
            return;
        }
        const omniboxError = urlParams.get('omnibox_error');
        if (urlParams.get('omnibox') === 'true' && omniboxError) {
            useUIStore.getState().setView({ type: 'home' });
            useUIStore.getState().queueNotification({ message: omniboxError, type: 'error' });
            window.history.replaceState({}, '', window.location.pathname);
            return;
        }
        if (urlParams.get('session_reference') === 'true') {
            const referenceType = urlParams.get('type');
            const referenceId = urlParams.get('id');
            if ((referenceType === 'note' || referenceType === 'snippet') && referenceId) {
                if (!isDbInitialized)
                    return;
                const referenceKey = `${referenceType}:${referenceId}`;
                if (handledSessionReferenceDispatchesRef.current.has(referenceKey))
                    return;
                handledSessionReferenceDispatchesRef.current.add(referenceKey);
                console.log('[SessionLaunchTrace] opening session reference tab', {
                    referenceType,
                    referenceId,
                });
                window.setTimeout(() => {
                    if (referenceType === 'note') {
                        openNoteById(referenceId);
                    }
                    else {
                        openSnippetById(referenceId);
                    }
                    console.log('[SessionLaunchTrace] session reference editor requested', {
                        referenceType,
                        referenceId,
                        activeEditor: useUIStore.getState().activeEditor,
                    });
                }, 100);
                return;
            }
            window.history.replaceState({}, '', window.location.pathname);
            return;
        }
        const currentTriggerKey = `${window.location.pathname}${window.location.search}`;
        if (isHandlingUrlTrigger.current || handledUrlTriggerKeyRef.current === currentTriggerKey) {
            if (window.location.search) {
                sessionFlowUrlTriggerDebug('[UrlTrigger][guard] skipped', {
                    currentTriggerKey,
                    isHandling: isHandlingUrlTrigger.current,
                    handledKey: handledUrlTriggerKeyRef.current,
                    href: window.location.href,
                });
            }
            return;
        }
        const hasTrigger = urlParams.get('focus_sheet_ui_first_column') === 'true' ||
            urlParams.get('open_sheet') !== null ||
            urlParams.get('create_link') === 'true' ||
            urlParams.get('create_prompt') === 'true' ||
            urlParams.get('session_mode') === 'true' ||
            urlParams.get('create_note') === 'true' ||
            urlParams.get('create_snippet') === 'true' ||
            urlParams.get('create_todo') === 'true' ||
            urlParams.get('backup_stats') === 'true' ||
            urlParams.get('trigger_hotkey') === 'true' ||
            urlParams.get('omnibox') === 'true' ||
            urlParams.get('alts_action') === 'true';
        const hasOmniboxTrigger = urlParams.get('omnibox') === 'true' || urlParams.get('alts_action') === 'true';
        if (hasTrigger || hasOmniboxTrigger || urlParams.get('trigger_hotkey') === 'true') {
            console.log('[UrlTrigger][detected]', {
                href: window.location.href,
                currentTriggerKey,
                hasTrigger,
                hasOmniboxTrigger,
                triggerHotkey: urlParams.get('trigger_hotkey'),
                type: urlParams.get('type'),
                id: urlParams.get('id'),
                query: urlParams.get('query'),
                isDbInitialized,
                hasSearchbarRef: Boolean(searchbarRef.current),
                userReady: userId !== '',
            });
        }
        if (urlParams.get('focus_sheet_ui_first_column') === 'true') {
            openSpreadsheetView();
            useSpreadsheetStore.getState().setSelectedCell({ rowIndex: 1, colIndex: 0 });
            window.history.replaceState({}, '', window.location.pathname);
            return;
        }
        if (urlParams.get('backup_stats') === 'true') {
            const backupStatsId = urlParams.get('backup_id') || urlParams.get('id') || '';
            useUIStore.getState().setView({
                type: 'settings',
                section: 'googleDriveBackup',
                backupStatsId,
            });
            window.history.replaceState({}, '', window.location.pathname);
            handledUrlTriggerKeyRef.current = currentTriggerKey;
            return;
        }
        const sheetAction = urlParams.get('open_sheet');
        const isEmbedded = urlParams.get('embed') === 'true';
        if (sheetAction) {
            if (isEmbedded) {
                if (sheetAction === 'createnotes') {
                    useUIStore.getState().openCreateItem('note', { id: 'new', props: { category: 'note' } });
                }
                else if (sheetAction === 'createsnippet') {
                    useUIStore.getState().openCreateItem('note', { id: 'new', props: { category: 'snippet' } });
                }
                else if (sheetAction === 'createtodo') {
                    useUIStore.getState().openCreateItem('todo', { id: 'new' });
                }
                else if (sheetAction === 'createlinks') {
                    const activeTabUrl = urlParams.get('active_tab_url') || '';
                    const activeTabTitle = urlParams.get('active_tab_title') || '';
                    useUIStore.getState().openCreateItem('link', {
                        id: 'new',
                        linkPrefill: { key: activeTabTitle, value: activeTabUrl, category: 'link' } as any,
                    });
                }
                else if (sheetAction === 'createprompt') {
                    useUIStore.getState().openCreateItem('aiPrompt', { id: 'new', props: {} });
                }
            }
            else {
                if (sheetAction === 'todo') {
                    useUIStore.getState().setSidebar('todoSidebar', { open: true });
                }
                else if (sheetAction === 'collections') {
                    openSpreadsheetView('collections');
                }
                else if (sheetAction === 'general_commands' || sheetAction === 'commands') {
                    openSpreadsheetView('general_commands');
                }
                else {
                    const executeSheetAction = () => {
                        if (searchbarRef.current) {
                            searchbarRef.current.clear();
                            setTimeout(() => {
                                const mode = sheetAction === 'store' || sheetAction === 'ai' ? 'lock' : 'execute';
                                searchbarRef.current?.executeCommand(sheetAction as any, { mode });
                                searchbarRef.current?.focus();
                            }, 10);
                        }
                        else {
                            setTimeout(executeSheetAction, 100);
                        }
                    };
                    executeSheetAction();
                }
            }
            const newParams = new URLSearchParams(window.location.search);
            const preserveOpenSheet = sheetAction === 'general_commands' || sheetAction === 'commands';
            if (!preserveOpenSheet) {
                newParams.delete('open_sheet');
            }
            newParams.delete('active_tab_url');
            newParams.delete('active_tab_title');
            const newSearch = newParams.toString();
            const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
            window.history.replaceState({}, '', newUrl);
            handledUrlTriggerKeyRef.current = currentTriggerKey;
            return;
        }
        if (urlParams.get('edit_agent')) {
            const agentId = urlParams.get('edit_agent');
            if (agentId) {
                setTimeout(() => {
                    useUIStore.getState().openEditor({ type: 'ai', id: agentId });
                }, 150);
            }
            window.history.replaceState({}, '', window.location.pathname);
            return;
        }
        const createRouteIntent = parseCommandTerminalUrlRoute(urlParams, { source: 'newtab' });
        if (createRouteIntent.kind === 'create-entity') {
            switch (createRouteIntent.entityType) {
                case 'agent':
                    setTimeout(() => {
                        useUIStore.getState().openCreateItem('ai', { id: 'new', isNew: true });
                    }, 150);
                    break;
                case 'link':
                    setTimeout(() => {
                        const linkPrefillObj = createRouteIntent.activeTabUrl
                            ? { key: '', value: createRouteIntent.activeTabUrl, category: 'link' }
                            : undefined;
                        useUIStore.getState().openCreateItem('link', {
                            id: 'new',
                            props: { prefill: linkPrefillObj },
                            linkPrefill: linkPrefillObj,
                        });
                    }, 150);
                    break;
                case 'prompt':
                    setTimeout(() => {
                        useUIStore.getState().openCreateItem('aiPrompt', { id: 'new', props: {} });
                    }, 150);
                    break;
                case 'session': {
                    const sessionId = createRouteIntent.entityId || '';
                    const sessionName = createRouteIntent.query;
                    let sessionProps = sessionId
                        ? {
                            session: {
                                id: sessionId,
                                title: sessionName || 'Untitled Tab Session',
                            },
                        }
                        : undefined;
                    try {
                        const rawEditorProps = urlParams.get('editorProps');
                        if (rawEditorProps) {
                            const parsed = JSON.parse(rawEditorProps);
                            if (parsed?.props) {
                                sessionProps = parsed.props;
                            }
                        }
                    }
                    catch (e) {
                        console.error('Failed to parse editorProps for session_mode:', e);
                    }
                    openedSessionFromUrlRef.current = sessionId || 'new';
                    sessionFlowUrlTriggerDebug('[SessionFlow][useUrlTriggers] session_mode=true detected -> opening session editor', {
                        sessionId,
                        sessionName,
                        sessionProps,
                    });
                    setTimeout(() => {
                        useUIStore.getState().openEditor({
                            type: 'session',
                            id: sessionId || 'new',
                            props: sessionProps,
                        });
                    }, 150);
                    break;
                }
                case 'note':
                    setTimeout(() => {
                        useUIStore.getState().openCreateItem('note', { id: 'new', props: { category: 'note' } });
                    }, 150);
                    break;
                case 'snippet':
                    setTimeout(() => {
                        useUIStore.getState().openCreateItem('note', { id: 'new', props: { category: 'snippet' } });
                    }, 150);
                    break;
                case 'todo':
                    setTimeout(() => {
                        useUIStore.getState().openCreateItem('todo', {
                            id: 'new',
                            props: { prefill: { isCreateModalOnly: true } as any },
                            openTodoSidebar: true,
                        });
                    }, 150);
                    break;
                case 'collection':
                    useUIStore.getState().setView({ type: 'home' });
                    break;
            }
            window.history.replaceState({}, '', window.location.pathname);
            return;
        }
        if (urlParams.get('omnibox') === 'true' || urlParams.get('alts_action') === 'true') {
            const type = urlParams.get('type');
            const query = normalizeText(urlParams.get('query') || '');
            const temporaryPrompt = urlParams.get('temporaryPrompt') || '';
            const collectionOpenBehavior = getCollectionOpenBehaviorFromUrl(urlParams);
            const commandId = urlParams.get('id');
            const editMode = urlParams.get('edit_mode') === 'true';
            let editorProps: any = undefined;
            const editorPropsStr = urlParams.get('editorProps');
            if (editorPropsStr) {
                try {
                    editorProps = JSON.parse(editorPropsStr);
                }
                catch (e) {
                    console.error('[useUrlTriggers] Failed to parse editorProps', e);
                }
            }
            const entityId = urlParams.get('entityId') ||
                urlParams.get('noteid') ||
                urlParams.get('linkid') ||
                urlParams.get('snippetid') ||
                commandId;
            const routeIntent = parseCommandTerminalUrlRoute(urlParams, {
                source: 'omnibox',
                fallbackCommandId: commandId,
            });
            const routeReadiness = getCommandTerminalUrlRouteReadiness(routeIntent);
            const routeEntityType = routeIntent.kind === 'open-entity' || routeIntent.kind === 'search-entity'
                ? routeIntent.entityType
                : null;
            const routeEntityId = routeIntent.kind === 'open-entity' ? routeIntent.entityId : '';
            const routeQuery = routeIntent.kind === 'open-entity' || routeIntent.kind === 'search-entity' || routeIntent.kind === 'open-command' || routeIntent.kind === 'search-command'
                ? routeIntent.query
                : query;
            const routeEditMode = routeIntent.kind === 'open-entity' || routeIntent.kind === 'search-entity'
                ? routeIntent.editMode
                : editMode;
            const routeRunPrompt = routeIntent.kind === 'open-entity' || routeIntent.kind === 'search-entity'
                ? routeIntent.runPrompt
                : urlParams.get('runPrompt') === 'true';
            const normalizedRouteQuery = normalizeText(routeQuery);
            console.log('[useUrlTriggers] Detected URL Trigger:', { type, query, commandId, entityId, routeIntent });
            if (routeIntent.kind === 'invalid') {
                console.warn('[useUrlTriggers] Aborting trigger: Missing type or valid target.', {
                    type,
                    reason: routeIntent.reason,
                    query,
                    entityId,
                });
                handledUrlTriggerKeyRef.current = currentTriggerKey;
                replaceTriggerUrlWithNormalNewtabUrl();
                return;
            }
            const invocationKey = `${window.location.pathname}${window.location.search}`;
            const windowWithInvocationGuard = window as typeof window & {
                __cmdosOmniboxInvocationsInFlight?: Set<string>;
            };
            const inFlightInvocations = windowWithInvocationGuard.__cmdosOmniboxInvocationsInFlight ||
                new Set<string>();
            windowWithInvocationGuard.__cmdosOmniboxInvocationsInFlight = inFlightInvocations;
            if (inFlightInvocations.has(invocationKey)) {
                console.warn('[useUrlTriggers] Duplicate omnibox invocation suppressed:', { invocationKey });
                return;
            }
            inFlightInvocations.add(invocationKey);
            isHandlingUrlTrigger.current = true;
            let attempts = 0;
            const maxAttempts = 80;
            const retryDelayMs = 100;
            const releaseOmniboxInvocation = () => {
                inFlightInvocations.delete(invocationKey);
                isHandlingUrlTrigger.current = false;
            };
            replaceTriggerUrlWithNormalNewtabUrl();
            const tryHandleOmnibox = async () => {
                console.log('[UrlTrigger][omnibox] handling attempt', {
                    invocationKey,
                    type,
                    commandId,
                    query,
                    attempts,
                    isDbInitialized: useDbStore.getState().isInitialized,
                    renderIsDbInitialized: isDbInitialized,
                    hasSearchbarRef: Boolean(searchbarRef.current),
                    userReady: userId !== '',
                });
                if (routeIntent.kind === 'open-command' && await tryRunDirectUrlCommand(routeIntent.commandId)) {
                    console.log('[UrlTrigger][omnibox] command handled by direct URL executor', {
                        commandId: routeIntent.commandId,
                        invocationKey,
                    });
                    handledUrlTriggerKeyRef.current = currentTriggerKey;
                    releaseOmniboxInvocation();
                    return;
                }
                const currentIsDbInitialized = useDbStore.getState().isInitialized;
                if ((routeReadiness.needsSearchbarRef && !searchbarRef.current) ||
                    (routeReadiness.needsDbReady && !currentIsDbInitialized)) {
                    console.log('[UrlTrigger][omnibox] waiting for readiness', {
                        invocationKey,
                        attempts,
                        hasSearchbarRef: Boolean(searchbarRef.current),
                        routeReadiness,
                        currentIsDbInitialized,
                        renderIsDbInitialized: isDbInitialized,
                    });
                    if (attempts++ < maxAttempts) {
                        window.setTimeout(tryHandleOmnibox, retryDelayMs);
                    }
                    else {
                        console.warn('[useUrlTriggers] Omnibox trigger timed out before the UI became ready.', {
                            invocationKey,
                            currentIsDbInitialized,
                            renderIsDbInitialized: isDbInitialized,
                        });
                        releaseOmniboxInvocation();
                    }
                    return;
                }
                const latestDbState = useDbStore.getState();
                if (routeIntent.kind === 'search-command') {
                    useUIStore.getState().setView({ type: 'home' });
                    searchbarRef.current.setValue(routeIntent.query);
                    searchbarRef.current.focus?.();
                    handledUrlTriggerKeyRef.current = currentTriggerKey;
                    releaseOmniboxInvocation();
                    return;
                }
                const routeCandidates = await getRouteEntityCandidateSnapshot(routeEntityType, latestDbState);
                const noteCandidates = routeCandidates.notes;
                const linkCandidates = routeCandidates.links;
                const snippetCandidates = routeCandidates.snippets;
                const chatAgentCandidates = routeCandidates.chatAgents;
                const aiPromptCandidates = routeCandidates.aiPrompts;
                const widgetViewCandidates = routeCandidates.widgetViews;
                let resolvedEntity: any = null;
                if (routeEntityId) {
                    try {
                        resolvedEntity = await resolveRouteEntityById(routeEntityType!, routeEntityId);
                    }
                    catch (e) {
                        console.error('[useUrlTriggers] Error resolving entity by ID:', e);
                        useUIStore.getState().queueNotification({ message: 'The selected item could not be loaded. Try again.', type: 'error' });
                        handledUrlTriggerKeyRef.current = currentTriggerKey;
                        releaseOmniboxInvocation();
                        return;
                    }
                }
                // Explicit IDs are authoritative. A deleted/missing selection must not
                // become a similarly titled record or a new Create editor.
                if (routeIntent.kind === 'open-entity') {
                    const expectedResolvedType = routeEntityType === 'agent' ? 'chatAgent' : routeEntityType === 'prompt' ? 'aiPrompt' : routeEntityType;
                    if (resolvedEntity?.type !== expectedResolvedType) {
                        console.warn('[useUrlTriggers] Selected entity is no longer available:', { type: routeEntityType, entityId: routeEntityId });
                        useUIStore.getState().queueNotification({ message: 'The selected item is no longer available.', type: 'error' });
                        useUIStore.getState().setView({ type: 'home' });
                        searchbarRef.current?.setValue(routeQuery || '');
                        searchbarRef.current?.focus?.();
                        handledUrlTriggerKeyRef.current = currentTriggerKey;
                        releaseOmniboxInvocation();
                        return;
                    }
                }
                if (routeEntityType === 'note') {
                    const foundNote = (resolvedEntity?.type === 'note' ? resolvedEntity.entity : null) ||
                        noteCandidates.find(item => matchesEntityId(item, routeEntityId)) ||
                        (normalizedRouteQuery ? noteCandidates.find(item => includesQuery(item.title, normalizedRouteQuery)) : null);
                    console.log('[useUrlTriggers] Searching for note:', {
                        entityId: routeEntityId,
                        query: routeQuery,
                        resolvedType: resolvedEntity?.type,
                        foundNoteId: foundNote?.id || (foundNote as any)?.snippet_id,
                        noteCount: noteCandidates.length,
                    });
                    if (foundNote || editorProps) {
                        if (editorProps && editorProps.props) {
                            const snipObj = editorProps.props.item || editorProps.props.snippet || foundNote;
                            const mergedProps = {
                                ...editorProps.props,
                                initialDraftKey: editorProps.props.initialDraftKey || snipObj?.title || snipObj?.name || snipObj?.key,
                                initialDraftContent: editorProps.props.initialDraftContent || snipObj?.body || snipObj?.content || snipObj?.value || (typeof snipObj?.config === 'string' ? snipObj.config : JSON.stringify(snipObj?.config || '')),
                            };
                            useUIStore.getState().openItemEditor('note', String(foundNote?.id || routeEntityId || 'new'), { props: mergedProps });
                            useUIStore.getState().setView({ type: 'home' });
                        }
                        else if (foundNote) {
                            const foundNoteId = String(foundNote.id || (foundNote as any).snippet_id);
                            window.setTimeout(() => {
                                openNoteById(foundNoteId, foundNote);
                                console.log('[UrlTrigger][omnibox] note editor requested', {
                                    noteId: foundNoteId,
                                    activeEditor: useUIStore.getState().activeEditor,
                                });
                            }, 100);
                        }
                    }
                    else {
                        console.warn('[useUrlTriggers] Note search did not resolve a note.', {
                            entityId: routeEntityId,
                            query: routeQuery,
                            noteCount: noteCandidates.length,
                        });
                        useUIStore.getState().setView({ type: 'home' });
                        searchbarRef.current?.setValue(routeQuery);
                        searchbarRef.current?.focus?.();
                    }
                }
                else if (routeEntityType === 'link') {
                    const targetLinkId = routeEntityId || commandId || '';
                    const foundLink = (resolvedEntity?.type === 'link' ? resolvedEntity.entity : null) ||
                        (targetLinkId ? linkCandidates.find(item => matchesEntityId(item, targetLinkId)) : null) ||
                        (normalizedRouteQuery ? linkCandidates.find(item => includesQuery(getLinkSearchText(item), normalizedRouteQuery)) : null);
                    if (foundLink || editorProps) {
                        if (routeEditMode) {
                            if (editorProps?.props) {
                                useUIStore.getState().setView({ type: 'home' });
                                useUIStore.getState().openEditor({
                                    type: 'link',
                                    id: String(foundLink?.id || targetLinkId || 'new'),
                                    props: {
                                        ...editorProps.props,
                                        snippet: editorProps.props.snippet || editorProps.props.item || foundLink,
                                        item: editorProps.props.item || editorProps.props.snippet || foundLink,
                                        editMode: true,
                                        category: 'link',
                                    },
                                });
                            }
                            else {
                                openLinkById(String(foundLink?.id || targetLinkId || 'new'), foundLink);
                            }
                        }
                        else if (searchbarRef.current?.executeSnippet && foundLink) {
                            searchbarRef.current.executeSnippet(foundLink);
                        }
                    }
                    else {
                        useUIStore.getState().setView({ type: 'home' });
                        searchbarRef.current?.setValue(routeQuery);
                        searchbarRef.current?.focus?.();
                    }
                }
                else if (routeEntityType === 'collection') {
                    const collectionLaunchMode = routeEditMode ? 'dialog' : 'open';
                    const navigableViews = getCollectionWidgetViews(widgetViewCandidates);
                    const foundView = (resolvedEntity?.type === 'collection' ? resolvedEntity.entity : null) ||
                        (routeEntityId ? null : navigableViews.find(view => normalizeText(view.title) === normalizedRouteQuery) ||
                            navigableViews.find(view => includesQuery(view.title, normalizedRouteQuery)));
                    if (foundView) {
                        await launchCollectionViewById(String(foundView.id), collectionOpenBehavior, collectionLaunchMode);
                    }
                    else if (routeEntityId || commandId) {
                        await launchCollectionViewById(String(routeEntityId || commandId), collectionOpenBehavior, collectionLaunchMode);
                    }
                    else {
                        useUIStore.getState().setView({ type: 'home' });
                        searchbarRef.current?.setValue(routeQuery);
                        searchbarRef.current?.focus?.();
                    }
                }
                else if (routeEntityType === 'session') {
                    const foundSession = (resolvedEntity?.type === 'session' ? resolvedEntity.entity : null) ||
                        routeCandidates.sessions.find(item => matchesEntityId(item, routeEntityId)) ||
                        (normalizedRouteQuery
                            ? routeCandidates.sessions.find(item => includesQuery(item.title || item.sessionName || item.name, normalizedRouteQuery))
                            : null);
                    if (foundSession) {
                        if (routeEditMode || editorProps) {
                            useUIStore.getState().setView({ type: 'home' });
                            useUIStore.getState().openEditor({
                                type: 'session',
                                id: String(foundSession.id || routeEntityId || 'new'),
                                props: {
                                    ...(editorProps?.props || {}),
                                    session: editorProps?.props?.session || editorProps?.props?.item || foundSession,
                                    snippet: editorProps?.props?.snippet || editorProps?.props?.item || foundSession,
                                    item: editorProps?.props?.item || editorProps?.props?.session || foundSession,
                                    editMode: true,
                                    category: 'session',
                                },
                            });
                        }
                        else {
                            const session = foundSession as any;
                            await launchSessionSmartWithReferences(session, {
                                source: 'omnibox',
                                requireAutoSave: false,
                            });
                        }
                    }
                    else {
                        useUIStore.getState().setView({ type: 'home' });
                        searchbarRef.current?.setValue(routeQuery);
                        searchbarRef.current?.focus?.();
                    }
                }
                else if (routeEntityType === 'snippet') {
                    const targetSnippetId = routeEntityId || commandId || '';
                    const foundSnippet = (resolvedEntity?.type === 'snippet' ? resolvedEntity.entity : null) ||
                        (targetSnippetId ? snippetCandidates.find(item => matchesEntityId(item, targetSnippetId)) : null) ||
                        snippetCandidates.find(item => normalizedRouteQuery &&
                            (includesQuery(item.title, normalizedRouteQuery) ||
                                includesQuery((item as any).key, normalizedRouteQuery) ||
                                includesQuery((item as any).name, normalizedRouteQuery)));
                    if (foundSnippet || editorProps) {
                        if (editorProps && editorProps.props) {
                            useUIStore.getState().setView({ type: 'home' });
                            useUIStore.getState().openEditor({
                                type: 'snippet',
                                id: String(foundSnippet?.id || targetSnippetId || 'new'),
                                props: {
                                    ...editorProps.props,
                                    snippet: editorProps.props.snippet || editorProps.props.item || foundSnippet,
                                    item: editorProps.props.item || editorProps.props.snippet || foundSnippet,
                                    editMode: true,
                                    category: 'snippet',
                                },
                            });
                        }
                        else if (foundSnippet) {
                            openSnippetById(String(foundSnippet.id), foundSnippet);
                        }
                    }
                    else {
                        useUIStore.getState().setView({ type: 'home' });
                        searchbarRef.current?.setValue(routeQuery);
                        searchbarRef.current?.focus?.();
                    }
                }
                else if (routeEntityType === 'prompt' || routeEntityType === 'agent') {
                    const isChatAgentTrigger = routeEntityType === 'agent';
                    const foundChatAgent = (resolvedEntity?.type === 'chatAgent' ? resolvedEntity.entity : null) ||
                        (isChatAgentTrigger
                            ? chatAgentCandidates.find((item: any) => matchesEntityId(item, routeEntityId)) ||
                                chatAgentCandidates.find((item: any) => includesQuery(item.title, normalizedRouteQuery))
                            : null);
                    if (foundChatAgent) {
                        useUIStore.getState().setView({ type: 'home' });
                        if (!routeEditMode)
                            searchbarRef.current?.selectSavedAgent?.(normalizeChatAgentForAiPanel(foundChatAgent));
                        useUIStore.getState().openEditor({
                            type: 'ai',
                            id: String(foundChatAgent.id || routeEntityId || 'new'),
                            props: {
                                ...(editorProps?.props || {}),
                                item: editorProps?.props?.item || foundChatAgent,
                                snippet: editorProps?.props?.snippet || foundChatAgent,
                                editMode: true,
                                category: 'agent',
                            },
                        });
                        handledUrlTriggerKeyRef.current = currentTriggerKey;
                        releaseOmniboxInvocation();
                        window.history.replaceState({}, '', window.location.pathname);
                        return;
                    }
                    if (isChatAgentTrigger) {
                        useUIStore.getState().setView({ type: 'home' });
                        searchbarRef.current?.setValue(routeQuery);
                        searchbarRef.current?.focus?.();
                        handledUrlTriggerKeyRef.current = currentTriggerKey;
                        releaseOmniboxInvocation();
                        return;
                    }
                    const foundPrompt = (resolvedEntity?.type === 'aiPrompt' ? resolvedEntity.entity : null) ||
                        (routeEntityId ? aiPromptCandidates.find(item => matchesEntityId(item, routeEntityId)) : null) ||
                        aiPromptCandidates.find(item => includesQuery(item.title, normalizedRouteQuery));
                    if (foundPrompt || editorProps) {
                        useUIStore.getState().setView({ type: 'home' });
                        const isRunPromptFromOmniboxCommand = urlParams.get('omnibox') === 'true' && routeRunPrompt && !routeEditMode && !editorProps;
                        if (isRunPromptFromOmniboxCommand && foundPrompt && requestMissingAiPromptInput) {
                            requestMissingAiPromptInput({
                                promptRecord: foundPrompt,
                                promptId: String(foundPrompt.id || entityId || 'new'),
                                editorProps,
                                initialPrompt: temporaryPrompt,
                            });
                        }
                        else {
                            useUIStore.getState().openItemEditor('aiPrompt', String(foundPrompt?.id || routeEntityId || 'new'), {
                                props: {
                                    ...(editorProps?.props || {}),
                                    item: editorProps?.props?.item || foundPrompt,
                                    snippet: editorProps?.props?.snippet || foundPrompt,
                                    editMode: true,
                                    category: 'aiPrompt',
                                },
                            });
                        }
                    }
                    else {
                        useUIStore.getState().setView({ type: 'home' });
                        if (searchbarRef.current && routeQuery) {
                            searchbarRef.current.setValue(routeQuery);
                            searchbarRef.current.focus?.();
                        }
                    }
                }
                else if (routeEntityType === 'todo') {
                    const foundTodo = (resolvedEntity?.type === 'todo' ? resolvedEntity.entity : null) ||
                        routeCandidates.todos.find(item => matchesEntityId(item, routeEntityId)) ||
                        (normalizedRouteQuery
                            ? routeCandidates.todos.find(item => includesQuery(item.title || item.text || item.description || item.body, normalizedRouteQuery))
                            : null);
                    if (foundTodo || editorProps) {
                        useUIStore.getState().setView({ type: 'home' });
                        useUIStore
                            .getState()
                            .setTodoCreatePrefill(foundTodo || editorProps?.props?.prefill || editorProps?.props?.item);
                        useUIStore.getState().openItemEditor('todo', String(foundTodo?.id || routeEntityId || 'new'), editorProps);
                    }
                    else {
                        useUIStore.getState().setView({ type: 'home' });
                        searchbarRef.current?.setValue(routeQuery);
                        searchbarRef.current?.focus?.();
                    }
                }
                else if (routeIntent.kind === 'open-command') {
                    if (routeIntent.commandId) {
                        console.log('[UrlTrigger][omnibox] executing command through searchbar', {
                            commandId: routeIntent.commandId,
                            query: routeIntent.query,
                        });
                        if (routeIntent.commandId === 'search') {
                            openSpreadsheetView();
                            handledUrlTriggerKeyRef.current = currentTriggerKey;
                            releaseOmniboxInvocation();
                            window.history.replaceState({}, '', window.location.pathname);
                            return;
                        }
                        if (routeIntent.query) {
                            searchbarRef.current.setValue(routeIntent.query);
                        }
                        setTimeout(() => {
                            searchbarRef.current?.executeCommand(routeIntent.commandId as any, { mode: 'execute' });
                        }, 50);
                    }
                }
                handledUrlTriggerKeyRef.current = currentTriggerKey;
                releaseOmniboxInvocation();
                window.history.replaceState({}, '', window.location.pathname);
            };
            void tryHandleOmnibox().catch(error => {
                console.error('[useUrlTriggers] Unhandled omnibox trigger failure:', error);
                releaseOmniboxInvocation();
            });
            return;
        }
        if (urlParams.get('trigger_hotkey') !== 'true')
            return;
        const type = urlParams.get('type');
        const rawId = urlParams.get('id');
        const collectionOpenBehavior = getCollectionOpenBehaviorFromUrl(urlParams);
        if (!rawId) {
            console.warn('[App] [HOTKEY_TRIGGER] Trigger detected but missing ID parameter');
            replaceTriggerUrlWithNormalNewtabUrl();
            return;
        }
        const invocationKey = currentTriggerKey;
        const windowWithHotkeyGuard = window as typeof window & {
            __cmdosHotkeyInvocationsInFlight?: Set<string>;
        };
        const inFlightHotkeyInvocations = windowWithHotkeyGuard.__cmdosHotkeyInvocationsInFlight ||
            new Set<string>();
        windowWithHotkeyGuard.__cmdosHotkeyInvocationsInFlight = inFlightHotkeyInvocations;
        if (inFlightHotkeyInvocations.has(invocationKey)) {
            console.warn('[UrlTrigger][hotkey] duplicate invocation suppressed', {
                invocationKey,
                type,
                rawId,
            });
            return;
        }
        inFlightHotkeyInvocations.add(invocationKey);
        isHandlingUrlTrigger.current = true;
        let attempts = 0;
        const maxAttempts = 80;
        const retryDelayMs = 100;
        const findById = (records: any[], id: string) => records.find(record => String(record?.id) === id);
        const finishHotkeyTrigger = () => {
            inFlightHotkeyInvocations.delete(invocationKey);
            isHandlingUrlTrigger.current = false;
            handledUrlTriggerKeyRef.current = currentTriggerKey;
            replaceTriggerUrlWithNormalNewtabUrl();
        };
        const tryHandle = async () => {
            let normalizedId = rawId.startsWith('/') ? rawId.substring(1) : rawId;
            normalizedId = normalizedId.replace(/^automation-/, '').replace(/^agent-/, '');
            const hotkeyRouteIntent = parseCommandTerminalUrlRoute(urlParams, {
                source: 'hotkey',
                fallbackCommandId: normalizedId,
            });
            const hotkeyRouteReadiness = getCommandTerminalUrlRouteReadiness(hotkeyRouteIntent);
            const hotkeyEntityType = hotkeyRouteIntent.kind === 'open-entity' || hotkeyRouteIntent.kind === 'search-entity'
                ? hotkeyRouteIntent.entityType
                : null;
            console.log('[UrlTrigger][hotkey] handling attempt', {
                type,
                rawId,
                normalizedId,
                hotkeyRouteIntent,
                attempts,
                isDbInitialized: useDbStore.getState().isInitialized,
                renderIsDbInitialized: isDbInitialized,
                hasSearchbarRef: Boolean(searchbarRef.current),
                userReady: userId !== '',
            });
            if (hotkeyRouteIntent.kind === 'open-command' && await tryRunDirectUrlCommand(normalizedId)) {
                console.log('[UrlTrigger][hotkey] command handled by direct URL executor', {
                    commandId: normalizedId,
                });
                finishHotkeyTrigger();
                return;
            }
            if (hotkeyEntityType === 'collection') {
                const currentIsDbInitialized = useDbStore.getState().isInitialized;
                if (!currentIsDbInitialized) {
                    console.log('[UrlTrigger][hotkey] waiting for collection DB readiness', {
                        normalizedId,
                        attempts,
                        renderIsDbInitialized: isDbInitialized,
                    });
                    if (attempts++ < maxAttempts) {
                        window.setTimeout(tryHandle, retryDelayMs);
                    }
                    else {
                        console.warn('[UrlTrigger][hotkey] collection trigger timed out before DB became ready', {
                            normalizedId,
                            currentIsDbInitialized,
                            renderIsDbInitialized: isDbInitialized,
                        });
                        finishHotkeyTrigger();
                    }
                    return;
                }
                const didLaunch = await launchCollectionViewById(normalizedId, collectionOpenBehavior);
                sessionFlowUrlTriggerDebug('[UrlTrigger][hotkey] collection launch result', {
                    normalizedId,
                    didLaunch,
                    collectionOpenBehavior,
                });
                handledUrlTriggerKeyRef.current = currentTriggerKey;
                if (!didLaunch) {
                    console.warn(`[App] Collection view not found for ID: ${normalizedId}`);
                }
                finishHotkeyTrigger();
                return;
            }
            const currentIsDbInitialized = useDbStore.getState().isInitialized;
            if ((hotkeyRouteReadiness.needsSearchbarRef && !searchbarRef.current) ||
                !currentIsDbInitialized) {
                console.log('[UrlTrigger][hotkey] waiting for searchbar readiness', {
                    type,
                    normalizedId,
                    attempts,
                    hasSearchbarRef: Boolean(searchbarRef.current),
                    hotkeyRouteReadiness,
                    currentIsDbInitialized,
                    renderIsDbInitialized: isDbInitialized,
                });
                if (attempts++ < maxAttempts) {
                    window.setTimeout(tryHandle, retryDelayMs);
                }
                else {
                    console.warn('[UrlTrigger][hotkey] trigger timed out before UI became ready', {
                        type,
                        normalizedId,
                        currentIsDbInitialized,
                        renderIsDbInitialized: isDbInitialized,
                        hasSearchbarRef: Boolean(searchbarRef.current),
                    });
                    finishHotkeyTrigger();
                }
                return;
            }
            if (hotkeyRouteIntent.kind === 'open-command') {
                console.log('[UrlTrigger][hotkey] executing command through searchbar', {
                    commandId: normalizedId,
                });
                searchbarRef.current?.executeCommand(normalizedId as any, { mode: 'execute' });
                if (searchbarRef.current && !searchbarRef.current.isLocked)
                    searchbarRef.current.focus();
                finishHotkeyTrigger();
                return;
            }
            if (hotkeyEntityType === 'agent' || hotkeyEntityType === 'prompt') {
                const latestDbState = useDbStore.getState();
                const routeCandidates = await getRouteEntityCandidateSnapshot(hotkeyEntityType, latestDbState);
                const actualItemId = extractSnippetIdFromCompoundId(normalizedId);
                const isChatAgentTrigger = hotkeyEntityType === 'agent';
                if (isChatAgentTrigger) {
                    const chatAgentCandidates = routeCandidates.chatAgents;
                    const foundChatAgent = findById(chatAgentCandidates, actualItemId) ||
                        chatAgentCandidates.find((agent: any) => includesQuery(agent.title, normalizedId));
                    if (foundChatAgent) {
                        useUIStore.getState().setView({ type: 'home' });
                        useUIStore.getState().openEditor({ type: 'ai', id: String(foundChatAgent.id) });
                        finishHotkeyTrigger();
                        return;
                    }
                }
                // Also check AI Prompts!
                const aiPromptCandidates = routeCandidates.aiPrompts;
                let foundPrompt = findById(aiPromptCandidates, normalizedId);
                if (!foundPrompt) {
                    foundPrompt = aiPromptCandidates.find((p: any) => includesQuery(p.title, normalizedId));
                }
                if (foundPrompt) {
                    useUIStore.getState().setView({ type: 'home' });
                    if (requestMissingAiPromptInput) {
                        requestMissingAiPromptInput({
                            promptRecord: foundPrompt,
                            promptId: String(foundPrompt.id),
                            title: foundPrompt.title || 'AI Prompt',
                        });
                    }
                    else {
                        useUIStore.getState().openEditor({ type: 'aiPrompt', id: String(foundPrompt.id) });
                    }
                    finishHotkeyTrigger();
                    return;
                }
                searchbarRef.current?.executeCommand(normalizedId as any, { mode: 'execute' });
                if (searchbarRef.current && !searchbarRef.current.isLocked)
                    searchbarRef.current.focus();
                finishHotkeyTrigger();
                return;
            }
            if (hotkeyEntityType === 'session') {
                const latestDbState = useDbStore.getState();
                const routeCandidates = await getRouteEntityCandidateSnapshot(hotkeyEntityType, latestDbState);
                const actualItemId = extractSnippetIdFromCompoundId(normalizedId);
                const foundSession = findById(routeCandidates.sessions, actualItemId) ||
                    routeCandidates.sessions.find((session: any) => includesQuery(session.title || session.sessionName || session.name, normalizedId));
                if (foundSession) {
                    await launchSessionSmartWithReferences(foundSession, {
                        source: 'url_trigger',
                        requireAutoSave: false,
                    });
                    finishHotkeyTrigger();
                }
                else {
                    console.warn(`[App] Session not found for ID: ${normalizedId}. Falling back to command execution.`);
                    searchbarRef.current?.executeCommand(normalizedId as any, { mode: 'execute' });
                    if (searchbarRef.current && !searchbarRef.current.isLocked)
                        searchbarRef.current.focus();
                    finishHotkeyTrigger();
                }
                return;
            }
            if (hotkeyEntityType === 'todo') {
                try {
                    const resolved = await resolveRouteEntityById('todo', normalizedId);
                    if (resolved) {
                        useUIStore.getState().setView({ type: 'home' });
                        useUIStore.getState().setTodoCreatePrefill(resolved.entity);
                        useUIStore.getState().openItemEditor('todo', String(resolved.entity.id));
                    }
                    else {
                        useUIStore.getState().queueNotification({ message: 'The selected item is no longer available.', type: 'error' });
                    }
                }
                finally {
                    finishHotkeyTrigger();
                }
                return;
            }
            if (hotkeyEntityType === 'link' || hotkeyEntityType === 'note' || hotkeyEntityType === 'snippet') {
                const latestDbState = useDbStore.getState();
                const routeCandidates = await getRouteEntityCandidateSnapshot(hotkeyEntityType, latestDbState);
                const isLinkType = hotkeyEntityType === 'link';
                const isNoteType = hotkeyEntityType === 'note';
                const actualItemId = extractSnippetIdFromCompoundId(normalizedId);
                const foundItem: any = isLinkType
                    ? findById(routeCandidates.links, actualItemId) || findById(routeCandidates.snippets, actualItemId)
                    : isNoteType
                        ? findById(routeCandidates.notes, actualItemId) || findById(routeCandidates.snippets, actualItemId)
                        : findById(routeCandidates.snippets, actualItemId) || findById(routeCandidates.notes, actualItemId);
                if (foundItem && isLinkType) {
                    if (searchbarRef.current?.executeSnippet) {
                        searchbarRef.current.executeSnippet(foundItem);
                    }
                    else {
                        useUIStore.getState().openCreateItem('link', { id: 'new', props: { category: 'link' } });
                    }
                }
                else if (foundItem) {
                    if (isNoteType) {
                        openNoteById(String(foundItem.id), foundItem);
                    }
                    else {
                        openSnippetById(String(foundItem.id), foundItem);
                    }
                }
                else {
                    console.warn(`[App] ${type} not found for ID: ${normalizedId}. Falling back to command execution.`);
                    searchbarRef.current?.executeCommand(normalizedId as any, { mode: 'execute' });
                    if (searchbarRef.current && !searchbarRef.current.isLocked)
                        searchbarRef.current.focus();
                }
                finishHotkeyTrigger();
                return;
            }
        };
        tryHandle();
        return;
    }, [
        dbLinks,
        dbNotes,
        dbSnippets,
        isDbInitialized,
        openSpreadsheetView,
        requestMissingAiPromptInput,
        searchbarRef,
        setIsGlobalCreateMenuOpen,
        userId
    ]);
    // On every page load (including refresh with no URL params), check if this Chrome window
    // has an active session. If yes, auto-open the session editor so the pinned tab recovers.
    useEffect(() => {
        const chromeAny = (window as any)?.chrome;
        if (!chromeAny?.windows || !chromeAny?.storage?.local)
            return;
        // Only activate if the URL doesn't already have session_mode (that case is handled above)
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('session_mode') === 'true')
            return;
        if (urlParams.get('session_reference') === 'true')
            return;
        if (hasCollectionItemRoute(urlParams))
            return;
        if (urlParams.get('skip_session_recovery') === 'true') {
            sessionFlowUrlTriggerDebug('[SessionFlow][useUrlTriggers] skip_session_recovery=true detected; leaving dashboard view open');
            return;
        }
        chromeAny.windows.getCurrent((currentWindow: any) => {
            if (!currentWindow?.id)
                return;
            chromeAny.storage.local.get('active_sessions', (result: any) => {
                const sessions: {
                    sessionId: string;
                    sessionName: string;
                    windowId: number;
                    launchSource?: string;
                }[] = result.active_sessions || [];
                const matchedSession = sessions.find(s => s.windowId === currentWindow.id);
                if (matchedSession) {
                    if (matchedSession.launchSource === 'dashboard_view') {
                        sessionFlowUrlTriggerDebug('[SessionFlow][useUrlTriggers] Dashboard-launched active session found on refresh; leaving dashboard view open:', matchedSession.sessionId);
                        return;
                    }
                    const activeEditor = useUIStore.getState().activeEditor;
                    const alreadyOpenedFromUrl = openedSessionFromUrlRef.current === matchedSession.sessionId;
                    const isAlreadyActiveEditor = activeEditor?.type === 'session' && String(activeEditor.id || '') === String(matchedSession.sessionId);
                    if (alreadyOpenedFromUrl || isAlreadyActiveEditor) {
                        return;
                    }
                    sessionFlowUrlTriggerDebug('[SessionFlow][useUrlTriggers] Active session found for this window on load/refresh:', matchedSession.sessionId, '- opening session editor');
                    useUIStore.getState().openEditor({
                        type: 'session',
                        id: matchedSession.sessionId,
                        props: {
                            session: {
                                id: matchedSession.sessionId,
                                title: matchedSession.sessionName || 'Untitled Tab Session',
                            },
                        },
                    });
                }
                else {
                    sessionFlowUrlTriggerDebug('[SessionFlow][useUrlTriggers] No active session for this window (normal tab load). windowId:', currentWindow.id);
                }
            });
        });
    }, []);
    useEffect(() => {
        const chromeAny = (window as typeof window & {
            chrome?: typeof chrome;
        }).chrome;
        if (!chromeAny?.runtime?.connect || !chromeAny?.tabs?.getCurrent)
            return;
        const urlParams = new URLSearchParams(window.location.search);
        const isSessionControlPage = urlParams.get('skip_session_recovery') === 'true' || urlParams.get('session_mode') === 'true';
        if (!isSessionControlPage)
            return;
        let controlPort: chrome.runtime.Port | undefined;
        chromeAny.tabs.getCurrent(tab => {
            if (typeof tab?.id !== 'number')
                return;
            controlPort = chromeAny.runtime.connect({ name: `session-control:${tab.id}` });
            console.log('[SessionLaunchTrace] control port connected', { tabId: tab.id });
            controlPort.onMessage.addListener((message: any) => {
                if (message?.type !== 'OPEN_SESSION_REFERENCES' || !Array.isArray(message.items))
                    return;
                console.log('[SessionLaunchTrace] target control tab received references', {
                    tabId: tab.id,
                    sessionId: message.sessionId,
                    itemCount: message.items.length,
                });
                const dispatchKey = `${tab.id}:${message.sessionId || ''}:${JSON.stringify(message.items)}`;
                if (handledSessionReferenceDispatchesRef.current.has(dispatchKey))
                    return;
                handledSessionReferenceDispatchesRef.current.add(dispatchKey);
                void handleSessionReferenceLaunchActions(message.items, {
                    aiPrompts: useDbStore.getState().aiPrompts || [],
                    chatAgents: useDbStore.getState().chatAgents || [],
                    shouldContinue: async () => {
                        const response = await chromeAny.runtime.sendMessage({ action: 'get_active_session_status' });
                        return (response?.ok === true &&
                            String(response.active_session?.sessionId || '') === String(message.sessionId || '') &&
                            response.active_session?.pinnedTabId === tab.id);
                    },
                });
            });
        });
        return () => controlPort?.disconnect();
    }, []);
};
