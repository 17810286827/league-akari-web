/**
 * 队伍适配层测试（任务 6）
 * 覆盖：teamsJson 解析塔/水晶/龙/男爵/先锋/巢虫/阿塔坎计数、
 * teamStatMap key 为字符串 teamId、老数据巢虫/阿塔坎缺失按 0、非法输入容错
 */
import { describe, expect, it } from 'vitest'
import { toTeams } from '../match-card-teams'

describe('toTeams', () => {
  it('teamsJson 解析塔/水晶/龙/男爵/先锋/巢虫/阿塔坎计数', () => {
    const teams = toTeams(
      JSON.stringify([
        { teamId: 100, towerKills: 11, inhibitorKills: 2, dragonKills: 3, baronKills: 1, riftHeraldKills: 1, voidGrubKills: 4, atakhanKills: 0, firstBlood: true }
      ])
    )
    expect(teams.teamStatMap['100'].towerKills).toBe(11)
    expect(teams.teamStatMap['100'].voidGrubKills).toBe(4) // 老数据缺失按 0
  })

  it('teamStatMap 以字符串 teamId 为 key，多队各自映射', () => {
    const teams = toTeams(
      JSON.stringify([
        { teamId: 100, towerKills: 11, dragonKills: 3 },
        { teamId: 200, towerKills: 3, dragonKills: 2 }
      ])
    )
    expect(Object.keys(teams.teamStatMap)).toEqual(['100', '200'])
    expect(teams.teamStatMap['200'].dragonKills).toBe(2)
  })

  it('voidGrubKills/atakhanKills 缺失按 0（老 LCU 数据无巢虫/阿塔坎字段）', () => {
    const teams = toTeams(
      JSON.stringify([
        { teamId: 100, towerKills: 11, inhibitorKills: 2, dragonKills: 3, baronKills: 1, riftHeraldKills: 1 }
      ])
    )
    expect(teams.teamStatMap['100'].voidGrubKills).toBe(0)
    expect(teams.teamStatMap['100'].atakhanKills).toBe(0)
  })

  it('teamsJson 为 null / 非法 JSON / 非数组时返回空 teamStatMap（不阻塞展示）', () => {
    expect(toTeams(null).teamStatMap).toEqual({})
    expect(toTeams('not-json').teamStatMap).toEqual({})
    expect(toTeams('{}').teamStatMap).toEqual({})
  })
})
