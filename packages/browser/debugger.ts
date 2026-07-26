export interface DebuggerAdapter {
  supported: boolean;
  attach(target: chrome.debugger.Debuggee, requiredVersion: string): Promise<void>;
  sendCommand<T = unknown>(target: chrome.debugger.Debuggee, method: string, commandParams?: object): Promise<T>;
  detach(target: chrome.debugger.Debuggee): Promise<void>;
}

export const debuggerAdapter: DebuggerAdapter = {
  get supported() {
    return typeof chrome !== 'undefined' && !!chrome.debugger;
  },

  async attach(target, requiredVersion) {
    if (!this.supported) {
      throw new Error('Debugger-based automation is not supported in this browser environment.');
    }
    return new Promise((resolve, reject) => {
      chrome.debugger.attach(target, requiredVersion, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  },

  async sendCommand<T = unknown>(target: chrome.debugger.Debuggee, method: string, commandParams?: object): Promise<T> {
    if (!this.supported) {
      throw new Error('Debugger-based automation is not supported in this browser environment.');
    }
    return new Promise((resolve, reject) => {
      chrome.debugger.sendCommand(target, method, commandParams, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(result as T);
        }
      });
    });
  },

  async detach(target) {
    if (!this.supported) return;
    return new Promise((resolve, reject) => {
      chrome.debugger.detach(target, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  },
};
