/**
 * 队伍适配层（任务 6）：teamsJson（后端存储的 LCU Team 结构快照）解析
 * 输出对齐原版 data-adapter/match-history/teams.ts 的 teamStatMap（key 为字符串 teamId），
 * 供照搬组件零改动消费；voidGrubKills/atakhanKills 为新增字段，老数据缺失按 0
 *
 * 任务 9 扩展：新增 toMatchCardTeams（对齐原版 toTeams 的完整聚合输出），
 * 从 participants 聚合队伍统计并映射 teamInfo（bans/objectives），供 match-card context 消费
 */
import { createLogger } from '@/utils/logger'

import type { MatchCardParticipant, WinResult } from './types'

const logger = createLogger('MatchCardTeams')

/** teamsJson 内的原始队伍结构（LCU Team 平铺字段，统计字段可能缺失） */
interface RawTeam {
  teamId?: number
  /** LCU 的 win 为 'Win'/'Fail' 字符串，SGP 为布尔（原样透传） */
  win?: boolean | string
  towerKills?: number
  inhibitorKills?: number
  dragonKills?: number
  baronKills?: number
  riftHeraldKills?: number
  /** 巢虫击杀数（14.10 新资源，老数据缺失按 0） */
  voidGrubKills?: number
  /** 阿塔坎击杀数（15.1 新资源，老数据缺失按 0） */
  atakhanKills?: number
  firstBlood?: boolean
  /** 禁用英雄列表（LCU Team 原样透传，老数据可能缺失） */
  bans?: { championId: number; pickTurn: number }[]
}

/** 单队统计：字段名对应 LCU Team 结构，数字字段缺失按 0（组件侧 ?? 兜底） */
export interface MatchCardTeamStats {
  teamId: number
  win: boolean | string
  towerKills: number
  inhibitorKills: number
  dragonKills: number
  baronKills: number
  riftHeraldKills: number
  voidGrubKills: number
  atakhanKills: number
  firstBlood: boolean
  /** 禁用英雄列表（老数据缺失按空数组） */
  bans: { championId: number; pickTurn: number }[]
}

/** 队伍适配结果：teamStatMap 以字符串 teamId 为 key（对齐原版，便于组件按队查询） */
export interface MatchCardTeams {
  teamStatMap: Record<string, MatchCardTeamStats>
}

/** 数值兜底：undefined/null 统一转 0（老数据缺失字段不阻塞展示） */
function num(value: number | undefined): number {
  return typeof value === 'number' ? value : 0
}

/** 布尔兜底：undefined/null 统一转 false */
function bool(value: boolean | undefined): boolean {
  return value ?? false
}

/** 除零保护：0 时返回 1（伤转率等比率分母用） */
function noZero(value: number): number {
  return value || 1
}

/**
 * 解析 teamsJson（后端存储的队伍统计数组，容错模式复用旧 adapter 的 parseTeamsJson）：
 * 输入为空 / 非法 JSON / 非数组均返回空数组并记 warn（不阻塞展示）
 */
function parseTeamsJson(teamsJson: string | null): RawTeam[] {
  if (!teamsJson) {
    return []
  }
  try {
    const parsed = JSON.parse(teamsJson) as RawTeam[]
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    logger.warn('Failed to parse teamsJson', { teamsJson, error })
    return []
  }
}

/**
 * 把 teamsJson 转换为 MatchCardTeams：
 * 逐队映射 LCU Team 结构字段（win 原样透传），统计字段缺失按 0
 * @param teamsJson 后端存储的队伍统计数组 JSON 字符串，可能为 null
 * @returns teamStatMap（key 为字符串 teamId）；解析失败返回空 map
 */
export function toTeams(teamsJson: string | null): MatchCardTeams {
  const teamStatMap: Record<string, MatchCardTeamStats> = {}
  for (const raw of parseTeamsJson(teamsJson)) {
    const teamId = num(raw.teamId)
    teamStatMap[String(teamId)] = {
      teamId,
      win: raw.win ?? false,
      towerKills: num(raw.towerKills),
      inhibitorKills: num(raw.inhibitorKills),
      dragonKills: num(raw.dragonKills),
      baronKills: num(raw.baronKills),
      riftHeraldKills: num(raw.riftHeraldKills),
      voidGrubKills: num(raw.voidGrubKills),
      atakhanKills: num(raw.atakhanKills),
      firstBlood: bool(raw.firstBlood),
      bans: raw.bans ?? []
    }
  }
  return { teamStatMap }
}

// ---- 任务 9 扩展：完整队伍聚合（对齐原版 data-adapter/match-history/teams.ts 输出） ----

/** 队伍禁用英雄（原版 MatchTeamBan） */
export interface MatchTeamBan {
  championId: number
  pickTurn: number
}

/** 单类野怪目标统计（原版 MatchTeamObjectiveStats；first 未知时按 null） */
export interface MatchTeamObjectiveStats {
  first: boolean | null
  kills: number | null
}

/** 队伍目标统计（原版 MatchTeamObjectives；champion 槽位原版恒为 null） */
export interface MatchTeamObjectives {
  atakhan: MatchTeamObjectiveStats | null
  baron: MatchTeamObjectiveStats
  champion: MatchTeamObjectiveStats | null
  dragon: MatchTeamObjectiveStats
  horde: MatchTeamObjectiveStats
  inhibitor: MatchTeamObjectiveStats
  riftHerald: MatchTeamObjectiveStats
  tower: MatchTeamObjectiveStats
}

/** 队伍信息（原版 MatchTeamInfo；CHERRY 模式为 null） */
export interface MatchTeamInfo {
  bans: MatchTeamBan[]
  win: boolean | string
  teamId: number
  objectives: MatchTeamObjectives
}

/** 单队聚合统计（原版 MatchTeamStats：字段与团队标签/组件消费完全对齐） */
export interface MatchTeamStats {
  teamIdentifier: string
  teamInfo: MatchTeamInfo | null
  winResult: WinResult
  isSurrender: boolean
  win: boolean
  subteamPlacement: number
  maxDamageDealtToChampions: number
  totalDamageDealtToChampions: number
  maxDamageTaken: number
  totalDamageTaken: number
  maxGoldEarned: number
  totalGoldEarned: number
  maxKills: number
  totalKills: number
  totalDeaths: number
  totalAssists: number
  maxCs: number
  totalCs: number
  maxDamageToTowers: number
  totalDamageToTowers: number
  maxHeal: number
  totalHeal: number
  maxKda: number
  totalKda: number
  maxKillParticipation: number
  totalKillParticipation: number
  maxTimeCCingOthers: number
  maxDamageGoldEfficiency: number
  maxDamageShieldedOnTeammates: number | null
  totalDamageShieldedOnTeammates: number | null
}

/** 全队聚合统计（原版 AggregateTeamStats） */
export interface AggregateTeamStats {
  teamIdentifier: string
  bans: MatchTeamBan[]
  maxDamageDealtToChampions: number
  totalDamageDealtToChampions: number
  maxDamageTaken: number
  totalDamageTaken: number
  maxGoldEarned: number
  totalGoldEarned: number
  maxKills: number
  totalKills: number
  totalDeaths: number
  totalAssists: number
  maxCs: number
  totalCs: number
  maxDamageToTowers: number
  totalDamageToTowers: number
  maxHeal: number
  totalHeal: number
  maxKda: number
  totalKda: number
  maxKillParticipation: number
  totalKillParticipation: number
  maxTimeCCingOthers: number
  maxDamageGoldEfficiency: number
  maxDamageShieldedOnTeammates: number | null
  totalDamageShieldedOnTeammates: number | null
}

/** 队伍适配完整结果（原版 TeamsAdapterResult；teamStatMap 以 teamIdentifier 为 key） */
export interface TeamsAdapterResult {
  teamStatMap: Record<string, MatchTeamStats>
  teamStatsArr: MatchTeamStats[]
  allTeamStats: AggregateTeamStats
}

/** 单队最高/合计统计：从本队参与者聚合（max 取最大值，total 取累加） */
function aggregateTeamStats(
  teamIdentifier: string,
  arr: MatchCardParticipant[],
  teamInfo: MatchTeamInfo | null
): MatchTeamStats {
  const { isSurrender, result } = computeWinResult(arr[0])

  const shielded = arr[0]?.totalDamageShieldedOnTeammates !== null

  return {
    teamIdentifier,
    teamInfo,
    winResult: result,
    isSurrender,
    win: arr[0]?.win ?? false,
    subteamPlacement: arr[0]?.subteamPlacement ?? 0,
    maxDamageDealtToChampions: Math.max(...arr.map((p) => p.totalDamageDealtToChampions)),
    totalDamageDealtToChampions: arr.reduce((acc, p) => acc + p.totalDamageDealtToChampions, 0),
    maxDamageTaken: Math.max(...arr.map((p) => p.totalDamageTaken)),
    totalDamageTaken: arr.reduce((acc, p) => acc + p.totalDamageTaken, 0),
    maxGoldEarned: Math.max(...arr.map((p) => p.goldEarned)),
    totalGoldEarned: arr.reduce((acc, p) => acc + p.goldEarned, 0),
    maxKills: Math.max(...arr.map((p) => p.kills)),
    totalKills: arr.reduce((acc, p) => acc + p.kills, 0),
    totalDeaths: arr.reduce((acc, p) => acc + p.deaths, 0),
    totalAssists: arr.reduce((acc, p) => acc + p.assists, 0),
    maxCs: Math.max(...arr.map((p) => p.cs)),
    totalCs: arr.reduce((acc, p) => acc + p.cs, 0),
    maxDamageToTowers: Math.max(...arr.map((p) => p.totalDamageToTowers)),
    totalDamageToTowers: arr.reduce((acc, p) => acc + p.totalDamageToTowers, 0),
    maxHeal: Math.max(...arr.map((p) => p.totalHeal)),
    totalHeal: arr.reduce((acc, p) => acc + p.totalHeal, 0),
    maxKda: Math.max(...arr.map((p) => p.kda)),
    totalKda: arr.reduce((acc, p) => acc + p.kda, 0),
    maxKillParticipation: Math.max(...arr.map((p) => p.killParticipation)),
    totalKillParticipation: arr.reduce((acc, p) => acc + p.killParticipation, 0),
    maxTimeCCingOthers: Math.max(...arr.map((p) => p.timeCCingOthers)),
    maxDamageGoldEfficiency: Math.max(
      ...arr.map((p) => p.totalDamageDealtToChampions / noZero(p.goldEarned))
    ),
    maxDamageShieldedOnTeammates: shielded
      ? Math.max(...arr.map((p) => p.totalDamageShieldedOnTeammates ?? 0))
      : null,
    totalDamageShieldedOnTeammates: shielded
      ? arr.reduce((acc, p) => acc + (p.totalDamageShieldedOnTeammates ?? 0), 0)
      : null
  }
}

/** 全队统计：在单队聚合基础上再取 max（对齐原版 allTeamStats 的取法） */
function aggregateAllTeamStats(teamStatsArr: MatchTeamStats[]): AggregateTeamStats {
  return {
    teamIdentifier: 'TEAM-ALL',
    bans: teamStatsArr.flatMap((t) => t.teamInfo?.bans ?? []),
    maxDamageDealtToChampions: Math.max(...teamStatsArr.map((t) => t.maxDamageDealtToChampions)),
    totalDamageDealtToChampions: teamStatsArr.reduce(
      (acc, t) => acc + t.totalDamageDealtToChampions,
      0
    ),
    maxDamageTaken: Math.max(...teamStatsArr.map((t) => t.maxDamageTaken)),
    totalDamageTaken: teamStatsArr.reduce((acc, t) => acc + t.totalDamageTaken, 0),
    maxGoldEarned: Math.max(...teamStatsArr.map((t) => t.maxGoldEarned)),
    totalGoldEarned: teamStatsArr.reduce((acc, t) => acc + t.totalGoldEarned, 0),
    maxKills: Math.max(...teamStatsArr.map((t) => t.maxKills)),
    totalKills: teamStatsArr.reduce((acc, t) => acc + t.totalKills, 0),
    totalDeaths: teamStatsArr.reduce((acc, t) => acc + t.totalDeaths, 0),
    totalAssists: teamStatsArr.reduce((acc, t) => acc + t.totalAssists, 0),
    maxCs: Math.max(...teamStatsArr.map((t) => t.maxCs)),
    totalCs: teamStatsArr.reduce((acc, t) => acc + t.totalCs, 0),
    maxDamageToTowers: Math.max(...teamStatsArr.map((t) => t.maxDamageToTowers)),
    totalDamageToTowers: teamStatsArr.reduce((acc, t) => acc + t.totalDamageToTowers, 0),
    maxHeal: Math.max(...teamStatsArr.map((t) => t.maxHeal)),
    totalHeal: teamStatsArr.reduce((acc, t) => acc + t.totalHeal, 0),
    maxKda: Math.max(...teamStatsArr.map((t) => t.maxKda)),
    totalKda: teamStatsArr.reduce((acc, t) => acc + t.totalKda, 0),
    maxKillParticipation: Math.max(...teamStatsArr.map((t) => t.maxKillParticipation)),
    totalKillParticipation: teamStatsArr.reduce((acc, t) => acc + t.totalKillParticipation, 0),
    maxTimeCCingOthers: Math.max(...teamStatsArr.map((t) => t.maxTimeCCingOthers)),
    maxDamageGoldEfficiency: Math.max(...teamStatsArr.map((t) => t.maxDamageGoldEfficiency)),
    maxDamageShieldedOnTeammates:
      teamStatsArr[0]?.maxDamageShieldedOnTeammates !== null
        ? Math.max(...teamStatsArr.map((t) => t.maxDamageShieldedOnTeammates ?? 0))
        : null,
    totalDamageShieldedOnTeammates:
      teamStatsArr[0]?.totalDamageShieldedOnTeammates !== null
        ? teamStatsArr.reduce((acc, t) => acc + (t.totalDamageShieldedOnTeammates ?? 0), 0)
        : null
  }
}

/** 把 LCU Team 原始记录映射为原版形状的 teamInfo（bans + objectives） */
function mapToTeamInfo(raw: RawTeam): MatchTeamInfo {
  const kills = (value: number | undefined): number | null => (value === undefined ? null : value)

  return {
    bans: raw.bans ?? [],
    win: raw.win ?? false,
    teamId: num(raw.teamId),
    objectives: {
      // 阿塔坎：老数据无 atakhanKills 时按 null（组件已按存在性隐藏）
      atakhan: raw.atakhanKills === undefined ? null : { first: null, kills: kills(raw.atakhanKills) },
      baron: { first: null, kills: kills(raw.baronKills) },
      champion: null,
      dragon: { first: null, kills: kills(raw.dragonKills) },
      // 虚空巢虫：LCU 的 hordeKills 即巢虫数（web 字段名为 voidGrubKills）
      horde: { first: null, kills: kills(raw.voidGrubKills) },
      inhibitor: { first: null, kills: kills(raw.inhibitorKills) },
      riftHerald: { first: null, kills: kills(raw.riftHeraldKills) },
      tower: { first: null, kills: kills(raw.towerKills) }
    }
  }
}

/**
 * 完整队伍聚合（任务 9；对齐原版 data-adapter 的 toTeams 输出形状）：
 * 按 teamIdentifier 分组 participants 聚合单队统计，并映射 teamsJson 的
 * teamInfo（bans/objectives，key 为 `TEAM-${teamId}`）；CHERRY 子队无 teamInfo
 * @param teamsJson 队伍信息快照（可能为 null；解析失败时各队 teamInfo 为 null）
 * @param participants 适配后的参与者列表（含 winResult/isSurrender/subteamPlacement）
 * @returns teamStatMap（key 为 teamIdentifier）+ teamStatsArr + allTeamStats
 */
export function toMatchCardTeams(
  teamsJson: string | null,
  participants: MatchCardParticipant[]
): TeamsAdapterResult {
  // 原始 teamInfo 按 TEAM-{teamId} 建索引（与原版 primitiveTeamInfoMap 一致）
  const primitiveTeamInfoMap: Record<string, MatchTeamInfo> = {}
  for (const raw of parseTeamsJson(teamsJson)) {
    primitiveTeamInfoMap[`TEAM-${num(raw.teamId)}`] = mapToTeamInfo(raw)
  }

  // 按 teamIdentifier 分组（CHERRY 子队同样聚合，但无 teamInfo）
  const grouped = participants.reduce<Record<string, MatchCardParticipant[]>>((acc, p) => {
    acc[p.teamIdentifier] ??= []
    acc[p.teamIdentifier].push(p)
    return acc
  }, {})

  const teamStatsArr = Object.entries(grouped).map(([teamIdentifier, arr]) => {
    // teamInfo 仅常规队伍有（CHERRY 模式没有对应的 LCU Team 记录）
    return aggregateTeamStats(teamIdentifier, arr, primitiveTeamInfoMap[teamIdentifier] ?? null)
  })

  const teamStatMap = teamStatsArr.reduce<Record<string, MatchTeamStats>>((acc, teamStats) => {
    acc[teamStats.teamIdentifier] = teamStats
    return acc
  }, {})

  return {
    teamStatMap,
    teamStatsArr,
    allTeamStats: aggregateAllTeamStats(teamStatsArr)
  }
}

/**
 * 队伍胜负判定（web 版）：复用参与者适配层已算好的 winResult/isSurrender
 * （participant 为队伍第一人，同队结果一致）
 */
function computeWinResult(participant: MatchCardParticipant | undefined): {
  isSurrender: boolean
  result: WinResult
} {
  return {
    isSurrender: participant?.isSurrender ?? false,
    result: participant?.winResult ?? 'loss'
  }
}
