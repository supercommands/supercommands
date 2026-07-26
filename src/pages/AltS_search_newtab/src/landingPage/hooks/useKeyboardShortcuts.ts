import { useEffect, useCallback } from 'react';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { extractSnippetIdFromCompoundId } from '../../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { getUserHotkeyByCombination } from '../../../../../shared-components/hotkeys/core/hotkeyDbData';

interface UseKeyboardShortcutsProps {
  setIsViewDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsGlobalCreateMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isKeystrokeRecordingActive: () => boolean;
  searchbarRef: React.MutableRefObject<any>;
}

export const useKeyboardShortcuts = ({
  isKeystrokeRecordingActive,
  searchbarRef,
  setIsViewDropdownOpen,
  setIsGlobalCreateMenuOpen,
}: UseKeyboardShortcutsProps) => {
  const dbNotes = useDbStore(state => state.notes);
  const dbLinks = useDbStore(state => state.links);
  const dbSnippets = useDbStore(state => state.snippets);
  const dbWorkspaces = useDbStore(state => state.workspaces);
  const dbFolders = useDbStore(state => state.folders);
  // Helper function to check if any modal/popup is open
  const isModalOpen = useCallback((): boolean => {
    // Check for modals/popups by looking for common modal classes or fixed overlays
    // This includes EditWorkspaceNamePopup, EditFolderNamePopup, DeleteDialog, etc.
    const modals = document.querySelectorAll('.fixed.inset-0');
    // Also check if activeElement is inside a modal (any element with fixed inset-0 parent)
    const activeElement = document.activeElement;
    if (activeElement) {
      const modalParent = activeElement.closest('.fixed.inset-0');
      if (modalParent) {
        // Check if this modal is actually visible (has opacity > 0 or is in the DOM)
        const style = window.getComputedStyle(modalParent);
        if (style.opacity !== '0' && style.display !== 'none') {
          return true;
        }
      }
    }
    // Check if any visible modal exists
    for (let i = 0; i < modals.length; i++) {
      const modal = modals[i] as HTMLElement;
      const style = window.getComputedStyle(modal);
      if (style.opacity !== '0' && style.display !== 'none') {
        return true;
      }
    }
    return false;
  }, []);

  const findWorkspace = useCallback(
    (workspaceId: string | null | undefined) => {
      if (!workspaceId) return null;
      return dbWorkspaces.find(workspace => String(workspace.id) === String(workspaceId)) ?? null;
    },
    [dbWorkspaces],
  );

  const findFolder = useCallback(
    (folderId: string | null | undefined) => {
      if (!folderId) return null;
      return dbFolders.find(folder => String(folder.id) === String(folderId)) ?? null;
    },
    [dbFolders],
  );

  const openSnippetRecord = useCallback(
    (snippet: any) => {
      const workspace = findWorkspace(snippet?.workspaceId ?? snippet?.workspace_id ?? null);
      const folder = findFolder(snippet?.folderId ?? snippet?.folder_id ?? null);
      useUIStore.getState().setSelectedWorkspaceId(workspace ? workspace.id : null);
      useUIStore.getState().setSelectedFolderId(folder ? folder.id : null);
      useUIStore.getState().viewSnippet({
        snippet,
        breadcrumb: {
          workspace_id: workspace?.id || null,
          workspace_name: workspace?.workspaceName || null,
          folder_id: folder?.id || null,
          folder_name: folder?.folderName || null,
        },
      });
    },
    [findFolder, findWorkspace],
  );

  // Handle ESC key to exit filter mode
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (isKeystrokeRecordingActive()) return;
    };

    window.addEventListener('keydown', handleEscapeKey);
    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, [isModalOpen, isKeystrokeRecordingActive]);

  // Handle global hotkeys for commands, links, and notes (matching AltS logic)
  useEffect(() => {
    const handleHotkeyDown = async (e: KeyboardEvent) => {
      if (isKeystrokeRecordingActive()) return;
      // Check if typing in an input/textarea
      const activeEl = document.activeElement;
      const isInInputField =
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        (activeEl as HTMLElement)?.isContentEditable;

      // Ignore standalone modifier keys
      if (['Control', 'Shift', 'Alt', 'Meta', 'Escape'].includes(e.key)) {
        return;
      }

      // Build pressed hotkey string
      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');

      let keyName = e.key;
      if (keyName === ' ') keyName = 'Space';
      else if (keyName.length === 1) keyName = keyName.toUpperCase();
      else if (keyName === 'ArrowUp') keyName = '?';
      else if (keyName === 'ArrowDown') keyName = '?';
      else if (keyName === 'ArrowLeft') keyName = '?';
      else if (keyName === 'ArrowRight') keyName = '?';

      parts.push(keyName);
      const pressedHotkey = parts.join('+');

      // Skip if no modifier (we don't want single key hotkeys in AltS_search_newtab)
      // This also ensures normal typing in inputs is not intercepted
      if (!e.ctrlKey && !e.altKey && !e.metaKey) return;

      // Skip if typing in input WITHOUT a hotkey modifier combination
      // (Allow Ctrl/Alt+key combos even in input fields for hotkeys)
      // Only skip for common text editing shortcuts that should work in inputs
      if (isInInputField) {
        // Allow standard text editing shortcuts to work in inputs
        const isTextEditShortcut =
          (e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x', 'z', 'y'].includes(e.key.toLowerCase());
        if (isTextEditShortcut) return;
      }

      // Check database hotkeys first (prioritized user-defined DB hotkeys)
      try {
        const dbHotkey = await getUserHotkeyByCombination(pressedHotkey);
        if (dbHotkey) {
          const { referenceId, referenceType } = dbHotkey;

          if (referenceType === 'command') {
            e.preventDefault();
            e.stopPropagation();
            if (referenceId === 'create') {
              setIsViewDropdownOpen(true);
              setIsGlobalCreateMenuOpen(true);
              return;
            }
            if (searchbarRef.current) {
              searchbarRef.current.executeCommand(referenceId as any, { mode: 'lock' });
              searchbarRef.current.focus();
            }
            return;
          }

          if (referenceType === 'note' || referenceType === 'snippet' || (referenceType as string) === 'prompt') {
            e.preventDefault();
            e.stopPropagation();

            // Extract the actual item ID from the compound ID (which could be workspace-folder-noteId) using centralized logic
            const actualId = extractSnippetIdFromCompoundId(referenceId);

            if (referenceType === 'snippet') {
              useUIStore.getState().openEditor({ type: 'note', id: actualId, props: { category: 'snippet' } });
            } else if ((referenceType as string) === 'prompt') {
              useUIStore.getState().openEditor({ type: 'aiPrompt', id: actualId });
            } else {
              useUIStore.getState().openEditor({ type: 'note', id: actualId, props: { category: 'note' } });
            }
            return;
          }

          if (referenceType === 'link' || (referenceType as string) === 'session') {
            e.preventDefault();
            e.stopPropagation();

            const actualId = extractSnippetIdFromCompoundId(referenceId);

            // Trigger the hotkey via background to actually open the URLs in new tabs
            chrome.runtime.sendMessage({
              action: 'trigger_hotkey',
              type: referenceType,
              id: actualId,
            });
            return;
          }

          if (referenceType === 'automation') {
            e.preventDefault();
            e.stopPropagation();
            if (searchbarRef.current) {
              // Pass the reference directly, no need to aggressively filter and cache automations
              searchbarRef.current.activateAutomation({ id: referenceId });
              searchbarRef.current.focus();
            }
            return;
          }

          if (referenceType === 'module') {
            e.preventDefault();
            e.stopPropagation();
            if (searchbarRef.current) {
              searchbarRef.current.executeModule(referenceId);
              searchbarRef.current.focus();
            }
            return;
          }
        }
      } catch (error) {
        console.error('[useKeyboardShortcuts] Failed to check database hotkey:', error);
      }

      // ?? Global System Shortcuts: Ctrl+Q (Quick Search)
      const isCtrlQ = pressedHotkey === 'Ctrl+Q';

      if (isCtrlQ) {
        e.preventDefault();
        e.stopPropagation();

        // Ctrl+Q behavior: Focus search
        setTimeout(() => {
          const input =
            document.getElementById('sheet-search-name') || document.querySelector('input[placeholder*="Search"]');
          if (input instanceof HTMLElement) input.focus();
        }, 100);
        return;
      }
    };

    window.addEventListener('keydown', handleHotkeyDown);
    return () => {
      window.removeEventListener('keydown', handleHotkeyDown);
    };
  }, [isKeystrokeRecordingActive]);

  return { isModalOpen };
};
