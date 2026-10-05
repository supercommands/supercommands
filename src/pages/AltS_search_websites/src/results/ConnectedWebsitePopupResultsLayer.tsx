import { writeWebsitePopupCreateSelections } from '../create/websitePopupCreateDraftWriter';
import { useWebsitePopupPickerOptions } from '../create/useWebsitePopupPickerOptions';
/**
 * Single store-aware orchestration wrapper for all popup result sections.
 *
 * It resolves providers, applies one global selection sequence, synchronizes
 * the result count, and delegates rendering to the presentation-only viewport.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiCamera, FiImage, FiSend } from 'react-icons/fi';
import { LuSparkles } from 'react-icons/lu';
import { useStore } from 'zustand';
import { WebsitePopupResults } from '../display/WebsitePopupResults';
import type { WebsitePopupInteractionStoreApi } from '../interaction/createWebsitePopupInteractionStore';
import type { WebsitePopupCreateSurface } from '../interaction/websitePopupInteractionTypes';
import { selectWebsitePopupSuggestionRequest } from '../interaction/websitePopupInteractionSelectors';
import type { WebsitePopupPrefixSettingLike } from '../catalog/websitePopupCreateCatalog';
import { buildWebsitePopupCreateRows } from '../catalog/websitePopupCreateCatalog';
import { resolveWebsitePopupResults } from './resolveWebsitePopupResults';
import { findFirstSelectableWebsitePopupRowIndex, findNextSelectableWebsitePopupRowIndex, } from './websitePopupResultsNavigation';
import type { WebsitePopupSearchSnapshot } from '../../../../shared-components/websitePopup/contracts/websitePopupSearchBridgeContract';
import type { WebsitePopupActionGrammar, WebsitePopupCreateEntityGrammar, } from '../../../../shared-components/websitePopup/contracts/websitePopupPrefixSettingsBridgeContract';
import { WebsitePopupActivationController } from '../execution/WebsitePopupActivationController';
import type { WebsitePopupExecutionIntent } from '../../../../shared-components/websitePopup/contracts/websitePopupExecutionTypes';
import type { ResolvedWebsitePopupResults } from './resolveWebsitePopupResults';
import type { WebsitePopupResolvedSection } from './websitePopupResultsTypes';
import { buildWebsitePopupCreateOptionSections, buildWebsitePopupCreatePropertySections, } from '../create/websitePopupCreatePropertyCatalog';
import { resolveWebsitePopupRouteKeyboardIntent } from '../interaction/websitePopupKeyboardIntentResolver';
import { toggleWebsitePopupMultiSelectValue } from '../interaction/websitePopupMultiSelectController';
import { createWebsitePopupTag } from '../bridge/websitePopupCreateOptionsBridge';
import { createCollection } from '../../../../allObjectFolder/src/createObject/collections/collectionClient';
import { buildWebsitePopupCreateLinkUrlSections, normalizeWebsitePopupManualUrl, normalizeWebsitePopupUrlIdentity, } from '../create/websitePopupCreateLinkUrlCatalog';
import { getWebsitePopupCreatePropertyFields } from '../create/websitePopupCreatePropertyCommand';
import { opensWebsitePopupCreateChildMode } from '../create/websitePopupCreateFieldPolicy';
import { isHotkeyRecordingActive } from '../../../../shared-components/hotkeys/core/hotkeyCapture';
import { findExactWebsitePopupCommandRow } from '../catalog/websitePopupCommandSearchCatalog';
import type { WebsitePopupResolvedRow } from './websitePopupResultsTypes';
import type { WebsitePopupPrefixEditTarget, WebsitePopupTextCommandEditTarget, WebsitePopupResultEditTarget } from '../display/websitePopupDisplayTypes';
import { WebsitePopupTextCommandEditor } from './WebsitePopupTextCommandEditor';
import type { WebsitePopupChatSaveDestination } from './useWebsitePopupSaveChat';
import { getWebsitePopupCompletedTextCommand } from '../catalog/websitePopupCompletedTextCommand';
export type ConnectedWebsitePopupResultsLayerProps = {
    /** Both popup surfaces stage recipients in the shared composer owner. */
    onSendAgentSelected: (target: import('../interaction/websitePopupSendAgentSession').WebsitePopupSendAgentTarget) => void;
    store: WebsitePopupInteractionStoreApi;
    categoryPrefixSettings: readonly WebsitePopupPrefixSettingLike[];
    actionPrefixSettings: readonly WebsitePopupPrefixSettingLike[];
    subcommandPrefixSettings: readonly WebsitePopupPrefixSettingLike[];
    createGrammar: readonly WebsitePopupCreateEntityGrammar[];
    actionGrammar: readonly WebsitePopupActionGrammar[];
    prefixSettingsStatus?: 'loading' | 'ready' | 'failed';
    searchSnapshot: WebsitePopupSearchSnapshot;
    searchSnapshotReady?: boolean;
    searchSnapshotError?: string | null;
    surface?: 'website' | 'newtab';
    keyboardTarget?: ShadowRoot | null;
    keyboardEnabled?: boolean;
    onRequestClose?: () => void;
    onCollapseSidePanel?: () => void;
    sidePanelOpen?: boolean;
    activeCreateSurface?: WebsitePopupCreateSurface;
    sidePanelPickerTarget?: HTMLElement | null;
    resultEditOpen?: boolean;
    onResultEditRequest?: (target: WebsitePopupResultEditTarget) => void;
    onResultEditClose?: () => void;
    canSaveChat?: boolean;
    onChatSaveStage?: (destination: WebsitePopupChatSaveDestination) => void;
    chatSaveError?: string | null;
    textCommandActionPending?: boolean;
    textCommandActionError?: string | null;
};
const applySelection = (sections: WebsitePopupResolvedSection[], selectedIndex: number): ResolvedWebsitePopupResults => {
    let index = 0;
    const selectedSections = sections.map(section => ({
        ...section,
        rows: section.rows.map(row => {
            const rowIndex = index++;
            return { ...row, selected: !row.disabled && rowIndex === selectedIndex };
        }),
    }));
    return { sections: selectedSections, rows: selectedSections.flatMap(section => section.rows) };
};
export function ConnectedWebsitePopupResultsLayer({ store, categoryPrefixSettings, actionPrefixSettings, subcommandPrefixSettings, createGrammar, actionGrammar, prefixSettingsStatus = 'ready', searchSnapshot, searchSnapshotReady = true, searchSnapshotError = null, surface = 'website', keyboardTarget = null, keyboardEnabled = true, onRequestClose, onSendAgentSelected, onCollapseSidePanel, sidePanelOpen = false, activeCreateSurface = 'composer', sidePanelPickerTarget = null, resultEditOpen = false, onResultEditRequest, onResultEditClose, canSaveChat = false, onChatSaveStage, chatSaveError = null, textCommandActionPending = false, textCommandActionError = null, }: ConnectedWebsitePopupResultsLayerProps) {
    const interactionState = useStore(store, current => current.state);
    const dispatch = useStore(store, current => current.dispatch);
    const request = selectWebsitePopupSuggestionRequest(interactionState);
    const submodeRoute = interactionState.route.kind === 'submode'
        ? interactionState.route
        : null;
    const submode = submodeRoute?.submode ?? null;
    const createRoute = interactionState.route.kind === 'create' ? interactionState.route : null;
    const standaloneCreate = createRoute?.presentation === 'standalone';
    const activeCreateGrammar = createGrammar.find(grammar => grammar.entity === createRoute?.entity);
    const activeChildField = activeCreateGrammar?.fields.find(field => field.field === interactionState.createSession?.childMode);
    const activeChildQuery = activeChildField
        ? interactionState.createSession?.argumentQueries[activeChildField.field] || '' : null;
    const [debouncedNormalQuery, setDebouncedNormalQuery] = useState('');
    const lastResolvedNormalQueryRef = useRef('');
    const [activationPending, setActivationPending] = useState(false);
    const [activationError, setActivationError] = useState<string | null>(null);
    const [rightSideEditor, setRightSideEditor] = useState<{
        target: WebsitePopupTextCommandEditTarget | WebsitePopupPrefixEditTarget;
        anchor: DOMRect;
    } | null>(null);
    const rightSideAnchorRef = useRef<HTMLElement | null>(null);
    const hasKeyboardResultNavigationRef = useRef(false);
    const [urlKeyboardSelectionQuery, setUrlKeyboardSelectionQuery] = useState<string | null>(null);
    const closeRightSideEditor = useCallback((restoreFocus: boolean) => {
        const anchor = rightSideAnchorRef.current;
        rightSideAnchorRef.current = null;
        setRightSideEditor(null);
        if (restoreFocus && anchor?.isConnected) {
            window.requestAnimationFrame(() => {
                if (anchor.isConnected)
                    anchor.focus({ preventScroll: true });
            });
        }
    }, []);
    useEffect(() => closeRightSideEditor(false), [closeRightSideEditor, request.source, request.entity, request.query]);
    useEffect(() => {
        hasKeyboardResultNavigationRef.current = false;
        setUrlKeyboardSelectionQuery(null);
    }, [request.entity, request.query, request.source, activeChildField?.field, activeChildQuery]);
    useEffect(() => {
        if (request.source !== 'normal') {
            setDebouncedNormalQuery('');
            return;
        }
        const timer = window.setTimeout(() => setDebouncedNormalQuery(request.query), 100);
        return () => window.clearTimeout(timer);
    }, [request.query, request.source]);
    const completedTextCommand = request.source === 'normal' && prefixSettingsStatus === 'ready'
        && Boolean(getWebsitePopupCompletedTextCommand(request.query, searchSnapshot, categoryPrefixSettings));
    const isSearchPending = request.source === 'normal'
        && ((!searchSnapshotReady && !searchSnapshotError) || (!completedTextCommand && debouncedNormalQuery !== request.query));
    const resolvedNormalQuery = isSearchPending ? lastResolvedNormalQueryRef.current
        : completedTextCommand ? request.query : debouncedNormalQuery;
    useEffect(() => {
        if (request.source !== 'normal') lastResolvedNormalQueryRef.current = '';
        else if (!isSearchPending) lastResolvedNormalQueryRef.current = resolvedNormalQuery;
    }, [request.source, isSearchPending, resolvedNormalQuery]);
    const resolvedRequest = request.source === 'normal'
        ? { ...request, query: resolvedNormalQuery }
        : request;
    const resolvedResults = useMemo(() => resolveWebsitePopupResults(resolvedRequest, {
        surface,
        categoryPrefixSettings,
        actionPrefixSettings,
        subcommandPrefixSettings,
        createGrammar: prefixSettingsStatus === 'ready' ? createGrammar : [],
        actionGrammar: prefixSettingsStatus === 'ready' ? actionGrammar : [],
        searchSnapshot,
        selectedCollectionId: interactionState.collectionSession?.selectedCollectionId,
        collectionSession: interactionState.collectionSession,
        canSaveChat,
    }, interactionState.selectedIndex), [
        actionPrefixSettings,
        canSaveChat,
        actionGrammar,
        categoryPrefixSettings,
        createGrammar,
        subcommandPrefixSettings,
        surface,
        interactionState.selectedIndex,
        resolvedRequest,
        searchSnapshot,
        interactionState.collectionSession?.selectedCollectionId,
        interactionState.collectionSession,
    ]);
    const createChooserSections = useMemo<WebsitePopupResolvedSection[]>(() => {
        if (prefixSettingsStatus !== 'ready')
            return [];
        // A real Create route owns the header composer. Chooser rows are only for
        // the pre-entry command state and must never remain underneath it.
        if (interactionState.route.kind === 'create')
            return [];
        const parsedIntent = interactionState.parsedIntent;
        if (parsedIntent.kind !== 'create' || parsedIntent.phase !== 'chooser' || !parsedIntent.entity)
            return [];
        const row = buildWebsitePopupCreateRows(categoryPrefixSettings, createGrammar, -1)
            .find(candidate => candidate.id === `create-${parsedIntent.entity}`);
        if (!row)
            return [];
        return [{
                id: 'create-chooser',
                label: 'Create',
                rows: [{
                        ...row,
                        id: `create-chooser:${parsedIntent.entity}`,
                        title: `Create ${String(row.title)}`,
                        intent: {
                            kind: 'enter-mode',
                            mode: 'create',
                            entity: parsedIntent.entity,
                            query: parsedIntent.query,
                            returnToCreateChooser: true,
                        },
                    }],
            }];
    }, [categoryPrefixSettings, createGrammar, interactionState.parsedIntent, interactionState.route.kind, prefixSettingsStatus]);
    const isLinkUrlMode = activeChildField?.source === 'browserLinks';
    const linkUrlQuery = interactionState.createSession?.argumentQueries.url || '';
    const isCreateTagMode = activeChildField?.source === 'tags';
    const isCreateAttachmentMode = activeChildField?.source === 'attachments';
    const pickerOptions = useWebsitePopupPickerOptions(isLinkUrlMode, isCreateAttachmentMode, linkUrlQuery);
    const { items: openTabs, loading: openTabsLoading, error: openTabsError } = pickerOptions.tabs;
    const { items: urlSuggestions, loading: urlSuggestionsLoading, error: urlSuggestionsError } = pickerOptions.urls;
    const { items: attachmentOptions, loading: attachmentsLoading, error: attachmentsError } = pickerOptions.attachments;
    useEffect(() => {
        hasKeyboardResultNavigationRef.current = false;
        setUrlKeyboardSelectionQuery(null);
    }, [openTabs, urlSuggestions]);
    const createPropertySections = useMemo<WebsitePopupResolvedSection[]>(() => {
        const childMode = interactionState.createSession?.childMode;
        if (!createRoute || !activeCreateGrammar || !childMode)
            return [];
        return buildWebsitePopupCreatePropertySections({
            grammar: activeCreateGrammar,
            fieldId: childMode,
            query: interactionState.createSession?.argumentQueries[childMode] || '',
            snapshot: searchSnapshot,
            attachments: attachmentOptions,
            selectedValuesByField: interactionState.createSession?.selectedValuesByField,
        });
    }, [activeCreateGrammar, attachmentOptions, createRoute, interactionState.createSession?.argumentQueries, interactionState.createSession?.childMode, interactionState.createSession?.selectedValuesByField, searchSnapshot]);
    const isCreateOptionChooser = Boolean(createRoute
        && activeCreateGrammar
        && interactionState.createSession?.propertyEntryOpen
        && !interactionState.createSession.childMode);
    const createOptionSections = useMemo<WebsitePopupResolvedSection[]>(() => {
        if (!isCreateOptionChooser || !activeCreateGrammar)
            return [];
        return buildWebsitePopupCreateOptionSections({
            grammar: activeCreateGrammar,
            query: interactionState.createSession?.propertyPrefixDraft || '',
            addedFields: interactionState.createSession?.committedOptionalFieldOrder || [],
        });
    }, [
        activeCreateGrammar,
        interactionState.createSession?.committedOptionalFieldOrder,
        interactionState.createSession?.propertyPrefixDraft,
        isCreateOptionChooser
    ]);
    const linkUrlSections = useMemo<WebsitePopupResolvedSection[]>(() => {
        if (!isLinkUrlMode)
            return [];
        return buildWebsitePopupCreateLinkUrlSections({
            openTabs,
            suggestions: urlSuggestions,
            selectedValues: interactionState.createSession?.selectedValuesByField.url || [],
            query: linkUrlQuery,
        });
    }, [interactionState.createSession?.selectedValuesByField.url, isLinkUrlMode, linkUrlQuery, openTabs, urlSuggestions]);
    const manualSections = useMemo<WebsitePopupResolvedSection[]>(() => {
        const normalizedSubmodeQuery = submodeRoute?.query.trim().toLowerCase() || '';
        if (submode?.id === 'screenshot-tools' || submode?.id === 'screenshot-format') {
            type ScreenshotActionId = Extract<WebsitePopupExecutionIntent, {
                kind: 'page-extraction';
            }>['actionId'];
            const choices: Array<{
                id: string;
                title: string;
                actionId: ScreenshotActionId;
            }> = submode.id === 'screenshot-tools'
                ? [
                    { id: 'capture-visible', title: 'Capture Visible Screenshot', actionId: 'capture_visible_screenshot' },
                    { id: 'capture-clip', title: 'Capture and Clip Screenshot', actionId: 'capture_clip_screenshot' },
                    { id: 'manual-full-page', title: 'Capture Full Page', actionId: 'capture_screenshot_tools' }
                ]
                : [
                    { id: 'capture-full-png', title: 'Full Page as PNG', actionId: 'capture_full_page_png' },
                    { id: 'capture-full-jpg', title: 'Full Page as JPG', actionId: 'capture_full_page_jpg' },
                    { id: 'capture-full-pdf', title: 'Full Page as PDF', actionId: 'capture_full_page_pdf' }
                ];
            const visibleChoices = normalizedSubmodeQuery
                ? choices.filter(choice => choice.title.toLowerCase().includes(normalizedSubmodeQuery))
                : choices;
            return [{
                    id: 'manual-screenshot',
                    label: submode.id === 'screenshot-tools' ? 'Screenshot Tools' : 'Full Page Format',
                    rows: visibleChoices.map(choice => ({
                        id: choice.id,
                        title: choice.title,
                        icon: choice.actionId === 'capture_visible_screenshot' ? <FiCamera /> : <FiImage />,
                        iconTone: 'capture',
                        intent: { kind: 'page-extraction', actionId: choice.actionId },
                    })),
                }];
        }
        if (submode?.id === 'send-agent') {
            const promptRows = searchSnapshot.prompts
                .filter(prompt => !normalizedSubmodeQuery
                || [prompt.title, prompt.prompt, prompt.rules]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase()
                    .includes(normalizedSubmodeQuery))
                .map(prompt => ({
                id: `send-prompt:${prompt.id}`,
                title: prompt.title || 'Untitled Prompt',
                detail: prompt.prompt || prompt.rules,
                icon: <LuSparkles />,
                iconTone: 'ai' as const,
                intent: {
                    kind: 'send-to-agent-target' as const,
                    targetKind: 'prompt' as const,
                    targetId: prompt.id,
                },
            }));
            const agentRows = searchSnapshot.agents
                .filter(agent => !normalizedSubmodeQuery
                || [agent.title, agent.prompt]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase()
                    .includes(normalizedSubmodeQuery))
                .map(agent => ({
                id: `send-agent:${agent.id}`,
                title: agent.title || 'Untitled Agent',
                detail: agent.prompt,
                icon: <FiSend />,
                iconTone: 'ai' as const,
                intent: {
                    kind: 'send-to-agent-target' as const,
                    targetKind: 'agent' as const,
                    targetId: agent.id,
                },
            }));
            return [
                ...(promptRows.length > 0 ? [{ id: 'send-prompts', label: 'AI Prompts', rows: promptRows }] : []),
                ...(agentRows.length > 0 ? [{ id: 'send-agents', label: 'Chat Agents', rows: agentRows }] : [])
            ];
        }
        return [];
    }, [searchSnapshot.agents, searchSnapshot.prompts, submode, submodeRoute?.query]);
    const results = useMemo(() => submodeRoute && !submodeRoute.submode.id.startsWith('collection-')
        ? applySelection(manualSections, interactionState.selectedIndex)
        : createChooserSections.length > 0
            ? applySelection(createChooserSections, interactionState.selectedIndex)
            : isLinkUrlMode
                ? applySelection(linkUrlSections, urlKeyboardSelectionQuery === linkUrlQuery ? interactionState.selectedIndex : -1)
                : isCreateOptionChooser
                    ? applySelection(createOptionSections, interactionState.selectedIndex)
                    : Boolean(createRoute && interactionState.createSession?.childMode)
                        ? applySelection(createPropertySections, interactionState.selectedIndex)
                        : resolvedResults, [
        createChooserSections,
        createOptionSections,
        createPropertySections,
        createRoute,
        isCreateOptionChooser,
        isLinkUrlMode,
        linkUrlSections,
        linkUrlQuery,
        urlKeyboardSelectionQuery,
        interactionState.selectedIndex,
        interactionState.createSession?.childMode,
        manualSections,
        resolvedResults,
        submodeRoute
    ]);
    const capturePageContext = useCallback(() => ({
        url: surface === 'newtab'
            ? chrome.runtime.getURL('AltS_search_newtab/index.html')
            : window.location.href,
        title: document.title || 'Untitled Page',
        text: String(surface === 'newtab'
            ? (document.querySelector<HTMLElement>('#app-container')?.innerText || '')
            : (document.body?.innerText || document.body?.textContent || ''))
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 12000),
    }), [surface]);
    const activationControllerRef = useRef<WebsitePopupActivationController | null>(null);
    const isCollectionMode = () => {
        const route = store.getState().state.route;
        return route.kind === 'submode' && route.submode.id === 'collection-actions';
    };
    activationControllerRef.current ??= new WebsitePopupActivationController({ dispatch, capturePageContext, isCollectionMode });
    activationControllerRef.current.updateOptions({ dispatch, capturePageContext, isCollectionMode });
    const commitCreatePropertySelection = useCallback((row: Extract<WebsitePopupExecutionIntent, {
        kind: 'create-property-select';
    }>) => {
        if (!createRoute || !activeCreateGrammar || !interactionState.createSession)
            return;
        const field = activeCreateGrammar.fields.find(candidate => candidate.field === row.field);
        if (!field?.primaryPrefix)
            return;
        const existing = interactionState.createSession.selectedValuesByField[row.field] || [];
        const nextValues = !row.multiple && existing.some(value => value.id === row.optionId)
            ? []
            : toggleWebsitePopupMultiSelectValue(existing, {
                id: row.optionId,
                label: row.label,
                serializedValue: row.serializedValue,
                ...(row.selection || {}),
            }, row.multiple);
        writeWebsitePopupCreateSelections(store, activeCreateGrammar, row.field, nextValues);
        dispatch({ type: 'CREATE_ARGUMENT_QUERY_CHANGED', field: row.field, value: '' });
        if (!row.multiple) {
            dispatch({ type: 'CREATE_CHILD_MODE_CHANGED', mode: null });
            if (sidePanelOpen && activeCreateSurface === 'panel') {
                const fields = getWebsitePopupCreatePropertyFields(activeCreateGrammar);
                const nextField = fields[fields.findIndex(candidate => candidate.field === row.field) + 1];
                dispatch({ type: 'CREATE_FOCUS_REQUESTED', target: nextField?.field || 'save-button' });
            }
            else {
                const hasMoreOptions = getWebsitePopupCreatePropertyFields(activeCreateGrammar)
                    .some(candidate => !interactionState.createSession!.committedOptionalFieldOrder.includes(candidate.field));
                if (hasMoreOptions)
                    dispatch({ type: 'CREATE_PROPERTY_ENTRY_CHANGED', open: true });
                else
                    dispatch({ type: 'CREATE_FOCUS_REQUESTED', target: 'save-button' });
            }
        }
        else {
            dispatch({ type: 'CREATE_FOCUS_REQUESTED', target: `argument-query:${row.field}` });
        }
    }, [activeCreateGrammar, activeCreateSurface, createRoute, dispatch, interactionState.createSession, sidePanelOpen, store]);
    const activateRow = useCallback(async (index: number, source: 'click' | 'keyboard-enter' | 'keyboard-space', commandRow?: WebsitePopupResolvedRow) => {
        // Retained rows are visual continuity only until the current search resolves.
        if (isSearchPending && !commandRow) return;
        const row = commandRow || results.rows[index];
        if (!row || row.disabled || activationPending || textCommandActionPending)
            return;
        if (index >= 0)
            dispatch({ type: 'SELECTION_SET', index });
        if (row.intent.kind === 'create-property-select') {
            commitCreatePropertySelection(row.intent);
            return;
        }
        if (row.intent.kind === 'collection-destination-create') {
            const organisationId = searchSnapshot.defaultOrganisationId;
            if (!organisationId) {
                setActivationError('No Organisation is available for this Collection.');
                return;
            }
            setActivationPending(true);
            setActivationError(null);
            try {
                const collection = await createCollection({ organisationId, name: row.intent.name });
                dispatch({ type: 'COLLECTION_DESTINATION_CHOSEN', id: collection.id, name: collection.name });
            }
            catch (error: unknown) {
                setActivationError(error instanceof Error ? error.message : String(error));
            }
            finally {
                setActivationPending(false);
            }
            return;
        }
        if (row.intent.kind === 'create-tag') {
            setActivationPending(true);
            setActivationError(null);
            try {
                const tag = await createWebsitePopupTag(row.intent.name);
                commitCreatePropertySelection({
                    kind: 'create-property-select',
                    field: 'tag',
                    optionId: tag.id,
                    label: tag.name,
                    serializedValue: tag.name,
                    multiple: true,
                    selection: { kind: 'tag', workspaceId: tag.workspaceId },
                });
            }
            catch (error: unknown) {
                setActivationError(error instanceof Error ? error.message : String(error));
            }
            finally {
                setActivationPending(false);
            }
            return;
        }
        if (row.intent.kind === 'create-option-add') {
            const fieldId = row.intent.field;
            dispatch({ type: 'CREATE_OPTION_ADDED', field: fieldId });
            const field = activeCreateGrammar?.fields.find(candidate => candidate.field === fieldId);
            if (field && opensWebsitePopupCreateChildMode(field)) {
                dispatch({ type: 'CREATE_CHILD_MODE_CHANGED', mode: field.field });
            }
            else if (field?.kind === 'boolean') {
                const hasMoreOptions = getWebsitePopupCreatePropertyFields(activeCreateGrammar!)
                    .some(candidate => candidate.field !== fieldId
                    && !interactionState.createSession?.committedOptionalFieldOrder.includes(candidate.field));
                if (hasMoreOptions)
                    dispatch({ type: 'CREATE_PROPERTY_ENTRY_CHANGED', open: true });
                else
                    dispatch({ type: 'CREATE_FOCUS_REQUESTED', target: 'save-button' });
            }
            return;
        }
        if (submode?.id === 'screenshot-tools' && row.id === 'manual-full-page') {
            dispatch({ type: 'SUBMODE_ENTERED', submode: { id: 'screenshot-format' } });
            return;
        }
        if (submode?.id === 'send-agent'
            && row.intent.kind === 'send-to-agent-target') {
            onSendAgentSelected({ targetKind: row.intent.targetKind, targetId: row.intent.targetId, targetTitle: String(row.title) });
            return;
        }
        if (row.intent.kind === 'stage-chat-save') {
            onChatSaveStage?.({ entity: row.intent.entity, targetId: row.intent.targetId, title: String(row.title) });
            return;
        }
        if (row.intent.kind === 'enter-mode' && row.intent.mode === 'save' && row.intent.entity === 'agent' && !canSaveChat) {
            setActivationError('This page is not a supported AI conversation.');
            return;
        }
        setActivationPending(true);
        setActivationError(null);
        const screenshotIntent = row.intent.kind === 'page-extraction'
            && row.intent.actionId !== 'capture_screenshot_tools'
            && row.intent.actionId.startsWith('capture_');
        if (screenshotIntent) {
            onRequestClose?.();
            await new Promise<void>(resolve => window.setTimeout(resolve, 170));
        }
        const outcome = await activationControllerRef.current!.activate({
            source,
            intent: row.intent,
            rowId: row.id,
            requestId: crypto.randomUUID?.() || `${Date.now()}-${row.id}`,
        });
        setActivationPending(false);
        if (outcome.status === 'manual-surface-opened') {
            dispatch({
                type: 'SUBMODE_ENTERED',
                submode: {
                    id: outcome.actionId === 'capture_screenshot_tools'
                        ? 'screenshot-tools'
                        : 'send-agent',
                },
            });
            return;
        }
        if (outcome.status === 'failed') {
            setActivationError(outcome.message);
            return;
        }
        if (outcome.status === 'entity-opened'
            || outcome.status === 'action-executed'
            || outcome.status === 'page-saved') {
            if (!screenshotIntent)
                onRequestClose?.();
        }
    }, [
        activationPending,
        textCommandActionPending,
        isSearchPending,
        canSaveChat,
        onChatSaveStage,
        onSendAgentSelected,
        activeCreateGrammar,
        commitCreatePropertySelection,
        dispatch,
        onRequestClose,
        results.rows,
        searchSnapshot.defaultOrganisationId,
        submode
    ]);
    useEffect(() => {
        if (interactionState.suggestionCount !== results.rows.length) {
            dispatch({ type: 'SUGGESTION_COUNT_CHANGED', count: results.rows.length });
        }
    }, [dispatch, interactionState.suggestionCount, results.rows.length]);
    useEffect(() => {
        setActivationError(null);
    }, [interactionState.selectedIndex, linkUrlQuery, request.query]);
    useEffect(() => {
        const selectedRow = results.rows[interactionState.selectedIndex];
        if (!selectedRow?.disabled)
            return;
        const selectableIndex = findFirstSelectableWebsitePopupRowIndex(results.rows);
        if (selectableIndex >= 0)
            dispatch({ type: 'SELECTION_SET', index: selectableIndex });
    }, [dispatch, interactionState.selectedIndex, results.rows]);
    useEffect(() => {
        if (!keyboardTarget || !keyboardEnabled)
            return;
        const handleKeyDown = (event: Event) => {
            if (!(event instanceof KeyboardEvent))
                return;
            if (createRoute?.presentation === 'standalone' && event.key === 'Escape') {
                if (isHotkeyRecordingActive(event) || event.composedPath().some(target => target instanceof HTMLElement
                    && target.classList.contains('website-popup-result-model-picker'))) return;
                event.preventDefault();
                event.stopImmediatePropagation();
                onCollapseSidePanel?.();
                return;
            }
            const eventPath = event.composedPath();
            if (eventPath.some(target => target instanceof HTMLElement && target.classList.contains('website-popup-search-hint__action')))
                return;
            if (rightSideEditor) {
                // The assignment editor owns Escape hierarchy, including capture cancellation.
                if (eventPath.some(target => target instanceof HTMLElement
                    && target.classList.contains('website-popup-text-command-editor'))) return;
                if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    closeRightSideEditor(true);
                }
                return;
            }
            if (resultEditOpen) {
                if (eventPath.some(target => target instanceof HTMLElement
                    && (target.classList.contains('website-popup-text-command-editor')
                        || target.classList.contains('website-popup-create-side-panel')
                        || target.classList.contains('website-popup-result-model-picker'))))
                    return;
                if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    onResultEditClose?.();
                }
                return;
            }
            if ((request.source === 'normal' || request.source === 'save')
                && (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) {
                const target = results.rows[interactionState.selectedIndex]?.resultEdit;
                if (target) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    onResultEditRequest?.(target);
                    return;
                }
            }
            if (isHotkeyRecordingActive(event))
                return;
            const isInCreateSidePanel = eventPath.some(target => target instanceof HTMLElement
                && target.classList.contains('website-popup-create-side-panel'));
            const isPortaledCreateControl = eventPath.some(target => target instanceof HTMLElement
                && target.classList.contains('website-popup-argument-slot'));
            if (isInCreateSidePanel && !isPortaledCreateControl)
                return;
            if (isPortaledCreateControl && eventPath.some(target => target instanceof HTMLButtonElement))
                return;
            if (event.key === 'Backspace' && eventPath.some(target => target instanceof HTMLElement
                && (target.classList.contains('website-popup-hotkey-capture__summary')
                    || target.dataset.createOptionRemove === 'true')))
                return;
            if (eventPath.some(target => target instanceof HTMLElement
                && target.classList.contains('website-popup-row__editable-trailing')))
                return;
            const isCreateTokenRemove = eventPath.some(target => target instanceof HTMLElement
                && target.classList.contains('website-popup-multi-select-argument__token-remove'));
            if (isCreateTokenRemove && (event.key === 'Enter' || event.key === ' '))
                return;
            const isCreateComposerInput = eventPath.some(target => target instanceof HTMLElement
                && (target.classList.contains('website-popup-create-composer__input')
                    || target.classList.contains('website-popup-create-composer__textarea')));
            const isCreatePropertyQuery = eventPath.some(target => target instanceof HTMLElement && target.classList.contains('website-popup-create-composer__property-query'));
            const isCreateMultilineField = eventPath.some(target => target instanceof HTMLElement && target.classList.contains('website-popup-create-composer__textarea'));
            // Create-owned inputs implement their own Enter/Escape/Tab hierarchy.
            // Do not let the global result controller activate or close a route first.
            if (isCreateComposerInput
                && (event.key === 'Escape' || event.key === 'Tab' || (event.key === 'Enter' && !isCreatePropertyQuery))) {
                return;
            }
            if (isCreateMultilineField && (event.key === 'ArrowDown' || event.key === 'ArrowUp'))
                return;
            // Single-select Todo options use the same result list as URL and tag
            // multi-selects; only multiline text keeps native arrow movement.
            const routeIntent = resolveWebsitePopupRouteKeyboardIntent({
                key: event.key,
                source: request.source,
                query: request.query,
                isCreateArgument: isCreateComposerInput,
            });
            if (routeIntent === 'back-requested') {
                if (createRoute?.presentation === 'standalone' && event.key === 'Backspace') {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    return;
                }
                event.preventDefault();
                event.stopImmediatePropagation();
                if (sidePanelOpen && createRoute && !interactionState.createSession?.childMode
                    && !interactionState.createSession?.propertyEntryOpen)
                    onCollapseSidePanel?.();
                else
                    dispatch({ type: 'BACK_REQUESTED' });
                return;
            }
            const input = eventPath[0];
            const searchInput = input instanceof HTMLTextAreaElement
                && input.classList.contains('website-popup-search-input') ? input : null;
            const commandText = searchInput?.value ?? request.query;
            const liveState = store.getState().state;
            const liveRequest = selectWebsitePopupSuggestionRequest(liveState);
            const exactCommandRow = prefixSettingsStatus === 'ready'
                && liveState.route.kind === 'suggestions'
                ? findExactWebsitePopupCommandRow(commandText, categoryPrefixSettings, actionPrefixSettings, createGrammar, actionGrammar, canSaveChat, surface)
                : null;
            const isAtCommandEnd = searchInput !== null
                && searchInput.selectionStart === searchInput.value.length
                && searchInput.selectionEnd === searchInput.value.length;
            if (event.key === ' ' && !event.repeat && !event.isComposing
                && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
                && isAtCommandEnd && exactCommandRow) {
                event.preventDefault();
                event.stopPropagation();
                void activateRow(-1, 'keyboard-space', exactCommandRow);
                return;
            }
            if (event.key === 'Enter' && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
                event.preventDefault();
                event.stopPropagation();
                if (isLinkUrlMode && isCreatePropertyQuery && !hasKeyboardResultNavigationRef.current) {
                    const url = normalizeWebsitePopupManualUrl(linkUrlQuery);
                    if (!url) {
                        setActivationError(linkUrlQuery.trim() ? 'Enter a valid URL.' : 'Enter a URL to add.');
                        return;
                    }
                    const key = normalizeWebsitePopupUrlIdentity(url);
                    if ((liveState.createSession?.selectedValuesByField.url || []).some(value => normalizeWebsitePopupUrlIdentity(String(value.url || value.serializedValue || '')) === key)) {
                        setActivationError('This URL is already selected.');
                        return;
                    }
                    commitCreatePropertySelection({
                        kind: 'create-property-select',
                        field: 'url',
                        optionId: `url:${key}`,
                        label: url,
                        serializedValue: url,
                        multiple: true,
                        selection: { kind: 'url', url, source: 'custom' },
                    });
                    return;
                }
                if (exactCommandRow && !hasKeyboardResultNavigationRef.current) {
                    void activateRow(-1, 'keyboard-enter', exactCommandRow);
                    return;
                }
                // Filter mode is a live query surface while typing. Once Arrow keys
                // explicitly select a result, Enter follows the same activation path
                // as a mouse click.
                if (liveRequest.source === 'filter'
                    && liveRequest.entity !== null
                    && !hasKeyboardResultNavigationRef.current)
                    return;
                if (liveRequest.source !== 'save'
                    && liveRequest.source !== 'filter'
                    && liveRequest.source !== 'submode'
                    && liveState.parsedIntent.kind !== 'none'
                    && !hasKeyboardResultNavigationRef.current) {
                    const parsedIntent = liveState.parsedIntent;
                    if (parsedIntent.kind === 'collection') {
                        void activationControllerRef.current!.activate({
                            source: 'keyboard-enter',
                            intent: { kind: 'collection-mode', mode: parsedIntent.mode },
                            rowId: `parsed:collection:${parsedIntent.mode}`,
                            requestId: crypto.randomUUID?.() || `${Date.now()}-parsed-collection`,
                        });
                        return;
                    }
                    setActivationPending(true);
                    setActivationError(null);
                    void activationControllerRef.current!.activate({
                        source: 'keyboard-enter',
                        intent: {
                            kind: 'enter-mode',
                            mode: parsedIntent.kind,
                            entity: parsedIntent.entity ?? undefined,
                            query: parsedIntent.query,
                            returnToCreateChooser: parsedIntent.kind === 'create' && parsedIntent.phase === 'chooser',
                        },
                        rowId: `parsed:${parsedIntent.kind}:${parsedIntent.entity}`,
                        requestId: crypto.randomUUID?.() || `${Date.now()}-parsed-intent`,
                    }).then(outcome => {
                        setActivationPending(false);
                        if (outcome.status === 'failed')
                            setActivationError(outcome.message);
                    });
                    return;
                }
                void activateRow(liveState.selectedIndex, 'keyboard-enter');
                return;
            }
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')
                return;
            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
                return;
            event.preventDefault();
            event.stopPropagation();
            const nextIndex = findNextSelectableWebsitePopupRowIndex(results.rows, isLinkUrlMode && urlKeyboardSelectionQuery !== linkUrlQuery
                ? event.key === 'ArrowDown' ? -1 : 0
                : interactionState.selectedIndex, event.key === 'ArrowDown' ? 'next' : 'previous');
            if (nextIndex < 0)
                return;
            hasKeyboardResultNavigationRef.current = true;
            if (isLinkUrlMode)
                setUrlKeyboardSelectionQuery(linkUrlQuery);
            dispatch({ type: 'SELECTION_SET', index: nextIndex });
        };
        keyboardTarget.addEventListener('keydown', handleKeyDown, true);
        return () => keyboardTarget.removeEventListener('keydown', handleKeyDown, true);
    }, [
        activateRow,
        actionGrammar,
        actionPrefixSettings,
        canSaveChat,
        categoryPrefixSettings,
        closeRightSideEditor,
        commitCreatePropertySelection,
        createRoute,
        createGrammar,
        dispatch,
        interactionState.createSession?.childMode,
        interactionState.createSession?.propertyEntryOpen,
        interactionState.parsedIntent,
        interactionState.selectedIndex,
        isLinkUrlMode,
        keyboardEnabled,
        keyboardTarget,
        linkUrlQuery,
        onCollapseSidePanel,
        onRequestClose,
        prefixSettingsStatus,
        request.query,
        request.source,
        results.rows,
        rightSideEditor,
        resultEditOpen,
        onResultEditClose,
        onResultEditRequest,
        sidePanelOpen,
        submode?.id,
        store,
        urlKeyboardSelectionQuery
    ]);
    const sidePanelPickerActive = Boolean(sidePanelOpen && activeCreateSurface === 'panel' && sidePanelPickerTarget
        && (activeChildField?.kind === 'multiSelect' || activeChildField?.kind === 'singleSelect'));
    const resultsViewport = (<WebsitePopupResults sections={results.sections} ariaLabel={sidePanelPickerActive ? `${activeChildField?.label || 'Property'} choices` : 'Website popup results'} showHeadings={!createRoute} showAllDetails={sidePanelPickerActive && (isLinkUrlMode || isCreateAttachmentMode)} statusMessage={activationPending || textCommandActionPending ? 'Working…' : textCommandActionError || chatSaveError || activationError || searchSnapshotError || (isLinkUrlMode ? urlSuggestionsError || openTabsError : isCreateAttachmentMode ? attachmentsError : null)} emptyState={submode?.id === 'send-agent'
            ? 'No AI Prompts or Chat Agents available'
            : request.source === 'default' && prefixSettingsStatus === 'loading'
                ? 'Loading configured commands…'
                : request.source === 'default' && prefixSettingsStatus === 'failed'
                    ? 'Unable to load configured commands'
                    : isLinkUrlMode && (openTabsLoading || urlSuggestionsLoading)
                        ? 'Loading URLs…'
                        : isLinkUrlMode
                            ? urlSuggestionsError || openTabsError || (linkUrlQuery.trim()
                                ? 'No matching URLs'
                                : 'No available URLs')
                            : isCreateTagMode
                                ? 'No available tags match this filter'
                                : isCreateAttachmentMode
                                    ? attachmentsLoading ? 'Loading saved items…'
                                        : attachmentsError || 'No saved items match this filter'
                                    : activeChildField?.kind === 'capture'
                                        ? undefined
                                        : createRoute && interactionState.createSession?.childMode
                                            ? 'No matching options'
                                            : isCreateOptionChooser
                                                ? 'No remaining options match this filter'
                                                : request.source === 'normal'
                                                    ? isSearchPending ? 'Searching…' : 'No matching results'
                                                    : request.source === 'create' || request.source === 'save' || request.source === 'filter'
                                                        ? undefined
                                                        : undefined} onRowSelectionRequest={index => dispatch({ type: 'SELECTION_SET', index })} onRowActivationRequest={index => void activateRow(index, 'click')} onResultEditRequest={target => {
            if (request.source !== 'normal' && request.source !== 'save')
                return;
            setRightSideEditor(null);
            onResultEditRequest?.(target);
        }} onTextCommandEditRequest={(target, element) => {
            if (!keyboardTarget)
                return;
            rightSideAnchorRef.current = element;
            setRightSideEditor({ target, anchor: element.getBoundingClientRect() });
        }} onPrefixEditRequest={(target, element) => {
            if (!keyboardTarget)
                return;
            rightSideAnchorRef.current = element;
            setRightSideEditor({ target, anchor: element.getBoundingClientRect() });
        }}/>);
    return (<>
    {sidePanelPickerActive && !standaloneCreate ? <div className="website-popup-results website-popup-custom-scrollbar" aria-hidden="true"/> : null}
    {sidePanelPickerActive && sidePanelPickerTarget
            ? createPortal(resultsViewport, sidePanelPickerTarget)
            : standaloneCreate ? null : resultsViewport}
    {!standaloneCreate && rightSideEditor && keyboardTarget ? (<WebsitePopupTextCommandEditor key={'type' in rightSideEditor.target
                ? `prefix:${rightSideEditor.target.type}:${rightSideEditor.target.category}`
                : `item:${rightSideEditor.target.entity}:${rightSideEditor.target.targetId}`} target={rightSideEditor.target} anchor={rightSideEditor.anchor} shadowRoot={keyboardTarget} onClose={closeRightSideEditor}/>) : null}
    </>);
}

