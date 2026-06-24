const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
} as const;

function colorize(color: string, text: string): string {
  return `${color}${text}${COLORS.reset}`;
}

function timestamp(): string {
  return new Date().toISOString().slice(11, 23);
}

export function log(level: 'info' | 'warn' | 'error' | 'debug', message: string, context?: Record<string, unknown>): void {
  const ts = colorize(COLORS.dim, `[${timestamp()}]`);
  const prefix = {
    info: colorize(COLORS.green, '[INFO]'),
    warn: colorize(COLORS.yellow, '[WARN]'),
    error: colorize(COLORS.red, '[ERROR]'),
    debug: colorize(COLORS.blue, '[DEBUG]'),
  }[level];

  let line = `${ts} ${prefix} ${message}`;

  if (context) {
    const ctxStr = Object.entries(context)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
    if (ctxStr) {
      line += ` ${colorize(COLORS.dim, `{${ctxStr}}`)}`;
    }
  }

  if (level === 'error') {
    process.stderr.write(line + '\n');
  } else {
    process.stdout.write(line + '\n');
  }
}

export const logger = {
  info: (msg: string, ctx?: Record<string, unknown>) => log('info', msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log('warn', msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log('error', msg, ctx),
  debug: (msg: string, ctx?: Record<string, unknown>) => log('debug', msg, ctx),
};
