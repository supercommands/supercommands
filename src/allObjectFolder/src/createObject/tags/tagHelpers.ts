/**
 * @file tagHelpers.ts
 * @description Helper functions for tag values, including name formatting/normalizing.
 *
 * @usage
 * ```ts
 * import { formatTagName } from './tagHelpers';
 * const formatted = formatTagName('  Coding  '); // 'Coding'
 * ```
 */
export const formatTagName = (name: string): string => {
    return name.trim();
};
