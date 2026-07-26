import type { AutomationStep } from './automation';
import { AutomationInputDefinition, extractCloudModuleInputDefinitions } from './automation';
import type { CloudVariableGroup, InlineParamConfig } from '../utilities/automationTypes';
import { CloudVariableGroupInput } from '../utilities/automationTypes';

export const formatParamBadgeName = (rawName: string) => {
  const lower = rawName.toLowerCase();
  if (lower === 'query' || lower === 'input') return 'Input';
  if (lower.startsWith('query') || lower.startsWith('input')) {
    const num = rawName.match(/\d+$/);
    return num ? `Input ${num[0]}` : 'Input';
  }
  return rawName
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
};

export const normalizeCloudVariable = (variable: any) => {
  const variableName = String(variable?.key || variable?.name || '');
  if (!variableName) return null;

  return {
    ...variable,
    key: variableName,
    name: variableName,
  };
};

export const buildCloudVariableGroups = (
  step: AutomationStep,
  stepIndex: number,
  cloudConfig: any,
  baseVariables: any[],
  customVariables: any[],
) => {
  const normalizedCustomVariables = customVariables.map(normalizeCloudVariable).filter(Boolean);
  const customVariableNames = new Set(normalizedCustomVariables.map((variable: any) => String(variable?.name || '')));
  const variableByName = new Map<string, any>();

  [...baseVariables, ...customVariables].forEach(variable => {
    const normalized = normalizeCloudVariable(variable);
    if (!normalized?.name) return;
    variableByName.set(String(normalized.name), normalized);
  });

  const variables = Array.from(variableByName.values());
  const groupedInputDefinitions = extractCloudModuleInputDefinitions(
    {
      ...step,
      config: {
        ...cloudConfig,
        isCloudModule: true,
        variables,
        execution_steps: cloudConfig.execution_steps || [],
      },
    },
    stepIndex,
  );

  const groups = new Map<string, CloudVariableGroup>();
  groupedInputDefinitions.forEach((definition, index) => {
    const variable = variableByName.get(definition.id);
    if (!variable) return;

    const groupId = definition.groupId || definition.id;
    const existing = groups.get(groupId);
    const nextInput = { variable, definition };

    if (!existing) {
      groups.set(groupId, {
        id: groupId,
        label: definition.groupLabel || 'Input',
        selector: definition.groupSelector,
        action: definition.groupAction,
        order: definition.order ?? index,
        inputs: [nextInput],
      });
      return;
    }

    existing.inputs.push(nextInput);
    existing.order = Math.min(existing.order, definition.order ?? index);
    if (!existing.selector && definition.groupSelector) existing.selector = definition.groupSelector;
    if (!existing.label && definition.groupLabel) existing.label = definition.groupLabel;
    if (!existing.action && definition.groupAction) existing.action = definition.groupAction;
  });

  if (groups.size === 0) {
    variables.forEach((variable: any, index) => {
      groups.set(variable.name, {
        id: variable.name,
        label: variable.type === 'image' ? 'Image Input' : 'Input',
        action: variable.type === 'image' ? 'inject_image' : 'insert_text',
        order: index,
        inputs: [
          {
            variable,
            definition: {
              id: variable.name,
              label: variable.label || variable.name,
              type: variable.type === 'image' ? 'image' : variable.type === 'dropdown' ? 'dropdown' : 'text',
              groupId: variable.groupId,
              groupLabel: variable.groupLabel,
              groupSelector: variable.groupSelector,
              groupAction: variable.groupAction,
              order: variable.order,
            },
          },
        ],
      });
    });
  }

  return {
    variables,
    customVariableNames,
    groupedVariables: Array.from(groups.values()).sort((a, b) => a.order - b.order),
  };
};

export const createCloudGroupVariable = (group: CloudVariableGroup, variables: any[]) => {
  const existingNames = new Set(
    variables.map(variable => String(variable?.name || variable?.key || '')).filter(Boolean),
  );
  const baseInput = group.inputs[0];
  const baseName = String(baseInput?.definition?.id || baseInput?.variable?.name || 'prompt').replace(/[^\w]/g, '_');
  const baseLabel = String(
    baseInput?.definition?.label || baseInput?.variable?.label || baseInput?.variable?.name || 'AI Prompt',
  ).trim();
  const maxOrder = group.inputs.reduce(
    (highest, input) => Math.max(highest, input.definition.order ?? group.order),
    group.order,
  );

  let suffix = Math.max(group.inputs.length + 1, 2);
  let nextName = `${baseName}${suffix}`;
  while (existingNames.has(nextName)) {
    suffix += 1;
    nextName = `${baseName}${suffix}`;
  }

  return {
    key: nextName,
    name: nextName,
    label: `${baseLabel} ${suffix}`,
    type: baseInput?.definition?.type === 'dropdown' ? 'dropdown' : 'long_text',
    required: false,
    placeholder: `Enter ${baseLabel} ${suffix}...`,
    groupId: group.id,
    groupLabel: group.label,
    groupSelector: group.selector,
    groupAction: group.action || 'insert_text',
    order: maxOrder + 1,
  };
};

export const canAddCloudVariableToGroup = (group: CloudVariableGroup) => {
  return group.action !== 'inject_image' && !group.inputs.some(input => input.definition.type === 'image');
};

export const getFaviconUrl = (host: string) => {
  return `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=${encodeURIComponent(
    `https://${host}`,
  )}&size=128`;
};

export const isStepConfiguredForSave = (step: AutomationStep): boolean => {
  const config = step.config || {};
  const hasText = (val: any) => typeof val === 'string' && val.trim().length > 0;
  const hasAnyValues = (values: any) => Array.isArray(values) && values.some(v => hasText(v));

  switch (step.moduleId) {
    case 'open_tab':
      return hasText(config.url);
    case 'agent':
      return hasText(config.promptLabel) || hasText(config.fixedValue) || hasText(config.dropdownOptions);
    case 'click':
      return hasText(config.selector) || hasText(config.selectorElementName);
    case 'paste':
      return hasText(config.content) || hasText(config.selector) || hasText(config.selectorElementName);
    case 'keystroke':
      return hasText(config.key) || hasText(config.text) || (config.config && hasText((config.config as any).key));
    case 'wait':
      return true;
    case 'clipboard_read':
    case 'cookies_clear':
      return true;
    case 'clipboard_write':
      return hasText(config.text);
    case 'link':
      return hasText(config.url) || hasText(config.name);
    case 'sub_automation':
      return hasText(config.name);
    default:
      if (Array.isArray(config.prompts)) {
        return config.prompts.some((p: any) => hasText(p.key) || hasAnyValues(p.values));
      }
      if (Array.isArray(config.inputs)) {
        return config.inputs.some((input: any) => hasText(input.fixedValue) || hasText(input.dropdownOptions));
      }
      return hasText(config.name);
  }
};

export const convertLegacyParams = (text: string, configs: Record<string, InlineParamConfig>) => {
  // 1. Handle untyped tokens: {name} -> {type:name}
  let result = text.replace(/\{([^}:\s]+)\}/g, (match, name) => {
    if (name.includes(':') || name.startsWith('input_name=')) return match;
    const type = configs[name]?.type || 'short_text';
    const displayType = type === 'short_text' ? 'text' : type;
    return `{${displayType}:${name}}`;
  });

  // 2. Sync existing typed tokens: {oldType:name} -> {newType:name}
  // This handles the case where the user changes the type in the popup
  result = result.replace(/\{([^}:\s]+):([^}\s]+)\}/g, (match, currentType, name) => {
    if (name.startsWith('input_name=')) return match; // Skip special input_name syntax
    const cfg = configs[name];
    if (cfg) {
      const displayType = cfg.type === 'short_text' ? 'text' : cfg.type;
      if (displayType !== currentType) {
        return `{${displayType}:${name}}`;
      }
    }
    return match;
  });

  return result;
};
