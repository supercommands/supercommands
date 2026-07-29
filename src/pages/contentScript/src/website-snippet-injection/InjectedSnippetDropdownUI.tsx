import type React from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { NoteItem, PopupPosition } from '../types';

// Icons
const Icons = {
  Edit: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  ArrowUp: () => (
    <svg
      width="9"
      height="9"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  ),
  ArrowDown: () => (
    <svg
      width="9"
      height="9"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  ),
  Enter: () => (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round">
      <polyline points="9 10 4 15 9 20" />
      <path d="M20 4v7a4 4 0 0 1-4 4H4" />
    </svg>
  ),
  Code: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px', opacity: 0.7 }}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  Link: () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px', opacity: 0.7 }}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
};

interface InjectedSnippetDropdownUIProps {
  notes: NoteItem[];
  position: PopupPosition;
  onSelect: (note: NoteItem) => void;
  onClose: () => void;
  onEdit?: (note: NoteItem) => void;
  externalQuery?: string; // Query from host input (text after //)
}

const InjectedSnippetDropdownUI: React.FC<InjectedSnippetDropdownUIProps> = ({
  notes,
  position,
  onSelect,
  onClose,
  onEdit,
  externalQuery = '',
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Use external query for filtering (text typed after // in host input)
  const query = externalQuery;

  const filteredNotes = useMemo(() => {
    const snippetNotes = notes.filter(note => {
      const c = note.category?.toLowerCase();
      // Show only snippets
      return c === 'snippet';
    });

    if (!query.trim()) {
      return snippetNotes;
    }

    const lowered = query.trim().toLowerCase();
    return snippetNotes.filter(note => {
      const titleMatch = note.key.toLowerCase().includes(lowered);
      const valueMatch = note.plainText.toLowerCase().includes(lowered);
      const tagsMatch = note.tags.some(tag => tag.toLowerCase().includes(lowered));
      return titleMatch || valueMatch || tagsMatch;
    });
  }, [notes, query]);

  useEffect(() => {
    setActiveIndex(prev => {
      if (filteredNotes.length === 0) return -1;
      if (prev < 0) return 0;
      if (prev > filteredNotes.length - 1) return filteredNotes.length - 1;
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
    if (!containerRef.current) return;

    const popupHeight = containerRef.current.offsetHeight || 300;
    const windowHeight = window.innerHeight;

    // position.y (document-space) already includes scrollY + caretHeight + 8 + 36 (POPUP_VERTICAL_OFFSET)
    // Convert to viewport-space for fixed positioning:
    const viewportY = position.y - window.scrollY;

    // If the popup placed at viewportY would overflow the viewport bottom, flip it above.
    const wouldOverflow = viewportY + popupHeight > windowHeight - 8;
    setFlipped(wouldOverflow);
  }, [position, filteredNotes.length]); // Re-calculate if notes change (height changes)

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
          if (filteredNotes.length === 0) return -1;
          const next = prev + 1;
          return next > filteredNotes.length - 1 ? 0 : next;
        });
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex(prev => {
          if (filteredNotes.length === 0) return -1;
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
    if (index < 0 || index >= filteredNotes.length) return;
    onSelect(filteredNotes[index]);
  };

  return (
    <div
      ref={containerRef}
      className="popup-container"
      style={{
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
              // Undo the offsets: position.y = rect.bottom + scrollY + 8 + 36
              // rect.bottom = rect.top + caretH, so caret top in viewport = position.y - scrollY - 8 - 36 - caretH
              const caretTopViewport = position.y - window.scrollY - 8 - 36 - caretH;
              return {
                bottom: `${window.innerHeight - caretTopViewport + 4}px`,
                top: 'auto',
                maxHeight: `${caretTopViewport - 8}px`,
              };
            })()
          : { top: `${position.y - window.scrollY}px`, bottom: 'auto' }),
      }}
      onMouseDown={event => {
        // Prevent the host page from focusing elsewhere while interacting with the popup.
        event.stopPropagation();
      }}>
      {/* Header with Logo */}
      <div
        className="popup-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: '8px',
          padding: '6px 10px',
        }}>
        <img
          src={chrome.runtime.getURL('content/tasklabs_logo.png')}
          alt="Logo"
          style={{ height: '18px', opacity: 1 }}
        />
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>cmdOS</span>
      </div>

      {/* No search input - using host input for typing */}

      <div className="popup-list custom-scrollbar">
        {filteredNotes.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: '#9ca3af' }}>
            No matching snippets.
          </div>
        ) : (
          filteredNotes.map((note, index) => {
            const isActive = index === activeIndex;

            return (
              <div
                key={note.id}
                ref={el => {
                  itemRefs.current[index] = el;
                }}
                className={`note-item ${isActive ? 'active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => handleSelect(index)}
                style={{ position: 'relative', paddingRight: '24px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="note-title" style={{ flex: 1 }}>
                      {(() => {
                        const c = note.category?.toLowerCase();
                        const isLink = c === 'link';
                        const isSnippet = c === 'snippet';
                        const isNote = c === 'note';

                        if (isLink) {
                          try {
                            // Handle potential JSON values for complex link types if any, though usually simple links here
                            // For safety, we treat value as the URL.
                            // Helper to get favicon
                            const getFavicon = (url: string) => {
                              try {
                                if (!url) return '';
                                // Handle JSON if value is stringified JSON (rare here but possible)
                                if (url.trim().startsWith('{')) {
                                  const parsed = JSON.parse(url);
                                  if (parsed.url) url = parsed.url;
                                  else if (parsed.urls && parsed.urls.length > 0) url = parsed.urls[0];
                                }

                                const cleanDomain = url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
                                const fullUrl = `https://${cleanDomain}`;
                                return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(fullUrl)}&size=128`;
                              } catch (e) {
                                return '';
                              }
                            };

                            const faviconUrl = getFavicon(note.value);
                            if (faviconUrl) {
                              return (
                                <img
                                  src={faviconUrl}
                                  alt=""
                                  style={{
                                    display: 'inline-block',
                                    verticalAlign: 'middle',
                                    marginRight: '6px',
                                    width: '14px',
                                    height: '14px',
                                    borderRadius: '2px',
                                  }}
                                />
                              );
                            }
                          } catch (e) {}
                          return <Icons.Link />;
                        }
                        if (isNote) return <Icons.Edit />;
                        if (isSnippet) return <Icons.Code />;
                        return <Icons.Code />; // Default to snippet icon if unknown
                      })()}
                      {note.key}
                    </div>

                    {/* Item Type Badge */}
                    <span
                      className="type-badge"
                      style={{
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
                          return (
                            <>
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                              </svg>
                              Link
                            </>
                          );
                        }
                        if (cat === 'snippet') {
                          return (
                            <>
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round">
                                <polyline points="16 18 22 12 16 6" />
                                <polyline points="8 6 2 12 8 18" />
                              </svg>
                              Snippet
                            </>
                          );
                        }
                        if (cat === 'note') {
                          return (
                            <>
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                              Note
                            </>
                          );
                        }
                        return (
                          <>
                            <svg
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round">
                              <polyline points="16 18 22 12 16 6" />
                              <polyline points="8 6 2 12 8 18" />
                            </svg>
                            {cat}
                          </>
                        );
                      })()}
                    </span>
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
                    if (displayTags.length === 0) return null;
                    return (
                      <div className="note-tags">
                        {displayTags.slice(0, 3).map(tag => (
                          <span key={tag} className="note-tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* <button
                  className="menu-trigger"
                  title="Edit snippet"
                  onClick={e => {
                    e.stopPropagation();
                    onEdit?.(note);
                  }}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    transition: 'opacity 0.2s',
                  }}>
                  <Icons.Edit />
                </button> */}
              </div>
            );
          })
        )}
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
    </div>
  );
};

export default InjectedSnippetDropdownUI;
