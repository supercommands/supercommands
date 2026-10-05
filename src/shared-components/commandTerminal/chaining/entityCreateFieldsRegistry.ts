/**
 * Entity create fields registry.
 *
 * One place that lists the supported create entities and which fields each
 * entity can show, plus how each field behaves when the user opens it.
 */
export const CREATE_COMPOSER_ENTITIES = ['note', 'todo', 'link', 'snippet', 'agent'] as const;
export type CreateComposerEntity = typeof CREATE_COMPOSER_ENTITIES[number];
export type CreateComposerPropertyKey = 'time' | 'recurring' | 'reference' | 'tag' | 'favorite' | 'shortcut' | 'hotkey';
export type CreateComposerFieldKey = 'title' | 'description' | 'url' | CreateComposerPropertyKey;
export type CreateComposerFieldKind = 'text' | 'multiSelect' | 'singleSelect' | 'boolean' | 'capture' | 'validatedUnique';
export type CreateComposerFieldSequenceEntry = {
    field: CreateComposerFieldKey;
    label: string;
    required?: boolean;
};
export type CreateComposerFieldCapability = CreateComposerFieldSequenceEntry & {
    kind: CreateComposerFieldKind;
    description: string;
    /** An optional field that blocks Save until its picker has a value. */
    mustCompleteWhenAdded?: boolean;
    visibleInLeftComposer?: boolean;
    tabCycle?: boolean;
    allowSpaceInQuery?: boolean;
    source?: 'tags' | 'browserLinks' | 'attachments' | 'recurring' | 'time' | 'favorite' | 'hotkey' | 'shortcut';
    presentation?: {
        control?: 'input' | 'textarea';
        width?: 'short' | 'medium' | 'long';
        maximumRows?: number;
    };
};
/**
 * Prefix settings decide whether a field is enabled and what aliases it uses.
 * This registry decides the field order, label, and keyboard behavior after
 * that enabled field becomes visible.
 */
const CREATE_COMPOSER_FIELD_CAPABILITIES: Record<CreateComposerEntity, readonly CreateComposerFieldCapability[]> = {
    note: [
        { field: 'title', label: 'title', required: true, kind: 'text', description: 'Set the Note title', presentation: { width: 'medium' } },
        { field: 'description', label: 'description', required: true, kind: 'text', description: 'Set the Note description', presentation: { control: 'textarea', width: 'long', maximumRows: 3 } },
        { field: 'tag', label: 'tags', kind: 'multiSelect', description: 'Add Note tags', allowSpaceInQuery: true, source: 'tags' },
        { field: 'favorite', label: 'favorite', kind: 'boolean', description: 'Add Note to favorites', source: 'favorite' },
        { field: 'shortcut', label: 'text command', kind: 'validatedUnique', description: 'Assign a Note text command', source: 'shortcut' },
        { field: 'hotkey', label: 'hotkey', kind: 'capture', description: 'Assign a Note hotkey', source: 'hotkey', visibleInLeftComposer: false, tabCycle: false }
    ],
    todo: [
        { field: 'title', label: 'title', required: true, kind: 'text', description: 'Set the Todo title', presentation: { width: 'medium' } },
        { field: 'description', label: 'description', required: true, kind: 'text', description: 'Set the Todo description', presentation: { control: 'textarea', width: 'long', maximumRows: 3 } },
        { field: 'time', label: 'time', kind: 'singleSelect', description: 'Set the Todo due date and time', source: 'time', mustCompleteWhenAdded: true },
        { field: 'recurring', label: 'recurring', kind: 'singleSelect', description: 'Choose how often the Todo repeats', source: 'recurring', mustCompleteWhenAdded: true },
        { field: 'reference', label: 'attach', kind: 'multiSelect', description: 'Attach saved items to the Todo', source: 'attachments', mustCompleteWhenAdded: true },
        { field: 'tag', label: 'tags', kind: 'multiSelect', description: 'Add Todo tags', allowSpaceInQuery: true, source: 'tags' },
        { field: 'favorite', label: 'favorite', kind: 'boolean', description: 'Add Todo to favorites', source: 'favorite' },
        { field: 'shortcut', label: 'text command', kind: 'validatedUnique', description: 'Assign a Todo text command', source: 'shortcut' },
        { field: 'hotkey', label: 'hotkey', kind: 'capture', description: 'Assign a Todo hotkey', source: 'hotkey', visibleInLeftComposer: false, tabCycle: false }
    ],
    snippet: [
        { field: 'title', label: 'title', required: true, kind: 'text', description: 'Set the Text Expander title', presentation: { width: 'medium' } },
        { field: 'description', label: 'description', required: true, kind: 'text', description: 'Set the Text Expander text', presentation: { control: 'textarea', width: 'long', maximumRows: 3 } },
        { field: 'tag', label: 'tags', kind: 'multiSelect', description: 'Add Text Expander tags', allowSpaceInQuery: true, source: 'tags' },
        { field: 'favorite', label: 'favorite', kind: 'boolean', description: 'Add Text Expander to favorites', source: 'favorite' },
        { field: 'shortcut', label: 'text command', kind: 'validatedUnique', description: 'Assign a Text Expander text command', source: 'shortcut' },
        { field: 'hotkey', label: 'hotkey', kind: 'capture', description: 'Assign a Text Expander hotkey', source: 'hotkey', visibleInLeftComposer: false, tabCycle: false }
    ],
    link: [
        { field: 'title', label: 'title', required: true, kind: 'text', description: 'Set the Link title', presentation: { width: 'medium' } },
        { field: 'url', label: 'url', required: true, kind: 'multiSelect', description: 'Add one or more Link URLs', source: 'browserLinks', presentation: { width: 'long' } },
        { field: 'tag', label: 'tags', kind: 'multiSelect', description: 'Add Link tags', allowSpaceInQuery: true, source: 'tags' },
        { field: 'favorite', label: 'favorite', kind: 'boolean', description: 'Add Link to favorites', source: 'favorite' },
        { field: 'shortcut', label: 'text command', kind: 'validatedUnique', description: 'Assign a Link text command', source: 'shortcut' },
        { field: 'hotkey', label: 'hotkey', kind: 'capture', description: 'Assign a Link hotkey', source: 'hotkey', visibleInLeftComposer: false, tabCycle: false }
    ],
    agent: [
        { field: 'title', label: 'title', required: true, kind: 'text', description: 'Set the Chat Agent title', presentation: { width: 'medium' } },
        { field: 'description', label: 'prompt', required: true, kind: 'text', description: 'Set the Chat Agent prompt', presentation: { control: 'textarea', width: 'long', maximumRows: 3 } },
        { field: 'tag', label: 'tags', kind: 'multiSelect', description: 'Add Chat Agent tags', allowSpaceInQuery: true, source: 'tags' },
        { field: 'favorite', label: 'favorite', kind: 'boolean', description: 'Add Chat Agent to favorites', source: 'favorite' },
        { field: 'shortcut', label: 'text command', kind: 'validatedUnique', description: 'Assign a Chat Agent text command', source: 'shortcut' },
        { field: 'hotkey', label: 'hotkey', kind: 'capture', description: 'Assign a Chat Agent hotkey', source: 'hotkey', visibleInLeftComposer: false, tabCycle: false }
    ],
};
/** popup-only presentation differences, keyed once by the shared field source. */
export const WEBSITE_POPUP_CREATE_FIELD_OVERRIDES: Partial<Record<NonNullable<CreateComposerFieldCapability['source']>, {
    visibleInLeftComposer: boolean;
    tabCycle: boolean;
}>> = {
    hotkey: { visibleInLeftComposer: true, tabCycle: true },
};
export const getCreateComposerFieldCapabilities = (entity: CreateComposerEntity): readonly CreateComposerFieldCapability[] => CREATE_COMPOSER_FIELD_CAPABILITIES[entity] || [];
export const getCreateComposerFieldCapability = (entity: CreateComposerEntity, field: CreateComposerFieldKey): CreateComposerFieldCapability | null => getCreateComposerFieldCapabilities(entity).find(config => config.field === field);
export const getCreateComposerFieldSequence = (entity: CreateComposerEntity): readonly CreateComposerFieldSequenceEntry[] => getCreateComposerFieldCapabilities(entity)
    .filter(config => config.visibleInLeftComposer !== false && config.tabCycle !== false);
export const getCreateComposerPropertySequence = (entity: CreateComposerEntity): readonly CreateComposerPropertyKey[] => getCreateComposerFieldSequence(entity)
    .map(entry => entry.field)
    .filter((field): field is CreateComposerPropertyKey => field === 'time' ||
    field === 'recurring' ||
    field === 'reference' ||
    field === 'tag' ||
    field === 'favorite' ||
    field === 'shortcut' ||
    field === 'hotkey');
export const buildCreateComposerFieldSequence = (entity: CreateComposerEntity, labels: Record<string, string>) => getCreateComposerFieldSequence(entity)
    .map(config => ({
    ...config,
    prefix: String(labels[config.field] || ''),
}))
    .filter(entry => String(entry.prefix || '').trim());
export const buildCreateComposerPrefixOptions = (entity: CreateComposerEntity, labels: Record<string, string>, entries: ReadonlyArray<{
    field: string;
    prefix: string;
}>) => {
    const prefixesByField = new Map<string, string[]>();
    entries.forEach(entry => {
        const prefix = String(entry.prefix || '').trim();
        if (!prefix)
            return;
        prefixesByField.set(entry.field, [...(prefixesByField.get(entry.field) || []), prefix]);
    });
    return getCreateComposerFieldCapabilities(entity)
        .map(config => {
        const prefixes = prefixesByField.get(config.field) || [];
        const labelPrefix = String(labels[config.field] || '').trim();
        return {
            prefix: prefixes.includes(labelPrefix) ? labelPrefix : prefixes[0] || '',
            prefixes,
            name: config.field === 'shortcut'
                ? 'Text Command'
                : config.field === 'url'
                    ? 'URL'
                    : config.label.replace(/\b\w/g, char => char.toUpperCase()),
            description: config.description,
            required: config.required,
        };
    })
        .filter(option => option.prefixes.length > 0);
};
export const shouldCreateComposerFieldAllowSpaceInQuery = (entity: CreateComposerEntity, field: CreateComposerFieldKey): boolean => Boolean(getCreateComposerFieldCapability(entity, field)?.allowSpaceInQuery);
