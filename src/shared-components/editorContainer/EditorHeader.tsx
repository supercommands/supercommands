import React from 'react';
import { FaTimes } from 'react-icons/fa';
import { AutoSaveIndicator } from '../autoSaveEngine/autoSave';

export interface EditorHeaderProps {
  title: string;
  isDirty?: boolean;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error' | 'conflict' | 'success';
  lastSavedAt?: Date | null;
  activeId?: string | null;
  onCloseClick: () => void;
  isDuplicateTitle?: boolean;
  headerActions?: React.ReactNode;
  showAutoSaveStatus?: boolean;
  headerRightPaddingClass?: string;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  title,
  isDirty = false,
  saveStatus = 'idle',
  lastSavedAt,
  activeId,
  onCloseClick,
  isDuplicateTitle = false,
  headerActions,
  showAutoSaveStatus = true,
  headerRightPaddingClass = '',
}) => {
  return (
    <div className="w-full flex items-center py-1.5 px-3 border-b border-black/10 dark:border-white/10 shrink-0 relative z-30">
      <div className="flex items-center flex-1 min-w-0 relative">
        <h3 className="text-lg font-bold text-neutral-700 dark:text-neutral-300 pl-2 truncate">
          {title}
        </h3>
      </div>
      <div className="flex items-center gap-3 ml-auto relative">
        <div className={`flex items-center gap-3 ${headerRightPaddingClass}`}>
          <div className="transition-opacity duration-300 flex items-center gap-2">
            {isDuplicateTitle && (
              <span className="text-xs text-red-500 font-medium whitespace-nowrap">
                Duplicate title exists
              </span>
            )}
            {showAutoSaveStatus && (
              <AutoSaveIndicator
                saveStatus={saveStatus}
                lastSavedAt={lastSavedAt}
                isDirty={isDirty}
                activeId={activeId}
              />
            )}
          </div>
          {headerActions}
        </div>
        <button
          onClick={onCloseClick}
          className="p-2 text-neutral-500 hover:text-neutral-300 rounded-lg hover:bg-white/5 transition-all focus:outline-none cursor-pointer z-50"
          title="Close"
        >
          <FaTimes size={14} />
        </button>
      </div>
    </div>
  );
};
