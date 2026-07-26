import React, { useState, useEffect, useRef } from 'react';
import { FaStar, FaFolder, FaKeyboard, FaTag } from 'react-icons/fa';
import { FiStar, FiChevronRight, FiBookmark, FiExternalLink, FiSearch } from 'react-icons/fi';
import { saveUserHotkey, deleteUserHotkeyByReference } from '../hotkeys/core/hotkeyDbData';
import { buildHotkeyString } from '../hotkeys/core/eventParser';
import { useShortcutValidation } from '../shortcuts/hooks/useShortcutValidation';

export interface ExistingItem {
  id: string;
  [key: string]: any;
}

export interface ExistingItemsTableProps<T extends ExistingItem> {
  items: T[];
  activeItemId: string | null;
  onLoadItem: (id: string) => void;
  getItemTitle: (item: T) => string;
  getItemPreview: (item: T) => string;
  getItemCompoundId: (item: T) => string;
  getItemType: (item: T) => string;
  shortcutsMap: Record<string, string>;
  hotkeysMap: Record<string, string>;
  isFavorite: (compoundId: string) => boolean;
  toggleFavorite: (compoundId: string, type: string, title: string) => Promise<void>;
  onDeleteClick: (id: string) => void;
  onFavoriteToggled?: () => void;
  emptyStateMessage?: string;
  isFullScreenMode?: boolean;
  title?: string;
  onUpdateItemField?: (id: string, field: 'title' | 'shortcut' | 'tags', value: string) => Promise<void>;
  folderNamesMap?: Record<string, string>;
  workspaceNamesMap?: Record<string, string>;
  tagNamesMap?: Record<string, string>;
  onCollapseStateChange?: (isCollapsed: boolean) => void;
  searchQuery?: string;
  setSearchQuery?: (val: string) => void;
  searchPlaceholder?: string;
}

export function ExistingItemsTable<T extends ExistingItem>({
  items,
  activeItemId,
  onLoadItem,
  getItemTitle,
  getItemPreview,
  getItemCompoundId,
  getItemType,
  shortcutsMap,
  hotkeysMap,
  isFavorite,
  toggleFavorite,
  onDeleteClick,
  onFavoriteToggled,
  emptyStateMessage = 'No items found.',
  isFullScreenMode = false,
  title = 'Existing Items',
  onUpdateItemField,
  folderNamesMap,
  workspaceNamesMap,
  tagNamesMap,
  onCollapseStateChange,
  searchQuery,
  setSearchQuery,
  searchPlaceholder = 'Search...',
}: ExistingItemsTableProps<T>) {
  const [editingCell, setEditingCell] = useState<{ itemId: string; field: 'title' | 'shortcut' } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isAllExpanded, setIsAllExpanded] = useState(false);
  const [recordingHotkeyId, setRecordingHotkeyId] = useState<string | null>(null);
  const [recordingCombo, setRecordingCombo] = useState<string>('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [tagEditValue, setTagEditValue] = useState<string>('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  const { validateShortcut } = useShortcutValidation();

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === 'F' || e.key === 'f')) {
        const target = e.target as HTMLElement | null;
        const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
        if (isInput && target !== searchInputRef.current) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        setIsPinned(true);
        setIsHovered(true);

        setTimeout(() => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
            searchInputRef.current.select();
          }
        }, 30);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, []);

  const handleSaveEdit = async (itemId: string, field: 'title' | 'shortcut') => {
    console.log(`[ExistingItemsTable] handleSaveEdit for item "${itemId}", field "${field}", value "${editValue}"`);
    if (field === 'shortcut') {
      const item = items.find(i => i.id === itemId);
      const compound = item ? getItemCompoundId(item) : itemId;
      if (shortcutsMap && shortcutsMap[compound] === editValue) {
        console.log('[ExistingItemsTable] Shortcut unchanged, canceling inline edit.');
        setEditingCell(null);
        return;
      }
      const res = await validateShortcut(editValue, itemId);
      if (!res.isValid) {
        console.warn(`[ExistingItemsTable] Shortcut validation failed for inline edit on "${itemId}": ${res.errorMessage}`);
        setEditingCell(null); // Unmount input immediately to prevent infinite onBlur cycles
        alert(res.errorMessage || 'This shortcut is invalid or already taken.');
        return;
      }
    }
    if (onUpdateItemField) {
      console.log(`[ExistingItemsTable] Updating field "${field}" for item "${itemId}"...`);
      await onUpdateItemField(itemId, field, editValue);
    }
    setEditingCell(null);
  };

  const handleSaveTagsEdit = async (itemId: string) => {
    if (onUpdateItemField) {
      await onUpdateItemField(itemId, 'tags', tagEditValue);
    }
    setEditingTagId(null);
  };

  const handleOpenerClick = async (item: T) => {
    const type = getItemType(item).toLowerCase();
    const chromeAny = (window as any)?.chrome;

    if (type === 'link' || type === 'session') {
      const urls: string[] = [];
      if (Array.isArray(item.urls)) {
        item.urls.forEach((u: any) => {
          const urlStr = typeof u === 'string' ? u : u?.url || '';
          if (urlStr) urls.push(urlStr);
        });
      }
      if (urls.length > 0) {
        urls.forEach((url, idx) => {
          const cleanUrl = url.startsWith('//') ? `https:${url}` : url;
          if (chromeAny?.tabs?.create) {
            chromeAny.tabs.create({ url: cleanUrl, active: idx === 0 });
          } else {
            window.open(cleanUrl, '_blank', 'noopener');
          }
        });
      }
    } else if (type === 'aiprompt' || type === 'prompt' || type === 'ai_prompt') {
      const promptText = item.prompt || '';
      const modelUrls = item.modelUrls || {};
      const modelIds = Object.keys(modelUrls);
      if (modelIds.length > 0 && promptText.trim()) {
        const tabIds: number[] = [];
        const trackingModels: string[] = [];
        for (const mId of modelIds) {
          const targetUrl = modelUrls[mId] || (mId.includes('gpt') ? 'https://chatgpt.com' : mId.includes('claude') ? 'https://claude.ai/new' : mId.includes('gemini') ? 'https://gemini.google.com/app' : 'https://www.perplexity.ai');
          let kind = 'chatgpt';
          if (mId.includes('claude')) kind = 'claude';
          else if (mId.includes('gemini')) kind = 'gemini';
          else if (mId.includes('perplexity')) kind = 'perplexity';

          try {
            const response = await new Promise<any>((resolve, reject) => {
              if (chromeAny?.runtime?.sendMessage) {
                chromeAny.runtime.sendMessage(
                  {
                    action: 'open_tab_with_auto_submit',
                    url: targetUrl,
                    autoSubmit: { kind, prompt: promptText },
                    forceNewTab: true,
                    active: true,
                  },
                  (res: any) => {
                    if (chromeAny.runtime.lastError) reject(chromeAny.runtime.lastError);
                    else resolve(res);
                  }
                );
              } else {
                window.open(targetUrl, '_blank');
                resolve(null);
              }
            });
            if (response?.tabId) {
              tabIds.push(response.tabId);
              trackingModels.push(mId);
            }
          } catch (e) {
            console.error('Error opening model tab:', e);
          }
        }
        if (tabIds.length > 0 && chromeAny?.runtime?.sendMessage) {
          chromeAny.runtime.sendMessage({
            action: 'track_ai_session',
            prompt: promptText,
            tabIds,
            models: trackingModels,
            aiPromptId: item.id
          });
        }
      }
    } else if (type === 'note') {
      const baseUrl = chromeAny?.runtime?.getURL ? chromeAny.runtime.getURL('AltS_search_newtab/index.html') : '/AltS_search_newtab/index.html';
      const url = `${baseUrl}?open_note=true&noteid=${encodeURIComponent(item.id)}`;
      if (chromeAny?.tabs?.create) {
        chromeAny.tabs.create({ url, active: true });
      } else {
        window.open(url, '_blank', 'noopener');
      }
    } else {
      const baseUrl = chromeAny?.runtime?.getURL ? chromeAny.runtime.getURL('AltS_search_newtab/index.html') : '/AltS_search_newtab/index.html';
      const url = new URL(baseUrl);
      url.searchParams.set('alts_action', 'true');
      url.searchParams.set('type', type);
      url.searchParams.set('entityId', item.id);
      url.searchParams.set('edit_mode', 'true');

      let editorPropsObj: any = null;
      if (type === 'snippet') {
        const mergedSnippet = {
          ...item,
          category: 'snippet',
        };
        editorPropsObj = { props: { item: mergedSnippet, snippet: mergedSnippet, category: 'snippet' } };
      } else if (type === 'todo') {
        const prefill = {
          ...item,
          todo_id: item.id,
          is_todo_type: true,
        };
        editorPropsObj = { props: { prefill, item: prefill, snippet: prefill } };
      }

      if (editorPropsObj) {
        url.searchParams.set('editorProps', JSON.stringify(editorPropsObj));
      }

      const finalUrl = url.toString();
      if (chromeAny?.tabs?.create) {
        chromeAny.tabs.create({ url: finalUrl, active: true });
      } else {
        window.open(finalUrl, '_blank', 'noopener');
      }
    }
  };

  const isTodoType = items && items.length > 0 && getItemType(items[0]) === 'todo';
  const actionsColWidth = isTodoType ? '260px' : '330px';

  const itemType = items && items.length > 0 ? getItemType(items[0]) : '';
  const cardTitle = {
    'aiPrompt': 'Saved prompts',
    'todo': 'Saved todos',
    'snippet': 'Saved snippets',
    'link': 'Saved links',
    'session': 'Saved sessions'
  }[itemType] || 'Saved items';

  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const ignoreHoverRef = React.useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isHoverExpanded = isHovered || isFocused || isPinned;

  // State-based coordinate tracking to handle layout shifts without arbitrary timeouts
  useEffect(() => {
    if (!isHoverExpanded || isFocused) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      // Ignore phantom mouse events triggered purely by layout shifting under the stationary mouse
      if (e.movementX === 0 && e.movementY === 0) return;
      
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const buffer = 40; // 40px tolerance buffer
        const isInside = (
          e.clientX >= rect.left - buffer &&
          e.clientX <= rect.right + buffer &&
          e.clientY >= rect.top - buffer &&
          e.clientY <= rect.bottom + buffer
        );
        
        if (!isInside && !ignoreHoverRef.current) {
          setIsHovered(false);
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [isHoverExpanded, isFocused]);

  // Auto-expand if the items change (e.g. new item created, or existing item modified)
  const itemsSignature = items ? items.map(item => `${getItemCompoundId(item)}|${getItemTitle(item)}|${getItemPreview(item)}`).join('||') : '';
  const initialMount = useRef(true);
  
  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }
    setIsPinned(true);
  }, [itemsSignature]);

  useEffect(() => {
    onCollapseStateChange?.(!isHoverExpanded);
  }, [isHoverExpanded, onCollapseStateChange]);

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => {
        if (ignoreHoverRef.current) return;
        setIsHovered(true);
      }}
      onFocus={() => setIsFocused(true)}
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) {
          setIsFocused(false);
          setIsHovered(false);
        }
      }}
      className={`relative overflow-hidden px-6 pt-1 ${isMounted ? 'transition-all duration-300' : ''} ${isHoverExpanded ? 'h-full min-h-0 flex-1 flex flex-col pb-4' : 'h-auto shrink-0 flex-none pb-2'}`}
    >
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes rowFlash {
          0% { background-color: rgba(59, 130, 246, 0.3) !important; }
          100% { background-color: transparent; }
        }
        .animate-new-row {
          animation: rowFlash 2.5s ease-out forwards;
        }
      `}} />

      {/* Shared Fixed Top Control Slot (Swaps Pill Button & Search Bar at exact position without layout shift) */}
      <div className="w-[25%] h-[38px] shrink-0 relative mb-3">
        {!isHoverExpanded ? (
          <div
            onClick={() => {
              setIsHovered(true);
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            className="w-full h-full flex items-center justify-between px-4 py-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 cursor-pointer transition-all hover:bg-black/10 dark:hover:bg-white/10"
          >
            <div className="flex items-center gap-2.5">
              <FiSearch className="text-neutral-500" size={15} />
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 tracking-tight">
                {title || cardTitle}
              </span>
              <span className="text-[10px] font-bold text-neutral-500 bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded-full">
                {items.length}
              </span>
            </div>
            <FiChevronRight className="text-neutral-500" size={15} />
          </div>
        ) : (
          setSearchQuery && (
            <div className="w-full h-full relative" onClick={() => { searchInputRef.current?.focus(); }}>
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={13} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery || ''}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-full pl-8 pr-4 rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 text-neutral-800 dark:text-neutral-200 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors placeholder-neutral-400 dark:placeholder-neutral-500"
              />
            </div>
          )
        )}
      </div>

      {/* Expanded Table View */}
      <div
        className={`relative flex flex-col origin-top ${isMounted ? 'transition-all duration-300 ease-out' : ''} ${isHoverExpanded ? 'flex-1 min-h-0 opacity-100 scale-y-100' : 'h-0 opacity-0 scale-y-0 overflow-hidden'}`}
      >
        <div className="flex-1 min-h-0 relative">
          <div className="absolute inset-0 overflow-y-auto custom-scrollbar">
            <table className="w-full text-sm text-left text-neutral-500 dark:text-neutral-400" style={{ tableLayout: 'fixed' }}>
              <thead
                className="text-xs text-neutral-700 dark:text-neutral-300 font-medium cursor-pointer transition-colors"
                onClick={() => {
                  ignoreHoverRef.current = true;
                  setIsPinned(false);
                  setIsHovered(false);
                }}
                title="Click to collapse"
              >
                <tr>
                  <th scope="col" className="px-6 py-2.5 sticky top-0 z-10 border-b border-black/5 dark:border-white/10 font-semibold text-neutral-700 dark:text-neutral-300 tracking-tight bg-black/5 dark:bg-white/5 backdrop-blur-md rounded-tl-lg" style={{ width: '180px' }}>Command short</th>
                  <th scope="col" className="px-6 py-2.5 sticky top-0 z-10 border-b border-black/5 dark:border-white/10 font-semibold text-neutral-700 dark:text-neutral-300 tracking-tight bg-black/5 dark:bg-white/5 backdrop-blur-md" style={{ width: '220px' }}>Title</th>
                  <th scope="col" className="px-6 py-2.5 sticky top-0 z-10 border-b border-black/5 dark:border-white/10 font-semibold text-neutral-700 dark:text-neutral-300 tracking-tight bg-black/5 dark:bg-white/5 backdrop-blur-md">Content</th>
                  <th scope="col" className="px-6 py-2.5 sticky top-0 z-10 border-b border-black/5 dark:border-white/10 font-semibold text-neutral-700 dark:text-neutral-300 tracking-tight text-center bg-black/5 dark:bg-white/5 backdrop-blur-md rounded-tr-lg" style={{ width: actionsColWidth, transition: 'width 0.2s' }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/10">
                {items && items.map((item) => {
                  const compoundId = getItemCompoundId(item);
                  const sc = shortcutsMap[compoundId] || shortcutsMap[item.id] || (Object.keys(shortcutsMap || {}).length > 0 ? '' : (item.shortcut || ''));
                  const itemTitle = getItemTitle(item);
                  const itemType = getItemType(item);
                  const plainText = getItemPreview(item);
                  const isCurrent = item.id === activeItemId;
                  const isNew = Date.now() - (item.createdAt || 0) < 4000;

                  const isExpanded = true;
                  const wsName = item.workspaceId ? (workspaceNamesMap?.[item.workspaceId] || '') : '';
                  const folderName = item.folderId ? (folderNamesMap?.[item.folderId] || '') : '';
                  const folderDisplayName = folderName || wsName;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => onLoadItem(item.id)}
                      className={`cursor-pointer transition-colors ${isNew ? 'animate-new-row' : ''} ${isCurrent ? 'bg-black/15 dark:bg-white/15 font-medium text-neutral-800 dark:text-neutral-200' : 'bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-neutral-600 dark:text-neutral-400'}`}
                    >
                      <td
                        className="pl-6 pr-4 py-2"
                        style={{ width: '180px' }}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingCell({ itemId: item.id, field: 'shortcut' });
                          setEditValue(sc);
                        }}
                      >
                        {editingCell?.itemId === item.id && editingCell?.field === 'shortcut' ? (
                          <div className="flex items-center justify-between w-full" onClick={(e) => e.stopPropagation()}>
                            <input
                              autoFocus
                              type="text"
                              value={editValue}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                                setEditValue(val);
                              }}
                              onBlur={() => handleSaveEdit(item.id, 'shortcut')}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveEdit(item.id, 'shortcut');
                                } else if (e.key === 'Escape') {
                                  setEditingCell(null);
                                }
                              }}
                              className="px-2 py-0.5 w-[75px] rounded border border-blue-500 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-between w-full">
                            {sc ? (
                              <>
                                <span className="px-3 py-1 rounded-lg border border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-400 bg-transparent text-xs font-medium block truncate max-w-[100px] text-center shrink-0" title={`c ${sc}`}>
                                  c {sc}
                                </span>
                                <svg width="24" height="10" viewBox="0 0 24 10" fill="none" className="text-neutral-400 opacity-35 shrink-0">
                                  <path d="M0 5H22M22 5L18 1M22 5L18 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td
                        className="px-6 py-2 font-medium text-neutral-700 dark:text-neutral-300 truncate"
                        style={{ width: '220px' }}
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingCell({ itemId: item.id, field: 'title' });
                          setEditValue(itemTitle);
                        }}
                      >
                        {editingCell?.itemId === item.id && editingCell?.field === 'title' ? (
                          <input
                            autoFocus
                            type="text"
                            value={editValue}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => handleSaveEdit(item.id, 'title')}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveEdit(item.id, 'title');
                              } else if (e.key === 'Escape') {
                                setEditingCell(null);
                              }
                            }}
                            className="px-2 py-1 w-full rounded border border-blue-500 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-sm font-medium outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        ) : (
                          <div className="flex items-center gap-2 group/title">
                            <span className="truncate">{itemTitle || '—'}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenerClick(item);
                              }}
                              className="text-neutral-400 dark:text-neutral-500 hover:text-blue-500 opacity-0 group-hover/title:opacity-100 transition-opacity p-0.5 shrink-0 flex items-center justify-center"
                              title="Open in new tab"
                            >
                              <FiExternalLink size={12} />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-2 truncate text-neutral-600 dark:text-neutral-400">
                        {plainText || '—'}
                      </td>
                      <td className="px-4 py-2" style={{ width: actionsColWidth, transition: 'width 0.2s' }} onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2 w-full">
                          {isExpanded && (
                            <div className="flex items-center gap-2 mr-2 shrink-0">
                              {/* Hotkey Info Slot */}
                              <div className="w-[72px] shrink-0 flex items-center justify-start gap-1">
                                {recordingHotkeyId === item.id ? (
                                  <input
                                    autoFocus
                                    type="text"
                                    placeholder="Press keys..."
                                    value={recordingCombo}
                                    readOnly
                                    onKeyDown={async (e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (e.key === 'Escape') {
                                        setRecordingHotkeyId(null);
                                        setRecordingCombo('');
                                        return;
                                      }
                                      if (e.key === 'Backspace' || e.key === 'Delete') {
                                        await deleteUserHotkeyByReference(compoundId);
                                        setRecordingHotkeyId(null);
                                        setRecordingCombo('');
                                        return;
                                      }
                                      if (e.key === 'Enter') {
                                        if (recordingCombo && recordingCombo !== 'Press keys...') {
                                          await saveUserHotkey(recordingCombo, compoundId, 'snippet');
                                        } else {
                                          await deleteUserHotkeyByReference(compoundId);
                                        }
                                        setRecordingHotkeyId(null);
                                        setRecordingCombo('');
                                        return;
                                      }
                                      const combo = buildHotkeyString(e.nativeEvent, isMac);
                                      if (combo) {
                                        setRecordingCombo(combo);
                                      }
                                    }}
                                    onBlur={async () => {
                                      if (recordingCombo && recordingCombo !== 'Press keys...') {
                                        await saveUserHotkey(recordingCombo, compoundId, 'snippet');
                                      }
                                      setRecordingHotkeyId(null);
                                      setRecordingCombo('');
                                    }}
                                    className="px-1 py-0.5 w-full rounded border border-blue-500 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                ) : (
                                  (() => {
                                    const hotkeyCombo = hotkeysMap[compoundId] || '';
                                    return hotkeyCombo ? (
                                      <div
                                        onDoubleClick={(e) => {
                                          e.stopPropagation();
                                          setRecordingHotkeyId(item.id);
                                          setRecordingCombo(hotkeyCombo);
                                        }}
                                        className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400 text-xs shrink-0 cursor-pointer select-none"
                                        title="Double click to edit hotkey"
                                      >
                                        <FaKeyboard size={16} className="text-neutral-400 hover:text-blue-500 shrink-0" />
                                        <span className="font-mono text-neutral-600 dark:text-neutral-400 truncate">{hotkeyCombo}</span>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setRecordingHotkeyId(item.id);
                                          setRecordingCombo('Press keys...');
                                        }}
                                        className="p-1 text-neutral-400 hover:text-blue-500 transition-colors shrink-0"
                                        title="Assign Hotkey"
                                      >
                                        <FaKeyboard size={16} />
                                      </button>
                                    );
                                  })()
                                )}
                              </div>

                              {/* Tag Info Slot */}
                              <div className="w-[80px] shrink-0 flex items-center justify-start gap-1">
                                {editingTagId === item.id ? (
                                  <input
                                    autoFocus
                                    type="text"
                                    placeholder="tag1, tag2..."
                                    value={tagEditValue}
                                    onChange={(e) => setTagEditValue(e.target.value)}
                                    onBlur={() => handleSaveTagsEdit(item.id)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleSaveTagsEdit(item.id);
                                      } else if (e.key === 'Escape') {
                                        setEditingTagId(null);
                                      }
                                    }}
                                    className="px-1 py-0.5 w-full rounded border border-blue-500 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                ) : (
                                  (() => {
                                    const todoTags = item.tagIds
                                      ? item.tagIds.map((tid: string) => tagNamesMap?.[tid] || '').filter(Boolean)
                                      : [];
                                    const tagText = todoTags.join(', ');
                                    return tagText ? (
                                      <div
                                        onDoubleClick={(e) => {
                                          e.stopPropagation();
                                          setEditingTagId(item.id);
                                          setTagEditValue(tagText);
                                        }}
                                        className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400 text-xs shrink-0 cursor-pointer select-none truncate max-w-[80px]"
                                        title={tagText ? `${tagText} (Double click to edit)` : "Double click to edit tags"}
                                      >
                                        <FaTag size={16} className="text-neutral-400 hover:text-blue-500 shrink-0" />
                                        <span className="text-neutral-600 dark:text-neutral-400 truncate">{tagText}</span>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingTagId(item.id);
                                          setTagEditValue('');
                                        }}
                                        className="p-1 text-neutral-400 hover:text-blue-500 transition-colors shrink-0"
                                        title="Add Tags"
                                      >
                                        <FaTag size={16} />
                                      </button>
                                    );
                                  })()
                                )}
                              </div>

                              {/* Folder Info Slot — only for non-todo types */}
                              {!isTodoType && (
                                <div className="w-[72px] shrink-0 flex items-center justify-start gap-1">
                                  {folderDisplayName ? (
                                    <div className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400 text-xs max-w-[72px] truncate shrink-0" title={folderDisplayName}>
                                      <FaFolder size={16} className="text-neutral-400 shrink-0" />
                                      <span className="text-neutral-600 dark:text-neutral-400 truncate">{folderDisplayName}</span>
                                    </div>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-1 shrink-0 ml-auto">
                            <button
                              onClick={async () => {
                                await toggleFavorite(compoundId, itemType, itemTitle);
                                if (onFavoriteToggled) onFavoriteToggled();
                              }}
                              className="p-1 text-neutral-400 hover:text-yellow-500 transition-colors"
                            >
                              {isFavorite(compoundId) ? (
                                <FaStar className="text-yellow-500" size={16} />
                              ) : (
                                <FiStar size={16} />
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteClick(item.id);
                              }}
                              className="p-1 text-neutral-400 hover:text-red-500 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-neutral-500">
                      {emptyStateMessage}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
