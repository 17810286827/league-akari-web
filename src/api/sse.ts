/**
 * SSE 流式消费共享原语（单局 AI 分析与周报锐评共用，工单 #33 抽取）：
 * 后端两个流式端点（/api/matches/{id}/ai-analysis、/api/team/weekly/ai-comment）
 * 使用同一事件契约（start/chunk/reasoning/reasoning-reset/done/error，见后端
 * AiAnalysisService / WeeklyAiCommentService javadoc），前端消费逻辑收敛到一处。
 *
 * 流式场景不能走 axios（无法增量消费响应体），统一用 fetch + ReadableStream 逐行解析。
 */
import { API_BASE_URL } from '@/api/config'
import { ApiError } from './http'
import { createLogger } from '@/utils/logger'

// 带 'SseAPI' 标签的日志器，便于在 DevTools 按来源过滤流式请求链路
const logger = createLogger('SseAPI')

/** SSE 事件回调（对应后端两个流式服务的统一事件协议） */
export interface SseStreamHandlers {
  /** 流开始：携带是否命中后端缓存 */
  onStart?: (fromCache: boolean) => void
  /** 增量文本片段（按到达顺序拼接即为完整正文） */
  onChunk?: (content: string) => void
  /** 模型思考过程增量（reasoning_content 思维链；仅当后端模型支持思考模式时才有事件，详见 server docs/adr/0006） */
  onReasoning?: (content: string) => void
  /**
   * 思维链缓冲重置：后端"思维链耗尽预算、正文为空"自动重试前推送——
   * 前端须清空已累积的思维链缓冲（两次尝试的思维链拼接会变成杂乱文本）
   */
  onReasoningReset?: () => void
  /** 流正常结束（truncated=true 表示输出被长度预算截断，正文可能不完整） */
  onDone?: (truncated: boolean) => void
  /** 流中途出错（error 事件，message 为后端返回的明确原因） */
  onError?: (message: string) => void
}

/**
 * 发起 SSE 流式请求并逐事件分发回调：
 * - 开流前失败（后端统一契约：HTTP 200 + JSON 错误体，如 4101 无 Key / 2001 对局不存在）：
 *   以 content-type 判定非 event-stream 后解析信封，抛 ApiError——由调用方 catch 通知页面层
 * - HTTP 非 200（未达业务，如路由/网关故障）：解析 message 后抛 Error
 * - 流已建立后的错误（error 事件）：调用 onError 回调，正常结束
 *
 * @param path     请求路径（含查询串，拼在 API_BASE_URL 后）
 * @param method   HTTP 方法（单局分析为 POST、周报锐评为 GET）
 * @param logLabel 日志上下文标签（区分两条流式链路）
 * @param handlers 流式事件回调（全部可选）
 * @returns 流结束时 resolve；HTTP 错误/网络错误时 reject
 */
export async function consumeSseStream(
  path: string,
  method: 'GET' | 'POST',
  logLabel: string,
  handlers: SseStreamHandlers = {}
): Promise<void> {
  // 统一从 config 模块取基础地址（默认相对路径，走 nginx 反代/vite proxy）
  const url = `${API_BASE_URL}${path}`
  // 请求发出前打日志：若此处之后长时间无 "response received"，说明后端响应头迟迟未返回
  logger.info(`${logLabel} fetch starting`, { url })
  // Accept: text/event-stream 让后端按 SSE 协议返回（fetch 天然支持流式读取响应体）
  const response = await fetch(url, {
    method,
    headers: { Accept: 'text/event-stream' }
  })
  // 响应头到达日志：status/content-type 用于确认后端是否按 SSE 协议应答
  logger.info(`${logLabel} response received`, {
    status: response.status,
    contentType: response.headers.get('content-type')
  })
  // 开流前失败判定（后端统一契约）：HTTP 200 但 content-type 非 event-stream，
  // 说明响应体是 JSON 错误信封（如 4101 Key 未配置 / 2001 对局不存在）——
  // 解析后抛 ApiError 走调用方 catch（与"HTTP 非 200 抛错"行为对齐）
  const contentType = response.headers.get('content-type') ?? ''
  if (response.ok && !contentType.includes('text/event-stream')) {
    const body = (await response.json().catch(() => null)) as { code?: number; message?: string } | null
    const message = body?.message ?? `${logLabel} 请求失败（HTTP ${response.status}）`
    logger.error(`${logLabel} pre-stream failure`, { status: response.status, code: body?.code, message })
    throw new ApiError(body?.code ?? 5000, message)
  }
  // 非 200：请求未达业务（路由/网关级故障），提取 message 抛出
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null
    const message = body?.message ?? `请求失败（HTTP ${response.status}）`
    logger.error(`${logLabel} HTTP error`, { status: response.status, message })
    throw new Error(message)
  }
  // 流式读取：逐块解码并按行切分，data: 前缀行为事件负载
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('浏览器不支持流式读取')
  }
  const decoder = new TextDecoder()
  let buffer = ''
  let chunkCount = 0
  let totalChars = 0
  const streamStart = Date.now()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    buffer += decoder.decode(value, { stream: true })
    // 按换行切分完整行（SSE 事件行以 data: 开头，空行分隔事件）
    let newlineIndex = buffer.indexOf('\n')
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim()
      buffer = buffer.slice(newlineIndex + 1)
      if (line.startsWith('data:')) {
        handleSseEvent(line.slice(5).trim(), logLabel, handlers, () => {
          chunkCount++
        }, (len) => {
          totalChars += len
        })
      }
      newlineIndex = buffer.indexOf('\n')
    }
  }
  // 收尾：处理未换行结尾的剩余内容
  const tail = buffer.trim()
  if (tail.startsWith('data:')) {
    handleSseEvent(tail.slice(5).trim(), logLabel, handlers, () => {
      chunkCount++
    }, (len) => {
      totalChars += len
    })
  }
  // 流结束统计：若无任何 chunk 但已收到响应头，说明后端流建立后未推送数据
  logger.info(`${logLabel} stream ended`, {
    chunks: chunkCount,
    chars: totalChars,
    durationMs: Date.now() - streamStart
  })
}

/**
 * 解析单条 SSE 事件（data: 后的 JSON，形如 {"type":"start","fromCache":true}）并分发回调；
 * 无法解析的行（异常数据）忽略，保证流不受单条坏数据影响。
 * chunk 统计回调用于流结束时的汇总日志（确认后端是否真的推送了内容）
 */
function handleSseEvent(
  data: string,
  logLabel: string,
  handlers: SseStreamHandlers,
  onChunk?: () => void,
  onChunkChars?: (len: number) => void
): void {
  if (!data || data === '[DONE]') {
    return
  }
  let event: { type?: string; fromCache?: boolean; content?: string; message?: string; truncated?: boolean }
  try {
    event = JSON.parse(data)
  } catch {
    // 单条事件解析失败：跳过（可能是异常空事件），不影响后续块
    return
  }
  switch (event.type) {
    case 'start':
      logger.info(`${logLabel} start event`, { fromCache: event.fromCache })
      handlers.onStart?.(event.fromCache ?? false)
      break
    case 'chunk':
      handlers.onChunk?.(event.content ?? '')
      onChunk?.()
      onChunkChars?.(event.content?.length ?? 0)
      break
    case 'reasoning':
      // 模型思考过程（思维链）：单独回调，前端与正文分区展示
      handlers.onReasoning?.(event.content ?? '')
      onChunk?.()
      onChunkChars?.(event.content?.length ?? 0)
      break
    case 'reasoning-reset':
      // 后端自动重试前清空思维链缓冲（首次尝试的思维链已作废，拼接会变杂乱文本）
      logger.info(`${logLabel} reasoning reset event`)
      handlers.onReasoningReset?.()
      break
    case 'done':
      handlers.onDone?.(event.truncated ?? false)
      break
    case 'error':
      logger.error(`${logLabel} error event`, { message: event.message })
      handlers.onError?.(event.message ?? '流式请求失败，请稍后重试')
      break
    default:
      // 未知事件类型：忽略（后端协议扩展时向前兼容）
      break
  }
}
