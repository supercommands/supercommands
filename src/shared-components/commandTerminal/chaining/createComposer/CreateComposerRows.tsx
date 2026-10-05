import * as React from 'react';
import clsx from 'clsx';
import { FaCheck, FaPlus } from 'react-icons/fa';
import type { CreateComposerField, CreateComposerProperty } from './CreateComposerTypes';
import { getCreateComposerFieldIcon, getCreateComposerPropertyIcon } from './createComposerIcons';
const COMPACT_DROPDOWN_ITEM_BASE_CLASS = 'alts-command-row w-[calc(100%-16px)] max-w-[calc(100%-16px)] overflow-hidden appearance-none border-0 px-3 min-h-[34px] flex items-center justify-between cursor-pointer transition-colors mx-2 rounded-lg font-[500] text-left text-[13px] group';
const COMPACT_DROPDOWN_ITEM_SELECTED_CLASS = 'bg-[var(--alts-row-selected-bg)] text-[var(--alts-text-primary)] shadow-none border border-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--alts-focus-color)]';
const COMPACT_DROPDOWN_ITEM_UNSELECTED_CLASS = 'bg-transparent text-[var(--alts-text-primary)] hover:bg-[var(--alts-row-hover-bg)] border border-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--alts-focus-color)]';
const COMPACT_DROPDOWN_ITEM_LABEL_CLASS = 'truncate text-[var(--alts-text-primary)] font-[500] leading-5';
const COMPACT_DROPDOWN_ITEM_CONTENT_CLASS = 'flex w-full min-w-0 max-w-full overflow-hidden items-center justify-between gap-5';
const COMPACT_DROPDOWN_ITEM_PRIMARY_CLASS = 'flex min-w-0 max-w-full flex-1 overflow-hidden items-center gap-3';
const COMPACT_DROPDOWN_ITEM_TEXT_CLASS = 'flex min-w-0 max-w-full flex-1 overflow-hidden items-baseline';
const COMPACT_DROPDOWN_ITEM_ICON_CLASS = 'alts-icon-tile';
const COMPACT_DROPDOWN_ITEM_RIGHT_META_CLASS = 'mr-3 flex w-24 shrink-0 justify-end text-right text-[11px] font-medium text-[var(--alts-shortcut-text)]';
const truncateSummaryValue = (value: string) => {
    if (value.length <= 76)
        return value;
    return `${value.slice(0, 73)}...`;
};
type RowBaseProps = {
    selected: boolean;
    helperProps?: Record<string, string>;
    onSelect: () => void;
    onActivate: () => void;
};
export const CreateComposerSection: React.FC<{
    title: string;
    children: React.ReactNode;
}> = ({ title, children }) => (<div className="mb-1.5 last:mb-0">
    <div className="px-4 pb-0.5 pt-1 text-[11px] font-[480] tracking-wide text-[var(--alts-text-section)] select-none">
      {title}
    </div>
    <div className="space-y-0.5">
      {children}
    </div>
  </div>);
export const CreateComposerFieldRow: React.FC<RowBaseProps & {
    field: CreateComposerField;
}> = ({ field, selected, helperProps = {}, onSelect, onActivate }) => {
    const value = String(field.value || '').trim();
    const showRequiredMarker = Boolean(field.required && !value);
    return (<button type="button" {...helperProps} data-create-composer-row data-create-composer-field={field.key} aria-selected={selected} onMouseDown={event => {
            event.preventDefault();
            event.stopPropagation();
        }} onMouseEnter={onSelect} onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            onActivate();
        }} className={clsx(COMPACT_DROPDOWN_ITEM_BASE_CLASS, selected ? COMPACT_DROPDOWN_ITEM_SELECTED_CLASS : COMPACT_DROPDOWN_ITEM_UNSELECTED_CLASS)}>
      <div className={COMPACT_DROPDOWN_ITEM_CONTENT_CLASS}>
        <div className={COMPACT_DROPDOWN_ITEM_PRIMARY_CLASS}>
          <span className={COMPACT_DROPDOWN_ITEM_ICON_CLASS} data-category={field.iconCategory || 'extract'}>
            {getCreateComposerFieldIcon(field)}
          </span>
          <div className={clsx(COMPACT_DROPDOWN_ITEM_TEXT_CLASS, value ? 'flex-col items-start' : '')}>
            <span className={clsx(COMPACT_DROPDOWN_ITEM_LABEL_CLASS, 'flex min-w-0 items-center gap-1 truncate', value ? 'leading-4' : '')}>
              <span className="min-w-0 truncate">{field.label}</span>
              {showRequiredMarker ? (<span className="shrink-0 text-[var(--color-error)]" aria-label="required">
                  *
                </span>) : null}
            </span>
            {value ? (<span className="min-w-0 max-w-full truncate text-[11px] font-medium leading-4 text-[var(--alts-text-secondary)]">
                {truncateSummaryValue(value)}
              </span>) : null}
          </div>
        </div>
        {field.prefix ? (<span onClick={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} className={COMPACT_DROPDOWN_ITEM_RIGHT_META_CLASS}>
            <span className="inline-flex h-5 items-center justify-center rounded-[6px] border border-[var(--alts-shortcut-border,var(--color-borderDefault))] bg-[var(--alts-shortcut-bg,transparent)] px-1.5 text-[12px] font-semibold leading-4 lowercase text-[var(--alts-shortcut-text,var(--color-textMuted))]">
              {field.prefix}
            </span>
          </span>) : null}
      </div>
    </button>);
};
export const CreateComposerPropertyRow: React.FC<RowBaseProps & {
    property: CreateComposerProperty;
}> = ({ property, selected, helperProps = {}, onSelect, onActivate }) => (<button type="button" {...helperProps} data-create-composer-row data-create-composer-property={property.key} aria-selected={selected} disabled={property.disabled} onMouseDown={event => {
        event.preventDefault();
        event.stopPropagation();
    }} onMouseEnter={onSelect} onClick={event => {
        event.preventDefault();
        event.stopPropagation();
        if (!property.disabled)
            onActivate();
    }} className={clsx(COMPACT_DROPDOWN_ITEM_BASE_CLASS, property.disabled
        ? 'cursor-default opacity-60'
        : selected
            ? COMPACT_DROPDOWN_ITEM_SELECTED_CLASS
            : COMPACT_DROPDOWN_ITEM_UNSELECTED_CLASS)}>
    <div className={COMPACT_DROPDOWN_ITEM_CONTENT_CLASS}>
      <div className={COMPACT_DROPDOWN_ITEM_PRIMARY_CLASS}>
        <span className={COMPACT_DROPDOWN_ITEM_ICON_CLASS} data-category={property.iconCategory || 'save-action'}>
          {getCreateComposerPropertyIcon(property)}
        </span>
        <div className={COMPACT_DROPDOWN_ITEM_TEXT_CLASS}>
          <span className={clsx(COMPACT_DROPDOWN_ITEM_LABEL_CLASS, 'min-w-0 truncate')}>
            {property.label}
          </span>
        </div>
      </div>
      {property.prefix ? (<span onClick={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} className={COMPACT_DROPDOWN_ITEM_RIGHT_META_CLASS}>
          <span className="inline-flex h-5 items-center justify-center rounded-[6px] border border-[var(--alts-shortcut-border,var(--color-borderDefault))] bg-[var(--alts-shortcut-bg,transparent)] px-1.5 text-[12px] font-semibold leading-4 lowercase text-[var(--alts-shortcut-text,var(--color-textMuted))]">
            {property.prefix}
          </span>
        </span>) : null}
    </div>
  </button>);
export const CreateComposerChecklistRow: React.FC<RowBaseProps & {
    label: string;
    secondary?: string;
    checked: boolean;
    icon: React.ReactNode;
    iconCategory?: string;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}> = ({ label, secondary, checked, icon, iconCategory = 'save-action', selected, helperProps = {}, onSelect, onActivate, onMouseEnter, onMouseLeave }) => (<button type="button" {...helperProps} data-create-composer-row aria-selected={selected} onMouseDown={event => {
        event.preventDefault();
        event.stopPropagation();
    }} onMouseEnter={() => {
        onSelect?.();
        onMouseEnter?.();
    }} onMouseLeave={onMouseLeave} onClick={event => {
        event.preventDefault();
        event.stopPropagation();
        onActivate();
    }} className={clsx(COMPACT_DROPDOWN_ITEM_BASE_CLASS, secondary ? 'py-1 min-h-[40px]' : '', selected || checked ? COMPACT_DROPDOWN_ITEM_SELECTED_CLASS : COMPACT_DROPDOWN_ITEM_UNSELECTED_CLASS)}>
    <div className={COMPACT_DROPDOWN_ITEM_CONTENT_CLASS}>
      <div className={COMPACT_DROPDOWN_ITEM_PRIMARY_CLASS}>
        <span className={clsx('flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border transition-all', checked
        ? 'border-[var(--alts-text-primary)] bg-[var(--alts-text-primary)] text-[var(--alts-popup-bg)]'
        : 'border-[var(--alts-border-color)] bg-transparent')}>
          {checked ? <FaCheck className="h-2 w-2"/> : null}
        </span>
        <span className={COMPACT_DROPDOWN_ITEM_ICON_CLASS} data-category={iconCategory}>
          {icon}
        </span>
        <div className={clsx(COMPACT_DROPDOWN_ITEM_TEXT_CLASS, secondary ? 'flex-col items-start justify-center' : '')}>
          <span className={clsx(COMPACT_DROPDOWN_ITEM_LABEL_CLASS, 'min-w-0 truncate w-full', secondary ? 'leading-4 text-[12.5px]' : '')}>
            {label}
          </span>
          {secondary ? (<span className="min-w-0 max-w-full truncate text-[11px] font-normal leading-4 text-[var(--alts-text-secondary)]">
              {secondary}
            </span>) : null}
        </div>
      </div>
    </div>
  </button>);
export const CreateComposerCreateOptionRow: React.FC<RowBaseProps & {
    label: string;
    iconCategory?: string;
}> = ({ label, iconCategory = 'save-action', selected, helperProps = {}, onSelect, onActivate }) => (<button type="button" {...helperProps} data-create-composer-row aria-selected={selected} onMouseDown={event => {
        event.preventDefault();
        event.stopPropagation();
    }} onMouseEnter={onSelect} onClick={event => {
        event.preventDefault();
        event.stopPropagation();
        onActivate();
    }} className={clsx(COMPACT_DROPDOWN_ITEM_BASE_CLASS, selected ? COMPACT_DROPDOWN_ITEM_SELECTED_CLASS : COMPACT_DROPDOWN_ITEM_UNSELECTED_CLASS)}>
    <div className={COMPACT_DROPDOWN_ITEM_CONTENT_CLASS}>
      <div className={COMPACT_DROPDOWN_ITEM_PRIMARY_CLASS}>
        <span className={COMPACT_DROPDOWN_ITEM_ICON_CLASS} data-category={iconCategory}>
          <FaPlus className="h-3.5 w-3.5 shrink-0 text-current"/>
        </span>
        <div className={COMPACT_DROPDOWN_ITEM_TEXT_CLASS}>
          <span className={clsx(COMPACT_DROPDOWN_ITEM_LABEL_CLASS, 'min-w-0 truncate')}>
            Create "{label}"
          </span>
        </div>
      </div>
    </div>
  </button>);
export const CreateComposerStatusRow: React.FC<RowBaseProps & {
    label: string;
    secondary?: string | null;
    icon: React.ReactNode;
    iconCategory?: string;
    tone?: 'muted' | 'success' | 'error';
}> = ({ label, secondary, icon, iconCategory = 'save-action', tone = 'muted', selected, helperProps = {}, onSelect, onActivate, }) => (<button type="button" {...helperProps} data-create-composer-row aria-selected={selected} onMouseDown={event => {
        event.preventDefault();
        event.stopPropagation();
    }} onMouseEnter={onSelect} onClick={event => {
        event.preventDefault();
        event.stopPropagation();
        onActivate();
    }} className={clsx(COMPACT_DROPDOWN_ITEM_BASE_CLASS, selected ? COMPACT_DROPDOWN_ITEM_SELECTED_CLASS : COMPACT_DROPDOWN_ITEM_UNSELECTED_CLASS)}>
    <div className={COMPACT_DROPDOWN_ITEM_CONTENT_CLASS}>
      <div className={COMPACT_DROPDOWN_ITEM_PRIMARY_CLASS}>
        <span className={COMPACT_DROPDOWN_ITEM_ICON_CLASS} data-category={iconCategory}>
          {icon}
        </span>
        <div className={clsx(COMPACT_DROPDOWN_ITEM_TEXT_CLASS, secondary ? 'flex-col items-start' : '')}>
          <span className={clsx(COMPACT_DROPDOWN_ITEM_LABEL_CLASS, 'min-w-0 truncate', secondary ? 'leading-4' : '')}>
            {label}
          </span>
          {secondary ? (<span className={clsx('min-w-0 max-w-full truncate text-[11px] font-medium leading-4', tone === 'success'
            ? 'text-[var(--color-success)]'
            : tone === 'error'
                ? 'text-[var(--color-error)]'
                : 'text-[var(--alts-text-secondary)]')}>
              {secondary}
            </span>) : null}
        </div>
      </div>
    </div>
  </button>);
