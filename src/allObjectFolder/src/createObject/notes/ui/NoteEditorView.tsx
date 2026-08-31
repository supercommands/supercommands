import * as React from 'react';
import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { EditorContainer } from '../../../../../shared-components/editorContainer/EditorContainer';
import { baseVersionHistory, useNoteEditor } from '../useNoteEditor';
import { normalizeNoteBody, extractTextFromHTML } from '../noteHelpers';
import TextEditor from '../../../../../shared-components/TextEditor';
import { SharedPropertiesToolbar } from '../../../../../shared-components/editorToolbar/SharedPropertiesToolbar';
import DeleteConfirmation from '../../../../../shared-components/modals/deleteDialog';
import UnsavedChangesDialog from '../../../../../shared-components/modals/unsavedChangesDialog';
import { FaTimes } from 'react-icons/fa';
import { FiTrash2, FiList } from 'react-icons/fi';
import { AutoSaveIndicator } from '../../../../../shared-components/autoSaveEngine/autoSave';
import type { SharedProperties } from '../../../../../shared-components/editorToolbar/types';
import { createTodo } from '../../todos/todoData';
import { updateNote, deleteNote } from '../noteData';
import { createTag } from '../../tags/tagData';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { getItemCompoundId } from '../../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { useFavorites } from '../../../../../shared-components/favorites/favoriteHooks';
import { saveShortcut, clearShortcut, useShortcutValidation } from '../../../../../shared-components/shortcuts';
import { RightSideItemsPanel } from '../../../../../shared-components/editorContainer/RightSideItemsPanel';
import { NoteVersionHistory, NoteRecord } from '../noteTypes';
import { getHistoricalVersion } from '../noteHistory';

export interface NoteEditorViewProps {
  noteId?: string | null;
  onBack?: () => void;
  initialDraftKey?: string;
  initialDraftContent?: string;
  initialTagIds?: string[];
  onNoteCreated?: (note: NoteRecord) => void | Promise<void>;
  isFullScreenMode?: boolean;
  isWidgetMode?: boolean;
  isEditMode?: boolean;
  isOverlay?: boolean;
  hideRightPanel?: boolean;
  appearanceScope?: 'default' | 'alts';
  appearanceTokens?: React.CSSProperties;
  onSavedClose?: () => void;
  saveNoteAdapter?: (args: {
    mode: 'create' | 'update';
    noteId?: string;
    input: any;
  }) => Promise<NoteRecord>;
  propertyPersistenceAdapter?: React.ComponentProps<typeof SharedPropertiesToolbar>['propertyPersistenceAdapter'];
  initialVersionHistory?: NoteVersionHistory;
}

export function NoteEditorView(props: NoteEditorViewProps) {
  const {
    isFullScreenMode = false,
    isWidgetMode = false,
    isEditMode = false,
    isOverlay: propIsOverlay,
    hideRightPanel = false,
    appearanceScope = 'default',
    appearanceTokens,
    propertyPersistenceAdapter,
  } = props;
  const activeEditor = useUIStore(state => state.activeEditor);
  const isFocusMode = useUIStore(state => state.isFocusMode);
  const isOverlay = Boolean(propIsOverlay || activeEditor?.props?.isOverlay);
  const isAltSOverlay = appearanceScope === 'alts';
  const isNormalNoteMode = !isWidgetMode && !isFullScreenMode && !isOverlay && !isFocusMode;
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const [isForceCreateNew, setIsForceCreateNew] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

  // Sidebar States & DB Store Selectors
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(props.noteId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRightPanelExpanded, setIsRightPanelExpanded] = useState(false);
  const rightSideSearchInputRef = useRef<HTMLInputElement>(null);
  const altSAppearanceStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    if (!isAltSOverlay) return appearanceTokens;
    return {
      ...appearanceTokens,
      '--color-editorBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
      '--color-modalBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
      '--color-popupBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
      '--color-containerBg': 'var(--alts-panel-bg, var(--color-altsPanelBg))',
      '--color-inputBg': 'var(--alts-input-bg, var(--color-altsInputBg))',
      '--color-hoverBg': 'var(--alts-row-hover-bg, var(--color-altsRowHoverBg))',
      '--color-textPrimary': 'var(--alts-text-primary, var(--color-altsTextPrimary))',
      '--color-textSecondary': 'var(--alts-text-secondary, var(--color-altsTextSecondary))',
      '--color-textMuted': 'var(--alts-text-placeholder, var(--color-altsTextPlaceholder))',
      '--color-textPlaceholder': 'var(--alts-text-placeholder, var(--color-altsTextPlaceholder))',
      '--color-iconDefault': 'var(--alts-icon-color, var(--color-altsIconFg))',
      '--color-borderDefault': 'var(--alts-border, var(--color-altsBorderColor))',
      '--color-borderActive': 'var(--alts-focus-color, var(--color-altsFocusColor))',
    } as React.CSSProperties;
  }, [appearanceTokens, isAltSOverlay]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        e.preventDefault();
        setIsRightPanelExpanded(true);
        setTimeout(() => {
          rightSideSearchInputRef.current?.focus();
          rightSideSearchInputRef.current?.select();
        }, 50);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const [noteToDeleteId, setNoteToDeleteId] = useState<string | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [pendingLoadNoteId, setPendingLoadNoteId] = useState<string | null>(null);
  const [isUnsavedLoadDialogOpen, setIsUnsavedLoadDialogOpen] = useState(false);

  const notes = useDbStore(state => state.notes);
  const tags = useDbStore(state => state.tags);
  const folders = useDbStore(state => state.folders);
  const workspaces = useDbStore(state => state.workspaces);
  const shortcutsMap = useDbStore(state => state.shortcutsMap);
  const hotkeysMap = useDbStore(state => state.hotkeysMap);

  const { isFavorite, toggleFavorite, addFavorite } = useFavorites();
  const { validateShortcut } = useShortcutValidation();

  const tagNamesMap = useMemo(() => {
    const map: Record<string, string> = {};
    tags.forEach(t => {
      map[t.id] = t.name;
    });
    return map;
  }, [tags]);

  const folderNamesMap = useMemo(() => {
    const map: Record<string, string> = {};
    folders.forEach(f => {
      map[f.id] = f.folderName;
    });
    return map;
  }, [folders]);

  const workspaceNamesMap = useMemo(() => {
    const map: Record<string, string> = {};
    workspaces.forEach(w => {
      map[w.id] = w.workspaceName;
    });
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
        initialTagIds: props.initialTagIds,
        onNoteCreated: props.onNoteCreated,
      };
    }
    return {
      ...props,
      noteId: selectedNoteId,
      initialTagIds: selectedNoteId ? undefined : props.initialTagIds,
      onNoteCreated: props.onNoteCreated,
    };
  }, [props, isForceCreateNew, selectedNoteId]);

  const state = useNoteEditor(editorProps);

  const notePlainText = useMemo(() => extractTextFromHTML(state.noteBody || ''), [state.noteBody]);
  const noteWordCount = useMemo(() => (notePlainText.trim() ? notePlainText.trim().split(/\s+/).length : 0), [notePlainText]);
  const noteCharCount = notePlainText.length;

  const handleLoadNote = useCallback(
    async (id: string) => {
      if (state.isDirty) {
        setPendingLoadNoteId(id);
        setIsUnsavedLoadDialogOpen(true);
      } else {
        setIsForceCreateNew(false);
        setSelectedNoteId(id);
      }
    },
    [state.isDirty],
  );



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

  const textToDisplay = useCallback(() => {
    if (!state || !state.activeNoteId) return '';

    if (state.noteVersionIndex === 0) {
      return state.noteBody;
    }

    const note = notes.find(n => n.id === state.activeNoteId);
    const versionHistory = (note && note.versionHistory && typeof (note.versionHistory as any).lastSavedText === 'string')
      ? (note.versionHistory as any)
      : { lastCheckpointAt: Date.now(), lastSavedText: state.noteBody, historyBuffer: [] };

    return getHistoricalVersion(state.noteBody, versionHistory, state.noteVersionIndex);
  }, [state, notes]);

  const handleEditorChange = useCallback(
    (newText: string) => {
      state.setNoteBody(newText);
    },
    [state.setNoteBody],
  );

  const handleOpenerClick = useCallback((noteId: string) => {
    const chromeAny = (window as any)?.chrome;
    const baseUrl = chromeAny?.runtime?.getURL
      ? chromeAny.runtime.getURL('AltS_search_newtab/index.html')
      : '/AltS_search_newtab/index.html';
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

  const isEmbedded =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === 'true';

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
    const cleanProps = {
      ...currentProps,
      snippet: null,
      prefill: null,
      item: null,
      initialDraftKey: null,
      initialDraftContent: null,
    };
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

  if (
    state.activeNoteId &&
    state.liveNote === undefined &&
    !state.isNoteDeleted &&
    !isAltSOverlay &&
    !props.initialDraftKey &&
    !props.initialDraftContent
  ) {
    return (
      <div className={`flex items-center justify-center h-full ${isWidgetMode ? 'bg-transparent' : 'min-h-screen bg-[var(--color-editorBg)]'} text-neutral-900 dark:text-white`}>
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
        style={altSAppearanceStyle}
        className={isWidgetMode
          ? 'w-full h-full flex flex-col text-left text-[var(--color-textPrimary)] bg-transparent overflow-hidden'
          : isAltSOverlay
          ? 'w-full h-full min-h-0 flex flex-col text-left text-[var(--color-textPrimary)] bg-transparent overflow-hidden'
          : isNormalNoteMode
          ? 'w-full h-full flex flex-col gap-1 text-left text-[var(--color-textPrimary)] bg-transparent px-4 md:px-6 py-2'
          : `w-full h-full flex flex-col gap-1 text-left text-[var(--color-textPrimary)] bg-transparent ${isFullScreenMode || isEmbedded ? '' : 'px-6 md:px-10 lg:px-14 py-4'}`
        }
        innerClassName={isWidgetMode
          ? 'flex flex-col w-full h-full overflow-hidden bg-transparent'
          : isAltSOverlay
          ? 'flex flex-col relative bg-transparent w-full h-full min-h-0 max-h-none overflow-hidden border-none'
          : isNormalNoteMode
          ? 'flex flex-col relative bg-transparent w-full h-full max-h-none border-none'
          : `flex flex-col relative bg-transparent ${isFullScreenMode
            ? 'w-full rounded-none h-full max-h-none border-none'
            : 'w-[calc(100%-60px)] max-w-[1440px] mx-auto h-[860px] max-h-[90vh] overflow-visible transition-all duration-300 border-none'
            }`
        }>
        {state.isNoteDeleted ? (
          <div className="flex-1 min-h-0 flex items-center justify-center px-6 py-10">
            <div className="max-w-md w-full rounded-2xl border border-neutral-200 dark:border-white/10 bg-white/90 dark:bg-[#18181b]/90 p-7 text-center shadow-2xl backdrop-blur-xl flex flex-col items-center">
              <div className="w-12 h-12 rounded-full bg-red-500/10 dark:bg-red-500/15 text-red-500 dark:text-red-400 flex items-center justify-center mb-4 border border-red-500/20">
                <FiTrash2 size={20} />
              </div>
              <div className="text-lg font-semibold text-[var(--color-textPrimary)]">
                This note was deleted in another tab.
              </div>
              <div className="mt-1.5 text-sm text-[var(--color-textSecondary)] max-w-xs">
                The editor is disabled to avoid saving stale content.
              </div>
              <button
                type="button"
                onClick={state.handleClose}
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-neutral-900 dark:bg-neutral-800 hover:bg-neutral-800 dark:hover:bg-neutral-700 border border-transparent dark:border-white/10 px-6 py-2.5 text-sm font-medium text-white transition-all cursor-pointer shadow-md active:scale-95">
                Back
              </button>
            </div>
          </div>
        ) : (
          <div className={`flex-1 min-h-0 flex flex-row gap-2 bg-transparent text-[var(--color-textPrimary)] ${isAltSOverlay ? 'overflow-hidden' : 'overflow-visible'}`}>
            {/* Left Surface: Header + Content + Footer Toolbar */}
            <div className={isWidgetMode
              ? 'flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-transparent border-none relative'
              : isAltSOverlay
              ? 'flex-1 min-w-0 flex flex-col h-full min-h-0 overflow-hidden rounded-none border-none shadow-none bg-[var(--color-editorBg)] relative'
              : isNormalNoteMode
              ? 'flex-1 min-w-0 flex flex-col h-full overflow-hidden rounded-none border-none shadow-none bg-[var(--color-editorBg)] relative'
              : 'flex-1 min-w-0 flex flex-col h-full overflow-hidden rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-editorBg)] relative'
            }>
              {isFullScreenMode && <div className="h-20 flex-shrink-0" />}

              {/* Main Workspace Left Side */}
              <div className="flex-grow flex flex-col min-h-0 min-w-0 relative">
                {!isWidgetMode && (<div className="absolute top-2.5 right-2 md:top-2.5 md:right-2 z-50 flex items-center gap-3">
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
                          className="rounded-md bg-amber-100 px-2 py-1 font-medium text-amber-900 hover:bg-amber-200 dark:bg-amber-900/60 dark:text-amber-50 dark:hover:bg-amber-900">
                          Use latest
                        </button>
                        <button
                          type="button"
                          onClick={state.keepLocalVersion}
                          className="rounded-md bg-white px-2 py-1 font-medium text-amber-900 hover:bg-amber-100 dark:bg-neutral-800 dark:text-amber-50 dark:hover:bg-neutral-700">
                          Keep mine and overwrite latest version
                        </button>
                      </div>
                    </div>
                  )}

                  <SharedPropertiesToolbar
                    key={state.activeNoteId || 'new-note'}
                    initialSnippet={initialProperties}
                    currentSnapshot={{
                      entityType: 'note',
                      title: state.noteTitle || '',
                      body: state.noteBody || '',
                      shortcut: (noteCompoundId ? shortcutsMap[noteCompoundId] : (state.activeNoteId ? shortcutsMap[state.activeNoteId] : '')) || '',
                      workspaceId: state.workspaceId,
                      folderId: state.folderId,
                      tagIds: [...(state.tagIds || [])],
                    }}
                    compoundId={noteCompoundId}
                    setNoteVersionIndex={state.setNoteVersionIndex}
                    selectedNoteVersionIndex={state.noteVersionIndex}
                    defaultName={defaultToolbarNameRef.current}
                    onChange={state.handlePropertiesChange}
                    activeNoteId={state.activeNoteId}
                    showTodo={true}
                    todoStatus={'idle'}
                    openPopupsToLeft={true}
                    openPopupsToBottom={true}
                    layout="horizontal"
                    onCreateTodo={async (deadlineVal, isRecurring, recurringCycle) => {
                      const noteId = state.activeNoteId || 'note_' + Date.now();
                      const plainTitle = (state.noteTitle || '').trim() || 'Untitled Note';
                      if (!plainTitle) {
                        alert('Title is required to create a To-Do for a Note.');
                        return;
                      }
                      const scheduleTime = deadlineVal ? new Date(deadlineVal).getTime() : Date.now();
                      try {
                        const newTodo = propertyPersistenceAdapter?.createTodo
                          ? await propertyPersistenceAdapter.createTodo({
                              title: plainTitle,
                              description: '',
                              references: [{ type: 'note', id: noteId, name: plainTitle }],
                              scheduleType: isRecurring ? 'recurring' : 'one-time',
                              scheduleTime,
                              recurringCycle: isRecurring ? (recurringCycle as any) : undefined,
                              tagIds: state.tagIds || [],
                              workspaceId: state.workspaceId,
                              folderId: state.folderId,
                            })
                          : await createTodo(
                              plainTitle,
                              [{ type: 'note', id: noteId, name: plainTitle }],
                              isRecurring ? 'recurring' : 'one-time',
                              scheduleTime,
                              isRecurring ? (recurringCycle as any) : undefined,
                            );
                        const chromeAny = (window as any).chrome;
                        if (chromeAny?.runtime?.sendMessage) {
                          chromeAny.runtime.sendMessage({
                            action: 'schedule_newtodo_alarm',
                            todoId: newTodo.id,
                            scheduleTime: scheduleTime,
                          });
                        }
                      } catch (err) {
                        console.error('[NoteEditorView:onCreateTodo] Failed to create and schedule note todo', err);
                      }
                    }}
                    snippetBreadCrum={null}
                    appearanceScope={appearanceScope}
                    appearanceTokens={altSAppearanceStyle}
                    propertyPersistenceAdapter={propertyPersistenceAdapter}
                  />

                  <button
                    onClick={state.handleClose}
                    className={`p-2 text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] rounded-lg transition-all focus:outline-none cursor-pointer ${
                      !isFullScreenMode && !isWidgetMode ? 'md:hidden' : ''
                    }`}
                    title="Close">
                    <FaTimes size={16} />
                  </button>
                </div>)}

                <div className={
                  isWidgetMode
                    ? "w-full flex-grow flex flex-col min-h-0 px-3 py-2"
                    : isNormalNoteMode
                    ? "w-full max-w-[740px] mx-auto flex-grow flex flex-col min-h-0 px-4 md:px-6 py-6"
                    : isAltSOverlay
                    ? "w-full flex-grow flex flex-col min-h-0 px-4 md:px-6 py-4"
                    : "w-full flex-grow flex flex-col min-h-0 px-6 md:px-12 py-6"
                }>
                  <div className={`flex items-center gap-2 flex-shrink-0 relative z-10 ${isFullScreenMode ? 'py-8 pr-6' : isWidgetMode ? 'py-1' : 'py-4'}`}>
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
                        className={`w-full ${isWidgetMode ? 'text-[11px] font-bold' : 'text-[28px] font-bold'} text-[var(--color-textPrimary)] placeholder-[var(--color-textPlaceholder)] bg-transparent outline-none border-none shadow-none focus:ring-0 transition-all min-w-0 ${isFullScreenMode ? 'pl-[46px]' : isWidgetMode ? 'pl-[12px]' : 'pl-[14px]'}`}
                      />
                    </div>
                  </div>

                  <div
                    className={`flex-grow min-h-0 font-sans overflow-hidden flex flex-col text-[var(--color-textPrimary)] text-sm font-medium ${isFullScreenMode ? 'pl-8 pr-6 pt-1' : 'pb-3'}`}>
                    <div className="flex-grow min-h-0 overflow-hidden relative">
                      <TextEditor
                        readOnly={(isWidgetMode && isEditMode) || state.noteVersionIndex !== 0}
                        ref={state.editorRef}
                        value={textToDisplay()}
                        onChange={handleEditorChange}
                        placeholder="Start writing your note..."
                        onUpArrowAtStart={() => state.titleInputRef.current?.focus()}
                        showToolbar={true}
                        toolbarSelector={toolbarSelector}
                        isFocusMode={isFullScreenMode}
                        onDelete={onDeleteProp}
                        onImageSaveStart={state.onImageSaveStart}
                        onImageSaveEnd={state.onImageSaveEnd}
                        normalizeHtml={normalizeNoteBody}
                        syncRevision={state.syncRevision}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {!isWidgetMode && <div className={`relative z-50 mt-auto flex-shrink-0 ${isNormalNoteMode ? 'border-none' : 'border-t border-black/10 dark:border-white/10'} bg-[var(--color-editorBg)]`}>
                <div className="relative flex items-center justify-between gap-3 px-6 py-3 text-[10px] font-medium text-neutral-500 dark:text-neutral-400 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={state.handleClose}
                      className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800">
                      <span className="text-neutral-600 dark:text-neutral-300">Back</span>
                      <span className="flex items-center rounded border border-white/80 dark:border-white/20 bg-[var(--color-containerBg)] px-1 py-0 text-[9px] font-semibold text-neutral-500 dark:text-neutral-300">
                        Esc
                      </span>
                    </button>
                  </div>

                  <div className="flex-grow flex items-center justify-center gap-2">
                    <div
                      id={toolbarIdRef.current}
                      className="flex items-center justify-center empty:hidden !border-none !p-0"
                    />
                  </div>

                  {showTooltip &&
                    ReactDOM.createPortal(
                      <div
                        style={{
                          ...(isAltSOverlay ? altSAppearanceStyle : undefined),
                          position: 'absolute',
                          top: `${tooltipPos.top}px`,
                          left: `${tooltipPos.left}px`,
                          zIndex: 2147483647,
                          color: 'var(--color-textPrimary)',
                        }}
                        className="rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-modalBg)] px-3 py-2 shadow-[0_10px_40px_rgba(0,0,0,0.6)] z-alts-subpopup flex items-center gap-3 text-[12px] font-sans text-[var(--color-textPrimary)] pointer-events-none">
                        <div className="flex items-center gap-1">
                          <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-hoverBg)] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textPrimary)]">
                            Ctrl
                          </kbd>
                          <span className="text-[10px] text-[var(--color-textSecondary)] font-bold">+</span>
                          <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-hoverBg)] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textPrimary)]">
                            Shift
                          </kbd>
                          <span className="text-[10px] text-[var(--color-textSecondary)] font-bold">+</span>
                          <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-hoverBg)] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textPrimary)]">
                            Enter
                          </kbd>
                        </div>
                        <span className="text-[var(--color-textSecondary)] font-medium">to save and create another</span>
                      </div>,
                      isAltSOverlay
                        ? (window as any).__ALTS_MODAL_PORTAL_HOST__ ||
                          (window as any).__ALTQ_MODAL_PORTAL_HOST__ ||
                          (window as any).__ALTS_PORTAL_HOST__ ||
                          (window as any).__ALTQ_PORTAL_HOST__ ||
                          document.body
                        : document.body,
                    )}
                </div>
                {state.activeNoteId && (
                  <button
                    type="button"
                    onClick={handleCreateNew}
                    onMouseEnter={e => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltipPos({
                        top: rect.top + window.scrollY - 46,
                        left: rect.left + window.scrollX - 40,
                      });
                      setShowTooltip(true);
                    }}
                    onMouseLeave={() => setShowTooltip(false)}
                    className="absolute bottom-2.5 right-3 z-50 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all active:scale-95 border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] cursor-pointer select-none"
                  >
                    <span>Create another</span>
                  </button>
                )}
              </div>}
            </div>

            {/* Right Sidebar Column — unified RightSideItemsPanel */}
            {!isFullScreenMode && !isWidgetMode && !hideRightPanel && (
              <RightSideItemsPanel<any>
                hideBorder={isNormalNoteMode}
                items={filteredNotes}
                activeItemId={state.activeNoteId}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onCloseClick={state.handleClose}
                searchPlaceholder="Search notes..."
                getItemTitle={note => note.title || ''}
                getItemPreview={note => (note.body ? extractTextFromHTML(note.body).substring(0, 80) : '')}
                getItemCompoundId={note => getNoteCompoundId(note)}
                getItemType={() => 'note'}
                getItemWorkspaceId={note => note.workspaceId || null}
                getItemFolderId={note => note.folderId || null}
                getItemTagIds={note => note.tagIds || []}
                shortcutPrefix="c"
                shortcutsMap={shortcutsMap}
                hotkeysMap={hotkeysMap}
                workspaceNamesMap={workspaceNamesMap}
                folderNamesMap={folderNamesMap}
                tagNamesMap={tagNamesMap}
                onLoadItem={handleLoadNote}
                onDeleteItem={async id => {
                  try {
                    await deleteNote(id);
                    if (id === selectedNoteId || id === state.activeNoteId) {
                      state.setIsNoteDeleted(true);
                    }
                  } catch (err) {
                    console.error('Failed to delete note from list', err);
                  }
                }}
                onOpenerClick={item => handleOpenerClick(item.id)}
                onUpdateShortcut={async (id, val) => {
                  const noteItem = notes.find(n => n.id === id);
                  const compound = noteItem ? getNoteCompoundId(noteItem) : id;
                  if (val.trim()) {
                    const res = await validateShortcut(val.trim(), id);
                    if (!res.isValid) {
                      alert(res.errorMessage || 'Invalid shortcut');
                      return;
                    }
                    await saveShortcut(id, compound, val.trim(), noteItem?.title || 'Untitled Note', 'note');
                  } else {
                    await clearShortcut(id, compound, 'note');
                  }
                }}
                onUpdateTitle={async (id, val) => {
                  await updateNote(id, { title: val });
                }}
                onUpdateTags={async (id, tagText) => {
                  const tagNamesArr = tagText
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);
                  const targetNote = notes.find(n => n.id === id);
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
                  await updateNote(id, { tagIds: tagIdsToSave });
                }}
                isFavorite={isFavorite}
                toggleFavorite={toggleFavorite}
                addFavorite={addFavorite}
                isExpanded={isRightPanelExpanded}
                onExpandChange={setIsRightPanelExpanded}
                searchInputRef={rightSideSearchInputRef}
                emptyStateMessage="No notes found"
              />
            )}
          </div>
        )}
      </EditorContainer>

      {!isWidgetMode && (<>
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
      </>)}
    </>
  );
}
