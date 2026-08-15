/**
 * 玩家详情页模拟数据：与截图内容对齐（ZZXOOV #qyq / TW / 413 级 / Challenger 413LP）
 * 头像与物品图标使用 ddragon CDN（16.16.1，已验证可用），英雄头像与 Banner 使用 CommunityDragon
 */
import type {
  ChampionStat,
  MatchHistoryItem,
  MatchParticipant,
  PlayerProfile,
  SeasonRecord
} from './types'

/** 英雄 ID 常量：用于参与者生成与头像 CDN */
const CHAMPION = {
  AATROX: 266,
  AHRI: 103,
  EZREAL: 81,
  JINX: 222,
  KAI_SA: 145,
  LEE_SIN: 64,
  LULU: 117,
  NIDALEE: 76,
  PYKE: 555,
  SENNA: 235,
  THRESH: 412,
  YASUO: 157
} as const

/** 英雄名 → 展示名（CDN 文件名需要规范名） */
const CHAMPION_NAMES: Record<number, string> = {
  [CHAMPION.AATROX]: 'Aatrox',
  [CHAMPION.AHRI]: 'Ahri',
  [CHAMPION.EZREAL]: 'Ezreal',
  [CHAMPION.JINX]: 'Jinx',
  [CHAMPION.KAI_SA]: 'Kai\'Sa',
  [CHAMPION.LEE_SIN]: 'Lee Sin',
  [CHAMPION.LULU]: 'Lulu',
  [CHAMPION.NIDALEE]: 'Nidalee',
  [CHAMPION.PYKE]: 'Pyke',
  [CHAMPION.SENNA]: 'Senna',
  [CHAMPION.THRESH]: 'Thresh',
  [CHAMPION.YASUO]: 'Yasuo'
}

/** 英雄头像 CDN（CommunityDragon，已验证可用） */
export function championIconUrl(championId: number): string {
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${championId}.png`
}

/** 物品图标 CDN（ddragon，已验证可用） */
export function itemIconUrl(itemId: number): string {
  return `https://ddragon.leagueoflegends.com/cdn/16.16.1/img/item/${itemId}.png`
}

/** 头像 CDN */
export function profileIconUrl(iconId: number): string {
  return `https://ddragon.leagueoflegends.com/cdn/16.16.1/img/profileicon/${iconId}.png`
}

/** Banner 皮肤图（CommunityDragon splash，格式 {championId}/{skinId}.jpg） */
export function bannerSkinUrl(championId: number, skinId: number): string {
  return `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-splashes/${championId}/${skinId}.jpg`
}

/** KDA 比率计算（死亡为 0 时取击杀+助攻，避免除零） */
function calcKda(kills: number, deaths: number, assists: number): number {
  return deaths === 0 ? kills + assists : Number(((kills + assists) / deaths).toFixed(2))
}

/** 生成一名参赛者（用于对局行参与者列表） */
function makeParticipant(
  index: number,
  teamId: 100 | 200,
  win: boolean,
  championPool: number[],
  namePool: string[]
): MatchParticipant {
  const championId = championPool[index % championPool.length]
  return {
    puuid: `mock-puuid-${teamId}-${index}`,
    summonerName: namePool[index % namePool.length],
    championId,
    teamId,
    win,
    kills: Math.floor(Math.random() * 8) + 1,
    deaths: Math.floor(Math.random() * 8),
    assists: Math.floor(Math.random() * 10) + 2,
    items: [6653, 3078, 3026, 3047, 1052, 3364]
  }
}

/** 生成一场对局的完整 10 人参与者列表（蓝方 100 胜 / 红方 200 胜二选一） */
function makeParticipants(blueWin: boolean): MatchParticipant[] {
  const blueNames = ['ZZXOOV', 'KaiWen', 'TsuNami', 'HanaHime', 'Momo酱']
  const redNames = ['NightFury', 'SakuraTwi', 'PeakJungle', 'LunaSea', 'StrikerX']
  const bluePool = [CHAMPION.AHRI, CHAMPION.LEE_SIN, CHAMPION.JINX, CHAMPION.LULU, CHAMPION.AATROX]
  const redPool = [CHAMPION.YASUO, CHAMPION.NIDALEE, CHAMPION.KAI_SA, CHAMPION.THRESH, CHAMPION.EZREAL]
  const result: MatchParticipant[] = []
  for (let i = 0; i < 5; i += 1) {
    result.push(makeParticipant(i, 100, blueWin, bluePool, blueNames))
    result.push(makeParticipant(i, 200, !blueWin, redPool, redNames))
  }
  return result
}

/** 赛季历史：近 4 个赛季的段位记录 */
const seasonHistory: SeasonRecord[] = [
  { season: 'S2025 Split 2', tier: 'Challenger', division: '', lp: 413 },
  { season: 'S2025 Split 1', tier: 'Grandmaster', division: '', lp: 615 },
  { season: 'S2024', tier: 'Challenger', division: '', lp: 823 },
  { season: 'S2023', tier: 'Master', division: '', lp: 215 }
]

/** 英雄胜率列表：阿狸 / 亚索 / 盲僧 / 伊泽瑞尔 / 锤石 */
const championStats: ChampionStat[] = [
  { championId: CHAMPION.AHRI, championName: 'Ahri', games: 126, wins: 71, losses: 55, winRate: 56.3, kills: 8.2, deaths: 3.9, assists: 10.4, kda: 4.77 },
  { championId: CHAMPION.YASUO, championName: 'Yasuo', games: 88, wins: 47, losses: 41, winRate: 53.4, kills: 7.1, deaths: 5.2, assists: 6.8, kda: 2.67 },
  { championId: CHAMPION.LEE_SIN, championName: 'Lee Sin', games: 64, wins: 35, losses: 29, winRate: 54.7, kills: 6.4, deaths: 4.1, assists: 9.2, kda: 3.80 },
  { championId: CHAMPION.EZREAL, championName: 'Ezreal', games: 41, wins: 22, losses: 19, winRate: 53.7, kills: 6.8, deaths: 3.2, assists: 8.4, kda: 4.75 }
]

/** 最近对局列表：单双排 / 灵活排位 / 极地大乱斗混合，胜负交替 */
const matches: MatchHistoryItem[] = [
  {
    gameId: 9100000101,
    queueType: 'RANKED_SOLO_5x5',
    queueName: '单排/双排',
    gameMode: 'CLASSIC',
    gameCreation: 1755200000000,
    gameDuration: 1830,
    win: true,
    championId: CHAMPION.AHRI,
    championName: 'Ahri',
    kills: 9,
    deaths: 2,
    assists: 14,
    kda: 11.5,
    cs: 212,
    goldEarned: 14800,
    items: [6653, 3157, 3020, 3089, 3026, 3364],
    summonerSpells: [4, 12],
    participants: makeParticipants(true)
  },
  {
    gameId: 9100000102,
    queueType: 'RANKED_SOLO_5x5',
    queueName: '单排/双排',
    gameMode: 'CLASSIC',
    gameCreation: 1755194000000,
    gameDuration: 1745,
    win: false,
    championId: CHAMPION.YASUO,
    championName: 'Yasuo',
    kills: 6,
    deaths: 7,
    assists: 5,
    kda: 1.57,
    cs: 198,
    goldEarned: 11200,
    items: [6672, 3078, 3046, 3026, 1052, 3364],
    summonerSpells: [4, 14],
    participants: makeParticipants(false)
  },
  {
    gameId: 9100000103,
    queueType: 'RANKED_FLEX_SR',
    queueName: '灵活排位',
    gameMode: 'CLASSIC',
    gameCreation: 1755187000000,
    gameDuration: 2010,
    win: true,
    championId: CHAMPION.LEE_SIN,
    championName: 'Lee Sin',
    kills: 8,
    deaths: 4,
    assists: 12,
    kda: 5.0,
    cs: 154,
    goldEarned: 13600,
    items: [6691, 3071, 3814, 3031, 1052, 3364],
    summonerSpells: [4, 11],
    participants: makeParticipants(true)
  },
  {
    gameId: 9100000104,
    queueType: 'ARAM',
    queueName: '极地大乱斗',
    gameMode: 'ARAM',
    gameCreation: 1755180000000,
    gameDuration: 1420,
    win: true,
    championId: CHAMPION.EZREAL,
    championName: 'Ezreal',
    kills: 15,
    deaths: 5,
    assists: 11,
    kda: 5.2,
    cs: 96,
    goldEarned: 15200,
    items: [6692, 3139, 3158, 3072, 1052, 3364],
    summonerSpells: [4, 7],
    participants: makeParticipants(true)
  },
  {
    gameId: 9100000105,
    queueType: 'RANKED_SOLO_5x5',
    queueName: '单排/双排',
    gameMode: 'CLASSIC',
    gameCreation: 1755173000000,
    gameDuration: 1650,
    win: false,
    championId: CHAMPION.AHRI,
    championName: 'Ahri',
    kills: 4,
    deaths: 6,
    assists: 9,
    kda: 2.17,
    cs: 186,
    goldEarned: 9800,
    items: [6653, 3157, 3020, 1052, 1052, 3364],
    summonerSpells: [4, 12],
    participants: makeParticipants(false)
  },
  {
    gameId: 9100000106,
    queueType: 'RANKED_SOLO_5x5',
    queueName: '单排/双排',
    gameMode: 'CLASSIC',
    gameCreation: 1755165000000,
    gameDuration: 1920,
    win: true,
    championId: CHAMPION.AHRI,
    championName: 'Ahri',
    kills: 11,
    deaths: 3,
    assists: 16,
    kda: 9.0,
    cs: 205,
    goldEarned: 15600,
    items: [6653, 3157, 3020, 3089, 3135, 3364],
    summonerSpells: [4, 12],
    participants: makeParticipants(true)
  },
  {
    gameId: 9100000107,
    queueType: 'RANKED_FLEX_SR',
    queueName: '灵活排位',
    gameMode: 'CLASSIC',
    gameCreation: 1755156000000,
    gameDuration: 1555,
    win: false,
    championId: CHAMPION.YASUO,
    championName: 'Yasuo',
    kills: 5,
    deaths: 8,
    assists: 3,
    kda: 1.0,
    cs: 172,
    goldEarned: 8900,
    items: [6672, 3078, 3046, 1052, 1052, 3364],
    summonerSpells: [4, 14],
    participants: makeParticipants(false)
  },
  {
    gameId: 9100000108,
    queueType: 'ARAM',
    queueName: '极地大乱斗',
    gameMode: 'ARAM',
    gameCreation: 1755148000000,
    gameDuration: 1680,
    win: false,
    championId: CHAMPION.LEE_SIN,
    championName: 'Lee Sin',
    kills: 10,
    deaths: 9,
    assists: 8,
    kda: 2.0,
    cs: 88,
    goldEarned: 12100,
    items: [6691, 3071, 3814, 3031, 1052, 3364],
    summonerSpells: [4, 11],
    participants: makeParticipants(false)
  }
]

/** 玩家完整资料（页面数据源） */
export const mockPlayerProfile: PlayerProfile = {
  puuid: 'mock-puuid-zzxoov',
  gameName: 'ZZXOOV',
  tagLine: 'qyq',
  region: 'TW',
  level: 413,
  profileIconId: 6186,
  bannerSkinId: 103001,
  socials: [{ type: 'discord', label: 'zzxoov#0000', url: 'https://discord.com' }],
  ranked: {
    queueType: 'RANKED_SOLO_5x5',
    tier: 'Challenger',
    division: '',
    lp: 413,
    wins: 253,
    losses: 231,
    winRate: 52.3
  },
  seasonHistory,
  championStats,
  summary: {
    kda: calcKda(7.2, 3.4, 9.8),
    avgKills: 7.2,
    avgDeaths: 3.4,
    avgAssists: 9.8,
    visionScore: 42,
    csPerMin: 8.1,
    winRate: 53.0,
    games: 120
  },
  matches
}

export { CHAMPION_NAMES }
