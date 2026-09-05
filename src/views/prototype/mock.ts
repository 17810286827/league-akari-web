/**
 * 【原型专用】mock 对局数据(一次性原型,不进生产逻辑)
 *
 * 用途:在 /prototype/responsive 画布里渲染"真实组件"(GameCardItem → MatchCard →
 * MatchCardOverview/MatchCardDetails),需要喂真实契约形状的数据。
 * 结构与后端 DTO 一比一:MOCK_SUMMARIES 给列表折叠卡,makeMockDetail 给展开详情。
 * 字段口径见 src/api/types.ts(与后端 league-akari-server DTO 对齐的唯一事实来源)。
 */
import type { MatchDetail, MatchParticipant, MatchSummary } from '@/api/types'

/** 当前玩家 PUUID(mock 数据内 self 的标识键) */
export const MOCK_SELF_PUUID = 'mock-me'

/** 参与者中文名(10 人,模拟真实车队开黑名单) */
const NAMES = [
  '破晓之枪',
  '暗夜猎手',
  '风中追击',
  '峡谷之巅',
  '月下独酌',
  '霜之哀伤',
  '烈焰红唇',
  '沉默风暴',
  '疾风剑豪',
  '深海泰坦'
]

/** 位置顺序:上单/打野/中单/ADC/辅助 */
const POSITIONS = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']

/** 蓝方英雄 ID(Ashe/Yasuo/Yuumi/Kalista/Thresh) */
const BLUE_CHAMPS = [22, 157, 350, 429, 412]
/** 红方英雄 ID(Zed/Wukong/LeeSin/Karma/Corki) */
const RED_CHAMPS = [238, 60, 64, 25, 444]

/** 参与者统计入参:生成 statsJson 所需的核心统计 */
interface StatInput {
  kills: number
  deaths: number
  assists: number
  win: boolean
  gold: number
  damage: number
  taken: number
  cs: number
}

/**
 * 构造单个参与者的 statsJson(SGP 整体透传风格:统计与身份同层、嵌套 perks 对象)。
 * 适配层 parseStatsJson 直接解析该形状;字段缺失会被组件侧 ?? 兜底,这里给足常用字段。
 */
function buildStatsJson(index: number, stat: StatInput, teamId: number): string {
  const perSide = teamId === 100 ? 0 : 1
  // 蓝红双方用不同出装/技能,让装备行在两种胜负下视觉可区分
  const items = perSide === 0 ? [3153, 3031, 3072, 3006, 6672, 6673, 3340] : [6653, 3142, 3814, 3020, 6694, 3157, 3340]
  const spells = perSide === 0 ? [4, 7] : [4, 14]
  return JSON.stringify({
    participantId: index + 1,
    puuid: index === 0 ? MOCK_SELF_PUUID : `mock-p${index}`,
    riotIdGameName: NAMES[index],
    riotIdTagline: 'CN1',
    profileIcon: 23,
    championId: (teamId === 100 ? BLUE_CHAMPS : RED_CHAMPS)[index % 5],
    teamId,
    teamPosition: POSITIONS[index % 5],
    kills: stat.kills,
    deaths: stat.deaths,
    assists: stat.assists,
    win: stat.win,
    champLevel: 16 + (index % 3),
    summonerLevel: 120 + index * 3,
    item0: items[0],
    item1: items[1],
    item2: items[2],
    item3: items[3],
    item4: items[4],
    item5: items[5],
    item6: items[6],
    spell1Id: spells[0],
    spell2Id: spells[1],
    // 符文:SGP 嵌套形状(perkIds 直用),主系精密 + 副系巫术
    perks: { perkIds: [8010, 911, 9104, 8014, 9105, 9106], perkStyle: 8000, perkSubStyle: 8300 },
    totalDamageDealtToChampions: stat.damage,
    physicalDamageDealtToChampions: Math.round(stat.damage * 0.6),
    magicDamageDealtToChampions: Math.round(stat.damage * 0.3),
    trueDamageDealtToChampions: Math.round(stat.damage * 0.1),
    totalDamageTaken: stat.taken,
    physicalDamageTaken: Math.round(stat.taken * 0.5),
    magicalDamageTaken: Math.round(stat.taken * 0.4),
    trueDamageTaken: Math.round(stat.taken * 0.1),
    goldEarned: stat.gold,
    neutralMinionsKilled: Math.round(stat.cs * 0.15),
    totalMinionsKilled: stat.cs - Math.round(stat.cs * 0.15),
    totalHeal: 1200 + index * 100,
    visionScore: 18 + index * 2,
    wardsPlaced: 10 + (index % 8),
    turretKills: index % 3,
    timeCCingOthers: 12 + index,
    damageDealtToTurrets: 3000 + index * 250
  })
}

/**
 * 构造一局对局:生成 10 人参与者的摘要与详情(两套形状共享同一份统计),
 * self 恒为蓝方 1 号位;blueWin 控制蓝方(含 self)胜负。
 */
function buildMatch(gameId: number, seed: number, blueWin: boolean): { summary: MatchSummary; detail: MatchDetail } {
  const participants: MatchParticipant[] = []
  const summaries: MatchSummary['participants'] = []

  for (let i = 0; i < 10; i++) {
    const isBlue = i < 5
    const isSelf = i === 0
    // self 的 KDA 按剧本给固定值,其余玩家用种子伪随机铺开数据形态
    const kills = isSelf ? (blueWin ? 8 : 3) : 2 + ((i * 7 + seed) % 9)
    const deaths = isSelf ? (blueWin ? 3 : 8) : 2 + ((i * 5) % 7)
    const assists = isSelf ? (blueWin ? 7 : 4) : 1 + ((i * 3) % 11)
    const stat: StatInput = {
      kills,
      deaths,
      assists,
      win: isBlue ? blueWin : !blueWin,
      gold: 8000 + kills * 300 + assists * 150 + i * 420,
      damage: 12000 + kills * 800 + i * 650,
      taken: 9000 + deaths * 700 + i * 300,
      cs: 180 + i * 13
    }
    const teamId = isBlue ? 100 : 200
    const summonerName = `${NAMES[i]}#CN1`

    participants.push({
      id: i + 1,
      matchId: gameId,
      puuid: isSelf ? MOCK_SELF_PUUID : `mock-p${i}`,
      summonerName,
      championId: (isBlue ? BLUE_CHAMPS : RED_CHAMPS)[i % 5],
      teamId,
      position: POSITIONS[i % 5],
      kills,
      deaths,
      assists,
      win: stat.win,
      goldEarned: stat.gold,
      cs: stat.cs,
      items: JSON.stringify([3153, 3031, 3072, 3006, 6672, 6673, 3340]),
      summonerSpells: JSON.stringify([4, 7]),
      statsJson: buildStatsJson(i, stat, teamId)
    })

    // 列表摘要的轻量档案(MatchParticipantLight):直显字段,适配层负责归一
    summaries.push({
      puuid: participants[i].puuid,
      summonerName,
      championId: participants[i].championId,
      teamId,
      position: POSITIONS[i % 5],
      win: stat.win,
      kills,
      deaths,
      assists,
      items: [3153, 3031, 3072, 3006, 6672, 6673, 3340],
      summonerSpells: [4, 7],
      augments: null,
      perks: { perkIds: [8010, 911, 9104, 8014, 9105, 9106], perkStyle: 8000, perkSubStyle: 8300 },
      totalDamageDealtToChampions: stat.damage,
      totalDamageTaken: stat.taken,
      totalHeal: 1200 + i * 100,
      visionScore: 18 + i * 2,
      goldEarned: stat.gold,
      cs: stat.cs,
      turretKills: i % 3,
      wardsPlaced: 10 + (i % 8),
      timeCCingOthers: 12 + i,
      summonerLevel: 120 + i * 3,
      profileIcon: 23
    })
  }

  // self 视角的个人战绩与队伍聚合(侧栏总览统计消费)
  const me = participants[0]
  const blueTeam = participants.filter((p) => p.teamId === 100)
  const teamTotals = blueTeam.reduce(
    (acc, p) => ({
      kills: acc.kills + p.kills,
      gold: acc.gold + p.goldEarned,
      damage: acc.damage + p.kills * 900 + 12000,
      damageTaken: acc.damageTaken + p.deaths * 600 + 9000
    }),
    { kills: 0, gold: 0, damage: 0, damageTaken: 0 }
  )

  const summary: MatchSummary = {
    gameId,
    gameCreation: Date.now() - gameId * 8 * 3600 * 1000,
    gameDuration: 1860 + seed * 120,
    gameMode: 'CLASSIC',
    mapId: 11,
    queueId: 420,
    region: 'CN',
    winnerTeamId: blueWin ? 100 : 200,
    selfPuuid: MOCK_SELF_PUUID,
    self: {
      championId: me.championId,
      summonerName: me.summonerName,
      kills: me.kills,
      deaths: me.deaths,
      assists: me.assists,
      win: blueWin,
      totalDamage: 12000 + me.kills * 800,
      totalDamageTaken: 9000 + me.deaths * 700,
      goldEarned: me.goldEarned,
      cs: me.cs,
      largestMultiKill: 2,
      turretKills: 1,
      gameEndedInSurrender: !blueWin
    },
    teamTotals,
    teammates: participants.slice(1, 5).map((p) => ({
      puuid: p.puuid,
      summonerName: p.summonerName,
      championId: p.championId,
      win: blueWin
    })),
    participants: summaries,
    // MVP 归胜方 3 号位、ACE 归败方 7 号位(固定剧本,折叠卡徽章位置稳定)
    mvp: {
      participantId: 3,
      puuid: participants[2].puuid,
      summonerName: participants[2].summonerName,
      championId: participants[2].championId,
      score: 92.5,
      opScore: 9.3,
      grade: '完美'
    },
    ace: {
      participantId: 7,
      puuid: participants[6].puuid,
      summonerName: participants[6].summonerName,
      championId: participants[6].championId,
      score: 78,
      opScore: 7.8,
      grade: '优秀'
    }
  }

  // 详情:与摘要同一份参与者(展开/收起两态数据源一致,与真实懒加载行为对齐)
  const detail: MatchDetail = {
    gameId,
    gameCreation: summary.gameCreation,
    gameDuration: summary.gameDuration,
    gameMode: 'CLASSIC',
    gameType: 'MATCHED_GAME',
    queueId: 420,
    mapId: 11,
    gameVersion: '14.24.1',
    region: 'CN',
    rsoPlatformId: 'CN1',
    dataSource: 'lcu',
    winnerTeamId: blueWin ? 100 : 200,
    selfPuuid: MOCK_SELF_PUUID,
    teamsJson: null,
    participants,
    mvp: summary.mvp,
    ace: summary.ace,
    // 全员实时评分:TeamTable score 列消费(puuid → opScore/grade/维度明细)
    playerScores: Object.fromEntries(
      participants.map((p, i) => [
        p.puuid,
        {
          opScore: Number((10 - i * 0.6).toFixed(1)),
          grade: i === 0 ? '卓越' : i < 5 ? '优秀' : '一般',
          dimensions: {
            damage: { raw: 15000 + i * 800, score: 80 - i * 3 },
            kda: { raw: (p.kills + p.assists) / Math.max(1, p.deaths), score: 75 - i * 2 }
          }
        }
      ])
    )
  }

  return { summary, detail }
}

/** 3 局 mock:胜(MVP 剧本)/ 负(ACE 剧本)/ 胜,覆盖不同数据形态 */
export const MOCK_MATCHES = [buildMatch(7100001, 3, true), buildMatch(7100002, 5, false), buildMatch(7100003, 7, true)]

/** 列表折叠卡数据(3 局摘要) */
export const MOCK_SUMMARIES: MatchSummary[] = MOCK_MATCHES.map((m) => m.summary)

/** 按 gameId 取预构造详情(原型无后端,详情即点即展) */
export function getMockDetail(gameId: number): MatchDetail | undefined {
  return MOCK_MATCHES.find((m) => m.summary.gameId === gameId)?.detail
}

/** 顶部导航玩家信息(TopNavBar props 形状) */
export const MOCK_PLAYER = {
  name: '破晓之枪#CN1',
  profileIconId: 23,
  summonerLevel: 120
}

/** 顶部导航段位板块(TopNavBar props 形状,与生产 GameStatsView 的占位口径一致) */
export const MOCK_RANK_SECTIONS = [
  { queue: '单双排位', tier: '未定级', highestTier: '最高 未定级' },
  { queue: '灵活排位', tier: '未定级', highestTier: '最高 未定级' }
]
