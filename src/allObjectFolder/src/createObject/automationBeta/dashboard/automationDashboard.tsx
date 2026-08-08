
import * as React from 'react';
import {
  FaTimes,
  FaRobot,
  FaPlus,
  FaGlobe,
  FaUsers,
  FaLock,
  FaHistory,
  FaPlay,
  FaKeyboard,
  FaExclamationTriangle,
  FaSearch,
  FaCloud,
  FaCheck,
  FaFolder,
} from 'react-icons/fa';
import { CiWarning } from 'react-icons/ci';
import AutomationStepPicker from '../steps/automationStepPicker';
import AutomationHistoryPrompt from '../utilities/automationHistoryPrompt';
import AutomationStepList from '../steps/automationStepList';
import { extractFrequentValues } from '../utilities/historyExtractor';
import ReactDOM from 'react-dom';
import { useState,useEffect,useRef,useCallback,useMemo} from 'react';

import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { DestinationPicker } from '../../../../../shared-components/editorToolbar/DestinationPicker';
import type { WorkspaceData } from '../../../../../settings/allWorkspaceManager/workspaces/workspaceTypes';
import type { FolderData } from '../../../../../settings/allWorkspaceManager/folders/folderTypes';
type Workspace = WorkspaceData & { folders?: Folder[] };
type Folder = FolderData & { snippets?: any[] };
import { runAutomation, type AutomationStep } from '../utilities/automation';
import {
  getUserId,
} from '../../../../../storage/API/core/api';
import { createAutomation, updateAutomation } from '../automationData';
import { HotkeyAssignButton } from '../../../../../shared-components/hotkeys';
import { ShortcutAssignButton } from '../../../../../shared-components/shortcuts';;
import { saveHotkey as apiSaveHotkey } from '../../../../../shared-components/hotkeys';
import { saveShortcut as apiSaveShortcut } from '../../../../../shared-components/shortcuts';
import { normalizeShortcutTrigger } from '../../../../../shared-components/shortcuts/core/shortcutDbData';
import { readAllHotkeys, readAllShortcuts, getItemCompoundId } from '../../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { useShortcutValidation } from '../../../../../shared-components/shortcuts';
import { useFavorites } from '../../../../../shared-components/favorites/favoriteHooks';

// New Imports
import type { AgentPanelProps, CloudModule } from '../utilities/automationTypes';
import { MODULES, STORAGE_KEY } from '../utilities/automationConstants';
import { getFaviconUrl, isStepConfiguredForSave, convertLegacyParams } from '../utilities/automationUtils';
import AutomationStepConfig from '../steps/automationStepConfig';
import AutomationActionMenu from '../utilities/automationActionMenu';
// StepsSidebar removed — step navigation is handled by AgentStepTable + ModuleSpeaker

const AutomationDashboard: React.FC<AgentPanelProps> = ({
  isOpen,
  onClose,
  editMode,
  automation,
  reload,
  onPickerToggle,
  onSpeakerPropsChange,
}) => {

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const draftAutomation = useUIStore((s: any) => s.draftAutomation);
  const selectedTeam = useUIStore((s: any) => s.selectedTeam);
  const selectedWorkspaceId = useUIStore((s: any) => s.selectedWorkspaceId);
  const selectedFolderId = useUIStore((s: any) => s.selectedFolderId);
  const { validateShortcut } = useShortcutValidation();
  const { toggleFavorite } = useFavorites();

  const [steps, setSteps] = useState<AutomationStep[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | number | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | number | null>(null);
  const [editingStepRect, setEditingStepRect] = useState<DOMRect | null>(null);
  const [insertDropdownIndex, setInsertDropdownIndex] = useState<{ parentId?: string; index: number } | null>(null);
  const [isAgentGridOpen, setIsAgentGridOpen] = useState(false);
  // State for token-level value editing (Open Link step → Enter on token)
  const [tokenEditState, setTokenEditState] = useState<{ stepId: string | number; tokenName: string } | null>(null);

  const [editingStepNameId, setEditingStepNameId] = useState<string | number | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const hotkeyButtonRef = useRef<HTMLButtonElement>(null);
  const shortcutBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const stepNameInputRef = useRef<HTMLInputElement>(null);
  const [installedModules, setInstalledModules] = useState<CloudModule[]>([]);
  const [moduleCatalog, setModuleCatalog] = useState<CloudModule[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [title, setTitle] = useState('');

  const [urlHistorySuggestions, setUrlHistorySuggestions] = useState<
    Array<{ title: string; url: string; source: 'history' | 'bookmark' }>
  >([]);
  const lastUrlHistoryQueryRef = useRef('');
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(-1);

  const [pendingHotkey, setPendingHotkey] = useState<string>('');
  const [pendingShortcut, setPendingShortcut] = useState<string>('');
  const [isFav, setIsFav] = useState(false);
  const [userId, setUserId] = useState<string>('');

  // Loading States
  const [isFavLoading, setIsFavLoading] = useState(false);
  const [isHotkeySyncing, setIsHotkeySyncing] = useState(false);
  const [isShortcutSyncing, setIsShortcutSyncing] = useState(false);

  // History modal state for "Select from options" flow.
  const [historyModalState, setHistoryModalState] = useState<{
    isOpen: boolean;
    stepId: string | number;
    paramName: string;
    suggestions: { value: string; title: string }[];
  }>({
    isOpen: false,
    stepId: '',
    paramName: '',
    suggestions: [],
  });
  const [inlineHistorySuggestions, setInlineHistorySuggestions] = useState<
    Record<string, { value: string; title: string }[]>
  >({});
  const [inlineFetchingStatus, setInlineFetchingStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getUserId().then(setUserId).catch(console.error);
  }, []);

  // Load existing hotkeys and shortcut on open using standardized utilities
  useEffect(() => {
    const syncData = async () => {
      if (isOpen && automation?.id) {
        try {
          const [hotkeysMap, shortcutsMap] = await Promise.all([readAllHotkeys(), readAllShortcuts()]);
          const compoundId = getItemCompoundId({
            ...automation,
            workspace_id: (automation as any).workspace_id || selectedWorkspaceId,
            folder_id: (automation as any).folder_id || selectedFolderId,
            category: 'automation',
          });

          const currentHotkey = hotkeysMap[compoundId] || '';
          const currentShortcut = shortcutsMap[compoundId] || '';

          setPendingHotkey(currentHotkey);
          setPendingShortcut(normalizeShortcutTrigger(currentShortcut));
        } catch (error) {
          console.error('[AgentPanel] Error loading hotkeys/shortcuts:', error);
        }
      } else if (!isOpen) {
        setPendingHotkey('');
        setPendingShortcut('');
      }
    };
    syncData();
  }, [isOpen, automation?.id, automation]);

  // Favorite Sync
  useEffect(() => {
    const fetchUserId = async () => {
      const id = await getUserId();
      setUserId(id);
    };
    fetchUserId();
  }, []);

  useEffect(() => {
    if (!isOpen || !automation?.id || !userId) {
      setIsFav(false);
      return;
    }
    chrome.storage.local.get('myFavouriteItems', result => {
      const favItems = result.myFavouriteItems || {};
      const currentFavList: any[] = favItems[userId] || [];
      setIsFav(currentFavList.some(item => String(item.id) === String(automation.id)));
    });
  }, [isOpen, automation?.id, userId]);

  const handleHotkeyChange = async (newHotkey: string) => {
    if (!automation?.id || !userId) {
      setPendingHotkey(newHotkey);
      return;
    }
    setIsHotkeySyncing(true);
    setPendingHotkey(newHotkey);
    try {
      // Local Registry Parity
      const compoundId = getItemCompoundId({
        ...automation,
        folder_id: (automation as any).folder_id || selectedFolderId,
        workspace_id: (automation as any).workspace_id || selectedWorkspaceId,
        category: 'automation',
      });
      await apiSaveHotkey(automation.id.toString(), compoundId, newHotkey, 'automation', selectedTeam?.storageMode || 'local', true);

      // 3. specialized Automation Hotkeys Map (for background/search parity)
      const res = await chrome.storage.local.get('alts_automation_hotkeys');
      const ex = (res.alts_automation_hotkeys as Record<string, string>) || {};
      if (newHotkey) ex[automation.id.toString()] = newHotkey;
      else delete ex[automation.id.toString()];
      await chrome.storage.local.set({ alts_automation_hotkeys: ex });
    } catch (err) {
      console.error('[AgentPanel] Hotkey Sync Failed:', err);
    } finally {
      setIsHotkeySyncing(false);
    }
  };

  const handleShortcutChange = async (newShortcut: string) => {
    const normalizedShortcut = normalizeShortcutTrigger(newShortcut);
    if (!automation?.id || !userId) {
      setPendingShortcut(normalizedShortcut);
      return;
    }
    setIsShortcutSyncing(true);
    setPendingShortcut(normalizedShortcut);
    try {
      // Local Registry Parity
      const compoundId = getItemCompoundId({
        ...automation,
        folder_id: (automation as any).folder_id || selectedFolderId,
        workspace_id: (automation as any).workspace_id || selectedWorkspaceId,
        category: 'automation',
      });

      await apiSaveShortcut(
        automation.id.toString(),
        compoundId,
        normalizedShortcut,
        automation.name || 'Automation',
        'automation',
        selectedTeam?.storageMode || 'local',
        true
      );

      // 3. specialized Automation Shortcuts Map (for background/search parity)
      const res = await chrome.storage.local.get('alts_automation_shortcuts');
      const ex = (res.alts_automation_shortcuts as Record<string, string>) || {};
      if (normalizedShortcut) ex[automation.id.toString()] = normalizedShortcut;
      else delete ex[automation.id.toString()];
      await chrome.storage.local.set({ alts_automation_shortcuts: ex });
    } catch (err) {
      console.error('[AgentPanel] Shortcut Sync Failed:', err);
    } finally {
      setIsShortcutSyncing(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!userId) return;
    if (!automation?.id) {
      setIsFav(!isFav);
      return;
    }
    setIsFavLoading(true);
    try {
      const isAlreadyFav = isFav;

      // Local Storage Parity
      await toggleFavorite(automation.id.toString(), 'automation', automation.name);
      
      setIsFav(!isAlreadyFav);
    } catch (err) {
      console.error('[AgentPanel] Toggle Favorite Failed:', err);
    } finally {
      setIsFavLoading(false);
    }
  };

  const updateStepConfig = (id: string | number, newConfig: any) => {
    setSteps(prev =>
      prev.map(s => {
        if (s.id === id) {
          const rootProps = ['status', 'name', 'moduleId', 'subSteps'];
          const updates: any = {};
          const configUpdates: any = {};
          Object.keys(newConfig).forEach(key => {
            if (rootProps.includes(key)) updates[key] = newConfig[key];
            else configUpdates[key] = newConfig[key];
          });
          return { ...s, ...updates, config: { ...s.config, ...configUpdates } };
        }
        if (s.subSteps) {
          const updatedSubs = s.subSteps.map(sub => {
            if (sub.id === id) {
              const rootProps = ['status', 'name', 'moduleId'];
              const updates: any = {};
              const configUpdates: any = {};
              Object.keys(newConfig).forEach(key => {
                if (rootProps.includes(key)) updates[key] = newConfig[key];
                else configUpdates[key] = newConfig[key];
              });
              return { ...sub, ...updates, config: { ...sub.config, ...configUpdates } };
            }
            return sub;
          });
          if (updatedSubs.some((sub, i) => sub !== s.subSteps![i])) {
            return { ...s, subSteps: updatedSubs };
          }
        }
        return s;
      }),
    );
  };

  const handleOpenHistorySuggestions = async (stepId: string | number, url: string, paramName: string) => {
    if (paramName === 'url') return;
    const lookupKey = String(paramName);
    setInlineFetchingStatus(prev => ({ ...prev, [lookupKey]: true }));
    try {
      let frequentValues: { value: string; title: string }[] = [];
      if (url && url.trim() !== '') {
        const domain = new URL(url.replace(/\{[^}]+\}/g, 'TEMP')).hostname;
        const historyItems = await new Promise<any[]>(resolve => {
          if (!chrome?.runtime?.sendMessage) return resolve([]);
          chrome.runtime.sendMessage(
            {
              action: 'search_history',
              query: domain,
              maxResults: 1000,
              startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
            },
            resolve,
          );
        });
        frequentValues = extractFrequentValues(url, historyItems, paramName);
      }
      setInlineHistorySuggestions(prev => ({ ...prev, [lookupKey]: frequentValues }));
    } catch (err) {
      console.error(err);
      setInlineHistorySuggestions(prev => ({ ...prev, [lookupKey]: [] }));
    } finally {
      setInlineFetchingStatus(prev => ({ ...prev, [lookupKey]: false }));
    }
  };

  const getAvailableVariables = (currentStepId: string | number) => {
    const currentIndex = steps.findIndex(s => s.id === currentStepId);
    if (currentIndex <= 0) return [];
    const vars: { name: string; source: string; fixedValue?: string; dropdownOptions?: string }[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < currentIndex; i++) {
      const s = steps[i];
      if (s.moduleId === 'agent' && s.config.promptLabel) {
        if (!seen.has(s.config.promptLabel)) {
          seen.add(s.config.promptLabel);
          vars.push({
            name: s.config.promptLabel,
            source: s.config.name || 'Agent',
            fixedValue: s.config.fixedValue,
            dropdownOptions: s.config.dropdownOptions,
          });
        }
      }
      if (s.moduleId === 'open_tab' && s.config.url) {
        const paramRegex = /\{input_name="([^"]+)"\}|\{([^}\s"=)]+)\}/g;
        let pm;
        while ((pm = paramRegex.exec(s.config.url as string)) !== null) {
          const name = pm[1] || pm[2];
          if (!seen.has(name)) {
            seen.add(name);
            const pc = s.config.paramConfigs?.[name];
            vars.push({
              name,
              source: 'Open Tab',
              fixedValue: pc ? (pc.type !== 'dropdown' ? pc.values[0] : undefined) : s.config.fixedValue,
              dropdownOptions: pc
                ? pc.type === 'dropdown'
                  ? pc.values.join(',')
                  : undefined
                : s.config.dropdownOptions,
            });
          }
        }
      }
      if (s.moduleId === 'paste' && s.config.content) {
        const matches = Array.from((s.config.content as string).matchAll(/\{([^}\s)]+)\}/g));
        for (const m of matches) {
          if (!seen.has(m[1])) {
            seen.add(m[1]);
            vars.push({ name: m[1], source: 'Paste' });
          }
        }
      }
    }
    return vars;
  };

  const [openOptionsStepId, setOpenOptionsStepId] = useState<string | null>(null);

  const renderStepEditor = () => {
    if (!editingStepId) return null;
    let step: AutomationStep | undefined;
    let stepNumber = '';
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (s.id === editingStepId) {
        step = s;
        stepNumber = String(i + 1);
        break;
      }
      if (s.subSteps) {
        const subIdx = s.subSteps.findIndex(sub => sub.id === editingStepId);
        if (subIdx !== -1) {
          step = s.subSteps[subIdx];
          stepNumber = `${i + 1}.${subIdx + 1}`;
          break;
        }
      }
    }
    if (!step) return null;
    const module = MODULES.find(m => m.id === step!.moduleId) || { name: 'Auto' };

    return (
      <div className="flex flex-col h-full bg-[var(--color-editorBg)]">
        {['agent', 'open_tab', 'click', 'paste', 'clipboard_paste', 'wait'].includes(step!.moduleId) ? (
          <AutomationStepPicker
            key={editingStepId}
            initialPrompts={
              step!.moduleId === 'agent'
                ? [
                    {
                      key: step!.config.promptLabel || 'prompt1',
                      values: step!.config.dropdownOptions
                        ? step!.config.dropdownOptions.split(',')
                        : [step!.config.fixedValue || ''],
                    },
                  ]
                : undefined
            }
            initialUrl={step!.moduleId === 'open_tab' ? step!.config.url : undefined}
            initialParamConfigs={step!.config.paramConfigs}
            initialConfig={['click', 'paste'].includes(step!.moduleId) ? step!.config : undefined}
            moduleId={step!.moduleId}
            stepId={String(step!.id)}
            availableParams={getAvailableVariables(step!.id)}
            onOpenHistorySuggestions={paramName =>
              handleOpenHistorySuggestions(step!.id, step!.config.url || '', paramName)
            }
            onClose={() => {
              setEditingStepId(null);
              setSelectedStepId(prev => prev);
            }}
            onSave={prompts => {
              if (prompts?.[0])
                updateStepConfig(step!.id, {
                  promptLabel: prompts[0].key,
                  fixedValue: prompts[0].values.length === 1 ? prompts[0].values[0] : '',
                  dropdownOptions: prompts[0].values.length > 1 ? prompts[0].values.join(',') : '',
                });
            }}
            onUrlSave={(url, paramConfigs) => updateStepConfig(step!.id, { url, paramConfigs })}
            onConfigSave={newConfig => updateStepConfig(step!.id, newConfig)}
            stepNumber={stepNumber}
            stepName={getStepLabel(step!)}
            className={`w-full ${step!.moduleId === 'wait' ? 'h-auto' : 'h-full'}`}
            isEmbedded={true}
            historySuggestions={inlineHistorySuggestions}
            isFetchingHistory={inlineFetchingStatus}
          />
        ) : (
          <div className="flex-1 flex flex-col min-h-0 bg-[var(--color-editorBg)]">
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[var(--color-editorBg)]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  {(module as any).icon ? (
                    React.createElement((module as any).icon, { size: 16 })
                  ) : (
                    <FaRobot size={16} />
                  )}
                </div>
                <h3 className="text-sm font-bold text-[var(--color-textPrimary)]">
                  Step {stepNumber}: {module.name}
                </h3>
              </div>
              <button
                onClick={() => {
                  setEditingStepId(null);
                  setSelectedStepId(prev => prev);
                }}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-white/5 rounded-lg text-neutral-400 transition-colors">
                <FaTimes size={14} />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto bg-[var(--color-editorBg)]">
              <AutomationStepConfig
                step={step}
                stepNum={stepNumber}
                steps={steps}
                installedModules={installedModules}
                updateStepConfig={updateStepConfig}
                getAvailableVariables={getAvailableVariables}
                handleOpenHistorySuggestions={handleOpenHistorySuggestions}
                openOptionsStepId={openOptionsStepId}
                setOpenOptionsStepId={setOpenOptionsStepId}
                inlineHistorySuggestions={inlineHistorySuggestions}
                inlineFetchingStatus={inlineFetchingStatus}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const getStepLabel = (s: AutomationStep) => {
    const module = MODULES.find(m => m.id === s.moduleId);
    if (!module) {
      const cloud = installedModules.find(
        m => m.module_key === s.moduleId || String(m.module_id) === String(s.moduleId),
      );
      return cloud?.name || s.config.name || 'Action';
    }
    return module.name;
  };

  const fetchModules = useCallback(async () => {
    try {
      const result = await chrome.storage.local.get(['installed_modules']);
      if (result.installed_modules) setInstalledModules(result.installed_modules);

      const catalog: any[] = [];
      if (Array.isArray(catalog)) {
        setModuleCatalog(catalog);
      }
    } catch (err) {
      console.error('[AgentPanel] Module fetch error:', err);
    }
  }, []);

  const handleInstallCloudModule = useCallback(
    async (moduleId: string) => {
      try {

        await fetchModules();
      } catch (err) {
        console.error(err);
      }
    },
    [fetchModules],
  );

  useEffect(() => {
    fetchModules();
    const listener = (changes: any) => {
      if (changes.installed_modules) {
        setInstalledModules(changes.installed_modules.newValue || []);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [fetchModules]);

  useEffect(() => {
    if (!isOpen) return;
    const selectedTopLevelIndex = selectedStepId !== null ? steps.findIndex(step => step.id === selectedStepId) : -1;
    const activeInsertPoint = insertDropdownIndex || {
      index: selectedTopLevelIndex >= 0 ? selectedTopLevelIndex + 1 : steps.length,
    };
    onSpeakerPropsChange?.({
      insertPoint: activeInsertPoint,
      onClose: () => setInsertDropdownIndex(null),
      onRequestStepTableFocus: (target: 'select' | 'last_menu' = 'select') =>
        window.dispatchEvent(new CustomEvent('agent-step-table-focus', { detail: { target } })),
      steps,
      setSteps,
      setSelectedStepId,
      installedModules,
      moduleCatalog,
      refreshCommands: fetchModules,
      installModule: handleInstallCloudModule,
    });
  }, [
    isOpen,
    insertDropdownIndex,
    selectedStepId,
    steps,
    installedModules,
    moduleCatalog,
    onSpeakerPropsChange,
    fetchModules,
    handleInstallCloudModule,
  ]);

  useEffect(() => {
    if (chrome?.storage?.local) chrome.storage.local.set({ automation_draft_steps_count: steps.length });
  }, [steps]);

  const stepsRef = useRef(steps);
  const titleRef = useRef(title);
  const editModeRef = useRef(editMode);
  const skipDraftPersistRef = useRef(false);
  const hasSavedRef = useRef(false);

  useEffect(() => {
    stepsRef.current = steps;
  }, [steps]);
  useEffect(() => {
    titleRef.current = title;
  }, [title]);
  useEffect(() => {
    editModeRef.current = editMode;
    if (editMode) skipDraftPersistRef.current = true;
  }, [editMode]);

  useEffect(() => {
    if (isOpen) {
      hasSavedRef.current = false;
    } else {
      return;
    }
    return () => {
      if (!skipDraftPersistRef.current && !editModeRef.current && stepsRef.current.length > 0) {
        useUIStore.getState().setDraftAutomation({
            title: titleRef.current || 'Untitled Automation',
            steps: stepsRef.current,
            timestamp: Date.now(),
          });
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (editMode && automation) {
      skipDraftPersistRef.current = true;
      setTitle(automation.name || 'Untitled Automation');
      if (automation.steps) setSteps(automation.steps.map((s: any) => ({ ...s, sub_steps: undefined })));
    } else if (!editMode && draftAutomation && draftAutomation.steps && draftAutomation.steps.length > 0) {
      skipDraftPersistRef.current = false;
      setTitle(draftAutomation.title);
      setSteps(draftAutomation.steps);
    }
  }, [editMode, automation, draftAutomation]);

  // Notify parent of dirty state changes
  useEffect(() => {

    if (hasSavedRef.current) {
      return;
    }

    let isDirty = false;
    if (editMode && automation) {
      const initialTitle = automation.name || 'Untitled Automation';
      if (title !== initialTitle) isDirty = true;

      // Basic stringify comparison for steps
      const initialStepsStr = JSON.stringify(automation.steps?.map((s: any) => ({ ...s, sub_steps: undefined })) || []);
      const currentStepsStr = JSON.stringify(steps);
      if (initialStepsStr !== currentStepsStr) isDirty = true;
    } else {
      // Create mode
      if (title.trim() !== '' && title !== 'Untitled Automation') isDirty = true;
      if (steps.length > 0) isDirty = true;
    }
  }, [editMode, automation, title, steps]);

  // Auto-open step picker if no steps exist upon entering the panel
  useEffect(() => {
    if (isOpen && steps.length === 0) {
      // Small delay to ensure any existing/draft steps have finished loading into state
      const timer = setTimeout(() => {
        if (steps.length === 0) {
          setInsertDropdownIndex({ index: 0 });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOpen, steps.length === 0]);

  // Handle recorded selector
  useEffect(() => {
    const handleStorageChange = (changes: any, areaName: string) => {
      if (areaName === 'local' && changes.automation_recorded_selector) {
        const recorded = changes.automation_recorded_selector.newValue;
        if (recorded?.selector) {
          const extraConfig: any = { selector: recorded.selector };
          if (recorded.pageUrl) extraConfig.selectorPageUrl = recorded.pageUrl;
          if (recorded.elementName || recorded.name)
            extraConfig.selectorElementName = recorded.elementName || recorded.name;
          setSteps(prev =>
            prev.map(s => {
              if (s.id === recorded.stepId) return { ...s, config: { ...s.config, ...extraConfig } };
              if (s.subSteps)
                return {
                  ...s,
                  subSteps: s.subSteps.map(sub =>
                    sub.id === recorded.stepId ? { ...sub, config: { ...sub.config, ...extraConfig } } : sub,
                  ),
                };
              return s;
            }),
          );
          setSelectedStepId(recorded.stepId);
          chrome.storage.local.remove('automation_recorded_selector');
        }
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // Location Picker logic
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string | null>(null);
  const [folderIdForSave, setFolderIdForSave] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [footerStatus, setFooterStatus] = useState<{
    message: string;
    type: 'idle' | 'saving' | 'success' | 'error' | 'warning';
  }>({ message: '', type: 'idle' });
  
  const hasDestination = targetWorkspaceId !== null;

  // Auto-select default destination for new automations
  useEffect(() => {
    if (!isOpen) return;

    if (automation) {
      // Edit mode: use existing automation destination
      setTargetWorkspaceId(automation.workspace_id || null);
      setFolderIdForSave(automation.folder_id || null);
    } else if (!targetWorkspaceId) {
      // Create mode: try to load last used destination from storage
      const initDestination = async () => {
        const result = await chrome.storage.local.get('lastAutomationDestination');
        const lastDest = result.lastAutomationDestination;

        if (lastDest) {
          const ws = useDbStore.getState().getWorkspaceById(lastDest.workspace_id);
          if (ws) {
            setTargetWorkspaceId(lastDest.workspace_id);
            setFolderIdForSave(lastDest.folder_id || null);
            return;
          }
        }

        // Fallback: Select first available workspace
        const workspaces = useDbStore.getState().workspaces;
        if (workspaces && workspaces.length > 0) {
          setTargetWorkspaceId(workspaces[0].id);
          setFolderIdForSave(null);
        }
      };
      initDestination();
    }
  }, [isOpen, automation, targetWorkspaceId]);

  const handleWorkspaceDestination = (workspaceId: string) => {
    setTargetWorkspaceId(workspaceId);
    setFolderIdForSave(null);
    setIsLocationPickerOpen(false);
  };
  const handleFolderDestination = (workspaceId: string, folderId: string) => {
    setTargetWorkspaceId(workspaceId);
    setFolderIdForSave(folderId);
    setIsLocationPickerOpen(false);
  };

  const handleSave = async () => {
    if (isSaving) return;
    const hasUnconfigured = steps.some(s => !isStepConfiguredForSave(s));
    if (hasUnconfigured) {
      setFooterStatus({ message: 'Few steps are not configured', type: 'error' });
      setTimeout(() => setFooterStatus({ message: '', type: 'idle' }), 3000);
      return;
    }
    setIsSaving(true);
    setFooterStatus({ message: 'Saving...', type: 'saving' });
    try {
      const payload = {
        name: title || 'Untitled Automation',
        steps: steps, // Passing steps directly, as they are AutomationStep[]
        workspaceId: targetWorkspaceId || undefined,
        folderId: folderIdForSave || null,
        tagIds: [],
        inputs: [],
      };

      let newIdStr: string | null = null;

      if (editMode && automation?.id) {
        const updated = await updateAutomation(automation.id, payload);
        newIdStr = updated.id;
      } else {
        const created = await createAutomation(payload);
        newIdStr = created.id;
      }

      if (newIdStr) {
        if (pendingHotkey) {
            const compoundId = `${folderIdForSave || targetWorkspaceId}-${newIdStr}`;
            await apiSaveHotkey(newIdStr, compoundId, pendingHotkey, 'automation', 'cloud', true);
            const res = await chrome.storage.local.get('alts_automation_hotkeys');
            const ex = (res.alts_automation_hotkeys as Record<string, string>) || {};
            ex[newIdStr] = pendingHotkey;
            await chrome.storage.local.set({ alts_automation_hotkeys: ex });
          }

          if (pendingShortcut) {
            const compoundId = `${folderIdForSave || targetWorkspaceId}-${newIdStr}`;
            const normalizedShortcut = normalizeShortcutTrigger(pendingShortcut);
            await apiSaveShortcut(newIdStr, compoundId, normalizedShortcut, title || 'Automation', 'automation', 'cloud', true);
            const res = await chrome.storage.local.get('alts_automation_shortcuts');
            const ex = (res.alts_automation_shortcuts as Record<string, string>) || {};
            ex[newIdStr] = normalizedShortcut;
            await chrome.storage.local.set({ alts_automation_shortcuts: ex });
          }

          if (isFav) {
            const result = await chrome.storage.local.get('myFavouriteItems');
            const favItems = (result.myFavouriteItems as Record<string, any[]>) || {};
            const currentFavList = favItems[userId] || [];

            const newAutomationItem = {
              id: newIdStr,
              name: title || 'Untitled Automation',
              steps: steps,
              workspace_id: targetWorkspaceId,
              folder_id: folderIdForSave,
              category: 'automation',
              fav: true,
            };

            try {
              await toggleFavorite(newIdStr, 'automation', 'Imported Automation');
            } catch (favErr) {
              console.warn('[AgentPanel] Cloud favorite sync failed:', favErr);
            }

            const updatedFavList = [newAutomationItem, ...currentFavList];
            await chrome.storage.local.set({ myFavouriteItems: { ...favItems, [userId]: updatedFavList } });
          }
        }

      // Successfully saved - disable draft persistence and clear existing draft
      skipDraftPersistRef.current = true;
      hasSavedRef.current = true;
      useUIStore.getState().clearDraftAutomation();

      // Persist the last used destination for future new automations
      chrome.storage.local.set({
        lastAutomationDestination: {
          workspace_id: targetWorkspaceId,
          folder_id: folderIdForSave,
        },
      });

      setFooterStatus({ message: 'Saved successfully', type: 'success' });
      reload?.();
      setTimeout(() => {
        if (isOpen) onClose();
      }, 1500);
    } catch (err) {
      setFooterStatus({ message: 'Failed to save', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const getWorkspaceById = useDbStore(state => state.getWorkspaceById);
  const getFolderById = useDbStore(state => state.getFolderById);

  // Resolve the display name and details for the destination button
  const destinationDetails = useMemo(() => {
    const displayWorkspace = getWorkspaceById(targetWorkspaceId || '');
    const displayFolder = getFolderById(folderIdForSave || '');
    let pathText = 'Select Destination';
    if (displayWorkspace) {
      pathText = displayFolder ? `${displayWorkspace.workspaceName} / ${displayFolder.folderName}` : displayWorkspace.workspaceName;
    }
    return { pathText };
  }, [targetWorkspaceId, folderIdForSave, getWorkspaceById, getFolderById]);

  const handleClosePanel = useCallback(() => {
    if (!skipDraftPersistRef.current && !editMode && steps.length > 0) {
      useUIStore.getState().setDraftAutomation({ title: title || 'Untitled Automation', steps, timestamp: Date.now() });
    }
    onClose();
  }, [editMode, onClose, steps, title]);

  // Keyboard shortcut handler for Alt+Enter (toggle location picker) and Ctrl+Enter (save)
  useEffect(() => {
    if (!isOpen) return;

    const getFocusDepth = () => {
      // DOM-aware check to prevent async race conditions
      if (historyModalState.isOpen || document.querySelector('[data-modal-portal="true"]')) return 3;
      if (editingStepId || tokenEditState) return 2;
      if (selectedStepId) return 1;
      return 0;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((window as any).__tasklabsKeystrokeRecordingActive) return;

      const depth = getFocusDepth();

      // Ctrl/Cmd+Enter to save automation
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        if (depth >= 2) return;

        event.preventDefault();
        event.stopPropagation();
        void handleSave();
        return;
      }

      // Alt+Enter to toggle Location Picker
      if (event.altKey && event.key === 'Enter') {
        if (depth >= 2) return;

        event.preventDefault();
        event.stopPropagation();

        setIsLocationPickerOpen(prev => !prev);
        return;
      }

      if (depth > 0) {
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [
    isOpen,
    editingStepId,
    tokenEditState,
    selectedStepId,
    historyModalState.isOpen,
    handleSave,
    handleClosePanel,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      handleClosePanel();
      return true;
    });
    return unregister;
  }, [isOpen, handleClosePanel]);

  const handleAddStepIndex = (moduleId: string, index: number, config?: any) => {
    const newStep: AutomationStep = { id: `step-${Date.now()}`, moduleId, config: config || {} };
    setSteps(prev => {
      const next = [...prev];
      next.splice(index, 0, newStep);
      return next;
    });
    setSelectedStepId(newStep.id);
  };

  const handleRemoveStep = (id: string | number) => {
    setSteps(prev => prev.filter(s => s.id !== id));
    if (selectedStepId === id) setSelectedStepId(null);
  };

  const handleDuplicateStep = (id: string | number) => {
    const idx = steps.findIndex(s => s.id === id);
    if (idx === -1) return;
    const original = steps[idx];
    const duplicate = { ...original, id: `step-${Date.now()}` };
    setSteps(prev => {
      const next = [...prev];
      next.splice(idx + 1, 0, duplicate);
      return next;
    });
    setSelectedStepId(duplicate.id);
  };

  const handleReorderSteps = (reordered: AutomationStep[]) => setSteps(reordered);
  const handleReorderSubSteps = (parentId: string, reordered: AutomationStep[]) =>
    setSteps(prev => prev.map(s => (s.id === parentId ? { ...s, subSteps: reordered } : s)));

  const hasUnconfiguredSteps = steps.some(s => !isStepConfiguredForSave(s));

  if (!isOpen) return null;

  return (
    <div className="w-full h-full flex flex-col overflow-hidden relative bg-[var(--color-editorBg)] border border-white/10 rounded-2xl shadow-2xl">
      <div className="flex items-center gap-2 flex-shrink-0 border-b border-white/50 dark:border-white/10 pr-6">
        <div className="flex items-center flex-1 min-w-0 self-stretch">
          <div className="relative flex items-center h-full w-[40%] min-w-0">
            {/* Decorative Header Border */}
            <div className="absolute inset-x-0 top-0 bottom-0 border-l border-t border-r border-white/50 dark:border-white/10 pointer-events-none rounded-tl-2xl" />

            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'ArrowRight') {
                  if (e.currentTarget.selectionStart === e.currentTarget.value.length) {
                    e.preventDefault();
                    hotkeyButtonRef.current?.focus();
                  }
                }
                e.stopPropagation();
              }}
              placeholder="Automation Name"
              className="w-full bg-transparent text-2xl font-semibold text-neutral-800 dark:text-neutral-200 placeholder-[var(--color-textPlaceholder)] focus:outline-none transition-colors px-4 py-4 min-w-0 relative z-10"
            />
          </div>

          <div className="flex items-center gap-10 flex-shrink-0 ml-14">
            <div className="flex items-center gap-1.5"><HotkeyAssignButton
  ref={hotkeyButtonRef}
  itemId={automation?.id ? getItemCompoundId({ ...automation, category: 'automation' }) : ''}
  currentHotkey={pendingHotkey}
  onHotkeyChange={handleHotkeyChange}
  isFavorite={isFav}
  onToggleFavorite={handleToggleFavorite}
  showFavorite={true}
  isFavLoading={isFavLoading}
  isHotkeyLoading={isHotkeySyncing}
  className="focus:outline-none focus:ring-1 focus:ring-purple-400"
/><ShortcutAssignButton
  ref={hotkeyButtonRef}
  itemId={automation?.id ? getItemCompoundId({ ...automation, category: 'automation' }) : ''}
  currentShortcut={pendingShortcut}
  onShortcutChange={handleShortcutChange}
  defaultName={title}
  isShortcutLoading={isShortcutSyncing}
  className="focus:outline-none focus:ring-1 focus:ring-purple-400"
/></div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            ref={closeBtnRef}
            onClick={handleClosePanel}
            onKeyDown={e => {
              if (e.key === 'ArrowLeft') {
                e.preventDefault();
                shortcutBtnRef.current?.focus();
              }
            }}
            className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-red-500/10 text-red-500 hover:text-red-400 dark:text-red-500 dark:hover:text-red-400 transition-colors focus:outline-none focus:ring-1 focus:ring-red-400"
            aria-label="Close">
            <FaTimes size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div
          className="flex-1 min-h-0 flex flex-col overflow-hidden transition-all duration-300"
          onClick={() => setSelectedStepId(null)}>
          <AutomationStepList
            steps={steps}
            selectedStepId={selectedStepId}
            onSelectStep={setSelectedStepId}
            onAddStep={idx => setInsertDropdownIndex({ index: idx })}
            onDeleteStep={handleRemoveStep}
            onDuplicateStep={handleDuplicateStep}
            onUpdateStep={updateStepConfig}
            onActionClick={idx => setInsertDropdownIndex({ index: idx })}
            onEditClick={(id, rect) => {
              // Find the step to check its type
              const findStep = (searchSteps: AutomationStep[]): AutomationStep | undefined => {
                for (const s of searchSteps) {
                  if (s.id === id) return s;
                  if (s.subSteps) {
                    const found = findStep(s.subSteps);
                    if (found) return found;
                  }
                }
                return undefined;
              };
              const targetStep = findStep(steps);
              // Keystroke steps use inline editing, don't open config panel
              if (targetStep?.moduleId === 'keystroke') return;
              setEditingStepId(id);
              setSelectedStepId(id);
              setEditingStepRect(rect || null);
            }}
            onReorderSteps={handleReorderSteps}
            onReorderSubSteps={handleReorderSubSteps}
            getStepLabel={getStepLabel}
            isPickerOpen={insertDropdownIndex !== null}
            isEditing={editingStepId !== null}
            showUnconfiguredWarning={hasUnconfiguredSteps}
            onTokenEdit={(stepId, tokenName) => setTokenEditState({ stepId, tokenName })}
          />
        </div>

        {showShortcuts && (
          <div className="absolute top-2 right-4 z-[9999] w-80 bg-white/80 dark:bg-frostedwhite backdrop-blur-md border border-neutral-200 dark:border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between px-4 py-3 bg-neutral-50/50 dark:bg-white/5 border-b border-neutral-200 dark:border-white/5">
              <div className="flex items-center gap-2">
                <FaKeyboard className="text-emerald-500" size={14} />
                <h3 className="text-[12px] font-bold text-white uppercase tracking-wider">Keyboard Shortcuts</h3>
              </div>
              <button
                onClick={() => setShowShortcuts(false)}
                className="p-1 rounded-md text-neutral-500 hover:text-white hover:bg-white/5 transition-all">
                <FaTimes size={12} />
              </button>
            </div>
            <div className="p-2">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-white/5">
                    <th className="text-left py-2 px-3 text-[10px] uppercase tracking-widest text-neutral-500 font-bold">
                      Action
                    </th>
                    <th className="text-right py-2 px-3 text-[10px] uppercase tracking-widest text-neutral-500 font-bold">
                      Keys
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-white/[0.03]">
                  {[
                    { keys: [isMac ? '⌘' : 'Ctrl', 'Enter'], label: 'Save & Close' },
                    { keys: ['Esc'], label: 'Close Panel' },
                    { keys: [isMac ? 'Opt' : 'Alt', 'Enter'], label: 'Destination' },
                    { keys: [isMac ? 'Opt' : 'Alt', '+'], label: 'Add New Step' },
                    { keys: ['Del'], label: 'Delete Selected' },
                    { keys: [isMac ? '⌘' : 'Ctrl', 'D'], label: 'Duplicate Step' },
                  ].map((shortcut, i) => (
                    <tr key={i} className="group hover:bg-neutral-500/5 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-2 px-3 text-[11px] font-medium text-neutral-600 dark:text-neutral-400 group-hover:text-black dark:group-hover:text-white transition-colors">
                        {shortcut.label}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1 justify-end">
                          {shortcut.keys.map((key, j) => (
                            <React.Fragment key={j}>
                              <kbd className="min-w-[22px] px-2 py-0.5 rounded border border-neutral-300 dark:border-white/10 bg-white dark:bg-[#1a1a1a] text-[9px] font-bold text-neutral-600 dark:text-neutral-300 shadow-sm text-center font-mono">
                                {key}
                              </kbd>
                              {j < shortcut.keys.length - 1 && (
                                <span className="text-neutral-400 dark:text-white/20 text-[10px] font-bold">+</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {editingStepId && (
          <div className="fixed inset-0 z-[99999]">
            <div
              className="fixed inset-0 bg-black/40 animate-in fade-in duration-300"
              onClick={e => {
                e.stopPropagation();
                setEditingStepId(null);
                setEditingStepRect(null);
              }}
            />
            {(() => {
              const step =
                steps.find(s => s.id === editingStepId) ||
                steps.flatMap(s => s.subSteps || []).find(sub => sub.id === editingStepId);
              const isDropdown =
                step && ['open_tab', 'agent', 'link', 'click', 'paste', 'wait'].includes(step.moduleId);
              const isSelectionPhase =
                isDropdown && (step.moduleId === 'click' || step.moduleId === 'paste') && !step.config?.selector;

              if (isSelectionPhase)
                return (
                  <div className="fixed inset-0 flex items-start justify-center pt-24 pointer-events-none p-4">
                    <div className="relative z-[100000] pointer-events-auto w-[600px] max-h-[80vh]">
                      {renderStepEditor()}
                    </div>
                  </div>
                );

              if (isDropdown && editingStepRect) {
                const popupWidth = 440;
                const estimatedHeight = 400;
                const margin = 12;
                const spaceBelow = window.innerHeight - editingStepRect.bottom - margin;
                const spaceAbove = editingStepRect.top - margin;
                let top: number | undefined = editingStepRect.bottom + margin;
                let bottom: number | undefined = undefined;
                let left = editingStepRect.left;
                let transformOrigin = 'top left';
                let maxHeight = Math.min(450, Math.max(300, spaceBelow - 20));
                if (spaceBelow < 300 && spaceAbove > spaceBelow) {
                  maxHeight = Math.min(estimatedHeight, spaceAbove - 20);
                  top = undefined;
                  bottom = window.innerHeight - editingStepRect.top + margin;
                  transformOrigin = 'bottom left';
                }
                if (left + popupWidth > window.innerWidth) {
                  left = Math.max(margin, editingStepRect.right - popupWidth);
                  transformOrigin = top !== undefined ? 'top right' : 'bottom right';
                }
                return ReactDOM.createPortal(
                  <div
                    className="fixed z-[100000] bg-black border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                    style={{
                      top: top !== undefined ? Math.max(margin, top) : undefined,
                      bottom: bottom !== undefined ? Math.max(margin, bottom) : undefined,
                      left: Math.max(margin, left),
                      width: popupWidth,
                      maxHeight: `${maxHeight}px`,
                      transformOrigin,
                    }}>
                    {renderStepEditor()}
                  </div>,
                  document.body,
                );
              }
              return ReactDOM.createPortal(
                <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
                  <div className="relative z-[100000] w-[800px] h-[600px] bg-[var(--color-editorBg)] rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
                    {renderStepEditor()}
                  </div>
                </div>,
                document.body,
              );
            })()}
          </div>
        )}

        {/* Token Config Popup (Open Link step: Enter on token → paste config) */}
        {tokenEditState &&
          (() => {
            const tokenStep =
              steps.find(s => s.id === tokenEditState.stepId) ||
              steps.flatMap(s => s.subSteps || []).find(sub => sub.id === tokenEditState.stepId);
            if (!tokenStep) return null;
            const paramConfigs = tokenStep.config?.paramConfigs || {};
            const tokenCfg = paramConfigs[tokenEditState.tokenName];
            const initialValues = tokenCfg?.values || [''];
            return ReactDOM.createPortal(
              <div className="fixed inset-0 z-[99999]">
                <div
                  className="fixed inset-0 bg-black/40 animate-in fade-in duration-300"
                  onClick={() => setTokenEditState(null)}
                />
                <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
                  <div className="relative z-[100000] w-[440px] bg-[var(--color-editorBg)] rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
                    <AutomationStepPicker
                      key={`token-edit-${tokenEditState.stepId}-${tokenEditState.tokenName}`}
                      isTokenEditor={true}
                      moduleId="paste"
                      initialKey={tokenEditState.tokenName}
                      initialValues={initialValues}
                      initialParamConfigs={paramConfigs}
                      stepId={String(tokenEditState.stepId)}
                      availableParams={getAvailableVariables(tokenEditState.stepId)}
                      onClose={() => setTokenEditState(null)}
                      onSave={() => setTokenEditState(null)}
                      onConfigSave={newConfig => {
                        const paramConfigs = newConfig.paramConfigs || newConfig;
                        const updates: any = { paramConfigs };

                        // If it's an Open Link or Link step, sync the URL with updated param types
                        if (tokenStep.moduleId === 'open_tab' || tokenStep.moduleId === 'link') {
                          const currentUrl = tokenStep.config?.url || '';
                          const nextUrl = convertLegacyParams(currentUrl, paramConfigs);
                          if (nextUrl !== currentUrl) {
                            updates.url = nextUrl;
                          }
                        }

                        updateStepConfig(tokenEditState.stepId, updates);
                      }}
                      isEmbedded={true}
                      className="w-full h-auto"
                      historySuggestions={inlineHistorySuggestions}
                      isFetchingHistory={inlineFetchingStatus}
                    />
                  </div>
                </div>
              </div>,
              document.body,
            );
          })()}

        {insertDropdownIndex && (
          <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
              onClick={() => setInsertDropdownIndex(null)}
            />
            <div className="relative w-[410px] h-[580px] bg-[var(--color-popupBg)] rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <AutomationActionMenu
                onClose={() => setInsertDropdownIndex(null)}
                insertPoint={insertDropdownIndex}
                steps={steps}
                setSteps={setSteps}
                setSelectedStepId={setSelectedStepId}
                installedModules={installedModules}
                moduleCatalog={moduleCatalog}
                refreshCommands={fetchModules}
                installModule={handleInstallCloudModule}
                onRequestStepTableFocus={(target = 'select') =>
                  window.dispatchEvent(new CustomEvent('agent-step-table-focus', { detail: { target } }))
                }
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-none bg-[var(--color-editorBg)] border-t border-white/10">
        <div className="relative flex items-center justify-between gap-3 px-6 py-4 text-[10px] font-medium text-neutral-500">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-[var(--color-editorBg)] hover:bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-neutral-400 transition-colors group shadow-sm">
              <span>Back</span>
            </button>
          </div>

          {footerStatus.message !== 'Few steps are not configured' && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="relative">
                <button
                  onClick={() => setIsLocationPickerOpen(true)}
                  title={destinationDetails.pathText}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-[var(--color-editorBg)] px-2 py-1 text-xs font-semibold text-neutral-200 hover:bg-white/5 transition-colors">
                  <FaFolder className="text-neutral-400 group-hover:text-neutral-200 transition-colors" size={14} />
                  {hasDestination ? (
                    <span className="truncate max-w-[200px] text-white/80">
                      {destinationDetails.pathText}
                    </span>
                  ) : (
                    <span className="truncate max-w-[200px] text-neutral-400">Select Destination</span>
                  )}
                </button>
                {isLocationPickerOpen && (
                  <DestinationPicker
                    selectedWorkspaceId={targetWorkspaceId}
                    selectedFolderId={folderIdForSave}
                    onSelectWorkspace={handleWorkspaceDestination}
                    onSelectFolder={handleFolderDestination}
                    onClose={() => setIsLocationPickerOpen(false)}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 z-[100] shadow-2xl border-neutral-700 w-80"
                  />
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            {footerStatus.type !== 'idle' && (
              <div
                className={`flex items-center gap-2 text-[11px] font-medium ${footerStatus.type === 'error' ? 'text-red-500' : 'text-neutral-300'}`}>
                <div
                  className={`w-2 h-2 rounded-full ${footerStatus.type === 'saving' ? 'animate-pulse' : ''} ${footerStatus.type === 'error' ? 'bg-red-500' : footerStatus.type === 'success' ? 'bg-neutral-500' : footerStatus.type === 'warning' ? 'bg-amber-500' : 'bg-emerald-500/50'}`}
                />
                {footerStatus.message === 'Few steps are not configured' ? <CiWarning size={14} /> : null}
                <span>{footerStatus.message}</span>
              </div>
            )}
            {steps.length > 0 && (
              <button
                onClick={async () => {
                  try {
                    await runAutomation({
                      id: 'test',
                      type: 'automation',
                      name: title || 'Test',
                      steps,
                      timestamp: Date.now(),
                    });
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-transparent border border-white/20 text-neutral-400 hover:text-white hover:border-white/30 hover:bg-white/5 text-[10px] font-semibold transition-all shadow-sm"
                title="Run Current Workflow">
                <FaPlay size={8} /> Run
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`flex items-center gap-2 rounded-md border px-2 py-0.5 text-[10px] font-semibold shadow-sm transition-colors ${isSaving ? 'cursor-not-allowed border-neutral-700 bg-[var(--color-editorBg)] text-neutral-500' : 'border-white/10 bg-[var(--color-editorBg)] text-neutral-100 hover:border-white/20'}`}>
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <AutomationHistoryPrompt
        isOpen={historyModalState.isOpen}
        paramName={historyModalState.paramName}
        suggestions={historyModalState.suggestions}
        onClose={() => setHistoryModalState({ ...historyModalState, isOpen: false })}
        onSelectSingle={value => {
          const { stepId, paramName } = historyModalState;
          if (stepId) {
            updateStepConfig(stepId, { [paramName]: value });
            window.dispatchEvent(new CustomEvent(`smart_fill_saved_${stepId}`, { detail: { paramName, value } }));
          } else {
            window.dispatchEvent(
              new CustomEvent('AltsHistorySmartFillVal', { detail: { paramName, value, isDropdown: false } }),
            );
          }
          setHistoryModalState({ ...historyModalState, isOpen: false });
        }}
        onSaveAsDropdown={selectedSuggestions => {
          const stringVals = selectedSuggestions.map((s: any) => s.value).filter(Boolean);
          window.dispatchEvent(
            new CustomEvent('AltsHistorySmartFillVal', {
              detail: {
                paramName: historyModalState.paramName,
                value: stringVals.length >= 2 ? stringVals : [...stringVals, ''],
                optionPairs: selectedSuggestions,
                isDropdown: true,
              },
            }),
          );
          setHistoryModalState({ ...historyModalState, isOpen: false });
        }}
      />
    </div>
  );
};

export default AutomationDashboard;
