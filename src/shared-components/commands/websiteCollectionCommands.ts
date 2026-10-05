/** Stable identities/provisioning labels; visible names use label/displayLabel and prefixes stay in settings. */
export const WEBSITE_COLLECTION_COMMAND = {
  id: 'collection_capture', label: 'Web Clips', prefixKey: 'collection_capture',
} as const;
export const WEBSITE_COLLECTION_CAPTURE_CHOICES = [
  { id: 'collection_link', label: 'Link clip', commandLabel: 'Collection Link', displayLabel: 'Link clip', type: 'link' },
  { id: 'collection_article', label: 'Article clip', commandLabel: 'Collection Article', displayLabel: 'Article clip', type: 'article' },
  { id: 'collection_screenshot', label: 'Screenshot clip', commandLabel: 'Collection Screenshot', displayLabel: 'Screenshot clip', type: 'screenshot' },
  { id: 'collection_web_scraping', label: 'Element clip', commandLabel: 'Collection Web Scraping', displayLabel: 'Element clip', type: 'web-scraping' },
] as const;
export type WebsiteCollectionCaptureType = typeof WEBSITE_COLLECTION_CAPTURE_CHOICES[number]['type'];
