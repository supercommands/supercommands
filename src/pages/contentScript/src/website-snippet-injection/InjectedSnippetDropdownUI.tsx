import React from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import StackedLinkIcon from '../../../../shared-components/icons/stackedLinkIcon';
import TextExpanderIcon from '../../../../shared-components/icons/TextExpanderIcon';
import type { NoteItem, PopupPosition } from '../types';
// Icons
const Icons = {
    Edit: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>),
    ArrowUp: () => (<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5"/>
      <polyline points="5 12 12 5 19 12"/>
    </svg>),
    ArrowDown: () => (<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <polyline points="19 12 12 19 5 12"/>
    </svg>),
    Enter: () => (<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 10 4 15 9 20"/>
      <path d="M20 4v7a4 4 0 0 1-4 4H4"/>
    </svg>),
    Link: () => (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px', opacity: 0.7 }}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>),
};
interface InjectedSnippetDropdownUIProps {
    notes: NoteItem[];
    position: PopupPosition;
    onSelect: (note: NoteItem) => void;
    onClose: () => void;
    activeNoteId?: string | null;
    onActiveNoteChange?: (note: NoteItem | null) => void;
    onEdit?: (note: NoteItem) => void;
    externalQuery?: string; // Query from host input (text after //)
    assignedItemsOnly?: boolean;
    verticalOffset?: number;
}
const DEFAULT_POPUP_VERTICAL_OFFSET = 36;
const DESIRED_POPUP_HEIGHT = 320;
const MIN_USABLE_POPUP_HEIGHT = 180;
const VIEWPORT_PADDING = 8;
const InjectedSnippetDropdownUI: React.FC<InjectedSnippetDropdownUIProps> = ({ notes, position, onSelect, onClose, activeNoteId, onActiveNoteChange, onEdit, externalQuery = '', assignedItemsOnly = false, verticalOffset = DEFAULT_POPUP_VERTICAL_OFFSET, }) => {
    const [activeIndex, setActiveIndex] = useState(() => assignedItemsOnly
        ? Math.max(0, notes.findIndex(note => note.id === activeNoteId)) : 0);
    const [flipped, setFlipped] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
    // Use external query for filtering (text typed after // in host input)
    const query = externalQuery;
    const filteredNotes = useMemo(() => {
        if (assignedItemsOnly)
            return notes;
        const snippetNotes = notes.filter(note => {
            const c = note.category?.toLowerCase();
            return c === 'snippet' || c === 'link';
        });
        if (!query.trim()) {
            return snippetNotes;
        }
        const lowered = query.trim().toLowerCase();
        return snippetNotes.filter(note => {
            const titleMatch = note.key.toLowerCase().includes(lowered);
            const valueMatch = note.plainText.toLowerCase().includes(lowered);
            const urlsMatch = note.urls?.some(link => link.url.toLowerCase().includes(lowered) ||
                (link.title || '').toLowerCase().includes(lowered) ||
                (link.name || '').toLowerCase().includes(lowered));
            const tagsMatch = note.tags.some(tag => tag.toLowerCase().includes(lowered));
            return titleMatch || valueMatch || urlsMatch || tagsMatch;
        });
    }, [notes, query, assignedItemsOnly]);
    useEffect(() => {
        if (!activeNoteId)
            return;
        const index = filteredNotes.findIndex(note => note.id === activeNoteId);
        if (index >= 0 && index !== activeIndex)
            setActiveIndex(index);
    }, [activeNoteId, filteredNotes, activeIndex]);
    useEffect(() => {
        onActiveNoteChange?.(filteredNotes[activeIndex]);
    }, [activeIndex, filteredNotes, onActiveNoteChange]);
    useEffect(() => {
        setActiveIndex(prev => {
            if (filteredNotes.length === 0)
                return -1;
            if (prev < 0)
                return 0;
            if (prev > filteredNotes.length - 1)
                return filteredNotes.length - 1;
            return prev;
        });
    }, [filteredNotes]);
    // Scroll active item into view
    useEffect(() => {
        if (activeIndex >= 0 && itemRefs.current[activeIndex]) {
            itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [activeIndex]);
    // Dynamic positioning: flip upwards if not enough space below
    useLayoutEffect(() => {
        if (!containerRef.current)
            return;
        const popupHeight = Math.min(containerRef.current.offsetHeight || DESIRED_POPUP_HEIGHT, DESIRED_POPUP_HEIGHT);
        const viewportY = position.y - window.scrollY;
        const caretHeight = position.caretHeight || 20;
        const caretTopViewport = viewportY - VIEWPORT_PADDING - verticalOffset - caretHeight;
        const availableBelow = window.innerHeight - viewportY - VIEWPORT_PADDING;
        const availableAbove = caretTopViewport - VIEWPORT_PADDING;
        setFlipped(availableBelow < popupHeight &&
            availableAbove > availableBelow &&
            availableAbove >= MIN_USABLE_POPUP_HEIGHT);
    }, [position, filteredNotes.length, verticalOffset]); // Re-calculate if notes change (height changes)
    // Handle keyboard events from the host input (via window listener)
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                onClose();
                return;
            }
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                event.stopPropagation();
                setActiveIndex(prev => {
                    if (filteredNotes.length === 0)
                        return -1;
                    const next = prev + 1;
                    return next > filteredNotes.length - 1 ? 0 : next;
                });
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                event.stopPropagation();
                setActiveIndex(prev => {
                    if (filteredNotes.length === 0)
                        return -1;
                    const next = prev - 1;
                    return next < 0 ? filteredNotes.length - 1 : next;
                });
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                if (activeIndex >= 0 && filteredNotes[activeIndex]) {
                    onSelect(filteredNotes[activeIndex]);
                }
                return;
            }
        };
        // Listen on window to capture keys from host input
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [filteredNotes, activeIndex, onClose, onSelect]);
    const handleSelect = (index: number) => {
        if (index < 0 || index >= filteredNotes.length)
            return;
        onSelect(filteredNotes[index]);
    };
    return (<div ref={containerRef} className="popup-container" style={{
            position: 'fixed', // Use fixed to bypass iframe/doc scrolling offsets and strictly use viewport math
            left: `${position.x - window.scrollX}px`, // Fixed uses viewport left
            margin: 0,
            zIndex: 2147483647,
            ...(flipped
                ? // When flipped, place popup above the caret.
                    // position.y includes caretHeight + 8 + 36 offsets. Undo those to get back to caret top,
                    // then use CSS bottom to grow upward from that point.
                    (() => {
                        const caretH = position.caretHeight || 20;
                        const viewportY = position.y - window.scrollY;
                        const caretTopViewport = viewportY - VIEWPORT_PADDING - verticalOffset - caretH;
                        const availableAbove = Math.max(MIN_USABLE_POPUP_HEIGHT, caretTopViewport - VIEWPORT_PADDING);
                        // Undo the offsets: position.y = rect.bottom + scrollY + 8 + 36
                        // rect.bottom = rect.top + caretH, so caret top in viewport = position.y - scrollY - 8 - 36 - caretH
                        return {
                            bottom: `${window.innerHeight - caretTopViewport + 4}px`,
                            top: 'auto',
                            maxHeight: `${Math.min(DESIRED_POPUP_HEIGHT, availableAbove)}px`,
                        };
                    })()
                : { top: `${position.y - window.scrollY}px`, bottom: 'auto', maxHeight: `${DESIRED_POPUP_HEIGHT}px` }),
        }} onMouseDown={event => {
            // Prevent the host page from focusing elsewhere while interacting with the popup.
            event.stopPropagation();
        }}>
      {/* Header with Logo */}
      <div className="popup-header" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '8px',
            padding: '6px 10px',
        }}>
        <img src={chrome.runtime.getURL('content/supercommands_logo.png')} alt="Logo" style={{ height: '18px', opacity: 1 }}/>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>SuperCommands</span>
      </div>

      {/* No search input - using host input for typing */}

      <div className="popup-list custom-scrollbar">
        {filteredNotes.length === 0 ? (<div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>
            No matching snippets.
          </div>) : (filteredNotes.map((note, index) => {
            const isActive = index === activeIndex;
            const category = note.category?.toLowerCase() || 'snippet';
            const canEdit = category === 'snippet' || category === 'link';
            const linkUrls = note.urls?.map(link => link.url).filter(Boolean) || [];
            return (<div key={`${category}-${note.id}`} ref={el => {
                    itemRefs.current[index] = el;
                }} className={`note-item ${isActive ? 'active' : ''}`} onMouseEnter={() => setActiveIndex(index)} onPointerDown={event => {
                    if (event.pointerType === 'mouse' && event.button !== 0)
                        return;
                    event.preventDefault();
                    event.stopPropagation();
                    handleSelect(index);
                }} onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                }} style={{ position: 'relative', paddingRight: '24px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="note-title" style={{ flex: 1 }}>
                      {(() => {
                    const isLink = category === 'link';
                    const isSnippet = category === 'snippet';
                    const isNote = category === 'note';
                    if (isLink) {
                        return <StackedLinkIcon urls={linkUrls} size={14} fallback="link" className="snippet-link-icon"/>;
                    }
                    if (isNote)
                        return <Icons.Edit />;
                    if (isSnippet)
                        return <TextExpanderIcon size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px', opacity: 0.7 }}/>;
                    return <TextExpanderIcon size={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px', opacity: 0.7 }}/>; // Default to snippet icon if unknown
                })()}
                      {note.key}
                    </div>

                    {/* Item Type Badge */}
                    <span className="type-badge" style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '10px',
                    color: '#6b7280',
                    marginLeft: 'auto',
                    flexShrink: 0,
                    fontWeight: 500,
                    padding: '2px 8px',
                    borderRadius: '99px',
                    background: '#f3f4f6',
                    border: '1px solid #e5e7eb',
                    lineHeight: '16px',
                }}>
                      {(() => {
                    const cat = (note.category || 'Note').toLowerCase();
                    if (cat === 'link') {
                        return (<>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                              </svg>
                              Link
                            </>);
                    }
                    if (cat === 'snippet') {
                        return (<>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="16 18 22 12 16 6"/>
                                <polyline points="8 6 2 12 8 18"/>
                              </svg>
                              Snippet
                            </>);
                    }
                    if (cat === 'note') {
                        return (<>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                              Note
                            </>);
                    }
                    return (<>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="16 18 22 12 16 6"/>
                              <polyline points="8 6 2 12 8 18"/>
                            </svg>
                            {cat}
                          </>);
                })()}
                    </span>
                    {canEdit && (<button className={`menu-trigger ${isActive ? 'active' : ''}`} title={category === 'link' ? 'Edit link' : 'Edit snippet'} aria-label={`Edit ${note.key}`} onPointerDown={event => {
                        event.preventDefault();
                        event.stopPropagation();
                    }} onMouseDown={event => {
                        event.preventDefault();
                        event.stopPropagation();
                    }} onClick={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        onEdit?.(note);
                    }}>
                        <Icons.Edit />
                      </button>)}
                  </div>

                  <div className="note-preview">
                    {(() => {
                    const c = note.category?.toLowerCase();
                    const isLink = c === 'link';
                    if (isLink) {
                        return note.preview.replace(/^https?:\/\//, '');
                    }
                    return note.preview;
                })()}
                  </div>
                  {(() => {
                    const isRawTagId = (t: string) => !t || /^TAG_/i.test(t.trim()) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t.trim());
                    const displayTags = note.tags.filter(t => !isRawTagId(t));
                    if (displayTags.length === 0)
                        return null;
                    return (<div className="note-tags">
                        {displayTags.slice(0, 3).map(tag => (<span key={tag} className="note-tag">
                            {tag}
                          </span>))}
                      </div>);
                })()}
                </div>

              </div>);
        }))}
      </div>

      <div className="popup-footer">
        <div className="shortcut">
          <span className="kbd">
            <Icons.ArrowUp />
          </span>
          <span className="kbd">
            <Icons.ArrowDown />
          </span>
          <span>Navigate</span>
        </div>

        <div className="shortcut">
          <span className="kbd" style={{ color: '#ef4444', borderColor: '#ef4444', background: '#fef2f2' }}>
            Esc
          </span>
          <span>Close</span>
        </div>
      </div>
    </div>);
};
export default InjectedSnippetDropdownUI;
