/**
 * Retired create command IDs replaced by prefix-category flows.
 *
 * UI create buttons may still use these strings as local action IDs, but they
 * should not be seeded, searched, or executed as command records.
 */
export const RETIRED_CREATE_COMMAND_IDS = new Set([
    'createnote',
    'createnotes',
    'createlink',
    'createlinks',
    'createtodo',
    'createsnippet',
    'createprompt',
    'agent'
]);
export const isRetiredCreateCommandId = (commandId: unknown) => RETIRED_CREATE_COMMAND_IDS.has(String(commandId || '').trim().toLowerCase());
