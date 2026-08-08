/**
 * @file useAiPromptEditor.ts
 * @description A custom React hook containing state management and logic for the AI Prompt editor.
 * It manages prompt title, prompt body/content, active model selection, tag associations, folder/workspace syncing,
 * debounced autosaving, sessionStorage-based drafts for new prompts, and interaction with background script
 * for auto-submitting prompts to target AI model interfaces.
 * 
 * @usage
 * ```tsx
 * import { useAiPromptEditor } from './useAiPromptEditor';
 * const state = useAiPromptEditor({ aiPromptId: 'some-id' });
 * ```
 */

import { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from 'react';

import { getItemCompoundId, readAllShortcuts } from '../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { saveShortcut, clearShortcut } from '../../../../shared-components/shortcuts';
import { normalizeShortcutTrigger } from '../../../../shared-components/shortcuts/core/shortcutDbData';

import { createAiPrompt, updateAiPrompt, deleteAiPrompt } from './aiPromptData';
import { useShortcutValidation } from '../../../../shared-components/shortcuts/hooks/useShortcutValidation';
import type { AiPromptRecord, CreateAiPromptInput, UpdateAiPromptInput, CustomModelConfig } from './aiPromptTypes';
import { useAiPrompt } from './aiPromptHooks';
import { getSmartDefaultWorkspace } from '../../../../storage/localStorage/lastUsedWorkspace';
import { StorageManager } from '../../../../storage/localStorage/storageManager';
import { migrateItemCompoundId } from '../../../../shared-components/utils/metadataMigration';

export interface AiPromptEditorProps {
  aiPromptId?: string | null;
  onBack?: () => void;
  initialTitle?: string;
  initialPrompt?: string;
}

const DRAFT_KEY = 'aiPrompt_draft';
let draftCache: { promptTitle: string; promptBody: string; promptRules: string; modelUrls: Record<string, string> } | null = null;

function saveDraft(title: string, body: string, rules: string, urls: Record<string, string>) {
  draftCache = { promptTitle: title, promptBody: body, promptRules: rules, modelUrls: urls };
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draftCache));
  } catch { /* quota exceeded */ }
}

function loadDraft(): { promptTitle?: string; promptBody?: string; promptRules?: string; modelUrls?: Record<string, string> } | null {
  if (draftCache) return draftCache;
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearDraft() {
  draftCache = null;
  try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .trim();
}

const defaultModelUrls = {
  gpt: 'https://chatgpt.com',
  claude: 'https://claude.ai/new',
  gemini: 'https://gemini.google.com/app',
  perplexity: 'https://www.perplexity.ai',
};

function resolveItemShortcut(
  shortcutsMap: Record<string, string>,
  compoundId: string,
  rawId: string,
): string {
  let shortcut = normalizeShortcutTrigger(
    shortcutsMap[compoundId] || shortcutsMap[rawId] || '',
  );

  if (!shortcut) {
    const matchingKey = Object.keys(shortcutsMap).find(
      key => key === rawId || key.endsWith(`-${rawId}`),
    );
    if (matchingKey) {
      shortcut = normalizeShortcutTrigger(shortcutsMap[matchingKey] || '');
    }
  }

  return shortcut;
}

export function useAiPromptEditor(props: AiPromptEditorProps) {
  const { aiPromptId, onBack, initialTitle, initialPrompt } = props;

  const resolvedAiPromptId = useMemo(() => {
    return (aiPromptId && aiPromptId !== 'new') ? aiPromptId : null;
  }, [aiPromptId]);

  const [activeAiPromptId, setActiveAiPromptId] = useState<string | null>(resolvedAiPromptId);
  const activeAiPromptIdRef = useRef<string | null>(resolvedAiPromptId);

  const [promptTitle, setPromptTitle] = useState<string>(initialTitle || '');
  const [promptBody, setPromptBody] = useState<string>(initialPrompt || '');
  const [promptRules, setPromptRules] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [customModels, setCustomModels] = useState<CustomModelConfig[]>([]);
  const [isInitialized, setIsInitialized] = useState<boolean>(!resolvedAiPromptId);
  const [isShortcutInitialized, setIsShortcutInitialized] = useState<boolean>(!resolvedAiPromptId);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const [promptShortcut, setPromptShortcut] = useState<string>('');
  const promptShortcutRef = useRef<string>(promptShortcut);
  useEffect(() => {
    promptShortcutRef.current = promptShortcut;
  }, [promptShortcut]);

  const lastSavedShortcutRef = useRef<string>('');
  const isShortcutManuallyEditedRef = useRef<boolean>(false);
  const hasLoadedShortcutRef = useRef<boolean>(false);

  const updatePromptShortcut = useCallback((value: string) => {
    isShortcutManuallyEditedRef.current = true;
    setPromptShortcut(value);
  }, []);

  const { validateShortcut } = useShortcutValidation();
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  const [isShortcutOverrideable, setIsShortcutOverrideable] = useState<boolean>(false);
  const [shortcutConflictId, setShortcutConflictId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const checkShortcut = async () => {
      if (promptShortcut) {
        const targetCompoundId = getItemCompoundId({
          id: resolvedAiPromptId || activeAiPromptId,
          workspace_id: workspaceId || null,
          folder_id: folderId || null,
          snippet: { id: resolvedAiPromptId || activeAiPromptId, category: 'aiPrompt' }
        });
        const currentShortcuts = await readAllShortcuts();
        if (currentShortcuts[targetCompoundId] === promptShortcut) {
          if (active) {
            setShortcutError(null);
            setIsShortcutOverrideable(false);
            setShortcutConflictId(null);
          }
          return;
        }
        const res = await validateShortcut(promptShortcut, resolvedAiPromptId || activeAiPromptId || 'new');
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
  }, [promptShortcut, resolvedAiPromptId, activeAiPromptId, workspaceId, folderId, validateShortcut]);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const [modelUrls, setModelUrls] = useState<Record<string, string>>({
    gpt: 'https://chatgpt.com',
    claude: 'https://claude.ai/new',
    gemini: 'https://gemini.google.com/app',
    perplexity: 'https://www.perplexity.ai',
  });

  const setModelUrl = useCallback((modelId: string, url: string) => {
    setModelUrls(prev => ({ ...prev, [modelId]: url }));
  }, []);

  const generatingModelRef = useRef<string | null>(null);
  const isGeneratingRef = useRef(false);

  const lastSavedTitleRef = useRef<string>(initialTitle || '');
  const lastSavedPromptRef = useRef<string>(initialPrompt || '');
  const lastSavedRulesRef = useRef<string>('');
  const lastSavedModelUrlsRef = useRef<Record<string, string>>(resolvedAiPromptId ? {} : defaultModelUrls);
  const lastSavedWorkspaceIdRef = useRef<string | null>(null);
  const lastSavedFolderIdRef = useRef<string | null>(null);
  const lastSavedTagIdsRef = useRef<string[]>([]);
  const lastSavedCustomModelsRef = useRef<CustomModelConfig[]>([]);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initDefaults = useCallback(async () => {
    const smartWs = await getSmartDefaultWorkspace();
    if (smartWs) {
      setWorkspaceId(smartWs.id);
      lastSavedWorkspaceIdRef.current = smartWs.id;
      const savedFolderId = await StorageManager.getItem('lastUsedFolderId');
      setFolderId(savedFolderId || null);
      lastSavedFolderIdRef.current = savedFolderId || null;
    } else {
      setWorkspaceId(null);
      lastSavedWorkspaceIdRef.current = null;
      setFolderId(null);
      lastSavedFolderIdRef.current = null;
    }
  }, []);

  // Initialize defaults for new prompt
  useEffect(() => {
    if (resolvedAiPromptId) {
      clearDraft();
      activeAiPromptIdRef.current = resolvedAiPromptId;
      setActiveAiPromptId(resolvedAiPromptId);
      setIsInitialized(false);
      setIsShortcutInitialized(false);
      return;
    }

    activeAiPromptIdRef.current = null;
    setActiveAiPromptId(null);
    setPromptTitle(initialTitle || '');
    setPromptBody(initialPrompt || '');
    setPromptRules('');
    setSelectedModel(null);

    void initDefaults();

    setTagIds([]);
    setCustomModels([]);
    lastSavedTitleRef.current = initialTitle || '';
    lastSavedPromptRef.current = initialPrompt || '';
    lastSavedRulesRef.current = '';
    lastSavedModelUrlsRef.current = defaultModelUrls;
    lastSavedWorkspaceIdRef.current = null;
    lastSavedFolderIdRef.current = null;
    lastSavedTagIdsRef.current = [];
    lastSavedCustomModelsRef.current = [];
    lastSavedShortcutRef.current = '';
    isShortcutManuallyEditedRef.current = false;
    setPromptShortcut('');
    setSaveStatus('idle');
    setIsInitialized(true);
    setIsShortcutInitialized(true);

    // Restore previous draft from sessionStorage if available
    const draft = loadDraft();
    if (draft) {
      if (draft.promptTitle) setPromptTitle(draft.promptTitle);
      if (draft.promptBody) setPromptBody(draft.promptBody);
      if (draft.promptRules) setPromptRules(draft.promptRules);
      if (draft.modelUrls) setModelUrls(draft.modelUrls);
    }
  }, [resolvedAiPromptId, initialTitle, initialPrompt, initDefaults]);

  // Load existing record
  const liveAiPrompt = useAiPrompt(activeAiPromptId);

  const isDirty = useMemo(() => {
    if (!isInitialized || !isShortcutInitialized) return false;
    const titleChanged = promptTitle !== lastSavedTitleRef.current;
    const promptChanged = promptBody !== lastSavedPromptRef.current;
    const rulesChanged = promptRules !== lastSavedRulesRef.current;
    const modelUrlsChanged = JSON.stringify(modelUrls) !== JSON.stringify(lastSavedModelUrlsRef.current);
    const workspaceChanged = workspaceId !== lastSavedWorkspaceIdRef.current;
    const folderChanged = folderId !== lastSavedFolderIdRef.current;
    const tagsChanged = [...tagIds].sort().join(',') !== [...lastSavedTagIdsRef.current].sort().join(',');
    const customModelsChanged = JSON.stringify(customModels) !== JSON.stringify(lastSavedCustomModelsRef.current);
    const shortcutChanged = isShortcutInitialized && promptShortcut !== lastSavedShortcutRef.current;

    return titleChanged || promptChanged || rulesChanged || modelUrlsChanged || workspaceChanged || folderChanged || tagsChanged || customModelsChanged || shortcutChanged;
  }, [promptTitle, promptBody, promptRules, modelUrls, workspaceId, folderId, tagIds, customModels, promptShortcut, isInitialized, isShortcutInitialized]);


  // Synchronize shortcut from DB on load or activeAiPromptId changes
  useEffect(() => {
    hasLoadedShortcutRef.current = false;
    isShortcutManuallyEditedRef.current = false;
  }, [activeAiPromptId]);

  useEffect(() => {
    let cancelled = false;

    if (activeAiPromptId) {
      setIsShortcutInitialized(false);
      const loadSavedShortcut = async () => {
        try {
          const wsObj = workspaceId ? { workspace_id: workspaceId } : null;
          const fldObj = folderId ? { folder_id: folderId } : null;
          const targetCompoundId = getItemCompoundId({
            id: activeAiPromptId,
            workspace_id: wsObj?.workspace_id || null,
            folder_id: fldObj?.folder_id || null,
            snippet: { id: activeAiPromptId, category: 'aiPrompt' }
          });
          const shortcutsMap = await readAllShortcuts();
          const sc = resolveItemShortcut(shortcutsMap, targetCompoundId, activeAiPromptId);
          if (isMounted.current && !cancelled) {
            if (!isShortcutManuallyEditedRef.current) {
              setPromptShortcut(sc);
              lastSavedShortcutRef.current = sc;
              hasLoadedShortcutRef.current = true;
            }
            setIsShortcutInitialized(true);
          }
        } catch (err) {
          console.error('Failed to load shortcut:', err);
          if (isMounted.current && !cancelled) {
            setIsShortcutInitialized(true);
          }
        }
      };
      void loadSavedShortcut();
    } else {
      setPromptShortcut('');
      lastSavedShortcutRef.current = '';
      setIsShortcutInitialized(true);
    }

    return () => {
      cancelled = true;
    };
  }, [activeAiPromptId, workspaceId, folderId]);

  useEffect(() => {
    if (!liveAiPrompt) return;

    if (!isInitialized) {
      setPromptTitle(liveAiPrompt.title);
      setPromptBody(liveAiPrompt.prompt);
      setPromptRules(liveAiPrompt.rules || '');
      if (liveAiPrompt.modelUrls) {
        setModelUrls(liveAiPrompt.modelUrls);
      }
      setWorkspaceId(liveAiPrompt.workspaceId);
      setFolderId(liveAiPrompt.folderId);
      setTagIds(liveAiPrompt.tagIds);
      if (liveAiPrompt.customModels) {
        setCustomModels(liveAiPrompt.customModels);
      } else {
        setCustomModels([]);
      }

      lastSavedTitleRef.current = liveAiPrompt.title;
      lastSavedPromptRef.current = liveAiPrompt.prompt;
      lastSavedRulesRef.current = liveAiPrompt.rules || '';
      lastSavedModelUrlsRef.current = liveAiPrompt.modelUrls || {};
      lastSavedWorkspaceIdRef.current = liveAiPrompt.workspaceId;
      lastSavedFolderIdRef.current = liveAiPrompt.folderId;
      lastSavedTagIdsRef.current = liveAiPrompt.tagIds;
      lastSavedCustomModelsRef.current = liveAiPrompt.customModels || [];

      setLastSavedAt(new Date(liveAiPrompt.updatedAt));
      setSaveStatus('saved');
      setIsInitialized(true);
    }
  }, [liveAiPrompt, isInitialized]);

  // Sync refs with state
  useEffect(() => {
    isGeneratingRef.current = isGenerating;
  }, [isGenerating]);

  // Auto-save draft for new prompts — useLayoutEffect fires synchronously before unmount
  // The module-level draftCache also survives component remounts within the same page
  useLayoutEffect(() => {
    if (!aiPromptId) {
      saveDraft(promptTitle, promptBody, promptRules, modelUrls);
    }
  }, [aiPromptId, promptTitle, promptBody, promptRules, modelUrls]);

  // Listen for AI session URL updates from background
  useEffect(() => {
    const handleAiUrlUpdate = (message: any) => {
      if (message.action === 'ai_session_url_updated' && message.url) {
        const activeModel = generatingModelRef.current;
        if (activeModel && message.model === activeModel) {
          setGeneratedUrl(message.url);
          setModelUrl(activeModel, message.url);
          setGenerationError(null);
          setIsGenerating(false);
          generatingModelRef.current = null;
          // Close the AI tab after capturing the URL with a slight delay
          // This gives the AI provider time to fully create the chat on their end
          if (message.tabId) {
            setTimeout(() => {
              chrome.tabs.remove(message.tabId).catch(() => { });
            }, 2500);
          }
        }
      }
    };

    chrome.runtime.onMessage.addListener(handleAiUrlUpdate);
    return () => chrome.runtime.onMessage.removeListener(handleAiUrlUpdate);
  }, []);

  const MODEL_KIND: Record<string, string> = {
    gpt: 'chatgpt',
    claude: 'claude',
    gemini: 'gemini',
    perplexity: 'perplexity',
  };

  const handleGenerateLink = useCallback(async (modelIds: string | string[], customPrompt?: string) => {
    const ids = Array.isArray(modelIds) ? modelIds : [modelIds];
    const basePrompt = stripHtml(promptBody).trim();
    const rules = stripHtml(promptRules).trim();

    let combinedPrompt = basePrompt;
    if (rules) {
      combinedPrompt = combinedPrompt
        ? `${combinedPrompt}\n\nInstructions:\n${rules}`
        : `Instructions:\n${rules}`;
    }

    const cleanPrompt = customPrompt ? customPrompt.trim() : combinedPrompt;

    if (ids.length === 0 || !cleanPrompt.trim()) return;

    const firstModelId = ids[0];
    generatingModelRef.current = firstModelId;
    setSelectedModel(firstModelId);
    setIsGenerating(true);
    isGeneratingRef.current = true;
    setGenerationError(null);
    setGeneratedUrl(null);

    try {
      const tabIds: number[] = [];
      const trackingModels: string[] = [];

      for (const mId of ids) {
        const targetUrl = mId.includes('gpt') ? 'https://chatgpt.com' : mId.includes('claude') ? 'https://claude.ai/new' : mId.includes('gemini') ? 'https://gemini.google.com/app' : 'https://www.perplexity.ai';

        let kind = 'chatgpt';
        if (mId.includes('claude')) kind = 'claude';
        else if (mId.includes('gemini')) kind = 'gemini';
        else if (mId.includes('perplexity')) kind = 'perplexity';

        const response = await new Promise<any>((resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              action: 'open_tab_with_auto_submit',
              url: targetUrl,
              autoSubmit: { kind, prompt: cleanPrompt },
              forceNewTab: true,
              active: true,
            },
            res => {
              if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
              else resolve(res);
            },
          );
        });

        if (response?.tabId) {
          tabIds.push(response.tabId);
          trackingModels.push(mId);
        }
      }

      if (tabIds.length > 0) {
        chrome.runtime.sendMessage({
          action: 'track_ai_session',
          prompt: cleanPrompt,
          tabIds,
          models: trackingModels,
          aiPromptId: activeAiPromptIdRef.current || undefined,
        });
      }

      setTimeout(() => {
        if (isGeneratingRef.current) {
          setIsGenerating(false);
          isGeneratingRef.current = false;
          generatingModelRef.current = null;
        }
      }, 120000);
    } catch (err) {
      setIsGenerating(false);
      isGeneratingRef.current = false;
      generatingModelRef.current = null;
      setGenerationError('Failed to trigger AI. Please try again.');
    }
  }, [promptBody, promptRules, modelUrls]);

  const handleSave = useCallback(async (overrides?: {
    workspaceId?: string | null;
    folderId?: string | null;
    tagIds?: string[];
  }): Promise<string | false> => {
    const currentPromptId = activeAiPromptIdRef.current;
    const saveWorkspaceId = overrides?.workspaceId !== undefined ? overrides.workspaceId : workspaceId;
    const saveFolderId = overrides?.folderId !== undefined ? overrides.folderId : folderId;
    const saveTagIds = overrides?.tagIds !== undefined ? overrides.tagIds : tagIds;

    if (shortcutError) {
      setSaveStatus('error');
      return false;
    }

    if (!promptTitle.trim()) {
      return false;
    }

    if (!promptTitle.trim() && !promptBody.trim()) {
      return false;
    }


    setSaveStatus('saving');
    try {
      let savedRecord: AiPromptRecord;

      if (currentPromptId) {
        const input: UpdateAiPromptInput = {
          workspaceId: saveWorkspaceId || undefined,
          folderId: saveFolderId,
          title: promptTitle || 'AI Generated Link',
          prompt: promptBody,
          rules: promptRules,
          modelUrls: modelUrls,
          tagIds: saveTagIds,
          customModels: customModels,
        };
        savedRecord = await updateAiPrompt(currentPromptId!, input);
      } else {
        const input: CreateAiPromptInput = {
          workspaceId: saveWorkspaceId || undefined,
          folderId: saveFolderId,
          title: promptTitle || 'AI Generated Link',
          prompt: promptBody,
          rules: promptRules,
          modelUrls: modelUrls,
          tagIds: saveTagIds,
          customModels: customModels,
        };
        savedRecord = await createAiPrompt(input);
      }

      activeAiPromptIdRef.current = savedRecord.id;
      setActiveAiPromptId(savedRecord.id);

      setWorkspaceId(savedRecord.workspaceId);
      setFolderId(savedRecord.folderId);
      setTagIds(savedRecord.tagIds);
      if (savedRecord.customModels) {
        setCustomModels(savedRecord.customModels);
      }

      const oldWsId = lastSavedWorkspaceIdRef.current;
      const oldFldId = lastSavedFolderIdRef.current;

      clearDraft();
      lastSavedTitleRef.current = savedRecord.title;
      lastSavedPromptRef.current = savedRecord.prompt;
      lastSavedRulesRef.current = savedRecord.rules || '';
      lastSavedModelUrlsRef.current = savedRecord.modelUrls || {};
      lastSavedWorkspaceIdRef.current = savedRecord.workspaceId;
      lastSavedFolderIdRef.current = savedRecord.folderId;
      lastSavedTagIdsRef.current = savedRecord.tagIds;
      lastSavedCustomModelsRef.current = savedRecord.customModels || [];

      const wId = savedRecord.workspaceId;
      const fId = savedRecord.folderId;

      const targetCompoundId = getItemCompoundId({
        id: savedRecord.id,
        workspace_id: wId || null,
        folder_id: fId || null,
        snippet: { id: savedRecord.id, category: 'aiPrompt' }
      });

      if (activeAiPromptIdRef.current) {
        const oldWsObj = oldWsId ? { workspace_id: oldWsId } : null;
        const oldFldObj = oldFldId ? { folder_id: oldFldId } : null;
        const oldCompoundId = getItemCompoundId({
          id: activeAiPromptIdRef.current,
          workspace_id: oldWsObj?.workspace_id || null,
          folder_id: oldFldObj?.folder_id || null,
          snippet: { id: activeAiPromptIdRef.current, category: 'aiPrompt' }
        });

        if (oldCompoundId && targetCompoundId && oldCompoundId !== targetCompoundId) {
          await migrateItemCompoundId(oldCompoundId, targetCompoundId, 'aiPrompt');
        }
      }

      const finalShortcut = promptShortcut.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (finalShortcut) {
        const valRes = await validateShortcut(finalShortcut, savedRecord.id);
        if (valRes.isValid) {
          console.log(`[ShortcutDebug][AiPromptEditor] handleSave: Valid shortcut "${finalShortcut}", saving to DB for prompt "${savedRecord.id}"...`);
          await saveShortcut(savedRecord.id, targetCompoundId, finalShortcut, savedRecord.title, 'aiPrompt');
        } else {
          console.warn(`[ShortcutDebug][AiPromptEditor] handleSave: Shortcut "${finalShortcut}" has validation error "${valRes.errorMessage}". SKIPPING DB save on background autosave.`);
        }
        // Always update the ref to prevent infinite autosave loops
        lastSavedShortcutRef.current = finalShortcut;
      } else if (lastSavedShortcutRef.current !== '') {
        console.log(`[ShortcutDebug][AiPromptEditor] handleSave: Clearing shortcut for prompt "${savedRecord.id}"...`);
        await clearShortcut(savedRecord.id, targetCompoundId, 'aiPrompt');
        lastSavedShortcutRef.current = '';
      }

      if (wId) void StorageManager.setItem('lastUsedWorkspaceId', wId);
      if (fId) void StorageManager.setItem('lastUsedFolderId', fId);
      else void StorageManager.removeItem('lastUsedFolderId');

      setSaveStatus('saved');
      setLastSavedAt(new Date(savedRecord.updatedAt));
      return savedRecord.id;
    } catch (err) {
      console.error('Save failed:', err);
      setSaveStatus('error');
      return false;
    }
  }, [promptTitle, promptBody, promptRules, modelUrls, selectedModel, generatedUrl, workspaceId, folderId, tagIds, customModels, shortcutError, promptShortcut]);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
  const [isUnsavedChangesDialogOpen, setIsUnsavedChangesDialogOpen] = useState<boolean>(false);

  const handleDelete = useCallback(async () => {
    const currentId = activeAiPromptIdRef.current;
    if (!currentId) {
      if (onBack) onBack();
      return;
    }
    setIsDeleteDialogOpen(false);
    try {
      const wsObj = workspaceId ? { workspace_id: workspaceId } : null;
      const fldObj = folderId ? { folder_id: folderId } : null;
      const compoundId = getItemCompoundId({
        id: currentId,
        workspace_id: workspaceId || null,
        folder_id: folderId || null,
        snippet: { id: currentId, category: 'aiPrompt' }
      });
      await clearShortcut(currentId, compoundId, 'aiPrompt');
      await deleteAiPrompt(currentId);
      if (onBack) onBack();
    } catch (msg) {
      console.error('Delete failed:', msg);
    }
  }, [onBack, workspaceId, folderId]);

  const handleClose = useCallback(() => {
    if (isDirty) {
      setIsUnsavedChangesDialogOpen(true);
    } else {
      if (onBack) onBack();
    }
  }, [isDirty, onBack]);

  const loadPrompt = useCallback((promptRecord: AiPromptRecord | null) => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    setSaveStatus('idle');
    setLastSavedAt(null);

    if (!promptRecord) {
      clearDraft();
      activeAiPromptIdRef.current = null;
      setActiveAiPromptId(null);
      setPromptTitle('');
      setPromptBody('');
      setPromptRules('');
      setTagIds([]);
      setCustomModels([]);
      setModelUrls({
        gpt: 'https://chatgpt.com',
        claude: 'https://claude.ai/new',
        gemini: 'https://gemini.google.com/app',
        perplexity: 'https://www.perplexity.ai',
      });
      lastSavedTitleRef.current = '';
      lastSavedPromptRef.current = '';
      lastSavedRulesRef.current = '';
      lastSavedModelUrlsRef.current = defaultModelUrls;
      void initDefaults();
      lastSavedTagIdsRef.current = [];
      lastSavedCustomModelsRef.current = [];
      setPromptShortcut('');
      lastSavedShortcutRef.current = '';
      isShortcutManuallyEditedRef.current = false;
      hasLoadedShortcutRef.current = false;
      setIsInitialized(true);
      setIsShortcutInitialized(true);
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
    } else {
      hasLoadedShortcutRef.current = false;
      isShortcutManuallyEditedRef.current = false;
      activeAiPromptIdRef.current = promptRecord.id;
      setActiveAiPromptId(promptRecord.id);
      setPromptTitle(promptRecord.title);
      setPromptBody(promptRecord.prompt);
      setPromptRules(promptRecord.rules || '');
      setWorkspaceId(promptRecord.workspaceId);
      setFolderId(promptRecord.folderId);
      setTagIds(promptRecord.tagIds);
      setCustomModels(promptRecord.customModels || []);
      setModelUrls(promptRecord.modelUrls || {});

      lastSavedTitleRef.current = promptRecord.title;
      lastSavedPromptRef.current = promptRecord.prompt;
      lastSavedRulesRef.current = promptRecord.rules || '';
      lastSavedModelUrlsRef.current = promptRecord.modelUrls || {};
      lastSavedWorkspaceIdRef.current = promptRecord.workspaceId;
      lastSavedFolderIdRef.current = promptRecord.folderId;
      lastSavedTagIdsRef.current = promptRecord.tagIds;
      lastSavedCustomModelsRef.current = promptRecord.customModels || [];

      setIsInitialized(false);
    }
  }, []);

  // Autosave effect triggered by input changes
  useEffect(() => {
    if (!isDirty) return;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    const delay = 400;
    autosaveTimerRef.current = setTimeout(() => {
      handleSave();
    }, delay);
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [promptTitle, promptBody, promptRules, modelUrls, workspaceId, folderId, tagIds, promptShortcut, handleSave, isDirty]);

  // Sync loaded state when liveAiPrompt changes from db
  useEffect(() => {
    if (!liveAiPrompt) return;

    const fetchShortcut = async () => {
      const requestedPromptId = liveAiPrompt.id;
      try {
        const wsObj = liveAiPrompt.workspaceId ? { workspace_id: liveAiPrompt.workspaceId } : null;
        const fldObj = liveAiPrompt.folderId ? { folder_id: liveAiPrompt.folderId } : null;
        const compoundId = getItemCompoundId({
          id: liveAiPrompt.id,
          workspace_id: liveAiPrompt.workspaceId || null,
          folder_id: liveAiPrompt.folderId || null,
          snippet: { id: liveAiPrompt.id, category: 'aiPrompt' }
        });
        const shortcutsMap = await readAllShortcuts();
        const sc = resolveItemShortcut(shortcutsMap, compoundId, requestedPromptId);
        if (
          !isMounted.current ||
          activeAiPromptIdRef.current !== requestedPromptId ||
          isShortcutManuallyEditedRef.current
        ) {
          return;
        }
        if (sc) {
          setPromptShortcut(sc);
          lastSavedShortcutRef.current = sc;
        } else if (promptShortcutRef.current) {
          lastSavedShortcutRef.current = promptShortcutRef.current;
        } else {
          setPromptShortcut('');
          lastSavedShortcutRef.current = '';
        }
      } catch (err) {
        console.warn('Failed to fetch shortcut for prompt:', err);
      }
    };

    if (!isInitialized || !isDirty) {
      setPromptTitle(liveAiPrompt.title);
      setPromptBody(liveAiPrompt.prompt);
      setPromptRules(liveAiPrompt.rules || '');
      setWorkspaceId(liveAiPrompt.workspaceId);
      setFolderId(liveAiPrompt.folderId);
      setTagIds(liveAiPrompt.tagIds);
      setCustomModels(liveAiPrompt.customModels || []);
      setModelUrls(liveAiPrompt.modelUrls || {});

      lastSavedTitleRef.current = liveAiPrompt.title;
      lastSavedPromptRef.current = liveAiPrompt.prompt;
      lastSavedRulesRef.current = liveAiPrompt.rules || '';
      lastSavedModelUrlsRef.current = liveAiPrompt.modelUrls || {};
      lastSavedWorkspaceIdRef.current = liveAiPrompt.workspaceId;
      lastSavedFolderIdRef.current = liveAiPrompt.folderId;
      lastSavedTagIdsRef.current = liveAiPrompt.tagIds;
      lastSavedCustomModelsRef.current = liveAiPrompt.customModels || [];

      setLastSavedAt(new Date(liveAiPrompt.updatedAt));
      setSaveStatus('saved');
      void fetchShortcut();
      setIsInitialized(true);
    }
  }, [liveAiPrompt, isDirty, isInitialized]);

  const handlePropertiesChange = useCallback((props: any) => {
    const nextWorkspaceId = props.workspaceId !== undefined ? props.workspaceId : workspaceId;
    const nextFolderId = props.folderId !== undefined ? props.folderId : folderId;
    let nextTagIds = tagIds;

    if (props.workspaceId !== undefined && props.workspaceId !== workspaceId) {
      setWorkspaceId(props.workspaceId);
    }
    if (props.folderId !== undefined && props.folderId !== folderId) {
      setFolderId(props.folderId);
    }
    if (props.selectedTags !== undefined) {
      nextTagIds = props.selectedTags.map((t: any) => t.id);
      if ([...nextTagIds].sort().join(',') !== [...tagIds].sort().join(',')) {
        setTagIds(nextTagIds);
      }
    }

    if (activeAiPromptIdRef.current) {
      void handleSave({
        workspaceId: nextWorkspaceId,
        folderId: nextFolderId,
        tagIds: nextTagIds,
      });
    }
  }, [workspaceId, folderId, tagIds, handleSave]);

  const handleOverrideShortcut = useCallback(async () => {
    if (!promptShortcut) return;
    console.log('[ShortcutDebug][AiPromptEditor] Executing handleOverrideShortcut for promptShortcut:', promptShortcut);
    let targetId = aiPromptId || activeAiPromptId;
    if (!targetId) {
      console.log('[ShortcutDebug][AiPromptEditor] Saving new AI prompt to get real ID before shortcut reassignment...');
      await handleSave();
      targetId = aiPromptId || activeAiPromptId;
    }
    if (!targetId) return;

    if (shortcutConflictId) {
      console.log('[ShortcutDebug][AiPromptEditor] Explicitly clearing conflicting shortcut reference:', shortcutConflictId);
      await clearShortcut(shortcutConflictId, shortcutConflictId, 'aiPrompt');
    }

    const targetCompoundId = getItemCompoundId({
      id: targetId,
      workspace_id: workspaceId || null,
      folder_id: folderId || null,
      snippet: { id: targetId, category: 'aiPrompt' }
    });
    console.log(`[ShortcutDebug][AiPromptEditor] Saving shortcut "${promptShortcut}" to target ID "${targetId}" (compound: ${targetCompoundId})...`);
    await saveShortcut(targetId, targetCompoundId, promptShortcut, promptTitle || 'AI Prompt', 'aiPrompt');
    console.log('[ShortcutDebug][AiPromptEditor] Shortcut reassignment saved to DB. Clearing validation error.');
    setShortcutError(null);
    setIsShortcutOverrideable(false);
    setShortcutConflictId(null);
    await handleSave();
  }, [promptShortcut, aiPromptId, activeAiPromptId, workspaceId, folderId, promptTitle, shortcutConflictId, handleSave]);

  return {
    promptTitle,
    promptBody,
    promptRules,
    selectedModel,
    modelUrls,
    setModelUrl,
    activeAiPromptId: aiPromptId || activeAiPromptId,
    customModels,
    setCustomModels,
    promptShortcut,
    setPromptShortcut: updatePromptShortcut,
    shortcutError,
    isShortcutOverrideable,
    handleOverrideShortcut,
    isShortcutManuallyEditedRef,
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
    isInitialized: isInitialized && (aiPromptId === activeAiPromptId),
    isShortcutInitialized,
    isGenerating,
    generationError,
    generatedUrl,
    titleInputRef,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    isUnsavedChangesDialogOpen,
    setIsUnsavedChangesDialogOpen,
    setPromptTitle,
    setPromptBody,
    setPromptRules,
    setSelectedModel,
    setWorkspaceId,
    setFolderId,
    setTagIds,
    handleGenerateLink,
    handleSave,
    handleDelete,
    handleClose,
    loadPrompt,
    handlePropertiesChange,
  };
}
