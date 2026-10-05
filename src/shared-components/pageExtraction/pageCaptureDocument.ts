/** Our transient controls are never part of captured page content. */
export const PAGE_CAPTURE_UI_SELECTOR = '[data-alts-runtime="true"], [data-website-popup-layer-host="true"], [data-website-popup-layer-portal="true"], [data-screenshot-toolbar]';

export function isPageCaptureUi(element: Element): boolean {
  if (element.closest(PAGE_CAPTURE_UI_SELECTOR)) return true;
  const root = element.getRootNode();
  return root instanceof ShadowRoot && isPageCaptureUi(root.host);
}

/** Remove controls from the detached snapshot, leaving the live application untouched. */
export function createPageCaptureDocument(document: Document): Document {
  const clone = document.cloneNode(true) as Document;
  clone.querySelectorAll(PAGE_CAPTURE_UI_SELECTOR).forEach(element => element.remove());
  return clone;
}
