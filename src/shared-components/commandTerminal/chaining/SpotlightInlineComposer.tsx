import * as React from 'react';
import { resolveSpotlightBackspaceDecision } from './createComposer/EntityCreateKeyboardController';
export type SpotlightInlineComposerField = {
    key: string;
    label: string;
    value: string;
    markerPresent?: boolean;
    completed?: boolean;
};
export type SpotlightComposerMode = 'create' | 'save' | 'filter' | 'send';
type SpotlightInlineComposerProps = {
    mode?: SpotlightComposerMode;
    commandLabel: string;
    actionLabel?: string;
    actionIcon?: React.ReactNode;
    categoryIcon?: React.ReactNode;
    categoryIconCategory?: string;
    activeField?: string | null;
    listboxId?: string;
    activeDescendant?: string;
    expanded?: boolean;
    fields?: readonly SpotlightInlineComposerField[];
    query?: string;
    queryLabel?: string;
    onQueryChange?: (value: string) => void;
    placeholder?: string;
    rightMeta?: React.ReactNode;
    onFieldChange?: (field: string, value: string) => void;
    onFieldFocus?: (field: string) => void;
    onAdvanceField?: (field: string) => void;
    onFieldBackspace?: (field: string, value: string) => boolean;
    onEmptyFieldBackspace?: (field: string) => void;
    onReturnToAction?: () => void;
    onCommandFocus?: () => void;
    onCommandDraftChange?: (value: string, previousValue: string) => void;
    onCommandKeyDown?: (event: React.KeyboardEvent<any>) => boolean | void;
};
export const SpotlightInlineComposer: React.FC<SpotlightInlineComposerProps> = ({ mode = 'create', commandLabel, actionLabel, actionIcon, categoryIcon, categoryIconCategory, activeField = null, listboxId, activeDescendant, expanded = false, fields = [], query = '', queryLabel, onQueryChange, placeholder, rightMeta, onFieldChange, onFieldFocus, onAdvanceField, onFieldBackspace, onEmptyFieldBackspace, onReturnToAction, onCommandFocus, onCommandDraftChange, onCommandKeyDown, }) => {
    const inputRefs = React.useRef<Array<HTMLInputElement | null>>([]);
    const actionRef = React.useRef<HTMLSpanElement | null>(null);
    const commandInputRef = React.useRef<HTMLInputElement | null>(null);
    const singleQueryInputRef = React.useRef<HTMLInputElement | null>(null);
    const previousFieldKeysRef = React.useRef<string[]>(fields.map(field => field.key));
    const previousFieldValuesRef = React.useRef<Record<string, string>>(Object.fromEntries(fields.map(field => [field.key, field.value])));
    const pendingPreviousFocusIndexRef = React.useRef<number | null>(null);
    const [draftValues, setDraftValues] = React.useState<Record<string, string>>({});
    const [commandDraft, setCommandDraft] = React.useState('');
    const [focusedFieldKey, setFocusedFieldKey] = React.useState<string | null>(null);
    const fieldSignature = fields
        .map(field => `${field.key}\u0000${field.value}\u0000${field.markerPresent ? '1' : '0'}`)
        .join('\u0001');
    const isSideCompanionOwningFocus = React.useCallback(() => {
        const root = inputRefs.current[0]?.getRootNode();
        const focusedElement = root instanceof ShadowRoot ? root.activeElement : document.activeElement;
        return focusedElement instanceof Element && Boolean(focusedElement.closest('[data-create-side-companion-shell]'));
    }, []);
    React.useEffect(() => {
        if (mode === 'save' || mode === 'filter' || mode === 'send') {
            window.requestAnimationFrame(() => {
                singleQueryInputRef.current?.focus();
            });
            return;
        }
        setDraftValues(Object.fromEntries(fields.map(field => [field.key, field.value])));
        previousFieldValuesRef.current = Object.fromEntries(fields.map(field => [field.key, field.value]));
        setCommandDraft('');
        window.requestAnimationFrame(() => {
            if (isSideCompanionOwningFocus())
                return;
            inputRefs.current[0]?.focus();
        });
    }, [commandLabel, isSideCompanionOwningFocus, mode]);
    React.useEffect(() => {
        setDraftValues(previous => {
            const next = { ...previous };
            let changed = false;
            fields.forEach((field, index) => {
                const input = inputRefs.current[index];
                const root = input?.getRootNode();
                const focusedElement = root instanceof ShadowRoot ? root.activeElement : document.activeElement;
                const externallyChanged = previousFieldValuesRef.current[field.key] !== field.value;
                if (focusedElement !== input || externallyChanged) {
                    if (next[field.key] !== field.value) {
                        next[field.key] = field.value;
                        changed = true;
                    }
                }
                previousFieldValuesRef.current[field.key] = field.value;
            });
            return changed ? next : previous;
        });
    }, [fieldSignature, fields]);
    React.useEffect(() => {
        if (!activeField)
            return;
        const root = inputRefs.current[0]?.getRootNode();
        const focusedElement = root instanceof ShadowRoot ? root.activeElement : document.activeElement;
        if (inputRefs.current.includes(focusedElement as HTMLInputElement))
            return;
        if (focusedElement === commandInputRef.current)
            return;
        if (isSideCompanionOwningFocus())
            return;
        const index = fields.findIndex(field => field.key === activeField);
        if (index < 0)
            return;
        window.requestAnimationFrame(() => {
            if (isSideCompanionOwningFocus())
                return;
            inputRefs.current[index]?.focus();
        });
    }, [activeField, fieldSignature, fields, isSideCompanionOwningFocus]);
    React.useEffect(() => {
        const currentKeys = fields.map(field => field.key);
        const newlyAddedKey = currentKeys.find(key => !previousFieldKeysRef.current.includes(key));
        previousFieldKeysRef.current = currentKeys;
        if (!newlyAddedKey)
            return;
        const index = currentKeys.indexOf(newlyAddedKey);
        setCommandDraft('');
        window.requestAnimationFrame(() => {
            if (isSideCompanionOwningFocus())
                return;
            inputRefs.current[index]?.focus();
            inputRefs.current[index]?.select();
        });
    }, [fieldSignature, fields, isSideCompanionOwningFocus]);
    React.useEffect(() => {
        const targetIndex = pendingPreviousFocusIndexRef.current;
        if (targetIndex === null)
            return;
        pendingPreviousFocusIndexRef.current = null;
        window.requestAnimationFrame(() => {
            if (targetIndex < 0) {
                actionRef.current?.focus();
                return;
            }
            inputRefs.current[targetIndex]?.focus();
        });
    }, [fieldSignature]);
    const handleFieldKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, field: SpotlightInlineComposerField, index: number) => {
        event.stopPropagation();
        const value = draftValues[field.key] ?? field.value;
        const selectionStart = event.currentTarget.selectionStart;
        const selectionEnd = event.currentTarget.selectionEnd;
        const isCollapsedAtEnd = selectionStart === selectionEnd && selectionEnd === value.length;
        const isWholeValueSelected = selectionStart === 0 && selectionEnd === value.length;
        if (event.key === 'Backspace' && (isCollapsedAtEnd || isWholeValueSelected) && onFieldBackspace?.(field.key, value)) {
            event.preventDefault();
            return;
        }
        if (event.key === 'Backspace' && event.currentTarget.selectionStart === 0 && value.length === 0) {
            const decision = resolveSpotlightBackspaceDecision({
                childPopupOpen: false,
                childQuery: '',
                selectedItemCount: 0,
                activeField: Boolean(field.markerPresent),
                activeFieldValue: value,
                atCommandStart: index === 0,
            });
            if (decision === 'remove-active-field') {
                event.preventDefault();
                pendingPreviousFocusIndexRef.current = index - 1;
                onEmptyFieldBackspace?.(field.key);
                return;
            }
            if (decision === 'remove-command-token' && index === 0) {
                event.preventDefault();
                onReturnToAction?.();
                return;
            }
            if (decision === 'native-input' && !field.markerPresent && index > 0) {
                event.preventDefault();
                inputRefs.current[index - 1]?.focus();
                return;
            }
        }
        if (event.key === 'Tab') {
            const nextIndex = event.shiftKey ? index - 1 : index + 1;
            const nextInput = inputRefs.current[nextIndex];
            if (nextInput) {
                event.preventDefault();
                nextInput.focus();
                nextInput.select();
                return;
            }
            if (!event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && onAdvanceField) {
                event.preventDefault();
                onAdvanceField(field.key);
                return;
            }
            if (!event.shiftKey) {
                event.preventDefault();
                commandInputRef.current?.focus();
            }
            return;
        }
        if (event.key === 'Escape' ||
            event.key === 'ArrowDown' ||
            event.key === 'ArrowUp' ||
            event.key === 'Enter') {
            if (onCommandKeyDown?.(event as unknown as React.KeyboardEvent<HTMLInputElement>)) {
                event.preventDefault();
            }
        }
    };
    if (mode === 'save' || mode === 'filter' || mode === 'send') {
        return (<div className="alts-spotlight-inline-composer" data-mode={mode} role="group" aria-label="Action parameters">
        <span ref={actionRef} className="alts-spotlight-inline-command" tabIndex={-1} onFocus={onCommandFocus} onKeyDown={event => {
                event.stopPropagation();
                if (event.key === 'Backspace') {
                    event.preventDefault();
                    onReturnToAction?.();
                }
                else if (event.key === 'Escape') {
                    if (onCommandKeyDown?.(event as unknown as React.KeyboardEvent<HTMLInputElement>)) {
                        event.preventDefault();
                    }
                }
            }}>
          {actionIcon ? <span className="alts-spotlight-inline-action-icon">{actionIcon}</span> : null}
          <span className="alts-spotlight-inline-action-label">{actionLabel || commandLabel}</span>
        </span>
        {queryLabel ? (<span className="alts-spotlight-inline-field-label">{queryLabel}</span>) : null}
        <input ref={singleQueryInputRef} className="alts-spotlight-inline-query-input bg-transparent border-none text-[19px] font-normal caret-[var(--alts-text-primary)] placeholder:text-[var(--alts-text-placeholder)] focus:outline-none focus:ring-0" value={query} placeholder={placeholder || (mode === 'save' ? 'Search existing to save active page...' : mode === 'send' ? 'Search agents to send this page...' : 'Search and filter...')} aria-label={actionLabel || commandLabel} aria-controls={listboxId} aria-expanded={expanded} aria-activedescendant={activeDescendant} role="combobox" autoComplete="off" spellCheck={false} onChange={event => {
                onQueryChange?.(event.target.value);
            }} onKeyDown={event => {
                event.stopPropagation();
                if (event.key === 'Backspace' && !query) {
                    event.preventDefault();
                    onReturnToAction?.();
                    return;
                }
                if ((event.key === 'Escape' ||
                    event.key === 'ArrowDown' ||
                    event.key === 'ArrowUp' ||
                    event.key === 'Enter' ||
                    event.key === 'Tab') &&
                    onCommandKeyDown?.(event)) {
                    event.preventDefault();
                }
            }} style={{ width: `${Math.max(12, Math.min(42, query.length + 1))}ch` }}/>
        {rightMeta ? <div className="shrink-0 flex items-center">{rightMeta}</div> : null}
      </div>);
    }
    return (<div className="alts-spotlight-inline-composer" data-mode={mode} role="group" aria-label="Action parameters">
      <span ref={actionRef} className="alts-spotlight-inline-command" tabIndex={-1} onFocus={onCommandFocus} onKeyDown={event => {
            event.stopPropagation();
            if (event.key === 'Backspace') {
                event.preventDefault();
                onReturnToAction?.();
            }
            else if (event.key === 'Escape') {
                if (onCommandKeyDown?.(event as unknown as React.KeyboardEvent<HTMLInputElement>)) {
                    event.preventDefault();
                }
            }
            else if (event.key === 'Tab' && !event.shiftKey) {
                event.preventDefault();
                inputRefs.current[0]?.focus();
            }
        }}>
        {mode !== 'create' && actionIcon ? <span className="alts-spotlight-inline-action-icon">{actionIcon}</span> : null}
        {categoryIcon ? <span className="alts-spotlight-inline-category-icon" data-category={categoryIconCategory}>{categoryIcon}</span> : null}
        <span className="alts-spotlight-inline-action-label">{actionLabel || commandLabel}</span>
      </span>
      {fields.map((field, index) => {
            const sharedProps = {
                ref: (element: HTMLInputElement | null) => {
                    inputRefs.current[index] = element;
                },
                className: 'alts-spotlight-inline-field-input',
                value: draftValues[field.key] ?? field.value,
                'aria-label': field.label,
                'aria-controls': listboxId,
                'aria-expanded': expanded,
                'aria-activedescendant': activeDescendant,
                role: 'combobox' as const,
                readOnly: field.key === 'favorite',
                onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                    const value = event.target.value;
                    setDraftValues(previous => ({ ...previous, [field.key]: value }));
                    onFieldChange?.(field.key, value);
                },
                onFocus: () => {
                    setFocusedFieldKey(field.key);
                    onFieldFocus?.(field.key);
                },
                onBlur: () => {
                    setFocusedFieldKey(previous => previous === field.key ? null : previous);
                },
                onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
                    handleFieldKeyDown(event, field, index);
                },
                style: { width: `${Math.max(12, (draftValues[field.key] ?? field.value).length + 1)}ch` },
            };
            const isActive = focusedFieldKey === field.key;
            return (<label key={field.key} className="alts-spotlight-inline-field" data-active={isActive ? 'true' : 'false'} data-completed={field.completed || (draftValues[field.key] ?? field.value).trim().length > 0 ? 'true' : 'false'}>
            <span className="alts-spotlight-inline-field-label">{field.label}</span>
            <input {...sharedProps} type="text"/>
          </label>);
        })}
      <input ref={commandInputRef} className="alts-spotlight-inline-command-input" value={commandDraft} aria-label="Add another property" aria-controls={listboxId} aria-expanded={expanded} aria-activedescendant={activeDescendant} role="combobox" autoComplete="off" spellCheck={false} onFocus={onCommandFocus} onChange={event => {
            const nextValue = event.target.value;
            const previousValue = commandDraft;
            setCommandDraft(nextValue);
            onCommandDraftChange?.(nextValue, previousValue);
        }} onKeyDown={event => {
            event.stopPropagation();
            if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && onAdvanceField) {
                event.preventDefault();
                onAdvanceField(fields[fields.length - 1]?.key || '');
                return;
            }
            if (event.key === 'Backspace' && !commandDraft) {
                event.preventDefault();
                inputRefs.current[fields.length - 1]?.focus();
                return;
            }
            if (event.key === 'Tab' || event.key === 'Enter' || event.key === 'Escape' || event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                if (onCommandKeyDown?.(event))
                    event.preventDefault();
            }
        }} style={{ width: `${Math.max(2, commandDraft.length + 1)}ch` }}/>
    </div>);
};
