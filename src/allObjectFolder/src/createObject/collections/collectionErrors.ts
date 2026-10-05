import type { CollectionRecord, CollectionItemRecord } from './collectionTypes';

export class CollectionStorageError extends Error {
  constructor(public code: 'INVALID_INPUT' | 'NOT_FOUND' | 'INVALID_OWNERSHIP', message: string) {
    super(message);
    this.name = 'CollectionStorageError';
  }
}

export class CollectionConflictError extends Error {
  readonly code = 'CONFLICT';
  constructor(public remoteRecord: CollectionRecord | CollectionItemRecord) {
    super('This collection or item changed elsewhere. Reload it before saving.');
    this.name = 'CollectionConflictError';
  }
}
