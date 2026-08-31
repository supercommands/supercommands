import { useEffect, useRef } from 'react';
import { useSpreadsheetStore } from '../../../../../shared-components/spreadsheetUi/logic/spreadsheetStateStore';
import { useUIStore } from '../../../../../shared-components/uiStateManager';
import { extractSnippetIdFromCompoundId } from '../../../../../shared-components/hotkeys/utils/hotkeyUtils';
import { resolveEntityById } from '../../../../../shared-components/utils/entityResolver';
import { useDbStore } from '../../../../../storage/store/useDbStore';
import { commandRegistry } from '../../../../../shared-components/commands';
import { hasRunnableAiPrompt, runAiPrompt } from '../../../../../allObjectFolder/src/createObject/aiPrompt/runAiPrompt';
import { launchDashboardCollectionView } from '../../../../../shared-components/dashboardCollections/launchDashboardCollectionView';
import {
  handleSessionReferenceLaunchActions,
  launchSessionSmartWithReferences,
} from '../../../../../allObjectFolder/src/createObject/session/sessionReferenceActions';
import type { CollectionOpenBehavior } from '../../../../../allObjectFolder/src/createObject/widgets/widgetTypes';
import type { AiPromptRecord } from '../../../../../allObjectFolder/src/createObject/aiPrompt/aiPromptTypes';

export interface MissingAiPromptInputRequest {
  promptRecord: AiPromptRecord;
  promptId: string;
  editorProps?: unknown;
}

interface UseUrlTriggersProps {
  userId: string;
  openSpreadsheetView: (section?: string) => void;
  searchbarRef: React.MutableRefObject<any>;
  setIsGlobalCreateMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  dismissAllViews: (except?: any) => void;
  handleAltSInitialization: (forceBoardView?: boolean) => void;
  requestMissingAiPromptInput?: (request: MissingAiPromptInputRequest) => void;
}

const ENABLE_SESSION_FLOW_URL_TRIGGER_LOGS = false;

const sessionFlowUrlTriggerDebug = (...args: unknown[]) => {
  if (!ENABLE_SESSION_FLOW_URL_TRIGGER_LOGS) return;
  console.log(...args);
};

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

const openNoteById = (noteId: string, resolvedNote?: any) => {
  const foundNote = resolvedNote || useDbStore
    .getState()
    .notes.find(note => String(note.id) === String(noteId) || String((note as any).snippet_id || '') === String(noteId));
  useUIStore.getState().setView({ type: 'home' });
  useUIStore.getState().openItemEditor('note', noteId, {
    props: foundNote ? { snippet: foundNote, category: 'note', editMode: true } : { category: 'note' },
  });
};

const openSnippetById = (snippetId: string, resolvedSnippet?: any) => {
  const foundSnippet = resolvedSnippet || useDbStore.getState().snippets.find(snippet => String(snippet.id) === String(snippetId));
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

const getCollectionOpenBehaviorFromUrl = (urlParams: URLSearchParams): CollectionOpenBehavior | undefined => {
  return urlParams.get('openBehavior') === 'focus_mode' ? 'focus_mode' : undefined;
};

const launchCollectionViewById = async (
  referenceId: string,
  openBehavior?: CollectionOpenBehavior,
): Promise<boolean> => {
  return launchDashboardCollectionView(referenceId, { mode: 'open', openBehavior });
};

const getCurrentExtensionTabContext = async () => {
  const chromeAny = (window as any).chrome;
  const fallbackToCurrentWindow = () =>
    new Promise<{ currentTabId?: number; currentWindowId?: number; currentPageUrl?: string }>(resolve => {
      if (!chromeAny?.windows?.getCurrent) {
        resolve({ currentPageUrl: window.location.href });
        return;
      }

      chromeAny.windows.getCurrent({ populate: false }, (win: any) => {
        resolve({
          currentWindowId: win?.id,
          currentPageUrl: window.location.href,
        });
      });
    });

  if (!chromeAny?.tabs?.getCurrent) {
    return fallbackToCurrentWindow();
  }

  return new Promise<{ currentTabId?: number; currentWindowId?: number; currentPageUrl?: string }>(resolve => {
    chromeAny.tabs.getCurrent((tab: any) => {
      if (typeof tab?.windowId !== 'number') {
        fallbackToCurrentWindow().then(resolve);
        return;
      }

      resolve({
        currentTabId: tab?.id,
        currentWindowId: tab?.windowId,
        currentPageUrl: tab?.url || window.location.href,
      });
    });
  });
};

const hasCommandQueryPlaceholder = (url: string): boolean =>
  /\{query\s*\}|\[query\s*\]|\{content\s*\}|\{prompt\s*\}/i.test(url);

const tryRunDirectUrlCommand = async (commandId?: string | null): Promise<boolean> => {
  const normalizedCommandId = String(commandId || '').trim();
  if (!normalizedCommandId) return false;

  const command = commandRegistry.get(normalizedCommandId);
  const url = String((command as any)?.urlTemplate || (command as any)?.url || '').trim();
  if (!url || hasCommandQueryPlaceholder(url)) {
    console.log('[UrlTrigger][direct-command] skipped', {
      commandId: normalizedCommandId,
      hasCommand: Boolean(command),
      url,
      reason: !url ? 'no_direct_url' : 'query_placeholder',
    });
    return false;
  }

  console.log('[UrlTrigger][direct-command] attempting', {
    commandId: normalizedCommandId,
    url,
  });

  const chromeAny = (window as any).chrome;
  if (chromeAny?.tabs?.getCurrent && chromeAny?.tabs?.update) {
    const updated = await new Promise<boolean>(resolve => {
      chromeAny.tabs.getCurrent((tab: any) => {
        if (chromeAny.runtime?.lastError || typeof tab?.id !== 'number') {
          console.warn('[UrlTrigger][direct-command] current tab unavailable', {
            commandId: normalizedCommandId,
            runtimeError: chromeAny.runtime?.lastError?.message,
          });
          resolve(false);
          return;
        }
        chromeAny.tabs.update(tab.id, { url }, () => {
          const ok = !chromeAny.runtime?.lastError;
          console.log('[UrlTrigger][direct-command] current tab update result', {
            commandId: normalizedCommandId,
            tabId: tab.id,
            ok,
            runtimeError: chromeAny.runtime?.lastError?.message,
          });
          resolve(ok);
        });
      });
    });
    if (updated) return true;
  }

  if (chromeAny?.tabs?.create) {
    console.log('[UrlTrigger][direct-command] opening new tab fallback', {
      commandId: normalizedCommandId,
      url,
    });
    chromeAny.tabs.create({ url, active: true });
    return true;
  }

  console.log('[UrlTrigger][direct-command] window.location fallback', {
    commandId: normalizedCommandId,
    url,
  });
  window.location.href = url;
  return true;
};

const replaceTriggerUrlWithNormalNewtabUrl = () => {
  window.history.replaceState({}, '', window.location.pathname);
};

export const useUrlTriggers = ({
  userId,
  openSpreadsheetView,
  searchbarRef,
  setIsGlobalCreateMenuOpen,
  dismissAllViews,
  handleAltSInitialization,
  requestMissingAiPromptInput,
}: UseUrlTriggersProps) => {
  const handledUrlTriggerKeyRef = useRef<string | null>(null);
  const isHandlingUrlTrigger = useRef(false);
  const openedSessionFromUrlRef = useRef<string | null>(null);
  const handledSessionReferenceDispatchesRef = useRef<Set<string>>(new Set());
  const dbNotes = useDbStore(state => state.notes);
  const dbLinks = useDbStore(state => state.links);
  const dbSnippets = useDbStore(state => state.snippets);
  const dbAutomations = useDbStore(state => state.automations);
  const dbSessions = useDbStore(state => state.sessions);
  const isDbInitialized = useDbStore(state => state.isInitialized);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('session_reference') === 'true') {
      const referenceType = urlParams.get('type');
      const referenceId = urlParams.get('id');
      if ((referenceType === 'note' || referenceType === 'snippet') && referenceId) {
        if (!isDbInitialized) return;
        const referenceKey = `${referenceType}:${referenceId}`;
        if (handledSessionReferenceDispatchesRef.current.has(referenceKey)) return;
        handledSessionReferenceDispatchesRef.current.add(referenceKey);
        console.log('[SessionLaunchTrace] opening session reference tab', {
          referenceType,
          referenceId,
        });
        window.setTimeout(() => {
          if (referenceType === 'note') {
            openNoteById(referenceId);
          } else {
            openSnippetById(referenceId);
          }
          console.log('[SessionLaunchTrace] session reference editor requested', {
            referenceType,
            referenceId,
            activeEditor: useUIStore.getState().activeEditor,
          });
        }, 100);
        return;
      }
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    const currentTriggerKey = `${window.location.pathname}${window.location.search}`;
    if (isHandlingUrlTrigger.current || handledUrlTriggerKeyRef.current === currentTriggerKey) {
      if (window.location.search) {
        sessionFlowUrlTriggerDebug('[UrlTrigger][guard] skipped', {
          currentTriggerKey,
          isHandling: isHandlingUrlTrigger.current,
          handledKey: handledUrlTriggerKeyRef.current,
          href: window.location.href,
        });
      }
      return;
    }

    const hasTrigger =
      urlParams.get('focus_sheet_ui_first_column') === 'true' ||
      urlParams.get('force_board_view') === 'true' ||
      urlParams.get('open_sheet') !== null ||
      urlParams.get('create_automation') === 'true' ||
      urlParams.get('create_link') === 'true' ||
      urlParams.get('create_prompt') === 'true' ||
      urlParams.get('session_mode') === 'true' ||
      urlParams.get('create_note') === 'true' ||
      urlParams.get('create_snippet') === 'true' ||
      urlParams.get('create_todo') === 'true' ||
      urlParams.get('trigger_hotkey') === 'true' ||
      urlParams.get('omnibox') === 'true' ||
      urlParams.get('alts_action') === 'true';
    const hasOmniboxTrigger = urlParams.get('omnibox') === 'true' || urlParams.get('alts_action') === 'true';

    if (hasTrigger || hasOmniboxTrigger || urlParams.get('trigger_hotkey') === 'true') {
      console.log('[UrlTrigger][detected]', {
        href: window.location.href,
        currentTriggerKey,
        hasTrigger,
        hasOmniboxTrigger,
        triggerHotkey: urlParams.get('trigger_hotkey'),
        type: urlParams.get('type'),
        id: urlParams.get('id'),
        query: urlParams.get('query'),
        isDbInitialized,
        hasSearchbarRef: Boolean(searchbarRef.current),
        userReady: userId !== '',
      });
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
      handledUrlTriggerKeyRef.current = currentTriggerKey;
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
      sessionFlowUrlTriggerDebug('[SessionFlow][useUrlTriggers] session_mode=true detected -> opening session editor', {
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
      const temporaryPrompt = urlParams.get('temporaryPrompt') || '';
      const collectionOpenBehavior = getCollectionOpenBehaviorFromUrl(urlParams);
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
          'collection',
          'collections',
          'collection_view',
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
        handledUrlTriggerKeyRef.current = currentTriggerKey;
        replaceTriggerUrlWithNormalNewtabUrl();
        return;
      }

      const invocationKey = `${window.location.pathname}${window.location.search}`;
      const windowWithInvocationGuard = window as typeof window & {
        __cmdosOmniboxInvocationsInFlight?: Set<string>;
      };
      const inFlightInvocations =
        windowWithInvocationGuard.__cmdosOmniboxInvocationsInFlight ||
        new Set<string>();
      windowWithInvocationGuard.__cmdosOmniboxInvocationsInFlight = inFlightInvocations;

      if (inFlightInvocations.has(invocationKey)) {
        console.warn('[useUrlTriggers] Duplicate omnibox invocation suppressed:', { invocationKey });
        return;
      }

      inFlightInvocations.add(invocationKey);
      isHandlingUrlTrigger.current = true;
      let attempts = 0;
      const maxAttempts = 80;
      const retryDelayMs = 100;

      const releaseOmniboxInvocation = () => {
        inFlightInvocations.delete(invocationKey);
        isHandlingUrlTrigger.current = false;
      };

      replaceTriggerUrlWithNormalNewtabUrl();

      const tryHandleOmnibox = async () => {
        console.log('[UrlTrigger][omnibox] handling attempt', {
          invocationKey,
          type,
          commandId,
          query,
          attempts,
          isDbInitialized: useDbStore.getState().isInitialized,
          renderIsDbInitialized: isDbInitialized,
          hasSearchbarRef: Boolean(searchbarRef.current),
          userReady: userId !== '',
        });

        if (type === 'command' && commandId && await tryRunDirectUrlCommand(commandId)) {
          console.log('[UrlTrigger][omnibox] command handled by direct URL executor', {
            commandId,
            invocationKey,
          });
          handledUrlTriggerKeyRef.current = currentTriggerKey;
          releaseOmniboxInvocation();
          return;
        }

        const currentIsLoggedIn = userId !== '';
        const currentIsDbInitialized = useDbStore.getState().isInitialized;
        const directDbTargetTypes = [
          'note',
          'notes',
          'snippet',
          'snippets',
          'todo',
          'todos',
          'automation',
          'automations',
          'agent',
          'chat_agent',
          'chatagent',
          'aiprompt',
          'ai_prompt',
          'prompt',
          'collection',
          'collections',
          'collection_view',
          'session',
          'sessions',
        ];
        const hasDirectDbTarget = Boolean(entityId && directDbTargetTypes.includes(type || ''));
        const needsSearchbarRef = type === 'command' || ['link', 'links', 'tabgroup'].includes(type || '');
        const needsUserReady = !hasDirectDbTarget;
        if (
          (needsSearchbarRef && !searchbarRef.current) ||
          !currentIsDbInitialized ||
          (needsUserReady && !currentIsLoggedIn && attempts < 30)
        ) {
          console.log('[UrlTrigger][omnibox] waiting for readiness', {
            invocationKey,
            attempts,
            hasSearchbarRef: Boolean(searchbarRef.current),
            needsSearchbarRef,
            hasDirectDbTarget,
            needsUserReady,
            currentIsDbInitialized,
            renderIsDbInitialized: isDbInitialized,
            currentIsLoggedIn,
          });
          if (attempts++ < maxAttempts) {
            window.setTimeout(tryHandleOmnibox, retryDelayMs);
          } else {
            console.warn('[useUrlTriggers] Omnibox trigger timed out before the UI became ready.', {
              invocationKey,
              currentIsDbInitialized,
              renderIsDbInitialized: isDbInitialized,
            });
            releaseOmniboxInvocation();
          }
          return;
        }

        const latestDbState = useDbStore.getState();
        const noteCandidates = [...(latestDbState.notes || [])];
        const linkCandidates = [...(latestDbState.links || [])];
        const snippetCandidates = [...(latestDbState.snippets || [])];
        const automationCandidates = [...(latestDbState.automations || [])];
        const chatAgentCandidates = latestDbState.chatAgents || [];
        const aiPromptCandidates = latestDbState.aiPrompts || [];
        const widgetViewCandidates = latestDbState.widgetViews || [];

        let resolvedEntity: any = null;
        if (entityId) {
          try {
            resolvedEntity = await resolveEntityById(entityId);
          } catch (e) {
            console.error('[useUrlTriggers] Error resolving entity by ID:', e);
          }
        }

        if (type === 'note') {
          const foundNote =
            (resolvedEntity?.type === 'note' ? resolvedEntity.entity : null) ||
            noteCandidates.find(item => matchesEntityId(item, entityId)) ||
            (query ? noteCandidates.find(item => includesQuery(item.title, query)) : null);
          console.log('[useUrlTriggers] Searching for note:', {
            entityId,
            query,
            resolvedType: resolvedEntity?.type || null,
            foundNoteId: foundNote?.id || (foundNote as any)?.snippet_id || null,
            noteCount: noteCandidates.length,
          });
          if (foundNote || editorProps) {
            if (editorProps && editorProps.props) {
              const snipObj = editorProps.props.item || editorProps.props.snippet || foundNote;
              const mergedProps = {
                ...editorProps.props,
                initialDraftKey: editorProps.props.initialDraftKey || snipObj?.title || snipObj?.name || snipObj?.key,
                initialDraftContent: editorProps.props.initialDraftContent || snipObj?.body || snipObj?.content || snipObj?.value || (typeof snipObj?.config === 'string' ? snipObj.config : JSON.stringify(snipObj?.config || '')),
              };
              useUIStore.getState().openItemEditor('note', String(foundNote?.id || entityId || 'new'), { props: mergedProps });
              useUIStore.getState().setView({ type: 'home' });
            } else if (foundNote) {
              const foundNoteId = String(foundNote.id || (foundNote as any).snippet_id);
              window.setTimeout(() => {
                openNoteById(foundNoteId, foundNote);
                console.log('[UrlTrigger][omnibox] note editor requested', {
                  noteId: foundNoteId,
                  activeEditor: useUIStore.getState().activeEditor,
                });
              }, 100);
            }
          } else {
            console.warn('[useUrlTriggers] Note trigger did not resolve a note; opening create note fallback.', {
              entityId,
              query,
              noteCount: noteCandidates.length,
            });
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
        } else if (['collection', 'collections', 'collection_view'].includes(type || '')) {
          const foundView =
            widgetViewCandidates.find(view => String(view.id) === String(entityId || commandId || '')) ||
            widgetViewCandidates.find(view => normalizeText(view.title) === query) ||
            widgetViewCandidates.find(view => includesQuery(view.title, query));
          if (foundView) {
            await launchCollectionViewById(String(foundView.id), collectionOpenBehavior);
          } else if (entityId || commandId) {
            await launchCollectionViewById(String(entityId || commandId), collectionOpenBehavior);
          } else {
            useUIStore.getState().setView({ type: 'home' });
          }
        } else if (['session', 'sessions'].includes(type || '')) {
          if (resolvedEntity?.entity) {
            const session = resolvedEntity.entity as any;
            await launchSessionSmartWithReferences(session, {
              source: 'omnibox',
              requireAutoSave: false,
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
              openSnippetById(String(foundSnippet.id), foundSnippet);
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
          const isChatAgentTrigger = ['chatagent', 'chat_agent', 'agent'].includes(type || '');
          const foundChatAgent =
            (resolvedEntity?.type === 'chatAgent' ? resolvedEntity.entity : null) ||
            (isChatAgentTrigger
              ? chatAgentCandidates.find((item: any) => matchesEntityId(item, entityId)) ||
                chatAgentCandidates.find((item: any) => includesQuery(item.title, query))
              : null);
          if (foundChatAgent) {
            useUIStore.getState().setView({ type: 'home' });
            useUIStore.getState().openEditor({ type: 'ai', id: String(foundChatAgent.id || entityId || 'new') });
            handledUrlTriggerKeyRef.current = currentTriggerKey;
            releaseOmniboxInvocation();
            window.history.replaceState({}, '', window.location.pathname);
            return;
          }

          const foundPrompt =
            (resolvedEntity?.type === 'aiPrompt' ? resolvedEntity.entity : null) ||
            aiPromptCandidates.find(item => includesQuery(item.title, query));
          if (foundPrompt || editorProps) {
            useUIStore.getState().setView({ type: 'home' });
            const isRunPromptFromOmniboxCommand =
              urlParams.get('omnibox') === 'true' && urlParams.get('runPrompt') === 'true' && !editMode && !editorProps;
            const shouldRunFromOmnibox =
              isRunPromptFromOmniboxCommand && hasRunnableAiPrompt(foundPrompt, temporaryPrompt);
            if (shouldRunFromOmnibox) {
              try {
                await runAiPrompt(foundPrompt, temporaryPrompt);
              } catch (error) {
                console.error('[useUrlTriggers] Failed to run AI prompt from omnibox:', error);
              }
            } else if (isRunPromptFromOmniboxCommand && foundPrompt && requestMissingAiPromptInput) {
              requestMissingAiPromptInput({
                promptRecord: foundPrompt,
                promptId: String(foundPrompt.id || entityId || 'new'),
                editorProps,
              });
            } else {
              useUIStore.getState().openItemEditor('aiPrompt', String(foundPrompt?.id || entityId || 'new'), editorProps);
            }
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
            console.log('[UrlTrigger][omnibox] executing command through searchbar', {
              commandId,
              query,
            });
            if (commandId === 'search') {
              openSpreadsheetView();
              handledUrlTriggerKeyRef.current = currentTriggerKey;
              releaseOmniboxInvocation();
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

        handledUrlTriggerKeyRef.current = currentTriggerKey;
        releaseOmniboxInvocation();
        window.history.replaceState({}, '', window.location.pathname);
      };

      void tryHandleOmnibox().catch(error => {
        console.error('[useUrlTriggers] Unhandled omnibox trigger failure:', error);
        releaseOmniboxInvocation();
      });
      return;
    }

    if (urlParams.get('trigger_hotkey') !== 'true') return;

    const type = urlParams.get('type');
    const rawId = urlParams.get('id');
    const collectionOpenBehavior = getCollectionOpenBehaviorFromUrl(urlParams);
    if (!rawId) {
      console.warn('[App] [HOTKEY_TRIGGER] Trigger detected but missing ID parameter');
      replaceTriggerUrlWithNormalNewtabUrl();
      return;
    }

    const invocationKey = currentTriggerKey;
    const windowWithHotkeyGuard = window as typeof window & {
      __cmdosHotkeyInvocationsInFlight?: Set<string>;
    };
    const inFlightHotkeyInvocations =
      windowWithHotkeyGuard.__cmdosHotkeyInvocationsInFlight ||
      new Set<string>();
    windowWithHotkeyGuard.__cmdosHotkeyInvocationsInFlight = inFlightHotkeyInvocations;

    if (inFlightHotkeyInvocations.has(invocationKey)) {
      console.warn('[UrlTrigger][hotkey] duplicate invocation suppressed', {
        invocationKey,
        type,
        rawId,
      });
      return;
    }

    inFlightHotkeyInvocations.add(invocationKey);
    isHandlingUrlTrigger.current = true;
    let attempts = 0;
    const maxAttempts = 80;
    const retryDelayMs = 100;

    const findById = (records: any[], id: string) => records.find(record => String(record?.id) === id);
    const finishHotkeyTrigger = () => {
      inFlightHotkeyInvocations.delete(invocationKey);
      isHandlingUrlTrigger.current = false;
      handledUrlTriggerKeyRef.current = currentTriggerKey;
      replaceTriggerUrlWithNormalNewtabUrl();
    };

    const tryHandle = async () => {
      let normalizedId = rawId.startsWith('/') ? rawId.substring(1) : rawId;
      normalizedId = normalizedId.replace(/^automation-/, '').replace(/^agent-/, '');

      console.log('[UrlTrigger][hotkey] handling attempt', {
        type,
        rawId,
        normalizedId,
        attempts,
        isDbInitialized: useDbStore.getState().isInitialized,
        renderIsDbInitialized: isDbInitialized,
        hasSearchbarRef: Boolean(searchbarRef.current),
        userReady: userId !== '',
      });

      if (type === 'command' && await tryRunDirectUrlCommand(normalizedId)) {
        console.log('[UrlTrigger][hotkey] command handled by direct URL executor', {
          commandId: normalizedId,
        });
        finishHotkeyTrigger();
        return;
      }

      if (['collection', 'collections', 'collection_view'].includes(type || '')) {
        const currentIsDbInitialized = useDbStore.getState().isInitialized;
        if (!currentIsDbInitialized) {
          console.log('[UrlTrigger][hotkey] waiting for collection DB readiness', {
            normalizedId,
            attempts,
            renderIsDbInitialized: isDbInitialized,
          });
          if (attempts++ < maxAttempts) {
            window.setTimeout(tryHandle, retryDelayMs);
          } else {
            console.warn('[UrlTrigger][hotkey] collection trigger timed out before DB became ready', {
              normalizedId,
              currentIsDbInitialized,
              renderIsDbInitialized: isDbInitialized,
            });
            finishHotkeyTrigger();
          }
          return;
        }
        const didLaunch = await launchCollectionViewById(normalizedId, collectionOpenBehavior);
        sessionFlowUrlTriggerDebug('[UrlTrigger][hotkey] collection launch result', {
          normalizedId,
          didLaunch,
          collectionOpenBehavior,
        });
        handledUrlTriggerKeyRef.current = currentTriggerKey;
        if (!didLaunch) {
          console.warn(`[App] Collection view not found for ID: ${normalizedId}`);
        }
        finishHotkeyTrigger();
        return;
      }

      const currentIsLoggedIn = userId !== '';
      const currentIsDbInitialized = useDbStore.getState().isInitialized;
      if (!searchbarRef.current || !currentIsDbInitialized || (!currentIsLoggedIn && attempts < 30)) {
        console.log('[UrlTrigger][hotkey] waiting for searchbar readiness', {
          type,
          normalizedId,
          attempts,
          hasSearchbarRef: Boolean(searchbarRef.current),
          currentIsDbInitialized,
          renderIsDbInitialized: isDbInitialized,
          currentIsLoggedIn,
        });
        if (attempts++ < maxAttempts) {
          window.setTimeout(tryHandle, retryDelayMs);
        } else {
          console.warn('[UrlTrigger][hotkey] trigger timed out before UI became ready', {
            type,
            normalizedId,
            currentIsDbInitialized,
            renderIsDbInitialized: isDbInitialized,
            hasSearchbarRef: Boolean(searchbarRef.current),
            currentIsLoggedIn,
          });
          finishHotkeyTrigger();
        }
        return;
      }

      if (type === 'command') {
        console.log('[UrlTrigger][hotkey] executing command through searchbar', {
          commandId: normalizedId,
        });
        searchbarRef.current.executeCommand(normalizedId as any, { mode: 'execute' });
        if (!searchbarRef.current.isLocked) searchbarRef.current.focus();
        finishHotkeyTrigger();
        return;
      }

      if (type === 'module') {
        searchbarRef.current.executeModule(normalizedId);
        finishHotkeyTrigger();
        return;
      }

      if (
        ['automation', 'automations', 'agent', 'chat_agent', 'chatagent', 'aiprompt', 'ai_prompt', 'prompt'].includes(
          type || '',
        )
      ) {
        const latestDbState = useDbStore.getState();
        const actualItemId = extractSnippetIdFromCompoundId(normalizedId);
        const isChatAgentTrigger = ['agent', 'chat_agent', 'chatagent'].includes(type || '');
        if (isChatAgentTrigger) {
          const chatAgentCandidates = latestDbState.chatAgents || [];
          const foundChatAgent =
            findById(chatAgentCandidates, actualItemId) ||
            chatAgentCandidates.find((agent: any) => includesQuery(agent.title, normalizedId));
          if (foundChatAgent) {
            useUIStore.getState().setView({ type: 'home' });
            useUIStore.getState().openEditor({ type: 'ai', id: String(foundChatAgent.id) });
            finishHotkeyTrigger();
            return;
          }
        }

        const latestAutomations = latestDbState.automations || [];
        let foundAuto = findById(latestAutomations, normalizedId);
        if (!foundAuto) {
          foundAuto = latestAutomations.find(auto => includesQuery(auto.name, normalizedId));
        }
        if (foundAuto) {
          openAutomationById(String(foundAuto.id));
          finishHotkeyTrigger();
          return;
        }

        // Also check AI Prompts!
        const aiPromptCandidates = latestDbState.aiPrompts || [];
        let foundPrompt = findById(aiPromptCandidates, normalizedId);
        if (!foundPrompt) {
          foundPrompt = aiPromptCandidates.find((p: any) => includesQuery(p.title, normalizedId));
        }
        if (foundPrompt) {
          useUIStore.getState().setView({ type: 'home' });
          if (hasRunnableAiPrompt(foundPrompt)) {
            try {
              await runAiPrompt(foundPrompt);
            } catch (error) {
              console.error('[useUrlTriggers] Failed to run AI prompt from hotkey:', error);
            }
          } else {
            useUIStore.getState().openItemEditor('aiPrompt', String(foundPrompt.id));
          }
          finishHotkeyTrigger();
          return;
        }

        searchbarRef.current.executeCommand(normalizedId as any, { mode: 'execute' });
        if (!searchbarRef.current.isLocked) searchbarRef.current.focus();
        finishHotkeyTrigger();
        return;
      }

      if (['session', 'sessions', 'tab session'].includes(type || '')) {
        const latestDbState = useDbStore.getState();
        const actualItemId = extractSnippetIdFromCompoundId(normalizedId);
        const foundSession = findById(latestDbState.sessions || [], actualItemId);
        if (foundSession) {
          await launchSessionSmartWithReferences(foundSession, {
            source: 'url_trigger',
            requireAutoSave: false,
          });
          finishHotkeyTrigger();
        } else {
          console.warn(`[App] Session not found for ID: ${normalizedId}. Falling back to command execution.`);
          searchbarRef.current.executeCommand(normalizedId as any, { mode: 'execute' });
          if (!searchbarRef.current.isLocked) searchbarRef.current.focus();
          finishHotkeyTrigger();
        }
        return;
      }

      if (['link', 'links', 'tabgroup', 'note', 'notes', 'snippet', 'snippets'].includes(type || '')) {
        const latestDbState = useDbStore.getState();
        const isLinkType = ['link', 'links', 'tabgroup'].includes(type || '');
        const isNoteType = ['note', 'notes'].includes(type || '');

        const actualItemId = extractSnippetIdFromCompoundId(normalizedId);

        const foundItem: any = isLinkType
          ? findById(latestDbState.links || [], actualItemId) || findById(latestDbState.snippets || [], actualItemId)
          : isNoteType
            ? findById(latestDbState.notes || [], actualItemId) || findById(latestDbState.snippets || [], actualItemId)
            : findById(latestDbState.snippets || [], actualItemId) || findById(latestDbState.notes || [], actualItemId);

        if (foundItem && isLinkType) {
          if (searchbarRef.current?.executeSnippet) {
            searchbarRef.current.executeSnippet(foundItem);
          } else {
            useUIStore.getState().openCreateItem('link', { id: 'new', props: { category: 'link' } });
          }
        } else if (foundItem) {
          if (isNoteType) {
            openNoteById(String(foundItem.id), foundItem);
          } else {
            openSnippetById(String(foundItem.id), foundItem);
          }
        } else {
          console.warn(`[App] ${type} not found for ID: ${normalizedId}. Falling back to command execution.`);
          searchbarRef.current.executeCommand(normalizedId as any, { mode: 'execute' });
          if (!searchbarRef.current.isLocked) searchbarRef.current.focus();
        }
        finishHotkeyTrigger();
        return;
      }
    };

    tryHandle();
    return;
  }, [
    dbAutomations,
    dbLinks,
    dbNotes,
    dbSnippets,
    dismissAllViews,
    handleAltSInitialization,
    isDbInitialized,
    openSpreadsheetView,
    requestMissingAiPromptInput,
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
    if (urlParams.get('session_reference') === 'true') return;
    if (urlParams.get('skip_session_recovery') === 'true') {
      sessionFlowUrlTriggerDebug('[SessionFlow][useUrlTriggers] skip_session_recovery=true detected; leaving dashboard view open');
      return;
    }

    chromeAny.windows.getCurrent((currentWindow: any) => {
      if (!currentWindow?.id) return;
      chromeAny.storage.local.get('active_sessions', (result: any) => {
        const sessions: { sessionId: string; sessionName: string; windowId: number; launchSource?: string }[] = result.active_sessions || [];
        const matchedSession = sessions.find(s => s.windowId === currentWindow.id);
        if (matchedSession) {
          if (matchedSession.launchSource === 'dashboard_view') {
            sessionFlowUrlTriggerDebug(
              '[SessionFlow][useUrlTriggers] Dashboard-launched active session found on refresh; leaving dashboard view open:',
              matchedSession.sessionId,
            );
            return;
          }
          const activeEditor = useUIStore.getState().activeEditor;
          const alreadyOpenedFromUrl = openedSessionFromUrlRef.current === matchedSession.sessionId;
          const isAlreadyActiveEditor =
            activeEditor?.type === 'session' && String(activeEditor.id || '') === String(matchedSession.sessionId);
          if (alreadyOpenedFromUrl || isAlreadyActiveEditor) {
            return;
          }
          sessionFlowUrlTriggerDebug(
            '[SessionFlow][useUrlTriggers] Active session found for this window on load/refresh:',
            matchedSession.sessionId,
            '- opening session editor',
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
          sessionFlowUrlTriggerDebug(
            '[SessionFlow][useUrlTriggers] No active session for this window (normal tab load). windowId:',
            currentWindow.id,
          );
        }
      });
    });
  }, []);

  useEffect(() => {
    const chromeAny = (window as typeof window & { chrome?: typeof chrome }).chrome;
    if (!chromeAny?.runtime?.connect || !chromeAny?.tabs?.getCurrent) return;

    const urlParams = new URLSearchParams(window.location.search);
    const isSessionControlPage =
      urlParams.get('skip_session_recovery') === 'true' || urlParams.get('session_mode') === 'true';
    if (!isSessionControlPage) return;

    let controlPort: chrome.runtime.Port | undefined;
    chromeAny.tabs.getCurrent(tab => {
      if (typeof tab?.id !== 'number') return;
      controlPort = chromeAny.runtime.connect({ name: `session-control:${tab.id}` });
      console.log('[SessionLaunchTrace] control port connected', { tabId: tab.id });
      controlPort.onMessage.addListener((message: any) => {
        if (message?.type !== 'OPEN_SESSION_REFERENCES' || !Array.isArray(message.items)) return;
        console.log('[SessionLaunchTrace] target control tab received references', {
          tabId: tab.id,
          sessionId: message.sessionId,
          itemCount: message.items.length,
        });
        const dispatchKey = `${tab.id}:${message.sessionId || ''}:${JSON.stringify(message.items)}`;
        if (handledSessionReferenceDispatchesRef.current.has(dispatchKey)) return;
        handledSessionReferenceDispatchesRef.current.add(dispatchKey);
        void handleSessionReferenceLaunchActions(message.items, {
          aiPrompts: useDbStore.getState().aiPrompts || [],
          chatAgents: useDbStore.getState().chatAgents || [],
          shouldContinue: async () => {
            const response = await chromeAny.runtime.sendMessage({ action: 'get_active_session_status' });
            return (
              response?.ok === true &&
              String(response.active_session?.sessionId || '') === String(message.sessionId || '') &&
              response.active_session?.pinnedTabId === tab.id
            );
          },
        });
      });
    });

    return () => controlPort?.disconnect();
  }, []);
};
