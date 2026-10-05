/**
 * @file commandHooks.ts
 * @description Provides React hooks for fetching and subscribing to command records from the DB.
 * Automatically synchronizes commands from source upon component mounting.
 *
 * @usage
 * ```tsx
 * import { useCommand, useCommands } from './commandHooks';
 * const commands = useCommands('website');
 * ```
 */
import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getAllCommands, getCommand, getCommandsBySurface, syncCommandsFromSource } from './commandData';
import type { CommandRecord } from './commandTypes';
export function useCommand(id: string | null) {
    useEffect(() => {
        syncCommandsFromSource().catch(() => { });
    }, []);
    return useLiveQuery(() => (id ? getCommand(id) : undefined), [id]);
}
export function useCommands(surface?: CommandRecord['surface']) {
    useEffect(() => {
        syncCommandsFromSource().catch(() => { });
    }, []);
    return useLiveQuery(async () => {
        if (surface) {
            return getCommandsBySurface(surface);
        }
        return getAllCommands();
    }, [surface], []);
}
