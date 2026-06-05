import { randomUUID } from 'crypto';

export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug';

export interface LogEvent {
  id: string;
  jobId: string;
  level: LogLevel;
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

export interface AppLogger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  success(msg: string, meta?: Record<string, unknown>): void;
  debug(msg: string, meta?: Record<string, unknown>): void;
}

export const consoleLogger: AppLogger = {
  info: (msg) => console.log(msg),
  warn: (msg) => console.warn(msg),
  error: (msg) => console.error(msg),
  success: (msg) => console.log(msg),
  debug: (msg) => console.log(msg),
};

export function createJobLogger(
  jobId: string,
  onEvent: (e: LogEvent) => void,
): AppLogger {
  function emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const event: LogEvent = {
      id: randomUUID(),
      jobId,
      level,
      message,
      timestamp: new Date().toISOString(),
      meta,
    };
    // Also log to console for server-side visibility
    if (level === 'error') console.error(`[${jobId}] ${message}`);
    else if (level === 'warn') console.warn(`[${jobId}] ${message}`);
    else console.log(`[${jobId}] ${message}`);
    onEvent(event);
  }

  return {
    info: (msg, meta) => emit('info', msg, meta),
    warn: (msg, meta) => emit('warn', msg, meta),
    error: (msg, meta) => emit('error', msg, meta),
    success: (msg, meta) => emit('success', msg, meta),
    debug: (msg, meta) => emit('debug', msg, meta),
  };
}
