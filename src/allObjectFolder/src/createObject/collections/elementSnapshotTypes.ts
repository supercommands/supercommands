/** Inert capture data. The renderer must rebuild allowlisted nodes, never execute source HTML/CSS. */
export { ELEMENT_SNAPSHOT_LIMITS, ELEMENT_CLIP_RUNTIME_LIMITS } from './elementSnapshotLimits';

export const ELEMENT_SNAPSHOT_STYLE_KEYS = [
  'color', 'backgroundColor', 'colorScheme', 'fontFamily', 'fontSize', 'fontStyle', 'fontWeight', 'fontStretch',
  'fontFeatureSettings', 'fontVariationSettings', 'fontKerning', 'fontOpticalSizing', 'fontSynthesis',
  'fontVariantLigatures', 'fontVariantCaps', 'fontVariantNumeric', 'fontVariantEastAsian',
  'lineHeight', 'letterSpacing', 'wordSpacing', 'textTransform', 'textIndent', 'textAlign',
  'textDecorationLine', 'textDecorationColor', 'textDecorationStyle', 'textDecorationThickness', 'textShadow',
  'whiteSpace', 'wordBreak', 'overflowWrap', 'writingMode', 'direction', 'verticalAlign',
  'display', 'boxSizing', 'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
  'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
  'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius',
  'position', 'top', 'right', 'bottom', 'left', 'zIndex', 'float', 'clear', 'overflowX', 'overflowY',
  'flexDirection', 'flexWrap', 'flexGrow', 'flexShrink', 'flexBasis', 'order',
  'alignItems', 'alignSelf', 'alignContent', 'justifyContent', 'justifyItems', 'justifySelf', 'rowGap', 'columnGap',
  'gridTemplateColumns', 'gridTemplateRows', 'gridAutoColumns', 'gridAutoRows', 'gridAutoFlow',
  'gridColumnStart', 'gridColumnEnd', 'gridRowStart', 'gridRowEnd',
  'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'backgroundClip', 'backgroundOrigin',
  'boxShadow', 'opacity', 'outlineWidth', 'outlineStyle', 'outlineColor',
  'transform', 'transformOrigin', 'perspective', 'objectFit', 'objectPosition', 'aspectRatio',
  'listStyleType', 'listStylePosition',
  'filter', 'backdropFilter', 'clipPath', 'borderCollapse', 'borderSpacing',
] as const;
export const ELEMENT_SNAPSHOT_TAGS = 'div span p h1 h2 h3 h4 h5 h6 article section main header footer aside nav figure figcaption address blockquote pre code strong b em i u s small sub sup br hr ul ol li dl dt dd table caption thead tbody tfoot tr th td img details summary'.split(' ');
export const ELEMENT_SNAPSHOT_ATTRIBUTES = 'alt title role aria-label aria-hidden aria-level aria-roledescription aria-checked lang dir colspan rowspan start reversed open'.split(' ');
export type ElementSnapshotStyle = Partial<Record<typeof ELEMENT_SNAPSHOT_STYLE_KEYS[number], string>>;
export type ElementSnapshotBackground = { type: 'image'; resourceId: string } | { type: 'gradient'; value: string } | { type: 'none' };
export type ElementSnapshotNode =
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'element'; tag: string; attributes: Record<string, string>; children: string[];
      styleId?: string; resourceId?: string; backgroundResourceIds?: string[];
      backgroundLayers?: ElementSnapshotBackground[];
      pseudos?: { kind: 'before' | 'after' | 'marker'; text: string; styleId?: string }[] };
export interface ElementSnapshotContent {
  version: 1;
  capturedAt: number;
  viewport: { width: number; height: number; devicePixelRatio: number };
  root: { nodeId: string; width: number; height: number };
  nodes: ElementSnapshotNode[];
  styles: { id: string; values: ElementSnapshotStyle }[];
  unsupportedFeatures: string[];
}
/** Only acquired bytes can resolve these temporary resource IDs to owned Assets. */
export interface ElementSnapshotDraft extends ElementSnapshotContent { resources: { id: string }[] }
export interface ElementSnapshotRecord extends ElementSnapshotContent {
  id: string; // Collection item ID; exactly one immutable snapshot per item.
  captureId: string; // Must match item.data.snapshotId, including after backup merge.
  organisationId: string;
  collectionId: string;
  sourceUrl: string;
  resources: { id: string; assetId: string }[];
}
