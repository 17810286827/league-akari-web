/**
 * 对局相关 API：召唤师搜索、分页列表、详情查询
 * 所有函数返回 Promise，失败时抛出 ApiError（携带业务码与可展示文案），由调用方决定如何处理；
 * 统一信封（{code, message, data}）的失败判别收口在 http.ts 响应拦截器，本层只做 data 解包
 */
import http from './http'
import type { SseStreamHandlers } from './sse'
import { consumeSseStream } from './sse'
import type { ApiResult, MatchDetail, MatchSummary, MatchTimelineFrame, PageResponse, RiotAccount } from './types'

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
  /** 按英雄过滤：该玩家本局使用的英雄 ID（作用在其本人参与者行上，与其它筛选叠加） */
  championId?: number
}

/** 按"昵称#tag"搜索召唤师账号（Riot Account-V1，后端库缓存优先；不存在时抛 ApiError 3001） */
export async function searchRiotAccount(riotName: string): Promise<RiotAccount> {
  // GET /api/riot/accounts/by-name：统一信封 data 内为账号信息（puuid/gameName/tagLine）
  const { data } = await http.get<ApiResult<RiotAccount>>('/api/riot/accounts/by-name', {
    params: { riotName }
  })
  return data.data as RiotAccount
}

/** 分页查询对局列表（按玩家过滤）：信封 data 内为 { items, page, pageSize, total } */
export async function listMatches(params: MatchQueryParams): Promise<PageResponse<MatchSummary>> {
  // GET /api/matches：解包信封取出分页结构（列表字段已由后端更名 data → items）
  const { data } = await http.get<ApiResult<PageResponse<MatchSummary>>>('/api/matches', { params })
  return data.data as PageResponse<MatchSummary>
}

/** 查询对局详情（不存在时拦截器抛 ApiError 2001，由调用方处理） */
export async function getMatchDetail(gameId: number): Promise<MatchDetail> {
  // GET /api/matches/{gameId}：统一信封 data 内为详情，解包后返回
  const { data } = await http.get<ApiResult<MatchDetail>>(`/api/matches/${gameId}`)
  return data.data as MatchDetail
}

/**
 * AI 对局表现分析（"战犯出列"，SSE 流式）：
 * 后端取本局详情组装数据摘要，流式调用 opencode go 模型，通过 text/event-stream
 * 逐块推送分析文本（打字机效果）；结果后端 JVM 缓存 2 分钟，命中时 start 事件 fromCache=true。
 * SSE 消费原语（fetch + ReadableStream + 事件分发）已抽取到 sse.ts，
 * 与周报锐评流式端点共用（工单 #33）。
 */

/** AI 分析 SSE 事件回调（单局分析场景别名，协议见 sse.ts 的 SseStreamHandlers） */
export type AnalyzeStreamHandlers = SseStreamHandlers

/**
 * 发起 AI 对局分析（SSE 流式）：POST /api/matches/{gameId}/ai-analysis
 * 开流前失败抛 ApiError（如 4101 无 Key / 2001 对局不存在），流中错误经 onError 回调
 *
 * @param gameId   对局 ID
 * @param handlers 流式事件回调（全部可选）
 * @returns 流结束时 resolve；HTTP 错误/网络错误时 reject
 */
export async function analyzeMatch(
  gameId: number,
  handlers: AnalyzeStreamHandlers = {}
): Promise<void> {
  await consumeSseStream(`/api/matches/${gameId}/ai-analysis`, 'POST', 'AI analysis', handlers)
}

/** 查询对局时间线（不存在时拦截器抛 ApiError 2002；帧结构未建模，透传 unknown 供消费方防御处理） */
export async function getMatchTimeline(gameId: number): Promise<MatchTimelineFrame[]> {
  // GET /api/matches/{gameId}/timeline：统一信封 data 内为帧数组，解包后返回
  const { data } = await http.get<ApiResult<MatchTimelineFrame[]>>(`/api/matches/${gameId}/timeline`)
  return data.data as MatchTimelineFrame[]
}
