import { generateEntityId } from '../../shared-components/utils';

export const HTML_WIDGET_CONTENT_STORAGE_KEY = 'html-widget-content-v1';

export interface HtmlWidgetContentRecord {
  contentId: string;
  title: string;
  html: string;
  css: string;
  js: string;
  originalSource: string;
  warnings: string[];
  createdAt: number;
  updatedAt: number;
}

export type HtmlWidgetContentInput = Omit<HtmlWidgetContentRecord, 'contentId' | 'createdAt' | 'updatedAt'> & {
  contentId?: string;
};

type ChromeStorageLike = {
  storage?: {
    local?: {
      get: (key: string) => Promise<Record<string, unknown>>;
      set: (items: Record<string, unknown>) => Promise<void>;
    };
  };
};

const getExtensionChrome = (): ChromeStorageLike | undefined =>
  typeof globalThis === 'undefined'
    ? undefined
    : (globalThis as typeof globalThis & { chrome?: ChromeStorageLike }).chrome;

const isChromeStorageAvailable = () => Boolean(getExtensionChrome()?.storage?.local);

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const sanitizeContentRecord = (value: unknown): HtmlWidgetContentRecord | null => {
  if (!isPlainRecord(value)) return null;
  const contentId = typeof value.contentId === 'string' ? value.contentId : '';
  if (!contentId) return null;

  const now = Date.now();
  const warnings = Array.isArray(value.warnings)
    ? value.warnings.filter((warning): warning is string => typeof warning === 'string')
    : [];

  return {
    contentId,
    title: typeof value.title === 'string' && value.title.trim() ? value.title.trim() : 'HTML Widget',
    html: typeof value.html === 'string' ? value.html : '',
    css: typeof value.css === 'string' ? value.css : '',
    js: typeof value.js === 'string' ? value.js : '',
    originalSource: typeof value.originalSource === 'string' ? value.originalSource : '',
    warnings,
    createdAt: Number(value.createdAt) || now,
    updatedAt: Number(value.updatedAt) || now,
  };
};

export const loadHtmlWidgetContentStoreAsync = async (): Promise<Record<string, HtmlWidgetContentRecord>> => {
  if (!isChromeStorageAvailable()) return {};
  const chromeInstance = getExtensionChrome();
  if (!chromeInstance?.storage?.local) return {};
  const data = await chromeInstance.storage.local.get(HTML_WIDGET_CONTENT_STORAGE_KEY);
  const rawStore = data?.[HTML_WIDGET_CONTENT_STORAGE_KEY];
  if (!isPlainRecord(rawStore)) return {};

  return Object.entries(rawStore).reduce<Record<string, HtmlWidgetContentRecord>>((store, [contentId, value]) => {
    const record = sanitizeContentRecord(value);
    if (record) store[contentId] = record;
    return store;
  }, {});
};

export const loadHtmlWidgetContentAsync = async (
  contentId: string | undefined,
): Promise<HtmlWidgetContentRecord | null> => {
  if (!contentId) return null;
  const store = await loadHtmlWidgetContentStoreAsync();
  return store[contentId] || null;
};

export const saveHtmlWidgetContentAsync = async (input: HtmlWidgetContentInput): Promise<HtmlWidgetContentRecord> => {
  const now = Date.now();
  const contentId = input.contentId || generateEntityId('htmlWidgetContent');
  const store = await loadHtmlWidgetContentStoreAsync();
  const previous = store[contentId];
  const record: HtmlWidgetContentRecord = {
    contentId,
    title: input.title.trim() || 'HTML Widget',
    html: input.html,
    css: input.css,
    js: input.js,
    originalSource: input.originalSource,
    warnings: input.warnings,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  };

  const chromeInstance = getExtensionChrome();
  if (chromeInstance?.storage?.local) {
    await chromeInstance.storage.local.set({
      [HTML_WIDGET_CONTENT_STORAGE_KEY]: {
        ...store,
        [contentId]: record,
      },
    });
  }

  return record;
};

export const deleteHtmlWidgetContentAsync = async (contentId: string): Promise<void> => {
  if (!contentId || !isChromeStorageAvailable()) return;
  const store = await loadHtmlWidgetContentStoreAsync();
  if (!store[contentId]) return;
  const nextStore = { ...store };
  delete nextStore[contentId];
  const chromeInstance = getExtensionChrome();
  if (chromeInstance?.storage?.local) {
    await chromeInstance.storage.local.set({ [HTML_WIDGET_CONTENT_STORAGE_KEY]: nextStore });
  }
};

export const deleteHtmlWidgetContentIfUnreferencedAsync = async (
  contentId: string | undefined,
  widgets: readonly { settings?: Record<string, unknown> }[],
): Promise<void> => {
  if (!contentId) return;
  const isReferenced = widgets.some(widget => widget.settings?.contentId === contentId);
  if (!isReferenced) await deleteHtmlWidgetContentAsync(contentId);
};
