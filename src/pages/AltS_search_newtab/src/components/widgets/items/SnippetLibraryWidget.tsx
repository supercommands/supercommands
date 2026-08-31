import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { LuPencil, LuCheck, LuTag, LuX, LuSettings } from 'react-icons/lu';
import { FiCode, FiSearch } from 'react-icons/fi';
import { FaCode } from 'react-icons/fa';
import { useDbStore } from '../../../../../../storage/store/useDbStore';
import { useUIStore } from '../../../../../../shared-components/uiStateManager';
import type { WidgetInstance, SnippetLibraryWidgetSettings } from '../widgetDashboard.types';
import type { SnippetRecord } from '../../../../../../allObjectFolder/src/createObject/snippets/snippetTypes';
import { updateWidgetSettingsAsync } from '../../../../../../storage/localStorage/widgetDashboardStorage';
import SnippetLibraryPicker from '../modals/SnippetLibraryPicker';
import EditableWidgetTitle from '../components/EditableWidgetTitle';
import LibraryWidgetSettingsPopover from '../components/LibraryWidgetSettingsPopover';
import { getWidgetTypeLabel } from '../utils/widgetTypeLabel';
import { getWidgetHeaderIcon } from '../utils/widgetHeaderIcons';
import { widgetPerf } from '../utils/widgetPerf';
import { LuPlus } from 'react-icons/lu';

export interface SnippetWidgetCreationContext {
  widgetId: string;
  viewId: string;
  sourceMode: 'all' | 'manual' | 'tags';
  selectedTagIds: string[];
}

import type { WidgetLayoutInfo } from '../utils/widgetLayoutInfo';

interface SnippetLibraryWidgetProps {
  widget: WidgetInstance;
  isEditMode?: boolean;
  layoutInfo?: WidgetLayoutInfo;
}

export const SnippetLibraryWidget: React.FC<SnippetLibraryWidgetProps> = ({ widget, isEditMode = false }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [settingsPopoverPos, setSettingsPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const settingsPopoverRef = useRef<HTMLDivElement>(null);

  const snippets = useDbStore(state => state.snippets);
  const tags = useDbStore(state => state.tags);
  const isStoreInitialized = useDbStore(state => state.isInitialized);

  const rawSettings = (widget.settings || {}) as Partial<SnippetLibraryWidgetSettings>;
  const settings: SnippetLibraryWidgetSettings = {
    sourceMode:
      rawSettings.sourceMode === 'manual' || rawSettings.sourceMode === 'tags' ? rawSettings.sourceMode : 'all',
    selectedSnippetIds: Array.isArray(rawSettings.selectedSnippetIds) ? rawSettings.selectedSnippetIds : [],
    selectedTagIds: Array.isArray(rawSettings.selectedTagIds) ? rawSettings.selectedTagIds : [],
    tagMatchMode: rawSettings.tagMatchMode === 'all' ? 'all' : 'any',
    sortBy: rawSettings.sortBy === 'title' || rawSettings.sortBy === 'recent' ? rawSettings.sortBy : 'saved-order',
    enableSearch: Boolean(rawSettings.enableSearch),
  };

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

  const updateSettings = async (partial: Partial<SnippetLibraryWidgetSettings>) => {
    const nextSettings = { ...settings, ...partial };
    await updateWidgetSettingsAsync(widget.viewId, widget.id, nextSettings as Record<string, unknown>);
  };

  const validSnippets = snippets.filter(s => s.deletedAt == null);

  let visibleSnippets: SnippetRecord[] = [];
  if (settings.sourceMode === 'manual') {
    visibleSnippets = validSnippets.filter(s => settings.selectedSnippetIds.includes(s.id));
  } else if (settings.sourceMode === 'all') {
    visibleSnippets = validSnippets;
  } else if (settings.sourceMode === 'tags') {
    if (settings.selectedTagIds.length > 0) {
      if (settings.tagMatchMode === 'all') {
        visibleSnippets = validSnippets.filter(s =>
          settings.selectedTagIds.every((tId: string) => s.tagIds?.includes(tId)),
        );
      } else {
        visibleSnippets = validSnippets.filter(s =>
          settings.selectedTagIds.some((tId: string) => s.tagIds?.includes(tId)),
        );
      }
    }
  }

  if (settings.sortBy === 'title') {
    visibleSnippets = [...visibleSnippets].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
  } else if (settings.sortBy === 'recent') {
    visibleSnippets = [...visibleSnippets].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  if (settings.enableSearch && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    visibleSnippets = visibleSnippets.filter(s => {
      const configStr = typeof s.config === 'string' ? s.config : JSON.stringify(s.config || {});
      return (
        (s.title || '').toLowerCase().includes(q) ||
        configStr.toLowerCase().includes(q) ||
        (s.shortcut || '').toLowerCase().includes(q)
      );
    });
  }
  const firstContentLoggedRef = useRef(false);

  useEffect(() => {
    widgetPerf('data:storeSnapshot', {
      widgetType: widget.type,
      widgetId: widget.id,
      viewId: widget.viewId,
      storeInitialized: isStoreInitialized,
      recordsReturned: validSnippets.length,
      recordsDisplayed: visibleSnippets.length,
      sourceMode: settings.sourceMode,
    });

    if (!firstContentLoggedRef.current && isStoreInitialized) {
      firstContentLoggedRef.current = true;
      widgetPerf('content:firstReady', {
        widgetType: widget.type,
        widgetId: widget.id,
        viewId: widget.viewId,
        recordsReturned: validSnippets.length,
        recordsDisplayed: visibleSnippets.length,
      });
    }
  }, [
    isStoreInitialized,
    settings.sourceMode,
    validSnippets.length,
    visibleSnippets.length,
    widget.id,
    widget.type,
    widget.viewId,
  ]);

  const handleTileClick = (e: React.MouseEvent, record: SnippetRecord) => {
    if (isEditMode) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    useUIStore.getState().openEditor({
      type: 'note',
      id: record.id,
      props: {
        snippet: {
          ...record,
          category: 'snippet',
          type: 'snippet',
        },
        category: 'snippet',
      },
    });
  };

  const popoverItems = validSnippets.map(record => {
    const configStr = typeof record.config === 'string' ? record.config : JSON.stringify(record.config || {});
    return {
      id: record.id,
      title: record.title || 'Untitled Snippet',
      subtitle: record.shortcut ? `Shortcut: ${record.shortcut}` : configStr,
      icon: <FaCode size={18} className="text-[var(--color-iconDefault)] shrink-0" />,
    };
  });

  const popoverTags = tags.map(tag => ({
    id: tag.id,
    name: tag.name,
  }));

  const handleToggleItemSelection = (snippetId: string) => {
    const current = new Set(settings.selectedSnippetIds);
    if (current.has(snippetId)) {
      current.delete(snippetId);
    } else {
      current.add(snippetId);
    }
    updateSettings({ selectedSnippetIds: Array.from(current) });
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
      type: 'note',
      id: 'new',
      props: {
        category: 'snippet',
        snippet: null,
        snippetWidgetCreationContext: {
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
        aria-label="Create text expander in this widget"
        title="Create text expander in this widget"
        className="group/tile group/plus flex flex-col items-center gap-1 p-0 text-center transition-all duration-150 border-0 select-none cursor-pointer opacity-0 group-hover/widget:opacity-100 focus-visible:opacity-100 hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100">
        <div className="relative flex items-center justify-center w-10 h-10 transition-transform group-hover/tile:scale-105 shrink-0 rounded-full border border-dashed border-[var(--color-borderDefault)] text-[var(--color-textMuted)] group-hover/plus:border-[var(--color-borderActive)] group-hover/plus:text-[var(--color-textPrimary)]">
          <LuPlus size={18} />
        </div>
        <span className="text-[11px] font-medium line-clamp-2 leading-tight w-full px-0.5 text-center text-[var(--color-textMuted)] group-hover/plus:text-[var(--color-textPrimary)]">
          Create Text Expander
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
            initialTitle={widget.title || 'Text Expanders'}
            isEditMode={isEditMode}
            icon={getWidgetHeaderIcon(widget.type)}
            typeLabel={getWidgetTypeLabel(widget.type)}
            className="text-xs font-bold truncate text-[var(--color-textMuted)]"
          />
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
              <FiSearch
                size={13}
                className="absolute left-2.5 text-[var(--color-textMuted)] pointer-events-none shrink-0"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search text expanders..."
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

      {/* Shared Redesigned Settings Popover */}
      <LibraryWidgetSettingsPopover
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        popoverPos={settingsPopoverPos}
        popoverRef={settingsPopoverRef}
        triggerBtnRef={settingsBtnRef}
        widgetType="snippet-library"
        enableSearch={Boolean(settings.enableSearch)}
        onToggleEnableSearch={next => {
          if (!next) setSearchQuery('');
          updateSettings({ enableSearch: next });
        }}
        sourceMode={settings.sourceMode}
        onUpdateSourceMode={mode => updateSettings({ sourceMode: mode })}
        selectedItemIds={settings.selectedSnippetIds}
        onToggleItemSelection={handleToggleItemSelection}
        items={popoverItems}
        selectedTagIds={settings.selectedTagIds}
        onToggleTagSelection={handleToggleTagSelection}
        onSetSelectedTagIds={tagIds => updateSettings({ selectedTagIds: tagIds, tagMatchMode: 'all' })}
        tags={popoverTags}
        tagMatchMode={settings.tagMatchMode}
        onUpdateTagMatchMode={mode => updateSettings({ tagMatchMode: mode })}
      />

      {/* Circular Icon Grid Area */}
      <div className="flex-1 min-h-0 overflow-y-auto clean-scrollbar px-0 py-1">
        {validSnippets.length === 0 && isStoreInitialized ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-xs p-3 text-[var(--color-textMuted)]">
            <FiCode size={20} className="mb-1.5 opacity-40" />
            <span className="mb-2">No text expanders available. Create a text expander first.</span>
            {renderCreateTile()}
          </div>
        ) : settings.sourceMode === 'manual' && settings.selectedSnippetIds.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-xs p-3 text-[var(--color-textMuted)]">
            <FiCode size={20} className="mb-1.5 opacity-40" />
            <span className="mb-2">Select items from Widget Settings.</span>
            {renderCreateTile()}
          </div>
        ) : settings.sourceMode === 'tags' && settings.selectedTagIds.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-xs p-3 text-[var(--color-textMuted)]">
            <LuTag size={20} className="mb-1.5 opacity-40" />
            <span className="mb-2">Select one or more tags from Widget Settings.</span>
            {renderCreateTile()}
          </div>
        ) : settings.sourceMode === 'tags' && visibleSnippets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-xs p-3 text-[var(--color-textMuted)]">
            <LuTag size={20} className="mb-1.5 opacity-40" />
            <span className="mb-2">No text expanders match the selected tags.</span>
            {renderCreateTile()}
          </div>
        ) : visibleSnippets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-xs p-3 text-[var(--color-textMuted)]">
            <FaCode size={20} className="mb-1.5 opacity-40" />
            <span className="mb-2">No text expanders available.</span>
            {renderCreateTile()}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(54px,1fr))] gap-x-1 gap-y-2.5 p-0">
            {visibleSnippets.map(record => {
              const label = record.title || 'Untitled Snippet';

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
                      type: 'note',
                      id: record.id,
                      props: {
                        snippet: {
                          ...record,
                          category: 'snippet',
                          type: 'snippet',
                        },
                        category: 'snippet',
                      },
                    });
                  }}
                  className={`group/tile flex flex-col items-center gap-1 p-0 text-center transition-all duration-150 border-0 select-none ${
                    isEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                  }`}
                  title={label}>
                  {/* Icon Surface without dark background circle */}
                  <div className="relative flex items-center justify-center w-10 h-10 transition-transform group-hover/tile:scale-105 shrink-0 overflow-visible">
                    <FaCode
                      size={22}
                      className="text-[var(--color-iconDefault)] group-hover/tile:text-[var(--color-textPrimary)]"
                    />
                    {record.shortcut && (
                      <span className="absolute bottom-0.5 text-[8px] font-mono font-bold px-1 rounded-full border bg-[var(--color-selectedBg,var(--color-cardBg))] text-[var(--color-textPrimary)] border-[var(--color-borderDefault)] truncate max-w-[90%]">
                        {record.shortcut}
                      </span>
                    )}
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

      {/* Manual Selection Picker Modal */}
      <SnippetLibraryPicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        initialSelectedIds={settings.selectedSnippetIds}
        isCreationMode={false}
        onConfirm={selectedIds => updateSettings({ selectedSnippetIds: selectedIds })}
      />
    </div>
  );
};

export default SnippetLibraryWidget;
