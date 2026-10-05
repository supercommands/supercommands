import { ConnectedWebsitePopupSendAgentComposer } from '../create/ConnectedWebsitePopupSendAgentComposer';
import { createWebsitePopupSendAgentController } from '../execution/createWebsitePopupSendAgentController';
/**
 * React integration boundary for the production popup website popup.
 *
 * It connects the standalone focus controller to the Shadow mount and search
 * input while leaving results, execution, and Chrome runtime ownership outside.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { isCollectionCaptureSurface, isCollectionSourceUrl } from '../../../../shared-components/collections/collectionCaptureSource';
import type { WebsitePopupInteractionStoreApi } from '../interaction/createWebsitePopupInteractionStore';
import type { WebsitePopupCreateSurface } from '../interaction/websitePopupInteractionTypes';
import type { WebsitePopupPrefixSettingLike } from '../catalog/websitePopupCreateCatalog';
import type { WebsitePopupShadowMount } from '../components/WebsitePopupLayer';
import { ConnectedWebsitePopupLayer as WebsitePopupLayer } from '../components/ConnectedWebsitePopupLayer';
import { WebsitePopupFrame } from '../display/WebsitePopupFrame';
import { WebsitePopupHeader } from '../display/WebsitePopupHeader';
import { WebsitePopupFocusController } from '../focus/WebsitePopupFocusController';
import { ConnectedWebsitePopupResultsLayer } from '../results/ConnectedWebsitePopupResultsLayer';
import { ConnectedWebsitePopupCreateComposer } from '../create/ConnectedWebsitePopupCreateComposer';
import { ConnectedWebsitePopupCollectionComposer } from '../create/ConnectedWebsitePopupCollectionComposer';
import { WebsitePopupCollectionCapturePanel } from '../create/WebsitePopupCollectionCapturePanel';
import { isWebsitePopupUnifiedCollectionPanel } from '../interaction/websitePopupPresentation';
import { useWebsitePopupCollectionPanelLifecycle } from '../create/useWebsitePopupCollectionPanelLifecycle';
import { ConnectedWebsitePopupCollectionItemDetailsComposer } from '../create/ConnectedWebsitePopupCollectionItemDetailsComposer';
import { WebsitePopupCollectionItemStatusFooter, type WebsitePopupCollectionItemFooterState } from '../create/WebsitePopupCollectionItemStatusFooter';
import { WebsitePopupCreateFooter } from '../create/WebsitePopupCreateFooter';
import { WebsitePopupCreateSidePanel } from '../create/WebsitePopupCreateSidePanel';
import { WebsitePopupModelSelectionField } from '../create/WebsitePopupModelSelectionField';
import { WebsitePopupResultEditSidePanel } from '../results/WebsitePopupResultEditSidePanel';
import { useWebsitePopupSaveChat } from '../results/useWebsitePopupSaveChat';
import { WebsitePopupSaveChatSidePanel } from '../results/WebsitePopupSaveChatSidePanel';
import type { WebsitePopupResultEditTarget } from '../display/websitePopupDisplayTypes';
import { isWebsitePopupCreateFieldComplete } from '../create/websitePopupCreateFieldPolicy';
import { ConnectedWebsitePopupHeaderIdentity } from '../search/ConnectedWebsitePopupHeaderIdentity';
import { ConnectedWebsitePopupSearchInput } from '../search/ConnectedWebsitePopupSearchInput';
import { ConnectedWebsitePopupSearchHint } from '../search/ConnectedWebsitePopupSearchHint';
import { DEFAULT_WEBSITE_POPUP_SEARCH_HINT } from '../search/websitePopupSearchHintDefinitions';
import { WebsitePopupSearchHint } from '../search/WebsitePopupSearchHint';
import { useWebsitePopupTextCommandAction } from '../search/useWebsitePopupTextCommandAction';
import { FiExternalLink } from 'react-icons/fi';
import type { WebsitePopupSearchSnapshot } from '../../../../shared-components/websitePopup/contracts/websitePopupSearchBridgeContract';
import type { WebsitePopupActionGrammar, WebsitePopupCreateEntityGrammar, } from '../../../../shared-components/websitePopup/contracts/websitePopupPrefixSettingsBridgeContract';
import { parseWebsitePopupQuery } from '../interaction/websitePopupQueryParser';
import { isWebsitePopupScreenshotSuspended } from '../interaction/websitePopupScreenshotSession';
import type { WebsitePopupScreenshotCaptureController } from './WebsitePopupScreenshotCaptureController';
import { ConnectedWebsitePopupScreenshotCapture } from '../create/ConnectedWebsitePopupScreenshotCapture';
import { ConnectedWebsitePopupScreenshotStatusFooter } from '../create/ConnectedWebsitePopupScreenshotStatusFooter';
import { WebsitePopupCollectionContentPreview, type WebsitePopupCollectionPreviewState } from '../create/WebsitePopupCollectionContentPreview';
import { WebsitePopupScreenshotModeChooser } from '../create/WebsitePopupScreenshotModeChooser';
import { useWebsitePopupWebScrapingCapture } from './useWebsitePopupWebScrapingCapture';
import { WebScrapingElementSelection } from '../../../../shared-components/pageExtraction/webScraping/WebScrapingElementSelection';
export type WebsitePopupApplicationProps = {
    open: boolean;
    screenshotCaptureController?: WebsitePopupScreenshotCaptureController | null;
    themeId: string;
    store: WebsitePopupInteractionStoreApi;
    categoryPrefixSettings: readonly WebsitePopupPrefixSettingLike[];
    actionPrefixSettings: readonly WebsitePopupPrefixSettingLike[];
    subcommandPrefixSettings: readonly WebsitePopupPrefixSettingLike[];
    createGrammar: readonly WebsitePopupCreateEntityGrammar[];
    actionGrammar: readonly WebsitePopupActionGrammar[];
    prefixSettingsStatus: 'loading' | 'ready' | 'failed';
    searchSnapshot: WebsitePopupSearchSnapshot;
    searchSnapshotReady: boolean;
    searchSnapshotError?: string | null;
    surface: 'website' | 'newtab';
    onRequestClose: () => void;
    onAfterClose?: () => void;
};
export function WebsitePopupApplication({ open: runtimeOpen, screenshotCaptureController = null, themeId, store, categoryPrefixSettings, actionPrefixSettings, subcommandPrefixSettings, createGrammar, actionGrammar, prefixSettingsStatus, searchSnapshot, searchSnapshotReady, searchSnapshotError, surface, onRequestClose, onAfterClose, }: WebsitePopupApplicationProps) {
    const canCaptureCollection = isCollectionCaptureSurface(surface) && isCollectionSourceUrl(window.location.href);
    const screenshotSuspended = useStore(store, current => isWebsitePopupScreenshotSuspended(current.state.collectionSession?.screenshot));
    const unifiedCollection = useStore(store, current => isWebsitePopupUnifiedCollectionPanel(current.state.route, surface));
    const webScraping = useWebsitePopupWebScrapingCapture(store, runtimeOpen && canCaptureCollection, unifiedCollection);
    const captureSuspended = screenshotSuspended || webScraping.selecting;
    const screenshotState = useStore(store, current => current.state.collectionSession?.screenshot);
    const savedScreenshot = screenshotState?.status === 'saved'
        ? screenshotCaptureController?.saveController.getSavedItem(screenshotState.itemId) || null : null;
    const showScreenshotModes = useStore(store, current => {
        const session = current.state.collectionSession;
        return current.state.route.kind === 'submode' && current.state.route.submode.id === 'collection-destination'
            && session?.captureType === 'screenshot' && Boolean(session.selectedCollectionId)
            && !session.pickerOpen && session.screenshot.status === 'idle';
    });
    const open = runtimeOpen && !captureSuspended;
    const sendAgentComposing = useStore(store, current => current.state.route.kind === 'submode' && current.state.route.submode.id === 'send-agent-compose');
    const sendAgentSession = useStore(store, current => current.state.sendAgentSession);
    const sendAgentInputRef = useRef<HTMLTextAreaElement | null>(null);
    const setSendAgentInput = useCallback((element: HTMLTextAreaElement | null) => { sendAgentInputRef.current = element; }, []);
    const sendAgentController = useMemo(() => createWebsitePopupSendAgentController(store, () => window.location.href), [store]);
    useEffect(() => { sendAgentController.activate(); return () => sendAgentController.dispose(); }, [sendAgentController]);
    useEffect(() => {
        if (!runtimeOpen || !captureSuspended) return;
        const cancel = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopImmediatePropagation();
            store.getState().dispatch({ type: webScraping.selecting ? 'COLLECTION_PICKER_OPENED' : 'BACK_REQUESTED' });
        };
        window.addEventListener('keydown', cancel, true);
        return () => window.removeEventListener('keydown', cancel, true);
    }, [runtimeOpen, captureSuspended, store, webScraping.selecting]);
    const [shadowMount, setShadowMount] = useState<WebsitePopupShadowMount | null>(null);
    const shadowMountRef = useRef<WebsitePopupShadowMount | null>(null);
    const searchInputRef = useRef<HTMLTextAreaElement | null>(null);
    const createInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
    const collectionInputRef = useRef<HTMLInputElement | null>(null);
    const collectionTitleInputRef = useRef<HTMLInputElement | null>(null);
    const [collectionTagPickerTarget, setCollectionTagPickerTarget] = useState<HTMLDivElement | null>(null);
    const [collectionTagPickerOpen, setCollectionTagPickerOpen] = useState(false);
    const isCreateRouteRef = useRef(false);
    const requestCloseRef = useRef(onRequestClose);
    const focusControllerRef = useRef<WebsitePopupFocusController | null>(null);
    const routeFocusKey = useStore(store, current => {
        const route = current.state.route;
        return route.kind === 'submode' ? `${route.kind}:${route.submode.id}` : route.kind;
    });
    const isCreateRoute = useStore(store, current => current.state.route.kind === 'create');
    const createPresentation = useStore(store, current => current.state.route.kind === 'create' ? current.state.route.presentation : 'inline');
    const standaloneCreate = isCreateRoute && createPresentation === 'standalone';
    const isCollectionDestination = useStore(store, current => current.state.route.kind === 'submode'
        && current.state.route.submode.id === 'collection-destination');
    const isCollectionItemDetails = useStore(store, current => current.state.route.kind === 'submode'
        && current.state.route.submode.id === 'collection-item-details');
    const collectionLifecycle = useWebsitePopupCollectionPanelLifecycle(store, onRequestClose);
    const presentation = unifiedCollection ? 'standalone' : createPresentation;
    const setCollectionTitleInput = useCallback((element: HTMLInputElement | null) => {
        collectionTitleInputRef.current = element;
    }, []);
    const collectionCaptureRevision = useStore(store, current => current.state.collectionSession?.captureRevision || 0);
    const [collectionItemPreviewState, setCollectionItemPreviewState] = useState<WebsitePopupCollectionPreviewState | null>(null);
    const [collectionItemFooterState, setCollectionItemFooterState] = useState<WebsitePopupCollectionItemFooterState | null>(null);
    useEffect(() => {
        if (!isCollectionItemDetails) { setCollectionItemFooterState(null); setCollectionItemPreviewState(null); }
    }, [isCollectionItemDetails]);
    const createSession = useStore(store, current => current.state.createSession);
    const dispatch = useStore(store, current => current.dispatch);
    const textCommandAction = useWebsitePopupTextCommandAction(store, searchSnapshot, categoryPrefixSettings, open && searchSnapshotReady && prefixSettingsStatus === 'ready', onRequestClose);
    const saveChatActive = useStore(store, current => current.state.route.kind === 'save' && current.state.route.entity === 'agent');
    const restoreSaveChatFocus = useCallback(() => {
        window.requestAnimationFrame(() => searchInputRef.current?.focus({ preventScroll: true }));
    }, []);
    const saveChat = useWebsitePopupSaveChat(saveChatActive, open, surface === 'website', onRequestClose, restoreSaveChatFocus);
    const createEntity = useStore(store, current => current.state.route.kind === 'create'
        ? current.state.route.entity : null);
    const activeCreateGrammar = createGrammar.find(grammar => grammar.entity === createEntity);
    const [createSidePanelOpen, setCreateSidePanelOpen] = useState(false);
    const [resultEditTarget, setResultEditTarget] = useState<WebsitePopupResultEditTarget | null>(null);
    const [inlineCreateSurface, setActiveCreateSurface] = useState<WebsitePopupCreateSurface>('composer');
    const activeCreateSurface = standaloneCreate ? 'panel' : inlineCreateSurface;
    const createPanelVisible = standaloneCreate || createSidePanelOpen;
    const createModelProperties = createEntity === 'agent' && createSession?.modelSelection
        ? <WebsitePopupModelSelectionField value={createSession.modelSelection} onChange={value => dispatch({ type: 'CREATE_MODEL_SELECTION_CHANGED', value })}/>
        : undefined;
    const [sidePanelPropertiesTarget, setSidePanelPropertiesTarget] = useState<HTMLDivElement | null>(null);
    const [sidePanelPickerTarget, setSidePanelPickerTarget] = useState<HTMLDivElement | null>(null);
    const [sidePanelSaveTarget, setSidePanelSaveTarget] = useState<HTMLDivElement | null>(null);
    const [createNextFieldLabel, setCreateNextFieldLabel] = useState<string | null>(null);
    const createHint = {
        label: `${createSession?.propertyEntryOpen && !createSession.childMode ? 'Back' : 'Next'}: ${createNextFieldLabel || 'Title'}`,
        shortcut: 'Tab',
    };
    isCreateRouteRef.current = isCreateRoute;
    requestCloseRef.current = onRequestClose;
    useEffect(() => {
        if (!isCreateRoute) {
            setCreateSidePanelOpen(false);
            setActiveCreateSurface('composer');
            setSidePanelPropertiesTarget(null);
            setSidePanelPickerTarget(null);
            setSidePanelSaveTarget(null);
        }
    }, [isCreateRoute]);
    useEffect(() => {
        setResultEditTarget(null);
    }, [routeFocusKey]);
    const closeResultEditor = useCallback(() => {
        setResultEditTarget(null);
        window.requestAnimationFrame(() => searchInputRef.current?.focus({ preventScroll: true }));
    }, []);
    const toggleCreateSidePanel = useCallback(() => {
        if (!isCreateRoute || !createSession)
            return;
        // Standalone Cancel uses the existing popup close and webpage-focus lifecycle.
        if (standaloneCreate) {
            const current = store.getState().state.createSession;
            if (current?.childMode || current?.propertyEntryOpen || current?.hotkeyCapture.status !== 'idle') {
                dispatch({ type: 'CREATE_CHILD_MODE_CHANGED', mode: null });
                dispatch({ type: 'CREATE_PROPERTY_ENTRY_CHANGED', open: false });
                dispatch({ type: 'CREATE_HOTKEY_CAPTURE_CHANGED', capture: { status: 'idle', token: null, error: null } });
                if (current?.childMode) dispatch({ type: 'CREATE_ARGUMENT_QUERY_CHANGED', field: current.childMode, value: '' });
                const firstField = activeCreateGrammar?.fields.find(field => field.required && field.kind === 'text');
                dispatch({ type: 'CREATE_FOCUS_REQUESTED', target: firstField?.field || 'save-button' });
                return;
            }
            onRequestClose();
            return;
        }
        if (createSidePanelOpen) {
            for (const field of activeCreateGrammar?.fields || []) {
                if (!field.required && createSession.committedOptionalFieldOrder.includes(field.field)
                    && !isWebsitePopupCreateFieldComplete(field, createSession)) {
                    dispatch({ type: 'CREATE_OPTION_PRESENCE_SYNCED', field: field.field, present: false });
                }
            }
            if (createSession.childMode)
                dispatch({ type: 'CREATE_CHILD_MODE_CHANGED', mode: null });
            if (createSession.hotkeyCapture.status !== 'idle') {
                dispatch({ type: 'CREATE_HOTKEY_CAPTURE_CHANGED', capture: { status: 'idle', token: null, error: null } });
            }
            if (createSession.propertyEntryOpen)
                dispatch({ type: 'CREATE_PROPERTY_ENTRY_CHANGED', open: false });
            setCreateSidePanelOpen(false);
            setActiveCreateSurface('composer');
            const focusedField = createSession.activeArgumentId;
            const restoreTarget = focusedField && (activeCreateGrammar?.fields.some(field => field.required && field.field === focusedField)
                || createSession.committedOptionalFieldOrder.includes(focusedField)) ? focusedField : 'title';
            window.requestAnimationFrame(() => dispatch({ type: 'CREATE_FOCUS_REQUESTED', target: restoreTarget }));
            return;
        }
        if (createSession.childMode)
            dispatch({ type: 'CREATE_CHILD_MODE_CHANGED', mode: null });
        if (createSession.propertyEntryOpen)
            dispatch({ type: 'CREATE_PROPERTY_ENTRY_CHANGED', open: false });
        setCreateSidePanelOpen(true);
    }, [activeCreateGrammar, createSession, createSidePanelOpen, dispatch, isCreateRoute, standaloneCreate, onRequestClose, store]);
    const parseIntent = useMemo(() => (inputValue: string) => parseWebsitePopupQuery(inputValue, {
        categoryPrefixSettings: prefixSettingsStatus === 'ready' ? categoryPrefixSettings : [],
        actionPrefixSettings: prefixSettingsStatus === 'ready' ? actionPrefixSettings : [],
        subcommandPrefixSettings: prefixSettingsStatus === 'ready' ? subcommandPrefixSettings : [],
        createGrammar: prefixSettingsStatus === 'ready' ? createGrammar : [],
        actionGrammar: prefixSettingsStatus === 'ready' ? actionGrammar : [],
        canSaveChat: saveChat.canSaveChat,
        canCaptureCollection,
    }), [
        actionGrammar,
        canCaptureCollection,
        surface,
        saveChat.canSaveChat,
        actionPrefixSettings,
        categoryPrefixSettings,
        createGrammar,
        prefixSettingsStatus,
        subcommandPrefixSettings
    ]);
    const handleShadowMountChange = useCallback((mount: WebsitePopupShadowMount | null) => {
        shadowMountRef.current = mount;
        setShadowMount(mount);
    }, []);
    useLayoutEffect(() => {
        const controller = new WebsitePopupFocusController({
            getHost: () => shadowMountRef.current?.host ?? null,
            getShadowRoot: () => shadowMountRef.current?.shadowRoot ?? null,
            getInitialFocusTarget: () => {
                const route = store.getState().state.route;
                return route.kind === 'submode' && route.submode.id === 'send-agent-compose' ? sendAgentInputRef.current
                    : isWebsitePopupUnifiedCollectionPanel(route, surface) ? collectionTitleInputRef.current
                    : isCreateRouteRef.current ? createInputRef.current
                    : route.kind === 'submode' && route.submode.id === 'collection-destination' ? collectionInputRef.current
                    : route.kind === 'submode' && route.submode.id === 'collection-item-details' ? collectionTitleInputRef.current
                    : searchInputRef.current;
            },
            onRequestClose: () => requestCloseRef.current(),
        });
        focusControllerRef.current = controller;
        return () => {
            controller.dispose();
            focusControllerRef.current = null;
        };
    }, []);
    useLayoutEffect(() => {
        const controller = focusControllerRef.current;
        if (!controller)
            return;
        const focusTarget = sendAgentComposing ? sendAgentInputRef.current : unifiedCollection ? collectionTitleInputRef.current : isCreateRoute
            ? createInputRef.current
            : isCollectionDestination
                ? collectionInputRef.current
            : isCollectionItemDetails
                ? collectionTitleInputRef.current
            : searchInputRef.current;
        if (open && shadowMount && focusTarget) {
            controller.activate();
            return;
        }
        if (!open && controller.active)
            controller.deactivate();
    }, [sendAgentComposing, isCollectionDestination, isCollectionItemDetails, isCreateRoute, open, shadowMount]);
    useLayoutEffect(() => {
        if (!open)
            return;
        const focused = focusControllerRef.current?.focusInitialTarget();
        if (!focused || sendAgentComposing || isCreateRoute || isCollectionDestination || isCollectionItemDetails)
            return;
        const input = searchInputRef.current;
        if (!input)
            return;
        const caret = input.value.length;
        input.setSelectionRange(caret, caret);
    }, [sendAgentComposing, isCollectionDestination, isCollectionItemDetails, isCreateRoute, open, routeFocusKey, unifiedCollection, collectionCaptureRevision]);
    useEffect(() => {
        const inputValue = store.getState().state.inputValue;
        store.getState().dispatch({
            type: 'PARSED_INTENT_CHANGED',
            parsedIntent: parseIntent(inputValue),
        });
    }, [parseIntent, store]);
    const destinationFooter = isCollectionDestination && webScraping.error
        ? <WebsitePopupCollectionItemStatusFooter presentation="inline" state={{ revision: collectionCaptureRevision, status: 'error', error: webScraping.error, retry: webScraping.retry }}/>
        : isCollectionDestination ? <ConnectedWebsitePopupScreenshotStatusFooter store={store} controller={screenshotCaptureController} organisationId={searchSnapshot.defaultOrganisationId || null} presentation="inline"/> : undefined;
    const screenshotModes = showScreenshotModes
        ? <WebsitePopupScreenshotModeChooser store={store} controller={screenshotCaptureController} organisationId={searchSnapshot.defaultOrganisationId || null} enabled={open}/> : undefined;
    const detailsFooter = <WebsitePopupCollectionItemStatusFooter presentation="inline" state={collectionItemFooterState?.revision === collectionCaptureRevision ? collectionItemFooterState : null}/>;
    const detailsPreview = <WebsitePopupCollectionContentPreview state={collectionItemPreviewState?.revision === collectionCaptureRevision ? collectionItemPreviewState : null} enabled={open}/>;
    // One connected owner is rendered in either the header or the panel, never both.
    const collectionDetails = isCollectionItemDetails && !unifiedCollection ? <ConnectedWebsitePopupCollectionItemDetailsComposer
        key={collectionCaptureRevision} presentation="inline"
        initialRecord={savedScreenshot} webDraft={webScraping.draft} open={open} store={store} snapshot={searchSnapshot}
        onTitleInputRef={setCollectionTitleInput} onPreviewChange={setCollectionItemPreviewState} onStatusChange={setCollectionItemFooterState}
        inlinePickerTarget={collectionTagPickerTarget} onTagPickerOpenChange={setCollectionTagPickerOpen}/> : null;
    return (<WebsitePopupLayer surface={surface} suppressBackdropBlur={unifiedCollection} dialogLabel={unifiedCollection ? 'Web Clips' : undefined} presentation={presentation} open={runtimeOpen} suspended={captureSuspended} captureOverlay={webScraping.selecting ? <WebScrapingElementSelection key={collectionCaptureRevision} busy={webScraping.processing} onConfirm={webScraping.confirm} onCancel={webScraping.cancel}/> : <ConnectedWebsitePopupScreenshotCapture store={store} controller={screenshotCaptureController} organisationId={searchSnapshot.defaultOrganisationId || null} enabled={runtimeOpen && canCaptureCollection}/>} themeId={themeId} onRequestClose={onRequestClose} onAfterClose={onAfterClose} onShadowMountChange={handleShadowMountChange}>
      {sendAgentComposing && sendAgentSession ? <ConnectedWebsitePopupSendAgentComposer key={sendAgentSession.flowId}
        store={store} snapshot={searchSnapshot} controller={sendAgentController} shadowRoot={shadowMount?.shadowRoot || null}
        onInputRef={setSendAgentInput} onSent={onRequestClose}/> : (<WebsitePopupFrame presentation={presentation} header={unifiedCollection ? null : (<WebsitePopupHeader leading={<ConnectedWebsitePopupHeaderIdentity store={store}/>} leadingLayout="identity" composerLayout={isCreateRoute || isCollectionDestination || isCollectionItemDetails} trailing={isCollectionDestination || isCollectionItemDetails ? undefined : isCreateRoute
                ? <WebsitePopupSearchHint label={createHint.label} shortcut={createHint.shortcut} showLabel/>
                : textCommandAction.count > 1 ? (<WebsitePopupSearchHint label="Open all suggestions" showLabel shortcut={<FiExternalLink aria-hidden="true"/>} onActivate={() => void textCommandAction.activate()} disabled={textCommandAction.pending}/>)
                    : textCommandAction.count === 1 ? undefined : (<ConnectedWebsitePopupSearchHint store={store} {...DEFAULT_WEBSITE_POPUP_SEARCH_HINT}/>)}>
            {isCreateRoute ? (<ConnectedWebsitePopupCreateComposer store={store} createGrammar={createGrammar} sidePanelOpen={createPanelVisible} activeSurface={activeCreateSurface} onSurfaceFocus={setActiveCreateSurface} sidePanelPropertiesTarget={sidePanelPropertiesTarget} additionalPanelProperties={createModelProperties} onCollapseSidePanel={toggleCreateSidePanel} onPrimaryInputRef={element => {
                    createInputRef.current = element;
                }} onNextFieldLabelChange={setCreateNextFieldLabel}/>) : isCollectionDestination ? (<ConnectedWebsitePopupCollectionComposer key={collectionCaptureRevision} store={store} snapshot={searchSnapshot} onInputRef={element => {
                    collectionInputRef.current = element;
                }}/>) : isCollectionItemDetails ? collectionDetails : (<ConnectedWebsitePopupSearchInput ref={searchInputRef} store={store} parseIntent={parseIntent}/>)}
          </WebsitePopupHeader>)} footer={unifiedCollection ? undefined : isCreateRoute ? (<WebsitePopupCreateFooter open={open} store={store} createGrammar={createGrammar} keyboardTarget={shadowMount?.shadowRoot} sidePanelOpen={createPanelVisible} onToggleSidePanel={toggleCreateSidePanel} saveButtonTarget={createPanelVisible ? sidePanelSaveTarget : null} onRequestClose={onRequestClose}/>) : isCollectionItemDetails ? detailsFooter : destinationFooter} sidePanel={unifiedCollection ? <WebsitePopupCollectionCapturePanel store={store} snapshot={searchSnapshot} open={open}
          savedScreenshot={savedScreenshot} webDraft={webScraping.draft} webError={webScraping.error} onSelectElement={webScraping.start}
          controller={screenshotCaptureController} onTitleInputRef={setCollectionTitleInput} onClose={collectionLifecycle.cancel}/>
          : resultEditTarget ? (<WebsitePopupResultEditSidePanel key={`${resultEditTarget.entity}:${resultEditTarget.targetId}`} target={resultEditTarget} snapshot={searchSnapshot} onClose={closeResultEditor}/>) : saveChat.destination && saveChat.page ? (<WebsitePopupSaveChatSidePanel destination={saveChat.destination} page={saveChat.page} pending={saveChat.pending} error={saveChat.error} onSave={() => void saveChat.save()} onCancel={saveChat.cancel}/>) : createPanelVisible && isCreateRoute && activeCreateGrammar ? (<WebsitePopupCreateSidePanel key={activeCreateGrammar.entity} grammar={activeCreateGrammar} presentation={createPresentation} additionalProperties={standaloneCreate ? undefined : createModelProperties} onCollapse={toggleCreateSidePanel} onPropertiesMount={setSidePanelPropertiesTarget} onPickerMount={setSidePanelPickerTarget} activePickerField={activeCreateSurface === 'panel' ? createSession?.childMode ?? null : null} onSaveMount={setSidePanelSaveTarget}/>) : undefined}>
        {unifiedCollection ? null : showScreenshotModes ? screenshotModes : isCollectionItemDetails ? <>
          <div className="website-popup-collection-tag-picker-host" ref={setCollectionTagPickerTarget} hidden={!collectionTagPickerOpen}/>
          {!collectionTagPickerOpen ? detailsPreview : null}
        </> : <ConnectedWebsitePopupResultsLayer onSendAgentSelected={sendAgentController.selectTarget} store={store} categoryPrefixSettings={categoryPrefixSettings} actionPrefixSettings={actionPrefixSettings} subcommandPrefixSettings={subcommandPrefixSettings} createGrammar={createGrammar} actionGrammar={actionGrammar} prefixSettingsStatus={prefixSettingsStatus} searchSnapshot={searchSnapshot} searchSnapshotReady={searchSnapshotReady} searchSnapshotError={searchSnapshotError} surface={surface} textCommandActionPending={textCommandAction.pending} textCommandActionError={textCommandAction.error} canSaveChat={saveChat.canSaveChat} onChatSaveStage={destination => {
            if (saveChat.pending)
                return;
            setResultEditTarget(null);
            saveChat.stage(destination);
        }} chatSaveError={saveChatActive && !saveChat.destination ? saveChat.error : null} sidePanelOpen={createPanelVisible} activeCreateSurface={activeCreateSurface} sidePanelPickerTarget={sidePanelPickerTarget} keyboardTarget={shadowMount?.shadowRoot} keyboardEnabled={open} onRequestClose={onRequestClose} onCollapseSidePanel={toggleCreateSidePanel} resultEditOpen={Boolean(resultEditTarget || saveChat.destination)} onResultEditRequest={target => {
            if (!saveChat.pending)
                setResultEditTarget(target);
        }} onResultEditClose={resultEditTarget ? closeResultEditor : saveChat.cancel}/>}
      </WebsitePopupFrame>)}
    </WebsitePopupLayer>);
}

