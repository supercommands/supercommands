import { BRAND } from '../../../src/shared-components/brandingConfig';

const pendingInjections = new Map<number, Promise<void>>();

/** Recover tabs opened before an extension reload; send the toggle only once. */
export async function sendWebsitePopupToggle(tabId: number, url: string, message: { type: string; creatorType?: string }) {
  const ping = await chrome.tabs.sendMessage(tabId, { type: BRAND.events.contentScriptPing }, { frameId: 0 }).catch(() => null);
  if (!ping?.ok) {
    if (!/^https?:\/\//i.test(url)) throw new Error('This page does not support website commands.');
    let injection = pendingInjections.get(tabId);
    if (!injection) {
      injection = (async () => {
        const files = chrome.runtime.getManifest().content_scripts?.flatMap(script =>
          (script.js || []).filter(file => /(?:^|\/)content\.js$/.test(file)),
        );
        if (!files?.length) throw new Error('The website command runtime is unavailable in this build.');
        try {
          await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files: [...new Set(files)] });
        } catch {
          throw new Error('The website command could not access this page. Reload the page and try again.');
        }
      })();
      pendingInjections.set(tabId, injection);
    }
    try { await injection; }
    finally { if (pendingInjections.get(tabId) === injection) pendingInjections.delete(tabId); }
  }
  const response = await chrome.tabs.sendMessage(tabId, message, { frameId: 0 });
  if (response?.success !== true) throw new Error(response?.error || 'The website command could not be opened. Reload the page and try again.');
  return response;
}
