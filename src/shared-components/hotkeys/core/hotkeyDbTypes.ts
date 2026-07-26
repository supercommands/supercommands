export type HotkeyReferenceType = 'note' | 'link' | 'snippet' | 'session' | 'command' | 'automation' | 'module';

export interface UserHotkeyRecord {
  id: string; // Unique generated ID
  userId: string; // User ID; defaults to 'local_user' if not signed in / available
  combination: string; // e.g. "Alt+S", "Alt+Shift+N" (normalized string)
  referenceId: string; // ID of the note, snippet, or command ID
  referenceType: HotkeyReferenceType;
  updatedAt: number;
}
