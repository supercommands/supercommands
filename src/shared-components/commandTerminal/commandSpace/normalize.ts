/**
 * Normalizes a command-terminal prefix for comparison.
 *
 * Prefix settings store user-entered values, so every parser compares trimmed,
 * lower-case values without a legacy leading slash.
 */
export const normalizeCommandTerminalPrefix = (value: unknown): string => String(value || '')
    .trim()
    .replace(/^\/+/, '')
    .toLowerCase();
/**
 * Normalizes command-space text while preserving the existing non-breaking-space cleanup.
 *
 * Website and omnibox inputs can contain NBSP characters after suggestion
 * selection, so parsers normalize those before matching prefixes.
 */
export const normalizeCommandSpaceText = (value: unknown): string => normalizeCommandTerminalPrefix(String(value || '').replace(/\u00A0/g, ' '));
/**
 * Detects prefixes made only from symbols, such as "." or "@".
 *
 * Symbol prefixes are parsed by direct `startsWith` matching instead of token
 * matching because they do not need a separating space.
 */
export const isSymbolCommandPrefix = (value: string): boolean => /^[^a-z0-9]+$/i.test(value);
