export type LinkQueryInjectionErrorCode =
  | 'missing_query_value'
  | 'invalid_query_format'
  | 'too_many_query_values';

export type LinkQueryInjectionResult =
  | { ok: true; urls: string[] }
  | { ok: false; errorCode: LinkQueryInjectionErrorCode };

const LINK_QUERY_PLACEHOLDER_PATTERN = /(?:\{query\}|\[query\]|%7Bquery%7D)/gi;

export const countLinkQueryPlaceholders = (urls: string[]): number =>
  urls.reduce((total, url) => total + (String(url).match(LINK_QUERY_PLACEHOLDER_PATTERN)?.length || 0), 0);

/**
 * Builds temporary launch URLs from the saved link URLs and omnibox suffix.
 * Saved URLs are never mutated; placeholder values are assigned in URL order,
 * then from left to right within each URL.
 */
export const injectLinkQueryValues = (urls: string[], rawInput: string): LinkQueryInjectionResult => {
  const placeholderCount = countLinkQueryPlaceholders(urls);
  if (placeholderCount === 0) return { ok: true, urls: [...urls] };

  const input = rawInput.trim();
  if (!input) return { ok: false, errorCode: 'missing_query_value' };

  let values: string[];
  if (!input.includes('|')) {
    values = Array(placeholderCount).fill(input);
  } else {
    values = input.split('|').map(value => value.trim());
    if (values.some(value => !value)) {
      return { ok: false, errorCode: 'invalid_query_format' };
    }
    if (values.length > placeholderCount) {
      return { ok: false, errorCode: 'too_many_query_values' };
    }

    const fallbackValue = values[values.length - 1];
    while (values.length < placeholderCount) values.push(fallbackValue);
  }

  let valueIndex = 0;
  const processedUrls = urls.map(url =>
    String(url).replace(LINK_QUERY_PLACEHOLDER_PATTERN, () => encodeURIComponent(values[valueIndex++])),
  );

  return { ok: true, urls: processedUrls };
};
