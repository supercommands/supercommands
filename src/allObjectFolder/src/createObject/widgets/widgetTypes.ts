/**
 * @file widgetTypes.ts
 * @description Defines TypeScript interfaces and types for Widget entities,
 * spatial grid layouts, and dashboard view records in Dexie IndexedDB.
 */

export type WidgetSizePreset = 'small' | 'medium' | 'large';
export type WidgetExpansionMode = 'preset' | 'horizontal' | 'vertical' | 'free';
export type CollectionOpenBehavior = 'same_window' | 'focus_mode' | 'new_window' | 'respect_session';

export interface CollectionLaunchSettings {
  openBehavior: CollectionOpenBehavior;
}

export const DEFAULT_COLLECTION_LAUNCH_SETTINGS: CollectionLaunchSettings = {
  openBehavior: 'respect_session',
};

export const normalizeCollectionLaunchSettings = (
  value?: Partial<CollectionLaunchSettings> | null,
): CollectionLaunchSettings => {
  const openBehavior = value?.openBehavior;

  return {
    openBehavior:
      openBehavior === 'same_window' ||
      openBehavior === 'focus_mode' ||
      openBehavior === 'new_window' ||
      openBehavior === 'respect_session'
        ? openBehavior
        : DEFAULT_COLLECTION_LAUNCH_SETTINGS.openBehavior,
  };
};

export interface WidgetCustomSize {
  w: number;
  h: number;
}

export interface WidgetRecord {
  id: string;
  workspaceId: string;
  viewId: string;
  categoryId?: string;
  title: string;
  type: string;
  referenceId?: string;
  referenceType?: string;
  settings?: Record<string, unknown>;
  sizePreset: WidgetSizePreset;
  expansionMode: WidgetExpansionMode;
  customSize?: WidgetCustomSize;
  createdAt: number;
  updatedAt: number;
}

export interface WidgetLayoutRecord {
  id: string;
  workspaceId: string;
  viewId: string;
  widgetId: string;
  /** Backward-compatibility field retained to read and downgrade previously stored grid-v2 records. */
  gridVersion?: number;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  isDraggable?: boolean;
  isResizable?: boolean;
  static?: boolean;
  updatedAt: number;
}

export interface WidgetViewSettings {
  source?: 'onboarding' | 'manual' | string;
  role?: 'founder' | string;
  viewGroup?: 'work' | 'personal' | string;
  templateId?: string;
  templateVersion?: number;
  viewIconId?: string;
  [key: string]: unknown;
}

export interface WidgetViewRecord {
  id: string;
  workspaceId: string;
  title: string;
  isDefault?: boolean;
  collectionLaunchSettings?: CollectionLaunchSettings;
  settings?: WidgetViewSettings | Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}
