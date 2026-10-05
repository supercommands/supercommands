/**
 * Shared text builders for category command chains.
 *
 * These helpers keep typed and clicked chain interactions in the same command
 * text format without deciding what the selected command should execute.
 */
/**
 * Builds command text when a user selects a chain field-prefix row.
 */
export function buildCategoryCommandInput({ commandPrefix, categoryPrefix, prefix, query = '', }: {
    commandPrefix: string;
    categoryPrefix: string;
    prefix: string;
    query?: string;
}) {
    const trimmedQuery = query.trim();
    return `${commandPrefix} ${categoryPrefix} ${prefix}${trimmedQuery ? ` ${trimmedQuery}` : ' '}`;
}
/**
 * Opens field-prefix selection after a completed category token.
 *
 * Keep ordinary field/action marker typing literal. Users can press Space
 * themselves after `-t`, `-tag`, `-time`, etc.; auto-spacing those markers makes
 * similar aliases hard to type.
 */
export function appendCategoryCommandTokenSpace(searchValue: string, options: {
    commandPrefix: string;
    categoryPrefix: string;
    fieldPrefixes: string[];
    fieldPrefixEntries?: Array<{
        field: string;
        prefix: string;
    }>;
}) {
    const normalizedValue = searchValue.replace(/\u00A0/g, ' ');
    const commandPrefix = String(options.commandPrefix || '').trim().toLowerCase();
    const categoryPrefix = String(options.categoryPrefix || '').trim().toLowerCase();
    const lowerValue = normalizedValue.toLowerCase();
    // The legacy logic that blindly appended a hyphen here has been removed
    // in favor of the smart auto-appender in App.tsx.
    return searchValue;
}
/**
 * Keeps the native caret aligned when command-input normalization inserts or
 * removes text around the typed value.
 */
export function translateNormalizedCommandInputCursor({ rawValue, normalizedValue, cursorPosition, }: {
    rawValue: string;
    normalizedValue: string;
    cursorPosition: number;
}) {
    if (rawValue === normalizedValue) {
        return Math.max(0, Math.min(normalizedValue.length, cursorPosition));
    }
    let sharedPrefixLength = 0;
    while (sharedPrefixLength < rawValue.length &&
        sharedPrefixLength < normalizedValue.length &&
        rawValue[sharedPrefixLength] === normalizedValue[sharedPrefixLength]) {
        sharedPrefixLength += 1;
    }
    if (cursorPosition < sharedPrefixLength) {
        return Math.max(0, Math.min(normalizedValue.length, cursorPosition));
    }
    const delta = normalizedValue.length - rawValue.length;
    return Math.max(0, Math.min(normalizedValue.length, cursorPosition + delta));
}
