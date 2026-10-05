import { parseDictionaryString, serializeDictionaryToString } from '../../utils';
const chromeAny = typeof window !== 'undefined' ? (window as any)?.chrome : null;
/**
 * Get current user's shortcut from snippet's shortcuts dictionary
 */
export function getUserShortcut(shortcuts: string | null | undefined, userId: string): string {
    const map = parseDictionaryString(shortcuts);
    return map.get(userId) || '';
}
/**
 * Update user's shortcut in dictionary and return new string
 */
export function updateUserShortcut(shortcuts: string | null | undefined, userId: string, newShortcut: string): string {
    const map = parseDictionaryString(shortcuts);
    if (newShortcut) {
        map.set(userId, newShortcut);
    }
    else {
        map.delete(userId);
    }
    return serializeDictionaryToString(map);
}
