import { findCommandChainFieldMarkers } from '../cursorMarkers';
export type CreateComposerFieldPrefixEntry = {
    field: string;
    prefix: string;
};
export const replaceCreateComposerFieldSegment = ({ source, entries, field, primaryPrefix, value, }: {
    source: string;
    entries: ReadonlyArray<CreateComposerFieldPrefixEntry>;
    field: string;
    primaryPrefix: string;
    value: string;
}) => {
    const fieldValue = String(value || '').trim();
    const segment = fieldValue ? `${primaryPrefix} ${fieldValue}` : `${primaryPrefix} `;
    const targetEntries = entries
        .filter(entry => entry.field === field && String(entry.prefix || '').trim())
        .sort((a, b) => String(b.prefix).length - String(a.prefix).length);
    const sourceWithTargetBoundaries = targetEntries.reduce((nextSource, entry) => {
        const escapedPrefix = String(entry.prefix).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return nextSource.replace(new RegExp(`(\\S)(${escapedPrefix})(?=\\s|$)`, 'gi'), '$1 $2');
    }, source);
    const markers = findCommandChainFieldMarkers(sourceWithTargetBoundaries, entries as any);
    const fieldMarkers = markers.filter(candidate => candidate.field === field);
    const marker = fieldMarkers[0];
    if (!marker) {
        return [sourceWithTargetBoundaries.trim(), segment.trimEnd()].filter(Boolean).join(' ');
    }
    const parts: string[] = [];
    let cursor = 0;
    for (const currentMarker of markers) {
        if (currentMarker.field !== field)
            continue;
        parts.push(sourceWithTargetBoundaries.slice(cursor, currentMarker.start));
        if (currentMarker.start === marker.start) {
            parts.push(segment.trimEnd());
        }
        cursor = currentMarker.end;
    }
    parts.push(sourceWithTargetBoundaries.slice(cursor));
    return parts
        .join('')
        .replace(/[\t ]+/g, ' ')
        .replace(/[\t ]*\n[\t ]*/g, '\n')
        .trim();
};
export const commitCreateComposerFavoriteField = ({ source, entries, primaryPrefix, appendDash = false, }: {
    source: string;
    entries: ReadonlyArray<CreateComposerFieldPrefixEntry>;
    primaryPrefix: string;
    appendDash?: boolean;
}) => {
    const normalizedPrefix = String(primaryPrefix || '').trim();
    if (!normalizedPrefix) {
        const fallbackSource = String(source || '').trimEnd();
        return appendDash ? `${fallbackSource} -`.trimStart() : `${fallbackSource} `;
    }
    const nextValue = replaceCreateComposerFieldSegment({
        source,
        entries,
        field: 'favorite',
        primaryPrefix: normalizedPrefix,
        value: '',
    });
    return appendDash ? `${nextValue.trimEnd()} -` : `${nextValue.trimEnd()} `;
};
