import { useEffect, useRef } from 'react';
import { useSpreadsheetStore } from '../../../../../shared-components/spreadsheetUi/logic/spreadsheetStateStore';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { extractSnippetIdFromCompoundId } from '../../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { resolveEntityById } from '../../../../../shared-components/utils/entityResolver';
import { useDbStore } from '../../../../../storage/store/useDbStore';

interface UseUrlTriggersProps {
  userId: string;
  openSpreadsheetView: (section?: string) => void;
  searchbarRef: React.MutableRefObject<any>;
  setIsGlobalCreateMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  dismissAllViews: (except?: any) => void;
  handleAltSInitialization: (forceBoardView?: boolean) => void;
}

const normalizeText = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.toLowerCase().trim();
};

const includesQuery = (value: unknown, query: string): boolean => normalizeText(value).includes(query);

const getLinkSearchText = (item: any): string => {
  const parts = [item?.title, item?.name];
  if (typeof item?.url === 'string') parts.push(item.url);
  if (Array.isArray(item?.urls)) {
    for (const link of item.urls) {
      if (typeof link?.title === 'string') parts.push(link.title);
      if (typeof link?.name === 'string') parts.push(link.name);
      if (typeof link?.url === 'string') parts.push(link.url);
    }
  }
  return parts.filter(Boolean).join(' ');
};

const matchesEntityId = (item: any, entityId: string | null): boolean => {
  if (!item || !entityId) return false;
  const candidateIds = [item.id, item.snippet_id, item.todo_id, item.linkid, item.noteid].filter(Boolean);

  return candidateIds.some(candidateId => String(candidateId) === String(entityId));
};

const openNoteById = (noteId: string) => {
  const foundNote = useDbStore.getState().notes.find(note => String(note.id) === String(noteId));
  useUIStore.getState().openItemEditor('note', noteId, {
    props: foundNote ? { snippet: foundNote, category: 'note', editMode: true } : { category: 'note' },
  });
  useUIStore.getState().setView({ type: 'home' });
};

const openSnippetById = (snippetId: string) => {
  const foundSnippet = useDbStore.getState().snippets.find(snippet => String(snippet.id) === String(snippetId));
  useUIStore.getState().openItemEditor('note', snippetId, {
    props: foundSnippet ? { snippet: foundSnippet, editMode: true, category: 'snippet' } : { category: 'snippet' },
  });

  useUIStore.getState().setView({ type: 'home' });
};

const openAutomationById = (automationId: string) => {
  const foundAutomation = useDbStore
    .getState()
    .automations.find(automation => String(automation.id) === String(automationId));
  useUIStore.getState().openItemEditor('agent', automationId, {
    props: foundAutomation
      ? { editMode: true, automation: foundAutomation }
      : { editMode: true, automation: { id: automationId } },
  });
  useUIStore.getState().setView({ type: 'home' });
};

export const useUrlTriggers = ({
  userId,
  openSpreadsheetView,
  searchbarRef,
  setIsGlobalCreateMenuOpen,
  dismissAllViews,
  handleAltSInitialization,
}: UseUrlTriggersProps) => {
  const hasHandledUrlTrigger = useRef(false);
  const openedSessionFromUrlRef = useRef<string | null>(null);
  const dbNotes = useDbStore(state => state.notes);
  const dbLinks = useDbStore(state => state.links);
  const dbSnippets = useDbStore(state => state.snippets);
  const dbAutomations = useDbStore(state => state.automations);
  const dbSessions = useDbStore(state => state.sessions);

  useEffect(() => {
    if (hasHandledUrlTrigger.current) return;

    const urlParams = new URLSearchParams(window.location.search);
    const hasTrigger =
      urlParams.get('focus_sheet_ui_first_column') === 'true' ||
      urlParams.get('force_board_view') === 'true' ||
      urlParams.get('open_create') === 'true' ||
      urlParams.get('open_sheet') !== null ||
      urlParams.get('create_automation') === 'true' ||
      urlParams.get('create_link') === 'true' ||
      urlParams.get('create_prompt') === 'true' ||
      urlParams.get('session_mode') === 'true' ||
      urlParams.get('create_note') === 'true' ||
      urlParams.get('create_snippet') === 'true' ||
      urlParams.get('create_todo') === 'true' ||
      urlParams.get('omnibox') === 'true' ||
      urlParams.get('alts_action') === 'true';
    const hasOmniboxTrigger = urlParams.get('omnibox') === 'true' || urlParams.get('alts_action') === 'true';

    if (hasTrigger && !hasOmniboxTrigger) {
      hasHandledUrlTrigger.current = true;
    }

    if (urlParams.get('focus_sheet_ui_first_column') === 'true') {
      openSpreadsheetView();
      useSpreadsheetStore.getState().setSelectedCell({ rowIndex: 1, colIndex: 0 });
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (urlParams.get('force_board_view') === 'true') {
      handleAltSInitialization(true);
      setTimeout(() => {
        searchbarRef.current?.focus();
      }, 50);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (urlParams.get('open_create') === 'true') {
      dismissAllViews('SHORTCUT_CREATE_MENU');
      setIsGlobalCreateMenuOpen(true);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    const sheetAction = urlParams.get('open_sheet');
    const isEmbedded = urlParams.get('embed') === 'true';

    if (sheetAction) {
      if (isEmbedded) {
        if (sheetAction === 'createnotes') {
          useUIStore.getState().openCreateItem('note', { id: 'new', props: { category: 'note' } });
        } else if (sheetAction === 'createsnippet') {
          useUIStore.getState().openCreateItem('note', { id: 'new', props: { category: 'snippet' } });
        } else if (sheetAction === 'createtodo') {
          useUIStore.getState().openCreateItem('todo', { id: 'new' });
        } else if (sheetAction === 'createlinks') {
          const activeTabUrl = urlParams.get('active_tab_url') || '';
          const activeTabTitle = urlParams.get('active_tab_title') || '';
          useUIStore.getState().openCreateItem('link', {
            id: 'new',
            linkPrefill: { key: activeTabTitle, value: activeTabUrl, category: 'link' } as any,
          });
        } else if (sheetAction === 'createsession') {
          useUIStore.getState().openCreateItem('session', { id: 'new' });
        } else if (sheetAction === 'createprompt') {
          useUIStore.getState().openCreateItem('aiPrompt', { id: 'new', props: {} });
        }
      } else {
        if (sheetAction === 'todo') {
          useUIStore.getState().setSidebar('todoSidebar', { open: true });
        } else if (sheetAction === 'collections') {
          openSpreadsheetView('collections');
        } else if (sheetAction === 'saved-automation') {
          openSpreadsheetView('saved-automation');
        } else if (sheetAction === 'general_commands' || sheetAction === 'commands') {
          openSpreadsheetView('general_commands');
        } else {
          const executeSheetAction = () => {
            if (searchbarRef.current) {
              searchbarRef.current.clear();
              setTimeout(() => {
                const mode = sheetAction === 'store' || sheetAction === 'ai' ? 'lock' : 'execute';
                searchbarRef.current?.executeCommand(sheetAction as any, { mode });
                searchbarRef.current?.focus();
              }, 10);
            } else {
              setTimeout(executeSheetAction, 100);
            }
          };
          executeSheetAction();
        }
      }

      const newParams = new URLSearchParams(window.location.search);
      const preserveOpenSheet = sheetAction === 'general_commands' || sheetAction === 'commands';
      if (!preserveOpenSheet) {
        newParams.delete('open_sheet');
      }
      newParams.delete('active_tab_url');
      newParams.delete('active_tab_title');
      const newSearch = newParams.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '');
      window.history.replaceState({}, '', newUrl);
      hasHandledUrlTrigger.current = true;
      return;
    }

    if (urlParams.get('create_chat_agent') === 'true') {
      setTimeout(() => {
        useUIStore.getState().openCreateItem('ai', { id: 'new', isNew: true });
      }, 150);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (urlParams.get('edit_agent')) {
      const agentId = urlParams.get('edit_agent');
      if (agentId) {
        setTimeout(() => {
          useUIStore.getState().openEditor({ type: 'ai', id: agentId });
        }, 150);
      }
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (urlParams.get('create_automation') === 'true') {
      setTimeout(() => {
        useUIStore.getState().openCreateItem('agent', {
          id: 'new',
          isNew: true,
          props: { editMode: false, automation: null },
        });
      }, 150);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (urlParams.get('create_link') === 'true') {
      const activeTabUrl = decodeURIComponent(urlParams.get('active_tab_url') || '');
      setTimeout(() => {
        const linkPrefillObj = activeTabUrl
          ? { key: '', value: activeTabUrl, category: 'link' }
          : undefined;
        useUIStore.getState().openCreateItem('link', {
          id: 'new',
          props: { prefill: linkPrefillObj },
          linkPrefill: linkPrefillObj,
        });
      }, 150);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (urlParams.get('create_prompt') === 'true') {
      setTimeout(() => {
        useUIStore.getState().openCreateItem('aiPrompt', { id: 'new', props: {} });
      }, 150);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (urlParams.get('session_mode') === 'true') {
      const sessionId = urlParams.get('session_id') || '';
      const sessionName = decodeURIComponent(urlParams.get('session_name') || '');
      let sessionProps = sessionId
        ? {
            session: {
              id: sessionId,
              title: sessionName || 'Untitled Tab Session',
            },
          }
        : undefined;

      try {
        const rawEditorProps = urlParams.get('editorProps');
        if (rawEditorProps) {
          const parsed = JSON.parse(rawEditorProps);
          if (parsed?.props) {
            sessionProps = parsed.props;
          }
        }
      } catch (e) {
        console.error('Failed to parse editorProps for session_mode:', e);
      }

      openedSessionFromUrlRef.current = sessionId || 'new';
      console.log('[SessionFlow][useUrlTriggers] session_mode=true detected → opening session editor', {
        sessionId,
        sessionName,
        sessionProps,
      });
      setTimeout(() => {
        useUIStore.getState().openEditor({
          type: 'session',
          id: sessionId || 'new',
          props: sessionProps,
        });
      }, 150);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (urlParams.get('create_note') === 'true') {
      setTimeout(() => {
        useUIStore.getState().openCreateItem('note', { id: 'new', props: { category: 'note' } });
      }, 150);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (urlParams.get('create_snippet') === 'true') {
      setTimeout(() => {
        useUIStore.getState().openCreateItem('note', { id: 'new', props: { category: 'snippet' } });
      }, 150);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (urlParams.get('create_todo') === 'true') {
      setTimeout(() => {
        useUIStore.getState().openCreateItem('todo', {
          id: 'new',
          props: { prefill: { isCreateModalOnly: true } as any },
          openTodoSidebar: true,
        });
      }, 150);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (urlParams.get('omnibox') === 'true' || urlParams.get('alts_action') === 'true') {
      const type = urlParams.get('type');
      const query = normalizeText(urlParams.get('query') || '');
      const commandId = urlParams.get('id');
      const editMode = urlParams.get('edit_mode') === 'true';
      let editorProps: any = undefined;
      const editorPropsStr = urlParams.get('editorProps');
      if (editorPropsStr) {
        try {
          editorProps = JSON.parse(editorPropsStr);
        } catch (e) {
          console.error('[useUrlTriggers] Failed to parse editorProps', e);
        }
      }
      const entityId =
        urlParams.get('entityId') ||
        urlParams.get('noteid') ||
        urlParams.get('linkid') ||
        urlParams.get('snippetid') ||
        urlParams.get('automationid') ||
        commandId;
      const hasOmniboxTarget =
        (type === 'command' && !!commandId) ||
        ([
          'note',
          'notes',
          'link',
          'links',
          'tabgroup',
          'snippet',
          'snippets',
          'automation',
          'automations',
          'agent',
          'chat_agent',
          'chatagent',
          'aiprompt',
          'ai_prompt',
          'prompt',
          'todo',
          'todos',
        ].includes(type || '') &&
          (!!query || !!entityId));

      console.log('[useUrlTriggers] Detected URL Trigger:', { type, query, commandId, entityId, hasOmniboxTarget });

      if (!type || !hasOmniboxTarget) {
        console.warn('[useUrlTriggers] Aborting trigger: Missing type or valid target.', {
          type,
          hasOmniboxTarget,
          query,
          entityId,
        });
        hasHandledUrlTrigger.current = true;
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }

      let cancelled = false;
      let attempts = 0;
      const maxAttempts = 80;
      const retryDelayMs = 100;

      const tryHandleOmnibox = async () => {
        if (cancelled) return;
        const currentIsLoggedIn = userId !== '';
        if (!searchbarRef.current || (!currentIsLoggedIn && attempts < 30)) {
          if (attempts++ < maxAttempts) {
            window.setTimeout(tryHandleOmnibox, retryDelayMs);
          }
          return;
        }

        const noteCandidates = [...dbNotes];
        const linkCandidates = [...dbLinks];
        const snippetCandidates = [...dbSnippets];
        const automationCandidates = [...dbAutomations];
        const aiPromptCandidates = useDbStore.getState().aiPrompts || [];

        let resolvedEntity: any = null;
        if (entityId) {
          try {
            resolvedEntity = await resolveEntityById(entityId);
          } catch (e) {
            console.error('[useUrlTriggers] Error resolving entity by ID:', e);
          }
        }

        if (type === 'note') {
          console.log('[useUrlTriggers] Searching for note:', { entityId, query });
          const foundNote =
            resolvedEntity?.entity ||
            noteCandidates.find(item => matchesEntityId(item, entityId)) ||
            (query ? noteCandidates.find(item => includesQuery(item.title, query)) : null);
          if (foundNote || editorProps) {
            if (editorProps && editorProps.props) {
              useUIStore.getState().openItemEditor('note', String(foundNote?.id || entityId || 'new'), editorProps);
              useUIStore.getState().setView({ type: 'home' });
            } else if (foundNote) {
              openNoteById(String(foundNote.id));
            }
          } else {
            useUIStore.getState().setView({ type: 'home' });
            useUIStore.getState().openCreateItem('note', { id: 'new', props: { category: 'note' } });
          }
        } else if (type === 'link') {
          const foundLink =
            resolvedEntity?.entity || linkCandidates.find(item => includesQuery(getLinkSearchText(item), query));
          if (foundLink || editorProps) {
            if (editMode) {
              useUIStore.getState().setView({ type: 'home' });
              useUIStore.getState().openItemEditor('link', String(foundLink?.id || entityId || 'new'), editorProps);
            } else if (searchbarRef.current?.executeSnippet && foundLink) {
              searchbarRef.current.executeSnippet(foundLink);
            }
          } else {
            useUIStore.getState().setView({ type: 'home' });
            useUIStore.getState().openCreateItem('link', { id: 'new', props: { category: 'link' } });
          }
        } else if (['session', 'sessions'].includes(type || '')) {
          if (resolvedEntity?.entity) {
            const session = resolvedEntity.entity as any;
            chrome.runtime.sendMessage({
              action: 'start_session',
              sessionId: String(session.id || '').trim(),
              sessionName: session.title || 'Untitled Tab Session',
              workspaceId: session.workspaceId,
              folderId: session.folderId || null,
              initialUrls: session.urls?.map((u: any) => u.url) || [],
              initialNames: session.urls?.map((u: any) => u.title || u.name || '') || [],
              openSettings: session.sessionOpenSettings,
            });
          } else {
            useUIStore.getState().setView({ type: 'home' });
            useUIStore.getState().openCreateItem('session', { id: 'new' });
          }
        } else if (type === 'snippet') {
          const foundSnippet =
            resolvedEntity?.entity ||
            snippetCandidates.find(
              item =>
                includesQuery(item.title, query) ||
                includesQuery((item as any).key, query) ||
                includesQuery((item as any).name, query),
            );
          if (foundSnippet || editorProps) {
            if (editorProps && editorProps.props) {
              useUIStore.getState().openItemEditor('note', String(foundSnippet?.id || entityId || 'new'), {
                ...editorProps,
                props: {
                  ...editorProps?.props,
                  category: 'snippet',
                },
              });
              useUIStore.getState().setView({ type: 'home' });
            } else if (foundSnippet) {
              openSnippetById(String(foundSnippet.id));
            }
          } else {
            useUIStore.getState().setView({ type: 'home' });
            useUIStore.getState().openCreateItem('snippet', { id: 'new' });
          }
        } else if (['automation', 'automations'].includes(type || '')) {
          const foundAutomation =
            resolvedEntity?.entity || automationCandidates.find(item => includesQuery(item.name, query));
          if (foundAutomation) {
            openAutomationById(String(foundAutomation.id));
          } else {
            useUIStore.getState().setView({ type: 'home' });
            useUIStore.getState().openCreateItem('agent', {
              id: 'new',
              isNew: true,
              props: { editMode: false, automation: null },
            });
          }
        } else if (['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(type || '')) {
          const foundPrompt =
            resolvedEntity?.entity || aiPromptCandidates.find(item => includesQuery(item.title, query));
          if (foundPrompt || editorProps) {
            useUIStore.getState().setView({ type: 'home' });
            useUIStore.getState().openItemEditor('aiPrompt', String(foundPrompt?.id || entityId || 'new'), editorProps);
          } else {
            // Check if it's an automation in the DB (for 'agent' overlap)
            const foundAuto = automationCandidates.find(item => includesQuery(item.name, query));
            if (foundAuto) {
              openAutomationById(String(foundAuto.id));
            } else {
              useUIStore.getState().setView({ type: 'home' });
              useUIStore.getState().openCreateItem('aiPrompt', { id: 'new', props: {} });
            }
          }
        } else if (type === 'todo') {
          const foundTodo = resolvedEntity?.entity;
          if (foundTodo || editorProps) {
            useUIStore.getState().setView({ type: 'home' });
            useUIStore
              .getState()
              .setTodoCreatePrefill(foundTodo || editorProps?.props?.prefill || editorProps?.props?.item || null);
            useUIStore.getState().openItemEditor('todo', String(foundTodo?.id || entityId || 'new'), editorProps);
          } else {
            useUIStore.getState().setView({ type: 'home' });
            useUIStore.getState().openCreateItem('todo', {
              id: 'new',
              props: { prefill: { isCreateModalOnly: true } as any },
              openTodoSidebar: true,
            });
          }
        } else if (type === 'command') {
          if (commandId) {
            if (commandId === 'search') {
              openSpreadsheetView();
              hasHandledUrlTrigger.current = true;
              window.history.replaceState({}, '', window.location.pathname);
              return;
            }
            if (query) {
              searchbarRef.current.setValue(query);
            }
            setTimeout(() => {
              searchbarRef.current?.executeCommand(commandId as any, { mode: 'execute' });
            }, 50);
          }
        }

        hasHandledUrlTrigger.current = true;
        window.history.replaceState({}, '', window.location.pathname);
      };

      tryHandleOmnibox();
      return () => {
        cancelled = true;
      };
    }

    if (urlParams.get('trigger_hotkey') !== 'true') return;

    const type = urlParams.get('type');
    const rawId = urlParams.get('id');
    if (!rawId) {
      console.warn('[App] [HOTKEY_TRIGGER] Trigger detected but missing ID parameter');
      return;
    }

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 80;
    const retryDelayMs = 100;

    const findById = (records: any[], id: string) => records.find(record => String(record?.id) === id);

    const tryHandle = () => {
      if (cancelled) return;
      const currentIsLoggedIn = userId !== '';
      if (!searchbarRef.current || (!currentIsLoggedIn && attempts < 30)) {
        if (attempts++ < maxAttempts) {
          window.setTimeout(tryHandle, retryDelayMs);
        }
        return;
      }

      let normalizedId = rawId.startsWith('/') ? rawId.substring(1) : rawId;
      normalizedId = normalizedId.replace(/^automation-/, '').replace(/^agent-/, '');

      if (type === 'command') {
        searchbarRef.current.executeCommand(normalizedId as any, { mode: 'execute' });
        if (!searchbarRef.current.isLocked) searchbarRef.current.focus();
        return;
      }

      if (type === 'module') {
        searchbarRef.current.executeModule(normalizedId);
        return;
      }

      if (
        ['automation', 'automations', 'agent', 'chat_agent', 'chatagent', 'aiprompt', 'ai_prompt', 'prompt'].includes(
          type || '',
        )
      ) {
        let foundAuto = findById(dbAutomations, normalizedId);
        if (!foundAuto) {
          foundAuto = dbAutomations.find(auto => includesQuery(auto.name, normalizedId));
        }
        if (foundAuto) {
          openAutomationById(String(foundAuto.id));
          return;
        }

        // Also check AI Prompts!
        const aiPromptCandidates = useDbStore.getState().aiPrompts || [];
        let foundPrompt = findById(aiPromptCandidates, normalizedId);
        if (!foundPrompt) {
          foundPrompt = aiPromptCandidates.find((p: any) => includesQuery(p.title, normalizedId));
        }
        if (foundPrompt) {
          useUIStore.getState().setView({ type: 'home' });
          useUIStore.getState().openItemEditor('aiPrompt', String(foundPrompt.id));
          return;
        }

        searchbarRef.current.executeCommand(normalizedId as any, { mode: 'execute' });
        if (!searchbarRef.current.isLocked) searchbarRef.current.focus();
        return;
      }

      if (['session', 'sessions', 'tab session'].includes(type || '')) {
        const actualItemId = extractSnippetIdFromCompoundId(normalizedId);
        const foundSession = findById(dbSessions, actualItemId);
        if (foundSession) {
          chrome.runtime.sendMessage({
            action: 'start_session',
            sessionId: String(foundSession.id || '').trim(),
            sessionName: foundSession.title || 'Untitled Tab Session',
            workspaceId: foundSession.workspaceId || null,
            folderId: foundSession.folderId || null,
            initialUrls: foundSession.urls?.map((u: any) => u.url) || [],
            initialNames: foundSession.urls?.map((u: any) => u.title || u.name || '') || [],
            openSettings: foundSession.sessionOpenSettings,
          });
        } else {
          console.warn(`[App] Session not found for ID: ${normalizedId}. Falling back to command execution.`);
          searchbarRef.current.executeCommand(normalizedId as any, { mode: 'execute' });
          if (!searchbarRef.current.isLocked) searchbarRef.current.focus();
        }
        return;
      }

      if (['link', 'links', 'tabgroup', 'note', 'notes', 'snippet', 'snippets'].includes(type || '')) {
        const isLinkType = ['link', 'links', 'tabgroup'].includes(type || '');
        const isNoteType = ['note', 'notes'].includes(type || '');

        const actualItemId = extractSnippetIdFromCompoundId(normalizedId);

        const foundItem: any = isLinkType
          ? findById(dbLinks, actualItemId) || findById(dbSnippets, actualItemId)
          : isNoteType
            ? findById(dbNotes, actualItemId) || findById(dbSnippets, actualItemId)
            : findById(dbSnippets, actualItemId) || findById(dbNotes, actualItemId);

        if (foundItem && isLinkType) {
          if (searchbarRef.current?.executeSnippet) {
            searchbarRef.current.executeSnippet(foundItem);
          } else {
            useUIStore.getState().openCreateItem('link', { id: 'new', props: { category: 'link' } });
          }
        } else if (foundItem) {
          openNoteById(String(foundItem.id));
        } else {
          console.warn(`[App] ${type} not found for ID: ${normalizedId}. Falling back to command execution.`);
          searchbarRef.current.executeCommand(normalizedId as any, { mode: 'execute' });
          if (!searchbarRef.current.isLocked) searchbarRef.current.focus();
        }
        return;
      }
    };

    tryHandle();
    return () => {
      cancelled = true;
    };
  }, [
    dbAutomations,
    dbLinks,
    dbNotes,
    dbSnippets,
    dismissAllViews,
    handleAltSInitialization,
    openSpreadsheetView,
    searchbarRef,
    setIsGlobalCreateMenuOpen,
    userId,
  ]);

  // On every page load (including refresh with no URL params), check if this Chrome window
  // has an active session. If yes, auto-open the session editor so the pinned tab recovers.
  useEffect(() => {
    const chromeAny = (window as any)?.chrome;
    if (!chromeAny?.windows || !chromeAny?.storage?.local) return;

    // Only activate if the URL doesn't already have session_mode (that case is handled above)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('session_mode') === 'true') return;

    chromeAny.windows.getCurrent((currentWindow: any) => {
      if (!currentWindow?.id) return;
      chromeAny.storage.local.get('active_sessions', (result: any) => {
        const sessions: { sessionId: string; sessionName: string; windowId: number }[] = result.active_sessions || [];
        const matchedSession = sessions.find(s => s.windowId === currentWindow.id);
        if (matchedSession) {
          const activeEditor = useUIStore.getState().activeEditor;
          const alreadyOpenedFromUrl = openedSessionFromUrlRef.current === matchedSession.sessionId;
          const isAlreadyActiveEditor =
            activeEditor?.type === 'session' && String(activeEditor.id || '') === String(matchedSession.sessionId);
          if (alreadyOpenedFromUrl || isAlreadyActiveEditor) {
            return;
          }
          console.log(
            '[SessionFlow][useUrlTriggers] Active session found for this window on load/refresh:',
            matchedSession.sessionId,
            '— opening session editor',
          );
          useUIStore.getState().openEditor({
            type: 'session',
            id: matchedSession.sessionId,
            props: {
              session: {
                id: matchedSession.sessionId,
                title: matchedSession.sessionName || 'Untitled Tab Session',
              },
            },
          });
        } else {
          console.log(
            '[SessionFlow][useUrlTriggers] No active session for this window (normal tab load). windowId:',
            currentWindow.id,
          );
        }
      });
    });
  }, []);
};
