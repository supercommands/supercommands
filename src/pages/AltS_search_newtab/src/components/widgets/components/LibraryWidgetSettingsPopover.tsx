import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useAppearance } from '@extension/ui';
import { LuSettings, LuX, LuCheck, LuSearch, LuEllipsisVertical, LuFileText, LuExternalLink, LuLayoutDashboard } from 'react-icons/lu';
import { CMDOS_WIDGETS_DOCS_URL } from '../../../../../../storage/API/core/apiConfig';
import { useDbStore } from '../../../../../../storage/store/useDbStore';
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
    workspaceId?: string | null;
}
export interface LibraryWidgetSettingsPopoverProps {
    isOpen: boolean;
    onClose: () => void;
    popoverPos: {
        top: number;
        left: number;
    };
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
export const LibraryWidgetSettingsPopover: React.FC<LibraryWidgetSettingsPopoverProps> = ({ isOpen, onClose, popoverPos, popoverRef, triggerBtnRef, widgetType, enableSearch = false, onToggleEnableSearch, sourceMode, onUpdateSourceMode, selectedItemIds, onToggleItemSelection, items, selectedTagIds, onToggleTagSelection, onSetSelectedTagIds, tags, tagMatchMode, onUpdateTagMatchMode, }) => {
    const { theme } = useAppearance();
    const popoverBackground = theme.isDark
        ? 'var(--color-widgetBg)'
        : 'var(--color-contextMenuBg, var(--color-editorBg, var(--color-cardBg)))';
    const [popoverSearchTerm, setPopoverSearchTerm] = useState('');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [calculatedPos, setCalculatedPos] = useState<{
        top: number;
        left: number;
    } | null>(null);
    const dashboardViews = useDbStore(state => state.widgetViews);
    const organisations = useDbStore(state => state.organisations);
    React.useLayoutEffect(() => {
        if (!isOpen || !triggerBtnRef?.current)
            return;
        const updatePosition = () => {
            if (!triggerBtnRef.current)
                return;
            const rect = triggerBtnRef.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const popoverWidth = Math.min(360, viewportWidth - 24);
            // Measure actual rendered popover height if available, or default to 200px
            const actualHeight = popoverRef.current?.offsetHeight || 200;
            // Position top & left relative to viewport (fixed positioning)
            let left = rect.right - popoverWidth;
            if (left + popoverWidth > viewportWidth - 12) {
                left = viewportWidth - popoverWidth - 12;
            }
            if (left < 12) {
                left = 12;
            }
            let top = rect.bottom + 6;
            if (top + actualHeight > viewportHeight - 12) {
                const topAbove = rect.top - actualHeight - 6;
                if (topAbove >= 12) {
                    top = topAbove;
                }
                else {
                    top = Math.max(12, viewportHeight - actualHeight - 12);
                }
            }
            setCalculatedPos({ top, left });
        };
        updatePosition();
        // Re-measure after initial layout render to capture exact popover height
        const rafId = requestAnimationFrame(updatePosition);
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            cancelAnimationFrame(rafId);
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen, triggerBtnRef, sourceMode, tags.length]);
    useEffect(() => {
        if (!isOpen) {
            setPopoverSearchTerm('');
            setIsMenuOpen(false);
            setCalculatedPos(null);
            return;
        }
        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current &&
                !popoverRef.current.contains(e.target as Node) &&
                triggerBtnRef.current &&
                !triggerBtnRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                if (isMenuOpen) {
                    setIsMenuOpen(false);
                }
                else {
                    onClose();
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('keydown', handleKeyDown, true);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [isOpen, isMenuOpen, onClose, popoverRef, triggerBtnRef]);
    const uniqueTags = React.useMemo(() => {
        const map = new Map<string, LibrarySettingsTag>();
        (tags || []).forEach(tag => {
            if (!tag || !tag.name)
                return;
            const key = `${tag.name.trim().toLowerCase()}::${tag.workspaceId || 'global'}`;
            if (!map.has(key)) {
                map.set(key, tag);
            }
        });
        return Array.from(map.values());
    }, [tags]);
    if (!isOpen)
        return null;
    const normalizedSearchTerm = popoverSearchTerm.trim().toLowerCase();
    const filteredTags = uniqueTags.filter(tag => {
        if (!normalizedSearchTerm)
            return true;
        return tag.name.toLowerCase().includes(normalizedSearchTerm);
    });
    const getTagContext = (tag: LibrarySettingsTag) => {
        if (!tag.workspaceId)
            return { group: 'global', organisation: '', view: '' };
        const view = dashboardViews.find(candidate => candidate.id === tag.workspaceId);
        const organisation = view ? organisations.find(candidate => candidate.id === view.organisationId) : null;
        return {
            group: 'dashboard',
            organisation: organisation?.organisationName || 'Organisation',
            view: view?.title || 'Dashboard View',
        };
    };
    const orderedFilteredTags = [...filteredTags].sort((left, right) => {
        const leftContext = getTagContext(left);
        const rightContext = getTagContext(right);
        return ((left.workspaceId ? 1 : 0) - (right.workspaceId ? 1 : 0) ||
            leftContext.organisation.localeCompare(rightContext.organisation) ||
            leftContext.view.localeCompare(rightContext.view) ||
            left.name.localeCompare(right.name));
    });
    const sourceOptions: {
        mode: 'all' | 'tags';
        label: string;
    }[] = [
        { mode: 'all', label: 'All' },
        { mode: 'tags', label: 'Tags' }
    ];
    const handleSourceModeChange = (nextMode: 'all' | 'tags') => {
        setPopoverSearchTerm('');
        onUpdateSourceMode(nextMode);
    };
    const handleOpenDocs = () => {
        const docsUrl = CMDOS_WIDGETS_DOCS_URL;
        const chromeAny = (window as any)?.chrome;
        if (chromeAny?.tabs?.create) {
            chromeAny.tabs.create({ url: docsUrl });
        }
        else {
            window.open(docsUrl, '_blank');
        }
        setIsMenuOpen(false);
    };
    const finalTop = calculatedPos ? calculatedPos.top : popoverPos.top;
    const finalLeft = calculatedPos ? calculatedPos.left : popoverPos.left;
    return ReactDOM.createPortal(<div ref={popoverRef} data-no-widget-drag="true" className="fixed z-[999999] w-[360px] max-w-[calc(100vw-24px)] max-h-[min(520px,calc(100vh-24px))] flex flex-col overflow-visible rounded-2xl border shadow-2xl p-4 gap-3.5 text-xs animate-in fade-in duration-100" style={{
            top: `${finalTop}px`,
            left: `${finalLeft}px`,
            backgroundColor: popoverBackground,
            borderColor: 'var(--color-borderDefault)',
            color: 'var(--color-textPrimary)',
            boxShadow: '0 16px 36px var(--color-popupShadow, rgba(0,0,0,0.4))',
        }}>
      {/* Header */}
      <div className="flex items-center justify-between font-semibold border-b pb-2.5 border-[var(--color-borderDefault)] shrink-0">
        <span className="flex items-center gap-2 text-sm text-[var(--color-textPrimary)] font-bold">
          <LuSettings size={18} className="text-[var(--color-iconDefault,var(--color-textPrimary))]"/>
          Widget Settings
        </span>
        
        <div className="flex items-center gap-1">
          {/* 3-Dots Menu Button */}
          <div className="relative">
            <button type="button" onClick={() => setIsMenuOpen(prev => !prev)} aria-label="More widget options" title="More options" className="p-1 rounded-lg hover:bg-[var(--color-hoverBg,var(--color-bgHover))] text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] cursor-pointer transition-colors">
              <LuEllipsisVertical size={16}/>
            </button>

            {/* 3-Dots Dropdown Menu */}
            {isMenuOpen && (<div className="absolute right-0 top-full mt-1.5 w-64 rounded-xl border p-3 shadow-xl flex flex-col gap-2.5 z-[100] animate-in fade-in zoom-in-95 duration-100" style={{
                backgroundColor: popoverBackground,
                borderColor: 'var(--color-borderDefault)',
                color: 'var(--color-textPrimary)',
                boxShadow: '0 12px 28px var(--color-popupShadow, rgba(0,0,0,0.45))',
            }}>
                {/* Search Toggle Switch Row */}
                <div className="flex items-center justify-between gap-3 px-1 py-0.5">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-[var(--color-textPrimary)]">Search</span>
                    <span className="text-[11px] text-[var(--color-textMuted)] leading-tight">Allow searching within this widget.</span>
                  </div>
                  <button type="button" role="switch" aria-checked={enableSearch} aria-label="Enable search" title={enableSearch ? 'Disable search' : 'Enable search'} onClick={() => onToggleEnableSearch(!enableSearch)} className="widget-settings-search-toggle relative inline-flex h-[22px] w-[40px] shrink-0 cursor-pointer items-center rounded-full border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing,var(--color-borderActive))] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-editorBg)]">
                    <span aria-hidden="true" className={`pointer-events-none block h-[16px] w-[16px] rounded-full transition-transform duration-200 ${enableSearch ? 'translate-x-[19px]' : 'translate-x-[2px]'}`}/>
                  </button>
                </div>

                <div className="h-[1px] w-full bg-[var(--color-borderDefault)] my-0.5"/>

                {/* Docs External Link */}
                <button type="button" onClick={handleOpenDocs} className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg,var(--color-bgHover))] cursor-pointer transition-colors group">
                  <div className="flex items-center gap-2">
                    <LuFileText size={15} className="text-[var(--color-textMuted)] group-hover:text-[var(--color-textPrimary)]"/>
                    <span>Docs</span>
                  </div>
                  <LuExternalLink size={13} className="text-[var(--color-textMuted)] group-hover:text-[var(--color-textPrimary)]"/>
                </button>
              </div>)}
          </div>

          {/* Close Button */}
          <button type="button" onClick={onClose} aria-label="Close widget settings" className="p-1 rounded-lg hover:bg-[var(--color-hoverBg,var(--color-bgHover))] text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] cursor-pointer transition-colors">
            <LuX size={16}/>
          </button>
        </div>
      </div>

      {/* FILTERS Section */}
      <div className="flex flex-col gap-1.5 shrink-0">
        <span className="text-[10px] font-bold text-[var(--color-textMuted)] uppercase tracking-wider">FILTERS</span>
        <div className="grid grid-cols-2 p-1 rounded-xl bg-transparent border border-[var(--color-borderDefault)] gap-1">
          {sourceOptions.map(option => {
            const isSelected = sourceMode === option.mode;
            return (<button key={option.mode} type="button" role="tab" aria-selected={isSelected} aria-pressed={isSelected} onClick={() => handleSourceModeChange(option.mode)} className={`py-1.5 px-3 rounded-lg font-medium text-xs text-center transition-all cursor-pointer select-none ${isSelected
                    ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)] border border-[var(--color-borderActive)] shadow-xs font-semibold'
                    : 'text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg,var(--color-bgHover))] border border-transparent'}`}>
                {option.label}
              </button>);
        })}
        </div>
      </div>

      {/* CONTEXTUAL TAG FILTER CONTENT */}
      {sourceMode === 'tags' && (<div className="-mx-4 -mb-4 flex min-h-0 flex-1 flex-col overflow-hidden border-t border-[var(--color-borderDefault)]">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
            {/* Contextual Search Input */}
            <div className="relative flex w-full shrink-0 items-center border-b border-[var(--color-borderDefault)] px-4 py-2.5 transition-colors focus-within:border-[var(--color-borderActive)]">
              <LuSearch size={14} className="text-[var(--color-textMuted)] shrink-0 mr-2"/>
              <input type="text" value={popoverSearchTerm} onChange={e => setPopoverSearchTerm(e.target.value)} placeholder="Search tags..." className="w-full border-0 bg-transparent text-xs text-[var(--color-textPrimary)] placeholder:text-[var(--color-textPlaceholder,var(--color-textMuted))] outline-none focus:outline-none"/>
              {popoverSearchTerm && (<button type="button" onClick={() => setPopoverSearchTerm('')} className="p-0.5 rounded text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] cursor-pointer shrink-0 transition-colors" aria-label="Clear search">
                  <LuX size={13}/>
                </button>)}
            </div>

            {/* Scrollable List of Tags */}
            <div className="flex min-h-0 max-h-[180px] flex-col gap-1 overflow-y-auto px-3 py-2 widget-settings-thin-scrollbar">
              {tags.length === 0 ? (<div className="p-3 text-center text-xs text-[var(--color-textMuted)]">No tags created.</div>) : filteredTags.length === 0 ? (<div className="p-3 text-center text-xs text-[var(--color-textMuted)]">No matching Tags found.</div>) : (orderedFilteredTags.map(tag => {
                const isChecked = selectedTagIds.includes(tag.id);
                return (<React.Fragment key={tag.id}>
                      <button type="button" role="checkbox" aria-checked={isChecked} onClick={() => {
                        if (onSetSelectedTagIds) {
                            if (isChecked) {
                                onSetSelectedTagIds(selectedTagIds.filter(id => id !== tag.id));
                            }
                            else {
                                onSetSelectedTagIds([...selectedTagIds, tag.id]);
                            }
                        }
                        else {
                            onToggleTagSelection(tag.id);
                        }
                    }} className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-[var(--color-hoverBg,var(--color-bgHover))] cursor-pointer text-left transition-colors select-none group border border-transparent">
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--color-textPrimary)]" title={tag.name}>
                          {tag.workspaceId && <LuLayoutDashboard className="mr-1 inline-block text-[var(--color-textMuted)]" size={12}/>}
                          {tag.name}
                        </span>
                        <div className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center transition-all ${isChecked
                        ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)] border border-[var(--color-borderActive)] shadow-xs'
                        : 'border border-[var(--color-borderDefault)] text-transparent group-hover:border-[var(--color-borderActive)]'}`}>
                          {isChecked && <LuCheck size={12} className="stroke-[2.5]"/>}
                        </div>
                      </button>
                    </React.Fragment>);
            }))}
            </div>
          </div>
        </div>)}
    </div>, document.body);
};
export default LibraryWidgetSettingsPopover;
