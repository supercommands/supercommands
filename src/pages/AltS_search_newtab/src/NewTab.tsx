import { withErrorBoundary, withSuspense } from '@extension/shared';
import { useEffect, useMemo, useState } from 'react';
import { getUserId, CMDOS_SIGN_UP_URL } from '../../../storage/API/core/api';
import { CMDOS_REDIRECT_URL } from '../../../storage/API/core/apiConfig';

import App from './landingPage/App';
import FullScreenNoteView from '../../../shared-components/editorViews/fullScreenNoteView';
import { useUIStore } from '../../../shared-components/uiStateManager';
import { useDbStore } from '../../../storage/store/useDbStore';
// Custom error boundary component
const ErrorFallback = ({ error }: { error?: Error }) => {
  const refreshPage = () => {
    window.location.reload();
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-black p-6">
      <div className="max-w-md text-center">
        <h2 className="text-2xl mb-4 text-gray-400">Something went wrong, please refresh this page</h2>
        <p className="mb-4 text-gray-400">The application encountered an unexpected error.</p>
        {error && (
          <div className="p-3 rounded-lg mb-4 text-left overflow-auto max-h-32">
            <p className="text-gray-400 text-sm font-mono">{error.message}</p>
          </div>
        )}
        <button
          onClick={refreshPage}
          className="px-4 py-2 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 transition-colors">
          Refresh
        </button>
      </div>
    </div>
  );
};

const AltS_search_newtab = () => {
  const logo = 'popup/icon.png';
  const gotoWebsite = () => chrome.tabs.create({ url: CMDOS_REDIRECT_URL });
  const handleLogin = () => {
    chrome.tabs.create({ url: CMDOS_SIGN_UP_URL });
  };

  // Removed force dark mode for LoginGuide to allow light mode

  useEffect(() => {
    getUserId().catch((error: any) => {
      if (error?.name !== 'AuthError' && !error?.message?.includes('login')) {
        console.error('Authentication Error:', error);
      }
    });
  }, []);

  useEffect(() => {
    useDbStore.getState().initDbSync();
  }, []);

  // Global centralized Escape listener for UI state manager hierarchy
  useEffect(() => {
    const handleGlobalEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        const state = useUIStore.getState();
        console.log('[ESCAPE][NewTab] Escape pressed. activeView:', state.activeView, '| activeEditor:', state.activeEditor, '| isSheetOpen:', state.isSheetOpen, '| interceptors count:', state.escapeInterceptors.length);
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
    };
  });

  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.type === 'OPEN_NOTE') {
        // Update URL visually without reloading
        window.history.pushState({}, '', `?open_note=true&noteid=${encodeURIComponent(message.noteId)}`);
        setUrlParams({ openNote: true, noteId: message.noteId });
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

  // No longer blocking the app with a login guide

  // Full-screen note view
  if (urlParams.openNote) {
    return <FullScreenNoteView noteId={urlParams.noteId} onBack={handleNoteViewBack} />;
  }

  return <App />;
};

export default withErrorBoundary(withSuspense(AltS_search_newtab, <></>), <ErrorFallback />);
