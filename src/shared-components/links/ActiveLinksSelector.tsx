import * as React from 'react';
import { FaCheck, FaLink, FaPlus } from 'react-icons/fa';
import { getFaviconUrl } from '../searchBarMain/utilityFunctions/utils';
import { clsx } from 'clsx';
export type ActiveLinksSelectorItem = {
    id?: string;
    title?: string;
    displayTitle?: string;
    url: string;
    source?: string;
};
export type ActiveLinksSelectorProps = {
    label?: string;
    prefix?: string;
    required?: boolean;
    items: readonly ActiveLinksSelectorItem[];
    onToggleItem?: (item: ActiveLinksSelectorItem) => void;
    onAddLink?: () => void;
    addLabel?: string;
    emptyText?: string;
    className?: string;
};
const getHostname = (url: string) => {
    try {
        return new URL(url).hostname.replace(/^www\./i, '');
    }
    catch {
        return '';
    }
};
const buildDomainSummary = (items: readonly ActiveLinksSelectorItem[]) => {
    const counts = new Map<string, number>();
    items.forEach(item => {
        const hostname = getHostname(item.url);
        if (!hostname)
            return;
        counts.set(hostname, (counts.get(hostname) || 0) + 1);
    });
    const summary = Array.from(counts.entries())
        .map(([hostname, count]) => count > 1 ? `${hostname} (${count})` : hostname)
        .join(', ');
    return summary || `${items.length} selected`;
};
const ACTIVE_LINKS_LABEL_CLASS = 'flex min-w-0 items-center gap-1.5 text-[11px] font-[520] leading-none tracking-wide text-[var(--alts-text-section)] select-none';
const ACTIVE_LINKS_PREFIX_CLASS = 'inline-flex h-[16px] shrink-0 items-center rounded-[4px] border border-[var(--alts-border-color)] bg-[var(--alts-row-hover-bg)] px-1.5 text-[10px] font-[620] leading-none text-[var(--alts-text-secondary)]';
export const ActiveLinksSelector: React.FC<ActiveLinksSelectorProps> = ({ label = 'Active links', prefix, required = false, items, onToggleItem, onAddLink, addLabel = 'Add a new link', emptyText = 'No links selected', className, }) => {
    const domainSummary = React.useMemo(() => buildDomainSummary(items), [items]);
    return (<div className={clsx('flex flex-col gap-1.5', className)}>
    <label className={ACTIVE_LINKS_LABEL_CLASS}>
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 truncate">{label}</span>
        {required && items.length === 0 ? (<span className="shrink-0 text-[12px] font-bold leading-none text-[var(--color-error)]">*</span>) : null}
      </span>
      {prefix ? (<span className={ACTIVE_LINKS_PREFIX_CLASS}>{prefix}</span>) : null}
      {items.length > 0 ? (<span className="ml-auto min-w-0 max-w-[58%] truncate text-right text-[10px] font-[620] leading-none text-[var(--alts-text-secondary)]" title={domainSummary}>
          {domainSummary}
        </span>) : null}
    </label>
    {items.length === 0 && !onAddLink ? (<div className="px-0.5 text-[12px] font-medium leading-4 text-[var(--alts-text-secondary)]">
        {emptyText}
      </div>) : (<div className="overflow-hidden rounded-[8px] border border-[var(--alts-border-color)] bg-[var(--alts-glass-search-bg)]">
        {items.length > 0 ? (<div className="max-h-[118px] overflow-y-auto custom-scrollbar">
            {items.map((item, index) => {
                    const title = item.displayTitle || item.title || item.url || 'Untitled link';
                    const hostname = getHostname(item.url);
                    const rowKey = item.id || item.url || `${title}-${index}`;
                    return (<button key={rowKey} type="button" onMouseDown={event => {
                            event.preventDefault();
                            event.stopPropagation();
                        }} onClick={event => {
                            event.preventDefault();
                            event.stopPropagation();
                            onToggleItem?.(item);
                        }} className="flex min-h-[38px] w-full min-w-0 items-center gap-2 border-b border-[var(--alts-border-color)] px-2.5 py-2 text-left transition-colors last:border-b-0 hover:bg-[var(--alts-row-hover-bg)]">
                  <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border border-[var(--alts-text-primary)] bg-[var(--alts-text-primary)] text-[var(--alts-popup-bg)]">
                    <FaCheck className="h-2 w-2"/>
                  </span>
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--alts-row-hover-bg)] text-[var(--alts-text-secondary)]">
                    {hostname ? (<img src={getFaviconUrl(hostname)} alt="" className="h-4 w-4 object-cover" onError={event => {
                                event.currentTarget.style.display = 'none';
                            }}/>) : (<FaLink className="h-3 w-3"/>)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium leading-4 text-[var(--alts-text-primary)]">
                      {title}
                    </span>
                    {hostname ? (<span className="block truncate text-[10px] font-medium leading-3 text-[var(--alts-text-secondary)]">
                        {hostname}
                      </span>) : null}
                  </span>
                </button>);
                })}
          </div>) : (<div className="flex min-h-[34px] items-center gap-2 px-2.5 py-1.5 text-[12px] font-medium text-[var(--alts-text-secondary)]">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border border-[var(--alts-border-color)] bg-[var(--alts-row-hover-bg)] text-[var(--alts-text-secondary)]">
              <FaLink className="h-2.5 w-2.5"/>
            </span>
            <span className="min-w-0 truncate">{emptyText}</span>
          </div>)}
        {onAddLink ? (<button type="button" onMouseDown={event => {
                    event.preventDefault();
                    event.stopPropagation();
                }} onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    onAddLink();
                }} className="flex w-full items-center justify-center gap-2 border-t border-[var(--alts-border-color)] px-3 py-2.5 text-[13px] font-semibold text-[var(--color-success)] transition-colors hover:bg-[var(--alts-row-hover-bg)]">
            <FaPlus className="h-3 w-3"/>
            <span>{addLabel}</span>
          </button>) : null}
      </div>)}
  </div>);
};
