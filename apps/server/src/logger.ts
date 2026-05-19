const LOG_LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
} as const

type LogLevel = keyof typeof LOG_LEVELS

export type Logger = {
  readonly debug: (message: string, fields?: Record<string, unknown>) => void
  readonly info: (message: string, fields?: Record<string, unknown>) => void
  readonly warn: (message: string, fields?: Record<string, unknown>) => void
  readonly error: (message: string, fields?: Record<string, unknown>) => void
}

function configuredLevel(): LogLevel {
  const value = globalThis.process?.env?.["CURSOR_PROXY_LOG_LEVEL"]
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value
  }
  return "info"
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[configuredLevel()]
}

function write(
  level: LogLevel,
  component: string,
  message: string,
  fields?: Record<string, unknown>,
) {
  if (!shouldLog(level)) {
    return
  }

  const line = {
    time: new Date().toISOString(),
    level,
    component,
    message,
    fields: fields ?? {},
  }
  console.error(JSON.stringify(line))
}

export function createLogger(component: string): Logger {
  return {
    debug: (message, fields) => write("debug", component, message, fields),
    info: (message, fields) => write("info", component, message, fields),
    warn: (message, fields) => write("warn", component, message, fields),
    error: (message, fields) => write("error", component, message, fields),
  }
}
