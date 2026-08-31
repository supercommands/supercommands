import React, { useState, useEffect, useRef } from 'react';
import { LuPencil } from 'react-icons/lu';
import { updateWidgetTitleAsync } from '../../../../../../storage/localStorage/widgetDashboardStorage';
import { shouldShowTypeLabel } from '../utils/widgetTypeLabel';

interface EditableWidgetTitleProps {
  viewId: string;
  widgetId: string;
  initialTitle: string;
  isEditMode?: boolean;
  className?: string;
  icon?: React.ReactNode;
  typeLabel?: string | null;
  typeLabelClassName?: string;
}

export const EditableWidgetTitle: React.FC<EditableWidgetTitleProps> = ({
  viewId,
  widgetId,
  initialTitle,
  isEditMode = false,
  className = 'text-xs font-bold truncate text-[var(--color-textMuted)]',
  icon,
  typeLabel,
  typeLabelClassName,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  const showLabel = shouldShowTypeLabel(title, typeLabel);

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    const trimmed = title.trim();
    setIsEditing(false);
    if (trimmed && trimmed !== initialTitle) {
      await updateWidgetTitleAsync(viewId, widgetId, trimmed);
    } else {
      setTitle(initialTitle);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setTitle(initialTitle);
      setIsEditing(false);
    }
  };

  return (
    <div
      className={`group/title flex items-center gap-2 min-w-0 ${
        isEditMode ? 'cursor-pointer hover:opacity-80' : ''
      }`}
      onClick={e => {
        if (isEditMode) {
          e.stopPropagation();
          setIsEditing(true);
        }
      }}
      data-no-widget-drag={isEditMode ? 'true' : undefined}
      title={isEditMode ? 'Click to rename widget' : undefined}>
      {icon}

      {isEditMode && isEditing ? (
        <div className="flex items-center gap-1.5 min-w-0 flex-1" data-no-widget-drag="true">
          <input
            ref={inputRef}
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            onClick={e => e.stopPropagation()}
            className="px-1.5 py-0.5 text-xs font-bold rounded border bg-[var(--color-inputBg)] text-[var(--color-textPrimary)] border-[var(--color-borderActive)] focus:outline-none w-full min-w-[80px]"
          />
        </div>
      ) : (
        <h4 className={className}>{title}</h4>
      )}

      {showLabel && (
        <span
          className={
            typeLabelClassName ||
            'shrink-0 text-[9.5px] font-medium leading-none text-[var(--color-textSecondary)] opacity-60 select-none'
          }
        >
          {typeLabel}
        </span>
      )}

      {isEditMode && (
        <LuPencil
          size={11}
          className="shrink-0 text-[var(--color-textMuted)] group-hover/title:text-[var(--color-textPrimary)] transition-colors opacity-75"
        />
      )}
    </div>
  );
};

export default EditableWidgetTitle;
