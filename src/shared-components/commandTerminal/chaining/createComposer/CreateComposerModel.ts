export type CreateComposerLayoutInput = {
    expandedRowCount: number;
    requiredFieldCount: number;
    propertyCount: number;
};
export type CreateComposerVisibilityInput<RequiredRow, PropertyRow> = {
    requiredRows: readonly RequiredRow[];
    propertyRows: readonly PropertyRow[];
    expandedRowCount: number;
    getRequiredRowValue?: (row: RequiredRow) => unknown;
    getRequiredRowKey?: (row: RequiredRow) => string;
    getPropertyRowKey?: (row: PropertyRow) => string;
    activeRequiredFieldKey?: string | null;
    activePropertyFieldKey?: string | null;
    suppressRootSections?: boolean;
    isRequiredRowMissing?: (row: RequiredRow) => boolean;
};
export type CreateComposerVisibility<RequiredRow, PropertyRow> = {
    requiredRows: readonly RequiredRow[];
    propertyRows: readonly PropertyRow[];
    showRequiredSection: boolean;
    showPropertiesSection: boolean;
    hasExpandedSection: boolean;
    nextMissingRequiredRow: RequiredRow | null;
};
export type CreateComposerLayout = {
    requiredRowOffset: number;
    propertyRowOffset: number;
    totalRowCount: number;
};
export type CreateComposerRow = {
    kind: 'expanded';
    index: number;
} | {
    kind: 'required';
    index: number;
} | {
    kind: 'property';
    index: number;
};
export type CreateComposerKeyInput = {
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
};
export type CreateComposerKeyAction<PropertyKey extends string = string> = {
    kind: 'none';
} | {
    kind: 'move';
    offset: 1 | -1;
} | {
    kind: 'commit-expanded-dash';
} | {
    kind: 'cancel-active';
    property: PropertyKey;
} | {
    kind: 'remove-active';
    property: PropertyKey;
} | {
    kind: 'commit-active';
    property: PropertyKey;
} | {
    kind: 'commit-active-dash';
    property: PropertyKey;
} | {
    kind: 'activate-expanded';
    index: number;
} | {
    kind: 'activate-required';
    field: 'title' | 'description' | 'url';
    index: number;
} | {
    kind: 'activate-property';
    property: PropertyKey;
};
export const buildCreateComposerLayout = ({ expandedRowCount, requiredFieldCount, propertyCount, }: CreateComposerLayoutInput): CreateComposerLayout => {
    const requiredRowOffset = expandedRowCount;
    const propertyRowOffset = requiredRowOffset + requiredFieldCount;
    return {
        requiredRowOffset,
        propertyRowOffset,
        totalRowCount: expandedRowCount + requiredFieldCount + propertyCount,
    };
};
export const hasCreateComposerRequiredValue = (value: unknown) => String(value ?? '').trim().length > 0;
export const isCreateComposerRequiredRowMissing = <RequiredRow extends {
    required?: boolean;
    value?: unknown;
}>(row: RequiredRow, getRequiredRowValue?: (row: RequiredRow) => unknown) => Boolean(row.required && !hasCreateComposerRequiredValue(getRequiredRowValue ? getRequiredRowValue(row) : row.value));
export const resolveCreateComposerVisibility = <RequiredRow, PropertyRow>({ requiredRows, propertyRows, expandedRowCount, getRequiredRowValue, getRequiredRowKey, getPropertyRowKey, activeRequiredFieldKey, activePropertyFieldKey, suppressRootSections = false, isRequiredRowMissing, }: CreateComposerVisibilityInput<RequiredRow, PropertyRow>): CreateComposerVisibility<RequiredRow, PropertyRow> => {
    const hasExpandedSection = expandedRowCount > 0;
    const isMissingRequiredRow = isRequiredRowMissing || ((row: RequiredRow) => isCreateComposerRequiredRowMissing(row as RequiredRow & {
        required?: boolean;
        value?: unknown;
    }, getRequiredRowValue));
    const activeRequiredRow = activeRequiredFieldKey
        ? requiredRows.find(row => {
            const key = getRequiredRowKey
                ? getRequiredRowKey(row)
                : String((row as RequiredRow & {
                    key?: unknown;
                }).key ?? '');
            return key === activeRequiredFieldKey;
        })
        : null;
    const activePropertyRow = activePropertyFieldKey
        ? propertyRows.find(row => {
            const key = getPropertyRowKey
                ? getPropertyRowKey(row)
                : String((row as PropertyRow & {
                    key?: unknown;
                }).key ?? '');
            return key === activePropertyFieldKey;
        })
        : null;
    const nextMissingRequiredRow = activeRequiredRow || requiredRows.find(isMissingRequiredRow);
    if (hasExpandedSection || suppressRootSections) {
        return {
            requiredRows: [],
            propertyRows: [],
            showRequiredSection: false,
            showPropertiesSection: false,
            hasExpandedSection,
            nextMissingRequiredRow,
        };
    }
    if (activePropertyRow) {
        return {
            requiredRows: [],
            propertyRows: [activePropertyRow],
            showRequiredSection: false,
            showPropertiesSection: true,
            hasExpandedSection,
            nextMissingRequiredRow,
        };
    }
    if (nextMissingRequiredRow) {
        return {
            requiredRows: [nextMissingRequiredRow],
            propertyRows: [],
            showRequiredSection: true,
            showPropertiesSection: false,
            hasExpandedSection,
            nextMissingRequiredRow,
        };
    }
    return {
        requiredRows: [],
        propertyRows: [],
        showRequiredSection: false,
        showPropertiesSection: false,
        hasExpandedSection,
        nextMissingRequiredRow,
    };
};
export const moveCreateComposerSelectedIndex = (selectedIndex: number, offset: number, totalRowCount: number) => {
    if (totalRowCount <= 0)
        return 0;
    return (selectedIndex + offset + totalRowCount) % totalRowCount;
};
export const getCreateComposerRowAtIndex = (layout: CreateComposerLayout, selectedIndex: number): CreateComposerRow | null => {
    if (selectedIndex < 0 || selectedIndex >= layout.totalRowCount)
        return null;
    if (selectedIndex < layout.requiredRowOffset) {
        return { kind: 'expanded', index: selectedIndex };
    }
    if (selectedIndex < layout.propertyRowOffset) {
        return { kind: 'required', index: selectedIndex - layout.requiredRowOffset };
    }
    return { kind: 'property', index: selectedIndex - layout.propertyRowOffset };
};
export const resolveCreateComposerKeyAction = <PropertyKey extends string>({ input, layout, selectedIndex, propertyKeys, hasExpandedRows, activeProperty, }: {
    input: CreateComposerKeyInput;
    layout: CreateComposerLayout;
    selectedIndex: number;
    propertyKeys: readonly PropertyKey[];
    hasExpandedRows: boolean;
    activeProperty?: PropertyKey | null;
}): CreateComposerKeyAction<PropertyKey> => {
    if (input.key === 'ArrowDown')
        return { kind: 'move', offset: 1 };
    if (input.key === 'ArrowUp')
        return { kind: 'move', offset: -1 };
    const hasModifier = Boolean(input.ctrlKey || input.metaKey || input.shiftKey || input.altKey);
    if (hasModifier)
        return { kind: 'none' };
    if (activeProperty) {
        if (input.key === 'Escape')
            return { kind: 'cancel-active', property: activeProperty };
        if (input.key === 'Backspace')
            return { kind: 'remove-active', property: activeProperty };
        if (input.key === ' ')
            return { kind: 'commit-active', property: activeProperty };
        if (input.key === '-')
            return { kind: 'commit-active-dash', property: activeProperty };
    }
    else if (hasExpandedRows && input.key === '-') {
        return { kind: 'commit-expanded-dash' };
    }
    const selectedRow = getCreateComposerRowAtIndex(layout, selectedIndex);
    if (!selectedRow)
        return { kind: 'none' };
    if (input.key === 'Enter') {
        if (selectedRow.kind === 'expanded') {
            return { kind: 'activate-expanded', index: selectedRow.index };
        }
        if (selectedRow.kind === 'required') {
            return {
                kind: 'activate-required',
                field: selectedRow.index === 1 ? 'description' : 'title',
                index: selectedRow.index,
            };
        }
        const property = propertyKeys[selectedRow.index];
        return property ? { kind: 'activate-property', property } : { kind: 'none' };
    }
    if (input.key === ' ' && selectedRow.kind === 'property') {
        const property = propertyKeys[selectedRow.index];
        return property ? { kind: 'activate-property', property } : { kind: 'none' };
    }
    return { kind: 'none' };
};
