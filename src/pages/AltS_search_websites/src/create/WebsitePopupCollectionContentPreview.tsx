import type { CollectionItemRecord } from '../../../../allObjectFolder/src/createObject/collections/collectionTypes';
import type { ExtractedWebScraping } from '../../../../shared-components/pageExtraction/webScraping/webScrapingExtractionTypes';
import { WebScrapingContentRenderer } from '../../../../shared-components/pageExtraction/webScraping/WebScrapingContentRenderer';
import type { CollectionCaptureType } from './useWebsitePopupCollectionItemAutosave';
import type { WebsitePopupCollectionItemFooterState } from './WebsitePopupCollectionItemStatusFooter';
import { WebsitePopupCollectionScreenshotPreview } from './WebsitePopupCollectionScreenshotPreview';
import { isCollectionSourceUrl, isCollectionNewTabUrl, collectionSourceLabel } from '../../../../shared-components/collections/collectionCaptureSource';

/** Read-only projection of the existing composer owner; never creates or saves items. */
export interface WebsitePopupCollectionPreviewState {
  revision: number;
  type: CollectionCaptureType;
  title: string;
  url: string | null;
  record: CollectionItemRecord | null;
  articleText: string;
  webDraft: ExtractedWebScraping | null;
  status: WebsitePopupCollectionItemFooterState['status'];
}

function CollectionPreviewContent({ state, enabled }: { state: WebsitePopupCollectionPreviewState; enabled: boolean }) {
  switch (state.type) {
    case 'link': {
      let url: URL;
      try {
        url = new URL(state.url || '');
        if (!isCollectionSourceUrl(url.href)) return <p>Link preview unavailable.</p>;
      } catch { return <p>Link preview unavailable.</p>; }
      return <a className="website-popup-collection-preview__link" href={url.href} target="_blank" rel="noopener noreferrer" title={url.href}>{isCollectionNewTabUrl(url.href) ? collectionSourceLabel(url.href) : url.href}</a>;
    }
    case 'article': {
      const text = state.record?.type === 'article' ? state.record.data.text : state.articleText;
      if (!text) return <p role="status">{state.status === 'error' ? 'Article preview unavailable. See the save status below.' : 'Extracting article…'}</p>;
      return <article className="website-popup-collection-preview__article" aria-label="Captured Article content">
        {text.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </article>;
    }
    case 'screenshot': return <WebsitePopupCollectionScreenshotPreview item={state.record} enabled={enabled} embedded/>;
    case 'web-scraping':
      if (state.record?.type === 'web-scraping') return <WebScrapingContentRenderer item={state.record}/>;
      if (state.webDraft) return <WebScrapingContentRenderer draft={state.webDraft}/>;
      return <p role="status">Capture content to see its preview.</p>;
  }
}

export function WebsitePopupCollectionContentPreview({ state, enabled, embedded = false, hideTitle = false }: {
  state: WebsitePopupCollectionPreviewState | null;
  enabled: boolean;
  embedded?: boolean;
  hideTitle?: boolean;
}) {
  return <div className={`${embedded ? '' : 'website-popup-results website-popup-custom-scrollbar '}website-popup-collection-preview`} data-embedded={embedded ? 'true' : undefined} aria-label="Web Clip content preview">
    {!state ? <p role="status">Preparing preview…</p>
      : state.type === 'screenshot' ? <CollectionPreviewContent state={state} enabled={enabled}/>
      : <div className="website-popup-collection-preview__content">
        {!hideTitle && <h2 className="website-popup-collection-preview__title">{state.title || 'Untitled'}</h2>}
        <CollectionPreviewContent state={state} enabled={enabled}/>
      </div>}
  </div>;
}
