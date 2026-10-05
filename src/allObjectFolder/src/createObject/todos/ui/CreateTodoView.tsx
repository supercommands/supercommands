import TextExpanderIcon from '../../../../../shared-components/icons/TextExpanderIcon';
import type { ShortcutAssignmentApproval } from '../../../../../shared-components/shortcuts/core/shortcutAssignmentTypes';
import { EditorBackButton } from '../../../../../shared-components/editorContainer/EditorBackButton';
import { FUNCTIONAL_EDITOR_SURFACE_STYLE, PURE_BLACK_EDITOR_BACKGROUND } from '../../../../../shared-components/editorContainer/functionalEditorSurfaceStyle';
import * as React from 'react';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { BRAND } from '../../../../../shared-components/brandingConfig';
import { FaUser, FaRegCalendarAlt, FaRegClock, FaPlus, FaBolt, FaTimes, FaCheck, FaStar, FaKeyboard, } from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import { FiClock, FiFileText, FiRepeat, FiSearch, FiLink, FiCheckSquare, FiFolder, FiChevronDown, FiStar, FiTag, FiCopy } from 'react-icons/fi';
import { format, formatDistanceToNow, isToday, isTomorrow, addDays } from 'date-fns';
import { clsx } from 'clsx';
import { BsCalendarCheck } from 'react-icons/bs';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { getFaviconUrl } from '../../../../../shared-components/searchBarMain/utilityFunctions/utils';
import { useAppearance } from '@extension/ui';
import { EditorContainer } from '../../../../../shared-components/editorContainer/EditorContainer';
import { EditorHeader } from '../../../../../shared-components/editorContainer/EditorHeader';
import { EditorTopRightChrome } from '../../../../../shared-components/editorContainer/EditorTopRightChrome';
import { WorkspaceEditorLayout } from '../../../../../shared-components/editorContainer/WorkspaceEditorLayout';
import { EditorTitleShortcutInput } from '../../../../../shared-components/editorContainer/EditorTitleShortcutInput';
import { ExistingItemsTable } from '../../../../../shared-components/editorContainer/ExistingItemsTable';
import { RightSideItemsPanel } from '../../../../../shared-components/editorContainer/RightSideItemsPanel';
import { TodoCollectionSheetView, type TodoSheetGroupingMode, } from '../../../../../shared-components/todosSheet/TodoCollectionSheetView';
import { isTodoKeyboardEventWithin } from '../../../../../shared-components/todosSheet/todoKeyboardOwnership';
import { useFavorites } from '../../../../../shared-components/favorites/favoriteHooks';
import { getItemCompoundId, readAllShortcuts } from '../../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { saveHotkey as apiSaveHotkey, clearHotkey as apiClearHotkey, HotkeyAssignButton, } from '../../../../../shared-components/hotkeys';
import { SharedPropertiesToolbar } from '../../../../../shared-components/editorToolbar/SharedPropertiesToolbar';
import { useShortcutValidation, saveShortcut, clearShortcut } from '../../../../../shared-components/shortcuts';
import type { TodoRecord } from '../todoTypes';
import { updateTodo, updateTodoContent, deleteTodo, mapTodoReferences } from '../todoData';
import NotesIcon from '../../../../../shared-components/icons/notesIcon';
import StackedLinkIcon from '../../../../../shared-components/icons/stackedLinkIcon';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { createTag } from '../../../../../allObjectFolder/src/createObject/tags/tagData';
import { useTodoEditor } from '../useTodoEditor';
import { AutoSaveIndicator } from '../../../../../shared-components/autoSaveEngine/autoSave';
import DeleteConfirmation from '../../../../../shared-components/modals/deleteDialog';
import { NewDueDateDropdown } from './newDueDateDropdown';
import { SessionGridIcon } from '../../../../../shared-components/icons/sessionGridIcon';
import { getStoredTodoSheetGroupingMode, setStoredTodoSheetGroupingMode, } from '../../../../../storage/localStorage/uxCustomizationStorage';
const TODO_EDITOR_DARK_APPEARANCE_TOKENS: React.CSSProperties = {
    colorScheme: 'dark',
    backgroundColor: PURE_BLACK_EDITOR_BACKGROUND,
    color: '#FFFFFF',
    '--color-editorBg': PURE_BLACK_EDITOR_BACKGROUND,
    '--color-inputBg': PURE_BLACK_EDITOR_BACKGROUND,
    '--color-containerBg': PURE_BLACK_EDITOR_BACKGROUND,
    '--color-panelBg': PURE_BLACK_EDITOR_BACKGROUND,
    '--color-cardBg': PURE_BLACK_EDITOR_BACKGROUND,
    '--color-popupBg': PURE_BLACK_EDITOR_BACKGROUND,
    '--color-innerPopupBg': PURE_BLACK_EDITOR_BACKGROUND,
    '--color-contextMenuBg': PURE_BLACK_EDITOR_BACKGROUND,
    '--color-textPrimary': '#FFFFFF',
    '--color-textSecondary': '#D4D4D4',
    '--color-textMuted': '#737373',
    '--color-textPlaceholder': '#A3A3A3',
    '--color-iconDefault': '#9CA3AF',
    '--color-borderDefault': 'rgba(255, 255, 255, 0.1)',
    '--color-borderActive': 'rgba(255, 255, 255, 0.2)',
    '--color-hoverBg': 'rgba(255, 255, 255, 0.05)',
    '--color-selectedBg': 'rgba(255, 255, 255, 0.07)',
} as React.CSSProperties;
interface InlineTimeInputProps {
    value: string; // 'HH:mm' in 24h
    onChange: (val: string) => void;
    onExitRight: () => void;
    onExitLeft: () => void;
}
const GroupingFilterIcon: React.FC<{
    size?: number;
    className?: string;
}> = ({ size = 16, className }) => (<svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
    <path d="M3.5 5h9M5.5 8h5M7 11h2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
  </svg>);
const InlineTimeInput: React.FC<InlineTimeInputProps> = ({ value, onChange, onExitRight, onExitLeft }) => {
    let [hh, mm] = (value || '09:00').split(':');
    let hr24 = parseInt(hh, 10);
    const isPM = hr24 >= 12;
    let hr12 = hr24 % 12 || 12;
    const hrRef = useRef<HTMLInputElement>(null);
    const minRef = useRef<HTMLInputElement>(null);
    const ampmRef = useRef<HTMLInputElement>(null);
    const updateTime = (newHr12: number, newMin: string, newIsPM: boolean) => {
        let finalHr24 = newHr12;
        if (newIsPM && newHr12 < 12)
            finalHr24 += 12;
        if (!newIsPM && newHr12 === 12)
            finalHr24 = 0;
        onChange(`${String(finalHr24).padStart(2, '0')}:${newMin}`);
    };
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
    };
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, segment: 'hr' | 'min' | 'ampm') => {
        if (e.key === 'ArrowRight') {
            if (segment === 'hr' && hrRef.current?.selectionEnd === hrRef.current?.value.length) {
                e.preventDefault();
                minRef.current?.focus();
            }
            else if (segment === 'min' && minRef.current?.selectionEnd === minRef.current?.value.length) {
                e.preventDefault();
                ampmRef.current?.focus();
            }
            else if (segment === 'ampm' && ampmRef.current?.selectionEnd === ampmRef.current?.value.length) {
                e.preventDefault();
                onExitRight();
            }
        }
        else if (e.key === 'ArrowLeft') {
            if (segment === 'ampm' && ampmRef.current?.selectionStart === 0) {
                e.preventDefault();
                minRef.current?.focus();
            }
            else if (segment === 'min' && minRef.current?.selectionStart === 0) {
                e.preventDefault();
                hrRef.current?.focus();
            }
            else if (segment === 'hr' && hrRef.current?.selectionStart === 0) {
                e.preventDefault();
                onExitLeft();
            }
        }
        else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            if (segment === 'hr')
                updateTime(e.key === 'ArrowUp' ? (hr12 === 12 ? 1 : hr12 + 1) : hr12 === 1 ? 12 : hr12 - 1, mm, isPM);
            else if (segment === 'min') {
                let m = parseInt(mm, 10);
                m = e.key === 'ArrowUp' ? (m + 1) % 60 : (m - 1 + 60) % 60;
                updateTime(hr12, String(m).padStart(2, '0'), isPM);
            }
            else if (segment === 'ampm' && ampmRef.current)
                updateTime(hr12, mm, !isPM);
        }
    };
    return (<div className="flex items-center text-white inline-time-input" onClick={e => e.stopPropagation()}>
      <input id="time-input-field" ref={hrRef} type="text" value={String(hr12).padStart(2, '0')} onChange={e => {
            const val = e.target.value.replace(/[^0-9]/g, '');
            if (val) {
                let num = parseInt(val, 10);
                if (num > 12)
                    num = parseInt(val.slice(-1), 10);
                if (num === 0 && val.length > 1)
                    num = 12;
                updateTime(num || 12, mm, isPM);
                if (val.length === 2 && num >= 1)
                    minRef.current?.focus();
            }
        }} onFocus={handleFocus} onKeyDown={e => handleKeyDown(e, 'hr')} className="w-[18px] bg-transparent text-center outline-none selection:bg-blue-500/40 caret-transparent focus:bg-white/10 rounded-sm"/>
      <span className="opacity-50 pb-[2px]">:</span>
      <input ref={minRef} type="text" value={mm} onChange={e => {
            const val = e.target.value.replace(/[^0-9]/g, '');
            if (val) {
                let num = parseInt(val, 10);
                if (num > 59)
                    num = parseInt(val.slice(-1), 10);
                updateTime(hr12, String(num).padStart(2, '0'), isPM);
                if (val.length === 2)
                    ampmRef.current?.focus();
            }
        }} onFocus={handleFocus} onKeyDown={e => handleKeyDown(e, 'min')} className="w-[18px] bg-transparent text-center outline-none selection:bg-blue-500/40 caret-transparent focus:bg-white/10 rounded-sm"/>
      <input ref={ampmRef} type="text" value={isPM ? 'PM' : 'AM'} onChange={e => {
            const val = e.target.value.toUpperCase();
            if (val.includes('A'))
                updateTime(hr12, mm, false);
            if (val.includes('P'))
                updateTime(hr12, mm, true);
        }} onFocus={handleFocus} onKeyDown={e => handleKeyDown(e, 'ampm')} className="w-[22px] ml-1 bg-transparent text-center outline-none selection:bg-blue-500/40 caret-transparent focus:bg-white/10 rounded-sm text-[11px] font-bold tracking-wider"/>
    </div>);
};
interface CustomTimePickerProps {
    value: string; // 'HH:mm'
    onChange: (val: string) => void;
    isOpen: boolean;
    setIsOpen: (val: boolean) => void;
    focusedColumn?: number; // 0: hr, 1: min, 2: ampm
    focusedBlock?: number; // 0: anytime, 1: specific
    isAnytime?: boolean;
    onAnytimeChange?: (val: boolean) => void;
}
const CustomTimePicker: React.FC<CustomTimePickerProps> = ({ value, onChange, isOpen, setIsOpen, focusedColumn = -1, focusedBlock = -1, isAnytime = false, onAnytimeChange, }) => {
    const popupRef = useRef<HTMLDivElement>(null);
    const hourInputRef = useRef<HTMLInputElement>(null);
    const minInputRef = useRef<HTMLInputElement>(null);
    const amBtnRef = useRef<HTMLButtonElement>(null);
    const pmBtnRef = useRef<HTMLButtonElement>(null);
    // Local state for inputs to allow typing before committing
    const [localHr, setLocalHr] = React.useState('');
    const [localMin, setLocalMin] = React.useState('');
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, setIsOpen]);
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isOpen && !isAnytime) {
            // Short delay to ensure it renders and isn't blocked by transitions
            timer = setTimeout(() => {
                hourInputRef.current?.focus();
                hourInputRef.current?.select(); // Select text for quick overwrite
            }, 50);
        }
        return () => {
            if (timer)
                clearTimeout(timer);
        };
    }, [isOpen, isAnytime]);
    // Sync local inputs when value changes from outside
    useEffect(() => {
        let [hh, mm] = (value || '09:00').split(':');
        if (!hh)
            hh = '09';
        if (!mm)
            mm = '00';
        let hrNum = parseInt(hh, 10);
        let hr12 = hrNum % 12;
        if (hr12 === 0)
            hr12 = 12;
        setLocalHr(String(hr12).padStart(2, '0'));
        setLocalMin(mm);
    }, [value]);
    if (!isOpen)
        return null;
    let [hh, mm] = (value || '09:00').split(':');
    if (!hh)
        hh = '09';
    if (!mm)
        mm = '00';
    let hrNum = parseInt(hh, 10);
    const isPM = hrNum >= 12;
    let hr12 = hrNum % 12;
    if (hr12 === 0)
        hr12 = 12;
    const updateTime = (newHr12: number, newMin: string, newIsPM: boolean) => {
        let finalHr24 = newHr12;
        if (newIsPM && newHr12 < 12)
            finalHr24 += 12;
        if (!newIsPM && newHr12 === 12)
            finalHr24 = 0;
        onChange(`${String(finalHr24).padStart(2, '0')}:${newMin}`);
    };
    const handleMeridiemChange = (newIsPM: boolean) => updateTime(hr12, mm, newIsPM);
    const handleHourBlur = () => {
        let parsed = parseInt(localHr, 10);
        if (isNaN(parsed) || parsed < 1)
            parsed = 12;
        if (parsed > 12)
            parsed = 12;
        updateTime(parsed, mm, isPM);
    };
    const handleMinBlur = () => {
        let parsed = parseInt(localMin, 10);
        if (isNaN(parsed) || parsed < 0)
            parsed = 0;
        if (parsed > 59)
            parsed = 59;
        updateTime(hr12, String(parsed).padStart(2, '0'), isPM);
    };
    return (<div ref={popupRef} className="custom-time-picker-popup absolute left-0 bottom-full mb-2 w-[180px] bg-[#1c1d27]/95 backdrop-blur-md border border-white/10 rounded-xl p-1 shadow-2xl z-[150] flex flex-col gap-1 text-[var(--color-textPrimary)] font-sans" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
      {/* Anytime */}
      <div onClick={() => {
            onAnytimeChange?.(true);
        }} className={`px-2.5 py-2 rounded-lg border flex items-center gap-2.5 cursor-pointer transition-colors ${isAnytime ? 'border-blue-500/50' : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'} ${focusedBlock === 0 ? 'ring-1 ring-white/20 bg-white/5' : ''}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${isAnytime ? 'bg-blue-500 text-white' : 'bg-black/5 dark:bg-white/10 text-neutral-500 dark:text-neutral-400'}`}>
          <FiClock size={12}/>
        </div>
        <span className={`font-medium text-[13px] ${isAnytime ? 'text-blue-600 dark:text-blue-400' : 'text-[var(--color-textPrimary)]'}`}>
          Anytime
        </span>
      </div>

      {/* Specific time */}
      <div onClick={() => {
            onAnytimeChange?.(false);
        }} className={`px-2.5 py-2 rounded-lg border flex flex-col gap-2.5 cursor-pointer transition-colors ${!isAnytime ? 'border-blue-500/50' : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'} ${focusedBlock === 1 ? 'ring-1 ring-white/20 bg-white/5' : ''}`}>
        <div className="flex items-center gap-2.5">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${!isAnytime ? 'bg-blue-500 text-white' : 'bg-black/5 dark:bg-white/10 text-neutral-500 dark:text-neutral-400'}`}>
            <FiClock size={12}/>
          </div>
          <span className={`font-medium text-[13px] ${!isAnytime ? 'text-blue-600 dark:text-blue-400' : 'text-[var(--color-textPrimary)]'}`}>
            Specific time
          </span>
        </div>

        {!isAnytime && (<div className="flex items-center justify-center gap-1.5" onClick={e => e.stopPropagation()}>
            <input ref={hourInputRef} type="text" value={localHr} onChange={e => {
                const val = e.target.value;
                setLocalHr(val);
                const parsed = parseInt(val, 10);
                if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) {
                    updateTime(parsed, mm, isPM);
                }
            }} onBlur={handleHourBlur} onKeyDown={e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    setIsOpen(false);
                }
                else if (e.key === 'ArrowRight' && e.currentTarget.selectionStart === e.currentTarget.value.length) {
                    e.preventDefault();
                    minInputRef.current?.focus();
                    minInputRef.current?.select();
                }
            }} className="w-8 h-7 bg-transparent border border-[var(--color-borderDefault)] rounded-[5px] text-center text-[12px] font-medium text-[var(--color-textPrimary)] focus:border-blue-500 focus:bg-blue-50 dark:focus:bg-blue-500/10 outline-none transition-all"/>
            <span className="text-[var(--color-textPrimary)] font-bold text-xs mb-0.5">:</span>
            <input ref={minInputRef} type="text" value={localMin} onChange={e => {
                const val = e.target.value;
                setLocalMin(val);
                const parsed = parseInt(val, 10);
                if (!isNaN(parsed) && parsed >= 0 && parsed <= 59) {
                    updateTime(hr12, String(parsed).padStart(2, '0'), isPM);
                }
            }} onBlur={handleMinBlur} onKeyDown={e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    setIsOpen(false);
                }
                else if (e.key === 'ArrowRight' && e.currentTarget.selectionStart === e.currentTarget.value.length) {
                    e.preventDefault();
                    amBtnRef.current?.focus();
                }
                else if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0) {
                    e.preventDefault();
                    hourInputRef.current?.focus();
                    hourInputRef.current?.select();
                }
            }} className="w-8 h-7 bg-transparent border border-[var(--color-borderDefault)] rounded-[5px] text-center text-[12px] font-medium text-[var(--color-textPrimary)] focus:border-blue-500 focus:bg-blue-50 dark:focus:bg-blue-500/10 outline-none transition-all"/>

            <div className="flex items-center ml-1 gap-1">
              <button ref={amBtnRef} onClick={() => handleMeridiemChange(false)} onKeyDown={e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    setIsOpen(false);
                }
                else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    pmBtnRef.current?.focus();
                }
                else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    minInputRef.current?.focus();
                    minInputRef.current?.select();
                }
            }} className={`px-1.5 py-1 text-[11px] font-bold transition-colors focus:ring-1 focus:ring-blue-500 rounded outline-none ${!isPM ? 'text-blue-500' : 'text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)]'}`}>
                AM
              </button>
              <button ref={pmBtnRef} onClick={() => handleMeridiemChange(true)} onKeyDown={e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    setIsOpen(false);
                }
                else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    amBtnRef.current?.focus();
                }
            }} className={`px-1.5 py-1 text-[11px] font-bold transition-colors focus:ring-1 focus:ring-blue-500 rounded outline-none ${isPM ? 'text-blue-500' : 'text-[var(--color-textMuted)] hover:text-[var(--color-textPrimary)]'}`}>
                PM
              </button>
            </div>
          </div>)}
      </div>
    </div>);
};
interface ConvertibleItem {
    id: string;
    name: string;
    category: string;
    data: any;
    event_deadline?: string;
    is_done?: boolean;
    iconHost?: string;
    iconHosts?: string[];
}
const getSingleItemName = (item: ConvertibleItem | undefined): string => {
    if (!item)
        return '';
    const rawName = item.name;
    if (typeof rawName === 'string')
        return rawName;
    if (rawName && typeof rawName === 'object') {
        const obj = rawName as any;
        if (typeof obj.name === 'string')
            return obj.name;
        if (Array.isArray(obj.names) && obj.names.length > 0)
            return String(obj.names[0]);
        try {
            return JSON.stringify(obj);
        }
        catch {
            return '';
        }
    }
    return String(rawName ?? '');
};
const getSecondaryText = (item: ConvertibleItem): string => {
    const data = item.data || {};
    const cat = (item.category || '').toLowerCase();
    if (cat === 'note') {
        if (data.description)
            return data.description;
        if (data.updated_at) {
            try {
                return `Last edited ${formatDistanceToNow(new Date(data.updated_at))} ago`;
            }
            catch (e) { }
        }
        if (data.value && typeof data.value === 'string') {
            return data.value.replace(/<[^>]+>/g, '').slice(0, 40) + '...';
        }
        return 'Note';
    }
    if (['link'].includes(cat)) {
        let urls: string[] = [];
        const v = data.value;
        if (v && typeof v === 'object' && Array.isArray((v as any).urls)) {
            urls = (v as any).urls.filter((u: any) => typeof u === 'string');
        }
        else if (typeof v === 'string' && (v.trim().startsWith('{') || v.trim().startsWith('['))) {
            try {
                const parsed = JSON.parse(v);
                if (Array.isArray(parsed.urls))
                    urls = parsed.urls.filter((u: any) => typeof u === 'string');
            }
            catch (e) { }
        }
        if (urls.length > 1) {
            const hostnames = urls.slice(0, 4).map(u => {
                try {
                    return new URL(u.startsWith('http') ? u : `https://${u}`).hostname.replace(/^www\./, '');
                }
                catch (e) {
                    return u;
                }
            });
            return `${urls.length} links · ${hostnames.join(', ')}${urls.length > 4 ? '…' : ''}`;
        }
        let rawUrl = data.url || data.link || (urls.length === 1 ? urls[0] : '');
        if (!rawUrl && typeof v === 'string' && !v.startsWith('{') && !v.startsWith('['))
            rawUrl = v;
        if (!rawUrl && typeof item.name === 'string' && item.name.startsWith('http'))
            rawUrl = item.name;
        if (rawUrl && typeof rawUrl === 'string') {
            try {
                const urlObj = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
                return urlObj.hostname.replace(/^www\./, '');
            }
            catch (e) {
                return rawUrl;
            }
        }
        return 'Link';
    }
    if (['automation'].includes(cat)) {
        if (data.schedule_type === 'recurring' && data.recurring_cycle)
            return `Every ${data.recurring_cycle}`;
        if (data.is_recurring && data.recurring_cycle)
            return `Every ${data.recurring_cycle}`;
        if (data.event_deadline) {
            try {
                return `Scheduled for ${format(new Date(data.event_deadline), 'MMM d, h:mm a')}`;
            }
            catch (e) { }
        }
        if (data.description)
            return data.description;
        return 'Automation';
    }
    if (['prompt', 'aiprompt', 'ai_prompt'].includes(cat)) {
        return data.description || data.prompt || data.promptBody || 'Chat Agent';
    }
    if (['agent', 'chat_agent', 'ai', 'assistant', 'chat'].includes(cat) || data.type === 'agent') {
        return data.description || 'Chat Agent';
    }
    if (cat === 'workspace') {
        return 'Workspace';
    }
    return cat.charAt(0).toUpperCase() + cat.slice(1);
};
const getItemIcon = (item: ConvertibleItem) => {
    const cat = (item.category || '').toLowerCase();
    const data = item.data || {};
    if (['prompt', 'aiprompt', 'ai_prompt'].includes(cat)) {
        return <LuSparkles size={11} className="text-[var(--color-iconDefault)] shrink-0"/>;
    }
    if (['agent', 'chat_agent', 'ai', 'assistant', 'chat'].includes(cat) || data.type === 'agent') {
        if (data.avatar)
            return <img src={data.avatar} alt="" className="w-3.5 h-3.5 rounded-full object-cover shrink-0"/>;
        if (data.icon && typeof data.icon === 'string')
            return <img src={data.icon} alt="" className="w-3.5 h-3.5 rounded-[4px] object-cover shrink-0 bg-white/10"/>;
        return <LuSparkles size={11} className="text-[var(--color-iconDefault)] shrink-0"/>;
    }
    if (cat === 'workspace') {
        return <SessionGridIcon size={11} className="text-[var(--color-iconDefault)] shrink-0"/>;
    }
    if (['link'].includes(cat)) {
        let rawUrl = data.url || data.value || data.link || '';
        if (!rawUrl && typeof item.name === 'string' && item.name.startsWith('http'))
            rawUrl = item.name;
        if (rawUrl && typeof rawUrl === 'string') {
            try {
                const urlObj = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
                return (<img src={`https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`} alt="" className="w-3.5 h-3.5 rounded-[4px] shrink-0 bg-white/10"/>);
            }
            catch (e) { }
        }
        return <FiLink size={11} className="text-[var(--color-iconDefault)] shrink-0"/>;
    }
    return <FiFileText size={11} className="text-[var(--color-iconDefault)] shrink-0"/>;
};
const validCategories = [
    'note',
    'snippet',
    'link',
    'agent',
    'chat_agent',
    'ai',
    'assistant',
    'chat',
    'workspace',
    'tabgroup',
    'Tab Session',
    'link group',
    'prompt',
    'aiprompt',
    'ai_prompt'
];
const isValidCategory = (item: ConvertibleItem) => {
    const cat = (item.category || '').toLowerCase();
    return validCategories.includes(cat) || item.data?.type === 'agent';
};
interface CreateTodoViewProps {
    items: ConvertibleItem[];
    onCreateTodo: (data: any) => void | Promise<any>;
    isDarkMode?: boolean;
    initialItem?: any;
    selectedIndex?: number;
    onSelectedIndexChange?: (index: number) => void;
    searchQuery?: string;
    onSearchQueryChange?: (query: string) => void;
    scrollableRef?: React.RefObject<HTMLDivElement | null>;
    onClose: () => void;
    onSavedClose?: () => void;
    isEditMode?: boolean;
    // Existing-items table props
    existingTodos?: TodoRecord[];
    activeTodoId?: string | null;
    onLoadTodo?: (todoItem: TodoRecord) => void;
    onDeleteTodo?: (id: string) => void;
    hotkeysMap?: Record<string, string>;
    onUpdateItemField?: (itemId: string, field: string, value: any) => Promise<void>;
    isFullScreenMode?: boolean;
    isWidgetMode?: boolean;
    isOverlay?: boolean;
    hideRightPanel?: boolean;
    appearanceScope?: 'default' | 'alts';
    workspaceCollectionMode?: boolean;
    workspaceCollectionFilterTagIds?: string[];
    workspaceCollectionWorkspaceId?: string;
    organisationCollectionOrganisationId?: string | null;
    forceCreateEditor?: boolean;
    appearanceTokens?: React.CSSProperties;
    propertyPersistenceAdapter?: React.ComponentProps<typeof SharedPropertiesToolbar>['propertyPersistenceAdapter'];
}
const CreateTodoView: React.FC<CreateTodoViewProps> = ({ items, onCreateTodo, isDarkMode: propIsDarkMode, initialItem, selectedIndex, onSelectedIndexChange, searchQuery: externalSearchQuery, onSearchQueryChange: setExternalSearchQuery, scrollableRef, onClose, onSavedClose, isEditMode = false, existingTodos, activeTodoId, onLoadTodo, onDeleteTodo, hotkeysMap = {}, onUpdateItemField, isFullScreenMode = false, isWidgetMode = false, isOverlay: propIsOverlay, hideRightPanel = false, appearanceScope = 'default', workspaceCollectionMode = false, workspaceCollectionFilterTagIds = [], workspaceCollectionWorkspaceId, organisationCollectionOrganisationId = null, forceCreateEditor = false, appearanceTokens, propertyPersistenceAdapter, }) => {
    const activeEditor = useUIStore(s => s.activeEditor);
    const isFocusMode = useUIStore(s => s.isFocusMode);
    const isOverlay = Boolean(propIsOverlay || activeEditor?.props?.isOverlay);
    const shouldReturnToCollectionSheet = Boolean(activeEditor?.props?.returnToCollectionSheet);
    const isNormalTodoMode = !isWidgetMode && !isFullScreenMode && !isOverlay && !isFocusMode;
    const [workspaceMode, setWorkspaceMode] = useState<'sheet' | 'editor'>(() => forceCreateEditor ? 'editor' : 'sheet');
    const [todoSheetGroupingMode, setTodoSheetGroupingMode] = useState<TodoSheetGroupingMode>('default');
    const [isTodoGroupingMenuOpen, setIsTodoGroupingMenuOpen] = useState(false);
    const todoGroupingMenuRef = useRef<HTMLDivElement | null>(null);
    const [isSheetCreateEditorOpen, setIsSheetCreateEditorOpen] = useState(Boolean(activeEditor?.props?.keepSheetCreateEditorOpen));
    useEffect(() => {
        let isMounted = true;
        void getStoredTodoSheetGroupingMode().then(mode => {
            if (!isMounted)
                return;
            setTodoSheetGroupingMode(mode);
        });
        return () => {
            isMounted = false;
        };
    }, []);
    const { theme } = useAppearance();
    const dbTags = useDbStore(state => state.tags) || [];
    const todoTagNamesMap = useMemo(() => {
        const map: Record<string, string> = {};
        dbTags.forEach(t => {
            map[t.id] = t.name;
        });
        return map;
    }, [dbTags]);
    const isDarkMode = propIsDarkMode ?? (theme.isDark || document.documentElement.classList.contains('dark'));
    const isEmbedded = appearanceScope === 'alts' ||
        (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === 'true');
    const isWorkspaceCollectionMode = workspaceCollectionMode && appearanceScope === 'alts';
    const hasInitialTodoRecord = Boolean(initialItem?.todo_id ||
        (initialItem?.id &&
            !initialItem?.isCreateModalOnly &&
            (initialItem?.scheduleType ||
                initialItem?.scheduleTime ||
                initialItem?.is_done !== undefined ||
                initialItem?.isDone !== undefined ||
                initialItem?.is_recurring !== undefined ||
                initialItem?.recurring_cycle !== undefined ||
                Array.isArray(initialItem?.references))));
    useEffect(() => {
        if (!isNormalTodoMode || hasInitialTodoRecord || activeTodoId || isSheetCreateEditorOpen || forceCreateEditor) {
            setWorkspaceMode('editor');
        }
        else {
            setWorkspaceMode('sheet');
        }
    }, [activeTodoId, forceCreateEditor, hasInitialTodoRecord, isNormalTodoMode, isSheetCreateEditorOpen]);
    useEffect(() => {
        if (!isTodoGroupingMenuOpen)
            return;
        const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
            setIsTodoGroupingMenuOpen(false);
            return true;
        });
        const handleClickOutside = (event: MouseEvent) => {
            if (!todoGroupingMenuRef.current?.contains(event.target as Node)) {
                setIsTodoGroupingMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            unregister();
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isTodoGroupingMenuOpen]);
    const initialScheduleTime = useMemo(() => {
        if (typeof initialItem?.scheduleTime === 'number' && Number.isFinite(initialItem.scheduleTime)) {
            return initialItem.scheduleTime;
        }
        if (initialItem?.event_deadline) {
            const parsed = new Date(String(initialItem.event_deadline).replace(' ', 'T')).getTime();
            if (Number.isFinite(parsed))
                return parsed;
        }
        return undefined;
    }, [initialItem]);
    const { todoTitle: title, setTodoTitle: setTitle, todoDescription: description, setTodoDescription: setDescription, scheduleType, setScheduleType, scheduleTime, setScheduleTime, recurringCycle, setRecurringCycle, selectedItems, setSelectedItems, tagIds: editorTagIds, setTagIds: setEditorTagIds, todoShortcut, setTodoShortcut, saveStatus, setSaveStatus, lastSavedAt, setLastSavedAt, lastSavedTitleRef, lastSavedShortcutRef, isDirty, handleSave, flushSave, bindExternalSavedTodo, activeTodoId: liveTodoId, resetEditor, liveTodo, versionHistory, versionHistoryItems, selectedVersionId, setSelectedVersionId, isViewingHistory, } = useTodoEditor({
        todoId: activeTodoId || initialItem?.todo_id || initialItem?.id,
        initialTitle: initialItem?.name || '',
        initialDescription: initialItem?.description || '',
        initialScheduleType: initialItem?.scheduleType || 'one-time',
        initialScheduleTime,
        initialRecurringCycle: initialItem?.recurringType,
        initialItems: initialItem?.references || [],
        initialTags: initialItem?.tagIds || [],
        requiredTagIds: isWorkspaceCollectionMode ? workspaceCollectionFilterTagIds : undefined,
        requiredWorkspaceId: isWorkspaceCollectionMode ? workspaceCollectionWorkspaceId : undefined,
        organisationId: isWorkspaceCollectionMode ? organisationCollectionOrganisationId ?? undefined : undefined,
    });
    const isDirtyRef = useRef(isDirty);
    const flushSaveRef = useRef(flushSave);
    useEffect(() => {
        isDirtyRef.current = isDirty;
    }, [isDirty]);
    useEffect(() => {
        flushSaveRef.current = flushSave;
    }, [flushSave]);
    useEffect(() => {
        return () => {
            if (isDirtyRef.current) {
                void flushSaveRef.current?.();
            }
        };
    }, []);
    useEffect(() => {
        return () => {
            resetEditor();
        };
    }, [resetEditor]);
    // ── Existing items table state ──
    const { isFavorite, toggleFavorite, addFavorite } = useFavorites();
    const [tagPopupOpen, setTagPopupOpen] = useState(false);
    const [newTagName, setNewTagName] = useState('');
    const [selectedTags, setSelectedTags] = useState<{
        id: string;
        name: string;
    }[]>([]);
    const [organisationId, setOrganisationId] = useState<string | null>(null);
    useEffect(() => {
        const requiredIds = isWorkspaceCollectionMode ? workspaceCollectionFilterTagIds : [];
        const visibleTagIds = Array.from(new Set([...(editorTagIds || []), ...requiredIds]));
        if (visibleTagIds.length !== (editorTagIds || []).length)
            setEditorTagIds(visibleTagIds);
        const resolved = visibleTagIds.map((id: string) => {
            const foundName = todoTagNamesMap[id] || (id.startsWith('temp_') ? id.replace('temp_', '') : id);
            return { id, name: foundName };
        });
        const currentIdsStr = selectedTags
            .map(t => t.id)
            .join(',');
        const newIdsStr = visibleTagIds.join(',');
        if (currentIdsStr !== newIdsStr) {
            setSelectedTags(resolved);
        }
    }, [editorTagIds, isWorkspaceCollectionMode, selectedTags, setEditorTagIds, todoTagNamesMap, workspaceCollectionFilterTagIds]);
    const [todoHotkey, setTodoHotkey] = useState('');
    const shortcutInputRef = useRef<HTMLInputElement | null>(null);
    const adjustDescriptionHeight = useCallback(() => {
        const el = descriptionRef.current as HTMLTextAreaElement | null;
        if (el) {
            el.style.height = 'auto';
            const isPopupEditor = el.dataset.todoPopupEditor === 'true';
            const minH = isPopupEditor ? 150 : 220;
            const maxH = isPopupEditor ? 150 : Math.min(400, Math.max(280, Math.round(window.innerHeight * 0.35)));
            const newH = Math.min(Math.max(minH, el.scrollHeight), maxH);
            el.style.height = `${newH}px`;
        }
    }, []);
    React.useLayoutEffect(() => {
        adjustDescriptionHeight();
    }, [description, adjustDescriptionHeight]);
    const { validateShortcut } = useShortcutValidation();
    const [shortcutError, setShortcutError] = useState<string | null>(null);
    const [isShortcutOverrideable, setIsShortcutOverrideable] = useState<boolean>(false);
    const [shortcutConflictId, setShortcutConflictId] = useState<string | null>(null);
    const [shortcutsMap, setShortcutsMap] = useState<Record<string, string>>({});
    const [tableSearchQuery, setTableSearchQuery] = useState('');
    const [isRightPanelExpanded, setIsRightPanelExpanded] = useState(false);
    const [isCollectionSheetExpanded, setIsCollectionSheetExpanded] = useState(false);
    const rightSideSearchInputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (hideRightPanel) {
            setShortcutsMap({});
            return;
        }
        const seededShortcuts = (existingTodos ?? []).reduce<Record<string, string>>((acc, todo) => {
            const shortcut = String(todo?.shortcut || '').trim();
            if (!shortcut)
                return acc;
            acc[todo.id] = shortcut;
            return acc;
        }, {});
        setShortcutsMap(seededShortcuts);
        readAllShortcuts()
            .then(allShortcuts => {
            setShortcutsMap({ ...seededShortcuts, ...allShortcuts });
        })
            .catch(() => { });
    }, [existingTodos, hideRightPanel]);
    // Note: useTodoEditor already returns display* values (displayTitle, displayShortcut, etc.)
    // that switch automatically between the historical snapshot and the live value based on
    // selectedVersionId. No extra sync effects are needed here.
    useEffect(() => {
        let active = true;
        const timer = setTimeout(() => {
            const checkShortcut = async () => {
                if (todoShortcut) {
                    const validationTodoId = liveTodoId || initialItem?.id;
                    const currentCompound = getItemCompoundId({ id: validationTodoId || 'new', _kind: 'todo' });
                    if (shortcutsMap && shortcutsMap[currentCompound] === todoShortcut) {
                        if (active) {
                            setShortcutError(null);
                            setIsShortcutOverrideable(false);
                            setShortcutConflictId(null);
                        }
                        return;
                    }
                    const res = await validateShortcut(todoShortcut, validationTodoId || 'new');
                    if (active) {
                        if (!res.isValid) {
                            setShortcutError(res.errorMessage || 'This shortcut is already taken.');
                            setIsShortcutOverrideable(!!res.isOverrideable);
                            setShortcutConflictId(res.conflictId);
                        }
                        else {
                            setShortcutError(null);
                            setIsShortcutOverrideable(false);
                            setShortcutConflictId(null);
                        }
                    }
                }
                else {
                    if (active) {
                        setShortcutError(null);
                        setIsShortcutOverrideable(false);
                        setShortcutConflictId(null);
                    }
                }
            };
            void checkShortcut();
        }, 400);
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [todoShortcut, initialItem, liveTodoId, shortcutsMap, validateShortcut]);
    const handleResolveShortcut = useCallback(async (approval: ShortcutAssignmentApproval) => {
        const saved = await handleSave(true, { shortcut: todoShortcut, textCommandApproval: approval });
        if (!saved)
            throw new Error('Could not assign this command. Check the required fields and review the current owners.');
        setShortcutError(null);
        setIsShortcutOverrideable(false);
        setShortcutConflictId(null);
        readAllShortcuts().then(setShortcutsMap).catch(() => { });
    }, [todoShortcut, handleSave]);
    const tagPopupRef = useRef<HTMLDivElement | null>(null);
    const sortedTodos = useMemo(() => {
        if (hideRightPanel)
            return [];
        const collectionTagSet = new Set(workspaceCollectionFilterTagIds.filter(Boolean));
        const list = workspaceCollectionMode
            ? (existingTodos ?? []).filter(todo => {
                const todoTagIds = Array.isArray((todo as any).tagIds)
                    ? (todo as any).tagIds
                    : Array.isArray((todo as any).tags)
                        ? (todo as any).tags
                        : [];
                if (collectionTagSet.size > 0) {
                    return todoTagIds.some((tagId: unknown) => collectionTagSet.has(String(tagId)));
                }
                return !organisationCollectionOrganisationId || (todo as any).organisationId === organisationCollectionOrganisationId;
            })
            : existingTodos ?? [];
        const q = tableSearchQuery.toLowerCase();
        const filtered = q ? list.filter(t => (t.name || '').toLowerCase().includes(q)) : list;
        return [...filtered].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    }, [existingTodos, hideRightPanel, tableSearchQuery, workspaceCollectionFilterTagIds, workspaceCollectionMode, organisationCollectionOrganisationId]);
    const [selectedType, setSelectedType] = useState('custom');
    const [selectedCategory, setSelectedCategory] = useState<'all' | 'note' | 'snippet' | 'link' | 'workspace' | 'automation' | 'agent' | 'aiPrompt'>('all');
    const [hasSelectedTypeInitially, setHasSelectedTypeInitially] = useState(() => {
        return isEditMode;
    });
    const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(() => !isEditMode);
    const typeDropdownRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isTypeDropdownOpen && typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
                setIsTypeDropdownOpen(false);
            }
            if (tagPopupOpen && tagPopupRef.current && !tagPopupRef.current.contains(event.target as Node)) {
                setTagPopupOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isTypeDropdownOpen, tagPopupOpen]);
    const isMac = navigator.userAgent.includes('Mac');
    const [selectedItem, setSelectedItem] = useState<ConvertibleItem | null>(null);
    const [showSelectedTooltip, setShowSelectedTooltip] = useState(false);
    const [internalSearchQuery, setInternalSearchQuery] = useState('');
    const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
    const setSearchQuery = setExternalSearchQuery || setInternalSearchQuery;
    const [explicitSaveStatus, setExplicitSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [titleError, setTitleError] = useState(false);
    const [descriptionError, setDescriptionError] = useState(false);
    // Clear validation errors when switching between active todos/drafts
    useEffect(() => {
        setTitleError(false);
        setDescriptionError(false);
        setShortcutError(null);
    }, [liveTodoId]);
    const [isAnytime, setIsAnytime] = React.useState(false);
    const [activeSlot, setActiveSlot] = useState<'title' | 'description' | 'mode' | 'date' | 'time' | 'resource' | 'submit' | 'shortcut' | null>('title');
    const [isEditing, setIsEditing] = useState(!initialItem);
    const [isFavoriteState, setIsFavoriteState] = useState(false);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionIndex, setMentionIndex] = useState(0);
    const [mentionCaretPos, setMentionCaretPos] = useState({ start: 0, end: 0 });
    const mentionSuggestions = useMemo(() => {
        if (mentionQuery === null)
            return [];
        const q = mentionQuery.toLowerCase();
        return items.filter(item => {
            if (!isValidCategory(item))
                return false;
            return (item.name || '').toLowerCase().includes(q);
        });
    }, [items, mentionQuery]);
    const handleSelectMention = (item: ConvertibleItem) => {
        setSelectedItems(prev => {
            const exists = prev.some(i => i.id === item.id);
            if (exists)
                return prev;
            return [...prev, item];
        });
        // Remove the @query text from description editor so it only attaches to right side / footer
        const beforeText = description.substring(0, mentionCaretPos.start);
        const afterText = description.substring(mentionCaretPos.end);
        const newText = beforeText + afterText;
        setDescription(newText);
        setMentionQuery(null);
        setTimeout(() => {
            const textarea = descriptionRef.current as unknown as HTMLTextAreaElement | null;
            if (textarea) {
                textarea.focus();
                const cursorPosition = mentionCaretPos.start;
                textarea.setSelectionRange(cursorPosition, cursorPosition);
            }
        }, 10);
    };
    const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setDescription(val);
        if (descriptionError)
            setDescriptionError(false);
        const selectionEnd = e.target.selectionEnd;
        const textBeforeCursor = val.substring(0, selectionEnd);
        const lastWordMatch = textBeforeCursor.match(/@(\S*)$/);
        if (lastWordMatch) {
            setMentionQuery(lastWordMatch[1]);
            setMentionIndex(0);
            setMentionCaretPos({
                start: selectionEnd - lastWordMatch[0].length,
                end: selectionEnd,
            });
        }
        else {
            setMentionQuery(null);
        }
    };
    const [isPickerActive, setIsPickerActive] = useState(false);
    const [time, setTime] = useState(() => {
        const initialTime = initialScheduleTime;
        return format(initialTime ? new Date(initialTime) : new Date(), 'HH:mm');
    });
    const [isTimeEditing, setIsTimeEditing] = useState(false);
    const [amPm, setAmPm] = useState<'AM' | 'PM'>(() => {
        const initialTime = initialScheduleTime;
        const h = (initialTime ? new Date(initialTime) : new Date()).getHours();
        return h >= 12 ? 'PM' : 'AM';
    });
    const [rawTimeText, setRawTimeText] = useState('');
    const [hourText, setHourText] = useState(() => {
        const initialTime = initialScheduleTime;
        let h = (initialTime ? new Date(initialTime) : new Date()).getHours();
        if (h > 12)
            h -= 12;
        if (h === 0)
            h = 12;
        return h.toString().padStart(2, '0');
    });
    const [minText, setMinText] = useState(() => {
        const initialTime = initialScheduleTime;
        return (initialTime ? new Date(initialTime) : new Date()).getMinutes().toString().padStart(2, '0');
    });
    const [date, setDate] = useState(() => {
        const initialTime = initialScheduleTime;
        return format(initialTime ? new Date(initialTime) : new Date(), 'yyyy-MM-dd');
    });
    const scheduleSelectionCommittedRef = useRef(false);
    const commitScheduleSelection = useCallback((nextDate: string, nextTime: string | null = time, nextIsAnytime?: boolean) => {
        setDate(nextDate);
        if (nextTime !== null) {
            setTime(nextTime);
        }
        if (typeof nextIsAnytime === 'boolean') {
            setIsAnytime(nextIsAnytime);
        }
        const safeTime = nextTime || time || '09:00';
        const parsedDate = new Date(`${nextDate}T${safeTime}:00`);
        if (!isNaN(parsedDate.getTime())) {
            scheduleSelectionCommittedRef.current = true;
            setScheduleTime(parsedDate.getTime());
        }
    }, [setScheduleTime, time]);
    const [showRepeatDropdown, setShowRepeatDropdown] = useState(false);
    const [openAutomatically, setOpenAutomatically] = useState(false);
    const [createMore, setCreateMore] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
    const resourceButtonRef = useRef<HTMLButtonElement | null>(null);
    const [resourceDropdownPos, setResourceDropdownPos] = useState({ top: 0, left: 0 });
    const portalTarget = typeof document !== 'undefined' ? document.getElementById('todo-modal-portal-container') || document.body : null;
    const [focusedIndex, setFocusedIndex] = useState(0);
    const prevActiveSlotRef = useRef<string | null>(null);
    const shouldAutoOpenDateRef = useRef(false);
    const isSavingRef = useRef(false);
    const lastInitialItemRef = useRef<any>(undefined);
    const lastItemsSignatureRef = useRef<string>('');
    const lastActiveTodoIdRef = useRef<any>(undefined);
    const lastIsEditModeRef = useRef<boolean>(isEditMode);
    const hasUnsavedChanges = useRef(false);
    const itemsSignature = useMemo(() => JSON.stringify((items || []).map(item => [String(item.id), String(item.category || ''), String(item.name || '')])), [items]);
    // Sync UI date/time to scheduleTime
    useEffect(() => {
        if (liveTodoId)
            return;
        try {
            const safeTime = time || '09:00';
            const parsedDate = new Date(`${date}T${safeTime}:00`);
            if (!isNaN(parsedDate.getTime())) {
                // Only update if difference is at least 1 minute (60000ms) to ignore seconds/milliseconds
                const diff = Math.abs(parsedDate.getTime() - scheduleTime);
                if (diff >= 60000) {
                    setScheduleTime(parsedDate.getTime());
                }
            }
        }
        catch (e) { }
    }, [date, time, setScheduleTime, scheduleTime, liveTodoId]);
    // Sync scheduleTime back to UI date/time when loading existing
    useEffect(() => {
        if (scheduleTime) {
            const newDate = format(new Date(scheduleTime), 'yyyy-MM-dd');
            const newTime = format(new Date(scheduleTime), 'HH:mm');
            setDate(prev => (newDate !== prev ? newDate : prev));
            setTime(prev => (newTime !== prev ? newTime : prev));
        }
    }, [scheduleTime]);
    const scheduleSavedTodoAlarm = useCallback((todoId: string | false, deadlineTime = scheduleTime) => {
        if (!todoId || !deadlineTime)
            return;
        try {
            const chromeAny = (window as any).chrome;
            if (chromeAny?.runtime?.sendMessage) {
                chromeAny.runtime.sendMessage({
                    action: 'schedule_todo_alarm',
                    todoId: String(todoId),
                    deadline: new Date(deadlineTime).toISOString(),
                    is_anytime: isAnytime,
                });
            }
        }
        catch (err) {
            console.error('Failed to schedule autosaved todo alarm', err);
        }
    }, [isAnytime, scheduleTime]);
    // Auto-save logic (triggers for any task when both title & description are entered)
    useEffect(() => {
        if (!isDirty)
            return;
        // Strict autosave requirement: a todo must have both a title and a description
        const hasValidContent = title.trim().length > 0 && description.trim().length > 0;
        if (!hasValidContent)
            return;
        const timer = setTimeout(() => {
            void (async () => {
                const savedScheduleTime = typeof liveTodo?.scheduleTime === 'number'
                    ? liveTodo.scheduleTime
                    : typeof initialScheduleTime === 'number'
                        ? initialScheduleTime
                        : scheduleTime;
                const scheduleOverride = liveTodoId && !scheduleSelectionCommittedRef.current
                    ? { scheduleTime: savedScheduleTime }
                    : scheduleSelectionCommittedRef.current
                        ? { scheduleTime }
                        : undefined;
                const savedId = await handleSave(true, scheduleOverride);
                scheduleSelectionCommittedRef.current = false;
                scheduleSavedTodoAlarm(savedId, scheduleOverride?.scheduleTime ?? scheduleTime);
            })();
        }, 500);
        return () => clearTimeout(timer);
    }, [
        isDirty,
        handleSave,
        title,
        description,
        selectedItems,
        todoShortcut,
        todoHotkey,
        isFavoriteState,
        scheduleSavedTodoAlarm,
        liveTodoId,
        liveTodo,
        initialScheduleTime,
        scheduleTime
    ]);
    // Set global modal open state
    useEffect(() => {
        // setIsFullScreenModalOpen is removed
        return () => {
            // setIsFullScreenModalOpen is removed
        };
    }, []);
    // Calculate resource dropdown placement
    useEffect(() => {
        if (activeSlot === 'resource' && isEditing && resourceButtonRef.current) {
            const updatePosition = () => {
                const rect = resourceButtonRef.current?.getBoundingClientRect();
                if (rect) {
                    // Width of dropdown is 600px, height is approx 305px
                    const dropdownWidth = 600;
                    const dropdownHeight = 305;
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;
                    const portalTarget = document.getElementById('todo-modal-portal-container') || document.body;
                    const portalRect = portalTarget?.getBoundingClientRect();
                    // Check if there is enough space below the button (with a 20px padding)
                    const spaceBelow = viewportHeight - rect.bottom;
                    const showAbove = spaceBelow < dropdownHeight + 20;
                    let top = 0;
                    let left = 0;
                    // Compute absolute viewport-relative coordinates
                    let viewportLeft = rect.left - 180; // Shift left by 180px to align it closer to the button
                    viewportLeft = Math.max(20, Math.min(viewportLeft, viewportWidth - dropdownWidth - 20));
                    if (portalTarget && portalTarget !== document.body) {
                        if (showAbove) {
                            top = rect.top - portalRect.top - dropdownHeight - 8;
                        }
                        else {
                            top = rect.bottom - portalRect.top + 8;
                        }
                        left = viewportLeft - portalRect.left;
                    }
                    else {
                        if (showAbove) {
                            top = rect.top + window.scrollY - dropdownHeight - 8;
                        }
                        else {
                            top = rect.bottom + window.scrollY + 8;
                        }
                        left = viewportLeft;
                    }
                    setResourceDropdownPos({
                        top,
                        left,
                    });
                }
            };
            updatePosition();
            window.addEventListener('resize', updatePosition);
            return () => {
                window.removeEventListener('resize', updatePosition);
            };
        }
        return () => { };
    }, [activeSlot, isEditing]);
    const formatTime12Hour = (timeStr: string) => {
        if (!timeStr)
            return 'Select Time';
        try {
            const [h, m] = timeStr.split(':').map(Number);
            if (isNaN(h) || isNaN(m))
                return timeStr;
            const dateObj = new Date();
            dateObj.setHours(h, m, 0, 0);
            return format(dateObj, 'h:mm a');
        }
        catch (e) {
            return timeStr;
        }
    };
    const types = [
        {
            id: 'custom',
            label: 'Todo',
            description: 'Assign a Todo to saved items',
            icon: <FiCheckSquare size={12}/>,
            color: '',
        },
        {
            id: 'saved_files',
            label: 'Automated Todo',
            description: 'Attach a saved file',
            icon: <FiFolder size={12}/>,
            color: '',
        }
    ];
    const repeatOptions = [
        { id: 'daily', label: 'Daily', icon: <FiRepeat size={12}/> },
        { id: 'weekly', label: 'Weekly', icon: <FiRepeat size={12}/> },
        { id: 'monthly', label: 'Monthly', icon: <FiRepeat size={12}/> }
    ] as const;
    const selectedDueDate = date ? new Date(`${date}T12:00:00`) : null;
    const hasSelectedDueDate = !!selectedDueDate && !Number.isNaN(selectedDueDate.getTime());
    const selectedWeekday = hasSelectedDueDate ? format(selectedDueDate, 'EEEE') : 'selected day';
    const selectedMonthDay = hasSelectedDueDate ? selectedDueDate.getDate() : null;
    const selectedRepeatLabel = scheduleType === 'one-time'
        ? 'Once'
        : recurringCycle === 'weekly'
            ? `Every ${selectedWeekday}`
            : recurringCycle === 'monthly'
                ? selectedMonthDay && selectedMonthDay <= 28
                    ? `Monthly · ${format(selectedDueDate!, 'do')}`
                    : 'Every month'
                : 'Daily';
    const modeOptions = [
        {
            id: 'one-time',
            label: 'One-time',
            description: 'Schedule for a single occurrence',
            icon: <FaRegClock size={12}/>,
        },
        { id: 'recurring', label: 'Recurring', description: 'Set up a repeating schedule', icon: <FiRepeat size={12}/> }
    ] as const;
    const timeOptions = useMemo(() => {
        const opts = [{ id: 'specific', label: 'Specific Time', icon: <FiClock size={12}/> }];
        if (scheduleType === 'recurring') {
            opts.unshift({ id: 'anytime', label: 'Anytime of the day', icon: <FaRegClock size={12}/> });
        }
        return opts;
    }, [scheduleType]);
    const slots: ('title' | 'shortcut' | 'description' | 'mode' | 'date' | 'time' | 'resource' | 'submit')[] = useMemo(() => {
        return ['title', 'description', 'mode', 'date', 'resource', 'submit'];
    }, []);
    const hideNativeIconsStyle = `
    .hide-native-picker::-webkit-calendar-picker-indicator,
    .hide-native-picker::-webkit-inner-spin-button,
    .hide-native-picker::-webkit-clear-button {
      display: none !important;
      -webkit-appearance: none;
    }
    input[type="date"]::-webkit-datetime-edit-fields-wrapper {
      background: transparent !important;
    }
    input[type="time"]::-webkit-calendar-picker-indicator {
      display: none !important;
    }
    input[type="time"]::-webkit-datetime-edit-hour-field:focus,
    input[type="time"]::-webkit-datetime-edit-minute-field:focus,
    input[type="time"]::-webkit-datetime-edit-ampm-field:focus {
      background-color: #a855f7 !important;
      color: #ffffff !important;
    }
    .no-scrollbar::-webkit-scrollbar {
      display: none !important;
    }
    .no-scrollbar {
      -ms-overflow-style: none !important;
      scrollbar-width: none !important;
    }
  `;
    const manualHourRef = React.useRef<HTMLInputElement>(null);
    const manualMinRef = React.useRef<HTMLInputElement>(null);
    const dateInputRef = React.useRef<HTMLInputElement>(null);
    const titleInputRef = React.useRef<HTMLInputElement>(null);
    const descriptionRef = React.useRef<HTMLInputElement>(null);
    const internalSearchInputRef = React.useRef<HTMLInputElement>(null);
    const organisationRef = React.useRef<HTMLDivElement>(null);
    const resultsContainerRef = React.useRef<HTMLDivElement>(null);
    const amPmBtnRef = React.useRef<HTMLButtonElement>(null);
    const lastEnterTime = React.useRef(0);
    const lastArrowPressedRef = React.useRef(0);
    const getAmPmFrom24h = (timeStr: string | null): 'AM' | 'PM' => {
        if (!timeStr || !timeStr.includes(':'))
            return 'AM';
        const h = parseInt(timeStr.split(':')[0], 10);
        return isNaN(h) ? 'AM' : h >= 12 ? 'PM' : 'AM';
    };
    const get24hTimeStr = (h12Text: string, mText: string, ampmVal: 'AM' | 'PM'): string => {
        let h = parseInt(h12Text, 10);
        const m = parseInt(mText, 10);
        if (isNaN(h))
            h = 12;
        const mins = isNaN(m) ? 0 : m;
        if (ampmVal === 'PM') {
            if (h < 12)
                h += 12;
        }
        else {
            if (h === 12)
                h = 0;
        }
        return `${h.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };
    React.useEffect(() => {
        if (time) {
            setAmPm(getAmPmFrom24h(time));
        }
    }, [time]);
    React.useEffect(() => {
        setFocusedIndex(0);
    }, [searchQuery]);
    React.useEffect(() => {
        if (activeSlot === 'resource' && resultsContainerRef.current) {
            const focusedEl = resultsContainerRef.current.querySelector(`[data-idx="${focusedIndex}"]`);
            if (focusedEl) {
                focusedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [focusedIndex, activeSlot]);
    React.useLayoutEffect(() => {
        const currentActiveId = activeTodoId || liveTodoId || initialItem?.todo_id || initialItem?.id;
        const initialItemChanged = initialItem !== lastInitialItemRef.current;
        const itemsChanged = itemsSignature !== lastItemsSignatureRef.current;
        const activeIdChanged = currentActiveId !== lastActiveTodoIdRef.current;
        const editModeChanged = isEditMode !== lastIsEditModeRef.current;
        if (!initialItemChanged && !itemsChanged && !activeIdChanged && !editModeChanged) {
            return;
        }
        // IMPORTANT: If the ONLY thing that changed was the activeId, and it went from falsy to a string,
        // it means an autosave just occurred and assigned a new ID. We should NOT reset the editor in this case.
        const isJustAssigningNewId = !initialItemChanged &&
            !itemsChanged &&
            !editModeChanged &&
            activeIdChanged &&
            !lastActiveTodoIdRef.current &&
            currentActiveId;
        lastInitialItemRef.current = initialItem;
        lastItemsSignatureRef.current = itemsSignature;
        lastActiveTodoIdRef.current = currentActiveId;
        lastIsEditModeRef.current = isEditMode;
        if (isJustAssigningNewId) {
            return;
        }
        scheduleSelectionCommittedRef.current = false;
        let item = initialItem;
        if (item && item.snippet && typeof item.snippet === 'object') {
            item = {
                ...item.snippet,
                todo_id: item.todo_id || item.snippet.todo_id || item.snippet.id || item.snippet.snippet_id,
                config: item.config || item.snippet.config,
            };
        }
        const isActualResource = item &&
            (item.id ||
                item.snippet_id ||
                item.todo_id ||
                item.key ||
                item.title ||
                item.name ||
                item.label ||
                item.category) &&
            !item.isCreateModalOnly;
        if (isActualResource) {
            let parsedConfig = item.config;
            if (typeof parsedConfig === 'string' && (parsedConfig as string).trim().startsWith('{')) {
                try {
                    parsedConfig = JSON.parse(parsedConfig);
                }
                catch (e) { }
            }
            const configIds = parsedConfig?.id;
            const hasAttachedFiles = (Array.isArray(configIds) && configIds.length > 0) ||
                (Array.isArray(item.references) && item.references.length > 0);
            const isCustom = !hasAttachedFiles;
            const itemScheduleTime = typeof item.scheduleTime === 'number' && Number.isFinite(item.scheduleTime)
                ? item.scheduleTime
                : item.event_deadline
                    ? new Date(String(item.event_deadline).replace(' ', 'T')).getTime()
                    : NaN;
            let cat = (item.category || item.snippet_category || 'note').toLowerCase();
            if (initialItemChanged) {
                setTitleError(false);
                setDescriptionError(false);
                setShortcutError(null);
                if (item.key || item.title || item.name || item.label) {
                    const rawTitle = item.key || item.title || item.name || item.label;
                    setTitle(typeof rawTitle === 'object' && rawTitle !== null
                        ? (rawTitle as any).name ||
                            (Array.isArray((rawTitle as any).names)
                                ? (rawTitle as any).names.join(', ')
                                : JSON.stringify(rawTitle))
                        : String(rawTitle));
                }
                {
                    // Use description first (explicitly set), fall back to value. Always set even if empty.
                    const rawDesc = 'description' in item ? item.description : item.value;
                    setDescription(cleanDescription(rawDesc ?? ''));
                }
                const rawTags = item.tags || item.tagIds;
                if (Array.isArray(rawTags)) {
                    const resolved = rawTags.map((tag: any) => {
                        if (typeof tag === 'object' && tag !== null) {
                            const tagId = tag.id || tag.name;
                            const tagName = tag.name && tag.name !== tagId ? tag.name : todoTagNamesMap[tagId] || tagId;
                            return { id: tagId, name: tagName };
                        }
                        const tagIdStr = String(tag);
                        const foundName = todoTagNamesMap[tagIdStr] || (tagIdStr.startsWith('temp_') ? tagIdStr.replace('temp_', '') : tagIdStr);
                        return { id: tagIdStr, name: foundName };
                    });
                    setSelectedTags(resolved);
                }
                else {
                    setSelectedTags([]);
                }
                const todoId = item.todo_id || item.id;
                const itemWsId = item.organisationId || item.organisation_id;
                const compoundId = getItemCompoundId({
                    id: todoId,
                    organisation_id: itemWsId,
                    snippet: { id: todoId, category: 'todo' },
                    _kind: 'todo',
                });
                if (todoId && isEditMode) {
                    setIsFavoriteState(isFavorite(compoundId) || isFavorite(getItemCompoundId({ id: todoId, _kind: 'todo' })));
                    setTodoHotkey(hotkeysMap[compoundId] || hotkeysMap[todoId] || '');
                }
                else {
                    setIsFavoriteState(false);
                    setTodoHotkey('');
                }
                if (item.is_anytime || (item.event_deadline && String(item.event_deadline).substring(0, 4) >= '2035')) {
                    setIsAnytime(true);
                }
                else if (Number.isFinite(itemScheduleTime)) {
                    const d = new Date(itemScheduleTime);
                    setDate(format(d, 'yyyy-MM-dd'));
                    setTime(format(d, 'HH:mm'));
                    setIsAnytime(false);
                }
                else {
                    setIsAnytime(true);
                }
                if (item.is_recurring || (item as any).recurring || item.recurring_cycle) {
                    setScheduleType('recurring');
                    if (item.recurring_cycle)
                        setRecurringCycle(String(item.recurring_cycle).toLowerCase() as any);
                }
                else {
                    setScheduleType('one-time');
                }
            }
            let matchedItems: ConvertibleItem[] = [];
            if (isCustom) {
                setSelectedType('custom');
                setSelectedItem(null);
                setSelectedItems([]);
            }
            else {
                let parsedConfig = item.config;
                if (typeof parsedConfig === 'string' && (parsedConfig as string).trim().startsWith('{')) {
                    try {
                        parsedConfig = JSON.parse(parsedConfig);
                    }
                    catch (e) {
                        console.error('[CreateTodoView] Failed to parse config JSON string:', parsedConfig, e);
                    }
                }
                const configIds = parsedConfig?.id || [];
                const referenceIds = Array.isArray(item.references) ? item.references.map((r: any) => r.id) : [];
                const allReferenceIds = [...configIds, ...referenceIds];
                const stripTodoReferencePrefix = (id: unknown) => String(id).replace(/^(auto-|cmd-|mod-|agent-|prompt-|session-)/, '');
                const getAvailableReferenceIds = (availableItem: any) => {
                    const data = availableItem?.data || {};
                    return [
                        availableItem?.id,
                        data?.id,
                        data?.snippet_id,
                        data?.todo_id,
                        data?.automation_id,
                        data?.command_id,
                        data?.session_id,
                        data?.value
                    ].filter(id => id !== undefined && id !== null && String(id).length > 0);
                };
                const isSameTodoReference = (availableItem: any, savedId: unknown) => {
                    const savedIdStr = String(savedId);
                    return getAvailableReferenceIds(availableItem).some(availableId => {
                        const availableIdStr = String(availableId);
                        return (availableIdStr === savedIdStr ||
                            stripTodoReferencePrefix(availableIdStr) === stripTodoReferencePrefix(savedIdStr));
                    });
                };
                if (allReferenceIds.length > 0) {
                    const referenceLookup = Array.isArray(item.references) ? item.references : [];
                    matchedItems = allReferenceIds
                        .map(cid => {
                        const matched = (items || []).find(availableItem => isSameTodoReference(availableItem, cid));
                        if (matched)
                            return matched;
                        const savedReference = referenceLookup.find((ref: any) => String(ref.id) === String(cid));
                        if (!savedReference)
                            return null;
                        return {
                            id: String(savedReference.id),
                            name: savedReference.name || savedReference.title || savedReference.key || 'Saved item',
                            category: savedReference.type || savedReference.category || 'note',
                            data: savedReference,
                        };
                    })
                        .filter(Boolean) as ConvertibleItem[];
                }
                if (matchedItems.length === 0) {
                    const singleId = item.id || item.snippet_id || item.todo_id || item.snippet_todo_id;
                    if (singleId) {
                        const singleIdStr = String(singleId);
                        const matched = (items || []).find(availableItem => {
                            return isSameTodoReference(availableItem, singleIdStr);
                        });
                        if (matched) {
                            matchedItems = [matched];
                        }
                    }
                }
                if (matchedItems.length === 0 &&
                    (item.id || item.snippet_id || item.todo_id || (cat === 'command' && item.value))) {
                    if (cat !== 'snippet') {
                        const possibleIds = [item.todo_id, item.id, item.snippet_todo_id];
                        const numericId = possibleIds.find(id => typeof id === 'number' ||
                            (typeof id === 'string' && id.length > 0 && !isNaN(Number(id)) && !id.includes('-')));
                        const fallbackItem = {
                            id: numericId || item.id || item.snippet_id || item.value,
                            name: item.key || item.title || item.name || item.label || 'Untitled',
                            category: cat,
                            data: item,
                        };
                        matchedItems = [fallbackItem];
                    }
                }
                if (matchedItems.length > 0) {
                    setSelectedItem(matchedItems[0]);
                    setSelectedItems(matchedItems);
                }
                setSelectedType('saved_files');
            }
            if (initialItemChanged) {
                useUIStore.getState().setTodoDraft({
                    title: (item as any).key || (item as any).title || (item as any).name || (item as any).label || '',
                    scheduleType: (item as any).is_recurring || (item as any).recurring || (item as any).recurring_cycle
                        ? 'recurring'
                        : 'one-time',
                    recurringCycle: (item as any).recurring_cycle ? String((item as any).recurring_cycle).toLowerCase() : 'daily',
                    time: Number.isFinite(itemScheduleTime)
                        ? format(new Date(itemScheduleTime), 'HH:mm')
                        : format(new Date(), 'HH:mm'),
                    date: Number.isFinite(itemScheduleTime)
                        ? format(new Date(itemScheduleTime), 'yyyy-MM-dd')
                        : format(new Date(), 'yyyy-MM-dd'),
                    isAnytime: !!((item as any).is_anytime ||
                        ((item as any).event_deadline && String((item as any).event_deadline).substring(0, 4) >= '2035')),
                    selectedItem: isCustom ? null : matchedItems[0] || item,
                    selectedType: isCustom ? 'custom' : 'note',
                });
                setOpenAutomatically(!!(item.openAutomatically || item.open_automatically || item.auto_open));
                setActiveSlot('title');
                setIsEditing(true);
                // Focus the title field after the modal has rendered
                setTimeout(() => {
                    titleInputRef.current?.focus();
                }, 80);
            }
        }
        else {
            resetEditor();
            setTitle('');
            setDescription('');
            setTodoShortcut('');
            setTodoHotkey('');
            setSelectedTags([]);
            setIsFavoriteState(false);
            setShortcutError(null);
            setSelectedType('custom');
            setSelectedItem(null);
            setSelectedItems([]);
            setScheduleType('one-time');
            setIsAnytime(false);
            setRecurringCycle(undefined);
            const now = new Date();
            setTime(format(now, 'HH:mm'));
            setDate(format(now, 'yyyy-MM-dd'));
            let h = now.getHours();
            if (h > 12)
                h -= 12;
            if (h === 0)
                h = 12;
            setHourText(h.toString().padStart(2, '0'));
            setMinText(now.getMinutes().toString().padStart(2, '0'));
            setInternalSearchQuery('');
            if (setExternalSearchQuery)
                setExternalSearchQuery('');
            setOpenAutomatically(false);
            setActiveSlot('title');
        }
    }, [initialItem, setExternalSearchQuery, items, itemsSignature, activeTodoId, liveTodoId, isEditMode]);
    React.useEffect(() => {
        if (activeSlot === 'date' && !date) {
            setDate(format(new Date(), 'yyyy-MM-dd'));
        }
        if (activeSlot === 'time' && !time && !isAnytime) {
            setTime(format(new Date(), 'HH:mm'));
        }
    }, [activeSlot, date, time, isAnytime]);
    React.useEffect(() => {
        prevActiveSlotRef.current = activeSlot;
    }, [activeSlot]);
    React.useEffect(() => {
        useUIStore.getState().setTodoDraft({
            title,
            scheduleType,
            recurringCycle,
            time,
            date,
            isAnytime,
            selectedItem,
            selectedType,
            description,
        });
    }, [title, scheduleType, recurringCycle, time, date, isAnytime, selectedItem, selectedType, description]);
    React.useEffect(() => {
        const timeout = setTimeout(() => {
            const input = titleInputRef.current;
            if (input) {
                input.focus();
                const length = input.value.length;
                input.setSelectionRange(length, length);
            }
            if (activeSlot && ['title', 'time'].includes(activeSlot) && !initialItem) {
                setIsEditing(true);
            }
        }, 50);
        return () => clearTimeout(timeout);
    }, []);
    React.useEffect(() => {
        if (!isEditing && !isPickerActive) {
            organisationRef.current?.focus();
            return;
        }
        switch (activeSlot) {
            case 'title':
                titleInputRef.current?.focus();
                break;
            case 'shortcut':
                shortcutInputRef.current?.focus();
                break;
            case 'description':
                descriptionRef.current?.focus();
                break;
            case 'mode':
                document.getElementById('mode-button')?.focus();
                break;
            case 'resource':
                if (isEditing) {
                    setTimeout(() => {
                        const input = document.getElementById('resource-search-input');
                        if (input) {
                            input.focus();
                        }
                        else {
                            document.getElementById('resource-button')?.focus();
                        }
                    }, 50);
                }
                else {
                    document.getElementById('resource-button')?.focus();
                }
                break;
            case 'date':
                if (!isEditing) {
                    organisationRef.current?.focus();
                }
                break;
            case 'time':
                if (timeOptions.length === 1) {
                    setIsTimeEditing(true);
                }
                if (isTimeEditing || timeOptions.length === 1) {
                    setTimeout(() => {
                        document.getElementById('time-input-field')?.focus();
                    }, 100);
                }
                break;
            case 'submit':
                document.getElementById('final-save-button')?.focus();
                break;
        }
    }, [activeSlot, isEditing, selectedType, isAnytime, isPickerActive, timeOptions.length, isTimeEditing]);
    React.useEffect(() => {
        if (activeSlot === 'resource' && isEditing && resultsContainerRef.current) {
            const container = resultsContainerRef.current;
            const focusedEl = container.querySelector(`[data-idx="${focusedIndex}"]`);
            if (focusedEl) {
                focusedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [focusedIndex, activeSlot, isEditing]);
    const handleTypeSelect = (newType: string) => {
        if (!hasSelectedTypeInitially)
            setHasSelectedTypeInitially(true);
        setIsTypeDropdownOpen(false);
        if (newType !== selectedType) {
            setSelectedType(newType);
            setSelectedItem(null);
            setSelectedItems([]);
            setTitle('');
            setDescription('');
            setInternalSearchQuery('');
            if (setExternalSearchQuery)
                setExternalSearchQuery('');
        }
    };
    const filteredItems = useMemo(() => {
        if (selectedType === 'custom')
            return [];
        const q = searchQuery.toLowerCase();
        return items.filter(item => {
            if (!isValidCategory(item))
                return false;
            if (q.length < 1)
                return true;
            return (item.name || '').toLowerCase().includes(q);
        });
    }, [items, selectedType, searchQuery]);
    const categoriesData = useMemo(() => {
        const q = searchQuery.toLowerCase();
        const categories = {
            all: [] as ConvertibleItem[],
            note: [] as ConvertibleItem[],
            snippet: [] as ConvertibleItem[],
            link: [] as ConvertibleItem[],
            organisation: [] as ConvertibleItem[],
            automation: [] as ConvertibleItem[],
            agent: [] as ConvertibleItem[],
            aiPrompt: [] as ConvertibleItem[],
        };
        items.forEach(item => {
            if (!isValidCategory(item))
                return;
            if (q.length > 0 && !(item.name || '').toLowerCase().includes(q))
                return;
            const cat = (item.category || '').toLowerCase();
            categories.all.push(item);
            if (cat === 'note')
                categories.note.push(item);
            else if (cat === 'snippet')
                categories.snippet.push(item);
            else if (cat === 'workspace')
                categories.organisation.push(item);
            else if (['link'].includes(cat))
                categories.link.push(item);
            else if (['aiprompt', 'ai_prompt', 'prompt'].includes(cat))
                categories.aiPrompt.push(item);
            else if (['agent', 'chat_agent', 'ai', 'assistant', 'chat'].includes(cat) || item.data?.type === 'agent')
                categories.aiPrompt.push(item);
            else if (['automation'].includes(cat))
                categories.automation.push(item);
        });
        return categories;
    }, [items, searchQuery]);
    const toggleSelection = (item: ConvertibleItem) => {
        setSelectedItems(prev => {
            const exists = prev.some(i => i.id === item.id);
            if (exists)
                return prev.filter(i => i.id !== item.id);
            return [...prev, item];
        });
    };
    const handleCopyTitleToShortcut = React.useCallback(() => {
        const rawTitle = title.trim() || (selectedItems.length > 0 ? selectedItems[0]?.name || selectedItems[0]?.title || '' : '');
        const formatted = rawTitle.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
        setTodoShortcut(formatted);
        setTimeout(() => {
            shortcutInputRef.current?.focus();
        }, 0);
    }, [title, selectedItems, setTodoShortcut]);
    const isSheetPopupDraft = isNormalTodoMode && workspaceMode === 'editor' && !hasInitialTodoRecord && !activeTodoId;
    const handleCreate = React.useCallback(async (opts?: {
        overrideCreateMore?: boolean;
        autoSave?: boolean;
    } | React.MouseEvent<HTMLButtonElement>) => {
        const shouldCreateMore = opts && typeof opts === 'object' && 'overrideCreateMore' in opts
            ? (opts as any).overrideCreateMore
            : createMore;
        const isAutoSave = Boolean(opts && typeof opts === 'object' && 'autoSave' in opts && (opts as any).autoSave);
        const isSavedFiles = selectedItems.length > 0;
        if (!isSavedFiles && !title.trim()) {
            setTitleError(true);
            titleInputRef.current?.focus();
            setTimeout(() => setTitleError(false), 500);
            return;
        }
        if (!description.trim()) {
            setDescriptionError(true);
            (descriptionRef.current as any)?.focus();
            setTimeout(() => setDescriptionError(false), 500);
            return;
        }
        if (isSavingRef.current)
            return;
        if (shortcutError) {
            setExplicitSaveStatus('error');
            return;
        }
        isSavingRef.current = true;
        setExplicitSaveStatus('saving');
        try {
            const promises: Promise<any>[] = [];
            if (isSavedFiles) {
                promises.push(Promise.resolve(onCreateTodo({
                    type: selectedItems[0]?.category || 'note',
                    item: selectedItems[0]?.data || selectedItems[0],
                    selectedItems,
                    title: title.trim() || getSingleItemName(selectedItems[0]) || 'Untitled Todo',
                    description: description,
                    scheduleType: scheduleType,
                    recurringCycle,
                    time: isAnytime ? null : time,
                    date,
                    openAutomatically,
                    isAnytime: isAnytime,
                    createMore: shouldCreateMore,
                    tagIds: selectedTags.map(t => t.id),
                    shortcut: todoShortcut,
                    hotkey: todoHotkey,
                    isFavorite: isFavoriteState,
                    organisationId: organisationId,
                    scheduleTime,
                    scheduleTimeExplicit: !liveTodoId || scheduleSelectionCommittedRef.current,
                    todoId: liveTodoId,
                    returnToTodoSheet: isSheetPopupDraft,
                })));
            }
            else {
                promises.push(Promise.resolve(onCreateTodo({
                    type: 'custom',
                    item: null,
                    title: title.trim() || 'Untitled Todo',
                    description: description,
                    scheduleType: scheduleType,
                    recurringCycle,
                    time: isAnytime ? null : time,
                    date,
                    openAutomatically,
                    isAnytime: isAnytime,
                    createMore: shouldCreateMore,
                    tagIds: selectedTags.map(t => t.id),
                    shortcut: todoShortcut,
                    hotkey: todoHotkey,
                    isFavorite: isFavoriteState,
                    organisationId: organisationId,
                    scheduleTime,
                    scheduleTimeExplicit: !liveTodoId || scheduleSelectionCommittedRef.current,
                    todoId: liveTodoId,
                    returnToTodoSheet: isSheetPopupDraft,
                })));
            }
            if (!shouldCreateMore) {
                promises.push(new Promise(res => setTimeout(res, 600)));
            }
            const results = await Promise.all(promises);
            const savedTodo = results.find(result => result && typeof result === 'object' && 'id' in result && ('name' in result || 'description' in result)) as TodoRecord | undefined;
            if (savedTodo && !liveTodoId) {
                bindExternalSavedTodo(savedTodo);
            }
            scheduleSelectionCommittedRef.current = false;
            // Refresh the shortcut map immediately; the table also falls back to item.shortcut.
            readAllShortcuts()
                .then(setShortcutsMap)
                .catch(() => { });
            if (shouldCreateMore) {
                if (isEmbedded) {
                    setExplicitSaveStatus('saved');
                    isSavingRef.current = false;
                    setTimeout(() => {
                        setExplicitSaveStatus('idle');
                    }, 1500);
                    return;
                }
                setTitle('');
                setDescription('');
                setTodoShortcut('');
                setTodoHotkey('');
                setSelectedItem(null);
                setSelectedItems([]);
                setSelectedTags([]);
                setEditorTagIds([]);
                setShortcutError(null);
                setIsFavoriteState(false);
                setActiveSlot('title');
                const now = new Date();
                setTime(format(now, 'HH:mm'));
                setDate(format(now, 'yyyy-MM-dd'));
                setIsAnytime(false);
                setIsTimeEditing(false);
                lastInitialItemRef.current = null;
                lastActiveTodoIdRef.current = null;
                lastIsEditModeRef.current = false;
                useUIStore.getState().setTodoCreatePrefill(null);
                const currentProps = useUIStore.getState().activeEditor?.props || {};
                const cleanProps = {
                    ...currentProps,
                    item: null,
                    snippet: null,
                    prefill: null,
                    initialTitle: null,
                    initialDescription: null,
                    initialDraftKey: null,
                    initialDraftContent: null,
                    keepSheetCreateEditorOpen: true,
                };
                if (!workspaceCollectionMode) {
                    useUIStore.getState().openEditor({ type: 'todo', id: 'new', props: cleanProps });
                }
                setIsSheetCreateEditorOpen(true);
                setWorkspaceMode('editor');
                titleInputRef.current?.focus();
                setExplicitSaveStatus('saved');
                isSavingRef.current = false;
                setTimeout(() => {
                    setExplicitSaveStatus('idle');
                }, 1500);
            }
            else {
                setExplicitSaveStatus('saved');
                if (isSheetPopupDraft) {
                    setIsSheetCreateEditorOpen(false);
                    setWorkspaceMode('sheet');
                    resetEditor();
                    setTitle('');
                    setDescription('');
                    setTodoShortcut('');
                    setTodoHotkey('');
                    setSelectedItem(null);
                    setSelectedItems([]);
                    setSelectedTags([]);
                    setEditorTagIds([]);
                    setShortcutError(null);
                    setIsFavoriteState(false);
                }
                setTimeout(() => {
                    setExplicitSaveStatus('idle');
                    isSavingRef.current = false;
                }, 1500);
            }
        }
        catch (error) {
            console.error('[CreateTodoView] Failed to create todo:', error);
            setExplicitSaveStatus('error');
            isSavingRef.current = false;
            setTimeout(() => setExplicitSaveStatus('idle'), 2000);
        }
    }, [
        selectedItems,
        title,
        description,
        scheduleType,
        recurringCycle,
        isAnytime,
        time,
        date,
        scheduleTime,
        openAutomatically,
        createMore,
        isSheetPopupDraft,
        isEmbedded,
        onCreateTodo,
        liveTodoId,
        setTitleError,
        todoShortcut,
        todoHotkey,
        selectedTags,
        isFavoriteState,
        shortcutError,
        resetEditor,
        bindExternalSavedTodo,
        workspaceCollectionMode
    ]);
    React.useEffect(() => {
        const handleSaveTrigger = () => {
            const saveBtn = document.getElementById('final-save-button');
            if (saveBtn)
                (saveBtn as HTMLButtonElement).click();
            else
                handleCreate();
        };
        window.addEventListener('trigger-todo-save', handleSaveTrigger);
        return () => window.removeEventListener('trigger-todo-save', handleSaveTrigger);
    }, [handleCreate]);
    const cleanDescription = (rawDesc: any): string => {
        if (!rawDesc)
            return '';
        const text = typeof rawDesc === 'object' && rawDesc !== null ? JSON.stringify(rawDesc) : String(rawDesc);
        return text.replace(/<\/?[^>]+(>|$)/g, '');
    };
    const handleKeyDown = React.useCallback((e: React.KeyboardEvent | KeyboardEvent) => {
        const eventTarget = e.target instanceof Element ? e.target : null;
        const sheetIsActive = isNormalTodoMode && !hideRightPanel && !hasInitialTodoRecord && !activeTodoId && workspaceMode === 'sheet';
        if (sheetIsActive ||
            !isTodoKeyboardEventWithin(eventTarget, organisationRef.current, '[data-todo-keyboard-surface="editor"]')) {
            return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            lastArrowPressedRef.current = Date.now();
        }
        // Save shortcuts apply only to the active editor, after child overlays have had priority.
        if (e.key === 'Enter') {
            const isSaveAndCreateNewShortcut = (isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key === 'Enter';
            const isSaveShortcut = (isMac ? e.metaKey : e.ctrlKey) && !e.shiftKey && e.key === 'Enter';
            if (isSaveAndCreateNewShortcut || isSaveShortcut) {
                if (eventTarget.closest('.new-due-date-dropdown, [data-todo-keyboard-surface="editor"]') ||
                    (isEditing && (activeSlot === 'mode' || activeSlot === 'resource' || activeSlot === 'date')) ||
                    mentionQuery !== null) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                if ('stopImmediatePropagation' in e && typeof e.stopImmediatePropagation === 'function') {
                    e.stopImmediatePropagation();
                }
                const now = Date.now();
                if (now - lastEnterTime.current < 150)
                    return;
                lastEnterTime.current = now;
                handleCreate({
                    overrideCreateMore: isSaveAndCreateNewShortcut,
                });
                return;
            }
        }
        const targetElement = eventTarget;
        if (targetElement?.closest('.new-due-date-dropdown')) {
            return;
        }
        // The native calendar is rendered outside the dropdown's DOM subtree. Keep
        // Escape with the date picker until the picker itself has handled it.
        if (e.key === 'Escape' && activeSlot === 'date' && isEditing && document.querySelector('.new-due-date-dropdown')) {
            return;
        }
        if (e.key === 'Escape') {
            if (activeSlot === 'resource' && isEditing) {
                e.preventDefault();
                e.stopPropagation();
                setIsEditing(false);
                return;
            }
        }
        if (mentionQuery !== null && mentionSuggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                e.stopPropagation();
                setMentionIndex(prev => (prev + 1) % mentionSuggestions.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                e.stopPropagation();
                setMentionIndex(prev => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
                return;
            }
            if ((e.key === 'Enter' || e.key === 'Tab') && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                e.stopPropagation();
                handleSelectMention(mentionSuggestions[mentionIndex]);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                setMentionQuery(null);
                return;
            }
        }
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            if (activeSlot === 'resource' && isEditing) {
                if (targetElement?.id === 'resource-search-input' && !searchQuery) {
                    const categories = ['all', 'note', 'snippet', 'link', 'workspace', 'aiPrompt'] as const;
                    const currentIndex = categories.findIndex(category => category === selectedCategory);
                    const nextIndex = Math.max(0, Math.min(categories.length - 1, currentIndex + (e.key === 'ArrowRight' ? 1 : -1)));
                    if (nextIndex !== currentIndex) {
                        e.preventDefault();
                        setSelectedCategory(categories[nextIndex]);
                        setFocusedIndex(0);
                    }
                }
                return;
            }
            const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
            // Let the custom time picker handle its own arrow navigation natively
            if (e.target instanceof Element && e.target.closest('.custom-time-picker-popup')) {
                return;
            }
            if (isInput &&
                (activeSlot === 'title' ||
                    activeSlot === 'shortcut' ||
                    activeSlot === 'resource' ||
                    activeSlot === 'description' ||
                    activeSlot === 'time')) {
                const target = e.target as HTMLInputElement | HTMLTextAreaElement;
                const isAtStart = target.selectionStart === 0 && target.selectionEnd === 0;
                const isAtEnd = target.selectionStart === target.value.length && target.selectionEnd === target.value.length;
                if (e.key === 'ArrowLeft' && !isAtStart)
                    return;
                if (e.key === 'ArrowRight' && !isAtEnd)
                    return;
            }
            const currentIndex = activeSlot ? slots.indexOf(activeSlot) : -1;
            let targetSlot: (typeof slots)[number] | null = null;
            if (e.key === 'ArrowRight' && currentIndex < slots.length - 1)
                targetSlot = slots[currentIndex + 1];
            else if (e.key === 'ArrowLeft' && currentIndex > 0)
                targetSlot = slots[currentIndex - 1];
            if (targetSlot) {
                e.preventDefault();
                e.stopPropagation();
                setIsPickerActive(false);
                if (activeSlot === 'time')
                    setIsTimeEditing(false);
                setActiveSlot(targetSlot);
                setFocusedIndex(0);
                setIsEditing(true);
                return;
            }
        }
        if (e.key === 'Tab') {
            const isInlineTimeInput = e.target instanceof Element && e.target.closest('.inline-time-input');
            if (isInlineTimeInput)
                return;
            if (activeSlot === 'time' && isTimeEditing) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            const currentIndex = activeSlot ? slots.indexOf(activeSlot) : -1;
            let nextIndex = e.shiftKey
                ? (currentIndex - 1 + slots.length) % slots.length
                : (currentIndex + 1) % slots.length;
            setActiveSlot(slots[nextIndex]);
            setFocusedIndex(0);
            setIsEditing(true);
            return;
        }
        if (!isEditing && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            if (activeSlot && ['type', 'mode', 'cycle', 'time', 'date'].includes(activeSlot)) {
                setIsEditing(true);
                setFocusedIndex(0);
                e.preventDefault();
                return;
            }
        }
        if (isEditing) {
            const handleVerticalNav = (options: readonly any[], currentIdx: number, setter: (idx: number) => void, liveUpdate?: (id: any) => void) => {
                const nextIndex = e.key === 'ArrowDown'
                    ? (currentIdx + 1) % options.length
                    : (currentIdx - 1 + options.length) % options.length;
                setter(nextIndex);
                if (liveUpdate)
                    liveUpdate(options[nextIndex].id);
                e.stopPropagation();
                e.preventDefault();
            };
            if (activeSlot === 'resource' && isEditing) {
                const itemsList = categoriesData[selectedCategory === 'workspace' ? 'organisation' : selectedCategory] || [];
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setFocusedIndex(prev => (itemsList.length > 0 ? (prev + 1) % itemsList.length : 0));
                    return;
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setFocusedIndex(prev => (itemsList.length > 0 ? (prev - 1 + itemsList.length) % itemsList.length : 0));
                    return;
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const targetItem = itemsList[focusedIndex];
                    if (targetItem) {
                        toggleSelection(targetItem);
                    }
                    return;
                }
            }
            if (activeSlot === 'title') {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActiveSlot('description');
                    setIsEditing(true);
                    return;
                }
            }
            if (activeSlot === 'description') {
                const target = e.target as HTMLTextAreaElement;
                const textBeforeCursor = target.value.substring(0, target.selectionStart);
                const textAfterCursor = target.value.substring(target.selectionEnd);
                const isOnFirstLine = !textBeforeCursor.includes('\n');
                const isOnLastLine = !textAfterCursor.includes('\n');
                if (e.key === 'ArrowUp' && isOnFirstLine) {
                    e.preventDefault();
                    setActiveSlot('title');
                    setIsEditing(true);
                    return;
                }
                if (e.key === 'ArrowDown' && isOnLastLine) {
                    e.preventDefault();
                    setActiveSlot('mode');
                    setIsEditing(true);
                    return;
                }
                return;
            }
            if (activeSlot === 'mode') {
                if (e.key === 'ArrowUp' && !isEditing) {
                    e.preventDefault();
                    setActiveSlot('description');
                    setIsEditing(true);
                    return;
                }
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    const modeOpts = [{ id: 'one-time' }, { id: 'daily' }, { id: 'weekly' }, { id: 'monthly' }];
                    handleVerticalNav(modeOpts, focusedIndex, setFocusedIndex);
                    return;
                }
            }
            if (activeSlot === 'date') {
                if (e.key === 'ArrowUp' && !isEditing) {
                    e.preventDefault();
                    setActiveSlot('mode');
                    setIsEditing(true);
                    setFocusedIndex(0);
                    return;
                }
                if (isEditing && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                    const dateOpts = [{ id: 'custom' }, { id: 'tomorrow' }, { id: 'in-one-week' }];
                    handleVerticalNav(dateOpts, focusedIndex, setFocusedIndex);
                    return;
                }
            }
            if (activeSlot === 'time' && !isTimeEditing) {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    handleVerticalNav([{ id: 'anytime' }, { id: 'specific' }], focusedIndex, setFocusedIndex);
                    return;
                }
            }
        }
        if (e.key === 'Enter') {
            const now = Date.now();
            if (now - lastEnterTime.current < 150) {
                e.preventDefault();
                return;
            }
            lastEnterTime.current = now;
            if (isEditing) {
                if (activeSlot === 'description') {
                    return;
                }
                e.preventDefault();
                if (activeSlot === 'title') {
                    setActiveSlot('description');
                    setIsEditing(true);
                }
                else if (activeSlot === 'resource') {
                    const targetItem = filteredItems[focusedIndex];
                    if (targetItem) {
                        toggleSelection(targetItem);
                    }
                }
                else if (activeSlot === 'mode') {
                    const modeOpts = [{ id: 'one-time' }, { id: 'daily' }, { id: 'weekly' }, { id: 'monthly' }];
                    const selectedOpt = modeOpts[focusedIndex];
                    if (selectedOpt) {
                        if (selectedOpt.id === 'one-time') {
                            setScheduleType('one-time');
                            setRecurringCycle(undefined);
                        }
                        else {
                            setScheduleType('recurring');
                            setRecurringCycle(selectedOpt.id as any);
                        }
                        setIsEditing(false);
                        setActiveSlot('mode');
                        setFocusedIndex(0);
                    }
                }
                else if (activeSlot === 'date') {
                    if (isEditing) {
                        const dateOpts = [{ id: 'custom' }, { id: 'tomorrow' }, { id: 'in-one-week' }];
                        const selectedOpt = dateOpts[focusedIndex] || dateOpts[0];
                        if (selectedOpt.id === 'custom') {
                            setIsEditing(false);
                            dateInputRef.current?.focus();
                            try {
                                dateInputRef.current?.showPicker();
                            }
                            catch (e) {
                                console.error('[Date Custom Enter] showPicker error:', e);
                            }
                        }
                        else if (selectedOpt.id === 'tomorrow') {
                            const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
                            commitScheduleSelection(tomorrowStr);
                            setIsEditing(false);
                            setActiveSlot('resource');
                            setFocusedIndex(0);
                        }
                        else if (selectedOpt.id === 'in-one-week') {
                            const nextWeekStr = format(addDays(new Date(), 7), 'yyyy-MM-dd');
                            commitScheduleSelection(nextWeekStr);
                            setIsEditing(false);
                            setActiveSlot('resource');
                            setFocusedIndex(0);
                        }
                    }
                    else {
                        setIsEditing(true);
                        setFocusedIndex(0);
                    }
                }
                else if (activeSlot === 'time') {
                    if (isTimeEditing) {
                        setIsTimeEditing(false);
                        setActiveSlot('resource');
                        setIsEditing(true);
                    }
                    else {
                        const targetTimeOpt = focusedIndex === 0 ? 'anytime' : 'specific';
                        if (targetTimeOpt === 'anytime') {
                            setIsAnytime(true);
                            setActiveSlot('resource');
                            setIsEditing(true);
                        }
                        else {
                            setIsAnytime(false);
                            setIsTimeEditing(true);
                        }
                    }
                }
                else if (activeSlot === 'submit') {
                    handleCreate();
                }
                setFocusedIndex(0);
            }
            else {
                if (activeSlot === 'date') {
                    setIsEditing(true);
                    setFocusedIndex(0);
                }
                else {
                    setIsEditing(true);
                }
                e.preventDefault();
            }
        }
    }, [
        activeSlot,
        slots,
        types,
        selectedType,
        selectedItem,
        filteredItems,
        title,
        time,
        scheduleType,
        isEditing,
        focusedIndex,
        onClose,
        handleCreate,
        modeOptions,
        timeOptions,
        repeatOptions,
        isMac,
        isPickerActive,
        isAnytime,
        isTimeEditing,
        hourText,
        minText,
        amPm,
        commitScheduleSelection,
        isNormalTodoMode,
        hideRightPanel,
        hasInitialTodoRecord,
        activeTodoId,
        workspaceMode,
        searchQuery,
        selectedCategory,
        categoriesData,
        mentionQuery,
        mentionSuggestions,
        mentionIndex,
        handleSelectMention
    ]);
    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [handleKeyDown]);
    useEffect(() => {
        const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
            if (isTimeEditing) {
                setIsTimeEditing(false);
                return true;
            }
            // First Escape closes the active property popover.
            if (isEditing && activeSlot && ['mode', 'date', 'resource', 'time'].includes(activeSlot)) {
                setIsEditing(false);
                return true;
            }
            if (isNormalTodoMode && workspaceMode === 'editor' && !hasInitialTodoRecord) {
                setIsSheetCreateEditorOpen(false);
                setWorkspaceMode('sheet');
                return true;
            }
            // For title/description (or any other slot), single Escape closes the modal
            onClose();
            return true;
        });
        return unregister;
    }, [activeSlot, activeTodoId, hasInitialTodoRecord, isEditing, isNormalTodoMode, isTimeEditing, onClose, workspaceMode]);
    const toolbarInitialSnippet = useMemo(() => ({
        tagIds: editorTagIds,
        category: 'todo',
        shortcut: todoShortcut || '',
    }), [editorTagIds, todoShortcut]);
    const resetTodoDraftForSheet = useCallback(() => {
        resetEditor();
        setTitle('');
        setDescription('');
        setTodoShortcut('');
        setTodoHotkey('');
        setSelectedTags([]);
        setIsFavoriteState(false);
        setShortcutError(null);
        setSelectedType('custom');
        setSelectedItem(null);
        setSelectedItems([]);
        setScheduleType('one-time');
        setIsAnytime(false);
        setRecurringCycle(undefined);
        const now = new Date();
        setTime(format(now, 'HH:mm'));
        setDate(format(now, 'yyyy-MM-dd'));
    }, [resetEditor, setDescription, setRecurringCycle, setScheduleType, setSelectedItems, setTitle, setTodoShortcut]);
    const handleShowSheetCreateEditor = useCallback(() => {
        if (onLoadTodo)
            onLoadTodo(null as any);
        resetTodoDraftForSheet();
        setIsSheetCreateEditorOpen(true);
        setWorkspaceMode('editor');
        setTimeout(() => titleInputRef.current?.focus(), 0);
    }, [onLoadTodo, resetTodoDraftForSheet]);
    const handleCloseSheetCreateEditor = useCallback(() => {
        resetTodoDraftForSheet();
        setIsSheetCreateEditorOpen(false);
        setWorkspaceMode('sheet');
        if (onLoadTodo)
            onLoadTodo(null as any);
    }, [onLoadTodo, resetTodoDraftForSheet]);
    const handleBackToTodoSheet = useCallback(async () => {
        if (isDirtyRef.current) {
            const saved = flushSave ? await flushSave() : await handleSave(false);
            if (!saved)
                return;
        }
        handleCloseSheetCreateEditor();
    }, [flushSave, handleCloseSheetCreateEditor, handleSave]);
    const handleSheetFieldUpdate = useCallback(async (id: string, updates: Partial<TodoRecord>) => {
        await updateTodoContent(id, updates);
        const currentId = activeTodoId || liveTodoId || (initialItem as any)?.id || (initialItem as any)?.todo_id;
        if (String(currentId || '') === String(id) && onLoadTodo) {
            const nextTodo = { ...(existingTodos?.find(item => item.id === id) || {}), ...updates, id } as TodoRecord;
            onLoadTodo(nextTodo);
        }
    }, [activeTodoId, existingTodos, initialItem, liveTodoId, onLoadTodo]);
    const openTodoInFullEditor = useCallback(async (todo: TodoRecord | null | undefined) => {
        if (!todo?.id)
            return;
        if (isDirtyRef.current) {
            const saved = flushSave ? await flushSave() : await handleSave(false);
            if (!saved)
                return;
        }
        if (workspaceCollectionMode) {
            if (onLoadTodo)
                onLoadTodo(todo);
            setIsSheetCreateEditorOpen(false);
            setWorkspaceMode('editor');
            setTimeout(() => titleInputRef.current?.focus(), 0);
            return;
        }
        useUIStore.getState().openEditor({
            type: 'todo',
            id: todo.id,
            props: { item: todo, returnToCollectionSheet: true },
        });
    }, [flushSave, handleSave, onLoadTodo, workspaceCollectionMode]);
    const shouldRenderTodoSheetWorkspace = isNormalTodoMode && !hideRightPanel && !hasInitialTodoRecord && !activeTodoId && workspaceMode === 'sheet';
    const shouldRenderTodoEditorWorkspace = !shouldRenderTodoSheetWorkspace;
    const shouldRenderTodoEditorAsPopup = false;
    const todoGroupingActionSlot = shouldRenderTodoSheetWorkspace ? (<div ref={todoGroupingMenuRef} className="relative" data-ignore-grid-nav="true">
      <button type="button" onClick={event => {
            event.preventDefault();
            event.stopPropagation();
            setIsTodoGroupingMenuOpen(open => !open);
        }} className={clsx('w-9 h-9 p-0 rounded-lg transition-all flex items-center justify-center cursor-pointer border-none bg-transparent shadow-none focus:outline-none', isTodoGroupingMenuOpen
            ? 'text-[var(--color-textPrimary)] bg-[var(--color-hoverBg)]'
            : 'text-[var(--color-iconDefault)] hover:text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)]')} title="Group Todo" aria-label="Group Todo" aria-expanded={isTodoGroupingMenuOpen}>
        <GroupingFilterIcon size={16}/>
      </button>
      {isTodoGroupingMenuOpen && (<div className="absolute right-0 top-full mt-1.5 w-[180px] rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-popupBg)] p-1 shadow-2xl" onMouseDown={event => event.stopPropagation()}>
          {[
                { id: 'default' as const, label: 'Default' },
                { id: 'priority' as const, label: 'By priority' }
            ].map(option => {
                const selected = todoSheetGroupingMode === option.id;
                return (<button key={option.id} type="button" onClick={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        setTodoSheetGroupingMode(option.id);
                        void setStoredTodoSheetGroupingMode(option.id);
                        setIsTodoGroupingMenuOpen(false);
                    }} className={clsx('flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-[12px] font-medium transition-colors', selected
                        ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)]'
                        : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]')}>
                <span>{option.label}</span>
                {selected && <FaCheck size={10} className="shrink-0 text-[var(--color-textPrimary)]"/>}
              </button>);
            })}
        </div>)}
    </div>) : null;
    const renderTodoEditorWorkspace = (content: React.ReactNode) => shouldRenderTodoEditorAsPopup && typeof document !== 'undefined'
        ? ReactDOM.createPortal(content, document.body)
        : content;
    const todoSharedPropertiesToolbar = (<SharedPropertiesToolbar key={liveTodoId || 'new-todo'} initialSnippet={toolbarInitialSnippet} currentSnapshot={{
            entityType: 'todo',
            name: title,
            description: description,
            isDone: liveTodo?.isDone ?? false,
            scheduleTime: scheduleTime,
            scheduleType: scheduleType,
            recurringType: recurringCycle,
            shortcut: todoShortcut,
            references: (selectedItems || []).map((i: any) => ({ ...i })),
            tagIds: [...(editorTagIds || [])],
            organisationId,
        }} versionHistory={versionHistory} compoundId={liveTodoId
            ? getItemCompoundId({
                id: liveTodoId,
                organisation_id: organisationId,
                snippet: { id: liveTodoId, category: 'todo' },
            })
            : 'new'} defaultName={title} showTodo={false} showLocationPicker={false} showDocsButton={false} reserveTopRightChromeSpace={isNormalTodoMode && !isEmbedded && !shouldRenderTodoEditorAsPopup} versionHistoryItems={versionHistoryItems} selectedVersionId={selectedVersionId} onSelectVersion={setSelectedVersionId} entityType="todo" onChange={props => {
            if (props.isFav !== undefined)
                setIsFavoriteState(props.isFav);
            if (props.pendingHotkey !== undefined)
                setTodoHotkey(props.pendingHotkey);
            if (props.pendingShortcut !== undefined) {
                setTodoShortcut(props.pendingShortcut);
                void handleSave(true, { shortcut: props.pendingShortcut });
            }
            if (props.organisationId !== undefined)
                setOrganisationId(props.organisationId);
            if (props.selectedTags !== undefined) {
                const newTIds = props.selectedTags.map(t => t.id);
                const currentTIds = (editorTagIds || []).join(',');
                const nextTIds = newTIds.join(',');
                if (currentTIds !== nextTIds) {
                    setSelectedTags(props.selectedTags);
                    setEditorTagIds(newTIds);
                    void handleSave(true, { tagIds: newTIds });
                }
            }
        }} layout="horizontal" showShortcut={true} openPopupsToLeft={true} openPopupsToBottom={true} appearanceScope={appearanceScope} appearanceTokens={isWidgetMode ? appearanceTokens : { ...appearanceTokens, ...FUNCTIONAL_EDITOR_SURFACE_STYLE }} propertyPersistenceAdapter={propertyPersistenceAdapter}/>);
    return (<>
      <style>{hideNativeIconsStyle}</style>
      <EditorContainer useBlackSurface={!isWidgetMode} style={appearanceTokens} className={clsx(isEmbedded
            ? 'w-full h-full flex flex-col text-left text-[var(--color-textPrimary)] bg-transparent overflow-hidden'
            : isWidgetMode
                ? 'w-full h-full flex flex-col text-left text-[var(--color-textPrimary)] bg-transparent overflow-hidden'
                : isNormalTodoMode
                    ? 'w-full h-full flex flex-col gap-1 text-left text-[var(--color-textPrimary)] bg-transparent px-4 md:px-6 py-2'
                    : 'w-full h-full flex flex-col gap-1 text-left text-[var(--color-textPrimary)] bg-transparent px-6 md:px-12 lg:px-24 py-4')} innerClassName={isEmbedded
            ? 'flex flex-row items-stretch relative bg-transparent w-full h-full min-h-0 max-h-full overflow-hidden border-none'
            : isWidgetMode
                ? 'flex flex-col w-full h-full overflow-hidden bg-transparent'
                : isNormalTodoMode
                    ? 'flex flex-row items-stretch gap-2 relative bg-transparent w-full h-full min-h-0 max-h-full overflow-hidden border-none'
                    : 'flex flex-row items-stretch gap-2 relative bg-transparent mx-auto min-h-[450px] h-auto max-h-[860px] max-h-[90vh] overflow-visible w-[calc(100%-20px)] max-w-[1800px]'}>
        {!isWidgetMode && (<EditorTopRightChrome docsUrl={BRAND.docs.todos} onClose={onClose} actionSlot={todoGroupingActionSlot} sheetCreateAction={shouldRenderTodoSheetWorkspace ? { label: 'New Todo', onCreate: handleShowSheetCreateEditor } : undefined} sheetExpansion={shouldRenderTodoSheetWorkspace
                ? {
                    isExpanded: isCollectionSheetExpanded,
                    onToggle: () => setIsCollectionSheetExpanded(expanded => !expanded),
                    label: 'Todo',
                }
                : undefined}/>)}

        {/* Left Editor Surface */}
        <div className={isEmbedded
            ? 'flex-1 min-w-0 flex flex-col h-full overflow-hidden rounded-none border-none shadow-none bg-transparent relative'
            : isWidgetMode
                ? 'flex-1 min-w-0 flex flex-col h-full overflow-hidden bg-transparent border-none relative'
                : isNormalTodoMode
                    ? 'flex-1 min-w-0 flex flex-col h-full overflow-hidden rounded-none border-none shadow-none bg-[var(--color-editorBg)] relative'
                    : 'flex-1 min-w-0 flex flex-col h-full overflow-hidden rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-editorBg)] relative'}>
          {shouldRenderTodoSheetWorkspace && (<TodoCollectionSheetView todos={sortedTodos} items={items} shortcutsMap={shortcutsMap} hotkeysMap={hotkeysMap} tagNamesMap={todoTagNamesMap} groupingMode={todoSheetGroupingMode} isExpanded={isCollectionSheetExpanded} 
        // Keep the sheet stats implementation available, but do not display it in the Todo editor.
        showStats={false} isFavorite={isFavorite} onOpenTodo={todo => {
                void openTodoInFullEditor(todo);
            }} onToggleFavorite={id => {
                const todo = existingTodos?.find(item => item.id === id);
                void toggleFavorite(id, 'todo', (todo as any)?.key);
            }} onDeleteTodo={async (id) => {
                const record = existingTodos?.find(item => item.id === id);
                if (record) {
                    const compoundId = getItemCompoundId({
                        id: record.id,
                        organisation_id: record.organisationId,
                        snippet: { id: record.id, category: 'todo' },
                    });
                    await clearShortcut(id, compoundId, 'todo');
                    await apiClearHotkey(id, compoundId, 'todo');
                }
                await deleteTodo(id);
                if (onDeleteTodo)
                    onDeleteTodo(id);
            }} onUpdateTitle={(id, value) => handleSheetFieldUpdate(id, { name: value.trim() || 'Untitled Todo' })} onUpdateDescription={(id, value) => handleSheetFieldUpdate(id, { description: value })} onUpdateShortcut={async (id, value) => {
                const record = existingTodos?.find(item => item.id === id);
                if (!record)
                    return;
                const compoundId = getItemCompoundId({
                    id: record.id,
                    organisation_id: record.organisationId,
                    snippet: { id: record.id, category: 'todo' },
                });
                const cleanShortcut = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                if (cleanShortcut) {
                    await saveShortcut(id, compoundId, cleanShortcut, record.name || 'Untitled Todo', 'todo');
                }
                else {
                    await clearShortcut(id, compoundId, 'todo');
                }
                await handleSheetFieldUpdate(id, { shortcut: cleanShortcut });
                readAllShortcuts()
                    .then(setShortcutsMap)
                    .catch(() => { });
            }} onUpdateHotkey={async (id, value) => {
                const record = existingTodos?.find(item => item.id === id);
                if (!record)
                    return;
                const compoundId = getItemCompoundId({
                    id: record.id,
                    organisation_id: record.organisationId,
                    snippet: { id: record.id, category: 'todo' },
                });
                if (value.trim()) {
                    await apiSaveHotkey(id, compoundId, value.trim(), 'todo');
                }
                else {
                    await apiClearHotkey(id, compoundId, 'todo');
                }
            }} onUpdateSchedule={(id, value) => handleSheetFieldUpdate(id, {
                scheduleType: value.scheduleType,
                recurringType: value.scheduleType === 'recurring' ? value.recurringType : undefined,
            })} onUpdateDueDate={(id, value) => handleSheetFieldUpdate(id, { scheduleTime: value.scheduleTime })} onUpdateReferences={(id, references) => handleSheetFieldUpdate(id, { references: mapTodoReferences(references) })} onUpdateTags={(id, tagIds) => handleSheetFieldUpdate(id, { tagIds, tags: tagIds })} onUpdatePriority={(id, value) => handleSheetFieldUpdate(id, { priority: value })} onCompleteTodo={id => updateTodo(id, true)}/>)}
          {shouldRenderTodoEditorWorkspace
            ? renderTodoEditorWorkspace(<div style={shouldRenderTodoEditorAsPopup
                    ? {
                        ...appearanceTokens,
                        backgroundColor: 'color-mix(in srgb, var(--color-overlayBg) 70%, transparent)',
                    }
                    : undefined} className={shouldRenderTodoEditorAsPopup
                    ? 'fixed inset-0 z-[100000] flex items-start justify-center overflow-hidden px-4 pb-8 pt-[7vh] backdrop-blur-sm'
                    : 'contents'}>
                  <div style={shouldRenderTodoEditorAsPopup
                    ? {
                        width: 'min(900px, calc(100vw - 72px))',
                        maxHeight: 'min(620px, calc(100vh - 96px))',
                        ...TODO_EDITOR_DARK_APPEARANCE_TOKENS,
                    } as any
                    : undefined} className={shouldRenderTodoEditorAsPopup
                    ? 'flex flex-col overflow-hidden rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-editorBg)] shadow-2xl'
                    : 'contents'}>
                    <EditorHeader hideBorder={(isNormalTodoMode || isEmbedded) && !shouldRenderTodoEditorAsPopup} title={isEmbedded && !shouldRenderTodoEditorAsPopup ? '' : isEditMode ? 'Edit Todo' : 'Create a Todo'} contentClassName={shouldRenderTodoEditorAsPopup ? 'px-5' : undefined} titleClassName={isNormalTodoMode && !shouldRenderTodoEditorAsPopup
                    ? 'absolute left-1/2 top-1/2 w-full max-w-[740px] -translate-x-1/2 -translate-y-1/2 xl:-ml-12 px-4 md:px-6 text-lg font-bold text-[var(--color-textPrimary)] truncate pointer-events-none'
                    : undefined} isDirty={isDirty} saveStatus={(explicitSaveStatus !== 'idle' ? explicitSaveStatus : saveStatus) as any} lastSavedAt={lastSavedAt} activeId={liveTodoId} onCloseClick={shouldRenderTodoEditorAsPopup ? handleCloseSheetCreateEditor : onClose} onBackClick={isEmbedded && !shouldRenderTodoEditorAsPopup
                    ? undefined
                    : shouldReturnToCollectionSheet
                        ? onClose
                        : isNormalTodoMode && workspaceMode === 'editor'
                            ? handleBackToTodoSheet
                            : isFullScreenMode ? onClose : undefined} showCloseButton={shouldRenderTodoEditorAsPopup} closeButtonAtHeaderEdge={shouldRenderTodoEditorAsPopup} closeButtonClassName={shouldRenderTodoEditorAsPopup ? '-mr-1' : undefined} headerActions={isEmbedded && !shouldRenderTodoEditorAsPopup ? undefined : todoSharedPropertiesToolbar}/>

                    <div className={shouldRenderTodoEditorAsPopup
                    ? 'relative flex flex-none min-h-0'
                    : 'flex-1 flex flex-col min-h-0 relative'}>
                      <div ref={organisationRef} tabIndex={-1} className={clsx('outline-none', isWidgetMode
                    ? 'w-full flex-1 flex flex-col min-h-0 px-3 py-2'
                    : isWorkspaceCollectionMode
                        ? 'w-full max-w-[900px] mx-auto xl:-translate-x-12 flex-1 flex flex-col min-h-0 px-4 md:px-6 pt-1 pb-4'
                        : isEmbedded
                            ? 'w-full max-w-[1480px] flex-1 flex flex-col min-h-0 px-8 md:px-10 lg:px-12 pt-3 pb-4'
                            : isNormalTodoMode && shouldRenderTodoEditorAsPopup
                                ? 'w-[calc(100%_-_252px)] max-w-[620px] flex-none flex flex-col min-h-0 px-4 md:px-6 pt-1 pb-4'
                                : isNormalTodoMode
                                    ? 'w-full max-w-[740px] mx-auto xl:-translate-x-12 flex-1 flex flex-col min-h-0 px-4 md:px-6 pt-1 pb-4'
                                    : 'w-full flex-1 flex flex-col min-h-0 px-6 pt-1 pb-4')}>
                        {/* Left Column: Input Fields & Description */}
                        <div className={shouldRenderTodoEditorAsPopup
                    ? 'flex-none flex flex-col relative min-h-0'
                    : 'flex-1 flex flex-col relative min-h-0'}>
                          {isEmbedded && !shouldRenderTodoEditorAsPopup && (<div className={clsx('mb-5 grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-8', isWorkspaceCollectionMode ? 'max-w-[900px]' : 'max-w-[1340px] pr-32')}>
                              <h2 className="relative flex min-w-0 items-center gap-3 text-xl font-bold text-[var(--color-textPrimary)]">
                                {(shouldReturnToCollectionSheet || isFullScreenMode || (isNormalTodoMode && workspaceMode === 'editor')) && (<EditorBackButton outsideTitle onClick={shouldReturnToCollectionSheet || isFullScreenMode ? onClose : handleBackToTodoSheet}/>)}
                                {isEditMode ? 'Edit Todo' : 'Create a Todo'}
                              </h2>
                              <div className="flex justify-end pt-0.5">
                                {todoSharedPropertiesToolbar}
                              </div>
                            </div>)}
                          {/* Title & Shortcut block */}
                          <div className={clsx('flex flex-col w-full flex-shrink-0 relative', isWorkspaceCollectionMode
                    ? 'max-w-[900px]'
                    : isEmbedded && !shouldRenderTodoEditorAsPopup
                        ? 'max-w-[1080px]'
                        : '')}>
                            <div className="w-2/5">
                            <EditorTitleShortcutInput showShortcut={false} titleError={titleError} shortcutError={shortcutError} isOverrideable={isShortcutOverrideable} onResolveShortcut={handleResolveShortcut} shortcutReferenceId={initialItem?.id || liveTodoId || 'new'} title={title} setTitle={val => {
                    setTitle(val);
                    if (titleError)
                        setTitleError(false);
                }} shortcut={todoShortcut} setShortcut={setTodoShortcut} titleRef={titleInputRef} shortcutRef={shortcutInputRef} onArrowDownPress={() => descriptionRef.current?.focus()} onTitleBlur={() => {
                    if (!title.trim()) {
                        setTitleError(true);
                    }
                }} onTitleEnter={(shiftKey, e) => {
                    if (e?.ctrlKey || e?.metaKey) {
                        handleCreate({
                            overrideCreateMore: shiftKey,
                        });
                    }
                    else {
                        if (!title.trim()) {
                            setTitleError(true);
                        }
                        else {
                            descriptionRef.current?.focus();
                        }
                    }
                }} onCopyTitleToShortcut={handleCopyTitleToShortcut}/>
                          </div>

                           </div> {/* Description Field */}
                          <div className={clsx(shouldRenderTodoEditorAsPopup
                    ? 'flex-none flex flex-col gap-1.5 relative min-h-0 mt-4'
                    : 'flex-1 flex flex-col gap-1.5 relative min-h-[120px] mt-4', isWorkspaceCollectionMode
                    ? 'max-w-[900px]'
                    : isEmbedded && !shouldRenderTodoEditorAsPopup
                        ? 'max-w-[1080px]'
                        : '')}>
                            <label className="text-xs font-semibold text-[var(--color-textSecondary)] px-3.5 flex items-center gap-1">
                              Description <span className="text-red-500">*</span>
                            </label>
                            <div className={clsx('relative rounded-xl border transition-all duration-200 px-3.5 py-2 cursor-text', shouldRenderTodoEditorAsPopup
                    ? 'h-[250px] overflow-visible'
                    : 'flex flex-col gap-3 overflow-hidden', descriptionError
                    ? 'border-red-500 ring-1 ring-red-500 bg-red-500/5'
                    : 'border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] shadow-sm')} onClick={e => {
                    if (e.target === e.currentTarget) {
                        descriptionRef.current?.focus();
                    }
                }}>
                              <div className={shouldRenderTodoEditorAsPopup
                    ? 'relative h-[190px]'
                    : 'flex flex-col relative'}>
                                <textarea ref={descriptionRef as any} data-todo-local-escape={mentionQuery !== null ? 'true' : undefined} data-todo-popup-editor={shouldRenderTodoEditorAsPopup ? 'true' : undefined} placeholder="Add description..." value={description} onChange={e => {
                    handleDescriptionChange(e);
                    adjustDescriptionHeight();
                }} onFocus={() => {
                    setActiveSlot('description');
                    setIsEditing(true);
                }} style={{
                    minHeight: shouldRenderTodoEditorAsPopup ? '150px' : '220px',
                    height: shouldRenderTodoEditorAsPopup ? '190px' : undefined,
                    maxHeight: shouldRenderTodoEditorAsPopup ? '190px' : 'clamp(280px, 35vh, 400px)',
                    overflow: 'auto',
                    resize: 'none',
                }} className="w-full bg-transparent outline-none border-none shadow-none focus:ring-0 resize-none text-sm font-semibold font-sans text-[var(--color-textPrimary)] placeholder-[var(--color-textPlaceholder)] custom-scrollbar"/>

                                {!description && !shouldRenderTodoEditorAsPopup && (<div className="absolute left-1 bottom-1 text-[var(--color-textMuted)] text-[13px] pointer-events-none select-none flex items-center gap-1.5 opacity-60">
                                    Type{' '}
                                    <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textPrimary)]">
                                      @
                                    </kbd>{' '}
                                    to attach
                                  </div>)}
                              </div>

                              {!description && shouldRenderTodoEditorAsPopup && (<div className="absolute left-3.5 bottom-[23px] text-[var(--color-textMuted)] text-[13px] pointer-events-none select-none flex items-center gap-1.5 opacity-60">
                                  Type{' '}
                                  <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textPrimary)]">
                                    @
                                  </kbd>{' '}
                                  to attach
                                </div>)}

                              {/* The footer buttons and create new button will be placed at the bottom of this wrapper natively */}

                              {mentionQuery !== null && mentionSuggestions.length > 0 && (<div className="absolute left-3 top-[40px] mt-1 w-[260px] max-h-[220px] bg-[var(--color-contextMenuBg,#171821)] supports-[backdrop-filter]:bg-[var(--color-contextMenuBg,#171821)]/90 backdrop-blur-xl border border-[var(--color-borderDefault)] rounded-xl shadow-2xl z-[99999] overflow-y-auto [&::-webkit-scrollbar]:hidden p-1 flex flex-col gap-0.5" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                  {mentionSuggestions.map((item, idx) => {
                        const isSelected = idx === mentionIndex;
                        return (<button key={item.id} type="button" onClick={() => handleSelectMention(item)} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${isSelected
                                ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)] font-medium'
                                : 'text-[var(--color-textMuted)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]'}`}>
                                        <div className="shrink-0">{getItemIcon(item)}</div>
                                        <span className="text-[12.5px] truncate flex-1">{getSingleItemName(item)}</span>
                                      </button>);
                    })}
                                </div>)}

                              {/* Footer Row (Scheduling + Create New) */}
                              <div className={clsx(activeSlot && ['time', 'resource', 'date', 'mode'].includes(activeSlot) ? 'z-[300]' : 'z-30', shouldRenderTodoEditorAsPopup
                    ? 'absolute inset-x-3.5 bottom-2 flex items-end justify-between'
                    : 'flex items-end justify-between w-full shrink-0 relative')}>
                                {shouldRenderTodoEditorAsPopup && (<div className="absolute left-[calc(100%_+_32px)] flex flex-col gap-1 opacity-75" style={{ top: '-214px' }}>
                                    <span className="text-[12px] font-semibold text-[var(--color-textSecondary)]">Properties</span>
                                  </div>)}
                                <div className={clsx('relative', shouldRenderTodoEditorAsPopup
                    ? 'absolute left-[calc(100%_+_32px)] flex w-[200px] flex-col gap-1 opacity-75'
                    : 'flex flex-wrap items-center gap-2')} style={shouldRenderTodoEditorAsPopup ? { top: '-182px' } : undefined}>
                                  <div className="relative shrink-0">
                                    <button id="mode-button" type="button" onMouseDown={e => e.stopPropagation()} onClick={() => {
                    if (activeSlot !== 'mode') {
                        setActiveSlot('mode');
                        setIsEditing(true);
                        setFocusedIndex(0);
                    }
                    else {
                        setIsEditing(!isEditing);
                    }
                }} className={`${shouldRenderTodoEditorAsPopup ? 'w-full border-transparent bg-transparent px-2.5 py-2 text-[12.5px] hover:border-[var(--color-borderDefault)] hover:bg-[var(--color-hoverBg)]' : 'px-3 py-1.5 bg-[var(--color-inputBg)] border-[var(--color-borderDefault)] hover:bg-[var(--color-hoverBg)]'} flex items-center gap-2 rounded-xl border transition-all text-[13px] font-medium cursor-pointer ${activeSlot === 'mode'
                    ? 'bg-[var(--color-hoverBg)] border-[var(--color-borderActive)] text-[var(--color-textPrimary)] shadow-md ring-1 ring-[var(--color-borderActive)]'
                    : 'text-[var(--color-textPrimary)]'}`}>
                                      <FiRepeat size={14} className="text-[var(--color-iconDefault)]"/>
                                      <span className={!isEditMode ? 'opacity-70' : undefined}>
                                        {selectedRepeatLabel}
                                      </span>
                                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="ml-auto text-[var(--color-iconDefault)]">
                                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    </button>

                                    {activeSlot === 'mode' && isEditing && (<div className={clsx('absolute left-0 w-[160px] rounded-xl shadow-2xl z-[99999] bg-[var(--color-contextMenuBg,#171821)] backdrop-blur-md border border-[var(--color-borderDefault)] overflow-hidden', shouldRenderTodoEditorAsPopup ? 'top-full mt-2' : 'bottom-full mb-2')}>
                                        {[
                        { id: 'one-time', label: 'Once', icon: <FaRegClock size={12}/> },
                        { id: 'daily', label: 'Daily', icon: <FiRepeat size={12}/> },
                        { id: 'weekly', label: 'Weekly', icon: <FiRepeat size={12}/> },
                        { id: 'monthly', label: 'Monthly', icon: <FiRepeat size={12}/> }
                    ].map((opt, idx) => {
                        const isFocused = idx === focusedIndex;
                        return (<React.Fragment key={opt.id}>
                                            {idx === 1 && (<div className="px-3 pt-2 pb-1 text-[10px] font-medium text-[var(--color-textMuted)]">
                                              Recurring
                                            </div>)}
                                            <button type="button" onClick={() => {
                                if (opt.id === 'one-time') {
                                    setScheduleType('one-time');
                                    setRecurringCycle(undefined);
                                }
                                else {
                                    setScheduleType('recurring');
                                    setRecurringCycle(opt.id as any);
                                }
                                setIsEditing(false);
                                setActiveSlot('mode');
                                setFocusedIndex(0);
                            }} className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[12.5px] font-medium transition-colors cursor-pointer ${isFocused
                                ? 'bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)]'
                                : 'text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)]'}`}>
                                              {opt.icon}
                                              <span>{opt.label}</span>
                                            </button>
                                          </React.Fragment>);
                    })}
                                      </div>)}
                                  </div>

                                  <div className="relative shrink-0">
                                    <button onMouseDown={e => e.stopPropagation()} onClick={() => {
                    if (activeSlot !== 'date') {
                        setActiveSlot('date');
                        setIsEditing(true);
                        setFocusedIndex(0);
                    }
                    else {
                        setIsEditing(!isEditing);
                    }
                }} className={`${shouldRenderTodoEditorAsPopup ? 'w-full border-transparent bg-transparent px-2.5 py-2 text-[12.5px] hover:border-[var(--color-borderDefault)] hover:bg-[var(--color-hoverBg)]' : 'px-3 py-1.5 bg-[var(--color-inputBg)] border-[var(--color-borderDefault)] hover:bg-[var(--color-hoverBg)]'} flex items-center gap-2 rounded-xl border transition-all text-[13px] font-medium cursor-pointer ${activeSlot === 'date' && !isEditing
                    ? 'bg-[var(--color-hoverBg)] border-[var(--color-borderActive)] text-[var(--color-textPrimary)] shadow-md ring-1 ring-[var(--color-borderActive)]'
                    : 'text-[var(--color-textPrimary)]'}`}>
                                      <FaRegCalendarAlt size={14} className="text-[var(--color-iconDefault)] opacity-70"/>
                                      <span className={!isEditMode ? 'opacity-70' : undefined}>
                                        {date
                    ? `${format(new Date(`${date}T00:00:00`), 'do MMM yyyy')} · ${!isAnytime && time ? formatTime12Hour(time) : 'Any time'}`
                    : 'Date'}
                                      </span>
                                    </button>

                                    {activeSlot === 'date' && isEditing && (<NewDueDateDropdown isOpen={activeSlot === 'date' && isEditing} onClose={() => setIsEditing(false)} onSelect={({ date: selDate, time: selTime, isAnytime: selIsAnytime }) => {
                        commitScheduleSelection(selDate, selTime, selIsAnytime);
                        setIsEditing(false);
                        setActiveSlot('resource');
                        setFocusedIndex(0);
                    }} currentDate={date} currentTime={time} positionClassName={shouldRenderTodoEditorAsPopup ? 'absolute top-full mt-2 right-0' : undefined}/>)}
                                  </div>

                                  <div className="relative shrink-0">
                                    <button ref={resourceButtonRef} type="button" onMouseDown={e => e.stopPropagation()} onClick={() => {
                    if (activeSlot !== 'resource') {
                        setActiveSlot('resource');
                        setIsEditing(true);
                        setFocusedIndex(0);
                    }
                    else {
                        setIsEditing(!isEditing);
                    }
                }} className={`${shouldRenderTodoEditorAsPopup ? 'w-full border-transparent bg-transparent px-2.5 py-2 text-[12.5px] hover:border-[var(--color-borderDefault)] hover:bg-[var(--color-hoverBg)]' : 'px-3 py-1.5 bg-[var(--color-inputBg)] border-[var(--color-borderDefault)] hover:bg-[var(--color-hoverBg)]'} rounded-xl border transition-all flex items-center gap-2 font-medium text-[13px] cursor-pointer ${activeSlot === 'resource'
                    ? 'bg-[var(--color-hoverBg)] border-[var(--color-borderActive)] text-[var(--color-textPrimary)] shadow-md ring-1 ring-[var(--color-borderActive)]'
                    : 'text-[var(--color-textPrimary)]'}`}>
                                      <FiLink size={14} className={selectedItems.length > 0
                    ? 'text-purple-400'
                    : 'text-[var(--color-iconDefault)]'}/>
                                      <span className={!isEditMode ? 'opacity-70' : undefined}>
                                        {selectedItems.length > 0
                    ? `${selectedItems.length} File${selectedItems.length > 1 ? 's' : ''} Attached`
                    : 'Attach saved'}
                                      </span>
                                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="ml-auto text-[var(--color-iconDefault)]">
                                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    </button>

                                    {activeSlot === 'resource' &&
                    isEditing &&
                    ReactDOM.createPortal(<div style={{
                            ...TODO_EDITOR_DARK_APPEARANCE_TOKENS,
                            position: 'absolute',
                            zIndex: 2147483647,
                            top: `${resourceDropdownPos.top}px`,
                            left: `${resourceDropdownPos.left}px`,
                            pointerEvents: 'auto',
                        }} className="w-[600px] max-w-[80vw] rounded-2xl shadow-2xl z-alts-subpopup bg-[var(--color-contextMenuBg,#171821)] backdrop-blur-md border border-[var(--color-borderDefault)] overflow-hidden flex flex-col font-sans text-[var(--color-textPrimary)]" data-todo-keyboard-surface="editor" onClick={e => e.stopPropagation()}>
                                          {/* Search and Header */}
                                          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-borderDefault)] bg-[var(--color-inputBg)]">
                                            <div className="flex items-center gap-2 flex-1">
                                              <FiSearch size={14} className="text-[var(--color-iconDefault)] shrink-0"/>
                                              <input id="resource-search-input" type="text" placeholder="Search and select files..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="flex-1 bg-transparent border-none text-[var(--color-textPrimary)] placeholder:text-[var(--color-textPlaceholder)] focus:outline-none text-[13px] font-medium min-w-0 pl-1"/>
                                              {searchQuery && (<button onClick={() => setSearchQuery('')} className="text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] transition-colors shrink-0">
                                                  <FaTimes size={10}/>
                                                </button>)}
                                            </div>

                                            {selectedItems.length > 0 && (<div className="flex items-center gap-2 px-2.5 py-1 bg-[var(--color-selectedBg)] border border-[var(--color-borderDefault)] rounded-lg text-[11px] text-[var(--color-textSecondary)] font-normal">
                                                <span className="shrink-0">{selectedItems.length} selected</span>
                                              </div>)}

                                            <button type="button" onClick={() => {
                            setIsEditing(false);
                            setActiveSlot(null);
                        }} className="p-1 text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] transition-colors cursor-pointer ml-1">
                                              <FaTimes size={12}/>
                                            </button>
                                          </div>

                                          {/* Columns Layout */}
                                          <div className="flex h-[250px]">
                                            {/* Sidebar Categories */}
                                            <div className="w-[150px] shrink-0 flex flex-col gap-0.5 py-2 px-1.5 border-r border-[var(--color-borderDefault)] bg-[var(--color-editorBg)] overflow-y-auto no-scrollbar">
                                              {[
                            {
                                key: 'all' as const,
                                label: 'All',
                                items: categoriesData.all,
                                icon: (<svg className="w-3.5 h-3.5 shrink-0 text-[var(--color-iconDefault)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                      <rect x="3" y="3" width="7" height="7" rx="1"/>
                                                      <rect x="14" y="3" width="7" height="7" rx="1"/>
                                                      <rect x="14" y="14" width="7" height="7" rx="1"/>
                                                      <rect x="3" y="14" width="7" height="7" rx="1"/>
                                                    </svg>),
                            },
                            {
                                key: 'note' as const,
                                label: 'Notes',
                                items: categoriesData.note,
                                icon: (<FiFileText size={14} className="text-[var(--color-iconDefault)] shrink-0"/>),
                            },
                            {
                                key: 'snippet' as const,
                                label: 'Text Expanders',
                                items: categoriesData.snippet,
                                icon: (<TextExpanderIcon size={14} className="text-[var(--color-iconDefault)] shrink-0"/>),
                            },
                            {
                                key: 'link' as const,
                                label: 'Links',
                                items: categoriesData.link,
                                icon: (<FiLink size={14} className="text-[var(--color-iconDefault)] shrink-0"/>),
                            },
                            {
                                key: 'workspace' as const,
                                label: 'Organisations',
                                items: categoriesData.organisation,
                                icon: (<SessionGridIcon size={14} className="text-[var(--color-iconDefault)] shrink-0"/>),
                            },
                            {
                                key: 'aiPrompt' as const,
                                label: 'Chat Agents',
                                items: categoriesData.aiPrompt,
                                icon: (<LuSparkles size={14} className="text-[var(--color-iconDefault)] shrink-0"/>),
                            }
                        ].map(col => {
                            const isActive = selectedCategory === col.key;
                            return (<button key={col.key} type="button" onClick={() => {
                                    setSelectedCategory(col.key);
                                    setFocusedIndex(0);
                                }} className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-all ${isActive
                                    ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)] font-semibold border border-[var(--color-borderActive)]'
                                    : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] border border-transparent'}`}>
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                      {col.icon}
                                                      <span className="text-[12px] truncate font-normal">
                                                        {col.label}
                                                      </span>
                                                    </div>
                                                    <span className="text-[9.5px] text-[var(--color-textSecondary)] tabular-nums font-normal">
                                                      {col.items.length}
                                                    </span>
                                                  </button>);
                        })}
                                            </div>

                                            {/* Items List */}
                                            <div className="flex-1 flex flex-col bg-transparent overflow-hidden">
                                              {(() => {
                            const activeCol = [
                                { key: 'all' as const, label: 'All', items: categoriesData.all },
                                { key: 'note' as const, label: 'Notes', items: categoriesData.note },
                                {
                                    key: 'snippet' as const,
                                    label: 'Text Expanders',
                                    items: categoriesData.snippet,
                                },
                                { key: 'link' as const, label: 'Links', items: categoriesData.link },
                                {
                                    key: 'workspace' as const,
                                    label: 'Organisations',
                                    items: categoriesData.organisation,
                                },
                                {
                                    key: 'aiPrompt' as const,
                                    label: 'Chat Agents',
                                    items: categoriesData.aiPrompt,
                                }
                            ].find(c => c.key === selectedCategory)!;
                            return (<>
                                                    <div className="flex items-center gap-1.5 px-4 py-2 border-b border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] shrink-0">
                                                      <span className="text-[10px] font-semibold text-[var(--color-textSecondary)] uppercase tracking-wider">
                                                        {activeCol.label}
                                                      </span>
                                                      <span className="text-[var(--color-textSecondary)] font-normal">
                                                        ·
                                                      </span>
                                                      <span className="text-[10px] text-[var(--color-textSecondary)] tabular-nums font-normal">
                                                        {activeCol.items.length} items
                                                      </span>
                                                    </div>
                                                    <div ref={resultsContainerRef} className="overflow-y-auto no-scrollbar flex flex-col flex-1">
                                                      {activeCol.items.length === 0 ? (<div className="h-full flex items-center justify-center">
                                                          <span className="text-[12px] text-[var(--color-textSecondary)] font-normal">
                                                            Nothing here
                                                          </span>
                                                        </div>) : (activeCol.items.map((item: ConvertibleItem, idx: number) => {
                                    const isSelected = selectedItems.some(i => i.id === item.id);
                                    const isFocused = idx === focusedIndex;
                                    return (<div key={item.id} data-idx={idx} onClick={() => toggleSelection(item)} className={`flex items-center gap-3 px-4 py-2.5 border-b border-[var(--color-borderDefault)] cursor-pointer transition-all ${isSelected
                                            ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)] font-medium'
                                            : isFocused
                                                ? 'bg-[var(--color-hoverBg)] text-[var(--color-textPrimary)] font-medium'
                                                : 'text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)]'}`}>
                                                              <div className={`w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center shrink-0 transition-all ${isSelected
                                            ? 'bg-neutral-300 border-neutral-400 text-neutral-900'
                                            : 'border-neutral-600 bg-transparent'}`}>
                                                                {isSelected && <FaCheck size={7}/>}
                                                              </div>
                                                              <div className="flex-1 flex items-center min-w-0 gap-2">
                                                                {getItemIcon(item)}
                                                                <span className="text-[12.5px] font-normal leading-snug truncate">
                                                                  {getSingleItemName(item)}
                                                                </span>
                                                                {selectedCategory === 'all' && item.category && (<span className="text-[10px] text-[var(--color-textSecondary)] font-normal shrink-0 ml-1.5 opacity-70">
                                                                    {(() => {
                                                const catLower = item.category.toLowerCase();
                                                if (catLower === 'agent' ||
                                                    catLower === 'chat_agent')
                                                    return 'Chat Agent';
                                                if (catLower === 'prompt' ||
                                                    catLower === 'aiprompt' ||
                                                    catLower === 'ai_prompt')
                                                    return 'Chat Agent';
                                                if (catLower === 'workspace')
                                                    return 'Workspace';
                                                if (catLower === 'tabgroup' ||
                                                    catLower === 'tab session')
                                                    return 'Workspace';
                                                if (catLower === 'note')
                                                    return 'Note';
                                                if (catLower === 'snippet')
                                                    return 'Text Expander';
                                                if (catLower === 'link')
                                                    return 'Link';
                                                if (catLower === 'automation')
                                                    return 'Automation';
                                                return (catLower.charAt(0).toUpperCase() +
                                                    catLower.slice(1));
                                            })()}
                                                                  </span>)}
                                                              </div>
                                                            </div>);
                                }))}
                                                    </div>
                                                  </>);
                        })()}
                                            </div>
                                          </div>
                                        </div>, portalTarget || document.body)}
                                  </div>
                                </div>

                                {/* Create New Button */}
                                <div className="shrink-0 z-50 relative">
                                  <style>{`
                      @keyframes todoSuccessFadeIn {
                        from { opacity: 0; transform: translateY(4px); }
                        to { opacity: 1; transform: translateY(0); }
                      }
                    `}</style>
                                  <button id="final-save-button" type="button" onClick={() => handleCreate({ overrideCreateMore: true })} onMouseEnter={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setTooltipPos({
                        top: rect.top + window.scrollY - 76,
                        left: rect.right - 320,
                    });
                    setShowTooltip(true);
                }} onMouseLeave={() => setShowTooltip(false)} disabled={explicitSaveStatus === 'saving'} className={`px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 font-semibold text-xs ${explicitSaveStatus === 'saving'
                    ? 'bg-white/[0.03] border-white/[0.05] text-white/60 opacity-70 cursor-not-allowed'
                    : 'bg-[var(--color-inputBg)] border-[var(--color-borderDefault)] text-[var(--color-textPrimary)] hover:bg-[var(--color-hoverBg)] cursor-pointer shadow-sm'}`}>
                                    {explicitSaveStatus === 'saving' ? (<>
                                        <svg className="animate-spin" width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                          <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                                          <path d="M12 2a10 10 0 0 1 10 10"/>
                                        </svg>
                                        <span>Creating…</span>
                                      </>) : (<span>Create another</span>)}
                                  </button>

                                  {showTooltip &&
                    ReactDOM.createPortal(<div style={{
                            position: 'absolute',
                            top: `${tooltipPos.top}px`,
                            left: `${tooltipPos.left}px`,
                            zIndex: 2147483647,
                            color: 'var(--color-textPrimary)',
                        }} className="rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-editorBg)] p-3 shadow-2xl z-alts-subpopup flex flex-col gap-2.5 min-w-[320px] text-[12px] font-sans text-[var(--color-textPrimary)] pointer-events-none">
                                        <div className="flex items-center gap-3 text-[var(--color-textPrimary)]">
                                          <div className="flex gap-1 min-w-[125px] shrink-0">
                                            <kbd className="px-1.5 py-0.5 rounded bg-[#18181B] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textPrimary)]">
                                              {isMac ? 'Cmd' : 'Ctrl'}
                                            </kbd>
                                            <kbd className="px-1.5 py-0.5 rounded bg-[#18181B] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textPrimary)]">
                                              Enter
                                            </kbd>
                                          </div>
                                          <span className="text-[var(--color-textSecondary)] text-left whitespace-nowrap">
                                            to save Todo
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[var(--color-textPrimary)]">
                                          <div className="flex gap-1 min-w-[125px] shrink-0">
                                            <kbd className="px-1.5 py-0.5 rounded bg-[#18181B] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textPrimary)]">
                                              {isMac ? 'Cmd' : 'Ctrl'}
                                            </kbd>
                                            <kbd className="px-1.5 py-0.5 rounded bg-[#18181B] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textPrimary)]">
                                              Shift
                                            </kbd>
                                            <kbd className="px-1.5 py-0.5 rounded bg-[#18181B] border border-[var(--color-borderDefault)] text-[10px] font-bold font-mono text-[var(--color-textPrimary)]">
                                              Enter
                                            </kbd>
                                          </div>
                                          <span className="text-[var(--color-textSecondary)] text-left whitespace-nowrap">
                                            to save and create another
                                          </span>
                                        </div>
                                      </div>, portalTarget || document.body)}
                                </div>
                              </div>
                              {descriptionError && (<span className="text-xs text-red-500 font-medium px-2 block w-full text-left mt-1.5">
                                  Enter a description
                                </span>)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>)
            : null}
        </div>

        {/* Right Column: Full-Height Sibling Column (Top Edge to Bottom Edge) */}
        {!hideRightPanel && (<RightSideItemsPanel<TodoRecord> hideBorder={isNormalTodoMode} items={sortedTodos} activeItemId={liveTodoId ?? null} searchQuery={tableSearchQuery} onSearchChange={setTableSearchQuery} onCloseClick={onClose} searchPlaceholder="Search Todo..." getItemTitle={item => item.name || 'Untitled Todo'} getItemPreview={item => item.description || ''} getItemIcon={() => <BsCalendarCheck size={14} className="text-[var(--color-iconDefault)] shrink-0"/>} getItemCompoundId={item => getItemCompoundId({
                id: item.id,
                organisation_id: item.organisationId,
                snippet: { id: item.id, category: 'todo' },
            })} getItemType={() => 'todo'} getItemOrganisationId={item => item.organisationId ?? null} getItemTagIds={item => item.tagIds || []} shortcutPrefix="c" shortcutsMap={shortcutsMap} hotkeysMap={hotkeysMap} tagNamesMap={todoTagNamesMap} onLoadItem={(id: string) => {
                void (async () => {
                    const todo = (existingTodos ?? []).find(t => t.id === id);
                    if (!todo)
                        return;
                    if (isOverlay || isSheetCreateEditorOpen || workspaceMode === 'sheet') {
                        await openTodoInFullEditor(todo);
                        return;
                    }
                    if (isDirtyRef.current) {
                        const saved = flushSave ? await flushSave() : await handleSave(false);
                        if (!saved)
                            return;
                    }
                    if (onLoadTodo)
                        onLoadTodo(todo);
                })();
            }} onDeleteItem={async (id) => {
                try {
                    const record = existingTodos?.find(p => p.id === id);
                    if (record) {
                        const compoundId = getItemCompoundId({
                            id: record.id,
                            organisation_id: record.organisationId,
                            snippet: { id: record.id, category: 'todo' },
                        });
                        await clearShortcut(id, compoundId, 'todo');
                    }
                    await deleteTodo(id);
                    const delIdStr = String(id);
                    const activeIdStr = String(activeTodoId || liveTodoId || (initialItem as any)?.id || (initialItem as any)?.todo_id || '');
                    const isCurrentItem = delIdStr === activeIdStr ||
                        id === liveTodoId ||
                        id === activeTodoId ||
                        id === (initialItem as any)?.id ||
                        id === (initialItem as any)?.todo_id ||
                        delIdStr === String((initialItem as any)?.id || '') ||
                        delIdStr === String((initialItem as any)?.todo_id || '') ||
                        delIdStr === String(liveTodoId || '');
                    if (isCurrentItem) {
                        resetEditor();
                        setTitle('');
                        setDescription('');
                        setTodoShortcut('');
                        setTodoHotkey('');
                        setSelectedTags([]);
                        setIsFavoriteState(false);
                        setShortcutError(null);
                        setSelectedType('custom');
                        setSelectedItem(null);
                        setSelectedItems([]);
                        setScheduleType('one-time');
                        setIsAnytime(false);
                        setRecurringCycle(undefined);
                        const now = new Date();
                        setTime(format(now, 'HH:mm'));
                        setDate(format(now, 'yyyy-MM-dd'));
                        if (onLoadTodo)
                            onLoadTodo(null as any);
                        readAllShortcuts()
                            .then(setShortcutsMap)
                            .catch(() => { });
                    }
                    if (onDeleteTodo) {
                        onDeleteTodo(id);
                    }
                }
                catch (err) {
                    console.error('Delete todo failed:', err);
                }
            }} onUpdateShortcut={async (id, val) => {
                const record = existingTodos?.find(p => p.id === id);
                if (record) {
                    const compoundId = getItemCompoundId({
                        id: record.id,
                        organisation_id: record.organisationId,
                        snippet: { id: record.id, category: 'todo' },
                    });
                    if (val) {
                        await saveShortcut(id, compoundId, val.toLowerCase().replace(/[^a-z0-9_]/g, ''), record.name || 'Untitled', 'todo');
                    }
                    else {
                        await clearShortcut(id, compoundId, 'todo');
                    }
                }
            }} onUpdateTitle={async (id, val) => {
                await updateTodoContent(id, { name: val });
            }} onUpdateTags={async (id, tagText) => {
                const tagNames = tagText
                    .split(',')
                    .map((t: string) => t.trim())
                    .filter(Boolean);
                const resolvedTags: any[] = [];
                const allTags = useDbStore.getState().tags;
                for (const name of tagNames) {
                    const matchedTag = allTags.find((t: any) => t.name.toLowerCase() === name.toLowerCase());
                    if (matchedTag) {
                        resolvedTags.push(matchedTag);
                    }
                    else {
                        const record = existingTodos?.find(p => p.id === id);
                        const organisations = useDbStore.getState().organisations;
                        const smartWs = record?.organisationId || organisations[0]?.id;
                        if (smartWs) {
                            const newTag = await createTag(name);
                            resolvedTags.push(newTag);
                        }
                    }
                }
                await updateTodoContent(id, { tagIds: resolvedTags.map((t: any) => t.id) });
            }} isFavorite={isFavorite} toggleFavorite={toggleFavorite} addFavorite={addFavorite} isExpanded={isRightPanelExpanded} onExpandChange={setIsRightPanelExpanded} searchInputRef={rightSideSearchInputRef} emptyStateMessage="No Todo found" onCreateItemInTag={async (tagNames, tagIds) => {
                if (isDirty) {
                    const saved = flushSave ? await flushSave() : await handleSave(false);
                    if (!saved)
                        return;
                }
                resetEditor();
                setTitle('');
                setDescription('');
                setTodoShortcut('');
                setTodoHotkey('');
                setIsFavoriteState(false);
                setShortcutError(null);
                setSelectedType('custom');
                setSelectedItem(null);
                setSelectedItems([]);
                setScheduleType('one-time');
                setIsAnytime(false);
                setRecurringCycle(undefined);
                const now = new Date();
                setTime(format(now, 'HH:mm'));
                setDate(format(now, 'yyyy-MM-dd'));
                if (onLoadTodo)
                    onLoadTodo(null as any);
                // Resolve or create tag records in DB
                const organisations = useDbStore.getState().organisations;
                const targetOrganisationId = organisationId || organisations[0]?.id || 'default';
                const resolvedTagIds: string[] = [];
                for (let i = 0; i < tagNames.length; i++) {
                    const name = tagNames[i].trim();
                    if (!name)
                        continue;
                    const directId = tagIds[i];
                    const existing = dbTags.find((t: any) => t.id === directId || t.name.toLowerCase() === name.toLowerCase());
                    if (existing) {
                        resolvedTagIds.push(existing.id);
                    }
                    else {
                        try {
                            const created = await createTag(name);
                            resolvedTagIds.push(created.id);
                        }
                        catch (err) {
                            console.error('Failed creating tag on + click', err);
                        }
                    }
                }
                setEditorTagIds(resolvedTagIds);
                setTimeout(() => {
                    titleInputRef.current?.focus();
                }, 50);
            }}/>)}
      </EditorContainer>
      <button id="trigger-save-internal" type="button" onClick={handleCreate} className="hidden"/>

      <DeleteConfirmation isOpen={!!pendingDeleteId} onClose={() => setPendingDeleteId(null)} onConfirm={async () => {
            if (pendingDeleteId) {
                try {
                    const record = existingTodos?.find(p => p.id === pendingDeleteId);
                    if (record) {
                        const compoundId = getItemCompoundId({
                            id: record.id,
                            organisation_id: record.organisationId,
                            snippet: { id: record.id, category: 'todo' },
                        });
                        await clearShortcut(pendingDeleteId, compoundId, 'todo');
                    }
                    await deleteTodo(pendingDeleteId);
                    const delIdStr = String(pendingDeleteId);
                    const activeIdStr = String(activeTodoId || liveTodoId || (initialItem as any)?.id || (initialItem as any)?.todo_id || '');
                    const isCurrentItem = !pendingDeleteId ||
                        delIdStr === activeIdStr ||
                        pendingDeleteId === liveTodoId ||
                        pendingDeleteId === activeTodoId ||
                        pendingDeleteId === (initialItem as any)?.id ||
                        pendingDeleteId === (initialItem as any)?.todo_id ||
                        delIdStr === String((initialItem as any)?.id || '') ||
                        delIdStr === String((initialItem as any)?.todo_id || '') ||
                        delIdStr === String(liveTodoId || '');
                    if (isCurrentItem) {
                        resetEditor();
                        setTitle('');
                        setDescription('');
                        setTodoShortcut('');
                        setTodoHotkey('');
                        setSelectedTags([]);
                        setIsFavoriteState(false);
                        setShortcutError(null);
                        setSelectedType('custom');
                        setSelectedItem(null);
                        setSelectedItems([]);
                        setScheduleType('one-time');
                        setIsAnytime(false);
                        setRecurringCycle(undefined);
                        const now = new Date();
                        setTime(format(now, 'HH:mm'));
                        setDate(format(now, 'yyyy-MM-dd'));
                        if (onLoadTodo)
                            onLoadTodo(null as any);
                        readAllShortcuts()
                            .then(setShortcutsMap)
                            .catch(() => { });
                    }
                    if (onDeleteTodo) {
                        onDeleteTodo(pendingDeleteId);
                    }
                }
                catch (err) {
                    console.error('Delete todo failed:', err);
                }
            }
            setPendingDeleteId(null);
        }} title={pendingDeleteId && existingTodos?.find(t => t.id === pendingDeleteId)?.name
            ? `Delete "${existingTodos.find(t => t.id === pendingDeleteId)?.name}"?`
            : 'Delete this Todo?'} description="Are you sure you want to delete this Todo? This action cannot be undone." zIndex={100005}/>
    </>);
};
export default CreateTodoView;
