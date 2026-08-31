import * as React from 'react';
import { useMemo, forwardRef, type ReactNode } from 'react';
import {
  AI_GROUP,
  type CommandId,
} from '../../../../../shared-components/searchBarMain/commandConfigurations/commands';
import { getCommandKeywords } from '../../../../../shared-components/searchBarMain/commandConfigurations/commandKeywords';
import type { CommandRecord } from '../../../../../allObjectFolder/src/createObject/commands/commandTypes';
import { useAppearance } from '@extension/ui';
import DefaultContainer, {
  type DefaultContainerProps,
  type DefaultContainerHandle,
  type CommandInteractiveItem,
  type InteractiveSection,
} from './defaultContainer';

export interface DefaultCommandsListProps extends Omit<DefaultContainerProps, 'sections'> {
  favoriteIdSet: Set<string>;
  userCommandsMap: Record<string, CommandRecord>;
}

const COMMAND_SHORTLIST: Array<CommandId | 'ai' | 'collections'> = [];

const AI_ICON_HOSTS = ['chatgpt.com', 'claude.ai', 'gemini.google.com', 'perplexity.ai'];

const COMMAND_DESCRIPTIONS: Partial<Record<string, string>> = {
  gpt: 'Jump straight into a new ChatGPT conversation.',
  perplexity: 'Search with Perplexity AI assistant.',
  ai: 'Search across all AI assistants at once.',
  google: 'Search the web with Google.',
  event: 'Create a Google Calendar event quickly.',
  createnotes: 'Capture a reusable snippet right from search.',
  createlinks: 'Group your go-to websites and launch in a click.',
  agent: 'Open the AI agent interface.',
  todo: 'Manage your personal tasks and reminders.',
  collections: 'Access all your saved collections and snippets.',
} as const;

export const DefaultCommandsList = forwardRef<DefaultContainerHandle, DefaultCommandsListProps>((props, ref) => {
  const { favoriteIdSet, userCommandsMap, ...containerProps } = props;
  const { theme } = useAppearance();
  const isLightTheme = !theme.isDark;

  const iconClassName = isLightTheme
    ? 'w-4 h-4 shrink-0 transition-colors text-[var(--color-iconDefault)] group-hover:text-[var(--color-iconDefault)]'
    : 'w-4 h-4 shrink-0 transition-colors text-neutral-400 group-hover:text-neutral-200';

  const commandItems = useMemo<CommandInteractiveItem[]>(() => {
    return COMMAND_SHORTLIST.map(id => {
      if (id === 'ai') {
        return {
          kind: 'command' as const,
          id: `command-${id}`,
          commandId: id,
          label: AI_GROUP.label,
          description: COMMAND_DESCRIPTIONS[id] ?? 'Run this command.',
          iconHosts: AI_ICON_HOSTS,
          keywords: ['ai', 'assistants', 'all ai'],
          iconStack: true,
          isFavorite: favoriteIdSet.has(id),
          shortcut: undefined,
        };
      }

      const stored = userCommandsMap[id];
      let customIcon: ReactNode = undefined;
      if (id === 'collections') {
        customIcon = (
          <svg
            className={iconClassName}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
          </svg>
        );
      }

      return {
        kind: 'command' as const,
        id: `command-${id}`,
        commandId: id as any,
        label: id === 'collections' ? 'All Command Shortcuts' : '',
        description: COMMAND_DESCRIPTIONS[id] ?? `Open ${id}.`,
        iconHosts: [],
        icon: customIcon,
        keywords: id === 'collections' ? ['collections', 'all', 'folders'] : getCommandKeywords(id as CommandId),
        iconStack: false,
        isFavorite: favoriteIdSet.has(id),
        shortcut: id === 'collections' ? undefined : stored ? stored.prefix : undefined,
      };
    }).filter(Boolean) as CommandInteractiveItem[];
  }, [favoriteIdSet, userCommandsMap]);

  const sections = useMemo<InteractiveSection[]>(() => {
    const list: InteractiveSection[] = [];
    if (commandItems.length > 0) {
      list.push({
        key: 'recommended',
        title: '',
        items: commandItems,
        emptyMessage: 'No suggestions yet. Try creating or saving items.',
      });
    }
    
    if (!list.length) {
      list.push({
        key: 'empty',
        title: 'Results',
        items: [],
        emptyMessage: 'Nothing here yet. Try creating a note or saving a link.',
      });
    }

    return list;
  }, [commandItems]);

  return <DefaultContainer ref={ref} sections={sections} {...containerProps} />;
});

DefaultCommandsList.displayName = 'DefaultCommandsList';
export default DefaultCommandsList;
