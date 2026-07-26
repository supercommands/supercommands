import { createRoot } from 'react-dom/client';
import App from './App';
import './tailwind-input.css';
import { AppearanceProvider } from '@extension/ui';

let hasStarted = false;

export async function startContentUI() {
  if (hasStarted) return;
  hasStarted = true;

  const root = document.createElement('div');
  root.id = 'chrome-extension-boilerplate-react-vite-content-view-root';
  root.style.position = 'fixed';
  root.style.inset = '0';
  root.style.zIndex = '2147483647';
  root.style.pointerEvents = 'none';

  document.body.append(root);

  const rootIntoShadow = document.createElement('div');
  rootIntoShadow.id = 'shadow-root';
  (window as any).__ALTS_PORTAL_HOST__ = rootIntoShadow;
  (window as any).__ALTQ_PORTAL_HOST__ = rootIntoShadow;

  const shadowRoot = root.attachShadow({ mode: 'open' });

  try {
    const cssUrl = chrome.runtime.getURL('assets/content-ui.css');
    const res = await fetch(cssUrl);
    if (res.ok) {
      const cssText = await res.text();
      if (navigator.userAgent.includes('Firefox')) {
        const styleElement = document.createElement('style');
        styleElement.innerHTML = cssText;
        shadowRoot.appendChild(styleElement);
      } else {
        const globalStyleSheet = new CSSStyleSheet();
        globalStyleSheet.replaceSync(cssText);
        shadowRoot.adoptedStyleSheets = [globalStyleSheet];
      }
    }
  } catch (e) {
    console.warn('[ContentUI] Failed to fetch CSS:', e);
  }

  shadowRoot.appendChild(rootIntoShadow);
  createRoot(rootIntoShadow).render(
    <AppearanceProvider>
      <App />
    </AppearanceProvider>,
  );
}
