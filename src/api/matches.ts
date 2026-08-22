/**
 * 对局相关 API：召唤师搜索、分页列表、详情查询
 * 所有函数返回 Promise，失败时抛出错误（如 404），由调用方决定如何处理
 */
import { API_BASE_URL } from '@/api/config'
import http from './http'
import { createLogger } from '@/utils/logger'
import type { MatchDetail, MatchSummary, MatchTimelineFrame, PageResponse, RiotAccount } from './types'

// 带 'MatchesAPI' 标签的日志器，便于在 DevTools 按来源过滤流式请求链路
const logger = createLogger('MatchesAPI')

/** 对局列表查询参数：分页 + 可选的过滤条件 */
export interface MatchQueryParams {
  /** 页码，从 1 开始 */
  page?: number
  /** 每页条数 */
  pageSize?: number
  /** 按队列 ID 过滤，如 420（单排） */
  queueId?: number
  /** 玩家 puuid（与 summonerName 二选一；缺失时后端返回空页） */
  puuid?: string
  /** 玩家召唤师名（含 #tag，与 puuid 二选一；数据库按参与者名称精确匹配） */
  summonerName?: string
  /** 起始时间戳（毫秒），过滤对局创建时间 */
  startTime?: number
  /** 结束时间戳（毫秒） */
  endTime?: number
}

/** 按"昵称#tag"搜索召唤师账号（Riot Account-V1，后端带 JVM 缓存；404 时抛出） */
export async function searchRiotAccount(riotName: string): Promise<RiotAccount> {
  // GET /api/riot/accounts/by-name：后端返回账号信息（puuid/gameName/tagLine）
  const { data } = await http.get<RiotAccount>('/api/riot/accounts/by-name', {
    params: { riotName }
  })
  return data
}

/** 分页查询对局列表（按玩家过滤） */
export async function listMatches(params: MatchQueryParams): Promise<PageResponse<MatchSummary>> {
  // GET /api/matches：后端直接返回统一分页结构，无需解包
  const { data } = await http.get<PageResponse<MatchSummary>>('/api/matches', { params })
  return data
}

/** 查询对局详情（404 时抛出，由调用方处理） */
export async function getMatchDetail(gameId: number): Promise<MatchDetail> {
  // GET /api/matches/{gameId}：后端将详情包在 { data } 中，这里解包后返回
  const { data } = await http.get<{ data: MatchDetail }>(`/api/matches/${gameId}`)
  return data.data
}

/**
 * AI 对局表现分析（"战犯出列"，SSE 流式）：
 * 后端取本局详情组装数据摘要，流式调用 opencode go 模型，通过 text/event-stream
 * 逐块推送分析文本（打字机效果）；结果后端 JVM 缓存 2 分钟，命中时 start 事件 fromCache=true。
 * 流式场景不能走 axios（无法增量消费响应体），改用 fetch + ReadableStream 逐行解析
 */

/** AI 分析 SSE 事件回调（对应后端 AiAnalysisService 的 start/chunk/reasoning/done/error 协议） */
export interface AnalyzeStreamHandlers {
  /** 流开始：携带是否命中后端缓存（2 分钟内已分析过） */
  onStart?: (fromCache: boolean) => void
  /** 增量文本片段（按到达顺序拼接即为完整分析） */
  onChunk?: (content: string) => void
  /** 模型思考过程增量（reasoning_content 思维链，deepseek-v4-flash 推理模式先输出思考再输出正文） */
  onReasoning?: (content: string) => void
  /** 流正常结束（truncated=true 表示输出被长度预算截断，正文可能不完整） */
  onDone?: (truncated: boolean) => void
  /** 流中途出错（error 事件，message 为后端返回的明确原因） */
  onError?: (message: string) => void
}

/**
 * 发起 AI 对局分析（SSE 流式）：POST /api/matches/{gameId}/ai-analysis
 * - HTTP 非 200（如 404 对局不存在 / 503 无 API Key）：解析 { code, message } 后抛 Error(message)
 * - 流已建立后的错误（error 事件）：调用 onError 回调，正常结束
 *
 * @param gameId   对局 ID
 * @param handlers 流式事件回调（全部可选）
 * @returns 流结束时 resolve；HTTP 错误/网络错误时 reject
 */
export async function analyzeMatch(
  gameId: number,
  handlers: AnalyzeStreamHandlers = {}
): Promise<void> {
  // 统一从 config 模块取基础地址（默认相对路径，走 nginx 反代/vite proxy）
  const url = `${API_BASE_URL}/api/matches/${gameId}/ai-analysis`
  // 请求发出前打日志：若此处之后长时间无 "response received"，说明后端响应头迟迟未返回
  logger.info('AI analysis fetch starting', { gameId, url })
  // Accept: text/event-stream 让后端按 SSE 协议返回（fetch 天然支持流式读取响应体）
  const response = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'text/event-stream' }
  })
  // 响应头到达日志：status/content-type 用于确认后端是否按 SSE 协议应答
  logger.info('AI analysis response received', {
    gameId,
    status: response.status,
    contentType: response.headers.get('content-type')
  })
  // 非 200：错误响应体为 { code, message }（如 404/503），提取 message 抛出
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null
    const message = body?.message ?? `请求失败（HTTP ${response.status}）`
    logger.error('AI analysis HTTP error', { gameId, status: response.status, message })
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
        handleSseEvent(line.slice(5).trim(), handlers, () => {
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
    handleSseEvent(tail.slice(5).trim(), handlers, () => {
      chunkCount++
    }, (len) => {
      totalChars += len
    })
  }
  // 流结束统计：若无任何 chunk 但已收到响应头，说明后端流建立后未推送数据
  logger.info('AI analysis stream ended', {
    gameId,
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
  handlers: AnalyzeStreamHandlers,
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
      logger.info('AI analysis start event', { fromCache: event.fromCache })
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
    case 'done':
      handlers.onDone?.(event.truncated ?? false)
      break
    case 'error':
      logger.error('AI analysis error event', { message: event.message })
      handlers.onError?.(event.message ?? 'AI 分析失败，请稍后重试')
      break
    default:
      // 未知事件类型：忽略（后端协议扩展时向前兼容）
      break
  }
}

/** 查询对局时间线（404 时抛出，由调用方处理；帧结构未建模，透传 unknown 供消费方防御处理） */
export async function getMatchTimeline(gameId: number): Promise<MatchTimelineFrame[]> {
  // GET /api/matches/{gameId}/timeline：后端将帧数组包在 { data } 中，这里解包后返回
  const { data } = await http.get<{ data: MatchTimelineFrame[] }>(`/api/matches/${gameId}/timeline`)
  return data.data
}
