/**
 * 战绩分析页面类型定义（League Akari 风格：顶部导航 + 左侧边栏 + 右侧战绩列表）
 * 全部字段强类型，禁止 any
 */

/** 对局结果：胜利 / 失败 / 投降 */
export type GameResult = 'victory' | 'defeat' | 'surrender'

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
  /** Akari Score 综合评分 */
  akariScore: number
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
  /** 阵容分布：常用英雄 ID 列表（头像小网格） */
  lineupChampionIds: number[]
}

/** 英雄点数列表项 */
export interface ChampionPoint {
  /** 英雄 ID */
  championId: number
  /** 英雄中文名，如 复仇焰魂 */
  name: string
  /** 英雄等级 */
  level: number
  /** 英雄点数 */
  points: number
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

/** 战绩卡片的特殊标记（四杀/击杀/拆塔/金币等） */
export interface GameTag {
  /** 标记类型：决定配色 */
  type: 'quadra' | 'kill' | 'tower' | 'gold'
  /** 展示文案，如 四杀 */
  label: string
}

/** 战绩卡片的队友项（头像 + 昵称 + 常用英雄） */
export interface GameTeammate {
  /** 玩家 puuid */
  puuid: string
  /** 昵称 */
  name: string
  /** 头像英雄 ID */
  championId: number
  /** 常用英雄 ID（副展示） */
  mainChampionId: number
}

/** 展开详情的单名玩家 */
export interface DetailPlayer {
  /** 昵称 */
  name: string
  /** 英雄 ID */
  championId: number
  /** 击杀 */
  kills: number
  /** 死亡 */
  deaths: number
  /** 助攻 */
  assists: number
  /** 经济 */
  gold: number
  /** 每分钟输出 */
  damagePerMin: number
  /** 出装（6 件物品 ID） */
  items: number[]
  /** 输出占比百分比（进度条） */
  damagePercent: number
  /** 承伤占比百分比（进度条） */
  damageTakenPercent: number
}

/** 展开详情的队伍汇总与玩家明细 */
export interface TeamDetail {
  /** 阵营：蓝 / 红 */
  side: 'blue' | 'red'
  /** 队伍总击杀 */
  totalKills: number
  /** 队伍总死亡 */
  totalDeaths: number
  /** 队伍总助攻 */
  totalAssists: number
  /** 队伍总经济 */
  totalGold: number
  /** 推塔数 */
  towers: number
  /** 5 名玩家明细 */
  players: DetailPlayer[]
}

/** 单局详情（蓝队 + 红队） */
export interface GameDetail {
  blue: TeamDetail
  red: TeamDetail
}

/** 战绩卡片 */
export interface GameCard {
  /** 对局 ID */
  gameId: number
  /** 结果：胜利 / 失败 / 投降 */
  result: GameResult
  /** 队列模式（用于筛选），如 所有模式 / 单双排位 / 灵活排位 / 极地大乱斗 */
  queueMode: string
  /** 本玩家英雄 ID */
  championId: number
  /** 击杀 */
  kills: number
  /** 死亡 */
  deaths: number
  /** 助攻 */
  assists: number
  /** 伤害占比百分比 */
  damageShare: number
  /** 总伤害 */
  totalDamage: number
  /** 时长文本，如 11:49 */
  duration: string
  /** 日期文本，如 2026-08-09 22:48 */
  date: string
  /** 地图名，如 嚎哭深渊 / 召唤师峡谷 */
  mapName: string
  /** 特殊标记列表 */
  tags: GameTag[]
  /** 队友列表 */
  teammates: GameTeammate[]
  /** 展开详情的双队数据 */
  detail: GameDetail
}

/** 战绩分析页面数据根对象 */
export interface GameStatsData {
  /** 顶部导航段位板块 */
  rankSections: RankSection[]
  /** 左侧总览统计 */
  overview: OverviewStats
  /** 英雄点数列表 */
  championPoints: ChampionPoint[]
  /** 最近队友 */
  recentTeammates: RecentPlayer[]
  /** 最近对手 */
  recentOpponents: RecentPlayer[]
  /** 战绩列表 */
  games: GameCard[]
}
