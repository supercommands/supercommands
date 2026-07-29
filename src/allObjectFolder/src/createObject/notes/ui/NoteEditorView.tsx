import React, { useRef, useState, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { EditorContainer } from '../../../../../shared-components/editorContainer/EditorContainer';
import { useNoteEditor } from '../useNoteEditor';
import { normalizeNoteBody, extractTextFromHTML } from '../noteHelpers';
import TextEditor from '../../../../../shared-components/TextEditor';
import { SharedPropertiesToolbar } from '../../../../../shared-components/editorToolbar/SharedPropertiesToolbar';
import DeleteConfirmation from '../../../../../shared-components/modals/deleteDialog';
import UnsavedChangesDialog from '../../../../../shared-components/modals/unsavedChangesDialog';
import { FaTimes, FaPen, FaTrash, FaStar, FaFolder, FaKeyboard, FaTag } from 'react-icons/fa';
import { FiSearch, FiBookmark, FiChevronRight, FiChevronLeft, FiChevronDown, FiTrash2, FiStar, FiExternalLink } from 'react-icons/fi';
import { AutoSaveIndicator } from '../../../../../shared-components/autoSaveEngine/autoSave';
import type { SharedProperties } from '../../../../../shared-components/editorToolbar/types';
import { createTodo } from '../../todos/todoData';
import { updateNote, deleteNote } from '../noteData';
import { createTag } from '../../tags/tagData';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { getItemCompoundId } from '../../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { useFavorites } from '../../../../../shared-components/favorites/favoriteHooks';
import { saveUserHotkey, deleteUserHotkeyByReference } from '../../../../../shared-components/hotkeys/core/hotkeyDbData';
import { buildHotkeyString } from '../../../../../shared-components/hotkeys/core/eventParser';
import { saveShortcut, clearShortcut, useShortcutValidation } from '../../../../../shared-components/shortcuts';

export interface NoteEditorViewProps {
  noteId?: string | null;
  onBack?: () => void;
  initialDraftKey?: string;
  initialDraftContent?: string;
  isFullScreenMode?: boolean;
}

export function NoteEditorView(props: NoteEditorViewProps) {
  const { isFullScreenMode = false } = props;
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const [isForceCreateNew, setIsForceCreateNew] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

  // Sidebar States & DB Store Selectors
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(props.noteId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSavedNotesExpanded, setIsSavedNotesExpanded] = useState(true);
  const [isRightPanelExpanded, setIsRightPanelExpanded] = useState(false);
  const [noteToDeleteId, setNoteToDeleteId] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [pendingLoadNoteId, setPendingLoadNoteId] = useState<string | null>(null);
  const [isUnsavedLoadDialogOpen, setIsUnsavedLoadDialogOpen] = useState(false);

  // Inline edit & hotkey states
  const [editingCell, setEditingCell] = useState<{ itemId: string; field: 'title' | 'shortcut' } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [recordingHotkeyId, setRecordingHotkeyId] = useState<string | null>(null);
  const [recordingCombo, setRecordingCombo] = useState<string>('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [tagEditValue, setTagEditValue] = useState<string>('');

  const notes = useDbStore(state => state.notes);
  const tags = useDbStore(state => state.tags);
  const folders = useDbStore(state => state.folders);
  const workspaces = useDbStore(state => state.workspaces);
  const shortcutsMap = useDbStore(state => state.shortcutsMap);
  const hotkeysMap = useDbStore(state => state.hotkeysMap);

  const { isFavorite, toggleFavorite } = useFavorites();
  const { validateShortcut } = useShortcutValidation();

  const tagNamesMap = useMemo(() => {
    const map: Record<string, string> = {};
    tags.forEach(t => { map[t.id] = t.name; });
    return map;
  }, [tags]);

  const folderNamesMap = useMemo(() => {
    const map: Record<string, string> = {};
    folders.forEach(f => { map[f.id] = f.folderName; });
    return map;
  }, [folders]);

  const workspaceNamesMap = useMemo(() => {
    const map: Record<string, string> = {};
    workspaces.forEach(w => { map[w.id] = w.workspaceName; });
    return map;
  }, [workspaces]);

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
      if (noteToDeleteId === selectedNoteId || noteToDeleteId === state.activeNoteId) {
        state.setIsNoteDeleted(true);
      }
    } catch (err) {
      console.error('Failed to delete note from list', err);
    } finally {
      setIsDeleteConfirmOpen(false);
      setNoteToDeleteId(null);
    }
  }, [noteToDeleteId, selectedNoteId, state]);

  const getNoteCompoundId = useCallback((note: any) => {
    return getItemCompoundId({
      id: note.id,
      workspace_id: note.workspaceId || undefined,
      folder_id: note.folderId || undefined,
      snippet: {
        id: note.id,
        category: 'note',
      },
    });
  }, []);

  const handleSaveEdit = useCallback(async (noteId: string, field: 'title' | 'shortcut') => {
    if (field === 'title') {
      await updateNote(noteId, { title: editValue });
    } else if (field === 'shortcut') {
      const noteItem = notes.find(n => n.id === noteId);
      const compound = noteItem ? getNoteCompoundId(noteItem) : noteId;
      if (editValue.trim()) {
        const res = await validateShortcut(editValue.trim(), noteId);
        if (!res.isValid) {
          alert(res.errorMessage || 'Invalid shortcut');
          setEditingCell(null);
          return;
        }
        await saveShortcut(noteId, compound, editValue.trim(), noteItem?.title || 'Untitled Note', 'note');
      } else {
        await clearShortcut(noteId, compound, 'note');
      }
    }
    setEditingCell(null);
  }, [editValue, notes, getNoteCompoundId, validateShortcut]);

  const handleSaveTagsEdit = useCallback(async (noteId: string) => {
    const tagNamesArr = tagEditValue.split(',').map(s => s.trim()).filter(Boolean);
    const targetNote = notes.find(n => n.id === noteId);
    const wsId = targetNote?.workspaceId || state.workspaceId || 'default';
    const tagIdsToSave: string[] = [];
    for (const name of tagNamesArr) {
      const existing = tags.find(t => t.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        tagIdsToSave.push(existing.id);
      } else {
        try {
          const newTag = await createTag(name, wsId);
          tagIdsToSave.push(newTag.id);
        } catch (e) {
          console.error('Failed creating tag inline', e);
        }
      }
    }
    await updateNote(noteId, { tagIds: tagIdsToSave });
    setEditingTagId(null);
  }, [tagEditValue, tags, notes, state.workspaceId]);

  const handleOpenerClick = useCallback((noteId: string) => {
    const chromeAny = (window as any)?.chrome;
    const baseUrl = chromeAny?.runtime?.getURL ? chromeAny.runtime.getURL('AltS_search_newtab/index.html') : '/AltS_search_newtab/index.html';
    const url = `${baseUrl}?open_note=true&noteid=${encodeURIComponent(noteId)}`;
    if (chromeAny?.tabs?.create) {
      chromeAny.tabs.create({ url, active: true });
    } else {
      window.open(url, '_blank', 'noopener');
    }
  }, []);

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

    const currentProps = useUIStore.getState().activeEditor?.props || {};
    const cleanProps = { ...currentProps, snippet: null, prefill: null, item: null, initialDraftKey: null, initialDraftContent: null };
    useUIStore.getState().openEditor({ type: 'note', id: 'new', props: cleanProps });

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

  if (state.activeNoteId && state.liveNote === undefined && !state.isNoteDeleted && !props.initialDraftKey && !props.initialDraftContent) {
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
        className={`w-full h-full flex flex-col gap-1 text-left text-neutral-900 dark:text-white bg-transparent ${isFullScreenMode || isEmbedded ? '' : 'px-6 md:px-10 lg:px-14 py-4'
          }`}
        innerClassName={`flex flex-col relative bg-[var(--color-editorBg)] ${isFullScreenMode
          ? 'w-full rounded-none h-full max-h-none'
          : 'w-[calc(100%-60px)] max-w-[1440px] mx-auto rounded-xl h-[860px] max-h-[90vh] overflow-hidden transition-all duration-300'
          } ${isFocusMode || isFullScreenMode ? 'border-none' : 'border border-black/5 dark:border-white/10'
          }`}
      >
        {state.isNoteDeleted ? (
          <div className="flex-1 min-h-0 flex items-center justify-center px-6 py-10">
            <div className="max-w-md w-full rounded-2xl border border-neutral-200 dark:border-white/10 bg-white/90 dark:bg-[#18181b]/90 p-7 text-center shadow-2xl backdrop-blur-xl flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-red-500/10 dark:bg-red-500/15 text-red-500 dark:text-red-400 flex items-center justify-center mb-4 border border-red-500/20">
                <FiTrash2 size={20} />
              </div>
              <div className="text-lg font-semibold text-neutral-900 dark:text-white">This note was deleted in another tab.</div>
              <div className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400 max-w-xs">
                The editor is disabled to avoid saving stale content.
              </div>
              <button
                type="button"
                onClick={state.handleClose}
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-neutral-900 dark:bg-neutral-800 hover:bg-neutral-800 dark:hover:bg-neutral-700 border border-transparent dark:border-white/10 px-6 py-2.5 text-sm font-medium text-white transition-all cursor-pointer shadow-md active:scale-95"
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
              <div className="flex-grow flex flex-col min-h-0 min-w-0 relative transition-all duration-300">
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

              {/* Right Sidebar Column with Collapsible / Expandable Panel (Hover to expand, leave to collapse) */}
              {!isFullScreenMode && (
                <div
                  onMouseEnter={() => setIsRightPanelExpanded(true)}
                  onMouseLeave={() => setIsRightPanelExpanded(false)}
                  className={`relative h-full flex flex-col border-l border-black/10 dark:border-white/10 overflow-visible shrink-0 transition-all duration-300 ${isRightPanelExpanded ? 'w-[680px]' : 'w-[260px]'
                    }`}
                >
                  <div className="w-full h-full flex flex-col pl-4 py-4 pr-3 overflow-hidden">
                    {/* Header: Always show Search bar + item count badge pill at the far right corner */}
                    <div className="relative mb-3 flex-shrink-0 flex items-center justify-between gap-2">
                      <div className={`relative transition-all duration-300 ${isRightPanelExpanded ? 'w-[240px]' : 'flex-1 min-w-0'}`}>
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={13} />
                        <input
                          type="text"
                          placeholder="Search notes..."
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-neutral-800 dark:text-neutral-200 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors placeholder-neutral-400 dark:placeholder-neutral-500"
                        />
                      </div>

                      {/* Item Count Badge Pill on the far right corner */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 bg-black/10 dark:bg-white/10 px-2.5 py-0.5 rounded-full border border-black/5 dark:border-white/10">
                          {filteredNotes.length}
                        </span>
                      </div>
                    </div>

                    {/* Notes List Content - rendered in both collapsed mode (Title + Content) and expanded mode (Full Table) */}
                    {isRightPanelExpanded ? (
                      <div className="flex-1 min-h-0 relative flex flex-col rounded-xl overflow-hidden">
                        {/* Sticky Table Header */}
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/5 dark:border-white/10 text-xs font-semibold text-neutral-700 dark:text-neutral-300 bg-black/5 dark:bg-white/5 backdrop-blur-md shrink-0">
                          <div className="w-[110px] shrink-0 font-semibold text-neutral-700 dark:text-neutral-300 tracking-tight">Command short</div>
                          <div className="w-[110px] shrink-0 font-semibold text-neutral-700 dark:text-neutral-300 tracking-tight">Title</div>
                          <div className="w-[130px] shrink-0 px-2 font-semibold text-neutral-700 dark:text-neutral-300 tracking-tight">Content</div>
                          <div className="w-[70px] shrink-0 font-semibold text-neutral-700 dark:text-neutral-300 tracking-tight text-left">Hotkey</div>
                          <div className="w-[60px] shrink-0 font-semibold text-neutral-700 dark:text-neutral-300 tracking-tight text-left">Tag</div>
                          <div className="w-[60px] shrink-0 font-semibold text-neutral-700 dark:text-neutral-300 tracking-tight text-left">Folder</div>
                          <div className="w-[50px] shrink-0 font-semibold text-neutral-700 dark:text-neutral-300 tracking-tight text-right pr-2">Actions</div>
                        </div>

                        {/* Table Body / Rows */}
                        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar divide-y divide-black/5 dark:divide-white/10">
                          {filteredNotes.length === 0 ? (
                            <div className="text-xs text-neutral-500 dark:text-neutral-400 text-center py-8">
                              No notes found
                            </div>
                          ) : (
                            filteredNotes.map(note => {
                              const isCurrent = note.id === state.activeNoteId;
                              const plainText = note.body ? extractTextFromHTML(note.body).substring(0, 80) : '';
                              const compoundId = getNoteCompoundId(note);
                              const sc = shortcutsMap[compoundId] || shortcutsMap[note.id] || ((note as any).shortcut || '');
                              const hotkeyCombo = hotkeysMap[compoundId] || '';

                              const wsName = note.workspaceId ? (workspaceNamesMap[note.workspaceId] || '') : '';
                              const folderName = note.folderId ? (folderNamesMap[note.folderId] || '') : '';
                              const folderDisplayName = folderName || wsName;

                              const noteTags = note.tagIds
                                ? note.tagIds.map((tid: string) => tagNamesMap[tid] || '').filter(Boolean)
                                : [];
                              const tagText = noteTags.join(', ');

                              return (
                                <div
                                  key={note.id}
                                  onClick={() => handleLoadNote(note.id)}
                                  className={`py-2 px-4 transition-colors cursor-pointer flex items-center justify-between gap-2 text-xs ${isCurrent
                                      ? 'bg-black/15 dark:bg-white/15 font-medium text-neutral-800 dark:text-neutral-200'
                                      : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400'
                                    }`}
                                >
                                  {/* Column 1: Command short badge with arrow indicator */}
                                  <div className="w-[110px] shrink-0 flex items-center justify-between pr-2" onClick={(e) => e.stopPropagation()}>
                                    {editingCell?.itemId === note.id && editingCell?.field === 'shortcut' ? (
                                      <input
                                        autoFocus
                                        type="text"
                                        value={editValue}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => {
                                          const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                                          setEditValue(val);
                                        }}
                                        onBlur={() => handleSaveEdit(note.id, 'shortcut')}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSaveEdit(note.id, 'shortcut');
                                          else if (e.key === 'Escape') setEditingCell(null);
                                        }}
                                        className="px-1.5 py-0.5 w-[70px] rounded border border-blue-500 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-[10px] outline-none shrink-0"
                                      />
                                    ) : (
                                      <div className="flex items-center justify-between w-full">
                                        {sc ? (
                                          <>
                                            <span
                                              onDoubleClick={(e) => {
                                                e.stopPropagation();
                                                setEditingCell({ itemId: note.id, field: 'shortcut' });
                                                setEditValue(sc);
                                              }}
                                              className="px-2 py-0.5 rounded-lg border border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-400 bg-transparent text-xs font-medium block truncate max-w-[70px] text-center shrink-0 cursor-pointer"
                                              title={`c ${sc} (Double click to edit)`}
                                            >
                                              c {sc}
                                            </span>
                                            <svg width="18" height="10" viewBox="0 0 24 10" fill="none" className="text-neutral-400 opacity-35 shrink-0">
                                              <path d="M0 5H22M22 5L18 1M22 5L18 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                          </>
                                        ) : null}
                                      </div>
                                    )}
                                  </div>

                                  {/* Column 2: Title */}
                                  <div
                                    className="w-[110px] shrink-0 font-medium text-neutral-700 dark:text-neutral-300 truncate"
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      setEditingCell({ itemId: note.id, field: 'title' });
                                      setEditValue(note.title || '');
                                    }}
                                  >
                                    {editingCell?.itemId === note.id && editingCell?.field === 'title' ? (
                                      <input
                                        autoFocus
                                        type="text"
                                        value={editValue}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onBlur={() => handleSaveEdit(note.id, 'title')}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSaveEdit(note.id, 'title');
                                          else if (e.key === 'Escape') setEditingCell(null);
                                        }}
                                        className="px-1.5 py-0.5 w-full rounded border border-blue-500 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-semibold outline-none"
                                      />
                                    ) : (
                                      <span title={note.title || 'Untitled Note'}>
                                        {note.title || 'Untitled Note'}
                                      </span>
                                    )}
                                  </div>

                                  {/* Column 3: Content preview */}
                                  <div className="w-[130px] shrink-0 px-2 truncate text-neutral-500 dark:text-neutral-400 text-xs">
                                    {plainText.trim() || '—'}
                                  </div>

                                  {/* Column 4: Hotkey slot (fixed 70px width) */}
                                  <div className="w-[70px] shrink-0 flex items-center justify-start text-[10px]" onClick={(e) => e.stopPropagation()}>
                                    {recordingHotkeyId === note.id ? (
                                      <input
                                        autoFocus
                                        type="text"
                                        placeholder="Keys..."
                                        value={recordingCombo}
                                        readOnly
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={async (e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if (e.key === 'Escape') {
                                            setRecordingHotkeyId(null);
                                            setRecordingCombo('');
                                            return;
                                          }
                                          if (e.key === 'Backspace' || e.key === 'Delete') {
                                            await deleteUserHotkeyByReference(compoundId);
                                            setRecordingHotkeyId(null);
                                            setRecordingCombo('');
                                            return;
                                          }
                                          if (e.key === 'Enter') {
                                            if (recordingCombo && recordingCombo !== 'Keys...') {
                                              await saveUserHotkey(recordingCombo, compoundId, 'note');
                                            } else {
                                              await deleteUserHotkeyByReference(compoundId);
                                            }
                                            setRecordingHotkeyId(null);
                                            setRecordingCombo('');
                                            return;
                                          }
                                          const combo = buildHotkeyString(e.nativeEvent, isMac);
                                          if (combo) setRecordingCombo(combo);
                                        }}
                                        onBlur={async () => {
                                          if (recordingCombo && recordingCombo !== 'Keys...') {
                                            await saveUserHotkey(recordingCombo, compoundId, 'note');
                                          }
                                          setRecordingHotkeyId(null);
                                          setRecordingCombo('');
                                        }}
                                        className="px-1 py-0.5 w-[65px] rounded border border-blue-500 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-[9px] outline-none"
                                      />
                                    ) : hotkeyCombo ? (
                                      <div
                                        onDoubleClick={(e) => {
                                          e.stopPropagation();
                                          setRecordingHotkeyId(note.id);
                                          setRecordingCombo(hotkeyCombo);
                                        }}
                                        className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400 shrink-0 cursor-pointer select-none max-w-[65px] truncate"
                                        title="Double click to edit hotkey"
                                      >
                                        <FaKeyboard size={11} className="text-neutral-400 hover:text-blue-500 shrink-0" />
                                        <span className="font-mono text-neutral-600 dark:text-neutral-300 truncate">{hotkeyCombo}</span>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setRecordingHotkeyId(note.id);
                                          setRecordingCombo('Keys...');
                                        }}
                                        className="p-0.5 text-neutral-400 hover:text-blue-500 transition-colors shrink-0"
                                        title="Assign Hotkey"
                                      >
                                        <FaKeyboard size={11} />
                                      </button>
                                    )}
                                  </div>

                                  {/* Column 5: Tag slot (fixed 60px width) */}
                                  <div className="w-[60px] shrink-0 flex items-center justify-start text-[10px]" onClick={(e) => e.stopPropagation()}>
                                    {editingTagId === note.id ? (
                                      <input
                                        autoFocus
                                        type="text"
                                        placeholder="tag1, tag2"
                                        value={tagEditValue}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => setTagEditValue(e.target.value)}
                                        onBlur={() => handleSaveTagsEdit(note.id)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSaveTagsEdit(note.id);
                                          else if (e.key === 'Escape') setEditingTagId(null);
                                        }}
                                        className="px-1 py-0.5 w-[55px] rounded border border-blue-500 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-[9px] outline-none"
                                      />
                                    ) : tagText ? (
                                      <div
                                        onDoubleClick={(e) => {
                                          e.stopPropagation();
                                          setEditingTagId(note.id);
                                          setTagEditValue(tagText);
                                        }}
                                        className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400 shrink-0 cursor-pointer select-none max-w-[55px] truncate"
                                        title={`${tagText} (Double click to edit)`}
                                      >
                                        <FaTag size={10} className="text-neutral-400 hover:text-blue-500 shrink-0" />
                                        <span className="truncate text-neutral-600 dark:text-neutral-300">{tagText}</span>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingTagId(note.id);
                                          setTagEditValue('');
                                        }}
                                        className="p-0.5 text-neutral-400 hover:text-blue-500 transition-colors shrink-0"
                                        title="Add Tags"
                                      >
                                        <FaTag size={10} />
                                      </button>
                                    )}
                                  </div>

                                  {/* Column 6: Folder slot (fixed 60px width) */}
                                  <div className="w-[60px] shrink-0 flex items-center justify-start text-[10px]" onClick={(e) => e.stopPropagation()}>
                                    {folderDisplayName ? (
                                      <div className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400 shrink-0 max-w-[55px] truncate" title={folderDisplayName}>
                                        <FaFolder size={10} className="text-neutral-400 shrink-0" />
                                        <span className="truncate text-neutral-600 dark:text-neutral-300">{folderDisplayName}</span>
                                      </div>
                                    ) : null}
                                  </div>

                                  {/* Column 7: Actions slot (fixed 50px width: Star, Opener, Delete) */}
                                  <div className="w-[50px] shrink-0 flex items-center justify-end gap-1 pr-1" onClick={(e) => e.stopPropagation()}>
                                    {/* Star */}
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        await toggleFavorite(compoundId, 'note', note.title || 'Untitled Note');
                                      }}
                                      className="p-0.5 text-neutral-400 hover:text-yellow-500 transition-colors"
                                      title="Favorite"
                                    >
                                      {isFavorite(compoundId) ? (
                                        <FaStar className="text-yellow-500" size={11} />
                                      ) : (
                                        <FiStar size={11} />
                                      )}
                                    </button>

                                    {/* Opener */}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenerClick(note.id);
                                      }}
                                      className="text-neutral-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 shrink-0"
                                      title="Open note in new tab"
                                    >
                                      <FiExternalLink size={11} />
                                    </button>

                                    {/* Delete */}
                                    <button
                                      type="button"
                                      onClick={(e) => handleDeleteClickFromList(e, note.id)}
                                      className="p-0.5 text-neutral-400 hover:text-red-500 transition-colors"
                                      title="Delete note"
                                    >
                                      <FaTrash size={10} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Default Collapsed Mode: Render clean list without card backgrounds */
                      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 pr-1 py-1">
                        {filteredNotes.length === 0 ? (
                          <div className="text-xs text-neutral-500 dark:text-neutral-400 text-center py-6">
                            No notes found
                          </div>
                        ) : (
                          filteredNotes.map(note => {
                            const isCurrent = note.id === state.activeNoteId;
                            const plainText = note.body ? extractTextFromHTML(note.body).substring(0, 70) : '';

                            return (
                              <div
                                key={note.id}
                                onClick={() => handleLoadNote(note.id)}
                                className={`py-1.5 px-2.5 rounded-lg transition-colors cursor-pointer flex flex-col gap-0.5 relative ${isCurrent
                                    ? 'bg-black/10 dark:bg-white/10'
                                    : 'hover:bg-black/5 dark:hover:bg-white/5'
                                  }`}
                              >
                                {/* Row 1: Title (Bold) */}
                                <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                                  {note.title || 'Untitled Note'}
                                </div>

                                {/* Row 2: Description snippet */}
                                {plainText.trim() && (
                                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                                    {plainText}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
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
