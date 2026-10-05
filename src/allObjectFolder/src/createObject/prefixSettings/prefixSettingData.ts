import Dexie from 'dexie';
import { db } from '../../../../storage/indexDB/dbConfig';
import { generateEntityId } from '../../../../shared-components/utils';
import { WEBSITE_COLLECTION_CAPTURE_CHOICES } from '../../../../shared-components/commands/websiteCollectionCommands';
import { isHistoricalWebClipPrefix, planWebClipPrefixDefaults } from './webClipPrefixProvisioning';
import { WEBSITE_PAGE_EXTRACTION_DEFINITIONS } from '../../../../shared-components/commands/websitePageExtraction';
import type { CreatePrefixSettingInput, PrefixSettingAction, PrefixSettingCategory, PrefixSettingRecord, PrefixSettingSubcommand, UpdatePrefixSettingInput, } from './prefixSettingTypes';
export { DEFAULT_COMMAND_TERMINAL_PREFIXES, DEFAULT_PREFIX_ROWS, FIXED_COMMAND_CHAIN_FIELD_ALIASES, PREFIX_SETTING_ACTIONS, PREFIX_SETTING_CATEGORIES, PREFIX_SETTING_SUBCOMMANDS, buildPrefixMapFromSettings, getFixedCommandChainFieldPrefixes, getFixedCommandChainReservedTextAliases, getReservedCommandGrammarEntries, type CommandChainFieldKey, type CommandTerminalPrefixes, } from './prefixSettingDefaults';
import { DEFAULT_COMMAND_TERMINAL_PREFIXES, DEFAULT_PREFIX_ROWS, PREFIX_SETTING_ACTIONS, PREFIX_SETTING_CATEGORIES, PREFIX_SETTING_SUBCOMMANDS, buildPrefixMapFromSettings, getReservedCommandGrammarEntries, isSupportedPrefixKey, normalizePrefixSettingValue, type CommandTerminalPrefixes, } from './prefixSettingDefaults';
// Legacy chrome.storage key kept only so old installs can migrate into IndexedDB prefixSettings.
const LEGACY_PREFIX_SETTING_STORAGE_KEY = 'custom_search_prefixes_for_omnibox';
function isLegacyDefaultPrefix(id: string, prefix: string): boolean {
    const legacy = LEGACY_DEFAULT_PREFIXES_BY_ID[id];
    return isHistoricalWebClipPrefix(id, prefix) || (legacy !== undefined && normalizePrefixSettingValue(legacy) === prefix);
}
const LEGACY_DEFAULT_PREFIXES_BY_ID: Record<string, string> = {
    prefix_note: 'n',
    prefix_todo: 't',
    prefix_link: 'l',
    prefix_prompt: 'p',
    prefix_collection: 'co',
    prefix_bookmark: 'bm',
    prefix_snippet: 'sn',
    prefix_agent: 'g',
    prefix_action_capture_screenshot: 'cs',
    prefix_action_capture_clip_screenshot: 'ccs',
    prefix_action_capture_full_screenshot: 'cfp',
    prefix_action_capture_element_screenshot: 'ces',
    prefix_action_downloadallimages: 'dai',
    prefix_action_downloadalltables: 'dat',
    prefix_action_save_chat: 'stc',
    prefix_action_send_to_agent: 'sta',
    prefix_action_summarize_page: 'smm',
    prefix_action_merge_windows: 'mw',
    prefix_action_close_duplicate_tabs: 'cdt',
    prefix_action_mute_all_tabs: 'mat',
    prefix_action_unmute_all_tabs: 'umat',
};
const REMOVED_PREFIX_SETTING_IDS = new Set([
    'prefix_collection_create',
    'prefix_action_save_todo',
    'prefix_action_save_link',
    'prefix_subcommand_field_tag_alias_plain',
    'prefix_subcommand_field_tag_alias_plural_plain'
]);
const REMOVED_PREFIX_SETTING_CATEGORIES = new Set([
    'collection_create',
    'save_todo',
    'save_link',
    'field_tag_alias_plain',
    'field_tag_alias_plural_plain'
]);
const isSupportedCategory = (category: string): category is PrefixSettingCategory => (PREFIX_SETTING_CATEGORIES as readonly string[]).includes(category);
const isSupportedAction = (category: string): category is PrefixSettingAction => (PREFIX_SETTING_ACTIONS as readonly string[]).includes(category);
const isSupportedSubcommand = (category: string): category is PrefixSettingSubcommand => (PREFIX_SETTING_SUBCOMMANDS as readonly string[]).includes(category);
const isRemovedPrefixSetting = (row: Pick<PrefixSettingRecord, 'id' | 'category'>): boolean => REMOVED_PREFIX_SETTING_IDS.has(row.id) || REMOVED_PREFIX_SETTING_CATEGORIES.has(String(row.category));
const isCurrentSubcommandPrefixValue = (value: string): boolean => value.startsWith('-') && !value.startsWith('--');
const getPrefixValidationScope = (row: PrefixSettingRecord): 'top-level' | 'subcommand' | null => {
    if (isRemovedPrefixSetting(row) || !isSupportedPrefixKey(String(row.category)))
        return null;
    return row.type === 'subcommand' || isSupportedSubcommand(String(row.category)) ? 'subcommand' : 'top-level';
};
const toPrefixSettingRecord = (row: PrefixSettingRecord): PrefixSettingRecord => ({
    id: row.id,
    type: row.type || (isSupportedAction(row.category) ? 'action' : isSupportedSubcommand(row.category) ? 'subcommand' : 'category'),
    category: row.category,
    label: row.label,
    prefix: normalizePrefixSettingValue(row.prefix),
    enabled: row.enabled,
    releasedTextCommandPrefix: row.releasedTextCommandPrefix,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
});
export function getDefaultPrefixSettings(): PrefixSettingRecord[] {
    const now = Date.now();
    return DEFAULT_PREFIX_ROWS.map(row => ({
        ...row,
        createdAt: now,
        updatedAt: now,
    }));
}
export async function createPrefixSetting(input: CreatePrefixSettingInput): Promise<PrefixSettingRecord> {
    const now = Date.now();
    const record = toPrefixSettingRecord({
        ...input,
        id: input.id || generateEntityId('prefix_setting'),
        prefix: normalizePrefixSettingValue(input.prefix),
        createdAt: input.createdAt || now,
        updatedAt: input.updatedAt || now,
    });
    await validateUniquePrefixSettings(record);
    await assertPrefixDoesNotStealItemCommand(record);
    await db.prefixSettings.put(record);
    return record;
}
export async function updatePrefixSetting(id: string, patch: UpdatePrefixSettingInput): Promise<PrefixSettingRecord> {
    const existing = await db.prefixSettings.get(id);
    if (!existing)
        throw new Error(`Prefix setting ${id} not found.`);
    const updated: PrefixSettingRecord = {
        ...existing,
        ...patch,
        releasedTextCommandPrefix: patch.releasedTextCommandPrefix
            ?? ((patch.prefix !== undefined || patch.enabled === true) ? false : existing.releasedTextCommandPrefix),
        prefix: patch.prefix !== undefined ? normalizePrefixSettingValue(patch.prefix) : existing.prefix,
        updatedAt: Date.now(),
    };
    const normalized = toPrefixSettingRecord(updated);
    await validateUniquePrefixSettings(normalized);
    if (normalized.prefix !== existing.prefix || (normalized.enabled && !existing.enabled)) {
        await assertPrefixDoesNotStealItemCommand(normalized);
    }
    await db.prefixSettings.put(normalized);
    return normalized;
}
export async function getPrefixSettings(): Promise<PrefixSettingRecord[]> {
    // Callers seed before opening their write transaction. Browser storage callbacks
    // here can let that transaction auto-commit before the next IndexedDB read.
    if (!Dexie.currentTransaction) await syncPrefixSettingsFromSource();
    return db.prefixSettings.orderBy('category').toArray();
}
export async function getEnabledPrefixSettings(): Promise<PrefixSettingRecord[]> {
    const rows = await getPrefixSettings();
    return rows.filter(row => row.enabled);
}
export async function getCategoryPrefixSettings(): Promise<PrefixSettingRecord[]> {
    const rows = await getPrefixSettings();
    return rows.filter(row => row.type === 'category');
}
export async function getActionPrefixSettings(): Promise<PrefixSettingRecord[]> {
    const rows = await getPrefixSettings();
    return rows.filter(row => row.type === 'action');
}
export async function getSubcommandPrefixSettings(): Promise<PrefixSettingRecord[]> {
    const rows = await getPrefixSettings();
    return rows.filter(row => row.type === 'subcommand');
}
export async function getPrefixes(): Promise<Required<CommandTerminalPrefixes>> {
    const rows = await getPrefixSettings();
    return buildPrefixMapFromSettings(rows);
}
export async function setPrefixes(prefixes: CommandTerminalPrefixes): Promise<void> {
    await syncPrefixSettingsFromSource();
    const rows = await db.prefixSettings.toArray();
    const now = Date.now();
    const updatedRows = rows.map(row => {
        if (!isSupportedPrefixKey(row.category))
            return row;
        const nextPrefix = (prefixes as any)[row.category];
        if (nextPrefix === undefined)
            return row;
        return {
            ...row,
            prefix: normalizePrefixSettingValue(nextPrefix),
            updatedAt: now,
        };
    });
    await validateUniquePrefixSettings(updatedRows);
    for (const row of updatedRows) {
        const previous = rows.find(existing => existing.id === row.id);
        if (row.prefix !== previous?.prefix || (row.enabled && !previous?.enabled))
            await assertPrefixDoesNotStealItemCommand(row);
    }
    await db.prefixSettings.bulkPut(updatedRows);
}
import { BRAND } from '../../../../shared-components/brandingConfig';
export const PREFIX_SETTING_SEED_VERSION = 14;
const PREFIX_SETTING_SEED_VERSION_STORAGE_KEY = BRAND.storageKeys.prefixSettingSeedVersion;
const LEGACY_PREFIX_SETTING_SEED_VERSION_STORAGE_KEY = BRAND.legacyStorageKeys.prefixSettingSeedVersion;
export async function syncPrefixSettingsFromSource(force = false): Promise<PrefixSettingRecord[]> {
    const chromeAny = typeof chrome !== 'undefined'
        ? chrome
        : typeof window !== 'undefined'
            ? (window as any)?.chrome
            : undefined;
    if (!force && chromeAny?.storage?.local) {
        try {
            const stored = await new Promise<any>(resolve => chromeAny.storage.local.get([PREFIX_SETTING_SEED_VERSION_STORAGE_KEY, LEGACY_PREFIX_SETTING_SEED_VERSION_STORAGE_KEY], resolve));
            const version = stored?.[PREFIX_SETTING_SEED_VERSION_STORAGE_KEY] ??
                stored?.[LEGACY_PREFIX_SETTING_SEED_VERSION_STORAGE_KEY];
            if (version === PREFIX_SETTING_SEED_VERSION) {
                const count = await db.prefixSettings.count();
                if (count > 0) {
                    return db.prefixSettings.orderBy('category').toArray();
                }
            }
        }
        catch {
            // Fall through to repair/sync if storage read fails
        }
    }
    const now = Date.now();
    const existingRows: PrefixSettingRecord[] = await db.prefixSettings.toArray();
    const removedRows = existingRows.filter(isRemovedPrefixSetting);
    if (removedRows.length > 0) {
        await db.prefixSettings.bulkDelete(removedRows.map(row => row.id));
    }
    const activeExistingRows: PrefixSettingRecord[] = existingRows.filter(row => !isRemovedPrefixSetting(row));
    const existingById = new Map<string, PrefixSettingRecord>(activeExistingRows.map(row => [row.id, row]));
    const clipPrefixRows = new Map(planWebClipPrefixDefaults(activeExistingRows, await db.userShortcuts.toArray(), now)
        .map(row => [row.id, row]));
    const nextRows: PrefixSettingRecord[] = [];
    for (const defaultRow of DEFAULT_PREFIX_ROWS) {
        const clipPrefix = clipPrefixRows.get(defaultRow.id);
        if (clipPrefix) { nextRows.push(clipPrefix); continue; }
        const existing = existingById.get(defaultRow.id);
        if (existing) {
            const existingPrefix = normalizePrefixSettingValue(existing.prefix);
            const shouldUseNewDefault = !existing.releasedTextCommandPrefix && (isLegacyDefaultPrefix(defaultRow.id, existingPrefix) ||
                (defaultRow.id === 'prefix_collection' && ['collect', 'collection'].includes(existingPrefix)) ||
                (defaultRow.type === 'subcommand' &&
                    isCurrentSubcommandPrefixValue(normalizePrefixSettingValue(defaultRow.prefix)) &&
                    !isCurrentSubcommandPrefixValue(existingPrefix)));
            const captureChoice = WEBSITE_COLLECTION_CAPTURE_CHOICES.find(choice => choice.id === defaultRow.category);
            const oldCaptureLabel = captureChoice && [captureChoice.commandLabel, `Web ${captureChoice.commandLabel}`]
                .some(label => label.toLowerCase() === existing.label.trim().toLowerCase());
            const shouldRenameLegacyLabel = Boolean(oldCaptureLabel) || (defaultRow.id === 'prefix_collection'
                && ['collection', 'collections', 'workspace collection', 'workspace collections'].includes(existing.label.trim().toLowerCase()));
            nextRows.push(toPrefixSettingRecord({
                id: defaultRow.id,
                type: defaultRow.type,
                category: defaultRow.category,
                label: shouldRenameLegacyLabel ? defaultRow.label : existing.label || defaultRow.label,
                prefix: shouldUseNewDefault ? defaultRow.prefix : existing.prefix || defaultRow.prefix,
                enabled: shouldUseNewDefault && defaultRow.enabled === false ? false : existing.enabled ?? defaultRow.enabled,
                releasedTextCommandPrefix: existing.releasedTextCommandPrefix,
                createdAt: existing.createdAt || now,
                updatedAt: shouldUseNewDefault || shouldRenameLegacyLabel ? now : existing.updatedAt || now,
            }));
        }
        else {
            nextRows.push({
                ...defaultRow,
                createdAt: now,
                updatedAt: now,
            });
        }
    }
    if (nextRows.length > 0) {
        await db.prefixSettings.bulkPut(nextRows);
    }
    // Only persist the seed version AFTER the transaction successfully completes
    if (chromeAny?.storage?.local) {
        chromeAny.storage.local.set({ [PREFIX_SETTING_SEED_VERSION_STORAGE_KEY]: PREFIX_SETTING_SEED_VERSION }).catch(() => { });
    }
    return db.prefixSettings.orderBy('category').toArray();
}
export async function migratePrefixSettingsFromLocalStorageToDexie(): Promise<{
    migratedCount: number;
    purged: boolean;
}> {
    await syncPrefixSettingsFromSource();
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
        return { migratedCount: 0, purged: false };
    }
    const storedData = await chrome.storage.local.get(LEGACY_PREFIX_SETTING_STORAGE_KEY);
    const legacy = storedData[LEGACY_PREFIX_SETTING_STORAGE_KEY] as Partial<CommandTerminalPrefixes> | undefined;
    let migratedCount = 0;
    if (legacy && typeof legacy === 'object') {
        const rows = (await db.prefixSettings.toArray()).filter(row => !isRemovedPrefixSetting(row));
        const now = Date.now();
        const updatedRows = rows.map(row => {
            if (!isSupportedPrefixKey(row.category))
                return row;
            const legacyPrefix = (legacy as any)[row.category];
            if (legacyPrefix === undefined)
                return row;
            migratedCount += 1;
            return toPrefixSettingRecord({
                ...row,
                prefix: normalizePrefixSettingValue(legacyPrefix),
                updatedAt: now,
            });
        });
        await validateUniquePrefixSettings(updatedRows);
        await db.prefixSettings.bulkPut(updatedRows);
    }
    await chrome.storage.local.remove(LEGACY_PREFIX_SETTING_STORAGE_KEY);
    await cleanupTextShortcutsForReservedPrefixes();
    return { migratedCount, purged: true };
}
export async function validateUniquePrefixSettings(rowsOrRow?: PrefixSettingRecord | PrefixSettingRecord[]): Promise<void> {
    let rows: PrefixSettingRecord[];
    if (Array.isArray(rowsOrRow)) {
        rows = rowsOrRow;
    }
    else if (rowsOrRow) {
        const existingRows = await db.prefixSettings.toArray();
        const foundExisting = existingRows.some(row => row.id === rowsOrRow.id);
        rows = foundExisting
            ? existingRows.map(row => (row.id === rowsOrRow.id ? rowsOrRow : row))
            : [...existingRows, rowsOrRow];
    }
    else {
        rows = await db.prefixSettings.toArray();
    }
    const seen = new Map<string, PrefixSettingRecord>();
    for (const row of rows) {
        if (!row.enabled)
            continue;
        const scope = getPrefixValidationScope(row);
        if (!scope)
            continue;
        const value = normalizePrefixSettingValue(row.prefix);
        if (!value)
            continue;
        if (WEBSITE_COLLECTION_CAPTURE_CHOICES.some(choice => choice.id === row.category)
            && WEBSITE_PAGE_EXTRACTION_DEFINITIONS.some(definition => !definition.prefixSettingCategory
                && normalizePrefixSettingValue(definition.fallbackPrefix) === value)) {
            throw new Error(`Prefix "${value}" is already used by a Page Extraction command. Choose a different Collection prefix.`);
        }
        const key = `${scope}:${value}`;
        const existing = seen.get(key);
        if (existing && existing.id !== row.id) {
            const existingLabel = existing.label || String(existing.category || 'another prefix');
            const currentLabel = row.label || String(row.category || 'this prefix');
            throw new Error(`Prefix "${value}" is already used by ${existingLabel}. Change ${currentLabel} to a different prefix.`);
        }
        seen.set(key, row);
    }
}
export async function cleanupTextShortcutsForReservedPrefixes(): Promise<void> {
    // Kept for old migration callers. Seed/restore must never delete item assignments.
    // Interactive updates reject collisions; explicit Overwrite is transactional.
}
async function assertPrefixDoesNotStealItemCommand(row: PrefixSettingRecord): Promise<void> {
    if (!row.enabled || !row.prefix)
        return;
    const shortcuts = await db.userShortcuts.toArray();
    if (shortcuts.some(shortcut => normalizePrefixSettingValue(shortcut.trigger) === normalizePrefixSettingValue(row.prefix))) {
        throw new Error(`Text command "${row.prefix}" is assigned to an item. Use the Text Command editor to review and approve Overwrite.`);
    }
}
