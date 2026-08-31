import { create } from 'zustand';
import type { AltSOverlayMode, AltSPageTarget, CompactSubcommandMode } from './altSCommandTypes';

type IndexUpdater = number | ((prev: number) => number);

interface AltSCommandStoreState {
  dropdownSelectedIndex: number;
  compactSubcommandMode: CompactSubcommandMode;
  collectionSearchValue: string;
  linkSaveSearchValue: string;
  todoSaveSearchValue: string;
  noteSaveSearchValue: string;
  snippetSaveSearchValue: string;
  agentSearchValue: string;
  categorySearchValue: string;
  existingCollectionTarget: AltSPageTarget | null;
  linkSaveTarget: AltSPageTarget | null;
  todoSaveTarget: AltSPageTarget | null;
  noteSaveTarget: AltSPageTarget | null;
  snippetSaveTarget: AltSPageTarget | null;
  sendToAgentTarget: AltSPageTarget | null;
  overlayMode: AltSOverlayMode;
  overlayPreviousSubcommandMode: CompactSubcommandMode;
  linkEditorTarget: AltSPageTarget | null;
  todoEditorTarget: AltSPageTarget | null;
  noteEditorTarget: AltSPageTarget | null;
  snippetEditorTarget: AltSPageTarget | null;
  aiPromptEditorTarget: AltSPageTarget | null;
  setDropdownSelectedIndex: (next: IndexUpdater) => void;
  setCompactSubcommandMode: (mode: CompactSubcommandMode) => void;
  setCollectionSearchValue: (value: string) => void;
  setLinkSaveSearchValue: (value: string) => void;
  setTodoSaveSearchValue: (value: string) => void;
  setNoteSaveSearchValue: (value: string) => void;
  setSnippetSaveSearchValue: (value: string) => void;
  setAgentSearchValue: (value: string) => void;
  setCategorySearchValue: (value: string) => void;
  setExistingCollectionTarget: (target: AltSPageTarget | null) => void;
  setLinkSaveTarget: (target: AltSPageTarget | null) => void;
  setTodoSaveTarget: (target: AltSPageTarget | null) => void;
  setNoteSaveTarget: (target: AltSPageTarget | null) => void;
  setSnippetSaveTarget: (target: AltSPageTarget | null) => void;
  setSendToAgentTarget: (target: AltSPageTarget | null) => void;
  openSubcommandMode: (mode: CompactSubcommandMode, options?: { query?: string; target?: AltSPageTarget }) => void;
  openLinkEditorOverlay: (target: AltSPageTarget, options?: { previousMode?: CompactSubcommandMode }) => void;
  openTodoEditorOverlay: (target: AltSPageTarget, options?: { previousMode?: CompactSubcommandMode }) => void;
  openNoteEditorOverlay: (target: AltSPageTarget, options?: { previousMode?: CompactSubcommandMode }) => void;
  openSnippetEditorOverlay: (target: AltSPageTarget, options?: { previousMode?: CompactSubcommandMode }) => void;
  openAiPromptEditorOverlay: (target: AltSPageTarget, options?: { previousMode?: CompactSubcommandMode }) => void;
  closeOverlayToPreviousSubcommand: () => void;
  completeOverlay: () => void;
  resetSubcommandMode: () => void;
}

const resetSubcommandFields = {
  compactSubcommandMode: 'none' as CompactSubcommandMode,
  collectionSearchValue: '',
  linkSaveSearchValue: '',
  todoSaveSearchValue: '',
  noteSaveSearchValue: '',
  snippetSaveSearchValue: '',
  agentSearchValue: '',
  categorySearchValue: '',
  existingCollectionTarget: null,
  linkSaveTarget: null,
  todoSaveTarget: null,
  noteSaveTarget: null,
  snippetSaveTarget: null,
  sendToAgentTarget: null,
  overlayMode: 'none' as AltSOverlayMode,
  overlayPreviousSubcommandMode: 'none' as CompactSubcommandMode,
  linkEditorTarget: null,
  todoEditorTarget: null,
  noteEditorTarget: null,
  snippetEditorTarget: null,
  aiPromptEditorTarget: null,
  dropdownSelectedIndex: 0,
};

export const useAltSCommandStore = create<AltSCommandStoreState>((set, get) => ({
  ...resetSubcommandFields,
  setDropdownSelectedIndex: next =>
    set(state => ({
      dropdownSelectedIndex: typeof next === 'function' ? next(state.dropdownSelectedIndex) : next,
    })),
  setCompactSubcommandMode: compactSubcommandMode => set({ compactSubcommandMode }),
  setCollectionSearchValue: collectionSearchValue => set({ collectionSearchValue }),
  setLinkSaveSearchValue: linkSaveSearchValue => set({ linkSaveSearchValue }),
  setTodoSaveSearchValue: todoSaveSearchValue => set({ todoSaveSearchValue }),
  setNoteSaveSearchValue: noteSaveSearchValue => set({ noteSaveSearchValue }),
  setSnippetSaveSearchValue: snippetSaveSearchValue => set({ snippetSaveSearchValue }),
  setAgentSearchValue: agentSearchValue => set({ agentSearchValue }),
  setCategorySearchValue: categorySearchValue => set({ categorySearchValue }),
  setExistingCollectionTarget: existingCollectionTarget => set({ existingCollectionTarget }),
  setLinkSaveTarget: linkSaveTarget => set({ linkSaveTarget }),
  setTodoSaveTarget: todoSaveTarget => set({ todoSaveTarget }),
  setNoteSaveTarget: noteSaveTarget => set({ noteSaveTarget }),
  setSnippetSaveTarget: snippetSaveTarget => set({ snippetSaveTarget }),
  setSendToAgentTarget: sendToAgentTarget => set({ sendToAgentTarget }),
  openSubcommandMode: (mode, options) => {
    const query = options?.query ?? '';
    const target = options?.target ?? null;

    set({
      ...resetSubcommandFields,
      compactSubcommandMode: mode,
      collectionSearchValue: mode === 'existing_collection' ? query : '',
      linkSaveSearchValue: mode === 'save_link' ? query : '',
      todoSaveSearchValue: mode === 'save_todo' ? query : '',
      noteSaveSearchValue: mode === 'save_note' ? query : '',
      snippetSaveSearchValue: mode === 'save_snippet' ? query : '',
      agentSearchValue: mode === 'send_to_agent' || mode === 'save_chat' ? query : '',
      categorySearchValue: mode.startsWith('category_') ? query : '',
      existingCollectionTarget: mode === 'existing_collection' ? target : null,
      linkSaveTarget: mode === 'save_link' ? target : null,
      todoSaveTarget: mode === 'save_todo' ? target : null,
      noteSaveTarget: mode === 'save_note' ? target : null,
      snippetSaveTarget: mode === 'save_snippet' ? target : null,
      sendToAgentTarget: mode === 'send_to_agent' || mode === 'save_chat' ? target : null,
    });
  },
  openLinkEditorOverlay: (target, options) => {
    const previousMode = options?.previousMode ?? get().compactSubcommandMode;
    set({
      overlayMode: 'create_link',
      overlayPreviousSubcommandMode: previousMode,
      linkEditorTarget: target,
      todoEditorTarget: null,
      noteEditorTarget: null,
      snippetEditorTarget: null,
      aiPromptEditorTarget: null,
      compactSubcommandMode: 'none',
      dropdownSelectedIndex: -1,
    });
  },
  openTodoEditorOverlay: (target, options) => {
    const previousMode = options?.previousMode ?? get().compactSubcommandMode;
    set({
      overlayMode: 'create_todo',
      overlayPreviousSubcommandMode: previousMode,
      linkEditorTarget: null,
      todoEditorTarget: target,
      noteEditorTarget: null,
      snippetEditorTarget: null,
      aiPromptEditorTarget: null,
      compactSubcommandMode: 'none',
      dropdownSelectedIndex: -1,
    });
  },
  openNoteEditorOverlay: (target, options) => {
    const previousMode = options?.previousMode ?? get().compactSubcommandMode;
    set({
      overlayMode: 'create_note',
      overlayPreviousSubcommandMode: previousMode,
      linkEditorTarget: null,
      todoEditorTarget: null,
      noteEditorTarget: target,
      snippetEditorTarget: null,
      aiPromptEditorTarget: null,
      compactSubcommandMode: 'none',
      dropdownSelectedIndex: -1,
    });
  },
  openSnippetEditorOverlay: (target, options) => {
    const previousMode = options?.previousMode ?? get().compactSubcommandMode;
    set({
      overlayMode: 'create_snippet',
      overlayPreviousSubcommandMode: previousMode,
      linkEditorTarget: null,
      todoEditorTarget: null,
      noteEditorTarget: null,
      snippetEditorTarget: target,
      aiPromptEditorTarget: null,
      compactSubcommandMode: 'none',
      dropdownSelectedIndex: -1,
    });
  },
  openAiPromptEditorOverlay: (target, options) => {
    const previousMode = options?.previousMode ?? get().compactSubcommandMode;
    set({
      overlayMode: 'create_ai_prompt',
      overlayPreviousSubcommandMode: previousMode,
      linkEditorTarget: null,
      todoEditorTarget: null,
      noteEditorTarget: null,
      snippetEditorTarget: null,
      aiPromptEditorTarget: target,
      compactSubcommandMode: 'none',
      dropdownSelectedIndex: -1,
    });
  },
  closeOverlayToPreviousSubcommand: () => {
    const previousMode = get().overlayPreviousSubcommandMode;
    const overlayMode = get().overlayMode;
    set({
      overlayMode: 'none',
      linkEditorTarget: null,
      todoEditorTarget: null,
      noteEditorTarget: null,
      snippetEditorTarget: null,
      aiPromptEditorTarget: null,
      compactSubcommandMode: previousMode === 'none' ? (
        overlayMode === 'create_todo'
          ? 'save_todo'
          : overlayMode === 'create_note'
            ? 'save_note'
            : overlayMode === 'create_snippet'
              ? 'save_snippet'
              : overlayMode === 'create_ai_prompt'
                ? 'save_chat'
              : 'save_link'
      ) : previousMode,
      dropdownSelectedIndex: 0,
    });
  },
  completeOverlay: () => {
    set({
      ...resetSubcommandFields,
    });
  },
  resetSubcommandMode: () => {
    const { dropdownSelectedIndex } = get();
    set({
      ...resetSubcommandFields,
      dropdownSelectedIndex: dropdownSelectedIndex === 0 ? dropdownSelectedIndex : 0,
    });
  },
}));
