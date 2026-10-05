import { resolveWebsitePopupCommandEntry } from './websitePopupCommandEntry';
import { executeWebsitePopupBridgeOperation } from '../bridge/websitePopupExecutionBridge';
import { WebsitePopupRefreshCoordinator } from '../../../../shared-components/websitePopup/WebsitePopupRefreshCoordinator';
/** Owns popup root lifecycle and shared refresh orchestration; bridge clients own transport. */
import { createRoot, type Root } from 'react-dom/client';
import { appearanceThemeStorage } from '@extension/storage';
import { DEFAULT_THEME_ID } from '@extension/ui/lib/theme/registry';
import { readWebsitePopupDefaultPrefixSettings } from '../bridge/websitePopupPrefixSettingsBridge';
import { readWebsitePopupSearchSnapshot } from '../bridge/websitePopupSearchBridge';
import { EMPTY_WEBSITE_POPUP_SEARCH_SNAPSHOT, type WebsitePopupSearchSnapshot, } from '../../../../shared-components/websitePopup/contracts/websitePopupSearchBridgeContract';
import type { WebsitePopupPrefixSettingLike } from '../catalog/websitePopupCreateCatalog';
import type { WebsitePopupActionGrammar, WebsitePopupCreateEntityGrammar, } from '../../../../shared-components/websitePopup/contracts/websitePopupPrefixSettingsBridgeContract';
import { createWebsitePopupInteractionStore, type WebsitePopupInteractionStoreApi, } from '../interaction/createWebsitePopupInteractionStore';
import { WebsitePopupApplication } from './WebsitePopupApplication';
import { WebsitePopupScreenshotCaptureController } from './WebsitePopupScreenshotCaptureController';
let runtimeRoot: Root | null = null;
let runtimeContainer: HTMLDivElement | null = null;
let interactionStore: WebsitePopupInteractionStoreApi | null = null;
let screenshotCaptureController: WebsitePopupScreenshotCaptureController | null = null;
let activePrefixSettings: readonly WebsitePopupPrefixSettingLike[] = [];
let activeActionPrefixSettings: readonly WebsitePopupPrefixSettingLike[] = [];
let activeSubcommandPrefixSettings: readonly WebsitePopupPrefixSettingLike[] = [];
let activeCreateGrammar: readonly WebsitePopupCreateEntityGrammar[] = [];
let activeActionGrammar: readonly WebsitePopupActionGrammar[] = [];
let activeSearchSnapshot: WebsitePopupSearchSnapshot = EMPTY_WEBSITE_POPUP_SEARCH_SNAPSHOT;
let isSearchSnapshotReady = false;
let searchSnapshotError: string | null = null;
let prefixSettingsStatus: 'loading' | 'ready' | 'failed' = 'loading';
let isPopupOpen = false;
let activeThemeId = DEFAULT_THEME_ID;
let activeSurface: 'website' | 'newtab' = 'website';
/** Remove popup nodes left behind when WXT reloads a content-script module in place. */
const removeStaleRuntimeDom = () => {
    document
        .querySelectorAll<HTMLElement>('[data-alts-runtime="true"], [data-website-popup-layer-host="true"]')
        .forEach(element => element.remove());
};
removeStaleRuntimeDom();
const SEARCH_SNAPSHOT_TABLES = new Set([
    'notes',
    'links',
    'snippets',
    'todos',
    'aiPrompts',
    'chatAgents',
    'sessions',
    'widgetViews',
    'tags',
    'workspaces',
    'userShortcuts',
    'bookmarks',
    'collections',
    'collectionItems',
    'organisations'
]);
type PrefixSnapshot = Awaited<ReturnType<typeof readWebsitePopupDefaultPrefixSettings>>;
const refreshCoordinator = new WebsitePopupRefreshCoordinator({
    prefixes: {
        read: readWebsitePopupDefaultPrefixSettings,
        pending: () => { prefixSettingsStatus = 'loading'; },
        commit: value => {
            const settings = value as PrefixSnapshot;
            activePrefixSettings = settings.categoryPrefixSettings;
            activeActionPrefixSettings = settings.actionPrefixSettings;
            activeSubcommandPrefixSettings = settings.subcommandPrefixSettings;
            activeCreateGrammar = settings.createGrammar;
            activeActionGrammar = settings.actionGrammar;
            prefixSettingsStatus = 'ready';
            renderWebsitePopupLayer(true);
        },
        fail: () => { prefixSettingsStatus = 'failed'; renderWebsitePopupLayer(true); },
    },
    search: {
        read: readWebsitePopupSearchSnapshot,
        commit: value => {
            activeSearchSnapshot = value as WebsitePopupSearchSnapshot;
            isSearchSnapshotReady = true;
            searchSnapshotError = null;
            renderWebsitePopupLayer(true);
        },
        fail: error => {
            searchSnapshotError = error instanceof Error ? error.message : 'Unable to load saved items.';
            renderWebsitePopupLayer(true);
        },
    },
    theme: {
        read: () => appearanceThemeStorage.get(),
        commit: value => { activeThemeId = value as string; renderWebsitePopupLayer(true); },
        fail: () => { activeThemeId = DEFAULT_THEME_ID; renderWebsitePopupLayer(true); },
    },
});
/** Both website messages and New Tab store changes use the same refresh policy. */
export function refreshWebsitePopupLayer(table: string) {
    if (!runtimeRoot || !isPopupOpen)
        return Promise.resolve();
    const key = table === 'prefixSettings' ? 'prefixes' : SEARCH_SNAPSHOT_TABLES.has(table) ? 'search' : null;
    return key ? refreshCoordinator.refresh(key) : Promise.resolve();
}
chrome.runtime.onMessage.addListener(message => {
    if (message?.action === 'db_changed')
        void refreshWebsitePopupLayer(String(message.table || ''));
});
const removeRuntimeRoot = () => {
    screenshotCaptureController?.dispose();
    screenshotCaptureController = null;
    refreshCoordinator.close();
    runtimeRoot?.unmount();
    runtimeRoot = null;
    runtimeContainer?.remove();
    runtimeContainer = null;
    interactionStore = null;
    activePrefixSettings = [];
    activeActionPrefixSettings = [];
    activeSubcommandPrefixSettings = [];
    activeCreateGrammar = [];
    activeActionGrammar = [];
    activeSearchSnapshot = EMPTY_WEBSITE_POPUP_SEARCH_SNAPSHOT;
    isSearchSnapshotReady = false;
    searchSnapshotError = null;
    prefixSettingsStatus = 'loading';
    isPopupOpen = false;
};
const removeRuntimeRootAfterLayerExit = () => {
    window.queueMicrotask(() => { if (!isPopupOpen)
        removeRuntimeRoot(); });
};
function renderWebsitePopupLayer(open: boolean) {
    const store = interactionStore;
    if (!store)
        return;
    runtimeRoot?.render(<WebsitePopupApplication open={open} screenshotCaptureController={screenshotCaptureController} themeId={activeThemeId} store={store} categoryPrefixSettings={activePrefixSettings} actionPrefixSettings={activeActionPrefixSettings} subcommandPrefixSettings={activeSubcommandPrefixSettings} createGrammar={activeCreateGrammar} actionGrammar={activeActionGrammar} prefixSettingsStatus={prefixSettingsStatus} searchSnapshot={activeSearchSnapshot} searchSnapshotReady={isSearchSnapshotReady} searchSnapshotError={searchSnapshotError} surface={activeSurface} onRequestClose={closeWebsitePopupLayer} onAfterClose={open ? undefined : removeRuntimeRootAfterLayerExit}/>);
}
/** A real extension shortcut retries the permission failure without resetting the destination. */
export function retryNewTabCollectionScreenshot(): boolean {
    const state = interactionStore?.getState().state;
    const session = state?.collectionSession;
    const capture = session?.screenshot;
    if (!isPopupOpen || activeSurface !== 'newtab' || !screenshotCaptureController
        || state?.route.kind !== 'submode' || state.route.submode.id !== 'collection-destination'
        || !session?.selectedCollectionId || session.pickerOpen || capture?.status !== 'error'
        || capture.code !== 'CAPTURE_PERMISSION_REQUIRED' || !capture.canRetry || capture.sourceUrl !== window.location.href) return false;
    void screenshotCaptureController.captureMode(capture.mode, activeSearchSnapshot.defaultOrganisationId ?? null);
    return true;
}

function closeWebsitePopupLayer() {
    if (!runtimeRoot || !isPopupOpen)
        return;
    isPopupOpen = false;
    interactionStore?.getState().dispatch({ type: 'SEND_AGENT_FLOW_CLOSED' });
    const capture = interactionStore?.getState().state.collectionSession?.screenshot;
    if (capture && capture.status !== 'idle') interactionStore?.getState().dispatch({
        type: 'COLLECTION_SCREENSHOT_CANCELLED', operationId: capture.operationId,
    });
    refreshCoordinator.close();
    renderWebsitePopupLayer(false);
}
/** Toggle popup, or open an explicit page command without toggling an already-open popup closed. */
export async function toggleWebsitePopupLayer(surface: 'website' | 'newtab' = 'website', commandId?: string) {
    const entry = commandId ? resolveWebsitePopupCommandEntry(commandId, {
        url: window.location.href, title: document.title || 'Untitled Page',
        text: String(document.body?.innerText || document.body?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 12000),
    }) : null;
    // An external command must not discard an active Create/Send draft or an uncertain send.
    if (entry && isPopupOpen) throw new Error('Close the current popup before opening another page command.');
    if (isPopupOpen && !entry) {
        closeWebsitePopupLayer();
        return;
    }
    if (!runtimeRoot) {
        runtimeContainer = document.createElement('div');
        runtimeContainer.dataset.altsRuntime = 'true';
        document.body.appendChild(runtimeContainer);
        runtimeRoot = createRoot(runtimeContainer);
    }
    if (interactionStore)
        interactionStore.getState().dispatch({ type: 'RESET' });
    else
        interactionStore = createWebsitePopupInteractionStore();
    screenshotCaptureController?.dispose();
    screenshotCaptureController = new WebsitePopupScreenshotCaptureController(interactionStore);
    activeSurface = surface;
    refreshCoordinator.open();
    searchSnapshotError = null;
    isPopupOpen = true;
    renderWebsitePopupLayer(true);
    await Promise.all([
        refreshCoordinator.refresh('theme'),
        refreshCoordinator.refresh('prefixes'),
        refreshCoordinator.refresh('search')
    ]);
    if (entry && isPopupOpen) {
        if ('event' in entry) interactionStore?.getState().dispatch(entry.event);
        else {
            await executeWebsitePopupBridgeOperation(entry.operation);
            closeWebsitePopupLayer();
        }
    }
}

/** Phase-C selection UI will invoke this after a Screenshot destination is chosen. */
export function beginWebsitePopupCollectionScreenshotCapture() {
    return isPopupOpen && activeSurface === 'website' && screenshotCaptureController
        ? screenshotCaptureController.start() : Promise.resolve(null);
}
