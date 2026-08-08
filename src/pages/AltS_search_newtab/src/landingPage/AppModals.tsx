import type * as React from 'react';
import AutomationStatusIndicator from '../../../../allObjectFolder/src/createObject/automationBeta/ui/automationStatusIndicator';
import NotificationContainer from '../../../../shared-components/notifications/NotificationContainer';
import CreateWorkspacePanel from '../../../../settings/allWorkspaceManager/workspaces/ui/CreateWorkspacePanel';
import { GlobalAltCPopup } from '../../../../allObjectFolder/src/altcPopup/globalAltCPopup';
import { useUIStore } from '../../../../shared-components/uiStateManager';

interface AppModalsProps {
  createWorkspaceModal: any;
  setCreateWorkspaceModal: any;
  backgroundRefresh: () => void;
  isGlobalCreateMenuOpen: boolean;
  setIsGlobalCreateMenuOpen: (v: boolean) => void;
  openSpreadsheetView: (mode: string) => void;
  searchbarRef: React.RefObject<any>;
}

export const AppModals: React.FC<AppModalsProps> = ({
  createWorkspaceModal,
  setCreateWorkspaceModal,
  backgroundRefresh,
  isGlobalCreateMenuOpen,
  setIsGlobalCreateMenuOpen,
  openSpreadsheetView,
  searchbarRef,
}) => {
  return (
    <>
      <AutomationStatusIndicator />
      <NotificationContainer />

      <GlobalAltCPopup
        isOpen={isGlobalCreateMenuOpen}
        onClose={() => setIsGlobalCreateMenuOpen(false)}
        onCommandSelect={commandId => {
          if (commandId === 'collections') {
            openSpreadsheetView('collections');
            return;
          }
          if (commandId === 'saved-automation') {
            openSpreadsheetView('saved-automation');
            return;
          }
          if (commandId === 'createtodo') {
            useUIStore
              .getState()
              .openEditor({ type: 'todo', id: 'todo-create', props: { prefill: { isCreateModalOnly: true } } });
            return;
          }
          if (commandId === 'ai') {
            useUIStore.getState().openCreateItem('aiPrompt', { id: 'new', props: {} });
            return;
          }
          if (commandId === 'createprompt') {
            useUIStore.getState().openCreateItem('aiPrompt', { id: 'new', props: {} });
            return;
          }
          if (searchbarRef.current) {
            searchbarRef.current.clear();
            setTimeout(() => {
              const mode = commandId === 'store' ? 'lock' : 'execute';
              searchbarRef.current?.executeCommand(commandId as any, { mode });
              searchbarRef.current?.focus();
            }, 10);
          }
        }}
      />
    </>
  );
};
