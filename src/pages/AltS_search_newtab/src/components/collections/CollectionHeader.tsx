import { ArrowLeft, ImagePlus, Plus } from 'lucide-react';
import { FaInfo } from 'react-icons/fa';
import { BRAND } from '../../../../../shared-components/brandingConfig';
import type { OrganisationData } from '../../../../../settings/allOrganisationManager/organisations/organisationTypes';
import type { CollectionRecord } from '../../../../../allObjectFolder/src/createObject/collections/collectionTypes';
import { COLLECTION_ITEM_ACTIONS_VISIBLE } from './collectionViewTypes';
import CollectionActionsMenu from './CollectionActionsMenu';
import CollectionViewSelector, { type CollectionViewMode } from './CollectionViewSelector';
import CollectionFolderIcon from './CollectionFolderIcon';

interface CollectionHeaderProps {
    collection: CollectionRecord | null;
    organisations: OrganisationData[];
    organisationId: string | null;
    onOrganisationChange: (id: string) => void;
    onBack: () => void;
    backToTimeline?: boolean;
    onCreate: () => void;
    onAddItem: () => void;
    onUploadImages: () => void;
    onRename: () => void;
    onDelete: () => void;
    isItemOpen: boolean;
    viewMode: CollectionViewMode;
    onViewModeChange: (mode: CollectionViewMode) => void;
}

const CollectionHeader = ({ collection, organisations, organisationId, onOrganisationChange, onBack, backToTimeline, onCreate, onAddItem, onUploadImages, onRename, onDelete, isItemOpen, viewMode, onViewModeChange }: CollectionHeaderProps) => {
    const docsLink = <a href={BRAND.docs.webCollections} target="_blank" rel="noopener noreferrer" aria-label="Open Webclips documentation" title="Webclips documentation" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-iconDefault)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">
      <FaInfo size={14} aria-hidden="true"/>
    </a>;
    return <header className="shrink-0 px-6 py-2">
      <div className="flex items-start gap-3">
      <div className={`flex min-h-8 min-w-0 flex-1 flex-wrap items-center justify-between gap-3 ${collection ? '' : '2xl:w-3/4 2xl:flex-none'}`}>
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={onBack} aria-label={isItemOpen ? `Back to ${collection?.name ?? 'webclip'}` : collection ? 'Back to Webclips' : backToTimeline ? 'Back to Recent' : 'Back to Home'} title={isItemOpen ? `Back to ${collection?.name ?? 'webclip'}` : collection ? 'Back to Webclips' : backToTimeline ? 'Back to Recent' : 'Back to Home'} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">
            <ArrowLeft size={15} aria-hidden="true"/>
          </button>
          {collection ? <nav aria-label="Webclip breadcrumb" className="min-w-0">
            <ol className="flex min-w-0 items-center gap-2 text-sm">
              <li className="shrink-0 text-[var(--color-textSecondary)]">Web Clip Collections</li>
              <li aria-hidden="true" className="shrink-0 text-[var(--color-textMuted)]">/</li>
              <li className="flex min-w-0 items-center gap-1.5"><CollectionFolderIcon className="h-4 w-4 shrink-0"/><h1 className="min-w-0 truncate font-medium text-[var(--color-textPrimary)]" title={collection.name}>{collection.name}</h1></li>
            </ol>
          </nav> : <h1 className="min-w-0 truncate text-sm font-medium text-[var(--color-textPrimary)]">Web Clip Collections</h1>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {collection && !isItemOpen ? <>
            <CollectionViewSelector value={viewMode} onChange={onViewModeChange} contextLabel="Webclip items"/>
            {docsLink}
            {COLLECTION_ITEM_ACTIONS_VISIBLE && <>
              <button type="button" onClick={onUploadImages} className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-2 text-xs font-medium text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]"><ImagePlus size={14} aria-hidden="true"/> Upload images</button>
              <button type="button" onClick={onAddItem} className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-2 text-xs font-medium text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]"><Plus size={14} aria-hidden="true"/> Add item</button>
            </>}
            <CollectionActionsMenu name={collection.name} onRename={onRename} onDelete={onDelete} compact/>
          </> : !collection ? <>
            {organisations.length > 1 && <select aria-label="Organisation for Webclips" value={organisationId ?? ''} onChange={event => onOrganisationChange(event.target.value)} className="h-8 min-w-0 max-w-48 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-2 text-xs text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">
              {!organisationId && <option value="">Choose Organisation</option>}
              {organisations.map(organisation => <option key={organisation.id} value={organisation.id}>{organisation.organisationName}</option>)}
            </select>}
          </> : null}
        </div>
      </div>
      {!collection && <div className="ml-auto flex shrink-0 items-center gap-2">
        <button type="button" onClick={onCreate} disabled={!organisationId} className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] px-2 text-xs font-medium text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">
          <Plus size={14} aria-hidden="true"/> New web collection
        </button>
        <CollectionViewSelector value={viewMode} onChange={onViewModeChange} contextLabel="Webclips folders"/>
        {docsLink}
      </div>}
      </div>
    </header>;
};

export default CollectionHeader;
