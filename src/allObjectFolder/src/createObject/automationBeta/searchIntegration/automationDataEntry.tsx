import type React from 'react';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaExpand, FaPlus, FaChevronDown } from 'react-icons/fa';
import { PiPaperPlaneRightFill } from 'react-icons/pi';
import { GoPaperclip } from 'react-icons/go';
import { LuInfo } from 'react-icons/lu';
import { extractFrequentValues } from '../utilities/historyExtractor';
import AutomationDynamicIcon, { resolveAutomationIconMeta } from '../../../../../shared-components/icons/automationDynamicIcon';
import type { AutomationSuggestionsListItem } from './automationSuggestionsList';
import AutomationSuggestionsList from './automationSuggestionsList';
import { resolvePlaceholderFromCmd } from '../../../../../shared-components/searchBarMain/userInterfaceComponents/searchBar';

export interface AutomationInputField {
  key: string;
  label: string;
  value: string;
  type?: 'text' | 'image' | 'dropdown';
  sourceType?: 'text' | 'image' | 'dropdown' | 'constant';
  description?: string;
  inputStyle?: 'short_text' | 'long_text';
  images?: { url: string; file: File; filename: string; mimeType: string }[];
  dropdownOptions?: string[];
  dropdownOptionPairs?: { key: string; value: string }[];
  /** URL template of the step this field came from (for history suggestion extraction) */
  urlTemplate?: string;
  groupId?: string;
  groupLabel?: string;
  groupSelector?: string;
  groupAction?: string;
  order?: number;
  extraValues?: string[];
}

export interface AutomationDataEntryProps {
  title: string;
  automation?: any;
  anchorRef?: React.RefObject<HTMLElement>;
  fields: AutomationInputField[];
  focusedFieldIndex: number;
  onFieldChange: (index: number, value: string) => void;
  onDropdownOptionsSave?: (index: number, pairs: { key: string; value: string }[]) => void;
  onExtraFieldChange?: (index: number, extraIndex: number, value: string) => void;
  onRemoveExtraField?: (index: number, extraIndex: number) => void;
  onImagesChange?: (index: number, images: any[]) => void;
  onFocusChange: (index: number) => void;
  onExecute: () => void;
  onCancel: () => void;
  /** Pass the already-fetched browser history items so we don't re-fetch */
  historyItems?: { url?: string; title?: string; visitCount?: number }[] | null;
  /** If true, the internal floating header and fixed popup container are disabled */
  headless?: boolean;
  /** If true, the field will style itself for inline use in the search bar */
  isSingleField?: boolean;
  /** Matches the search bar's responsive left offset */
  dynamicLeftOffset?: number;
  /** Dark mode state for styling consistency */
  isDarkMode?: boolean;
}

/* ───────────────────────────────────────────────────────
 * Expanded Textarea Popup
 * Appears when user double-clicks a text input field.
 * Preserves whitespace, newlines, and formatting.
 * ─────────────────────────────────────────────────────── */
const ExpandedTextarea: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
}> = ({ label, value, onChange, onClose }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    // Auto-focus and place cursor at the end
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
      textareaRef.current.selectionEnd = textareaRef.current.value.length;
    }
  }, []);

  const handleClose = useCallback(() => {
    onChange(localValue);
    onClose();
  }, [localValue, onChange, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleClose();
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] pointer-events-auto"
        onClick={handleClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 12 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="fixed inset-x-4 top-[20%] mx-auto max-w-xl z-[101] flex flex-col bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl shadow-black/20 border border-neutral-200 dark:border-neutral-700/60 overflow-hidden pointer-events-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <FaExpand size={11} className="text-[var(--color-iconDefault)]" />
            <span className="text-[12px] font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
              {label}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
            <span>Done</span>
            <div className="flex items-center px-1 py-0.5 rounded border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 text-[9px] font-black">
              ESC
            </div>
          </button>
        </div>
        <div className="p-3">
          <textarea
            ref={textareaRef}
            value={localValue}
            onChange={e => setLocalValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={10}
            className="w-full resize-none rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 text-sm text-neutral-900 dark:text-white font-mono leading-relaxed p-4 outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-400/20 transition-all placeholder:text-neutral-400 dark:placeholder:text-neutral-600"
            placeholder={`Enter ${label.toLowerCase()}...`}
            style={{ whiteSpace: 'pre-wrap', tabSize: 2 }}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-2 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
          <span className="text-[10px] text-neutral-400 italic">formatting will be preserved</span>
          <span className="text-[10px] text-neutral-400">
            {localValue.length} chars · {localValue.split('\n').length} lines
          </span>
        </div>
      </motion.div>
    </>
  );
};

const AutomationDataEntry: React.FC<AutomationDataEntryProps> = ({
  title,
  automation,
  anchorRef,
  fields,
  focusedFieldIndex,
  onFieldChange,
  onDropdownOptionsSave,
  onExtraFieldChange,
  onRemoveExtraField,
  onImagesChange,
  onFocusChange,
  onExecute,
  onCancel,
  historyItems,
  headless = false,
  isSingleField = false,
  dynamicLeftOffset = 12,
  isDarkMode = true,
}) => {
  const inputRefs = useRef<(HTMLInputElement | HTMLTextAreaElement | HTMLButtonElement | null)[]>([]);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [editingDropdownIndex, setEditingDropdownIndex] = useState<number | null>(null);
  const [editingDropdownRows, setEditingDropdownRows] = useState<Array<{ id: string; key: string; value: string }>>([]);
  const [expandedFieldIndex, setExpandedFieldIndex] = useState<number | null>(null);
  const [anchorY, setAnchorY] = useState<number | null>(null);

  const iconAutomation = useMemo(() => {
    if (!automation) return null;
    if (Array.isArray(automation.steps) || Array.isArray(automation.automation_steps)) return automation;
    if (automation.automation) return automation.automation;
    if (automation.item?.automation) return automation.item.automation;
    return automation;
  }, [automation]);
  const automationIconMeta = useMemo(() => resolveAutomationIconMeta(iconAutomation), [iconAutomation]);

  // Per-field history suggestions state
  const [historyForIndex, setHistoryForIndex] = useState<number | null>(null);
  const [historySuggestions, setHistorySuggestions] = useState<{ value: string; title: string }[]>([]);
  const historyCacheRef = useRef<{ url?: string; title?: string; visitCount?: number }[] | null>(historyItems || null);

  useEffect(() => {
    if (focusedFieldIndex !== -1 && inputRefs.current[focusedFieldIndex]) {
      inputRefs.current[focusedFieldIndex]?.focus();
    }
  }, [focusedFieldIndex]);

  useEffect(() => {
    if (historyItems && historyItems.length > 0) {
      historyCacheRef.current = historyItems;
    }
  }, [historyItems]);

  // Handle auto-fill for single history result (async)
  useEffect(() => {
    if (focusedFieldIndex === -1 || historyForIndex !== focusedFieldIndex) return;
    if (historySuggestions.length === 0) return;

    const field = fields[focusedFieldIndex];
    if (!field || field.value) return;

    const optPairs =
      field.type !== 'image'
        ? field.dropdownOptionPairs?.length
          ? field.dropdownOptionPairs
          : (field.dropdownOptions || []).map((o, i) => ({ key: `Option ${i + 1}`, value: o }))
        : [];
    const hItems = historySuggestions.map(s => s.value);
    const uniqueVals = Array.from(new Set([...optPairs.map(p => p.value), ...hItems]));

    if (uniqueVals.length === 1) {
      onFieldChange(focusedFieldIndex, uniqueVals[0]);
    }
  }, [historySuggestions, focusedFieldIndex, historyForIndex, fields, onFieldChange]);

  const updateAnchorPosition = useCallback(() => {
    if (typeof window === 'undefined') return;
    const anchorEl = anchorRef?.current;
    if (!anchorEl) {
      setAnchorY(null);
      return;
    }
    const rect = anchorEl.getBoundingClientRect();
    setAnchorY(rect.top + rect.height / 2);
  }, [anchorRef]);

  useEffect(() => {
    updateAnchorPosition();
  }, [updateAnchorPosition, fields.length, title]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handle = () => updateAnchorPosition();
    window.addEventListener('resize', handle);
    window.addEventListener('scroll', handle, true);
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, true);
    };
  }, [updateAnchorPosition]);

  const getOptionPairsForField = useCallback((field: AutomationInputField) => {
    return field.dropdownOptionPairs && field.dropdownOptionPairs.length > 0
      ? field.dropdownOptionPairs
      : (field.dropdownOptions || []).map((option, optIndex) => ({
          key: `Option ${optIndex + 1}`,
          value: option,
        }));
  }, []);

  const buildHistoryContext = useCallback((fieldSnapshot: AutomationInputField[]) => {
    const context: Record<string, string> = {};
    fieldSnapshot.forEach(field => {
      const key = String(field.key || '').trim();
      const value = String(field.value || '').trim();
      if (!key || !value) return;
      context[key] = value;
    });
    return context;
  }, []);

  const maybeAutoPrefillSingleSuggestion = useCallback(
    (index: number, fieldSnapshot: AutomationInputField[], results: { value: string; title: string }[]) => {
      if (results.length !== 1) return;
      const suggestion = String(results[0]?.value || '').trim();
      if (!suggestion) return;

      const currentValue = String(fieldSnapshot[index]?.value || '').trim();
      if (!currentValue) {
        onFieldChange(index, suggestion);
        return;
      }

      const currentLower = currentValue.toLowerCase();
      const suggestedLower = suggestion.toLowerCase();

      if (currentLower === suggestedLower) return;
      if (suggestedLower.startsWith(currentLower) || suggestedLower.includes(currentLower)) {
        onFieldChange(index, suggestion);
      }
    },
    [onFieldChange],
  );

  useEffect(() => {
    if (activeDropdown === null || editingDropdownIndex !== activeDropdown) return;
    const field = fields[activeDropdown];
    const optionPairs =
      field?.dropdownOptionPairs && field.dropdownOptionPairs.length > 0
        ? field.dropdownOptionPairs
        : (field?.dropdownOptions || []).map((option, optIndex) => ({
            key: `Option ${optIndex + 1}`,
            value: option,
          }));
    setEditingDropdownRows(
      optionPairs.map((pair, idx) => ({
        id: `edit-row-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        key: String(pair?.key || '').trim() || `Option ${idx + 1}`,
        value: String(pair?.value || '').trim(),
      })),
    );
  }, [activeDropdown, editingDropdownIndex, fields]);

  const beginDropdownEditing = (index: number) => {
    const field = fields[index];
    const optionPairs =
      field?.dropdownOptionPairs && field.dropdownOptionPairs.length > 0
        ? field.dropdownOptionPairs
        : (field?.dropdownOptions || []).map((option, optIndex) => ({
            key: `Option ${optIndex + 1}`,
            value: option,
          }));
    setEditingDropdownRows(
      optionPairs.map((pair, idx) => ({
        id: `edit-row-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        key: String(pair?.key || '').trim() || `Option ${idx + 1}`,
        value: String(pair?.value || '').trim(),
      })),
    );
    setEditingDropdownIndex(index);
  };

  const addDropdownRow = () => {
    setEditingDropdownRows(prev => [
      ...prev,
      {
        id: `edit-row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        key: '',
        value: '',
      },
    ]);
  };

  const updateDropdownRow = (rowId: string, field: 'key' | 'value', nextValue: string) => {
    setEditingDropdownRows(prev => prev.map(row => (row.id === rowId ? { ...row, [field]: nextValue } : row)));
  };

  const saveDropdownRows = (index: number) => {
    const normalizedPairs = editingDropdownRows
      .map((row, idx) => ({
        key: String(row.key || '').trim() || `Option ${idx + 1}`,
        value: String(row.value || '').trim(),
      }))
      .filter(row => row.value);
    onDropdownOptionsSave?.(index, normalizedPairs);
    setEditingDropdownIndex(null);
  };

  const fetchHistorySuggestions = useCallback(
    (index: number, fieldSnapshot?: AutomationInputField[]) => {
      const currentFields = fieldSnapshot || fields;
      const field = currentFields[index];
      if (!field?.urlTemplate) return;

      setHistorySuggestions([]);
      setHistoryForIndex(index);
      const contextValues = buildHistoryContext(currentFields);

      if (historyCacheRef.current && historyCacheRef.current.length > 0) {
        const results = extractFrequentValues(field.urlTemplate, historyCacheRef.current, field.key, {
          contextValues,
          maxResults: 12,
        });
        setHistorySuggestions(results);
        maybeAutoPrefillSingleSuggestion(index, currentFields, results);
        return;
      }

      const chromeAny = (window as any)?.chrome;
      if (!chromeAny?.runtime?.sendMessage) return;

      chromeAny.runtime.sendMessage({ action: 'history_search', query: '', maxResults: 10000 }, (response: any) => {
        const items =
          response?.ok && Array.isArray(response.results)
            ? response.results.map((item: any) => ({
                url: item.url || '',
                title: item.title || item.url || '',
                visitCount: item.visitCount || 1,
              }))
            : [];
        historyCacheRef.current = items;
        const results = extractFrequentValues(field.urlTemplate!, items, field.key, {
          contextValues,
          maxResults: 12,
        });
        setHistorySuggestions(results);
        maybeAutoPrefillSingleSuggestion(index, currentFields, results);
      });
    },
    [buildHistoryContext, fields, maybeAutoPrefillSingleSuggestion],
  );

  useEffect(() => {
    if (historyForIndex === null) return;
    const field = fields[historyForIndex];
    if (!field?.urlTemplate) return;

    const timer = window.setTimeout(() => {
      fetchHistorySuggestions(historyForIndex, fields);
    }, 140);

    return () => window.clearTimeout(timer);
  }, [fields, historyForIndex, fetchHistorySuggestions]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (activeDropdown === index && editingDropdownIndex !== index) {
      if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    const isTextarea = e.currentTarget instanceof HTMLTextAreaElement;
    const isInput = e.currentTarget instanceof HTMLInputElement;
    const { selectionStart, value } = e.currentTarget as HTMLInputElement | HTMLTextAreaElement;

    if (e.key === 'Backspace') {
      if (index === 0 && selectionStart === 0 && !value) {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
        return;
      }
    }

    if (e.key === 'Enter') {
      if (isTextarea) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          e.stopPropagation();
          if (index === fields.length - 1) {
            onExecute();
          } else {
            onFocusChange(index + 1);
          }
        }
      } else {
        e.preventDefault();
        e.stopPropagation();
        if (index === fields.length - 1) {
          onExecute();
        } else {
          onFocusChange(index + 1);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (activeDropdown !== null) {
        setActiveDropdown(null);
        return;
      }
      onCancel();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      // Navigate to NEXT field if at the end of current field
      if (selectionStart === value.length) {
        if (index < fields.length - 1) {
          e.preventDefault();
          onFocusChange(index + 1);
        }
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      // Navigate to PREVIOUS field if at the start of current field
      if (selectionStart === 0) {
        if (index > 0) {
          e.preventDefault();
          onFocusChange(index - 1);
        }
      }
    }
  };

  const shouldUseLongTextInput = (field: AutomationInputField): boolean => {
    if (field.type === 'image') return false;
    if (field.inputStyle === 'long_text') return true;
    if (field.inputStyle === 'short_text') return false;

    const probe = `${field.key || ''} ${field.label || ''}`.toLowerCase();
    const looksLongByName = /(description|details|summary|body|message|content|prompt|note|reason)/.test(probe);
    if (looksLongByName) return true;

    const currentValue = String(field.value || '');
    return currentValue.includes('\n') || currentValue.length > 140;
  };

  const getCompactInputWidthCh = (field: AutomationInputField) => {
    const valueLength = String(field.value || '').length;
    // Allow up to 80 chars for the placeholder to be fully visible (nearly full-width)
    // Using a more generous +12 for characters to account for wide fonts and "Enter ..." prefix
    const placeholderLength = Math.min(String(field.label || field.key || '').length + 12, 80);
    // Expand the overall max width to 84 chars to fit the wider 740px max-width constraint
    return Math.min(84, Math.max(12, Math.max(valueLength + 1, placeholderLength)));
  };

  const appendImages = useCallback(
    (index: number, existing: AutomationInputField['images'] | undefined, files: File[]) => {
      if (!onImagesChange || files.length === 0) return;
      const newFiles = files.map(file => ({
        url: URL.createObjectURL(file),
        file,
        filename: file.name,
        mimeType: file.type,
      }));
      onImagesChange(index, [...(existing || []), ...newFiles].slice(0, 8));
    },
    [onImagesChange],
  );

  const handleImagePaste = useCallback(
    (e: React.ClipboardEvent, index: number, existing: AutomationInputField['images'] | undefined) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file' && items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        appendImages(index, existing, files);
      }
    },
    [appendImages],
  );

  const handleImageInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, index: number, existing: AutomationInputField['images'] | undefined) => {
      if (!e.target.files) return;
      appendImages(index, existing, Array.from(e.target.files));
      e.target.value = '';
    },
    [appendImages],
  );

  const hasLongTextField = fields.some(field => shouldUseLongTextInput(field));
  const containerWidthClass = 'w-[740px] max-w-[90vw]';
  const layoutClass = headless ? 'flex flex-col items-start gap-y-1.5' : 'flex flex-col items-start gap-y-4';
  const orderedFields = useMemo(() => {
    const withIndex = fields.map((field, index) => ({ field, index }));
    const nonImages = withIndex.filter(item => item.field.type !== 'image');
    const images = withIndex.filter(item => item.field.type === 'image');
    return [...nonImages, ...images];
  }, [fields]);
  const imageFieldEntry = orderedFields.find(entry => entry.field.type === 'image');
  const imageFieldIndex = imageFieldEntry?.index ?? null;
  const imageField = imageFieldEntry?.field ?? null;
  const attachmentHostEntry = orderedFields.find(
    entry => entry.field.type !== 'image' && shouldUseLongTextInput(entry.field),
  );
  const attachmentHostIndex = attachmentHostEntry?.index ?? null;
  const shouldInlineImages = imageFieldIndex !== null && attachmentHostIndex !== null;

  return (
    <div className={headless ? `relative w-full ${layoutClass}` : 'fixed inset-0 z-[9999] pointer-events-none'}>
      <div
        className={headless ? `w-full ${layoutClass}` : 'pointer-events-auto fixed left-1/2'}
        style={
          headless
            ? {}
            : {
                top: anchorY ? `${anchorY + 48}px` : '50%',
                transform: 'translate(-50%, -50%)',
              }
        }>
        <div
          className={
            headless
              ? `w-full ${layoutClass}`
              : `${layoutClass} ${containerWidthClass} bg-white/40 dark:bg-black/40 backdrop-blur-3xl rounded-xl border border-white/40 dark:border-white/10 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300 relative p-3 pr-9`
          }>
          {/* Automation Header - Relocated to top (Absolute) - Hidden in headless mode */}
          {!headless && (
            <div className="absolute bottom-full left-[12px] flex justify-start pb-2 pointer-events-none mb-0.5">
              <div className="z-20 flex flex-col items-start transition-all duration-300 pointer-events-auto scale-90 origin-left">
                <div
                  className={`flex items-center gap-2 border rounded-lg px-2 py-0.5 bg-neutral-800 border-neutral-700 dark:bg-neutral-800 dark:border-neutral-700`}>
                  <div className="w-4 h-4 flex items-center justify-center">
                    <AutomationDynamicIcon automation={iconAutomation} size={14} />
                  </div>
                  <span
                    className="max-w-[140px] truncate text-[12px] font-semibold text-neutral-300 dark:text-neutral-300"
                    title={title}>
                    {title}
                  </span>
                  <button
                    type="button"
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      onCancel();
                    }}
                    className={`cursor-pointer p-0.5 rounded-md transition-all ${isDarkMode ? 'text-neutral-500 hover:text-red-400 hover:bg-neutral-200/10' : 'text-[#586e75] hover:text-red-500 hover:bg-neutral-200'}`}
                    title="Close">
                    <FaTimes size={10} />
                  </button>
                </div>

                {/* Dynamic subtitle for the active field name (moved to next line) */}
                <AnimatePresence mode="wait">
                  {focusedFieldIndex !== -1 && fields[focusedFieldIndex] && (
                    <motion.div
                      key={`subtitle-${focusedFieldIndex}`}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium truncate mt-0.5">
                      {fields[focusedFieldIndex].label}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Input Fields Area - Scrollable */}
          <div
            className={`overflow-y-auto w-full relative custom-scrollbar ${headless ? 'max-h-[min(600px,70vh)] pb-1' : 'max-h-[80vh]'}`}>
            <div
              className={`flex flex-wrap items-start animate-in fade-in slide-in-from-top-2 duration-300 ${headless ? 'gap-x-4 gap-y-2' : 'gap-4'} w-full pr-1 pb-4`}>
              {orderedFields.map((entry, displayIndex) => {
                const { field, index } = entry;
                const hasDropdown =
                  field.type === 'dropdown' ||
                  (field.dropdownOptions && field.dropdownOptions.length > 0) ||
                  (field.dropdownOptionPairs && field.dropdownOptionPairs.length > 0);
                const hasHistoryUrl = !!field.urlTemplate;
                const isImage = field.type === 'image';
                const fieldValue = field.value || '';
                const useTextArea = shouldUseLongTextInput(field);
                const isCompactField = !isImage && !useTextArea;
                const optionPairs = !isImage ? getOptionPairsForField(field) : [];
                const predefinedItems = hasDropdown
                  ? optionPairs.map((pair, pairIndex) => ({
                      id: `opt-${index}-${pairIndex}-${pair.value}`,
                      label: pair.key || `Option ${pairIndex + 1}`,
                      value: pair.value,
                      kind: 'option' as const,
                    }))
                  : [];
                const historyItemsForField =
                  hasHistoryUrl && historyForIndex === index && historySuggestions.length > 0
                    ? historySuggestions.map((suggestion, sIdx) => ({
                        id: `hist-${index}-${sIdx}-${suggestion.value}`,
                        label: suggestion.title !== suggestion.value ? suggestion.title : 'History',
                        value: suggestion.value,
                        kind: 'history' as const,
                      }))
                    : [];

                const dropdownItems: AutomationSuggestionsListItem[] = [...predefinedItems, ...historyItemsForField];
                const uniqueValues = Array.from(new Set(dropdownItems.map(item => item.value)));
                const hasVisibleSuggestions = uniqueValues.length > 0;
                const hasMultipleSuggestions = uniqueValues.length > 1;
                const hasSuggestionPanel = hasDropdown || hasHistoryUrl;
                const compactWidthCh = isCompactField ? getCompactInputWidthCh(field) : 0;
                const inputRightPadding = isCompactField ? 'pr-8' : 'pr-12';
                const currentGroupId = field.groupId || field.key;
                const prevField = displayIndex > 0 ? orderedFields[displayIndex - 1].field : null;
                const nextField =
                  displayIndex < orderedFields.length - 1 ? orderedFields[displayIndex + 1].field : null;
                const sharesGroupWithPrevious = prevField && (prevField.groupId || prevField.key) === currentGroupId;
                const sharesGroupWithNext = nextField && (nextField.groupId || nextField.key) === currentGroupId;
                const hasVisualGroup =
                  !useTextArea && (sharesGroupWithPrevious || sharesGroupWithNext || !!field.groupLabel);
                const showGroupHeader = !sharesGroupWithPrevious && hasVisualGroup;

                // Force VERTICAL stacking for grouped fields (even short_text)
                const isGroupedField = hasVisualGroup;
                const forcedVerticalStacking = hasLongTextField || isGroupedField;

                // If ANY field is long text OR grouped, FORCE everything to vertical stack (100% width)
                const dynamicBasis = forcedVerticalStacking
                  ? '100%'
                  : isCompactField
                    ? `${Math.min(740, Math.max(200, compactWidthCh * 9 + 40))}px`
                    : '100%';
                const containerClasses = forcedVerticalStacking
                  ? 'flex items-start gap-3 w-full min-w-0'
                  : isCompactField
                    ? 'flex items-center gap-2 max-w-[740px]'
                    : 'flex items-start gap-3 w-full min-w-0';
                const groupWrapperClasses = useTextArea
                  ? ''
                  : !hasVisualGroup
                    ? ''
                    : sharesGroupWithPrevious
                      ? sharesGroupWithNext
                        ? 'border-x border-neutral-200 dark:border-neutral-800 px-3 py-2'
                        : 'border-x border-b border-neutral-200 dark:border-neutral-800 rounded-b-2xl px-3 pt-2 pb-3'
                      : sharesGroupWithNext
                        ? 'border-x border-t border-neutral-200 dark:border-neutral-800 rounded-t-2xl px-3 pt-3 pb-2'
                        : 'border border-neutral-200 dark:border-neutral-800 rounded-2xl px-3 py-3';
                const showInlineImagePicker = shouldInlineImages && attachmentHostIndex === index;

                if (isImage) {
                  return (
                    <div
                      key={field.key}
                      className={`${isCompactField ? 'flex-none' : 'w-full'} ${groupWrapperClasses} min-w-0`}
                      style={{ flexBasis: dynamicBasis }}>
                      <div className="flex items-center gap-2" onPaste={e => handleImagePaste(e, index, field.images)}>
                        {field.images && field.images.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1">
                            {field.images.map((img, imgIdx) => (
                              <div
                                key={img.url}
                                className="group relative w-6 h-6 rounded-md overflow-hidden border border-neutral-200 dark:border-white/10 ring-1 ring-black/5 shadow-sm">
                                <img src={img.url} alt="" className="w-full h-full object-cover" />
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    const newImages = field.images!.filter((_, i) => i !== imgIdx);
                                    URL.revokeObjectURL(img.url);
                                    onImagesChange?.(index, newImages);
                                  }}
                                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <FaTimes size={8} className="text-white" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          type="button"
                          className="flex items-center justify-center w-7 h-7 rounded-full text-neutral-400 hover:text-neutral-500 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                          onClick={() => {
                            onFocusChange(index);
                            fileInputRefs.current[index]?.click();
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              fileInputRefs.current[index]?.click();
                              return;
                            }
                            handleKeyDown(e, index);
                          }}
                          ref={el => {
                            inputRefs.current[index] = el;
                          }}
                          aria-label="Add images">
                          <GoPaperclip size={14} />
                        </button>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          className="hidden"
                          ref={el => {
                            fileInputRefs.current[index] = el;
                          }}
                          onChange={e => handleImageInputChange(e, index, field.images)}
                        />
                      </div>
                    </div>
                  );
                }
                if (field.sourceType === 'constant') {
                  const hasDescription = !!field.description;
                  const isSelectable = hasMultipleSuggestions;

                  return (
                    <div
                      key={field.key}
                      className={`${isCompactField ? 'flex-none' : 'w-full'} ${groupWrapperClasses} min-w-0`}
                      style={{ flexBasis: dynamicBasis }}>
                      {showGroupHeader && (
                        <div className="flex items-center gap-2 pr-2 pb-2 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500">
                            {field.groupLabel || 'Preset'}
                          </span>
                        </div>
                      )}

                      <div className={containerClasses}>
                        <div className="flex flex-col gap-1 w-full max-w-[680px]">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-tight">
                              Preset: {field.label}
                            </span>
                            <div className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800/50" />
                          </div>

                          <div className="relative group w-full">
                            <div
                              onClick={() => {
                                if (isSelectable) {
                                  setActiveDropdown(activeDropdown === index ? null : index);
                                }
                              }}
                              className={`group/preset px-4 py-2 rounded-xl border border-dashed ${
                                isSelectable
                                  ? 'border-blue-300 dark:border-blue-500/50 bg-blue-50/10 hover:bg-blue-50/20 cursor-pointer'
                                  : 'border-neutral-300 dark:border-neutral-800 bg-neutral-50/50 dark:bg-white/5 cursor-default'
                              } opacity-80 select-none transition-all flex items-center justify-between`}>
                              <span
                                className={`text-[13px] font-medium ${isDarkMode ? 'text-white' : 'text-[#073642]'}`}>
                                {fieldValue || '(Empty)'}
                              </span>
                              {isSelectable && (
                                <FaChevronDown
                                  size={10}
                                  className={`text-[var(--color-iconDefault)] transition-transform ${
                                    activeDropdown === index ? 'rotate-180' : ''
                                  }`}
                                />
                              )}
                            </div>

                            <AnimatePresence>
                              {activeDropdown === index && hasVisibleSuggestions && (
                                <>
                                  <div className="fixed inset-0 z-[60]" onClick={() => setActiveDropdown(null)} />
                                  <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    className="absolute left-0 top-full mt-1 z-[70] min-w-full w-max max-w-[min(480px,90vw)] bg-white dark:bg-neutral-900/90 backdrop-blur-md border border-neutral-300 dark:border-neutral-500 rounded-xl shadow-2xl overflow-hidden py-1">
                                    <AutomationSuggestionsList
                                      items={dropdownItems}
                                      query=""
                                      selectedValue={field.value}
                                      onSelect={value => {
                                        onFieldChange(index, value);
                                        setActiveDropdown(null);
                                      }}
                                      onClose={() => setActiveDropdown(null)}
                                    />
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>
                          </div>

                          {hasDescription && (
                            <div className="mt-0.5 px-1 flex items-start gap-1.5 opacity-60">
                              <LuInfo size={10} className="mt-0.5 text-[var(--color-iconDefault)]" />
                              <span className="text-[10px] font-medium text-neutral-400 leading-tight">
                                {field.description}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={field.key}
                    className={`${isCompactField ? 'flex-none' : 'w-full'} ${groupWrapperClasses} min-w-0`}
                    style={{ flexBasis: dynamicBasis }}>
                    {showGroupHeader && (
                      <div className="flex items-center gap-2 pr-2 pb-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500">
                          {field.groupLabel || 'Input'}
                        </span>
                      </div>
                    )}

                    <div className={containerClasses}>
                      <div
                        className={
                          isCompactField
                            ? 'min-w-0 max-w-[360px] w-auto'
                            : useTextArea
                              ? 'min-w-0 max-w-[680px] w-full'
                              : 'min-w-0 max-w-[560px] w-auto'
                        }>
                        <div className="relative group w-full">
                          {useTextArea ? (
                            <textarea
                              ref={el => {
                                inputRefs.current[index] = el;
                              }}
                              value={fieldValue}
                              onChange={e => {
                                onFieldChange(index, e.target.value);
                                if (hasSuggestionPanel) {
                                  setActiveDropdown(index);
                                }
                              }}
                              onKeyDown={e => handleKeyDown(e, index)}
                              onFocus={() => {
                                onFocusChange(index);
                                if (hasSuggestionPanel) {
                                  if (hasHistoryUrl) {
                                    fetchHistorySuggestions(index);
                                  }
                                  if (!fieldValue && uniqueValues.length === 1) {
                                    onFieldChange(index, uniqueValues[0]);
                                  } else if (hasVisibleSuggestions) {
                                    setActiveDropdown(index);
                                  }
                                }
                              }}
                              onPaste={e => {
                                if (showInlineImagePicker && imageFieldIndex !== null) {
                                  handleImagePaste(e, imageFieldIndex, imageField?.images);
                                }
                              }}
                              onDoubleClick={() => setExpandedFieldIndex(index)}
                              rows={Math.min(10, Math.max(5, fieldValue.split('\n').length || 1))}
                              className={`min-h-[120px] py-2 ${activeDropdown === index && hasVisibleSuggestions ? 'rounded-t-xl rounded-b-none' : 'rounded-xl'} text-[14px] leading-relaxed font-medium transition-all duration-200 outline-none resize-none 
                                ${
                                  headless
                                    ? 'border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-black/20'
                                    : 'border border-neutral-300 dark:border-neutral-700 bg-black'
                                } 
                                ${isDarkMode ? 'text-neutral-200' : 'text-[#073642]'} px-4 placeholder:text-neutral-500 hover:border-neutral-400 dark:hover:border-neutral-600 focus:border-neutral-400 dark:focus:border-neutral-500 ${inputRightPadding}`}
                              style={{
                                width: '100%',
                                minWidth: isCompactField ? '120px' : '200px',
                                maxWidth: '100%',
                              }}
                              placeholder={
                                isSingleField
                                  ? resolvePlaceholderFromCmd(automation?.id) || 'Type here...'
                                  : `Enter ${field.label.toLowerCase()}`
                              }
                              title="Ctrl+Enter to run"
                            />
                          ) : (
                            <input
                              ref={el => {
                                inputRefs.current[index] = el;
                              }}
                              type="text"
                              value={fieldValue}
                              onChange={e => {
                                onFieldChange(index, e.target.value);
                                if (hasSuggestionPanel) {
                                  setActiveDropdown(index);
                                }
                              }}
                              onKeyDown={e => handleKeyDown(e, index)}
                              onFocus={() => {
                                onFocusChange(index);
                                if (hasSuggestionPanel) {
                                  if (hasHistoryUrl) {
                                    fetchHistorySuggestions(index);
                                  }
                                  if (!fieldValue && uniqueValues.length === 1) {
                                    onFieldChange(index, uniqueValues[0]);
                                  } else if (hasVisibleSuggestions) {
                                    setActiveDropdown(index);
                                  }
                                }
                              }}
                              onDoubleClick={() => setExpandedFieldIndex(index)}
                              className={`${
                                isCompactField
                                  ? `h-8 py-0 ${activeDropdown === index && hasVisibleSuggestions ? 'rounded-t-md rounded-b-none' : 'rounded-md'} text-[12px]`
                                  : `w-full h-9 py-0 ${activeDropdown === index && hasVisibleSuggestions ? 'rounded-t-xl rounded-b-none' : 'rounded-xl'} text-[13px]`
                              } font-medium transition-all duration-200 outline-none 
                                ${
                                  headless
                                    ? 'border border-neutral-300 dark:border-neutral-800 bg-neutral-100 dark:bg-black/20'
                                    : 'border border-neutral-300 dark:border-neutral-700 bg-black'
                                }
                                ${isDarkMode ? 'text-neutral-200' : 'text-[#073642]'} px-4 placeholder:text-neutral-500 hover:border-neutral-400 dark:hover:border-neutral-600 focus:border-neutral-400 dark:focus:border-neutral-500 ${inputRightPadding}`}
                              style={{
                                ...(isCompactField
                                  ? {
                                      width: `${getCompactInputWidthCh(field)}ch`,
                                      minWidth: '120px',
                                      maxWidth: '350px',
                                    }
                                  : { width: '100%' }),
                              }}
                              placeholder={`Enter ${field.label.toLowerCase()}`}
                              title="Double-click to expand"
                            />
                          )}

                          {hasMultipleSuggestions && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                              <FaChevronDown size={8} className="text-[var(--color-iconDefault)] opacity-60" />
                            </div>
                          )}

                          {showInlineImagePicker && imageField && imageFieldIndex !== null && (
                            <div className="absolute -top-2 right-0 z-10 flex items-center gap-2">
                              {imageField.images && imageField.images.length > 0 && (
                                <div className="flex items-center gap-1">
                                  {imageField.images.map((img, imgIdx) => (
                                    <div
                                      key={img.url}
                                      className="group relative w-6 h-6 rounded-md overflow-hidden border border-neutral-200 dark:border-white/10 ring-1 ring-black/5 shadow-sm">
                                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                                      <button
                                        onClick={e => {
                                          e.stopPropagation();
                                          const newImages = imageField.images!.filter((_, i) => i !== imgIdx);
                                          URL.revokeObjectURL(img.url);
                                          onImagesChange?.(imageFieldIndex, newImages);
                                        }}
                                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                        <FaTimes size={8} className="text-white" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <button
                                type="button"
                                className="flex items-center justify-center w-7 h-7 rounded-full text-neutral-400 hover:text-neutral-500 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                                onClick={() => {
                                  fileInputRefs.current[imageFieldIndex]?.click();
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    fileInputRefs.current[imageFieldIndex]?.click();
                                    return;
                                  }
                                  handleKeyDown(e, imageFieldIndex);
                                }}
                                ref={el => {
                                  inputRefs.current[imageFieldIndex] = el;
                                }}
                                aria-label="Add images">
                                <GoPaperclip size={14} />
                              </button>
                              <input
                                type="file"
                                multiple
                                accept="image/*"
                                className="hidden"
                                ref={el => {
                                  fileInputRefs.current[imageFieldIndex] = el;
                                }}
                                onChange={e => handleImageInputChange(e, imageFieldIndex, imageField.images)}
                              />
                            </div>
                          )}

                          <AnimatePresence>
                            {activeDropdown === index && hasVisibleSuggestions && (
                              <>
                                <div className="fixed inset-0 z-[60]" onClick={() => setActiveDropdown(null)} />
                                <motion.div
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  exit={{ opacity: 0 }}
                                  className="absolute left-0 top-full z-[70] min-w-full w-max max-w-[min(480px,90vw)] bg-white dark:bg-neutral-900/90 backdrop-blur-md border border-neutral-300 dark:border-neutral-500 border-t-0 rounded-t-none rounded-b-xl shadow-2xl overflow-hidden py-1">
                                  {editingDropdownIndex === index ? (
                                    <>
                                      <div className="grid grid-cols-[1.2fr_1fr] px-3 py-1 text-[10px] font-bold text-neutral-400 border-y border-neutral-100 dark:border-neutral-800">
                                        <div className="pr-2">Name</div>
                                        <div className="pl-2 border-l border-neutral-200 dark:border-neutral-700">
                                          Value
                                        </div>
                                      </div>
                                      <div className="max-h-44 overflow-y-auto custom-scrollbar">
                                        {editingDropdownRows.map((row, rowIndex) => (
                                          <div
                                            key={row.id}
                                            className="w-full grid grid-cols-[1.2fr_1fr] items-center px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 border-b border-neutral-100 dark:border-neutral-800">
                                            <input
                                              value={row.key}
                                              onChange={e => updateDropdownRow(row.id, 'key', e.target.value)}
                                              placeholder={`Option ${rowIndex + 1}`}
                                              className="bg-transparent outline-none pr-2"
                                            />
                                            <input
                                              value={row.value}
                                              onChange={e => updateDropdownRow(row.id, 'value', e.target.value)}
                                              placeholder="Value"
                                              className="bg-transparent outline-none pl-2 border-l border-neutral-200 dark:border-neutral-700"
                                            />
                                          </div>
                                        ))}
                                      </div>
                                      <div className="flex items-center justify-between px-3 py-1.5">
                                        <button
                                          type="button"
                                          onClick={addDropdownRow}
                                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                                          title="Add row">
                                          <FaPlus size={9} />
                                          Add
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => saveDropdownRows(index)}
                                          className="px-2 py-1 rounded-md text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors">
                                          Save
                                        </button>
                                      </div>
                                    </>
                                  ) : (
                                    <AutomationSuggestionsList
                                      items={dropdownItems}
                                      query={fieldValue}
                                      selectedValue={field.value}
                                      onSelect={value => {
                                        onFieldChange(index, value);
                                        setActiveDropdown(null);
                                      }}
                                      onClose={() => setActiveDropdown(null)}
                                      onEdit={hasDropdown ? () => beginDropdownEditing(index) : undefined}
                                    />
                                  )}
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Submission Area - Positioned dynamically following the inputs (shifted left slightly) */}
            <div className="flex justify-end items-center gap-3 pr-32 mt-2 mb-1 w-full flex-shrink-0">
              <span className="text-[10px] font-bold text-neutral-400/80 dark:text-neutral-500/80 uppercase tracking-[0.2em] select-none pointer-events-none">
                Ctrl + Enter
              </span>
              <button
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  onExecute();
                }}
                className="pointer-events-auto flex items-center justify-center w-8 h-8 rounded-lg bg-white/20 dark:bg-black/20 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-neutral-50 dark:hover:bg-neutral-900 hover:scale-105 active:scale-95 shadow-sm transition-all "
                title="Run Automation (Ctrl+Enter)">
                <PiPaperPlaneRightFill size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* <button
            onClick={onCancel}
            className="absolute -top-6 -right-6 p-1.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-all z-10"
            title="Close">
            <FaTimes size={14} />
          </button> */}

        <AnimatePresence>
          {expandedFieldIndex !== null && fields[expandedFieldIndex] && fields[expandedFieldIndex].type !== 'image' && (
            <ExpandedTextarea
              label={fields[expandedFieldIndex].label}
              value={fields[expandedFieldIndex].value}
              onChange={newValue => onFieldChange(expandedFieldIndex, newValue)}
              onClose={() => setExpandedFieldIndex(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AutomationDataEntry;
