import type { WebScrapingBlock, WebScrapingInline } from '../../../allObjectFolder/src/createObject/collections/webScrapingTypes';

/** Quiet text preview until the full structured renderer is connected. */
export function webScrapingTextPreview(blocks: WebScrapingBlock[]): string {
  const inline = (children: WebScrapingInline[]): string => children.map(child => child.type === 'text' ? child.text : inline(child.children)).join('');
  const text = (block: WebScrapingBlock): string => {
    switch (block.type) {
      case 'paragraph': case 'heading': return inline(block.children);
      case 'code': return block.text;
      case 'quote': return block.blocks.map(text).join('\n');
      case 'list': return block.items.map(item => item.map(text).join(' ')).join('\n');
      case 'table': return block.rows.map(row => row.map(cell => cell.map(text).join(' ')).join(' · ')).join('\n');
      default: return '[Image]';
    }
  };
  return blocks.map(text).join('\n').trim().slice(0, 320);
}
