import { env } from "../config/env";

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: unknown;
}

/**
 * Structured logger for Votika backend.
 * In production, outputs JSON for log aggregators.
 * In development, uses coloured human-readable output.
 * Never use console.log directly — always use this logger.
 */
function formatEntry(entry: LogEntry): string {
  if (env.NODE_ENV === "production") {
    return JSON.stringify(entry);
  }

  const colours: Record<LogLevel, string> = {
    info: "\x1b[36m", // cyan
    warn: "\x1b[33m", // yellow
    error: "\x1b[31m", // red
    debug: "\x1b[35m", // magenta
  };
  const reset = "\x1b[0m";
  const colour = colours[entry.level];
  const dataStr = entry.data ? `\n  ${JSON.stringify(entry.data, null, 2)}` : "";
  return `${colour}[${entry.level.toUpperCase()}]${reset} ${entry.timestamp} — ${entry.message}${dataStr}`;
}

function log(level: LogLevel, message: string, data?: unknown): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(data !== undefined && { data }),
  };
  const formatted = formatEntry(entry);

  if (level === "error") {
    process.stderr.write(formatted + "\n");
  } else {
    process.stdout.write(formatted + "\n");
  }
}

export const logger = {
  info: (message: string, data?: unknown) => log("info", message, data),
  warn: (message: string, data?: unknown) => log("warn", message, data),
  error: (message: string, data?: unknown) => log("error", message, data),
  debug: (message: string, data?: unknown) => {
    if (env.NODE_ENV !== "production") {
      log("debug", message, data);
    }
  },
};
