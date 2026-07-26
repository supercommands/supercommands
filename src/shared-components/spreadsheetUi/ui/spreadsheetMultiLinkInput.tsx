import type React from 'react';
import { useAppearance } from '@extension/ui';
import { useState, useRef, useEffect, useCallback } from 'react';
import { FaPlus, FaTrash, FaHistory, FaBookmark, FaGlobe } from 'react-icons/fa';
import { FiMousePointer } from 'react-icons/fi';
import clsx from 'clsx';

import type { LinkSuggestion } from '../logic/useLinkSuggestions';
import { useLinkSuggestions } from '../logic/useLinkSuggestions';

interface SpreadsheetMultiLinkInputProps {
  initialUrls: string[];
  onSave: (value: string) => void;
  onCancel: () => void;
  suggestionPlacement?: 'top' | 'bottom';
}

export const SpreadsheetMultiLinkInput: React.FC<SpreadsheetMultiLinkInputProps> = ({
  initialUrls,
  onSave,
  onCancel,
  suggestionPlacement = 'top',
}) => {
  const { theme } = useAppearance();
    const [urls, setUrls] = useState<string[]>(initialUrls.length > 0 ? initialUrls : ['']);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(0);
  const [suggestionCursor, setSuggestionCursor] = useState(-1);
  const [isSuggestionsDismissed, setIsSuggestionsDismissed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const plusButtonRef = useRef<HTMLButtonElement>(null);
  const suggestionsListRef = useRef<HTMLDivElement>(null);

  // Hook for suggestions - only active for the focused row
  const activeQuery = focusedIndex !== null && urls[focusedIndex] ? urls[focusedIndex] : '';
  const { suggestions, isLoading } = useLinkSuggestions(activeQuery);
  const suggestionPositionClass = suggestionPlacement === 'bottom' ? 'top-full mt-1' : 'bottom-full mb-1';
  const hasActiveSuggestionPopup = !isSuggestionsDismissed && activeQuery.trim().length > 0;

  // Initial focus
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Final save and exit
  const handleFinalSave = () => {
    const filtered = urls.filter(u => u.trim() !== '');
    if (filtered.length === 0) {
      onSave('');
    } else if (filtered.length === 1) {
      onSave(filtered[0]);
    } else {
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
    if (focusedIndex === null) return;

    if (suggestion.allUrls && suggestion.allUrls.length > 1) {
      // Bulk selection: replace all rows with the full URL set
      setUrls(suggestion.allUrls);
    } else {
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

  const onInputKeyDown = (e: React.KeyboardEvent, index: number) => {
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
      } else {
        handleFinalSave();
      }
    } else if (e.key === 'ArrowDown') {
      if (index < urls.length - 1) {
        e.preventDefault();
        e.stopPropagation();
        inputRefs.current[index + 1]?.focus();
      } else {
        // At last row, move focus to Plus button
        e.preventDefault();
        e.stopPropagation();
        plusButtonRef.current?.focus();
      }
    } else if (e.key === 'ArrowUp') {
      if (index > 0) {
        e.preventDefault();
        e.stopPropagation();
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  return (
    <div
      ref={containerRef}
      className={clsx(
        'flex flex-col w-full link-input-container overflow-visible relative',
        'bg-[var(--color-bgSecondary)] rounded border border-[var(--color-borderDefault)]',
      )}>
      <div
        className={clsx(
          'flex flex-col relative text-left whitespace-normal custom-scrollbar',
          hasActiveSuggestionPopup ? 'overflow-visible max-h-none' : 'max-h-[180px] overflow-y-auto',
        )}>
        {urls.map((url, idx) => {
          const isFocusedRow = focusedIndex === idx;
          const showSuggestions = isFocusedRow && !isSuggestionsDismissed && activeQuery.trim().length > 0;

          return (
            <div
              key={idx}
              className={clsx(
                'flex flex-col relative',
                'border-b border-[var(--color-borderDefault)] bg-transparent',
                isFocusedRow ? 'z-[120]' : 'z-0',
              )}>
              <div className="flex items-center gap-0 group">
                <input
                  ref={el => {
                    inputRefs.current[idx] = el;
                  }}
                  type="text"
                  value={url}
                  onFocus={e => {
                    setFocusedIndex(idx);
                    setSuggestionCursor(-1);
                    if (e.target.value.trim().length > 0) {
                      setIsSuggestionsDismissed(true);
                    }
                  }}
                  onChange={e => handleUpdateUrl(idx, e.target.value)}
                  onKeyDown={e => onInputKeyDown(e, idx)}
                  placeholder="Enter the URL for the links"
                  className={clsx(
                    'flex-1 px-3 py-1.5 text-[11px] outline-none bg-transparent transition-all font-medium',
                    'text-[var(--color-textPrimary)] placeholder:text-[var(--color-textSecondary)]',
                  )}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveUrl(idx)}
                  className={clsx(
                    "px-2 py-1 transition-colors opacity-0 group-hover:opacity-100",
                    "text-neutral-500 hover:text-red-400"
                  )}
                  title="Remove row">
                  <FaTrash size={9} />
                </button>
              </div>

              {/* Suggestion Popup - Shown ABOVE with high z-index */}
              {showSuggestions && activeQuery.trim().length > 0 && (
                <div
                  className={clsx(
                    'absolute left-0 right-0 z-[20000] border shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-100',
                    'bg-[var(--color-bgSecondary)] border-[var(--color-borderDefault)] rounded-md',
                    suggestionPositionClass,
                  )}
                  style={{ minWidth: '100%' }}>
                  <div className={clsx("max-h-[200px] overflow-y-auto custom-scrollbar", "bg-[var(--color-popupBg)]")} ref={suggestionsListRef}>
                    {suggestions.map((s, sIdx) => (
                      <div
                        key={s.id}
                        data-suggestion-index={sIdx}
                        onMouseDown={e => {
                          e.preventDefault();
                          handleSelectSuggestion(s);
                        }}
                        onMouseEnter={() => setSuggestionCursor(sIdx)}
                        className={clsx(
                          'flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors last:border-0',
                          'border-b border-white/5',
                          suggestionCursor === sIdx
                            ? ('bg-white/10 text-white')
                            : 'bg-neutral-900 text-neutral-400 hover:bg-white/5',
                        )}>
                        <div className={clsx(
                          "w-4 h-4 shrink-0 flex items-center justify-center rounded-sm",
                          "bg-white/10"
                        )}>
                          {s.favIconUrl ? (
                            <img
                              src={s.favIconUrl}
                              className="w-3.5 h-3.5 object-contain rounded-sm"
                              alt=""
                              onError={e => {
                                (e.target as any).src = '';
                                (e.target as any).className = 'hidden';
                              }}
                            />
                          ) : (
                            <FaGlobe
                              size={11}
                              className={clsx(suggestionCursor === sIdx ? 'text-white/70' : 'text-slate-400')}
                            />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span
                            className={clsx(
                              'text-[11px] font-semibold truncate leading-tight',
                              suggestionCursor === sIdx ? 'text-white' : ('text-neutral-200'),
                            )}>
                            {s.name}
                          </span>
                          <span
                            className={clsx(
                              'text-[9px] truncate leading-none mt-0.5',
                              suggestionCursor === sIdx ? 'text-white/80' : 'text-slate-400',
                            )}>
                            {s.url}
                          </span>
                        </div>
                        <div className="shrink-0 flex items-center gap-1 text-[10px]">
                          {s.source === 'history' && (
                            <FaHistory
                              size={10}
                              className={suggestionCursor === sIdx ? 'text-white/60' : 'text-slate-300'}
                            />
                          )}
                          {s.source === 'bookmark' && (
                            <FaBookmark
                              size={10}
                              className={suggestionCursor === sIdx ? 'text-white/80' : 'text-amber-400'}
                            />
                          )}
                          {s.source === 'tab' && (
                            <FiMousePointer
                              size={10}
                              className={suggestionCursor === sIdx ? 'text-white/80' : 'text-blue-400'}
                            />
                          )}
                          {s.source === 'saved' && (
                            <FaPlus
                              size={9}
                              className={suggestionCursor === sIdx ? 'text-white/60' : 'text-slate-300'}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={clsx('flex justify-center py-1.5 border-t', 'border-[var(--color-borderDefault)]')}>
        <button
          type="button"
          ref={plusButtonRef}
          onClick={e => {
            e.stopPropagation();
            handleAddUrl();
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              handleAddUrl();
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              inputRefs.current[urls.length - 1]?.focus();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              onCancel();
            }
          }}
          className={clsx(
            'w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400',
            'bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30',
          )}
          title="Add new URL row (Shift+Enter or Arrow Down + Enter)">
          <FaPlus size={10} />
        </button>
      </div>
    </div>
  );
};
