export type ShortcutReferenceType =
  | 'note'
  | 'link'
  | 'snippet'
  | 'command'
  | 'automation'
  | 'module'
  | 'session'
  | 'aiPrompt'
  | 'todo';

export interface UserShortcutRecord {
  id: string; // Unique generated ID
  userId: string; // User ID; defaults to 'local_user' if not signed in / available
  trigger: string; // Normalized trigger text without any leading symbol, e.g. "note" or "spotify"
  referenceId: string; // ID of the note, snippet, or command ID
  referenceType: ShortcutReferenceType;
  updatedAt: number;
}
