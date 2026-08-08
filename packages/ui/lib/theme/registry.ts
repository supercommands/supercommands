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

    // Widget Card & Drag State
    widgetBg: 'rgba(18, 18, 18, 0.74)',
    widgetBorder: 'rgba(255, 255, 255, 0.14)',
    widgetShadow: 'rgba(0, 0, 0, 0.45)',
    widgetToolbarBg: 'rgba(18, 18, 18, 0.92)',
    widgetToolbarBorder: 'rgba(255, 255, 255, 0.14)',
    widgetToolbarShadow: 'rgba(0, 0, 0, 0.56)',
    widgetToolbarText: '#FFFFFF',
    widgetToolbarMutedText: 'rgba(255, 255, 255, 0.68)',
    widgetToolbarActiveBg: 'rgba(255, 255, 255, 0.92)',
    widgetToolbarHoverBg: 'rgba(255, 255, 255, 0.12)',
    widgetDragPlaceholderBg: 'rgba(45, 45, 45, 0.58)',
    widgetDragShadow: 'rgba(0, 0, 0, 0.60)',
    widgetDragOutline: 'rgba(255, 255, 255, 0.18)',

    // Diff / Version History Comparison UI
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
  },
  glassOpacity: 0.5,
  glassBlur: '12px',
};

export const oceanBlueTheme: ThemeProfile = {
  ...defaultDarkTheme,
  id: 'ocean-blue',
  name: 'Moonlit Ocean',
  isDark: true,
  pattern: 'moonlit-ocean-stars',
  tokens: {
    ...defaultDarkTheme.tokens,
    backgroundGradient:
      'linear-gradient(155deg, #070B14 0%, #090E1A 30%, #0D1625 62%, #17243A 100%)',

    // Backgrounds
    rootBg: '#090E1A',
    appBg: '#090E1A',
    sidebarBg: 'rgba(14, 19, 32, 0.94)',
    contentBg: 'transparent',
    panelBg: 'rgba(14, 24, 40, 0.95)',
    modalBg: 'rgba(20, 30, 49, 0.97)',
    cardBg: 'rgba(16, 26, 42, 0.90)',
    inputBg: 'rgba(17, 27, 44, 0.96)',
    editorBg: 'rgba(12, 20, 34, 0.97)',
    containerBg: 'rgba(13, 22, 37, 0.94)',
    sheetBg: 'rgba(16, 27, 45, 0.96)',
    contextMenuBg: 'rgba(21, 36, 58, 0.98)',
    backdrop: 'blur(12px)',
    popupBg: 'rgba(21, 36, 58, 0.98)',
    innerPopupBg: 'rgba(24, 34, 53, 0.98)',
    tutorialCardBg: 'rgba(18, 32, 51, 0.96)',
    snippetConfigBg: 'rgba(14, 25, 41, 0.97)',
    snippetChipBg: 'rgba(21, 36, 58, 0.96)',
    overlayBg: 'rgba(0, 5, 15, 0.58)',

    // Typography
    textPrimary: '#F5F7FA',
    textSecondary: '#D1D7E0',
    textMuted: '#9AA6B5',
    textDisabled: 'rgba(245, 247, 250, 0.38)',
    textPlaceholder: '#7F8C9D',
    textError: '#F87171',
    sectionCountText: '#9AA6B5',
    iconDefault: '#B4BECA',

    // Borders
    borderDefault: 'rgba(165, 188, 218, 0.16)',
    borderActive: 'rgba(165, 188, 218, 0.28)',
    borderSelected: '#6EA8E5',

    // Interactions
    hoverBg: 'rgba(120, 160, 210, 0.08)',
    selectedBg: 'rgba(120, 160, 210, 0.13)',
    activeBg: 'rgba(120, 160, 210, 0.18)',
    focusRing: '#6EA8E5',

    // Accents
    accent: '#6EA8E5',
    accentHover: '#82B8EC',

    // Statuses
    success: '#4DDBAE',
    warning: '#FFD166',
    error: '#F87171',
    info: '#6EA8E5',

    // Onboarding/Tutorial card typography & accents
    tutorialTextTitle: '#F5F7FA',
    tutorialTextGradientStart: '#82B8EC',
    tutorialTextGradientEnd: '#A0BCE8',
    tutorialTextDescription: '#D1D7E0',
    tutorialAccent: '#6EA8E5',
    tutorialAccentMuted: 'rgba(110, 168, 229, 0.16)',

    // Widget Card & Drag State
    widgetBg: 'rgba(16, 26, 42, 0.90)',
    widgetBorder: 'rgba(165, 188, 218, 0.20)',
    widgetShadow: 'rgba(0, 5, 15, 0.50)',
    widgetToolbarBg: 'rgba(21, 36, 58, 0.96)',
    widgetToolbarBorder: 'rgba(165, 188, 218, 0.24)',
    widgetToolbarShadow: 'rgba(0, 5, 15, 0.60)',
    widgetToolbarText: '#F5F7FA',
    widgetToolbarMutedText: 'rgba(209, 215, 224, 0.72)',
    widgetToolbarActiveBg: 'rgba(245, 247, 250, 0.92)',
    widgetToolbarHoverBg: 'rgba(120, 160, 210, 0.14)',
    widgetDragPlaceholderBg: 'rgba(13, 22, 37, 0.65)',
    widgetDragShadow: 'rgba(0, 5, 15, 0.65)',
    widgetDragOutline: 'rgba(110, 168, 229, 0.40)',

    // Diff / Version History Comparison UI
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
    diffMovedBg: 'rgba(110, 168, 229, 0.16)',
    diffMovedText: '#82B8EC',
    diffMovedBorder: 'rgba(110, 168, 229, 0.32)',
    diffGutterBg: 'rgba(245, 247, 250, 0.04)',
    diffLineNumberText: '#7F8C9D',
  },
  glassOpacity: 0.90,
  glassBlur: '12px',
};

export const cherryBlossomTheme: ThemeProfile = {
  ...defaultDarkTheme,
  id: 'cherry-blossom',
  name: 'Cherry Blossom',
  isDark: false,
  tokens: {
    ...defaultDarkTheme.tokens,

    backgroundGradient:
      'linear-gradient(180deg, #DCBDE5 0%, #E9D1E1 48%, #F6E8DA 100%)',

    rootBg: '#E9D1E1',
    appBg: '#E9D1E1',

    sidebarBg: 'rgba(255, 248, 252, 0.84)',
    panelBg: 'rgba(255, 253, 254, 0.9)',
    modalBg: 'rgba(255, 253, 254, 0.95)',
    cardBg: 'rgba(255, 253, 254, 0.95)',
    inputBg: 'rgba(247, 241, 246, 0.96)',
    editorBg: 'rgba(255, 253, 254, 0.95)',
    containerBg: 'rgba(255, 253, 254, 0.95)',
    sheetBg: 'rgba(255, 253, 254, 0.97)',
    popupBg: 'rgba(255, 253, 254, 0.97)',
    contextMenuBg: 'rgba(255, 253, 254, 0.97)',
    innerPopupBg: 'rgba(247, 241, 246, 0.96)',
    tutorialCardBg: 'rgba(255, 253, 254, 0.95)',

    snippetConfigBg: '#F4EFF4',
    snippetChipBg: '#ECE8EC',

    overlayBg: 'rgba(64, 58, 64, 0.36)',

    textPrimary: '#1F181F',
    textSecondary: '#3A303A',
    textMuted: '#544854',
    textDisabled: 'rgba(31, 24, 31, 0.40)',
    textPlaceholder: '#726472',
    textError: '#E93E63',
    sectionCountText: '#544854',
    iconDefault: '#4A3E4A',

    borderDefault: 'rgba(31, 24, 31, 0.16)',
    borderActive: 'rgba(31, 24, 31, 0.30)',
    borderSelected: 'rgba(255, 170, 190, 0.34)',

    hoverBg: 'rgba(255, 232, 238, 0.72)',
    selectedBg: 'rgba(255, 232, 238, 0.85)',
    activeBg: 'rgba(255, 218, 226, 0.90)',
    focusRing: 'rgba(255, 170, 190, 0.50)',

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

    // Widget Card & Drag State
    widgetBg: 'rgba(255, 253, 254, 0.48)',
    widgetBorder: 'rgba(255, 255, 255, 0.72)',
    widgetShadow: 'rgba(104, 70, 98, 0.20)',
    widgetToolbarBg: 'rgba(70, 52, 68, 0.88)',
    widgetToolbarBorder: 'rgba(255, 255, 255, 0.34)',
    widgetToolbarShadow: 'rgba(68, 45, 63, 0.30)',
    widgetToolbarText: '#FFF9FC',
    widgetToolbarMutedText: 'rgba(255, 244, 249, 0.72)',
    widgetToolbarActiveBg: 'rgba(255, 253, 254, 0.94)',
    widgetToolbarHoverBg: 'rgba(255, 232, 238, 0.22)',
    widgetDragPlaceholderBg: 'rgba(82, 61, 78, 0.30)',
    widgetDragShadow: 'rgba(68, 45, 63, 0.32)',
    widgetDragOutline: 'rgba(255, 255, 255, 0.72)',

    // Diff / Version History Comparison UI
    diffAddedBg: 'rgba(47, 191, 122, 0.18)',
    diffAddedBgStrong: 'rgba(47, 191, 122, 0.38)',
    diffAddedText: '#15803D',
    diffAddedBorder: 'rgba(47, 191, 122, 0.45)',
    diffRemovedBg: 'rgba(233, 62, 99, 0.18)',
    diffRemovedBgStrong: 'rgba(233, 62, 99, 0.38)',
    diffRemovedText: '#BE123C',
    diffRemovedBorder: 'rgba(233, 62, 99, 0.45)',
    diffModifiedBg: 'rgba(217, 154, 56, 0.18)',
    diffModifiedText: '#B45309',
    diffModifiedBorder: 'rgba(217, 154, 56, 0.45)',
    diffMovedBg: 'rgba(124, 141, 219, 0.18)',
    diffMovedText: '#4338CA',
    diffMovedBorder: 'rgba(124, 141, 219, 0.45)',
    diffGutterBg: 'rgba(0, 0, 0, 0.04)',
    diffLineNumberText: '#726472',
  },
  glassOpacity: 0.96,
  glassBlur: '18px',
};

export const coastalMintTheme: ThemeProfile = {
  ...defaultDarkTheme,
  id: 'coastal-mint',
  name: 'Coastal Mint',
  isDark: false,
  pattern: 'none',
  tokens: {
    ...defaultDarkTheme.tokens,

    backgroundGradient:
      'linear-gradient(180deg, #A5C8D1 0%, #BED6D4 50%, #D5E2D5 100%)',

    rootBg: '#BED6D4',
    appBg: '#BED6D4',

    sidebarBg: 'rgba(248, 251, 250, 0.88)',
    contentBg: 'transparent',
    panelBg: 'rgba(250, 252, 251, 0.88)',
    modalBg: 'rgba(252, 253, 252, 0.96)',
    cardBg: 'rgba(250, 252, 251, 0.92)',
    inputBg: 'rgba(248, 250, 249, 0.96)',
    editorBg: 'rgba(252, 253, 252, 0.96)',
    containerBg: 'rgba(250, 252, 251, 0.94)',
    sheetBg: 'rgba(252, 253, 252, 0.97)',
    contextMenuBg: 'rgba(252, 253, 252, 0.98)',
    backdrop: 'rgba(40, 58, 61, 0.30)',
    popupBg: 'rgba(252, 253, 252, 0.98)',
    innerPopupBg: 'rgba(246, 249, 248, 0.98)',
    tutorialCardBg: 'rgba(250, 252, 251, 0.96)',

    snippetConfigBg: '#F3F7F6',
    snippetChipBg: '#EAF1EF',

    overlayBg: 'rgba(40, 58, 61, 0.30)',
    iconDefault: '#506468',

    textPrimary: '#263538',
    textSecondary: '#43565A',
    textMuted: '#627579',
    textDisabled: 'rgba(38, 53, 56, 0.40)',
    textPlaceholder: '#708185',
    textError: '#C33D4D',
    sectionCountText: '#5E7276',

    borderDefault: 'rgba(38, 53, 56, 0.15)',
    borderActive: 'rgba(38, 53, 56, 0.28)',
    borderSelected: '#3D737F',

    hoverBg: 'rgba(202, 226, 222, 0.70)',
    selectedBg: 'rgba(186, 218, 213, 0.85)',
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

    // Widget Card & Drag State
    widgetBg: 'rgba(250, 252, 251, 0.64)',
    widgetBorder: 'rgba(255, 255, 255, 0.76)',
    widgetShadow: 'rgba(53, 78, 79, 0.20)',
    widgetToolbarBg: 'rgba(47, 67, 70, 0.90)',
    widgetToolbarBorder: 'rgba(255, 255, 255, 0.32)',
    widgetToolbarShadow: 'rgba(40, 61, 63, 0.28)',
    widgetToolbarText: '#F8FBFA',
    widgetToolbarMutedText: 'rgba(248, 251, 250, 0.72)',
    widgetToolbarActiveBg: 'rgba(252, 253, 252, 0.96)',
    widgetToolbarHoverBg: 'rgba(255, 255, 255, 0.20)',
    widgetDragPlaceholderBg: 'rgba(66, 94, 95, 0.24)',
    widgetDragShadow: 'rgba(40, 61, 63, 0.30)',
    widgetDragOutline: 'rgba(255, 255, 255, 0.78)',

    // Diff / Version History Comparison UI
    diffAddedBg: 'rgba(37, 132, 93, 0.18)',
    diffAddedBgStrong: 'rgba(37, 132, 93, 0.38)',
    diffAddedText: '#15803D',
    diffAddedBorder: 'rgba(37, 132, 93, 0.45)',
    diffRemovedBg: 'rgba(195, 61, 77, 0.18)',
    diffRemovedBgStrong: 'rgba(195, 61, 77, 0.38)',
    diffRemovedText: '#BE123C',
    diffRemovedBorder: 'rgba(195, 61, 77, 0.45)',
    diffModifiedBg: 'rgba(168, 111, 24, 0.18)',
    diffModifiedText: '#B45309',
    diffModifiedBorder: 'rgba(168, 111, 24, 0.45)',
    diffMovedBg: 'rgba(57, 124, 145, 0.18)',
    diffMovedText: '#397C91',
    diffMovedBorder: 'rgba(57, 124, 145, 0.45)',
    diffGutterBg: 'rgba(0, 0, 0, 0.04)',
    diffLineNumberText: '#627579',
  },
  glassOpacity: 0.94,
  glassBlur: '18px',
};

export const reflectTheme = coastalMintTheme;

export const periwinkleMistTheme: ThemeProfile = {
  ...defaultDarkTheme,
  id: 'periwinkle-mist',
  name: 'Periwinkle Mist',
  isDark: false,
  pattern: 'none',
  tokens: {
    ...defaultDarkTheme.tokens,

    backgroundGradient:
      'linear-gradient(180deg, #BBC6DE 0%, #C4CFE3 25%, #CCD8E7 50%, #D6E1EC 75%, #DFEAF0 100%)',

    rootBg: '#CCD8E7',
    appBg: '#CCD8E7',

    sidebarBg: 'rgba(249, 251, 254, 0.90)',
    contentBg: 'transparent',
    panelBg: 'rgba(250, 252, 255, 0.90)',
    modalBg: 'rgba(252, 253, 255, 0.97)',
    cardBg: 'rgba(250, 252, 255, 0.94)',
    inputBg: 'rgba(247, 249, 253, 0.97)',
    editorBg: 'rgba(252, 253, 255, 0.97)',
    containerBg: 'rgba(250, 252, 255, 0.95)',
    sheetBg: 'rgba(252, 253, 255, 0.98)',
    contextMenuBg: 'rgba(252, 253, 258, 0.98)',
    popupBg: 'rgba(252, 253, 255, 0.98)',
    innerPopupBg: 'rgba(246, 249, 253, 0.98)',
    tutorialCardBg: 'rgba(250, 252, 255, 0.97)',
    backdrop: 'rgba(38, 48, 68, 0.30)',

    snippetConfigBg: '#F1F4FA',
    snippetChipBg: '#E8EDF6',

    overlayBg: 'rgba(38, 48, 68, 0.30)',
    iconDefault: '#53647D',

    textPrimary: '#273445',
    textSecondary: '#435269',
    textMuted: '#627086',
    textDisabled: 'rgba(39, 52, 69, 0.40)',
    textPlaceholder: '#718096',
    textError: '#C33F55',
    sectionCountText: '#5F6E84',

    borderDefault: 'rgba(39, 52, 69, 0.15)',
    borderActive: 'rgba(96, 122, 170, 0.65)',
    borderSelected: '#607AAA',

    hoverBg: 'rgba(224, 231, 246, 0.70)',
    selectedBg: 'rgba(212, 222, 241, 0.85)',
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

    // Widget Card & Drag State
    widgetBg: 'rgba(250, 252, 255, 0.66)',
    widgetBorder: 'rgba(255, 255, 255, 0.78)',
    widgetShadow: 'rgba(59, 72, 102, 0.20)',
    widgetToolbarBg: 'rgba(48, 59, 80, 0.91)',
    widgetToolbarBorder: 'rgba(255, 255, 255, 0.32)',
    widgetToolbarShadow: 'rgba(42, 52, 73, 0.30)',
    widgetToolbarText: '#F9FAFD',
    widgetToolbarMutedText: 'rgba(249, 250, 253, 0.74)',
    widgetToolbarActiveBg: 'rgba(252, 253, 255, 0.96)',
    widgetToolbarHoverBg: 'rgba(255, 255, 255, 0.20)',
    widgetDragPlaceholderBg: 'rgba(76, 91, 125, 0.24)',
    widgetDragShadow: 'rgba(42, 52, 73, 0.30)',
    widgetDragOutline: 'rgba(255, 255, 255, 0.80)',

    // Diff / Version History Comparison UI
    diffAddedBg: 'rgba(40, 122, 91, 0.18)',
    diffAddedBgStrong: 'rgba(40, 122, 91, 0.38)',
    diffAddedText: '#15803D',
    diffAddedBorder: 'rgba(40, 122, 91, 0.45)',
    diffRemovedBg: 'rgba(195, 63, 85, 0.18)',
    diffRemovedBgStrong: 'rgba(195, 63, 85, 0.38)',
    diffRemovedText: '#BE123C',
    diffRemovedBorder: 'rgba(195, 63, 85, 0.45)',
    diffModifiedBg: 'rgba(165, 109, 25, 0.18)',
    diffModifiedText: '#B45309',
    diffModifiedBorder: 'rgba(165, 109, 25, 0.45)',
    diffMovedBg: 'rgba(79, 117, 168, 0.18)',
    diffMovedText: '#4F75A8',
    diffMovedBorder: 'rgba(79, 117, 168, 0.45)',
    diffGutterBg: 'rgba(0, 0, 0, 0.04)',
    diffLineNumberText: '#627086',
  },
  glassOpacity: 0.94,
  glassBlur: '18px',
};

export const midnightStarsTheme: ThemeProfile = {
  ...defaultDarkTheme,
  id: 'midnight-stars',
  name: 'Midnight Stars',
  isDark: true,
  pattern: 'midnight-stars',
  tokens: {
    ...defaultDarkTheme.tokens,
    backgroundGradient: 'linear-gradient(180deg, #19202A 0%, #343A43 100%)',

    rootBg: '#19202A',
    appBg: '#242A34',
    sidebarBg: '#202731',
    contentBg: 'transparent',

    panelBg: '#3A414A',
    modalBg: '#343B44',
    cardBg: '#3A414A',
    inputBg: '#333A43',
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

    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    info: '#8FB7E3',

    tutorialTextTitle: '#F4F7FA',
    tutorialTextGradientStart: '#8FB7E3',
    tutorialTextGradientEnd: '#C084FC',
    tutorialTextDescription: '#C7D0DA',
    tutorialAccent: '#8FB7E3',
    tutorialAccentMuted: 'rgba(143, 183, 227, 0.16)',

    // Widget Card & Drag State
    widgetBg: 'rgba(58, 65, 74, 0.82)',
    widgetBorder: 'rgba(255, 255, 255, 0.15)',
    widgetShadow: 'rgba(0, 0, 0, 0.38)',
    widgetToolbarBg: 'rgba(48, 55, 64, 0.94)',
    widgetToolbarBorder: 'rgba(255, 255, 255, 0.15)',
    widgetToolbarShadow: 'rgba(0, 0, 0, 0.48)',
    widgetToolbarText: '#F4F7FA',
    widgetToolbarMutedText: 'rgba(244, 247, 250, 0.72)',
    widgetToolbarActiveBg: 'rgba(255, 255, 255, 0.92)',
    widgetToolbarHoverBg: 'rgba(255, 255, 255, 0.14)',
    widgetDragPlaceholderBg: 'rgba(52, 58, 67, 0.68)',
    widgetDragShadow: 'rgba(0, 0, 0, 0.52)',
    widgetDragOutline: 'rgba(143, 183, 227, 0.38)',
  },
  glassOpacity: 0.88,
  glassBlur: '14px',
};

export const DEFAULT_THEME_ID = 'midnight-stars';

export const themeRegistry: Record<string, ThemeProfile> = {
  'ocean-blue': oceanBlueTheme,
  'cherry-blossom': cherryBlossomTheme,
  'midnight-stars': midnightStarsTheme,
  'coastal-mint': coastalMintTheme,
  'reflect-gradient': coastalMintTheme,
  'periwinkle-mist': periwinkleMistTheme,
};

export function isValidThemeId(id: string): boolean {
  return Boolean(id && themeRegistry[id]);
}

export function getRandomValidThemeId(): string {
  const themeIds = Object.keys(themeRegistry);
  const randomIndex = Math.floor(Math.random() * themeIds.length);
  return themeIds[randomIndex] || DEFAULT_THEME_ID;
}

export function getTheme(id: string): ThemeProfile {
  if (id === 'dark' || id === 'default-dark') {
    return midnightStarsTheme;
  }
  if (isValidThemeId(id)) {
    return themeRegistry[id];
  }
  return themeRegistry[DEFAULT_THEME_ID] || midnightStarsTheme;
}

