import * as React from 'react';
import { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { FaChevronDown, FaCode, FaHistory, FaBookmark, FaPlus } from 'react-icons/fa';

import type { InlineParamConfig } from './automationTypes';
import { useUIStore } from '../../../../../shared-components/uiStateManager';

export type AutomationInlineInputProps = {
  value: string;
  paramConfigs: Record<string, InlineParamConfig>;
  configKey: 'url' | 'content' | 'selector';
  placeholder?: string;
  onChange: (updates: { value: string; paramConfigs: Record<string, InlineParamConfig> }) => void;
  onOpenAdvanced?: (rect: DOMRect) => void;
  isFocused?: boolean;
  isEditing?: boolean;
  onStartEditing?: () => void;
  onStopEditing?: () => void;
  isAdvancedFocused?: boolean;
  onLockFocus?: (isLocked: boolean) => void;

  // Standard Input Props
  id?: string;
  name?: string;
  className?: string;
  style?: React.CSSProperties;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  onKeyUp?: React.KeyboardEventHandler<HTMLInputElement>;
  autoFocus?: boolean;
  disableTokenTrigger?: boolean;
};

// -- Helpers --
const stripProtocol = (url: string) => String(url || '').replace(/^https?:\/\//i, '');

const formatParamBadgeName = (rawName: string) => {
  return rawName.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const detectParams = (text: string): Array<{ name: string; type: InlineParamConfig['type'] | null }> => {
  const regex = /\{input_name="([^"]+)"\}|\{([^}:\s]+):([^}\s]+)\}|\{([^}\s:=)]+)\}/g;
  const results: Array<{ name: string; type: InlineParamConfig['type'] | null }> = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const name = match[1] || match[3] || match[4];
    const type = match[2] as InlineParamConfig['type'] | null;
    if (name) results.push({ name, type });
  }
  return results;
};

const detectParamNames = (text: string): string[] => {
  return detectParams(text).map(p => p.name);
};

const ensureParamConfigsForText = (text: string, currentConfigs: Record<string, InlineParamConfig>) => {
  const params = detectParams(text);
  const next: Record<string, InlineParamConfig> = {};
  params.forEach(({ name, type }) => {
    const existing = currentConfigs[name];
    if (existing) {
      next[name] = {
        ...existing,
        type: type || existing.type || 'short_text',
      };
    } else {
      next[name] = { type: type || 'short_text', values: [''] };
    }
  });
  return next;
};

// -- Sub-Component: TypePicker --
const TypePicker: React.FC<{
  name: string;
  type: InlineParamConfig['type'];
  config: InlineParamConfig;
  position: { top: number; left: number };
  onTypeSelect: (type: InlineParamConfig['type']) => void;
  onNameChange: (newName: string, token?: any) => void;
  onConfigChange: (updates: Partial<InlineParamConfig>) => void;
  onClose: () => void;
  isNew: boolean;
  token?: any;
}> = ({ name, type, config, position, onTypeSelect, onNameChange, onConfigChange, onClose, isNew, token }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [localName, setLocalName] = useState(name);
  const containerRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const types: Array<{ id: InlineParamConfig['type']; label: string }> = [
    { id: 'short_text', label: 'Short Text' },
    { id: 'long_text', label: 'Long Text' },
    { id: 'dropdown', label: 'Dropdown' },
    { id: 'constant', label: 'Constant' },
  ];

  useEffect(() => {
    setLocalName(name);
    const idx = types.findIndex(t => t.id === type);
    if (idx !== -1) setActiveIndex(idx);
  }, [name, type]);

  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      if (!isNew) {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      } else {
        containerRef.current?.focus();
      }
    });
    return () => cancelAnimationFrame(timer);
  }, [isNew]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter')) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev => (prev + 1) % types.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev - 1 + types.length) % types.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (isNew) onTypeSelect(types[activeIndex].id);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [activeIndex, types, isNew, onClose, onTypeSelect]);

  useEffect(() => {
    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      onClose();
      return true;
    });
    return unregister;
  }, [onClose]);

  return ReactDOM.createPortal(
    <div
      ref={containerRef}
      tabIndex={-1}
      onKeyDown={e => e.stopPropagation()}
      className="fixed z-[999999] bg-[#0d0d0d] border border-white/10 rounded-lg shadow-2xl p-2 flex flex-col gap-2 focus:outline-none ring-1 ring-white/10"
      style={{ top: position.top, left: position.left }}>
      <div className="flex flex-col gap-2 w-52">
        {!isNew && (
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-white/30 uppercase px-1">Param Name</label>
            <input
              ref={nameInputRef}
              value={localName}
              onChange={e => setLocalName(e.target.value)}
              onBlur={() => onNameChange(localName)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose();
                  onNameChange(localName, token);
                }
                e.stopPropagation();
              }}
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[11px] font-bold text-white focus:outline-none focus:border-emerald-500/50"
            />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-black text-white/30 uppercase px-1">Data Type</label>
          {types.map((t, i) => (
            <button
              key={t.id}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => {
                onTypeSelect(t.id);
                onClose();
              }}
              className={`w-full text-left px-2 py-1.5 rounded text-[10px] font-bold flex items-center justify-between transition-colors ${activeIndex === i ? 'bg-emerald-500/10 text-emerald-400' : 'text-neutral-500 hover:text-neutral-300'}`}>
              {t.label}
              {(t.id === 'dropdown' || t.id === 'constant') && (
                <FaChevronDown size={8} className="-rotate-90 opacity-40" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
};

// -- Main Component: AutomationInlineInput --
export const AutomationInlineInput = React.forwardRef<HTMLInputElement, AutomationInlineInputProps>(
  (
    {
      value,
      paramConfigs,
      configKey,
      placeholder,
      onChange,
      onOpenAdvanced,
      isFocused,
      isEditing,
      onStartEditing,
      onStopEditing,
      isAdvancedFocused,
      onLockFocus,
      id,
      name,
      className,
      style,
      onFocus,
      onBlur,
      onKeyDown,
      onKeyUp,
      autoFocus,
      disableTokenTrigger = false,
    },
    ref,
  ) => {
    const [localValue, setLocalValue] = useState(value);
    const [typePicker, setTypePicker] = useState<any>(null);
    const internalInputRef = useRef<HTMLInputElement>(null);

    // Merge internal and external refs
    useEffect(() => {
      if (!ref) return;
      if (typeof ref === 'function') {
        ref(internalInputRef.current);
      } else {
        (ref as any).current = internalInputRef.current;
      }
    }, [ref]);

    useEffect(() => {
      setLocalValue(value);
    }, [value]);

    const getActiveToken = useCallback((text: string, pos: number) => {
      const regex = /\{input_name="([^"]+)"\}|\{([^}:\s]+):([^}\s]+)\}|\{([^}\s:=)]+)\}/g;
      let match: RegExpExecArray | null;
      let candidate: any = null;
      while ((match = regex.exec(text)) !== null) {
        if (pos === match.index)
          return {
            name: match[1] || match[3] || match[4],
            type: match[2] || 'short_text',
            start: match.index,
            end: regex.lastIndex,
          };
        if (pos > match.index && pos < regex.lastIndex)
          return {
            name: match[1] || match[3] || match[4],
            type: match[2] || 'short_text',
            start: match.index,
            end: regex.lastIndex,
          };
        if (pos === regex.lastIndex)
          candidate = {
            name: match[1] || match[3] || match[4],
            type: match[2] || 'short_text',
            start: match.index,
            end: regex.lastIndex,
          };
      }
      return candidate;
    }, []);

    const measureCaretPosition = useCallback((element: HTMLInputElement, position: number) => {
      const div = document.createElement('div');
      const style = window.getComputedStyle(element);
      const props = [
        'direction',
        'boxSizing',
        'width',
        'height',
        'overflowX',
        'overflowY',
        'borderTopWidth',
        'borderRightWidth',
        'borderBottomWidth',
        'borderLeftWidth',
        'paddingTop',
        'paddingRight',
        'paddingBottom',
        'paddingLeft',
        'fontStyle',
        'fontVariant',
        'fontWeight',
        'fontStretch',
        'fontSize',
        'lineHeight',
        'fontFamily',
        'textAlign',
        'textTransform',
        'textIndent',
        'textDecoration',
        'letterSpacing',
        'wordSpacing',
      ];
      for (const prop of props) {
        (div.style as any)[prop] = style.getPropertyValue(prop);
      }
      div.style.position = 'fixed';
      div.style.visibility = 'hidden';
      div.style.whiteSpace = 'pre';
      div.style.top = '0';
      div.style.left = '-9999px';
      const text = element.value.substring(0, position);
      div.textContent = text;
      const span = document.createElement('span');
      span.textContent = element.value.substring(position, position + 1) || '.';
      div.appendChild(span);
      document.body.appendChild(div);
      const spanRect = span.getBoundingClientRect();
      const divRect = div.getBoundingClientRect();
      document.body.removeChild(div);
      return {
        top: spanRect.top - divRect.top,
        left: spanRect.left - divRect.left,
      };
    }, []);

    const updateTypePicker = (force = false) => {
      if (!internalInputRef.current) return;
      const input = internalInputRef.current;
      const pos = input.selectionStart || 0;
      const token = getActiveToken(localValue, pos);
      if (token) {
        if (force) {
          const rect = input.getBoundingClientRect();
          const coords = measureCaretPosition(input, token.start);
          const style = window.getComputedStyle(input);
          const lineHeight = parseFloat(style.lineHeight) || 15;
          setTypePicker({
            top: rect.top + coords.top + lineHeight + 4 - input.scrollLeft,
            left: Math.min(rect.left + coords.left - input.scrollLeft, rect.right - 200),
            token,
          });
        } else setTypePicker(null);
      } else if (force && pos > 0 && localValue[pos - 1] === '{') {
        const rect = input.getBoundingClientRect();
        const coords = measureCaretPosition(input, pos);
        const style = window.getComputedStyle(input);
        const lineHeight = parseFloat(style.lineHeight) || 15;
        setTypePicker({
          top: rect.top + coords.top + lineHeight + 4 - input.scrollLeft,
          left: rect.left + coords.left - input.scrollLeft,
          token: null,
        });
      } else setTypePicker(null);
    };

    const handleTypeSelect = (newType: string) => {
      if (!typePicker || !internalInputRef.current) return;
      let nextValue = localValue;
      const nextConfigs = { ...paramConfigs };

      if (typePicker.token) {
        const { start, end, name } = typePicker.token;
        nextValue = localValue.substring(0, start) + `{${name}}` + localValue.substring(end);
        nextConfigs[name] = { ...nextConfigs[name], type: newType as InlineParamConfig['type'] };
      } else {
        const existing = detectParamNames(localValue);
        let idx = 1;
        while (existing.includes(`input${idx}`)) idx++;
        const name = `input${idx}`;
        const start = localValue.lastIndexOf('{', internalInputRef.current.selectionStart || 0);
        nextValue =
          localValue.substring(0, start) +
          `{${name}}` +
          localValue.substring(internalInputRef.current.selectionStart || 0);
        nextConfigs[name] = { type: newType as InlineParamConfig['type'], values: [''] };
      }
      setLocalValue(nextValue);
      onChange({ value: nextValue, paramConfigs: nextConfigs });
      setTypePicker(null);
      // We removed the auto-focus here to prevent re-triggering the popup immediately
      // on systems where the focus triggers a click/keyup check.
      // requestAnimationFrame(() => internalInputRef.current?.focus());
    };

    const handleNameChange = (newName: string, tokenOverride?: any) => {
      const token = tokenOverride || typePicker?.token;
      if (!token || !newName) return;
      const { start, end, name: oldName } = token;

      const nextConfigs = { ...paramConfigs };
      if (nextConfigs[oldName]) {
        nextConfigs[newName] = { ...nextConfigs[oldName] };
        delete nextConfigs[oldName];
      }

      const nextValue = localValue.slice(0, start) + `{${newName}}` + localValue.slice(end);
      setLocalValue(nextValue);
      onChange({ value: nextValue, paramConfigs: nextConfigs });
    };

    const handleConfigChange = (updates: Partial<InlineParamConfig>) => {
      if (!typePicker?.token) return;
      const { name } = typePicker.token;
      const next = { ...paramConfigs, [name]: { ...paramConfigs[name], ...updates } };
      onChange({ value: localValue, paramConfigs: next });
    };

    return (
      <div
        className={`relative flex items-center gap-2 group/param-input w-full ${className || ''}`}
        style={style}
        onClick={() => onStartEditing?.()}>
        <input
          ref={internalInputRef}
          id={id}
          name={name}
          autoFocus={autoFocus}
          value={localValue}
          onChange={e => {
            const val = e.target.value;
            setLocalValue(val);
            onChange({ value: val, paramConfigs: ensureParamConfigsForText(val, paramConfigs) });
          }}
          onClick={e => {
            const token = getActiveToken(localValue, internalInputRef.current?.selectionStart || 0);
            if (token) {
              internalInputRef.current?.setSelectionRange(token.start, token.end);
              updateTypePicker(true);
            } else {
              updateTypePicker(false);
            }
          }}
          onKeyUp={e => {
            if (e.key === '{' && !disableTokenTrigger) updateTypePicker(true);
            onKeyUp?.(e);
          }}
          onFocus={e => {
            onFocus?.(e);
          }}
          onBlur={e => {
            onBlur?.(e);
            setTimeout(() => onStopEditing?.(), 200);
          }}
          onKeyDown={e => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              requestAnimationFrame(() => {
                const pos = internalInputRef.current?.selectionStart || 0;
                const regex = /\{input_name="([^"]+)"\}|\{([^}:\s]+):([^}\s]+)\}|\{([^}\s:=)]+)\}/g;
                let m: RegExpExecArray | null;
                while ((m = regex.exec(localValue)) !== null) {
                  if (pos > m.index && pos < regex.lastIndex) {
                    internalInputRef.current?.setSelectionRange(m.index, regex.lastIndex);
                    break;
                  }
                }
                updateTypePicker(false);
              });
            } else if (e.key === 'Enter') {
              const token = getActiveToken(localValue, internalInputRef.current?.selectionStart || 0);
              if (token) {
                e.preventDefault();
                updateTypePicker(true);
                return;
              }
            }
            onKeyDown?.(e);
          }}
          className="flex-1 bg-transparent border-none outline-none text-[11px] text-neutral-300 selection:bg-emerald-500/30 font-mono py-2"
          placeholder={placeholder}
        />
        {typePicker && (
          <TypePicker
            name={typePicker.token?.name || ''}
            type={typePicker.token?.type || 'short_text'}
            config={paramConfigs[typePicker.token?.name || ''] || { type: 'short_text' }}
            position={{ top: typePicker.top, left: typePicker.left }}
            isNew={!typePicker.token}
            onClose={() => setTypePicker(null)}
            onNameChange={handleNameChange}
            onTypeSelect={handleTypeSelect}
            onConfigChange={handleConfigChange}
            token={typePicker.token}
          />
        )}
      </div>
    );
  },
);
