/**
 * @file index.ts
 * @description Barrel export file for the AI Prompt editor module,
 * exposing the main editor view, hook, and database types/functions.
 * 
 * @usage
 * ```ts
 * import { AiPromptEditorView, useAiPromptEditor } from './aiPrompt';
 * ```
 */

export { AiPromptEditorView } from './ui/AiPromptEditorView';

export type { AiPromptEditorViewProps } from './ui/AiPromptEditorView';
export { useAiPromptEditor } from './useAiPromptEditor';
export { getAiPromptExecutionText, hasRunnableAiPrompt, runAiPrompt } from './runAiPrompt';
export type { RunAiPromptResult } from './runAiPrompt';
export * from './aiPromptHooks';
export type { AiPromptRecord, CreateAiPromptInput, UpdateAiPromptInput } from './aiPromptTypes';
