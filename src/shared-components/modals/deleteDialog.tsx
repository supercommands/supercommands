import type * as React from 'react';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaTrash, FaExclamationTriangle } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { FiLoader } from 'react-icons/fi';

interface DeleteConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: string;
  zIndex?: number;
}

const DeleteConfirmation: React.FC<DeleteConfirmationProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  zIndex = 50,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
    } else {
      // Parent forced close (e.g. immediate delete), ensure we close.
      setIsAnimating(false);
      setIsDeleting(false);
    }
  }, [isOpen]);

  // Do not conditionally call hooks. Use early return only after hooks.
  if (!isOpen && !isAnimating) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } catch (error) {
      // Error is already handled by the onConfirm callback (e.g., toast/status message)
      console.error('[DeleteDialog] Delete operation failed:', error);
    } finally {
      // Always reset state and close dialog, even on error
      setIsDeleting(false);
      onClose();
    }
  };

  const handleClose = () => {
    if (isDeleting) return; // Prevent closing while deletion is in progress

    setIsAnimating(false);
    setTimeout(() => {
      onClose();
    }, 300); // Match with animation duration
  };

  // Handle outside clicks
  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (isDeleting) return; // Prevent closing while deletion is in progress

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
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            style={{ zIndex }}
          />
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative bg-[var(--color-popupBg,#171821)] supports-[backdrop-filter]:bg-[var(--color-popupBg,#171821)]/98 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md p-6 border border-[var(--color-borderDefault)]"
            style={{ zIndex: zIndex + 1 }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center mb-4">
              <div className="mr-4 bg-red-500/10 p-3 rounded-full shrink-0 flex items-center justify-center">
                <FaExclamationTriangle className="text-red-500" size={20} />
              </div>
              <h3 className="text-lg font-semibold text-[var(--color-textPrimary)]">{title}</h3>
            </div>
            <p className="mb-6 text-sm text-[var(--color-textSecondary)] leading-relaxed">{description}</p>
            <div className="flex justify-end space-x-3">
              <motion.button
                whileHover={{ scale: isDeleting ? 1 : 1.02 }}
                whileTap={{ scale: isDeleting ? 1 : 0.98 }}
                onClick={handleClose}
                disabled={isDeleting}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
                  isDeleting
                    ? 'bg-[var(--color-inputBg)] text-[var(--color-textDisabled)] border-[var(--color-borderDefault)] cursor-not-allowed'
                    : 'bg-[var(--color-inputBg)] hover:bg-[var(--color-hoverBg)] active:bg-[var(--color-selectedBg)] border-[var(--color-borderDefault)] text-[var(--color-textPrimary)] cursor-pointer'
                }`}>
                Cancel
              </motion.button>
              <motion.button
                whileHover={{ scale: isDeleting ? 1 : 1.02 }}
                whileTap={{ scale: isDeleting ? 1 : 0.98 }}
                onClick={e => {
                  e.stopPropagation();
                  handleConfirm();
                }}
                disabled={isDeleting}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center min-w-[85px] transition-all bg-red-500 hover:bg-red-600 active:bg-red-700 text-white shadow-sm border-none cursor-pointer ${
                  isDeleting ? 'opacity-80 cursor-wait' : ''
                }`}>
                {isDeleting ? (
                  <div className="flex items-center">
                    <FiLoader className="animate-spin mr-2" size={16} />
                    Deleting...
                  </div>
                ) : (
                  <>
                    <FaTrash className="mr-2" size={12} />
                    Delete
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default DeleteConfirmation;
