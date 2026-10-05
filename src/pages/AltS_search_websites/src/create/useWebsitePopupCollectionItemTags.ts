/** Collection tag draft adapter; item writes remain owned by the existing autosave hook. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { TagRecord } from '../../../../allObjectFolder/src/createObject/tags/tagTypes';
import type { WebsitePopupSearchSnapshot } from '../../../../shared-components/websitePopup/contracts/websitePopupSearchBridgeContract';
import type { WebsitePopupCreateSelectedValue } from '../interaction/websitePopupInteractionTypes';
import type { WebsitePopupResultIntent } from '../results/websitePopupResultsTypes';
import { removeLastWebsitePopupMultiSelectValue, toggleWebsitePopupMultiSelectValue } from '../interaction/websitePopupMultiSelectController';
import { createWebsitePopupTag } from '../bridge/websitePopupCreateOptionsBridge';
import { buildWebsitePopupCollectionTagSections, WEBSITE_POPUP_COLLECTION_TAG_FIELD } from './WebsitePopupCollectionTagPicker';
import { toWebsitePopupTagSelection } from './websitePopupTagCatalog';

export function useWebsitePopupCollectionItemTags({ snapshot, organisationId, scopeKey, active, tagIds, onChange }: {
    snapshot: WebsitePopupSearchSnapshot;
    organisationId: string | null;
    scopeKey: string;
    active: boolean;
    tagIds: readonly string[];
    onChange: (ids: readonly string[]) => void;
}) {
    const [query, setQuery] = useState('');
    const [pickerOpen, setPickerOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [createdTags, setCreatedTags] = useState<TagRecord[]>([]);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        // Once confirmed by a snapshot, the bridge record owns rename/deletion visibility.
        const confirmed = new Set(snapshot.tags.map(tag => tag.id));
        setCreatedTags(current => current.some(tag => confirmed.has(tag.id))
            ? current.filter(tag => !confirmed.has(tag.id)) : current);
    }, [snapshot.tags]);
    const tagsById = new Map(snapshot.tags.map(tag => [tag.id, tag]));
    for (const tag of createdTags) if (!tagsById.has(tag.id)) tagsById.set(tag.id, tag);
    const selected = tagIds.map(id => {
        const tag = tagsById.get(id);
        // Preserve unknown IDs until persistence resolves them; never silently clear a membership.
        return tag ? toWebsitePopupTagSelection(tag)
            : { id, label: id, serializedValue: id, kind: 'tag' as const, workspaceId: null };
    });
    const selectedRef = useRef<WebsitePopupCreateSelectedValue[]>(selected);
    selectedRef.current = selected;
    const contextRef = useRef({ active, scopeKey, organisationId, snapshotOrganisationId: snapshot.defaultOrganisationId });
    contextRef.current = { active, scopeKey, organisationId, snapshotOrganisationId: snapshot.defaultOrganisationId };
    const lifetimeRef = useRef(0);
    const creatingRef = useRef(false);
    useEffect(() => {
        const lifetime = ++lifetimeRef.current;
        setPending(false);
        return () => { if (lifetimeRef.current === lifetime) lifetimeRef.current++; };
    }, [active, scopeKey]);
    const sections = buildWebsitePopupCollectionTagSections({ snapshot, organisationId, query, selected, createdTags });
    const rows = sections.flatMap(section => section.rows);
    const boundedIndex = Math.min(selectedIndex, Math.max(0, rows.length - 1));
    const writeSelections = useCallback((values: WebsitePopupCreateSelectedValue[]) => {
        if (!contextRef.current.active) return;
        selectedRef.current = values;
        onChange(values.map(value => value.id));
    }, [onChange]);
    const changeQuery = useCallback((value: string) => {
        setQuery(value); setSelectedIndex(0); setError(null);
    }, []);
    const activate = useCallback(async (intent: WebsitePopupResultIntent) => {
        const context = contextRef.current;
        if (!context.active || !context.organisationId || context.organisationId !== context.snapshotOrganisationId) return;
        if (intent.kind === 'create-property-select' && intent.field === WEBSITE_POPUP_COLLECTION_TAG_FIELD
            && intent.selection?.kind === 'tag') {
            // Only activate a current catalog row, including a selected row being removed.
            if (!rows.some(row => row.intent.kind === 'create-property-select' && row.intent.optionId === intent.optionId)) return;
            writeSelections(toggleWebsitePopupMultiSelectValue(selectedRef.current, {
                id: intent.optionId, label: intent.label, serializedValue: intent.serializedValue, ...intent.selection,
            }, true));
            changeQuery('');
            return;
        }
        if (intent.kind !== 'create-tag' || creatingRef.current
            || !rows.some(row => row.intent.kind === 'create-tag' && row.intent.name === intent.name)) return;
        const lifetime = lifetimeRef.current;
        creatingRef.current = true;
        setPending(true); setError(null);
        try {
            const tag = await createWebsitePopupTag(intent.name);
            if (lifetimeRef.current !== lifetime || !contextRef.current.active || contextRef.current.scopeKey !== context.scopeKey) return;
            setCreatedTags(current => [...current.filter(value => value.id !== tag.id), tag]);
            // The create bridge can return an existing tag; adding it must not toggle it off.
            if (!selectedRef.current.some(value => value.id === tag.id))
                writeSelections(toggleWebsitePopupMultiSelectValue(selectedRef.current, toWebsitePopupTagSelection(tag), true));
            setQuery(current => current.trim() === intent.name ? '' : current);
            setSelectedIndex(0);
        } catch (failure) {
            if (lifetimeRef.current === lifetime && contextRef.current.active)
                setError(failure instanceof Error ? failure.message : String(failure));
        } finally {
            creatingRef.current = false;
            if (lifetimeRef.current === lifetime) setPending(false);
        }
    }, [changeQuery, rows, writeSelections]);
    useEffect(() => {
        if (!active) { setPickerOpen(false); setPending(false); }
    }, [active]);
    return {
        selected, query, pickerOpen, sections, selectedIndex: boundedIndex, pending, error,
        changeQuery, activate, selectIndex: (index: number) => setSelectedIndex(Math.max(0, Math.min(index, rows.length - 1))),
        openPicker: () => { if (active) setPickerOpen(true); },
        closePicker: () => { setPickerOpen(false); changeQuery(''); },
        remove: (id: string) => writeSelections(selectedRef.current.filter(value => value.id !== id)),
        removeLast: () => writeSelections(removeLastWebsitePopupMultiSelectValue(selectedRef.current)),
    };
}
