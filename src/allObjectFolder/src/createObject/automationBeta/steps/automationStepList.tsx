import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FaPlus,
  FaCheckCircle,
  FaExclamationTriangle,
  FaRobot,
  FaExternalLinkAlt,
  FaMousePointer,
  FaPaste,
  FaKeyboard,
  FaClock,
  FaLink,
  FaSearch,
  FaEllipsisH,
  FaCog,
  FaCode,
  FaHistory,
  FaBookmark,
  FaCopy,
  FaClipboardList,
  FaCookieBite,
  FaChevronDown,
  FaTrash } from 'react-icons/fa';
import { CiWarning } from 'react-icons/ci';
import ReactDOM from 'react-dom';
import { HighlightedInput, formatParamBadgeName } from './automationStepPicker';
import { InlineParamConfig } from '../utilities/automationTypes';
import { convertLegacyParams } from '../utilities/automationUtils';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { AutomationStep } from '../utilities/automation';
import { SessionGridIcon } from '../../../../../shared-components/icons/sessionGridIcon';


interface AutomationStepListProps {
  steps: AutomationStep[];
  selectedStepId: string | number | null;
  onSelectStep: (id: string | number | null) => void;
  onAddStep: (index: number) => void;
  onDeleteStep: (id: string | number) => void;
  onDuplicateStep: (id: string | number) => void;
  onUpdateStep: (id: string | number, updates: Partial<AutomationStep>) => void;
  onActionClick?: (index: number) => void;
  // onAddSubStep?: (parentId: string, index: number) => void;
  onEditClick?: (id: string | number, rect?: DOMRect) => void;
  isRunning?: boolean;
  onReorderSteps?: (reordered: AutomationStep[]) => void;
  onReorderSubSteps?: (parentId: string, reorderedSubSteps: AutomationStep[]) => void;
  getStepLabel?: (step: AutomationStep) => string;
  isPickerOpen?: boolean;
  isEditing?: boolean;
  showUnconfiguredWarning?: boolean;
  onTokenEdit?: (stepId: string | number, tokenName: string) => void;
}

// InlineParamConfig and convertLegacyParams moved to AgentPanelTypes.ts and AgentPanelUtils.ts

const extractParamNameFromToken = (token: string): string => {
  const namedMatch = token.match(/^\{input_name="([^"]+)"\}$/);
  if (namedMatch) return namedMatch[1];
  const typeMatch = token.match(/^\{([^}:\s]+):([^}\s]+)\}$/);
  if (typeMatch) return typeMatch[2];
  const simpleMatch = token.match(/^\{([^}\s]+)\}$/);
  if (simpleMatch) return simpleMatch[1];
  return token;
};

const detectParamNames = (text: string): string[] => {
  const regex = /\{input_name="([^"]+)"\}|\{([^}:\s]+):([^}\s]+)\}|\{([^}\s:=)]+)\}/g;
  const names: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const name = match[1] || match[3] || match[4];
    if (name) names.push(name);
  }
  return Array.from(new Set(names));
};

const stripProtocol = (url: string): string => String(url || '').replace(/^https?:\/\//i, '');

const ensureParamConfigsForText = (
  text: string,
  existing: Record<string, InlineParamConfig>,
): Record<string, InlineParamConfig> => {
  const regex = /\{input_name="([^"]+)"\}|\{([^}:\s]+):([^}\s]+)\}|\{([^}\s:=)]+)\}/g;
  const next: Record<string, InlineParamConfig> = {};
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const name = match[1] || match[3] || match[4];
    let typeFromToken = match[2] as InlineParamConfig['type'] | undefined;
    if (typeFromToken === ('text' as any)) {
      typeFromToken = 'short_text';
    }

    if (name) {
      if (existing[name]) {
        next[name] = {
          ...existing[name],
          type: typeFromToken || existing[name].type || 'short_text',
        };
      } else {
        next[name] = { type: typeFromToken || 'short_text', values: [''] };
      }
    }
  }
  return next;
};

const TypePicker: React.FC<{
  name: string;
  type: InlineParamConfig['type'];
  config: InlineParamConfig;
  position: { top: number; left: number };
  onTypeSelect: (type: InlineParamConfig['type']) => void;
  onNameChange: (newName: string, token?: any) => void;
  onConfigChange: (updates: Partial<InlineParamConfig>) => void;
  onClose: () => void;
  isNew?: boolean;
  token?: any;
}> = ({ name, type, config, position, onTypeSelect, onNameChange, onConfigChange, onClose, isNew, token }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [localName, setLocalName] = useState(name);
  const containerRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const types: Array<{ id: InlineParamConfig['type']; label: string }> = [
    { id: 'short_text', label: 'Text' },

    { id: 'dropdown', label: 'Dropdown' },
    { id: 'constant', label: 'Constant' },
  ];

  useEffect(() => {
    setLocalName(name);
  }, [name]);

  useEffect(() => {
    const idx = types.findIndex(t => t.id === type);
    if (idx !== -1) setActiveIndex(idx);
  }, [type, name]); // Reset index when identity changes

  useEffect(() => {
    // Focus name input on open if not new
    let timer: NodeJS.Timeout;
    if (!isNew) {
      timer = setTimeout(() => {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      }, 50);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isNew]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInside = containerRef.current?.contains(target);

      // If we are inside an input (Name or Config), let it handle its own keys
      if (isInside && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        e.stopImmediatePropagation();
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
        return;
      }

      // Handle picker-wide navigation (even if focus is in the background URL input)
      if (e.key === 'ArrowDown') {
        e.stopImmediatePropagation();
        e.preventDefault();
        const nextIdx = (activeIndex + 1) % types.length;
        setActiveIndex(nextIdx);
        if (!isNew) {
          onTypeSelect(types[nextIdx].id);
        }
      } else if (e.key === 'ArrowUp') {
        e.stopImmediatePropagation();
        e.preventDefault();
        const nextIdx = (activeIndex - 1 + types.length) % types.length;
        setActiveIndex(nextIdx);
        if (!isNew) {
          onTypeSelect(types[nextIdx].id);
        }
      } else if (e.key === 'Tab') {
        const input = nameInputRef.current;
        if (input) {
          e.stopImmediatePropagation();
          e.preventDefault();
          input.focus();
        }
      } else if (e.key === 'Enter') {
        e.stopImmediatePropagation();
        e.preventDefault();

        // Finalize rename on Enter
        onNameChange(localName);
        if (isNew) {
          onTypeSelect(types[activeIndex].id);
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [activeIndex, onTypeSelect, onClose, types, type, isNew]);

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
      onKeyDown={e => e.stopPropagation()} // Shielding: Stop bubbling to background editor
      onKeyUp={e => e.stopPropagation()}
      className="fixed z-[99999] bg-[var(--color-editorBg)] border border-white/10 rounded-lg shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-2 w-56"
      style={{ top: position.top, left: position.left }}>
      {/* Name Input Section */}
      {!isNew && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-black text-white/30 tracking-widest uppercase px-1">Param Name</label>
            <input
              ref={nameInputRef}
              value={localName}
              onChange={e => {
                setLocalName(e.target.value);
              }}
              onKeyDown={e => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onNameChange(localName, token); // Commit on Enter
                  onClose();
                }
              }}
              onBlur={() => {
                onNameChange(localName, token); // Commit on Blur
              }}
              className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[11px] font-bold text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
              placeholder="Enter name..."
            />
          </div>
          <div className="h-px bg-white/5 my-0.5" />
        </>
      )}

      {/* Type Selection Section */}
      <div className="flex flex-col gap-1">
        <label className="text-[9px] font-black text-white/30 tracking-widest uppercase px-1">Data Type</label>
        <div className="flex flex-col gap-0.5">
          {types.map((t, i) => (
            <button
              key={t.id}
              onClick={() => {
                onTypeSelect(t.id);
                onClose();
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`w-full text-left px-2 py-1.5 rounded text-[10px] font-bold transition-all flex items-center justify-between ${
                activeIndex === i
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : type === t.id
                    ? 'text-white bg-white/5'
                    : 'text-neutral-500 hover:text-neutral-300'
              }`}>
              <div className="flex items-center gap-2">
                <div className={`w-1 h-1 rounded-full ${type === t.id ? 'bg-emerald-400' : 'bg-transparent'}`} />
                {t.label}
              </div>
              {(t.id === 'dropdown' || t.id === 'constant') && (
                <FaChevronDown size={8} className="-rotate-90 opacity-40 ml-auto mr-1" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
};

// convertLegacyParams moved to AgentPanelUtils.ts

const InlineUrlInput: React.FC<{
  step: AutomationStep;
  onUpdate: (updates: { url: string; paramConfigs?: Record<string, InlineParamConfig> }) => void;
  onOpenSettings: (rect: DOMRect) => void;
  onTokenEdit?: (tokenName: string) => void;
  isFocused: boolean;
  isEditing: boolean;
  onStartEditing: () => void;
  onStopEditing: () => void;
  isAdvancedFocused?: boolean;
  onLockFocus?: (isLocked: boolean) => void;
}> = ({
  step,
  onUpdate,
  onOpenSettings,
  onTokenEdit,
  isFocused,
  isEditing,
  onStartEditing,
  onStopEditing,
  isAdvancedFocused,
  onLockFocus,
}) => {
  const [value, setValue] = useState(step.config?.url || '');
  const [localParamConfigs, setLocalParamConfigs] = useState<Record<string, InlineParamConfig>>(
    (step.config?.paramConfigs || {}) as Record<string, InlineParamConfig>,
  );
  const [suggestions, setSuggestions] = useState<Array<{ title: string; url: string; type: 'history' | 'bookmark' }>>(
    [],
  );
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [typePicker, setTypePicker] = useState<{
    top: number;
    left: number;
    cursorPos: number;
    token: { fullToken: string; name: string; type: InlineParamConfig['type']; start: number; end: number } | null;
  } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const focusInputAtEnd = useCallback(() => {
    const inputEl = inputRef.current;
    if (!inputEl) return;
    inputEl.focus();
    const endPos = (inputEl.value || '').length;
    requestAnimationFrame(() => {
      inputEl.setSelectionRange(endPos, endPos);
    });
  }, []);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const adjustHeight = () => {
      input.style.height = 'auto';
      input.style.height = `${input.scrollHeight}px`;
    };
    adjustHeight();
  }, [value]);

  useEffect(() => {
    const currentUrl = step.config?.url || '';
    const converted = convertLegacyParams(
      currentUrl,
      (step.config?.paramConfigs || {}) as Record<string, InlineParamConfig>,
    );

    // Only Sync from props if either:
    // 1. We are not focused (e.g. loading a new step)
    // 2. The step ID changed
    if (!isInputFocused) {
      if (converted !== value) {
        setValue(converted);
      }
    }
  }, [step.config?.url, step.id, isInputFocused]);

  useEffect(() => {
    setLocalParamConfigs((step.config?.paramConfigs || {}) as Record<string, InlineParamConfig>);
  }, [step.id, step.config?.paramConfigs]);

  useEffect(() => {
    if (isFocused && inputRef.current && isEditing) {
      focusInputAtEnd();
    }
  }, [isFocused, isEditing, focusInputAtEnd]);

  useEffect(() => {
    if (!isInputFocused || value.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      const chromeAny = (window as any).chrome;
      if (!chromeAny?.history?.search) return;

      const historyPromise = new Promise<any[]>(resolve =>
        chromeAny.history.search({ text: value, maxResults: 5 }, resolve),
      );
      const bookmarksPromise = new Promise<any[]>(resolve => chromeAny.bookmarks.search(value, resolve));

      try {
        const [history, bookmarks] = await Promise.all([historyPromise, bookmarksPromise]);
        const unique = new Map<string, any>();
        bookmarks.forEach((b: any) => {
          if (b.url) unique.set(b.url, { title: b.title || b.url, url: b.url, type: 'bookmark' });
        });
        history.forEach((h: any) => {
          if (h.url) unique.set(h.url, { title: h.title || h.url, url: h.url, type: 'history' });
        });
        setSuggestions(Array.from(unique.values()).slice(0, 5));
      } catch (err) {
        console.error('Failed to fetch suggestions', err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [value, isInputFocused]);

  const handleBlur = () => {
    setTimeout(() => {
      if (document.activeElement?.closest('.TypePicker-container')) return; // Don't close if interacting with picker
      setIsInputFocused(false);
      onStopEditing();
      if (value !== step.config?.url) {
        onUpdate({ url: value, paramConfigs: localParamConfigs });
      }
    }, 200);
  };

  const getActiveToken = useCallback((text: string, cursorPos: number) => {
    const regex = /\{input_name="([^"]+)"\}|\{([^}:\s]+):([^}\s]+)\}|\{([^}\s:=)]+)\}/g;
    let match;
    let candidate: any = null;
    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = regex.lastIndex;
      let typeRaw = match[2];
      if (typeRaw === 'text') typeRaw = 'short_text';

      // If cursor is at the start of a token, it's a perfect match (priority)
      if (cursorPos === start) {
        return {
          fullToken: match[0],
          name: match[1] || match[3] || match[4],
          type: (match[2] as InlineParamConfig['type']) || 'short_text',
          start,
          end,
        };
      }

      // If cursor is strictly inside
      if (cursorPos > start && cursorPos < end) {
        return {
          fullToken: match[0],
          name: match[1] || match[3] || match[4],
          type: (match[2] as InlineParamConfig['type']) || 'short_text',
          start,
          end,
        };
      }

      // If cursor is at the end, it's a candidate, but we keep looking
      // in case the next token starts at this exact same position
      if (cursorPos === end) {
        candidate = {
          fullToken: match[0],
          name: match[1] || match[3] || match[4],
          type: (match[2] as InlineParamConfig['type']) || 'short_text',
          start,
          end,
        };
      }
    }
    return candidate;
  }, []);

  const measureCaretPosition = useCallback((element: HTMLTextAreaElement, position: number) => {
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
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
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

  const updateTypePickerPosition = useCallback(
    (forceShow = false) => {
      if (!inputRef.current) return;
      const input = inputRef.current;
      const cursorPos = input.selectionStart || 0;
      const activeToken = getActiveToken(value, cursorPos);

      if (activeToken) {
        if (forceShow) {
          const rect = input.getBoundingClientRect();
          const coords = measureCaretPosition(input, activeToken.start);
          const style = window.getComputedStyle(input);
          const lineHeight = parseFloat(style.lineHeight) || 15;

          setTypePicker({
            top: rect.top + coords.top + lineHeight + 4 - input.scrollTop,
            left: Math.min(rect.left + coords.left - input.scrollLeft, rect.right - 200),
            cursorPos,
            token: activeToken,
          });
        } else {
          setTypePicker(null);
        }
      } else if (cursorPos > 0 && value[cursorPos - 1] === '{' && forceShow) {
        const rect = input.getBoundingClientRect();
        const coords = measureCaretPosition(input, cursorPos);
        const style = window.getComputedStyle(input);
        const lineHeight = parseFloat(style.lineHeight) || 15;

        setTypePicker({
          top: rect.top + coords.top + lineHeight + 4 - input.scrollTop,
          left: rect.left + coords.left - input.scrollLeft,
          cursorPos,
          token: null,
        });
      } else {
        setTypePicker(null);
      }
    },
    [value, getActiveToken, measureCaretPosition],
  );

  const handleInputClick = () => {
    if (!inputRef.current) return;
    const pos = inputRef.current.selectionStart || 0;
    const token = getActiveToken(value, pos);

    if (token) {
      // Select whole token (Green Focus)
      inputRef.current.setSelectionRange(token.start, token.end);
      // For existing tokens: open token value config instead of TypePicker
      if (onTokenEdit) {
        onTokenEdit(token.name);
      } else {
        updateTypePickerPosition(true);
      }
    } else {
      updateTypePickerPosition(false);
    }
  };

  const handleTypeSelect = (newType: InlineParamConfig['type']) => {
    if (!typePicker || !inputRef.current) return;

    let nextValue = value;
    let nextToken = '';
    let activeTokenName = '';

    if (typePicker.token) {
      const { start, end, name } = typePicker.token;
      activeTokenName = name;
      const displayType = newType === 'short_text' ? 'text' : newType;
      nextToken = `{${displayType}:${name}}`;
      nextValue = value.substring(0, start) + nextToken + value.substring(end);
    } else {
      // Find a truly unique name by scanning the entire current URL
      const existingNames = new Set([
        ...Object.keys(localParamConfigs),
        ...Array.from(value.matchAll(/\{[^}:]+:([^}\s]+)\}/g)).map((m: any) => m[1]),
        ...Array.from(value.matchAll(/\{input_name="([^"]+)"\}/g)).map((m: any) => m[1]),
      ]);

      let idx = 1;
      while (existingNames.has(`input${idx}`)) idx += 1;
      const nextName = `input${idx}`;
      activeTokenName = nextName;

      const displayType = newType === 'short_text' ? 'text' : newType;
      nextToken = `{${displayType}:${nextName}}`;
      const startPos = Math.max(0, typePicker.cursorPos - 1);
      nextValue = value.substring(0, startPos) + nextToken + value.substring(typePicker.cursorPos);
    }

    const nextConfigs = ensureParamConfigsForText(nextValue, localParamConfigs);

    // Safety: ensure input is focused and state sync doesn't overwrite
    setIsInputFocused(true);
    if (inputRef.current) {
      inputRef.current.focus();
    }

    setValue(nextValue);
    setLocalParamConfigs(nextConfigs);
    onUpdate({ url: nextValue, paramConfigs: nextConfigs });

    // Automatically open configuration modal for complex types
    if (newType === 'dropdown' || newType === 'constant') {
      onTokenEdit?.(activeTokenName);
    }

    const tokenStart = typePicker.token ? typePicker.token.start : Math.max(0, typePicker.cursorPos - 1);
    const nextCursor = tokenStart + nextToken.length;

    // Only refocus if we are NOT opening a secondary modal/adv-editor
    if (newType !== 'dropdown' && newType !== 'constant') {
      requestAnimationFrame(() => {
        inputRef.current?.setSelectionRange(nextCursor, nextCursor);
      });
    }
  };

  const handleNameChange = (newName: string) => {
    if (!typePicker?.token || !newName) return;
    const { start, end, type } = typePicker.token;
    const displayType = type === 'short_text' ? 'text' : type;
    const nextToken = `{${displayType}:${newName}}`;
    const nextValue = value.slice(0, start) + nextToken + value.slice(end);

    setValue(nextValue);
    const nextConfigs = ensureParamConfigsForText(nextValue, localParamConfigs);
    setLocalParamConfigs(nextConfigs);
    onUpdate({ url: nextValue, paramConfigs: nextConfigs });
  };

  const handleConfigChange = (updates: Partial<InlineParamConfig>) => {
    if (!typePicker?.token) return;
    const { name } = typePicker.token;
    const next = { ...localParamConfigs, [name]: { ...localParamConfigs[name], ...updates } };
    setLocalParamConfigs(next);
    onUpdate({ url: value, paramConfigs: next });
  };

  return (
    <div
      className="relative flex items-center gap-2 group/url-inline w-full"
      ref={containerRef}
      onClick={e => {
        e.stopPropagation();
        if (!isEditing) {
          onStartEditing();
        }
        setTimeout(() => {
          focusInputAtEnd();
        }, 0);
      }}>
      <div className="flex-1 min-w-0 min-h-[28px] py-1">
        <textarea
          ref={inputRef}
          rows={1}
          value={value}
          onChange={e => {
            const val = e.target.value;
            setValue(val);
            const nextConfigs = ensureParamConfigsForText(val, localParamConfigs);
            setLocalParamConfigs(nextConfigs);
          }}
          onKeyUp={e => {
            // No auto-trigger on simple typing
            if (e.key === '{') {
              updateTypePickerPosition(true);
            }
          }}
          onClick={handleInputClick}
          onFocus={() => {
            setIsInputFocused(true);
            // No auto-trigger on focus anymore, stay clutter-free
          }}
          onBlur={handleBlur}
          placeholder="Enter URL (Click to edit)..."
          style={{ height: 'auto', overflowY: 'hidden', resize: 'none' }}
          className="w-full bg-transparent border-none outline-none text-[11px] text-neutral-300 selection:bg-emerald-500/30 resize-none block leading-[1.4] font-mono"
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const input = inputRef.current;
              if (input) {
                const sStart = input.selectionStart || 0;
                const sEnd = input.selectionEnd || 0;

                // If we have a selection (Green focus), check if it matches a token
                const token = getActiveToken(value, sStart);

                if (token && (sStart !== sEnd || (sStart >= token.start && sStart <= token.end))) {
                  e.preventDefault();
                  // Open paste config popup for existing token (not the TypePicker)
                  if (onTokenEdit) {
                    onTokenEdit(token.name);
                  } else {
                    updateTypePickerPosition(true);
                  }
                  return;
                }
              }

              if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
                const s = suggestions[highlightedIndex];
                const normalizedUrl = stripProtocol(s.url);
                setValue(normalizedUrl);
                onUpdate({ url: normalizedUrl, paramConfigs: localParamConfigs });
                setSuggestions([]);
                setIsInputFocused(false);
              } else {
                onUpdate({ url: value, paramConfigs: localParamConfigs });
                inputRef.current?.blur();
              }
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              // Precise Navigation: move cursor first, then check if we are INSIDE a token
              requestAnimationFrame(() => {
                const input = inputRef.current;
                if (!input) return;
                const pos = input.selectionStart || 0;

                // Use a slightly more robust check for 'hitting' a token
                const regex = /\{input_name="([^"]+)"\}|\{([^}:\s]+):([^}\s]+)\}|\{([^}\s:=)]+)\}/g;
                let m: RegExpExecArray | null;
                while ((m = regex.exec(value)) !== null) {
                  const start = m.index;
                  const end = regex.lastIndex;

                  // If we are moving LEFT and landed at end of token (pos === end),
                  // or moving RIGHT and landed at start of token (pos === start),
                  // we select it.
                  // But if we moved OUT (e.g. was at end, moved right, now pos > end), we stay in normal text.
                  if (pos > start && pos < end) {
                    input.setSelectionRange(start, end);
                    break;
                  }
                }
                updateTypePickerPosition(false);
              });
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              if (suggestions.length > 0) {
                e.preventDefault();
                setHighlightedIndex(prev =>
                  e.key === 'ArrowDown'
                    ? (prev + 1) % suggestions.length
                    : (prev - 1 + suggestions.length) % suggestions.length,
                );
              }
            } else if (e.key === 'Escape') {
              if (typePicker) {
                setTypePicker(null);
              } else {
                setSuggestions([]);
                setIsInputFocused(false);
                onStopEditing();
              }
            }
          }}
        />
      </div>

      {typePicker && (
        <div className="TypePicker-container" onMouseDown={e => e.stopPropagation()}>
          <TypePicker
            key={typePicker.token ? `${typePicker.token.start}-${typePicker.token.fullToken}` : 'new'}
            name={typePicker.token?.name || ''}
            type={typePicker.token?.type || 'short_text'}
            config={localParamConfigs[typePicker.token?.name || ''] || { type: 'short_text', values: [''] }}
            position={{ top: typePicker.top, left: typePicker.left }}
            onTypeSelect={handleTypeSelect}
            onNameChange={handleNameChange}
            onConfigChange={handleConfigChange}
            onClose={() => setTypePicker(null)}
            isNew={!typePicker.token}
            token={typePicker.token}
          />
        </div>
      )}

      {value && (
        <button
          data-advanced-settings-button="true"
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) onOpenSettings(rect);
          }}
          onMouseDown={e => e.stopPropagation()}
          className={`p-1 rounded-md border border-white/10 bg-white/[0.03] shadow-sm text-neutral-500 transition-all flex-none opacity-0 group-hover/url-inline:opacity-100 hover:bg-white/10 hover:border-white/20 hover:text-emerald-500 ${
            isAdvancedFocused ? 'opacity-100 ring-1 ring-white/25 bg-white/10 border-white/25 text-emerald-400' : ''
          }`}
          title="Advanced Settings">
          <FaCode size={12} />
        </button>
      )}

      {suggestions.length > 0 &&
        isInputFocused &&
        containerRef.current &&
        ReactDOM.createPortal(
          <div
            className="fixed bg-[var(--color-editorBg)] border border-white/10 rounded-lg shadow-2xl z-[99999] p-1.5 animate-in fade-in slide-in-from-top-1"
            style={{
              width: containerRef.current.getBoundingClientRect().width,
              left: containerRef.current.getBoundingClientRect().left,
              top: containerRef.current.getBoundingClientRect().bottom + 4,
            }}>
            {suggestions.map((s, i) => {
              let hostname = '';
              try {
                hostname = new URL(s.url).hostname;
              } catch {
                hostname = s.url;
              }
              return (
                <button
                  key={i}
                  onMouseDown={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    const normalizedUrl = stripProtocol(s.url);
                    setValue(normalizedUrl);
                    onUpdate({ url: normalizedUrl, paramConfigs: localParamConfigs });
                    setSuggestions([]);
                    setIsInputFocused(false);
                  }}
                  onMouseEnter={() => setHighlightedIndex(i)}
                  className={`w-full text-left px-2 py-1.5 rounded transition-colors flex items-center gap-3 ${
                    highlightedIndex === i ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}>
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=16`}
                    alt=""
                    className="h-3.5 w-3.5 rounded-sm flex-none"
                    onError={e => (e.currentTarget.style.display = 'none')}
                  />
                  <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                    <div className="text-[10px] font-bold text-neutral-200 truncate">{s.title || hostname}</div>
                    <div className="text-[9px] text-neutral-500 truncate font-mono">{stripProtocol(s.url)}</div>
                  </div>
                  <span className="flex-none text-neutral-500">
                    {s.type === 'bookmark' ? <FaBookmark size={8} /> : <FaHistory size={8} />}
                  </span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
};

// Inline Keystroke Recording Input
const InlineKeystrokeInput: React.FC<{
  step: AutomationStep;
  onUpdate: (updates: Partial<AutomationStep>) => void;
  isFocused: boolean;
  isEditing: boolean;
  onStartEditing: () => void;
  onStopEditing: () => void;
  onLockFocus?: (isLocked: boolean) => void;
}> = ({ step, onUpdate, isFocused, isEditing, onStartEditing, onStopEditing, onLockFocus }) => {
  const [value, setValue] = useState(step.config?.key || step.config?.text || (step.config?.config as any)?.key || '');
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const setRecordingLock = useCallback((active: boolean) => {
    (window as any).__tasklabsKeystrokeRecordingActive = active;
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.runtime?.sendMessage) {
      try {
        chromeAny.runtime.sendMessage({ action: 'tasklabs_keystroke_recording_state', active });
      } catch {
        // ignore messaging failures in local UI state changes
      }
    }
  }, []);

  useEffect(() => {
    setValue(step.config?.key || step.config?.text || (step.config?.config as any)?.key || '');
  }, [step.config?.key, step.config?.text, (step.config?.config as any)?.key]);

  useEffect(() => {
    if (isFocused && isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isFocused, isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const parts: string[] = [];
    let modifiers = 0;
    
    // Use getModifierState for maximum reliability across platforms/browsers
    const isCtrl = e.nativeEvent.getModifierState('Control');
    const isAlt = e.nativeEvent.getModifierState('Alt');
    const isShift = e.nativeEvent.getModifierState('Shift');
    const isMeta = e.nativeEvent.getModifierState('Meta') || e.nativeEvent.getModifierState('OS');

    if (isCtrl) { parts.push('Ctrl'); modifiers |= 2; }
    if (isAlt) { parts.push('Alt'); modifiers |= 1; }
    if (isShift) { parts.push('Shift'); modifiers |= 8; }
    if (isMeta) { parts.push('Meta'); modifiers |= 4; }

    let keyName = e.key;
    // For character keys with modifiers, use e.code to avoid "Dead" key or localized character issues (e.g. Alt+U on Mac)
    if (e.code.startsWith('Key') && (isAlt || isCtrl || isMeta)) {
      keyName = e.code.replace('Key', '');
    }
    
    if (keyName === ' ') keyName = 'Space';
    if (keyName.length === 1) keyName = keyName.toUpperCase();

    // Add the main key (including Escape, Control, etc.)
    const isModifierKey = ['Control', 'Alt', 'Shift', 'Meta'].includes(keyName);
    if (!isModifierKey) {
      parts.push(keyName);
    }

    // Only update if we have a complete combo (not just modifiers)
    if (parts.length > 0 && !isModifierKey) {
      const combo = parts.join('+');
      
      setValue(combo);
      // Pass both for maximum engine compatibility
      onUpdate({ 
        key: combo,
        modifiers: modifiers 
      } as any);
    }
  };

  const handleFocus = () => {
    setIsRecording(true);
    setRecordingLock(true);
    onStartEditing();
  };

  const handleBlur = () => {
    setIsRecording(false);
    setRecordingLock(false);
    onStopEditing();
  };

  useEffect(() => {
    return () => {
      setRecordingLock(false);
    };
  }, [setRecordingLock]);

  return (
    <div
      className="relative flex items-center gap-2 group/keystroke-inline w-full"
      onClick={e => {
        e.stopPropagation();
        if (!isEditing) {
          onStartEditing();
        }
        setTimeout(() => inputRef.current?.focus(), 0);
      }}>
      <div className="flex-1 min-w-0 min-h-[28px]" style={{ pointerEvents: isEditing ? 'auto' : 'none' }}>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={value}
            readOnly
            placeholder="Click & press key..."
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            className={`w-full bg-transparent text-[11px] font-mono font-semibold outline-none placeholder:text-neutral-600 transition-all cursor-pointer ${
              isRecording ? 'text-cyan-400' : value ? 'text-neutral-200' : 'text-neutral-500'
            }`}
          />
          {/* Recording indicator */}
          {isRecording && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider animate-pulse">REC</span>
            </div>
          )}
        </div>
      </div>
      {/* Visual key badge when value exists and not recording */}
      {value && !isRecording && (
        <div className="flex-none px-2 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-mono font-bold">
          {value}
        </div>
      )}
    </div>
  );
};

const SortableRow: React.FC<{
  row: { step: AutomationStep; index: number; subIndex?: number; parentId?: string; originalIndex: number };
  idx: number;
  selectedStepId: string | number | null;
  focusedCell: { row: number; col: number } | null;
  onSelectStep: (id: string | number | null) => void;
  setFocusedCell: (cell: { row: number; col: number } | null) => void;
  onActionClick?: (index: number) => void;
  onEditClick?: (id: string | number, rect?: DOMRect) => void;
  onDeleteStep: (id: string | number) => void;
  onDuplicateStep: (id: string | number) => void;
  // onAddSubStep?: (parentId: string, index: number) => void;
  getModuleIcon: (moduleId: string) => React.ReactNode;
  getStepLabel?: (step: AutomationStep) => string;
  renderRichDescription: (step: AutomationStep) => React.ReactNode;
  isConfigured: boolean;
  showUnconfiguredWarning: boolean;
  openRowMenuId: string | number | null;
  setOpenRowMenuId: (id: string | number | null) => void;
  onStopEditing: () => void;
  onUpdateStep: (id: string | number, updates: Partial<AutomationStep>) => void;
  isEditingInline: boolean;
  onStartEditing: () => void;
  onLockFocus?: (isLocked: boolean) => void;
  onTokenEdit?: (stepId: string | number, tokenName: string) => void;
}> = ({
  row,
  idx,
  selectedStepId,
  focusedCell,
  onSelectStep,
  setFocusedCell,
  onActionClick,
  onEditClick,
  onDeleteStep,
  onDuplicateStep,
  // onAddSubStep,
  getModuleIcon,
  getStepLabel,
  renderRichDescription,
  isConfigured,
  showUnconfiguredWarning,
  openRowMenuId,
  setOpenRowMenuId,
  onStopEditing,
  onUpdateStep,
  isEditingInline,
  onStartEditing,
  onLockFocus,
  onTokenEdit,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  const isMenuOpen = openRowMenuId === row.step.id;
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuItemRefs = useRef<HTMLButtonElement[]>([]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const timer = setTimeout(() => {
      menuItemRefs.current[0]?.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [isMenuOpen]);

  const menuItems = [
    // !row.parentId && onAddSubStep
    //   ? {
    //       key: 'add-substep',
    //       label: 'Add Substep',
    //       shortcut: 'Alt+Shift+=',
    //       onSelect: () => onAddSubStep(row.step.id as string, row.step.subSteps?.length || 0),
    //     }
    //   : null,
    { key: 'duplicate', label: 'Duplicate', shortcut: 'Alt+Shift+D', onSelect: () => onDuplicateStep(row.step.id) },
    { key: 'delete', label: 'Delete', shortcut: 'Del', onSelect: () => onDeleteStep(row.step.id), danger: true },
  
  ].filter(Boolean) as Array<{ key: string; label: string; onSelect: () => void; danger?: boolean; shortcut?: string }>;

  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpenRowMenuId(null);
      menuButtonRef.current?.focus();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;

    e.preventDefault();
    e.stopPropagation();
    const currentIndex = menuItemRefs.current.findIndex(el => el === document.activeElement);
    if (currentIndex === -1) {
      menuItemRefs.current[0]?.focus();
      return;
    }
    const delta = e.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = (currentIndex + delta + menuItemRefs.current.length) % menuItemRefs.current.length;
    menuItemRefs.current[nextIndex]?.focus();
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={e => {
        e.stopPropagation();
        onSelectStep(row.step.id);
        setFocusedCell({ row: idx, col: 2 });
      }}
      className={`group transition-colors ${
        selectedStepId === row.step.id ? 'bg-white/5' : 'hover:bg-white/[0.02]'
      } ${isDragging ? 'bg-white/10' : ''}`}>
      <td className="px-3 py-1.5 border-r border-neutral-700 relative">
        {focusedCell?.row === idx && focusedCell?.col === 0 && (
          <div className="absolute inset-0 border-2 border-white/20 pointer-events-none" />
        )}
        <div className="flex items-center justify-center">
          <span className="text-[10px] font-bold tracking-tight text-neutral-300">{row.index}</span>
        </div>
      </td>
      <td
        className="w-40 px-3 py-1.5 border-r border-neutral-700 relative cursor-pointer hover:bg-white/5 transition-colors"
        onClick={e => {
          e.stopPropagation();
          onActionClick?.(idx + 1);
        }}>
        {focusedCell?.row === idx && focusedCell?.col === 1 && (
          <div className="absolute inset-0 border-2 border-white/20 pointer-events-none" />
        )}
        <div className="flex items-center">
          <span className="text-[10px] font-bold text-white tracking-tight">
            {getStepLabel
              ? getStepLabel(row.step)
              : row.step.moduleId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </span>
        </div>
      </td>
      <td
        className="px-4 py-1.5 relative cursor-pointer hover:bg-white/5 transition-colors"
        onClick={e => {
          e.stopPropagation();
          setFocusedCell({ row: idx, col: 2 });
          if (row.step.moduleId !== 'open_tab' && row.step.moduleId !== 'keystroke') {
            const rect = e.currentTarget.getBoundingClientRect();
            onEditClick?.(row.step.id, rect);
          }
        }}>
        {focusedCell?.row === idx && focusedCell?.col === 2 && (
          <div className="absolute inset-0 border-2 border-white/20 pointer-events-none" />
        )}
        <div className="flex items-center gap-1.5 py-0.5 w-full">
          {showUnconfiguredWarning && !isConfigured ? (
            <div
              className={`flex-none transition-opacity duration-200 ${
                selectedStepId === row.step.id || focusedCell?.row === idx ? 'opacity-0' : 'opacity-100'
              }`}
              title="Step is not fully configured">
              <CiWarning className="text-red-500" size={14} />
            </div>
          ) : null}
          <div
            className={`flex-1 group-hover:text-white transition-colors break-all whitespace-normal duration-200 ${
              row.step.moduleId === 'open_tab' || row.step.moduleId === 'keystroke'
                ? 'overflow-visible'
                : 'overflow-hidden max-h-[22px] group-hover:max-h-[180px]'
            }`}
            title="F2 to Edit">
            {row.step.moduleId === 'open_tab' ? (
              <InlineUrlInput
                step={row.step}
                onUpdate={updates => onUpdateStep(row.step.id, updates as any)}
                onOpenSettings={rect => onEditClick?.(row.step.id, rect)}
                onTokenEdit={tokenName => onTokenEdit?.(row.step.id, tokenName)}
                isFocused={focusedCell?.row === idx && focusedCell?.col === 2}
                isEditing={isEditingInline}
                onStartEditing={onStartEditing}
                onStopEditing={onStopEditing}
                isAdvancedFocused={focusedCell?.row === idx && focusedCell?.col === 3}
                onLockFocus={onLockFocus}
              />
            ) : row.step.moduleId === 'keystroke' ? (
              <InlineKeystrokeInput
                step={row.step}
                onUpdate={updates => onUpdateStep(row.step.id, updates as any)}
                isFocused={focusedCell?.row === idx && focusedCell?.col === 2}
                isEditing={isEditingInline}
                onStartEditing={onStartEditing}
                onStopEditing={onStopEditing}
                onLockFocus={onLockFocus}
              />
            ) : (
              <div className="transition-colors">{renderRichDescription(row.step)}</div>
            )}
          </div>
          <div
            className={`relative flex items-center gap-1 flex-none ml-auto transition-opacity ${
              focusedCell?.row === idx && focusedCell?.col === 4 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
            onClick={e => {
              e.stopPropagation();
              setFocusedCell({ row: idx, col: 4 });
            }}>
            <button
              ref={menuButtonRef}
              type="button"
              data-step-menu-button
              onClick={e => {
                e.stopPropagation();
                setOpenRowMenuId(isMenuOpen ? null : row.step.id);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setOpenRowMenuId(row.step.id);
                }
              }}
              className={`p-1.5 rounded-md text-neutral-500 hover:text-neutral-300 hover:bg-white/5 transition-colors ${
                focusedCell?.row === idx && focusedCell?.col === 4
                  ? 'ring-1 ring-white/25 bg-white/5 text-neutral-300'
                  : ''
              }`}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}>
              <FaEllipsisH size={14} />
            </button>

            {isMenuOpen && (
              <div
                data-step-menu
                role="menu"
                onKeyDown={handleMenuKeyDown}
                className="absolute right-0 top-full mt-2 w-36 rounded-lg border border-white/10 bg-[var(--color-editorBg)] shadow-xl z-[200] p-1"
                onMouseDown={e => e.stopPropagation()}>
                {menuItems.map((item, index) => (
                  <button
                    key={item.key}
                    ref={el => {
                      if (el) menuItemRefs.current[index] = el;
                    }}
                    type="button"
                    role="menuitem"
                    onClick={e => {
                      e.stopPropagation();
                      item.onSelect();
                      setOpenRowMenuId(null);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors flex items-center justify-between gap-2 ${
                      item.danger ? 'text-red-400 hover:bg-red-500/10' : 'text-neutral-200 hover:bg-white/5'
                    }`}>
                    <span>{item.label}</span>
                    {item.shortcut ? (
                      <span className="text-[9px] font-semibold text-neutral-500 tracking-wider">{item.shortcut}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
};

const AutomationStepList: React.FC<AutomationStepListProps> = ({
  steps,
  selectedStepId,
  onSelectStep,
  onAddStep,
  onDeleteStep,
  onDuplicateStep,
  onUpdateStep,
  onActionClick,
  // onAddSubStep,
  onEditClick,
  onReorderSteps,
  onReorderSubSteps,
  getStepLabel,
  isPickerOpen = false,
  isEditing = false,
  showUnconfiguredWarning = false,
  onTokenEdit,
}) => {
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | number | null>(null);
  const [draggingId, setDraggingId] = useState<string | number | null>(null);
  const [openRowMenuId, setOpenRowMenuId] = useState<string | number | null>(null);
  const [isAnyMenuOpen, setIsAnyMenuOpen] = useState(false); // Depth 3 tracking
  const tableRef = useRef<HTMLDivElement>(null);

  // Depth-based focus management
  const getFocusDepth = useCallback(() => {
    if (isAnyMenuOpen) return 3; // Variable Menu
    if (editingStepId !== null || isEditing || isPickerOpen) return 2; // URL Editor (Inline or Advanced) or Picker
    if (focusedCell || selectedStepId) return 1; // Table Row
    return 0; // Global
  }, [isAnyMenuOpen, editingStepId, isEditing, isPickerOpen, focusedCell, selectedStepId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Render only top-level steps (substeps are hidden from UI)
  const flattenedSteps = useMemo(() => {
    const flat: { step: AutomationStep; index: number; subIndex?: number; parentId?: string; originalIndex: number }[] =
      [];
    steps.forEach((step, idx) => {
      flat.push({ step, index: idx + 1, originalIndex: idx });
    });
    return flat;
  }, [steps]);

  // Auto-focus on mount
  useEffect(() => {
    if (tableRef.current) {
      tableRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (!openRowMenuId) return;

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-step-menu]') || target.closest('[data-step-menu-button]')) return;
      setOpenRowMenuId(null);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [openRowMenuId]);

  useEffect(() => {
    const onFocusStepTable = (evt: Event) => {
      const customEvt = evt as CustomEvent<{ target?: 'select' | 'last_menu' }>;
      const target = customEvt?.detail?.target || 'select';
      if (flattenedSteps.length === 0) return;

      const lastRow = flattenedSteps.length - 1;
      const selectedRow = selectedStepId !== null ? flattenedSteps.findIndex(s => s.step.id === selectedStepId) : 0;
      const safeSelectedRow = selectedRow >= 0 ? selectedRow : 0;
      const rowToFocus = target === 'last_menu' ? lastRow : safeSelectedRow;
      const colToFocus = target === 'last_menu' ? 4 : 2;

      setFocusedCell({ row: rowToFocus, col: colToFocus });
      onSelectStep(flattenedSteps[rowToFocus]?.step.id || null);

      // Auto-enter editing mode for keystroke steps when added
      const stepToFocus = flattenedSteps[rowToFocus]?.step;
      if (stepToFocus?.moduleId === 'keystroke' && target === 'select') {
        setEditingStepId(stepToFocus.id);
      }

      setTimeout(() => {
        tableRef.current?.focus({ preventScroll: true });
        if (target === 'last_menu') {
          const menuButton = tableRef.current?.querySelector(
            `tbody tr:nth-child(${rowToFocus + 1}) [data-step-menu-button]`,
          ) as HTMLButtonElement | null;
          menuButton?.focus();
        }
      }, 0);
    };
    window.addEventListener('agent-step-table-focus', onFocusStepTable as EventListener);
    return () => window.removeEventListener('agent-step-table-focus', onFocusStepTable as EventListener);
  }, [flattenedSteps, onSelectStep, selectedStepId]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Navigation logic with boundary checks for inline inputs
      const target = e.target as HTMLElement;

      // 1. Always ignore if we're in a parameter badge menu or other non-inline-input portal
      if (target.closest('[data-param-menu="true"]') || target.closest('[data-step-menu]')) return;

      // 2. Define cursor check helpers
      const getCursorPos = () => {
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          return { start: target.selectionStart ?? 0, end: target.selectionEnd ?? 0, len: target.value.length };
        }
        if (target.isContentEditable) {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const preCaretRange = range.cloneRange();
            preCaretRange.selectNodeContents(target);
            preCaretRange.setEnd(range.startContainer, range.startOffset);
            const start = preCaretRange.toString().length;
            preCaretRange.setEnd(range.endContainer, range.endOffset);
            const end = preCaretRange.toString().length;
            return { start, end, len: target.innerText.length };
          }
        }
        return { start: 0, end: 0, len: 0 };
      };

      // 3. Conditional bypass for inline editing
      // 3. Strict Depth-Based Blocking
      const depth = getFocusDepth();

      // If we are at Depth 3 (Menu) or Depth 2 (Editor), let the foreground components handle keys.
      // THE TABLE (Depth 1) MUST BE LOCKED.
      if (depth > 1) {
        // Bulletproof Shield: If focus is at Level 2 (Editor) or 3 (Menu),
        // the Table (Level 1) MUST NOT react to any events.
        return;
      } else {
        // Standard blocking for non-editing states
        if (isEditing || isPickerOpen) return;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target.isContentEditable)
          return;
      }

      const currentFocused = focusedCell || {
        row: flattenedSteps.findIndex(s => s.step.id === selectedStepId),
        col: 2,
      };
      if (currentFocused.row === -1) currentFocused.row = 0;

      const { row, col } = currentFocused;
      const rowCount = flattenedSteps.length;
      const colCount = 4; // Select Step, Configuration, Advanced, Menu

      const currentStep = flattenedSteps[row]?.step;
      const hasAdvancedSettings =
        !!currentStep &&
        currentStep.moduleId === 'open_tab' &&
        typeof currentStep.config?.url === 'string' &&
        currentStep.config.url.trim().length > 0;

      const moveFocus = (r: number, c: number) => {
        if (rowCount === 0) return;
        const nextR = Math.min(Math.max(r, 0), rowCount - 1);
        let nextC = Math.min(Math.max(c, 1), colCount);
        const nextStep = flattenedSteps[nextR]?.step;
        const nextHasAdvanced =
          !!nextStep &&
          nextStep.moduleId === 'open_tab' &&
          typeof nextStep.config?.url === 'string' &&
          nextStep.config.url.trim().length > 0;

        if (nextC === 3 && !nextHasAdvanced) {
          nextC = col > 3 ? 4 : 2;
        }
        setFocusedCell({ row: nextR, col: nextC });
        onSelectStep(flattenedSteps[nextR]?.step.id || null);
      };

      const triggerAddStep = (insertIdx: number) => {
        if (onActionClick) {
          onActionClick(insertIdx);
        } else {
          onAddStep(insertIdx);
        }
      };

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          moveFocus(row - 1, col);
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (rowCount > 0 && row >= rowCount - 1) {
            triggerAddStep(steps.length);
            return;
          }
          moveFocus(row + 1, col);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (col === 1) {
            moveFocus(row, 4);
          } else if (col === 4) {
            moveFocus(row, hasAdvancedSettings ? 3 : 2);
          } else if (col === 3) {
            moveFocus(row, 2);
          } else {
            moveFocus(row, 1);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (col === 1) {
            moveFocus(row, 2);
          } else if (col === 2) {
            moveFocus(row, hasAdvancedSettings ? 3 : 4);
          } else if (col === 3) {
            moveFocus(row, 4);
          } else {
            window.dispatchEvent(new CustomEvent('agent-speaker-focus-list', { detail: { target: 'open_click' } }));
          }
          break;
        case 'Tab':
          e.preventDefault();
          if (e.shiftKey) {
            if (col > 1) moveFocus(row, col - 1);
            else if (row > 0) moveFocus(row - 1, colCount);
          } else {
            if (col < colCount) moveFocus(row, col + 1);
            else if (row < rowCount - 1) moveFocus(row + 1, 1);
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (col === 1 && onActionClick) {
            onActionClick(row + 1);
          } else if (col === 2 && onEditClick) {
            const step = flattenedSteps[row]?.step;
            if (step?.moduleId === 'keystroke' || step?.moduleId === 'open_tab') {
              // For keystroke and open_tab, Enter triggers inline editing
              setFocusedCell({ row, col: 2 });
              setEditingStepId(step.id);
            } else {
              const cellElement = tableRef.current?.querySelector(`tbody tr:nth-child(${row + 1}) td:nth-child(3)`);
              const rect = cellElement?.getBoundingClientRect();
              onEditClick(step.id, rect);
            }
          } else if (col === 3) {
            const cellElement = tableRef.current?.querySelector(`tbody tr:nth-child(${row + 1}) td:nth-child(3)`);
            const advButton = cellElement?.querySelector('[data-advanced-settings-button="true"]') as
              | HTMLButtonElement
              | undefined;
            if (advButton) {
              advButton.click();
            }
          } else if (col === 4) {
            const menuButton = tableRef.current?.querySelector(
              `tbody tr:nth-child(${row + 1}) [data-step-menu-button]`,
            ) as HTMLButtonElement | null;
            menuButton?.click();
          } else {
            onSelectStep(flattenedSteps[row]?.step.id || null);
          }
          break;
        case 'F2':
          e.preventDefault();
          if (flattenedSteps[row]) {
            const f2Step = flattenedSteps[row].step;
            if (f2Step?.moduleId === 'keystroke' || f2Step?.moduleId === 'open_tab') {
              // For keystroke and open_tab, F2 triggers inline editing
              setFocusedCell({ row, col: 2 });
              setEditingStepId(f2Step.id);
            } else if (onEditClick) {
              const cellElement = tableRef.current?.querySelector(`tbody tr:nth-child(${row + 1}) td:nth-child(3)`);
              const rect = cellElement?.getBoundingClientRect();
              onEditClick(f2Step.id, rect);
            }
          }
          break;
        case 'Escape': {
          // Focus Depth: 2 (Advanced Editor), 1 (Row Selected), 0 (Global)
          const depth = editingStepId ? 2 : focusedCell || selectedStepId ? 1 : 0;
          if (depth > 0) {
            e.preventDefault();
            e.stopPropagation();
            if (depth === 2) {
              setEditingStepId(null);
              requestAnimationFrame(() => {
                tableRef.current?.focus();
              });
            } else {
              setFocusedCell(null);
              onSelectStep(null);
            }
          }
          break;
        }
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          if (flattenedSteps[row]) onDeleteStep(flattenedSteps[row].step.id);
          break;
        case 'Insert':
          e.preventDefault();
          onAddStep(flattenedSteps[row] ? flattenedSteps[row].originalIndex + 1 : 0);
          break;
        case '+':
        case '=':
          // if (e.altKey && e.shiftKey) {
          //   e.preventDefault();
          //   const stepId = flattenedSteps[row]?.step.id;
          //   if (stepId && !flattenedSteps[row].parentId) {
          //     onAddSubStep?.(stepId, flattenedSteps[row].step.subSteps?.length || 0);
          //   }
          // } else
          if (e.altKey) {
            e.preventDefault();
            const insertIdx = flattenedSteps[row] ? flattenedSteps[row].originalIndex + 1 : steps.length;
            onActionClick?.(insertIdx);
          }
          break;
        case 'D':
        case 'd':
          if (e.altKey && e.shiftKey) {
            e.preventDefault();
            if (flattenedSteps[row]) onDuplicateStep(flattenedSteps[row].step.id);
          } else if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (flattenedSteps[row]) onDuplicateStep(flattenedSteps[row].step.id);
          }
          break;
      }
    },
    [
      focusedCell,
      flattenedSteps,
      selectedStepId,
      onSelectStep,
      onDeleteStep,
      onDuplicateStep,
      onAddStep,
      onActionClick,
      steps.length,
    ],
  );

  // Synchronize selection with focus and handle popup closing
  useEffect(() => {
    // If NO blocking UI is open, ensure table is focused when selection exists or UI just closed
    if (!isPickerOpen && !isEditing) {
      const rowIndex = selectedStepId !== null ? flattenedSteps.findIndex(s => s.step.id === selectedStepId) : -1;

      if (rowIndex !== -1 && (!focusedCell || focusedCell.row !== rowIndex)) {
        const preferredCol = !focusedCell || focusedCell.col === 1 ? 2 : focusedCell.col;
        setFocusedCell({ row: rowIndex, col: preferredCol });
      }

      const frameId = requestAnimationFrame(() => {
        // Only steal focus if we aren't already typing in something else
        if (tableRef.current && !document.activeElement?.closest('input, textarea')) {
          tableRef.current.focus({ preventScroll: true });
        }
      });
      return () => cancelAnimationFrame(frameId);
    }
    return undefined;
  }, [selectedStepId, flattenedSteps, isPickerOpen, isEditing]);

  // Auto-scroll focused row into view
  useEffect(() => {
    if (focusedCell) {
      const rowEl = tableRef.current?.querySelector(`tbody tr:nth-child(${focusedCell.row + 1})`);
      if (rowEl) {
        rowEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedCell]);

  const getModuleIcon = (moduleId: string) => {
    switch (moduleId) {
      case 'agent':
        return <FaRobot size={12} className="text-emerald-500" />;
      case 'open_tab':
        return <FaExternalLinkAlt size={10} className="text-blue-500" />;
      case 'click':
        return <FaMousePointer size={10} className="text-orange-500" />;
      case 'paste':
        return <FaPaste size={10} className="text-purple-500" />;
      case 'clipboard_paste':
        return <FaPaste size={10} className="text-orange-400" />;
      case 'keystroke':
        return <FaKeyboard size={10} className="text-[var(--color-iconDefault)]" />;
      case 'wait':
        return <FaClock size={10} className="text-amber-500" />;

      case 'clipboard_write':
        return <FaClipboardList size={10} className="text-indigo-400" />;
      case 'cookies_clear':
        return <FaCookieBite size={10} className="text-amber-600" />;
      case 'link':
        return <FaLink size={10} className="text-sky-500" />;
      case 'sub_automation':
        return <SessionGridIcon size={10} className="text-indigo-500" />;
      default:
        return <FaSearch size={10} className="text-[var(--color-iconDefault)]" />;
    }
  };

  const isStepConfigured = (step: AutomationStep) => {
    const config = step.config || {};
    const hasText = (val: any) => typeof val === 'string' && val.trim().length > 0;
    const hasAnyValues = (values: any) => Array.isArray(values) && values.some(v => hasText(v));

    switch (step.moduleId) {
      case 'open_tab':
        return hasText(config.url);
      case 'agent':
        return hasText(config.promptLabel) || hasText(config.fixedValue) || hasText(config.dropdownOptions);
      case 'click':
        return hasText(config.selector) || hasText(config.selectorElementName);
      case 'paste':
        return hasText(config.content) || hasText(config.selector) || hasText(config.selectorElementName);
      case 'clipboard_paste':
        return hasText(config.selector) || hasText(config.selectorElementName);
      case 'keystroke':
        return hasText(config.key) || hasText(config.text) || (config.config && hasText((config.config as any).key));
      case 'wait':
        return true;
      case 'cookies_clear':
        return true;
      case 'clipboard_write':
        return hasText(config.text);
      case 'link':
        return hasText(config.url) || hasText(config.name);
      case 'sub_automation':
        return hasText(config.name);
      default:
        if (Array.isArray(config.prompts)) {
          return config.prompts.some((p: any) => hasText(p.key) || hasAnyValues(p.values));
        }
        if (Array.isArray(config.inputs)) {
          return config.inputs.some((input: any) => hasText(input.fixedValue) || hasText(input.dropdownOptions));
        }
        return hasText(config.name);
    }
  };

  const renderRichDescription = (step: AutomationStep) => {
    const text = getStepDescriptionText(step);
    if (!text) return <span className="text-neutral-400">No details specified</span>;

    const { config } = step;

    // Regex for both {variable} and {input_name="label"}
    const regex = /(\{input_name="[^"]+?"\}|\{[^}\s]+\})/g;
    const parts = text.split(regex);

    return (
      <div className="flex flex-wrap gap-2 items-start leading-relaxed py-1">
        {parts.map((part, i) => {
          if (!part.trim()) return null;
          if (/^\{input_name="[^"]+?"\}$/.test(part) || /^\{[^}\s]+\}$/.test(part)) {
            // Extract the name or label
            let name = part.slice(1, -1);
            if (part.startsWith('{input_name="')) {
              name = part.match(/"([^"]+)"/)?.[1] || name;
            }

            // Resolution logic matching AgentOptionPopup.tsx
            let displayName = formatParamBadgeName(name);
            let configValue = 'Text';

            const PARAM_TYPE_BADGE_LABEL: Record<string, string> = {
              short_text: 'Text',
              long_text: 'Long Text',
              dropdown: 'Dropdown',
              constant: 'Constant',
            };

            const cfg =
              config.paramConfigs?.[name] ||
              (Array.isArray(config.prompts) ? config.prompts.find((p: any) => p.key === name) : null) ||
              (Array.isArray(config.inputs) ? config.inputs.find((inp: any) => inp.id === name) : null) ||
              (config.promptLabel === name
                ? { type: config.dropdownOptions ? 'dropdown' : 'long_text', values: [config.fixedValue] }
                : null);

            if (cfg) {
              displayName = cfg.displayName || displayName;
              // If we have a non-empty value, show it. Otherwise show the type label.
              const firstVal = cfg.values?.[0];
              if (firstVal && String(firstVal).trim() !== '') {
                configValue = firstVal;
              } else {
                if (cfg.type === 'dropdown') {
                  const count = cfg.values?.length || 0;
                  configValue = count > 0 ? `${count} ${count === 1 ? 'Dropdown' : 'Dropdowns'}` : 'Dropdown';
                } else {
                  configValue =
                    PARAM_TYPE_BADGE_LABEL[cfg.type] ||
                    (cfg.type === 'short_text'
                      ? 'Text'
                      : cfg.type === 'long_text'
                        ? 'Long Text'
                        : cfg.type === 'constant'
                          ? 'Constant'
                          : 'Text');
                }
              }
            } else if (config.promptLabel === name) {
              // Implicit fallback for the main prompt variable if no complex config exists
              if (config.dropdownOptions) {
                const count = (config.dropdownOptions as string).split(',').filter(Boolean).length;
                configValue = count > 0 ? `${count} ${count === 1 ? 'Dropdown' : 'Dropdowns'}` : 'Dropdown';
              } else {
                configValue = 'Text';
              }
            }

            return (
              <span
                key={i}
                className="inline-flex h-5 items-center gap-1.5 px-2 py-0 rounded-xl bg-black/50 border border-white/20 text-[10px] font-bold text-neutral-200 whitespace-nowrap align-middle shadow-sm hover:border-white/30 transition-all cursor-default scale-95 origin-left animate-in fade-in zoom-in-95 duration-200">
                <span className="text-emerald-500/80 uppercase text-[9px] tracking-tight">
                  {PARAM_TYPE_BADGE_LABEL[cfg?.type || 'short_text'] || 'Text'}
                </span>
                <span className="text-white/20 font-black h-3 w-px bg-white/10" />
                <span className="text-white font-black truncate max-w-[120px]">{displayName}</span>
              </span>
            );
          }
          return (
            <span key={i} className="text-neutral-600 dark:text-neutral-300 text-[11px] font-medium">
              {part}
            </span>
          );
        })}
      </div>
    );
  };

  const getStepDescriptionText = (step: AutomationStep): string => {
    const { moduleId, config } = step;
    if (moduleId === 'agent') {
      const label = config.promptLabel ? `{${config.promptLabel}}` : '';
      const val = config.fixedValue || config.dropdownOptions || '';
      return label && val ? `${label} ${val}` : label || val || 'Agent Step';
    }
    if (moduleId === 'open_tab') return config.url || 'Add your link';
    if (moduleId === 'click') return config.selectorElementName || config.selector || 'Click a button';
    if (moduleId === 'paste')
      return config.content || config.selectorElementName || config.selector || 'Paste in input field ';
    if (moduleId === 'clipboard_paste') return config.selectorElementName || config.selector || 'Paste from clipboard';
    if (moduleId === 'keystroke')
      return config.key || config.text || (config.config as any)?.key || 'Click & press key...';
    if (moduleId === 'wait') return `${config.delay || 1000}ms delay`;

    if (moduleId === 'clipboard_write') return config.text || 'Write to Clipboard';
    if (moduleId === 'cookies_clear') return 'Clear Cookies';
    if (moduleId === 'link') return config.name || config.url || 'Link';
    if (moduleId === 'sub_automation') return config.name || 'Sub-automation';

    return config.name || '';
  };

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggingId(null);

    if (!over || active.id === over.id) return;

    const activeItem = flattenedSteps.find(s => s.step.id === active.id);
    const overItem = flattenedSteps.find(s => s.step.id === over.id);

    if (!activeItem || !overItem) return;

    // Cases:
    // 1. Both are top-level steps
    if (!activeItem.parentId && !overItem.parentId) {
      if (onReorderSteps) {
        const oldIndex = steps.findIndex(s => s.id === active.id);
        const newIndex = steps.findIndex(s => s.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          onReorderSteps(arrayMove(steps, oldIndex, newIndex));
        }
      }
    }
    // 2. Both are sub-steps of the SAME parent
    else if (activeItem.parentId && overItem.parentId && activeItem.parentId === overItem.parentId) {
      if (onReorderSubSteps) {
        const parent = steps.find(s => s.id === activeItem.parentId);
        if (parent?.subSteps) {
          const oldIndex = parent.subSteps.findIndex(s => s.id === active.id);
          const newIndex = parent.subSteps.findIndex(s => s.id === over.id);
          if (oldIndex !== -1 && newIndex !== -1) {
            onReorderSubSteps(activeItem.parentId, arrayMove(parent.subSteps, oldIndex, newIndex));
          }
        }
      }
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-[var(--color-editorBg)] overflow-hidden outline-none"
      ref={tableRef}
      onKeyDownCapture={handleKeyDown}
      tabIndex={0}
      onClick={() => tableRef.current?.focus()}>
      {/* Table Content */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-[var(--color-editorBg)]">
        <table className="w-full border-collapse text-left table-fixed">
          <thead className="sticky top-0 z-10 bg-[var(--color-editorBg)] shadow-sm">
            <tr className="border-b border-white/10">
              <th className="w-16 px-3 py-2 text-[10px] font-bold text-neutral-500 tracking-wider border-r border-neutral-700">
                #
              </th>
              <th className="w-40 px-3 py-2 text-[10px] font-bold text-neutral-500 tracking-wider border-r border-neutral-700">
                Step Name
              </th>
              <th className="px-4 py-2 text-[10px] font-bold text-neutral-500 tracking-wider">
                <div className="flex items-center justify-between">
                  <span>Configuration</span>
                  <span className="text-neutral-500">Steps : {steps.length}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {flattenedSteps.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-24 text-center">
                  <div className="flex flex-col items-center justify-center gap-3 text-neutral-400 text-[11px]">
                    <span className="italic">No steps added yet.</span>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        const insertIdx = steps.length;
                        if (onActionClick) {
                          onActionClick(insertIdx);
                        } else {
                          onAddStep(insertIdx);
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-all shadow-sm">
                      <FaPlus size={10} /> Select a Step
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}>
                <SortableContext items={flattenedSteps.map(s => s.step.id)} strategy={verticalListSortingStrategy}>
                  {flattenedSteps.map((row, idx) => (
                    <SortableRow
                      key={row.step.id}
                      row={row}
                      idx={idx}
                      selectedStepId={selectedStepId}
                      focusedCell={focusedCell}
                      onSelectStep={onSelectStep}
                      setFocusedCell={setFocusedCell}
                      onActionClick={onActionClick}
                      onEditClick={onEditClick}
                      onDeleteStep={onDeleteStep}
                      onDuplicateStep={onDuplicateStep}
                      // onAddSubStep={onAddSubStep}
                      getModuleIcon={getModuleIcon}
                      getStepLabel={getStepLabel}
                      renderRichDescription={renderRichDescription}
                      isConfigured={isStepConfigured(row.step)}
                      showUnconfiguredWarning={showUnconfiguredWarning}
                      openRowMenuId={openRowMenuId}
                      setOpenRowMenuId={setOpenRowMenuId}
                      onUpdateStep={onUpdateStep}
                      isEditingInline={editingStepId === row.step.id}
                      onStartEditing={() => setEditingStepId(row.step.id)}
                      onStopEditing={() => setEditingStepId(null)}
                      onLockFocus={setIsAnyMenuOpen}
                      onTokenEdit={onTokenEdit}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
            {flattenedSteps.length > 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-5">
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        const insertIdx = steps.length;
                        if (onActionClick) {
                          onActionClick(insertIdx);
                        } else {
                          onAddStep(insertIdx);
                        }
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-all shadow-sm">
                      <FaPlus size={10} /> Select a Step
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AutomationStepList;
