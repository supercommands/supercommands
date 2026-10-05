/**
 * @file tagTreeUtils.ts
 * @description Pure utility module for constructing a Notion-style multi-tag hierarchy tree
 * with clamped indentation depths and ancestor dashed guide line tracking.
 */
export interface TagTreeNode<T> {
    /** Unique node identifier (e.g. tag path or item id) */
    id: string;
    /** Whether this node represents a Tag folder/branch or an actual Item */
    type: 'tag' | 'section' | 'item';
    /** Display label (tag name or item title) */
    name: string;
    /** Tag color hex code */
    color?: string;
    /** Raw depth level (0-indexed) */
    depth: number;
    /** Clamped indentation in pixels (capped to prevent overflow) */
    clampedIndentPx: number;
    /** The actual underlying item if type === 'item' */
    item?: T;
    /** Direct children nodes */
    children: TagTreeNode<T>[];
    /** Whether this is the last child in its parent's children array (for └── vs ├──) */
    isLastChild: boolean;
    /**
     * Tracks whether ancestor levels at index [0..depth-1] have subsequent sibling nodes.
     * Used to determine which vertical dashed lines (│) should be rendered down the left track.
     */
    ancestorHasMore: boolean[];
    /** Array of tag names leading from root down to this tag node */
    tagPathNames?: string[];
    /** Array of resolved tag IDs leading from root down to this tag node */
    tagPathIds?: string[];
    /** Total count of items contained inside this tag and its sub-tags */
    itemCount: number;
}
export interface BuildTagTreeOptions<T> {
    items: T[];
    getItemTagIds?: (item: T) => string[];
    isItemFavorite?: (item: T) => boolean;
    tagNamesMap?: Record<string, string>;
    getTagColor?: (tagName: string) => string;
    /** Pixel indentation step per depth level. Default: 14 */
    indentStepPx?: number;
    /** Maximum pixel indentation to prevent text squishing. Default: 48 */
    maxIndentPx?: number;
    /** Separator used when merging single-child tag paths. Default: ', ' */
    pathSeparator?: string;
}
export const LAYER_DOT_COLORS = [
    '#3b82f6', // Layer 1 (Depth 0 - root tags): Blue
    '#a855f7', // Layer 2 (Depth 1 - sub-tags): Purple / Violet
    '#06b6d4', // Layer 3 (Depth 2 - sub-sub-tags): Cyan / Teal
    '#10b981', // Layer 4 (Depth 3): Emerald / Green
    '#f59e0b', // Layer 5 (Depth 4): Amber / Orange
    '#ec4899'
];
export function getLayerColor(depth: number): string {
    const safeDepth = Math.max(0, depth);
    return LAYER_DOT_COLORS[safeDepth % LAYER_DOT_COLORS.length];
}
/**
 * Calculates clamped indentation for a given depth level.
 */
export function getClampedIndent(depth: number, step = 14, max = 48): number {
    return Math.min(depth * step, max);
}
/**
 * Transforms a flat list of items into a Notion-style multi-tag tree hierarchy.
 * When an item has multiple tags [Tag1, Tag2, Tag3], it is nested:
 * Tag1 -> Tag2 -> Tag3 -> Item.
 *
 * Items with no tags are grouped under an 'Untagged' root node.
 */
export function buildTagHierarchyTree<T extends {
    id: string;
}>(options: BuildTagTreeOptions<T>): TagTreeNode<T>[] {
    const { items, getItemTagIds, isItemFavorite, tagNamesMap = {}, getTagColor = () => '#3b82f6', indentStepPx = 14, maxIndentPx = 48, pathSeparator = ', ', } = options;
    interface InternalTagNode {
        id: string;
        name: string;
        color: string;
        tagPathNames: string[];
        tagPathIds: string[];
        subTags: Map<string, InternalTagNode>;
        items: T[];
    }
    const rootTags = new Map<string, InternalTagNode>();
    const favoriteUntaggedItems: T[] = [];
    const otherUntaggedItems: T[] = [];
    const addUntaggedItem = (item: T) => {
        if (isItemFavorite?.(item)) {
            favoriteUntaggedItems.push(item);
            return;
        }
        otherUntaggedItems.push(item);
    };
    const sortItemsByFavorite = (sourceItems: T[]): T[] => {
        if (!isItemFavorite)
            return sourceItems;
        return [...sourceItems].sort((a, b) => {
            const aFavorite = isItemFavorite(a);
            const bFavorite = isItemFavorite(b);
            if (aFavorite === bFavorite)
                return 0;
            return aFavorite ? -1 : 1;
        });
    };
    // 1. Group items into multi-tag paths
    for (const item of items) {
        const rawTagIds = getItemTagIds ? getItemTagIds(item) : ((item as any).tagIds || []);
        const tagIds = Array.isArray(rawTagIds) ? rawTagIds.filter(Boolean) : [];
        if (tagIds.length === 0) {
            addUntaggedItem(item);
            continue;
        }
        // Resolve tag names
        const resolvedTagNames = tagIds
            .map(tid => {
            const name = tagNamesMap[tid] || tid;
            return { id: tid, name: String(name).trim() };
        })
            .filter(t => t.name.length > 0);
        if (resolvedTagNames.length === 0) {
            addUntaggedItem(item);
            continue;
        }
        // Traverse or create the path in the tree
        let currentMap = rootTags;
        let currentPath = '';
        const runningPathNames: string[] = [];
        const runningPathIds: string[] = [];
        resolvedTagNames.forEach((tagObj, idx) => {
            currentPath = currentPath ? `${currentPath}/${tagObj.name.toLowerCase()}` : tagObj.name.toLowerCase();
            runningPathNames.push(tagObj.name);
            runningPathIds.push(tagObj.id);
            if (!currentMap.has(tagObj.name.toLowerCase())) {
                currentMap.set(tagObj.name.toLowerCase(), {
                    id: `tag_${currentPath}`,
                    name: tagObj.name,
                    color: getTagColor(tagObj.name),
                    tagPathNames: [...runningPathNames],
                    tagPathIds: [...runningPathIds],
                    subTags: new Map(),
                    items: [],
                });
            }
            const node = currentMap.get(tagObj.name.toLowerCase())!;
            // If this is the deepest tag in this item's tag list, attach the item here
            if (idx === resolvedTagNames.length - 1) {
                node.items.push(item);
            }
            currentMap = node.subTags;
        });
    }
    // 1b. Helper to recursively compress single-child tag chains (A / B) with no direct items
    function compressInternalTagNode(node: InternalTagNode): InternalTagNode {
        // Compress all sub-tags recursively first
        const compressedSubTags = new Map<string, InternalTagNode>();
        for (const [key, subTag] of node.subTags.entries()) {
            compressedSubTags.set(key, compressInternalTagNode(subTag));
        }
        node.subTags = compressedSubTags;
        // If this node has 0 direct items and EXACTLY 1 sub-tag child, merge with that child
        if (node.items.length === 0 && node.subTags.size === 1) {
            const childNode = Array.from(node.subTags.values())[0];
            return {
                id: childNode.id,
                name: `${node.name}${pathSeparator}${childNode.name}`,
                color: node.color,
                tagPathNames: childNode.tagPathNames,
                tagPathIds: childNode.tagPathIds,
                subTags: childNode.subTags,
                items: childNode.items,
            };
        }
        return node;
    }
    // Apply path compression across root tags
    const compressedRootTags = new Map<string, InternalTagNode>();
    for (const [key, root] of rootTags.entries()) {
        const compressed = compressInternalTagNode(root);
        compressedRootTags.set(compressed.name.toLowerCase(), compressed);
    }
    // 2. Recursive helper to convert InternalTagNode to TagTreeNode
    function convertTagNode(internal: InternalTagNode, depth: number, isLast: boolean, ancestorHasMore: boolean[]): TagTreeNode<T> {
        const sortedSubTags = Array.from(internal.subTags.values()).sort((a, b) => a.name.localeCompare(b.name));
        const children: TagTreeNode<T>[] = [];
        const currentAncestorHasMore = [...ancestorHasMore, !isLast];
        const sortedItems = sortItemsByFavorite(internal.items);
        const totalChildrenCount = sortedSubTags.length + sortedItems.length;
        let childIndex = 0;
        // Add sub-tags first
        sortedSubTags.forEach(subTag => {
            const childIsLast = childIndex === totalChildrenCount - 1;
            children.push(convertTagNode(subTag, depth + 1, childIsLast, currentAncestorHasMore));
            childIndex++;
        });
        // Add items belonging directly to this tag
        sortedItems.forEach(item => {
            const childIsLast = childIndex === totalChildrenCount - 1;
            children.push({
                id: `item_${internal.id}_${item.id}`,
                type: 'item',
                name: (item as any).title || (item as any).name || 'Untitled',
                depth: depth + 1,
                clampedIndentPx: getClampedIndent(depth + 1, indentStepPx, maxIndentPx),
                item,
                children: [],
                isLastChild: childIsLast,
                ancestorHasMore: currentAncestorHasMore,
                itemCount: 1,
            });
            childIndex++;
        });
        const totalDescendantItems = internal.items.length +
            children.filter(c => c.type === 'tag').reduce((acc, c) => acc + c.itemCount, 0);
        return {
            id: internal.id,
            type: 'tag',
            name: internal.name,
            color: getLayerColor(depth),
            depth,
            clampedIndentPx: getClampedIndent(depth, indentStepPx, maxIndentPx),
            children,
            isLastChild: isLast,
            ancestorHasMore,
            tagPathNames: internal.tagPathNames,
            tagPathIds: internal.tagPathIds,
            itemCount: totalDescendantItems,
        };
    }
    // 3. Assemble top-level tree
    const result: TagTreeNode<T>[] = [];
    const sortedRoots = Array.from(compressedRootTags.values()).sort((a, b) => a.name.localeCompare(b.name));
    const untaggedItems = [...favoriteUntaggedItems, ...otherUntaggedItems];
    const totalRoots = sortedRoots.length + untaggedItems.length;
    sortedRoots.forEach((root, idx) => {
        const isLast = idx === totalRoots - 1;
        result.push(convertTagNode(root, 0, isLast, []));
    });
    if (untaggedItems.length > 0) {
        untaggedItems.forEach((item, idx) => {
            result.push({
                id: `item_root_${item.id}`,
                type: 'item',
                name: (item as any).title || (item as any).name || 'Untitled',
                depth: 0,
                clampedIndentPx: 0,
                item,
                children: [],
                isLastChild: idx === untaggedItems.length - 1,
                ancestorHasMore: [],
                itemCount: 1,
            });
        });
    }
    return result;
}
