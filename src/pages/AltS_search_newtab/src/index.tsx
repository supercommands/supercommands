import { createRoot } from 'react-dom/client';
import './index.css';
import '@extension/ui/lib/global.css';
import AltS_search_newtab from './NewTab';
import { QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { queryClient } from './query/queryClient';
import { migrateLocalStorageToChromeStorage } from '@extension/shared/lib/utils';
import { useEffect, Suspense } from 'react';
import { AppearanceProvider } from '@extension/ui';
import { reduxStore } from './redux/store';
import { startupPerf } from './startupPerf';
import { BRAND } from '../../../shared-components/brandingConfig';
import { useUIStore } from '../../../shared-components/uiStateManager';
import { useDbStore } from '../../../storage/store/useDbStore';
import { db } from '../../../storage/indexDB/dbConfig';
import { COLLECTION_PAGE_SOURCE_ACTION, COLLECTION_PAGE_IMAGE_ACTION } from '../../../shared-components/collections/collectionPageCaptureContract';
import { NEW_TAB_SCREENSHOT_SHORTCUT_RETRY } from '../../../shared-components/websitePopup/contracts/websitePopupScreenshotBridgeContract';
let newTabPopupRuntimePromise: Promise<typeof import('../../AltS_search_websites/src/runtime/websitePopupLayerRuntime')> | null = null;
const NEW_TAB_PAGE_ACTIONS = new Set([
    COLLECTION_PAGE_SOURCE_ACTION,
    COLLECTION_PAGE_IMAGE_ACTION,
    'execute_image_download',
    'execute_table_download',
    'supercommands:prepare-full-page-screenshot',
    'supercommands:scroll-full-page-screenshot',
    'supercommands:restore-full-page-screenshot',
    'cmdos:restore-full-page-screenshot',
    'supercommands:copy-image-to-clipboard'
]);
function NewTabPopupEntry() {
    useEffect(() => {
        let currentTabId: number | null = null;
        chrome.tabs.getCurrent(tab => { currentTabId = tab?.id ?? null; });
        const togglePopup = async () => {
            newTabPopupRuntimePromise ??= import('../../AltS_search_websites/src/runtime/websitePopupLayerRuntime');
            const runtime = await newTabPopupRuntimePromise;
            await runtime.toggleWebsitePopupLayer('newtab');
        };
        const onMessage = (message: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
            if ((message?.type === COLLECTION_PAGE_SOURCE_ACTION || message?.type === COLLECTION_PAGE_IMAGE_ACTION || message?.type === NEW_TAB_SCREENSHOT_SHORTCUT_RETRY)
                && (_sender.id !== chrome.runtime.id || _sender.tab)) return false;
            if (typeof message?.targetTabId !== 'number' || message.targetTabId !== currentTabId)
                return false;
            const isToggle = message.type === BRAND.events.toggleAlts;
            const isScreenshotRetry = message.type === NEW_TAB_SCREENSHOT_SHORTCUT_RETRY;
            const isPageAction = NEW_TAB_PAGE_ACTIONS.has(message.action || message.type);
            const isToast = message.type === 'website_popup:toast';
            if (!isToggle && !isPageAction && !isScreenshotRetry && !isToast)
                return false;
            if (isToast) {
                useUIStore.getState().queueNotification({ message: String(message.message || ''), type: message.toastType || 'info' });
                sendResponse({ ok: true });
                return false;
            }
            const action = isScreenshotRetry
                ? newTabPopupRuntimePromise
                    ? newTabPopupRuntimePromise.then(runtime => ({ resumed: runtime.retryNewTabCollectionScreenshot() }))
                    : Promise.resolve({ resumed: false })
                : isToggle
                    ? togglePopup().then(() => ({ success: true }))
                    : import('./newTabPageActions').then(runtime => runtime.handleNewTabPageAction(message));
            void action
                .then(sendResponse)
                .catch(error => sendResponse({ ok: false, success: false, error: String(error?.message || error) }));
            return true;
        };
        chrome.runtime.onMessage.addListener(onMessage);
        const refreshPopup = (table: string) => {
            if (!newTabPopupRuntimePromise)
                return;
            void newTabPopupRuntimePromise
                .then(runtime => runtime.refreshWebsitePopupLayer(table))
                .catch(() => undefined);
        };
        const unsubscribeDb = useDbStore.subscribe((state, previous) => {
            if (!newTabPopupRuntimePromise)
                return;
            const changedTables = ([
                'notes', 'links', 'snippets', 'todos', 'aiPrompts', 'chatAgents',
                'sessions', 'widgetViews', 'tags', 'userShortcuts', 'prefixSettings'
            ] as const).filter(table => state[table] !== previous[table]);
            changedTables.forEach(refreshPopup);
        });
        const url = new URL(window.location.href);
        if (url.searchParams.get('open_popup') === 'true') {
            url.searchParams.delete('open_popup');
            window.history.replaceState({}, '', url.pathname + url.search + url.hash);
            void togglePopup().catch(error => console.error('[NewTabPopup] Failed to open popup:', error));
        }
        return () => {
            chrome.runtime.onMessage.removeListener(onMessage);
            unsubscribeDb();
        };
    }, []);
    return null;
}
function AppBootstrapper() {
    startupPerf('AppBootstrapper:render');
    useEffect(() => {
        startupPerf('AppBootstrapper:commit');
    }, []);
    return (<QueryClientProvider client={queryClient}>
      <Suspense fallback={<></>}>
        <Provider store={reduxStore}>
          <AppearanceProvider>
            <AltS_search_newtab />
            <NewTabPopupEntry />
          </AppearanceProvider>
        </Provider>
      </Suspense>
    </QueryClientProvider>);
}
async function init() {
    const startedAt = performance.now();
    await migrateLocalStorageToChromeStorage();
    await db.open();
    startupPerf('localStorageMigration:done', { durationMs: Math.round(performance.now() - startedAt) });
    startupPerf('init:start');
    const appContainer = document.querySelector('#app-container');
    if (!appContainer) {
        throw new Error('Can not find #app-container');
    }
    const root = createRoot(appContainer);
    startupPerf('root:render:start');
    root.render(<AppBootstrapper />);
    startupPerf('root:render:scheduled');
}
void init().catch(error => {
    console.error('[Organisation migration] New-tab startup failed:', error);
    const container = document.querySelector('#app-container');
    if (container)
        container.textContent = 'Unable to open your data. ' + String(error?.message || error);
});
