import type { ElementSnapshotDraft } from '../../../allObjectFolder/src/createObject/collections/elementSnapshotTypes';
import { validateElementSnapshotDraft } from '../../../allObjectFolder/src/createObject/collections/elementSnapshotValidation';
import { resolveAvailableWebScrapingImages } from './resolveWebScrapingImages';
import type { ExtractedWebScraping } from './webScrapingExtractionTypes';

/** Prune failed images in both representations before strict atomic persistence. */
export function resolveAvailableElementClip(draft: ExtractedWebScraping, input: ElementSnapshotDraft, available: ReadonlySet<string>): { draft: ExtractedWebScraping; snapshot: ElementSnapshotDraft } | null {
  const semantic = resolveAvailableWebScrapingImages(draft, new Map([...available].map(id => [id, id])));
  if (!semantic) return null;
  const snapshot = structuredClone(validateElementSnapshotDraft(input));
  const nodes = snapshot.nodes.filter(node => node.type !== 'element' || node.tag !== 'img' || available.has(node.resourceId!));
  const ids = new Set(nodes.map(node => node.id));
  if (!ids.has(snapshot.root.nodeId)) return null;
  const usedResources = new Set<string>(), usedStyles = new Set<string>();
  for (const node of nodes) {
    if (node.type !== 'element') continue;
    node.children = node.children.filter(id => ids.has(id));
    if (node.styleId) usedStyles.add(node.styleId);
    for (const pseudo of node.pseudos || []) if (pseudo.styleId) usedStyles.add(pseudo.styleId);
    if (node.resourceId) usedResources.add(node.resourceId);
    const layers = node.backgroundLayers || node.backgroundResourceIds?.map(resourceId => ({ type: 'image' as const, resourceId }));
    if (layers) {
      delete node.backgroundResourceIds;
      node.backgroundLayers = layers.map(layer => {
        if (layer.type !== 'image') return layer;
        if (!available.has(layer.resourceId)) return { type: 'none' as const };
        usedResources.add(layer.resourceId); return layer;
      });
    }
  }
  snapshot.nodes = nodes;
  snapshot.styles = snapshot.styles.filter(style => usedStyles.has(style.id));
  snapshot.resources = snapshot.resources.filter(resource => usedResources.has(resource.id));
  validateElementSnapshotDraft(snapshot);
  const semanticIds = new Set(semantic.images.map(image => image.id));
  return { draft: { ...draft, blocks: semantic.blocks, images: draft.images.filter(image => semanticIds.has(image.id)) }, snapshot };
}
