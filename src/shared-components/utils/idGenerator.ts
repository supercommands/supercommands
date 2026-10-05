import { v7 as uuidv7 } from 'uuid';
import { PREFIX_SETTING_CATEGORIES } from '../../allObjectFolder/src/createObject/prefixSettings/prefixSettingDefaults';
import type { PrefixSettingCategory } from '../../allObjectFolder/src/createObject/prefixSettings/prefixSettingTypes';
export function getUUID(): string {
    return uuidv7();
}
export function generateEntityId(entityType: string): string {
    return `${entityType}_${uuidv7()}`;
}
export function isLocalEntityId(id: any): boolean {
    return false;
}
/**
 * Stored/reference type names that cannot be derived from the canonical entity
 * categories.
 *
 * These are compatibility names used by old shortcut, favorite, widget, search,
 * and background records. They are not typed command prefixes.
 */
const ENTITY_REFERENCE_TYPE_EXCEPTIONS: Partial<Record<PrefixSettingCategory, readonly string[]>> = {
    collection: ['workspace', 'workspaces', 'collection_view', 'session', 'sessions', 'tab session', 'tabgroup'],
    command: ['module'],
    system_command: ['system'],
    agent: ['chat_agent', 'chat_agents', 'chatagent'],
    prompt: ['aiprompt', 'ai_prompt'],
};
const ENTITY_CATEGORY_BY_REFERENCE_TYPE = PREFIX_SETTING_CATEGORIES
    .reduce<Record<string, PrefixSettingCategory>>((map, category) => {
    const aliases = [
        category,
        `${category}s`,
        ...(ENTITY_REFERENCE_TYPE_EXCEPTIONS[category] || [])
    ];
    aliases.forEach(alias => {
        map[alias] = category;
    });
    return map;
}, {});
/**
 * Convert any stored/reference type into the canonical category key used by
 * shortcuts, search filtering, and prefix settings.
 */
export function getEntityCategoryForReferenceType(referenceType: string): PrefixSettingCategory | null {
    return ENTITY_CATEGORY_BY_REFERENCE_TYPE[String(referenceType || '').trim().toLowerCase()];
}
/**
 * Check whether a stored/search reference type belongs to an active category
 * filter while preserving old behavior that grouped prompts with agents.
 */
export function isReferenceTypeInEntityCategory(referenceType: string, categoryFilter: string | null): boolean {
    if (!categoryFilter)
        return true;
    const normalizedFilter = getEntityCategoryForReferenceType(categoryFilter);
    if (!normalizedFilter)
        return true;
    if (normalizedFilter === 'agent' || normalizedFilter === 'prompt') {
        return ['agent', 'prompt'].includes(getEntityCategoryForReferenceType(referenceType) || '');
    }
    return getEntityCategoryForReferenceType(referenceType) === normalizedFilter;
}
/**
 * Extracts the raw snippet ID from a compound ID.
 */
export const extractSnippetIdFromCompoundId = (compoundId: any): string => {
    if (!compoundId || typeof compoundId !== 'string')
        return String(compoundId || '');
    if (compoundId.startsWith('workspace_')) return compoundId;
    const canonicalChild = compoundId.match(/-(workspace_[\s\S]+)$/);
    if (compoundId.startsWith('organisation_') && canonicalChild) return canonicalChild[1];
    if (compoundId.startsWith('organisation_') || compoundId.startsWith('folder_') ||
        compoundId.startsWith('ws_') || compoundId.startsWith('fld_')) {
        const parts = compoundId.split('-');
        if (parts.length > 5)
            return parts.slice(5).join('-');
    }
    if (!compoundId.includes('-'))
        return compoundId;
    const parts = compoundId.split('-');
    return parts.slice(-1)[0].length > 8 ? parts.slice(-5).join('-') : compoundId;
};
export const getItemCompoundId = (item: any): string => {
    if (!item)
        return '';
    if (item.kind === 'command' || item._kind === 'command')
        return item.id;
    if (item._kind === 'collection_view' || item.kind === 'collection_view' || item.type === 'collection_view') {
        return String(item.collectionView?.id || item.id || '');
    }
    // Entity resolution (Snippets, Notes, Links, Sessions, Prompts, Todos, Tags, ChatAgents)
    const entity = item.suggestion?.snippet || item.snippet ||
        item.suggestion?.note || item.note ||
        item.suggestion?.link || item.link ||
        item.suggestion?.session || item.session ||
        item.suggestion?.aiPrompt || item.aiPrompt || item.prompt ||
        item.suggestion?.todo || item.todo ||
        item.suggestion?.tag || item.tag ||
        item.suggestion?.chatAgent || item.chatAgent ||
        item; // Fallback to item itself
    let rawId = String(entity?.snippet_id || entity?.id || entity?.snippetId || entity?.note_id || entity?.link_id || entity?.session_id || entity?.prompt_id || entity?.todo_id || entity?.tag_id || entity?.agent_id || '');
    // If the ID already looks like a compound ID (contains a hyphen), extract the rightmost part
    // This prevents double-prefixing (e.g., "WS-ID-WS-ID-SnippetID")
    if (rawId.includes('-')) {
        rawId = extractSnippetIdFromCompoundId(rawId);
    }
    const snippetId = rawId;
    if (!snippetId && (item.id || item.organisation_id)) {
        return String(item.organisation_id || item.id || '');
    }
    return snippetId || String('');
};
