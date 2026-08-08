import * as React from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';

/**
 * The React component that renders the Cursor Node inside the Tiptap editor.
 */
export const SnippetCursorPlaceholderUI: React.FC<NodeViewProps> = ({ selected }) => {
  return (
    <NodeViewWrapper
      as="span"
      className={`inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded text-sm font-medium select-none border ${
        selected
          ? 'bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-600'
          : 'bg-yellow-50 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700'
      }`}
      data-type="cursor-node"
    >
      <span className="mr-1 opacity-60 text-xs">
        I
      </span>
      Cursor
    </NodeViewWrapper>
  );
};
