import { useLiveQuery } from 'dexie-react-hooks';
import { getAllUserHotkeys, getUserHotkeyByCombination, getUserHotkeyByReference } from '../core/hotkeyDbData';
const DEFAULT_USER = 'local_user';
/**
 * Hook to subscribe to all user hotkeys.
 */
export function useUserHotkeys(userId: string = DEFAULT_USER) {
    const normUserId = userId.trim() || DEFAULT_USER;
    return useLiveQuery(() => getAllUserHotkeys(normUserId), [normUserId]);
}
/**
 * Hook to subscribe to a single hotkey by combination.
 */
export function useUserHotkeyByCombination(combination: string, userId: string = DEFAULT_USER) {
    const normUserId = userId.trim() || DEFAULT_USER;
    return useLiveQuery(() => getUserHotkeyByCombination(combination, normUserId), [combination, normUserId]);
}
/**
 * Hook to subscribe to a single hotkey by target reference ID.
 */
export function useUserHotkeyByReference(referenceId: string, userId: string = DEFAULT_USER) {
    const normUserId = userId.trim() || DEFAULT_USER;
    return useLiveQuery(() => getUserHotkeyByReference(referenceId, normUserId), [referenceId, normUserId]);
}
