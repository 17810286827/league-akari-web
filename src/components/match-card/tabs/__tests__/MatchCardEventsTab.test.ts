/**
 * MatchCardEventsTab 组件测试（任务 15）
 * 覆盖：Events 时间线渲染（击杀/一血/拆塔/镀层四类事件）、默认筛选（击杀+拆塔）下的
 * 事件可见性、勾选筛选器后特殊击杀/镀层事件出现、镀层统计面板（每人数量）、
 * 字段缺失事件（无 position）被适配层跳过不渲染、SGP 击杀事件携带伤害明细时
 * 「伤害明细」入口出现（isMatchCardChampionKillEvent 判定）
 * 组件经 provideMatchCard 提供 summary + details（真实 frames 结构），naive-ui 用 NConfigProvider 包裹
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { NConfigProvider } from 'naive-ui'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import type { MatchDetail, MatchParticipant } from '@/api/types'
import type { MatchCardGameDetails } from '@/views/match-detail/adapter/types'
import { provideMatchCard } from '../../context'
import MatchCardEventsTab from '../MatchCardEventsTab.vue'

// 局部 mock 数据层：英雄名固定（冠军表为 CDragon 网络请求，测试不触发）
vi.mock('@/utils/game-resource', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/game-resource')>()
  return {
    ...actual,
    getChampionName: vi.fn((id: number) => (id === 1 ? '菲奥娜' : '亚索'))
  }
})

/** 构造一名参赛者档案：statsJson 携带适配层消费的最小字段（participantId/win/子队） */
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
    ...partial
  }
}

/** 蓝队击杀者（菲奥娜）+ 红队被击杀者（亚索） */
const bluePlayer: MatchParticipant = makeParticipant({
  id: 1,
  puuid: 'blue-p1',
  summonerName: 'BlueOne#CN1',
  teamId: 100,
  championId: 1,
  statsJson: JSON.stringify({
    participantId: 1,
    playerSubteamId: 0,
    subteamPlacement: 1,
    win: true
  })
})
const redPlayer: MatchParticipant = makeParticipant({
  id: 2,
  puuid: 'red-p1',
  summonerName: 'RedOne#CN2',
  teamId: 200,
  championId: 2,
  statsJson: JSON.stringify({
    participantId: 2,
    playerSubteamId: 0,
    subteamPlacement: 1,
    win: false
  })
})

/** 对局详情：LCU 数据源 + 召唤师峡谷（MapPosition 支持的地图） */
const summary: MatchDetail = {
  gameId: 987654,
  gameCreation: 0,
  gameDuration: 1500,
  gameMode: 'CLASSIC',
  gameType: 'MATCHED_GAME',
  queueId: 420,
  mapId: 11,
  gameVersion: '14.10.1',
  region: 'CN',
  rsoPlatformId: 'CN1',
  dataSource: 'lcu',
  winnerTeamId: 100,
  selfPuuid: 'blue-p1',
  teamsJson: null,
  participants: [bluePlayer, redPlayer]
}

/**
 * 最小时间线 frames fixture（任务 15 简报指定：CHAMPION_KILL/ITEM_PURCHASED/
 * SKILL_LEVEL_UP 事件 + participantFrames 经济字段）：
 * 帧 1 击杀（带 SGP 伤害明细）；帧 2 一血/镀层/拆塔 + 一条字段缺失（无 position）的击杀；
 * 帧 3 GAME_END（firstAndEndTime 用真实结束时间）
 */
const frames = [
  {
    timestamp: 60000,
    events: [
      {
        type: 'CHAMPION_KILL',
        timestamp: 60000,
        killerId: 1,
        victimId: 2,
        assistingParticipantIds: [1],
        position: { x: 1000, y: 500 },
        bounty: 300,
        // SGP 伤害明细：isMatchCardChampionKillEvent 判定成立 → 「伤害明细」入口出现
        victimDamageReceived: [
          {
            basic: false,
            magicDamage: 100,
            name: 'BlueOne',
            participantId: 1,
            physicalDamage: 200,
            spellName: '',
            spellSlot: 0,
            trueDamage: 0,
            type: 'OTHER'
          }
        ]
      }
    ],
    participantFrames: {
      '1': { participantId: 1, currentGold: 100, totalGold: 500 },
      '2': { participantId: 2, currentGold: 50, totalGold: 300 }
    }
  },
  {
    timestamp: 120000,
    events: [
      {
        type: 'CHAMPION_SPECIAL_KILL',
        timestamp: 120000,
        killerId: 1,
        killType: 'KILL_FIRST_BLOOD',
        position: { x: 200, y: 300 }
      },
      {
        type: 'TURRET_PLATE_DESTROYED',
        timestamp: 120000,
        killerId: 1,
        laneType: 'MID_LANE',
        position: { x: 500, y: 600 }
      },
      {
        type: 'BUILDING_KILL',
        timestamp: 120000,
        killerId: 1,
        buildingType: 'TOWER_BUILDING',
        towerType: 'OUTER_TURRET',
        laneType: 'MID_LANE',
        position: { x: 700, y: 800 }
      },
      // 字段缺失事件（无 position）：适配层应跳过，不渲染、不崩溃
      {
        type: 'CHAMPION_KILL',
        timestamp: 120000,
        killerId: 1,
        victimId: 2,
        assistingParticipantIds: []
      }
    ],
    participantFrames: {
      '1': { participantId: 1, currentGold: 200, totalGold: 900 }
    }
  },
  {
    timestamp: 1500000,
    events: [{ type: 'GAME_END', timestamp: 1500000, winningTeam: 100 }],
    participantFrames: {}
  }
]

/** 对局时间线（details）：注入 { frames } 触发真实渲染路径 */
const details: MatchCardGameDetails = { frames }

/** 测试挂载壳：提供 match-card context（含 details）后渲染 EventsTab */
const Harness = defineComponent({
  setup() {
    provideMatchCard({ summary, puuid: 'blue-p1', details })
    return () => h(MatchCardEventsTab)
  }
})

/** 挂载 EventsTab：naive-ui 依赖 NConfigProvider */
async function mountEventsTab() {
  const wrapper = mount(
    () =>
      h(NConfigProvider, null, {
        default: () => h(Harness)
      }),
    { global: { stubs: { 'n-scrollbar': false } } }
  )
  await flushPromises()
  return wrapper
}

/** 点击筛选器勾选框（按文案定位 naive-ui NCheckbox），启用对应事件类型 */
async function enableFilter(wrapper: VueWrapper, label: string) {
  const checkbox = wrapper.findAll('.n-checkbox').find((c) => c.text().includes(label))
  expect(checkbox, `筛选器应包含「${label}」勾选项`).toBeTruthy()
  await checkbox!.trigger('click')
  await flushPromises()
}

describe('MatchCardEventsTab', () => {
  it('默认筛选（击杀+拆塔）渲染击杀与拆塔时间线项，特殊击杀/镀层项隐藏', async () => {
    const wrapper = await mountEventsTab()
    const text = wrapper.text()

    // 击杀项：事件类型文案 + 击杀动作文案 + 击杀者英雄名（participantMap 查询）
    expect(text).toContain('英雄击杀')
    expect(text).toContain('击杀')
    expect(text).toContain('菲奥娜')

    // 拆塔项：摧毁建筑 + 摧毁了 + 中路（laneType）+ 外防御塔（towerType）
    expect(text).toContain('摧毁建筑')
    expect(text).toContain('摧毁了')
    expect(text).toContain('中路')
    expect(text).toContain('外防御塔')

    // 开始/结束节点时间（firstAndEndTime：首帧 60000ms + GAME_END 1500000ms）
    expect(text).toContain('开始游戏')
    expect(text).toContain('结束游戏')

    // 默认未勾选特殊击杀/镀层：对应时间线项不渲染
    expect(text).not.toContain('第一滴血')
    expect(text).not.toContain('摧毁防御塔镀层')

    // NTimeline 项数量：开始 + 击杀 + 拆塔 + 结束 = 4
    expect(wrapper.findAll('.n-timeline-item')).toHaveLength(4)
  })

  it('勾选筛选器后一血/镀层事件出现；字段缺失事件（无 position）被跳过', async () => {
    const wrapper = await mountEventsTab()

    await enableFilter(wrapper, '特殊击杀')
    await enableFilter(wrapper, '防御塔镀层摧毁')

    const text = wrapper.text()
    // 一血（CHAMPION_SPECIAL_KILL KILL_FIRST_BLOOD）与镀层文案出现
    expect(text).toContain('第一滴血')
    expect(text).toContain('摧毁防御塔镀层')

    // NTimeline 项：开始 + 击杀 + 一血 + 镀层 + 拆塔 + 结束 = 6
    // 字段缺失（无 position）的击杀被适配层跳过：击杀仍只有 1 项（不崩溃、不重复）
    expect(wrapper.findAll('.n-timeline-item')).toHaveLength(6)
    expect(text).toContain('防御塔镀层统计')
    expect(text).toContain('1 层')
  })

  it('SGP 击杀事件携带伤害明细时渲染「伤害明细」入口', async () => {
    const wrapper = await mountEventsTab()
    // 帧 1 击杀带 victimDamageReceived → isMatchCardChampionKillEvent 成立
    expect(wrapper.text()).toContain('伤害明细')
  })

  it('按英雄筛选区渲染两名选手（英雄名来自 mock 冠军表）', async () => {
    const wrapper = await mountEventsTab()
    const text = wrapper.text()

    expect(text).toContain('按英雄筛选')
    expect(text).toContain('菲奥娜')
    expect(text).toContain('亚索')
  })
})
