/**
 * @file localImageBlot.ts
 * @description Custom Quill embed for local images.
 */

export function registerLocalImageBlot(Quill: any) {
  const BlockEmbed = Quill.import('blots/block/embed') as any;

  class LocalImageBlot extends BlockEmbed {
    static create(value: any) {
      const node = super.create();
      // Default image source if not yet replaced by our runtime hook
      node.setAttribute('src', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'); 
      node.setAttribute('data-local-asset-id', value.assetId);
      if (value.alt) {
        node.setAttribute('alt', value.alt);
      }
      node.setAttribute('class', 'quill-local-image');
      return node;
    }

    static value(node: HTMLElement) {
      return {
        assetId: node.getAttribute('data-local-asset-id'),
        alt: node.getAttribute('alt')
      };
    }
  }

  LocalImageBlot.blotName = 'localImage';
  LocalImageBlot.tagName = 'IMG';

  Quill.register(LocalImageBlot, true);
}
