import type React from 'react';
import { useCallback, useState } from 'react';
import { FaArrowLeft } from 'react-icons/fa';
import AutomationDataEntry from '../../../allObjectFolder/src/createObject/automationBeta/searchIntegration/automationDataEntry';
import { fileToBase64 } from '../utilityFunctions/fileHelpers';
import { resolveCloudModuleInputValues } from '../../../allObjectFolder/src/createObject/automationBeta/utilities/automation';

export interface SearchbarAutomationField {
  key: string;
  value: any;
  extraValues?: any[];
  type?: string;
  images?: any[];
  label?: string;
  sourceStepIndex?: number;
  sourceVariable?: string;
}

export interface ArchivedAutomationOverlayProps {
  activeCollection: {
    item: any;
    fields: SearchbarAutomationField[];
    focusedFieldIndex?: number;
    agents: any[];
    links: any[];
    automations: any[];
    constantInputs?: Record<string, any>;
  };
  setActiveCollection: (collection: any) => void;
  openUrls: (urls: any[], title: string) => void;
  selectedImages?: any[];
  resetAfterCommandExecution: () => void;
  dynamicLeftOffset: number;
  renderPrefix: () => React.ReactNode;
}

/**
 * ArchivedAutomationOverlay
 * Extracted remote automation input/submit overlay component.
 * This is saved for future reference and is completely disconnected from the main searchBar.tsx.
 */
export const ArchivedAutomationOverlay: React.FC<ArchivedAutomationOverlayProps> = ({
  activeCollection,
  setActiveCollection,
  openUrls,
  selectedImages = [],
  resetAfterCommandExecution,
  dynamicLeftOffset,
  renderPrefix,
}) => {
  const handleCollectionSubmit = useCallback(async () => {
    if (!activeCollection) return;

    const fieldImagesBase64: { base64: string; mimeType: string; filename: string }[] = [];
    for (const f of activeCollection.fields) {
      if (f.type === 'image' && f.images) {
        for (const img of f.images) {
          try {
            const base64 = await fileToBase64(img.file);
            fieldImagesBase64.push({ base64, mimeType: img.mimeType, filename: img.filename });
          } catch (err) {
            console.error('[Searchbar Archived Overlay] Image conversion failed:', err);
          }
        }
      }
    }

    const fieldsForExecution = activeCollection.fields.map(field => {
      if (field.type === 'image') return field;
      const parts = [field.value, ...(field.extraValues || [])]
        .map(val => (typeof val === 'string' ? val.trim() : ''))
        .filter(Boolean);
      const combinedValue = parts.join(' ');
      return { ...field, value: combinedValue };
    });

    const collectionFields = fieldsForExecution;

    // Process Agents
    const finalAgents = activeCollection.agents
      .map((a: any) => {
        let newUrl = a.url || '';
        let specificPromptValue = '';

        collectionFields.forEach(f => {
          let replaced = false;
          const isDirectMatch = a.promptLabel === f.key;
          const anyRegex = new RegExp(`(?:\\{|%7B|\\[)${f.key}(?:\\}|%7D|\\])`, 'gi');
          if (anyRegex.test(newUrl)) {
            newUrl = newUrl.replace(anyRegex, (match: string) => {
              return match.startsWith('%') ? encodeURIComponent(f.value) : f.value;
            });
            replaced = true;
          }

          if (f.key === 'query') {
            if (newUrl.includes('{query}') || newUrl.includes('[query]')) {
              newUrl = newUrl.replace(/\{query\}/gi, encodeURIComponent(f.value));
              newUrl = newUrl.replace(/\[query\]/gi, encodeURIComponent(f.value));
              replaced = true;
            }
          } else if (f.key.startsWith('prompt')) {
            const num = f.key.replace('prompt', '');
            const hasExplicitQueryField = collectionFields.some(field => field.key === 'query');
            if (num === '1' && !hasExplicitQueryField && (newUrl.includes('{query}') || newUrl.includes('[query]'))) {
              newUrl = newUrl.replace(/\{query\}/gi, encodeURIComponent(f.value));
              newUrl = newUrl.replace(/\[query\]/gi, encodeURIComponent(f.value));
              replaced = true;
            }
          }

          if ((replaced || isDirectMatch) && f.value.trim()) {
            if (!specificPromptValue.includes(f.value.trim())) {
              specificPromptValue += (specificPromptValue ? ' ' : '') + f.value.trim();
            }
          }
        });

        let kind: 'chatgpt' | 'claude' | 'perplexity' | 'gemini' | null = null;
        if (newUrl.includes('chatgpt.com')) kind = 'chatgpt';
        else if (newUrl.includes('claude.ai')) kind = 'claude';
        else if (newUrl.includes('perplexity.ai')) kind = 'perplexity';
        else if (newUrl.includes('gemini.google.com')) kind = 'gemini';

        if (kind) {
          let promptForAutoSubmit = specificPromptValue;
          if (!promptForAutoSubmit) {
            try {
              const urlObj = new URL(newUrl);
              promptForAutoSubmit = urlObj.searchParams.get('q') || '';
            } catch (e) {
              const queryField = collectionFields.find(f => f.key === 'query');
              promptForAutoSubmit = queryField ? queryField.value : '';
            }
          }
          if (!promptForAutoSubmit) {
            const queryField = collectionFields.find(f => f.key === 'query');
            promptForAutoSubmit = queryField ? queryField.value : '';
          }
          if (!promptForAutoSubmit) {
            const allPopulatedValues = collectionFields
              .filter(f => f.value && f.value.trim().length > 0)
              .map(f => f.value.trim());
            if (allPopulatedValues.length > 0) {
              promptForAutoSubmit = allPopulatedValues.join(' ');
            }
          }

          let standardUrl = newUrl;
          const isSpecificChat =
            (kind === 'chatgpt' && (newUrl.includes('/c/') || newUrl.includes('/g/'))) ||
            (kind === 'claude' && newUrl.includes('/chat/')) ||
            (kind === 'perplexity' && newUrl.includes('/search/') && !newUrl.includes('?q='));

          if (promptForAutoSubmit || (selectedImages && selectedImages.length > 0) || fieldImagesBase64.length > 0) {
            if (!isSpecificChat) {
              if (kind === 'chatgpt')
                standardUrl = `https://chatgpt.com/?q=${encodeURIComponent(promptForAutoSubmit)}`;
              else if (kind === 'claude')
                standardUrl = `https://claude.ai/new?q=${encodeURIComponent(promptForAutoSubmit)}`;
              else if (kind === 'perplexity')
                standardUrl = `https://www.perplexity.ai/search?q=${encodeURIComponent(promptForAutoSubmit)}`;
              else if (kind === 'gemini') standardUrl = 'https://gemini.google.com/app';
            }
            const finalImages = [...(selectedImages || []), ...fieldImagesBase64];
            return { url: standardUrl, autoSubmit: { kind, prompt: promptForAutoSubmit, images: finalImages } };
          }
        }
        return newUrl;
      })
      .filter(Boolean);

    // Process Links
    const finalLinks = (activeCollection.links || [])
      .map((link: any) => {
        let url = link.url || '';
        const hasExplicitQueryField = collectionFields.some((field: any) => field.key === 'query');
        collectionFields.forEach(f => {
          const regex = new RegExp(`(?:\\\\{|\\\\[|%7B)${f.key}(?:\\\\}|\\\\]|%7D)`, 'gi');
          url = url.replace(regex, encodeURIComponent(f.value));
          if (f.key === 'query' || (!hasExplicitQueryField && f.key === 'prompt1')) {
            url = url.replace(/\{query\}/gi, encodeURIComponent(f.value));
            url = url.replace(/\[query\]/gi, encodeURIComponent(f.value));
          }
        });
        return url;
      })
      .filter(Boolean);

    // Process Automations
    (activeCollection.automations || []).forEach((auto: any) => {
      const inputs: Record<string, string> = {};
      const scopedInputsByStep = new Map<number, Record<string, string>>();
      const constantInputs = activeCollection.constantInputs || {};

      Object.entries(constantInputs).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim() !== '') {
          inputs[key] = value;
        }
      });

      if (typeof window !== 'undefined' && (window as any).__LAST_TYPED_SEARCH_QUERY__) {
        const typedText = (window as any).__LAST_TYPED_SEARCH_QUERY__;
        if (!inputs['content']) inputs['content'] = typedText;
        if (!inputs['query']) inputs['query'] = typedText;
      }

      const fieldsByStepAndVar = new Map<string, SearchbarAutomationField[]>();

      collectionFields.forEach(f => {
        if (typeof f.sourceStepIndex === 'number' && f.sourceVariable) {
          const key = `${f.sourceStepIndex}:${f.sourceVariable}`;
          if (!fieldsByStepAndVar.has(key)) {
            fieldsByStepAndVar.set(key, []);
          }
          fieldsByStepAndVar.get(key)!.push(f);
          return;
        }
        if (f.value && typeof f.value === 'string' && f.value.trim() !== '') {
          inputs[f.key] = f.value;
        }
      });

      fieldsByStepAndVar.forEach((fieldsWithSameVar, compositeKey) => {
        const [stepIndex, sourceVariable] = compositeKey.split(':');
        const step = parseInt(stepIndex, 10);
        const combinedValue = fieldsWithSameVar
          .map(f => f.value)
          .filter(v => v && String(v).trim() !== '')
          .join(' ');

        if (combinedValue) {
          const scoped = scopedInputsByStep.get(step) || {};
          scoped[sourceVariable] = combinedValue;
          scopedInputsByStep.set(step, scoped);
        }
      });

      const hasQuery = inputs['query'] !== undefined;
      const hasPrompt1 = inputs['prompt1'] !== undefined;

      if (hasQuery) {
        if (!inputs['content']) inputs['content'] = inputs['query'];
        if (!inputs['prompt']) inputs['prompt'] = inputs['query'];
      } else if (hasPrompt1) {
        if (!inputs['content']) inputs['content'] = inputs['prompt1'];
        if (!inputs['query']) inputs['query'] = inputs['prompt1'];
        if (!inputs['prompt']) inputs['prompt'] = inputs['prompt1'];
      }

      collectionFields.forEach(f => {
        if (f.key.startsWith('prompt') && !inputs[f.key.replace('prompt', 'paste')]) {
          inputs[f.key.replace('prompt', 'paste')] = f.value;
        } else if (f.key.startsWith('paste') && !inputs[f.key.replace('paste', 'prompt')]) {
          inputs[f.key.replace('paste', 'prompt')] = f.value;
        }
      });

      const processSteps = (steps: any[]): any[] => {
        return steps.map((step: any, stepIndex: number) => {
          const newConfig = { ...step.config };

          if (step.moduleId === 'agent') {
            if (newConfig.prompts && newConfig.prompts.length > 0) {
              const promptValues = newConfig.prompts
                .map((p: any) => (inputs[p.key] !== undefined ? inputs[p.key] : ''))
                .filter((v: string) => v.trim() !== '');
              if (promptValues.length > 0) {
                newConfig.promptValue = promptValues.join('\n\n');
              }
            } else {
              const promptLabel = newConfig.promptLabel || '';
              if (promptLabel && inputs[promptLabel] !== undefined) {
                newConfig.promptValue = inputs[promptLabel];
              }
            }
            if (newConfig.supportImage) {
              newConfig.images = fieldImagesBase64;
            }
          }

          if (step.moduleId === 'paste') {
            const scopedInputs = scopedInputsByStep.get(stepIndex) || {};
            const paramKey = newConfig.paramKey || 'content';
            if (scopedInputs[paramKey] !== undefined) {
              newConfig.content = scopedInputs[paramKey];
            } else if (inputs[paramKey] !== undefined) {
              newConfig.content = inputs[paramKey];
            } else if (inputs['content'] !== undefined) {
              newConfig.content = inputs['content'];
            } else if (inputs['query'] !== undefined) {
              newConfig.content = inputs['query'];
            } else {
              const scopedValues = Object.values(scopedInputs).filter(v => typeof v === 'string' && v.trim() !== '');
              if (scopedValues.length > 0) {
                newConfig.content = scopedValues[0];
              } else {
                const providedValues = Object.values(inputs).filter(v => typeof v === 'string' && v.trim() !== '');
                if (providedValues.length === 1) {
                  newConfig.content = providedValues[0];
                }
              }
            }
          }

          if (step.moduleId === 'sub_automation' && Array.isArray(newConfig.steps)) {
            newConfig.steps = processSteps(newConfig.steps);
          }

          if (newConfig.isCloudModule) {
            if (fieldImagesBase64.length > 0) {
              newConfig.images = fieldImagesBase64;
            }
            if (Array.isArray(newConfig.variables)) {
              newConfig.variables.forEach((v: any) => {
                const vk = v.key || v.name;
                if (vk && inputs[vk] !== undefined) {
                  newConfig[vk] = inputs[vk];
                }
              });
            }
            const resolvedCloudInputs = resolveCloudModuleInputValues(
              {
                ...step,
                config: newConfig,
              },
              inputs,
              stepIndex,
            );
            Object.assign(newConfig, resolvedCloudInputs);
          }

          Object.keys(newConfig).forEach(key => {
            let val = newConfig[key];
            if (typeof val === 'string') {
              const scopedInputs = scopedInputsByStep.get(stepIndex) || {};
              val = val.replace(/(?:\{|%7B)([^}%]+)(?:\}|%7D)/gi, (match: string, content: string) => {
                let colonIndex = content.indexOf(':');
                let paramName = content;
                if (colonIndex !== -1) {
                  paramName = content.substring(colonIndex + 1);
                } else {
                  const pctColonIndex = content.indexOf('%3A');
                  if (pctColonIndex !== -1) {
                    paramName = content.substring(pctColonIndex + 3);
                  } else {
                    const lowerPctColonIndex = content.indexOf('%3a');
                    if (lowerPctColonIndex !== -1) {
                      paramName = content.substring(lowerPctColonIndex + 3);
                    }
                  }
                }

                let resolvedValue = '';
                if (scopedInputs[paramName] !== undefined) {
                  resolvedValue = scopedInputs[paramName];
                } else if (inputs[paramName] !== undefined) {
                  resolvedValue = inputs[paramName];
                } else {
                  const scopedValues = Object.values(scopedInputs).filter(
                    v => typeof v === 'string' && v.trim() !== '',
                  );
                  if (scopedValues.length === 1) {
                    resolvedValue = scopedValues[0];
                  } else {
                    const globalValues = Object.values(inputs).filter(v => typeof v === 'string' && v.trim() !== '');
                    if (globalValues.length === 1) {
                      resolvedValue = globalValues[0];
                    } else {
                      return match;
                    }
                  }
                }

                if (match.startsWith('%') || match.startsWith('%7b') || match.startsWith('%7B')) {
                  return encodeURIComponent(resolvedValue);
                }
                return resolvedValue;
              });

              const definedInputValues = Object.entries(scopedInputs)
                .map(([_, v]) => v)
                .filter(v => v && typeof v === 'string');
              if (definedInputValues.length > 1 && val === definedInputValues.join('')) {
                val = definedInputValues.join(' ');
              }
              newConfig[key] = val;
            }
          });

          return { ...step, config: newConfig };
        });
      };

      const processedSteps = processSteps(auto.steps);

      chrome.runtime.sendMessage({
        action: 'run_automation',
        automation: { ...auto, steps: processedSteps },
      });
    });

    openUrls(
      [...finalAgents, ...finalLinks],
      activeCollection.item.title || activeCollection.item.name || 'Collection',
    );
    resetAfterCommandExecution();
  }, [activeCollection, openUrls, selectedImages, resetAfterCommandExecution]);

  return (
    <div className="relative w-full">
      <div className="absolute bottom-full left-[12px] min-[1350px]:left-[12px] min-[1600px]:left-[14px] min-[1800px]:left-[16px] pb-2 z-20 flex items-center gap-2 pointer-events-auto">
        {renderPrefix()}
      </div>
      <div
        className={`w-full py-3 rounded-t-xl bg-[var(--color-inputBg)] border border-[#aeaeae] dark:border-white/10 backdrop-blur-xl shadow-none min-h-[48px] min-[1680px]:min-h-[56px] min-[1880px]:min-h-[60px]`}
        style={{ paddingLeft: `${dynamicLeftOffset}px` }}>
        <AutomationDataEntry
          headless
          isSingleField={activeCollection.fields.length === 1}
          dynamicLeftOffset={0}
          title={activeCollection.item?.name || activeCollection.item?.title || 'Automation'}
          automation={activeCollection.item?.automation || activeCollection.item}
          fields={activeCollection.fields as any}
          focusedFieldIndex={activeCollection.focusedFieldIndex || 0}
          onFieldChange={(idx, val) => {
            const nextFields = [...activeCollection.fields];
            nextFields[idx] = { ...nextFields[idx], value: val };
            setActiveCollection({ ...activeCollection, fields: nextFields });
          }}
          onFocusChange={idx => {
            setActiveCollection({ ...activeCollection, focusedFieldIndex: idx });
          }}
          onExecute={handleCollectionSubmit}
          onCancel={() => setActiveCollection(null)}
        />
      </div>
    </div>
  );
};
