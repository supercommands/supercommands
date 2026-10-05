import { WebsiteSnippetInjector } from './website-snippet-injection/ListenForSnippetSlashCommand';
import { ImageDownloader } from './ImageDownloader';
import { showTableDownloadUi } from '../../../shared-components/pageExtraction/tableDownloadUi';
import { copyImageDataUrlToClipboard, prepareFullPageScreenshot, restoreFullPageScreenshot } from '../../../shared-components/pageExtraction/pageScreenshotDom';
import { buildHotkeyString, normalizeHotkeyString } from '../../../shared-components/hotkeys';
import { isHotkeyRecordingActive } from '../../../shared-components/hotkeys/core/hotkeyCapture';
import { BRAND } from '../../../shared-components/brandingConfig';
let hasStarted = false;
let altSWebsiteModulePromise: Promise<typeof import('../../AltS_search_websites/src/runtime/websitePopupLayerRuntime')> | null = null;
let websiteNotificationRuntimePromise: Promise<typeof import('../../../shared-components/notifications/websiteNotificationRuntime')> | null = null;
const TOGGLE_ALTS_MESSAGE = BRAND.events.toggleAlts;
function isAltSWebsiteToggleMessage(message: any) {
    return message?.type === TOGGLE_ALTS_MESSAGE || message?.type === 'cmdos:toggle-alts';
}
async function toggleAltSWebsiteRuntime(commandId?: string) {
    if (window.top !== window) {
        return { success: false, error: 'not_top_frame' };
    }
    altSWebsiteModulePromise ??= import('../../AltS_search_websites/src/runtime/websitePopupLayerRuntime');
    const altSWebsite = await altSWebsiteModulePromise;
    await altSWebsite.toggleWebsitePopupLayer('website', commandId);
    return { success: true };
}
export function startContentScript() {
    if (hasStarted)
        return;
    hasStarted = true;
    let currentTabId: number | undefined;
    chrome.runtime.sendMessage({ type: 'GET_TAB_ID' }, id => {
        currentTabId = id;
    });
    type DeepFocusBlockedOverlayPayload = {
        sessionId: string;
        sessionName: string;
        blockedUrl: string;
        blockedDomain: string;
        restrictedWindowBlock?: boolean;
    };
    const DEEP_FOCUS_OVERLAY_ID = BRAND.dom.deepFocusOverlayId;
    const CONTENT_SCRIPT_PROTOCOL_VERSION = 1;
    let deepFocusOverlayGuardObserver: MutationObserver | null = null;
    let deepFocusOverlayStopTimer: number | null = null;
    function removeDeepFocusBlockedOverlay() {
        deepFocusOverlayGuardObserver?.disconnect();
        deepFocusOverlayGuardObserver = null;
        if (deepFocusOverlayStopTimer !== null) {
            window.clearInterval(deepFocusOverlayStopTimer);
            deepFocusOverlayStopTimer = null;
        }
        document.getElementById(DEEP_FOCUS_OVERLAY_ID)?.remove();
        document.documentElement.style.removeProperty('overflow');
        document.documentElement.style.removeProperty('background');
        document.body?.style.removeProperty('margin');
        document.body?.style.removeProperty('min-height');
        document.body?.style.removeProperty('background');
    }
    function pauseDeepFocusUnderlyingMedia() {
        document.querySelectorAll('video,audio').forEach(media => {
            try {
                (media as HTMLMediaElement).pause();
            }
            catch {
                // Some sites expose media elements whose playback state cannot be changed.
            }
        });
    }
    function ensureDeepFocusBlockerBody() {
        if (!document.body) {
            const body = document.createElement('body');
            document.documentElement.appendChild(body);
        }
        document.documentElement.style.background = 'var(--color-modalBg, var(--color-rootBg, #101014))';
        document.body.style.margin = '0';
        document.body.style.minHeight = '100vh';
        document.body.style.background = 'var(--color-modalBg, var(--color-rootBg, #101014))';
        return document.body;
    }
    function keepOnlyDeepFocusOverlay(overlay: HTMLDivElement) {
        pauseDeepFocusUnderlyingMedia();
        const body = ensureDeepFocusBlockerBody();
        if (!body.contains(overlay)) {
            body.appendChild(overlay);
        }
    }
    function guardDeepFocusBlockedPage(overlay: HTMLDivElement) {
        deepFocusOverlayGuardObserver?.disconnect();
        if (deepFocusOverlayStopTimer !== null) {
            window.clearInterval(deepFocusOverlayStopTimer);
        }
        let guardRunning = false;
        const runGuard = () => {
            if (guardRunning)
                return;
            guardRunning = true;
            try {
                keepOnlyDeepFocusOverlay(overlay);
            }
            finally {
                guardRunning = false;
            }
        };
        deepFocusOverlayGuardObserver = new MutationObserver(runGuard);
        deepFocusOverlayGuardObserver.observe(document.documentElement, { childList: true });
        if (document.body)
            deepFocusOverlayGuardObserver.observe(document.body, { childList: true, subtree: false });
        deepFocusOverlayStopTimer = window.setInterval(pauseDeepFocusUnderlyingMedia, 300);
        window.setTimeout(() => {
            if (deepFocusOverlayStopTimer !== null) {
                window.clearInterval(deepFocusOverlayStopTimer);
                deepFocusOverlayStopTimer = null;
            }
        }, 8000);
    }
    function setDeepFocusOverlayStatus(text: string) {
        const status = document.getElementById(`${DEEP_FOCUS_OVERLAY_ID}-status`);
        if (status) {
            status.textContent = text;
            status.style.display = text ? 'block' : 'none';
        }
    }
    function sendDeepFocusOverlayAction(action: string, payload: Record<string, unknown>) {
        setDeepFocusOverlayStatus('');
        chrome.runtime.sendMessage({ action, ...payload }, response => {
            if (chrome.runtime.lastError) {
                setDeepFocusOverlayStatus(chrome.runtime.lastError.message || 'Action failed.');
                return;
            }
            if (!response?.ok) {
                setDeepFocusOverlayStatus(response?.error || 'Action failed.');
                return;
            }
            if (action === 'deep_focus_turn_off') {
                removeDeepFocusBlockedOverlay();
                return;
            }
            if (action === 'deep_focus_add_allowed_domain') {
                setDeepFocusOverlayStatus(`${response.domain || payload.domain || 'Domain'} added.`);
                setTimeout(removeDeepFocusBlockedOverlay, 450);
                return;
            }
            setDeepFocusOverlayStatus('');
        });
    }
    function showDeepFocusBlockedOverlay(payload: DeepFocusBlockedOverlayPayload) {
        removeDeepFocusBlockedOverlay();
        pauseDeepFocusUnderlyingMedia();
        const overlay = document.createElement('div');
        overlay.id = DEEP_FOCUS_OVERLAY_ID;
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        Object.assign(overlay.style, {
            position: 'fixed',
            inset: '0',
            zIndex: '2147483647',
            minHeight: '100vh',
            width: '100vw',
            background: 'var(--color-rootBg, #ffffff)',
            color: 'var(--color-textPrimary, #08090d)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '14px',
            boxSizing: 'border-box',
            fontFamily: 'var(--font-family, var(--font-sans, inherit))',
        });
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            margin: '0 0 16px',
            padding: '0',
            width: '100%',
            borderBottom: 'none',
            boxSizing: 'border-box',
            background: 'transparent',
        });
        const brand = document.createElement('div');
        Object.assign(brand.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            minWidth: '0',
            color: 'var(--color-textPrimary, #08090d)',
            fontSize: '18px',
            fontWeight: '800',
            fontFamily: 'var(--font-comfortaa, Comfortaa, Inter, ui-sans-serif, system-ui, sans-serif)',
        });
        const brandIcon = document.createElement('img');
        brandIcon.src = chrome.runtime.getURL(BRAND.assets.logoContentPath);
        brandIcon.alt = BRAND.name;
        Object.assign(brandIcon.style, {
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            objectFit: 'contain',
            display: 'block',
            flex: '0 0 auto',
        });
        const brandText = document.createElement('span');
        brandText.textContent = BRAND.name;
        brand.append(brandIcon, brandText);
        const headerPill = document.createElement('div');
        Object.assign(headerPill.style, {
            minHeight: '36px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            whiteSpace: 'nowrap',
            borderRadius: '10px',
            border: '0',
            background: 'color-mix(in srgb, var(--color-accent, #5b2cff) 5%, var(--color-rootBg, #ffffff))',
            color: 'var(--color-accent, #5b2cff)',
            fontSize: '13px',
            fontWeight: '700',
            boxShadow: '0 10px 24px rgba(76, 44, 201, 0.07)',
        });
        const headerFocusIcon = document.createElement('span');
        headerFocusIcon.textContent = '◎';
        Object.assign(headerFocusIcon.style, {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            lineHeight: '1',
        });
        headerPill.append(headerFocusIcon, document.createTextNode('Deep Focus mode'), document.createTextNode('•'), document.createTextNode('ON'));
        header.append(brand, headerPill);
        const card = document.createElement('div');
        Object.assign(card.style, {
            width: '100%',
            maxWidth: '520px',
            margin: '0 auto',
            padding: '20px',
            border: '1px solid var(--color-borderDefault, #e7eaf2)',
            borderRadius: '18px',
            background: 'var(--color-cardBg, #ffffff)',
            boxShadow: '0 18px 54px rgba(20, 31, 56, 0.14)',
            boxSizing: 'border-box',
            textAlign: 'center',
        });
        const label = document.createElement('div');
        label.textContent = '−';
        Object.assign(label.style, {
            width: '50px',
            height: '50px',
            margin: '0 auto',
            border: '2px solid var(--color-error, #ef171e)',
            borderRadius: '999px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-error, #ef171e)',
            fontSize: '32px',
            fontWeight: '500',
            lineHeight: '1',
            boxSizing: 'border-box',
        });
        const title = document.createElement('h1');
        title.textContent = 'Site blocked';
        Object.assign(title.style, {
            margin: '18px 0 0',
            color: 'var(--color-textPrimary, #08090d)',
            fontSize: '29px',
            lineHeight: '36px',
            fontWeight: '850',
            letterSpacing: '0',
        });
        const description = document.createElement('p');
        description.textContent = payload.restrictedWindowBlock
            ? 'This window does not have a running Deep Focus session.'
            : 'Deep Focus mode is active.';
        Object.assign(description.style, {
            margin: '8px 0 0',
            color: 'var(--color-textSecondary, #46536d)',
            fontSize: '14px',
            lineHeight: '20px',
            fontWeight: '500',
        });
        const details = document.createElement('div');
        Object.assign(details.style, {
            margin: '20px auto 18px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            minHeight: '40px',
            padding: '0 14px',
            borderRadius: '11px',
            border: '1px solid color-mix(in srgb, var(--color-error, #ef171e) 8%, var(--color-borderDefault, #f1d8dc))',
            background: 'color-mix(in srgb, var(--color-error, #ef171e) 5%, var(--color-rootBg, #ffffff))',
            boxShadow: '0 8px 20px rgba(239, 23, 30, 0.05)',
        });
        const domainLabel = document.createElement('div');
        domainLabel.textContent = '◎';
        Object.assign(domainLabel.style, {
            color: 'var(--color-error, #d70710)',
            fontSize: '20px',
            fontWeight: '800',
            lineHeight: '1',
        });
        const domainValue = document.createElement('div');
        domainValue.textContent = payload.blockedDomain || 'Unknown domain';
        Object.assign(domainValue.style, {
            color: 'color-mix(in srgb, var(--color-error, #d70710) 86%, var(--color-textPrimary, #08090d))',
            fontSize: '18px',
            fontWeight: '800',
            overflowWrap: 'anywhere',
        });
        const urlLabel = domainLabel.cloneNode(false) as HTMLDivElement;
        urlLabel.textContent = 'Blocked URL';
        urlLabel.style.marginTop = '14px';
        const urlValue = document.createElement('div');
        urlValue.textContent = payload.blockedUrl || 'Unknown URL';
        Object.assign(urlValue.style, {
            marginTop: '4px',
            color: 'var(--color-textSecondary, #d4d4d4)',
            fontSize: '12px',
            lineHeight: '18px',
            overflowWrap: 'anywhere',
        });
        details.append(domainLabel, domainValue);
        const status = document.createElement('div');
        status.id = `${DEEP_FOCUS_OVERLAY_ID}-status`;
        Object.assign(status.style, {
            display: 'none',
            marginTop: '12px',
            border: '1px solid var(--color-borderDefault, #e7eaf2)',
            borderRadius: '12px',
            background: 'var(--color-hoverBg, #f6f7fb)',
            padding: '8px 10px',
            color: 'var(--color-textSecondary, #46536d)',
            fontSize: '12px',
            fontWeight: '700',
        });
        const actions = document.createElement('div');
        Object.assign(actions.style, {
            marginTop: '12px',
            display: 'grid',
            gap: '10px',
        });
        const createButton = (text: string, variant: 'primary' | 'outline' | 'neutral') => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = text;
            Object.assign(button.style, {
                minHeight: '48px',
                borderRadius: '12px',
                padding: '11px 14px',
                fontSize: '13px',
                fontWeight: '800',
                cursor: 'pointer',
                border: '1px solid var(--color-borderDefault, #e7eaf2)',
                background: 'var(--color-cardBg, #ffffff)',
                color: variant === 'primary' ? 'var(--color-accent, #5b2cff)' : 'var(--color-textPrimary, #08090d)',
                boxShadow: '0 10px 28px rgba(20, 31, 56, 0.08)',
                textAlign: 'left',
            });
            return button;
        };
        const pinnedButton = createButton('Open PIN tab settings  ↗', 'primary');
        pinnedButton.addEventListener('click', () => {
            sendDeepFocusOverlayAction('deep_focus_focus_pinned_tab', { sessionId: payload.sessionId });
        });
        actions.append(pinnedButton);
        if (!payload.restrictedWindowBlock) {
            const addDomainButton = createButton(`Allow this domain  +`, 'outline');
            addDomainButton.addEventListener('click', () => {
                sendDeepFocusOverlayAction('deep_focus_add_allowed_domain', {
                    sessionId: payload.sessionId,
                    domain: payload.blockedDomain,
                    url: payload.blockedUrl,
                });
            });
            const turnOffButton = createButton('Deep Focus mode  ON', 'neutral');
            turnOffButton.addEventListener('click', () => {
                sendDeepFocusOverlayAction('deep_focus_turn_off', { sessionId: payload.sessionId });
            });
            actions.append(addDomainButton, turnOffButton);
        }
        const footer = document.createElement('div');
        footer.textContent = 'Life is short. Stay focused on what truly matters.';
        Object.assign(footer.style, {
            margin: '16px auto 0',
            paddingTop: '14px',
            borderTop: '1px solid var(--color-borderDefault, #e7eaf2)',
            color: 'var(--color-textSecondary, #46536d)',
            fontSize: '12px',
            lineHeight: '17px',
            fontWeight: '500',
        });
        card.append(header, label, title, description, details, actions, status, footer);
        overlay.appendChild(card);
        document.documentElement.style.overflow = 'hidden';
        const mountOverlay = () => {
            const existing = document.getElementById(DEEP_FOCUS_OVERLAY_ID);
            if (existing === overlay && document.body?.contains(overlay))
                return;
            if (existing && existing !== overlay)
                existing.remove();
            keepOnlyDeepFocusOverlay(overlay);
            guardDeepFocusBlockedPage(overlay);
        };
        if (document.body) {
            mountOverlay();
        }
        else {
            document.addEventListener('DOMContentLoaded', mountOverlay, { once: true });
            setTimeout(mountOverlay, 50);
        }
        let attempts = 0;
        const retryMount = window.setInterval(() => {
            attempts++;
            if (!document.body?.contains(overlay)) {
                mountOverlay();
            }
            if (document.body?.contains(overlay) || attempts >= 30) {
                window.clearInterval(retryMount);
            }
        }, 100);
    }
    function getPageTextSnapshot() {
        const clone = document.body?.cloneNode(true) as HTMLElement | undefined;
        if (!clone) {
            return {
                content: '',
                url: window.location.href,
                title: document.title,
            };
        }
        const removeElements = clone.querySelectorAll('script, style, noscript, svg, img, video, audio, iframe, canvas, link, [style*="display: none"], .alts-exclude');
        removeElements.forEach(el => el.remove());
        let text = clone.textContent || '';
        text = text.replace(/\s+/g, ' ').replace(/\n+/g, '\n').trim();
        const maxLength = 12000;
        if (text.length > maxLength) {
            text = text.substring(0, maxLength) + '... [content truncated]';
        }
        return {
            content: text,
            url: window.location.href,
            title: document.title,
        };
    }
    async function cropCapturedVisibleTab(imgUrl: string, cropRect: any): Promise<string | null> {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return null;
        const img = new Image();
        img.src = imgUrl;
        await new Promise(resolve => {
            img.onload = resolve;
        });
        canvas.width = cropRect.width * cropRect.dpr;
        canvas.height = cropRect.height * cropRect.dpr;
        ctx.drawImage(img, cropRect.x * cropRect.dpr, cropRect.y * cropRect.dpr, cropRect.width * cropRect.dpr, cropRect.height * cropRect.dpr, 0, 0, cropRect.width * cropRect.dpr, cropRect.height * cropRect.dpr);
        return canvas.toDataURL('image/png');
    }
    // Listen for image downloads from the web application.
    window.addEventListener('message', event => {
        if (event.source !== window)
            return;
        if (event.data && (event.data.type === 'supercommands:download-image' || event.data.type === 'cmdos:download-image')) {
            const { dataUrl, filename } = event.data;
            console.log('[Content Script] Bridge intercepted download-image event:', { filename, dataUrlPrefix: dataUrl?.substring(0, 100) });
            chrome.runtime.sendMessage({
                action: 'supercommands:download-image',
                url: dataUrl,
                filename: filename
            }, response => {
                if (chrome.runtime.lastError) {
                    console.error('[Content Script] Forwarding download-image failed:', chrome.runtime.lastError);
                }
                else {
                    console.log('[Content Script] Forwarded download-image response:', response);
                }
            });
        }
    });
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (isAltSWebsiteToggleMessage(message)) {
            toggleAltSWebsiteRuntime(typeof message.creatorType === 'string' ? message.creatorType : undefined)
                .then(sendResponse)
                .catch(error => sendResponse({ success: false, error: String(error?.message || error) }));
            return true;
        }
        if (message?.type === 'supercommands:content-script-ping' || message?.type === 'cmdos:content-script-ping') {
            sendResponse({
                ok: true,
                protocolVersion: CONTENT_SCRIPT_PROTOCOL_VERSION,
                url: window.location.href,
                title: document.title,
            });
            return true;
        }
        if (message?.type === 'SHOW_DEEP_FOCUS_BLOCKED_OVERLAY') {
            if (window.top !== window) {
                sendResponse({ ok: false, error: 'not_top_frame' });
                return true;
            }
            showDeepFocusBlockedOverlay({
                sessionId: message.sessionId || '',
                sessionName: message.sessionName || '',
                blockedUrl: message.blockedUrl || window.location.href,
                blockedDomain: message.blockedDomain || window.location.hostname,
                restrictedWindowBlock: message.restrictedWindowBlock === true,
            });
            sendResponse({ ok: true });
            return true;
        }
        if (message?.type === 'HIDE_DEEP_FOCUS_BLOCKED_OVERLAY') {
            removeDeepFocusBlockedOverlay();
            sendResponse({ ok: true });
            return true;
        }
        if (message?.type === 'SHOW_TOAST') {
            websiteNotificationRuntimePromise ??= import('../../../shared-components/notifications/websiteNotificationRuntime');
            websiteNotificationRuntimePromise
                .then(runtime => {
                runtime.showWebsiteNotification(String(message.message || ''), message.toastType || 'info');
                sendResponse({ ok: true });
            })
                .catch(error => sendResponse({ ok: false, error: String(error?.message || error) }));
            return true;
        }
        if (message?.action === 'scrape_page_content' || message?.action === 'scrape_tab_by_id' || message?.type === 'GET_PAGE_TEXT') {
            sendResponse({ ok: true, ...getPageTextSnapshot() });
            return true;
        }
        if (message?.action === 'execute_table_download') {
            sendResponse({ ok: true, results: [{ result: showTableDownloadUi() }] });
            return true;
        }
        if (message?.type === 'supercommands:crop-captured-visible-tab' || message?.type === 'cmdos:crop-captured-visible-tab') {
            cropCapturedVisibleTab(String(message.dataUrl || ''), message.rect)
                .then(dataUrl => sendResponse({ ok: true, dataUrl }))
                .catch(error => sendResponse({ ok: false, error: String(error?.message || error) }));
            return true;
        }
        if (message?.type === 'supercommands:copy-image-to-clipboard' || message?.type === 'cmdos:copy-image-to-clipboard') {
            copyImageDataUrlToClipboard(String(message.dataUrl || ''))
                .then(() => sendResponse({ ok: true }))
                .catch(error => sendResponse({ ok: false, error: String(error?.message || error) }));
            return true;
        }
        if (message?.type === 'supercommands:prepare-full-page-screenshot' || message?.type === 'cmdos:prepare-full-page-screenshot') {
            sendResponse({ ok: true, dimensions: prepareFullPageScreenshot() });
            return true;
        }
        if (message?.type === 'supercommands:scroll-full-page-screenshot' || message?.type === 'cmdos:scroll-full-page-screenshot') {
            window.scrollTo(0, Number(message.y || 0));
            sendResponse({ ok: true });
            return true;
        }
        if (message?.type === 'supercommands:restore-full-page-screenshot' || message?.type === 'cmdos:restore-full-page-screenshot') {
            restoreFullPageScreenshot();
            sendResponse({ ok: true });
            return true;
        }
        return false;
    });
    // Initialize global hotkey controller
    new WebsiteSnippetInjector();
    // Initialize image downloader
    new ImageDownloader();
    class GlobalHotkeyController {
        private hotkeysMap: Record<string, {
            id: string;
            type: string;
        }> = {};
        private isLoading = false;
        private refreshRequested = false;
        constructor() {
            this.loadHotkeys();
            this.setupKeydownListener();
            this.setupMessageListener();
        }
        private setupMessageListener(): void {
            if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage)
                return;
            chrome.runtime.onMessage.addListener((request) => {
                if (request.action === 'RELOAD_HOTKEYS') {
                    this.loadHotkeys();
                }
                if (request.action === 'db_changed' && request.table === 'hotkeysMap') {
                    this.loadHotkeys();
                }
            });
        }
        private async loadHotkeys(): Promise<void> {
            if (this.isLoading) {
                this.refreshRequested = true;
                return;
            }
            this.isLoading = true;
            try {
                const response = await new Promise<any>((resolve, reject) => {
                    if (!chrome?.runtime?.sendMessage) {
                        resolve({});
                        return;
                    }
                    chrome.runtime.sendMessage({ action: 'GET_ALL_HOTKEYS' }, (res) => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        }
                        else {
                            resolve(res || {});
                        }
                    });
                });
                // Normalize keys up front for O(1) lookup
                this.hotkeysMap = {};
                if (response.hotkeysMap) {
                    Object.entries(response.hotkeysMap).forEach(([combination, data]) => {
                        this.hotkeysMap[normalizeHotkeyString(String(combination))] = data as {
                            id: string;
                            type: string;
                        };
                    });
                }
            }
            catch (error) {
                console.error('[GlobalHotkey] Failed to load hotkeys:', error);
            }
            finally {
                this.isLoading = false;
                if (this.refreshRequested) {
                    this.refreshRequested = false;
                    void this.loadHotkeys();
                }
            }
        }
        private setupKeydownListener(): void {
            window.addEventListener('keydown', (event: any) => {
                if (isHotkeyRecordingActive(event))
                    return;
                if (!event.altKey && !event.ctrlKey && !event.metaKey)
                    return;
                if (['Control', 'Shift', 'Alt', 'Meta', 'Escape'].includes(event.key))
                    return;
                const isMac = navigator.userAgent.indexOf('Mac OS X') !== -1;
                const rawHotkey = buildHotkeyString(event, isMac) || '';
                const pressedHotkey = normalizeHotkeyString(rawHotkey);
                // O(1) Match
                const matched = this.hotkeysMap[pressedHotkey];
                if (matched) {
                    // Send original type (note, link, snippet, command, automation, module)
                    this.triggerHotkey(matched.type, matched.id, event);
                    return;
                }
            }, true);
        }
        private triggerHotkey(type: string, id: string, event: KeyboardEvent) {
            if (typeof chrome === 'undefined' || !chrome.runtime?.id)
                return;
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            chrome.runtime.sendMessage({
                action: 'trigger_hotkey',
                type,
                id,
                triggerUsage: {
                    triggerKind: 'user_hotkey',
                    triggerValue: normalizeHotkeyString(buildHotkeyString(event, navigator.userAgent.indexOf('Mac OS X') !== -1) || ''),
                    triggerSource: 'hotkey',
                    surface: 'content_script',
                    referenceId: id,
                    referenceType: type,
                    url: window.location.href,
                    correlationId: `hotkey_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                },
            });
        }
    }
    new GlobalHotkeyController();
}
