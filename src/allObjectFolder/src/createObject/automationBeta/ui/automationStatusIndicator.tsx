import * as React from 'react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlay, FaCheck, FaExclamationTriangle, FaTimes, FaStop } from 'react-icons/fa';

interface AutomationStatus {
  status: 'idle' | 'running' | 'completed' | 'error' | 'stopped';
  name: string;
  currentStep?: number;
  totalSteps?: number;
  stepName?: string;
  error?: string;
}

const AutomationStatusIndicator: React.FC = () => {
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Initial load
    chrome.storage.local.get(['active_automation_status'], result => {
      if (result.active_automation_status) {
        setStatus(result.active_automation_status);
        if (result.active_automation_status.status !== 'idle') {
          setIsVisible(true);
        }
      }
    });

    // Listen for updates
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.active_automation_status) {
        const newVal = changes.active_automation_status.newValue as AutomationStatus;
        setStatus(newVal);
        if (newVal && newVal.status !== 'idle') {
          setIsVisible(true);
        } else {
          setIsVisible(false);
        }
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const handleStop = () => {
    chrome.runtime.sendMessage({ action: 'stop_automation' });
  };

  const handleDismiss = () => {
    chrome.storage.local.set({ active_automation_status: { status: 'idle' } });
    setIsVisible(false);
  };

  // Auto-dismiss on success after 5 seconds, on stop after 3 seconds
  useEffect(() => {
    if (status?.status === 'completed' || status?.status === 'stopped') {
      const timer = setTimeout(
        () => {
          handleDismiss();
        },
        status.status === 'stopped' ? 3000 : 5000,
      );
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status?.status]);

  if (!status || !isVisible) return null;

  const isRunning = status.status === 'running';
  const isError = status.status === 'error';
  const isCompleted = status.status === 'completed';
  const isStopped = status.status === 'stopped';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, x: '-50%', opacity: 0 }}
        animate={{ y: 0, x: '-50%', opacity: 1 }}
        exit={{ y: -100, x: '-50%', opacity: 0 }}
        className="fixed top-6 left-1/2 z-[10000] min-w-[320px] max-w-md">
        <div className="bg-neutral-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-4 flex items-center gap-4">
          <div className="flex-shrink-0">
            {isRunning && (
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-25" />
                <div className="relative bg-blue-500 p-2 rounded-full">
                  <FaPlay size={12} className="text-white animate-pulse" />
                </div>
              </div>
            )}
            {isCompleted && (
              <div className="bg-green-500 p-2 rounded-full shadow-lg shadow-green-500/20">
                <FaCheck size={12} className="text-white" />
              </div>
            )}
            {(isError || isStopped) && (
              <div className="bg-red-500 p-2 rounded-full shadow-lg shadow-red-500/20">
                {isError ? (
                  <FaExclamationTriangle size={12} className="text-white" />
                ) : (
                  <FaStop size={12} className="text-white" />
                )}
              </div>
            )}
          </div>

          <div className="flex-grow min-w-0">
            <h4 className="text-[10px] font-bold text-white/40 uppercase tracking-widest truncate mb-0.5">
              {status.name || 'Automation'}
            </h4>
            <p
              className={`text-xs font-semibold text-white flex items-center gap-1.5 ${isError ? 'flex-wrap' : 'truncate'}`}>
              {isRunning && status.totalSteps ? (
                <>
                  <span className="text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded text-xs">
                    Step {status.currentStep}/{status.totalSteps}
                  </span>
                  <span className="opacity-90">{status.stepName}</span>
                </>
              ) : (
                <span>{status.stepName || status.status}</span>
              )}
            </p>
            {isError && status.error && (
              <p className="text-[10px] text-red-400 mt-1 line-clamp-2 bg-red-400/10 p-1 rounded">{status.error}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isRunning && (
              <button
                onClick={handleStop}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[11px] font-bold transition-colors border border-red-500/20">
                <FaStop size={10} />
                Stop
              </button>
            )}
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors">
              <FaTimes size={14} />
            </button>
          </div>
        </div>

        {/* Progress Bar (Visible only when running) */}
        {isRunning && status.totalSteps && (
          <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-500"
              initial={{ width: 0 }}
              animate={{ width: `${(status.currentStep! / status.totalSteps!) * 100}%` }}
              transition={{ type: 'spring', damping: 20 }}
            />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default AutomationStatusIndicator;
