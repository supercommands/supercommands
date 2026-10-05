import { createWebsitePopupCreateSession } from './websitePopupCreateSession';
import { createWebsitePopupCollectionSession } from './websitePopupCollectionSession';
import { getWebsitePopupCollectionPresentation, isWebsitePopupCollectionSubmode } from './websitePopupPresentation';
import { reduceWebsitePopupScreenshotInteraction } from './websitePopupScreenshotReducer';
import { reduceWebsitePopupCreateInteraction } from './websitePopupCreateReducer';
import { isWebsitePopupSendAgentRoute, reduceWebsitePopupSendAgentInteraction } from './websitePopupSendAgentReducer';
/**
 * Pure transitions for the five supported popup routes.
 *
 * DOM keyboard handlers will later translate Backspace and Escape into the
 * semantic BACK_REQUESTED event. This reducer never receives browser events.
 */
import type { WebsitePopupBaseRoute, WebsitePopupInteractionEvent, WebsitePopupRoute, WebsitePopupInteractionState, } from './websitePopupInteractionTypes';
import { getWebsitePopupCreateOptionBackField } from './websitePopupKeyboardIntentResolver';
export const createInitialWebsitePopupInteractionState = (): WebsitePopupInteractionState => ({
    inputValue: '',
    route: { kind: 'default', query: '' },
    parsedIntent: { kind: 'none' },
    createSession: null,
    sendAgentSession: null,
    selectedIndex: 0,
    suggestionCount: 0,
});
const normalizeQuery = (query: string): string => query.replace(/\u00a0/g, ' ');
const getBaseRoute = (state: WebsitePopupInteractionState): WebsitePopupBaseRoute => {
    let route = state.route;
    while (route.kind !== 'default' && route.kind !== 'suggestions')
        route = route.returnTo;
    return route;
};
const createBaseRouteForQuery = (query: string): WebsitePopupBaseRoute => {
    const normalizedQuery = normalizeQuery(query);
    return normalizedQuery.length === 0
        ? { kind: 'default', query: '' }
        : { kind: 'suggestions', query: normalizedQuery };
};
const createRouteForParsedIntent = (inputValue: string, parsedIntent: WebsitePopupInteractionState['parsedIntent']): WebsitePopupRoute => {
    const baseRoute = createBaseRouteForQuery(inputValue);
    if (parsedIntent.kind === 'collection') return { kind: 'submode', submode: { id: parsedIntent.mode }, presentation: 'inline', query: parsedIntent.query, returnTo: baseRoute };
    if (parsedIntent.kind === 'none')
        return baseRoute;
    if (parsedIntent.kind === 'filter' && parsedIntent.entity === null) {
        return {
            kind: 'filter',
            entity: null,
            query: parsedIntent.query,
            returnTo: parsedIntent.actionPrefix === '/'
                ? { kind: 'default', query: '' }
                : baseRoute,
        };
    }
    const route = {
        entity: parsedIntent.entity,
        query: parsedIntent.query,
        returnTo: baseRoute,
        ...(parsedIntent.kind === 'create' && parsedIntent.phase === 'chooser'
            ? { returnToCreateChooser: true }
            : {}),
    };
    // Parser-driven command chains retain the inline presentation.
    return parsedIntent.kind === 'create'
        ? { ...route, kind: 'create', presentation: 'inline' }
        : { ...route, kind: parsedIntent.kind };
};
/** Keep complete command rows visible until Enter, click, or a committing space. */
const isPendingCommandSelection = (inputValue: string, parsedIntent: WebsitePopupInteractionState['parsedIntent']): boolean => {
    // Slash opens the filter chooser immediately rather than waiting for commitment.
    if (parsedIntent.kind === 'filter' && parsedIntent.entity === null && parsedIntent.actionPrefix === '/')
        return false;
    if (parsedIntent.kind === 'create') {
        return parsedIntent.phase === 'chooser'
            && (parsedIntent.query.length > 0 || !/\s$/.test(inputValue));
    }
    if (/\s$/.test(inputValue))
        return false;
    return (parsedIntent.kind === 'save' || parsedIntent.kind === 'filter' || parsedIntent.kind === 'collection')
        && parsedIntent.query.length === 0;
};
const clampSuggestionCount = (count: number): number => Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
const clampSelection = (index: number, count: number): number => {
    if (count <= 0)
        return 0;
    const normalizedIndex = Number.isFinite(index) ? Math.floor(index) : 0;
    return Math.max(0, Math.min(normalizedIndex, count - 1));
};
function reduceWebsitePopupBaseInteraction(state: WebsitePopupInteractionState, event: WebsitePopupInteractionEvent): WebsitePopupInteractionState {
    const sendAgentTransition = reduceWebsitePopupSendAgentInteraction(state, event);
    if (sendAgentTransition) return sendAgentTransition;
    const screenshotTransition = reduceWebsitePopupScreenshotInteraction(state, event);
    if (screenshotTransition) return screenshotTransition;
    const createTransition = reduceWebsitePopupCreateInteraction(state, event);
    if (createTransition)
        return createTransition;
    switch (event.type) {
        case 'COLLECTION_PANEL_EXITED': {
            const route = getBaseRoute(state);
            return { ...state, route, inputValue: route.query, collectionSession: null, selectedIndex: 0, suggestionCount: 0 };
        }
        case 'COLLECTION_PANEL_CONFIGURED': {
            if (getWebsitePopupCollectionPresentation(state.route) !== 'standalone') return state;
            const ready = Boolean(event.collectionId) && (event.hasRecord || event.itemType === 'link' || event.itemType === 'article');
            return { ...state, inputValue: '', parsedIntent: { kind: 'none' }, selectedIndex: 0, suggestionCount: 0,
                route: { kind: 'submode', submode: { id: ready ? 'collection-item-details' : 'collection-destination' },
                    presentation: 'standalone', query: '', returnTo: getBaseRoute(state) },
                collectionSession: { ...createWebsitePopupCollectionSession(), captureType: event.itemType,
                    captureRevision: (state.collectionSession?.captureRevision || 0) + 1,
                    sourceUrl: event.sourceContext.url, sourceContext: event.sourceContext,
                    selectedCollectionId: event.collectionId, selectedCollectionName: event.collectionName } };
        }
        case 'COLLECTION_WEB_SCRAPING_SELECTION_REQUESTED':
            return state.collectionSession?.captureType === 'web-scraping'
                && state.collectionSession.captureRevision === event.revision && Boolean(state.collectionSession.selectedCollectionId)
                && state.route.kind === 'submode' && ['collection-destination', 'collection-item-details'].includes(state.route.submode.id)
                ? { ...state, collectionSession: { ...state.collectionSession, pickerOpen: false },
                    route: { ...state.route, submode: { id: 'collection-destination' }, query: '' }, inputValue: '', selectedIndex: 0, suggestionCount: 0 } : state;
        case 'COLLECTION_WEB_SCRAPING_READY':
            return state.collectionSession?.captureType === 'web-scraping'
                && state.collectionSession.captureRevision === event.revision
                && state.route.kind === 'submode' && state.route.submode.id === 'collection-destination'
                && !state.collectionSession.pickerOpen
                ? { ...state, route: { kind: 'submode', submode: { id: 'collection-item-details' }, presentation: getWebsitePopupCollectionPresentation(state.route), query: '', returnTo: state.route.returnTo }, inputValue: '', selectedIndex: 0, suggestionCount: 0 } : state;
        case 'COLLECTION_SELECTED': return { ...state, collectionSession: { ...(state.collectionSession || createWebsitePopupCollectionSession()), selectedCollectionId: event.id, selectedCollectionName: null } };
        case 'COLLECTION_CAPTURE_STARTED': return {
            ...state,
            collectionSession: {
                ...(state.collectionSession || createWebsitePopupCollectionSession()),
                captureType: event.itemType,
                screenshot: { status: 'idle' },
                sourceUrl: event.sourceContext?.url || event.sourceUrl || null,
                sourceContext: event.sourceContext || null,
                captureRevision: (state.collectionSession?.captureRevision || 0) + 1,
                pickerOpen: !state.collectionSession?.selectedCollectionId,
            },
            route: { kind: 'submode', submode: { id: (event.itemType === 'link' || event.itemType === 'article') && state.collectionSession?.selectedCollectionId ? 'collection-item-details' : 'collection-destination' }, presentation: getWebsitePopupCollectionPresentation(state.route), query: '', returnTo: state.route },
            inputValue: '',
            parsedIntent: { kind: 'none' },
            selectedIndex: 0,
            suggestionCount: 0,
        };
        case 'COLLECTION_DESTINATION_CHOSEN': return state.route.kind === 'submode'
            && state.route.submode.id === 'collection-destination'
            ? {
                ...state,
                collectionSession: {
                    ...(state.collectionSession || createWebsitePopupCollectionSession()),
                    selectedCollectionId: event.id,
                    selectedCollectionName: event.name,
                    pickerOpen: false,
                },
                route: state.collectionSession?.captureType === 'link' || state.collectionSession?.captureType === 'article'
                    ? { kind: 'submode', submode: { id: 'collection-item-details' }, presentation: getWebsitePopupCollectionPresentation(state.route), query: '', returnTo: state.route.returnTo }
                    : { ...state.route, query: '' },
                inputValue: '',
                selectedIndex: 0,
                suggestionCount: 0,
            } : state;
        case 'COLLECTION_PICKER_OPENED': return {
            ...state,
            collectionSession: { ...(state.collectionSession || createWebsitePopupCollectionSession()), pickerOpen: true },
        };
        case 'COLLECTION_PICKER_CLOSED': return state.route.kind === 'submode'
            && state.route.submode.id === 'collection-destination'
            ? {
                ...state,
                collectionSession: { ...(state.collectionSession || createWebsitePopupCollectionSession()), pickerOpen: false },
                route: { ...state.route, query: '' },
                inputValue: '',
                selectedIndex: 0,
                suggestionCount: 0,
            } : state;
        case 'QUERY_CHANGED': {
            const query = normalizeQuery(event.query);
            const parsedIntent = event.parsedIntent ?? { kind: 'none' as const };
            if (state.route.kind === 'create'
                || state.route.kind === 'save'
                || state.route.kind === 'filter'
                || state.route.kind === 'submode') {
                if (state.route.kind === 'filter'
                    && state.route.entity === null
                    && parsedIntent.kind === 'filter'
                    && parsedIntent.entity !== null
                    && (/\s$/.test(query)
                        || parsedIntent.query.length > 0)) {
                    return {
                        ...state,
                        inputValue: parsedIntent.query,
                        route: {
                            kind: 'filter',
                            entity: parsedIntent.entity,
                            query: parsedIntent.query,
                            returnTo: state.route.returnTo,
                        },
                        parsedIntent: { kind: 'none' },
                        selectedIndex: 0,
                        suggestionCount: 0,
                    };
                }
                if (state.route.kind === 'filter' && state.route.entity === null) {
                    return {
                        ...state,
                        inputValue: query,
                        route: parsedIntent.kind === 'filter'
                            ? { ...state.route, query: parsedIntent.query }
                            : createRouteForParsedIntent(query, parsedIntent),
                        parsedIntent: { kind: 'none' },
                        selectedIndex: 0,
                        suggestionCount: 0,
                    };
                }
                return {
                    ...state,
                    inputValue: query,
                    route: { ...state.route, query },
                    parsedIntent: { kind: 'none' },
                    collectionSession: state.route.kind === 'submode'
                        && state.route.submode.id === 'collection-destination'
                        ? { ...(state.collectionSession || createWebsitePopupCollectionSession()), pickerOpen: true }
                        : state.collectionSession,
                    createSession: state.route.kind === 'create'
                        ? state.createSession
                        : null,
                    selectedIndex: 0,
                    suggestionCount: 0,
                };
            }
            if (parsedIntent.kind !== 'none') {
                if (isPendingCommandSelection(query, parsedIntent)) {
                    return {
                        ...state,
                        inputValue: query,
                        route: createBaseRouteForQuery(query),
                        parsedIntent,
                        selectedIndex: 0,
                        suggestionCount: 0,
                    };
                }
                return {
                    ...state,
                    inputValue: parsedIntent.kind === 'filter' && parsedIntent.entity === null
                        && parsedIntent.actionPrefix === '/'
                        ? query : parsedIntent.query,
                    route: createRouteForParsedIntent(query, parsedIntent),
                    parsedIntent,
                    createSession: parsedIntent.kind === 'create'
                        ? createWebsitePopupCreateSession(parsedIntent.entity) : null,
                    selectedIndex: 0,
                    suggestionCount: 0,
                };
            }
            return {
                ...state,
                inputValue: query,
                route: createRouteForParsedIntent(query, parsedIntent),
                parsedIntent,
                selectedIndex: 0,
                suggestionCount: 0,
            };
        }
        case 'PARSED_INTENT_CHANGED':
            if (state.route.kind === 'create'
                || state.route.kind === 'save'
                || state.route.kind === 'filter'
                || state.route.kind === 'submode') {
                return { ...state, parsedIntent: { kind: 'none' } };
            }
            if (isPendingCommandSelection(state.inputValue, event.parsedIntent)) {
                return {
                    ...state,
                    parsedIntent: event.parsedIntent,
                    route: createBaseRouteForQuery(state.inputValue),
                };
            }
            return {
                ...state,
                inputValue: event.parsedIntent.kind === 'none'
                    || (event.parsedIntent.kind === 'filter'
                        && event.parsedIntent.entity === null
                        && event.parsedIntent.actionPrefix === '/')
                    ? state.inputValue : event.parsedIntent.query,
                parsedIntent: event.parsedIntent,
                route: createRouteForParsedIntent(state.inputValue, event.parsedIntent),
                createSession: event.parsedIntent.kind === 'create'
                    ? createWebsitePopupCreateSession(event.parsedIntent.entity) : null,
            };
        case 'MODE_ENTERED': {
            const nextQuery = normalizeQuery(event.query ?? state.route.query);
            const route = {
                entity: event.entity ?? null,
                query: nextQuery,
                returnTo: getBaseRoute(state),
                returnToCreateChooser: event.mode === 'create' && Boolean(event.returnToCreateChooser),
            };
            return {
                ...state,
                route: event.mode === 'create'
                    ? { ...route, kind: 'create', presentation: event.presentation }
                    : { ...route, kind: event.mode },
                inputValue: nextQuery,
                // A chooser intent belongs to the pre-Create suggestion route only.
                // Keeping it here leaks a stale bottom suggestion into the composer.
                parsedIntent: { kind: 'none' },
                createSession: event.mode === 'create'
                    ? createWebsitePopupCreateSession(event.entity ?? null) : null,
                selectedIndex: 0,
                suggestionCount: 0,
            };
        }
        case 'SUBMODE_ENTERED': {
            return {
                ...state,
                collectionSession: event.submode.id === 'collection-actions'
                    ? state.collectionSession || createWebsitePopupCollectionSession() : state.collectionSession,
                route: {
                    kind: 'submode',
                    submode: event.submode,
                    query: normalizeQuery(event.query ?? ''),
                    returnTo: state.route,
                    ...(isWebsitePopupCollectionSubmode(event.submode)
                        ? { presentation: state.route.kind === 'submode' && isWebsitePopupCollectionSubmode(state.route.submode)
                            ? getWebsitePopupCollectionPresentation(state.route) : event.presentation || 'inline' }
                        : {}),
                },
                inputValue: normalizeQuery(event.query ?? ''),
                parsedIntent: { kind: 'none' },
                selectedIndex: 0,
                suggestionCount: 0,
            };
        }
        case 'BACK_REQUESTED': {
            if (state.route.kind === 'create' && state.createSession?.childMode) {
                if (state.createSession.visibleFieldOrder.includes(state.createSession.childMode)) {
                    const fieldIndex = state.createSession.visibleFieldOrder.indexOf(state.createSession.childMode);
                    const previousField = state.createSession.visibleFieldOrder[fieldIndex - 1];
                    return {
                        ...state,
                        createSession: {
                            ...state.createSession,
                            childMode: null,
                            lastExitedChildField: null,
                            propertyEntryOpen: false,
                            argumentQueries: { ...state.createSession.argumentQueries, [state.createSession.childMode]: '' },
                            focusRequest: previousField
                                ? { target: previousField, revision: (state.createSession.focusRequest?.revision || 0) + 1 }
                                : state.createSession.focusRequest,
                        },
                        selectedIndex: 0,
                        suggestionCount: 0,
                    };
                }
                return {
                    ...state,
                    createSession: {
                        ...state.createSession,
                        childMode: null,
                        lastExitedChildField: state.createSession.childMode,
                        propertyEntryOpen: true,
                        propertyPrefixDraft: '',
                        argumentQueries: {
                            ...state.createSession.argumentQueries,
                            [state.createSession.childMode || '']: '',
                        },
                        focusRequest: {
                            target: 'property-prefix',
                            revision: (state.createSession.focusRequest?.revision || 0) + 1,
                        },
                    },
                    selectedIndex: 0,
                    suggestionCount: 0,
                };
            }
            if (state.route.kind === 'create' && state.createSession?.propertyEntryOpen) {
                const lastField = getWebsitePopupCreateOptionBackField(state.createSession);
                return {
                    ...state,
                    createSession: {
                        ...state.createSession,
                        propertyEntryOpen: false,
                        lastExitedChildField: null,
                        propertyPrefixDraft: '',
                        focusRequest: lastField
                            ? { target: lastField, revision: (state.createSession.focusRequest?.revision || 0) + 1 }
                            : state.createSession.focusRequest,
                    },
                    selectedIndex: 0,
                    suggestionCount: 0,
                };
            }
            if (state.route.kind === 'submode') {
                return {
                    ...state,
                    inputValue: state.route.returnTo.query,
                    route: state.route.returnTo,
                    parsedIntent: { kind: 'none' },
                    collectionSession: state.route.submode.id === 'collection-actions' ? null : state.collectionSession,
                    createSession: state.route.returnTo.kind === 'create'
                        ? state.createSession
                        : null,
                    selectedIndex: 0,
                    suggestionCount: 0,
                };
            }
            if (state.route.kind === 'create') {
                const createEntity = state.route.entity;
                return {
                    ...state,
                    inputValue: state.route.returnTo.query,
                    route: state.route.returnTo,
                    // Returning from Create may show its category chooser, but the
                    // unfinished field draft is discarded at the route boundary.
                    parsedIntent: state.route.returnToCreateChooser && createEntity
                        ? {
                            kind: 'create',
                            entity: createEntity,
                            query: '',
                            phase: 'chooser',
                            categoryPrefix: '',
                        }
                        : { kind: 'none' },
                    createSession: null,
                    selectedIndex: 0,
                    suggestionCount: 0,
                };
            }
            if (state.route.kind === 'save' || state.route.kind === 'filter') {
                return {
                    ...state,
                    inputValue: state.route.returnTo.query,
                    route: state.route.returnTo,
                    parsedIntent: { kind: 'none' },
                    createSession: null,
                    selectedIndex: 0,
                    suggestionCount: 0,
                };
            }
            if (state.route.kind === 'suggestions') {
                return {
                    ...state,
                    inputValue: '',
                    route: { kind: 'default', query: '' },
                    parsedIntent: { kind: 'none' },
                    createSession: null,
                    selectedIndex: 0,
                    suggestionCount: 0,
                };
            }
            return state;
        }
        case 'SUGGESTION_COUNT_CHANGED': {
            const suggestionCount = clampSuggestionCount(event.count);
            return {
                ...state,
                suggestionCount,
                selectedIndex: clampSelection(state.selectedIndex, suggestionCount),
            };
        }
        case 'SELECTION_SET': {
            return {
                ...state,
                selectedIndex: clampSelection(event.index, state.suggestionCount),
            };
        }
        case 'RESET':
            return createInitialWebsitePopupInteractionState();
        default:
            return state;
    }
}

export function reduceWebsitePopupInteraction(state: WebsitePopupInteractionState, event: WebsitePopupInteractionEvent): WebsitePopupInteractionState {
    const next = reduceWebsitePopupBaseInteraction(state, event);
    return next.sendAgentSession && !isWebsitePopupSendAgentRoute(next.route) ? { ...next, sendAgentSession: null } : next;
}
