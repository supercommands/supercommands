
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createChatAgent, updateChatAgent, deleteChatAgent } from './chatAgentData';
import type { ChatAgentRecord, CreateChatAgentInput, UpdateChatAgentInput } from './chatAgentTypes';
import { useChatAgent } from './chatAgentHooks';
import { getSmartDefaultOrganisation } from '../../../../storage/localStorage/lastUsedOrganisation';
import { StorageManager } from '../../../../storage/localStorage/storageManager';
import { getItemCompoundId } from '../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { migrateItemCompoundId } from '../../../../shared-components/utils/metadataMigration';
export interface ChatAgentEditorProps {
    agentId?: string | null;
    onBack?: () => void;
    initialName?: string;
    initialUrls?: string[];
}
export function useChatAgentEditor(props: ChatAgentEditorProps) {
    const { agentId, onBack, initialName, initialUrls } = props;
    const [activeAgentId, setActiveAgentId] = useState<string | null>(agentId ?? null);
    const activeAgentIdRef = useRef<string | null>(agentId ?? null);
    const [agentTitle, setAgentTitle] = useState<string>(initialName || '');
    const [agentUrls, setAgentUrls] = useState<string[]>(initialUrls || []);
    const [organisationId, setOrganisationId] = useState<string | null>(null);
    const [tagIds, setTagIds] = useState<string[]>([]);
    const [isInitialized, setIsInitialized] = useState<boolean>(!agentId);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
    // We still track original saved state to compute `isDirty` if the user tries to exit without saving.
    const lastSavedTitleRef = useRef<string>(initialName || '');
    const lastSavedUrlsRef = useRef<string[]>(initialUrls || []);
    const lastSavedOrganisationIdRef = useRef<string | null>(null);
    const lastSavedTagIdsRef = useRef<string[]>([]);
    // Sync when parent updates models/urls (e.g., from ModelSelector)
    useEffect(() => {
        if (initialUrls) {
            setAgentUrls(prev => {
                const prevSorted = [...prev].sort().join(',');
                const newSorted = [...initialUrls].sort().join(',');
                return prevSorted !== newSorted ? initialUrls : prev;
            });
        }
    }, [initialUrls]);
    const liveAgent = useChatAgent(activeAgentId);
    const isDirty = useMemo(() => {
        const titleChanged = agentTitle !== lastSavedTitleRef.current;
        const currentUrlsSorted = [...agentUrls].sort().join(',');
        const savedUrlsSorted = [...lastSavedUrlsRef.current].sort().join(',');
        const urlsChanged = currentUrlsSorted !== savedUrlsSorted;
        const organisationChanged = organisationId !== lastSavedOrganisationIdRef.current;
        const tagsChanged = [...tagIds].sort().join(',') !== [...lastSavedTagIdsRef.current].sort().join(',');
        return titleChanged || urlsChanged || organisationChanged || tagsChanged;
    }, [agentTitle, agentUrls, organisationId, tagIds]);
    // Update from live query if not dirty
    useEffect(() => {
        if (!liveAgent)
            return;
        if (!isInitialized || !isDirty) {
            setAgentTitle(liveAgent.title);
            setAgentUrls(liveAgent.urls);
            setOrganisationId(liveAgent.organisationId);
            setTagIds(liveAgent.tagIds);
            lastSavedTitleRef.current = liveAgent.title;
            lastSavedUrlsRef.current = liveAgent.urls;
            lastSavedOrganisationIdRef.current = liveAgent.organisationId;
            lastSavedTagIdsRef.current = liveAgent.tagIds;
            setLastSavedAt(new Date(liveAgent.updatedAt));
            setSaveStatus('saved');
            setIsInitialized(true);
        }
    }, [liveAgent, isDirty, isInitialized]);
    // MANUAL Save Trigger - no debounce or autosave!
    const handleSave = useCallback(async (targetOrganisationId?: string, targetTagIds?: string[]): Promise<string | null> => {
        // Resolve destinations
        const finalWsId = targetOrganisationId !== undefined ? targetOrganisationId : organisationId;
        const finalTagIds = targetTagIds !== undefined ? targetTagIds : tagIds;
        const currentAgentId = activeAgentIdRef.current;
        setSaveStatus('saving');
        try {
            let savedAgent: ChatAgentRecord;
            if (!currentAgentId) {
                // Create
                const input: CreateChatAgentInput = {
                    organisationId: finalWsId,
                    title: agentTitle,
                    urls: agentUrls,
                    tagIds: finalTagIds,
                };
                savedAgent = await createChatAgent(input);
                activeAgentIdRef.current = savedAgent.id;
                setActiveAgentId(savedAgent.id);
            }
            else {
                // Update
                const input: UpdateChatAgentInput = {
                    organisationId: finalWsId,
                    title: agentTitle,
                    urls: agentUrls,
                    tagIds: finalTagIds,
                };
                savedAgent = await updateChatAgent(currentAgentId, input);
                const oldWsObj = lastSavedOrganisationIdRef.current ? { organisation_id: lastSavedOrganisationIdRef.current } : null;
                const oldCompoundId = getItemCompoundId({
                    id: currentAgentId,
                    organisation_id: oldWsObj?.organisation_id,
                    snippet: { id: currentAgentId, category: 'agent' }
                });
                const newWsObj = savedAgent.organisationId ? { organisation_id: savedAgent.organisationId } : null;
                const newCompoundId = getItemCompoundId({
                    id: savedAgent.id,
                    organisation_id: newWsObj?.organisation_id,
                    snippet: { id: savedAgent.id, category: 'agent' }
                });
                if (oldCompoundId && newCompoundId && oldCompoundId !== newCompoundId) {
                    await migrateItemCompoundId(oldCompoundId, newCompoundId, 'agent');
                }
            }
            // Sync state back
            setOrganisationId(savedAgent.organisationId);
            setTagIds(savedAgent.tagIds);
            setAgentTitle(savedAgent.title);
            setAgentUrls(savedAgent.urls);
            lastSavedTitleRef.current = savedAgent.title;
            lastSavedUrlsRef.current = savedAgent.urls;
            lastSavedOrganisationIdRef.current = savedAgent.organisationId;
            lastSavedTagIdsRef.current = savedAgent.tagIds;
            const wId = savedAgent.organisationId;
            if (wId)
                void StorageManager.setItem('lastUsedOrganisationId', wId);
            setSaveStatus('saved');
            setLastSavedAt(new Date(savedAgent.updatedAt));
            return savedAgent.id;
        }
        catch (err) {
            console.error('Save failed:', err);
            setSaveStatus('error');
            return null;
        }
    }, [agentTitle, agentUrls, organisationId, tagIds]);
    const handleDelete = useCallback(async () => {
        const currentId = activeAgentIdRef.current;
        if (!currentId) {
            if (onBack)
                onBack();
            return;
        }
        try {
            await deleteChatAgent(currentId);
            if (onBack)
                onBack();
        }
        catch (msg) {
            console.error('Delete failed:', msg);
        }
    }, [onBack]);
    return {
        activeAgentId,
        liveAgent,
        agentTitle,
        agentUrls,
        organisationId,
        tagIds,
        saveStatus,
        lastSavedAt,
        isDirty,
        setAgentTitle,
        setAgentUrls,
        setOrganisationId,
        setTagIds,
        handleSave,
        handleDelete,
    };
}
