import * as React from 'react';
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { LuDownload, LuPlus } from 'react-icons/lu';

interface AutomationSaveNotificationProps {
  onSave: () => void;
  onClose: () => void;
  agentName?: string;
  durationMs?: number;
  isDarkMode?: boolean;
  isMac?: boolean;
}

export const AutomationSaveNotification: React.FC<AutomationSaveNotificationProps> = ({
  onSave,
  onClose,
  agentName = 'AI Research Agent',
  durationMs = 8000,
  isDarkMode = true,
  isMac = false,
}) => {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onCloseRef.current();
    }, durationMs);

    return () => clearTimeout(timer);
  }, [durationMs]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 5, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className={`absolute bottom-[calc(100%+8px)] right-0 z-[999999] w-[260px] ${isDarkMode ? 'bg-[#0A0A0A] border-white/10' : 'bg-white border-[#e5e7eb]'} border rounded-2xl shadow-2xl overflow-hidden p-4 flex flex-col font-sans`}
      style={{
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
      }}
    >
      <div className="flex gap-4 items-start mb-4">
        <div className="flex flex-col gap-1.5 pt-1">
          <h3 className="text-lg font-semibold leading-tight tracking-wide text-[var(--color-textPrimary)]">
            Save this agent?
          </h3>
          <p className="text-sm leading-snug text-[var(--color-textSecondary)]">
            Save "{agentName}" to All saved files & shortcuts for quick reuse.
          </p>
        </div>
      </div>

      {/* Progress Bar Track */}
      <div className={`w-full h-1 ${isDarkMode ? 'bg-[#1A1A1A]' : 'bg-neutral-200'} rounded-full mb-4 overflow-hidden`}>
        {/* Progress Bar Fill */}
        <motion.div
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: durationMs / 1000, ease: 'linear' }}
          className="h-full bg-[#22c55e] rounded-full"
        />
      </div>

      <div className="flex justify-center mt-2">
        <button
          onClick={() => {
            onSave();
            onClose();
          }}
          className={`inline-flex items-center justify-center gap-2 rounded-md border px-2.5 py-1.5 text-[10px] font-bold transition-all shadow-lg group active:scale-95 ${
            isDarkMode
              ? 'border-white/20 bg-neutral-800 text-white/90 hover:bg-neutral-700 hover:text-white'
              : 'border-[#d8d2bf] bg-[#eee8d5] text-[#073642] hover:bg-[#e7e0cc]'
          }`}
        >
          <span>Save Agent</span>
          <span
            className={`text-[8px] font-mono leading-none flex items-center gap-1 border rounded px-1 py-0.5 transition-opacity ${isDarkMode
                ? 'opacity-30 group-hover:opacity-60 border-white/20 bg-neutral-700'
                : 'opacity-60 group-hover:opacity-90 border-[#d8d2bf] bg-[#fdf6e3] text-[#586e75]'
              }`}>
            {isMac ? '⌘' : 'Ctrl'} + Enter
          </span>
        </button>
      </div>
    </motion.div>
  );
};
