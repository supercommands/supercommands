import TextExpanderIcon from '../../../../shared-components/icons/TextExpanderIcon';
import type { ShortcutAssignmentApproval } from '../../../../shared-components/shortcuts/core/shortcutAssignmentTypes';
import { EditorBackButton } from '../../../../shared-components/editorContainer/EditorBackButton';
import { FUNCTIONAL_EDITOR_SURFACE_STYLE, PURE_BLACK_EDITOR_BACKGROUND } from '../../../../shared-components/editorContainer/functionalEditorSurfaceStyle';
import * as React from 'react';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { BRAND } from '../../../../shared-components/brandingConfig';
import { formatDistanceToNow } from 'date-fns';
import { FaFolder, FaTimes, FaCheckCircle, FaStar, FaKeyboard } from 'react-icons/fa';
import { FiStar, FiTag, FiChevronLeft, FiChevronRight, FiLoader, FiCopy } from 'react-icons/fi';
import type { CreateSnippetInput, SnippetRecord, UpdateSnippetInput } from './snippetTypes';
import type { OrganisationData } from '../../../../settings/allOrganisationManager/organisations/organisationTypes';
import type { NewSnippetBreadCrum, Tag } from '../../../../pages/popup/types/popupType';
import type { TagRecord } from '../tags/tagTypes';
interface Organisation {
    organisation_id: string;
    organisation_name: string;
    organisation_snippets: SnippetRecord[];
    organisation_automations: any[];
}
type FooterStatus = {
    type: 'idle' | 'saving' | 'saved' | 'error';
    message: string;
};
import { useUIStore } from '../../../../shared-components/uiStateManager';
import { useDbStore } from '../../../../storage/store/useDbStore';
import { useSnippetEditor } from './useSnippetEditor';
import useNotification from '../../../../shared-components/notifications/useNotification';
import { AutoSaveIndicator } from '../../../../shared-components/autoSaveEngine/autoSave';
import { useFavorites } from '../../../../shared-components/favorites/favoriteHooks';
import { getItemCompoundId } from '../../../../shared-components/utils/idGenerator';
import { readAllShortcuts } from '../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { ExistingItemsTable } from '../../../../shared-components/editorContainer/ExistingItemsTable';
import { RightSideItemsPanel } from '../../../../shared-components/editorContainer/RightSideItemsPanel';
import { EditorTopRightChrome } from '../../../../shared-components/editorContainer/EditorTopRightChrome';
import { WorkspaceEditorLayout } from '../../../../shared-components/editorContainer/WorkspaceEditorLayout';
import { EditorHeader } from '../../../../shared-components/editorContainer/EditorHeader';
import { EditorTitleShortcutInput } from '../../../../shared-components/editorContainer/EditorTitleShortcutInput';
import { EditorContentWorkspace } from '../../../../shared-components/editorContainer/EditorContentWorkspace';
import { FiSearch } from 'react-icons/fi';
import { updateSnippet } from './snippetData';
import { createTag } from '../tags';
import { saveShortcut, clearShortcut, useShortcutValidation } from '../../../../shared-components/shortcuts';
import { saveHotkey as apiSaveHotkey, clearHotkey as apiClearHotkey } from '../../../../shared-components/hotkeys';
import { SharedPropertiesToolbar } from '../../../../shared-components/editorToolbar/SharedPropertiesToolbar';
import TextExpanderCollectionSheetView, { snippetConfigToPlainText, textToSnippetConfig, } from '../../../../shared-components/todosSheet/TextExpanderCollectionSheetView';
/**
 * Helper to convert an AST JSON string into readable plain text.
 */
function astToPlainText(astString: string): string {
    try {
        const ast = JSON.parse(astString);
        let result = '';
        const traverse = (nodes: any[]) => {
            if (!Array.isArray(nodes))
                return;
            for (const node of nodes) {
                if (node.type === 'text') {
                    result += node.value || node.text || '';
                }
                else if (node.type === 'field' || node.type === 'dropdown' || node.type === 'toggle') {
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
    }
    catch (e) {
        return astString;
    }
}
import DeleteConfirmation from '../../../../shared-components/modals/deleteDialog';
import UnsavedChangesDialog from '../../../../shared-components/modals/unsavedChangesDialog';
import { SnippetBuilderMainViewProvider, SnippetBuilderMainViewEditor, SnippetBuilderMainViewSnippetFormattingToolbar, } from './AdvancedSnippetEditor/SnippetBuilderMainView';
import VariableDropdown from '../../../../shared-components/inputs/VariableDropdown';
/**
 * Fallback tags to display if the organization has no tags.
 */
const generalTags: Tag[] = [
    { tag_id: '', name: 'Important' },
    { tag_id: '', name: 'Work' },
    { tag_id: '', name: 'Urgent' },
    { tag_id: '', name: 'Personal' }
];
interface EditSnippetScreenProps {
    selectedSnippet: SnippetRecord | null;
    isCreatingNew: boolean;
    snippetBreadCrum: NewSnippetBreadCrum | null;
    snippets?: SnippetRecord[];
    reload: () => void;
    favoritesMapping: {
        [userId: string]: SnippetRecord[];
    };
    setFavoritesMapping: (data: {
        [userId: string]: SnippetRecord[];
    }) => void;
    onBack?: () => void;
    initialDraftKey?: string;
    initialDraftContent?: string;
    initialTagIds?: string[];
    onSnippetCreated?: (snippet: SnippetRecord) => void | Promise<void>;
    isFullScreenMode?: boolean; // True when rendered in FullScreenNoteView
    isOverlay?: boolean;
    hideRightPanel?: boolean;
    appearanceScope?: 'default' | 'alts';
    workspaceCollectionMode?: boolean;
    workspaceCollectionFilterTagIds?: string[];
    organisationCollectionOrganisationId?: string | null;
    forceCreateEditor?: boolean;
    appearanceTokens?: React.CSSProperties;
    saveSnippetAdapter?: (args: {
        mode: 'create' | 'update';
        snippetId?: string;
        input: CreateSnippetInput | UpdateSnippetInput;
    }) => Promise<SnippetRecord>;
    propertyPersistenceAdapter?: React.ComponentProps<typeof SharedPropertiesToolbar>['propertyPersistenceAdapter'];
    category?: string; // 'note' or 'snippet'
}
const EditSnippetScreenComponent: React.FC<EditSnippetScreenProps> = ({ snippetBreadCrum, selectedSnippet, isCreatingNew, reload, favoritesMapping, setFavoritesMapping, onBack, initialDraftKey = '', initialDraftContent = '', initialTagIds, onSnippetCreated, isFullScreenMode = false, isOverlay: propIsOverlay, hideRightPanel = false, appearanceScope = 'default', workspaceCollectionMode = false, workspaceCollectionFilterTagIds = [], organisationCollectionOrganisationId = null, forceCreateEditor = false, appearanceTokens, saveSnippetAdapter, propertyPersistenceAdapter, category, }) => {
    const activeEditor = useUIStore(state => state.activeEditor);
    const isFocusMode = useUIStore(state => state.isFocusMode);
    const isOverlay = Boolean(propIsOverlay || activeEditor?.props?.isOverlay);
    const shouldReturnToCollectionSheet = Boolean(activeEditor?.props?.returnToCollectionSheet);
    const isNormalSnippetMode = !isFullScreenMode && !isOverlay && !isFocusMode;
    const isAltSAppearance = appearanceScope === 'alts';
    const isWorkspaceCollectionMode = workspaceCollectionMode && isAltSAppearance;
    const [workspaceMode, setWorkspaceMode] = useState<'sheet' | 'editor'>(() => isNormalSnippetMode && !selectedSnippet && !forceCreateEditor ? 'sheet' : 'editor');
    const [isCollectionSheetExpanded, setIsCollectionSheetExpanded] = useState(false);
    const [isSheetCreateEditorOpen, setIsSheetCreateEditorOpen] = useState(Boolean(activeEditor?.props?.keepSheetCreateEditorOpen));
    const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const snippets = useDbStore(state => state.snippets);
    const organisations = useDbStore(state => state.organisations);
    const hotkeysMap = useDbStore(state => state.hotkeysMap);
    const tags = useDbStore(state => state.tags);
    const tagNamesMap = useMemo(() => {
        const map: Record<string, string> = {};
        tags.forEach(t => {
            map[t.id] = t.name;
        });
        return map;
    }, [tags]);
    const organisationNamesMap = useMemo(() => {
        const map: Record<string, string> = {};
        organisations.forEach(w => {
            map[w.id] = w.organisationName;
        });
        return map;
    }, [organisations]);
    const triggerNotification = useNotification();
    const [snippetToDeleteId, setSnippetToDeleteId] = useState<string | null>(null);
    const { snippetTitle, snippetConfig, snippetShortcut, activeSnippetId, organisationId, tagIds, saveStatus, setSaveStatus, lastSavedAt, setLastSavedAt, lastSavedTitleRef, lastSavedShortcutRef, isDirty, setSnippetTitle, setSnippetConfig, setSnippetShortcut, handleSave, flushSave, handleDelete, handleClose, isDeleteDialogOpen, setIsDeleteDialogOpen, isUnsavedChangesDialogOpen, setIsUnsavedChangesDialogOpen, handlePropertiesChange, loadSnippet, isInitialized, isShortcutInitialized, versionHistoryItems, selectedVersionId, setSelectedVersionId, isViewingHistory, } = useSnippetEditor({
        snippetId: selectedSnippet?.id || (selectedSnippet as any)?.snippet_id,
        onBack,
        initialDraftKey,
        initialDraftConfig: initialDraftContent,
        initialTagIds,
        onSnippetCreated,
        saveSnippetAdapter,
        propertyPersistenceAdapter,
    });
    useEffect(() => {
        if (isNormalSnippetMode && (isSheetCreateEditorOpen || forceCreateEditor) && !selectedSnippet) {
            setWorkspaceMode('editor');
        }
        else if (!isNormalSnippetMode || selectedSnippet || activeSnippetId) {
            setIsSheetCreateEditorOpen(false);
            setWorkspaceMode('editor');
        }
        else {
            setWorkspaceMode('sheet');
        }
    }, [activeSnippetId, forceCreateEditor, isNormalSnippetMode, isSheetCreateEditorOpen, selectedSnippet]);
    const loadedSnippetIdRef = useRef<string | null>(activeSnippetId);
    const [editorKey, setEditorKey] = useState<string>(() => activeSnippetId || `new_${Date.now()}`);
    const sortedSnippets = useMemo(() => {
        return [...snippets].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }, [snippets]);
    const [showToolbar, setShowToolbar] = useState(true);
    const [isRightPanelExpanded, setIsRightPanelExpanded] = useState(false);
    const rightSideSearchInputRef = useRef<HTMLInputElement | null>(null);
    const isUserKeyManuallySetRef = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<any>(null); // Quill instance ref
    const quillToolbarRef = useRef<HTMLElement | null>(null);
    const isLinkEditModalOpen = useUIStore((s: any) => s.activeEditor?.type === 'link');
    const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
    const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
    const [isToolbarVisible, setIsToolbarVisible] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // Sidebar always visible
    const { isFavorite, toggleFavorite, addFavorite } = useFavorites();
    const [shortcutsMap, setShortcutsMap] = useState<Record<string, string>>({});
    const [searchQuery, setSearchQuery] = useState('');
    const filteredSnippets = useMemo(() => {
        const collectionTagSet = new Set(workspaceCollectionFilterTagIds.filter(Boolean));
        const scopedSnippets = workspaceCollectionMode
            ? sortedSnippets.filter(snippet => {
                if (collectionTagSet.size > 0) {
                    return (snippet.tagIds || []).some(tagId => collectionTagSet.has(String(tagId)));
                }
                return !organisationCollectionOrganisationId || snippet.organisationId === organisationCollectionOrganisationId;
            })
            : sortedSnippets;
        const query = searchQuery.trim().toLowerCase();
        if (!query)
            return scopedSnippets;
        return scopedSnippets.filter(s => {
            const compoundId = getItemCompoundId({
                snippet: s,
                organisation: s.organisationId ? { organisation_id: s.organisationId } : null,
            });
            const sc = shortcutsMap[compoundId] || '';
            const titleMatch = (s.title || '').toLowerCase().includes(query);
            const shortcutMatch = sc.toLowerCase().includes(query);
            const contentMatch = (typeof s.config === 'string' ? s.config : JSON.stringify(s.config))
                .toLowerCase()
                .includes(query);
            return titleMatch || shortcutMatch || contentMatch;
        });
    }, [sortedSnippets, searchQuery, shortcutsMap, workspaceCollectionFilterTagIds, workspaceCollectionMode, organisationCollectionOrganisationId]);
    const fetchAllShortcuts = useCallback(async () => {
        try {
            const map = await readAllShortcuts();
            setShortcutsMap(map);
        }
        catch (e) {
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
        if (!trimmedTitle)
            return false;
        return snippets.some(s => {
            const snippetId = s.id;
            if (snippetId === activeSnippetId)
                return false;
            return (String(s.title || '')
                .trim()
                .toLowerCase() === trimmedTitle);
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
            if (!existing)
                return;
            if (field === 'title') {
                const updatedTitle = value.trim() || 'Untitled Snippet';
                await updateSnippet(id, { title: updatedTitle });
                const wsObj = existing.organisationId ? { organisation_id: existing.organisationId } : null;
                const compoundId = getItemCompoundId({ snippet: { id }, organisation: wsObj });
                const sc = shortcutsMap[compoundId] || '';
                if (sc) {
                    await saveShortcut(id, compoundId, sc.toLowerCase(), updatedTitle, 'snippet');
                }
                if (id === activeSnippetId) {
                    setSnippetTitle(updatedTitle);
                    if (lastSavedTitleRef)
                        lastSavedTitleRef.current = updatedTitle;
                }
            }
            else if (field === 'shortcut') {
                const finalShortcut = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                const wsObj = existing.organisationId ? { organisation_id: existing.organisationId } : null;
                const compoundId = getItemCompoundId({ snippet: { id }, organisation: wsObj });
                if (finalShortcut) {
                    await saveShortcut(id, compoundId, finalShortcut, existing.title, 'snippet');
                }
                else {
                    await clearShortcut(id, compoundId, 'snippet');
                }
                if (id === activeSnippetId) {
                    setSnippetShortcut(finalShortcut);
                    if (lastSavedShortcutRef)
                        lastSavedShortcutRef.current = finalShortcut;
                }
            }
            else if (field === 'tags') {
                const tagNames = value
                    .split(',')
                    .map(t => t.trim())
                    .filter(Boolean);
                const activeOrganisationId = existing.organisationId;
                const resolvedTags: any[] = [];
                for (const name of tagNames) {
                    const matchedTag = tags.find(t => existing.tagIds?.includes(t.id) && t.name.toLowerCase() === name.toLowerCase())
                        || tags.find(t => !t.workspaceId && t.name.toLowerCase() === name.toLowerCase());
                    if (matchedTag) {
                        resolvedTags.push(matchedTag);
                    }
                    else if (activeOrganisationId) {
                        const newTag = await createTag(name);
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
                if (setSaveStatus)
                    setSaveStatus('saved');
                if (setLastSavedAt)
                    setLastSavedAt(new Date());
            }
            await fetchAllShortcuts();
        }
        catch (e) {
            console.error('[handleUpdateItemField] Failed:', e);
        }
    }, [
        snippets,
        activeSnippetId,
        shortcutsMap,
        setSnippetTitle,
        setSnippetShortcut,
        setSaveStatus,
        setLastSavedAt,
        lastSavedTitleRef,
        lastSavedShortcutRef,
        fetchAllShortcuts,
        tags,
        handlePropertiesChange
    ]);
    const handleUpdateSnippetContent = useCallback(async (id: string, value: string) => {
        try {
            const config = textToSnippetConfig(value);
            await updateSnippet(id, { config });
            if (id === activeSnippetId) {
                setSnippetConfig(config);
                if (setSaveStatus)
                    setSaveStatus('saved');
                if (setLastSavedAt)
                    setLastSavedAt(new Date());
            }
        }
        catch (e) {
            console.error('[handleUpdateSnippetContent] Failed:', e);
        }
    }, [activeSnippetId, setLastSavedAt, setSaveStatus, setSnippetConfig]);
    const handleUpdateSnippetHotkey = useCallback(async (id: string, value: string) => {
        try {
            const existing = snippets.find(s => s.id === id);
            if (!existing)
                return;
            const compoundId = getItemCompoundId({
                snippet: existing,
                organisation: existing.organisationId ? { organisation_id: existing.organisationId } : null,
            });
            if (value.trim()) {
                await apiSaveHotkey(id, compoundId, value.trim(), 'snippet');
            }
            else {
                await apiClearHotkey(id, compoundId, 'snippet');
            }
            if (id === activeSnippetId) {
                if (setSaveStatus)
                    setSaveStatus('saved');
                if (setLastSavedAt)
                    setLastSavedAt(new Date());
            }
        }
        catch (e) {
            console.error('[handleUpdateSnippetHotkey] Failed:', e);
        }
    }, [activeSnippetId, setLastSavedAt, setSaveStatus, snippets]);
    const handleCopyTitleToShortcut = useCallback(() => {
        if (!snippetTitle.trim())
            return;
        const sanitized = snippetTitle.toLowerCase().replace(/[^a-z0-9_]/g, '');
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
                    organisation_id: organisationId,
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
                        setShortcutConflictId(res.conflictId);
                    }
                    else {
                        setShortcutError(null);
                        setIsShortcutOverrideable(false);
                        setShortcutConflictId(null);
                    }
                }
            }
            else {
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
    }, [snippetShortcut, activeSnippetId, shortcutsMap, organisationId, validateShortcut]);
    const handleResolveShortcut = useCallback(async (approval: ShortcutAssignmentApproval) => {
        const saved = await handleSave(false, { pendingShortcut: snippetShortcut, textCommandApproval: approval });
        if (!saved)
            throw new Error('Could not assign this command. Check the required fields and review the current owners.');
        setShortcutError(null);
        setIsShortcutOverrideable(false);
        setShortcutConflictId(null);
        fetchAllShortcuts();
    }, [snippetShortcut, handleSave, fetchAllShortcuts]);
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
                        }
                        else {
                            // Ensure variable button's format group is visible
                            (group as HTMLElement).style.display = '';
                        }
                    });
                    // Ensure variable button is visible
                    if (variableButton) {
                        variableButton.style.display = 'flex';
                    }
                }
                else {
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
            const saved = flushSave ? await flushSave() : await handleSave();
            if (!saved)
                return;
        }
        loadSnippet(null);
        setEditorKey(`new_${Date.now()}`);
        const currentProps = useUIStore.getState().activeEditor?.props || {};
        const cleanProps = {
            ...currentProps,
            category: 'snippet',
            snippet: null,
            prefill: null,
            item: null,
            initialDraftKey: null,
            initialDraftConfig: null,
            initialDraftContent: null,
            initialTitle: null,
            initialPrompt: null,
            keepSheetCreateEditorOpen: true,
        };
        if (!workspaceCollectionMode) {
            useUIStore.getState().openEditor({ type: 'snippet', id: 'new', props: cleanProps });
        }
        setIsSheetCreateEditorOpen(true);
        setWorkspaceMode('editor');
        if (titleInputRef.current) {
            titleInputRef.current.focus();
        }
    }, [isDirty, flushSave, handleSave, loadSnippet, workspaceCollectionMode]);
    const handleLoadSnippet = useCallback(async (id: string | null) => {
        if (isDirty) {
            const saved = flushSave ? await flushSave() : await handleSave();
            if (!saved)
                return;
        }
        const found = id ? snippets.find(snippet => snippet.id === id) : null;
        if (id && found && (isOverlay || isSheetCreateEditorOpen || workspaceMode === 'sheet')) {
            if (workspaceCollectionMode) {
                loadSnippet(id);
                setIsSheetCreateEditorOpen(false);
                setWorkspaceMode('editor');
                return;
            }
            useUIStore.getState().openEditor({
                type: 'snippet',
                id,
                props: { category: 'snippet', snippet: found, returnToCollectionSheet: true },
            });
            return;
        }
        loadSnippet(id);
    }, [flushSave, handleSave, isDirty, isOverlay, isSheetCreateEditorOpen, loadSnippet, snippets, workspaceCollectionMode, workspaceMode]);
    const closeEditor = useCallback(() => {
        // Reset Focus Mode when leaving
        useUIStore.getState().toggleFocusMode(false);
        useUIStore.getState().setSelectedOrganisationId(null);
        useUIStore.getState().setSnippetBreadcrumb(null);
        useUIStore.getState().setSelectedSnippetId(null);
        if (onBack) {
            onBack();
        }
        else {
            useUIStore.getState().closeEditor();
        }
    }, [onBack]);
    const handleEscapeSaveAndClose = useCallback(() => {
        if (isDirty) {
            setIsUnsavedChangesDialogOpen(true);
            return true; // Indicate we intercepted the escape
        }
        else {
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
            if (isLocationPickerOpen) {
                setIsLocationPickerOpen(false);
                return true;
            }
            if (isDeleteDialogOpen) {
                setIsDeleteDialogOpen(false);
                return true;
            }
            if (isShareDialogOpen) {
                setIsShareDialogOpen(false);
                return true;
            }
            if (isUnsavedChangesDialogOpen || isLinkEditModalOpen || document.getElementById('hotkey-assignment-popup')) {
                return true;
            }
            if (shouldReturnToCollectionSheet) {
                void (async () => {
                    if (isDirty) {
                        const saved = flushSave ? await flushSave() : await handleSave();
                        if (!saved)
                            return;
                    }
                    closeEditor();
                })();
                return true;
            }
            if (isNormalSnippetMode && workspaceMode === 'editor' && !selectedSnippet) {
                void (async () => {
                    if (isDirty) {
                        const saved = flushSave ? await flushSave() : await handleSave();
                        if (!saved)
                            return;
                    }
                    setIsSheetCreateEditorOpen(false);
                    loadSnippet(null);
                    setSnippetTitle('');
                    setSnippetConfig('');
                    setSnippetShortcut('');
                    setEditorKey(`new_${Date.now()}`);
                    setWorkspaceMode('sheet');
                })();
                return true;
            }
            const handled = handleEscapeSaveAndClose();
            return handled;
        };
        useUIStore.getState().setEditorEscapeHandler(handler);
        return () => useUIStore.getState().setEditorEscapeHandler(null);
    }, [
        handleEscapeSaveAndClose,
        isDeleteDialogOpen,
        isFocusMode,
        isLinkEditModalOpen,
        isLocationPickerOpen,
        isNormalSnippetMode,
        isDirty,
        flushSave,
        handleSave,
        isShareDialogOpen,
        isUnsavedChangesDialogOpen,
        loadSnippet,
        selectedSnippet,
        shouldReturnToCollectionSheet,
        setIsSheetCreateEditorOpen,
        setSnippetConfig,
        setSnippetShortcut,
        setSnippetTitle,
        workspaceMode
    ]);
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
                event.stopPropagation();
                event.stopImmediatePropagation();
                if (saveStatus === 'saving')
                    return;
                if (event.shiftKey) {
                    void handleCreateNew();
                }
                else {
                    void handleSave(false);
                }
            }
            // Alt+Enter to toggle Location Picker
            const isLocationPickerShortcut = event.altKey && event.key === 'Enter';
            if (isLocationPickerShortcut) {
                event.preventDefault();
                if (organisations.length === 0) {
                    triggerNotification('Create an organisation before saving.', 'info');
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
        organisations,
        triggerNotification,
        isFocusMode,
        isMac,
        closeEditor,
        isUnsavedChangesDialogOpen,
        handleEscapeSaveAndClose,
        isLinkEditModalOpen,
        handleCreateNew
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
    const handleOrganisationSelect = (organisationId: string, organisationName: string) => {
        const organisationObj = organisations.find(ws => ws.id === organisationId);
        if (!organisationObj)
            return;
        // Create new bread crumb with the selected workspace
        const newBreadCrum = {
            organisation_id: organisationId,
            organisation_name: organisationName,
        };
        useUIStore.getState().setSelectedOrganisationId(organisationObj.id);
        useUIStore.getState().setSnippetBreadcrumb(newBreadCrum);
        // Logic to preserve content if editing existing note or active draft
        if (activeSnippetId) {
            // Existing note: Only location updated above. Content logic preserved.
        }
        else {
            // New Note / Draft
            const hasContent = snippetTitle.trim().length > 0 ||
                (typeof snippetConfig === 'string'
                    ? snippetConfig.trim().length > 0
                    : JSON.stringify(snippetConfig).trim().length > 0 && JSON.stringify(snippetConfig) !== '{}');
            if (!hasContent) {
                setSnippetTitle('');
                setSnippetConfig('');
            }
            useUIStore.getState().setSelectedSnippetId(null);
            /* setIsCreatingNewItem removed */
        }
    };
    // Destination helpers
    const handleOrganisationDestination = (organisation: Organisation, isPersonal?: boolean) => {
        handleOrganisationSelect(organisation.organisation_id, organisation.organisation_name);
        // Save as last used destination
        chrome.storage.local.set({
            lastNoteDestination: {
                organisation_id: organisation.organisation_id,
            },
        });
        setIsLocationPickerOpen(false); // Close the location picker
    };
    // Determine placeholder based on category
    const titlePlaceholder = 'Title';
    const initialProperties = useMemo(() => {
        const base: any = activeSnippetId && activeSnippetId !== 'new' ? selectedSnippet || {} : {};
        return {
            ...base,
            id: activeSnippetId || 'new',
            organisationId: organisationId || base.organisationId,
            tagIds: tagIds !== undefined ? tagIds : base.tagIds || [],
            category: 'snippet',
            shortcut: snippetShortcut || '',
        };
    }, [selectedSnippet, activeSnippetId, organisationId, tagIds, snippetShortcut]);
    const snippetCompoundId = useMemo(() => {
        if (!activeSnippetId || activeSnippetId === 'new')
            return '';
        const wsObj = organisationId ? { organisation_id: organisationId } : null;
        const snipObj = selectedSnippet || { id: activeSnippetId, category: 'snippet', key: snippetTitle || '' };
        return getItemCompoundId({ snippet: snipObj as any, organisation: wsObj as any });
    }, [activeSnippetId, selectedSnippet, organisationId, snippetTitle]);
    const shouldRenderSnippetEditorAsPopup = false;
    const shouldRenderSnippetSheetWorkspace = isNormalSnippetMode &&
        !selectedSnippet &&
        ((workspaceMode === 'sheet' && !activeSnippetId) || shouldRenderSnippetEditorAsPopup);
    const shouldRenderSnippetEditorWorkspace = !shouldRenderSnippetSheetWorkspace || shouldRenderSnippetEditorAsPopup;
    const resetSnippetDraft = useCallback(() => {
        loadSnippet(null);
        setSnippetTitle('');
        setSnippetConfig('');
        setSnippetShortcut('');
        setEditorKey(`new_${Date.now()}`);
        setTitleError(null);
        setShortcutError(null);
    }, [loadSnippet, setSnippetConfig, setSnippetShortcut, setSnippetTitle]);
    const handleShowSheetCreateEditor = useCallback(() => {
        resetSnippetDraft();
        setIsSheetCreateEditorOpen(true);
        setWorkspaceMode('editor');
        setTimeout(() => {
            titleInputRef.current?.focus();
        }, 50);
    }, [resetSnippetDraft]);
    const handleCloseSheetCreateEditor = useCallback(() => {
        setIsSheetCreateEditorOpen(false);
        resetSnippetDraft();
        setWorkspaceMode('sheet');
    }, [resetSnippetDraft]);
    const handleBackToSnippetSheet = useCallback(async () => {
        if (isDirty) {
            const saved = flushSave ? await flushSave() : await handleSave(false);
            if (!saved)
                return;
        }
        setIsSheetCreateEditorOpen(false);
        resetSnippetDraft();
        setWorkspaceMode('sheet');
    }, [flushSave, handleSave, isDirty, resetSnippetDraft]);
    const saveAndReturnToSnippetSheet = useCallback(async () => {
        const saved = await handleSave(false);
        if (saved) {
            await fetchAllShortcuts();
            setIsSheetCreateEditorOpen(false);
            resetSnippetDraft();
            if (shouldRenderSnippetEditorAsPopup) {
                setWorkspaceMode('sheet');
            }
        }
        return saved;
    }, [fetchAllShortcuts, handleSave, resetSnippetDraft, shouldRenderSnippetEditorAsPopup]);
    const sharedPropertiesToolbarContent = (<SharedPropertiesToolbar key={activeSnippetId || 'new-snippet'} initialSnippet={initialProperties} currentSnapshot={{
            entityType: 'snippet',
            title: snippetTitle || 'Untitled',
            config: snippetConfig,
            shortcut: snippetShortcut,
            organisationId,
            tagIds: [...(tagIds || [])],
        }} compoundId={snippetCompoundId} defaultName={snippetTitle || 'Untitled'} showShortcut={false} showTodo={false} layout="horizontal" showDocsButton={false} reserveTopRightChromeSpace={isNormalSnippetMode && !shouldRenderSnippetEditorAsPopup} versionHistoryItems={versionHistoryItems} versionHistory={snippets.find(s => s.id === activeSnippetId)?.versionHistory} selectedVersionId={selectedVersionId} onSelectVersion={setSelectedVersionId} entityType="snippet" onChange={handlePropertiesChange} openPopupsToBottom={true} appearanceScope={appearanceScope} appearanceTokens={{ ...appearanceTokens, ...FUNCTIONAL_EDITOR_SURFACE_STYLE }} propertyPersistenceAdapter={propertyPersistenceAdapter}/>);
    const snippetConfigurePanel = (<div className={`flex h-full flex-col gap-3 overflow-visible ${isNormalSnippetMode && !(workspaceMode === 'editor' && !activeSnippetId)
            ? 'border-x border-[var(--color-borderDefault)] px-3'
            : ''}`}>
      <SnippetBuilderMainViewSnippetFormattingToolbar activeSnippetId={activeSnippetId} snippet={selectedSnippet} organisationId={organisationId} tagIds={tagIds} snippetTitle={snippetTitle} onChange={handlePropertiesChange}/>
    </div>);
    const handleDeleteSnippetFromSheet = useCallback(async (id: string) => {
        try {
            const targetSnip = snippets.find(s => s.id === id);
            const wsObj = targetSnip?.organisationId
                ? { organisation_id: targetSnip.organisationId }
                : organisationId
                    ? { organisation_id: organisationId }
                    : null;
            const compoundId = getItemCompoundId({ snippet: { id }, organisation: wsObj });
            await clearShortcut(id, compoundId, 'snippet');
            await apiClearHotkey(id, compoundId, 'snippet');
            const { deleteSnippet } = await import('./snippetData');
            await deleteSnippet(id);
            if (id === activeSnippetId || id === (selectedSnippet as any)?.id) {
                resetSnippetDraft();
            }
        }
        catch (err) {
            console.error('Delete snippet failed:', err);
        }
    }, [activeSnippetId, resetSnippetDraft, selectedSnippet, snippets, organisationId]);
    const editorContentNode = (<WorkspaceEditorLayout useBlackSurface isNormalMode={isNormalSnippetMode} title={shouldRenderSnippetSheetWorkspace || isAltSAppearance ? '' : activeSnippetId ? 'Edit snippet' : 'Create a snippet'} titleClassName={shouldRenderSnippetSheetWorkspace
            ? 'hidden'
            : isNormalSnippetMode
                ? 'absolute left-1/2 top-1/2 w-full max-w-[740px] -translate-x-1/2 -translate-y-1/2 xl:-ml-12 px-4 md:px-6 text-lg font-bold text-[var(--color-textPrimary)] truncate pointer-events-none'
                : undefined} isDirty={isDirty} saveStatus={saveStatus} lastSavedAt={lastSavedAt} activeId={activeSnippetId} isFocusMode={isFocusMode} showConfigureHeader={false} hideRightColumnBorder={category !== 'snippet' || isWorkspaceCollectionMode} embeddedFullBleed={isAltSAppearance} hideHeaderBorder={isAltSAppearance} useFullHeightWorkspace={shouldRenderSnippetSheetWorkspace} headerActions={shouldRenderSnippetSheetWorkspace || shouldRenderSnippetEditorAsPopup || isWorkspaceCollectionMode
            ? undefined
            : sharedPropertiesToolbarContent} onSave={async () => {
            return saveAndReturnToSnippetSheet();
        }} onDiscard={() => {
            // Discard draft or reset local states if required
        }} onCloseCallback={onBack} onBackClick={isAltSAppearance ? undefined : shouldReturnToCollectionSheet
            ? closeEditor
            : isNormalSnippetMode && workspaceMode === 'editor'
                ? handleBackToSnippetSheet
                : isFullScreenMode ? closeEditor : undefined} isRightSiblingExpanded={isRightPanelExpanded} rightSiblingPanel={!hideRightPanel ? (<RightSideItemsPanel<SnippetRecord> items={filteredSnippets} activeItemId={activeSnippetId} searchQuery={searchQuery} onSearchChange={setSearchQuery} searchPlaceholder="Search snippets..." getItemTitle={snip => snip.title || 'Untitled Snippet'} getItemPreview={snip => astToPlainText(typeof snip.config === 'string' ? snip.config : JSON.stringify(snip.config))} getItemIcon={() => <TextExpanderIcon size={14} className="text-[var(--color-iconDefault)] shrink-0"/>} getItemCompoundId={snip => getItemCompoundId({
                snippet: snip,
                organisation: snip.organisationId ? ({ organisation_id: snip.organisationId } as any) : null,
            })} getItemType={() => 'snippet'} getItemOrganisationId={snip => snip.organisationId} getItemTagIds={snip => snip.tagIds || []} shortcutPrefix="c" shortcutsMap={shortcutsMap} hotkeysMap={hotkeysMap} organisationNamesMap={organisationNamesMap} tagNamesMap={tagNamesMap} onLoadItem={handleLoadSnippet} onDeleteItem={async (id) => {
                try {
                    const targetSnip = snippets.find(s => s.id === id);
                    const wsObj = targetSnip?.organisationId
                        ? { organisation_id: targetSnip.organisationId }
                        : organisationId
                            ? { organisation_id: organisationId }
                            : null;
                    const compoundId = getItemCompoundId({ snippet: { id }, organisation: wsObj });
                    await clearShortcut(id, compoundId, 'snippet');
                    await apiClearHotkey(id, compoundId, 'snippet');
                    const { deleteSnippet } = await import('./snippetData');
                    await deleteSnippet(id);
                    if (id === activeSnippetId || id === (selectedSnippet as any)?.id) {
                        loadSnippet(null);
                        setSnippetTitle('');
                        setSnippetConfig('');
                        setSnippetShortcut('');
                    }
                }
                catch (err) {
                    console.error('Delete snippet failed:', err);
                }
            }} onUpdateShortcut={async (id, val) => {
                await handleUpdateItemField(id, 'shortcut', val);
            }} onUpdateTitle={async (id, val) => {
                await handleUpdateItemField(id, 'title', val);
            }} onUpdateTags={async (id, tagText) => {
                await handleUpdateItemField(id, 'tags', tagText);
            }} isFavorite={isFavorite} toggleFavorite={toggleFavorite} addFavorite={addFavorite} isExpanded={isRightPanelExpanded} onExpandChange={setIsRightPanelExpanded} searchInputRef={rightSideSearchInputRef} emptyStateMessage="No text expanders found" onCreateItemInTag={async (tagNames, tagIds) => {
                if (isDirty) {
                    const saved = flushSave ? await flushSave() : await handleSave(false);
                    if (!saved)
                        return;
                }
                loadSnippet(null);
                setSnippetTitle('');
                setSnippetConfig('');
                setSnippetShortcut('');
                // Resolve or create tag records in DB
                const targetOrganisationId = organisationId || 'default';
                const resolvedTagRecords: any[] = [];
                for (let i = 0; i < tagNames.length; i++) {
                    const name = tagNames[i].trim();
                    if (!name)
                        continue;
                    const directId = tagIds[i];
                    const existing = tags.find(t => t.id === directId)
                        || tags.find(t => !t.workspaceId && t.name.toLowerCase() === name.toLowerCase());
                    if (existing) {
                        resolvedTagRecords.push(existing);
                    }
                    else {
                        try {
                            const created = await createTag(name);
                            resolvedTagRecords.push(created);
                        }
                        catch (err) {
                            console.error('Failed creating tag on + click', err);
                        }
                    }
                }
                // Apply selected tags to editor properties
                handlePropertiesChange({ selectedTags: resolvedTagRecords });
                setIsSheetCreateEditorOpen(true);
                setWorkspaceMode('editor');
                setTimeout(() => {
                    titleInputRef.current?.focus();
                }, 50);
            }}/>) : null} deleteModalProps={{
            isOpen: isDeleteDialogOpen,
            onClose: () => {
                setIsDeleteDialogOpen(false);
                setSnippetToDeleteId(null);
            },
            onConfirm: async () => {
                if (snippetToDeleteId) {
                    try {
                        const targetSnip = snippets.find(s => s.id === snippetToDeleteId);
                        const wsObj = targetSnip?.organisationId
                            ? { organisation_id: targetSnip.organisationId }
                            : organisationId
                                ? { organisation_id: organisationId }
                                : null;
                        const compoundId = getItemCompoundId({
                            snippet: { id: snippetToDeleteId },
                            organisation: wsObj,
                        });
                        await clearShortcut(snippetToDeleteId, compoundId, 'snippet');
                        await apiClearHotkey(snippetToDeleteId, compoundId, 'snippet');
                        const { deleteSnippet } = await import('./snippetData');
                        await deleteSnippet(snippetToDeleteId);
                        if (snippetToDeleteId === activeSnippetId || snippetToDeleteId === (selectedSnippet as any)?.id) {
                            loadSnippet(null);
                            setSnippetTitle('');
                            setSnippetConfig('');
                            setSnippetShortcut('');
                        }
                    }
                    catch (err) {
                        console.error('Delete failed:', err);
                    }
                }
                setIsDeleteDialogOpen(false);
                setSnippetToDeleteId(null);
            },
            title: snippetToDeleteId && filteredSnippets.find(s => s.id === snippetToDeleteId)?.title
                ? `Delete "${filteredSnippets.find(s => s.id === snippetToDeleteId)?.title}"?`
                : 'Delete this text expander?',
            description: 'Are you sure you want to delete this text expander? This action cannot be undone.',
        }} rightColumnContent={category === 'snippet' && !shouldRenderSnippetSheetWorkspace && !shouldRenderSnippetEditorAsPopup
            ? snippetConfigurePanel
            : null} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchPlaceholder="Search text expanders...">
      {shouldRenderSnippetSheetWorkspace && (<TextExpanderCollectionSheetView snippets={filteredSnippets} isExpanded={isCollectionSheetExpanded} shortcutsMap={shortcutsMap} hotkeysMap={hotkeysMap} tagNamesMap={tagNamesMap} isFavorite={isFavorite} onOpenSnippet={snippet => {
                void handleLoadSnippet(snippet.id);
            }} onToggleFavorite={id => {
                const snippet = snippets.find(item => item.id === id);
                void toggleFavorite(id, 'snippet', snippet?.title || 'Untitled Snippet');
            }} onDeleteSnippet={id => {
                void handleDeleteSnippetFromSheet(id);
            }} onUpdateTitle={(id, value) => handleUpdateItemField(id, 'title', value)} onUpdateContent={handleUpdateSnippetContent} onUpdateShortcut={(id, value) => handleUpdateItemField(id, 'shortcut', value)} onUpdateHotkey={handleUpdateSnippetHotkey} onUpdateTags={(id, tagIds) => {
                void updateSnippet(id, { tagIds });
            }}/>)}
      {shouldRenderSnippetEditorWorkspace &&
            (shouldRenderSnippetEditorAsPopup && typeof document !== 'undefined' ? (createPortal(<div className="fixed inset-0 z-[100000] flex items-start justify-center bg-[var(--color-overlayBg)] px-6 py-12 backdrop-blur-sm">
              <div style={{
                    colorScheme: 'dark',
                    backgroundColor: PURE_BLACK_EDITOR_BACKGROUND,
                    color: '#FFFFFF',
                    '--color-editorBg': PURE_BLACK_EDITOR_BACKGROUND,
                    '--color-inputBg': PURE_BLACK_EDITOR_BACKGROUND,
                    '--color-containerBg': PURE_BLACK_EDITOR_BACKGROUND,
                    '--color-panelBg': PURE_BLACK_EDITOR_BACKGROUND,
                    '--color-cardBg': PURE_BLACK_EDITOR_BACKGROUND,
                    '--color-popupBg': PURE_BLACK_EDITOR_BACKGROUND,
                    '--color-innerPopupBg': PURE_BLACK_EDITOR_BACKGROUND,
                    '--color-contextMenuBg': PURE_BLACK_EDITOR_BACKGROUND,
                    '--color-textPrimary': '#FFFFFF',
                    '--color-textSecondary': '#D4D4D4',
                    '--color-textMuted': '#737373',
                    '--color-textPlaceholder': '#A3A3A3',
                    '--color-iconDefault': '#9CA3AF',
                    '--color-borderDefault': 'rgba(255, 255, 255, 0.1)',
                    '--color-borderActive': 'rgba(255, 255, 255, 0.2)',
                    '--color-hoverBg': 'rgba(255, 255, 255, 0.05)',
                    '--color-selectedBg': 'rgba(255, 255, 255, 0.07)',
                } as any} className="flex max-h-[calc(100vh-96px)] w-full max-w-[1220px] flex-col overflow-hidden rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-bgPrimary)] shadow-2xl">
                <EditorHeader title="Create a snippet" isDirty={isDirty} saveStatus={saveStatus} lastSavedAt={lastSavedAt} activeId={activeSnippetId} onCloseClick={handleCloseSheetCreateEditor} headerActions={sharedPropertiesToolbarContent} showAutoSaveStatus={true}/>
                <div className="flex min-h-0 flex-1">
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex min-h-0 w-full flex-1 flex-col px-5 pb-4 pt-3">
                      <EditorTitleShortcutInput title={snippetTitle} setTitle={val => {
                    setSnippetTitle(val);
                    if (val.trim())
                        setTitleError(null);
                }} titleError={titleError} shortcutError={shortcutError} isOverrideable={isShortcutOverrideable} onResolveShortcut={handleResolveShortcut} shortcutReferenceId={activeSnippetId || 'new'} shortcut={snippetShortcut} setShortcut={setSnippetShortcut} titleRef={titleInputRef} shortcutRef={shortcutInputRef} onTitleBlur={async () => {
                    if (!snippetTitle.trim()) {
                        setTitleError('Enter the title');
                    }
                }} onShortcutBlur={async () => undefined} onTitleEnter={async (shiftKey, e) => {
                    if (e?.ctrlKey || e?.metaKey) {
                        void saveAndReturnToSnippetSheet();
                    }
                    else if (!snippetTitle.trim()) {
                        setTitleError('Enter the title');
                    }
                    else {
                        void saveAndReturnToSnippetSheet();
                    }
                }} onShortcutEnter={async () => {
                    void saveAndReturnToSnippetSheet();
                }} onArrowDownPress={() => {
                    const editorDom = containerRef.current?.querySelector('.ProseMirror') as HTMLElement | null;
                    editorDom?.focus();
                }} onCopyTitleToShortcut={isInitialized && isShortcutInitialized ? handleCopyTitleToShortcut : undefined}/>
                      <EditorContentWorkspace key={editorKey} category="snippet" containerRef={containerRef} onBlurCapture={() => undefined} onCreateAnother={saveAndReturnToSnippetSheet} activeId={activeSnippetId || 'new'}/>
                    </div>
                  </div>
                  <aside className="min-h-0 w-[300px] shrink-0 overflow-y-auto border-l border-[var(--color-borderDefault)] px-4 py-3 custom-scrollbar">
                    {snippetConfigurePanel}
                  </aside>
                </div>
              </div>
            </div>, document.body)) : (<div className="flex-1 flex flex-col min-h-0 relative">
            <div className={`w-full flex-1 flex flex-col min-h-0 pb-2 ${isWorkspaceCollectionMode ? 'max-w-[900px] mx-auto xl:-translate-x-12 px-4 md:px-6 pt-1' : isAltSAppearance ? 'px-8 md:px-10 lg:px-12 pt-3' : isNormalSnippetMode ? 'max-w-[740px] mx-auto xl:-translate-x-12 px-4 md:px-6 pt-0.5' : 'px-3 pt-0.5'}`}>
              {isWorkspaceCollectionMode ? (<div className="mb-5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-8">
                  <h2 className="relative flex min-w-0 items-center gap-3 text-xl font-bold text-[var(--color-textPrimary)]">
                    {(shouldReturnToCollectionSheet || isFullScreenMode || (isNormalSnippetMode && workspaceMode === 'editor')) && (<EditorBackButton outsideTitle onClick={shouldReturnToCollectionSheet || isFullScreenMode ? closeEditor : handleBackToSnippetSheet}/>)}
                    {activeSnippetId ? 'Edit snippet' : 'Create a snippet'}
                  </h2>
                  <div className="flex justify-end pt-0.5">
                    {sharedPropertiesToolbarContent}
                  </div>
                </div>) : isAltSAppearance && (<h2 className="relative flex min-w-0 items-center gap-3 mb-5 text-xl font-bold text-[var(--color-textPrimary)]">
                  {(shouldReturnToCollectionSheet || isFullScreenMode || (isNormalSnippetMode && workspaceMode === 'editor')) && (<EditorBackButton outsideTitle onClick={shouldReturnToCollectionSheet || isFullScreenMode ? closeEditor : handleBackToSnippetSheet}/>)}
                  {activeSnippetId ? 'Edit snippet' : 'Create a snippet'}
                </h2>)}
              <EditorTitleShortcutInput title={snippetTitle} setTitle={val => {
                    setSnippetTitle(val);
                    if (val.trim())
                        setTitleError(null);
                }} titleError={titleError} shortcutError={shortcutError} isOverrideable={isShortcutOverrideable} onResolveShortcut={handleResolveShortcut} shortcutReferenceId={activeSnippetId || 'new'} shortcut={snippetShortcut} setShortcut={setSnippetShortcut} titleRef={titleInputRef} shortcutRef={shortcutInputRef} onTitleBlur={async () => {
                    if (!snippetTitle.trim()) {
                        setTitleError('Enter the title');
                    }
                    else if (isDirty) {
                        const saved = await handleSave();
                        if (saved)
                            fetchAllShortcuts();
                    }
                }} onShortcutBlur={async () => {
                    if (isDirty) {
                        const saved = await handleSave();
                        if (saved)
                            fetchAllShortcuts();
                    }
                }} onTitleEnter={async (shiftKey, e) => {
                    if (e?.ctrlKey || e?.metaKey) {
                        void handleCreateNew();
                    }
                    else {
                        if (!snippetTitle.trim()) {
                            setTitleError('Enter the title');
                        }
                        else if (isDirty) {
                            const saved = await handleSave();
                            if (saved)
                                fetchAllShortcuts();
                        }
                    }
                }} onShortcutEnter={async () => {
                    if (isDirty) {
                        const saved = await handleSave();
                        if (saved)
                            fetchAllShortcuts();
                    }
                }} onArrowDownPress={() => {
                    const editorDom = containerRef.current?.querySelector('.ProseMirror') as HTMLElement | null;
                    editorDom?.focus();
                }} onCopyTitleToShortcut={isInitialized && isShortcutInitialized ? handleCopyTitleToShortcut : undefined}/>

              <EditorContentWorkspace key={editorKey} category="snippet" containerRef={containerRef} onBlurCapture={() => {
                    if (isDirty) {
                        void handleSave();
                    }
                }} onCreateAnother={handleCreateNew} activeId={activeSnippetId}/>
            </div>
          </div>))}
    </WorkspaceEditorLayout>);
    const activeSnippet = useMemo(() => {
        if (!activeSnippetId)
            return null;
        return snippets.find(s => s.id === activeSnippetId);
    }, [activeSnippetId, snippets]);
    const initialSnippetContent = useMemo(() => {
        if (!activeSnippet)
            return '';
        return activeSnippet.config || '';
    }, [activeSnippet?.id]);
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
    return (<SnippetBuilderMainViewProvider key={editorKey} initialContent={initialSnippetContent as any} onChange={(content: any) => {
            let parsed = content;
            if (typeof content === 'string') {
                try {
                    parsed = JSON.parse(content);
                }
                catch (e) {
                    // ignore
                }
            }
            setSnippetConfig(parsed);
        }}>
      {((!isAltSAppearance && onBack) || isWorkspaceCollectionMode) && (<EditorTopRightChrome docsUrl={BRAND.docs.textExpanders} onClose={onBack ?? (() => {})} positionClassName={isWorkspaceCollectionMode ? 'absolute top-0 right-1' : undefined} sheetCreateAction={shouldRenderSnippetSheetWorkspace ? { label: 'New Text Expander', onCreate: handleShowSheetCreateEditor } : undefined} sheetExpansion={shouldRenderSnippetSheetWorkspace ? {
                isExpanded: isCollectionSheetExpanded,
                onToggle: () => setIsCollectionSheetExpanded(expanded => !expanded),
                label: 'text expander content',
            } : undefined}/>)}
      {editorContentNode}
    </SnippetBuilderMainViewProvider>);
};
export const EditSnippetScreen = React.memo(EditSnippetScreenComponent);
export default EditSnippetScreen;
