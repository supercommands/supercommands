import React from 'react';
import NotificationContainer from '../../../../shared-components/notifications/NotificationContainer';
// Workspace creation is only allowed from onboarding for now.
// import CreateWorkspacePanel from '../../../../settings/allWorkspaceManager/workspaces/ui/CreateWorkspacePanel';
const GlobalAltCPopup = React.lazy(() => import('../../../../allObjectFolder/src/altcPopup/globalAltCPopup').then(m => ({
    default: m.GlobalAltCPopup,
})));
import { executeRetiredCreateUiAction } from '../../../../shared-components/commands/newtabCommandRuntime';
interface AppModalsProps {
    createOrganisationModal: any;
    setCreateOrganisationModal: any;
    backgroundRefresh: () => void;
    isGlobalCreateMenuOpen: boolean;
    setIsGlobalCreateMenuOpen: (v: boolean) => void;
    openSpreadsheetView: (mode: string) => void;
    searchbarRef: React.RefObject<any>;
}
export const AppModals: React.FC<AppModalsProps> = ({ createOrganisationModal, setCreateOrganisationModal, backgroundRefresh, isGlobalCreateMenuOpen, setIsGlobalCreateMenuOpen, openSpreadsheetView, searchbarRef, }) => {
    return (<>
      <NotificationContainer />

      {isGlobalCreateMenuOpen && (<React.Suspense fallback={null}>
          <GlobalAltCPopup isOpen={isGlobalCreateMenuOpen} onClose={() => setIsGlobalCreateMenuOpen(false)} onCommandSelect={commandId => {
                if (commandId === 'collections') {
                    openSpreadsheetView('collections');
                    return;
                }
                if (executeRetiredCreateUiAction(commandId, { includeCreateMenuAi: true })) {
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
            }}/>
        </React.Suspense>)}
    </>);
};
