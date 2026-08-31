export interface ThemeTokens {
  // Backgrounds
  appBg: string;
  rootBg: string;
  sidebarBg: string;
  appSidebarBg: string;
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
  noteLibraryIcon: string;
  snippetConfigBg: string;
  snippetChipBg: string;
  overlayBg: string;
  backgroundGradient?: string;

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

  // Widget Card & Drag State
  widgetBg: string;
  widgetInnerBg?: string;
  widgetBorder: string;
  widgetShadow: string;
  widgetToolbarBg: string;
  widgetToolbarBorder: string;
  widgetToolbarShadow: string;
  widgetToolbarText: string;
  widgetToolbarMutedText: string;
  widgetToolbarActiveBg: string;
  widgetToolbarHoverBg: string;
  widgetDragPlaceholderBg: string;
  widgetDragShadow: string;
  widgetDragOutline: string;

  // Search Bar
  searchBarBg: string;
  searchBarBorder: string;
  searchBarShadow: string;
  searchBarText: string;
  searchBarPlaceholder: string;
  searchBarIcon: string;
  searchBarKbdBg: string;
  searchBarKbdBorder: string;
  searchBarKbdText: string;

  // Alt+S website popup
  altsPopupBg: string;
  altsSearchBg: string;
  altsListBg: string;
  altsRowHoverBg: string;
  altsRowSelectedBg: string;
  altsBorderColor: string;
  altsDividerColor: string;
  altsFocusColor: string;
  altsSelectedEdge: string;
  altsTextPrimary: string;
  altsTextSecondary: string;
  altsTextSection: string;
  altsTextPlaceholder: string;
  altsIconColor: string;
  altsIconSelected: string;
  altsShortcutText: string;
  altsShortcutBg: string;
  altsShortcutBorder: string;
  altsIconTileSaveBg: string;
  altsIconTileSaveFg: string;
  altsIconTileSaveSelectedBg: string;
  altsIconTileSaveSelectedFg: string;
  altsIconTileAiBg: string;
  altsIconTileAiFg: string;
  altsIconTileAiSelectedBg: string;
  altsIconTileAiSelectedFg: string;
  altsIconTileSummarizeBg: string;
  altsIconTileSummarizeFg: string;
  altsIconTileSummarizeSelectedBg: string;
  altsIconTileSummarizeSelectedFg: string;
  altsIconTileCaptureBg: string;
  altsIconTileCaptureFg: string;
  altsIconTileCaptureSelectedBg: string;
  altsIconTileCaptureSelectedFg: string;
  altsIconTileExtractBg: string;
  altsIconTileExtractFg: string;
  altsIconTileExtractSelectedBg: string;
  altsIconTileExtractSelectedFg: string;
  altsIconTileActionBg: string;
  altsIconTileActionFg: string;
  altsIconTileActionSelectedBg: string;
  altsIconTileActionSelectedFg: string;
  altsScrollbarThumb: string;
  altsScrollbarThumbHover: string;
  altsPopupShadow: string;

  // Diff / Version History Comparison UI
  diffAddedBg: string;
  diffAddedBgStrong: string;
  diffAddedText: string;
  diffAddedBorder: string;
  diffRemovedBg: string;
  diffRemovedBgStrong: string;
  diffRemovedText: string;
  diffRemovedBorder: string;
  diffModifiedBg: string;
  diffModifiedText: string;
  diffModifiedBorder: string;
  diffMovedBg: string;
  diffMovedText: string;
  diffMovedBorder: string;
  diffGutterBg: string;
  diffLineNumberText: string;
}

export interface ThemeWallpaper {
  src: string;
  opacity: number;
  blendMode?: string;
  blur?: string;
}

export interface ThemeTint {
  color: string;
  opacity: number;
}

export interface ThemeBrightnessConfig {
  maximumSourceLevel: number;
}

export interface ThemeProfile {
  id: string;
  name: string;
  /** Shared family identifier linking the dark and light variant of the same colour family. */
  familyId?: string;
  isDark: boolean;
  tokens: ThemeTokens;
  wallpaper?: ThemeWallpaper;
  glassOpacity?: number;
  glassBlur?: string;
  warmTint: ThemeTint;
  brightness: ThemeBrightnessConfig;
  /**
   * 'scattered-dots' — render the shared dark star/dot overlay (all dark themes).
   * 'none'           — no decorative pattern (all light themes).
   */
  pattern?: 'scattered-dots' | 'none';
}
