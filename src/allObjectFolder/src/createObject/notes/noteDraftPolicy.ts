import { extractTextFromHTML } from './noteHelpers';

/** Scope/tags are draft defaults, not authored content. Attachments count as content. */
export function hasNoteDraftContent(title: string, body: string): boolean {
  return Boolean(title.trim() || extractTextFromHTML(body).replace(/&#(?:160|xA0);|\u200B/gi, ' ').trim()
    || /<(?:img|video|audio|iframe|table|hr)\b/i.test(body));
}
