export type WidgetSizePreset = 'small' | 'medium' | 'large';

export type WidgetExpansionMode = 'preset' | 'horizontal' | 'vertical' | 'free';

export type WidgetType =
  | 'default-commands'
  | 'note-item'
  | 'time'
  | 'news'
  | 'weather'
  | 'favorites'
  | 'todo-list'
  | 'quote-of-the-day'
  | 'daily-quote'
  | 'html'
  | 'generic';

export interface WidgetInstance {
  id: string;
  viewId: string;
  categoryId?: string;
  title: string;
  type?: WidgetType;
  noteId?: string;
  noteTitle?: string;
  noteBody?: string;
  settings?: Record<string, unknown>;
  sizePreset: WidgetSizePreset;
  expansionMode: WidgetExpansionMode;
  createdAt: number;
  updatedAt: number;
}

export interface WidgetGridPosition {
  i: string;
  viewId: string;
  categoryId?: string;
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
}

export interface WidgetDashboardView {
  id: string;
  title: string;
  isDefault?: boolean;
  settings?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface WidgetDashboardState {
  schemaVersion: 2;
  revision: number;
  activeViewId: string;
  views: WidgetDashboardView[];
  widgets: WidgetInstance[];
  layout: WidgetGridPosition[];
  updatedAt: number;
}
