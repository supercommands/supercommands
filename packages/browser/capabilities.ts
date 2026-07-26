export interface BrowserCapabilities {
  debuggerAutomation: boolean;
  chromeIdentityToken: boolean;
  webAuthFlow: boolean;
  dynamicScripting: boolean;
  omnibox: boolean;
  topSites: boolean;
}

export const capabilities: BrowserCapabilities = {
  debuggerAutomation: typeof chrome !== 'undefined' && !!chrome.debugger,
  chromeIdentityToken: typeof chrome !== 'undefined' && !!chrome.identity && typeof chrome.identity.getAuthToken === 'function',
  webAuthFlow: true,
  dynamicScripting: true,
  omnibox: true,
  topSites: typeof chrome !== 'undefined' && !!chrome.topSites,
};
