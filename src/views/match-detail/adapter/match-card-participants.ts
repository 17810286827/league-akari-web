/**
 * 参与者适配层（任务 5）：statsJson 双源解析
 * 把后端 MatchParticipant（statsJson 全量快照）转换为原版 data-adapter/match-history/participants.ts
 * 输出模型（字段名逐一对应，组件零改动）。
 *
 * 双源兼容（与 Electron convert.ts 的存储口径一致）：
 * - LCU：statsJson = { ...p.stats }（平铺字段，无 spell1Id/teamId，需回退顶层直显字段）
 * - SGP：statsJson = { ...p }（整体透传，统计与身份同层，含嵌套 perks 对象与 ping 计数）
 * 两源字段名一致，统一从 statsJson 取值；身份字段缺省回退顶层 MatchParticipant。
 */
import type { MatchDetail, MatchParticipant } from '@/api/types'
import { createLogger } from '@/utils/logger'
import { parseIdArray } from '@/utils/parse-json'
import type {
  MatchCardBasicInfo,
  MatchCardParticipant,
  MatchCardParticipantPerks,
  MatchCardParticipantPings,
  WinResult
} from './types'

const logger = createLogger('MatchCardParticipants')

/**
 * statsJson 结构：LCU 平铺与 SGP 透传字段名一致；
 * 已知字段显式声明，其余字段经索引签名原样透传（组件侧 ?? 兜底）
 * 导出供任务 11 的 details-table（raw-details）复用同一解析口径
 */
export interface ParticipantStatsJson {
  // 身份与队伍（LCU stats 缺失，SGP 透传自带）
  puuid?: string
  participantId?: number
  riotIdGameName?: string
  riotIdTagline?: string
  summonerName?: string
  profileIcon?: number
  championId?: number
  teamId?: number
  playerSubteamId?: number
  teamPosition?: string
  individualPosition?: string
  lane?: string
  subteamPlacement?: number
  // 基础统计
  kills?: number
  deaths?: number
  assists?: number
  win?: boolean
  champLevel?: number
  roleBoundItem?: number
  // 海克斯强化（双源字段名一致）
  playerAugment1?: number
  playerAugment2?: number
  playerAugment3?: number
  playerAugment4?: number
  playerAugment5?: number
  playerAugment6?: number
  // 符文（LCU 平铺；SGP 无平铺字段，走嵌套 perks）
  perk0?: number
  perk1?: number
  perk2?: number
  perk3?: number
  perk4?: number
  perk5?: number
  perkPrimaryStyle?: number
  perkSubStyle?: number
  // 符文（SGP 嵌套对象：perkIds 直用形状 或 原版 styles 形状）
  perks?: {
    perkIds?: number[]
    perkStyle?: number
    perkSubStyle?: number
    styles?: { style?: number; selections?: { perk?: number }[] }[]
  }
  // 出装 7 槽
  item0?: number
  item1?: number
  item2?: number
  item3?: number
  item4?: number
  item5?: number
  item6?: number
  // 召唤师技能（SGP 在 statsJson 内；LCU 回退顶层 summonerSpells）
  spell1Id?: number
  spell2Id?: number
  // 多杀
  doubleKills?: number
  tripleKills?: number
  quadraKills?: number
  pentaKills?: number
  // 伤害
  totalDamageDealtToChampions?: number
  physicalDamageDealtToChampions?: number
  magicDamageDealtToChampions?: number
  trueDamageDealtToChampions?: number
  totalDamageTaken?: number
  physicalDamageTaken?: number
  magicDamageTaken?: number
  /** LCU 的承伤字段名（与 SGP 的 magicDamageTaken 不同名，双名兼容） */
  magicalDamageTaken?: number
  trueDamageTaken?: number
  damageDealtToTurrets?: number
  // 经济与补刀
  goldEarned?: number
  goldSpent?: number
  neutralMinionsKilled?: number
  totalMinionsKilled?: number
  // 治疗/视野/控制
  totalHeal?: number
  visionScore?: number
  timeCCingOthers?: number
  // 投降
  gameEndedInEarlySurrender?: boolean
  gameEndedInSurrender?: boolean
  teamEarlySurrendered?: boolean
  // 挑战数据（SGP 独有，LCU 无）
  challenges?: {
    soloKills?: number
    effectiveHealAndShielding?: number
    knockEnemyIntoTeamAndKill?: number
    killsNearEnemyTurret?: number
    killsUnderOwnTurret?: number
    earliestDragonTakedown?: number
    maxCsAdvantageOnLaneOpponent?: number
  }
  totalDamageShieldedOnTeammates?: number
  // 信号 ping 计数（SGP 独有，LCU 无）
  allInPings?: number
  assistMePings?: number
  basicPings?: number
  commandPings?: number
  dangerPings?: number
  enemyMissingPings?: number
  enemyVisionPings?: number
  getBackPings?: number
  holdPings?: number
  needVisionPings?: number
  onMyWayPings?: number
  pushPings?: number
  retreatPings?: number
  visionClearedPings?: number
  // 其余字段原样透传
  [key: string]: unknown
}

/** 死亡/队总击杀为 0 时返回 1，避免除零（口径与原版 noZero 一致） */
function noZero(value: number): number {
  return value || 1
}

/** 数值兜底：undefined/null 统一转 0（statsJson 字段缺失不阻塞渲染） */
function num(value: number | undefined | null): number {
  return typeof value === 'number' ? value : 0
}

/** 布尔兜底：undefined/null 统一转 false */
function bool(value: boolean | undefined | null): boolean {
  return value ?? false
}

/** 解析 statsJson；失败返回空对象并记 warn（不阻塞展示，与旧 adapter 的 parseStats 同款容错） */
export function parseStatsJson(statsJson: string | null): ParticipantStatsJson {
  if (!statsJson) {
    return {}
  }
  try {
    return JSON.parse(statsJson) as ParticipantStatsJson
  } catch (error) {
    logger.warn('Failed to parse statsJson', { statsJson, error })
    return {}
  }
}

/**
 * 召唤师名拆分：web 后端直显字段 summonerName 为 "名#标签" 拼接（契约），
 * 拆成 gameName/tagLine 供组件分别渲染；SGP 的 riotIdGameName/riotIdTagline 不受影响
 */
function splitSummonerName(name: string): { gameName: string; tagLine: string } {
  const index = name.lastIndexOf('#')
  if (index > 0) {
    return { gameName: name.slice(0, index), tagLine: name.slice(index + 1) }
  }
  return { gameName: name, tagLine: '' }
}

/**
 * 队伍标识：CHERRY 竞技场按 playerSubteamId 分组（子队 2-3 人，组内击杀参与率才有意义），
 * 其余模式按 teamId；双源字段名一致，teamId 缺省回退顶层直显（LCU stats 无 teamId）
 * @param gameMode 游戏模式（任务 10 校正）：CHERRY 时无条件按子队分组；
 *                 不传时保留 playerSubteamId>0 启发式（向后兼容任务 5 调用方）
 */
function teamKeyOf(
  participant: MatchParticipant,
  stats: ParticipantStatsJson,
  gameMode?: string
): string {
  const teamId = stats.teamId ?? participant.teamId
  const playerSubteamId = num(stats.playerSubteamId)
  // CHERRY 判定：显式 gameMode 优先；缺省回退旧启发式（子队 ID>0 视为竞技场）
  const isCherry = gameMode === 'CHERRY' || (gameMode === undefined && playerSubteamId > 0)
  return isCherry ? `CHERRY-${playerSubteamId}` : `TEAM-${teamId}`
}

/**
 * 符文双路径解析：
 * 1. SGP 嵌套 perks 优先——perkIds 形状直用；原版 SGP 的 { statPerks, styles } 形状则从
 *    主/副系 styles 派生（perkIds = 两系全部 selections，perkStyle/perkSubStyle = 两系 style）；
 * 2. 缺失回退 LCU 平铺 perk0-5 + perkPrimaryStyle + perkSubStyle；
 * 3. 全部缺失返回全 null（组件侧 ?? 兜底）
 */
function toPerks(stats: ParticipantStatsJson): MatchCardParticipantPerks {
  const nested = stats.perks
  if (nested && typeof nested === 'object') {
    // 嵌套对象：优先直接取 perkIds 形状，否则从原版 styles 形状派生
    const perkIds = Array.isArray(nested.perkIds)
      ? nested.perkIds
      : Array.isArray(nested.styles)
        ? nested.styles.flatMap((s) => (s.selections ?? []).map((sel) => sel.perk ?? null))
        : null
    if (perkIds) {
      return {
        perkIds,
        perkStyle: nested.perkStyle ?? nested.styles?.[0]?.style ?? null,
        perkSubStyle: nested.perkSubStyle ?? nested.styles?.[1]?.style ?? null
      }
    }
  }
  // LCU 平铺：perk0-5 + perkPrimaryStyle/perkSubStyle
  return {
    perkIds: [stats.perk0, stats.perk1, stats.perk2, stats.perk3, stats.perk4, stats.perk5].map(
      (perk) => perk ?? null
    ),
    perkStyle: stats.perkPrimaryStyle ?? null,
    perkSubStyle: stats.perkSubStyle ?? null
  }
}

/** ping 计数字段清单：SGP 提供逐项计数，LCU stats 无 ping 数据 */
const PING_FIELDS = [
  'allInPings',
  'assistMePings',
  'basicPings',
  'commandPings',
  'dangerPings',
  'enemyMissingPings',
  'enemyVisionPings',
  'getBackPings',
  'holdPings',
  'needVisionPings',
  'onMyWayPings',
  'pushPings',
  'retreatPings',
  'visionClearedPings'
] as const

/** 信号 ping 解析：14 项全部缺失时返回 null（LCU），否则逐项取数（缺项补 0） */
function toPings(stats: ParticipantStatsJson): MatchCardParticipantPings | null {
  const pings = {} as MatchCardParticipantPings
  let hasAny = false
  for (const key of PING_FIELDS) {
    const value = stats[key]
    if (value !== undefined) {
      hasAny = true
    }
    pings[key] = typeof value === 'number' ? value : 0
  }
  return hasAny ? pings : null
}

/**
 * 胜负判定（web 版）：后端不存 endOfGameResult，省略原版 abort 分支；
 * 早退(remake) → 队伍投降(loss) → 胜负，isSurrender 语义与原版 computeWinResult 一致
 */
function computeWinResult(p: {
  win: boolean
  gameEndedInEarlySurrender: boolean
  gameEndedInSurrender: boolean
  teamEarlySurrendered: boolean
}): { isSurrender: boolean; result: WinResult } {
  // 早退（3 分钟前结束）：判定为 remake，且视为投降
  if (p.gameEndedInEarlySurrender) {
    return { isSurrender: true, result: 'remake' }
  }
  // 己方队伍投降：结果为失败且视为投降
  if (p.teamEarlySurrendered) {
    return { isSurrender: true, result: 'loss' }
  }
  if (p.win) {
    return { isSurrender: false, result: 'win' }
  }
  // 正常失败：是否投降以 gameEndedInSurrender 标记为准
  return { isSurrender: p.gameEndedInSurrender, result: 'loss' }
}

/** 单参与者映射：字段名逐一对应原版 MatchParticipant，值统一从 statsJson 解析 */
function mapParticipant(
  participant: MatchParticipant,
  stats: ParticipantStatsJson,
  totalKills: Map<string, number>,
  gameMode?: string
): MatchCardParticipant {
  const teamIdentifier = teamKeyOf(participant, stats, gameMode)
  // 击杀基础：统一从 statsJson 取（顶层直显字段为冗余快照，不参与计算）
  const kills = num(stats.kills)
  const deaths = num(stats.deaths)
  const assists = num(stats.assists)
  const win = stats.win ?? participant.win
  const { isSurrender, result } = computeWinResult({
    win,
    gameEndedInEarlySurrender: bool(stats.gameEndedInEarlySurrender),
    gameEndedInSurrender: bool(stats.gameEndedInSurrender),
    teamEarlySurrendered: bool(stats.teamEarlySurrendered)
  })

  // 召唤师名：SGP 提供 riotIdGameName/riotIdTagline；LCU 顶层 summonerName 为拼接格式，需拆分
  const { gameName, tagLine } =
    stats.riotIdGameName !== undefined
      ? { gameName: stats.riotIdGameName, tagLine: stats.riotIdTagline ?? '' }
      : splitSummonerName(participant.summonerName)

  // 召唤师技能：SGP statsJson 内含 spell1Id/spell2Id；LCU 回退顶层 summonerSpells JSON 数组
  const spellsJson = parseIdArray(participant.summonerSpells)
  const spells = [stats.spell1Id ?? spellsJson[0] ?? 0, stats.spell2Id ?? spellsJson[1] ?? 0]

  return {
    puuid: stats.puuid ?? participant.puuid,
    participantId: num(stats.participantId),
    gameName,
    tagLine,
    profileIconId: num(stats.profileIcon),
    championId: stats.championId ?? participant.championId,
    // 对线位置：SGP 顶层 teamPosition 优先，LCU 回退顶层直显
    position:
      stats.teamPosition ?? stats.individualPosition ?? stats.lane ?? participant.position,
    teamId: stats.teamId ?? participant.teamId,
    playerSubteamId: num(stats.playerSubteamId),
    teamIdentifier,
    // 出装 7 槽：item0-6，空槽为 0（与原版 LCU 空槽语义一致）
    items: Array.from({ length: 7 }, (_, i) =>
      num(stats[`item${i}`] as number | undefined)
    ),
    roleBoundItem: num(stats.roleBoundItem),
    // 海克斯强化：双源字段名一致，缺失为 null
    augments: [1, 2, 3, 4, 5, 6].map(
      (i) => (stats[`playerAugment${i}`] as number | undefined) ?? null
    ),
    spells,
    perks: toPerks(stats),
    level: num(stats.champLevel),
    kills,
    deaths,
    assists,
    // KDA：(击杀+助攻) / noZero(死亡)，死亡 0 时展示 Perfect
    kda: (kills + assists) / noZero(deaths),
    // 击杀参与率：(击杀+助攻) / noZero(该队总击杀)
    killParticipation: (kills + assists) / noZero(totalKills.get(teamIdentifier) ?? 0),
    totalDamageDealtToChampions: num(stats.totalDamageDealtToChampions),
    // 伤害经济比：总伤害 / noZero(金币)，口径与原版一致
    damageGoldEfficiency:
      num(stats.totalDamageDealtToChampions) / noZero(num(stats.goldEarned)),
    physicalDamageDealtToChampions: num(stats.physicalDamageDealtToChampions),
    magicDamageDealtToChampions: num(stats.magicDamageDealtToChampions),
    trueDamageDealtToChampions: num(stats.trueDamageDealtToChampions),
    totalDamageTaken: num(stats.totalDamageTaken),
    physicalDamageTaken: num(stats.physicalDamageTaken),
    // 承伤：SGP 用 magicDamageTaken，LCU 用 magicalDamageTaken，双名兼容
    magicDamageTaken: num(stats.magicDamageTaken ?? stats.magicalDamageTaken),
    trueDamageTaken: num(stats.trueDamageTaken),
    goldEarned: num(stats.goldEarned),
    goldSpent: num(stats.goldSpent),
    neutralMinionsKilled: num(stats.neutralMinionsKilled),
    totalMinionsKilled: num(stats.totalMinionsKilled),
    // 总补刀：小兵 + 野怪（与原版口径一致）
    cs: num(stats.neutralMinionsKilled) + num(stats.totalMinionsKilled),
    win,
    isSurrender,
    winResult: result,
    subteamPlacement: num(stats.subteamPlacement),
    gameEndedInEarlySurrender: bool(stats.gameEndedInEarlySurrender),
    gameEndedInSurrender: bool(stats.gameEndedInSurrender),
    teamEarlySurrendered: bool(stats.teamEarlySurrendered),
    // 对塔伤害：statsJson 字段名为 damageDealtToTurrets
    totalDamageToTowers: num(stats.damageDealtToTurrets),
    totalHeal: num(stats.totalHeal),
    visionScore: num(stats.visionScore),
    timeCCingOthers: num(stats.timeCCingOthers),
    // challenges 数据仅 SGP 提供，LCU 缺省 null
    soloKills: stats.challenges?.soloKills ?? null,
    effectiveHealAndShielding: stats.challenges?.effectiveHealAndShielding ?? null,
    totalDamageShieldedOnTeammates: stats.totalDamageShieldedOnTeammates ?? null,
    pings: toPings(stats),
    knockEnemyIntoTeamAndKill: stats.challenges?.knockEnemyIntoTeamAndKill ?? null,
    killsNearEnemyTurret: stats.challenges?.killsNearEnemyTurret ?? null,
    killsUnderOwnTurret: stats.challenges?.killsUnderOwnTurret ?? null,
    earliestDragonTakedown: stats.challenges?.earliestDragonTakedown ?? null,
    maxCsAdvantageOnLaneOpponent: stats.challenges?.maxCsAdvantageOnLaneOpponent ?? null,
    doubleKills: num(stats.doubleKills),
    tripleKills: num(stats.tripleKills),
    quadraKills: num(stats.quadraKills),
    pentaKills: num(stats.pentaKills)
  }
}

/**
 * 把后端 MatchParticipant（statsJson 全量快照）转换为原版 participants 模型
 * 双源兼容：LCU 平铺字段与 SGP 整体透传字段名一致，统一从 statsJson 取值；
 * statsJson 缺失/解析失败不阻塞（空对象兜底），返回数组长度与入参一致
 * @param participants 后端参与者列表
 * @param gameMode 游戏模式（任务 10 校正）：CHERRY 时按 playerSubteamId 分组；
 *                 不传时按旧启发式（子队 ID>0 视为 CHERRY），普通对局不受影响
 */
export function toParticipants(
  participants: MatchParticipant[],
  gameMode?: string
): MatchCardParticipant[] {
  // 先统一解析 statsJson（双源同源），供队伍总击杀与逐人映射共用
  const parsed = participants.map((participant) => ({
    participant,
    stats: parseStatsJson(participant.statsJson)
  }))

  // 队总击杀：按队伍标识累加（CHERRY 按 playerSubteamId，其余按 teamId），用于击杀参与率
  const totalKills = new Map<string, number>()
  for (const { participant, stats } of parsed) {
    const teamIdentifier = teamKeyOf(participant, stats, gameMode)
    totalKills.set(teamIdentifier, (totalKills.get(teamIdentifier) ?? 0) + num(stats.kills))
  }

  return parsed.map(({ participant, stats }) =>
    mapParticipant(participant, stats, totalKills, gameMode)
  )
}

/**
 * 对局元信息：mode/duration/gameCreation/queueId/mapId/winnerTeamId 等（供 context.basicInfo）
 * isTwoTeam/isCherrySubteam 由 gameMode 判定（与原版 match-basic.ts 一致）
 */
export function toBasicInfo(detail: MatchDetail): MatchCardBasicInfo {
  return {
    dataSource: detail.dataSource,
    gameVersion: detail.gameVersion,
    gameId: detail.gameId,
    // CHERRY 竞技场：非双队且按子队分组
    isTwoTeam: detail.gameMode !== 'CHERRY',
    isCherrySubteam: detail.gameMode === 'CHERRY',
    gameCreation: detail.gameCreation,
    gameDuration: detail.gameDuration,
    gameType: detail.gameType,
    queueId: detail.queueId,
    gameMode: detail.gameMode,
    mapId: detail.mapId,
    winnerTeamId: detail.winnerTeamId
  }
}
