import { db } from '../../../storage/indexDB/dbConfig';
import { requireWebCollectionAssignmentTarget } from '../../../allObjectFolder/src/createObject/collections/collectionAssignmentData';
import { generateEntityId } from '../../utils';
import type { UserHotkeyRecord, HotkeyReferenceType } from './hotkeyDbTypes';
import type { HotkeyOverwriteApproval } from './hotkeyDbTypes';
import { normalizeHotkeyString } from './eventParser';
const DEFAULT_USER = 'local_user';
/** Shared write path; callers decide how conflicts are checked before entering it. */
async function writeHotkeyMapping(combination: string, referenceId: string, referenceType: HotkeyReferenceType, userId: string, now: number, existingCombination?: UserHotkeyRecord, existingReference?: UserHotkeyRecord): Promise<UserHotkeyRecord> {
    if (existingCombination) {
        const updated = { ...existingCombination, referenceId, referenceType, updatedAt: now };
        await db.userHotkeys.put(updated);
        if (existingReference && existingReference.id !== existingCombination.id) {
            await db.userHotkeys.delete(existingReference.id);
        }
        return updated;
    }
    if (existingReference) {
        const updated = { ...existingReference, combination, referenceType, updatedAt: now };
        await db.userHotkeys.put(updated);
        return updated;
    }
    const record: UserHotkeyRecord = {
        id: generateEntityId('hotkey'), userId, combination, referenceId, referenceType, updatedAt: now,
    };
    await db.userHotkeys.add(record);
    return record;
}
/**
 * Saves or updates a hotkey combination for a given reference (note, snippet, command, etc.)
 */
export async function saveUserHotkey(combination: string, referenceId: string, referenceType: HotkeyReferenceType, userId: string = DEFAULT_USER): Promise<UserHotkeyRecord> {
    const normCombo = combination.trim();
    const normUserId = userId.trim() || DEFAULT_USER;
    const now = Date.now();
    try {
        // 1. Ensure no other hotkey has this same combination for this user
        const existingCombo = await db.userHotkeys
            .where('combination')
            .equals(normCombo)
            .and(rec => rec.userId === normUserId)
            .first();
        // 2. Ensure this referenceId doesn't already have another combination assigned
        const existingRef = await db.userHotkeys
            .where('referenceId')
            .equals(referenceId)
            .and(rec => rec.userId === normUserId)
            .first();
        return await writeHotkeyMapping(normCombo, referenceId, referenceType, normUserId, now, existingCombo, existingRef);
    }
    catch (error) {
        console.error('[hotkeyDbData.saveUserHotkey] Failed:', error);
        throw error;
    }
}
/** popup-only atomic upsert: assignment transfer requires the exact approved owner. */
export async function saveUserHotkeyGuarded(combination: string, referenceId: string, referenceType: HotkeyReferenceType, approvedConflict: HotkeyOverwriteApproval | null, userId: string = DEFAULT_USER): Promise<UserHotkeyRecord> {
    const normCombination = normalizeHotkeyString(combination);
    const normUserId = userId.trim() || DEFAULT_USER;
    if (!normCombination)
        throw new Error('Hotkey cannot be empty.');
    const now = Date.now();
    const normalize = (value: string) => normalizeHotkeyString(value).replace(/\s+/g, '').toLowerCase();
    return db.transaction('rw', [db.userHotkeys, ...(referenceType === 'webCollection' ? [db.collections, db.organisations] : [])], async () => {
        if (referenceType === 'webCollection') await requireWebCollectionAssignmentTarget(referenceId);
        const mappings = await db.userHotkeys.where('userId').equals(normUserId).toArray();
        const collidingMappings = mappings.filter(record => normalize(record.combination) === normalize(normCombination)
            && record.referenceId !== referenceId);
        if (collidingMappings.length > 0) {
            const approved = collidingMappings.length === 1 && approvedConflict
                && collidingMappings[0].id === approvedConflict.id
                && collidingMappings[0].referenceId === approvedConflict.referenceId
                && collidingMappings[0].referenceType === approvedConflict.referenceType;
            if (!approved)
                throw new Error('This Hotkey changed owners. Validate and approve Overwrite again.');
        }
        const collision = collidingMappings[0];
        const existingReference = mappings.find(record => record.referenceId === referenceId);
        return writeHotkeyMapping(normCombination, referenceId, referenceType, normUserId, now, collision, existingReference);
    });
}
/**
 * Retrieves a hotkey record by key combination.
 */
export async function getUserHotkeyByCombination(combination: string, userId: string = DEFAULT_USER): Promise<UserHotkeyRecord | undefined> {
    try {
        return await db.userHotkeys
            .where('combination')
            .equals(combination.trim())
            .and(rec => rec.userId === (userId.trim() || DEFAULT_USER))
            .first();
    }
    catch (error) {
        console.error('[hotkeyDbData.getUserHotkeyByCombination] Failed:', error);
        throw error;
    }
}
/**
 * Retrieves a hotkey record by target reference ID.
 */
export async function getUserHotkeyByReference(referenceId: string, userId: string = DEFAULT_USER): Promise<UserHotkeyRecord | undefined> {
    try {
        return await db.userHotkeys
            .where('referenceId')
            .equals(referenceId)
            .and(rec => rec.userId === (userId.trim() || DEFAULT_USER))
            .first();
    }
    catch (error) {
        console.error('[hotkeyDbData.getUserHotkeyByReference] Failed:', error);
        throw error;
    }
}
/**
 * Deletes a hotkey by its unique record ID.
 */
export async function deleteUserHotkey(id: string): Promise<void> {
    try {
        await db.userHotkeys.delete(id);
    }
    catch (error) {
        console.error('[hotkeyDbData.deleteUserHotkey] Failed:', error);
        throw error;
    }
}
/**
 * Deletes any hotkey mapping registered for a specific reference ID.
 */
export async function deleteUserHotkeyByReference(referenceId: string, userId: string = DEFAULT_USER): Promise<void> {
    try {
        const existing = await getUserHotkeyByReference(referenceId, userId);
        if (existing) {
            await db.userHotkeys.delete(existing.id);
        }
    }
    catch (error) {
        console.error('[hotkeyDbData.deleteUserHotkeyByReference] Failed:', error);
        throw error;
    }
}
/**
 * Retrieves all user hotkey mappings.
 */
export async function getAllUserHotkeys(userId: string = DEFAULT_USER): Promise<UserHotkeyRecord[]> {
    try {
        return await db.userHotkeys
            .where('userId')
            .equals(userId.trim() || DEFAULT_USER)
            .toArray();
    }
    catch (error) {
        console.error('[hotkeyDbData.getAllUserHotkeys] Failed:', error);
        throw error;
    }
}
