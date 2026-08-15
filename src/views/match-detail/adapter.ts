/**
 * 对局详情页数据适配层：把后端 MatchDetail（含 statsJson/teamsJson）转换为三段式布局所需的展示结构
 * 段位（rank/score）数据源不存在，展示为占位符 '-'；击杀参与率、MVP、资源统计由现有数据派生
 */
import type { MatchDetail, MatchParticipant, ParsedStats } from '@/api/types'
import { createLogger } from '@/utils/logger'
import { parseIdArray } from '@/utils/parse-json'

const logger = createLogger('MatchDetailAdapter')

/** 玩家行（队伍数据表的一行） */
export interface PlayerRow {
  puuid: string
  /** 队伍 ID：100 蓝 / 200 红 */
  teamId: number
  /** 召唤师名 */
  name: string
  /** 是否当前玩家（selfPuuid 匹配） */
  isSelf: boolean
  /** 英雄 ID */
  championId: number
  /** 击杀 */
  kills: number
  /** 死亡 */
  deaths: number
  /** 助攻 */
  assists: number
  /** KDA 比率（用于排序与 MVP 判定） */
  kdaRatio: number
  /** 对英雄伤害 */
  damage: number
  /** 插眼数（守卫） */
  ward: number
  /** 视野得分 */
  visionScore: number
  /** 补刀数 */
  cs: number
  /** 每分钟补刀 */
  csPerMin: number
  /** 获得金币 */
  gold: number
  /** 出装（物品 ID，6 槽） */
  items: number[]
  /** 召唤师技能 */
  summonerSpells: [number, number]
  /** 是否获胜 */
  win: boolean
  /** 队内 MVP（KDA 比率最高） */
  isMVP: boolean
  /** 完整 stats（行展开详情用） */
  stats: ParsedStats
}

/** 队伍视图 */
export interface TeamView {
  /** 队伍 ID：100 蓝 / 200 红 */
  teamId: number
  /** 是否获胜 */
  win: boolean
  /** 5 名玩家 */
  players: PlayerRow[]
  /** 总击杀 */
  totalKills: number
  /** 总金币 */
  totalGold: number
}

/** 地图资源统计 */
export interface ResourcesView {
  dragons: number
  heralds: number
  barons: number
}

/** 顶部摘要视图 */
export interface MatchSummaryView {
  /** 模式展示名，如 单排/双排、极地大乱斗 */
  mode: string
  /** 相对时间，如 21分钟前 */
  timeAgo: string
  /** 时长，如 26:51 */
  duration: string
  /** 结果：victory / defeat */
  result: 'victory' | 'defeat'
  /** 本玩家英雄 ID（头部头像） */
  championId: number
  /** KDA 文本，如 14 / 0 / 9 */
  kda: string
  /** 是否 Perfect（死亡 0） */
  isPerfect: boolean
  /** 击杀参与率百分比，如 85 */
  participation: number
  /** CS 文本，如 239 (8.9) */
  cs: string
  /** 段位评分（数据源暂无，占位） */
  score: string
  /** 本玩家装备 */
  items: number[]
  /** 队友（同队其余 4 人） */
  teammates: PlayerRow[]
}

/** 详情页三段式布局的完整视图 */
export interface MatchDetailView {
  summary: MatchSummaryView
  teams: TeamView[]
  resources: ResourcesView[]
}

/** 计算 KDA 比率（死亡为 0 时取击杀+助攻） */
function calcKdaRatio(kills: number, deaths: number, assists: number): number {
  return deaths === 0 ? kills + assists : Number(((kills + assists) / deaths).toFixed(2))
}

/** 解析 statsJson；失败返回空对象并记 warn（不阻塞展示） */
function parseStats(statsJson: string | null): ParsedStats {
  if (!statsJson) {
    return {}
  }
  try {
    return JSON.parse(statsJson) as ParsedStats
  } catch (error) {
    logger.warn('Failed to parse statsJson', { statsJson, error })
    return {}
  }
}

/** 相对时间格式化：分钟/小时/天前 */
function formatTimeAgo(creation: number): string {
  const minutes = Math.floor((Date.now() - creation) / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  return `${Math.floor(hours / 24)}天前`
}

/** 时长格式化 mm:ss */
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

/** 模式展示名映射（未知队列显示 ID） */
function modeLabel(gameMode: string, queueId: number): string {
  if (gameMode === 'ARAM') return '极地大乱斗'
  if (queueId === 420) return '单排/双排'
  if (queueId === 440) return '灵活排位'
  if (queueId === 430) return '匹配'
  return gameMode || `队列 ${queueId}`
}

/** 把参赛者实体转换为 PlayerRow（isMVP/csPerMin 在分组后按队伍与对局时长回填） */
function toPlayerRow(participant: MatchParticipant, selfPuuid: string): PlayerRow {
  const stats = parseStats(participant.statsJson)
  const kills = participant.kills ?? 0
  const deaths = participant.deaths ?? 0
  const assists = participant.assists ?? 0
  const damage = Number(stats.totalDamageDealtToChampions ?? 0)
  const ward = Number(stats.wardsPlaced ?? 0)
  const visionScore = Number(stats.visionScore ?? 0)
  const cs = participant.cs ?? Number(stats.totalMinionsKilled ?? 0)
  return {
    puuid: participant.puuid,
    teamId: participant.teamId,
    name: participant.summonerName,
    isSelf: participant.puuid === selfPuuid,
    championId: participant.championId,
    kills,
    deaths,
    assists,
    kdaRatio: calcKdaRatio(kills, deaths, assists),
    damage,
    ward,
    visionScore,
    cs,
    csPerMin: 0,
    gold: Number(stats.goldEarned ?? 0),
    items: parseIdArray(participant.items),
    summonerSpells: [4, 12],
    win: participant.win,
    isMVP: false,
    stats
  }
}

/**
 * 适配入口：MatchDetail → MatchDetailView
 * teams_json 解析失败时资源统计为空数组（不阻塞展示）
 */
export function toMatchDetailView(detail: MatchDetail): MatchDetailView {
  const self = detail.participants.find((p) => p.puuid === detail.selfPuuid)
  const selfRow = self ? toPlayerRow(self, detail.selfPuuid) : null

  // 按队伍分组，回填 MVP（队内 KDA 比率最高）
  const groups = new Map<number, PlayerRow[]>()
  for (const participant of detail.participants) {
    const row = toPlayerRow(participant, detail.selfPuuid)
    const list = groups.get(row.teamId) ?? []
    list.push(row)
    groups.set(row.teamId, list)
  }

  const teams: TeamView[] = [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([teamId, players]) => {
      const mvp = players.reduce((best, row) => (row.kdaRatio > best.kdaRatio ? row : best), players[0])
      if (mvp) {
        mvp.isMVP = true
      }
      // 每分钟补刀按对局时长计算（分钟数向下取整，避免除零）
      const durationMin = Math.max(1, Math.floor(detail.gameDuration / 60))
      for (const row of players) {
        row.csPerMin = Number((row.cs / durationMin).toFixed(1))
      }
      return {
        teamId,
        win: players[0]?.win ?? false,
        players,
        totalKills: players.reduce((sum, row) => sum + row.kills, 0),
        totalGold: players.reduce((sum, row) => sum + row.gold, 0)
      }
    })

  // 队伍资源：解析 teams_json（LCU Team 结构，击杀数在顶层）
  const resources: ResourcesView[] = []
  const rawTeams = parseTeamsJson(detail.teamsJson)
  for (const raw of rawTeams) {
    resources.push({
      dragons: raw.dragonKills ?? 0,
      heralds: raw.riftHeraldKills ?? 0,
      barons: raw.baronKills ?? 0
    })
  }

  // 顶部摘要（本玩家视角）
  const selfTeam = selfRow ? teams.find((t) => t.players.includes(selfRow)) : undefined
  const participation = selfRow && selfTeam && selfTeam.totalKills > 0
    ? Math.round((selfRow.kills / selfTeam.totalKills) * 100)
    : 0

  const summary: MatchSummaryView = {
    mode: modeLabel(detail.gameMode, detail.queueId),
    timeAgo: formatTimeAgo(detail.gameCreation),
    duration: formatDuration(detail.gameDuration),
    result: selfRow?.win ? 'victory' : 'defeat',
    championId: selfRow?.championId ?? 0,
    kda: selfRow ? `${selfRow.kills} / ${selfRow.deaths} / ${selfRow.assists}` : '- / - / -',
    isPerfect: selfRow ? selfRow.deaths === 0 : false,
    participation,
    cs: selfRow ? `${selfRow.cs} (${selfRow.csPerMin})` : '-',
    score: '-',
    items: selfRow?.items ?? [],
    teammates: selfTeam?.players.filter((p) => !p.isSelf) ?? []
  }

  return { summary, teams, resources }
}

/** 解析 teams_json（后端存储的队伍统计数组，击杀数字段可能缺失）；失败返回空数组并记 warn */
function parseTeamsJson(teamsJson: string | null): { teamId: number; dragonKills?: number; riftHeraldKills?: number; baronKills?: number }[] {
  if (!teamsJson) {
    return []
  }
  try {
    const parsed = JSON.parse(teamsJson) as { teamId: number; dragonKills?: number; riftHeraldKills?: number; baronKills?: number }[]
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    logger.warn('Failed to parse teamsJson', { teamsJson, error })
    return []
  }
}
