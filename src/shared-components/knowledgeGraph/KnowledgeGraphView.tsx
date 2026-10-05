import TextExpanderIcon from '../icons/TextExpanderIcon';
import { TagAppearance } from '../editorToolbar/TagAppearance';
import type { TagRecord } from '../../allObjectFolder/src/createObject/tags/tagTypes';
import type * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link2, Maximize2, RotateCcw, Search, Tag, X } from 'lucide-react';
import { BsCalendarCheck } from 'react-icons/bs';

import { LuSparkles } from 'react-icons/lu';
import { getCollectionWidgetViews, useDbStore } from '../../storage/store/useDbStore';
import { useWidgetDashboardStore } from '../../storage/store/useWidgetDashboardStore';
import type { WidgetDashboardView, WidgetInstance, } from '../../pages/AltS_search_newtab/src/components/widgets/widgetDashboard.types';
import { useUIStore } from '../uiStateManager';
import NotesIcon from '../icons/notesIcon';
import { SessionGridIcon } from '../icons/sessionGridIcon';
import ExplorerModeSwitcher, { type ExplorerMode } from './ExplorerModeSwitcher';
import { EXPLORER_MAIN_CONTENT_STYLE } from './explorerMainContentStyle';
type GraphNodeType = 'note' | 'link' | 'snippet' | 'todo' | 'session' | 'agent' | 'collection';
type GraphEditorType = GraphNodeType | 'aiPrompt';
type FilterMode = 'type' | 'tag' | 'workspace';
type GraphEdgeKind = 'reference' | 'tag' | 'host' | 'workspace' | 'organisation' | 'keyword';
type GraphRecord = Record<string, unknown>;
const asGraphRecord = (record: unknown): GraphRecord => record && typeof record === 'object' ? (record as GraphRecord) : {};
const getOptionalString = (value: unknown): string | null => {
    const normalized = String(value || '').trim();
    return normalized || null;
};
interface GraphNode {
    id: string;
    type: GraphNodeType;
    editorType: GraphEditorType;
    record: GraphRecord;
    title: string;
    bodyText: string;
    organisationId?: string | null;
    collectionViewId?: string | null;
    tagIds: string[];
    referenceIds: string[];
    urls: string[];
    updatedAt: number;
}
interface PositionedNode extends GraphNode {
    x: number;
    y: number;
    clusterId: string;
    clusterLabel: string;
    clusterColorVar: string;
    clusterCenter: {
        x: number;
        y: number;
    };
}
interface GraphEdge {
    id: string;
    source: string;
    target: string;
    strength: number;
    kind: GraphEdgeKind;
}
interface GraphCluster {
    id: string;
    label: string;
    count: number;
    colorVar: string;
    center: {
        x: number;
        y: number;
    };
    nodeType?: GraphNodeType;
    tagId?: string;
    collectionViewId?: string;
}
const NODE_TYPES: Array<{
    id: GraphNodeType;
    label: string;
    colorVar: string;
}> = [
    { id: 'note', label: 'Notes', colorVar: '--color-accent' },
    { id: 'link', label: 'Links', colorVar: '--color-success' },
    { id: 'snippet', label: 'Text expanders', colorVar: '--color-info' },
    { id: 'todo', label: 'Todo', colorVar: '--color-warning' },
    { id: 'session', label: 'Workspaces', colorVar: '--color-tutorialAccent' },
    { id: 'agent', label: 'Chat agents', colorVar: '--color-error' }
];
const TYPE_LABELS = new Map<GraphNodeType, string>([
    ...NODE_TYPES.map(type => [type.id, type.label] as [
        GraphNodeType,
        string
    ]),
    ['collection', 'Workspace Sessions']
]);
const TYPE_COLORS = new Map<GraphNodeType, string>([
    ...NODE_TYPES.map(type => [type.id, `var(${type.colorVar})`] as [
        GraphNodeType,
        string
    ]),
    ['collection', 'var(--color-accent)']
]);
const GRAPH_VIEWBOX = { width: 1600, height: 900 };
const GRAPH_GLOW_INTENSITY = 0.4;
const FOCUSED_CLUSTER_CENTER = { x: GRAPH_VIEWBOX.width / 2, y: GRAPH_VIEWBOX.height / 2 };
const get2DClusterCenter = (index: number, count: number) => {
    if (count <= 1) {
        return { x: 900, y: 500 };
    }
    if (count === 2) {
        return [
            { x: 500, y: 500 },
            { x: 1300, y: 500 }
        ][index] || { x: 900, y: 500 };
    }
    if (count === 3) {
        return [
            { x: 480, y: 350 },
            { x: 1320, y: 350 },
            { x: 900, y: 680 }
        ][index] || { x: 900, y: 500 };
    }
    if (count === 4) {
        return [
            { x: 480, y: 320 },
            { x: 1320, y: 320 },
            { x: 480, y: 680 },
            { x: 1320, y: 680 }
        ][index] || { x: 900, y: 500 };
    }
    if (count === 5) {
        return [
            { x: 420, y: 320 },
            { x: 900, y: 320 },
            { x: 1380, y: 320 },
            { x: 620, y: 680 },
            { x: 1180, y: 680 }
        ][index] || { x: 900, y: 500 };
    }
    if (count === 6) {
        return [
            { x: 420, y: 300 },
            { x: 900, y: 300 },
            { x: 1380, y: 300 },
            { x: 420, y: 700 },
            { x: 900, y: 700 },
            { x: 1380, y: 700 }
        ][index] || { x: 900, y: 500 };
    }
    const cols = Math.min(4, Math.max(3, Math.ceil(Math.sqrt(count))));
    const row = Math.floor(index / cols);
    const col = index % cols;
    const totalRows = Math.ceil(count / cols);
    const itemsInRow = Math.min(cols, count - row * cols);
    const xSpacing = 960 / Math.max(1, cols - 1 || 1);
    const ySpacing = 480 / Math.max(1, totalRows - 1 || 1);
    const startX = 800 - ((itemsInRow - 1) * xSpacing) / 2;
    const startY = 450 - ((totalRows - 1) * ySpacing) / 2;
    return {
        x: Math.round(startX + col * xSpacing),
        y: Math.round(startY + row * ySpacing),
    };
};
const getGridClusterCenter = (index: number, count: number) => get2DClusterCenter(index, count);
const getTagClusterCenter = getGridClusterCenter;
const getWorkspaceClusterCenter = getGridClusterCenter;
const getTagColorVar = (tagId: string) => {
    const hash = Array.from(tagId).reduce((sum, character) => sum + character.charCodeAt(0), 0);
    return NODE_TYPES[hash % NODE_TYPES.length].colorVar;
};
const getWorkspaceColorVar = (organisationId: string) => {
    const hash = Array.from(organisationId).reduce((sum, character) => sum + character.charCodeAt(0), 0);
    return NODE_TYPES[(hash + 2) % NODE_TYPES.length].colorVar;
};
const normalizeCollectionReferenceType = (value: unknown): GraphEditorType | null => {
    const normalized = String(value || '')
        .toLowerCase()
        .replace(/[\s_-]+/g, '');
    if (!normalized)
        return null;
    if (normalized === 'note' || normalized === 'notes')
        return 'note';
    if (normalized === 'link' || normalized === 'links' || normalized === 'bookmark' || normalized === 'bookmarks')
        return 'link';
    if (normalized === 'snippet' ||
        normalized === 'snippets' ||
        normalized === 'textexpander' ||
        normalized === 'textexpanders')
        return 'snippet';
    if (normalized === 'todo' || normalized === 'todos')
        return 'todo';
    if (normalized === 'workspace' || normalized === 'session' || normalized === 'sessions' || normalized === 'tabsession')
        return 'session';
    if (normalized === 'agent' || normalized === 'chatagent' || normalized === 'chatagents')
        return 'agent';
    if (normalized === 'aiprompt' || normalized === 'prompt' || normalized === 'prompts')
        return 'aiPrompt';
    return null;
};
const getCollectionLibraryNodeType = (widget: WidgetInstance): GraphEditorType | null => {
    if (widget.type === 'note-library')
        return 'note';
    if (widget.type === 'link-library')
        return 'link';
    if (widget.type === 'snippet-library')
        return 'snippet';
    if (widget.type === 'ai-prompt-library')
        return 'aiPrompt';
    if (widget.type === 'todo-list')
        return 'todo';
    return null;
};
const getCollectionViewNodeIds = (view: WidgetDashboardView): string[] => {
    const nodeIds = new Set<string>();
    const entityIds = view.settings && typeof view.settings.onboardingEntityIds === 'object' && view.settings.onboardingEntityIds
        ? (view.settings.onboardingEntityIds as Record<string, unknown>)
        : {};
    const add = (type: GraphEditorType, id: unknown) => {
        const normalizedId = String(id || '').trim();
        if (!normalizedId)
            return;
        nodeIds.add(`${type}:${normalizedId}`);
    };
    if (Array.isArray(entityIds.noteIds))
        entityIds.noteIds.forEach(id => add('note', id));
    add('note', entityIds.noteId);
    add('link', entityIds.linkId);
    if (Array.isArray(entityIds.linkIds))
        entityIds.linkIds.forEach(id => add('link', id));
    add('session', entityIds.sessionId);
    add('aiPrompt', entityIds.aiPromptId);
    add('todo', entityIds.todoId);

    return Array.from(nodeIds);
};
const getCollectionWidgetNodeIds = (widget: WidgetInstance, allNodes: GraphNode[]): string[] => {
    const nodeIds = new Set<string>();
    const add = (type: unknown, id: unknown) => {
        const normalizedType = normalizeCollectionReferenceType(type);
        const normalizedId = String(id || '').trim();
        if (!normalizedType || !normalizedId)
            return;
        nodeIds.add(`${normalizedType}:${normalizedId}`);
    };
    add(widget?.referenceType, widget?.referenceId);
    add('note', widget?.noteId);
    add('link', widget?.linkId);
    add('session', widget?.sessionId);
    const settings = widget?.settings || {};
    const addIds = (type: GraphEditorType, value: unknown) => {
        if (!Array.isArray(value))
            return;
        value.forEach(id => add(type, id));
    };
    addIds('note', settings.selectedNoteIds);
    addIds('link', settings.selectedLinkIds || settings.selectedCollectionIds);
    addIds('snippet', settings.selectedSnippetIds);
    addIds('todo', settings.selectedTodoIds);
    addIds('agent', settings.selectedAgentIds || settings.selectedChatAgentIds);
    addIds('aiPrompt', settings.selectedPromptIds);
    const libraryType = getCollectionLibraryNodeType(widget);
    const sourceMode = String(settings.sourceMode || '').toLowerCase();
    if (libraryType && sourceMode === 'all') {
        allNodes
            .filter(node => node.editorType === libraryType || node.type === libraryType)
            .forEach(node => nodeIds.add(node.id));
    }
    if (libraryType && sourceMode === 'tags') {
        const selectedTagIds = Array.isArray(settings.selectedTagIds)
            ? settings.selectedTagIds.map(id => String(id || '').trim()).filter(Boolean)
            : [];
        const tagMatchMode = String(settings.tagMatchMode || 'any').toLowerCase();
        allNodes
            .filter(node => node.editorType === libraryType || node.type === libraryType)
            .filter(node => {
            if (selectedTagIds.length === 0)
                return false;
            return tagMatchMode === 'all'
                ? selectedTagIds.every(tagId => node.tagIds.includes(tagId))
                : selectedTagIds.some(tagId => node.tagIds.includes(tagId));
        })
            .forEach(node => nodeIds.add(node.id));
    }
    return Array.from(nodeIds);
};
const normalizeText = (value: unknown): string => {
    if (typeof value === 'string') {
        return value
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    if (!value || typeof value !== 'object')
        return '';
    try {
        return JSON.stringify(value);
    }
    catch {
        return '';
    }
};
const getRecordTitle = (record: unknown): string => {
    const source = asGraphRecord(record);
    return String(source.title || source.name || source.key || 'Untitled').trim() || 'Untitled';
};
const getRecordTagIds = (record: unknown, tags: Array<{
    id: string;
    name: string;
}> = []): string[] => {
    const source = asGraphRecord(record);
    const rawTagIds = Array.isArray(source.tagIds) ? source.tagIds : [];
    const legacyTags = Array.isArray(source.tags) ? source.tags : [];
    const ids = rawTagIds.map((id: unknown) => String(id || '').trim()).filter(Boolean);
    legacyTags.forEach((tag: unknown) => {
        const tagName = String(tag || '').trim();
        if (!tagName)
            return;
        const matched = tags.find(item => item.id === tagName || item.name.toLowerCase() === tagName.toLowerCase());
        ids.push(matched?.id || tagName);
    });
    return Array.from(new Set(ids));
};
const getRecordUrls = (record: unknown): string[] => {
    const source = asGraphRecord(record);
    const rawUrls = Array.isArray(source.urls)
        ? source.urls
        : source.modelUrls && typeof source.modelUrls === 'object'
            ? Object.values(source.modelUrls)
            : [];
    return rawUrls
        .map((item: unknown) => typeof item === 'string'
        ? item
        : item && typeof item === 'object' && 'url' in item
            ? (item as {
                url?: unknown;
            }).url
            : null)
        .map((url: unknown) => String(url || '').trim())
        .filter(Boolean);
};
const getHostname = (url: string): string | null => {
    try {
        const withProtocol = /^[a-z]+:\/\//i.test(url) ? url : `https://${url}`;
        return new URL(withProtocol).hostname.replace(/^www\./, '').toLowerCase();
    }
    catch {
        return null;
    }
};
const getKeywordSet = (node: GraphNode): Set<string> => {
    const words = `${node.title} ${node.bodyText}`
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .map(word => word.trim())
        .filter(word => word.length >= 4);
    return new Set(words.slice(0, 40));
};
const buildNodes = (state: ReturnType<typeof useDbStore.getState>): GraphNode[] => {
    const nodes: GraphNode[] = [];
    const add = (record: unknown, type: GraphNodeType, bodyText = '', references: string[] = [], editorType: GraphEditorType = type) => {
        const source = asGraphRecord(record);
        const rawId = getOptionalString(source.id);
        if (!rawId || source.deletedAt)
            return;
        const urls = getRecordUrls(source);
        nodes.push({
            id: `${editorType}:${rawId}`,
            type,
            editorType,
            record: source,
            title: getRecordTitle(source),
            bodyText,
            organisationId: getOptionalString(source.organisationId),
            tagIds: getRecordTagIds(source, state.tags),
            referenceIds: references.map(id => String(id || '').trim()).filter(Boolean),
            urls,
            updatedAt: Number(source.updatedAt || source.createdAt || 0),
        });
    };
    state.notes.forEach(note => add(note, 'note', normalizeText(note.body)));
    state.links.forEach(link => add(link, 'link', getRecordUrls(link).join(' ')));
    state.snippets.forEach(snippet => add(snippet, 'snippet', normalizeText(snippet.config)));
    state.todos.forEach(todo => add(todo, 'todo', normalizeText(todo.description), Array.isArray(todo.references) ? todo.references.map(reference => reference.id) : []));
    state.sessions.forEach(session => add(session, 'session', `${normalizeText(session.description)} ${getRecordUrls(session).join(' ')}`));
    state.aiPrompts.forEach(prompt => add(prompt, 'agent', `${normalizeText(prompt.prompt)} ${normalizeText(prompt.rules)} ${getRecordUrls(prompt).join(' ')}`, [], 'aiPrompt'));
    state.chatAgents.forEach(agent => add(agent, 'agent', getRecordUrls(agent).join(' ')));
    return nodes.sort((a, b) => b.updatedAt - a.updatedAt);
};
const buildCollectionNodes = (views: WidgetDashboardView[]): GraphNode[] => views
    .map(view => {
    const source = asGraphRecord(view);
    const rawId = getOptionalString(source.id);
    if (!rawId)
        return null;
    return {
        id: `collection:${rawId}`,
        type: 'collection' as const,
        editorType: 'collection' as const,
        record: source,
        title: getRecordTitle(source),
        bodyText: normalizeText(source.title),
        collectionViewId: rawId,
        tagIds: [],
        referenceIds: [],
        urls: [],
        updatedAt: Number(source.updatedAt || source.createdAt || 0),
    };
})
    .filter(Boolean) as GraphNode[];
const buildEdges = (nodes: GraphNode[]): GraphEdge[] => {
    const edges = new Map<string, GraphEdge>();
    const byRawId = new Map<string, GraphNode>();
    nodes.forEach(node => {
        const rawId = node.id.split(':').slice(1).join(':');
        byRawId.set(rawId, node);
    });
    const addEdge = (source: GraphNode, target: GraphNode, strength: number, kind: GraphEdgeKind) => {
        if (source.id === target.id)
            return;
        const [a, b] = [source.id, target.id].sort();
        const id = `${a}--${b}`;
        const existing = edges.get(id);
        edges.set(id, {
            id,
            source: a,
            target: b,
            strength: Math.min(4, (existing?.strength || 0) + strength),
            kind: existing?.kind === 'reference' ? 'reference' : kind,
        });
    };
    const tagMap = new Map<string, GraphNode[]>();
    const organisationMap = new Map<string, GraphNode[]>();
    const hostMap = new Map<string, GraphNode[]>();
    const keywordMap = new Map<string, GraphNode[]>();
    nodes.forEach(node => {
        if (node.type === 'collection')
            return;
        node.tagIds.forEach(tagId => {
            if (!tagMap.has(tagId))
                tagMap.set(tagId, []);
            tagMap.get(tagId)!.push(node);
        });
        if (node.organisationId) {
            if (!organisationMap.has(node.organisationId))
                organisationMap.set(node.organisationId, []);
            organisationMap.get(node.organisationId)!.push(node);
        }
        node.urls
            .map(getHostname)
            .filter(Boolean)
            .forEach(host => {
            if (!hostMap.has(host!))
                hostMap.set(host!, []);
            hostMap.get(host!)!.push(node);
        });
        getKeywordSet(node).forEach(keyword => {
            if (!keywordMap.has(keyword))
                keywordMap.set(keyword, []);
            keywordMap.get(keyword)!.push(node);
        });
    });
    [tagMap, hostMap].forEach(groupMap => {
        groupMap.forEach(group => {
            group.slice(0, 18).forEach((node, index) => {
                group.slice(index + 1, 18).forEach(other => addEdge(node, other, 2, groupMap === tagMap ? 'tag' : 'host'));
            });
        });
    });
    [organisationMap].forEach((groupMap, mapIndex) => {
        groupMap.forEach(group => {
            group.slice(0, 14).forEach((node, index) => {
                group
                    .slice(index + 1, 14)
                    .forEach(other => addEdge(node, other, 0.75, 'organisation'));
            });
        });
    });
    keywordMap.forEach(group => {
        if (group.length < 2 || group.length > 8)
            return;
        group.forEach((node, index) => {
            group.slice(index + 1).forEach(other => addEdge(node, other, 0.5, 'keyword'));
        });
    });
    nodes.forEach(node => {
        if (node.type === 'collection')
            return;
        node.referenceIds.forEach(referenceId => {
            const target = byRawId.get(referenceId);
            if (target)
                addEdge(node, target, 3, 'reference');
        });
    });
    return Array.from(edges.values())
        .sort((a, b) => b.strength - a.strength)
        .slice(0, 260);
};
const getNodeRingPosition = (node: GraphNode, index: number, count: number, center: {
    x: number;
    y: number;
}, angleOffset = 0) => {
    const nodesPerRing = count > 32 ? 16 : count > 20 ? 14 : count > 10 ? 12 : 8;
    const ringIndex = Math.floor(index / nodesPerRing);
    const ringPosition = index % nodesPerRing;
    const ringCount = Math.min(nodesPerRing, count - ringIndex * nodesPerRing);
    const angle = (ringPosition / Math.max(ringCount, 1)) * Math.PI * 2 - Math.PI / 2 + angleOffset + ringIndex * 0.34;
    const baseRing = count <= 1 ? 75 : count > 32 ? 115 : count > 20 ? 105 : count > 10 ? 95 : 75;
    const ring = baseRing + ringIndex * 54;
    const jitter = ring === 0 ? 0 : ((node.title.length + index * 17) % 10) - 5;
    return {
        x: center.x + Math.cos(angle) * ring + jitter,
        y: center.y + Math.sin(angle) * ring - jitter,
    };
};
const getTypePositionedNodes = (nodes: GraphNode[], focusedType: GraphNodeType | null): PositionedNode[] => {
    const byType = new Map<GraphNodeType, GraphNode[]>();
    nodes.forEach(node => {
        if (!byType.has(node.type))
            byType.set(node.type, []);
        byType.get(node.type)!.push(node);
    });
    const activeTypes = NODE_TYPES.map(t => t.id).filter(type => byType.has(type) && (byType.get(type)?.length || 0) > 0);
    const typeIndexMap = new Map(activeTypes.map((type, idx) => [type, idx]));
    return nodes.map(node => {
        const group = byType.get(node.type) || [];
        const index = group.findIndex(item => item.id === node.id);
        const count = Math.max(group.length, 1);
        const typeIdx = typeIndexMap.get(node.type) ?? 0;
        const center = focusedType === node.type ? FOCUSED_CLUSTER_CENTER : get2DClusterCenter(typeIdx, Math.max(1, activeTypes.length));
        const angleOffset = node.type === 'note' || node.type === 'snippet' ? Math.PI : 0;
        const position = getNodeRingPosition(node, index, count, center, angleOffset);
        return {
            ...node,
            ...position,
            clusterId: `type:${node.type}`,
            clusterLabel: TYPE_LABELS.get(node.type) || 'Items',
            clusterColorVar: NODE_TYPES.find(type => type.id === node.type)?.colorVar || '--color-accent',
            clusterCenter: center,
        };
    });
};
const getTagPositionedNodes = (nodes: GraphNode[], clusters: GraphCluster[]): PositionedNode[] => {
    const clusterByTagId = new Map(clusters.map(cluster => [cluster.tagId, cluster]));
    const nodesByClusterId = new Map<string, GraphNode[]>();
    nodes.forEach(node => {
        const cluster = node.tagIds.map(tagId => clusterByTagId.get(tagId)).find(Boolean);
        if (!cluster)
            return;
        if (!nodesByClusterId.has(cluster.id))
            nodesByClusterId.set(cluster.id, []);
        nodesByClusterId.get(cluster.id)!.push(node);
    });
    return nodes
        .map(node => {
        const cluster = node.tagIds.map(tagId => clusterByTagId.get(tagId)).find(Boolean);
        if (!cluster)
            return null;
        const group = nodesByClusterId.get(cluster.id) || [];
        const index = group.findIndex(item => item.id === node.id);
        const position = getNodeRingPosition(node, index, Math.max(group.length, 1), cluster.center);
        return {
            ...node,
            ...position,
            clusterId: cluster.id,
            clusterLabel: cluster.label,
            clusterColorVar: cluster.colorVar,
            clusterCenter: cluster.center,
        };
    })
        .filter(Boolean) as PositionedNode[];
};
const getWorkspacePositionedNodes = (nodes: GraphNode[], clusters: GraphCluster[], collectionNodeIdsByViewId: Map<string, Set<string>>): PositionedNode[] => {
    const nodesByClusterId = new Map<string, GraphNode[]>();
    nodes.forEach(node => {
        const cluster = node.type === 'collection'
            ? clusters.find(item => item.collectionViewId === node.collectionViewId)
            : clusters.find(item => collectionNodeIdsByViewId.get(item.collectionViewId || '')?.has(node.id));
        if (!cluster)
            return;
        if (!nodesByClusterId.has(cluster.id))
            nodesByClusterId.set(cluster.id, []);
        nodesByClusterId.get(cluster.id)!.push(node);
    });
    return nodes
        .map(node => {
        const cluster = node.type === 'collection'
            ? clusters.find(item => item.collectionViewId === node.collectionViewId)
            : clusters.find(item => collectionNodeIdsByViewId.get(item.collectionViewId || '')?.has(node.id));
        if (!cluster)
            return null;
        const group = nodesByClusterId.get(cluster.id) || [];
        const index = group.findIndex(item => item.id === node.id);
        const position = getNodeRingPosition(node, index, Math.max(group.length, 1), cluster.center);
        return {
            ...node,
            ...position,
            clusterId: cluster.id,
            clusterLabel: cluster.label,
            clusterColorVar: cluster.colorVar,
            clusterCenter: cluster.center,
        };
    })
        .filter(Boolean) as PositionedNode[];
};
const getDisplayTitle = (title: string) => (title.length > 28 ? `${title.slice(0, 28)}...` : title);
const getLabelBox = (node: PositionedNode) => {
    const center = node.clusterCenter;
    const label = getDisplayTitle(node.title);
    const width = Math.min(220, Math.max(52, label.length * 5.8 + 12));
    const alignRight = node.x < center.x;
    const anchor: 'start' | 'end' = alignRight ? 'end' : 'start';
    const labelGap = Math.hypot(node.x - center.x, node.y - center.y) < 150 ? 22 : 17;
    const verticalNudge = (((node.title.length + node.id.length) % 3) - 1) * 7;
    const x = alignRight ? node.x - width - labelGap : node.x + labelGap;
    return {
        x,
        y: node.y - 9 + verticalNudge,
        width,
        height: 18,
        textX: alignRight ? node.x - labelGap : node.x + labelGap,
        textY: node.y + 4 + verticalNudge,
        anchor,
        label,
    };
};
type NodeLabelBox = ReturnType<typeof getLabelBox>;
const getResolvedLabelBoxes = (nodes: PositionedNode[]): Map<string, NodeLabelBox> => {
    const resolved = new Map<string, NodeLabelBox>();
    const groups = new Map<string, Array<{
        node: PositionedNode;
        box: NodeLabelBox;
    }>>();
    nodes.forEach(node => {
        const box = getLabelBox(node);
        const side = box.anchor === 'end' ? 'left' : 'right';
        const key = `${node.clusterId}:${side}`;
        if (!groups.has(key))
            groups.set(key, []);
        groups.get(key)!.push({ node, box });
    });
    groups.forEach(items => {
        const sorted = [...items].sort((a, b) => a.box.textY - b.box.textY);
        const minGap = 22;
        let previousTextY = Number.NEGATIVE_INFINITY;
        sorted.forEach(({ node, box }) => {
            const distanceFromCenter = Math.hypot(node.x - node.clusterCenter.x, node.y - node.clusterCenter.y);
            const maxShift = distanceFromCenter > 180 ? 26 : 18;
            const requestedTextY = Math.max(box.textY, previousTextY + minGap);
            const textY = Math.min(requestedTextY, box.textY + maxShift);
            previousTextY = textY;
            resolved.set(node.id, {
                ...box,
                y: box.y + (textY - box.textY),
                textY,
            });
        });
    });
    return resolved;
};
const canShowEdgeForMode = (edge: GraphEdge, filterMode: FilterMode, selectedTypes: GraphNodeType[], query: string) => {
    if (edge.kind === 'reference')
        return true;
    if (edge.kind === 'tag')
        return filterMode === 'tag';
    if (edge.kind === 'workspace' || edge.kind === 'organisation')
        return filterMode === 'workspace';
    if (edge.kind === 'host')
        return filterMode === 'type' && selectedTypes.includes('link');
    return query.trim().length >= 3;
};
const matchesSelectedTags = (node: GraphNode, selectedTagIds: string[]): boolean => selectedTagIds.length === 0 || selectedTagIds.some(tagId => node.tagIds.includes(tagId));
const openNode = (node: GraphNode) => {
    const rawId = node.editorType === 'collection' && node.collectionViewId
        ? node.collectionViewId
        : node.id.split(':').slice(1).join(':');
    let urlType = node.editorType as string;
    if (node.type === 'agent') {
        urlType = node.editorType === 'aiPrompt' ? 'aiPrompt' : 'agent';
    }
    const chromeAny = (window as any)?.chrome;
    const params = new URLSearchParams({
        alts_action: 'true',
        type: urlType,
        entityId: rawId,
        edit_mode: 'true',
    });
    const record = node.record || {};
    const editorPropsByType: Record<string, unknown> = {
        note: { props: { item: record, snippet: record, category: 'note', editMode: true } },
        link: { props: { item: record, snippet: record, category: 'link', editMode: true } },
        snippet: { props: { item: record, snippet: record, category: 'snippet', editMode: true } },
        todo: {
            props: {
                prefill: { ...record, todo_id: rawId, is_todo_type: true },
                item: { ...record, todo_id: rawId, is_todo_type: true },
                snippet: { ...record, todo_id: rawId, is_todo_type: true },
                editMode: true,
            },
        },
        session: { props: { item: record, snippet: record, session: record, category: 'session', editMode: true } },
        aiPrompt: { props: { item: record, snippet: record, category: 'aiPrompt', editMode: true } },
        agent: { props: { item: record, snippet: record, category: 'agent', editMode: true } },
        collection: { props: { item: record, collection: record, category: 'collection', editMode: true } },
    };
    try {
        const editorProps = editorPropsByType[urlType];
        if (editorProps) {
            params.set('editorProps', JSON.stringify(editorProps));
        }
    }
    catch {
        // The id/type route is still enough for Dexie-backed editors if a legacy record cannot serialize.
    }
    const pageUrl = `AltS_search_newtab/index.html?${params.toString()}`;
    if (chromeAny?.runtime?.getURL && chromeAny?.tabs?.create) {
        const fullUrl = chromeAny.runtime.getURL(pageUrl);
        chromeAny.tabs.create({ url: fullUrl, active: true });
    }
    else {
        window.open(window.location.origin + '/' + pageUrl, '_blank');
    }
};
const NodeIcon = ({ type, size = 16 }: {
    type: GraphNodeType;
    size?: number;
}) => {
    const className = 'shrink-0';
    if (type === 'note')
        return <NotesIcon size={size} className={className}/>;
    if (type === 'link')
        return <Link2 size={size} className={className}/>;
    if (type === 'snippet')
        return <TextExpanderIcon size={size} className={className}/>;
    if (type === 'todo')
        return <BsCalendarCheck size={size} className={className}/>;
    if (type === 'session')
        return <Link2 size={size} className={className}/>;
    if (type === 'collection')
        return <SessionGridIcon size={size} className={className}/>;
    return <LuSparkles size={size} className={className}/>;
};
const ClusterHubIcon = ({ cluster, tag }: {
    cluster: GraphCluster;
    tag?: TagRecord;
}) => {
    const className = 'h-5 w-5';
    if (cluster.collectionViewId)
        return <SessionGridIcon size={20} className={className}/>;
    if (tag && (!tag.workspaceId || tag.appearance)) return <TagAppearance tag={tag}/>;
    if (cluster.tagId || !cluster.nodeType)
        return <Tag className={className}/>;
    return <NodeIcon type={cluster.nodeType} size={20}/>;
};
interface KnowledgeGraphViewProps {
    explorerMode?: ExplorerMode;
    onExplorerModeChange?: (mode: ExplorerMode) => void;
    onClose?: () => void;
}
export const KnowledgeGraphView: React.FC<KnowledgeGraphViewProps> = ({ explorerMode = 'graph', onExplorerModeChange, onClose, }) => {
    const dbState = useDbStore();
    const dashboardState = useWidgetDashboardStore(state => state.state);
    const dashboardOrganisationId = useWidgetDashboardStore(state => state.organisationId);
    const isDashboardLoading = useWidgetDashboardStore(state => state.isLoading);
    const loadDashboard = useWidgetDashboardStore(state => state.load);
    const graphScrollRef = useRef<HTMLDivElement | null>(null);
    const panStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
    const [query, setQuery] = useState('');
    const [filterMode, setFilterMode] = useState<FilterMode>('type');
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
    const [selectedTypes, setSelectedTypes] = useState<GraphNodeType[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [isPanning, setIsPanning] = useState(false);
    const [zoom, setZoom] = useState(1);
    useEffect(() => {
        if (dashboardState || isDashboardLoading)
            return;
        void loadDashboard(dashboardOrganisationId || 'default', { activeViewOnly: false }).catch(error => {
            console.error('[KnowledgeGraphView] Failed to load dashboard collections', error);
        });
    }, [dashboardState, dashboardOrganisationId, isDashboardLoading, loadDashboard]);
    const allNodes = useMemo(() => buildNodes(dbState), [dbState]);
    const tagCounts = useMemo(() => {
        const counts = new Map<string, number>();
        allNodes.forEach(node => node.tagIds.forEach(tagId => counts.set(tagId, (counts.get(tagId) || 0) + 1)));
        return counts;
    }, [allNodes]);
    const tagClusters = useMemo(() => {
        const visibleTags = dbState.tags
            .filter(tag => (tagCounts.get(tag.id) || 0) > 0)
            .filter(tag => selectedTagIds.length === 0 || selectedTagIds.includes(tag.id))
            .sort((a, b) => (tagCounts.get(b.id) || 0) - (tagCounts.get(a.id) || 0));
        return visibleTags.map((tag, index) => ({
            id: `tag:${tag.id}`,
            label: `#${tag.name}`,
            count: tagCounts.get(tag.id) || 0,
            colorVar: getTagColorVar(tag.id),
            center: getTagClusterCenter(index, visibleTags.length),
            tagId: tag.id,
        }));
    }, [dbState.tags, selectedTagIds, tagCounts]);
    const dashboardViews = useMemo(() => getCollectionWidgetViews(dbState.widgetViews), [dbState.widgetViews]);
    const collectionNodes = useMemo(() => [] as GraphNode[], [dashboardViews]);
    const collectionNodeIdsByViewId = useMemo(() => {
        const validNodeIds = new Set(allNodes.map(node => node.id));
        const map = new Map<string, Set<string>>();
        dashboardViews.forEach(view => {
            const viewId = String(view.id || '').trim();
            if (!viewId)
                return;
            if (!map.has(viewId))
                map.set(viewId, new Set<string>());
            const scopedTagIds = new Set(dbState.tags.filter(tag => tag.workspaceId === viewId).map(tag => tag.id));
            allNodes.filter(node => node.id === 'session:' + viewId || node.tagIds.some(id => scopedTagIds.has(id)))
              .map(node => node.id).forEach(nodeId => {
                if (validNodeIds.has(nodeId))
                    map.get(viewId)!.add(nodeId);
            });
        });
        return map;
    }, [allNodes, dashboardViews, dbState.tags]);
    const collectionViewById = useMemo(() => {
        const map = new Map<string, WidgetDashboardView>();
        dashboardViews.forEach(view => {
            const viewId = String(view.id || '').trim();
            if (viewId)
                map.set(viewId, view);
        });
        return map;
    }, [dashboardViews]);
    const collectionViewIdByNodeId = useMemo(() => {
        const map = new Map<string, string>();
        collectionNodeIdsByViewId.forEach((nodeIds, viewId) => {
            nodeIds.forEach(nodeId => {
                if (!map.has(nodeId))
                    map.set(nodeId, viewId);
            });
        });
        return map;
    }, [collectionNodeIdsByViewId]);
    const graphNodes = useMemo(() => allNodes.map(node => {
        if (node.type !== 'session')
            return node;
        const matchedCollectionViewId = collectionViewIdByNodeId.get(node.id);
        const matchedCollectionView = matchedCollectionViewId
            ? collectionViewById.get(matchedCollectionViewId)
            : null;
        if (!matchedCollectionView?.id)
            return node;
        return {
            ...node,
            editorType: 'collection' as const,
            record: asGraphRecord(matchedCollectionView),
            collectionViewId: matchedCollectionView.id,
            bodyText: `${node.bodyText} ${normalizeText(matchedCollectionView.title)}`.trim(),
        };
    }), [allNodes, collectionViewById, collectionViewIdByNodeId]);
    const workspaceCounts = useMemo(() => {
        const counts = new Map<string, number>();
        collectionNodeIdsByViewId.forEach((nodeIds, viewId) => counts.set(viewId, nodeIds.size));
        return counts;
    }, [collectionNodeIdsByViewId]);
    const workspaceClusters = useMemo(() => {
        const visibleWorkspaces = dashboardViews
            .filter(workspace => workspace?.id && String(workspace.title || '').trim())
            .sort((a, b) => {
            const countDiff = (workspaceCounts.get(b.id) || 0) - (workspaceCounts.get(a.id) || 0);
            if (countDiff !== 0)
                return countDiff;
            return (a.createdAt || 0) - (b.createdAt || 0);
        });
        return visibleWorkspaces.map((workspace, index) => ({
            id: `workspace:${workspace.id}`,
            label: workspace.title,
            count: workspaceCounts.get(workspace.id) || 0,
            colorVar: getWorkspaceColorVar(workspace.id),
            center: getWorkspaceClusterCenter(index, visibleWorkspaces.length),
            collectionViewId: workspace.id,
        }));
    }, [dashboardViews, workspaceCounts]);
    const visibleNodes = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        const sourceNodes = filterMode === 'workspace' ? [...collectionNodes, ...graphNodes] : graphNodes;
        return sourceNodes.filter(node => {
            if (node.type !== 'collection' && ((filterMode === 'tag' && node.tagIds.length === 0) || !matchesSelectedTags(node, selectedTagIds)))
                return false;
            if (filterMode === 'workspace' &&
                node.type !== 'collection' &&
                !Array.from(collectionNodeIdsByViewId.values()).some(nodeIds => nodeIds.has(node.id)))
                return false;
            if (selectedTypes.length > 0 && !selectedTypes.includes(node.type))
                return false;
            if (normalizedQuery) {
                const haystack = `${node.title} ${node.bodyText} ${TYPE_LABELS.get(node.type) || ''}`.toLowerCase();
                if (!haystack.includes(normalizedQuery))
                    return false;
            }
            return true;
        });
    }, [collectionNodes, collectionNodeIdsByViewId, filterMode, graphNodes, query, selectedTagIds, selectedTypes]);
    const nodeIds = useMemo(() => new Set(visibleNodes.map(node => node.id)), [visibleNodes]);
    const edges = useMemo(() => buildEdges(visibleNodes).filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target)), [nodeIds, visibleNodes]);
    const focusedType = filterMode === 'type' && selectedTypes.length === 1 ? selectedTypes[0] : null;
    const positionedNodes = useMemo(() => {
        const nodes = visibleNodes.slice(0, 120);
        if (filterMode === 'tag')
            return getTagPositionedNodes(nodes, tagClusters);
        if (filterMode === 'workspace')
            return getWorkspacePositionedNodes(nodes, workspaceClusters, collectionNodeIdsByViewId);
        return getTypePositionedNodes(nodes, focusedType);
    }, [collectionNodeIdsByViewId, filterMode, focusedType, tagClusters, visibleNodes, workspaceClusters]);
    const graphClusters = useMemo(() => {
        if (filterMode === 'tag') {
            const positionedClusterIds = new Set(positionedNodes.map(node => node.clusterId));
            return tagClusters.filter(cluster => positionedClusterIds.has(cluster.id));
        }
        if (filterMode === 'workspace') {
            return workspaceClusters;
        }
        const activeTypes = NODE_TYPES.map(t => t.id).filter(type => positionedNodes.some(node => node.type === type));
        const typeIndexMap = new Map(activeTypes.map((type, idx) => [type, idx]));
        return NODE_TYPES.map(type => {
            const typeIdx = typeIndexMap.get(type.id) ?? 0;
            const center = focusedType === type.id ? FOCUSED_CLUSTER_CENTER : get2DClusterCenter(typeIdx, Math.max(1, activeTypes.length));
            return {
                id: `type:${type.id}`,
                label: type.label,
                count: positionedNodes.filter(node => node.type === type.id).length,
                colorVar: type.colorVar,
                center,
                nodeType: type.id,
            };
        }).filter(cluster => cluster.count > 0);
    }, [filterMode, focusedType, positionedNodes, tagClusters, workspaceClusters]);
    const positionedMap = useMemo(() => new Map(positionedNodes.map(node => [node.id, node])), [positionedNodes]);
    const selectedNode = selectedNodeId ? positionedMap.get(selectedNodeId) : null;
    const focusedNodeId = selectedNodeId || hoveredNodeId;
    const focusedConnectedNodeIds = useMemo(() => {
        if (!focusedNodeId)
            return null;
        const connected = new Set<string>([focusedNodeId]);
        edges.forEach(edge => {
            if (edge.source === focusedNodeId)
                connected.add(edge.target);
            if (edge.target === focusedNodeId)
                connected.add(edge.source);
        });
        return connected;
    }, [edges, focusedNodeId]);
    const renderedEdges = useMemo(() => {
        const positionedIds = new Set(positionedNodes.map(node => node.id));
        const drawableEdges = edges.filter(edge => positionedIds.has(edge.source) &&
            positionedIds.has(edge.target) &&
            canShowEdgeForMode(edge, filterMode, selectedTypes, query));
        if (focusedNodeId) {
            return drawableEdges
                .filter(edge => edge.source === focusedNodeId || edge.target === focusedNodeId)
                .sort((a, b) => b.strength - a.strength)
                .slice(0, 42);
        }
        return drawableEdges
            .filter(edge => edge.kind === 'reference' || edge.strength >= 3)
            .sort((a, b) => b.strength - a.strength)
            .slice(0, 44);
    }, [edges, filterMode, focusedNodeId, positionedNodes, query, selectedTypes]);
    const labeledNodeIds = useMemo(() => new Set(positionedNodes.map(node => node.id)), [positionedNodes]);
    const labelBoxes = useMemo(() => getResolvedLabelBoxes(positionedNodes), [positionedNodes]);
    const graphCanvasWidth = Math.max(GRAPH_VIEWBOX.width, Math.max(...graphClusters.map(cluster => cluster.center.x + 470), GRAPH_VIEWBOX.width));
    const graphCanvasHeight = GRAPH_VIEWBOX.height;
    const canvasWidth = graphCanvasWidth * zoom;
    const canvasHeight = graphCanvasHeight * zoom;
    const viewTypes: Array<{
        id: GraphNodeType | 'all' | 'workspace';
        label: string;
    }> = [
        { id: 'all', label: 'All' },
        ...NODE_TYPES.map(type => type.id === 'session' ? { id: 'workspace' as const, label: 'Workspaces' } : type)
    ];
    const clearFilters = () => {
        setQuery('');
        setFilterMode('type');
        setSelectedTagIds([]);
        setSelectedTypes([]);
        setSelectedNodeId(null);
        setHoveredNodeId(null);
        setZoom(1);
    };
    const toggleTag = (tagId: string) => {
        const nextTagIds = selectedTagIds.includes(tagId)
            ? selectedTagIds.filter(id => id !== tagId)
            : [...selectedTagIds, tagId];
        if (filterMode !== 'workspace')
            setFilterMode(nextTagIds.length > 0 ? 'tag' : 'type');
        setSelectedNodeId(null);
        setHoveredNodeId(null);
        setSelectedTagIds(nextTagIds);
    };
    const toggleType = (type: GraphNodeType) => {
        const isActiveOnlyType = filterMode === 'type' && selectedTypes.length === 1 && selectedTypes[0] === type;
        setFilterMode('type');
        setSelectedNodeId(null);
        setHoveredNodeId(null);
        setSelectedTypes(isActiveOnlyType ? [] : [type]);
    };
    const startCanvasPan = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.button !== 0)
            return;
        const target = event.target;
        if (target instanceof Element && target.closest('[data-graph-node="true"], button, input'))
            return;
        const container = graphScrollRef.current;
        if (!container)
            return;
        panStartRef.current = {
            x: event.clientX,
            y: event.clientY,
            scrollLeft: container.scrollLeft,
            scrollTop: container.scrollTop,
        };
        setIsPanning(true);
        event.preventDefault();
    };
    const moveCanvasPan = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!isPanning)
            return;
        const container = graphScrollRef.current;
        if (!container)
            return;
        container.scrollLeft = panStartRef.current.scrollLeft - (event.clientX - panStartRef.current.x);
        container.scrollTop = panStartRef.current.scrollTop - (event.clientY - panStartRef.current.y);
    };
    const stopCanvasPan = () => {
        setIsPanning(false);
    };
    return (<div className="relative h-full w-full min-h-0 flex overflow-hidden rounded-none border border-[var(--color-borderDefault)] bg-[var(--color-panelBg)] font-sans text-[13px] text-[var(--color-textPrimary)] antialiased backdrop-blur-xl">
      <aside className="w-64 shrink-0 border-r border-[var(--color-borderDefault)] bg-[var(--color-sidebarBg)] p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
        {onExplorerModeChange && <ExplorerModeSwitcher mode={explorerMode} onModeChange={onExplorerModeChange}/>}

        <section>
          <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-textMuted)] opacity-70">Type</h3>
          <div className="flex flex-col gap-1" role="listbox" aria-label="Knowledge graph type">
            {viewTypes.map(type => {
            const active = type.id === 'workspace'
                ? filterMode === 'workspace'
                : type.id === 'all'
                    ? filterMode !== 'workspace' && selectedTypes.length === 0
                    : filterMode !== 'workspace' && selectedTypes.includes(type.id);
            return (<button key={type.id} type="button" role="option" aria-selected={active} onClick={() => {
                    if (type.id === 'all') {
                        setFilterMode('type');
                        setSelectedTypes([]);
                        setSelectedNodeId(null);
                        setHoveredNodeId(null);
                    }
                    else if (type.id === 'workspace') {
                        setFilterMode('workspace');
                        setSelectedTypes([]);
                        setSelectedNodeId(null);
                        setHoveredNodeId(null);
                    }
                    else {
                        toggleType(type.id);
                    }
                }} className={`flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] ${active
                    ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)]'
                    : 'text-[var(--color-textSecondary)] hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]'}`}>
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[var(--color-iconDefault)]">
                    {type.id === 'all' ? <Search className="h-3 w-3"/> : type.id === 'workspace' ? <SessionGridIcon className="h-3 w-3"/> : <NodeIcon type={type.id} size={14}/>}
                  </span>
                  <span className="truncate">{type.label}</span>
                </button>);
        })}
          </div>
        </section>

        <section className="min-h-0">
          <div className="mb-1.5 flex items-center justify-between">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-textMuted)] opacity-70">Tags</h3>
            {selectedTagIds.length > 0 && (<button type="button" onClick={() => {
                setSelectedTagIds([]);
                if (filterMode === 'tag')
                    setFilterMode('type');
            }} className="text-[11px] font-medium text-[var(--color-accent)] hover:text-[var(--color-accentHover)] transition-opacity">
                Clear
              </button>)}
          </div>
          <div className="flex flex-col gap-1" aria-label="Knowledge graph tags">
            {[...dbState.tags]
            .sort((a, b) => (tagCounts.get(b.id) || 0) - (tagCounts.get(a.id) || 0))
            .map(tag => {
            const active = selectedTagIds.includes(tag.id);
            return (<button key={tag.id} type="button" aria-pressed={active} onClick={() => toggleTag(tag.id)} className={`flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] ${active
                    ? 'bg-[var(--color-selectedBg)] text-[var(--color-textPrimary)]'
                    : 'text-[var(--color-textSecondary)] opacity-80 hover:opacity-100 hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)]'}`}>
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[var(--color-iconDefault)]">
                      {tag.workspaceId && !tag.appearance ? <Tag className="h-3 w-3"/> : <TagAppearance tag={tag}/>}
                    </span>
                    <span className="truncate">#{tag.name}</span>
                  </button>);
        })}
          </div>
        </section>
      </aside>

      <main className="min-w-0 flex-1 relative flex flex-col h-full overflow-hidden" style={EXPLORER_MAIN_CONTENT_STYLE}>
        <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--color-borderDefault)] px-7 pr-3">
          <div className="relative flex w-full max-w-[420px] items-center">
            <Search className="pointer-events-none absolute left-3 h-4 w-4 shrink-0 text-[var(--color-iconDefault)]"/>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search graph..." className="h-9 w-full rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] pl-9 pr-3 text-xs text-[var(--color-textPrimary)] placeholder:text-[var(--color-textMuted)] outline-none transition-all hover:border-[var(--color-borderActive)] focus:ring-2 focus:ring-[var(--color-focusRing)]"/>
          </div>
          <button type="button" aria-label="Close knowledge graph" title="Close knowledge graph" onClick={() => (onClose ? onClose() : useUIStore.getState().setView({ type: 'home' }))} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-0 bg-transparent text-[var(--color-iconDefault)] transition-colors hover:bg-[var(--color-hoverBg)] hover:text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)]">
            <X className="h-3.5 w-3.5"/>
          </button>
        </div>

        {/* Floating Zoom & Reset Toolbar (Bottom-Right) */}
        <div className="absolute right-4 bottom-4 z-40 flex items-center gap-1.5 rounded-full border border-[var(--color-borderDefault)]/70 bg-[var(--color-rootBg)]/80 backdrop-blur-md px-3 py-1 text-xs text-[var(--color-textPrimary)] shadow-sm">
          <button type="button" onClick={() => setZoom(prev => Math.max(0.5, Number((prev - 0.1).toFixed(1))))} aria-label="Zoom out" title="Zoom out" className="flex h-5 w-5 items-center justify-center text-[var(--color-textSecondary)] transition-all hover:text-[var(--color-textPrimary)] active:scale-95 text-sm font-medium">
            -
          </button>
          <span className="min-w-[36px] text-center text-[11px] font-semibold text-[var(--color-textPrimary)] select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button type="button" onClick={() => setZoom(prev => Math.min(1.3, Number((prev + 0.1).toFixed(1))))} aria-label="Zoom in" title="Zoom in" className="flex h-5 w-5 items-center justify-center text-[var(--color-textSecondary)] transition-all hover:text-[var(--color-textPrimary)] active:scale-95 text-sm font-medium">
            +
          </button>
          <button type="button" onClick={clearFilters} title="Reset graph view" aria-label="Reset graph view" className="ml-1 flex h-5 w-5 items-center justify-center text-[var(--color-textSecondary)] transition-all hover:text-[var(--color-textPrimary)] active:scale-95">
            <RotateCcw className="h-3.5 w-3.5"/>
          </button>
        </div>

        <div ref={graphScrollRef} role="presentation" onMouseDown={startCanvasPan} onMouseMove={moveCanvasPan} onMouseUp={stopCanvasPan} onMouseLeave={stopCanvasPan} className={`relative min-h-0 flex-1 overflow-auto bg-transparent clean-scrollbar ${isPanning ? 'cursor-grabbing select-none' : 'cursor-grab'}`}>
          <svg className="block" style={{
            width: canvasWidth,
            height: canvasHeight,
            minWidth: '100%',
            minHeight: '100%',
        }} viewBox={`0 0 ${graphCanvasWidth} ${graphCanvasHeight}`} role="img" aria-label="Knowledge graph">
            <defs>
              <filter id="knowledgeGraphGlow" x="-90%" y="-90%" width="280%" height="280%">
                <feGaussianBlur stdDeviation="4" result="softGlowBlur"/>
                <feComponentTransfer in="softGlowBlur" result="softGlow">
                  <feFuncA type="linear" slope={GRAPH_GLOW_INTENSITY}/>
                </feComponentTransfer>
                <feGaussianBlur stdDeviation="9" result="wideGlowBlur"/>
                <feComponentTransfer in="wideGlowBlur" result="wideGlow">
                  <feFuncA type="linear" slope={GRAPH_GLOW_INTENSITY}/>
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode in="wideGlow"/>
                  <feMergeNode in="softGlow"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
              <filter id="knowledgeGraphLineGlow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="2.4" result="lineGlowBlur"/>
                <feComponentTransfer in="lineGlowBlur" result="lineGlow">
                  <feFuncA type="linear" slope={GRAPH_GLOW_INTENSITY}/>
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode in="lineGlow"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <g>
              {graphClusters.map(cluster => {
            const center = cluster.center;
            return (<g key={`cluster-${cluster.id}`} className="pointer-events-none">
                    <circle cx={center.x} cy={center.y} r="24" fill={`var(${cluster.colorVar})`} opacity={0.18 * GRAPH_GLOW_INTENSITY}/>
                    <circle cx={center.x} cy={center.y} r="13" fill="var(--color-rootBg)" stroke={`var(${cluster.colorVar})`} strokeWidth="2.2"/>
                    <text x={center.x} y={center.y + 43} textAnchor="middle" className="select-none fill-[var(--color-textPrimary)] text-[14px] font-semibold">
                      {cluster.label}
                    </text>
                    <text x={center.x} y={center.y + 59} textAnchor="middle" className="select-none fill-[var(--color-textMuted)] text-[9px] font-medium">
                      {cluster.count}
                    </text>
                  </g>);
        })}
              {graphClusters.map(cluster => {
            const groupNodes = positionedNodes.filter(node => node.clusterId === cluster.id);
            const center = cluster.center;
            return (<g key={`spokes-${cluster.id}`} className="pointer-events-none">
                    {groupNodes.map(node => {
                    const dimmed = Boolean(focusedConnectedNodeIds && !focusedConnectedNodeIds.has(node.id));
                    return (<line key={`spoke-${node.id}`} x1={center.x} y1={center.y} x2={node.x} y2={node.y} stroke={`var(${cluster.colorVar})`} strokeWidth={focusedNodeId === node.id ? 1.7 : 1.1} opacity={dimmed ? 0.08 : focusedNodeId === node.id ? 0.62 : 0.34} strokeLinecap="round"/>);
                })}
                  </g>);
        })}
              {renderedEdges.map(edge => {
            const source = positionedMap.get(edge.source);
            const target = positionedMap.get(edge.target);
            if (!source || !target)
                return null;
            const focusedEdge = focusedNodeId && (edge.source === focusedNodeId || edge.target === focusedNodeId);
            return (<line key={edge.id} x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke="var(--color-borderActive)" strokeWidth={focusedEdge ? Math.max(1.2, edge.strength * 0.7) : Math.max(0.55, edge.strength * 0.34)} opacity={focusedEdge ? 0.72 : 0.22}/>);
        })}
              {positionedNodes.map(node => {
            const color = filterMode === 'tag' || filterMode === 'workspace'
                ? `var(${node.clusterColorVar})`
                : TYPE_COLORS.get(node.type) || 'var(--color-accent)';
            const selected = selectedNodeId === node.id;
            const focused = focusedNodeId === node.id;
            const hovered = hoveredNodeId === node.id;
            const dimmed = Boolean(focusedConnectedNodeIds && !focusedConnectedNodeIds.has(node.id));
            const showLabel = labeledNodeIds.has(node.id);
            const showNodeTypeIcon = filterMode === 'tag' || filterMode === 'workspace';
            const labelBox = labelBoxes.get(node.id) || getLabelBox(node);
            const labelTextX = showNodeTypeIcon
                ? labelBox.anchor === 'end'
                    ? labelBox.textX
                    : labelBox.textX + 20
                : labelBox.textX;
            const labelIconX = labelBox.anchor === 'end'
                ? labelBox.textX - labelBox.width - (showNodeTypeIcon ? 8 : 0)
                : labelBox.textX;
            return (<g key={node.id} data-graph-node="true" role="button" tabIndex={0} onClick={() => openNode(node)} onMouseEnter={() => setHoveredNodeId(node.id)} onMouseLeave={() => setHoveredNodeId(current => (current === node.id ? null : current))} onKeyDown={event => {
                    if (event.key === 'Enter')
                        openNode(node);
                }} className="cursor-pointer outline-none">
                    <circle cx={node.x} cy={node.y} r={selected || focused ? 22 : 16} fill={color} opacity={(dimmed ? 0.02 : selected || focused ? 0.14 : 0.055) * GRAPH_GLOW_INTENSITY} filter={hovered ? 'url(#knowledgeGraphGlow)' : undefined}/>
                    <circle cx={node.x} cy={node.y} r={selected || focused ? 15 : 9} fill={color} opacity={(dimmed ? 0.05 : selected || focused ? 0.24 : 0.1) * GRAPH_GLOW_INTENSITY} filter={hovered ? 'url(#knowledgeGraphGlow)' : undefined}/>
                    <circle cx={node.x} cy={node.y} r={selected || focused ? 7.5 : 5.5} fill={color} opacity={dimmed ? 0.42 : 1} filter={hovered ? 'url(#knowledgeGraphGlow)' : undefined}/>
                    {showLabel && (<>
                        {showNodeTypeIcon && (<foreignObject x={labelIconX - 1} y={labelBox.textY - 13} width="16" height="16" className="pointer-events-none">
                            <div className="flex h-full w-full items-center justify-center text-[var(--color-iconDefault)]">
                              <NodeIcon type={node.type} size={12}/>
                            </div>
                          </foreignObject>)}
                        <text x={labelTextX} y={labelBox.textY} textAnchor={labelBox.anchor} className="pointer-events-none select-none fill-[var(--color-rootBg)] text-[10px] font-medium" stroke="var(--color-rootBg)" strokeWidth="4" opacity={dimmed ? 0.34 : 0.82}>
                          {labelBox.label}
                        </text>
                        <text x={labelTextX} y={labelBox.textY} textAnchor={labelBox.anchor} className="pointer-events-none select-none fill-[var(--color-textPrimary)] text-[10px] font-medium" opacity={dimmed ? 0.45 : 1}>
                          {labelBox.label}
                        </text>
                      </>)}
                  </g>);
        })}
              {graphClusters.map(cluster => {
            const center = cluster.center;
            const clusterCollectionNode = filterMode === 'workspace' && cluster.collectionViewId
                ? collectionNodes.find(node => node.collectionViewId === cluster.collectionViewId)
                : null;
            return (<g key={`hub-icon-${cluster.id}`} data-graph-node={clusterCollectionNode ? 'true' : undefined} role={clusterCollectionNode ? 'button' : undefined} tabIndex={clusterCollectionNode ? 0 : undefined} onClick={clusterCollectionNode ? () => openNode(clusterCollectionNode) : undefined} onKeyDown={clusterCollectionNode
                    ? event => {
                        if (event.key === 'Enter')
                            openNode(clusterCollectionNode);
                    }
                    : undefined} className={clusterCollectionNode ? 'cursor-pointer outline-none' : 'pointer-events-none'}>
                    <circle cx={center.x} cy={center.y} r="45" fill={`var(${cluster.colorVar})`} opacity={0.13 * GRAPH_GLOW_INTENSITY} filter="url(#knowledgeGraphGlow)"/>
                    <circle cx={center.x} cy={center.y} r="31" fill={`var(${cluster.colorVar})`} opacity={0.18 * GRAPH_GLOW_INTENSITY} filter="url(#knowledgeGraphGlow)"/>
                    <circle cx={center.x} cy={center.y} r="20" fill="var(--color-rootBg)" stroke={`var(${cluster.colorVar})`} strokeWidth="2.4" filter="url(#knowledgeGraphGlow)"/>
                    <foreignObject x={center.x - 12} y={center.y - 12} width="24" height="24">
                      <div className="flex h-full w-full items-center justify-center" style={{ color: `var(${cluster.colorVar})` }}>
                        <ClusterHubIcon cluster={cluster} tag={dbState.tags.find(tag => tag.id === cluster.tagId)}/>
                      </div>
                    </foreignObject>
                  </g>);
        })}
            </g>
          </svg>

          {positionedNodes.length === 0 && (<div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-lg border border-[var(--color-borderDefault)] bg-[var(--color-cardBg)] px-5 py-4 text-center">
                <div className="text-sm font-semibold">No matching nodes</div>
                <div className="mt-1 text-xs text-[var(--color-textMuted)]">Try clearing search or filters.</div>
              </div>
            </div>)}
        </div>
      </main>
    </div>);
};
export default KnowledgeGraphView;
