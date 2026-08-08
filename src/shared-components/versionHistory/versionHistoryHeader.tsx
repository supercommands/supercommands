import React from 'react';
import { FiX } from 'react-icons/fi';

export interface VersionHistoryHeaderProps {
  entityType?: 'note' | 'todo' | 'snippet' | 'link' | 'session' | string;
  entityTitle?: string;
  title?: string;
  subtitle?: string;
  onClose?: () => void;
}

export const VersionHistoryHeader: React.FC<VersionHistoryHeaderProps> = ({ onClose }) => {
  return (
    <header className="px-4 py-2 border-b border-[var(--color-borderDefault,rgba(255,255,255,0.1))] bg-[var(--color-panelBg,#080808)] flex items-center justify-end shrink-0 select-none h-11">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-[var(--color-textMuted,#737373)] hover:text-[var(--color-textPrimary,#FFFFFF)] hover:bg-[var(--color-hoverBg,rgba(255,255,255,0.08))] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-borderActive)]"
          aria-label="Close Version History">
          <FiX size={18} />
        </button>
      )}
    </header>
  );
};
