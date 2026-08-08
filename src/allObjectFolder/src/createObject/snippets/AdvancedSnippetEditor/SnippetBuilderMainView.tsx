import * as React from 'react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { EditorContent } from '@tiptap/react';
import { useSnippetBuilder, SnippetBuilderProvider } from './context/SnippetBuilderContext';
import { SnippetFormattingToolbar } from './components/SnippetFormattingToolbar';
import { FiType, FiList, FiToggleRight, FiCalendar, FiClipboard, FiNavigation, FiSave } from 'react-icons/fi';
import { createFieldNode, FieldType } from '@extension/shared';

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

    const dom = editor.view.dom;
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

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>

      <style dangerouslySetInnerHTML={{
        __html: `
        .no-scrollbar::-webkit-scrollbar {
          display: none !important;
        }
      `}} />

      <div className="flex-1 flex flex-col min-h-0">
        <EditorContent editor={editor} style={{ flex: 1, height: '100%', outline: 'none' }} />
      </div>

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

      {textModalState.isOpen && (
        <div
          onKeyDown={handleModalKeyDown}
          className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-200"
          onClick={closeModals}
        >
          <div
            className="bg-[#171821] border border-neutral-200 dark:border-white/10 rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200 text-left overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-neutral-200 dark:border-white/10 pb-4 flex-shrink-0">
              <button
                onClick={closeModals}
                className="p-1.5 -ml-1.5 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
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
                <label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Field Label</label>
                <input
                  autoFocus
                  type="text"
                  value={configLabel}
                  onChange={(e) => setConfigLabel(e.target.value)}
                  placeholder="e.g., First Name"
                  className="w-full px-3 py-2 bg-transparent border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors"
                />
              </div>

              {textModalState.fieldType === 'dropdown' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Options (One per line)</label>
                  <textarea
                    rows={4}
                    value={configOptions}
                    onChange={(e) => setConfigOptions(e.target.value)}
                    placeholder="Apple&#10;Banana&#10;Orange"
                    className="w-full px-3 py-2 bg-transparent border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors resize-y min-h-[80px]"
                  />
                </div>
              )}

              {textModalState.fieldType === 'toggle' && (
                <div className="flex gap-3">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">True Label</label>
                    <input
                      type="text"
                      value={configTrueLabel}
                      onChange={(e) => setConfigTrueLabel(e.target.value)}
                      placeholder="Yes"
                      className="w-full px-3 py-2 bg-transparent border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    <label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">False Label</label>
                    <input
                      type="text"
                      value={configFalseLabel}
                      onChange={(e) => setConfigFalseLabel(e.target.value)}
                      placeholder="No"
                      className="w-full px-3 py-2 bg-transparent border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors"
                    />
                  </div>
                </div>
              )}

              {textModalState.fieldType === 'date' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">Format</label>
                  <select
                    value={configFormat}
                    onChange={(e) => setConfigFormat(e.target.value)}
                    className="w-full px-3 py-2 bg-transparent border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors"
                  >
                    <option value="long_full_date" className="text-neutral-900 bg-[#171821] dark:text-white">Long full date (Ex: June 5th 2026)</option>
                    <option value="short_full_date" className="text-neutral-900 bg-[#171821] dark:text-white">Short full date (Ex: 2026-06-05)</option>
                    <option value="long_year" className="text-neutral-900 bg-[#171821] dark:text-white">Long year (Ex: 2026)</option>
                    <option value="short_year" className="text-neutral-900 bg-[#171821] dark:text-white">Short year (Ex: 26)</option>
                    <option value="long_month" className="text-neutral-900 bg-[#171821] dark:text-white">Long month (Ex: June)</option>
                    <option value="long_day" className="text-neutral-900 bg-[#171821] dark:text-white">Long day (Ex: Friday)</option>
                    <option value="month_01_12" className="text-neutral-900 bg-[#171821] dark:text-white">Month (01-12) (Ex: 06)</option>
                    <option value="day_01_31" className="text-neutral-900 bg-[#171821] dark:text-white">Day (01-31) (Ex: 05)</option>
                    <option value="month_1_12" className="text-neutral-900 bg-[#171821] dark:text-white">Month (1-12) (Ex: 6)</option>
                    <option value="day_1_31" className="text-neutral-900 bg-[#171821] dark:text-white">Day (1-31) (Ex: 5)</option>
                    <option value="time_24" className="text-neutral-900 bg-[#171821] dark:text-white">24-hour time (Ex: 11:23)</option>
                    <option value="time_12" className="text-neutral-900 bg-[#171821] dark:text-white">12-hour time (Ex: 11:23 AM)</option>
                  </select>
                </div>
              )}

              {textModalState.fieldType !== 'date' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
                    {textModalState.fieldType === 'toggle' ? 'Default State' : 'Default Value (Optional)'}
                  </label>
                  {textModalState.fieldType === 'toggle' ? (
                    <div className="flex items-center gap-3 mt-1">
                      <button
                        onClick={() => setConfigDefaultValue(configDefaultValue === 'true' ? 'false' : 'true')}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 dark:focus:ring-white dark:focus:ring-offset-neutral-900 transition-colors ${configDefaultValue === 'true' ? 'bg-neutral-900 dark:bg-white' : 'bg-[#171821]'}`}
                      >
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-[#171821] shadow ring-0 transition duration-200 ease-in-out ${configDefaultValue === 'true' ? 'translate-x-2' : '-translate-x-2'}`} />
                      </button>
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">
                        {configDefaultValue === 'true' ? 'Checked (True)' : 'Unchecked (False)'}
                      </span>
                    </div>
                  ) : textModalState.fieldType === 'dropdown' ? (
                    <select
                      value={configDefaultValue}
                      onChange={(e) => setConfigDefaultValue(e.target.value)}
                      className="w-full px-3 py-2 bg-transparent border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors appearance-none"
                    >
                      <option value="" className="text-neutral-900 bg-[#171821] dark:text-white">No default</option>
                      {configOptions.split('\n').map(o => o.trim()).filter(o => o.length > 0).map((opt, idx) => (
                        <option key={idx} value={opt} className="text-neutral-900 bg-[#171821] dark:text-white">{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={configDefaultValue}
                      onChange={(e) => setConfigDefaultValue(e.target.value)}
                      placeholder="e.g., John"
                      className="w-full px-3 py-2 bg-transparent border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors"
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
                    className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 dark:border-neutral-600 dark:bg-neutral-800 dark:checked:bg-white dark:checked:border-white"
                  />
                  <label htmlFor="modal-req-checkbox" className="text-[13px] text-neutral-700 dark:text-neutral-300 cursor-pointer select-none">
                    Required field
                  </label>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4 border-t border-neutral-200 dark:border-white/10 mt-auto flex-shrink-0">
              <button
                onClick={closeModals}
                className="flex-1 px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveField}
                className="flex-1 px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors shadow-sm"
              >
                <FiSave size={14} />
                Save Field <span className="text-[10px] opacity-75 font-normal ml-0.5">(Ctrl+Enter)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
