import type * as React from 'react';
import DefaultCommandsList from '../../../landingPage/views/DefaultCommandsList';
import type { CommandRecord } from '../../../../../../allObjectFolder/src/createObject/commands/commandTypes';
import type { CommandId } from '../../../../../../shared-components/searchBarMain/commandConfigurations/commands';
import type { LocalCommandId } from '../../../../../../shared-components/searchBarMain/commandConfigurations/localCommands';

interface DefaultCommandsWidgetProps {
  favoriteIdSet?: Set<string>;
  userCommandsMap?: Record<string, CommandRecord>;
  isLoggedIn?: boolean;
  isEditMode?: boolean;
  onQuickCommandSelect?: (commandId: CommandId | LocalCommandId | 'ai' | 'collections') => void;
}

const DefaultCommandsWidget: React.FC<DefaultCommandsWidgetProps> = ({
  favoriteIdSet = new Set(),
  userCommandsMap = {},
  isLoggedIn = true,
  isEditMode = false,
  onQuickCommandSelect,
}) => {
  return (
    <div className="h-full w-full overflow-hidden">
      <DefaultCommandsList
        favoriteIdSet={favoriteIdSet}
        userCommandsMap={userCommandsMap}
        isLoggedIn={isLoggedIn}
        onQuickCommandSelect={commandId => {
          if (isEditMode) return;
          onQuickCommandSelect?.(commandId);
        }}
        onSnippetSelect={() => {}}
        onRequestSnippetDelete={() => {}}
      />
    </div>
  );
};

export default DefaultCommandsWidget;
