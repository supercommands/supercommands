import type { Transaction } from 'dexie';
import type { PrefixSettingRecord } from '../../allObjectFolder/src/createObject/prefixSettings/prefixSettingTypes';
import type { UserShortcutRecord } from '../../shared-components/shortcuts/core/shortcutDbTypes';
import { planWebClipPrefixDefaults } from '../../allObjectFolder/src/createObject/prefixSettings/webClipPrefixProvisioning';

/** Version 37 data-only migration; all work stays in this Dexie transaction. */
export async function migrateWebClipPrefixes(tx: Transaction): Promise<void> {
  const prefixes = await tx.table<PrefixSettingRecord, string>('prefixSettings').toArray();
  const shortcuts = await tx.table<UserShortcutRecord, string>('userShortcuts').toArray();
  const existingIds = new Set(prefixes.map(row => row.id));
  // Missing defaults are seeded after legacy import by the existing startup owner.
  const updates = planWebClipPrefixDefaults(prefixes, shortcuts, Date.now()).filter(row => existingIds.has(row.id));
  if (updates.length) await tx.table('prefixSettings').bulkPut(updates);
}
