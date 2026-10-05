import type { ElementSnapshotRecord, ElementSnapshotStyle } from '../../../allObjectFolder/src/createObject/collections/elementSnapshotTypes';
import { validateElementSnapshotRecord } from '../../../allObjectFolder/src/createObject/collections/elementSnapshotValidation';
import { ELEMENT_CLIP_RUNTIME_LIMITS } from '../../../allObjectFolder/src/createObject/collections/elementSnapshotLimits';

export const ELEMENT_SNAPSHOT_CSP = "default-src 'none'; script-src 'none'; img-src data:; font-src 'none'; style-src 'unsafe-inline'; connect-src 'none'; frame-src 'none'; object-src 'none'; media-src 'none'; form-action 'none'; base-uri 'none'";
const html = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const cssText = (value: string) => value.replace(/[\\"<>&\x00-\x1f\x7f]/g, char => `\\${char.codePointAt(0)!.toString(16)} `);
const declarations = (values?: ElementSnapshotStyle) => Object.entries(values || {}).map(([key, value]) => `${key.replace(/[A-Z]/g, char => '-' + char.toLowerCase())}:${value}`).join(';');
/** Only validated local image bytes are renderable. Source URLs never reach this document. */
export function buildElementSnapshotDocument(input: ElementSnapshotRecord, imageData: ReadonlyMap<string, string>): string {
  const snapshot = validateElementSnapshotRecord(input);
  const variables = new Map<string, string>(), rules: string[] = [];
  let characters = 0;
  const charge = (text: string) => { characters += text.length; if (characters > ELEMENT_CLIP_RUNTIME_LIMITS.documentCharacters) throw new Error('Saved appearance exceeds the display size limit.'); return text; };
  const backgrounds = new Set(snapshot.nodes.flatMap(node => node.type === 'element'
    ? [...(node.backgroundResourceIds || []), ...(node.backgroundLayers || []).flatMap(layer => layer.type === 'image' ? [layer.resourceId] : [])] : []));
  snapshot.resources.forEach((resource, index) => {
    const data = imageData.get(resource.id);
    if (!data || !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(data)) throw new Error('Saved image bytes are unavailable.');
    const variable = `--element-resource-${index}`; variables.set(resource.id, variable);
    // Background placements share one value; IMG uses native src/object-fit/baseline semantics.
    if (backgrounds.has(resource.id)) rules.push(charge(`:root{${variable}:url("${data}")}`));
  });
  const nodes = new Map(snapshot.nodes.map(node => [node.id, node]));
  const styles = new Map(snapshot.styles.map(style => [style.id, style.values]));
  const render = (id: string): string => {
    const node = nodes.get(id)!;
    if (node.type === 'text') return charge(html(node.text));
    const tag = node.tag === 'details' || node.tag === 'summary' ? 'div' : node.tag;
    let style = declarations(node.styleId ? styles.get(node.styleId) : undefined);
    const layers = node.backgroundLayers || node.backgroundResourceIds?.map(resourceId => ({ type: 'image' as const, resourceId }));
    if (layers) style += ';background-image:' + layers.map(layer => layer.type === 'image' ? `var(${variables.get(layer.resourceId)!})` : layer.type === 'gradient' ? layer.value : 'none').join(',');
    const attrs = Object.entries(node.attributes).filter(([name]) => name !== 'open' || tag === 'details').map(([name, value]) => ` ${name}="${html(value)}"`).join('');
    const image = node.resourceId === undefined ? '' : ` src="${imageData.get(node.resourceId)!}"`;
    for (const pseudo of node.pseudos || []) rules.push(charge(`[data-element-node="${node.id}"]::${pseudo.kind}{${declarations(pseudo.styleId ? styles.get(pseudo.styleId) : undefined)};content:"${cssText(pseudo.text)}"}`));
    const start = charge(`<${tag} data-element-node="${node.id}"${attrs}${image} style="${html(style)}">`);
    return ['img', 'br', 'hr'].includes(tag) ? start : start + node.children.map(render).join('') + charge(`</${tag}>`);
  };
  const body = render(snapshot.root.nodeId);
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${html(ELEMENT_SNAPSHOT_CSP)}"><meta name="referrer" content="no-referrer"><style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden}*{animation:none!important;transition:none!important;caret-color:transparent!important}${rules.join('')}</style></head><body>${body}</body></html>`;
}
