/** Shared compact URL token for Create selections and read-only Collection captures. */
import { FiX } from 'react-icons/fi';
import StackedLinkIcon from '../../../../shared-components/icons/stackedLinkIcon';
import { collectionSourceLabel, isCollectionNewTabUrl } from '../../../../shared-components/collections/collectionCaptureSource';

export function WebsitePopupUrlToken({ url, label, onRemove, removeLabel }: {
    url: string;
    label: string;
    onRemove?: () => void;
    removeLabel?: string;
}) {
    const newTab = isCollectionNewTabUrl(url);
    const displayLabel = newTab ? collectionSourceLabel(url) : label;
    return <span className="website-popup-multi-select-argument__token" title={url} aria-label={url}>
      <StackedLinkIcon urls={newTab ? [] : [url]} fallback="link" className="website-popup-multi-select-argument__token-favicon"/>
      <span className="website-popup-multi-select-argument__token-label">{displayLabel}</span>
      {onRemove ? <button type="button" className="website-popup-multi-select-argument__token-remove" aria-label={removeLabel || `Remove URL "${label}"`} onMouseDown={event => event.preventDefault()} onClick={event => {
          event.preventDefault();
          event.stopPropagation();
          onRemove();
      }}><FiX aria-hidden="true"/></button> : null}
    </span>;
}
