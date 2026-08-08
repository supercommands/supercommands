import type * as React from 'react';
import { useUIStore } from '../../../../shared-components/uiStateManager';
import Container from '../components/Container';

interface AppMainContentProps {
  isViewDropdownOpen: boolean;
  isFullScreenModalOpen: boolean;
  theme: any;
  hasActivePopup: boolean;
  isLinkEditModalOpen: boolean;

  setSuggestionState: any;
  isLoggedIn: boolean;
  teams: any;
  backgroundRefresh: any;
  searchbarRef: any;
  isSpreadsheetViewOpen: boolean;
  openSpreadsheetView: any;
  handleCreateWorkspace: any;
  closeSpreadsheetView: any;
  handleBoardViewRedirectFromSheet: any;
  setIsSearchMenuOpen: any;
  setIsBoardViewOpen: any;
  isInitialAltSFocus: boolean;
  setIsInitialAltSFocus: any;
  setIsGlobalCreateMenuOpen: any;
  setIsAutomationActive: any;
  commandListCategory: any;
  setCommandListCategory: any;
  activeCommandSection: any;
  setActiveCommandSection: any;
  handleOrganizationHandlersReady: any;
  handleOrganizationPanelChange: any;
  handleNavigateToListView: (type: 'notes' | 'links' | 'commands', section?: string) => void;
  activeLockedCommand: any;
  isSearchMenuOpen: boolean;
  handleLockedCommandChange: any;
  handleSearchbarFocus: any;
  setIsViewDropdownOpen: any;
  isFocusMode?: boolean;
  isEmbedded?: boolean;
  isCreatingNewItem?: boolean;
  isWidgetEditMode?: boolean;
  selectedSnippet: any;
  showTutorial: boolean;
  setShowTutorial: React.Dispatch<React.SetStateAction<boolean>>;
  showSidebarColumn?: boolean;
}

export const AppMainContent: React.FC<AppMainContentProps> = ({
  isViewDropdownOpen,
  isFullScreenModalOpen,
  theme,
  hasActivePopup,
  isLinkEditModalOpen,

  setSuggestionState,
  isLoggedIn,
  teams,
  backgroundRefresh,
  searchbarRef,
  isSpreadsheetViewOpen,
  openSpreadsheetView,
  handleCreateWorkspace,
  closeSpreadsheetView,
  handleBoardViewRedirectFromSheet,
  setIsSearchMenuOpen,
  setIsBoardViewOpen,
  isInitialAltSFocus,
  setIsInitialAltSFocus,
  setIsGlobalCreateMenuOpen,
  setIsAutomationActive,
  commandListCategory,
  setCommandListCategory,
  activeCommandSection,
  setActiveCommandSection,
  handleOrganizationHandlersReady,
  handleOrganizationPanelChange,
  handleNavigateToListView,
  activeLockedCommand,
  isSearchMenuOpen,
  handleLockedCommandChange,
  handleSearchbarFocus,
  setIsViewDropdownOpen,
  isFocusMode,
  isEmbedded,
  isCreatingNewItem,
  isWidgetEditMode,
  selectedSnippet,
  showTutorial,
  setShowTutorial,
  showSidebarColumn,
}) => {
  const activeEditor = useUIStore(s => s.activeEditor);

  return (
    <>
      {/* Main Content Area (Rich Text Editor) */}
      <div
        className={`flex-1 flex flex-col text-[var(--color-textPrimary)] min-w-0 w-full h-full relative ${isViewDropdownOpen ? 'z-[50]' : 'z-0'} ${isFullScreenModalOpen && theme.wallpaper ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        style={{
          transition: 'filter 0.3s ease',
        }}>
        <Container
          isWidgetEditMode={isWidgetEditMode}
          showSidebarColumn={showSidebarColumn}
          onSuggestionStateChange={setSuggestionState}
          isLoggedIn={isLoggedIn}
          teams={teams}
          reload={backgroundRefresh}
          searchbarRef={searchbarRef}
          isSpreadsheetViewOpen={isSpreadsheetViewOpen}
          onOpenSpreadsheetMainContainer={openSpreadsheetView}
          onCreateWorkspace={handleCreateWorkspace}
          onCloseSpreadsheetMainContainer={closeSpreadsheetView}
          onBoardViewRedirect={handleBoardViewRedirectFromSheet}
          onMenuStateChange={setIsSearchMenuOpen}
          onBoardViewOpenChange={setIsBoardViewOpen}
          onShortcutBoardView={() => {
            useUIStore.getState().setView({ type: 'home' });
            setIsInitialAltSFocus(true);
            const chromeAny = (window as any)?.chrome;
            if (chromeAny?.storage?.local) {
              chromeAny.storage.local.set({ new_tab_is_board_view_enabled: true });
            }
          }}
          onShortcutCreateMenu={() => {
            useUIStore.getState().setView({ type: 'home' });
            setIsGlobalCreateMenuOpen(true);
          }}
          onAutomationActiveChange={setIsAutomationActive}
          commandListCategory={commandListCategory}
          onCommandListCategoryChange={setCommandListCategory}
          activeCommandSection={activeCommandSection}
          onCommandSectionChange={setActiveCommandSection}
          isInitialAltSFocus={isInitialAltSFocus}
          onInitialAltSFocusChange={setIsInitialAltSFocus}
          onOrganizationHandlersReady={handleOrganizationHandlersReady}
          onOrganizationPanelChange={handleOrganizationPanelChange}
          onNavigateToListView={handleNavigateToListView}
          hideMainContent={
            isSpreadsheetViewOpen ||
            (!!activeLockedCommand &&
              activeLockedCommand !== 'ai' &&
              activeLockedCommand !== 'store' &&
              activeLockedCommand !== 'saved-automation') ||
            isSearchMenuOpen
          }
          onLockedCommandChange={handleLockedCommandChange}
          onSearchbarFocus={handleSearchbarFocus}
          onHoverSlashDot={() => setIsViewDropdownOpen(true)}
          showTutorial={showTutorial}
          setShowTutorial={setShowTutorial}
        />

        {!isFocusMode && !isEmbedded && (
          <div className="absolute top-4 right-4 z-[9999] flex flex-row items-center gap-2 pointer-events-auto">
            {!isSpreadsheetViewOpen &&
            !isCreatingNewItem &&
            !selectedSnippet &&
            activeEditor?.type !== 'note' &&
            (activeEditor?.type as string) !== 'prompt' &&
            activeEditor?.type !== 'agent' &&
            activeEditor?.type !== 'ai' ? (
              <></>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
};
