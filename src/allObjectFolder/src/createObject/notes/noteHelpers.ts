/**
 * @file noteHelpers.ts
 * @description Helper functions for notes, including HTML normalization 
 * and formatting utilities, such as stripping tags.
 * 
 * @usage
 * ```ts
 * import { normalizeNoteBody } from './noteHelpers';
 * const normalizedHtml = normalizeNoteBody(rawHtml);
 * ```
 */

export function normalizeNoteBody(html: string): string {

  if (!html) return '';
  let result = html.trim();
  result = result.replace(/(<p><br><\/p>)+$/, '');
  result = result.replace(/(<br\s*\/?>\s*)+<\/p>$/, '</p>');
  return result;
}

export function extractTextFromHTML(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

export function extractAssetIdsFromHtml(html: string): string[] {
  if (!html) return [];
  const ids = new Set<string>();
  const regex = /data-local-asset-id=["']([^"']+)["']/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    if (match[1]) ids.add(match[1]);
  }
  return Array.from(ids);
}
