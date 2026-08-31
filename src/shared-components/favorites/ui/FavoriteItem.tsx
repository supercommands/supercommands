import {useAppearance} from '@extension/ui';
// API imports removed
import { format } from 'date-fns';
import type { SnippetRecord } from '../../../allObjectFolder/src/createObject/snippets/snippetTypes';
type NewSnippetBreadCrum = {
  workspace_id: string | null;
  workspace_name: string | null;
  folder_id?: string | null;
  folder_name?: string | null;
};
type FavoriteCommand = {
  id: string;
  type: 'command';
  label: string;
  icon?: string;
  commandPrefix: string;
  iconHost?: string;
  iconStack?: boolean;
  favourite_id?: number;
  category?: string;
  automation?: any;
};
type Snippet = SnippetRecord & {
  key?: string;
  value?: string | { urls: string[]; names: string[] };
  category?: string;
  user_id?: string;
  first_name?: string;
  last_name?: string | null;
  created_at?: string;
  updated_at?: string;
  tags?: { tag_id: string; name: string }[] | null;
  snippet_id?: string;
};
import { FaCode, FaFlag, FaCheck, FaTimes } from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import { TbNotes } from 'react-icons/tb';
import { StorageManager } from '../../../storage/localStorage/storageManager';
import CmdIcon from '../../icons/cmdIcon';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import * as React from 'react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useUIStore } from '../../uiStateManager';
import { createPortal } from 'react-dom';
import { FaCaretRight, FaCaretDown, FaRegClone, FaCaretUp } from 'react-icons/fa';
import { useDbStore } from '../../../storage/store/useDbStore';

import { getFaviconUrl } from '../../../shared-components/searchBarMain/utilityFunctions/utils';
import { AI_GROUP, findCommandByAnyId, isCommandId } from '../../commands';

import { FiTrash2, FiPlay, FiLayers, FiExternalLink, FiZap, FiZapOff, FiLoader, FiList, FiCheck } from 'react-icons/fi';
import { BsKeyboard, BsPencilFill } from 'react-icons/bs';
import { MdOutlineShortcut } from 'react-icons/md';
import { useFavorites } from '../favoriteHooks';
import type { MenuAction } from '../../ui/UnifiedContextMenu';
import { FavoritesContextMenu } from './FavoritesContextMenu';
import AutomationDynamicIcon from '../../icons/automationDynamicIcon';
import StackedLinkIcon from '../../icons/stackedLinkIcon';
import NotesIcon from '../../icons/notesIcon';
import { getItemCompoundId, extractSnippetIdFromCompoundId } from '../../hotkeys/utils/hotkeyUtils';
import { resolveEntityById } from '../../utils/entityResolver';
import { saveUserHotkey, deleteUserHotkeyByReference } from '../../hotkeys/core/hotkeyDbData';
import { normalizeShortcutTrigger } from '../../shortcuts/core/shortcutDbData';
import { saveUserShortcut, deleteUserShortcutByReference } from '../../shortcuts/core/shortcutDbData';
import { useKeystrokeRecording } from '../../hotkeys';


const HotkeyBadge: React.FC<{ hotkey: string }> = ({ hotkey }) => {
  const { theme } = useAppearance();
  const isDark = theme.isDark;
  const isMac = typeof navigator !== 'undefined' && (navigator.platform.toLowerCase().includes('mac') || navigator.userAgent.toLowerCase().includes('mac'));
  if (!hotkey) return null;

  const parts = hotkey.split('+').map(p => p.trim());
  return (
    <span className="flex items-center gap-0.5 opacity-80 scale-90 origin-left">
      {parts.map((part, i) => {
        let display = part;
        if (isMac) {
          if (part.toLowerCase() === 'alt') display = '⌥';
        }

        return (
          <React.Fragment key={i}>
            <span
              className={`px-1.5 py-0.5 rounded font-medium text-[10px] min-w-[1.2rem] text-center shadow-sm ${
                isDark ? 'bg-neutral-800/80 text-neutral-400' : 'bg-[#eee8d5] text-[#586e75]'
              }`}>
              {display}
            </span>
            {i < parts.length - 1 && <span className="text-[10px] text-neutral-400">+</span>}
          </React.Fragment>
        );
      })}
    </span>
  );
};

const chromeAny = chrome as any;

const isLikelySavedAgentFavorite = (item: any): boolean => {
  if (!item) return false;

  if (item.category === 'agent' || item.section === 'Chat Agents') return true;

  const steps = item.automation_steps || item.steps || item.automation?.steps || [];
  if (!Array.isArray(steps)) return false;

  return steps.some((step: any) => {
    const moduleId = String(step?.moduleId || step?.module_id || step?.module || step?.type || '').toLowerCase();
    return moduleId === 'agent';
  });
};

interface FavoriteItemProps {
  userId: string;
  snippet: Snippet | FavoriteCommand | any; // Accept both types
  reload: () => void;
  selectedItem: string | null;
  index: number;
  onCommandSelect?: (id: string) => void;
  onSelectSavedAgent?: (agent: any) => void;
  onAutomationSelect?: (automation: any) => void;
  hotkeysMap?: Record<string, string>;
  onHotkeyChange?: (id: string, hotkey: string, type: 'command' | 'link' | 'note') => void;
  onOpenUrls?: (urls: string[], title?: string) => void;
  onNavigateToListView?: (type: 'notes' | 'links' | 'commands', section?: string) => void;
  onRequestEditLink?: (suggestion: { snippet: Snippet }) => void;
  isReordering?: boolean;
  extensionCommands?: any[];
  
  
  shortcutsMap?: Record<string, string>;
  onInlineEditLinkClick?: (snippet: any, element: HTMLElement) => void;
  overrideIcon?: React.ReactNode;
  onSnippetSelect?: (snippet: Snippet) => void;
  onStartExistingSession?: (suggestion: { snippet: Snippet }) => void;
  isSnippetPanel?: boolean;
  isSessionMode?: boolean;
  onHoverItem?: (item: Snippet | null, element: HTMLElement | null) => void;
  folder?: any;
  workspace?: any;
  selectedTeamId?: string;
}

const headingFontStyle: React.CSSProperties = {
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontWeight: 400,
};

// Component for rendering Command Favorites
const CommandFavoriteItem: React.FC<FavoriteItemProps & { command: FavoriteCommand }> = ({
  userId, // Destructure userId
  command,
  overrideIcon,
  selectedItem,
  onCommandSelect,
  onSelectSavedAgent,
  onAutomationSelect,
  hotkeysMap,
  
  onNavigateToListView,
  isReordering,
  extensionCommands,
  
  
  shortcutsMap,
  reload,
  isSessionMode = false,
}) => {
  const { theme } = useAppearance();
  const isDark = theme.isDark;
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingShortcut, setIsEditingShortcut] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [conflictId, setConflictId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const setCommandStatus = useUIStore(state => state.setCommandStatus);
  const resetCommandStatus = useUIStore(state => state.resetCommandStatus);
  const queueNotification = useUIStore(state => state.queueNotification);
  const setSelectedSnippetId = useUIStore(state => state.setSelectedSnippetId);
  const setSnippetBreadcrumb = useUIStore(state => state.setSnippetBreadcrumb);
  const viewSnippet = useUIStore(state => state.viewSnippet);
  const isMac = typeof navigator !== 'undefined' && (navigator.platform.toLowerCase().includes('mac') || navigator.userAgent.toLowerCase().includes('mac'));
  const commands = useDbStore(state => state.commands);
  const { captureHotkey } = useKeystrokeRecording(editValue, isMac);
  const { removeFavorite } = useFavorites();
  const commandRecord = findCommandByAnyId(commands, command.id);
  const isLocalCommand = commandRecord?.surface !== 'website';

  useEffect(() => {
    const timer = setTimeout(async () => {
      setErrorMessage('');
      setConflictId(null);

      if (!editValue) return;

      if (isEditing) {
        const allHotkeys = hotkeysMap || {};
        const existingEntry = Object.entries(allHotkeys).find(([id, hk]) => hk === editValue && id !== command.id);
        if (existingEntry) {
          const conflictingId = existingEntry[0];
          const conflictName = await findConflictingItemName(conflictingId);
          const msg = conflictName
            ? `Hotkey "${editValue}" is already assigned to "${conflictName.name}" - ${conflictName.type}`
            : `Hotkey "${editValue}" is already assigned`;
          setErrorMessage(msg);
          setConflictId(conflictingId);
        }
      } else if (isEditingShortcut) {
        let normalized = editValue.trim();
        if (normalized && !normalized.startsWith('/')) {
          normalized = `/${normalized}`;
        }
        if (normalized) {
          const allShortcuts = shortcutsMap || {};
          const existingEntry = Object.entries(allShortcuts).find(([id, sc]) => sc === normalized && id !== command.id);
          if (existingEntry) {
            const conflictingId = existingEntry[0];
            const conflictName = await findConflictingItemName(conflictingId);
            const msg = conflictName
              ? `Shortcut "${normalized}" is already assigned to "${conflictName.name}" - ${conflictName.type}`
              : `Shortcut "${normalized}" is already assigned`;
            setErrorMessage(msg);
            setConflictId(conflictingId);
          }
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [editValue, isEditing, isEditingShortcut]);

  // Helper to find item name by ID
  const findConflictingItemName = async (conflictingId: string): Promise<{ name: string; type: string } | null> => {
    const cmd = findCommandByAnyId(commands, conflictingId);
    if (cmd) return { name: cmd.label || 'Command', type: 'COMMAND' };

    const resolved = await resolveEntityById(conflictingId);
    if (!resolved) return null;

    const type = (resolved.type || 'NOTE').toUpperCase();
    const ent = resolved.entity as any;
    const name = ent.title || ent.name || ent.key || 'Untitled';
    return { name, type };
  };

  const hotkey = ((commandRecord as any)?.hotkey ?? hotkeysMap?.[command.id]) || '';
  const shortcut = ((commandRecord as any)?.prefix ?? shortcutsMap?.[command.id]) || '';

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReordering) return;
    setEditValue(hotkey || '');
    setIsUpdating(!!hotkey);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
    });
    setIsEditing(true); // Modes switch
  };

  const handleSaveHotkey = async (newValue: string) => {
    if (!newValue) {
      setIsEditing(false);
      return;
    }

    // Check for duplicates
    const allHotkeys = hotkeysMap || {};
    // Check if hotkey is used by another item (not this one)
    const existingEntry = Object.entries(allHotkeys).find(([id, hk]) => hk === newValue && id !== command.id);

    if (existingEntry) {
      const conflictingId = existingEntry[0];
      const conflict = await findConflictingItemName(conflictingId);
      const msg = conflict
        ? `Hotkey "${newValue}" is already assigned to "${conflict.name}" - ${conflict.type}`
        : `Hotkey "${newValue}" is already assigned`;

      setErrorMessage(msg);
      setConflictId(conflictingId);
      queueNotification({ message: msg, type: 'error' });
      return;
    }

    setErrorMessage('');
    setIsSaving(true);

      // Save directly to IndexedDB
      try {
        let resolvedType = 'command';
        if (!isCommandId(commands, command.id)) {
           const resolved = await resolveEntityById(command.id);
           if (resolved) resolvedType = resolved.type;
        }
        await saveUserHotkey(newValue, command.id, resolvedType as any);

      const actionText = isUpdating ? 'updated' : 'saved';
      setCommandStatus({ status: 'success', message: `Hotkey ${actionText} successfully` });
      setTimeout(() => resetCommandStatus(), 3000);

      // Refresh maps
      const allHotkeys = hotkeysMap || {}; const allShortcuts = shortcutsMap || {};
      
      

      setShowSuccess(newValue);
    } catch (error: any) {
      console.error('Failed to save command hotkey to cloud:', error);
    } finally {
      // Short delay to show success state before closing
      await new Promise(r => setTimeout(r, 1000));
      setIsSaving(false);
      setIsEditing(false);
      setContextMenu(null);
      setShowSuccess(null);
    }
  };

  const handleOverwriteHotkey = async () => {
    if (!conflictId) return;
    setIsSaving(true);
    setErrorMessage('Overwriting existing hotkey...');

    try {
      // 1. Clear existing
      const isCommand = isCommandId(commands, conflictId);
      if (isCommand) {
        const isLocal = findCommandByAnyId(commands, conflictId)?.surface !== 'website';
        if (isLocal) {
          await useDbStore.getState().updateCommandRecord(conflictId, { hotkey: '' });
        } else {
          try {
            await deleteUserHotkeyByReference(conflictId);
          } catch (e) {
            console.warn('Clear hotkey failed', e);
          }
        }
      } else {
        await deleteUserHotkeyByReference(conflictId);
      }

      // 2. Save new
      await handleSaveHotkey(editValue);
    } catch (err) {
      console.error('Overwrite hotkey failed:', err);
      setErrorMessage('Overwrite failed. Please try again.');
      setIsSaving(false);
    }
  };

  const handleSaveShortcut = async (value: string) => {
    const normalized = normalizeShortcutTrigger(value);
    if (!normalized) {
      setIsEditingShortcut(false);
      return;
    }

    // Check for duplicates
    const allShortcuts = shortcutsMap || {};
    const existingEntry = Object.entries(allShortcuts).find(([id, sc]) => sc === normalized && id !== command.id);

    if (existingEntry) {
      const conflictingId = existingEntry[0];
      const conflict = await findConflictingItemName(conflictingId);
      const msg = conflict
        ? `Shortcut "${normalized}" is already assigned to "${conflict.name}" - ${conflict.type}`
        : `Shortcut "${normalized}" is already assigned`;

      setErrorMessage(msg);
      setConflictId(conflictingId);
      queueNotification({ message: msg, type: 'error' });
      return;
    }

    setIsSaving(true);
    setCommandStatus({ status: 'loading', message: 'Saving shortcut...' });

    try {
      if (isLocalCommand) {
        await useDbStore.getState().updateCommandRecord(command.id, { prefix: normalized });
      } else {
        let resolvedType = 'command';
        if (!isCommandId(commands, command.id)) {
           const resolved = await resolveEntityById(command.id);
           if (resolved) resolvedType = resolved.type;
        }
        await saveUserShortcut(normalized, command.id, resolvedType as any);
      }

      // Commands now persist through the shared IndexedDB command record, while
      // link/note shortcuts still use their dedicated shortcut store.

      setCommandStatus({ status: 'success', message: 'Shortcut saved successfully' });
      setTimeout(() => resetCommandStatus(), 3000);

      // Refresh maps
      const allHotkeys = hotkeysMap || {}; const allShortcuts = shortcutsMap || {};
      
      

      setShowSuccess(normalized);
    } catch (error: any) {
      console.error('Failed to save command shortcut:', error);
      setCommandStatus({ status: 'error', message: `Failed to save: ${error.message || 'Unknown error'}` });
      setTimeout(() => resetCommandStatus(), 3000);
    } finally {
      // Short delay to show success state before closing
      await new Promise(r => setTimeout(r, 1000));
      setIsSaving(false);
      setIsEditingShortcut(false);
      setContextMenu(null);
      setShowSuccess(null);
    }
  };

  const handleOverwriteShortcut = async () => {
    if (!conflictId) return;
    setIsSaving(true);
    setErrorMessage('Overwriting existing shortcut...');

    try {
      // 1. Clear existing
      const isCommand = isCommandId(commands, conflictId);
      if (isCommand) {
        const isLocal = findCommandByAnyId(commands, conflictId)?.surface !== 'website';
        if (isLocal) {
          await useDbStore.getState().updateCommandRecord(conflictId, { prefix: '' });
        } else {
          try {
            await deleteUserShortcutByReference(conflictId);
          } catch (e) {
            console.warn('Clear command shortcut failed', e);
          }
        }
      } else {
        await deleteUserShortcutByReference(conflictId);
      }

      // 2. Save new
      await handleSaveShortcut(editValue);
    } catch (err) {
      console.error('Overwrite shortcut failed:', err);
      setErrorMessage('Overwrite failed. Please try again.');
      setIsSaving(false);
    }
  };

  const handleHotkeyCapture = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const result = captureHotkey(e);
    if (result === 'CANCEL') {
      setIsEditing(false);
      setErrorMessage('');
    } else if (result) {
      setEditValue(result);
      setErrorMessage('');
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isSessionMode) return;
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleClearHotkey = async () => {
    if (!hotkey) return;
    setCommandStatus({ status: 'loading', message: 'Clearing hotkey...' });
    setIsSaving(true);

    try {
      // Clear from IndexedDB directly
      await deleteUserHotkeyByReference(command.id);

      setCommandStatus({ status: 'success', message: 'Hotkey cleared successfully' });
      setTimeout(() => resetCommandStatus(), 3000);

      // Refresh maps
      const allHotkeys = hotkeysMap || {}; const allShortcuts = shortcutsMap || {};
      
      
    } catch (error) {
      console.error('Failed to clear command hotkey:', error);
      setCommandStatus({ status: 'error', message: 'Failed to clear hotkey' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveFavorite = async () => {
    try {
      await removeFavorite(command.id);
    } catch (err) {
      console.error('Failed to delete command favorite:', err);
    }
  };

  const menuActions: MenuAction[] = [
    {
      key: 'assign-shortcut',
      label: shortcut ? `Assign a Text Command (${normalizeShortcutTrigger(shortcut)})` : 'Assign a Text Command',
      icon: <MdOutlineShortcut size={14} className="text-green-600 dark:text-green-400" />,

      className: 'text-neutral-700 dark:text-neutral-300 ',
      onSelect: () => {
        // Pre-fill existing prefix if any
        const existingPrefix = (command as any).commandPrefix || '';
        setEditValue(normalizeShortcutTrigger(existingPrefix));
        setIsEditingShortcut(true);
        setIsEditing(false);
        setIsUpdating(!!existingPrefix);
      },
    },
    {
      key: 'assign-hotkey',
      label: hotkey ? `Assign a Keyboard Shortcut (${hotkey})` : 'Assign a Keyboard Shortcut',
      icon: <BsKeyboard size={14} className="text-green-600 dark:text-green-400" />,
      className: 'text-neutral-700 dark:text-neutral-300 ',
      onSelect: () => {
        setEditValue(hotkey || '');
        setIsEditing(true);
        setIsEditingShortcut(false);
      },
    },

    { key: 'div-1', label: '', icon: null, onSelect: () => {}, divider: true },

    {
      key: 'remove',
      label: 'Remove from Favorites',
      icon: <FiTrash2 size={14} />,
      className: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
      onSelect: handleRemoveFavorite,
    },
  ];

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        whileDrag={{
          backgroundColor: isDark ? 'rgb(26, 26, 26)' : '#fdf6e3',
          boxShadow: '0 8px 30px rgb(0,0,0,0.12)',
          zIndex: 50,
        }}
        transition={{ duration: 0.2 }}
        role="button"
        tabIndex={0}
        onClick={() => {
          if (!isEditing && !isReordering) {
            if (onCommandSelect) {
              onCommandSelect(command.id);
            }
          }
        }}
        onContextMenu={handleContextMenu}
        title={command.label}
        className={`group relative cursor-pointer px-1 py-[0.5px] bg-transparent ${selectedItem === command.id ? (isDark ? 'bg-white/5' : 'bg-black/5') : ''}`}>
        <div className="flex items-center gap-1.5 h-[29px] overflow-hidden relative">
          {/* Icon - First */}
          <div
            className={`flex items-center justify-start flex-shrink-0 w-8 overflow-hidden transition-opacity duration-150 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
            {overrideIcon ? (
              <div className="w-[18px] h-[18px] flex items-center justify-center">{overrideIcon}</div>
            ) : command.id === 'createnotes' || command.id === 'createlinks' ? (
              <div className="h-5 w-5 flex items-center justify-start text-[11px] font-semibold text-neutral-500">
                {command.id === 'createnotes' ? 'N' : 'L'}
              </div>
            ) : command.id === 'ai' ? (
              <div className="flex -space-x-1.5 items-center justify-start">
                {AI_GROUP.members.slice(0, 4).map((id, idx) => {
                  const cmd = findCommandByAnyId(commands, id);
                  if (!cmd) return null;
                  return (
                    <div key={id} className="w-4 h-4 rounded-full flex items-center justify-center overflow-hidden border border-white dark:border-neutral-800 bg-[var(--color-iconDefault)] shadow-sm flex-shrink-0 relative" style={{ zIndex: 4 - idx }}>
                      <img
                        src={getFaviconUrl(cmd.iconHost)}
                        alt={cmd.label}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  );
                })}
              </div>
            ) : command.category === 'automation' || command.category === 'agent' || command.automation ? (
              <AutomationDynamicIcon automation={command.automation || command} size={16} />
            ) : command.iconHost ? (
              <img src={getFaviconUrl(command.iconHost)} alt="" className="w-4 h-5 rounded scale-[0.8]" />
            ) : (
              <div className="w-8 h-4 flex items-center justify-start scale-[0.35] origin-center">
                <CmdIcon />
              </div>
            )}
          </div>

          {/* Name - Second */}
          <div className="flex-1 min-w-0 min-h-0 h-full relative flex items-center overflow-hidden">
            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
              {/* Full Title (Visible by default, hidden on hover) */}
              <span
                className={`text-[12.5px] font-medium whitespace-nowrap truncate inline-block transition-colors duration-150 group-hover:hidden ${
                  selectedItem === command.id
                    ? !isDark
                      ? 'text-neutral-900 font-semibold'
                      : 'text-white font-semibold'
                    : !isDark
                      ? 'text-neutral-500 group-hover:text-neutral-900'
                      : 'text-neutral-400 group-hover:text-neutral-200'
                }`}
                style={headingFontStyle}>
                {command.label.length > 18 ? command.label.substring(0, 18) + '...' : command.label}
              </span>

              {/* Truncated Title (Hidden by default, visible on hover) */}
              <span
                className={`text-[12.5px] font-medium whitespace-nowrap truncate hidden group-hover:inline-block flex-shrink transition-colors duration-150 ${
                  selectedItem === command.id
                    ? !isDark
                      ? 'text-neutral-900 font-semibold'
                      : 'text-white font-semibold'
                    : !isDark
                      ? 'text-neutral-500'
                      : 'text-neutral-200'
                }`}
                style={headingFontStyle}>
                {command.label.length > 12 ? command.label.substring(0, 12) + '...' : command.label}
              </span>
              <span className={`text-[10px] ml-1 flex-shrink-0 hidden group-hover:inline-block transition-opacity duration-150 ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                • Command
              </span>
            </div>
          </div>

          {/* Hotkey - Last */}
          {!isSessionMode && (
            <div
              onClick={handleStartEdit}
              className={`flex-shrink-0 w-auto max-w-[120px] text-right pr-2 text-[10px] font-mono font-semibold transition-colors duration-150 ${
                !isDark ? 'text-neutral-400 hover:text-neutral-900' : 'text-neutral-500 hover:text-neutral-200'
              } cursor-pointer`}
              title={hotkey ? `Hotkey: ${hotkey}` : 'Click to edit hotkey'}>
              <span className="relative flex items-center justify-end w-full h-full">
                {hotkey ? (
                  <span className="transition-opacity duration-150 truncate">{hotkey}</span>
                ) : (
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-0.5 text-[#39d639] dark:text-[#39d639] pointer-events-none">
                    <BsPencilFill size={11} />
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      </motion.div>
      {contextMenu && (
        <FavoritesContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => {
            setContextMenu(null);
            setIsEditing(false);
            setIsEditingShortcut(false);
            setErrorMessage('');
          }}
          shortcut={shortcut}
          hotkey={hotkey}
          onSaveShortcut={handleSaveShortcut}
          onSaveHotkey={handleSaveHotkey}
          onClearShortcut={() => {
            setEditValue('');
            // Logic to clear shortcut (not explicitly a handler but we can add one or reuse handleSaveShortcut with empty)
            handleSaveShortcut('');
          }}
          onClearHotkey={handleClearHotkey}
          onToggleFavorite={handleRemoveFavorite}
          isFavorite={true}
          shortcutEditValue={isEditingShortcut ? editValue : normalizeShortcutTrigger(shortcut)}
          onShortcutEditChange={val => {
            setEditValue(val);
            setIsEditingShortcut(true);
            setIsEditing(false);
            setErrorMessage('');
          }}
          hotkeyEditValue={isEditing ? editValue : hotkey}
          onHotkeyEditChange={e => {
            handleHotkeyCapture(e);
            setIsEditing(true);
            setIsEditingShortcut(false);
          }}
          isSaving={isSaving}
          error={errorMessage}
          conflictId={conflictId}
          showSuccess={showSuccess}
          onOverwriteHotkey={handleOverwriteHotkey}
          onOverwriteShortcut={handleOverwriteShortcut}
        />
      )}
    </>
  );
};

// Existing Snippet Logic wrapped
const SnippetFavoriteItem: React.FC<FavoriteItemProps & { snippet: Snippet }> = props => {
  const {
    userId,
    snippet: propSnippet,
    
    
    reload,
    selectedItem,
    index,
    hotkeysMap,
    onOpenUrls,
    onNavigateToListView,
    isReordering,
    
    
    shortcutsMap,
    onCommandSelect,
    onSelectSavedAgent,
    onAutomationSelect,
    onRequestEditLink,
    onStartExistingSession,
    onInlineEditLinkClick,
    isSnippetPanel,
    isSessionMode = false,
    folder,
    workspace,
  } = props;
  const { overrideIcon } = props as any;

  const { theme } = useAppearance();
  const isDark = theme.isDark;

  const [isEditing, setIsEditing] = useState(false);
  const [isEditingShortcut, setIsEditingShortcut] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingHotkey, setIsUpdatingHotkey] = useState(false);
  const [isUpdatingShortcut, setIsUpdatingShortcut] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [conflictId, setConflictId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showTodoDialog, setShowTodoDialog] = useState(false);
  const snippet = propSnippet;
  const isMac = typeof navigator !== 'undefined' && (navigator.platform.toLowerCase().includes('mac') || navigator.userAgent.toLowerCase().includes('mac'));
  
  const setCommandStatus = useUIStore(state => state.setCommandStatus);
  const resetCommandStatus = useUIStore(state => state.resetCommandStatus);
  const queueNotification = useUIStore(state => state.queueNotification);
  const setSelectedSnippetId = useUIStore(state => state.setSelectedSnippetId);
  const setSnippetBreadcrumb = useUIStore(state => state.setSnippetBreadcrumb);
  const viewSnippet = useUIStore(state => state.viewSnippet);

  const commands = useDbStore(state => state.commands);
  const { captureHotkey } = useKeystrokeRecording(editValue, isMac);

  const [existingTodo, setExistingTodo] = useState<any>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  const activeView = useUIStore((s: any) => s.activeView);

  useEffect(() => {
    if (contextMenu) {
      StorageManager.getItem(['local_todos', 'cached_todos']).then((result: any) => {
        const allTodos = [...(result.local_todos || []), ...(result.cached_todos || [])];
        const match = allTodos.find(t => {
          const tSid = String(t.snippet_id);
          const id1 = snippet.id || snippet.snippet_id;
          return tSid === String(id1) || tSid === `auto-${id1}` || tSid === `agent-${id1}`;
        });
        setExistingTodo(match || null);
      });
    } else {
      setExistingTodo(null);
    }
  }, [contextMenu, snippet.id, snippet.snippet_id]);

  const handleSaveTodoDirectly = async (todoData: any) => {
    console.log('Todo logic removed');
    setShowTodoDialog(false);
  };

  // Build compound ID using standardized helper (include workspace/folder so ID matches what editor saves)
  const snippetId = snippet.snippet_id || snippet.id;
  const compoundId = getItemCompoundId({
    suggestion: { snippet },
    workspace: (snippet as any).workspaceId ? { workspace_id: (snippet as any).workspaceId } : null,
    folder: (snippet as any).folderId ? { folder_id: (snippet as any).folderId } : null,
  }) || snippetId;

  useEffect(() => {
    const timer = setTimeout(async () => {
      setErrorMessage('');
      setConflictId(null);

      if (!editValue) return;

      if (isEditing) {
        const allHotkeys = hotkeysMap || {};
        const existingEntry = Object.entries(allHotkeys).find(([id, hk]) => hk === editValue && id !== compoundId);
        if (existingEntry) {
          const conflictingId = existingEntry[0];
          const conflictName = await findConflictingItemName(conflictingId);
          const msg = conflictName
            ? `Hotkey "${editValue}" is already assigned to "${conflictName.name}" - ${conflictName.type}`
            : `Hotkey "${editValue}" is already assigned`;
          setErrorMessage(msg);
          setConflictId(conflictingId);
        }
      } else if (isEditingShortcut) {
        let normalized = editValue.trim();
        if (normalized && !normalized.startsWith('/')) {
          normalized = `/${normalized}`;
        }
        if (normalized) {
          const allShortcuts = shortcutsMap || {};
          const existingEntry = Object.entries(allShortcuts).find(([id, sc]) => sc === normalized && id !== compoundId);
          if (existingEntry) {
            const conflictingId = existingEntry[0];
            const conflictName = await findConflictingItemName(conflictingId);
            const msg = conflictName
              ? `Shortcut "${normalized}" is already assigned to "${conflictName.name}" - ${conflictName.type}`
              : `Shortcut "${normalized}" is already assigned`;
            setErrorMessage(msg);
            setConflictId(conflictingId);
          }
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [editValue, isEditing, isEditingShortcut, compoundId]);

  const { toggleFavorite } = useFavorites();
  const openSingleLink = (url: string): void => {
    if (url.startsWith('note:')) {
      const sid = url.substring(5);
      const extUrl = chrome.runtime.getURL(`AltS_search_newtab/index.html?open_note=true&noteid=${encodeURIComponent(sid)}`);
      chrome.tabs.create({ url: extUrl, active: true });
      return;
    }
    if (url.startsWith('agent_chat?id=')) {
      const agentId = url.split('id=')[1];
      const extUrl = chrome.runtime.getURL(`AltS_search_newtab/index.html?lock_command=ai&agent_id=${encodeURIComponent(agentId)}`);
      chrome.tabs.create({ url: extUrl, active: true });
      return;
    }
    chrome.tabs.create({ url, active: true });
  };

  const openMultipleLinks = (urls: string[]): void => {
    urls.forEach(url => openSingleLink(url));
  };
  const categoryStr = snippet.category || snippet.type || '';
  const rawLabel =
    categoryStr === 'link'
      ? 'Link'
      : categoryStr === 'session'
        ? 'Tab Session'
        : categoryStr === 'prompt'
          ? 'Chat Agent'
          : categoryStr === 'snippet'
            ? 'Text Expander'
            : categoryStr === 'automation' || categoryStr === 'agent'
              ? 'Automation'
              : 'Note';
  const isTabGroupCategory = categoryStr === 'session';
  const isLinkCategory = categoryStr === 'link';
  const normalizedCategory = String(categoryStr).toLowerCase();
  const displayName = snippet.key || snippet.label || snippet.title || snippet.name || 'Untitled Item';

  const subLinksCount = useMemo(() => {
    if (categoryStr === 'link') {
      if (Array.isArray(snippet.urls)) {
        return snippet.urls.length;
      }
      if (typeof snippet.value === 'string') {
        try {
          const parsed = JSON.parse(snippet.value);
          if (parsed && Array.isArray(parsed.urls)) {
            return parsed.urls.length;
          }
        } catch (_) {}
      } else if (typeof snippet.value === 'object' && Array.isArray((snippet.value as any)?.urls)) {
        return (snippet.value as any).urls.length;
      }
    }
    return 0;
  }, [snippet.value, snippet.urls, isTabGroupCategory, categoryStr]);

  const snippetUrls = useMemo(() => {
    let urls: string[] = [];
    if (snippet) {
      if (Array.isArray(snippet.urls)) {
        urls = snippet.urls.map((u: any) => u.url || u).filter(Boolean);
      } else if (typeof snippet.value === 'string') {
        try {
          const parsed = JSON.parse(snippet.value);
          urls = Array.isArray(parsed?.urls) ? parsed.urls : parsed?.url ? [parsed.url] : [snippet.value];
        } catch {
          urls = [snippet.value];
        }
      } else if (snippet.value && typeof snippet.value === 'object') {
        const val = snippet.value as any;
        urls = Array.isArray(val?.urls) ? val.urls : val?.url ? [val.url] : [];
      }
    }
    return urls;
  }, [snippet]);

  const renderFavoriteIcon = () => {
    if (snippet.id === 'ai' || (snippet as any).command_id === 'ai') {
      return (
        <div className="flex -space-x-1.5 items-center justify-start">
          {AI_GROUP.members.slice(0, 4).map((id, idx) => {
            const command = commands.find(x => x.id === id);
            if (!command) return null;
            return (
              <div
                key={`ai-fav-${command.id}`}
                className="w-4 h-4 rounded-full flex items-center justify-center overflow-hidden border border-white dark:border-neutral-800 bg-[var(--color-iconDefault)] shadow-sm flex-shrink-0 relative"
                style={{ zIndex: 4 - idx }}>
                <img src={(getFaviconUrl(command.iconHost || '') || '') as string} alt={command.label || ''} className="w-full h-full object-cover" />
              </div>
            );
          })}
        </div>
      );
    }

    if (isTabGroupCategory) {
      return <StackedLinkIcon urls={snippetUrls} size={18} fallback="session" />;
    }

    if (isLinkCategory) {
      return <StackedLinkIcon urls={snippetUrls} size={18} fallback={isTabGroupCategory ? 'tabgroup' : 'link'} />;
    }

    if (['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(normalizedCategory)) {
      return <LuSparkles size={16} className="text-[var(--color-iconDefault)]" />;
    }

    if (normalizedCategory === 'automation' || normalizedCategory === 'automations' || snippet.steps || snippet.automation) {
      return <FiZap size={16} className="text-[var(--color-iconDefault)]" />;
    }

    if (normalizedCategory === 'snippet' || normalizedCategory === 'snippets') {
      return <FaCode size={16} className="text-[var(--color-iconDefault)]" />;
    }

    return <NotesIcon className="w-4 h-4 shrink-0 text-neutral-400" />;
  };

  // Get hotkey using compound ID
  const hotkey = hotkeysMap?.[compoundId] || '';
  const shortcut = shortcutsMap?.[compoundId] || '';

  // Helper to find item name by ID — uses Dexie resolveEntityById for correct name lookup
  const findConflictingItemName = async (conflictingId: string): Promise<{ name: string; type: string } | null> => {
    const cmd = findCommandByAnyId(commands, conflictingId);
    if (cmd) return { name: cmd.label || 'Command', type: 'COMMAND' };

    const resolved = await resolveEntityById(conflictingId);
    if (!resolved) return null;

    const type = (resolved.type || 'NOTE').toUpperCase();
    const name = (resolved.entity as any).title || (resolved.entity as any).name || (resolved.entity as any).key || 'Untitled';
    return { name, type };
  };

  const handleClearHotkey = async () => {
    if (!hotkey) return;
    setCommandStatus({ status: 'loading', message: 'Clearing hotkey...' });
    setIsSaving(true);
    try {
      await deleteUserHotkeyByReference(compoundId);
      setCommandStatus({ status: 'success', message: 'Hotkey cleared successfully' });
      setTimeout(() => resetCommandStatus(), 3000);
    } catch (error) {
      console.error('Failed to clear hotkey:', error);
      setCommandStatus({ status: 'error', message: 'Failed to clear hotkey' });
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to open links with first one in current tab
  const openWithCurrentTabStrategy = (urls: string[]) => {
    if (!urls || urls.length === 0) return;
    const [first, ...rest] = urls;

    // Open first in current tab
    chromeAny.tabs.query({ active: true, currentWindow: true }, (tabs: any) => {
      if (tabs && tabs[0]?.id) {
        chromeAny.tabs.update(tabs[0].id, { url: first });
      } else {
        window.open(first, '_self');
      }
    });

    // Open rest in new tabs
    rest.forEach(url => {
      chromeAny.tabs.create({ url, active: false });
    });
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isReordering || isSessionMode) return;
    setEditValue(hotkey || '');
    setIsUpdatingHotkey(!!hotkey);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
    });
    setIsEditing(true);
  };

  const handleSaveHotkey = async (newValue: string) => {
    if (!newValue) {
      setIsEditing(false);
      return;
    }

    // Check for duplicates using full compound IDs (no prefix stripping)
    const allHotkeys = hotkeysMap || {};
    const existingEntry = Object.entries(allHotkeys).find(([id, hk]) => hk === newValue && id !== compoundId);

    if (existingEntry) {
      const conflictingId = existingEntry[0];
      const conflict = await findConflictingItemName(conflictingId);
      const msg = conflict
        ? `Hotkey "${newValue}" is already assigned to "${conflict.name}" - ${conflict.type}`
        : `Hotkey "${newValue}" is already assigned`;

      setErrorMessage(msg);
      setConflictId(conflictingId);
      queueNotification({ message: msg, type: 'error' });
      return;
    }

    setErrorMessage('');
    setIsSaving(true);

    try {
      const type = isLinkCategory ? 'link' : 'note';
      await saveUserHotkey(newValue, compoundId, type as any);

      const actionText = isUpdatingHotkey ? 'updated' : 'saved';
      queueNotification({ message: `Hotkey ${actionText} successfully`, type: 'success' });
      setShowSuccess(newValue);
    } catch (error) {
      console.error('[FavoriteItem] Failed to save hotkey:', error);
    }

    // Short delay to show success state before closing
    await new Promise(r => setTimeout(r, 1000));

    setIsSaving(false);
    setIsEditing(false);
    setContextMenu(null);
    setShowSuccess(null);
  };

  const handleOverwriteHotkey = async () => {
    if (!conflictId) return;
    setIsSaving(true);
    setErrorMessage('Overwriting existing hotkey...');

    try {
      // 1. Clear existing — use full compound ID, no stripping
      const isCommand = isCommandId(commands, conflictId);
      if (isCommand) {
        const isLocal = findCommandByAnyId(commands, conflictId)?.surface !== 'website';
        if (isLocal) {
          await useDbStore.getState().updateCommandRecord(conflictId, { hotkey: '' });
        } else {
          await deleteUserHotkeyByReference(conflictId);
        }
      } else {
        await deleteUserHotkeyByReference(conflictId);
      }

      // 2. Save new
      await handleSaveHotkey(editValue);
    } catch (err) {
      console.error('Overwrite hotkey failed:', err);
      setErrorMessage('Overwrite failed. Please try again.');
      setIsSaving(false);
    }
  };

  const handleSaveShortcut = async (value: string) => {
    let normalized = value.trim();
    if (normalized && !normalized.startsWith('/')) {
      normalized = `/${normalized}`;
    }
    if (!normalized) {
      setIsEditingShortcut(false);
      return;
    }

    // Check for duplicates using full compound IDs (no prefix stripping)
    const allShortcuts = shortcutsMap || {};
    const existingEntry = Object.entries(allShortcuts).find(([id, sc]) => sc === normalized && id !== compoundId);

    if (existingEntry) {
      const conflictingId = existingEntry[0];
      const conflict = await findConflictingItemName(conflictingId);
      const msg = conflict
        ? `Shortcut "${normalized}" is already assigned to "${conflict.name}" - ${conflict.type}`
        : `Shortcut "${normalized}" is already assigned`;

      setErrorMessage(msg);
      setConflictId(conflictingId);
      queueNotification({ message: msg, type: 'error' });
      return;
    }

    setErrorMessage('');
    setIsSaving(true);

    try {
      const type = isLinkCategory ? 'link' : 'note';
      await saveUserShortcut(normalized, compoundId, type as any);

      const actionText = isUpdatingShortcut ? 'updated' : 'saved';
      queueNotification({ message: `Shortcut ${actionText} successfully`, type: 'success' });
      setShowSuccess(normalized);
    } catch (error) {
      console.error('[FavoriteItem] Failed to save shortcut:', error);
    }

    // Short delay to show success state before closing
    await new Promise(r => setTimeout(r, 1000));

    setIsSaving(false);
    setIsEditingShortcut(false);
    setContextMenu(null);
    setShowSuccess(null);
  };

  const handleOverwriteShortcut = async () => {
    if (!conflictId) return;
    setIsSaving(true);
    setErrorMessage('Overwriting existing shortcut...');

    try {
      // 1. Clear existing — use full compound ID, no stripping
      const isCommand = isCommandId(commands, conflictId);
      if (isCommand) {
        const isLocal = findCommandByAnyId(commands, conflictId)?.surface !== 'website';
        if (isLocal) {
          await useDbStore.getState().updateCommandRecord(conflictId, { prefix: '' });
        } else {
          await deleteUserShortcutByReference(conflictId);
        }
      } else {
        await deleteUserShortcutByReference(conflictId);
      }

      // 2. Save new
      await handleSaveShortcut(editValue);
    } catch (err) {
      console.error('Overwrite shortcut failed:', err);
      setErrorMessage('Overwrite failed. Please try again.');
      setIsSaving(false);
    }
  };

  const handleHotkeyCapture = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const result = captureHotkey(e);
    if (!result) return;
    if (result === 'CANCEL') {
      setIsEditing(false);
      setErrorMessage('');
    } else if (result) {
      setEditValue(result);
      setErrorMessage('');
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isSnippetPanel || isSessionMode) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const menuActions: MenuAction[] = [
    {
      key: 'assign-shortcut',
      label: shortcut ? `Assign a Text Command (${normalizeShortcutTrigger(shortcut)})` : 'Assign a Text Command',
      icon: <MdOutlineShortcut size={14} className="text-green-600 dark:text-green-400" />,
      className: 'text-neutral-700 dark:text-neutral-300 hover:bg-green-50 dark:hover:bg-green-900/20',
      onSelect: async () => {
        const allShortcuts = shortcutsMap || {};
        let existingValue = '';
        if (Object.prototype.hasOwnProperty.call(allShortcuts, compoundId)) {
          existingValue = allShortcuts[compoundId];
        } else {
          const entry = Object.entries(allShortcuts).find(([id]) => id === compoundId);
          if (entry) existingValue = entry[1] as string;
        }

        const displayValue = existingValue ? normalizeShortcutTrigger(existingValue) : '';
        setEditValue(displayValue);
        setIsUpdatingShortcut(!!existingValue);
        setIsEditingShortcut(true);
        setIsEditing(false);
        setErrorMessage('');
      },
    },
    {
      key: 'assign-hotkey',
      label: hotkey ? `Assign a Keyboard Shortcut (${hotkey})` : 'Assign a Keyboard Shortcut',
      icon: <BsKeyboard size={14} className="text-green-600 dark:text-green-400" />,
      className: 'text-neutral-700 dark:text-neutral-300 hover:bg-green-50 dark:hover:bg-green-900/20',
      onSelect: () => {
        setEditValue(hotkey || '');
        setIsUpdatingHotkey(!!hotkey);
        setIsEditing(true);
        setIsEditingShortcut(false);
      },
    },

    { key: 'div-1', label: '', icon: null, onSelect: () => {}, divider: true },

    {
      key: 'remove',
      label: 'Remove from Favorites',
      icon: <FiTrash2 size={14} />,
      className: 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20',
      onSelect: () => toggleFavorite(snippetId, categoryStr, displayName),
    },
  ];

  // Determine tooltip content (Title only)
  const tooltipContent = displayName;

  return (
    <>
      <motion.div
        ref={itemRef}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        whileDrag={{
          backgroundColor: isDark ? 'rgb(26, 26, 26)' : '#fdf6e3',
          boxShadow: '0 8px 30px rgb(0,0,0,0.12)',
          zIndex: 50,
        }}
        transition={{ duration: 0.2 }}
        role="button"
        tabIndex={0}
        onClick={(e) => {
          console.log('[FavoriteItem] onClick fired!', { isEditing, isEditingShortcut, isReordering });
          if (!isEditing && !isEditingShortcut && !isReordering) {
            const isOrgOrBillingView =
              activeView.type === 'subscriptions' ||
              activeView.type === 'manageSubscription' ||
              activeView.type === 'organizationSettings';

            const runClickAction = () => {
              const category = (snippet.category || snippet.type || '').toLowerCase();
              console.log('[FavoriteItem] runClickAction resolved category:', category, 'snippet:', snippet);
              
              if (['link', 'links', 'tabgroup'].includes(category)) {
                console.log('[FavoriteItem] Opening link collection');
                 const urls = snippetUrls;
                if (urls.length > 0) {
                  const chromeAny = (window as any)?.chrome;
                  urls.forEach((url) => {
                    if (chromeAny?.tabs?.create) {
                      chromeAny.tabs.create({ url, active: false });
                    } else {
                      window.open(url, '_blank');
                    }
                  });
                } else {
                  console.log('[FavoriteItem] Opening link editor (fallback)');
                  useUIStore.getState().openEditor({
                    type: 'link',
                    id: snippet.id || snippet.snippet_id || 'new',
                    props: { editMode: true, snippet }
                  });
                }
              } else if (['session', 'sessions', 'tab session'].includes(category)) {
                console.log('[FavoriteItem] Starting session');
                if (onStartExistingSession) {
                  onStartExistingSession({ snippet });
                } else {
                  useUIStore.getState().openEditor({
                    type: 'session',
                    id: snippet.id || snippet.snippet_id || 'new',
                    props: { editMode: true, snippet }
                  });
                }
              } else if (['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(category)) {
                if (isLikelySavedAgentFavorite(snippet) && onSelectSavedAgent) {
                  console.log('[FavoriteItem] Triggering agent');
                  onSelectSavedAgent(snippet.automation || snippet);
                } else if (category === 'agent' && onAutomationSelect) {
                  console.log('[FavoriteItem] Triggering agent via automation handler');
                  onAutomationSelect(snippet.automation || snippet);
                } else {
                  console.log('[FavoriteItem] Opening prompt editor');
                  setSelectedSnippetId(snippet.id);
                  setSnippetBreadcrumb({ workspace_id: '', workspace_name: '' });
                  useUIStore.getState().openEditor({
                    type: 'aiPrompt',
                    id: snippet.id || snippet.snippet_id || 'new',
                    props: {}
                  });
                }
              } else if (['automation', 'automations'].includes(category)) {
                console.log('[FavoriteItem] Triggering automation');
                if (onAutomationSelect) {
                  onAutomationSelect(snippet.automation || snippet);
                }
              } else if (['snippet', 'snippets', 'note', 'notes'].includes(category)) {
                console.log('[FavoriteItem] Opening note editor');
                const breadcrumb = {
                  workspace_id: workspace?.workspace_id || null,
                  workspace_name: workspace?.workspace_name || null,
                  folder_id: folder?.folder_id || null,
                  folder_name: folder?.folder_name || null,
                };
                viewSnippet({
                  snippet,
                  breadcrumb,
                });
                useUIStore.getState().openEditor({
                  type: 'note',
                  id: snippet.snippet_id || snippet.id || 'new',
                  props: {
                    snippet,
                  }
                });
              } else {
                console.log('[FavoriteItem] Falling back to note editor');
                const breadcrumb = {
                  workspace_id: workspace?.workspace_id || null,
                  workspace_name: workspace?.workspace_name || null,
                  folder_id: folder?.folder_id || null,
                  folder_name: folder?.folder_name || null,
                };
                viewSnippet({
                  snippet,
                  breadcrumb,
                });
                useUIStore.getState().openEditor({
                  type: 'note',
                  id: snippet.snippet_id || snippet.id || 'new',
                  props: {
                    snippet,
                  }
                });
              }
            };

            runClickAction();
          }
        }}
        onContextMenu={handleContextMenu}
        // Removed onMouseEnter/onMouseLeave to prevent hover popup
        title={tooltipContent}
        className={`group relative cursor-pointer px-1 py-[0.5px] bg-transparent ${selectedItem === snippet.id ? (isDark ? 'bg-white/5' : 'bg-black/5') : ''}`}>
        <div className="flex items-center gap-0 h-[29px] overflow-hidden relative">
          {/* Icon - First */}
          <div
            className={`flex items-center justify-start flex-shrink-0 ${isLinkCategory ? 'w-auto' : 'w-[22px] overflow-hidden'} ml-1 mr-1.5 transition-opacity duration-150 ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
            {overrideIcon ? (
              <div className="w-[18px] h-[18px] flex items-center justify-center">{overrideIcon}</div>
            ) : (
              <div
                className={`${isLinkCategory ? 'w-auto' : 'w-[18px] h-[18px]'} flex items-center justify-center ${isDark ? 'text-neutral-400' : 'text-neutral-500'}`}>
                {renderFavoriteIcon()}
              </div>
            )}
          </div>

          {/* Name - Second */}
          <div className="flex-1 min-w-0 min-h-0 h-full relative flex items-center overflow-hidden">
            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
              {/* Full Title (Visible by default, hidden on hover) */}
              <span
                className={`text-[13px] font-medium whitespace-nowrap truncate inline-block transition-colors duration-150 group-hover:hidden ${
                  selectedItem === snippet.id
                    ? !isDark
                      ? 'text-neutral-900 font-semibold'
                      : 'text-white font-semibold'
                    : !isDark
                      ? 'text-neutral-500 group-hover:text-neutral-900'
                      : 'text-neutral-400 group-hover:text-neutral-200'
                }`}
                style={headingFontStyle}>
                {(() => {
                  const name = displayName;
                  return name.length > 18 ? name.substring(0, 18) + '...' : name;
                })()}
              </span>

              {/* Truncated Title (Hidden by default, visible on hover) */}
              <span
                className={`text-[13px] font-medium whitespace-nowrap truncate hidden group-hover:inline-block flex-shrink transition-colors duration-150 ${
                  selectedItem === snippet.id
                    ? !isDark
                      ? 'text-neutral-900 font-semibold'
                      : 'text-white font-semibold'
                    : !isDark
                      ? 'text-neutral-500'
                      : 'text-neutral-200'
                }`}
                style={headingFontStyle}>
                {(() => {
                  const name = displayName;
                  return name.length > 12 ? name.substring(0, 12) + '...' : name;
                })()}
              </span>
              <span className={`text-[10px] ml-1 flex-shrink-0 hidden group-hover:inline-block transition-opacity duration-150 ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
                • {rawLabel}
              </span>

              {(snippet.hotkey || snippet.shortcut) && (
                <div className="ml-1.5 flex-shrink-0 flex items-center">
                  <HotkeyBadge hotkey={snippet.hotkey || snippet.shortcut || ''} />
                </div>
              )}

        </div>
          </div>


          {/* Edit/Session buttons on hover — only for link/tabgroup items */}
          {(isLinkCategory || snippet.category === 'link' || snippet.category === 'link') && (
            <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pr-2">
              {/* FiLayers button to start session mode */}
              <div
                className={`p-1 rounded-full cursor-pointer transition-colors ${
                  isDark ? 'hover:bg-white/10 text-neutral-400 hover:text-white' : 'hover:bg-black/5 text-neutral-500 hover:text-black'
                }`}
                title="Start Tab Session mode"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onStartExistingSession) {
                    onStartExistingSession({ snippet });
                  }
                }}
              >
                <FiLayers size={12} />
              </div>

              {/* Edit button — only in sessionMode */}
              {isSessionMode && (
                <div
                  className={`p-1 rounded-full cursor-pointer transition-colors ${
                    isDark ? 'hover:bg-white/10 text-neutral-400 hover:text-white' : 'hover:bg-black/5 text-neutral-500 hover:text-black'
                  }`}
                  title="Edit Link Collection"
                  onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onRequestEditLink) {
                      onRequestEditLink({ snippet });
                    } else {
                      useUIStore.getState().openEditor({ 
                        type: 'link', 
                        id: snippet.id || snippet.snippet_id,
                        props: { snippet }
                      });
                    }
                  }}
                >
                  <BsPencilFill size={11} />
                </div>
              )}
            </div>
          )}


          {/* Hotkey - Last */}
          {!isSnippetPanel && !isSessionMode && (
            <div
              onClick={handleStartEdit}
              className={`flex-shrink-0 w-auto max-w-[120px] text-right pr-2 text-[10px] font-mono font-semibold transition-colors duration-150 ${
                !isDark ? 'text-neutral-400 hover:text-neutral-900' : 'text-neutral-500 hover:text-neutral-200'
              } cursor-pointer`}
              title={hotkey ? `Hotkey: ${hotkey}` : 'Click to edit hotkey'}>
              <span className="relative flex items-center justify-end w-full h-full">
                {hotkey ? (
                  <span className="transition-opacity duration-150 truncate">{hotkey}</span>
                ) : (
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-0.5 text-[#39d639] pointer-events-none">
                    <BsPencilFill size={11} />
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      </motion.div>
      {contextMenu && (
        <FavoritesContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => {
            setContextMenu(null);
            setIsEditing(false);
            setIsEditingShortcut(false);
            setErrorMessage('');
          }}
          shortcut={shortcut}
          hotkey={hotkey}
          onSaveShortcut={handleSaveShortcut}
          onSaveHotkey={handleSaveHotkey}
          onClearShortcut={() => {
            setEditValue('');
            // Clear shortcut logic
            const type = isLinkCategory ? 'link' : 'note';
            deleteUserShortcutByReference(compoundId);
          }}
          onClearHotkey={handleClearHotkey}
          onToggleFavorite={() => toggleFavorite(snippetId, categoryStr, displayName)}
          isFavorite={true}
          shortcutEditValue={isEditingShortcut ? editValue : normalizeShortcutTrigger(shortcut)}
          onShortcutEditChange={val => {
            setEditValue(val);
            setIsEditingShortcut(true);
            setIsEditing(false);
            setErrorMessage('');
          }}
          hotkeyEditValue={isEditing ? editValue : hotkey}
          onHotkeyEditChange={e => {
            handleHotkeyCapture(e);
            setIsEditing(true);
            setIsEditingShortcut(false);
          }}
          isSaving={isSaving}
          error={errorMessage}
          conflictId={conflictId}
          showSuccess={showSuccess}
          onOverwriteHotkey={handleOverwriteHotkey}
          onOverwriteShortcut={handleOverwriteShortcut}
          onRequestEdit={
            isLinkCategory || isTabGroupCategory
              ? () => {
                  if (onInlineEditLinkClick && itemRef.current) {
                    onInlineEditLinkClick(snippet, itemRef.current);
                  } else if (onRequestEditLink) {
                    onRequestEditLink({ snippet });
                  }
                }
              : undefined
          }
          editLabel={isTabGroupCategory ? 'Edit Tab Session' : 'Edit Link'}
        />
      )}
    </>
  );
};

const FavoriteItem: React.FC<FavoriteItemProps> = props => {
  const { snippet } = props;

  // Check if it's a command
  if ('type' in snippet && snippet.type === 'command') {
    return <CommandFavoriteItem {...props} command={snippet as FavoriteCommand} />;
  }

  // Default to Snippet
  return <SnippetFavoriteItem {...props} snippet={snippet as Snippet} />;
};

export default FavoriteItem;
