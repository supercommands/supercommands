import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
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

  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
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
      <div className="flex flex-col gap-2.5 flex-1 min-h-0">
        <div className="flex flex-col gap-2 pt-0.5 overflow-y-auto custom-scrollbar flex-1 pr-1.5 -mr-1.5 relative z-10">
          {sections.map((section, idx) => (
            <div key={idx} className="flex flex-col gap-2 flex-shrink-0">
              {section.title && <h4 className="text-[12px] font-normal text-neutral-500 dark:text-neutral-400 opacity-90 px-0.5">{section.title}</h4>}
              <div className="flex flex-col gap-2">
                {section.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => item.action(editor)}
                    className="flex items-start gap-3.5 w-full text-left p-2 -mx-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-white/5 transition-all group cursor-pointer"
                  >
                    <div className="mt-0.5 text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-200 transition-colors opacity-90">
                      {item.icon}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-normal text-neutral-700 dark:text-neutral-300 opacity-100 leading-tight">
                        {item.title}
                      </span>
                      <span className="text-[11px] font-normal text-neutral-400 dark:text-neutral-500 opacity-85 leading-normal">
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
            onClick={() => setIsTestModalOpen(true)}
            className="w-full py-2 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity mt-2 flex-shrink-0 shadow-sm"
          >
            Test
          </button>
        )}
      </div>

      {/* Test Snippet Modal Popup */}
      {isTestModalOpen && (
        <div
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-200"
          onClick={() => setIsTestModalOpen(false)}
        >
          <div
            className="bg-[#171821] border border-neutral-200 dark:border-white/10 rounded-xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-white/10 pb-4 flex-shrink-0">
              <h3 className="text-sm font-semibold text-white">Test Snippet</h3>
              <button
                onClick={() => setIsTestModalOpen(false)}
                className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-4 overflow-y-auto max-h-[60vh] custom-scrollbar pr-2 flex-1">
              {previewFields.length === 0 ? (
                <div className="text-sm text-neutral-500 italic py-2">No dynamic fields found.</div>
              ) : (
                previewFields.map((field) => (
                  <div key={field.id} className="flex flex-col gap-1.5 text-left">
                    <label className="text-[13px] font-medium text-neutral-300 flex items-center justify-between">
                      <span>{field.config?.label || field.alias || (field.fieldType === 'dropdown' ? 'Dropdown' : field.fieldType === 'toggle' ? 'Toggle' : field.fieldType === 'date' ? 'Date' : 'Ask Input')}</span>
                    </label>
                    {field.fieldType === 'dropdown' ? (
                      <select
                        className="w-full px-3 py-1.5 bg-neutral-900 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-neutral-500 transition-colors"
                        value={previewValues[field.id] || field.config?.defaultValue || ''}
                        onChange={(e) => setPreviewValues({ ...previewValues, [field.id]: e.target.value })}
                      >
                        <option value="" disabled hidden className="text-white bg-neutral-900">Select an option...</option>
                        {/* @ts-ignore */}
                        {(field.config?.options || []).map((opt: string, idx: number) => (
                          <option key={idx} value={opt} className="text-white bg-neutral-900">{opt}</option>
                        ))}
                      </select>
                    ) : field.fieldType === 'toggle' ? (
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={previewValues[field.id] === 'true' || (previewValues[field.id] === undefined && field.config?.defaultValue === true)}
                            onChange={(e) => setPreviewValues({ ...previewValues, [field.id]: e.target.checked ? 'true' : 'false' })}
                            className="w-4 h-4 rounded text-white focus:ring-white bg-neutral-900 border-white/20"
                          />
                          <span className="text-sm font-medium text-neutral-300">
                            {previewValues[field.id] === 'true' || (previewValues[field.id] === undefined && field.config?.defaultValue === true) ? (field.config?.trueLabel || 'Yes') : (field.config?.falseLabel || 'No')}
                          </span>
                        </label>
                      </div>
                    ) : field.fieldType === 'date' ? (
                      <input
                        type={field.config?.format === 'time' ? 'time' : field.config?.format === 'datetime' ? 'datetime-local' : 'date'}
                        className="w-full px-3 py-1.5 bg-neutral-900 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-neutral-500 transition-colors"
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
                        className="w-full px-3 py-1.5 bg-neutral-900 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-neutral-500 transition-colors placeholder:text-neutral-500"
                        value={previewValues[field.id] || ''}
                        onChange={(e) => setPreviewValues({ ...previewValues, [field.id]: e.target.value })}
                      />
                    )}
                  </div>
                ))
              )}

              <button
                onClick={handleGenerate}
                className="w-full py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-neutral-200 transition-colors flex-shrink-0 mt-2"
              >
                Generate Result
              </button>

              {previewOutput && (
                <div className="flex flex-col gap-2 flex-1 min-h-0 pt-2">
                  <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Final Output</h3>
                  <div className="max-h-40 overflow-y-auto custom-scrollbar border border-white/10 rounded-lg bg-neutral-950 p-3">
                    <pre className="text-neutral-100 text-[13px] whitespace-pre-wrap font-mono">
                      {previewOutput}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
