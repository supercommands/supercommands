/**
 * Cross-browser scripting adapter providing fallback for MV2 (tabs.executeScript)
 * and MV3 (scripting.executeScript).
 */
export async function executeScriptAdapter(options: {
  target: { tabId: number; allFrames?: boolean; frameIds?: number[] };
  func?: (...args: any[]) => any;
  args?: any[];
  files?: string[];
}): Promise<any[]> {
  if (typeof chrome !== 'undefined' && chrome.scripting && typeof chrome.scripting.executeScript === 'function') {
    return await chrome.scripting.executeScript(options as any);
  }

  // Firefox MV2 / Legacy fallback using chrome.tabs.executeScript or browser.tabs.executeScript
  if (typeof chrome !== 'undefined' && chrome.tabs && typeof (chrome.tabs as any).executeScript === 'function') {
    return new Promise((resolve, reject) => {
      const code = options.func ? `(${options.func.toString()})(...${JSON.stringify(options.args || [])})` : undefined;
      const details: any = {
        allFrames: options.target.allFrames,
        code,
        file: options.files ? options.files[0] : undefined,
      };
      (chrome.tabs as any).executeScript(options.target.tabId, details, (results: any[]) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve((results || []).map(result => ({ result })));
        }
      });
    });
  }

  throw new Error('Script execution is not supported in this browser environment.');
}
