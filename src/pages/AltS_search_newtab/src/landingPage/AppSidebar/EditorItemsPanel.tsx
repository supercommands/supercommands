import type * as React from 'react';
import { useMemo } from 'react';
import { FiEdit2, FiFolder, FiBriefcase } from 'react-icons/fi';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import {
  getEditorItemsId,
  getEditorItemsEmptyState,
  getEditorItemsLabel,
  getEditorItemsTitle,
  isInSelectedScope,
  resolveEditorItemsKindFromActiveEditor,
  type ActiveEditorLike,
  type EditorItemsRow,
  type EditorItemsKind,
} from './editorItemsPanelLogic';

interface EditorItemsPanelProps {
  activeEditor: ActiveEditorLike;
  onOpenUrls?: (urls: string[], title?: string) => void;
  onRequestEditLink?: (suggestion: { snippet: any; workspace: any; folder: any }) => void;
  onStartExistingSession?: (suggestion: { snippet: any; workspace: any; folder: any }) => void;
  searchbarRef?: React.RefObject<any>;
  openSpreadsheetView?: (section?: string) => void;
}

import { FaCode } from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';

import { BsCalendarCheck } from 'react-icons/bs';
import NotesIcon from '../../../../../shared-components/icons/notesIcon';
import { getFaviconUrl } from '../../../../../shared-components/searchBarMain/utilityFunctions/utils';
import { useSpreadsheetStore } from '../../../../../shared-components/spreadsheetUi/logic/spreadsheetStateStore';

import StackedLinkIcon from '../../../../../shared-components/icons/stackedLinkIcon';
import { SessionGridIcon } from '../../../../../shared-components/icons/sessionGridIcon';


export const EditorItemsPanel: React.FC<EditorItemsPanelProps> = ({
  activeEditor,
  onOpenUrls,
  onRequestEditLink,
  onStartExistingSession,
  searchbarRef,
  openSpreadsheetView,
}) => {
  const isSnippetMode = useMemo(() => {
    if (activeEditor?.type !== 'note') return false;
    if (
      activeEditor?.props?.snippet?.category === 'snippet' ||
      activeEditor?.props?.snippet?.type === 'snippet' ||
      activeEditor?.props?.category === 'snippet'
    ) {
      return true;
    }
    if (activeEditor?.id && activeEditor?.id !== 'new') {
      const snippets = useDbStore.getState().snippets;
      return snippets.some(s => s.id === activeEditor.id);
    }
    return false;
  }, [activeEditor]);

  const panelType = resolveEditorItemsKindFromActiveEditor(activeEditor);
  const links = useDbStore(state => state.links);
  const sessions = useDbStore(state => state.sessions);
  const notes = useDbStore(state => state.notes);
  const snippets = useDbStore(state => state.snippets);
  const aiPrompts = useDbStore(state => state.aiPrompts);
  const todos = useDbStore(state => state.todos) || [];
  const folders = useDbStore(state => state.folders) || [];
  const workspaces = useDbStore(state => state.workspaces) || [];

  const selectedWorkspaceId = useUIStore(state => state.selectedWorkspaceId);
  const selectedFolderId = useUIStore(state => state.selectedFolderId);

  const items = useMemo(() => {
    const withKind = (list: any[], kind: EditorItemsKind) =>
      list
        .filter(item => {
          if (kind === 'folder' || kind === 'workspace') return true;
          return isInSelectedScope(item, selectedWorkspaceId, selectedFolderId);
        })
        .map(item => ({ item, kind }));

    if (panelType === 'link') return withKind(links, 'link');
    if (panelType === 'session') return withKind(sessions, 'session');
    if (panelType === 'note') return withKind(notes, 'note');
    if (panelType === 'snippet') return withKind(snippets, 'snippet');
    if (panelType === 'aiPrompt') return withKind(aiPrompts, 'aiPrompt');
    if (panelType === 'todo') return withKind(todos, 'todo');
    if (panelType === 'folder') return withKind(folders, 'folder');
    if (panelType === 'workspace') return withKind(workspaces, 'workspace');
    return [];
  }, [
    aiPrompts,
    links,
    notes,
    panelType,
    selectedFolderId,
    selectedWorkspaceId,
    sessions,
    snippets,
    todos,
    folders,
    workspaces,
  ]);

  const triggerExistingItem = (item: any, kind: EditorItemsKind) => {
    const id = getEditorItemsId(item);
    if (!id) return;

    if (kind === 'link') {
      const urls = Array.isArray(item?.urls) ? item.urls.map((u: any) => u.url || u).filter(Boolean) : [];
      const title = getEditorItemsTitle(item);
      if (urls.length > 0) {
        if (onOpenUrls) {
          onOpenUrls(urls, title);
        } else {
          urls.forEach((url: string, index: number) => {
            const chromeAny = (window as any)?.chrome;
            if (chromeAny?.tabs?.create) {
              chromeAny.tabs.create({ url, active: index === 0 });
            } else {
              window.open(url, '_blank');
            }
          });
        }
        return;
      }
      useUIStore.getState().openEditor({ type: 'link', id, props: { snippet: item } });
      return;
    }

    if (kind === 'session') {
      if (onStartExistingSession) {
        const workspace =
          item?.workspace ||
          (item?.workspaceId || item?.workspace_id ? { workspace_id: item.workspaceId || item.workspace_id } : null);
        const folder =
          item?.folder || (item?.folderId || item?.folder_id ? { folder_id: item.folderId || item.folder_id } : null);
        onStartExistingSession({ snippet: item, workspace, folder });
        return;
      }
      useUIStore.getState().openEditor({ type: 'session', id, props: { snippet: item } });
      return;
    }

    if (kind === 'note') {
      useUIStore.getState().openEditor({ type: 'note', id, props: { snippet: item } });
      return;
    }

    if (kind === 'snippet') {
      useUIStore.getState().openEditor({ type: 'snippet', id, props: { snippet: item } });
      return;
    }

    if (kind === 'aiPrompt') {
      useUIStore.getState().openEditor({ type: 'aiPrompt', id, props: { snippet: item } });
      return;
    }
    if (kind === 'todo') {
      useUIStore.getState().setTodoCreatePrefill(item);
      useUIStore.getState().openEditor({ type: 'todo', id: id || String(item.todo_id || item.snippet_id || 'new') });
      return;
    }
    if (kind === 'folder') {
      const folderName = item?.folderName || item?.name || '';
      if (openSpreadsheetView) {
        openSpreadsheetView();
      } else {
        useUIStore.getState().openSheet();
      }
      setTimeout(() => {
        useSpreadsheetStore.getState().setSearchTerm(folderName);
      }, 100);
      return;
    }
    if (kind === 'workspace') {
      useUIStore.getState().setView({
        type: 'settings',
        section: 'allWorkspaces',
      });
      return;
    }
  };

  const editExistingItem = (item: any, kind: EditorItemsKind) => {
    const id = getEditorItemsId(item);
    if (!id) return;

    if (kind === 'link') {
      const workspace =
        item?.workspace ||
        (item?.workspaceId || item?.workspace_id ? { workspace_id: item.workspaceId || item.workspace_id } : null);
      const folder =
        item?.folder || (item?.folderId || item?.folder_id ? { folder_id: item.folderId || item.folder_id } : null);
      const suggestionPayload = { snippet: item, workspace, folder };
      if (onRequestEditLink) {
        onRequestEditLink(suggestionPayload);
      } else {
        useUIStore.getState().setLinkEditPrefill({ snippet: item });
        useUIStore.getState().openEditor({ type: 'link', id, props: { editMode: true, snippet: item } });
      }
      return;
    }

    if (kind === 'session') {
      useUIStore.getState().openEditor({ type: 'session', id, props: { editMode: true, snippet: item } });
      return;
    }

    if (kind === 'note') {
      useUIStore.getState().openEditor({ type: 'note', id, props: { editMode: true, snippet: item } });
      return;
    }

    if (kind === 'snippet') {
      useUIStore.getState().openEditor({ type: 'snippet', id, props: { editMode: true, snippet: item } });
      return;
    }

    if (kind === 'aiPrompt') {
      useUIStore.getState().openEditor({ type: 'aiPrompt', id, props: { editMode: true, snippet: item } });
      return;
    }
    if (kind === 'todo') {
      useUIStore.getState().setTodoCreatePrefill(item);
      useUIStore.getState().openEditor({ type: 'todo', id: id || String(item.todo_id || item.snippet_id || 'new') });
      return;
    }
    if (kind === 'folder') {
      const folderName = item?.folderName || item?.name || '';
      if (openSpreadsheetView) {
        openSpreadsheetView();
      } else {
        useUIStore.getState().openSheet();
      }
      setTimeout(() => {
        useSpreadsheetStore.getState().setSearchTerm(folderName);
      }, 100);
      return;
    }
    if (kind === 'workspace') {
      useUIStore.getState().setView({
        type: 'settings',
        section: 'allWorkspaces',
      });
      return;
    }
  };

  const renderItemIcon = (item: any, kind: EditorItemsKind) => {
    const iconSize = 14;
    if (kind === 'link') {
      let snippetUrls: string[] = [];
      const itemAny = item as any;
      if (Array.isArray(itemAny.urls)) {
        snippetUrls = itemAny.urls.map((u: any) => u.url || u).filter(Boolean);
      } else if (itemAny.url) {
        snippetUrls = [itemAny.url];
      }
      return <StackedLinkIcon urls={snippetUrls} size={iconSize} fallback="link" />;
    }
    if (kind === 'session') {
      const sessionUrls = Array.isArray((item as any)?.urls)
        ? (item as any).urls.map((u: any) => u.url || u).filter(Boolean)
        : [];
      return <StackedLinkIcon urls={sessionUrls} size={iconSize} fallback="session" />;
    }
    if (kind === 'note') {
      return <NotesIcon size={iconSize} className="text-[var(--color-iconDefault)] shrink-0" />;
    }
    if (kind === 'snippet') {
      return <FaCode size={iconSize} className="text-[var(--color-iconDefault)] shrink-0" />;
    }
    if (kind === 'aiPrompt') {
      return <LuSparkles size={iconSize} className="text-[var(--color-iconDefault)] shrink-0" />;
    }
    if (kind === 'todo') {
      return <BsCalendarCheck size={iconSize} className="text-[var(--color-iconDefault)] shrink-0" />;
    }
    if (kind === 'folder') {
      return <FiFolder size={iconSize} className="text-gray-400 shrink-0" />;
    }
    if (kind === 'workspace') {
      return <FiBriefcase size={iconSize} className="text-gray-400 shrink-0" />;
    }
    return null;
  };

  if (!panelType) {
    return (
      <div className="px-3 py-4 text-sm text-neutral-500">Open a link or session editor to see related items.</div>
    );
  }

  if (isSnippetMode || panelType === 'todo') {
    return null;
  }

  return (
    <div className="flex flex-col">
      <div className="px-3 pt-2.5 pb-0 flex items-center justify-between gap-2 group/header relative">
        <div className="flex-1 flex items-center gap-2 pr-[56px]">
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] font-bold tracking-wider uppercase text-neutral-500 dark:text-neutral-400">
              {getEditorItemsLabel(panelType)} ({items.length})
            </span>
          </div>
          <div className="flex-1 border-t border-[#eee8d5] dark:border-white/10" />
        </div>
      </div>
      <div className="px-3 pt-1 pb-3">
        {items.length === 0 ? (
          <div className="px-2 py-3 text-sm text-neutral-500">{getEditorItemsEmptyState(panelType)}</div>
        ) : (
          <div className="flex flex-col">
            {items.map(({ item, kind }: EditorItemsRow) => {
              let linkCount = 0;
              if (kind === 'link') {
                if (Array.isArray((item as any).urls)) {
                  linkCount = (item as any).urls.length;
                } else if ((item as any).url) {
                  linkCount = 1;
                }
              }
              return (
                <div
                  key={`${kind}-${getEditorItemsId(item)}`}
                  onClick={() => triggerExistingItem(item, kind)}
                  className="group flex items-center justify-between cursor-pointer py-[4px] pl-[12px] pr-2 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-150">
                  <div className="min-w-0 flex-1 text-left flex items-center gap-2">
                    <div className="w-4 h-4 flex items-center justify-center shrink-0">
                      {renderItemIcon(item, kind)}
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
                      <span className="truncate text-[12px] font-semibold tracking-tight transition-colors duration-150 text-neutral-500 group-hover:text-neutral-800 dark:text-neutral-400 dark:group-hover:text-neutral-200">
                        {getEditorItemsTitle(item)}
                      </span>
                      {kind === 'link' && linkCount > 1 && (
                        <span className="text-[11px] font-bold flex-shrink-0 transition-colors duration-150 text-neutral-400 group-hover:text-neutral-600 dark:text-neutral-600 dark:group-hover:text-neutral-400">
                          + {linkCount - 1}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Edit item"
                    onClick={e => {
                      e.stopPropagation();
                      editExistingItem(item, kind);
                    }}
                    className="ml-2 rounded p-1 text-[var(--color-iconDefault)] opacity-0 group-hover:opacity-100 hover:bg-black/5 hover:text-neutral-900 dark:hover:bg-white/10 dark:hover:text-white shrink-0 transition-all duration-150 flex items-center justify-center">
                    <FiEdit2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default EditorItemsPanel;
