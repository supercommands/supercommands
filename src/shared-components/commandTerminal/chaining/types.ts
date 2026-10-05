/**
 * Shared command-chain type contracts.
 *
 * These types describe parsed intent and neutral suggestion rows only. Website,
 * newtab, and omnibox code should keep their own rendering and execution logic
 * outside this shared command-terminal layer.
 */
/**
 * UI mode implied by a category command chain input.
 *
 * The parser returns these modes so adapters can decide how to display or
 * execute the chain without putting UI behavior in shared code.
 */
export type CategoryCommandChainMode = 'chooser' | 'prefix' | 'create';
/**
 * Lightweight prefix-settings row shape used by the chain parser.
 *
 * Callers should pass rows from the existing IndexedDB-backed prefix settings
 * table. This keeps subcommand customization in one source of truth.
 */
export type PrefixSettingRecordLike = {
    type?: string;
    category?: string;
    prefix?: string;
    enabled?: boolean;
};
/**
 * Parsed state for a category command chain.
 */
export type CategoryCommandChainState = {
    isActive: boolean;
    mode: CategoryCommandChainMode | null;
    query: string;
    isCommitted: boolean;
};
/**
 * Action represented by a rendered chain row.
 */
export type CategoryCommandChainAction = 'create' | 'save' | 'filter' | 'favorite' | 'unfavorite' | 'prefix-option';
export type CategoryCommandChainSection = 'required' | 'actions';
/**
 * Neutral row shape for chain action/prefix suggestions.
 */
export type CategoryCommandChainRow = {
    kind: string;
    item: {
        id: string;
        name: string;
        description: string;
        _categoryChainAction?: CategoryCommandChainAction;
        _categoryChainPrefix?: string;
        _categoryChainPrefixAliases?: string[];
        _categoryChainNextAction?: CategoryCommandChainAction | string;
        _categoryChainQuery?: string;
        _categoryChainSection?: CategoryCommandChainSection;
    };
    originalIndex: number;
};
/**
 * Display config for top-level chain actions such as create, save, and filter.
 */
export type CategoryCommandChainActionConfig = {
    action: 'create' | 'save' | 'filter' | 'favorite' | 'unfavorite';
    id: string;
    name: string;
    description: string;
};
/**
 * Display config for selectable action-prefix rows.
 */
export type CategoryCommandChainPrefixOptionConfig = {
    prefix: string;
    aliases?: string[];
    name: string;
    description: string;
    action: 'create' | 'save' | 'filter' | 'favorite' | 'unfavorite';
    section?: CategoryCommandChainSection;
    primary?: boolean;
};
export type CategoryCommandChainActionPrefixEntry = {
    action: 'save' | 'filter' | 'favorite' | 'unfavorite';
    prefix: string;
};
