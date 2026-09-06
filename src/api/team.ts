/**
 * 车队周报 / 榜单中心 API：与后端 league-akari-server TeamController 契约一一对齐（统一信封解包，失败判别在 http.ts 拦截器）
 * - GET /api/team/weekly?date=        车队周报统计（date 为该周任意一天 ISO，缺省=上一周；
 *                                     不含 AI 锐评——锐评经 SSE 端点单独流式拉取，工单 #33 / ADR 0007）
 * - GET /api/team/weekly/ai-comment   周报 AI 锐评（SSE 流式，事件契约与单局分析一致）
 * - GET /api/team/leaderboards?...    榜单中心单维度榜单
 * - GET /api/team/members             roster 成员与出勤
 * - GET /api/team/members/{puuid}     成员卡（成长曲线 + 英雄基线对比）
 * - POST /api/team/backfill           触发 Riot 历史对局回填（异步）
 */
import http from './http'
import type { SseStreamHandlers } from './sse'
import { consumeSseStream } from './sse'
import type { ApiResult } from './types'

/**
 * 车队接口的超时时间（毫秒）——按请求覆盖全局的 10s：
 * - 榜单/成员卡要实时重算对局评分（历史回填后数据量大时更慢），需放宽；
 * - 周报统计已不含 AI 锐评（拆分到 SSE 端点），回到全局 10s
 */
const STATS_TIMEOUT_MS = 90_000

/** 榜单条目：value 为主排序值（后端已保留两位小数），detail 为口径说明（与后端 BoardEntry 对齐） */
export interface TeamBoardEntry {
  /** 成员 puuid */
  puuid: string
  /** 成员 riotId（"昵称#tag"） */
  riotId: string
  /** 主值（次数/场均/场次，含义随榜单维度不同） */
  value: number
  /** 补充说明，如 "MVP×1 SVP×1"、"2场" */
  detail: string
  /** 英雄 ID（仅绝活榜填充，供按英雄分组） */
  championId?: number
  /** 英雄中文名（仅绝活榜填充） */
  championName?: string
  /** 该英雄场次数（仅绝活榜填充） */
  games?: number
  /** 该英雄胜场数（仅绝活榜填充） */
  wins?: number
}

/** 周报总览（场次按车队对局计，胜负按成员人次计） */
export interface TeamWeeklyOverview {
  /** 车队对局数 */
  gameCount: number
  /** 成员参与人次 */
  memberGameCount: number
  /** 成员人次胜场 */
  winCount: number
  /** 成员人次败场 */
  lossCount: number
  /** 对局总时长（秒） */
  totalDurationSeconds: number
  /** 对局最密集的一天（yyyy-MM-dd），无对局时为 null */
  busiestDay: string | null
  /** 最密集一天的局数 */
  busiestDayGames: number
  /** 本周有出勤的成员 riotId 列表 */
  activeMembers: string[]
}

/** 名场面单条 */
export interface TeamHighlight {
  /** 所属对局 gameId */
  gameId: number
  /** 标题，如 "五杀时刻" */
  title: string
  /** 人类可读描述 */
  detail: string
  /** 量化值 */
  value: number
}

/** 周报名场面集合（各维度可能为 null） */
export interface TeamHighlights {
  biggestComeback: TeamHighlight | null
  worstStreak: TeamHighlight | null
  multiKillMoment: TeamHighlight | null
  mostKillsGame: TeamHighlight | null
  /** 时间线缺失、被名场面抽取跳过的对局数（覆盖度提示） */
  missingTimelineCount?: number
}

/** 车队周报（与后端 WeeklyReportResponse 对齐） */
export interface TeamWeeklyReport {
  /** 周起始（周一 00:00 +08:00）epoch 毫秒 */
  weekStartMs: number
  /** 周结束（次周一 00:00 +08:00）epoch 毫秒 */
  weekEndMs: number
  /** 周标签，如 "2026-08-24 ~ 2026-08-30" */
  weekLabel: string
  /** 车队名（team.name 配置，分享图标题用） */
  teamName?: string
  overview: TeamWeeklyOverview | null
  mvpBoard: TeamBoardEntry[] | null
  /** 场均 op_score 排行（降序，与战犯榜同口径反向） */
  opScoreBoard?: TeamBoardEntry[] | null
  criminalBoard: TeamBoardEntry[] | null
  feederBoard: TeamBoardEntry[] | null
  carryBoard: TeamBoardEntry[] | null
  signatureBoard: TeamBoardEntry[] | null
  attendanceBoard: TeamBoardEntry[] | null
  /** 名场面集合 */
  highlights: TeamHighlights | null
  /**
   * AI 锐评——统计接口恒为 null（锐评经 streamWeeklyComment 流式拉取，工单 #33）；
   * 字段保留用于后端 DTO 对齐，前端不应从统计响应读取锐评
   */
  aiComment?: string | null
}

/** 搭档胜率矩阵单格（与后端 DuoMatrixResponse.Cell 对齐，工单 #37） */
export interface DuoMatrixCell {
  /** 搭档局数 */
  games: number
  /** 人次胜场 */
  wins: number
  /** 人次负场 */
  losses: number
  /** 胜率（0-1）；0 局时为 null */
  winRate: number | null
}

/** 搭档胜率矩阵响应（与后端 DuoMatrixResponse 对齐，工单 #37 / spec #31） */
export interface DuoMatrix {
  /** 矩阵轴成员（roster 顺序，riotId） */
  members: string[]
  /** N×N 对称矩阵 */
  matrix: DuoMatrixCell[][]
}

/** 时段统计单桶（与后端 DuoExtendedResponse.TimeSlotStats 对齐，工单 #41） */
export interface TimeSlotStats {
  /** 时段键（morning/afternoon/evening/lateNight/weeHours） */
  key: string
  /** 时段中文名（如"晚间开黑"） */
  label: string
  games: number
  wins: number
  losses: number
  /** 胜率（0-1）；0 局时为 null */
  winRate: number | null
}

/** 阵容成员与其常用英雄（众数；头像渲染依据，spec #44） */
export interface LineupMemberChampion {
  riotId: string
  championId: number
  championName: string
  games: number
}

/** 常用阵容（与后端 DuoExtendedResponse.LineupStats 对齐，工单 #41） */
export interface LineupStats {
  /** 阵容成员（riotId） */
  members: string[]
  games: number
  wins: number
  losses: number
  /** 胜率（0-1） */
  winRate: number
  /** 成员×常用英雄（spec #44；旧数据可能缺失） */
  memberChampions?: LineupMemberChampion[]
}

/** 组合扩展统计响应（与后端 DuoExtendedResponse 对齐，工单 #41 / spec #31） */
export interface DuoExtended {
  timeSlots: TimeSlotStats[]
  lineups: LineupStats[]
}

/** 榜单中心响应（与后端 LeaderboardResponse 对齐） */
export interface TeamLeaderboard {
  dimension: string
  startMs: number | null
  endMs: number | null
  gameMode: string | null
  entries: TeamBoardEntry[]
}

/** 车队成员（与后端 TeamMembersResponse.Member 对齐） */
export interface TeamMember {
  puuid: string
  riotId: string
  games: number
  wins: number
  /** 胜率 0-1，无对局时为 null */
  winRate: number | null
}

/** 成员卡趋势点（逐周） */
export interface MemberTrendPoint {
  /** 周标签（该周周一日期） */
  weekLabel: string
  games: number
  winRate: number | null
  avgOpScore: number | null
}

/** 成员卡英雄统计（本人 vs 全库基线） */
export interface MemberChampionStat {
  championId: number
  championName: string
  games: number
  wins: number
  avgOpScore: number | null
  avgDamagePerMin: number | null
  /** 全库同英雄分均伤害基线，无样本时为 null */
  baselineDamagePerMin: number | null
}

/** 成员卡（与后端 MemberCardResponse 对齐） */
export interface TeamMemberCard {
  puuid: string
  riotId: string
  trend: MemberTrendPoint[]
  champions: MemberChampionStat[]
}

/** 榜单维度全集（与后端 DIMENSIONS 对齐） */
export const LEADERBOARD_DIMENSIONS = [
  { key: 'attendance', label: '出勤榜' },
  { key: 'mvp', label: 'MVP 榜' },
  { key: 'opscore', label: 'op_score 榜' },
  { key: 'criminal', label: '战犯榜' },
  { key: 'feeder', label: '送头王' },
  { key: 'carry', label: 'Carry 王' },
  { key: 'signature', label: '绝活榜' }
] as const

/**
 * 从 axios 错误中提取后端业务提示（{code,message} 响应体）；
 * 无响应体时回退 Error.message，供各页面统一展示
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
  return detail ?? (error instanceof Error ? error.message : fallback)
}

/** 查询车队周报统计（date 为该周内任意一天 ISO 字符串，缺省=上一周；不含 AI 锐评） */
export async function getWeeklyReport(date?: string): Promise<TeamWeeklyReport> {
  // GET /api/team/weekly：后端包 { data }，这里解包；统计聚合较快，走全局超时
  const { data } = await http.get<ApiResult<TeamWeeklyReport>>('/api/team/weekly', {
    params: date ? { date } : {}
  })
  return data.data as TeamWeeklyReport
}

/**
 * 周报 AI 锐评（SSE 流式，工单 #33 / ADR 0007）：
 * GET /api/team/weekly/ai-comment?date= —— 周报页先渲染统计，锐评打字机逐字推送。
 * 事件契约与单局 AI 分析一致（start/chunk/reasoning/reasoning-reset/done/error，
 * 消费原语见 sse.ts）；后端按周标签缓存 10 分钟，命中时 start 事件 fromCache=true
 *
 * @param date     该周内任意一天 ISO 字符串（缺省=本周，与统计接口同语义，ADR 0010）
 * @param handlers 流式事件回调（全部可选）
 * @param force    强制刷新（ADR 0010）：跳过缓存重新生成；仅当前周生效，
 *                 历史周被后端忽略（不可变），同周 60 秒冷却由服务端兜底
 * @returns 流结束时 resolve；开流前失败（如 4101 Key 未配置）时 reject ApiError
 */
export async function streamWeeklyComment(
  date?: string,
  handlers: SseStreamHandlers = {},
  force = false
): Promise<void> {
  // 查询参数逐个拼接：仅在有值时追加（普通请求不带 force，URL 与既有行为一致）
  const params = new URLSearchParams()
  if (date) {
    params.set('date', date)
  }
  if (force) {
    params.set('force', 'true')
  }
  const query = params.size > 0 ? `?${params.toString()}` : ''
  await consumeSseStream(`/api/team/weekly/ai-comment${query}`, 'GET', 'Weekly AI comment', handlers)
}

/** 查询榜单中心单维度榜单 */
export async function getTeamLeaderboard(params: {
  dimension: string
  mode?: string
  start?: number
  end?: number
  /** 主版本筛选（如 "16.15"，工单 #38） */
  version?: string
}): Promise<TeamLeaderboard> {
  const { data } = await http.get<ApiResult<TeamLeaderboard>>('/api/team/leaderboards', {
    params,
    timeout: STATS_TIMEOUT_MS
  })
  return data.data as TeamLeaderboard
}

/** 查询车队成员列表与出勤 */
export async function getTeamMembers(): Promise<TeamMember[]> {
  const { data } = await http.get<ApiResult<{ members: TeamMember[] }>>('/api/team/members', {
    timeout: STATS_TIMEOUT_MS
  })
  return (data.data as { members: TeamMember[] }).members
}

/** 查询成员卡（成长曲线 + 英雄基线对比） */
export async function getMemberCard(puuid: string): Promise<TeamMemberCard> {
  const { data } = await http.get<ApiResult<TeamMemberCard>>(`/api/team/members/${puuid}`, {
    timeout: STATS_TIMEOUT_MS
  })
  return data.data as TeamMemberCard
}

/** 查询搭档胜率矩阵（工单 #37）：只统计车队对局，胜负按成员人次计 */
export async function getDuoMatrix(params: {
  mode?: string
  start?: number
  end?: number
  /** 主版本筛选（如 "16.15"，工单 #38） */
  version?: string
}): Promise<DuoMatrix> {
  const { data } = await http.get<ApiResult<DuoMatrix>>('/api/team/duo-matrix', {
    params,
    timeout: STATS_TIMEOUT_MS
  })
  return data.data as DuoMatrix
}

/** 查询组合扩展统计（工单 #41）：时段胜率 + 常用阵容 */
export async function getDuoExtended(params: {
  mode?: string
  start?: number
  end?: number
  version?: string
}): Promise<DuoExtended> {
  const { data } = await http.get<ApiResult<DuoExtended>>('/api/team/duo-extended', {
    params,
    timeout: STATS_TIMEOUT_MS
  })
  return data.data as DuoExtended
}

/** 版本胜率单点（与后端 SeasonReportResponse.VersionStat 对齐，工单 #42） */
export interface SeasonVersionStat {
  version: string
  games: number
  wins: number
  losses: number
  winRate: number
}

/** 英雄使用次数（与后端 SeasonReportResponse.ChampionCount 对齐） */
export interface SeasonChampionCount {
  champion: string
  /** 英雄 ID（头像渲染依据，spec #44；旧数据可能缺失） */
  championId?: number
  games: number
}

/** 成员单版本的英雄分布（与后端 SeasonReportResponse.VersionChampions 对齐） */
export interface SeasonVersionChampions {
  version: string
  /** 英雄分布（按局数降序） */
  champions: SeasonChampionCount[]
}

/** 成员英雄池漂移（与后端 SeasonReportResponse.MemberDrift 对齐） */
export interface SeasonMemberDrift {
  riotId: string
  versions: SeasonVersionChampions[]
}

/** 赛季报告高光时刻 */
export interface SeasonHighlight {
  gameId: number
  title: string
  detail: string
}

/** 赛季报告响应（与后端 SeasonReportResponse 对齐，工单 #42 / spec #32） */
export interface SeasonReport {
  totalGames: number
  totalWinRate: number
  versionStats: SeasonVersionStat[]
  memberDrifts: SeasonMemberDrift[]
  mostKills: SeasonHighlight | null
}

/** 查询赛季报告（工单 #42）：赛季起止人工指定（毫秒时间戳），纯数据聚合即时返回 */
export async function getSeasonReport(start: number, end: number): Promise<SeasonReport> {
  const { data } = await http.get<ApiResult<SeasonReport>>('/api/team/season-report', {
    params: { start, end },
    timeout: STATS_TIMEOUT_MS
  })
  return data.data as SeasonReport
}

/** 触发 Riot 历史对局回填（异步；返回是否成功启动，false=已在运行） */
export async function triggerTeamBackfill(): Promise<boolean> {
  const { data } = await http.post<ApiResult<{ started: boolean }>>('/api/team/backfill')
  return (data.data as { started: boolean }).started
}
