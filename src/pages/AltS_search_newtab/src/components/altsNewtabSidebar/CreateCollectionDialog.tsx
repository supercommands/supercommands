import type { ShortcutAssignmentApproval } from '../../../../../shared-components/shortcuts/core/shortcutAssignmentTypes';
import * as React from 'react';
import ReactDOM from 'react-dom';
import { getTheme, useAppearance } from '@extension/ui';
import { BRAND } from '../../../../../shared-components/brandingConfig';
import { LuCheck, LuCircleHelp, LuExternalLink, LuLink, LuPlus, LuTrash2, LuX, LuLayers, LuLayoutGrid } from 'react-icons/lu';
import { DASHBOARD_VIEW_ICONS, DashboardViewIcon, DEFAULT_VIEW_ICON_ID, type DashboardViewIconId, } from './dashboardViewIcons';
import { CUnderscoreIcon } from '../../../../../shared-components/icons/cUnderscoreIcon';
import { HotkeyAssignButton } from '../../../../../shared-components/hotkeys';
import { buildHotkeyString, normalizeHotkeyString } from '../../../../../shared-components/hotkeys/core/eventParser';
import type { SelectedLink } from '../../../../../allObjectFolder/src/createObject/links/linkTypes';
import type { SessionOpenSettings } from '../../../../../allObjectFolder/src/createObject/session/sessionSettings';
import { normalizeSessionOpenSettings } from '../../../../../allObjectFolder/src/createObject/session/sessionSettings';
import { saveSessionOpenSettings } from '../../../../../allObjectFolder/src/createObject/session/sessionSettingsRuntime';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import WidgetCatalogGrid from '../widgets/components/WidgetCatalogGrid';
import { openEditorByCatalogType, type WidgetCatalogItem } from '../widgets/widgetCatalog';
import { getWidgetHeaderIcon } from '../widgets/utils/widgetHeaderIcons';
import { getWidgetTypeLabel } from '../widgets/utils/widgetTypeLabel';
import { isSingleInstanceWidgetType } from '../../../../../storage/localStorage/widgetDashboardStorage';
const COLLECTION_TABLE_COLUMN_COUNT = 8;
type CollectionTableCellPosition = {
    rowIndex: number;
    columnIndex: number;
};
export type CreateSessionDraft = {
    title?: string;
    urls: SelectedLink[];
    sessionOpenSettings?: SessionOpenSettings;
    organisationId?: string | null;
    tagIds?: string[];
};
export const createEmptySessionDraft = (): CreateSessionDraft => ({
    title: '',
    urls: [],
});
export type CreateCollectionDialogState = {
    mode: 'create' | 'rename';
    presentation?: 'form' | 'table';
    viewId?: string;
    tablePrimaryViewId?: string;
    title: string;
    shortcut?: string;
    hotkey?: string;
    hotkeyError?: string | null;
    viewIconId: DashboardViewIconId;
    isCustomIconSelected?: boolean;
    shortcutConflictId?: string | null;
    shortcutApproval?: ShortcutAssignmentApproval;
    shortcutApprovalValue?: string;
    isShortcutOverrideable?: boolean;
    shortcutError?: string | null;
};
export type CollectionViewTableRow = {
    viewIconId?: DashboardViewIconId;
    id: string;
    title: string;
    shortcut?: string;
    hotkey?: string;
    linkCount?: number;
    links?: SelectedLink[];
    canEditLinks?: boolean;
    focusMode?: boolean;
    autoSave?: boolean;
    isDraft?: boolean;
};
type CreateCollectionDialogProps = {
    anchorRef?: React.RefObject<HTMLElement | null>;
    dialog: CreateCollectionDialogState;
    setDialog: React.Dispatch<React.SetStateAction<any>>;
    onClose: () => void;
    onSubmit: (dialogOverride?: CreateCollectionDialogState) => void;
    actionError?: string | null;
    pendingActionId?: string | null;
    onOverrideShortcut?: (() => void) | null;
    onRequestDelete?: (() => void) | null;
    viewRows?: CollectionViewTableRow[];
    onSaveViewRow?: (viewId: string, updates: {
        viewIconId?: DashboardViewIconId;
        title?: string;
        shortcut?: string;
        hotkey?: string;
    }) => void | Promise<void>;
    onSelectViewRow?: (viewId: string) => void;
    onDeleteViewRow?: (viewId: string) => void;
    onToggleViewSessionSetting?: (viewId: string, updates: Partial<SessionOpenSettings>) => void | Promise<void>;
    onRequestAddViewLinks?: (viewId: string) => void;
    onRemoveViewRowLink?: (viewId: string, link: SelectedLink, index: number) => void | Promise<void>;
    stagedWidgets: WidgetCatalogItem[];
    pendingWidgetIds: Set<string>;
    draftSession: CreateSessionDraft;
    onDraftSessionChange: (draft: CreateSessionDraft) => void;
    onStageWidget: (item: WidgetCatalogItem) => void;
    onRemoveStagedWidget: (index: number) => void;
    linkedSessionId?: string | null;
    linkedWidgetId?: string | null;
    position?: 'anchored' | 'centered';
    portalContainer?: HTMLElement | null;
    hideWidgetsSection?: boolean;
};
const normalizeWidgetType = (value: unknown): string => String(value || '').toLowerCase().trim();
const getCatalogWidgetDisplayName = (item: WidgetCatalogItem): string => String(item.title || '').trim() ||
    getWidgetTypeLabel(item.type) ||
    'Widget';
const requiresExternalPicker = (item: WidgetCatalogItem): boolean => item.type === 'note-item' || item.type === 'html' || item.type === 'session-item';
const getHostname = (url?: string): string => {
    try {
        if (!url)
            return '';
        const safeUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
        return new URL(safeUrl).hostname.replace(/^www\./i, '');
    }
    catch {
        return url || '';
    }
};
const getLinkTitle = (item: SelectedLink): string => String(item.title || item.name || '').trim() || getHostname(item.url) || 'Untitled link';
const getLinkDisplayUrl = (item: SelectedLink): string => String(item.url || '').replace(/^https?:\/\/(www\.)?/i, '');
const getLinkFavicon = (item: SelectedLink): string => {
    if (item.favIconUrl)
        return item.favIconUrl;
    const host = getHostname(item.url);
    if (!host || !/^https?:\/\//i.test(item.url || ''))
        return '';
    return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(`https://${host}`)}&size=128`;
};
const openLinkUrl = (url?: string) => {
    if (!url)
        return;
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.tabs?.create) {
        chromeAny.tabs.create({ url, active: true });
        return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
};
export const CreateCollectionDialog: React.FC<CreateCollectionDialogProps> = ({ anchorRef, dialog, setDialog, onClose, onSubmit, actionError, pendingActionId, onOverrideShortcut, onRequestDelete, viewRows, onSaveViewRow, onSelectViewRow, onDeleteViewRow, onToggleViewSessionSetting, onRequestAddViewLinks, onRemoveViewRowLink, stagedWidgets, pendingWidgetIds, draftSession, onDraftSessionChange, onStageWidget, onRemoveStagedWidget, linkedSessionId, linkedWidgetId, position = 'centered', portalContainer, }) => {
    const { theme } = useAppearance();
    const functionalTheme = getTheme('reflect-new-tab');
    const functionalThemeVariables = React.useMemo(() => Object.fromEntries(Object.entries(functionalTheme.tokens).map(([key, value]) => [`--color-${key}`, value])) as React.CSSProperties, [functionalTheme]);
    const isCreateFlow = dialog.mode === 'create';
    const isCreateDialog = isCreateFlow && dialog.presentation !== 'table';
    const [isWidgetPickerOpen, setIsWidgetPickerOpen] = React.useState(false);
    const [expandedLinksRowId, setExpandedLinksRowId] = React.useState<string | null>(null);
    const [isIconPickerOpen, setIsIconPickerOpen] = React.useState(false);
    const [iconPickerRowId, setIconPickerRowId] = React.useState<string | null>(null);
    const [focusedTableCell, setFocusedTableCell] = React.useState<CollectionTableCellPosition>({
        rowIndex: 0,
        columnIndex: 0,
    });
    const collectionTableRef = React.useRef<HTMLDivElement | null>(null);
    const iconTriggerRef = React.useRef<HTMLButtonElement | null>(null);
    const iconPickerRef = React.useRef<HTMLDivElement | null>(null);
    const titleInputRef = React.useRef<HTMLInputElement | null>(null);
    const shortcutInputRef = React.useRef<HTMLInputElement | null>(null);
    const hotkeyInputRef = React.useRef<HTMLInputElement | null>(null);
    React.useEffect(() => {
        if (!expandedLinksRowId)
            return;
        const handleOutsideClick = (event: MouseEvent) => {
            const target = event.target;
            const targetElement = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
            const expanderRoot = targetElement?.closest('[data-links-expander-root]');
            if (targetElement?.closest('[data-session-add-links-popup]'))
                return;
            if (expanderRoot?.getAttribute('data-links-expander-root') === expandedLinksRowId) {
                return;
            }
            setExpandedLinksRowId(null);
        };
        document.addEventListener('click', handleOutsideClick, true);
        return () => {
            document.removeEventListener('click', handleOutsideClick, true);
        };
    }, [expandedLinksRowId]);
    const sessions = useDbStore(state => state.sessions);
    const linkedSession = React.useMemo(() => sessions.find((session: any) => String(session.id) === String(linkedSessionId || '')), [linkedSessionId, sessions]);
    const sessionSettings = normalizeSessionOpenSettings(dialog.mode === 'rename' ? linkedSession?.sessionOpenSettings : draftSession.sessionOpenSettings);
    const isFocusModeEnabled = sessionSettings.focusMode === true;
    const isAutoSaveEnabled = sessionSettings.autoSaveMode === 'auto_save';
    const sessionLinks = dialog.mode === 'rename' && Array.isArray(linkedSession?.urls)
        ? linkedSession.urls
        : Array.isArray(draftSession.urls)
            ? draftSession.urls
            : [];
    const sessionLinkCount = sessionLinks.length;
    const updateSessionSettings = React.useCallback(async (partialSettings: Partial<SessionOpenSettings>) => {
        const nextSettings = normalizeSessionOpenSettings({
            ...sessionSettings,
            ...partialSettings,
        });
        if (dialog.mode === 'rename' && linkedSessionId) {
            await saveSessionOpenSettings(linkedSessionId, partialSettings);
            return;
        }
        onDraftSessionChange({
            ...draftSession,
            sessionOpenSettings: nextSettings,
        });
    }, [dialog.mode, draftSession, linkedSessionId, onDraftSessionChange, sessionSettings]);
    React.useEffect(() => {
        if (!isCreateFlow)
            return;
        window.setTimeout(() => titleInputRef.current?.focus(), 0);
    }, [isCreateFlow, isCreateDialog]);
    React.useEffect(() => {
        const handleDialogEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !isIconPickerOpen && !isWidgetPickerOpen) {
                if (event.defaultPrevented || document.querySelector('[data-session-add-links-popup]'))
                    return;
                if (!isCreateDialog && expandedLinksRowId) {
                    event.preventDefault();
                    event.stopPropagation();
                    setExpandedLinksRowId(null);
                    return;
                }
                const activeElement = document.activeElement;
                const activeTableCell = activeElement instanceof HTMLElement
                    ? activeElement.closest<HTMLElement>('[data-workspace-table-cell]')
                    : null;
                if (!isCreateDialog &&
                    activeElement instanceof HTMLElement &&
                    activeTableCell &&
                    collectionTableRef.current?.contains(activeTableCell) &&
                    activeElement !== activeTableCell) {
                    event.preventDefault();
                    event.stopPropagation();
                    activeElement.blur();
                    activeTableCell.focus();
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                onClose();
            }
        };
        document.addEventListener('keydown', handleDialogEscape, true);
        return () => document.removeEventListener('keydown', handleDialogEscape, true);
    }, [expandedLinksRowId, isCreateDialog, isIconPickerOpen, isWidgetPickerOpen, onClose]);
    React.useEffect(() => {
        if (!isIconPickerOpen)
            return;
        iconPickerRef.current?.querySelector<HTMLButtonElement>('button[aria-selected="true"]')?.focus();
        const handlePointerDown = (event: PointerEvent) => {
            const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
            const target = event.target as Node | null;
            const isInsidePicker = (iconPickerRef.current && path.includes(iconPickerRef.current)) ||
                (target && iconPickerRef.current?.contains(target));
            const isInsideTrigger = (iconTriggerRef.current && path.includes(iconTriggerRef.current)) ||
                (target && iconTriggerRef.current?.contains(target));
            if (isInsidePicker || isInsideTrigger)
                return;
            setIsIconPickerOpen(false);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                setIsIconPickerOpen(false);
                iconTriggerRef.current?.focus();
            }
        };
        document.addEventListener('pointerdown', handlePointerDown, true);
        document.addEventListener('keydown', handleKeyDown, true);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, true);
            document.removeEventListener('keydown', handleKeyDown, true);
        };
    }, [isIconPickerOpen, iconPickerRowId]);
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 720;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewportMargin = 16;
    const popoverGap = 10;
    const popoverWidth = isCreateDialog
        ? Math.min(600, Math.max(320, viewportWidth - viewportMargin * 2))
        : Math.min(1040, Math.max(320, viewportWidth - viewportMargin * 2));
    const rect = anchorRef?.current?.getBoundingClientRect();
    const desiredPopoverHeight = isCreateDialog
        ? Math.min(400, viewportHeight - viewportMargin * 2)
        : Math.round(viewportHeight * 0.7);
    const editPopoverHeight = Math.round(viewportHeight * 0.82);
    const topPos = (() => {
        if (position === 'centered')
            return Math.max(viewportMargin, Math.floor((viewportHeight - desiredPopoverHeight) / 2));
        const availableBelow = rect ? viewportHeight - rect.top - viewportMargin : viewportHeight - 60 - viewportMargin;
        const availableAbove = rect ? rect.bottom - viewportMargin : 0;
        if (!rect)
            return Math.max(viewportMargin, Math.min(60, viewportHeight - desiredPopoverHeight - viewportMargin));
        if (isCreateDialog) {
            return Math.max(viewportMargin, Math.min(rect.top, viewportHeight - desiredPopoverHeight - viewportMargin));
        }
        if (desiredPopoverHeight <= availableBelow)
            return Math.max(viewportMargin, rect.top);
        if (desiredPopoverHeight <= availableAbove)
            return Math.max(viewportMargin, rect.bottom - desiredPopoverHeight);
        // Doesn't fit above or below: center vertically
        return Math.max(viewportMargin, Math.floor((viewportHeight - desiredPopoverHeight) / 2));
    })();
    const popoverMaxHeight = Math.min(isCreateDialog ? desiredPopoverHeight : editPopoverHeight, viewportHeight - topPos - viewportMargin);
    const leftPos = (() => {
        if (position === 'centered')
            return '50%';
        const defaultLeft = Math.min(280, viewportWidth - viewportMargin - popoverWidth);
        if (!rect)
            return `${Math.max(viewportMargin, defaultLeft)}px`;
        const rightSideLeft = rect.right + popoverGap;
        const leftSideLeft = rect.left - popoverWidth - popoverGap;
        if (rightSideLeft + popoverWidth <= viewportWidth - viewportMargin) {
            return `${rightSideLeft}px`;
        }
        if (leftSideLeft >= viewportMargin) {
            return `${leftSideLeft}px`;
        }
        const clampedLeft = Math.min(Math.max(viewportMargin, rightSideLeft), viewportWidth - viewportMargin - popoverWidth);
        return `${clampedLeft}px`;
    })();
    const dialogOverlayZIndex = 999998;
    const dialogPopoverZIndex = 999999;
    const popoverShadow = '0 20px 60px rgba(0,0,0,0.45)';
    const floatingPanelShadow = '0 12px 32px rgba(0,0,0,0.3)';
    const showSessionSection = false;
    const showWidgetsSection = false;
    const isCollectionTableDialog = !isCreateDialog;
    const baseTableRows: CollectionViewTableRow[] = viewRows && viewRows.length > 0
        ? viewRows
        : [
            {
                id: dialog.viewId || 'new-view',
                viewIconId: dialog.viewIconId,
                title: dialog.title,
                shortcut: dialog.shortcut || '',
                hotkey: dialog.hotkey || '',
                linkCount: sessionLinkCount,
                links: sessionLinks,
                canEditLinks: true,
                focusMode: isFocusModeEnabled,
                autoSave: isAutoSaveEnabled,
                isDraft: dialog.mode === 'create',
            }
        ];
    const tableRows: CollectionViewTableRow[] = baseTableRows.map(row => {
        const isActiveDraftRow = row.isDraft;
        const isActiveRenameRow = dialog.mode === 'rename' && row.id === dialog.viewId;
        if (!isActiveDraftRow && !isActiveRenameRow)
            return row;
        return {
            ...row,
            title: dialog.title,
            shortcut: dialog.shortcut || '',
            hotkey: dialog.hotkey || '',
        };
    });
    const tableGridClass = 'grid min-w-[960px] grid-cols-[56px_160px_140px_135px_minmax(300px,1fr)_76px_76px_56px]';
    const tableDialogMinHeight = Math.min(220, Math.max(160, popoverMaxHeight));
    const tableDialogPopoverMaxHeight = `${popoverMaxHeight}px`;
    const tableDialogTableMaxHeight = `${Math.max(220, popoverMaxHeight - 48)}px`;
    const tableDialogBodyMaxHeight = `${Math.max(180, popoverMaxHeight - 84)}px`;
    const tableCellFocusClass = 'outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focusRing)]';
    const focusCollectionTableCell = React.useCallback((position: CollectionTableCellPosition) => {
        if (tableRows.length === 0)
            return;
        const nextPosition = {
            rowIndex: Math.max(0, Math.min(position.rowIndex, tableRows.length - 1)),
            columnIndex: Math.max(0, Math.min(position.columnIndex, COLLECTION_TABLE_COLUMN_COUNT - 1)),
        };
        setFocusedTableCell(nextPosition);
        window.requestAnimationFrame(() => {
            collectionTableRef.current
                ?.querySelector<HTMLElement>(`[data-workspace-table-cell="${nextPosition.rowIndex}-${nextPosition.columnIndex}"]`)
                ?.focus();
        });
    }, [tableRows.length]);
    React.useEffect(() => {
        if (isCreateFlow || tableRows.length === 0)
            return;
        const focusTimer = window.setTimeout(() => {
            focusCollectionTableCell({ rowIndex: 0, columnIndex: 0 });
        }, 0);
        return () => window.clearTimeout(focusTimer);
    }, [focusCollectionTableCell, isCreateFlow, tableRows.length]);
    const handleCollectionTableCellKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, position: CollectionTableCellPosition) => {
        if (event.target !== event.currentTarget)
            return;
        const nextPosition = { ...position };
        switch (event.key) {
            case 'ArrowRight':
                nextPosition.columnIndex += 1;
                break;
            case 'ArrowLeft':
                nextPosition.columnIndex -= 1;
                break;
            case 'ArrowDown':
                nextPosition.rowIndex += 1;
                break;
            case 'ArrowUp':
                nextPosition.rowIndex -= 1;
                break;
            case 'Home':
                nextPosition.columnIndex = 0;
                break;
            case 'End':
                nextPosition.columnIndex = COLLECTION_TABLE_COLUMN_COUNT - 1;
                break;
            case 'Enter':
            case ' ': {
                if (position.columnIndex === 0 || position.columnIndex >= 4) {
                    const buttonTarget = event.currentTarget.querySelector<HTMLButtonElement>('button:not(:disabled)');
                    if (buttonTarget) {
                        event.preventDefault();
                        event.stopPropagation();
                        buttonTarget.click();
                    }
                    return;
                }
                const focusTarget = event.currentTarget.querySelector<HTMLElement>('input:not(:disabled), button:not(:disabled)');
                if (focusTarget) {
                    event.preventDefault();
                    event.stopPropagation();
                    focusTarget.focus();
                }
                return;
            }
            default:
                return;
        }
        event.preventDefault();
        event.stopPropagation();
        focusCollectionTableCell(nextPosition);
    };
    const getCollectionTableCellProps = (rowIndex: number, columnIndex: number): React.HTMLAttributes<HTMLDivElement> & {
        'data-workspace-table-cell': string;
    } => ({
        role: 'gridcell',
        tabIndex: focusedTableCell.rowIndex === rowIndex && focusedTableCell.columnIndex === columnIndex
            ? 0
            : -1,
        'data-workspace-table-cell': `${rowIndex}-${columnIndex}`,
        onFocus: () => setFocusedTableCell({ rowIndex, columnIndex }),
        onKeyDown: event => handleCollectionTableCellKeyDown(event, { rowIndex, columnIndex }),
    });
    const saveDraftOrRow = (row: CollectionViewTableRow, updates: {
        title?: string;
        shortcut?: string;
        hotkey?: string;
    }, commitDraft = false) => {
        if (row.isDraft) {
            if (pendingActionId)
                return;
            const nextDialog = { ...dialog, ...updates };
            setDialog(nextDialog);
            if (commitDraft && !nextDialog.shortcutError && !nextDialog.hotkeyError) {
                window.setTimeout(() => onSubmit(nextDialog), 0);
            }
            return;
        }
        // Display rows contain the active draft; compare against saved values instead.
        const savedRow = viewRows?.find(candidate => candidate.id === row.id);
        const changedUpdates = Object.fromEntries(Object.entries(updates).filter(([key, value]) => !savedRow || value !== (savedRow[key as 'title' | 'shortcut' | 'hotkey'] || '')));
        if (Object.keys(changedUpdates).length === 0)
            return;
        void onSaveViewRow?.(row.id, changedUpdates);
    };
    const content = (<div style={functionalThemeVariables}>
      {position === 'centered' && (<button type="button" aria-label="Close create workspace" className="fixed inset-0 z-[999998] h-full w-full appearance-none border-0 bg-[var(--color-overlayBg)] p-0" onClick={onClose} style={{ zIndex: dialogOverlayZIndex }}/>)}
      <div className={`fixed z-[999999] flex items-start justify-start pointer-events-auto animate-in fade-in duration-150 ${position === 'centered' ? '-translate-x-1/2' : ''} ${position === 'centered' && !isCreateDialog ? '-translate-y-1/2' : ''}`} style={{ top: position === 'centered' && !isCreateDialog ? '50%' : `${topPos}px`, left: leftPos, zIndex: dialogPopoverZIndex }} onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
      <div role="dialog" data-collection-dialog="" aria-modal={position === 'centered'} aria-label={isCreateDialog ? 'Create workspace' : 'Workspace settings'} className={`flex ${isCreateDialog
            ? 'w-[600px] max-w-[calc(100vw-32px)] rounded-2xl border p-4 shadow-2xl'
            : 'w-[min(1040px,calc(100vw-32px))] rounded-2xl border border-[var(--color-borderDefault)] p-0 shadow-2xl'} flex-col transition-colors overflow-hidden`} style={{
            backgroundColor: isCreateDialog ? 'var(--color-modalBg)' : (theme.isDark ? 'var(--color-rootBg)' : 'var(--color-sidebarBg)'),
            borderColor: 'var(--color-borderDefault)',
            color: 'var(--color-textPrimary)',
            boxShadow: popoverShadow,
            height: isCollectionTableDialog ? undefined : `${popoverMaxHeight}px`,
            minHeight: isCollectionTableDialog ? `${tableDialogMinHeight}px` : undefined,
            maxHeight: isCollectionTableDialog
                ? tableDialogPopoverMaxHeight
                : `${popoverMaxHeight}px`,
        }}>
        {isCreateDialog ? (<div className="flex shrink-0 flex-col gap-3.5 pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] gap-3">
                <label className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-xs font-medium text-[var(--color-textSecondary)]">
                    Title <span className="ml-0.5 font-bold text-[var(--color-danger)]">*</span>
                  </span>
                  <div className="relative min-w-0 flex-1">
                    <button ref={iconTriggerRef} type="button" aria-label="Choose view icon" aria-expanded={isIconPickerOpen} aria-haspopup="dialog" onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                setIsIconPickerOpen(prev => !prev);
            }} className="absolute left-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[var(--color-textPrimary)] transition-colors hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] cursor-pointer">
                      <DashboardViewIcon iconId={dialog.viewIconId || DEFAULT_VIEW_ICON_ID} title={dialog.title} isCustomIconSelected={dialog.isCustomIconSelected} size={14}/>
                    </button>
                    <input ref={titleInputRef} value={dialog.title} onChange={event => setDialog((prev: CreateCollectionDialogState | null) => prev ? { ...prev, title: event.target.value } : prev)} onKeyDown={event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    if (!dialog.shortcutError && !dialog.hotkeyError)
                        onSubmit();
                }
            }} type="text" placeholder="Enter title..." aria-label="Title" className="w-full rounded-lg border border-[var(--color-borderDefault)] bg-transparent py-1.5 pl-9 pr-3 text-xs font-semibold text-[var(--color-textPrimary)] placeholder:text-[var(--color-textPlaceholder)] outline-none focus:ring-2 focus:ring-[var(--color-focusRing)]"/>
                  </div>
                </label>

                <label className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-xs font-medium text-[var(--color-textSecondary)]">
                    Command
                  </span>
                  <div className="relative min-w-0 flex-1">
                    <CUnderscoreIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-iconDefault)] pointer-events-none select-none"/>
                    <input ref={shortcutInputRef} value={dialog.shortcut || ''} onChange={event => {
                const val = event.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                setDialog((prev: CreateCollectionDialogState | null) => prev ? { ...prev, shortcut: val } : prev);
            }} onKeyDown={event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    if (!dialog.shortcutError && !dialog.hotkeyError)
                        onSubmit();
                }
            }} type="text" placeholder="c_alias" aria-label="Command" className="w-full rounded-lg border border-[var(--color-borderDefault)] bg-transparent py-1.5 pl-8 pr-3 text-xs font-semibold text-[var(--color-textPrimary)] placeholder:text-[var(--color-textPlaceholder)] outline-none focus:ring-2 focus:ring-[var(--color-focusRing)]"/>
                  </div>
                </label>
              </div>
              <div data-shared-toolbar="true" className="ml-1 flex shrink-0 items-center gap-1">
                <HotkeyAssignButton itemId={dialog.viewId || 'new'} currentHotkey={dialog.hotkey || ''} onHotkeyChange={hotkey => setDialog((prev: CreateCollectionDialogState | null) => prev ? { ...prev, hotkey: normalizeHotkeyString(hotkey), hotkeyError: null } : prev)} sidebarMode={true} openToBottom={true} title={dialog.hotkey ? `Hotkey: ${dialog.hotkey}` : 'Assign a Keyboard Shortcut'} portalContainer={portalContainer} className="w-9 h-9 p-0 shrink-0 rounded-xl text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] transition-all flex items-center justify-center cursor-pointer border-none bg-transparent shadow-none disabled:opacity-30 disabled:cursor-not-allowed"/>
                <button type="button" aria-label="Close" onClick={onClose} className="p-1.5 rounded-lg text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] transition-colors cursor-pointer">
                  <LuX size={16}/>
                </button>
              </div>
            </div>

          </div>) : (<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--color-borderDefault)] bg-transparent">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--color-borderDefault)] px-4 py-2">
          <h2 className="text-sm font-semibold text-[var(--color-textPrimary)]">Workspaces</h2>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Open documentation" title="Docs" onClick={() => window.open(BRAND.docs.workspaceCollections, '_blank', 'noopener,noreferrer')} className="p-1.5 rounded-lg text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] transition-colors cursor-pointer">
              <LuCircleHelp size={16}/>
            </button>
            <button type="button" aria-label="Close" onClick={onClose} className="p-1.5 rounded-lg text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] transition-colors cursor-pointer">
              <LuX size={16}/>
            </button>
          </div>
        </div>
        <div ref={collectionTableRef} role="grid" aria-label="Workspace workspaces" aria-rowcount={tableRows.length} aria-colcount={COLLECTION_TABLE_COLUMN_COUNT} className={`flex min-h-0 ${isCollectionTableDialog ? 'shrink-0' : 'flex-1'} flex-col overflow-x-auto overflow-y-hidden rounded-xl border border-[var(--color-borderDefault)] bg-transparent`} style={isCollectionTableDialog ? { maxHeight: tableDialogTableMaxHeight } : undefined}>
          <div role="row" className={`${tableGridClass} shrink-0 border-b border-[var(--color-borderDefault)] bg-[var(--color-panelBg)] text-xs font-semibold text-[var(--color-textSecondary)]`}>
            <div className="px-2 py-2 text-center">Icon</div>
            <div className="px-3 py-2">Workspaces</div>
            <div className="px-3 py-2">Text command</div>
            <div className="px-3 py-2">Hotkey</div>
            <div className="px-3 py-2">Links</div>
            <div className="whitespace-nowrap px-2 py-2">Focus mode</div>
            <div className="whitespace-nowrap px-2 py-2">Auto-save</div>
            <div className="px-0.5 py-2 text-center text-[10.5px]">Actions</div>
          </div>
          <div className={`min-h-0 ${isCollectionTableDialog ? 'shrink-0' : 'flex-1'} overflow-y-auto overflow-x-hidden custom-scrollbar`} style={isCollectionTableDialog ? { maxHeight: tableDialogBodyMaxHeight } : undefined}>
            {tableRows.map((row, rowIndex) => {
                const isActiveDialogRow = row.isDraft || (dialog.mode === 'rename' && row.id === dialog.viewId);
                const titleValue = isActiveDialogRow ? dialog.title : row.title;
                const shortcutValue = isActiveDialogRow ? dialog.shortcut || '' : row.shortcut || '';
                const hotkeyValue = isActiveDialogRow ? dialog.hotkey || '' : row.hotkey || '';
                const isFocusEnabled = row.isDraft ? isFocusModeEnabled : Boolean(row.focusMode);
                const isAutoSaveRowEnabled = row.isDraft ? isAutoSaveEnabled : Boolean(row.autoSave);
                const rowLinks = row.links || [];
                const isLinksExpanded = expandedLinksRowId === row.id;
                const canEditLinks = row.canEditLinks !== false;
                return (<React.Fragment key={row.id}>
                <div role="row" tabIndex={-1} onClick={() => {
                        if (!row.isDraft)
                            onSelectViewRow?.(row.id);
                    }} onKeyDown={event => {
                        if (event.target !== event.currentTarget)
                            return;
                        if (!row.isDraft && (event.key === 'Enter' || event.key === ' ')) {
                            event.preventDefault();
                            onSelectViewRow?.(row.id);
                        }
                    }} className={`${tableGridClass} group/collection-row items-stretch border-b border-[var(--color-borderDefault)] text-[12px] font-semibold text-[var(--color-textPrimary)] ${row.id === dialog.viewId ? 'bg-[var(--color-selectedBg)]' : ''}`}>
                  <div {...getCollectionTableCellProps(rowIndex, 0)} className={`flex items-center justify-center px-2 py-2 ${tableCellFocusClass}`}>
                    <button type="button" aria-label={`Choose icon for ${row.title || 'new workspace'}`} aria-haspopup="dialog" aria-expanded={isIconPickerOpen && iconPickerRowId === row.id} disabled={Boolean(pendingActionId)} onClick={event => {
                        event.stopPropagation();
                        iconTriggerRef.current = event.currentTarget;
                        setIconPickerRowId(row.id);
                        setIsIconPickerOpen(true);
                    }} className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-iconDefault)] hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] disabled:opacity-50 cursor-pointer">
                      <DashboardViewIcon iconId={row.isDraft ? dialog.viewIconId : row.viewIconId} size={14}/>
                    </button>
                  </div>
                  <div {...getCollectionTableCellProps(rowIndex, 1)} className={`flex min-w-0 ${isLinksExpanded ? 'items-start' : 'items-center'} gap-1 px-2 py-2 ${tableCellFocusClass}`}>
                    <input ref={rowIndex === 0 ? titleInputRef : undefined} value={titleValue} onClick={event => event.stopPropagation()} onFocus={() => {
                        if (!row.isDraft)
                            onSelectViewRow?.(row.id);
                    }} onChange={event => {
                        const nextTitle = event.target.value;
                        setDialog((prev: CreateCollectionDialogState | null) => prev
                            ? {
                                ...prev,
                                viewId: row.isDraft ? prev.viewId : row.id,
                                title: nextTitle,
                            }
                            : prev);
                    }} onBlur={event => {
                        if (!row.isDraft) {
                            saveDraftOrRow(row, { title: event.currentTarget.value.trim() });
                        }
                    }} onKeyDown={event => {
                        event.stopPropagation();
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            saveDraftOrRow(row, { title: event.currentTarget.value.trim() }, true);
                        }
                    }} type="text" placeholder="Workspace name" aria-label={`${row.title || 'Workspace'} title`} className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1.5 text-xs font-semibold text-[var(--color-textPrimary)] placeholder:text-[var(--color-textPlaceholder)] outline-none transition-colors hover:border-[var(--color-borderDefault)] focus:border-[var(--color-borderActive)] focus:bg-[var(--color-inputBg)]"/>
                  </div>
                  <div {...getCollectionTableCellProps(rowIndex, 2)} className={`min-w-0 px-2 py-2 ${tableCellFocusClass}`}>
                    <div className="relative w-full">
                      <CUnderscoreIcon size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--color-iconDefault)] pointer-events-none select-none"/>
                      <input ref={rowIndex === 0 ? shortcutInputRef : undefined} value={shortcutValue} onClick={event => event.stopPropagation()} onFocus={() => {
                        if (!row.isDraft)
                            onSelectViewRow?.(row.id);
                    }} onChange={event => {
                        const nextShortcut = event.currentTarget.value.replace(/[^a-zA-Z0-9_]/g, '');
                        setDialog((prev: CreateCollectionDialogState | null) => prev
                            ? {
                                ...prev,
                                viewId: row.isDraft ? prev.viewId : row.id,
                                shortcut: nextShortcut,
                            }
                            : prev);
                    }} onBlur={event => {
                        if (!row.isDraft) {
                            saveDraftOrRow(row, { shortcut: event.currentTarget.value.replace(/[^a-zA-Z0-9_]/g, '') });
                        }
                    }} onKeyDown={event => {
                        event.stopPropagation();
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            saveDraftOrRow(row, { shortcut: event.currentTarget.value.replace(/[^a-zA-Z0-9_]/g, '') }, true);
                        }
                    }} type="text" placeholder="alias" aria-label={`${row.title || 'Workspace'} command`} className="w-full rounded-md border border-transparent bg-transparent py-1.5 pl-7 pr-2 text-xs font-semibold text-[var(--color-textPrimary)] placeholder:text-[var(--color-textPlaceholder)] outline-none transition-colors hover:border-[var(--color-borderDefault)] focus:border-[var(--color-borderActive)] focus:bg-[var(--color-inputBg)]"/>
                    </div>
                  </div>
                  <div {...getCollectionTableCellProps(rowIndex, 3)} className={`min-w-0 px-2 py-2 ${tableCellFocusClass}`}>
                    <input ref={rowIndex === 0 ? hotkeyInputRef : undefined} value={hotkeyValue} readOnly onClick={event => event.stopPropagation()} onFocus={() => {
                        if (!row.isDraft)
                            onSelectViewRow?.(row.id);
                    }} onKeyDown={event => {
                        if (event.key === 'Tab') {
                            event.stopPropagation();
                            return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        if (event.key === 'Backspace' || event.key === 'Delete') {
                            setDialog((prev: CreateCollectionDialogState | null) => prev
                                ? {
                                    ...prev,
                                    viewId: row.isDraft ? prev.viewId : row.id,
                                    hotkey: '',
                                    hotkeyError: null,
                                }
                                : prev);
                            saveDraftOrRow(row, { hotkey: '' });
                            return;
                        }
                        const captured = buildHotkeyString(event.nativeEvent, typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform));
                        if (!captured || captured === 'CANCEL')
                            return;
                        const normalizedHotkey = normalizeHotkeyString(captured);
                        setDialog((prev: CreateCollectionDialogState | null) => prev
                            ? {
                                ...prev,
                                viewId: row.isDraft ? prev.viewId : row.id,
                                hotkey: normalizedHotkey,
                                hotkeyError: null,
                            }
                            : prev);
                        saveDraftOrRow(row, { hotkey: normalizedHotkey });
                    }} type="text" placeholder="Bind hotkey" aria-label={`${row.title || 'Workspace'} hotkey`} className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-xs font-semibold text-[var(--color-textPrimary)] placeholder:text-[var(--color-textPlaceholder)] outline-none transition-colors hover:border-[var(--color-borderDefault)] focus:border-[var(--color-borderActive)] focus:bg-[var(--color-inputBg)]"/>
                  </div>
                  <div {...getCollectionTableCellProps(rowIndex, 4)} data-links-expander-root={row.id} onClick={event => event.stopPropagation()} className={`min-w-0 ${isLinksExpanded ? 'p-0' : 'px-2 py-2'} ${tableCellFocusClass}`}>
                    {isLinksExpanded ? (<div className="flex max-h-[180px] min-h-[64px] flex-col overflow-hidden">
                        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                          {rowLinks.length > 0 ? (rowLinks.map((item, linkIndex) => {
                            const favicon = getLinkFavicon(item);
                            const title = getLinkTitle(item);
                            const displayUrl = getLinkDisplayUrl(item);
                            return (<div key={item.id || `${item.url}-${linkIndex}`} className="group flex min-w-0 items-center gap-2 border-b border-[var(--color-borderDefault)] px-3 py-2 text-xs font-medium text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)]">
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--color-hoverBg)]">
                                    {favicon ? (<img src={favicon} alt="" className="h-4 w-4 object-contain"/>) : (<LuLink size={14} className="text-[var(--color-iconDefault)]"/>)}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-[var(--color-textPrimary)]">
                                    {title}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--color-textMuted)]">
                                    {displayUrl}
                                  </span>
                                  <button type="button" onClick={event => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    openLinkUrl(item.url);
                                }} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--color-textMuted)] opacity-0 transition-all group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]" title={`Open ${title}`}>
                                    <LuExternalLink size={14}/>
                                  </button>
                                  {canEditLinks && onRemoveViewRowLink && (<button type="button" onClick={event => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        void onRemoveViewRowLink(row.id, item, linkIndex);
                                    }} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--color-textMuted)] opacity-0 transition group-hover:opacity-100 hover:bg-[var(--color-dangerBg)] hover:text-[var(--color-danger)]" title="Remove link">
                                      <LuTrash2 size={14}/>
                                    </button>)}
                                </div>);
                        })) : (<div className="flex min-h-[52px] items-center justify-center border-b border-[var(--color-borderDefault)] px-3 py-3 text-xs font-medium text-[var(--color-textMuted)]">
                              No links yet.
                            </div>)}
                        </div>
                        <div className="flex shrink-0 justify-center px-3 py-2">
                          <button type="button" disabled={!canEditLinks || !onRequestAddViewLinks} onClick={event => {
                            event.preventDefault();
                            event.stopPropagation();
                            onRequestAddViewLinks?.(row.id);
                        }} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-[var(--color-success)] transition-colors hover:bg-[var(--color-hoverBg)] disabled:cursor-not-allowed disabled:opacity-50">
                            <LuPlus size={14}/>
                            <span>Add links</span>
                          </button>
                        </div>
                      </div>) : (<button type="button" aria-expanded={isLinksExpanded} onClick={event => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (!row.isDraft)
                                onSelectViewRow?.(row.id);
                            setExpandedLinksRowId(current => (current === row.id ? null : row.id));
                        }} className="flex min-h-[28px] w-full max-w-full items-center rounded-md px-2 py-1 text-left text-xs font-semibold text-[var(--color-textSecondary)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]">
                        {rowLinks.length > 0 ? (<span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden whitespace-nowrap">
                            <span className="flex shrink-0 items-center pl-1">
                              {rowLinks.slice(0, 4).map((item, linkIndex) => {
                                const favicon = getLinkFavicon(item);
                                const title = getLinkTitle(item);
                                return (<span key={item.id || `${item.url}-${linkIndex}`} className={`flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--color-borderDefault)] bg-[var(--color-popupBg,var(--color-modalBg))] ${linkIndex > 0 ? '-ml-2' : ''}`} style={{ zIndex: rowLinks.length - linkIndex }} title={title}>
                                    {favicon ? (<img src={favicon} alt="" className="h-full w-full object-cover"/>) : (<LuLink size={12} className="text-[var(--color-iconDefault)]"/>)}
                                  </span>);
                            })}
                            </span>
                            <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden whitespace-nowrap">
                              <span className="min-w-0 flex-1 truncate">{getLinkTitle(rowLinks[0])}</span>
                              {rowLinks.length > 1 && (<span className="shrink-0 text-[11px] text-[var(--color-textMuted)]">
                                  +{rowLinks.length - 1}
                                </span>)}
                            </span>
                          </span>) : (<span className="min-w-0 flex-1 truncate">Add links</span>)}
                      </button>)}
                  </div>
                  <div {...getCollectionTableCellProps(rowIndex, 5)} className={`flex ${isLinksExpanded ? 'items-start' : 'items-center'} justify-center px-2 py-2 ${tableCellFocusClass}`}>
                    <button type="button" onClick={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        row.isDraft
                            ? void updateSessionSettings({
                                focusMode: !isFocusEnabled,
                            })
                            : void onToggleViewSessionSetting?.(row.id, {
                                focusMode: !isFocusEnabled,
                            });
                    }} aria-pressed={isFocusEnabled} disabled={pendingActionId !== null} className="flex items-center justify-center cursor-pointer p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]" title="Focus mode: close existing tabs and only allow this workspace's approved domains.">
                      <span className={`flex h-[16px] w-[16px] items-center justify-center rounded-[4px] border transition-all ${isFocusEnabled
                        ? 'border-[var(--color-borderActive)] bg-[var(--color-textPrimary)] text-[var(--color-editorBg)]'
                        : 'border-[var(--color-borderDefault)] bg-transparent hover:border-[var(--color-borderActive)]'}`}>
                        {isFocusEnabled && <LuCheck size={11} strokeWidth={3}/>}
                      </span>
                    </button>
                  </div>
                  <div {...getCollectionTableCellProps(rowIndex, 6)} className={`flex ${isLinksExpanded ? 'items-start' : 'items-center'} justify-center px-2 py-2 ${tableCellFocusClass}`}>
                    <button type="button" onClick={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        row.isDraft
                            ? void updateSessionSettings({
                                autoSaveMode: isAutoSaveRowEnabled ? 'dont_save' : 'auto_save',
                            })
                            : void onToggleViewSessionSetting?.(row.id, {
                                autoSaveMode: isAutoSaveRowEnabled ? 'dont_save' : 'auto_save',
                            });
                    }} aria-pressed={isAutoSaveRowEnabled} disabled={pendingActionId !== null} className="flex items-center justify-center cursor-pointer p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]" title="Auto-save: automatically save session changes as tabs are added or removed.">
                      <span className={`flex h-[16px] w-[16px] items-center justify-center rounded-[4px] border transition-all ${isAutoSaveRowEnabled
                        ? 'border-[var(--color-borderActive)] bg-[var(--color-textPrimary)] text-[var(--color-editorBg)]'
                        : 'border-[var(--color-borderDefault)] bg-transparent hover:border-[var(--color-borderActive)]'}`}>
                        {isAutoSaveRowEnabled && <LuCheck size={11} strokeWidth={3}/>}
                      </span>
                    </button>
                  </div>
                  <div {...getCollectionTableCellProps(rowIndex, 7)} className={`flex ${isLinksExpanded ? 'items-start' : 'items-center'} justify-center px-0.5 py-2 ${tableCellFocusClass}`}>
                    {row.isDraft ? (<button type="button" onClick={event => {
                            event.preventDefault();
                            event.stopPropagation();
                            onSubmit(dialog);
                        }} disabled={pendingActionId !== null ||
                            !dialog.title.trim() ||
                            !!dialog.shortcutError ||
                            !!dialog.hotkeyError} className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--color-success)] transition-colors hover:bg-[var(--color-hoverBg)] disabled:cursor-not-allowed disabled:opacity-40" title="Create workspace">
                        <LuCheck size={14} strokeWidth={2.5}/>
                      </button>) : (<button type="button" onClick={event => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (onDeleteViewRow) {
                                onDeleteViewRow(row.id);
                            }
                            else if (onRequestDelete) {
                                onRequestDelete();
                            }
                        }} className="flex h-5 w-5 items-center justify-center rounded-md text-[var(--color-danger)] transition-colors hover:bg-[var(--color-dangerBg)]" title="Delete view">
                        <LuTrash2 size={14}/>
                      </button>)}
                  </div>
                </div>
                </React.Fragment>);
            })}
          </div>
        </div>
          </div>)}
          {(dialog.shortcutError || dialog.hotkeyError) && (<div className="flex min-w-0 items-center gap-2">
              {dialog.shortcutError && (<span className="min-w-0 truncate text-[10.5px] font-medium text-[var(--color-danger)]">
                  {dialog.shortcutError}
                </span>)}
              {dialog.shortcutError && dialog.isShortcutOverrideable && onOverrideShortcut && (<button type="button" onMouseDown={event => {
                    event.preventDefault();
                    event.stopPropagation();
                }} onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    onOverrideShortcut();
                }} className="shrink-0 rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-textPrimary)] transition-colors cursor-pointer" title="Reassign shortcut to this item">
                  Override
                </button>)}
              {dialog.hotkeyError && (<span className="min-w-0 truncate text-[10.5px] font-medium text-[var(--color-danger)]">
                  {dialog.hotkeyError}
                </span>)}
            </div>)}

        {(actionError || showSessionSection || showWidgetsSection) && (<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden py-1 pr-0.5">
            {actionError && <div className="pb-2 text-[11px] font-semibold text-[var(--color-danger)]">{actionError}</div>}

            

            {showWidgetsSection && (<div className="rounded-xl border border-[var(--color-borderDefault)] bg-transparent p-3 mb-3 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 pb-1 text-xs font-bold text-[var(--color-textPrimary)]">
                    <LuLayoutGrid size={14} className="text-[var(--color-textMuted)]"/>
                    <span>Widgets (optional)</span>
                  </div>
                  {stagedWidgets.length > 0 ? (<div className="overflow-y-auto overflow-x-hidden py-0.5 custom-scrollbar" style={{ maxHeight: 'clamp(80px, 15vh, 200px)' }}>
                      {stagedWidgets.map((item, index) => (<div key={`${item.id}-${index}`} className="group/widget-row flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold text-[var(--color-textSecondary)] transition-colors hover:bg-[var(--color-hoverBg)]">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                            {getWidgetHeaderIcon(item.type)}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{getCatalogWidgetDisplayName(item)}</span>
                          <button type="button" aria-label={`Remove ${getCatalogWidgetDisplayName(item)}`} title="Remove widget" disabled={pendingActionId !== null} onClick={event => {
                            event.preventDefault();
                            event.stopPropagation();
                            onRemoveStagedWidget(index);
                        }} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--color-textMuted)] opacity-0 transition group-hover/widget-row:opacity-100 hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-40">
                            <LuTrash2 size={13}/>
                          </button>
                        </div>))}
                    </div>) : (<div className="flex flex-col items-center justify-center py-4 px-3 text-center">
                      <p className="text-xs font-medium text-[var(--color-textSecondary)]">
                        No widgets added to this workspace yet.
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--color-textMuted)]">
                        Add notes, quick links, weather, or custom tools to display alongside your workspace.
                      </p>
                    </div>)}

                  <button type="button" onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsWidgetPickerOpen(true);
                }} disabled={pendingActionId !== null} className="mx-auto inline-flex w-fit items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-[var(--color-success)] transition-colors hover:bg-[var(--color-hoverBg)] disabled:cursor-not-allowed disabled:opacity-50">
                    <LuPlus size={14}/>
                    <span>Add widget</span>
                  </button>
                </div>)}
          </div>)}
        {isCreateDialog && (<div className="flex shrink-0 justify-end gap-2 pt-3">
            <button type="button" onClick={onClose} disabled={pendingActionId !== null} className="rounded-lg border border-[var(--color-borderDefault)] bg-transparent px-3.5 py-1.5 text-xs font-semibold text-[var(--color-textSecondary)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer">
              Cancel
            </button>
            <button type="button" onClick={() => onSubmit()} disabled={pendingActionId !== null || !!dialog.shortcutError || !!dialog.hotkeyError} className="rounded-lg border border-transparent bg-[var(--color-borderActive)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-textPrimary)] shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer">
              Save View
            </button>
          </div>)}
      </div>
      </div>

      {isWidgetPickerOpen &&
            ReactDOM.createPortal(<div className="fixed inset-0 z-[10000000] flex items-center justify-center p-4" style={functionalThemeVariables}>
            <button type="button" aria-label="Close add widget" className="absolute inset-0 h-full w-full bg-[var(--color-overlayBg)]" onClick={() => setIsWidgetPickerOpen(false)}/>
            <section role="dialog" aria-modal="true" aria-label="Add widget" className="relative z-10 w-[720px] max-w-full rounded-2xl border border-[var(--color-borderDefault)] bg-[var(--color-modalBg)] p-4 shadow-2xl">
              <div className="flex items-center justify-between pb-3">
                <h3 className="text-sm font-semibold text-[var(--color-textPrimary)]">Select a widget</h3>
                <button type="button" aria-label="Close add widget" onClick={() => setIsWidgetPickerOpen(false)} className="rounded-md p-1 text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)]">
                  <LuX size={15}/>
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 custom-scrollbar">
                <WidgetCatalogGrid variant="sidebar" pendingWidgetIds={pendingWidgetIds} getWidgetCount={item => {
                    const itemType = normalizeWidgetType(item.type);
                    if (itemType === 'session-item')
                        return 1;
                    return stagedWidgets.filter(stagedItem => normalizeWidgetType(stagedItem.type) === itemType).length;
                }} isWidgetDisabled={(item, count) => requiresExternalPicker(item) ||
                    (isSingleInstanceWidgetType(normalizeWidgetType(item.type)) && count >= 1)} onSelectWidget={item => {
                    if (item.isEditorAction && item.editorType) {
                        openEditorByCatalogType(item.editorType);
                        setIsWidgetPickerOpen(false);
                        return;
                    }
                    onStageWidget(item);
                    setIsWidgetPickerOpen(false);
                }}/>
              </div>
            </section>
          </div>, portalContainer || document.body)}

      {isIconPickerOpen && (() => {
            const triggerRect = iconTriggerRef.current?.getBoundingClientRect();
            const pickerTop = (triggerRect?.bottom || 100) + 8;
            const pickerLeft = Math.max(16, triggerRect?.left || 16);
            return ReactDOM.createPortal(<div ref={iconPickerRef} aria-label="View icon selector" role="dialog" className="fixed z-[9999999] grid grid-cols-5 gap-2 rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-modalBg)] p-3 shadow-2xl animate-in fade-in duration-150" style={{
                    ...functionalThemeVariables,
                    top: `${pickerTop}px`,
                    left: `${pickerLeft}px`,
                    boxShadow: floatingPanelShadow,
                }}>
            {DASHBOARD_VIEW_ICONS.map(iconDef => {
                    const pickerRow = tableRows.find(row => row.id === iconPickerRowId);
                    const selectedIconId = pickerRow && !pickerRow.isDraft ? pickerRow.viewIconId : dialog.viewIconId;
                    const isSelected = (selectedIconId || DEFAULT_VIEW_ICON_ID) === iconDef.id;
                    const IconComp = iconDef.icon;
                    return (<button key={iconDef.id} type="button" title={iconDef.label} aria-label={iconDef.label} aria-selected={isSelected} onClick={event => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (pickerRow && !pickerRow.isDraft) {
                                void onSaveViewRow?.(pickerRow.id, { viewIconId: iconDef.id });
                            } else {
                                setDialog((prev: any) => prev ? { ...prev, viewIconId: iconDef.id, isCustomIconSelected: true } : prev);
                            }
                            iconTriggerRef.current?.focus();
                            setIsIconPickerOpen(false);
                        }} style={{
                            backgroundColor: isSelected
                                ? 'var(--color-selectedBg)'
                                : 'var(--color-inputBg, transparent)',
                            borderColor: isSelected
                                ? 'var(--color-borderActive)'
                                : 'transparent',
                            color: isSelected
                                ? 'var(--color-textPrimary)'
                                : 'var(--color-textSecondary)',
                        }} className="flex items-center justify-center rounded-lg border p-2.5 transition-all hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] cursor-pointer">
                  <IconComp size={16}/>
                </button>);
                })}
          </div>, portalContainer || document.body);
        })()}

    </div>);
    return ReactDOM.createPortal(content, portalContainer || document.body);
};
export default CreateCollectionDialog;
