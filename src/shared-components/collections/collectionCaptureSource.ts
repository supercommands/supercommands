/** Source identity shared by Collection validation and the website/New Tab surfaces. */
export interface CollectionCaptureSource {
  surface: 'website' | 'newtab';
  url: string;
  title: string;
  /** Website identity is supplied by the trusted message sender in the background. */
  tabId: number | null;
  windowId: number | null;
}

// WXT emits the entrypoints/newtab page at newtab.html. Keep the older packaged path compatible.
const newTabPaths = ['newtab.html', 'AltS_search_newtab/index.html'] as const;

/** One presentation capability shared by command catalogs, providers and runtime. */
export function isCollectionCaptureSurface(surface: unknown): surface is CollectionCaptureSource['surface'] {
  return surface === 'website' || surface === 'newtab';
}

export function isCollectionNewTabUrl(value: string): boolean {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) return false;
    const url = new URL(value);
    if (url.username || url.password) return false;
    return newTabPaths.some(path => {
      const ownPage = new URL(chrome.runtime.getURL(path));
      return url.protocol === ownPage.protocol && url.host === ownPage.host
        && url.pathname === ownPage.pathname;
    });
  } catch { return false; }
}

export function isCollectionSourceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) || isCollectionNewTabUrl(value);
  } catch { return false; }
}

export function collectionSourceLabel(value: string): string {
  if (isCollectionNewTabUrl(value)) return 'New Tab';
  try { return new URL(value).hostname || 'Current page'; }
  catch { return 'Current page'; }
}

/** Inline image bytes and same-source Blob URLs are safe capture inputs, never persistent URLs. */
export function isCollectionPageImageUrl(value: string, sourceUrl: string): boolean {
  try {
    const url = new URL(value);
    if (['http:', 'https:'].includes(url.protocol)) return true;
    if (url.protocol === 'data:') return /^data:image\/(png|jpeg|webp|gif|avif|bmp|x-icon|vnd\.microsoft\.icon|svg\+xml)[;,]/i.test(value);
    const local = url.protocol === 'blob:' ? new URL(value.slice(5)) : url;
    const source = new URL(sourceUrl);
    if (url.protocol !== 'blob:' && !isCollectionNewTabUrl(sourceUrl)) return false;
    return local.protocol === source.protocol && local.host === source.host;
  } catch { return false; }
}

/** Snapshots this document only; never queries or selects another website tab. */
export async function captureCollectionSource(document: Document): Promise<CollectionCaptureSource> {
  const url = document.location.href;
  if (!isCollectionSourceUrl(url)) throw new Error('Capture requires a website or this extension’s New Tab page.');
  const surface = isCollectionNewTabUrl(url) ? 'newtab' : 'website';
  const title = document.title.trim() || (surface === 'newtab' ? 'New Tab' : collectionSourceLabel(url));
  const tab = surface === 'newtab' ? await chrome.tabs.getCurrent() : undefined;
  if (document.location.href !== url) throw new Error('The page changed. Start capture again.');
  if (surface === 'newtab' && (typeof tab?.id !== 'number' || typeof tab.windowId !== 'number')) {
    throw new Error('Could not identify the current New Tab. Start capture again.');
  }
  return { surface, url, title, tabId: tab?.id ?? null, windowId: tab?.windowId ?? null };
}
