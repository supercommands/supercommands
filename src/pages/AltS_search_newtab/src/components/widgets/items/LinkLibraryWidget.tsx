import React, { Suspense, useMemo, useState, useEffect, useRef } from 'react';
import { FiGlobe, FiSearch } from 'react-icons/fi';
import { LuTag, LuX, LuSettings, LuExternalLink } from 'react-icons/lu';
import { useDbStore } from '../../../../../../storage/store/useDbStore';
import type { WidgetInstance, LinkLibraryWidgetSettings } from '../widgetDashboard.types';
import type { LinkRecord, LinkItem } from '../../../../../../allObjectFolder/src/createObject/links/linkTypes';
import { openSingleLink, openMultipleLinks } from '../../../../../../shared-components/searchBarMain/utilityFunctions/urlHelpers';
import { getFaviconUrl } from '../../../../../../shared-components/searchBarMain/utilityFunctions/utils';
import { updateWidgetSettingsAsync } from '../../../../../../storage/localStorage/widgetDashboardStorage';
import EditableWidgetTitle from '../components/EditableWidgetTitle';
import { getWidgetTypeLabel } from '../utils/widgetTypeLabel';
import { getWidgetHeaderIcon } from '../utils/widgetHeaderIcons';
import { LuPlus } from 'react-icons/lu';
import { useUIStore } from '../../../../../../shared-components/uiStateManager';
import { widgetPerf } from '../utils/widgetPerf';

export interface LinkWidgetCreationContext {
  widgetId: string;
  viewId: string;
  sourceMode: 'all' | 'manual' | 'tags';
  selectedTagIds: string[];
}


import type { WidgetLayoutInfo } from '../utils/widgetLayoutInfo';

const LibraryWidgetSettingsPopover = React.lazy(() => import('../components/LibraryWidgetSettingsPopover'));
const LinkLibraryPicker = React.lazy(() => import('../modals/LinkLibraryPicker'));

interface LinkLibraryWidgetProps {
  widget: WidgetInstance;
  isEditMode?: boolean;
  layoutInfo?: WidgetLayoutInfo;
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

const SingleFavicon: React.FC<{ url: string; explicitFaviconUrl?: string; size?: number }> = ({
  url,
  explicitFaviconUrl,
  size = 28,
}) => {
  const [hasError, setHasError] = useState(false);
  const iconSrc = !hasError ? explicitFaviconUrl || (url ? getFaviconUrl(url) : '') : '';

  if (!iconSrc || hasError) {
    return <FiGlobe size={size * 0.75} className="shrink-0 text-[var(--color-textMuted)]" />;
  }

  return (
    <img
      src={iconSrc}
      alt=""
      style={{ width: size, height: size }}
      className="rounded-full object-contain shrink-0"
      onError={() => setHasError(true)}
    />
  );
};

const CircularShortcutIcon: React.FC<{ urls: LinkItem[] }> = ({ urls }) => {
  const validUrls = urls.filter(u => Boolean(u.url));
  const remainingCount = validUrls.length - 2;

  if (validUrls.length === 0) {
    return <FiGlobe size={24} className="text-[var(--color-textMuted)]" />;
  }

  if (validUrls.length === 1) {
    return (
      <SingleFavicon
        url={validUrls[0].url}
        explicitFaviconUrl={validUrls[0].favIconUrl}
        size={28}
      />
    );
  }

  return (
    <div className="relative flex items-center justify-center w-full h-full">
      <div className="flex items-center -space-x-2">
        {validUrls.slice(0, 2).map((item, idx) => (
          <SingleFavicon key={item.id || idx} url={item.url} explicitFaviconUrl={item.favIconUrl} size={22} />
        ))}
      </div>
      {remainingCount > 0 && (
        <span className="absolute top-0 right-0 text-[8px] font-bold tabular-nums px-1 rounded-full border bg-[var(--color-selectedBg,var(--color-cardBg))] text-[var(--color-textPrimary)] border-[var(--color-borderDefault)] shadow-xs">
          +{remainingCount}
        </span>
      )}
    </div>
  );
};

export const LinkLibraryWidget: React.FC<LinkLibraryWidgetProps> = ({ widget, isEditMode = false }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [settingsPopoverPos, setSettingsPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const settingsPopoverRef = useRef<HTMLDivElement>(null);

  const links = useDbStore(state => state.links);
  const tags = useDbStore(state => state.tags);
  const isStoreInitialized = useDbStore(state => state.isInitialized);

  const settings = useMemo<LinkLibraryWidgetSettings>(() => {
    const rawSettings = (widget.settings || {}) as Partial<LinkLibraryWidgetSettings>;
    return {
      sourceMode: rawSettings.sourceMode === 'manual' || rawSettings.sourceMode === 'tags' ? rawSettings.sourceMode : 'all',
      selectedCollectionIds: Array.isArray(rawSettings.selectedCollectionIds) ? rawSettings.selectedCollectionIds : [],
      selectedTagIds: Array.isArray(rawSettings.selectedTagIds) ? rawSettings.selectedTagIds : [],
      tagMatchMode: rawSettings.tagMatchMode === 'all' ? 'all' : 'any',
      sortBy: rawSettings.sortBy === 'title' || rawSettings.sortBy === 'recent' ? rawSettings.sortBy : 'saved-order',
      enableSearch: Boolean(rawSettings.enableSearch),
    };
  }, [widget.settings]);

  const handleOpenSettings = () => {
    if (!isSettingsOpen && settingsBtnRef.current) {
      const rect = settingsBtnRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const popoverWidth = Math.min(360, viewportWidth - 24);
      const popoverEstHeight = 480;

      let left = rect.right - popoverWidth + window.scrollX;
      if (left + popoverWidth > window.scrollX + viewportWidth - 12) {
        left = window.scrollX + viewportWidth - popoverWidth - 12;
      }
      if (left < window.scrollX + 12) {
        left = window.scrollX + 12;
      }

      let top = rect.bottom + window.scrollY + 4;
      if (top + popoverEstHeight > window.scrollY + viewportHeight - 12) {
        const topAbove = rect.top + window.scrollY - popoverEstHeight - 4;
        if (topAbove >= window.scrollY + 12) {
          top = topAbove;
        } else {
          top = Math.max(window.scrollY + 12, window.scrollY + viewportHeight - popoverEstHeight - 12);
        }
      }

      setSettingsPopoverPos({ top, left });
    }
    setIsSettingsOpen(!isSettingsOpen);
  };

  useEffect(() => {
    if (!isSettingsOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        settingsPopoverRef.current &&
        !settingsPopoverRef.current.contains(e.target as Node) &&
        settingsBtnRef.current &&
        !settingsBtnRef.current.contains(e.target as Node)
      ) {
        setIsSettingsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsSettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isSettingsOpen]);

  const updateSettings = async (partial: Partial<LinkLibraryWidgetSettings>) => {
    const nextSettings = { ...settings, ...partial };
    await updateWidgetSettingsAsync(widget.viewId, widget.id, nextSettings as Record<string, unknown>);
  };

  const validLinks = useMemo(() => links.filter(l => l.deletedAt == null), [links]);

  const visibleLinks = useMemo(() => {
    let nextVisibleLinks: LinkRecord[] = [];
    if (settings.sourceMode === 'manual') {
      nextVisibleLinks = validLinks.filter(l => settings.selectedCollectionIds.includes(l.id));
    } else if (settings.sourceMode === 'all') {
      nextVisibleLinks = validLinks.filter(l => (l.urls || []).length > 0);
    } else if (settings.sourceMode === 'tags') {
      if (settings.selectedTagIds.length > 0) {
        if (settings.tagMatchMode === 'all') {
          nextVisibleLinks = validLinks.filter(l => settings.selectedTagIds.every((tId: string) => l.tagIds?.includes(tId)));
        } else {
          nextVisibleLinks = validLinks.filter(l => settings.selectedTagIds.some((tId: string) => l.tagIds?.includes(tId)));
        }
      }
    }

    if (settings.sortBy === 'title') {
      nextVisibleLinks = [...nextVisibleLinks].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (settings.sortBy === 'recent') {
      nextVisibleLinks = [...nextVisibleLinks].sort((a, b) => b.updatedAt - a.updatedAt);
    }

    if (settings.enableSearch && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      nextVisibleLinks = nextVisibleLinks.filter(l =>
        (l.title || '').toLowerCase().includes(q) ||
        (l.urls || []).some(u => (u.url || '').toLowerCase().includes(q) || (u.title || '').toLowerCase().includes(q))
      );
    }

    return nextVisibleLinks;
  }, [searchQuery, settings, validLinks]);
  const firstContentLoggedRef = useRef(false);

  useEffect(() => {
    widgetPerf('data:storeSnapshot', {
      widgetType: widget.type,
      widgetId: widget.id,
      viewId: widget.viewId,
      storeInitialized: isStoreInitialized,
      recordsReturned: validLinks.length,
      recordsDisplayed: visibleLinks.length,
      sourceMode: settings.sourceMode,
    });

    if (!firstContentLoggedRef.current && isStoreInitialized) {
      firstContentLoggedRef.current = true;
      widgetPerf('content:firstReady', {
        widgetType: widget.type,
        widgetId: widget.id,
        viewId: widget.viewId,
        recordsReturned: validLinks.length,
        recordsDisplayed: visibleLinks.length,
      });
    }
  }, [isStoreInitialized, settings.sourceMode, validLinks.length, visibleLinks.length, widget.id, widget.type, widget.viewId]);

  const handleTileClick = (e: React.MouseEvent, record: LinkRecord) => {
    if (isEditMode) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const urls = (record.urls || []).filter(u => Boolean(u.url));
    if (urls.length === 0) return;

    if (urls.length === 1) {
      openSingleLink(urls[0].url, true);
    } else {
      openMultipleLinks(urls.map(u => u.url));
    }
  };

  const popoverItems = useMemo(
    () =>
      isSettingsOpen
        ? validLinks.map(link => {
            const urlItems = link.urls || [];
            const firstItem = urlItems[0];
            const label =
              link.title || firstItem?.title || firstItem?.name || getHostnameFromUrl(firstItem?.url || '') || 'Untitled Link';
            return {
              id: link.id,
              title: label,
              icon: <CircularShortcutIcon urls={urlItems} />,
            };
          })
        : [],
    [isSettingsOpen, validLinks],
  );

  const popoverTags = useMemo(
    () =>
      isSettingsOpen
        ? tags.map(tag => ({
            id: tag.id,
            name: tag.name,
          }))
        : [],
    [isSettingsOpen, tags],
  );

  const handleToggleItemSelection = (linkId: string) => {
    const current = new Set(settings.selectedCollectionIds);
    if (current.has(linkId)) {
      current.delete(linkId);
    } else {
      current.add(linkId);
    }
    updateSettings({ selectedCollectionIds: Array.from(current) });
  };

  const handleToggleTagSelection = (tagId: string) => {
    const current = new Set(settings.selectedTagIds);
    if (current.has(tagId)) {
      current.delete(tagId);
    } else {
      current.add(tagId);
    }
    updateSettings({ selectedTagIds: Array.from(current) });
  };

  const handleCreateClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isEditMode) return;

    useUIStore.getState().openEditor({
      type: 'link',
      id: 'new',
      props: {
        linkWidgetCreationContext: {
          widgetId: widget.id,
          viewId: widget.viewId,
          sourceMode: settings.sourceMode,
          selectedTagIds: [...settings.selectedTagIds],
        },
      },
    });
  };

  const renderCreateTile = () => {
    if (isEditMode) return null;
    return (
      <button
        type="button"
        data-no-widget-drag="true"
        onClick={handleCreateClick}
        aria-label="Create link in this widget"
        title="Create link in this widget"
        className="group/tile group/plus flex flex-col items-center gap-1 p-0 text-center transition-all duration-150 border-0 select-none cursor-pointer opacity-0 group-hover/widget:opacity-100 focus-visible:opacity-100 hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100">
        <div className="relative flex items-center justify-center w-10 h-10 transition-transform group-hover/tile:scale-105 shrink-0 rounded-full border border-dashed border-[var(--color-borderDefault)] text-[var(--color-textMuted)] group-hover/plus:border-[var(--color-borderActive)] group-hover/plus:text-[var(--color-textPrimary)]">
          <LuPlus size={18} />
        </div>
        <span className="text-[11px] font-medium line-clamp-2 leading-tight w-full px-0.5 text-center text-[var(--color-textMuted)] group-hover/plus:text-[var(--color-textPrimary)]">
          Create Link
        </span>
      </button>
    );
  };

  return (
    <div className="group/widget flex h-full w-full flex-col overflow-hidden select-none px-4 pt-3 pb-2">
      {/* Widget Header */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center mb-2 shrink-0 gap-2.5 w-full min-w-0">
        <div className="col-start-1 min-w-0 justify-self-start flex items-center gap-2">
          <EditableWidgetTitle
            viewId={widget.viewId}
            widgetId={widget.id}
            initialTitle={widget.title || 'Links'}
            isEditMode={isEditMode}
            icon={getWidgetHeaderIcon(widget.type)}
            typeLabel={getWidgetTypeLabel(widget.type)}
            className="text-xs font-bold truncate text-[var(--color-textMuted)]"
          />
          {!isEditMode && visibleLinks.length > 0 && (
            <button
              type="button"
              data-no-widget-drag="true"
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                const allUrls = visibleLinks.flatMap(l => (l.urls || []).map(u => u.url)).filter(Boolean);
                if (allUrls.length > 0) {
                  openMultipleLinks(allUrls);
                }
              }}
              aria-label="Open visible links"
              title="Open all visible links in new tabs"
              className="flex items-center gap-1 p-1 rounded-md text-[var(--color-textMuted)] opacity-40 hover:opacity-100 hover:text-[var(--color-textPrimary)] transition-all cursor-pointer shrink-0">
              <LuExternalLink size={12} />
            </button>
          )}
        </div>

        {/* Search Bar (if enabled) */}
        {settings.enableSearch ? (
          <div
            className={`col-start-2 justify-self-start w-full min-w-0 ${
              widget.sizePreset === 'small'
                ? 'max-w-[130px]'
                : widget.sizePreset === 'large'
                  ? 'max-w-[360px]'
                  : 'max-w-[220px]'
            }`}
            data-no-widget-drag="true">
            <div className="relative flex items-center w-full">
              <FiSearch size={13} className="absolute left-2.5 text-[var(--color-textMuted)] pointer-events-none shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search links..."
                className="w-full pl-7 pr-7 py-1 rounded-lg border text-xs bg-transparent border-[var(--color-borderDefault)] text-[var(--color-textPrimary)] placeholder:text-[var(--color-textMuted)] focus:outline-none focus:border-[var(--color-borderActive)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] cursor-pointer"
                  aria-label="Clear search">
                  <LuX size={12} />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="col-start-2 min-w-0" />
        )}

        {/* Header Actions */}
        <div className="col-start-3 justify-self-end flex items-center gap-1" data-no-widget-drag="true">
          {settings.sourceMode === 'tags' && settings.selectedTagIds.length > 0 && (
            <button
              type="button"
              onClick={handleOpenSettings}
              aria-label="Filtered by tags"
              title={`Filtered by ${settings.selectedTagIds.length} tag${settings.selectedTagIds.length > 1 ? 's' : ''}`}
              className={`relative p-1.5 rounded-lg border transition-all cursor-pointer ${
                isSettingsOpen
                  ? 'opacity-100 bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)] border-[var(--color-borderActive)]'
                  : 'opacity-0 group-hover/widget:opacity-100 focus-visible:opacity-100 border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] dark:bg-[var(--color-widgetInnerBg)] text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] hover:border-[var(--color-borderActive)]'
              }`}>
              <LuTag size={13} />
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white shadow-xs">
                {settings.selectedTagIds.length}
              </span>
            </button>
          )}
          <button
            ref={settingsBtnRef}
            type="button"
            onClick={handleOpenSettings}
            aria-label="Widget settings"
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              isSettingsOpen || isEditMode
                ? 'opacity-100 bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)] border-[var(--color-borderActive)]'
                : 'opacity-0 group-hover/widget:opacity-100 focus-visible:opacity-100 border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] dark:bg-[var(--color-widgetInnerBg)] text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] hover:border-[var(--color-borderActive)]'
            }`}>
            <LuSettings size={13} />
          </button>
        </div>
      </div>

      {isSettingsOpen && (
        <Suspense fallback={null}>
          <LibraryWidgetSettingsPopover
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            popoverPos={settingsPopoverPos}
            popoverRef={settingsPopoverRef}
            triggerBtnRef={settingsBtnRef}
            widgetType="link-library"
            enableSearch={Boolean(settings.enableSearch)}
            onToggleEnableSearch={next => {
              if (!next) setSearchQuery('');
              updateSettings({ enableSearch: next });
            }}
            sourceMode={settings.sourceMode}
            onUpdateSourceMode={mode => updateSettings({ sourceMode: mode })}
            selectedItemIds={settings.selectedCollectionIds}
            onToggleItemSelection={handleToggleItemSelection}
            items={popoverItems}
            selectedTagIds={settings.selectedTagIds}
            onToggleTagSelection={handleToggleTagSelection}
            onSetSelectedTagIds={tagIds => updateSettings({ selectedTagIds: tagIds, tagMatchMode: 'all' })}
            tags={popoverTags}
            tagMatchMode={settings.tagMatchMode}
            onUpdateTagMatchMode={mode => updateSettings({ tagMatchMode: mode })}
          />
        </Suspense>
      )}

      {/* Circular Shortcut Grid Area */}
      <div className="flex-1 min-h-0 overflow-y-auto clean-scrollbar px-0 py-1">
        {validLinks.length === 0 && isStoreInitialized ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-xs p-3 text-[var(--color-textMuted)]">
            <FiGlobe size={20} className="mb-1.5 opacity-40" />
            <span className="mb-2">No links available. Create a saved link first.</span>
            {renderCreateTile()}
          </div>
        ) : settings.sourceMode === 'manual' && settings.selectedCollectionIds.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-xs p-3 text-[var(--color-textMuted)]">
            <FiGlobe size={20} className="mb-1.5 opacity-40" />
            <span className="mb-2">Select items from Widget Settings.</span>
            {renderCreateTile()}
          </div>
        ) : settings.sourceMode === 'tags' && settings.selectedTagIds.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-xs p-3 text-[var(--color-textMuted)]">
            <LuTag size={20} className="mb-1.5 opacity-40" />
            <span className="mb-2">Select one or more tags from Widget Settings.</span>
            {renderCreateTile()}
          </div>
        ) : settings.sourceMode === 'tags' && visibleLinks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-xs p-3 text-[var(--color-textMuted)]">
            <LuTag size={20} className="mb-1.5 opacity-40" />
            <span className="mb-2">No links match the selected tags.</span>
            {renderCreateTile()}
          </div>
        ) : visibleLinks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-xs p-3 text-[var(--color-textMuted)]">
            <FiGlobe size={20} className="mb-1.5 opacity-40" />
            <span className="mb-2">No matching links.</span>
            {renderCreateTile()}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(54px,1fr))] gap-x-1 gap-y-2.5 p-0">
            {visibleLinks.map(record => {
              const urlItems = record.urls || [];
              const firstItem = urlItems[0];
              const label = record.title || firstItem?.title || firstItem?.name || getHostnameFromUrl(firstItem?.url || '') || 'Untitled Links';

              return (
                <button
                  key={record.id}
                  type="button"
                  data-no-widget-drag="true"
                  onClick={e => handleTileClick(e, record)}
                  onContextMenu={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    useUIStore.getState().openEditor({
                      type: 'link',
                      id: record.id,
                      props: { item: record, snippet: record },
                    });
                  }}
                  className={`group/tile flex flex-col items-center gap-1 p-0 text-center transition-all duration-150 border-0 select-none ${
                    isEditMode
                      ? 'cursor-grab active:cursor-grabbing'
                      : 'cursor-pointer'
                  }`}
                  title={`${label} (${urlItems.length} ${urlItems.length === 1 ? 'link' : 'links'})`}>
                  {/* Icon Surface without dark background circle */}
                  <div className="relative flex items-center justify-center w-10 h-10 transition-transform group-hover/tile:scale-105 shrink-0 overflow-visible">
                    <CircularShortcutIcon urls={urlItems} />
                  </div>

                  {/* Tile Label Below Icon */}
                  <span className="text-[11px] font-medium line-clamp-2 leading-tight w-full px-0.5 text-center text-[var(--color-textSecondary)] group-hover/tile:text-[var(--color-textPrimary)]">
                    {label}
                  </span>
                </button>
              );
            })}
            {renderCreateTile()}
          </div>
        )}
      </div>

      {isPickerOpen && (
        <Suspense fallback={null}>
          <LinkLibraryPicker
            isOpen={isPickerOpen}
            onClose={() => setIsPickerOpen(false)}
            initialSelectedIds={settings.selectedCollectionIds}
            isCreationMode={false}
            onConfirm={selectedIds => updateSettings({ selectedCollectionIds: selectedIds })}
          />
        </Suspense>
      )}
    </div>
  );
};

export default LinkLibraryWidget;
