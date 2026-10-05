import { getEntityCategoryForReferenceType } from '../../utils/idGenerator';
export type CommandTerminalRouteEntityType = 'note' | 'link' | 'collection' | 'session' | 'snippet' | 'todo' | 'prompt' | 'agent';
export type CommandTerminalUrlRouteIntent = {
    kind: 'search-command';
    query: string;
    source: 'newtab' | 'omnibox' | 'hotkey';
} | {
    kind: 'create-entity';
    entityType: CommandTerminalRouteEntityType;
    entityId?: string;
    query: string;
    activeTabUrl: string;
    activeTabTitle: string;
    source: 'newtab' | 'omnibox' | 'hotkey';
} | {
    kind: 'open-command';
    commandId: string;
    query: string;
    source: 'newtab' | 'omnibox' | 'hotkey';
} | {
    kind: 'open-entity';
    entityType: CommandTerminalRouteEntityType;
    entityId: string;
    query: string;
    editMode: boolean;
    runPrompt: boolean;
    source: 'newtab' | 'omnibox' | 'hotkey';
} | {
    kind: 'search-entity';
    entityType: CommandTerminalRouteEntityType;
    query: string;
    editMode: boolean;
    runPrompt: boolean;
    source: 'newtab' | 'omnibox' | 'hotkey';
} | {
    kind: 'invalid';
    reason: string;
    source: 'newtab' | 'omnibox' | 'hotkey';
};
export type CommandTerminalUrlRouteReadiness = {
    needsDbReady: boolean;
    needsSearchbarRef: boolean;
    needsUserReady: boolean;
};
const ROUTE_ENTITY_TYPE_OVERRIDES: Record<string, CommandTerminalRouteEntityType> = {
    tabgroup: 'link',
    session: 'session',
    sessions: 'session',
    'tab session': 'session',
    'tab sessions': 'session',
    collection_view: 'collection',
};
const isCommandTerminalRouteEntityType = (type: string | null): type is CommandTerminalRouteEntityType => Boolean(type && ['note', 'link', 'collection', 'session', 'snippet', 'todo', 'prompt', 'agent'].includes(type));
/** Normalizes URL entity aliases into the canonical command-terminal route type. */
export function normalizeCommandTerminalRouteEntityType(type: string | null | undefined): CommandTerminalRouteEntityType | null {
    const normalizedType = String(type || '').trim().toLowerCase();
    const routeOverride = ROUTE_ENTITY_TYPE_OVERRIDES[normalizedType];
    if (routeOverride)
        return routeOverride;
    const sharedCategory = getEntityCategoryForReferenceType(normalizedType);
    return isCommandTerminalRouteEntityType(sharedCategory) ? sharedCategory : null;
}
/** Converts omnibox/hotkey URL params into a neutral route intent before any UI code runs. */
export function parseCommandTerminalUrlRoute(urlParams: URLSearchParams, options: {
    source: 'newtab' | 'omnibox' | 'hotkey';
    fallbackCommandId?: string | null;
}): CommandTerminalUrlRouteIntent {
    const rawType = urlParams.get('type');
    const query = String(urlParams.get('query') || '').trim();
    const commandId = String(urlParams.get('id') || options.fallbackCommandId || '').trim();
    const entityId = String(urlParams.get('entityId') ||
        urlParams.get('noteid') ||
        urlParams.get('linkid') ||
        urlParams.get('snippetid') ||
        commandId ||
        '').trim();
    const activeTabUrl = String(urlParams.get('active_tab_url') || '').trim();
    const activeTabTitle = String(urlParams.get('active_tab_title') || '').trim();
    const editMode = urlParams.get('edit_mode') === 'true';
    const runPrompt = urlParams.get('runPrompt') === 'true';
    if (urlParams.get('create_link') === 'true') {
        return { kind: 'create-entity', entityType: 'link', query, activeTabUrl, activeTabTitle, source: options.source };
    }
    if (urlParams.get('create_prompt') === 'true') {
        return { kind: 'create-entity', entityType: 'prompt', query, activeTabUrl, activeTabTitle, source: options.source };
    }
    if (urlParams.get('session_mode') === 'true') {
        return {
            kind: 'create-entity',
            entityType: 'session',
            entityId: String(urlParams.get('session_id') || '').trim(),
            query: String(urlParams.get('session_name') || query || '').trim(),
            activeTabUrl,
            activeTabTitle,
            source: options.source,
        };
    }
    if (urlParams.get('create_note') === 'true') {
        return { kind: 'create-entity', entityType: 'note', query, activeTabUrl, activeTabTitle, source: options.source };
    }
    if (urlParams.get('create_snippet') === 'true') {
        return { kind: 'create-entity', entityType: 'snippet', query, activeTabUrl, activeTabTitle, source: options.source };
    }
    if (urlParams.get('create_todo') === 'true') {
        return { kind: 'create-entity', entityType: 'todo', query, activeTabUrl, activeTabTitle, source: options.source };
    }
    if (urlParams.get('create_chat_agent') === 'true') {
        return { kind: 'create-entity', entityType: 'agent', query, activeTabUrl, activeTabTitle, source: options.source };
    }
    if (rawType === 'command') {
        return commandId
            ? { kind: 'open-command', commandId, query, source: options.source }
            : query ? { kind: 'search-command', query, source: options.source }
                : { kind: 'invalid', reason: 'missing-command-id', source: options.source };
    }
    const entityType = normalizeCommandTerminalRouteEntityType(rawType);
    if (!entityType) {
        return { kind: 'invalid', reason: 'unsupported-type', source: options.source };
    }
    if (entityId) {
        return { kind: 'open-entity', entityType, entityId, query, editMode, runPrompt, source: options.source };
    }
    if (query) {
        return { kind: 'search-entity', entityType, query, editMode, runPrompt, source: options.source };
    }
    return { kind: 'invalid', reason: 'missing-entity-target', source: options.source };
}
/** Describes which runtime dependencies a parsed URL route needs before execution. */
export function getCommandTerminalUrlRouteReadiness(intent: CommandTerminalUrlRouteIntent): CommandTerminalUrlRouteReadiness {
    if (intent.kind === 'invalid') {
        return { needsDbReady: false, needsSearchbarRef: false, needsUserReady: false };
    }
    if (intent.kind === 'create-entity') {
        return { needsDbReady: false, needsSearchbarRef: false, needsUserReady: false };
    }
    if (intent.kind === 'open-command' || intent.kind === 'search-command') {
        return { needsDbReady: true, needsSearchbarRef: true, needsUserReady: true };
    }
    const isDirectOpen = intent.kind === 'open-entity';
    const needsSearchbarRef = intent.kind === 'search-entity'
        || ((intent.entityType === 'agent' || intent.entityType === 'link') && !intent.editMode);
    return {
        needsDbReady: true,
        needsSearchbarRef,
        needsUserReady: !isDirectOpen,
    };
}
