import * as React from 'react';
import { FaPlus } from 'react-icons/fa';
import { StackedLinkIcon } from '../icons/stackedLinkIcon';
import type { LinkItem } from '../../allObjectFolder/src/createObject/links/linkTypes';

export const LinkSheetUrlPreview = ({ urls, itemTitle, onEdit }: {
  urls: LinkItem[];
  itemTitle: string;
  onEdit: () => void;
}) => (
  <div
    className="overflow-hidden rounded border border-[var(--color-borderDefault)] bg-[var(--color-editorBg)]"
    onClick={event => event.stopPropagation()}>
    {/* Existing h-9 rows and 180px list cap show five URLs before scrolling. */}
    <div
      role="region"
      aria-label={`Links in ${itemTitle}`}
      tabIndex={urls.length > 5 ? 0 : undefined}
      className="max-h-[180px] overflow-y-auto overscroll-contain custom-scrollbar outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focusRing)]"
      onKeyDown={event => {
        if (['ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', ' '].includes(event.key)) {
          event.stopPropagation();
        }
      }}>
      {urls.map((item, index) => (
        <div
          key={`${item.id || item.url}-${index}`}
          className="flex h-9 shrink-0 items-center gap-2 border-b border-[var(--color-borderDefault)] px-2 last:border-b-0">
          <StackedLinkIcon urls={[item.url]} size={17} maxIcons={1} fallback="link" />
          <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[var(--color-textPrimary)]" title={item.title || item.name || item.url}>
            {item.title || item.name || item.url}
          </span>
          <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--color-textSecondary)]" title={item.url}>
            {item.url}
          </span>
        </div>
      ))}
    </div>
    <div className="flex justify-center border-t border-[var(--color-borderDefault)] py-1.5">
      <button
        type="button"
        onClick={event => {
          event.stopPropagation();
          onEdit();
        }}
        className="flex h-5 w-5 items-center justify-center rounded-full text-[var(--color-success)] hover:bg-[var(--color-hoverBg)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]"
        title="Add or edit links"
        aria-label={`Add or edit links in ${itemTitle}`}>
        <FaPlus size={10} />
      </button>
    </div>
  </div>
);
