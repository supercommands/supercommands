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
  onEnterWidgetEditMode?: (widgetId?: string) => void;
  onExitWidgetEditMode?: () => void;
  pendingSelectedWidgetId?: string | null;
  selectedSnippet: any;
  showSidebarColumn?: boolean;
  isLeftSidebarCollapsed?: boolean;
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
  onEnterWidgetEditMode,
  onExitWidgetEditMode,
  pendingSelectedWidgetId,
  selectedSnippet,
  showSidebarColumn,
  isLeftSidebarCollapsed,
}) => {
  const activeEditor = useUIStore(s => s.activeEditor);
  const isFocusModeStore = useUIStore(s => s.isFocusMode);

  const isNormalEditorView =
    (activeEditor?.type === 'note' || activeEditor?.type === 'link' || activeEditor?.type === 'todo' || activeEditor?.type === 'snippet' || activeEditor?.type === 'aiPrompt') &&
    !activeEditor?.props?.isOverlay &&
    !isFocusModeStore &&
    !isFocusMode;
  const normalEditorStyle = {
    transition: 'filter 0.3s ease',
    ...(isNormalEditorView && theme?.isDark
      ? {
          backgroundColor: '#0E0F10',
          '--color-editorBg': '#0E0F10',
          '--color-inputBg': '#0E0F10',
          '--color-containerBg': '#0E0F10',
          '--color-panelBg': '#0E0F10',
          '--color-cardBg': '#0E0F10',
          '--color-popupBg': '#0E0F10',
          '--color-innerPopupBg': '#0E0F10',
          '--color-contextMenuBg': '#0E0F10',
          '--color-textPrimary': '#FFFFFF',
          '--color-textSecondary': '#D4D4D4',
          '--color-textMuted': '#737373',
          '--color-textPlaceholder': '#A3A3A3',
          '--color-iconDefault': '#9CA3AF',
          '--color-borderDefault': 'rgba(255, 255, 255, 0.1)',
          '--color-borderActive': 'rgba(255, 255, 255, 0.2)',
          '--color-hoverBg': 'rgba(255, 255, 255, 0.05)',
          '--color-selectedBg': 'rgba(255, 255, 255, 0.07)',
        }
      : {}),
    ...(isNormalEditorView && theme?.isDark === false
      ? {
          backgroundColor: '#F9F4EA',
          '--color-editorBg': '#F9F4EA',
          '--color-inputBg': '#F9F4EA',
          '--color-containerBg': '#F9F4EA',
          '--color-panelBg': '#F9F4EA',
          '--color-cardBg': '#F9F4EA',
          '--color-popupBg': '#F9F4EA',
          '--color-innerPopupBg': '#F9F4EA',
          '--color-contextMenuBg': '#F9F4EA',
          '--color-textPrimary': '#111827',
          '--color-textSecondary': '#374151',
          '--color-textMuted': '#6B7280',
          '--color-textPlaceholder': '#9CA3AF',
          '--color-iconDefault': '#6B7280',
          '--color-borderDefault': 'rgba(0, 0, 0, 0.12)',
          '--color-borderActive': 'rgba(0, 0, 0, 0.25)',
          '--color-hoverBg': 'rgba(0, 0, 0, 0.05)',
          '--color-selectedBg': 'rgba(0, 0, 0, 0.08)',
        }
      : {}),
  } as React.CSSProperties;

  return (
    <>
      {/* Main Content Area (Rich Text Editor) */}
      <div
        className={`flex-1 flex flex-col text-[var(--color-textPrimary)] min-w-0 w-full h-full relative ${isNormalEditorView ? 'bg-[var(--color-editorBg)]' : ''} ${isViewDropdownOpen ? 'z-[50]' : 'z-0'} ${isFullScreenModalOpen && theme.wallpaper ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        style={normalEditorStyle}>
        <Container
          isWidgetEditMode={isWidgetEditMode}
          onEnterWidgetEditMode={onEnterWidgetEditMode}
          onExitWidgetEditMode={onExitWidgetEditMode}
          pendingSelectedWidgetId={pendingSelectedWidgetId}
          showSidebarColumn={showSidebarColumn}
          isLeftSidebarCollapsed={isLeftSidebarCollapsed}
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
