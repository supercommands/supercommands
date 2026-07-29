/**
 * @file AiPromptEditorView.tsx
 * @description The main user interface component for creating and editing AI prompts.
 * Renders the dual-column editor container (Title, Shortcut, Prompt Editor on the left;
 * Model selection, Workspace/Folder destination, Tags mapping on the right) and the
 * existing prompts list using ExistingItemsTable at the bottom.
 */

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { StorageManager } from '../../../../../storage/localStorage/storageManager';
import { useAiPromptEditor } from '../useAiPromptEditor';
import { updateAiPrompt, deleteAiPrompt } from '../aiPromptData';
import { createTodo } from '../../todos/todoData';
import { createTag } from '../../tags/tagData';
import { useFavorites } from '../../../../../shared-components/favorites/favoriteHooks';
import TextEditor from '../../../../../shared-components/TextEditor';
import { useAppearance } from '@extension/ui';
import { 
  FaTimes, FaExternalLinkAlt, FaSpinner, FaPencilAlt, FaChevronDown, 
  FaCog, FaAsterisk, FaPlus, FaKeyboard, FaFolder, FaCheck, FaTrash, FaStar 
} from 'react-icons/fa';
import { FiSearch, FiCopy, FiTag, FiStar } from 'react-icons/fi';
import { getFaviconUrl, stripCmdStatus } from '../../../../../shared-components/searchBarMain/utilityFunctions/utils';
import { AutoSaveIndicator } from '../../../../../shared-components/autoSaveEngine/autoSave';
import { ExistingItemsTable } from '../../../../../shared-components/editorContainer/ExistingItemsTable';
import { WorkspaceEditorLayout } from '../../../../../shared-components/editorContainer/WorkspaceEditorLayout';
import { EditorTitleShortcutInput } from '../../../../../shared-components/editorContainer/EditorTitleShortcutInput';
import { SharedPropertiesToolbar } from '../../../../../shared-components/editorToolbar/SharedPropertiesToolbar';
import { DestinationPicker } from '../../../../../shared-components/editorToolbar/DestinationPicker';
import { saveShortcut, clearShortcut } from '../../../../../shared-components/shortcuts';
import { readAllShortcuts, getItemCompoundId } from '../../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { HotkeyAssignButton } from '../../../../../shared-components/hotkeys';

interface ModelOption {
  id: string;
  name: string;
  host: string;
}

const MODELS: ModelOption[] = [
  { id: 'gpt', name: 'ChatGPT', host: 'chatgpt.com' },
  { id: 'claude', name: 'Claude', host: 'claude.ai' },
  { id: 'gemini', name: 'Gemini', host: 'gemini.google.com' },
  { id: 'perplexity', name: 'Perplexity', host: 'perplexity.ai' },
];

export interface AiPromptEditorViewProps {
  aiPromptId?: string | null;
  onBack?: () => void;
  initialTitle?: string;
  initialPrompt?: string;
  isFullScreenMode?: boolean;
}

export function AiPromptEditorView(props: AiPromptEditorViewProps) {
  const { isFullScreenMode = false } = props;
  const state = useAiPromptEditor(props);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useAppearance();
  const isDark = theme.isDark;
  const toolbarIdRef = useRef(`prompt-toolbar-${Math.random().toString(36).slice(2, 10)}`);
  const toolbarSelector = `#${toolbarIdRef.current}`;
  const shortcutInputRef = useRef<HTMLInputElement>(null);
  const tagPopupRef = useRef<HTMLDivElement>(null);

  const aiPrompts = useDbStore(state => state.aiPrompts) || [];
  const workspaces = useDbStore(state => state.workspaces) || [];
  const folders = useDbStore(state => state.folders) || [];
  const hotkeysMap = useDbStore(state => state.hotkeysMap) || [];
  const tags = useDbStore(state => state.tags) || [];

  const currentCompoundId = useMemo(() => {
    if (!state.activeAiPromptId) return '';
    return getItemCompoundId({
      id: state.activeAiPromptId,
      workspace_id: state.workspaceId || null,
      folder_id: state.folderId || null,
      snippet: { id: state.activeAiPromptId, category: 'aiPrompt' }
    });
  }, [state.activeAiPromptId, state.workspaceId, state.folderId]);

  const [excludedModels, setExcludedModels] = useState<string[]>([]);
  const [isAddModelOpen, setIsAddModelOpen] = useState(false);
  const [newModelProvider, setNewModelProvider] = useState('gpt');
  const [newModelName, setNewModelName] = useState('ChatGPT');
  const [customPromptText, setCustomPromptText] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [shortcutsMap, setShortcutsMap] = useState<Record<string, string>>({});
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [tagPopupOpen, setTagPopupOpen] = useState(false);
  const [promptToDeleteId, setPromptToDeleteId] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [titleError, setTitleError] = useState<string | null>(null);

  // Clear validation errors when switching between active prompts/drafts
  useEffect(() => {
    setTitleError(null);
  }, [state.activeAiPromptId]);

  const { isFavorite, toggleFavorite } = useFavorites();

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

  const fetchAllShortcuts = useCallback(async () => {
    try {
      const map = await readAllShortcuts();
      setShortcutsMap(map);
    } catch (e) {
      console.warn('Failed to load shortcuts:', e);
    }
  }, []);

  useEffect(() => {
    void fetchAllShortcuts();
    window.addEventListener('storage', fetchAllShortcuts);
    return () => window.removeEventListener('storage', fetchAllShortcuts);
  }, [aiPrompts, fetchAllShortcuts]);

  useEffect(() => {
    if (state.titleInputRef.current) {
      state.titleInputRef.current.focus();
    }
  }, [state.activeAiPromptId, state.titleInputRef]);

  useEffect(() => {
    StorageManager.getItem('aiPrompt_excludedModels').then((stored: any) => {
      if (stored) {
        try {
          setExcludedModels(JSON.parse(stored));
        } catch {
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
        if (state.saveStatus === 'saving') return;
        
        void (async () => {
          if (state.isDirty) {
            await state.handleSave();
          }
          state.loadPrompt(null);
          useUIStore.getState().openEditor({ type: 'aiPrompt', id: 'new', isNew: true });
        })();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [state.saveStatus, state.isDirty, state.handleSave, state.loadPrompt]);

  // Register escape handler with uiStateManager
  useEffect(() => {
    const handler = () => {
      if (isAddModelOpen || state.isUnsavedChangesDialogOpen || state.isDeleteDialogOpen) {
        return true; // let those handle it or block it
      }
      state.handleClose();
      return true; // We intercepted the escape
    };
    useUIStore.getState().setEditorEscapeHandler(handler);
    return () => useUIStore.getState().setEditorEscapeHandler(null);
  }, [state, isAddModelOpen]);

  const toggleModelExclusion = (modelId: string) => {
    setExcludedModels(prev => {
      const next = prev.includes(modelId) ? prev.filter(id => id !== modelId) : [...prev, modelId];
      void StorageManager.setItem('aiPrompt_excludedModels', JSON.stringify(next));
      return next;
    });
  };

  const handleProviderChange = (providerId: string) => {
    setNewModelProvider(providerId);
    const defaultNames: Record<string, string> = {
      gpt: 'ChatGPT',
      claude: 'Claude',
      gemini: 'Gemini',
      perplexity: 'Perplexity',
    };
    setNewModelName(defaultNames[providerId] || 'ChatGPT');
  };

  const handleOpenAddModal = () => {
    const cleanBody = state.promptBody
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();
    setCustomPromptText(cleanBody);
    setNewModelProvider('gpt');
    setNewModelName('ChatGPT');
    setIsAddModelOpen(true);
  };

  const handleAddAndGenerate = () => {
    if (!newModelName.trim()) return;

    const providerHosts: Record<string, string> = {
      gpt: 'chatgpt.com',
      claude: 'claude.ai',
      gemini: 'gemini.google.com',
      perplexity: 'perplexity.ai',
    };

    let targetModelId = '';

    const matchedDefault = MODELS.find(m => m.name.toLowerCase() === newModelName.trim().toLowerCase());
    if (matchedDefault) {
      targetModelId = matchedDefault.id;
      if (excludedModels.includes(targetModelId)) {
        setExcludedModels(prev => {
          const next = prev.filter(id => id !== targetModelId);
          void StorageManager.setItem('aiPrompt_excludedModels', JSON.stringify(next));
          return next;
        });
      }
    } else {
      const newId = `${newModelProvider}_custom_${Date.now()}`;
      const newModel = {
        id: newId,
        name: newModelName.trim(),
        host: providerHosts[newModelProvider] || 'chatgpt.com',
      };
      state.setCustomModels([...(state.customModels || []), newModel]);
      targetModelId = newId;
    }

    state.handleGenerateLink(targetModelId, customPromptText);
    setIsAddModelOpen(false);
  };

  const handleDeleteCustomModel = (modelId: string) => {
    state.setCustomModels((state.customModels || []).filter((m: any) => m.id !== modelId));
  };

  const isFocusMode = useUIStore((s: any) => s.isFocusMode);
  const isEmbedded = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === 'true';

  useEffect(() => {
    if (state.generatedUrl && !state.isGenerating && state.saveStatus !== 'saving' && state.saveStatus !== 'saved') {
      state.handleSave();
    }
  }, [state.generatedUrl, state.isGenerating, state.saveStatus]);

  const ALL_MODELS = [
    ...MODELS,
    ...(state.customModels || [])
  ];

  const sortedPrompts = useMemo(() => {
    return [...aiPrompts].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [aiPrompts]);

  const filteredPrompts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return sortedPrompts;
    return sortedPrompts.filter(
      p =>
        (p.title || '').toLowerCase().includes(q) ||
        (p.prompt || '').toLowerCase().includes(q)
    );
  }, [sortedPrompts, searchQuery]);

  const handleCopyTitleToShortcut = useCallback(() => {
    const sanitized = state.promptTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
    state.setPromptShortcut(sanitized);
  }, [state.promptTitle, state.setPromptShortcut]);

  const handleCreateNew = useCallback(async () => {
    if (state.isDirty) {
      await state.handleSave();
    }
    state.loadPrompt(null);
    useUIStore.getState().openEditor({ type: 'aiPrompt', id: 'new', isNew: true });
  }, [state.isDirty, state.handleSave, state.loadPrompt]);

  const handleUpdateItemField = async (itemId: string, field: 'title' | 'shortcut' | 'tags', value: string) => {
    try {
      if (field === 'title') {
        await updateAiPrompt(itemId, { title: value });
      } else if (field === 'shortcut') {
        const record = aiPrompts.find(p => p.id === itemId);
        if (record) {
          const wsObj = record.workspaceId ? { workspace_id: record.workspaceId } : null;
          const fldObj = record.folderId ? { folder_id: record.folderId } : null;
          const compoundId = getItemCompoundId({
            id: record.id,
            workspace_id: record.workspaceId || null,
            folder_id: record.folderId || null,
            snippet: { id: record.id, category: 'aiPrompt' }
          });
          if (value) {
            await saveShortcut(itemId, compoundId, value.toLowerCase().replace(/[^a-z0-9]/g, ''), record.title, 'aiPrompt');
          } else {
            await clearShortcut(itemId, compoundId, 'aiPrompt');
          }
        }
      } else if (field === 'tags') {
        const tagNames = value.split(',').map(t => t.trim()).filter(Boolean);
        const resolvedTags: any[] = [];
        for (const name of tagNames) {
          const matchedTag = tags.find((t: any) => t.name.toLowerCase() === name.toLowerCase());
          if (matchedTag) {
            resolvedTags.push(matchedTag);
          } else {
            const record = aiPrompts.find(p => p.id === itemId);
            const smartWs = record?.workspaceId || workspaces[0]?.id;
            if (smartWs) {
              const newTag = await createTag(name, smartWs);
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
    } catch (e) {
      console.error('Failed to update field:', e);
    }
  };

  const handleTagToggle = (tagId: string) => {
    if (state.tagIds.includes(tagId)) {
      state.setTagIds(state.tagIds.filter(id => id !== tagId));
    } else {
      state.setTagIds([...state.tagIds, tagId]);
    }
  };

  const handleCreateTag = async () => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    try {
      const smartWs = state.workspaceId || workspaces[0]?.id;
      if (smartWs) {
        const newTag = await createTag(trimmed, smartWs);
        state.setTagIds([...state.tagIds, newTag.id]);
        setNewTagName('');
      }
    } catch (err) {
      console.error('Failed to create tag:', err);
    }
  };

  const isDuplicateTitle = useMemo(() => {
    if (!state.promptTitle.trim()) return false;
    return aiPrompts.some(p => p.id !== state.activeAiPromptId && (p.title || '').toLowerCase() === state.promptTitle.trim().toLowerCase());
  }, [state.promptTitle, aiPrompts, state.activeAiPromptId]);

  const tagIdsKey = useMemo(() => [...state.tagIds].sort().join('|'), [state.tagIds]);

  const initialProperties = useMemo(() => {
    return {
      id: state.activeAiPromptId,
      workspaceId: state.workspaceId,
      folderId: state.folderId,
      tagIds: state.tagIds,
      title: state.promptTitle,
      category: 'aiPrompt',
      tags: [...state.tagIds].sort().map((id: string) => {
        const found = tags.find(t => t.id === id);
        return found ? found : { id, name: '' };
      }),
    };
  }, [state.activeAiPromptId, state.workspaceId, state.folderId, state.promptTitle, state.tagIds, tagIdsKey, tags]);

  return (
    <>
      <WorkspaceEditorLayout
        title={state.activeAiPromptId ? 'AI Prompts' : 'Create a AI Prompt'}
        isDirty={state.isDirty}
        saveStatus={state.saveStatus}
        lastSavedAt={state.lastSavedAt}
        activeId={state.activeAiPromptId}
        onSave={async () => {
          const res = await state.handleSave();
          return !!res;
        }}
        onDiscard={() => state.loadPrompt(null)}
        onCloseCallback={state.handleClose}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchPlaceholder="Search prompts..."
        deleteModalProps={{
          isOpen: state.isDeleteDialogOpen,
          onClose: () => {
            state.setIsDeleteDialogOpen(false);
            setPromptToDeleteId(null);
          },
          onConfirm: async () => {
            if (promptToDeleteId) {
              try {
                const wsObj = state.workspaceId ? { workspace_id: state.workspaceId } : null;
                const fldObj = state.folderId ? { folder_id: state.folderId } : null;
                const compoundId = getItemCompoundId({
                  id: promptToDeleteId,
                  workspace_id: state.workspaceId || null,
                  folder_id: state.folderId || null,
                  snippet: { id: promptToDeleteId, category: 'aiPrompt' }
                });
                await clearShortcut(promptToDeleteId, compoundId, 'aiPrompt');
                await deleteAiPrompt(promptToDeleteId);
                if (promptToDeleteId === state.activeAiPromptId) {
                  state.loadPrompt(null);
                }
              } catch (err) {
                console.error('Delete failed:', err);
              }
            }
            state.setIsDeleteDialogOpen(false);
            setPromptToDeleteId(null);
          },
          title: promptToDeleteId && aiPrompts.find(p => p.id === promptToDeleteId)?.title ? `Delete "${aiPrompts.find(p => p.id === promptToDeleteId)?.title}"?` : 'Delete this prompt?',
          description: "Are you sure you want to delete this AI prompt? This action cannot be undone."
        }}
        headerActions={
          <SharedPropertiesToolbar
            key={state.activeAiPromptId || 'new-prompt'}
            initialSnippet={state.activeAiPromptId ? initialProperties : null}
            compoundId={currentCompoundId}
            defaultName={state.promptTitle || 'New Prompt'}
            onChange={state.handlePropertiesChange}
            showShortcut={false}
            showTodo={true}
            onCreateTodo={async (deadlineVal, isRecurring, recurringCycle) => {
              if (!state.activeAiPromptId) return;
              const scheduleTime = deadlineVal ? new Date(deadlineVal).getTime() : Date.now();
              try {
                const newTodo = await createTodo(
                  state.promptTitle || 'New Prompt',
                  [{ type: 'aiPrompt', id: state.activeAiPromptId }],
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
                console.error('Failed to create aiPrompt todo', err);
              }
            }}
            saveStatus={state.saveStatus}
            openPopupsToBottom={true}
            layout="horizontal"
          />
        }
        rightColumnContent={
          <div className="flex flex-col gap-4 h-full overflow-visible">
            {/* Conversational Models Links - Right Side Table */}
            <div className="flex flex-col gap-2 mt-2">
              <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 px-1">
                Conversational Models Links
              </label>
              
              <div className="rounded-xl border border-black/10 dark:border-white/10 overflow-hidden bg-black/[0.02] dark:bg-white/[0.02] flex flex-col">
                {/* Table Header */}
                <div className="grid grid-cols-[50px_90px_1fr_16px] items-stretch border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
                  <div className="flex items-center justify-center py-1.5 border-r border-black/10 dark:border-white/10">
                    <span className="text-[10px] font-semibold text-neutral-500">Enabled</span>
                  </div>
                  <div className="flex items-center py-1.5 px-2 border-r border-black/10 dark:border-white/10">
                    <span className="text-[10px] font-semibold text-neutral-500">Model</span>
                  </div>
                  <div className="flex items-center py-1.5 px-2">
                    <span className="text-[10px] font-semibold text-neutral-500">Link</span>
                  </div>
                  <div className="w-4 shrink-0" />
                </div>
                
                {/* Table Body */}
                <div className="flex flex-col max-h-[160px] overflow-y-auto custom-scrollbar">
                  {ALL_MODELS.map((model) => {
                    const isEnabled = !excludedModels.includes(model.id);
                    const isCustom = !MODELS.some(m => m.id === model.id);
                    return (
                      <div
                        key={model.id}
                        className="grid grid-cols-[50px_90px_1fr_16px] items-stretch border-b border-black/5 dark:border-white/5 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                      >
                        {/* Checkbox */}
                        <div className="flex items-center justify-center py-1 border-r border-black/5 dark:border-white/5">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => toggleModelExclusion(model.id)}
                            className="w-3 h-3 cursor-pointer rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                          />
                        </div>
                        
                        {/* Model name */}
                        <div className="flex items-center gap-1.5 px-2 py-1 border-r border-black/5 dark:border-white/5">
                          <img
                            src={getFaviconUrl(model.host)}
                            alt={model.name}
                            className="w-3 h-3 object-contain"
                          />
                          <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400 truncate">
                            {model.name}
                          </span>
                        </div>
                        
                        {/* URL Link Input */}
                        <div className="flex items-center px-1.5 py-1">
                          <input
                            value={state.modelUrls[model.id] ?? `https://${model.host}`}
                            onChange={e => state.setModelUrl(model.id, e.target.value)}
                            className="w-full text-[9px] bg-transparent border border-black/10 dark:border-white/10 rounded px-1.5 py-0.5 outline-none text-neutral-700 dark:text-neutral-300 placeholder-black/35 dark:placeholder-white/35"
                            placeholder="Enter URL..."
                          />
                        </div>
                        
                        {/* Delete custom model button */}
                        <div className="flex items-center justify-center">
                          {isCustom ? (
                            <button
                              onClick={() => handleDeleteCustomModel(model.id)}
                              className="text-red-400 hover:text-red-600 transition-colors p-0.5"
                            >
                              <FaTimes size={8} />
                            </button>
                          ) : (
                            <span className="w-3.5 h-3.5" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Add Custom Button */}
                <div className="flex justify-center p-1.5 border-t border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
                  <button
                    onClick={handleOpenAddModal}
                    className="flex items-center justify-center w-6 h-6 rounded-full border border-black/10 dark:border-white/10 bg-white dark:bg-[#1a1a1a] hover:bg-black/5 dark:hover:bg-white/5 text-neutral-600 dark:text-neutral-300 shadow-sm transition-all"
                    title="Add Custom Model"
                  >
                    <FaPlus size={10} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        }
        bottomListContent={
          <ExistingItemsTable
            items={filteredPrompts}
            activeItemId={state.activeAiPromptId}
            onLoadItem={(id: string) => {
              const rec = aiPrompts.find(p => p.id === id);
              if (rec) state.loadPrompt(rec);
            }}
            getItemTitle={(p: any) => p.title || ''}
            getItemPreview={(p: any) => p.prompt ? p.prompt.replace(/<[^>]+>/g, '').substring(0, 100) : ''}
            getItemCompoundId={(p: any) => getItemCompoundId({
              id: p.id,
              workspace_id: p.workspaceId || null,
              folder_id: p.folderId || null,
              snippet: { id: p.id, category: 'aiPrompt' }
            })}
            getItemType={() => 'aiPrompt'}
            shortcutsMap={shortcutsMap}
            hotkeysMap={hotkeysMap}
            isFavorite={isFavorite}
            toggleFavorite={toggleFavorite}
            onDeleteClick={(id: string) => {
              setPromptToDeleteId(id);
              state.setIsDeleteDialogOpen(true);
            }}
            onFavoriteToggled={fetchAllShortcuts}
            onUpdateItemField={handleUpdateItemField}
            folderNamesMap={folderNamesMap}
            workspaceNamesMap={workspaceNamesMap}
            tagNamesMap={tagNamesMap}
            emptyStateMessage="No AI prompts found. Type above to create your first prompt!"
            isFullScreenMode={isFullScreenMode}
            title=""
          />
        }
      >
        <div ref={containerRef} className="flex-1 flex flex-col min-h-0 relative">
          <div className="w-full flex-1 flex flex-col min-h-0 px-3 pt-0.5 pb-2 overflow-hidden">
            <EditorTitleShortcutInput
              title={state.promptTitle}
              setTitle={(val) => {
                state.setPromptTitle(val);
                if (val.trim()) setTitleError(null);
              }}
              titleError={titleError}
              shortcutError={state.shortcutError}
              isOverrideable={state.isShortcutOverrideable}
              onOverrideShortcut={state.handleOverrideShortcut}
              shortcut={state.promptShortcut}
              setShortcut={state.setPromptShortcut}
              titlePlaceholder="Title"
              shortcutPlaceholder="Shortcut"
              onTitleBlur={() => {
                if (!state.promptTitle.trim()) {
                  setTitleError('Enter the title');
                } else if (state.isDirty) {
                  state.handleSave();
                }
              }}
              onShortcutBlur={() => state.isDirty && state.handleSave()}
              onTitleEnter={async (shiftKey) => {
                if (shiftKey) {
                  handleCopyTitleToShortcut();
                  const editorDom = containerRef.current?.querySelector('.ProseMirror, .ql-editor') as HTMLElement | null;
                  editorDom?.focus();
                } else {
                  if (!state.promptTitle.trim()) {
                    setTitleError('Enter the title');
                  } else if (state.isDirty) {
                    await state.handleSave();
                  }
                }
              }}
              onShortcutEnter={async () => {
                if (state.isDirty) await state.handleSave();
              }}
              onArrowDownPress={() => {
                const editorDom = containerRef.current?.querySelector('.ProseMirror, .ql-editor') as HTMLElement | null;
                editorDom?.focus();
              }}
              onCopyTitleToShortcut={handleCopyTitleToShortcut}
              titleRef={state.titleInputRef}
              shortcutRef={shortcutInputRef}
            />

            {/* Main Workspace Inner Content */}
            <div className="flex-1 flex flex-col min-w-0 relative h-full max-h-full overflow-hidden mt-4">
              {/* Prompt Text Editor */}
              <div className="flex-1 min-h-[140px] relative flex flex-col gap-1.5 pb-2 text-sm font-medium">
                <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 px-3.5 flex items-center gap-1">
                  Prompt <span className="text-red-500">*</span>
                </h4>
                <div className="flex-1 relative rounded-xl border border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] overflow-hidden px-0 py-0">
                  <TextEditor
                    key={state.activeAiPromptId || 'new'}
                    value={state.promptBody}
                    onChange={state.setPromptBody}
                    placeholder="Elaborate your prompt"
                    readOnly={false}
                    onUpArrowAtStart={() => state.titleInputRef.current?.focus()}
                    showToolbar={true}
                    toolbarSelector={toolbarSelector}
                    isFocusMode={isFullScreenMode}
                  />

                  {state.activeAiPromptId && (
                <button
                  id="create-another-btn"
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
                  className="absolute bottom-3 right-3 z-50 flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] font-semibold shadow-sm transition-all active:scale-95 border-black/10 dark:border-white/20 bg-neutral-100 dark:bg-white/10 text-neutral-800 dark:text-white/90 hover:bg-neutral-200 dark:hover:bg-white/20 hover:text-neutral-900 dark:hover:text-white cursor-pointer select-none"
                >
                  <span>Create another</span>
                </button>
              )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </WorkspaceEditorLayout>

      {/* Hidden toolbar container for TextEditor */}
      <div id={toolbarIdRef.current} className="hidden" />

      {/* Add Custom Model Dialog Modal */}
      {isAddModelOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[400px] rounded-xl p-5 border border-black/10 dark:border-white/10 shadow-2xl transition-all bg-[#171821] text-white">
            <h3 className="text-sm font-semibold mb-4 text-white">Add Custom Model Slot</h3>
            
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold opacity-60 text-neutral-400">Provider (Icon & Host)</label>
                <select
                  value={newModelProvider}
                  onChange={e => handleProviderChange(e.target.value)}
                  className="w-full text-xs border rounded-md px-3 py-2 outline-none bg-black/20 border-white/10 text-white">
                  <option value="gpt" className="bg-[#171821]">ChatGPT</option>
                  <option value="claude" className="bg-[#171821]">Claude</option>
                  <option value="gemini" className="bg-[#171821]">Gemini</option>
                  <option value="perplexity" className="bg-[#171821]">Perplexity</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold opacity-60 text-neutral-400">Model Name</label>
                <input
                  type="text"
                  value={newModelName}
                  onChange={e => setNewModelName(e.target.value)}
                  placeholder="e.g. ChatGPT Copy"
                  className="w-full text-xs border border-white/10 rounded-md px-3 py-2 outline-none bg-black/20 text-white placeholder-neutral-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-semibold opacity-60 text-neutral-400">Prompt Message</label>
                <textarea
                  rows={4}
                  value={customPromptText}
                  onChange={e => setCustomPromptText(e.target.value)}
                  className="w-full text-xs border border-white/10 rounded-md p-3 outline-none resize-none font-medium bg-black/20 text-white placeholder-neutral-500"
                  placeholder="Enter prompt message..."
                />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setIsAddModelOpen(false)}
                className="flex-1 py-2 px-3 text-xs font-semibold rounded-md border text-center transition-all bg-black/10 border-white/10 text-neutral-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                disabled={!newModelName.trim() || !customPromptText.trim()}
                onClick={handleAddAndGenerate}
                className="flex-1 py-2 px-3 text-xs font-semibold rounded-md text-center transition-all bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Generate Links
              </button>
            </div>
          </div>
        </div>
      )}

      {showTooltip && createPortal(
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
          <span className="text-neutral-400 text-left whitespace-nowrap">to save and create another</span>
        </div>,
        document.body
      )}
    </>
  );
}
