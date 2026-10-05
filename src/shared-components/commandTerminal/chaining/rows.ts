import type { CategoryCommandChainActionConfig, CategoryCommandChainPrefixOptionConfig, CategoryCommandChainRow, } from './types';
/**
 * Shared row builders for category command-chain suggestions.
 *
 * The rows are deliberately neutral data. UI layers can render them as website
 * dropdown rows, newtab rows, or omnibox suggestions without moving UI behavior
 * into the shared command-terminal package.
 */
/**
 * Converts action display configs into neutral rows for a command suggestion list.
 */
export function buildCategoryCommandChainActionRows({ kind, actions, }: {
    kind: string;
    actions: CategoryCommandChainActionConfig[];
}): CategoryCommandChainRow[] {
    return actions.map((action, originalIndex) => ({
        kind,
        item: {
            id: action.id,
            name: action.name,
            description: action.description,
            _categoryChainAction: action.action,
        },
        originalIndex,
    }));
}
/**
 * Converts configured prefixes into selectable prefix-option rows.
 */
export function buildCategoryCommandChainPrefixRows({ kind, query, options, }: {
    kind: string;
    query: string;
    options: CategoryCommandChainPrefixOptionConfig[];
}): CategoryCommandChainRow[] {
    const normalizedQuery = query.trim().toLowerCase();
    const getPrefixRank = (prefix: string, primary?: boolean) => {
        if (primary)
            return 0;
        if (prefix.startsWith('-') && !prefix.startsWith('--'))
            return 1;
        if (!prefix.startsWith('-'))
            return 2;
        return 3;
    };
    const getActionRank = (action: CategoryCommandChainPrefixOptionConfig['action']) => {
        if (action === 'create')
            return 0;
        if (action === 'save')
            return 1;
        if (action === 'filter')
            return 2;
        if (action === 'favorite')
            return 3;
        if (action === 'unfavorite')
            return 4;
        return 5;
    };
    const getScore = (option: CategoryCommandChainPrefixOptionConfig) => {
        const prefix = String(option.prefix || '').trim().toLowerCase();
        const aliases = Array.from(new Set((option.aliases || []).map(alias => String(alias || '').trim().toLowerCase()).filter(Boolean)));
        const name = String(option.name || '').trim().toLowerCase();
        const normalizedQueryBody = normalizedQuery.replace(/^-+/, '');
        const hasEnoughPartialChars = normalizedQueryBody.length >= 2;
        const labelQuery = normalizedQuery.startsWith('-') ? normalizedQueryBody : normalizedQuery;
        if (!normalizedQuery || normalizedQuery === '-')
            return 1;
        if (prefix === normalizedQuery)
            return 100;
        if (aliases.some(alias => alias === normalizedQuery))
            return 95;
        if (hasEnoughPartialChars && prefix.startsWith(normalizedQuery))
            return option.primary ? 90 : 80;
        if (hasEnoughPartialChars && aliases.some(alias => alias.startsWith(normalizedQuery)))
            return 85;
        if (hasEnoughPartialChars && name.startsWith(labelQuery))
            return 70;
        if (hasEnoughPartialChars && name.includes(labelQuery))
            return 50;
        return 0;
    };
    return options
        .filter(option => String(option.prefix || '').trim())
        .map((option, originalIndex) => ({ option, originalIndex, score: getScore(option) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => {
        if (b.score !== a.score)
            return b.score - a.score;
        const aRequired = a.option.section === 'required' ? 0 : 1;
        const bRequired = b.option.section === 'required' ? 0 : 1;
        if (aRequired !== bRequired)
            return aRequired - bRequired;
        const actionRank = getActionRank(a.option.action) - getActionRank(b.option.action);
        if (actionRank !== 0)
            return actionRank;
        const prefixRank = getPrefixRank(a.option.prefix, a.option.primary) - getPrefixRank(b.option.prefix, b.option.primary);
        if (prefixRank !== 0)
            return prefixRank;
        return a.originalIndex - b.originalIndex;
    })
        .map(({ option, originalIndex }) => ({
        kind,
        item: {
            id: `${kind}-prefix-${option.prefix}`,
            name: `${option.prefix} ${option.name}`,
            description: option.description,
            _categoryChainAction: 'prefix-option',
            _categoryChainPrefix: option.prefix,
            _categoryChainPrefixAliases: option.aliases,
            _categoryChainNextAction: option.action,
            _categoryChainSection: option.section || 'actions',
        },
        originalIndex,
    }));
}
/**
 * Removes prefix marker characters when filtering selectable chain-prefix rows.
 */
export function getCategoryCommandChainPrefixResultsQuery(query: string) {
    return query.trim() === '-' ? '' : query.replace(/^-+/, '').trim();
}
