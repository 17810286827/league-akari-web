/**
 * 玩家数据详情页的类型定义（OP.GG 风格）
 * 所有接口与后端/数据源字段对齐，禁止使用 any
 */

/** 社交链接类型 */
export type SocialType = 'discord' | 'twitch' | 'youtube' | 'twitter'

/** 社交链接 */
export interface SocialLink {
  /** 平台类型 */
  type: SocialType
  /** 展示名称，如 Discord 用户名 */
  label: string
  /** 跳转地址 */
  url: string
}

/** 段位信息 */
export interface RankInfo {
  /** 队列类型：RANKED_SOLO_5x5 单双排 / RANKED_FLEX_SR 灵活排位 */
  queueType: string
  /** 段位名称，如 Challenger / Grandmaster / Diamond */
  tier: string
  /** 段位内分级（Challenger 及以上为空串），如 I / II / III / IV */
  division: string
  /** 胜点（LP） */
  lp: number
  /** 胜场 */
  wins: number
  /** 负场 */
  losses: number
  /** 胜率百分比 0-100 */
  winRate: number
}

/** 赛季段位历史记录（History Table 一行） */
export interface SeasonRecord {
  /** 赛季标识，如 S2025 Split 2 */
  season: string
  /** 段位名称 */
  tier: string
  /** 段位内分级 */
  division: string
  /** 该赛季末胜点 */
  lp: number
}

/** 英雄胜率统计（Champion Stats 列表项） */
export interface ChampionStat {
  /** 英雄 ID（用于头像 CDN） */
  championId: number
  /** 英雄名，如 Ahri */
  championName: string
  /** 总场次 */
  games: number
  /** 胜场 */
  wins: number
  /** 负场 */
  losses: number
  /** 胜率百分比 0-100 */
  winRate: number
  /** 场均击杀 */
  kills: number
  /** 场均死亡 */
  deaths: number
  /** 场均助攻 */
  assists: number
  /** KDA 比率（(击杀+助攻)/死亡） */
  kda: number
}

/** 玩家综合统计（Summary Cards 数据源） */
export interface PlayerSummary {
  /** 综合 KDA 比率 */
  kda: number
  /** 场均击杀 */
  avgKills: number
  /** 场均死亡 */
  avgDeaths: number
  /** 场均助攻 */
  avgAssists: number
  /** 场均视野得分 */
  visionScore: number
  /** 每分钟补刀 */
  csPerMin: number
  /** 近期胜率百分比 */
  winRate: number
  /** 统计场次 */
  games: number
}

/** 单局参赛者（对局行的队友/对手列表项） */
export interface MatchParticipant {
  /** 玩家 puuid */
  puuid: string
  /** 召唤师名 */
  summonerName: string
  /** 英雄 ID */
  championId: number
  /** 队伍 ID：100 蓝方 / 200 红方 */
  teamId: number
  /** 是否获胜 */
  win: boolean
  /** 击杀 */
  kills: number
  /** 死亡 */
  deaths: number
  /** 助攻 */
  assists: number
  /** 出装（物品 ID 数组） */
  items: number[]
}

/** 对局历史记录（Match List 一行） */
export interface MatchHistoryItem {
  /** 对局 ID */
  gameId: number
  /** 队列类型 */
  queueType: string
  /** 队列展示名，如 单排/双排、极地大乱斗 */
  queueName: string
  /** 游戏模式，如 CLASSIC / ARAM */
  gameMode: string
  /** 对局创建时间戳（ms） */
  gameCreation: number
  /** 对局时长（秒） */
  gameDuration: number
  /** 本玩家是否获胜（决定行背景蓝/红） */
  win: boolean
  /** 本玩家英雄 ID */
  championId: number
  /** 本玩家英雄名 */
  championName: string
  /** 击杀 */
  kills: number
  /** 死亡 */
  deaths: number
  /** 助攻 */
  assists: number
  /** KDA 比率 */
  kda: number
  /** 补刀数 */
  cs: number
  /** 获得金币 */
  goldEarned: number
  /** 出装（6 件物品 ID） */
  items: number[]
  /** 召唤师技能（2 个技能 ID） */
  summonerSpells: [number, number]
  /** 全部 10 名参赛者 */
  participants: MatchParticipant[]
}

/** 玩家完整资料（页面数据根对象） */
export interface PlayerProfile {
  /** 玩家 puuid */
  puuid: string
  /** 游戏名，如 ZZXOOV */
  gameName: string
  /** 尾号，如 qyq */
  tagLine: string
  /** 地区标签，如 TW */
  region: string
  /** 召唤师等级 */
  level: number
  /** 头像图标 ID */
  profileIconId: number
  /** Banner 英雄皮肤 ID（头部背景图） */
  bannerSkinId: number
  /** 社交链接列表 */
  socials: SocialLink[]
  /** 当前赛季段位 */
  ranked: RankInfo
  /** 历史赛季记录 */
  seasonHistory: SeasonRecord[]
  /** 英雄胜率列表 */
  championStats: ChampionStat[]
  /** 综合统计 */
  summary: PlayerSummary
  /** 最近对局 */
  matches: MatchHistoryItem[]
}
