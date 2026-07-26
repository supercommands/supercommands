import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createFieldNode, FieldType, scanAstForFields, evaluateAst, RuntimeContext } from '@extension/shared';
import { useSnippetBuilder } from '../context/SnippetBuilderContext';
import { FiSearch, FiType, FiAlignLeft, FiList, FiCalendar, FiToggleRight, FiNavigation, FiArrowLeft, FiSave, FiClipboard, FiActivity, FiStar, FiCommand } from 'react-icons/fi';
import { getItemCompoundId } from '../../../../../../shared-components/hotkeys/utils/hotkeyUtils';
import type { SnippetRecord } from '../../snippetTypes';
import { SharedPropertiesToolbar } from '../../../../../../shared-components/editorToolbar/SharedPropertiesToolbar';

type Snippet = SnippetRecord & { category?: string; value?: string | { urls?: string[]; names?: string[] } };

type CommandItem = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: (editor: any) => void;
};

type CommandSection = {
  title: string;
  items: CommandItem[];
};

const insertFieldNode = (ed: any, type: FieldType, config: any, alias?: string) => {
  const fieldNode = createFieldNode(type, config, alias || 'field_' + Date.now());
  // @ts-ignore
  ed.chain().focus().insertFieldNode({
    id: fieldNode.id, fieldType: fieldNode.fieldType, config: fieldNode.config, alias: fieldNode.alias
  }).run();
};

export interface SnippetFormattingToolbarProps {
  activeSnippetId?: string | null;
  snippet?: Snippet | null;
  workspaceId?: string | null;
  folderId?: string | null;
  tagIds?: string[];
  snippetTitle?: string;
  onChange?: (props: any) => void;
}

export const SnippetFormattingToolbar: React.FC<SnippetFormattingToolbarProps> = ({
  activeSnippetId,
  snippet,
  workspaceId,
  folderId,
  tagIds,
  snippetTitle = '',
  onChange,
}) => {
  const { editor, astPreview, openTextConfigModal } = useSnippetBuilder();

  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({});
  const [previewOutput, setPreviewOutput] = useState<string>('');

  const { textModalState } = useSnippetBuilder();

  const initialProperties = useMemo(() => {
    const base: any = snippet || {};
    return {
      ...base,
      id: activeSnippetId || base.id,
      workspaceId: workspaceId || base.workspaceId,
      folderId: folderId || base.folderId,
      tagIds: tagIds !== undefined ? tagIds : (base.tagIds || []),
      category: 'snippet',
    };
  }, [snippet, activeSnippetId, workspaceId, folderId, tagIds]);

  const compoundId = useMemo(() => {
    if (!activeSnippetId || activeSnippetId === 'new') return '';
    const wsObj = workspaceId ? { workspace_id: workspaceId } : null;
    const fldObj = folderId ? { folder_id: folderId } : null;
    const snipObj = snippet || { id: activeSnippetId, category: 'snippet', key: snippetTitle || '' };
    return getItemCompoundId({ snippet: snipObj as any, workspace: wsObj as any, folder: fldObj as any });
  }, [activeSnippetId, snippet, workspaceId, folderId, snippetTitle]);

  if (!editor) return null;

  const sections: CommandSection[] = [
    {
      title: '',
      items: [
        {
          id: 'text',
          title: 'Ask Input',
          description: 'Single-line text input',
          icon: <FiType size={16} className="opacity-70" />,
          action: () => {
            openTextConfigModal('text', undefined, undefined, (config, alias) => {
              if (editor) {
                insertFieldNode(editor, 'text', config, alias);
              }
            });
          }
        },
        {
          id: 'dropdown',
          title: 'Dropdown',
          description: 'Select from a list of options',
          icon: <FiList size={16} className="opacity-70" />,
          action: () => {
            openTextConfigModal('dropdown', undefined, undefined, (config, alias) => {
              if (editor) {
                insertFieldNode(editor, 'dropdown', config, alias);
              }
            });
          }
        },
        {
          id: 'toggle',
          title: 'Toggle',
          description: 'Yes/No switch',
          icon: <FiToggleRight size={16} className="opacity-70" />,
          action: () => {
            openTextConfigModal('toggle', undefined, undefined, (config, alias) => {
              if (editor) {
                insertFieldNode(editor, 'toggle', config, alias);
              }
            });
          }
        },
        {
          id: 'date',
          title: 'Date',
          description: 'Insert date and time',
          icon: <FiCalendar size={16} className="opacity-70" />,
          action: () => {
            openTextConfigModal('date', undefined, undefined, (config, alias) => {
              if (editor) {
                insertFieldNode(editor, 'date', config, alias);
              }
            });
          }
        },
        {
          id: 'clipboard',
          title: 'Clipboard',
          description: 'Insert clipboard contents',
          icon: <FiClipboard size={16} className="opacity-70" />,
          action: () => {
            if (editor) {
              insertFieldNode(editor, 'clipboard', {}, 'Clipboard');
            }
          }
        },
        {
          id: 'cursor',
          title: 'Place cursor',
          description: 'Cursor location after insertion',
          icon: <FiNavigation size={16} className="opacity-70" />,
          action: (ed) => {
            const hasCursor = astPreview.some(node => node.type === 'cursor');
            if (hasCursor) {
              alert('Only one cursor position is allowed per snippet.');
              return;
            }
            // @ts-ignore
            ed.chain().focus().insertCursorNode().run();
          }
        }
      ]
    }
  ];

  // Dynamic Scanner Logic
  const handleGenerate = async () => {
    const fields = scanAstForFields(astPreview);
    const context = new RuntimeContext();

    fields.forEach((field: any) => {
      const val = previewValues[field.id];
      if (val) {
        context.setValue(field.id, val, 'USER_INPUT');
      }
    });

    const result = evaluateAst(astPreview, context);
    setPreviewOutput(result.text);
  };

  let previewFields: any[] = [];
  try {
    previewFields = scanAstForFields(astPreview);
  } catch (e) { }

  return (
    <div className="flex flex-col gap-3 w-full h-full min-h-0">
      {mode === 'edit' ? (
        <div className="flex flex-col gap-2.5 flex-1 min-h-0">
          

          <div className="flex flex-col gap-2 pt-0.5 overflow-y-auto custom-scrollbar flex-1 pr-1.5 -mr-1.5 relative z-10">

            {sections.map((section, idx) => (
              <div key={idx} className="flex flex-col gap-1.5 flex-shrink-0">
                {section.title && <h4 className="text-[13px] font-semibold text-neutral-500">{section.title}</h4>}
                <div className="flex flex-col">
                  {section.items.map(item => (
                    <button
                      key={item.id}
                      onClick={() => item.action(editor)}
                      className="flex items-start gap-3 w-full text-left p-1.5 -mx-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors group"
                    >
                      <div className="mt-0.5 text-neutral-500 group-hover:text-neutral-700 dark:text-neutral-400 dark:group-hover:text-neutral-200 transition-colors">
                        {item.icon}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-200 leading-tight">
                          {item.title}
                        </span>
                        <span className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 leading-tight">
                          {item.description}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}


          </div>

          {/* Test Button at bottom */}
          {previewFields.length > 0 && (
            <button
              onClick={() => setMode('preview')}
              className="w-full py-2 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity mt-2 flex-shrink-0 shadow-sm"
            >
              Test
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6 flex-1 min-h-0">
          <div className="flex items-center gap-3 border-b border-neutral-200 dark:border-white/10 pb-4 flex-shrink-0">
            <button
              onClick={() => setMode('edit')}
              className="p-1.5 -ml-1.5 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white rounded-lg hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors"
            >
              <FiArrowLeft size={16} />
            </button>
            <h3 className="text-sm font-semibold text-[var(--color-textPrimary)]">Test Snippet</h3>
          </div>

          <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 -mr-2 pb-4">
            {previewFields.length === 0 ? (
              <div className="text-sm text-neutral-500 italic py-2">No dynamic fields found.</div>
            ) : (
              previewFields.map((field) => (
                <div key={field.id} className="flex flex-col gap-1.5 text-left">
                  <label className="text-[13px] font-medium text-neutral-600 dark:text-neutral-400 flex items-center justify-between">
                    <span>{field.config?.label || field.alias || (field.fieldType === 'dropdown' ? 'Dropdown' : field.fieldType === 'toggle' ? 'Toggle' : field.fieldType === 'date' ? 'Date' : 'Ask Input')}</span>
                  </label>
                  {field.fieldType === 'dropdown' ? (
                    <select
                      className="w-full px-3 py-1.5 bg-transparent border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors"
                      value={previewValues[field.id] || field.config?.defaultValue || ''}
                      onChange={(e) => setPreviewValues({ ...previewValues, [field.id]: e.target.value })}
                    >
                      <option value="" disabled hidden className="text-neutral-900 bg-[var(--color-containerBg)] dark:text-white">Select an option...</option>
                      {/* @ts-ignore */}
                      {(field.config?.options || []).map((opt: string, idx: number) => (
                        <option key={idx} value={opt} className="text-neutral-900 bg-[var(--color-containerBg)] dark:text-white">{opt}</option>
                      ))}
                    </select>
                  ) : field.fieldType === 'toggle' ? (
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={previewValues[field.id] === 'true' || (previewValues[field.id] === undefined && field.config?.defaultValue === true)}
                          onChange={(e) => setPreviewValues({ ...previewValues, [field.id]: e.target.checked ? 'true' : 'false' })}
                          className="w-4 h-4 rounded text-neutral-900 dark:text-white focus:ring-neutral-900 dark:focus:ring-white bg-[var(--color-containerBg)] border-[var(--color-borderDefault)]"
                        />
                        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                          {previewValues[field.id] === 'true' || (previewValues[field.id] === undefined && field.config?.defaultValue === true) ? (field.config?.trueLabel || 'Yes') : (field.config?.falseLabel || 'No')}
                        </span>
                      </label>
                    </div>
                  ) : field.fieldType === 'date' ? (
                    <input
                      type={field.config?.format === 'time' ? 'time' : field.config?.format === 'datetime' ? 'datetime-local' : 'date'}
                      className="w-full px-3 py-1.5 bg-transparent border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors"
                      value={previewValues[field.id] !== undefined ? previewValues[field.id] : (
                        field.config?.defaultValue === 'today'
                          ? new Date().toISOString().split('T')[0]
                          : field.config?.defaultValue === 'tomorrow'
                            ? new Date(Date.now() + 86400000).toISOString().split('T')[0]
                            : ''
                      )}
                      onChange={(e) => setPreviewValues({ ...previewValues, [field.id]: e.target.value })}
                    />
                  ) : (
                    <input
                      type="text"
                      placeholder={`Enter value...`}
                      className="w-full px-3 py-1.5 bg-transparent border border-neutral-200 dark:border-white/10 rounded-lg text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-neutral-400 dark:focus:border-neutral-500 transition-colors placeholder:text-neutral-500"
                      value={previewValues[field.id] || ''}
                      onChange={(e) => setPreviewValues({ ...previewValues, [field.id]: e.target.value })}
                    />
                  )}
                </div>
              ))
            )}

            <button
              onClick={handleGenerate}
              className="w-full py-2 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0"
            >
              Generate Result
            </button>

            {previewOutput && (
              <div className="flex flex-col gap-2 flex-1 min-h-0 pb-4">
                <h3 className="text-sm font-semibold text-[var(--color-textPrimary)]">Final Output</h3>
                <div className="flex-1 overflow-y-auto custom-scrollbar border border-neutral-200 dark:border-white/10 rounded-lg bg-neutral-900 p-4">
                  <pre className="text-neutral-100 text-[13px] whitespace-pre-wrap font-mono">
                    {previewOutput}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
