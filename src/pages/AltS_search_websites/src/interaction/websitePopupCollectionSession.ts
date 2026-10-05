import type { CollectionItemType } from '../../../../allObjectFolder/src/createObject/collections/collectionTypes';
import type { WebsitePopupScreenshotSession } from './websitePopupScreenshotSession';
import type { CollectionCaptureSource } from '../../../../shared-components/collections/collectionCaptureSource';

/** One destination shared by the Collection capture flows. */
export type WebsitePopupCollectionSession = {
    selectedCollectionId: string | null;
    selectedCollectionName: string | null;
    captureType: CollectionItemType | null;
    captureRevision: number;
    sourceUrl: string | null;
    sourceContext: CollectionCaptureSource | null;
    pickerOpen: boolean;
    screenshot: WebsitePopupScreenshotSession;
};
export const createWebsitePopupCollectionSession = (): WebsitePopupCollectionSession => ({
    selectedCollectionId: null,
    selectedCollectionName: null,
    captureType: null,
    captureRevision: 0,
    sourceUrl: null,
    sourceContext: null,
    pickerOpen: false,
    screenshot: { status: 'idle' },
});
