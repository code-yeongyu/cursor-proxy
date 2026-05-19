type LogLevel = "debug" | "info" | "warn" | "error"

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

export type Logger = {
  readonly debug: (message: string, fields?: Record<string, unknown>) => void
  readonly info: (message: string, fields?: Record<string, unknown>) => void
  readonly warn: (message: string, fields?: Record<string, unknown>) => void
  readonly error: (message: string, fields?: Record<string, unknown>) => void
}

function configuredLevel(readLevel?: () => string | undefined): LogLevel {
  const value = readLevel?.() ?? globalThis.process?.env?.["CURSOR_PROXY_LOG_LEVEL"]
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value
  }
  return "info"
}

function shouldLog(level: LogLevel, readLevel?: () => string | undefined): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[configuredLevel(readLevel)]
}

function writeLine(level: LogLevel, line: string): void {
  if (level === "error") {
    console.error(line)
    return
  }
  if (level === "warn") {
    console.warn(line)
    return
  }
  console.log(line)
}

function write(
  level: LogLevel,
  component: string,
  message: string,
  readLevel?: () => string | undefined,
  fields?: Record<string, unknown>,
) {
  if (!shouldLog(level, readLevel)) {
    return
  }

  const line = {
    time: new Date().toISOString(),
    level,
    component,
    message,
    fields: fields ?? {},
  }
  writeLine(level, JSON.stringify(line))
}

export function createLogger(component: string, readLevel?: () => string | undefined): Logger {
  return {
    debug: (message, fields) => write("debug", component, message, readLevel, fields),
    info: (message, fields) => write("info", component, message, readLevel, fields),
    warn: (message, fields) => write("warn", component, message, readLevel, fields),
    error: (message, fields) => write("error", component, message, readLevel, fields),
  }
}
