import type { AssetSource } from '../../../../storage/assets/assetStore';
import type { CollectionItemBase, LinkData, ArticleData, TextData, WebScrapingData } from './collectionTypes';

export interface CreateCollectionInput { organisationId: string; name: string }
export interface UpdateCollectionInput { name?: string; expectedUpdatedAt?: number }

type ItemInputContent =
  | { type: 'link'; url: string; data: LinkData }
  | { type: 'article'; url: string; data: ArticleData }
  | { type: 'text'; url: string; data: TextData }
  | { type: 'web-scraping'; url: string; data: WebScrapingData }
  | { type: 'screenshot'; url?: string; data: AssetSource & { fileName?: string } };

export type CreateCollectionItemInput = Pick<CollectionItemBase, 'organisationId' | 'collectionId' | 'title' | 'note'>
  & Partial<Pick<CollectionItemBase, 'tagIds'>> & ItemInputContent;
export type UpdateCollectionItemInput = {
  collectionId?: string;
  title?: string;
  url?: string | null;
  note?: string | null;
  /** Omitted preserves associations; [] clears them. */
  tagIds?: string[];
  expectedUpdatedAt?: number;
} & (
  | { type: 'link'; data?: LinkData }
  | { type: 'article'; data?: ArticleData }
  | { type: 'text'; data?: TextData }
  | { type: 'web-scraping'; data?: WebScrapingData }
  | { type: 'screenshot'; data?: AssetSource }
);
