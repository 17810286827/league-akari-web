/**
 * 战绩分析页数据适配层：后端 API 数据 → 页面展示模型（GameCard / TeamDetail / 侧栏聚合统计）
 * 职责：
 * 1. MatchSummary → GameCard（列表卡片所需字段，契约第 4 节规则）
 * 2. MatchDetail → GameDetail（展开详情的蓝红双队，含队内占比与出装解析）
 * 3. 侧栏聚合统计（总览 / 最近队友 / 最近对手，均从当前页数据实时计算）
 */
import type {
  MatchDetail,
  MatchParticipant,
  MatchSummary,
  MatchTeammate
} from '@/api/types'
import { parseIdArray } from '@/utils/parse-json'

import type { GameCard, GameDetail, GameResult, GameTag, OverviewStats, RecentPlayer, TeamDetail } from './types'

/** 队列筛选选项：后端 listMatches 支持 queueId 参数，null 表示所有模式 */
export interface QueueOption {
  /** 下拉展示文案 */
  label: string
  /** 后端队列 ID；null 表示不筛选 */
  queueId: number | null
}

/** 真实队列 ID 映射（与后端 queueId 对齐） */
export const QUEUE_OPTIONS: QueueOption[] = [
  { label: '所有模式', queueId: null },
  { label: '单双排位', queueId: 420 },
  { label: '灵活排位', queueId: 440 },
  { label: '极地大乱斗', queueId: 450 }
]

/** 地图名映射：游戏模式 → 中文地图名，未收录的模式原样展示 */
const MAP_NAMES: Record<string, string> = {
  ARAM: '嚎哭深渊',
  CLASSIC: '召唤师峡谷'
}

/** 队伍侧别映射：后端 teamId 100 为蓝方、200 为红方 */
const TEAM_SIDES: Record<number, TeamDetail['side']> = {
  100: 'blue',
  200: 'red'
}

/**
 * 将时间戳格式化为 "YYYY-MM-DD HH:mm" 文本（本地时区）
 * @param timestamp 毫秒时间戳（gameCreation）
 * @returns 展示用日期文本
 */
function formatDate(timestamp: number): string {
  const d = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * 将秒数格式化为 "mm:ss" 文本（分钟不补零，秒补零）
 * @param seconds 对局时长（秒）
 * @returns 展示用时长文本
 */
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

/**
 * 拆分召唤师名称：按最后一个 # 拆出昵称与尾号；无 # 时整体作为昵称
 * @param summonerName 后端原样名称，如 "ZZXOOV#qyq"
 * @returns 昵称与尾号（尾号可能为空字符串）
 */
function splitName(summonerName: string): { name: string; tagLine: string } {
  const hashIndex = summonerName.lastIndexOf('#')
  if (hashIndex <= 0 || hashIndex === summonerName.length - 1) {
    return { name: summonerName, tagLine: '' }
  }
  return { name: summonerName.slice(0, hashIndex), tagLine: summonerName.slice(hashIndex + 1) }
}

/**
 * 计算百分比整数：分子 / 分母，分母为 0 时返回 0（避免除零与 NaN）
 * @param numerator 分子
 * @param denominator 分母
 * @returns 四舍五入后的百分比整数
 */
function percentOf(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0
  }
  return Math.round((numerator / denominator) * 100)
}

/**
 * 解析 statsJson 快照为普通对象；解析失败返回空对象（不影响卡片展示）
 * @param statsJson 后端原样存储的 JSON 字符串
 * @returns 解析出的对象，失败时为空对象
 */
function parseStats(statsJson: string | null): Record<string, unknown> {
  if (!statsJson) {
    return {}
  }
  try {
    const parsed = JSON.parse(statsJson) as unknown
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/**
 * 从 stats 对象安全取数字字段；缺失或类型不符时返回 0
 * @param stats 解析后的 stats 对象
 * @param key 字段名，如 totalDamageDealtToChampions
 * @returns 数字值（默认 0）
 */
function numOf(stats: Record<string, unknown>, key: string): number {
  const value = stats[key]
  return typeof value === 'number' ? value : 0
}

/**
 * 解析 teamsJson 中每队的推塔数：按 teamId → towerKills 建映射
 * 解析失败返回空映射（推塔数按 0 展示）
 * @param teamsJson 后端原样存储的队伍快照 JSON 字符串
 * @returns teamId → towerKills 映射
 */
function parseTowerKills(teamsJson: string | null): Map<number, number> {
  const result = new Map<number, number>()
  if (!teamsJson) {
    return result
  }
  try {
    const parsed = JSON.parse(teamsJson) as unknown
    if (!Array.isArray(parsed)) {
      return result
    }
    for (const team of parsed) {
      // 每个队伍项含 teamId 与 towerKills 字段，缺失时跳过
      const teamId = (team as Record<string, unknown>).teamId
      const towers = (team as Record<string, unknown>).towerKills
      if (typeof teamId === 'number') {
        result.set(teamId, typeof towers === 'number' ? towers : 0)
      }
    }
  } catch {
    // 解析失败：保持空映射，调用方按 0 处理
  }
  return result
}

/**
 * 构建一支队伍的 TeamDetail：汇总行 + 5 名玩家明细（含队内伤害/承伤占比、每分钟输出）
 * @param players 该队参与者列表（后端顺序）
 * @param side 阵营（蓝 / 红）
 * @param towers 该队推塔数（teamsJson 解析）
 * @param duration 对局时长（秒），用于计算每分钟输出
 * @returns 页面展示用队伍明细
 */
function buildTeamDetail(
  players: MatchParticipant[],
  side: TeamDetail['side'],
  towers: number,
  duration: number
): TeamDetail {
  // 队内总伤害与总承伤：用于计算每个玩家的占比
  const teamDamage = players.reduce((sum, p) => sum + numOf(parseStats(p.statsJson), 'totalDamageDealtToChampions'), 0)
  const teamDamageTaken = players.reduce((sum, p) => sum + numOf(parseStats(p.statsJson), 'totalDamageTaken'), 0)

  const detailPlayers = players.map((p) => {
    // 伤害/承伤取自 statsJson 快照，缺失时按 0 处理
    const stats = parseStats(p.statsJson)
    const damage = numOf(stats, 'totalDamageDealtToChampions')
    const damageTaken = numOf(stats, 'totalDamageTaken')
    return {
      name: p.summonerName,
      championId: p.championId,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      gold: p.goldEarned,
      // 每分钟输出 = 总伤害 / 分钟数，时长异常时按 0 展示
      damagePerMin: duration > 0 ? Math.round(damage / (duration / 60)) : 0,
      // 出装从 items JSON 解析（过滤 0 空槽，避免渲染无效图标），非法 JSON 时为空数组
      items: parseIdArray(p.items).filter((itemId) => itemId > 0),
      // 召唤师技能从 summonerSpells JSON 解析（如 [32, 4] 海克斯闪现+闪现），缺失时为空数组
      summonerSpells: parseIdArray(p.summonerSpells),
      damagePercent: percentOf(damage, teamDamage),
      damageTakenPercent: percentOf(damageTaken, teamDamageTaken)
    }
  })

  // 队伍汇总：总 KDA 与总经济由 5 人明细求和
  return {
    side,
    totalKills: detailPlayers.reduce((sum, p) => sum + p.kills, 0),
    totalDeaths: detailPlayers.reduce((sum, p) => sum + p.deaths, 0),
    totalAssists: detailPlayers.reduce((sum, p) => sum + p.assists, 0),
    totalGold: detailPlayers.reduce((sum, p) => sum + p.gold, 0),
    towers,
    players: detailPlayers
  }
}

/**
 * 计算单局结果的展示分类：胜利 / 投降 / 失败
 * 规则（契约）：self.win 为 true → 胜利；否则若 gameEndedInSurrender → 投降；其余为失败
 * @param win 本玩家是否获胜
 * @param surrendered 是否以投降结束
 * @returns 展示用结果分类
 */
function resultOf(win: boolean, surrendered: boolean): GameResult {
  if (win) {
    return 'victory'
  }
  return surrendered ? 'surrender' : 'defeat'
}

/**
 * 计算卡片的特殊标记列表（契约）：四杀（连杀 ≥ 4）与拆塔（推塔数 > 0）
 * @param largestMultiKill 最大连杀数
 * @param turretKills 推塔数
 * @returns 标记列表（可能为空）
 */
function tagsOf(largestMultiKill: number, turretKills: number): GameTag[] {
  const tags: GameTag[] = []
  if (largestMultiKill >= 4) {
    tags.push({ type: 'quadra', label: '四杀' })
  }
  if (turretKills > 0) {
    tags.push({ type: 'tower', label: '拆塔' })
  }
  return tags
}

/**
 * 将单条 MatchSummary 转换为页面卡片 GameCard
 * 后端契约增强字段（self/teamTotals）缺失时返回 null，由调用方过滤（过渡期兼容）
 * @param summary 后端列表接口返回的单条摘要
 * @returns 页面卡片；数据不完整时返回 null
 */
export function summaryToCard(summary: MatchSummary): GameCard | null {
  // 契约字段缺失（后端未升级期间）时跳过该局，避免渲染空卡片
  if (!summary.self || !summary.teamTotals) {
    return null
  }
  const self = summary.self
  const totals = summary.teamTotals
  const { name, tagLine } = splitName(self.summonerName)

  // 队友列表：同队除 self 外的 4 人（名称拆分 + 本局英雄头像）
  const teammates = summary.teammates.map((t: MatchTeammate) => ({
    puuid: t.puuid,
    name: splitName(t.summonerName).name,
    championId: t.championId,
    // 常用英雄暂无可信数据源，由组件按需隐藏副展示
    mainChampionId: undefined
  }))

  return {
    gameId: summary.gameId,
    queueId: summary.queueId,
    result: resultOf(self.win, self.gameEndedInSurrender),
    championId: self.championId,
    kills: self.kills,
    deaths: self.deaths,
    assists: self.assists,
    // 伤害占比 = 本玩家伤害 / 全队伤害，分母为 0 时取 0（percentOf 兜底）
    damageShare: percentOf(self.totalDamage, totals.damage),
    totalDamage: self.totalDamage,
    duration: formatDuration(summary.gameDuration),
    date: formatDate(summary.gameCreation),
    // 地图名按模式映射，未收录模式原样展示
    mapName: MAP_NAMES[summary.gameMode] ?? summary.gameMode,
    tags: tagsOf(self.largestMultiKill, self.turretKills),
    teammates,
    // 详情懒加载：初始为 null，点击卡片后由父组件注入
    detail: null
  }
}

/**
 * 将 MatchDetail 转换为页面的蓝红双队详情（展开卡片时调用）
 * 队伍侧别按 teamId 映射（100 蓝 / 200 红），未知 teamId 兜底按出现顺序分配
 * @param detail 后端详情接口返回
 * @returns 双队展示模型
 */
export function detailToGameDetail(detail: MatchDetail): GameDetail {
  // 按 teamId 分组，保持后端参与者顺序
  const groups = new Map<number, MatchParticipant[]>()
  for (const participant of detail.participants) {
    const list = groups.get(participant.teamId) ?? []
    list.push(participant)
    groups.set(participant.teamId, list)
  }

  // 推塔数从 teamsJson 解析（按 teamId 匹配），解析失败按 0
  const towerMap = parseTowerKills(detail.teamsJson)

  // 队伍侧别分配：100 → 蓝、200 → 红；其余 teamId 按升序兜底分配
  const teamIds = [...groups.keys()].sort()
  const sides: TeamDetail['side'][] = ['blue', 'red']
  const teams = teamIds.map((teamId, index) => {
    const side = TEAM_SIDES[teamId] ?? sides[index % sides.length] ?? 'blue'
    return buildTeamDetail(groups.get(teamId) ?? [], side, towerMap.get(teamId) ?? 0, detail.gameDuration)
  })

  // 双队兜底：数据异常（少于两队）时补全空队，保证模板两侧都有渲染
  const blue = teams.find((t) => t.side === 'blue') ?? buildTeamDetail([], 'blue', 0, detail.gameDuration)
  const red = teams.find((t) => t.side === 'red') ?? buildTeamDetail([], 'red', 0, detail.gameDuration)
  return { blue, red }
}

/**
 * 从本页对局聚合总览统计（契约第 5 节）
 * 各项占比按每局计算后取平均；Akari Score 无数据源恒为 null（界面显示 '-'）
 * @param matches 当前页（可能已按队列过滤）的原始摘要列表
 * @returns 总览统计模型
 */
export function computeOverview(matches: MatchSummary[]): OverviewStats {
  // 跳过契约增强字段缺失的对局，避免 NaN 污染聚合结果
  const valid = matches.filter((m) => m.self && m.teamTotals)

  // 胜负计数与各占比求和（每局单独计算后平均）
  let wins = 0
  let losses = 0
  let killsSum = 0
  let deathsSum = 0
  let assistsSum = 0
  let participationSum = 0
  let damageShareSum = 0
  let damageTakenShareSum = 0
  let goldShareSum = 0
  let csPerMinSum = 0
  // 阵容分布：英雄 ID → 出场次数
  const championCount = new Map<number, number>()

  for (const match of valid) {
    const self = match.self!
    const totals = match.teamTotals!
    if (self.win) {
      wins += 1
    } else {
      losses += 1
    }
    killsSum += self.kills
    deathsSum += self.deaths
    assistsSum += self.assists
    // 参团率 = 本玩家击杀+助攻 / 全队击杀
    participationSum += percentOf(self.kills + self.assists, totals.kills)
    damageShareSum += percentOf(self.totalDamage, totals.damage)
    damageTakenShareSum += percentOf(self.totalDamageTaken, totals.damageTaken)
    goldShareSum += percentOf(self.goldEarned, totals.gold)
    // 每分钟补刀 = 补刀数 / 分钟数
    csPerMinSum += match.gameDuration > 0 ? self.cs / (match.gameDuration / 60) : 0
    championCount.set(self.championId, (championCount.get(self.championId) ?? 0) + 1)
  }

  const count = valid.length
  // 平均 KDA = (总击杀 + 总助攻) / 总死亡；无死亡时退化为击杀+助攻总和
  const avgKda = count > 0 ? (deathsSum > 0 ? (killsSum + assistsSum) / deathsSum : killsSum + assistsSum) : 0
  // 阵容分布取出场次数前 5 的英雄
  const lineupChampionIds = [...championCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([championId]) => championId)

  return {
    akariScore: null,
    avgKda: count > 0 ? Number(avgKda.toFixed(2)) : 0,
    participation: count > 0 ? Math.round(participationSum / count) : 0,
    damageShare: count > 0 ? Math.round(damageShareSum / count) : 0,
    damageTakenShare: count > 0 ? Math.round(damageTakenShareSum / count) : 0,
    goldShare: count > 0 ? Math.round(goldShareSum / count) : 0,
    csPerMin: count > 0 ? Number((csPerMinSum / count).toFixed(1)) : 0,
    wins,
    losses,
    lineupChampionIds
  }
}

/**
 * 从本页对局的队友摘要聚合"最近队友"：按 puuid 出现次数排序取前 5
 * 胜负数按各局 win 累加；昵称与英雄取最后一次出现的值（契约第 5 节）
 * @param matches 当前页原始摘要列表
 * @returns 最近队友列表（最多 5 人）
 */
export function computeRecentTeammates(matches: MatchSummary[]): RecentPlayer[] {
  // puuid → 聚合结果（含出现次数用于排序）
  const map = new Map<string, RecentPlayer & { appearCount: number }>()
  for (const match of matches) {
    for (const teammate of match.teammates) {
      const { name, tagLine } = splitName(teammate.summonerName)
      const existing = map.get(teammate.puuid)
      if (existing) {
        // 同一人再次出现：胜负数累加，昵称与英雄取最新
        if (teammate.win) {
          existing.wins += 1
        } else {
          existing.losses += 1
        }
        existing.name = name
        existing.tagLine = tagLine
        existing.championId = teammate.championId
        existing.appearCount += 1
      } else {
        map.set(teammate.puuid, {
          puuid: teammate.puuid,
          name,
          tagLine,
          championId: teammate.championId,
          wins: teammate.win ? 1 : 0,
          losses: teammate.win ? 0 : 1,
          appearCount: 1
        })
      }
    }
  }
  return [...map.values()]
    .sort((a, b) => b.appearCount - a.appearCount)
    .slice(0, 5)
    .map(({ appearCount: _appearCount, ...player }) => player)
}

/**
 * 从已加载的详情聚合"最近对手"：取 self 所在队伍之外的所有玩家（每局 5 人）
 * 详情为懒加载，故对手数据随展开的对局增多而逐渐完整
 * @param details 已加载的详情列表
 * @param selfPuuid 当前用户 PUUID，用于识别本队
 * @returns 最近对手列表（最多 5 人）
 */
export function computeRecentOpponents(details: MatchDetail[], selfPuuid: string): RecentPlayer[] {
  const map = new Map<string, RecentPlayer & { appearCount: number }>()
  for (const detail of details) {
    // 定位 self 所在队伍，其余参与者视为对手
    const selfTeamId = detail.participants.find((p) => p.puuid === selfPuuid)?.teamId
    for (const participant of detail.participants) {
      // 跳过本队成员（含 self 自己）
      if (selfTeamId !== undefined && participant.teamId === selfTeamId) {
        continue
      }
      const { name, tagLine } = splitName(participant.summonerName)
      const existing = map.get(participant.puuid)
      if (existing) {
        // 胜负数从对手视角累加（其 win 即该局是否获胜）
        if (participant.win) {
          existing.wins += 1
        } else {
          existing.losses += 1
        }
        existing.name = name
        existing.tagLine = tagLine
        existing.championId = participant.championId
        existing.appearCount += 1
      } else {
        map.set(participant.puuid, {
          puuid: participant.puuid,
          name,
          tagLine,
          championId: participant.championId,
          wins: participant.win ? 1 : 0,
          losses: participant.win ? 0 : 1,
          appearCount: 1
        })
      }
    }
  }
  return [...map.values()]
    .sort((a, b) => b.appearCount - a.appearCount)
    .slice(0, 5)
    .map(({ appearCount: _appearCount, ...player }) => player)
}
