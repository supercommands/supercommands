export type ShortcutReferenceType =
  | 'note'
  | 'link'
  | 'snippet'
  | 'command'
  | 'automation'
  | 'module'
  | 'collection'
  | 'agent'
  | 'prompt'
  | 'aiPrompt'
  | 'todo'
  | 'bookmark';

export interface UserShortcutRecord {
  id: string; // Unique generated ID
  userId: string; // User ID; defaults to 'local_user' if not signed in / available
  trigger: string; // Normalized trigger text without any leading symbol, e.g. "note" or "spotify"
  referenceId: string; // ID of the note, snippet, or command ID
  referenceType: ShortcutReferenceType;
  updatedAt: number;
}

export const SHORTCUT_COMPARISON_FIELDS = ['id', 'userId', 'trigger', 'referenceId', 'referenceType'] as const satisfies readonly (keyof UserShortcutRecord)[];
