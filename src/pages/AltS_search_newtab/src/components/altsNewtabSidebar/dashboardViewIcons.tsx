import * as React from 'react';
import {
  LuLayers3,
  LuCode,
  LuBookOpen,
  LuGraduationCap,
  LuBriefcase,
  LuFolder,
  LuNotebookPen,
  LuLightbulb,
  LuBrain,
  LuRocket,
  LuTarget,
  LuCalendarCheck,
  LuActivity,
  LuFlaskConical,
  LuPalette,
} from 'react-icons/lu';

export type DashboardViewIconId =
  | 'layers'
  | 'code'
  | 'book'
  | 'study'
  | 'work'
  | 'folder'
  | 'notes'
  | 'idea'
  | 'brain'
  | 'rocket'
  | 'target'
  | 'calendar'
  | 'analytics'
  | 'research'
  | 'design';

export interface DashboardViewIconDefinition {
  id: DashboardViewIconId;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export const DEFAULT_VIEW_ICON_ID: DashboardViewIconId = 'layers';

export const DASHBOARD_VIEW_ICONS: DashboardViewIconDefinition[] = [
  { id: 'layers', label: 'Layers', icon: LuLayers3 },
  { id: 'code', label: 'Code', icon: LuCode },
  { id: 'book', label: 'Book', icon: LuBookOpen },
  { id: 'study', label: 'Study', icon: LuGraduationCap },
  { id: 'work', label: 'Work', icon: LuBriefcase },
  { id: 'folder', label: 'Folder', icon: LuFolder },
  { id: 'notes', label: 'Notes', icon: LuNotebookPen },
  { id: 'idea', label: 'Idea', icon: LuLightbulb },
  { id: 'brain', label: 'Brain', icon: LuBrain },
  { id: 'rocket', label: 'Rocket', icon: LuRocket },
  { id: 'target', label: 'Target', icon: LuTarget },
  { id: 'calendar', label: 'Calendar', icon: LuCalendarCheck },
  { id: 'analytics', label: 'Analytics', icon: LuActivity },
  { id: 'research', label: 'Research', icon: LuFlaskConical },
  { id: 'design', label: 'Design', icon: LuPalette },
];

const iconMap = new Map<string, DashboardViewIconDefinition>(
  DASHBOARD_VIEW_ICONS.map(item => [item.id, item]),
);

export const normalizeDashboardViewIconId = (rawId?: unknown): DashboardViewIconId => {
  if (typeof rawId === 'string' && iconMap.has(rawId)) {
    return rawId as DashboardViewIconId;
  }
  return DEFAULT_VIEW_ICON_ID;
};

export const getDashboardViewIconComponent = (
  rawId?: unknown,
): React.ComponentType<{ size?: number; className?: string }> => {
  const normalized = normalizeDashboardViewIconId(rawId);
  return iconMap.get(normalized)?.icon || LuLayers3;
};

export interface DashboardViewIconProps {
  iconId?: unknown;
  size?: number;
  className?: string;
}

export const DashboardViewIcon: React.FC<DashboardViewIconProps> = ({
  iconId,
  size = 14,
  className = '',
}) => {
  const IconComponent = getDashboardViewIconComponent(iconId);
  return <IconComponent size={size} className={className} />;
};
