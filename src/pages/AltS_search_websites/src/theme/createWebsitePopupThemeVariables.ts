/**
 * Bridges existing registry-owned Alt+S colors into the popup Shadow DOM.
 *
 * Geometry and typography are intentionally excluded; they belong to the popup
 * design-token stylesheet rather than the theme registry.
 */
import type { ThemeTokens } from '@extension/ui/lib/theme/types';
/**
 * Replaces only a registry color's alpha channel with the registry-owned glass
 * opacity. The RGB/HSL identity remains unchanged and no popup color is invented.
 */
function applyWebsitePopupGlassOpacity(color: string, glassOpacity?: number): string {
    if (typeof glassOpacity !== 'number' || !Number.isFinite(glassOpacity))
        return color;
    const opacity = Math.max(0, Math.min(1, glassOpacity));
    const hexMatch = color.trim().match(/^#([\da-f]{6})$/i);
    if (hexMatch) {
        const hex = hexMatch[1];
        const red = parseInt(hex.slice(0, 2), 16);
        const green = parseInt(hex.slice(2, 4), 16);
        const blue = parseInt(hex.slice(4, 6), 16);
        return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
    }
    const rgbMatch = color.trim().match(/^rgba?\(\s*([^,]+),\s*([^,]+),\s*([^,)]+)(?:,\s*[^)]+)?\)$/i);
    if (rgbMatch) {
        return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${opacity})`;
    }
    const hslMatch = color.trim().match(/^hsla?\(\s*([^,]+),\s*([^,]+),\s*([^,)]+)(?:,\s*[^)]+)?\)$/i);
    if (hslMatch) {
        return `hsla(${hslMatch[1]}, ${hslMatch[2]}, ${hslMatch[3]}, ${opacity})`;
    }
    return color;
}
export function createWebsitePopupThemeVariables(tokens: ThemeTokens, glassOpacity?: number): Record<string, string> {
    return {
        '--color-altsPopupBg': applyWebsitePopupGlassOpacity(tokens.altsPopupBg, glassOpacity),
        '--color-altsSearchBg': tokens.altsSearchBg,
        '--color-altsListBg': tokens.altsListBg,
        '--color-contextMenuBg': tokens.contextMenuBg,
        '--color-altsRowHoverBg': tokens.altsRowHoverBg,
        '--color-altsRowSelectedBg': tokens.altsRowSelectedBg,
        '--color-altsBorderColor': tokens.altsBorderColor,
        '--color-altsDividerColor': tokens.altsDividerColor,
        '--color-altsFocusColor': tokens.altsFocusColor,
        '--color-altsSelectedEdge': tokens.altsSelectedEdge,
        '--color-altsTextPrimary': tokens.altsTextPrimary,
        '--color-altsTextSecondary': tokens.altsTextSecondary,
        '--color-altsTextSection': tokens.altsTextSection,
        '--color-altsTextPlaceholder': tokens.altsTextPlaceholder,
        '--color-altsIconColor': tokens.altsIconColor,
        '--color-altsIconSelected': tokens.altsIconSelected,
        '--color-success': tokens.success,
        '--color-error': tokens.error,
        '--color-warning': tokens.warning,
        '--color-altsIconTileSaveFg': tokens.altsIconTileSaveFg,
        '--color-altsIconTileSaveSelectedFg': tokens.altsIconTileSaveSelectedFg,
        '--color-altsIconTileActionBg': tokens.altsIconTileActionBg,
        '--color-altsIconTileActionFg': tokens.altsIconTileActionFg,
        '--color-altsIconTileActionSelectedBg': tokens.altsIconTileActionSelectedBg,
        '--color-altsIconTileActionSelectedFg': tokens.altsIconTileActionSelectedFg,
        '--color-altsIconTileAiBg': tokens.altsIconTileAiBg,
        '--color-altsIconTileAiFg': tokens.altsIconTileAiFg,
        '--color-altsIconTileAiSelectedBg': tokens.altsIconTileAiSelectedBg,
        '--color-altsIconTileAiSelectedFg': tokens.altsIconTileAiSelectedFg,
        '--color-altsIconTileCaptureBg': tokens.altsIconTileCaptureBg,
        '--color-altsIconTileCaptureFg': tokens.altsIconTileCaptureFg,
        '--color-altsIconTileCaptureSelectedBg': tokens.altsIconTileCaptureSelectedBg,
        '--color-altsIconTileCaptureSelectedFg': tokens.altsIconTileCaptureSelectedFg,
        '--color-altsIconTileSummarizeBg': tokens.altsIconTileSummarizeBg,
        '--color-altsIconTileSummarizeFg': tokens.altsIconTileSummarizeFg,
        '--color-altsIconTileSummarizeSelectedBg': tokens.altsIconTileSummarizeSelectedBg,
        '--color-altsIconTileSummarizeSelectedFg': tokens.altsIconTileSummarizeSelectedFg,
        '--color-altsIconTileExtractBg': tokens.altsIconTileExtractBg,
        '--color-altsIconTileExtractFg': tokens.altsIconTileExtractFg,
        '--color-altsIconTileExtractSelectedBg': tokens.altsIconTileExtractSelectedBg,
        '--color-altsIconTileExtractSelectedFg': tokens.altsIconTileExtractSelectedFg,
        '--color-altsShortcutText': tokens.altsShortcutText,
        '--color-altsShortcutBg': tokens.altsShortcutBg,
        '--color-altsShortcutBorder': tokens.altsShortcutBorder,
        '--color-altsScrollbarThumb': tokens.altsScrollbarThumb,
        '--color-altsScrollbarThumbHover': tokens.altsScrollbarThumbHover,
    };
}
