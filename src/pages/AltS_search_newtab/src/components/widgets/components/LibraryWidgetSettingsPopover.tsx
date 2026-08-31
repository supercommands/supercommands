import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { LuSettings, LuX, LuCheck, LuSearch } from 'react-icons/lu';

export interface LibrarySettingsItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconClassName?: string;
}

export interface LibrarySettingsTag {
  id: string;
  name: string;
}

export interface LibraryWidgetSettingsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  popoverPos: { top: number; left: number };
  popoverRef: React.RefObject<HTMLDivElement | null>;
  triggerBtnRef: React.RefObject<HTMLButtonElement | null>;
  widgetType: 'link-library' | 'ai-prompt-library' | 'snippet-library' | 'note-library';
  enableSearch?: boolean;
  onToggleEnableSearch: (next: boolean) => void;
  sourceMode: 'all' | 'manual' | 'tags';
  onUpdateSourceMode: (mode: 'all' | 'manual' | 'tags') => void;
  selectedItemIds: string[];
  onToggleItemSelection: (itemId: string) => void;
  items: LibrarySettingsItem[];
  selectedTagIds: string[];
  onToggleTagSelection: (tagId: string) => void;
  onSetSelectedTagIds?: (tagIds: string[]) => void;
  tags: LibrarySettingsTag[];
  tagMatchMode: 'any' | 'all';
  onUpdateTagMatchMode: (mode: 'any' | 'all') => void;
}

export const LibraryWidgetSettingsPopover: React.FC<LibraryWidgetSettingsPopoverProps> = ({
  isOpen,
  onClose,
  popoverPos,
  popoverRef,
  triggerBtnRef,
  widgetType,
  enableSearch = false,
  onToggleEnableSearch,
  sourceMode,
  onUpdateSourceMode,
  selectedItemIds,
  onToggleItemSelection,
  items,
  selectedTagIds,
  onToggleTagSelection,
  onSetSelectedTagIds,
  tags,
  tagMatchMode,
  onUpdateTagMatchMode,
}) => {
  const [popoverSearchTerm, setPopoverSearchTerm] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setPopoverSearchTerm('');
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerBtnRef.current &&
        !triggerBtnRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, onClose, popoverRef, triggerBtnRef]);

  const uniqueTags = React.useMemo(() => {
    const map = new Map<string, LibrarySettingsTag>();
    (tags || []).forEach(tag => {
      if (!tag || !tag.name) return;
      const key = tag.name.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, tag);
      }
    });
    return Array.from(map.values());
  }, [tags]);

  if (!isOpen) return null;

  const itemSearchPlaceholder =
    widgetType === 'link-library'
      ? 'Search links...'
      : widgetType === 'ai-prompt-library'
        ? 'Search Chat Agents...'
        : widgetType === 'note-library'
          ? 'Search notes...'
          : 'Search text expanders...';

  const noItemsAvailableMessage =
    widgetType === 'link-library'
      ? 'No links available.'
      : widgetType === 'ai-prompt-library'
        ? 'No Chat Agents available.'
        : widgetType === 'note-library'
          ? 'No Notes available.'
          : 'No Text Expanders available.';

  const customNoMatchesMessage =
    widgetType === 'link-library'
      ? 'No matching Links found.'
      : widgetType === 'ai-prompt-library'
        ? 'No matching Chat Agents found.'
        : widgetType === 'note-library'
          ? 'No matching Notes found.'
          : 'No matching Text Expanders found.';

  const normalizedSearchTerm = popoverSearchTerm.trim().toLowerCase();

  const filteredItems = items.filter(item => {
    if (!normalizedSearchTerm) return true;
    return (
      item.title.toLowerCase().includes(normalizedSearchTerm) ||
      (item.subtitle || '').toLowerCase().includes(normalizedSearchTerm)
    );
  });

  const filteredTags = uniqueTags.filter(tag => {
    if (!normalizedSearchTerm) return true;
    return tag.name.toLowerCase().includes(normalizedSearchTerm);
  });

  const sourceOptions: { mode: 'all' | 'manual' | 'tags'; label: string }[] = [
    { mode: 'all', label: 'All' },
    { mode: 'manual', label: 'Custom' },
    { mode: 'tags', label: 'Tags' },
  ];

  const handleSourceModeChange = (nextMode: 'all' | 'manual' | 'tags') => {
    setPopoverSearchTerm('');
    onUpdateSourceMode(nextMode);
  };

  return ReactDOM.createPortal(
    <div
      ref={popoverRef}
      data-no-widget-drag="true"
      className="fixed z-[999999] w-[360px] max-w-[calc(100vw-24px)] max-h-[min(520px,calc(100vh-24px))] flex flex-col overflow-hidden rounded-2xl border shadow-2xl p-4 gap-3.5 text-xs animate-in fade-in duration-100"
      style={{
        top: `${popoverPos.top}px`,
        left: `${popoverPos.left}px`,
        backgroundColor: 'var(--color-contextMenuBg, var(--color-editorBg, var(--color-cardBg)))',
        borderColor: 'var(--color-borderDefault)',
        color: 'var(--color-textPrimary)',
        boxShadow: '0 16px 36px var(--color-popupShadow, var(--color-shadow, rgba(0,0,0,0.4)))',
      }}>
      {/* Header */}
      <div className="flex items-center justify-between font-semibold border-b pb-2.5 border-[var(--color-borderDefault)] shrink-0">
        <span className="flex items-center gap-2 text-sm text-[var(--color-textPrimary)] font-bold">
          <LuSettings size={18} className="text-[var(--color-iconDefault,var(--color-textPrimary))]" />
          Widget Settings
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close widget settings"
          className="p-1 rounded-lg hover:bg-[var(--color-hoverBg,var(--color-bgHover))] text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] cursor-pointer transition-colors">
          <LuX size={16} />
        </button>
      </div>

      {/* SEARCH Section */}
      <div className="flex flex-col gap-1.5 shrink-0">
        <span className="text-[10px] font-bold text-[var(--color-textMuted)] uppercase tracking-wider">SEARCH</span>
        <div className="flex items-center justify-between py-0.5">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-[var(--color-textPrimary)]">Search</span>
            <span className="text-[11px] text-[var(--color-textMuted)]">Allow searching within this widget.</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enableSearch}
            aria-label="Enable search"
            title={enableSearch ? 'Disable search' : 'Enable search'}
            onClick={() => onToggleEnableSearch(!enableSearch)}
            className="widget-settings-search-toggle relative inline-flex h-[22px] w-[40px] shrink-0 cursor-pointer items-center rounded-full border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing,var(--color-borderActive))] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-editorBg)]">
            <span
              aria-hidden="true"
              className={`pointer-events-none block h-[16px] w-[16px] rounded-full transition-transform duration-200 ${
                enableSearch ? 'translate-x-[19px]' : 'translate-x-[2px]'
              }`}
            />
          </button>
        </div>
      </div>

      {/* FILTERS Section */}
      <div className="flex flex-col gap-1.5 shrink-0">
        <span className="text-[10px] font-bold text-[var(--color-textMuted)] uppercase tracking-wider">FILTERS</span>
        <div className="grid grid-cols-3 p-1 rounded-xl bg-transparent border border-[var(--color-borderDefault)] gap-1">
          {sourceOptions.map(option => {
            const isSelected = sourceMode === option.mode;
            return (
              <button
                key={option.mode}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-pressed={isSelected}
                onClick={() => handleSourceModeChange(option.mode)}
                className={`py-1.5 px-3 rounded-lg font-medium text-xs text-center transition-all cursor-pointer select-none ${
                  isSelected
                    ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)] border border-[var(--color-borderActive)] shadow-xs font-semibold'
                    : 'text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg,var(--color-bgHover))] border border-transparent'
                }`}>
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTEXTUAL FILTER CONTENT */}
      {sourceMode !== 'all' && (
        <div className="-mx-4 -mb-4 flex min-h-0 flex-1 flex-col overflow-hidden border-t border-[var(--color-borderDefault)]">
          {/* CUSTOM MODE */}
          {sourceMode === 'manual' && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
            {/* Contextual Search Input */}
            <div className="relative flex w-full shrink-0 items-center border-b border-[var(--color-borderDefault)] px-4 py-2.5 transition-colors focus-within:border-[var(--color-borderActive)]">
              <LuSearch size={14} className="text-[var(--color-textMuted)] shrink-0 mr-2" />
              <input
                type="text"
                value={popoverSearchTerm}
                onChange={e => setPopoverSearchTerm(e.target.value)}
                placeholder={itemSearchPlaceholder}
                className="w-full border-0 bg-transparent text-xs text-[var(--color-textPrimary)] placeholder:text-[var(--color-textPlaceholder,var(--color-textMuted))] outline-none focus:outline-none"
              />
              {popoverSearchTerm && (
                <button
                  type="button"
                  onClick={() => setPopoverSearchTerm('')}
                  className="p-0.5 rounded text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] cursor-pointer shrink-0 transition-colors"
                  aria-label="Clear search">
                  <LuX size={13} />
                </button>
              )}
            </div>

            {/* Scrollable List of Items */}
            <div className="flex min-h-0 max-h-[180px] flex-col gap-1 overflow-y-auto px-3 py-2 widget-settings-thin-scrollbar">
              {items.length === 0 ? (
                <div className="p-3 text-center text-xs text-[var(--color-textMuted)]">{noItemsAvailableMessage}</div>
              ) : filteredItems.length === 0 ? (
                <div className="p-3 text-center text-xs text-[var(--color-textMuted)]">{customNoMatchesMessage}</div>
              ) : (
                filteredItems.map(item => {
                  const isChecked = selectedItemIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="checkbox"
                      aria-checked={isChecked}
                      onClick={() => onToggleItemSelection(item.id)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-[var(--color-hoverBg,var(--color-bgHover))] cursor-pointer text-left transition-colors select-none group border border-transparent">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={item.iconClassName || "w-6 h-6 shrink-0 rounded-md overflow-hidden flex items-center justify-center bg-transparent border border-[var(--color-borderDefault)]"}>
                          {item.icon}
                        </div>
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--color-textPrimary)]" title={item.title}>
                          {item.title}
                        </span>
                      </div>
                      {/* Circular Checkbox / Checkmark */}
                      <div
                        className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center transition-all ${
                          isChecked
                            ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)] border border-[var(--color-borderActive)] shadow-xs'
                            : 'border border-[var(--color-borderDefault)] text-transparent group-hover:border-[var(--color-borderActive)]'
                        }`}>
                        {isChecked && <LuCheck size={12} className="stroke-[2.5]" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            </div>
          )}

          {/* TAGS MODE */}
          {sourceMode === 'tags' && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
            {/* Contextual Search Input */}
            <div className="relative flex w-full shrink-0 items-center border-b border-[var(--color-borderDefault)] px-4 py-2.5 transition-colors focus-within:border-[var(--color-borderActive)]">
              <LuSearch size={14} className="text-[var(--color-textMuted)] shrink-0 mr-2" />
              <input
                type="text"
                value={popoverSearchTerm}
                onChange={e => setPopoverSearchTerm(e.target.value)}
                placeholder="Search tags..."
                className="w-full border-0 bg-transparent text-xs text-[var(--color-textPrimary)] placeholder:text-[var(--color-textPlaceholder,var(--color-textMuted))] outline-none focus:outline-none"
              />
              {popoverSearchTerm && (
                <button
                  type="button"
                  onClick={() => setPopoverSearchTerm('')}
                  className="p-0.5 rounded text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] cursor-pointer shrink-0 transition-colors"
                  aria-label="Clear search">
                  <LuX size={13} />
                </button>
              )}
            </div>

            {/* Scrollable List of Tags */}
            <div className="flex min-h-0 max-h-[180px] flex-col gap-1 overflow-y-auto px-3 py-2 widget-settings-thin-scrollbar">
              {tags.length === 0 ? (
                <div className="p-3 text-center text-xs text-[var(--color-textMuted)]">No tags created.</div>
              ) : filteredTags.length === 0 ? (
                <div className="p-3 text-center text-xs text-[var(--color-textMuted)]">No matching Tags found.</div>
              ) : (
                filteredTags.map(tag => {
                  const sameNameTagIds = tags
                    .filter(t => t.name.trim().toLowerCase() === tag.name.trim().toLowerCase())
                    .map(t => t.id);
                  const isChecked = sameNameTagIds.some(id => selectedTagIds.includes(id));
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      role="checkbox"
                      aria-checked={isChecked}
                      onClick={() => {
                        if (onSetSelectedTagIds) {
                          if (isChecked) {
                            onSetSelectedTagIds(selectedTagIds.filter(id => !sameNameTagIds.includes(id)));
                          } else {
                            onSetSelectedTagIds([...selectedTagIds, ...sameNameTagIds]);
                          }
                        } else {
                          onToggleTagSelection(tag.id);
                        }
                      }}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-[var(--color-hoverBg,var(--color-bgHover))] cursor-pointer text-left transition-colors select-none group border border-transparent">
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--color-textPrimary)]" title={tag.name}>
                        {tag.name}
                      </span>
                      {/* Circular Checkbox / Checkmark */}
                      <div
                        className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center transition-all ${
                          isChecked
                            ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)] border border-[var(--color-borderActive)] shadow-xs'
                            : 'border border-[var(--color-borderDefault)] text-transparent group-hover:border-[var(--color-borderActive)]'
                        }`}>
                        {isChecked && <LuCheck size={12} className="stroke-[2.5]" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            </div>
          )}
        </div>
      )}
    </div>,
    document.body,
  );
};

export default LibraryWidgetSettingsPopover;
