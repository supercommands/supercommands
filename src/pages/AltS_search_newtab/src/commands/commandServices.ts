import { createNewtabCommandServices } from '../../../../shared-components/commands/newtabCommandRuntime';
import type { CommandContext } from '../../../../shared-components/commands/types';
/** Page-level compatibility wrapper for the shared newtab command service builder. */
export function getCommandServices(state: any, baseServices: {
    toast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
    navigation: (view: any) => void;
    reload: () => void;
}): CommandContext['services'] {
    return createNewtabCommandServices(state, baseServices);
}
