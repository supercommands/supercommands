export type OnboardingStepId =
  | 'dashboard_views'
  | 'organization'
  | 'theme'
  | 'presentation'
  | 'restore_options'
  | 'restore_success'
  | 'cloud_migration_onboarding';

export type OnboardingWidthMode = 'belowMinimum' | 'minimumDesktop' | 'standardDesktop' | 'wideDesktop';
export type OnboardingHeightMode = 'short' | 'compact' | 'normal' | 'tall';
export type OnboardingCardDensity = 'compact' | 'normal' | 'wide';

export interface OnboardingViewport {
  width: number;
  height: number;
}

export interface OnboardingStepCountLayout {
  paddingTop: number;
  paddingBottom: number;
  gap: number;
  labelFontSize: number;
  labelFontWeight: number;
  labelLetterSpacing: string;
  labelTextTransform: 'uppercase';
  labelColor: string;
  progressWidth: number;
  progressHeight: number;
  progressGap: number;
  progressRadius: number;
  progressActiveColor: string;
  progressInactiveColor: string;
}

export interface OnboardingTitleLayout {
  gap: number;
  titleFontSize: number;
  titleLineHeight: number;
  titleFontWeight: number;
  titleLetterSpacing: string;
  titleColor: string;
  subtitleFontSize: number;
  subtitleLineHeight: number;
  subtitleMarginTop: number;
  subtitleFontWeight: number;
  subtitleColor: string;
}

export interface OnboardingRoleCategoryLayout {
  sectionMarginTop: number;
  headingMarginBottom: number;
  headingFontSize: number;
  headingFontWeight: number;
  headingLetterSpacing: string;
  headingColor: string;
  gridColumns: number;
  gridGap: number;
  cardMinHeight: number;
  cardPaddingX: number;
  cardPaddingY: number;
  cardGap: number;
  cardRadius: number;
  selectedBadgeSize: number;
  selectedBadgeOffset: number;
  selectedBadgeIconSize: number;
  selectedBadgeBorderColor: string;
  selectedBadgeBackground: string;
  selectedBadgeColor: string;
  iconFontSize: number;
  labelFontSize: number;
  labelLineHeight: number;
  labelFontWeight: number;
  selectedBorderColor: string;
  selectedBackground: string;
  selectedIconColor: string;
  selectedLabelColor: string;
  unselectedBorderColor: string;
  unselectedBackground: string;
  unselectedIconColor: string;
  unselectedLabelColor: string;
}

export interface OnboardingScreenLayout {
  paddingX: number;
  paddingTop: number;
  paddingBottom: number;
}

export interface OnboardingDividerLayout {
  marginY: number;
  color: string;
}

export interface OnboardingTemplateCardsLayout {
  sectionMarginTop: number;
  headingMarginBottom: number;
  headingFontSize: number;
  headingFontWeight: number;
  headingLetterSpacing: string;
  headingColor: string;
  validationFontSize: number;
  validationFontWeight: number;
  validationPaddingX: number;
  validationPaddingY: number;
  validationGap: number;
  validationRadius: number;
  validationColor: string;
  validationBackground: string;
  validationBorderColor: string;
  gridColumns: number;
  gridGap: number;
  cardRadius: number;
  selectedBadgeSize: number;
  selectedBadgeOffset: number;
  selectedBadgeIconSize: number;
  selectedBadgeBorderColor: string;
  selectedBadgeBackground: string;
  selectedBadgeColor: string;
  unselectedBadgeBorderColor: string;
  unselectedBadgeBackground: string;
  unselectedBadgeColor: string;
  cardBackground: string;
  cardHeaderPadding: number;
  cardHeaderGap: number;
  cardHeaderTextPaddingRight: number;
  cardTitleFontSize: number;
  cardTitleLineHeight: number;
  cardTitleFontWeight: number;
  cardTitleColor: string;
  cardDescriptionFontSize: number;
  cardDescriptionLineHeight: number;
  cardDescriptionFontWeight: number;
  cardDescriptionColor: string;
  iconTileSize: number;
  iconTileRadius: number;
  iconSize: number;
  objectSectionPadding: number;
  objectSectionGap: number;
  objectRowMinHeight: number;
  objectRowGap: number;
  objectIconSize: number;
  objectIconColor: string;
  objectTitleFontSize: number;
  objectTitleLineHeight: number;
  objectTitleFontWeight: number;
  objectTitleColor: string;
  objectTypeFontSize: number;
  objectTypeLineHeight: number;
  objectTypeFontWeight: number;
  objectTypeColor: string;
  formSectionPadding: number;
  formSectionGap: number;
  fieldLabelFontSize: number;
  fieldLabelFontWeight: number;
  fieldLabelLetterSpacing: string;
  fieldLabelColor: string;
  fieldControlHeight: number;
  fieldControlPaddingX: number;
  fieldControlRadius: number;
  fieldControlGap: number;
  fieldControlBorderColor: string;
  fieldControlBackground: string;
  fieldPrefixFontSize: number;
  fieldPrefixFontWeight: number;
  fieldPrefixColor: string;
  fieldTextFontSize: number;
  fieldTextFontWeight: number;
  fieldTextColor: string;
  fieldInputPaddingX: number;
  fieldInputPaddingY: number;
  fieldInputRadius: number;
  fieldInputBorderColor: string;
  fieldInputBackground: string;
  editButtonSize: number;
  editButtonRadius: number;
  editButtonIconSize: number;
  editButtonColor: string;
  editButtonHoverColor: string;
  editButtonHoverBackground: string;
  errorFontSize: number;
  errorFontWeight: number;
  errorColor: string;
}

export interface OnboardingDashboardViewsLayout {
  stepId: 'dashboard_views';
  widthMode: OnboardingWidthMode;
  heightMode: OnboardingHeightMode;
  cardDensity: OnboardingCardDensity;
  maxContentWidth: number;
  dashboardCardColumns: number;
  shouldUseCompactSpacing: boolean;
  stepCount: OnboardingStepCountLayout;
  screen: OnboardingScreenLayout;
  title: OnboardingTitleLayout;
  roleCategories: OnboardingRoleCategoryLayout;
  divider: OnboardingDividerLayout;
  templateCards: OnboardingTemplateCardsLayout;
}

export interface OnboardingThemeLayout {
  stepId: 'theme';
  widthMode: OnboardingWidthMode;
  heightMode: OnboardingHeightMode;
  cardDensity: OnboardingCardDensity;
  screen: OnboardingScreenLayout;
  stepCount: OnboardingStepCountLayout;
  contentMaxWidth: number;
  contentGap: number;
  headerGap: number;
  titleFontSize: number;
  titleLineHeight: number;
  titleFontWeight: number;
  subtitleFontSize: number;
  subtitleLineHeight: number;
  sectionGap: number;
  sectionTitleFontSize: number;
  sectionTitleFontWeight: number;
  groupGap: number;
  groupTitleFontSize: number;
  groupTitleFontWeight: number;
  gridColumns: number;
  gridGap: number;
  itemWidth: number;
  itemHeight: number;
  itemRadius: number;
  selectedBadgeSize: number;
  selectedBadgeOffset: number;
  selectedBadgeIconSize: number;
  namePillPaddingX: number;
  namePillPaddingY: number;
  namePillOffset: number;
  namePillRadius: number;
  nameFontSize: number;
  nameFontWeight: number;
  wallpaperSectionPaddingTop: number;
}

export const ONBOARDING_LAYOUT_SCHEMA = {
  breakpoints: {
    minimumDesktop: 1200,
    standardDesktop: 1366,
    wideDesktop: 1600,
  },
  heightBands: {
    compact: 760,
    normal: 820,
    tall: 1000,
  },
  contentWidth: {
    compact: 1140,
    normal: 1240,
    wide: 1360,
  },
  dashboardViews: {
    minFullCardRowWidth: 1200,
    cardColumns: 4,
  },
  screen: {
    short: {
      paddingX: 20,
      paddingTop: 8,
      paddingBottom: 12,
    },
    compact: {
      paddingX: 28,
      paddingTop: 14,
      paddingBottom: 18,
    },
    normal: {
      paddingX: 40,
      paddingTop: 22,
      paddingBottom: 24,
    },
    tall: {
      paddingX: 48,
      paddingTop: 28,
      paddingBottom: 32,
    },
  },
  stepCount: {
    short: {
      paddingTop: 4,
      paddingBottom: 8,
      gap: 6,
      labelFontSize: 11,
      labelFontWeight: 600,
      labelLetterSpacing: '0.05em',
      labelTextTransform: 'uppercase',
      labelColor: 'var(--color-tutorialTextDescription)',
      progressWidth: 128,
      progressHeight: 4,
      progressGap: 6,
      progressRadius: 999,
      progressActiveColor: 'var(--color-tutorialAccent)',
      progressInactiveColor: 'var(--color-borderDefault)',
    },
    compact: {
      paddingTop: 10,
      paddingBottom: 12,
      gap: 6,
      labelFontSize: 11,
      labelFontWeight: 700,
      labelLetterSpacing: '0.05em',
      labelTextTransform: 'uppercase',
      labelColor: 'var(--color-tutorialTextDescription)',
      progressWidth: 128,
      progressHeight: 4,
      progressGap: 6,
      progressRadius: 999,
      progressActiveColor: 'var(--color-tutorialAccent)',
      progressInactiveColor: 'var(--color-borderDefault)',
    },
    normal: {
      paddingTop: 16,
      paddingBottom: 18,
      gap: 6,
      labelFontSize: 11,
      labelFontWeight: 700,
      labelLetterSpacing: '0.05em',
      labelTextTransform: 'uppercase',
      labelColor: 'var(--color-tutorialTextDescription)',
      progressWidth: 144,
      progressHeight: 4,
      progressGap: 6,
      progressRadius: 999,
      progressActiveColor: 'var(--color-tutorialAccent)',
      progressInactiveColor: 'var(--color-borderDefault)',
    },
    tall: {
      paddingTop: 24,
      paddingBottom: 26,
      gap: 7,
      labelFontSize: 11,
      labelFontWeight: 700,
      labelLetterSpacing: '0.05em',
      labelTextTransform: 'uppercase',
      labelColor: 'var(--color-tutorialTextDescription)',
      progressWidth: 152,
      progressHeight: 4,
      progressGap: 6,
      progressRadius: 999,
      progressActiveColor: 'var(--color-tutorialAccent)',
      progressInactiveColor: 'var(--color-borderDefault)',
    },
  },
  title: {
    compact: {
      gap: 4,
      titleFontSize: 30,
      titleLineHeight: 1.12,
      titleFontWeight: 800,
      titleLetterSpacing: '0',
      titleColor: 'var(--color-tutorialTextTitle)',
      subtitleFontSize: 12,
      subtitleLineHeight: 1.35,
      subtitleMarginTop: 4,
      subtitleFontWeight: 500,
      subtitleColor: 'var(--color-tutorialTextDescription)',
    },
    normal: {
      gap: 4,
      titleFontSize: 34,
      titleLineHeight: 1.12,
      titleFontWeight: 800,
      titleLetterSpacing: '0',
      titleColor: 'var(--color-tutorialTextTitle)',
      subtitleFontSize: 14,
      subtitleLineHeight: 1.45,
      subtitleMarginTop: 4,
      subtitleFontWeight: 500,
      subtitleColor: 'var(--color-tutorialTextDescription)',
    },
    wide: {
      gap: 6,
      titleFontSize: 40,
      titleLineHeight: 1.12,
      titleFontWeight: 800,
      titleLetterSpacing: '0',
      titleColor: 'var(--color-tutorialTextTitle)',
      subtitleFontSize: 14,
      subtitleLineHeight: 1.45,
      subtitleMarginTop: 4,
      subtitleFontWeight: 500,
      subtitleColor: 'var(--color-tutorialTextDescription)',
    },
  },
  roleCategories: {
    compact: {
      sectionMarginTop: 0,
      headingMarginBottom: 6,
      headingFontSize: 11,
      headingFontWeight: 700,
      headingLetterSpacing: '0.05em',
      headingColor: 'var(--color-textMuted)',
      gridColumns: 7,
      gridGap: 8,
      cardMinHeight: 56,
      cardPaddingX: 8,
      cardPaddingY: 6,
      cardGap: 4,
      cardRadius: 12,
      selectedBadgeSize: 14,
      selectedBadgeOffset: 5,
      selectedBadgeIconSize: 7,
      selectedBadgeBorderColor: 'var(--color-tutorialAccent)',
      selectedBadgeBackground: 'var(--color-tutorialCardBg)',
      selectedBadgeColor: 'var(--color-tutorialAccent)',
      iconFontSize: 18,
      labelFontSize: 10,
      labelLineHeight: 1.15,
      labelFontWeight: 700,
      selectedBorderColor: 'var(--color-tutorialAccent)',
      selectedBackground: 'var(--color-selectedBg)',
      selectedIconColor: 'var(--color-tutorialAccent)',
      selectedLabelColor: 'var(--color-textPrimary)',
      unselectedBorderColor: 'var(--color-borderDefault)',
      unselectedBackground: 'var(--color-tutorialCardBg)',
      unselectedIconColor: 'var(--color-textMuted)',
      unselectedLabelColor: 'var(--color-textSecondary)',
    },
    normal: {
      sectionMarginTop: 4,
      headingMarginBottom: 8,
      headingFontSize: 12,
      headingFontWeight: 700,
      headingLetterSpacing: '0.05em',
      headingColor: 'var(--color-textMuted)',
      gridColumns: 7,
      gridGap: 11,
      cardMinHeight: 78,
      cardPaddingX: 12,
      cardPaddingY: 10,
      cardGap: 6,
      cardRadius: 12,
      selectedBadgeSize: 16,
      selectedBadgeOffset: 6,
      selectedBadgeIconSize: 8,
      selectedBadgeBorderColor: 'var(--color-tutorialAccent)',
      selectedBadgeBackground: 'var(--color-tutorialCardBg)',
      selectedBadgeColor: 'var(--color-tutorialAccent)',
      iconFontSize: 22,
      labelFontSize: 12,
      labelLineHeight: 1.15,
      labelFontWeight: 600,
      selectedBorderColor: 'var(--color-tutorialAccent)',
      selectedBackground: 'var(--color-selectedBg)',
      selectedIconColor: 'var(--color-tutorialAccent)',
      selectedLabelColor: 'var(--color-textPrimary)',
      unselectedBorderColor: 'var(--color-borderDefault)',
      unselectedBackground: 'var(--color-tutorialCardBg)',
      unselectedIconColor: 'var(--color-textMuted)',
      unselectedLabelColor: 'var(--color-textSecondary)',
    },
    wide: {
      sectionMarginTop: 6,
      headingMarginBottom: 10,
      headingFontSize: 12,
      headingFontWeight: 700,
      headingLetterSpacing: '0.05em',
      headingColor: 'var(--color-textMuted)',
      gridColumns: 7,
      gridGap: 12,
      cardMinHeight: 82,
      cardPaddingX: 14,
      cardPaddingY: 11,
      cardGap: 7,
      cardRadius: 12,
      selectedBadgeSize: 16,
      selectedBadgeOffset: 6,
      selectedBadgeIconSize: 8,
      selectedBadgeBorderColor: 'var(--color-tutorialAccent)',
      selectedBadgeBackground: 'var(--color-tutorialCardBg)',
      selectedBadgeColor: 'var(--color-tutorialAccent)',
      iconFontSize: 23,
      labelFontSize: 12,
      labelLineHeight: 1.15,
      labelFontWeight: 600,
      selectedBorderColor: 'var(--color-tutorialAccent)',
      selectedBackground: 'var(--color-selectedBg)',
      selectedIconColor: 'var(--color-tutorialAccent)',
      selectedLabelColor: 'var(--color-textPrimary)',
      unselectedBorderColor: 'var(--color-borderDefault)',
      unselectedBackground: 'var(--color-tutorialCardBg)',
      unselectedIconColor: 'var(--color-textMuted)',
      unselectedLabelColor: 'var(--color-textSecondary)',
    },
  },
  divider: {
    compact: {
      marginY: 0,
      color: 'var(--color-borderDefault)',
    },
    normal: {
      marginY: 4,
      color: 'var(--color-borderDefault)',
    },
    wide: {
      marginY: 6,
      color: 'var(--color-borderDefault)',
    },
  },
  templateCards: {
    compact: {
      sectionMarginTop: 0,
      headingMarginBottom: 8,
      headingFontSize: 18,
      headingFontWeight: 800,
      headingLetterSpacing: '0',
      headingColor: 'var(--color-tutorialTextTitle)',
      validationFontSize: 12,
      validationFontWeight: 700,
      validationPaddingX: 10,
      validationPaddingY: 4,
      validationGap: 6,
      validationRadius: 6,
      validationColor: 'var(--color-danger)',
      validationBackground: 'color-mix(in srgb, var(--color-danger) 8%, var(--color-tutorialCardBg))',
      validationBorderColor: 'color-mix(in srgb, var(--color-danger) 18%, var(--color-borderDefault))',
      gridColumns: 4,
      gridGap: 8,
      cardRadius: 16,
      selectedBadgeSize: 18,
      selectedBadgeOffset: 10,
      selectedBadgeIconSize: 8,
      selectedBadgeBorderColor: 'var(--color-borderDefault)',
      selectedBadgeBackground: 'var(--color-selectedBg)',
      selectedBadgeColor: 'var(--color-textPrimary)',
      unselectedBadgeBorderColor: 'var(--color-borderDefault)',
      unselectedBadgeBackground: 'var(--color-tutorialCardBg)',
      unselectedBadgeColor: 'transparent',
      cardBackground: 'var(--color-tutorialCardBg)',
      cardHeaderPadding: 10,
      cardHeaderGap: 7,
      cardHeaderTextPaddingRight: 20,
      cardTitleFontSize: 14,
      cardTitleLineHeight: 1.18,
      cardTitleFontWeight: 700,
      cardTitleColor: 'var(--color-textPrimary)',
      cardDescriptionFontSize: 11,
      cardDescriptionLineHeight: 1.28,
      cardDescriptionFontWeight: 400,
      cardDescriptionColor: 'var(--color-tutorialTextDescription)',
      iconTileSize: 34,
      iconTileRadius: 12,
      iconSize: 17,
      objectSectionPadding: 8,
      objectSectionGap: 5,
      objectRowMinHeight: 18,
      objectRowGap: 6,
      objectIconSize: 12,
      objectIconColor: 'var(--color-textMuted)',
      objectTitleFontSize: 11,
      objectTitleLineHeight: 1.2,
      objectTitleFontWeight: 600,
      objectTitleColor: 'var(--color-textPrimary)',
      objectTypeFontSize: 10,
      objectTypeLineHeight: 1.1,
      objectTypeFontWeight: 500,
      objectTypeColor: 'var(--color-textMuted)',
      formSectionPadding: 8,
      formSectionGap: 4,
      fieldLabelFontSize: 10,
      fieldLabelFontWeight: 700,
      fieldLabelLetterSpacing: '0.05em',
      fieldLabelColor: 'var(--color-textMuted)',
      fieldControlHeight: 30,
      fieldControlPaddingX: 8,
      fieldControlRadius: 12,
      fieldControlGap: 8,
      fieldControlBorderColor: 'var(--color-borderDefault)',
      fieldControlBackground: 'var(--color-tutorialCardBg)',
      fieldPrefixFontSize: 12,
      fieldPrefixFontWeight: 700,
      fieldPrefixColor: 'var(--color-textPrimary)',
      fieldTextFontSize: 11,
      fieldTextFontWeight: 600,
      fieldTextColor: 'var(--color-textPrimary)',
      fieldInputPaddingX: 8,
      fieldInputPaddingY: 2,
      fieldInputRadius: 6,
      fieldInputBorderColor: 'var(--color-tutorialAccent)',
      fieldInputBackground: 'var(--color-tutorialCardBg)',
      editButtonSize: 22,
      editButtonRadius: 6,
      editButtonIconSize: 12,
      editButtonColor: 'var(--color-textMuted)',
      editButtonHoverColor: 'var(--color-tutorialAccent)',
      editButtonHoverBackground: 'var(--color-selectedBg)',
      errorFontSize: 12,
      errorFontWeight: 500,
      errorColor: 'var(--color-danger)',
    },
    normal: {
      sectionMarginTop: 0,
      headingMarginBottom: 10,
      headingFontSize: 20,
      headingFontWeight: 800,
      headingLetterSpacing: '0',
      headingColor: 'var(--color-tutorialTextTitle)',
      validationFontSize: 12,
      validationFontWeight: 700,
      validationPaddingX: 12,
      validationPaddingY: 4,
      validationGap: 6,
      validationRadius: 6,
      validationColor: 'var(--color-danger)',
      validationBackground: 'color-mix(in srgb, var(--color-danger) 8%, var(--color-tutorialCardBg))',
      validationBorderColor: 'color-mix(in srgb, var(--color-danger) 18%, var(--color-borderDefault))',
      gridColumns: 4,
      gridGap: 14,
      cardRadius: 16,
      selectedBadgeSize: 20,
      selectedBadgeOffset: 14,
      selectedBadgeIconSize: 9,
      selectedBadgeBorderColor: 'var(--color-borderDefault)',
      selectedBadgeBackground: 'var(--color-selectedBg)',
      selectedBadgeColor: 'var(--color-textPrimary)',
      unselectedBadgeBorderColor: 'var(--color-borderDefault)',
      unselectedBadgeBackground: 'var(--color-tutorialCardBg)',
      unselectedBadgeColor: 'transparent',
      cardBackground: 'var(--color-tutorialCardBg)',
      cardHeaderPadding: 16,
      cardHeaderGap: 10,
      cardHeaderTextPaddingRight: 22,
      cardTitleFontSize: 17,
      cardTitleLineHeight: 1.2,
      cardTitleFontWeight: 700,
      cardTitleColor: 'var(--color-textPrimary)',
      cardDescriptionFontSize: 12,
      cardDescriptionLineHeight: 1.4,
      cardDescriptionFontWeight: 400,
      cardDescriptionColor: 'var(--color-tutorialTextDescription)',
      iconTileSize: 40,
      iconTileRadius: 12,
      iconSize: 20,
      objectSectionPadding: 14,
      objectSectionGap: 8,
      objectRowMinHeight: 22,
      objectRowGap: 8,
      objectIconSize: 13,
      objectIconColor: 'var(--color-textMuted)',
      objectTitleFontSize: 13,
      objectTitleLineHeight: 1.2,
      objectTitleFontWeight: 600,
      objectTitleColor: 'var(--color-textPrimary)',
      objectTypeFontSize: 11,
      objectTypeLineHeight: 1.1,
      objectTypeFontWeight: 500,
      objectTypeColor: 'var(--color-textMuted)',
      formSectionPadding: 14,
      formSectionGap: 6,
      fieldLabelFontSize: 11,
      fieldLabelFontWeight: 700,
      fieldLabelLetterSpacing: '0.05em',
      fieldLabelColor: 'var(--color-textMuted)',
      fieldControlHeight: 36,
      fieldControlPaddingX: 12,
      fieldControlRadius: 12,
      fieldControlGap: 8,
      fieldControlBorderColor: 'var(--color-borderDefault)',
      fieldControlBackground: 'var(--color-tutorialCardBg)',
      fieldPrefixFontSize: 14,
      fieldPrefixFontWeight: 700,
      fieldPrefixColor: 'var(--color-textPrimary)',
      fieldTextFontSize: 14,
      fieldTextFontWeight: 600,
      fieldTextColor: 'var(--color-textPrimary)',
      fieldInputPaddingX: 8,
      fieldInputPaddingY: 2,
      fieldInputRadius: 6,
      fieldInputBorderColor: 'var(--color-tutorialAccent)',
      fieldInputBackground: 'var(--color-tutorialCardBg)',
      editButtonSize: 22,
      editButtonRadius: 6,
      editButtonIconSize: 12,
      editButtonColor: 'var(--color-textMuted)',
      editButtonHoverColor: 'var(--color-tutorialAccent)',
      editButtonHoverBackground: 'var(--color-selectedBg)',
      errorFontSize: 12,
      errorFontWeight: 500,
      errorColor: 'var(--color-danger)',
    },
    wide: {
      sectionMarginTop: 0,
      headingMarginBottom: 12,
      headingFontSize: 21,
      headingFontWeight: 800,
      headingLetterSpacing: '0',
      headingColor: 'var(--color-tutorialTextTitle)',
      validationFontSize: 12,
      validationFontWeight: 700,
      validationPaddingX: 12,
      validationPaddingY: 5,
      validationGap: 6,
      validationRadius: 6,
      validationColor: 'var(--color-danger)',
      validationBackground: 'color-mix(in srgb, var(--color-danger) 8%, var(--color-tutorialCardBg))',
      validationBorderColor: 'color-mix(in srgb, var(--color-danger) 18%, var(--color-borderDefault))',
      gridColumns: 4,
      gridGap: 16,
      cardRadius: 16,
      selectedBadgeSize: 20,
      selectedBadgeOffset: 14,
      selectedBadgeIconSize: 9,
      selectedBadgeBorderColor: 'var(--color-borderDefault)',
      selectedBadgeBackground: 'var(--color-selectedBg)',
      selectedBadgeColor: 'var(--color-textPrimary)',
      unselectedBadgeBorderColor: 'var(--color-borderDefault)',
      unselectedBadgeBackground: 'var(--color-tutorialCardBg)',
      unselectedBadgeColor: 'transparent',
      cardBackground: 'var(--color-tutorialCardBg)',
      cardHeaderPadding: 17,
      cardHeaderGap: 11,
      cardHeaderTextPaddingRight: 24,
      cardTitleFontSize: 18,
      cardTitleLineHeight: 1.2,
      cardTitleFontWeight: 700,
      cardTitleColor: 'var(--color-textPrimary)',
      cardDescriptionFontSize: 13,
      cardDescriptionLineHeight: 1.4,
      cardDescriptionFontWeight: 400,
      cardDescriptionColor: 'var(--color-tutorialTextDescription)',
      iconTileSize: 42,
      iconTileRadius: 12,
      iconSize: 21,
      objectSectionPadding: 15,
      objectSectionGap: 9,
      objectRowMinHeight: 23,
      objectRowGap: 8,
      objectIconSize: 13,
      objectIconColor: 'var(--color-textMuted)',
      objectTitleFontSize: 13,
      objectTitleLineHeight: 1.2,
      objectTitleFontWeight: 600,
      objectTitleColor: 'var(--color-textPrimary)',
      objectTypeFontSize: 12,
      objectTypeLineHeight: 1.1,
      objectTypeFontWeight: 500,
      objectTypeColor: 'var(--color-textMuted)',
      formSectionPadding: 15,
      formSectionGap: 7,
      fieldLabelFontSize: 11,
      fieldLabelFontWeight: 700,
      fieldLabelLetterSpacing: '0.05em',
      fieldLabelColor: 'var(--color-textMuted)',
      fieldControlHeight: 36,
      fieldControlPaddingX: 12,
      fieldControlRadius: 12,
      fieldControlGap: 8,
      fieldControlBorderColor: 'var(--color-borderDefault)',
      fieldControlBackground: 'var(--color-tutorialCardBg)',
      fieldPrefixFontSize: 14,
      fieldPrefixFontWeight: 700,
      fieldPrefixColor: 'var(--color-textPrimary)',
      fieldTextFontSize: 14,
      fieldTextFontWeight: 600,
      fieldTextColor: 'var(--color-textPrimary)',
      fieldInputPaddingX: 8,
      fieldInputPaddingY: 2,
      fieldInputRadius: 6,
      fieldInputBorderColor: 'var(--color-tutorialAccent)',
      fieldInputBackground: 'var(--color-tutorialCardBg)',
      editButtonSize: 22,
      editButtonRadius: 6,
      editButtonIconSize: 12,
      editButtonColor: 'var(--color-textMuted)',
      editButtonHoverColor: 'var(--color-tutorialAccent)',
      editButtonHoverBackground: 'var(--color-selectedBg)',
      errorFontSize: 12,
      errorFontWeight: 500,
      errorColor: 'var(--color-danger)',
    },
  },
  theme: {
    compact: {
      contentMaxWidth: 960,
      contentGap: 14,
      headerGap: 6,
      titleFontSize: 22,
      titleLineHeight: 1.18,
      titleFontWeight: 500,
      subtitleFontSize: 13,
      subtitleLineHeight: 1.35,
      sectionGap: 14,
      sectionTitleFontSize: 15,
      sectionTitleFontWeight: 700,
      groupGap: 9,
      groupTitleFontSize: 11,
      groupTitleFontWeight: 600,
      gridColumns: 6,
      gridGap: 10,
      itemWidth: 140,
      itemHeight: 82,
      itemRadius: 12,
      selectedBadgeSize: 18,
      selectedBadgeOffset: 8,
      selectedBadgeIconSize: 8,
      namePillPaddingX: 8,
      namePillPaddingY: 2,
      namePillOffset: 8,
      namePillRadius: 6,
      nameFontSize: 9,
      nameFontWeight: 700,
      wallpaperSectionPaddingTop: 12,
    },
    normal: {
      contentMaxWidth: 1080,
      contentGap: 18,
      headerGap: 8,
      titleFontSize: 26,
      titleLineHeight: 1.2,
      titleFontWeight: 500,
      subtitleFontSize: 15,
      subtitleLineHeight: 1.45,
      sectionGap: 18,
      sectionTitleFontSize: 17,
      sectionTitleFontWeight: 700,
      groupGap: 10,
      groupTitleFontSize: 12,
      groupTitleFontWeight: 600,
      gridColumns: 6,
      gridGap: 12,
      itemWidth: 160,
      itemHeight: 95,
      itemRadius: 12,
      selectedBadgeSize: 20,
      selectedBadgeOffset: 10,
      selectedBadgeIconSize: 9,
      namePillPaddingX: 10,
      namePillPaddingY: 2,
      namePillOffset: 10,
      namePillRadius: 6,
      nameFontSize: 10,
      nameFontWeight: 700,
      wallpaperSectionPaddingTop: 16,
    },
    wide: {
      contentMaxWidth: 1180,
      contentGap: 22,
      headerGap: 10,
      titleFontSize: 30,
      titleLineHeight: 1.2,
      titleFontWeight: 500,
      subtitleFontSize: 16,
      subtitleLineHeight: 1.5,
      sectionGap: 20,
      sectionTitleFontSize: 18,
      sectionTitleFontWeight: 700,
      groupGap: 12,
      groupTitleFontSize: 12,
      groupTitleFontWeight: 600,
      gridColumns: 6,
      gridGap: 14,
      itemWidth: 172,
      itemHeight: 102,
      itemRadius: 12,
      selectedBadgeSize: 20,
      selectedBadgeOffset: 10,
      selectedBadgeIconSize: 9,
      namePillPaddingX: 10,
      namePillPaddingY: 3,
      namePillOffset: 10,
      namePillRadius: 6,
      nameFontSize: 10,
      nameFontWeight: 700,
      wallpaperSectionPaddingTop: 18,
    },
  },
} as const;

export const getOnboardingWidthMode = (width: number): OnboardingWidthMode => {
  if (width < ONBOARDING_LAYOUT_SCHEMA.breakpoints.minimumDesktop) return 'belowMinimum';
  if (width < ONBOARDING_LAYOUT_SCHEMA.breakpoints.standardDesktop) return 'minimumDesktop';
  if (width < ONBOARDING_LAYOUT_SCHEMA.breakpoints.wideDesktop) return 'standardDesktop';
  return 'wideDesktop';
};

export const getOnboardingHeightMode = (height: number): OnboardingHeightMode => {
  if (height < ONBOARDING_LAYOUT_SCHEMA.heightBands.compact) return 'short';
  if (height < ONBOARDING_LAYOUT_SCHEMA.heightBands.normal) return 'compact';
  if (height >= ONBOARDING_LAYOUT_SCHEMA.heightBands.tall) return 'tall';
  return 'normal';
};

export const getOnboardingDashboardViewsLayout = (
  viewport: OnboardingViewport,
): OnboardingDashboardViewsLayout => {
  const widthMode = getOnboardingWidthMode(viewport.width);
  const heightMode = getOnboardingHeightMode(viewport.height);
  const shouldUseCompactSpacing =
    widthMode === 'belowMinimum' ||
    widthMode === 'minimumDesktop' ||
    heightMode === 'short' ||
    heightMode === 'compact';
  const cardDensity: OnboardingCardDensity =
    widthMode === 'wideDesktop' && (heightMode === 'normal' || heightMode === 'tall')
      ? 'wide'
      : shouldUseCompactSpacing
        ? 'compact'
        : 'normal';

  const maxContentWidth =
    cardDensity === 'wide'
      ? ONBOARDING_LAYOUT_SCHEMA.contentWidth.wide
      : cardDensity === 'compact'
        ? ONBOARDING_LAYOUT_SCHEMA.contentWidth.compact
        : ONBOARDING_LAYOUT_SCHEMA.contentWidth.normal;

  return {
    stepId: 'dashboard_views',
    widthMode,
    heightMode,
    cardDensity,
    maxContentWidth,
    dashboardCardColumns: ONBOARDING_LAYOUT_SCHEMA.dashboardViews.cardColumns,
    shouldUseCompactSpacing,
    stepCount: ONBOARDING_LAYOUT_SCHEMA.stepCount[heightMode],
    screen: ONBOARDING_LAYOUT_SCHEMA.screen[heightMode],
    title: ONBOARDING_LAYOUT_SCHEMA.title[cardDensity],
    roleCategories: ONBOARDING_LAYOUT_SCHEMA.roleCategories[cardDensity],
    divider: ONBOARDING_LAYOUT_SCHEMA.divider[cardDensity],
    templateCards: ONBOARDING_LAYOUT_SCHEMA.templateCards[cardDensity],
  };
};

const getOnboardingCardDensity = (
  widthMode: OnboardingWidthMode,
  heightMode: OnboardingHeightMode,
): OnboardingCardDensity => {
  const shouldUseCompactSpacing =
    widthMode === 'belowMinimum' ||
    widthMode === 'minimumDesktop' ||
    heightMode === 'short' ||
    heightMode === 'compact';

  if (widthMode === 'wideDesktop' && (heightMode === 'normal' || heightMode === 'tall')) return 'wide';
  return shouldUseCompactSpacing ? 'compact' : 'normal';
};

export const getOnboardingThemeLayout = (viewport: OnboardingViewport): OnboardingThemeLayout => {
  const widthMode = getOnboardingWidthMode(viewport.width);
  const heightMode = getOnboardingHeightMode(viewport.height);
  const cardDensity = getOnboardingCardDensity(widthMode, heightMode);

  return {
    stepId: 'theme',
    widthMode,
    heightMode,
    cardDensity,
    screen: ONBOARDING_LAYOUT_SCHEMA.screen[heightMode],
    stepCount: ONBOARDING_LAYOUT_SCHEMA.stepCount[heightMode],
    ...ONBOARDING_LAYOUT_SCHEMA.theme[cardDensity],
  };
};
