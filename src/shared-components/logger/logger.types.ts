export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'test';
export type LogContext = 'APP' | 'TEST' | 'BACKGROUND' | 'NEW_TAB' | 'ONBOARDING' | 'WORKSPACE' | 'FOLDER' | 'STORAGE' | 'INDEXEDDB';

export interface LogPayload {
  timestamp: string;
  level: LogLevel;
  context: LogContext;
  action: string;
  message: string;
  entityId?: string;
  result?: 'success' | 'failure';
  metadata?: Record<string, unknown>;
  error?: Error | unknown;
}

export type LoggerInput = Omit<LogPayload, 'timestamp' | 'level'>;
