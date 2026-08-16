/**
 * 战绩分析页面类型定义（League Akari 风格：顶部导航 + 左侧边栏 + 右侧战绩列表）
 * 任务 14 改造：列表项改为原版折叠卡（MatchCardOverview + MatchCard），
 * 移除旧卡片模型（GameCard/TeamDetail 等），列表项直接承载轻量摘要 + 懒加载详情
 */
import type { MatchDetail, MatchSummary } from '@/api/types'
import type { MatchCardGameDetails } from '@/views/match-detail/adapter/types'

/** 顶部导航的段位板块（如 单双排位 / 灵活排位） */
export interface RankSection {
  /** 队列名称，如 单双排位 */
  queue: string
  /** 当前段位（未定级时为"未定级"） */
  tier: string
  /** 历史最高段位 */
  highestTier: string
}

/** 总览统计区字段 */
export interface OverviewStats {
  /** Akari Score 综合评分（当前无数据源，恒为 null，界面显示 '-'） */
  akariScore: number | null
  /** 平均 KDA 比率 */
  avgKda: number
  /** 参团率百分比 */
  participation: number
  /** 伤害占比百分比 */
  damageShare: number
  /** 承伤占比百分比 */
  damageTakenShare: number
  /** 经济占比百分比 */
  goldShare: number
  /** 每分钟补刀 */
  csPerMin: number
  /** 胜场 */
  wins: number
  /** 负场 */
  losses: number
  /** 阵容分布：常用英雄 ID 列表（头像小网格，取出现次数前 5） */
  lineupChampionIds: number[]
}

/** 最近队友/对手列表项 */
export interface RecentPlayer {
  /** 玩家 puuid */
  puuid: string
  /** 昵称 */
  name: string
  /** 尾号，如 tw2 */
  tagLine: string
  /** 头像（英雄 ID 占位） */
  championId: number
  /** 胜场 */
  wins: number
  /** 负场 */
  losses: number
}

/**
 * 战绩列表项：轻量摘要 + 懒加载详情
 * 折叠态渲染 MatchCardOverview（摘要 participants 转适配模型）；
 * 展开态由父组件拉取详情与时间线后注入，渲染 MatchCard 展开态
 */
export interface GameListItem {
  /** 列表接口返回的轻量摘要（含 participants 轻量档案） */
  summary: MatchSummary
  /** 真实详情（懒加载：点击展开后由父组件注入，未加载时为 null） */
  detail: MatchDetail | null
  /** 时间线数据（与详情并行加载；失败保持 null，时间线 Tab 空态） */
  details: MatchCardGameDetails | null
}

/** 战绩分析页面数据根对象 */
export interface GameStatsData {
  /** 顶部导航段位板块 */
  rankSections: RankSection[]
  /** 左侧总览统计 */
  overview: OverviewStats
  /** 最近队友 */
  recentTeammates: RecentPlayer[]
  /** 最近对手 */
  recentOpponents: RecentPlayer[]
}
