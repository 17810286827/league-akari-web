/**
 * 时间线适配层测试（任务 6/15）
 * 覆盖：
 * - toMatchCardFrames：frames 数组原样透传、非数组输入返回空数组
 * - toMatchCardTimelineSeries：无 timestamp 帧跳过；字段缺失事件跳过（击杀无 position、
 *   加点无 participantId）；参与者帧数值字段兜底 0；damageStats/championStats 仅 SGP 透传
 * - toMatchCardEvents：仅保留击杀/特殊击杀/拆塔/镀层四类事件
 * - toMatchCardBuilds：加点序列 displayLevel（EVOLVE 不占序号）、30s 间隔 spacer、锻炉计数
 * - isMatchCardChampionKillEvent / isMatchCardDetailedParticipantFrame 判定
 */
import { describe, expect, it } from 'vitest'
import type {
  MatchCardTimelineEvent,
  MatchCardTimelineParticipantFrame
} from '../types'
import {
  isMatchCardChampionKillEvent,
  isMatchCardDetailedParticipantFrame,
  toMatchCardBuilds,
  toMatchCardEvents,
  toMatchCardFrames,
  toMatchCardTimelineSeries
} from '../match-card-timeline'

describe('toMatchCardFrames', () => {
  it('frames 数组原样透传（LCU 与 SGP 结构一致）', () => {
    const frames = [{ timestamp: 1000, events: [], participantFrames: {} }]
    expect(toMatchCardFrames(frames)).toEqual(frames)
  })

  it('非数组输入返回空数组（防御后端异常数据）', () => {
    expect(toMatchCardFrames(null)).toEqual([])
    expect(toMatchCardFrames({})).toEqual([])
  })
})

/** 最小合法帧：击杀事件（字段完整）+ 加点/购买事件 + 参与者帧 */
const minimalFrames = [
  {
    timestamp: 60000,
    events: [
      {
        type: 'CHAMPION_KILL',
        timestamp: 60000,
        killerId: 1,
        victimId: 2,
        assistingParticipantIds: [1],
        position: { x: 100, y: 200 }
      },
      { type: 'SKILL_LEVEL_UP', timestamp: 60000, participantId: 1, skillSlot: 1, levelUpType: 'NORMAL' },
      { type: 'ITEM_PURCHASED', timestamp: 60000, participantId: 1, itemId: 1001 }
    ],
    participantFrames: {
      '1': { participantId: 1, totalGold: 500 }
    }
  }
]

describe('toMatchCardTimelineSeries', () => {
  it('非数组输入返回空数组', () => {
    expect(toMatchCardTimelineSeries(null)).toEqual([])
    expect(toMatchCardTimelineSeries({})).toEqual([])
  })

  it('缺少 timestamp 的帧整帧跳过', () => {
    const series = toMatchCardTimelineSeries([{ events: [] }, { timestamp: 1000, events: [] }])
    expect(series).toHaveLength(1)
    expect(series[0].timestamp).toBe(1000)
  })

  it('字段缺失事件跳过：击杀无 position、加点无 participantId 均被丢弃', () => {
    const series = toMatchCardTimelineSeries([
      {
        timestamp: 60000,
        events: [
          // 击杀缺 position：跳过
          {
            type: 'CHAMPION_KILL',
            timestamp: 60000,
            killerId: 1,
            victimId: 2,
            assistingParticipantIds: []
          },
          // 加点缺 participantId：跳过
          { type: 'SKILL_LEVEL_UP', timestamp: 60000, skillSlot: 1 },
          // 合法击杀：保留
          {
            type: 'CHAMPION_KILL',
            timestamp: 60000,
            killerId: 1,
            victimId: 2,
            assistingParticipantIds: [],
            position: { x: 1, y: 2 }
          }
        ],
        participantFrames: {}
      }
    ])
    expect(series[0].events).toHaveLength(1)
    expect(series[0].events[0].type).toBe('CHAMPION_KILL')
  })

  it('参与者帧数值字段缺失兜底为 0；damageStats/championStats 仅存在时透传', () => {
    const series = toMatchCardTimelineSeries(minimalFrames)
    const frame = series[0].participantFrames['1']

    // totalGold 透传，缺失字段兜底 0
    expect(frame.totalGold).toBe(500)
    expect(frame.currentGold).toBe(0)
    expect(frame.minionsKilled).toBe(0)
    expect(frame.jungleMinionsKilled).toBe(0)
    // 无 SGP 专属字段 → undefined（isMatchCardDetailedParticipantFrame 判定不成立）
    expect(frame.damageStats).toBeUndefined()
    expect(isMatchCardDetailedParticipantFrame(frame)).toBe(false)

    const sgpSeries = toMatchCardTimelineSeries([
      {
        timestamp: 60000,
        events: [],
        participantFrames: {
          '1': {
            participantId: 1,
            championStats: { health: 100 },
            damageStats: { totalDamageTaken: 50 }
          }
        }
      }
    ])
    expect(isMatchCardDetailedParticipantFrame(sgpSeries[0].participantFrames['1'])).toBe(true)
  })
})

describe('toMatchCardEvents', () => {
  it('仅保留击杀/特殊击杀/拆塔/镀层四类事件（加点/购买/结束等其余事件剔除）', () => {
    const frames = [
      {
        timestamp: 60000,
        events: [
          {
            type: 'CHAMPION_KILL',
            timestamp: 60000,
            killerId: 1,
            victimId: 2,
            assistingParticipantIds: [],
            position: { x: 1, y: 2 }
          },
          { type: 'SKILL_LEVEL_UP', timestamp: 60000, participantId: 1, skillSlot: 1 },
          { type: 'ITEM_PURCHASED', timestamp: 60000, participantId: 1, itemId: 1001 }
        ],
        participantFrames: {}
      },
      {
        timestamp: 120000,
        events: [
          {
            type: 'CHAMPION_SPECIAL_KILL',
            timestamp: 120000,
            killerId: 1,
            killType: 'KILL_FIRST_BLOOD',
            position: { x: 1, y: 2 }
          },
          {
            type: 'BUILDING_KILL',
            timestamp: 120000,
            killerId: 1,
            buildingType: 'TOWER_BUILDING',
            position: { x: 1, y: 2 }
          },
          {
            type: 'TURRET_PLATE_DESTROYED',
            timestamp: 120000,
            killerId: 1,
            position: { x: 1, y: 2 }
          },
          { type: 'GAME_END', timestamp: 120000 }
        ],
        participantFrames: {}
      }
    ]

    const events = toMatchCardEvents(frames)
    expect(events.map((e) => e.type)).toEqual([
      'CHAMPION_KILL',
      'CHAMPION_SPECIAL_KILL',
      'BUILDING_KILL',
      'TURRET_PLATE_DESTROYED'
    ])
  })
})

describe('toMatchCardBuilds', () => {
  it('按选手分组加点序列并补全 displayLevel（EVOLVE 不占序号）', () => {
    const result = toMatchCardBuilds([
      {
        timestamp: 30000,
        events: [
          { type: 'SKILL_LEVEL_UP', timestamp: 30000, participantId: 1, skillSlot: 1, levelUpType: 'NORMAL' }
        ],
        participantFrames: {}
      },
      {
        timestamp: 90000,
        events: [
          { type: 'SKILL_LEVEL_UP', timestamp: 90000, participantId: 1, skillSlot: 4, levelUpType: 'NORMAL' },
          { type: 'SKILL_LEVEL_UP', timestamp: 90000, participantId: 1, skillSlot: 2, levelUpType: 'EVOLVE' },
          { type: 'SKILL_LEVEL_UP', timestamp: 90000, participantId: 1, skillSlot: 1, levelUpType: 'NORMAL' }
        ],
        participantFrames: {}
      }
    ])

    const upgrades = result.skillLevelUpEvents[1]
    expect(upgrades).toHaveLength(4)
    // displayLevel：普通加点按顺序 1/2/3，EVOLVE 不占序号（displayLevel 为 undefined）
    expect(upgrades.map((u) => u.displayLevel)).toEqual([1, 2, undefined, 3])
  })

  it('购买间隔超 30s 插入 spacer 分割；锻炉物品（6032/220000）计数', () => {
    const result = toMatchCardBuilds([
      {
        timestamp: 30000,
        events: [
          { type: 'ITEM_PURCHASED', timestamp: 30000, participantId: 1, itemId: 1001 },
          { type: 'ITEM_PURCHASED', timestamp: 30000, participantId: 1, itemId: 6032 }
        ],
        participantFrames: {}
      },
      {
        timestamp: 180000,
        events: [{ type: 'ITEM_PURCHASED', timestamp: 180000, participantId: 1, itemId: 220000 }],
        participantFrames: {}
      }
    ])

    // 30s 与 180s 间隔 150s > 30s → 第二件与第三件之间插入 spacer
    expect(result.itemPurchaseEvents[1].map((e) => e.type)).toEqual([
      'ITEM_PURCHASED',
      'ITEM_PURCHASED',
      'LEAGUE_AKARI_ITEM_SPACER',
      'ITEM_PURCHASED'
    ])
    // 6032 与 220000 均为锻炉物品 → 计数 2
    expect(result.anvils[1]).toBe(2)
  })

  it('无事件帧返回空分组（空对象，组件按空态展示）', () => {
    const result = toMatchCardBuilds([{ timestamp: 60000, events: [], participantFrames: {} }])
    expect(result.skillLevelUpEvents).toEqual({})
    expect(result.itemPurchaseEvents).toEqual({})
    expect(result.anvils).toEqual({})
  })
})

describe('事件/帧判定函数', () => {
  it('isMatchCardChampionKillEvent：携带伤害明细数组才算 SGP 击杀', () => {
    const killWithDamage = {
      type: 'CHAMPION_KILL' as const,
      timestamp: 60000,
      killerId: 1,
      victimId: 2,
      assistingParticipantIds: [],
      position: { x: 1, y: 2 },
      victimDamageReceived: []
    } satisfies MatchCardTimelineEvent
    expect(isMatchCardChampionKillEvent(killWithDamage)).toBe(true)

    // 无伤害明细的击杀（LCU/官方 API 形状）判定不成立
    expect(
      isMatchCardChampionKillEvent({
        type: 'CHAMPION_KILL',
        timestamp: 60000,
        killerId: 1,
        victimId: 2,
        assistingParticipantIds: [],
        position: { x: 1, y: 2 }
      } satisfies MatchCardTimelineEvent)
    ).toBe(false)

    // 非击杀事件判定不成立
    expect(
      isMatchCardChampionKillEvent({
        type: 'GAME_END',
        timestamp: 60000
      } satisfies MatchCardTimelineEvent)
    ).toBe(false)
  })

  it('isMatchCardDetailedParticipantFrame：damageStats/championStats 需同时存在', () => {
    expect(isMatchCardDetailedParticipantFrame(undefined)).toBe(false)
    expect(isMatchCardDetailedParticipantFrame(null)).toBe(false)
    expect(
      isMatchCardDetailedParticipantFrame({
        participantId: 1,
        currentGold: 0,
        totalGold: 0,
        goldPerSecond: 0,
        level: 1,
        xp: 0,
        minionsKilled: 0,
        jungleMinionsKilled: 0,
        position: { x: 0, y: 0 }
      } satisfies MatchCardTimelineParticipantFrame)
    ).toBe(false)
    expect(
      isMatchCardDetailedParticipantFrame({
        participantId: 1,
        currentGold: 0,
        totalGold: 0,
        goldPerSecond: 0,
        level: 1,
        xp: 0,
        minionsKilled: 0,
        jungleMinionsKilled: 0,
        position: { x: 0, y: 0 },
        // 判定只看字段存在性：内容不完整（如仅一个伤害字段）也视为 SGP 详细帧
        damageStats: { totalDamageTaken: 10 } as MatchCardTimelineParticipantFrame['damageStats'],
        championStats: { health: 100 } as MatchCardTimelineParticipantFrame['championStats']
      } satisfies MatchCardTimelineParticipantFrame)
    ).toBe(true)
  })
})
