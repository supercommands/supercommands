/**
 * @file index.tsx
 * @description The main AutomationBuilder React component (Beta). It provides
 * a drag-and-drop or click-to-add interface for assembling automations using steps/modules
 * (e.g., Open Tab, Click, Paste Content) and running them.
 * 
 * @usage
 * ```tsx
 * import AutomationBuilder from './automationBeta';
 * <AutomationBuilder onClose={handleClose} automationId={id} />
 * ```
 */

import type * as React from 'react';

import { useImperativeHandle, forwardRef, useMemo } from 'react';
import {
  FaTimes,
  FaMousePointer,
  FaPaste,
  FaExternalLinkAlt,
  FaPlus,
  FaCheckCircle,
} from 'react-icons/fa';
// Importing directly from AltS source to share logic/types
// @ts-ignore - Ignoring path adjustment issues for now, assuming monorepo structure allows access
import type { AutomationStep } from './utilities/automation';
import { runAutomation } from './utilities/automation';

import { useAutomationEditor } from './useAutomationEditor';
import { SharedPropertiesToolbar } from '../../../../shared-components/editorToolbar/SharedPropertiesToolbar';
import { getItemCompoundId } from '../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { useRelativeSavedTime } from '../../../../shared-components/utils';

interface AutomationBuilderProps {
  onClose: () => void;
  automationId?: string | null;
  initialTitle?: string;
  initialSteps?: AutomationStep[];
  onRenderConfig?: (config: React.ReactNode) => void;
  selectedStepId?: string | null;
  setSelectedStepId?: (id: string | null) => void;
}

export interface AutomationBuilderRef {
  handleSave: () => void;
}

// Fixed Modules for MVP
const MODULES = [
  { id: 'open_tab', name: 'Open New Tab', icon: FaExternalLinkAlt, color: 'text-blue-400', description: 'Open a new tab with a specific URL' },
  { id: 'click', name: 'Click', icon: FaMousePointer, color: 'text-green-400', description: 'Click an element on the page' },
  { id: 'paste', name: 'Paste Content', icon: FaPaste, color: 'text-emerald-400', description: 'Paste text into an input' },
];

const AutomationBuilder = forwardRef<AutomationBuilderRef, AutomationBuilderProps>(
  ({ onClose, automationId, initialTitle, initialSteps, onRenderConfig, selectedStepId, setSelectedStepId }, ref) => {
    
    const state = useAutomationEditor({
      automationId,
      onBack: onClose,
      initialDraftName: initialTitle,
      initialDraftSteps: initialSteps,
    });

    const automationCompoundId = useMemo(() => {
      if (!state.activeAutomationId) return '';

      return getItemCompoundId({
        id: state.activeAutomationId,
        workspace_id: state.workspaceId || undefined,
        folder_id: state.folderId || undefined,
        snippet: {
          id: state.activeAutomationId,
          category: 'automation',
        },
      });
    }, [state.activeAutomationId, state.workspaceId, state.folderId]);

    useImperativeHandle(ref, () => ({
      handleSave: () => state.handleSave(false),
    }));

    const handleAddModule = (module: (typeof MODULES)[0]) => {
      const newStep: AutomationStep = {
        id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        moduleId: module.id,
        config: {},
      };

      if (module.id === 'open_tab') {
        newStep.config = { url: '', fixedValue: '', dropdownOptions: '' };
      } else if (module.id === 'paste') {
        const existingPasteSteps = state.automationSteps.filter(s => s.moduleId === 'paste').length;
        const nextIndex = existingPasteSteps + 1;
        newStep.config = { content: `{paste${nextIndex}}`, fixedValue: '', dropdownOptions: '' };
      }

      state.setAutomationSteps([...state.automationSteps, newStep]);
      if (setSelectedStepId) setSelectedStepId(newStep.id);
    };

    const handleRun = async () => {
      if (state.automationSteps.length === 0) return;
      try {
        await runAutomation({
          id: 'temp',
          type: 'automation',
          name: state.automationName || 'Untitled',
          steps: state.automationSteps,
          inputs: undefined,
          timestamp: Date.now(),
        });
      } catch (e) {
        console.error('Execution failed');
      }
    };

    const initialProperties = useMemo(() => {
      return {
        workspaceId: state.workspaceId,
        folderId: state.folderId,
        tagIds: state.tagIds || [],
      };
    }, [state.workspaceId, state.folderId, state.tagIds]);

    const lastSavedMessage = useRelativeSavedTime(state.lastSavedAt);

    return (
      <div className="flex flex-col h-full w-full relative">
        {/* Header Status & Floating Actions */}
        <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
          <div className="transition-opacity duration-300">
            {state.saveStatus !== 'idle' && (
              <>
                {state.saveStatus === 'saving' && (
                  <span className="text-sm font-medium text-neutral-400">Saving...</span>
                )}
                {state.saveStatus === 'saved' && (
                  <span className="text-sm font-medium text-neutral-400 flex items-center gap-1">
                    {lastSavedMessage} <FaCheckCircle className="text-emerald-500" />
                  </span>
                )}
                {state.saveStatus === 'error' && (
                  <span className="text-sm font-medium text-red-500">Save Failed <FaTimes /></span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Floating Right-Side Action Capsule Toolbar */}
        <div className="absolute left-full top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-1 p-1 rounded-r-2xl rounded-l-none bg-[var(--color-editorBg)] border border-l-0 border-black/10 dark:border-white/15 shadow-lg">
          <SharedPropertiesToolbar
            initialSnippet={initialProperties}
            compoundId={automationCompoundId}
            defaultName={state.automationName}
            onChange={state.handlePropertiesChange}
            showTodo={false}
            todoStatus={'idle'}
            onCreateTodo={() => {}}
            snippetBreadCrum={null}
          />
        </div>

        {/* Input for Title */}
        <div className="px-4 pt-6 pb-2">
          <input
            value={state.automationName}
            onChange={e => state.setAutomationName(e.target.value)}
            placeholder="Title"
            className="w-full text-2xl font-bold bg-transparent border-none outline-none text-black dark:text-white placeholder-neutral-400"
          />
        </div>

        {/* Header Modules */}
        <div className="px-4 py-2 border-b border-neutral-200 dark:border-white/10 bg-neutral-50/50 dark:bg-white/5 flex justify-between items-center">
          <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">
            Modules
          </span>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => state.handleSave(false)}
              className="text-xs font-bold bg-blue-500 text-white px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors"
            >
              Save
            </button>
            <button 
              onClick={handleRun}
              className="text-xs font-bold bg-emerald-500 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-600 transition-colors"
            >
              Run
            </button>
            <button 
              onClick={state.handleClose}
              className="text-neutral-500 hover:text-neutral-800 dark:hover:text-white"
            >
              Close
            </button>
          </div>
        </div>

        {/* Module List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
          {MODULES.map(module => (
            <div
              key={module.id}
              onClick={() => handleAddModule(module)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all border border-transparent hover:bg-emerald-50 dark:hover:bg-emerald-900/10 cursor-pointer group">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center bg-neutral-50 dark:bg-white/5 shadow-sm group-hover:bg-white dark:group-hover:bg-white/10 transition-colors ${module.color}`}>
                <module.icon size={14} />
              </div>
              <div className="flex-1 text-left min-w-0 pr-2">
                <div className="font-bold text-[11px] text-neutral-700 dark:text-neutral-200 tracking-tight truncate">
                  {module.name}
                </div>
                <div className="text-[9px] text-neutral-400 font-medium truncate">{module.description}</div>
              </div>
              <div className="p-1 px-1.5 rounded-lg opacity-0 group-hover:opacity-100 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 transition-all">
                <FaPlus size={8} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
);

export default AutomationBuilder;
