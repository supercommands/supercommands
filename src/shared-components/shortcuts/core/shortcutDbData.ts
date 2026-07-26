import { db } from '../../../storage/indexDB/dbConfig';
import { CustomSearchPrefixesForOmniboxStorage } from '../../../storage/localStorage/customSearchPrefixesForOmniboxStorage';
import { generateEntityId } from '../../utils';
import type { UserShortcutRecord, ShortcutReferenceType } from './shortcutDbTypes';
import { THIS_SECTION_ACTION_PREFIXES } from '../../commands';

const DEFAULT_USER = 'local_user';
const SHORTCUT_TRIGGER_ALLOWED_PATTERN = /^[a-z0-9]+$/i;

export const normalizeShortcutTrigger = (trigger: string) => {
  return trigger.trim().toLowerCase();
};

export const getShortcutTriggerFormatError = (trigger: string) => {
  const normalized = normalizeShortcutTrigger(trigger);
  if (!normalized) return null;

  return SHORTCUT_TRIGGER_ALLOWED_PATTERN.test(normalized)
    ? null
    : 'Shortcuts can only use letters and numbers. Symbols like /, @, !, ., spaces, and prefixes are not allowed.';
};

const normalizeOmniboxPrefix = (prefix: string) => prefix.trim().toLowerCase();

export async function getReservedShortcutReason(shortcutText: string): Promise<string | null> {
  const normalized = normalizeShortcutTrigger(shortcutText);
  if (!normalized) return 'Shortcut cannot be empty.';

  const formatError = getShortcutTriggerFormatError(shortcutText);
  if (formatError) return formatError;

  const rawShortcut = normalized;

  const omniboxPrefixes = await CustomSearchPrefixesForOmniboxStorage.getPrefixes().catch(() => ({
    note: 'n',
    link: 'l',
    command: 'c',
    session: 's',
    prompt: 'p',
    automation: 'a',
    agent: 'g',
    snippet: 'sn',
    todo: 't',
  }));
  const reservedOmniboxPrefixes = new Set([
    normalizeOmniboxPrefix(omniboxPrefixes.note || ''),
    normalizeOmniboxPrefix(omniboxPrefixes.link || ''),
    normalizeOmniboxPrefix(omniboxPrefixes.command || ''),
    normalizeOmniboxPrefix(omniboxPrefixes.session || ''),
    normalizeOmniboxPrefix(omniboxPrefixes.prompt || ''),
    normalizeOmniboxPrefix(omniboxPrefixes.automation || ''),
    normalizeOmniboxPrefix(omniboxPrefixes.agent || ''),
    normalizeOmniboxPrefix(omniboxPrefixes.snippet || ''),
    normalizeOmniboxPrefix(omniboxPrefixes.todo || ''),
    ...Object.values(THIS_SECTION_ACTION_PREFIXES).map(p => p.toLowerCase()),
  ]);

  const isPrefixCollision = (prefix: string) => {
    if (!prefix) return false;
    if (/^[a-z0-9]+$/i.test(prefix)) {
      return rawShortcut === prefix || rawShortcut.startsWith(`${prefix} `);
    }
    return rawShortcut.startsWith(prefix);
  };

  if (Array.from(reservedOmniboxPrefixes).some(isPrefixCollision)) {
    return `The shortcut "${normalized}" is reserved by your omnibox prefix settings. Choose a different shortcut.`;
  }

  return null;
}

const getLegacyShortcutTriggers = (trigger: string) => {
  const normalized = normalizeShortcutTrigger(trigger);
  return normalized ? [normalized, `/${normalized}`] : [normalized];
};

/**
 * Saves or updates a text shortcut trigger for a given reference (note, snippet, command, etc.)
 */
export async function saveUserShortcut(
  trigger: string,
  referenceId: string,
  referenceType: ShortcutReferenceType,
  userId: string = DEFAULT_USER
): Promise<UserShortcutRecord> {
  // Normalize trigger: trim, lowercase, and store without any leading symbol.
  const normTrigger = normalizeShortcutTrigger(trigger);
  const normUserId = userId.trim() || DEFAULT_USER;
  const now = Date.now();

  if (!normTrigger) {
    throw new Error('Shortcut trigger cannot be empty.');
  }

  const reservedReason = await getReservedShortcutReason(trigger);
  if (reservedReason) {
    throw new Error(reservedReason);
  }

  try {
    // If a command in db.commands has this prefix, clear its prefix so user shortcut overrides it
    try {
      const conflictingCmds = await db.commands
        .filter(cmd => normalizeShortcutTrigger(cmd.prefix || '') === normTrigger)
        .toArray();
      for (const cmd of conflictingCmds) {
        await db.commands.update(cmd.id, { prefix: '' });
      }
    } catch (e) {
      console.warn('[saveUserShortcut] Failed to clear conflicting command prefix:', e);
    }

    // 1. Ensure no other shortcut has this same trigger for this user
    const existingTrigger = (await db.userShortcuts
      .where('trigger')
      .anyOf(getLegacyShortcutTriggers(normTrigger))
      .and(rec => rec.userId === normUserId)
      .toArray())
      .find(rec => normalizeShortcutTrigger(rec.trigger) === normTrigger)
      || (await db.userShortcuts
        .where('userId')
        .equals(normUserId)
        .toArray())
        .find(rec => normalizeShortcutTrigger(rec.trigger) === normTrigger);

    // 2. Ensure this referenceId doesn't already have another trigger assigned
    const existingRef = await db.userShortcuts
      .where('referenceId')
      .equals(referenceId)
      .and(rec => rec.userId === normUserId)
      .first();

    if (existingTrigger) {
      const updated: UserShortcutRecord = {
        ...existingTrigger,
        referenceId,
        referenceType,
        updatedAt: now,
      };
      await db.userShortcuts.put(updated);
      
      // Clean up the other trigger if the reference was bound elsewhere
      if (existingRef && existingRef.id !== existingTrigger.id) {
        await db.userShortcuts.delete(existingRef.id);
      }
      return updated;
    } else if (existingRef) {
      const updated: UserShortcutRecord = {
        ...existingRef,
        trigger: normTrigger,
        referenceType,
        updatedAt: now,
      };
      await db.userShortcuts.put(updated);
      return updated;
    } else {
      const record: UserShortcutRecord = {
        id: generateEntityId('shortcut'),
        userId: normUserId,
        trigger: normTrigger,
        referenceId,
        referenceType,
        updatedAt: now,
      };
      await db.userShortcuts.add(record);
      return record;
    }
  } catch (error) {
    console.error('[shortcutDbData.saveUserShortcut] Failed:', error);
    throw error;
  }
}

/**
 * Retrieves a shortcut record by trigger text.
 */
export async function getUserShortcutByTrigger(
  trigger: string,
  userId: string = DEFAULT_USER
): Promise<UserShortcutRecord | undefined> {
  const normTrigger = normalizeShortcutTrigger(trigger);
  const normUserId = userId.trim() || DEFAULT_USER;
  try {
    const indexedMatch = (await db.userShortcuts
      .where('trigger')
      .anyOf(getLegacyShortcutTriggers(normTrigger))
      .and(rec => rec.userId === normUserId)
      .toArray())
      .find(rec => normalizeShortcutTrigger(rec.trigger) === normTrigger);

    if (indexedMatch) return indexedMatch;

    return (await db.userShortcuts
      .where('userId')
      .equals(normUserId)
      .toArray())
      .find(rec => normalizeShortcutTrigger(rec.trigger) === normTrigger);
  } catch (error) {
    console.error('[shortcutDbData.getUserShortcutByTrigger] Failed:', error);
    throw error;
  }
}

/**
 * Retrieves a shortcut record by target reference ID.
 */
export async function getUserShortcutByReference(
  referenceId: string,
  userId: string = DEFAULT_USER
): Promise<UserShortcutRecord | undefined> {
  try {
    return await db.userShortcuts
      .where('referenceId')
      .equals(referenceId)
      .and(rec => rec.userId === (userId.trim() || DEFAULT_USER))
      .first();
  } catch (error) {
    console.error('[shortcutDbData.getUserShortcutByReference] Failed:', error);
    throw error;
  }
}

/**
 * Deletes a shortcut by its unique record ID.
 */
export async function deleteUserShortcut(id: string): Promise<void> {
  try {
    await db.userShortcuts.delete(id);
  } catch (error) {
    console.error('[shortcutDbData.deleteUserShortcut] Failed:', error);
    throw error;
  }
}

/**
 * Deletes any shortcut mapping registered for a specific reference ID.
 */
export async function deleteUserShortcutByReference(
  referenceId: string,
  userId: string = DEFAULT_USER
): Promise<void> {
  try {
    const existing = await getUserShortcutByReference(referenceId, userId);
    if (existing) {
      await db.userShortcuts.delete(existing.id);
    }
  } catch (error) {
    console.error('[shortcutDbData.deleteUserShortcutByReference] Failed:', error);
    throw error;
  }
}

/**
 * Retrieves all user shortcut mappings.
 */
export async function getAllUserShortcuts(userId: string = DEFAULT_USER): Promise<UserShortcutRecord[]> {
  try {
    return await db.userShortcuts
      .where('userId')
      .equals(userId.trim() || DEFAULT_USER)
      .toArray();
  } catch (error) {
    console.error('[shortcutDbData.getAllUserShortcuts] Failed:', error);
    throw error;
  }
}
