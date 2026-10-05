import React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { FaPlus, FaTrash, FaHistory, FaBookmark, FaGlobe } from 'react-icons/fa';
import { FiMousePointer } from 'react-icons/fi';
import clsx from 'clsx';
import type { LinkSuggestion } from '../logic/useLinkSuggestions';
import { useLinkSuggestions } from '../logic/useLinkSuggestions';
import { getFaviconUrl } from '../../../shared-components/searchBarMain/utilityFunctions/utils';
interface SpreadsheetMultiLinkInputProps {
    initialUrls: string[];
    onSave: (value: string) => void;
    onCancel: () => void;
    onNavigateFromCleanEdit?: (rowDelta: number, colDelta: number) => void;
    navigateOnCleanArrow?: boolean;
    onCommit?: () => void;
    suggestionPlacement?: 'top' | 'bottom';
    expandedWidth?: string;
}
export const SpreadsheetMultiLinkInput: React.FC<SpreadsheetMultiLinkInputProps> = ({ initialUrls, onSave, onCancel, onNavigateFromCleanEdit, navigateOnCleanArrow = true, onCommit, suggestionPlacement = 'top', expandedWidth = '100%', }) => {
    const [urls, setUrls] = useState<string[]>(initialUrls.length > 0 ? initialUrls : ['']);
    const [focusedIndex, setFocusedIndex] = useState<number | null>(0);
    const [suggestionCursor, setSuggestionCursor] = useState(-1);
    const [isSuggestionsDismissed, setIsSuggestionsDismissed] = useState(false);
    const [failedIconUrls, setFailedIconUrls] = useState<Record<string, boolean>>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const plusButtonRef = useRef<HTMLButtonElement>(null);
    const suggestionsListRef = useRef<HTMLDivElement>(null);
    // Hook for suggestions - only active for the focused row
    const activeQuery = focusedIndex !== null && urls[focusedIndex] ? urls[focusedIndex] : '';
    const { suggestions } = useLinkSuggestions(activeQuery);
    const suggestionPositionClass = suggestionPlacement === 'bottom' ? 'top-full mt-1' : 'bottom-full mb-1';
    const hasActiveSuggestionPopup = !isSuggestionsDismissed && activeQuery.trim().length > 0;
    // Initial focus
    useEffect(() => {
        const timer = setTimeout(() => {
            const input = inputRefs.current[0];
            if (!input)
                return;
            input.focus();
            const end = input.value.length;
            input.setSelectionRange(end, end);
            input.scrollLeft = input.scrollWidth;
        }, 50);
        return () => clearTimeout(timer);
    }, []);
    // Final save and exit
    const handleFinalSave = () => {
        const filtered = urls.filter(u => u.trim() !== '');
        if (filtered.length === 0) {
            onSave('');
        }
        else if (filtered.length === 1) {
            onSave(filtered[0]);
        }
        else {
            onSave(JSON.stringify({ urls: filtered, names: filtered.map(() => '') }));
        }
    };
    const handleUpdateUrl = (index: number, val: string) => {
        const newUrls = [...urls];
        newUrls[index] = val;
        setUrls(newUrls);
        setIsSuggestionsDismissed(false); // Re-enable suggestions on type
        setSuggestionCursor(-1); // Changed from 0 to -1 to avoid accidental 'Enter' selection
    };
    const handleSelectSuggestion = (suggestion: LinkSuggestion) => {
        if (focusedIndex === null)
            return;
        if (suggestion.allUrls && suggestion.allUrls.length > 1) {
            // Bulk selection: replace all rows with the full URL set
            setUrls(suggestion.allUrls);
        }
        else {
            // Single selection: just update current row
            const next = [...urls];
            next[focusedIndex] = suggestion.url;
            setUrls(next);
        }
        setSuggestionCursor(-1);
        setIsSuggestionsDismissed(true); // BREAK the cycle: hide suggestions after selection
        // Maintain focus but clear suggestions
        setTimeout(() => {
            inputRefs.current[focusedIndex]?.focus();
        }, 10);
    };
    // Ensure selected suggestion is visible during keyboard navigation
    useEffect(() => {
        if (suggestionCursor !== -1 && suggestionsListRef.current) {
            const selected = suggestionsListRef.current.querySelector(`[data-suggestion-index="${suggestionCursor}"]`);
            if (selected) {
                selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [suggestionCursor]);
    const handleAddUrl = () => {
        const next = [...urls, ''];
        setUrls(next);
        setTimeout(() => {
            inputRefs.current[urls.length]?.focus();
        }, 50);
    };
    const handleRemoveUrl = (index: number) => {
        if (urls.length === 1) {
            setUrls(['']);
            return;
        }
        const next = urls.filter((_, i) => i !== index);
        setUrls(next);
        const nextToFocus = index > 0 ? index - 1 : 0;
        setTimeout(() => {
            inputRefs.current[nextToFocus]?.focus();
        }, 50);
    };
    const getNormalizedUrl = useCallback((rawUrl: string) => {
        const trimmed = rawUrl.trim();
        if (!trimmed)
            return '';
        return trimmed
            .replace(/^https?:\/\//i, '')
            .replace(/^www\./i, '')
            .replace(/\/$/i, '')
            .toLowerCase();
    }, []);
    const getLinkTitle = useCallback((rawUrl: string) => {
        const normalizedUrl = getNormalizedUrl(rawUrl);
        const matchedSuggestion = suggestions.find(s => getNormalizedUrl(s.url) === normalizedUrl);
        if (matchedSuggestion?.name)
            return matchedSuggestion.name;
        try {
            const parsed = new URL(rawUrl.trim().startsWith('http') ? rawUrl.trim() : `https://${rawUrl.trim()}`);
            const hostname = parsed.hostname.replace(/^www\./i, '');
            const [namePart] = hostname.split('.');
            return namePart
                ? namePart
                    .split(/[-_]/)
                    .filter(Boolean)
                    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                    .join(' ')
                : hostname;
        }
        catch {
            return rawUrl.trim() || 'New link';
        }
    }, [getNormalizedUrl, suggestions]);
    const onInputKeyDown = (e: React.KeyboardEvent, index: number) => {
        const arrowDeltas: Record<string, [
            number,
            number
        ]> = {
            ArrowUp: [-1, 0],
            ArrowDown: [1, 0],
            ArrowLeft: [0, -1],
            ArrowRight: [0, 1],
        };
        const arrowDelta = arrowDeltas[e.key];
        const normalizedInitialUrls = initialUrls.length > 0 ? initialUrls : [''];
        const isClean = urls.length === normalizedInitialUrls.length &&
            urls.every((url, urlIndex) => url === normalizedInitialUrls[urlIndex]);
        if (navigateOnCleanArrow && arrowDelta && isClean && onNavigateFromCleanEdit) {
            e.preventDefault();
            e.stopPropagation();
            onNavigateFromCleanEdit(...arrowDelta);
            return;
        }
        // If suggestions are active (not dismissed and query is non-empty)
        const isSearchUIActive = !isSuggestionsDismissed && activeQuery.trim().length > 0;
        if (isSearchUIActive) {
            if (e.key === 'ArrowDown' && suggestions.length > 0) {
                e.preventDefault();
                setSuggestionCursor(prev => Math.min(prev + 1, suggestions.length - 1));
                return;
            }
            if (e.key === 'ArrowUp' && suggestions.length > 0) {
                e.preventDefault();
                setSuggestionCursor(prev => Math.max(prev - 1, 0));
                return;
            }
            if (e.key === 'Enter' && suggestions.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                const indexToSelect = suggestionCursor >= 0 ? suggestionCursor : 0;
                handleSelectSuggestion(suggestions[indexToSelect]);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation(); // Stop the global SpreadsheetMainContainer listener from closing the editor
                setIsSuggestionsDismissed(true);
                setSuggestionCursor(-1);
                return;
            }
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation(); // Stop global SpreadsheetMainContainer listener from closing the editor
            if (e.shiftKey) {
                handleAddUrl();
            }
            else {
                handleFinalSave();
                onCommit?.();
            }
        }
        else if (e.key === 'ArrowDown') {
            if (index < urls.length - 1) {
                e.preventDefault();
                e.stopPropagation();
                inputRefs.current[index + 1]?.focus();
            }
            else {
                // At last row, move focus to Plus button
                e.preventDefault();
                e.stopPropagation();
                plusButtonRef.current?.focus();
            }
        }
        else if (e.key === 'ArrowUp') {
            if (index > 0) {
                e.preventDefault();
                e.stopPropagation();
                inputRefs.current[index - 1]?.focus();
            }
        }
        else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
        }
    };
    return (<div ref={containerRef} style={{ width: expandedWidth, maxWidth: 'calc(100vw - 96px)' }} className={clsx('flex flex-col max-w-none link-input-container overflow-visible relative', 'bg-[var(--color-bgSecondary)] rounded border border-[var(--color-borderDefault)]')}>
      <div className={clsx('flex flex-col relative text-left whitespace-normal custom-scrollbar', hasActiveSuggestionPopup ? 'overflow-visible max-h-none' : 'max-h-[180px] overflow-y-auto')}>
        {urls.map((url, idx) => {
            const isFocusedRow = focusedIndex === idx;
            const showSuggestions = isFocusedRow && !isSuggestionsDismissed && activeQuery.trim().length > 0;
            const normalizedIconUrl = getNormalizedUrl(url);
            const showFavicon = url.trim() && !failedIconUrls[normalizedIconUrl];
            const linkTitle = getLinkTitle(url);
            return (<div key={idx} className={clsx('flex flex-col relative', 'border-b border-[var(--color-borderDefault)] bg-transparent', isFocusedRow ? 'z-[120]' : 'z-0')}>
              <div className="grid grid-cols-[22px_minmax(0,1fr)_22px] items-center gap-2 px-2 py-1.5 group">
                <div className="w-5 h-5 shrink-0 flex items-center justify-center rounded bg-[var(--color-inputBg)] overflow-hidden">
                  {showFavicon ? (<img src={getFaviconUrl(url)} alt="" className="w-4 h-4 object-contain rounded-sm" onError={() => setFailedIconUrls(prev => ({ ...prev, [normalizedIconUrl]: true }))}/>) : (<FaGlobe size={11} className="text-[var(--color-iconDefault)]"/>)}
                </div>
                <div className="grid grid-cols-[minmax(72px,0.75fr)_minmax(96px,1fr)] items-center gap-2 min-w-0">
                  <span className="text-[11px] font-semibold leading-tight truncate text-[var(--color-textPrimary)]" title={linkTitle}>
                    {linkTitle}
                  </span>
                  <input ref={el => {
                    inputRefs.current[idx] = el;
                }} type="text" value={url} onFocus={e => {
                    setFocusedIndex(idx);
                    setSuggestionCursor(-1);
                    if (e.target.value.trim().length > 0) {
                        setIsSuggestionsDismissed(true);
                    }
                }} onChange={e => handleUpdateUrl(idx, e.target.value)} onKeyDown={e => onInputKeyDown(e, idx)} placeholder="Enter the URL for the links" className={clsx('min-w-0 px-0 py-0.5 text-[11px] outline-none bg-transparent transition-all font-medium', 'text-[var(--color-textPrimary)] placeholder:text-[var(--color-textSecondary)]')} title={url}/>
                </div>
                <button type="button" onClick={() => handleRemoveUrl(idx)} className={clsx('w-5 h-5 flex items-center justify-center rounded transition-colors opacity-0 group-hover:opacity-100', 'text-[var(--color-iconDefault)] hover:text-[var(--color-error)]')} title="Remove row">
                  <FaTrash size={9}/>
                </button>
              </div>

              {/* Suggestion Popup - Shown ABOVE with high z-index */}
              {showSuggestions && activeQuery.trim().length > 0 && (<div className={clsx('absolute left-0 right-0 z-[20000] border shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-100', 'bg-[var(--color-bgSecondary)] border-[var(--color-borderDefault)] rounded-md', suggestionPositionClass)} style={{ minWidth: '100%' }}>
                  <div className={clsx('max-h-[200px] overflow-y-auto custom-scrollbar', 'bg-[var(--color-popupBg)]')} ref={suggestionsListRef}>
                    {suggestions.map((s, sIdx) => (<div key={s.id} data-suggestion-index={sIdx} onMouseDown={e => {
                            e.preventDefault();
                            handleSelectSuggestion(s);
                        }} onMouseEnter={() => setSuggestionCursor(sIdx)} className={clsx('flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors last:border-0', 'border-b border-[var(--color-borderDefault)]', suggestionCursor === sIdx
                            ? 'bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]'
                            : 'bg-[var(--color-popupBg)] text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)]')}>
                        <div className={clsx('w-4 h-4 shrink-0 flex items-center justify-center rounded-sm', 'bg-[var(--color-inputBg)]')}>
                          {s.favIconUrl ? (<img src={s.favIconUrl} className="w-3.5 h-3.5 object-contain rounded-sm" alt="" onError={e => {
                                (e.target as any).src = '';
                                (e.target as any).className = 'hidden';
                            }}/>) : (<FaGlobe size={11} className={clsx(suggestionCursor === sIdx
                                ? 'text-[var(--color-textPrimary)]'
                                : 'text-[var(--color-iconDefault)]')}/>)}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className={clsx('text-[11px] font-semibold truncate leading-tight', suggestionCursor === sIdx
                            ? 'text-[var(--color-textPrimary)]'
                            : 'text-[var(--color-textPrimary)]')}>
                            {s.name}
                          </span>
                          <span className={clsx('text-[9px] truncate leading-none mt-0.5', suggestionCursor === sIdx
                            ? 'text-[var(--color-textSecondary)]'
                            : 'text-[var(--color-textSecondary)]')}>
                            {s.url}
                          </span>
                        </div>
                        <div className="shrink-0 flex items-center gap-1 text-[10px]">
                          {s.source === 'history' && (<FaHistory size={10} className={suggestionCursor === sIdx
                                ? 'text-[var(--color-textSecondary)]'
                                : 'text-[var(--color-iconDefault)]'}/>)}
                          {s.source === 'bookmark' && (<FaBookmark size={10} className={suggestionCursor === sIdx ? 'text-[var(--color-textSecondary)]' : 'text-amber-400'}/>)}
                          {s.source === 'tab' && (<FiMousePointer size={10} className={suggestionCursor === sIdx ? 'text-[var(--color-textSecondary)]' : 'text-blue-400'}/>)}
                          {s.source === 'saved' && (<FaPlus size={9} className={suggestionCursor === sIdx
                                ? 'text-[var(--color-textSecondary)]'
                                : 'text-[var(--color-iconDefault)]'}/>)}
                        </div>
                      </div>))}
                  </div>
                </div>)}
            </div>);
        })}
      </div>

      <div className={clsx('flex justify-center py-1.5 border-t', 'border-[var(--color-borderDefault)]')}>
        <button type="button" ref={plusButtonRef} onClick={e => {
            e.stopPropagation();
            handleAddUrl();
        }} onKeyDown={e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                handleAddUrl();
            }
            else if (e.key === 'ArrowUp') {
                e.preventDefault();
                inputRefs.current[urls.length - 1]?.focus();
            }
            else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
            }
        }} className={clsx('w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400', 'bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-[var(--color-textPrimary)] border border-emerald-500/30')} title="Add new URL row (Shift+Enter or Arrow Down + Enter)">
          <FaPlus size={10}/>
        </button>
      </div>
    </div>);
};
