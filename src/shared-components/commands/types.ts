import React from 'react';
import type { WorkspaceData } from '../../settings/allWorkspaceManager/workspaces/workspaceTypes';
import type { FolderData } from '../../settings/allWorkspaceManager/folders/folderTypes';
import type { SnippetRecord } from '../../allObjectFolder/src/createObject/snippets/snippetTypes';

export type SearchPopupView =
  | { kind: 'home' }
  | { kind: 'noteEditor'; noteProps?: { onClose: () => void; category?: string } }
  | {
      kind: 'linkEditor';
      linkProps?: {
        onClose: () => void;
        mode?: 'create' | 'edit';
        initialSnippet?: SnippetRecord | null;
        initialWorkspace?: WorkspaceData | null;
        initialFolder?: FolderData | null;
        lockLocation?: boolean;
      };
    }
  | {
      kind: 'sessionEditor';
      sessionProps?: {
        onClose: () => void;
        mode?: 'create' | 'edit';
        initialSnippet?: SnippetRecord | null;
      };
    }
  | { kind: 'agentPanel'; agentProps?: { onClose: () => void } }
  | { kind: 'automationPanel'; automationProps?: { onClose: () => void } }
  | { kind: 'routineEditor'; routineProps?: { onClose: () => void } }
  | { kind: 'blank'; title?: string; message?: string }
  | { kind: 'custom'; element: React.ReactNode | (() => React.ReactNode) }
  | { kind: 'workspaceContent'; workspace: WorkspaceData; folder: FolderData | null }
  | { kind: 'store' }
  | { kind: 'moduleDetail'; moduleId: number }
  | { kind: 'commandList'; category?: string }

  | { kind: 'folderEditor'; folderProps?: { onClose: () => void; reload?: () => void } }
  | { kind: 'profile'; profileProps?: { onClose: () => void } }
  | { kind: 'organization'; organizationProps: { orgId: string; orgName: string; onClose?: () => void } }
  | {
      kind: 'createWorkspace';
      createOrgProps?: { onClose?: () => void; onSuccess?: (orgId: string, orgName: string) => void };
    }


  | { kind: 'allItems'; itemType: 'notes' | 'links' | 'organizations'; onClose?: () => void };

// Context passed to every command so it can interact with the app
export interface CommandContext {
  state: any;
  previouslySelectedFolder?: FolderData | null;
  services: {
    toast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
    navigation: (view: SearchPopupView) => void;
    reload: () => void;

    // UI state actions
    clearDraftAutomation: () => any;
    navigateToView: (view: any) => any;
    setPendingAgent: (agent: any) => any;
    setSelectedWorkspace: (workspace: any) => any;
    setSelectedFolder: (folder: any) => any;
    setSelectedSnippet: (snippet: any) => any;
    setIsAutoExpandMode: (isAutoExpand: boolean) => any;
    
    // Data actions

    // URLs
    urls: {
      dashboard: string;
      docs: string;
      profile: string;
    };
  };
  prompt?: string;
  files?: { base64: string; filename: string }[];
}

// Arguments for entity commands (when user selects a workspace/snippet/etc)
export interface EntitySelection {
  workspace?: WorkspaceData;
  folder?: FolderData | null;
  snippet?: SnippetRecord;
}

export type CommandBehavior = 'instant' | 'entity' | 'locked';
export type CommandScope = 'workspace' | 'folder' | 'snippet' | 'bookmark';
export type CommandAction = 'rename' | 'delete' | 'create' | 'edit';

// The Universal Command Interface
export interface CommandModule {
  // === Metadata ===
  id: string; // Unique identifier (e.g., 'createnotes')
  label: string; // Display name (e.g., 'Create Notes')
  prefix: string; // Command prefix (e.g., '/createnotes')
  keywords: string[]; // Search keywords (e.g., ['note', 'create'])
  description?: string; // Optional description for tooltips
  icon?: React.ReactNode | React.ComponentType<{ className?: string; size?: number }>; // Optional custom icon

  // === Behavior Configuration ===
  behavior: CommandBehavior;
  surface?: 'newtab' | 'website' | 'both';
  scope?: CommandScope; // For entity commands
  action?: CommandAction; // For entity commands

  // === Optional URL (for simple instant commands that just open a link) ===
  url?: string;

  // === Query Command Behavior ===
  urlTemplate?: string;
  iconHost?: string;
  autoSubmit?: string;
  hotkey?: string;

  // === The Execution Logic ===
  // This is where the magic happens - all logic in one place!
  execute?: (context: CommandContext, entity?: EntitySelection) => void | Promise<void>;

  // === Optional: Custom validation or pre-execution hooks ===
  canExecute?: (context: CommandContext, entity?: EntitySelection) => boolean;
  onBeforeExecute?: (context: CommandContext) => void | Promise<void>;

  // === Optional: Dynamic Label ===
  getDynamicLabel?: (context: CommandContext) => string;

  // === Optional Context Checks & Filtering ===
  showInDashboard?: boolean; // Set to false to exclude from standard dashboard listing
  category?: 'thissite_action' | string; // Optional category grouping
  isAvailable?: (webContext?: any) => boolean; // Determines if command should be shown based on webpage/active tab context
}
