import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
  FaUser,
  FaRegCalendarAlt,
  FaRegClock,
  FaPlus,
  FaRobot,
  FaBolt,
  FaLayerGroup,
  FaTimes,
  FaCheck,
  FaStar,
  FaKeyboard,
} from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import {
  FiClock,
  FiFileText,
  FiRepeat,
  FiSearch,
  FiLink,
  FiCode,
  FiZap,
  FiCheckSquare,
  FiFolder,
  FiChevronDown,
  FiStar,
  FiTag,
  FiCopy,
} from 'react-icons/fi';
import { format, formatDistanceToNow, isToday, isTomorrow, addDays } from 'date-fns';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { resolveAutomationIconMeta } from '../../../../../shared-components/icons/automationDynamicIcon';
import { getFaviconUrl } from '../../../../../shared-components/searchBarMain/utilityFunctions/utils';
import useNotification from '../../../../../shared-components/notifications/useNotification';
import { useAppearance } from '@extension/ui';
import { EditorContainer } from '../../../../../shared-components/editorContainer/EditorContainer';
import { WorkspaceEditorLayout } from '../../../../../shared-components/editorContainer/WorkspaceEditorLayout';
import { EditorTitleShortcutInput } from '../../../../../shared-components/editorContainer/EditorTitleShortcutInput';
import { ExistingItemsTable } from '../../../../../shared-components/editorContainer/ExistingItemsTable';
import { useFavorites } from '../../../../../shared-components/favorites/favoriteHooks';
import { getItemCompoundId, readAllShortcuts } from '../../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { HotkeyAssignButton } from '../../../../../shared-components/hotkeys';
import { SharedPropertiesToolbar } from '../../../../../shared-components/editorToolbar/SharedPropertiesToolbar';
import { useShortcutValidation, saveShortcut, clearShortcut } from '../../../../../shared-components/shortcuts';
import type { TodoRecord } from '../todoTypes';
import { updateTodoContent } from '../todoData';
import NotesIcon from '../../../../../shared-components/icons/notesIcon';
import StackedLinkIcon from '../../../../../shared-components/icons/stackedLinkIcon';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { createTag } from '../../../../../allObjectFolder/src/createObject/tags/tagData';
import { useTodoEditor } from '../useTodoEditor';
import { AutoSaveIndicator } from '../../../../../shared-components/autoSaveEngine/autoSave';
import DeleteConfirmation from '../../../../../shared-components/modals/deleteDialog';
import { NewDueDateDropdown } from './newDueDateDropdown';

interface InlineTimeInputProps {
  value: string; // 'HH:mm' in 24h
  onChange: (val: string) => void;
  onExitRight: () => void;
  onExitLeft: () => void;
}

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
    if (newIsPM && newHr12 < 12) finalHr24 += 12;
    if (!newIsPM && newHr12 === 12) finalHr24 = 0;
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
      } else if (segment === 'min' && minRef.current?.selectionEnd === minRef.current?.value.length) {
        e.preventDefault();
        ampmRef.current?.focus();
      } else if (segment === 'ampm' && ampmRef.current?.selectionEnd === ampmRef.current?.value.length) {
        e.preventDefault();
        onExitRight();
      }
    } else if (e.key === 'ArrowLeft') {
      if (segment === 'ampm' && ampmRef.current?.selectionStart === 0) {
        e.preventDefault();
        minRef.current?.focus();
      } else if (segment === 'min' && minRef.current?.selectionStart === 0) {
        e.preventDefault();
        hrRef.current?.focus();
      } else if (segment === 'hr' && hrRef.current?.selectionStart === 0) {
        e.preventDefault();
        onExitLeft();
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (segment === 'hr')
        updateTime(e.key === 'ArrowUp' ? (hr12 === 12 ? 1 : hr12 + 1) : hr12 === 1 ? 12 : hr12 - 1, mm, isPM);
      else if (segment === 'min') {
        let m = parseInt(mm, 10);
        m = e.key === 'ArrowUp' ? (m + 1) % 60 : (m - 1 + 60) % 60;
        updateTime(hr12, String(m).padStart(2, '0'), isPM);
      } else if (segment === 'ampm' && ampmRef.current) updateTime(hr12, mm, !isPM);
    }
  };

  return (
    <div className="flex items-center text-white inline-time-input" onClick={e => e.stopPropagation()}>
      <input
        id="time-input-field"
        ref={hrRef}
        type="text"
        value={String(hr12).padStart(2, '0')}
        onChange={e => {
          const val = e.target.value.replace(/[^0-9]/g, '');
          if (val) {
            let num = parseInt(val, 10);
            if (num > 12) num = parseInt(val.slice(-1), 10);
            if (num === 0 && val.length > 1) num = 12;
            updateTime(num || 12, mm, isPM);
            if (val.length === 2 && num >= 1) minRef.current?.focus();
          }
        }}
        onFocus={handleFocus}
        onKeyDown={e => handleKeyDown(e, 'hr')}
        className="w-[18px] bg-transparent text-center outline-none selection:bg-blue-500/40 caret-transparent focus:bg-white/10 rounded-sm"
      />
      <span className="opacity-50 pb-[2px]">:</span>
      <input
        ref={minRef}
        type="text"
        value={mm}
        onChange={e => {
          const val = e.target.value.replace(/[^0-9]/g, '');
          if (val) {
            let num = parseInt(val, 10);
            if (num > 59) num = parseInt(val.slice(-1), 10);
            updateTime(hr12, String(num).padStart(2, '0'), isPM);
            if (val.length === 2) ampmRef.current?.focus();
          }
        }}
        onFocus={handleFocus}
        onKeyDown={e => handleKeyDown(e, 'min')}
        className="w-[18px] bg-transparent text-center outline-none selection:bg-blue-500/40 caret-transparent focus:bg-white/10 rounded-sm"
      />
      <input
        ref={ampmRef}
        type="text"
        value={isPM ? 'PM' : 'AM'}
        onChange={e => {
          const val = e.target.value.toUpperCase();
          if (val.includes('A')) updateTime(hr12, mm, false);
          if (val.includes('P')) updateTime(hr12, mm, true);
        }}
        onFocus={handleFocus}
        onKeyDown={e => handleKeyDown(e, 'ampm')}
        className="w-[22px] ml-1 bg-transparent text-center outline-none selection:bg-blue-500/40 caret-transparent focus:bg-white/10 rounded-sm text-[11px] font-bold tracking-wider"
      />
    </div>
  );
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

const CustomTimePicker: React.FC<CustomTimePickerProps> = ({
  value,
  onChange,
  isOpen,
  setIsOpen,
  focusedColumn = -1,
  focusedBlock = -1,
  isAnytime = false,
  onAnytimeChange,
}) => {
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
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, isAnytime]);

  // Sync local inputs when value changes from outside
  useEffect(() => {
    let [hh, mm] = (value || '09:00').split(':');
    if (!hh) hh = '09';
    if (!mm) mm = '00';

    let hrNum = parseInt(hh, 10);
    let hr12 = hrNum % 12;
    if (hr12 === 0) hr12 = 12;

    setLocalHr(String(hr12).padStart(2, '0'));
    setLocalMin(mm);
  }, [value]);

  if (!isOpen) return null;

  let [hh, mm] = (value || '09:00').split(':');
  if (!hh) hh = '09';
  if (!mm) mm = '00';

  let hrNum = parseInt(hh, 10);
  const isPM = hrNum >= 12;
  let hr12 = hrNum % 12;
  if (hr12 === 0) hr12 = 12;

  const updateTime = (newHr12: number, newMin: string, newIsPM: boolean) => {
    let finalHr24 = newHr12;
    if (newIsPM && newHr12 < 12) finalHr24 += 12;
    if (!newIsPM && newHr12 === 12) finalHr24 = 0;

    onChange(`${String(finalHr24).padStart(2, '0')}:${newMin}`);
  };

  const handleMeridiemChange = (newIsPM: boolean) => updateTime(hr12, mm, newIsPM);

  const handleHourBlur = () => {
    let parsed = parseInt(localHr, 10);
    if (isNaN(parsed) || parsed < 1) parsed = 12;
    if (parsed > 12) parsed = 12;
    updateTime(parsed, mm, isPM);
  };

  const handleMinBlur = () => {
    let parsed = parseInt(localMin, 10);
    if (isNaN(parsed) || parsed < 0) parsed = 0;
    if (parsed > 59) parsed = 59;
    updateTime(hr12, String(parsed).padStart(2, '0'), isPM);
  };

  return (
    <div
      ref={popupRef}
      className="custom-time-picker-popup absolute left-0 bottom-full mb-2 w-[180px] bg-[#1c1d27]/95 backdrop-blur-md border border-white/10 rounded-xl p-1 shadow-2xl z-[150] flex flex-col gap-1 text-[var(--color-textMain)] font-sans"
      onClick={e => e.stopPropagation()}
      onKeyDown={e => e.stopPropagation()}>
      {/* Anytime */}
      <div
        onClick={() => {
          onAnytimeChange?.(true);
        }}
        className={`px-2.5 py-2 rounded-lg border flex items-center gap-2.5 cursor-pointer transition-colors ${
          isAnytime ? 'border-blue-500/50' : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'
        } ${focusedBlock === 0 ? 'ring-1 ring-white/20 bg-white/5' : ''}`}>
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${isAnytime ? 'bg-blue-500 text-white' : 'bg-black/5 dark:bg-white/10 text-neutral-500 dark:text-neutral-400'}`}>
          <FiClock size={12} />
        </div>
        <span
          className={`font-medium text-[13px] ${isAnytime ? 'text-blue-600 dark:text-blue-400' : 'text-[var(--color-textMain)]'}`}>
          Anytime
        </span>
      </div>

      {/* Specific time */}
      <div
        onClick={() => {
          onAnytimeChange?.(false);
        }}
        className={`px-2.5 py-2 rounded-lg border flex flex-col gap-2.5 cursor-pointer transition-colors ${
          !isAnytime ? 'border-blue-500/50' : 'border-transparent hover:bg-black/5 dark:hover:bg-white/5'
        } ${focusedBlock === 1 ? 'ring-1 ring-white/20 bg-white/5' : ''}`}>
        <div className="flex items-center gap-2.5">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${!isAnytime ? 'bg-blue-500 text-white' : 'bg-black/5 dark:bg-white/10 text-neutral-500 dark:text-neutral-400'}`}>
            <FiClock size={12} />
          </div>
          <span
            className={`font-medium text-[13px] ${!isAnytime ? 'text-blue-600 dark:text-blue-400' : 'text-[var(--color-textMain)]'}`}>
            Specific time
          </span>
        </div>

        {!isAnytime && (
          <div className="flex items-center justify-center gap-1.5" onClick={e => e.stopPropagation()}>
            <input
              ref={hourInputRef}
              type="text"
              value={localHr}
              onChange={e => {
                const val = e.target.value;
                setLocalHr(val);
                const parsed = parseInt(val, 10);
                if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) {
                  updateTime(parsed, mm, isPM);
                }
              }}
              onBlur={handleHourBlur}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setIsOpen(false);
                } else if (e.key === 'ArrowRight' && e.currentTarget.selectionStart === e.currentTarget.value.length) {
                  e.preventDefault();
                  minInputRef.current?.focus();
                  minInputRef.current?.select();
                }
              }}
              className="w-8 h-7 bg-transparent border border-[var(--color-borderDefault)] rounded-[5px] text-center text-[12px] font-medium text-[var(--color-textMain)] focus:border-blue-500 focus:bg-blue-50 dark:focus:bg-blue-500/10 outline-none transition-all"
            />
            <span className="text-[var(--color-textMain)] font-bold text-xs mb-0.5">:</span>
            <input
              ref={minInputRef}
              type="text"
              value={localMin}
              onChange={e => {
                const val = e.target.value;
                setLocalMin(val);
                const parsed = parseInt(val, 10);
                if (!isNaN(parsed) && parsed >= 0 && parsed <= 59) {
                  updateTime(hr12, String(parsed).padStart(2, '0'), isPM);
                }
              }}
              onBlur={handleMinBlur}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setIsOpen(false);
                } else if (e.key === 'ArrowRight' && e.currentTarget.selectionStart === e.currentTarget.value.length) {
                  e.preventDefault();
                  amBtnRef.current?.focus();
                } else if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0) {
                  e.preventDefault();
                  hourInputRef.current?.focus();
                  hourInputRef.current?.select();
                }
              }}
              className="w-8 h-7 bg-transparent border border-[var(--color-borderDefault)] rounded-[5px] text-center text-[12px] font-medium text-[var(--color-textMain)] focus:border-blue-500 focus:bg-blue-50 dark:focus:bg-blue-500/10 outline-none transition-all"
            />

            <div className="flex items-center ml-1 gap-1">
              <button
                ref={amBtnRef}
                onClick={() => handleMeridiemChange(false)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setIsOpen(false);
                  } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    pmBtnRef.current?.focus();
                  } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    minInputRef.current?.focus();
                    minInputRef.current?.select();
                  }
                }}
                className={`px-1.5 py-1 text-[11px] font-bold transition-colors focus:ring-1 focus:ring-blue-500 rounded outline-none ${!isPM ? 'text-blue-500' : 'text-[var(--color-textMuted)] hover:text-[var(--color-textMain)]'}`}>
                AM
              </button>
              <button
                ref={pmBtnRef}
                onClick={() => handleMeridiemChange(true)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setIsOpen(false);
                  } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    amBtnRef.current?.focus();
                  }
                }}
                className={`px-1.5 py-1 text-[11px] font-bold transition-colors focus:ring-1 focus:ring-blue-500 rounded outline-none ${isPM ? 'text-blue-500' : 'text-[var(--color-textMuted)] hover:text-[var(--color-textMain)]'}`}>
                PM
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
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
  if (!item) return '';
  const rawName = item.name;
  if (typeof rawName === 'string') return rawName;
  if (rawName && typeof rawName === 'object') {
    const obj = rawName as any;
    if (typeof obj.name === 'string') return obj.name;
    if (Array.isArray(obj.names) && obj.names.length > 0) return String(obj.names[0]);
    try {
      return JSON.stringify(obj);
    } catch {
      return '';
    }
  }
  return String(rawName ?? '');
};

const getSecondaryText = (item: ConvertibleItem): string => {
  const data = item.data || {};
  const cat = (item.category || '').toLowerCase();

  if (cat === 'note') {
    if (data.description) return data.description;
    if (data.updated_at) {
      try {
        return `Last edited ${formatDistanceToNow(new Date(data.updated_at))} ago`;
      } catch (e) {}
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
    } else if (typeof v === 'string' && (v.trim().startsWith('{') || v.trim().startsWith('['))) {
      try {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed.urls)) urls = parsed.urls.filter((u: any) => typeof u === 'string');
      } catch (e) {}
    }

    if (urls.length > 1) {
      const hostnames = urls.slice(0, 4).map(u => {
        try {
          return new URL(u.startsWith('http') ? u : `https://${u}`).hostname.replace(/^www\./, '');
        } catch (e) {
          return u;
        }
      });
      return `${urls.length} links · ${hostnames.join(', ')}${urls.length > 4 ? '…' : ''}`;
    }

    let rawUrl = data.url || data.link || (urls.length === 1 ? urls[0] : '');
    if (!rawUrl && typeof v === 'string' && !v.startsWith('{') && !v.startsWith('[')) rawUrl = v;
    if (!rawUrl && typeof item.name === 'string' && item.name.startsWith('http')) rawUrl = item.name;
    if (rawUrl && typeof rawUrl === 'string') {
      try {
        const urlObj = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
        return urlObj.hostname.replace(/^www\./, '');
      } catch (e) {
        return rawUrl;
      }
    }
    return 'Link';
  }

  if (['automation'].includes(cat)) {
    if (data.schedule_type === 'recurring' && data.recurring_cycle) return `Every ${data.recurring_cycle}`;
    if (data.is_recurring && data.recurring_cycle) return `Every ${data.recurring_cycle}`;
    if (data.event_deadline) {
      try {
        return `Scheduled for ${format(new Date(data.event_deadline), 'MMM d, h:mm a')}`;
      } catch (e) {}
    }
    if (data.description) return data.description;
    return 'Automation';
  }

  if (['agent', 'chat_agent', 'ai', 'assistant', 'chat'].includes(cat) || data.type === 'agent') {
    return data.description || 'Chat Agent';
  }

  return cat.charAt(0).toUpperCase() + cat.slice(1);
};

const getItemIcon = (item: ConvertibleItem) => {
  const cat = (item.category || '').toLowerCase();
  const data = item.data || {};

  if (['agent', 'chat_agent', 'ai', 'assistant', 'chat'].includes(cat) || data.type === 'agent') {
    const meta = resolveAutomationIconMeta(data.automation || data);

    if (
      meta.mode === 'all_ai' ||
      meta.mode === 'multi_link' ||
      (meta.mode === 'single_link' && meta.hosts.length > 0)
    ) {
      const visibleHosts = meta.hosts.slice(0, 4);
      const size = 14;
      const count = visibleHosts.length;
      const offsetRatio = 0.55;
      const dotSize = Math.floor(size / (1 + offsetRatio * (count - 1)));
      const offset = dotSize * offsetRatio;
      const totalWidth = dotSize + (count - 1) * offset;

      return (
        <div
          className="shrink-0 flex items-center justify-center"
          style={{ position: 'relative', width: totalWidth, height: Math.max(dotSize, 14) }}>
          {visibleHosts.map((host: string, index: number) => (
            <div
              key={`${host}-${index}`}
              style={{
                position: 'absolute',
                left: index * offset,
                top: (Math.max(dotSize, 14) - dotSize) / 2,
                width: dotSize,
                height: dotSize,
                borderRadius: '50%',
                overflow: 'hidden',
                background: '#fff',
                border: '1px solid rgba(0,0,0,0.15)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                zIndex: 10 - index,
              }}>
              <img
                src={getFaviconUrl(host)}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={e => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          ))}
        </div>
      );
    }

    if (data.avatar) return <img src={data.avatar} alt="" className="w-3.5 h-3.5 rounded-full object-cover shrink-0" />;
    if (data.icon && typeof data.icon === 'string')
      return <img src={data.icon} alt="" className="w-3.5 h-3.5 rounded-[4px] object-cover shrink-0 bg-white/10" />;
    return <LuSparkles size={11} className="text-[var(--color-iconDefault)] shrink-0" />;
  }

  if (['link'].includes(cat)) {
    let rawUrl = data.url || data.value || data.link || '';
    if (!rawUrl && typeof item.name === 'string' && item.name.startsWith('http')) rawUrl = item.name;
    if (rawUrl && typeof rawUrl === 'string') {
      try {
        const urlObj = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
        return (
          <img
            src={`https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`}
            alt=""
            className="w-3.5 h-3.5 rounded-[4px] shrink-0 bg-white/10"
          />
        );
      } catch (e) {}
    }
    return <FiLink size={11} className="text-[var(--color-iconDefault)] shrink-0" />;
  }

  if (['automation'].includes(cat)) {
    return <FiZap size={11} className="text-[var(--color-iconDefault)] shrink-0" />;
  }

  return <FiFileText size={11} className="text-[var(--color-iconDefault)] shrink-0" />;
};

const validCategories = [
  'note',
  'snippet',
  'link',
  'automation',
  'agent',
  'chat_agent',
  'ai',
  'assistant',
  'chat',
  'tabgroup',
  'Tab Session',
  'link group',
  'prompt',
  'aiprompt',
];
const isValidCategory = (item: ConvertibleItem) => {
  const cat = (item.category || '').toLowerCase();
  return validCategories.includes(cat) || item.data?.type === 'agent';
};

interface CreateTodoViewProps {
  items: ConvertibleItem[];
  onCreateTodo: (data: any) => void;
  isDarkMode?: boolean;
  initialItem?: any;
  selectedIndex?: number;
  onSelectedIndexChange?: (index: number) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  scrollableRef?: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
  isEditMode?: boolean;
  // Existing-items table props
  existingTodos?: TodoRecord[];
  activeTodoId?: string | null;
  onLoadTodo?: (todoItem: TodoRecord) => void;
  onDeleteTodo?: (id: string) => void;
  hotkeysMap?: Record<string, string>;
  onUpdateItemField?: (itemId: string, field: string, value: any) => Promise<void>;
}

const CreateTodoView: React.FC<CreateTodoViewProps> = ({
  items,
  onCreateTodo,
  isDarkMode: propIsDarkMode,
  initialItem,
  selectedIndex,
  onSelectedIndexChange,
  searchQuery: externalSearchQuery,
  onSearchQueryChange: setExternalSearchQuery,
  scrollableRef,
  onClose,
  isEditMode = false,
  existingTodos,
  activeTodoId,
  onLoadTodo,
  onDeleteTodo,
  hotkeysMap = {},
  onUpdateItemField,
}) => {
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
  const isEmbedded =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embed') === 'true';
  const isFocusMode = useUIStore((s: any) => s.isFocusMode);

  const triggerNotification = useNotification();

  const {
    todoTitle: title,
    setTodoTitle: setTitle,
    todoDescription: description,
    setTodoDescription: setDescription,
    scheduleType,
    setScheduleType,
    scheduleTime,
    setScheduleTime,
    recurringCycle,
    setRecurringCycle,
    selectedItems,
    setSelectedItems,
    tagIds: editorTagIds,
    setTagIds: setEditorTagIds,
    todoShortcut,
    setTodoShortcut,
    saveStatus,
    setSaveStatus,
    saveError,
    lastSavedAt,
    setLastSavedAt,
    lastSavedTitleRef,
    lastSavedShortcutRef,
    isDirty,
    handleSave,
    activeTodoId: liveTodoId,
    resetEditor,
  } = useTodoEditor({
    todoId: activeTodoId || initialItem?.todo_id || initialItem?.id || undefined,
    initialTitle: initialItem?.name || '',
    initialDescription: initialItem?.description || '',
    initialScheduleType: initialItem?.scheduleType || 'one-time',
    initialScheduleTime: initialItem?.scheduleTime,
    initialRecurringCycle: initialItem?.recurringType,
    initialItems: initialItem?.references || [],
    initialTags: initialItem?.tagIds || [],
  });

  useEffect(() => {
    return () => {
      resetEditor();
    };
  }, [resetEditor]);

  // ── Existing items table state ──
  const { isFavorite, toggleFavorite } = useFavorites();
  const [tagPopupOpen, setTagPopupOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [selectedTags, setSelectedTags] = useState<{ id: string; name: string }[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);

  useEffect(() => {
    if (!editorTagIds || editorTagIds.length === 0) {
      setSelectedTags(prev => (prev.length > 0 ? [] : prev));
      return;
    }
    const resolved = editorTagIds.map((id: string) => {
      const foundName = todoTagNamesMap[id] || (id.startsWith('temp_') ? id.replace('temp_', '') : id);
      return { id, name: foundName };
    });
    const currentIdsStr = selectedTags.map(t => t.id).sort().join(',');
    const newIdsStr = [...editorTagIds].sort().join(',');
    if (currentIdsStr !== newIdsStr) {
      setSelectedTags(resolved);
    }
  }, [editorTagIds, todoTagNamesMap]);

  const [todoHotkey, setTodoHotkey] = useState('');
  const shortcutInputRef = useRef<HTMLInputElement | null>(null);

  const { validateShortcut } = useShortcutValidation();
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  const [isShortcutOverrideable, setIsShortcutOverrideable] = useState<boolean>(false);
  const [shortcutConflictId, setShortcutConflictId] = useState<string | null>(null);

  const [shortcutsMap, setShortcutsMap] = useState<Record<string, string>>({});
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  useEffect(() => {
    const seededShortcuts = (existingTodos ?? []).reduce<Record<string, string>>((acc, todo) => {
      const shortcut = String(todo?.shortcut || '').trim();
      if (!shortcut) return acc;
      acc[todo.id] = shortcut;
      return acc;
    }, {});

    setShortcutsMap(seededShortcuts);

    readAllShortcuts()
      .then(allShortcuts => {
        setShortcutsMap({ ...seededShortcuts, ...allShortcuts });
      })
      .catch(() => {});
  }, [existingTodos]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      const checkShortcut = async () => {
        if (todoShortcut) {
          const currentCompound = getItemCompoundId({ id: initialItem?.id || liveTodoId, _kind: 'todo' });
          if (shortcutsMap && shortcutsMap[currentCompound] === todoShortcut) {
            if (active) {
              setShortcutError(null);
              setIsShortcutOverrideable(false);
              setShortcutConflictId(null);
            }
            return;
          }
          const res = await validateShortcut(todoShortcut, initialItem?.id || liveTodoId || 'new');
          if (active) {
            if (!res.isValid) {
              setShortcutError(res.errorMessage || 'This shortcut is already taken.');
              setIsShortcutOverrideable(!!res.isOverrideable);
              setShortcutConflictId(res.conflictId || null);
            } else {
              setShortcutError(null);
              setIsShortcutOverrideable(false);
              setShortcutConflictId(null);
            }
          }
        } else {
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

  const handleOverrideShortcut = useCallback(async () => {
    if (!todoShortcut) return;
    console.log('[ShortcutDebug][TodoEditor] Executing handleOverrideShortcut for todoShortcut:', todoShortcut);
    let targetId = initialItem?.id || liveTodoId;
    if (!targetId) {
      console.log('[ShortcutDebug][TodoEditor] Saving new todo item to get real ID before shortcut reassignment...');
      const saveSuccess = await handleSave(true);
      if (!saveSuccess) return;
      targetId = liveTodoId;
    }
    if (!targetId) return;

    if (shortcutConflictId) {
      console.log('[ShortcutDebug][TodoEditor] Explicitly clearing conflicting shortcut reference:', shortcutConflictId);
      await clearShortcut(shortcutConflictId, shortcutConflictId, 'todo');
    }

    const currentCompound = getItemCompoundId({ id: targetId, _kind: 'todo' });
    console.log(`[ShortcutDebug][TodoEditor] Saving shortcut "${todoShortcut}" to target ID "${targetId}" (compound: ${currentCompound})...`);
    await saveShortcut(targetId, currentCompound, todoShortcut, title || 'Task', 'todo');
    console.log('[ShortcutDebug][TodoEditor] Shortcut reassignment saved to DB. Clearing validation error.');
    setShortcutError(null);
    setIsShortcutOverrideable(false);
    setShortcutConflictId(null);
    await handleSave(true);
  }, [todoShortcut, initialItem, liveTodoId, title, shortcutConflictId, handleSave]);

  const tagPopupRef = useRef<HTMLDivElement | null>(null);

  const sortedTodos = useMemo(() => {
    const list = existingTodos ?? [];
    const q = tableSearchQuery.toLowerCase();
    const filtered = q ? list.filter(t => (t.name || '').toLowerCase().includes(q)) : list;
    return [...filtered].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }, [existingTodos, tableSearchQuery]);

  const [selectedType, setSelectedType] = useState('custom');
  const [selectedCategory, setSelectedCategory] = useState<
    'all' | 'note' | 'snippet' | 'link' | 'tabgroup' | 'automation' | 'agent'
  >('all');
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
  const [activeSlot, setActiveSlot] = useState<
    'title' | 'description' | 'mode' | 'date' | 'time' | 'resource' | 'submit' | 'shortcut' | null
  >('title');
  const [isEditing, setIsEditing] = useState(!initialItem);
  const [isFavoriteState, setIsFavoriteState] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionCaretPos, setMentionCaretPos] = useState({ start: 0, end: 0 });

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return items.filter(item => {
      if (!isValidCategory(item)) return false;
      return (item.name || '').toLowerCase().includes(q);
    });
  }, [items, mentionQuery]);

  const handleSelectMention = (item: ConvertibleItem) => {
    setSelectedItems(prev => {
      const exists = prev.some(i => i.id === item.id);
      if (exists) return prev;
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
    if (descriptionError) setDescriptionError(false);

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
    } else {
      setMentionQuery(null);
    }
  };

  const [isPickerActive, setIsPickerActive] = useState(false);

  const [time, setTime] = useState(() => {
    const initialTime = initialItem?.scheduleTime;
    return format(initialTime ? new Date(initialTime) : new Date(), 'HH:mm');
  });
  const [isTimeEditing, setIsTimeEditing] = useState(false);
  const [amPm, setAmPm] = useState<'AM' | 'PM'>(() => {
    const initialTime = initialItem?.scheduleTime;
    const h = (initialTime ? new Date(initialTime) : new Date()).getHours();
    return h >= 12 ? 'PM' : 'AM';
  });
  const [rawTimeText, setRawTimeText] = useState('');
  const [hourText, setHourText] = useState(() => {
    const initialTime = initialItem?.scheduleTime;
    let h = (initialTime ? new Date(initialTime) : new Date()).getHours();
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return h.toString().padStart(2, '0');
  });
  const [minText, setMinText] = useState(() => {
    const initialTime = initialItem?.scheduleTime;
    return (initialTime ? new Date(initialTime) : new Date()).getMinutes().toString().padStart(2, '0');
  });
  const [date, setDate] = useState(() => {
    const initialTime = initialItem?.scheduleTime;
    return format(initialTime ? new Date(initialTime) : new Date(), 'yyyy-MM-dd');
  });

  const [showRepeatDropdown, setShowRepeatDropdown] = useState(false);
  const [openAutomatically, setOpenAutomatically] = useState(false);
  const [createMore, setCreateMore] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const resourceButtonRef = useRef<HTMLButtonElement | null>(null);
  const [resourceDropdownPos, setResourceDropdownPos] = useState({ top: 0, left: 0 });
  const portalTarget =
    typeof document !== 'undefined' ? document.getElementById('todo-modal-portal-container') || document.body : null;

  const [focusedIndex, setFocusedIndex] = useState(0);
  const prevActiveSlotRef = useRef<string | null>(null);
  const shouldAutoOpenDateRef = useRef(false);
  const isSavingRef = useRef(false);
  const lastInitialItemRef = useRef<any>(undefined);
  const lastItemsSignatureRef = useRef<string>('');
  const lastActiveTodoIdRef = useRef<any>(undefined);
  const lastIsEditModeRef = useRef<boolean>(isEditMode);
  const hasUnsavedChanges = useRef(false);
  const itemsSignature = useMemo(
    () =>
      JSON.stringify(
        (items || []).map(item => [String(item.id), String(item.category || ''), String(item.name || '')]),
      ),
    [items],
  );

  // Sync UI date/time to scheduleTime
  useEffect(() => {
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
    } catch (e) {}
  }, [date, time, setScheduleTime, scheduleTime]);

  // Sync scheduleTime back to UI date/time when loading existing
  useEffect(() => {
    if (scheduleTime) {
      const newDate = format(new Date(scheduleTime), 'yyyy-MM-dd');
      const newTime = format(new Date(scheduleTime), 'HH:mm');
      setDate(prev => (newDate !== prev ? newDate : prev));
      setTime(prev => (newTime !== prev ? newTime : prev));
    }
  }, [scheduleTime]);

  // Auto-save logic (triggers for any task when both title & description are entered)
  useEffect(() => {
    if (!isDirty) return;

    // Strict autosave requirement: a todo must have both a title and a description
    const hasValidContent = title.trim().length > 0 && description.trim().length > 0;
    if (!hasValidContent) return;

    const timer = setTimeout(() => {
      handleSave(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [isDirty, handleSave, title, description, selectedItems.length, todoShortcut, todoHotkey, isFavoriteState]);

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
            } else {
              top = rect.bottom - portalRect.top + 8;
            }
            left = viewportLeft - portalRect.left;
          } else {
            if (showAbove) {
              top = rect.top + window.scrollY - dropdownHeight - 8;
            } else {
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
    return () => {};
  }, [activeSlot, isEditing]);

  const formatTime12Hour = (timeStr: string) => {
    if (!timeStr) return 'Select Time';
    try {
      const [h, m] = timeStr.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return timeStr;
      const dateObj = new Date();
      dateObj.setHours(h, m, 0, 0);
      return format(dateObj, 'h:mm a');
    } catch (e) {
      return timeStr;
    }
  };

  const types = [
    {
      id: 'custom',
      label: 'To-do',
      description: 'Assign a To-do to saved',
      icon: <FiCheckSquare size={12} />,
      color: '',
    },
    {
      id: 'saved_files',
      label: 'Automated To-do',
      description: 'Attach a saved file',
      icon: <FiFolder size={12} />,
      color: '',
    },
  ];

  const repeatOptions = [
    { id: 'daily', label: 'Daily', icon: <FiRepeat size={12} /> },
    { id: 'weekly', label: 'Weekly', icon: <FiRepeat size={12} /> },
    { id: 'monthly', label: 'Monthly', icon: <FiRepeat size={12} /> },
  ] as const;

  const modeOptions = [
    {
      id: 'one-time',
      label: 'One-time',
      description: 'Schedule for a single occurrence',
      icon: <FaRegClock size={12} />,
    },
    { id: 'recurring', label: 'Recurring', description: 'Set up a repeating schedule', icon: <FiRepeat size={12} /> },
  ] as const;

  const timeOptions = useMemo(() => {
    const opts = [{ id: 'specific', label: 'Specific Time', icon: <FiClock size={12} /> }];
    if (scheduleType === 'recurring') {
      opts.unshift({ id: 'anytime', label: 'Anytime of the day', icon: <FaRegClock size={12} /> });
    }
    return opts;
  }, [scheduleType]);

  const slots: ('title' | 'description' | 'mode' | 'date' | 'time' | 'resource' | 'submit' | 'shortcut')[] =
    useMemo(() => {
      return ['title', 'description', 'mode', 'date', 'time', 'resource', 'submit', 'shortcut'];
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
  const workspaceRef = React.useRef<HTMLDivElement>(null);
  const resultsContainerRef = React.useRef<HTMLDivElement>(null);
  const amPmBtnRef = React.useRef<HTMLButtonElement>(null);
  const lastEnterTime = React.useRef(0);
  const lastArrowPressedRef = React.useRef(0);

  const getAmPmFrom24h = (timeStr: string | null): 'AM' | 'PM' => {
    if (!timeStr || !timeStr.includes(':')) return 'AM';
    const h = parseInt(timeStr.split(':')[0], 10);
    return isNaN(h) ? 'AM' : h >= 12 ? 'PM' : 'AM';
  };

  const get24hTimeStr = (h12Text: string, mText: string, ampmVal: 'AM' | 'PM'): string => {
    let h = parseInt(h12Text, 10);
    const m = parseInt(mText, 10);
    if (isNaN(h)) h = 12;
    const mins = isNaN(m) ? 0 : m;

    if (ampmVal === 'PM') {
      if (h < 12) h += 12;
    } else {
      if (h === 12) h = 0;
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

  React.useEffect(() => {
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
    const isJustAssigningNewId =
      !initialItemChanged &&
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

    let item = initialItem;
    if (item && item.snippet && typeof item.snippet === 'object') {
      item = {
        ...item.snippet,
        todo_id: item.todo_id || item.snippet.todo_id || item.snippet.id || item.snippet.snippet_id,
        config: item.config || item.snippet.config,
      };
    }

    const isActualResource =
      item &&
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
        } catch (e) {}
      }
      const configIds = parsedConfig?.id;
      const hasAttachedFiles =
        (Array.isArray(configIds) && configIds.length > 0) ||
        (Array.isArray(item.references) && item.references.length > 0);
      const isCustom = !hasAttachedFiles;

      let cat = (item.category || item.snippet_category || 'note').toLowerCase();

      if (initialItemChanged) {
        setTitleError(false);
        setDescriptionError(false);
        setShortcutError(null);
        if (item.key || item.title || item.name || item.label) {
          const rawTitle = item.key || item.title || item.name || item.label;
          setTitle(
            typeof rawTitle === 'object' && rawTitle !== null
              ? (rawTitle as any).name ||
                  (Array.isArray((rawTitle as any).names)
                    ? (rawTitle as any).names.join(', ')
                    : JSON.stringify(rawTitle))
              : String(rawTitle),
          );
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
              const tagName = tag.name && tag.name !== tagId ? tag.name : (todoTagNamesMap[tagId] || tagId);
              return { id: tagId, name: tagName };
            }
            const tagIdStr = String(tag);
            const foundName = todoTagNamesMap[tagIdStr] || (tagIdStr.startsWith('temp_') ? tagIdStr.replace('temp_', '') : tagIdStr);
            return { id: tagIdStr, name: foundName };
          });
          setSelectedTags(resolved);
        } else {
          setSelectedTags([]);
        }
        setTodoShortcut(isEditMode ? item.shortcut || '' : '');
        const todoId = item.todo_id || item.id;
        if (todoId && isEditMode) {
          setIsFavoriteState(isFavorite(getItemCompoundId({ id: todoId, _kind: 'todo' })));
          setTodoHotkey(hotkeysMap[todoId] || '');
        } else {
          setIsFavoriteState(false);
          setTodoHotkey('');
        }

        if (item.is_anytime || (item.event_deadline && String(item.event_deadline).substring(0, 4) >= '2035')) {
          setIsAnytime(true);
        } else if (item.event_deadline) {
          const d = new Date(item.event_deadline);
          setDate(format(d, 'yyyy-MM-dd'));
          setTime(format(d, 'HH:mm'));
          setIsAnytime(false);
        } else {
          setIsAnytime(true);
        }

        if (item.is_recurring || (item as any).recurring || item.recurring_cycle) {
          setScheduleType('recurring');
          if (item.recurring_cycle) setRecurringCycle(String(item.recurring_cycle).toLowerCase() as any);
        } else {
          setScheduleType('one-time');
        }
      }

      let matchedItems: ConvertibleItem[] = [];

      if (isCustom) {
        setSelectedType('custom');
        setSelectedItem(null);
        setSelectedItems([]);
      } else {
        let parsedConfig = item.config;
        if (typeof parsedConfig === 'string' && (parsedConfig as string).trim().startsWith('{')) {
          try {
            parsedConfig = JSON.parse(parsedConfig);
          } catch (e) {
            console.error('[CreateTodoView] Failed to parse config JSON string:', parsedConfig, e);
          }
        }
        const configIds = parsedConfig?.id || [];
        const referenceIds = Array.isArray(item.references) ? item.references.map((r: any) => r.id) : [];
        const allReferenceIds = [...configIds, ...referenceIds];

        if (allReferenceIds.length > 0) {
          matchedItems = (items || []).filter(availableItem =>
            allReferenceIds.some(cid => {
              const availIdStr = String(availableItem.id);
              const cidStr = String(cid);
              return availIdStr === cidStr;
            }),
          );
        }

        if (matchedItems.length === 0) {
          const singleId = item.id || item.snippet_id || item.todo_id || item.snippet_todo_id;
          if (singleId) {
            const singleIdStr = String(singleId);
            const matched = (items || []).find(availableItem => {
              const availIdStr = String(availableItem.id);
              return availIdStr === singleIdStr;
            });
            if (matched) {
              matchedItems = [matched];
            }
          }
        }

        if (
          matchedItems.length === 0 &&
          (item.id || item.snippet_id || item.todo_id || (cat === 'command' && item.value))
        ) {
          if (cat !== 'snippet') {
            const possibleIds = [item.todo_id, item.id, item.snippet_todo_id];
            const numericId = possibleIds.find(
              id =>
                typeof id === 'number' ||
                (typeof id === 'string' && id.length > 0 && !isNaN(Number(id)) && !id.includes('-')),
            );

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
          scheduleType:
            (item as any).is_recurring || (item as any).recurring || (item as any).recurring_cycle
              ? 'recurring'
              : 'one-time',
          recurringCycle: (item as any).recurring_cycle ? String((item as any).recurring_cycle).toLowerCase() : 'daily',
          time: (item as any).event_deadline
            ? format(new Date(String((item as any).event_deadline)), 'HH:mm')
            : format(new Date(), 'HH:mm'),
          date: (item as any).event_deadline
            ? format(new Date(String((item as any).event_deadline)), 'yyyy-MM-dd')
            : format(new Date(), 'yyyy-MM-dd'),
          isAnytime: !!(
            (item as any).is_anytime ||
            ((item as any).event_deadline && String((item as any).event_deadline).substring(0, 4) >= '2035')
          ),
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
    } else {
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
      if (h > 12) h -= 12;
      if (h === 0) h = 12;
      setHourText(h.toString().padStart(2, '0'));
      setMinText(now.getMinutes().toString().padStart(2, '0'));
      setInternalSearchQuery('');
      if (setExternalSearchQuery) setExternalSearchQuery('');
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
      workspaceRef.current?.focus();
      return;
    }

    switch (activeSlot) {
      case 'title':
        titleInputRef.current?.focus();
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
            } else {
              document.getElementById('resource-button')?.focus();
            }
          }, 50);
        } else {
          document.getElementById('resource-button')?.focus();
        }
        break;
      case 'date':
        if (!isEditing) {
          workspaceRef.current?.focus();
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
    if (!hasSelectedTypeInitially) setHasSelectedTypeInitially(true);
    setIsTypeDropdownOpen(false);
    if (newType !== selectedType) {
      setSelectedType(newType);
      setSelectedItem(null);
      setSelectedItems([]);
      setTitle('');
      setDescription('');
      setInternalSearchQuery('');
      if (setExternalSearchQuery) setExternalSearchQuery('');
    }
  };

  const filteredItems = useMemo(() => {
    if (selectedType === 'custom') return [];
    const q = searchQuery.toLowerCase();

    return items.filter(item => {
      if (!isValidCategory(item)) return false;
      if (q.length < 1) return true;
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
      tabgroup: [] as ConvertibleItem[],
      automation: [] as ConvertibleItem[],
      agent: [] as ConvertibleItem[],
    };

    items.forEach(item => {
      if (!isValidCategory(item)) return;
      if (q.length > 0 && !(item.name || '').toLowerCase().includes(q)) return;
      const cat = (item.category || '').toLowerCase();

      categories.all.push(item);
      if (cat === 'note') categories.note.push(item);
      else if (cat === 'snippet') categories.snippet.push(item);
      else if (cat === 'tabgroup' || cat === 'Tab Session' || cat === 'link group') categories.tabgroup.push(item);
      else if (['link'].includes(cat)) categories.link.push(item);
      else if (
        ['agent', 'chat_agent', 'ai', 'assistant', 'chat', 'prompt', 'aiprompt'].includes(cat) ||
        item.data?.type === 'agent'
      )
        categories.agent.push(item);
      else if (['automation'].includes(cat)) categories.automation.push(item);
    });

    return categories;
  }, [items, searchQuery]);

  const toggleSelection = (item: ConvertibleItem) => {
    setSelectedItems(prev => {
      const exists = prev.some(i => i.id === item.id);
      if (exists) return prev.filter(i => i.id !== item.id);
      return [...prev, item];
    });
  };

  const handleCopyTitleToShortcut = React.useCallback(() => {
    const rawTitle =
      title.trim() || (selectedItems.length > 0 ? selectedItems[0]?.name || selectedItems[0]?.title || '' : '');
    const formatted = rawTitle.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
    setTodoShortcut(formatted);
    setTimeout(() => {
      shortcutInputRef.current?.focus();
    }, 0);
  }, [title, selectedItems, setTodoShortcut]);

  const handleCreate = React.useCallback(
    async (opts?: { overrideCreateMore?: boolean } | React.MouseEvent<HTMLButtonElement>) => {
      const shouldCreateMore =
        opts && typeof opts === 'object' && 'overrideCreateMore' in opts
          ? (opts as any).overrideCreateMore
          : createMore;
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
      if (isSavingRef.current) return;
      if (shortcutError) {
        setExplicitSaveStatus('error');
        return;
      }
      isSavingRef.current = true;
      setExplicitSaveStatus('saving');

      try {
        const promises: Promise<any>[] = [];
        if (isSavedFiles) {
          promises.push(
            Promise.resolve(
              onCreateTodo({
                type: selectedItems[0]?.category || 'note',
                item: selectedItems[0]?.data || selectedItems[0],
                selectedItems,
                title: title.trim() || getSingleItemName(selectedItems[0]) || 'Untitled Task',
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
                workspaceId: workspaceId || null,
                folderId: folderId || null,
                todoId: liveTodoId || undefined,
              }),
            ),
          );
        } else {
          promises.push(
            Promise.resolve(
              onCreateTodo({
                type: 'custom',
                item: null,
                title: title.trim() || 'Untitled Task',
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
                workspaceId: workspaceId || null,
                folderId: folderId || null,
                todoId: liveTodoId || undefined,
              }),
            ),
          );
        }
        if (!shouldCreateMore) {
          promises.push(new Promise(res => setTimeout(res, 600)));
        }
        await Promise.all(promises);
        // Refresh the shortcut map immediately; the table also falls back to item.shortcut.
        readAllShortcuts()
          .then(setShortcutsMap)
          .catch(() => {});

        if (shouldCreateMore) {
          resetEditor();
          const now = new Date();
          setTime(format(now, 'HH:mm'));
          setDate(format(now, 'yyyy-MM-dd'));
          setIsAnytime(false);
          setTodoHotkey('');
          setSelectedItem(null);
          setSelectedItems([]);
          setSelectedTags([]);
          setEditorTagIds([]);
          setTodoShortcut('');
          setShortcutError(null);
          setIsFavoriteState(false);
          setActiveSlot('title');
          titleInputRef.current?.focus();
          setExplicitSaveStatus('saved');
          isSavingRef.current = false;
          setTimeout(() => {
            setExplicitSaveStatus('idle');
          }, 1500);
        } else {
          setExplicitSaveStatus('saved');
          setTimeout(() => {
            setExplicitSaveStatus('idle');
            isSavingRef.current = false;
          }, 1500);
        }
      } catch (error) {
        setExplicitSaveStatus('error');
        isSavingRef.current = false;
        setTimeout(() => setExplicitSaveStatus('idle'), 2000);
      }
    },
    [
      selectedItems,
      title,
      description,
      scheduleType,
      recurringCycle,
      isAnytime,
      time,
      date,
      openAutomatically,
      createMore,
      onCreateTodo,
      onClose,
      setTitleError,
      todoShortcut,
      todoHotkey,
      selectedTags,
      isFavoriteState,
      shortcutError,
      resetEditor,
    ],
  );

  React.useEffect(() => {
    const handleSaveTrigger = () => {
      const saveBtn = document.getElementById('final-save-button');
      if (saveBtn) (saveBtn as HTMLButtonElement).click();
      else handleCreate();
    };
    window.addEventListener('trigger-todo-save', handleSaveTrigger);
    return () => window.removeEventListener('trigger-todo-save', handleSaveTrigger);
  }, [handleCreate]);

  const cleanDescription = (rawDesc: any): string => {
    if (!rawDesc) return '';
    const text = typeof rawDesc === 'object' && rawDesc !== null ? JSON.stringify(rawDesc) : String(rawDesc);
    return text.replace(/<\/?[^>]+(>|$)/g, '');
  };

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent | KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        lastArrowPressedRef.current = Date.now();
      }
      // 1. Check shortcuts FIRST before anything else (bypasses all early returns and isEditing blocks)
      if (e.key === 'Enter') {
        const isSaveAndCreateNewShortcut = (isMac ? e.metaKey : e.ctrlKey) && e.shiftKey && e.key === 'Enter';
        const isSaveShortcut = (isMac ? e.metaKey : e.ctrlKey) && !e.shiftKey && e.key === 'Enter';

        if (isSaveAndCreateNewShortcut || isSaveShortcut) {
          e.preventDefault();
          e.stopPropagation();
          const now = Date.now();
          if (now - lastEnterTime.current < 150) return;
          lastEnterTime.current = now;
          handleCreate({ overrideCreateMore: isSaveAndCreateNewShortcut });
          return;
        }
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
          return;
        }
        const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

        // Let the custom time picker handle its own arrow navigation natively
        if (e.target instanceof Element && e.target.closest('.custom-time-picker-popup')) {
          return;
        }

        if (isInput && (activeSlot === 'resource' || activeSlot === 'description' || activeSlot === 'time')) {
          const target = e.target as HTMLInputElement | HTMLTextAreaElement;
          const isAtStart = target.selectionStart === 0 && target.selectionEnd === 0;
          const isAtEnd = target.selectionStart === target.value.length && target.selectionEnd === target.value.length;
          if (e.key === 'ArrowLeft' && !isAtStart) return;
          if (e.key === 'ArrowRight' && !isAtEnd) return;
        }

        const currentIndex = activeSlot ? slots.indexOf(activeSlot) : -1;
        let targetSlot: (typeof slots)[number] | null = null;
        if (e.key === 'ArrowRight' && currentIndex < slots.length - 1) targetSlot = slots[currentIndex + 1];
        else if (e.key === 'ArrowLeft' && currentIndex > 0) targetSlot = slots[currentIndex - 1];

        if (targetSlot) {
          e.preventDefault();
          e.stopPropagation();
          setIsPickerActive(false);
          if (activeSlot === 'time') setIsTimeEditing(false);
          setActiveSlot(targetSlot);
          setFocusedIndex(0);
          setIsEditing(true);
          return;
        }
      }
      if (e.key === 'Tab') {
        const isInlineTimeInput = e.target instanceof Element && e.target.closest('.inline-time-input');
        if (isInlineTimeInput) return;

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
        const handleVerticalNav = (
          options: readonly any[],
          currentIdx: number,
          setter: (idx: number) => void,
          liveUpdate?: (id: any) => void,
        ) => {
          const nextIndex =
            e.key === 'ArrowDown'
              ? (currentIdx + 1) % options.length
              : (currentIdx - 1 + options.length) % options.length;
          setter(nextIndex);
          if (liveUpdate) liveUpdate(options[nextIndex].id);
          e.stopPropagation();
          e.preventDefault();
        };

        if (activeSlot === 'resource' && isEditing) {
          const itemsList = categoriesData[selectedCategory] || [];
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
            if (e.shiftKey) {
              e.preventDefault();
              e.stopPropagation();
              handleCopyTitleToShortcut();
              return;
            }
            setActiveSlot('description');
            setIsEditing(true);
          } else if (activeSlot === 'resource') {
            const targetItem = filteredItems[focusedIndex];
            if (targetItem) {
              toggleSelection(targetItem);
            }
          } else if (activeSlot === 'mode') {
            const modeOpts = [{ id: 'one-time' }, { id: 'daily' }, { id: 'weekly' }, { id: 'monthly' }];
            const selectedOpt = modeOpts[focusedIndex];
            if (selectedOpt) {
              if (selectedOpt.id === 'one-time') {
                setScheduleType('one-time');
              } else {
                setScheduleType('recurring');
                setRecurringCycle(selectedOpt.id as any);
              }
              setIsEditing(true);
              setActiveSlot('date');
              setFocusedIndex(0);
            }
          } else if (activeSlot === 'date') {
            if (isEditing) {
              const dateOpts = [{ id: 'custom' }, { id: 'tomorrow' }, { id: 'in-one-week' }];
              const selectedOpt = dateOpts[focusedIndex] || dateOpts[0];
              if (selectedOpt.id === 'custom') {
                setIsEditing(false);
                dateInputRef.current?.focus();
                try {
                  dateInputRef.current?.showPicker();
                } catch (e) {
                  console.error('[Date Custom Enter] showPicker error:', e);
                }
              } else if (selectedOpt.id === 'tomorrow') {
                const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
                setDate(tomorrowStr);
                setIsEditing(false);
                setActiveSlot('time');
                setFocusedIndex(0);
              } else if (selectedOpt.id === 'in-one-week') {
                const nextWeekStr = format(addDays(new Date(), 7), 'yyyy-MM-dd');
                setDate(nextWeekStr);
                setIsEditing(false);
                setActiveSlot('time');
                setFocusedIndex(0);
              }
            } else {
              setIsEditing(true);
              setFocusedIndex(0);
            }
          } else if (activeSlot === 'time') {
            if (isTimeEditing) {
              setIsTimeEditing(false);
              setActiveSlot('resource');
              setIsEditing(true);
            } else {
              const targetTimeOpt = focusedIndex === 0 ? 'anytime' : 'specific';
              if (targetTimeOpt === 'anytime') {
                setIsAnytime(true);
                setActiveSlot('resource');
                setIsEditing(true);
              } else {
                setIsAnytime(false);
                setIsTimeEditing(true);
              }
            }
          } else if (activeSlot === 'submit') {
            handleCreate();
          }
          setFocusedIndex(0);
        } else {
          if (activeSlot === 'date') {
            setActiveSlot('time');
            setIsEditing(true);
            setFocusedIndex(0);
          } else {
            setIsEditing(true);
          }
          e.preventDefault();
        }
      }
    },
    [
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
    ],
  );

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
      // For popover slots (mode, resource, time), first Escape closes the popover
      if (isEditing && activeSlot && ['mode', 'resource', 'time'].includes(activeSlot)) {
        setIsEditing(false);
        return true;
      }
      // For title/description (or any other slot), single Escape closes the modal
      onClose();
      return true;
    });
    return unregister;
  }, [isTimeEditing, isEditing, activeSlot, onClose]);

  return (
    <>
      <style>{hideNativeIconsStyle}</style>
      <WorkspaceEditorLayout
        title={isEditMode ? 'Edit task' : 'Create a task'}
        isDirty={isDirty}
        saveStatus={saveStatus as any}
        lastSavedAt={lastSavedAt}
        activeId={liveTodoId || null}
        hideRightColumnBorder={selectedItems.length === 0}
        isFocusMode={isFocusMode}
        onSave={async () => {
          const result = await handleSave();
          return true;
        }}
        onDiscard={() => {}}
        deleteModalProps={{
          isOpen: pendingDeleteId !== null,
          onClose: () => setPendingDeleteId(null),
          onConfirm: async () => {
            if (pendingDeleteId) {
              onDeleteTodo?.(pendingDeleteId);
            }
            setPendingDeleteId(null);
          },
          title: 'Delete task?',
          description: 'This task will be permanently removed. This action cannot be undone.',
        }}
        searchQuery={tableSearchQuery}
        setSearchQuery={setTableSearchQuery}
        searchPlaceholder="Search todos…"
        headerActions={
          <SharedPropertiesToolbar
            key={liveTodoId || 'new-todo'}
            initialSnippet={{ tags: selectedTags, tagIds: editorTagIds, category: 'todo' }}
            compoundId={
              liveTodoId
                ? getItemCompoundId({
                    id: liveTodoId,
                    workspace_id: workspaceId || null,
                    folder_id: folderId || null,
                    snippet: { id: liveTodoId, category: 'todo' },
                  })
                : 'new'
            }
            defaultName={title}
            showTodo={false}
            showLocationPicker={false}
            onChange={props => {
              if (props.isFav !== undefined) setIsFavoriteState(props.isFav);
              if (props.pendingHotkey !== undefined) setTodoHotkey(props.pendingHotkey);
              if (props.pendingShortcut !== undefined) setTodoShortcut(props.pendingShortcut);
              if (props.workspaceId !== undefined) setWorkspaceId(props.workspaceId);
              if (props.folderId !== undefined) setFolderId(props.folderId);
              if (props.selectedTags !== undefined) {
                setSelectedTags(props.selectedTags);
                const newTIds = props.selectedTags.map(t => t.id);
                setEditorTagIds(newTIds);
                void handleSave(true, { tagIds: newTIds });
              }
            }}
            layout="horizontal"
            showShortcut={false}
            openPopupsToLeft={true}
            openPopupsToBottom={true}
          />
        }
        rightColumnContent={
          selectedItems.length > 0 ? (
            <div className="flex flex-col bg-transparent overflow-visible w-full">
              <div className="flex flex-col gap-4 mt-2">

                {/* Attached Saved — only shown when items are selected */}
                <div className="mt-4 px-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-2">
                    Attached Saved
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedItems.map(item => (
                      <span
                        key={item.id}
                        className="flex items-center gap-1 text-[10px] font-medium text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md cursor-pointer hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-300 transition-colors"
                        title="Click to remove"
                        onClick={() => setSelectedItems(prev => prev.filter(s => s.id !== item.id))}>
                        <span className="truncate max-w-[120px]">{getSingleItemName(item) || 'Untitled'}</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-2.5 h-2.5 shrink-0 opacity-60"
                          viewBox="0 0 20 20"
                          fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : undefined
        }
        bottomListContent={
          existingTodos && existingTodos.length >= 0 ? (
            <ExistingItemsTable<TodoRecord>
              items={sortedTodos}
              activeItemId={liveTodoId ?? null}
              onLoadItem={id => {
                const todo = (existingTodos ?? []).find(t => t.id === id);
                if (todo && onLoadTodo) onLoadTodo(todo);
              }}
              onUpdateItemField={async (itemId: string, field: 'title' | 'shortcut' | 'tags', value: any) => {
                if (onUpdateItemField) {
                  await onUpdateItemField(itemId, field, value);
                }

                if (field === 'title') {
                  await updateTodoContent(itemId, { name: value });
                } else if (field === 'shortcut') {
                  const record = existingTodos?.find(p => p.id === itemId);
                  if (record) {
                    const compoundId = getItemCompoundId({
                      id: record.id,
                      workspace_id: record.workspaceId || null,
                      folder_id: record.folderId || null,
                      snippet: { id: record.id, category: 'todo' }
                    });
                    if (value) {
                      await saveShortcut(itemId, compoundId, value.toLowerCase().replace(/[^a-z0-9]/g, ''), record.name || 'Untitled', 'todo');
                    } else {
                      await clearShortcut(itemId, compoundId, 'todo');
                    }
                  }
                } else if (field === 'tags') {
                  const tagNames = value.split(',').map((t: string) => t.trim()).filter(Boolean);
                  const resolvedTags: any[] = [];
                  const allTags = useDbStore.getState().tags;
                  for (const name of tagNames) {
                    const matchedTag = allTags.find((t: any) => t.name.toLowerCase() === name.toLowerCase());
                    if (matchedTag) {
                      resolvedTags.push(matchedTag);
                    } else {
                      const record = existingTodos?.find(p => p.id === itemId);
                      const workspaces = useDbStore.getState().workspaces;
                      const smartWs = record?.workspaceId || workspaces[0]?.id;
                      if (smartWs) {
                        const newTag = await createTag(name, smartWs);
                        resolvedTags.push(newTag);
                      }
                    }
                  }
                  await updateTodoContent(itemId, { tagIds: resolvedTags.map((t: any) => t.id) });
                }

                const currentActiveId = liveTodoId || initialItem?.todo_id || initialItem?.id || activeTodoId;
                if (String(itemId) === String(currentActiveId)) {
                  if (field === 'title') {
                    setTitle(value);
                    if (lastSavedTitleRef) lastSavedTitleRef.current = value;
                  } else if (field === 'shortcut') {
                    setTodoShortcut(value);
                    if (lastSavedShortcutRef) lastSavedShortcutRef.current = value;
                  }
                  if (setSaveStatus) setSaveStatus('saved');
                  if (setLastSavedAt) setLastSavedAt(new Date());
                }
              }}
              getItemTitle={item => item.name || 'Untitled'}
              getItemPreview={item => item.description || ''}
              getItemCompoundId={item =>
                getItemCompoundId({
                  id: item.id,
                  workspace_id: item.workspaceId || null,
                  folder_id: item.folderId || null,
                  snippet: { id: item.id, category: 'todo' },
                })
              }
              getItemType={() => 'todo'}
              shortcutsMap={shortcutsMap}
              hotkeysMap={hotkeysMap}
              isFavorite={isFavorite}
              toggleFavorite={toggleFavorite}
              onDeleteClick={id => {
                setPendingDeleteId(id);
              }}
              emptyStateMessage="No tasks yet. Create your first task above!"
              title=""
              tagNamesMap={todoTagNamesMap}
            />
          ) : null
        }
        headerRightPaddingClass={selectedItems.length > 0 ? "pr-[220px]" : "pr-6"}
        containerMaxWidthClass={selectedItems.length > 0 ? "max-w-[1200px]" : "max-w-[940px]"}
      >
        <div className="flex-1 flex flex-col min-h-0 relative">
          <div ref={workspaceRef} className="w-full flex-1 flex flex-col min-h-0 px-3 pt-0.5 pb-2">
            {/* Left Column: Input Fields & Description */}
            <div className="flex-1 flex flex-col relative min-h-0">
              {/* Title & Shortcut block */}
              <div className="flex flex-col w-full flex-shrink-0 relative">
                <EditorTitleShortcutInput
                  titleError={titleError}
                  shortcutError={shortcutError}
                  isOverrideable={isShortcutOverrideable}
                  onOverrideShortcut={handleOverrideShortcut}
                  title={title}
                  setTitle={val => {
                    setTitle(val);
                    if (titleError) setTitleError(false);
                  }}
                  shortcut={todoShortcut}
                  setShortcut={setTodoShortcut}
                  titleRef={titleInputRef}
                  shortcutRef={shortcutInputRef}
                  onArrowDownPress={() => descriptionRef.current?.focus()}
                  onTitleBlur={() => {
                    if (!title.trim()) {
                      setTitleError(true);
                    }
                  }}
                  onTitleEnter={shiftKey => {
                    if (shiftKey) {
                      handleCopyTitleToShortcut();
                    } else {
                      if (!title.trim()) {
                        setTitleError(true);
                      } else {
                        descriptionRef.current?.focus();
                      }
                    }
                  }}
                  onCopyTitleToShortcut={handleCopyTitleToShortcut}
                />
              </div>

              {/* Description Field */}
              <div className="flex-1 flex flex-col gap-1.5 relative min-h-[120px] mt-4">
                <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 px-3.5 flex items-center gap-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <div
                  className={`flex-1 min-h-[160px] relative rounded-xl border transition-all duration-200 ${descriptionError ? 'border-red-500 ring-1 ring-red-500 bg-red-500/5' : 'border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]'} overflow-visible px-3.5 py-2 flex flex-col gap-3`}>
                  <div className="flex-1 flex flex-col relative min-h-[80px]">
                    <textarea
                      ref={descriptionRef as any}
                      placeholder="Add description..."
                      value={description}
                      onChange={handleDescriptionChange}
                      onFocus={() => {
                        setActiveSlot('description');
                        setIsEditing(true);
                      }}
                      className="w-full flex-1 bg-transparent outline-none border-none shadow-none focus:ring-0 resize-none text-sm font-medium font-sans text-neutral-700 dark:text-neutral-300 placeholder-black/35 dark:placeholder-white/35 custom-scrollbar"
                    />

                    {!description && (
                      <div className="absolute left-1 bottom-1 text-neutral-500 text-[13px] pointer-events-none select-none flex items-center gap-1.5 opacity-60">
                        Type{' '}
                        <kbd className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 border border-black/10 dark:border-white/10 text-[10px] font-bold font-mono text-[var(--color-textMain)]">
                          @
                        </kbd>{' '}
                        to attach
                      </div>
                    )}
                  </div>

                  {/* The footer buttons and create new button will be placed at the bottom of this wrapper natively */}

                  {mentionQuery !== null && mentionSuggestions.length > 0 && (
                    <div
                      className="absolute left-3 top-[40px] mt-1 w-[260px] max-h-[220px] bg-[var(--color-contextMenuBg,#171821)] supports-[backdrop-filter]:bg-[var(--color-contextMenuBg,#171821)]/90 backdrop-blur-xl border border-[var(--color-borderDefault)] rounded-xl shadow-2xl z-[99999] overflow-y-auto [&::-webkit-scrollbar]:hidden p-1 flex flex-col gap-0.5"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      {mentionSuggestions.map((item, idx) => {
                        const isSelected = idx === mentionIndex;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectMention(item)}
                            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[var(--color-bgMuted)] text-[var(--color-textMain)] font-medium'
                                : 'text-[var(--color-textMuted)] hover:bg-[var(--color-bgHover)] hover:text-[var(--color-textMain)]'
                            }`}>
                            <div className="shrink-0">{getItemIcon(item)}</div>
                            <span className="text-[12.5px] truncate flex-1">{getSingleItemName(item)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Footer Row (Scheduling + Create New) */}
                  <div
                    className={`flex items-end justify-between w-full shrink-0 relative ${activeSlot && ['time', 'resource', 'date', 'mode'].includes(activeSlot) ? 'z-[300]' : 'z-30'}`}>
                    <div className="flex flex-wrap items-center gap-2 relative">
                      <div className="relative shrink-0">
                        <button
                          id="mode-button"
                          type="button"
                          onClick={() => {
                            if (activeSlot !== 'mode') {
                              setActiveSlot('mode');
                              setIsEditing(true);
                              setFocusedIndex(0);
                            } else {
                              setIsEditing(!isEditing);
                            }
                          }}
                          className={`px-3 py-1.5 flex items-center gap-1.5 rounded-xl border transition-all text-[13px] font-medium cursor-pointer ${
                            activeSlot === 'mode'
                              ? 'bg-white/[0.04] border-white text-white shadow-md ring-1 ring-white/20'
                              : 'bg-white/[0.03] border-white/[0.05] text-neutral-300 hover:brightness-110'
                          }`}>
                          <FiRepeat size={14} className="text-[var(--color-iconDefault)]" />
                          <span>
                            {scheduleType === 'one-time'
                              ? 'Once'
                              : (recurringCycle || 'daily').charAt(0).toUpperCase() +
                                (recurringCycle || 'daily').slice(1)}
                          </span>
                          <svg
                            width="10"
                            height="6"
                            viewBox="0 0 10 6"
                            fill="none"
                            className="ml-1 text-[var(--color-iconDefault)]">
                            <path
                              d="M1 1L5 5L9 1"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>

                        {activeSlot === 'mode' && isEditing && (
                          <div className="absolute bottom-full mb-2 left-0 w-[160px] rounded-xl shadow-2xl z-[99999] bg-[#1c1d27]/95 backdrop-blur-md border border-white/10 overflow-hidden">
                            {[
                              { id: 'one-time', label: 'Once', icon: <FaRegClock size={12} /> },
                              { id: 'daily', label: 'Daily', icon: <FiRepeat size={12} /> },
                              { id: 'weekly', label: 'Weekly', icon: <FiRepeat size={12} /> },
                              { id: 'monthly', label: 'Monthly', icon: <FiRepeat size={12} /> },
                            ].map((opt, idx) => {
                              const isFocused = idx === focusedIndex;
                              return (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => {
                                    if (opt.id === 'one-time') {
                                      setScheduleType('one-time');
                                    } else {
                                      setScheduleType('recurring');
                                      setRecurringCycle(opt.id as any);
                                    }
                                    setIsEditing(true);
                                    setActiveSlot('date');
                                    setFocusedIndex(0);
                                  }}
                                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[12.5px] font-medium transition-colors cursor-pointer ${
                                    isFocused
                                      ? 'bg-[var(--color-bgMuted)] text-white'
                                      : 'text-neutral-300 hover:bg-white/5'
                                  }`}>
                                  {opt.icon}
                                  <span>{opt.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="relative shrink-0">
                        <button
                          onClick={() => {
                            if (activeSlot !== 'date') {
                              setActiveSlot('date');
                              setIsEditing(true);
                              setFocusedIndex(0);
                            } else {
                              setIsEditing(!isEditing);
                            }
                          }}
                          className={`px-3 py-1.5 flex items-center gap-1.5 rounded-xl border transition-all text-[13px] font-medium cursor-pointer ${
                            activeSlot === 'date' && !isEditing
                              ? 'bg-white/[0.04] border-white text-white shadow-md ring-1 ring-white/20'
                              : 'bg-white/[0.03] border-white/[0.05] hover:brightness-110 text-neutral-200'
                          }`}>
                          <FaRegCalendarAlt size={14} className="text-[var(--color-iconDefault)]" />
                          <span>
                            {date
                              ? `${format(new Date(date), 'do MMM yyyy')} · ${!isAnytime && time ? formatTime12Hour(time) : 'Any time'}`
                              : 'Date'}
                          </span>
                        </button>

                        {activeSlot === 'date' && isEditing && (
                          <NewDueDateDropdown
                            isOpen={activeSlot === 'date' && isEditing}
                            onClose={() => setIsEditing(false)}
                            onSelect={({ date: selDate, time: selTime, isAnytime: selIsAnytime }) => {
                              setDate(selDate);
                              if (selTime !== null) {
                                setTime(selTime);
                              }
                              setIsAnytime(selIsAnytime);
                              setIsEditing(false);
                              setActiveSlot('resource');
                              setFocusedIndex(0);
                            }}
                            currentDate={date}
                            currentTime={time}
                          />
                        )}
                      </div>

                      <div className="relative shrink-0">
                        <button
                          ref={resourceButtonRef}
                          type="button"
                          onClick={() => {
                            if (activeSlot !== 'resource') {
                              setActiveSlot('resource');
                              setIsEditing(true);
                              setFocusedIndex(0);
                            } else {
                              setIsEditing(!isEditing);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 font-medium text-[13px] cursor-pointer ${
                            activeSlot === 'resource'
                              ? 'bg-white/[0.04] border-white text-white shadow-md ring-1 ring-white/20'
                              : 'bg-white/[0.03] border-white/[0.05] text-neutral-300 hover:brightness-110'
                          }`}>
                          <FiLink
                            size={14}
                            className={selectedItems.length > 0 ? 'text-purple-400' : 'text-[var(--color-iconDefault)]'}
                          />
                          <span>
                            {selectedItems.length > 0
                              ? `${selectedItems.length} File${selectedItems.length > 1 ? 's' : ''} Attached`
                              : 'Attach saved'}
                          </span>
                          <svg
                            width="10"
                            height="6"
                            viewBox="0 0 10 6"
                            fill="none"
                            className="ml-1 text-[var(--color-iconDefault)]">
                            <path
                              d="M1 1L5 5L9 1"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>

                        {activeSlot === 'resource' &&
                          isEditing &&
                          ReactDOM.createPortal(
                            <div
                              style={{
                                position: 'absolute',
                                top: `${resourceDropdownPos.top}px`,
                                left: `${resourceDropdownPos.left}px`,
                              }}
                              className="w-[600px] max-w-[80vw] rounded-2xl shadow-2xl z-[99999] bg-[#1c1d27]/95 backdrop-blur-md border border-white/10 overflow-hidden flex flex-col font-sans"
                              onClick={e => e.stopPropagation()}>
                              {/* Search and Header */}
                              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] bg-white/[0.01]">
                                <div className="flex items-center gap-2 flex-1">
                                  <FiSearch size={14} className="text-neutral-400 shrink-0" />
                                  <input
                                    id="resource-search-input"
                                    type="text"
                                    placeholder="Search and select files..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="flex-1 bg-transparent border-none text-neutral-200 placeholder:text-neutral-500 focus:outline-none text-[13px] font-medium min-w-0 pl-1"
                                  />
                                  {searchQuery && (
                                    <button
                                      onClick={() => setSearchQuery('')}
                                      className="text-neutral-500 hover:text-neutral-300 transition-colors shrink-0">
                                      <FaTimes size={10} />
                                    </button>
                                  )}
                                </div>

                                {selectedItems.length > 0 && (
                                  <div className="flex items-center gap-2 px-2.5 py-1 bg-white/[0.03] border border-white/[0.08] rounded-lg text-[11px] text-neutral-400 font-normal">
                                    <span className="shrink-0">{selectedItems.length} selected</span>
                                  </div>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsEditing(false);
                                    setActiveSlot(null);
                                  }}
                                  className="p-1 text-neutral-500 hover:text-neutral-300 transition-colors cursor-pointer ml-1">
                                  <FaTimes size={12} />
                                </button>
                              </div>

                              {/* Columns Layout */}
                              <div className="flex h-[250px]">
                                {/* Sidebar Categories */}
                                <div className="w-[150px] shrink-0 flex flex-col gap-0.5 py-2 px-1.5 border-r border-white/[0.04] bg-white/[0.01] overflow-y-auto no-scrollbar">
                                  {[
                                    {
                                      key: 'all' as const,
                                      label: 'All',
                                      items: categoriesData.all,
                                      icon: (
                                        <svg
                                          className="w-3.5 h-3.5 shrink-0 text-[var(--color-iconDefault)]"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2"
                                          strokeLinecap="round"
                                          strokeLinejoin="round">
                                          <rect x="3" y="3" width="7" height="7" rx="1" />
                                          <rect x="14" y="3" width="7" height="7" rx="1" />
                                          <rect x="14" y="14" width="7" height="7" rx="1" />
                                          <rect x="3" y="14" width="7" height="7" rx="1" />
                                        </svg>
                                      ),
                                    },
                                    {
                                      key: 'note' as const,
                                      label: 'Notes',
                                      items: categoriesData.note,
                                      icon: (
                                        <FiFileText size={14} className="text-[var(--color-iconDefault)] shrink-0" />
                                      ),
                                    },
                                    {
                                      key: 'snippet' as const,
                                      label: 'Snippets',
                                      items: categoriesData.snippet,
                                      icon: <FiCode size={14} className="text-[var(--color-iconDefault)] shrink-0" />,
                                    },
                                    {
                                      key: 'link' as const,
                                      label: 'Links',
                                      items: categoriesData.link,
                                      icon: <FiLink size={14} className="text-[var(--color-iconDefault)] shrink-0" />,
                                    },
                                    {
                                      key: 'tabgroup' as const,
                                      label: 'Tab Sessions',
                                      items: categoriesData.tabgroup,
                                      icon: (
                                        <FaLayerGroup size={14} className="text-[var(--color-iconDefault)] shrink-0" />
                                      ),
                                    },
                                    {
                                      key: 'automation' as const,
                                      label: 'Automations',
                                      items: categoriesData.automation,
                                      icon: <FiZap size={14} className="text-[var(--color-iconDefault)] shrink-0" />,
                                    },
                                    {
                                      key: 'agent' as const,
                                      label: 'Chat Agents',
                                      items: categoriesData.agent,
                                      icon: <FaRobot size={14} className="text-[var(--color-iconDefault)] shrink-0" />,
                                    },
                                  ].map(col => {
                                    const isActive = selectedCategory === col.key;
                                    return (
                                      <button
                                        key={col.key}
                                        type="button"
                                        onClick={() => setSelectedCategory(col.key)}
                                        className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-all ${
                                          isActive
                                            ? 'bg-white/[0.06] text-white font-medium border border-white/10'
                                            : 'text-neutral-400 hover:bg-white/[0.03] hover:text-white border border-transparent'
                                        }`}>
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          {col.icon}
                                          <span className="text-[12px] truncate font-normal">{col.label}</span>
                                        </div>
                                        <span className="text-[9.5px] text-neutral-500 tabular-nums font-normal">
                                          {col.items.length}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>

                                {/* Items List */}
                                <div className="flex-1 flex flex-col bg-transparent overflow-hidden">
                                  {(() => {
                                    const activeCol = [
                                      { key: 'all' as const, label: 'All', items: categoriesData.all },
                                      { key: 'note' as const, label: 'Notes', items: categoriesData.note },
                                      { key: 'snippet' as const, label: 'Snippets', items: categoriesData.snippet },
                                      { key: 'link' as const, label: 'Links', items: categoriesData.link },
                                      {
                                        key: 'tabgroup' as const,
                                        label: 'Tab Sessions',
                                        items: categoriesData.tabgroup,
                                      },
                                      {
                                        key: 'automation' as const,
                                        label: 'Automations',
                                        items: categoriesData.automation,
                                      },
                                      { key: 'agent' as const, label: 'Chat Agents', items: categoriesData.agent },
                                    ].find(c => c.key === selectedCategory)!;

                                    return (
                                      <>
                                        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-white/[0.04] bg-white/[0.01] shrink-0">
                                          <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider">
                                            {activeCol.label}
                                          </span>
                                          <span className="text-neutral-700 font-normal">·</span>
                                          <span className="text-[10px] text-neutral-500 tabular-nums font-normal">
                                            {activeCol.items.length} items
                                          </span>
                                        </div>
                                        <div
                                          ref={resultsContainerRef}
                                          className="overflow-y-auto no-scrollbar flex flex-col flex-1">
                                          {activeCol.items.length === 0 ? (
                                            <div className="h-full flex items-center justify-center">
                                              <span className="text-[12px] text-neutral-600 font-normal">
                                                Nothing here
                                              </span>
                                            </div>
                                          ) : (
                                            activeCol.items.map((item: ConvertibleItem, idx: number) => {
                                              const isSelected = selectedItems.some(i => i.id === item.id);
                                              const isFocused = idx === focusedIndex;
                                              return (
                                                <div
                                                  key={item.id}
                                                  data-idx={idx}
                                                  onClick={() => toggleSelection(item)}
                                                  className={`flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.04] cursor-pointer transition-all ${
                                                    isSelected
                                                      ? 'bg-white/[0.04] text-neutral-100'
                                                      : isFocused
                                                        ? 'bg-white/[0.08] text-white font-medium'
                                                        : 'text-neutral-300 hover:bg-white/[0.02] hover:text-white'
                                                  }`}>
                                                  <div
                                                    className={`w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center shrink-0 transition-all ${
                                                      isSelected
                                                        ? 'bg-neutral-300 border-neutral-400 text-neutral-900'
                                                        : 'border-neutral-600 bg-transparent'
                                                    }`}>
                                                    {isSelected && <FaCheck size={7} />}
                                                  </div>
                                                  <div className="flex-1 flex items-center min-w-0 gap-2">
                                                    {getItemIcon(item)}
                                                    <span className="text-[12.5px] font-normal leading-snug truncate">
                                                      {getSingleItemName(item)}
                                                    </span>
                                                    {selectedCategory === 'all' && item.category && (
                                                      <span className="text-[10px] text-neutral-500 font-normal shrink-0 ml-1.5 opacity-70">
                                                        {(() => {
                                                          const catLower = item.category.toLowerCase();
                                                          if (
                                                            catLower === 'agent' ||
                                                            catLower === 'chat_agent' ||
                                                            catLower === 'prompt' ||
                                                            catLower === 'aiprompt'
                                                          )
                                                            return 'Chat Agent';
                                                          if (catLower === 'tabgroup' || catLower === 'Tab Session')
                                                            return 'Tab Session';
                                                          if (catLower === 'note') return 'Note';
                                                          if (catLower === 'snippet') return 'Snippet';
                                                          if (catLower === 'link') return 'Link';
                                                          if (catLower === 'automation') return 'Automation';
                                                          return catLower.charAt(0).toUpperCase() + catLower.slice(1);
                                                        })()}
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })
                                          )}
                                        </div>
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>,
                            portalTarget || document.body,
                          )}
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
                      <button
                        id="final-save-button"
                        type="button"
                        onClick={handleCreate}
                        onMouseEnter={e => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltipPos({
                            top: rect.top + window.scrollY - 76,
                            left: rect.right - 320,
                          });
                          setShowTooltip(true);
                        }}
                        onMouseLeave={() => setShowTooltip(false)}
                        disabled={explicitSaveStatus === 'saving'}
                        className={`px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 font-semibold text-xs ${
                          explicitSaveStatus === 'saving'
                            ? 'bg-white/[0.03] border-white/[0.05] text-white/60 opacity-70 cursor-not-allowed'
                            : 'bg-black/10 dark:bg-white/10 hover:bg-black/15 dark:hover:bg-white/15 text-neutral-800 dark:text-neutral-200 border-black/10 dark:border-white/10 cursor-pointer'
                        }`}>
                        {explicitSaveStatus === 'saving' ? (
                          <>
                            <svg
                              className="animate-spin"
                              width={13}
                              height={13}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2.5}>
                              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                              <path d="M12 2a10 10 0 0 1 10 10" />
                            </svg>
                            <span>Creating…</span>
                          </>
                        ) : (
                          <span>Create another</span>
                        )}
                      </button>

                      {showTooltip &&
                        ReactDOM.createPortal(
                          <div
                            style={{
                              position: 'absolute',
                              top: `${tooltipPos.top}px`,
                              left: `${tooltipPos.left}px`,
                            }}
                            className="bg-[#1c1d27] border border-[#2f3142] rounded-xl p-3 shadow-[0_10px_40px_rgba(0,0,0,0.6)] z-[999999] flex flex-col gap-2.5 min-w-[320px] text-[12px] font-sans text-white pointer-events-none">
                            <div className="flex items-center gap-3 text-neutral-300">
                              <div className="flex gap-1 min-w-[125px] shrink-0">
                                <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">
                                  {isMac ? 'Cmd' : 'Ctrl'}
                                </kbd>
                                <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">
                                  Enter
                                </kbd>
                              </div>
                              <span className="text-neutral-400 text-left whitespace-nowrap">to save task</span>
                            </div>
                            <div className="flex items-center gap-3 text-neutral-300">
                              <div className="flex gap-1 min-w-[125px] shrink-0">
                                <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">
                                  {isMac ? 'Cmd' : 'Ctrl'}
                                </kbd>
                                <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-300">
                                  Shift
                                </kbd>
                                <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-bold font-mono text-neutral-200">
                                  Enter
                                </kbd>
                              </div>
                              <span className="text-neutral-400 text-left whitespace-nowrap">
                                to save and create another
                              </span>
                            </div>
                          </div>,
                          portalTarget || document.body,
                        )}
                    </div>
                  </div>
                  {descriptionError && (
                    <span className="text-xs text-red-500 font-medium px-2 block w-full text-left mt-1.5">
                      Enter a description
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </WorkspaceEditorLayout>
      <button id="trigger-save-internal" type="button" onClick={handleCreate} className="hidden" />
    </>
  );
};

export default CreateTodoView;
