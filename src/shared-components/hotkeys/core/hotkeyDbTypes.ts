export type HotkeyReferenceType = 'note' | 'link' | 'snippet' | 'session' | 'collection' | 'webCollection' | 'command' | 'automation' | 'module' | 'agent' | 'prompt' | 'aiPrompt' | 'todo' | 'bookmark';
export interface UserHotkeyRecord {
    id: string; // Unique generated ID
    userId: string; // User ID; defaults to 'local_user' if not signed in / available
    combination: string; // e.g. "Alt+S", "Alt+Shift+N" (normalized string)
    referenceId: string; // ID of the note, snippet, or command ID
    referenceType: HotkeyReferenceType;
    updatedAt: number;
}
/** Exact existing mapping explicitly approved by the user for overwrite. */
export type HotkeyOverwriteApproval = Pick<UserHotkeyRecord, 'id' | 'referenceId' | 'referenceType'>;
export const HOTKEY_COMPARISON_FIELDS = ['id', 'userId', 'combination', 'referenceId', 'referenceType'] as const satisfies readonly (keyof UserHotkeyRecord)[];
