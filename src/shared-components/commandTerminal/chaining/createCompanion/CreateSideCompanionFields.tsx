import * as React from 'react';
import { FaRegStar, FaStar } from 'react-icons/fa';
import { useKeystrokeRecording, VisualKeyDisplay } from '../../../hotkeys';
import type { CreateCompanionValidationState } from './types';
const FIELD_STACK_CLASS = 'group flex flex-col gap-1.5';
const FIELD_LABEL_CLASS = 'flex min-w-0 items-center gap-1.5 text-[11px] font-[520] leading-none tracking-wide text-[var(--alts-text-section)] transition-colors group-focus-within:text-[var(--alts-text-primary)] select-none';
const FIELD_PREFIX_CLASS = 'inline-flex h-[16px] shrink-0 items-center rounded-[4px] border border-[var(--alts-border-color)] bg-[var(--alts-row-hover-bg)] px-1.5 text-[10px] font-[620] leading-none text-[var(--alts-text-secondary)]';
const FIELD_INPUT_CLASS = 'w-full h-[34px] px-2.5 rounded-[7px] border border-[var(--alts-border-color)] bg-[var(--alts-glass-search-bg)] text-[13px] font-normal text-[var(--alts-text-primary)] placeholder:text-[var(--alts-text-placeholder)] outline-none shadow-[0_0_0_1px_var(--alts-divider-color)] transition-colors focus:border-[var(--alts-focus-color,var(--color-primary))] focus:shadow-[0_0_0_1px_var(--alts-focus-color)] hover:border-[var(--alts-border-hover,var(--alts-border-color))]';
const CreateCompanionFieldLabel: React.FC<{
    label: string;
    prefix?: string;
    required?: boolean;
}> = ({ label, prefix, required = false }) => (<label className={FIELD_LABEL_CLASS}>
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="min-w-0 truncate">{label}</span>
      {required ? (<span className="shrink-0 text-[12px] font-bold leading-none text-[var(--color-error)]">*</span>) : null}
    </span>
    {prefix ? (<span className={FIELD_PREFIX_CLASS}>{prefix}</span>) : null}
  </label>);
export const CreateCompanionTextInput: React.FC<{
    label: string;
    value: string;
    prefix?: string;
    required?: boolean;
    placeholder?: string;
    readOnly?: boolean;
    onChange: (value: string) => void;
}> = ({ label, value, prefix, required = false, placeholder, readOnly = false, onChange }) => {
    const isMissing = required && !value.trim();
    return (<div className={FIELD_STACK_CLASS}>
      <CreateCompanionFieldLabel label={label} prefix={prefix} required={isMissing}/>
      <input type="text" value={value} readOnly={readOnly} onChange={event => onChange(event.target.value)} onKeyDown={event => event.stopPropagation()} placeholder={placeholder || label} className={FIELD_INPUT_CLASS}/>
    </div>);
};
export const CreateCompanionTextarea: React.FC<{
    label: string;
    value: string;
    prefix?: string;
    required?: boolean;
    placeholder?: string;
    readOnly?: boolean;
    onChange: (value: string) => void;
}> = ({ label, value, prefix, required = false, placeholder, readOnly = false, onChange }) => {
    const isMissing = required && !value.trim();
    return (<div className={FIELD_STACK_CLASS}>
      <CreateCompanionFieldLabel label={label} prefix={prefix} required={isMissing}/>
      <div className="relative w-full">
        <textarea value={value} readOnly={readOnly} onChange={event => onChange(event.target.value)} onKeyDown={event => event.stopPropagation()} placeholder={placeholder || label} className="alts-description-textarea w-full h-[64px] min-h-[52px] max-w-full p-2.5 pb-3.5 rounded-[7px] border border-[var(--alts-border-color)] bg-[var(--alts-glass-search-bg)] text-[13px] font-normal text-[var(--alts-text-primary)] placeholder:text-[var(--alts-text-placeholder)] outline-none resize shadow-[0_0_0_1px_var(--alts-divider-color)] transition-colors focus:border-[var(--alts-focus-color,var(--color-primary))] focus:shadow-[0_0_0_1px_var(--alts-focus-color)] hover:border-[var(--alts-border-hover,var(--alts-border-color))]" style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--alts-scrollbar-thumb) var(--alts-scrollbar-track)',
            overscrollBehavior: 'contain',
            minHeight: '52px',
            maxWidth: '100%',
        }}/>
        <div className="pointer-events-none absolute right-1.5 bottom-1.5 flex items-center justify-center opacity-40 text-[var(--alts-text-secondary)]">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
            <circle cx="6.5" cy="6.5" r="1"/>
            <circle cx="6.5" cy="3.5" r="1"/>
            <circle cx="3.5" cy="6.5" r="1"/>
          </svg>
        </div>
      </div>
    </div>);
};
export const CreateCompanionSelect: React.FC<{
    label: string;
    value: string;
    prefix?: string;
    options: readonly {
        id: string;
        label: string;
    }[];
    onChange: (value: string) => void;
}> = ({ label, value, prefix, options, onChange }) => (<div className={FIELD_STACK_CLASS}>
    <CreateCompanionFieldLabel label={label} prefix={prefix}/>
    <div className="relative w-full">
      <select value={value} onChange={event => onChange(event.target.value)} onKeyDown={event => event.stopPropagation()} className={`${FIELD_INPUT_CLASS} pr-8 appearance-none cursor-pointer`}>
        {options.map(option => (<option key={option.id} value={option.id} className="bg-[var(--alts-popup-bg)] text-[var(--alts-text-primary)]">
            {option.label}
          </option>))}
      </select>
      <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--alts-text-secondary)]">
        <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd"/>
        </svg>
      </div>
    </div>
  </div>);
const getStatusText = (state: CreateCompanionValidationState | undefined, emptyText: string) => {
    if (!state || state.status === 'empty')
        return emptyText;
    if (state.status === 'checking')
        return 'Checking...';
    if (state.status === 'available')
        return 'Available';
    return state.message || 'Not available';
};
const getStatusClassName = (state: CreateCompanionValidationState | undefined) => {
    if (state?.status === 'available')
        return 'text-[var(--color-success)]';
    if (state?.status === 'conflict' || state?.status === 'error')
        return 'text-[var(--color-error)]';
    return 'text-[var(--alts-text-secondary)]';
};
export const CreateCompanionHotkeyCapture: React.FC<{
    label?: string;
    value: string;
    prefix?: string;
    validation?: CreateCompanionValidationState;
    activeToken: string;
    onChange: (value: string) => void;
}> = ({ label = 'Hotkey', value, prefix, validation, activeToken, onChange }) => {
    const hotkeyCaptureRef = React.useRef<HTMLDivElement | null>(null);
    const hotkeyInputRef = React.useRef<HTMLInputElement | null>(null);
    const isMac = React.useMemo(() => /Mac|iPhone|iPad|iPod/i.test(navigator.platform || ''), []);
    const { hotkey, setHotkey, captureHotkey } = useKeystrokeRecording(value, isMac);
    const setHotkeyCaptureActive = React.useCallback((active: boolean) => {
        if (active) {
            hotkeyCaptureRef.current?.setAttribute('data-hotkey-capture-active', 'true');
            (window as any).__cmdosKeystrokeRecordingActive = activeToken;
            return;
        }
        hotkeyCaptureRef.current?.removeAttribute('data-hotkey-capture-active');
        if ((window as any).__cmdosKeystrokeRecordingActive === activeToken) {
            (window as any).__cmdosKeystrokeRecordingActive = false;
        }
    }, [activeToken]);
    React.useEffect(() => {
        setHotkey(value);
    }, [setHotkey, value]);
    React.useEffect(() => () => {
        setHotkeyCaptureActive(false);
    }, [setHotkeyCaptureActive]);
    return (<div className={FIELD_STACK_CLASS}>
      <CreateCompanionFieldLabel label={label} prefix={prefix}/>
      <div ref={hotkeyCaptureRef} data-hotkey-capture role="button" tabIndex={0} onPointerDownCapture={() => setHotkeyCaptureActive(true)} onMouseDown={event => {
            event.stopPropagation();
            setHotkeyCaptureActive(true);
        }} onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            setHotkeyCaptureActive(true);
            hotkeyInputRef.current?.focus();
            setTimeout(() => hotkeyInputRef.current?.focus(), 10);
        }} className="relative flex min-h-[44px] w-full items-center justify-center rounded-[7px] border border-[var(--alts-border-color)] bg-[var(--alts-glass-search-bg)] px-2.5 py-1.5 text-[13px] font-normal text-[var(--alts-text-primary)] outline-none shadow-[0_0_0_1px_var(--alts-divider-color)] transition-colors hover:border-[var(--alts-border-hover,var(--alts-border-color))] focus-within:border-[var(--alts-focus-color,var(--color-primary))] focus-within:shadow-[0_0_0_1px_var(--alts-focus-color)]" style={{
            '--color-textPrimary': 'var(--alts-text-primary)',
            '--color-textSecondary': 'var(--alts-text-secondary)',
            '--color-textPlaceholder': 'var(--alts-text-placeholder)',
            '--color-containerBg': 'var(--alts-row-hover-bg)',
            '--color-borderDefault': 'var(--alts-border-color)',
        } as React.CSSProperties}>
        <input ref={hotkeyInputRef} type="text" data-is-hotkey-input="true" value={hotkey} readOnly onFocus={() => setHotkeyCaptureActive(true)} onBlur={() => setHotkeyCaptureActive(false)} onKeyDown={event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                event.nativeEvent.stopImmediatePropagation?.();
                hotkeyInputRef.current?.blur();
                return;
            }
            if (event.key === 'Backspace' || event.key === 'Delete') {
                event.preventDefault();
                event.stopPropagation();
                event.nativeEvent.stopImmediatePropagation?.();
                setHotkey('');
                onChange('');
                return;
            }
            const nextHotkey = captureHotkey(event);
            if (nextHotkey)
                onChange(nextHotkey);
        }} className="absolute inset-0 h-full w-full cursor-pointer opacity-0"/>
        {hotkey ? (<VisualKeyDisplay hotkey={hotkey}/>) : (<span className="text-[var(--alts-text-placeholder)]">Press shortcut</span>)}
      </div>
      {validation && validation.status !== 'empty' && (<div className={`text-[11px] font-semibold leading-none ${getStatusClassName(validation)}`}>
          {getStatusText(validation, '')}
        </div>)}
    </div>);
};
export const CreateCompanionTextCommandInput: React.FC<{
    label?: string;
    value: string;
    prefix?: string;
    validation?: CreateCompanionValidationState;
    onChange: (value: string) => void;
}> = ({ label = 'Text Command', value, prefix, validation, onChange }) => (<div className={FIELD_STACK_CLASS}>
    <CreateCompanionFieldLabel label={label} prefix={prefix}/>
    <input type="text" value={value} onChange={event => onChange(event.target.value)} onKeyDown={event => event.stopPropagation()} placeholder="Text command" className={FIELD_INPUT_CLASS}/>
    {validation && validation.status !== 'empty' && (<div className={`text-[11px] font-semibold leading-none ${getStatusClassName(validation)}`}>
        {getStatusText(validation, '')}
      </div>)}
  </div>);
export const CreateCompanionFavoriteToggle: React.FC<{
    active: boolean;
    prefix?: string;
    onToggle: () => void;
}> = ({ active, prefix, onToggle }) => (<div className="flex min-h-[34px] items-center justify-between gap-3">
    <CreateCompanionFieldLabel label="Favorite" prefix={prefix}/>
    <button type="button" onMouseDown={event => event.stopPropagation()} onClick={event => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
    }} title={active ? 'Remove from favorites' : 'Mark as favorite'} className="flex h-8 w-8 items-center justify-center rounded-[7px] border border-[var(--alts-border-color)] bg-[var(--alts-glass-search-bg)] text-[var(--alts-text-secondary)] outline-none transition-colors hover:bg-[var(--alts-row-hover-bg)] hover:text-[var(--alts-text-primary)] focus:border-[var(--alts-focus-color,var(--color-primary))]">
      {active ? (<FaStar className="h-4 w-4 text-[var(--color-warning,var(--color-success))]"/>) : (<FaRegStar className="h-4 w-4"/>)}
    </button>
  </div>);
