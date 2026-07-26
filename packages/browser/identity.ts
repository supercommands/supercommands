export interface IdentityAdapter {
  getAuthToken(details: chrome.identity.TokenDetails): Promise<string | undefined>;
  removeCachedAuthToken(details: chrome.identity.TokenInformation): Promise<void>;
  launchWebAuthFlow(details: chrome.identity.WebAuthFlowOptions): Promise<string | undefined>;
}

export const identityAdapter: IdentityAdapter = {
  async getAuthToken(details) {
    if (typeof chrome !== 'undefined' && chrome.identity && typeof chrome.identity.getAuthToken === 'function') {
      return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken(details, (token) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(token);
          }
        });
      });
    }
    throw new Error('chrome.identity.getAuthToken is not supported on this browser.');
  },

  async removeCachedAuthToken(details) {
    if (typeof chrome !== 'undefined' && chrome.identity && typeof chrome.identity.removeCachedAuthToken === 'function') {
      return new Promise((resolve, reject) => {
        chrome.identity.removeCachedAuthToken(details, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    }
  },

  async launchWebAuthFlow(details) {
    if (typeof chrome !== 'undefined' && chrome.identity && typeof chrome.identity.launchWebAuthFlow === 'function') {
      return new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow(details, (responseUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(responseUrl);
          }
        });
      });
    }
    throw new Error('chrome.identity.launchWebAuthFlow is not supported on this browser.');
  },
};
