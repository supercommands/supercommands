import { parseDictionaryString, serializeDictionaryToString } from '../../utils';

const chromeAny = typeof window !== 'undefined' ? (window as any)?.chrome : null;

/**
 * Get current user's hotkey from snippet's hotkeys dictionary
 */
export function getUserHotkey(hotkeys: string | null | undefined, userId: string): string {
  const map = parseDictionaryString(hotkeys);
  return map.get(userId) || '';
}

/**
 * Update user's hotkey in dictionary and return new string
 */
export function updateUserHotkey(hotkeys: string | null | undefined, userId: string, newHotkey: string): string {
  const map = parseDictionaryString(hotkeys);
  if (newHotkey) {
    map.set(userId, newHotkey);
  } else {
    map.delete(userId);
  }
  return serializeDictionaryToString(map);
}
   
