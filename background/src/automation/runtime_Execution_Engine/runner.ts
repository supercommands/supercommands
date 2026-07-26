/**
 * @file runner.ts
 * @description High-level engine for executing automated multi-step workflows.
 * Orchestrates complex automation sequences, translating abstract actions
 * (like 'click', 'insert_text', 'open_url') into concrete operations executed by the
 * interactionEngine. Handles variable resolution, waiting, state tracking, and
 * outcome validation for automation scripts.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * automationExecutor.ts — PHASE 1 REFACTORED
 *
 * The executor now talks ONLY to interactionEngine.
 * It does NOT know how any interaction is implemented.
 * Direct calls to chrome.debugger / robustClick / chrome.scripting
 * are removed from this file entirely — they live inside interactionEngine.
 *
 * Architecture:
 *   executeAction() → interactionEngine.method(ctx)
 *                              ↓
 *                   existing implementation (unchanged behavior)
 */

import {
  type RobustModuleAction,
  type SelectorFingerprint,
  type ExpectedOutcome,
  buildFingerprintInPage,
  isDynamicSelector,
} from '../domSelector/engine';
import { interactionEngine } from './index';

// ─────────────────────────────────────────────────────────────────────────────
// Re-export the original types so nothing else needs to change
// ─────────────────────────────────────────────────────────────────────────────

export type ModuleActionBase =
  | 'open_url'
  | 'open_tab'
  | 'click'
  | 'insert_text'
  | 'key_press'
  | 'press_key'
  | 'wait_for_element'
  | 'wait_duration'
  | 'scroll_to_element'
  | 'hover'
  | 'select_option'
  | 'clear_input'
  | 'extract_text'
  | 'close_tab'
  | 'execute_js'
  | 'inject_image'
  | 'if_exists'
  | 'checkbox_toggle'
  | 'clipboard_read'
  | 'clipboard_write'
  | 'clipboard_paste'
  | 'cookies_clear';

export type ModuleActionName = ModuleActionBase | `${ModuleActionBase}_v${number}`;

// Use RobustModuleAction as the canonical action type (it's a superset)
export type ModuleAction = RobustModuleAction & {
  action: ModuleActionName;
  text?: string;
  content?: string;
  url?: string;
};

export interface ModuleDefinition {
  module_id: string;
  name: string;
  execution_steps: ModuleAction[];
  version: number;
}

// --- Legacy Interfaces (for compatibility) ---

interface BgAutomationStep {
  id: string;
  moduleId: string;
  config: any;
  subSteps?: BgAutomationStep[];
}

interface BgSavedAutomation {
  id: string;
  type: 'automation';
  name: string;
  steps: BgAutomationStep[];
  timestamp: number;
}

export type AutoSubmitRequest = {
  kind: 'chatgpt' | 'claude' | 'gemini' | 'perplexity' | 'mistral' | 'copilot' | 'google' | 'calendar' | 'drive';
  prompt: string;
  images?: Array<{
    base64: string;
    mimeType: string;
    filename: string;
  }>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

let isStopRequested = false;
chrome.storage.local.get(['stop_automation_requested']).then(res => {
  isStopRequested = !!res.stop_automation_requested;
});
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.stop_automation_requested) {
    isStopRequested = changes.stop_automation_requested.newValue;
  }
});

const smartWait = async (ms: number) => {
  if (isStopRequested) throw new AutomationStoppedError();

  return new Promise<void>((resolve, reject) => {
    let timeoutId: any;

    const listener = (changes: any, area: string) => {
      if (area === 'local' && changes.stop_automation_requested?.newValue) {
        clearTimeout(timeoutId);
        chrome.storage.onChanged.removeListener(listener);
        reject(new AutomationStoppedError());
      }
    };

    chrome.storage.onChanged.addListener(listener);

    timeoutId = setTimeout(() => {
      chrome.storage.onChanged.removeListener(listener);
      if (isStopRequested) {
        reject(new AutomationStoppedError());
      } else {
        resolve();
      }
    }, ms);
  });
};

// --- Global State ---
export const pendingAutoSubmitTabs = new Map<number, AutoSubmitRequest>();

// --- Status & Control State ---
class AutomationStoppedError extends Error {
  constructor() {
    super('Automation stopped by user');
    this.name = 'AutomationStoppedError';
  }
}

/**
 * Sets a flag in local storage to request stopping the currently running automation.
 */
export const stopCurrentAutomation = async () => {
  await chrome.storage.local.set({ stop_automation_requested: true });
};

const checkIfStopRequested = async () => {
  if (isStopRequested) {
    throw new AutomationStoppedError();
  }
};

const updateAutomationStatus = async (status: any, tabId?: number) => {
  try {
    await chrome.storage.local.set({
      active_automation_status: {
        ...status,
        targetTabId: tabId,
      },
    });
  } catch (err) {
    console.error('[AutomationExecutor] Failed to update storage status:', err);
  }
};

const getStepDescription = (step: BgAutomationStep) => {
  if (step.config?.name) return step.config.name;

  const id = step.moduleId || (step as any).module_id;
  if (!id) return 'Executing Step';
  if (id === 'open_tab' || id === 'open_url') return `Opening ${step.config?.url || 'URL'}`;
  if (id === 'click') return `Clicking element`;
  if (id === 'keystroke' || id === 'insert_text') return `Typing text`;
  if (id === 'paste') return `Pasting content`;
  if (id === 'agent') return `Running AI Agent`;
  if (id === 'wait_duration') return `Waiting...`;

  // For cloud modules, try to use the module name if available
  return `Executing ${id.replace(/_/g, ' ')}`;
};

const ACTION_VERSION_RE = /^(.*)_v(\d+)$/;
const getActionBase = (action: ModuleActionName): ModuleActionBase => {
  const m = action.match(ACTION_VERSION_RE);
  return (m ? m[1] : action) as ModuleActionBase;
};

const resolveValue = (val: string | undefined, inputs: Record<string, any>): string => {
  if (!val) return '';
  return val.replace(/\{([^}\s)]+)\}/g, (match, variable) =>
    inputs[variable] !== undefined ? String(inputs[variable]) : match,
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTE: attachDebugger and enrichFingerprint are now in interactionEngine.
// The executor no longer has any direct chrome.debugger calls.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Key event helper (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────

const getKeyEventParams = (shortcut: string) => {
  const parts = shortcut.split('+').map(p => p.trim().toLowerCase());
  const mainKey = parts[parts.length - 1];

  let modifiers = 0;
  if (parts.includes('alt')) modifiers |= 1;
  if (parts.includes('ctrl') || parts.includes('control')) modifiers |= 2;
  if (parts.includes('meta') || parts.includes('cmd') || parts.includes('command')) modifiers |= 4;
  if (parts.includes('shift')) modifiers |= 8;

  let windowsVirtualKeyCode = 0;
  let code = '';
  let key = '';

  if (mainKey.length === 1) {
    const upper = mainKey.toUpperCase();
    windowsVirtualKeyCode = upper.charCodeAt(0);
    code = `Key${upper}`;
    key = upper;
    if (mainKey >= '0' && mainKey <= '9') {
      code = `Digit${mainKey}`;
      key = mainKey;
      windowsVirtualKeyCode = mainKey.charCodeAt(0);
    }
  } else {
    const MAP: Record<string, [number, string, string]> = {
      enter: [13, 'Enter', 'Enter'],
      tab: [9, 'Tab', 'Tab'],
      backspace: [8, 'Backspace', 'Backspace'],
      escape: [27, 'Escape', 'Escape'],
      esc: [27, 'Escape', 'Escape'],
      space: [32, 'Space', ' '],
      arrowup: [38, 'ArrowUp', 'ArrowUp'],
      arrowdown: [40, 'ArrowDown', 'ArrowDown'],
      arrowleft: [37, 'ArrowLeft', 'ArrowLeft'],
      arrowright: [39, 'ArrowRight', 'ArrowRight'],
      delete: [46, 'Delete', 'Delete'],
    };
    const mapped = MAP[mainKey];
    if (mapped) {
      [windowsVirtualKeyCode, code, key] = mapped;
    } else {
      console.warn(`[Automation] Unknown key: ${mainKey}, defaulting to Enter`);
      windowsVirtualKeyCode = 13;
      code = 'Enter';
      key = 'Enter';
    }
  }

  return { windowsVirtualKeyCode, code, key, modifiers };
};

// ─────────────────────────────────────────────────────────────────────────────
// Core action executor — updated click & insert_text use robust engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Executes a single atomic automation action (e.g., click, type, navigate) within a specified tab.
 * Resolves any variables in the action parameters using the provided inputs.
 *
 * @param tabId The ID of the tab where the action should be executed.
 * @param rawAction The action definition containing the operation type and parameters.
 * @param inputs Key-value pairs for variable resolution within the action parameters.
 * @returns {Promise<number>} The ID of the tab (which may have changed, e.g., if a new tab was opened).
 */
export const executeAction = async (
  tabId: number,
  rawAction: ModuleAction,
  inputs: Record<string, any>,
): Promise<number> => {
  await checkIfStopRequested();
  const target = { tabId };
  const baseAction = getActionBase(rawAction.action);
  const resolvedValue = resolveValue(rawAction.value, inputs);

  // ── Auto-enrich with fingerprint if selector looks dynamic ────────────────
  const action = await interactionEngine.enrichFingerprint(tabId, rawAction);
  await checkIfStopRequested();
  switch (baseAction) {
    case 'open_url':
    case 'open_tab': {
      const url = resolveValue(action.url, inputs);
      // PHASE 6 BUGFIX: Reuse current tab if we have one, otherwise open new
      if (tabId && tabId > 0) {
        const result = await interactionEngine.navigate({ tabId, url });
        return result.tabId ?? tabId;
      } else {
        const result = await interactionEngine.openTab({ url });
        return result.tabId ?? tabId;
      }
    }

    // ── wait_for_element ─────────────────────────────────────────────────────
    case 'wait_for_element': {
      await interactionEngine.waitForElement({ tabId, target, action, timeout: action.timeout_ms || 10000 });
      return tabId;
    }

    // ── click ─────────────────────────────────────────────────────────────────
    case 'click': {
      const result = await interactionEngine.click({ tabId, target, action, timeout: action.timeout_ms || 8000 });
      if (result.status === 'failed') {
        console.warn(
          `[AutomationEngine] click failed: ${result.error}`,
          `Primary: ${action.selector}`,
          action.selectorFingerprint
            ? `Fingerprint strategies: ${action.selectorFingerprint.semantic.join(', ')}`
            : 'No fingerprint — consider re-recording this step.',
        );
      }
      break;
    }

    // ── insert_text ───────────────────────────────────────────────────────────
    case 'insert_text': {
      const result = await interactionEngine.type({
        tabId,
        target,
        action,
        value: resolvedValue,
        timeout: action.timeout_ms || 8000,
      });
      if (result.status === 'failed') {
        console.warn(`[AutomationEngine] insert_text failed: ${result.error}`, `Primary: ${action.selector}`);
      }
      break;
    }

    // ── clipboard_paste ───────────────────────────────────────────────────────
    case 'clipboard_paste': {
      const result = await interactionEngine.clipboardRead({
        tabId,
        target,
        action,
        timeout: action.timeout_ms || 8000,
      });
      if (result.status === 'failed') {
        console.warn(`[AutomationEngine] clipboard_paste failed: ${result.error}`);
      }
      break;
    }

    // ── inject_image ──────────────────────────────────────────────────────────
    case 'inject_image': {
      const images = inputs.images || [];
      await interactionEngine.upload({ tabId, target, action, images });
      break;
    }

    // ── wait_duration ─────────────────────────────────────────────────────────
    case 'wait_duration': {
      await interactionEngine.waitForState({ tabId, action, ms: action.ms || 1000 });
      break;
    }

    case 'key_press':
    case 'press_key': {
      // 1. Resolve the key/text value (support variables like {input_key})
      const rawKey = action.key || action.text || (action as any).config?.key || resolvedValue || 'Enter';
      const keyToSend = resolveValue(rawKey, inputs);
      // Robust Modifier Resolution — Merge from both the key string and explicit modifiers
      let mods = 0;

      // A. Extract from key string (e.g. "Alt+U")
      if (typeof keyToSend === 'string') {
        const p = keyToSend.toLowerCase();
        if (p.includes('alt+')) mods |= 1;
        if (p.includes('ctrl+') || p.includes('control+')) mods |= 2;
        if (p.includes('meta+') || p.includes('cmd+') || p.includes('command+')) mods |= 4;
        if (p.includes('shift+')) mods |= 8;
      }

      // B. Add from explicit modifiers field (highest priority/reliability)
      const rawMods: any = action.modifiers;
      if (typeof rawMods === 'number') {
        mods |= rawMods;
      } else if (typeof rawMods === 'string') {
        const num = parseInt(rawMods, 10);
        if (!isNaN(num)) {
          mods |= num;
        } else {
          const p = rawMods.toLowerCase();
          if (p.includes('alt')) mods |= 1;
          if (p.includes('ctrl') || p.includes('control')) mods |= 2;
          if (p.includes('meta') || p.includes('cmd') || p.includes('command')) mods |= 4;
          if (p.includes('shift')) mods |= 8;
        }
      }

      await interactionEngine.keyboard({
        tabId,
        target,
        action, // Pass the full action so it can use the selector/fingerprint if present
        key: keyToSend,
        modifiers: mods > 0 ? mods : undefined,
      });
      break;
    }

    // ── execute_js ────────────────────────────────────────────────────────────
    case 'execute_js': {
      await interactionEngine.executeScript({ tabId, target, action, code: action.code || '' });
      break;
    }

    // ── scroll_to_element ─────────────────────────────────────────────────────
    case 'scroll_to_element': {
      await interactionEngine.scroll({ tabId, target, action });
      break;
    }

    // ── clipboard_write ───────────────────────────────────────────────────────
    case 'clipboard_write': {
      const textToWrite = resolveValue(action.text || action.content, inputs);
      await interactionEngine.clipboardWrite({ tabId, target, text: textToWrite });
      break;
    }

    // ── cookies_clear ─────────────────────────────────────────────────────────
    case 'cookies_clear': {
      await interactionEngine.cookies.clear({ tabId });
      break;
    }
  }

  // ── PHASE 6: Outcome-Aware Validation ──────────────────────────────────────
  if (action.expectedOutcome) {
    const start = Date.now();
    const timeout = action.expectedOutcome.timeout_ms || 5000;
    let validated = false;
    while (Date.now() - start < timeout) {
      await checkIfStopRequested();

      const res = await interactionEngine.validateState({
        tabId,
        expected: {
          url_contains: action.expectedOutcome.type === 'url_change' ? action.expectedOutcome.text : undefined,
          element_present:
            action.expectedOutcome.type === 'element_appear' ? action.expectedOutcome.selector : undefined,
          element_absent:
            action.expectedOutcome.type === 'element_disappear' ? action.expectedOutcome.selector : undefined,
          text_present: action.expectedOutcome.type === 'text_present' ? action.expectedOutcome.text : undefined,
        },
      });

      if (res.status === 'success') {
        validated = true;
        break;
      }
      await new Promise(r => setTimeout(r, 500));
    }

    if (!validated) {
      console.warn(`[AutomationExecutor] ✗ Validation failed for outcome: ${action.expectedOutcome.type}`);

      // Step 3: Trigger Protection Detection on failure
      const prot = await interactionEngine.detectProtectedFlow({ tabId });
      if (prot.status === 'failed') {
        throw new Error(`Automation blocked: ${prot.error}`);
      }

      throw new Error(
        `Outcome validation failed: ${action.expectedOutcome.type}. The page did not reach the expected state.`,
      );
    }
  }

  return tabId;
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API: capture fingerprint at recording time
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call this when the user selects/records an element in the extension UI.
 * Stores the fingerprint alongside the plain selector so playback is robust.
 *
 * Usage:
 *   const enriched = await captureFingerprint(tabId, selectedSelector);
 *   // store enriched.selectorFingerprint in the module step
 */
export const captureFingerprint = async (
  tabId: number,
  selector: string,
): Promise<{ selector: string; selectorFingerprint: SelectorFingerprint | null }> => {
  try {
    // Use chrome.scripting.executeScript instead of CDP debugger,
    // so we don't attach the debugger during recording/selection.
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (primarySel: string) => {
        // Inline fingerprint builder — mirrors buildFingerprintInPage logic
        const querySelectorDeep = (sel: string, root: any = document): Element | null => {
          if (!sel) return null;
          const parts = sel.split(' >>> ');
          let current: any = root;
          for (const part of parts) {
            if (!part.trim()) continue;
            const found = current.querySelector(part);
            if (found) {
              current = found.shadowRoot || found;
            } else {
              return null;
            }
          }
          return current instanceof ShadowRoot ? null : current;
        };

        const origEl = querySelectorDeep(primarySel);
        if (!origEl) return null;

        const el = origEl as HTMLElement;
        const stable: string[] = [];

        // data-testid, aria-label, name, placeholder, etc.
        for (const attr of [
          'data-testid',
          'data-cy',
          'data-qa',
          'data-id',
          'data-name',
          'data-empty-text',
          'data-placeholder',
          'aria-placeholder',
        ]) {
          const v = el.getAttribute(attr);
          if (v) stable.push(`[${attr}="${v}"]`);
        }

        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) stable.push(`[aria-label="${ariaLabel}"]`);

        const name = el.getAttribute('name');
        if (name && !/^[0-9]/.test(name)) stable.push(`${el.tagName.toLowerCase()}[name="${name}"]`);

        const id = el.id;
        if (id && !/^[a-z0-9]{8,}$/i.test(id) && !/^\d/.test(id)) stable.push(`#${id}`);

        const placeholder = el.getAttribute('placeholder');
        if (placeholder) stable.push(`[placeholder="${placeholder}"]`);

        const type = el.getAttribute('type');
        const role = el.getAttribute('role') || el.tagName.toLowerCase();
        if (type) stable.push(`${el.tagName.toLowerCase()}[type="${type}"]`);

        if (el.getAttribute('contenteditable') === 'true') {
          stable.push('[contenteditable="true"]');
        }
        if (el.getAttribute('role')) {
          stable.push(`[role="${el.getAttribute('role')}"]`);
        }

        const text = ((el.textContent || '').trim() || ariaLabel || placeholder || '').trim().slice(0, 60);
        const textBasedTag = el.tagName.toLowerCase();
        if (text && ['button', 'a', 'label'].includes(textBasedTag) && text.length < 60) {
          stable.push(`__TEXT__:${textBasedTag}:${text}`);
        }

        let ancestor: HTMLElement | null = el.parentElement;
        let ancestorSelector: string | null = null;
        while (ancestor && ancestor !== document.body) {
          for (const attr of ['data-testid', 'data-cy', 'data-qa', 'id']) {
            const v = ancestor.getAttribute(attr);
            if (v && attr === 'id' && !/^[a-z0-9]{8,}$/i.test(v)) {
              ancestorSelector = `#${v}`;
              break;
            }
            if (v && attr !== 'id') {
              ancestorSelector = `[${attr}="${v}"]`;
              break;
            }
          }
          if (ancestorSelector) break;
          ancestor = ancestor.parentElement;
        }

        return {
          primary: primarySel,
          semantic: stable,
          textContent: text || undefined,
          ancestorSelector: ancestorSelector || undefined,
          role: role || undefined,
          tagName: el.tagName.toLowerCase(),
          inputType: type || undefined,
        };
      },
      args: [selector],
    });

    const fp: SelectorFingerprint | null = results?.[0]?.result ?? null;

    if (fp) {
    }

    return { selector, selectorFingerprint: fp };
  } catch (e) {
    console.warn('[SelectorEngine] captureFingerprint failed:', e);
    return { selector, selectorFingerprint: null };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// handleOpenTab, executeModule, executeAutomation — unchanged from original
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Opens a new tab with the specified URL and waits for it to finish loading.
 *
 * @param config Configuration object containing the URL to open.
 * @returns {Promise<number>} The ID of the newly opened tab.
 */
export const handleOpenTab = (config: { url?: string }): Promise<number> =>
  new Promise((resolve, reject) => {
    const url = config.url ? (config.url.startsWith('http') ? config.url : `https://${config.url}`) : 'about:blank';
    chrome.tabs.create({ url, active: true }, tab => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      const tabId = tab.id!;

      if (isStopRequested) {
        reject(new AutomationStoppedError());
        return;
      }

      const stopListener = (changes: any, area: string) => {
        if (area === 'local' && changes.stop_automation_requested?.newValue) {
          chrome.tabs.onUpdated.removeListener(listener);
          chrome.storage.onChanged.removeListener(stopListener);
          reject(new AutomationStoppedError());
        }
      };
      chrome.storage.onChanged.addListener(stopListener);

      const listener = (tid: number, info: chrome.tabs.TabChangeInfo) => {
        if (tid === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          chrome.storage.onChanged.removeListener(stopListener);
          setTimeout(() => resolve(tabId), 2500);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  });

/**
 * Executes a predefined module consisting of multiple sequential automation actions.
 *
 * @param module The module definition containing execution steps.
 * @param inputs Inputs for variable resolution across the module's steps.
 * @param startingTabId The ID of the tab to start execution in (defaults to 0, which may trigger finding an active tab).
 * @returns {Promise<number>} The final active tab ID after module execution.
 */
export const executeModule = async (
  module: ModuleDefinition,
  inputs: Record<string, any>,
  startingTabId: number = 0,
): Promise<number> => {
  let activeTabId = startingTabId;
  try {
    for (const step of module.execution_steps) {
      await checkIfStopRequested();

      if (step.condition) {
        const m = step.condition.match(/^has_variable:(.+)$/);
        if (m) {
          const varName = m[1];
          const hasVar =
            varName === 'image' || varName === 'images' ? inputs.images && inputs.images.length > 0 : !!inputs[varName];
          if (!hasVar) continue;
        }
      }
      activeTabId = await executeAction(activeTabId, step, inputs);
      await smartWait(800);
    }
  } catch (err) {
    console.error(`[AutomationEngine] Module ${module.module_id} failed:`, err);
  }
  return activeTabId;
};

/**
 * Legacy Agent handler (kept for backward compatibility with older automations).
 */
const handleAgentStep = async (config: any, activeTabId: number = 0): Promise<number> => {
  const detectAgentKind = (u: string) => {
    if (u.includes('chatgpt.com')) return 'chatgpt';
    if (u.includes('claude.ai')) return 'claude';
    if (u.includes('gemini.google.com')) return 'gemini';
    if (u.includes('perplexity.ai')) return 'perplexity';
    return null;
  };

  const getCleanUrl = (u: string) => {
    const raw = u.startsWith('http') ? u : `https://${u}`;
    return raw.replace(/[?&]cmd_select_status=(true|false)/g, '');
  };

  const prompt = config.prompts?.[0]?.values?.[0] || config.promptValue || config.prompt || config.fixedValue || '';
  const images = config.images || [];

  // 1. Support for multi-AI agents (allAiUrls)
  if (config.allAiUrls) {
    const allUrls = Object.values(config.allAiUrls) as string[];
    // Filter for active ones (default to all if no status markers found)
    const hasStatusMarkers = allUrls.some(u => u.includes('cmd_select_status='));
    const activeUrls = hasStatusMarkers ? allUrls.filter(u => u.includes('cmd_select_status=true')) : allUrls;

    if (activeUrls.length > 0) {
      let lastTabId = 0;
      for (const raw of activeUrls) {
        const url = getCleanUrl(raw);
        const kind = detectAgentKind(url);

        const tabId = await new Promise<number>(resolve => {
          chrome.tabs.create({ url, active: true }, tab => {
            if (kind && (prompt || images.length > 0)) {
              pendingAutoSubmitTabs.set(tab.id!, { kind: kind as any, prompt, images });
            }
            resolve(tab.id!);
          });
        });
        lastTabId = tabId;
      }
      return lastTabId;
    }
  }

  // 2. Legacy single agent logic
  const rawUrl = config.url || '';
  const url = getCleanUrl(rawUrl);

  // Try to find if this is a cloud-managed module first
  const result = await chrome.storage.local.get(['installed_modules']);
  const modules: ModuleDefinition[] = result.installed_modules || [];

  // Logic: if agentId maps to a cloud moduleId, use the new engine!
  const cloudModule = modules.find(m => m.module_id === config.agentId || m.module_id === config.id);
  if (cloudModule) {
    return await executeModule(cloudModule, { prompt, images }, activeTabId);
  }

  const kind = detectAgentKind(url);
  if (kind && (prompt || images.length > 0)) {
    return new Promise(resolve => {
      chrome.tabs.create({ url, active: true }, tab => {
        pendingAutoSubmitTabs.set(tab.id!, { kind: kind as any, prompt, images });
        resolve(tab.id!);
      });
    });
  }
  return handleOpenTab({ url });
};

/**
 * Orchestrates the execution of a high-level user-saved automation workflow.
 * Manages the overall status, loops through high-level steps, triggers modules/agents,
 * and handles error reporting and cleanup.
 *
 * @param automation The saved automation configuration.
 */
export const executeAutomation = async (automation: BgSavedAutomation) => {
  await chrome.storage.local.set({ stop_automation_requested: false });

  const result = await chrome.storage.local.get(['installed_modules']);
  const installedModules: ModuleDefinition[] = result.installed_modules || [];

  let currentTabId: number | undefined;
  const detachTabs = new Set<number>();
  const totalSteps = automation.steps.length;
  let i = 0;

  // Try to grab the current tab immediately if we're starting on an active tab
  if (!currentTabId) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTabId = tabs[0]?.id;
  }

  try {
    // 0. Trigger credit usage API if it's a custom automation (not an installed module)
    if (!automation.id || !automation.id.startsWith('module-')) {
    }

    await updateAutomationStatus(
      {
        status: 'running',
        name: automation.name,
        currentStep: 0,
        totalSteps,
        stepName: 'Starting...',
      },
      currentTabId,
    );

    for (i = 0; i < totalSteps; i++) {
      const step = automation.steps[i];
      await checkIfStopRequested();
      await updateAutomationStatus(
        {
          status: 'running',
          name: automation.name,
          currentStep: i + 1,
          totalSteps,
          stepName: getStepDescription(step),
        },
        currentTabId,
      );

      // 1. Check if it's a Cloud Module (installed)
      const module = installedModules.find(m => m.module_id === step.moduleId);
      if (module) {
        const inputs = step.config || {};
        currentTabId = await executeModule(module, inputs, currentTabId);
        // Immediate update after possible tab change
        await updateAutomationStatus(
          {
            status: 'running',
            name: automation.name,
            currentStep: i + 1,
            totalSteps,
            stepName: getStepDescription(step),
          },
          currentTabId,
        );
        continue;
      }

      // 1b. Cloud module embedded in step config (not found in installed_modules but config has execution_steps)
      if (step.config?.isCloudModule && Array.isArray(step.config.execution_steps)) {
        const inlineModule: ModuleDefinition = {
          module_id: step.moduleId,
          name: step.config.name || step.moduleId,
          execution_steps: step.config.execution_steps,
          version: step.config.version || 1,
        };
        const inputs = step.config || {};
        currentTabId = await executeModule(inlineModule, inputs, currentTabId);
        // Immediate update after possible tab change
        await updateAutomationStatus(
          {
            status: 'running',
            name: automation.name,
            currentStep: i + 1,
            totalSteps,
            stepName: getStepDescription(step),
          },
          currentTabId,
        );
        continue;
      }

      // 2. Fallback to Legacy Primitives or Agent
      if (step.moduleId === 'open_tab' || step.moduleId === 'open_url') {
        const url = step.config?.url || '';
        if (currentTabId && currentTabId > 0) {
          const result = await interactionEngine.navigate({ tabId: currentTabId, url });
          if (result.tabId) currentTabId = result.tabId;
        } else {
          const openResult = await interactionEngine.openTab({ url });
          if (openResult.tabId) currentTabId = openResult.tabId;
        }
        // Immediate update after navigation
        await updateAutomationStatus(
          {
            status: 'running',
            name: automation.name,
            currentStep: i + 1,
            totalSteps,
            stepName: getStepDescription(step),
          },
          currentTabId,
        );
      } else if (step.moduleId === 'agent') {
        currentTabId = await handleAgentStep(step.config, currentTabId);
        // Immediate update after agent possibly opens tab
        await updateAutomationStatus(
          {
            status: 'running',
            name: automation.name,
            currentStep: i + 1,
            totalSteps,
            stepName: getStepDescription(step),
          },
          currentTabId,
        );
      } else if (['click', 'keystroke', 'paste'].includes(step.moduleId)) {
        if (!currentTabId) {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          currentTabId = tabs[0]?.id;
        }
        if (currentTabId) {
          detachTabs.add(currentTabId);
          // Map legacy steps to new ModuleActions
          if (step.moduleId === 'click') {
            await executeAction(currentTabId, { action: 'click', selector: step.config.selector }, {});
          } else if (step.moduleId === 'keystroke') {
            const key = step.config.key || step.config.text || 'Enter';
            await executeAction(
              currentTabId,
              {
                action: 'key_press',
                key,
                modifiers: step.config.modifiers,
                selector: step.config.selector || step.config.selectorFingerprint?.primary,
              },
              {},
            );
          } else if (step.moduleId === 'paste') {
            // First click to focus/activate
            await executeAction(currentTabId, { action: 'click', selector: step.config.selector }, {});
            await smartWait(200);

            let pasteContent = step.config.content;
            if (!pasteContent || pasteContent === '""') {
              const storage = await chrome.storage.local.get('last_search_query');
              if (storage.last_search_query) {
                pasteContent = storage.last_search_query;
              }
            }

            // Then insert text
            await executeAction(
              currentTabId,
              {
                action: 'insert_text',
                selector: step.config.selector,
                value: pasteContent,
                method: 'cdp_insert_text',
              },
              {},
            );
          }
        }
      }

      await smartWait(1000);
    }

    // Success state
    await updateAutomationStatus(
      {
        status: 'completed',
        name: automation.name,
        currentStep: totalSteps,
        totalSteps,
        stepName: 'Completed successfully',
      },
      currentTabId,
    );
  } catch (error: any) {
    if (error.name === 'AutomationStoppedError') {
      await updateAutomationStatus(
        {
          status: 'stopped',
          name: automation.name,
          stepName: 'Stopped the automation',
        },
        currentTabId,
      );
      return;
    }

    console.error('[AutomationExecutor] Execution failed:', error);

    // Find where we were if possible
    const currentStepNum = i + 1;

    await updateAutomationStatus(
      {
        status: 'error',
        name: automation.name,
        error: error?.message || String(error),
        stepName: `Failed on Step ${currentStepNum}`,
      },
      currentTabId,
    );
    // 3. Cleanup: detach debugger from all tabs used during this run
    for (const tabId of detachTabs) {
      interactionEngine.detachDebugger(tabId);
    }

    // 4. Delayed status cleanup: clear the "completed" or "error" status from storage after 5s
    // so the UI overlay/progress bar disappears automatically.
    setTimeout(async () => {
      try {
        await chrome.storage.local.remove('active_automation_status');
      } catch (err) {
        console.error('[AutomationExecutor] Status cleanup failed:', err);
      }
    }, 5000);
  }
};

/**
 * Handles scheduled executions of automations triggered by chrome alarms.
 *
 * @param alarm The alarm object triggering the execution.
 */
export async function handleAutomationAlarm(alarm: chrome.alarms.Alarm) {
  const automationId = alarm.name.replace('automation_', '');
  try {
    const { automations } = await chrome.storage.local.get(['automations']);
    const automation = automations ? automations[automationId] : null;
    if (automation && automation.steps) {
      await executeAutomation(automation);
    } else {
      console.error('[Background] Automation not found for scheduled alarm:', automationId);
    }
  } catch (err) {
    console.error('[Background] Failed to execute scheduled automation:', err);
  }
}
