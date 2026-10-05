import type { WebScrapingData } from './webScrapingTypes';
import type { CollectionPropertyDefinition, CollectionPropertyValues } from './properties/collectionPropertyTypes';
export type { CollectionPropertyDefinition, CollectionPropertyValues } from './properties/collectionPropertyTypes';
export type { WebScrapingData, WebScrapingBlock, WebScrapingInline, WebScrapingImage } from './webScrapingTypes';

/** Organisation-owned collections, independent of Workspace launch records. */
export interface CollectionRecord {
  id: string;
  organisationId: string;
  name: string;
  /** Optional custom columns; array order determines display order. */
  propertyDefinitions: CollectionPropertyDefinition[];
  createdAt: number;
  updatedAt: number;
}

/** Common columns in collectionItems; this is not a separate database table. */
export interface CollectionItemBase {
  id: string;
  organisationId: string;
  collectionId: string;
  title: string;
  note?: string;
  /** Optional associations to the existing tags table; untagged items store an empty array. */
  tagIds: string[];
  /** Independent optional values; capture data remains in the type-specific data object. */
  propertyValues: CollectionPropertyValues;
  url?: string;
  createdAt: number;
  updatedAt: number;
}

export interface LinkData {
  faviconUrl?: string;
}

export interface ArticleData {
  text: string;
  author?: string;
}

export interface TextData {
  text: string;
}

export interface ScreenshotData {
  assetId: string;
  fileName?: string;
}

/** data is stored as a JSON-compatible object, not a stringified JSON value. */
export type CollectionItemRecord = CollectionItemBase & (
  | { type: 'link'; url: string; data: LinkData }
  | { type: 'article'; url: string; data: ArticleData }
  | { type: 'text'; url: string; data: TextData }
  | { type: 'screenshot'; data: ScreenshotData }
  | { type: 'web-scraping'; url: string; data: WebScrapingData }
);

export type CollectionItemType = CollectionItemRecord['type'];
export type CollectionItemData = CollectionItemRecord['data'];

