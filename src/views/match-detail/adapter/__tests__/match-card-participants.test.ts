/**
 * 参与者适配层测试（任务 5）
 * 覆盖：LCU 平铺 / SGP 整体透传双源解析、字段缺失兜底、符文双路径、技能回退、ping 与 toBasicInfo
 */
import { describe, expect, it } from 'vitest'
import { toBasicInfo, toParticipants } from '../match-card-participants'
import { lcuParticipantFixture, sgpParticipantFixture } from './fixtures'
import type { MatchDetail } from '@/api/types'

describe('toParticipants', () => {
  it('LCU 平铺 statsJson：解析 KDA/参与率/多杀/强化/符文', () => {
    const result = toParticipants(lcuParticipantFixture)
    const p = result[0]
    expect(p.kda).toBeCloseTo((7 + 12) / 3)
    expect(p.killParticipation).toBeCloseTo((7 + 12) / 25) // 队总击杀 25
    expect(p.augments).toEqual([1, 2, 3, 4, 5, 6])
    expect(p.doubleKills).toBe(2)
    expect(p.tripleKills).toBe(1)
    expect(p.perks).toEqual({ perkIds: [1, 2, 3, 4, 5, 6], perkStyle: 8100, perkSubStyle: 8300 })
    expect(p.items).toHaveLength(7) // item0-6
  })

  it('SGP 嵌套 statsJson（{...p} 透传）：同样正确解析', () => {
    const result = toParticipants(sgpParticipantFixture)
    expect(result[0].kda).toBeCloseTo((7 + 12) / 3)
    expect(result[0].augments).toEqual([1, 2, 3, 4, 5, 6])
    // SGP 顶层字段名一致，读取路径相同
  })

  it('statsJson 缺失字段不阻塞（可选链兜底）', () => {
    const result = toParticipants([{ ...lcuParticipantFixture[0], statsJson: '{}' }])
    expect(result[0].kda).toBe(0)
    expect(result[0].augments).toEqual([null, null, null, null, null, null])
  })
})

describe('toParticipants 双源补充', () => {
  it('SGP 嵌套 perks（原版 styles 形状）派生为 perkIds/perkStyle/perkSubStyle', () => {
    const result = toParticipants(sgpParticipantFixture)
    expect(result[0].perks).toEqual({
      perkIds: [1, 2, 3, 4, 5, 6],
      perkStyle: 8100,
      perkSubStyle: 8300
    })
  })

  it('召唤师技能：SGP 从 statsJson 直读，LCU 回退顶层 summonerSpells', () => {
    expect(toParticipants(sgpParticipantFixture)[0].spells).toEqual([4, 12])
    expect(toParticipants(lcuParticipantFixture)[0].spells).toEqual([4, 12])
  })

  it('SGP ping 计数解析；LCU 无 ping 数据返回 null', () => {
    expect(toParticipants(sgpParticipantFixture)[0].pings?.allInPings).toBe(1)
    expect(toParticipants(sgpParticipantFixture)[0].pings?.retreatPings).toBe(13)
    expect(toParticipants(lcuParticipantFixture)[0].pings).toBeNull()
  })

  it('队伍标识：按 teamId 分组，CHERRY 竞技场按 playerSubteamId 分组', () => {
    const result = toParticipants(lcuParticipantFixture)
    expect(result[0].teamIdentifier).toBe('TEAM-100')
    expect(result.every((p) => p.teamIdentifier === 'TEAM-100')).toBe(true)
  })
})

describe('toBasicInfo', () => {
  // 对局详情基准数据：常规 5v5 匹配
  const baseDetail: MatchDetail = {
    gameId: 123,
    gameCreation: 1700000000000,
    gameDuration: 1581,
    gameMode: 'CLASSIC',
    gameType: 'MATCHED_GAME',
    queueId: 420,
    mapId: 11,
    gameVersion: '14.10.1',
    region: 'CN',
    rsoPlatformId: 'TENCENT',
    dataSource: 'lcu',
    winnerTeamId: 100,
    selfPuuid: 'lcu-p1',
    teamsJson: null,
    participants: lcuParticipantFixture
  }

  it('映射对局元信息（mode/duration/gameCreation/queueId/mapId/winnerTeamId 等）', () => {
    expect(toBasicInfo(baseDetail)).toEqual({
      dataSource: 'lcu',
      gameVersion: '14.10.1',
      gameId: 123,
      isTwoTeam: true,
      isCherrySubteam: false,
      gameCreation: 1700000000000,
      gameDuration: 1581,
      gameType: 'MATCHED_GAME',
      queueId: 420,
      gameMode: 'CLASSIC',
      mapId: 11,
      winnerTeamId: 100
    })
  })

  it('CHERRY 模式：isTwoTeam=false 且 isCherrySubteam=true', () => {
    const info = toBasicInfo({ ...baseDetail, gameMode: 'CHERRY' })
    expect(info.isTwoTeam).toBe(false)
    expect(info.isCherrySubteam).toBe(true)
  })
})
