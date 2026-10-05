import type { CollectionItemRecord } from '../../../../allObjectFolder/src/createObject/collections/collectionTypes';
import { useCollectionAsset } from '../../../../shared-components/collections/useCollectionAsset';

/** Reads the saved image through the existing owned-image client, with URL cleanup. */
export function WebsitePopupCollectionScreenshotPreview({ item, enabled, embedded = false }: {
  item: CollectionItemRecord | null;
  enabled: boolean;
  embedded?: boolean;
}) {
  const screenshot = item?.type === 'screenshot' ? item : null;
  const image = useCollectionAsset(screenshot?.organisationId || null, screenshot?.id || null,
    screenshot?.data.assetId || null, enabled);
  return <div className={`${embedded ? '' : 'website-popup-results '}website-popup-screenshot-preview`} aria-label="Saved Screenshot preview">
    {image.url ? <img src={image.url} alt={screenshot?.title || 'Saved Screenshot'}/>
      : image.status === 'error' ? <div className="website-popup-results__status" role="alert">
        <p>{image.error}</p>
        <button className="website-popup-create-footer__save" type="button" onClick={image.retry}>Retry preview</button>
      </div> : <span className="website-popup-results__status" role="status">{screenshot ? 'Loading preview…' : 'Screenshot preview unavailable.'}</span>}
  </div>;
}
