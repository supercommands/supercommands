/** Shared tag suggestions for Create and Collection adapters; no state or persistence. */
import { FiGrid, FiPlus, FiTag } from 'react-icons/fi';
import type { TagRecord } from '../../../../allObjectFolder/src/createObject/tags/tagTypes';
import type { WebsitePopupCreateSelectedValue } from '../interaction/websitePopupInteractionTypes';
import type { WebsitePopupResolvedSection } from '../results/websitePopupResultsTypes';

export function toWebsitePopupTagSelection(tag: TagRecord): WebsitePopupCreateSelectedValue {
    return { id: tag.id, label: tag.name, serializedValue: tag.name, kind: 'tag', workspaceId: tag.workspaceId };
}

export function buildWebsitePopupTagSections({ fieldId, query, tags, selected = [], multiple = true }: {
    fieldId: string;
    query: string;
    /** Already scoped by the background snapshot; local newly created tags are global. */
    tags: readonly TagRecord[];
    selected?: readonly WebsitePopupCreateSelectedValue[];
    multiple?: boolean;
}): WebsitePopupResolvedSection[] {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (name: string) => tokens.every(token => name.toLowerCase().includes(token));
    const tagsById = new Map(tags.map(tag => [tag.id, tag]));
    const selectedById = new Map(selected.map(value => [value.id, value]));
    const row = (value: WebsitePopupCreateSelectedValue, checked: boolean) => ({
        id: `create-property:${fieldId}:${value.id}`,
        title: value.label,
        trailing: !multiple && checked ? 'Selected' : undefined,
        checkable: multiple,
        checked,
        disabled: false,
        icon: value.workspaceId ? <FiGrid /> : <FiTag />,
        intent: {
            kind: 'create-property-select' as const,
            field: fieldId,
            optionId: value.id,
            label: value.label,
            serializedValue: value.serializedValue || value.label,
            multiple,
            selection: { kind: 'tag' as const, workspaceId: value.workspaceId ?? null },
        },
    });
    const availableRows = [...tagsById.values()]
        .filter(tag => !selectedById.has(tag.id) && matches(tag.name))
        .map(tag => row(toWebsitePopupTagSelection(tag), false));
    const selectedRows = [...selectedById.values()]
        .map(value => tagsById.has(value.id) ? toWebsitePopupTagSelection(tagsById.get(value.id)!) : value)
        .filter(value => matches(value.label))
        .map(value => row(value, true));
    const createName = query.trim();
    const canCreate = createName.length > 0 && ![...tagsById.values()].some(tag =>
        tag.name.trim().toLowerCase() === createName.toLowerCase());
    return [
        ...(availableRows.length ? [{ id: `create-property-${fieldId}-available`, label: 'Available Tags', rows: availableRows }] : []),
        ...(selectedRows.length ? [{ id: `create-property-${fieldId}-selected`, label: 'Selected Tags', rows: selectedRows }] : []),
        ...(canCreate ? [{ id: `create-property-${fieldId}-create`, label: 'Create', rows: [{
            id: `create-tag:${createName.toLowerCase()}`,
            icon: <FiPlus />,
            title: `Create tag "${createName}"`,
            intent: { kind: 'create-tag' as const, name: createName },
        }] }] : []),
    ];
}
