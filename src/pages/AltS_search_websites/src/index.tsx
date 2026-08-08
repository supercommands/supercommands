import type { ErrorInfo, ReactNode } from 'react';
import * as React from 'react';
import { useState, useEffect, Component } from 'react';
import { createRoot } from 'react-dom/client';
import { AppearanceProvider } from '@extension/ui';
import App from './landing/App';
import NotificationContainer from '../../../shared-components/notifications/NotificationContainer';
import './tailwind-input.css';

// Error Boundary for stability
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AltS ErrorBoundary] Caught error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-[2147483647]">
          <div className="bg-neutral-900 border border-white/10 rounded-3xl p-8 text-center max-w-sm">
            <h2 className="text-xl font-bold text-white mb-2">Popup Error</h2>
            <p className="text-white/60 mb-6 text-sm">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-white text-black rounded-xl font-bold">
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const TOGGLE_ALTS_MESSAGE = 'tasklabs:toggle-alts-popup';
let isAltsPopupOpen = false;
let reactRootInstance: any = null;
let rootEl: HTMLDivElement | null = null;

// Dynamic Mount & Unmount Functions
const mountAndOpenPopup = async (initialCommand?: string) => {
  if (isAltsPopupOpen) return;

  rootEl = document.createElement('div');
  rootEl.id = 'alts-root';
  rootEl.style.cssText =
    'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2147483646; pointer-events: auto; border: none; outline: none;';

  document.body.appendChild(rootEl);

  const shadowRoot = rootEl.attachShadow({ mode: 'open' });

  // Styles
  const styleTag = document.createElement('style');
  try {
    const cssUrl = chrome.runtime.getURL('assets/alt-s-website.css');
    const res = await fetch(cssUrl);
    if (res.ok) {
      styleTag.textContent = await res.text();
    }
  } catch (e) {
    console.warn('[AltS] Failed to fetch extracted CSS:', e);
  }
  shadowRoot.appendChild(styleTag);

  const themeStyleTag = document.createElement('style');
  themeStyleTag.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    
    :host {
      all: initial !important;
      display: block !important;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 2147483646 !important;
      pointer-events: auto;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    #shadow-root-container {
      all: initial;
      display: block;
      width: 100%;
      height: 100%;
      pointer-events: inherit;
      font-family: 'Inter', sans-serif;
    }
  `;
  shadowRoot.appendChild(themeStyleTag);

  const container = document.createElement('div');
  container.id = 'shadow-root-container';
  shadowRoot.appendChild(container);

  (window as any).__ALTS_PORTAL_HOST__ = container;
  (window as any).__ALTQ_PORTAL_HOST__ = container; // Keep legacy reference just in case

  const Main = ({ initialCommand }: { initialCommand?: string }) => {
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');

    useEffect(() => {
      const updateTheme = () => {
        chrome.storage.local.get(['theme', 'example-theme-storage'], result => {
          const storedTheme = result.theme || result['example-theme-storage'];
          if (storedTheme === 'light' || storedTheme === 'dark') {
            setTheme(storedTheme);
          } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setTheme(prefersDark ? 'dark' : 'light');
          }
        });
      };

      updateTheme();

      const storageListener = (changes: any) => {
        if (changes.theme || changes['example-theme-storage']) {
          updateTheme();
        }
      };
      chrome.storage.onChanged.addListener(storageListener);
      return () => chrome.storage.onChanged.removeListener(storageListener);
    }, []);

    return (
      <AppearanceProvider>
        <ErrorBoundary>
          <App isOpen={true} onClose={destroyAndClosePopup} theme={theme} initialCommand={initialCommand} />
        </ErrorBoundary>
      </AppearanceProvider>
    );
  };

  reactRootInstance = createRoot(container);
  reactRootInstance.render(<Main initialCommand={initialCommand} />);
  isAltsPopupOpen = true;
};

const destroyAndClosePopup = () => {
  if (!isAltsPopupOpen) return;
  isAltsPopupOpen = false;

  setTimeout(() => {
    if (reactRootInstance) {
      try {
        reactRootInstance.unmount();
      } catch (e) {
        console.warn('[AltS] Error unmounting react tree:', e);
      }
      reactRootInstance = null;
    }

    if (rootEl) {
      rootEl.remove();
      rootEl = null;
    }
  }, 0);
};

let isNotificationSystemMounted = false;
const mountStandaloneNotificationSystem = async () => {
  if (isNotificationSystemMounted) return;

  const notifRootEl = document.createElement('div');
  notifRootEl.id = 'alts-notification-root';
  notifRootEl.style.cssText =
    'position: fixed; top: 0; left: 0; width: 100vw; height: 0; z-index: 2147483647; pointer-events: none; border: none; outline: none; overflow: visible;';

  document.body.appendChild(notifRootEl);

  const shadowRoot = notifRootEl.attachShadow({ mode: 'open' });

  // Styles
  const styleTag = document.createElement('style');
  try {
    const cssUrl = chrome.runtime.getURL('assets/alt-s-website.css');
    const res = await fetch(cssUrl);
    if (res.ok) {
      styleTag.textContent = await res.text();
    }
  } catch (e) {
    console.warn('[AltS] Failed to fetch extracted CSS for notifications:', e);
  }
  shadowRoot.appendChild(styleTag);

  const themeStyleTag = document.createElement('style');
  themeStyleTag.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    
    :host {
      all: initial !important;
      display: block !important;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 0 !important;
      z-index: 2147483647 !important;
      pointer-events: none;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    }
    #shadow-root-container-notif {
      all: initial;
      display: block;
      width: 100%;
      height: 100%;
      pointer-events: none;
      font-family: 'Inter', sans-serif;
    }
  `;
  shadowRoot.appendChild(themeStyleTag);

  const container = document.createElement('div');
  container.id = 'shadow-root-container-notif';
  container.classList.add('dark');
  shadowRoot.appendChild(container);

  const notifReactRootInstance = createRoot(container);
  
  // Notification component is pure UI + store listener
  notifReactRootInstance.render(<NotificationContainer variant="top-text-only" />);
  isNotificationSystemMounted = true;
};

export function startAltSWebsite() {
  console.log(
    '[AltS] startAltSWebsite called! window.__tasklabs_alt_s_started:',
    (window as any).__tasklabs_alt_s_started,
  );
  if ((window as any).__tasklabs_alt_s_started) return;
  (window as any).__tasklabs_alt_s_started = true;

  // Mount the standalone notification system immediately
  mountStandaloneNotificationSystem();

  // Capture phase key event interceptor to prevent host sites (like Google) from stealing keys
  const handleGlobalCapture = (event: KeyboardEvent) => {
    if (isAltsPopupOpen) {
      const path = event.composedPath();
      const isInsideAlts = path.some((el: any) => el.id === 'alts-root' || el.id === 'shadow-root-container');
      if (isInsideAlts) {
        // If an input is focused inside our shadow root, allow all key events
        const shadow = rootEl?.shadowRoot;
        if (shadow && shadow.activeElement && shadow.activeElement.tagName === 'INPUT') {
          return;
        }

        // Let navigation and selection keys propagate down to React inside our Shadow DOM
        if (
          ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape', 'Backspace', 'Delete', ' '].includes(
            event.key,
          )
        ) {
          return;
        }
        event.stopImmediatePropagation();
      }
    }
  };
  window.addEventListener('keydown', handleGlobalCapture, true);
  window.addEventListener('keyup', handleGlobalCapture, true);
  window.addEventListener('keypress', handleGlobalCapture, true);
  document.addEventListener('keydown', handleGlobalCapture, true);
  document.addEventListener('keyup', handleGlobalCapture, true);
  document.addEventListener('keypress', handleGlobalCapture, true);

  // Listening for Toggle Events
  window.addEventListener(TOGGLE_ALTS_MESSAGE, () => {
    if (isAltsPopupOpen) {
      destroyAndClosePopup();
    } else {
      mountAndOpenPopup();
    }
  });

  chrome.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
    if (
      message.type === TOGGLE_ALTS_MESSAGE ||
      message.type === 'tasklabs:toggle-altq-popup' ||
      message.action === 'toggle_altq_popup' ||
      message.action === 'toggle_alts_popup'
    ) {
      if (isAltsPopupOpen) {
        destroyAndClosePopup();
      } else {
        mountAndOpenPopup(message.creatorType);
      }
      if (sendResponse) sendResponse({ success: true });
    }
    return false;
  });
}
