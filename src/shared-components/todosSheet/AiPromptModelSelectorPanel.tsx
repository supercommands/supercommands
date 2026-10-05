import * as React from 'react';
import { FaPlus, FaTimes } from 'react-icons/fa';
import { DEFAULT_AI_PROMPT_MODELS, DEFAULT_AI_PROMPT_MODEL_URLS, type AiModelTarget, } from '../../allObjectFolder/src/createObject/aiPrompt/aiPromptModelHelpers';
import type { CustomModelConfig } from '../../allObjectFolder/src/createObject/aiPrompt/aiPromptTypes';
import { getFaviconUrl } from '../searchBarMain/utilityFunctions/utils';
import { generateEntityId } from '../utils/idGenerator';
export type AiPromptModelSelectorPanelValue = {
    enabledModelIds: string[];
    modelUrls: Record<string, string>;
    customModels: CustomModelConfig[];
};
type AiPromptModelSelectorPanelProps = {
    value: AiPromptModelSelectorPanelValue;
    onChange: (value: AiPromptModelSelectorPanelValue) => void;
    modelSelectionError?: string | null;
    className?: string;
};
const PANEL_MODELS = DEFAULT_AI_PROMPT_MODELS;
const blackPanelStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-rootBg)',
    color: 'var(--color-textSecondary)',
};
const inputClassName = 'min-w-0 truncate rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-rootBg)] px-2 py-1 text-[10px] font-mono text-[var(--color-textSecondary)] outline-none placeholder:text-[var(--color-textPlaceholder)] focus:border-[var(--color-borderActive)]';
export const AiPromptModelSelectorPanel: React.FC<AiPromptModelSelectorPanelProps> = ({ value, onChange, modelSelectionError, className = '', }) => {
    const [isAddingModel, setIsAddingModel] = React.useState(false);
    const [newModelProvider, setNewModelProvider] = React.useState('gpt');
    const [newModelUrl, setNewModelUrl] = React.useState(DEFAULT_AI_PROMPT_MODEL_URLS.gpt);
    const addUrlInputRef = React.useRef<HTMLInputElement | null>(null);
    const enabledModelIds = value.enabledModelIds || [];
    const modelUrls = value.modelUrls || {};
    const customModels = React.useMemo(() => value.customModels || [], [value.customModels]);
    const allModels = React.useMemo<AiModelTarget[]>(() => [
        ...PANEL_MODELS,
        ...customModels.map(model => ({
            id: model.id,
            name: model.name || model.id,
            host: model.host || '',
        }))
    ], [customModels]);
    const emitChange = (patch: Partial<AiPromptModelSelectorPanelValue>) => {
        onChange({
            enabledModelIds,
            modelUrls,
            customModels,
            ...patch,
        });
    };
    const toggleModel = (modelId: string) => {
        if (enabledModelIds.includes(modelId)) {
            const next = enabledModelIds.filter(id => id !== modelId);
            if (next.length === 0)
                return;
            emitChange({ enabledModelIds: next });
            return;
        }
        emitChange({ enabledModelIds: [...enabledModelIds, modelId] });
    };
    const setModelUrl = (modelId: string, url: string) => {
        emitChange({
            modelUrls: {
                ...modelUrls,
                [modelId]: url,
            },
        });
    };
    const deleteCustomModel = (modelId: string) => {
        const nextUrls = { ...modelUrls };
        delete nextUrls[modelId];
        const nextEnabled = enabledModelIds.filter(id => id !== modelId);
        emitChange({
            customModels: customModels.filter(model => model.id !== modelId),
            enabledModelIds: nextEnabled.length ? nextEnabled : ['gpt'],
            modelUrls: nextUrls,
        });
    };
    const handleProviderChange = (providerId: string) => {
        const provider = PANEL_MODELS.find(model => model.id === providerId) || PANEL_MODELS[0];
        setNewModelProvider(provider.id);
        setNewModelUrl(DEFAULT_AI_PROMPT_MODEL_URLS[provider.id] || `https://${provider.host}`);
    };
    const addCustomModel = () => {
        const provider = PANEL_MODELS.find(model => model.id === newModelProvider) || PANEL_MODELS[0];
        const cleanUrl = newModelUrl.trim();
        if (!cleanUrl)
            return;
        const host = cleanUrl.replace(/^https?:\/\//i, '').split('/')[0] || provider.host;
        const newId = generateEntityId(`${provider.id}CustomModel`);
        emitChange({
            customModels: [...customModels, { id: newId, name: provider.name, host }],
            enabledModelIds: [...enabledModelIds, newId],
            modelUrls: {
                ...modelUrls,
                [newId]: cleanUrl,
            },
        });
        setNewModelProvider('gpt');
        setNewModelUrl(DEFAULT_AI_PROMPT_MODEL_URLS.gpt);
        setIsAddingModel(false);
    };
    React.useEffect(() => {
        if (isAddingModel) {
            addUrlInputRef.current?.focus();
        }
    }, [isAddingModel]);
    return (<div className={`flex flex-col gap-1 ${className}`} style={blackPanelStyle} onKeyDown={event => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')
                return;
            if (!(event.target instanceof HTMLInputElement) || event.target.type !== 'checkbox')
                return;
            const checkboxes = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
            const currentIndex = checkboxes.indexOf(event.target);
            const nextIndex = Math.max(0, Math.min(checkboxes.length - 1, currentIndex + (event.key === 'ArrowDown' ? 1 : -1)));
            if (nextIndex === currentIndex)
                return;
            event.preventDefault();
            checkboxes[nextIndex]?.focus();
        }}>
      <div className="flex flex-col divide-y divide-[var(--color-borderDefault)]">
        {allModels.map(model => {
            const isEnabled = enabledModelIds.includes(model.id);
            const isCustom = !PANEL_MODELS.some(defaultModel => defaultModel.id === model.id);
            const url = modelUrls[model.id] ?? DEFAULT_AI_PROMPT_MODEL_URLS[model.id] ?? `https://${model.host}`;
            return (<div key={model.id} className="flex min-w-0 items-center justify-between gap-3 rounded-md px-1 py-2 transition-colors hover:bg-[var(--color-hoverBg)]">
              <div className="flex w-[120px] shrink-0 items-center gap-2.5">
                <input type="checkbox" checked={isEnabled} onChange={() => toggleModel(model.id)} className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-[#555] accent-[#93BCEC]" aria-label={isEnabled ? `Disable ${model.name}` : `Enable ${model.name}`}/>
                <img src={getFaviconUrl(model.host)} alt="" className="h-4 w-4 shrink-0 object-contain"/>
                <span className="min-w-0 truncate text-xs font-semibold text-[#D4D4D4]">{model.name}</span>
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <input value={url} title={url} onChange={event => setModelUrl(model.id, event.target.value)} className={`${inputClassName} w-full`} placeholder="https://..."/>
                <button type="button" onClick={() => isCustom && deleteCustomModel(model.id)} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${isCustom
                    ? 'text-[#F87171] hover:bg-[#1A1414] hover:text-[#FCA5A5]'
                    : 'pointer-events-none opacity-0'}`} title={isCustom ? 'Delete custom model' : undefined} aria-hidden={!isCustom}>
                  {isCustom ? <FaTimes size={10}/> : null}
                </button>
              </div>
            </div>);
        })}
      </div>

      {modelSelectionError ? (<div className="px-1 py-1 text-[10px] font-medium text-[#F87171]">{modelSelectionError}</div>) : null}

      {isAddingModel ? (<div className="grid grid-cols-[minmax(104px,0.7fr)_minmax(0,1fr)_32px] items-center gap-2 border-t border-[var(--color-borderDefault)] px-1 py-2">
          <select value={newModelProvider} onChange={event => handleProviderChange(event.target.value)} className="min-w-0 rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-rootBg)] px-2 py-1.5 text-[11px] font-semibold text-[var(--color-textSecondary)] outline-none focus:border-[var(--color-borderActive)]" title="Model provider">
            {PANEL_MODELS.map(model => (<option key={model.id} value={model.id} className="bg-[var(--color-rootBg)] text-[var(--color-textSecondary)]">
                {model.name}
              </option>))}
          </select>
          <input ref={addUrlInputRef} value={newModelUrl} onChange={event => setNewModelUrl(event.target.value)} onKeyDown={event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    addCustomModel();
                }
                else if (event.key === 'Escape') {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsAddingModel(false);
                }
            }} className={inputClassName} placeholder="https://..."/>
          <button type="button" onClick={addCustomModel} disabled={!newModelUrl.trim()} className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--color-borderDefault)] bg-[var(--color-rootBg)] text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] disabled:cursor-not-allowed disabled:opacity-50" title="Add model">
            <FaPlus size={12}/>
          </button>
        </div>) : (<div className="flex justify-center pt-3">
          <button type="button" onClick={() => setIsAddingModel(true)} className="flex w-full max-w-[200px] items-center justify-center gap-1.5 rounded-xl border border-[var(--color-borderDefault)] bg-[var(--color-rootBg)] px-5 py-1.5 text-xs font-medium text-[var(--color-textSecondary)] transition-colors hover:bg-[var(--color-hoverBg)]" title="Add custom model">
            <FaPlus size={10}/>
            <span>Add Model</span>
          </button>
        </div>)}
    </div>);
};
export default AiPromptModelSelectorPanel;
