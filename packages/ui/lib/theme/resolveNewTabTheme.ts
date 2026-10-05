import { getTheme } from './registry';
import type { ThemeProfile } from './types';

export const WALLPAPER_FUNCTIONAL_THEME_ID = 'reflect-new-tab';

export const CRITICAL_THEME_TOKEN_KEYS = [
  'appBg',
  'rootBg',
  'sidebarBg',
  'appSidebarBg',
  'panelBg',
  'cardBg',
  'textPrimary',
  'textSecondary',
  'textMuted',
  'borderDefault',
  'noteLibraryIcon',
  'backgroundGradient',
] as const;

/**
 * Background families decorate the home screen. Functional colors come from the
 * Midnight Black, irrespective of the selected dark family.
 */
export function resolveNewTabTheme(selectedThemeId: string, wallpaperId: string): ThemeProfile {
  if (wallpaperId !== 'none') {
    const functional = getTheme(WALLPAPER_FUNCTIONAL_THEME_ID);
    return {
      ...functional,
      tokens: {
        ...functional.tokens,
        widgetBg: functional.tokens.cardBg,
        widgetInnerBg: functional.tokens.hoverBg,
        widgetToolbarBg: functional.tokens.cardBg,
      },
    };
  }

  const selected = getTheme(selectedThemeId);
  const functional = getTheme(WALLPAPER_FUNCTIONAL_THEME_ID);

  return {
    ...functional,
    id: selected.id,
    name: selected.name,
    familyId: selected.familyId,
    warmTint: selected.warmTint,
    brightness: selected.brightness,
    tokens: {
      ...functional.tokens,
      appSidebarBg: functional.tokens.appSidebarBg,
      backgroundGradient: selected.tokens.backgroundGradient,
      widgetBg: selected.id !== WALLPAPER_FUNCTIONAL_THEME_ID
        ? selected.tokens.cardBg
        : functional.tokens.widgetBg,
      widgetInnerBg: selected.id !== WALLPAPER_FUNCTIONAL_THEME_ID
        ? selected.tokens.widgetInnerBg
        : functional.tokens.widgetInnerBg,
      widgetToolbarBg: selected.id !== WALLPAPER_FUNCTIONAL_THEME_ID
        ? selected.tokens.cardBg
        : functional.tokens.widgetToolbarBg,
    },
  };
}
