import type React from 'react';
import clsx from 'clsx';
import { EditablePrefixKey } from '../../../../../shared-components/shortcuts/ui/EditablePrefixKey';

export const COMPACT_DROPDOWN_ITEM_BASE_CLASS =
  'alts-command-row w-[calc(100%-16px)] max-w-[calc(100%-16px)] overflow-hidden appearance-none border-0 px-3 min-h-[36px] flex items-center justify-between cursor-pointer transition-colors mx-2 rounded-lg font-[485] text-left text-[13px] group';
export const COMPACT_DROPDOWN_ITEM_SELECTED_CLASS =
  'bg-[var(--alts-row-selected-bg)] text-[var(--alts-text-primary)] shadow-none border border-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--alts-focus-color)]';
export const COMPACT_DROPDOWN_ITEM_UNSELECTED_CLASS =
  'bg-transparent text-[var(--alts-text-primary)] hover:bg-[var(--alts-row-hover-bg)] border border-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--alts-focus-color)]';
export const COMPACT_DROPDOWN_ITEM_LABEL_CLASS =
  'truncate text-[var(--alts-text-primary)] font-[485] leading-5';
export const COMPACT_DROPDOWN_ITEM_CONTENT_CLASS =
  'flex w-full min-w-0 max-w-full overflow-hidden items-center justify-between gap-5';
export const COMPACT_DROPDOWN_ITEM_PRIMARY_CLASS =
  'flex min-w-0 max-w-full flex-1 overflow-hidden items-center gap-3';
export const COMPACT_DROPDOWN_ITEM_TEXT_CLASS =
  'flex min-w-0 max-w-full flex-1 overflow-hidden items-baseline';
export const COMPACT_DROPDOWN_ITEM_ICON_CLASS = 'alts-icon-tile';
export const COMPACT_DROPDOWN_ITEM_RIGHT_META_CLASS =
  'mr-3 flex w-24 shrink-0 justify-end text-right text-[11px] font-medium text-[var(--alts-shortcut-text)]';

export const getIconTileCategory = (id: string) => {
  if (
    id === 'save_link' ||
    id === 'save_todo' ||
    id === 'save_note' ||
    id === 'save_snippet' ||
    id === 'add_to_existing' ||
    id === 'save_chat' ||
    id === 'saved_indicator'
  ) {
    return 'save-action';
  }
  if (id === 'send_to_agent' || id === 'summarize_page') return 'ai';
  if (id === 'capture_screenshot' || id === 'capture_clip_screenshot' || id === 'capture_full_screenshot') {
    return 'capture';
  }
  if (id === 'downloadallimages' || id === 'downloadalltables') return 'summarize';
  if (id === 'mute_all_tabs' || id === 'unmute_all_tabs') return 'extract';
  if (id === 'merge_windows' || id === 'close_duplicate_tabs') return 'action';
  return 'action';
};

export const getCategoryTileCategory = (_optName: string) => 'action';

export type CategorySubcommandModeName =
  | 'note'
  | 'link'
  | 'snippet'
  | 'todo'
  | 'bookmark'
  | 'command'
  | 'prompt'
  | 'collection';

export const CATEGORY_PREFIX_KEY_BY_OPTION: Record<string, string> = {
  todos: 'todo',
  notes: 'note',
  links: 'link',
  commands: 'command',
  sessions: 'collection',
  chat_agents: 'agent',
  snippets: 'snippet',
  bookmarks: 'bookmark',
  prompts: 'prompt',
};

export const CATEGORY_SUBCOMMAND_BY_NORMALIZED_NAME: Record<string, CategorySubcommandModeName> = {
  note: 'note',
  link: 'link',
  snippet: 'snippet',
  todo: 'todo',
  bookmark: 'bookmark',
  command: 'command',
  prompt: 'prompt',
  agent: 'prompt',
  session: 'collection',
};

export function CompactDropdownSectionHeader({
  title,
  separated = false,
}: {
  title: string;
  separated?: boolean;
}) {
  return (
    <div
      className={clsx(
        'px-4 pb-0.5 pt-1 text-[11px] font-[480] tracking-wide text-[var(--alts-text-section)] select-none',
        separated ? 'mt-2 pt-1.5' : 'pt-1',
      )}>
      {title}
    </div>
  );
}

export function EmptySubmodeState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="px-6 py-4" role="status" aria-live="polite">
      <div className="text-[13px] font-medium text-[var(--alts-text-secondary)]">{title}</div>
      <div className="mt-1 text-[12px] font-normal text-[var(--alts-text-placeholder)]">{detail}</div>
    </div>
  );
}

export function NormalModeActionRow({
  opt,
  globalIdx,
  isSelected,
  icon,
  actionPrefixVal,
  onExecute,
  onSelect,
}: {
  opt: any;
  globalIdx: number;
  isSelected: boolean;
  icon: React.ReactNode;
  actionPrefixVal: string;
  onExecute: (opt: any) => void;
  onSelect: (index: number) => void;
}) {
  return (
    <button
      type="button"
      key={opt.id}
      id={`alts-dropdown-item-${globalIdx}`}
      aria-selected={isSelected}
      onMouseDown={event => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={event => {
        event.preventDefault();
        event.stopPropagation();
        onExecute(opt.item || opt);
      }}
      onMouseEnter={() => onSelect(globalIdx)}
      className={clsx(
        COMPACT_DROPDOWN_ITEM_BASE_CLASS,
        isSelected ? COMPACT_DROPDOWN_ITEM_SELECTED_CLASS : COMPACT_DROPDOWN_ITEM_UNSELECTED_CLASS,
      )}>
      <div className={COMPACT_DROPDOWN_ITEM_CONTENT_CLASS}>
        <div className={COMPACT_DROPDOWN_ITEM_PRIMARY_CLASS}>
          <span className={COMPACT_DROPDOWN_ITEM_ICON_CLASS} data-category={getIconTileCategory(opt.id)}>
            {icon}
          </span>
          <div className={COMPACT_DROPDOWN_ITEM_TEXT_CLASS}>
            {opt.id === 'add_to_existing' || opt.id === 'save_link' || opt.id === 'save_todo' || opt.id === 'save_note' || opt.id === 'save_snippet' ? (
              <span className="min-w-0 truncate leading-5">
                <span className={COMPACT_DROPDOWN_ITEM_LABEL_CLASS}>
                  {opt.id === 'save_link' ? 'Link' : opt.id === 'save_todo' ? 'To Do' : opt.id === 'save_note' ? 'Note' : opt.id === 'save_snippet' ? 'Text Expander' : 'Collection'}
                </span>
                <span className="ml-1 font-[485] leading-5 text-[var(--alts-text-secondary)]">save</span>
              </span>
            ) : (
              <span className={clsx(COMPACT_DROPDOWN_ITEM_LABEL_CLASS, 'min-w-0 truncate')}>{opt.name}</span>
            )}
          </div>
        </div>
        <span
          onClick={event => event.stopPropagation()}
          onMouseDown={event => event.stopPropagation()}
          className={COMPACT_DROPDOWN_ITEM_RIGHT_META_CLASS}>
          {actionPrefixVal ? (
            <EditablePrefixKey
              category={opt.id as any}
              currentValue={actionPrefixVal}
              alwaysVisible
              variant="compactPalette"
            />
          ) : null}
        </span>
      </div>
    </button>
  );
}

export function NormalModeCategoryRow({
  optionName,
  globalIdx,
  isSelected,
  title,
  icon,
  categoryKey,
  prefixValue,
  onActivate,
  onSelect,
}: {
  optionName: string;
  globalIdx: number;
  isSelected: boolean;
  title: string;
  icon: React.ReactNode;
  categoryKey?: string;
  prefixValue?: string;
  onActivate: (
    optionName: string,
    event: React.MouseEvent<HTMLDivElement> | React.PointerEvent<HTMLDivElement>,
  ) => void;
  onSelect: (index: number) => void;
}) {
  const activate = (event: React.MouseEvent<HTMLDivElement> | React.PointerEvent<HTMLDivElement>) => {
    onActivate(optionName, event);
  };

  return (
    <div
      key={optionName}
      id={`alts-dropdown-item-${globalIdx}`}
      aria-selected={isSelected}
      onPointerDown={activate}
      onClick={activate}
      onMouseDown={activate}
      onMouseEnter={() => onSelect(globalIdx)}
      className={clsx(
        COMPACT_DROPDOWN_ITEM_BASE_CLASS,
        isSelected ? COMPACT_DROPDOWN_ITEM_SELECTED_CLASS : COMPACT_DROPDOWN_ITEM_UNSELECTED_CLASS,
      )}>
      <div className={COMPACT_DROPDOWN_ITEM_CONTENT_CLASS}>
        <div className={COMPACT_DROPDOWN_ITEM_PRIMARY_CLASS}>
          <span className={COMPACT_DROPDOWN_ITEM_ICON_CLASS} data-category={getCategoryTileCategory(optionName)}>
            {icon}
          </span>
          <div className={COMPACT_DROPDOWN_ITEM_TEXT_CLASS}>
            <span className={clsx(COMPACT_DROPDOWN_ITEM_LABEL_CLASS, 'min-w-0 truncate')}>{title}</span>
          </div>
        </div>
        <span
          onClick={event => event.stopPropagation()}
          onMouseDown={event => event.stopPropagation()}
          className={COMPACT_DROPDOWN_ITEM_RIGHT_META_CLASS}>
          {categoryKey && prefixValue ? (
            <EditablePrefixKey
              category={categoryKey as any}
              currentValue={prefixValue}
              alwaysVisible
              variant="compactPalette"
            />
          ) : null}
        </span>
      </div>
    </div>
  );
}

export function NormalModeResultRow({
  rowKey,
  itemIndex,
  isSelected,
  icon,
  title,
  description,
  shortcutDisplay,
  shortcutDisplayClassName,
  stacked = Boolean(description),
  onExecute,
  onSelect,
  role,
  tabIndex,
}: {
  rowKey: React.Key;
  itemIndex: number;
  isSelected: boolean;
  icon: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  shortcutDisplay?: React.ReactNode;
  shortcutDisplayClassName?: string;
  stacked?: boolean;
  onExecute: () => void;
  onSelect: (index: number) => void;
  role?: React.AriaRole;
  tabIndex?: number;
}) {
  return (
    <button
      type="button"
      key={rowKey}
      id={`alts-dropdown-item-${itemIndex}`}
      role={role}
      aria-selected={isSelected}
      tabIndex={tabIndex}
      onMouseDown={event => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={event => {
        event.preventDefault();
        event.stopPropagation();
        onExecute();
      }}
      onMouseEnter={() => onSelect(itemIndex)}
      className={clsx(
        COMPACT_DROPDOWN_ITEM_BASE_CLASS,
        isSelected && description ? 'min-h-[46px] py-1.5' : '',
        isSelected ? COMPACT_DROPDOWN_ITEM_SELECTED_CLASS : COMPACT_DROPDOWN_ITEM_UNSELECTED_CLASS,
      )}>
      <div className={COMPACT_DROPDOWN_ITEM_CONTENT_CLASS}>
        <div className={COMPACT_DROPDOWN_ITEM_PRIMARY_CLASS}>
          {icon}
          <div className={clsx(COMPACT_DROPDOWN_ITEM_TEXT_CLASS, stacked ? 'flex-col items-start' : '')}>
            <span className={clsx(COMPACT_DROPDOWN_ITEM_LABEL_CLASS, 'min-w-0 truncate', stacked ? 'leading-4' : '')}>
              {title}
            </span>
            {isSelected && description ? (
              <span className="min-w-0 max-w-full truncate text-[11px] font-medium leading-4 text-[var(--alts-text-secondary)]">
                {description}
              </span>
            ) : null}
          </div>
        </div>
        {shortcutDisplay ? (
          <span className={shortcutDisplayClassName || COMPACT_DROPDOWN_ITEM_RIGHT_META_CLASS}>{shortcutDisplay}</span>
        ) : null}
      </div>
    </button>
  );
}
