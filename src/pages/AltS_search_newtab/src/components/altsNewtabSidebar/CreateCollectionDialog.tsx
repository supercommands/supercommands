import * as React from 'react';
import ReactDOM from 'react-dom';
import { LuPlus, LuTrash2, LuX, LuPin, LuCircleHelp, LuLayers, LuLayoutGrid } from 'react-icons/lu';
import { FiMoreVertical } from 'react-icons/fi';
import {
  DASHBOARD_VIEW_ICONS,
  DashboardViewIcon,
  DEFAULT_VIEW_ICON_ID,
  type DashboardViewIconId,
} from './dashboardViewIcons';
import { CUnderscoreIcon } from '../../../../../shared-components/icons/cUnderscoreIcon';
import { buildHotkeyString, normalizeHotkeyString } from '../../../../../shared-components/hotkeys/core/eventParser';
import type { SelectedLink } from '../../../../../allObjectFolder/src/createObject/links/linkTypes';
import type { SessionOpenSettings } from '../../../../../allObjectFolder/src/createObject/session/sessionSettings';
import WidgetCatalogGrid from '../widgets/components/WidgetCatalogGrid';
import { type WidgetCatalogItem } from '../widgets/widgetCatalog';
import { getWidgetHeaderIcon } from '../widgets/utils/widgetHeaderIcons';
import { getWidgetTypeLabel } from '../widgets/utils/widgetTypeLabel';
import { isSingleInstanceWidgetType } from '../../../../../storage/localStorage/widgetDashboardStorage';

const SessionEditorView = React.lazy(
  () => import('../../../../../allObjectFolder/src/createObject/session/ui/SessionEditorView'),
);

export type CreateSessionDraft = {
  title?: string;
  urls: SelectedLink[];
  sessionOpenSettings?: SessionOpenSettings;
  workspaceId?: string | null;
  folderId?: string | null;
  tagIds?: string[];
};

export const createEmptySessionDraft = (): CreateSessionDraft => ({
  title: '',
  urls: [],
});

export type CreateCollectionDialogState = {
  mode: 'create' | 'rename';
  viewId?: string;
  title: string;
  shortcut?: string;
  hotkey?: string;
  hotkeyError?: string | null;
  viewIconId: DashboardViewIconId;
  shortcutConflictId?: string | null;
  isShortcutOverrideable?: boolean;
  shortcutError?: string | null;
  isDefault?: boolean;
};

type CreateCollectionDialogProps = {
  anchorRef?: React.RefObject<HTMLElement | null>;
  dialog: CreateCollectionDialogState;
  setDialog: React.Dispatch<React.SetStateAction<any>>;
  onClose: () => void;
  onSubmit: () => void;
  actionError?: string | null;
  pendingActionId?: string | null;
  onOverrideShortcut?: (() => void) | null;
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
  appearanceScope?: 'default' | 'alts';
  appearanceTokens?: React.CSSProperties;
  embeddedInAltSShell?: boolean;
  hideWidgetsSection?: boolean;
};

type DialogThemeVars = React.CSSProperties & Record<`--${string}`, string>;

const ALTS_DIALOG_THEME_VARS: DialogThemeVars = {
  '--color-modalBg': 'color-mix(in srgb, var(--alts-popup-bg, var(--color-altsPopupBg)) 94%, var(--alts-row-hover-bg, var(--color-altsRowHoverBg)))',
  '--color-overlayBg': 'color-mix(in srgb, var(--alts-popup-bg, var(--color-altsPopupBg)) 42%, transparent)',
  '--color-borderDefault': 'color-mix(in srgb, var(--alts-border-color, var(--color-altsBorderColor)) 30%, transparent)',
  '--color-borderActive': 'color-mix(in srgb, var(--alts-icon-tile-action-bg, var(--color-altsIconTileActionBg)) 44%, var(--alts-border-color, var(--color-altsBorderColor)))',
  '--color-textPrimary': 'var(--alts-text-primary, var(--color-altsTextPrimary))',
  '--color-textSecondary': 'var(--alts-text-secondary, var(--color-altsTextSecondary))',
  '--color-textMuted': 'var(--alts-text-placeholder, var(--color-altsTextPlaceholder))',
  '--color-textPlaceholder': 'var(--alts-text-placeholder, var(--color-altsTextPlaceholder))',
  '--color-iconDefault': 'var(--alts-text-secondary, var(--color-altsTextSecondary))',
  '--color-hoverBg': 'var(--alts-row-hover-bg, var(--color-altsRowHoverBg))',
  '--color-focusRing': 'color-mix(in srgb, var(--alts-focus-color, var(--color-altsFocusColor)) 18%, transparent)',
  '--color-inputBg': 'var(--alts-search-bg, var(--color-altsSearchBg))',
  '--color-selectedBg': 'var(--alts-row-selected-bg, var(--color-altsRowSelectedBg))',
  '--color-editorBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
  '--color-popupBg': 'var(--alts-popup-bg, var(--color-altsPopupBg))',
};

const normalizeWidgetType = (value: unknown): string => String(value || '').toLowerCase().trim();

const getCatalogWidgetDisplayName = (item: WidgetCatalogItem): string =>
  String(item.title || '').trim() ||
  getWidgetTypeLabel(item.type) ||
  'Widget';

const requiresExternalPicker = (item: WidgetCatalogItem): boolean =>
  item.type === 'note-item' || item.type === 'html' || item.type === 'session-item';

export const CreateCollectionDialog: React.FC<CreateCollectionDialogProps> = ({
  anchorRef,
  dialog,
  setDialog,
  onClose,
  onSubmit,
  actionError,
  pendingActionId,
  onOverrideShortcut,
  stagedWidgets,
  pendingWidgetIds,
  draftSession,
  onDraftSessionChange,
  onStageWidget,
  onRemoveStagedWidget,
  linkedSessionId,
  linkedWidgetId,
  position = 'anchored',
  portalContainer,
  appearanceScope = 'default',
  appearanceTokens,
  embeddedInAltSShell = false,
  hideWidgetsSection = false,
}) => {
  const [isWidgetPickerOpen, setIsWidgetPickerOpen] = React.useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = React.useState(false);
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const iconTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const iconPickerRef = React.useRef<HTMLDivElement | null>(null);
  const menuTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const titleInputRef = React.useRef<HTMLInputElement | null>(null);
  const shortcutInputRef = React.useRef<HTMLInputElement | null>(null);
  const hotkeyInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!isMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
      const target = event.target as Node | null;
      const isInsideMenu =
        (menuRef.current && path.includes(menuRef.current)) ||
        (target && menuRef.current?.contains(target));
      const isInsideTrigger =
        (menuTriggerRef.current && path.includes(menuTriggerRef.current)) ||
        (target && menuTriggerRef.current?.contains(target));

      if (isInsideMenu || isInsideTrigger) return;
      setIsMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isMenuOpen]);

  React.useEffect(() => {
    window.setTimeout(() => titleInputRef.current?.focus(), 0);
  }, []);

  React.useEffect(() => {
    const handleDialogEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isIconPickerOpen && !isWidgetPickerOpen && !isMenuOpen) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleDialogEscape, true);
    return () => document.removeEventListener('keydown', handleDialogEscape, true);
  }, [isIconPickerOpen, isWidgetPickerOpen, isMenuOpen, onClose]);

  React.useEffect(() => {
    if (!isIconPickerOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
      const target = event.target as Node | null;
      const isInsidePicker =
        (iconPickerRef.current && path.includes(iconPickerRef.current)) ||
        (target && iconPickerRef.current?.contains(target));
      const isInsideTrigger =
        (iconTriggerRef.current && path.includes(iconTriggerRef.current)) ||
        (target && iconTriggerRef.current?.contains(target));

      if (isInsidePicker || isInsideTrigger) return;
      setIsIconPickerOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsIconPickerOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isIconPickerOpen]);

  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 720;
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const viewportMargin = 16;
  const popoverGap = 10;
  const popoverWidth = Math.min(760, Math.max(320, viewportWidth - viewportMargin * 2));
  const rect = anchorRef?.current?.getBoundingClientRect();
  const desiredPopoverHeight = Math.round(viewportHeight * 0.7);
  const topPos = (() => {
    if (position === 'centered') return Math.max(viewportMargin, Math.floor((viewportHeight - desiredPopoverHeight) / 2));
    const availableBelow = rect ? viewportHeight - rect.top - viewportMargin : viewportHeight - 60 - viewportMargin;
    const availableAbove = rect ? rect.bottom - viewportMargin : 0;
    if (!rect) return Math.max(viewportMargin, Math.min(60, viewportHeight - desiredPopoverHeight - viewportMargin));
    if (desiredPopoverHeight <= availableBelow) return Math.max(viewportMargin, rect.top);
    if (desiredPopoverHeight <= availableAbove) return Math.max(viewportMargin, rect.bottom - desiredPopoverHeight);
    // Doesn't fit above or below: center vertically
    return Math.max(viewportMargin, Math.floor((viewportHeight - desiredPopoverHeight) / 2));
  })();
  const popoverMaxHeight = embeddedInAltSShell
    ? viewportHeight - viewportMargin * 2
    : Math.min(desiredPopoverHeight, viewportHeight - topPos - viewportMargin);
  const leftPos = (() => {
    if (position === 'centered') return '50%';
    const defaultLeft = Math.min(280, viewportWidth - viewportMargin - popoverWidth);
    if (!rect) return `${Math.max(viewportMargin, defaultLeft)}px`;

    const rightSideLeft = rect.right + popoverGap;
    const leftSideLeft = rect.left - popoverWidth - popoverGap;
    if (rightSideLeft + popoverWidth <= viewportWidth - viewportMargin) {
      return `${rightSideLeft}px`;
    }
    if (leftSideLeft >= viewportMargin) {
      return `${leftSideLeft}px`;
    }
    const clampedLeft = Math.min(
      Math.max(viewportMargin, rightSideLeft),
      viewportWidth - viewportMargin - popoverWidth,
    );
    return `${clampedLeft}px`;
  })();
  const isAltSAppearance = appearanceScope === 'alts';
  const appearanceStyle =
    isAltSAppearance
      ? ({ ...appearanceTokens, ...ALTS_DIALOG_THEME_VARS } as DialogThemeVars)
      : appearanceTokens;
  const altSTopLayerZIndex = 2147483647;
  const dialogOverlayZIndex = isAltSAppearance ? altSTopLayerZIndex - 3 : 999998;
  const dialogPopoverZIndex = isAltSAppearance ? altSTopLayerZIndex - 2 : 999999;
  const dialogSubPopupZIndex = isAltSAppearance ? altSTopLayerZIndex : undefined;
  const popoverShadow =
    isAltSAppearance
      ? '0 14px 42px color-mix(in srgb, var(--alts-popup-bg, var(--color-altsPopupBg)) 24%, transparent)'
      : '0 20px 60px rgba(0,0,0,0.45)';
  const floatingPanelShadow =
    isAltSAppearance
      ? '0 10px 28px color-mix(in srgb, var(--alts-popup-bg, var(--color-altsPopupBg)) 18%, transparent)'
      : '0 12px 32px rgba(0,0,0,0.3)';
  const showSessionSection = true;
  const showWidgetsSection = false;

  const content = (
    <div
      className={isAltSAppearance ? 'create-collection-dialog-alts' : undefined}
      style={appearanceStyle}>
      {isAltSAppearance && (
        <style>{`
          .create-collection-dialog-alts :where(.border, .border-t, .border-r, .border-b, .border-l) {
            border-color: color-mix(in srgb, var(--alts-border-color, var(--color-altsBorderColor)) 30%, transparent) !important;
          }
          .create-collection-dialog-alts :where(input, button, section, [data-session-widget-root]) {
            --tw-ring-color: color-mix(in srgb, var(--alts-focus-color, var(--color-altsFocusColor)) 18%, transparent) !important;
          }
        `}</style>
      )}
      {position === 'centered' && !embeddedInAltSShell && (
        <button
          type="button"
          aria-label="Close create collection"
          className="fixed inset-0 z-[999998] h-full w-full appearance-none border-0 bg-[var(--color-overlayBg)] p-0"
          onClick={onClose}
          style={{ zIndex: dialogOverlayZIndex }}
        />
      )}
      <div
        className={`${embeddedInAltSShell ? 'relative h-full min-h-0 w-full overflow-hidden' : 'fixed z-[999999]'} flex items-start justify-start pointer-events-auto animate-in fade-in duration-150 ${
          position === 'centered' && !embeddedInAltSShell ? '-translate-x-1/2' : ''
        }`}
        style={embeddedInAltSShell ? { zIndex: dialogPopoverZIndex } : { top: `${topPos}px`, left: leftPos, zIndex: dialogPopoverZIndex }}
        onPointerDown={event => event.stopPropagation()}
        onMouseDown={event => event.stopPropagation()}
        onClick={event => event.stopPropagation()}>
      <div
        className={`flex ${embeddedInAltSShell ? 'h-full min-h-0 w-full max-w-full border-0 bg-transparent p-0 shadow-none' : 'w-[760px] max-w-[calc(100vw-32px)] rounded-2xl border p-4 shadow-2xl'} flex-col transition-colors ${
          embeddedInAltSShell
            ? 'overflow-y-auto overflow-x-hidden custom-scrollbar'
            : isAltSAppearance
              ? 'overflow-visible'
              : 'overflow-hidden'
        }`}
        style={{
          backgroundColor: embeddedInAltSShell ? 'transparent' : 'var(--color-modalBg, var(--alts-popup-bg, #191919))',
          borderColor: embeddedInAltSShell ? 'transparent' : 'var(--color-borderDefault, var(--alts-border-color, rgba(255, 255, 255, 0.14)))',
          color: 'var(--color-textPrimary, var(--alts-text-primary, #dedede))',
          boxShadow: embeddedInAltSShell ? 'none' : popoverShadow,
          height: embeddedInAltSShell ? '100%' : undefined,
          maxHeight: embeddedInAltSShell ? '100%' : `${popoverMaxHeight}px`,
        }}>
        {/* FIXED HEADER: Collection name, Command, Hotkey */}
        <div className="flex shrink-0 flex-col gap-3.5 pb-2">
          {/* Row 1: Collection name * + Icon Picker + Title Input + Action Buttons (Pin, 3-dots, Close X) */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="w-32 shrink-0 text-xs font-medium text-[var(--color-textSecondary)]">
                Collection name <span className="text-red-500 font-bold ml-0.5">*</span>
              </span>
              <div className="relative flex-1 min-w-0">
                <button
                  ref={iconTriggerRef}
                  type="button"
                  aria-label="Choose view icon"
                  aria-expanded={isIconPickerOpen}
                  aria-haspopup="dialog"
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsIconPickerOpen(prev => !prev);
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-textPrimary)] transition-colors hover:bg-[var(--color-hoverBg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] cursor-pointer">
                  <DashboardViewIcon iconId={dialog.viewIconId || DEFAULT_VIEW_ICON_ID} size={14} />
                </button>
                <input
                  ref={titleInputRef}
                  value={dialog.title}
                  onChange={event =>
                    setDialog((prev: any) => (prev ? { ...prev, title: event.target.value } : prev))
                  }
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      if (!dialog.shortcutError && !dialog.hotkeyError) onSubmit();
                    }
                  }}
                  type="text"
                  placeholder="Enter collection name..."
                  aria-label="Collection name"
                  className="w-full rounded-lg border border-[var(--color-borderDefault)] bg-transparent pl-9 pr-3 py-1.5 text-xs font-semibold text-[var(--color-textPrimary)] placeholder-[var(--color-textPlaceholder)] outline-none focus:ring-2 focus:ring-[var(--color-focusRing)]"
                />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 ml-2">
              <button
                ref={menuTriggerRef}
                type="button"
                aria-label="More options"
                onClick={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsMenuOpen(prev => !prev);
                }}
                className="p-1.5 rounded-lg text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] transition-colors cursor-pointer"
                title="More options">
                <FiMoreVertical size={16} />
              </button>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="p-1.5 rounded-lg text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)] transition-colors cursor-pointer">
                <LuX size={16} />
              </button>
            </div>
          </div>

          {/* Row 2: Command Label + Input (aligned to title input right edge) */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="w-32 shrink-0 text-xs font-medium text-[var(--color-textSecondary)]">
                Command
              </span>
              <div className="relative flex-1 min-w-0">
                <CUnderscoreIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-iconDefault)] pointer-events-none select-none" />
                <input
                  ref={shortcutInputRef}
                  value={dialog.shortcut || ''}
                  onChange={event => {
                    const val = event.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                    setDialog((prev: any) => (prev ? { ...prev, shortcut: val } : prev));
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      if (!dialog.shortcutError && !dialog.hotkeyError) onSubmit();
                    }
                  }}
                  type="text"
                  placeholder="c_alias"
                  aria-label="Command"
                  className="w-full rounded-lg border border-[var(--color-borderDefault)] bg-transparent py-1.5 pl-8 pr-3 text-xs font-semibold text-[var(--color-textPrimary)] placeholder-[var(--color-textPlaceholder)] outline-none focus:ring-2 focus:ring-[var(--color-focusRing)]"
                />
              </div>
            </div>
            {/* Empty right spacer matching Row 1 action buttons width */}
            <div className="w-[60px] shrink-0 ml-2 pointer-events-none" />
          </div>

          {/* Row 3: Hotkey Label + Input (aligned to title input right edge) */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="w-32 shrink-0 text-xs font-medium text-[var(--color-textSecondary)]">
                Hotkey
              </span>
              <div className="flex-1 min-w-0">
                <input
                  ref={hotkeyInputRef}
                  value={dialog.hotkey || ''}
                  readOnly
                  onKeyDown={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (event.key === 'Backspace' || event.key === 'Delete') {
                      setDialog((prev: any) =>
                        prev ? { ...prev, hotkey: '', hotkeyError: null } : prev,
                      );
                      return;
                    }
                    const captured = buildHotkeyString(
                      event.nativeEvent,
                      typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform),
                    );
                    if (!captured || captured === 'CANCEL') return;
                    setDialog((prev: any) =>
                      prev ? { ...prev, hotkey: normalizeHotkeyString(captured), hotkeyError: null } : prev,
                    );
                  }}
                  type="text"
                  placeholder="Click to bind hotkey..."
                  aria-label="Hotkey"
                  className="w-full rounded-lg border border-[var(--color-borderDefault)] bg-transparent px-3 py-1.5 text-xs font-semibold text-[var(--color-textPrimary)] placeholder-[var(--color-textPlaceholder)] outline-none shadow-sm focus:ring-2 focus:ring-[var(--color-focusRing)]"
                />
              </div>
            </div>
            {/* Empty right spacer matching Row 1 action buttons width */}
            <div className="w-[60px] shrink-0 ml-2 pointer-events-none" />
          </div>
        {isMenuOpen && (() => {
            const menuRect = menuTriggerRef.current?.getBoundingClientRect();
            const menuTop = (menuRect?.bottom || 100) + 6;
            const menuRight = typeof window !== 'undefined' ? window.innerWidth - (menuRect?.right || 200) : 20;

            const menuContent = (
              <div
                ref={menuRef}
                role="menu"
                className="fixed z-[10000001] w-[240px] rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-modalBg)] p-1.5 shadow-2xl"
                style={{
                  ...appearanceStyle,
                  top: `${menuTop}px`,
                  right: `${Math.max(12, menuRight)}px`,
                  zIndex: dialogSubPopupZIndex,
                  boxShadow: floatingPanelShadow,
                }}>
                <button
                  type="button"
                  role="menuitem"
                  disabled={dialog.isDefault}
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!dialog.isDefault) {
                      setDialog((prev: any) => (prev ? { ...prev, isDefault: true } : prev));
                    }
                    setIsMenuOpen(false);
                  }}
                  className={`flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    dialog.isDefault
                      ? 'opacity-60 cursor-not-allowed'
                      : 'hover:bg-[var(--color-hoverBg)] cursor-pointer'
                  }`}>
                  <LuPin
                    size={16}
                    className={`mt-0.5 shrink-0 ${
                      dialog.isDefault ? 'fill-current text-[var(--color-textPrimary)]' : 'text-[var(--color-textMuted)]'
                    }`}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-xs font-semibold text-[var(--color-textPrimary)]">
                      {dialog.isDefault ? 'Pinned as default view' : 'Pin as default view'}
                    </span>
                    <span className="truncate text-[11px] font-medium text-[var(--color-textMuted)]">
                      {dialog.isDefault
                        ? 'Currently pinned. Pin another view to change default.'
                        : 'Set this view as your default workspace view.'}
                    </span>
                  </span>
                </button>
                <div className="my-1 h-px bg-[var(--color-borderDefault)]" />
                <a
                  href="https://www.cmdos.app/docs/hotkeys"
                  target="_blank"
                  rel="noreferrer"
                  role="menuitem"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--color-hoverBg)] cursor-pointer">
                  <LuCircleHelp size={16} className="mt-0.5 shrink-0 text-[var(--color-textMuted)]" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-xs font-semibold text-[var(--color-textPrimary)]">Docs</span>
                    <span className="truncate text-[11px] font-medium text-[var(--color-textMuted)]">
                      Open documentation.
                    </span>
                  </span>
                </a>
                {dialog.mode === 'rename' && (
                  <>
                    <div className="my-1 h-px bg-[var(--color-borderDefault)]" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        setIsMenuOpen(false);
                        onClose();
                      }}
                      className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[var(--color-dangerBg)] cursor-pointer">
                      <LuTrash2 size={16} className="mt-0.5 shrink-0 text-[var(--color-danger)]" />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-xs font-semibold text-[var(--color-danger)]">Delete</span>
                        <span className="truncate text-[11px] font-medium text-[var(--color-textMuted)]">
                          Permanently remove this view.
                        </span>
                      </span>
                    </button>
                  </>
                )}
              </div>
            );

            return portalContainer ? ReactDOM.createPortal(menuContent, portalContainer) : ReactDOM.createPortal(menuContent, document.body);
          })()}
          {(dialog.shortcutError || dialog.hotkeyError) && (
            <div className="flex min-w-0 items-center gap-2">
              {dialog.shortcutError && (
                <span className="min-w-0 truncate text-[10.5px] font-medium text-[var(--color-danger)]">
                  {dialog.shortcutError}
                </span>
              )}
              {dialog.shortcutError && dialog.isShortcutOverrideable && onOverrideShortcut && (
                <button
                  type="button"
                  onMouseDown={event => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    onOverrideShortcut();
                  }}
                  className="shrink-0 rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-hoverBg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-textPrimary)] transition-colors cursor-pointer"
                  title="Reassign shortcut to this item">
                  Override
                </button>
              )}
              {dialog.hotkeyError && (
                <span className="min-w-0 truncate text-[10.5px] font-medium text-[var(--color-danger)]">
                  {dialog.hotkeyError}
                </span>
              )}
            </div>
          )}
        </div>

        {(actionError || showSessionSection || showWidgetsSection) && (
          <div className={`${embeddedInAltSShell ? 'flex-1 min-h-0' : 'min-h-[120px]'} overflow-y-auto overflow-x-hidden custom-scrollbar py-1 pr-0.5 flex flex-col gap-3`}>
            {actionError && <div className="pb-2 text-[11px] font-semibold text-[var(--color-danger)]">{actionError}</div>}

            {showSessionSection && (
                <div className="shrink-0 rounded-xl border border-[var(--color-borderDefault)] bg-transparent p-3 mb-3 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 pb-1 text-xs font-bold text-[var(--color-textPrimary)]">
                    <LuLayers size={14} className="text-[var(--color-textMuted)]" />
                    <span>Session (optional)</span>
                  </div>
                  <div
                    data-session-widget-root
                    className="w-full min-w-0 overflow-y-auto overflow-x-hidden pb-2 custom-scrollbar"
                    style={{ minHeight: '100px', maxHeight: 'clamp(140px, 28vh, 420px)' }}>
                    <React.Suspense
                      fallback={
                        <div className="flex h-full min-h-0 items-center justify-center rounded-lg border border-[var(--color-borderDefault)] bg-transparent text-[11px] font-semibold text-[var(--color-textMuted)]">
                          Preparing session editor...
                        </div>
                      }>
                      <SessionEditorView
                        key={dialog.mode === 'rename' ? `edit-session-${dialog.viewId}-${linkedSessionId || 'default'}` : 'create-session-draft'}
                        isOpen={true}
                        sessionId={dialog.mode === 'rename' ? linkedSessionId || null : null}
                        session={null}
                        isWidgetMode={true}
                        isFullScreenMode={false}
                        isEditMode={true}
                        widgetId={dialog.mode === 'rename' ? linkedWidgetId || `session-${dialog.viewId}` : 'create-session-draft'}
                        widgetTitle="Session"
                        viewPopoverMode={true}
                        draftMode={dialog.mode === 'create'}
                        draftSession={draftSession}
                        onDraftSessionChange={onDraftSessionChange}
                      />
                    </React.Suspense>
                  </div>
                </div>
            )}

            {showWidgetsSection && (
                <div className={`${embeddedInAltSShell ? 'flex-1 min-h-0' : ''} rounded-xl border border-[var(--color-borderDefault)] bg-transparent p-3 mb-3 flex flex-col gap-2`}>
                  <div className="flex items-center gap-1.5 pb-1 text-xs font-bold text-[var(--color-textPrimary)]">
                    <LuLayoutGrid size={14} className="text-[var(--color-textMuted)]" />
                    <span>Widgets (optional)</span>
                  </div>
                  {stagedWidgets.length > 0 ? (
                    <div className="overflow-y-auto overflow-x-hidden py-0.5 custom-scrollbar" style={{ maxHeight: 'clamp(80px, 15vh, 200px)' }}>
                      {stagedWidgets.map((item, index) => (
                        <div
                          key={`${item.id}-${index}`}
                          className="group/widget-row flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold text-[var(--color-textSecondary)] transition-colors hover:bg-[var(--color-hoverBg)]">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                            {getWidgetHeaderIcon(item.type)}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{getCatalogWidgetDisplayName(item)}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${getCatalogWidgetDisplayName(item)}`}
                            title="Remove widget"
                            disabled={pendingActionId !== null}
                            onClick={event => {
                              event.preventDefault();
                              event.stopPropagation();
                              onRemoveStagedWidget(index);
                            }}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--color-textMuted)] opacity-0 transition group-hover/widget-row:opacity-100 hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-danger)] disabled:cursor-not-allowed disabled:opacity-40">
                            <LuTrash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={`${embeddedInAltSShell ? 'flex-1 min-h-0' : ''} flex flex-col items-center justify-center py-4 px-3 text-center`}>
                      <p className="text-xs font-medium text-[var(--color-textSecondary)]">
                        No widgets added to this collection yet.
                      </p>
                      <p className="mt-1 text-[11px] text-[var(--color-textMuted)]">
                        Add notes, quick links, weather, or custom tools to display alongside your workspace.
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      setIsWidgetPickerOpen(true);
                    }}
                    disabled={pendingActionId !== null}
                    className="mx-auto inline-flex w-fit items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-[var(--color-success)] transition-colors hover:bg-[var(--color-hoverBg)] disabled:cursor-not-allowed disabled:opacity-50">
                    <LuPlus size={14} />
                    <span>Add widget</span>
                  </button>
                </div>
            )}
          </div>
        )}

        {/* FIXED FOOTER: Cancel & Save View */}
        <div className="flex shrink-0 justify-end gap-2 pt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={pendingActionId !== null}
            className="rounded-lg border border-[var(--color-borderDefault)] bg-transparent px-3.5 py-1.5 text-xs font-semibold text-[var(--color-textSecondary)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer">
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={pendingActionId !== null || !!dialog.shortcutError || !!dialog.hotkeyError}
            className="rounded-lg border border-transparent bg-[var(--color-borderActive)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-textPrimary)] shadow-sm transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer">
            Save View
          </button>
        </div>
      </div>
      </div>

      {isWidgetPickerOpen &&
        ReactDOM.createPortal(
          <div
            className="fixed inset-0 z-[10000000] flex items-center justify-center p-4"
            style={{ ...appearanceStyle, zIndex: dialogSubPopupZIndex }}>
            <button
              type="button"
              aria-label="Close add widget"
              className="absolute inset-0 h-full w-full bg-[var(--color-overlayBg)]"
              onClick={() => setIsWidgetPickerOpen(false)}
            />
            <section
              role="dialog"
              aria-modal="true"
              aria-label="Add widget"
              className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-modalBg)] text-[var(--color-textPrimary)] shadow-2xl">
              <header className="flex items-center justify-between border-b border-[var(--color-borderDefault)] px-4 py-3">
                <h2 className="text-sm font-semibold">Add widget</h2>
                <button
                  type="button"
                  onClick={() => setIsWidgetPickerOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-textSecondary)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]"
                  title="Close add widget">
                  <LuX size={16} />
                </button>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 custom-scrollbar">
                <WidgetCatalogGrid
                  variant="sidebar"
                  pendingWidgetIds={pendingWidgetIds}
                  getWidgetCount={item => {
                    const itemType = normalizeWidgetType(item.type);
                    if (itemType === 'session-item') return 1;
                    return stagedWidgets.filter(stagedItem => normalizeWidgetType(stagedItem.type) === itemType).length;
                  }}
                  isWidgetDisabled={(item, count) =>
                    requiresExternalPicker(item) ||
                    (isSingleInstanceWidgetType(normalizeWidgetType(item.type)) && count >= 1)
                  }
                  onSelectWidget={item => {
                    onStageWidget(item);
                    setIsWidgetPickerOpen(false);
                  }}
                />
              </div>
            </section>
          </div>,
          portalContainer || document.body,
        )}

      {isIconPickerOpen && (() => {
        const triggerRect = iconTriggerRef.current?.getBoundingClientRect();
        const pickerTop = triggerRect ? triggerRect.bottom + 6 : topPos + 90;
        const pickerLeft = triggerRect ? triggerRect.left : position === 'centered' ? window.innerWidth / 2 - 290 : 300;
        return ReactDOM.createPortal(
          <div
            ref={iconPickerRef}
            aria-label="View icon selector"
            role="dialog"
            className="fixed z-[9999999] p-3 rounded-xl border shadow-2xl grid grid-cols-5 gap-2 animate-in fade-in duration-150"
            style={{
              ...appearanceStyle,
              top: `${pickerTop}px`,
              left: `${pickerLeft}px`,
              zIndex: dialogSubPopupZIndex,
              backgroundColor: 'var(--color-modalBg, var(--alts-popup-bg))',
              borderColor: 'var(--color-borderDefault, var(--alts-border-color))',
              color: 'var(--color-textPrimary, var(--alts-text-primary))',
              boxShadow: floatingPanelShadow,
            }}>
            {DASHBOARD_VIEW_ICONS.map(iconDef => {
              const isSelected = dialog.viewIconId === iconDef.id;
              const IconComp = iconDef.icon;
              return (
                <button
                  key={iconDef.id}
                  type="button"
                  title={iconDef.label}
                  aria-label={iconDef.label}
                  aria-selected={isSelected}
                  onClick={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    setDialog((prev: any) =>
                      prev ? { ...prev, viewIconId: iconDef.id } : prev,
                    );
                    setIsIconPickerOpen(false);
                  }}
                  style={{
                    backgroundColor: isSelected
                      ? 'var(--color-selectedBg, var(--alts-icon-tile-save-bg))'
                      : 'var(--color-inputBg, transparent)',
                    borderColor: isSelected
                      ? 'var(--color-borderActive, var(--alts-border-color))'
                      : 'transparent',
                    color: isSelected
                      ? 'var(--color-textPrimary, var(--alts-text-primary))'
                      : 'var(--color-textSecondary, var(--alts-text-secondary))',
                  }}
                  className={`p-2.5 rounded-lg flex items-center justify-center transition-all cursor-pointer border hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]`}>
                  <IconComp size={16} />
                </button>
              );
            })}
          </div>,
          portalContainer || document.body,
        );
      })()}
    </div>
  );

  if (embeddedInAltSShell) return content;

  return ReactDOM.createPortal(content, portalContainer || document.body);
};

export default CreateCollectionDialog;
