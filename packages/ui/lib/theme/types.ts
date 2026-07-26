export interface ThemeTokens {
  // Backgrounds
  appBg: string;
  rootBg: string;
  sidebarBg: string;
  contentBg: string;
  panelBg: string;
  modalBg: string;
  cardBg: string;
  inputBg: string;
  editorBg: string;
  containerBg: string;
  sheetBg: string;
  contextMenuBg: string;
  backdrop: string;
  popupBg: string;
  innerPopupBg: string;
  tutorialCardBg: string;
  iconDefault: string;
  snippetConfigBg: string;
  snippetChipBg: string;
  overlayBg: string;

  // Typography
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDisabled: string;
  textPlaceholder: string;
  textError: string;
  sectionCountText: string;

  // Borders
  borderDefault: string;
  borderActive: string;
  borderSelected: string;

  // Interactions
  hoverBg: string;
  selectedBg: string;
  activeBg: string;
  focusRing: string;

  // Accents
  accent: string;
  accentHover: string;

  // Statuses
  success: string;
  warning: string;
  error: string;
  info: string;

  // Onboarding/Tutorial card typography & accents
  tutorialTextTitle: string;
  tutorialTextGradientStart: string;
  tutorialTextGradientEnd: string;
  tutorialTextDescription: string;
  tutorialAccent: string;
  tutorialAccentMuted: string;
}

export interface ThemeWallpaper {
  src: string;
  opacity: number;
  blendMode?: string;
  blur?: string;
}

export interface ThemeProfile {
  id: string;
  name: string;
  isDark: boolean;
  tokens: ThemeTokens;
  wallpaper?: ThemeWallpaper;
  glassOpacity?: number;
  glassBlur?: string;
}
