/**
 * Utility to convert HTML paste content to plain text while preserving bullets and line breaks
 * @param html - HTML content from clipboard
 * @returns Plain text with bullets and line breaks preserved
 */
export function htmlToPlainTextWithStructure(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  function processNode(node: Node): string {
    // Text node - return as-is
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }

    // Element node
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tag = element.tagName.toLowerCase();

      // Convert lists to bullets
      if (tag === 'li') {
        const children = Array.from(element.childNodes).map(processNode).join('');
        return `• ${children}`;
      }

      // Preserve line breaks
      if (tag === 'br') {
        return '\n';
      }

      // Block elements create line breaks
      if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
        const children = Array.from(element.childNodes).map(processNode).join('');
        return children + '\n';
      }

      // List containers add line breaks between items
      if (tag === 'ul' || tag === 'ol') {
        const children = Array.from(element.childNodes).map(processNode).join('\n');
        return children + '\n';
      }

      // For other elements, just process children
      return Array.from(element.childNodes).map(processNode).join('');
    }

    return '';
  }

  const result = processNode(doc.body);

  // Clean up excessive newlines (max 2 consecutive)
  return result.replace(/\n{3,}/g, '\n\n').trim();
}
