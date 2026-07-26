import type { ThemeProfile } from './types';

export const defaultDarkTheme: ThemeProfile = {
  id: 'default-dark',
  name: 'Default Dark',
  isDark: true,
  tokens: {
    // Backgrounds
    appBg: '#000000',
    rootBg: '#000000',
    sidebarBg: '#080808',
    contentBg: 'transparent',
    panelBg: 'rgba(12, 12, 12, 0.32)',
    modalBg: 'rgba(12, 12, 12, 0.32)',
    cardBg: 'rgba(18, 18, 18, 0.55)',
    inputBg: '#171821',
    editorBg: '#171821',
    containerBg: '#171821',
    sheetBg: '#171821',
    contextMenuBg: '#080808',
    backdrop: 'blur(12px)',
    popupBg: '#080808',
    innerPopupBg: '#0c0c0c',
    tutorialCardBg: '#171821',
    iconDefault: '#9CA3AF',
    snippetConfigBg: '#262626', // neutral-800
    snippetChipBg: '#262626', // neutral-800
    overlayBg: 'rgba(0, 0, 0, 0.4)',

    // Typography
    textPrimary: '#FFFFFF',
    textSecondary: '#D4D4D4',
    textMuted: '#737373',
    textDisabled: 'rgba(255, 255, 255, 0.35)',
    textPlaceholder: '#A3A3A3',
    textError: '#EF4444',
    sectionCountText: '#9CA3AF',

    // Borders
    borderDefault: 'rgba(255, 255, 255, 0.1)',
    borderActive: 'rgba(255, 255, 255, 0.2)',
    borderSelected: '#3B82F6',

    // Interactions
    hoverBg: 'rgba(255, 255, 255, 0.05)',
    selectedBg: 'rgba(255, 255, 255, 0.07)',
    activeBg: 'rgba(255, 255, 255, 0.15)',
    focusRing: '#3B82F6',

    // Accents
    accent: '#3B82F6',
    accentHover: '#2563EB',

    // Statuses
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',

    // Onboarding/Tutorial card typography & accents
    tutorialTextTitle: '#FFFFFF',
    tutorialTextGradientStart: '#C084FC',
    tutorialTextGradientEnd: '#6366F1',
    tutorialTextDescription: '#9CA3AF',
    tutorialAccent: '#8B5CF6',
    tutorialAccentMuted: 'rgba(139, 92, 246, 0.15)',
  },
  glassOpacity: 0.5,
  glassBlur: '12px',
};

export const oceanBlueTheme: ThemeProfile = {
  ...defaultDarkTheme,
  id: 'ocean-blue',
  name: 'Ocean Blue',
  tokens: {
    ...defaultDarkTheme.tokens,
    // Backgrounds - Ocean Blue v1
    appBg: '#090e1a',
    rootBg: '#090e1a',
    sidebarBg: '#0e1320',
    panelBg: '#141a29',
    modalBg: '#1e273e',
    cardBg: '#101A2A',
    contextMenuBg: '#15243A',
    popupBg: '#15243A',
    innerPopupBg: '#1e273e',
    containerBg: '#0D1625',
    sheetBg: '#101B2D',
    editorBg: '#05080F',
    inputBg: '#111B2C',
    tutorialCardBg: '#122033',
    snippetConfigBg: '#0E1929',
    snippetChipBg: '#15243A',

    // Onboarding/Tutorial card typography & accents
    tutorialTextTitle: '#FFFFFF',
    tutorialTextGradientStart: '#C084FC',
    tutorialTextGradientEnd: '#6366F1',
    tutorialTextDescription: '#9CA3AF',
    tutorialAccent: '#8B5CF6',
    tutorialAccentMuted: 'rgba(139, 92, 246, 0.15)',
  },
  glassOpacity: 0.5,
  glassBlur: '12px',
};

export const themeRegistry: Record<string, ThemeProfile> = {
  'default-dark': defaultDarkTheme,
  'ocean-blue': oceanBlueTheme,
};

export function getTheme(id: string): ThemeProfile {
  return themeRegistry[id] || oceanBlueTheme;
}
