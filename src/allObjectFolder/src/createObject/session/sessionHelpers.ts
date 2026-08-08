/**
 * @file sessionHelpers.ts
 * @description Canonical title resolver and helper functions for Tab Session items.
 */

/**
 * Derives a clean, readable hostname/title fallback from a raw URL.
 * Examples:
 * - "https://chatgpt.com/" -> "chatgpt.com"
 * - "https://meet.google.com/ksm-arfi-hvh" -> "meet.google.com"
 */
export function deriveReadableTitleFromUrl(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const urlStr = rawUrl.trim();
  if (!urlStr) return '';

  try {
    const validUrl = urlStr.includes('://') ? urlStr : `https://${urlStr}`;
    const parsed = new URL(validUrl);
    const host = parsed.hostname.replace(/^www\./i, '').trim();
    if (host) return host;
  } catch {
    const cleaned = urlStr
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .split('?')[0]
      .trim();
    if (cleaned && typeof cleaned === 'string' && cleaned !== '[object Object]') {
      return cleaned;
    }
  }

  return '';
}

/**
 * Resolves the canonical title for a Session tab object.
 * Priority order:
 * 1. tab.title
 * 2. tab.name
 * 3. tab.originalData?.title
 * 4. deriveReadableTitleFromUrl(tab.url)
 * 5. 'Untitled Tab'
 */
export function getSessionTabTitle(tab: any): string {
  if (!tab || typeof tab !== 'object') return 'Untitled Tab';

  const titleSources = [
    typeof tab.title === 'string' ? tab.title : null,
    typeof tab.name === 'string' ? tab.name : null,
    tab.originalData && typeof tab.originalData.title === 'string' ? tab.originalData.title : null,
  ];

  for (const src of titleSources) {
    if (src && src.trim().length > 0 && src.trim() !== '[object Object]') {
      return src.trim();
    }
  }

  const urlDerived = deriveReadableTitleFromUrl(tab.url);
  if (urlDerived && urlDerived.trim().length > 0) {
    return urlDerived.trim();
  }

  return 'Untitled Tab';
}
