import { EditorBackButton } from '../../../../../shared-components/editorContainer/EditorBackButton';
import { FUNCTIONAL_EDITOR_SURFACE_STYLE, PURE_BLACK_EDITOR_BACKGROUND } from '../../../../../shared-components/editorContainer/functionalEditorSurfaceStyle';
import * as React from 'react';
import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { recordTimelineOpen } from '../../../../../pages/AltS_search_newtab/src/components/timeline/timelineActivity';
import { BRAND } from '../../../../../shared-components/brandingConfig';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { StorageManager } from '../../../../../storage/localStorage/storageManager';
import { useAiPromptEditor } from '../useAiPromptEditor';
import { updateAiPrompt, deleteAiPrompt } from '../aiPromptData';
import { createTodo } from '../../todos/todoData';
import { createTag } from '../../tags/tagData';
import { useFavorites } from '../../../../../shared-components/favorites/favoriteHooks';
import TextEditor from '../../../../../shared-components/TextEditor';
import { useAppearance } from '@extension/ui';
import { FaExternalLinkAlt, FaSpinner, FaPencilAlt, FaChevronDown, FaCog, FaAsterisk, FaKeyboard, FaFolder, FaCheck, FaTrash, FaStar } from 'react-icons/fa';
import { FiSearch, FiCopy, FiTag, FiStar } from 'react-icons/fi';
import { stripCmdStatus } from '../../../../../shared-components/searchBarMain/utilityFunctions/utils';
import { AutoSaveIndicator } from '../../../../../shared-components/autoSaveEngine/autoSave';
import { ExistingItemsTable } from '../../../../../shared-components/editorContainer/ExistingItemsTable';
import { RightSideItemsPanel } from '../../../../../shared-components/editorContainer/RightSideItemsPanel';
import { EditorTopRightChrome } from '../../../../../shared-components/editorContainer/EditorTopRightChrome';
import { WorkspaceEditorLayout } from '../../../../../shared-components/editorContainer/WorkspaceEditorLayout';
import { EditorHeader } from '../../../../../shared-components/editorContainer/EditorHeader';
import { EditorTitleShortcutInput } from '../../../../../shared-components/editorContainer/EditorTitleShortcutInput';
import { SharedPropertiesToolbar } from '../../../../../shared-components/editorToolbar/SharedPropertiesToolbar';
import { DestinationPicker } from '../../../../../shared-components/editorToolbar/DestinationPicker';
import { saveShortcut, clearShortcut } from '../../../../../shared-components/shortcuts';
import { readAllShortcuts, getItemCompoundId } from '../../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { clearHotkey as apiClearHotkey, saveHotkey as apiSaveHotkey, HotkeyAssignButton } from '../../../../../shared-components/hotkeys';
import type { CustomModelConfig } from '../aiPromptTypes';
import CircularModelStackIcon from '../../../../../shared-components/icons/circularModelStackIcon';
import { resolveEnabledAiPromptModels, type AiModelTarget } from '../aiPromptModelHelpers';
import { useExcludedAiPromptModels } from '../useExcludedAiPromptModels';
import AiPromptCollectionSheetView, { type AiPromptModelUpdate, } from '../../../../../shared-components/todosSheet/AiPromptCollectionSheetView';
import AiPromptModelSelectorPanel from '../../../../../shared-components/todosSheet/AiPromptModelSelectorPanel';
export interface AiPromptEditorViewProps {
    aiPromptId?: string | null;
    onBack?: () => void;
    initialTitle?: string;
    initialPrompt?: string;
    initialModelUrls?: Record<string, string>;
    initialTagIds?: string[];
    onAiPromptCreated?: (prompt: any) => void | Promise<void>;
    isFullScreenMode?: boolean;
    isOverlay?: boolean;
    hideRightPanel?: boolean;
    appearanceScope?: 'default' | 'alts';
    workspaceCollectionMode?: boolean;
    workspaceCollectionFilterTagIds?: string[];
    organisationCollectionOrganisationId?: string | null;
    forceCreateEditor?: boolean;
    appearanceTokens?: React.CSSProperties;
    saveAiPromptAdapter?: (args: {
        mode: 'create' | 'update';
        aiPromptId?: string;
        input: any;
    }) => Promise<any>;
    propertyPersistenceAdapter?: React.ComponentProps<typeof SharedPropertiesToolbar>['propertyPersistenceAdapter'];
}
export function AiPromptEditorView(props: AiPromptEditorViewProps) {
    const { isFullScreenMode = false, isOverlay: propIsOverlay = false, hideRightPanel = false, appearanceScope = 'default', workspaceCollectionMode = false, workspaceCollectionFilterTagIds = [], organisationCollectionOrganisationId = null, forceCreateEditor = false, appearanceTokens, propertyPersistenceAdapter, } = props;
    const activeEditor = useUIStore(s => s.activeEditor);
    const isFocusMode = useUIStore(s => s.isFocusMode);
    const isOverlay = Boolean(propIsOverlay || activeEditor?.props?.isOverlay);
    const shouldReturnToCollectionSheet = Boolean(activeEditor?.props?.returnToCollectionSheet);
    const isNormalAiPromptMode = !isFullScreenMode && !isOverlay && !isFocusMode;
    const isAltSAppearance = appearanceScope === 'alts';
    const isWorkspaceCollectionMode = workspaceCollectionMode && isAltSAppearance;
    const [selectedPromptId, setSelectedPromptId] = useState<string | null>(props.aiPromptId ?? null);
    useEffect(() => {
        setSelectedPromptId(props.aiPromptId ?? null);
    }, [props.aiPromptId]);
    const editorProps = useMemo(() => ({
        ...props,
        aiPromptId: selectedPromptId,
    }), [props, selectedPromptId]);
    const state = useAiPromptEditor(editorProps);
    const { excludedModelIds } = useExcludedAiPromptModels();
    const containerRef = useRef<HTMLDivElement>(null);
    const { theme } = useAppearance();
    const isDark = theme.isDark;
    const toolbarIdRef = useRef(`prompt-toolbar-${Math.random().toString(36).slice(2, 10)}`);
    const toolbarSelector = `#${toolbarIdRef.current}`;
    const shortcutInputRef = useRef<HTMLInputElement>(null);
    const tagPopupRef = useRef<HTMLDivElement>(null);
    const aiPrompts = useDbStore(state => state.aiPrompts) || [];
    const organisations = useDbStore(state => state.organisations) || [];
    const hotkeysMap = useDbStore(state => state.hotkeysMap) || [];
    const tags = useDbStore(state => state.tags) || [];
    const currentCompoundId = useMemo(() => {
        if (!state.activeAiPromptId)
            return '';
        return getItemCompoundId({
            id: state.activeAiPromptId,
            organisation_id: state.organisationId,
            snippet: { id: state.activeAiPromptId, category: 'aiPrompt' }
        });
    }, [state.activeAiPromptId, state.organisationId]);
    const [excludedModels, setExcludedModels] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isRightPanelExpanded, setIsRightPanelExpanded] = useState(false);
    const rightSideSearchInputRef = useRef<HTMLInputElement | null>(null);
    const [shortcutsMap, setShortcutsMap] = useState<Record<string, string>>({});
    const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
    const [tagPopupOpen, setTagPopupOpen] = useState(false);
    const [promptToDeleteId, setPromptToDeleteId] = useState<string | null>(null);
    const [newTagName, setNewTagName] = useState('');
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
    const [titleError, setTitleError] = useState<string | null>(null);
    const [isSheetCreateEditorOpen, setIsSheetCreateEditorOpen] = useState(Boolean(activeEditor?.props?.keepSheetCreateEditorOpen));
    const [workspaceMode, setWorkspaceMode] = useState<'sheet' | 'editor'>(() => isNormalAiPromptMode && !props.aiPromptId && !forceCreateEditor ? 'sheet' : 'editor');
    const [isCollectionSheetExpanded, setIsCollectionSheetExpanded] = useState(false);
    useEffect(() => {
        if (!isNormalAiPromptMode || props.aiPromptId) {
            setWorkspaceMode('editor');
        }
        else if (isSheetCreateEditorOpen || forceCreateEditor) {
            setWorkspaceMode('editor');
        }
        else if (state.activeAiPromptId) {
            setWorkspaceMode('editor');
        }
        else {
            setWorkspaceMode('sheet');
        }
    }, [forceCreateEditor, isNormalAiPromptMode, isSheetCreateEditorOpen, props.aiPromptId, state.activeAiPromptId]);
    const getPromptModels = useCallback((p: any): AiModelTarget[] => {
        if (!p)
            return [];
        let targetEnabledIds: string[] | undefined = undefined;
        let targetCustomModels: CustomModelConfig[] = p.customModels || [];
        if (p.id === state.activeAiPromptId) {
            targetEnabledIds = state.enabledModelIds;
            targetCustomModels = state.customModels || [];
        }
        else if (Array.isArray(p.enabledModelIds) && p.enabledModelIds.length > 0) {
            targetEnabledIds = p.enabledModelIds;
        }
        else if (p.modelUrls && typeof p.modelUrls === 'object' && Object.keys(p.modelUrls).length > 0) {
            targetEnabledIds = Object.keys(p.modelUrls);
        }
        return resolveEnabledAiPromptModels({ enabledModelIds: targetEnabledIds, customModels: targetCustomModels }, excludedModelIds);
    }, [state.activeAiPromptId, state.enabledModelIds, state.customModels, excludedModelIds]);
    // Clear validation errors when switching between active prompts/drafts
    useEffect(() => {
        setTitleError(null);
        setShowTooltip(false);
    }, [state.activeAiPromptId]);
    const { isFavorite, toggleFavorite, addFavorite } = useFavorites();
    const tagNamesMap = useMemo(() => {
        const map: Record<string, string> = {};
        tags.forEach(t => { map[t.id] = t.name; });
        return map;
    }, [tags]);
    const organisationNamesMap = useMemo(() => {
        const map: Record<string, string> = {};
        organisations.forEach(w => { map[w.id] = w.organisationName; });
        return map;
    }, [organisations]);
    const fetchAllShortcuts = useCallback(async () => {
        try {
            const map = await readAllShortcuts();
            setShortcutsMap(map);
        }
        catch (e) {
            console.warn('Failed to load shortcuts:', e);
        }
    }, []);
    useEffect(() => {
        void fetchAllShortcuts();
        window.addEventListener('storage', fetchAllShortcuts);
        return () => window.removeEventListener('storage', fetchAllShortcuts);
    }, [aiPrompts, fetchAllShortcuts]);
    useEffect(() => {
        if (workspaceMode === 'editor' && state.titleInputRef.current) {
            state.titleInputRef.current.focus();
        }
    }, [state.activeAiPromptId, state.titleInputRef, workspaceMode]);
    useEffect(() => {
        StorageManager.getItem('aiPrompt_excludedModels').then((stored: any) => {
            if (stored) {
                try {
                    setExcludedModels(JSON.parse(stored));
                }
                catch {
                    // ignore
                }
            }
        });
    }, []);
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const isMac = navigator.userAgent.includes('Mac');
            const isCtrlShiftEnter = (isMac ? event.metaKey : event.ctrlKey) && event.shiftKey && event.key === 'Enter';
            if (isCtrlShiftEnter) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                setShowTooltip(false);
                if (state.saveStatus === 'saving')
                    return;
                void (async () => {
                    if (state.isDirty) {
                        const saved = state.flushSave ? await state.flushSave() : await state.handleSave();
                        if (!saved)
                            return;
                    }
                    state.loadPrompt(null);
                    const currentProps = useUIStore.getState().activeEditor?.props || {};
                    const cleanProps = {
                        ...currentProps,
                        item: null,
                        snippet: null,
                        prefill: null,
                        initialTitle: null,
                        initialPrompt: null,
                        initialModelUrls: null,
                        initialTagIds: null,
                        keepSheetCreateEditorOpen: true,
                    };
                    if (!workspaceCollectionMode) {
                        useUIStore.getState().openEditor({ type: 'aiPrompt', id: 'new', isNew: true, props: cleanProps });
                    }
                    setIsSheetCreateEditorOpen(true);
                    setWorkspaceMode('editor');
                    setTimeout(() => state.titleInputRef.current?.focus(), 0);
                })();
            }
        };
        window.addEventListener('keydown', handleKeyDown, true);
        return () => {
            window.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [state.saveStatus, state.isDirty, state.flushSave, state.handleSave, state.loadPrompt, state.titleInputRef, workspaceCollectionMode]);
    // Register escape handler with uiStateManager
    useEffect(() => {
        const handler = () => {
            if (state.isUnsavedChangesDialogOpen || state.isDeleteDialogOpen) {
                return true; // let those handle it or block it
            }
            if (shouldReturnToCollectionSheet) {
                void (async () => {
                    if (state.isDirty) {
                        const saved = state.flushSave ? await state.flushSave() : await state.handleSave();
                        if (!saved)
                            return;
                    }
                    if (props.onBack) {
                        props.onBack();
                    }
                    else {
                        state.handleClose();
                    }
                })();
                return true;
            }
            if (isNormalAiPromptMode && workspaceMode === 'editor' && isSheetCreateEditorOpen && !props.aiPromptId) {
                void (async () => {
                    if (state.isDirty) {
                        const saved = state.flushSave ? await state.flushSave() : await state.handleSave();
                        if (!saved)
                            return;
                    }
                    state.loadPrompt(null);
                    setIsSheetCreateEditorOpen(false);
                    setWorkspaceMode('sheet');
                })();
                return true;
            }
            state.handleClose();
            return true; // We intercepted the escape
        };
        useUIStore.getState().setEditorEscapeHandler(handler);
        return () => useUIStore.getState().setEditorEscapeHandler(null);
    }, [
        isSheetCreateEditorOpen,
        isNormalAiPromptMode,
        props.aiPromptId,
        props.onBack,
        shouldReturnToCollectionSheet,
        state.isDirty,
        state.flushSave,
        state.isUnsavedChangesDialogOpen,
        state.isDeleteDialogOpen,
        state.handleClose,
        state.handleSave,
        state.loadPrompt,
        workspaceMode
    ]);
    const isEmbedded = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === 'true';
    useEffect(() => {
        if (state.generatedUrl && !state.isGenerating && state.saveStatus !== 'saving' && state.saveStatus !== 'saved') {
            state.handleSave();
        }
    }, [state.generatedUrl, state.isGenerating, state.saveStatus]);
    const sortedPrompts = useMemo(() => {
        const collectionTagSet = new Set(workspaceCollectionFilterTagIds.filter(Boolean));
        const scopedPrompts = workspaceCollectionMode
            ? aiPrompts.filter(prompt => {
                if (collectionTagSet.size > 0) {
                    return (prompt.tagIds || []).some(tagId => collectionTagSet.has(String(tagId)));
                }
                return !organisationCollectionOrganisationId || prompt.organisationId === organisationCollectionOrganisationId;
            })
            : aiPrompts;
        return [...scopedPrompts].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }, [aiPrompts, workspaceCollectionFilterTagIds, workspaceCollectionMode, organisationCollectionOrganisationId]);
    const filteredPrompts = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q)
            return sortedPrompts;
        return sortedPrompts.filter(p => (p.title || '').toLowerCase().includes(q) ||
            (p.prompt || '').toLowerCase().includes(q));
    }, [sortedPrompts, searchQuery]);
    const handleCopyTitleToShortcut = useCallback(() => {
        const sanitized = state.promptTitle.toLowerCase().replace(/[^a-z0-9_]/g, '');
        state.setPromptShortcut(sanitized);
    }, [state.promptTitle, state.setPromptShortcut]);
    const handleCreateNew = useCallback(async () => {
        setShowTooltip(false);
        if (state.isDirty) {
            const saved = state.flushSave ? await state.flushSave() : await state.handleSave();
            if (!saved)
                return;
        }
        state.loadPrompt(null);
        const currentProps = useUIStore.getState().activeEditor?.props || {};
        const cleanProps = {
            ...currentProps,
            item: null,
            snippet: null,
            prefill: null,
            initialTitle: null,
            initialPrompt: null,
            initialModelUrls: null,
            initialTagIds: null,
            keepSheetCreateEditorOpen: true,
        };
        if (!workspaceCollectionMode) {
            useUIStore.getState().openEditor({ type: 'aiPrompt', id: 'new', isNew: true, props: cleanProps });
        }
        setIsSheetCreateEditorOpen(true);
        setWorkspaceMode('editor');
        setTimeout(() => state.titleInputRef.current?.focus(), 0);
    }, [state.isDirty, state.flushSave, state.handleSave, state.loadPrompt, state.titleInputRef, workspaceCollectionMode]);
    const handleShowSheetCreateEditor = useCallback(() => {
        setShowTooltip(false);
        void (async () => {
            if (state.isDirty) {
                const saved = state.flushSave ? await state.flushSave() : await state.handleSave();
                if (!saved)
                    return;
            }
            state.loadPrompt(null);
            setIsSheetCreateEditorOpen(true);
            setWorkspaceMode('editor');
            setTimeout(() => state.titleInputRef.current?.focus(), 0);
        })();
    }, [state]);
    const handleCloseSheetCreateEditor = useCallback(() => {
        setShowTooltip(false);
        state.loadPrompt(null);
        setSelectedPromptId(null);
        setIsSheetCreateEditorOpen(false);
        setWorkspaceMode('sheet');
    }, [state]);
    const handleBackToAiPromptSheet = useCallback(async () => {
        if (state.isDirty) {
            const saved = state.flushSave ? await state.flushSave() : await state.handleSave();
            if (!saved)
                return;
        }
        handleCloseSheetCreateEditor();
    }, [handleCloseSheetCreateEditor, state]);
    const handleTopRightClose = useCallback(() => {
        if (isNormalAiPromptMode && isSheetCreateEditorOpen && !props.aiPromptId) {
            handleCloseSheetCreateEditor();
            return;
        }
        state.handleClose();
    }, [handleCloseSheetCreateEditor, isNormalAiPromptMode, isSheetCreateEditorOpen, props.aiPromptId, state]);
    const openAiPromptInFullEditor = useCallback(async (prompt: any | null | undefined) => {
        if (!prompt?.id)
            return;
        if (state.isDirty) {
            const saved = state.flushSave ? await state.flushSave() : await state.handleSave();
            if (!saved)
                return;
        }
        setSelectedPromptId(prompt.id);
        setWorkspaceMode('editor');
        if (prompt.deletedAt == null) recordTimelineOpen('aiPrompt', prompt.id);
    }, [state]);
    const requestPromptInput = useCallback((prompt?: any) => {
        if (typeof window === 'undefined')
            return;
        window.dispatchEvent(new CustomEvent(BRAND.events.sessionMissingAiPrompt, {
            detail: {
                promptRecord: prompt,
                promptId: String(prompt?.id || 'direct-ai-prompt'),
                title: String(prompt?.title || 'AI Prompt'),
                directPrompt: !prompt,
            },
        }));
    }, []);
    const runPromptFromSheet = useCallback((prompt: any) => {
        requestPromptInput(prompt);
    }, [requestPromptInput]);
    const handleUpdateItemField = async (itemId: string, field: 'title' | 'shortcut' | 'tags', value: string) => {
        try {
            if (field === 'title') {
                await updateAiPrompt(itemId, { title: value });
            }
            else if (field === 'shortcut') {
                const record = aiPrompts.find(p => p.id === itemId);
                if (record) {
                    const wsObj = record.organisationId ? { organisation_id: record.organisationId } : null;
                    const compoundId = getItemCompoundId({
                        id: record.id,
                        organisation_id: record.organisationId,
                        snippet: { id: record.id, category: 'aiPrompt' }
                    });
                    if (value) {
                        await saveShortcut(itemId, compoundId, value.toLowerCase().replace(/[^a-z0-9_]/g, ''), record.title, 'aiPrompt');
                    }
                    else {
                        await clearShortcut(itemId, compoundId, 'aiPrompt');
                    }
                }
            }
            else if (field === 'tags') {
                const tagNames = value.split(',').map(t => t.trim()).filter(Boolean);
                const resolvedTags: any[] = [];
                for (const name of tagNames) {
                    const matchedTag = tags.find((t: any) => t.name.toLowerCase() === name.toLowerCase());
                    if (matchedTag) {
                        resolvedTags.push(matchedTag);
                    }
                    else {
                        const record = aiPrompts.find(p => p.id === itemId);
                        const smartWs = record?.organisationId || organisations[0]?.id;
                        if (smartWs) {
                            const newTag = await createTag(name);
                            resolvedTags.push(newTag);
                        }
                    }
                }
                await updateAiPrompt(itemId, { tagIds: resolvedTags.map((t: any) => t.id) });
                if (itemId === state.activeAiPromptId) {
                    state.setTagIds(resolvedTags.map((t: any) => t.id));
                }
            }
            void fetchAllShortcuts();
        }
        catch (e) {
            console.error('Failed to update field:', e);
        }
    };
    const handleUpdatePromptText = async (itemId: string, value: string) => {
        await updateAiPrompt(itemId, { prompt: value });
        if (itemId === state.activeAiPromptId) {
            state.setPromptBody(value);
        }
    };
    const handleUpdatePromptHotkey = async (itemId: string, value: string) => {
        const record = aiPrompts.find(p => p.id === itemId);
        if (!record)
            return;
        const compoundId = getItemCompoundId({
            id: record.id,
            organisation_id: record.organisationId,
            snippet: { id: record.id, category: 'aiPrompt' },
        });
        if (value.trim()) {
            await apiSaveHotkey(itemId, compoundId, value.trim(), 'aiPrompt');
        }
        else {
            await apiClearHotkey(itemId, compoundId, 'aiPrompt');
        }
        void fetchAllShortcuts();
    };
    const handleUpdatePromptModels = async (itemId: string, value: AiPromptModelUpdate) => {
        await updateAiPrompt(itemId, value);
        if (itemId === state.activeAiPromptId) {
            state.setEnabledModelIds(value.enabledModelIds);
            state.setCustomModels(value.customModels);
            Object.entries(value.modelUrls).forEach(([modelId, url]) => {
                state.setModelUrl(modelId, url);
            });
        }
    };
    const handleTagToggle = (tagId: string) => {
        if (state.tagIds.includes(tagId)) {
            state.setTagIds(state.tagIds.filter(id => id !== tagId));
        }
        else {
            state.setTagIds([...state.tagIds, tagId]);
        }
    };
    const handleCreateTag = async () => {
        const trimmed = newTagName.trim();
        if (!trimmed)
            return;
        try {
            const smartWs = state.organisationId || organisations[0]?.id;
            if (smartWs) {
                const newTag = await createTag(trimmed);
                state.setTagIds([...state.tagIds, newTag.id]);
                setNewTagName('');
            }
        }
        catch (err) {
            console.error('Failed to create tag:', err);
        }
    };
    const isDuplicateTitle = useMemo(() => {
        if (!state.promptTitle.trim())
            return false;
        return aiPrompts.some(p => p.id !== state.activeAiPromptId && (p.title || '').toLowerCase() === state.promptTitle.trim().toLowerCase());
    }, [state.promptTitle, aiPrompts, state.activeAiPromptId]);
    const tagIdsKey = useMemo(() => state.tagIds.join('|'), [state.tagIds]);
    const initialProperties = useMemo(() => {
        return {
            id: state.activeAiPromptId,
            organisationId: state.organisationId,
            tagIds: state.tagIds,
            title: state.promptTitle,
            category: 'aiPrompt',
            tags: state.tagIds.map((id: string) => {
                const found = tags.find(t => t.id === id);
                return found ? found : { id, name: '' };
            }),
            shortcut: state.promptShortcut || '',
        };
    }, [state.activeAiPromptId, state.organisationId, state.promptTitle, state.tagIds, tagIdsKey, tags, state.promptShortcut]);
    const conversationalModelsLinksContent = (<div className="flex min-w-0 flex-col gap-3">
      {/* Conversational Models Links - Clean List View */}
      <div className="flex flex-col gap-2">
        <AiPromptModelSelectorPanel value={{
            enabledModelIds: state.enabledModelIds,
            modelUrls: state.modelUrls,
            customModels: state.customModels || [],
        }} modelSelectionError={state.modelSelectionError} onChange={next => {
            state.setEnabledModelIds(next.enabledModelIds);
            state.setCustomModels(next.customModels);
            Object.entries(next.modelUrls).forEach(([modelId, url]) => {
                if (state.modelUrls[modelId] !== url) {
                    state.setModelUrl(modelId, url);
                }
            });
        }}/>
      </div>
    </div>);
    const sharedPropertiesToolbarContent = (<SharedPropertiesToolbar key={state.activeAiPromptId || 'new-prompt'} initialSnippet={initialProperties} compoundId={currentCompoundId} defaultName={state.promptTitle || 'New Prompt'} onChange={state.handlePropertiesChange} showShortcut={false} showTodo={true} onCreateTodo={async (deadlineVal, isRecurring, recurringCycle) => {
            console.log('[AiPromptEditorView:onCreateTodo] Called with:', { deadlineVal, isRecurring, recurringCycle, activeAiPromptId: state.activeAiPromptId, promptTitle: state.promptTitle });
            let promptId = state.activeAiPromptId;
            if (!promptId || state.isDirty) {
                const savedId = await state.handleSave();
                if (!savedId) {
                    console.warn('[AiPromptEditorView:onCreateTodo] Could not save AI prompt before creating todo.');
                    return;
                }
                promptId = savedId;
            }
            const scheduleTime = deadlineVal ? new Date(deadlineVal).getTime() : Date.now();
            const todoTitle = state.promptTitle || 'New Prompt';
            try {
                const newTodo = await createTodo(todoTitle, [{ type: 'aiPrompt', id: promptId, name: todoTitle }], isRecurring ? 'recurring' : 'one-time', scheduleTime, isRecurring ? recurringCycle as any : undefined, state.promptBody);
                console.log('[AiPromptEditorView:onCreateTodo] Successfully created To-Do in Dexie:', newTodo);
                const chromeAny = (window as any).chrome;
                if (chromeAny?.runtime?.sendMessage) {
                    chromeAny.runtime.sendMessage({
                        action: 'schedule_newtodo_alarm',
                        todoId: newTodo.id,
                        scheduleTime: scheduleTime
                    });
                    console.log('[AiPromptEditorView:onCreateTodo] Dispatched schedule_newtodo_alarm for todoId:', newTodo.id);
                }
            }
            catch (err) {
                console.error('[AiPromptEditorView:onCreateTodo] Failed to create aiPrompt todo', err);
            }
        }} saveStatus={state.saveStatus} entityType="aiPrompt" openPopupsToBottom={true} layout="horizontal" showDocsButton={false} reserveTopRightChromeSpace={isNormalAiPromptMode} appearanceScope={appearanceScope} appearanceTokens={{ ...appearanceTokens, ...FUNCTIONAL_EDITOR_SURFACE_STYLE }} propertyPersistenceAdapter={propertyPersistenceAdapter}/>);
    const shouldRenderAiPromptEditorAsPopup = false;
    const shouldRenderAiPromptSheetWorkspace = isNormalAiPromptMode &&
        !props.aiPromptId &&
        ((workspaceMode === 'sheet' && !state.activeAiPromptId) || shouldRenderAiPromptEditorAsPopup);
    const shouldRenderAiPromptEditorWorkspace = !shouldRenderAiPromptSheetWorkspace || shouldRenderAiPromptEditorAsPopup;
    const renderAiPromptEditorWorkspace = (content: React.ReactNode) => shouldRenderAiPromptEditorAsPopup && typeof document !== 'undefined'
        ? createPortal(content, document.body)
        : content;
    return (<>
      {!isOverlay && (<EditorTopRightChrome docsUrl={BRAND.docs.chatAgentsPrompts} onClose={handleTopRightClose} positionClassName={isWorkspaceCollectionMode ? 'absolute top-0 right-1' : undefined} sheetCreateAction={shouldRenderAiPromptSheetWorkspace ? { label: 'New Chat Agent', onCreate: handleShowSheetCreateEditor } : undefined} sheetExpansion={shouldRenderAiPromptSheetWorkspace ? {
                isExpanded: isCollectionSheetExpanded,
                onToggle: () => setIsCollectionSheetExpanded(expanded => !expanded),
                label: 'chat agent prompts',
            } : undefined}/>)}
      <WorkspaceEditorLayout useBlackSurface isNormalMode={isNormalAiPromptMode} title={shouldRenderAiPromptSheetWorkspace || isAltSAppearance ? '' : state.activeAiPromptId ? 'Edit Chat Agent' : 'Create a Chat Agent'} titleClassName={shouldRenderAiPromptSheetWorkspace ? 'hidden' : isNormalAiPromptMode ? 'absolute left-1/2 top-1/2 w-full max-w-[740px] -translate-x-1/2 -translate-y-1/2 xl:ml-6 px-4 md:px-6 text-lg font-bold text-[var(--color-textPrimary)] truncate pointer-events-none' : undefined} isDirty={state.isDirty} saveStatus={state.saveStatus} lastSavedAt={state.lastSavedAt} activeId={state.activeAiPromptId} onSave={async () => {
            const res = await state.handleSave();
            return !!res;
        }} onDiscard={() => state.loadPrompt(null)} onCloseCallback={state.handleClose} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchPlaceholder="Search prompts..." embeddedFullBleed={hideRightPanel} hideHeaderBorder={isAltSAppearance} showHeaderCloseButton={!isAltSAppearance} useFullHeightWorkspace={shouldRenderAiPromptSheetWorkspace} isRightSiblingExpanded={hideRightPanel ? false : isRightPanelExpanded} rightSiblingPanel={hideRightPanel ? undefined : (<RightSideItemsPanel<any> items={filteredPrompts} activeItemId={state.activeAiPromptId} searchQuery={searchQuery} onSearchChange={setSearchQuery} searchPlaceholder="Search prompts..." getItemTitle={p => p.title || 'Untitled Prompt'} getItemPreview={p => p.prompt ? p.prompt.replace(/<[^>]+>/g, '').substring(0, 100) : ''} getItemIcon={p => {
                const enabledModels = getPromptModels(p);
                return (<div className="flex scale-90 items-center justify-center">
                  <CircularModelStackIcon models={enabledModels} variant="compact" maxVisible={4}/>
                </div>);
            }} getItemCompoundId={p => getItemCompoundId({
                id: p.id,
                organisation_id: p.organisationId,
                snippet: { id: p.id, category: 'aiPrompt' },
            })} getItemType={() => 'aiPrompt'} getItemOrganisationId={p => p.organisationId} getItemTagIds={p => p.tagIds || []} shortcutPrefix="c" shortcutsMap={shortcutsMap} hotkeysMap={hotkeysMap} organisationNamesMap={organisationNamesMap} tagNamesMap={tagNamesMap} onLoadItem={(id: string) => {
                void (async () => {
                    const rec = aiPrompts.find(p => p.id === id);
                    if (!rec)
                        return;
                    if (isOverlay || isSheetCreateEditorOpen || workspaceMode === 'sheet') {
                        await openAiPromptInFullEditor(rec);
                        return;
                    }
                    if (state.isDirty) {
                        const saved = state.flushSave ? await state.flushSave() : await state.handleSave();
                        if (!saved)
                            return;
                    }
                    state.loadPrompt(rec);
                    if (rec.deletedAt == null) recordTimelineOpen('aiPrompt', rec.id);
                })();
            }} onDeleteItem={async (id) => {
                try {
                    const targetPrompt = aiPrompts.find(p => p.id === id);
                    const compoundId = getItemCompoundId({
                        id,
                        organisation_id: targetPrompt?.organisationId || state.organisationId,
                        snippet: { id, category: 'aiPrompt' }
                    });
                    await clearShortcut(id, compoundId, 'aiPrompt');
                    await deleteAiPrompt(id);
                    if (id === state.activeAiPromptId || id === props.aiPromptId) {
                        state.loadPrompt(null);
                    }
                }
                catch (err) {
                    console.error('Delete failed:', err);
                }
            }} onUpdateShortcut={async (id, val) => {
                await handleUpdateItemField(id, 'shortcut', val);
            }} onUpdateTitle={async (id, val) => {
                await handleUpdateItemField(id, 'title', val);
            }} onUpdateTags={async (id, tagText) => {
                await handleUpdateItemField(id, 'tags', tagText);
            }} isFavorite={isFavorite} toggleFavorite={toggleFavorite} addFavorite={addFavorite} isExpanded={isRightPanelExpanded} onExpandChange={setIsRightPanelExpanded} searchInputRef={rightSideSearchInputRef} emptyStateMessage="No Chat Agents found" onCreateItemInTag={async (tagNames, tagIds) => {
                if (state.isDirty) {
                    const saved = state.flushSave ? await state.flushSave() : await state.handleSave();
                    if (!saved)
                        return;
                }
                state.loadPrompt(null);
                // Resolve or create tag records in DB
                const targetOrganisationId = state.organisationId || 'default';
                const resolvedTagIds: string[] = [];
                for (let i = 0; i < tagNames.length; i++) {
                    const name = tagNames[i].trim();
                    if (!name)
                        continue;
                    const directId = tagIds[i];
                    const existing = tags.find((t: any) => t.id === directId || t.name.toLowerCase() === name.toLowerCase());
                    if (existing) {
                        resolvedTagIds.push(existing.id);
                    }
                    else {
                        try {
                            const created = await createTag(name);
                            resolvedTagIds.push(created.id);
                        }
                        catch (err) {
                            console.error('Failed creating tag on + click', err);
                        }
                    }
                }
                state.setTagIds(resolvedTagIds);
                setIsSheetCreateEditorOpen(true);
                setWorkspaceMode('editor');
                setTimeout(() => {
                    state.titleInputRef.current?.focus();
                }, 50);
            }}/>)} deleteModalProps={{
            isOpen: state.isDeleteDialogOpen,
            onClose: () => {
                state.setIsDeleteDialogOpen(false);
                setPromptToDeleteId(null);
            },
            onConfirm: async () => {
                if (promptToDeleteId) {
                    try {
                        const targetPrompt = aiPrompts.find(p => p.id === promptToDeleteId);
                        const compoundId = getItemCompoundId({
                            id: promptToDeleteId,
                            organisation_id: targetPrompt?.organisationId || state.organisationId,
                            snippet: { id: promptToDeleteId, category: 'aiPrompt' }
                        });
                        await clearShortcut(promptToDeleteId, compoundId, 'aiPrompt');
                        await deleteAiPrompt(promptToDeleteId);
                        if (promptToDeleteId === state.activeAiPromptId || promptToDeleteId === props.aiPromptId) {
                            state.loadPrompt(null);
                        }
                    }
                    catch (err) {
                        console.error('Delete failed:', err);
                    }
                }
                state.setIsDeleteDialogOpen(false);
                setPromptToDeleteId(null);
            },
            title: promptToDeleteId && aiPrompts.find(p => p.id === promptToDeleteId)?.title ? `Delete "${aiPrompts.find(p => p.id === promptToDeleteId)?.title}"?` : 'Delete this Chat Agent?',
            description: "Are you sure you want to delete this Chat Agent? This action cannot be undone."
        }} showAutoSaveStatus={!shouldRenderAiPromptSheetWorkspace && !shouldRenderAiPromptEditorAsPopup && !isAltSAppearance} onBackClick={isAltSAppearance ? undefined : shouldReturnToCollectionSheet
            ? props.onBack
            : isNormalAiPromptMode && workspaceMode === 'editor'
                ? handleBackToAiPromptSheet
                : isFullScreenMode ? state.handleClose : undefined}>
        {shouldRenderAiPromptSheetWorkspace && (<AiPromptCollectionSheetView prompts={filteredPrompts} isExpanded={isCollectionSheetExpanded} shortcutsMap={shortcutsMap} hotkeysMap={hotkeysMap} tagNamesMap={tagNamesMap} isFavorite={isFavorite} onOpenPrompt={prompt => {
                void openAiPromptInFullEditor(prompt);
            }} onRunPrompt={runPromptFromSheet} onRunPromptWithoutSavedPrompt={() => requestPromptInput()} onToggleFavorite={id => {
                const prompt = aiPrompts.find(item => item.id === id);
                void toggleFavorite(id, 'aiPrompt', prompt?.title || 'Untitled Chat Agent');
            }} onDeletePrompt={async (id) => {
                const targetPrompt = aiPrompts.find(p => p.id === id);
                const compoundId = getItemCompoundId({
                    id,
                    organisation_id: targetPrompt?.organisationId || state.organisationId,
                    snippet: { id, category: 'aiPrompt' },
                });
                await clearShortcut(id, compoundId, 'aiPrompt');
                await apiClearHotkey(id, compoundId, 'aiPrompt');
                await deleteAiPrompt(id);
            }} onUpdateTitle={(id, value) => handleUpdateItemField(id, 'title', value)} onUpdatePrompt={handleUpdatePromptText} onUpdateShortcut={(id, value) => handleUpdateItemField(id, 'shortcut', value)} onUpdateHotkey={handleUpdatePromptHotkey} onUpdateModels={handleUpdatePromptModels} onUpdateTags={(id, tagIds) => {
                void updateAiPrompt(id, { tagIds });
            }}/>)}
        {shouldRenderAiPromptEditorWorkspace
            ? renderAiPromptEditorWorkspace(<div style={shouldRenderAiPromptEditorAsPopup
                    ? {
                        ...appearanceTokens,
                        backgroundColor: 'color-mix(in srgb, var(--color-overlayBg) 70%, transparent)',
                    }
                    : undefined} className={shouldRenderAiPromptEditorAsPopup
                    ? 'fixed inset-0 z-[100000] flex items-start justify-center overflow-hidden px-4 pb-8 pt-[7vh] backdrop-blur-sm'
                    : 'contents'}>
                <div style={shouldRenderAiPromptEditorAsPopup
                    ? {
                        width: 'min(1160px, calc(100vw - 72px))',
                        maxHeight: 'min(760px, calc(100vh - 96px))',
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
                    } as any
                    : undefined} className={shouldRenderAiPromptEditorAsPopup
                    ? 'flex flex-col overflow-hidden rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-editorBg)] shadow-2xl'
                    : 'contents'}>
                  {shouldRenderAiPromptEditorAsPopup && (<EditorHeader hideBorder={false} title="Create a Chat Agent" isDirty={state.isDirty} saveStatus={state.saveStatus} lastSavedAt={state.lastSavedAt} activeId={state.activeAiPromptId} onCloseClick={handleCloseSheetCreateEditor} showCloseButton/>)}
                  <div className={shouldRenderAiPromptEditorAsPopup ? 'flex min-h-0 flex-1' : 'contents'}>
        <div ref={containerRef} className="relative flex min-h-0 flex-1 flex-col overflow-y-auto custom-scrollbar">
          <div className={`mx-auto grid w-full max-w-[1200px] flex-1 grid-cols-1 gap-8 pb-2 2xl:grid-cols-[minmax(0,1fr)_minmax(260px,360px)] ${shouldRenderAiPromptEditorAsPopup ? 'px-4 md:px-5 pt-0.5' : 'px-4 md:px-6 pt-1'}`}>
            <div className="min-w-0">
            {isAltSAppearance && (<div className="mb-5">
                <h2 className="relative flex min-w-0 items-center gap-3 text-xl font-bold text-[var(--color-textPrimary)]">
                  {(shouldReturnToCollectionSheet ? props.onBack : isNormalAiPromptMode && workspaceMode === 'editor' ? handleBackToAiPromptSheet : isFullScreenMode ? state.handleClose : undefined) && (<EditorBackButton outsideTitle onClick={shouldReturnToCollectionSheet ? props.onBack! : isFullScreenMode ? state.handleClose : handleBackToAiPromptSheet}/>)}
                  {state.activeAiPromptId ? 'Edit Chat Agent' : 'Create a Chat Agent'}
                </h2>
              </div>)}
            <div>
              <div className="min-w-0">
                <EditorTitleShortcutInput title={state.promptTitle} setTitle={(val) => {
                    state.setPromptTitle(val);
                    if (val.trim())
                        setTitleError(null);
                }} titleError={titleError} shortcutError={state.shortcutError} isOverrideable={state.isShortcutOverrideable} onResolveShortcut={state.handleResolveShortcut} shortcutReferenceId={state.activeAiPromptId || 'new'} shortcut={state.promptShortcut} setShortcut={state.setPromptShortcut} titlePlaceholder="Title" shortcutPlaceholder="Command Shortcut" onTitleBlur={() => {
                    if (!state.promptTitle.trim()) {
                        setTitleError('Enter the title');
                    }
                    else if (state.isDirty && !shouldRenderAiPromptEditorAsPopup) {
                        state.handleSave();
                    }
                }} onShortcutBlur={() => state.isDirty && !shouldRenderAiPromptEditorAsPopup && state.handleSave()} onTitleEnter={async () => {
                    if (!state.promptTitle.trim()) {
                        setTitleError('Enter the title');
                    }
                    else if (state.isDirty) {
                        await state.handleSave();
                    }
                }} onShortcutEnter={async () => {
                    if (state.isDirty) {
                        await state.handleSave();
                    }
                }} onArrowDownPress={() => {
                    const editorDom = containerRef.current?.querySelector('.ProseMirror, .ql-editor') as HTMLElement | null;
                    editorDom?.focus();
                }} onCopyTitleToShortcut={handleCopyTitleToShortcut} titleRef={state.titleInputRef} shortcutRef={shortcutInputRef}/>
              </div>
            </div>

            {/* Main Workspace Inner Content */}
            <div className="relative mt-4 flex min-w-0 flex-col">
              {/* Prompt Text Editor */}
              <div className={`flex-shrink-0 flex flex-col gap-1.5 pb-2 text-sm font-medium ${isNormalAiPromptMode ? 'h-auto overflow-visible' : hideRightPanel ? 'min-h-[220px] relative' : 'flex-1 min-h-[140px] relative'}`}>
                <h4 className="text-xs font-semibold text-[var(--color-textSecondary)] px-3.5 flex items-center gap-1">
                  Prompt <span className="text-red-500">*</span>
                </h4>
                <div className={`relative rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] shadow-sm px-0 py-0 overflow-hidden cursor-text`} style={{ minHeight: '220px', maxHeight: 'clamp(280px, 35vh, 400px)' }} onClick={(e) => {
                    if (e.target === e.currentTarget) {
                        const editorDom = e.currentTarget.querySelector('.ql-editor') as HTMLElement | null;
                        editorDom?.focus();
                    }
                }}>
                  <TextEditor key={state.activeAiPromptId || 'new'} value={state.promptBody} onChange={state.setPromptBody} placeholder="Enter your prompt (Optional)" readOnly={false} onUpArrowAtStart={() => state.titleInputRef.current?.focus()} showToolbar={true} toolbarSelector={toolbarSelector} isFocusMode={isFullScreenMode}/>

                  {state.activeAiPromptId && (<button id="create-another-btn" type="button" onClick={handleCreateNew} onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltipPos({
                            top: rect.top + window.scrollY - 46,
                            left: rect.left + window.scrollX - 40,
                        });
                        setShowTooltip(true);
                    }} onMouseLeave={() => setShowTooltip(false)} className="absolute bottom-3 right-3 z-50 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all active:scale-95 border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] cursor-pointer select-none">
                  <span>Create another</span>
                </button>)}
                </div>
              </div>
            </div>
            </div>
            <aside className="flex min-w-0 flex-col gap-3 self-start">
              <div className="flex justify-start">{sharedPropertiesToolbarContent}</div>
              {conversationalModelsLinksContent}
            </aside>
          </div>
        </div>
                  </div>
                </div>
              </div>)
            : null}
      </WorkspaceEditorLayout>

      {/* Hidden toolbar container for TextEditor */}
      <div id={toolbarIdRef.current} className="hidden"/>

      {showTooltip && createPortal(<div style={{
                position: 'absolute',
                top: `${tooltipPos.top}px`,
                left: `${tooltipPos.left}px`,
            }} className="rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-popupBg)] px-3 py-2 shadow-2xl z-[999999] flex items-center gap-3 text-[12px] font-sans text-[var(--color-textPrimary)] pointer-events-none">
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textPrimary)]">Ctrl</kbd>
            <span className="text-[10px] text-[var(--color-textSecondary)] font-bold">+</span>
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textPrimary)]">Shift</kbd>
            <span className="text-[10px] text-[var(--color-textSecondary)] font-bold">+</span>
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textPrimary)]">Enter</kbd>
          </div>
          <span className="text-[var(--color-textSecondary)] text-left whitespace-nowrap">to save and create another</span>
        </div>, document.body)}
    </>);
}
