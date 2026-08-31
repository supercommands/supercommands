import type { WidgetType } from '../widgetDashboard.types';

/**
 * Resolves the canonical human-readable data type label for a given widget type.
 * Returns null if the widget type is unknown or does not represent an object-backed entity with custom title.
 */
export function getWidgetTypeLabel(
  widgetType: WidgetType | string | undefined,
): string | null {
  if (!widgetType) return null;

  switch (widgetType) {
    case 'note-item':
    case 'note-library':
      return 'Notes';
    case 'link-item':
    case 'link-library':
      return 'Links';
    case 'ai-prompt-library':
      return 'Chat Agent';
    case 'snippet-library':
      return 'Text Expander';
    case 'session-item':
      return 'Session';
    case 'chat-agent':
    case 'chat-agent-library':
      return 'Chat Agent';
    default:
      return null;
  }
}

/**
 * Canonical type aliases map used to prevent duplicate label display when custom title equals canonical type name or alias.
 */
const CANONICAL_TYPE_ALIASES_MAP: Record<string, string[]> = {
  notes: ['note', 'notes'],
  links: ['link', 'links'],
  'ai prompt': ['ai prompt', 'ai prompts'],
  'text expander': ['text expander', 'text expanders', 'snippet', 'snippets'],
  session: ['session', 'sessions', 'tab session', 'tab sessions'],
  'chat agent': ['chat agent', 'chat agents'],
};

/**
 * Determines whether to display the secondary type label beside a custom widget title.
 * Returns false if the custom title equals the canonical type label or a recognized alias.
 * e.g.:
 * - title "Notes", typeLabel "Notes" => false (suppress duplicate)
 * - title "Tab Session", typeLabel "Session" => false (suppress duplicate)
 * - title "Study Notes", typeLabel "Notes" => true (render Study Notes   Notes)
 */
export function shouldShowTypeLabel(
  customTitle: string | undefined,
  typeLabel: string | null | undefined,
): boolean {
  if (!typeLabel || !customTitle) return false;

  const normTitle = customTitle.trim().toLowerCase();
  const normLabel = typeLabel.trim().toLowerCase();

  if (!normTitle || !normLabel) return false;

  if (normTitle === normLabel) return false;

  const aliases = CANONICAL_TYPE_ALIASES_MAP[normLabel];
  if (aliases && aliases.includes(normTitle)) {
    return false;
  }

  return true;
}
