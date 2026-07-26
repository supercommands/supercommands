import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { formatDistanceToNow } from 'date-fns';
import { FaFolder, FaTimes, FaCheckCircle, FaStar, FaKeyboard } from 'react-icons/fa';
import { FiStar, FiTag, FiChevronLeft, FiChevronRight, FiLoader, FiCopy } from 'react-icons/fi';
import type { SnippetRecord } from './snippetTypes';
import type { WorkspaceData } from '../../../../settings/allWorkspaceManager/workspaces/workspaceTypes';
import type { FolderData } from '../../../../settings/allWorkspaceManager/folders/folderTypes';
import type { NewSnippetBreadCrum, Tag } from '../../../../pages/popup/types/popupType';
import type { TagRecord } from '../tags/tagTypes';

interface Folder {
  folder_id: string;
  folder_name: string;
  snippets: SnippetRecord[];
  automations: any[];
  folders: Folder[];
}

interface Workspace {
  workspace_id: string;
  workspace_name: string;
  folders: Folder[];
  workspace_snippets: SnippetRecord[];
  workspace_automations: any[];
}

type FooterStatus = { type: 'idle' | 'saving' | 'saved' | 'error'; message: string };

import { useUIStore } from '../../../../shared-components/uiStateManager';
import { useDbStore } from '../../../../storage/store/useDbStore';
import { useSnippetEditor } from './useSnippetEditor';
import useNotification from '../../../../shared-components/notifications/useNotification';
import { AutoSaveIndicator } from '../../../../shared-components/autoSaveEngine/autoSave';
import { useFavorites } from '../../../../shared-components/favorites/favoriteHooks';
import { getItemCompoundId } from '../../../../shared-components/utils/idGenerator';
import { readAllShortcuts } from '../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { ExistingItemsTable } from '../../../../shared-components/editorContainer/ExistingItemsTable';
import { WorkspaceEditorLayout } from '../../../../shared-components/editorContainer/WorkspaceEditorLayout';
import { EditorTitleShortcutInput } from '../../../../shared-components/editorContainer/EditorTitleShortcutInput';
import { EditorContentWorkspace } from '../../../../shared-components/editorContainer/EditorContentWorkspace';
import { FiSearch } from 'react-icons/fi';
import { updateSnippet } from './snippetData';
import { createTag } from '../tags';
import { saveShortcut, clearShortcut, useShortcutValidation } from '../../../../shared-components/shortcuts';
import { SharedPropertiesToolbar } from '../../../../shared-components/editorToolbar/SharedPropertiesToolbar';

/**
 * Helper to convert an AST JSON string into readable plain text.
 */
function astToPlainText(astString: string): string {
  try {
    const ast = JSON.parse(astString);
    let result = '';
    const traverse = (nodes: any[]) => {
      if (!Array.isArray(nodes)) return;
      for (const node of nodes) {
        if (node.type === 'text') {
          result += node.value || node.text || '';
        } else if (node.type === 'field' || node.type === 'dropdown' || node.type === 'toggle') {
          const config = node.config || {};
          const alias = config.label || node.alias || node.id || 'Field';
          result += `{{${alias}}}`;
        }
        if (node.children) {
          traverse(node.children);
        }
      }
    };
    traverse(ast);
    return result;
  } catch (e) {
    return astString;
  }
}

import DeleteConfirmation from '../../../../shared-components/modals/deleteDialog';
import UnsavedChangesDialog from '../../../../shared-components/modals/unsavedChangesDialog';

import { SnippetBuilderMainViewProvider, SnippetBuilderMainViewEditor, SnippetBuilderMainViewSnippetFormattingToolbar } from './AdvancedSnippetEditor/SnippetBuilderMainView';
import VariableDropdown from '../../../../shared-components/inputs/VariableDropdown';
/**
 * Fallback tags to display if the organization has no tags.
 */
const generalTags: Tag[] = [
  { tag_id: '', name: 'Important' },
  { tag_id: '', name: 'Work' },
  { tag_id: '', name: 'Urgent' },
  { tag_id: '', name: 'Personal' },
];

interface EditSnippetScreenProps {
  selectedSnippet: SnippetRecord | null;
  isCreatingNew: boolean;
  snippetBreadCrum: NewSnippetBreadCrum | null;
  snippets?: SnippetRecord[];
  showFolderStructure?: boolean;
  reload: () => void;
  favoritesMapping: { [teamId: string]: SnippetRecord[] };
  setFavoritesMapping: (data: { [teamId: string]: SnippetRecord[] }) => void;
  onBack?: () => void;
  initialDraftKey?: string;
  initialDraftContent?: string;
  isFullScreenMode?: boolean; // True when rendered in FullScreenNoteView
  category?: string; // 'note' or 'snippet'
}

const EditSnippetScreenComponent: React.FC<EditSnippetScreenProps> = ({
  snippetBreadCrum,
  selectedSnippet,
  isCreatingNew,
  reload,
  favoritesMapping,
  setFavoritesMapping,
  onBack,
  initialDraftKey = '',
  initialDraftContent = '',
  isFullScreenMode = false,
  category,
}) => {
  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const snippets = useDbStore(state => state.snippets);
  const workspaces = useDbStore(state => state.workspaces);
  const folders = useDbStore(state => state.folders);
  const hotkeysMap = useDbStore(state => state.hotkeysMap);
  const tags = useDbStore(state => state.tags);

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

  const triggerNotification = useNotification();
  const [snippetToDeleteId, setSnippetToDeleteId] = useState<string | null>(null);
  const {
    snippetTitle,
    snippetConfig,
    snippetShortcut,
    activeSnippetId,
    workspaceId,
    folderId,
    tagIds,
    saveStatus,
    setSaveStatus,
    lastSavedAt,
    setLastSavedAt,
    lastSavedTitleRef,
    lastSavedShortcutRef,
    isDirty,
    setSnippetTitle,
    setSnippetConfig,
    setSnippetShortcut,
    handleSave,
    handleDelete,
    handleClose,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    isUnsavedChangesDialogOpen,
    setIsUnsavedChangesDialogOpen,
    handlePropertiesChange,
    loadSnippet,
    isInitialized,
    isShortcutInitialized,
  } = useSnippetEditor({
    snippetId: selectedSnippet?.id || (selectedSnippet as any)?.snippet_id,
    onBack,
    initialDraftKey,
    initialDraftConfig: initialDraftContent,
  });


  const sortedSnippets = useMemo(() => {
    return [...snippets].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [snippets]);

  const [showToolbar, setShowToolbar] = useState(true);
  const isUserKeyManuallySetRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null); // Quill instance ref
  const quillToolbarRef = useRef<HTMLElement | null>(null);

  const isFocusMode = useUIStore((s: any) => s.isFocusMode);
  const isLinkEditModalOpen = useUIStore((s: any) => s.activeEditor?.type === 'link');

  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [isToolbarVisible, setIsToolbarVisible] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // Sidebar always visible

  const { isFavorite, toggleFavorite } = useFavorites();
  const [shortcutsMap, setShortcutsMap] = useState<Record<string, string>>({});

  const [searchQuery, setSearchQuery] = useState('');

  const filteredSnippets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sortedSnippets;
    return sortedSnippets.filter(s => {
      const compoundId = getItemCompoundId({
        snippet: s,
        workspace: s.workspaceId ? { workspace_id: s.workspaceId } : null,
        folder: s.folderId ? { folder_id: s.folderId } : null
      });
      const sc = shortcutsMap[compoundId] || '';
      const titleMatch = (s.title || '').toLowerCase().includes(query);
      const shortcutMatch = sc.toLowerCase().includes(query);
      const contentMatch = (typeof s.config === 'string' ? s.config : JSON.stringify(s.config)).toLowerCase().includes(query);
      return titleMatch || shortcutMatch || contentMatch;
    });
  }, [sortedSnippets, searchQuery, shortcutsMap]);

  const fetchAllShortcuts = useCallback(async () => {
    try {
      const map = await readAllShortcuts();
      setShortcutsMap(map);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchAllShortcuts();
  }, [fetchAllShortcuts, activeSnippetId, saveStatus]);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const shortcutInputRef = useRef<HTMLInputElement>(null);
  const hotkeyButtonRef = useRef<HTMLButtonElement>(null);
  const toolbarBtnRef = useRef<HTMLButtonElement>(null);
  const fullscreenBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [footerStatus, setFooterStatus] = useState<FooterStatus>({ type: 'idle', message: '' });
  const [titleError, setTitleError] = useState<string | null>(null);
  const [searchtags, setSearchtags] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const rawSearchTagsRef = useRef<Record<string, string[]>>({});

  const isDuplicateTitle = useMemo(() => {
    const trimmedTitle = snippetTitle.trim().toLowerCase();
    if (!trimmedTitle) return false;
    return snippets.some(s => {
      const snippetId = s.id;
      if (snippetId === activeSnippetId) return false;
      return String(s.title || '').trim().toLowerCase() === trimmedTitle;
    });
  }, [snippetTitle, snippets, activeSnippetId]);

  const showFooterStatus = (type: FooterStatus['type'], message: string) => {
    setFooterStatus({ type, message });
    if (type !== 'idle' && type !== 'saving') {
      setTimeout(() => {
        setFooterStatus({ type: 'idle', message: '' });
      }, 3000);
    }
  };

  useEffect(() => {
    if (isCreatingNew) {
      // If we have an initial draft key (from expand to full-screen),
      // treat it as manually set to prevent auto-generation
      isUserKeyManuallySetRef.current = !!initialDraftKey;
    }
  }, [isCreatingNew, initialDraftKey]);

  // Formatting state
  const [formatState, setFormatState] = useState({
    bold: false,
    italic: false,
    underline: false,
  });

  const handleUpdateItemField = useCallback(async (id: string, field: 'title' | 'shortcut' | 'tags', value: string) => {
    try {
      const existing = snippets.find(s => s.id === id);
      if (!existing) return;

      if (field === 'title') {
        const updatedTitle = value.trim() || 'Untitled Snippet';
        await updateSnippet(id, { title: updatedTitle });

        const wsObj = existing.workspaceId ? { workspace_id: existing.workspaceId } : null;
        const fldObj = existing.folderId ? { folder_id: existing.folderId } : null;
        const compoundId = getItemCompoundId({ snippet: { id }, workspace: wsObj, folder: fldObj });
        const sc = shortcutsMap[compoundId] || '';
        if (sc) {
          await saveShortcut(id, compoundId, sc.toLowerCase(), updatedTitle, 'snippet');
        }
        if (id === activeSnippetId) {
          setSnippetTitle(updatedTitle);
          if (lastSavedTitleRef) lastSavedTitleRef.current = updatedTitle;
        }
      } else if (field === 'shortcut') {
        const finalShortcut = value.toLowerCase().replace(/[^a-z0-9]/g, '');

        const wsObj = existing.workspaceId ? { workspace_id: existing.workspaceId } : null;
        const fldObj = existing.folderId ? { folder_id: existing.folderId } : null;
        const compoundId = getItemCompoundId({ snippet: { id }, workspace: wsObj, folder: fldObj });
        if (finalShortcut) {
          await saveShortcut(id, compoundId, finalShortcut, existing.title, 'snippet');
        } else {
          await clearShortcut(id, compoundId, 'snippet');
        }
        if (id === activeSnippetId) {
          setSnippetShortcut(finalShortcut);
          if (lastSavedShortcutRef) lastSavedShortcutRef.current = finalShortcut;
        }
      } else if (field === 'tags') {
        const tagNames = value.split(',').map(t => t.trim()).filter(Boolean);
        const activeWorkspaceId = existing.workspaceId;
        const resolvedTags: any[] = [];

        for (const name of tagNames) {
          const matchedTag = tags.find(t => t.name.toLowerCase() === name.toLowerCase() && t.workspaceId === activeWorkspaceId);
          if (matchedTag) {
            resolvedTags.push(matchedTag);
          } else if (activeWorkspaceId) {
            const newTag = await createTag(name, activeWorkspaceId);
            resolvedTags.push(newTag);
          }
        }

        const resolvedTagIds = resolvedTags.map(t => t.id);
        await updateSnippet(id, { tagIds: resolvedTagIds });

        if (id === activeSnippetId) {
          handlePropertiesChange({ selectedTags: resolvedTags });
        }
      }

      if (id === activeSnippetId) {
        if (setSaveStatus) setSaveStatus('saved');
        if (setLastSavedAt) setLastSavedAt(new Date());
      }

      await fetchAllShortcuts();
    } catch (e) {
      console.error('[handleUpdateItemField] Failed:', e);
    }
  }, [snippets, activeSnippetId, shortcutsMap, setSnippetTitle, setSnippetShortcut, setSaveStatus, setLastSavedAt, lastSavedTitleRef, lastSavedShortcutRef, fetchAllShortcuts, tags, handlePropertiesChange]);

  const handleCopyTitleToShortcut = useCallback(() => {
    if (!snippetTitle.trim()) return;
    const sanitized = snippetTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
    setSnippetShortcut(sanitized);

    setTimeout(() => {
      const editorDom = containerRef.current?.querySelector('.ProseMirror') as HTMLElement | null;
      editorDom?.focus();
    }, 50);
  }, [snippetTitle, setSnippetShortcut]);

  const { validateShortcut } = useShortcutValidation();
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  const [isShortcutOverrideable, setIsShortcutOverrideable] = useState<boolean>(false);
  const [shortcutConflictId, setShortcutConflictId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const checkShortcut = async () => {
      if (snippetShortcut) {
        const currentCompound = getItemCompoundId({
          id: activeSnippetId,
          workspace_id: workspaceId || null,
          folder_id: folderId || null,
          snippet: { id: activeSnippetId, category: 'snippet' },
        });
        if (shortcutsMap && shortcutsMap[currentCompound] === snippetShortcut) {
          if (active) {
            setShortcutError(null);
            setIsShortcutOverrideable(false);
            setShortcutConflictId(null);
          }
          return;
        }
        const res = await validateShortcut(snippetShortcut, activeSnippetId || 'new');
        if (active) {
          if (!res.isValid) {
            setShortcutError(res.errorMessage || 'This shortcut is already taken.');
            setIsShortcutOverrideable(!!res.isOverrideable);
            setShortcutConflictId(res.conflictId || null);
          } else {
            setShortcutError(null);
            setIsShortcutOverrideable(false);
            setShortcutConflictId(null);
          }
        }
      } else {
        if (active) {
          setShortcutError(null);
          setIsShortcutOverrideable(false);
          setShortcutConflictId(null);
        }
      }
    };
    void checkShortcut();
    return () => {
      active = false;
    };
  }, [snippetShortcut, activeSnippetId, shortcutsMap, workspaceId, folderId, validateShortcut]);

  const handleOverrideShortcut = useCallback(async () => {
    if (!snippetShortcut) return;
    console.log('[ShortcutDebug][SnippetEditor] Executing handleOverrideShortcut for snippetShortcut:', snippetShortcut);
    let targetId = activeSnippetId;
    if (!targetId) {
      console.log('[ShortcutDebug][SnippetEditor] Saving new snippet to get real ID before shortcut reassignment...');
      const saved = await handleSave();
      if (!saved) return;
      targetId = activeSnippetId;
    }
    if (!targetId) return;

    if (shortcutConflictId) {
      console.log('[ShortcutDebug][SnippetEditor] Explicitly clearing conflicting shortcut reference:', shortcutConflictId);
      await clearShortcut(shortcutConflictId, shortcutConflictId, 'snippet');
    }

    const currentCompound = getItemCompoundId({
      id: targetId,
      workspace_id: workspaceId || null,
      folder_id: folderId || null,
      snippet: { id: targetId, category: 'snippet' },
    });
    console.log(`[ShortcutDebug][SnippetEditor] Saving shortcut "${snippetShortcut}" to target ID "${targetId}" (compound: ${currentCompound})...`);
    await saveShortcut(targetId, currentCompound, snippetShortcut, snippetTitle || 'Snippet', 'snippet');
    console.log('[ShortcutDebug][SnippetEditor] Shortcut reassignment saved to DB. Clearing validation error.');
    setShortcutError(null);
    setIsShortcutOverrideable(false);
    setShortcutConflictId(null);
    const saved = await handleSave();
    if (saved) fetchAllShortcuts();
  }, [snippetShortcut, activeSnippetId, workspaceId, folderId, snippetTitle, shortcutConflictId, handleSave, fetchAllShortcuts]);



  // Track if we've already focused for the current note
  const hasFocusedRef = useRef<string | null>(null);

  // Focus the editor (description area) only once when a note is first opened
  useEffect(() => {
    // Create a unique key for the current note
    const noteKey = selectedSnippet?.id || (isCreatingNew ? 'new-note' : null);

    // Only focus if this is a different note than the last one we focused
    if (noteKey && hasFocusedRef.current !== noteKey) {
      hasFocusedRef.current = noteKey;

      // Wait a bit for the editor to be ready and content to be loaded
      const focusTimeout = setTimeout(() => {
        const input = titleInputRef.current;
        if (input) {
          input.focus();
          const length = input.value.length;
          input.setSelectionRange(length, length);
        }
      }, 100); // Short timeout to ensure render

      return () => clearTimeout(focusTimeout);
    }

    // Reset the focus ref when note is closed
    if (!noteKey) {
      hasFocusedRef.current = null;
    }

    return undefined;
  }, [selectedSnippet?.id, isCreatingNew, selectedSnippet, snippetConfig]);

  // Control Quill toolbar visibility
  useEffect(() => {
    const updateToolbarVisibility = () => {
      // Find the Quill toolbar within the container
      const toolbar = containerRef.current?.querySelector('.ql-toolbar') as HTMLElement | null;
      if (toolbar) {
        quillToolbarRef.current = toolbar;
        const variableButton = toolbar.querySelector('.ql-variable') as HTMLElement | null;
        const variableFormatGroup = variableButton?.closest('.ql-formats') as HTMLElement | null;

        if (!isToolbarVisible) {
          // Hide all formatting buttons but keep variable button visible
          const allButtons = toolbar.querySelectorAll('button');
          allButtons.forEach(btn => {
            if (!btn.classList.contains('ql-variable')) {
              (btn as HTMLElement).style.display = 'none';
            }
          });
          // Hide format groups that don't contain variable button
          const formatGroups = toolbar.querySelectorAll('.ql-formats');
          formatGroups.forEach(group => {
            if (group !== variableFormatGroup) {
              (group as HTMLElement).style.display = 'none';
            } else {
              // Ensure variable button's format group is visible
              (group as HTMLElement).style.display = '';
            }
          });
          // Ensure variable button is visible
          if (variableButton) {
            variableButton.style.display = 'flex';
          }
        } else {
          // Show all toolbar buttons and groups
          const allButtons = toolbar.querySelectorAll('button');
          allButtons.forEach(btn => {
            (btn as HTMLElement).style.display = '';
          });
          const formatGroups = toolbar.querySelectorAll('.ql-formats');
          formatGroups.forEach(group => {
            (group as HTMLElement).style.display = '';
          });
        }
      }
    };

    // Initial setup and watch for changes
    const timeout = setTimeout(updateToolbarVisibility, 100);
    // Use MutationObserver to watch for toolbar changes
    const observer = new MutationObserver(updateToolbarVisibility);
    if (containerRef.current) {
      observer.observe(containerRef.current, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      clearTimeout(timeout);
      observer.disconnect();
    };
  }, [isToolbarVisible, selectedSnippet?.id, isCreatingNew]);





  const handleCreateNew = useCallback(async () => {
    if (isDirty) {
      await handleSave();
    }
    loadSnippet(null);
    setShowTooltip(false);
    if (titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isDirty, handleSave, loadSnippet]);

  const closeEditor = useCallback(() => {

    // Reset Focus Mode when leaving
    useUIStore.getState().toggleFocusMode(false);
    useUIStore.getState().setSelectedWorkspaceId(null);
    useUIStore.getState().setSelectedFolderId(null);
    useUIStore.getState().setSnippetBreadcrumb(null);
    useUIStore.getState().setSelectedSnippetId(null);

    if (onBack) {
      onBack();
    } else {
      useUIStore.getState().closeEditor();
    }
  }, [onBack]);

  const handleEscapeSaveAndClose = useCallback(() => {
    if (isDirty) {
      setIsUnsavedChangesDialogOpen(true);
      return true; // Indicate we intercepted the escape
    } else {
      // Don't closeEditor here, uiStateManager will do it if we return false
      return false;
    }
  }, [isDirty, setIsUnsavedChangesDialogOpen]);

  // Register escape handler with uiStateManager
  useEffect(() => {
    const handler = () => {
      if (isFocusMode) {
        useUIStore.getState().toggleFocusMode(false);
        return true;
      }
      if (isUnsavedChangesDialogOpen || isLocationPickerOpen || isDeleteDialogOpen || isShareDialogOpen || isLinkEditModalOpen || document.getElementById('hotkey-assignment-popup')) {
        return true;
      }
      const handled = handleEscapeSaveAndClose();
      return handled;
    };
    useUIStore.getState().setEditorEscapeHandler(handler);
    return () => useUIStore.getState().setEditorEscapeHandler(null);
  }, [isFocusMode, isUnsavedChangesDialogOpen, isLocationPickerOpen, isDeleteDialogOpen, isShareDialogOpen, isLinkEditModalOpen, handleEscapeSaveAndClose]);

  const handleGoHome = useCallback(() => {
    closeEditor();
  }, [closeEditor]);



  // Shortcut listeners (Save + Escape)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {

      // Ctrl+Enter (Win) or Cmd+Enter (Mac) for Save
      const isCtrlEnter = (isMac ? event.metaKey : event.ctrlKey) && event.key === 'Enter';

      if (isCtrlEnter) {
        event.preventDefault();
        if (saveStatus === 'saving') return;

        if (event.shiftKey) {
          void handleCreateNew();
        } else {
          void handleSave(false);
        }
      }

      // Alt+Enter to toggle Location Picker
      const isLocationPickerShortcut = event.altKey && event.key === 'Enter';


      if (isLocationPickerShortcut) {

        event.preventDefault();
        if (workspaces.length === 0) {
          triggerNotification('Create a workspace or folder before saving.', 'info');
          return;
        }

        setIsLocationPickerOpen(prev => !prev);
      }
    };

    // Use Capture phase (true) to ensure we catch Esc before the editor swallows it
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    isLocationPickerOpen,
    isDeleteDialogOpen,
    isShareDialogOpen,
    saveStatus,
    snippetBreadCrum,
    workspaces,
    triggerNotification,
    isFocusMode,
    isMac,
    closeEditor,
    isUnsavedChangesDialogOpen,
    handleEscapeSaveAndClose,
    isLinkEditModalOpen,
    handleCreateNew,
  ]);

  // Browser-level warning for unsaved changes (e.g., closing tab/window)
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Add state for folder structure dialog
  const [showFolderStructureDialog, setShowFolderStructureDialog] = useState(false);

  // Handle workspace and folder selection
  const handleWorkspaceSelect = (workspaceId: string, workspaceName: string) => {
    const workspaceObj = workspaces.find(ws => ws.id === workspaceId);
    if (!workspaceObj) return;

    // Create new bread crumb with the selected workspace
    const newBreadCrum = {
      workspace_id: workspaceId,
      workspace_name: workspaceName,
      folder_id: null,
      folder_name: null,
    };

    // Update local UI state - Clear folder selection when selecting workspace
    useUIStore.getState().setSelectedWorkspaceId(workspaceObj.id);
    useUIStore.getState().setSelectedFolderId(null);
    useUIStore.getState().setSnippetBreadcrumb(newBreadCrum);

    // Logic to preserve content if editing existing note or active draft
    if (activeSnippetId) {
      // Existing note: Only location updated above. Content logic preserved.
    } else {
      // New Note / Draft
      const hasContent = snippetTitle.trim().length > 0 || (typeof snippetConfig === 'string' ? snippetConfig.trim().length > 0 : JSON.stringify(snippetConfig).trim().length > 0 && JSON.stringify(snippetConfig) !== '{}');

      if (!hasContent) {
        setSnippetTitle('');
        setSnippetConfig('');
      }

      useUIStore.getState().setSelectedSnippetId(null);
      /* setIsCreatingNewItem removed */;
    }

    // Close the dialog
    setShowFolderStructureDialog(false);
  };

  const handleFolderSelect = (
    workspaceId: string,
    workspaceName: string,
    folderId: string,
    folderName: string,
    folderPathNames?: string[],
  ) => {
    const workspaceObj = workspaces.find(ws => ws.id === workspaceId);
    if (!workspaceObj) return;

    // Create new bread crumb with the selected workspace, folder, and folder path
    const newBreadCrum: any = {
      workspace_id: workspaceId,
      workspace_name: workspaceName,
      folder_id: folderId,
      folder_name: folderName,
    };

    // Add folder path names if provided (for full hierarchy display)
    if (folderPathNames && folderPathNames.length > 0) {
      newBreadCrum.folder_path_names = folderPathNames;
    }

    // Update Redux state - IMPORTANT: Set both workspace AND folder
    useUIStore.getState().setSelectedWorkspaceId(workspaceObj.id);
    // Note: selectedFolder might not be found for nested folders, that's OK
    useUIStore.getState().setSnippetBreadcrumb(newBreadCrum);

    // Logic to preserve content if editing existing note or active draft
    if (activeSnippetId) {
      // Existing note: Only location updated above. Content logic preserved.
    } else {
      // New Note / Draft
      const hasContent = snippetTitle.trim().length > 0 || (typeof snippetConfig === 'string' ? snippetConfig.trim().length > 0 : JSON.stringify(snippetConfig).trim().length > 0 && JSON.stringify(snippetConfig) !== '{}');

      if (!hasContent) {
        setSnippetTitle('');
        setSnippetConfig('');
      }

      useUIStore.getState().setSelectedSnippetId(null);
      /* setIsCreatingNewItem removed */;
    }

    // Close the dialog
    setShowFolderStructureDialog(false);
  };

  // Destination helpers
  const handleWorkspaceDestination = (workspace: Workspace, isPersonal?: boolean) => {
    handleWorkspaceSelect(workspace.workspace_id, workspace.workspace_name);

    // Save as last used destination
    chrome.storage.local.set({
      lastNoteDestination: {
        workspace_id: workspace.workspace_id,
        folder_id: null,
      },
    });

    setIsLocationPickerOpen(false); // Close the location picker
  };

  const handleFolderDestination = (
    workspace: Workspace,
    folder: Folder,
    isPersonal?: boolean,
    folderPath?: Folder[],
  ) => {
    // Extract folder names from path for display
    const folderPathNames = folderPath?.map(f => f.folder_name) || [folder.folder_name];
    handleFolderSelect(
      workspace.workspace_id,
      workspace.workspace_name,
      folder.folder_id,
      folder.folder_name,
      folderPathNames,
    );

    // Save as last used destination
    chrome.storage.local.set({
      lastNoteDestination: {
        workspace_id: workspace.workspace_id,
        folder_id: folder.folder_id,
      },
    });

    setIsLocationPickerOpen(false); // Close the location picker
  };

  // Determine placeholder based on category
  const titlePlaceholder = 'Title';

  const initialProperties = useMemo(() => {
    const base: any = selectedSnippet || {};
    return {
      ...base,
      id: activeSnippetId || base.id,
      workspaceId: workspaceId || base.workspaceId,
      folderId: folderId || base.folderId,
      tagIds: tagIds !== undefined ? tagIds : (base.tagIds || []),
      category: 'snippet',
    };
  }, [selectedSnippet, activeSnippetId, workspaceId, folderId, tagIds]);

  const snippetCompoundId = useMemo(() => {
    if (!activeSnippetId || activeSnippetId === 'new') return '';
    const wsObj = workspaceId ? { workspace_id: workspaceId } : null;
    const fldObj = folderId ? { folder_id: folderId } : null;
    const snipObj = selectedSnippet || { id: activeSnippetId, category: 'snippet', key: snippetTitle || '' };
    return getItemCompoundId({ snippet: snipObj as any, workspace: wsObj as any, folder: fldObj as any });
  }, [activeSnippetId, selectedSnippet, workspaceId, folderId, snippetTitle]);

  const editorContentNode = (
    <WorkspaceEditorLayout
      title={activeSnippetId ? 'Edit snippet' : 'Create a snippet'}
      isDirty={isDirty}
      saveStatus={saveStatus}
      lastSavedAt={lastSavedAt}
      activeId={activeSnippetId}
      isFocusMode={isFocusMode}
      showConfigureHeader={true}
      hideRightColumnBorder={category !== 'snippet'}
      headerActions={
        <SharedPropertiesToolbar
          key={activeSnippetId || 'new-snippet'}
          initialSnippet={initialProperties}
          compoundId={snippetCompoundId}
          defaultName={snippetTitle || 'Untitled'}
          showShortcut={false}
          showTodo={false}
          layout="horizontal"
          onChange={handlePropertiesChange}
          openPopupsToBottom={true}
        />
      }
      onSave={async () => {
        const saved = await handleSave(false);
        return saved;
      }}
      onDiscard={() => {
        // Discard draft or reset local states if required
      }}
      onCloseCallback={onBack}
      deleteModalProps={{
        isOpen: isDeleteDialogOpen,
        onClose: () => {
          setIsDeleteDialogOpen(false);
          setSnippetToDeleteId(null);
        },
        onConfirm: async () => {
          if (snippetToDeleteId) {
            try {
              const wsObj = workspaceId ? { workspace_id: workspaceId } : null;
              const fldObj = folderId ? { folder_id: folderId } : null;
              const compoundId = getItemCompoundId({ snippet: { id: snippetToDeleteId }, workspace: wsObj, folder: fldObj });
              await clearShortcut(snippetToDeleteId, compoundId, 'snippet');
              const { deleteSnippet } = await import('./snippetData');
              await deleteSnippet(snippetToDeleteId);
              if (snippetToDeleteId === activeSnippetId) {
                loadSnippet(null);
              }
            } catch (err) {
              console.error('Delete failed:', err);
            }
          }
          setIsDeleteDialogOpen(false);
          setSnippetToDeleteId(null);
        },
        title: snippetToDeleteId && filteredSnippets.find(s => s.id === snippetToDeleteId)?.title ? `Delete "${filteredSnippets.find(s => s.id === snippetToDeleteId)?.title}"?` : 'Delete this snippet?',
        description: "Are you sure you want to delete this snippet? This action cannot be undone."
      }}
      rightColumnContent={
        category === 'snippet' ? (
          <SnippetBuilderMainViewSnippetFormattingToolbar
            activeSnippetId={activeSnippetId}
            snippet={selectedSnippet}
            workspaceId={workspaceId}
            folderId={folderId}
            tagIds={tagIds}
            snippetTitle={snippetTitle}
            onChange={handlePropertiesChange}
          />
        ) : null
      }
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      searchPlaceholder="Search snippets..."
      bottomListContent={
        <ExistingItemsTable
          items={filteredSnippets}
          activeItemId={activeSnippetId}
          onLoadItem={loadSnippet}
          getItemTitle={(snip) => snip.title || ''}
          getItemPreview={(snip) => astToPlainText(typeof snip.config === 'string' ? snip.config : JSON.stringify(snip.config))}
          getItemCompoundId={(snip) => getItemCompoundId({
            snippet: snip,
            workspace: snip.workspaceId ? { workspace_id: snip.workspaceId } : null,
            folder: snip.folderId ? { folder_id: snip.folderId } : null
          })}
          getItemType={() => 'snippet'}
          shortcutsMap={shortcutsMap}
          hotkeysMap={hotkeysMap}
          isFavorite={isFavorite}
          toggleFavorite={toggleFavorite}
          onDeleteClick={(id) => {
            setSnippetToDeleteId(id);
            setIsDeleteDialogOpen(true);
          }}
          onFavoriteToggled={fetchAllShortcuts}
          onUpdateItemField={handleUpdateItemField}
          folderNamesMap={folderNamesMap}
          workspaceNamesMap={workspaceNamesMap}
          tagNamesMap={tagNamesMap}
          emptyStateMessage="No snippets found. Type above to create your first snippet!"
          isFullScreenMode={isFullScreenMode}
          title=""
        />
      }
    >
      {/* Center Column: Snippet content */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        <div className="w-full flex-1 flex flex-col min-h-0 px-3 pt-0.5 pb-2">
          <EditorTitleShortcutInput
            title={snippetTitle}
            setTitle={(val) => {
              setSnippetTitle(val);
              if (val.trim()) setTitleError(null);
            }}
            titleError={titleError}
            shortcutError={shortcutError}
            isOverrideable={isShortcutOverrideable}
            onOverrideShortcut={handleOverrideShortcut}
            shortcut={snippetShortcut}
            setShortcut={setSnippetShortcut}
            titleRef={titleInputRef}
            shortcutRef={shortcutInputRef}
            onTitleBlur={async () => {
              if (!snippetTitle.trim()) {
                setTitleError('Enter the title');
              } else if (isDirty) {
                const saved = await handleSave();
                if (saved) fetchAllShortcuts();
              }
            }}
            onShortcutBlur={async () => {
              if (isDirty) {
                const saved = await handleSave();
                if (saved) fetchAllShortcuts();
              }
            }}
            onTitleEnter={async (shiftKey) => {
              if (shiftKey) {
                handleCopyTitleToShortcut();
              } else {
                if (!snippetTitle.trim()) {
                  setTitleError('Enter the title');
                } else if (isDirty) {
                  const saved = await handleSave();
                  if (saved) fetchAllShortcuts();
                }
              }
            }}
            onShortcutEnter={async () => {
              if (isDirty) {
                const saved = await handleSave();
                if (saved) fetchAllShortcuts();
              }
            }}
            onArrowDownPress={() => {
              const editorDom = containerRef.current?.querySelector('.ProseMirror') as HTMLElement | null;
              editorDom?.focus();
            }}
            onCopyTitleToShortcut={(isInitialized && isShortcutInitialized) ? handleCopyTitleToShortcut : undefined}
          />

          <EditorContentWorkspace
            category="snippet"
            containerRef={containerRef}
            onBlurCapture={() => {
              if (isDirty) {
                void handleSave();
              }
            }}
            onCreateAnother={handleCreateNew}
            activeId={activeSnippetId}
          />
        </div>
      </div>
    </WorkspaceEditorLayout>
  );

  const activeSnippet = useMemo(() => {
    if (!activeSnippetId) return null;
    return snippets.find(s => s.id === activeSnippetId) || null;
  }, [activeSnippetId, snippets]);

  const initialSnippetContent = useMemo(() => {
    if (!activeSnippet) return '';
    return activeSnippet.config || '';
  }, [activeSnippet?.id]);

  const loadedSnippetIdRef = useRef<string | null>(activeSnippetId);
  const [editorKey, setEditorKey] = useState<string>(() => activeSnippetId || `new_${Date.now()}`);

  useEffect(() => {
    if (activeSnippetId !== loadedSnippetIdRef.current) {
      const wasDraft = loadedSnippetIdRef.current === null;
      loadedSnippetIdRef.current = activeSnippetId;
      if (!wasDraft || !activeSnippetId) {
        setEditorKey(activeSnippetId || `new_${Date.now()}`);
      }
      
      // Clear any validation errors from the previous snippet/draft
      setTitleError(null);
      setShortcutError(null);
    }
  }, [activeSnippetId]);

  return (
    <SnippetBuilderMainViewProvider key={editorKey} initialContent={initialSnippetContent as any} onChange={(content: any) => {
      let parsed = content;
      if (typeof content === 'string') {
        try {
          parsed = JSON.parse(content);
        } catch (e) {
          // ignore
        }
      }
      setSnippetConfig(parsed);
    }}>
      {editorContentNode}
    </SnippetBuilderMainViewProvider>
  );
};

export const EditSnippetScreen = React.memo(EditSnippetScreenComponent);
export default EditSnippetScreen;
