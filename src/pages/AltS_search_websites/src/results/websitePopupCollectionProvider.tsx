import { buildWebsitePopupCollectionChoiceRows } from '../catalog/websitePopupCollectionCatalog';
import { isCollectionCaptureSurface } from '../../../../shared-components/collections/collectionCaptureSource';
import { FaFolder } from 'react-icons/fa';
import type { WebsitePopupResolvedRow, WebsitePopupSectionProvider } from './websitePopupResultsTypes';

export const websitePopupCollectionProvider: WebsitePopupSectionProvider = {
  id: 'collection-actions', order: 10,
  supports: request => request.source === 'submode' && request.entity === 'collection-actions',
  provide: (request, context) => {
    if (!isCollectionCaptureSurface(context.surface)) return null;
    const rows = buildWebsitePopupCollectionChoiceRows(request.query);
    const selected = context.searchSnapshot.newCollections.find(collection => collection.id === context.selectedCollectionId);
    return rows.length ? { id: 'collection-actions', label: selected ? `Web Clip · ${selected.name}` : 'Web Clips', rows } : null;
  },
};

/** Existing and typed-to-create Collections share the normal popup result list. */
export const websitePopupCollectionDestinationProvider: WebsitePopupSectionProvider = {
  id: 'collection-destination', order: 10,
  supports: request => request.source === 'submode' && request.entity === 'collection-destination',
  provide: (request, context) => {
    if (!isCollectionCaptureSurface(context.surface)) return null;
    const session = context.collectionSession;
    if (!session) return null;
    const selected = context.searchSnapshot.newCollections.find(collection => collection.id === session.selectedCollectionId);
    if (!session.pickerOpen) {
      const name = selected?.name || session.selectedCollectionName;
      return name ? { id: 'collection-destination-selected', label: 'Selected Web Clip', rows: [{
        id: `selected-collection:${session.selectedCollectionId}`,
        title: name, trailing: 'Selected', icon: <FaFolder />, iconTone: 'collection' as const, disabled: true,
        intent: { kind: 'collection-destination-select' as const, collectionId: session.selectedCollectionId!, collectionName: name },
      }] } : null;
    }
    const query = request.query.trim().toLowerCase();
    const collections = context.searchSnapshot.newCollections;
    const rows: WebsitePopupResolvedRow[] = collections
      .filter(collection => !query || collection.name.toLowerCase().includes(query))
      .map(collection => ({
        id: `collection-destination:${collection.id}`,
        title: collection.name,
        trailing: collection.id === session.selectedCollectionId ? 'Selected' : undefined,
        icon: <FaFolder />, iconTone: 'collection' as const,
        intent: { kind: 'collection-destination-select' as const, collectionId: collection.id, collectionName: collection.name },
      }));
    const createName = request.query.trim();
    const canCreate = Boolean(createName && context.searchSnapshot.defaultOrganisationId)
      && !collections.some(collection => collection.name.trim().toLowerCase() === createName.toLowerCase());
    return [
      ...(rows.length ? [{ id: 'collection-destination-existing', label: 'Web Clips', rows }] : []),
      ...(canCreate ? [{ id: 'collection-destination-create', label: 'Create', rows: [{
        id: `create-collection:${createName.toLowerCase()}`,
        title: `Create Web Clip "${createName}"`, icon: <FaFolder />, iconTone: 'collection' as const,
        intent: { kind: 'collection-destination-create' as const, name: createName },
      }] }] : []),
    ];
  },
};
