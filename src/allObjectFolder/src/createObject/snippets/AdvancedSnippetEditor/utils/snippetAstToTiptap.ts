import type { ASTNode } from '@extension/shared';

export function convertAstToTiptap(astNodes: ASTNode[]): any {
  const content: any[] = [];
  let currentParagraph: any[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      content.push({
        type: 'paragraph',
        content: currentParagraph,
      });
      currentParagraph = [];
    } else {
      content.push({
        type: 'paragraph',
      });
    }
  };

  for (const node of astNodes) {
    if (node.type === 'text' && node.value) {
      const parts = node.value.split('\n');
      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) {
          const textNode: any = {
            type: 'text',
            text: parts[i],
          };
          const linkMark = node.marks?.find(mark => mark.type === 'link' && mark.href);
          if (linkMark) {
            textNode.marks = [
              {
                type: 'link',
                attrs: {
                  href: linkMark.href,
                },
              },
            ];
          }
          currentParagraph.push(textNode);
        }
        if (i < parts.length - 1) {
          flushParagraph();
        }
      }
    } else if (node.type === 'field') {
      currentParagraph.push({
        type: 'fieldNode',
        attrs: {
          id: node.id || `field_${Math.random().toString(36).substr(2, 9)}`,
          fieldType: node.fieldType || 'text',
          config: node.config || {},
          alias: node.alias || 'Field',
        },
      });
    } else if (node.type === 'cursor') {
      currentParagraph.push({
        type: 'cursorNode',
        attrs: {
          id: node.id || `cursor_${Math.random().toString(36).substr(2, 9)}`,
        },
      });
    }
  }

  // Flush remaining
  if (currentParagraph.length > 0) {
    flushParagraph();
  }

  // Ensure at least one paragraph
  if (content.length === 0) {
    content.push({ type: 'paragraph' });
  }

  return {
    type: 'doc',
    content,
  };
}
