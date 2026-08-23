/**
 * 战绩分析页适配层单元测试：轻量摘要 → 折叠卡 MatchDetail 形状的字段归一
 * 重点覆盖：雷达图/伤害占比依赖的 totalDamageDealtToChampions 映射（任务 14 回归）
 */
import { describe, expect, it } from 'vitest'

import { summaryToDetail } from '../adapter'
import type { MatchParticipantLight, MatchSummary } from '@/api/types'

/** 构造最小摘要 fixture：仅 1 名参与者，聚焦字段归一逻辑 */
function makeSummary(participants: MatchParticipantLight[], mapId?: number): MatchSummary {
  return {
    gameId: 123,
    gameCreation: 0,
    gameDuration: 1800,
    gameMode: 'CLASSIC',
    mapId,
    queueId: 420,
    region: 'CN',
    winnerTeamId: 100,
    selfPuuid: 'p1',
    self: null,
    teamTotals: null,
    teammates: [],
    participants
  }
}

/** 构造轻量参与者：默认带全量统计字段，可覆盖 */
function makeLight(partial: Partial<MatchParticipantLight>): MatchParticipantLight {
  return {
    puuid: 'p1',
    summonerName: 'PlayerOne#CN1',
    championId: 1,
    teamId: 100,
    position: 'TOP',
    win: true,
    kills: 7,
    deaths: 3,
    assists: 12,
    items: [6653, 3078, 3031, 3026, 3074, 3047, 3340],
    summonerSpells: [4, 12],
    augments: [null, null, null, null, null, null],
    perks: { perkIds: [1, 2, 3, 4, 5, 6], perkStyle: 8100, perkSubStyle: 8300 },
    totalDamageDealtToChampions: 25472,
    totalDamageTaken: 33200,
    totalHeal: 9200,
    visionScore: 42,
    goldEarned: 12800,
    cs: 210,
    turretKills: 3,
    wardsPlaced: 16,
    // 成就标签字段（多杀/拆塔/单杀等，折叠卡 ManyTags 使用）
    totalDamageToTowers: 4600,
    doubleKills: 5,
    tripleKills: 1,
    quadraKills: 1,
    pentaKills: 0,
    totalDamageShieldedOnTeammates: 1200,
    timeCCingOthers: 30,
    soloKills: 3,
    killsNearEnemyTurret: 5,
    killsUnderOwnTurret: 2,
    maxCsAdvantageOnLaneOpponent: 42,
    knockEnemyIntoTeamAndKill: 7,
    ...partial
  }
}

/**
 * 解析首个参与者的 statsJson：summaryToDetail 的产物总会为参与者写入 statsJson 字符串
 * （见 adapter 实现），此处用非空断言把 string | null 收窄为 string——仅类型层面收窄，无运行时差异
 */
function parseFirstStatsJson(detail: ReturnType<typeof summaryToDetail>): Record<string, unknown> {
  return JSON.parse(detail.participants[0].statsJson!) as Record<string, unknown>
}

describe('summaryToDetail 字段归一', () => {
  it('将轻量档案的 totalDamageDealtToChampions 写入 statsJson（雷达图伤害轴数据源）', () => {
    const detail = summaryToDetail(makeSummary([makeLight({})]))

    const stats = parseFirstStatsJson(detail)
    expect(stats.totalDamageDealtToChampions).toBe(25472)
    // 同批统计字段一并归一，防止回归
    expect(stats.totalDamageTaken).toBe(33200)
    expect(stats.totalHeal).toBe(9200)
    expect(stats.goldEarned).toBe(12800)
    expect(stats.totalMinionsKilled).toBe(210)
  })

  it('将成就标签字段写入 statsJson：多杀/拆塔走顶层，单杀/塔杀走 challenges 嵌套', () => {
    const detail = summaryToDetail(makeSummary([makeLight({})]))

    const stats = parseFirstStatsJson(detail)
    // 顶层字段（ManyTags 直接消费）；拆塔键名对齐 statsJson 的 damageDealtToTurrets
    expect(stats.damageDealtToTurrets).toBe(4600)
    expect(stats.doubleKills).toBe(5)
    expect(stats.tripleKills).toBe(1)
    expect(stats.quadraKills).toBe(1)
    expect(stats.pentaKills).toBe(0)
    expect(stats.totalDamageShieldedOnTeammates).toBe(1200)
    expect(stats.timeCCingOthers).toBe(30)
    // challenges 嵌套（toParticipants 从 stats.challenges 读取）
    expect(stats.challenges).toEqual({
      soloKills: 3,
      killsNearEnemyTurret: 5,
      killsUnderOwnTurret: 2,
      maxCsAdvantageOnLaneOpponent: 42,
      knockEnemyIntoTeamAndKill: 7
    })
  })

  it('后端未升级（伤害字段缺失）时不写入 statsJson，由组件侧兜底为 0', () => {
    const light = makeLight({})
    delete light.totalDamageDealtToChampions

    const detail = summaryToDetail(makeSummary([light]))
    const stats = parseFirstStatsJson(detail)

    expect(stats.totalDamageDealtToChampions).toBeUndefined()
  })

  it('challenges 字段全部缺失时不写 challenges 嵌套（组件侧按 null 兜底）', () => {
    const light = makeLight({})
    delete light.soloKills
    delete light.killsNearEnemyTurret
    delete light.killsUnderOwnTurret
    delete light.maxCsAdvantageOnLaneOpponent
    delete light.knockEnemyIntoTeamAndKill

    const detail = summaryToDetail(makeSummary([light]))
    const stats = parseFirstStatsJson(detail)

    expect(stats.challenges).toBeUndefined()
  })

  it('mapId 优先后端真实值；缺失时按游戏模式兜底（KIWI→12，未收录→11）', () => {
    // 后端已升级：真实 mapId 优先
    expect(summaryToDetail(makeSummary([makeLight({})], 12)).mapId).toBe(12)
    // 后端未升级：KIWI 兜底 12（与详情真实地图一致），CLASSIC 兜底 11
    const kiwi = makeSummary([makeLight({})])
    kiwi.gameMode = 'KIWI'
    delete kiwi.mapId
    expect(summaryToDetail(kiwi).mapId).toBe(12)
    const classic = makeSummary([makeLight({})])
    delete classic.mapId
    expect(summaryToDetail(classic).mapId).toBe(11)
  })

  it('MVP/SVP 称号透传：折叠卡据此给聚焦玩家挂奖杯图标；未评选时兜底 null', () => {
    // 后端已升级且已评选：mvp/svp 原样透传（引用不变）
    const withAwards = makeSummary([makeLight({})])
    const mvp = { participantId: 1, puuid: 'p1', summonerName: 'PlayerOne', championId: 1, score: 92.5 }
    const svp = { participantId: 2, puuid: 'p2', summonerName: 'PlayerTwo', championId: 2, score: 85 }
    withAwards.mvp = mvp
    withAwards.svp = svp
    const detail1 = summaryToDetail(withAwards)
    expect(detail1.mvp).toBe(mvp)
    expect(detail1.svp).toBe(svp)

    // 后端未升级/未评选（字段缺失）：兜底 null（组件侧不渲染图标）
    const detail2 = summaryToDetail(makeSummary([makeLight({})]))
    expect(detail2.mvp).toBeNull()
    expect(detail2.svp).toBeNull()
  })
})
