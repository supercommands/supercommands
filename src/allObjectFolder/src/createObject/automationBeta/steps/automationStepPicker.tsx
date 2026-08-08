import * as React from 'react';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactDOM, { createPortal } from 'react-dom';
import AutomationStore from '../utilities/automationStore';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import {
  FaTimes,
  FaPlus,
  FaTrash,
  FaChevronDown,
  FaSearch,
  FaHistory,
  FaCode,
  FaBookmark,
  FaLink,
  FaInfoCircle,
  FaCog,
  FaCheck,
  FaSync,
  FaMousePointer,
  FaCookieBite,
  FaArrowLeft,
  FaArrowRight,
  FaAlignLeft,
  FaList,
  FaMinus,
  FaLock,
} from 'react-icons/fa';

// ── Helper: extract display name from a {param} or {input_name="param"} token ──
export const extractParamName = (token: string): string => {
  const namedMatch = token.match(/^\{input_name="([^"]+)"\}$/);
  if (namedMatch) return namedMatch[1];

  // Try to match {type:name} - prioritizing the colon as a separator
  const typeMatch = token.match(/^\{([^}:\s]+):([^}\s]+)\}$/);
  if (typeMatch) return typeMatch[2];

  // Try to match simple {name} or fallback
  const simpleMatch = token.match(/^\{([^}\s]+)\}$/);
  if (simpleMatch) {
    const inner = simpleMatch[1];
    // Double check if it has a colon but typeMatch missed it (e.g. invalid type)
    if (inner.includes(':')) {
      return inner.split(':')[1];
    }
    return inner;
  }
  return token.replace(/^\{|\}$/g, '');
};

const PARAM_TYPE_MENU_OPTIONS: Array<{ type: ParamInputType; label: string }> = [];

export const PARAM_TYPE_BADGE_LABEL: Record<ParamInputType, string> = {
  short_text: 'Short Text',
  long_text: 'Long Text',
  dropdown: 'Dropdown',
  constant: 'Constant',
};

// ── Parse / Assemble URL ──
export const parseUrlParts = (url: string) => {
  try {
    let rawUrl = url;
    let hadProtocol = true;
    // If it doesn't start with a protocol or valid template, try to parse it
    if (!/^https?:\/\//i.test(rawUrl) && !/^\{/.test(rawUrl)) {
      // If it looks like a domain (supports subdomains like app.slack.com, sub.example.co.uk)
      if (/^[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}(\/.*)?$/.test(rawUrl)) {
        hadProtocol = false;
        rawUrl = 'http://' + rawUrl;
      } else {
        // If it's just garbage or incomplete, don't force anything yet
        return null;
      }
    }

    // Temporarily replace {param} templates to avoid URL-encoding by new URL()
    const placeholders: string[] = [];
    const safeUrl = rawUrl.replace(/\{input_name="[^"]+"\}|\{[^}:\s]+:[^}\s]+\}|\{[^}\s]+\}/g, (match: string) => {
      placeholders.push(match);
      return `__PARAM_${placeholders.length - 1}__`;
    });
    const u = new URL(safeUrl);
    // Decode and restore placeholders
    const restore = (s: string) =>
      decodeURIComponent(s).replace(/__PARAM_(\d+)__/gi, (_, idx) => placeholders[parseInt(idx)]);

    const rawPaths = u.pathname.split('/');
    const rawQuery = (u.search || '').replace(/^\?/, '');
    const querySegments = rawQuery ? rawQuery.split('&').map(restore) : [];
    const urlWithoutSearch = safeUrl.split('?')[0].split('#')[0];
    const hasTrailingSlash = urlWithoutSearch.endsWith('/');
    const paths = rawPaths.filter(Boolean).map(restore);

    // Handle hash/fragment (e.g., #inbox?compose=new)
    // The hash can contain its own path and query segments (common in SPAs like Gmail)
    const rawHash = u.hash || '';
    let hash = '';
    let hashQuerySegments: string[] = [];
    if (rawHash) {
      // Remove leading # and restore placeholders
      const hashContent = restore(rawHash.replace(/^#/, ''));
      // Check if hash contains query params (e.g., #inbox?compose=new)
      const hashQueryIndex = hashContent.indexOf('?');
      if (hashQueryIndex !== -1) {
        hash = hashContent.slice(0, hashQueryIndex);
        const hashQueryString = hashContent.slice(hashQueryIndex + 1);
        hashQuerySegments = hashQueryString ? hashQueryString.split('&') : [];
      } else {
        hash = hashContent;
      }
    }

    return {
      protocol: hadProtocol ? u.protocol.replace(':', '') : '',
      domain: restore(u.host),
      paths,
      querySegments,
      search: restore(u.search),
      hasTrailingSlash,
      hash,
      hashQuerySegments,
    };
  } catch {
    return null;
  }
};

export const assembleUrl = (parts: {
  protocol: string;
  domain: string;
  paths: string[];
  querySegments: string[];
  search: string;
  hasTrailingSlash?: boolean;
  hash?: string;
  hashQuerySegments?: string[];
}) => {
  const protocol = parts.protocol || '';
  const domain = parts.domain.replace(/\/+$/, '') || 'example.com';
  let pathStr = parts.paths.length > 0 ? '/' + parts.paths.join('/') : '';
  if (parts.hasTrailingSlash && !pathStr.endsWith('/')) {
    pathStr += '/';
  } else if (parts.paths.length === 0 && parts.hasTrailingSlash) {
    pathStr = '/';
  }
  const query =
    parts.querySegments.length > 0
      ? `?${parts.querySegments
          .map(s => s.trim())
          .filter(Boolean)
          .join('&')}`
      : parts.search;

  // Build hash portion (e.g., #inbox?compose=new)
  let hashStr = '';
  if (parts.hash) {
    hashStr = `#${parts.hash}`;
    if (parts.hashQuerySegments && parts.hashQuerySegments.length > 0) {
      hashStr += `?${parts.hashQuerySegments
        .map(s => s.trim())
        .filter(Boolean)
        .join('&')}`;
    }
  }

  return protocol ? `${protocol}://${domain}${pathStr}${query}${hashStr}` : `${domain}${pathStr}${query}${hashStr}`;
};

export const formatParamBadgeName = (rawName: string) => {
  // Strip any type prefix if it slipped through (e.g. "short_text:my_input" -> "my_input")
  let cleanName = rawName;
  if (cleanName.includes(':')) {
    cleanName = cleanName.split(':')[1];
  }
  return cleanName;
};

const stripProtocol = (url: string) => String(url || '').replace(/^https?:\/\//i, '');

// ── ParamBadge: renders a param token as an inline pill/badge ──
const ParamBadge: React.FC<{
  token: string;
  type?: ParamInputType;
  displayName?: string;
  configValue?: string;
  onSelectType?: (type: ParamInputType) => void;
  options?: string[];
  optionPairs?: Array<{ key: string; value: string }>;
  onSaveOptions?: (newOptions: string[]) => void;
  onSaveOptionPairs?: (pairs: Array<{ key: string; value: string }>) => void;
  customInputValue?: string;
  customDescriptionValue?: string;
  onSaveCustomInput?: (value: string) => void;
  onSaveCustomDescription?: (value: string) => void;
  onRename?: (newName: string) => void;
  onOpenOptions?: () => void;
  historySuggestions?: { value: string; title: string }[];
  isFetchingHistory?: boolean;
  isKeyboardFocused?: boolean;
  focusedPart?: 'name' | 'type' | null;
  actionTrigger?: { part: 'name' | 'type'; ts: number } | null;
  onFocusBack?: () => void;
  onLockFocus?: (isLocked: boolean) => void;
  onInteraction?: (part: 'name' | 'type') => void;
  isTokenEditor?: boolean;
}> = props => {
  const {
    token,
    type,
    displayName,
    configValue,
    onSelectType,
    options = [],
    optionPairs = [],
    onSaveOptions,
    onSaveOptionPairs,
    customInputValue = '',
    customDescriptionValue = '',
    onSaveCustomInput,
    onSaveCustomDescription,
    onRename,
    onOpenOptions,
    historySuggestions = [],
    isFetchingHistory = false,
    isKeyboardFocused = false,
    focusedPart = null,
    actionTrigger = null,
    onFocusBack = null,
    onLockFocus = null,
    onInteraction = null,
    isTokenEditor = false,
  } = props;
  const name = extractParamName(token);
  const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingCustomInput, setIsEditingCustomInput] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [customInputDraft, setCustomInputDraft] = useState('');
  const [customDescriptionDraft, setCustomDescriptionDraft] = useState('');
  const [dropdownRows, setDropdownRows] = useState<Array<{ id: string; name: string; value: string }>>([]);
  const badgeRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const isHydratingDropdownRowsRef = useRef(false);
  const lastAutoSavedOptionsRef = useRef('');
  const [menuRect, setMenuRect] = useState<DOMRect | null>(null);
  const shouldFocusFirstDropdownRowRef = useRef(false);
  const [showTypeSelector, setShowTypeSelector] = useState(true);
  const typeButtonRefs = useRef<Record<ParamInputType, HTMLButtonElement | null>>({
    short_text: null,
    long_text: null,
    dropdown: null,
    constant: null,
  });
  const dropdownNameInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const dropdownValueInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const prevIsTypeMenuOpen = useRef(isTypeMenuOpen);

  const isDropdownType =
    type === 'dropdown' ||
    configValue === 'dropdown' ||
    configValue === 'Pre-Fill text options' ||
    configValue === 'Dropdown';
  const isConstantType = type === 'constant' || configValue === 'constant' || configValue === 'Constant';

  useEffect(() => {
    // When menu closes, return focus to the parent badge/editor
    if (prevIsTypeMenuOpen.current && !isTypeMenuOpen) {
      onFocusBack?.();
    }
    prevIsTypeMenuOpen.current = isTypeMenuOpen;
  }, [isTypeMenuOpen, onFocusBack]);

  useEffect(() => {
    if (!isTypeMenuOpen) return;
    if (badgeRef.current) {
      setMenuRect(badgeRef.current.getBoundingClientRect());
    }
  }, [isTypeMenuOpen]);

  useEffect(() => {
    if (!isTypeMenuOpen) return;

    // When opening the menu, if it's already a dropdown, we initially hide the type selection
    // to show just the options table, as requested by the user.
    setShowTypeSelector(!isDropdownType);

    if (shouldFocusFirstDropdownRowRef.current && isDropdownType) return;

    const activeType: ParamInputType =
      type === 'long_text'
        ? 'long_text'
        : type === 'dropdown'
          ? 'dropdown'
          : type === 'constant'
            ? 'constant'
            : 'short_text';
    requestAnimationFrame(() => {
      // Only focus the type button if we are actually showing the selector!
      if (!isDropdownType || showTypeSelector) {
        typeButtonRefs.current[activeType]?.focus();
      }
    });
  }, [isTypeMenuOpen, type, isDropdownType, showTypeSelector]);

  useEffect(() => {
    if (!isTypeMenuOpen) return;
    const syncRect = () => {
      if (badgeRef.current) {
        setMenuRect(badgeRef.current.getBoundingClientRect());
      }
    };
    window.addEventListener('scroll', syncRect, true);
    window.addEventListener('resize', syncRect);
    return () => {
      window.removeEventListener('scroll', syncRect, true);
      window.removeEventListener('resize', syncRect);
    };
  }, [isTypeMenuOpen]);

  // Keyboard Triggering
  useEffect(() => {
    if (!actionTrigger) return;
    if (actionTrigger.part === 'name') {
      setIsEditingName(true);
    } else if (actionTrigger.part === 'type') {
      setIsTypeMenuOpen(prev => {
        if (!prev) shouldFocusFirstDropdownRowRef.current = true;
        return true;
      });
    }
  }, [actionTrigger]);

  // Auto-close menu if keyboard focus moves away from the type part
  useEffect(() => {
    if (!isKeyboardFocused || focusedPart !== 'type') {
      setIsTypeMenuOpen(false);
    }
    if (!isKeyboardFocused || focusedPart !== 'name') {
      setIsEditingName(false);
    }
  }, [isKeyboardFocused, focusedPart]);

  // Restore focus to parent when internal editing/menu closing
  const wasEditingNameRef = useRef(false);
  const wasMenuOpenInlineRef = useRef(false);

  useEffect(() => {
    onLockFocus?.(isEditingName || isTypeMenuOpen || isEditingCustomInput);
  }, [isEditingName, isTypeMenuOpen, isEditingCustomInput, onLockFocus]);

  useEffect(() => {
    if (wasEditingNameRef.current && !isEditingName) {
      onFocusBack?.();
    }
    wasEditingNameRef.current = isEditingName;
  }, [isEditingName]);

  useEffect(() => {
    if (wasMenuOpenInlineRef.current && !isTypeMenuOpen) {
      onFocusBack?.();
    }
    wasMenuOpenInlineRef.current = isTypeMenuOpen;
  }, [isTypeMenuOpen]);

  useEffect(() => {
    if (!isTypeMenuOpen) return;
    const onOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (badgeRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      if (badgeRef.current) {
        setIsTypeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, [isTypeMenuOpen]);

  useEffect(() => {
    if (!isEditingCustomInput) return;
    setCustomInputDraft(customInputValue || '');
    requestAnimationFrame(() => {
      customInputRef.current?.focus();
      const len = customInputRef.current?.value.length || 0;
      customInputRef.current?.setSelectionRange(len, len);
    });
  }, [isEditingCustomInput, customInputValue]);

  useEffect(() => {
    setCustomDescriptionDraft(customDescriptionValue || '');
  }, [customDescriptionValue]);

  useEffect(() => {
    if (!isEditingName) return;
    setNameDraft(displayName || formatParamBadgeName(name));
  }, [isEditingName, displayName, name]);

  const normalizeOptionValues = useCallback((values: string[]) => {
    return Array.from(new Set(values.map(v => String(v || '').trim()).filter(Boolean)));
  }, []);

  useEffect(() => {
    if (!isTypeMenuOpen || (!isDropdownType && !isConstantType)) return;

    const byValue = new Map<string, { name: string; value: string }>();

    optionPairs.forEach((pair, idx) => {
      const clean = String(pair?.value || '').trim();
      if (!clean) return;
      if (!byValue.has(clean)) {
        byValue.set(clean, {
          name: String(pair?.key || '').trim() || `Option ${idx + 1}`,
          value: clean,
        });
      }
    });

    options.forEach((val, idx) => {
      const clean = String(val || '').trim();
      if (!clean) return;
      if (!byValue.has(clean)) {
        // Special case for constant: if no name is provided, leave it empty as requested by user
        const defaultName = isConstantType ? '' : `Option ${idx + 1}`;
        byValue.set(clean, { name: defaultName, value: clean });
      }
    });

    historySuggestions.forEach((suggestion, idx) => {
      const clean = String(suggestion?.value || '').trim();
      if (!clean) return;
      if (!byValue.has(clean)) {
        const defaultName = isConstantType ? '' : String(suggestion?.title || '').trim() || `History ${idx + 1}`;
        byValue.set(clean, {
          name: defaultName,
          value: clean,
        });
      }
    });

    const rows = Array.from(byValue.values()).map((row, idx) => ({
      id: `dropdown-row-${idx}-${row.value}`,
      name: row.name,
      value: row.value,
    }));

    isHydratingDropdownRowsRef.current = true;
    setDropdownRows(rows.length > 0 ? rows : [{ id: `dropdown-row-${Date.now()}`, name: '', value: '' }]);
    requestAnimationFrame(() => {
      isHydratingDropdownRowsRef.current = false;
    });
  }, [isTypeMenuOpen, isDropdownType, isConstantType, name, options, historySuggestions, optionPairs]);

  useEffect(() => {
    if (!isTypeMenuOpen || !shouldFocusFirstDropdownRowRef.current) return;

    if (isDropdownType) {
      if (dropdownRows.length > 0) {
        const firstRowId = dropdownRows[0]?.id;
        if (firstRowId) {
          requestAnimationFrame(() => {
            const target = dropdownValueInputRefs.current[firstRowId] || dropdownNameInputRefs.current[firstRowId];
            target?.focus();
            target?.select();
          });
          shouldFocusFirstDropdownRowRef.current = false;
        }
      }
    }
  }, [isTypeMenuOpen, isDropdownType, dropdownRows]);

  const saveInlineCustomInput = (nextValue?: string, shouldClose = false) => {
    const valueToSave = nextValue ?? customInputDraft;
    onSaveCustomInput?.(valueToSave);
    if (shouldClose) {
      setIsEditingCustomInput(false);
    }
  };

  const handleNameSave = () => {
    if (nameDraft.trim()) {
      onRename?.(nameDraft.trim());
    }
    setIsEditingName(false);
  };

  const updateDropdownRow = (rowId: string, field: 'name' | 'value', nextValue: string) => {
    setDropdownRows(prev => prev.map(row => (row.id === rowId ? { ...row, [field]: nextValue } : row)));
  };

  const addDropdownRow = useCallback((insertIndex?: number) => {
    const newRow = {
      id: `dropdown-row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: '',
      value: '',
    };

    setDropdownRows(prev => {
      if (insertIndex === undefined || insertIndex < 0 || insertIndex > prev.length) {
        return [...prev, newRow];
      }
      const next = [...prev];
      next.splice(insertIndex, 0, newRow);
      return next;
    });

    return newRow.id;
  }, []);

  const handleSaveDropdownRows = (shouldClose = true) => {
    if (!onSaveOptions && !onSaveOptionPairs) {
      if (shouldClose) setIsTypeMenuOpen(false);
      return;
    }
    const nextPairs = dropdownRows
      .map((row, idx) => ({
        key: String(row.name || '').trim() || `Option ${idx + 1}`,
        value: String(row.value || '').trim(),
      }))
      .filter(row => row.value || row.key);
    const nextValues = normalizeOptionValues(nextPairs.map(row => row.value));
    const nextSerialized = JSON.stringify(nextValues);
    if (nextSerialized !== lastAutoSavedOptionsRef.current) {
      lastAutoSavedOptionsRef.current = nextSerialized;
      onSaveOptionPairs?.(nextPairs);
      onSaveOptions?.(nextValues);
    }
    if (shouldClose) setIsTypeMenuOpen(false);
  };

  const focusDropdownCell = useCallback(
    (rowIndex: number, column: 'name' | 'value') => {
      if (rowIndex < 0 || rowIndex >= dropdownRows.length) return;
      const rowId = dropdownRows[rowIndex]?.id;
      if (!rowId) return;
      const target = column === 'name' ? dropdownNameInputRefs.current[rowId] : dropdownValueInputRefs.current[rowId];
      target?.focus();
      target?.select();
    },
    [dropdownRows],
  );

  const handleDropdownCellKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, column: 'name' | 'value') => {
      e.stopPropagation();

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        if (!showTypeSelector && isDropdownType) {
          // Go back to type selection mode if we were in the dropdown options
          setShowTypeSelector(true);
          requestAnimationFrame(() => {
            typeButtonRefs.current.dropdown?.focus();
          });
        } else {
          // Close entire badge menu if we are already in the type selector
          setIsTypeMenuOpen(false);
        }
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusDropdownCell(rowIndex - 1, column);
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusDropdownCell(rowIndex + 1, column);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (column === 'name') {
          focusDropdownCell(rowIndex, 'value');
          return;
        }

        const newRowId = addDropdownRow(rowIndex + 1);
        requestAnimationFrame(() => {
          const target = dropdownValueInputRefs.current[newRowId] || dropdownNameInputRefs.current[newRowId];
          target?.focus();
          target?.select();
        });
        return;
      }

      // ONLY switch columns if the cursor is at the very beginning (for Left) or end (for Right).
      // This allows the user to move the cursor within the text.
      const target = e.currentTarget;
      const isAtStart = target.selectionStart === 0 && target.selectionEnd === 0;
      const isAtEnd = target.selectionStart === target.value.length && target.selectionEnd === target.value.length;

      if (e.key === 'ArrowLeft' && column === 'value' && isAtStart) {
        e.preventDefault();
        focusDropdownCell(rowIndex, 'name');
        return;
      }

      if (e.key === 'ArrowRight' && column === 'name' && isAtEnd) {
        e.preventDefault();
        focusDropdownCell(rowIndex, 'value');
      }
    },
    [focusDropdownCell, addDropdownRow],
  );

  const isExpanded = isKeyboardFocused || isHovered || isTypeMenuOpen || isEditingCustomInput || isEditingName;

  return (
    <span
      ref={badgeRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative inline-flex ${isExpanded ? 'min-w-[92px]' : 'min-w-0'} max-w-[240px] h-5 items-center justify-center gap-1 px-2 py-0 bg-black/50 border border-white/20 text-[10px] font-bold text-neutral-200 whitespace-nowrap align-middle shadow-sm rounded-xl transition-all duration-200 ease-in-out ${isEditingName ? 'ring-1 ring-white/20' : 'active:scale-95'}`}
      style={{ verticalAlign: 'baseline', pointerEvents: 'auto', top: '-1px' }}>
      {isEditingName ? (
        <input
          value={nameDraft}
          onChange={e => setNameDraft(e.target.value)}
          onBlur={handleNameSave}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleNameSave();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setIsEditingName(false);
            }
            e.stopPropagation();
          }}
          autoFocus
          className="bg-transparent border-none p-0 outline-none text-white w-20"
        />
      ) : (
        <span
          className={`text-white hover:text-white cursor-pointer transition-colors flex items-center gap-1.5 group/name rounded px-1 -mx-1 ${
            isKeyboardFocused && focusedPart === 'name' ? 'ring-2 ring-emerald-500/50 bg-emerald-500/10' : ''
          }`}
          onClick={e => {
            e.stopPropagation();
            onInteraction?.('name');
            setIsEditingName(true);
          }}
          onMouseDown={e => {
            e.stopPropagation();
            onInteraction?.('name');
          }}
          title="Click to rename">
          <span className="text-emerald-500/80 mr-[1px]">{`{`}</span>
          <span className="text-emerald-400/90">{type || 'short_text'}</span>
          <span className="text-white/30 mx-[2px]">{':'}</span>
          <span className="max-w-[120px] truncate text-white">{name}</span>
          <span className="text-emerald-500/80 ml-[1px]">{`}`}</span>
        </span>
      )}
      {configValue && isExpanded && (
        <>
          <span className="text-white/40 mx-[2px] animate-in fade-in zoom-in-95 duration-200">{':'}</span>
          {isEditingCustomInput ? (
            <input
              ref={customInputRef}
              value={customInputDraft}
              onChange={e => {
                const nextVal = e.target.value;
                setCustomInputDraft(nextVal);
                // Autosave while typing so Enter is not required.
                saveInlineCustomInput(nextVal, false);
              }}
              onMouseDown={e => {
                e.stopPropagation();
              }}
              onClick={e => e.stopPropagation()}
              onKeyDown={e => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveInlineCustomInput(undefined, true);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setIsEditingCustomInput(false);
                }
              }}
              onBlur={() => saveInlineCustomInput(undefined, true)}
              placeholder="Custom input"
              className="w-[120px] bg-transparent border border-white/20 rounded px-1 py-0 text-[10px] text-white outline-none animate-in fade-in slide-in-from-left-1 duration-200"
            />
          ) : (
            <div
              className={`flex items-center ml-[2px] bg-black rounded shadow-sm border border-transparent hover:border-white/10 transition-all group/btn-group animate-in fade-in slide-in-from-left-1 duration-200 ${
                isKeyboardFocused && focusedPart === 'type' ? 'ring-2 ring-emerald-500/50' : ''
              }`}>
              <button
                type="button"
                onMouseDown={e => {
                  e.stopPropagation();
                  setIsTypeMenuOpen(prev => {
                    const next = !prev;
                    if (next) {
                      shouldFocusFirstDropdownRowRef.current = true;
                    }
                    return next;
                  });
                }}
                onClick={e => e.stopPropagation()}
                ref={toggleButtonRef}
                className={`flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-bold transition-all rounded-l focus:outline-none ${
                  configValue === 'dropdown' || configValue === 'Pre-Fill text options'
                    ? 'text-white hover:bg-white/5'
                    : 'text-neutral-400 hover:text-white hover:bg-white/5'
                }`}>
                {(() => {
                  if (
                    configValue === 'short_text' ||
                    !configValue ||
                    configValue === 'Short Text' ||
                    configValue === 'Text'
                  ) {
                    return isTokenEditor ? 'Text' : 'Short Text';
                  }
                  if (configValue === 'long_text' || configValue === 'Long Text') return 'Long Text';
                  if (configValue === 'constant' || configValue === 'Constant') return 'Constant';
                  if (
                    configValue === 'dropdown' ||
                    configValue === 'Pre-Fill text options' ||
                    configValue === 'Dropdown'
                  ) {
                    const count = options.length;
                    return count > 0 ? `${count} ${count === 1 ? 'Dropdown' : 'Dropdowns'}` : 'Dropdown';
                  }
                  return configValue;
                })()}
              </button>
              <button
                type="button"
                className={`px-1 py-0.5 hover:bg-white/5 rounded-r transition-all focus:outline-none ${
                  isTypeMenuOpen ? 'bg-white/10' : ''
                }`}
                onMouseDown={e => {
                  e.stopPropagation();
                  setIsTypeMenuOpen(prev => {
                    const next = !prev;
                    if (next) {
                      shouldFocusFirstDropdownRowRef.current = true;
                    }
                    return next;
                  });
                }}
                onClick={e => e.stopPropagation()}>
                <FaChevronDown
                  size={8}
                  className={`text-neutral-500 transition-transform ${isTypeMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
          )}
        </>
      )}
      {isTypeMenuOpen &&
        menuRect &&
        ReactDOM.createPortal(
          <div
            ref={menuRef}
            data-param-menu="true"
            tabIndex={-1}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => {
              e.stopPropagation();
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                if (!showTypeSelector && isDropdownType) {
                  setShowTypeSelector(true);
                  requestAnimationFrame(() => typeButtonRefs.current.dropdown?.focus());
                } else {
                  setIsTypeMenuOpen(false);
                  requestAnimationFrame(() => toggleButtonRef.current?.focus());
                }
              }
            }}
            style={{
              position: 'fixed',
              zIndex: 2147483647,
              left: Math.max(
                8,
                Math.min(menuRect.left, window.innerWidth - (!showTypeSelector && isDropdownType ? 300 : 168)),
              ),
              top: menuRect.bottom + 6,
              maxHeight: Math.min(400, window.innerHeight - menuRect.bottom - 10),
              width: !showTypeSelector && isDropdownType ? '280px' : 'auto',
              minWidth: '160px',
            }}
            className="bg-[#0a0a0a] border border-white/20 rounded-xl overflow-hidden shadow-[0_0_40px_-5px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.05)] animate-in fade-in zoom-in-95 duration-100 flex flex-col outline-none ring-1 ring-white/10">
            <div className="flex flex-col p-2 gap-2">
              {showTypeSelector && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[9px] font-black text-white/30 px-1 tracking-widest">Type Selection</span>
                  <div className="flex flex-col items-stretch gap-1">
                    {(['short_text', 'long_text', 'dropdown', 'constant'] as const).map(t => {
                      const isActive = type === t || (!type && t === 'short_text');
                      const label =
                        t === 'short_text'
                          ? isTokenEditor
                            ? 'Text'
                            : 'Short Text'
                          : t === 'long_text'
                            ? 'Long Text'
                            : t === 'constant'
                              ? 'Constant'
                              : 'Dropdown';
                      return (
                        <button
                          key={t}
                          ref={el => {
                            if (typeButtonRefs.current) typeButtonRefs.current[t] = el;
                          }}
                          onMouseDown={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (t === 'dropdown') {
                              onSelectType?.('dropdown');
                              onOpenOptions?.();
                              setShowTypeSelector(false);
                              shouldFocusFirstDropdownRowRef.current = true;
                            } else {
                              onSelectType?.(t);
                              setIsTypeMenuOpen(false);
                            }
                          }}
                          onKeyDown={e => {
                            e.stopPropagation();
                            e.nativeEvent.stopImmediatePropagation();
                            const types = ['short_text', 'long_text', 'dropdown', 'constant'] as const;
                            const currentIndex = types.indexOf(t);

                            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                              e.preventDefault();
                              const next = types[(currentIndex + 1) % types.length];
                              requestAnimationFrame(() => typeButtonRefs.current[next]?.focus());
                            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                              e.preventDefault();
                              const prev = types[(currentIndex - 1 + types.length) % types.length];
                              requestAnimationFrame(() => typeButtonRefs.current[prev]?.focus());
                            } else if (e.key === 'Home') {
                              e.preventDefault();
                              requestAnimationFrame(() => typeButtonRefs.current.short_text?.focus());
                            } else if (e.key === 'End') {
                              e.preventDefault();
                              requestAnimationFrame(() => typeButtonRefs.current.constant?.focus());
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              setIsTypeMenuOpen(false);
                              // Immediate Return Focus using rAF for frame-perfection
                              requestAnimationFrame(() => toggleButtonRef.current?.focus());
                            } else if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              if (t === 'dropdown') {
                                onSelectType?.('dropdown');
                                onOpenOptions?.();
                                setShowTypeSelector(false);
                                shouldFocusFirstDropdownRowRef.current = true;
                              } else {
                                onSelectType?.(t);
                                setIsTypeMenuOpen(false);
                                requestAnimationFrame(() => toggleButtonRef.current?.focus());
                              }
                            }
                          }}
                          className={`rounded-md border px-2.5 py-1 text-[10px] font-bold transition-all text-left outline-none focus:ring-1 focus:ring-emerald-500/50 focus:bg-white/[0.08] ${isActive ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' : 'border-transparent bg-transparent text-neutral-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-white'}`}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {!showTypeSelector && isDropdownType && (
                <div className="overflow-hidden border border-white/5 rounded-lg bg-black/40">
                  <div className="grid grid-cols-[32px_1fr_1.2fr] border-b border-white/10 text-[8px] font-black tracking-widest uppercase text-white/30 bg-white/[0.02]">
                    <div className="px-2 py-1.5 border-r border-white/10 flex items-center justify-center">#</div>
                    <div className="px-2 py-1.5 border-r border-white/10 text-left">Name</div>
                    <div className="px-2 py-1.5 text-left">Value</div>
                  </div>
                  <div className="max-h-52 overflow-y-auto custom-scrollbar">
                    {dropdownRows.map((row, idx) => (
                      <div
                        key={row.id}
                        className="grid grid-cols-[32px_1fr_1.2fr] border-b border-white/5 last:border-b-0 text-[10px] text-white/90 hover:bg-white/[0.02] transition-all">
                        <div className="px-2 py-1.5 border-r border-white/10 text-white/20 font-black flex items-center justify-center tabular-nums leading-none">
                          {idx + 1}
                        </div>
                        <div className="px-1 py-1 border-r border-white/10">
                          <input
                            ref={el => {
                              dropdownNameInputRefs.current[row.id] = el;
                            }}
                            value={row.name}
                            onChange={e => updateDropdownRow(row.id, 'name', e.target.value)}
                            onMouseDown={e => e.stopPropagation()}
                            onKeyDown={e => handleDropdownCellKeyDown(e, idx, 'name')}
                            placeholder="Option"
                            className="w-full bg-transparent border-none px-1.5 py-0.5 text-[10px] text-white focus:text-emerald-400 outline-none transition-colors"
                          />
                        </div>
                        <div className="px-1 py-1">
                          <input
                            ref={el => {
                              dropdownValueInputRefs.current[row.id] = el;
                            }}
                            value={row.value}
                            onChange={e => updateDropdownRow(row.id, 'value', e.target.value)}
                            onMouseDown={e => e.stopPropagation()}
                            onKeyDown={e => handleDropdownCellKeyDown(e, idx, 'value')}
                            placeholder="Value"
                            className="w-full bg-transparent border-none px-1.5 py-0.5 text-[10px] text-white focus:text-emerald-400 outline-none transition-colors"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-white/10 px-2 py-1.5 flex items-center justify-between bg-white/[0.02]">
                    <button
                      type="button"
                      tabIndex={0}
                      onMouseDown={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowTypeSelector(true);
                        requestAnimationFrame(() => typeButtonRefs.current.dropdown?.focus());
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setShowTypeSelector(true);
                          requestAnimationFrame(() => typeButtonRefs.current.dropdown?.focus());
                        }
                      }}
                      className="text-[9px] font-bold text-neutral-400 hover:text-white flex items-center gap-1 transition-all outline-none focus:text-white">
                      <FaChevronDown size={8} className="rotate-90 opacity-50" />
                      Back
                    </button>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onMouseDown={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          addDropdownRow();
                        }}
                        className="px-2 py-1 text-[9px] font-bold border border-indigo-500/30 bg-indigo-500/5 text-indigo-400 hover:bg-indigo-500/20 rounded transition-all">
                        + Add
                      </button>
                      <button
                        type="button"
                        onMouseDown={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSaveDropdownRows();
                          setIsTypeMenuOpen(false);
                        }}
                        className="px-2 py-1 text-[9px] font-bold bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 rounded transition-all">
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {showTypeSelector && isConstantType && (
                <div className="flex flex-col gap-2 border border-white/10 rounded-lg bg-black/40 p-2.5">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black text-white/30 px-1 tracking-widest uppercase">
                      Description (Required)
                    </span>
                    <input
                      value={customDescriptionDraft}
                      onChange={e => {
                        const next = e.target.value;
                        setCustomDescriptionDraft(next);
                        onSaveCustomDescription?.(next);
                      }}
                      onMouseDown={e => e.stopPropagation()}
                      onKeyDown={e => e.stopPropagation()}
                      readOnly={isTokenEditor}
                      placeholder={
                        isTokenEditor ? 'Description provided by cloud' : 'Explain what this constant is for'
                      }
                      className="w-full bg-black border border-white/15 rounded px-2 py-1.5 text-[10px] text-white outline-none focus:border-emerald-500/50 transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black text-white/30 px-1 tracking-widest uppercase">
                      Constant Configuration
                    </span>
                    <div className="overflow-hidden border border-white/10 rounded-lg bg-black/40 shadow-inner">
                      <div className="grid grid-cols-[1fr_1.2fr] border-b border-white/10 text-[8px] font-black tracking-widest uppercase text-white/30 bg-white/[0.02]">
                        <div className="px-2 py-1.5 border-r border-white/10 text-left">Name</div>
                        <div className="px-2 py-1.5 text-left">Value</div>
                      </div>
                      <div className="max-h-40 overflow-y-auto custom-scrollbar">
                        {dropdownRows.map((row, idx) => (
                          <div
                            key={row.id}
                            className="grid grid-cols-[1fr_1.2fr] border-b border-white/5 last:border-b-0 text-[10px] text-white/90 hover:bg-white/[0.02] transition-all">
                            <div className="px-1 py-1 border-r border-white/10">
                              <input
                                ref={el => {
                                  dropdownNameInputRefs.current[row.id] = el;
                                }}
                                value={row.name}
                                onChange={e => {
                                  updateDropdownRow(row.id, 'name', e.target.value);
                                }}
                                onBlur={() => handleSaveDropdownRows(false)}
                                onMouseDown={e => e.stopPropagation()}
                                onKeyDown={e => handleDropdownCellKeyDown(e, idx, 'name')}
                                placeholder="Name"
                                className="w-full bg-transparent border-none px-1.5 py-0.5 text-[10px] text-white focus:text-emerald-400 outline-none transition-colors"
                              />
                            </div>
                            <div className="px-1 py-1">
                              <input
                                ref={el => {
                                  dropdownValueInputRefs.current[row.id] = el;
                                }}
                                value={row.value}
                                onChange={e => {
                                  updateDropdownRow(row.id, 'value', e.target.value);
                                }}
                                onBlur={() => handleSaveDropdownRows(false)}
                                onMouseDown={e => e.stopPropagation()}
                                onKeyDown={e => handleDropdownCellKeyDown(e, idx, 'value')}
                                placeholder="Value"
                                className="w-full bg-transparent border-none px-1.5 py-0.5 text-[10px] text-white focus:text-emerald-400 outline-none transition-colors"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-white/10 px-2 py-1.5 flex items-center justify-between bg-white/[0.02]">
                        <span className="text-[8px] text-white/20 italic">Multiple constants supported</span>
                        <button
                          type="button"
                          onMouseDown={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            const newRowId = addDropdownRow();
                            // Autofocus the new row's name
                            requestAnimationFrame(() => {
                              dropdownNameInputRefs.current[newRowId]?.focus();
                            });
                          }}
                          className="px-2 py-1 text-[9px] font-bold border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/20 rounded transition-all flex items-center gap-1">
                          <FaPlus size={7} />
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
};

interface HighlightedInputProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onScroll' | 'onInput'> {
  wrapperStyle?: React.CSSProperties;
  paramConfigs?: Record<
    string,
    {
      type: string;
      values: string[];
      displayName?: string;
      optionPairs?: Array<{ key: string; value: string }>;
      description?: string;
    }
  >;
  onParamTypeChange?: (paramName: string, type: ParamInputType) => void;
  onSelectDropdownType?: (paramName: string) => void;
  onSaveCustomInput?: (paramName: string, value: string) => void;
  onSaveCustomDescription?: (paramName: string, description: string) => void;
  onRenameParam?: (paramName: string, newDisplayName: string) => void;
  onSaveDropdownOptions?: (paramName: string, options: string[]) => void;
  onSaveDropdownOptionPairs?: (paramName: string, pairs: Array<{ key: string; value: string }>) => void;
  historySuggestions?: Record<string, { value: string; title: string }[]>;
  isFetchingHistory?: Record<string, boolean>;
  onScroll?: React.UIEventHandler<HTMLTextAreaElement>;
  onLockFocus?: (isLocked: boolean) => void;
  onFocusBack?: () => void;
  isTokenEditor?: boolean;
}

export const HighlightedInput = React.forwardRef<HTMLTextAreaElement, HighlightedInputProps>(
  (
    {
      className = '',
      value,
      onChange,
      onScroll,
      onKeyDown,
      wrapperStyle,
      paramConfigs,
      onParamTypeChange,
      onSelectDropdownType,
      onSaveCustomInput,
      onSaveCustomDescription,
      onRenameParam,
      onSaveDropdownOptions,
      onSaveDropdownOptionPairs,
      historySuggestions = {},
      isFetchingHistory = {},
      onLockFocus,
      onFocusBack,
      isTokenEditor = false,
      ...props
    },
    ref,
  ) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const isTyping = useRef(false);
    const [portalTargets, setPortalTargets] = useState<Record<string, HTMLElement>>({});
    const [activeBadgeId, setActiveBadgeId] = useState<string | null>(null);
    const [activePart, setActivePart] = useState<'name' | 'type'>('name');
    const [isLocked, setIsLocked] = useState(false);
    const [lastActionTrigger, setLastActionTrigger] = useState<{
      id: string;
      part: 'name' | 'type';
      ts: number;
    } | null>(null);

    // ── Mapping: DOM Content -> Value String ──
    const syncDomToValue = useCallback(() => {
      if (!editorRef.current) return '';
      let newValue = '';
      editorRef.current.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          newValue += node.textContent || '';
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          const token = element.getAttribute('data-token');
          if (token) {
            newValue += token;
          } else {
            newValue += element.innerText || element.textContent || '';
          }
        }
      });
      return newValue;
    }, []);

    // ── Helper: Map Value String -> HTML with Placeholders ──
    const generateHTML = useCallback((val: string) => {
      const valStr = String(val || '');
      if (!valStr) return '<span></span>';
      const regex = /(\{input_name="[^"]+?"\}|\{[^}\s]+\})/g;
      const parts = valStr.split(regex);
      return parts
        .map((part, i) => {
          if (!part) return '';
          if (/^\{input_name="[^"]+?"\}$/.test(part) || /^\{[^}\s]+\}$/.test(part)) {
            const id = `portal-${i}-${part.replace(/[^a-zA-Z0-9]/g, '')}`;
            return `<span id="${id}" data-portal-id="${id}" data-token='${part.replace(/'/g, '&apos;')}' contenteditable="false" class="inline-block align-baseline mx-[1px]"></span>`;
          }
          return `<span>${part.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</span>`;
        })
        .join('');
    }, []);

    // ── Caret Management ──
    const getCaretOffset = useCallback(() => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || !editorRef.current) return 0;
      const range = selection.getRangeAt(0);

      let offset = 0;
      let found = false;

      const traverse = (node: Node) => {
        if (found) return;

        if (node === range.startContainer) {
          if (node.nodeType === Node.TEXT_NODE) {
            offset += range.startOffset;
          } else {
            // Container is an element, startOffset is child index
            const children = Array.from(node.childNodes);
            for (let i = 0; i < range.startOffset && i < children.length; i++) {
              const child = children[i];
              if (child.nodeType === Node.TEXT_NODE) {
                offset += child.textContent?.length || 0;
              } else if (child.nodeType === Node.ELEMENT_NODE) {
                const element = child as HTMLElement;
                const token = element.getAttribute('data-token');
                offset += token ? token.length : (element.innerText || element.textContent || '').length;
              }
            }
          }
          found = true;
          return;
        }

        if (node.nodeType === Node.TEXT_NODE) {
          offset += node.textContent?.length || 0;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          const token = element.getAttribute('data-token');

          if (token) {
            offset += token.length;
          } else {
            for (const child of Array.from(node.childNodes)) {
              traverse(child);
              if (found) return;
            }
          }
        }
      };

      traverse(editorRef.current);
      return offset;
    }, []);

    const setCaretOffset = useCallback((offset: number) => {
      if (!editorRef.current) return;
      editorRef.current.focus(); // Ensure the editor itself has focus
      const selection = window.getSelection();
      if (!selection) return;

      const range = document.createRange();
      let currentOffset = 0;
      let found = false;

      const traverse = (node: Node) => {
        if (found) return;

        if (node.nodeType === Node.TEXT_NODE) {
          const textLen = node.textContent?.length || 0;
          if (offset <= currentOffset + textLen) {
            range.setStart(node, Math.max(0, offset - currentOffset));
            range.collapse(true);
            found = true;
          }
          currentOffset += textLen;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          const token = element.getAttribute('data-token');

          if (token) {
            const tokenLen = token.length;
            if (offset < currentOffset + tokenLen) {
              range.setStartBefore(element);
              range.collapse(true);
              found = true;
            } else if (offset === currentOffset + tokenLen) {
              range.setStartAfter(element);
              range.collapse(true);
              found = true;
            }
            currentOffset += tokenLen;
          } else {
            for (const child of Array.from(node.childNodes)) {
              traverse(child);
              if (found) return;
            }
          }
        }
      };

      traverse(editorRef.current);
      if (!found) {
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
      }
      selection.removeAllRanges();
      selection.addRange(range);
    }, []);

    // ── Logic Fracture 3: Sync activeBadgeId with selection boundary ──
    useEffect(() => {
      const handleSelectionChange = () => {
        if (document.activeElement !== editorRef.current || isLocked) return;
        const caret = getCaretOffset();
        const val = syncDomToValue();

        // If caret is NOT exactly at a { or after a }, clear visual badge focus
        const isAdjacent = val[caret] === '{' || val[caret - 1] === '}';
        if (!isAdjacent && activeBadgeId) {
          setActiveBadgeId(null);
        }
      };
      document.addEventListener('selectionchange', handleSelectionChange);
      return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }, [activeBadgeId, isLocked, getCaretOffset, syncDomToValue]);

    React.useImperativeHandle(
      ref,
      () =>
        ({
          ...(editorRef.current as any),
          focus: () => editorRef.current?.focus(),
          addEventListener: (type: string, listener: any, options?: any) =>
            editorRef.current?.addEventListener(type, listener, options),
          removeEventListener: (type: string, listener: any, options?: any) =>
            editorRef.current?.removeEventListener(type, listener, options),
          dispatchEvent: (event: Event) => editorRef.current?.dispatchEvent(event),
          get value() {
            return syncDomToValue();
          },
          get selectionStart() {
            return getCaretOffset();
          },
          get selectionEnd() {
            return getCaretOffset();
          },
          setSelectionRange: (start: number, end: number) => setCaretOffset(start),
        }) as any,
    );

    const handleInput = () => {
      isTyping.current = true;
      const nextValue = syncDomToValue();
      const caret = getCaretOffset();
      if (nextValue !== value && onChange) {
        onChange({
          target: {
            value: nextValue,
            selectionStart: caret,
            selectionEnd: caret,
          },
        } as unknown as React.ChangeEvent<HTMLTextAreaElement>);
      }
      setTimeout(() => {
        isTyping.current = false;
      }, 100);
    };

    // ── Sync: value -> innerHTML ──
    React.useLayoutEffect(() => {
      if (!editorRef.current) return;

      const currentDomValue = syncDomToValue();
      const nextValue = String(value || '');

      // If the DOM already matches the value from the parent, skip to avoid flicker
      if (currentDomValue === nextValue) return;

      const nextHTML = generateHTML(nextValue);
      if (editorRef.current.innerHTML !== nextHTML) {
        editorRef.current.innerHTML = nextHTML;

        // IMMEDIATE SYNC: Collect new portal targets right after DOM update
        // This avoids the one-frame race condition where portals return null targets
        const targets: Record<string, HTMLElement> = {};
        editorRef.current.querySelectorAll('[data-portal-id]').forEach((el: any) => {
          const id = el.getAttribute('data-portal-id');
          if (id) targets[id] = el;
        });
        setPortalTargets(targets);

        // If this is an external/atmospheric update (like auto-replace { to badge),
        // move caret to the end
        if (document.activeElement === editorRef.current) {
          requestAnimationFrame(() => setCaretOffset(nextValue.length));
        }
      }
    }, [value, generateHTML, setCaretOffset, syncDomToValue]);

    // ── Optional: Backup Portal Sync (for pure prop updates without DOM mismatches) ──
    React.useLayoutEffect(() => {
      if (!editorRef.current) return;
      const targets: Record<string, HTMLElement> = {};
      editorRef.current.querySelectorAll('[data-portal-id]').forEach((el: any) => {
        const id = el.getAttribute('data-portal-id');
        if (id) targets[id] = el;
      });

      setPortalTargets(prev => {
        const keys1 = Object.keys(prev).sort().join(',');
        const keys2 = Object.keys(targets).sort().join(',');
        if (keys1 === keys2) return prev;
        return targets;
      });
    }, [value]);

    const commonStyles: React.CSSProperties = {
      fontFamily: 'inherit',
      fontSize: 'inherit',
      lineHeight: '1.5',
      margin: '0',
      letterSpacing: 'inherit',
      wordSpacing: 'inherit',
      textTransform: 'inherit',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
      minHeight: '1.5em',
      outline: 'none',
      cursor: 'text',
    };

    const renderPortals = () => {
      const valStr = String(value || '');
      const regex = /(\{input_name="[^"]+?"\}|\{[^}\s]+\})/g;
      const parts = valStr.split(regex);

      return parts.map((part, i) => {
        if (/^\{input_name="[^"]+?"\}$/.test(part) || /^\{[^}\s]+\}$/.test(part)) {
          const id = `portal-${i}-${part.replace(/[^a-zA-Z0-9]/g, '')}`;
          const target = portalTargets[id];
          if (!target) return null;

          const paramName = extractParamName(part);
          const cfg = paramConfigs?.[paramName];

          return ReactDOM.createPortal(
            <ParamBadge
              token={part}
              type={cfg?.type as ParamInputType}
              displayName={cfg?.displayName || formatParamBadgeName(paramName)}
              isTokenEditor={isTokenEditor}
              configValue={
                cfg
                  ? isTokenEditor && cfg.type === 'short_text'
                    ? 'Text'
                    : PARAM_TYPE_BADGE_LABEL[cfg.type as ParamInputType]
                  : isTokenEditor
                    ? 'Text'
                    : 'Short Text'
              }
              isKeyboardFocused={activeBadgeId === id}
              focusedPart={activePart}
              actionTrigger={lastActionTrigger?.id === id ? lastActionTrigger : null}
              onInteraction={part => {
                setActiveBadgeId(id);
                setActivePart(part);
              }}
              onFocusBack={() => {
                // Focus the editor and jump to the character position of this badge
                // This ensures that subsequent Arrow keys start from the badge's position
                const valStr = String(value || '');
                const regex = /(\{input_name="[^"]+?"\}|\{[^}\s]+\})/g;
                const parts = valStr.split(regex);
                let charIdx = 0;
                for (let j = 0; j < parts.length; j++) {
                  const part = parts[j];
                  const currentId = `portal-${j}-${part.replace(/[^a-zA-Z0-9]/g, '')}`;
                  if (currentId === id) break;
                  charIdx += part.length;
                }
                requestAnimationFrame(() => {
                  setCaretOffset(charIdx);
                  onFocusBack?.();
                });
              }}
              onLockFocus={setIsLocked}
              onSelectType={type => {
                onParamTypeChange?.(paramName, type);
                if (type === 'dropdown') {
                  onSelectDropdownType?.(paramName);
                }
              }}
              options={cfg?.values || []}
              optionPairs={cfg?.optionPairs || []}
              onSaveOptions={newOpts => onSaveDropdownOptions?.(paramName, newOpts)}
              onSaveOptionPairs={pairs => onSaveDropdownOptionPairs?.(paramName, pairs)}
              customInputValue={cfg?.type === 'short_text' || cfg?.type === 'constant' ? cfg.values?.[0] || '' : ''}
              customDescriptionValue={cfg?.type === 'constant' ? cfg.description || '' : ''}
              onSaveCustomInput={value => onSaveCustomInput?.(paramName, value)}
              onSaveCustomDescription={value => onSaveCustomDescription?.(paramName, value)}
              onRename={newName => onRenameParam?.(paramName, newName)}
              onOpenOptions={() => onSelectDropdownType?.(paramName)}
              historySuggestions={historySuggestions[paramName] || []}
              isFetchingHistory={isFetchingHistory[paramName] || false}
            />,
            target,
          );
        }
        return null;
      });
    };

    return (
      <div className={`relative p-[6px] ${className}`} style={{ isolation: 'isolate', ...(wrapperStyle || {}) }}>
        <div
          ref={editorRef}
          contentEditable={true}
          suppressContentEditableWarning={true}
          onInput={handleInput}
          onScroll={e => onScroll?.(e as any)}
          {...(props as any)}
          onKeyDown={e => {
            const caret = getCaretOffset();
            const val = syncDomToValue();

            // Safety Shield: Block Enter and Tab if a child badge is in edit mode
            if (isLocked) {
              if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                e.stopPropagation();
                return;
              }
            }

            if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
              // 1. If a badge is currently highlighted via keyboard, move between parts
              if (activeBadgeId) {
                e.preventDefault();
                if (e.key === 'ArrowRight') {
                  if (activePart === 'name') {
                    setActivePart('type');
                  } else {
                    // Jump OUT of the current badge to the right
                    const badgeToken = portalTargets[activeBadgeId]?.getAttribute('data-token') || '';
                    const tokenStart = val.indexOf(badgeToken);
                    if (tokenStart !== -1) {
                      setCaretOffset(tokenStart + badgeToken.length);
                    }
                    requestAnimationFrame(() => setActiveBadgeId(null));
                  }
                } else if (e.key === 'ArrowLeft') {
                  if (activePart === 'type') {
                    setActivePart('name');
                  } else {
                    // Jump OUT of the current badge to the left
                    const badgeToken = portalTargets[activeBadgeId]?.getAttribute('data-token') || '';
                    const tokenStart = val.indexOf(badgeToken);
                    if (tokenStart !== -1) {
                      setCaretOffset(tokenStart);
                    }
                    requestAnimationFrame(() => setActiveBadgeId(null));
                  }
                }
                return;
              }

              // 2. Identify if we are entering a badge
              if (e.key === 'ArrowRight' && caret < val.length) {
                if (val[caret] === '{') {
                  const end = val.indexOf('}', caret);
                  if (end !== -1) {
                    const tokenStr = val.slice(caret, end + 1);
                    // Find the portal ID for this token
                    const targetEl = editorRef.current?.querySelector(`[data-token='${tokenStr}']`);
                    const id = targetEl?.getAttribute('data-portal-id');
                    if (id) {
                      e.preventDefault();
                      setActiveBadgeId(id);
                      setActivePart('name');
                      return;
                    }
                  }
                }
              } else if (e.key === 'ArrowLeft' && caret > 0) {
                if (val[caret - 1] === '}') {
                  const start = val.lastIndexOf('{', caret - 1);
                  if (start !== -1) {
                    const tokenStr = val.slice(start, caret);
                    const targetEl = editorRef.current?.querySelector(`[data-token='${tokenStr}']`);
                    const id = targetEl?.getAttribute('data-portal-id');
                    if (id) {
                      e.preventDefault();
                      setActiveBadgeId(id);
                      setActivePart('type');
                      return;
                    }
                  }
                }
              }
            } else if (e.key === 'Enter') {
              if (activeBadgeId) {
                e.preventDefault();
                setLastActionTrigger({ id: activeBadgeId, part: activePart, ts: Date.now() });
                return;
              }
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
              if (activeBadgeId) {
                e.preventDefault();
                const el = portalTargets[activeBadgeId];
                if (el) {
                  el.remove();
                  handleInput();
                  setActiveBadgeId(null);
                }
                return;
              }
            } else if (e.key === 'Escape') {
              if (activeBadgeId) {
                e.preventDefault();
                setActiveBadgeId(null);
                return;
              }
              if (activeBadgeId && !e.shiftKey) setActiveBadgeId(null);
            }

            onKeyDown?.(e as any);
          }}
          onFocus={e => {
            props.onFocus?.(e as any);
          }}
          onBlur={e => {
            // Only clear active badge if focus is not moving into one of our portals
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setActiveBadgeId(null);
            }
            props.onBlur?.(e as any);
          }}
          className={`${className} focus:ring-0 focus:outline-none`}
          style={{
            ...commonStyles,
            padding: 'inherit',
            width: '100%',
            height: '100%',
            zIndex: 1,
            ...(props.style || {}),
          }}
        />
        {renderPortals()}
      </div>
    );
  },
);

HighlightedInput.displayName = 'HighlightedInput';

// ── Shared types ──
interface PromptConfig {
  key: string;
  type?: ParamInputType;
  values: string[];
  optionPairs?: Array<{ key: string; value: string }>;
  description?: string;
  fixedValue?: string;
}

export type ParamInputType = 'short_text' | 'long_text' | 'dropdown' | 'constant';

export interface ParamConfig {
  type: ParamInputType;
  values: string[];
  optionPairs?: Array<{ key: string; value: string }>;
  displayName?: string;
  description?: string;
  fixedValue?: string;
}

interface AutomationStepPickerProps {
  // Agent mode props
  initialPrompts?: PromptConfig[];
  initialKey?: string;
  initialValues?: string[];
  isAllAi?: boolean;
  allAiUrls?: Record<string, string>;
  availableParams?: { name: string; source: string; fixedValue?: string; dropdownOptions?: string }[];
  onSave: (prompts: PromptConfig[], newAllAiUrls?: Record<string, string>) => void;
  onClose: () => void;
  className?: string;
  isEmbedded?: boolean;
  isTokenEditor?: boolean;
  // Open-tab URL mode props
  initialUrl?: string;
  initialParamConfigs?: Record<string, ParamConfig>;
  onUrlSave?: (newUrl: string, paramConfigs: Record<string, ParamConfig>) => void;
  // Step Context
  stepId?: string;
  stepNumber?: number | string;
  stepName?: string;
  stepIcon?: React.ElementType;
  // Feature Callbacks
  onOpenHistorySuggestions?: (paramName: string) => void;
  urlSuggestions?: Array<{ title: string; url: string; source: 'history' | 'bookmark'; type?: 'history' | 'bookmark' }>;
  highlightedIndex?: number;
  // Module-specific props for Click/Paste
  moduleId?: string;
  initialConfig?: any;
  onConfigSave?: (updates: any) => void;
  historySuggestions?: Record<string, { value: string; title: string }[]>;
  isFetchingHistory?: Record<string, boolean>;
  style?: React.CSSProperties;
}

const DEFAULT_ALL_AI_URLS = {
  gemini: 'https://gemini.google.com/app',
  chatgpt: 'https://chatgpt.com',
  claude: 'https://claude.ai/new',
  perplexity: 'https://www.perplexity.ai',
};

const INPUT_TYPE_OPTIONS: { value: ParamInputType; label: string; desc: string; icon: React.ElementType }[] = [
  { value: 'short_text', label: 'Short Text', desc: 'Single-line text input', icon: FaMinus },
  { value: 'long_text', label: 'Long Text', desc: 'Multi-line expanded input', icon: FaAlignLeft },
  { value: 'dropdown', label: 'Dropdown', desc: 'Choice from list', icon: FaList },
  { value: 'constant', label: 'Constant', desc: 'Static value with description', icon: FaLock },
];

const AutomationStepPicker: React.FC<AutomationStepPickerProps> = ({
  initialPrompts,
  initialKey = '',
  initialValues = [''],
  isAllAi = false,
  allAiUrls = DEFAULT_ALL_AI_URLS,
  availableParams = [],
  onSave,
  onClose,
  className,
  isEmbedded = false,
  initialUrl,
  initialParamConfigs,
  onUrlSave,
  stepId,
  stepNumber,
  stepName,
  stepIcon: StepIcon,
  onOpenHistorySuggestions,
  urlSuggestions = [],
  highlightedIndex = -1,
  moduleId,
  initialConfig,
  onConfigSave,
  historySuggestions = {},
  isFetchingHistory = {},
  isTokenEditor = false,
  style,
}) => {
  // ════════════════════════════════════════════
  // Determine mode: URL mode when initialUrl is provided with onUrlSave,
  // but exclude Click/Paste modules which use a separate layout.
  // ════════════════════════════════════════════
  const isUrlMode =
    (initialUrl !== undefined || moduleId === 'open_tab') &&
    onUrlSave !== undefined &&
    moduleId !== 'click' &&
    moduleId !== 'paste' &&
    moduleId !== 'clipboard_paste';

  const baseClasses = isEmbedded
    ? `flex flex-col w-full ${moduleId === 'wait' ? 'h-auto min-h-min' : 'h-[420px]'} bg-transparent overflow-hidden ${className || ''}`
    : `${className || 'absolute top-full right-0 mt-2'} w-[600px] max-h-[70vh] flex flex-col bg-black border border-white/10 rounded-lg shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 origin-top-right overflow-y-auto custom-scrollbar`;

  // ── Agent Prompt State ──
  const [prompts, setPrompts] = useState<PromptConfig[]>(() => {
    if (initialPrompts && initialPrompts.length > 0) {
      return initialPrompts.map(p => ({
        ...p,
        type: p.type || ((p.values.length > 1 ? 'dropdown' : 'short_text') as ParamInputType),
      }));
    }
    if (initialKey) {
      const isSingleVariableLayout =
        moduleId === 'click' || moduleId === 'paste' || moduleId === 'clipboard_paste' || isTokenEditor;
      return [
        {
          key: initialKey,
          type: initialValues.length > 1 ? 'dropdown' : isSingleVariableLayout ? 'short_text' : 'long_text',
          values: initialValues,
        },
      ];
    }
    const isSingleVariableLayout =
      moduleId === 'click' || moduleId === 'paste' || moduleId === 'clipboard_paste' || isTokenEditor;
    return [{ key: 'query', type: isSingleVariableLayout ? 'short_text' : 'long_text', values: [''] }];
  });

  // Multi-URL Editing State (for ALL AI)
  const [localAllAiUrls, setLocalAllAiUrls] = useState<Record<string, string>>(allAiUrls || {});
  const lastQueryIndexRef = useRef(0);

  // ── URL Segmentation State (open_tab mode) ──
  const [localUrlValue, setLocalUrlValue] = useState(initialUrl || '');
  const [isLocked, setIsLocked] = useState(false);
  const [editingUrlParts, setEditingUrlParts] = useState<{
    protocol: string;
    domain: string;
    paths: string[];
    querySegments: string[];
    search: string;
    hasTrailingSlash?: boolean;
    hash?: string;
    hashQuerySegments?: string[];
  } | null>(() => {
    // Parse initially if it's a URL mode step
    if (isUrlMode) {
      const parts = parseUrlParts(initialUrl || '');
      return (
        parts || {
          protocol: 'http',
          domain: '',
          paths: [],
          querySegments: [],
          search: '',
          hasTrailingSlash: false,
          hash: '',
          hashQuerySegments: [],
        }
      );
    }
    return null;
  });
  const rootPathValue =
    editingUrlParts && editingUrlParts.paths.length === 0 ? (editingUrlParts.hasTrailingSlash ? '/' : '') : null;

  // Independent per-param configs: { query: { type: 'short_text', values: [''] }, search: { type: 'dropdown', values: ['opt1', 'opt2'] } }
  const [paramConfigsMap, setParamConfigsMap] = useState<Record<string, ParamConfig>>(() => {
    if (initialParamConfigs && Object.keys(initialParamConfigs).length > 0) return initialParamConfigs;
    if (initialKey) {
      const type: ParamInputType = initialValues.length > 1 ? 'dropdown' : 'short_text';
      return { [initialKey]: { type, values: initialValues.length > 0 ? initialValues : [''] } };
    }
    return {};
  });

  const [typePickerOpen, setTypePickerOpen] = useState<string | null>(null);
  const [typePickerRect, setTypePickerRect] = useState<DOMRect | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [localUrlSuggestions, setLocalUrlSuggestions] = useState<
    Array<{ title: string; url: string; type: 'history' | 'bookmark' }>
  >([]);
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(-1);
  const [suggestionsRect, setSuggestionsRect] = useState<DOMRect | null>(null);
  const lastSearchQueryRef = useRef('');

  const [focusedField, setFocusedField] = useState<'domain' | 'path' | 'query' | 'raw' | null>(null);
  const [focusedPathIndex, setFocusedPathIndex] = useState<number | null>(null);
  const [focusedQueryIndex, setFocusedQueryIndex] = useState<number | null>(null);

  const popupRef = useRef<HTMLDivElement>(null);
  const domainInputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const segmentInputRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({});
  const lastSavedUrlRef = useRef(initialUrl || '');

  const focusSegmentInputAtEnd = useCallback((key: string) => {
    const el = segmentInputRefs.current[key];
    if (!el) return false;
    el.focus();
    const endPos = (el.value || '').length;
    requestAnimationFrame(() => {
      try {
        el.setSelectionRange(endPos, endPos);
      } catch {
        // no-op
      }
    });
    return true;
  }, []);

  const focusSegmentInputAtStart = useCallback((key: string) => {
    const el = segmentInputRefs.current[key];
    if (!el) return false;
    el.focus();
    requestAnimationFrame(() => {
      try {
        el.setSelectionRange(0, 0);
      } catch {
        // no-op
      }
    });
    return true;
  }, []);

  const [localConfig, setLocalConfig] = useState(initialConfig || {});
  const [isHoveringDetails, setIsHoveringDetails] = useState(false);
  const [hoverCoords, setHoverCoords] = useState<{ top: number; left: number } | null>(null);

  // Auto-focus the main input field when the popup mounts
  useEffect(() => {
    // If focus is already in a specialized portal (like a dropdown editor), don't steal it
    if (document.activeElement?.closest('[data-modal-portal="true"]')) return;

    const timer = setTimeout(() => {
      if (isUrlMode) {
        const el = segmentInputRefs.current['raw'];
        if (el) {
          el.focus();
          // Ensure it's scrolled to start and cursor is at end
          const val = el.value || '';
          el.setSelectionRange(val.length, val.length);
        }
      } else if (moduleId === 'click' || moduleId === 'paste' || moduleId === 'clipboard_paste') {
        segmentInputRefs.current['query-input']?.focus();
      }
    }, 250); // Increased timeout to ensure DOM is ready and focus isn't stolen
    return () => clearTimeout(timer);
  }, [isUrlMode, moduleId]);

  // Close popup on Escape key press
  useEffect(() => {
    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      onClose();
      return true;
    });
    return unregister;
  }, [onClose]);

  useEffect(() => {
    if (initialConfig) setLocalConfig(initialConfig);
  }, [initialConfig]);

  const hasSelector = !!localConfig.selector;
  const isTargetResolved = hasSelector || isTokenEditor;
  const isSingleVariableLayout =
    moduleId === 'click' || moduleId === 'paste' || moduleId === 'clipboard_paste' || isTokenEditor;
  const previewTypes = ['open_link', 'link'];
  const isPreviewMode = moduleId ? previewTypes.includes(moduleId) : false;

  const handleConfigChange = (updates: any) => {
    const nextConfig = { ...localConfig, ...updates };
    setLocalConfig(nextConfig);
    onConfigSave?.({ ...updates, paramConfigs: paramConfigsMap });
  };

  // ── Token Navigation Helpers ──
  const tokenRegex = /\{input_name="([^"]+)"\}|\{([^}:\s]+):([^}\s]+)\}|\{([^}\s:=)]+)\}/g;

  const handleTokenKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const el = e.currentTarget;
      window.requestAnimationFrame(() => {
        const pos = el.selectionStart || 0;
        let m;
        tokenRegex.lastIndex = 0; // Reset regex state
        while ((m = tokenRegex.exec(el.value)) !== null) {
          if (pos > m.index && pos < tokenRegex.lastIndex) {
            el.setSelectionRange(m.index, tokenRegex.lastIndex);
            break;
          }
        }
      });
    }
  }, []);

  const handleTokenClick = useCallback((e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const pos = el.selectionStart || 0;
    let m;
    tokenRegex.lastIndex = 0;
    while ((m = tokenRegex.exec(el.value)) !== null) {
      if (pos >= m.index && pos <= tokenRegex.lastIndex) {
        el.setSelectionRange(m.index, tokenRegex.lastIndex);
        break;
      }
    }
  }, []);

  // ── Sync URL Parts ──
  const lastInitUrlRef = useRef(initialUrl);

  useEffect(() => {
    if (!isUrlMode) return;

    // If typing in any technical portal (like dropdown option table), do not sync/steal focus
    if (document.activeElement?.closest('[data-modal-portal="true"]')) return;

    // Only apply if the parent SENT a completely new initialUrl that we haven't seen yet
    if (initialUrl !== lastInitUrlRef.current) {
      lastInitUrlRef.current = initialUrl;

      if (initialUrl !== localUrlValue && !focusedField) {
        setLocalUrlValue(initialUrl || '');
        const parts = parseUrlParts(initialUrl || '');
        setEditingUrlParts(
          parts || {
            protocol: 'http',
            domain: '',
            paths: [],
            querySegments: [],
            search: '',
            hasTrailingSlash: false,
            hash: '',
            hashQuerySegments: [],
          },
        );
      }
    }
  }, [initialUrl, isUrlMode, parseUrlParts, localUrlValue, focusedField]);

  // Sync raw textarea height
  useEffect(() => {
    if (!isUrlMode) return;
    const el = segmentInputRefs.current['raw'];
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [localUrlValue, isUrlMode, editingUrlParts]);

  // ── Local URL Suggestion SEARCH ──
  useEffect(() => {
    if (!isUrlMode || focusedField !== 'raw') {
      setLocalUrlSuggestions([]);
      return;
    }

    const query = localUrlValue
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .trim();

    if (query === lastSearchQueryRef.current) return;
    lastSearchQueryRef.current = query;

    if (query.length < 2) {
      setLocalUrlSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      const chromeAny = (window as any).chrome;
      const results: Array<{ title: string; url: string; type: 'history' | 'bookmark' }> = [];

      const searchHistory = (): Promise<any[]> =>
        new Promise(resolve => {
          if (chromeAny?.history?.search) {
            chromeAny.history.search({ text: query, maxResults: 10 }, (res: any[]) => resolve(res || []));
          } else resolve([]);
        });

      const searchBookmarks = (): Promise<any[]> =>
        new Promise(resolve => {
          if (chromeAny?.bookmarks?.search) {
            chromeAny.bookmarks.search(query, (res: any[]) => resolve(res || []));
          } else resolve([]);
        });

      try {
        const [history, bookmarks] = await Promise.all([searchHistory(), searchBookmarks()]);
        bookmarks.forEach((b: any) => {
          if (b.url) results.push({ title: b.title || b.url, url: b.url, type: 'bookmark' });
        });
        history.forEach((h: any) => {
          if (h.url) results.push({ title: h.title || h.url, url: h.url, type: 'history' });
        });

        const unique = new Map<string, (typeof results)[0]>();
        results.forEach(r => {
          if (!unique.has(r.url)) unique.set(r.url, r);
        });
        setLocalUrlSuggestions(Array.from(unique.values()).slice(0, 6));
        setHighlightedSuggestionIndex(-1);
      } catch {
        setLocalUrlSuggestions([]);
      }
    }, 150); // Faster debounce than parent

    return () => clearTimeout(timer);
  }, [localUrlValue, isUrlMode, focusedField]);

  // Sync parts → full URL
  useEffect(() => {
    if (!editingUrlParts || !isUrlMode) return;
    if (focusedField === 'raw') return; // Let raw input flow freely without auto-formatting while typing
    const assembled = assembleUrl(editingUrlParts);
    if (localUrlValue !== assembled) {
      setLocalUrlValue(assembled);
    }
  }, [editingUrlParts, assembleUrl, isUrlMode, focusedField, localUrlValue]);

  // Auto-detect {param} patterns — supports {input_name="xxx"}, {type:name}, and legacy {xxx}
  const detectedParams = useMemo(() => {
    if (!isUrlMode) return [];
    const params: Array<{ name: string; type: ParamInputType | null }> = [];
    const regex = /\{input_name="([^"]+)"\}|\{([^}:\s]+):([^}\s]+)\}|\{([^}\s:=)]+)\}/g;
    let m;
    while ((m = regex.exec(localUrlValue)) !== null) {
      const name = m[1] || m[3] || m[4];
      const type = m[2] as ParamInputType | null;
      if (name) params.push({ name, type });
    }
    // De-dupe by name
    const unique: typeof params = [];
    const seen = new Set<string>();
    params.forEach(p => {
      if (!seen.has(p.name)) {
        seen.add(p.name);
        unique.push(p);
      }
    });
    return unique;
  }, [localUrlValue, isUrlMode]);

  // Initialize paramConfigsMap entries for newly detected params
  useEffect(() => {
    if (detectedParams.length > 0) {
      setParamConfigsMap(prev => {
        let changed = false;
        const updated = { ...prev };
        detectedParams.forEach(({ name, type }) => {
          if (!updated[name]) {
            updated[name] = { type: type || 'short_text', values: [''] };
            changed = true;
          } else if (type && updated[name].type !== type) {
            // Sync type if token has a valid prefix and config is different
            updated[name] = { ...updated[name], type };
            changed = true;
          }
        });
        return changed ? updated : prev;
      });
    }
  }, [detectedParams]);

  // Initialize paramConfigsMap with 'input1' by default if it's empty in Click/Paste mode
  useEffect(() => {
    if (isSingleVariableLayout && Object.keys(paramConfigsMap).length === 0) {
      setParamConfigsMap({
        input1: { type: 'short_text', values: [''] },
      });
    }
  }, [isSingleVariableLayout, paramConfigsMap]);

  useEffect(() => {
    const handleSmartFillVal = ((e: CustomEvent) => {
      const { paramName, value, isDropdown, optionPairs } = e.detail as {
        paramName: string;
        value: string | string[];
        isDropdown: boolean;
        optionPairs?: Array<{ key: string; value: string }>;
      };

      // Ensure the event belongs to a param known by this popup instance
      const isKnownParam =
        detectedParams.some(p => p.name === paramName) ||
        paramName === initialKey ||
        prompts.some(p => p.key === paramName);

      if (!isKnownParam) return;

      setParamConfigsMap(prev => {
        const cfg = prev[paramName] || { type: 'short_text' as ParamInputType, values: [''] };
        return {
          ...prev,
          [paramName]: {
            ...cfg,
            type: isDropdown ? 'dropdown' : 'short_text',
            values: isDropdown && Array.isArray(value) ? value : [typeof value === 'string' ? value : ''],
            optionPairs: isDropdown && Array.isArray(optionPairs) ? optionPairs : cfg.optionPairs,
          },
        };
      });
    }) as EventListener;

    window.addEventListener('AltsHistorySmartFillVal', handleSmartFillVal);
    return () => window.removeEventListener('AltsHistorySmartFillVal', handleSmartFillVal);
  }, [detectedParams, initialKey]);

  // Close type picker on outside click
  useEffect(() => {
    if (!typePickerOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-modal-portal="true"]')) return;
      if (popupRef.current && popupRef.current.contains(target)) {
        // Will be handled by the picker buttons themselves
      } else {
        setTypePickerOpen(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [typePickerOpen]);

  // Get the next available inputN name
  const getNextInputName = useCallback(
    (currentUrl: string) => {
      // 1. Check current URL for {inputN}
      const matches = currentUrl.match(/\{input(\d+)\}/g) || [];
      const usedIndicesFromUrl = matches.map(m => parseInt(m.match(/\d+/)?.[0] || '0'));

      // 2. Check current paramConfigs for inputN
      const usedIndicesFromConfig = Object.keys(paramConfigsMap)
        .filter(k => k.startsWith('input'))
        .map(k => parseInt(k.replace('input', '') || '0'));

      const nextN = Math.max(0, ...usedIndicesFromUrl, ...usedIndicesFromConfig, lastQueryIndexRef.current) + 1;
      lastQueryIndexRef.current = nextN;
      return `input${nextN}`;
    },
    [paramConfigsMap],
  );

  // Insert {type:name} at cursor position
  const insertParamAtCursor = useCallback(
    (
      refKey: string,
      setValue: (val: string) => void,
      currentValue: string,
      paramName?: string,
      cursorOverride?: number,
    ) => {
      const inputEl = segmentInputRefs.current[refKey];
      if (!inputEl) return;

      const latestValue = currentValue;
      const name = paramName || getNextInputName(localUrlValue + latestValue);
      const tag = `{${name}}`;

      // Initialize config if it doesn't exist
      setParamConfigsMap(prev => {
        if (prev[name]) return prev;
        return {
          ...prev,
          [name]: { type: 'short_text', values: [''] },
        };
      });

      const start = cursorOverride !== undefined ? cursorOverride : (inputEl.selectionStart ?? latestValue.length);
      const end = cursorOverride !== undefined ? cursorOverride : (inputEl.selectionEnd ?? start);
      const trailing = isUrlMode ? '' : latestValue[end] === ' ' ? '' : ' ';

      const newValue = latestValue.slice(0, start) + tag + trailing + latestValue.slice(end);
      setValue(newValue);

      setTimeout(() => {
        inputEl.focus();
        const nextPos = start + tag.length + trailing.length;
        inputEl.setSelectionRange(nextPos, nextPos);
      }, 0);
    },
    [localUrlValue, getNextInputName],
  );

  const setRootPathValue = useCallback((nextValue: string) => {
    const trimmed = nextValue.trim();
    const normalized = trimmed === '' ? '' : trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    const nextPaths = normalized.split('/').filter(Boolean);
    const hasTrailingSlash = normalized === '/' || (normalized !== '' && normalized.endsWith('/'));

    setEditingUrlParts(prev =>
      prev
        ? {
            ...prev,
            paths: nextPaths,
            hasTrailingSlash,
          }
        : prev,
    );
  }, []);

  // Handle onChange for URL segment inputs.
  // Handle onChange for URL segment inputs.
  // Handle onChange for URL segment inputs.
  const handleSegmentChange = useCallback(
    (inputKey: string, newValue: string, setter: (val: string) => void, cursorPos?: number) => {
      if (!editingUrlParts) {
        setter(newValue);
        return;
      }

      // 1. Check if a full URL was pasted into a segment
      if (/^https?:\/\//i.test(newValue) || /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(newValue)) {
        const parts = parseUrlParts(newValue);
        if (parts) {
          setEditingUrlParts(parts);
          setLocalUrlValue(assembleUrl(parts));
          return;
        }
      }

      // 2. If multiple query parameters are pasted into a query segment, split them
      if (inputKey.startsWith('query-') && newValue.includes('&')) {
        const idx = parseInt(inputKey.split('-')[1]);
        if (!isNaN(idx)) {
          const newSegments = newValue.split('&').filter(Boolean);
          const nextQuerySegments = [...editingUrlParts.querySegments];
          nextQuerySegments.splice(idx, 1, ...newSegments);
          setEditingUrlParts({ ...editingUrlParts, querySegments: nextQuerySegments });
          return;
        }
      }

      // 3. If multiple path segments are pasted into a path segment, split them
      if (inputKey.startsWith('path-') && newValue.includes('/') && inputKey !== 'path-root') {
        const idx = parseInt(inputKey.split('-')[1]);
        if (!isNaN(idx)) {
          const newPaths = newValue.split('/').filter(Boolean);
          const nextPaths = [...editingUrlParts.paths];
          nextPaths.splice(idx, 1, ...newPaths);
          setEditingUrlParts({ ...editingUrlParts, paths: nextPaths });
          return;
        }
      }

      // 4. If it's a domain segment, strip protocol and trailing slashes
      if (inputKey === 'domain') {
        const stripped = newValue.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
        if (stripped !== newValue && stripped.length > 0) {
          setter(stripped);
          return;
        }
      }

      // 5. Check for { trigger to create dynamic parameter
      const targetPos = cursorPos ?? segmentInputRefs.current[inputKey]?.selectionStart ?? newValue.length;
      if (targetPos > 0 && newValue[targetPos - 1] === '{') {
        // Strip the '{' that triggered the change before inserting the badge
        const strippedValue = newValue.slice(0, targetPos - 1) + newValue.slice(targetPos);
        const insertPos = targetPos - 1;
        insertParamAtCursor(inputKey, setter, strippedValue, undefined, insertPos);
        return;
      }

      setter(newValue);
    },
    [editingUrlParts, insertParamAtCursor, parseUrlParts, assembleUrl],
  );

  // ── Save / Close ──
  const getConstantValidationError = useCallback(() => {
    setValidationError(null);
    return true;
  }, [prompts, paramConfigsMap]);

  const handleApplySave = useCallback(() => {
    if (isUrlMode && onUrlSave) {
      // Save entire paramConfigs as JSON
      onUrlSave(localUrlValue, paramConfigsMap);
    } else if (
      (isTokenEditor || moduleId === 'click' || moduleId === 'paste' || moduleId === 'clipboard_paste') &&
      onConfigSave
    ) {
      onConfigSave({ ...localConfig, paramConfigs: paramConfigsMap });
    } else {
      onSave(
        prompts.map(p => ({
          ...p,
          values: p.values.filter(v => v.trim() !== ''),
        })),
        isAllAi ? localAllAiUrls : undefined,
      );
    }
    return true;
  }, [
    isUrlMode,
    onUrlSave,
    paramConfigsMap,
    localUrlValue,
    isAllAi,
    localAllAiUrls,
    onSave,
    prompts,
    moduleId,
    onConfigSave,
    localConfig,
  ]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // If clicking a portal/modal, ignore
      if (target.closest('[data-modal-portal="true"]')) return;

      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose, handleApplySave]);

  // Auto-save logic removed as per user request for explicit save/cancel model.
  // Changes are now only committed via handleApplySave() called from the Save button.

  const handleSaveAndClose = () => {
    if (handleApplySave()) {
      onClose();
    }
  };

  const handleCancelAndClose = () => {
    onClose();
  };

  // ── Agent prompt helpers ──
  const updatePromptKey = (index: number, key: string) => {
    const newPrompts = [...prompts];
    newPrompts[index].key = key;
    setPrompts(newPrompts);
  };

  const updatePromptValue = (promptIndex: number, valueIndex: number, val: string) => {
    const newPrompts = [...prompts];
    newPrompts[promptIndex].values[valueIndex] = val;
    setPrompts(newPrompts);
  };

  const addValueToPrompt = (promptIndex: number) => {
    const newPrompts = [...prompts];
    newPrompts[promptIndex].values.push('');
    setPrompts(newPrompts);
  };

  const removeValueFromPrompt = (promptIndex: number, valueIndex: number) => {
    const newPrompts = [...prompts];
    if (newPrompts[promptIndex].values.length === 1) {
      newPrompts[promptIndex].values = [''];
    } else {
      newPrompts[promptIndex].values = newPrompts[promptIndex].values.filter((_, i) => i !== valueIndex);
    }
    setPrompts(newPrompts);
  };

  const updatePromptOptionPairs = (promptIndex: number, optionPairs: Array<{ key: string; value: string }>) => {
    const newPrompts = [...prompts];
    const curr = newPrompts[promptIndex];
    curr.optionPairs = optionPairs;
    curr.values = optionPairs
      .map((p: { key: string; value: string }) => String(p?.value || '').trim())
      .filter((p: string) => !!p);
    if (curr.values.length === 0) curr.values = [''];
    setPrompts(newPrompts);
  };

  const updatePromptConstantOptionPairs = (promptIndex: number, optionPairs: Array<{ key: string; value: string }>) => {
    const newPrompts = [...prompts];
    const curr = newPrompts[promptIndex];
    curr.optionPairs = optionPairs;
    curr.values = optionPairs.map((p: { key: string; value: string }) => String(p?.value || '').trim());
    if (curr.values.length === 0) curr.values = [''];
    curr.fixedValue = curr.values[0];
    setPrompts(newPrompts);
  };

  const setPromptType = (index: number, type: ParamInputType) => {
    const newPrompts = [...prompts];
    const curr = newPrompts[index];
    if (type === 'dropdown' && curr.values.length < 2) {
      curr.values = [...curr.values, ''];
    } else if (type !== 'dropdown' && curr.values.length > 1) {
      curr.values = [curr.values[0] || ''];
    }
    if (type !== 'constant') {
      curr.description = undefined;
      curr.fixedValue = undefined;
    } else {
      if (curr.description === undefined) curr.description = '';
      curr.fixedValue = curr.values?.[0] || '';
    }
    curr.type = type;
    setPrompts(newPrompts);
    setTypePickerOpen(null);

    if (type === 'dropdown') {
      onOpenHistorySuggestions?.(curr.key);
    }
  };

  const addPrompt = () => {
    setPrompts([...prompts, { key: `prompt${prompts.length + 1}`, type: 'long_text', values: [''] }]);
  };

  const removePrompt = (index: number) => {
    if (prompts.length > 1) {
      setPrompts(prompts.filter((_, i) => i !== index));
    }
  };

  const removeAgentFromAllAi = (agentKey: string) => {
    setLocalAllAiUrls(prev => {
      const next = { ...prev };
      delete next[agentKey];
      return next;
    });
  };

  // ── Per-param config helpers ──
  const syncParamChanges = useCallback((paramName: string, updates: { newName?: string; newType?: string }) => {
    const { newName, newType } = updates;
    // Regex matches {type:paramName} or {paramName}
    const regex = new RegExp(`\\{([a-z_]+:)?${paramName}\\}`, 'g');

    // 1. If the parameter name actually changed, migrate the configuration metadata in the map
    if (newName && newName !== paramName) {
      setParamConfigsMap(prev => {
        if (!prev[paramName]) return prev;
        const next = { ...prev };
        const configToMigrate = { ...next[paramName] };
        delete next[paramName];
        // Ensure we don't accidentally wipe out an existing config if the user renames to an already configured name
        next[newName] = next[newName] || configToMigrate;
        return next;
      });
    }

    const updateText = (text: string) => {
      if (!text) return text;
      return text.replace(regex, (match, prefix) => {
        const finalName = newName || paramName;
        const finalType = newType || (prefix ? prefix.slice(0, -1) : null);
        if (finalType) return `{${finalType}:${finalName}}`;
        return `{${finalName}}`;
      });
    };

    setEditingUrlParts(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        domain: updateText(prev.domain),
        paths: prev.paths.map(updateText),
        querySegments: prev.querySegments.map(updateText),
        hash: updateText(prev.hash || ''),
        hashQuerySegments: prev.hashQuerySegments?.map(updateText) || [],
      };
    });
    setLocalUrlValue(prev => updateText(prev));
  }, []);

  const normalizeAllTokens = useCallback((text: string) => {
    if (!text) return text;
    // Regex matches {type:name} where group 1 is type and group 2 is name
    const regex = /\{([^}:\s]+):([^}\s]+)\}/g;
    return text.replace(regex, '{$2}');
  }, []);

  const setParamType = (paramName: string, type: ParamInputType) => {
    setParamConfigsMap(prev => {
      const existing = prev[paramName] || { type: 'short_text', values: [''] };
      if (type === 'dropdown' && existing.values.length < 2) {
        return {
          ...prev,
          [paramName]: {
            ...existing,
            type,
            values: [...existing.values, ''],
            description: undefined,
          },
        };
      }
      if (type !== 'dropdown' && existing.values.length > 1) {
        return {
          ...prev,
          [paramName]: {
            type,
            values: [existing.values[0] || ''],
            ...(type === 'constant'
              ? { description: existing.description || '', fixedValue: existing.values[0] || '' }
              : { description: undefined, fixedValue: undefined }),
          },
        };
      }
      return {
        ...prev,
        [paramName]: {
          ...existing,
          type,
          ...(type === 'constant'
            ? { description: existing.description || '', fixedValue: existing.values[0] || '' }
            : { description: undefined, fixedValue: undefined }),
          ...(type === 'dropdown' ? {} : { optionPairs: undefined }),
        },
      };
    });
    syncParamChanges(paramName, { newType: type });
    setTypePickerOpen(null);
  };

  const setParamConstantDescription = (paramName: string, description: string) => {
    setParamConfigsMap(prev => {
      const existing = prev[paramName] || { type: 'constant', values: [''] };
      return {
        ...prev,
        [paramName]: {
          ...existing,
          type: existing.type === 'constant' ? 'constant' : existing.type,
          description,
        },
      };
    });
  };

  const setPromptDescription = (promptIndex: number, description: string) => {
    const newPrompts = [...prompts];
    newPrompts[promptIndex].description = description;
    setPrompts(newPrompts);
  };

  const handleRenameParam = (paramName: string, newName: string) => {
    if (!newName || newName === paramName) return;

    // Migrate the config map entry first to ensure all components see the new name
    setParamConfigsMap(prev => {
      if (!prev[paramName]) return prev;
      const next = { ...prev };
      const config = { ...next[paramName], displayName: undefined }; // Clearing displayName as it's now the actual name
      delete next[paramName];
      next[newName] = next[newName] || config;
      return next;
    });

    // Synchronize the name change across all text segments and the URL string
    syncParamChanges(paramName, { newName });
  };

  const handleSaveDropdownOptionPairs = (paramName: string, optionPairs: Array<{ key: string; value: string }>) => {
    setParamConfigsMap(prev => {
      const existing = prev[paramName] || { type: 'dropdown', values: [] };
      const values = Array.from(new Set(optionPairs.map(pair => String(pair?.value || '').trim()).filter(Boolean)));
      return {
        ...prev,
        [paramName]: {
          ...existing,
          type: 'dropdown',
          values,
          optionPairs,
        },
      };
    });
  };

  const handleSaveConstantOptionPairs = (paramName: string, optionPairs: Array<{ key: string; value: string }>) => {
    setParamConfigsMap(prev => {
      const existing = prev[paramName] || { type: 'constant', values: [] };
      const values = optionPairs.map(pair => String(pair?.value || '').trim());
      return {
        ...prev,
        [paramName]: {
          ...existing,
          type: 'constant',
          values,
          optionPairs,
          fixedValue: values[0] || '',
        },
      };
    });
  };

  // ════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════

  // ── URL MODE: Open Tab URL Segmentation ──
  if (isUrlMode) {
    if (isPreviewMode) {
      return (
        <div ref={popupRef} className={baseClasses} onClick={e => e.stopPropagation()}>
          <div className="flex-none flex items-center gap-2 p-3 pb-2 border-b border-[var(--color-borderDefault)]">
            <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 truncate">
              {stepNumber !== undefined && stepName ? `Step {stepNumber}: {stepName}` : 'Preview URL'}
            </span>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
              <FaTimes size={12} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
            <div className="rounded-xl bg-neutral-900/60 border border-neutral-700 p-4">
              <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">
                URL (read-only preview)
              </div>
              <div className="text-sm text-neutral-100 break-all bg-black/20 p-3 rounded-lg font-mono">
                {localUrlValue || 'No URL set'}
              </div>
            </div>
            <div className="text-[10px] text-neutral-500 mt-2">This is a preview-only view. Editing is disabled.</div>
          </div>
          <div className="flex justify-end p-3 border-t border-[var(--color-borderDefault)]">
            <button
              type="button"
              onClick={onClose}
              className="text-emerald-500 hover:text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
              Close
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={popupRef}
        className={`${baseClasses} !bg-black text-white ${isEmbedded ? 'rounded-[16px]' : ''}`}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            e.stopPropagation();
            if (handleApplySave()) onClose();
          } else if (e.key === 'Escape') {
            const target = e.target as HTMLElement;
            if (target.closest('[data-modal-portal="true"]')) return;

            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        }}
        tabIndex={-1}>
        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3">
          <div className="space-y-4">
            {localUrlSuggestions.length > 0 &&
              localUrlValue.length >= 3 &&
              focusedField === 'raw' &&
              suggestionsRect &&
              ReactDOM.createPortal(
                <div
                  className="fixed z-[999999999] overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl animate-in fade-in slide-in-from-top-1 duration-200"
                  style={{
                    left: suggestionsRect.left,
                    ...(suggestionsRect.bottom + 300 > window.innerHeight
                      ? {
                          bottom: window.innerHeight - suggestionsRect.top + 6,
                          maxHeight: Math.min(300, suggestionsRect.top - 12),
                        }
                      : {
                          top: suggestionsRect.bottom + 6,
                          maxHeight: Math.min(300, window.innerHeight - suggestionsRect.bottom - 12),
                        }),
                    width: suggestionsRect.width,
                  }}>
                  <div className="overflow-y-auto custom-scrollbar p-1.5 h-full">
                    {localUrlSuggestions.map((s, idx) => {
                      let hostname = '';
                      try {
                        hostname = new URL(s.url).hostname;
                      } catch {
                        hostname = s.url;
                      }
                      return (
                        <button
                          key={idx}
                          type="button"
                          onMouseDown={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            const normalizedUrl = stripProtocol(s.url);
                            setLocalUrlValue(normalizedUrl);
                            const parts = parseUrlParts(normalizedUrl);
                            if (parts) setEditingUrlParts(parts);
                            setLocalUrlSuggestions([]);
                            setFocusedField(null);
                          }}
                          onMouseEnter={() => setHighlightedSuggestionIndex(idx)}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                            highlightedSuggestionIndex === idx ? 'bg-white/5' : 'hover:bg-white/[0.02]'
                          }`}>
                          <img
                            src={`https://www.google.com/s2/favicons?domain={hostname}&sz=16`}
                            alt=""
                            className="h-4 w-4 rounded-sm flex-none"
                            onError={e => (e.currentTarget.style.display = 'none')}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[11px] font-semibold text-[#ebebec]">
                              {s.title || hostname}
                            </div>
                            <div className="truncate font-mono text-[10px] text-[#7d7f87]">{stripProtocol(s.url)}</div>
                          </div>
                          <span className="flex-none text-[#7d7f87]">
                            {s.type === 'bookmark' ? <FaBookmark size={8} /> : <FaHistory size={8} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>,
                document.body,
              )}

            {editingUrlParts && (
              <div className=" border-white/10 pt-1 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-neutral-500  tracking-widest pl-1">
                    Edit the link path here
                  </label>

                  <div className="overflow-hidden rounded-[10px] border border-white/10 bg-black">
                    <div className="grid grid-cols-[120px_minmax(0,1fr)] border-b border-white/10 bg-black text-[10px] font-semibold text-[#8d8e95]">
                      <div className="border-r border-white/10 px-3 py-2">Step Name</div>
                      <div className="px-3 py-2">Configuration</div>
                    </div>
                    <div>
                      <div className="group grid grid-cols-[120px_minmax(0,1fr)] border-b border-white/10 text-[12px] transition-all focus-within:border-white/20 focus-within:bg-white/[0.03] bg-black">
                        <div className="border-r border-white/10 px-2 py-1.5 font-semibold text-neutral-400">
                          Domain
                        </div>
                        <div className="relative min-w-0">
                          <input
                            ref={el => {
                              segmentInputRefs.current['domain'] = el;
                              domainInputRef.current = el;
                            }}
                            value={editingUrlParts?.domain || ''}
                            onChange={e => {
                              const newVal = e.target.value;
                              handleSegmentChange(
                                'domain',
                                newVal,
                                val => setEditingUrlParts(prev => (prev ? { ...prev, domain: val } : prev)),
                                e.target.selectionStart || undefined,
                              );
                            }}
                            onClick={handleTokenClick}
                            onKeyDown={e => {
                              handleTokenKeyDown(e);
                              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                e.stopPropagation();
                                if (handleApplySave()) onClose();
                              }
                              if (e.key === 'Enter') e.preventDefault();
                              if (isLocked) {
                                e.stopPropagation();
                                return;
                              }
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                window.requestAnimationFrame(() => {
                                  if (focusSegmentInputAtEnd('path-root')) return;
                                  if (focusSegmentInputAtEnd('path-0')) return;
                                  focusSegmentInputAtEnd('query-0');
                                });
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                window.requestAnimationFrame(() => {
                                  focusSegmentInputAtEnd('raw');
                                });
                              }
                              e.stopPropagation();
                            }}
                            onBlur={() => setFocusedField(null)}
                            onFocus={() => {
                              setFocusedField('domain');
                              setFocusedPathIndex(null);
                              setFocusedQueryIndex(null);
                            }}
                            className="w-full bg-transparent text-[12px] font-mono leading-5 text-[#ececed] outline-none px-2.5 py-1.5"
                            placeholder="domain.com"
                          />
                          {Object.keys(paramConfigsMap).length === 0 && (
                            <button
                              type="button"
                              onMouseDown={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                insertParamAtCursor(
                                  'domain',
                                  val => setEditingUrlParts(prev => (prev ? { ...prev, domain: val } : prev)),
                                  editingUrlParts.domain,
                                );
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#707279] opacity-0 transition-opacity hover:bg-white/5 hover:text-[#d2d2d5] group-hover:opacity-100"
                              title="Insert variable">
                              <FaPlus size={8} />
                            </button>
                          )}
                        </div>
                      </div>

                      {rootPathValue !== null && (
                        <div className="group grid grid-cols-[120px_minmax(0,1fr)] border-b border-white/10 text-[12px] transition-all focus-within:border-white/20 focus-within:bg-white/[0.03] bg-black">
                          <div className="border-r border-white/10 px-3 py-2 font-semibold text-neutral-400">Path</div>
                          <div className="relative min-w-0">
                            <input
                              ref={el => {
                                segmentInputRefs.current['path-root'] = el;
                              }}
                              value={rootPathValue}
                              onChange={e => {
                                const newVal = e.target.value;
                                handleSegmentChange(
                                  'path-root',
                                  newVal,
                                  setRootPathValue,
                                  e.target.selectionStart || undefined,
                                );
                              }}
                              onClick={handleTokenClick}
                              onKeyDown={e => {
                                handleTokenKeyDown(e);
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (handleApplySave()) onClose();
                                }
                                if (e.key === 'Enter') e.preventDefault();
                                if (isLocked) {
                                  e.stopPropagation();
                                  return;
                                }
                                if (e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  window.requestAnimationFrame(() => {
                                    if (focusSegmentInputAtEnd('path-0')) return;
                                    focusSegmentInputAtEnd('query-0');
                                  });
                                } else if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  window.requestAnimationFrame(() => {
                                    focusSegmentInputAtEnd('domain');
                                  });
                                }
                                e.stopPropagation();
                              }}
                              onBlur={() => setFocusedField(null)}
                              onFocus={() => {
                                setFocusedField('path');
                                setFocusedPathIndex(null);
                                setFocusedQueryIndex(null);
                              }}
                              className="w-full bg-transparent text-[12px] font-mono leading-5 text-[#ececed] outline-none px-2.5 py-1.5"
                            />
                            {Object.keys(paramConfigsMap).length === 0 && (
                              <button
                                type="button"
                                onMouseDown={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  insertParamAtCursor('path-root', setRootPathValue, rootPathValue);
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/30 opacity-0 transition-opacity hover:bg-white/5 hover:text-white/80 group-hover:opacity-100"
                                title="Insert variable (Right Arrow)">
                                <FaPlus size={8} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {editingUrlParts?.paths.map((path, idx) => {
                        const pathKey = `path-${idx}`;
                        const shouldShowBorder =
                          idx !== editingUrlParts.paths.length - 1 || editingUrlParts.querySegments.length > 0;

                        return (
                          <div
                            key={pathKey}
                            className={`group grid grid-cols-[120px_minmax(0,1fr)] text-[12px] transition-all focus-within:border-white/20 focus-within:bg-white/[0.03] bg-black ${
                              shouldShowBorder ? 'border-b border-white/10' : ''
                            }`}>
                            <div className="border-r border-white/10 px-2 py-1.5 font-semibold text-neutral-400">
                              {idx === 0 ? 'Path' : `Path {idx + 1}`}
                            </div>
                            <div className="relative min-w-0">
                              <input
                                ref={el => {
                                  segmentInputRefs.current[pathKey] = el;
                                }}
                                value={path}
                                onChange={e => {
                                  const newVal = e.target.value;
                                  handleSegmentChange(
                                    pathKey,
                                    newVal,
                                    val => {
                                      const newPaths = [...editingUrlParts.paths];
                                      newPaths[idx] = val;
                                      setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
                                    },
                                    e.target.selectionStart || undefined,
                                  );
                                }}
                                onClick={handleTokenClick}
                                onKeyDown={e => {
                                  handleTokenKeyDown(e);
                                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (handleApplySave()) onClose();
                                  }
                                  if (e.key === 'Enter') e.preventDefault();
                                  if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    const nextPathKey = `path-{idx + 1}`;
                                    if (focusSegmentInputAtEnd(nextPathKey)) return;
                                    focusSegmentInputAtEnd('query-0');
                                  } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    const prevPathKey = `path-{idx - 1}`;
                                    if (focusSegmentInputAtEnd(prevPathKey)) return;
                                    if (focusSegmentInputAtEnd('path-root')) return;
                                    focusSegmentInputAtEnd('domain');
                                  }
                                  e.stopPropagation();
                                }}
                                onBlur={() => setFocusedField(null)}
                                onFocus={() => {
                                  setFocusedField('path');
                                  setFocusedPathIndex(idx);
                                  setFocusedQueryIndex(null);
                                }}
                                className="w-full bg-transparent text-[12px] font-mono leading-5 text-[#ececed] outline-none px-2.5 py-1.5"
                              />
                              {Object.keys(paramConfigsMap).length === 0 && (
                                <button
                                  type="button"
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    insertParamAtCursor(
                                      pathKey,
                                      val => {
                                        const newPaths = [...editingUrlParts.paths];
                                        newPaths[idx] = val;
                                        setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
                                      },
                                      path,
                                    );
                                  }}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/30 opacity-0 transition-opacity hover:bg-white/5 hover:text-white/80 group-hover:opacity-100"
                                  title="Insert variable (Right Arrow)">
                                  <FaPlus size={8} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {editingUrlParts?.querySegments.map((querySegment, idx) => {
                        const queryKey = `query-{idx}`;
                        const shouldShowBorder =
                          idx !== editingUrlParts.querySegments.length - 1 ||
                          (editingUrlParts.hash && editingUrlParts.hash.length > 0) ||
                          (editingUrlParts.hashQuerySegments && editingUrlParts.hashQuerySegments.length > 0);

                        return (
                          <div
                            key={queryKey}
                            className={`group grid grid-cols-[120px_minmax(0,1fr)] text-[12px] transition-all focus-within:border-white/20 focus-within:bg-white/[0.03] bg-black ${
                              shouldShowBorder ? 'border-b border-white/10' : ''
                            }`}>
                            <div className="border-r border-white/10 px-2 py-1.5 font-semibold text-neutral-400">
                              {idx === 0 ? 'Query' : `Query {idx + 1}`}
                            </div>
                            <div className="relative min-w-0">
                              <input
                                ref={el => {
                                  segmentInputRefs.current[queryKey] = el;
                                }}
                                value={querySegment}
                                onChange={e => {
                                  const newVal = e.target.value;
                                  handleSegmentChange(
                                    queryKey,
                                    newVal,
                                    val => {
                                      const nextQuerySegments = [...editingUrlParts.querySegments];
                                      nextQuerySegments[idx] = val;
                                      setEditingUrlParts(prev =>
                                        prev ? { ...prev, querySegments: nextQuerySegments } : prev,
                                      );
                                    },
                                    e.target.selectionStart || undefined,
                                  );
                                }}
                                onClick={handleTokenClick}
                                onKeyDown={e => {
                                  handleTokenKeyDown(e);
                                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (handleApplySave()) onClose();
                                  }
                                  if (e.key === 'Enter') e.preventDefault();
                                  if (e.key === 'ArrowDown') {
                                    const nextQueryKey = `query-{idx + 1}`;
                                    if (focusSegmentInputAtEnd(nextQueryKey)) {
                                      e.preventDefault();
                                      return;
                                    }
                                    if (focusSegmentInputAtEnd('hash')) {
                                      e.preventDefault();
                                      return;
                                    }
                                  } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    const prevQueryKey = `query-{idx - 1}`;
                                    if (focusSegmentInputAtEnd(prevQueryKey)) return;
                                    if (editingUrlParts.paths.length > 0) {
                                      if (focusSegmentInputAtEnd(`path-{editingUrlParts.paths.length - 1}`)) return;
                                    }
                                    if (focusSegmentInputAtEnd('path-root')) return;
                                    focusSegmentInputAtEnd('domain');
                                  }
                                  e.stopPropagation();
                                }}
                                onBlur={() => setFocusedField(null)}
                                onFocus={() => {
                                  setFocusedField('query');
                                  setFocusedPathIndex(null);
                                  setFocusedQueryIndex(idx);
                                }}
                                className="w-full bg-transparent text-[12px] font-mono leading-5 text-[#ececed] outline-none px-2.5 py-1.5"
                              />
                              {Object.keys(paramConfigsMap).length === 0 && (
                                <button
                                  type="button"
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    insertParamAtCursor(
                                      queryKey,
                                      val => {
                                        const nextQuerySegments = [...editingUrlParts.querySegments];
                                        nextQuerySegments[idx] = val;
                                        setEditingUrlParts(prev =>
                                          prev ? { ...prev, querySegments: nextQuerySegments } : prev,
                                        );
                                      },
                                      querySegment,
                                    );
                                  }}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/30 opacity-0 transition-opacity hover:bg-white/5 hover:text-white/80 group-hover:opacity-100"
                                  title="Insert variable (Right Arrow)">
                                  <FaPlus size={8} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* Hash segment (e.g., #inbox from Gmail URLs) */}
                      {editingUrlParts?.hash && (
                        <div
                          className={`group grid grid-cols-[120px_minmax(0,1fr)] text-[12px] transition-all focus-within:border-white/20 focus-within:bg-white/[0.03] bg-black ${
                            editingUrlParts.hashQuerySegments && editingUrlParts.hashQuerySegments.length > 0
                              ? 'border-b border-white/10'
                              : ''
                          }`}>
                          <div className="border-r border-white/10 px-2 py-1.5 font-semibold text-neutral-400">
                            Hash
                          </div>
                          <div className="relative min-w-0">
                            <input
                              ref={el => {
                                segmentInputRefs.current['hash'] = el;
                              }}
                              value={editingUrlParts.hash}
                              onChange={e => {
                                const newVal = e.target.value;
                                handleSegmentChange(
                                  'hash',
                                  newVal,
                                  val => setEditingUrlParts(prev => (prev ? { ...prev, hash: val } : prev)),
                                  e.target.selectionStart || undefined,
                                );
                              }}
                              onClick={handleTokenClick}
                              onKeyDown={e => {
                                handleTokenKeyDown(e);
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (handleApplySave()) onClose();
                                }
                                if (e.key === 'Enter') e.preventDefault();
                                if (e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  window.requestAnimationFrame(() => {
                                    focusSegmentInputAtEnd('hash-query-0');
                                  });
                                } else if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  window.requestAnimationFrame(() => {
                                    if (editingUrlParts.querySegments.length > 0) {
                                      focusSegmentInputAtEnd(`query-{editingUrlParts.querySegments.length - 1}`);
                                    } else if (editingUrlParts.paths.length > 0) {
                                      focusSegmentInputAtEnd(`path-{editingUrlParts.paths.length - 1}`);
                                    } else {
                                      focusSegmentInputAtEnd('domain');
                                    }
                                  });
                                }
                                e.stopPropagation();
                              }}
                              onBlur={() => setFocusedField(null)}
                              onFocus={() => {
                                setFocusedField('query');
                                setFocusedPathIndex(null);
                                setFocusedQueryIndex(null);
                              }}
                              className="w-full bg-transparent text-[12px] font-mono leading-5 text-[#ececed] outline-none px-2.5 py-1.5"
                            />
                            {Object.keys(paramConfigsMap).length === 0 && (
                              <button
                                type="button"
                                onMouseDown={e => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  insertParamAtCursor(
                                    'hash',
                                    val => setEditingUrlParts(prev => (prev ? { ...prev, hash: val } : prev)),
                                    editingUrlParts.hash || '',
                                  );
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/30 opacity-0 transition-opacity hover:bg-white/5 hover:text-white/80 group-hover:opacity-100"
                                title="Insert variable">
                                <FaPlus size={8} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Hash Query Segments (e.g., compose=new from #inbox?compose=new) */}
                      {editingUrlParts?.hashQuerySegments?.map((hashQuerySegment, idx) => {
                        const hashQueryKey = `hash-query-{idx}`;
                        const shouldShowBorder = idx !== (editingUrlParts.hashQuerySegments?.length || 0) - 1;

                        return (
                          <div
                            key={hashQueryKey}
                            className={`group grid grid-cols-[120px_minmax(0,1fr)] text-[12px] transition-all focus-within:border-white/20 focus-within:bg-white/[0.03] bg-black ${
                              shouldShowBorder ? 'border-b border-white/10' : ''
                            }`}>
                            <div className="border-r border-white/10 px-2 py-1.5 font-semibold text-neutral-400">
                              {idx === 0 ? 'Hash Query' : `Hash Query {idx + 1}`}
                            </div>
                            <div className="relative min-w-0">
                              <input
                                ref={el => {
                                  segmentInputRefs.current[hashQueryKey] = el;
                                }}
                                value={hashQuerySegment}
                                onChange={e => {
                                  const newVal = e.target.value;
                                  const nextHashQuerySegments = [...(editingUrlParts.hashQuerySegments || [])];
                                  nextHashQuerySegments[idx] = newVal;
                                  setEditingUrlParts(prev =>
                                    prev ? { ...prev, hashQuerySegments: nextHashQuerySegments } : prev,
                                  );
                                }}
                                onClick={handleTokenClick}
                                onKeyDown={e => {
                                  handleTokenKeyDown(e);
                                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (handleApplySave()) onClose();
                                  }
                                  if (e.key === 'Enter') e.preventDefault();
                                  if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    focusSegmentInputAtEnd(`hash-query-{idx + 1}`);
                                  } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    const prevHashQueryKey = `hash-query-{idx - 1}`;
                                    if (focusSegmentInputAtEnd(prevHashQueryKey)) return;
                                    focusSegmentInputAtEnd('hash');
                                  }
                                  e.stopPropagation();
                                }}
                                onBlur={() => setFocusedField(null)}
                                onFocus={() => {
                                  setFocusedField('query');
                                  setFocusedPathIndex(null);
                                  setFocusedQueryIndex(null);
                                }}
                                className="w-full bg-transparent text-[12px] font-mono leading-5 text-[#ececed] outline-none px-2.5 py-1.5"
                              />
                              {Object.keys(paramConfigsMap).length === 0 && (
                                <button
                                  type="button"
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    insertParamAtCursor(
                                      hashQueryKey,
                                      val => {
                                        const nextHashQuerySegments = [...(editingUrlParts.hashQuerySegments || [])];
                                        nextHashQuerySegments[idx] = val;
                                        setEditingUrlParts(prev =>
                                          prev ? { ...prev, hashQuerySegments: nextHashQuerySegments } : prev,
                                        );
                                      },
                                      hashQuerySegment,
                                    );
                                  }}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/30 opacity-0 transition-opacity hover:bg-white/5 hover:text-white/80 group-hover:opacity-100"
                                  title="Insert variable">
                                  <FaPlus size={8} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-[11px] text-white/50">
                    Optional: you can add an {'{variable}'} to make this link dynamic.
                  </div>
                </div>
              </div>
            )}

            {availableParams.length > 0 && (
              <div className="border-t border-white/10 pt-5">
                <div className="flex flex-wrap gap-2">
                  {availableParams.map((param, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        if (focusedField === 'raw') {
                          insertParamAtCursor('raw', setLocalUrlValue, localUrlValue, param.name);
                        } else if (focusedField === 'domain') {
                          insertParamAtCursor(
                            'domain',
                            val => setEditingUrlParts(prev => (prev ? { ...prev, domain: val } : prev)),
                            editingUrlParts?.domain || '',
                            param.name,
                          );
                        } else if (focusedField === 'path' && focusedPathIndex !== null) {
                          const pathKey = `path-${focusedPathIndex}`;
                          insertParamAtCursor(
                            pathKey,
                            val => {
                              const newPaths = [...(editingUrlParts?.paths || [])];
                              newPaths[focusedPathIndex] = val;
                              setEditingUrlParts(prev => (prev ? { ...prev, paths: newPaths } : prev));
                            },
                            editingUrlParts?.paths[focusedPathIndex] || '',
                            param.name,
                          );
                        } else if (focusedField === 'path' && focusedPathIndex === null && rootPathValue !== null) {
                          insertParamAtCursor('path-root', setRootPathValue, rootPathValue, param.name);
                        } else if (focusedField === 'query' && focusedQueryIndex !== null) {
                          const queryKey = `query-${focusedQueryIndex}`;
                          insertParamAtCursor(
                            queryKey,
                            val => {
                              const nextQuerySegments = [...(editingUrlParts?.querySegments || [])];
                              nextQuerySegments[focusedQueryIndex] = val;
                              setEditingUrlParts(prev => (prev ? { ...prev, querySegments: nextQuerySegments } : prev));
                            },
                            editingUrlParts?.querySegments[focusedQueryIndex] || '',
                            param.name,
                          );
                        } else {
                          const tag = `{${param.name}}`;
                          const newUrl = localUrlValue + (localUrlValue.endsWith('/') ? '' : '/') + tag;
                          setLocalUrlValue(newUrl);
                          const parts = parseUrlParts(newUrl);
                          if (parts) setEditingUrlParts(parts);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] font-medium text-white/40 transition-colors hover:border-white/20 hover:text-white"
                      title={`From: ${param.source}`}>
                      <span className="text-white/50">{'{'}</span>
                      {param.name}
                      <span className="text-white/50">{'}'}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer with Save/Cancel */}
        <div className="flex-none flex items-center justify-end gap-2 p-3 pt-2 border-t border-[#23242a] bg-black">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold text-neutral-400 hover:text-white hover:bg-white/5 transition-all">
            Cancel (Esc)
          </button>
          <button
            onClick={() => {
              if (handleApplySave()) onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition-all shadow-lg hover:scale-[1.02] active:scale-95">
            <FaCheck size={10} />
            Save (Ctrl+Enter)
          </button>
        </div>
      </div>
    );
  }

  if (moduleId === 'wait') {
    return (
      <div
        ref={popupRef}
        className={baseClasses}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            e.stopPropagation();
            if (handleApplySave()) onClose();
          } else if (e.key === 'Escape') {
            const target = e.target as HTMLElement;
            if (target.closest('[data-modal-portal="true"]')) return;

            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        }}
        tabIndex={-1}>
        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 py-3 relative">
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 absolute top-2 right-2 z-10">
            <FaTimes size={12} />
          </button>

          <div className="space-y-4 px-1">
            <div className="space-y-1.5 mt-4">
              <label className="block text-[10px] font-bold text-neutral-500 tracking-widest uppercase">
                Wait Duration (milliseconds)
              </label>
              <input
                type="number"
                min="0"
                step="100"
                placeholder="e.g. 1000 (1 second)"
                value={localConfig.delay ?? ''}
                onChange={e => handleConfigChange({ delay: e.target.value ? Number(e.target.value) : '' })}
                className="w-full text-xs px-3 py-2 rounded-lg bg-black border border-white/10 focus:border-white/30 outline-none text-white transition-colors"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (handleApplySave()) onClose();
                  }
                }}
              />
              <p className="text-[10px] text-white/50 leading-relaxed mt-1">
                Specifies how long the automation should pause before continuing. 1000ms = 1 second.
              </p>
            </div>
          </div>
        </div>

        {/* Footer with Save/Cancel */}
        <div className="flex-none flex items-center justify-end gap-2 p-3 pt-2 border-t border-[#23242a] bg-black">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-[10px] font-semibold text-neutral-400 hover:text-white hover:bg-white/5 transition-all">
            Cancel (Esc)
          </button>
          <button
            onClick={() => {
              if (handleApplySave()) onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition-all shadow-lg hover:scale-[1.02] active:scale-95">
            <FaCheck size={10} />
            Save (Ctrl+Enter)
          </button>
        </div>
      </div>
    );
  }

  if (isSingleVariableLayout) {
    return (
      <div
        ref={popupRef}
        className={baseClasses}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            e.stopPropagation();
            if (handleApplySave()) onClose();
          } else if (e.key === 'Escape') {
            const target = e.target as HTMLElement;
            if (target.closest('[data-modal-portal="true"]')) return;
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        }}
        tabIndex={-1}>
        <div className="flex-1 flex flex-col min-h-0 bg-[var(--color-popupBg)] overflow-hidden relative">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-white/5 bg-[var(--color-popupBg)]">
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-bold text-neutral-200">
                {stepNumber !== undefined ? `# ${stepNumber}: ${stepName}` : stepName}
              </span>
            </div>
            {!isTargetResolved && (
              <button onClick={onClose} className="p-1 rounded-md text-neutral-500 hover:text-white transition-all">
                <FaTimes size={12} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar bg-[var(--color-popupBg)]">
            {!isTargetResolved ? (
              <div className="p-6 flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-300">
                {/* Instructions at top */}
                <div className="w-full space-y-3">
                  <div className="text-[12px] text-neutral-300 leading-relaxed font-semibold text-left mx-auto w-max">
                    <div className="mb-2 text-neutral-500 uppercase tracking-widest text-[10px]">
                      Steps to select target
                    </div>
                    <div className="flex flex-col gap-2 ml-4">
                      <div>i) Navigate to target site</div>
                      <div>
                        ii) press{' '}
                        <span className="text-[10px] font-medium mx-1 px-1.5 py-0.5 rounded border border-white/10 bg-white/5 text-neutral-400 shadow-sm align-middle">
                          Alt + S
                        </span>{' '}
                        → choose target field for auto {moduleId === 'click' ? 'click' : 'paste'}.
                      </div>
                      <div>iii) choose the "text input box"</div>
                    </div>
                  </div>
                  <p className="text-[10px] text-neutral-500 italic font-normal text-center mt-2">
                    (ensure URL step is added before this)
                  </p>
                </div>

                {/* Bigger GIF Container */}
                <div className="w-full max-w-[550px] aspect-video rounded-2xl bg-black/40 border border-white/10 overflow-hidden shadow-2xl relative group/gif">
                  <img
                    src={
                      typeof chrome !== 'undefined' && chrome.runtime?.getURL
                        ? chrome.runtime.getURL('AltS_search_newtab/images/how-to-select-intro.gif')
                        : '/AltS_search_newtab/images/how-to-select-intro.gif'
                    }
                    alt="Selection Tutorial"
                    className="w-full h-full object-cover opacity-80 group-hover/gif:opacity-100 transition-opacity duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-5">
                    <div className="flex items-center gap-2.5 text-white/90">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_#10b981] animate-pulse" />
                      <span className="text-[11px] font-black uppercase tracking-widest text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                        {isSingleVariableLayout && !localConfig.selector
                          ? 'Waiting for selection...'
                          : 'Target Selected'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="animate-in fade-in duration-300 flex flex-col h-full bg-[var(--color-popupBg)] outline-none"
                tabIndex={-1}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSaveAndClose();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    onClose();
                  }
                }}>
                {/* Unified Template Header Section */}

                {moduleId === 'click' ? (
                  /* Compact Click Configuration UI */
                  <div className="flex-1 flex flex-col min-h-0 bg-[var(--color-popupBg)] p-4 space-y-5 animate-in fade-in slide-in-from-top-2 duration-400">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">
                          Element Name
                        </label>
                        {!isTokenEditor && (
                          <div className="relative group/details">
                            <div
                              className="text-neutral-600 hover:text-white cursor-help transition-all rounded p-1 hover:bg-white/5"
                              onMouseEnter={e => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoverCoords({ top: rect.top, left: rect.left });
                                setIsHoveringDetails(true);
                              }}
                              onMouseLeave={() => {
                                setIsHoveringDetails(false);
                                setHoverCoords(null);
                              }}>
                              <FaInfoCircle size={12} />
                            </div>
                            {isHoveringDetails &&
                              hoverCoords &&
                              ReactDOM.createPortal(
                                <div
                                  style={{
                                    position: 'fixed',
                                    top: `${hoverCoords!.top}px`,
                                    left: `${hoverCoords!.left + 24}px`,
                                    transform: 'translateY(-50%)',
                                  }}
                                  className="bg-[#0d0d0d] border border-white/10 rounded-xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-[2000000] min-w-[240px] animate-in fade-in slide-in-from-left-2 pointer-events-none ring-1 ring-white/10 font-sans backdrop-blur-md">
                                  <div className="text-[9px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2 border-b border-white/5 pb-1.5">
                                    Selector Metadata
                                  </div>
                                  <div className="space-y-3">
                                    <div className="space-y-1">
                                      <div className="text-[8px] text-neutral-600 uppercase font-black tracking-widest opacity-80">
                                        Origin Page
                                      </div>
                                      <div className="text-[10px] text-neutral-400 break-all leading-tight font-medium bg-white/[0.02] p-1.5 rounded-lg border border-white/5">
                                        {localConfig.selectorPageUrl || localConfig.pageUrl || localConfig.url || 'N/A'}
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <div className="text-[8px] text-neutral-600 uppercase font-black tracking-widest opacity-80">
                                        Computed Selector
                                      </div>
                                      <div className="text-[10px] text-neutral-300 break-all font-mono leading-tight bg-black/60 p-2 rounded-lg border border-white/10 shadow-inner">
                                        {localConfig.selector || 'N/A'}
                                      </div>
                                    </div>
                                  </div>
                                </div>,
                                document.body,
                              )}
                          </div>
                        )}
                      </div>
                      <input
                        type="text"
                        value={localConfig.selectorElementName || ''}
                        onChange={e => handleConfigChange({ selectorElementName: e.target.value })}
                        placeholder="e.g. 'Submit Payment'"
                        className="w-full bg-[#070707] border border-white/10 rounded-lg px-3 py-2 text-[11px] text-neutral-200 outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/10 transition-all hover:bg-white/[0.01]"
                      />
                    </div>

                    <div className="pt-4 border-t border-white/5">
                      {!isTokenEditor && (
                        <button
                          onClick={() => {
                            handleConfigChange({ selector: '', selectorElementName: '', selectorPageUrl: '' });
                            if (stepId && moduleId === 'click') {
                              const chromeAny = (window as any).chrome;
                              if (chromeAny?.storage?.local) {
                                chromeAny.storage.local.set({
                                  automation_recording_state: {
                                    stepId: stepId,
                                    type: moduleId,
                                    active: true,
                                    timestamp: Date.now(),
                                  },
                                });
                              }
                            }
                          }}
                          className="text-[10px] font-black text-neutral-500 hover:text-white transition-all uppercase tracking-[0.15em] flex items-center gap-2.5 group/reselect w-fit px-3 py-1.5 rounded-lg hover:bg-white/[0.03] border border-transparent hover:border-white/5">
                          <div className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center group-hover/reselect:bg-white/10 transition-all group-hover/reselect:scale-105 shadow-sm">
                            <FaSearch
                              size={9}
                              className="text-neutral-400 group-hover/reselect:text-white transition-colors"
                            />
                          </div>
                          Reselect Target
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Standard Table Layout (for Paste and others) */
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="flex flex-col border-b border-white/10">
                      <div className="flex items-center text-neutral-500 bg-[var(--color-popupBg)] border-b border-white/5">
                        <span className="w-[100px] flex-none px-4 py-2 text-[10px] font-bold border-r border-white/5 tracking-wider">
                          Type
                        </span>
                        {!isTokenEditor && (
                          <span className="w-[140px] flex-none px-4 py-2 text-[10px] font-bold border-r border-white/5 tracking-wider">
                            Element Name
                          </span>
                        )}
                        <span className="flex-1 px-4 py-2 text-[10px] font-bold tracking-wider">Value</span>
                      </div>

                      {(() => {
                        const allRows = Object.keys(paramConfigsMap).map(k => ({ key: k }));
                        return allRows.map((item, idx) => {
                          const rowKey = item.key;
                          const config = paramConfigsMap[rowKey] || { type: 'short_text', values: [''] };
                          const val = config.values?.[0] || '';

                          return (
                            <div
                              key={idx}
                              className="relative flex items-center group bg-black min-h-[56px] hover:bg-white/[0.02] transition-all border-b border-white/5 last:border-b-0">
                              <div className="w-[100px] flex-none border-r border-white/10 self-stretch flex items-center justify-center p-2 relative">
                                {(() => {
                                  const typeLabel = isTokenEditor
                                    ? config.type === 'short_text'
                                      ? 'Text'
                                      : INPUT_TYPE_OPTIONS.find(opt => opt.value === config.type)?.label || 'Text'
                                    : INPUT_TYPE_OPTIONS.find(opt => opt.value === config.type)?.label || 'Short Text';
                                  return (
                                    <div className="relative group/type-picker">
                                      <button
                                        onClick={e => {
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          setTypePickerRect(rect);
                                          setTypePickerOpen(rowKey);
                                        }}
                                        className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-all truncate max-w-full ${
                                          typePickerOpen === rowKey
                                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                                            : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:bg-white/10'
                                        }`}>
                                        <span className="text-[9px] font-black tracking-tighter truncate">
                                          {typeLabel}
                                        </span>
                                        <FaChevronDown
                                          size={6}
                                          className={`transition-transform duration-200 ${typePickerOpen === rowKey ? 'rotate-180' : ''}`}
                                        />
                                      </button>

                                      {typePickerOpen === rowKey &&
                                        typePickerRect &&
                                        ReactDOM.createPortal(
                                          <div
                                            style={{
                                              position: 'fixed',
                                              top: `${typePickerRect.bottom + 4}px`,
                                              left: `${typePickerRect.left}px`,
                                              minWidth: '140px',
                                            }}
                                            className="bg-[#0d0d0d] border border-white/10 rounded-lg shadow-2xl z-[2000000] p-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100 ring-1 ring-white/10"
                                            data-modal-portal="true">
                                            {INPUT_TYPE_OPTIONS.filter(option =>
                                              isTokenEditor ? option.value !== 'long_text' : true,
                                            ).map(option => {
                                              const displayLabel =
                                                isTokenEditor && option.value === 'short_text' ? 'Text' : option.label;
                                              const isDropdown = option.value === 'dropdown';
                                              const hasAnotherDropdown = Object.entries(paramConfigsMap).some(
                                                ([key, cfg]) => key !== rowKey && cfg.type === 'dropdown',
                                              );
                                              const isDisabled = isUrlMode && isDropdown && hasAnotherDropdown;
                                              return (
                                                <button
                                                  key={option.value}
                                                  disabled={isDisabled}
                                                  onClick={() => {
                                                    if (isDisabled) return;
                                                    setParamType(rowKey, option.value as ParamInputType);
                                                    setTypePickerOpen(null);
                                                  }}
                                                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-[10px] font-semibold transition-all ${
                                                    isDisabled
                                                      ? 'opacity-30 cursor-not-allowed grayscale'
                                                      : config.type === option.value
                                                        ? 'bg-emerald-500/10 text-emerald-400'
                                                        : 'text-neutral-500 hover:bg-white/5 hover:text-white'
                                                  }`}>
                                                  <option.icon size={10} />
                                                  {displayLabel}
                                                </button>
                                              );
                                            })}
                                          </div>,
                                          document.body,
                                        )}
                                    </div>
                                  );
                                })()}
                              </div>

                              <div className="w-[140px] flex-none border-r border-white/10 self-stretch flex items-center px-1 group/name">
                                <input
                                  type="text"
                                  value={rowKey}
                                  onChange={e => handleRenameParam(rowKey, e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const nextInput = segmentInputRefs.current[rowKey];
                                      if (nextInput) {
                                        nextInput.focus();
                                        if (
                                          nextInput instanceof HTMLInputElement ||
                                          nextInput instanceof HTMLTextAreaElement
                                        ) {
                                          nextInput.select();
                                        }
                                      }
                                    }
                                  }}
                                  className="flex-1 min-w-0 bg-transparent border-none text-[11px] font-bold text-neutral-300 focus:text-white outline-none px-2 py-1.5 rounded hover:bg-white/5 transition-colors"
                                  placeholder="Variable Name"
                                />
                              </div>

                              <div className="flex-1 min-w-0 flex flex-col self-stretch group/query relative">
                                <div className="flex-1 flex flex-col min-w-0">
                                  <div className="flex-1 min-w-0">
                                    {(() => {
                                      if (config.type === 'long_text') {
                                        return (
                                          <div className="px-3">
                                            <textarea
                                              value={val}
                                              onChange={e => {
                                                const next = {
                                                  ...paramConfigsMap,
                                                  [rowKey]: { ...config, values: [e.target.value] },
                                                };
                                                setParamConfigsMap(next);
                                              }}
                                              className="w-full bg-transparent text-[11px] text-white/90 outline-none py-3 resize-none custom-scrollbar min-h-[40px]"
                                              placeholder="Variable Value..."
                                              rows={1}
                                              onInput={e => {
                                                const target = e.target as HTMLTextAreaElement;
                                                target.style.height = 'auto';
                                                target.style.height = `${target.scrollHeight}px`;
                                              }}
                                            />
                                          </div>
                                        );
                                      }
                                      if (config.type === 'constant') {
                                        let pairs =
                                          config.optionPairs && config.optionPairs.length > 0
                                            ? config.optionPairs
                                            : config.values.filter(v => v !== '').map(v => ({ key: '', value: v }));
                                        if (pairs.length === 0) pairs = [{ key: '', value: '' }];
                                        return (
                                          <div className="flex flex-col flex-1 h-full min-h-0 self-stretch bg-[#070707]">
                                            <div className="px-3 py-2 border-b border-white/5 space-y-1">
                                              <label className="text-[8px] font-black text-neutral-500 tracking-widest uppercase pl-0.5">
                                                Description (Required)
                                              </label>
                                              <input
                                                type="text"
                                                value={config.description || ''}
                                                onChange={e => setParamConstantDescription(rowKey, e.target.value)}
                                                readOnly={isTokenEditor}
                                                className="w-full text-[10px] px-2 py-1 rounded bg-black border border-white/10 focus:border-emerald-500/50 outline-none text-neutral-300 placeholder-[var(--color-textPlaceholder)] transition-colors"
                                                placeholder={
                                                  isTokenEditor
                                                    ? 'Description provided by cloud'
                                                    : 'Explain what this constant is for'
                                                }
                                              />
                                            </div>

                                            <div className="flex-1 flex flex-col min-h-0">
                                              <div className="grid grid-cols-[1fr_1fr] bg-white/[0.03] border-b border-white/10 text-[7px] font-black text-neutral-500 tracking-[0.15em]">
                                                <div className="px-2.5 py-1.5 border-r border-white/10">Name</div>
                                                <div className="px-2.5 py-1.5 font-bold">Value</div>
                                              </div>
                                              <div className="max-h-[180px] overflow-y-auto custom-scrollbar min-h-0">
                                                {pairs.map((pair, pIdx) => (
                                                  <div
                                                    key={pIdx}
                                                    className={`grid grid-cols-[1fr_1fr] items-stretch border-b border-white/5 group/row hover:bg-white/[0.02] transition-colors relative ${
                                                      pIdx === pairs.length - 1 ? 'border-b-0' : ''
                                                    }`}>
                                                    <input
                                                      type="text"
                                                      value={pair.key}
                                                      onChange={e => {
                                                        const nextPairs = [...pairs];
                                                        nextPairs[pIdx] = { ...pair, key: e.target.value };
                                                        handleSaveConstantOptionPairs(rowKey, nextPairs);
                                                      }}
                                                      className="w-full text-[10px] px-2.5 py-1.5 bg-transparent border-r border-white/10 outline-none text-white overflow-ellipsis placeholder:text-[8px] placeholder:text-neutral-700"
                                                      placeholder="Name"
                                                    />
                                                    <div className="relative flex items-center">
                                                      <input
                                                        type="text"
                                                        value={pair.value}
                                                        onChange={e => {
                                                          const nextPairs = [...pairs];
                                                          nextPairs[pIdx] = { ...pair, value: e.target.value };
                                                          handleSaveConstantOptionPairs(rowKey, nextPairs);
                                                        }}
                                                        className="w-full text-[10px] px-2.5 py-1.5 bg-transparent outline-none text-neutral-400 font-mono overflow-ellipsis placeholder:text-[8px] placeholder:text-neutral-700"
                                                        placeholder="Value"
                                                      />
                                                      {pairs.length > 1 && (
                                                        <button
                                                          onClick={() => {
                                                            const nextPairs = pairs.filter((_, i) => i !== pIdx);
                                                            handleSaveConstantOptionPairs(
                                                              rowKey,
                                                              nextPairs.length ? nextPairs : [{ key: '', value: '' }],
                                                            );
                                                          }}
                                                          className="absolute right-1 p-1 text-neutral-700 hover:text-red-400 opacity-0 group-hover/row:opacity-100 transition-all bg-black/60 rounded shadow-lg backdrop-blur-sm">
                                                          <FaTrash size={8} />
                                                        </button>
                                                      )}
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                              <div className="flex justify-center p-1.5 mt-auto border-t border-white/5 bg-white/[0.01]">
                                                <button
                                                  onClick={() => {
                                                    const nextPairs = [...pairs, { key: '', value: '' }];
                                                    handleSaveConstantOptionPairs(rowKey, nextPairs);
                                                  }}
                                                  className="flex items-center justify-center w-6 h-6 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-md shadow-sm transition-all group/add">
                                                  <FaPlus
                                                    size={9}
                                                    className="group-hover/add:scale-110 transition-transform"
                                                  />
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      }
                                      if (config.type === 'dropdown') {
                                        let pairs =
                                          config.optionPairs && config.optionPairs.length > 0
                                            ? config.optionPairs
                                            : config.values.filter(v => v !== '').map(v => ({ key: v, value: v }));
                                        if (pairs.length === 0) pairs = [{ key: '', value: '' }];
                                        return (
                                          <div className="flex flex-col flex-1 h-full min-h-0 self-stretch">
                                            <div className="bg-[#070707] flex flex-col flex-1 h-full">
                                              <div className="grid grid-cols-[1fr_1fr] bg-white/[0.03] border-b border-white/10 text-[7px] font-black text-neutral-500 tracking-[0.15em]">
                                                <div className="px-2.5 py-1.5 border-r border-white/10">Name</div>
                                                <div className="px-2.5 py-1.5 font-bold">Value</div>
                                              </div>
                                              <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
                                                {pairs.map((pair, pIdx) => (
                                                  <div
                                                    key={pIdx}
                                                    className={`grid grid-cols-[1fr_1fr] items-stretch border-b border-white/5 group/row hover:bg-white/[0.02] transition-colors relative ${
                                                      pIdx === pairs.length - 1 ? 'border-b-0' : ''
                                                    }`}>
                                                    <input
                                                      type="text"
                                                      value={pair.key}
                                                      onChange={e => {
                                                        const nextPairs = [...pairs];
                                                        nextPairs[pIdx] = { ...pair, key: e.target.value };
                                                        handleSaveDropdownOptionPairs(rowKey, nextPairs);
                                                      }}
                                                      className="w-full text-[10px] px-2.5 py-1.5 bg-transparent border-r border-white/10 outline-none text-white overflow-ellipsis placeholder:text-[8px] placeholder:text-neutral-700 focus:bg-emerald-500/[0.02]"
                                                      placeholder="Enter Name"
                                                    />
                                                    <div className="relative flex items-center">
                                                      <input
                                                        type="text"
                                                        value={pair.value}
                                                        onChange={e => {
                                                          const nextPairs = [...pairs];
                                                          nextPairs[pIdx] = { ...pair, value: e.target.value };
                                                          handleSaveDropdownOptionPairs(rowKey, nextPairs);
                                                        }}
                                                        className="w-full text-[10px] px-2.5 py-1.5 bg-transparent outline-none text-neutral-400 font-mono overflow-ellipsis placeholder:text-[8px] placeholder:text-neutral-700 focus:bg-emerald-500/[0.02]"
                                                        placeholder="Enter Value"
                                                      />
                                                      {pairs.length > 1 && (
                                                        <button
                                                          onClick={() => {
                                                            const nextPairs = pairs.filter((_, i) => i !== pIdx);
                                                            handleSaveDropdownOptionPairs(
                                                              rowKey,
                                                              nextPairs.length ? nextPairs : [{ key: '', value: '' }],
                                                            );
                                                          }}
                                                          className="absolute right-1 p-1 text-neutral-700 hover:text-red-400 opacity-0 group-hover/row:opacity-100 transition-all bg-black/60 rounded shadow-lg backdrop-blur-sm">
                                                          <FaTrash size={8} />
                                                        </button>
                                                      )}
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                              <div className="flex justify-center p-1.5 mt-auto border-t border-white/5">
                                                <button
                                                  onClick={() => {
                                                    const nextPairs = [...pairs, { key: '', value: '' }];
                                                    handleSaveDropdownOptionPairs(rowKey, nextPairs);
                                                  }}
                                                  className="flex items-center justify-center w-6 h-6 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-md shadow-sm transition-all group/add">
                                                  <FaPlus
                                                    size={9}
                                                    className="group-hover/add:scale-110 transition-transform"
                                                  />
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      }
                                      return (
                                        <div className="flex items-center group/field-wrapper">
                                          <div className="flex-1 px-3">
                                            <input
                                              type="text"
                                              value={val}
                                              onChange={e => {
                                                if (isPreviewMode) return;
                                                const next = {
                                                  ...paramConfigsMap,
                                                  [rowKey]: { ...config, values: [e.target.value] },
                                                };
                                                setParamConfigsMap(next);
                                              }}
                                              onKeyDown={e => {
                                                if (e.key === 'Enter' && !e.ctrlKey) {
                                                  e.preventDefault();
                                                  // Find next row's name input
                                                  const keys = Object.keys(paramConfigsMap);
                                                  const currentIdx = keys.indexOf(rowKey);
                                                  if (currentIdx < keys.length - 1) {
                                                    const row = (e.currentTarget.closest('[key]') ||
                                                      e.currentTarget.closest('.group')) as HTMLElement | null;
                                                    const nextRow = row?.nextElementSibling as HTMLElement | null;
                                                    const nextNameInput = nextRow?.querySelector(
                                                      'input[placeholder="Variable Name"]',
                                                    ) as HTMLInputElement | null;
                                                    nextNameInput?.focus();
                                                    nextNameInput?.select();
                                                  }
                                                }
                                              }}
                                              className="w-full bg-transparent text-[11px] text-white/90 outline-none py-3 placeholder:text-neutral-600"
                                              placeholder="Variable Value..."
                                              ref={el => {
                                                if (el) segmentInputRefs.current[rowKey] = el as any;
                                              }}
                                            />
                                          </div>
                                          <button
                                            onClick={() => {
                                              const next = { ...paramConfigsMap };
                                              delete next[rowKey];
                                              setParamConfigsMap(next);
                                            }}
                                            className="mr-3 p-1.5 text-neutral-700 hover:text-red-400 opacity-0 group-hover/field-wrapper:opacity-100 transition-all">
                                            <FaTrash size={10} />
                                          </button>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                    {!isTokenEditor && (
                      <div className="flex justify-center p-2 border-b border-white/10 bg-black/40">
                        <button
                          onClick={() => {
                            if (isPreviewMode) return;
                            const existingKeys = Object.keys(paramConfigsMap);
                            let idx = 1;
                            while (existingKeys.includes(`input${idx}`)) idx++;
                            const newKey = `input${idx}`;
                            setParamConfigsMap(prev => ({
                              ...prev,
                              [newKey]: { type: 'short_text', values: [''] },
                            }));
                          }}
                          className="flex items-center justify-center gap-2 px-4 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded shadow-sm transition-all group/add-param">
                          <FaPlus size={9} className="group-hover/add-param:scale-110 transition-transform" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Add Input Variable</span>
                        </button>
                      </div>
                    )}

                    {!isPreviewMode && (
                      <div className="p-4 border-t border-white/5 bg-black/5 flex items-center justify-between">
                        {!isTokenEditor && (
                          <button
                            onClick={() => {
                              handleConfigChange({ selector: '', selectorElementName: '', selectorPageUrl: '' });
                              if (stepId && (moduleId === 'click' || moduleId === 'paste')) {
                                const chromeAny = (window as any).chrome;
                                if (chromeAny?.storage?.local) {
                                  chromeAny.storage.local.set({
                                    automation_recording_state: {
                                      stepId: stepId,
                                      type: moduleId,
                                      active: true,
                                      timestamp: Date.now(),
                                    },
                                  });
                                }
                              }
                            }}
                            className="text-[10px] font-bold text-neutral-500 hover:text-white transition-all tracking-widest flex items-center gap-2 group/reselect w-fit">
                            <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center group-hover/reselect:bg-white/10 transition-colors">
                              <FaSearch size={8} />
                            </div>
                            Reselect target element
                          </button>
                        )}

                        {!isTokenEditor && (
                          <div className="relative group/name">
                            <div
                              className="flex-none px-1 text-neutral-600 hover:text-white cursor-help transition-opacity"
                              onMouseEnter={e => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoverCoords({ top: rect.top, left: rect.left });
                                setIsHoveringDetails(true);
                              }}
                              onMouseLeave={() => {
                                setIsHoveringDetails(false);
                                setHoverCoords(null);
                              }}>
                              <FaInfoCircle size={12} />
                            </div>
                            {isHoveringDetails &&
                              hoverCoords &&
                              ReactDOM.createPortal(
                                <div
                                  style={{
                                    position: 'fixed',
                                    top: `${hoverCoords!.top}px`,
                                    left: `${hoverCoords!.left + 20}px`,
                                    transform: 'translateY(-50%)',
                                  }}
                                  className="bg-black border border-white/10 rounded-xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[2000000] min-w-[220px] animate-in fade-in slide-in-from-left-2 pointer-events-none ring-1 ring-white/10 font-sans">
                                  <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 border-b border-white/5 pb-1">
                                    Selector Metadata
                                  </div>
                                  <div className="space-y-3">
                                    <div className="space-y-1">
                                      <div className="text-[8px] text-neutral-500 uppercase font-black tracking-tighter">
                                        Origin Page
                                      </div>
                                      <div className="text-[10px] text-neutral-300 break-all leading-tight font-medium">
                                        {localConfig.selectorPageUrl || localConfig.pageUrl || localConfig.url || 'N/A'}
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <div className="text-[8px] text-neutral-500 uppercase font-black tracking-tighter">
                                        Computed Selector
                                      </div>
                                      <div className="text-[10px] text-neutral-400 break-all font-mono leading-tight bg-black/40 p-1.5 rounded border border-white/10">
                                        {localConfig.selector || 'N/A'}
                                      </div>
                                    </div>
                                  </div>
                                </div>,
                                document.body,
                              )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {isTargetResolved && (
              <div className="flex-none flex items-center justify-end gap-2 p-3 pt-2 border-t border-[#23242a] bg-black animate-in fade-in slide-in-from-bottom-2 duration-300">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-semibold text-neutral-400 hover:text-white hover:bg-white/5 transition-all">
                  Cancel (Esc)
                </button>
                <button
                  onClick={() => {
                    if (handleApplySave()) onClose();
                  }}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition-all shadow-lg hover:scale-[1.02] active:scale-95">
                  <FaCheck size={10} />
                  Save (Ctrl+Enter)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={popupRef}
      className={baseClasses}
      style={style}
      onClick={e => e.stopPropagation()}
      onKeyDown={e => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          e.stopPropagation();
          if (handleApplySave()) onClose();
        } else if (e.key === 'Escape') {
          const target = e.target as HTMLElement;
          if (target.closest('[data-modal-portal="true"]')) return;

          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
      tabIndex={-1}>
      <div className="flex-none flex items-center justify-between p-3 pb-2 border-b border-white/10">
        <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
          {isTokenEditor
            ? 'Token Configuration'
            : stepNumber !== undefined
              ? `# ${stepNumber}: Agent Configuration`
              : 'Agent Configuration'}
        </span>
        <div className="flex items-center gap-2">
          {!isTokenEditor && (
            <button
              onClick={addPrompt}
              className="text-neutral-400 hover:bg-white/5 p-1 rounded transition-colors"
              title="Add another prompt">
              <FaPlus size={10} />
            </button>
          )}
          <button
            onClick={handleCancelAndClose}
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-white/5">
            <FaTimes size={12} />
          </button>
        </div>
      </div>

      {validationError && (
        <div className="mx-3 mt-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
          {validationError}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 pt-2 custom-scrollbar space-y-4">
        {/* Prompts */}
        <div className="space-y-4">
          <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest block">
            Prompts
          </span>
          {prompts.map((prompt, pIdx) => (
            <div key={pIdx} className="space-y-3 relative group">
              {prompts.length > 1 && (
                <button
                  onClick={() => removePrompt(pIdx)}
                  className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 p-1.5 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full shadow-sm hover:scale-110 transition-all z-10"
                  title="Remove prompt block">
                  <FaTrash size={8} />
                </button>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-tighter">
                    Variable Key
                  </label>
                  <input
                    type="text"
                    value={prompt.key}
                    onChange={e => updatePromptKey(pIdx, e.target.value)}
                    onClick={handleTokenClick}
                    onKeyDown={handleTokenKeyDown}
                    className="w-full text-xs px-2 py-1.5 rounded bg-black border border-white/10 focus:border-white/30 outline-none text-neutral-300 transition-colors"
                    placeholder="e.g. prompt1"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[9px] font-bold text-neutral-400 uppercase tracking-tighter">
                      Input Value(s)
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setTypePickerOpen(typePickerOpen === `prompt-${pIdx}` ? null : `prompt-${pIdx}`)}
                        className="flex items-center gap-1.5 px-2 py-1 rounded border border-white/10 bg-black text-[9px] font-medium text-neutral-300 hover:bg-white/5 transition-colors">
                        {INPUT_TYPE_OPTIONS.find(o => o.value === (prompt.type || 'long_text'))?.label}
                        <FaChevronDown
                          size={8}
                          className={`transition-transform ${typePickerOpen === `prompt-${pIdx}` ? 'rotate-180' : ''}`}
                        />
                      </button>
                      {typePickerOpen === `prompt-${pIdx}` && (
                        <div
                          className={`absolute right-0 ${pIdx > 1 ? 'bottom-full mb-1' : 'top-full mt-1'} w-40 bg-black rounded-lg border border-white/10 shadow-lg z-[60] overflow-hidden overflow-y-auto custom-scrollbar`}
                          style={{
                            maxHeight: pIdx > 1 ? '250px' : '300px',
                          }}>
                          {INPUT_TYPE_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setPromptType(pIdx, opt.value)}
                              className={`w-full text-left px-3 py-2 flex flex-col gap-0.5 hover:bg-white/5 transition-colors ${(prompt.type || 'long_text') === opt.value ? 'bg-purple-900/20' : ''}`}>
                              <span
                                className={`text-xs font-medium ${(prompt.type || 'long_text') === opt.value ? 'text-purple-600 dark:text-purple-400' : 'text-neutral-700 dark:text-neutral-200'}`}>
                                {opt.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {prompt.type === 'constant'
                    ? (() => {
                        const rowKey = prompt.key;
                        let pairs =
                          prompt.optionPairs && prompt.optionPairs.length > 0
                            ? prompt.optionPairs
                            : prompt.values.filter(v => v !== '').map(v => ({ key: '', value: v }));
                        if (pairs.length === 0) pairs = [{ key: '', value: '' }];

                        return (
                          <div className="flex flex-col gap-2 p-3 bg-black/40 border border-white/10 rounded-lg">
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest pl-0.5">
                                Description (Required)
                              </label>
                              <input
                                type="text"
                                value={prompt.description || ''}
                                onChange={e => setPromptDescription(pIdx, e.target.value)}
                                readOnly={isTokenEditor}
                                className="w-full text-xs px-2.5 py-2 rounded bg-black border border-white/10 focus:border-purple-500 outline-none text-neutral-300 placeholder-[var(--color-textPlaceholder)] transition-colors"
                                placeholder={
                                  isTokenEditor ? 'Description provided by cloud' : 'Explain what this constant is for'
                                }
                              />
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between px-0.5">
                                <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
                                  Constant Configuration
                                </label>
                              </div>
                              <div className="overflow-hidden border border-white/10 rounded bg-black/60">
                                <div className="grid grid-cols-[1fr_1fr] bg-white/[0.03] border-b border-white/10 text-[7px] font-black text-neutral-500 tracking-[0.15em]">
                                  <div className="px-2.5 py-1.5 border-r border-white/10">Name</div>
                                  <div className="px-2.5 py-1.5 font-bold">Value</div>
                                </div>
                                <div className="max-h-40 overflow-y-auto custom-scrollbar">
                                  {pairs.map((pair: { key: string; value: string }, vIdx: number) => (
                                    <div
                                      key={vIdx}
                                      className={`grid grid-cols-[1fr_1fr] items-stretch border-b border-white/5 group/row hover:bg-white/[0.02] transition-colors relative ${
                                        vIdx === pairs.length - 1 ? 'border-b-0' : ''
                                      }`}>
                                      <input
                                        type="text"
                                        value={pair.key}
                                        onChange={e => {
                                          const nextPairs = [...pairs];
                                          nextPairs[vIdx] = { ...pair, key: e.target.value };
                                          updatePromptConstantOptionPairs(pIdx, nextPairs);
                                        }}
                                        className="w-full text-[10px] px-2.5 py-1.5 bg-transparent border-r border-white/10 outline-none text-white placeholder:text-neutral-700"
                                        placeholder="Name"
                                      />
                                      <div className="relative flex items-center">
                                        <input
                                          type="text"
                                          value={pair.value}
                                          onChange={e => {
                                            const nextPairs = [...pairs];
                                            nextPairs[vIdx] = { ...pair, value: e.target.value };
                                            updatePromptConstantOptionPairs(pIdx, nextPairs);
                                          }}
                                          className="w-full text-[10px] px-2.5 py-1.5 bg-transparent outline-none text-neutral-400 font-mono placeholder:text-neutral-700"
                                          placeholder="Value"
                                        />
                                        {pairs.length > 1 && (
                                          <button
                                            onClick={() => {
                                              const nextPairs = pairs.filter((_, i) => i !== vIdx);
                                              updatePromptConstantOptionPairs(
                                                pIdx,
                                                nextPairs.length ? nextPairs : [{ key: '', value: '' }],
                                              );
                                            }}
                                            className="absolute right-1 p-1 text-neutral-700 hover:text-red-400 opacity-0 group-hover/row:opacity-100 transition-all bg-black/60 rounded shadow-md backdrop-blur-sm">
                                            <FaTrash size={8} />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="flex justify-center p-1 border-t border-white/5">
                                  <button
                                    onClick={() => {
                                      const nextPairs = [...pairs, { key: '', value: '' }];
                                      updatePromptConstantOptionPairs(pIdx, nextPairs);
                                    }}
                                    className="flex items-center justify-center w-6 h-6 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded shadow-sm transition-all group/add">
                                    <FaPlus size={8} className="group-hover/add:scale-110 transition-transform" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    : (!prompt.type || prompt.type === 'short_text') && (
                        <div className="space-y-1.5">
                          <input
                            type="text"
                            value={prompt.values[0] || ''}
                            onChange={e => updatePromptValue(pIdx, 0, e.target.value)}
                            onClick={handleTokenClick}
                            onKeyDown={handleTokenKeyDown}
                            className="w-full text-xs px-2.5 py-2 rounded bg-black border border-white/10 focus:border-purple-500 outline-none text-neutral-300 placeholder-[var(--color-textPlaceholder)]"
                            placeholder="Default value (optional)"
                          />
                        </div>
                      )}

                  {prompt.type === 'long_text' && (
                    <textarea
                      value={prompt.values[0] || ''}
                      onChange={e => updatePromptValue(pIdx, 0, e.target.value)}
                      onClick={handleTokenClick}
                      onKeyDown={handleTokenKeyDown}
                      rows={3}
                      className="w-full text-xs px-2.5 py-2 rounded bg-black border border-white/10 focus:border-purple-500 outline-none text-neutral-300 placeholder-[var(--color-textPlaceholder)] resize-y min-h-[60px]"
                      placeholder="Default value (optional)"
                    />
                  )}

                  {prompt.type === 'dropdown' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-medium text-neutral-400 uppercase tracking-wider">
                            Options
                          </span>
                          <button
                            onClick={() => onOpenHistorySuggestions?.(prompt.key)}
                            className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-tighter transition-all">
                            Manage Options
                          </button>
                        </div>
                        {!isTokenEditor && (
                          <button
                            onClick={() => addValueToPrompt(pIdx)}
                            className="p-1 hover:bg-neutral-800 text-neutral-400 rounded transition-colors"
                            title="Add dropdown value">
                            <FaPlus size={8} />
                          </button>
                        )}
                      </div>
                      <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1 custom-scrollbar">
                        {prompt.values.map((v, vIdx) => (
                          <div key={vIdx} className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={v}
                              onChange={e => updatePromptValue(pIdx, vIdx, e.target.value)}
                              onClick={handleTokenClick}
                              onKeyDown={handleTokenKeyDown}
                              className="flex-1 text-xs px-2 py-1.5 rounded bg-black border border-white/10 focus:border-white/30 outline-none text-neutral-300 placeholder-[var(--color-textPlaceholder)]"
                              placeholder={`Option ${vIdx + 1}`}
                              autoFocus={vIdx === prompt.values.length - 1 && vIdx > 0}
                            />
                            <button
                              onClick={() => removeValueFromPrompt(pIdx, vIdx)}
                              className="p-1 text-neutral-400 hover:text-red-500 transition-colors">
                              <FaTrash size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ALL AI Agents */}
        {isAllAi && (
          <div className="pt-3 border-t border-white/10 space-y-3">
            <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 tracking-widest block">
              Agents to Include
            </span>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(localAllAiUrls).map(([agentKey]) => (
                <div
                  key={agentKey}
                  className="flex items-center justify-between p-2 rounded bg-black border border-white/10">
                  <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300 capitalize">
                    {agentKey}
                  </span>
                  <button
                    onClick={() => removeAgentFromAllAi(agentKey)}
                    className="text-neutral-400 hover:text-red-500 p-1 rounded transition-colors">
                    <FaTimes size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reuse Variables */}
        {availableParams.length > 0 && (
          <div className="pt-3 border-t border-white/10 space-y-2">
            <span className="text-[10px] font-medium text-neutral-400 tracking-widest block">Reuse Variables</span>
            <div className="flex flex-wrap gap-1.5">
              {availableParams.map((param, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    const type = param.dropdownOptions ? 'dropdown' : 'long_text';
                    const newValues = param.dropdownOptions
                      ? param.dropdownOptions.split(',')
                      : param.fixedValue
                        ? [param.fixedValue]
                        : [`{${param.name}}`];
                    setPrompts([...prompts, { key: param.name, type, values: newValues }]);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-white/10 bg-white/5 text-neutral-400 hover:bg-white/10 transition-colors text-[9px] font-bold">
                  <span className="opacity-60">{'{'}</span>
                  {param.name}
                  <span className="opacity-60">{'}'}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AutomationStepPicker;
export { ParamBadge };
