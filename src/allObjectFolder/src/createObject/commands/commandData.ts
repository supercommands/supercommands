/**
 * @file commandData.ts
 * @description Manages database logic (CRUD) for Command records in IndexedDB.
 * Handles synchronizing commands from the default command registry into the local database.
 *
 * @usage
 * ```ts
 * import { syncCommandsFromSource, getAllCommands } from './commandData';
 * await syncCommandsFromSource();
 * ```
 */
import { db } from '../../../../storage/indexDB/dbConfig';
import { generateEntityId } from '../../../../shared-components/utils/idGenerator';
import { ALL_COMMANDS } from '../../../../shared-components/commands';
import { RETIRED_CREATE_COMMAND_IDS } from '../../../../shared-components/commands/prefixCategoryReplacements';
import { normalizePrefix } from '../../../../shared-components/commands/utils';
import type { CommandModule } from '../../../../shared-components/commands';
import { getCommandPrefixSettingKey, resolveCommandPrefixFromSettings, } from '../prefixSettings/prefixSettingDefaults';
import { syncPrefixSettingsFromSource, updatePrefixSetting as updatePrefixSettingData, } from '../prefixSettings/prefixSettingData';
import type { CommandRecord, CreateCommandInput, UpdateCommandInput, } from './commandTypes';
export async function createCommand(input: CreateCommandInput): Promise<CommandRecord> {
    const now = Date.now();
    const command: CommandRecord = {
        id: input.id || generateEntityId('command'),
        label: input.label.trim(),
        prefix: normalizePrefix(input.prefix),
        behavior: input.behavior,
        surface: input.surface,
        site: input.site,
        pageType: input.pageType,
        iconHost: input.iconHost,
        category: input.category,
        type: (input as any).type,
        urlTemplate: (input as any).urlTemplate,
        enabled: input.enabled ?? true,
        updatedAt: now,
    };
    await db.commands.put(command);
    return command;
}
export async function updateCommand(commandId: string, input: UpdateCommandInput): Promise<CommandRecord> {
    const existing = await db.commands.get(commandId);
    if (!existing) {
        throw new Error('Command not found.');
    }
    const prefixSettingKey = input.prefix !== undefined ? getCommandPrefixSettingKey(commandId) : null;
    if (prefixSettingKey) {
        let prefixSetting = await db.prefixSettings
            .where('category')
            .equals(prefixSettingKey)
            .first();
        if (!prefixSetting) {
            await syncPrefixSettingsFromSource().catch(() => []);
            prefixSetting = await db.prefixSettings
                .where('category')
                .equals(prefixSettingKey)
                .first();
        }
        if (prefixSetting) {
            await updatePrefixSettingData(prefixSetting.id, { prefix: input.prefix });
        }
    }
    const updated: CommandRecord = {
        ...existing,
        label: input.label !== undefined ? input.label.trim() : existing.label,
        prefix: input.prefix !== undefined && !prefixSettingKey ? normalizePrefix(input.prefix) : existing.prefix,
        behavior: input.behavior ?? existing.behavior,
        surface: input.surface !== undefined ? input.surface : existing.surface,
        site: input.site !== undefined ? input.site : existing.site,
        pageType: input.pageType !== undefined ? input.pageType : existing.pageType,
        iconHost: input.iconHost !== undefined ? input.iconHost : existing.iconHost,
        category: input.category !== undefined ? input.category : existing.category,
        type: (input as any).type !== undefined ? (input as any).type : existing.type,
        urlTemplate: (input as any).urlTemplate !== undefined ? (input as any).urlTemplate : existing.urlTemplate,
        enabled: input.enabled ?? existing.enabled,
        updatedAt: Date.now(),
    };
    await db.commands.put(updated);
    return hydrateCommandPrefixes([updated]).then(commands => commands[0]);
}
export async function getCommand(id: string): Promise<CommandRecord | undefined> {
    const command = await db.commands.get(id);
    if (!command)
        return undefined;
    const [resolved] = await hydrateCommandPrefixes([command]);
    return resolved;
}
export async function getAllCommands(): Promise<CommandRecord[]> {
    return hydrateCommandPrefixes(await db.commands.orderBy('label').toArray());
}
export async function getCommandsBySurface(surface: CommandRecord['surface']): Promise<CommandRecord[]> {
    if (!surface) {
        return getAllCommands();
    }
    return hydrateCommandPrefixes(await db.commands.where('surface').anyOf(surface, 'both').toArray());
}
export async function deleteCommand(id: string): Promise<void> {
    await db.commands.delete(id);
}
function toCommandRecord(command: CommandModule): CommandRecord {
    return {
        id: command.id,
        label: command.label,
        prefix: normalizePrefix(command.prefix),
        behavior: command.behavior as CommandRecord['behavior'],
        surface: command.surface ??
            (command.category === 'page_action' || command.category === 'thissite_action' || typeof command.isAvailable === 'function'
                ? 'website'
                : 'both'),
        iconHost: command.iconHost,
        category: command.category,
        type: (command as any).type,
        urlTemplate: (command as any).urlTemplate,
        enabled: true,
        showInDashboard: command.showInDashboard,
        updatedAt: Date.now(),
    };
}
export async function hydrateCommandPrefixes(commands: CommandRecord[]): Promise<CommandRecord[]> {
    const prefixRows = await db.prefixSettings.toArray().catch(() => []);
    return commands.map(command => ({
        ...command,
        prefix: resolveCommandPrefixFromSettings(command.id, command.prefix, prefixRows),
    }));
}
import { BRAND } from '../../../../shared-components/brandingConfig';
export function getSeedCommands(): CommandRecord[] {
    return ALL_COMMANDS.map(toCommandRecord);
}
export const COMMAND_SEED_VERSION = 3;
const COMMAND_SEED_VERSION_STORAGE_KEY = BRAND.storageKeys.commandSeedVersion;
const LEGACY_COMMAND_SEED_VERSION_STORAGE_KEY = BRAND.legacyStorageKeys.commandSeedVersion;
export async function syncCommandsFromSource(force = false): Promise<CommandRecord[]> {
    const chromeAny = typeof chrome !== 'undefined'
        ? chrome
        : typeof window !== 'undefined'
            ? (window as any)?.chrome
            : undefined;
    if (!force && chromeAny?.storage?.local) {
        try {
            const stored = await new Promise<any>(resolve => chromeAny.storage.local.get([COMMAND_SEED_VERSION_STORAGE_KEY, LEGACY_COMMAND_SEED_VERSION_STORAGE_KEY], resolve));
            const version = stored?.[COMMAND_SEED_VERSION_STORAGE_KEY] ?? stored?.[LEGACY_COMMAND_SEED_VERSION_STORAGE_KEY];
            if (version === COMMAND_SEED_VERSION) {
                const count = await db.commands.count();
                if (count > 0) {
                    return getAllCommands();
                }
            }
        }
        catch {
            // Fall through to repair/sync if storage read fails
        }
    }
    await syncPrefixSettingsFromSource().catch(() => []);
    const seedCommands = getSeedCommands();
    // The command catalog is source-of-truth data. Always upsert the full seed so
    // older partial tables get repaired and new commands are added automatically.
    //
    // Important: we intentionally do not persist React icon values here because
    // IndexedDB uses structured clone and cannot reliably store React elements or
    // component references. The UI hydrates icons from the in-memory registry.
    const allowedIds = new Set(seedCommands.map(command => command.id));
    await db.transaction('rw', db.commands, async () => {
        await db.commands.bulkPut(seedCommands);
        const staleIds = (await db.commands.toArray())
            .filter(command => !allowedIds.has(command.id) || RETIRED_CREATE_COMMAND_IDS.has(String(command.id || '').toLowerCase()))
            .map(command => command.id);
        if (staleIds.length > 0) {
            await db.commands.bulkDelete(staleIds);
        }
    });
    // Only persist the seed version AFTER the transaction successfully completes
    if (chromeAny?.storage?.local) {
        chromeAny.storage.local.set({ [COMMAND_SEED_VERSION_STORAGE_KEY]: COMMAND_SEED_VERSION }).catch(() => { });
    }
    return getAllCommands();
}
export const seedCommandsIfNeeded = syncCommandsFromSource;
