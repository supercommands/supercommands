import type { CollectionItemRecord } from '../../../../../allObjectFolder/src/createObject/collections/collectionTypes';
import { WebScrapingContentRenderer } from '../../../../../shared-components/pageExtraction/webScraping/WebScrapingContentRenderer';

type WebScrapingItem = Extract<CollectionItemRecord, { type: 'web-scraping' }>;

/** A noninteractive 16:9 window onto the saved captured content when it has no image asset. */
const CollectionWebScrapingThumbnail = ({ item, compact = false }: { item: WebScrapingItem; compact?: boolean }) => (
  <div className="relative block h-full w-full overflow-hidden" aria-hidden="true">
    <div
      className={`pointer-events-none absolute left-0 top-0 block origin-top-left overflow-hidden ${compact ? 'h-[800%] w-[800%] scale-[0.125]' : 'h-[400%] w-[400%] scale-[0.25]'}`}
      tabIndex={-1}>
      <WebScrapingContentRenderer item={item} preview />
    </div>
  </div>
);

export default CollectionWebScrapingThumbnail;
