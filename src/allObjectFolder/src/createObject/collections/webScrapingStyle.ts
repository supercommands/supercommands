/** Captured content appearance only; no selectors, URLs, positioning or executable CSS. */
export const WEB_SCRAPING_STYLE_KEYS = ['color', 'backgroundColor', 'colorScheme', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'textAlign', 'textDecorationLine', 'borderRadius', 'objectFit'] as const;
export type WebScrapingStyle = Partial<Record<typeof WEB_SCRAPING_STYLE_KEYS[number], string>>;

export function isWebScrapingStyleValue(key: string, value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 240 || /[;{}<>\\]|url\s*\(|expression\s*\(|var\s*\(/i.test(value)) return false;
  switch (key) {
    case 'color': case 'backgroundColor':
      return /^(?:transparent|Canvas|#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})|(?:rgba?|hsla?|lab|lch|oklab|oklch)\([\d\s.,%+\-/]+\)|color\((?:srgb|display-p3)\s+[\d\s.%+\-/]+\))$/i.test(value);
    case 'colorScheme': return ['light', 'dark', 'light dark', 'dark light'].includes(value);
    case 'fontFamily': return !/[()]/.test(value);
    case 'fontSize': case 'lineHeight': case 'borderRadius': {
      if (key === 'lineHeight' && value === 'normal') return true;
      const match = /^(\d+(?:\.\d+)?)px$/.exec(value);
      if (!match) return false;
      const size = Number(match[1]);
      return key === 'fontSize' ? size >= 8 && size <= 96 : size >= 0 && size <= 160;
    }
    case 'fontWeight': return /^(?:[1-9]\d{0,2}|1000|normal|bold)$/.test(value);
    case 'fontStyle': return ['normal', 'italic', 'oblique'].includes(value);
    case 'textAlign': return ['left', 'right', 'center', 'justify', 'start', 'end'].includes(value);
    case 'textDecorationLine': return /^(?:none|(?:underline|overline|line-through)(?: (?:underline|overline|line-through))*)$/.test(value);
    case 'objectFit': return ['fill', 'contain', 'cover', 'none', 'scale-down'].includes(value);
    default: return false;
  }
}

export function isWebScrapingStyle(value: unknown): value is WebScrapingStyle {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.entries(value).every(([key, entry]) => isWebScrapingStyleValue(key, entry));
}
