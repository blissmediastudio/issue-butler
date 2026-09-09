const LEVELS = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof LEVELS)[number];

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

/** Structured JSON logger; each call is one line so it stays greppable in container logs. */
export function createLogger(minLevel: LogLevel = "info"): Logger {
  const minIndex = LEVELS.indexOf(minLevel);

  const log = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    if (LEVELS.indexOf(level) < minIndex) return;
    const line = { timestamp: new Date().toISOString(), level, message, ...meta };
    const output = level === "error" ? console.error : console.log;
    output(JSON.stringify(line));
  };

  return {
    debug: (message, meta) => log("debug", message, meta),
    info: (message, meta) => log("info", message, meta),
    warn: (message, meta) => log("warn", message, meta),
    error: (message, meta) => log("error", message, meta),
  };
}
