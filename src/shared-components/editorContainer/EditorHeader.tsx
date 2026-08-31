import * as React from 'react';
import { FaTimes } from 'react-icons/fa';
import { AutoSaveIndicator } from '../autoSaveEngine/autoSave';

import { EditableWidgetTitle } from '../../pages/AltS_search_newtab/src/components/widgets/components/EditableWidgetTitle';
import { getWidgetHeaderIcon } from '../../pages/AltS_search_newtab/src/components/widgets/utils/widgetHeaderIcons';


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
  showCloseButton?: boolean;
  isWidgetMode?: boolean;
  viewId?: string;
  widgetId?: string;
  isEditMode?: boolean;
  typeLabel?: string | null;
  titleRightActions?: React.ReactNode;
  titleClassName?: string;
  hideBorder?: boolean;
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
  showCloseButton = true,
  isWidgetMode = false,
  viewId,
  widgetId,
  isEditMode = false,
  typeLabel,
  titleRightActions,
  titleClassName,
  hideBorder = false,
}) => {
  return (
    <div className={`w-full flex items-center ${isWidgetMode ? 'px-4 pt-3 pb-1.5' : 'py-1 px-3'} ${hideBorder ? '' : 'border-b border-[var(--color-borderDefault)]'} shrink-0 relative z-30`}>
      <div className="flex items-center flex-1 min-w-0 relative gap-3">
        <div className="flex items-center min-w-0">
          {isWidgetMode && viewId && widgetId ? (
            <div className="flex items-center min-w-0">
              <EditableWidgetTitle
                viewId={viewId}
                widgetId={widgetId}
                initialTitle={title || 'Session'}
                isEditMode={isEditMode}
                icon={getWidgetHeaderIcon(typeLabel ? `${typeLabel.toLowerCase()}-item` : 'session-item')}
                typeLabel={typeLabel || 'Session'}
                className="text-xs font-bold truncate text-[var(--color-textMuted)]"
              />
            </div>
          ) : title ? (
            <h3 className={titleClassName || 'text-lg font-bold text-[var(--color-textPrimary)] pl-2 truncate'}>
              {title}
            </h3>
          ) : null}
        </div>
        {titleRightActions && (
          <div className="flex-shrink-0 flex items-center">
            {titleRightActions}
          </div>
        )}
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
        {showCloseButton !== false && (
          <button
            onClick={onCloseClick}
            className={`-mt-1 p-2 text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] rounded-lg transition-all focus:outline-none cursor-pointer z-50 ${
              showCloseButton ? '' : 'md:hidden'
            }`}
            title="Close"
          >
            <FaTimes size={17} />
          </button>
        )}
      </div>
    </div>
  );
};
