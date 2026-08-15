// 日志级别定义：debug 最详细，error 最严重
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * 轻量前端日志：时间戳 + 来源标签 + 分级输出到 console，便于 DevTools 定位问题
 * @param level 日志级别，决定调用 console 的对应方法
 * @param tag 来源标签，如组件名或模块名，便于过滤日志
 * @param message 日志正文
 * @param args 附加参数，原样透传给 console 方法
 */
function write(level: LogLevel, tag: string, message: string, ...args: unknown[]) {
  const time = new Date().toISOString()
  const line = `[${time}] [${tag}] ${message}`
  // eslint-disable-next-line no-console
  console[level](line, ...args)
}

/**
 * 创建带固定标签的日志器，供各模块按需引入
 * @param tag 来源标签，例如 'ErrorBoundary'、'MatchList'
 */
export function createLogger(tag: string) {
  return {
    debug: (message: string, ...args: unknown[]) => write('debug', tag, message, ...args),
    info: (message: string, ...args: unknown[]) => write('info', tag, message, ...args),
    warn: (message: string, ...args: unknown[]) => write('warn', tag, message, ...args),
    error: (message: string, ...args: unknown[]) => write('error', tag, message, ...args)
  }
}
