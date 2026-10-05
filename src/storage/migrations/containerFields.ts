const RETIRED_FIELDS = new Set(['folderId', 'folder_id', 'folder', 'folders', 'folderPath', 'folderPathNames', 'folderName', 'folder_name', 'expandedFolders', 'collapsedFolders', 'selectedFolder', 'new_tab_expanded_folders', 'new_tab_collapsed_folders', 'teamId', 'teamName', 'team_name', 'selectedTeam', 'teams', 'team_id', 'selectedTeamId', 'lastUsedFolderId', 'selectedFolderId']);
const CONTENT_FIELDS = new Set(['body', 'content', 'value', 'title', 'name', 'description', 'prompt', 'text', 'html', 'delta', 'url', 'lastSavedText']);

/** Remove obsolete container metadata without changing authored content or collection items. */
export function retireContainerFields<T>(value: T): T {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.filter(item => !item || typeof item !== 'object' || !['folder', 'folder_search'].includes(item.referenceType ?? item.reference_type)).map(retireContainerFields) as T;
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (RETIRED_FIELDS.has(key)) continue;
    if (!CONTENT_FIELDS.has(key) && item && typeof item === 'object' && ['folder', 'folder_search'].includes((item as any).referenceType ?? (item as any).reference_type)) continue;
    Object.defineProperty(result, key, {value: CONTENT_FIELDS.has(key) ? item : retireContainerFields(item), enumerable: true, writable: true, configurable: true});
  }
  return result as T;
}


export const isRetiredContainerField = (key: string): boolean => RETIRED_FIELDS.has(key);
