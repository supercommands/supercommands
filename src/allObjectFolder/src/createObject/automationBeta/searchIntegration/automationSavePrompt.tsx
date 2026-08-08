import * as React from 'react';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAppearance } from '@extension/ui';
import { FaTimes, FaPlus, FaCheck, FaFolder, FaUsers, FaGlobe, FaLock, FaChevronDown } from 'react-icons/fa';
import { LuSave } from 'react-icons/lu';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { createAutomation } from '../automationData';
import { DestinationPicker } from '../../../../../shared-components/editorToolbar/DestinationPicker';
import useNotification from '../../../../../shared-components/notifications/useNotification';
import { getFaviconUrl, appendCmdStatus } from '../../../../../shared-components/searchBarMain/utilityFunctions/utils';

interface AutomationSavePromptProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAIs: string[];
  prompt: string;
  activeAiSession?: {
    id: string | number;
    sessionKey: string;
    prompt: string;
    name?: string;
    models: string[];
    tabIds: number[];
    urls: string[];
    workspace_id?: string | null;
    folder_id?: string | null;
  } | null;
  onSaveSuccess?: (name: string, id: string | number) => void;
}

const DEFAULT_ALL_AI_URLS: Record<string, string> = {
  gemini: 'https://gemini.google.com/app',
  gpt: 'https://chatgpt.com',
  claude: 'https://claude.ai/new',
  perplexity: 'https://www.perplexity.ai',
};

const AutomationSavePrompt: React.FC<AutomationSavePromptProps> = ({
  isOpen,
  onClose,
  selectedAIs,
  prompt,
  activeAiSession,
  onSaveSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);

  const triggerNotification = useNotification();
  const selectedWorkspaceId = useUIStore((s: any) => s.selectedWorkspaceId);
  const selectedFolderId = useUIStore((s: any) => s.selectedFolderId);
  const snippetBreadcrumb = useUIStore((s: any) => s.snippetBreadcrumb);
  const selectedTeam = useUIStore((s: any) => s.selectedTeam);
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const { theme } = useAppearance();
  const isDark = theme.isDark;

  // Manual location overrides (matching LinkEditModal)
  const [manualWorkspaceId, setManualWorkspaceId] = useState<string | null>(null);
  const [manualFolderId, setManualFolderId] = useState<string | null>(null);
  const isManualOverride = manualWorkspaceId !== null;

  const targetWorkspaceId = isManualOverride
    ? manualWorkspaceId
    : snippetBreadcrumb?.workspace_id || selectedWorkspaceId || '';

  const targetFolderId = isManualOverride
    ? manualFolderId
    : snippetBreadcrumb?.folder_id || selectedFolderId || '';

  const hasDestination = Boolean(targetWorkspaceId);

  const getWorkspaceById = useDbStore(state => state.getWorkspaceById);
  const getFolderById = useDbStore(state => state.getFolderById);
  const workspaces = useDbStore(state => state.workspaces);

  const displayWorkspace = getWorkspaceById(targetWorkspaceId);
  const displayFolder = getFolderById(targetFolderId);

  // Resolve the display name and details for the destination button
  const destinationDetails = useMemo(() => {
    let pathText = 'Select Destination';
    if (displayWorkspace) {
      pathText = displayFolder ? `${displayWorkspace.workspaceName} / ${displayFolder.folderName}` : displayWorkspace.workspaceName;
    }
    return { pathText };
  }, [displayWorkspace, displayFolder]);

  const handleSave = useCallback(async () => {
    if (isSavingRef.current) return;
    if (!title.trim()) {
      triggerNotification('Please enter a name for your agent', 'error');
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    try {
      // 1. Map all captured/selected models to their URLs with selection status
      const customModels = (activeAiSession as any)?.customModelDefinitions || [];

      const allAiUrls: Record<string, string> = {};
      const allModelIds = Array.from(new Set([...(activeAiSession?.models || []), ...selectedAIs]));

      allModelIds.forEach(id => {
        const isSelected = selectedAIs.includes(id);
        const sessionIdx = activeAiSession?.models?.indexOf(id);
        let baseUrl = '';

        if (sessionIdx !== undefined && sessionIdx !== -1 && activeAiSession?.urls?.[sessionIdx]) {
          baseUrl = activeAiSession.urls[sessionIdx];
        } else if (DEFAULT_ALL_AI_URLS[id]) {
          baseUrl = DEFAULT_ALL_AI_URLS[id];
        } else {
          // Fallback to locally defined custom models
          const custom = customModels.find((m: any) => m.id === id);
          if (custom) baseUrl = custom.url;
        }

        if (baseUrl) {
          // Filter: only save models that are currently selected to keep agent config clean
          if (isSelected) {
            allAiUrls[id] = appendCmdStatus(baseUrl, isSelected);
          }
        }
      });

      // 2. Construct Step
      const ALL_AI_STEP = {
        module_id: '5', // Numeric ID for All AI from Catalog
        step_order: 1,
        config: {
          module_key: 'all_ai',
          isCloudModule: true,
          agentId: 'all_ai',
          name: 'All AI Chat Agents',
          iconHost: 'chatgpt.com',
          allAiUrls: allAiUrls,
          // Spread individual model URLs into the config for compatibility
          ...allAiUrls,
          prompt: activeAiSession?.prompt || prompt, // Use activeAiSession.prompt first (always correct), fallback to prop
          consolidatedAllAi: true,
          isAllAi: true,
        },
      };

      // 3. Call DB layer directly (local-first)
      const result = await createAutomation({
        name: title.trim(),
        workspaceId: targetWorkspaceId || undefined,
        folderId: targetFolderId || null,
        steps: [ALL_AI_STEP as any],
        tagIds: [],
        inputs: [],
      });

      const savedId = result.id;

      // 4. Dexie DB syncing is handled by data methods or API

      triggerNotification('Agent saved successfully!', 'success');
      useUIStore.getState().clearDraftAutomation();
      onSaveSuccess?.(title.trim(), savedId);
      onClose();
    } catch (error: any) {
      console.error('[AutomationSavePrompt] Failed to save agent:', error);
      triggerNotification(error?.message || 'Failed to save agent', 'error');
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [
    title,
    targetWorkspaceId,
    targetFolderId,
    activeAiSession,
    selectedAIs,
    prompt,
    onSaveSuccess,
    onClose,
    triggerNotification,
  ]);

  // Set title ONLY when the modal first opens (not on workspace/prompt changes)
  const hasInitializedTitle = useRef(false);
  useEffect(() => {
    if (isOpen) {
      if (!hasInitializedTitle.current) {
        const resolvedPrompt = activeAiSession?.prompt || prompt;
        const defaultTitle = resolvedPrompt
          ? resolvedPrompt.length > 50
            ? resolvedPrompt.slice(0, 47) + '...'
            : resolvedPrompt
          : '';
        setTitle(defaultTitle);
        hasInitializedTitle.current = true;
      }

      // Reset manual overrides when reopening
      setManualWorkspaceId(null);
      setManualFolderId(null);

      // Auto-select default destination if none is present
      if (!targetWorkspaceId) {
        const initDestination = async () => {
          const result = await chrome.storage.local.get('lastNoteDestination');
          const lastDest = result.lastNoteDestination;

          if (lastDest) {
            const workspace = useDbStore.getState().getWorkspaceById(lastDest.workspace_id);
            if (workspace) {
              const folder = useDbStore.getState().getFolderById(lastDest.folder_id);
              
              useUIStore.getState().setSelectedWorkspaceId(workspace.id);
              useUIStore.getState().setSelectedFolderId(folder?.id || null);
              useUIStore.getState().setSnippetBreadcrumb({
                workspace_id: workspace.id,
                workspace_name: workspace.workspaceName,
                folder_id: folder?.id || null,
                folder_name: folder?.folderName || null,
              });
              return;
            }
          }

          // Fallback: Select first workspace
          const workspaces = useDbStore.getState().workspaces;
          if (workspaces && workspaces.length > 0) {
            const defaultWorkspace = workspaces[0];
            useUIStore.getState().setSelectedWorkspaceId(defaultWorkspace.id);
            useUIStore.getState().setSelectedFolderId(null);
            useUIStore.getState().setSnippetBreadcrumb({
              workspace_id: defaultWorkspace.id,
              workspace_name: defaultWorkspace.workspaceName,
              folder_id: null,
              folder_name: null,
            });
          }
        };
        initDestination();
      }
    } else {
      // Reset the init flag when modal closes so it re-initializes next time
      hasInitializedTitle.current = false;
    }
  }, [isOpen, targetWorkspaceId]);

  const handleWorkspaceDestination = useCallback((workspaceId: string) => {
    setManualWorkspaceId(workspaceId);
    setManualFolderId(null);
    setIsLocationPickerOpen(false);
  }, []);

  const handleFolderDestination = useCallback((workspaceId: string, folderId: string) => {
    setManualWorkspaceId(workspaceId);
    setManualFolderId(folderId);
    setIsLocationPickerOpen(false);
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return;

      // Save Shortcut: Cmd+Enter (Mac) or Ctrl+Enter (Win)
      const isSaveShortcut = (isMac ? event.metaKey : event.ctrlKey) && event.key === 'Enter';

      if (isSaveShortcut) {
        event.preventDefault();
        if (isSaving) return;
        handleSave();
      }
      // Location Picker Shortcut: Alt+Enter
      else if (event.altKey && event.key === 'Enter') {
        event.preventDefault();
        if (isSaving) return;
        setIsLocationPickerOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isMac, isSaving, isLocationPickerOpen, handleSave, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      onClose();
      return true;
    });
    return unregister;
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300 ${
        isDark ? 'bg-black/80' : 'bg-[#073642]/25'
      }`}>
      <div
        className={`w-full max-w-md rounded-2xl animate-in zoom-in-95 duration-200 ${
          isDark
            ? 'bg-black border border-white/10 shadow-[0_0_50px_-12px_rgba(255,255,255,0.1)]'
            : 'bg-[#fdf6e3] border border-[#d8d2bf] shadow-[0_0_50px_-12px_rgba(7,54,66,0.25)]'
        }`}>
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isDark ? 'border-white/10 bg-white/[0.02]' : 'border-[#d8d2bf] bg-[#eee8d5]/40'
          }`}>
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shadow-inner ${
                isDark ? 'bg-white/5 text-white/70' : 'bg-[#eee8d5] text-[#586e75]'
              }`}>
              <LuSave size={18} />
            </div>
            <h2 className="text-lg font-bold tracking-tight text-[var(--color-textPrimary)]">
              Save Agent
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-all active:scale-90 ${
              isDark
                ? 'hover:bg-white/10 text-white/40 hover:text-white'
                : 'hover:bg-[#eee8d5] text-[#93a1a1] hover:text-[#073642]'
            }`}>
            <FaTimes size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Agent Name */}
          <div className="space-y-2">
            <label
              className={`text-[11px] font-bold tracking-[0.2em] ml-1 ${
                isDark ? 'text-white/30' : 'text-[#586e75]'
              }`}>
              Agent Name
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. My Multi-Model Researcher"
              autoFocus
              className={`w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all shadow-inner placeholder-[var(--color-textPlaceholder)] ${
                isDark
                  ? 'bg-black border border-white/10 text-white focus:ring-white/10 focus:border-white/20'
                  : 'bg-[#fdf6e3] border border-[#d8d2bf] text-[#073642] focus:ring-[#93a1a1]/30 focus:border-[#93a1a1]'
              }`}
            />
          </div>

          {/* Location Picker */}
          <div className="space-y-2 relative">
            <label
              className={`text-[11px] font-bold tracking-[0.2em] ml-1 ${
                isDark ? 'text-white/30' : 'text-[#586e75]'
              }`}>
              Save Destination
            </label>
            <button
              onClick={() => setIsLocationPickerOpen(!isLocationPickerOpen)}
              className={`w-full h-11 flex items-center justify-between rounded-xl px-4 text-sm transition-all text-left shadow-inner group ${
                isDark
                  ? 'bg-black border border-white/10 text-white hover:bg-white/[0.02]'
                  : 'bg-[#fdf6e3] border border-[#d8d2bf] text-[#073642] hover:bg-[#eee8d5]/60'
              }`}>
              <div className="flex items-center gap-2 truncate">
                {hasDestination ? (
                  <span className="truncate text-sm font-medium transition-colors text-white/80 group-hover:text-white">
                    {destinationDetails.pathText}
                  </span>
                ) : (
                  <span className={`truncate font-medium transition-colors ${
                    isDark ? 'text-white/80 group-hover:text-white' : 'text-[#586e75] group-hover:text-[#073642]'
                  }`}>
                    Select Destination
                  </span>
                )}
                <span
                  className={`flex items-center gap-1 text-[9px] font-semibold ${
                    isDark ? 'text-neutral-300' : 'text-[#586e75]'
                  }`}>
                  <span
                    className={`rounded-md border px-1 py-0 ${
                      isDark ? 'border-white/20 bg-neutral-700' : 'border-[#d8d2bf] bg-[#fdf6e3]'
                    }`}>
                    {isMac ? '⌥' : 'Alt'}
                  </span>
                  <span className={isDark ? 'text-neutral-300' : 'text-[#586e75]'}>+</span>
                  <span
                    className={`rounded-md border px-1 py-0 ${
                      isDark ? 'border-white/20 bg-neutral-700' : 'border-[#d8d2bf] bg-[#fdf6e3]'
                    }`}>
                    Enter
                  </span>
                </span>
              </div>
            </button>

            {isLocationPickerOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 z-[120] animate-in slide-in-from-bottom-2 duration-300">
                <DestinationPicker
                  selectedWorkspaceId={targetWorkspaceId || null}
                  selectedFolderId={targetFolderId || null}
                  onSelectWorkspace={handleWorkspaceDestination}
                  onSelectFolder={handleFolderDestination}
                  onClose={() => setIsLocationPickerOpen(false)}
                  className={`w-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] ${
                    isDark ? 'border border-white/20 !bg-black' : 'border border-[#d8d2bf] !bg-[#fdf6e3]'
                  }`}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className={`px-6 py-4 border-t flex items-center justify-end gap-3 ${
            isDark ? 'bg-white/[0.02] border-white/5' : 'bg-[#eee8d5]/40 border-[#d8d2bf]'
          }`}>
          <button
            onClick={onClose}
            className={`px-5 py-2 rounded-md text-sm font-semibold transition-all ${
              isDark
                ? 'text-white/40 hover:text-white hover:bg-white/5'
                : 'text-[#586e75] hover:text-[#073642] hover:bg-[#eee8d5]'
            }`}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !title.trim()}
            className={`flex items-center gap-2 rounded-md border px-5 py-2 text-sm font-semibold transition-all active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
              isDark
                ? 'border-white/20 bg-white/10 text-white/90 hover:bg-white/20 hover:text-white'
                : 'border-[#d8d2bf] bg-[#eee8d5] text-[#073642] hover:bg-[#e7e0cc]'
            }`}>
            {isSaving ? (
              <div
                className={`w-4 h-4 border-2 rounded-full animate-spin ${
                  isDark ? 'border-white/30 border-t-white' : 'border-[#93a1a1] border-t-[#073642]'
                }`}
              />
            ) : (
              <div className="flex items-center gap-2">
                <FaCheck size={14} className={isDark ? 'text-white/80' : 'text-[#073642]'} />
                <span>Save Agent</span>
                <span
                  className={`ml-1 text-[10px] font-mono leading-none flex items-center gap-1 border rounded px-1 py-0.5 ${
                    isDark
                      ? 'opacity-40 border-white/20 bg-neutral-700'
                      : 'opacity-80 border-[#d8d2bf] bg-[#fdf6e3] text-[#586e75]'
                  }`}>
                  {isMac ? '⌘' : 'Ctrl'} + Enter
                </span>
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AutomationSavePrompt;


