import * as React from 'react';
import { FaPlus, FaTimes } from 'react-icons/fa';
import { getFaviconUrl } from '../../../../../shared-components/searchBarMain/utilityFunctions/utils';
import { generateEntityId } from '../../../../../shared-components/utils/idGenerator';
import { DEFAULT_AI_PROMPT_MODELS, DEFAULT_AI_PROMPT_MODEL_URLS, type AiModelTarget, } from '../aiPromptModelHelpers';
import type { CustomModelConfig } from '../aiPromptTypes';
export type AiPromptModelSelectorValue = {
    modelUrls: Record<string, string>;
    customModels: CustomModelConfig[];
    enabledModelIds: string[];
};
export type AiPromptModelSelectorProps = {
    value: AiPromptModelSelectorValue;
    onChange: (value: AiPromptModelSelectorValue) => void;
};
const PROVIDER_NAMES: Record<string, string> = {
    gpt: 'ChatGPT',
    claude: 'Claude',
    gemini: 'Gemini',
    perplexity: 'Perplexity',
};
const PROVIDER_HOSTS: Record<string, string> = {
    gpt: 'chatgpt.com',
    claude: 'claude.ai',
    gemini: 'gemini.google.com',
    perplexity: 'perplexity.ai',
};
export const AiPromptModelSelector: React.FC<AiPromptModelSelectorProps> = ({ value, onChange, }) => {
    const [isAddModelOpen, setIsAddModelOpen] = React.useState(false);
    const [newModelProvider, setNewModelProvider] = React.useState('gpt');
    const [newModelName, setNewModelName] = React.useState('ChatGPT');
    const allModels = React.useMemo<AiModelTarget[]>(() => [
        ...DEFAULT_AI_PROMPT_MODELS,
        ...(value.customModels || [])
    ], [value.customModels]);
    const updateValue = (patch: Partial<AiPromptModelSelectorValue>) => {
        onChange({
            modelUrls: value.modelUrls || {},
            customModels: value.customModels || [],
            enabledModelIds: value.enabledModelIds || [],
            ...patch,
        });
    };
    const toggleModel = (modelId: string) => {
        const current = value.enabledModelIds || [];
        const next = current.includes(modelId)
            ? current.filter(id => id !== modelId)
            : [...current, modelId];
        updateValue({ enabledModelIds: next });
    };
    const setModelUrl = (modelId: string, url: string) => {
        updateValue({
            modelUrls: {
                ...(value.modelUrls || {}),
                [modelId]: url,
            },
        });
    };
    const handleProviderChange = (providerId: string) => {
        setNewModelProvider(providerId);
        setNewModelName(PROVIDER_NAMES[providerId] || 'ChatGPT');
    };
    const handleOpenAddModel = () => {
        setNewModelProvider('gpt');
        setNewModelName('ChatGPT');
        setIsAddModelOpen(true);
    };
    const handleAddModel = () => {
        const cleanName = newModelName.trim();
        if (!cleanName)
            return;
        const matchedDefault = DEFAULT_AI_PROMPT_MODELS.find(model => model.name.toLowerCase() === cleanName.toLowerCase());
        if (matchedDefault) {
            if (!value.enabledModelIds.includes(matchedDefault.id)) {
                updateValue({ enabledModelIds: [...value.enabledModelIds, matchedDefault.id] });
            }
            setIsAddModelOpen(false);
            return;
        }
        const newId = generateEntityId(`${newModelProvider}CustomModel`);
        const newModel: CustomModelConfig = {
            id: newId,
            name: cleanName,
            host: PROVIDER_HOSTS[newModelProvider] || 'chatgpt.com',
        };
        updateValue({
            customModels: [...(value.customModels || []), newModel],
            enabledModelIds: [...(value.enabledModelIds || []), newId],
            modelUrls: {
                ...(value.modelUrls || {}),
                [newId]: `https://${newModel.host}`,
            },
        });
        setIsAddModelOpen(false);
    };
    const handleDeleteCustomModel = (modelId: string) => {
        const nextModelUrls = { ...(value.modelUrls || {}) };
        delete nextModelUrls[modelId];
        updateValue({
            customModels: (value.customModels || []).filter(model => model.id !== modelId),
            enabledModelIds: (value.enabledModelIds || []).filter(id => id !== modelId),
            modelUrls: nextModelUrls,
        });
    };
    return (<div className="flex flex-col gap-2 rounded-[7px] border border-[var(--alts-border-color)] bg-[var(--alts-row-hover-bg)]/25 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-[520] tracking-wide text-[var(--alts-text-section)] select-none">
          Models
        </span>
        <span className="text-[10px] font-medium text-[var(--alts-text-secondary)]">
          {(value.enabledModelIds || []).length} selected
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {allModels.map(model => {
            const isEnabled = (value.enabledModelIds || []).includes(model.id);
            const isCustom = !DEFAULT_AI_PROMPT_MODELS.some(defaultModel => defaultModel.id === model.id);
            const url = (value.modelUrls || {})[model.id] || DEFAULT_AI_PROMPT_MODEL_URLS[model.id] || `https://${model.host}`;
            return (<div key={model.id} className="flex min-w-0 items-center gap-2 rounded-[6px] px-1 py-1.5 transition-colors hover:bg-[var(--alts-row-hover-bg)]">
              <input type="checkbox" checked={isEnabled} onChange={() => toggleModel(model.id)} className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-[var(--alts-border-color)] accent-[var(--alts-focus-color,var(--color-primary))]"/>
              <img src={getFaviconUrl(model.host)} alt={model.name} className="h-4 w-4 shrink-0 object-contain"/>
              <span className="min-w-[74px] max-w-[82px] truncate text-[12px] font-semibold text-[var(--alts-text-primary)]">
                {model.name}
              </span>
              <input value={url} title={url} onChange={event => setModelUrl(model.id, event.target.value)} className="min-w-0 flex-1 truncate rounded-[5px] border border-[var(--alts-border-color)] bg-transparent px-2 py-1 text-[10px] font-mono text-[var(--alts-text-primary)] outline-none transition-colors placeholder:text-[var(--alts-text-placeholder)] focus:border-[var(--alts-focus-color,var(--color-primary))]" placeholder="Model URL"/>
              {isCustom ? (<button type="button" onClick={() => handleDeleteCustomModel(model.id)} className="shrink-0 rounded-[4px] p-1 text-[var(--alts-text-secondary)] transition-colors hover:bg-[var(--alts-row-hover-bg)] hover:text-[var(--alts-text-primary)]" title="Delete custom model">
                  <FaTimes size={10}/>
                </button>) : null}
            </div>);
        })}
      </div>

      <button type="button" onClick={handleOpenAddModel} className="mx-auto mt-1 flex w-full max-w-[200px] items-center justify-center gap-1.5 rounded-[7px] border border-[var(--alts-border-color)] bg-transparent px-3 py-1.5 text-[12px] font-semibold text-[var(--alts-text-primary)] transition-colors hover:bg-[var(--alts-row-hover-bg)]">
        <FaPlus size={10}/>
        <span>Add Model</span>
      </button>

      {isAddModelOpen ? (<div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[360px] rounded-[10px] border border-[var(--alts-border-color)] bg-[var(--alts-card-bg,var(--alts-bg-primary,#18181b))] p-4 text-[var(--alts-text-primary)] shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-[13px] font-semibold">Add Model</h3>
              <button type="button" onClick={() => setIsAddModelOpen(false)} className="rounded-[5px] p-1 text-[var(--alts-text-secondary)] hover:bg-[var(--alts-row-hover-bg)] hover:text-[var(--alts-text-primary)]">
                <FaTimes size={12}/>
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-[11px] font-medium text-[var(--alts-text-secondary)]">
                Provider
                <select value={newModelProvider} onChange={event => handleProviderChange(event.target.value)} className="rounded-[6px] border border-[var(--alts-border-color)] bg-transparent px-2.5 py-2 text-[12px] text-[var(--alts-text-primary)] outline-none">
                  {DEFAULT_AI_PROMPT_MODELS.map(model => (<option key={model.id} value={model.id}>
                      {model.name}
                    </option>))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] font-medium text-[var(--alts-text-secondary)]">
                Name
                <input value={newModelName} onChange={event => setNewModelName(event.target.value)} className="rounded-[6px] border border-[var(--alts-border-color)] bg-transparent px-2.5 py-2 text-[12px] text-[var(--alts-text-primary)] outline-none" placeholder="Model name"/>
              </label>
              <button type="button" onClick={handleAddModel} className="mt-1 rounded-[7px] border border-[var(--alts-border-color)] bg-transparent px-3 py-2 text-[12px] font-semibold text-[var(--alts-text-primary)] hover:bg-[var(--alts-row-hover-bg)]">
                Add Model
              </button>
            </div>
          </div>
        </div>) : null}
    </div>);
};
