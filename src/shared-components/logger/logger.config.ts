export const LOGGER_CONFIG = {
  enabledLevels: ['debug', 'info', 'warn', 'error', 'test'],
  sensitiveKeys: [
    'password', 'token', 'accessToken', 'refreshToken',
    'oauth', 'credential', 'personal', 'email', 'clipboard', 'content', 'url', 'header'
  ]
};

export function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const isSensitive = LOGGER_CONFIG.sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()));
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
