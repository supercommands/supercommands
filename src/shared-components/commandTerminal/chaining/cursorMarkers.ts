/**
 * Shared cursor and field-marker helpers for command chains and palettes.
 */
export type CommandChainFieldMarker = {
    field: string;
    start: number;
    prefix: string;
    end: number;
};
export type CommandChainFieldActivationCursorMode = 'value-start' | 'value-end';
export type CommandChainFieldActivation = {
    nextSource: string;
    cursor: number;
    marker: CommandChainFieldMarker | null;
    insertedPrimaryPrefix: boolean;
};
const resolveFieldPrefixToken = (source: string, lowerSource: string, index: number, entries: Array<{
    field: string;
    prefix: string;
}>, options: {
    allowUnambiguousPartial?: boolean;
    requireDash?: boolean;
}): {
    field: string;
    prefix: string;
    tokenEnd: number;
} | null => {
    const tokenEnd = (() => {
        for (let cursor = index; cursor < source.length; cursor += 1) {
            if (/\s/.test(source[cursor]))
                return cursor;
        }
        return source.length;
    })();
    const token = lowerSource.slice(index, tokenEnd);
    if (!token || (options.requireDash !== false && (!token.startsWith('-') || token.length <= 1)))
        return null;
    const exactMatches = entries.filter(entry => String(entry.prefix || '').toLowerCase() === token);
    const candidates = exactMatches.length ? exactMatches : options.allowUnambiguousPartial
        ? entries.filter(entry => String(entry.prefix || '').toLowerCase().startsWith(token)) : [];
    const exactFields = Array.from(new Set(candidates.map(entry => entry.field)));
    if (exactFields.length === 1) {
        const field = exactFields[0];
        return field ? { field, prefix: token, tokenEnd } : null;
    }
    return null;
};
/**
 * Finds subcommand field markers in a command-chain source string.
 *
 * Notes, Todos, tags, hotkeys, time, and references all use the same marker
 * shape. Only exact configured prefixes become field markers; partial tokens
 * such as `-ta` remain draft prefix text until the user completes or activates
 * them. Keeping the scan here prevents each popup from carrying its own
 * slightly different parser.
 */
export const findCommandChainFieldMarkers = (source: string, entries: Array<{
    field: string;
    prefix: string;
}>, options: {
    allowUnambiguousPartial?: boolean;
    requireDash?: boolean;
} = {}): CommandChainFieldMarker[] => {
    const lowerSource = String(source || '').toLowerCase();
    const prefixCandidates = entries
        .filter(entry => String(entry.prefix || '').trim())
        .sort((a, b) => String(b.prefix).length - String(a.prefix).length);
    const markers: Array<Omit<CommandChainFieldMarker, 'end'>> = [];
    for (let index = 0; index < source.length; index += 1) {
        if (index > 0 && !/\s/.test(source[index - 1]))
            continue;
        const marker = resolveFieldPrefixToken(source, lowerSource, index, prefixCandidates, options);
        if (!marker)
            continue;
        markers.push({ field: marker.field, start: index, prefix: marker.prefix });
        index += Math.max(marker.tokenEnd - index - 1, 0);
    }
    return markers.map((marker, index) => ({
        ...marker,
        end: markers[index + 1]?.start ?? source.length,
    }));
};
export const isCommandChainDraftPrefixTokenAtCursor = (source: string, cursor: number | null, markers: CommandChainFieldMarker[]): boolean => {
    if (cursor === null)
        return false;
    const boundedCursor = Math.max(0, Math.min(cursor, source.length));
    let tokenStart = boundedCursor;
    while (tokenStart > 0 && !/\s/.test(source[tokenStart - 1])) {
        tokenStart -= 1;
    }
    let tokenEnd = boundedCursor;
    while (tokenEnd < source.length && !/\s/.test(source[tokenEnd])) {
        tokenEnd += 1;
    }
    const token = source.slice(tokenStart, tokenEnd);
    if (!token.startsWith('-'))
        return false;
    return !markers.some(marker => marker.start === tokenStart);
};
export const getCommandChainDraftPrefixFieldAtCursor = (source: string, cursor: number | null, markers: CommandChainFieldMarker[], entries: Array<{
    field: string;
    prefix: string;
}>): string | null => {
    if (cursor === null)
        return null;
    const boundedCursor = Math.max(0, Math.min(cursor, source.length));
    let tokenStart = boundedCursor;
    while (tokenStart > 0 && !/\s/.test(source[tokenStart - 1])) {
        tokenStart -= 1;
    }
    let tokenEnd = boundedCursor;
    while (tokenEnd < source.length && !/\s/.test(source[tokenEnd])) {
        tokenEnd += 1;
    }
    if (markers.some(marker => marker.start === tokenStart))
        return null;
    const token = source.slice(tokenStart, tokenEnd).toLowerCase();
    if (!token.startsWith('-') || token.length <= 1)
        return null;
    const exactMatches = entries.filter(entry => String(entry.prefix || '').toLowerCase() === token);
    const exactFields = Array.from(new Set(exactMatches.map(entry => entry.field)));
    if (exactFields.length === 1)
        return exactFields[0];
    if (exactFields.length > 0)
        return null;
    const partialMatches = entries.filter(entry => String(entry.prefix || '').toLowerCase().startsWith(token));
    const partialFields = Array.from(new Set(partialMatches.map(entry => entry.field)));
    return partialFields.length === 1 ? partialFields[0] : null;
};
/**
 * Identifies which field marker the cursor currently resides in.
 */
export const getCommandChainCursorMarker = (source: string, markers: CommandChainFieldMarker[], cursor: number | null): CommandChainFieldMarker | undefined => {
    if (cursor === null)
        return undefined;
    if (isCommandChainDraftPrefixTokenAtCursor(source, cursor, markers))
        return undefined;
    return markers.find(marker => {
        const segment = source.slice(marker.start, marker.end);
        // Free-text fields own spaces inside their value. Tag fields also need this
        // because users can create multi-word tags; `-` is still handled by the
        // active tag keyboard controller before it is inserted as text.
        const isFreeTextField = marker.field === 'title' || marker.field === 'description' || marker.field === 'tag';
        const end = isFreeTextField
            ? marker.end
            : segment.trim().toLowerCase() === marker.prefix.toLowerCase()
                ? marker.end
                : marker.start + segment.trimEnd().length;
        return cursor >= marker.start && cursor <= end &&
            (cursor < marker.end || marker.end === source.length);
    });
};
export const getCommandChainTrailingPrefixMarkerNeedingSpace = (source: string, entries: Array<{
    field: string;
    prefix: string;
}>): CommandChainFieldMarker | null => {
    if (/\s$/.test(source))
        return null;
    const trimmedSource = String(source || '').trimEnd();
    return [...findCommandChainFieldMarkers(trimmedSource, entries)]
        .reverse()
        .find(marker => marker.end === trimmedSource.length &&
        trimmedSource.slice(marker.start, marker.end).trim().toLowerCase() === marker.prefix.toLowerCase());
};
const resolveDraftFieldToken = (source: string, entries: Array<{
    field: string;
    prefix: string;
}>, field: string): CommandChainFieldMarker | null => {
    const trimmedSource = source.replace(/\s+$/, '');
    const trailingPrefixToken = /(^|\s)(-\S*)$/.exec(trimmedSource);
    if (!trailingPrefixToken)
        return null;
    const token = trailingPrefixToken[2] || '';
    const tokenStart = trailingPrefixToken.index + trailingPrefixToken[1].length;
    if (!token.startsWith('-') || token.length <= 1)
        return null;
    const lowerToken = token.toLowerCase();
    const exactMatches = entries.filter(entry => String(entry.prefix || '').toLowerCase() === lowerToken);
    const exactFields = Array.from(new Set(exactMatches.map(entry => entry.field)));
    if (exactFields.length === 1 && exactFields[0] === field) {
        return { field, start: tokenStart, prefix: token, end: trimmedSource.length };
    }
    if (exactFields.length > 0)
        return null;
    const partialMatches = entries.filter(entry => String(entry.prefix || '').toLowerCase().startsWith(lowerToken));
    const partialFields = Array.from(new Set(partialMatches.map(entry => entry.field)));
    if (partialFields.length === 1 && partialFields[0] === field) {
        return { field, start: tokenStart, prefix: token, end: trimmedSource.length };
    }
    return null;
};
const resolveFieldActivationFromMarker = (source: string, marker: CommandChainFieldMarker, cursorMode: CommandChainFieldActivationCursorMode): CommandChainFieldActivation => {
    const tokenEnd = marker.start + marker.prefix.length;
    const hasPrefixSpace = /\s/.test(source[tokenEnd] || '');
    const segment = source.slice(marker.start, marker.end);
    if (!hasPrefixSpace && segment.trim().toLowerCase() === marker.prefix.toLowerCase()) {
        const nextSource = `${source.slice(0, tokenEnd)} ${source.slice(tokenEnd).trimStart()}`;
        return {
            nextSource,
            cursor: tokenEnd + 1,
            marker: {
                ...marker,
                end: marker.end + 1,
            },
            insertedPrimaryPrefix: false,
        };
    }
    const valueStart = tokenEnd + (hasPrefixSpace ? 1 : 0);
    const valueEnd = Math.max(valueStart, marker.start + segment.trimEnd().length);
    return {
        nextSource: source,
        cursor: Math.min(cursorMode === 'value-end' ? valueEnd : valueStart, source.length),
        marker,
        insertedPrimaryPrefix: false,
    };
};
const resolveDraftFieldActivationFromMarker = (source: string, marker: CommandChainFieldMarker, replacementPrefix: string): CommandChainFieldActivation => {
    const prefix = replacementPrefix.trim() || marker.prefix;
    const nextSource = `${source.slice(0, marker.start)}${prefix} ${source.slice(marker.end).trimStart()}`;
    return {
        nextSource,
        cursor: marker.start + prefix.length + 1,
        marker: {
            ...marker,
            prefix,
            end: marker.start + prefix.length + 1,
        },
        insertedPrimaryPrefix: false,
    };
};
/**
 * Resolves where a command-field activation should place the caret.
 *
 * Exact aliases are preserved. Unique draft prefixes such as `-ta` are
 * completed to the activated field's configured prefix so the parser can enter
 * that field mode immediately after Enter, Space, or click activation.
 */
export const resolveCommandChainFieldActivation = ({ source, entries, field, primaryPrefix, cursorMode = 'value-start', }: {
    source: string;
    entries: Array<{
        field: string;
        prefix: string;
    }>;
    field: string;
    primaryPrefix: string;
    cursorMode?: CommandChainFieldActivationCursorMode;
}): CommandChainFieldActivation => {
    const markers = findCommandChainFieldMarkers(source, entries);
    const existingMarker = [...markers].reverse().find(candidate => candidate.field === field);
    if (existingMarker) {
        return resolveFieldActivationFromMarker(source, existingMarker, cursorMode);
    }
    const draftMarker = resolveDraftFieldToken(source, entries, field);
    if (draftMarker) {
        const isExactConfiguredPrefix = entries.some(entry => entry.field === field && String(entry.prefix || '').toLowerCase() === draftMarker.prefix.toLowerCase());
        if (!isExactConfiguredPrefix) {
            return resolveDraftFieldActivationFromMarker(source, draftMarker, primaryPrefix);
        }
        return resolveFieldActivationFromMarker(source, draftMarker, cursorMode);
    }
    const trimmedSource = source.replace(/\s+$/, '');
    const trailingMarker = [...markers]
        .reverse()
        .find(marker => {
        const markerTrimmedEnd = marker.start + source.slice(marker.start, marker.end).trimEnd().length;
        return markerTrimmedEnd === trimmedSource.length;
    });
    if (trailingMarker) {
        const nextSource = `${trimmedSource} ${primaryPrefix} `;
        return {
            nextSource,
            cursor: nextSource.length,
            marker: null,
            insertedPrimaryPrefix: true,
        };
    }
    const trailingPrefixToken = /(^|\s)(-\S*)$/.exec(trimmedSource);
    if (trailingPrefixToken) {
        const tokenStart = trailingPrefixToken.index + trailingPrefixToken[1].length;
        const head = trimmedSource.slice(0, tokenStart).trimEnd();
        const nextSource = `${[head, primaryPrefix].filter(Boolean).join(' ')} `;
        return {
            nextSource,
            cursor: nextSource.length,
            marker: null,
            insertedPrimaryPrefix: true,
        };
    }
    const baseValue = source.trim();
    const nextSource = `${baseValue}${baseValue ? ' ' : ''}${primaryPrefix} `;
    return {
        nextSource,
        cursor: nextSource.length,
        marker: null,
        insertedPrimaryPrefix: true,
    };
};
/**
 * Computes horizontal offset so popups anchor directly under the active field prefix/marker.
 */
export const getCommandChainFieldPopupLeft = ({ input, hostRect, source, sourceOffset, field, entries, width, }: {
    input: HTMLInputElement | HTMLTextAreaElement | null;
    hostRect?: DOMRect | null;
    source: string;
    sourceOffset: number;
    field: string;
    entries: Array<{
        field: string;
        prefix: string;
    }>;
    width: number;
}): number | null => {
    if (!input)
        return null;
    const markers = findCommandChainFieldMarkers(source, entries);
    const sourceCursor = Math.max(0, (input.selectionStart ?? input.value.length) - sourceOffset);
    const marker = markers.find(candidate => candidate.field === field && sourceCursor >= candidate.start && sourceCursor <= candidate.end) ||
        [...markers].reverse().find(candidate => candidate.field === field);
    if (!marker)
        return null;
    const inputRect = input.getBoundingClientRect();
    const computed = window.getComputedStyle(input);
    if (typeof document === 'undefined')
        return null;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context)
        return null;
    context.font =
        computed.font ||
            `${computed.fontStyle} ${computed.fontVariant} ${computed.fontWeight} ${computed.fontSize} / ${computed.lineHeight} ${computed.fontFamily}`;
    const markerTextOffset = context.measureText(input.value.slice(0, sourceOffset + marker.start)).width;
    const rawLeft = inputRect.left - (hostRect?.left ?? 0) + markerTextOffset - input.scrollLeft;
    const maxLeft = hostRect ? Math.max(0, hostRect.width - width) : rawLeft;
    return Math.max(0, Math.min(rawLeft, maxLeft));
};
/**
 * Removes the field marker at cursor position if the field value is empty or only the prefix remains.
 * Returns null if no field was removed.
 */
export const removeCommandChainFieldAtCursor = ({ source, cursor, entries, forceField, }: {
    source: string;
    cursor: number | null;
    entries: Array<{
        field: string;
        prefix: string;
    }>;
    forceField?: string;
}): {
    nextSource: string;
    nextCursor: number;
    field: string;
} | null => {
    const markers = findCommandChainFieldMarkers(source, entries);
    const activeMarker = forceField
        ? [...markers].reverse().find(marker => marker.field === forceField)
        : getCommandChainCursorMarker(source, markers, cursor);
    if (!activeMarker)
        return null;
    const segment = source.slice(activeMarker.start, activeMarker.end);
    const segmentTrimmed = segment.trim();
    // If the segment only has the prefix (e.g. "-tag" or "-hk ") with no substantive value
    if (forceField ||
        segmentTrimmed.toLowerCase() === activeMarker.prefix.toLowerCase() ||
        segmentTrimmed === '') {
        const before = source.slice(0, activeMarker.start).replace(/\s+$/, '');
        const after = source.slice(activeMarker.end).replace(/^\s+/, '');
        const nextSource = [before, after].filter(Boolean).join(' ');
        const nextCursor = Math.min(before.length, nextSource.length);
        return { nextSource, nextCursor, field: activeMarker.field };
    }
    return null;
};
/**
 * Formats metadata and Tab-cycling hint for quick create/chain rows.
 */
export const getQuickCreateRowMeta = (fields: any, orderedFields: Array<'title' | 'description' | 'url' | 'tag' | 'hotkey' | 'shortcut' | 'recurring' | 'time' | 'reference' | 'favorite'>, labels: Record<string, string>): string => {
    const summaryByField: Record<string, string | null> = {
        title: fields?.title ? `Title: ${fields.title}` : null,
        description: fields?.description ? `Description: ${fields.description}` : null,
        url: Array.isArray(fields?.urls) && fields.urls.length > 0 ? `URLs: ${fields.urls.join(', ')}` : null,
        tag: Array.isArray(fields?.tagNames) && fields.tagNames.length > 0 ? `Tags: ${fields.tagNames.join(', ')}` : null,
        hotkey: fields?.hotkey ? String(fields.hotkey) : null,
        shortcut: fields?.shortcut ? `Command: ${fields.shortcut}` : null,
        recurring: fields?.recurring ? `Recurring: ${fields.recurring}` : null,
        time: fields?.time ? `Time: ${fields.time}` : null,
        reference: fields?.reference ? `Attach: ${fields.reference}` : null,
        favorite: fields?.isFavorite ? 'Favorite' : null,
    };
    const fieldSummary = orderedFields
        .map(field => summaryByField[field])
        .filter(Boolean)
        .join('  |  ');
    if (fieldSummary)
        return fieldSummary;
    const hintLabelByField: Record<string, string> = {
        title: 'title',
        description: 'description',
        url: 'url',
        tag: 'tags',
        hotkey: 'hotkey',
        shortcut: 'text command',
        recurring: 'recurring',
        time: 'time',
        reference: 'attach',
        favorite: 'favorite',
    };
    const hints = orderedFields
        .map(field => {
        const prefix = String(labels?.[field] || '').trim();
        return prefix ? `${prefix} ${hintLabelByField[field]}` : '';
    })
        .filter(Boolean)
        .join(', ');
    return hints ? `Tab: ${hints}` : '';
};
