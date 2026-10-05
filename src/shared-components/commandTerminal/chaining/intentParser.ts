import { parseCategoryCommandChain } from './parser';
import { normalizeChainPrefix } from './prefixSettings';
export type CategoryCommandIntentKind = 'none' | 'create' | 'save' | 'filter';
export type CategoryCommandIntent = {
    kind: 'none';
} | {
    kind: 'create';
    entity: string | null;
    query: string;
    phase: 'chooser' | 'prefix' | 'fields';
    categoryPrefix: string;
} | {
    kind: 'save' | 'filter';
    entity: string;
    query: string;
    actionPrefix: string;
    categoryPrefix: string;
};
export type CategoryCommandIntentEntity = {
    entity: string;
    categoryPrefix: string;
    createFieldPrefixEntries?: Array<{
        field: string;
        prefix: string;
    }>;
};
export type CategoryCommandIntentActionPrefix = {
    action: 'save' | 'filter';
    prefix: string;
};
const normalizeActionToken = (value: unknown) => normalizeChainPrefix(value).replace(/^-+/, '');
const normalizeCategoryToken = (value: unknown) => String(value || '').trim().toLowerCase().replace(/^-+/, '');
/**
 * Classifies a configured command/category chain without rendering or executing it.
 * Action-first Save/Filter syntax wins over category-first Create syntax.
 */
export function parseCategoryCommandIntent(searchValue: string, options: {
    commandPrefix: string;
    entities: readonly CategoryCommandIntentEntity[];
    actionPrefixes: readonly CategoryCommandIntentActionPrefix[];
}): CategoryCommandIntent {
    const source = String(searchValue || '').replace(/\u00A0/g, ' ');
    const commandPrefix = String(options.commandPrefix || '').trim().toLowerCase();
    if (!commandPrefix || !source.toLowerCase().startsWith(`${commandPrefix} `)) {
        return { kind: 'none' };
    }
    const afterCommand = source.slice(commandPrefix.length + 1).trimStart();
    const actionToken = afterCommand.split(/\s+/)[0] || '';
    const normalizedActionToken = normalizeActionToken(actionToken);
    const actionEntry = normalizedActionToken
        ? options.actionPrefixes.find(entry => Boolean(normalizeActionToken(entry.prefix))
            && normalizeActionToken(entry.prefix) === normalizedActionToken)
        : undefined;
    if (actionEntry) {
        const afterAction = afterCommand.slice(actionToken.length).trimStart();
        const categoryToken = afterAction.split(/\s+/)[0] || '';
        const entity = options.entities.find(candidate => normalizeCategoryToken(candidate.categoryPrefix) === normalizeCategoryToken(categoryToken));
        if (!entity)
            return { kind: 'none' };
        return {
            kind: actionEntry.action,
            entity: entity.entity,
            query: afterAction.slice(categoryToken.length).trimStart(),
            actionPrefix: actionEntry.prefix,
            categoryPrefix: entity.categoryPrefix,
        };
    }
    for (const entity of options.entities) {
        if (!entity.createFieldPrefixEntries)
            continue;
        const parsed = parseCategoryCommandChain(source, {
            commandPrefix,
            categoryPrefix: entity.categoryPrefix,
            fieldPrefixes: entity.createFieldPrefixEntries.map(entry => entry.prefix),
            fieldPrefixEntries: entity.createFieldPrefixEntries,
        });
        if (!parsed.isActive || !parsed.isCommitted || !parsed.mode)
            continue;
        return {
            kind: 'create',
            entity: entity.entity,
            query: parsed.query,
            phase: parsed.mode === 'create' ? 'fields' : parsed.mode,
            categoryPrefix: entity.categoryPrefix,
        };
    }
    return { kind: 'none' };
}
