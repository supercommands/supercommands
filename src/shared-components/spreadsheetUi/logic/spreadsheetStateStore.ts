import type { RowData, GridRow } from '../types/spreadsheetTypes';
import { extractUrlsFromSnippet } from '../../../allObjectFolder/src/createObject/snippets/SnippetClickActions';
import {
  createNote,
  updateNote,
  deleteNote,
} from '../../../allObjectFolder/src/createObject/notes/noteData';
import {
  createSnippet,
  updateSnippet,
  deleteSnippet,
} from '../../../allObjectFolder/src/createObject/snippets/snippetData';
import { addFavoriteRecord, removeFavoriteRecord } from '../../../shared-components/favorites/favoriteData';
import {
  createLink,
  updateLink,
  deleteLink,
} from '../../../allObjectFolder/src/createObject/links/linkData';
import {
  updateAutomation as updateAutomationRecord,
  deleteAutomation,
} from '../../../allObjectFolder/src/createObject/automationBeta/automationData';
import { updateChatAgent, deleteChatAgent } from '../../../allObjectFolder/src/createObject/ChatAgent/chatAgentData';
import { updateAiPrompt, deleteAiPrompt } from '../../../allObjectFolder/src/createObject/aiPrompt/aiPromptData';
import { updateTodoContent } from '../../../allObjectFolder/src/createObject/todos/todoData';
import {
  createSession,
  updateSession,
  deleteSession,
} from '../../../allObjectFolder/src/createObject/session/sessionData';
import { saveUserHotkey, deleteUserHotkeyByReference } from '../../../shared-components/hotkeys/core/hotkeyDbData';
import { saveUserShortcut, deleteUserShortcutByReference, normalizeShortcutTrigger } from '../../../shared-components/shortcuts/core/shortcutDbData';
import { getUserHotkey } from '../../../shared-components/hotkeys';
import { getUserShortcut } from '../../../shared-components/shortcuts';
import { useUIStore } from '../../../shared-components/uiStateManager';
import { getUserId } from '../../../storage/API/core/api';
import { create } from 'zustand';
import { resolveCommandLookupKey, isCommandId } from '../../../shared-components/commands';
import { useDbStore } from '../../../storage/store/useDbStore';
import { db } from '../../../storage/indexDB/dbConfig';
import { syncCommandsFromSource } from '../../../allObjectFolder/src/createObject/commands/commandData';
import { generateEntityId } from '../../../shared-components/utils/idGenerator';
import type { NoteRecord } from '../../../allObjectFolder/src/createObject/notes/noteTypes';
import type { LinkRecord } from '../../../allObjectFolder/src/createObject/links/linkTypes';
import type { SnippetRecord } from '../../../allObjectFolder/src/createObject/snippets/snippetTypes';
import type { WorkspaceData } from '../../../settings/allWorkspaceManager/workspaces/workspaceTypes';
import type { FolderData } from '../../../settings/allWorkspaceManager/folders/folderTypes';
import {
  extractSnippetIdFromCompoundId,
  getItemCompoundId,
} from '../../../shared-components/hotkeys/utils/hotkeyUtils';


const updateHotkeyAndRefresh = async (referenceId: string, hotkey: string) => {
  await useDbStore.getState().updateCommandRecord(referenceId, { hotkey: hotkey || '' });
};

const updateCommandAndRefresh = async (referenceId: string, payload: { prefix?: string }) => {
  await useDbStore.getState().updateCommandRecord(referenceId, { prefix: payload.prefix ?? '' });
};

const addFavorite = async (userId: string, reference: { id: string }, referenceType: string, label?: string) =>
  addFavoriteRecord(userId, reference.id, referenceType, label);

const deleteFavorite = async (userId: string, favIdOrReferenceId: any) =>
  removeFavoriteRecord(userId, String(favIdOrReferenceId));

const deleteLinkCompat = async (linkId: string) => deleteLink(String(linkId));

const deleteSnippetCompat = async (_folderId: string | undefined, snippetId: string) => deleteSnippet(snippetId);

const invalidateHotkeyCache = () => {
  const chromeAny = (window as any)?.chrome;
  if (chromeAny?.runtime?.sendMessage) {
    chromeAny.runtime.sendMessage({ action: 'INVALIDATE_HOTKEYS_CACHE' }).catch(() => {});
  }
};
export const isTagSupportedRow = (row: any): boolean => {
  if (!row) return false;
  const cat = String(row.category || '').toLowerCase();
  const section = String(row.section || '').toLowerCase();
  const itemType = String(row.itemType || '').toLowerCase();

  if (
    cat === 'commands' ||
    cat === 'general_commands' ||
    cat === 'command' ||
    section.includes('browser command') ||
    section.includes('system command') ||
    cat === 'bookmark' ||
    cat === 'bookmarks' ||
    section.includes('bookmark') ||
    cat === 'module' ||
    section.includes('installed modules')
  ) {
    return false;
  }

  return (
    cat === 'note' ||
    section.includes('note') ||
    itemType === 'note' ||
    cat === 'link' ||
    section.includes('link') ||
    itemType === 'link' ||
    cat === 'session' ||
    section.includes('session') ||
    section.includes('collection') ||
    itemType === 'session' ||
    cat === 'snippet' ||
    section.includes('snippet') ||
    section.includes('text expander') ||
    itemType === 'snippet' ||
    cat === 'todo' ||
    section.includes('todo') ||
    itemType === 'todo' ||
    cat === 'aiprompt' ||
    cat === 'ai_prompt' ||
    cat === 'prompt' ||
    section.includes('ai prompt') ||
    itemType === 'aiprompt' ||
    cat === 'chatagent' ||
    cat === 'chat_agent' ||
    cat === 'agent' ||
    section.includes('chat agent') ||
    itemType === 'agent' ||
    cat === 'automation' ||
    section.includes('automation') ||
    itemType === 'automation'
  );
};

export type CellPosition = {
  rowIndex: number;
  colIndex: number;
};

interface GridState {
  selectedCell: CellPosition | null;
  editingCell: CellPosition | null;
  tableData: GridRow[];
  columnCount: number;
  isPickerOpen: boolean;
  pickerRowIndex: number | null;
  visibilityFilter: string[];
  categoryFilter: string[];
  searchTerm: string;
  isSaving: boolean;
  showSuccess: boolean;
  showFavoritesOnly: boolean;
  showHotkeysOnly: boolean;
  showShortcutsOnly: boolean;
  showTagsOnly: boolean;
  spaceFilter: string[];
  isFilterMenuOpen: boolean;

  expandedEmptySections: boolean;
  isEmbedded: boolean;
  setFilterMenuOpen: (open: boolean) => void;
  setIsEmbedded: (val: boolean) => void;

  setSelectedCell: (cell: CellPosition | null) => void;
  setEditingCell: (cell: CellPosition | null) => void;
  setTableData: (data: GridRow[]) => void;
  setColumnCount: (count: number) => void;
  addRow: (section: string, initialData?: Partial<RowData>) => void;
  removeRow: (rowId: string) => void;
  updateCellData: (
    rowId: string,
    colIndex: number,
    columnId: string,
    value: any
  ) => void;
  updateRowTags: (rowId: string, tagIds: string[]) => Promise<void>;
  overwriteCellData: (
    rowId: string,
    colIndex: number,
    columnId: string,
    value: any,
    conflictId: string
  ) => void;
  updateRowLocation: (
    rowId: string,
    wsId: string,
    fId: string | null
  ) => void;
  syncRealNotes: (
    notes: NoteRecord[],
    links: LinkRecord[],
    snippets: SnippetRecord[],
    workspaces: WorkspaceData[],
    folders: FolderData[],
    userId: string,
    favorites: any[],
    hotkeysMap: Record<string, string>,
    shortcutsMap: Record<string, string>,
    automations: any[],
    agents: any[],
    bookmarks: any[],
  ) => void;

  toggleEmptySections: () => void;

  openPicker: (rowId: string) => void;

  columnFilters: Record<string, string>;
  setColumnFilter: (columnId: string, value: string) => void;

  closePicker: () => void;
  toggleFavorite: (rowId: string) => void;

  setCategoryFilter: (filter: string[]) => void;
  setVisibilityFilter: (filter: string[]) => void;
  setSearchTerm: (term: string) => void;
  setIsSaving: (val: boolean) => void;
  setShowSuccess: (val: boolean) => void;
  setShowFavoritesOnly: (val: boolean) => void;
  setShowHotkeysOnly: (val: boolean) => void;
  setShowShortcutsOnly: (val: boolean) => void;
  setShowTagsOnly: (val: boolean) => void;
  setSpaceFilter: (filter: string[]) => void;
  targetSection: string | null;
  setTargetSection: (section: string | null) => void;
  collapsedSections: string[];
  toggleSection: (title: string) => void;
  expandedCategories: string[];
  toggleCategory: (categoryId: string) => void;
  setRowStatus: (rowId: string, status: 'idle' | 'syncing' | 'saved' | 'error', message?: string) => void;
  commitRowToBackend: (rowId: string, noChange?: boolean) => Promise<void>;
  quickAddModal: { isOpen: boolean; type: 'note' | 'link' | 'snippet' | null };
  setQuickAddModal: (type: 'note' | 'link' | 'snippet' | null) => void;

  undoDelete: (rowId: string) => void;
  lastSyncArgs?: any;
}

export const useSpreadsheetStore = create<GridState>((set, get) => ({
  selectedCell: null, // Start unselected so main search bar gets focus
  editingCell: null,
  tableData: [
    { type: 'section', title: 'Smart Links' },
    { type: 'section', title: 'Tab Sessions' },
    { type: 'section', title: 'Notes' },
    { type: 'section', title: 'Snippets' },
    { type: 'section', title: 'Todos' },
    { type: 'section', title: 'Browser Commands' },
    { type: 'section', title: 'Saved Automations' },
    { type: 'section', title: 'Chat Agents' },
    { type: 'section', title: 'System Commands' },
  ],

  columnCount: 7,
  isPickerOpen: false,
  pickerRowIndex: null,
  categoryFilter: ['all'],
  visibilityFilter: ['all'],
  searchTerm: '',
  columnFilters: {},
  isSaving: false,
  showSuccess: false,
  showFavoritesOnly: false,
  showHotkeysOnly: false,
  showShortcutsOnly: false,
  showTagsOnly: false,
  spaceFilter: ['all'],
  collapsedSections: [],
  expandedCategories: [],
  expandedEmptySections: false,
  targetSection: null,
  isEmbedded: false,
  quickAddModal: { isOpen: false, type: null },

  setIsEmbedded: (val: boolean) => set({ isEmbedded: val }),
  setSelectedCell: cell => set({ selectedCell: cell }),
  setTargetSection: section => set({ targetSection: section }),
  setEditingCell: cell => set({ editingCell: cell }),
  setTableData: data => set({ tableData: data }),
  setColumnCount: count => set({ columnCount: count }),
  setCategoryFilter: filter => set({ categoryFilter: filter }),
  setVisibilityFilter: filter => set({ visibilityFilter: filter }),
  setSearchTerm: term => set({ searchTerm: term }),
  setColumnFilter: (columnId, value) =>
    set(state => ({
      columnFilters: { ...state.columnFilters, [columnId]: value },
    })),
  setIsSaving: val => set({ isSaving: val }),
  setShowFavoritesOnly: val => set({ showFavoritesOnly: val }),
  setShowHotkeysOnly: val => set({ showHotkeysOnly: val }),
  setShowShortcutsOnly: val => set({ showShortcutsOnly: val }),
  setShowTagsOnly: val => set({ showTagsOnly: val }),
  setSpaceFilter: filter => set({ spaceFilter: filter }),

  setQuickAddModal: type => set({ quickAddModal: { isOpen: !!type, type } }),
  setShowSuccess: val => {
    set({ showSuccess: val });
    if (val) setTimeout(() => set({ showSuccess: false }), 1200);
  },
  openPicker: rowId => {
    const state = useSpreadsheetStore.getState();
    const index = state.tableData.findIndex(r => r.type === 'data' && r.id === rowId);
    if (index !== -1) {
      set({ isPickerOpen: true, pickerRowIndex: index });
    }
  },
  closePicker: () => set({ isPickerOpen: false, pickerRowIndex: null }),

  toggleSection: title =>
    set(state => {
      const isCollapsed = state.collapsedSections.includes(title);
      if (isCollapsed) {
        return { collapsedSections: state.collapsedSections.filter(s => s !== title) };
      } else {
        return { collapsedSections: [...state.collapsedSections, title] };
      }
    }),
  toggleEmptySections: () => set(state => ({ expandedEmptySections: !state.expandedEmptySections })),
  toggleCategory: categoryId =>
    set(state => {
      const isExpanded = state.expandedCategories.includes(categoryId);
      if (isExpanded) {
        return { expandedCategories: state.expandedCategories.filter(id => id !== categoryId) };
      } else {
        return { expandedCategories: [...state.expandedCategories, categoryId] };
      }
    }),
  setRowStatus: (rowId, status, message) =>
    set(state => {
      const index = state.tableData.findIndex(r => r.type === 'data' && r.id === rowId);
      if (index === -1) return state;
      const nd = [...state.tableData];
      if (nd[index] && nd[index].type === 'data') {
        nd[index] = { ...nd[index], syncStatus: status, syncMessage: message } as any;
      }
      return { tableData: nd };
    }),

  toggleFavorite: (rowId: string) => {
    const state = useSpreadsheetStore.getState();
    const row = state.tableData.find(r => r.type === 'data' && r.id === rowId) as RowData;
    if (row) {
      const isFav = !row.fav;

      set(s => {
        const nd = [...s.tableData];
        const idx = nd.findIndex(r => r.type === 'data' && r.id === rowId);
        if (idx !== -1 && nd[idx].type === 'data') {
          if (row.isReal) {
            nd[idx] = {
              ...nd[idx],
              syncStatus: 'syncing',
              favAction: isFav ? 'adding' : 'removing',
            } as any;
          } else {
            nd[idx] = {
              ...nd[idx],
              fav: isFav,
            } as any;
          }
        }
        return { tableData: nd };
      });

      if (row.isReal) {
        (async () => {
          const userId = await getUserId();
          const compoundId = getItemCompoundId(row);

          if (isFav) {
            try {
              const state = get();
              const chromeAny = (window as any).chrome;
              let response: any = { favourite_id: generateEntityId('favorite') };
              let apiType: 'snippet' | 'automation' | 'agent' | 'command' | 'module' | 'session' = 'snippet';
              if (row.category === 'automation') apiType = 'automation';
              else if (row.category === 'agent') apiType = 'agent';
              else if (row.category === 'module') apiType = 'module';
              else if (row.category === 'session' || (row.category || '').toLowerCase() === 'tab session') apiType = 'session';
              else if (row.category === 'link' || row.category === 'note' || row.category === 'snippet') apiType = 'snippet';

              if (state.isEmbedded && chromeAny?.runtime?.sendMessage) {
                chromeAny.runtime.sendMessage({
                  action: 'db_toggle_favorite',
                  userId,
                  referenceId: compoundId,
                  referenceType: apiType,
                });
              } else {
                response = await addFavorite(
                  userId,
                  {
                    id: compoundId
                  } as any,
                  apiType,
                );
              }

              set(s => {
                const nd = [...s.tableData];
                const idx = nd.findIndex(r => r.type === 'data' && r.id === rowId);
                if (idx !== -1 && nd[idx].type === 'data') {
                  nd[idx] = {
                    ...nd[idx],
                    favourite_id: response?.favourite_id || generateEntityId('favorite'),
                    syncStatus: 'saved',
                    favAction: 'adding',
                    fav: true,
                  } as any;
                }
                return { tableData: nd };
              });
              await new Promise(res => setTimeout(res, 3000));
            } catch (e) {
              console.error('[gridStore] Add Favorite Failed:', e);
              set(s => {
                const nd = [...s.tableData];
                const idx = nd.findIndex(r => r.type === 'data' && r.id === rowId);
                if (idx !== -1 && nd[idx].type === 'data') {
                  nd[idx] = {
                    ...nd[idx],
                    syncStatus: 'idle',
                    favAction: undefined,
                    fav: false,
                  } as any;
                }
                return { tableData: nd };
              });
            }
          } else {
            try {
              const state = get();
              const chromeAny = (window as any).chrome;
              
              let apiType: 'snippet' | 'automation' | 'agent' | 'command' | 'module' | 'session' = 'snippet';
              if (row.category === 'automation') apiType = 'automation';
              else if (row.category === 'agent') apiType = 'agent';
              else if (row.category === 'module') apiType = 'module';
              else if (row.category === 'session' || (row.category || '').toLowerCase() === 'tab session') apiType = 'session';
              else if (row.category === 'link' || row.category === 'note' || row.category === 'snippet') apiType = 'snippet';

              if (state.isEmbedded && chromeAny?.runtime?.sendMessage) {
                chromeAny.runtime.sendMessage({
                  action: 'db_toggle_favorite',
                  userId,
                  referenceId: compoundId,
                  referenceType: apiType,
                });
              } else {
                await deleteFavorite(userId, compoundId);
                await deleteFavorite(userId, row.id);
              }

              set(s => {
                const nd = [...s.tableData];
                const idx = nd.findIndex(r => r.type === 'data' && r.id === rowId);
                if (idx !== -1 && nd[idx].type === 'data') {
                  nd[idx] = {
                    ...nd[idx],
                    favourite_id: undefined,
                    syncStatus: 'saved',
                    favAction: 'removing',
                    fav: false,
                  } as any;
                }
                return { tableData: nd };
              });
              await new Promise(res => setTimeout(res, 3000));
            } catch (e) {
              console.error('[gridStore] Delete Favorite Failed:', e);
              set(s => {
                const nd = [...s.tableData];
                const idx = nd.findIndex(r => r.type === 'data' && r.id === rowId);
                if (idx !== -1 && nd[idx].type === 'data') {
                  nd[idx] = {
                    ...nd[idx],
                    syncStatus: 'idle',
                    favAction: undefined,
                  } as any;
                }
                return { tableData: nd };
              });
            }
          }

          set(s => {
            const nd = [...s.tableData];
            const idx = nd.findIndex(r => r.type === 'data' && r.id === rowId);
            if (idx !== -1 && nd[idx].type === 'data') {
              nd[idx] = {
                ...nd[idx],
                syncStatus: 'idle',
                favAction: undefined,
              } as any;
            }
            return { tableData: nd, isSaving: false };
          });
        })();
      }
    }
  },

  addRow: (section, initialData) =>
    set(state => {
      const newRow: GridRow = {
        type: 'data',
        id: generateEntityId('spreadsheetRow'),
        name: '',
        url: '',
        folder: '',
        fav: false,
        key: '',
        command: '',
        section,
        ...initialData,
      };

      const newData = [...state.tableData];
      const sectionIndex = newData.findIndex(r => r.type === 'section' && r.title === section);

      if (sectionIndex !== -1) {
        newData.splice(sectionIndex + 1, 0, newRow);
      } else {
        newData.push(newRow);
      }

      return { tableData: newData };
    }),

  removeRow: async (rowId: string) => {
    const state = useSpreadsheetStore.getState();
    const index = state.tableData.findIndex(r => (r.type === 'data' || r.type === 'automationModule') && r.id === rowId);
    if (index === -1) return;

    set(state => {
      const newData = [...state.tableData];
      const i = newData.findIndex(r => (r.type === 'data' || r.type === 'automationModule') && (r as any).id === rowId);
      if (i !== -1) {
        const timer = setTimeout(() => {
          const finalState = useSpreadsheetStore.getState();
          const finalIndex = finalState.tableData.findIndex(
            r => (r.type === 'data' || r.type === 'automationModule') && (r as any).id === rowId,
          );
          if (finalIndex === -1) return;

          const finalRow = finalState.tableData[finalIndex] as RowData;
          if (finalRow.isDeleting) {
            (async () => {
              try {
                if (
                  finalRow.section === 'Smart Links' ||
                  finalRow.section === 'Tab Sessions' ||
                  finalRow.section === 'Notes' ||
                  finalRow.section === 'Snippets'
                ) {
                  if (finalRow.section === 'Smart Links') {
                    await deleteLinkCompat(finalRow.id);
                  } else if (finalRow.section === 'Tab Sessions') {
                    await deleteSession(finalRow.id);
                  } else if (finalRow.section === 'Notes') {
                    await deleteNote(String(finalRow.id));
                  } else {
                    await deleteSnippetCompat(finalRow.folder_id || undefined, finalRow.id);
                  }
                } else if (
                  finalRow.section === 'Saved Automations' ||
                  finalRow.section === 'Chat Agents' ||
                  finalRow.section === 'AI Prompts' ||
                  (finalRow as any).category === 'agent' ||
                  (finalRow as any).category === 'aiPrompt' ||
                  (finalRow as any).category === 'automation' ||
                  (finalRow as any).itemType === 'agent' ||
                  (finalRow as any).itemType === 'aiPrompt' ||
                  (finalRow as any).itemType === 'automation'
                ) {
                  try {
                    await deleteChatAgent(finalRow.id);
                  } catch (e) {}
                  try {
                    await deleteAiPrompt(finalRow.id);
                  } catch (e) {}
                  try {
                    await deleteAutomation(finalRow.id);
                  } catch (e) {}
                } else if (finalRow.section === 'Bookmarks' || (finalRow as any).category === 'bookmark') {
                  const bookmarkId = finalRow.id.replace('bm-', '');
                  const chromeAny = (window as any)?.chrome;
                  if (chromeAny?.bookmarks?.remove) {
                    chromeAny.bookmarks.remove(bookmarkId, () => {});
                  } else if (chromeAny?.runtime?.sendMessage) {
                    chromeAny.runtime.sendMessage({ action: 'bookmarks_remove', id: bookmarkId }, () => {});
                  }
                }
                invalidateHotkeyCache();
              } catch (e) {
                console.error('Backend delete failed:', e);
              }
            })();

            set(s => ({
              tableData: s.tableData.filter(r => (r as any).id !== rowId),
            }));
          }
        }, 3000);

        newData[i] = { ...newData[i], isDeleting: true, deleteTimer: timer } as any;
      }
      return { tableData: newData };
    });
  },

  undoDelete: (rowId: string) => {
    set(state => {
      const newData = [...state.tableData];
      const i = newData.findIndex(r => (r as any).id === rowId);
      if (i !== -1 && (newData[i] as any).isDeleting) {
        clearTimeout((newData[i] as any).deleteTimer);
        newData[i] = { ...newData[i], isDeleting: false, deleteTimer: undefined } as any;
      }
      return { tableData: newData };
    });
  },

  updateCellData: (rowId, colIndex, columnId, value) => {
    const state = useSpreadsheetStore.getState();

    const index = state.tableData.findIndex(
      r => (r.type === 'data' || r.type === 'automationModule') && r.id === rowId,
    );
    if (index === -1) return;

    const newData = [...state.tableData];
    const row = newData[index];
    if (!row || (row.type !== 'data' && row.type !== 'automationModule')) return;

    let noChange = false;
    const isTextContent =
      row.section === 'Notes' || row.section === 'Snippets';

    if (columnId === 'name') {
      if (row.name === value) noChange = true;
      row.name = value;
    } else if (columnId === 'url') {
      if (isTextContent) {
        if (row.value === value) noChange = true;
        row.value = value;
      } else {
        if (row.url === value) noChange = true;
        row.url = value;
        try {
          if (value.trim().startsWith('{') || value.trim().startsWith('[')) {
            const parsed = JSON.parse(value);
            if (parsed.urls) row.urls = parsed.urls;
          } else {
            row.urls = value.trim() ? [value.trim()] : [];
          }
        } catch (e) {
          row.urls = value.trim() ? [value.trim()] : [];
        }
      }
    } else if (columnId === 'folder' || columnId === 'path') {
      if (row.path === value) noChange = true;
      row.path = value;
    } else if (columnId === 'key') {
      if (row.key === value) noChange = true;
      row.key = value;
    } else if (columnId === 'command') {
      if (row.command === value) noChange = true;
      row.command = value;
    } else if (columnId === 'value') {
      if (row.value === value) noChange = true;
      row.value = value;
    } else if (columnId === 'automationData') {
      row.automationData = value;
    }

    // Set editAction for feedback
    if (columnId === 'key') row.editAction = 'hotkey';
    else if (columnId === 'command') row.editAction = 'command';
    else if (columnId === 'name') row.editAction = 'name';
    else if (columnId === 'value' || columnId === 'url') row.editAction = 'value';
    else if (columnId === 'automationData') row.editAction = 'automation';

    set({ tableData: newData });
    state.commitRowToBackend(rowId, noChange);
  },

  updateRowTags: async (rowId: string, tagIds: string[]) => {
    const state = useSpreadsheetStore.getState();
    const index = state.tableData.findIndex(
      r => (r.type === 'data' || r.type === 'automationModule') && r.id === rowId
    );
    if (index === -1) return;

    const newData = [...state.tableData];
    const row = newData[index] as any;
    if (!row) return;

    const normalizedTagIds = Array.from(new Set(tagIds.filter(Boolean)));
    const prevTagIds = row.tagIds || [];

    // Optimistic UI update
    row.tagIds = normalizedTagIds;
    row.syncStatus = 'syncing';
    row.syncMessage = 'Syncing tags...';
    set({ tableData: newData });

    try {
      const chromeAny = (window as any).chrome;
      const isEmbedded = state.isEmbedded;
      const cat = String(row.category || '').toLowerCase();
      const section = String(row.section || '').toLowerCase();
      const itemType = String(row.itemType || '').toLowerCase();

      if (section === 'Notes' || cat === 'note' || itemType === 'note') {
        const notePayload = {
          title: row.name || '',
          body: row.value || '',
          workspaceId: row.workspace_id || row.workspaceId || null,
          folderId: row.folder_id ?? row.folderId ?? null,
          tagIds: normalizedTagIds,
        };
        if (isEmbedded && chromeAny?.runtime?.sendMessage) {
          await new Promise((resolve, reject) => {
            chromeAny.runtime.sendMessage(
              { action: 'db_update_note', noteId: String(row.id), input: notePayload },
              (res: any) => {
                if (chromeAny.runtime.lastError) return reject(chromeAny.runtime.lastError);
                if (!res || !res.success) return reject(res?.error || 'Failed to update note tags');
                resolve(res.note);
              }
            );
          });
        } else {
          await updateNote(String(row.id), notePayload as any);
        }
      } else if (section === 'Smart Links' || cat === 'link' || itemType === 'link') {
        const existingLink = useDbStore.getState().links.find(l => l.id === row.id);
        const linkPayload = {
          title: row.name || '',
          urls: row.urls || existingLink?.urls || (row.url ? [{ id: generateEntityId('linkItem'), url: row.url, title: row.name || '', source: 'link' }] : []),
          workspaceId: row.workspace_id || row.workspaceId || null,
          folderId: row.folder_id ?? row.folderId ?? null,
          tagIds: normalizedTagIds,
        };
        if (isEmbedded && chromeAny?.runtime?.sendMessage) {
          await new Promise((resolve, reject) => {
            chromeAny.runtime.sendMessage(
              { action: 'db_update_link', linkId: String(row.id), input: linkPayload },
              (res: any) => {
                if (chromeAny.runtime.lastError) return reject(chromeAny.runtime.lastError);
                if (!res || !res.success) return reject(res?.error || 'Failed to update link tags');
                resolve(res.link);
              }
            );
          });
        } else {
          await updateLink(String(row.id), linkPayload as any);
        }
      } else if (section === 'Tab Sessions' || cat === 'session' || itemType === 'session') {
        const sessionPayload = {
          title: row.name || '',
          urls: Array.isArray(row.urls) ? row.urls : (row.value ? JSON.parse(row.value).urls : []),
          workspaceId: row.workspace_id || row.workspaceId || null,
          folderId: row.folder_id ?? row.folderId ?? null,
          tagIds: normalizedTagIds,
        };
        if (isEmbedded && chromeAny?.runtime?.sendMessage) {
          await new Promise((resolve, reject) => {
            chromeAny.runtime.sendMessage(
              { action: 'db_update_session', sessionId: String(row.id), input: sessionPayload },
              (res: any) => {
                if (chromeAny.runtime.lastError) return reject(chromeAny.runtime.lastError);
                if (!res || !res.success) return reject(res?.error || 'Failed to update session tags');
                resolve(res.session);
              }
            );
          });
        } else {
          await updateSession(String(row.id), sessionPayload as any);
        }
      } else if (section === 'Snippets' || cat === 'snippet' || itemType === 'snippet') {
        const snippetPayload = {
          title: row.name || '',
          config: typeof row.value === 'string' ? row.value : JSON.stringify(row.value || ''),
          workspaceId: row.workspace_id || row.workspaceId || null,
          folderId: row.folder_id ?? row.folderId ?? null,
          tagIds: normalizedTagIds,
        };
        if (isEmbedded && chromeAny?.runtime?.sendMessage) {
          await new Promise((resolve, reject) => {
            chromeAny.runtime.sendMessage(
              { action: 'db_update_snippet', snippetId: String(row.id), input: snippetPayload },
              (res: any) => {
                if (chromeAny.runtime.lastError) return reject(chromeAny.runtime.lastError);
                if (!res || !res.success) return reject(res?.error || 'Failed to update snippet tags');
                resolve(res.snippet);
              }
            );
          });
        } else {
          await updateSnippet(String(row.id), snippetPayload as any);
        }
      } else if (section === 'Todos' || cat === 'todo' || itemType === 'todo') {
        const dbTags = useDbStore.getState().tags || [];
        const resolvedTagRecords = dbTags.filter(t => normalizedTagIds.includes(t.id));
        await updateTodoContent(String(row.id), {
          tagIds: normalizedTagIds,
          tags: resolvedTagRecords.map(t => t.name),
        } as any);
      } else if (section === 'AI Prompts' || cat === 'aiprompt' || cat === 'ai_prompt' || cat === 'prompt' || itemType === 'aiprompt') {
        await updateAiPrompt(String(row.id), { tagIds: normalizedTagIds } as any);
      } else if (section === 'Chat Agents' || cat === 'chatagent' || cat === 'chat_agent' || cat === 'agent' || itemType === 'agent') {
        await updateChatAgent(String(row.id), { tagIds: normalizedTagIds } as any);
      } else if (section === 'My Saved Automations' || cat === 'automation' || itemType === 'automation') {
        const userId = await getUserId();
        await updateAutomationRecord(userId, { automation_id: String(row.id), tagIds: normalizedTagIds } as any);
        await (db.automations.update as any)(String(row.id), { tagIds: normalizedTagIds, updatedAt: Date.now() });
      }

      // Success
      set(s => {
        const nd = [...s.tableData];
        const freshIndex = nd.findIndex(r => (r as any).id === rowId);
        if (freshIndex !== -1 && (nd[freshIndex].type === 'data' || nd[freshIndex].type === 'automationModule')) {
          (nd[freshIndex] as any).syncStatus = 'saved';
          (nd[freshIndex] as any).syncMessage = 'Tags Saved';
        }
        return { tableData: nd };
      });

      setTimeout(() => {
        set(s => {
          const nd = [...s.tableData];
          const freshIndex = nd.findIndex(r => (r as any).id === rowId);
          if (freshIndex !== -1 && (nd[freshIndex].type === 'data' || nd[freshIndex].type === 'automationModule')) {
            (nd[freshIndex] as any).syncStatus = 'idle';
            (nd[freshIndex] as any).syncMessage = undefined;
          }
          return { tableData: nd };
        });
      }, 2000);
    } catch (err) {
      console.error('[updateRowTags] Tag update failed:', err);
      // Rollback optimistic update
      set(s => {
        const nd = [...s.tableData];
        const freshIndex = nd.findIndex(r => (r as any).id === rowId);
        if (freshIndex !== -1 && (nd[freshIndex].type === 'data' || nd[freshIndex].type === 'automationModule')) {
          (nd[freshIndex] as any).tagIds = prevTagIds;
          (nd[freshIndex] as any).syncStatus = 'error';
          (nd[freshIndex] as any).syncMessage = 'Tag Save Failed';
        }
        return { tableData: nd };
      });
    }
  },

  overwriteCellData: async (rowId, colIndex, columnId, value, conflictId) => {
    const state = get();
    const index = state.tableData.findIndex(
      r => (r.type === 'data' || r.type === 'automationModule') && r.id === rowId,
    );
    if (index === -1) return;

    const newData = [...state.tableData];
    const row = newData[index];
    if (!row || (row.type !== 'data' && row.type !== 'automationModule')) return;

    useUIStore.getState().setCommandStatus({ status: 'loading', message: 'Overwriting...' });

    try {
      const chromeAny = (window as any).chrome;
      const conflictRow = state.tableData.find(
        r => (r.type === 'data' || r.type === 'automationModule') && r.id === conflictId,
      ) as any;

      if (conflictRow) {
        if (columnId === 'key') {
          try {
            if (state.isEmbedded && chromeAny?.runtime?.sendMessage) {
              chromeAny.runtime.sendMessage({ action: 'save_user_hotkey', payload: { hotkeyValue: '', referenceId: conflictId, referenceType: 'command' }, userId: await getUserId() });
            } else {
              await updateHotkeyAndRefresh(conflictId, '');
              await deleteUserHotkeyByReference(conflictId, 'command');
            }
          } catch (e) {}
        } else {
          try {
            if (state.isEmbedded && chromeAny?.runtime?.sendMessage) {
              chromeAny.runtime.sendMessage({ action: 'save_user_shortcut', payload: { normalized: '', referenceId: conflictId, type: 'command' }, userId: await getUserId() });
            } else {
              await updateCommandAndRefresh(conflictId, { prefix: '' });
            }
          } catch (e) {}
        }
      } else {
        const isConflictAutomation =
          conflictRow?.category === 'automation' ||
          conflictRow?.category === 'agent' ||
          conflictRow?.section === 'My Saved Automations' ||
          conflictRow?.section === 'Chat Agents';

        if (isConflictAutomation) {
          if (state.isEmbedded && chromeAny?.runtime?.sendMessage) {
            if (columnId === 'key') {
              chromeAny.runtime.sendMessage({ action: 'save_user_hotkey', payload: { hotkeyValue: '', referenceId: conflictId, referenceType: 'automation' }, userId: await getUserId() });
            } else {
              chromeAny.runtime.sendMessage({ action: 'save_user_shortcut', payload: { normalized: '', referenceId: conflictId, type: 'automation' }, userId: await getUserId() });
            }
          } else {
            try {
              const userId = await getUserId();
              const clearPayload: any = { automation_id: String(conflictRow.id) };
              if (columnId === 'key') clearPayload.hotkeys = null;
              else clearPayload.shortcuts = null;
              await updateAutomationRecord(userId, clearPayload);
            } catch (e) {
              console.warn('[overwriteCellData] Automation conflict clear failed:', e);
            }
            await deleteUserHotkeyByReference(String(conflictRow.id), 'automation');
          }
        } else {
          const sId = extractSnippetIdFromCompoundId(conflictId);
          if (columnId === 'key') {
            if (state.isEmbedded && chromeAny?.runtime?.sendMessage) {
              chromeAny.runtime.sendMessage({ action: 'save_user_hotkey', payload: { hotkeyValue: '', referenceId: sId, referenceType: 'note' }, userId: await getUserId() });
            } else {
              await deleteUserHotkeyByReference(sId, 'note');
            }
          } else {
            if (state.isEmbedded && chromeAny?.runtime?.sendMessage) {
              chromeAny.runtime.sendMessage({ action: 'save_user_shortcut', payload: { normalized: '', referenceId: sId, type: 'note' }, userId: await getUserId() });
            } else {
              await deleteUserShortcutByReference(sId);
            }
          }
        }
      }

      state.updateCellData(rowId, colIndex, columnId, value);
      invalidateHotkeyCache();
      useUIStore.getState().setCommandStatus({ status: 'success', message: 'Overwritten successfully' });
      setTimeout(() => useUIStore.getState().resetCommandStatus(), 2000);
    } catch (err) {
      console.error('Overwrite failed:', err);
      useUIStore.getState().setCommandStatus({ status: 'error', message: 'Overwrite failed' });
    }
  },

  commitRowToBackend: async (rowId, noChange = false) => {
    const state = useSpreadsheetStore.getState();
    const chromeAny = (window as any).chrome;
    const index = state.tableData.findIndex(
      r => (r.type === 'data' || r.type === 'automationModule') && r.id === rowId,
    );
    if (index === -1) {
      return;
    }

    const row = state.tableData[index];

    if (!row || (row.type !== 'data' && row.type !== 'automationModule')) return;

    // 1. Requirements Check for New Items
    if (!row.isReal) {
      const isNoteRow = row.section === 'Notes';
      const hasName = row.name?.trim();
      const hasValue = isNoteRow ? row.value?.trim() : row.url?.trim() || (row.urls && row.urls.length > 0);
      const hasLocation = !!row.workspace_id;

      if (!hasName || !hasValue || !hasLocation) {
        return;
      }
    }

    // 2. Handle Unchanged Case
    if (noChange && row.isReal) {
      set(s => {
        const nd = [...s.tableData];
        if (nd[index].type === 'data' || nd[index].type === 'automationModule') {
          (nd[index] as any).syncStatus = 'saved';
          (nd[index] as any).syncMessage = 'Existing Unchanged';
        }
        return { tableData: nd };
      });
      setTimeout(() => {
        set(s => {
          const nd = [...s.tableData];
          if (nd[index].type === 'data' || nd[index].type === 'automationModule') {
            (nd[index] as any).syncStatus = 'idle';
            (nd[index] as any).syncMessage = undefined;
          }
          return { tableData: nd };
        });
      }, 2000);
      return;
    }

    set(s => {
      const nd = [...s.tableData];
      if (nd[index].type === 'data' || nd[index].type === 'automationModule') {
        (nd[index] as any).syncStatus = 'syncing';
        (nd[index] as any).syncMessage = 'Syncing...';
      }
      return { tableData: nd, isSaving: true };
    });

    // Helper for hostname resolution in multi-links
    const getHostname = (u: string) => {
      try {
        const urlObj = new URL(u.startsWith('http') ? u : `https://${u}`);
        return urlObj.hostname.replace('www.', '');
      } catch {
        return u;
      }
    };

    // 3. Synchronization logic (mirrors LinkEditModal.tsx)
    try {
      const untrimmedUrl = row.url || '';
      const hasQuickLinks = /\[query\]|\{query\}/i.test(untrimmedUrl);
      const urlsArray = row.urls || [];
      const isMulti = urlsArray.length > 1;

      // Determine Category
      const isLink = row.section === 'Smart Links' || row.category === 'link';
      const isNote = row.section === 'Notes';
      const isSnippet = row.section === 'Snippets';
      const isSession = row.section === 'Tab Sessions' || row.itemType === 'session';

      const isAutomation =
        row.section === 'My Saved Automations' ||
        row.section === 'Chat Agents' ||
        row.category === 'automation' ||
        row.category === 'agent' ||
        row.category === 'module';
      const category: any = isNote
        ? 'note'
        : isSnippet
          ? 'snippet'
          : isSession
              ? 'session'
          : isAutomation
              ? row.category || 'automation'
              : isLink
                ? 'link'
              : isMulti
                ? 'TabGroup'
                : 'link';

      // Determine Value (JSON for Multi, String for single)
      let valueForRequest = isNote || isSnippet || isSession ? row.value || '' : untrimmedUrl;
      if (!isNote && !isSnippet && !isAutomation && !isLink && !isSession) {
        const groupValue = {
          urls: urlsArray,
        };
        valueForRequest = JSON.stringify(groupValue);
      }

      const payload: any = {
        key: row.name.trim(),
        value: valueForRequest,
        category,
        folder_id: row.folder_id || null,
        workspace_id: row.workspace_id || null,
      };

      if (row.isReal && row.id) {
        payload.snippet_id = row.id;
      }

      let responseSnippet: any;

      // Specialized logic for Hotkey/Shortcut to match Favorite panel robustness
      // NOTE: Automations and agents are excluded here so they can follow their own save path below.
      const isAutomationRow =
        row.section === 'My Saved Automations' ||
        row.section === 'Chat Agents' ||
        row.category === 'automation' ||
        row.category === 'agent' ||
        row.category === 'module';

      if (row.isReal && row.id && (row.editAction === 'hotkey' || row.editAction === 'command') && !isAutomationRow) {
        const itemType =
          (row.itemType as any) || (isNote ? 'note' : isSnippet ? 'snippet' : isSession ? 'session' : 'link');
        const compoundId = getItemCompoundId({
          ...row,
          workspace_id: row.workspace_id || '',
          folder_id: row.folder_id || '',
        });

        const state = get();
        const chromeAny = (window as any).chrome;
        if (row.editAction === 'hotkey') {
          if (state.isEmbedded && chromeAny?.runtime?.sendMessage) {
            chromeAny.runtime.sendMessage({ action: 'save_user_hotkey', payload: { hotkeyValue: row.key || '', referenceId: compoundId, referenceType: itemType as any }, userId: await getUserId() });
            if (row.command) {
              chromeAny.runtime.sendMessage({ action: 'save_user_shortcut', payload: { normalized: normalizeShortcutTrigger(row.command), referenceId: compoundId, type: itemType as any }, userId: await getUserId() });
            }
          } else {
            const res = await saveUserHotkey(row.key || '', compoundId, itemType as any, await getUserId());
            responseSnippet = res;
            if (row.command) {
              await saveUserShortcut(
                normalizeShortcutTrigger(row.command || ''),
                compoundId,
                itemType as any,
                await getUserId(),
              );
            }
          }
          invalidateHotkeyCache();
          set(s => {
            const nd = [...s.tableData];
            if (nd[index].type === 'data' || nd[index].type === 'automationModule')
              (nd[index] as any).syncMessage = 'Hotkey Updated';
            return { tableData: nd };
          });
        } else {
          const cleanShortcut = normalizeShortcutTrigger(row.command || '');
          if (state.isEmbedded && chromeAny?.runtime?.sendMessage) {
            chromeAny.runtime.sendMessage({ action: 'save_user_shortcut', payload: { normalized: cleanShortcut, referenceId: compoundId, type: itemType as any }, userId: await getUserId() });
            if (row.key) {
              chromeAny.runtime.sendMessage({ action: 'save_user_hotkey', payload: { hotkeyValue: row.key, referenceId: compoundId, referenceType: itemType as any }, userId: await getUserId() });
            }
          } else {
            const res = await saveUserShortcut(cleanShortcut, compoundId, itemType as any, await getUserId());
            responseSnippet = res;
            if (row.key) {
              await saveUserHotkey(row.key || '', compoundId, itemType as any, await getUserId());
            }
          }
          invalidateHotkeyCache();
          set(s => {
            const nd = [...s.tableData];
            if (nd[index].type === 'data' || nd[index].type === 'automationModule')
              (nd[index] as any).syncMessage = 'Shortcut Updated';
            return { tableData: nd };
          });
        }
      } else if (row.category === 'module') {
        if (row.editAction === 'automation') {
          // â”€â”€â”€ Module Configuration Sync (2nd Column) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          try {
            const userId = await getUserId();
            const moduleId = Number(row.module_id);
            const automationData = row.automationData || {};
            const paramConfigs: Record<string, any> = { ...(automationData.paramConfigs || {}) };

            // ðŸ”  Gather paramConfigs from all steps to ensure we have the latest token configurations
            const steps =
              automationData.steps || automationData.automation_steps || automationData.execution_steps || [];
            steps.forEach((s: any) => {
              if (s.config?.paramConfigs) {
                Object.assign(paramConfigs, s.config.paramConfigs);
              }
            });

            // ðŸ› ï¸  Get Original Config to ensure we don't drop existing fields (like 'images')
            const originalConfig = automationData.input_split_config || {};
            const originalFields =
              originalConfig.split_fields ||
              originalConfig.canonical_fields ||
              automationData.variables ||
              automationData.execution_steps?.filter((s: any) => s.variables)?.flatMap((s: any) => s.variables) ||
              [];

            // ðŸ”  Extract tokens from URL and steps to ensure we don't miss any newly added tokens
            const tokensFromUrl =
              (row.url || '').match(/\{input_name="([^"]+)"\}|\{([^}:\s]+):([^}\s]+)\}|\{([^}\s]+)\}/g) || [];
            const extractedKeys = tokensFromUrl.map(t => {
              const namedMatch = t.match(/^\{input_name="([^"]+)"\}$/);
              if (namedMatch) return namedMatch[1];
              const typeMatch = t.match(/^\{([^}:\s]+):([^}\s]+)\}$/);
              if (typeMatch) return typeMatch[2];
              return t.replace(/^\{|\}$/g, '');
            });

            // Map of all field keys we need to process
            const allFieldKeys = new Set([
              ...originalFields.map((f: any) => f.key || f.name).filter((k: any) => !!k && String(k).trim() !== ''),
              ...Object.keys(paramConfigs).filter((k: any) => !!k && String(k).trim() !== ''),
              ...extractedKeys.filter((k: any) => !!k && String(k).trim() !== ''),
            ]);

            

            // 1. Transform ALL fields into API structure (split_fields)
            const split_fields = Array.from(allFieldKeys).map(key => {
              const cfg = paramConfigs[key] || originalFields.find((f: any) => f.key === key) || {};
              return {
                key,
                type: cfg.type || 'short_text',
                label:
                  cfg.label ||
                  cfg.current_label ||
                  cfg.name ||
                  key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
                options:
                  cfg.type === 'dropdown'
                    ? (cfg.optionPairs || cfg.dropdownOptions || cfg.values || cfg.options || [])
                        .map((o: any) => (typeof o === 'string' ? o : o.value || o))
                        .filter((v: any) => v && String(v).trim() !== '')
                    : [],
                values:
                  cfg.type === 'dropdown'
                    ? (cfg.optionPairs || cfg.dropdownOptions || cfg.values || cfg.options || [])
                        .map((o: any) => (typeof o === 'string' ? o : o.value || o))
                        .filter((v: any) => v && String(v).trim() !== '')
                    : [],
                fixed_value: cfg.type === 'constant' ? cfg.fixedValue : undefined,
                description: cfg.type === 'constant' ? cfg.description : undefined,
              };
            });

            // 2. Build merge_mapping (standard direct mapping for EVERY field)
            const merge_mapping: Record<string, any> = {};
            allFieldKeys.forEach(key => {
              merge_mapping[key] = { op: 'direct', field: key };
            });

            // 3. Build canonical_fields
            const canonical_fields = Array.from(allFieldKeys).map(key => {
              const cfg = paramConfigs[key] || originalFields.find((f: any) => f.key === key) || {};
              return {
                key,
                options:
                  cfg.type === 'dropdown'
                    ? (cfg.optionPairs || cfg.dropdownOptions || cfg.values || cfg.options || [])
                        .map((o: any) => (typeof o === 'string' ? o : o.value || o))
                        .filter((v: any) => v && String(v).trim() !== '')
                    : [],
                values:
                  cfg.type === 'dropdown'
                    ? (cfg.optionPairs || cfg.dropdownOptions || cfg.values || cfg.options || [])
                        .map((o: any) => (typeof o === 'string' ? o : o.value || o))
                        .filter((v: any) => v && String(v).trim() !== '')
                    : [],
                required: cfg.required || false,
                current_type: cfg.type || cfg.current_type || 'short_text',
                default_type: cfg.default_type || cfg.type || 'short_text',
                current_label:
                  cfg.label ||
                  cfg.current_label ||
                  cfg.name ||
                  key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
                default_label:
                  cfg.label ||
                  cfg.current_label ||
                  cfg.name ||
                  key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
              };
            });

            const payload = {
              input_split_config: {
                version: 1,
                module_id: moduleId,
                module_key: row.module_key,
                module_name: row.name,
                split_fields: Array.from(allFieldKeys).map(key => {
                  const cfg = paramConfigs[key] || originalFields.find((f: any) => f.key === key) || {};
                  const isConstant = cfg.type === 'constant';
                  const dropdownVals =
                    cfg.type === 'dropdown'
                      ? (cfg.optionPairs || cfg.dropdownOptions || cfg.values || cfg.options || [])
                          .map((o: any) => (typeof o === 'string' ? o : o.value || o))
                          .filter((v: any) => v && String(v).trim() !== '')
                      : null; // Use null for constants

                  return {
                    key,
                    type: cfg.type || 'short_text',
                    label: cfg.label || cfg.current_label || key,
                    options: dropdownVals,
                    values: dropdownVals,
                    fixed_value: isConstant ? cfg.fixedValue : undefined,
                    fixedValue: isConstant ? cfg.fixedValue : undefined,
                    description: isConstant ? cfg.description : undefined,
                  };
                }),
                merge_mapping,
                canonical_fields: Array.from(allFieldKeys).map(key => {
                  const cfg = paramConfigs[key] || originalFields.find((f: any) => f.key === key) || {};
                  const isConstant = cfg.type === 'constant';
                  const dropdownVals =
                    cfg.type === 'dropdown'
                      ? (cfg.optionPairs || cfg.dropdownOptions || cfg.values || cfg.options || [])
                          .map((o: any) => (typeof o === 'string' ? o : o.value || o))
                          .filter((v: any) => v && String(v).trim() !== '')
                      : null; // Use null for constants

                  return {
                    key,
                    options: dropdownVals,
                    values: dropdownVals,
                    required: cfg.required || false,
                    current_type: cfg.type || 'short_text',
                    default_type: cfg.default_type || cfg.type || 'short_text',
                    current_label: cfg.label || cfg.current_label || key,
                    default_label: cfg.label || cfg.current_label || key,
                    fixed_value: isConstant ? cfg.fixedValue : undefined,
                    fixedValue: isConstant ? cfg.fixedValue : undefined,
                  };
                }),
              },
            };

            if (canonical_fields.length > 0) {
              
              // await updateInputOverride(userId, String(moduleId), payload);
            } else {
              
            }

            set(s => {
              const nd = [...s.tableData];
              if (nd[index].type === 'data' || nd[index].type === 'automationModule') {
                (nd[index] as any).syncStatus = 'saved';
                (nd[index] as any).syncMessage = 'Configuration Saved';
              }
              return { tableData: nd, isSaving: false };
            });

            setTimeout(() => {
              set(s => {
                const nd = [...s.tableData];
                const freshIndex = nd.findIndex(r => (r as any).id === rowId);
                if (
                  freshIndex !== -1 &&
                  (nd[freshIndex].type === 'data' || nd[freshIndex].type === 'automationModule')
                ) {
                  (nd[freshIndex] as any).syncStatus = 'idle';
                  (nd[freshIndex] as any).syncMessage = undefined;
                }
                return { tableData: nd };
              });
            }, 2000);
          } catch (err) {
            set(s => {
              const nd = [...s.tableData];
              if (nd[index].type === 'data' || nd[index].type === 'automationModule') {
                (nd[index] as any).syncStatus = 'error';
                (nd[index] as any).syncMessage = 'Save Failed';
              }
              return { tableData: nd, isSaving: false };
            });
          }


        } else if (row.editAction === 'hotkey' || row.editAction === 'command') {
          const value = row.editAction === 'hotkey' ? row.key : row.command;
          const moduleId = row.module_id!;

          set(s => {
            const nd = [...s.tableData];
            if (nd[index].type === 'data' || nd[index].type === 'automationModule') {
              (nd[index] as any).syncStatus = 'saved';
              (nd[index] as any).syncMessage =
                row.editAction === 'hotkey' ? 'Module Hotkey Updated' : 'Shortcut Updated';
            }
            return { tableData: nd };
          });
          const userId = await getUserId();
          if (state.isEmbedded && chromeAny?.runtime?.sendMessage) {
            if (row.editAction === 'hotkey') {
              chromeAny.runtime.sendMessage({ action: 'save_user_hotkey', payload: { hotkeyValue: value || '', referenceId: String(moduleId), referenceType: 'module' }, userId });
            } else {
              chromeAny.runtime.sendMessage({ action: 'save_user_shortcut', payload: { normalized: normalizeShortcutTrigger(value || ''), referenceId: String(moduleId), type: 'module' }, userId });
            }
          } else {
            if (row.editAction === 'hotkey') {
              await saveUserHotkey(value || '', String(moduleId), 'module', userId);
            } else {
              await saveUserShortcut(normalizeShortcutTrigger(value || ''), String(moduleId), 'module', userId);
            }
          }
        }
        return;
      } else if (
        row.section === 'My Saved Automations' ||
        row.section === 'Chat Agents' ||
        row.category === 'automation' ||
        row.category === 'agent'
      ) {
        // â”€â”€â”€ Automation Sync Logic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const automationId = Number(row.id);
        const userId = await getUserId();
        const state = get();
        const chromeAny = (window as any).chrome;
        const compoundId = getItemCompoundId({
          ...row,
          workspace_id: row.workspace_id || '',
          folder_id: row.folder_id || '',
        });

        if (row.editAction === 'hotkey' || row.editAction === 'command') {
          // ————————————————————————————————————— Hotkey / Shortcut Only ——————————————————————————————————————
          // Don't re-save steps/name — just update the hotkey or shortcut field.
          try {
            const cloudPayload: any = {
              automation_id: String(automationId),
              workspace_id: row.workspace_id,
              folder_id: row.folder_id || null,
            };
            if (row.editAction === 'hotkey') {
              cloudPayload.hotkeys = row.key || null;
            } else {
              const cmd = row.command || '';
              cloudPayload.shortcuts = normalizeShortcutTrigger(cmd || '') || null;
            }
            await updateAutomationRecord(userId, cloudPayload);

            // Also sync to local storage for background / Searchbar
            const compoundId = getItemCompoundId({
              ...row,
              workspace_id: row.workspace_id || '',
              folder_id: row.folder_id || '',
            });
            if (row.editAction === 'hotkey') {
              if (state.isEmbedded && chromeAny?.runtime?.sendMessage) {
                chromeAny.runtime.sendMessage({ action: 'save_user_hotkey', payload: { hotkeyValue: row.key || '', referenceId: compoundId, referenceType: 'automation' }, userId });
              } else {
                await saveUserHotkey(row.key || '', compoundId, 'automation', userId);
              }
              set(s => {
                const nd = [...s.tableData];
                if (nd[index].type === 'data') {
                  (nd[index] as any).syncStatus = 'saved';
                  (nd[index] as any).syncMessage = 'Hotkey Updated';
                }
                return { tableData: nd };
              });
            } else {
              const cleanShortcut = normalizeShortcutTrigger(row.command || '');
              if (state.isEmbedded && chromeAny?.runtime?.sendMessage) {
                chromeAny.runtime.sendMessage({ action: 'save_user_shortcut', payload: { normalized: cleanShortcut, referenceId: compoundId, type: 'automation' }, userId });
              } else {
                await saveUserShortcut(cleanShortcut, compoundId, 'automation', userId);
              }
              set(s => {
                const nd = [...s.tableData];
                if (nd[index].type === 'data') {
                  (nd[index] as any).syncStatus = 'saved';
                  (nd[index] as any).syncMessage = 'Shortcut Updated';
                }
                return { tableData: nd };
              });
            }
          } catch (e) {
            console.error('[commitRowToBackend] Automation Hotkey/Shortcut Cloud Sync Failed:', e);
            throw e; // Let outer catch handle error state
          }
        } else {
          // â”€â”€ Name / Steps Edit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          const steps = row.automationData?.steps || row.automationData?.automation_steps || [];
          const apiSteps = steps.map((s: any, idx: number) => ({
            module_id: String(s.moduleId || s.module_id || ''),
            step_order: idx + 1,
            config: s.config || {},
          }));

          // removed api updateAutomation

          
        }

        responseSnippet = { id: automationId, syncStatus: 'saved' };
      } else if (isNote) {
        const notePayload = {
          title: row.name,
          body: row.value,
          workspaceId: (row as any).workspace_id || (row as any).workspaceId,
          folderId: (row as any).folder_id ?? (row as any).folderId ?? null,
          tagIds: (row as any).tagIds ?? [],
        };

        let note;
        if (state.isEmbedded && chromeAny?.runtime?.sendMessage) {
          note = row.isReal && row.id
            ? await new Promise((resolve, reject) => {
                chromeAny.runtime.sendMessage({ action: 'db_update_note', noteId: String(row.id), input: notePayload }, (res: any) => {
                  if (chromeAny.runtime.lastError) return reject(chromeAny.runtime.lastError);
                  if (!res || !res.success) return reject(res?.error || 'Failed to update note');
                  resolve(res.note);
                });
              })
            : await new Promise((resolve, reject) => {
                chromeAny.runtime.sendMessage({ action: 'db_create_note', input: notePayload }, (res: any) => {
                  if (chromeAny.runtime.lastError) return reject(chromeAny.runtime.lastError);
                  if (!res || !res.success) return reject(res?.error || 'Failed to create note');
                  resolve(res.note);
                });
              });
        } else {
          note = row.isReal && row.id ? await updateNote(String(row.id), notePayload as any) : await createNote(notePayload as any);
        }
        responseSnippet = note;
      } else if (row.section === 'Smart Links' || row.category === 'link') {
        // Attempt to find the existing link in useDbStore to match existing items
        const existingLink = useDbStore.getState().links.find(l => l.id === row.id);
        const existingUrls = existingLink?.urls || [];

        const linkUrls = Array.isArray(row.urls) && row.urls.length > 0
          ? row.urls.map((u: any) => {
              const urlStr = typeof u === 'string' ? u : (u?.url || '');
              const matchedExisting = existingUrls.find(eu => eu.url === urlStr);
              if (matchedExisting) {
                return matchedExisting;
              }
              return {
                id: typeof u === 'object' && u?.id && !u.id.startsWith('http') ? u.id : generateEntityId('linkItem'),
                url: urlStr,
                title: typeof u === 'object' && u?.title ? u.title : '',
                source: 'link'
              };
            })
          : row.url
            ? (() => {
                const matchedExisting = existingUrls.find(eu => eu.url === String(row.url));
                return [{
                  id: matchedExisting?.id || generateEntityId('linkItem'),
                  url: String(row.url),
                  title: row.name || '',
                  source: 'link',
                }];
              })()
            : row.value
              ? (() => {
                  const matchedExisting = existingUrls.find(eu => eu.url === String(row.value));
                return [{
                    id: matchedExisting?.id || generateEntityId('linkItem'),
                    url: String(row.value),
                    title: row.name || '',
                    source: 'link',
                  }];
                })()
              : [];

        const linkPayload = {
          title: row.name,
          urls: linkUrls,
          workspaceId: (row as any).workspace_id || (row as any).workspaceId,
          folderId: (row as any).folder_id ?? (row as any).folderId ?? null,
          tagIds: (row as any).tagIds ?? [],
        };

        let link;
        if (state.isEmbedded && chromeAny?.runtime?.sendMessage) {
          link = row.isReal && row.id
            ? await new Promise((resolve, reject) => {
                chromeAny.runtime.sendMessage({ action: 'db_update_link', linkId: String(row.id), input: linkPayload }, (res: any) => {
                  if (chromeAny.runtime.lastError) return reject(chromeAny.runtime.lastError);
                  if (!res || !res.success) return reject(res?.error || 'Failed to update link');
                  resolve(res.link);
                });
              })
            : await new Promise((resolve, reject) => {
                chromeAny.runtime.sendMessage({ action: 'db_create_link', input: linkPayload }, (res: any) => {
                  if (chromeAny.runtime.lastError) return reject(chromeAny.runtime.lastError);
                  if (!res || !res.success) return reject(res?.error || 'Failed to create link');
                  resolve(res.link);
                });
              });
        } else {
          link = row.isReal && row.id ? await updateLink(String(row.id), linkPayload as any) : await createLink(linkPayload as any);
        }
        responseSnippet = link;
      } else if (isSnippet) {
        const snippetPayload = {
          title: row.name,
          config: typeof row.value === 'string' ? row.value : JSON.stringify(row.value),
          workspaceId: (row as any).workspace_id || (row as any).workspaceId,
          folderId: (row as any).folder_id ?? (row as any).folderId ?? null,
          tagIds: (row as any).tagIds ?? [],
        };

        let snippet;
        if (state.isEmbedded && chromeAny?.runtime?.sendMessage) {
          snippet = row.isReal && row.id
            ? await new Promise((resolve, reject) => {
                chromeAny.runtime.sendMessage({ action: 'db_update_snippet', snippetId: String(row.id), input: snippetPayload }, (res: any) => {
                  if (chromeAny.runtime.lastError) return reject(chromeAny.runtime.lastError);
                  if (!res || !res.success) return reject(res?.error || 'Failed to update snippet');
                  resolve(res.snippet);
                });
              })
            : await new Promise((resolve, reject) => {
                chromeAny.runtime.sendMessage({ action: 'db_create_snippet', input: snippetPayload }, (res: any) => {
                  if (chromeAny.runtime.lastError) return reject(chromeAny.runtime.lastError);
                  if (!res || !res.success) return reject(res?.error || 'Failed to create snippet');
                  resolve(res.snippet);
                });
              });
        } else {
          snippet = row.isReal && row.id
            ? await updateSnippet(String(row.id), snippetPayload as any)
            : await createSnippet(snippetPayload as any);
        }
        responseSnippet = snippet;
      } else if (isSession) {
        const sessionPayload = {
          title: row.name,
          urls: Array.isArray(row.urls) ? row.urls : (row.value ? JSON.parse(row.value).urls : []),
          workspaceId: (row as any).workspace_id || (row as any).workspaceId,
          folderId: (row as any).folder_id ?? (row as any).folderId ?? null,
          tagIds: (row as any).tagIds ?? [],
        };

        let sessionObj;
        if (state.isEmbedded && chromeAny?.runtime?.sendMessage) {
          sessionObj = row.isReal && row.id
            ? await new Promise((resolve, reject) => {
                chromeAny.runtime.sendMessage({ action: 'db_update_session', sessionId: String(row.id), input: sessionPayload }, (res: any) => {
                  if (chromeAny.runtime.lastError) return reject(chromeAny.runtime.lastError);
                  if (!res || !res.success) return reject(res?.error || 'Failed to update session');
                  resolve(res.session);
                });
              })
            : await new Promise((resolve, reject) => {
                chromeAny.runtime.sendMessage({ action: 'db_create_session', input: sessionPayload }, (res: any) => {
                  if (chromeAny.runtime.lastError) return reject(chromeAny.runtime.lastError);
                  if (!res || !res.success) return reject(res?.error || 'Failed to create session');
                  resolve(res.session);
                });
              });
        } else {
          sessionObj = row.isReal && row.id
            ? await updateSession(String(row.id), sessionPayload as any)
            : await createSession(sessionPayload as any);
        }
        responseSnippet = sessionObj;
      }

      const finalId =
        row.isReal && row.id && (row.editAction === 'hotkey' || row.editAction === 'command')
          ? String(row.id)
          : responseSnippet?.snippet_id || responseSnippet?.id || row.id;
      const updatedTime = responseSnippet?.updated_at || responseSnippet?.updatedAt || '';

      // Mirror bindings into local storage only for non-binding edits.
      const isBindingEdit = row.editAction === 'hotkey' || row.editAction === 'command';
      if (finalId && !isBindingEdit && (row.key || row.command)) {
        const tempItem = { ...row, id: finalId };
        const compoundId = getItemCompoundId(tempItem);

        // Resolve correct type for local registry parity
        const resolvedLocalType =
          row.category === 'automation'
            ? 'automation'
            : row.category === 'agent'
              ? 'automation'
              : isNote
                ? 'note'
                : 'link';

        const userId = await getUserId();
        if (state.isEmbedded && chromeAny?.runtime?.sendMessage) {
          chromeAny.runtime.sendMessage({ action: 'save_user_hotkey', payload: { hotkeyValue: row.key || '', referenceId: compoundId, referenceType: resolvedLocalType as any }, userId });
          if (row.command) {
            chromeAny.runtime.sendMessage({ action: 'save_user_shortcut', payload: { normalized: normalizeShortcutTrigger(row.command || ''), referenceId: compoundId, type: resolvedLocalType as any }, userId });
          }
        } else {
          await saveUserHotkey(row.key || '', compoundId, resolvedLocalType as any, userId);
          if (row.command) {
            await saveUserShortcut(normalizeShortcutTrigger(row.command || ''), compoundId, resolvedLocalType as any, userId);
          }
        }
      }

      // 4. Handle Shortcut/Hotkey/Favorite synchronization
      let favouriteId: string | undefined;
      if (finalId) {
        const userId = await getUserId();
        const compoundId = `${row.folder_id || row.workspace_id}-${finalId}`;

        // Local favorite synced during creation if needed via SpreadsheetQuickAddModal
      }

      // 5. Update local state and Redux
      const isNewItem = !row.isReal;
      const successMessage = isNewItem ? 'New One Saved' : 'Updated';

      set(s => {
        const nd = [...s.tableData];
        if (nd[index].type === 'data' || nd[index].type === 'automationModule') {
          (nd[index] as any).id = finalId;
          (nd[index] as any).isReal = true;
          (nd[index] as any).favourite_id = favouriteId || (nd[index] as any).favourite_id;
          (nd[index] as any).syncStatus = 'saved';
          (nd[index] as any).syncMessage = successMessage;
          (nd[index] as any).category = row.category || category;
          (nd[index] as any).updated_at = updatedTime;

          if (row.editAction === 'hotkey') (nd[index] as any).key = row.key;
          if (row.editAction === 'command') (nd[index] as any).command = row.command;
        }
        return { tableData: nd };
      });

      

      state.setShowSuccess(true);
      setTimeout(() => {
        set(s => {
          const nd = [...s.tableData];
          if (nd[index].type === 'data') {
            (nd[index] as any).syncStatus = 'idle';
            (nd[index] as any).syncMessage = undefined;
            (nd[index] as any).editAction = undefined;
          }
          return { tableData: nd };
        });
      }, 3000);
    } catch (error) {
      console.error('[SpreadsheetMainContainer] Commit failed:', error);
      const msg = error instanceof Error ? error.message : 'Failed to sync link';
      useUIStore.getState().queueNotification({ message: msg, type: 'error' });
      set(s => {
        const nd = [...s.tableData];
        if (nd[index].type === 'data') {
          (nd[index] as any).syncStatus = 'idle';
          (nd[index] as any).syncMessage = 'Failed to Sync';
        }
        return { tableData: nd };
      });
    } finally {
      set({ isSaving: false });
    }
  },

  updateRowLocation: (rowId, wsId, fId) => {
    const state = useSpreadsheetStore.getState();
    const index = state.tableData.findIndex(r => r.type === 'data' && r.id === rowId);
    if (index === -1) return;

    const newData = [...state.tableData];
    const row = newData[index];
    if (row && row.type === 'data') {
      const dbState = useDbStore.getState();
      const ws = dbState.workspaces.find(w => w.id === wsId);
      const wsName = ws?.workspaceName || '';
      
      const f = dbState.folders.find(f => f.id === fId);
      const fName = f?.folderName || null;
      const pathNames = fName ? [fName] : [];

      const wsPath = `${wsName}`;

      const fPathSection = fName ? ` / ${pathNames.join(' / ')}` : '';
      const fullPath = `${wsPath}${fPathSection}`;

      const fPlainSection = fName ? ` / ${pathNames.join(' / ')}` : '';
      const plainPath = `${wsName}${fPlainSection}`;

      newData[index] = {
        ...row,
        workspace_id: wsId,
        folder_id: fId || null,
        folder: fName || wsName,
        path: fullPath,
        plainPath: plainPath,
        visibilityType: 'lock',
      };

      set({ tableData: newData, isPickerOpen: false, pickerRowIndex: null });

      // Save as last used destination for parity with Rich Editor / Link Modal
      const storageKey = row.section === 'Smart Links' ? 'lastLinkDestination' : 'lastNoteDestination';
      chrome.storage.local.set({
        [storageKey]: {
          workspace_id: wsId,
          folder_id: fId || null,
        },
      });

      // Trigger backend commit
      state.commitRowToBackend(rowId);
    }
  },

  syncRealNotes: (
    notes,
    links,

    snippets,
    workspaces,
    folders,
    userId, favorites, hotkeysMap,
    shortcutsMap,
    automations,
    agents,
    bookmarks,
  ) => {
    const state = useSpreadsheetStore.getState();
    const favsHash = JSON.stringify(favorites);
    const hotkeysHash = JSON.stringify(hotkeysMap);
    const shortcutsHash = JSON.stringify(shortcutsMap);
    const bookmarksHash = JSON.stringify(bookmarks?.map(b => b.id) || []);

    if (
      state.lastSyncArgs &&
      state.lastSyncArgs.notes === notes &&
      state.lastSyncArgs.links === links &&
      state.lastSyncArgs.snippets === snippets &&
      state.lastSyncArgs.workspaces === workspaces &&
      state.lastSyncArgs.folders === folders &&
      state.lastSyncArgs.userId === userId &&
      state.lastSyncArgs.automations === automations &&
      state.lastSyncArgs.agents === agents &&
      state.lastSyncArgs.favsHash === favsHash &&
      state.lastSyncArgs.hotkeysHash === hotkeysHash &&
      state.lastSyncArgs.shortcutsHash === shortcutsHash &&
      state.lastSyncArgs.bookmarksHash === bookmarksHash
    ) {
      return;
    }

    useSpreadsheetStore.setState({
      lastSyncArgs: {
        notes,
        links,

        snippets,
        workspaces,
        folders,
        userId,
        automations,
        agents,
        favsHash,
        hotkeysHash,
        shortcutsHash,
        bookmarksHash,
      },
    });

    set(state => {
      const isFavorite = (refId: string, compoundId?: string) => {
        const normalizedUserId = userId || 'local_user';
        return (favorites || []).some((f: any) => {
          const fRefId = String(f.reference_id || f.referenceId || '');
          const fUserId = f.user_id || f.userId || 'local_user';
          if (fUserId !== normalizedUserId) return false;

          const rawFavId = extractSnippetIdFromCompoundId(fRefId);
          const rawItemId = extractSnippetIdFromCompoundId(refId);

          if (rawFavId && rawItemId && rawFavId === rawItemId) return true;
          if (compoundId && fRefId === compoundId) return true;
          if (fRefId === refId) return true;

          return false;
        });
      };

      const deletingRowsMap = new Map<string, any>();
      state.tableData.forEach((r: any) => {
        if (r.isDeleting) {
          deletingRowsMap.set(String(r.id), r.deleteTimer);
        }
      });

      
      const locationLookup: Record<string, { name: string; path: string; plainPath: string; visibilityType: 'lock' | 'globe' | 'users' | 'personal' }> = {};
      (workspaces || []).forEach((ws: any) => {
        const wsName = ws.workspaceName || 'Unknown Workspace';
        locationLookup[ws.id] = { name: wsName, path: wsName, plainPath: wsName, visibilityType: 'lock' };
      });
      (folders || []).forEach((folder: any) => {
        const ws = workspaces.find((w: any) => w.id === folder.workspaceId);
        const wsName = ws ? ws.workspaceName : 'Unknown Workspace';
        const fPlainPath = `${wsName} / ${folder.folderName}`;
        locationLookup[folder.id] = { name: folder.folderName, path: fPlainPath, plainPath: fPlainPath, visibilityType: 'lock' };
      });
      const stripHtml = (html: string) => {
        if (typeof html !== 'string') return html;
        return html.replace(/<[^>]*>?/gm, '');
      };

      const resolveIcon = (iconStr: string | null | undefined, defaultEmoji: string) => {
        if (!iconStr) return defaultEmoji;
        if (iconStr.startsWith('U+')) {
          try {
            return String.fromCodePoint(parseInt(iconStr.replace('U+', ''), 16));
          } catch (e) {
            return defaultEmoji;
          }
        }
        return defaultEmoji;
      };

      (workspaces || []).forEach((ws: any) => {
        const wsPath = `${ws.workspaceName}`;
        locationLookup[ws.id] = {
          name: ws.workspaceName,
          path: wsPath,
          plainPath: ws.workspaceName,
          visibilityType: 'lock',
        };
      });

      (folders || []).forEach((folder: any) => {
        const ws = workspaces.find((w: any) => w.id === folder.workspaceId);
        const wsName = ws ? ws.workspaceName : 'Unknown Workspace';
        const wsPath = `${wsName}`;
        
        const fPath = `${wsPath} / ${folder.folderName}`;
        const fPlainPath = `${wsName} / ${folder.folderName}`;
        
        locationLookup[folder.id] = {
          name: folder.folderName,
          path: fPath,
          plainPath: fPlainPath,
          visibilityType: 'lock',
        };
      });

      const mapToRowData = (item: any, type: 'note' | 'link' | 'snippet' | 'session', isLink: boolean, isSnippet: boolean): any => {
        const rawContent = item.value !== undefined ? item.value : (item.body !== undefined ? item.body : item.config);
        const stringContent = typeof rawContent === 'object' ? JSON.stringify(rawContent) : String(rawContent || '');
        const cleanValue = stringContent ? stripHtml(stringContent) : isLink ? '' : 'Note Data';
        const itemLongId = item.id;

        const loc = locationLookup[item.folderId || item.workspaceId] || { name: 'Unknown', path: 'Unknown', plainPath: 'Unknown', visibilityType: 'lock' };

        const compoundId = getItemCompoundId({
          ...item,
          workspace_id: item.workspaceId,
          folder_id: item.folderId,
        });

        const hotkey = hotkeysMap[compoundId] || hotkeysMap[itemLongId] || getUserHotkey(item.hotkeys, userId) || '';
        const shortcut = shortcutsMap[compoundId] || shortcutsMap[itemLongId] || getUserShortcut(item.shortcuts, userId) || '';
        const existingRow = state.tableData.find((r: any) => r.type === 'data' && r.id === itemLongId) as any;

        const linkUrls = isLink
          ? (Array.isArray(item.urls) && item.urls.length > 0
              ? item.urls.map((u: any) => typeof u === 'string' ? u : (u?.url || u?.value || ''))
              : extractUrlsFromSnippet(item))
          : [];

        return {
          type: 'data',
          id: itemLongId,
          name: item.title,
          url: isLink ? stringContent || (linkUrls[0] || '') : cleanValue,
          value: stringContent || (isLink ? JSON.stringify({ urls: linkUrls, names: linkUrls.map(() => '') }) : ''),
          workspace_id: item.workspaceId || item.workspace_id || null,
          folder_id: item.folderId || item.folder_id || null,
          folder: loc.name,
          path: loc.path,
          plainPath: loc.plainPath,
          visibilityType: loc.visibilityType,
          fav: isFavorite(itemLongId, compoundId),
          // favourite_id removed
          key: hotkey,
          command: shortcut,
          section: type === 'session' ? 'Tab Sessions' : isLink ? 'Smart Links' : isSnippet ? 'Snippets' : 'Notes',
          isReal: true,
          syncStatus: existingRow?.syncStatus || 'idle',
          favAction: existingRow?.favAction,
          editAction: existingRow?.editAction,
          itemType: type,
          category: type,
          urls: linkUrls,
          updated_at: item.updatedAt,
          tagIds: item.tagIds || [],
          originalItem: item,
        };
      };

      const realNotes = notes.map((n: any) => mapToRowData(n, 'note', false, false));
      const realLinks = links.map((l: any) => mapToRowData(l, 'link', true, false));
      const realSnippets = snippets.map((s: any) => mapToRowData(s, 'snippet', false, true));
      const realSessions = (useDbStore.getState().sessions || []).map((s: any) => mapToRowData(s, 'session' as any, true, false));
      const realTodos = (useDbStore.getState().todos || []).map((t: any) => {
        const itemLongId = t.id;
        const loc = locationLookup[t.folderId || t.workspaceId] || {
          name: 'User level',
          path: 'User level',
          plainPath: 'User level',
          visibilityType: 'personal',
        };
        const compoundId = getItemCompoundId({
          ...t,
          workspace_id: t.workspaceId,
          folder_id: t.folderId,
        });

        const hotkey = (hotkeysMap ? hotkeysMap[compoundId] || hotkeysMap[itemLongId] : '') || (t.hotkeys as string) || '';
        const shortcut =
          (shortcutsMap ? shortcutsMap[compoundId] || shortcutsMap[itemLongId] : '') ||
          normalizeShortcutTrigger((t.shortcuts as string) || '') ||
          '';
        const existingRow = state.tableData.find((r: any) => r.type === 'data' && r.id === itemLongId) as any;

        return {
          type: 'data',
          id: itemLongId,
          name: t.name || t.title || 'Untitled Todo',
          url: stripHtml(t.description || t.value || ''),
          value: t.description || t.value || '',
          workspace_id: t.workspaceId || t.workspace_id || null,
          folder_id: t.folderId || t.folder_id || null,
          folder: loc.name,
          path: loc.path,
          plainPath: loc.plainPath,
          visibilityType: loc.visibilityType,
          fav: isFavorite(itemLongId, compoundId),
          key: hotkey,
          command: shortcut,
          section: 'Todos',
          isReal: true,
          syncStatus: existingRow?.syncStatus || 'idle',
          favAction: existingRow?.favAction,
          editAction: existingRow?.editAction,
          itemType: 'todo',
          category: 'todo',
          urls: [],
          updated_at: t.updatedAt || 0,
          tagIds: t.tags || t.tagIds || [],
          isDone: t.isDone || t.is_done || false,
          originalItem: t,
        };
      });


      const realAutomations: any[] = [];
      const browserCommands: any[] = [];
      const realChatAgents: any[] = [];
      const realBookmarks: any[] = [];

      // Process Automations
      if (Array.isArray(automations)) {
        automations.forEach((auto: any) => {
          const isAgent = (auto.automation_steps || auto.steps || []).some(
            (s: any) => String(s.module_id || s.moduleId) === '5' || s.config?.agentId === 'all_ai' || s.config?.isAllAi,
          );
          const automationLongId = auto.automation_id || auto.id || '';
          const id = String(automationLongId);
          const compoundId = getItemCompoundId(auto);

          const hotkey = (hotkeysMap ? hotkeysMap[compoundId] || hotkeysMap[id] : '') || (auto.hotkeys as string) || '';
          const shortcut =
            (shortcutsMap ? shortcutsMap[compoundId] || shortcutsMap[id] : '') ||
            normalizeShortcutTrigger((auto.shortcuts as string) || '') ||
            '';
          const existingRow = state.tableData.find((r: any) => r.type === 'data' && r.id === id) as any;

          let resolvedFolder = auto.parent_name || 'General';
          let resolvedPath = auto.parent_name || 'General';
          let resolvedVisibility: 'lock' | 'globe' | 'users' | 'personal' = 'personal';

          const autoLocId = auto.folder_id || auto.workspace_id || auto.folderId || auto.workspaceId;
          if (autoLocId && locationLookup[autoLocId]) {
            resolvedFolder = locationLookup[autoLocId].name;
            resolvedPath = locationLookup[autoLocId].path;
            resolvedVisibility = locationLookup[autoLocId].visibilityType;
          }

          const rowData: any = {
            type: 'data',
            id,
            name: auto.automation_name || auto.name,
            url: stripHtml(auto.automation_description || auto.description || ''),
            workspace_id: auto.workspace_id || auto.workspaceId || null,
            folder_id: auto.folder_id || auto.folderId || null,
            folder: resolvedFolder,
            path: resolvedPath,
            plainPath: resolvedPath, // Simplified plain path for automations
            visibilityType: resolvedVisibility,
            fav: isFavorite(id, compoundId),
            // favourite_id removed
            key: hotkey,
            command: shortcut,
            section: isAgent ? 'Chat Agents' : 'Saved Automations',
            isReal: true,
            syncStatus: existingRow?.syncStatus || 'idle',
            favAction: existingRow?.favAction,
            editAction: existingRow?.editAction,
            itemType: 'automation',
            category: 'automation',
            urls: [],            
            updated_at: auto.updated_at || auto.createdAt,
            tags: auto.tags || auto.tagIds || [],
            tagIds: auto.tagIds || auto.tags || [],
            // ... (Add automation fields back safely if needed by SpreadsheetMainContainer)
          };
          if (isAgent) realChatAgents.push(rowData);
          else realAutomations.push(rowData);
        });
      }

      // Process Agents
      if (Array.isArray(agents)) {
        agents.forEach((agent: any) => {          const agentLongId = agent.agent_id || agent.id || '';
          const id = String(agentLongId);
          const compoundId = getItemCompoundId(agent);

          const hotkey = (hotkeysMap ? hotkeysMap[compoundId] || hotkeysMap[id] : '') || (agent.hotkeys as string) || '';
          const shortcut =
            (shortcutsMap ? shortcutsMap[compoundId] || shortcutsMap[id] : '') ||
            normalizeShortcutTrigger((agent.shortcuts as string) || '') ||
            '';
          const existingRow = state.tableData.find((r: any) => r.type === 'data' && r.id === id) as any;

          let resolvedFolder = agent.parent_name || 'General';
          let resolvedPath = agent.parent_name || 'General';
          let resolvedVisibility: 'lock' | 'globe' | 'users' | 'personal' = 'personal';

          const agentLocId = agent.folder_id || agent.workspace_id || agent.folderId || agent.workspaceId;
          if (agentLocId && locationLookup[agentLocId]) {
            resolvedFolder = locationLookup[agentLocId].name;
            resolvedPath = locationLookup[agentLocId].path;
            resolvedVisibility = locationLookup[agentLocId].visibilityType;
          }

          const rowData: any = {
            type: 'data',
            id,
            name: agent.agent_name || agent.name,
            url: stripHtml(agent.agent_description || agent.description || ''),
            workspace_id: agent.workspace_id || agent.workspaceId || null,
            folder_id: agent.folder_id || agent.folderId || null,
            folder: resolvedFolder,
            path: resolvedPath,
            plainPath: resolvedPath,
            visibilityType: resolvedVisibility,
            fav: isFavorite(id, compoundId),
            // favourite_id removed
            key: hotkey,
            command: shortcut,
            section: 'Chat Agents',
            isReal: true,
            syncStatus: existingRow?.syncStatus || 'idle',
            favAction: existingRow?.favAction,
            editAction: existingRow?.editAction,
            itemType: 'agent',
            category: 'agent',
            urls: [],            
            updated_at: agent.updated_at || agent.createdAt,
            tags: agent.tags || agent.tagIds || [],
            tagIds: agent.tagIds || agent.tags || [],
          };
          realChatAgents.push(rowData);
        });
      }

      // Process Commands
      (useDbStore.getState().commands || []).forEach(cmd => {
        if (cmd.showInDashboard === false) return;
        if (cmd.surface === 'website' || cmd.category === 'thissite_action' || cmd.category === 'page_action') return;
        const cmdId = `cmd_${cmd.id}`;
        const compoundId = `${cmdId}_${cmd.type || 'general'}`;
        const lookupKey = resolveCommandLookupKey(cmd as any, [hotkeysMap, shortcutsMap]);
        const hotkey = hotkeysMap ? hotkeysMap[lookupKey] || hotkeysMap[compoundId] || hotkeysMap[cmd.id] || '' : '';
        const shortcut = shortcutsMap ? shortcutsMap[lookupKey] || shortcutsMap[compoundId] || shortcutsMap[cmd.id] || '' : '';
        const existingRow = state.tableData.find((r: any) => r.type === 'data' && r.id === cmdId) as any;

        const rowData: any = {
          type: 'data',
          id: cmdId,
          name: cmd.label,
          url: cmd.urlTemplate,
          workspace_id: null,
          folder_id: null,
          folder: 'System',
          path: '💻 System Commands',
          plainPath: 'System',
          visibilityType: 'personal',
          fav: isFavorite(cmdId, compoundId),
          // favourite_id removed
          key: hotkey,
          command: shortcut || cmd.prefix || '',
          section: cmd.category === 'browser' ? 'Browser Commands' : 'System Commands',
          isReal: true,
          syncStatus: existingRow?.syncStatus || 'idle',
          favAction: existingRow?.favAction,
          editAction: existingRow?.editAction,
          itemType: 'command',
          category: cmd.category === 'browser' ? 'commands' : 'general_commands',
          urls: [],
                updated_at: 0,
        };
        browserCommands.push(rowData);
      });

      // Process Bookmarks
      if (Array.isArray(bookmarks)) {
        bookmarks.forEach((bm: any) => {
          const bmId = `bookmark_${bm.id}`;
          const compoundId = `${bmId}_bookmark`;
          const hotkey = hotkeysMap ? hotkeysMap[compoundId] || '' : '';
          const shortcut = shortcutsMap ? shortcutsMap[compoundId] || '' : '';
          const existingRow = state.tableData.find((r: any) => r.type === 'data' && r.id === bmId) as any;

          const rowData: any = {
            type: 'data',
          id: bmId,
          name: bm.title || bm.url,
          url: bm.url,
          workspace_id: null,
          folder_id: null,
          folder: 'Bookmarks',
          path: '🔖 Chrome Bookmarks',
          plainPath: 'Bookmarks',
            visibilityType: 'personal',
            fav: isFavorite(bmId, compoundId),
            // favourite_id removed
            key: hotkey,
            command: shortcut,
            section: 'Bookmarks',
            isReal: true,
            syncStatus: existingRow?.syncStatus || 'idle',
            favAction: existingRow?.favAction,
            editAction: existingRow?.editAction,
            itemType: 'bookmark',
            category: 'bookmark',
            urls: [bm.url],
            updated_at: bm.dateAdded || 0,
          };
          realBookmarks.push(rowData);
        });
      }

      realNotes.sort((a, b) => b.updated_at - a.updated_at);
      realLinks.sort((a, b) => b.updated_at - a.updated_at);
      realSnippets.sort((a, b) => b.updated_at - a.updated_at);
      realTodos.sort((a, b) => b.updated_at - a.updated_at);

      realAutomations.sort((a, b) => b.updated_at - a.updated_at);
      realChatAgents.sort((a, b) => b.updated_at - a.updated_at);
      realBookmarks.sort((a, b) => b.updated_at - a.updated_at);
      browserCommands.sort((a, b) => b.updated_at - a.updated_at);

      let newTableData = [
        { type: 'section', title: 'Smart Links' },
        ...realLinks,
        { type: 'section', title: 'Tab Sessions' },
        ...realSessions,
        { type: 'section', title: 'Notes' },
        ...realNotes,
        { type: 'section', title: 'Snippets' },
        ...realSnippets,
        { type: 'section', title: 'Todos' },
        ...realTodos,

        { type: 'section', title: 'Browser Commands' },
        ...browserCommands,
        { type: 'section', title: 'Saved Automations' },
        ...realAutomations,
        { type: 'section', title: 'Chat Agents' },
        ...realChatAgents,
      ];
      newTableData.forEach(row => {
        if (deletingRowsMap.has(String(row.id))) {
          row.isDeleting = true;
          row.deleteTimer = deletingRowsMap.get(String(row.id));
        }
      });

      return { tableData: newTableData };
    });
  },

  isFilterMenuOpen: false,
  setFilterMenuOpen: (open: boolean) => set({ isFilterMenuOpen: open }),
}));
