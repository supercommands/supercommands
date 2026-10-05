import { WEB_SCRAPING_STYLE_KEYS, isWebScrapingStyleValue, type WebScrapingStyle } from '../../../allObjectFolder/src/createObject/collections/webScrapingStyle';

/** Snapshot resolved appearance, without copying arbitrary CSS rules or fetching fonts. */
export function createWebScrapingStyleReader(view: Window) {
  const cache = new WeakMap<Element, WebScrapingStyle>();
  return (element: Element): WebScrapingStyle => {
    const previous = cache.get(element);
    if (previous) return previous;
    const computed = view.getComputedStyle(element);
    const style: WebScrapingStyle = {};
    for (const key of WEB_SCRAPING_STYLE_KEYS) {
      const value = computed[key];
      if (isWebScrapingStyleValue(key, value)) style[key] = value;
    }
    // Transparent wrappers inherit the visual backing of the website, not the popup theme.
    for (let parent = element.parentElement; parent && (!style.backgroundColor || style.backgroundColor === 'transparent' || style.backgroundColor === 'rgba(0, 0, 0, 0)'); parent = parent.parentElement) {
      const color = view.getComputedStyle(parent).backgroundColor;
      if (isWebScrapingStyleValue('backgroundColor', color)) style.backgroundColor = color;
    }
    if (!style.colorScheme) style.colorScheme = 'light';
    if (!style.backgroundColor || style.backgroundColor === 'transparent' || style.backgroundColor === 'rgba(0, 0, 0, 0)') {
      style.backgroundColor = 'Canvas';
    }
    cache.set(element, style);
    return style;
  };
}
