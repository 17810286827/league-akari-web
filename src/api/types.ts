/**
 * API 类型定义
 * 与后端 league-akari-server 的 DTO 字段一一对齐（见设计规格第 6 节），
 * 后续接口联调时以本文件为唯一事实来源，避免类型漂移。
 */

/** 对局列表摘要：用于列表页的轻量展示，含双方 10 人轻量档案（不含 statsJson 全量快照） */
export interface MatchSummary {
  /** 对局唯一标识（Riot 的 gameId） */
  gameId: number
  /** 对局创建时间戳（毫秒） */
  gameCreation: number
  /** 对局时长（秒） */
  gameDuration: number
  /** 游戏模式，如 CLASSIC / ARAM */
  gameMode: string
  /** 地图 ID（真实值，后端列表接口返回；折叠卡塔杀标签等按地图口径计算） */
  mapId?: number
  /** 队列 ID，如 420（单排） */
  queueId: number
  /** 对局所在大区 */
  region: string
  /** 获胜方队伍 ID（1 或 2），未知时为 null */
  winnerTeamId: number | null
  /** 当前用户在该对局中的 PUUID，用于标记“自我” */
  selfPuuid: string
  /** 本玩家在该局的个人战绩（契约新增；后端未升级完成期间可能为 null，展示侧需兜底） */
  self: MatchSelf | null
  /** self 所在队伍的聚合（契约新增；同上可能为 null） */
  teamTotals: MatchTeamTotals | null
  /** 同队队友摘要列表（契约新增，固定 4 人） */
  teammates: MatchTeammate[]
  /** 双方 10 人轻量档案（含 self，前端以 puuid 区分），供列表页折叠卡展示；
   *  后端未升级完成期间可能缺失，展示侧需 `?? []` 兜底 */
  participants?: MatchParticipantLight[]
}

/** 轻量参与者符文配置：主系+副系共 6 颗符文（LCU 平铺或 SGP 嵌套归一化后的形状） */
export interface MatchParticipantLightPerks {
  /** 符文 ID 列表（perk0-5 或 SGP 嵌套 perks.perkIds），缺失槽位为 null */
  perkIds: (number | null)[]
  /** 主系符文页样式 ID（如 8100 精密），缺失为 null */
  perkStyle: number | null
  /** 副系符文页样式 ID（如 8300 巫术），缺失为 null */
  perkSubStyle: number | null
}

/**
 * 列表摘要的轻量参与者档案（对应后端 MatchSummaryResponse.ParticipantLight）
 * 字段是 MatchParticipant 的子集：无 statsJson 快照，出装/技能/海克斯/符文直显
 */
export interface MatchParticipantLight {
  /** 玩家 PUUID，前端以此区分 self */
  puuid: string
  /** 召唤师名称（含 #tag，如 "ZZXOOV#qyq"） */
  summonerName: string
  /** 使用的英雄 ID */
  championId: number
  /** 所属队伍 ID：100（蓝方）/ 200（红方） */
  teamId: number
  /** 对线位置，如 TOP / JUNGLE，未知时为 null */
  position: string | null
  /** 是否获胜 */
  win: boolean
  /** 击杀数 */
  kills: number
  /** 死亡数 */
  deaths: number
  /** 助攻数 */
  assists: number
  /** 出装（statsJson 的 item0-6，按槽位顺序），缺失为 null */
  items: number[] | null
  /** 召唤师技能（statsJson 的 spell1Id/spell2Id，按槽位顺序），缺失为 null */
  summonerSpells: number[] | null
  /** 海克斯强化（statsJson 的 playerAugment1-6，按槽位顺序，缺失槽位为 null） */
  augments: (number | null)[] | null
  /** 符文配置（LCU 平铺或 SGP 嵌套归一化），缺失为 null */
  perks: MatchParticipantLightPerks | null
  /** 对英雄造成的总伤害（折叠卡雷达图/伤害占比使用；后端未升级时可能缺失） */
  totalDamageDealtToChampions?: number | null
  /** 承受总伤害（折叠卡统计行使用；后端未升级时可能缺失） */
  totalDamageTaken?: number | null
  /** 治疗量（后端未升级时可能缺失） */
  totalHeal?: number | null
  /** 视野得分（后端未升级时可能缺失） */
  visionScore?: number | null
  /** 获得金币（后端未升级时可能缺失） */
  goldEarned?: number | null
  /** 补刀数（后端未升级时可能缺失） */
  cs?: number | null
  /** 推塔数（后端未升级时可能缺失） */
  turretKills?: number | null
  /** 插眼数（后端未升级时可能缺失） */
  wardsPlaced?: number | null
  /** 对塔伤害（折叠卡拆塔标签使用；后端未升级时可能缺失） */
  totalDamageToTowers?: number | null
  /** 双杀数（折叠卡多杀标签使用） */
  doubleKills?: number | null
  /** 三杀数 */
  tripleKills?: number | null
  /** 四杀数 */
  quadraKills?: number | null
  /** 五杀数 */
  pentaKills?: number | null
  /** 对友军总护盾量（折叠卡护盾标签使用） */
  totalDamageShieldedOnTeammates?: number | null
  /** 控制他人时长（折叠卡控制标签使用） */
  timeCCingOthers?: number | null
  /** 单杀数（SGP challenges 独有，折叠卡单杀标签使用） */
  soloKills?: number | null
  /** 敌方塔附近击杀数（折叠卡塔杀标签使用） */
  killsNearEnemyTurret?: number | null
  /** 己方塔下击杀数（折叠卡反杀标签使用） */
  killsUnderOwnTurret?: number | null
  /** 对线最大补刀差（折叠卡补刀压制标签使用） */
  maxCsAdvantageOnLaneOpponent?: number | null
  /** 击飞击杀数（折叠卡击飞标签使用） */
  knockEnemyIntoTeamAndKill?: number | null
}

/** 本玩家（selfPuuid）在该局的个人战绩快照（后端从 stats_json 解析而来） */
export interface MatchSelf {
  /** 使用的英雄 ID */
  championId: number
  /** 召唤师名称（含 #tag，如 "ZZXOOV#qyq"） */
  summonerName: string
  /** 击杀数 */
  kills: number
  /** 死亡数 */
  deaths: number
  /** 助攻数 */
  assists: number
  /** 本玩家是否获胜 */
  win: boolean
  /** 对英雄造成的总伤害 */
  totalDamage: number
  /** 承受的总伤害 */
  totalDamageTaken: number
  /** 获得的金币 */
  goldEarned: number
  /** 补刀数（小兵 + 野怪） */
  cs: number
  /** 最大连杀数，用于"四杀"标记 */
  largestMultiKill: number
  /** 推塔数，用于"拆塔"标记 */
  turretKills: number
  /** 是否以投降结束（stats_json 字段） */
  gameEndedInSurrender: boolean
}

/** self 所在队伍的聚合数据（同队 5 人求和） */
export interface MatchTeamTotals {
  /** 全队总击杀 */
  kills: number
  /** 全队总经济 */
  gold: number
  /** 全队对英雄总伤害 */
  damage: number
  /** 全队总承伤 */
  damageTaken: number
}

/** 同队队友摘要（除 self 外其余 4 人，用于最近队友/对手聚合与卡片队友展示） */
export interface MatchTeammate {
  /** 玩家 PUUID */
  puuid: string
  /** 召唤师名称（含 #tag） */
  summonerName: string
  /** 本局英雄 ID */
  championId: number
  /** 是否获胜（同队一致） */
  win: boolean
}

/** 通用分页响应结构：后端所有分页接口的统一返回格式 */
export interface PageResponse<T> {
  /** 当前页数据列表 */
  data: T[]
  /** 当前页码（从 1 开始） */
  page: number
  /** 每页条数 */
  pageSize: number
  /** 符合条件的总条数 */
  total: number
  /** 最近对手聚合（仅 matches 列表接口返回：本页对局非 self 队玩家按出现次数前 5；后端未升级时缺失） */
  recentOpponents?: RecentOpponent[]
}

/** 最近对手聚合项（与后端 MatchSummaryResponse.RecentOpponent 对齐） */
export interface RecentOpponent {
  /** 玩家 puuid */
  puuid: string
  /** 召唤师名（含 #tag） */
  summonerName: string
  /** 英雄 ID（最后一次出现） */
  championId: number
  /** 胜场数 */
  wins: number
  /** 负场数 */
  losses: number
}

/** 对局参与者：对局详情中的单个玩家记录 */
export interface MatchParticipant {
  /** 参与者记录主键 */
  id: number
  /** 所属对局的 gameId */
  matchId: number
  /** 玩家 PUUID */
  puuid: string
  /** 玩家召唤师名称 */
  summonerName: string
  /** 使用的英雄 ID */
  championId: number
  /** 所属队伍 ID：100（蓝方）/ 200（红方） */
  teamId: number
  /** 对线位置，如 TOP / JUNGLE，未知时为 null */
  position: string | null
  /** 击杀数 */
  kills: number
  /** 死亡数 */
  deaths: number
  /** 助攻数 */
  assists: number
  /** 是否获胜 */
  win: boolean
  /** 获得的金币 */
  goldEarned: number
  /** 补刀数（小兵 + 野怪） */
  cs: number
  /** 出装（后端为 JSON 字符串，如 "[6653,3078]"，展示时解析） */
  items: string | null
  /** 召唤师技能（后端为 JSON 字符串，如 "[4,12]"） */
  summonerSpells: string | null
  /** stats 全量快照（JSON 字符串，由后端原样存储） */
  statsJson: string | null
}

/** 对局详情：基础信息 + 全部参与者，用于详情页展示 */
export interface MatchDetail {
  /** 对局唯一标识（Riot 的 gameId） */
  gameId: number
  /** 对局创建时间戳（毫秒） */
  gameCreation: number
  /** 对局时长（秒） */
  gameDuration: number
  /** 游戏模式 */
  gameMode: string
  /** 游戏类型 */
  gameType: string
  /** 队列 ID */
  queueId: number
  /** 地图 ID */
  mapId: number
  /** 对局版本号 */
  gameVersion: string
  /** 对局所在大区 */
  region: string
  /** RSO 平台 ID */
  rsoPlatformId: string
  /** 数据来源标识（如官方 API / SGP） */
  dataSource: string
  /** 获胜方队伍 ID，未知时为 null */
  winnerTeamId: number | null
  /** 当前用户在该对局中的 PUUID */
  selfPuuid: string
  /** 队伍信息快照（JSON 字符串） */
  teamsJson: string | null
  /** 参与者明细列表 */
  participants: MatchParticipant[]
}

/**
 * 时间线帧：对局时间线数据的最小单元
 * 结构尚未建模（任务 15 时间线全量适配时补充字段），当前以 unknown 透传，
 * 由消费方（如 toMatchCardFrames）防御处理
 */
export type MatchTimelineFrame = unknown

/** 从 stats_json 解析出的常用展示字段（可选，字段缺失不影响展示） */
export interface ParsedStats {
  /** 对英雄造成的总伤害 */
  totalDamageDealtToChampions?: number
  /** 对防御塔造成的伤害 */
  damageDealtToTurrets?: number
  /** 对史诗级野怪（龙、先锋等）造成的伤害 */
  damageDealtToObjectives?: number
  /** 承受的总伤害 */
  totalDamageTaken?: number
  /** 视野得分 */
  visionScore?: number
  /** 对局结束时的英雄等级 */
  champLevel?: number
  /** 其余未建模字段原样透传（stats_json 中的其他键） */
  [key: string]: unknown
}
