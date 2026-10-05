import type { CSSProperties } from 'react';
import { reflectNewTabTheme } from '../../../packages/ui/lib/theme/registry';
/** Reuse the registered Midnight Black root for editors and collection sheets. */
export const PURE_BLACK_EDITOR_BACKGROUND = reflectNewTabTheme.tokens.rootBg;
/** Scoped backing for editors and collection sheets; dashboard widgets keep their own surfaces. */
export const FUNCTIONAL_EDITOR_SURFACE_STYLE: CSSProperties = {
    backgroundColor: PURE_BLACK_EDITOR_BACKGROUND,
    color: 'var(--color-textPrimary)',
    '--color-editorBg': PURE_BLACK_EDITOR_BACKGROUND,
    '--color-inputBg': PURE_BLACK_EDITOR_BACKGROUND,
    '--color-containerBg': PURE_BLACK_EDITOR_BACKGROUND,
    '--color-panelBg': PURE_BLACK_EDITOR_BACKGROUND,
    '--color-modalBg': PURE_BLACK_EDITOR_BACKGROUND,
    '--color-cardBg': PURE_BLACK_EDITOR_BACKGROUND,
    '--color-popupBg': PURE_BLACK_EDITOR_BACKGROUND,
    '--color-innerPopupBg': PURE_BLACK_EDITOR_BACKGROUND,
    '--color-contextMenuBg': PURE_BLACK_EDITOR_BACKGROUND,
} as CSSProperties;
