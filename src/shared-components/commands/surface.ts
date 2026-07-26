import { ALL_COMMANDS } from './allCommands';
import type { CommandModule } from './types';

export const filterWebsiteOnlyCommands = <T extends Pick<CommandModule, 'category' | 'isAvailable'>>(
  commands: T[],
): T[] => {
  return commands.filter(
    command =>
      ((command as unknown as CommandModule).surface !== 'website') &&
      command.category !== 'thissite_action' &&
      command.category !== 'page_action' &&
      typeof command.isAvailable !== 'function',
  );
};

export const SHARED_ALL_COMMANDS: CommandModule[] = ALL_COMMANDS;
export const SHARED_NEWTAB_COMMANDS: CommandModule[] = filterWebsiteOnlyCommands(ALL_COMMANDS);
