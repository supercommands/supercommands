/**
 * @file AiModelPicker.tsx
 * @description Renders a picker panel that allows users to select an AI model 
 * (such as ChatGPT, Claude, Gemini, Perplexity) or create and manage custom AI model configurations.
 * 
 * @usage
 * ```tsx
 * import AiModelPicker from './AiModelPicker';
 * <AiModelPicker
 *   selectedModel={selectedModel}
 *   onSelectModel={(modelId) => setSelectedModel(modelId)}
 * />
 * ```
 */

import * as React from 'react';
import { useState, useEffect } from 'react';

import { useAppearance } from '@extension/ui';
import { motion } from 'framer-motion';
import { FaCheck, FaPencilAlt, FaPlus } from 'react-icons/fa';
import { getFaviconUrl } from '../../../../../shared-components/searchBarMain/utilityFunctions/utils';

interface ModelOption {
  id: string;
  name: string;
  host: string;
}

interface CustomModel {
  id: string;
  name: string;
  url: string;
  host: string;
}

interface AiModelPickerProps {
  selectedModel: string | null;
  onSelectModel: (modelId: string | null) => void;
  isDark?: boolean;
}

const DEFAULT_MODELS: ModelOption[] = [
  { id: 'gpt', name: 'ChatGPT', host: 'chatgpt.com' },
  { id: 'claude', name: 'Claude', host: 'claude.ai' },
  { id: 'gemini', name: 'Gemini', host: 'gemini.google.com' },
  { id: 'perplexity', name: 'Perplexity', host: 'perplexity.ai' },
];

const AiModelPicker: React.FC<AiModelPickerProps> = ({
  selectedModel,
  onSelectModel,
  isDark: isDarkProp,
}) => {
  const { theme } = useAppearance();
  const isDark = isDarkProp ?? theme.isDark;

  const [customModels, setCustomModels] = useState<CustomModel[]>([]);
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [newModelName, setNewModelName] = useState('');
  const [newModelUrl, setNewModelUrl] = useState('');
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editingUrl, setEditingUrl] = useState('');

  const ALLOWED_HOSTS = ['chatgpt.com', 'openai.com', 'claude.ai', 'gemini.google.com', 'perplexity.ai'];

  // Load custom models from chrome.storage.local
  useEffect(() => {
    const loadCustomModels = () => {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          chrome.storage.local.get(['ai_custom_model_urls'], result => {
            const saved = result['ai_custom_model_urls'];
            if (saved) {
              const models: CustomModel[] = Object.entries(saved).map(([key, url]) => ({
                id: `custom-${key}`,
                name: key,
                url: url as string,
                host: (url as string).replace(/https?:\/\//, '').split('/')[0],
              }));
              setCustomModels(models);
            }
          });
        }
      } catch (e) {
        console.error('Failed to load custom models', e);
      }
    };
    loadCustomModels();
  }, []);

  const handleModelClick = (modelId: string) => {
    if (selectedModel === modelId) {
      onSelectModel(null);
    } else {
      onSelectModel(modelId);
    }
  };

  return (
    <div className="w-full">
      <div className={`rounded-xl border overflow-hidden shadow-lg ${isDark ? 'border-white/15 bg-black/60 backdrop-blur-md' : 'border-[#d8d2bf] bg-[#fdf6e3]/90'}`}>
        <div className={`py-1.5 px-2 border-b ${isDark ? 'border-white/10 bg-white/5' : 'border-[#d8d2bf] bg-[#eee8d5]/50'}`}>
          <h3 className={`text-[10px] font-black tracking-[0.2em] ${isDark ? 'text-white/50' : 'text-[#586e75]'}`}>
            AI Model
          </h3>
        </div>
        <div className="overflow-y-auto no-scrollbar max-h-[320px]">
          {DEFAULT_MODELS.map(model => {
            const isActive = selectedModel === model.id;
            return (
              <div key={model.id}>
                <motion.button
                  whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleModelClick(model.id)}
                  className={`group/modelitem grid grid-cols-[20px_1fr_18px] items-center py-0.5 px-0.5 transition-all duration-300 w-full ${isActive ? (isDark ? 'bg-white/[0.06]' : 'bg-[#eee8d5]/80') : ''} cursor-pointer`}>
                  <div className="flex items-center justify-center">
                    <img src={getFaviconUrl(model.host)} alt={model.name} className={`w-3.5 h-3.5 object-contain ${isActive ? 'opacity-100' : 'opacity-70'}`} />
                  </div>
                  <div className="flex items-center gap-1 pl-2 min-w-0 py-0.5">
                    <div className="flex items-center gap-1.5 w-full">
                      <span className={`text-[10px] font-bold truncate ${isActive ? (isDark ? 'text-white' : 'text-[#073642]') : isDark ? 'text-white/50' : 'text-[#586e75]'}`}>
                        {model.name}
                      </span>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setEditingModelId(model.id);
                          setEditingUrl(model.host);
                        }}
                        className={`p-0.5 rounded opacity-0 group-hover/modelitem:opacity-100 transition-all hover:bg-white/10 ${isDark ? 'text-white/40' : 'text-[#93a1a1]'}`}>
                        <FaPencilAlt size={7} />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className={`w-[14px] h-[14px] rounded-full transition-all duration-300 flex items-center justify-center ${isActive ? (isDark ? 'bg-white/25' : 'bg-[#073642]') : 'border-2 ' + (isDark ? 'border-white/20' : 'border-[#d8d2bf]')}`}>
                      {isActive && <FaCheck size={6} className="text-white" />}
                    </div>
                  </div>
                </motion.button>
                {editingModelId === model.id && (
                  <div className="px-2 pb-1">
                    <input
                      autoFocus
                      type="text"
                      value={editingUrl}
                      onChange={e => setEditingUrl(e.target.value)}
                      onBlur={() => setEditingModelId(null)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); setEditingModelId(null); }
                        if (e.key === 'Escape') { setEditingModelId(null); }
                      }}
                      className={`w-full text-[8px] p-1 bg-transparent border rounded outline-none ${isDark ? 'text-white/80 border-white/20' : 'text-[#073642] border-[#d8d2bf]'}`}
                      placeholder="Custom URL"
                    />
                  </div>
                )}
              </div>
            );
          })}

          {customModels.map(custom => {
            const isActive = selectedModel === custom.id;
            return (
              <motion.button
                key={custom.id}
                whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleModelClick(custom.id)}
                className={`group/modelitem grid grid-cols-[20px_1fr_18px] items-center py-0.5 px-0.5 transition-all duration-300 w-full ${isActive ? (isDark ? 'bg-white/[0.06]' : 'bg-[#eee8d5]/80') : ''} cursor-pointer`}>
                <div className="flex items-center justify-center">
                  <img src={getFaviconUrl(custom.host)} alt={custom.name} className="w-3.5 h-3.5 object-contain opacity-70" />
                </div>
                <div className="flex items-center gap-1 pl-2 min-w-0 py-0.5">
                  <span className={`text-[10px] font-bold truncate ${isActive ? (isDark ? 'text-white' : 'text-[#073642]') : isDark ? 'text-white/50' : 'text-[#586e75]'}`}>
                    {custom.name}
                  </span>
                </div>
                <div className="flex items-center justify-center">
                  <div className={`w-[14px] h-[14px] rounded-full transition-all duration-300 flex items-center justify-center ${isActive ? (isDark ? 'bg-white/25' : 'bg-[#073642]') : 'border-2 ' + (isDark ? 'border-white/20' : 'border-[#d8d2bf]')}`}>
                    {isActive && <FaCheck size={6} className="text-white" />}
                  </div>
                </div>
              </motion.button>
            );
          })}

          {isAddingModel ? (
            <div className={`flex flex-col gap-1 p-1.5 border-t ${isDark ? 'border-white/10' : 'border-[#d8d2bf]'}`}>
              <input
                type="text"
                placeholder="Name"
                value={newModelName}
                onChange={e => setNewModelName(e.target.value)}
                className={`text-[8px] p-1 bg-transparent border-b outline-none ${isDark ? 'text-white/80 border-white/20' : 'text-[#073642] border-[#d8d2bf]'}`}
              />
              <input
                autoFocus
                type="text"
                placeholder="URL"
                value={newModelUrl}
                onChange={e => setNewModelUrl(e.target.value)}
                onBlur={() => {
                  if (newModelName.trim() && newModelUrl.trim()) {
                    const isAllowed = ALLOWED_HOSTS.some(h => newModelUrl.toLowerCase().includes(h));
                    if (isAllowed) {
                      const customId = `custom-${Date.now()}`;
                      handleModelClick(customId);
                      setIsAddingModel(false);
                      setNewModelName('');
                      setNewModelUrl('');
                    }
                  } else if (!newModelName.trim() && !newModelUrl.trim()) {
                    setIsAddingModel(false);
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
                  if (e.key === 'Escape') { setIsAddingModel(false); setNewModelName(''); setNewModelUrl(''); }
                }}
                className={`text-[8px] p-1 bg-transparent border rounded outline-none ${isDark ? 'text-white/80 border-white/20' : 'text-[#073642] border-[#d8d2bf]'}`}
              />
            </div>
          ) : (
            <motion.button
              whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.03)' }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setIsAddingModel(true)}
              className={`flex items-center justify-center py-1.5 border-t w-full opacity-0 group-hover:opacity-100 transition-all ${isDark ? 'border-white/10 hover:bg-white/[0.03]' : 'border-[#d8d2bf] hover:bg-[#eee8d5]/80'}`}>
              <FaPlus size={10} className={isDark ? 'text-white/50' : 'text-[#586e75]'} />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiModelPicker;
