import type * as React from 'react';
import { memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiSettings } from 'react-icons/fi';
import { LuPencil, LuX } from 'react-icons/lu';
import { useUIStore } from '../../shared-components/uiStateManager';
import { getDefaultSettingsView } from './settingsLayout';

interface HeaderControlsProps {
  showFavorites?: boolean;
  onToggleFavorites?: () => void;
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
  isLoggedIn: boolean;
  direction?: 'up' | 'down';
  onOpenSubscriptions?: () => void;
  onOpenManageSubscription?: () => void;
  onCommandListCategoryChange?: (category: string) => void;
  commandListCategory?: string;
  onOpenOrganizationSettings?: (orgId: string, orgName: string) => void;
  onOpenGeneralSettings?: () => void;
  isWidgetEditMode?: boolean;
  onToggleWidgetEditMode?: () => void;
}

const editModeControlMotion = {
  initial: { opacity: 0, y: -20, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -20, scale: 0.95 },
};

const HeaderControls: React.FC<HeaderControlsProps> = ({
  isLoggedIn,
  isWidgetEditMode = false,
  onToggleWidgetEditMode,
}) => {
  const activeView = useUIStore(state => state.activeView);
  const isSettingsActive = activeView?.type === 'settings';

  return (
    <>
      <AnimatePresence>
        {isWidgetEditMode && (
          <motion.div
            key="widget-edit-mode-floating-control"
            className="fixed top-4 z-[999999] pointer-events-auto"
            style={{ left: '50%' }}
            initial={{ ...editModeControlMotion.initial, x: '-50%' }}
            animate={{ ...editModeControlMotion.animate, x: '-50%' }}
            exit={{ ...editModeControlMotion.exit, x: '-50%' }}>
            <motion.button
              type="button"
              aria-label="Exit edit mode"
              title="Exit edit mode"
              onClick={onToggleWidgetEditMode}
              className="rounded-full border-0 bg-transparent p-0 cursor-pointer select-none"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}>
              <span className="widget-edit-mode-wiggle flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[var(--color-cardBg)] text-[var(--color-textPrimary)] border border-[var(--color-borderActive)] shadow-2xl backdrop-blur-md hover:bg-[var(--color-bgHover)] transition-colors">
                <LuPencil size={13} className="shrink-0 text-[var(--color-accent)]" />
                <span>Edit Mode</span>
                <span className="w-px h-3 bg-[var(--color-borderDefault)] mx-0.5" />
                <LuX
                  size={14}
                  className="shrink-0 text-red-500 hover:text-red-400 transition-colors"
                />
              </span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        role="toolbar"
        aria-label="Dashboard controls"
        className="fixed right-5 top-1/2 -translate-y-1/2 z-[9000] flex flex-col items-center rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] shadow-xl backdrop-blur-md overflow-hidden pointer-events-auto select-none">
        <motion.button
          key={isWidgetEditMode ? 'widget-edit-control-active' : 'widget-edit-control-idle'}
          type="button"
          aria-label={isWidgetEditMode ? 'Exit edit mode' : 'Edit dashboard'}
          aria-pressed={isWidgetEditMode}
          title={isWidgetEditMode ? 'Exit edit mode' : 'Edit dashboard'}
          onClick={onToggleWidgetEditMode}
          initial={isWidgetEditMode ? editModeControlMotion.initial : false}
          animate={isWidgetEditMode ? editModeControlMotion.animate : { opacity: 1, y: 0, scale: 1 }}
          className={`w-9 h-9 flex items-center justify-center transition-colors cursor-pointer border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] ${
            isWidgetEditMode
              ? 'bg-[var(--color-selectedBg)] text-[var(--color-accent)] font-semibold'
              : 'bg-transparent text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)]'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}>
          <span className={isWidgetEditMode ? 'widget-edit-mode-wiggle flex items-center justify-center' : undefined}>
            <LuPencil size={16} />
          </span>
        </motion.button>

        <div className="h-px w-5 bg-[var(--color-borderDefault)]" aria-hidden="true" />

        <motion.button
          type="button"
          aria-label={isSettingsActive ? 'Close settings' : 'Open settings'}
          aria-pressed={isSettingsActive}
          title={isSettingsActive ? 'Close settings' : 'Settings'}
          onClick={() => {
            if (isSettingsActive) {
              useUIStore.getState().setView({ type: 'home' });
            } else {
              useUIStore.getState().setView(getDefaultSettingsView(isLoggedIn));
            }
          }}
          className={`w-9 h-9 flex items-center justify-center transition-colors cursor-pointer border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] ${
            isSettingsActive
              ? 'bg-[var(--color-selectedBg)] text-[var(--color-accent)] font-semibold'
              : 'bg-transparent text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)]'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}>
          <FiSettings size={18} />
        </motion.button>
      </div>
    </>
  );
};

export default memo(HeaderControls);
