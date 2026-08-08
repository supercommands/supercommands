import type * as React from 'react';
import { useAppearance } from '@extension/ui';
import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSpreadsheetStore } from '../logic/spreadsheetStateStore';
import { motion, AnimatePresence } from 'framer-motion';
import { MdLockOutline } from 'react-icons/md';
import { BsPeopleFill, BsPersonFill } from 'react-icons/bs';
import { DestinationPicker } from '../../../shared-components/editorToolbar/DestinationPicker';
import VariableDropdown from '../../../shared-components/inputs/VariableDropdown';
import { clsx } from 'clsx';
import { SpreadsheetMultiLinkInput } from './spreadsheetMultiLinkInput';
import { useUIStore } from '../../../shared-components/uiStateManager';
import { createNote } from '../../../allObjectFolder/src/createObject/notes/noteData';
import { createLink } from '../../../allObjectFolder/src/createObject/links/linkData';
import { createSnippet } from '../../../allObjectFolder/src/createObject/snippets/snippetData';

import { useFavorites } from '../../../shared-components/favorites/favoriteHooks';
import { useDbStore } from '../../../storage/store/useDbStore';
import { db } from '../../../storage/indexDB/dbConfig';
import { getUserId } from '../../../storage/API/core/api';
import { FaStar, FaCode, FaTerminal, FaCheck, FaTimes, FaFolder, FaChevronDown, FaGlobe } from 'react-icons/fa';
import { FiStar, FiHelpCircle, FiZap, FiGlobe } from 'react-icons/fi';

// Helper to resolve icon strings to emojis (matches SpreadsheetTable logic)
const resolveIcon = (iconStr: string | null | undefined, defaultEmoji: string) => {
  if (!iconStr) return defaultEmoji;
  if (iconStr.startsWith('U+')) {
    try {
      return String.fromCodePoint(parseInt(iconStr.replace('U+', ''), 16));
    } catch (e) {
      return defaultEmoji;
    }
  }
  return defaultEmoji;
};

const SpreadsheetQuickAddModal: React.FC = () => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const { quickAddModal, setQuickAddModal } = useSpreadsheetStore();
  const { theme } = useAppearance();
  const workspaces = useDbStore(s => s.workspaces);
  const folders = useDbStore(s => s.folders);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isEditingLinks, setIsEditingLinks] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toggleFavorite } = useFavorites();

  // Robust State
  const [userId, setUserId] = useState<string | null>(null);
  const [isFav, setIsFav] = useState(false);


  useEffect(() => {
    getUserId().then(id => setUserId(id));
  }, []);
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const folderBtnRef = useRef<HTMLButtonElement>(null);
  const saveBtnRef = useRef<HTMLButtonElement>(null);
  const linkDisplayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Layout Constants for Exact Grid Consistency
  const ROW_HEIGHT = 'min-h-[44px]';
  const NOTE_DESCRIPTION_ROW_HEIGHT = 'min-h-[140px]';
  const FONT_STYLE = 'text-[11px] font-medium';
  const BORDER_COLOR = 'border-[#e1e1e1]';

  // Location State
  const [selectedLocation, setSelectedLocation] = useState<{
    workspaceId: string;
    folderId?: string | null;
  }>({ workspaceId: '' });

  // Variable Dropdown State
  const [isVariableDropdownOpen, setIsVariableDropdownOpen] = useState(false);
  const [variableHighlightIndex, setVariableHighlightIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const [varCounter, setVarCounter] = useState(1);

  const handleVariableSelect = (value: string) => {
    const textarea = contentRef.current as HTMLTextAreaElement | null;
    if (!textarea) return;

    const cursorPosition = textarea.selectionStart;
    const beforeAt = content.substring(0, Math.max(0, cursorPosition - 1));
    const afterAt = content.substring(cursorPosition);

    let insertionText = value;
    if (value === 'custom') {
      insertionText = `{{var${varCounter}}}`;
      setVarCounter(prev => prev + 1);
    }

    const newContent = beforeAt + insertionText + afterAt;
    setContent(newContent);
    const newCursorPos = beforeAt.length + insertionText.length;

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);

    setIsVariableDropdownOpen(false);
  };

  const parseInitialLinkUrls = (rawContent: string): string[] => {
    const trimmed = rawContent.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(v => String(v).trim()).filter(Boolean);
      }
      if (parsed && Array.isArray(parsed.urls)) {
        return parsed.urls.map((v: unknown) => String(v).trim()).filter(Boolean);
      }
    } catch {
      // Fallback for legacy comma-separated single-string storage.
    }

    return trimmed
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);
  };







  const linkPreview = useMemo(() => {
    const urls = parseInitialLinkUrls(content);
    if (urls.length === 0) return { text: '', moreCount: 0 };

    const domains = urls.map(u => {
      try {
        const hostname = new URL(u.startsWith('http') ? u : `https://${u}`).hostname;
        return hostname.replace('www.', '');
      } catch {
        return u;
      }
    });

    return {
      text: domains.slice(0, 3).join(', '),
      moreCount: Math.max(0, domains.length - 3),
    };
  }, [content]);

  useEffect(() => {
    if (quickAddModal.isOpen) {
      setTitle('');
      setContent('');
      setIsSaving(false);

      const initLocation = async () => {
        const primaryKey = quickAddModal.type === 'link' ? 'lastLinkDestination' : 'lastNoteDestination';
        const secondaryKey = quickAddModal.type === 'link' ? 'lastNoteDestination' : 'lastLinkDestination';

        const result: any = await new Promise(res => chrome.storage.local.get([primaryKey, secondaryKey], res));
        const lastDest = result[primaryKey] || result[secondaryKey];

        if (lastDest) {
          const ws = workspaces.find((w: any) => w.id === lastDest.workspace_id);
          if (ws) {
            setSelectedLocation({
              workspaceId: ws.id,
              folderId: lastDest.folder_id || null,
            });
            return;
          }
        }

        if (workspaces.length > 0) {
          const ws = workspaces[0];
          setSelectedLocation({
            workspaceId: ws.id,
            folderId: null,
          });
        }
      };
      initLocation();
    }
  }, [quickAddModal.isOpen, quickAddModal.type]);

  // Handle immediate Focus
  useEffect(() => {
    if (quickAddModal.isOpen) {
      // Small timeout to allow animation to start and DOM to settle
      const timer = setTimeout(() => {
        titleRef.current?.focus();
        titleRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [quickAddModal.isOpen]);

  // Focus trapping and Navigation
  useEffect(() => {
    if (!quickAddModal.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't stop propagation immediately; let internal components handle their keys first.

      // Check navigation keys
      const handledKeys = ['Tab', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Escape', 'Enter'];
      if (!handledKeys.includes(e.key)) return;

      // Stop the event from reaching the background grid (always, to prevent leakage)
      e.stopPropagation();

      // Critical: block other window-level listeners (like SpreadsheetTable global handler)
      // so modal shortcuts don't close the entire sheet.
      if (e.key === 'Escape' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
        e.stopImmediatePropagation();
      }

      // If Picker or Variable Dropdown is Open, let it handle its own keys entirely
      if (isPickerOpen || isVariableDropdownOpen) return;

      // Special case: if focus is inside SpreadsheetMultiLinkInput, let it handle arrows/enter/tab unless Esc
      // We check for 'link-input-container' which is the wrapper inside SpreadsheetMultiLinkInput
      const isInsideLinkInput = document.activeElement?.closest('.link-input-container');
      if (isInsideLinkInput && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(e.key)) {
        return;
      }

      const currentActive = document.activeElement as HTMLElement;
      let secondField: HTMLElement | null = null;
      if (quickAddModal.type === 'link') {
        if (isEditingLinks) {
          // If focus is already inside the link editor, use the current active element to ensure indexOf works
          if (currentActive?.closest('.link-input-container')) {
            secondField = currentActive;
          } else {
            secondField = modalRef.current?.querySelector('input[placeholder*="URL"]') as HTMLElement;
          }
        } else {
          secondField = linkDisplayRef.current;
        }
      } else {
        secondField = contentRef.current;
      }

      const inputs = [titleRef.current, secondField, folderBtnRef.current, saveBtnRef.current].filter(
        Boolean,
      ) as HTMLElement[];

      const activeIdx = inputs.indexOf(currentActive);

      if (e.key === 'Tab') {
        // Only run modal-level Tab logic if we are NOT inside a link input,
        // OR if we are on the first/last input of that component and moving out.
        // For simplicity, we only intercept Tab if it's NOT a link input, or if it's a link input but we want to force jump.
        // Actually, let's keep it simple: if inside link input, let browser handle Tab unless it hits boundaries.
        // But for now, let's just make sure Tab doesn't jump to field 0.
        if (activeIdx === -1) {
          // If we are inside but not found, don't preventDefault, let browser handle it.
          return;
        }
        e.preventDefault();
        const nextIdx = e.shiftKey ? (activeIdx - 1 + inputs.length) % inputs.length : (activeIdx + 1) % inputs.length;
        inputs[nextIdx]?.focus();
      } else if (e.key === 'ArrowDown') {
        // If we are in Link mode and in an input, don't move out unless it's the last one
        if (quickAddModal.type === 'link' && currentActive?.tagName === 'INPUT' && currentActive !== titleRef.current) {
          // Inner Link inputs handle their own internal arrow nav
          return;
        }
        if (activeIdx !== -1 && activeIdx < inputs.length - 1) {
          e.preventDefault();
          inputs[activeIdx + 1]?.focus();
        }
      } else if (e.key === 'ArrowUp') {
        if (quickAddModal.type === 'link' && currentActive?.tagName === 'INPUT' && currentActive !== titleRef.current) {
          // Inner Link inputs handle their own internal arrow nav or exit back to Title
          const linkInputs = Array.from(modalRef.current?.querySelectorAll('input[placeholder*="URL"]') || []);
          if (document.activeElement === linkInputs[0]) {
            e.preventDefault();
            titleRef.current?.focus();
          }
          return;
        }
        if (activeIdx !== -1 && activeIdx > 0) {
          e.preventDefault();
          inputs[activeIdx - 1]?.focus();
        }
      } else if (e.key === 'Enter') {
        const isNoteDescription = activeIdx === 1 && quickAddModal.type === 'note';
        const isLinkCell = activeIdx === 1 && quickAddModal.type === 'link' && !isEditingLinks;

        if (!e.ctrlKey && !e.metaKey) {
          // If on Link cell in Display mode, enter Edit mode
          if (isLinkCell) {
            e.preventDefault();
            setIsEditingLinks(true);
            return;
          }

          // In Title or Folder button or Save button, just save
          if (activeIdx === 0 || activeIdx === 2 || activeIdx === 3) {
            e.preventDefault();
            handleSave();
          }
          // If in Description textarea, standard Enter allows newline,
          // but we can make it save if we want. Sheets usually commits on Enter.
          // For now, let's keep Enter in textarea as "save" unless Shift is held.
          // If in Description area, let Quill handle Enter unless Ctrl/Cmd
          else if (isNoteDescription) {
            if (!e.shiftKey) {
              e.preventDefault();
              handleSave();
            }
          }
        } else {
          // Ctrl+Enter or Cmd+Enter always saves
          e.preventDefault();
          handleSave();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quickAddModal.isOpen, quickAddModal.type, title, content, selectedLocation]);

  useEffect(() => {
    if (!quickAddModal.isOpen) return;
    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      setQuickAddModal(null);
      return true;
    });
    return unregister;
  }, [quickAddModal.isOpen]);

  const handleSave = async (finalContent?: string) => {
    const activeContent = finalContent !== undefined ? finalContent : content;
    if (!title.trim() || (quickAddModal.type !== 'link' && !activeContent.trim()) || !selectedLocation) {
      useUIStore.getState().queueNotification({ message: 'Please fill in all fields', type: 'error' });
      return;
    }

    if (!userId) {
      useUIStore.getState().queueNotification({ message: 'User not identified', type: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      const category = quickAddModal.type || 'note';

      let newId = '';
      if (category === 'link') {
        const link = await createLink({
          title: title.trim(),
          urls: [{ id: `url-${Date.now()}`, url: activeContent.trim(), title: title.trim() }],
          workspaceId: selectedLocation.workspaceId,
          folderId: selectedLocation.folderId || null,
        });
        newId = link.id;
      } else if (category === 'note') {
        const note = await createNote({
          title: title.trim(),
          body: activeContent.trim(),
          workspaceId: selectedLocation.workspaceId,
          folderId: selectedLocation.folderId || null,
        });
        newId = note.id;
      } else {
        const snippet = await createSnippet({
          title: title.trim(),
          config: activeContent.trim(),
          workspaceId: selectedLocation.workspaceId,
          folderId: selectedLocation.folderId || null,
        });
        newId = snippet.id;
      }

      // 2. Favorite Sync
      if (newId && isFav) {
        try {
          await toggleFavorite(newId, 'snippet', title.trim());
        } catch (e) {
          console.error('Favorite sync failed:', e);
        }
      }

      // 4. Update Last Destination
      const storageKey =
        category === 'link'
          ? 'lastLinkDestination'
          : category === 'note'
            ? 'lastNoteDestination'
            : 'lastSnippetDestination';

      await chrome.storage.local.set({
        [storageKey]: {
          workspace_id: selectedLocation.workspaceId,
          folder_id: selectedLocation.folderId,
        },
      });

      useUIStore.getState().queueNotification({ message: `New ${category} added successfully`, type: 'success' });
      // Close the modal on success regardless of specific response structure
      setQuickAddModal(null);
    } catch (error) {
      console.error('Quick add failed:', error);
      useUIStore.getState().queueNotification({ message: 'Failed to add item', type: 'error' });
      setQuickAddModal(null);
    } finally {
      setIsSaving(false);
    }
  };

  if (!quickAddModal.isOpen) return null;

  const isFormValid = title.trim() && (quickAddModal.type === 'link' || content.trim()) && selectedLocation;
  const isSaveDisabled = isSaving || !isFormValid;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          data-ignore-grid-nav="true"
          className={clsx(
            "rounded-md shadow-2xl w-full max-w-lg overflow-visible border flex flex-col",
            "bg-[#000000] border-white/10"
          )}>
          {/* Header - Slim & Precise */}
          <div className={clsx(
            "px-4 py-2 flex items-center justify-between border-b",
            "border-white/10 bg-neutral-900/20"
          )}>
            <h2 className={clsx("text-[11px] font-bold tracking-widest", "text-neutral-400")}>
              Quick Add{' '}
              {quickAddModal.type === 'link'
                ? 'Link'
                : quickAddModal.type === 'note'
                  ? 'Note'
                  : 'Snippet'}
            </h2>
            <button
              onClick={() => setQuickAddModal(null)}
              className={clsx(
                "p-1 rounded transition-all",
                "hover:bg-white/10 text-neutral-500 hover:text-neutral-300"
              )}>
              <FaTimes size={13} />
            </button>
          </div>

          {/* Form - Vertical Split Rhythm */}
          <div className={clsx("flex flex-col relative", "bg-[var(--color-containerBg)]")}>
            {/* Title Row */}
            <div className={clsx(
              'flex items-stretch border-b transition-all relative',
              'border-white/10',
              ROW_HEIGHT
            )}>
              <div className={clsx(
                "w-[45%] px-4 flex items-center border-r",
                "border-white/10 bg-neutral-900/10"
              )}>
                <span className={clsx("text-neutral-400", FONT_STYLE)}>Name</span>
              </div>
              <div className={clsx(
                "w-[55%] flex items-center transition-all relative focus-within:ring-2 focus-within:ring-inset focus-within:z-[50] overflow-visible",
                "focus-within:ring-white/20"
              )}>
                <input
                  ref={titleRef}
                  autoFocus
                  placeholder="Enter title..."
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className={clsx(
                    'w-full h-full bg-transparent outline-none px-3',
                    'text-white placeholder:text-neutral-600',
                    FONT_STYLE,
                  )}
                />
              </div>
            </div>

            {/* Content Row (URL / Description) */}
            <div
              className={clsx(
                'flex items-stretch border-b transition-all relative',
                'border-white/10',
                quickAddModal.type === 'link' ? ROW_HEIGHT : NOTE_DESCRIPTION_ROW_HEIGHT,
              )}>
              <div className={clsx(
                "w-[45%] px-4 flex items-center border-r",
                "border-white/10 bg-neutral-900/10"
              )}>
                <span className={clsx("text-neutral-400", FONT_STYLE)}>
                  {quickAddModal.type === 'link'
                    ? 'Links'
                    : quickAddModal.type === 'note'
                      ? 'Description'
                      : 'Snippet Body'}
                </span>
              </div>
              <div className={clsx(
                "w-[55%] flex flex-col transition-all relative focus-within:ring-2 focus-within:ring-inset focus-within:z-[50]",
                "focus-within:ring-white/20",
                quickAddModal.type === 'link' ? "min-h-[44px]" : "min-h-[140px]"
              )}>
                {quickAddModal.type === 'link' ? (
                  <div
                    ref={linkDisplayRef}
                    className="w-full h-full flex items-center pr-2"
                    tabIndex={!isEditingLinks ? 0 : -1}
                    onFocus={() => {
                      if (!isEditingLinks) setIsEditingLinks(false);
                    }}
                    onClick={() => setIsEditingLinks(true)}>
                    {isEditingLinks ? (
                      <SpreadsheetMultiLinkInput
                        initialUrls={parseInitialLinkUrls(content)}
                        suggestionPlacement="bottom"
                        onSave={val => {
                          setContent(val);
                          setIsEditingLinks(false);
                          setTimeout(() => linkDisplayRef.current?.focus(), 0);
                        }}
                        onCancel={() => {
                          setIsEditingLinks(false);
                          setTimeout(() => linkDisplayRef.current?.focus(), 0);
                        }}
                      />
                    ) : (
                      <div className={clsx(
                        "px-3 py-2 text-[10px] w-full flex items-center gap-1 cursor-pointer transition-colors h-full",
                        "hover:bg-white/10"
                      )}>
                        {content ? (
                          <div className={clsx("flex items-center gap-1.5 w-full min-w-0", "text-neutral-200")}>
                            <FaGlobe className="text-[10px] text-blue-400 shrink-0" />
                            <span className="truncate flex-1">{linkPreview.text}</span>
                          </div>
                        ) : (
                          <span className="text-blue-400 font-medium italic">+ Add URL</span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center w-full h-full p-2 relative">
                    <textarea
                      ref={contentRef}
                      placeholder={
                        quickAddModal.type === 'note'
                          ? 'Enter description...'
                          : 'Enter snippet body...'
                      }
                      value={content}
                      onChange={e => {
                        const val = e.target.value;
                        setContent(val);
                        const cursor = e.target.selectionStart;
                        if (cursor > 0 && val[cursor - 1] === '@') {
                          if (contentRef.current) {
                            const rect = contentRef.current.getBoundingClientRect();
                            setDropdownPosition({ top: rect.top + 35, left: rect.left + 25 });
                            setIsVariableDropdownOpen(true);
                            setVariableHighlightIndex(0);
                          }
                        } else if (isVariableDropdownOpen && (cursor === 0 || val[cursor - 1] !== '@')) {
                          setIsVariableDropdownOpen(false);
                        }
                      }}
                      onKeyDown={e => {
                        if (isVariableDropdownOpen) {
                          if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
                            return; // Let VariableDropdown handle it
                          }
                        }
                      }}
                      rows={5}
                      className={clsx(
                        'w-full h-full bg-transparent outline-none resize-none px-3 py-[10px]',
                        'text-white placeholder:text-neutral-600',
                        FONT_STYLE,
                      )}
                      onInput={e => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = target.scrollHeight + 'px';
                      }}
                    />
                    {isVariableDropdownOpen && dropdownPosition && createPortal(
                      <VariableDropdown
                        position={dropdownPosition}
                        onSelect={handleVariableSelect}
                        onClose={() => setIsVariableDropdownOpen(false)}
                        highlightIndex={variableHighlightIndex}
                        setHighlightIndex={setVariableHighlightIndex}
                      />,
                      document.body
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Folder Selection Row */}
            <div className={clsx(
              'flex items-stretch border-b transition-all relative',
              'border-white/10',
              ROW_HEIGHT
            )}>
              <div className={clsx(
                "w-[45%] px-4 flex items-center border-r",
                "border-white/10 bg-neutral-900/10"
              )}>
                <span className={clsx("text-neutral-400", FONT_STYLE)}>Destination</span>
              </div>
              <div className={clsx(
                "w-[55%] relative flex items-center transition-all focus-within:ring-2 focus-within:ring-inset focus-within:z-[50]",
                "focus-within:ring-white/20"
              )}>
                <button
                  ref={folderBtnRef}
                  onClick={() => setIsPickerOpen(!isPickerOpen)}
                  className="flex items-center gap-2 w-full h-full group text-left outline-none hover:text-blue-500 transition-colors px-3">
                  {selectedLocation?.workspaceId ? (
                    <>
                      <span className="shrink-0 group-hover:text-blue-400">
                        <FaFolder size={11} className="text-[var(--color-iconDefault)]" />
                      </span>
                      <span className={clsx('truncate whitespace-nowrap', "text-neutral-200", FONT_STYLE)}>
                        {(() => {
                          const ws = workspaces.find(w => w.id === selectedLocation.workspaceId);
                          const folder = folders.find(f => f.id === selectedLocation.folderId);
                          if (!ws) return '';
                          return folder ? `${ws.workspaceName} / ${folder.folderName}` : ws.workspaceName;
                        })()}
                      </span>
                    </>
                  ) : (
                    <span className="text-blue-400/70 font-medium italic text-[10px] pl-2 hover:text-blue-500 transition-colors flex items-center gap-1">
                      + Select destination
                    </span>
                  )}
                  <FaChevronDown size={8} className="ml-auto text-[var(--color-iconDefault)]" />
                </button>

                {isPickerOpen && (
                  <div className="absolute bottom-full left-0 z-[110] mb-1">
                    <DestinationPicker
                      selectedWorkspaceId={selectedLocation?.workspaceId || ''}
                      selectedFolderId={selectedLocation?.folderId || ''}
                      onSelectWorkspace={workspaceId => {
                        setSelectedLocation({ workspaceId, folderId: null });
                        setIsPickerOpen(false);
                      }}
                      onSelectFolder={(workspaceId, folderId) => {
                        setSelectedLocation({ workspaceId, folderId });
                        setIsPickerOpen(false);
                      }}
                      onClose={() => setIsPickerOpen(false)}
                      className="!w-full max-h-64"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={clsx(
            "px-4 py-3 border-t flex items-center justify-between gap-3 overflow-hidden",
            "bg-neutral-900/20 border-white/10"
          )}>
            {/* Left: Back Button */}
            <div className="flex items-center">
              <button
                onClick={() => setQuickAddModal(null)}
                className={clsx(
                  "flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors text-[10px] font-bold",
                  "hover:bg-white/10 text-[var(--color-iconDefault)]"
                )}>
                <span>Back</span>
                <span className={clsx(
                  "flex items-center rounded border px-1 py-0 text-[8px] font-bold",
                  "border-neutral-700 bg-neutral-800 text-neutral-500"
                )}>
                  Esc
                </span>
              </button>
            </div>

            {/* Right: Save Button */}
            <div className="flex items-center gap-3">
              <button
                ref={saveBtnRef}
                onClick={() => handleSave()}
                disabled={isSaveDisabled}
                className={clsx(
                  'flex items-center gap-2 rounded-md border px-2 py-1 text-[10px] font-semibold shadow-sm transition-all active:scale-95',
                  isSaveDisabled
                    ? ('border-neutral-800 bg-neutral-900 text-neutral-600')
                    : ('border-neutral-600 bg-neutral-700 text-white hover:bg-neutral-600')
                )}>
                <span>{isSaving ? 'Saving...' : 'Save'}</span>
                <span className="flex items-center gap-0.5 text-[8px] font-semibold opacity-60">
                  <span className={clsx("rounded border px-0.5", "border-white/10 bg-white/5")}>{isMac ? '⌘' : 'Ctrl'}</span>
                  <span>+</span>
                  <span className={clsx("rounded border px-0.5", "border-white/10 bg-white/5")}>Enter</span>
                </span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SpreadsheetQuickAddModal;


