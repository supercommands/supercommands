import { LoggerInput, LogPayload, LogLevel } from './logger.types';
import { LOGGER_CONFIG, sanitizeMetadata } from './logger.config';

class AppLogger {
  private log(level: LogLevel, input: LoggerInput) {
    if (!LOGGER_CONFIG.enabledLevels.includes(level)) return;

    const payload: LogPayload = {
      timestamp: new Date().toISOString(),
      level,
      context: input.context,
      action: input.action,
      message: input.message,
      entityId: input.entityId,
      result: input.result,
      metadata: sanitizeMetadata(input.metadata),
      error: input.error,
    };

    const prefix = `[CMDOS][${payload.level.toUpperCase()}][${payload.context}]`;
    const logString = `${prefix} ${payload.action}: ${payload.message}`;

    const args: any[] = [logString];
    if (payload.entityId) args.push(`| ID: ${payload.entityId}`);
    if (payload.result) args.push(`| Result: ${payload.result}`);
    if (payload.metadata && Object.keys(payload.metadata).length > 0) args.push('\nMetadata:', payload.metadata);
    if (payload.error) args.push('\nError:', payload.error);

    switch (level) {
      case 'debug':
        console.debug(...args);
        break;
      case 'info':
      case 'test':
        console.info(...args);
        break;
      case 'warn':
        console.warn(...args);
        break;
      case 'error':
        console.error(...args);
        break;
    }
  }

  public debug(input: LoggerInput) { this.log('debug', input); }
  public info(input: LoggerInput) { this.log('info', input); }
  public warn(input: LoggerInput) { this.log('warn', input); }
  public error(input: LoggerInput) { this.log('error', input); }
  public test(input: LoggerInput) { this.log('test', input); }
}

export const logger = new AppLogger();
