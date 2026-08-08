import type * as React from 'react';
import {
  FaRobot,
  FaCloud,
  FaExclamationTriangle,
  FaLink,
  FaTerminal,
  FaTimes,
  FaPlus,
  FaPlusCircle,
  FaEllipsisV,
  FaPaste,
  FaTrash,
  FaClipboardList,
  FaCopy,
  FaCookieBite,
} from 'react-icons/fa';
import { GoPaperclip } from 'react-icons/go';
import AutomationStepPicker from './automationStepPicker';
import type { AutomationStep, SavedAutomation, AutomationInputDefinition } from '../utilities/automation';
import type { CloudModule, CloudVariableGroup } from '../utilities/automationTypes';
import { MODULES } from '../utilities/automationConstants';
import { buildCloudVariableGroups, createCloudGroupVariable, canAddCloudVariableToGroup } from '../utilities/automationUtils';

interface AutomationStepConfigProps {
  step: AutomationStep;
  stepNum?: string;
  steps: AutomationStep[];
  installedModules: CloudModule[];
  updateStepConfig: (id: string | number, newConfig: any) => void;
  getAvailableVariables: (currentStepId: string) => any[];
  handleOpenHistorySuggestions: (stepId: string | number, url: string, paramName: string) => void;
  openOptionsStepId: string | null;
  setOpenOptionsStepId: (id: string | null) => void;
  inlineHistorySuggestions: Record<string, { value: string; title: string }[]>;
  inlineFetchingStatus: Record<string, boolean>;
}

const AutomationStepConfig: React.FC<AutomationStepConfigProps> = ({
  step,
  stepNum,
  steps,
  installedModules,
  updateStepConfig,
  getAvailableVariables,
  handleOpenHistorySuggestions,
  openOptionsStepId,
  setOpenOptionsStepId,
  inlineHistorySuggestions,
  inlineFetchingStatus,
}) => {
  const cloudModule =
    installedModules.find(
      m =>
        m.module_key === step.moduleId ||
        String(m.module_id) === String(step.moduleId) ||
        String(m.module_id) === step.moduleId,
    ) || null;

  const getStepLabel = (s: AutomationStep) => {
    const module = MODULES.find(m => m.id === s.moduleId);
    if (!module) {
      const cloud = installedModules.find(
        m => m.module_key === s.moduleId || String(m.module_id) === String(s.moduleId),
      );
      return cloud?.name || s.config.name || 'Action';
    }
    return module?.name || 'Action';
  };

  const renderVariableTableConfig = (s: AutomationStep, sNum?: string) => {
    const isPaste = s.moduleId === 'paste';
    const currentCloudModule =
      installedModules.find(
        m =>
          m.module_key === s.moduleId ||
          String(m.module_id) === String(s.moduleId) ||
          String(m.module_id) === s.moduleId,
      ) || null;

    const getCloudModuleVars = () => {
      if (!currentCloudModule) return [];
      const vars = new Set<string>();
      if (s.subSteps && s.subSteps.length > 0) {
        s.subSteps.forEach(sub => {
          if (sub.moduleId === 'paste' && sub.config?.content) {
            const matches = String(sub.config.content).match(/\{([^}\s)]+)\}/g);
            if (matches) matches.forEach(m => vars.add(m.slice(1, -1)));
          }
        });
      }
      if (vars.size === 0 && currentCloudModule.execution_steps) {
        currentCloudModule.execution_steps.forEach(step => {
          const matches = [step.url, step.selector, step.value, step.key, step.code]
            .filter(Boolean)
            .join(' ')
            .match(/\{([^}\s)]+)\}/g);
          if (matches) matches.forEach(m => vars.add(m.slice(1, -1)));
        });
      }
      return Array.from(vars).map(v => ({
        key: v,
        type: (v === 'image' ? 'image' : 'long_text') as any,
        values: [''],
      }));
    };

    const currentPrompts: {
      key: string;
      type: 'short_text' | 'long_text' | 'dropdown' | 'constant' | 'image';
      values: string[];
    }[] =
      s.config.prompts && s.config.prompts.length > 0
        ? s.config.prompts.map((p: any) => ({ ...p, type: p.type || 'long_text' }))
        : currentCloudModule
          ? getCloudModuleVars()
          : [
              {
                key: s.config.paramKey || s.config.promptLabel || (isPaste ? 'content' : 'prompt1'),
                type: (s.config.dropdownOptions ? 'dropdown' : 'long_text') as any,
                values: s.config.dropdownOptions
                  ? s.config.dropdownOptions.split(',')
                  : s.config.fixedValue
                    ? [s.config.fixedValue]
                    : [''],
              },
            ];

    const savePrompts = (updatedPrompts: typeof currentPrompts) => {
      const updates: any = { prompts: updatedPrompts };
      const first = updatedPrompts[0];
      if (first) {
        updates.paramKey = first.key;
        updates.fixedValue = first.type !== 'dropdown' && first.values.length === 1 ? first.values[0] : '';
        updates.dropdownOptions = first.type === 'dropdown' ? first.values.join(',') : '';
        if (isPaste) updates.content = first.values[0] || '';
      }
      updateStepConfig(s.id, updates);
    };

    const defaultName = isPaste ? 'Paste Configuration' : 'Agent Configuration';
    const stepName = s.config.name ? s.config.name : defaultName;

    const addVariableRow = () => {
      const base = isPaste ? 'content' : 'prompt';
      let maxIndex = 0;
      currentPrompts.forEach(p => {
        const m = String(p.key || '').match(new RegExp(`^${base}(\\d+)$`, 'i'));
        if (m) {
          const n = Number(m[1]);
          if (!Number.isNaN(n) && n > maxIndex) maxIndex = n;
        }
      });
      const nextKey = `${base}${maxIndex + 1}`;
      const updated = [...currentPrompts, { key: nextKey, type: 'long_text' as const, values: [''] }];
      savePrompts(updated);
    };

    if (currentCloudModule) {
      const cloudConfig = s.config || {};
      const baseVariables = Array.isArray((currentCloudModule as any).variables)
        ? (currentCloudModule as any).variables
        : [];
      const customVariables = Array.isArray(cloudConfig.variables) ? cloudConfig.variables : [];
      const { variables, customVariableNames, groupedVariables } = buildCloudVariableGroups(
        s,
        steps.findIndex(step => step.id === s.id),
        {
          ...cloudConfig,
          execution_steps: cloudConfig.execution_steps || (currentCloudModule as any).execution_steps || [],
        },
        baseVariables,
        customVariables,
      );

      const renderCloudVariableInput = (variable: any, definition: AutomationInputDefinition) => {
        const variableName = String(variable?.name || '');
        const canDelete = customVariableNames.has(variableName);
        const isImageVariable = definition.type === 'image' || String(variable?.type || '').toLowerCase() === 'image';

        return (
          <div key={variableName} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-neutral-700 dark:text-neutral-300">
                {variable.label || definition.label || variableName}
              </label>
              <div className="flex items-center gap-2">
                {variable.required && (
                  <span className="text-[8px] font-black text-red-500 tracking-tighter uppercase">Required</span>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextCustomVariables = customVariables.filter(
                        (customVariable: any) =>
                          String(customVariable?.key || customVariable?.name || '') !== variableName,
                      );
                      updateStepConfig(s.id, { variables: nextCustomVariables });
                    }}
                    className="inline-flex items-center justify-center p-1 rounded border border-red-500/30 text-red-400 hover:text-red-300 hover:border-red-400/60 transition-all"
                    title="Delete variable">
                    <FaTrash size={8} />
                  </button>
                )}
              </div>
            </div>
            {isImageVariable ? (
              <div className="px-2.5 py-2 text-[10px] font-bold text-neutral-400 flex items-center gap-2 italic border border-white/10 rounded-lg bg-transparent">
                <GoPaperclip size={10} /> Image Placeholder (User will upload)
              </div>
            ) : (
              <input
                type="text"
                className="w-full bg-transparent border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:border-white/30 transition-all"
                value={cloudConfig[variableName] || ''}
                onChange={e => updateStepConfig(s.id, { [variableName]: e.target.value })}
                placeholder={variable.placeholder || `Enter ${variable.label || variableName}...`}
              />
            )}
          </div>
        );
      };

      const addCloudVariableWithGroup = (group: CloudVariableGroup) => {
        updateStepConfig(s.id, {
          variables: [...customVariables, createCloudGroupVariable(group, variables)],
        });
      };

      return (
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center border border-white/10">
                <FaRobot className="text-[var(--color-iconDefault)]" size={10} />
              </div>
              <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-200 tracking-widest uppercase">
                {sNum ? `${sNum}) ${stepName}` : stepName}
              </span>
            </div>
          </div>
          <div className="flex flex-col border border-neutral-200 dark:border-white/10 bg-transparent rounded-xl overflow-hidden">
            {groupedVariables.length > 0 ? (
              groupedVariables.map((group, groupIndex) => (
                <div
                  key={group.id}
                  className={`${groupIndex > 0 ? 'border-t border-neutral-200 dark:border-white/10' : ''}`}>
                  <div className="px-3 py-2.5 flex items-center gap-2 flex-wrap border-b border-neutral-200/60 dark:border-white/5">
                    <span className="text-[10px] font-bold tracking-wider text-neutral-500 uppercase">
                      {group.label}
                    </span>
                    {group.selector && (
                      <span className="px-2 py-0.5 rounded-full border border-neutral-200 dark:border-white/10 text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
                        {group.selector}
                      </span>
                    )}
                  </div>
                  <div className="p-3 space-y-3 bg-transparent">
                    {group.inputs.map(({ variable, definition }) => renderCloudVariableInput(variable, definition))}
                    {canAddCloudVariableToGroup(group) && (
                      <button
                        type="button"
                        onClick={() => addCloudVariableWithGroup(group)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-white/15 bg-transparent text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 hover:border-white/30 hover:text-white transition-all">
                        <FaPlus size={9} /> Add Variable
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-3 py-3 text-[10px] text-neutral-500 italic">No module fields</div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isPaste ? (
              <div className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center border border-white/10">
                <FaPaste className="text-[var(--color-iconDefault)]" size={10} />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center border border-white/10">
                <FaRobot className="text-[var(--color-iconDefault)]" size={10} />
              </div>
            )}
            <span className="text-[11px] font-bold text-neutral-700 dark:text-neutral-200 tracking-widest uppercase">
              {sNum ? `${sNum} ${stepName}` : stepName}
            </span>
          </div>
        </div>
        <div className="flex flex-col border border-neutral-200 dark:border-white/10 bg-transparent rounded-xl">
          {currentPrompts.length > 0 && (
            <div className="grid grid-cols-[minmax(0,1fr)_110px] border-b border-neutral-200 dark:border-white/10 text-neutral-500 bg-transparent">
              <span className="px-3 py-2 text-[10px] font-bold tracking-wider uppercase">Your Prompt</span>
              <span className="px-3 py-2 text-[10px] font-bold tracking-wider border-l border-neutral-200 dark:border-white/10 text-center uppercase">
                Image
              </span>
            </div>
          )}
          <div className="flex flex-col bg-transparent">
            {currentPrompts.map((prompt, pIdx) => {
              const isImagePrompt = prompt.type === 'image';
              return (
                <div
                  key={pIdx}
                  className="relative grid grid-cols-[minmax(0,1fr)_110px] border-b last:border-b-0 border-neutral-200 dark:border-white/10 bg-transparent group">
                  <div className="px-3 py-2.5 border-r border-neutral-200 dark:border-white/10 space-y-1.5 bg-transparent min-w-0">
                    {prompt.type === 'dropdown' ? (
                      <div className="p-2 space-y-1 bg-black/5 dark:bg-black/10 rounded">
                        {prompt.values.map((val, vIdx) => (
                          <div key={vIdx} className="flex items-center gap-1 group/opt">
                            <input
                              type="text"
                              value={val}
                              onChange={e => {
                                const updated = [...currentPrompts];
                                const vals = [...updated[pIdx].values];
                                vals[vIdx] = e.target.value;
                                updated[pIdx] = { ...updated[pIdx], values: vals };
                                savePrompts(updated);
                              }}
                              onKeyDown={e => e.stopPropagation()}
                              placeholder={`Option ${vIdx + 1}`}
                              className="flex-1 bg-[var(--color-snippetConfigBg)] border border-neutral-200 dark:border-white/5 rounded px-2 py-1 text-[11px] text-neutral-700 dark:text-neutral-200 placeholder-[var(--color-textPlaceholder)] focus:outline-none focus:border-white/30 transition-colors"
                            />
                            <button
                              onClick={() => {
                                const updated = [...currentPrompts];
                                const vals =
                                  updated[pIdx].values.length <= 1
                                    ? ['']
                                    : updated[pIdx].values.filter((_, i) => i !== vIdx);
                                updated[pIdx] = { ...updated[pIdx], values: vals };
                                savePrompts(updated);
                              }}
                              className="p-1 text-neutral-400 hover:text-red-400 opacity-0 group-hover/opt:opacity-100 transition-opacity">
                              <FaTimes size={8} />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const updated = [...currentPrompts];
                            updated[pIdx] = { ...updated[pIdx], values: [...updated[pIdx].values, ''] };
                            savePrompts(updated);
                          }}
                          className="flex items-center gap-1 text-[9px] text-neutral-500 hover:text-white font-bold pt-1 tracking-wider uppercase opacity-60 hover:opacity-100 transition-all">
                          <FaPlus size={7} /> Add Option
                        </button>
                      </div>
                    ) : prompt.type === 'short_text' ? (
                      <div className="flex flex-col gap-1 w-full">
                        {prompt.key && (
                          <span className="text-[9px] font-bold text-neutral-400 tracking-widest uppercase">
                            {prompt.key}
                          </span>
                        )}
                        <input
                          type="text"
                          value={prompt.values[0] || ''}
                          onChange={e => {
                            const updated = [...currentPrompts];
                            updated[pIdx] = { ...updated[pIdx], values: [e.target.value] };
                            savePrompts(updated);
                          }}
                          onKeyDown={e => e.stopPropagation()}
                          placeholder="Value..."
                          className="w-full bg-transparent px-0 py-1 text-xs text-neutral-700 dark:text-neutral-200 placeholder-[var(--color-textPlaceholder)] focus:outline-none focus:bg-white/5 transition-colors border-none"
                        />
                      </div>
                    ) : prompt.type === 'image' ? (
                      <div className="flex flex-col gap-1 w-full">
                        {prompt.key && (
                          <span className="text-[9px] font-bold text-neutral-400 tracking-widest uppercase">
                            {prompt.key}
                          </span>
                        )}
                        <div className="px-2.5 py-2 mt-0.5 text-[10px] font-bold text-neutral-500 flex items-center gap-2 italic border border-white/10 rounded-lg bg-transparent">
                          <GoPaperclip size={10} /> Image Placeholder
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 w-full h-full">
                        {prompt.key && (
                          <span className="text-[9px] font-bold text-neutral-400 tracking-widest uppercase">
                            {prompt.key}
                          </span>
                        )}
                        <textarea
                          value={prompt.values[0] || ''}
                          onChange={e => {
                            const target = e.target;
                            target.style.height = 'auto';
                            target.style.height = `${target.scrollHeight}px`;
                            const updated = [...currentPrompts];
                            updated[pIdx] = { ...updated[pIdx], values: [e.target.value] };
                            savePrompts(updated);
                          }}
                          onFocus={e => {
                            const target = e.target;
                            target.style.height = 'auto';
                            target.style.height = `${target.scrollHeight}px`;
                          }}
                          onKeyDown={e => e.stopPropagation()}
                          placeholder="Value..."
                          rows={1}
                          className="w-full bg-transparent px-0 py-0 text-xs text-neutral-700 dark:text-neutral-200 placeholder-[var(--color-textPlaceholder)] focus:outline-none transition-colors resize-none min-h-[20px] border-none overflow-visible"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-center px-2 py-2.5 bg-transparent">
                    <button
                      type="button"
                      onClick={() => {
                        const updated = [...currentPrompts];
                        const current = updated[pIdx];
                        const isCurrentlyImage = current.type === 'image';
                        updated[pIdx] = {
                          ...current,
                          type: isCurrentlyImage ? 'long_text' : 'image',
                          values: isCurrentlyImage ? [''] : current.values,
                        };
                        savePrompts(updated);
                      }}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold tracking-wider transition-colors ${
                        isImagePrompt
                          ? 'border-white/20 text-neutral-400 bg-white/5'
                          : 'border-neutral-300 dark:border-white/15 text-neutral-500 dark:text-neutral-400 hover:border-white/30 hover:text-neutral-300'
                      }`}>
                      <GoPaperclip size={10} />
                      Image
                    </button>
                  </div>
                  {currentPrompts.length > 1 && (
                    <button
                      onClick={() => {
                        const updated = currentPrompts.filter((_, i) => i !== pIdx);
                        savePrompts(updated);
                      }}
                      className="absolute top-1/2 -translate-y-1/2 -right-8 p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-20"
                      title="Delete row">
                      <FaTimes size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={addVariableRow}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-neutral-300 dark:border-white/15 bg-transparent text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 hover:border-white/30 hover:text-neutral-300 transition-all">
            <FaPlus size={10} /> Add Variable
          </button>
        </div>
      </div>
    );
  };

  if (cloudModule || step.moduleId === 'agent') {
    const moduleName = cloudModule?.name || step.config.name || 'AI Agent';
    return (
      <div className="p-5 space-y-6 h-full overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-3 pb-4 border-b border-neutral-100 dark:border-white/5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${cloudModule ? 'bg-transparent border border-white/10' : 'bg-white/5 border border-white/10'}`}>
            {cloudModule ? (
              <FaCloud className="w-5 h-5 text-[var(--color-iconDefault)]" />
            ) : (
              <FaRobot className="w-5 h-5 text-[var(--color-iconDefault)]" />
            )}
          </div>
          <div>
            <h4 className="font-bold text-sm text-[var(--color-textPrimary)]">{moduleName}</h4>
            <p className="text-[10px] text-[var(--color-textMuted)] font-bold tracking-wider uppercase">
              {cloudModule ? 'CLOUD MODULE CONFIG' : 'LEGACY AI AGENT'}
            </p>
          </div>
        </div>
        {!cloudModule && step.moduleId === 'agent' && (
          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 animate-in fade-in slide-in-from-top-1 duration-300">
            <div className="flex items-center gap-2 mb-2 text-amber-500">
              <FaExclamationTriangle size={14} />
              <span className="text-[10px] font-bold tracking-widest uppercase">Legacy Agent Detected</span>
            </div>
            <p className="text-[11px] text-neutral-500 leading-relaxed mb-0">
              This step uses the legacy agent structure. For better reliability and features, transition to our new
              Cloud Modules.
            </p>
          </div>
        )}
        <div className="space-y-4">
          <div className="pt-2">
            <label className="text-[10px] font-bold text-neutral-500 tracking-widest px-1 block mb-2 uppercase">
              Input Configuration
            </label>
            <div className="space-y-3">{renderVariableTableConfig(step)}</div>
          </div>
        </div>
      </div>
    );
  }

  if (step.moduleId === 'link') {
    return (
      <div className="p-5 space-y-6 h-full overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-3 pb-4 border-b border-neutral-100 dark:border-white/5">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <FaLink className="w-5 h-5 text-[var(--color-iconDefault)]" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-[var(--color-textPrimary)]">{step.config.name}</h4>
            <p className="text-[10px] text-[var(--color-textMuted)] font-bold tracking-wider uppercase">BROWSER LINK STEP</p>
          </div>
        </div>
        <div className="space-y-2">
          <input
            type="text"
            value={step.config.url || ''}
            onChange={e => updateStepConfig(step.id, { url: e.target.value })}
            className="w-full text-[11px] font-medium text-neutral-800 dark:text-neutral-100 bg-[var(--color-inputBg)] p-3 rounded-xl border border-neutral-200 dark:border-white/10 outline-none focus:border-white/30 transition-colors shadow-inner"
            placeholder="https://example.com"
            autoFocus
          />
        </div>
      </div>
    );
  }

  if (step.moduleId === 'sub_automation') {
    const auto = step.config as SavedAutomation;
    const detectedInputs: { key: string; label: string }[] = [];
    const seen = new Set<string>();
    auto.steps.forEach(s => {
      Object.values(s.config).forEach(val => {
        if (typeof val === 'string') {
          const matches = val.match(/\{([^}\s)]+)[})]/g);
          if (matches) {
            matches.forEach(m => {
              const k = m.slice(1, -1);
              if (!seen.has(k)) {
                seen.add(k);
                detectedInputs.push({ key: k, label: k });
              }
            });
          }
        }
      });
    });

    return (
      <div className="p-5 space-y-6 h-full overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-3 pb-4 border-b border-neutral-100 dark:border-white/5">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <FaTerminal className="w-5 h-5 text-[var(--color-iconDefault)]" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-[var(--color-textPrimary)]">{auto.name}</h4>
            <p className="text-[10px] text-[var(--color-textMuted)] font-bold tracking-wider uppercase">
              WORKFLOW STEP ({auto.steps.length} Actions)
            </p>
          </div>
        </div>
        <div className="space-y-5">
          {detectedInputs.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <FaPlusCircle className="text-[var(--color-iconDefault)] w-3 h-3" />
                <span className="text-[10px] font-bold text-neutral-500 tracking-widest uppercase">
                  Configurable Inputs
                </span>
              </div>
              {detectedInputs.map(input => (
                <div
                  key={input.key}
                  className="p-4 rounded-2xl bg-neutral-50 dark:bg-white/5 border border-neutral-200/50 dark:border-white/5 space-y-3">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xs font-bold text-neutral-700 dark:text-neutral-200">
                      Variable: {input.label}
                    </span>
                    <span className="text-[9px] font-bold text-neutral-500 bg-white/5 px-1.5 py-0.5 rounded tracking-tighter uppercase border border-white/10">
                      Detected
                    </span>
                  </div>
                  <div className="relative">
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        const popupId = `${step.id}-${input.key}`;
                        setOpenOptionsStepId(openOptionsStepId === popupId ? null : popupId);
                      }}
                      className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-xl border transition-all text-[11px] font-semibold ${openOptionsStepId === `${step.id}-${input.key}` ? 'bg-[var(--color-snippetConfigBg)] border-white/30 text-white' : 'bg-[var(--color-snippetConfigBg)] border-neutral-200 dark:border-white/10 text-neutral-500 hover:border-white/30 hover:text-white'}`}>
                      <FaPlusCircle size={12} className="opacity-50" />
                      <span>
                        {(step.config as any).overrides?.[input.key]?.fixedValue ? 'Overridden' : 'Default Input'}
                      </span>
                      <FaEllipsisV size={8} className="ml-auto opacity-30" />
                    </button>
                    {openOptionsStepId === `${step.id}-${input.key}` && (
                      <div className="mt-2 animate-in fade-in slide-in-from-top-2 duration-200 shadow-xl rounded-xl overflow-hidden border border-neutral-200 dark:border-white/10 ring-1 ring-black/5">
                        <AutomationStepPicker
                          initialPrompts={[
                            {
                              key: input.key,
                              values: (step.config as any).overrides?.[input.key]?.dropdownOptions
                                ? (step.config as any).overrides?.[input.key]?.dropdownOptions.split(',')
                                : (step.config as any).overrides?.[input.key]?.fixedValue
                                  ? [(step.config as any).overrides?.[input.key]?.fixedValue]
                                  : [''],
                            },
                          ]}
                          availableParams={getAvailableVariables(step.id as string)}
                          onOpenHistorySuggestions={paramName =>
                            handleOpenHistorySuggestions(
                              step.id,
                              String((step.config as any).overrides?.[input.key]?.fixedValue || ''),
                              paramName,
                            )
                          }
                          onClose={() => setOpenOptionsStepId(null)}
                          onSave={prompts => {
                            const currentOverrides = (step.config as any).overrides || {};
                            const firstPrompt = prompts[0];
                            if (!firstPrompt) return;
                            updateStepConfig(step.id, {
                              overrides: {
                                ...currentOverrides,
                                [firstPrompt.key]: {
                                  fixedValue: firstPrompt.values.length === 1 ? firstPrompt.values[0] : '',
                                  dropdownOptions: firstPrompt.values.length > 1 ? firstPrompt.values.join(',') : '',
                                },
                              },
                            });
                          }}
                          className="w-full shadow-none border-0 static"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-neutral-200 dark:border-white/10 opacity-60">
              <FaRobot className="text-neutral-300 dark:text-neutral-700 w-8 h-8 mb-2" />
              <p className="text-[10px] font-bold text-neutral-400 tracking-widest text-center">
                No configurable inputs
                <br />
                found in this flow
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step.moduleId === 'clipboard_write') {
    return (
      <div className="p-5 space-y-6 h-full overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-3 pb-4 border-b border-neutral-100 dark:border-white/5">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <FaClipboardList className="w-5 h-5 text-[var(--color-iconDefault)]" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-[var(--color-textPrimary)]">Clipboard Write</h4>
            <p className="text-[10px] text-[var(--color-textMuted)] font-bold tracking-wider uppercase">TEXT TO CLIPBOARD</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-neutral-500 tracking-widest px-1 block uppercase">
              Content to Write
            </label>
            <textarea
              value={step.config.text || ''}
              onChange={e => updateStepConfig(step.id, { text: e.target.value })}
              className="w-full bg-[var(--color-inputBg)] border border-neutral-200 dark:border-white/10 rounded-xl px-3 py-3 text-xs font-medium focus:outline-none focus:border-white/30 transition-all min-h-[120px] resize-none shadow-inner"
              placeholder="Enter text to write to clipboard. Use {variable} for dynamic content."
            />
          </div>
        </div>
      </div>
    );
  }

  if (step.moduleId === 'clipboard_read') {
    return (
      <div className="p-5 space-y-6 h-full overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-3 pb-4 border-b border-neutral-100 dark:border-white/5">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <FaCopy className="w-5 h-5 text-[var(--color-iconDefault)]" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-[var(--color-textPrimary)]">Clipboard Read</h4>
            <p className="text-[10px] text-[var(--color-textMuted)] font-bold tracking-wider uppercase">READ FROM CLIPBOARD</p>
          </div>
        </div>
        <div className="p-8 rounded-2xl border border-dashed border-neutral-200 dark:border-white/10 flex flex-col items-center justify-center text-center opacity-70">
          <FaCopy className="text-neutral-400 mb-3" size={24} />
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            This step reads the current clipboard content.
            <br />
            No configuration required.
          </p>
        </div>
      </div>
    );
  }

  if (step.moduleId === 'cookies_clear') {
    return (
      <div className="p-5 space-y-6 h-full overflow-y-auto custom-scrollbar">
        <div className="flex items-center gap-3 pb-4 border-b border-neutral-100 dark:border-white/5">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <FaCookieBite className="w-5 h-5 text-[var(--color-iconDefault)]" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-[var(--color-textPrimary)]">Clear Cookies</h4>
            <p className="text-[10px] text-[var(--color-textMuted)] font-bold tracking-wider uppercase">PRIVACY ACTION</p>
          </div>
        </div>
        <div className="p-8 rounded-2xl border border-dashed border-neutral-200 dark:border-white/10 flex flex-col items-center justify-center text-center opacity-70">
          <FaCookieBite className="text-neutral-400 mb-3" size={24} />
          <p className="text-[11px] text-neutral-500 leading-relaxed">
            This step clears all cookies for the current site.
            <br />
            No configuration required.
          </p>
        </div>
      </div>
    );
  }

  if (step.moduleId === 'click' || step.moduleId === 'paste') {
    const parentIndex = steps.findIndex(
      s => s.id === step.id || (s.subSteps && s.subSteps.some(sub => sub.id === step.id)),
    );
    const parentStep = parentIndex >= 0 ? steps[parentIndex] : null;
    const isSubstep = parentStep && parentStep.id !== step.id;
    let sNum = `${parentIndex + 1}.1`;
    if (isSubstep && parentStep?.subSteps) {
      const subIndex = parentStep.subSteps.findIndex(sub => sub.id === step.id);
      if (subIndex >= 0) sNum = `${parentIndex + 1}.${subIndex + 2}`;
    }

    return (
      <div
        className={`h-full overflow-y-auto custom-scrollbar ${step.moduleId === 'click' || step.moduleId === 'paste' ? 'bg-transparent' : 'bg-[var(--color-snippetConfigBg)]'}`}>
        <div key={step.id}>
          {step.moduleId === 'paste' ? (
            <div className="border-t border-neutral-200 dark:border-white/10 pt-4 mt-4">
              {renderVariableTableConfig(step, sNum)}
            </div>
          ) : step.moduleId === 'click' ? (
            <div className="border-t border-neutral-200 dark:border-white/10 pt-4 mt-4 px-4">
              <div className="text-[12px] text-neutral-400">Selector: {step.config.selector || 'N/A'}</div>
            </div>
          ) : null}
          {step.config.selector && (
            <div className="px-4 pt-4 mt-2 border-t border-neutral-200 dark:border-white/10">
              <div className="text-[10px] font-bold text-neutral-500 tracking-wider mb-3">Selected Element</div>
              {step.config.selectorPageUrl &&
                (() => {
                  let hostname = '';
                  try {
                    hostname = new URL(step.config.selectorPageUrl).hostname;
                  } catch {
                    hostname = step.config.selectorPageUrl;
                  }
                  return (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[9px] font-bold text-neutral-500 tracking-wider flex-none w-14">Page</span>
                      <div className="flex-1 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] text-neutral-300 font-medium min-w-0">
                        <img
                          src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=16`}
                          alt=""
                          className="w-3.5 h-3.5 flex-none rounded-sm"
                          onError={e => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <span className="truncate" title={step.config.selectorPageUrl}>
                          {hostname}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              {step.config.selectorElementName && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-bold text-neutral-500 tracking-wider flex-none w-14">Name</span>
                  <div className="flex-1 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] text-neutral-300 font-medium min-w-0">
                    <span className="truncate" title={step.config.selectorElementName}>
                      {step.config.selectorElementName}
                    </span>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2">
                <span className="text-[9px] font-bold text-neutral-500 tracking-wider mt-1 flex-none w-14 uppercase">
                  Selector
                </span>
                <code className="flex-1 text-[11px] font-mono text-neutral-400 bg-white/5 border border-white/10 rounded px-2 py-1 break-all">
                  {step.config.selector}
                </code>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Final fallback (matches lines 2351+ in original file)
  const finalModule = installedModules.find(
    m => m.module_key === step.moduleId || String(m.module_id) === String(step.moduleId),
  );
  return (
    <div className="p-5 space-y-6 h-full overflow-y-auto custom-scrollbar">
      <div className="flex items-center gap-3 pb-4 border-b border-neutral-100 dark:border-white/5">
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          {step.config.icon_url ? (
            <img src={step.config.icon_url} className="w-5 h-5 rounded shadow-sm" />
          ) : (
            <FaCloud className="w-5 h-5 text-[var(--color-iconDefault)]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-base text-[var(--color-textPrimary)] tracking-tight">
              {steps.findIndex(s => s.id === step.id) + 1}) {step.config.name || 'Cloud Module'}
            </h4>
            {finalModule && finalModule.version && (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/10 text-neutral-300 border border-white/10">
                v{finalModule.version}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="pt-2">
          <label className="text-[10px] font-bold text-neutral-500 tracking-widest px-1 block mb-2 uppercase">
            Input Configuration
          </label>
          <div className="space-y-3">{renderVariableTableConfig(step)}</div>
        </div>
      </div>
    </div>
  );
};

export default AutomationStepConfig;
