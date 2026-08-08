import { useCallback } from 'react';
import type * as React from 'react';
import type { Attachment, AnyCommandId, FooterStatus } from '../utilityFunctions/types';

interface UseKeyboardNavigationProps {
  value: string;
  setValue: (val: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  lastActionRef: React.MutableRefObject<'backspace' | 'typing' | null>;
  activeSlashFilterRef: React.MutableRefObject<string | null>;
  pendingUserFocusRef: React.MutableRefObject<boolean>;
  selectionSourceRef: React.MutableRefObject<string | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;

  activeSlashFilter: string | null;
  setActiveSlashFilter: (filter: string | null) => void;
  onQueryChange?: (val: string) => void;
  activeCollection: any;

  lockedCommand: AnyCommandId | null;
  setLockedCommand: (cmd: AnyCommandId | null) => void;
  selectedImages: Attachment[];
  setSelectedImages: React.Dispatch<React.SetStateAction<Attachment[]>>;
  mentionedTabs: any[];
  setMentionedTabs: (tabs: any[]) => void;
  selectedAtCommand: any;
  setSelectedAtCommand: (cmd: any) => void;
  commandPrompt: string;
  setCommandPrompt: (prompt: string) => void;
  setFooterStatus: (status: FooterStatus) => void;
  onNavigateBack?: () => void;
  isInitialAltSFocus?: boolean;
  onInitialAltSFocusChange?: (val: boolean) => void;

  showSavedAgentsMenu: boolean;
  setShowSavedAgentsMenu: (val: boolean) => void;
  savedAgentSuggestions: any[];
  setSavedAgentSuggestions: (suggestions: any[]) => void;
  savedAgentHighlightIndex: number;
  setSavedAgentHighlightIndex: React.Dispatch<React.SetStateAction<number>>;
  handleSavedAgentSelection: (agent: any) => void;

  showAtCommandMenu: boolean;
  setShowAtCommandMenu: (val: boolean) => void;
  filteredAtCommands: any[];
  atCommandHighlightIndex: number;
  setAtCommandHighlightIndex: React.Dispatch<React.SetStateAction<number>>;
  handleAtCommandSelect: (id: string) => void;

  isContextualPopupOpen: boolean;
  contextualPopupIndex: number;
  setContextualPopupIndex: React.Dispatch<React.SetStateAction<number>>;
  contextualMatches: any[];
  handleContextualSelect: (match: any) => void;

  showPromptMenu: boolean;
  setShowPromptMenu: (val: boolean) => void;
  promptSuggestions: any[];
  setPromptSuggestions: (suggestions: any[]) => void;
  promptHighlightIndex: number;
  setPromptHighlightIndex: React.Dispatch<React.SetStateAction<number>>;
  handlePromptMenuSelect: (suggestion: any) => void;
  loadPromptSuggestions: () => void;

  selectedCommand: any;
  setSelectedCommand: (cmd: any) => void;
  commandSupportsInlineQuery: (cmd: any) => boolean;
  activateSelectedCommand: () => void;

  pendingQueryUrls: string[] | null;
  allSuggestions: any[];
  highlightIndex: number;
  setHighlightIndex: React.Dispatch<React.SetStateAction<number>>;

  inlineAutocomplete: string | null;
  setInlineAutocomplete: (text: string | null) => void;
  inlineComposerActive: boolean;

  submitInlineQuery: () => void;
  handleSubmit: (altKey: boolean) => void;
  onRequestFocusChange?: (direction: 'up' | 'down') => void;
  isSuggestionVisible: boolean;
  updateCursorPosition: () => void;
  slashFilterMeta?: Record<string, { label: string }>;
}

export function useKeyboardNavigation({
  value,
  setValue,
  inputRef,
  lastActionRef,
  activeSlashFilterRef,
  pendingUserFocusRef,
  selectionSourceRef,
  fileInputRef,

  activeSlashFilter,
  setActiveSlashFilter,
  onQueryChange,
  activeCollection,

  lockedCommand,
  setLockedCommand,
  selectedImages,
  setSelectedImages,
  mentionedTabs,
  setMentionedTabs,
  selectedAtCommand,
  setSelectedAtCommand,
  commandPrompt,
  setCommandPrompt,
  setFooterStatus,
  onNavigateBack,
  isInitialAltSFocus,
  onInitialAltSFocusChange,

  showSavedAgentsMenu,
  setShowSavedAgentsMenu,
  savedAgentSuggestions,
  setSavedAgentSuggestions,
  savedAgentHighlightIndex,
  setSavedAgentHighlightIndex,
  handleSavedAgentSelection,

  showAtCommandMenu,
  setShowAtCommandMenu,
  filteredAtCommands,
  atCommandHighlightIndex,
  setAtCommandHighlightIndex,
  handleAtCommandSelect,

  isContextualPopupOpen,
  contextualPopupIndex,
  setContextualPopupIndex,
  contextualMatches,
  handleContextualSelect,

  showPromptMenu,
  setShowPromptMenu,
  promptSuggestions,
  setPromptSuggestions,
  promptHighlightIndex,
  setPromptHighlightIndex,
  handlePromptMenuSelect,
  loadPromptSuggestions,

  selectedCommand,
  setSelectedCommand,
  commandSupportsInlineQuery,
  activateSelectedCommand,

  pendingQueryUrls,
  allSuggestions,
  highlightIndex,
  setHighlightIndex,

  inlineAutocomplete,
  setInlineAutocomplete,
  inlineComposerActive,

  submitInlineQuery,
  handleSubmit,
  onRequestFocusChange,
  isSuggestionVisible,
  updateCursorPosition,
  slashFilterMeta,
}: UseKeyboardNavigationProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      setTimeout(updateCursorPosition, 0);

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        lastActionRef.current = 'typing';
      }

      // Handle space bar after a shorthand board view filter command to convert to locked card
      if (e.key === ' ') {
        const text = (inputRef.current?.innerText || '').replace(/\u00A0/g, ' ').trim().toLowerCase();
        let filterChar = '';
        if (slashFilterMeta) {
          const isSlashInput = text.startsWith('/');
          const textWithoutSlash = text.startsWith('/') ? text.substring(1) : text;
          const matchedMeta = slashFilterMeta[textWithoutSlash];
          if (!isSlashInput && matchedMeta?.label === 'Commands') {
            filterChar = '';
          } else if (matchedMeta) {
            filterChar = textWithoutSlash;
          } else {
            for (const [alias, meta] of Object.entries(slashFilterMeta)) {
               if (meta.label.toLowerCase() === text) { filterChar = alias; break; }
            }
          }
        } else {
          const labelToFilterChar: Record<string, string> = {
            '/a': 'a', '/n': 'n', '/nm': 'nm', '/s': 'se', '/sn': 'sn', '/p': 'p', '/l': 'l', '/c': 'c', '/b': 'bm', '/bm': 'bm', '/t': 't',
            '/sc': 'sc', '/se': 'se', '/au': 'au', '/ca': 'ca', '/g': 'g',
            'all': 'a', 'notes': 'n', 'snippets': 'sn', 'prompts': 'p', 'links': 'l', 'bookmarks': 'bm', 'todos': 't', 'tab sessions': 'se', 'chat agents': 'g',
          };
          filterChar = labelToFilterChar[text];
        }

        if (filterChar) {
          e.preventDefault();
          e.stopPropagation();
          activeSlashFilterRef.current = filterChar;
          setActiveSlashFilter(filterChar);
          setValue('');
          onQueryChange?.(`/${filterChar.toUpperCase()} `);
          return;
        }
      }

      if (e.key === 'Enter' && activeCollection) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }



      if (e.key === 'Backspace') {
        lastActionRef.current = 'backspace';
        const hasSelection = false;
        const hasEditableSlashChip = !!inputRef.current?.querySelector('[data-slash-filter-chip="true"]');
        const editableTextWithoutSlashChip = (() => {
          const inputEl = inputRef.current;
          if (!inputEl) return value;
          const clone = inputEl.cloneNode(true) as HTMLElement;
          clone.querySelectorAll('[data-slash-filter-chip="true"]').forEach(node => node.remove());
          return (clone.textContent || '').replace(/\u00A0/g, ' ').trim();
        })();

        let isShortcutText = false;
        const normalizedVal = value.trim().toLowerCase();
        if (slashFilterMeta) {
          const valWithoutSlash = normalizedVal.startsWith('/') ? normalizedVal.substring(1) : normalizedVal;
          isShortcutText = !!slashFilterMeta[valWithoutSlash];
        } else {
          isShortcutText = [
            '/a', '/n', '/s', '/p', '/l', '/c', '/b', '/t', '/se', '/au', '/ca',
            'a', 'n', 's', 'p', 'l', 'c', 'b', 't', 'se', 'au', 'ca'
          ].includes(normalizedVal);
        }

        if (hasEditableSlashChip && !editableTextWithoutSlashChip && !hasSelection) {
          e.preventDefault();
          e.stopPropagation();
          activeSlashFilterRef.current = null;
          setActiveSlashFilter(null);
          setValue('');
          if (inputRef.current) {
            inputRef.current.innerHTML = '';
            inputRef.current.innerText = '';
          }
          onQueryChange?.('');
          return;
        }

        if (activeSlashFilter && value.trim() === '' && !hasSelection) {
          e.preventDefault();
          e.stopPropagation();
          activeSlashFilterRef.current = null;
          setActiveSlashFilter(null);
          setValue('');
          if (inputRef.current) {
            inputRef.current.innerHTML = '';
            inputRef.current.innerText = '';
          }
          onQueryChange?.('');
          return;
        }

        if ((value.trim() === '' || isShortcutText) && !hasSelection) {

          if (isShortcutText) {
            e.preventDefault();
            e.stopPropagation();
            setValue('');
            if (inputRef.current) {
              inputRef.current.innerHTML = '';
              inputRef.current.innerText = '';
            }
            onQueryChange?.('');
            return;
          }
          if (selectedImages.length > 0) {
            e.preventDefault();
            setSelectedImages(prev => prev.slice(0, -1));
            return;
          }
          if (mentionedTabs.length > 0) {
            e.preventDefault();
            e.stopPropagation();

            const editable = inputRef.current;
            if (editable) {
              const pills = editable.querySelectorAll('span[data-tab-id]');
              if (pills.length > 0) {
                const lastPillDom = pills[pills.length - 1];
                const nextSib = lastPillDom.nextSibling;
                if (nextSib && nextSib.nodeType === Node.TEXT_NODE && nextSib.nodeValue === '\u00A0') {
                  nextSib.remove();
                }
                lastPillDom.remove();
              }
            }

            const remainingTabs = mentionedTabs.slice(0, -1);
            setMentionedTabs(remainingTabs);

            // If deleting the last pill leaves everything empty, immediately unlock the command
            if (
              remainingTabs.length === 0 &&
              selectedImages.length === 0 &&
              !value.trim() &&
              lockedCommand
            ) {
              setLockedCommand(null);
              setValue('');
              setCommandPrompt('');
              setFooterStatus(null);
              onNavigateBack?.();
            }

            return;
          }
          if (selectedAtCommand) {
            e.preventDefault();
            e.stopPropagation();
            setSelectedAtCommand(null);
            return;
          }
          if (lockedCommand) {
            e.preventDefault();
            e.stopPropagation();
            setLockedCommand(null);
            setValue('');
            setCommandPrompt('');
            if (inputRef.current) {
              inputRef.current.innerHTML = '';
              inputRef.current.innerText = '';
            }
            setFooterStatus(null);
            onNavigateBack?.();
            return;
          }
          // Reset Alt+S initial state on Backspace when bar is empty
          if (isInitialAltSFocus && onInitialAltSFocusChange) {
            e.preventDefault();
            onInitialAltSFocusChange(false);
            return;
          }
        }
      }

      if (showSavedAgentsMenu && savedAgentSuggestions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          setSavedAgentHighlightIndex(prev => (prev < savedAgentSuggestions.length - 1 ? prev + 1 : 0));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          setSavedAgentHighlightIndex(prev => (prev > 0 ? prev - 1 : savedAgentSuggestions.length - 1));
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          const targetAgent = savedAgentSuggestions[savedAgentHighlightIndex];
          if (targetAgent) {
            handleSavedAgentSelection(targetAgent);
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          setShowSavedAgentsMenu(false);
          setSavedAgentSuggestions([]);
          return;
        }
      }

      if (showAtCommandMenu) {
        const filteredCmds = filteredAtCommands;
        const hasCommands = filteredCmds.length > 0;
        const maxIndex = Math.max(0, filteredCmds.length - 1);
        if (hasCommands && e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          setAtCommandHighlightIndex(prev => (prev > 0 ? prev - 1 : maxIndex));
          return;
        }
        if (hasCommands && e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          setAtCommandHighlightIndex(prev => (prev < maxIndex ? prev + 1 : 0));
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          e.stopPropagation();
          const selectedCmd = filteredCmds[atCommandHighlightIndex];
          if (selectedCmd) handleAtCommandSelect(selectedCmd.id);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          setShowAtCommandMenu(false);
          return;
        }
      }

      if (isContextualPopupOpen && contextualPopupIndex >= 0) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          setContextualPopupIndex(prev => (prev > 0 ? prev - 1 : contextualMatches.length - 1));
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          setContextualPopupIndex(prev => (prev < contextualMatches.length - 1 ? prev + 1 : 0));
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          setContextualPopupIndex(-1);
          return;
        }
      }

      const altDigitMatch =
        isContextualPopupOpen && contextualMatches.length > 0 && e.altKey && !e.ctrlKey && !e.metaKey
          ? e.code.match(/^(Digit|Numpad)([1-9])$/) || (e.key.match(/^[1-9]$/) ? ['_', '_', e.key] : null)
          : null;
      if (altDigitMatch) {
        const matchIndex = Number(altDigitMatch[2]) - 1;
        if (matchIndex >= 0 && matchIndex < contextualMatches.length) {
          e.preventDefault();
          e.stopPropagation();
          handleContextualSelect(contextualMatches[matchIndex]);
        }
        return;
      }

      if (e.key === 'Tab' && !showPromptMenu && !lockedCommand && !showAtCommandMenu) {
        if (contextualMatches.length > 0) {
          e.preventDefault();
          e.stopPropagation();

          if (e.shiftKey) {
            // Shift+Tab moved back to main list
            setContextualPopupIndex(-1);
            return;
          }

          if (contextualPopupIndex === -1) {
            setContextualPopupIndex(0);
          } else {
            setContextualPopupIndex(prev => (prev + 1) % contextualMatches.length);
          }
          return;
        }

        if (!e.shiftKey) {
          e.preventDefault();
          loadPromptSuggestions();
          setPromptHighlightIndex(0);
          setShowPromptMenu(true);
          return;
        }
      }

      if (showPromptMenu) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          setPromptHighlightIndex(prev => (prev > 0 ? prev - 1 : promptSuggestions.length - 1));
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          setPromptHighlightIndex(prev => (prev < promptSuggestions.length - 1 ? prev + 1 : 0));
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          if (promptSuggestions[promptHighlightIndex]) {
            handlePromptMenuSelect(promptSuggestions[promptHighlightIndex]);
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          setShowPromptMenu(false);
          setPromptSuggestions([]);
          return;
        }
        if (e.key === 'Tab') {
          e.preventDefault();
          e.stopPropagation();
          setPromptHighlightIndex(prev => (prev < promptSuggestions.length - 1 ? prev + 1 : 0));
          return;
        }
      }

      if (!lockedCommand && commandSupportsInlineQuery(selectedCommand) && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        activateSelectedCommand();
        return;
      }

      const isDefaultViewNavigation =
        !pendingQueryUrls && !isSuggestionVisible && !lockedCommand && value.trim().length === 0;
      if (isDefaultViewNavigation) {
        if (e.key === 'ArrowDown') {
          onRequestFocusChange?.('down');
          return;
        }
        if (e.key === 'ArrowUp') {
          onRequestFocusChange?.('up');
          return;
        }
      }

      if (e.key === 'ArrowDown') {
        if (allSuggestions.length === 0) return;
        e.preventDefault();
        setHighlightIndex(prev => (prev >= allSuggestions.length - 1 ? 0 : prev + 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        if (allSuggestions.length === 0) return;
        e.preventDefault();
        setHighlightIndex(prev => (prev <= 0 ? allSuggestions.length - 1 : prev - 1));
        return;
      }

      if (e.key === 'ArrowRight') {
        const editable = e.currentTarget;
        const selection = window.getSelection();
        const cursorAtEnd =
          selection && selection.rangeCount > 0
            ? selection.getRangeAt(0).endOffset >= (editable.innerText || '').length
            : false;

        if (cursorAtEnd && inlineAutocomplete && highlightIndex === 0 && allSuggestions.length > 0) {
          const firstItem = allSuggestions[0];
          if (firstItem._kind === 'history' || firstItem._kind === 'bookmark') {
            e.preventDefault();
            const url = (firstItem as any).url || '';
            if (url) {
              const displayUrl = url.replace(/^https?:\/\//, '').replace(/^www\./, '');
              setValue(displayUrl);
              setInlineAutocomplete(null);

              setTimeout(() => {
                editable.focus();
                const newRange = document.createRange();
                newRange.selectNodeContents(editable);
                newRange.collapse(false); // collapse to end
                selection?.removeAllRanges();
                selection?.addRange(newRange);
              }, 0);
            }
            return;
          }
        }
      }

      if (e.key === 'Enter') {
        if (contextualPopupIndex >= 0 && contextualPopupIndex < contextualMatches.length) {
          e.preventDefault();
          e.stopPropagation();
          handleContextualSelect(contextualMatches[contextualPopupIndex]);
          return;
        }

        if (pendingQueryUrls && pendingQueryUrls.length > 0) {
          e.preventDefault();
          submitInlineQuery();
          return;
        }
        if (inlineComposerActive && lockedCommand !== 'ai') return;
        e.preventDefault();
        handleSubmit(e.altKey);
        return;
      }

      if (e.key === 'Escape') {
        if (selectedAtCommand) {
          e.preventDefault();
          e.stopPropagation();
          setSelectedAtCommand(null);
          setSelectedCommand(null);
          selectionSourceRef.current = null;
          return;
        }
        if (!lockedCommand && selectedCommand) {
          e.preventDefault();
          e.stopPropagation();
          selectionSourceRef.current = null;
          setSelectedCommand(null);
          return;
        }
        if (lockedCommand) {
          e.preventDefault();
          e.stopPropagation();
          setLockedCommand(null);
          setFooterStatus(null);
          return;
        }

        if (value === '') {
          // Reset Alt+S initial state on Escape when bar is empty
          if (isInitialAltSFocus && onInitialAltSFocusChange) {
            e.preventDefault();
            e.stopPropagation();
            onInitialAltSFocusChange(false);
            inputRef.current?.blur();
            return;
          }
          // Hierarchical ESC: Blur search if search is already empty
          e.preventDefault();
          e.stopPropagation();
          inputRef.current?.blur();
          return;
        }
        onNavigateBack?.();
      }
    },
    [
      updateCursorPosition,
      lastActionRef,
      inputRef,
      activeSlashFilterRef,
      setActiveSlashFilter,
      setValue,
      onQueryChange,
      activeCollection,
      lockedCommand,
      fileInputRef,
      value,
      activeSlashFilter,
      selectedImages,
      setSelectedImages,
      mentionedTabs,
      setMentionedTabs,
      setLockedCommand,
      setCommandPrompt,
      setFooterStatus,
      onNavigateBack,
      selectedAtCommand,
      setSelectedAtCommand,
      isInitialAltSFocus,
      onInitialAltSFocusChange,
      showSavedAgentsMenu,
      savedAgentSuggestions,
      setSavedAgentHighlightIndex,
      handleSavedAgentSelection,
      setShowSavedAgentsMenu,
      setSavedAgentSuggestions,
      showAtCommandMenu,
      filteredAtCommands,
      setAtCommandHighlightIndex,
      atCommandHighlightIndex,
      handleAtCommandSelect,
      setShowAtCommandMenu,
      isContextualPopupOpen,
      contextualPopupIndex,
      setContextualPopupIndex,
      contextualMatches,
      handleContextualSelect,
      showPromptMenu,
      setPromptHighlightIndex,
      promptSuggestions,
      handlePromptMenuSelect,
      setShowPromptMenu,
      setPromptSuggestions,
      promptHighlightIndex,
      loadPromptSuggestions,
      selectedCommand,
      commandSupportsInlineQuery,
      activateSelectedCommand,
      pendingQueryUrls,
      isSuggestionVisible,
      onRequestFocusChange,
      allSuggestions,
      setHighlightIndex,
      inlineAutocomplete,
      setInlineAutocomplete,
      highlightIndex,
      submitInlineQuery,
      inlineComposerActive,
      handleSubmit,
      selectionSourceRef,
      setSelectedCommand,
    ],
  );

  return { handleKeyDown };
}
