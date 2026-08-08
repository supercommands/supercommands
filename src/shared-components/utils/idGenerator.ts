import { v7 as uuidv7 } from 'uuid';

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
 * Extracts the raw snippet ID from a compound ID.
 */
export const extractSnippetIdFromCompoundId = (compoundId: any): string => {
  if (!compoundId || typeof compoundId !== 'string') return String(compoundId || '');
  if (compoundId.startsWith('workspace_') || compoundId.startsWith('folder_') || 
      compoundId.startsWith('ws_') || compoundId.startsWith('fld_')) {
    const parts = compoundId.split('-');
    if (parts.length > 5) return parts.slice(5).join('-');
  }
  if (!compoundId.includes('-')) return compoundId;
  const parts = compoundId.split('-');
  return parts.slice(-1)[0].length > 8 ? parts.slice(-5).join('-') : compoundId;
};

/**
 * Generates a compound ID for storage lookup (e.g., "folderId-snippetId").
 * Centralizes the logic used across various views.
 */
export const getItemCompoundId = (item: any): string => {
  if (!item) return '';
  // Direct ID check for commands or folders
  if (item.kind === 'command' || item._kind === 'command') return item.id;
  if (item._kind === 'folder' || item.kind === 'folder') return item.folder_id || item.id;
  if (
    item._kind === 'automation' ||
    item.kind === 'automation' ||
    item.type === 'automation' ||
    item.category === 'automation' 
  )
    return item.automation?.id || item.id;

  // Handle SavedAutomation wrapper from SavedAutomationsPanel.tsx
  if (item.type === 'saved' || item.type === 'installed') {
    const data = item.data || {};
    const snippetId = String(data.id || data.module_id || '');
    const containerId = data.folder_id || data.workspace_id;
    if (containerId && containerId !== 'null' && containerId !== 'undefined' && snippetId) {
      return `${containerId}-${snippetId}`;
    }
    return snippetId;
  }

  // Entity resolution (Snippets, Notes, Links, Sessions, Prompts, Todos, Tags, ChatAgents)
  const entity = 
    item.suggestion?.snippet || item.snippet || 
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

  if (!snippetId && (item.folder_id || item.id || item.workspace_id)) {
    // If no snippet but has container ID, might be a folder or other entity
    return String(item.folder_id || item.workspace_id || item.id || '');
  }

  // Container resolution (Matches FavoritesPanel.tsx logic)
  const containerId =
    item.suggestion?.folder?.folder_id ||
    item.suggestion?.workspace?.workspace_id ||
    item.folder?.folder_id ||
    item.workspace?.workspace_id ||
    item.folder_id ||
    item.workspace_id;

  if (containerId && containerId !== 'null' && containerId !== 'undefined' && snippetId) {
    return `${containerId}-${snippetId}`;
  }
  return snippetId || String(containerId || '');
};
