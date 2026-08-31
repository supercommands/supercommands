import type Clipboard from 'quill/modules/clipboard';
import { registerLocalImageBlot } from './blots/localImageBlot';
import { assetStore } from '../../storage/assets/assetStore';
import { validateImageAsset } from '../../storage/assets/assetPolicy';

interface EditorSetupOptions {
  placeholder?: string;
  readOnly?: boolean;
  onChange: (html: string) => void;
  onKeyUpdate?: (newKey: string) => void;
  onAtTrigger?: (position: { top: number; left: number }) => void;
  onUpArrowAtStart?: () => void;
  onCreateNew?: () => void;
  ref?: any;
  quillInstanceRef: React.RefObject<any>;
  toolbarSelector?: string;
  onDelete?: () => void;
  onImageSaveStart?: () => void;
  onImageSaveEnd?: () => void;
}

const resolveToolbarTarget = (selector?: string, root?: Document | ShadowRoot) => {
  if (!selector) return null;
  const rootMatch = root?.querySelector?.(selector);
  if (rootMatch instanceof HTMLElement) return rootMatch;
  const documentMatch = document.querySelector(selector);
  if (documentMatch instanceof HTMLElement) return documentMatch;
  return null;
};

export const setupEditor = async (
  container: HTMLDivElement,
  initialValue: string,
  {
    placeholder,
    readOnly,
    onChange,
    onKeyUpdate,
    onAtTrigger,
    onUpArrowAtStart,
    onCreateNew,
    ref,
    quillInstanceRef,
    toolbarSelector,
    onDelete,
    onImageSaveStart,
    onImageSaveEnd,
  }: EditorSetupOptions,
) => {
  const { default: Quill } = await import('quill');

  registerLocalImageBlot(Quill);

  const BaseClipboard = Quill.import('modules/clipboard') as typeof Clipboard;

  class CleanClipboard extends BaseClipboard {
    convert(input: { html?: string; text?: string }, formats?: Record<string, unknown>) {
      const html = input.html || '';

      const div = document.createElement('div');
      div.innerHTML = html;

      div.querySelectorAll('*').forEach(node => {
        const el = node as HTMLElement;

        // Strip specific inline styles
        el.style.backgroundColor = '';
        el.style.background = '';
        el.style.color = '';

        // Clean background and color from style attribute string
        const style = el.getAttribute('style');
        if (style) {
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
    new(): any;
    sanitize: (url: string) => string;
  };

  // Optional: Patch Link to auto-prepend protocol if missing
  Link.sanitize = (url: string) => {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    // If no protocol, add https://
    return 'https://' + url;
  };

  Quill.register('formats/link', Link, true);

  // Inject strict CSS overrides to fix native Quill blue theme and padding
  if (!document.getElementById('quill-custom-toolbar-styles')) {
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
    `;
    document.head.appendChild(style);
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
  `;

  const quill = new Quill(editorEl, {
    theme: 'snow',
    placeholder,
    readOnly,
    modules: {
      toolbar: {
        container: toolbarEl,
        handlers: {},
      },
      history: {
        delay: 1000,
        maxStack: 100,
        userOnly: true,
      },
      clipboard: {
        matchVisual: false,
      },
    },
  });

  const handleImageFile = async (file: File) => {
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

    } catch (error) {
      console.error('[editorSetup] Failed to save pasted image', error);
    } finally {
      if (didStartImageSave && onImageSaveEnd) onImageSaveEnd();
    }
  };

  quill.root.addEventListener(
    'paste',
    (e: ClipboardEvent) => {
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
    },
    true,
  );

  quill.root.addEventListener(
    'drop',
    (e: DragEvent) => {
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
        if (hasImage) return;
      }
    },
    true,
  );


  // Helper: apply clean styling to a toolbar element
  const styleToolbar = (toolbar: HTMLElement) => {
    if (toolbar.dataset.cmdosStyled === 'true') return;
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
      } else if (attemptsLeft > 0) {
        setTimeout(() => attemptTeleport(attemptsLeft - 1), 50);
      }
    };
    attemptTeleport(20); // Try up to 20 times = up to 1 second total
  } else {
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


  const initialDelta = quill.clipboard.convert({ html: initialValue || '' });
  quill.setContents(initialDelta, 'silent');
  quill.root.style.background = 'transparent';
  quill.root.style.color = 'inherit';

  if (ref) ref.current = quill;
  quillInstanceRef.current = quill;

  const cleanupFns: Array<() => void> = [];

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
  cleanupFns.push(() => {
    quill.root.removeEventListener('click', handleEditorClickForImages);
    imageDeleteButton.removeEventListener('mousedown', handleImageDeleteMouseDown);
    imageDeleteButton.removeEventListener('click', handleImageDeleteClick);
    quill.root.removeEventListener('scroll', positionImageDeleteButton);
    window.removeEventListener('resize', positionImageDeleteButton);
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
        if (!button) return;

        const onMouseDown = (event: Event) => {
          event.preventDefault();
          event.stopPropagation();
          ensureRange();
        };
        const onClick = (event: Event) => {
          event.preventDefault();
          event.stopPropagation();
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

      const highlightColor = '#F8E68C';

      // Keep custom buttons that are NOT handled by Quill natively
      registerButton('.ql-custom-undo', () => { (quill as any).history?.undo(); });
      registerButton('.ql-custom-redo', () => { (quill as any).history?.redo(); });
      registerButton('.ql-custom-add', () => {
        if (onCreateNew) onCreateNew();
      });


      const boldBtn = toolbarEl.querySelector('.ql-bold') as HTMLElement | null;
      const italicBtn = toolbarEl.querySelector('.ql-italic') as HTMLElement | null;
      const underlineBtn = toolbarEl.querySelector('.ql-underline') as HTMLElement | null;
      const strikeBtn = toolbarEl.querySelector('.ql-strike') as HTMLElement | null;
      const blockquoteBtn = toolbarEl.querySelector('.ql-blockquote') as HTMLElement | null;
      const highlightBtn = toolbarEl.querySelector('.ql-background') as HTMLElement | null;
      const bulletBtn = toolbarEl.querySelector('button.ql-list[value="bullet"]') as HTMLElement | null;
      const orderedBtn = toolbarEl.querySelector('button.ql-list[value="ordered"]') as HTMLElement | null;
      const linkBtn = toolbarEl.querySelector('.ql-link') as HTMLElement | null;

      const setActive = (el: HTMLElement | null, active: boolean) => {
        if (!el) return;
        el.classList.toggle('ql-active', active);
      };

      const updateActiveStates = () => {
        // Prevent getFormat() from stealing focus back when Quill loses focus
        if (!quill.hasFocus()) return;

        const format = quill.getFormat();
        setActive(boldBtn, Boolean(format.bold));
        setActive(italicBtn, Boolean(format.italic));
        setActive(underlineBtn, Boolean(format.underline));
        setActive(strikeBtn, Boolean(format.strike));
        setActive(blockquoteBtn, Boolean(format.blockquote));
        setActive(highlightBtn, format.background === highlightColor);
        setActive(bulletBtn, format.list === 'bullet');
        setActive(orderedBtn, format.list === 'ordered');
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

  return () => {
    cleanupFns.forEach(fn => fn());
  };
};
