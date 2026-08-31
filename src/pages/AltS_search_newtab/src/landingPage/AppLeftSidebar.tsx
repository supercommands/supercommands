import type * as React from 'react';
import { AppSidebar } from './AppSidebar/AppSidebar';
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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

import { useLeftSidebarLayout } from './useLeftSidebarLayout';

const CollapseIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <path d="M16 15l-3-3 3-3" />
  </svg>
);

const ExpandIcon = ({ size = 18 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <path d="M13 9l3 3-3 3" />
  </svg>
);

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
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const activeView = useUIStore(s => s.activeView);
  const isSettings = activeView?.type === 'settings';
  
  const { width, widthMode } = useLeftSidebarLayout();

  if (hideCreatePanelItems) {
    return null;
  }

  return (
    <>
      {/* Left Sidebar: AppSidebar (Favorites / Notes / Links) */}
      {showSidebarColumn && (
        <div
          className={`h-full shrink-0 flex flex-col pt-[56px] border-r border-[var(--color-borderDefault)] z-30 bg-[var(--color-appSidebarBg,var(--color-sidebarBg))] transition-all duration-300`}
          style={{
            width: isCollapsed ? '76px' : '240px',
            overflowX: 'hidden',
            zoom: widthMode === 'intermediateDesktop' ? 0.92 : widthMode === 'minimumDesktop' ? 0.78 : widthMode === 'belowMinimum' ? 0.64 : 1
          }}>
          <div className="flex-1 min-h-0 overflow-hidden relative">
            <AppSidebar
                searchbarRef={searchbarRef}
                reload={backgroundRefresh}
                isSidebar={true}
                widthMode={widthMode}
                hideCreatePanelItems={hideCreatePanelItems}
                isCollapsed={isCollapsed}
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
                // Workspace/folder creation is only allowed from onboarding for now.
                // if (commandId === 'createfolder') {
                //   useUIStore.getState().clearEditorStates();
                //   useUIStore.getState().openCreateFolder();
                //   return;
                // }
                // if (commandId === 'createworkspace') {
                //   useUIStore.getState().clearEditorStates();
                //   useUIStore.getState().openCreateWorkspace();
                //   return;
                // }
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
              onNavigateToListView={handleNavigateToListView}
              onRequestEditLink={handleFavoriteLinkEdit}
            />
          </div>
          <div className="w-full py-3 pl-2 pr-3 bg-transparent flex items-center justify-start z-50 shrink-0">
            <button
              type="button"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={onToggleCollapse}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-textMuted)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] transition-colors focus-visible:outline-none cursor-pointer"
            >
              {isCollapsed ? <ExpandIcon size={18} /> : <CollapseIcon size={18} />}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
