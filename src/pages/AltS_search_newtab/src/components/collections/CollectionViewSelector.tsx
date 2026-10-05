import { LayoutGrid, List } from 'lucide-react';

export type CollectionViewMode = 'grid' | 'list';

interface CollectionViewSelectorProps {
    value: CollectionViewMode;
    onChange: (value: CollectionViewMode) => void;
    contextLabel?: string;
}

const options = [
    { value: 'grid', label: 'Grid', Icon: LayoutGrid },
    { value: 'list', label: 'List', Icon: List },
] as const;

const CollectionViewSelector = ({ value, onChange, contextLabel = 'Webclip' }: CollectionViewSelectorProps) => (
    <div role="group" aria-label={`${contextLabel} view`} className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-[var(--color-borderDefault)] p-0.5">
      {options.map(({ value: option, label, Icon }) => <button key={option} type="button" aria-label={`${contextLabel} ${label} view`} aria-pressed={value === option} onClick={() => onChange(option)} className={`group relative flex h-7 w-7 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] ${value === option ? 'bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)] ring-1 ring-inset ring-[var(--color-borderActive)]' : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]'}`}>
        <Icon size={15} aria-hidden="true"/>
        <span aria-hidden="true" className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-contextMenuBg)] px-2 py-1 text-xs font-medium text-[var(--color-textPrimary)] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{label}</span>
      </button>)}
    </div>
);

export default CollectionViewSelector;
