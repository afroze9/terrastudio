import {
  trace as pluginTrace,
  debug as pluginDebug,
  info as pluginInfo,
  warn as pluginWarn,
  error as pluginError,
} from '@tauri-apps/plugin-log';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'off';

const LEVEL_RANK: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  off: 5,
};

let currentLevel: LogLevel = 'info';

/** Set the JS-side level gate. Messages below this level are suppressed before IPC. */
export function setLoggerLevel(level: LogLevel): void {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[currentLevel];
}

export const logger = {
  trace(msg: string): void {
    if (shouldLog('trace')) pluginTrace(msg);
  },
  debug(msg: string): void {
    if (shouldLog('debug')) pluginDebug(msg);
  },
  info(msg: string): void {
    if (shouldLog('info')) pluginInfo(msg);
  },
  warn(msg: string): void {
    if (shouldLog('warn')) pluginWarn(msg);
  },
  error(msg: string): void {
    if (shouldLog('error')) pluginError(msg);
  },
};
