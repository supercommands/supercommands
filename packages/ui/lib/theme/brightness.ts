import type { ThemeTokens } from './types';

export const MIN_APPEARANCE_BRIGHTNESS = 0;
export const DEFAULT_APPEARANCE_BRIGHTNESS = 70;
export const MAX_APPEARANCE_BRIGHTNESS = 100;

export const DEFAULT_LIGHT_BRIGHTNESS_MAXIMUM = 65;
export const DEFAULT_DARK_BRIGHTNESS_MAXIMUM = 85;

export function normalizeBrightness(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Number.isNaN(value)) {
    return DEFAULT_APPEARANCE_BRIGHTNESS;
  }
  const rounded = Math.round(value);
  return Math.min(MAX_APPEARANCE_BRIGHTNESS, Math.max(MIN_APPEARANCE_BRIGHTNESS, rounded));
}

/**
 * Validates and clamps a theme's configured maximum source level (0 - 100).
 * Defaults to 100 if non-numeric or invalid.
 */
export function validateMaximumSourceLevel(maxLevel: unknown): number {
  if (typeof maxLevel !== 'number' || !Number.isFinite(maxLevel) || Number.isNaN(maxLevel)) {
    return 100;
  }
  return Math.min(MAX_APPEARANCE_BRIGHTNESS, Math.max(MIN_APPEARANCE_BRIGHTNESS, maxLevel));
}

/**
 * Maps public UI brightness level (0% - 100%) and a theme's registered maximum source level
 * (e.g. 65 for light themes, 85 for dark themes) to internal percentage (70% - 100%).
 *
 * Public slider stays 0-100% while its internal effective range is theme-dependent:
 * effectiveOldSliderLevel = normalizedLevel * maximumSourceLevel / 100
 * internalPercent = 70 + (effectiveOldSliderLevel / 100) * 30
 */
export function brightnessLevelToRescaledPercent(level: number, maximumSourceLevel: number = 100): number {
  const normalized = normalizeBrightness(level);
  const validMax = validateMaximumSourceLevel(maximumSourceLevel);
  const effectiveOldSliderLevel = (normalized * validMax) / 100;
  return 70 + (effectiveOldSliderLevel / 100) * 30;
}

/**
 * Maps public UI brightness level (0% - 100%) and a theme's registered maximum source level
 * to internal CSS brightness factor (0.70 - 1.00).
 */
export function brightnessLevelToRescaledFactor(level: number, maximumSourceLevel: number = 100): number {
  return brightnessLevelToRescaledPercent(level, maximumSourceLevel) / 100;
}

/**
 * Maps public UI brightness level (0% - 100%) to internal percentage (70% - 100%).
 * Maintains compatibility for unscaled 0-100 mapping.
 */
export function brightnessLevelToInternalPercent(level: number): number {
  return brightnessLevelToRescaledPercent(level, 100);
}

/**
 * Maps public UI brightness level (0% - 100%) to internal factor (0.70 - 1.00).
 * Accepts optional maximumSourceLevel (defaults to 100) for backward compatibility.
 */
export function brightnessLevelToFactor(level: number, maximumSourceLevel: number = 100): number {
  return brightnessLevelToRescaledFactor(level, maximumSourceLevel);
}

function adjustChannel(channel: number, factor: number): number {
  if (factor === 1) return channel;
  return Math.max(0, Math.min(255, Math.round(channel * factor)));
}

/**
 * Adjusts the RGB components of a color string by a brightness factor (0% - 100%).
 * Preserves alpha channels, transparent, none, and blur strings.
 */
export function adjustColorBrightness(colorStr: string, brightnessInput: number): string {
  if (!colorStr || typeof colorStr !== 'string') return colorStr;
  const brightness = normalizeBrightness(brightnessInput);
  if (brightness === DEFAULT_APPEARANCE_BRIGHTNESS) return colorStr;

  const trimmed = colorStr.trim();
  if (trimmed === 'transparent' || trimmed.startsWith('blur(') || trimmed === 'none') {
    return colorStr;
  }

  const factor = brightnessLevelToFactor(brightness);

  // 1. Hex format (#RGB, #RRGGBB, #RRGGBBAA)
  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const r2 = adjustChannel(r, factor).toString(16).padStart(2, '0');
      const g2 = adjustChannel(g, factor).toString(16).padStart(2, '0');
      const b2 = adjustChannel(b, factor).toString(16).padStart(2, '0');
      return `#${r2}${g2}${b2}`;
    }
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const r2 = adjustChannel(r, factor).toString(16).padStart(2, '0');
      const g2 = adjustChannel(g, factor).toString(16).padStart(2, '0');
      const b2 = adjustChannel(b, factor).toString(16).padStart(2, '0');
      return `#${r2}${g2}${b2}`;
    }
    if (hex.length === 8) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const alphaHex = hex.substring(6, 8);
      const r2 = adjustChannel(r, factor).toString(16).padStart(2, '0');
      const g2 = adjustChannel(g, factor).toString(16).padStart(2, '0');
      const b2 = adjustChannel(b, factor).toString(16).padStart(2, '0');
      return `#${r2}${g2}${b2}${alphaHex}`;
    }
    return colorStr;
  }

  // 2. rgba(r, g, b, a) or rgb(r, g, b)
  const rgbaMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1], 10);
    const g = parseInt(rgbaMatch[2], 10);
    const b = parseInt(rgbaMatch[3], 10);
    const a = rgbaMatch[4];
    const r2 = adjustChannel(r, factor);
    const g2 = adjustChannel(g, factor);
    const b2 = adjustChannel(b, factor);
    if (a !== undefined) {
      return `rgba(${r2}, ${g2}, ${b2}, ${a})`;
    }
    return `rgb(${r2}, ${g2}, ${b2})`;
  }

  // 3. linear-gradient(...) or radial-gradient(...)
  if (trimmed.startsWith('linear-gradient(') || trimmed.startsWith('radial-gradient(')) {
    return trimmed.replace(
      /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)/g,
      (match) => adjustColorBrightness(match, brightness)
    );
  }

  return colorStr;
}

/**
 * Explicit allowlist of visual background and surface tokens to transform.
 * Foreground typography, icons, status colors, accents, diff text, and focus indicators
 * are excluded to maintain contrast, legibility, and visual stability.
 */
export const BRIGHTNESS_TOKEN_ALLOWLIST = new Set<keyof ThemeTokens>([
  'appBg',
  'rootBg',
  'sidebarBg',
  'panelBg',
  'modalBg',
  'cardBg',
  'inputBg',
  'editorBg',
  'containerBg',
  'sheetBg',
  'contextMenuBg',
  'popupBg',
  'innerPopupBg',
  'tutorialCardBg',
  'snippetConfigBg',
  'snippetChipBg',
  'widgetBg',
  'widgetToolbarBg',
  'widgetDragPlaceholderBg',
  'backgroundGradient',
]);

/**
 * Derives a new ThemeTokens object with brightness adjustments applied to allowed background/surface tokens.
 * At 100%, returns the original tokens reference unchanged.
 */
export function applyThemeBrightness(tokens: ThemeTokens, brightnessInput: number): ThemeTokens {
  const brightness = normalizeBrightness(brightnessInput);
  if (brightness === DEFAULT_APPEARANCE_BRIGHTNESS) {
    return tokens;
  }

  const result: ThemeTokens = { ...tokens };

  for (const tokenKey of BRIGHTNESS_TOKEN_ALLOWLIST) {
    const val = tokens[tokenKey];
    if (typeof val === 'string' && val) {
      (result[tokenKey] as string) = adjustColorBrightness(val, brightness);
    }
  }

  // Guarantee the inputBg === editorBg invariant if both tokens were transformed
  if (tokens.inputBg !== undefined && tokens.editorBg !== undefined && result.inputBg && result.editorBg) {
    if (tokens.inputBg === tokens.editorBg) {
      result.inputBg = result.editorBg;
    }
  }

  return result;
}
