import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { SnippetCursorPlaceholderUI } from '../components/SnippetCursorPlaceholderUI';
import { v4 as uuidv4 } from 'uuid';
export interface CursorNodeOptions {
    HTMLAttributes: Record<string, any>;
}
declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        cursorNode: {
            /**
             * Insert a cursor node
             */
            insertCursorNode: () => ReturnType;
        };
    }
}
export const CursorNodeExtension = Node.create<CursorNodeOptions>({
    name: 'cursorNode',
    group: 'inline',
    inline: true,
    atom: true, // This node is a single unbreakable entity
    addAttributes() {
        return {
            id: {
                default: null,
            },
        };
    },
    parseHTML() {
        return [
            {
                tag: 'span[data-type="cursor-node"]',
            }
        ];
    },
    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-type': 'cursor-node' })];
    },
    addNodeView() {
        return ReactNodeViewRenderer(SnippetCursorPlaceholderUI);
    },
    addCommands() {
        return {
            insertCursorNode: () => ({ commands }) => {
                return commands.insertContent({
                    type: this.name,
                    attrs: {
                        id: uuidv4(),
                    },
                });
            },
        };
    },
});
