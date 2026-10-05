import type { CommandRecord } from '../../allObjectFolder/src/createObject/commands/commandTypes';
export type CommandLike = Pick<CommandRecord, 'id' | 'label' | 'type' | 'surface' | 'prefix' | 'behavior'> & {
    commandId?: string;
};
export const normalizeCommandId = (value: string | null | undefined): string => {
    if (!value)
        return '';
    const trimmed = String(value).trim();
    return trimmed.startsWith('cmd_') ? trimmed.slice(4) : trimmed;
};
export const getCommandLookupKeys = (commandOrId: CommandLike | string): string[] => {
    const rawId = normalizeCommandId(typeof commandOrId === 'string' ? commandOrId : commandOrId?.id);
    if (!rawId)
        return [];
    const type = typeof commandOrId === 'string' ? '' : String(commandOrId?.type || '').trim();
    const keys = [rawId, `cmd_${rawId}`];
    if (type) {
        keys.push(`cmd_${rawId}_${type}`);
    }
    return Array.from(new Set(keys.filter(Boolean)));
};
export const findCommandByAnyId = <T extends {
    id: string;
}>(commands: T[], value: string | null | undefined): T | undefined => {
    const target = normalizeCommandId(value);
    if (!target)
        return undefined;
    return commands.find(command => normalizeCommandId(command.id) === target);
};
export const isCommandId = <T extends {
    id: string;
}>(commands: T[], value: string | null | undefined): boolean => {
    return Boolean(findCommandByAnyId(commands, value));
};
export const isLocalCommandId = <T extends {
    id: string;
    surface?: string;
}>(commands: T[], value: string | null | undefined): boolean => {
    const command = findCommandByAnyId(commands, value);
    return Boolean(command && command.surface !== 'website');
};
export const resolveCommandLookupKey = (commandOrId: CommandLike | string, maps: Array<Record<string, string> | undefined | null>): string => {
    const keys = getCommandLookupKeys(commandOrId);
    for (const key of keys) {
        if (maps.some(map => Boolean(map && map[key]))) {
            return key;
        }
    }
    return keys[0] || '';
};
