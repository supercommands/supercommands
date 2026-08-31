import { forwardRef, useRef, useLayoutEffect, useEffect, useState } from 'react';
import 'quill/dist/quill.snow.css';
import './editorStyles.css';
import { setupEditor } from './editorSetup';
import { assetStore } from '../../storage/assets/assetStore';

function useLocalImageRenderer(quillInstance: any, isClient: boolean, htmlContent: string) {
  const urlRegistry = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!isClient || !quillInstance) return;

    const renderImages = async () => {
      const root = quillInstance.root as HTMLElement;
      if (!root) return;

      const images = root.querySelectorAll('img[data-local-asset-id]');
      const currentIds = new Set<string>();

      for (const img of Array.from(images)) {
        const id = img.getAttribute('data-local-asset-id');
        if (!id) continue;
        currentIds.add(id);

        if (!urlRegistry.current.has(id)) {
          try {
            const asset = await assetStore.getAsset(id);
            if (asset && asset.blob) {
              const url = URL.createObjectURL(asset.blob);
              urlRegistry.current.set(id, url);
            }
          } catch (err) {
            console.error('Failed to load asset', id, err);
          }
        }

        const url = urlRegistry.current.get(id);
        if (url && img.getAttribute('src') !== url) {
          img.setAttribute('src', url);
        }
      }

      // Cleanup unused URLs
      for (const [id, url] of Array.from(urlRegistry.current.entries())) {
        if (!currentIds.has(id)) {
          URL.revokeObjectURL(url);
          urlRegistry.current.delete(id);
        }
      }
    };

    // Initial render
    renderImages();

    // Re-render images whenever the editor's contents change (e.g. from dangerouslyPasteHTML)
    quillInstance.on('editor-change', renderImages);

    return () => {
      quillInstance.off('editor-change', renderImages);
    };
  }, [isClient, quillInstance]);

  // Full cleanup on unmount
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      urlRegistry.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      urlRegistry.current.clear();
    };
  }, []);
}

interface TextEditorProps {
  value: string;
  onChange: (html: string) => void;
  onKeyUpdate?: (newKey: string) => void;
  onAtTrigger?: (position: { top: number; left: number }) => void;
  onUpArrowAtStart?: () => void;
  placeholder?: string;
  readOnly?: boolean;
  onCreateNew?: () => void;
  toolbarSelector?: string;
  showToolbar?: boolean;
  isFocusMode?: boolean;
  onDelete?: () => void;
  onImageSaveStart?: () => void;
  onImageSaveEnd?: () => void;
  normalizeHtml?: (html: string) => string;
  forceSyncWhileFocused?: boolean;
  syncRevision?: number;
}

const resolveToolbarTarget = (selector?: string, root?: Document | ShadowRoot) => {
  if (!selector) return null;
  const rootMatch = root?.querySelector?.(selector);
  if (rootMatch instanceof HTMLElement) return rootMatch;
  const documentMatch = document.querySelector(selector);
  if (documentMatch instanceof HTMLElement) return documentMatch;
  return null;
};

/**
 * TextEditor:
 * A React wrapper around the rich text editor library.
 * Automatically initializes and cleans up the editor instance.
 */
const TextEditor = forwardRef<any, TextEditorProps>(
  (
    {
      value,
      onChange,
      onKeyUpdate,
      onAtTrigger,
      onUpArrowAtStart,
      placeholder = 'Start writing...',
      readOnly = false,
      toolbarSelector,
      showToolbar = true,
      isFocusMode = false,
      onCreateNew,
      onDelete,
      onImageSaveStart,
      onImageSaveEnd,
      normalizeHtml,
      forceSyncWhileFocused = false,
      syncRevision = 0,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null); // Ref for the DOM container
    const quillInstanceRef = useRef<any>(null); // Ref to hold Quill instance
    const cleanupRef = useRef<(() => void) | null>(null);
    const [isClient, setIsClient] = useState(false); // Ensure client-only rendering
    const [isEditorReady, setIsEditorReady] = useState(false);
    const lastAppliedSyncRevisionRef = useRef<number>(syncRevision);

    useLocalImageRenderer(quillInstanceRef.current, isClient, value);

    useEffect(() => {
      setIsClient(true); // Trigger editor setup only on client side
    }, []);

    useLayoutEffect(() => {
      if (!isClient || !containerRef.current) return;

      const init = async () => {
        try {
          // Initialize the editor instance with custom setup
          const cleanup = await setupEditor(containerRef.current!, value, {
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
          });
          cleanupRef.current = cleanup || null;
          setIsEditorReady(true);
        } catch (err) {
          console.error('Editor setup failed:', err);
        }
      };

      init();

      return () => {
        // Cleanup editor instance
        cleanupRef.current?.();
        cleanupRef.current = null;
        if (ref) (ref as any).current = null;
        if (containerRef.current) containerRef.current.innerHTML = '';
        setIsEditorReady(false);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isClient, toolbarSelector]);

    useEffect(() => {
      // Dynamically enable/disable editor
      if (isClient && isEditorReady && quillInstanceRef.current) {
        quillInstanceRef.current.enable(!readOnly);
      }
    }, [readOnly, isClient, isEditorReady]);

    useEffect(() => {
      const quill = quillInstanceRef.current;
      if (!isClient || !quill) return;

      const revisionChanged = syncRevision !== lastAppliedSyncRevisionRef.current;
      const hasFocus = quill.hasFocus();

      const currentHtml = quill.root.innerHTML;
      const defaultNormalize = (html: string) => (html === '<p><br></p>' || html === '<div><br></div>' ? '' : html);
      const normalize = normalizeHtml || defaultNormalize;

      if (normalize(value) !== normalize(currentHtml)) {
        // While the editor is focused, ignore same-tab echo updates so typing stays stable.
        // Real remote revisions still flow through because they carry a new revision number.
        if (hasFocus && !revisionChanged && !forceSyncWhileFocused) {
          return;
        }

        // Capture selection before setContents so we can restore it safely.
        const selection = quill.getSelection();

        const delta = quill.clipboard.convert({ html: value });
        quill.setContents(delta, 'silent');

        if (selection && hasFocus) {
          const length = quill.getLength();
          const maxIndex = Math.max(0, length - 1);

          const safeIndex = Math.max(0, Math.min(selection.index, maxIndex));
          const safeLength = Math.max(
            0,
            Math.min(selection.length, Math.max(0, maxIndex - safeIndex)),
          );

          quill.setSelection(safeIndex, safeLength, 'silent');
        }
      }

      if (revisionChanged) {
        lastAppliedSyncRevisionRef.current = syncRevision;
      }
    }, [value, isClient, normalizeHtml, syncRevision]);

    // Dynamically manage custom delete button in the toolbar
    useEffect(() => {
      if (!isClient) return;

      const toolbar = toolbarSelector
        ? resolveToolbarTarget(toolbarSelector, containerRef.current?.getRootNode() as Document | ShadowRoot | undefined)
        : containerRef.current?.parentElement?.querySelector('.ql-toolbar') || containerRef.current?.querySelector('.ql-toolbar');

      if (!toolbar) return;

      let deleteBtn = toolbar.querySelector('.ql-custom-delete') as HTMLButtonElement | null;

      if (onDelete && !readOnly) {
        if (!deleteBtn) {
          deleteBtn = document.createElement('button');
          deleteBtn.type = 'button';
          deleteBtn.className = 'ql-custom-delete';
          deleteBtn.setAttribute('title', 'Delete Note');
          deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
          const svg = deleteBtn.querySelector('svg');
          if (svg) svg.style.color = '#ef4444';
          toolbar.appendChild(deleteBtn);
        }

        // Bind the latest callback
        deleteBtn.onclick = (e) => {
          e.preventDefault();
          onDelete();
        };
      } else {
        if (deleteBtn) {
          deleteBtn.remove();
        }
      }
    }, [isClient, onDelete, readOnly, toolbarSelector]);

    return (
      <div
        className={`quill-wrapper-internal flex-1 ${!showToolbar ? 'toolbar-hidden' : ''} ${isFocusMode ? 'focus-mode' : ''}`}
        style={{ height: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <div
          ref={containerRef}
          style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}
        />
      </div>
    );
  },
);

TextEditor.displayName = 'TextEditor';
export default TextEditor;
