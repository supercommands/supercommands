import * as React from 'react';
import { motion } from 'framer-motion';
import {
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
  FaBuilding,
  FaCube,
  FaChartLine,
  FaUsers,
  FaFileLines,
  FaLink,
  FaWandMagicSparkles,
  FaCode,
  FaPalette,
  FaGraduationCap,
  FaUser,
  FaFolderOpen,
  FaBookOpen,
  FaBriefcase,
  FaMap,
  FaMagnifyingGlass,
  FaChartPie,
  FaRocket,
  FaLightbulb,
  FaArrowRightFromBracket,
  FaWallet,
  FaCoins,
  FaFileInvoiceDollar,
  FaBook,
  FaLayerGroup,
  FaListCheck,
  FaBullseye,
  FaSliders,
  FaBookmark,
} from 'react-icons/fa6';
import { FiEdit2, FiLayers } from 'react-icons/fi';
import {
  ONBOARDING_ROLE_TEMPLATES,
  type OnboardingDashboardViewTemplate,
  type OnboardingRoleId,
  type SupportedOnboardingRoleId,
  type OnboardingRoleTemplate,
} from './DashboardviewTemplates';
import type { OnboardingDashboardViewsLayout } from './layout/onboardingLayoutSchema';
import { normalizeShortcutTrigger } from '../shared-components/shortcuts/core/shortcutDbData';
import { buildHotkeyString, normalizeHotkeyString } from '../shared-components/hotkeys/core/eventParser';

export interface DashboardViewsOnboardingProps {
  maxContentWidth?: number;
  titleLayout?: OnboardingDashboardViewsLayout['title'];
  roleCategoryLayout?: OnboardingDashboardViewsLayout['roleCategories'];
  dividerLayout?: OnboardingDashboardViewsLayout['divider'];
  templateCardsLayout?: OnboardingDashboardViewsLayout['templateCards'];
  roles?: OnboardingRoleTemplate[];
  selectedRoleId: SupportedOnboardingRoleId;
  onRoleChange: (roleId: SupportedOnboardingRoleId) => void;
  selectedTemplateIds: string[];
  onSelectionChange: (selectedTemplateIds: string[]) => void;
  shortcuts: Record<string, string>;
  onShortcutChange: (templateId: string, shortcut: string) => void;
  hotkeys: Record<string, string>;
  onHotkeyChange: (templateId: string, hotkey: string) => void;
  validationErrors?: Record<string, string>;
  hotkeyValidationErrors?: Record<string, string>;
  onBack?: () => void;
  onContinue?: () => void;
}

const CARD_HEADER_BACKGROUNDS: Record<OnboardingDashboardViewTemplate['tone'], string> = {
  blue: 'linear-gradient(135deg, rgba(239,246,255,1), rgba(248,250,252,1))',
  mint: 'linear-gradient(135deg, rgba(236,253,245,1), rgba(248,250,252,1))',
  peach: 'linear-gradient(135deg, rgba(255,247,237,1), rgba(255,251,247,1))',
  lavender: 'linear-gradient(135deg, rgba(250,245,255,1), rgba(253,250,255,1))',
};

const CARD_ICON_STYLES: Record<
  OnboardingDashboardViewTemplate['tone'],
  {
    bg: string;
    color: string;
  }
> = {
  blue: { bg: '#eff6ff', color: '#3b82f6' },
  mint: { bg: '#ecfdf5', color: '#10b981' },
  peach: { bg: '#fff7ed', color: '#f97316' },
  lavender: { bg: '#faf5ff', color: '#9333ea' },
};

const OBJECT_ICON_MAP = {
  note: FaFileLines,
  link: FaLink,
  aiPrompt: FaWandMagicSparkles,
  snippet: FaCode,
  session: FiLayers,
  todo: FaListCheck,
};

const OBJECT_TYPE_LABELS = {
  note: 'Note',
  link: 'Link',
  aiPrompt: 'Chat Agent',
  snippet: 'Text Expander',
  session: 'Session',
  todo: 'Todo',
};

const ROLE_ICON_MAP: Record<OnboardingRoleId, React.ComponentType<{ size?: number; className?: string }>> = {
  founder: FaBuilding,
  developer: FaCode,
  product: FaCube,
  design: FaPalette,
  finance: FaChartLine,
  student: FaGraduationCap,
  personal: FaUser,
};

const DASHBOARD_VIEW_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  // Founder
  'founder-command-center': FaBuilding,
  'build-and-ship': FaCube,
  'capital-and-runway': FaChartLine,
  'team-and-culture': FaUsers,
  // Developer
  'dev-hub': FaCode,
  'dev-projects': FaFolderOpen,
  'dev-learning': FaBookOpen,
  'dev-career': FaBriefcase,
  // Product
  'product-roadmap': FaMap,
  'product-research': FaMagnifyingGlass,
  'product-analytics': FaChartPie,
  'product-launches': FaRocket,
  // Design
  'design-hub': FaPalette,
  'design-inspiration': FaLightbulb,
  'design-research': FaMagnifyingGlass,
  'design-handoff': FaArrowRightFromBracket,
  // Finance
  'finance-overview': FaChartPie,
  'finance-budget': FaWallet,
  'finance-investments': FaCoins,
  'finance-taxes': FaFileInvoiceDollar,
  // Student
  'student-study': FaBook,
  'student-subjects': FaLayerGroup,
  'student-assignments': FaListCheck,
  'student-career': FaBriefcase,
  // Personal
  'personal-hub': FaUser,
  'personal-goals': FaBullseye,
  personal: FaSliders,
  'personal-saved-resources': FaBookmark,
};

export const DashboardViewsOnboarding: React.FC<DashboardViewsOnboardingProps> = ({
  maxContentWidth,
  titleLayout,
  roleCategoryLayout,
  dividerLayout,
  templateCardsLayout,
  roles = ONBOARDING_ROLE_TEMPLATES,
  selectedRoleId,
  onRoleChange,
  selectedTemplateIds,
  onSelectionChange,
  shortcuts,
  onShortcutChange,
  hotkeys,
  onHotkeyChange,
  validationErrors = {},
  hotkeyValidationErrors = {},
  onBack,
  onContinue,
}) => {
  const [editingTemplateId, setEditingTemplateId] = React.useState<string | null>(null);
  const [editingField, setEditingField] = React.useState<'shortcut' | 'hotkey' | null>(null);
  const [editingValue, setEditingValue] = React.useState<string>('');

  const activeRole = roles.find(r => r.id === selectedRoleId) || roles[0];
  const templates = activeRole.views;
  const isTemplateSelected = (template: OnboardingDashboardViewTemplate) =>
    template.isDefaultView || selectedTemplateIds.includes(template.id);
  const selectedCount = templates.filter(isTemplateSelected).length;

  const toggleTemplate = (id: string) => {
    if (templates.find(template => template.id === id)?.isDefaultView) return;
    if (selectedTemplateIds.includes(id)) {
      onSelectionChange(selectedTemplateIds.filter(tId => tId !== id));
    } else {
      onSelectionChange([...selectedTemplateIds, id]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggleTemplate(id);
    }
  };

  const handleRoleKeyDown = (e: React.KeyboardEvent, roleId: SupportedOnboardingRoleId) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onRoleChange(roleId);
    }
  };

  const beginEditing = (templateId: string, field: 'shortcut' | 'hotkey', currentVal: string) => {
    setEditingTemplateId(templateId);
    setEditingField(field);
    setEditingValue(currentVal);
  };

  const handleCommitEdit = (templateId: string) => {
    if (editingTemplateId === templateId) {
      if (editingField === 'hotkey') {
        onHotkeyChange(templateId, normalizeHotkeyString(editingValue));
      } else {
        const normalized = normalizeShortcutTrigger(editingValue);
        onShortcutChange(templateId, normalized);
      }
      setEditingTemplateId(null);
      setEditingField(null);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent, templateId: string) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommitEdit(templateId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingTemplateId(null);
      setEditingField(null);
    }
  };

  const handleHotkeyInputKeyDown = (e: React.KeyboardEvent, templateId: string) => {
    e.stopPropagation();
    e.preventDefault();

    if (e.key === 'Escape') {
      setEditingTemplateId(null);
      setEditingField(null);
      return;
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      setEditingValue('');
      onHotkeyChange(templateId, '');
      return;
    }

    if (e.key === 'Enter') {
      handleCommitEdit(templateId);
      return;
    }

    const formatted = buildHotkeyString(e.nativeEvent);
    if (!formatted || formatted === 'CANCEL') return;
    setEditingValue(formatted);
    onHotkeyChange(templateId, formatted);
  };

  return (
    <div
      className="w-full font-sans select-none flex flex-col items-center"
      style={{ color: 'var(--color-textSecondary)' }}
    >
      <div
        className="w-full mx-auto flex flex-col"
        style={{
          maxWidth: maxContentWidth ?? 1240,
          gap: titleLayout?.gap ? titleLayout.gap + 12 : 16,
        }}
      >
        
        {/* Header Block (Compact & Clear) */}
        <div className="flex flex-col items-center text-center" style={{ gap: titleLayout?.gap }}>
          <h1
            className="m-0"
            style={{
              color: titleLayout?.titleColor ?? 'var(--color-tutorialTextTitle)',
              fontSize: titleLayout?.titleFontSize ?? 36,
              lineHeight: titleLayout?.titleLineHeight ?? 1.12,
              fontWeight: titleLayout?.titleFontWeight ?? 800,
              letterSpacing: titleLayout?.titleLetterSpacing ?? '0',
            }}
          >
            Set up cmdOS for you
          </h1>
          <p
            className="m-0"
            style={{
              color: titleLayout?.subtitleColor ?? 'var(--color-tutorialTextDescription)',
              fontSize: titleLayout?.subtitleFontSize ?? 14,
              lineHeight: titleLayout?.subtitleLineHeight ?? 1.45,
              marginTop: titleLayout?.subtitleMarginTop ?? 4,
              fontWeight: titleLayout?.subtitleFontWeight ?? 500,
            }}
          >
            Choose a {activeRole.label.toLowerCase()} setup that matches how you work.
          </p>
        </div>

        {/* Roles Selection Section (Responsive 7-card grid) */}
        <div
          className="w-full flex flex-col"
          style={{ marginTop: roleCategoryLayout?.sectionMarginTop ?? 4 }}
        >
          <h2
            className="m-0 uppercase"
            style={{
              marginBottom: roleCategoryLayout?.headingMarginBottom ?? 8,
              color: roleCategoryLayout?.headingColor ?? 'var(--color-textMuted)',
              fontSize: roleCategoryLayout?.headingFontSize ?? 12,
              fontWeight: roleCategoryLayout?.headingFontWeight ?? 700,
              letterSpacing: roleCategoryLayout?.headingLetterSpacing ?? '0.05em',
            }}
          >
            What best describes your work?
          </h2>

          <div
            className="grid w-full"
            style={{
              gridTemplateColumns: `repeat(${roleCategoryLayout?.gridColumns ?? 7}, minmax(0, 1fr))`,
              gap: roleCategoryLayout?.gridGap ?? 11,
            }}
            role="radiogroup"
            aria-label="What best describes your work?"
          >
            {roles.map(role => {
              const isSelected = selectedRoleId === role.id;
              const RoleIcon = ROLE_ICON_MAP[role.id] || FaBuilding;

              return (
                <div
                  key={role.id}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onClick={() => onRoleChange(role.id)}
                  onKeyDown={e => handleRoleKeyDown(e, role.id)}
                  className={`relative border flex flex-col items-center justify-center text-center transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-purple-400 ${
                    isSelected ? 'shadow-xs' : 'hover:shadow-xs'
                  }`}
                  style={{
                    minHeight: roleCategoryLayout?.cardMinHeight ?? 78,
                    paddingLeft: roleCategoryLayout?.cardPaddingX ?? 12,
                    paddingRight: roleCategoryLayout?.cardPaddingX ?? 12,
                    paddingTop: roleCategoryLayout?.cardPaddingY ?? 10,
                    paddingBottom: roleCategoryLayout?.cardPaddingY ?? 10,
                    gap: roleCategoryLayout?.cardGap ?? 6,
                    borderRadius: roleCategoryLayout?.cardRadius ?? 12,
                    borderColor: isSelected
                      ? roleCategoryLayout?.selectedBorderColor
                      : roleCategoryLayout?.unselectedBorderColor,
                    background: isSelected
                      ? roleCategoryLayout?.selectedBackground
                      : roleCategoryLayout?.unselectedBackground,
                  }}
                >
                  {/* Selection Checkmark Badge */}
                  {isSelected && (
                    <div
                      className="absolute rounded-full border flex items-center justify-center shadow-xs"
                      style={{
                        top: roleCategoryLayout?.selectedBadgeOffset ?? 6,
                        right: roleCategoryLayout?.selectedBadgeOffset ?? 6,
                        width: roleCategoryLayout?.selectedBadgeSize ?? 16,
                        height: roleCategoryLayout?.selectedBadgeSize ?? 16,
                        borderColor: roleCategoryLayout?.selectedBadgeBorderColor ?? 'var(--color-tutorialAccent)',
                        background: roleCategoryLayout?.selectedBadgeBackground ?? 'var(--color-tutorialCardBg)',
                        color: roleCategoryLayout?.selectedBadgeColor ?? 'var(--color-tutorialAccent)',
                      }}
                    >
                      <FaCheck size={roleCategoryLayout?.selectedBadgeIconSize ?? 8} />
                    </div>
                  )}

                  {/* Role Icon */}
                  <div
                    className="leading-none"
                    style={{
                      color: isSelected
                        ? (roleCategoryLayout?.selectedIconColor ?? 'var(--color-tutorialAccent)')
                        : (roleCategoryLayout?.unselectedIconColor ?? 'var(--color-textMuted)'),
                      fontSize: roleCategoryLayout?.iconFontSize ?? 22,
                    }}
                  >
                    <RoleIcon />
                  </div>

                  {/* Role Label */}
                  <span
                    className="max-w-full"
                    style={{
                      color: isSelected
                        ? (roleCategoryLayout?.selectedLabelColor ?? 'var(--color-tutorialTextTitle)')
                        : (roleCategoryLayout?.unselectedLabelColor ?? 'var(--color-textSecondary)'),
                      fontSize: roleCategoryLayout?.labelFontSize ?? 12,
                      lineHeight: roleCategoryLayout?.labelLineHeight ?? 1.15,
                      fontWeight: roleCategoryLayout?.labelFontWeight ?? 600,
                      whiteSpace: 'normal',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {role.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div
          className="w-full h-px"
          style={{
            marginTop: dividerLayout?.marginY ?? 4,
            marginBottom: dividerLayout?.marginY ?? 4,
            backgroundColor: dividerLayout?.color ?? 'var(--color-borderDefault)',
          }}
        />

        {/* Dashboard Views Section */}
        <div
          className="w-full flex flex-col"
          style={{ marginTop: templateCardsLayout?.sectionMarginTop ?? 0 }}
        >
          <div
            className="flex flex-wrap items-center justify-between"
            style={{
              gap: templateCardsLayout?.validationGap ?? 6,
              marginBottom: templateCardsLayout?.headingMarginBottom ?? 10,
            }}
          >
            <h2
              className="m-0"
              style={{
                color: templateCardsLayout?.headingColor ?? 'var(--color-tutorialTextTitle)',
                fontSize: templateCardsLayout?.headingFontSize ?? 20,
                fontWeight: templateCardsLayout?.headingFontWeight ?? 800,
                letterSpacing: templateCardsLayout?.headingLetterSpacing ?? '0',
              }}
            >
              Starter automation pack
            </h2>
            {(validationErrors._general || selectedCount === 0) && (
              <span
                className="border flex items-center shadow-xs"
                style={{
                  color: templateCardsLayout?.validationColor ?? 'var(--color-danger)',
                  background: templateCardsLayout?.validationBackground,
                  borderColor: templateCardsLayout?.validationBorderColor,
                  fontSize: templateCardsLayout?.validationFontSize ?? 12,
                  fontWeight: templateCardsLayout?.validationFontWeight ?? 700,
                  paddingLeft: templateCardsLayout?.validationPaddingX ?? 12,
                  paddingRight: templateCardsLayout?.validationPaddingX ?? 12,
                  paddingTop: templateCardsLayout?.validationPaddingY ?? 4,
                  paddingBottom: templateCardsLayout?.validationPaddingY ?? 4,
                  gap: templateCardsLayout?.validationGap ?? 6,
                  borderRadius: templateCardsLayout?.validationRadius ?? 6,
                }}
              >
                <span aria-hidden="true">⚠️</span> {validationErrors._general || 'Please select at least 1 workspace template to proceed'}
              </span>
            )}
          </div>

          {/* Accessible Live Region */}
          <div className="sr-only" aria-live="polite">
            {selectedCount} of {templates.length} dashboard views selected for {activeRole.label}.
          </div>

          {/* 4 Cards Grid */}
          <div
            className="grid w-full"
            style={{
              gridTemplateColumns: `repeat(${templateCardsLayout?.gridColumns ?? 4}, minmax(0, 1fr))`,
              gap: templateCardsLayout?.gridGap ?? 14,
            }}
          >
            {templates.map(template => {
              const isSelected = isTemplateSelected(template);
              const headerBg = CARD_HEADER_BACKGROUNDS[template.tone];
              const iconStyle = CARD_ICON_STYLES[template.tone];
              const ViewIcon = DASHBOARD_VIEW_ICONS[template.id] || ROLE_ICON_MAP[template.role] || FaBuilding;
              const shortcutVal = shortcuts[template.id] || template.defaultShortcut;
              const hotkeyVal = hotkeys[template.id] || '';
              const isEditingShortcut = editingTemplateId === template.id && editingField === 'shortcut';
              const isEditingHotkey = editingTemplateId === template.id && editingField === 'hotkey';

              return (
                <motion.article
                  key={template.id}
                  role="checkbox"
                  aria-checked={isSelected}
                  aria-disabled={template.isDefaultView}
                  tabIndex={0}
                  onClick={() => toggleTemplate(template.id)}
                  onKeyDown={e => handleKeyDown(e, template.id)}
                  whileHover={template.isDefaultView ? undefined : { scale: 1.008 }}
                  whileTap={template.isDefaultView ? undefined : { scale: 0.992 }}
                  className={`relative flex flex-col transition-all duration-200 select-none overflow-hidden focus:outline-none ${
                    template.isDefaultView ? 'cursor-default' : 'cursor-pointer'
                  } ${
                    isSelected
                      ? 'shadow-md'
                      : 'shadow-xs opacity-90 hover:opacity-100 hover:shadow-md'
                  }`}
                  style={{
                    borderRadius: templateCardsLayout?.cardRadius ?? 16,
                    background: templateCardsLayout?.cardBackground ?? 'var(--color-tutorialCardBg)',
                  }}
                >
                  {/* Selection Checkmark Indicator Badge */}
                  <div
                    className="absolute rounded-full border flex items-center justify-center transition-all z-10"
                    style={{
                      top: templateCardsLayout?.selectedBadgeOffset ?? 14,
                      right: templateCardsLayout?.selectedBadgeOffset ?? 14,
                      width: templateCardsLayout?.selectedBadgeSize ?? 20,
                      height: templateCardsLayout?.selectedBadgeSize ?? 20,
                      borderColor: isSelected
                        ? (templateCardsLayout?.selectedBadgeBorderColor ?? 'var(--color-borderDefault)')
                        : (templateCardsLayout?.unselectedBadgeBorderColor ?? 'var(--color-borderDefault)'),
                      background: isSelected
                        ? (templateCardsLayout?.selectedBadgeBackground ?? 'var(--color-selectedBg)')
                        : (templateCardsLayout?.unselectedBadgeBackground ?? 'var(--color-tutorialCardBg)'),
                      color: isSelected
                        ? (templateCardsLayout?.selectedBadgeColor ?? 'var(--color-textPrimary)')
                        : (templateCardsLayout?.unselectedBadgeColor ?? 'transparent'),
                      boxShadow: isSelected ? 'var(--shadow-xs)' : undefined,
                    }}
                  >
                    <FaCheck size={templateCardsLayout?.selectedBadgeIconSize ?? 9} />
                  </div>

                  {/* Header Section (Soft Tinted Background) */}
                  <div
                    className="flex flex-col relative"
                    style={{
                      background: headerBg,
                      padding: templateCardsLayout?.cardHeaderPadding ?? 16,
                      gap: templateCardsLayout?.cardHeaderGap ?? 10,
                    }}
                  >
                    {/* 40px Icon Tile */}
                    <div
                      className="flex items-center justify-center shadow-xs"
                      style={{
                        backgroundColor: iconStyle.bg,
                        color: iconStyle.color,
                        width: templateCardsLayout?.iconTileSize ?? 40,
                        height: templateCardsLayout?.iconTileSize ?? 40,
                        borderRadius: templateCardsLayout?.iconTileRadius ?? 12,
                      }}
                    >
                      <ViewIcon size={templateCardsLayout?.iconSize ?? 20} />
                    </div>

                    <div
                      className="flex flex-col gap-1"
                      style={{ paddingRight: templateCardsLayout?.cardHeaderTextPaddingRight ?? 22 }}
                    >
                      <h3
                        className="m-0"
                        style={{
                          color: templateCardsLayout?.cardTitleColor ?? 'var(--color-tutorialTextTitle)',
                          fontSize: templateCardsLayout?.cardTitleFontSize ?? 17,
                          fontWeight: templateCardsLayout?.cardTitleFontWeight ?? 700,
                          lineHeight: templateCardsLayout?.cardTitleLineHeight ?? 1.2,
                        }}
                      >
                        {template.title}
                      </h3>
                      <p
                        className="m-0"
                        style={{
                          color: templateCardsLayout?.cardDescriptionColor ?? 'var(--color-tutorialTextDescription)',
                          fontSize: templateCardsLayout?.cardDescriptionFontSize ?? 12,
                          fontWeight: templateCardsLayout?.cardDescriptionFontWeight ?? 400,
                          lineHeight: templateCardsLayout?.cardDescriptionLineHeight ?? 1.4,
                        }}
                      >
                        {template.description}
                      </p>
                    </div>
                  </div>

                  {/* Objects Section (White Background) - 5 Object Rows */}
                  <div
                    className="border-t flex flex-col"
                    style={{
                      background: templateCardsLayout?.cardBackground ?? 'var(--color-tutorialCardBg)',
                      borderColor: 'var(--color-borderDefault)',
                      padding: templateCardsLayout?.objectSectionPadding ?? 14,
                      gap: templateCardsLayout?.objectSectionGap ?? 8,
                    }}
                  >
                    {template.objects.map((obj, idx) => {
                      const IconComp = OBJECT_ICON_MAP[obj.type] || FaFileLines;
                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-[minmax(0,1fr)_auto] items-start"
                          style={{
                            gap: templateCardsLayout?.objectRowGap ?? 8,
                            minHeight: templateCardsLayout?.objectRowMinHeight ?? 22,
                          }}
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <IconComp
                              size={templateCardsLayout?.objectIconSize ?? 13}
                              className="shrink-0"
                              style={{ color: templateCardsLayout?.objectIconColor ?? 'var(--color-textMuted)' }}
                            />
                            <span
                              className="min-w-0"
                              style={{
                                color: templateCardsLayout?.objectTitleColor ?? 'var(--color-textPrimary)',
                                fontSize: templateCardsLayout?.objectTitleFontSize ?? 13,
                                fontWeight: templateCardsLayout?.objectTitleFontWeight ?? 600,
                                lineHeight: templateCardsLayout?.objectTitleLineHeight ?? 1.2,
                                whiteSpace: 'normal',
                                overflowWrap: 'anywhere',
                              }}
                            >
                              {obj.title}
                            </span>
                          </div>
                          <span
                            className="shrink-0 text-right"
                            style={{
                              color: templateCardsLayout?.objectTypeColor ?? 'var(--color-textMuted)',
                              fontSize: templateCardsLayout?.objectTypeFontSize ?? 11,
                              fontWeight: templateCardsLayout?.objectTypeFontWeight ?? 500,
                              lineHeight: templateCardsLayout?.objectTypeLineHeight ?? 1.1,
                            }}
                          >
                            {OBJECT_TYPE_LABELS[obj.type]}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Shortcut Section */}
                  <div
                    className="mt-auto border-t flex flex-col"
                    style={{
                      background: templateCardsLayout?.cardBackground ?? 'var(--color-tutorialCardBg)',
                      borderColor: 'var(--color-borderDefault)',
                      padding: templateCardsLayout?.formSectionPadding ?? 14,
                      gap: templateCardsLayout?.formSectionGap ?? 6,
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    <span
                      className="uppercase"
                      style={{
                        color: templateCardsLayout?.fieldLabelColor ?? 'var(--color-textMuted)',
                        fontSize: templateCardsLayout?.fieldLabelFontSize ?? 11,
                        fontWeight: templateCardsLayout?.fieldLabelFontWeight ?? 700,
                        letterSpacing: templateCardsLayout?.fieldLabelLetterSpacing ?? '0.05em',
                      }}
                    >
                      Shortcut
                    </span>

                    <div
                      className="border flex items-center justify-between"
                      style={{
                        height: templateCardsLayout?.fieldControlHeight ?? 36,
                        paddingLeft: templateCardsLayout?.fieldControlPaddingX ?? 12,
                        paddingRight: templateCardsLayout?.fieldControlPaddingX ?? 12,
                        borderRadius: templateCardsLayout?.fieldControlRadius ?? 12,
                        borderColor: templateCardsLayout?.fieldControlBorderColor ?? 'var(--color-borderDefault)',
                        background: templateCardsLayout?.fieldControlBackground ?? 'var(--color-tutorialCardBg)',
                        gap: templateCardsLayout?.fieldControlGap ?? 8,
                      }}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span
                          className="uppercase shrink-0"
                          style={{
                            color: templateCardsLayout?.fieldPrefixColor ?? 'var(--color-textPrimary)',
                            fontSize: templateCardsLayout?.fieldPrefixFontSize ?? 14,
                            fontWeight: templateCardsLayout?.fieldPrefixFontWeight ?? 700,
                          }}
                        >
                          c
                        </span>

                        {isEditingShortcut ? (
                          <input
                            type="text"
                            value={editingValue}
                            onChange={e => {
                              e.stopPropagation();
                              setEditingValue(e.target.value);
                            }}
                            onKeyDown={e => handleInputKeyDown(e, template.id)}
                            onBlur={() => handleCommitEdit(template.id)}
                            autoFocus
                            maxLength={24}
                            className="w-full border focus:outline-none"
                            style={{
                              color: templateCardsLayout?.fieldTextColor ?? 'var(--color-textPrimary)',
                              background: templateCardsLayout?.fieldInputBackground ?? 'var(--color-tutorialCardBg)',
                              borderColor: templateCardsLayout?.fieldInputBorderColor ?? 'var(--color-tutorialAccent)',
                              fontSize: templateCardsLayout?.fieldTextFontSize ?? 14,
                              fontWeight: templateCardsLayout?.fieldTextFontWeight ?? 600,
                              paddingLeft: templateCardsLayout?.fieldInputPaddingX ?? 8,
                              paddingRight: templateCardsLayout?.fieldInputPaddingX ?? 8,
                              paddingTop: templateCardsLayout?.fieldInputPaddingY ?? 2,
                              paddingBottom: templateCardsLayout?.fieldInputPaddingY ?? 2,
                              borderRadius: templateCardsLayout?.fieldInputRadius ?? 6,
                            }}
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <span
                            className="min-w-0"
                            style={{
                              color: templateCardsLayout?.fieldTextColor ?? 'var(--color-textPrimary)',
                              fontSize: templateCardsLayout?.fieldTextFontSize ?? 14,
                              fontWeight: templateCardsLayout?.fieldTextFontWeight ?? 600,
                              whiteSpace: 'normal',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {shortcutVal}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        aria-label={`Edit ${template.title} shortcut`}
                        onClick={e => {
                          e.stopPropagation();
                          beginEditing(template.id, 'shortcut', shortcutVal);
                        }}
                        className="flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                        style={{
                          width: templateCardsLayout?.editButtonSize ?? 22,
                          height: templateCardsLayout?.editButtonSize ?? 22,
                          borderRadius: templateCardsLayout?.editButtonRadius ?? 6,
                          color: templateCardsLayout?.editButtonColor ?? 'var(--color-textMuted)',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.color = templateCardsLayout?.editButtonHoverColor ?? 'var(--color-tutorialAccent)';
                          e.currentTarget.style.background = templateCardsLayout?.editButtonHoverBackground ?? 'var(--color-selectedBg)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.color = templateCardsLayout?.editButtonColor ?? 'var(--color-textMuted)';
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <FiEdit2 size={templateCardsLayout?.editButtonIconSize ?? 12} />
                      </button>
                    </div>

                    {validationErrors[template.id] && (
                      <span
                        className="leading-none"
                        style={{
                          color: templateCardsLayout?.errorColor ?? 'var(--color-danger)',
                          fontSize: templateCardsLayout?.errorFontSize ?? 12,
                          fontWeight: templateCardsLayout?.errorFontWeight ?? 500,
                          marginTop: 2,
                        }}
                      >
                        {validationErrors[template.id]}
                      </span>
                    )}

                    <span
                      className="uppercase"
                      style={{
                        color: templateCardsLayout?.fieldLabelColor ?? 'var(--color-textMuted)',
                        fontSize: templateCardsLayout?.fieldLabelFontSize ?? 11,
                        fontWeight: templateCardsLayout?.fieldLabelFontWeight ?? 700,
                        letterSpacing: templateCardsLayout?.fieldLabelLetterSpacing ?? '0.05em',
                        marginTop: 4,
                      }}
                    >
                      Hotkey
                    </span>

                    <div
                      className="border flex items-center justify-between"
                      style={{
                        height: templateCardsLayout?.fieldControlHeight ?? 36,
                        paddingLeft: templateCardsLayout?.fieldControlPaddingX ?? 12,
                        paddingRight: templateCardsLayout?.fieldControlPaddingX ?? 12,
                        borderRadius: templateCardsLayout?.fieldControlRadius ?? 12,
                        borderColor: templateCardsLayout?.fieldControlBorderColor ?? 'var(--color-borderDefault)',
                        background: templateCardsLayout?.fieldControlBackground ?? 'var(--color-tutorialCardBg)',
                        gap: templateCardsLayout?.fieldControlGap ?? 8,
                      }}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {isEditingHotkey ? (
                          <input
                            type="text"
                            value={editingValue}
                            readOnly
                            onKeyDown={e => handleHotkeyInputKeyDown(e, template.id)}
                            onBlur={() => handleCommitEdit(template.id)}
                            autoFocus
                            placeholder="Press keys"
                            className="w-full border focus:outline-none"
                            style={{
                              color: templateCardsLayout?.fieldTextColor ?? 'var(--color-textPrimary)',
                              background: templateCardsLayout?.fieldInputBackground ?? 'var(--color-tutorialCardBg)',
                              borderColor: templateCardsLayout?.fieldInputBorderColor ?? 'var(--color-tutorialAccent)',
                              fontSize: templateCardsLayout?.fieldTextFontSize ?? 14,
                              fontWeight: templateCardsLayout?.fieldTextFontWeight ?? 600,
                              paddingLeft: templateCardsLayout?.fieldInputPaddingX ?? 8,
                              paddingRight: templateCardsLayout?.fieldInputPaddingX ?? 8,
                              paddingTop: templateCardsLayout?.fieldInputPaddingY ?? 2,
                              paddingBottom: templateCardsLayout?.fieldInputPaddingY ?? 2,
                              borderRadius: templateCardsLayout?.fieldInputRadius ?? 6,
                            }}
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <span
                            className="min-w-0"
                            style={{
                              color: templateCardsLayout?.fieldTextColor ?? 'var(--color-textPrimary)',
                              fontSize: templateCardsLayout?.fieldTextFontSize ?? 14,
                              fontWeight: templateCardsLayout?.fieldTextFontWeight ?? 600,
                              whiteSpace: 'normal',
                              overflowWrap: 'anywhere',
                            }}
                          >
                            {hotkeyVal || 'Set'}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        aria-label={`Edit ${template.title} hotkey`}
                        onClick={e => {
                          e.stopPropagation();
                          beginEditing(template.id, 'hotkey', hotkeyVal);
                        }}
                        className="flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                        style={{
                          width: templateCardsLayout?.editButtonSize ?? 22,
                          height: templateCardsLayout?.editButtonSize ?? 22,
                          borderRadius: templateCardsLayout?.editButtonRadius ?? 6,
                          color: templateCardsLayout?.editButtonColor ?? 'var(--color-textMuted)',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.color = templateCardsLayout?.editButtonHoverColor ?? 'var(--color-tutorialAccent)';
                          e.currentTarget.style.background = templateCardsLayout?.editButtonHoverBackground ?? 'var(--color-selectedBg)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.color = templateCardsLayout?.editButtonColor ?? 'var(--color-textMuted)';
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <FiEdit2 size={templateCardsLayout?.editButtonIconSize ?? 12} />
                      </button>
                    </div>

                    {hotkeyValidationErrors[template.id] && (
                      <span
                        className="leading-none"
                        style={{
                          color: templateCardsLayout?.errorColor ?? 'var(--color-danger)',
                          fontSize: templateCardsLayout?.errorFontSize ?? 12,
                          fontWeight: templateCardsLayout?.errorFontWeight ?? 500,
                          marginTop: 2,
                        }}
                      >
                        {hotkeyValidationErrors[template.id]}
                      </span>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
