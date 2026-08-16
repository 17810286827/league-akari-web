/**
 * 对局详情 1:1 还原 — 数据适配层类型定义（任务 5）
 * 字段名逐一对应原版 LeagueAkari `data-adapter/match-history/participants.ts` 的
 * MatchParticipant / MatchBasicInfo，删除依赖原版 shard 数据源类型的部分：
 * - perks 简化为双源统一的 { perkIds, perkStyle, perkSubStyle }（原版为 statPerks + styles 树）
 * - 全部为纯数据对象，供照搬组件零改动消费（组件侧以 ?? 兜底缺失值）
 */

/** 对局结果（原版 WinResult：win/loss/remake/abort；web 后端不存 endOfGameResult，abort 不会出现） */
export type WinResult = 'win' | 'loss' | 'remake' | 'abort'

/** 单枚符文对局内的 3 个变量（原版 selection 的 var1-3，供 @eogvarN@ 占位符替换） */
export interface MatchCardPerkVars {
  var1: number
  var2: number
  var3: number
}

/** 对局内统计符文（原版 statPerks；仅 SGP 提供，LCU 无该记录） */
export interface MatchCardStatPerks {
  offense: number
  flex: number
  defense: number
}

/** 符文数据（web 双源统一形状：6 枚符文 + 主/副系样式 + 对局内变量/统计符文） */
export interface MatchCardParticipantPerks {
  /** 6 枚符文 ID（主系 4 + 副系 2），字段缺失为 null */
  perkIds: (number | null)[]
  /** 主系样式 ID（如 8100 精密），缺失为 null */
  perkStyle: number | null
  /** 副系样式 ID（如 8300 巫术），缺失为 null */
  perkSubStyle: number | null
  /** 每枚符文的对局内变量（与 perkIds 一一对应；数据源无 var 记录时为 null） */
  perkVars: MatchCardPerkVars[] | null
  /** 对局内统计符文（仅 SGP；LCU 平铺无该记录时为 null） */
  statPerks: MatchCardStatPerks | null
}

/** 信号 ping 计数（原版 MatchParticipantPings；仅 SGP 提供，LCU 无该数据时为 null） */
export interface MatchCardParticipantPings {
  allInPings: number
  assistMePings: number
  basicPings: number
  commandPings: number
  dangerPings: number
  enemyMissingPings: number
  enemyVisionPings: number
  getBackPings: number
  holdPings: number
  needVisionPings: number
  onMyWayPings: number
  pushPings: number
  retreatPings: number
  visionClearedPings: number
}

/** 参与者模型：字段名逐一对应原版 MatchParticipant，值从 statsJson 双源解析 */
export interface MatchCardParticipant {
  /** 玩家 PUUID */
  puuid: string
  /** 参赛者编号（1-10，LCU/SGP 均在 statsJson 内） */
  participantId: number
  /** 召唤师名（不含 #tag） */
  gameName: string
  /** 召唤师 tag（# 后的后缀，无则空串） */
  tagLine: string
  /** 头像图标 ID */
  profileIconId: number
  /** 英雄 ID */
  championId: number
  /** 对线位置（SGP 的 teamPosition/individualPosition/lane，LCU 顶层直显），未知为 null */
  position: string | null
  /** 所属队伍 ID：100（蓝方）/ 200（红方） */
  teamId: number
  /** 子队 ID（CHERRY 竞技场按子队分组），普通对局为 0 */
  playerSubteamId: number
  /** 队伍标识：`TEAM-${teamId}` 或 CHERRY 模式 `CHERRY-${playerSubteamId}`，组件按此分组 */
  teamIdentifier: string
  /** 出装 7 槽（item0-6），空槽为 0 */
  items: number[]
  /** 特殊模式道具位（roleBoundItem），无则 0 */
  roleBoundItem: number
  /** 海克斯强化 6 枚（playerAugment1-6），缺失为 null */
  augments: (number | null)[]
  /** 召唤师技能 [spell1Id, spell2Id] */
  spells: number[]
  /** 符文（主系 4 + 副系 2） */
  perks: MatchCardParticipantPerks
  /** 对局结束等级（champLevel） */
  level: number
  kills: number
  deaths: number
  assists: number
  /** KDA 比率：(kills + assists) / noZero(deaths) */
  kda: number
  /** 击杀参与率：(kills + assists) / noZero(该队总击杀) */
  killParticipation: number
  /** 对英雄总伤害 */
  totalDamageDealtToChampions: number
  /** 伤害经济比：总伤害 / noZero(goldEarned) */
  damageGoldEfficiency: number
  physicalDamageDealtToChampions: number
  magicDamageDealtToChampions: number
  trueDamageDealtToChampions: number
  totalDamageTaken: number
  physicalDamageTaken: number
  magicDamageTaken: number
  trueDamageTaken: number
  goldEarned: number
  goldSpent: number
  neutralMinionsKilled: number
  totalMinionsKilled: number
  /** 总补刀：小兵 + 野怪 */
  cs: number
  /** 是否获胜 */
  win: boolean
  /** 是否以投降结束（早退 remake 也视为投降） */
  isSurrender: boolean
  /** 胜负结果：win/loss/remake/abort */
  winResult: WinResult
  /** 子队名次（CHERRY 竞技场用，普通对局为 0） */
  subteamPlacement: number
  gameEndedInEarlySurrender: boolean
  gameEndedInSurrender: boolean
  teamEarlySurrendered: boolean
  /** 对防御塔总伤害（damageDealtToTurrets） */
  totalDamageToTowers: number
  totalHeal: number
  visionScore: number
  timeCCingOthers: number
  /** 单杀数（challenges 字段，LCU 无该数据为 null） */
  soloKills: number | null
  effectiveHealAndShielding: number | null
  totalDamageShieldedOnTeammates: number | null
  /** 信号 ping 计数（仅 SGP） */
  pings: MatchCardParticipantPings | null
  knockEnemyIntoTeamAndKill: number | null
  killsNearEnemyTurret: number | null
  killsUnderOwnTurret: number | null
  earliestDragonTakedown: number | null
  maxCsAdvantageOnLaneOpponent: number | null
  doubleKills: number
  tripleKills: number
  quadraKills: number
  pentaKills: number
}

/** 对局元信息：供 context.basicInfo（web 的 MatchDetail 无 endOfGameResult/gameModeMutators，故省略） */
export interface MatchCardBasicInfo {
  /** 数据来源：lcu / sgp */
  dataSource: string
  /** 对局版本号，如 14.10.1 */
  gameVersion: string
  /** 对局 ID */
  gameId: number
  /** 是否为常规双队模式（CHERRY 为 false） */
  isTwoTeam: boolean
  /** 是否为 CHERRY 竞技场（按子队分组） */
  isCherrySubteam: boolean
  /** 对局创建时间戳（毫秒） */
  gameCreation: number
  /** 对局时长（秒） */
  gameDuration: number
  /** 游戏类型，如 MATCHED_GAME */
  gameType: string
  /** 队列 ID，如 420（单排） */
  queueId: number
  /** 游戏模式，如 CLASSIC / ARAM / CHERRY */
  gameMode: string
  /** 地图 ID，如 11（召唤师峡谷） */
  mapId: number
  /** 获胜方队伍 ID，未知为 null */
  winnerTeamId: number | null
}

/**
 * 击杀事件伤害明细（web 本地类型，任务 9；字段对应原版
 * @shared/types/sgp/match-history 的 DamageDetail，供 VictimDamageDetails 消费）
 */
export interface MatchCardDamageDetail {
  /** 是否普攻伤害（原版 LCU 的 basic 字段） */
  basic: boolean
  /** 魔法伤害 */
  magicDamage: number
  /** 来源名称（如野怪名 Cherries_Shopkeeper） */
  name: string
  /** 伤害来源参与者编号（非英雄来源为 0） */
  participantId: number
  /** 物理伤害 */
  physicalDamage: number
  /** 技能名称（展示备用） */
  spellName: string
  /** 技能槽位（0-3 对应 Q/W/E/R，63 为被动 P；组件按槽位映射键位） */
  spellSlot: number
  /** 真实伤害 */
  trueDamage: number
  /** 来源类型：MINION/MONSTER/TOWER 等（组件映射为 minion/monster/tower/other） */
  type: string
}

/**
 * 击杀事件（web 本地类型，任务 9；字段对应原版 DetailedChampionKillEvent 的消费子集，
 * 供 VictimDamageDetails 展示伤害明细）
 */
export interface MatchCardChampionKillEvent {
  /** 被击杀者参与者编号 */
  victimId: number
  /** 击杀者对受害者的伤害（原版可选字段，缺失按无伤害处理） */
  victimDamageDealt?: MatchCardDamageDetail[]
  /** 受害者受到的伤害（必填） */
  victimDamageReceived: MatchCardDamageDetail[]
}

/**
 * 对局详情（时间线）数据（web 本地类型，任务 10 预定义；供 context.details 消费，
 * 任务 11 时间线 Tab 从后端 timeline 接口装载后注入）
 */
export interface MatchCardGameDetails {
  /** 时间线帧数组（结构透传，frames 消费方以 toMatchCardFrames 防御处理） */
  frames: unknown[]
}
