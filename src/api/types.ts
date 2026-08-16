/**
 * API 类型定义
 * 与后端 league-akari-server 的 DTO 字段一一对齐（见设计规格第 6 节），
 * 后续接口联调时以本文件为唯一事实来源，避免类型漂移。
 */

/** 对局列表摘要：用于列表页的轻量展示，不含参与者明细 */
export interface MatchSummary {
  /** 对局唯一标识（Riot 的 gameId） */
  gameId: number
  /** 对局创建时间戳（毫秒） */
  gameCreation: number
  /** 对局时长（秒） */
  gameDuration: number
  /** 游戏模式，如 CLASSIC / ARAM */
  gameMode: string
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
