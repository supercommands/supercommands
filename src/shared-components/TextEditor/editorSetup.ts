import type Clipboard from 'quill/modules/clipboard';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Bold, Italic, Underline, Strikethrough, Link as LinkIcon, Quote, Code, SquareCode, List, ListOrdered, ListChecks, Eraser, Minus, PanelsTopLeft, Image as ImageIcon, Ellipsis, Type, ChevronDown, Check, Table2 } from 'lucide-react';
import { registerLocalImageBlot } from './blots/localImageBlot';
import { assetStore } from '../../storage/assets/assetStore';
import { validateImageAsset } from '../../storage/assets/assetPolicy';
import { insertNoteTable, setupNoteTableControls } from './noteTableControls';
import { setupNoteFooterMenus } from './noteFooterMenus';
interface EditorSetupOptions {
    placeholder?: string;
    readOnly?: boolean;
    onChange: (html: string) => void;
    onKeyUpdate?: (newKey: string) => void;
    onAtTrigger?: (position: {
        top: number;
        left: number;
    }) => void;
    onUpArrowAtStart?: () => void;
    onCreateNew?: () => void;
    ref?: any;
    quillInstanceRef: React.RefObject<any>;
    toolbarSelector?: string;
    notesFormatting?: boolean;
    onDelete?: () => void;
    onImageSaveStart?: () => void;
    onImageSaveEnd?: () => void;
}
const resolveToolbarTarget = (selector?: string, root?: Document | ShadowRoot) => {
    if (!selector)
        return null;
    const rootMatch = root?.querySelector?.(selector);
    if (rootMatch instanceof HTMLElement)
        return rootMatch;
    const documentMatch = document.querySelector(selector);
    if (documentMatch instanceof HTMLElement)
        return documentMatch;
    return null;
};
const normalizeLinkUrl = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed)
        return '';
    if (/^(https?:|mailto:|tel:)/i.test(trimmed))
        return trimmed;
    return `https://${trimmed}`;
};
const openUrlInNewTab = (url: string) => {
    const normalizedUrl = normalizeLinkUrl(url);
    if (!normalizedUrl)
        return;
    const chromeAny = (window as any)?.chrome;
    if (chromeAny?.tabs?.create) {
        chromeAny.tabs.create({ url: normalizedUrl, active: true });
        return;
    }
    window.open(normalizedUrl, '_blank', 'noopener,noreferrer');
};
export const setupEditor = async (container: HTMLDivElement, initialValue: string, { placeholder, readOnly, onChange, onKeyUpdate, onAtTrigger, onUpArrowAtStart, onCreateNew, ref, quillInstanceRef, toolbarSelector, notesFormatting = false, onDelete, onImageSaveStart, onImageSaveEnd, }: EditorSetupOptions) => {
    const { default: Quill } = await import('quill');
    const History = Quill.import('modules/history') as any;
    if (!History.notesHistoryPolicy) {
        const Module = Quill.import('core/module') as any;
        class EditorHistory extends Module {
            static DEFAULTS = History.DEFAULTS;
            static notesHistoryPolicy = true;
            constructor(quill: any, options: any) {
                super(quill, options);
                if (!options.disabled) return new History(quill, options);
            }
            // Quill calls these lifecycle hooks even when history recording is disabled.
            clear() {}
            cutoff() {}
            undo() {}
            redo() {}
        }
        Quill.register('modules/history', EditorHistory, true);
    }
    registerLocalImageBlot(Quill);
    if (notesFormatting) {
        const BlockEmbed = Quill.import('blots/block/embed') as any;
        const Block = Quill.import('blots/block') as any;
        const Container = Quill.import('blots/container') as any;
        class DividerBlot extends BlockEmbed {
            static blotName = 'divider';
            static tagName = 'HR';
            static value() { return true; }
        }
        class DetailsContainer extends Container {
            static blotName = 'note-details';
            static tagName = 'DETAILS';
            static className = 'note-details';
            private restoredOpenState = false;
            checkMerge() {
                if (!this.next || this.next.statics?.blotName !== 'note-details')
                    return false;
                let nextHasSummary = false;
                this.next.children.forEach((child: any) => {
                    if (child.statics?.blotName === 'note-details-summary')
                        nextHasSummary = true;
                });
                return !nextHasSummary;
            }
            static create() {
                const node = super.create();
                node.setAttribute('open', '');
                return node;
            }
            optimize(context: any) {
                super.optimize(context);
                if (this.restoredOpenState)
                    return;
                const summary = this.children.head;
                if (summary?.statics?.blotName !== 'note-details-summary')
                    return;
                const state = summary.domNode.getAttribute('data-note-open');
                if (state === 'closed' && this.domNode.hasAttribute('open'))
                    this.domNode.removeAttribute('open');
                else if (state !== 'closed' && !this.domNode.hasAttribute('open'))
                    this.domNode.setAttribute('open', '');
                this.restoredOpenState = true;
            }
        }
        class DetailsSummary extends Block {
            static blotName = 'note-details-summary';
            static tagName = 'SUMMARY';
            static create(value: string) {
                const node = super.create();
                node.setAttribute('data-note-open', value === 'closed' ? 'closed' : 'open');
                return node;
            }
            static formats(node: HTMLElement) {
                return node.getAttribute('data-note-open') || (node.parentElement?.hasAttribute('open') ? 'open' : 'closed');
            }
            format(name: string, value: any) {
                if (name === 'note-details-summary' && value) {
                    const state = value === 'closed' ? 'closed' : 'open';
                    this.domNode.setAttribute('data-note-open', state);
                    if (state === 'closed')
                        this.parent?.domNode.removeAttribute('open');
                    else
                        this.parent?.domNode.setAttribute('open', '');
                }
                else {
                    super.format(name, value);
                }
            }
        }
        class DetailsBody extends Block {
            static blotName = 'note-details-body';
            static tagName = 'DIV';
            static className = 'note-details-body';
            static formats() { return true; }
        }
        DetailsContainer.allowedChildren = [DetailsSummary, DetailsBody];
        DetailsSummary.requiredContainer = DetailsContainer;
        DetailsBody.requiredContainer = DetailsContainer;
        Quill.register(DividerBlot, true);
        Quill.register(DetailsContainer, true);
        Quill.register(DetailsSummary, true);
        Quill.register(DetailsBody, true);
    }
    const BaseClipboard = Quill.import('modules/clipboard') as typeof Clipboard;
    class CleanClipboard extends BaseClipboard {
        convert(input: {
            html?: string;
            text?: string;
        }, formats?: Record<string, unknown>) {
            const html = input.html || '';
            const div = document.createElement('div');
            div.innerHTML = html;
            if (notesFormatting) {
                // Quill's table model only registers TD; normalize TH before conversion to retain cell boundaries.
                div.querySelectorAll('th').forEach(header => {
                    const cell = document.createElement('td');
                    Array.from(header.attributes).forEach(attribute => cell.setAttribute(attribute.name, attribute.value));
                    const emphasis = document.createElement('strong');
                    while (header.firstChild) emphasis.appendChild(header.firstChild);
                    cell.appendChild(emphasis);
                    header.replaceWith(cell);
                });
            }
            div.querySelectorAll('*').forEach(node => {
                const el = node as HTMLElement;
                // Notes preserve author-selected colors; other editor surfaces retain their prior paste policy.
                if (!notesFormatting) {
                    el.style.backgroundColor = '';
                    el.style.background = '';
                    el.style.color = '';
                }
                // Clean background and color from style attribute string
                const style = el.getAttribute('style');
                if (style && !notesFormatting) {
                    const cleanedStyle = style
                        .split(';')
                        .filter(rule => {
                        const trimmed = rule.trim().toLowerCase();
                        return !trimmed.startsWith('background') && !trimmed.startsWith('color');
                    })
                        .join(';');
                    el.setAttribute('style', cleanedStyle);
                }
            });
            return super.convert({ html: div.innerHTML, text: input.text }, formats);
        }
    }
    Quill.register('modules/clipboard', CleanClipboard, true);
    const Link = Quill.import('formats/link') as {
        new (): any;
        sanitize: (url: string) => string;
    };
    // Optional: Patch Link to auto-prepend protocol if missing
    Link.sanitize = (url: string) => {
        if (!url)
            return '';
        if (/^https?:\/\//i.test(url))
            return url;
        // If no protocol, add https://
        return 'https://' + url;
    };
    Quill.register('formats/link', Link, true);
    // Keep runtime Quill overrides in the same root as the editor. Styles added
    // to document.head cannot cross into the Alt+S website Shadow DOM.
    const editorRoot = container.getRootNode();
    const toolbarStyleHost = editorRoot instanceof ShadowRoot ? editorRoot : document.head;
    if (!toolbarStyleHost.querySelector('#quill-custom-toolbar-styles')) {
        const style = document.createElement('style');
        style.id = 'quill-custom-toolbar-styles';
        style.innerHTML = `
      /* Default state - Light Mode */
      .ql-snow.ql-toolbar button .ql-stroke,
      .ql-snow .ql-toolbar button .ql-stroke-miter {
        stroke: #6b7280 !important;
      }
      .ql-snow.ql-toolbar button .ql-fill {
        fill: #6b7280 !important;
      }
      
      /* Default state - Dark Mode (Brighter gray for perfect visibility) */
      .dark .ql-snow.ql-toolbar button .ql-stroke,
      .dark .ql-snow .ql-toolbar button .ql-stroke-miter {
        stroke: #d1d5db !important;
      }
      .dark .ql-snow.ql-toolbar button .ql-fill {
        fill: #d1d5db !important;
      }

      /* Active State */
      .ql-snow.ql-toolbar button.ql-active,
      .ql-snow .ql-toolbar button.ql-active {
        color: #ffffff !important;
      }
      .ql-snow.ql-toolbar button.ql-active .ql-stroke,
      .ql-snow .ql-toolbar button.ql-active .ql-stroke-miter {
        stroke: #ffffff !important;
      }
      .ql-snow.ql-toolbar button.ql-active .ql-fill {
        fill: #ffffff !important;
      }
      .ql-snow.ql-toolbar button:hover .ql-stroke,
      .ql-snow .ql-toolbar button:hover .ql-stroke-miter {
        stroke: #e5e5e5 !important;
      }
      .ql-snow.ql-toolbar button:hover .ql-fill {
        fill: #e5e5e5 !important;
      }
      .ql-snow.ql-toolbar button svg {
        float: none !important;
        display: block !important;
        margin: 0 auto !important;
      }
      .ql-snow.ql-toolbar .ql-formats {
        margin-right: 4px !important;
      }
      .quill-local-image,
      .ql-editor img,
      .ql-image-hover-toolbar,
      .ql-image-resize-handle,
      .ql-image-lightbox-overlay {
        -webkit-user-drag: none !important;
        user-select: none !important;
        -webkit-user-select: none !important;
      }
      .ql-editor img::selection,
      .quill-local-image::selection,
      .quill-local-image *::selection {
        background: transparent !important;
        color: inherit !important;
      }
    `;
        toolbarStyleHost.appendChild(style);
    }
    const editorEl = document.createElement('div');
    // editorEl becomes .ql-container after Quill init — CSS handles flex sizing
    container.innerHTML = '';
    container.appendChild(editorEl);
    // Build toolbar HTML directly so ALL custom buttons are guaranteed to render
    const toolbarEl = document.createElement('div');
    toolbarEl.innerHTML = `

    <span class="ql-formats">
      <button class="ql-bold" title="Bold"></button>
      <button class="ql-italic" title="Italic"></button>
      <button class="ql-underline" title="Underline"></button>
      <button class="ql-strike" title="Strikethrough"></button>
    </span>
    <span class="ql-formats">
      <button class="ql-list" value="bullet" title="Bullet List"></button>
    </span>
    <span class="ql-formats note-more-formats">
      <button type="button" class="note-more-button" title="More formatting" aria-label="More formatting" aria-haspopup="menu" aria-expanded="false">···</button>
      <span class="note-more-panel custom-scrollbar-thin" hidden role="menu" aria-label="All formatting options">
        <span class="note-menu-label">Text</span>
        <button type="button" class="ql-bold" title="Bold">Bold</button>
        <button type="button" class="ql-italic" title="Italic">Italic</button>
        <button type="button" class="ql-underline" title="Underline">Underline</button>
        <button type="button" class="ql-strike" title="Strikethrough">Strikethrough</button>
        <button type="button" class="note-heading-option note-heading-normal" data-note-action="normal" title="Regular text">Regular text</button>
        <button type="button" class="note-heading-option note-heading-one" data-note-action="heading-1" title="Heading 1">Heading 1</button>
        <button type="button" class="note-heading-option note-heading-two" data-note-action="heading-2" title="Heading 2">Heading 2</button>
        <button type="button" class="note-heading-option note-heading-three" data-note-action="heading-3" title="Heading 3">Heading 3</button>
        <button type="button" class="note-heading-option note-heading-four" data-note-action="heading-4" title="Heading 4">Heading 4</button>
        <button type="button" class="ql-link" data-note-action="link" title="Link">Link</button>
        <button type="button" class="ql-clean" data-note-action="clear" title="Clear formatting">Clear formatting</button>
        <span class="note-menu-label">Lists and blocks</span>
        <button type="button" class="note-bullet-action" data-note-action="bullet" title="Bullet list">Bullet list</button>
        <button type="button" class="ql-list" value="ordered" data-note-action="ordered" title="Numbered list">Numbered list</button>
        <button type="button" class="ql-list" value="checked" data-note-action="checklist" title="Checklist">Checklist</button>
        <button type="button" class="ql-blockquote" data-note-action="quote" title="Quote">Quote</button>
        <button type="button" class="ql-code" data-note-action="inline-code" title="Inline code">Inline code</button>
        <button type="button" class="ql-code-block" data-note-action="code-block" title="Code block">Code block</button>
        <button type="button" class="note-divider" data-note-action="divider" title="Divider">Divider</button>
        <span class="note-menu-label">Insert</span>
        <button type="button" class="note-insert-details" data-note-action="section" title="Collapsible section">Collapsible section</button>
        <button type="button" class="note-insert-image" data-note-action="image" title="Insert image">Insert image</button>
        <button type="button" class="note-insert-table" data-note-action="table" title="Insert table">Insert table</button>
      </span>
    </span>
  `;
    if (!notesFormatting)
        toolbarEl.querySelector('.note-more-formats')?.remove();
    else
        toolbarEl.querySelectorAll('.note-more-panel button').forEach(button => button.setAttribute('role', 'menuitem'));
    const quill = new Quill(editorEl, {
        theme: 'snow',
        placeholder,
        readOnly,
        modules: {
            toolbar: {
                container: toolbarEl,
                handlers: {},
            },
            history: notesFormatting ? { disabled: true } : {
                delay: 1000,
                maxStack: 100,
                userOnly: true,
            },
            ...(notesFormatting ? { table: true } : {}),
            clipboard: {
                matchVisual: false,
            },
        },
    });
    const defaultTooltip = (quill as any).theme?.tooltip;
    if (notesFormatting) {
        const menuIcons: Record<string, typeof Bold> = {
            Bold, Italic, Underline, Strikethrough,
            Link: LinkIcon, 'Clear formatting': Eraser,
            'Bullet list': List, 'Numbered list': ListOrdered, Checklist: ListChecks,
            Quote, 'Inline code': Code, 'Code block': SquareCode,
            Divider: Minus, 'Collapsible section': PanelsTopLeft, 'Insert image': ImageIcon, 'Insert table': Table2,
        };
        toolbarEl.querySelectorAll<HTMLButtonElement>('.note-more-panel button').forEach(button => {
            const label = button.title;
            const symbol = document.createElement('span');
            symbol.className = 'note-menu-icon';
            symbol.innerHTML = renderToStaticMarkup(createElement(menuIcons[label] || Type, { size: 16, 'aria-hidden': true }));
            const text = document.createElement('span');
            text.className = 'note-menu-text';
            text.textContent = label;
            button.replaceChildren(symbol, text);
            button.setAttribute('aria-label', label);
        });
    }
    if (defaultTooltip) {
        defaultTooltip.hide?.();
        if (defaultTooltip.root instanceof HTMLElement) {
            defaultTooltip.root.classList.add('ql-default-tooltip-disabled');
        }
        defaultTooltip.show = () => { };
        defaultTooltip.edit = () => { };
    }
    const handleImageFile = async (file: File) => {
        if (!quill.isEnabled())
            return;
        let didStartImageSave = false;
        try {
            validateImageAsset(file);
            if (onImageSaveStart) {
                onImageSaveStart();
                didStartImageSave = true;
            }
            const asset = await assetStore.saveAsset(file, file.type);
            const range = quill.getSelection(true);
            quill.insertEmbed(range.index, 'localImage', { assetId: asset.id });
            quill.setSelection(range.index + 1, 0);
        }
        catch (error) {
            console.error('[editorSetup] Failed to save pasted image', error);
        }
        finally {
            if (didStartImageSave && onImageSaveEnd)
                onImageSaveEnd();
        }
    };
    quill.root.addEventListener('paste', (e: ClipboardEvent) => {
        if (e.clipboardData && e.clipboardData.items) {
            const items = Array.from(e.clipboardData.items);
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        void handleImageFile(file);
                        return;
                    }
                }
            }
        }
    }, true);
    quill.root.addEventListener('drop', (e: DragEvent) => {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            let hasImage = false;
            const files = Array.from(e.dataTransfer.files);
            for (const file of files) {
                if (file.type.startsWith('image/')) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    hasImage = true;
                    void handleImageFile(file);
                }
            }
            if (hasImage)
                return;
        }
    }, true);
    // Helper: apply clean styling to a toolbar element
    const styleToolbar = (toolbar: HTMLElement) => {
        if (toolbar.dataset.cmdosStyled === 'true')
            return;
        toolbar.dataset.cmdosStyled = 'true';
        toolbar.setAttribute('style', `
      display: flex;
      align-items: center;
      flex-wrap: nowrap;
      gap: 2px;
      padding: 4px 8px;
      border: none !important;
      background: transparent;
    `);
        const groups = toolbar.querySelectorAll('.ql-formats');
        groups.forEach((group: any, index: number) => {
            group.style.display = 'flex';
            group.style.alignItems = 'center';
            group.style.gap = '2px';
            group.style.margin = '0';
            if (index < groups.length - 1) {
                group.style.paddingRight = '8px';
                group.style.marginRight = '4px';
                group.style.borderRight = '1px solid rgba(150,150,150,0.2)';
            }
        });
        toolbar.querySelectorAll('button').forEach((b: any) => {
            if (b.closest('.note-more-panel'))
                return;
            b.style.cssText = `
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 30px !important;
        height: 30px !important;
        border-radius: 6px !important;
        padding: 0 !important;
        border: none !important;
        cursor: pointer;
        transition: background-color 0.15s ease, color 0.15s ease;
        flex-shrink: 0;
      `;
        });
        toolbar.querySelectorAll('button svg').forEach((svg: any) => {
            svg.setAttribute('width', '16');
            svg.setAttribute('height', '16');
        });
    };
    // toolbarEl IS the toolbar — Quill adds ql-toolbar class directly to it.
    // Apply styles immediately (Quill has already processed it at this point).
    styleToolbar(toolbarEl);
    // Teleport toolbarEl into the toolbarSelector target.
    // Use a retry loop because React may not have mounted the target div yet.
    if (toolbarSelector) {
        const attemptTeleport = (attemptsLeft: number) => {
            const target = resolveToolbarTarget(toolbarSelector, container.getRootNode() as Document | ShadowRoot);
            if (target) {
                target.appendChild(toolbarEl);
                // Re-apply styles after teleport
                setTimeout(() => styleToolbar(toolbarEl), 10);
            }
            else if (attemptsLeft > 0) {
                setTimeout(() => attemptTeleport(attemptsLeft - 1), 50);
            }
        };
        attemptTeleport(20); // Try up to 20 times = up to 1 second total
    }
    else {
        const wrapper = container.parentElement;
        if (wrapper) {
            wrapper.insertBefore(toolbarEl, container);
            styleToolbar(toolbarEl);
        }
    }
    // Add keyboard binding for Up Arrow to navigate back to title
    if (onUpArrowAtStart) {
        quill.keyboard.addBinding({
            key: 'ArrowUp',
            handler: (range: any) => {
                if (range.index === 0) {
                    onUpArrowAtStart();
                    return false; // Prevent extra cursor movement
                }
                return true;
            },
        });
    }
    const updateImageSelectionBorders = (range: any) => {
        const images = quill.root.querySelectorAll('.quill-local-image, img[data-local-asset-id]');
        images.forEach((img: Element) => {
            const htmlImg = img as HTMLImageElement;
            if (!range || !range.length) {
                htmlImg.classList.remove('is-selected-range');
                return;
            }
            const blot = Quill.find(htmlImg);
            if (!blot) {
                htmlImg.classList.remove('is-selected-range');
                return;
            }
            const index = quill.getIndex(blot as any);
            if (index >= range.index && index < range.index + range.length) {
                htmlImg.classList.add('is-selected-range');
            }
            else {
                htmlImg.classList.remove('is-selected-range');
            }
        });
    };
    quill.on('selection-change', updateImageSelectionBorders);
    // Custom Ctrl+A/Cmd+A selection handler
    quill.keyboard.addBinding({
        key: 'a',
        shortKey: true,
    }, () => {
        const length = quill.getLength();
        const range = { index: 0, length: Math.max(0, length - 1) };
        quill.setSelection(range.index, range.length, 'user');
        updateImageSelectionBorders(range);
        return false; // Prevent default browser selectAll behavior
    });
    const initialDelta = quill.clipboard.convert({ html: initialValue || '' });
    quill.setContents(initialDelta, 'silent');
    quill.root.style.background = 'transparent';
    quill.root.style.color = 'inherit';
    if (ref)
        ref.current = quill;
    quillInstanceRef.current = quill;
    const cleanupFns: Array<() => void> = [];
    if (notesFormatting) {
        const handleDetailsToggle = (event: Event) => {
            if (!quill.isEnabled())
                return;
            if ((event.target as HTMLElement)?.matches?.('details.note-details')) {
                const details = event.target as HTMLDetailsElement;
                const summary = details.querySelector('summary');
                const summaryBlot = summary ? Quill.find(summary) as any : null;
                const state = details.open ? 'open' : 'closed';
                if (summaryBlot?.statics?.blotName === 'note-details-summary'
                    && summary?.getAttribute('data-note-open') !== state) {
                    const index = quill.getIndex(summaryBlot);
                    quill.formatLine(index, 1, 'note-details-summary', state, 'user');
                }
                onChange(quill.root.innerHTML);
            }
        };
        quill.root.addEventListener('toggle', handleDetailsToggle, true);
        cleanupFns.push(() => quill.root.removeEventListener('toggle', handleDetailsToggle, true));
        let pasteAsPlain = false;
        const markPlainPaste = (event: KeyboardEvent) => {
            pasteAsPlain = (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'v';
        };
        const clearPlainPaste = (event: KeyboardEvent) => {
            if (event.key.toLowerCase() === 'v')
                pasteAsPlain = false;
        };
        const handlePlainPaste = (event: ClipboardEvent) => {
            if (!pasteAsPlain)
                return;
            pasteAsPlain = false;
            const plain = event.clipboardData?.getData('text/plain');
            if (plain === undefined)
                return;
            event.preventDefault();
            event.stopImmediatePropagation();
            const range = quill.getSelection(true);
            if (range.length)
                quill.deleteText(range.index, range.length, 'user');
            quill.insertText(range.index, plain, 'user');
            quill.setSelection(range.index + plain.length, 0, 'silent');
        };
        quill.root.addEventListener('keydown', markPlainPaste, true);
        quill.root.addEventListener('keyup', clearPlainPaste, true);
        quill.root.addEventListener('paste', handlePlainPaste, true);
        cleanupFns.push(() => {
            quill.root.removeEventListener('keydown', markPlainPaste, true);
            quill.root.removeEventListener('keyup', clearPlainPaste, true);
            quill.root.removeEventListener('paste', handlePlainPaste, true);
        });
    }
    const imageDeleteButton = document.createElement('button');
    imageDeleteButton.type = 'button';
    imageDeleteButton.className = 'ql-local-image-delete-button';
    imageDeleteButton.title = 'Delete image';
    imageDeleteButton.setAttribute('aria-label', 'Delete image');
    imageDeleteButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 6h18"></path>
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
    </svg>
  `;
    quill.container.appendChild(imageDeleteButton);
    let selectedLocalImage: HTMLImageElement | null = null;
    const hideImageDeleteButton = () => {
        selectedLocalImage = null;
        imageDeleteButton.classList.remove('is-visible');
    };
    const positionImageDeleteButton = () => {
        if (!selectedLocalImage || !selectedLocalImage.isConnected) {
            hideImageDeleteButton();
            return;
        }
        const imageRect = selectedLocalImage.getBoundingClientRect();
        const containerRect = quill.container.getBoundingClientRect();
        imageDeleteButton.style.top = `${Math.max(8, imageRect.top - containerRect.top + 8)}px`;
        imageDeleteButton.style.left = `${Math.max(8, imageRect.right - containerRect.left - 38)}px`;
        imageDeleteButton.classList.add('is-visible');
    };
    const selectLocalImage = (image: HTMLImageElement) => {
        selectedLocalImage = image;
        positionImageDeleteButton();
    };
    const handleEditorClickForImages = (event: MouseEvent) => {
        const target = event.target as HTMLElement | null;
        const image = target?.closest?.('img[data-local-asset-id]') as HTMLImageElement | null;
        if (image) {
            selectLocalImage(image);
            return;
        }
        if (!target?.closest?.('.ql-local-image-delete-button')) {
            hideImageDeleteButton();
        }
    };
    const handleImageDeleteMouseDown = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
    };
    const handleImageDeleteClick = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (!selectedLocalImage || !selectedLocalImage.isConnected) {
            hideImageDeleteButton();
            return;
        }
        const blot = Quill.find(selectedLocalImage);
        if (!blot) {
            hideImageDeleteButton();
            return;
        }
        const index = quill.getIndex(blot as any);
        quill.deleteText(index, 1, 'user');
        quill.setSelection(Math.max(0, index - 1), 0, 'silent');
        hideImageDeleteButton();
    };
    quill.root.addEventListener('click', handleEditorClickForImages);
    imageDeleteButton.addEventListener('mousedown', handleImageDeleteMouseDown);
    imageDeleteButton.addEventListener('click', handleImageDeleteClick);
    quill.root.addEventListener('scroll', positionImageDeleteButton);
    window.addEventListener('resize', positionImageDeleteButton);
    const handleCopy = (e: ClipboardEvent) => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0)
            return;
        const range = selection.getRangeAt(0);
        const container = document.createElement('div');
        container.appendChild(range.cloneContents());
        // Clean selection styles, dark mode colors, and background overlays
        const cleanCopiedHtml = (parent: HTMLElement) => {
            parent.querySelectorAll('*').forEach((node) => {
                const el = node as HTMLElement;
                // Strip background unless it's the yellow highlight color (#F8E68C)
                const bg = el.style.backgroundColor || el.style.background;
                if (!notesFormatting && bg && !bg.includes('#F8E68C') && !bg.includes('rgb(248, 230, 140)')) {
                    el.style.backgroundColor = '';
                    el.style.background = '';
                }
                // Strip text color so it inherits the target website's default text style
                if (!notesFormatting)
                    el.style.color = '';
                // Clean the style attribute string directly to remove remaining serialized styles
                const styleAttr = el.getAttribute('style');
                if (styleAttr && !notesFormatting) {
                    const cleanedStyle = styleAttr
                        .split(';')
                        .filter((rule) => {
                        const trimmed = rule.trim().toLowerCase();
                        if (trimmed.startsWith('background')) {
                            return trimmed.includes('#f8e68c') || trimmed.includes('rgb(248, 230, 140)');
                        }
                        if (trimmed.startsWith('color')) {
                            return false;
                        }
                        return true;
                    })
                        .join(';');
                    if (cleanedStyle) {
                        el.setAttribute('style', cleanedStyle);
                    }
                    else {
                        el.removeAttribute('style');
                    }
                }
            });
        };
        const images = container.querySelectorAll('img[data-local-asset-id]');
        // Prevent default copy behavior
        e.preventDefault();
        // Define async function to generate clipboard data
        const generateClipboardData = async () => {
            if (images.length > 0) {
                const promises = Array.from(images).map(async (img) => {
                    const assetId = img.getAttribute('data-local-asset-id');
                    if (!assetId)
                        return;
                    try {
                        const asset = await assetStore.getAsset(assetId);
                        const blob = asset?.blob;
                        if (blob) {
                            return new Promise<void>((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                    img.setAttribute('src', reader.result as string);
                                    resolve();
                                };
                                reader.readAsDataURL(blob);
                            });
                        }
                    }
                    catch (err) {
                        console.error('Failed to resolve asset for clipboard copy:', assetId, err);
                    }
                });
                await Promise.all(promises);
            }
            // Clean the HTML clone before outputting
            cleanCopiedHtml(container);
            return {
                html: container.innerHTML,
                text: selection.toString(),
            };
        };
        // Write to clipboard asynchronously using navigator.clipboard.write
        const textPromise = generateClipboardData().then((data) => new Blob([data.text], { type: 'text/plain' }));
        const htmlPromise = generateClipboardData().then((data) => new Blob([data.html], { type: 'text/html' }));
        navigator.clipboard.write([
            new ClipboardItem({
                'text/plain': textPromise,
                'text/html': htmlPromise,
            })
        ]).catch((err) => {
            console.error('Failed to write to clipboard via Async API:', err);
        });
    };
    quill.root.addEventListener('copy', handleCopy);
    cleanupFns.push(() => {
        quill.off('selection-change', updateImageSelectionBorders);
        quill.root.removeEventListener('click', handleEditorClickForImages);
        imageDeleteButton.removeEventListener('mousedown', handleImageDeleteMouseDown);
        imageDeleteButton.removeEventListener('click', handleImageDeleteClick);
        quill.root.removeEventListener('scroll', positionImageDeleteButton);
        window.removeEventListener('resize', positionImageDeleteButton);
        quill.root.removeEventListener('copy', handleCopy);
        imageDeleteButton.remove();
    });
    const handleTextChange = () => {
        const html = quill.root.innerHTML;
        onChange(html);
        positionImageDeleteButton();
        const text = quill.getText().trim();
        if (text && onKeyUpdate) {
            const suggestedKey = text.slice(0, 7).replace(/ /g, '_');
            onKeyUpdate(suggestedKey);
        }
    };
    quill.on('text-change', handleTextChange);
    cleanupFns.push(() => quill.off('text-change', handleTextChange));
    // @ key detection for variable dropdown trigger
    // Allow @ to be typed, trigger dropdown after
    if (onAtTrigger) {
        let atTriggered = false;
        const handleAtKeyUp = (event: KeyboardEvent) => {
            if (event.key === '@') {
                atTriggered = true;
                // @ was just typed - trigger dropdown
                const selection = quill.getSelection();
                if (selection) {
                    const bounds = quill.getBounds(selection.index);
                    if (bounds) {
                        const editorRect = quill.root.getBoundingClientRect();
                        onAtTrigger({
                            top: editorRect.top + bounds.top + bounds.height,
                            left: editorRect.left + bounds.left,
                        });
                    }
                }
            }
        };
        // Close dropdown when user types after @
        const handleTextChangeForAt = () => {
            if (atTriggered) {
                atTriggered = false;
            }
        };
        quill.root.addEventListener('keyup', handleAtKeyUp);
        quill.on('text-change', handleTextChangeForAt);
        cleanupFns.push(() => {
            quill.root.removeEventListener('keyup', handleAtKeyUp);
            quill.off('text-change', handleTextChangeForAt);
        });
    }
    if (toolbarSelector) {
        const toolbarEl = resolveToolbarTarget(toolbarSelector);
        if (toolbarEl) {
            let lastKnownRange = quill.getSelection();
            const ensureRange = () => {
                // Never steal focus away from the title input or any other text input/textarea
                const active = document.activeElement;
                if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
                    return null;
                }
                let range = quill.getSelection();
                if (!range && lastKnownRange) {
                    return null;
                }
                if (!range) {
                    return null;
                }
                lastKnownRange = range;
                return range;
            };
            const registerButton = (selector: string, handler: () => void) => {
                const button = toolbarEl.querySelector(selector) as HTMLButtonElement | null;
                if (!button)
                    return;
                const onMouseDown = (event: Event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    ensureRange();
                };
                const onClick = (event: Event) => {
                    event.preventDefault();
                    if (!quill.isEnabled())
                        return;
                    handler();
                    updateActiveStates();
                };
                button.addEventListener('mousedown', onMouseDown);
                button.addEventListener('click', onClick);
                cleanupFns.push(() => {
                    button.removeEventListener('mousedown', onMouseDown);
                    button.removeEventListener('click', onClick);
                });
            };
            const moreButton = toolbarEl.querySelector('.note-more-button') as HTMLButtonElement | null;
            const morePanel = toolbarEl.querySelector('.note-more-panel') as HTMLElement | null;
            if (moreButton && morePanel && !notesFormatting) {
                const keepEditorSelection = (event: MouseEvent) => event.preventDefault();
                const toggleMore = (event: MouseEvent) => {
                    event.preventDefault();
                    morePanel.hidden = !morePanel.hidden;
                    moreButton.setAttribute('aria-expanded', String(!morePanel.hidden));
                };
                const closeMore = (event: MouseEvent) => {
                    const path = event.composedPath();
                    if (!path.includes(moreButton) && !path.includes(morePanel)) {
                        morePanel.hidden = true;
                        moreButton.setAttribute('aria-expanded', 'false');
                    }
                };
                const closeAfterChoice = (event: Event) => {
                    if ((event.target as HTMLElement).closest('button, select, .ql-picker-item')) {
                        morePanel.hidden = true;
                        moreButton.setAttribute('aria-expanded', 'false');
                    }
                };
                const closeOnEscape = (event: KeyboardEvent) => {
                    if (event.key !== 'Escape' || morePanel.hidden)
                        return;
                    event.preventDefault();
                    morePanel.hidden = true;
                    moreButton.setAttribute('aria-expanded', 'false');
                    quill.focus();
                };
                moreButton.addEventListener('mousedown', keepEditorSelection);
                moreButton.addEventListener('click', toggleMore);
                morePanel.addEventListener('click', closeAfterChoice);
                morePanel.addEventListener('change', closeAfterChoice);
                document.addEventListener('mousedown', closeMore, true);
                document.addEventListener('keydown', closeOnEscape, true);
                cleanupFns.push(() => {
                    moreButton.removeEventListener('mousedown', keepEditorSelection);
                    moreButton.removeEventListener('click', toggleMore);
                    morePanel.removeEventListener('click', closeAfterChoice);
                    morePanel.removeEventListener('change', closeAfterChoice);
                    document.removeEventListener('mousedown', closeMore, true);
                    document.removeEventListener('keydown', closeOnEscape, true);
                });
            }
            // Keep custom buttons that are NOT handled by Quill natively
            registerButton('.ql-custom-add', () => {
                if (onCreateNew)
                    onCreateNew();
            });
            registerButton('.note-bullet-action', () => {
                const format = quill.getFormat();
                quill.format('list', format.list === 'bullet' ? false : 'bullet', 'user');
            });
            const headingOptions: Array<[
                string,
                number | false
            ]> = [
                ['normal', false], ['one', 1], ['two', 2], ['three', 3], ['four', 4]
            ];
            headingOptions.forEach(([name, level]) => {
                registerButton(`.note-heading-${name}`, () => {
                    const range = quill.getSelection(true);
                    quill.formatLine(range.index, Math.max(range.length, 1), 'header', level, 'user');
                });
            });
            registerButton('.note-insert-table', () => {
                insertNoteTable(quill);
            });
            registerButton('.note-divider', () => {
                const range = quill.getSelection(true);
                quill.insertEmbed(range.index, 'divider', true, 'user');
                quill.setSelection(range.index + 1, 0, 'silent');
            });
            registerButton('.note-insert-details', () => {
                const range = quill.getSelection(true);
                if (range.length)
                    quill.deleteText(range.index, range.length, 'user');
                quill.insertText(range.index, '\n', 'user');
                quill.clipboard.dangerouslyPasteHTML(range.index + 1, '<details class="note-details" open><summary data-note-open="open">Section</summary><div class="note-details-body"><br></div></details>', 'user');
            });
            if (notesFormatting) {
                const imageInput = document.createElement('input');
                imageInput.type = 'file';
                imageInput.accept = 'image/*';
                imageInput.hidden = true;
                toolbarEl.appendChild(imageInput);
                const saveSelectedImage = () => {
                    const file = imageInput.files?.[0];
                    if (file)
                        void handleImageFile(file);
                    imageInput.value = '';
                };
                imageInput.addEventListener('change', saveSelectedImage);
                registerButton('.note-insert-image', () => imageInput.click());
                cleanupFns.push(() => {
                    imageInput.removeEventListener('change', saveSelectedImage);
                    imageInput.remove();
                });
            }
            const boldBtn = toolbarEl.querySelector('.ql-bold') as HTMLElement | null;
            const italicBtn = toolbarEl.querySelector('.ql-italic') as HTMLElement | null;
            const underlineBtn = toolbarEl.querySelector('.ql-underline') as HTMLElement | null;
            const strikeBtn = toolbarEl.querySelector('.ql-strike') as HTMLElement | null;
            const blockquoteBtn = toolbarEl.querySelector('.ql-blockquote') as HTMLElement | null;
            const bulletBtn = toolbarEl.querySelector('button.ql-list[value="bullet"]') as HTMLElement | null;
            const bulletMenuBtn = toolbarEl.querySelector('.note-bullet-action') as HTMLElement | null;
            const orderedBtn = toolbarEl.querySelector('button.ql-list[value="ordered"]') as HTMLElement | null;
            const checklistBtn = toolbarEl.querySelector('button.ql-list[value="checked"]') as HTMLElement | null;
            const inlineCodeBtn = toolbarEl.querySelector('.ql-code') as HTMLElement | null;
            const codeBlockBtn = toolbarEl.querySelector('.ql-code-block') as HTMLElement | null;
            const linkBtn = toolbarEl.querySelector('.ql-link') as HTMLElement | null;
            const setActive = (el: HTMLElement | null, active: boolean) => {
                if (!el)
                    return;
                el.classList.toggle('ql-active', active);
            };
            const updateActiveStates = () => {
                // Prevent getFormat() from stealing focus back when Quill loses focus
                if (!quill.hasFocus())
                    return;
                const format = quill.getFormat();
                setActive(boldBtn, Boolean(format.bold));
                setActive(italicBtn, Boolean(format.italic));
                setActive(underlineBtn, Boolean(format.underline));
                setActive(strikeBtn, Boolean(format.strike));
                setActive(blockquoteBtn, Boolean(format.blockquote));
                setActive(bulletBtn, format.list === 'bullet');
                setActive(bulletMenuBtn, format.list === 'bullet');
                setActive(orderedBtn, format.list === 'ordered');
                setActive(checklistBtn, format.list === 'checked' || format.list === 'unchecked');
                setActive(inlineCodeBtn, Boolean(format.code));
                setActive(codeBlockBtn, Boolean(format['code-block']));
                setActive(linkBtn, Boolean(format.link));
            };
            const handleSelectionChange = (range: any) => {
                if (range) {
                    lastKnownRange = range;
                }
                updateActiveStates();
            };
            quill.on('selection-change', handleSelectionChange);
            quill.on('text-change', updateActiveStates);
            cleanupFns.push(() => {
                quill.off('selection-change', handleSelectionChange);
                quill.off('text-change', updateActiveStates);
            });
            updateActiveStates();
        }
    }
    if (notesFormatting) {
        const selectionToolbar = document.createElement('div');
        selectionToolbar.className = 'note-selection-toolbar';
        selectionToolbar.setAttribute('role', 'toolbar');
        selectionToolbar.setAttribute('aria-label', 'Selected text formatting');
        const icon = (component: typeof Bold) => renderToStaticMarkup(createElement(component, { size: 18, 'aria-hidden': true }));
        selectionToolbar.innerHTML = `
    <button type="button" class="note-style-trigger" title="Paragraph style" aria-label="Paragraph style" aria-expanded="false" aria-haspopup="menu">${icon(Type)}${icon(ChevronDown)}</button>
    <button type="button" data-format="bold" title="Bold" aria-label="Bold">${icon(Bold)}</button>
    <button type="button" data-format="italic" title="Italic" aria-label="Italic">${icon(Italic)}</button>
    <button type="button" data-format="strike" title="Strikethrough" aria-label="Strikethrough">${icon(Strikethrough)}</button>
    <button type="button" data-format="underline" title="Underline" aria-label="Underline">${icon(Underline)}</button>
    <button type="button" data-format="link" title="Link" aria-label="Link">${icon(LinkIcon)}</button>
    <span class="note-selection-separator" aria-hidden="true"></span>
    <button type="button" data-note-action="quote" title="Quote" aria-label="Quote">${icon(Quote)}</button>
    <button type="button" data-note-action="inline-code" title="Inline code" aria-label="Inline code">${icon(Code)}</button>
    <button type="button" data-note-action="code-block" title="Code block" aria-label="Code block">${icon(SquareCode)}</button>
    <button type="button" data-note-action="bullet" title="Bullet list" aria-label="Bullet list">${icon(List)}</button>
    <button type="button" data-note-action="ordered" title="Numbered list" aria-label="Numbered list">${icon(ListOrdered)}</button>
    <button type="button" data-note-action="checklist" title="Checklist" aria-label="Checklist">${icon(ListChecks)}</button>
    <button type="button" data-note-action="clear" title="Clear formatting" aria-label="Clear formatting">${icon(Eraser)}</button>
    <button type="button" data-note-action="divider" title="Divider" aria-label="Divider">${icon(Minus)}</button>
    <button type="button" data-note-action="section" title="Collapsible section" aria-label="Collapsible section">${icon(PanelsTopLeft)}</button>
    <button type="button" data-note-action="image" title="Insert image" aria-label="Insert image">${icon(ImageIcon)}</button>
    <button type="button" data-note-action="table" title="Insert table" aria-label="Insert table">${icon(Table2)}</button>
    <button type="button" class="note-floating-more-trigger" title="More formatting" aria-label="More formatting" aria-expanded="false" aria-haspopup="menu">${icon(Ellipsis)}</button>
  `;
        const styleButton = selectionToolbar.querySelector('.note-style-trigger') as HTMLButtonElement;
        const floatingMoreButton = selectionToolbar.querySelector('.note-floating-more-trigger') as HTMLButtonElement;
        const sourceMorePanel = toolbarEl.querySelector('.note-more-panel') as HTMLElement | null;
        const stylePanel = document.createElement('span');
        stylePanel.className = 'note-style-panel';
        stylePanel.hidden = true;
        stylePanel.setAttribute('role', 'menu');
        stylePanel.setAttribute('aria-label', 'Paragraph styles');
        sourceMorePanel?.querySelectorAll<HTMLButtonElement>('.note-heading-option').forEach(option => {
            const entry = option.cloneNode(true) as HTMLButtonElement;
            entry.insertAdjacentHTML('beforeend', `<span class="note-style-check">${icon(Check)}</span>`);
            stylePanel.appendChild(entry);
        });
        selectionToolbar.appendChild(stylePanel);
        const floatingMorePanel = sourceMorePanel?.cloneNode(true) as HTMLElement | undefined;
        if (floatingMorePanel) {
            floatingMorePanel.classList.add('note-floating-more-panel');
            floatingMorePanel.hidden = true;
            floatingMorePanel.setAttribute('role', 'menu');
            floatingMorePanel.setAttribute('aria-label', 'All formatting options');
            selectionToolbar.appendChild(floatingMorePanel);
        }
        // Keep the toolbar inside the functional theme scope, including Alt+S Shadow DOM.
        const selectionHost = container.closest<HTMLElement>('[data-note-editor-surface]') || container;
        selectionHost.appendChild(selectionToolbar);
        selectionToolbar.setAttribute('popover', 'manual');
        let selectingText = false;
        let lastToolbarDiagnostic = '';
        const logToolbarState = (reason: string, range?: { index: number; length: number } | null, extra: Record<string, unknown> = {}) => {
            const snapshot = {
                reason, range: range ? { index: range.index, length: range.length } : null,
                dragging: selectingText, enabled: quill.isEnabled(), focused: quill.hasFocus(),
                linkEditorOpen: quill.root.dataset.linkEditorOpen === 'true',
                activeElement: (quill.root.getRootNode() as Document | ShadowRoot).activeElement?.tagName,
                popoverSupported: typeof selectionToolbar.showPopover === 'function',
                ...extra,
            };
            const signature = JSON.stringify(snapshot);
            if (signature === lastToolbarDiagnostic) return;
            lastToolbarDiagnostic = signature;
            console.info('[NotesSelectionToolbar]', snapshot);
        };
        logToolbarState('initialized');
        const hideSelectionToolbar = () => {
            if (selectionToolbar.matches(':popover-open')) selectionToolbar.hidePopover();
            selectionToolbar.style.display = 'none';
        };
        let selectedRange: {
            index: number;
            length: number;
        } | null = null;
        let interactingWithSelectionToolbar = false;
        const fitSelectionActions = (availableWidth: number) => {
            const actions = Array.from(selectionToolbar.querySelectorAll<HTMLButtonElement>(':scope > button[data-format], :scope > button[data-note-action]'));
            actions.forEach(button => { button.hidden = false; });
            floatingMoreButton.hidden = false;
            const separator = selectionToolbar.querySelector<HTMLElement>('.note-selection-separator');
            if (separator) separator.hidden = false;
            const removed: HTMLButtonElement[] = [];
            const toolbarStyle = getComputedStyle(selectionToolbar);
            const fixedWidth = styleButton.offsetWidth + floatingMoreButton.offsetWidth
                + (separator ? separator.getBoundingClientRect().width
                    + parseFloat(getComputedStyle(separator).marginLeft) + parseFloat(getComputedStyle(separator).marginRight) : 0)
                + parseFloat(toolbarStyle.paddingLeft) + parseFloat(toolbarStyle.paddingRight)
                + parseFloat(toolbarStyle.borderLeftWidth) + parseFloat(toolbarStyle.borderRightWidth);
            while (fixedWidth + actions.reduce((width, button) => width + button.offsetWidth, 0) > availableWidth && actions.length) {
                const button = actions.pop()!;
                button.hidden = true;
                removed.unshift(button);
            }
            if (separator) separator.hidden = !actions.some(button => button.dataset.noteAction);
            floatingMoreButton.hidden = removed.length === 0;
            if (floatingMorePanel) {
                floatingMorePanel.replaceChildren(...removed.map(button => {
                    const entry = button.cloneNode(true) as HTMLButtonElement;
                    entry.hidden = false;
                    entry.textContent = button.getAttribute('aria-label');
                    entry.setAttribute('role', 'menuitem');
                    return entry;
                }));
            }
        };
        const closeSelectionMenus = () => {
            stylePanel.hidden = true;
            if (floatingMorePanel)
                floatingMorePanel.hidden = true;
            styleButton.setAttribute('aria-expanded', 'false');
            floatingMoreButton.setAttribute('aria-expanded', 'false');
        };
        const positionSelectionMenu = (panel: HTMLElement) => {
            panel.style.top = '100%';
            panel.style.bottom = 'auto';
            const toolbarBounds = selectionToolbar.getBoundingClientRect();
            if (toolbarBounds.bottom + panel.offsetHeight > window.innerHeight - 8
                && toolbarBounds.top > panel.offsetHeight) {
                panel.style.top = 'auto';
                panel.style.bottom = '100%';
            }
        };
        const positionSelectionToolbar = (range?: {
            index: number;
            length: number;
        } | null) => {
            if (selectingText) { logToolbarState('hidden: dragging', range); return; }
            if (quill.root.dataset.linkEditorOpen === 'true') {
                logToolbarState('hidden: link editor open', range);
                hideSelectionToolbar();
                closeSelectionMenus();
                return;
            }
            const current = range === undefined ? quill.getSelection() : range;
            const selectionRoot = quill.root.getRootNode() as Document | ShadowRoot;
            const browserSelection = 'getSelection' in selectionRoot ? (selectionRoot as Document).getSelection() : window.getSelection();
            const editorSelection = Boolean(browserSelection?.rangeCount && !browserSelection.isCollapsed
                && quill.root.contains(browserSelection.getRangeAt(0).commonAncestorContainer));
            if (!quill.isEnabled() || !current?.length || (!quill.hasFocus() && !editorSelection)) {
                logToolbarState('hidden: selection/focus check', current, {
                    nativeSelectionInEditor: editorSelection,
                    nativeRangeCount: browserSelection?.rangeCount ?? 0,
                    nativeCollapsed: browserSelection?.isCollapsed ?? null,
                });
                const active = (selectionToolbar.getRootNode() as Document | ShadowRoot).activeElement;
                if (selectedRange && (interactingWithSelectionToolbar || (active && selectionToolbar.contains(active))))
                    return;
                hideSelectionToolbar();
                closeSelectionMenus();
                selectedRange = null;
                return;
            }
            selectedRange = { index: current.index, length: current.length };
            selectionToolbar.style.display = 'flex';
            try {
                if (!selectionToolbar.matches(':popover-open')) selectionToolbar.showPopover();
            } catch (error) {
                console.error('[NotesSelectionToolbar] Failed to open popover', error);
                logToolbarState('error: opening popover', current);
                return;
            }
            const readingViewport = quill.root.closest('.ql-container')?.getBoundingClientRect();
            fitSelectionActions(Math.min(window.innerWidth, readingViewport?.width || window.innerWidth)
                - 2 * parseFloat(getComputedStyle(selectionToolbar).getPropertyValue('--note-toolbar-gap')));
            const activeFormats = quill.getFormat(current);
            selectionToolbar.querySelectorAll<HTMLButtonElement>('button[data-format]').forEach(button => {
                const format = button.dataset.format || '';
                const active = Boolean(activeFormats[format]);
                button.classList.toggle('is-active', active);
                button.setAttribute('aria-pressed', String(active));
            });
            const blockActions: Record<string, boolean> = {
                quote: Boolean(activeFormats.blockquote),
                'inline-code': Boolean(activeFormats.code),
                'code-block': Boolean(activeFormats['code-block']),
                bullet: activeFormats.list === 'bullet',
                ordered: activeFormats.list === 'ordered',
                checklist: activeFormats.list === 'checked' || activeFormats.list === 'unchecked',
            };
            selectionToolbar.querySelectorAll<HTMLButtonElement>(':scope > button[data-note-action]').forEach(button => {
                const active = blockActions[button.dataset.noteAction || ''] || false;
                button.classList.toggle('is-active', active);
                button.setAttribute('aria-pressed', String(active));
            });
            const heading = Number(activeFormats.header) || 0;
            styleButton.setAttribute('title', heading ? `Heading ${heading}` : 'Paragraph style');
            styleButton.setAttribute('aria-label', heading ? `Paragraph style: Heading ${heading}` : 'Paragraph style: Normal');
            stylePanel.querySelectorAll<HTMLButtonElement>('.note-heading-option').forEach(option => {
                const chosen = option.dataset.noteAction === (heading ? `heading-${heading}` : 'normal');
                option.classList.toggle('is-active', chosen);
                option.setAttribute('aria-selected', String(chosen));
            });
            const bounds = quill.getBounds(current.index, current.length);
            if (!bounds) {
                logToolbarState('hidden: Quill bounds unavailable', current);
                hideSelectionToolbar();
                return;
            }
            const editorBounds = quill.root.getBoundingClientRect();
            const root = quill.root.getRootNode() as Document | ShadowRoot;
            const nativeSelection = 'getSelection' in root ? (root as Document).getSelection() : window.getSelection();
            const nativeRange = nativeSelection?.rangeCount ? nativeSelection.getRangeAt(0) : null;
            const rectangles = nativeRange && quill.root.contains(nativeRange.commonAncestorContainer)
                ? Array.from(nativeRange.getClientRects()) : [];
            const viewport = quill.root.closest('.ql-container')?.getBoundingClientRect() || editorBounds;
            const visible = rectangles.filter(rect => rect.width > 0 && rect.bottom > Math.max(0, viewport.top)
                && rect.top < Math.min(window.innerHeight, viewport.bottom));
            const anchor = visible[0] || (rectangles.length ? null : {
                left: editorBounds.left + bounds.left, right: editorBounds.left + bounds.right,
                top: editorBounds.top + bounds.top, bottom: editorBounds.top + bounds.bottom,
            });
            if (!anchor) {
                logToolbarState('hidden: selection outside viewport', current, { rectangles: rectangles.length, visibleRectangles: visible.length });
                hideSelectionToolbar(); return;
            }
            const gap = parseFloat(getComputedStyle(selectionToolbar).getPropertyValue('--note-toolbar-gap'));
            const width = selectionToolbar.offsetWidth;
            const height = selectionToolbar.offsetHeight;
            const minLeft = Math.max(gap, viewport.left + gap);
            const maxRight = Math.min(window.innerWidth - gap, viewport.right - gap);
            const left = Math.max(gap, Math.min(Math.max(minLeft, (anchor.left + anchor.right - width) / 2), maxRight - width));
            const above = anchor.top - height - gap;
            const top = above >= Math.max(gap, viewport.top + gap) ? above : anchor.bottom + gap;
            selectionToolbar.style.left = `${left}px`;
            selectionToolbar.style.top = `${Math.max(gap, Math.min(top, window.innerHeight - height - gap))}px`;
            logToolbarState('shown', current, {
                left: selectionToolbar.style.left, top: selectionToolbar.style.top, width, height, gap,
                popoverOpen: selectionToolbar.matches(':popover-open'),
                nativeRectangles: rectangles.length, visibleRectangles: visible.length,
            });
        };
        const handleSelectionToolbarMouseDown = (event: MouseEvent) => {
            interactingWithSelectionToolbar = true;
            if ((event.target as HTMLElement)?.closest('button'))
                event.preventDefault();
        };
        const handleSelectionOutsideMouseDown = (event: MouseEvent) => {
            if (event.composedPath().includes(selectionToolbar))
                return;
            interactingWithSelectionToolbar = false;
            closeSelectionMenus();
            if (!quill.hasFocus())
                positionSelectionToolbar(null);
        };
        const handleSelectionMenuEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || (stylePanel.hidden && (!floatingMorePanel || floatingMorePanel.hidden)))
                return;
            event.preventDefault();
            closeSelectionMenus();
            interactingWithSelectionToolbar = false;
            quill.focus();
        };
        const handleSelectionMenuKeyDown = (event: KeyboardEvent) => {
            const panel = !stylePanel.hidden ? stylePanel : floatingMorePanel && !floatingMorePanel.hidden ? floatingMorePanel : null;
            if (!panel || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp'))
                return;
            const options = Array.from(panel.querySelectorAll<HTMLButtonElement>('button[data-note-action], button[data-format]'));
            if (!options.length)
                return;
            event.preventDefault();
            interactingWithSelectionToolbar = true;
            const index = options.indexOf((selectionToolbar.getRootNode() as Document | ShadowRoot).activeElement as HTMLButtonElement);
            const next = index < 0
                ? event.key === 'ArrowDown' ? 0 : options.length - 1
                : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
            options[next].focus();
        };
        const handleSelectionToolbarClick = (event: MouseEvent) => {
            const button = (event.target as HTMLElement)?.closest<HTMLButtonElement>('button');
            if (!button || !selectedRange)
                return;
            event.preventDefault();
            if (button === styleButton) {
                stylePanel.hidden = !stylePanel.hidden;
                if (floatingMorePanel)
                    floatingMorePanel.hidden = true;
                if (!stylePanel.hidden)
                    positionSelectionMenu(stylePanel);
                styleButton.setAttribute('aria-expanded', String(!stylePanel.hidden));
                floatingMoreButton.setAttribute('aria-expanded', 'false');
                return;
            }
            if (button === floatingMoreButton) {
                if (!floatingMorePanel)
                    return;
                floatingMorePanel.hidden = !floatingMorePanel.hidden;
                stylePanel.hidden = true;
                if (!floatingMorePanel.hidden) {
                    floatingMorePanel.querySelectorAll<HTMLButtonElement>('button[data-note-action]').forEach(option => {
                        const original = sourceMorePanel?.querySelector<HTMLButtonElement>(`button[data-note-action="${option.dataset.noteAction}"]`);
                        option.classList.toggle('ql-active', Boolean(original?.classList.contains('ql-active')));
                        if (original) option.disabled = original.disabled;
                    });
                    positionSelectionMenu(floatingMorePanel);
                }
                floatingMoreButton.setAttribute('aria-expanded', String(!floatingMorePanel.hidden));
                styleButton.setAttribute('aria-expanded', 'false');
                return;
            }
            const command = button.dataset.noteAction;
            if (command) {
                const original = sourceMorePanel?.querySelector<HTMLButtonElement>(`button[data-note-action="${command}"]`);
                original?.click();
                closeSelectionMenus();
                interactingWithSelectionToolbar = false;
                positionSelectionToolbar();
                return;
            }
            const format = button.dataset.format;
            if (format === 'link') {
                const footerLink = toolbarEl.querySelector('.ql-link') as HTMLButtonElement | null;
                footerLink?.click();
                interactingWithSelectionToolbar = false;
                return;
            }
            if (!format)
                return;
            const current = quill.getFormat(selectedRange);
            quill.formatText(selectedRange.index, selectedRange.length, format, !current[format], 'user');
            quill.setSelection(selectedRange.index, selectedRange.length, 'silent');
            interactingWithSelectionToolbar = false;
            positionSelectionToolbar(selectedRange);
        };
        selectionToolbar.addEventListener('mousedown', handleSelectionToolbarMouseDown);
        selectionToolbar.addEventListener('click', handleSelectionToolbarClick);
        selectionToolbar.addEventListener('keydown', handleSelectionMenuKeyDown);
        document.addEventListener('mousedown', handleSelectionOutsideMouseDown, true);
        document.addEventListener('keydown', handleSelectionMenuEscape, true);
        const refreshSelectionToolbar = () => positionSelectionToolbar();
        quill.root.addEventListener('note-link-editor-change', refreshSelectionToolbar);
        const startSelection = (event: PointerEvent) => {
            if (event.button !== 0) return;
            selectingText = true;
            logToolbarState('drag started');
            hideSelectionToolbar();
            closeSelectionMenus();
        };
        let selectionFrame = 0;
        const refreshNativeSelection = () => {
            if (selectingText || interactingWithSelectionToolbar) return;
            cancelAnimationFrame(selectionFrame);
            selectionFrame = requestAnimationFrame(refreshSelectionToolbar);
        };
        const finishSelection = () => {
            if (!selectingText) return;
            selectingText = false;
            logToolbarState('drag finished', quill.getSelection());
            cancelAnimationFrame(selectionFrame);
            selectionFrame = requestAnimationFrame(refreshSelectionToolbar);
        };
        quill.root.addEventListener('pointerdown', startSelection);
        document.addEventListener('pointerup', finishSelection, true);
        document.addEventListener('pointercancel', finishSelection, true);
        document.addEventListener('selectionchange', refreshNativeSelection);
        window.addEventListener('blur', finishSelection);
        document.addEventListener('scroll', refreshSelectionToolbar, true);
        const scrollContainer = quill.root.closest('.ql-container');
        scrollContainer?.addEventListener('scroll', refreshSelectionToolbar);
        quill.on('selection-change', positionSelectionToolbar);
        quill.root.addEventListener('scroll', refreshSelectionToolbar);
        window.addEventListener('resize', refreshSelectionToolbar);
        cleanupFns.push(() => {
            selectionToolbar.removeEventListener('mousedown', handleSelectionToolbarMouseDown);
            selectionToolbar.removeEventListener('click', handleSelectionToolbarClick);
            selectionToolbar.removeEventListener('keydown', handleSelectionMenuKeyDown);
            document.removeEventListener('mousedown', handleSelectionOutsideMouseDown, true);
            document.removeEventListener('keydown', handleSelectionMenuEscape, true);
            quill.off('selection-change', positionSelectionToolbar);
            quill.root.removeEventListener('note-link-editor-change', refreshSelectionToolbar);
            cancelAnimationFrame(selectionFrame);
            quill.root.removeEventListener('pointerdown', startSelection);
            document.removeEventListener('pointerup', finishSelection, true);
            document.removeEventListener('pointercancel', finishSelection, true);
            document.removeEventListener('selectionchange', refreshNativeSelection);
            window.removeEventListener('blur', finishSelection);
            document.removeEventListener('scroll', refreshSelectionToolbar, true);
            scrollContainer?.removeEventListener('scroll', refreshSelectionToolbar);
            quill.root.removeEventListener('scroll', refreshSelectionToolbar);
            window.removeEventListener('resize', refreshSelectionToolbar);
            selectionToolbar.remove();
        });
        const slashMenu = document.createElement('div');
        slashMenu.className = 'note-slash-menu';
        slashMenu.setAttribute('role', 'listbox');
        slashMenu.setAttribute('aria-label', 'Insert note block');
        selectionHost.appendChild(slashMenu);
        const slashItems: Array<{
            label: string;
            format: string;
            value: any;
        }> = [
            { label: 'Normal text', format: 'header', value: false },
            { label: 'Heading 1', format: 'header', value: 1 },
            { label: 'Heading 2', format: 'header', value: 2 },
            { label: 'Heading 3', format: 'header', value: 3 },
            { label: 'Heading 4', format: 'header', value: 4 },
            { label: 'Bullet list', format: 'list', value: 'bullet' },
            { label: 'Numbered list', format: 'list', value: 'ordered' },
            { label: 'Checklist', format: 'list', value: 'checked' },
            { label: 'Quote', format: 'blockquote', value: true },
            { label: 'Code block', format: 'code-block', value: true },
            { label: 'Inline code', format: 'code', value: true },
            { label: 'Link', format: 'link', value: true },
            { label: 'Divider', format: 'divider', value: true },
            { label: 'Collapsible section', format: 'details', value: true },
            { label: 'Image', format: 'image', value: true }
        ];
        let slashStart = -1;
        let slashSelected = 0;
        let visibleSlashItems = slashItems;
        const hideSlashMenu = () => { slashMenu.style.display = 'none'; slashStart = -1; };
        const updateSlashMenu = () => {
            const range = quill.getSelection();
            if (!quill.isEnabled() || !range || range.length || !quill.hasFocus()) {
                hideSlashMenu();
                return;
            }
            const [, offset] = quill.getLine(range.index);
            const before = quill.getText(range.index - offset, offset);
            const match = before.match(/^\/([a-z0-9-]*)$/i);
            if (!match) {
                hideSlashMenu();
                return;
            }
            slashStart = range.index - match[0].length;
            visibleSlashItems = slashItems.filter(item => item.label.toLowerCase().includes(match[1].toLowerCase()));
            if (!visibleSlashItems.length) {
                hideSlashMenu();
                return;
            }
            slashSelected = Math.min(slashSelected, visibleSlashItems.length - 1);
            slashMenu.replaceChildren(...visibleSlashItems.map((item, index) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = item.label;
                button.dataset.index = String(index);
                button.setAttribute('role', 'option');
                button.setAttribute('aria-selected', String(index === slashSelected));
                if (index === slashSelected)
                    button.classList.add('is-active');
                return button;
            }));
            slashMenu.style.display = 'block';
            const caret = quill.getBounds(range.index);
            if (!caret) {
                hideSlashMenu();
                return;
            }
            const editorBounds = quill.root.getBoundingClientRect();
            slashMenu.style.left = `${Math.max(8, Math.min(editorBounds.left + caret.left, window.innerWidth - slashMenu.offsetWidth - 8))}px`;
            slashMenu.style.top = `${Math.max(8, editorBounds.top + caret.bottom)}px`;
        };
        const applySlashItem = (index: number) => {
            const item = visibleSlashItems[index];
            const range = quill.getSelection();
            if (!item || !range || slashStart < 0)
                return;
            quill.deleteText(slashStart, range.index - slashStart, 'user');
            quill.setSelection(slashStart, 0, 'silent');
            if (item.format === 'divider') {
                quill.insertEmbed(slashStart, 'divider', true, 'user');
                quill.setSelection(slashStart + 1, 0, 'silent');
            }
            else if (item.format === 'details') {
                quill.clipboard.dangerouslyPasteHTML(slashStart, '<details class="note-details" open><summary data-note-open="open">Section</summary><div class="note-details-body"><br></div></details>', 'user');
            }
            else if (item.format === 'image') {
                (toolbarEl.querySelector('.note-insert-image') as HTMLButtonElement | null)?.click();
            }
            else if (item.format === 'code') {
                quill.format('code', true, 'user');
            }
            else if (item.format === 'link') {
                (toolbarEl.querySelector('.ql-link') as HTMLButtonElement | null)?.click();
            }
            else {
                quill.formatLine(slashStart, 1, item.format, item.value, 'user');
            }
            hideSlashMenu();
        };
        const handleSlashKeyDown = (event: KeyboardEvent) => {
            if (slashStart < 0 || slashMenu.style.display === 'none')
                return;
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                event.stopPropagation();
                slashSelected = (slashSelected + (event.key === 'ArrowDown' ? 1 : -1) + visibleSlashItems.length) % visibleSlashItems.length;
                Array.from(slashMenu.querySelectorAll('button')).forEach((button, index) => {
                    button.classList.toggle('is-active', index === slashSelected);
                    button.setAttribute('aria-selected', String(index === slashSelected));
                });
            }
            else if (event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                applySlashItem(slashSelected);
            }
            else if (event.key === 'Escape') {
                event.preventDefault();
                hideSlashMenu();
            }
        };
        const handleSlashClick = (event: MouseEvent) => {
            const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-index]');
            if (button)
                applySlashItem(Number(button.dataset.index));
        };
        slashMenu.addEventListener('mousedown', event => event.preventDefault());
        slashMenu.addEventListener('click', handleSlashClick);
        quill.root.addEventListener('keydown', handleSlashKeyDown, true);
        quill.on('text-change', updateSlashMenu);
        quill.on('selection-change', updateSlashMenu);
        cleanupFns.push(() => {
            slashMenu.removeEventListener('click', handleSlashClick);
            quill.root.removeEventListener('keydown', handleSlashKeyDown, true);
            quill.off('text-change', updateSlashMenu);
            quill.off('selection-change', updateSlashMenu);
            slashMenu.remove();
        });
    }
    // Hide the default select-to-delete button so it doesn't conflict with our hover toolbar
    if (imageDeleteButton) {
        imageDeleteButton.style.display = 'none';
    }
    const linkInteractionCleanup = setupLinkInteractions(quill, container, Quill, toolbarEl, Boolean(readOnly), notesFormatting);
    cleanupFns.push(linkInteractionCleanup);
    if (notesFormatting) {
        cleanupFns.push(setupNoteFooterMenus(quill, toolbarEl));
        cleanupFns.push(setupNoteTableControls(quill, container, Quill));
    }
    const imageInteractionCleanup = setupImageInteractions(quill, container, Quill);
    cleanupFns.push(imageInteractionCleanup);
    return () => {
        cleanupFns.forEach(fn => fn());
    };
};
function setupLinkInteractions(quill: any, wrapper: HTMLDivElement, Quill: any, toolbarEl: HTMLElement, readOnly: boolean, notesFormatting: boolean) {
    const cleanupFns: Array<() => void> = [];
    if (notesFormatting) {
        const blockHistoryShortcut = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        };
        quill.root.addEventListener('keydown', blockHistoryShortcut, true);
        cleanupFns.push(() => quill.root.removeEventListener('keydown', blockHistoryShortcut, true));
    }
    const popover = document.createElement('div');
    popover.className = 'ql-link-popover';
    popover.setAttribute('aria-hidden', 'true');
    popover.innerHTML = `
    <input class="ql-link-popover-input" type="url" placeholder="Enter link URL" aria-label="Link URL" />
    <div class="ql-link-popover-divider" aria-hidden="true"></div>
    <button class="ql-link-popover-button ql-link-popover-open" type="button" title="Open link" aria-label="Open link">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
      </svg>
    </button>
    <button class="ql-link-popover-button ql-link-popover-remove" type="button" title="Remove link" aria-label="Remove link">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path>
      </svg>
    </button>
  `;
    wrapper.appendChild(popover);
    const preview = document.createElement('div');
    preview.className = 'ql-link-preview';
    preview.setAttribute('aria-hidden', 'true');
    wrapper.appendChild(preview);
    const input = popover.querySelector('.ql-link-popover-input') as HTMLInputElement;
    const openButton = popover.querySelector('.ql-link-popover-open') as HTMLButtonElement;
    const removeButton = popover.querySelector('.ql-link-popover-remove') as HTMLButtonElement;
    let activeRange: {
        index: number;
        length: number;
    } | null = null;
    let hoveredLink: HTMLAnchorElement | null = null;
    let isInteractingWithPopover = false;
    let hideTimer: number | null = null;
    const clearHideTimer = () => {
        if (hideTimer !== null) {
            window.clearTimeout(hideTimer);
            hideTimer = null;
        }
    };
    const hidePopover = () => {
        clearHideTimer();
        activeRange = null;
        popover.classList.remove('is-visible', 'has-link');
        popover.setAttribute('aria-hidden', 'true');
        delete quill.root.dataset.linkEditorOpen;
        quill.root.dispatchEvent(new Event('note-link-editor-change'));
    };
    const hidePreview = () => {
        hoveredLink = null;
        preview.classList.remove('is-visible');
        preview.setAttribute('aria-hidden', 'true');
    };
    const positionPreview = (anchor: HTMLAnchorElement) => {
        const anchorRect = anchor.getBoundingClientRect();
        const wrapperRect = wrapper.getBoundingClientRect();
        const previewWidth = preview.offsetWidth || 180;
        const previewHeight = preview.offsetHeight || 42;
        const left = anchorRect.left - wrapperRect.left + anchorRect.width / 2 - previewWidth / 2;
        const topAbove = anchorRect.top - wrapperRect.top - previewHeight - 8;
        const topBelow = anchorRect.bottom - wrapperRect.top + 8;
        preview.style.left = `${Math.max(8, Math.min(left, wrapperRect.width - previewWidth - 8))}px`;
        preview.style.top = `${Math.max(8, topAbove < 8 ? topBelow : topAbove)}px`;
    };
    const getPreviewLabel = (url: string) => {
        try {
            const parsed = new URL(normalizeLinkUrl(url));
            return parsed.hostname.replace(/^www\./, '') || parsed.href;
        }
        catch {
            return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
        }
    };
    const showPreview = (anchor: HTMLAnchorElement) => {
        if (popover.classList.contains('is-visible'))
            return;
        hoveredLink = anchor;
        const url = anchor.getAttribute('href') || anchor.href || '';
        preview.textContent = getPreviewLabel(url);
        preview.classList.add('is-visible');
        preview.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(() => {
            if (hoveredLink === anchor)
                positionPreview(anchor);
        });
    };
    const findLinkAtRange = (range: {
        index: number;
        length: number;
    }) => {
        const sampleLength = Math.max(1, range.length || 1);
        const format = quill.getFormat(range.index, sampleLength);
        return typeof format.link === 'string' ? format.link : '';
    };
    const findLinkedTextRange = (range: {
        index: number;
        length: number;
    }, linkUrl: string) => {
        if (!linkUrl)
            return range;
        const docLength = Math.max(0, quill.getLength() - 1);
        let start = range.index;
        let end = Math.min(docLength, range.index + Math.max(1, range.length || 1));
        while (start > 0 && quill.getFormat(start - 1, 1).link === linkUrl) {
            start -= 1;
        }
        while (end < docLength && quill.getFormat(end, 1).link === linkUrl) {
            end += 1;
        }
        return { index: start, length: Math.max(1, end - start) };
    };
    const selectWordAtRange = (range: {
        index: number;
        length: number;
    }) => {
        if (range.length > 0)
            return range;
        const text = quill.getText();
        const docLength = Math.max(0, quill.getLength() - 1);
        let start = Math.min(range.index, docLength);
        let end = start;
        while (start > 0 && /[^\s]/.test(text[start - 1])) {
            start -= 1;
        }
        while (end < docLength && /[^\s]/.test(text[end])) {
            end += 1;
        }
        if (end <= start)
            return null;
        return { index: start, length: end - start };
    };
    const getEditorIndexFromPoint = (event: MouseEvent) => {
        const ownerDocument = quill.root.ownerDocument || document;
        let range: Range | null = null;
        if (typeof ownerDocument.caretRangeFromPoint === 'function') {
            range = ownerDocument.caretRangeFromPoint(event.clientX, event.clientY);
        }
        else {
            const caretPosition = ownerDocument.caretPositionFromPoint?.(event.clientX, event.clientY);
            if (caretPosition) {
                const fallbackRange = ownerDocument.createRange();
                fallbackRange.setStart(caretPosition.offsetNode, caretPosition.offset);
                range = fallbackRange;
            }
        }
        const resolvedRange = range;
        if (!resolvedRange || !quill.root.contains(resolvedRange.startContainer))
            return null;
        const preCaretRange = ownerDocument.createRange();
        preCaretRange.selectNodeContents(quill.root);
        preCaretRange.setEnd(resolvedRange.startContainer, resolvedRange.startOffset);
        return preCaretRange.toString().length;
    };
    const selectWordAtPoint = (event: MouseEvent) => {
        const pointIndex = getEditorIndexFromPoint(event);
        if (pointIndex === null)
            return null;
        return selectWordAtRange({ index: pointIndex, length: 0 });
    };
    const positionPopover = (range: {
        index: number;
        length: number;
    }) => {
        const bounds = quill.getBounds(range.index, range.length);
        if (!bounds)
            return;
        const wrapperRect = wrapper.getBoundingClientRect();
        const quillRect = quill.container.getBoundingClientRect();
        const width = Math.min(popover.offsetWidth || 420, Math.max(240, wrapperRect.width - 16));
        const leftFromQuill = quillRect.left - wrapperRect.left + bounds.left + bounds.width / 2 - width / 2;
        const topFromQuill = quillRect.top - wrapperRect.top + bounds.top - (popover.offsetHeight || 50) - 10;
        const left = Math.max(8, Math.min(leftFromQuill, wrapperRect.width - width - 8));
        const top = topFromQuill < 8
            ? quillRect.top - wrapperRect.top + bounds.bottom + 10
            : topFromQuill;
        popover.style.left = `${left}px`;
        popover.style.top = `${Math.max(8, top)}px`;
    };
    const showPopover = (range: {
        index: number;
        length: number;
    }, shouldFocusInput = false) => {
        if (readOnly)
            return;
        clearHideTimer();
        hidePreview();
        const linkUrl = findLinkAtRange(range);
        activeRange = findLinkedTextRange(range, linkUrl);
        input.value = linkUrl;
        openButton.disabled = !linkUrl;
        removeButton.disabled = !linkUrl;
        popover.classList.toggle('has-link', Boolean(linkUrl));
        popover.classList.add('is-visible');
        popover.setAttribute('aria-hidden', 'false');
        quill.root.dataset.linkEditorOpen = 'true';
        quill.root.dispatchEvent(new Event('note-link-editor-change'));
        requestAnimationFrame(() => {
            if (activeRange)
                positionPopover(activeRange);
            if (shouldFocusInput) {
                input.focus();
                input.setSelectionRange(input.value.length, input.value.length);
            }
        });
    };
    const applyLink = () => {
        if (!activeRange)
            return;
        const url = normalizeLinkUrl(input.value);
        quill.focus();
        quill.setSelection(activeRange.index, activeRange.length, 'silent');
        if (url && activeRange.length === 0) {
            quill.insertText(activeRange.index, url, { link: url }, 'user');
            quill.setSelection(activeRange.index + url.length, 0, 'silent');
            hidePopover();
            return;
        }
        if (url) {
            quill.formatText(activeRange.index, activeRange.length, 'link', url, 'user');
        }
        else {
            quill.formatText(activeRange.index, activeRange.length, 'link', false, 'user');
        }
        quill.setSelection(activeRange.index + activeRange.length, 0, 'silent');
        hidePopover();
    };
    const removeLink = () => {
        if (!activeRange)
            return;
        quill.focus();
        quill.formatText(activeRange.index, activeRange.length, 'link', false, 'user');
        quill.setSelection(activeRange.index + activeRange.length, 0, 'silent');
        hidePopover();
    };
    const handleSelectionChange = (range: {
        index: number;
        length: number;
    } | null) => {
        if (readOnly || isInteractingWithPopover || popover.contains(document.activeElement))
            return;
        if (!range || range.length <= 0) {
            hideTimer = window.setTimeout(hidePopover, 120);
        }
    };
    const handleDoubleClick = (event: MouseEvent) => {
        if (readOnly || notesFormatting)
            return;
        const target = event.target as HTMLElement | null;
        if (target?.closest?.('img[data-local-asset-id]'))
            return;
        const wordRange = selectWordAtPoint(event);
        if (wordRange) {
            event.preventDefault();
            quill.focus();
            quill.setSelection(wordRange.index, wordRange.length, 'user');
            showPopover(wordRange, true);
            return;
        }
        window.setTimeout(() => {
            const selection = quill.getSelection();
            if (!selection)
                return;
            const fallbackWordRange = selectWordAtRange(selection);
            if (!fallbackWordRange)
                return;
            quill.setSelection(fallbackWordRange.index, fallbackWordRange.length, 'user');
            showPopover(fallbackWordRange, true);
        }, 0);
    };
    const handleEditorLinkActivation = (event: MouseEvent | PointerEvent) => {
        const target = event.target as HTMLElement | null;
        const anchor = target?.closest?.('a') as HTMLAnchorElement | null;
        if (!anchor || !quill.root.contains(anchor))
            return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        if (readOnly && event.type === 'click') {
            openUrlInNewTab(anchor.href);
        }
    };
    const handlePointerOver = (event: PointerEvent) => {
        const target = event.target as HTMLElement | null;
        const anchor = target?.closest?.('a') as HTMLAnchorElement | null;
        if (!anchor || !quill.root.contains(anchor))
            return;
        showPreview(anchor);
    };
    const handlePointerOut = (event: PointerEvent) => {
        if (!hoveredLink)
            return;
        const related = event.relatedTarget as HTMLElement | null;
        if (related && (hoveredLink.contains(related) || preview.contains(related)))
            return;
        hidePreview();
    };
    const handlePreviewPointerLeave = () => {
        hidePreview();
    };
    const handlePopoverMouseDown = () => {
        isInteractingWithPopover = true;
        clearHideTimer();
    };
    const handlePopoverMouseUp = () => {
        isInteractingWithPopover = false;
    };
    const handlePopoverFocusIn = () => {
        isInteractingWithPopover = true;
        clearHideTimer();
    };
    const handlePopoverFocusOut = () => {
        window.setTimeout(() => {
            isInteractingWithPopover = popover.contains(document.activeElement);
        }, 0);
    };
    const handleDocumentMouseDown = (event: MouseEvent) => {
        const target = event.target as Node;
        if (popover.contains(target) || toolbarEl.contains(target))
            return;
        hidePopover();
    };
    const handleInputKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            applyLink();
        }
        else if (event.key === 'Escape') {
            event.preventDefault();
            quill.focus();
            hidePopover();
        }
    };
    const handleOpenClick = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        const url = input.value || (activeRange ? findLinkAtRange(activeRange) : '');
        openUrlInNewTab(url);
    };
    const handleToolbarLinkMouseDown = (event: MouseEvent) => {
        if (!(event.target as HTMLElement)?.closest?.('.ql-link'))
            return;
        event.preventDefault();
        event.stopPropagation();
    };
    const handleToolbarLinkClick = (event: MouseEvent) => {
        if (!(event.target as HTMLElement)?.closest?.('.ql-link'))
            return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        const menu = toolbarEl.querySelector('.note-more-panel') as HTMLElement | null;
        if (menu)
            menu.hidden = true;
        toolbarEl.querySelector('.note-more-button')?.setAttribute('aria-expanded', 'false');
        const selection = quill.getSelection();
        const selected = selection?.length ? selection : selection ? (selectWordAtRange(selection) || selection) : null;
        if (selected)
            showPopover(selected, true);
    };
    const handleRemoveClick = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        removeLink();
    };
    const handleScrollResize = () => {
        if (activeRange && popover.classList.contains('is-visible')) {
            positionPopover(activeRange);
        }
        if (hoveredLink && preview.classList.contains('is-visible')) {
            positionPreview(hoveredLink);
        }
    };
    quill.on('selection-change', handleSelectionChange);
    quill.root.addEventListener('dblclick', handleDoubleClick);
    quill.root.addEventListener('pointerdown', handleEditorLinkActivation, true);
    quill.root.addEventListener('mousedown', handleEditorLinkActivation, true);
    quill.root.addEventListener('click', handleEditorLinkActivation, true);
    quill.root.addEventListener('auxclick', handleEditorLinkActivation, true);
    quill.root.addEventListener('pointerover', handlePointerOver);
    quill.root.addEventListener('pointerout', handlePointerOut);
    quill.root.addEventListener('scroll', handleScrollResize);
    window.addEventListener('resize', handleScrollResize);
    preview.addEventListener('pointerleave', handlePreviewPointerLeave);
    document.addEventListener('mousedown', handleDocumentMouseDown, true);
    toolbarEl.addEventListener('mousedown', handleToolbarLinkMouseDown, true);
    toolbarEl.addEventListener('click', handleToolbarLinkClick, true);
    popover.addEventListener('mousedown', handlePopoverMouseDown);
    popover.addEventListener('mouseup', handlePopoverMouseUp);
    popover.addEventListener('focusin', handlePopoverFocusIn);
    popover.addEventListener('focusout', handlePopoverFocusOut);
    input.addEventListener('keydown', handleInputKeyDown);
    openButton.addEventListener('click', handleOpenClick);
    removeButton.addEventListener('click', handleRemoveClick);
    cleanupFns.push(() => {
        quill.off('selection-change', handleSelectionChange);
        quill.root.removeEventListener('dblclick', handleDoubleClick);
        quill.root.removeEventListener('pointerdown', handleEditorLinkActivation, true);
        quill.root.removeEventListener('mousedown', handleEditorLinkActivation, true);
        quill.root.removeEventListener('click', handleEditorLinkActivation, true);
        quill.root.removeEventListener('auxclick', handleEditorLinkActivation, true);
        quill.root.removeEventListener('pointerover', handlePointerOver);
        quill.root.removeEventListener('pointerout', handlePointerOut);
        quill.root.removeEventListener('scroll', handleScrollResize);
        window.removeEventListener('resize', handleScrollResize);
        preview.removeEventListener('pointerleave', handlePreviewPointerLeave);
        document.removeEventListener('mousedown', handleDocumentMouseDown, true);
        toolbarEl.removeEventListener('mousedown', handleToolbarLinkMouseDown, true);
        toolbarEl.removeEventListener('click', handleToolbarLinkClick, true);
        popover.removeEventListener('mousedown', handlePopoverMouseDown);
        popover.removeEventListener('mouseup', handlePopoverMouseUp);
        popover.removeEventListener('focusin', handlePopoverFocusIn);
        popover.removeEventListener('focusout', handlePopoverFocusOut);
        input.removeEventListener('keydown', handleInputKeyDown);
        openButton.removeEventListener('click', handleOpenClick);
        removeButton.removeEventListener('click', handleRemoveClick);
        popover.remove();
        preview.remove();
    });
    return () => {
        cleanupFns.forEach(fn => fn());
    };
}
function setupImageInteractions(quill: any, wrapper: HTMLDivElement, Quill: any) {
    const cleanupFns: Array<() => void> = [];
    // Helper to check if an element is a local editor image
    const isLocalEditorImage = (target: EventTarget | null): target is HTMLImageElement => {
        return (target instanceof HTMLImageElement &&
            target.classList.contains('quill-local-image') &&
            target.hasAttribute('data-local-asset-id'));
    };
    // 1. Create ONE hover toolbar instance
    const toolbar = document.createElement('div');
    toolbar.className = 'ql-image-hover-toolbar';
    toolbar.style.display = 'none'; // Initially hidden
    const zoomBtn = document.createElement('button');
    zoomBtn.type = 'button';
    zoomBtn.className = 'ql-image-hover-btn ql-image-zoom-btn';
    zoomBtn.title = 'Zoom / Expand';
    zoomBtn.setAttribute('aria-label', 'Zoom / Expand');
    zoomBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 3 21 3 21 9"></polyline>
      <polyline points="9 21 3 21 3 15"></polyline>
      <line x1="21" y1="3" x2="14" y2="10"></line>
      <line x1="3" y1="21" x2="10" y2="14"></line>
    </svg>
  `;
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'ql-image-hover-btn ql-image-delete-btn';
    deleteBtn.title = 'Delete image';
    deleteBtn.setAttribute('aria-label', 'Delete image');
    deleteBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 6h18"></path>
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
    </svg>
  `;
    toolbar.appendChild(zoomBtn);
    toolbar.appendChild(deleteBtn);
    wrapper.appendChild(toolbar);
    // 2. Create left and right resize handle instances (Linear/Notion style)
    const resizeHandleLeft = document.createElement('div');
    resizeHandleLeft.className = 'ql-image-resize-handle ql-image-resize-handle-left';
    wrapper.appendChild(resizeHandleLeft);
    const resizeHandleRight = document.createElement('div');
    resizeHandleRight.className = 'ql-image-resize-handle ql-image-resize-handle-right';
    wrapper.appendChild(resizeHandleRight);
    let activeImage: HTMLImageElement | null = null;
    let isResizing = false;
    let activeHandle: 'left' | 'right' | null = null;
    let startPointerX = 0;
    let startPointerY = 0;
    let startWidth = 0;
    let startHeight = 0;
    let aspectRatio = 1;
    let resizeAnimationFrameId: number | null = null;
    const showToolbar = () => {
        toolbar.style.display = 'flex';
        // Force browser reflow to trigger opacity transition
        toolbar.offsetHeight;
        toolbar.classList.add('is-visible');
        if (!isResizing) {
            resizeHandleLeft.classList.add('is-visible');
            resizeHandleRight.classList.add('is-visible');
        }
    };
    const hideToolbar = () => {
        if (isResizing)
            return;
        activeImage = null;
        toolbar.classList.remove('is-visible');
        toolbar.style.display = 'none';
        resizeHandleLeft.classList.remove('is-visible');
        resizeHandleRight.classList.remove('is-visible');
    };
    const positionToolbar = () => {
        if (!activeImage || !activeImage.isConnected) {
            hideToolbar();
            return;
        }
        const imageRect = activeImage.getBoundingClientRect();
        const wrapperRect = wrapper.getBoundingClientRect();
        const toolbarWidth = 76; // 28 * 2 + 4 * 3 + padding
        const left = imageRect.right - wrapperRect.left - toolbarWidth - 8;
        const top = imageRect.top - wrapperRect.top + 8;
        toolbar.style.left = `${Math.max(8, left)}px`;
        toolbar.style.top = `${Math.max(8, top)}px`;
        // Position left and right handles centered vertically along the side edges
        const handleY = imageRect.top - wrapperRect.top + imageRect.height / 2;
        const handleLeftX = imageRect.left - wrapperRect.left;
        const handleRightX = imageRect.right - wrapperRect.left;
        resizeHandleLeft.style.left = `${handleLeftX}px`;
        resizeHandleLeft.style.top = `${handleY}px`;
        resizeHandleRight.style.left = `${handleRightX}px`;
        resizeHandleRight.style.top = `${handleY}px`;
    };
    // 3. Create ONE lightbox instance
    const lightboxOverlay = document.createElement('div');
    lightboxOverlay.className = 'ql-image-lightbox-overlay';
    lightboxOverlay.style.display = 'none'; // Initially hidden
    const lightboxImage = document.createElement('img');
    lightboxImage.className = 'ql-image-lightbox-img';
    lightboxOverlay.appendChild(lightboxImage);
    document.body.appendChild(lightboxOverlay);
    let lightboxOpen = false;
    let lightboxMode: 'fit' | 'actual' = 'fit';
    let isDragging = false;
    let panX = 0;
    let panY = 0;
    let startPanX = 0;
    let startPanY = 0;
    let lightboxStartPointerX = 0;
    let lightboxStartPointerY = 0;
    let movedDuringPointer = false;
    let dragPointerId: number | null = null;
    let previousBodyOverflow = '';
    const updateLightboxTransform = () => {
        if (lightboxMode === 'fit') {
            lightboxImage.style.transform = 'scale(1) translate3d(0px, 0px, 0)';
        }
        else {
            lightboxImage.style.transform = `translate3d(${panX}px, ${panY}px, 0)`;
        }
    };
    const openLightbox = (sourceImage: HTMLImageElement) => {
        lightboxImage.src = sourceImage.src;
        lightboxMode = 'fit';
        panX = 0;
        panY = 0;
        lightboxImage.className = 'ql-image-lightbox-img';
        updateLightboxTransform();
        lightboxOverlay.style.display = 'flex';
        requestAnimationFrame(() => {
            lightboxOverlay.classList.add('is-visible');
        });
        previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        lightboxOpen = true;
        hideToolbar();
    };
    const closeLightbox = () => {
        lightboxOverlay.classList.remove('is-visible');
        document.body.style.overflow = previousBodyOverflow;
        lightboxOpen = false;
        setTimeout(() => {
            lightboxOverlay.style.display = 'none';
            lightboxImage.src = '';
        }, 250);
    };
    const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
    const getPanningLimits = () => {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        // Padded margins (40px margin on each side)
        const availableWidth = viewportWidth - 80;
        const availableHeight = viewportHeight - 80;
        const imgWidth = lightboxImage.naturalWidth || lightboxImage.offsetWidth;
        const imgHeight = lightboxImage.naturalHeight || lightboxImage.offsetHeight;
        const maxX = Math.max(0, (imgWidth - availableWidth) / 2);
        const maxY = Math.max(0, (imgHeight - availableHeight) / 2);
        return { maxX, maxY };
    };
    const toggleLightboxMode = () => {
        if (lightboxMode === 'fit') {
            lightboxMode = 'actual';
            lightboxImage.classList.add('is-actual-size');
            panX = 0;
            panY = 0;
            updateLightboxTransform();
        }
        else {
            lightboxMode = 'fit';
            lightboxImage.classList.remove('is-actual-size');
            panX = 0;
            panY = 0;
            updateLightboxTransform();
        }
    };
    const handlePointerDown = (e: PointerEvent) => {
        if (lightboxMode !== 'actual')
            return;
        e.preventDefault();
        isDragging = true;
        movedDuringPointer = false;
        lightboxImage.classList.add('is-dragging');
        lightboxStartPointerX = e.clientX;
        lightboxStartPointerY = e.clientY;
        startPanX = panX;
        startPanY = panY;
        dragPointerId = e.pointerId;
        lightboxImage.setPointerCapture(e.pointerId);
    };
    const handlePointerMove = (e: PointerEvent) => {
        if (!isDragging || dragPointerId !== e.pointerId)
            return;
        const deltaX = e.clientX - lightboxStartPointerX;
        const deltaY = e.clientY - lightboxStartPointerY;
        if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
            movedDuringPointer = true;
        }
        const { maxX, maxY } = getPanningLimits();
        panX = clamp(startPanX + deltaX, -maxX, maxX);
        panY = clamp(startPanY + deltaY, -maxY, maxY);
        updateLightboxTransform();
    };
    const handlePointerUp = (e: PointerEvent) => {
        if (dragPointerId === e.pointerId) {
            isDragging = false;
            lightboxImage.classList.remove('is-dragging');
            lightboxImage.releasePointerCapture(e.pointerId);
            dragPointerId = null;
        }
    };
    lightboxImage.addEventListener('pointerdown', handlePointerDown);
    lightboxImage.addEventListener('pointermove', handlePointerMove);
    lightboxImage.addEventListener('pointerup', handlePointerUp);
    lightboxImage.addEventListener('pointercancel', handlePointerUp);
    lightboxImage.addEventListener('click', (e) => {
        e.stopPropagation();
        if (movedDuringPointer)
            return;
        toggleLightboxMode();
    });
    // Diagonal/Side Resizer Event Listeners
    const handleResizeStart = (e: PointerEvent, side: 'left' | 'right') => {
        if (!activeImage)
            return;
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        activeHandle = side;
        startPointerX = e.clientX;
        startPointerY = e.clientY;
        const rect = activeImage.getBoundingClientRect();
        startWidth = rect.width;
        startHeight = rect.height;
        aspectRatio = startWidth / startHeight;
        const targetHandle = side === 'left' ? resizeHandleLeft : resizeHandleRight;
        targetHandle.setPointerCapture(e.pointerId);
    };
    const handleResizeMove = (e: PointerEvent) => {
        if (!isResizing || !activeImage || !activeHandle)
            return;
        e.preventDefault();
        const deltaX = e.clientX - startPointerX;
        let candidateWidth = startWidth;
        if (activeHandle === 'right') {
            candidateWidth = startWidth + deltaX;
        }
        else {
            candidateWidth = startWidth - deltaX;
        }
        const MIN_IMAGE_WIDTH = 100;
        const style = window.getComputedStyle(quill.root);
        const availableWidth = quill.root.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        const clampedWidth = clamp(candidateWidth, MIN_IMAGE_WIDTH, availableWidth);
        const clampedHeight = clampedWidth / aspectRatio;
        if (resizeAnimationFrameId)
            cancelAnimationFrame(resizeAnimationFrameId);
        resizeAnimationFrameId = requestAnimationFrame(() => {
            if (activeImage) {
                activeImage.style.width = `${Math.round(clampedWidth)}px`;
                activeImage.style.height = `${Math.round(clampedHeight)}px`;
                positionToolbar();
            }
        });
    };
    const handleResizeUp = (e: PointerEvent) => {
        if (!isResizing)
            return;
        const side = activeHandle;
        isResizing = false;
        activeHandle = null;
        if (side) {
            const targetHandle = side === 'left' ? resizeHandleLeft : resizeHandleRight;
            try {
                targetHandle.releasePointerCapture(e.pointerId);
            }
            catch (err) { }
        }
        if (resizeAnimationFrameId) {
            cancelAnimationFrame(resizeAnimationFrameId);
            resizeAnimationFrameId = null;
        }
        if (activeImage) {
            const finalWidth = Math.round(activeImage.getBoundingClientRect().width);
            const blot = Quill.find(activeImage);
            if (blot) {
                const index = quill.getIndex(blot);
                quill.formatText(index, 1, { width: String(finalWidth) }, 'user');
            }
            activeImage.style.removeProperty('width');
            activeImage.style.removeProperty('height');
        }
        hideToolbar();
    };
    resizeHandleLeft.addEventListener('pointerdown', (e) => handleResizeStart(e, 'left'));
    resizeHandleLeft.addEventListener('pointermove', handleResizeMove);
    resizeHandleLeft.addEventListener('pointerup', handleResizeUp);
    resizeHandleLeft.addEventListener('pointercancel', handleResizeUp);
    resizeHandleLeft.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    resizeHandleRight.addEventListener('pointerdown', (e) => handleResizeStart(e, 'right'));
    resizeHandleRight.addEventListener('pointermove', handleResizeMove);
    resizeHandleRight.addEventListener('pointerup', handleResizeUp);
    resizeHandleRight.addEventListener('pointercancel', handleResizeUp);
    resizeHandleRight.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    const handlePointerOver = (e: PointerEvent) => {
        if (isLocalEditorImage(e.target)) {
            activeImage = e.target;
            positionToolbar();
            showToolbar();
        }
    };
    const handlePointerOut = (e: PointerEvent) => {
        if (isResizing)
            return;
        const related = e.relatedTarget as HTMLElement | null;
        if (related && (related === toolbar || toolbar.contains(related) || related === resizeHandleLeft || related === resizeHandleRight)) {
            return;
        }
        if (activeImage && e.target === activeImage) {
            hideToolbar();
        }
    };
    const handleToolbarPointerOut = (e: PointerEvent) => {
        if (isResizing)
            return;
        const related = e.relatedTarget as HTMLElement | null;
        if (related && (related === activeImage || related === resizeHandleLeft || related === resizeHandleRight)) {
            return;
        }
        hideToolbar();
    };
    quill.root.addEventListener('pointerover', handlePointerOver);
    quill.root.addEventListener('pointerout', handlePointerOut);
    toolbar.addEventListener('pointerleave', handleToolbarPointerOut);
    const handleDblClick = (e: MouseEvent) => {
        if (isLocalEditorImage(e.target)) {
            openLightbox(e.target);
        }
    };
    quill.root.addEventListener('dblclick', handleDblClick);
    const handleScrollResize = () => {
        if (activeImage) {
            positionToolbar();
        }
    };
    quill.root.addEventListener('scroll', handleScrollResize);
    window.addEventListener('resize', handleScrollResize);
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && lightboxOpen) {
            e.preventDefault();
            e.stopPropagation();
            closeLightbox();
        }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    lightboxOverlay.addEventListener('click', (e) => {
        if (e.target === lightboxOverlay) {
            closeLightbox();
        }
    });
    const handleZoomClick = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (activeImage) {
            openLightbox(activeImage);
        }
    };
    const handleDeleteClick = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (activeImage) {
            const blot = Quill.find(activeImage);
            if (blot) {
                const index = quill.getIndex(blot);
                quill.deleteText(index, 1, 'user');
            }
            hideToolbar();
        }
    };
    const preventDefaultSelection = (e: MouseEvent) => {
        e.preventDefault();
    };
    zoomBtn.addEventListener('mousedown', preventDefaultSelection);
    zoomBtn.addEventListener('click', handleZoomClick);
    deleteBtn.addEventListener('mousedown', preventDefaultSelection);
    deleteBtn.addEventListener('click', handleDeleteClick);
    return () => {
        quill.root.removeEventListener('pointerover', handlePointerOver);
        quill.root.removeEventListener('pointerout', handlePointerOut);
        toolbar.removeEventListener('pointerleave', handleToolbarPointerOut);
        quill.root.removeEventListener('dblclick', handleDblClick);
        quill.root.removeEventListener('scroll', handleScrollResize);
        window.removeEventListener('resize', handleScrollResize);
        document.removeEventListener('keydown', handleKeyDown, true);
        lightboxImage.removeEventListener('pointerdown', handlePointerDown);
        lightboxImage.removeEventListener('pointermove', handlePointerMove);
        lightboxImage.removeEventListener('pointerup', handlePointerUp);
        lightboxImage.removeEventListener('pointercancel', handlePointerUp);
        resizeHandleLeft.removeEventListener('pointerdown', handleResizeStart as any);
        resizeHandleLeft.removeEventListener('pointermove', handleResizeMove);
        resizeHandleLeft.removeEventListener('pointerup', handleResizeUp);
        resizeHandleLeft.removeEventListener('pointercancel', handleResizeUp);
        resizeHandleRight.removeEventListener('pointerdown', handleResizeStart as any);
        resizeHandleRight.removeEventListener('pointermove', handleResizeMove);
        resizeHandleRight.removeEventListener('pointerup', handleResizeUp);
        resizeHandleRight.removeEventListener('pointercancel', handleResizeUp);
        zoomBtn.removeEventListener('mousedown', preventDefaultSelection);
        zoomBtn.removeEventListener('click', handleZoomClick);
        deleteBtn.removeEventListener('mousedown', preventDefaultSelection);
        deleteBtn.removeEventListener('click', handleDeleteClick);
        toolbar.remove();
        resizeHandleLeft.remove();
        resizeHandleRight.remove();
        lightboxOverlay.remove();
        if (lightboxOpen) {
            document.body.style.overflow = previousBodyOverflow;
        }
    };
}
