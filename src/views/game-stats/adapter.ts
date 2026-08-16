/**
 * 战绩分析页数据适配层：后端 API 数据 → 页面展示模型（侧栏聚合统计 + 折叠卡轻量详情）
 * 职责：
 * 1. MatchSummary → MatchDetail（列表折叠卡专用：participants 轻量档案归一到 statsJson 形状，
 *    供任务 5 的 toParticipants/toMatchCardTeams 零改动消费；缺 mapId/teamsJson 等字段按展示需要兜底）
 * 2. 侧栏聚合统计（总览 / 最近队友 / 最近对手，均从当前页数据实时计算）
 */
import type {
  MatchDetail,
  MatchParticipant,
  MatchParticipantLight,
  MatchSummary
} from '@/api/types'

import type { OverviewStats, RecentPlayer } from './types'

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

/**
 * 地图 ID 派生表：轻量摘要无 mapId 字段，折叠卡按游戏模式派生
 * （与 match-card-resource 的地图名静态表口径一致）；未收录模式回退 11（召唤师峡谷）
 */
const MAP_IDS: Record<string, number> = {
  CLASSIC: 11,
  ARAM: 12
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
 * 轻量参与者 → 完整参与者形状（任务 14）：
 * 任务 5 的 toParticipants 以 statsJson 为唯一统计来源（kills/deaths/assists/出装/技能/符文均从
 * statsJson 读取，顶层仅回退身份字段），故将轻量 DTO 的直显字段按 statsJson 键名归一到
 * JSON 字符串中传入；无 statsJson 快照本身时按 '{}' 兜底（组件侧字段缺失按 0 展示）
 * @param light 后端列表接口返回的轻量参与者档案
 * @returns 适配层可消费的完整参与者形状（id/matchId 为占位，适配层不使用）
 */
function lightToMatchParticipant(light: MatchParticipantLight): MatchParticipant {
  // statsJson 归一：击杀/胜负直显 + 出装 7 槽 + 召唤师技能 + 海克斯 + 符文（嵌套 perks 形状）
  const stats: Record<string, unknown> = {
    kills: light.kills,
    deaths: light.deaths,
    assists: light.assists,
    win: light.win
  }
  // 出装按槽位写入 item0-6（列表 DTO 顺序与 statsJson 一致），缺失槽位不写（适配层补 0）
  ;(light.items ?? []).forEach((itemId, index) => {
    if (index < 7) {
      stats[`item${index}`] = itemId
    }
  })
  // 召唤师技能 → spell1Id/spell2Id（toParticipants 优先取 statsJson，缺失才回退顶层）
  const spells = light.summonerSpells ?? []
  if (spells[0] !== undefined) {
    stats.spell1Id = spells[0]
  }
  if (spells[1] !== undefined) {
    stats.spell2Id = spells[1]
  }
  // 海克斯强化 → playerAugment1-6（组件按槽位渲染图标，缺失槽位不写）
  ;(light.augments ?? []).forEach((augment, index) => {
    if (index < 6) {
      stats[`playerAugment${index + 1}`] = augment
    }
  })
  // 符文 → 嵌套 perks.perkIds 形状（toPerks 直接消费，无需平铺转换）
  if (light.perks) {
    stats.perks = {
      perkIds: light.perks.perkIds,
      perkStyle: light.perks.perkStyle,
      perkSubStyle: light.perks.perkSubStyle
    }
  }

  return {
    // 占位主键：toParticipants 不使用 id/matchId（participantId 从 statsJson 读，缺失补 0）
    id: 0,
    matchId: 0,
    puuid: light.puuid,
    summonerName: light.summonerName,
    championId: light.championId,
    teamId: light.teamId,
    position: light.position,
    kills: light.kills,
    deaths: light.deaths,
    assists: light.assists,
    win: light.win,
    // 轻量 DTO 无经济/补刀字段：适配层按 0 兜底（折叠卡不展示，展开后以真实详情为准）
    goldEarned: 0,
    cs: 0,
    items: null,
    summonerSpells: null,
    statsJson: JSON.stringify(stats)
  }
}

/**
 * 将列表摘要转换为折叠卡可消费的 MatchDetail 形状（任务 14）：
 * 轻量摘要缺少详情页字段（mapId/teamsJson/数据源等），折叠态仅展示 MatchCardOverview，
 * 按展示所需兜底填充；展开后由父组件以真实详情（getMatchDetail）替换本对象
 * @param summary 列表接口返回的轻量摘要
 * @returns 折叠卡展示用 MatchDetail 形状（participants 为轻量档案归一结果）
 */
export function summaryToDetail(summary: MatchSummary): MatchDetail {
  return {
    gameId: summary.gameId,
    gameCreation: summary.gameCreation,
    gameDuration: summary.gameDuration,
    gameMode: summary.gameMode,
    // 折叠卡不消费以下字段，按默认值填充（详情页以真实数据为准）
    gameType: '',
    queueId: summary.queueId,
    mapId: MAP_IDS[summary.gameMode] ?? 11,
    gameVersion: '',
    region: summary.region,
    rsoPlatformId: '',
    // 折叠卡不渲染详情面板（isExpanded 恒 false），数据源默认 lcu（隐藏 sgp 专属 Tab）
    dataSource: 'lcu',
    winnerTeamId: summary.winnerTeamId,
    selfPuuid: summary.selfPuuid,
    // 队伍快照缺失：队伍统计由 participants 聚合（teamInfo 为 null，卡片仅用胜负/聚合列）
    teamsJson: null,
    // 后端未升级时 participants 可能缺失，兜底空数组（调用方按空卡过滤）
    participants: (summary.participants ?? []).map(lightToMatchParticipant)
  }
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
