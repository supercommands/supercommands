

// ============================================================================
// DICTIONARY PARSING UTILITIES
// ============================================================================

/**
 * Parse dictionary string into Map
 * Input: "user_123:/leave_mail, user_456:/vacation"
 * Output: Map { "user_123" => "/leave_mail", "user_456" => "/vacation" }
 */
export function parseDictionaryString(dictString: string | null | undefined): Map<string, string> {
  const map = new Map<string, string>();
  if (!dictString) return map;

  const entries = dictString
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  for (const entry of entries) {
    const colonIndex = entry.indexOf(':');
    if (colonIndex > 0) {
      const key = entry.substring(0, colonIndex).trim();
      const value = entry.substring(colonIndex + 1).trim();
      if (key && value) {
        map.set(key, value);
      }
    }
  }
  return map;
}

/**
 * Serialize Map back to dictionary string
 * Input: Map { "user_123" => "/leave_mail", "user_456" => "/vacation" }
 * Output: "user_123:/leave_mail, user_456:/vacation"
 */
export function serializeDictionaryToString(map: Map<string, string>): string {
  return Array.from(map.entries())
    .map(([key, value]) => `${key}:${value}`)
    .join(', ');
}


export async function getCurrentUserId(): Promise<string> {
  const chromeAny = typeof window !== 'undefined' ? (window as any)?.chrome : null;
  if (!chromeAny?.storage?.local) return '';

  return new Promise<string>(resolve => {
    chromeAny.storage.local.get('accessToken', (result: { accessToken?: string }) => {
      resolve(result.accessToken || '');
    });
  });
}

/**
 * Extract snippet ID from commandId
 * commandId format: "${containerId}-${snippetId}"
 */
export function extractSnippetIdFromCommandId(commandId: string): string {
  const parts = commandId.split('-');
  // The snippet ID is everything after the first hyphen
  return parts.slice(1).join('-');
}
