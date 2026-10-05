/** Internal background-to-current-New-Tab DOM requests. */
export const COLLECTION_PAGE_SOURCE_ACTION = 'collection:page-source';
export const COLLECTION_PAGE_IMAGE_ACTION = 'collection:page-image';
export interface CollectionPageSourceResponse { ok: true; url: string; documentToken: string }
export interface CollectionPageImageResponse {
  base64?: string;
  mimeType?: string;
  byteSize: number;
  error?: string;
}
