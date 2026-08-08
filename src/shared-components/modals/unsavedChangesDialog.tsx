import type * as React from 'react';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaExclamationTriangle } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { FiLoader } from 'react-icons/fi';
import { useUIStore } from '../uiStateManager';

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => Promise<boolean> | boolean;
  onDiscard: () => void;
  zIndex?: number;
}

const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  onDiscard,
  zIndex = 50,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (isSaving) return;

        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          handleClose();
        } else if (onSave && (e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          handleSave();
        }
      };

      window.addEventListener('keydown', handleKeyDown, { capture: true });
      
      const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
        if (!isSaving) {
          handleClose();
        }
        return true;
      });

      return () => {
        window.removeEventListener('keydown', handleKeyDown, { capture: true });
        unregister();
      };
    } else {
      // Parent forced close (e.g. immediate save), ensure we close.
      setIsAnimating(false);
      setIsSaving(false);
      return undefined;
    }
  }, [isOpen, isSaving, onDiscard, onSave]);

  // Do not conditionally call hooks. Use early return only after hooks.
  if (!isOpen && !isAnimating) return null;

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      const saved = await onSave();
      if (!saved) return;
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isSaving) return; // Prevent closing while save is in progress

    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300); // Match with animation duration
  };

  // Handle outside clicks
  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (isSaving) return; // Prevent closing while save is in progress

    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      handleClose();
    }
  };

  return createPortal(
    <AnimatePresence>
      {(isOpen || isAnimating) && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/20"
          style={{ zIndex }}
          onClick={handleOutsideClick}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black bg-opacity-40 dark:bg-opacity-60"
            style={{ zIndex }}
          />
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative bg-[var(--color-containerBg)] rounded-lg shadow-xl w-full max-w-md p-3 border border-[var(--color-borderDefault)]"
            style={{ zIndex: zIndex + 1 }}
            onClick={e => e.stopPropagation()}>
            {/* Close button at top right */}
            <button
              onClick={handleClose}
              disabled={isSaving}
              className={`absolute top-4 right-4 text-red-500 hover:text-red-700 transition-colors ${isSaving ? 'cursor-not-allowed opacity-50' : ''}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center mb-4">
              <div className="mr-4 bg-amber-100 dark:bg-amber-900/30 p-3 rounded-full">
                <FaExclamationTriangle className="text-amber-500 dark:text-amber-400" size={20} />
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-textPrimary)]">Unsaved Changes</h3>
            </div>
            <p className="mb-6 text-[var(--color-textSecondary)]">
              You have unsaved changes waiting to be auto-saved. If you close now, the latest edits may be lost.
            </p>

            {/* Buttons at bottom right */}
            <div className="flex justify-end space-x-3">
              <motion.button
                whileHover={{ scale: isSaving ? 1 : 1.03 }}
                whileTap={{ scale: isSaving ? 1 : 0.97 }}
                onClick={e => {
                  e.stopPropagation();
                  onDiscard();
                }}
                disabled={isSaving}
                className={`flex items-center gap-2 rounded-xl border border-transparent bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 transition-colors group ${
                  isSaving ? 'cursor-not-allowed opacity-50' : ''
                }`}>
                Don't Save
                <span className="ml-1 rounded border border-white/80 dark:border-white/20 bg-[var(--color-containerBg)] px-0.5 text-[8px] font-semibold text-neutral-500 dark:text-neutral-300">
                  Esc
                </span>
              </motion.button>
              {onSave && (
                <motion.button
                  whileHover={{ scale: isSaving ? 1 : 1.03 }}
                  whileTap={{ scale: isSaving ? 1 : 0.97 }}
                  onClick={e => {
                    e.stopPropagation();
                    handleSave();
                  }}
                  disabled={isSaving}
                  className={`flex items-center gap-2 rounded-md border px-2 py-0.5 text-[10px] font-semibold shadow-sm transition-colors ${
                    isSaving
                      ? 'cursor-not-allowed border-[var(--color-borderDefault)] bg-[var(--color-containerBg)] text-neutral-400 dark:text-neutral-500'
                      : 'border-[#c7bcff] dark:border-[#9fa2ff] bg-[#f5f3ff] dark:bg-neutral-800 text-neutral-700 dark:text-neutral-100 hover:border-[#b9adff] dark:hover:border-[#8f93ff]'
                  }`}>
                  {isSaving ? (
                    <div className="flex items-center">
                      <FiLoader className="animate-spin mr-2" size={16} />
                      Saving...
                    </div>
                  ) : (
                    <>
                      Save
                      <span className="flex items-center gap-0.5 text-[8px] font-semibold text-neutral-500 dark:text-neutral-300">
                        <span className="rounded border border-white/80 dark:border-white/20 bg-[var(--color-containerBg)] px-0.5">
                          Ctrl
                        </span>
                        <span className="text-neutral-500 dark:text-neutral-300">+</span>
                        <span className="rounded border border-white/80 dark:border-white/20 bg-[var(--color-containerBg)] px-0.5">
                          Enter
                        </span>
                      </span>
                    </>
                  )}
                </motion.button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default UnsavedChangesDialog;
