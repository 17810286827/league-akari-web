/**
 * 对局相关 API：召唤师搜索、分页列表、详情查询
 * 所有函数返回 Promise，失败时抛出错误（如 404），由调用方决定如何处理
 */
import http from './http'
import type { MatchDetail, MatchSummary, PageResponse, RiotAccount } from './types'

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

/** 查询对局时间线（404 时抛出，由调用方处理；帧结构未建模，透传 unknown 供消费方防御处理） */
export async function getMatchTimeline(gameId: number): Promise<MatchTimelineFrame[]> {
  // GET /api/matches/{gameId}/timeline：后端将帧数组包在 { data } 中，这里解包后返回
  const { data } = await http.get<{ data: MatchTimelineFrame[] }>(`/api/matches/${gameId}/timeline`)
  return data.data
}
