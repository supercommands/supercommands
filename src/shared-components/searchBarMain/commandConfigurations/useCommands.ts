import { useEffect, useMemo } from 'react';
import type { CommandDefinition } from './commands';
import { useDbStore } from '../../../storage/store/useDbStore';
import { syncCommandsFromSource } from '../../../allObjectFolder/src/createObject/commands/commandData';
import { SHARED_ALL_COMMANDS } from '../../../shared-components/commands';
import { resolveCommandPrefixFromSettings } from '../../../allObjectFolder/src/createObject/prefixSettings/prefixSettingDefaults';
const BASE_COMMANDS_BY_ID = new Map<string, CommandDefinition>((SHARED_ALL_COMMANDS as CommandDefinition[]).map(cmd => [cmd.id, cmd]));
/**
 * Hook to get user commands.
 * - Loads from local storage instantly on mount.
 * - Only fetches from API when user refresh counter indicates a change.
 * - Multiple simultaneous instances share a single network request.
 * - All instances stay in sync via chrome.storage.onChanged.
 */
export const useCommands = () => {
    useEffect(() => {
        useDbStore.getState().initDbSync();
    }, []);
    const records = useDbStore(state => state.commands);
    const prefixSettings = useDbStore(state => state.prefixSettings);
    const loading = useDbStore(state => !state.isInitialized);
    const commands = useMemo(() => {
        return records.map(record => {
            const base = BASE_COMMANDS_BY_ID.get(record.id);
            const fallbackPrefix = record.prefix !== undefined ? record.prefix : (base?.prefix !== undefined ? base.prefix : `/${record.id}`);
            return {
                id: record.id as CommandDefinition['id'],
                label: record.label || base?.label || record.id,
                prefix: resolveCommandPrefixFromSettings(record.id, fallbackPrefix, prefixSettings),
                urlTemplate: (record.urlTemplate as string | undefined) || base?.urlTemplate || '',
                iconHost: record.iconHost || base?.iconHost || '',
                icon: record.icon || base?.icon,
                type: (record.type as CommandDefinition['type']) || base?.type,
                autoSubmit: base?.autoSubmit,
                keywords: (record as any).keywords || base?.keywords || [record.id, record.label, fallbackPrefix].filter(Boolean) as string[],
                category: (record.category as CommandDefinition['category']) || base?.category,
                hotkey: (record as any).hotkey || base?.hotkey,
            } as CommandDefinition;
        });
    }, [prefixSettings, records]);
    return { commands, loading, refreshCommands: syncCommandsFromSource };
};
