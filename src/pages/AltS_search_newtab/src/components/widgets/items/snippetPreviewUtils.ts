import type { SnippetRecord } from '../../../../../../allObjectFolder/src/createObject/snippets/snippetTypes';

/**
 * Strips HTML tags and unescapes common HTML entities.
 */
function stripHtmlTags(html: string): string {
  if (!html) return '';
  return html
    .replace(/<\/p>/gi, ' ')
    .replace(/<\/div>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Recursively traverses JSON/AST nodes to extract text, skipping cursor nodes,
 * and replacing field nodes with readable {{Placeholder}} text.
 */
function extractTextFromNodes(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);

  if (Array.isArray(val)) {
    return val.map(item => extractTextFromNodes(item)).filter(Boolean).join(' ');
  }

  if (typeof val === 'object') {
    const node = val as Record<string, any>;
    const nodeType = String(node.type || '').toLowerCase();

    // Skip cursor nodes
    if (nodeType === 'cursor') {
      return '';
    }

    // Process field / variable nodes
    if (['field', 'dropdown', 'toggle', 'date', 'text_input', 'variable'].includes(nodeType)) {
      const config = node.config || {};
      const alias = config.label || node.alias || node.label || node.name || node.id || 'Field';
      return `{{${alias}}}`;
    }

    // Process text nodes
    if (nodeType === 'text' || typeof node.text === 'string' || typeof node.value === 'string') {
      const mainText = node.text || node.value || '';
      const childText = Array.isArray(node.children) || Array.isArray(node.content)
        ? extractTextFromNodes(node.children || node.content)
        : '';
      return [mainText, childText].filter(Boolean).join(' ');
    }

    // Process paragraph, doc, or container nodes
    if (Array.isArray(node.children)) {
      return extractTextFromNodes(node.children);
    }
    if (Array.isArray(node.content)) {
      return extractTextFromNodes(node.content);
    }
    if (node.note && typeof node.note === 'string') {
      return node.note;
    }
  }

  return '';
}

/**
 * Extracts a safe, truncated plain-text preview from a SnippetRecord config payload.
 */
export function getSnippetPlainTextPreview(
  config: SnippetRecord['config'],
  maxLength = 120,
): string {
  if (config == null) return '';

  let rawString = '';

  if (typeof config === 'string') {
    const trimmed = config.trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        rawString = extractTextFromNodes(parsed);
      } catch {
        rawString = trimmed;
      }
    } else {
      rawString = trimmed;
    }
  } else if (typeof config === 'object') {
    try {
      rawString = extractTextFromNodes(config);
    } catch {
      rawString = '';
    }
  }

  const clean = stripHtmlTags(rawString).replace(/\s+/g, ' ').trim();
  if (!clean) return '';

  if (clean.length > maxLength) {
    return clean.slice(0, maxLength - 1).trim() + '…';
  }

  return clean;
}
