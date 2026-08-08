import * as React from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import type { FieldConfig, FieldType, TextFieldConfig } from '@extension/shared';
import { useSnippetBuilder } from '../context/SnippetBuilderContext';

/**
 * The React component that renders the Field Node inside the Tiptap editor.
 */
export const SnippetVariablePlaceholderUI: React.FC<NodeViewProps> = ({ node, selected, updateAttributes }) => {
  const { fieldType, config, alias } = node.attrs as {
    fieldType: FieldType;
    config: FieldConfig;
    alias?: string;
  };
  const { openTextConfigModal } = useSnippetBuilder();

  // Determine the display label based on what the user provided
  const displayLabel = config.label || alias || fieldType;

  const handleClick = () => {
    if (fieldType === 'text' || fieldType === 'dropdown' || fieldType === 'toggle' || fieldType === 'date') {
      openTextConfigModal(
        fieldType,
        config as any,
        alias,
        (newConfig, newAlias) => {
          updateAttributes({
            config: newConfig,
            alias: newAlias,
          });
        }
      );
    }
  };

  // Render a nice chip matching Text Blaze's style
  return (
    <NodeViewWrapper
      as="span"
      onClick={handleClick}
      className={`inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded text-sm font-medium select-none cursor-pointer hover:shadow-sm transition-all border ${
        selected
          ? 'bg-indigo-100 text-indigo-900 border-indigo-400 dark:bg-indigo-900/40 dark:text-indigo-200 dark:border-indigo-600'
          : 'bg-neutral-100 text-neutral-700 border-neutral-300 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-600 dark:hover:bg-neutral-700'
      }`}
      data-type="field-node"
    >
      <span className="mr-1 opacity-60 text-xs">
        {getIconForType(fieldType)}
      </span>
      {displayLabel}
    </NodeViewWrapper>
  );
};

function getIconForType(type: FieldType) {
  switch (type) {
    case 'text':
      return 'T';

    case 'dropdown':
      return '▼';
    case 'date':
      return '📅';
    case 'toggle':
      return '☑';
    case 'clipboard':
      return '📋';
    default:
      return '•';
  }
}
