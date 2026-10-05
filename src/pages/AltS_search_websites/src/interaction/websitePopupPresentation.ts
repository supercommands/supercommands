import type { WebsitePopupActivationRequest } from '../../../../shared-components/websitePopup/contracts/websitePopupExecutionTypes';
import type { WebsitePopupRoute, WebsitePopupSubmode } from './websitePopupInteractionTypes';
import { isCollectionCaptureSurface } from '../../../../shared-components/collections/collectionCaptureSource';

/** Frontend presentation only; never part of a draft or background submission. */
export type WebsitePopupPresentation = 'inline' | 'standalone';

export function resolveWebsitePopupEntryPresentation(source: WebsitePopupActivationRequest['source']): WebsitePopupPresentation {
  return source === 'keyboard-space' ? 'inline' : 'standalone';
}

export function isWebsitePopupCollectionSubmode(submode: WebsitePopupSubmode): boolean {
  return submode.id === 'collection-actions' || submode.id === 'collection-destination' || submode.id === 'collection-item-details';
}

/** Children inherit their parent flow, even when selected with Enter inside an inline flow. */
export function getWebsitePopupCollectionPresentation(route: WebsitePopupRoute): WebsitePopupPresentation {
  return route.kind === 'submode' && isWebsitePopupCollectionSubmode(route.submode)
    ? route.presentation || 'inline' : 'inline';
}

/** Enter/click Collection capture has one panel on both supported popup surfaces. */
export function isWebsitePopupUnifiedCollectionPanel(route: WebsitePopupRoute, surface: unknown): boolean {
  return isCollectionCaptureSurface(surface) && route.kind === 'submode'
    && isWebsitePopupCollectionSubmode(route.submode) && getWebsitePopupCollectionPresentation(route) === 'standalone';
}
