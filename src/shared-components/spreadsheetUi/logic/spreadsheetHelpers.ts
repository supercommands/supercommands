import { useUIStore } from '../../uiStateManager';

export const canOpenSpreadsheetRow = (row: any): boolean => {
  if (!row) return false;
  const itemType = String(row.itemType || '').toLowerCase();
  const section = String(row.section || '').toLowerCase();
  const category = String(row.category || '').toLowerCase();

  const isNote = itemType === 'note' || section.includes('note') || category === 'note';
  const isSnippet = itemType === 'snippet' || section.includes('snippet') || category === 'snippet';
  const isLink = itemType === 'link' || section.includes('smart link') || category === 'link';
  const isTodo = itemType === 'todo' || section.includes('todo') || category === 'todo';

  return isNote || isSnippet || isLink || isTodo;
};

export const hasExternalOpenerIcon = (row: any): boolean => {
  if (!row) return false;
  const itemType = String(row.itemType || '').toLowerCase();
  const section = String(row.section || '').toLowerCase();
  const category = String(row.category || '').toLowerCase();

  const isLink = itemType === 'link' || section.includes('smart link') || category === 'link';
  const isSession =
    itemType === 'session' ||
    section.includes('session') ||
    section.includes('collection') ||
    ['session', 'sessions', 'tab session', 'tabgroup', 'collection'].includes(category);
  const isBrowserCommand =
    section.includes('browser command') ||
    ['commands', 'general_commands', 'command'].includes(category);

  return isLink || isSession || isBrowserCommand;
};

export const openSpreadsheetRowInNewTab = (row: any): void => {
  if (!row) return;
  const chromeAny = (window as any)?.chrome;

  const openUrlInNewTab = (targetUrl: string): boolean => {
    if (!targetUrl) return false;
    const trimmed = targetUrl.trim();
    const finalUrl =
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('chrome://') ||
      trimmed.startsWith('chrome-extension://')
        ? trimmed
        : trimmed.includes('.') && !trimmed.includes(' ') && !trimmed.includes('<')
          ? `https://${trimmed}`
          : null;

    if (!finalUrl) return false;

    try {
      if (chromeAny?.tabs?.create) {
        chromeAny.tabs.create({ url: finalUrl });
      } else {
        window.open(finalUrl, '_blank');
      }
      return true;
    } catch {
      return false;
    }
  };

  const urls: string[] = Array.isArray(row.urls) ? row.urls : [];
  if (urls.length > 0) {
    let openedAny = false;
    urls.forEach(u => {
      if (openUrlInNewTab(u)) openedAny = true;
    });
    if (openedAny) return;
  }

  if (typeof row.url === 'string' && row.url.trim()) {
    if (openUrlInNewTab(row.url)) return;
  }

  const rawValue = String(row.value || row.description || '');
  const urlMatches = rawValue.match(/https?:\/\/[^\s<"']+/g);
  if (urlMatches && urlMatches.length > 0) {
    let openedAny = false;
    urlMatches.forEach(u => {
      if (openUrlInNewTab(u)) openedAny = true;
    });
    if (openedAny) return;
  }

  // Fallback for non-URL items (Notes, Snippets, Todos, etc.): Open the overlay editor to fetch and view data
  openSpreadsheetRow(row);
};

export const openSpreadsheetRow = (row: any): void => {
  if (!row) return;

  const itemType = String(row.itemType || '').toLowerCase();
  const section = String(row.section || '').toLowerCase();
  const category = String(row.category || '').toLowerCase();

  const isNote = itemType === 'note' && section !== 'snippets';
  const isSnippet = section.includes('snippet') || itemType === 'snippet' || category === 'snippet';
  const isLink = section.includes('smart link') || itemType === 'link' || category === 'link';
  const isTodo = section.includes('todo') || itemType === 'todo' || category === 'todo';

  const mappedRow = {
    ...row,
    ...(row.originalItem || {}),
    name: row.name || row.title || row.originalItem?.name || row.originalItem?.title || '',
    title: row.name || row.title || row.originalItem?.name || row.originalItem?.title || '',
    description: row.value || row.description || row.originalItem?.description || row.originalItem?.value || '',
  };

  const uiStore = useUIStore.getState();

  if (isNote) {
    uiStore.openEditor({
      type: 'note',
      id: row.id,
      props: { category: 'note', isOverlay: true, editMode: true, snippet: mappedRow },
    });
    return;
  }

  if (isSnippet) {
    uiStore.openEditor({
      type: 'note',
      id: row.id,
      props: { category: 'snippet', isOverlay: true, editMode: true, snippet: mappedRow },
    });
    return;
  }

  if (isLink) {
    uiStore.openEditor({
      type: 'link',
      id: row.id,
      props: { category: 'link', isOverlay: true, editMode: true, snippet: mappedRow },
    });
    return;
  }

  if (isTodo) {
    const possibleIds = [row.todo_id, row.id, row.snippet_todo_id];
    const numericId = possibleIds.find(
      id => typeof id === 'number' || (typeof id === 'string' && id.length > 0 && !isNaN(Number(id)) && !id.includes('-')),
    );

    const prefill = {
      ...mappedRow,
      todo_id: numericId || row.todo_id || row.id,
      is_todo_type: true,
    };
    uiStore.setTodoCreatePrefill(prefill);
    uiStore.openEditor({
      type: 'todo',
      id: String(prefill.todo_id || prefill.snippet_id || ''),
      props: { category: 'todo', isOverlay: true, editMode: true, snippet: row, prefill },
    });
  }
};

export const extractPlainTextFromSnippetConfig = (configRaw: any): string => {
  if (!configRaw) return '';
  let data = configRaw;

  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed) return '';
    if (
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}'))
    ) {
      try {
        data = JSON.parse(trimmed);
      } catch {
        // Keep as raw string if JSON parsing fails
      }
    }
  }

  const cleanText = (str: string): string => {
    return str
      .replace(/<[^>]*>?/gm, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  };

  if (Array.isArray(data)) {
    const parts: string[] = [];
    for (const item of data) {
      if (typeof item === 'string') {
        const cleaned = cleanText(item);
        if (cleaned) parts.push(cleaned);
      } else if (item && typeof item === 'object') {
        const val =
          item.value ??
          item.text ??
          item.content ??
          item.label ??
          item.name ??
          item.title ??
          '';
        if (typeof val === 'string') {
          const cleaned = cleanText(val);
          if (cleaned) parts.push(cleaned);
        } else if (typeof val === 'object' && val !== null) {
          const sub = extractPlainTextFromSnippetConfig(val);
          if (sub) parts.push(sub);
        }
      }
    }
    if (parts.length > 0) {
      return parts.join(' ');
    }
  } else if (data && typeof data === 'object') {
    if (Array.isArray(data.blocks)) {
      return extractPlainTextFromSnippetConfig(data.blocks);
    }
    if (typeof data.note === 'string') return cleanText(data.note);
    if (typeof data.text === 'string') return cleanText(data.text);
    if (typeof data.value === 'string') return cleanText(data.value);
    if (typeof data.content === 'string') return cleanText(data.content);
    if (typeof data.config === 'string' || typeof data.config === 'object') {
      return extractPlainTextFromSnippetConfig(data.config);
    }
  }

  if (typeof configRaw === 'string') {
    return cleanText(configRaw);
  }

  return '';
};

export const getSpreadsheetDescriptionPreview = (row: any): string => {
  if (!row) return '';

  const cat = String(row.category || '').toLowerCase();
  const section = String(row.section || '').toLowerCase();
  const itemType = String(row.itemType || '').toLowerCase();

  const isAutomation =
    !!row.automationData ||
    section === 'my saved automations' ||
    section === 'chat agents' ||
    ['automation', 'automations'].includes(cat) ||
    ['aiprompt', 'ai_prompt', 'prompt', 'chatagent', 'chat_agent', 'agent'].includes(cat) ||
    (itemType === 'agent' && !!row.automationData);

  if (isAutomation) {
    const steps =
      row.automationData?.steps ||
      row.automationData?.automation_steps ||
      row.automationData?.execution_steps ||
      [];

    const getStepName = (mId: any) => {
      const id = String(mId || '');
      switch (id) {
        case 'open_tab':
        case 'open_url':
          return 'Open Link';
        case 'paste':
        case 'insert_text':
          return 'Fill Input';
        case 'wait':
        case 'wait_duration':
        case 'wait_for_navigation':
        case 'wait_for_element':
          return 'Wait';
        case 'clipboard_write':
          return 'Write Clipboard';
        case 'clipboard_paste':
          return 'Paste Clipboard';
        case 'agent':
          return 'Agent Step';
        case 'sub_automation':
          return 'Sub-Automation';
        default:
          return null;
      }
    };

    const stepNames = steps
      .map((s: any) => getStepName(s.moduleId || s.module_id || s.action))
      .filter(Boolean);

    const visibleSteps = stepNames.slice(0, 25).join(', ');
    const moreCount = stepNames.length - 25;
    if (visibleSteps) {
      return moreCount > 0 ? `${visibleSteps} +${moreCount} more` : visibleSteps;
    }
    return '';
  }

  const isSession =
    itemType === 'session' ||
    cat === 'session' ||
    ['session', 'sessions', 'tab session', 'collection'].includes(cat) ||
    section.includes('tab session') ||
    section.includes('collection');

  if (isSession) {
    let urls: string[] = Array.isArray(row.urls) ? row.urls : [];
    if (urls.length === 0 && (row.value || row.url)) {
      const rawVal = row.value || row.url;
      try {
        if (typeof rawVal === 'string' && (rawVal.startsWith('{') || rawVal.startsWith('['))) {
          const parsed = JSON.parse(rawVal);
          if (Array.isArray(parsed.urls)) urls = parsed.urls;
        } else if (typeof rawVal === 'object' && Array.isArray(rawVal.urls)) {
          urls = rawVal.urls;
        }
      } catch {
        // ignore
      }
    }

    if (urls.length === 0) {
      return 'No tabs added';
    }

    const domains = urls.map((u: string) => {
      try {
        const hostname = new URL(u.startsWith('http') ? u : `https://${u}`).hostname;
        return hostname.replace('www.', '');
      } catch {
        return u;
      }
    });

    return domains.filter(Boolean).slice(0, 3).join(', ');
  }

  const isSnippetOrNote =
    section === 'notes' ||
    section === 'snippets' ||
    itemType === 'note' ||
    itemType === 'snippet' ||
    cat === 'note' ||
    cat === 'snippet' ||
    cat === 'text_expander' ||
    section.includes('snippet') ||
    section.includes('text expander');

  if (isSnippetOrNote) {
    const raw = row.value || row.description || row.originalItem?.description || row.originalItem?.value || row.originalItem?.config || '';
    return extractPlainTextFromSnippetConfig(raw);
  }

  const isLink =
    itemType === 'link' ||
    cat === 'link' ||
    section.includes('smart link') ||
    cat === 'bookmark' ||
    cat === 'bookmarks';

  if (isLink) {
    let urls: string[] = Array.isArray(row.urls) ? row.urls : [];
    if (urls.length === 0 && (row.url || row.value)) {
      const rawVal = row.url || row.value;
      if (typeof rawVal === 'string' && rawVal.trim() && !rawVal.startsWith('{') && !rawVal.startsWith('[')) {
        urls = [rawVal.trim()];
      }
    }

    if (urls.length === 0) {
      return 'No links added';
    }

    const domains = urls.map((u: string) => {
      try {
        const hostname = new URL(u.startsWith('http') ? u : `https://${u}`).hostname;
        return hostname.replace('www.', '');
      } catch {
        return u;
      }
    });

    return domains.filter(Boolean).slice(0, 3).join(', ');
  }

  if (cat === 'commands' || cat === 'general_commands' || section.includes('browser command') || section.includes('system command')) {
    return String(row.url || row.value || row.command || '');
  }

  if (typeof row.description === 'string' && row.description) {
    return extractPlainTextFromSnippetConfig(row.description);
  }

  return '';
};
