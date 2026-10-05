import * as React from 'react';
import { FiEdit2 } from 'react-icons/fi';
/** Keep titles readable while metadata stays visually secondary in every collection sheet. */
export const COLLECTION_SHEET_TITLE_CLASS = 'min-w-0 flex-1 truncate text-[12px] font-semibold text-[var(--color-textPrimary)] opacity-100';
type CollectionSheetEditButtonProps = {
    itemLabel: string;
    onEdit: () => void;
};
export const CollectionSheetEditButton: React.FC<CollectionSheetEditButtonProps> = ({ itemLabel, onEdit }) => (<button type="button" aria-label={`Edit ${itemLabel}`} title={`Edit ${itemLabel}`} onMouseDown={event => event.stopPropagation()} onClick={event => {
        event.stopPropagation();
        onEdit();
    }} className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--color-iconDefault)] opacity-0 transition-opacity hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] group-hover/row:opacity-100 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">
    <FiEdit2 size={14}/>
  </button>);
