import * as React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { EditorContent } from '@tiptap/react';
import { createPortal } from 'react-dom';
import { TextSelection } from '@tiptap/pm/state';
import { useSnippetBuilder, SnippetBuilderProvider } from './context/SnippetBuilderContext';
import { SnippetFormattingToolbar } from './components/SnippetFormattingToolbar';
import { FiType, FiList, FiToggleRight, FiCalendar, FiClipboard, FiNavigation, FiSave } from 'react-icons/fi';
import { createFieldNode, FieldType } from '@extension/shared';
import { normalizeSnippetLinkUrl } from './extensions/LinkMarkExtension';

export { SnippetBuilderProvider as SnippetBuilderMainViewProvider, SnippetFormattingToolbar as SnippetBuilderMainViewSnippetFormattingToolbar };

const insertFieldNode = (ed: any, type: FieldType, config: any, alias?: string) => {
  const fieldNode = createFieldNode(type, config, alias || 'field_' + Date.now());
  // @ts-ignore
  ed.chain().focus().insertFieldNode({
    id: fieldNode.id, fieldType: fieldNode.fieldType, config: fieldNode.config, alias: fieldNode.alias
  }).run();
};

interface SlashItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: (editor: any, openTextConfigModal: any, astPreview: any) => void;
}

const slashItems: SlashItem[] = [
  {
    id: 'text',
    title: 'Ask Input',
    description: 'Single-line text input',
    icon: <FiType size={14} />,
    action: (editor, openTextConfigModal) => {
      openTextConfigModal('text', undefined, undefined, (config: any, alias: any) => {
        insertFieldNode(editor, 'text', config, alias);
      });
    }
  },
  {
    id: 'dropdown',
    title: 'Dropdown',
    description: 'Select from a list of options',
    icon: <FiList size={14} />,
    action: (editor, openTextConfigModal) => {
      openTextConfigModal('dropdown', undefined, undefined, (config: any, alias: any) => {
        insertFieldNode(editor, 'dropdown', config, alias);
      });
    }
  },
  {
    id: 'toggle',
    title: 'Toggle',
    description: 'Yes/No switch',
    icon: <FiToggleRight size={14} />,
    action: (editor, openTextConfigModal) => {
      openTextConfigModal('toggle', undefined, undefined, (config: any, alias: any) => {
        insertFieldNode(editor, 'toggle', config, alias);
      });
    }
  },
  {
    id: 'date',
    title: 'Date',
    description: 'Insert date and time',
    icon: <FiCalendar size={14} />,
    action: (editor, openTextConfigModal) => {
      openTextConfigModal('date', undefined, undefined, (config: any, alias: any) => {
        insertFieldNode(editor, 'date', config, alias);
      });
    }
  },
  {
    id: 'clipboard',
    title: 'Clipboard',
    description: 'Insert clipboard contents',
    icon: <FiClipboard size={14} />,
    action: (editor) => {
      insertFieldNode(editor, 'clipboard', {}, 'Clipboard');
    }
  },
  {
    id: 'cursor',
    title: 'Place cursor',
    description: 'Cursor location after insertion',
    icon: <FiNavigation size={14} />,
    action: (editor, openTextConfigModal, astPreview) => {
      const hasCursor = (astPreview || []).some((node: any) => node.type === 'cursor');
      if (hasCursor) {
        alert('Only one cursor position is allowed per snippet.');
        return;
      }
      // @ts-ignore
      editor.chain().focus().insertCursorNode().run();
    }
  }
];

export const SnippetBuilderMainViewEditor: React.FC = () => {
  const { editor, astPreview, openTextConfigModal, textModalState, closeModals } = useSnippetBuilder();
  const [slashMenu, setSlashMenu] = useState<{
    isOpen: boolean;
    query: string;
    triggerPos: number;
    coords: { top: number; left: number };
  }>({
    isOpen: false,
    query: '',
    triggerPos: -1,
    coords: { top: 0, left: 0 },
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const linkPopoverRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const linkPreviewRef = useRef<HTMLDivElement>(null);
  const [linkPopover, setLinkPopover] = useState<{
    isOpen: boolean;
    href: string;
    range: { from: number; to: number } | null;
    coords: { top: number; left: number };
  }>({
    isOpen: false,
    href: '',
    range: null,
    coords: { top: 0, left: 0 },
  });
  const [linkPreview, setLinkPreview] = useState<{
    isOpen: boolean;
    label: string;
    coords: { top: number; left: number };
  }>({
    isOpen: false,
    label: '',
    coords: { top: 0, left: 0 },
  });

  // Config Modal States
  const [configLabel, setConfigLabel] = useState('');
  const [configAlias, setConfigAlias] = useState('');
  const [configDefaultValue, setConfigDefaultValue] = useState('');
  const [configOptions, setConfigOptions] = useState('');
  const [configRequired, setConfigRequired] = useState(false);
  const [configTrueLabel, setConfigTrueLabel] = useState('Yes');
  const [configFalseLabel, setConfigFalseLabel] = useState('No');
  const [configFormat, setConfigFormat] = useState('long_full_date');

  // Synchronize modal data when it opens
  useEffect(() => {
    if (textModalState.isOpen) {
      setConfigLabel(textModalState.initialData?.label || '');
      setConfigAlias(textModalState.initialAlias || '');
      setConfigDefaultValue(String((textModalState.initialData as any)?.defaultValue ?? ''));
      setConfigRequired((textModalState.initialData as any)?.required ?? false);

      if (textModalState.fieldType === 'dropdown' && 'options' in (textModalState.initialData || {})) {
        // @ts-ignore
        setConfigOptions((textModalState.initialData?.options || []).join('\n'));
      } else {
        setConfigOptions('');
      }

      if (textModalState.fieldType === 'toggle') {
        // @ts-ignore
        setConfigTrueLabel(textModalState.initialData?.trueLabel || 'Yes');
        // @ts-ignore
        setConfigFalseLabel(textModalState.initialData?.falseLabel || 'No');
        setConfigDefaultValue((textModalState.initialData as any)?.defaultValue ? 'true' : 'false');
      } else if (textModalState.fieldType === 'date') {
        // @ts-ignore
        setConfigFormat(textModalState.initialData?.format || 'long_full_date');
      } else {
        setConfigTrueLabel('Yes');
        setConfigFalseLabel('No');
        setConfigFormat('long_full_date');
      }
    }
  }, [textModalState]);

  const handleSaveField = () => {
    const configToSave: any = { required: configRequired };
    if (configLabel.trim()) configToSave.label = configLabel.trim();

    if (textModalState.fieldType === 'toggle') {
      configToSave.defaultValue = configDefaultValue === 'true';
      configToSave.trueLabel = configTrueLabel || 'Yes';
      configToSave.falseLabel = configFalseLabel || 'No';
      delete configToSave.required;
    } else if (textModalState.fieldType === 'date') {
      configToSave.format = configFormat || 'long_full_date';
      delete configToSave.required;
    } else if (configDefaultValue.trim()) {
      configToSave.defaultValue = configDefaultValue;
    }

    if (textModalState.fieldType === 'dropdown') {
      const opts = configOptions.split('\n').map(opt => opt.trim()).filter(opt => opt.length > 0);
      const uniqueOpts = Array.from(new Set(opts));
      if (uniqueOpts.length === 0) {
        alert('Dropdown must have at least one option.');
        return;
      }
      configToSave.options = uniqueOpts;
    }

    if (textModalState.onSave) {
      textModalState.onSave(configToSave, configAlias.trim() || undefined);
    }
    closeModals();
  };

  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();
      handleSaveField();
    }
  };

  const getLinkPreviewLabel = (href: string) => {
    try {
      const parsed = new URL(normalizeSnippetLinkUrl(href));
      return parsed.hostname.replace(/^www\./, '') || parsed.href;
    } catch {
      return href.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
    }
  };

  const getLinkHrefInRange = (from: number, to: number) => {
    if (!editor) return '';
    let href = '';
    editor.state.doc.nodesBetween(from, to, node => {
      if (href || !node.isText) return;
      const linkMark = node.marks.find(mark => mark.type.name === 'link' && mark.attrs.href);
      if (linkMark?.attrs.href) {
        href = linkMark.attrs.href;
      }
    });
    return href;
  };

  const expandRangeToLinkedText = (from: number, to: number, href: string) => {
    if (!editor || !href) return { from, to };

    const docSize = editor.state.doc.content.size;
    let start = from;
    let end = to;

    while (start > 1) {
      const marks = editor.state.doc.resolve(start - 1).marks();
      if (!marks.some(mark => mark.type.name === 'link' && mark.attrs.href === href)) break;
      start -= 1;
    }

    while (end < docSize) {
      const marks = editor.state.doc.resolve(end).marks();
      if (!marks.some(mark => mark.type.name === 'link' && mark.attrs.href === href)) break;
      end += 1;
    }

    return { from: start, to: end };
  };

  const getWordRangeAtPos = (pos: number) => {
    if (!editor) return null;

    const resolved = editor.state.doc.resolve(pos);
    const parent = resolved.parent;
    if (!parent.isTextblock) return null;

    const text = parent.textContent;
    const offset = Math.min(resolved.parentOffset, text.length);
    let start = offset;
    let end = offset;

    while (start > 0 && /[^\s]/.test(text[start - 1])) {
      start -= 1;
    }
    while (end < text.length && /[^\s]/.test(text[end])) {
      end += 1;
    }

    if (end <= start) return null;

    const blockStart = pos - resolved.parentOffset;
    return {
      from: blockStart + start,
      to: blockStart + end,
    };
  };

  const getEditorDom = () => {
    try {
      if (!editor || editor.isDestroyed) return null;
      return editor.view?.dom || null;
    } catch {
      return null;
    }
  };

  const positionLinkPopover = (from: number, to: number) => {
    if (!editor || !containerRef.current) return { top: 0, left: 0 };

    const startCoords = editor.view.coordsAtPos(from);
    const endCoords = editor.view.coordsAtPos(to);
    const containerRect = containerRef.current.getBoundingClientRect();
    const popoverWidth = Math.min(420, Math.max(240, containerRect.width - 16));
    const selectionLeft = Math.min(startCoords.left, endCoords.left);
    const selectionRight = Math.max(startCoords.right, endCoords.right);
    const topAbove = startCoords.top - containerRect.top - 58;
    const topBelow = startCoords.bottom - containerRect.top + 10;

    return {
      left: Math.max(8, Math.min(selectionLeft - containerRect.left + (selectionRight - selectionLeft) / 2 - popoverWidth / 2, containerRect.width - popoverWidth - 8)),
      top: Math.max(8, topAbove < 8 ? topBelow : topAbove),
    };
  };

  const openLinkPopoverForRange = (range: { from: number; to: number }) => {
    if (!editor) return;

    const href = getLinkHrefInRange(range.from, range.to);
    const expandedRange = expandRangeToLinkedText(range.from, range.to, href);
    editor.view.dispatch(
      editor.state.tr.setSelection(TextSelection.create(editor.state.doc, expandedRange.from, expandedRange.to)),
    );
    setLinkPreview(prev => ({ ...prev, isOpen: false }));
    setLinkPopover({
      isOpen: true,
      href,
      range: expandedRange,
      coords: positionLinkPopover(expandedRange.from, expandedRange.to),
    });
    requestAnimationFrame(() => {
      linkInputRef.current?.focus();
      const inputLength = linkInputRef.current?.value.length || 0;
      linkInputRef.current?.setSelectionRange(inputLength, inputLength);
    });
  };

  const applyLink = () => {
    if (!editor || !linkPopover.range) return;

    const href = normalizeSnippetLinkUrl(linkPopover.href);
    const cursorPos = linkPopover.range.to;
    const chain = editor.chain().focus().setTextSelection(linkPopover.range);
    if (href) {
      chain.setSnippetLink({ href }).setTextSelection(cursorPos).run();
    } else {
      chain.unsetSnippetLink().setTextSelection(cursorPos).run();
    }
    setLinkPreview(prev => ({ ...prev, isOpen: false }));
    setLinkPopover(prev => ({ ...prev, isOpen: false, range: null }));
  };

  const removeLink = () => {
    if (!editor || !linkPopover.range) return;

    editor
      .chain()
      .focus()
      .setTextSelection(linkPopover.range)
      .unsetSnippetLink()
      .setTextSelection(linkPopover.range.to)
      .run();
    setLinkPreview(prev => ({ ...prev, isOpen: false }));
    setLinkPopover(prev => ({ ...prev, isOpen: false, range: null }));
  };

  const openLink = () => {
    const href = normalizeSnippetLinkUrl(linkPopover.href);
    if (!href) return;
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    if (!editor) return;

    const handleDoubleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('[data-type="field-node"], [data-type="cursor-node"]')) return;

      const posAtCoords = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
      if (!posAtCoords) return;

      const range = getWordRangeAtPos(posAtCoords.pos);
      if (!range) return;

      event.preventDefault();
      openLinkPopoverForRange(range);
    };

    const preventEditorLinkActivation = (event: MouseEvent) => {
      const editorDom = getEditorDom();
      if (!editorDom) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.('a');
      if (!anchor || !editorDom.contains(anchor)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setLinkPreview(prev => ({ ...prev, isOpen: false }));
    };

    const handlePointerOver = (event: PointerEvent) => {
      const editorDom = getEditorDom();
      if (!editorDom) return;
      if (linkPopoverRef.current?.contains(event.target as Node)) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.('a') as HTMLAnchorElement | null;
      if (!anchor || !editorDom.contains(anchor)) return;

      const href = anchor.getAttribute('href') || '';
      const anchorRect = anchor.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return;

      const previewWidth = linkPreviewRef.current?.offsetWidth || 180;
      const previewHeight = linkPreviewRef.current?.offsetHeight || 42;
      const topAbove = anchorRect.top - containerRect.top - previewHeight - 8;
      const topBelow = anchorRect.bottom - containerRect.top + 8;

      setLinkPreview({
        isOpen: true,
        label: getLinkPreviewLabel(href),
        coords: {
          left: Math.max(8, Math.min(anchorRect.left - containerRect.left + anchorRect.width / 2 - previewWidth / 2, containerRect.width - previewWidth - 8)),
          top: Math.max(8, topAbove < 8 ? topBelow : topAbove),
        },
      });
    };

    const handlePointerOut = (event: PointerEvent) => {
      const related = event.relatedTarget as HTMLElement | null;
      if (related?.closest?.('a')) return;
      setLinkPreview(prev => ({ ...prev, isOpen: false }));
    };

    const handleDocumentMouseDown = (event: MouseEvent) => {
      const editorDom = getEditorDom();
      if (!editorDom) return;
      const target = event.target as Node;
      if (
        linkPopoverRef.current?.contains(target) ||
        editorDom.contains(target)
      ) {
        return;
      }
      setLinkPopover(prev => ({ ...prev, isOpen: false, range: null }));
    };

    const dom = getEditorDom();
    if (!dom) return;
    dom.addEventListener('dblclick', handleDoubleClick);
    dom.addEventListener('pointerdown', preventEditorLinkActivation, true);
    dom.addEventListener('mousedown', preventEditorLinkActivation, true);
    dom.addEventListener('click', preventEditorLinkActivation, true);
    dom.addEventListener('auxclick', preventEditorLinkActivation, true);
    dom.addEventListener('pointerover', handlePointerOver);
    dom.addEventListener('pointerout', handlePointerOut);
    document.addEventListener('mousedown', handleDocumentMouseDown, true);

    return () => {
      dom.removeEventListener('dblclick', handleDoubleClick);
      dom.removeEventListener('pointerdown', preventEditorLinkActivation, true);
      dom.removeEventListener('mousedown', preventEditorLinkActivation, true);
      dom.removeEventListener('click', preventEditorLinkActivation, true);
      dom.removeEventListener('auxclick', preventEditorLinkActivation, true);
      dom.removeEventListener('pointerover', handlePointerOver);
      dom.removeEventListener('pointerout', handlePointerOut);
      document.removeEventListener('mousedown', handleDocumentMouseDown, true);
    };
  }, [editor, linkPopover.href, linkPopover.range]);

  const filteredItems = useMemo(() => {
    if (!slashMenu.isOpen) return [];
    const q = slashMenu.query.toLowerCase();
    return slashItems.filter(
      item =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [slashMenu.isOpen, slashMenu.query]);

  // Auto-dismiss the menu if no items match
  useEffect(() => {
    if (slashMenu.isOpen && filteredItems.length === 0) {
      setSlashMenu(prev => ({ ...prev, isOpen: false }));
    }
  }, [filteredItems.length, slashMenu.isOpen]);

  // Reset activeIndex when query changes
  useEffect(() => {
    setActiveIndex(0);
  }, [slashMenu.query]);

  // Watch editor changes to detect slash commands
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      const { selection } = editor.state;
      const { $from } = selection;

      const textBefore = $from.parent.textBetween(
        Math.max(0, $from.parentOffset - 20),
        $from.parentOffset,
        null,
        '\n'
      );

      const match = textBefore.match(/\/([a-zA-Z]*)$/);

      if (match) {
        const queryText = match[1];
        const triggerPosition = $from.pos - match[0].length;

        try {
          const coords = editor.view.coordsAtPos(triggerPosition);
          const containerRect = containerRef.current?.getBoundingClientRect();
          const top = coords.bottom - (containerRect?.top || 0) + 4;
          const left = coords.left - (containerRect?.left || 0);

          setSlashMenu({
            isOpen: true,
            query: queryText,
            triggerPos: triggerPosition,
            coords: { top, left },
          });
        } catch (e) {
          // View might not be ready
        }
      } else {
        setSlashMenu(prev => prev.isOpen ? { ...prev, isOpen: false } : prev);
      }
    };

    editor.on('update', handleUpdate);
    editor.on('selectionUpdate', handleUpdate);

    return () => {
      editor.off('update', handleUpdate);
      editor.off('selectionUpdate', handleUpdate);
    };
  }, [editor]);

  // Keyboard navigation capturing
  useEffect(() => {
    if (!editor || !slashMenu.isOpen) return;

    const keydownHandler = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : 0));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : filteredItems.length - 1));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        const activeItem = filteredItems[activeIndex];
        if (activeItem) {
          handleSelectItem(activeItem);
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setSlashMenu(prev => ({ ...prev, isOpen: false }));
      }
    };

    const dom = getEditorDom();
    if (!dom) return;
    dom.addEventListener('keydown', keydownHandler, true);
    return () => {
      dom.removeEventListener('keydown', keydownHandler, true);
    };
  }, [editor, slashMenu.isOpen, filteredItems, activeIndex]);

  // Close on outside clicks
  useEffect(() => {
    if (!slashMenu.isOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSlashMenu(prev => ({ ...prev, isOpen: false }));
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [slashMenu.isOpen]);

  const handleSelectItem = (item: SlashItem) => {
    if (!editor) return;
    const endPos = editor.state.selection.$from.pos;
    editor.chain().focus().deleteRange({ from: slashMenu.triggerPos, to: endPos }).run();
    item.action(editor, openTextConfigModal, astPreview);
    setSlashMenu(prev => ({ ...prev, isOpen: false }));
  };

  if (!editor) return null;

  const contentRoot = containerRef.current?.getRootNode();
  const modalPortalTarget = typeof document === 'undefined'
    ? null
    : typeof ShadowRoot !== 'undefined' && contentRoot instanceof ShadowRoot
      ? contentRoot
      : document.body;

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>

      <style dangerouslySetInnerHTML={{
        __html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none !important;
        }
        .snippet-link-popover {
          position: absolute;
          z-index: 1003;
          display: flex;
          align-items: center;
          width: min(420px, calc(100% - 16px));
          min-height: 46px;
          padding: 6px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 8px;
          background: #171821;
          color: #f4f4f5;
          box-shadow: 0 12px 36px rgba(0, 0, 0, 0.32);
        }
        .snippet-link-popover input {
          min-width: 0;
          flex: 1 1 auto;
          height: 34px;
          border: 0;
          outline: none;
          background: transparent;
          color: #f4f4f5;
          font: inherit;
          font-size: 14px;
          font-weight: 500;
          padding: 0 8px;
        }
        .snippet-link-popover input::placeholder {
          color: #9a9a9a;
        }
        .snippet-link-popover-divider {
          width: 1px;
          height: 28px;
          margin: 0 5px;
          background: rgba(255, 255, 255, 0.14);
        }
        .snippet-link-popover-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          padding: 0;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: #a3a3a3;
          cursor: pointer;
          transition: background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease;
        }
        .snippet-link-popover-button:hover:not(:disabled),
        .snippet-link-popover-button:focus-visible {
          background: rgba(255, 255, 255, 0.08);
          color: #f4f4f5;
          outline: none;
        }
        .snippet-link-popover-button:disabled {
          cursor: default;
          opacity: 0.42;
        }
        .snippet-link-popover-remove:hover:not(:disabled) {
          color: #ef4444;
        }
        .snippet-link-preview {
          position: absolute;
          z-index: 1004;
          max-width: min(260px, calc(100% - 16px));
          padding: 10px 18px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          background: #1f1f22;
          color: #f4f4f5;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.34);
          font-size: 14px;
          font-weight: 700;
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          pointer-events: none;
        }
        .ProseMirror a {
          color: #60a5fa;
          text-decoration: none;
          cursor: pointer;
        }
        .ProseMirror a:hover {
          text-decoration: none;
        }
      `}} />

      <div className="flex-1 flex flex-col min-h-0">
        <EditorContent editor={editor} style={{ flex: 1, height: '100%', outline: 'none' }} />
      </div>

      {linkPreview.isOpen && (
        <div
          ref={linkPreviewRef}
          className="snippet-link-preview"
          style={{
            top: `${linkPreview.coords.top}px`,
            left: `${linkPreview.coords.left}px`,
          }}
        >
          {linkPreview.label}
        </div>
      )}

      {linkPopover.isOpen && (
        <div
          ref={linkPopoverRef}
          className="snippet-link-popover"
          style={{
            top: `${linkPopover.coords.top}px`,
            left: `${linkPopover.coords.left}px`,
          }}
          onMouseDown={e => e.stopPropagation()}
        >
          <input
            ref={linkInputRef}
            type="url"
            value={linkPopover.href}
            placeholder="Enter link URL"
            aria-label="Link URL"
            onChange={e => setLinkPopover(prev => ({ ...prev, href: e.target.value }))}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyLink();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setLinkPopover(prev => ({ ...prev, isOpen: false, range: null }));
                editor.chain().focus().run();
              }
            }}
          />
          <div className="snippet-link-popover-divider" aria-hidden="true" />
          <button
            type="button"
            className="snippet-link-popover-button"
            title="Open link"
            aria-label="Open link"
            disabled={!linkPopover.href.trim()}
            onClick={openLink}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6"></path><path d="M10 14 21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            </svg>
          </button>
          <button
            type="button"
            className="snippet-link-popover-button snippet-link-popover-remove"
            title="Remove link"
            aria-label="Remove link"
            disabled={!linkPopover.href.trim()}
            onClick={removeLink}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path>
            </svg>
          </button>
        </div>
      )}

      {slashMenu.isOpen && filteredItems.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-[9999] w-64 max-h-72 overflow-y-auto bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl py-1 select-none flex flex-col no-scrollbar"
          style={{
            top: `${slashMenu.coords.top}px`,
            left: `${slashMenu.coords.left}px`,
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}>
          {filteredItems.map((item, index) => {
            const isActive = index === activeIndex;
            return (
              <div
                key={item.id}
                onClick={() => handleSelectItem(item)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors duration-150
                  ${isActive ? 'bg-neutral-800 text-white' : 'text-neutral-300 hover:bg-neutral-800/50'}`}>
                <span className={`p-1.5 rounded bg-neutral-800/80 text-purple-400 ${isActive ? 'bg-purple-500/20 text-purple-300' : ''}`}>
                  {item.icon}
                </span>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-normal text-white opacity-100">{item.title}</span>
                  <span className="text-[10px] text-neutral-400 opacity-90">{item.description}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {textModalState.isOpen && modalPortalTarget && createPortal(
        <div
          data-snippet-field-modal="true"
          onKeyDown={handleModalKeyDown}
          className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-[var(--color-overlayBg)] backdrop-blur-[2px] animate-in fade-in duration-200"
          onClick={closeModals}
        >
          <div
            className="bg-[var(--color-editorBg)] border border-[var(--color-borderDefault)] text-[var(--color-textPrimary)] rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200 text-left overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-[var(--color-borderDefault)] pb-4 flex-shrink-0">
              <button
                onClick={closeModals}
                className="p-1.5 -ml-1.5 text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] rounded-lg hover:bg-[var(--color-hoverBg)] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h3 className="text-sm font-semibold text-[var(--color-textPrimary)]">
                Configure {textModalState.fieldType === 'dropdown' ? 'Dropdown' : textModalState.fieldType === 'toggle' ? 'Toggle' : textModalState.fieldType === 'date' ? 'Date' : 'Ask Input'}
              </h3>
            </div>

            <div className="flex flex-col gap-4 overflow-y-auto max-h-[55vh] custom-scrollbar pr-2 flex-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[var(--color-textSecondary)]">Field Label</label>
                <input
                  autoFocus
                  type="text"
                  value={configLabel}
                  onChange={(e) => setConfigLabel(e.target.value)}
                  placeholder="e.g., First Name"
                  className="w-full px-3 py-2 bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] rounded-lg text-sm text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] transition-colors"
                />
              </div>

              {textModalState.fieldType === 'dropdown' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-[var(--color-textSecondary)]">Options (One per line)</label>
                  <textarea
                    rows={4}
                    value={configOptions}
                    onChange={(e) => setConfigOptions(e.target.value)}
                    placeholder="Apple&#10;Banana&#10;Orange"
                    className="w-full px-3 py-2 bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] rounded-lg text-sm text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] transition-colors resize-y min-h-[80px]"
                  />
                </div>
              )}

              {textModalState.fieldType === 'toggle' && (
                <div className="flex gap-3">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-[13px] font-medium text-[var(--color-textSecondary)]">True Label</label>
                    <input
                      type="text"
                      value={configTrueLabel}
                      onChange={(e) => setConfigTrueLabel(e.target.value)}
                      placeholder="Yes"
                      className="w-full px-3 py-2 bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] rounded-lg text-sm text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-[13px] font-medium text-[var(--color-textSecondary)]">False Label</label>
                    <input
                      type="text"
                      value={configFalseLabel}
                      onChange={(e) => setConfigFalseLabel(e.target.value)}
                      placeholder="No"
                      className="w-full px-3 py-2 bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] rounded-lg text-sm text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] transition-colors"
                    />
                  </div>
                </div>
              )}

              {textModalState.fieldType === 'date' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-[var(--color-textSecondary)]">Format</label>
                  <select
                    value={configFormat}
                    onChange={(e) => setConfigFormat(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] rounded-lg text-sm text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] transition-colors"
                  >
                    <option value="long_full_date">Long full date (Ex: June 5th 2026)</option>
                    <option value="short_full_date">Short full date (Ex: 2026-06-05)</option>
                    <option value="long_year">Long year (Ex: 2026)</option>
                    <option value="short_year">Short year (Ex: 26)</option>
                    <option value="long_month">Long month (Ex: June)</option>
                    <option value="long_day">Long day (Ex: Friday)</option>
                    <option value="month_01_12">Month (01-12) (Ex: 06)</option>
                    <option value="day_01_31">Day (01-31) (Ex: 05)</option>
                    <option value="month_1_12">Month (1-12) (Ex: 6)</option>
                    <option value="day_1_31">Day (1-31) (Ex: 5)</option>
                    <option value="time_24">24-hour time (Ex: 11:23)</option>
                    <option value="time_12">12-hour time (Ex: 11:23 AM)</option>
                  </select>
                </div>
              )}

              {textModalState.fieldType !== 'date' && (
                <div className="flex flex-col gap-1.5">
                <label className="text-[13px] font-medium text-[var(--color-textSecondary)]">
                    {textModalState.fieldType === 'toggle' ? 'Default State' : 'Default Value (Optional)'}
                  </label>
                  {textModalState.fieldType === 'toggle' ? (
                    <div className="flex items-center gap-3 mt-1">
                      <button
                        onClick={() => setConfigDefaultValue(configDefaultValue === 'true' ? 'false' : 'true')}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] transition-colors ${configDefaultValue === 'true' ? 'bg-[var(--color-textPrimary)]' : 'bg-[var(--color-inputBg)]'}`}
                      >
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-[var(--color-editorBg)] shadow ring-0 transition duration-200 ease-in-out ${configDefaultValue === 'true' ? 'translate-x-2' : '-translate-x-2'}`} />
                      </button>
                      <span className="text-sm text-[var(--color-textSecondary)]">
                        {configDefaultValue === 'true' ? 'Checked (True)' : 'Unchecked (False)'}
                      </span>
                    </div>
                  ) : textModalState.fieldType === 'dropdown' ? (
                    <select
                      value={configDefaultValue}
                      onChange={(e) => setConfigDefaultValue(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] rounded-lg text-sm text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] transition-colors"
                    >
                      <option value="">No default</option>
                      {configOptions.split('\n').map(o => o.trim()).filter(o => o.length > 0).map((opt, idx) => (
                        <option key={idx} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={configDefaultValue}
                      onChange={(e) => setConfigDefaultValue(e.target.value)}
                      placeholder="e.g., John"
                      className="w-full px-3 py-2 bg-[var(--color-inputBg)] border border-[var(--color-borderDefault)] rounded-lg text-sm text-[var(--color-textPrimary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focusRing)] transition-colors"
                    />
                  )}
                </div>
              )}
              {textModalState.fieldType !== 'toggle' && textModalState.fieldType !== 'date' && (
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="modal-req-checkbox"
                    checked={configRequired}
                    onChange={(e) => setConfigRequired(e.target.checked)}
                    className="rounded border-[var(--color-borderDefault)] bg-[var(--color-inputBg)] text-[var(--color-textPrimary)] focus:ring-[var(--color-focusRing)]"
                  />
                  <label htmlFor="modal-req-checkbox" className="text-[13px] text-[var(--color-textSecondary)] cursor-pointer select-none">
                    Required field
                  </label>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t border-[var(--color-borderDefault)] mt-auto flex-shrink-0">
              <button
                onClick={closeModals}
                className="flex-1 px-4 py-2 text-sm font-medium text-[var(--color-textSecondary)] hover:text-[var(--color-textPrimary)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveField}
                className="flex-1 px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium bg-[var(--color-textPrimary)] text-[var(--color-editorBg)] rounded-lg transition-colors shadow-sm"
              >
                <FiSave size={14} />
                Save Field <span className="text-[10px] opacity-75 font-normal ml-0.5">(Ctrl+Enter)</span>
              </button>
            </div>
          </div>
        </div>,
        modalPortalTarget,
      )}
    </div>
  );
};
