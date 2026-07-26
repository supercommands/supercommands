import type { LinkToOpen, AutoSubmitRequest } from './types';
import type { CommandDefinition } from '../commandConfigurations/commands';
import { buildUrl } from '../commandConfigurations/commands';

export const toLinkConfig = (link: LinkToOpen): { url: string; autoSubmit?: AutoSubmitRequest } =>
  typeof link === 'string' ? { url: link } : link;

export const getUrlsFromQuery = (query: string): string[] => {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Split by comma or space
  const tokens = trimmed.split(/[\s,]+/).filter(Boolean);
  const urls: string[] = [];

  const urlPattern = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(\/.*)?$/i;
  const localPattern = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/.*)?$/i;
  const ipPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?(\/.*)?$/;
  // Matches chrome://, edge://, brave://, ftp://, file://, about:, opera://, vivaldi://, etc.
  const protocolPattern = /^(chrome|edge|brave|opera|vivaldi|ftp|file|about|chrome-extension|moz-extension):\/?\/?/i;

  for (const token of tokens) {
    // Match http:// and https:// URLs
    if (/^https?:\/\//i.test(token)) {
      urls.push(token);
      continue;
    }
    // Match other protocol URLs (chrome://, edge://, ftp://, file://, etc.)
    if (protocolPattern.test(token)) {
      urls.push(token);
      continue;
    }
    if (urlPattern.test(token) || localPattern.test(token) || ipPattern.test(token)) {
      urls.push(normalizeUrl(token));
    }
  }

  return urls;
};

export const looksLikeUrl = (query: string): boolean => {
  return getUrlsFromQuery(query).length > 0;
};

// Normalize a URL query to a proper URL (add https:// if needed)
export const normalizeUrl = (query: string): string => {
  const trimmed = query.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

export const normalizeUrlForComparison = (url: string): string => {
  try {
    const parsed = new URL(url);
    // Remove www. prefix from hostname for consistency
    let hostname = parsed.hostname.replace(/^www\./, '');
    let normalized = parsed.protocol + '//' + hostname + parsed.pathname;
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');
    return normalized.toLowerCase();
  } catch {
    // Fallback: strip www. and trailing slashes
    return url
      .toLowerCase()
      .replace(/^(https?:\/\/)?(www\.)?/, '$1')
      .replace(/\/$/, '');
  }
};

export const openSingleLink = (link: LinkToOpen, forceNewTab = false, sourceTabId: number | null = null) => {
  const { url, autoSubmit } = toLinkConfig(link);
  if (!url) return;

  // Check if URL is a note: prefix
  if (url.startsWith('note:')) {
    const noteId = url.substring(5); // Remove 'note:' prefix
    const noteUrl = chrome.runtime.getURL(`AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(noteId)}`);
    if (forceNewTab) {
      chrome.tabs.create({ url: noteUrl, active: false });
    } else {
      window.location.href = noteUrl;
    }
    return;
  }

  const chromeAny = (window as any)?.chrome;

  // For autoSubmit links, use background script to properly handle prompt injection
  if (autoSubmit) {
    if (chromeAny?.runtime?.sendMessage) {
      chromeAny.runtime.sendMessage(
        {
          action: 'open_tab_with_auto_submit',
          url,
          autoSubmit: {
            kind: autoSubmit.kind,
            prompt: autoSubmit.prompt,
            images: autoSubmit.images,
          },
          forceNewTab,
          sourceTabId, // Pass the explicit source tab ID
        },
        (response: any) => {
          if (chromeAny.runtime.lastError) {
            console.warn('[openSingleLink] sendMessage failed:', chromeAny.runtime.lastError);
            // Fallback: try direct tab creation
            if (chromeAny?.tabs?.create) {
              chromeAny.tabs.create({ url, active: true });
            } else {
              window.open(url, '_blank');
            }
          } else if (response && !response.ok) {
            console.error('[openSingleLink] Background script error:', response.error);
            // Fallback: try direct tab creation
            if (chromeAny?.tabs?.create) {
              chromeAny.tabs.create({ url, active: true });
            } else {
              window.open(url, '_blank');
            }
          }
        },
      );
      return;
    }
  }

  // Fallback if autoSubmit but sendMessage not available
  if (autoSubmit) {
    if (chromeAny?.tabs?.create) {
      chromeAny.tabs.create({ url, active: true });
    } else {
      window.open(url, '_blank');
    }
    return;
  }

  if (forceNewTab) {
    if (chromeAny?.tabs?.create) {
      chromeAny.tabs.create({ url, active: true });
    } else {
      window.open(url, '_blank');
    }
    return;
  }

  // Check if URL is a browser internal URL (chrome://, edge://, brave://)
  // These require background script to open, as window.location.href won't work
  const isBrowserInternalUrl =
    url.startsWith('chrome://') || url.startsWith('edge://') || url.startsWith('brave://') || url.startsWith('about:');

  if (isBrowserInternalUrl) {
    // Browser internal URLs must be opened via background script
    if (chromeAny?.runtime?.sendMessage) {
      chromeAny.runtime.sendMessage({ action: 'open_tab', url }, (response: any) => {
        if (chromeAny.runtime.lastError) {
          console.warn('[openSingleLink] sendMessage failed for browser URL:', chromeAny.runtime.lastError);
          // Fallback: try direct tab creation
          if (chromeAny?.tabs?.create) {
            chromeAny.tabs.create({ url });
          }
        } else if (response && !response.ok) {
          console.error('[openSingleLink] Background script error:', response.error, response.debugMessages);
          // Fallback: try direct tab creation
          if (chromeAny?.tabs?.create) {
            chromeAny.tabs.create({ url });
          }
        }
      });
      return;
    }
    // Fallback: try tabs API directly
    if (chromeAny?.tabs?.create) {
      chromeAny.tabs.create({ url });
      return;
    }
    console.warn('[openSingleLink] Cannot open browser internal URL - no APIs available');
    return;
  }

  if (url.startsWith('agent_chat?id=')) {
    const agentId = url.split('id=')[1];
    const extensionUrl = chrome.runtime.getURL(
      `AltS_search_newtab/index.html?lock_command=ai&agent_id=${encodeURIComponent(agentId)}`,
    );
    if (forceNewTab) {
      if (chromeAny?.tabs?.create) {
        chromeAny.tabs.create({ url: extensionUrl, active: true });
      } else {
        window.open(extensionUrl, '_blank');
      }
    } else {
      window.location.href = extensionUrl;
    }
    return;
  }

  // Regular URLs - use current tab as requested
  window.location.href = url;
};

export const openMultipleLinks = async (links: LinkToOpen[], sourceTabId: number | null = null) => {
  if (!links || links.length === 0) return;
  const configs = links.map(toLinkConfig);

  // Helper to open a background tab with Promise for sync
  const openBackgroundTabAsync = (config: LinkToOpen): Promise<void> => {
    return new Promise(resolve => {
      const { url, autoSubmit } = toLinkConfig(config);
      if (!url) {
        resolve();
        return;
      }

      // Handle note: URLs
      if (url.startsWith('note:')) {
        const noteId = url.substring(5);
        const noteUrl = chrome.runtime.getURL(`AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(noteId)}`);
        chrome.tabs.create({ url: noteUrl, active: false }, () => resolve());
        return;
      }

      // Handle agent_chat: URLs
      if (url.startsWith('agent_chat?id=')) {
        const agentId = url.split('id=')[1];
        const extensionUrl = chrome.runtime.getURL(
          `AltS_search_newtab/index.html?lock_command=ai&agent_id=${encodeURIComponent(agentId)}`,
        );
        chrome.tabs.create({ url: extensionUrl, active: false }, () => resolve());
        return;
      }

      const chromeAny = (window as any)?.chrome;

      // Handle autoSubmit via background script
      if (autoSubmit && chromeAny?.runtime?.sendMessage) {
        chromeAny.runtime.sendMessage(
          {
            action: 'open_tab_with_auto_submit',
            url,
            autoSubmit: {
              kind: autoSubmit.kind,
              prompt: autoSubmit.prompt,
              images: autoSubmit.images,
            },
            forceNewTab: true, // This triggers active: false in background script
          },
          () => resolve(),
        );
        return;
      }

      // Handle regular URLs (fallback)
      if (chromeAny?.tabs?.create) {
        chromeAny.tabs.create({ url, active: false }, () => resolve());
      } else {
        window.open(url, '_blank');
        resolve();
      }
    });
  };

  // Open all background tabs FIRST, wait for them to complete, THEN navigate foreground
  const backgroundConfigs = configs.slice(1);

  if (backgroundConfigs.length === 0) {
    // No background tabs, just open the single link
    openSingleLink(configs[0], false, sourceTabId);
    return;
  }

  // Open all background tabs and wait for them
  await Promise.all(backgroundConfigs.map(openBackgroundTabAsync));
  // All background tabs created, now navigate the foreground tab
  openSingleLink(configs[0], false, sourceTabId);
};

export const buildCommandLink = (
  command: CommandDefinition,
  prompt: string,
  images?: { base64: string; mimeType: string; filename: string }[] | null,
): LinkToOpen => {
  const normalizedPrompt = (prompt || '').trim();
  const hasImage = Boolean(images && images.length > 0);
  const hasPrompt = Boolean(normalizedPrompt);

  const urlTemplate = command.urlTemplate;

  // Scenario B: If images are present for an AI command, use a "clean" URL to prevent auto-submission.
  // This gives the extension time to inject images first, then the prompt manually.
  let url: string;
  if (command.autoSubmit && (hasImage || hasPrompt)) {
    if (command.id === 'perplexity') {
      url = 'https://www.perplexity.ai/';
    } else if (command.id === 'gpt') {
      url = 'https://chatgpt.com/';
    } else if (command.id === 'claude') {
      url = 'https://claude.ai/new';
    } else if (command.id === 'gemini') {
      url = 'https://gemini.google.com/app';
    } else {
      // Fallback: Use the template but with an empty prompt to avoid triggering site results
      url = buildUrl(urlTemplate, '');
    }
  } else {
    url = buildUrl(urlTemplate, prompt);
  }

  if (command.autoSubmit) {
    // Logic updated: Allow image-only submission OR prompt+image submission
    if (!hasPrompt && !hasImage) return url;

    return {
      url,
      autoSubmit: {
        id: command.id,
        kind: command.autoSubmit,
        prompt: normalizedPrompt,
        images: hasImage ? images! : undefined,
      },
    };
  }
  return url;
};
