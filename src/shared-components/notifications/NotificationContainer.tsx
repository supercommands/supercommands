import type * as React from 'react';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '../uiStateManager';

const AUTO_DISMISS_MS = 3000;
const WEBSITE_NOTIFICATION_STYLE: React.CSSProperties = {
  position: 'fixed',
  top: '20px',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 999999,
  pointerEvents: 'none',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};
const WEBSITE_NOTIFICATION_PILL_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '10px 16px',
  borderRadius: '999px',
  background: 'rgba(10, 15, 26, 0.84)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.28)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  maxWidth: 'min(80vw, 520px)',
};

type NotificationContainerVariant = 'default' | 'top-text-only';

interface NotificationContainerProps {
  variant?: NotificationContainerVariant;
}

const NotificationContainer: React.FC<NotificationContainerProps> = ({ variant = 'default' }) => {
  const pendingNotification = useUIStore(state => state.pendingNotification);
  const clearNotification = useUIStore(state => state.clearNotification);

  const isVisible = !!pendingNotification;
  const message = pendingNotification?.message;
  const type = pendingNotification?.type;
  const isTopTextOnly = variant === 'top-text-only';

  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        clearNotification();
      }, AUTO_DISMISS_MS);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isVisible, clearNotification]);

  if (!message || !type) return null;

  const accentColor =
    type === 'success'
      ? '#10b981'
      : type === 'error'
        ? '#ef4444'
        : type === 'warning'
          ? '#f59e0b'
          : '#3b82f6';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="toast"
          className={isTopTextOnly ? undefined : 'fixed bottom-0 left-0 right-0 z-[999999] flex flex-col items-center pointer-events-none'}
          style={isTopTextOnly ? WEBSITE_NOTIFICATION_STYLE : undefined}
          initial={{ opacity: 0, y: isTopTextOnly ? -8 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: isTopTextOnly ? -8 : 8 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {isTopTextOnly ? (
            <div style={WEBSITE_NOTIFICATION_PILL_STYLE}>
              <span
                className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: accentColor }}
              />
              <span
                className="text-center text-[13px] font-medium leading-5 select-none"
                style={{ color: 'rgba(255, 255, 255, 0.95)' }}
              >
                {typeof message === 'string' ? message : JSON.stringify(message)}
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-4 py-2.5 w-full justify-center bg-black/85 dark:bg-black/90 backdrop-blur-sm">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: accentColor }}
                />
                <span className="text-white/90 text-[12px] font-normal tracking-wide select-none">
                  {typeof message === 'string' ? message : JSON.stringify(message)}
                </span>
              </div>

              <motion.div
                className="h-[2px] w-full"
                style={{ background: accentColor, transformOrigin: 'left center' }}
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: AUTO_DISMISS_MS / 1000, ease: 'linear' }}
              />
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NotificationContainer;
