/**
 * @file AiPromptEditorView.tsx
 * @description The main user interface component for creating and editing AI prompts.
 * Renders the dual-column editor container (Title, Shortcut, Prompt Editor on the left;
 * Model selection, Workspace/Folder destination, Tags mapping on the right) and the
 * existing prompts list using ExistingItemsTable at the bottom.
 */

import * as React from 'react';
import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
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
import { RightSideItemsPanel } from '../../../../../shared-components/editorContainer/RightSideItemsPanel';
import { WorkspaceEditorLayout } from '../../../../../shared-components/editorContainer/WorkspaceEditorLayout';
import { EditorTitleShortcutInput } from '../../../../../shared-components/editorContainer/EditorTitleShortcutInput';
import { SharedPropertiesToolbar } from '../../../../../shared-components/editorToolbar/SharedPropertiesToolbar';
import { DestinationPicker } from '../../../../../shared-components/editorToolbar/DestinationPicker';
import { saveShortcut, clearShortcut } from '../../../../../shared-components/shortcuts';
import { readAllShortcuts, getItemCompoundId } from '../../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { HotkeyAssignButton } from '../../../../../shared-components/hotkeys';
import { generateEntityId } from '../../../../../shared-components/utils/idGenerator';
import type { CustomModelConfig } from '../aiPromptTypes';
import CircularModelStackIcon from '../../../../../shared-components/icons/circularModelStackIcon';
import { resolveEnabledAiPromptModels, type AiModelTarget } from '../aiPromptModelHelpers';
import { useExcludedAiPromptModels } from '../useExcludedAiPromptModels';

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
  initialModelUrls?: Record<string, string>;
  initialTagIds?: string[];
  onAiPromptCreated?: (prompt: any) => void | Promise<void>;
  isFullScreenMode?: boolean;
  isOverlay?: boolean;
  hideRightPanel?: boolean;
  appearanceScope?: 'default' | 'alts';
  appearanceTokens?: React.CSSProperties;
  saveAiPromptAdapter?: (args: {
    mode: 'create' | 'update';
    aiPromptId?: string;
    input: any;
  }) => Promise<any>;
  propertyPersistenceAdapter?: React.ComponentProps<typeof SharedPropertiesToolbar>['propertyPersistenceAdapter'];
}

export function AiPromptEditorView(props: AiPromptEditorViewProps) {
  const {
    isFullScreenMode = false,
    isOverlay: propIsOverlay = false,
    hideRightPanel = false,
    appearanceScope = 'default',
    appearanceTokens,
    propertyPersistenceAdapter,
  } = props;
  const activeEditor = useUIStore(s => s.activeEditor);
  const isFocusMode = useUIStore(s => s.isFocusMode);
  const isOverlay = Boolean(propIsOverlay || activeEditor?.props?.isOverlay);
  const isNormalAiPromptMode = !isFullScreenMode && !isOverlay && !isFocusMode;

  const state = useAiPromptEditor(props);
  const { excludedModelIds } = useExcludedAiPromptModels();
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
  const getPromptModels = useCallback((p: any): AiModelTarget[] => {
    if (!p) return [];

    let targetEnabledIds: string[] | undefined = undefined;
    let targetCustomModels: CustomModelConfig[] = p.customModels || [];

    if (p.id === state.activeAiPromptId) {
      targetEnabledIds = state.enabledModelIds;
      targetCustomModels = state.customModels || [];
    } else if (Array.isArray(p.enabledModelIds) && p.enabledModelIds.length > 0) {
      targetEnabledIds = p.enabledModelIds;
    } else if (p.modelUrls && typeof p.modelUrls === 'object' && Object.keys(p.modelUrls).length > 0) {
      targetEnabledIds = Object.keys(p.modelUrls);
    }

    return resolveEnabledAiPromptModels(
      { enabledModelIds: targetEnabledIds, customModels: targetCustomModels },
      excludedModelIds
    );
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
        setShowTooltip(false);
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
  }, [isAddModelOpen, state.isUnsavedChangesDialogOpen, state.isDeleteDialogOpen, state.handleClose]);

  const toggleModelExclusion = (modelId: string) => {
    state.toggleModelEnabled(modelId);
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
      if (!state.enabledModelIds.includes(targetModelId)) {
        state.toggleModelEnabled(targetModelId);
      }
    } else {
      const newId = generateEntityId(`${newModelProvider}CustomModel`);
      const newModel = {
        id: newId,
        name: newModelName.trim(),
        host: providerHosts[newModelProvider] || 'chatgpt.com',
      };
      state.setCustomModels([...(state.customModels || []), newModel]);
      if (!state.enabledModelIds.includes(newId)) {
        state.setEnabledModelIds(prev => [...prev, newId]);
      }
      targetModelId = newId;
    }

    state.handleGenerateLink(targetModelId, customPromptText);
    setIsAddModelOpen(false);
  };

  const handleDeleteCustomModel = (modelId: string) => {
    if (state.enabledModelIds.length === 1 && state.enabledModelIds.includes(modelId)) {
      state.setEnabledModelIds((prev: string[]) => prev.filter(id => id !== modelId));
      return;
    }
    state.setCustomModels((state.customModels || []).filter((m: any) => m.id !== modelId));
    state.setEnabledModelIds((prev: string[]) => prev.filter(id => id !== modelId));
  };


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
    const sanitized = state.promptTitle.toLowerCase().replace(/[^a-z0-9_]/g, '');
    state.setPromptShortcut(sanitized);
  }, [state.promptTitle, state.setPromptShortcut]);

  const handleCreateNew = useCallback(async () => {
    setShowTooltip(false);
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
            await saveShortcut(itemId, compoundId, value.toLowerCase().replace(/[^a-z0-9_]/g, ''), record.title, 'aiPrompt');
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

  const conversationalModelsLinksContent = (
    <div className={`flex flex-col gap-3 h-full overflow-visible ${isNormalAiPromptMode ? 'border-x border-[var(--color-borderDefault)] px-3' : ''}`}>
      {/* Conversational Models Links - Clean List View */}
      <div className={`flex flex-col gap-2 ${hideRightPanel ? '' : 'mt-2'}`}>
        <div className="flex flex-col gap-1">
          {/* Model Rows */}
          <div className="flex flex-col divide-y divide-white/5 dark:divide-white/5">
            {ALL_MODELS.map((model) => {
              const isEnabled = state.enabledModelIds.includes(model.id);
              const isCustom = !MODELS.some(m => m.id === model.id);
              return (
                <div
                  key={model.id}
                  className="flex items-center justify-between gap-3 py-2 px-1 hover:bg-white/[0.02] transition-colors rounded-md"
                >
                  {/* Left: Checkbox + Favicon + Model Name (Fixed width for straight vertical alignment) */}
                  <div className="flex items-center gap-2.5 w-[120px] shrink-0 min-w-0">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => toggleModelExclusion(model.id)}
                      className="w-3.5 h-3.5 cursor-pointer rounded border-neutral-600 text-blue-600 focus:ring-blue-500 shrink-0"
                    />
                    <img
                      src={getFaviconUrl(model.host)}
                      alt={model.name}
                      className="w-4 h-4 object-contain shrink-0"
                    />
                    <span className="text-xs font-semibold text-neutral-200 dark:text-neutral-200 truncate">
                      {model.name}
                    </span>
                  </div>

                  {/* Right: URL Link Input (Truncated & Vertically Aligned) & Custom Delete */}
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <input
                      value={state.modelUrls[model.id] ?? `https://${model.host}`}
                      onChange={e => state.setModelUrl(model.id, e.target.value)}
                      title={state.modelUrls[model.id] ?? `https://${model.host}`}
                      className="w-full text-[10px] bg-black/20 dark:bg-white/5 border border-white/10 rounded-md px-2 py-1 outline-none text-neutral-300 dark:text-neutral-300 placeholder-neutral-500 font-mono truncate text-ellipsis overflow-hidden whitespace-nowrap"
                      placeholder="Enter URL..."
                    />
                    {isCustom && (
                      <button
                        onClick={() => handleDeleteCustomModel(model.id)}
                        className="text-red-400 hover:text-red-500 transition-colors p-1 shrink-0"
                        title="Delete custom model"
                      >
                        <FaTimes size={10} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {state.modelSelectionError && (
            <div className="px-1 py-1 text-[10px] font-medium text-[var(--color-danger)]">
              {state.modelSelectionError}
            </div>
          )}

          {/* Add Custom Model Button - Reduced width pill button */}
          <div className="flex justify-center pt-3">
            <button
              onClick={handleOpenAddModal}
              className="flex items-center justify-center gap-1.5 px-5 py-1.5 rounded-xl border border-white/10 bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200 text-xs font-medium shadow-sm transition-all cursor-pointer w-full max-w-[200px]"
              title="Add Custom Model"
            >
              <FaPlus size={10} />
              <span>Add Model</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const addModelDialog = (
    <div className={`fixed inset-0 ${isOverlay ? 'z-[999999]' : 'z-[100]'} flex items-center justify-center bg-black/40 backdrop-blur-sm`}>
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
  );

  return (
    <>
      <WorkspaceEditorLayout
        isNormalMode={isNormalAiPromptMode}
        title={state.activeAiPromptId ? 'Edit Chat Agent' : 'Create a Chat Agent'}
        titleClassName={isNormalAiPromptMode ? 'absolute left-1/2 top-1/2 w-full max-w-[740px] -translate-x-1/2 -translate-y-1/2 px-4 md:px-6 text-lg font-bold text-[var(--color-textPrimary)] truncate pointer-events-none' : undefined}
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
        embeddedFullBleed={hideRightPanel}
        isRightSiblingExpanded={hideRightPanel ? false : isRightPanelExpanded}
        rightSiblingPanel={hideRightPanel ? undefined : (
          <RightSideItemsPanel<any>
            items={filteredPrompts}
            activeItemId={state.activeAiPromptId}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search prompts..."
            getItemTitle={p => p.title || 'Untitled Prompt'}
            getItemPreview={p => p.prompt ? p.prompt.replace(/<[^>]+>/g, '').substring(0, 100) : ''}
            getItemIcon={p => {
              const enabledModels = getPromptModels(p);
              return <CircularModelStackIcon models={enabledModels} variant="compact" maxVisible={3} />;
            }}
            getItemCompoundId={p =>
              getItemCompoundId({
                id: p.id,
                workspace_id: p.workspaceId || null,
                folder_id: p.folderId || null,
                snippet: { id: p.id, category: 'aiPrompt' },
              })
            }
            getItemType={() => 'aiPrompt'}
            getItemWorkspaceId={p => p.workspaceId || null}
            getItemFolderId={p => p.folderId || null}
            getItemTagIds={p => p.tagIds || []}
            shortcutPrefix="a"
            shortcutsMap={shortcutsMap}
            hotkeysMap={hotkeysMap}
            workspaceNamesMap={workspaceNamesMap}
            folderNamesMap={folderNamesMap}
            tagNamesMap={tagNamesMap}
            onLoadItem={id => {
              const rec = aiPrompts.find(p => p.id === id);
              if (rec) state.loadPrompt(rec);
            }}
            onDeleteItem={async id => {
              try {
                const targetPrompt = aiPrompts.find(p => p.id === id);
                const compoundId = getItemCompoundId({
                  id,
                  workspace_id: targetPrompt?.workspaceId || state.workspaceId || null,
                  folder_id: targetPrompt?.folderId || state.folderId || null,
                  snippet: { id, category: 'aiPrompt' }
                });
                await clearShortcut(id, compoundId, 'aiPrompt');
                await deleteAiPrompt(id);
                if (id === state.activeAiPromptId || id === props.aiPromptId) {
                  state.loadPrompt(null);
                }
              } catch (err) {
                console.error('Delete failed:', err);
              }
            }}
            onUpdateShortcut={async (id, val) => {
              await handleUpdateItemField(id, 'shortcut', val);
            }}
            onUpdateTitle={async (id, val) => {
              await handleUpdateItemField(id, 'title', val);
            }}
            onUpdateTags={async (id, tagText) => {
              await handleUpdateItemField(id, 'tags', tagText);
            }}
            isFavorite={isFavorite}
            toggleFavorite={toggleFavorite}
            addFavorite={addFavorite}
            isExpanded={isRightPanelExpanded}
            onExpandChange={setIsRightPanelExpanded}
            searchInputRef={rightSideSearchInputRef}
            emptyStateMessage="No Chat Agents found"
          />
        )}
        deleteModalProps={{
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
                  workspace_id: targetPrompt?.workspaceId || state.workspaceId || null,
                  folder_id: targetPrompt?.folderId || state.folderId || null,
                  snippet: { id: promptToDeleteId, category: 'aiPrompt' }
                });
                await clearShortcut(promptToDeleteId, compoundId, 'aiPrompt');
                await deleteAiPrompt(promptToDeleteId);
                if (promptToDeleteId === state.activeAiPromptId || promptToDeleteId === props.aiPromptId) {
                  state.loadPrompt(null);
                }
              } catch (err) {
                console.error('Delete failed:', err);
              }
            }
            state.setIsDeleteDialogOpen(false);
            setPromptToDeleteId(null);
          },
          title: promptToDeleteId && aiPrompts.find(p => p.id === promptToDeleteId)?.title ? `Delete "${aiPrompts.find(p => p.id === promptToDeleteId)?.title}"?` : 'Delete this Chat Agent?',
          description: "Are you sure you want to delete this Chat Agent? This action cannot be undone."
        }}
        headerActions={
          <SharedPropertiesToolbar
            key={state.activeAiPromptId || 'new-prompt'}
            initialSnippet={initialProperties}
            compoundId={currentCompoundId}
            defaultName={state.promptTitle || 'New Prompt'}
            onChange={state.handlePropertiesChange}
            showShortcut={false}
            showTodo={true}
            onCreateTodo={async (deadlineVal, isRecurring, recurringCycle) => {
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
                const newTodo = await createTodo(
                  todoTitle,
                  [{ type: 'aiPrompt', id: promptId, name: todoTitle }],
                  isRecurring ? 'recurring' : 'one-time',
                  scheduleTime,
                  isRecurring ? recurringCycle as any : undefined,
                  state.promptBody || undefined
                );
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
              } catch (err) {
                console.error('[AiPromptEditorView:onCreateTodo] Failed to create aiPrompt todo', err);
              }
            }}
            saveStatus={state.saveStatus}
            entityType="aiPrompt"
            openPopupsToBottom={true}
            layout="horizontal"
            appearanceScope={appearanceScope}
            appearanceTokens={appearanceTokens}
            propertyPersistenceAdapter={propertyPersistenceAdapter}
          />
        }
        rightColumnContent={hideRightPanel ? undefined : conversationalModelsLinksContent}
      >
        <div ref={containerRef} className="flex-1 flex flex-col min-h-0 relative">
          <div className={`w-full flex-1 flex flex-col min-h-0 pt-0.5 pb-2 ${isNormalAiPromptMode ? 'max-w-[740px] mx-auto px-4 md:px-6' : 'px-3'} overflow-visible`}>
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
              shortcutPlaceholder="Command Shortcut"
              onTitleBlur={() => {
                if (!state.promptTitle.trim()) {
                  setTitleError('Enter the title');
                } else if (state.isDirty) {
                  state.handleSave();
                }
              }}
              onShortcutBlur={() => state.isDirty && state.handleSave()}
              onTitleEnter={async () => {
                if (!state.promptTitle.trim()) {
                  setTitleError('Enter the title');
                } else if (state.isDirty) {
                  await state.handleSave();
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
            <div className={`flex-shrink-0 min-w-0 relative mt-4 ${isNormalAiPromptMode ? 'flex flex-col h-auto overflow-visible' : hideRightPanel ? 'grid grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)] gap-4 h-full max-h-full overflow-y-auto custom-scrollbar pr-1' : 'flex flex-col h-full max-h-full overflow-hidden'}`}>
              {/* Prompt Text Editor */}
              <div className={`flex-shrink-0 flex flex-col gap-1.5 pb-2 text-sm font-medium ${isNormalAiPromptMode ? 'h-auto overflow-visible' : hideRightPanel ? 'min-h-[220px] relative' : 'flex-1 min-h-[140px] relative'}`}>
                <h4 className="text-xs font-semibold text-[var(--color-textSecondary)] px-3.5 flex items-center gap-1">
                  Prompt <span className="text-red-500">*</span>
                </h4>
                <div
                  className={`relative rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] shadow-sm px-0 py-0 overflow-hidden cursor-text`}
                  style={{ minHeight: '220px', maxHeight: 'clamp(280px, 35vh, 400px)' }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      const editorDom = e.currentTarget.querySelector('.ql-editor') as HTMLElement | null;
                      editorDom?.focus();
                    }
                  }}
                >
                  <TextEditor
                    key={state.activeAiPromptId || 'new'}
                    value={state.promptBody}
                    onChange={state.setPromptBody}
                    placeholder="Enter your prompt (Optional)"
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
                  className="absolute bottom-3 right-3 z-50 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm transition-all active:scale-95 border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] cursor-pointer select-none"
                >
                  <span>Create another</span>
                </button>
              )}
                </div>
              </div>
              {hideRightPanel && (
                <div className="w-full min-w-0 self-start">
                  {conversationalModelsLinksContent}
                </div>
              )}
            </div>
          </div>
        </div>
      </WorkspaceEditorLayout>

      {/* Hidden toolbar container for TextEditor */}
      <div id={toolbarIdRef.current} className="hidden" />

      {/* Add Custom Model Dialog Modal */}
      {isAddModelOpen && (isOverlay ? createPortal(addModelDialog, document.body) : addModelDialog)}

      {showTooltip && createPortal(
        <div
          style={{
            position: 'absolute',
            top: `${tooltipPos.top}px`,
            left: `${tooltipPos.left}px`,
          }}
          className="rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-popupBg)] px-3 py-2 shadow-2xl z-[999999] flex items-center gap-3 text-[12px] font-sans text-[var(--color-textPrimary)] pointer-events-none"
        >
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textPrimary)]">Ctrl</kbd>
            <span className="text-[10px] text-[var(--color-textSecondary)] font-bold">+</span>
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textPrimary)]">Shift</kbd>
            <span className="text-[10px] text-[var(--color-textSecondary)] font-bold">+</span>
            <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textPrimary)]">Enter</kbd>
          </div>
          <span className="text-[var(--color-textSecondary)] text-left whitespace-nowrap">to save and create another</span>
        </div>,
        document.body
      )}
    </>
  );
}
