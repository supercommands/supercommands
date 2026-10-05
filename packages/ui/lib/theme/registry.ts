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
  // Approved collection group-header gradient, shared across all dark profiles.
  collectionSheetGroupBg:
    'linear-gradient(90deg, rgba(15, 20, 26, 0.88) 0%, rgba(24, 33, 43, 0.48) 34%, transparent 100%)',
  contextMenuBg: '#080808',
  backdrop: 'blur(12px)',
  popupBg: '#080808',
  innerPopupBg: '#0c0c0c',
  tutorialCardBg: '#171821',
  iconDefault: '#D4D4D4',
  noteLibraryIcon: '#D4D4D4',
  snippetConfigBg: '#262626',
  snippetChipBg: '#262626',
  overlayBg: 'rgba(0, 0, 0, 0.4)',
  // Typography
  textPrimary: '#FFFFFF',
  textSecondary: '#E5E7EB',
  textMuted: '#D4D4D4',
  textDisabled: 'rgba(255, 255, 255, 0.35)',
  textPlaceholder: '#9CA3AF',
  textError: '#EF4444',
  sectionCountText: '#E5E7EB',
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
  widgetToolbarMutedText: 'rgba(255, 255, 255, 0.86)',
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
  searchBarText: '#FFFFFF',
  searchBarPlaceholder: '#E5E7EB',
  searchBarIcon: '#E5E7EB',
  searchBarKbdBg: 'rgba(255, 255, 255, 0.045)',
  searchBarKbdBorder: 'rgba(255, 255, 255, 0.055)',
  searchBarKbdText: '#E5E7EB',
  altsPopupBg: 'rgba(15, 15, 15, 0.74)',
  altsSearchBg: 'transparent',
  altsListBg: 'transparent',
  altsRowHoverBg: 'rgba(255, 255, 255, 0.075)',
  altsRowSelectedBg: 'rgba(255, 255, 255, 0.075)',
  altsBorderColor: 'rgba(255, 255, 255, 0.055)',
  altsDividerColor: 'rgba(255, 255, 255, 0.045)',
  altsFocusColor: 'rgba(255, 255, 255, 0.12)',
  altsSelectedEdge: 'rgba(255, 255, 255, 0.018)',
  altsTextPrimary: '#FFFFFF',
  altsTextSecondary: '#D4D4D4',
  altsTextSection: 'rgba(255, 255, 255, 0.72)',
  altsTextPlaceholder: '#9CA3AF',
  altsIconColor: '#ffffff',
  altsIconSelected: '#ffffff',
  altsShortcutText: 'rgba(255, 255, 255, 0.72)',
  altsShortcutBg: 'rgba(255, 255, 255, 0.075)',
  altsShortcutBorder: 'rgba(255, 255, 255, 0.08)',
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
  altsPopupShadow: '0 16px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 0 rgba(255, 255, 255, 0.10)',
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
    iconDefault: '#F4F2FF',
    textPrimary: '#FFFFFF',
    textSecondary: '#F4F2FF',
    textMuted: '#CEC8F0',
    textDisabled: 'rgba(244, 242, 255, 0.38)',
    textPlaceholder: '#CEC8F0',
    textError: '#F87171',
    sectionCountText: '#F4F2FF',
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
    iconDefault: '#FAF2F5',
    textPrimary: '#FFFFFF',
    textSecondary: '#FAF2F5',
    textMuted: '#E0C8D8',
    textDisabled: 'rgba(250, 242, 245, 0.38)',
    textPlaceholder: '#E0C8D8',
    textError: '#F87171',
    sectionCountText: '#FAF2F5',
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
    iconDefault: '#F6F2FF',
    textPrimary: '#FFFFFF',
    textSecondary: '#F6F2FF',
    textMuted: '#D8CCEC',
    textDisabled: 'rgba(246, 242, 255, 0.38)',
    textPlaceholder: '#D8CCEC',
    textError: '#F87171',
    sectionCountText: '#F6F2FF',
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

/*
*/

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
    iconDefault: '#EFF3FA',
    textPrimary: '#FFFFFF',
    textSecondary: '#EFF3FA',
    textMuted: '#CDD6E8',
    textDisabled: 'rgba(239, 243, 250, 0.38)',
    textPlaceholder: '#CDD6E8',
    textError: '#F87171',
    sectionCountText: '#EFF3FA',
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
    textPrimary: '#FFFFFF',
    textSecondary: '#F0F4FA',
    textMuted: '#C5D3E8',
    textDisabled: 'rgba(240, 244, 250, 0.38)',
    textPlaceholder: '#C5D3E8',
    textError: '#F87171',
    sectionCountText: '#F0F4FA',
    iconDefault: '#F0F4FA',
    borderDefault: 'rgba(255, 255, 255, 0.12)',
    borderActive: 'rgba(255, 255, 255, 0.22)',
    borderSelected: '#3B82F6',
    hoverBg: 'rgba(255, 255, 255, 0.08)',
    selectedBg: 'rgba(255, 255, 255, 0.12)',
    activeBg: 'rgba(255, 255, 255, 0.18)',
    focusRing: '#3B82F6',
    accent: '#3B82F6',
    accentHover: '#2563EB',
    widgetBg: 'rgba(255, 255, 255, 0.11)',
    widgetInnerBg: 'rgba(255, 255, 255, 0.035)',
    widgetBorder: 'rgba(255, 255, 255, 0.05)',
    widgetShadow: 'rgba(0, 0, 0, 0.18)',
    widgetToolbarBg: 'rgba(255, 255, 255, 0.11)',
    widgetToolbarBorder: 'rgba(255, 255, 255, 0.05)',
    widgetToolbarShadow: 'rgba(0, 0, 0, 0.12)',
    widgetToolbarText: '#F0F4FA',
    widgetToolbarMutedText: 'rgba(240, 244, 250, 0.88)',
    widgetToolbarActiveBg: 'rgba(255, 255, 255, 0.92)',
    widgetToolbarHoverBg: 'rgba(255, 255, 255, 0.12)',
    widgetDragPlaceholderBg: 'rgba(28, 38, 59, 0.65)',
    widgetDragShadow: 'rgba(0, 0, 0, 0.58)',
    widgetDragOutline: 'rgba(59, 130, 246, 0.35)',
  },
  glassOpacity: 0.88,
  glassBlur: '14px',
});

/*
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
    textPrimary: '#FFFFFF',
    textSecondary: '#FFFFFF',
    textMuted: '#F4F7FA',
    textDisabled: 'rgba(244, 247, 250, 0.42)',
    textPlaceholder: '#C7D0DA',
    textError: '#F87171',
    sectionCountText: '#F4F7FA',
    iconDefault: '#F4F7FA',
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
    widgetToolbarMutedText: 'rgba(244, 247, 250, 0.88)',
    widgetToolbarActiveBg: 'rgba(255, 255, 255, 0.92)',
    widgetToolbarHoverBg: 'rgba(255, 255, 255, 0.12)',
    widgetDragPlaceholderBg: 'rgba(52, 58, 67, 0.68)',
    widgetDragShadow: 'rgba(0, 0, 0, 0.52)',
    widgetDragOutline: 'rgba(143, 183, 227, 0.38)',
  },
  glassOpacity: 0.88,
  glassBlur: '14px',
});
*/

// ─────────────────────────────────────────────────────────────────────────────
// Reflect New Tab — pure black glass theme
// ─────────────────────────────────────────────────────────────────────────────

export const reflectNewTabTheme: ThemeProfile = makeDark({
  id: 'reflect-new-tab',
  name: 'Midnight Black',
  familyId: 'reflect-new-tab',
  pattern: 'scattered-dots',
  tokens: {
    backgroundGradient: 'linear-gradient(180deg, #000000 0%, #030305 48%, #08080B 100%)',
    rootBg: '#000000',
    appBg: '#000000',
    sidebarBg: 'rgba(0, 0, 0, 0.94)',
    appSidebarBg: 'transparent',
    contentBg: 'transparent',
    panelBg: 'rgba(14, 14, 18, 0.94)',
    modalBg: 'rgba(12, 12, 16, 0.97)',
    cardBg: 'rgba(16, 16, 20, 0.90)',
    inputBg: 'rgba(20, 20, 25, 0.96)',
    editorBg: 'rgba(12, 12, 16, 0.97)',
    containerBg: 'rgba(14, 14, 18, 0.94)',
    sheetBg: 'rgba(10, 10, 14, 0.98)',
    popupBg: 'rgba(14, 14, 18, 0.98)',
    contextMenuBg: 'rgba(10, 10, 14, 0.98)',
    innerPopupBg: 'rgba(22, 22, 27, 0.98)',
    tutorialCardBg: 'rgba(16, 16, 20, 0.96)',
    snippetConfigBg: 'rgba(14, 14, 18, 0.97)',
    snippetChipBg: 'rgba(24, 24, 29, 0.96)',
    overlayBg: 'rgba(0, 0, 0, 0.62)',
    iconDefault: '#F4F4F5',
    noteLibraryIcon: '#E4E4E7',
    textPrimary: '#FFFFFF',
    textSecondary: '#F4F4F5',
    textMuted: '#BDBEC3',
    textDisabled: 'rgba(244, 244, 245, 0.38)',
    textPlaceholder: '#BDBEC3',
    textError: '#F87171',
    sectionCountText: '#F4F4F5',
    borderDefault: 'rgba(255, 255, 255, 0.12)',
    borderActive: 'rgba(255, 255, 255, 0.24)',
    borderSelected: '#A1A1AA',
    hoverBg: 'rgba(255, 255, 255, 0.08)',
    selectedBg: 'rgba(255, 255, 255, 0.12)',
    activeBg: 'rgba(255, 255, 255, 0.18)',
    focusRing: '#A1A1AA',
    accent: '#A1A1AA',
    accentHover: '#D4D4D8',
    success: '#4DDBAE',
    warning: '#FFD166',
    error: '#F87171',
    info: '#D4D4D8',
    tutorialTextTitle: '#F4F4F5',
    tutorialTextGradientStart: '#FFFFFF',
    tutorialTextGradientEnd: '#A1A1AA',
    tutorialTextDescription: '#D4D4D8',
    tutorialAccent: '#D4D4D8',
    tutorialAccentMuted: 'rgba(212, 212, 216, 0.16)',
    widgetBg: 'rgba(0, 0, 0, 1)',
    widgetInnerBg: 'rgba(0, 0, 0, 1)',
    widgetBorder: 'rgba(255, 255, 255, 0.14)',
    widgetShadow: 'rgba(0, 0, 0, 0.36)',
    widgetToolbarBg: 'rgba(0, 0, 0, 1)',
    widgetToolbarBorder: 'rgba(255, 255, 255, 0.12)',
    widgetToolbarShadow: 'rgba(0, 0, 0, 0.30)',
    widgetToolbarText: '#FFFFFF',
    widgetToolbarMutedText: 'rgba(244, 244, 245, 0.88)',
    widgetToolbarActiveBg: 'rgba(255, 255, 255, 0.12)',
    widgetToolbarHoverBg: 'rgba(255, 255, 255, 0.08)',
    widgetDragPlaceholderBg: 'rgba(18, 18, 22, 0.65)',
    widgetDragShadow: 'rgba(0, 0, 0, 0.58)',
    widgetDragOutline: 'rgba(212, 212, 216, 0.35)',
    searchBarBg: 'rgba(255, 255, 255, 0.11)',
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
  darkGradient: string;
  recommended?: boolean;
}

/**
 * Ordered list of dark theme families shared by Settings and onboarding.
 * The position of each family in this array determines card position in both sections.
 */
export const THEME_FAMILIES: ThemeFamily[] = [
  // Row 1 Themes
  {
    familyId: 'reflect-new-tab',
    name: 'Midnight Black',
    darkId: 'reflect-new-tab',
    darkGradient: 'linear-gradient(180deg, #000000 0%, #030305 48%, #08080B 100%)',
    recommended: true,
  },
  {
    familyId: 'aurora-glow',
    name: 'Aurora Glow',
    darkId: 'aurora-glow-dark',
    darkGradient: 'linear-gradient(180deg, #0B1026 0%, #29234F 52%, #61364F 100%)',
  },
  {
    familyId: 'cherry-blossom',
    name: 'Cherry Blossom',
    darkId: 'cherry-blossom-dark',
    darkGradient: 'linear-gradient(180deg, #160F1B 0%, #332137 50%, #553142 100%)',
  },
  {
    familyId: 'lavender-dream',
    name: 'Lavender Dream',
    darkId: 'lavender-dream-dark',
    darkGradient: 'linear-gradient(180deg, #12101D 0%, #2D253E 52%, #493651 100%)',
  },
  {
    familyId: 'periwinkle-mist',
    name: 'Periwinkle Mist',
    darkId: 'periwinkle-mist-dark',
    darkGradient: 'linear-gradient(180deg, #101522 0%, #252C42 52%, #3C4962 100%)',
  },
  // Row 2 Dark Themes
  {
    familyId: 'ocean-blue',
    name: 'Moonlit Ocean',
    darkId: 'ocean-blue',
    darkGradient: 'linear-gradient(155deg, #070B14 0%, #090E1A 30%, #0D1625 62%, #17243A 100%)',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Registry & helpers
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_THEME_ID = 'reflect-new-tab';

/**
 * Canonical theme registry.
 */
export const themeRegistry: Record<string, ThemeProfile> = {
  // Active variants
  'aurora-glow-dark': auroraGlowDarkTheme,
  'cherry-blossom-dark': cherryBlossomDarkTheme,
  'lavender-dream-dark': lavenderDreamDarkTheme,
  'periwinkle-mist-dark': periwinkleMistDarkTheme,

  // Restored original themes
  'ocean-blue': oceanBlueTheme,
  // 'midnight-stars': midnightStarsTheme,
  'reflect-new-tab': reflectNewTabTheme,
};

/**
 * Legacy migration map.
 * Maps old/legacy IDs to their canonical new IDs.
 */
export const LEGACY_THEME_MIGRATION: Record<string, string> = {
  // Generic dark fallbacks
  'dark': 'aurora-glow-dark',
  'default-dark': 'aurora-glow-dark',
  // Old light themes
  'aurora-glow-light': 'reflect-new-tab',
  'cherry-blossom-light': 'reflect-new-tab',
  'coastal-mint-light': 'reflect-new-tab',
  'periwinkle-mist-light': 'reflect-new-tab',
  'lavender-dream-light': 'reflect-new-tab',
  'cherry-blossom': 'reflect-new-tab',
  'coastal-mint': 'reflect-new-tab',
  'reflect-gradient': 'reflect-new-tab',
  'periwinkle-mist': 'reflect-new-tab',
  // Generic light fallback
  'light': 'reflect-new-tab',
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
    return Boolean(
      (globalThis as any).__supercommands_enable_theme_invariant_logs__ ||
      (globalThis as any).__cmdos_enable_theme_invariant_logs__
    );
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

/** @deprecated Use auroraGlowDarkTheme */
export const defaultDarkTheme = auroraGlowDarkTheme;
