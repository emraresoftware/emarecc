/**
 * Basit yapılandırılmış loglama
 * Production'da pino/winston ile değiştirilebilir
 */
const isDev = process.env.NODE_ENV !== 'production';
const LOG_BUFFER: string[] = [];
const LOG_BUFFER_MAX = 500;

function pushToBuffer(line: string): void {
  LOG_BUFFER.push(line);
  if (LOG_BUFFER.length > LOG_BUFFER_MAX) {
    LOG_BUFFER.shift();
  }
}

function log(level: string, msg: string, meta: Record<string, unknown> = {}): void {
  const ts = new Date().toISOString();
  const payload = { ts, level, msg, ...meta };
  const line = JSON.stringify(payload);
  pushToBuffer(line);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta ?? {}),
  warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta ?? {}),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta ?? {}),
  debug: (msg: string, meta?: Record<string, unknown>) => isDev && log('debug', msg, meta ?? {}),
};

export function getRecentLogs(limit = 200): string[] {
  if (limit <= 0) return [];
  return LOG_BUFFER.slice(-limit);
}
