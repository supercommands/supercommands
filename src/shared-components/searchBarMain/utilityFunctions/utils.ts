export const getFaviconUrl = (host: any): string => {
  if (host && typeof host === 'object' && host.url) {
    host = host.url;
  }
  if (!host) return '';
  host = String(host);
  if (!host) return '';

  const lowerHost = host.toLowerCase();

  if (lowerHost.includes('docs.google.com') && lowerHost.includes('/spreadsheets')) {
    return 'https://www.gstatic.com/images/branding/product/1x/sheets_2020q4_48dp.png';
  }
  if (lowerHost.includes('docs.google.com') && lowerHost.includes('/document')) {
    return 'https://www.gstatic.com/images/branding/product/1x/docs_2020q4_48dp.png';
  }
  if (lowerHost.includes('docs.google.com') && lowerHost.includes('/presentation')) {
    return 'https://www.gstatic.com/images/branding/product/1x/slides_2020q4_48dp.png';
  }
  // Remove protocol and www, but preserve subdomains (e.g., calendar.google.com)
  const cleanDomain = host.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];

  // Use Google's faviconV2 API which properly handles subdomains
  const fullUrl = `https://${cleanDomain}`;

  return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(
    fullUrl,
  )}&size=128`;
};

const RECENT_COMMANDS_KEY = 'taskbot_recent_commands';
const MAX_RECENT_COMMANDS = 5;

export const saveRecentCommand = async (commandId: string): Promise<void> => {
  try {
    const result = await chrome.storage.local.get([RECENT_COMMANDS_KEY]);
    const recentJson = result[RECENT_COMMANDS_KEY];
    let recentIds: string[] = Array.isArray(recentJson) ? recentJson : [];

    // Remove if already exists to move to top
    recentIds = recentIds.filter(id => id !== commandId);

    // Add to front
    recentIds.unshift(commandId);

    // Limit size
    if (recentIds.length > MAX_RECENT_COMMANDS) {
      recentIds = recentIds.slice(0, MAX_RECENT_COMMANDS);
    }

    await chrome.storage.local.set({ [RECENT_COMMANDS_KEY]: recentIds });
  } catch (e) {
    console.error('Failed to save recent command:', e);
  }
};

export const removeRecentCommand = async (commandId: string): Promise<void> => {
  try {
    const result = await chrome.storage.local.get([RECENT_COMMANDS_KEY]);
    const recentJson = result[RECENT_COMMANDS_KEY];
    if (!Array.isArray(recentJson)) return;
    const recentIds = recentJson.filter(id => id !== commandId);
    await chrome.storage.local.set({ [RECENT_COMMANDS_KEY]: recentIds });
  } catch (e) {
    console.error('Failed to remove recent command:', e);
  }
};

export const getRecentCommands = async (): Promise<string[]> => {
  try {
    const result = await chrome.storage.local.get([RECENT_COMMANDS_KEY]);
    const recentJson = result[RECENT_COMMANDS_KEY];
    return Array.isArray(recentJson) ? recentJson : [];
  } catch (e) {
    return [];
  }
};

/**
 * Robustly appends cmd_select_status to a URL using URLSearchParams.
 * Handles missing protocols and malformed query strings safely.
 */
export const appendCmdStatus = (url: string, isSelected: boolean): string => {
  if (!url) return url;
  try {
    const hasProtocol = /^[a-z]+:\/\//i.test(url);
    // Standardize URL with protocol for the URL parser
    const urlToParse = hasProtocol ? url : `https://${url}`;
    const urlObj = new URL(urlToParse);

    urlObj.searchParams.set('cmd_select_status', String(isSelected));

    const result = urlObj.toString();
    // Return with original protocol presence
    return hasProtocol ? result : result.replace(/^https?:\/\//i, '');
  } catch (e) {
    // Fallback if URL is too malformed for the parser
    const cleanUrl = url.replace(/[?&]+$/, '');
    const separator = cleanUrl.includes('?') ? '&' : '?';
    return `${cleanUrl}${separator}cmd_select_status=${isSelected}`;
  }
};

/**
 * Removes cmd_select_status from a URL for a clean user-facing preview.
 */
export const stripCmdStatus = (url: string): string => {
  if (!url) return url;
  try {
    const hasProtocol = /^[a-z]+:\/\//i.test(url);
    const urlToParse = hasProtocol ? url : `https://${url}`;
    const urlObj = new URL(urlToParse);

    // Remove all query parameters starting with 'cmd_'
    const keysToRemove: string[] = [];
    urlObj.searchParams.forEach((_, key) => {
      if (key.startsWith('cmd_')) {
        keysToRemove.push(key);
      }
    });
    keysToRemove.forEach(key => urlObj.searchParams.delete(key));

    let result = urlObj.toString();
    if (!hasProtocol) {
      result = result.replace(/^https?:\/\//i, '');
    }

    // Final polish: remove trailing / that URL() adds if it wasn't there
    if (!url.includes('/') && result.endsWith('/')) {
      result = result.slice(0, -1);
    }

    return result;
  } catch (e) {
    // Fallback regex if parser fails: removes ?cmd_... or &cmd_...
    return url.replace(/[?&]cmd_[^&]+/g, '').replace(/[?&]+$/, '');
  }
};
