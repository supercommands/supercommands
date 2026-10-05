import * as React from 'react';
import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { createTag, deleteTag, type TagRecord } from '../../../allObjectFolder/src/createObject/tags';
import { useDbStore } from '../../../storage/store/useDbStore';
import { TagSelector } from '../../editorToolbar/TagSelector';
import { EXPLORER_MAIN_CONTENT_STYLE } from '../../knowledgeGraph/explorerMainContentStyle';
import { ensureLibraryWidgetForDashboardTagAsync } from '../../../storage/localStorage/widgetDashboardStorage';
import { useUIStore } from '../../uiStateManager';
export interface SpreadsheetTagSelectorProps {
    cellElement: HTMLElement | null;
    initialTagIds: string[];
    onSave: (tagIds: string[]) => void;
    onCancel: () => void;
    onNavigateFromCleanEdit?: (rowDelta: number, colDelta: number) => void;
    onCommit?: () => void;
    keepOpenOnEnter?: boolean;
    organisationId?: string | null;
    entityType?: string;
}
const POPOVER_WIDTH = 280;
const POPOVER_HEIGHT = 260;
const computePosition = (cellElement: HTMLElement | null) => {
    if (!cellElement) {
        return { top: 100, left: 100, width: POPOVER_WIDTH };
    }
    const rect = cellElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const placeAbove = rect.bottom + POPOVER_HEIGHT > viewportHeight && rect.top > POPOVER_HEIGHT;
    const width = Math.max(POPOVER_WIDTH, rect.width);
    return {
        top: placeAbove
            ? Math.max(8, rect.top - POPOVER_HEIGHT - 4)
            : Math.min(viewportHeight - POPOVER_HEIGHT - 8, rect.bottom + 4),
        left: Math.min(Math.max(8, rect.left), Math.max(8, viewportWidth - width - 8)),
        width,
    };
};
const getCellThemeVars = (cellElement: HTMLElement | null): React.CSSProperties => {
    if (!cellElement || typeof window === 'undefined')
        return {};
    const computed = window.getComputedStyle(cellElement);
    const variableNames = [
        '--color-contextMenuBg',
        '--color-modalBg',
        '--color-popupBg',
        '--color-inputBg',
        '--color-selectedBg',
        '--color-hoverBg',
        '--color-textPrimary',
        '--color-textSecondary',
        '--color-textMuted',
        '--color-textPlaceholder',
        '--color-borderDefault',
        '--color-borderActive',
        '--color-accent',
        '--color-danger'
    ];
    return variableNames.reduce<React.CSSProperties>((style, variableName) => {
        const value = computed.getPropertyValue(variableName).trim();
        if (value) {
            (style as Record<string, string>)[variableName] = value;
        }
        return style;
    }, {});
};
const dedupeIds = (ids: string[]) => Array.from(new Set(ids.filter(Boolean)));
export const SpreadsheetTagSelector: React.FC<SpreadsheetTagSelectorProps> = ({ cellElement, initialTagIds = [], onSave, onCancel, onCommit, keepOpenOnEnter = false, onNavigateFromCleanEdit, organisationId, entityType, }) => {
    const dbTags = useDbStore(state => state.tags) || [];
    const [selectedIds, setSelectedIds] = useState<string[]>(() => dedupeIds(initialTagIds));
    const [position, setPosition] = useState(() => computePosition(cellElement));
    const [themeVars, setThemeVars] = useState<React.CSSProperties>(() => getCellThemeVars(cellElement));
    useLayoutEffect(() => {
        setPosition(computePosition(cellElement));
        setThemeVars(getCellThemeVars(cellElement));
    }, [cellElement]);
    useEffect(() => {
        setSelectedIds(dedupeIds(initialTagIds));
    }, [initialTagIds]);
    useEffect(() => {
        return useUIStore.getState().registerEscapeInterceptor(() => {
            onCancel();
            return true;
        });
    }, [onCancel]);
    const selectedTags = React.useMemo<TagRecord[]>(() => {
        return selectedIds
            .map(id => dbTags.find(tag => tag.id === id))
            .filter((tag): tag is TagRecord => Boolean(tag));
    }, [dbTags, selectedIds]);
    const persistSelectedIds = React.useCallback((nextIds: string[]) => {
        const deduped = dedupeIds(nextIds);
        setSelectedIds(deduped);
        onSave(deduped);
    }, [onSave]);
    const handleTagSelect = React.useCallback((tag: TagRecord) => {
        const selectedByName = selectedIds.includes(tag.id);
        const nextIds = selectedByName
            ? selectedIds.filter(id => id !== tag.id)
            : [...selectedIds, tag.id];
        persistSelectedIds(nextIds);
        if (!selectedByName && tag.workspaceId && entityType) {
            void ensureLibraryWidgetForDashboardTagAsync({
                tagId: tag.id,
                workspaceId: tag.workspaceId,
                entityType,
            }).catch(error => console.error('[SpreadsheetTagSelector] Failed to sync dashboard library widget:', error));
        }
    }, [entityType, persistSelectedIds, selectedIds]);
    const handleCreateTag = React.useCallback(async (rawName: string) => {
        const trimmed = rawName.trim();
        if (!trimmed)
            return;
        const normalizedName = trimmed.toLowerCase();
        const existing = dbTags.find(tag => tag.name.trim().toLowerCase() === normalizedName);
        if (existing) {
            handleTagSelect(existing);
            return;
        }
        const created = await createTag(trimmed);
        persistSelectedIds([...selectedIds, created.id]);
    }, [dbTags, handleTagSelect, persistSelectedIds, selectedIds]);
    const handleRemoveTag = React.useCallback((tagId: string) => {
        const targetTag = dbTags.find(tag => tag.id === tagId);
        if (!targetTag) {
            persistSelectedIds(selectedIds.filter(id => id !== tagId));
            return;
        }
        persistSelectedIds(selectedIds.filter(id => id !== tagId));
    }, [persistSelectedIds, selectedIds]);
    const handleDeleteTag = React.useCallback(async (tagId: string) => {
        const targetTag = dbTags.find(tag => tag.id === tagId);
        if (!targetTag) {
            await deleteTag(tagId);
            handleRemoveTag(tagId);
            return;
        }
        if (targetTag.id && !targetTag.id.startsWith('temp_'))
            await deleteTag(targetTag.id);
        persistSelectedIds(selectedIds.filter(id => id !== targetTag.id));
    }, [dbTags, handleRemoveTag, persistSelectedIds, selectedIds]);
    const popoverContent = (<div data-ignore-grid-nav="true" data-todo-local-escape="true" onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onKeyDown={event => {
            if (event.key === 'Enter' && !keepOpenOnEnter)
                queueMicrotask(() => onCommit?.());
            if (event.key === 'Tab' && onNavigateFromCleanEdit) {
                event.preventDefault();
                event.stopPropagation();
                onCancel();
                onNavigateFromCleanEdit(0, event.shiftKey ? -1 : 1);
            }
        }} style={{
            position: 'fixed',
            top: `${position.top}px`,
            left: `${position.left}px`,
            width: `${position.width}px`,
            zIndex: 99999,
            ...themeVars,
            ...EXPLORER_MAIN_CONTENT_STYLE,
        }}>
      <TagSelector selectedTags={selectedTags} dbTags={dbTags} onTagSelect={handleTagSelect} onRemoveTag={handleRemoveTag} onCreateTag={handleCreateTag} onDeleteTag={handleDeleteTag} onClearTags={() => persistSelectedIds([])} organisationId={organisationId} placeholder="Search or create tag" isOpen={true} onOpenChange={open => {
            if (!open)
                onCancel();
        }} autoFocusInput/>
    </div>);
    return createPortal(popoverContent, document.body);
};
