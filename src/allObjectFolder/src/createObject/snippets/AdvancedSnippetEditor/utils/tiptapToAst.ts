import type { Editor } from '@tiptap/react';
import type { ASTNode, TextMark } from '@extension/shared';
import { createTextNode } from '@extension/shared';

const getTextMarks = (inline: any): TextMark[] | undefined => {
  const linkMark = inline.marks?.find((mark: any) => mark.type === 'link' && mark.attrs?.href);
  if (!linkMark?.attrs?.href) return undefined;
  return [{ type: 'link', href: linkMark.attrs.href }];
};

const areMarksEqual = (a?: TextMark[], b?: TextMark[]) => {
  if (!a?.length && !b?.length) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((mark, index) => mark.type === b[index]?.type && mark.href === b[index]?.href);
};

const createMarkedTextNode = (value: string, marks?: TextMark[]) => {
  const node = createTextNode(value);
  if (marks?.length) {
    node.marks = marks;
  }
  return node;
};

/**
 * Iterates through the Tiptap JSON output and safely converts it to our
 * strict Canonical AST format.
 */
export function convertTiptapToAst(editor: Editor): ASTNode[] {
  const json = editor.getJSON();
  const astNodes: ASTNode[] = [];

  // Tiptap returns a "doc" node with "content"
  if (!json.content) return astNodes;

  for (const block of json.content) {
    if (block.type === 'paragraph') {
      let paraText = '';
      let paraMarks: TextMark[] | undefined;

      const flushText = (value = paraText, marks = paraMarks) => {
        if (!value) return;
        astNodes.push(createMarkedTextNode(value, marks));
        paraText = '';
        paraMarks = undefined;
      };
      
      if (block.content) {
        for (const _inline of block.content) {
          const inline = _inline as any;
          if (inline.type === 'text' && inline.text) {
            const marks = getTextMarks(inline);
            if (paraText && !areMarksEqual(paraMarks, marks)) {
              flushText();
            }
            paraMarks = marks;
            paraText += inline.text;
          } else if (inline.type === 'fieldNode' && inline.attrs) {
            // Before inserting the field, flush any accumulated text
            flushText();
            
            // Push the field node exactly as it came from the factory
            astNodes.push({
              id: inline.attrs.id,
              type: 'field',
              fieldType: inline.attrs.fieldType,
              config: inline.attrs.config,
              alias: inline.attrs.alias,
            });
          } else if (inline.type === 'cursorNode' && inline.attrs) {
            flushText();
            astNodes.push({
              id: inline.attrs.id,
              type: 'cursor'
            });
          }
        }
      }
      
      // Flush remaining text, plus a newline to represent the paragraph end
      if (paraText) {
        flushText(paraText + '\n', paraMarks);
      } else {
        // Empty paragraph
        astNodes.push(createTextNode('\n'));
      }
    }
  }

  // Post-process: Merge adjacent text nodes
  const mergedNodes: ASTNode[] = [];
  for (const node of astNodes) {
    if (mergedNodes.length > 0) {
      const last = mergedNodes[mergedNodes.length - 1];
      if (last.type === 'text' && node.type === 'text' && areMarksEqual(last.marks, node.marks)) {
        last.value += node.value;
        continue;
      }
    }
    mergedNodes.push(node);
  }

  // Post-process: remove the trailing newline from the very last text node
  if (mergedNodes.length > 0) {
    const lastNode = mergedNodes[mergedNodes.length - 1];
    if (lastNode.type === 'text') {
      lastNode.value = lastNode.value.replace(/\n$/, '');
      // If stripping the newline made it empty, just remove the node entirely
      if (lastNode.value === '') {
        mergedNodes.pop();
      }
    }
  }

  return mergedNodes;
}
