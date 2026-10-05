import React from 'react';
import { useUIStore } from '../../../../shared-components/uiStateManager';
import { useDbStore } from '../../../../storage/store/useDbStore';
import { useWidgetDashboardStore } from '../../../../storage/store/useWidgetDashboardStore';
import { isMainDashboardView } from '../components/widgets/engine/widgetDashboardData';
import type { NotificationRecord } from '../../../../allObjectFolder/src/createObject/notifications/notificationTypes';
import { markNotificationsAsRead, dismissNotificationRecord, clearAllVisibleNotifications, } from '../../../../allObjectFolder/src/createObject/notifications/notificationData';
import { formatDistanceToNow } from 'date-fns';
import { FiBell, FiClock, FiX } from 'react-icons/fi';
import Container from '../components/Container';
interface AppMainContentProps {
    isViewDropdownOpen: boolean;
    isFullScreenModalOpen: boolean;
    theme: any;
    hasActivePopup: boolean;
    isLinkEditModalOpen: boolean;
    setSuggestionState: any;
    backgroundRefresh: any;
    searchbarRef: any;
    isSpreadsheetViewOpen: boolean;
    openSpreadsheetView: any;
    handleCreateOrganisation: any;
    closeSpreadsheetView: any;
    handleBoardViewRedirectFromSheet: any;
    setIsSearchMenuOpen: any;
    setIsBoardViewOpen: any;
    isInitialAltSFocus: boolean;
    setIsInitialAltSFocus: any;
    setIsGlobalCreateMenuOpen: any;
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
    isLeftSidebarIconOnly?: boolean;
}
export const AppMainContent: React.FC<AppMainContentProps> = ({ isViewDropdownOpen, isFullScreenModalOpen, theme, hasActivePopup, isLinkEditModalOpen, setSuggestionState, backgroundRefresh, searchbarRef, isSpreadsheetViewOpen, openSpreadsheetView, handleCreateOrganisation, closeSpreadsheetView, handleBoardViewRedirectFromSheet, setIsSearchMenuOpen, setIsBoardViewOpen, isInitialAltSFocus, setIsInitialAltSFocus, setIsGlobalCreateMenuOpen, commandListCategory, setCommandListCategory, activeCommandSection, setActiveCommandSection, handleOrganizationHandlersReady, handleOrganizationPanelChange, handleNavigateToListView, activeLockedCommand, isSearchMenuOpen, handleLockedCommandChange, handleSearchbarFocus, setIsViewDropdownOpen, isFocusMode, isEmbedded, isCreatingNewItem, isWidgetEditMode, onEnterWidgetEditMode, onExitWidgetEditMode, pendingSelectedWidgetId, selectedSnippet, showSidebarColumn, isLeftSidebarIconOnly, }) => {
    const activeEditor = useUIStore(s => s.activeEditor);
    const activeView = useUIStore(s => s.activeView);
    const isFocusModeStore = useUIStore(s => s.isFocusMode);
    const dashboardState = useWidgetDashboardStore(state => state.state);
    const activeDashboardView = dashboardState?.views.find(view => view.id === dashboardState.activeViewId);
    const isWorkspaceCollectionView = activeView?.type === 'home' && !activeEditor && Boolean(activeDashboardView) && !isMainDashboardView(activeDashboardView);
    const notifications = useDbStore(state => state.notifications);
    const unreadNotificationsCount = useDbStore(state => state.unreadNotificationsCount);
    const [isTodoNotificationOpen, setIsTodoNotificationOpen] = React.useState(false);
    // Filter to notifications visible today (unread or read today)
    const visibleNotifications = React.useMemo(() => {
        const startOfTodayMs = new Date().setHours(0, 0, 0, 0);
        return notifications.filter(n => n.status === 'unread' || (n.status === 'read' && (n.readAt || n.createdAt) >= startOfTodayMs));
    }, [notifications]);
    const shouldShowPendingTodoNotifications = (unreadNotificationsCount > 0 || visibleNotifications.length > 0) &&
        activeView?.type === 'home' &&
        !activeEditor &&
        !isFocusMode &&
        !isEmbedded &&
        !isSpreadsheetViewOpen &&
        !isCreatingNewItem &&
        !isWorkspaceCollectionView &&
        !selectedSnippet;
    const pendingTodoBadgeLabel = unreadNotificationsCount > 99
        ? '99+'
        : unreadNotificationsCount > 0
            ? String(unreadNotificationsCount)
            : null;
    const handleToggleNotificationDropdown = React.useCallback(async () => {
        if (isTodoNotificationOpen) {
            setIsTodoNotificationOpen(false);
            return;
        }
        // Only notifications present when opening are considered viewed.
        const idsToMark = visibleNotifications.filter(n => n.status === 'unread').map(n => n.id);
        setIsTodoNotificationOpen(true);
        if (idsToMark.length > 0) {
            await markNotificationsAsRead(idsToMark);
        }
    }, [isTodoNotificationOpen, visibleNotifications]);
    const handleClearAllNotifications = React.useCallback(async () => {
        if (visibleNotifications.length === 0)
            return;
        const ids = visibleNotifications.map(n => n.id);
        await clearAllVisibleNotifications(ids);
        setIsTodoNotificationOpen(false);
    }, [visibleNotifications]);
    const handleDismissSingleNotification = React.useCallback(async (notificationId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        await dismissNotificationRecord(notificationId);
    }, []);
    const getNotificationMetaText = React.useCallback((notification: NotificationRecord) => {
        if (notification.sourceType === 'todo') {
            return `Due ${formatDistanceToNow(new Date(notification.occurrenceAt), { addSuffix: true })}`;
        }
        return notification.message || formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true });
    }, []);
    const handleNotificationItemClick = React.useCallback(async (notification: NotificationRecord) => {
        setIsTodoNotificationOpen(false);
        if (notification.sourceType !== 'todo') {
            if (notification.status === 'unread') {
                await markNotificationsAsRead([notification.id]);
            }
            return;
        }
        const chromeAny = (window as any).chrome;
        if (!chromeAny?.runtime?.sendMessage) {
            return;
        }
        chromeAny.runtime.sendMessage({
            action: 'activate_notification',
            id: notification.id,
        }, (response: any) => {
            if (response && response.success === false) {
                useUIStore.getState().queueNotification({
                    message: response.error || 'Failed to open Todo',
                    type: 'error',
                });
            }
        });
    }, []);
    const isNormalEditorView = (activeEditor?.type === 'note' || activeEditor?.type === 'link' || activeEditor?.type === 'todo' || activeEditor?.type === 'snippet' || activeEditor?.type === 'aiPrompt') &&
        !activeEditor?.props?.isOverlay &&
        !isFocusModeStore &&
        !isFocusMode;
    const isDecorativeMainView = !activeView?.type || activeView.type === 'home' || activeView.type === 'settings';
    const shouldCoverDecorativeBackground = Boolean(activeEditor) || !isDecorativeMainView;
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
    return (<>
      {/* Main Content Area (Rich Text Editor) */}
      <div className={`flex-1 flex flex-col text-[var(--color-textPrimary)] min-w-0 w-full h-full relative ${isNormalEditorView ? 'bg-[var(--color-editorBg)] has-[[data-black-editor-surface=true]]:!bg-[var(--color-rootBg)]' : shouldCoverDecorativeBackground ? 'bg-[var(--color-rootBg)]' : ''} ${isViewDropdownOpen ? 'z-[50]' : 'z-0'} ${isFullScreenModalOpen && theme.wallpaper ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} style={normalEditorStyle}>
        <Container isWidgetEditMode={isWidgetEditMode} onEnterWidgetEditMode={onEnterWidgetEditMode} onExitWidgetEditMode={onExitWidgetEditMode} pendingSelectedWidgetId={pendingSelectedWidgetId} showSidebarColumn={showSidebarColumn} isLeftSidebarIconOnly={isLeftSidebarIconOnly} onSuggestionStateChange={setSuggestionState} reload={backgroundRefresh} searchbarRef={searchbarRef} isSpreadsheetViewOpen={isSpreadsheetViewOpen} onOpenSpreadsheetMainContainer={openSpreadsheetView} onCreateOrganisation={handleCreateOrganisation} onCloseSpreadsheetMainContainer={closeSpreadsheetView} onBoardViewRedirect={handleBoardViewRedirectFromSheet} onMenuStateChange={setIsSearchMenuOpen} onBoardViewOpenChange={setIsBoardViewOpen} onShortcutBoardView={() => {
            useUIStore.getState().returnToHome();
            setIsInitialAltSFocus(true);
            const chromeAny = (window as any)?.chrome;
            if (chromeAny?.storage?.local) {
                chromeAny.storage.local.set({ new_tab_is_board_view_enabled: true });
            }
        }} onShortcutCreateMenu={() => {
            useUIStore.getState().returnToHome();
            setIsGlobalCreateMenuOpen(true);
        }} commandListCategory={commandListCategory} onCommandListCategoryChange={setCommandListCategory} activeCommandSection={activeCommandSection} onCommandSectionChange={setActiveCommandSection} isInitialAltSFocus={isInitialAltSFocus} onInitialAltSFocusChange={setIsInitialAltSFocus} onOrganizationHandlersReady={handleOrganizationHandlersReady} onOrganizationPanelChange={handleOrganizationPanelChange} onNavigateToListView={handleNavigateToListView} hideMainContent={isSpreadsheetViewOpen ||
            (!!activeLockedCommand &&
                activeLockedCommand !== 'ai' &&
                activeLockedCommand !== 'store') ||
            isSearchMenuOpen} onLockedCommandChange={handleLockedCommandChange} onSearchbarFocus={handleSearchbarFocus} onHoverSlashDot={() => setIsViewDropdownOpen(true)}/>

        {!isFocusMode && !isEmbedded && (<div className="absolute top-4 right-4 z-[9999] flex flex-row items-center gap-2 pointer-events-auto">
            {shouldShowPendingTodoNotifications && (<div className="relative flex flex-col items-end gap-2 text-[var(--color-textPrimary)]">
                <button type="button" onClick={handleToggleNotificationDropdown} className="relative flex h-10 w-10 items-center justify-center rounded-lg text-xs font-semibold shadow-lg transition-colors " aria-expanded={isTodoNotificationOpen} aria-label={`${unreadNotificationsCount} unread notifications`}>
                  <FiBell size={18} className="text-[var(--color-iconDefault)]"/>
                  {pendingTodoBadgeLabel && (<span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-[var(--color-modalBg)] bg-[var(--color-danger)] px-1 text-[10px] font-bold leading-none text-white shadow-sm">
                      {pendingTodoBadgeLabel}
                    </span>)}
                </button>

                {isTodoNotificationOpen && (<div className="absolute right-0 top-11 w-[280px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-modalBg)] shadow-xl">
                    <style>
                      {`
                        .pending-todo-notification-scroll {
                          scrollbar-width: thin;
                          scrollbar-color: color-mix(in srgb, var(--color-textMuted) 32%, transparent) transparent;
                        }

                        .pending-todo-notification-scroll::-webkit-scrollbar {
                          width: 4px;
                        }

                        .pending-todo-notification-scroll::-webkit-scrollbar-track {
                          background: transparent;
                        }

                        .pending-todo-notification-scroll::-webkit-scrollbar-thumb {
                          background-color: color-mix(in srgb, var(--color-textMuted) 28%, transparent);
                          border-radius: 999px;
                        }

                        .pending-todo-notification-scroll::-webkit-scrollbar-thumb:hover {
                          background-color: color-mix(in srgb, var(--color-textMuted) 42%, transparent);
                        }
                      `}
                    </style>
                    <div className="flex items-center justify-between border-b border-[var(--color-borderDefault)] px-3 py-2.5">
                      <div>
                        <div className="text-xs font-semibold text-[var(--color-textPrimary)]">Notifications</div>
                        <div className="text-[11px] text-[var(--color-textSecondary)]">Click an item to review it</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={handleClearAllNotifications} className="rounded-md px-2 py-1 text-[11px] font-semibold text-[var(--color-textSecondary)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]">
                          Clear all
                        </button>
                        <span className="rounded-md bg-[var(--color-selectedBg)] px-2 py-1 text-[11px] font-semibold text-[var(--color-textPrimary)]">
                          {visibleNotifications.length}
                        </span>
                      </div>
                    </div>
                    <div className="pending-todo-notification-scroll max-h-[280px] overflow-y-auto p-1">
                      {visibleNotifications.length === 0 ? (<div className="px-3 py-4 text-center text-xs text-[var(--color-textMuted)]">
                          No notifications
                        </div>) : (visibleNotifications.map(item => (<div key={item.id} onClick={() => handleNotificationItemClick(item)} className="group flex w-full items-start gap-2 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-hoverBg)] cursor-pointer">
                            <FiClock size={13} className="mt-0.5 shrink-0 text-[var(--color-iconDefault)]"/>
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-2 text-xs font-medium text-[var(--color-textPrimary)]">
                                {item.title || 'Notification'}
                              </span>
                              <span className="mt-0.5 block text-[11px] text-[var(--color-textSecondary)]">
                                {getNotificationMetaText(item)}
                              </span>
                              {item.actionState === 'failed' && (<span className="mt-0.5 block text-[10px] text-[var(--color-danger)] font-medium">
                                  Action failed — click to retry
                                </span>)}
                            </span>
                            <button type="button" title="Dismiss notification" onClick={e => handleDismissSingleNotification(item.id, e)} className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-selectedBg)] transition-all shrink-0">
                              <FiX size={13}/>
                            </button>
                          </div>)))}
                    </div>
                  </div>)}
              </div>)}
            {!isSpreadsheetViewOpen &&
                !isCreatingNewItem &&
                !selectedSnippet &&
                activeEditor?.type !== 'note' &&
                (activeEditor?.type as string) !== 'prompt' &&
                activeEditor?.type !== 'agent' &&
                activeEditor?.type !== 'ai' ? (<></>) : null}
          </div>)}
      </div>
    </>);
};
