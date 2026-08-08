import type * as React from 'react';
import { AppSidebar } from './AppSidebar/AppSidebar';
import { LeftSideWidget } from '../components/widgets/components/leftSideWidget';
import { useUIStore } from '../../../../shared-components/uiStateManager';

interface AppLeftSidebarProps {
  showSidebarColumn: boolean;
  hasActivePopup: boolean;
  backgroundRefresh: () => void;

  openSpreadsheetView: (section?: string) => void;
  searchbarRef: React.RefObject<any>;
  setIsSpreadsheetViewOpen: (v: boolean) => void;
  savedAgentById: Map<string, any>;
  handleNavigateToListView: (type: 'notes' | 'links' | 'commands', section?: string) => void;
  handleFavoriteLinkEdit: (suggestion: any) => void;
  hideCreatePanelItems?: boolean;
}

export const AppLeftSidebar: React.FC<AppLeftSidebarProps> = ({
  showSidebarColumn,
  hasActivePopup,
  backgroundRefresh,

  openSpreadsheetView,
  searchbarRef,
  setIsSpreadsheetViewOpen,
  savedAgentById,
  handleNavigateToListView,
  handleFavoriteLinkEdit,
  hideCreatePanelItems,
}) => {
  const activeView = useUIStore(s => s.activeView);
  const isSettings = activeView?.type === 'settings';

  return (
    <>
      {/* Left Sidebar: AppSidebar (Favorites / Notes / Links) */}
      {showSidebarColumn && (
        <div
          className={`h-full shrink-0 flex flex-col pt-[56px] border-r border-neutral-200 dark:border-white/10 shadow-2xl z-30
              bg-[var(--color-sidebarBg)]
            `}
          style={{
            width: '280px',
          }}>
          {hideCreatePanelItems ? (
            <LeftSideWidget />
          ) : (
            <AppSidebar
              searchbarRef={searchbarRef}
              reload={backgroundRefresh}
              isSidebar={true}
              hideCreatePanelItems={hideCreatePanelItems}
              openSpreadsheetView={openSpreadsheetView}
              onCommandSelect={commandId => {
                console.log('[AppLeftSidebar] onCommandSelect triggered with commandId:', commandId);
                const needsHomeRoute =
                  !searchbarRef.current ||
                  activeView?.type === 'subscriptions' ||
                  activeView?.type === 'manageSubscription' ||
                  activeView?.type === 'organizationSettings' ||
                  activeView?.type === 'createFolder' ||
                  activeView?.type === 'createWorkspace' ||
                  activeView?.type === 'settings' ||
                  activeView?.type === 'sharedFolderCreation';

                if (commandId === 'collections') {
                  console.log('[AppLeftSidebar] Routing collections');
                  if (needsHomeRoute) {
                    useUIStore.getState().setView({ type: 'home' });
                  }
                  openSpreadsheetView('collections');
                  return;
                }
                // 'todo' opens the left-side todo panel, not the searchbar
                if (commandId === 'todo') {
                  if (needsHomeRoute) {
                    useUIStore.getState().setView({ type: 'home' });
                  }
                  useUIStore.getState().setSidebar('todoSidebar', { open: true });
                  return;
                }
                if (commandId === 'createtodo') {
                  if (needsHomeRoute) {
                    useUIStore.getState().setView({ type: 'home' });
                  }
                  useUIStore.getState().setTodoCreatePrefill({ isCreateModalOnly: true } as any);
                  useUIStore
                    .getState()
                    .openEditor({ type: 'todo', id: 'todo-create', props: { prefill: { isCreateModalOnly: true } } });
                  return;
                }
                if (commandId === 'createfolder') {
                  useUIStore.getState().clearEditorStates();
                  useUIStore.getState().openCreateFolder();
                  return;
                }
                if (commandId === 'createworkspace') {
                  useUIStore.getState().clearEditorStates();
                  useUIStore.getState().openCreateWorkspace();
                  return;
                }
                if (commandId === 'ai') {
                  searchbarRef.current?.clear();
                  useUIStore.getState().setLockedCommand(null);
                  useUIStore.getState().openCreateItem('aiPrompt', { id: 'new', props: {} });
                  return;
                }
                if (commandId === 'createprompt') {
                  if (needsHomeRoute) {
                    useUIStore.getState().setView({ type: 'home' });
                  }
                  searchbarRef.current?.clear();
                  useUIStore.getState().setLockedCommand(null);
                  useUIStore.getState().openCreateItem('aiPrompt', { id: 'new', props: {} });
                  return;
                }
                const mode = commandId === 'saved-automation' || commandId === 'store' ? 'lock' : 'execute';
                console.log(
                  '[AppLeftSidebar] Processing commandId',
                  commandId,
                  'with mode',
                  mode,
                  'needsHomeRoute:',
                  needsHomeRoute,
                );
                if (needsHomeRoute) {
                  console.log(
                    '[AppLeftSidebar] Setting pending locked command because searchbar is null or view needs reset',
                  );
                  useUIStore.getState().setView({ type: 'home' });
                  useUIStore.getState().setPendingLockedCommand({ commandId, mode });
                } else if (searchbarRef.current) {
                  console.log('[AppLeftSidebar] Executing command via searchbarRef:', commandId);
                  searchbarRef.current.clear();
                  setTimeout(() => {
                    searchbarRef.current?.executeCommand(commandId as any, { mode });
                    searchbarRef.current?.focus();
                  }, 10);
                }
              }}
              onAutomationSelect={automation => {
                const isOrgOrBillingView =
                  activeView?.type === 'subscriptions' ||
                  activeView?.type === 'manageSubscription' ||
                  activeView?.type === 'organizationSettings';
                setIsSpreadsheetViewOpen(false);
                if (isOrgOrBillingView) {
                  useUIStore.getState().setView({ type: 'home' });
                  useUIStore.getState().setPendingAutomation(automation);
                } else if (searchbarRef.current) {
                  searchbarRef.current.clear();
                  setTimeout(() => {
                    searchbarRef.current?.activateAutomation(automation);
                    searchbarRef.current?.focus();
                  }, 10);
                }
              }}
              onSelectSavedAgent={agent => {
                const isOrgOrBillingView =
                  activeView?.type === 'subscriptions' ||
                  activeView?.type === 'manageSubscription' ||
                  activeView?.type === 'organizationSettings' ||
                  false;
                setIsSpreadsheetViewOpen(false);

                const candidateIds = [
                  agent?.id,
                  agent?.automation_id,
                  agent?.automation?.id,
                  agent?.automation?.automation_id,
                ]
                  .map(val => String(val || ''))
                  .filter(Boolean);

                const resolvedAgent = candidateIds.map(id => savedAgentById.get(id)).find(Boolean) || agent;

                if (isOrgOrBillingView) {
                  useUIStore.getState().setView({ type: 'home' });
                  useUIStore.getState().setPendingAgent(resolvedAgent);
                } else if (searchbarRef.current) {
                  setTimeout(() => {
                    searchbarRef.current?.selectSavedAgent(resolvedAgent);
                    searchbarRef.current?.focus();
                  }, 10);
                }
              }}
              onNavigateToListView={(type, section) => {
                const isOrgOrBillingView =
                  activeView?.type === 'subscriptions' ||
                  activeView?.type === 'manageSubscription' ||
                  activeView?.type === 'organizationSettings' ||
                  false;
                if (isOrgOrBillingView) {
                  useUIStore.getState().setView({ type: 'home' });
                }
                handleNavigateToListView(type, section);
              }}
              onRequestEditLink={handleFavoriteLinkEdit}
            />
          )}
        </div>
      )}
    </>
  );
};
