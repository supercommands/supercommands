import type { AssetSource } from '../../../../storage/assets/assetStore';
import type { CollectionItemType, LinkData, ArticleData, TextData, WebScrapingData } from './collectionTypes';
import { validateWebScrapingData } from './webScrapingValidation';
import { CollectionStorageError } from './collectionErrors';
import { isCollectionSourceUrl } from '../../../../shared-components/collections/collectionCaptureSource';

export function invalid(message: string): never { throw new CollectionStorageError('INVALID_INPUT', message); }
export function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) invalid(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
export function fields(value: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) invalid(`Unsupported field: ${key}.`);
}
export function requiredText(value: unknown, label: string, trim = true): string {
  if (typeof value !== 'string' || !value.trim()) invalid(`${label} is required.`);
  return trim ? value.trim() : value;
}
export function optionalText(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') invalid(`${label} must be text.`);
  return value.trim() || undefined;
}
export function websiteUrl(value: unknown, label = 'URL'): string {
  const url = requiredText(value, label);
  try { if (!['http:', 'https:'].includes(new URL(url).protocol)) invalid(`${label} must use HTTP or HTTPS.`); }
  catch { invalid(`${label} must be a valid HTTP or HTTPS URL.`); }
  return url;
}
export function optionalWebsiteUrl(value: unknown): string | undefined {
  return value === undefined ? undefined : websiteUrl(value);
}
/** Item sources may also reference our own New Tab; image URLs remain website-only. */
export function collectionSourceUrl(value: unknown): string {
  const url = requiredText(value, 'URL');
  if (!isCollectionSourceUrl(url)) invalid('URL must use HTTP or HTTPS, or reference this extension’s New Tab page.');
  return url;
}
export function optionalCollectionSourceUrl(value: unknown): string | undefined {
  return value === undefined ? undefined : collectionSourceUrl(value);
}
export function itemType(value: unknown): CollectionItemType {
  if (value !== 'link' && value !== 'article' && value !== 'text' && value !== 'screenshot' && value !== 'web-scraping') invalid('Unsupported collection item type.');
  return value;
}
export function revision(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) invalid('expectedUpdatedAt must be a finite nonnegative number.');
  return value;
}
export function content(type: CollectionItemType, value: unknown): LinkData | ArticleData | TextData | WebScrapingData | (AssetSource & { fileName?: string }) {
  const data = object(value, 'data');
  switch (type) {
    case 'web-scraping': return validateWebScrapingData(data);
    case 'link': {
      fields(data, ['faviconUrl']);
      return data.faviconUrl === undefined ? {} : { faviconUrl: websiteUrl(data.faviconUrl, 'Favicon URL') };
    }
    case 'article': {
      fields(data, ['text', 'author']);
      const author = optionalText(data.author, 'Author');
      return { text: requiredText(data.text, 'Article text', false), ...(author ? { author } : {}) };
    }
    case 'text':
      fields(data, ['text']);
      return { text: requiredText(data.text, 'Text', false) };
    case 'screenshot':
      if ('assetId' in data) {
        fields(data, ['assetId', 'fileName']);
        const fileName = optionalText(data.fileName, 'File name');
        return { assetId: requiredText(data.assetId, 'Asset ID'), ...(fileName ? { fileName } : {}) };
      }
      fields(data, ['blob', 'mimeType', 'fileName']);
      if (!(data.blob instanceof Blob)) invalid('Screenshot requires an asset ID or image Blob.');
      const fileName = optionalText(data.fileName, 'File name');
      return { blob: data.blob, mimeType: requiredText(data.mimeType, 'MIME type'), ...(fileName ? { fileName } : {}) };
  }
}
