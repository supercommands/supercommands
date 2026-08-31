/**
 * @file aiPromptTypes.ts
 * @description Defines the typescript interfaces and types for AI Prompts.
 * These types include fields for workspaces, folders, tags, associated model URLs, and metadata.
 * 
 * @usage
 * ```ts
 * import type { AiPromptRecord, CreateAiPromptInput } from './aiPromptTypes';
 * ```
 */

export interface CustomModelConfig {
  id: string;
  name: string;
  host: string;
}

export interface AiPromptRecord {

  id: string;
  workspaceId: string;
  folderId: string | null;
  title: string;
  prompt: string;
  rules?: string;
  modelUrls: Record<string, string>;
  favIconUrl?: string;
  tagIds: string[];
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  customModels?: CustomModelConfig[];
  enabledModelIds?: string[];
}

export const AI_PROMPT_COMPARISON_FIELDS = ['id', 'workspaceId', 'folderId', 'title', 'prompt', 'rules', 'modelUrls', 'favIconUrl', 'tagIds', 'customModels', 'enabledModelIds', 'deletedAt'] as const satisfies readonly (keyof AiPromptRecord)[];

export interface CreateAiPromptInput {
  workspaceId?: string;
  folderId?: string | null;
  title: string;
  prompt: string;
  rules?: string;
  modelUrls: Record<string, string>;
  favIconUrl?: string;
  tagIds?: string[];
  customModels?: CustomModelConfig[];
  enabledModelIds?: string[];
}

export interface UpdateAiPromptInput {
  title?: string;
  prompt?: string;
  rules?: string;
  modelUrls?: Record<string, string>;
  favIconUrl?: string;
  workspaceId?: string;
  folderId?: string | null;
  tagIds?: string[];
  customModels?: CustomModelConfig[];
  enabledModelIds?: string[];
}
