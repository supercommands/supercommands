export interface BrowserCapabilities {
  chromeIdentityToken: boolean;
  webAuthFlow: boolean;
  dynamicScripting: boolean;
  omnibox: boolean;
}

export const capabilities: BrowserCapabilities = {
  chromeIdentityToken: typeof chrome !== 'undefined' && !!chrome.identity && typeof chrome.identity.getAuthToken === 'function',
  webAuthFlow: true,
  dynamicScripting: true,
  omnibox: true,
};
