
import { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import type { SetStateAction } from 'react';
import { getItemCompoundId, readAllShortcuts } from '../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { clearShortcut } from '../../../../shared-components/shortcuts';
import { saveShortcutGuarded } from '../../../../shared-components/shortcuts';
import type { ShortcutAssignmentApproval } from '../../../../shared-components/shortcuts/core/shortcutAssignmentTypes';
import { normalizeShortcutTrigger } from '../../../../shared-components/shortcuts/core/shortcutDbData';
import { createAiPrompt, updateAiPrompt, deleteAiPrompt } from './aiPromptData';
import { createTag } from '../tags/tagData';
import { useShortcutValidation } from '../../../../shared-components/shortcuts/hooks/useShortcutValidation';
import type { AiPromptRecord, CreateAiPromptInput, UpdateAiPromptInput, CustomModelConfig } from './aiPromptTypes';
import { DEFAULT_AI_PROMPT_MODEL_URLS, DEFAULT_ENABLED_AI_PROMPT_MODEL_IDS, } from './aiPromptModelHelpers';
import { useAiPrompt } from './aiPromptHooks';
import { getSmartDefaultOrganisation } from '../../../../storage/localStorage/lastUsedOrganisation';
import { StorageManager } from '../../../../storage/localStorage/storageManager';
import { migrateItemCompoundId } from '../../../../shared-components/utils/metadataMigration';
import type { SharedPropertiesToolbarProps } from '../../../../shared-components/editorToolbar/types';
export interface AiPromptEditorProps {
    aiPromptId?: string | null;
    onBack?: () => void;
    initialTitle?: string;
    initialPrompt?: string;
    initialModelUrls?: Record<string, string>;
    initialTagIds?: string[];
    onAiPromptCreated?: (prompt: AiPromptRecord) => void | Promise<void>;
    saveAiPromptAdapter?: (args: {
        mode: 'create' | 'update';
        aiPromptId?: string;
        input: CreateAiPromptInput | UpdateAiPromptInput;
    }) => Promise<AiPromptRecord>;
    propertyPersistenceAdapter?: SharedPropertiesToolbarProps['propertyPersistenceAdapter'];
}
const DRAFT_KEY = 'aiPrompt_draft';
let draftCache: {
    promptTitle: string;
    promptBody: string;
    promptRules: string;
    modelUrls: Record<string, string>;
} | null = null;
function saveDraft(title: string, body: string, rules: string, urls: Record<string, string>) {
    draftCache = { promptTitle: title, promptBody: body, promptRules: rules, modelUrls: urls };
    try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draftCache));
    }
    catch { /* quota exceeded */ }
}
function loadDraft(): {
    promptTitle?: string;
    promptBody?: string;
    promptRules?: string;
    modelUrls?: Record<string, string>;
} | null {
    if (draftCache)
        return draftCache;
    try {
        const raw = sessionStorage.getItem(DRAFT_KEY);
        return raw ? JSON.parse(raw) : null;
    }
    catch {
        return null;
    }
}
function clearDraft() {
    draftCache = null;
    try {
        sessionStorage.removeItem(DRAFT_KEY);
    }
    catch { /* ignore */ }
}
function stripHtml(html: string): string {
    if (!html)
        return '';
    return html
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim();
}
const defaultModelUrls = DEFAULT_AI_PROMPT_MODEL_URLS;
const MODEL_SELECTION_REQUIRED_MESSAGE = 'At least one model must be selected.';
function resolveItemShortcut(shortcutsMap: Record<string, string>, compoundId: string, rawId: string): string {
    let shortcut = normalizeShortcutTrigger(shortcutsMap[compoundId] || shortcutsMap[rawId] || '');
    if (!shortcut) {
        const matchingKey = Object.keys(shortcutsMap).find(key => key === rawId || key.endsWith(`-${rawId}`));
        if (matchingKey) {
            shortcut = normalizeShortcutTrigger(shortcutsMap[matchingKey] || '');
        }
    }
    return shortcut;
}
function haveSameModelIds(a: readonly string[], b: readonly string[]): boolean {
    return [...a].sort().join('\u0000') === [...b].sort().join('\u0000');
}
export function useAiPromptEditor(props: AiPromptEditorProps) {
    const { aiPromptId, onBack, initialTitle, initialPrompt, initialModelUrls, initialTagIds, onAiPromptCreated, saveAiPromptAdapter, propertyPersistenceAdapter, } = props;
    const onAiPromptCreatedRef = useRef(onAiPromptCreated);
    onAiPromptCreatedRef.current = onAiPromptCreated;
    const propertyPersistenceAdapterRef = useRef(propertyPersistenceAdapter);
    propertyPersistenceAdapterRef.current = propertyPersistenceAdapter;
    const resolvedAiPromptId = useMemo(() => {
        return (aiPromptId && aiPromptId !== 'new') ? aiPromptId : null;
    }, [aiPromptId]);
    const [activeAiPromptId, setActiveAiPromptId] = useState<string | null>(resolvedAiPromptId);
    const activeAiPromptIdRef = useRef<string | null>(resolvedAiPromptId);
    const [promptTitle, setPromptTitle] = useState<string>(initialTitle || '');
    const [promptBody, setPromptBody] = useState<string>(initialPrompt || '');
    const [promptRules, setPromptRules] = useState<string>('');
    const [selectedModel, setSelectedModel] = useState<string | null>(null);
    const [organisationId, setOrganisationId] = useState<string | null>(null);
    const [tagIds, setTagIds] = useState<string[]>(!resolvedAiPromptId && Array.isArray(initialTagIds) ? Array.from(new Set(initialTagIds)) : []);
    const [customModels, setCustomModels] = useState<CustomModelConfig[]>([]);
    const [enabledModelIds, setEnabledModelIds] = useState<string[]>(DEFAULT_ENABLED_AI_PROMPT_MODEL_IDS);
    const [modelSelectionError, setModelSelectionError] = useState<string | null>(null);
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
    const enabledModelIdsRef = useRef<string[]>(enabledModelIds);
    const hasUserEditedModelsRef = useRef<boolean>(false);
    const saveRevisionRef = useRef<number>(0);
    const latestCompletedRevisionRef = useRef<number>(0);
    const saveInFlightRef = useRef<boolean>(false);
    const pendingSaveRef = useRef<boolean>(false);
    const editorSessionRef = useRef<number>(0);
    const createPromiseRef = useRef<Promise<AiPromptRecord> | null>(null);
    const activeSavePromiseRef = useRef<Promise<string | false> | null>(null);
    useEffect(() => {
        enabledModelIdsRef.current = enabledModelIds;
    }, [enabledModelIds]);
    const toggleModelEnabled = useCallback((modelId: string) => {
        hasUserEditedModelsRef.current = true;
        setEnabledModelIds(prev => {
            if (prev.includes(modelId)) {
                const next = prev.filter(id => id !== modelId);
                if (next.length === 0) {
                    setModelSelectionError(MODEL_SELECTION_REQUIRED_MESSAGE);
                    return prev;
                }
                setModelSelectionError(null);
                return next;
            }
            setModelSelectionError(null);
            return [...prev, modelId];
        });
    }, []);
    const setEnabledModelIdsControlled = useCallback((action: SetStateAction<string[]>) => {
        hasUserEditedModelsRef.current = true;
        setEnabledModelIds(prev => {
            const next = typeof action === 'function' ? action(prev) : action;
            if (next.length === 0) {
                setModelSelectionError(MODEL_SELECTION_REQUIRED_MESSAGE);
                return prev;
            }
            setModelSelectionError(null);
            return next;
        });
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
                    organisation_id: organisationId,
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
    }, [promptShortcut, resolvedAiPromptId, activeAiPromptId, organisationId, validateShortcut]);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
    const initialMergedModelUrls = useMemo(() => ({ ...defaultModelUrls, ...(initialModelUrls || {}) }), [initialModelUrls]);
    const [modelUrls, setModelUrls] = useState<Record<string, string>>(initialMergedModelUrls);
    const setModelUrl = useCallback((modelId: string, url: string) => {
        setModelUrls(prev => ({ ...prev, [modelId]: url }));
    }, []);
    const generatingModelRef = useRef<string | null>(null);
    const isGeneratingRef = useRef(false);
    const lastSavedTitleRef = useRef<string>(initialTitle || '');
    const lastSavedPromptRef = useRef<string>(initialPrompt || '');
    const lastSavedRulesRef = useRef<string>('');
    const lastSavedModelUrlsRef = useRef<Record<string, string>>(resolvedAiPromptId ? {} : defaultModelUrls);
    const lastSavedOrganisationIdRef = useRef<string | null>(null);
    const lastSavedTagIdsRef = useRef<string[]>([]);
    const lastSavedCustomModelsRef = useRef<CustomModelConfig[]>([]);
    const lastSavedEnabledModelIdsRef = useRef<string[] | undefined>(undefined);
    const isDirtyRef = useRef(false);
    const titleInputRef = useRef<HTMLInputElement>(null);
    const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const initDefaults = useCallback(async (initialEnabledModelIds = DEFAULT_ENABLED_AI_PROMPT_MODEL_IDS) => {
        const savedWsId = await StorageManager.getItem('lastUsedOrganisationId');
        if (savedWsId) {
            setOrganisationId(savedWsId);
            lastSavedOrganisationIdRef.current = savedWsId;
        }
        else {
            const smartWs = await getSmartDefaultOrganisation();
            if (smartWs) {
                setOrganisationId(smartWs.id);
                lastSavedOrganisationIdRef.current = smartWs.id;
            }
            else {
                setOrganisationId(null);
                lastSavedOrganisationIdRef.current = null;
            }
        }
        if (!hasUserEditedModelsRef.current) {
            setEnabledModelIds(initialEnabledModelIds);
            setModelSelectionError(null);
        }
        lastSavedEnabledModelIdsRef.current = initialEnabledModelIds;
    }, []);
    // Initialize defaults for new prompt
    useEffect(() => {
        editorSessionRef.current += 1;
        createPromiseRef.current = null;
        hasUserEditedModelsRef.current = false;
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
        setModelSelectionError(null);
        setModelUrls(initialMergedModelUrls);
        const initTagIds = !resolvedAiPromptId && Array.isArray(initialTagIds) ? Array.from(new Set(initialTagIds)) : [];
        setTagIds(initTagIds);
        setCustomModels([]);
        const initialEnabledModelIds = Array.from(new Set([
            ...DEFAULT_ENABLED_AI_PROMPT_MODEL_IDS,
            ...Object.keys(initialModelUrls || {}).filter(modelId => Boolean(initialModelUrls?.[modelId]))
        ]));
        void initDefaults(initialEnabledModelIds);
        setEnabledModelIds(initialEnabledModelIds);
        lastSavedTitleRef.current = initialTitle || '';
        lastSavedPromptRef.current = initialPrompt || '';
        lastSavedRulesRef.current = '';
        lastSavedModelUrlsRef.current = initialMergedModelUrls;
        lastSavedOrganisationIdRef.current = null;
        lastSavedTagIdsRef.current = initTagIds;
        lastSavedCustomModelsRef.current = [];
        lastSavedEnabledModelIdsRef.current = initialEnabledModelIds;
        lastSavedShortcutRef.current = '';
        isShortcutManuallyEditedRef.current = false;
        setPromptShortcut('');
        setSaveStatus('idle');
        setIsInitialized(true);
        setIsShortcutInitialized(true);
        // Restore previous draft from sessionStorage if available
        const draft = loadDraft();
        if (draft) {
            if (draft.promptTitle)
                setPromptTitle(draft.promptTitle);
            if (draft.promptBody)
                setPromptBody(draft.promptBody);
            if (draft.promptRules)
                setPromptRules(draft.promptRules);
            if (draft.modelUrls && !initialModelUrls)
                setModelUrls(draft.modelUrls);
        }
    }, [resolvedAiPromptId, initialTitle, initialPrompt, initialModelUrls, initialMergedModelUrls, initDefaults]);
    // Load existing record
    const liveAiPrompt = useAiPrompt(activeAiPromptId);
    const isDirty = useMemo(() => {
        if (!isInitialized || !isShortcutInitialized)
            return false;
        const titleChanged = promptTitle !== lastSavedTitleRef.current;
        const promptChanged = promptBody !== lastSavedPromptRef.current;
        const rulesChanged = promptRules !== lastSavedRulesRef.current;
        const modelUrlsChanged = JSON.stringify(modelUrls) !== JSON.stringify(lastSavedModelUrlsRef.current);
        const organisationChanged = organisationId !== lastSavedOrganisationIdRef.current;
        const tagsChanged = tagIds.join(',') !== lastSavedTagIdsRef.current.join(',');
        const customModelsChanged = JSON.stringify(customModels) !== JSON.stringify(lastSavedCustomModelsRef.current);
        const enabledModelsChanged = !haveSameModelIds(enabledModelIds, lastSavedEnabledModelIdsRef.current || []);
        const shortcutChanged = isShortcutInitialized && promptShortcut !== lastSavedShortcutRef.current;
        return titleChanged || promptChanged || rulesChanged || modelUrlsChanged || organisationChanged || tagsChanged || customModelsChanged || enabledModelsChanged || shortcutChanged;
    }, [promptTitle, promptBody, promptRules, modelUrls, organisationId, tagIds, customModels, enabledModelIds, promptShortcut, isInitialized, isShortcutInitialized]);
    isDirtyRef.current = isDirty;
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
                    const wsObj = organisationId ? { organisation_id: organisationId } : null;
                    const targetCompoundId = getItemCompoundId({
                        id: activeAiPromptId,
                        organisation_id: wsObj?.organisation_id,
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
                }
                catch (err) {
                    console.error('Failed to load shortcut:', err);
                    if (isMounted.current && !cancelled) {
                        setIsShortcutInitialized(true);
                    }
                }
            };
            void loadSavedShortcut();
        }
        else {
            setPromptShortcut('');
            lastSavedShortcutRef.current = '';
            setIsShortcutInitialized(true);
        }
        return () => {
            cancelled = true;
        };
    }, [activeAiPromptId, organisationId]);
    useEffect(() => {
        if (!liveAiPrompt)
            return;
        if (!isInitialized) {
            setPromptTitle(liveAiPrompt.title);
            setPromptBody(liveAiPrompt.prompt);
            setPromptRules(liveAiPrompt.rules || '');
            if (liveAiPrompt.modelUrls) {
                setModelUrls(liveAiPrompt.modelUrls);
            }
            setOrganisationId(liveAiPrompt.organisationId);
            setTagIds(liveAiPrompt.tagIds);
            if (liveAiPrompt.customModels) {
                setCustomModels(liveAiPrompt.customModels);
            }
            else {
                setCustomModels([]);
            }
            let loadedEnabledModelIds: string[];
            if (liveAiPrompt.enabledModelIds !== undefined) {
                loadedEnabledModelIds = liveAiPrompt.enabledModelIds;
            }
            else {
                StorageManager.getItem('aiPrompt_excludedModels').then((stored: any) => {
                    let excludedList: string[] = [];
                    try {
                        if (Array.isArray(stored))
                            excludedList = stored.map(String);
                        else if (typeof stored === 'string')
                            excludedList = JSON.parse(stored);
                    }
                    catch { /* ignore */ }
                    const allPromptModels = ['gpt', 'claude', 'gemini', 'perplexity', ...(liveAiPrompt.customModels || []).map(m => m.id)];
                    const derived = allPromptModels.filter(id => !excludedList.includes(id));
                    if (!hasUserEditedModelsRef.current) {
                        setEnabledModelIds(derived);
                    }
                    lastSavedEnabledModelIdsRef.current = derived;
                });
                loadedEnabledModelIds = ['gpt', 'claude', 'gemini', 'perplexity', ...(liveAiPrompt.customModels || []).map(m => m.id)];
            }
            if (!hasUserEditedModelsRef.current) {
                setEnabledModelIds(loadedEnabledModelIds);
            }
            lastSavedTitleRef.current = liveAiPrompt.title;
            lastSavedPromptRef.current = liveAiPrompt.prompt;
            lastSavedRulesRef.current = liveAiPrompt.rules || '';
            lastSavedModelUrlsRef.current = liveAiPrompt.modelUrls || {};
            lastSavedOrganisationIdRef.current = liveAiPrompt.organisationId;
            lastSavedTagIdsRef.current = liveAiPrompt.tagIds;
            lastSavedCustomModelsRef.current = liveAiPrompt.customModels || [];
            lastSavedEnabledModelIdsRef.current = loadedEnabledModelIds;
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
        if (ids.length === 0 || !cleanPrompt.trim())
            return;
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
                if (mId.includes('claude'))
                    kind = 'claude';
                else if (mId.includes('gemini'))
                    kind = 'gemini';
                else if (mId.includes('perplexity'))
                    kind = 'perplexity';
                const response = await new Promise<any>((resolve, reject) => {
                    chrome.runtime.sendMessage({
                        action: 'open_tab_with_auto_submit',
                        url: targetUrl,
                        autoSubmit: { kind, prompt: cleanPrompt },
                        forceNewTab: true,
                        active: true,
                    }, res => {
                        if (chrome.runtime.lastError)
                            reject(chrome.runtime.lastError);
                        else
                            resolve(res);
                    });
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
                    aiPromptId: activeAiPromptIdRef.current,
                });
            }
            setTimeout(() => {
                if (isGeneratingRef.current) {
                    setIsGenerating(false);
                    isGeneratingRef.current = false;
                    generatingModelRef.current = null;
                }
            }, 120000);
        }
        catch (err) {
            setIsGenerating(false);
            isGeneratingRef.current = false;
            generatingModelRef.current = null;
            setGenerationError('Failed to trigger AI. Please try again.');
        }
    }, [promptBody, promptRules, modelUrls]);
    const handleSave = useCallback(async (overrides?: {
        organisationId?: string | null;
        tagIds?: string[];
        shortcut?: string;
        textCommandApproval?: ShortcutAssignmentApproval;
    }): Promise<string | false> => {
        if (activeSavePromiseRef.current) {
            if (overrides?.textCommandApproval) {
                await activeSavePromiseRef.current;
                return handleSave(overrides);
            }
            pendingSaveRef.current = true;
            const result = await activeSavePromiseRef.current;
            if (activeAiPromptIdRef.current) {
                return activeAiPromptIdRef.current;
            }
            return result;
        }
        const currentSession = editorSessionRef.current;
        const currentPromptId = activeAiPromptIdRef.current;
        const saveRevision = ++saveRevisionRef.current;
        const snapshot = {
            title: promptTitle,
            prompt: promptBody,
            rules: promptRules,
            modelUrls: { ...modelUrls },
            organisationId: overrides?.organisationId !== undefined ? overrides.organisationId : organisationId,
            tagIds: overrides?.tagIds !== undefined ? [...overrides.tagIds] : [...tagIds],
            customModels: [...customModels],
            enabledModelIds: [...enabledModelIds],
            shortcut: overrides?.shortcut !== undefined ? overrides.shortcut : promptShortcut,
        };
        if (shortcutError && !overrides?.textCommandApproval) {
            setSaveStatus('error');
            return false;
        }
        if (snapshot.enabledModelIds.length === 0) {
            setModelSelectionError(MODEL_SELECTION_REQUIRED_MESSAGE);
            setSaveStatus('error');
            return false;
        }
        if (!snapshot.title.trim()) {
            return false;
        }
        if (!snapshot.title.trim() && !snapshot.prompt.trim()) {
            return false;
        }
        const runSaveTask = async (): Promise<string | false> => {
            saveInFlightRef.current = true;
            pendingSaveRef.current = false;
            setSaveStatus('saving');
            try {
                // Convert any temp tags into real tags before saving
                const finalOrganisationId = snapshot.organisationId || (await getSmartDefaultOrganisation())?.id;
                if (finalOrganisationId) {
                    const resolvedTagIds: string[] = [];
                    for (const tId of snapshot.tagIds) {
                        if (tId.startsWith('temp_')) {
                            const tagName = tId.replace('temp_', '');
                            try {
                                const newTag = propertyPersistenceAdapterRef.current?.createTag
                                    ? await propertyPersistenceAdapterRef.current.createTag({ name: tagName })
                                    : await createTag(tagName);
                                resolvedTagIds.push(newTag.id);
                            }
                            catch (e) {
                                console.error('Failed to create temp tag', e);
                                resolvedTagIds.push(tId);
                            }
                        }
                        else {
                            resolvedTagIds.push(tId);
                        }
                    }
                    snapshot.tagIds = resolvedTagIds;
                }
                let savedRecord: AiPromptRecord;
                if (currentPromptId) {
                    const input: UpdateAiPromptInput = {
                        organisationId: snapshot.organisationId,
                        title: snapshot.title || 'AI Generated Link',
                        prompt: snapshot.prompt,
                        rules: snapshot.rules,
                        modelUrls: snapshot.modelUrls,
                        tagIds: snapshot.tagIds,
                        customModels: snapshot.customModels,
                        enabledModelIds: snapshot.enabledModelIds,
                    };
                    savedRecord = saveAiPromptAdapter
                        ? await saveAiPromptAdapter({ mode: 'update', aiPromptId: currentPromptId, input })
                        : await updateAiPrompt(currentPromptId, input);
                }
                else {
                    const input: CreateAiPromptInput = {
                        organisationId: snapshot.organisationId,
                        title: snapshot.title || 'AI Generated Link',
                        prompt: snapshot.prompt,
                        rules: snapshot.rules,
                        modelUrls: snapshot.modelUrls,
                        tagIds: snapshot.tagIds,
                        customModels: snapshot.customModels,
                        enabledModelIds: snapshot.enabledModelIds,
                    };
                    if (!createPromiseRef.current) {
                        createPromiseRef.current = saveAiPromptAdapter
                            ? saveAiPromptAdapter({ mode: 'create', input })
                            : createAiPrompt(input);
                    }
                    try {
                        savedRecord = await createPromiseRef.current;
                        if (onAiPromptCreatedRef.current) {
                            try {
                                await onAiPromptCreatedRef.current(savedRecord);
                            }
                            catch (err) {
                                console.error('[useAiPromptEditor] onAiPromptCreated callback failed:', err);
                            }
                        }
                    }
                    finally {
                        createPromiseRef.current = null;
                    }
                }
                if (!isMounted.current || editorSessionRef.current !== currentSession) {
                    // Editor session switched or unmounted during async save
                    saveInFlightRef.current = false;
                    return savedRecord.id;
                }
                if (currentPromptId !== null && activeAiPromptIdRef.current !== currentPromptId) {
                    // Switched away from existing prompt while saving
                    saveInFlightRef.current = false;
                    return savedRecord.id;
                }
                if (currentPromptId === null && activeAiPromptIdRef.current !== null) {
                    // Another creation or prompt switch established a different identity
                    saveInFlightRef.current = false;
                    return savedRecord.id;
                }
                activeAiPromptIdRef.current = savedRecord.id;
                setActiveAiPromptId(savedRecord.id);
                const isLatestRevision = saveRevision >= latestCompletedRevisionRef.current;
                if (isLatestRevision) {
                    latestCompletedRevisionRef.current = saveRevision;
                    setOrganisationId(savedRecord.organisationId);
                    setTagIds(savedRecord.tagIds);
                    if (savedRecord.customModels) {
                        setCustomModels(savedRecord.customModels);
                    }
                    const modelSelectionIsStillCurrent = haveSameModelIds(enabledModelIdsRef.current, snapshot.enabledModelIds);
                    if (modelSelectionIsStillCurrent && savedRecord.enabledModelIds !== undefined) {
                        setEnabledModelIds(savedRecord.enabledModelIds);
                    }
                }
                const oldWsId = lastSavedOrganisationIdRef.current;
                clearDraft();
                lastSavedTitleRef.current = savedRecord.title;
                lastSavedPromptRef.current = savedRecord.prompt;
                lastSavedRulesRef.current = savedRecord.rules || '';
                lastSavedModelUrlsRef.current = savedRecord.modelUrls || {};
                lastSavedOrganisationIdRef.current = savedRecord.organisationId;
                lastSavedTagIdsRef.current = savedRecord.tagIds;
                lastSavedCustomModelsRef.current = savedRecord.customModels || [];
                lastSavedEnabledModelIdsRef.current = savedRecord.enabledModelIds;
                const wId = savedRecord.organisationId;
                const targetCompoundId = getItemCompoundId({
                    id: savedRecord.id,
                    organisation_id: wId,
                    snippet: { id: savedRecord.id, category: 'aiPrompt' }
                });
                if (currentPromptId) {
                    const oldWsObj = oldWsId ? { organisation_id: oldWsId } : null;
                    const oldCompoundId = getItemCompoundId({
                        id: currentPromptId,
                        organisation_id: oldWsObj?.organisation_id,
                        snippet: { id: currentPromptId, category: 'aiPrompt' }
                    });
                    if (oldCompoundId && targetCompoundId && oldCompoundId !== targetCompoundId) {
                        await migrateItemCompoundId(oldCompoundId, targetCompoundId, 'aiPrompt');
                    }
                }
                const finalShortcut = snapshot.shortcut.toLowerCase().replace(/[^a-z0-9_]/g, '');
                if (finalShortcut) {
                    const valRes = await validateShortcut(finalShortcut, savedRecord.id);
                    if (valRes.isValid || overrides?.textCommandApproval) {
                        console.log(`[ShortcutDebug][AiPromptEditor] handleSave: Valid shortcut "${finalShortcut}", saving to DB for prompt "${savedRecord.id}"...`);
                        if (propertyPersistenceAdapterRef.current?.saveShortcut) {
                            await propertyPersistenceAdapterRef.current.saveShortcut({
                                id: savedRecord.id,
                                referenceId: targetCompoundId,
                                shortcut: finalShortcut,
                                label: savedRecord.title,
                                type: 'aiPrompt',
                                approval: overrides?.textCommandApproval,
                            });
                        }
                        else {
                            await saveShortcutGuarded(targetCompoundId, finalShortcut, 'aiPrompt', overrides?.textCommandApproval);
                        }
                    }
                    else {
                        console.warn(`[ShortcutDebug][AiPromptEditor] handleSave: Shortcut "${finalShortcut}" has validation error "${valRes.errorMessage}". SKIPPING DB save on background autosave.`);
                    }
                    lastSavedShortcutRef.current = finalShortcut;
                }
                else if (lastSavedShortcutRef.current !== '') {
                    console.log(`[ShortcutDebug][AiPromptEditor] handleSave: Clearing shortcut for prompt "${savedRecord.id}"...`);
                    if (propertyPersistenceAdapterRef.current?.clearShortcut) {
                        await propertyPersistenceAdapterRef.current.clearShortcut({
                            id: savedRecord.id,
                            referenceId: targetCompoundId,
                            type: 'aiPrompt',
                        });
                    }
                    else {
                        await clearShortcut(savedRecord.id, targetCompoundId, 'aiPrompt');
                    }
                    lastSavedShortcutRef.current = '';
                }
                if (wId)
                    void StorageManager.setItem('lastUsedOrganisationId', wId);
                if (isLatestRevision) {
                    setSaveStatus('saved');
                    setLastSavedAt(new Date(savedRecord.updatedAt));
                }
                return savedRecord.id;
            }
            catch (err) {
                console.error('Save failed:', err);
                setSaveStatus('error');
                return false;
            }
            finally {
                saveInFlightRef.current = false;
                if (pendingSaveRef.current) {
                    pendingSaveRef.current = false;
                    setTimeout(() => {
                        void handleSaveRef.current();
                    }, 0);
                }
            }
        };
        activeSavePromiseRef.current = runSaveTask();
        try {
            return await activeSavePromiseRef.current;
        }
        finally {
            activeSavePromiseRef.current = null;
        }
    }, [promptTitle, promptBody, promptRules, modelUrls, selectedModel, generatedUrl, organisationId, tagIds, customModels, enabledModelIds, shortcutError, promptShortcut, validateShortcut, saveAiPromptAdapter]);
    const handleSaveRef = useRef(handleSave);
    useEffect(() => {
        handleSaveRef.current = handleSave;
    }, [handleSave]);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);
    const [isUnsavedChangesDialogOpen, setIsUnsavedChangesDialogOpen] = useState<boolean>(false);
    const handleDelete = useCallback(async () => {
        const currentId = activeAiPromptIdRef.current;
        if (!currentId) {
            if (onBack)
                onBack();
            return;
        }
        setIsDeleteDialogOpen(false);
        try {
            const compoundId = getItemCompoundId({
                id: currentId,
                organisation_id: organisationId,
                snippet: { id: currentId, category: 'aiPrompt' }
            });
            await clearShortcut(currentId, compoundId, 'aiPrompt');
            await deleteAiPrompt(currentId);
            if (onBack)
                onBack();
        }
        catch (msg) {
            console.error('Delete failed:', msg);
        }
    }, [onBack, organisationId]);
    const handleClose = useCallback(() => {
        if (isDirty) {
            setIsUnsavedChangesDialogOpen(true);
        }
        else {
            if (onBack)
                onBack();
        }
    }, [isDirty, onBack]);
    const loadPrompt = useCallback((promptRecord: AiPromptRecord | null) => {
        editorSessionRef.current += 1;
        createPromiseRef.current = null;
        hasUserEditedModelsRef.current = false;
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
            const initTagIds = !resolvedAiPromptId && Array.isArray(initialTagIds) ? Array.from(new Set(initialTagIds)) : [];
            setTagIds(initTagIds);
            setCustomModels([]);
            setEnabledModelIds(DEFAULT_ENABLED_AI_PROMPT_MODEL_IDS);
            setModelSelectionError(null);
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
            lastSavedTagIdsRef.current = initTagIds;
            lastSavedCustomModelsRef.current = [];
            lastSavedEnabledModelIdsRef.current = DEFAULT_ENABLED_AI_PROMPT_MODEL_IDS;
            setPromptShortcut('');
            lastSavedShortcutRef.current = '';
            isShortcutManuallyEditedRef.current = false;
            hasLoadedShortcutRef.current = false;
            setIsInitialized(true);
            setIsShortcutInitialized(true);
            setTimeout(() => {
                titleInputRef.current?.focus();
            }, 50);
        }
        else {
            hasLoadedShortcutRef.current = false;
            isShortcutManuallyEditedRef.current = false;
            activeAiPromptIdRef.current = promptRecord.id;
            setActiveAiPromptId(promptRecord.id);
            setPromptTitle(promptRecord.title);
            setPromptBody(promptRecord.prompt);
            setPromptRules(promptRecord.rules || '');
            setOrganisationId(promptRecord.organisationId);
            setTagIds(promptRecord.tagIds);
            setCustomModels(promptRecord.customModels || []);
            setModelUrls(promptRecord.modelUrls || {});
            lastSavedTitleRef.current = promptRecord.title;
            lastSavedPromptRef.current = promptRecord.prompt;
            lastSavedRulesRef.current = promptRecord.rules || '';
            lastSavedModelUrlsRef.current = promptRecord.modelUrls || {};
            lastSavedOrganisationIdRef.current = promptRecord.organisationId;
            lastSavedTagIdsRef.current = promptRecord.tagIds;
            lastSavedCustomModelsRef.current = promptRecord.customModels || [];
            setIsInitialized(false);
        }
    }, [initDefaults]);
    const autosaveSignature = useMemo(() => JSON.stringify({
        promptTitle,
        promptBody,
        promptRules,
        modelUrls,
        organisationId,
        tagIds,
        customModels,
        enabledModelIds,
        promptShortcut,
    }), [
        promptTitle,
        promptBody,
        promptRules,
        modelUrls,
        organisationId,
        tagIds,
        customModels,
        enabledModelIds,
        promptShortcut
    ]);
    // Autosave effect triggered by input changes
    useEffect(() => {
        if (!isDirty)
            return;
        if (autosaveTimerRef.current) {
            clearTimeout(autosaveTimerRef.current);
        }
        const delay = 400;
        autosaveTimerRef.current = setTimeout(() => {
            void handleSaveRef.current();
        }, delay);
        return () => {
            if (autosaveTimerRef.current) {
                clearTimeout(autosaveTimerRef.current);
            }
        };
    }, [autosaveSignature, isDirty]);
    useEffect(() => {
        return () => {
            if (autosaveTimerRef.current) {
                clearTimeout(autosaveTimerRef.current);
                autosaveTimerRef.current = null;
            }
            if (isDirtyRef.current) {
                void handleSaveRef.current();
            }
        };
    }, []);
    // Sync loaded state when liveAiPrompt changes from db
    useEffect(() => {
        if (!liveAiPrompt)
            return;
        const fetchShortcut = async () => {
            const requestedPromptId = liveAiPrompt.id;
            try {
                const compoundId = getItemCompoundId({
                    id: liveAiPrompt.id,
                    organisation_id: liveAiPrompt.organisationId,
                    snippet: { id: liveAiPrompt.id, category: 'aiPrompt' }
                });
                const shortcutsMap = await readAllShortcuts();
                const sc = resolveItemShortcut(shortcutsMap, compoundId, requestedPromptId);
                if (!isMounted.current ||
                    activeAiPromptIdRef.current !== requestedPromptId ||
                    isShortcutManuallyEditedRef.current) {
                    return;
                }
                if (sc) {
                    setPromptShortcut(sc);
                    lastSavedShortcutRef.current = sc;
                }
                else if (promptShortcutRef.current) {
                    lastSavedShortcutRef.current = promptShortcutRef.current;
                }
                else {
                    setPromptShortcut('');
                    lastSavedShortcutRef.current = '';
                }
            }
            catch (err) {
                console.warn('Failed to fetch shortcut for prompt:', err);
            }
        };
        if (!isInitialized || !isDirty) {
            setPromptTitle(liveAiPrompt.title);
            setPromptBody(liveAiPrompt.prompt);
            setPromptRules(liveAiPrompt.rules || '');
            setOrganisationId(liveAiPrompt.organisationId);
            setTagIds(liveAiPrompt.tagIds);
            setCustomModels(liveAiPrompt.customModels || []);
            setModelUrls(liveAiPrompt.modelUrls || {});
            let loadedEnabledModelIds: string[];
            if (liveAiPrompt.enabledModelIds !== undefined) {
                loadedEnabledModelIds = liveAiPrompt.enabledModelIds;
            }
            else {
                loadedEnabledModelIds = ['gpt', 'claude', 'gemini', 'perplexity', ...(liveAiPrompt.customModels || []).map(m => m.id)];
            }
            const modelMatchesSaved = haveSameModelIds(enabledModelIdsRef.current, lastSavedEnabledModelIdsRef.current || []);
            if (!hasUserEditedModelsRef.current || modelMatchesSaved) {
                setEnabledModelIds(loadedEnabledModelIds);
            }
            lastSavedTitleRef.current = liveAiPrompt.title;
            lastSavedPromptRef.current = liveAiPrompt.prompt;
            lastSavedRulesRef.current = liveAiPrompt.rules || '';
            lastSavedModelUrlsRef.current = liveAiPrompt.modelUrls || {};
            lastSavedOrganisationIdRef.current = liveAiPrompt.organisationId;
            lastSavedTagIdsRef.current = liveAiPrompt.tagIds;
            lastSavedCustomModelsRef.current = liveAiPrompt.customModels || [];
            lastSavedEnabledModelIdsRef.current = loadedEnabledModelIds;
            setLastSavedAt(new Date(liveAiPrompt.updatedAt));
            setSaveStatus('saved');
            void fetchShortcut();
            setIsInitialized(true);
        }
    }, [liveAiPrompt, isDirty, isInitialized]);
    const handlePropertiesChange = useCallback((props: any) => {
        const nextOrganisationId = props.organisationId !== undefined ? props.organisationId : organisationId;
        let nextTagIds = tagIds;
        if (props.organisationId !== undefined && props.organisationId !== organisationId) {
            setOrganisationId(props.organisationId);
        }
        if (props.selectedTags !== undefined) {
            nextTagIds = props.selectedTags.map((t: any) => t.id);
            if (nextTagIds.join(',') !== tagIds.join(',')) {
                setTagIds(nextTagIds);
            }
        }
        let nextShortcut = promptShortcut;
        if (props.pendingShortcut !== undefined) {
            const normSc = (props.pendingShortcut || '').toLowerCase().trim();
            nextShortcut = normSc;
            setPromptShortcut(normSc);
        }
        void handleSave({
            organisationId: nextOrganisationId,
            tagIds: nextTagIds,
            shortcut: nextShortcut,
        });
    }, [organisationId, tagIds, handleSave]);
    const handleResolveShortcut = useCallback(async (approval: ShortcutAssignmentApproval) => {
        const saved = await handleSave({ shortcut: promptShortcut, textCommandApproval: approval });
        if (!saved)
            throw new Error('Could not assign this command. Check the required fields and review the current owners.');
        setShortcutError(null);
        setIsShortcutOverrideable(false);
        setShortcutConflictId(null);
    }, [promptShortcut, handleSave]);
    const flushSave = useCallback(async () => {
        const refreshDirtyRef = () => {
            isDirtyRef.current =
                promptTitle !== lastSavedTitleRef.current ||
                    promptBody !== lastSavedPromptRef.current ||
                    promptRules !== lastSavedRulesRef.current ||
                    JSON.stringify(modelUrls) !== JSON.stringify(lastSavedModelUrlsRef.current) ||
                    organisationId !== lastSavedOrganisationIdRef.current
                    ||
                        tagIds.join(',') !== lastSavedTagIdsRef.current.join(',') ||
                    JSON.stringify(customModels) !== JSON.stringify(lastSavedCustomModelsRef.current) ||
                    !haveSameModelIds(enabledModelIds, lastSavedEnabledModelIdsRef.current || []) ||
                    promptShortcut !== lastSavedShortcutRef.current;
        };
        while (activeSavePromiseRef.current || isDirtyRef.current) {
            if (activeSavePromiseRef.current) {
                await activeSavePromiseRef.current;
                refreshDirtyRef();
            }
            if (isDirtyRef.current) {
                const saved = await handleSave();
                refreshDirtyRef();
                if (!saved)
                    return false;
            }
        }
        return !isDirtyRef.current;
    }, [customModels, enabledModelIds, handleSave, modelUrls, promptBody, promptRules, promptShortcut, promptTitle, tagIds, organisationId]);
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
        enabledModelIds,
        setEnabledModelIds,
        toggleModelEnabled,
        modelSelectionError,
        promptShortcut,
        setPromptShortcut: updatePromptShortcut,
        shortcutError,
        isShortcutOverrideable,
        handleResolveShortcut,
        isShortcutManuallyEditedRef,
        organisationId,
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
        setOrganisationId,
        setTagIds,
        handleGenerateLink,
        handleSave,
        flushSave,
        handleDelete,
        handleClose,
        loadPrompt,
        handlePropertiesChange,
    };
}
