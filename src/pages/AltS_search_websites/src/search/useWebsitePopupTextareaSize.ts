/** One sizing owner: measure outside visible layout, then commit the final bounded height. */
import { useCallback, useLayoutEffect, useRef } from 'react';

const cssNumber = (style: CSSStyleDeclaration, property: string, fallback: number) => {
  const value = Number.parseFloat(style.getPropertyValue(property));
  return Number.isFinite(value) ? value : fallback;
};

export function useWebsitePopupTextareaSize(element: HTMLTextAreaElement | null, value: string, options: {
  maximumRowsToken: string; maximumRows?: number; minimumHeightToken?: string;
  onMeasured?: (height: number, minimumHeight: number) => void;
}) {
  const mirrorRef = useRef<HTMLTextAreaElement | null>(null);
  const current = useRef({ value, options });
  current.current = { value, options };
  const measure = useCallback(() => {
    const mirror = mirrorRef.current;
    if (!element?.isConnected || !mirror?.isConnected) return;
    const style = window.getComputedStyle(element);
    const lineHeight = cssNumber(style, 'line-height', cssNumber(style, '--website-popup-search-line-height', 1));
    const padding = cssNumber(style, 'padding-top', 0) + cssNumber(style, 'padding-bottom', 0);
    const border = cssNumber(style, 'border-top-width', 0) + cssNumber(style, 'border-bottom-width', 0);
    const settings = current.current.options;
    const rows = Math.max(1, Math.min(settings.maximumRows ?? Infinity, cssNumber(style, settings.maximumRowsToken, 1)));
    const minimum = settings.minimumHeightToken ? cssNumber(style, settings.minimumHeightToken, lineHeight + padding + border)
      : lineHeight + padding + border;
    const maximum = Math.max(minimum, rows * lineHeight + padding + border);
    // Copy actual typography/box metrics, not selectors that can influence the visible field's parent.
    for (const property of ['font-family', 'font-size', 'font-weight', 'font-style', 'font-stretch', 'font-variant',
      'line-height', 'letter-spacing', 'word-spacing', 'text-transform', 'white-space',
      'overflow-wrap', 'word-break', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
      'border-top-width', 'border-bottom-width', 'border-left-width', 'border-right-width', 'border-style']) {
      mirror.style.setProperty(property, style.getPropertyValue(property));
    }
    mirror.style.width = `${cssNumber(style, 'width', element.offsetWidth)}px`;
    mirror.value = current.current.value;
    const contentHeight = mirror.scrollHeight + border;
    const height = Math.min(Math.max(minimum, contentHeight), maximum);
    const nextHeight = `${height}px`;
    const overflow = contentHeight > maximum ? 'auto' : 'hidden';
    if (element.style.height !== nextHeight) element.style.height = nextHeight;
    if (element.style.overflowY !== overflow) element.style.overflowY = overflow;
    settings.onMeasured?.(height, minimum);
  }, [element]);

  useLayoutEffect(() => {
    if (!element) return;
    const mirror = element.ownerDocument.createElement('textarea');
    mirror.setAttribute('aria-hidden', 'true'); mirror.tabIndex = -1; mirror.inert = true;
    Object.assign(mirror.style, { position: 'absolute', visibility: 'hidden', pointerEvents: 'none',
      boxSizing: 'border-box', fieldSizing: 'fixed', height: '0px', minHeight: '0px', maxHeight: 'none',
      minWidth: '0px', maxWidth: 'none', overflow: 'hidden', resize: 'none' });
    const root = element.getRootNode();
    const container = root instanceof ShadowRoot ? root : element.ownerDocument.body;
    container.appendChild(mirror); mirrorRef.current = mirror;
    let active = true;
    let width: number | null = null;
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(entries => {
      const nextWidth = entries[0]?.contentRect.width;
      if (nextWidth === undefined || nextWidth === width) return;
      width = nextWidth; measure();
    });
    observer?.observe(element);
    const fonts = element.ownerDocument.fonts;
    const fontsChanged = () => { if (active) measure(); };
    fonts?.addEventListener('loadingdone', fontsChanged);
    void fonts?.ready.then(fontsChanged).catch(() => undefined);
    measure();
    return () => {
      active = false; observer?.disconnect(); fonts?.removeEventListener('loadingdone', fontsChanged);
      mirror.remove(); if (mirrorRef.current === mirror) mirrorRef.current = null;
    };
  }, [element, measure]);
  useLayoutEffect(() => { measure(); }, [measure, value, options.maximumRows, options.maximumRowsToken, options.minimumHeightToken]);
}
