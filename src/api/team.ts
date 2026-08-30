/**
 * 车队周报 / 榜单中心 API：与后端 league-akari-server TeamController 契约一一对齐
 * - GET /api/team/weekly?date=        车队周报（date 为该周任意一天 ISO，缺省=上一周）
 * - GET /api/team/leaderboards?...    榜单中心单维度榜单
 * - GET /api/team/members             roster 成员与出勤
 * - GET /api/team/members/{puuid}     成员卡（成长曲线 + 英雄基线对比）
 * - POST /api/team/backfill           触发 Riot 历史对局回填（异步）
 */
import http from './http'

/**
 * 车队接口的超时时间（毫秒）——按请求覆盖全局的 10s：
 * - 周报聚合里同步生成 AI 锐评（模型 25~90s，空正文还会重试一次），
 *   10s 会被前端掐断，表现为"周报加载失败/切换周无效"；
 * - 榜单/成员卡要实时重算对局评分（历史回填后数据量大时更慢），也需放宽
 */
const WEEKLY_TIMEOUT_MS = 180_000
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
  highlights: TeamHighlights | null
  /** AI 锐评（AI 不可用时为 null，页面需优雅降级） */
  aiComment: string | null
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

/** 查询车队周报（date 为该周内任意一天 ISO 字符串，缺省=上一周） */
export async function getWeeklyReport(date?: string): Promise<TeamWeeklyReport> {
  // GET /api/team/weekly：后端包 { data }，这里解包；AI 锐评同步生成，须放宽超时
  const { data } = await http.get<{ data: TeamWeeklyReport }>('/api/team/weekly', {
    params: date ? { date } : {},
    timeout: WEEKLY_TIMEOUT_MS
  })
  return data.data
}

/** 查询榜单中心单维度榜单 */
export async function getTeamLeaderboard(params: {
  dimension: string
  mode?: string
  start?: number
  end?: number
}): Promise<TeamLeaderboard> {
  const { data } = await http.get<{ data: TeamLeaderboard }>('/api/team/leaderboards', {
    params,
    timeout: STATS_TIMEOUT_MS
  })
  return data.data
}

/** 查询车队成员列表与出勤 */
export async function getTeamMembers(): Promise<TeamMember[]> {
  const { data } = await http.get<{ data: { members: TeamMember[] } }>('/api/team/members', {
    timeout: STATS_TIMEOUT_MS
  })
  return data.data.members
}

/** 查询成员卡（成长曲线 + 英雄基线对比） */
export async function getMemberCard(puuid: string): Promise<TeamMemberCard> {
  const { data } = await http.get<{ data: TeamMemberCard }>(`/api/team/members/${puuid}`, {
    timeout: STATS_TIMEOUT_MS
  })
  return data.data
}

/** 触发 Riot 历史对局回填（异步；返回是否成功启动，false=已在运行） */
export async function triggerTeamBackfill(): Promise<boolean> {
  const { data } = await http.post<{ code: number; data: { started: boolean } }>('/api/team/backfill')
  return data.data.started
}
