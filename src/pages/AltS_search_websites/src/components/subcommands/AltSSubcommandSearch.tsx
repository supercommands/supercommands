import type React from 'react';
import { BsCalendarCheck } from 'react-icons/bs';
import { FaBookmark, FaCode, FaLayerGroup, FaLink } from 'react-icons/fa';
import { FiFileText, FiSend, FiTerminal } from 'react-icons/fi';
import { LuSparkles } from 'react-icons/lu';
import type { CompactSubcommandMode } from '../../state/altSCommandTypes';

type IndexUpdater = number | ((prev: number) => number);

interface AltSSubcommandSearchProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
  mode: CompactSubcommandMode;
  value: string;
  items: any[];
  selectedIndex: number;
  setSelectedIndex: (next: IndexUpdater) => void;
  setDropdownVisible: (visible: boolean) => void;
  setValue: (value: string) => void;
  onExit: () => void;
  onEnter: () => void;
  onTab?: () => void;
  onBackspace?: (value: string, cursorPosition: number | null) => boolean;
  hasLeadingCreateRow?: boolean;
  placeholder?: string;
  rightHint?: React.ReactNode;
}

const iconClassName = 'w-3.5 h-3.5 shrink-0 text-[var(--alts-icon-color)]';

const isCreateFirstMode = (mode: CompactSubcommandMode) =>
  mode === 'existing_collection' ||
  mode === 'save_link' ||
  mode === 'save_todo' ||
  mode === 'save_note' ||
  mode === 'save_snippet' ||
  mode === 'save_chat';

const getSubcommandMeta = (mode: CompactSubcommandMode) => {
  switch (mode) {
    case 'existing_collection':
      return {
        label: 'Existing Collection',
        inputLabel: 'Search collections in Existing Collection',
        placeholder: 'Search collections to assign...',
        icon: <FaLayerGroup className={iconClassName} />,
      };
    case 'save_link':
      return {
        label: 'Link save',
        inputLabel: 'Search saved links in Link save',
        placeholder: 'Search links to assign...',
        icon: <FaLink className={iconClassName} />,
      };
    case 'save_todo':
      return {
        label: 'To Do save',
        inputLabel: 'Search todos in To Do save',
        placeholder: 'Search todos to assign...',
        icon: <BsCalendarCheck className={iconClassName} />,
      };
    case 'save_note':
      return {
        label: 'Note save',
        inputLabel: 'Search notes in Note save',
        placeholder: 'Search notes to assign...',
        icon: <FiFileText className={iconClassName} />,
      };
    case 'save_snippet':
      return {
        label: 'Text Expander save',
        inputLabel: 'Search text expanders in Text Expander save',
        placeholder: 'Search text expanders...',
        icon: <FaCode className={iconClassName} />,
      };
    case 'save_chat':
      return {
        label: 'Chat Agent',
        inputLabel: 'Search chat agents in Chat Agent save',
        placeholder: 'Search chat agents to assign...',
        icon: <LuSparkles className={iconClassName} />,
      };
    case 'send_to_agent':
      return {
        label: 'Send to Agent',
        inputLabel: 'Search agents in Send to Agent',
        placeholder: 'Type a command or search...',
        icon: <FiSend className={iconClassName} />,
      };
    case 'category_link':
      return {
        label: 'Links',
        inputLabel: 'Search links',
        placeholder: 'Type a command or search...',
        icon: <FaLink className={iconClassName} />,
      };
    case 'category_snippet':
      return {
        label: 'Text Expanders',
        inputLabel: 'Search text expanders',
        placeholder: 'Type a command or search...',
        icon: <FaCode className={iconClassName} />,
      };
    case 'category_todo':
      return {
        label: 'Todos',
        inputLabel: 'Search todos',
        placeholder: 'Type a command or search...',
        icon: <BsCalendarCheck className={iconClassName} />,
      };
    case 'category_bookmark':
      return {
        label: 'Bookmarks',
        inputLabel: 'Search bookmarks',
        placeholder: 'Type a command or search...',
        icon: <FaBookmark className={iconClassName} />,
      };
    case 'category_command':
      return {
        label: 'Commands',
        inputLabel: 'Search text commands',
        placeholder: 'Type a command or search...',
        icon: <FiTerminal className={iconClassName} />,
      };
    case 'category_collection':
      return {
        label: 'Collections',
        inputLabel: 'Search collections',
        placeholder: 'Type a command or search...',
        icon: <FaLayerGroup className={iconClassName} />,
      };
    case 'category_prompt':
      return {
        label: 'Chat Agents',
        inputLabel: 'Search prompts',
        placeholder: 'Type a command or search...',
        icon: <LuSparkles className={iconClassName} />,
      };
    case 'category_note':
    default:
      return {
        label: 'Notes',
        inputLabel: 'Search notes',
        placeholder: 'Type a command or search...',
        icon: <FiFileText className={iconClassName} />,
      };
  }
};

export default function AltSSubcommandSearch({
  inputRef,
  mode,
  value,
  items,
  selectedIndex,
  setSelectedIndex,
  setDropdownVisible,
  setValue,
  onExit,
  onEnter,
  onTab,
  onBackspace,
  hasLeadingCreateRow = false,
  placeholder,
  rightHint,
}: AltSSubcommandSearchProps) {
  const meta = getSubcommandMeta(mode);
  const totalCount = isCreateFirstMode(mode) || hasLeadingCreateRow ? 1 + items.length : items.length;
  const activeDescendant =
    totalCount > 0 && selectedIndex >= 0
      ? `alts-dropdown-item-${Math.min(selectedIndex, totalCount - 1)}`
      : undefined;

  return (
    <div className="flex-1 flex flex-col justify-center w-full py-2.5 px-3 gap-2">
      <div className="flex items-center">
        <div
          id="alts-submode-title"
          onClick={onExit}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--alts-row-hover-bg)] border border-[var(--alts-border-color)] text-[12.5px] font-medium leading-none text-[var(--alts-text-primary)] shrink-0 select-none shadow-sm cursor-pointer hover:opacity-90"
          title="Remove pill · Backspace / Esc">
          {meta.icon}
          <span className="truncate max-w-[360px]">{meta.label}</span>
        </div>
      </div>

      <div className="flex min-w-0 w-full items-center gap-3">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={meta.inputLabel}
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls="alts-submode-results"
          aria-activedescendant={activeDescendant}
          value={value}
          onFocus={() => setDropdownVisible(true)}
          onClick={() => setDropdownVisible(true)}
          onChange={event => {
            setValue(event.target.value);
            setDropdownVisible(true);
          }}
          onKeyDownCapture={event => {
            if (event.key !== 'Tab' || !onTab) return;
            event.preventDefault();
            event.stopPropagation();
            event.nativeEvent.stopImmediatePropagation?.();
            onTab();
          }}
          onKeyDown={event => {
            event.stopPropagation();

            if (
              event.key === 'Backspace' &&
              onBackspace?.(value, event.currentTarget.selectionStart)
            ) {
              event.preventDefault();
              event.nativeEvent.stopImmediatePropagation?.();
              return;
            }

            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setDropdownVisible(true);
              setSelectedIndex(prev => (totalCount ? (prev + 1) % totalCount : 0));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setDropdownVisible(true);
              setSelectedIndex(prev => (totalCount ? (prev - 1 + totalCount) % totalCount : 0));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              event.nativeEvent.stopImmediatePropagation?.();
              onEnter();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              onExit();
            } else if (
              event.key === 'Backspace' &&
              value === '' &&
              !(event.nativeEvent as any)?.isComposing &&
              !event.repeat &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.altKey
            ) {
              event.preventDefault();
              onExit();
            }
          }}
          onKeyUp={event => event.stopPropagation()}
          placeholder={placeholder || meta.placeholder}
          className="min-w-0 flex-1 bg-transparent border-none text-[18px] font-normal caret-[var(--alts-text-primary)] placeholder-[var(--alts-text-placeholder)] focus:outline-none focus:ring-0 p-0 z-10 text-[var(--alts-text-primary)]"
        />
        {rightHint ? (
          <div className="ml-auto flex shrink-0 items-center justify-end text-[11px] font-medium text-[var(--alts-shortcut-text)]">
            {rightHint}
          </div>
        ) : null}
      </div>
    </div>
  );
}
