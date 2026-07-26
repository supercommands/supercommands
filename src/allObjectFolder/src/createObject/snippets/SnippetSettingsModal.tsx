import React from 'react';
import { useRef, useState, useEffect } from 'react';
import { useUIStore } from '../../../../shared-components/uiStateManager';
import { createPortal } from 'react-dom';
import {
  FaEdit,
  FaTrashAlt,
  FaPalette,
  FaStar,
  FaRegStar,
  FaKeyboard,
  FaCheck,
  FaTimes,
  FaExclamationTriangle,
  FaExternalLinkAlt,
} from 'react-icons/fa';
import { FiCommand, FiZapOff, FiLoader, FiExternalLink } from 'react-icons/fi';
import { MdOutlineShortcut } from 'react-icons/md';
import { BsKeyboard, BsCalendarCheck } from 'react-icons/bs';
import { motion, AnimatePresence } from 'framer-motion';
import type { SnippetRecord } from './snippetTypes';
type Snippet = SnippetRecord & {
  category?: string;
  folderId?: string | null;
  workspaceId?: string;
  snippet_id?: string;
  key?: string;
  value?: any;
  todo_id?: string;
  event_deadline?: any;
  is_recurring?: boolean;
  recurring_cycle?: any;
  reminder?: any;
  is_todo_type?: boolean;
};
type Folder = { id?: string; folder_id?: string; folderName?: string; folder_name?: string };
type Workspace = { id?: string; workspace_id?: string; workspaceName?: string; workspace_name?: string };
import DeleteConfirmation from '../../../../shared-components/modals/deleteDialog';
import { deleteSnippet } from './snippetData';
import { useFavorites } from '../../../../shared-components/favorites/favoriteHooks';
import { findCommandByAnyId, isCommandId } from '../../../../shared-components/commands';
import {
  getItemCompoundId,
  readAllHotkeys,
  readAllShortcuts,
  extractSnippetIdFromCompoundId,
} from '../../../../shared-components/hotkeys/utils/hotkeyUtils';

import { saveShortcut as apiSaveShortcut, clearShortcut as apiClearShortcut } from '../../../../shared-components/shortcuts';
import { UnifiedContextMenu, MenuAction } from '../../../../shared-components/ui/UnifiedContextMenu';
import { useDbStore } from '../../../../storage/store/useDbStore';

interface SnippetSettingsModalProps {
  isOpen: boolean;
  position: { top: number; left: number };
  onClose: () => void;
  snippet: Snippet | null;
  workspace: Workspace | null;
  folder: Folder | null;
  reload: () => void;
  onOpenCustomize: (snippet: Snippet) => void;
  onEdit: (snippet: Snippet) => void;
}

const SnippetSettingsModal: React.FC<SnippetSettingsModalProps> = ({
  isOpen,
  position,
  onClose,
  snippet,
  workspace,
  folder,
  reload,
  onOpenCustomize,
  onEdit,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const shortcutInputRef = useRef<HTMLInputElement>(null);
  const isMac = (navigator.platform.toUpperCase().indexOf('MAC') >= 0);
  const commands = useDbStore(state => state.commands);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoritesMapping, setFavoritesMapping] = useState<Record<string, any[]>>({});
  // Inline Editing States
  const [isEditingShortcut, setIsEditingShortcut] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictId, setConflictId] = useState<string | null>(null);
  const [existingShortcut, setExistingShortcut] = useState('');
  const [showSuccess, setShowSuccess] = useState<string | null>(null);

  // Local Favorites using Dexie

  // Fetch Favorites Status and Current Hotkeys
  const { isFavorite: checkFavorite, toggleFavorite } = useFavorites();

  useEffect(() => {
    if (!isOpen || !snippet) return;

    const initData = async () => {
      // Favorites
      const snippetId = snippet.id || snippet.snippet_id;
      setIsFavorite(checkFavorite(snippetId || ''));

      // Shortcut
      const allShortcuts = await readAllShortcuts();
      const compoundId = getItemCompoundId({ snippet, workspace, folder });
      setExistingShortcut(allShortcuts[compoundId] || '');
    };
    initData();
  }, [isOpen, snippet, workspace, folder, checkFavorite]);

  // Focus logic removed as UnifiedContextMenu handles it

  // Click outside listener
  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (showDeleteDialog) return;
    onClose();
  };

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setIsEditingShortcut(false);
      setInputValue('');
      setError(null);
      setConflictId(null);
      setSaving(false);
    }
  }, [isOpen]);

  const handleDeleteSnippet = async () => {
    try {
      if (!snippet?.id) return;
      const category = (snippet.category || '').toLowerCase();
      const isLink = category.includes('link') || category.includes('tabgroup');
      const itemType = isLink ? 'snippet' : 'note';

      useUIStore.getState().setCommandStatus({ status: 'loading', message: `Deleting ${itemType} "${snippet.key}"...` });
      await deleteSnippet(snippet.id);
      reload();
      useUIStore.getState().setCommandStatus({
          status: 'success',
          message: `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} deleted successfully`,
        });
      setTimeout(() => {
        useUIStore.getState().setCommandStatus({ status: 'idle', message: '' });
      }, 3000);
      setShowDeleteDialog(false);
      onClose();
    } catch (error: any) {
      const serverErrorMessage = error.response?.data?.error || error?.message || 'Failed to delete file';
      useUIStore.getState().setCommandStatus({ status: 'error', message: serverErrorMessage });
      setTimeout(() => {
        useUIStore.getState().setCommandStatus({ status: 'idle', message: '' });
      }, 3000);
      throw error;
    }
  };

  const handleToggleFavorite = async () => {
    if (!snippet) return;
    try {
      setSaving(true);
      const snippetId = snippet.id || snippet.snippet_id;
      if (!snippetId) return;

      const category = (snippet.category || '').toLowerCase();
      const type = category.includes('link') || category.includes('tabgroup') ? 'link' : 'note';

      await toggleFavorite(snippetId, type, snippet.key);

      setIsFavorite(!isFavorite);
      useUIStore.getState().setCommandStatus({ status: 'success', message: isFavorite ? 'Removed from favorites' : 'Added to favorites' });
      setTimeout(() => useUIStore.getState().setCommandStatus({ status: 'idle', message: '' }), 3000);
    } catch (err) {
      console.error(err);
      useUIStore.getState().setCommandStatus({ status: 'error', message: 'Failed to update favorite' });
    } finally {
      setSaving(false);
      onClose(); // Close popup after toggle
    }
  };






  // Navigation to conflict
  const handleNavigateToConflict = () => {
    if (conflictId) {
      useUIStore.getState().setHighlightedCommandId(conflictId);
    }
    onClose();
  };

  if (!isOpen || !snippet) return null;

  const category = (snippet.category || '').toLowerCase();
  const itemTypeLabel = category.includes('link')
    ? 'Link'
    : category.includes('tabgroup')
      ? 'Link Group'
      : category.includes('prompt')
        ? 'AI Prompt'
        : 'Note';

  const getDeleteDescription = () => {
    const isLink = category.includes('link') || category.includes('tabgroup');
    return `Are you sure you want to delete this ${isLink ? 'link' : 'note'}? This action cannot be undone.`;
  };

  // Smart positioning logic
  const estimatedHeight = 350; // Heuristic
  const estimatedWidth = isEditingShortcut ? 240 : 192;

  const wouldOverflowBottom = position.top + estimatedHeight > window.innerHeight;
  const wouldOverflowRight = position.left + estimatedWidth > window.innerWidth;

  const style: React.CSSProperties = {
    position: 'absolute',
    maxHeight: 'calc(100vh - 24px)',
    overflowY: 'auto',
  };

  if (wouldOverflowBottom) {
    style.bottom = window.innerHeight - position.top;
    style.top = 'auto'; // Flip up
  } else {
    style.top = position.top;
    style.bottom = 'auto';
  }

  if (wouldOverflowRight) {
    style.right = window.innerWidth - position.left;
    style.left = 'auto'; // Flip left
  } else {
    style.left = position.left;
    style.right = 'auto';
  }

  const menuActions: MenuAction[] = [
    {
      key: 'edit',
      label: `Edit ${itemTypeLabel}`,
      icon: <FaEdit size={14} />,
      onSelect: () => onEdit(snippet!),
    },
    {
      key: 'customize',
      label: 'Edit File',
      icon: <FaPalette size={14} />,
      onSelect: () => onOpenCustomize(snippet!),
    },
    { divider: true, key: 'div1', label: '', icon: null, onSelect: () => { } },
    {
      key: 'favorite',
      label: isFavorite ? 'Remove from favorites' : 'Add to favorites',
      icon: isFavorite ? <FaStar size={14} className="text-amber-400" /> : <FaRegStar size={14} />,
      onSelect: handleToggleFavorite,
    },
    {
      key: 'create-todo',
      label: 'Create Todo',
      icon: <BsCalendarCheck size={14} className="text-[var(--color-iconDefault)]" />,
      onSelect: () => {
        if (!snippet) return;
        useUIStore.getState().setTodoCreatePrefill({
            snippet_id: snippet.id || (snippet as any).snippet_id,
            key: snippet.key,
            value: typeof snippet.value === 'string' ? snippet.value : JSON.stringify(snippet.value),
            category: snippet.category || 'snippet',
            todo_id: (snippet as any).todo_id,
            event_deadline: snippet.event_deadline,
            is_recurring: snippet.is_recurring,
            recurring_cycle: snippet.recurring_cycle,
            reminder: snippet.reminder,
          });
        if (snippet.is_todo_type || snippet.category === 'task') {
          useUIStore.getState().setSidebar('todoSidebar', { open: true });
        }
        onClose();
      },
    },

    {
      key: 'delete',
      label: 'Delete',
      icon: <FaTrashAlt size={14} />,
      className: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
      onSelect: () => setShowDeleteDialog(true),
      closeOnExecute: false,
    },
  ];

  return createPortal(
    <>
      {!showDeleteDialog && (
        <UnifiedContextMenu
          x={position.left}
          y={position.top}
          onClose={onClose}
          actions={menuActions}
          itemId={getItemCompoundId({ snippet, workspace, folder })}
          error={error || undefined}
          conflictId={conflictId}
          onNavigateAlreadyAssigned={handleNavigateToConflict}

        />
      )}

      {/* Delete Confirmation */}
      {showDeleteDialog && (
        <DeleteConfirmation
          isOpen={showDeleteDialog}
          title={`Delete ${itemTypeLabel}?`}
          description={getDeleteDescription()}
          onConfirm={handleDeleteSnippet}
          onClose={() => {
            setShowDeleteDialog(false);
            onClose();
          }}
          zIndex={10001}
        />
      )}
    </>,
    document.body,
  );
};

export default SnippetSettingsModal;
