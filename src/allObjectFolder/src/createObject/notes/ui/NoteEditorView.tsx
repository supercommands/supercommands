import React, { useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { EditorContainer } from '../../../../../shared-components/editorContainer/EditorContainer';
import { useNoteEditor } from '../useNoteEditor';
import { normalizeNoteBody, extractTextFromHTML } from '../noteHelpers';
import TextEditor from '../../../../../shared-components/TextEditor';
import { SharedPropertiesToolbar } from '../../../../../shared-components/editorToolbar/SharedPropertiesToolbar';
import DeleteConfirmation from '../../../../../shared-components/modals/deleteDialog';
import UnsavedChangesDialog from '../../../../../shared-components/modals/unsavedChangesDialog';
import { FaTimes, FaPen, FaTrash } from 'react-icons/fa';
import { FiSearch, FiBookmark, FiChevronRight, FiChevronDown } from 'react-icons/fi';
import { AutoSaveIndicator } from '../../../../../shared-components/autoSaveEngine/autoSave';
import type { SharedProperties } from '../../../../../shared-components/editorToolbar/types';
import { createTodo } from '../../todos/todoData';
import { deleteNote } from '../noteData';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { getItemCompoundId } from '../../../../../shared-components/hotkeys/utils/hotkeyUtils';
export interface NoteEditorViewProps {
  noteId?: string | null;
  onBack?: () => void;
  initialDraftKey?: string;
  initialDraftContent?: string;
  isFullScreenMode?: boolean;
}

export function NoteEditorView(props: NoteEditorViewProps) {
  const { isFullScreenMode = false } = props;
  const [isForceCreateNew, setIsForceCreateNew] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

  // Sidebar States & DB Store Selectors
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(props.noteId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSavedNotesExpanded, setIsSavedNotesExpanded] = useState(true);
  const [isRightPanelHovered, setIsRightPanelHovered] = useState(false);
  const [noteToDeleteId, setNoteToDeleteId] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [pendingLoadNoteId, setPendingLoadNoteId] = useState<string | null>(null);
  const [isUnsavedLoadDialogOpen, setIsUnsavedLoadDialogOpen] = useState(false);

  const notes = useDbStore(state => state.notes);

  const filteredNotes = React.useMemo(() => {
    let list = [...notes];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(n => {
        const titleMatch = (n.title || '').toLowerCase().includes(q);
        const plainText = n.body ? extractTextFromHTML(n.body) : '';
        const bodyMatch = plainText.toLowerCase().includes(q);
        return titleMatch || bodyMatch;
      });
    }
    return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [notes, searchQuery]);

  React.useEffect(() => {
    setSelectedNoteId(props.noteId || null);
    if (props.noteId) {
      setIsForceCreateNew(false);
    }
  }, [props.noteId]);

  const editorProps = React.useMemo(() => {
    if (isForceCreateNew) {
      return {
        ...props,
        noteId: null,
        initialDraftKey: undefined,
        initialDraftContent: undefined,
      };
    }
    return {
      ...props,
      noteId: selectedNoteId,
    };
  }, [props, isForceCreateNew, selectedNoteId]);

  const state = useNoteEditor(editorProps);

  const handleLoadNote = useCallback(async (id: string) => {
    if (state.isDirty) {
      setPendingLoadNoteId(id);
      setIsUnsavedLoadDialogOpen(true);
    } else {
      setIsForceCreateNew(false);
      setSelectedNoteId(id);
    }
  }, [state.isDirty]);

  const handleDeleteClickFromList = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setNoteToDeleteId(id);
    setIsDeleteConfirmOpen(true);
  }, []);

  const handleConfirmDeleteFromList = useCallback(async () => {
    if (!noteToDeleteId) return;
    try {
      await deleteNote(noteToDeleteId);
      if (noteToDeleteId === selectedNoteId) {
        setIsForceCreateNew(true);
        state.resetEditor();
      }
    } catch (err) {
      console.error('Failed to delete note from list', err);
    } finally {
      setIsDeleteConfirmOpen(false);
      setNoteToDeleteId(null);
    }
  }, [noteToDeleteId, selectedNoteId, state]);
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarIdRef = React.useRef(`note-toolbar-${Math.random().toString(36).slice(2, 10)}`);
  const defaultToolbarNameRef = React.useRef(state.noteTitle);
  const toolbarSelector = `#${toolbarIdRef.current}`;
  const noteCompoundId = React.useMemo(() => {
    if (!state.activeNoteId) return '';

    return getItemCompoundId({
      id: state.activeNoteId,
      workspace_id: state.workspaceId || undefined,
      folder_id: state.folderId || undefined,
      snippet: {
        id: state.activeNoteId,
        category: 'note',
      },
    });
  }, [state.activeNoteId, state.workspaceId, state.folderId]);

  const isFocusMode = useUIStore((s: any) => s.isFocusMode);
  const isEmbedded = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === 'true';

  const tagIdsKey = React.useMemo(() => [...state.tagIds].sort().join('|'), [state.tagIds]);
  const initialProperties = React.useMemo(() => {
    return {
      id: state.activeNoteId,
      title: state.noteTitle,
      workspaceId: state.workspaceId,
      folderId: state.folderId,
      tags: [...state.tagIds].sort().map((id: string) => ({ id: id, name: '' })),
    };
  }, [state.activeNoteId, state.noteTitle, state.workspaceId, state.folderId, tagIdsKey]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      const input = state.titleInputRef.current;
      if (input) {
        input.focus();
        const length = input.value.length;
        input.setSelectionRange(length, length);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [state.titleInputRef]);

  React.useEffect(() => {
    defaultToolbarNameRef.current = state.noteTitle;
  }, [state.activeNoteId, state.noteTitle]);

  const handleCreateNew = useCallback(async () => {
    // Save current note before creating new, guaranteeing all pending changes are written
    if (state.flushSave) {
      await state.flushSave();
    } else {
      await state.handleSave();
    }

    setIsForceCreateNew(true);
    setShowTooltip(false);
    state.resetEditor();
    defaultToolbarNameRef.current = '';
    if (state.titleInputRef.current) {
      state.titleInputRef.current.focus();
    }
  }, [state, setShowTooltip]);

  React.useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      // Create New Shortcut strictly on Ctrl+Shift+Enter
      if (event.ctrlKey && event.shiftKey && event.key === 'Enter') {
        event.preventDefault();
        handleCreateNew();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [handleCreateNew]);

  const handleDeleteClick = React.useCallback(() => {
    state.setIsDeleteDialogOpen(true);
  }, [state.setIsDeleteDialogOpen]);

  const onDeleteProp = state.activeNoteId ? handleDeleteClick : undefined;

  if (state.activeNoteId && state.liveNote === undefined && !state.isNoteDeleted) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen bg-[var(--color-editorBg)] text-neutral-900 dark:text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 border-4 border-[var(--color-borderDefault)] border-t-neutral-900 dark:border-t-white rounded-full animate-spin" />
          <p className="text-lg font-medium">Loading note...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <EditorContainer
        ref={containerRef}
        className={`w-full h-full flex flex-col gap-1 text-left text-neutral-900 dark:text-white bg-transparent ${isFullScreenMode || isEmbedded ? '' : 'px-6 md:px-12 lg:px-24 py-4'
          }`}
        innerClassName={`flex flex-col relative bg-[var(--color-editorBg)] ${isFullScreenMode
          ? 'w-full rounded-none h-full max-h-none'
          : 'w-[calc(100%-100px)] max-w-[1200px] mx-auto rounded-xl h-[860px] max-h-[90vh] overflow-hidden'
          } ${isFocusMode || isFullScreenMode ? 'border-none' : 'border border-black/5 dark:border-white/10'
          }`}
      >
        {state.isNoteDeleted ? (
          <div className="flex-1 min-h-0 flex items-center justify-center px-6 py-10">
            <div className="max-w-md w-full rounded-2xl border border-red-200/70 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 p-6 text-center shadow-sm">
              <div className="text-lg font-semibold text-red-700 dark:text-red-300">This note was deleted in another tab.</div>
              <div className="mt-2 text-sm text-red-600/90 dark:text-red-200/80">
                The editor is disabled to avoid saving stale content.
              </div>
              <button
                type="button"
                onClick={state.handleClose}
                className="mt-5 inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Back
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex overflow-visible flex-col bg-transparent text-neutral-900 dark:text-white">
            <div className="flex-1 flex min-h-0 relative">
              {isFullScreenMode && <div className="h-20 flex-shrink-0" />}

              {/* Main Workspace Left Side */}
              <div className="flex-grow flex flex-col min-h-0 relative">
                <div className="absolute top-2.5 right-2 md:top-2.5 md:right-2 z-50 flex items-center gap-3">
                  <div className="transition-opacity duration-300">
                    <AutoSaveIndicator
                      saveStatus={state.saveStatus}
                      lastSavedAt={state.lastSavedAt}
                      activeId={state.activeNoteId}
                    />
                  </div>

                  {state.conflictNote && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 shadow-sm dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100">
                      <div className="font-semibold">This note changed in another tab.</div>
                      <div className="mt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={state.resolveConflictWithRemote}
                          className="rounded-md bg-amber-100 px-2 py-1 font-medium text-amber-900 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-50 dark:hover:bg-amber-900"
                        >
                          Use latest
                        </button>
                        <button
                          type="button"
                          onClick={state.keepLocalVersion}
                          className="rounded-md bg-white px-2 py-1 font-medium text-amber-900 hover:bg-amber-100 dark:bg-neutral-800 dark:text-amber-50 dark:hover:bg-neutral-700"
                        >
                          Keep mine and overwrite latest version
                        </button>
                      </div>
                    </div>
                  )}

                  <SharedPropertiesToolbar
                    key={state.activeNoteId || 'new-note'}
                    initialSnippet={initialProperties}
                    compoundId={noteCompoundId}
                    defaultName={defaultToolbarNameRef.current}
                    onChange={state.handlePropertiesChange}
                    showTodo={true}
                    todoStatus={'idle'}
                    openPopupsToLeft={true}
                    openPopupsToBottom={true}
                    layout="horizontal"
                    onCreateTodo={async (deadlineVal, isRecurring, recurringCycle) => {
                      if (!state.activeNoteId) return;
                      const scheduleTime = deadlineVal ? new Date(deadlineVal).getTime() : Date.now();
                      try {
                        const newTodo = await createTodo(
                          state.noteTitle || 'Untitled Note',
                          [{ type: 'note', id: state.activeNoteId }],
                          isRecurring ? 'recurring' : 'one-time',
                          scheduleTime,
                          isRecurring ? recurringCycle as any : undefined
                        );

                        const chromeAny = (window as any).chrome;
                        if (chromeAny?.runtime?.sendMessage) {
                          chromeAny.runtime.sendMessage({
                            action: 'schedule_newtodo_alarm',
                            todoId: newTodo.id,
                            scheduleTime: scheduleTime
                          });
                        }
                      } catch (err) {
                        console.error('Failed to create and schedule note todo', err);
                      }
                    }}
                    snippetBreadCrum={null}
                  />

                  <button
                    onClick={state.handleClose}
                    className="p-2 text-neutral-500 hover:text-neutral-300 rounded-lg hover:bg-white/5 transition-all focus:outline-none cursor-pointer"
                    title="Close"
                  >
                    <FaTimes size={16} />
                  </button>
                </div>

                <div className="w-full flex-grow flex flex-col min-h-0 px-6 md:px-12 py-6">
                  <div className={`flex items-center gap-2 flex-shrink-0 relative z-10 ${isFullScreenMode ? 'py-8 pr-6' : 'py-4'}`}>
                    <div className="flex-grow min-w-0 flex items-center gap-3">
                      <input
                        ref={state.titleInputRef}
                        value={state.noteTitle}
                        onChange={e => state.setNoteTitle(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === 'ArrowDown') {
                            e.preventDefault();
                            state.editorRef.current?.focus();
                          }
                        }}
                        type="text"
                        placeholder="Title"
                        style={{ pointerEvents: 'auto' }}
                        className={`w-full text-[28px] font-semibold text-neutral-700 dark:text-neutral-300 placeholder-black/35 dark:placeholder-white/35 bg-transparent outline-none border-none shadow-none focus:ring-0 transition-all min-w-0 ${isFullScreenMode ? 'pl-[46px]' : 'pl-[14px]'}`}
                      />
                    </div>
                  </div>

                  <div className={`flex-grow min-h-0 font-sans overflow-hidden flex flex-col text-neutral-700 dark:text-neutral-300 text-sm font-medium ${isFullScreenMode ? 'pl-8 pr-6 pt-1' : 'pb-3'}`}>
                    <div className="flex-grow min-h-0 overflow-hidden relative">
                      <TextEditor
                        ref={state.editorRef}
                        value={state.noteBody}
                        onChange={state.setNoteBody}
                        placeholder="Start writing your note..."
                        readOnly={false}
                        onUpArrowAtStart={() => state.titleInputRef.current?.focus()}
                        showToolbar={true}
                        toolbarSelector={toolbarSelector}
                        isFocusMode={isFullScreenMode}
                        onDelete={onDeleteProp}
                        normalizeHtml={normalizeNoteBody}
                        syncRevision={state.syncRevision}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Sidebar Column */}
              {!isFullScreenMode && (
                <div
                  onMouseEnter={() => setIsRightPanelHovered(true)}
                  onMouseLeave={() => setIsRightPanelHovered(false)}
                  className="w-[260px] h-full flex flex-col border-l border-black/10 dark:border-white/10 pl-6 py-6 pr-4 overflow-hidden shrink-0 transition-all duration-300"
                >
                  {!isRightPanelHovered ? (
                    // Default State (Not Hovered): Only show Saved notes button box
                    <div className="flex flex-col gap-4">
                      {/* Saved notes card */}
                      <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex-shrink-0 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <FiSearch className="text-neutral-500" size={16} />
                          <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                            Saved notes
                          </span>
                          <span className="text-[10px] font-bold text-neutral-500 bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-full">
                            {filteredNotes.length}
                          </span>
                        </div>
                        <FiChevronRight className="text-neutral-500" size={16} />
                      </div>
                    </div>
                  ) : (
                    // Hovered State
                    <div className="flex flex-col flex-grow min-h-0 animate-in fade-in duration-200">
                      {/* Search notes input at the top */}
                      <div className="relative mb-4 flex-shrink-0">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
                        <input
                          type="text"
                          placeholder="Search notes..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          autoFocus
                          className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-neutral-800 dark:text-neutral-200 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors placeholder-neutral-400 dark:placeholder-neutral-500"
                        />
                      </div>

                      {/* Notes List Content (Compact spacing) */}
                      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-1">
                        {filteredNotes.length === 0 ? (
                          <div className="text-xs text-neutral-500 dark:text-neutral-400 text-center py-8">
                            No notes found
                          </div>
                        ) : (
                          filteredNotes.map(note => {
                            const isCurrent = note.id === state.activeNoteId;
                            const plainText = note.body ? extractTextFromHTML(note.body).substring(0, 80) : '';
                            return (
                              <div
                                key={note.id}
                                onClick={() => handleLoadNote(note.id)}
                                className={`group py-1.5 px-3 rounded-lg border transition-all cursor-pointer flex flex-col relative ${isCurrent
                                    ? 'border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5'
                                    : 'border-transparent bg-transparent hover:bg-black/5 dark:hover:bg-white/5'
                                  }`}
                              >
                                <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate pr-16">
                                  {note.title || 'Untitled Note'}
                                </span>
                                {plainText.trim() && (
                                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate pr-16">
                                    {plainText}
                                  </span>
                                )}

                                {/* Hover actions */}
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleLoadNote(note.id);
                                    }}
                                    className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white transition-colors"
                                    title="Edit Note"
                                  >
                                    <FaPen size={9} />
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteClickFromList(e, note.id)}
                                    className="p-1 rounded hover:bg-red-500/10 text-neutral-500 hover:text-red-500 dark:text-neutral-400 dark:hover:text-red-400 transition-colors"
                                    title="Delete Note"
                                  >
                                    <FaTrash size={9} />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="relative z-50 mt-auto flex-shrink-0 border-t border-black/10 dark:border-white/10 bg-[var(--color-editorBg)] rounded-b-xl">
              <div className="relative flex items-center justify-between gap-3 px-6 py-3 text-[10px] font-medium text-neutral-500 dark:text-neutral-400 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={state.handleClose}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <span className="text-neutral-600 dark:text-neutral-300">Back</span>
                    <span className="flex items-center rounded border border-white/80 dark:border-white/20 bg-[var(--color-containerBg)] px-1 py-0 text-[9px] font-semibold text-neutral-500 dark:text-neutral-300">
                      Esc
                    </span>
                  </button>
                </div>

                <div className="flex-grow flex items-center justify-center gap-2">
                  <div id={toolbarIdRef.current} className="flex items-center justify-center empty:hidden !border-none !p-0"></div>
                </div>

                <div className="w-[120px] flex justify-end">
                  {state.activeNoteId && (
                    <button
                      type="button"
                      onClick={handleCreateNew}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltipPos({
                          top: rect.top + window.scrollY - 46,
                          left: rect.left + window.scrollX - 40,
                        });
                        setShowTooltip(true);
                      }}
                      onMouseLeave={() => setShowTooltip(false)}
                      className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-semibold shadow-sm transition-all active:scale-95 border-black/10 dark:border-white/20 bg-neutral-100 dark:bg-white/10 text-neutral-800 dark:text-white/90 hover:bg-neutral-200 dark:hover:bg-white/20 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
                    >
                      <span>Create another</span>
                    </button>
                  )}

                  {showTooltip && ReactDOM.createPortal(
                    <div
                      style={{
                        position: 'absolute',
                        top: `${tooltipPos.top}px`,
                        left: `${tooltipPos.left}px`,
                      }}
                      className="bg-[#1c1d27] border border-[#2f3142] rounded-xl px-3 py-2 shadow-[0_10px_40px_rgba(0,0,0,0.6)] z-[999999] flex items-center gap-3 text-[12px] font-sans text-white pointer-events-none"
                    >
                      <div className="flex items-center gap-1">
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">Ctrl</kbd>
                        <span className="text-[10px] text-neutral-400 font-bold">+</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">Shift</kbd>
                        <span className="text-[10px] text-neutral-400 font-bold">+</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">Enter</kbd>
                      </div>
                      <span className="text-neutral-400 text-left whitespace-nowrap">to save and create new</span>
                    </div>,
                    document.body
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </EditorContainer>

      <DeleteConfirmation
        isOpen={state.isDeleteDialogOpen}
        onClose={() => state.setIsDeleteDialogOpen(false)}
        onConfirm={state.handleDelete}
        title="Delete Note"
        description="Are you sure you want to delete this note? This action cannot be undone."
        zIndex={100005}
      />

      <DeleteConfirmation
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={handleConfirmDeleteFromList}
        title="Delete Note"
        description="Are you sure you want to delete this note? This action cannot be undone."
        zIndex={100005}
      />

      <UnsavedChangesDialog
        isOpen={state.isUnsavedChangesDialogOpen}
        onDiscard={() => {
          state.setIsUnsavedChangesDialogOpen(false);
          if (props.onBack) props.onBack();
        }}
        onSave={async () => {
          const saved = await state.handleSave();
          if (saved) {
            state.setIsUnsavedChangesDialogOpen(false);
            if (props.onBack) props.onBack();
          }
          return saved;
        }}
        onClose={() => state.setIsUnsavedChangesDialogOpen(false)}
      />

      <UnsavedChangesDialog
        isOpen={isUnsavedLoadDialogOpen}
        onDiscard={() => {
          setIsUnsavedLoadDialogOpen(false);
          if (pendingLoadNoteId) {
            setIsForceCreateNew(false);
            setSelectedNoteId(pendingLoadNoteId);
            setPendingLoadNoteId(null);
          }
        }}
        onSave={async () => {
          const saved = await state.handleSave();
          if (saved) {
            setIsUnsavedLoadDialogOpen(false);
            if (pendingLoadNoteId) {
              setIsForceCreateNew(false);
              setSelectedNoteId(pendingLoadNoteId);
              setPendingLoadNoteId(null);
            }
          }
          return saved;
        }}
        onClose={() => {
          setIsUnsavedLoadDialogOpen(false);
          setPendingLoadNoteId(null);
        }}
      />
    </>
  );
}
