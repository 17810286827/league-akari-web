/**
 * 战绩分析页面模拟数据（League Akari 风格，参考图对齐）：
 * 顶部段位未定级、左侧总览/英雄点数/最近队友对手、右侧 6 场对局（胜利/失败/投降混合，含双队详情）
 */
import type { ChampionPoint, GameCard, GameStatsData, RecentPlayer } from './types'

/** 常用英雄 ID（头像 CDN 用） */
const HERO = {
  AHRI: 103,
  YASUO: 157,
  BRAND: 63,
  LEE_SIN: 64,
  EZREAL: 81,
  JINX: 222,
  THRESH: 412,
  LULU: 117,
  AATROX: 266,
  KAISA: 145
} as const

/** 顶部导航：单双排位 / 灵活排位，均未定级 */
const rankSections = [
  { queue: '单双排位', tier: '未定级', highestTier: '最高 未定级' },
  { queue: '灵活排位', tier: '未定级', highestTier: '最高 未定级' }
]

/** 左侧总览统计 */
const overview = {
  akariScore: 14,
  avgKda: 4.77,
  participation: 62,
  damageShare: 27,
  damageTakenShare: 19,
  goldShare: 24,
  csPerMin: 8.1,
  wins: 10,
  losses: 8,
  lineupChampionIds: [HERO.AHRI, HERO.YASUO, HERO.BRAND, HERO.LEE_SIN, HERO.EZREAL]
}

/** 英雄点数列表 */
const championPoints: ChampionPoint[] = [
  { championId: HERO.BRAND, name: '复仇焰魂', level: 13, points: 113013 },
  { championId: HERO.AHRI, name: '九尾妖狐', level: 11, points: 88520 },
  { championId: HERO.YASUO, name: '疾风剑豪', level: 9, points: 62440 },
  { championId: HERO.LEE_SIN, name: '盲僧', level: 8, points: 43105 }
]

/** 最近队友 */
const recentTeammates: RecentPlayer[] = [
  { puuid: 'p-teammate-1', name: '手裂鬼子', tagLine: 'tw2', championId: HERO.AATROX, wins: 5, losses: 14 },
  { puuid: 'p-teammate-2', name: '夜风', tagLine: 'tw2', championId: HERO.LULU, wins: 8, losses: 6 },
  { puuid: 'p-teammate-3', name: '星野', tagLine: 'tw2', championId: HERO.KAISA, wins: 12, losses: 9 },
  { puuid: 'p-teammate-4', name: '阿澈', tagLine: 'tw2', championId: HERO.JINX, wins: 3, losses: 11 }
]

/** 最近对手 */
const recentOpponents: RecentPlayer[] = [
  { puuid: 'p-opponent-1', name: '鼠鼠我a', tagLine: 'tw2', championId: HERO.THRESH, wins: 0, losses: 2 },
  { puuid: 'p-opponent-2', name: '辣个蓝人', tagLine: 'tw2', championId: HERO.LEE_SIN, wins: 1, losses: 1 },
  { puuid: 'p-opponent-3', name: '风间', tagLine: 'tw2', championId: HERO.YASUO, wins: 2, losses: 1 }
]

/** 生成一局详情的双队数据（蓝队胜/红队负的固定形状，数值按场次微调） */
function makeDetail(seed: number): GameCard['detail'] {
  const base = seed % 10 + 1
  const bluePlayers = [
    { name: '手裂鬼子', championId: HERO.AATROX, kills: 5 + base, deaths: 3, assists: 8, gold: 12500, damagePerMin: 620, items: [6691, 3078, 3814, 3031, 1052, 3364], damagePercent: 26, damageTakenPercent: 24 },
    { name: '夜风', championId: HERO.LULU, kills: 2, deaths: 2, assists: 12, gold: 9800, damagePerMin: 310, items: [3097, 3190, 3222, 3504, 1052, 3364], damagePercent: 11, damageTakenPercent: 9 },
    { name: '星野', championId: HERO.KAISA, kills: 8, deaths: 4, assists: 6, gold: 14200, damagePerMin: 780, items: [6672, 3078, 3046, 3026, 1052, 3364], damagePercent: 31, damageTakenPercent: 12 },
    { name: '阿澈', championId: HERO.JINX, kills: 7, deaths: 3, assists: 5, gold: 13600, damagePerMin: 720, items: [6694, 3094, 3031, 3026, 1052, 3364], damagePercent: 22, damageTakenPercent: 10 },
    { name: 'ZZXOOV', championId: HERO.AHRI, kills: 9, deaths: 2, assists: 10, gold: 14800, damagePerMin: 810, items: [6653, 3157, 3020, 3089, 3135, 3364], damagePercent: 27, damageTakenPercent: 14 }
  ]
  const redPlayers = [
    { name: '鼠鼠我a', championId: HERO.THRESH, kills: 1, deaths: 9, assists: 7, gold: 8600, damagePerMin: 210, items: [3097, 3190, 3110, 3222, 1052, 3364], damagePercent: 8, damageTakenPercent: 26 },
    { name: '辣个蓝人', championId: HERO.LEE_SIN, kills: 5, deaths: 6, assists: 4, gold: 10200, damagePerMin: 430, items: [6691, 3071, 3814, 1052, 1052, 3364], damagePercent: 18, damageTakenPercent: 21 },
    { name: '风间', championId: HERO.YASUO, kills: 6, deaths: 7, assists: 3, gold: 10800, damagePerMin: 520, items: [6672, 3078, 3046, 1052, 1052, 3364], damagePercent: 24, damageTakenPercent: 17 },
    { name: '夜雨声烦', championId: HERO.EZREAL, kills: 4, deaths: 5, assists: 6, gold: 11500, damagePerMin: 590, items: [6692, 3139, 3158, 3072, 1052, 3364], damagePercent: 26, damageTakenPercent: 12 },
    { name: '花名未闻', championId: HERO.BRAND, kills: 3, deaths: 8, assists: 9, gold: 9400, damagePerMin: 480, items: [6655, 3157, 3020, 3089, 1052, 3364], damagePercent: 22, damageTakenPercent: 15 }
  ]
  return {
    blue: { side: 'blue', totalKills: 31, totalDeaths: 14, totalAssists: 41, totalGold: 64900, towers: 11, players: bluePlayers },
    red: { side: 'red', totalKills: 19, totalDeaths: 35, totalAssists: 29, totalGold: 50500, towers: 4, players: redPlayers }
  }
}

/** 战绩列表：胜利 / 失败 / 投降混合，不同模式、地图、标记 */
const games: GameCard[] = [
  {
    gameId: 9200000201,
    result: 'victory',
    queueId: 450,
    championId: HERO.AHRI,
    kills: 19,
    deaths: 7,
    assists: 24,
    damageShare: 27,
    totalDamage: 41968,
    duration: '11:49',
    date: '2026-08-09 22:48',
    mapName: '嚎哭深渊',
    tags: [
      { type: 'quadra', label: '四杀' },
      { type: 'kill', label: '击杀' }
    ],
    teammates: [
      { puuid: 't-1', name: '手裂鬼子', championId: HERO.AATROX, mainChampionId: HERO.YASUO },
      { puuid: 't-2', name: '夜风', championId: HERO.LULU, mainChampionId: HERO.LULU },
      { puuid: 't-3', name: '星野', championId: HERO.KAISA, mainChampionId: HERO.JINX },
      { puuid: 't-4', name: '阿澈', championId: HERO.JINX, mainChampionId: HERO.KAISA }
    ],
    detail: makeDetail(1)
  },
  {
    gameId: 9200000202,
    result: 'defeat',
    queueId: 420,
    championId: HERO.YASUO,
    kills: 8,
    deaths: 11,
    assists: 5,
    damageShare: 21,
    totalDamage: 31240,
    duration: '28:03',
    date: '2026-08-09 21:12',
    mapName: '召唤师峡谷',
    tags: [{ type: 'tower', label: '拆塔' }],
    teammates: [
      { puuid: 't-1', name: '手裂鬼子', championId: HERO.AATROX, mainChampionId: HERO.YASUO },
      { puuid: 't-2', name: '夜风', championId: HERO.LULU, mainChampionId: HERO.LULU },
      { puuid: 't-3', name: '星野', championId: HERO.KAISA, mainChampionId: HERO.JINX },
      { puuid: 't-4', name: '阿澈', championId: HERO.JINX, mainChampionId: HERO.KAISA }
    ],
    detail: makeDetail(2)
  },
  {
    gameId: 9200000203,
    result: 'surrender',
    queueId: 440,
    championId: HERO.LEE_SIN,
    kills: 6,
    deaths: 9,
    assists: 8,
    damageShare: 18,
    totalDamage: 22680,
    duration: '16:22',
    date: '2026-08-08 23:40',
    mapName: '召唤师峡谷',
    tags: [
      { type: 'gold', label: '金币' },
      { type: 'kill', label: '击杀' }
    ],
    teammates: [
      { puuid: 't-1', name: '手裂鬼子', championId: HERO.AATROX, mainChampionId: HERO.YASUO },
      { puuid: 't-2', name: '夜风', championId: HERO.LULU, mainChampionId: HERO.LULU },
      { puuid: 't-3', name: '星野', championId: HERO.KAISA, mainChampionId: HERO.JINX },
      { puuid: 't-4', name: '阿澈', championId: HERO.JINX, mainChampionId: HERO.KAISA }
    ],
    detail: makeDetail(3)
  },
  {
    gameId: 9200000204,
    result: 'victory',
    queueId: 420,
    championId: HERO.BRAND,
    kills: 14,
    deaths: 5,
    assists: 18,
    damageShare: 32,
    totalDamage: 38760,
    duration: '31:15',
    date: '2026-08-08 20:05',
    mapName: '召唤师峡谷',
    tags: [{ type: 'quadra', label: '四杀' }],
    teammates: [
      { puuid: 't-1', name: '手裂鬼子', championId: HERO.AATROX, mainChampionId: HERO.YASUO },
      { puuid: 't-2', name: '夜风', championId: HERO.LULU, mainChampionId: HERO.LULU },
      { puuid: 't-3', name: '星野', championId: HERO.KAISA, mainChampionId: HERO.JINX },
      { puuid: 't-4', name: '阿澈', championId: HERO.JINX, mainChampionId: HERO.KAISA }
    ],
    detail: makeDetail(4)
  },
  {
    gameId: 9200000205,
    result: 'defeat',
    queueId: 450,
    championId: HERO.EZREAL,
    kills: 11,
    deaths: 10,
    assists: 9,
    damageShare: 25,
    totalDamage: 30120,
    duration: '13:37',
    date: '2026-08-07 23:18',
    mapName: '嚎哭深渊',
    tags: [{ type: 'gold', label: '金币' }],
    teammates: [
      { puuid: 't-1', name: '手裂鬼子', championId: HERO.AATROX, mainChampionId: HERO.YASUO },
      { puuid: 't-2', name: '夜风', championId: HERO.LULU, mainChampionId: HERO.LULU },
      { puuid: 't-3', name: '星野', championId: HERO.KAISA, mainChampionId: HERO.JINX },
      { puuid: 't-4', name: '阿澈', championId: HERO.JINX, mainChampionId: HERO.KAISA }
    ],
    detail: makeDetail(5)
  },
  {
    gameId: 9200000206,
    result: 'victory',
    queueId: 440,
    championId: HERO.AHRI,
    kills: 12,
    deaths: 3,
    assists: 15,
    damageShare: 24,
    totalDamage: 29880,
    duration: '24:46',
    date: '2026-08-07 19:52',
    mapName: '召唤师峡谷',
    tags: [
      { type: 'kill', label: '击杀' },
      { type: 'tower', label: '拆塔' }
    ],
    teammates: [
      { puuid: 't-1', name: '手裂鬼子', championId: HERO.AATROX, mainChampionId: HERO.YASUO },
      { puuid: 't-2', name: '夜风', championId: HERO.LULU, mainChampionId: HERO.LULU },
      { puuid: 't-3', name: '星野', championId: HERO.KAISA, mainChampionId: HERO.JINX },
      { puuid: 't-4', name: '阿澈', championId: HERO.JINX, mainChampionId: HERO.KAISA }
    ],
    detail: makeDetail(6)
  }
]

/** 战绩分析页面数据根对象 */
export const mockGameStats: GameStatsData = {
  rankSections,
  overview,
  championPoints,
  recentTeammates,
  recentOpponents,
  games
}

/** 队列筛选选项（下拉框） */
export const queueFilterOptions = ['所有模式', '单双排位', '灵活排位', '极地大乱斗'] as const
