type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * 轻量前端日志：时间戳 + 来源标签 + 分级输出到 console，便于 DevTools 定位问题
 */
function write(level: LogLevel, tag: string, message: string, ...args: unknown[]) {
  const time = new Date().toISOString()
  const line = `[${time}] [${tag}] ${message}`
  // eslint-disable-next-line no-console
  console[level](line, ...args)
}

export function createLogger(tag: string) {
  return {
    debug: (message: string, ...args: unknown[]) => write('debug', tag, message, ...args),
    info: (message: string, ...args: unknown[]) => write('info', tag, message, ...args),
    warn: (message: string, ...args: unknown[]) => write('warn', tag, message, ...args),
    error: (message: string, ...args: unknown[]) => write('error', tag, message, ...args)
  }
}
