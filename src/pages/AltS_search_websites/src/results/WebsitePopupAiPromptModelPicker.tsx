/** popup Shadow-DOM presentation of the existing AI Prompt model selection rules. */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { FiPlus } from 'react-icons/fi';
import { DEFAULT_AI_PROMPT_MODELS, DEFAULT_AI_PROMPT_MODEL_URLS, } from '../../../../allObjectFolder/src/createObject/aiPrompt/aiPromptModelHelpers';
import type { CustomModelConfig } from '../../../../allObjectFolder/src/createObject/aiPrompt/aiPromptTypes';
import { getFaviconUrl } from '../../../../shared-components/searchBarMain/utilityFunctions/utils';
import { generateEntityId } from '../../../../shared-components/utils/idGenerator';
import type { WebsitePopupAiPromptModelValue } from '../../../../shared-components/websitePopup/websitePopupModelSelection';
export function WebsitePopupAiPromptModelPicker({ value, onChange, onClose, style, inline = false, }: {
    value: WebsitePopupAiPromptModelValue;
    onChange: (next: WebsitePopupAiPromptModelValue) => void;
    onClose?: () => void;
    style?: CSSProperties;
    inline?: boolean;
}) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const [adding, setAdding] = useState(false);
    const [providerId, setProviderId] = useState(DEFAULT_AI_PROMPT_MODELS[0].id);
    const [newUrl, setNewUrl] = useState(DEFAULT_AI_PROMPT_MODEL_URLS[DEFAULT_AI_PROMPT_MODELS[0].id]);
    const [message, setMessage] = useState<string | null>(null);
    const models = [...DEFAULT_AI_PROMPT_MODELS, ...value.customModels];
    useEffect(() => {
        if (!inline)
            rootRef.current?.focus({ preventScroll: true });
    }, [inline]);
    const emit = (patch: Partial<WebsitePopupAiPromptModelValue>) => {
        onChange({ ...value, ...patch });
        setMessage(null);
    };
    const toggle = (id: string) => {
        const enabled = value.enabledModelIds.includes(id);
        if (enabled && value.enabledModelIds.length === 1) {
            setMessage('Keep at least one model selected.');
            return;
        }
        emit({
            enabledModelIds: enabled
                ? value.enabledModelIds.filter(modelId => modelId !== id)
                : [...value.enabledModelIds, id],
        });
    };
    const changeProvider = (id: string) => {
        const provider = DEFAULT_AI_PROMPT_MODELS.find(model => model.id === id) || DEFAULT_AI_PROMPT_MODELS[0];
        setProviderId(provider.id);
        setNewUrl(DEFAULT_AI_PROMPT_MODEL_URLS[provider.id] || `https://${provider.host}`);
    };
    const addModel = () => {
        const provider = DEFAULT_AI_PROMPT_MODELS.find(model => model.id === providerId) || DEFAULT_AI_PROMPT_MODELS[0];
        const url = newUrl.trim();
        if (!url) {
            setMessage('Enter a model URL.');
            return;
        }
        let host = '';
        try {
            const parsed = new URL(url);
            if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
                throw new Error();
            host = parsed.hostname;
        }
        catch {
            setMessage('Use a valid HTTP or HTTPS URL.');
            return;
        }
        const id = generateEntityId(`${provider.id}CustomModel`);
        emit({
            customModels: [...value.customModels, { id, name: provider.name, host }],
            enabledModelIds: [...value.enabledModelIds, id],
            modelUrls: { ...value.modelUrls, [id]: url },
        });
        setAdding(false);
        changeProvider(DEFAULT_AI_PROMPT_MODELS[0].id);
    };
    const removeModel = (id: string) => {
        const modelUrls = { ...value.modelUrls };
        delete modelUrls[id];
        const enabledModelIds = value.enabledModelIds.filter(modelId => modelId !== id);
        emit({
            customModels: value.customModels.filter(model => model.id !== id),
            enabledModelIds: enabledModelIds.length ? enabledModelIds : [DEFAULT_AI_PROMPT_MODELS[0].id],
            modelUrls,
        });
    };
    return (<div ref={rootRef} tabIndex={inline ? undefined : -1} style={style} data-inline={inline ? 'true' : undefined} className="website-popup-result-model-picker website-popup-custom-scrollbar" role={inline ? 'group' : 'dialog'} aria-label="Select models" onKeyDown={event => {
            if (inline) {
                // Editing a model URL must not implicitly submit the enclosing edit form.
                if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && event.target instanceof HTMLInputElement)
                    event.preventDefault();
                return;
            }
            if (event.key !== 'Escape')
                return;
            event.preventDefault();
            event.stopPropagation();
            onClose?.();
        }}>
      <div className="website-popup-result-model-picker__header">
        <span>Models</span>
        <span>{value.enabledModelIds.length} selected</span>
      </div>
      <div className="website-popup-result-model-picker__list">
        {models.map(model => {
            const custom = value.customModels.some(item => item.id === model.id);
            const url = value.modelUrls[model.id] ?? DEFAULT_AI_PROMPT_MODEL_URLS[model.id] ?? `https://${model.host}`;
            return (<div className="website-popup-result-model-picker__row" key={model.id} data-enabled={value.enabledModelIds.includes(model.id) ? 'true' : 'false'}>
              <label className="website-popup-result-model-picker__identity">
                <input type="checkbox" checked={value.enabledModelIds.includes(model.id)} onChange={() => toggle(model.id)} aria-label={`${value.enabledModelIds.includes(model.id) ? 'Disable' : 'Enable'} ${model.name}`}/>
                <img src={getFaviconUrl(model.host)} alt=""/>
                <span title={model.name}>{model.name}</span>
              </label>
              <input className="website-popup-result-model-picker__url" value={url} title={url} aria-label={`${model.name} URL`} placeholder="https://" onChange={event => emit({ modelUrls: { ...value.modelUrls, [model.id]: event.currentTarget.value } })}/>
              {custom ? (<button type="button" aria-label={`Remove ${model.name}`} onClick={() => removeModel(model.id)}>
                  Remove
                </button>) : null}
            </div>);
        })}
      </div>
      {message ? (<p className="website-popup-result-edit-panel__error" role="alert">
          {message}
        </p>) : null}
      {adding ? (<div className="website-popup-result-model-picker__add">
          <select aria-label="Model provider" value={providerId} onChange={event => changeProvider(event.currentTarget.value)}>
            {DEFAULT_AI_PROMPT_MODELS.map(model => (<option key={model.id} value={model.id}>
                {model.name}
              </option>))}
          </select>
          <input aria-label="New model URL" value={newUrl} placeholder="https://" onChange={event => setNewUrl(event.currentTarget.value)} onKeyDown={event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    addModel();
                }
            }}/>
          <button type="button" aria-label="Add model" onClick={addModel}>
            <FiPlus aria-hidden="true"/>
          </button>
        </div>) : (<button type="button" className="website-popup-result-model-picker__add-button" onClick={() => setAdding(true)}>
          <FiPlus aria-hidden="true"/> Add Model
        </button>)}
    </div>);
}
