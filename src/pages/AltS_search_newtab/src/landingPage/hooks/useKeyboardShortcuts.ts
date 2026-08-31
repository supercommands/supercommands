import { useEffect, useCallback } from 'react';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { extractSnippetIdFromCompoundId } from '../../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { getUserHotkeyByCombination } from '../../../../../shared-components/hotkeys/core/hotkeyDbData';
import { recordAssignedTriggerUsage } from '../../../../../shared-components/triggers';
import {
  hasRunnableAiPrompt,
  runAiPrompt,
} from '../../../../../allObjectFolder/src/createObject/aiPrompt/runAiPrompt';
import { launchDashboardCollectionView } from '../../../../../shared-components/dashboardCollections/launchDashboardCollectionView';
import { getCurrentExtensionTabContext } from '../../../../../shared-components/sessions/launchSessionSmart';
import { launchSessionSmartWithReferences } from '../../../../../allObjectFolder/src/createObject/session/sessionReferenceActions';

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
  const dbAutomations = useDbStore(state => state.automations);
  const dbAiPrompts = useDbStore(state => state.aiPrompts);
  const dbTodos = useDbStore(state => state.todos);
  const dbSessions = useDbStore(state => state.sessions);
  const dbWorkspaces = useDbStore(state => state.workspaces);
  const dbFolders = useDbStore(state => state.folders);
  const dbWidgetViews = useDbStore(state => state.widgetViews);
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

  const recordNewtabHotkeyUsage = useCallback(
    (hotkey: string, referenceId: string, referenceType: string, success = true, errorCode?: string) => {
      const allRecords = [
        ...dbNotes,
        ...dbLinks,
        ...dbSnippets,
        ...dbAutomations,
        ...dbAiPrompts,
        ...dbTodos,
        ...dbSessions,
        ...dbWidgetViews,
      ] as any[];
      const actualId = extractSnippetIdFromCompoundId(referenceId);
      const entity = allRecords.find(record => String(record?.id || record?.snippet_id || '') === actualId);
      recordAssignedTriggerUsage({
        triggerKind: 'user_hotkey',
        triggerValue: hotkey,
        triggerSource: 'hotkey',
        referenceId,
        referenceType,
        surface: 'newtab',
        success,
        errorCode,
        targetLabelSnapshot: entity?.title || entity?.name || entity?.key || referenceId,
        triggerLabelSnapshot: hotkey,
      }).catch(err => console.warn('[useKeyboardShortcuts] Failed to record hotkey usage:', err));
    },
    [dbAiPrompts, dbAutomations, dbLinks, dbNotes, dbSessions, dbSnippets, dbTodos, dbWidgetViews],
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

  const launchCollectionViewById = useCallback(
    async (referenceId: string) => {
      return launchDashboardCollectionView(referenceId, { mode: 'open' });
    },
    [],
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
              recordNewtabHotkeyUsage(pressedHotkey, referenceId, referenceType);
              return;
            }
            if (searchbarRef.current) {
              searchbarRef.current.executeCommand(referenceId as any, { mode: 'lock' });
              searchbarRef.current.focus();
              recordNewtabHotkeyUsage(pressedHotkey, referenceId, referenceType);
            }
            return;
          }

          const normalizedReferenceType = String(referenceType || '').toLowerCase();
          if (
            referenceType === 'note' ||
            referenceType === 'snippet' ||
            ['prompt', 'aiprompt', 'ai_prompt'].includes(normalizedReferenceType)
          ) {
            e.preventDefault();
            e.stopPropagation();

            // Extract the actual item ID from the compound ID (which could be workspace-folder-noteId) using centralized logic
            const actualId = extractSnippetIdFromCompoundId(referenceId);

            if (referenceType === 'snippet') {
              useUIStore.getState().openEditor({ type: 'note', id: actualId, props: { category: 'snippet' } });
            } else if (['prompt', 'aiprompt', 'ai_prompt'].includes(normalizedReferenceType)) {
              const promptRecord = dbAiPrompts.find(prompt => String(prompt.id) === String(actualId));
              if (promptRecord && hasRunnableAiPrompt(promptRecord)) {
                try {
                  await runAiPrompt(promptRecord);
                } catch (error) {
                  console.error('[useKeyboardShortcuts] Failed to run AI prompt:', error);
                }
              } else {
                useUIStore.getState().openEditor({ type: 'aiPrompt', id: actualId });
              }
            } else {
              useUIStore.getState().openEditor({ type: 'note', id: actualId, props: { category: 'note' } });
            }
            recordNewtabHotkeyUsage(pressedHotkey, referenceId, referenceType);
            return;
          }

          if (['collection', 'collections', 'collection_view'].includes(normalizedReferenceType)) {
            e.preventDefault();
            e.stopPropagation();
            try {
              const didLaunch = await launchCollectionViewById(referenceId);
              recordNewtabHotkeyUsage(
                pressedHotkey,
                referenceId,
                referenceType,
                didLaunch,
                didLaunch ? undefined : 'collection_view_not_found',
              );
            } catch (error) {
              console.error('[useKeyboardShortcuts] Failed to launch collection view hotkey:', error);
              recordNewtabHotkeyUsage(pressedHotkey, referenceId, referenceType, false, 'collection_view_launch_failed');
            }
            return;
          }

          if ((referenceType as string) === 'session') {
            e.preventDefault();
            e.stopPropagation();

            const actualId = extractSnippetIdFromCompoundId(referenceId);
            const session = dbSessions.find(item => String(item.id) === String(actualId));
            if (!session) {
              recordNewtabHotkeyUsage(pressedHotkey, referenceId, referenceType, false, 'entity_not_found');
              return;
            }

            const response = await launchSessionSmartWithReferences(session, {
              source: 'hotkey',
              requireAutoSave: false,
            });
            recordNewtabHotkeyUsage(
              pressedHotkey,
              referenceId,
              referenceType,
              response?.ok && !response?.skipped,
              response?.skipped ? response.reason : response?.ok ? undefined : response?.error || 'session_launch_failed',
            );
            return;
          }

          if (referenceType === 'link') {
            e.preventDefault();
            e.stopPropagation();

            const actualId = extractSnippetIdFromCompoundId(referenceId);
            const currentTabContext = await getCurrentExtensionTabContext();

            // Trigger the hotkey via background to actually open the URLs in new tabs
            chrome.runtime.sendMessage({
              action: 'trigger_hotkey',
              type: referenceType,
              id: actualId,
              ...currentTabContext,
              triggerUsage: {
                triggerKind: 'user_hotkey',
                triggerValue: pressedHotkey,
                triggerSource: 'hotkey',
                surface: 'newtab',
                referenceId,
                referenceType,
                correlationId: `newtab_hotkey_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              },
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
              recordNewtabHotkeyUsage(pressedHotkey, referenceId, referenceType);
            }
            return;
          }

          if (referenceType === 'module') {
            e.preventDefault();
            e.stopPropagation();
            if (searchbarRef.current) {
              searchbarRef.current.executeModule(referenceId);
              searchbarRef.current.focus();
              recordNewtabHotkeyUsage(pressedHotkey, referenceId, referenceType);
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
  }, [isKeystrokeRecordingActive, launchCollectionViewById, recordNewtabHotkeyUsage, setIsGlobalCreateMenuOpen, setIsViewDropdownOpen, searchbarRef, dbAiPrompts, dbSessions]);

  return { isModalOpen };
};
