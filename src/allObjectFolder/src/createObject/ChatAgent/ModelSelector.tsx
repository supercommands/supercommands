/**
 * @file ModelSelector.tsx
 * @description React UI component allowing selection and editing of different
 * AI models (e.g. Gemini, ChatGPT, Claude, Perplexity) or custom URL configurations.
 * 
 * @usage
 * ```tsx
 * import ModelSelector from './ModelSelector';
 * <ModelSelector state={searchState} />
 * ```
 */

import type * as React from 'react';

import { useAppearance } from '@extension/ui';
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FaCheck, FaTimes, FaPencilAlt, FaPlus } from 'react-icons/fa';
import { useDispatch } from 'react-redux';
import { getFaviconUrl, stripCmdStatus } from '../../../../shared-components/searchBarMain/utilityFunctions/utils';
import { useUIStore } from '../../../../shared-components/uiStateManager';
import useNotification from '../../../../shared-components/notifications/useNotification';
import type { SuggestionState } from '../../../../shared-components/searchBarMain/userInterfaceComponents/searchBar';

interface ModelSelectorProps {
  state: SuggestionState;
  isMac?: boolean;
  savedAgents?: any[];
  onSaveAgent?: () => void;
  compact?: boolean;
}

const DEFAULT_ALL_AI_URLS: Record<string, string> = {
  gemini: 'https://gemini.google.com/app',
  gpt: 'https://chatgpt.com',
  claude: 'https://claude.ai/new',
  perplexity: 'https://www.perplexity.ai',
};

const ModelSelector: React.FC<ModelSelectorProps> = ({
  state,
  isMac = false,
  savedAgents = [],
  onSaveAgent,
  compact = false,
}) => {
  const { selectedAIs = [], onToggleAI, activeAiSession, updateActiveSessionMetadata, modelWarning } = state as any;

  const triggerNotification = useNotification();
  const { theme } = useAppearance();
  const isDark = theme.isDark;

  const [isModelPrefsLoaded, setIsModelPrefsLoaded] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editingUrl, setEditingUrl] = useState('');

  const [logs, setLogs] = useState<any[]>([]);
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [newModelName, setNewModelName] = useState('');
  const [newModelUrl, setNewModelUrl] = useState('');

  // Custom models derived from session
  const customModels = activeAiSession?.customModelDefinitions || [];
  const selectedCustomAIs = selectedAIs.filter((id: string) => id.startsWith('custom-'));

  const [editingCustomId, setEditingCustomId] = useState<string | null>(null);
  const [editingCustomName, setEditingCustomName] = useState('');
  const [editingCustomUrl, setEditingCustomUrl] = useState('');
  const [customUrls, setCustomUrls] = useState<Record<string, string>>({});

  // Load logs logic moved from AICommandLockedUI
  useEffect(() => {
    const sessionKey = activeAiSession?.sessionKey;
    const sessionPrompt = activeAiSession?.prompt;
    if (!sessionKey) {
      setLogs([]);
      return;
    }
    const storageKey = `ai_logs_${sessionKey}`;

    const loadLogs = (attempt = 0) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([storageKey], result => {
          const saved = result[storageKey];
          if (saved) {
            try {
              const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
              setLogs(parsed);
            } catch (e) {
              console.error('Failed to parse saved logs', e);
              setLogs([]);
            }
          } else if (attempt < 3) {
            setTimeout(() => loadLogs(attempt + 1), 80);
          } else if (sessionPrompt) {
            const seedLog = { id: `log-seed-${Date.now()}`, prompt: sessionPrompt.trim(), timestamp: Date.now() };
            chrome.storage.local.set({ [storageKey]: [seedLog] });
            setLogs([seedLog]);
          } else {
            setLogs([]);
          }
        });
      } else {
        setLogs([]);
      }
    };

    loadLogs();

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
        if (areaName === 'local' && changes[storageKey]) {
          const newValue = changes[storageKey].newValue;
          if (newValue) {
            setLogs(typeof newValue === 'string' ? JSON.parse(newValue) : newValue);
          }
        }
      };
      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }
    return () => {};
  }, [activeAiSession?.sessionKey, activeAiSession?.prompt]);

  const models = [
    { id: 'gpt', name: 'ChatGPT', host: 'chatgpt.com' },
    { id: 'claude', name: 'Claude', host: 'claude.ai' },
    { id: 'gemini', name: 'Gemini', host: 'gemini.google.com' },
    { id: 'perplexity', name: 'Perplexity', host: 'perplexity.ai' },
  ];

  // Custom models are now managed via activeAiSession so we don't load/save them from chrome.storage here.

  // Load custom model URLs from local storage on mount
  useEffect(() => {
    const loadPreferences = () => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['ai_custom_model_urls'], result => {
            if (result['ai_custom_model_urls']) {
              setCustomUrls(result['ai_custom_model_urls']);
            }
            setIsModelPrefsLoaded(true);
          });
        } else {
          setIsModelPrefsLoaded(true);
        }
      } catch (e) {
        console.error('Failed to load preferences', e);
        setIsModelPrefsLoaded(true);
      }
    };
    loadPreferences();
  }, []);

  return (
    <div className={compact ? 'w-full flex flex-col h-auto relative shadow-2xl' : 'w-full flex flex-col h-full relative shadow-2xl'}>
      <div className={compact ? 'flex flex-col items-stretch min-h-0 w-full relative z-10 p-0' : 'flex-1 flex flex-col justify-center items-center min-h-0 w-full relative z-10 pb-[50px] px-0.5 transition-all duration-300'}>
        <div
          className="w-full border border-[var(--color-borderDefault)] bg-[var(--color-popupBg)] backdrop-blur-md rounded-[5px] overflow-hidden shadow-2xl group/models">
          <div
            className="py-1 border-b border-[var(--color-borderDefault)] bg-[var(--color-innerPopupBg)] px-1">
            <h3
              className="text-[11px] font-black tracking-[0.2em] text-left text-[var(--color-textMuted)]">
              Select models
            </h3>
          </div>
          {modelWarning && (
            <div className="bg-red-500/10 border-b border-red-500/20 px-2 py-1.5 text-[9px] font-bold text-[var(--color-textPrimary)] text-center flex items-center justify-center gap-1">
              <span>⚠️</span> <span>{modelWarning}</span>
            </div>
          )}
          <div className="overflow-y-auto no-scrollbar max-h-[380px] w-full flex flex-col items-stretch">
            {models.map(model => {
              const isActive = selectedAIs.includes(model.id);
              const sessionIndex = activeAiSession?.models.indexOf(model.id) ?? -1;
              const modelUrl = sessionIndex !== -1 ? activeAiSession?.urls[sessionIndex] : null;

              return (
                <div key={model.id} className="flex flex-col last:border-b-0">
                  <motion.button
                    whileHover={{ backgroundColor: 'var(--color-hoverBg)' }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => onToggleAI?.(model.id)}
                    className={`group/modelitem grid grid-cols-[20px_1fr_20px] items-center py-1 px-0.5 transition-all duration-300 w-full ${
                      isActive ? 'bg-[var(--color-selectedBg)]' : ''
                    } cursor-pointer`}>
                    <div className="flex items-center justify-center">
                      <img
                        src={getFaviconUrl(model.host)}
                        alt={model.name}
                        className={`w-3.5 h-3.5 object-contain transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}
                      />
                    </div>

                    <div className="flex flex-col items-start pl-2 pr-1 min-w-0 py-0.5">
                      <div className="flex items-center gap-1.5 w-full">
                        <span
                          className={`text-[10px] font-bold transition-all duration-300 truncate ${
                            isActive
                              ? 'text-[var(--color-textPrimary)]'
                              : 'text-[var(--color-textSecondary)] group-hover:text-[var(--color-textPrimary)]'
                          }`}>
                          {model.name}
                        </span>
                        {!editingModelId && (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setEditingModelId(model.id);
                              setEditingUrl(stripCmdStatus(modelUrl || model.host));
                            }}
                            className="p-1 rounded opacity-0 group-hover/modelitem:opacity-100 transition-all hover:bg-[var(--color-hoverBg)] text-[var(--color-textMuted)]">
                            <FaPencilAlt size={8} />
                          </button>
                        )}
                      </div>
                      {editingModelId === model.id ? (
                        <textarea
                          autoFocus
                          value={editingUrl}
                          onFocus={e => {
                            const val = e.target.value;
                            e.target.value = '';
                            e.target.value = val;
                            e.target.style.height = 'auto';
                            const lineHeight = 10;
                            const maxHeight = lineHeight * 6;
                            e.target.style.height = `${Math.min(e.target.scrollHeight, maxHeight)}px`;
                            e.target.scrollTop = e.target.scrollHeight;
                          }}
                          onChange={e => {
                            setEditingUrl(e.target.value);
                            e.target.style.height = 'auto';
                            const lineHeight = 10;
                            const maxHeight = lineHeight * 6;
                            e.target.style.height = `${Math.min(e.target.scrollHeight, maxHeight)}px`;
                          }}
                          onBlur={() => {
                            if (editingUrl.trim()) {
                              const allowedHosts = [
                                'chatgpt.com',
                                'openai.com',
                                'claude.ai',
                                'gemini.google.com',
                                'perplexity.ai',
                              ];
                              const testUrl = editingUrl.trim().toLowerCase();
                              const isAllowed = allowedHosts.some(host => testUrl.includes(host));

                              if (!isAllowed) {
                                triggerNotification(
                                  'Only URLs belonging to ChatGPT, Claude, Gemini, or Perplexity are accepted!',
                                  'warning',
                                );
                                setEditingModelId(null);
                                return;
                              }

                              state.onUpdateModelUrl?.(model.id, editingUrl.trim());
                              setCustomUrls(prev => ({ ...prev, [model.id]: editingUrl.trim() }));
                            }
                            setEditingModelId(null);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              e.stopPropagation();
                              e.currentTarget.blur();
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditingModelId(null);
                            }
                          }}
                          onClick={e => e.stopPropagation()}
                          style={{
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none',
                            lineHeight: '10px',
                            minHeight: '20px',
                          }}
                          className="text-[8px] leading-[10px] w-full mt-0.5 bg-[var(--color-inputBg)] border border-solid border-[var(--color-borderDefault)] text-[var(--color-textPrimary)] rounded p-1 outline-none resize-none overflow-y-auto no-scrollbar shadow-inner transition-all"
                        />
                      ) : (
                        <div className="flex items-center gap-1 w-full group/urlwrap">
                          <span
                            className="text-[8px] font-medium block break-all flex-1 mt-0.5 text-left text-[var(--color-textMuted)]">
                            {stripCmdStatus(isActive && modelUrl ? modelUrl : customUrls[model.id] || model.host)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-center relative transition-all">
                      <div
                        className={`w-3.5 h-3.5 rounded-[4px] transition-all duration-300 flex items-center justify-center flex-shrink-0 ${
                          isActive
                            ? 'bg-[var(--color-accent)] text-white'
                            : 'border border-[var(--color-borderDefault)] group-hover:border-[var(--color-borderActive)]'
                        }`}>
                        {isActive && <FaCheck size={6} className="text-white" />}
                      </div>
                    </div>
                  </motion.button>
                </div>
              );
            })}
            {customModels.length > 0 && (
              <div className="border-t my-1 border-[var(--color-borderDefault)]" />
            )}
            {customModels.map((custom: any) => {
              const isActive = selectedCustomAIs.includes(custom.id);
              const isEditing = editingCustomId === custom.id;

              return (
                <div key={custom.id} className="flex flex-col last:border-b-0">
                  {isEditing ? (
                    <div
                      className="flex flex-col gap-1 p-1.5 transition-all border-[var(--color-borderDefault)]">
                      <input
                        type="text"
                        placeholder="Name (Required)"
                        value={editingCustomName}
                        onChange={e => setEditingCustomName(e.target.value)}
                        onBlur={e => {
                          const related = e.relatedTarget as any;
                          if (
                            related &&
                            (related.placeholder === 'Name (Required)' || related.placeholder === 'URL (Required)')
                          ) {
                            return;
                          }
                          if (!editingCustomName.trim() || !editingCustomUrl.trim()) {
                            setEditingCustomId(null);
                          }
                        }}
                        className="text-[8px] leading-[10px] p-1 bg-transparent border-b outline-none text-[var(--color-textPrimary)] border-[var(--color-borderDefault)]"
                      />
                      <textarea
                        autoFocus
                        value={editingCustomUrl}
                        onFocus={e => {
                          const val = e.target.value;
                          e.target.value = '';
                          e.target.value = val;
                          e.target.style.height = 'auto';
                          const lineHeight = 10;
                          const maxHeight = lineHeight * 6;
                          e.target.style.height = `${Math.min(e.target.scrollHeight, maxHeight)}px`;
                          e.target.scrollTop = e.target.scrollHeight;
                        }}
                        onChange={e => {
                          setEditingCustomUrl(e.target.value);
                          e.target.style.height = 'auto';
                          const lineHeight = 10;
                          const maxHeight = lineHeight * 6;
                          e.target.style.height = `${Math.min(e.target.scrollHeight, maxHeight)}px`;
                        }}
                        onBlur={e => {
                          const related = e.relatedTarget as any;
                          if (
                            related &&
                            (related.placeholder === 'Name (Required)' || related.placeholder === 'URL (Required)')
                          ) {
                            return;
                          }
                          if (!editingCustomName.trim() || !editingCustomUrl.trim()) {
                            setEditingCustomId(null);
                            return;
                          }

                          let host = editingCustomUrl.trim();
                          try {
                            const cleanUrl = editingCustomUrl.trim().startsWith('http')
                              ? editingCustomUrl.trim()
                              : `https://${editingCustomUrl.trim()}`;
                            const parsed = new URL(cleanUrl);
                            host = parsed.hostname || cleanUrl;
                          } catch (err) {}

                          const allowedHosts = [
                            'chatgpt.com',
                            'openai.com',
                            'claude.ai',
                            'gemini.google.com',
                            'perplexity.ai',
                          ];
                          const testUrl = editingCustomUrl.trim().toLowerCase();
                          const isAllowed = allowedHosts.some(host => testUrl.includes(host));

                          if (!isAllowed) {
                            triggerNotification(
                              'Only URLs belonging to ChatGPT, Claude, Gemini, or Perplexity are accepted!',
                              'warning',
                            );
                            setEditingCustomId(null);
                            return;
                          }

                          const updatedModels = customModels.map((m: any) =>
                            m.id === custom.id
                              ? { ...m, name: editingCustomName.trim(), url: editingCustomUrl.trim(), host }
                              : m,
                          );
                          state.onUpdateCustomModels?.(updatedModels);
                          setEditingCustomId(null);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            e.currentTarget.blur();
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            setEditingCustomId(null);
                          }
                        }}
                        style={{
                          scrollbarWidth: 'none',
                          msOverflowStyle: 'none',
                          lineHeight: '10px',
                          minHeight: '20px',
                        }}
                        className="text-[8px] leading-[10px] w-full mt-0.5 bg-[var(--color-inputBg)] border border-solid border-[var(--color-borderDefault)] text-[var(--color-textPrimary)] rounded p-1 outline-none resize-none overflow-y-auto no-scrollbar shadow-inner transition-all"
                      />
                    </div>
                  ) : (
                    <motion.button
                      whileHover={{ backgroundColor: 'var(--color-hoverBg)' }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => {
                        state.onToggleAI?.(custom.id);
                      }}
                      className={`group/modelitem grid grid-cols-[20px_1fr_20px] items-center py-1 px-0.5 transition-all duration-300 w-full ${
                        isActive ? 'bg-[var(--color-selectedBg)]' : ''
                      } cursor-pointer`}>
                      <div className="flex items-center justify-center">
                        <img
                          src={getFaviconUrl(custom.host)}
                          alt={custom.name}
                          className={`w-3.5 h-3.5 object-contain transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}
                        />
                      </div>
                      <div className="flex flex-col items-start pl-2 pr-1 min-w-0 py-0.5">
                        <div className="flex items-center gap-1.5 w-full">
                          <span
                            className={`text-[10px] font-bold truncate ${isActive ? 'text-[var(--color-textPrimary)]' : 'text-[var(--color-textSecondary)] group-hover:text-[var(--color-textPrimary)]'}`}>
                            {custom.name}
                          </span>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setEditingCustomId(custom.id);
                              setEditingCustomName(custom.name);
                              setEditingCustomUrl(custom.url);
                            }}
                            className="p-1 rounded opacity-0 group-hover/modelitem:opacity-100 transition-all hover:bg-[var(--color-hoverBg)] text-[var(--color-textMuted)]">
                            <FaPencilAlt size={8} />
                          </button>
                        </div>
                        <span
                          className="text-[8px] font-medium block break-all w-full mt-0.5 text-left text-[var(--color-textMuted)]">
                          {custom.url}
                        </span>
                      </div>
                      <div className="flex items-center justify-center relative transition-all">
                        <div
                          className={`w-3.5 h-3.5 rounded-[4px] transition-all duration-300 flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-[var(--color-accent)] text-white' : 'border border-[var(--color-borderDefault)] group-hover:border-[var(--color-borderActive)]'}`}>
                          {isActive && <FaCheck size={6} className="text-white" />}
                        </div>
                      </div>
                    </motion.button>
                  )}
                </div>
              );
            })}
            {isAddingModel ? (
              <div
                className="flex flex-col gap-1 p-1.5 border-t border-[var(--color-borderDefault)] transition-all">
                <input
                  type="text"
                  placeholder="Name (Required)"
                  value={newModelName}
                  onChange={e => setNewModelName(e.target.value)}
                  onBlur={e => {
                    const related = e.relatedTarget as any;
                    if (
                      related &&
                      (related.placeholder === 'Name (Required)' || related.placeholder === 'URL (Required)')
                    ) {
                      return;
                    }
                    if (!newModelName.trim() || !newModelUrl.trim()) {
                      setIsAddingModel(false);
                    }
                  }}
                  className="text-[8px] leading-[10px] p-1 bg-transparent border-b outline-none text-[var(--color-textPrimary)] border-[var(--color-borderDefault)]"
                />
                <textarea
                  autoFocus
                  placeholder="URL (Required)"
                  value={newModelUrl}
                  onFocus={e => {
                    const val = e.target.value;
                    e.target.value = '';
                    e.target.value = val;
                    e.target.style.height = 'auto';
                    const lineHeight = 10;
                    const maxHeight = lineHeight * 6;
                    e.target.style.height = `${Math.min(e.target.scrollHeight, maxHeight)}px`;
                    e.target.scrollTop = e.target.scrollHeight;
                  }}
                  onChange={e => {
                    setNewModelUrl(e.target.value);
                    e.target.style.height = 'auto';
                    const lineHeight = 10;
                    const maxHeight = lineHeight * 6;
                    e.target.style.height = `${Math.min(e.target.scrollHeight, maxHeight)}px`;
                  }}
                  onBlur={e => {
                    const related = e.relatedTarget as any;
                    if (
                      related &&
                      (related.placeholder === 'Name (Required)' || related.placeholder === 'URL (Required)')
                    ) {
                      return;
                    }

                    if (!newModelName.trim() || !newModelUrl.trim()) {
                      setIsAddingModel(false);
                      return;
                    }

                    const allowedHosts = [
                      'chatgpt.com',
                      'openai.com',
                      'claude.ai',
                      'gemini.google.com',
                      'perplexity.ai',
                    ];
                    const testUrl = newModelUrl.trim().toLowerCase();
                    const isAllowed = allowedHosts.some(host => testUrl.includes(host));

                    if (!isAllowed) {
                      triggerNotification(
                        'Only URLs belonging to ChatGPT, Claude, Gemini, or Perplexity are accepted!',
                        'warning',
                      );
                      setIsAddingModel(false);
                      setNewModelName('');
                      setNewModelUrl('');
                      return;
                    }

                    let host = newModelUrl.trim();
                    try {
                      const cleanUrl = newModelUrl.trim().startsWith('http')
                        ? newModelUrl.trim()
                        : `https://${newModelUrl.trim()}`;
                      const parsed = new URL(cleanUrl);
                      host = parsed.hostname || cleanUrl;
                    } catch (err) {}

                    const customId = `custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
                    const updatedModels = [
                      ...customModels,
                      { id: customId, name: newModelName.trim(), url: newModelUrl.trim(), host },
                    ];

                    state.onUpdateCustomModels?.(updatedModels);
                    state.onToggleAI?.(customId);

                    setIsAddingModel(false);
                    setNewModelName('');
                    setNewModelUrl('');
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      e.currentTarget.blur();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setIsAddingModel(false);
                      setNewModelName('');
                      setNewModelUrl('');
                    }
                  }}
                  style={{
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    lineHeight: '10px',
                    minHeight: '20px',
                  }}
                  className="text-[8px] leading-[10px] w-full mt-0.5 bg-[var(--color-inputBg)] border border-solid border-[var(--color-borderDefault)] text-[var(--color-textPrimary)] rounded p-1 outline-none resize-none overflow-y-auto no-scrollbar shadow-inner transition-all"
                />
              </div>
            ) : (
              <motion.button
                whileHover={{ backgroundColor: 'var(--color-hoverBg)' }}
                whileTap={{ scale: 0.99 }}
                onClick={e => {
                  e.stopPropagation();
                  setIsAddingModel(true);
                }}
                className="flex items-center justify-center py-2 px-1 transition-all duration-300 w-full border-t border-[var(--color-borderDefault)] cursor-pointer opacity-0 group-hover/models:opacity-100 hover:bg-[var(--color-hoverBg)]">
                <FaPlus size={10} className="text-[var(--color-textMuted)]" />
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelSelector;
