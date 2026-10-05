import type { CollectionRecord, CollectionItemRecord } from '../../../../../allObjectFolder/src/createObject/collections/collectionTypes';

/** Temporarily hide folder add actions until the user asks to show them again. */
export const COLLECTION_ITEM_ACTIONS_VISIBLE = false;

export type CollectionScreen = { kind: 'overview' } | { kind: 'folder'; collectionId: string } | { kind: 'item'; collectionId: string; itemId: string };

export type CollectionDialogState =
    | { kind: 'create' }
    | { kind: 'rename'; collection: CollectionRecord }
    | { kind: 'delete'; collection: CollectionRecord; itemCount: number };

export type CollectionItemDialogState =
    | { kind: 'create' }
    | { kind: 'edit'; item: CollectionItemRecord }
    | { kind: 'delete'; item: CollectionItemRecord };
