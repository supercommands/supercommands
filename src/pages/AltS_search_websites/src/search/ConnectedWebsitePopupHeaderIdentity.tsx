/**
 * Store-connected fixed identity for root and nested popup views.
 *
 * Identity content is presentation-only and cannot be edited or removed by the
 * search input. The remaining header width always belongs to the input.
 */
import type React from 'react';
import { FiCamera, FiFilter, FiSend } from 'react-icons/fi';
import { FaFolder } from 'react-icons/fa';
import WebCollectionIcon from '../../../../shared-components/icons/webCollectionIcon';
import { useStore } from 'zustand';
import type { WebsitePopupInteractionStoreApi } from '../interaction/createWebsitePopupInteractionStore';
import type { WebsitePopupRoute } from '../interaction/websitePopupInteractionTypes';
import type { CollectionItemType } from '../../../../allObjectFolder/src/createObject/collections/collectionTypes';
import { WebsitePopupSearchBrand } from './WebsitePopupSearchBrand';
import { getWebsitePopupEntityIcon } from '../catalog/websitePopupEntityIconCatalog';
import { getWebsitePopupEntityLabel, getWebsitePopupClipLabel } from '../../../../shared-components/websitePopup/websitePopupLabels';
export type ConnectedWebsitePopupHeaderIdentityProps = {
    store: WebsitePopupInteractionStoreApi;
    compactCreate?: boolean;
};
type HeaderIdentity = {
    label: string;
    icon: React.ReactNode;
};
const getHeaderIdentity = (route: WebsitePopupRoute, captureType: CollectionItemType | null): HeaderIdentity | null => {
    const captureLabel = captureType ? getWebsitePopupClipLabel(captureType) : 'Web Clips';
    if (route.kind === 'create' || route.kind === 'save' || route.kind === 'filter') {
        return {
            label: route.entity && (route.kind === 'filter' || route.kind === 'create')
                ? getWebsitePopupEntityLabel(route.entity)
                : route.kind[0].toUpperCase() + route.kind.slice(1),
            icon: route.entity ? getWebsitePopupEntityIcon(route.entity) : <FiFilter />,
        };
    }
    if (route.kind !== 'submode')
        return null;
    if (route.submode.id === 'collection-actions') return { label: 'Web Clips', icon: <WebCollectionIcon /> };
    if (route.submode.id === 'collection-destination') return {
        label: captureLabel,
        icon: <FaFolder />,
    };
    if (route.submode.id === 'collection-item-details') return {
        label: captureLabel,
        icon: <FaFolder />,
    };
    if (route.submode.id === 'screenshot-tools') {
        return { label: 'Screenshot Tools', icon: <FiCamera /> };
    }
    if (route.submode.id === 'screenshot-format') {
        return { label: 'Full Page Format', icon: <FiCamera /> };
    }
    return { label: 'Send to Agent', icon: <FiSend /> };
};
export function ConnectedWebsitePopupHeaderIdentity({ store, compactCreate = false, }: ConnectedWebsitePopupHeaderIdentityProps) {
    const route = useStore(store, current => current.state.route);
    const captureType = useStore(store, current => current.state.collectionSession?.captureType ?? null);
    if (route.kind === 'filter' && route.entity === null) {
        return <WebsitePopupSearchBrand />;
    }
    const identity = getHeaderIdentity(route, captureType);
    if (!identity)
        return <WebsitePopupSearchBrand />;
    if (compactCreate && route.kind === 'create') {
        return <>{identity.icon}</>;
    }
    return (<span className="website-popup-submode-identity" data-icon-tone={route.kind === 'submode' && route.submode.id.startsWith('collection-') ? 'collection' : undefined} aria-label={identity.label} title={identity.label}>
      <span className="website-popup-submode-identity__icon" aria-hidden="true">
        {identity.icon}
      </span>
      <span className="website-popup-submode-identity__label">{identity.label}</span>
      <span className="website-popup-submode-identity__divider" aria-hidden="true"/>
    </span>);
}
