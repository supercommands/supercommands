import { normalizeChainPrefix } from './prefixSettings';
import type { CategoryCommandChainState } from './types';
/**
 * Shared category command-chain parser.
 *
 * The parser is UI-neutral: it classifies text into chain states, while the
 * website, newtab, or omnibox caller decides what rows to render or execute.
 */
/**
 * Parses category command chains such as "c t", "c t -", or "c t -title Foo".
 *
 * Prefix values are provided by the caller from prefix settings. The parser only
 * classifies the input into chooser, prefix, or create states.
 */
export function parseCategoryCommandChain(searchValue: string, options: {
    commandPrefix: string;
    categoryPrefix: string;
    fieldPrefixes: string[];
    fieldPrefixEntries?: Array<{
        field: string;
        prefix: string;
    }>;
}): CategoryCommandChainState {
    const normalizedValue = searchValue.replace(/\u00A0/g, ' ');
    const commandPrefix = String(options.commandPrefix || '').trim().toLowerCase();
    const categoryPrefix = String(options.categoryPrefix || '').trim().toLowerCase();
    if (!commandPrefix || !categoryPrefix || !normalizedValue.toLowerCase().startsWith(`${commandPrefix} `)) {
        return { isActive: false, mode: null, query: '', isCommitted: false };
    }
    const afterCommand = normalizedValue.slice(commandPrefix.length + 1);
    const afterCommandLower = afterCommand.toLowerCase();
    if (afterCommandLower !== categoryPrefix && !afterCommandLower.startsWith(`${categoryPrefix} `)) {
        return { isActive: false, mode: null, query: '', isCommitted: false };
    }
    if (afterCommandLower === categoryPrefix) {
        return { isActive: true, mode: 'chooser', query: categoryPrefix, isCommitted: false };
    }
    const afterCategoryPrefix = afterCommand.slice(categoryPrefix.length + 1).trimStart();
    const afterCategoryPrefixLower = afterCategoryPrefix.toLowerCase();
    if (!afterCategoryPrefixLower) {
        return { isActive: true, mode: 'chooser', query: '', isCommitted: true };
    }
    if (afterCategoryPrefixLower === '-') {
        return { isActive: true, mode: 'prefix', query: afterCategoryPrefix, isCommitted: true };
    }
    const normalizedFieldPrefixEntries = (Array.isArray(options.fieldPrefixEntries) && options.fieldPrefixEntries.length > 0
        ? options.fieldPrefixEntries
        : options.fieldPrefixes.map(prefix => ({ field: prefix, prefix })))
        .map(entry => ({
        field: String(entry.field || '').trim().toLowerCase(),
        prefix: normalizeChainPrefix(entry.prefix),
    }))
        .filter(entry => entry.field && entry.prefix)
        .sort((a, b) => b.prefix.length - a.prefix.length);
    const firstToken = afterCategoryPrefixLower.split(/\s+/)[0] || '';
    const hasFieldTokenBoundary = afterCategoryPrefixLower === firstToken || afterCategoryPrefixLower.startsWith(`${firstToken} `);
    const exactFieldMatches = normalizedFieldPrefixEntries.filter(entry => entry.prefix === firstToken);
    const exactFieldNames = Array.from(new Set(exactFieldMatches.map(entry => entry.field)));
    const hasEnoughPartialFieldChars = firstToken.startsWith('-') && firstToken.replace(/^-+/, '').length >= 2;
    const partialFieldMatches = hasEnoughPartialFieldChars
        ? normalizedFieldPrefixEntries.filter(entry => entry.prefix.startsWith(firstToken))
        : [];
    const partialFieldNames = Array.from(new Set(partialFieldMatches.map(entry => entry.field)));
    const isResolvedCreateField = hasFieldTokenBoundary &&
        (exactFieldNames.length === 1 ||
            (exactFieldNames.length === 0 && partialFieldNames.length === 1));
    if (isResolvedCreateField) {
        return { isActive: true, mode: 'create', query: afterCategoryPrefix, isCommitted: true };
    }
    if (afterCategoryPrefixLower.startsWith('-')) {
        return { isActive: true, mode: 'prefix', query: afterCategoryPrefix, isCommitted: true };
    }
    return {
        isActive: true,
        mode: 'chooser',
        query: afterCategoryPrefix,
        isCommitted: true,
    };
}
