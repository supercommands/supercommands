import type React from 'react';
import { AppSidebar } from './AppSidebar/AppSidebar';
import { useUIStore } from '../../../../shared-components/uiStateManager';
import { executeRetiredCreateUiAction, isRetiredCreateUiActionId, } from '../../../../shared-components/commands/newtabCommandRuntime';
interface AppLeftSidebarProps {
    showSidebarColumn: boolean;
    backgroundRefresh: () => void;
    openSpreadsheetView: (section?: string) => void;
    searchbarRef: React.RefObject<any>;
    setIsSpreadsheetViewOpen: (v: boolean) => void;
    savedAgentById: Map<string, any>;
    handleNavigateToListView: (type: 'notes' | 'links' | 'commands', section?: string) => void;
    handleFavoriteLinkEdit: (suggestion: any) => void;
    hideCreatePanelItems?: boolean;
    isIconOnly?: boolean;
    onOpenShortcuts?: () => void;
    onOpenCommands?: () => void;
}
import { LEFT_SIDEBAR_WIDTHS, useLeftSidebarLayout } from './useLeftSidebarLayout';
export const AppLeftSidebar: React.FC<AppLeftSidebarProps> = ({ showSidebarColumn, backgroundRefresh, openSpreadsheetView, searchbarRef, setIsSpreadsheetViewOpen, savedAgentById, handleNavigateToListView, handleFavoriteLinkEdit, hideCreatePanelItems, isIconOnly = false, onOpenShortcuts, onOpenCommands, }) => {
    const activeView = useUIStore(s => s.activeView);
    const { widthMode } = useLeftSidebarLayout();
    const isCollapsed = isIconOnly;
    if (hideCreatePanelItems) {
        return null;
    }
    return (<>
      {/* Left Sidebar: AppSidebar (Favorites / Notes / Links) */}
      {showSidebarColumn && (<div className={`h-full shrink-0 flex flex-col pt-[56px] border-r border-[var(--color-borderDefault)] z-30 bg-[var(--color-appSidebarBg,var(--color-sidebarBg))] transition-all duration-300`} style={{
                width: isIconOnly ? `${LEFT_SIDEBAR_WIDTHS.iconOnly}px` : `${LEFT_SIDEBAR_WIDTHS.readableCollapsed}px`,
                overflowX: 'hidden',
            }}>
          <div className="flex-1 min-h-0 overflow-hidden relative">
            <AppSidebar searchbarRef={searchbarRef} reload={backgroundRefresh} isSidebar={true} widthMode={widthMode} hideCreatePanelItems={hideCreatePanelItems} isCollapsed={isCollapsed} isIconOnly={isIconOnly} onOpenShortcuts={onOpenShortcuts} openSpreadsheetView={openSpreadsheetView} onCommandSelect={commandId => {
                console.log('[AppLeftSidebar] onCommandSelect triggered with commandId:', commandId);
                if (commandId === 'commands') {
                    onOpenCommands?.();
                    searchbarRef.current?.clear();
                    const ui = useUIStore.getState();
                    ui.clearEditorStates();
                    ui.setLockedCommand(null);
                    if (ui.isSheetOpen) ui.closeSheet();
                    ui.setKnowledgeExplorerMode('spreadsheet');
                    ui.setView({ type: 'knowledgeGraph' });
                    return;
                }
                if (commandId === 'createcollections') {
                    setIsSpreadsheetViewOpen(false);
                    searchbarRef.current?.clear();
                    useUIStore.getState().clearEditorStates();
                    useUIStore.getState().setSelectedSnippet(null);
                    useUIStore.getState().setSelectedSnippetId(null);
                    useUIStore.getState().setLockedCommand(null);
                    if (useUIStore.getState().isSheetOpen) {
                        useUIStore.getState().closeSheet();
                    }
                    useUIStore.getState().setView({ type: 'collections' });
                    return;
                }
                const needsHomeRoute = !searchbarRef.current ||
                    activeView?.type === 'collections' ||
                    activeView?.type === 'timeline' ||
                    activeView?.type === 'knowledgeGraph' ||
                    activeView?.type === 'createOrganisation' ||
                    activeView?.type === 'settings' ||
                    false;
                if (commandId === 'collections') {
                    console.log('[AppLeftSidebar] Routing collections');
                    if (needsHomeRoute) {
                        useUIStore.getState().setView({ type: 'home' });
                    }
                    openSpreadsheetView('collections');
                    return;
                }
                if (needsHomeRoute && isRetiredCreateUiActionId(commandId, { includeCreateMenuAi: true })) {
                    useUIStore.getState().setView({ type: 'home' });
                }
                if (executeRetiredCreateUiAction(commandId, { includeCreateMenuAi: true })) {
                    searchbarRef.current?.clear();
                    useUIStore.getState().setLockedCommand(null);
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
                //   useUIStore.getState().clearEditorStates();
                //   return;
                // }
                // if (commandId === 'createworkspace') {
                //   useUIStore.getState().clearEditorStates();
                //   useUIStore.getState().openCreateWorkspace();
                //   return;
                // }
                const mode = commandId === 'store' ? 'lock' : 'execute';
                console.log('[AppLeftSidebar] Processing commandId', commandId, 'with mode', mode, 'needsHomeRoute:', needsHomeRoute);
                if (needsHomeRoute) {
                    console.log('[AppLeftSidebar] Setting pending locked command because searchbar is null or view needs reset');
                    useUIStore.getState().setView({ type: 'home' });
                    useUIStore.getState().setPendingLockedCommand({ commandId, mode });
                }
                else if (searchbarRef.current) {
                    console.log('[AppLeftSidebar] Executing command via searchbarRef:', commandId);
                    searchbarRef.current.clear();
                    setTimeout(() => {
                        searchbarRef.current?.executeCommand(commandId as any, { mode });
                        searchbarRef.current?.focus();
                    }, 10);
                }
            }} onSelectSavedAgent={agent => {
                
                setIsSpreadsheetViewOpen(false);
                const candidateIds = [
                    agent?.id,
                    agent?.automation_id,
                    agent?.automation?.id,
                    agent?.automation?.automation_id
                ]
                    .map(val => String(val || ''))
                    .filter(Boolean);
                const resolvedAgent = candidateIds.map(id => savedAgentById.get(id)).find(Boolean) || agent;
                if (searchbarRef.current) {
                    setTimeout(() => {
                        searchbarRef.current?.selectSavedAgent(resolvedAgent);
                        searchbarRef.current?.focus();
                    }, 10);
                }
            }} onNavigateToListView={handleNavigateToListView} onRequestEditLink={handleFavoriteLinkEdit}/>
          </div>
        </div>)}
    </>);
};
