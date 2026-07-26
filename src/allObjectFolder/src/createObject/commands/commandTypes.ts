/**
 * @file commandTypes.ts
 * @description Defines the TypeScript types, interfaces, and type aliases for Command entities.
 * Includes definitions for command surface options (newtab, website, both) and behaviors.
 * 
 * @usage
 * ```ts
 * import type { CommandRecord, CreateCommandInput } from './commandTypes';
 * ```
 */

export type CommandSurface = 'newtab' | 'website' | 'both';

export type CommandBehavior = 'instant' | 'entity' | 'locked' | 'query';

export interface CommandRecord {
  id: string;
  label: string;
  prefix: string;
  behavior: CommandBehavior;
  surface?: CommandSurface;
  site?: string;
  pageType?: 'repository' | 'organization' | 'any';
  iconHost?: string;
  icon?: any;
  category?: string;
  type?: string;
  urlTemplate?: string;
  enabled?: boolean;
  showInDashboard?: boolean;
  updatedAt?: number;
}

export interface CreateCommandInput {
  id: string;
  label: string;
  prefix: string;
  behavior: CommandBehavior;
  surface?: CommandSurface;
  site?: string;
  pageType?: 'repository' | 'organization' | 'any';
  iconHost?: string;
  icon?: any;
  category?: string;
  type?: string;
  urlTemplate?: string;
  enabled?: boolean;
  showInDashboard?: boolean;
}

export interface UpdateCommandInput {
  label?: string;
  prefix?: string;
  behavior?: CommandBehavior;
  surface?: CommandSurface;
  site?: string;
  pageType?: 'repository' | 'organization' | 'any';
  iconHost?: string;
  icon?: any;
  category?: string;
  type?: string;
  urlTemplate?: string;
  enabled?: boolean;
  showInDashboard?: boolean;
}
