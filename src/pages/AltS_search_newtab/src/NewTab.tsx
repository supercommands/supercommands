import { withErrorBoundary, withSuspense } from '@extension/shared';
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useAssignedNewTabHotkeys } from './landingPage/hooks/useAssignedNewTabHotkeys';
import { clearNewTabHotkeyAppBindings } from './landingPage/hooks/newTabHotkeyAppBindings';
import { isHotkeyRecordingActive } from '../../../shared-components/hotkeys/core/hotkeyCapture';
import App from './landingPage/App';
const FullScreenNoteView = React.lazy(() => import('../../../shared-components/editorViews/fullScreenNoteView'));
import { useUIStore } from '../../../shared-components/uiStateManager';
import { hasTodoLocalEscapeOwner } from '../../../shared-components/todosSheet/todoKeyboardOwnership';
import { useDbStore } from '../../../storage/store/useDbStore';
const newTabBootStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
const ENABLE_NEW_TAB_BOOT_LOGS = false;
const newTabPerf = (label: string, data?: Record<string, unknown>) => {
    if (!ENABLE_NEW_TAB_BOOT_LOGS)
        return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    console.log('[NewTabPerf]', label, {
        elapsedMs: Math.round(now - newTabBootStartedAt),
        ...(data || {}),
    });
};
// Custom error boundary component
const ErrorFallback = ({ error }: {
    error?: Error;
}) => {
    const refreshPage = () => {
        window.location.reload();
    };
    return (<div className="flex flex-col items-center justify-center h-screen bg-black p-6">
      <div className="max-w-md text-center">
        <h2 className="text-2xl mb-4 text-gray-400">Something went wrong, please refresh this page</h2>
        <p className="mb-4 text-gray-400">The application encountered an unexpected error.</p>
        {error && (<div className="p-3 rounded-lg mb-4 text-left overflow-auto max-h-32">
            <p className="text-gray-400 text-sm font-mono">{error.message}</p>
          </div>)}
        <button onClick={refreshPage} className="px-4 py-2 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors">
          Refresh
        </button>
      </div>
    </div>);
};
const DeepFocusBlockedPage = ({ sessionId, sessionName, blockedUrl, blockedDomain, restrictedWindowBlock, }: {
    sessionId: string;
    sessionName: string;
    blockedUrl: string;
    blockedDomain: string;
    restrictedWindowBlock?: boolean;
}) => {
    const [status, setStatus] = useState<string>('');
    const sendDeepFocusAction = async (action: string, payload: Record<string, unknown> = {}) => {
        setStatus('');
        try {
            const response = await chrome.runtime.sendMessage({
                action,
                sessionId,
                ...payload,
            });
            if (!response?.ok) {
                setStatus(response?.error || 'Action failed.');
                return;
            }
            if (action === 'deep_focus_add_allowed_domain') {
                setStatus(`${response.domain || blockedDomain} added.`);
            }
        }
        catch (error: any) {
            setStatus(error?.message || 'Action failed.');
        }
    };
    return (<div className="min-h-screen w-full bg-[#101014] text-neutral-100 flex items-center justify-center px-6">
      <div className="w-full max-w-xl rounded-2xl border border-red-500/25 bg-[#18181c] p-6 shadow-2xl">
        <div className="text-xs font-bold uppercase tracking-wide text-red-400">Focus Mode</div>
        <h1 className="mt-2 text-2xl font-bold text-white">This is blocked.</h1>
        <p className="mt-2 text-sm leading-6 text-neutral-400">
          {restrictedWindowBlock
            ? 'This window does not have a running Focus session. Go to a pinned session tab to continue or stop Focus Mode there.'
            : `${sessionName || 'This session'} only allows its saved and whitelisted domains.`}
        </p>

        <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-500">Blocked domain</div>
          <div className="mt-1 text-sm font-semibold text-red-300 break-all">{blockedDomain || 'Unknown domain'}</div>
          <div className="mt-3 text-[11px] font-bold uppercase tracking-wide text-neutral-500">Blocked URL</div>
          <div className="mt-1 text-xs text-neutral-300 break-all">{blockedUrl || 'Unknown URL'}</div>
        </div>

        {status && (<div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-neutral-300">
            {status}
          </div>)}

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" onClick={() => sendDeepFocusAction('deep_focus_focus_pinned_tab')} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-red-700">
            Go to pinned tab
          </button>
          {!restrictedWindowBlock && (<>
              <button type="button" onClick={() => sendDeepFocusAction('deep_focus_add_allowed_domain', { domain: blockedDomain, url: blockedUrl })} className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200 transition hover:bg-red-500/15">
                Add domain
              </button>
              <button type="button" onClick={() => sendDeepFocusAction('deep_focus_turn_off')} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-neutral-200 transition hover:bg-white/10">
                Turn off Focus Mode
              </button>
            </>)}
        </div>
      </div>
    </div>);
};
const AltS_search_newtab = () => {
    useEffect(() => {
        const startedAt = performance.now();
        newTabPerf('dexie:initDbSync:start');
        useDbStore.getState().initDbSync();
        newTabPerf('dexie:initDbSync:registered', {
            durationMs: Math.round(performance.now() - startedAt),
        });
    }, []);
    // Lazy editor chunks are loaded on-demand when users open corresponding editors
    // Global centralized Escape listener for UI state manager hierarchy
    useEffect(() => {
        const handleGlobalEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (document.querySelector('[data-website-popup-layer-host="true"]'))
                    return;
                // Collection settings own Escape before the underlying page.
                if (document.querySelector('[data-collection-dialog]'))
                    return;
                const state = useUIStore.getState();
                // Active Todo cell editors and nested pickers own their first Escape.
                // Let their local key handlers close the deepest layer before the page
                // Escape hierarchy considers closing the editor itself.
                if (state.activeEditor?.type === 'todo' &&
                    hasTodoLocalEscapeOwner(event.target)) {
                    return;
                }
                console.log('[ESCAPE][NewTab] Escape pressed. activeView:', state.activeView, '| activeEditor:', state.activeEditor, '| isSheetOpen:', state.isSheetOpen, '| interceptors count:', state.escapeInterceptors.length);
                if (state.activeEditor) {
                    event.preventDefault();
                    event.stopPropagation();
                    state.handleEscape();
                    return;
                }
                state.handleEscape();
            }
        };
        window.addEventListener('keydown', handleGlobalEscape, { capture: true });
        return () => window.removeEventListener('keydown', handleGlobalEscape, { capture: true });
    }, []);
    // Parse URL parameters to check for full-screen note mode
    const [urlParams, setUrlParams] = useState(() => {
        const url = new URL(window.location.href);
        return {
            openNote: url.searchParams.get('open_note') === 'true',
            noteId: url.searchParams.get('noteid') || '',
            blockedSession: url.searchParams.get('blocked_session') === 'true',
            blockedSessionId: url.searchParams.get('session_id') || '',
            blockedSessionName: url.searchParams.get('session_name') || '',
            blockedUrl: url.searchParams.get('blocked_url') || '',
            blockedDomain: url.searchParams.get('blocked_domain') || '',
            restrictedWindowBlock: url.searchParams.get('restricted_window_block') === 'true',
        };
    });
    const noteRouteRef = useRef(urlParams.openNote);
    noteRouteRef.current = urlParams.openNote;
    const noteNavigationGuard = useRef<(() => Promise<boolean>) | null>(null);
    const prepareAppRequest = useRef<Promise<boolean> | null>(null);
    const hotkeyRouteActive = useRef(true);
    useEffect(() => { hotkeyRouteActive.current = true; return () => { hotkeyRouteActive.current = false; }; }, []);
    const registerNoteNavigationGuard = useCallback((guard: (() => Promise<boolean>) | null) => { noteNavigationGuard.current = guard; }, []);
    const openFullscreenNote = useCallback((id: string) => {
        if (!noteRouteRef.current || !noteNavigationGuard.current) return false;
        window.dispatchEvent(new CustomEvent('notes:open-fullscreen', { detail: id }));
        return true;
    }, []);
    const prepareHotkeyApp = useCallback((): Promise<boolean> => {
        if (!noteRouteRef.current) return Promise.resolve(true);
        if (prepareAppRequest.current) return prepareAppRequest.current;
        prepareAppRequest.current = (async () => {
            if (!noteNavigationGuard.current || !await noteNavigationGuard.current() || !hotkeyRouteActive.current) return false;
            clearNewTabHotkeyAppBindings();
            const url = new URL(window.location.href);
            url.searchParams.delete('open_note'); url.searchParams.delete('noteid');
            window.history.replaceState({}, '', url.href);
            setUrlParams(current => ({ ...current, openNote: false, noteId: '' }));
            return true;
        })().catch(() => false).finally(() => { prepareAppRequest.current = null; });
        return prepareAppRequest.current;
    }, []);
    useAssignedNewTabHotkeys({ enabled: !urlParams.blockedSession, isKeystrokeRecordingActive: isHotkeyRecordingActive,
        onOpenFullscreenNote: openFullscreenNote, prepareApp: prepareHotkeyApp });
    useEffect(() => {
        const handleMessage = (message: any) => {
            if (message.type === 'OPEN_NOTE') {
                if (noteRouteRef.current) {
                    window.dispatchEvent(new CustomEvent('notes:open-fullscreen', { detail: message.noteId }));
                    return;
                }
                // Update URL visually without reloading
                window.history.pushState({}, '', `?open_note=true&noteid=${encodeURIComponent(message.noteId)}`);
                setUrlParams({
                    openNote: true,
                    noteId: message.noteId,
                    blockedSession: false,
                    blockedSessionId: '',
                    blockedSessionName: '',
                    blockedUrl: '',
                    blockedDomain: '',
                    restrictedWindowBlock: false,
                });
            }
        };
        chrome.runtime.onMessage.addListener(handleMessage);
        return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }, []);
    const handleNoteViewBack = () => {
        // Navigate to default new tab
        const chromeAny = (window as any)?.chrome;
        if (chromeAny?.tabs?.update && chromeAny?.runtime?.getURL) {
            chromeAny.tabs.getCurrent((tab: any) => {
                if (tab?.id) {
                    chromeAny.tabs.update(tab.id, { url: chromeAny.runtime.getURL('AltS_search_newtab/index.html') });
                }
            });
        }
    };
    // Full-screen note view
    if (urlParams.openNote) {
        return <FullScreenNoteView noteId={urlParams.noteId} onBack={handleNoteViewBack} onNavigationGuardReady={registerNoteNavigationGuard}/>;
    }
    if (urlParams.blockedSession) {
        return (<DeepFocusBlockedPage sessionId={urlParams.blockedSessionId} sessionName={urlParams.blockedSessionName} blockedUrl={urlParams.blockedUrl} blockedDomain={urlParams.blockedDomain} restrictedWindowBlock={urlParams.restrictedWindowBlock}/>);
    }
    return <App />;
};
export default withErrorBoundary(withSuspense(AltS_search_newtab, <></>), <ErrorFallback />);
