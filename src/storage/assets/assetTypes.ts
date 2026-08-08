/**
 * @file assetTypes.ts
 * @description Defines TypeScript interfaces for the local asset storage.
 */

export interface AssetRecord {
  id: string;
  blob?: Blob;
  mimeType: string;
  byteSize: number;
  hash?: string;
  createdAt: number;
  storageDriver?: 'indexeddb' | 'opfs';
  storagePath?: string;
  pendingDeletionAt?: number;
}
