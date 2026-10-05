import type { WebScrapingStyle } from './webScrapingStyle';
/** Portable structure with optional allowlisted appearance; no raw HTML, CSS rules or image bytes. */
export type WebScrapingInline = { style?: WebScrapingStyle } & (
  | { type: 'text'; text: string; marks?: ('bold' | 'italic' | 'code')[] }
  | { type: 'link'; url: string; children: WebScrapingInline[] });

export type WebScrapingBlock = { style?: WebScrapingStyle } & (
  | { type: 'paragraph'; children: WebScrapingInline[] }
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; children: WebScrapingInline[] }
  | { type: 'list'; ordered: boolean; items: WebScrapingBlock[][] }
  | { type: 'quote'; blocks: WebScrapingBlock[] }
  | { type: 'code'; text: string }
  | { type: 'table'; rows: WebScrapingBlock[][][] }
  | { type: 'image'; imageId: string }
  | { type: 'unavailable-image' });

export interface WebScrapingImage {
  id: string;
  assetId: string;
}

export interface WebScrapingData {
  version: 1;
  /** Immutable visual-capture identity; legacy semantic-only records omit it. */
  snapshotId?: string;
  style?: WebScrapingStyle;
  blocks: WebScrapingBlock[];
  images: WebScrapingImage[];
}
