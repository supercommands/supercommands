import React, { useState } from 'react';
import { FiGlobe } from 'react-icons/fi';
import { LuExternalLink, LuLink } from 'react-icons/lu';
import { useDbStore } from '../../../../../../storage/store/useDbStore';
import type { WidgetInstance } from '../widgetDashboard.types';
import { openSingleLink, openMultipleLinks } from '../../../../../../shared-components/searchBarMain/utilityFunctions/urlHelpers';
import { getFaviconUrl } from '../../../../../../shared-components/searchBarMain/utilityFunctions/utils';

interface LinkWidgetProps {
  widget: WidgetInstance;
  isEditMode?: boolean;
}

const getHostnameFromUrl = (rawUrl: string): string => {
  if (!rawUrl) return '';
  try {
    const formatted = rawUrl.startsWith('http://') || rawUrl.startsWith('https://') || rawUrl.includes('://')
      ? rawUrl
      : `https://${rawUrl}`;
    const parsed = new URL(formatted);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return rawUrl;
  }
};

const LinkItemFavicon: React.FC<{ url: string; explicitFaviconUrl?: string }> = ({ url, explicitFaviconUrl }) => {
  const [hasError, setHasError] = useState(false);
  const iconSrc = !hasError ? explicitFaviconUrl || (url ? getFaviconUrl(url) : '') : '';

  if (!iconSrc || hasError) {
    return <FiGlobe size={14} className="shrink-0 text-[var(--color-textMuted)]" />;
  }

  return (
    <img
      src={iconSrc}
      alt=""
      className="w-3.5 h-3.5 rounded-sm object-contain shrink-0"
      onError={() => setHasError(true)}
    />
  );
};

export const LinkWidget: React.FC<LinkWidgetProps> = ({ widget, isEditMode = false }) => {
  const link = useDbStore(state => state.getLinkById(widget.linkId));
  const isStoreInitialized = useDbStore(state => state.isInitialized);

  const displayTitle = link?.title || widget.title || 'Untitled Links';
  const urlItems = link?.urls || [];

  const handleLinkClick = (e: React.MouseEvent, rawUrl: string) => {
    if (isEditMode) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (!rawUrl) return;
    openSingleLink(rawUrl, true);
  };

  const handleOpenAllLinks = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isEditMode) return;

    const urls = urlItems.map(item => item.url).filter(Boolean);
    if (urls.length > 0) {
      openMultipleLinks(urls);
    }
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden select-none">
      {/* Widget Header */}
      <div className="flex items-center justify-between border-b pb-2 mb-2 border-[var(--color-borderDefault)] shrink-0">
        <div className="flex items-center gap-1.5 min-w-0 pr-2">
          <LuLink size={14} className="shrink-0 text-[var(--color-iconDefault)]" />
          <h4 className="text-xs font-bold truncate text-[var(--color-textMuted)]" title={displayTitle}>
            {displayTitle}
          </h4>
        </div>
        <div className="flex items-center gap-1.5 shrink-0" data-no-widget-drag="true">
          {urlItems.length > 0 && !isEditMode && (
            <button
              type="button"
              onClick={handleOpenAllLinks}
              title="Open all links in new tabs"
              aria-label="Open all links"
              className="flex items-center gap-1 p-1 rounded-md transition-all cursor-pointer text-[var(--color-textMuted)] opacity-40 hover:opacity-100 hover:text-[var(--color-textPrimary)]">
              <LuExternalLink size={12} />
            </button>
          )}
          {urlItems.length > 0 && (
            <span className="text-[10px] font-semibold tabular-nums text-[var(--color-textMuted)] bg-[var(--color-inputBg)] px-1.5 py-0.5 rounded-md shrink-0 border border-[var(--color-borderDefault)]">
              {urlItems.length}
            </span>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto clean-scrollbar pr-0.5">
        {!link && isStoreInitialized ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-xs p-3 text-[var(--color-textMuted)]">
            <FiGlobe size={20} className="mb-1.5 opacity-40" />
            <span>Link collection not found.</span>
          </div>
        ) : urlItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-xs p-3 text-[var(--color-textMuted)]">
            <FiGlobe size={20} className="mb-1.5 opacity-40" />
            <span>No links in this collection.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {urlItems.map((item, index) => {
              const label = item.title || item.name || getHostnameFromUrl(item.url) || item.url || `Link #${index + 1}`;
              const hostname = getHostnameFromUrl(item.url);
              const itemKey = item.id || `${item.url}-${index}`;

              return (
                <button
                  key={itemKey}
                  type="button"
                  data-no-widget-drag="true"
                  onClick={e => handleLinkClick(e, item.url)}
                  className={`group/item flex items-center justify-between gap-2 p-2 rounded-xl text-left transition-all duration-150 border border-transparent ${
                    isEditMode
                      ? 'cursor-grab active:cursor-grabbing hover:bg-[var(--color-bgHover)]'
                      : 'cursor-pointer hover:bg-[var(--color-bgHover)] hover:border-[var(--color-borderDefault)]'
                  }`}
                  title={item.url || label}>
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <LinkItemFavicon url={item.url} explicitFaviconUrl={item.favIconUrl} />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-medium truncate text-[var(--color-textPrimary)] group-hover/item:text-[var(--color-textPrimary)]">
                        {label}
                      </span>
                      {hostname && hostname !== label && (
                        <span className="text-[10px] truncate text-[var(--color-textMuted)]">
                          {hostname}
                        </span>
                      )}
                    </div>
                  </div>

                  {!isEditMode && item.url && (
                    <LuExternalLink
                      size={12}
                      className="shrink-0 text-[var(--color-textMuted)] opacity-0 group-hover/item:opacity-100 transition-opacity"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LinkWidget;
