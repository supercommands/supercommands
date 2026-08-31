import type { ThemeProfile, ThemeTokens, ThemeTint } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Shared base tokens
// ─────────────────────────────────────────────────────────────────────────────

const darkBase: ThemeProfile['tokens'] = {
  // Backgrounds
  appBg: '#000000',
  rootBg: '#000000',
  sidebarBg: '#080808',
  appSidebarBg: 'transparent',
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
  noteLibraryIcon: '#9CA3AF',
  snippetConfigBg: '#262626',
  snippetChipBg: '#262626',
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
  // Tutorial
  tutorialTextTitle: '#FFFFFF',
  tutorialTextGradientStart: '#C084FC',
  tutorialTextGradientEnd: '#6366F1',
  tutorialTextDescription: '#9CA3AF',
  tutorialAccent: '#8B5CF6',
  tutorialAccentMuted: 'rgba(139, 92, 246, 0.15)',
  // Widget
  widgetBg: 'rgba(255, 255, 255, 0.14)',
  widgetInnerBg: 'rgba(255, 255, 255, 0.055)',
  widgetBorder: 'rgba(255, 255, 255, 0.07)',
  widgetShadow: 'rgba(0, 0, 0, 0.22)',
  widgetToolbarBg: 'rgba(255, 255, 255, 0.14)',
  widgetToolbarBorder: 'rgba(255, 255, 255, 0.05)',
  widgetToolbarShadow: 'rgba(0, 0, 0, 0.16)',
  widgetToolbarText: '#FFFFFF',
  widgetToolbarMutedText: 'rgba(255, 255, 255, 0.68)',
  widgetToolbarActiveBg: 'rgba(255, 255, 255, 0.92)',
  widgetToolbarHoverBg: 'rgba(255, 255, 255, 0.12)',
  widgetDragPlaceholderBg: 'rgba(45, 45, 45, 0.58)',
  widgetDragShadow: 'rgba(0, 0, 0, 0.60)',
  widgetDragOutline: 'rgba(255, 255, 255, 0.18)',
  // Diff
  diffAddedBg: 'rgba(16, 185, 129, 0.15)',
  diffAddedBgStrong: 'rgba(16, 185, 129, 0.35)',
  diffAddedText: '#34D399',
  diffAddedBorder: 'rgba(16, 185, 129, 0.3)',
  diffRemovedBg: 'rgba(239, 68, 68, 0.15)',
  diffRemovedBgStrong: 'rgba(239, 68, 68, 0.35)',
  diffRemovedText: '#F87171',
  diffRemovedBorder: 'rgba(239, 68, 68, 0.3)',
  diffModifiedBg: 'rgba(245, 158, 11, 0.15)',
  diffModifiedText: '#FBBF24',
  diffModifiedBorder: 'rgba(245, 158, 11, 0.3)',
  diffMovedBg: 'rgba(59, 130, 246, 0.15)',
  diffMovedText: '#60A5FA',
  diffMovedBorder: 'rgba(59, 130, 246, 0.3)',
  diffGutterBg: 'rgba(255, 255, 255, 0.03)',
  diffLineNumberText: '#6B7280',
  searchBarBg: 'var(--color-widgetBg)',
  searchBarBorder: 'transparent',
  searchBarShadow: '0 4px 10px rgba(0, 0, 0, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.012)',
  searchBarText: 'rgba(255, 255, 255, 0.88)',
  searchBarPlaceholder: 'rgba(255, 255, 255, 0.52)',
  searchBarIcon: 'rgba(255, 255, 255, 0.52)',
  searchBarKbdBg: 'rgba(255, 255, 255, 0.045)',
  searchBarKbdBorder: 'rgba(255, 255, 255, 0.055)',
  searchBarKbdText: 'rgba(255, 255, 255, 0.62)',
  altsPopupBg: '#191919',
  altsSearchBg: '#191919',
  altsListBg: '#191919',
  altsRowHoverBg: '#303030',
  altsRowSelectedBg: '#252626',
  altsBorderColor: '#393a3e',
  altsDividerColor: '#393a3e',
  altsFocusColor: 'rgba(255, 255, 255, 0.12)',
  altsSelectedEdge: 'rgba(255, 255, 255, 0.018)',
  altsTextPrimary: '#dedede',
  altsTextSecondary: '#a3a3a8',
  altsTextSection: '#8d8d92',
  altsTextPlaceholder: '#8b8b90',
  altsIconColor: '#ffffff',
  altsIconSelected: '#ffffff',
  altsShortcutText: '#bcbcc1',
  altsShortcutBg: 'transparent',
  altsShortcutBorder: 'transparent',
  altsIconTileSaveBg: 'rgba(255, 255, 255, 0.08)',
  altsIconTileSaveFg: '#ffffff',
  altsIconTileSaveSelectedBg: 'rgba(255, 255, 255, 0.14)',
  altsIconTileSaveSelectedFg: '#ffffff',
  altsIconTileAiBg: '#6D28D9',
  altsIconTileAiFg: '#ffffff',
  altsIconTileAiSelectedBg: '#6D28D9',
  altsIconTileAiSelectedFg: '#ffffff',
  altsIconTileSummarizeBg: '#EA580C',
  altsIconTileSummarizeFg: '#ffffff',
  altsIconTileSummarizeSelectedBg: '#EA580C',
  altsIconTileSummarizeSelectedFg: '#ffffff',
  altsIconTileCaptureBg: '#0891B2',
  altsIconTileCaptureFg: '#ffffff',
  altsIconTileCaptureSelectedBg: '#0891B2',
  altsIconTileCaptureSelectedFg: '#ffffff',
  altsIconTileExtractBg: '#E11D48',
  altsIconTileExtractFg: '#ffffff',
  altsIconTileExtractSelectedBg: '#E11D48',
  altsIconTileExtractSelectedFg: '#ffffff',
  altsIconTileActionBg: '#1D4ED8',
  altsIconTileActionFg: '#ffffff',
  altsIconTileActionSelectedBg: '#1D4ED8',
  altsIconTileActionSelectedFg: '#ffffff',
  altsScrollbarThumb: 'rgba(255, 255, 255, 0)',
  altsScrollbarThumbHover: 'rgba(255, 255, 255, 0.22)',
  altsPopupShadow: 'none',
};

const lightBase: ThemeProfile['tokens'] = {
  // Backgrounds
  appBg: '#F0F4F8',
  rootBg: '#F0F4F8',
  sidebarBg: '#F0F4F8',
  appSidebarBg: 'transparent',
  contentBg: 'transparent',
  panelBg: 'rgba(255, 255, 255, 0.90)',
  modalBg: 'rgba(255, 255, 255, 0.96)',
  cardBg: 'rgba(255, 255, 255, 0.92)',
  inputBg: 'rgba(255, 255, 255, 0.96)',
  editorBg: 'rgba(255, 255, 255, 0.96)',
  containerBg: 'rgba(255, 255, 255, 0.94)',
  sheetBg: 'rgba(255, 255, 255, 0.97)',
  contextMenuBg: 'rgba(255, 255, 255, 0.98)',
  backdrop: 'blur(12px)',
  popupBg: 'rgba(255, 255, 255, 0.98)',
  innerPopupBg: 'rgba(248, 248, 248, 0.98)',
  tutorialCardBg: 'rgba(255, 255, 255, 0.96)',
  iconDefault: '#6B7280',
  noteLibraryIcon: '#111827',
  snippetConfigBg: '#F3F4F6',
  snippetChipBg: '#E5E7EB',
  overlayBg: 'rgba(0, 0, 0, 0.25)',
  // Typography
  textPrimary: '#111827',
  textSecondary: '#374151',
  textMuted: '#6B7280',
  textDisabled: 'rgba(17, 24, 39, 0.40)',
  textPlaceholder: '#9CA3AF',
  textError: '#DC2626',
  sectionCountText: '#6B7280',
  // Borders
  borderDefault: 'rgba(0, 0, 0, 0.12)',
  borderActive: 'rgba(0, 0, 0, 0.25)',
  borderSelected: '#6366F1',
  // Interactions
  hoverBg: 'rgba(0, 0, 0, 0.05)',
  selectedBg: 'rgba(0, 0, 0, 0.08)',
  activeBg: 'rgba(0, 0, 0, 0.13)',
  focusRing: '#6366F1',
  // Accents
  accent: '#6366F1',
  accentHover: '#4F46E5',
  // Statuses
  success: '#059669',
  warning: '#D97706',
  error: '#DC2626',
  info: '#3B82F6',
  // Tutorial
  tutorialTextTitle: '#111827',
  tutorialTextGradientStart: '#6366F1',
  tutorialTextGradientEnd: '#8B5CF6',
  tutorialTextDescription: '#6B7280',
  tutorialAccent: '#6366F1',
  tutorialAccentMuted: 'rgba(99, 102, 241, 0.12)',
  // Widget
  widgetBg: 'rgba(255, 255, 255, 0.86)',
  widgetInnerBg: 'rgba(15, 23, 42, 0.028)',
  widgetBorder: 'rgba(15, 23, 42, 0.055)',
  widgetShadow: 'rgba(15, 23, 42, 0.10)',
  widgetToolbarBg: 'rgba(255, 255, 255, 0.86)',
  widgetToolbarBorder: 'rgba(15, 23, 42, 0.05)',
  widgetToolbarShadow: 'rgba(15, 23, 42, 0.065)',
  widgetToolbarText: '#111827',
  widgetToolbarMutedText: 'rgba(17, 24, 39, 0.60)',
  widgetToolbarActiveBg: 'rgba(255, 255, 255, 0.90)',
  widgetToolbarHoverBg: 'rgba(0, 0, 0, 0.04)',
  widgetDragPlaceholderBg: 'rgba(60, 60, 80, 0.18)',
  widgetDragShadow: 'rgba(0, 0, 0, 0.22)',
  widgetDragOutline: 'rgba(255, 255, 255, 0.72)',
  // Diff
  diffAddedBg: 'rgba(5, 150, 105, 0.14)',
  diffAddedBgStrong: 'rgba(5, 150, 105, 0.30)',
  diffAddedText: '#065F46',
  diffAddedBorder: 'rgba(5, 150, 105, 0.35)',
  diffRemovedBg: 'rgba(220, 38, 38, 0.12)',
  diffRemovedBgStrong: 'rgba(220, 38, 38, 0.28)',
  diffRemovedText: '#991B1B',
  diffRemovedBorder: 'rgba(220, 38, 38, 0.35)',
  diffModifiedBg: 'rgba(217, 119, 6, 0.12)',
  diffModifiedText: '#92400E',
  diffModifiedBorder: 'rgba(217, 119, 6, 0.35)',
  diffMovedBg: 'rgba(59, 130, 246, 0.12)',
  diffMovedText: '#1E40AF',
  diffMovedBorder: 'rgba(59, 130, 246, 0.35)',
  diffGutterBg: 'rgba(0, 0, 0, 0.03)',
  diffLineNumberText: '#9CA3AF',
  searchBarBg: 'rgba(255, 255, 255, 0.96)',
  searchBarBorder: 'rgba(0, 0, 0, 0.12)',
  searchBarShadow: 'none',
  searchBarText: '#111827',
  searchBarPlaceholder: '#9CA3AF',
  searchBarIcon: '#6B7280',
  searchBarKbdBg: 'rgba(0, 0, 0, 0.05)',
  searchBarKbdBorder: 'rgba(0, 0, 0, 0.1)',
  searchBarKbdText: '#374151',
  altsPopupBg: '#ffffff',
  altsSearchBg: '#ffffff',
  altsListBg: '#ffffff',
  altsRowHoverBg: '#e5e5e5',
  altsRowSelectedBg: '#e5e5e5',
  altsBorderColor: 'rgba(20, 20, 24, 0.12)',
  altsDividerColor: 'rgba(20, 20, 24, 0.08)',
  altsFocusColor: 'rgba(20, 20, 24, 0.16)',
  altsSelectedEdge: 'rgba(20, 20, 24, 0.055)',
  altsTextPrimary: '#1e1e1e',
  altsTextSecondary: '#6f7078',
  altsTextSection: '#80818a',
  altsTextPlaceholder: '#8a8b93',
  altsIconColor: '#1f1f23',
  altsIconSelected: '#1f1f23',
  altsShortcutText: '#5c5d66',
  altsShortcutBg: 'transparent',
  altsShortcutBorder: 'transparent',
  altsIconTileSaveBg: 'rgba(20, 20, 24, 0.06)',
  altsIconTileSaveFg: '#1e293b',
  altsIconTileSaveSelectedBg: 'rgba(20, 20, 24, 0.12)',
  altsIconTileSaveSelectedFg: '#1e293b',
  altsIconTileAiBg: '#7C3AED',
  altsIconTileAiFg: '#ffffff',
  altsIconTileAiSelectedBg: '#7C3AED',
  altsIconTileAiSelectedFg: '#ffffff',
  altsIconTileSummarizeBg: '#FF7A00',
  altsIconTileSummarizeFg: '#ffffff',
  altsIconTileSummarizeSelectedBg: '#FF7A00',
  altsIconTileSummarizeSelectedFg: '#ffffff',
  altsIconTileCaptureBg: '#06B6D4',
  altsIconTileCaptureFg: '#ffffff',
  altsIconTileCaptureSelectedBg: '#06B6D4',
  altsIconTileCaptureSelectedFg: '#ffffff',
  altsIconTileExtractBg: '#F43F5E',
  altsIconTileExtractFg: '#ffffff',
  altsIconTileExtractSelectedBg: '#F43F5E',
  altsIconTileExtractSelectedFg: '#ffffff',
  altsIconTileActionBg: '#2563EB',
  altsIconTileActionFg: '#ffffff',
  altsIconTileActionSelectedBg: '#2563EB',
  altsIconTileActionSelectedFg: '#ffffff',
  altsScrollbarThumb: 'rgba(20, 20, 24, 0)',
  altsScrollbarThumbHover: 'rgba(20, 20, 24, 0.22)',
  altsPopupShadow: 'none',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper factory
// ─────────────────────────────────────────────────────────────────────────────

export interface ThemeOverrides {
  id?: string;
  name?: string;
  familyId?: string;
  wallpaper?: ThemeProfile['wallpaper'];
  glassOpacity?: number;
  glassBlur?: string;
  warmTint?: ThemeTint;
  brightness?: ThemeProfile['brightness'];
  pattern?: ThemeProfile['pattern'];
  tokens: Partial<ThemeTokens> & { backgroundGradient: string };
}

function makeDark(overrides: ThemeOverrides): ThemeProfile {
  const { tokens: tokenOverrides, ...profileOverrides } = overrides;
  return {
    id: profileOverrides.id || 'dark-theme',
    name: profileOverrides.name || 'Dark Theme',
    ...profileOverrides,
    isDark: true,
    pattern: 'scattered-dots',
    glassOpacity: 0.90,
    glassBlur: '12px',
    warmTint: overrides.warmTint || { color: '#FFD98A', opacity: 0.10 },
    brightness: overrides.brightness || { maximumSourceLevel: 85 },
    tokens: {
      ...darkBase,
      ...tokenOverrides,
    },
  };
}

function makeLight(overrides: ThemeOverrides): ThemeProfile {
  const { tokens: tokenOverrides, ...profileOverrides } = overrides;
  return {
    id: profileOverrides.id || 'light-theme',
    name: profileOverrides.name || 'Light Theme',
    ...profileOverrides,
    isDark: false,
    pattern: 'none',
    glassOpacity: 0.94,
    glassBlur: '18px',
    warmTint: overrides.warmTint || { color: '#FFD98A', opacity: 0.07 },
    brightness: overrides.brightness || { maximumSourceLevel: 65 },
    tokens: {
      ...lightBase,
      ...tokenOverrides,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Aurora Glow
// ─────────────────────────────────────────────────────────────────────────────

export const auroraGlowDarkTheme: ThemeProfile = makeDark({
  id: 'aurora-glow-dark',
  familyId: 'aurora-glow',
  name: 'Aurora Glow',
  tokens: {
    backgroundGradient: 'linear-gradient(180deg, #0B1026 0%, #29234F 52%, #61364F 100%)',
    rootBg: '#0B1026',
    appBg: '#0B1026',
    sidebarBg: '#12102e',
    appSidebarBg: 'transparent',
    contentBg: 'transparent',
    panelBg: 'rgba(22, 18, 54, 0.95)',
    modalBg: 'rgba(28, 22, 62, 0.97)',
    cardBg: 'rgba(24, 20, 56, 0.90)',
    inputBg: 'rgba(16, 13, 38, 0.97)',
    editorBg: 'rgba(16, 13, 38, 0.97)',
    containerBg: 'rgba(18, 15, 42, 0.94)',
    sheetBg: 'rgba(22, 18, 52, 0.96)',
    contextMenuBg: 'rgba(30, 24, 68, 0.98)',
    popupBg: 'rgba(30, 24, 68, 0.98)',
    innerPopupBg: 'rgba(26, 21, 56, 0.98)',
    tutorialCardBg: 'rgba(24, 20, 56, 0.96)',
    snippetConfigBg: 'rgba(18, 15, 44, 0.97)',
    snippetChipBg: 'rgba(28, 22, 60, 0.96)',
    overlayBg: 'rgba(5, 3, 20, 0.58)',
    iconDefault: '#B4A8E0',
    textPrimary: '#F4F2FF',
    textSecondary: '#CEC8F0',
    textMuted: '#8F89B8',
    textDisabled: 'rgba(244, 242, 255, 0.38)',
    textPlaceholder: '#7A74A0',
    textError: '#F87171',
    sectionCountText: '#8F89B8',
    borderDefault: 'rgba(190, 170, 255, 0.16)',
    borderActive: 'rgba(190, 170, 255, 0.28)',
    borderSelected: '#A79CFF',
    hoverBg: 'rgba(150, 130, 255, 0.08)',
    selectedBg: 'rgba(150, 130, 255, 0.13)',
    activeBg: 'rgba(150, 130, 255, 0.20)',
    focusRing: '#A79CFF',
    accent: '#A79CFF',
    accentHover: '#BDB5FF',
    success: '#4DDBAE',
    warning: '#FFD166',
    error: '#F87171',
    info: '#A79CFF',
    tutorialTextTitle: '#F4F2FF',
    tutorialTextGradientStart: '#A79CFF',
    tutorialTextGradientEnd: '#E8A2C4',
    tutorialTextDescription: '#CEC8F0',
    tutorialAccent: '#A79CFF',
    tutorialAccentMuted: 'rgba(167, 156, 255, 0.16)',
    widgetDragPlaceholderBg: 'rgba(20, 16, 50, 0.65)',
    widgetDragShadow: 'rgba(5, 3, 20, 0.65)',
    widgetDragOutline: 'rgba(167, 156, 255, 0.40)',
    diffAddedBg: 'rgba(77, 219, 174, 0.16)',
    diffAddedBgStrong: 'rgba(77, 219, 174, 0.36)',
    diffAddedText: '#5CF2C2',
    diffAddedBorder: 'rgba(77, 219, 174, 0.32)',
    diffRemovedBg: 'rgba(248, 113, 113, 0.16)',
    diffRemovedBgStrong: 'rgba(248, 113, 113, 0.36)',
    diffRemovedText: '#FFA1B0',
    diffRemovedBorder: 'rgba(248, 113, 113, 0.32)',
    diffModifiedBg: 'rgba(255, 209, 102, 0.16)',
    diffModifiedText: '#FFE085',
    diffModifiedBorder: 'rgba(255, 209, 102, 0.32)',
    diffMovedBg: 'rgba(167, 156, 255, 0.16)',
    diffMovedText: '#BDB5FF',
    diffMovedBorder: 'rgba(167, 156, 255, 0.32)',
    diffGutterBg: 'rgba(244, 242, 255, 0.04)',
    diffLineNumberText: '#7A74A0',
  },
});

export const auroraGlowLightTheme: ThemeProfile = makeLight({
  id: 'aurora-glow-light',
  familyId: 'aurora-glow',
  name: 'Aurora Glow',
  tokens: {
    backgroundGradient: 'linear-gradient(180deg, #8178F2 0%, #E8A2C4 52%, #FFD8B5 100%)',
    rootBg: '#C8A0DA',
    appBg: '#C8A0DA',
    sidebarBg: '#fffaff',
    appSidebarBg: 'transparent',
    contentBg: 'transparent',
    panelBg: 'rgba(255, 252, 255, 0.90)',
    modalBg: 'rgba(255, 253, 255, 0.96)',
    cardBg: 'rgba(255, 252, 255, 0.92)',
    inputBg: 'rgba(255, 253, 255, 0.96)',
    editorBg: 'rgba(255, 253, 255, 0.96)',
    containerBg: 'rgba(255, 252, 255, 0.94)',
    sheetBg: 'rgba(255, 253, 255, 0.97)',
    contextMenuBg: 'rgba(255, 253, 255, 0.98)',
    popupBg: 'rgba(255, 253, 255, 0.98)',
    innerPopupBg: 'rgba(249, 246, 252, 0.98)',
    tutorialCardBg: 'rgba(255, 252, 255, 0.96)',
    snippetConfigBg: '#F7F3FB',
    snippetChipBg: '#EDE8F6',
    overlayBg: 'rgba(64, 48, 96, 0.28)',
    iconDefault: '#5035BA',
    textPrimary: '#180D38',
    textSecondary: '#321F5B',
    textMuted: '#4C3978',
    textDisabled: 'rgba(24, 13, 56, 0.40)',
    textPlaceholder: '#7261A4',
    textError: '#BD1E63',
    sectionCountText: '#4C3978',
    borderDefault: 'rgba(24, 13, 56, 0.18)',
    borderActive: 'rgba(69, 37, 184, 0.65)',
    borderSelected: '#4525B8',
    hoverBg: 'rgba(220, 200, 255, 0.60)',
    selectedBg: 'rgba(210, 185, 255, 0.78)',
    activeBg: 'rgba(196, 166, 255, 0.88)',
    focusRing: '#4525B8',
    accent: '#4525B8',
    accentHover: '#371D9B',
    success: '#2FBF7A',
    warning: '#C98C1A',
    error: '#BD1E63',
    info: '#4525B8',
    tutorialTextTitle: '#180D38',
    tutorialTextGradientStart: '#2B127A',
    tutorialTextGradientEnd: '#7B0C4A',
    tutorialTextDescription: '#3B286C',
    tutorialAccent: '#4525B8',
    tutorialAccentMuted: 'rgba(69, 37, 184, 0.14)',
    widgetBg: 'rgba(255, 252, 255, 0.56)',
    widgetBorder: 'rgba(255, 255, 255, 0.76)',
    widgetShadow: 'rgba(80, 56, 140, 0.18)',
    widgetToolbarBg: 'rgba(48, 38, 96, 0.90)',
    widgetToolbarBorder: 'rgba(255, 255, 255, 0.32)',
    widgetToolbarShadow: 'rgba(40, 28, 80, 0.28)',
    widgetToolbarText: '#FAF8FF',
    widgetToolbarMutedText: 'rgba(250, 248, 255, 0.72)',
    widgetToolbarActiveBg: 'rgba(255, 253, 255, 0.96)',
    widgetToolbarHoverBg: 'rgba(220, 200, 255, 0.22)',
    widgetDragPlaceholderBg: 'rgba(70, 52, 128, 0.22)',
    widgetDragShadow: 'rgba(48, 34, 100, 0.28)',
    widgetDragOutline: 'rgba(255, 255, 255, 0.78)',
    diffAddedBg: 'rgba(47, 191, 122, 0.14)',
    diffAddedBgStrong: 'rgba(47, 191, 122, 0.30)',
    diffAddedText: '#155E35',
    diffAddedBorder: 'rgba(47, 191, 122, 0.38)',
    diffRemovedBg: 'rgba(192, 37, 107, 0.12)',
    diffRemovedBgStrong: 'rgba(192, 37, 107, 0.28)',
    diffRemovedText: '#8C1448',
    diffRemovedBorder: 'rgba(192, 37, 107, 0.38)',
    diffModifiedBg: 'rgba(201, 140, 26, 0.12)',
    diffModifiedText: '#7B4A06',
    diffModifiedBorder: 'rgba(201, 140, 26, 0.38)',
    diffMovedBg: 'rgba(117, 104, 232, 0.12)',
    diffMovedText: '#3E2FA8',
    diffMovedBorder: 'rgba(117, 104, 232, 0.38)',
    diffGutterBg: 'rgba(0, 0, 0, 0.03)',
    diffLineNumberText: '#8880B8',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Cherry Blossom
// ─────────────────────────────────────────────────────────────────────────────

export const cherryBlossomDarkTheme: ThemeProfile = makeDark({
  id: 'cherry-blossom-dark',
  familyId: 'cherry-blossom',
  name: 'Cherry Blossom',
  tokens: {
    backgroundGradient: 'linear-gradient(180deg, #160F1B 0%, #332137 50%, #553142 100%)',
    rootBg: '#160F1B',
    appBg: '#160F1B',
    sidebarBg: '#18101c',
    appSidebarBg: 'transparent',
    contentBg: 'transparent',
    panelBg: 'rgba(30, 20, 36, 0.95)',
    modalBg: 'rgba(36, 24, 42, 0.97)',
    cardBg: 'rgba(30, 20, 38, 0.90)',
    inputBg: 'rgba(18, 12, 22, 0.97)',
    editorBg: 'rgba(18, 12, 22, 0.97)',
    containerBg: 'rgba(22, 15, 28, 0.94)',
    sheetBg: 'rgba(28, 18, 36, 0.96)',
    contextMenuBg: 'rgba(38, 26, 48, 0.98)',
    popupBg: 'rgba(38, 26, 48, 0.98)',
    innerPopupBg: 'rgba(32, 22, 40, 0.98)',
    tutorialCardBg: 'rgba(30, 20, 38, 0.96)',
    snippetConfigBg: 'rgba(22, 14, 28, 0.97)',
    snippetChipBg: 'rgba(36, 24, 46, 0.96)',
    overlayBg: 'rgba(8, 4, 12, 0.58)',
    iconDefault: '#C4A8B8',
    textPrimary: '#FAF2F5',
    textSecondary: '#E0C8D8',
    textMuted: '#9E8090',
    textDisabled: 'rgba(250, 242, 245, 0.38)',
    textPlaceholder: '#867080',
    textError: '#F87171',
    sectionCountText: '#9E8090',
    borderDefault: 'rgba(220, 170, 190, 0.16)',
    borderActive: 'rgba(220, 170, 190, 0.28)',
    borderSelected: '#FF7C9D',
    hoverBg: 'rgba(200, 120, 150, 0.08)',
    selectedBg: 'rgba(200, 120, 150, 0.13)',
    activeBg: 'rgba(200, 120, 150, 0.20)',
    focusRing: '#FF7C9D',
    accent: '#FF7C9D',
    accentHover: '#FF9AB4',
    success: '#4DDBAE',
    warning: '#FFD166',
    error: '#F87171',
    info: '#FF7C9D',
    tutorialTextTitle: '#FAF2F5',
    tutorialTextGradientStart: '#FF7C9D',
    tutorialTextGradientEnd: '#C084FC',
    tutorialTextDescription: '#E0C8D8',
    tutorialAccent: '#FF7C9D',
    tutorialAccentMuted: 'rgba(255, 124, 157, 0.16)',
    widgetDragPlaceholderBg: 'rgba(28, 18, 38, 0.65)',
    widgetDragShadow: 'rgba(8, 4, 12, 0.65)',
    widgetDragOutline: 'rgba(255, 124, 157, 0.40)',
    diffAddedBg: 'rgba(77, 219, 174, 0.16)',
    diffAddedBgStrong: 'rgba(77, 219, 174, 0.36)',
    diffAddedText: '#5CF2C2',
    diffAddedBorder: 'rgba(77, 219, 174, 0.32)',
    diffRemovedBg: 'rgba(248, 113, 113, 0.16)',
    diffRemovedBgStrong: 'rgba(248, 113, 113, 0.36)',
    diffRemovedText: '#FFA1B0',
    diffRemovedBorder: 'rgba(248, 113, 113, 0.32)',
    diffModifiedBg: 'rgba(255, 209, 102, 0.16)',
    diffModifiedText: '#FFE085',
    diffModifiedBorder: 'rgba(255, 209, 102, 0.32)',
    diffMovedBg: 'rgba(255, 124, 157, 0.16)',
    diffMovedText: '#FF9AB4',
    diffMovedBorder: 'rgba(255, 124, 157, 0.32)',
    diffGutterBg: 'rgba(250, 242, 245, 0.04)',
    diffLineNumberText: '#867080',
  },
});

export const cherryBlossomLightTheme: ThemeProfile = makeLight({
  id: 'cherry-blossom-light',
  familyId: 'cherry-blossom',
  name: 'Cherry Blossom',
  tokens: {
    backgroundGradient: 'linear-gradient(180deg, #DCBDE5 0%, #E9D1E1 48%, #F6E8DA 100%)',
    rootBg: '#E9D1E1',
    appBg: '#E9D1E1',
    sidebarBg: '#fff8fc',
    appSidebarBg: 'transparent',
    contentBg: 'transparent',
    panelBg: 'rgba(255, 253, 254, 0.90)',
    modalBg: 'rgba(255, 253, 254, 0.96)',
    cardBg: 'rgba(255, 253, 254, 0.92)',
    inputBg: 'rgba(255, 253, 254, 0.96)',
    editorBg: 'rgba(255, 253, 254, 0.96)',
    containerBg: 'rgba(255, 253, 254, 0.94)',
    sheetBg: 'rgba(255, 253, 254, 0.97)',
    contextMenuBg: 'rgba(255, 253, 254, 0.98)',
    popupBg: 'rgba(255, 253, 254, 0.98)',
    innerPopupBg: 'rgba(247, 241, 246, 0.98)',
    tutorialCardBg: 'rgba(255, 253, 254, 0.96)',
    snippetConfigBg: '#F4EFF4',
    snippetChipBg: '#ECE8EC',
    overlayBg: 'rgba(64, 48, 64, 0.28)',
    iconDefault: '#4A3E4A',
    textPrimary: '#1F181F',
    textSecondary: '#3A303A',
    textMuted: '#544854',
    textDisabled: 'rgba(31, 24, 31, 0.40)',
    textPlaceholder: '#726472',
    textError: '#E93E63',
    sectionCountText: '#544854',
    borderDefault: 'rgba(31, 24, 31, 0.14)',
    borderActive: 'rgba(224, 82, 117, 0.55)',
    borderSelected: '#E05275',
    hoverBg: 'rgba(255, 224, 232, 0.70)',
    selectedBg: 'rgba(255, 214, 224, 0.84)',
    activeBg: 'rgba(255, 200, 214, 0.92)',
    focusRing: 'rgba(224, 82, 117, 0.50)',
    accent: '#E05275',
    accentHover: '#C93D60',
    success: '#2FBF7A',
    warning: '#D99A38',
    error: '#E93E63',
    info: '#7C8EDB',
    tutorialTextTitle: '#403A40',
    tutorialTextGradientStart: '#E05275',
    tutorialTextGradientEnd: '#8F7AE6',
    tutorialTextDescription: '#6E646E',
    tutorialAccent: '#E05275',
    tutorialAccentMuted: 'rgba(224, 82, 117, 0.14)',
    widgetBg: 'rgba(255, 253, 254, 0.56)',
    widgetBorder: 'rgba(255, 255, 255, 0.76)',
    widgetShadow: 'rgba(104, 70, 98, 0.18)',
    widgetToolbarBg: 'rgba(70, 52, 68, 0.90)',
    widgetToolbarBorder: 'rgba(255, 255, 255, 0.32)',
    widgetToolbarShadow: 'rgba(60, 40, 56, 0.28)',
    widgetToolbarText: '#FFF9FC',
    widgetToolbarMutedText: 'rgba(255, 244, 249, 0.72)',
    widgetToolbarActiveBg: 'rgba(255, 253, 254, 0.96)',
    widgetToolbarHoverBg: 'rgba(255, 224, 232, 0.22)',
    widgetDragPlaceholderBg: 'rgba(82, 61, 78, 0.22)',
    widgetDragShadow: 'rgba(60, 40, 56, 0.28)',
    widgetDragOutline: 'rgba(255, 255, 255, 0.78)',
    diffAddedBg: 'rgba(47, 191, 122, 0.14)',
    diffAddedBgStrong: 'rgba(47, 191, 122, 0.30)',
    diffAddedText: '#15803D',
    diffAddedBorder: 'rgba(47, 191, 122, 0.38)',
    diffRemovedBg: 'rgba(233, 62, 99, 0.14)',
    diffRemovedBgStrong: 'rgba(233, 62, 99, 0.30)',
    diffRemovedText: '#BE123C',
    diffRemovedBorder: 'rgba(233, 62, 99, 0.38)',
    diffModifiedBg: 'rgba(217, 154, 56, 0.14)',
    diffModifiedText: '#B45309',
    diffModifiedBorder: 'rgba(217, 154, 56, 0.38)',
    diffMovedBg: 'rgba(124, 141, 219, 0.14)',
    diffMovedText: '#4338CA',
    diffMovedBorder: 'rgba(124, 141, 219, 0.38)',
    diffGutterBg: 'rgba(0, 0, 0, 0.03)',
    diffLineNumberText: '#726472',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Lavender Dream
// ─────────────────────────────────────────────────────────────────────────────

export const lavenderDreamDarkTheme: ThemeProfile = makeDark({
  id: 'lavender-dream-dark',
  familyId: 'lavender-dream',
  name: 'Lavender Dream',
  tokens: {
    backgroundGradient: 'linear-gradient(180deg, #12101D 0%, #2D253E 52%, #493651 100%)',
    rootBg: '#12101D',
    appBg: '#12101D',
    sidebarBg: '#141220',
    appSidebarBg: 'transparent',
    contentBg: 'transparent',
    panelBg: 'rgba(26, 22, 40, 0.95)',
    modalBg: 'rgba(32, 27, 48, 0.97)',
    cardBg: 'rgba(28, 24, 44, 0.90)',
    inputBg: 'rgba(16, 14, 26, 0.97)',
    editorBg: 'rgba(16, 14, 26, 0.97)',
    containerBg: 'rgba(20, 17, 34, 0.94)',
    sheetBg: 'rgba(26, 22, 42, 0.96)',
    contextMenuBg: 'rgba(36, 30, 56, 0.98)',
    popupBg: 'rgba(36, 30, 56, 0.98)',
    innerPopupBg: 'rgba(30, 26, 48, 0.98)',
    tutorialCardBg: 'rgba(28, 24, 44, 0.96)',
    snippetConfigBg: 'rgba(20, 16, 32, 0.97)',
    snippetChipBg: 'rgba(34, 28, 54, 0.96)',
    overlayBg: 'rgba(6, 5, 14, 0.58)',
    iconDefault: '#B8AACC',
    textPrimary: '#F6F2FF',
    textSecondary: '#D8CCEC',
    textMuted: '#9A8CAE',
    textDisabled: 'rgba(246, 242, 255, 0.38)',
    textPlaceholder: '#82769A',
    textError: '#F87171',
    sectionCountText: '#9A8CAE',
    borderDefault: 'rgba(200, 180, 230, 0.16)',
    borderActive: 'rgba(200, 180, 230, 0.28)',
    borderSelected: '#C79AF1',
    hoverBg: 'rgba(160, 130, 210, 0.08)',
    selectedBg: 'rgba(160, 130, 210, 0.13)',
    activeBg: 'rgba(160, 130, 210, 0.20)',
    focusRing: '#C79AF1',
    accent: '#C79AF1',
    accentHover: '#D7B3F7',
    success: '#4DDBAE',
    warning: '#FFD166',
    error: '#F87171',
    info: '#C79AF1',
    tutorialTextTitle: '#F6F2FF',
    tutorialTextGradientStart: '#C79AF1',
    tutorialTextGradientEnd: '#D7B3F7',
    tutorialTextDescription: '#D8CCEC',
    tutorialAccent: '#C79AF1',
    tutorialAccentMuted: 'rgba(199, 154, 241, 0.16)',
    widgetDragPlaceholderBg: 'rgba(24, 20, 42, 0.65)',
    widgetDragShadow: 'rgba(6, 5, 14, 0.65)',
    widgetDragOutline: 'rgba(199, 154, 241, 0.40)',
    diffAddedBg: 'rgba(77, 219, 174, 0.16)',
    diffAddedBgStrong: 'rgba(77, 219, 174, 0.36)',
    diffAddedText: '#5CF2C2',
    diffAddedBorder: 'rgba(77, 219, 174, 0.32)',
    diffRemovedBg: 'rgba(248, 113, 113, 0.16)',
    diffRemovedBgStrong: 'rgba(248, 113, 113, 0.36)',
    diffRemovedText: '#FFA1B0',
    diffRemovedBorder: 'rgba(248, 113, 113, 0.32)',
    diffModifiedBg: 'rgba(255, 209, 102, 0.16)',
    diffModifiedText: '#FFE085',
    diffModifiedBorder: 'rgba(255, 209, 102, 0.32)',
    diffMovedBg: 'rgba(199, 154, 241, 0.16)',
    diffMovedText: '#D7B3F7',
    diffMovedBorder: 'rgba(199, 154, 241, 0.32)',
    diffGutterBg: 'rgba(246, 242, 255, 0.04)',
    diffLineNumberText: '#82769A',
  },
});

export const lavenderDreamLightTheme: ThemeProfile = makeLight({
  id: 'lavender-dream-light',
  familyId: 'lavender-dream',
  name: 'Lavender Dream',
  tokens: {
    backgroundGradient: 'linear-gradient(180deg, #C9AEDC 0%, #D9C7E4 50%, #EEE2ED 100%)',
    rootBg: '#D9C7E4',
    appBg: '#D9C7E4',
    sidebarBg: '#fcfaff',
    appSidebarBg: 'transparent',
    contentBg: 'transparent',
    panelBg: 'rgba(253, 251, 255, 0.90)',
    modalBg: 'rgba(254, 252, 255, 0.96)',
    cardBg: 'rgba(253, 251, 255, 0.92)',
    inputBg: 'rgba(254, 252, 255, 0.96)',
    editorBg: 'rgba(254, 252, 255, 0.96)',
    containerBg: 'rgba(253, 251, 255, 0.94)',
    sheetBg: 'rgba(254, 252, 255, 0.97)',
    contextMenuBg: 'rgba(254, 252, 255, 0.98)',
    popupBg: 'rgba(254, 252, 255, 0.98)',
    innerPopupBg: 'rgba(248, 244, 252, 0.98)',
    tutorialCardBg: 'rgba(253, 251, 255, 0.96)',
    snippetConfigBg: '#F3EFF8',
    snippetChipBg: '#EBE4F4',
    overlayBg: 'rgba(56, 40, 72, 0.28)',
    iconDefault: '#7056A0',
    textPrimary: '#26183E',
    textSecondary: '#42306A',
    textMuted: '#6A5290',
    textDisabled: 'rgba(38, 24, 62, 0.40)',
    textPlaceholder: '#907AB4',
    textError: '#B0246A',
    sectionCountText: '#6A5290',
    borderDefault: 'rgba(56, 40, 96, 0.14)',
    borderActive: 'rgba(132, 102, 178, 0.55)',
    borderSelected: '#8466B2',
    hoverBg: 'rgba(210, 190, 240, 0.65)',
    selectedBg: 'rgba(200, 176, 234, 0.80)',
    activeBg: 'rgba(188, 160, 226, 0.90)',
    focusRing: 'rgba(132, 102, 178, 0.50)',
    accent: '#8466B2',
    accentHover: '#70539C',
    success: '#2FBF7A',
    warning: '#C98C1A',
    error: '#B0246A',
    info: '#8466B2',
    tutorialTextTitle: '#26183E',
    tutorialTextGradientStart: '#8466B2',
    tutorialTextGradientEnd: '#C79AF1',
    tutorialTextDescription: '#604A82',
    tutorialAccent: '#8466B2',
    tutorialAccentMuted: 'rgba(132, 102, 178, 0.14)',
    widgetBg: 'rgba(253, 251, 255, 0.58)',
    widgetBorder: 'rgba(255, 255, 255, 0.76)',
    widgetShadow: 'rgba(72, 52, 112, 0.18)',
    widgetToolbarBg: 'rgba(48, 34, 78, 0.90)',
    widgetToolbarBorder: 'rgba(255, 255, 255, 0.32)',
    widgetToolbarShadow: 'rgba(40, 26, 64, 0.28)',
    widgetToolbarText: '#FAF8FF',
    widgetToolbarMutedText: 'rgba(250, 248, 255, 0.72)',
    widgetToolbarActiveBg: 'rgba(254, 252, 255, 0.96)',
    widgetToolbarHoverBg: 'rgba(210, 190, 240, 0.22)',
    widgetDragPlaceholderBg: 'rgba(70, 52, 106, 0.22)',
    widgetDragShadow: 'rgba(40, 26, 64, 0.28)',
    widgetDragOutline: 'rgba(255, 255, 255, 0.78)',
    diffAddedBg: 'rgba(47, 191, 122, 0.14)',
    diffAddedBgStrong: 'rgba(47, 191, 122, 0.30)',
    diffAddedText: '#15803D',
    diffAddedBorder: 'rgba(47, 191, 122, 0.38)',
    diffRemovedBg: 'rgba(176, 36, 106, 0.12)',
    diffRemovedBgStrong: 'rgba(176, 36, 106, 0.28)',
    diffRemovedText: '#7E1249',
    diffRemovedBorder: 'rgba(176, 36, 106, 0.38)',
    diffModifiedBg: 'rgba(201, 140, 26, 0.12)',
    diffModifiedText: '#7B4A06',
    diffModifiedBorder: 'rgba(201, 140, 26, 0.38)',
    diffMovedBg: 'rgba(132, 102, 178, 0.12)',
    diffMovedText: '#3E2A7A',
    diffMovedBorder: 'rgba(132, 102, 178, 0.38)',
    diffGutterBg: 'rgba(0, 0, 0, 0.03)',
    diffLineNumberText: '#907AB4',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Periwinkle Mist
// ─────────────────────────────────────────────────────────────────────────────

export const periwinkleMistDarkTheme: ThemeProfile = makeDark({
  id: 'periwinkle-mist-dark',
  familyId: 'periwinkle-mist',
  name: 'Periwinkle Mist',
  tokens: {
    backgroundGradient: 'linear-gradient(180deg, #101522 0%, #252C42 52%, #3C4962 100%)',
    rootBg: '#101522',
    appBg: '#101522',
    sidebarBg: '#121626',
    appSidebarBg: 'transparent',
    contentBg: 'transparent',
    panelBg: 'rgba(22, 28, 48, 0.95)',
    modalBg: 'rgba(28, 34, 56, 0.97)',
    cardBg: 'rgba(24, 30, 52, 0.90)',
    inputBg: 'rgba(14, 18, 32, 0.97)',
    editorBg: 'rgba(14, 18, 32, 0.97)',
    containerBg: 'rgba(18, 22, 40, 0.94)',
    sheetBg: 'rgba(22, 28, 50, 0.96)',
    contextMenuBg: 'rgba(32, 40, 64, 0.98)',
    popupBg: 'rgba(32, 40, 64, 0.98)',
    innerPopupBg: 'rgba(26, 32, 54, 0.98)',
    tutorialCardBg: 'rgba(24, 30, 52, 0.96)',
    snippetConfigBg: 'rgba(16, 20, 36, 0.97)',
    snippetChipBg: 'rgba(30, 38, 62, 0.96)',
    overlayBg: 'rgba(4, 6, 16, 0.58)',
    iconDefault: '#9AAEC8',
    textPrimary: '#EFF3FA',
    textSecondary: '#CDD6E8',
    textMuted: '#8898B8',
    textDisabled: 'rgba(239, 243, 250, 0.38)',
    textPlaceholder: '#7088A8',
    textError: '#F87171',
    sectionCountText: '#8898B8',
    borderDefault: 'rgba(160, 186, 224, 0.16)',
    borderActive: 'rgba(160, 186, 224, 0.28)',
    borderSelected: '#8FB7E3',
    hoverBg: 'rgba(110, 140, 200, 0.08)',
    selectedBg: 'rgba(110, 140, 200, 0.13)',
    activeBg: 'rgba(110, 140, 200, 0.20)',
    focusRing: '#8FB7E3',
    accent: '#8FB7E3',
    accentHover: '#A9CAED',
    success: '#4DDBAE',
    warning: '#FFD166',
    error: '#F87171',
    info: '#8FB7E3',
    tutorialTextTitle: '#EFF3FA',
    tutorialTextGradientStart: '#8FB7E3',
    tutorialTextGradientEnd: '#A9CAED',
    tutorialTextDescription: '#CDD6E8',
    tutorialAccent: '#8FB7E3',
    tutorialAccentMuted: 'rgba(143, 183, 227, 0.16)',
    widgetDragPlaceholderBg: 'rgba(20, 26, 50, 0.65)',
    widgetDragShadow: 'rgba(4, 6, 16, 0.65)',
    widgetDragOutline: 'rgba(143, 183, 227, 0.40)',
    diffAddedBg: 'rgba(77, 219, 174, 0.16)',
    diffAddedBgStrong: 'rgba(77, 219, 174, 0.36)',
    diffAddedText: '#5CF2C2',
    diffAddedBorder: 'rgba(77, 219, 174, 0.32)',
    diffRemovedBg: 'rgba(248, 113, 113, 0.16)',
    diffRemovedBgStrong: 'rgba(248, 113, 113, 0.36)',
    diffRemovedText: '#FFA1B0',
    diffRemovedBorder: 'rgba(248, 113, 113, 0.32)',
    diffModifiedBg: 'rgba(255, 209, 102, 0.16)',
    diffModifiedText: '#FFE085',
    diffModifiedBorder: 'rgba(255, 209, 102, 0.32)',
    diffMovedBg: 'rgba(143, 183, 227, 0.16)',
    diffMovedText: '#A9CAED',
    diffMovedBorder: 'rgba(143, 183, 227, 0.32)',
    diffGutterBg: 'rgba(239, 243, 250, 0.04)',
    diffLineNumberText: '#7088A8',
  },
});

export const periwinkleMistLightTheme: ThemeProfile = makeLight({
  id: 'periwinkle-mist-light',
  familyId: 'periwinkle-mist',
  name: 'Periwinkle Mist',
  tokens: {
    backgroundGradient:
      'linear-gradient(180deg, #BBC6DE 0%, #C4CFE3 25%, #CCD8E7 50%, #D6E1EC 75%, #DFEAF0 100%)',
    rootBg: '#CCD8E7',
    appBg: '#CCD8E7',
    sidebarBg: '#f9fbfe',
    appSidebarBg: 'transparent',
    contentBg: 'transparent',
    panelBg: 'rgba(250, 252, 255, 0.90)',
    modalBg: 'rgba(252, 253, 255, 0.97)',
    cardBg: 'rgba(250, 252, 255, 0.94)',
    inputBg: 'rgba(252, 253, 255, 0.97)',
    editorBg: 'rgba(252, 253, 255, 0.97)',
    containerBg: 'rgba(250, 252, 255, 0.95)',
    sheetBg: 'rgba(252, 253, 255, 0.98)',
    contextMenuBg: 'rgba(252, 253, 255, 0.98)',
    popupBg: 'rgba(252, 253, 255, 0.98)',
    innerPopupBg: 'rgba(246, 249, 253, 0.98)',
    tutorialCardBg: 'rgba(250, 252, 255, 0.97)',
    backdrop: 'rgba(38, 48, 68, 0.30)',
    snippetConfigBg: '#F1F4FA',
    snippetChipBg: '#E8EDF6',
    overlayBg: 'rgba(38, 48, 68, 0.28)',
    iconDefault: '#53647D',
    textPrimary: '#273445',
    textSecondary: '#435269',
    textMuted: '#627086',
    textDisabled: 'rgba(39, 52, 69, 0.40)',
    textPlaceholder: '#718096',
    textError: '#C33F55',
    sectionCountText: '#5F6E84',
    borderDefault: 'rgba(39, 52, 69, 0.14)',
    borderActive: 'rgba(96, 122, 170, 0.55)',
    borderSelected: '#607AAA',
    hoverBg: 'rgba(224, 231, 246, 0.70)',
    selectedBg: 'rgba(212, 222, 241, 0.84)',
    activeBg: 'rgba(196, 210, 235, 0.92)',
    focusRing: '#607AAA',
    accent: '#607AAA',
    accentHover: '#4F6898',
    success: '#287A5B',
    warning: '#A56D19',
    error: '#C33F55',
    info: '#4F75A8',
    tutorialTextTitle: '#2B3748',
    tutorialTextGradientStart: '#607AAA',
    tutorialTextGradientEnd: '#8294BD',
    tutorialTextDescription: '#5E6C82',
    tutorialAccent: '#607AAA',
    tutorialAccentMuted: 'rgba(96, 122, 170, 0.15)',
    widgetBg: 'rgba(250, 252, 255, 0.64)',
    widgetBorder: 'rgba(255, 255, 255, 0.78)',
    widgetShadow: 'rgba(59, 72, 102, 0.18)',
    widgetToolbarBg: 'rgba(48, 59, 80, 0.91)',
    widgetToolbarBorder: 'rgba(255, 255, 255, 0.32)',
    widgetToolbarShadow: 'rgba(42, 52, 73, 0.28)',
    widgetToolbarText: '#F9FAFD',
    widgetToolbarMutedText: 'rgba(249, 250, 253, 0.74)',
    widgetToolbarActiveBg: 'rgba(252, 253, 255, 0.96)',
    widgetToolbarHoverBg: 'rgba(224, 231, 246, 0.22)',
    widgetDragPlaceholderBg: 'rgba(76, 91, 125, 0.22)',
    widgetDragShadow: 'rgba(42, 52, 73, 0.28)',
    widgetDragOutline: 'rgba(255, 255, 255, 0.80)',
    diffAddedBg: 'rgba(40, 122, 91, 0.14)',
    diffAddedBgStrong: 'rgba(40, 122, 91, 0.30)',
    diffAddedText: '#15803D',
    diffAddedBorder: 'rgba(40, 122, 91, 0.38)',
    diffRemovedBg: 'rgba(195, 63, 85, 0.14)',
    diffRemovedBgStrong: 'rgba(195, 63, 85, 0.30)',
    diffRemovedText: '#BE123C',
    diffRemovedBorder: 'rgba(195, 63, 85, 0.38)',
    diffModifiedBg: 'rgba(165, 109, 25, 0.14)',
    diffModifiedText: '#B45309',
    diffModifiedBorder: 'rgba(165, 109, 25, 0.38)',
    diffMovedBg: 'rgba(79, 117, 168, 0.14)',
    diffMovedText: '#4F75A8',
    diffMovedBorder: 'rgba(79, 117, 168, 0.38)',
    diffGutterBg: 'rgba(0, 0, 0, 0.03)',
    diffLineNumberText: '#627086',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Cloud Blue
// ─────────────────────────────────────────────────────────────────────────────

export const cloudBlueDarkTheme: ThemeProfile = makeDark({
  id: 'cloud-blue-dark',
  familyId: 'cloud-blue',
  name: 'Cloud Blue',
  tokens: {
    backgroundGradient: 'linear-gradient(180deg, #091421 0%, #172B42 52%, #29465F 100%)',
    rootBg: '#091421',
    appBg: '#091421',
    sidebarBg: '#0e1828',
    appSidebarBg: 'transparent',
    contentBg: 'transparent',
    panelBg: 'rgba(18, 30, 48, 0.95)',
    modalBg: 'rgba(22, 36, 56, 0.97)',
    cardBg: 'rgba(18, 30, 50, 0.90)',
    inputBg: 'rgba(10, 18, 32, 0.97)',
    editorBg: 'rgba(10, 18, 32, 0.97)',
    containerBg: 'rgba(14, 24, 42, 0.94)',
    sheetBg: 'rgba(18, 30, 52, 0.96)',
    contextMenuBg: 'rgba(26, 42, 64, 0.98)',
    popupBg: 'rgba(26, 42, 64, 0.98)',
    innerPopupBg: 'rgba(20, 36, 58, 0.98)',
    tutorialCardBg: 'rgba(18, 30, 50, 0.96)',
    snippetConfigBg: 'rgba(12, 22, 38, 0.97)',
    snippetChipBg: 'rgba(24, 40, 62, 0.96)',
    overlayBg: 'rgba(2, 6, 14, 0.58)',
    iconDefault: '#8AAEC8',
    textPrimary: '#EDF4FA',
    textSecondary: '#C8D8E8',
    textMuted: '#7A98B2',
    textDisabled: 'rgba(237, 244, 250, 0.38)',
    textPlaceholder: '#6288A4',
    textError: '#F87171',
    sectionCountText: '#7A98B2',
    borderDefault: 'rgba(120, 170, 220, 0.16)',
    borderActive: 'rgba(120, 170, 220, 0.28)',
    borderSelected: '#6FB7F1',
    hoverBg: 'rgba(80, 140, 200, 0.08)',
    selectedBg: 'rgba(80, 140, 200, 0.13)',
    activeBg: 'rgba(80, 140, 200, 0.20)',
    focusRing: '#6FB7F1',
    accent: '#6FB7F1',
    accentHover: '#8CC8F6',
    success: '#4DDBAE',
    warning: '#FFD166',
    error: '#F87171',
    info: '#6FB7F1',
    tutorialTextTitle: '#EDF4FA',
    tutorialTextGradientStart: '#6FB7F1',
    tutorialTextGradientEnd: '#8CC8F6',
    tutorialTextDescription: '#C8D8E8',
    tutorialAccent: '#6FB7F1',
    tutorialAccentMuted: 'rgba(111, 183, 241, 0.16)',
    widgetDragPlaceholderBg: 'rgba(14, 26, 46, 0.65)',
    widgetDragShadow: 'rgba(2, 6, 14, 0.65)',
    widgetDragOutline: 'rgba(111, 183, 241, 0.40)',
    diffAddedBg: 'rgba(77, 219, 174, 0.16)',
    diffAddedBgStrong: 'rgba(77, 219, 174, 0.36)',
    diffAddedText: '#5CF2C2',
    diffAddedBorder: 'rgba(77, 219, 174, 0.32)',
    diffRemovedBg: 'rgba(248, 113, 113, 0.16)',
    diffRemovedBgStrong: 'rgba(248, 113, 113, 0.36)',
    diffRemovedText: '#FFA1B0',
    diffRemovedBorder: 'rgba(248, 113, 113, 0.32)',
    diffModifiedBg: 'rgba(255, 209, 102, 0.16)',
    diffModifiedText: '#FFE085',
    diffModifiedBorder: 'rgba(255, 209, 102, 0.32)',
    diffMovedBg: 'rgba(111, 183, 241, 0.16)',
    diffMovedText: '#8CC8F6',
    diffMovedBorder: 'rgba(111, 183, 241, 0.32)',
    diffGutterBg: 'rgba(237, 244, 250, 0.04)',
    diffLineNumberText: '#6288A4',
  },
});

export const cloudBlueLightTheme: ThemeProfile = makeLight({
  id: 'cloud-blue-light',
  familyId: 'cloud-blue',
  name: 'Cloud Blue',
  tokens: {
    backgroundGradient: 'linear-gradient(180deg, #AEC4E2 0%, #C9DAEA 52%, #E2EDF3 100%)',
    rootBg: '#C9DAEA',
    appBg: '#C9DAEA',
    sidebarBg: '#f8fbfe',
    appSidebarBg: 'transparent',
    contentBg: 'transparent',
    panelBg: 'rgba(250, 252, 255, 0.90)',
    modalBg: 'rgba(252, 254, 255, 0.97)',
    cardBg: 'rgba(250, 252, 255, 0.94)',
    inputBg: 'rgba(252, 254, 255, 0.97)',
    editorBg: 'rgba(252, 254, 255, 0.97)',
    containerBg: 'rgba(250, 252, 255, 0.95)',
    sheetBg: 'rgba(252, 254, 255, 0.98)',
    contextMenuBg: 'rgba(252, 254, 255, 0.98)',
    popupBg: 'rgba(252, 254, 255, 0.98)',
    innerPopupBg: 'rgba(244, 249, 254, 0.98)',
    tutorialCardBg: 'rgba(250, 252, 255, 0.97)',
    snippetConfigBg: '#EFF4FA',
    snippetChipBg: '#E4EEF7',
    overlayBg: 'rgba(30, 54, 84, 0.28)',
    iconDefault: '#4A6E92',
    textPrimary: '#1A3050',
    textSecondary: '#2E4E72',
    textMuted: '#527098',
    textDisabled: 'rgba(26, 48, 80, 0.40)',
    textPlaceholder: '#7090B4',
    textError: '#B83248',
    sectionCountText: '#4E6C90',
    borderDefault: 'rgba(26, 48, 80, 0.14)',
    borderActive: 'rgba(79, 130, 184, 0.55)',
    borderSelected: '#4F82B8',
    hoverBg: 'rgba(180, 215, 245, 0.65)',
    selectedBg: 'rgba(165, 204, 240, 0.80)',
    activeBg: 'rgba(146, 191, 234, 0.90)',
    focusRing: 'rgba(79, 130, 184, 0.50)',
    accent: '#4F82B8',
    accentHover: '#3D6F9F',
    success: '#25845D',
    warning: '#A86F18',
    error: '#B83248',
    info: '#3D6F9F',
    tutorialTextTitle: '#1A3050',
    tutorialTextGradientStart: '#4F82B8',
    tutorialTextGradientEnd: '#6FB7F1',
    tutorialTextDescription: '#4A6680',
    tutorialAccent: '#4F82B8',
    tutorialAccentMuted: 'rgba(79, 130, 184, 0.14)',
    widgetBg: 'rgba(250, 252, 255, 0.62)',
    widgetBorder: 'rgba(255, 255, 255, 0.78)',
    widgetShadow: 'rgba(30, 54, 84, 0.18)',
    widgetToolbarBg: 'rgba(28, 48, 76, 0.90)',
    widgetToolbarBorder: 'rgba(255, 255, 255, 0.32)',
    widgetToolbarShadow: 'rgba(22, 40, 66, 0.28)',
    widgetToolbarText: '#F5FAFF',
    widgetToolbarMutedText: 'rgba(245, 250, 255, 0.72)',
    widgetToolbarActiveBg: 'rgba(252, 254, 255, 0.96)',
    widgetToolbarHoverBg: 'rgba(180, 215, 245, 0.22)',
    widgetDragPlaceholderBg: 'rgba(46, 80, 122, 0.22)',
    widgetDragShadow: 'rgba(22, 40, 66, 0.28)',
    widgetDragOutline: 'rgba(255, 255, 255, 0.80)',
    diffAddedBg: 'rgba(37, 132, 93, 0.14)',
    diffAddedBgStrong: 'rgba(37, 132, 93, 0.30)',
    diffAddedText: '#15803D',
    diffAddedBorder: 'rgba(37, 132, 93, 0.38)',
    diffRemovedBg: 'rgba(184, 50, 72, 0.14)',
    diffRemovedBgStrong: 'rgba(184, 50, 72, 0.30)',
    diffRemovedText: '#9F1C34',
    diffRemovedBorder: 'rgba(184, 50, 72, 0.38)',
    diffModifiedBg: 'rgba(168, 111, 24, 0.14)',
    diffModifiedText: '#B45309',
    diffModifiedBorder: 'rgba(168, 111, 24, 0.38)',
    diffMovedBg: 'rgba(79, 130, 184, 0.14)',
    diffMovedText: '#2E5C94',
    diffMovedBorder: 'rgba(79, 130, 184, 0.38)',
    diffGutterBg: 'rgba(0, 0, 0, 0.03)',
    diffLineNumberText: '#7090B4',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Coastal Mint
// ─────────────────────────────────────────────────────────────────────────────

export const coastalMintDarkTheme: ThemeProfile = makeDark({
  id: 'coastal-mint-dark',
  familyId: 'coastal-mint',
  name: 'Coastal Mint',
  tokens: {
    backgroundGradient: 'linear-gradient(180deg, #0B191A 0%, #173033 52%, #294A45 100%)',
    rootBg: '#0B191A',
    appBg: '#0B191A',
    sidebarBg: '#0e1a1c',
    appSidebarBg: 'transparent',
    contentBg: 'transparent',
    panelBg: 'rgba(18, 32, 34, 0.95)',
    modalBg: 'rgba(22, 38, 40, 0.97)',
    cardBg: 'rgba(18, 32, 36, 0.90)',
    inputBg: 'rgba(10, 20, 22, 0.97)',
    editorBg: 'rgba(10, 20, 22, 0.97)',
    containerBg: 'rgba(14, 26, 30, 0.94)',
    sheetBg: 'rgba(18, 32, 36, 0.96)',
    contextMenuBg: 'rgba(26, 46, 50, 0.98)',
    popupBg: 'rgba(26, 46, 50, 0.98)',
    innerPopupBg: 'rgba(20, 38, 42, 0.98)',
    tutorialCardBg: 'rgba(18, 32, 36, 0.96)',
    snippetConfigBg: 'rgba(12, 22, 26, 0.97)',
    snippetChipBg: 'rgba(24, 42, 46, 0.96)',
    overlayBg: 'rgba(2, 8, 10, 0.58)',
    iconDefault: '#7ABAA8',
    textPrimary: 'rgba(255, 255, 255, 0.82)',
    textSecondary: 'rgba(255, 255, 255, 0.58)',
    textMuted: 'rgba(255, 255, 255, 0.45)',
    textDisabled: 'rgba(232, 244, 242, 0.38)',
    textPlaceholder: '#628C84',
    textError: '#F87171',
    sectionCountText: '#7AA8A0',
    borderDefault: 'rgba(100, 180, 160, 0.16)',
    borderActive: 'rgba(100, 180, 160, 0.28)',
    borderSelected: '#63B7AA',
    hoverBg: 'rgba(60, 150, 130, 0.08)',
    selectedBg: 'rgba(60, 150, 130, 0.13)',
    activeBg: 'rgba(60, 150, 130, 0.20)',
    focusRing: '#63B7AA',
    accent: '#63B7AA',
    accentHover: '#7ACABE',
    success: '#4DDBAE',
    warning: '#FFD166',
    error: '#F87171',
    info: '#63B7AA',
    tutorialTextTitle: '#E8F4F2',
    tutorialTextGradientStart: '#63B7AA',
    tutorialTextGradientEnd: '#7ACABE',
    tutorialTextDescription: '#BCD8D2',
    tutorialAccent: '#63B7AA',
    tutorialAccentMuted: 'rgba(99, 183, 170, 0.16)',
    widgetBg: 'rgba(255, 255, 255, 0.12)',
    widgetInnerBg: 'rgba(255, 255, 255, 0.035)',
    widgetBorder: 'rgba(255, 255, 255, 0.06)',
    widgetShadow: 'rgba(0, 0, 0, 0.22)',
    widgetToolbarBg: 'rgba(255, 255, 255, 0.14)',
    widgetToolbarBorder: 'rgba(255, 255, 255, 0.05)',
    widgetToolbarShadow: 'rgba(0, 0, 0, 0.16)',
    widgetToolbarText: '#E8F4F2',
    widgetToolbarMutedText: 'rgba(188, 216, 210, 0.72)',
    widgetToolbarActiveBg: 'rgba(255, 255, 255, 0.92)',
    widgetToolbarHoverBg: 'rgba(255, 255, 255, 0.12)',
    widgetDragPlaceholderBg: 'rgba(14, 28, 32, 0.65)',
    widgetDragShadow: 'rgba(2, 8, 10, 0.65)',
    widgetDragOutline: 'rgba(99, 183, 170, 0.40)',
    diffAddedBg: 'rgba(77, 219, 174, 0.16)',
    diffAddedBgStrong: 'rgba(77, 219, 174, 0.36)',
    diffAddedText: '#5CF2C2',
    diffAddedBorder: 'rgba(77, 219, 174, 0.32)',
    diffRemovedBg: 'rgba(248, 113, 113, 0.16)',
    diffRemovedBgStrong: 'rgba(248, 113, 113, 0.36)',
    diffRemovedText: '#FFA1B0',
    diffRemovedBorder: 'rgba(248, 113, 113, 0.32)',
    diffModifiedBg: 'rgba(255, 209, 102, 0.16)',
    diffModifiedText: '#FFE085',
    diffModifiedBorder: 'rgba(255, 209, 102, 0.32)',
    diffMovedBg: 'rgba(99, 183, 170, 0.16)',
    diffMovedText: '#7ACABE',
    diffMovedBorder: 'rgba(99, 183, 170, 0.32)',
    diffGutterBg: 'rgba(232, 244, 242, 0.04)',
    diffLineNumberText: '#628C84',
  },
});

export const coastalMintLightTheme: ThemeProfile = makeLight({
  id: 'coastal-mint-light',
  familyId: 'coastal-mint',
  name: 'Coastal Mint',
  tokens: {
    backgroundGradient: 'linear-gradient(180deg, #A5C8D1 0%, #BED6D4 50%, #D5E2D5 100%)',
    rootBg: '#BED6D4',
    appBg: '#BED6D4',
    sidebarBg: '#f8fbfa',
    appSidebarBg: 'transparent',
    contentBg: 'transparent',
    panelBg: 'rgba(250, 252, 251, 0.90)',
    modalBg: 'rgba(252, 253, 252, 0.97)',
    cardBg: 'rgba(250, 252, 251, 0.94)',
    inputBg: 'rgba(252, 253, 252, 0.97)',
    editorBg: 'rgba(252, 253, 252, 0.97)',
    containerBg: 'rgba(250, 252, 251, 0.95)',
    sheetBg: 'rgba(252, 253, 252, 0.98)',
    contextMenuBg: 'rgba(252, 253, 252, 0.98)',
    backdrop: 'rgba(40, 58, 61, 0.30)',
    popupBg: 'rgba(252, 253, 252, 0.98)',
    innerPopupBg: 'rgba(246, 249, 248, 0.98)',
    tutorialCardBg: 'rgba(250, 252, 251, 0.97)',
    snippetConfigBg: '#F3F7F6',
    snippetChipBg: '#EAF1EF',
    overlayBg: 'rgba(40, 58, 61, 0.28)',
    iconDefault: '#506468',
    textPrimary: '#263538',
    textSecondary: '#43565A',
    textMuted: '#627579',
    textDisabled: 'rgba(38, 53, 56, 0.40)',
    textPlaceholder: '#708185',
    textError: '#C33D4D',
    sectionCountText: '#5E7276',
    borderDefault: 'rgba(38, 53, 56, 0.14)',
    borderActive: 'rgba(78, 135, 148, 0.55)',
    borderSelected: '#3D737F',
    hoverBg: 'rgba(202, 226, 222, 0.70)',
    selectedBg: 'rgba(186, 218, 213, 0.84)',
    activeBg: 'rgba(168, 208, 202, 0.92)',
    focusRing: 'rgba(78, 135, 148, 0.50)',
    accent: '#4E8794',
    accentHover: '#3D737F',
    success: '#25845D',
    warning: '#A86F18',
    error: '#C33D4D',
    info: '#397C91',
    tutorialTextTitle: '#2B393C',
    tutorialTextGradientStart: '#397C91',
    tutorialTextGradientEnd: '#5E927B',
    tutorialTextDescription: '#5D7074',
    tutorialAccent: '#4E8794',
    tutorialAccentMuted: 'rgba(78, 135, 148, 0.15)',
    widgetBg: 'rgba(250, 252, 251, 0.62)',
    widgetBorder: 'rgba(255, 255, 255, 0.76)',
    widgetShadow: 'rgba(53, 78, 79, 0.18)',
    widgetToolbarBg: 'rgba(47, 67, 70, 0.90)',
    widgetToolbarBorder: 'rgba(255, 255, 255, 0.32)',
    widgetToolbarShadow: 'rgba(40, 61, 63, 0.28)',
    widgetToolbarText: '#F8FBFA',
    widgetToolbarMutedText: 'rgba(248, 251, 250, 0.72)',
    widgetToolbarActiveBg: 'rgba(252, 253, 252, 0.96)',
    widgetToolbarHoverBg: 'rgba(202, 226, 222, 0.22)',
    widgetDragPlaceholderBg: 'rgba(66, 94, 95, 0.22)',
    widgetDragShadow: 'rgba(40, 61, 63, 0.28)',
    widgetDragOutline: 'rgba(255, 255, 255, 0.78)',
    diffAddedBg: 'rgba(37, 132, 93, 0.14)',
    diffAddedBgStrong: 'rgba(37, 132, 93, 0.30)',
    diffAddedText: '#15803D',
    diffAddedBorder: 'rgba(37, 132, 93, 0.38)',
    diffRemovedBg: 'rgba(195, 61, 77, 0.14)',
    diffRemovedBgStrong: 'rgba(195, 61, 77, 0.30)',
    diffRemovedText: '#BE123C',
    diffRemovedBorder: 'rgba(195, 61, 77, 0.38)',
    diffModifiedBg: 'rgba(168, 111, 24, 0.14)',
    diffModifiedText: '#B45309',
    diffModifiedBorder: 'rgba(168, 111, 24, 0.38)',
    diffMovedBg: 'rgba(57, 124, 145, 0.14)',
    diffMovedText: '#397C91',
    diffMovedBorder: 'rgba(57, 124, 145, 0.38)',
    diffGutterBg: 'rgba(0, 0, 0, 0.03)',
    diffLineNumberText: '#627579',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Restored Original Themes: Moonlit Ocean & Midnight Stars
// ─────────────────────────────────────────────────────────────────────────────

export const oceanBlueTheme: ThemeProfile = makeDark({
  id: 'ocean-blue',
  name: 'Moonlit Ocean',
  familyId: 'ocean-blue',
  pattern: 'scattered-dots',
  tokens: {
    backgroundGradient:
      'linear-gradient(155deg, #070B14 0%, #090E1A 30%, #0D1625 62%, #17243A 100%)',
    rootBg: '#090E1A',
    appBg: '#090E1A',
    sidebarBg: '#0e1320',
    appSidebarBg: 'transparent',
    contentBg: 'transparent',
    panelBg: 'rgba(21, 28, 44, 0.94)',
    modalBg: 'rgba(21, 28, 44, 0.97)',
    cardBg: 'rgba(21, 28, 44, 0.94)',
    inputBg: 'rgba(28, 38, 59, 0.96)',
    editorBg: 'rgba(28, 38, 59, 0.96)',
    containerBg: 'rgba(24, 33, 51, 0.95)',
    sheetBg: 'rgba(21, 28, 44, 0.98)',
    popupBg: 'rgba(24, 33, 51, 0.98)',
    contextMenuBg: 'rgba(21, 28, 44, 0.98)',
    innerPopupBg: 'rgba(28, 38, 59, 0.98)',
    tutorialCardBg: 'rgba(21, 28, 44, 0.96)',
    snippetConfigBg: 'rgba(28, 38, 59, 0.96)',
    snippetChipBg: 'rgba(24, 33, 51, 0.95)',
    overlayBg: 'rgba(4, 7, 13, 0.65)',
    textPrimary: '#F0F4FA',
    textSecondary: '#C5D3E8',
    textMuted: '#899DBB',
    textDisabled: 'rgba(240, 244, 250, 0.38)',
    textPlaceholder: '#6E85A7',
    textError: '#F87171',
    sectionCountText: '#899DBB',
    iconDefault: '#9FB2D0',
    borderDefault: 'rgba(255, 255, 255, 0.12)',
    borderActive: 'rgba(255, 255, 255, 0.22)',
    borderSelected: '#3B82F6',
    hoverBg: 'rgba(255, 255, 255, 0.08)',
    selectedBg: 'rgba(255, 255, 255, 0.12)',
    activeBg: 'rgba(255, 255, 255, 0.18)',
    focusRing: '#3B82F6',
    accent: '#3B82F6',
    accentHover: '#2563EB',
    widgetBg: 'rgba(255, 255, 255, 0.16)',
    widgetShadow: 'rgba(0, 0, 0, 0.25)',
    widgetToolbarBg: 'rgba(255, 255, 255, 0.16)',
    widgetToolbarShadow: 'rgba(0, 0, 0, 0.18)',
    widgetToolbarText: '#F0F4FA',
    widgetToolbarMutedText: 'rgba(240, 244, 250, 0.70)',
    widgetToolbarActiveBg: 'rgba(255, 255, 255, 0.92)',
    widgetToolbarHoverBg: 'rgba(255, 255, 255, 0.12)',
    widgetDragPlaceholderBg: 'rgba(28, 38, 59, 0.65)',
    widgetDragShadow: 'rgba(0, 0, 0, 0.58)',
    widgetDragOutline: 'rgba(59, 130, 246, 0.35)',
  },
  glassOpacity: 0.88,
  glassBlur: '14px',
});

export const midnightStarsTheme: ThemeProfile = makeDark({
  id: 'midnight-stars',
  name: 'Midnight Stars',
  familyId: 'midnight-stars',
  pattern: 'scattered-dots',
  tokens: {
    backgroundGradient: 'linear-gradient(180deg, #19202A 0%, #343A43 100%)',
    rootBg: '#19202A',
    appBg: '#242A34',
    sidebarBg: '#202731',
    appSidebarBg: 'transparent',
    contentBg: 'transparent',
    panelBg: '#3A414A',
    modalBg: '#343B44',
    cardBg: '#3A414A',
    inputBg: '#252D36',
    editorBg: '#252D36',
    containerBg: '#303740',
    sheetBg: '#2D353E',
    popupBg: '#303740',
    contextMenuBg: '#303740',
    innerPopupBg: '#373E47',
    tutorialCardBg: '#3A414A',
    snippetConfigBg: '#303740',
    snippetChipBg: '#3A414A',
    overlayBg: 'rgba(10, 14, 20, 0.48)',
    textPrimary: '#F4F7FA',
    textSecondary: '#C7D0DA',
    textMuted: '#9BA7B4',
    textDisabled: 'rgba(244, 247, 250, 0.42)',
    textPlaceholder: '#8794A2',
    textError: '#F87171',
    sectionCountText: '#9BA7B4',
    iconDefault: '#B1BCC7',
    borderDefault: 'rgba(255, 255, 255, 0.14)',
    borderActive: 'rgba(255, 255, 255, 0.26)',
    borderSelected: '#8FB7E3',
    hoverBg: 'rgba(255, 255, 255, 0.09)',
    selectedBg: 'rgba(255, 255, 255, 0.14)',
    activeBg: 'rgba(255, 255, 255, 0.20)',
    focusRing: '#8FB7E3',
    accent: '#8FB7E3',
    accentHover: '#A9CAED',
    widgetBg: 'rgba(255, 255, 255, 0.11)',
    widgetBorder: 'rgba(255, 255, 255, 0.05)',
    widgetShadow: 'rgba(0, 0, 0, 0.18)',
    widgetToolbarBg: 'rgba(255, 255, 255, 0.11)',
    widgetToolbarShadow: 'rgba(0, 0, 0, 0.12)',
    widgetToolbarText: '#F4F7FA',
    widgetToolbarMutedText: 'rgba(244, 247, 250, 0.72)',
    widgetToolbarActiveBg: 'rgba(255, 255, 255, 0.92)',
    widgetToolbarHoverBg: 'rgba(255, 255, 255, 0.12)',
    widgetDragPlaceholderBg: 'rgba(52, 58, 67, 0.68)',
    widgetDragShadow: 'rgba(0, 0, 0, 0.52)',
    widgetDragOutline: 'rgba(143, 183, 227, 0.38)',
  },
  glassOpacity: 0.88,
  glassBlur: '14px',
});

// ─────────────────────────────────────────────────────────────────────────────
// Reflect New Tab — neutral graphite glass theme
// ─────────────────────────────────────────────────────────────────────────────

export const reflectNewTabTheme: ThemeProfile = makeDark({
  id: 'reflect-new-tab',
  name: 'Graphite Dusk',
  familyId: 'reflect-new-tab',
  pattern: 'scattered-dots',
  tokens: {
    backgroundGradient: 'linear-gradient(180deg, #1D1E25 0%, #282930 48%, #303139 100%)',
    rootBg: '#1D1E25',
    appBg: '#282930',
    sidebarBg: 'rgba(31, 32, 39, 0.94)',
    appSidebarBg: 'rgba(31, 32, 39, 0.88)',
    contentBg: 'transparent',
    panelBg: 'rgba(68, 69, 76, 0.88)',
    modalBg: 'rgba(61, 62, 69, 0.96)',
    cardBg: 'rgba(72, 73, 80, 0.88)',
    inputBg: 'rgba(59, 60, 67, 0.90)',
    editorBg: 'rgba(57, 58, 65, 0.96)',
    containerBg: 'rgba(63, 64, 71, 0.94)',
    sheetBg: 'rgba(57, 58, 65, 0.97)',
    popupBg: 'rgba(54, 55, 62, 0.98)',
    contextMenuBg: 'rgba(50, 51, 58, 0.98)',
    innerPopupBg: 'rgba(72, 73, 80, 0.98)',
    tutorialCardBg: 'rgba(68, 69, 76, 0.96)',
    snippetConfigBg: 'rgba(62, 63, 70, 0.96)',
    snippetChipBg: 'rgba(76, 77, 84, 0.96)',
    overlayBg: 'rgba(14, 15, 20, 0.54)',
    iconDefault: '#B5B6BC',
    noteLibraryIcon: '#D1D2D6',
    textPrimary: '#D7D7DA',
    textSecondary: '#BDBEC3',
    textMuted: '#929399',
    textDisabled: 'rgba(215, 215, 218, 0.38)',
    textPlaceholder: '#98999F',
    textError: '#D97887',
    sectionCountText: '#9C9DA3',
    borderDefault: 'rgba(255, 255, 255, 0.09)',
    borderActive: 'rgba(255, 255, 255, 0.17)',
    borderSelected: '#B09AF4',
    hoverBg: 'rgba(255, 255, 255, 0.055)',
    selectedBg: 'rgba(255, 255, 255, 0.085)',
    activeBg: 'rgba(255, 255, 255, 0.13)',
    focusRing: '#A98DF1',
    accent: '#A98DF1',
    accentHover: '#B9A2F7',
    success: '#A8BFAF',
    warning: '#D1B98D',
    error: '#D97887',
    info: '#A9B8CF',
    tutorialTextTitle: '#E2E2E5',
    tutorialTextGradientStart: '#A98DF1',
    tutorialTextGradientEnd: '#E3B8A3',
    tutorialTextDescription: '#B5B6BC',
    tutorialAccent: '#A98DF1',
    tutorialAccentMuted: 'rgba(169, 141, 241, 0.16)',
    widgetBg: 'rgba(70, 71, 78, 0.88)',
    widgetInnerBg: 'rgba(82, 83, 90, 0.94)',
    widgetBorder: 'rgba(255, 255, 255, 0.10)',
    widgetShadow: 'rgba(9, 10, 14, 0.26)',
    widgetToolbarBg: 'rgba(57, 58, 65, 0.96)',
    widgetToolbarBorder: 'rgba(255, 255, 255, 0.11)',
    widgetToolbarShadow: 'rgba(9, 10, 14, 0.34)',
    widgetToolbarText: '#D7D7DA',
    widgetToolbarMutedText: 'rgba(189, 190, 195, 0.72)',
    widgetToolbarActiveBg: 'rgba(215, 215, 218, 0.92)',
    widgetToolbarHoverBg: 'rgba(255, 255, 255, 0.09)',
    widgetDragPlaceholderBg: 'rgba(76, 77, 84, 0.54)',
    widgetDragShadow: 'rgba(9, 10, 14, 0.34)',
    widgetDragOutline: 'rgba(176, 154, 244, 0.30)',
  },
  glassOpacity: 0.88,
  glassBlur: '14px',
  warmTint: { color: '#FFFFFF', opacity: 0 },
  brightness: { maximumSourceLevel: 88 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Ordered theme families — SINGLE SOURCE OF TRUTH for UI ordering
// ─────────────────────────────────────────────────────────────────────────────

export interface ThemeFamily {
  familyId: string;
  name: string;
  darkId: string;
  lightId?: string;
  darkGradient: string;
  lightGradient?: string;
  hasLightVariant?: boolean;
}

/**
 * Ordered list of theme families.
 * ThemeSettings and onboarding derive their dark/light card lists from this.
 * The position of each family in this array determines card position in both sections.
 */
export const THEME_FAMILIES: ThemeFamily[] = [
  // Row 1 Dark Themes (The 6 main themes)
  {
    familyId: 'aurora-glow',
    name: 'Aurora Glow',
    darkId: 'aurora-glow-dark',
    lightId: 'aurora-glow-light',
    darkGradient: 'linear-gradient(180deg, #0B1026 0%, #29234F 52%, #61364F 100%)',
    lightGradient: 'linear-gradient(180deg, #8178F2 0%, #E8A2C4 52%, #FFD8B5 100%)',
    hasLightVariant: true,
  },
  {
    familyId: 'cherry-blossom',
    name: 'Cherry Blossom',
    darkId: 'cherry-blossom-dark',
    lightId: 'cherry-blossom-light',
    darkGradient: 'linear-gradient(180deg, #160F1B 0%, #332137 50%, #553142 100%)',
    lightGradient: 'linear-gradient(180deg, #DCBDE5 0%, #E9D1E1 48%, #F6E8DA 100%)',
    hasLightVariant: true,
  },
  {
    familyId: 'lavender-dream',
    name: 'Lavender Dream',
    darkId: 'lavender-dream-dark',
    lightId: 'lavender-dream-light',
    darkGradient: 'linear-gradient(180deg, #12101D 0%, #2D253E 52%, #493651 100%)',
    lightGradient: 'linear-gradient(180deg, #C9AEDC 0%, #D9C7E4 50%, #EEE2ED 100%)',
    hasLightVariant: true,
  },
  {
    familyId: 'periwinkle-mist',
    name: 'Periwinkle Mist',
    darkId: 'periwinkle-mist-dark',
    lightId: 'periwinkle-mist-light',
    darkGradient: 'linear-gradient(180deg, #101522 0%, #252C42 52%, #3C4962 100%)',
    lightGradient:
      'linear-gradient(180deg, #BBC6DE 0%, #C4CFE3 25%, #CCD8E7 50%, #D6E1EC 75%, #DFEAF0 100%)',
    hasLightVariant: true,
  },
  {
    familyId: 'cloud-blue',
    name: 'Cloud Blue',
    darkId: 'cloud-blue-dark',
    lightId: 'cloud-blue-light',
    darkGradient: 'linear-gradient(180deg, #091421 0%, #172B42 52%, #29465F 100%)',
    lightGradient: 'linear-gradient(180deg, #AEC4E2 0%, #C9DAEA 52%, #E2EDF3 100%)',
    hasLightVariant: true,
  },
  {
    familyId: 'coastal-mint',
    name: 'Coastal Mint',
    darkId: 'coastal-mint-dark',
    lightId: 'coastal-mint-light',
    darkGradient: 'linear-gradient(180deg, #0B191A 0%, #173033 52%, #294A45 100%)',
    lightGradient: 'linear-gradient(180deg, #A5C8D1 0%, #BED6D4 50%, #D5E2D5 100%)',
    hasLightVariant: true,
  },
  // Row 2 Dark Themes (The 2 restored themes: Moonlit Ocean & Midnight Stars - Dark Only)
  {
    familyId: 'ocean-blue',
    name: 'Moonlit Ocean',
    darkId: 'ocean-blue',
    darkGradient: 'linear-gradient(155deg, #070B14 0%, #090E1A 30%, #0D1625 62%, #17243A 100%)',
    hasLightVariant: false,
  },
  {
    familyId: 'midnight-stars',
    name: 'Midnight Stars',
    darkId: 'midnight-stars',
    darkGradient: 'linear-gradient(180deg, #19202A 0%, #343A43 100%)',
    hasLightVariant: false,
  },
  {
    familyId: 'reflect-new-tab',
    name: 'Graphite Dusk',
    darkId: 'reflect-new-tab',
    darkGradient: 'linear-gradient(180deg, #1D1E25 0%, #282930 48%, #303139 100%)',
    hasLightVariant: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Registry & helpers
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_THEME_ID = 'cloud-blue-dark';

/**
 * Canonical theme registry.
 */
export const themeRegistry: Record<string, ThemeProfile> = {
  // Active variants
  'aurora-glow-dark': auroraGlowDarkTheme,
  'aurora-glow-light': auroraGlowLightTheme,
  'cherry-blossom-dark': cherryBlossomDarkTheme,
  'cherry-blossom-light': cherryBlossomLightTheme,
  'lavender-dream-dark': lavenderDreamDarkTheme,
  'lavender-dream-light': lavenderDreamLightTheme,
  'periwinkle-mist-dark': periwinkleMistDarkTheme,
  'periwinkle-mist-light': periwinkleMistLightTheme,
  'cloud-blue-dark': cloudBlueDarkTheme,
  'cloud-blue-light': cloudBlueLightTheme,
  'coastal-mint-dark': coastalMintDarkTheme,
  'coastal-mint-light': coastalMintLightTheme,

  // Restored original themes
  'ocean-blue': oceanBlueTheme,
  'midnight-stars': midnightStarsTheme,
  'reflect-new-tab': reflectNewTabTheme,
};

/**
 * Legacy migration map.
 * Maps old/legacy IDs to their canonical new IDs.
 */
export const LEGACY_THEME_MIGRATION: Record<string, string> = {
  // Generic dark fallbacks
  'dark': 'cloud-blue-dark',
  'default-dark': 'cloud-blue-dark',
  // Old light themes
  'cherry-blossom': 'cherry-blossom-light',
  'coastal-mint': 'coastal-mint-light',
  'reflect-gradient': 'coastal-mint-light',
  'periwinkle-mist': 'periwinkle-mist-light',
  // Generic light fallback
  'light': 'cloud-blue-light',
};

export function isValidThemeId(id: string): boolean {
  return Boolean(id && themeRegistry[id]);
}

export function migrateThemeId(id: string): string {
  if (LEGACY_THEME_MIGRATION[id]) {
    return LEGACY_THEME_MIGRATION[id];
  }
  return id;
}

export function getTheme(id: string): ThemeProfile {
  // First try direct lookup
  if (isValidThemeId(id)) {
    return themeRegistry[id]!;
  }
  // Try legacy migration
  const migrated = migrateThemeId(id);
  if (isValidThemeId(migrated)) {
    return themeRegistry[migrated]!;
  }
  // Final fallback
  return themeRegistry[DEFAULT_THEME_ID]!;
}

export function getRandomValidThemeId(): string {
  const themeIds = Object.keys(themeRegistry);
  const randomIndex = Math.floor(Math.random() * themeIds.length);
  return themeIds[randomIndex] || DEFAULT_THEME_ID;
}

function getLuminance(colorStr: string): number | null {
  if (!colorStr) return null;
  let r = 0, g = 0, b = 0;
  if (colorStr.startsWith('#')) {
    const hex = colorStr.replace('#', '');
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length >= 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
  } else if (colorStr.startsWith('rgb')) {
    const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      r = parseInt(match[1], 10);
      g = parseInt(match[2], 10);
      b = parseInt(match[3], 10);
    } else return null;
  } else {
    return null;
  }
  const sRGB = [r, g, b].map(v => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}

function getContrastRatio(fg: string, bg: string): number | null {
  const lumFg = getLuminance(fg);
  const lumBg = getLuminance(bg);
  if (lumFg === null || lumBg === null) return null;
  const l1 = Math.max(lumFg, lumBg);
  const l2 = Math.min(lumFg, lumBg);
  return (l1 + 0.05) / (l2 + 0.05);
}

function extractHexColors(str: string | undefined): string[] {
  if (!str) return [];
  const matches = str.match(/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}/g);
  return matches || [];
}

const shouldRunThemeInvariantAssertions = (): boolean => {
  try {
    return Boolean((globalThis as any).__CMDOS_ENABLE_THEME_INVARIANT_LOGS__);
  } catch {
    return false;
  }
};

/**
 * Theme Invariant Assertion:
 * For every unique registered theme profile, inputBg MUST match editorBg
 * so resting input field surfaces seamlessly match the containing editor background.
 * Also performs development contrast checks for critical onboarding tokens.
 */
export function assertThemeInvariants(): void {
  if (!shouldRunThemeInvariantAssertions()) return;

  const uniqueThemes = Object.values(themeRegistry);

  for (const theme of uniqueThemes) {
    if (!theme.warmTint || typeof theme.warmTint.color !== 'string' || !theme.warmTint.color) {
      console.warn(`[Theme Invariant Violation] Theme "${theme.id}" is missing a valid warmTint color.`);
    }

    if (
      !theme.warmTint ||
      typeof theme.warmTint.opacity !== 'number' ||
      !Number.isFinite(theme.warmTint.opacity) ||
      theme.warmTint.opacity < 0 ||
      theme.warmTint.opacity > 1
    ) {
      console.warn(
        `[Theme Invariant Violation] Theme "${theme.id}" has invalid warmTint opacity (${theme?.warmTint?.opacity}). Expected finite number between 0 and 1.`,
      );
    }

    if (theme.tokens.inputBg !== theme.tokens.editorBg) {
      console.warn(
        `[Theme Invariant Violation] Theme "${theme.id}" has mismatched inputBg (${theme.tokens.inputBg}) and editorBg (${theme.tokens.editorBg}).`,
      );
    }

    const titleContrast = getContrastRatio(theme.tokens.tutorialTextTitle, theme.tokens.tutorialCardBg);
    if (titleContrast !== null && titleContrast < 3.0) {
      console.warn(
        `[Theme Contrast Warning] Theme "${theme.id}" tutorialTextTitle (${theme.tokens.tutorialTextTitle}) vs tutorialCardBg (${theme.tokens.tutorialCardBg}) contrast ratio is ${titleContrast.toFixed(2)}:1 (expected >= 3.0:1).`,
      );
    }

    const descContrast = getContrastRatio(theme.tokens.tutorialTextDescription, theme.tokens.tutorialCardBg);
    if (descContrast !== null && descContrast < 3.0) {
      console.warn(
        `[Theme Contrast Warning] Theme "${theme.id}" tutorialTextDescription (${theme.tokens.tutorialTextDescription}) vs tutorialCardBg (${theme.tokens.tutorialCardBg}) contrast ratio is ${descContrast.toFixed(2)}:1 (expected >= 3.0:1).`,
      );
    }

    const primaryContrast = getContrastRatio(theme.tokens.textPrimary, theme.tokens.inputBg);
    if (primaryContrast !== null && primaryContrast < 3.0) {
      console.warn(
        `[Theme Contrast Warning] Theme "${theme.id}" textPrimary (${theme.tokens.textPrimary}) vs inputBg (${theme.tokens.inputBg}) contrast ratio is ${primaryContrast.toFixed(2)}:1 (expected >= 3.0:1).`,
      );
    }

    // Validate background gradient stops against foreground tokens if backgroundGradient exists
    const bgStops = extractHexColors(theme.tokens.backgroundGradient);
    for (const stop of bgStops) {
      const gradStartContrast = getContrastRatio(theme.tokens.tutorialTextGradientStart, stop);
      if (gradStartContrast !== null && gradStartContrast < 3.0) {
        console.warn(
          `[Theme Contrast Warning] Theme "${theme.id}" tutorialTextGradientStart (${theme.tokens.tutorialTextGradientStart}) vs bgStop (${stop}) contrast ratio is ${gradStartContrast.toFixed(2)}:1 (expected >= 3.0:1).`,
        );
      }

      const gradEndContrast = getContrastRatio(theme.tokens.tutorialTextGradientEnd, stop);
      if (gradEndContrast !== null && gradEndContrast < 3.0) {
        console.warn(
          `[Theme Contrast Warning] Theme "${theme.id}" tutorialTextGradientEnd (${theme.tokens.tutorialTextGradientEnd}) vs bgStop (${stop}) contrast ratio is ${gradEndContrast.toFixed(2)}:1 (expected >= 3.0:1).`,
        );
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy re-exports for any code that may still import old names
// ─────────────────────────────────────────────────────────────────────────────

/** @deprecated Use cloudBlueDarkTheme */
export const defaultDarkTheme = cloudBlueDarkTheme;
/** @deprecated Use cherryBlossomLightTheme */
export const cherryBlossomTheme = cherryBlossomLightTheme;
/** @deprecated Use coastalMintLightTheme */
export const coastalMintTheme = coastalMintLightTheme;
/** @deprecated Use coastalMintLightTheme */
export const reflectTheme = coastalMintLightTheme;
/** @deprecated Use periwinkleMistLightTheme */
export const periwinkleMistTheme = periwinkleMistLightTheme;
