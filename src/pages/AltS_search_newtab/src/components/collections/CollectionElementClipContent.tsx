import type { CollectionItemRecord } from '../../../../../allObjectFolder/src/createObject/collections/collectionTypes';
import { ElementSnapshotView } from '../../../../../shared-components/pageExtraction/webScraping/ElementSnapshotView';
import { WebScrapingContentRenderer } from '../../../../../shared-components/pageExtraction/webScraping/WebScrapingContentRenderer';

/** New clips have one visual presentation; only historical clips use semantic display. */
export function CollectionElementClipContent({ item }: { item: Extract<CollectionItemRecord, { type: 'web-scraping' }> }) {
  return item.data.snapshotId ? <ElementSnapshotView item={item}/> : <WebScrapingContentRenderer item={item}/>;
}
