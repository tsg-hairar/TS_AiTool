// ===================================================
// Logger — utility for structured extension logging
// ===================================================
// Replaces raw console.log calls with a configurable logger.
// In production, only warnings and errors are shown by default.
// Set tsAiTool.debug to true in VS Code settings to enable
// debug-level output.
// ===================================================

import * as vscode from 'vscode';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function isDebugEnabled(): boolean {
  return vscode.workspace.getConfiguration('tsAiTool').get<boolean>('debug', false);
}

function shouldLog(level: LogLevel): boolean {
  const minLevel: LogLevel = isDebugEnabled() ? 'debug' : 'info';
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}

function formatPrefix(tag: string): string {
  return `[TS_AiTool${tag ? ':' + tag : ''}]`;
}

/**
 * Create a tagged logger for a specific component/service.
 *
 * Usage:
 *   const log = createLogger('ClaudeService');
 *   log.debug('retry attempt', attempt);
 *   log.info('initialized');
 *   log.warn('slow response');
 *   log.error('failed', err);
 */
export function createLogger(tag: string = '') {
  const prefix = formatPrefix(tag);

  return {
    debug(...args: unknown[]): void {
      if (shouldLog('debug')) {
        console.log(prefix, ...args);
      }
    },

    info(...args: unknown[]): void {
      if (shouldLog('info')) {
        console.log(prefix, ...args);
      }
    },

    warn(...args: unknown[]): void {
      if (shouldLog('warn')) {
        console.warn(prefix, ...args);
      }
    },

    error(...args: unknown[]): void {
      // Errors are always logged
      console.error(prefix, ...args);
    },
  };
}
