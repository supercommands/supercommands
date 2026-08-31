/**
 * @file automationTypes.ts
 * @description Defines the TypeScript types and interfaces for the Automation entity,
 * including records, inputs, steps, and options for CRUD operations.
 * 
 * @usage
 * ```ts
 * import type { AutomationRecord, CreateAutomationInput } from './automationTypes';
 * ```
 */

import type { AutomationStep, AutomationInputDefinition } from './utilities/automation';


export interface AutomationRecord {
  id: string;
  workspaceId: string;
  folderId: string | null;
  
  name: string;
  steps: AutomationStep[];
  inputs?: AutomationInputDefinition[];
  tagIds: string[];
  
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export const AUTOMATION_COMPARISON_FIELDS = ['id', 'workspaceId', 'folderId', 'name', 'steps', 'inputs', 'tagIds', 'deletedAt'] as const satisfies readonly (keyof AutomationRecord)[];

export interface CreateAutomationInput {
  workspaceId?: string;
  folderId?: string | null;
  name: string;
  steps: AutomationStep[];
  inputs?: AutomationInputDefinition[];
  tagIds?: string[];
}

export interface UpdateAutomationInput {
  name?: string;
  steps?: AutomationStep[];
  inputs?: AutomationInputDefinition[];
  workspaceId?: string;
  folderId?: string | null;
  tagIds?: string[];
}
