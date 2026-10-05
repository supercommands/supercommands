import { Mark, mergeAttributes } from '@tiptap/core';
export interface LinkMarkOptions {
    HTMLAttributes: Record<string, any>;
}
declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        snippetLink: {
            setSnippetLink: (attrs: {
                href: string;
            }) => ReturnType;
            unsetSnippetLink: () => ReturnType;
        };
    }
}
export const normalizeSnippetLinkUrl = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed)
        return '';
    if (/^(https?:|mailto:|tel:)/i.test(trimmed))
        return trimmed;
    return `https://${trimmed}`;
};
export const LinkMarkExtension = Mark.create<LinkMarkOptions>({
    name: 'link',
    inclusive: false,
    addOptions() {
        return {
            HTMLAttributes: {
                target: '_blank',
                rel: 'noopener noreferrer',
            },
        };
    },
    addAttributes() {
        return {
            href: {
                default: null,
                parseHTML: element => element.getAttribute('href'),
                renderHTML: attributes => {
                    const href = normalizeSnippetLinkUrl(attributes.href || '');
                    return href ? { href } : {};
                },
            },
        };
    },
    parseHTML() {
        return [
            {
                tag: 'a[href]',
            }
        ];
    },
    renderHTML({ HTMLAttributes }) {
        return ['a', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },
    addCommands() {
        return {
            setSnippetLink: attrs => ({ commands }) => {
                const href = normalizeSnippetLinkUrl(attrs.href);
                if (!href)
                    return false;
                return commands.setMark(this.name, { href });
            },
            unsetSnippetLink: () => ({ commands }) => {
                return commands.unsetMark(this.name);
            },
        };
    },
});
