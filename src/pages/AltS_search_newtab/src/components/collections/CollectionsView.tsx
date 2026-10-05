import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { reflectNewTabTheme } from '../../../../../../packages/ui/lib/theme/registry';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { useWidgetDashboardStore } from '../../../../../storage/store/useWidgetDashboardStore';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { recordTimelineOpen } from '../timeline/timelineActivity';
import CollectionDeleteDialog from './CollectionDeleteDialog';
import CollectionEditor from './CollectionEditor';
import CollectionPropertyEditor from './CollectionPropertyEditor';
import { useCollectionProperties } from './hooks/useCollectionProperties';
import CollectionFoldersPanel from './CollectionFoldersPanel';
import CollectionFolderGrid from './CollectionFolderGrid';
import CollectionFolderList from './CollectionFolderList';
import CollectionHeader from './CollectionHeader';
import type { CollectionViewMode } from './CollectionViewSelector';
import { useCollections } from './hooks/useCollections';
import CollectionItemDeleteDialog from './CollectionItemDeleteDialog';
import CollectionItemEditor, { type ItemDraft } from './CollectionItemEditor';
import CollectionItemList from './CollectionItemList';
import CollectionItemTable from './CollectionItemTable';
import CollectionItemView from './CollectionItemView';
import CollectionImageUploads from './CollectionImageUploads';
import { COLLECTION_IMAGE_ACCEPT } from './collectionFileTransfer';
import { useCollectionItems } from './hooks/useCollectionItems';
import { useCollectionImageUpload } from './hooks/useCollectionImageUpload';
import { COLLECTION_ITEM_ACTIONS_VISIBLE, type CollectionDialogState, type CollectionItemDialogState, type CollectionScreen } from './collectionViewTypes';
import type { CollectionItemRecord, CollectionRecord, CollectionPropertyDefinition } from '../../../../../allObjectFolder/src/createObject/collections/collectionTypes';
import { webScrapingTextPreview } from '../../../../../shared-components/pageExtraction/webScraping/webScrapingTextPreview';

const matchesItemSearch = (item: CollectionItemRecord, query: string) => {
    const content = item.type === 'article' || item.type === 'text' ? item.data.text
        : item.type === 'web-scraping' ? webScrapingTextPreview(item.data.blocks)
            : item.type === 'screenshot' ? item.data.fileName : '';
    return [item.title, item.note, item.url, item.type.replace('-', ' '), content]
        .some(value => value?.toLocaleLowerCase().includes(query));
};

const CollectionsView = () => {
    const returnToHome = useUIStore(state => state.returnToHome);
    const route = useUIStore(state => state.activeView);
    const activeOrganisationId = useUIStore(state => state.selectedOrganisationId);
    const dashboardOrganisationId = useWidgetDashboardStore(state => state.organisationId);
    const organisations = useDbStore(state => state.organisations);
    const isDbInitialized = useDbStore(state => state.isInitialized);
    const [organisationOverride, setOrganisationOverride] = useState<string | null>(null);
    const [screen, setScreen] = useState<CollectionScreen>(() => route.type === 'collections' && route.collectionId
        ? route.itemId ? { kind: 'item', collectionId: route.collectionId, itemId: route.itemId } : { kind: 'folder', collectionId: route.collectionId }
        : { kind: 'overview' });
    const lastTrackedScreen = useRef('');
    const [viewMode, setViewMode] = useState<CollectionViewMode>(() => {
        try { return window.localStorage.getItem('new-tab-collections-view-mode') === 'list' ? 'list' : 'grid'; }
        catch { return 'grid'; }
    });
    const [overviewViewMode, setOverviewViewMode] = useState<CollectionViewMode>(() => {
        try { return window.localStorage.getItem('new-tab-collections-overview-view-mode') === 'list' ? 'list' : 'grid'; }
        catch { return 'grid'; }
    });
    const [dialog, setDialog] = useState<CollectionDialogState | null>(null);
    const [itemDialog, setItemDialog] = useState<CollectionItemDialogState | null>(null);
    const [propertyDialog, setPropertyDialog] = useState<{ kind: 'add' } | { kind: 'rename'; definition: CollectionPropertyDefinition } | null>(null);
    const [focusPropertyId, setFocusPropertyId] = useState<string | null>(null);
    const [checkingDeleteId, setCheckingDeleteId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [collectionSearchQuery, setCollectionSearchQuery] = useState('');
    const [draggingImages, setDraggingImages] = useState(false);
    const imageInput = useRef<HTMLInputElement>(null);
    const quickDeleteInFlight = useRef(false);
    const routeOrganisationId = route.type === 'collections' ? route.organisationId : undefined;
    const routeCollectionId = route.type === 'collections' ? route.collectionId : undefined;
    const routeItemId = route.type === 'collections' ? route.itemId : undefined;
    const preferredOrganisationId = [routeOrganisationId, activeOrganisationId, dashboardOrganisationId].find(id => id && organisations.some(organisation => organisation.id === id)) ?? null;
    const organisationId = organisationOverride && organisations.some(organisation => organisation.id === organisationOverride)
        ? organisationOverride
        : preferredOrganisationId ?? (organisations.length === 1 ? organisations[0].id : null);
    const currentOrganisationId = useRef(organisationId);
    currentOrganisationId.current = organisationId;
    const { collections, status, error, pendingAction, refresh, create, rename, remove, getItemCount } = useCollections(organisationId);
    const selectedCollection = screen.kind === 'overview' ? null : collections.find(collection => collection.id === screen.collectionId) ?? null;
    const properties = useCollectionProperties(selectedCollection);
    const folderId = screen.kind === 'overview' ? null : screen.collectionId;
    const propertyScope = useRef('');
    propertyScope.current = `${organisationId}:${folderId}:${screen.kind}`;
    const { items, status: itemStatus, error: itemError, pendingAction: pendingItemAction, refresh: refreshItems, create: createItem, update: updateItem, remove: removeItem } = useCollectionItems(organisationId, folderId);
    const afterImageUpload = useCallback(async () => { await refreshItems(); }, [refreshItems]);
    const imageUploads = useCollectionImageUpload(organisationId, folderId, afterImageUpload);
    const selectedItem = screen.kind === 'item' ? items.find(item => item.id === screen.itemId) ?? null : null;
    const normalizedSearch = collectionSearchQuery.trim().toLocaleLowerCase();
    const visibleItems = normalizedSearch ? items.filter(item => matchesItemSearch(item, normalizedSearch)) : items;
    const visibleCollections = normalizedSearch
        ? collections.filter(collection => collection.name.toLocaleLowerCase().includes(normalizedSearch)
            || (collection.id === folderId && visibleItems.length > 0)) : collections;

    useEffect(() => { setPropertyDialog(null); setFocusPropertyId(null); }, [organisationId, folderId, screen.kind]);
    useEffect(() => { setCollectionSearchQuery(''); }, [organisationId]);

    useEffect(() => {
        setScreen(routeCollectionId
            ? routeItemId ? { kind: 'item', collectionId: routeCollectionId, itemId: routeItemId } : { kind: 'folder', collectionId: routeCollectionId }
            : { kind: 'overview' });
        setDialog(null);
        setItemDialog(null);
        setActionError(null);
        setDraggingImages(false);
    }, [organisationId, routeCollectionId, routeItemId]);

    useEffect(() => {
        const key = screen.kind === 'overview' ? '' : screen.kind === 'folder' ? `collection:${screen.collectionId}` : `collectionItem:${screen.itemId}`;
        if (!key) { lastTrackedScreen.current = ''; return; }
        if (key === lastTrackedScreen.current) return;
        if (screen.kind === 'folder' && selectedCollection) {
            recordTimelineOpen('collection', selectedCollection.id);
            lastTrackedScreen.current = key;
        } else if (screen.kind === 'item' && selectedItem) {
            recordTimelineOpen('collectionItem', selectedItem.id);
            lastTrackedScreen.current = key;
        }
    }, [screen, selectedCollection, selectedItem]);

    useEffect(() => { setDraggingImages(false); }, [folderId]);

    useEffect(() => {
        try { window.localStorage.setItem('new-tab-collections-view-mode', viewMode); }
        catch { /* Keep the in-memory selection if storage is unavailable. */ }
    }, [viewMode]);

    useEffect(() => {
        try { window.localStorage.setItem('new-tab-collections-overview-view-mode', overviewViewMode); }
        catch { /* Keep the in-memory selection if storage is unavailable. */ }
    }, [overviewViewMode]);

    useEffect(() => {
        if (screen.kind !== 'overview' && status === 'ready' && !selectedCollection) setScreen({ kind: 'overview' });
    }, [screen, selectedCollection, status]);

    useEffect(() => {
        if (screen.kind === 'item' && itemStatus === 'ready' && !selectedItem) setScreen({ kind: 'folder', collectionId: screen.collectionId });
    }, [screen, itemStatus, selectedItem]);

    const back = () => {
        if (screen.kind === 'item') setScreen({ kind: 'overview' });
        else if (screen.kind === 'folder') setScreen({ kind: 'overview' });
        else if (route.type === 'collections' && route.returnToTimeline) useUIStore.getState().setView({ type: 'timeline' });
        else returnToHome();
    };

    const openCollection = (collection: CollectionRecord) => {
        if (screen.kind === 'folder' && screen.collectionId === collection.id) return;
        setItemDialog(null);
        setScreen({ kind: 'folder', collectionId: collection.id });
    };

    const prepareDelete = async (collection: CollectionRecord) => {
        setCheckingDeleteId(collection.id);
        setActionError(null);
        try {
            const itemCount = await getItemCount(collection.id);
            if (currentOrganisationId.current === collection.organisationId) setDialog({ kind: 'delete', collection, itemCount });
        }
        catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Could not check webclip items.'); }
        finally { setCheckingDeleteId(null); }
    };

    const saveCollection = async (name: string) => {
        if (!dialog) return;
        if (dialog.kind === 'create') await create(name);
        else if (dialog.kind === 'rename') await rename(dialog.collection, name);
        setDialog(null);
    };

    const confirmDelete = async () => {
        if (!dialog || dialog.kind !== 'delete') return;
        const latestCount = await getItemCount(dialog.collection.id);
        if (latestCount !== dialog.itemCount) {
            setDialog({ ...dialog, itemCount: latestCount });
            throw new Error('The item count changed. Review it and confirm again.');
        }
        await remove(dialog.collection);
        if (screen.kind !== 'overview' && screen.collectionId === dialog.collection.id) setScreen({ kind: 'overview' });
        setDialog(null);
    };

    const saveItem = async (draft: ItemDraft) => {
        if (!organisationId || !folderId || !itemDialog) return;
        if (itemDialog.kind === 'create') {
            if (draft.type === 'screenshot') throw new Error('Use Upload images to add an image.');
            if (draft.type === 'text') throw new Error('Text creation is not available in Webclips.');
            if (draft.type === 'web-scraping') throw new Error('Web Scraping capture is not available yet.');
            const common = { organisationId, collectionId: folderId, title: draft.title, url: draft.url, note: draft.note };
            const record = draft.type === 'link' ? await createItem({ ...common, type: 'link', data: {} })
                : await createItem({ ...common, type: 'article', data: { text: draft.text, ...(draft.author ? { author: draft.author } : {}) } });
            setItemDialog(null);
            setScreen({ kind: 'item', collectionId: folderId, itemId: record.id });
        } else if (itemDialog.kind === 'edit') {
            const item = itemDialog.item;
            const common = { collectionId: item.collectionId, title: draft.title, url: draft.url, note: draft.note };
            if (item.type === 'link') await updateItem(item, { ...common, type: 'link', data: item.data });
            else if (item.type === 'article') await updateItem(item, { ...common, type: 'article', data: { text: draft.text, ...(draft.author ? { author: draft.author } : {}) } });
            else if (item.type === 'text') await updateItem(item, { ...common, type: 'text', data: { text: draft.text } });
            else if (item.type === 'web-scraping') await updateItem(item, { ...common, type: 'web-scraping' });
            else await updateItem(item, { ...common, url: draft.url || null, type: 'screenshot' });
            setItemDialog(null);
        }
    };

    const saveProperty = async (label: string) => {
        if (!propertyDialog) return;
        const scope = propertyScope.current;
        const currentIds = new Set(properties.definitions.map(definition => definition.id));
        const record = propertyDialog.kind === 'add' ? await properties.add(label)
            : await properties.rename(propertyDialog.definition.id, label);
        if (!record || propertyScope.current !== scope) return;
        setPropertyDialog(null);
        if (propertyDialog.kind === 'add') setFocusPropertyId(record.propertyDefinitions.find(definition => !currentIds.has(definition.id))?.id ?? null);
    };

    const confirmItemDelete = async () => {
        if (itemDialog?.kind !== 'delete') return;
        await removeItem(itemDialog.item);
        setItemDialog(null);
        if (screen.kind === 'item') setScreen({ kind: 'folder', collectionId: screen.collectionId });
    };

    const quickDeleteItem = async (item: CollectionItemRecord) => {
        if (quickDeleteInFlight.current) return;
        quickDeleteInFlight.current = true;
        setActionError(null);
        try { await removeItem(item); }
        catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Could not delete item.'); }
        finally { quickDeleteInFlight.current = false; }
    };

    return <main className="flex h-full min-h-0 w-full flex-col text-[var(--color-textPrimary)]" style={{ backgroundColor: reflectNewTabTheme.tokens.rootBg }}>
      <CollectionHeader collection={selectedCollection} isItemOpen={screen.kind === 'item'} organisations={organisations} organisationId={organisationId} onOrganisationChange={setOrganisationOverride} onBack={back} backToTimeline={route.type === 'collections' && route.returnToTimeline} onCreate={() => setDialog({ kind: 'create' })} onAddItem={() => setItemDialog({ kind: 'create' })} onUploadImages={() => imageInput.current?.click()} onRename={() => { if (selectedCollection) setDialog({ kind: 'rename', collection: selectedCollection }); }} onDelete={() => { if (selectedCollection) void prepareDelete(selectedCollection); }} viewMode={screen.kind === 'overview' ? overviewViewMode : viewMode} onViewModeChange={screen.kind === 'overview' ? setOverviewViewMode : setViewMode}/>
      <input ref={imageInput} type="file" accept={COLLECTION_IMAGE_ACCEPT} multiple className="hidden" onChange={event => { imageUploads.enqueue(Array.from(event.target.files ?? [])); event.target.value = ''; }}/>
      <div className="flex min-h-0 flex-1">
      <CollectionFoldersPanel collections={visibleCollections} activeCollectionId={folderId} searchQuery={collectionSearchQuery} onSearchChange={setCollectionSearchQuery} onOpen={openCollection}/>
      <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-6 custom-scrollbar" onDragOver={event => { if (screen.kind === 'folder' && Array.from(event.dataTransfer.types).includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setDraggingImages(true); } }} onDragLeave={event => { if (!event.relatedTarget || !(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDraggingImages(false); }} onDrop={event => { if (screen.kind === 'folder') { event.preventDefault(); imageUploads.enqueue(Array.from(event.dataTransfer.files)); } setDraggingImages(false); }}>
        {draggingImages && screen.kind === 'folder' && <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-[var(--color-borderActive)] bg-[var(--color-cardBg)] text-sm text-[var(--color-textPrimary)]">Drop images into this webclip</div>}
        {!isDbInitialized ? <p className="text-sm text-[var(--color-textSecondary)]">Loading Organisations…</p>
            : organisations.length === 0 ? <p className="text-sm text-[var(--color-textSecondary)]">Create an Organisation to start using Webclips.</p>
                : !organisationId ? <p className="text-sm text-[var(--color-textSecondary)]">Choose an Organisation to view its webclips.</p>
                    : status === 'loading' ? <p role="status" className="text-sm text-[var(--color-textSecondary)]">Loading webclips…</p>
                        : <>
                          {(error || actionError) && <div role="alert" className="mb-4 flex items-center gap-3 text-sm text-[var(--color-danger)]"><span>{actionError || error}</span><button type="button" onClick={() => { setActionError(null); void refresh(true); }} className="rounded-lg border border-[var(--color-borderDefault)] px-2 py-1 text-xs text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)]">Retry</button></div>}
                          {screen.kind === 'overview'
                            ? visibleCollections.length ? overviewViewMode === 'list'
                                ? <CollectionFolderList organisationId={organisationId} collections={visibleCollections} onOpen={openCollection} onRename={collection => setDialog({ kind: 'rename', collection })} onDelete={collection => { void prepareDelete(collection); }}/>
                                : <CollectionFolderGrid organisationId={organisationId} collections={visibleCollections} onOpen={openCollection} onRename={collection => setDialog({ kind: 'rename', collection })} onDelete={collection => { void prepareDelete(collection); }}/>
                                : normalizedSearch ? <div role="status" className="flex min-h-40 items-center justify-center text-center text-sm text-[var(--color-textSecondary)]">No webclips match your search.</div>
                                : status === 'ready' ? <div className="flex min-h-40 items-center justify-center text-center text-sm text-[var(--color-textSecondary)]">No webclips yet. Create one to get started.</div> : null
                            : selectedCollection ? <>
                              {itemError && <div role="alert" className="mb-4 flex items-center gap-3 text-sm text-[var(--color-danger)]"><span>{itemError}</span><button type="button" onClick={() => { void refreshItems(true); }} className="rounded-lg border border-[var(--color-borderDefault)] px-2 py-1 text-xs text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)]">Retry</button></div>}
                              {screen.kind === 'folder' && <CollectionImageUploads entries={imageUploads.entries} onCancel={imageUploads.cancel} onRetry={imageUploads.retry} onDismiss={imageUploads.dismiss}/>}
                              {screen.kind === 'folder' && viewMode === 'list' && <div className="mb-4 flex justify-end">
                                <button type="button" disabled={properties.pending} onClick={() => setPropertyDialog({ kind: 'add' })}
                                  className="flex items-center gap-2 rounded-lg border border-[var(--color-borderDefault)] px-3 py-2 text-xs text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] disabled:opacity-50"><Plus size={16} aria-hidden="true"/>Add new column</button>
                              </div>}
                              {itemStatus === 'loading' ? <p role="status" className="text-sm text-[var(--color-textSecondary)]">Loading items…</p>
                                : screen.kind === 'item' ? selectedItem && <CollectionItemView key={`${organisationId}:${selectedItem.collectionId}:${selectedItem.id}`}
                                    organisationId={organisationId} item={selectedItem} definitions={properties.definitions} metadataEditing={itemDialog !== null}
                                    propertyDefinitionPending={properties.pending} onAddProperty={() => setPropertyDialog({ kind: 'add' })}
                                    onBack={() => setScreen({ kind: 'folder', collectionId: screen.collectionId })}
                                    onEdit={item => setItemDialog({ kind: 'edit', item })} onDelete={item => setItemDialog({ kind: 'delete', item })}/>
                                    : viewMode === 'list' ? <>
                                        <CollectionItemTable organisationId={organisationId} items={visibleItems} definitions={properties.definitions}
                                          propertyPending={properties.pending} focusPropertyId={focusPropertyId}
                                          onAddProperty={() => setPropertyDialog({ kind: 'add' })}
                                          onRenameProperty={definition => setPropertyDialog({ kind: 'rename', definition })}
                                          onOpen={item => setScreen({ kind: 'item', collectionId: screen.collectionId, itemId: item.id })}
                                          onDelete={item => { void quickDeleteItem(item); }} deletingItemId={pendingItemAction}/>
                                        {!visibleItems.length && <p role="status" className="py-6 text-center text-sm text-[var(--color-textSecondary)]">{normalizedSearch ? 'No items match your search.' : 'No items yet.'}</p>}
                                      </> : visibleItems.length ? <CollectionItemList organisationId={organisationId} items={visibleItems} onOpen={item => setScreen({ kind: 'item', collectionId: screen.collectionId, itemId: item.id })} onDelete={item => { void quickDeleteItem(item); }} deletingItemId={pendingItemAction}/>
                                        : normalizedSearch ? <div role="status" className="flex min-h-40 items-center justify-center text-center text-sm text-[var(--color-textSecondary)]">No items match your search.</div>
                                        : itemStatus === 'ready' ? <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center text-sm text-[var(--color-textSecondary)]"><span>No items yet.</span>{COLLECTION_ITEM_ACTIONS_VISIBLE && <><div className="flex flex-wrap justify-center gap-2"><button type="button" onClick={() => imageInput.current?.click()} className="rounded-lg border border-[var(--color-borderDefault)] px-3 py-2 text-xs text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">Upload images</button><button type="button" onClick={() => setItemDialog({ kind: 'create' })} className="rounded-lg border border-[var(--color-borderDefault)] px-3 py-2 text-xs text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">Add item</button></div><span className="text-xs text-[var(--color-textMuted)]">You can also drop images here.</span></>}</div> : null}
                            </> : null}
                        </>}
      </div>
      </div>
      {checkingDeleteId && <div role="status" className="sr-only">Checking items before deletion…</div>}
      {pendingAction && <div role="status" className="sr-only">Saving webclip…</div>}
      {pendingItemAction && <div role="status" className="sr-only">Saving item…</div>}
      {propertyDialog && selectedCollection && <CollectionPropertyEditor key={`${selectedCollection.id}:${propertyDialog.kind === 'rename' ? propertyDialog.definition.id : 'add'}`}
        definition={propertyDialog.kind === 'rename' ? propertyDialog.definition : undefined}
        pending={properties.pending} unknownOutcome={properties.unknownOutcome}
        onClose={() => setPropertyDialog(null)} onSave={saveProperty} onReload={properties.reload}/>}
      {dialog?.kind === 'create' && <CollectionEditor key="create" onClose={() => setDialog(null)} onSave={saveCollection}/>}
      {dialog?.kind === 'rename' && <CollectionEditor key={dialog.collection.id} collection={dialog.collection} onClose={() => setDialog(null)} onSave={saveCollection}/>}
      {dialog?.kind === 'delete' && <CollectionDeleteDialog key={dialog.collection.id} collection={dialog.collection} itemCount={dialog.itemCount} onClose={() => setDialog(null)} onConfirm={confirmDelete}/>}
      {itemDialog?.kind === 'create' && folderId && <CollectionItemEditor key={`create-${folderId}`} onClose={() => setItemDialog(null)} onSave={saveItem}/>}
      {itemDialog?.kind === 'edit' && folderId && <CollectionItemEditor key={itemDialog.item.id} item={itemDialog.item} onClose={() => setItemDialog(null)} onSave={saveItem}/>}
      {itemDialog?.kind === 'delete' && <CollectionItemDeleteDialog key={itemDialog.item.id} item={itemDialog.item} onClose={() => setItemDialog(null)} onConfirm={confirmItemDelete}/>}
    </main>;
};

export default CollectionsView;
