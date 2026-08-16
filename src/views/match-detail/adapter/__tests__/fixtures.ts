/**
 * 参与者适配层测试 fixture（任务 5）
 * 双源构造：LCU 平铺 statsJson（stats 对象全量透传，同 Electron convert.ts 的 { ...p.stats }）
 * 与 SGP 整体透传（{...p}，统计与身份同层、含嵌套 perks/spell1Id）
 * 两队 5 人队总击杀均为 25（7+6+5+4+3），用于击杀参与率断言
 */
import type { MatchParticipant } from '@/api/types'

/**
 * 构造一名参赛者档案：直显字段与后端 MatchParticipant 一致
 * 未传字段使用默认值（0/false/null），测试只关注传入部分
 */
function makeParticipant(
  partial: Partial<MatchParticipant> & { puuid: string; summonerName: string; teamId: number }
): MatchParticipant {
  return {
    id: 1,
    matchId: 1,
    championId: 1,
    position: 'TOP',
    kills: 0,
    deaths: 0,
    assists: 0,
    win: true,
    goldEarned: 0,
    cs: 0,
    items: null,
    summonerSpells: null,
    statsJson: null,
    // 必传字段（puuid/summonerName/teamId）由调用方经 partial 覆盖
    ...partial
  }
}

/**
 * LCU 平铺 statsJson fixture：
 * 首名玩家带全量统计（强化/符文/多杀/出装/伤害），队友仅带击杀所需最小字段（顺带验证字段缺失兜底）
 * 注意：LCU 的 stats 对象不含 spell1Id/spell2Id/teamId（在参赛者顶层），需回退顶层字段
 */
export const lcuParticipantFixture: MatchParticipant[] = [
  makeParticipant({
    id: 1,
    puuid: 'lcu-p1',
    summonerName: 'PlayerOne#CN1',
    teamId: 100,
    position: 'TOP',
    kills: 7,
    deaths: 3,
    assists: 12,
    win: true,
    goldEarned: 12500,
    cs: 200,
    summonerSpells: '[4,12]',
    statsJson: JSON.stringify({
      // 击杀基础：KDA 与击杀参与率的分子数据
      kills: 7,
      deaths: 3,
      assists: 12,
      win: true,
      // 等级与身份（LCU stats 内含 participantId/playerSubteamId，无 teamId）
      champLevel: 15,
      participantId: 1,
      // 普通对局子队 ID 为 0（>0 才按 CHERRY 子队分组）
      playerSubteamId: 0,
      subteamPlacement: 1,
      // 海克斯强化（双源字段名一致）
      playerAugment1: 1,
      playerAugment2: 2,
      playerAugment3: 3,
      playerAugment4: 4,
      playerAugment5: 5,
      playerAugment6: 6,
      // 符文（LCU 平铺字段）
      perk0: 1,
      perk1: 2,
      perk2: 3,
      perk3: 4,
      perk4: 5,
      perk5: 6,
      perkPrimaryStyle: 8100,
      perkSubStyle: 8300,
      // 多杀
      doubleKills: 2,
      tripleKills: 1,
      quadraKills: 0,
      pentaKills: 0,
      // 出装 7 槽
      item0: 6653,
      item1: 3078,
      item2: 3031,
      item3: 3026,
      item4: 3074,
      item5: 3047,
      item6: 3340,
      // 伤害/承伤/治疗/金币/补刀/视野
      totalDamageDealtToChampions: 25000,
      goldEarned: 12500,
      goldSpent: 11800,
      physicalDamageDealtToChampions: 10000,
      magicDamageDealtToChampions: 9000,
      trueDamageDealtToChampions: 6000,
      totalDamageTaken: 30000,
      physicalDamageTaken: 15000,
      // LCU 字段名为 magicalDamageTaken（与 SGP 的 magicDamageTaken 不同）
      magicalDamageTaken: 12000,
      trueDamageTaken: 3000,
      totalMinionsKilled: 190,
      neutralMinionsKilled: 10,
      damageDealtToTurrets: 2500,
      totalHeal: 5000,
      visionScore: 20,
      timeCCingOthers: 40,
      gameEndedInEarlySurrender: false,
      gameEndedInSurrender: false,
      teamEarlySurrendered: false,
      roleBoundItem: 0,
      wardsPlaced: 15
    })
  }),
  // 队友：仅带击杀所需最小 stats 字段，凑齐队总击杀 25
  ...([
    ['lcu-p2', 'PlayerTwo#CN1', 6],
    ['lcu-p3', 'PlayerThree#CN1', 5],
    ['lcu-p4', 'PlayerFour#CN1', 4],
    ['lcu-p5', 'PlayerFive#CN1', 3]
  ] as Array<[string, string, number]>).map(([puuid, summonerName, kills], index) =>
    makeParticipant({
      id: index + 2,
      puuid,
      summonerName,
      teamId: 100,
      kills,
      summonerSpells: '[4,12]',
      statsJson: JSON.stringify({
        kills,
        deaths: 1,
        assists: 2,
        win: true,
        playerSubteamId: 0,
        participantId: index + 2
      })
    })
  )
]

/**
 * SGP 整体透传 statsJson fixture（{...p}）：
 * 统计与身份同层（含 spell1Id/teamId/puuid），嵌套 perks 为原版 SGP Perks 形状
 * （statPerks + styles，需派生为 perkIds/perkStyle/perkSubStyle），另含 ping 计数
 */
export const sgpParticipantFixture: MatchParticipant[] = [
  makeParticipant({
    id: 1,
    puuid: 'sgp-p1',
    summonerName: 'PlayerOne#SGP1',
    teamId: 100,
    position: 'TOP',
    kills: 7,
    deaths: 3,
    assists: 12,
    win: true,
    goldEarned: 12500,
    cs: 200,
    summonerSpells: null,
    statsJson: JSON.stringify({
      // 击杀基础与身份（SGP 与统计同层）
      kills: 7,
      deaths: 3,
      assists: 12,
      win: true,
      // 身份字段：SGP 透传自带，无需回退顶层
      puuid: 'sgp-p1',
      championId: 1,
      teamId: 100,
      riotIdGameName: 'PlayerOne',
      riotIdTagline: 'SGP1',
      profileIcon: 30,
      teamPosition: 'TOP',
      participantId: 1,
      playerSubteamId: 0,
      subteamPlacement: 1,
      champLevel: 15,
      // 海克斯强化
      playerAugment1: 1,
      playerAugment2: 2,
      playerAugment3: 3,
      playerAugment4: 4,
      playerAugment5: 5,
      playerAugment6: 6,
      // 召唤师技能（SGP 在 statsJson 顶层）
      spell1Id: 4,
      spell2Id: 12,
      // 多杀
      doubleKills: 2,
      tripleKills: 1,
      quadraKills: 0,
      pentaKills: 0,
      // 出装 7 槽
      item0: 6653,
      item1: 3078,
      item2: 3031,
      item3: 3026,
      item4: 3074,
      item5: 3047,
      item6: 3340,
      // SGP 嵌套 perks（原版 Perks 形状：statPerks + styles）
      perks: {
        statPerks: { offense: 8, flex: 6, defense: 10 },
        styles: [
          {
            description: 'primaryStyle',
            style: 8100,
            selections: [
              { perk: 1, var1: 0, var2: 0, var3: 0 },
              { perk: 2, var1: 0, var2: 0, var3: 0 },
              { perk: 3, var1: 0, var2: 0, var3: 0 },
              { perk: 4, var1: 0, var2: 0, var3: 0 }
            ]
          },
          {
            description: 'subStyle',
            style: 8300,
            selections: [
              { perk: 5, var1: 0, var2: 0, var3: 0 },
              { perk: 6, var1: 0, var2: 0, var3: 0 }
            ]
          }
        ]
      },
      // 伤害/承伤/金币/补刀/视野
      totalDamageDealtToChampions: 25000,
      goldEarned: 12500,
      goldSpent: 11800,
      totalMinionsKilled: 190,
      neutralMinionsKilled: 10,
      visionScore: 20,
      totalDamageTaken: 30000,
      physicalDamageTaken: 15000,
      magicDamageTaken: 12000,
      trueDamageTaken: 3000,
      damageDealtToTurrets: 2500,
      totalHeal: 5000,
      timeCCingOthers: 40,
      gameEndedInEarlySurrender: false,
      gameEndedInSurrender: false,
      teamEarlySurrendered: false,
      // ping 计数（SGP 独有）
      allInPings: 1,
      assistMePings: 2,
      basicPings: 3,
      commandPings: 4,
      dangerPings: 5,
      enemyMissingPings: 6,
      enemyVisionPings: 7,
      getBackPings: 8,
      holdPings: 9,
      needVisionPings: 10,
      onMyWayPings: 11,
      pushPings: 12,
      retreatPings: 13,
      visionClearedPings: 14
    })
  }),
  // 队友：仅带击杀所需最小字段，凑齐队总击杀 25
  ...([
    ['sgp-p2', 'PlayerTwo#SGP1', 6],
    ['sgp-p3', 'PlayerThree#SGP1', 5],
    ['sgp-p4', 'PlayerFour#SGP1', 4],
    ['sgp-p5', 'PlayerFive#SGP1', 3]
  ] as Array<[string, string, number]>).map(([puuid, summonerName, kills], index) =>
    makeParticipant({
      id: index + 2,
      puuid,
      summonerName,
      teamId: 100,
      kills,
      statsJson: JSON.stringify({
        kills,
        deaths: 1,
        assists: 2,
        win: true,
        teamId: 100,
        playerSubteamId: 0,
        participantId: index + 2
      })
    })
  )
]
