import { db } from '../../storage/indexDB/dbConfig';
import { extractSnippetIdFromCompoundId } from './idGenerator';
type EntityResolverTableName = 'notes' | 'links' | 'snippets' | 'workspaceSessions' | 'chatAgents' | 'aiPrompts' | 'todos' | 'commands';
type ResolvedEntityType = 'note' | 'link' | 'snippet' | 'session' | 'chatAgent' | 'aiPrompt' | 'todo' | 'command';
const ENTITY_RESOLVER_TABLES: ReadonlyArray<{
    table: EntityResolverTableName;
    type: ResolvedEntityType;
}> = [
    { table: 'notes', type: 'note' },
    { table: 'links', type: 'link' },
    { table: 'snippets', type: 'snippet' },
    { table: 'workspaceSessions', type: 'session' },
    { table: 'chatAgents', type: 'chatAgent' },
    { table: 'aiPrompts', type: 'aiPrompt' },
    { table: 'todos', type: 'todo' },
    { table: 'commands', type: 'command' }
];
/**
 * Resolves an entity across all Dexie IndexedDB tables by its ID (or compound ID).
 * This replaces the legacy `chrome.storage.local` search logic.
 */
export async function resolveEntityById(compoundId: string) {
    if (!compoundId)
        return null;
    const actualId = extractSnippetIdFromCompoundId(compoundId);
    if (!actualId)
        return null;
    try {
        for (const { table, type } of ENTITY_RESOLVER_TABLES) {
            const entity = await db[table].get(actualId);
            if (entity)
                return { entity, type };
        }
    }
    catch (error) {
        console.error('[entityResolver] Error resolving entity:', error);
    }
    return null;
}
