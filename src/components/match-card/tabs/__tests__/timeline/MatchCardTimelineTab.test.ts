/**
 * MatchCardTimelineTab 组件测试（任务 15）
 * 覆盖：lcU 数据源仅渲染差距线图表（Line 组件收到 labels/玩家/队伍平均数据集——
 * 经济字段来自 participantFrames）；sgp 数据源渲染「差距线图表/属性时间线」子 Tab，
 * 切换到属性时间线后渲染选手属性网格（championStats 消费）；
 * chart.js 的 Line 组件以 stub 替换（jsdom 无 canvas，且断言聚焦于数据 prop 传入）
 */
import { flushPromises, mount } from '@vue/test-utils'
import { NConfigProvider } from 'naive-ui'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import type { MatchDetail, MatchParticipant } from '@/api/types'
import type { MatchCardGameDetails } from '@/views/match-detail/adapter/types'
import { provideMatchCard } from '../../../context'
import MatchCardTimelineTab from '../../timeline/MatchCardTimelineTab.vue'

// 局部 mock 数据层：英雄名固定（冠军表为 CDragon 网络请求，测试不触发）
vi.mock('@/utils/game-resource', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/game-resource')>()
  return {
    ...actual,
    getChampionName: vi.fn(() => '菲奥娜')
  }
})

// chart.js Line 组件整体 mock（jsdom 无 canvas 2d 上下文，且断言聚焦于数据 prop 传入）：
// vue-chartjs 的 Line 无 name 属性，无法按组件名 stub，改用模块级 mock
vi.mock('vue-chartjs', async () => {
  const vue = await import('vue')
  return {
    Line: vue.defineComponent({
      name: 'Line',
      props: ['data', 'options'],
      template: '<div class="line-stub" />'
    })
  }
})

/** 构造一名参赛者档案（statsJson 携带适配层消费的最小字段） */
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

/** 蓝队选手（participantId 1）+ 红队选手（participantId 2） */
const bluePlayer: MatchParticipant = makeParticipant({
  id: 1,
  puuid: 'blue-p1',
  summonerName: 'BlueOne#CN1',
  teamId: 100,
  championId: 1,
  statsJson: JSON.stringify({ participantId: 1, playerSubteamId: 0, subteamPlacement: 1, win: true })
})
const redPlayer: MatchParticipant = makeParticipant({
  id: 2,
  puuid: 'red-p1',
  summonerName: 'RedOne#CN2',
  teamId: 200,
  championId: 2,
  statsJson: JSON.stringify({ participantId: 2, playerSubteamId: 0, subteamPlacement: 1, win: false })
})

/** 按数据源构造对局详情（lcU 仅差距线图表；sgp 多属性时间线子 Tab） */
function makeSummary(dataSource: 'lcu' | 'sgp'): MatchDetail {
  return {
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
    dataSource,
    winnerTeamId: 100,
    selfPuuid: 'blue-p1',
    teamsJson: null,
    participants: [bluePlayer, redPlayer]
  }
}

/** SGP 完整英雄属性（StatsLine 消费，字段对齐原版 ChampionStats） */
const championStats = {
  abilityHaste: 10,
  abilityPower: 20,
  armor: 30,
  armorPen: 0,
  armorPenPercent: 0,
  attackDamage: 70,
  attackSpeed: 0.8,
  bonusArmorPenPercent: 0,
  bonusMagicPenPercent: 0,
  ccReduction: 0,
  cooldownReduction: 0,
  health: 1000,
  healthMax: 1000,
  healthRegen: 8,
  lifesteal: 8,
  magicPen: 0,
  magicPenPercent: 0,
  magicResist: 32,
  movementSpeed: 340,
  omnivamp: 0,
  physicalVamp: 0,
  power: 500,
  powerMax: 500,
  powerRegen: 15,
  spellVamp: 0
}

/** 最小 frames fixture：两帧，participantFrames 携带经济字段（总金币/补刀/经验） */
const frames = [
  {
    timestamp: 60000,
    events: [],
    participantFrames: {
      '1': {
        participantId: 1,
        currentGold: 100,
        totalGold: 500,
        goldPerSecond: 1,
        level: 2,
        xp: 300,
        minionsKilled: 10,
        jungleMinionsKilled: 2,
        position: { x: 100, y: 200 },
        championStats,
        damageStats: { totalDamageDoneToChampions: 1000, totalDamageTaken: 500 }
      },
      '2': {
        participantId: 2,
        currentGold: 50,
        totalGold: 400,
        goldPerSecond: 1,
        level: 2,
        xp: 280,
        minionsKilled: 8,
        jungleMinionsKilled: 1,
        position: { x: 300, y: 400 }
      }
    }
  },
  {
    timestamp: 120000,
    events: [],
    participantFrames: {
      '1': {
        participantId: 1,
        currentGold: 200,
        totalGold: 800,
        goldPerSecond: 1,
        level: 3,
        xp: 600,
        minionsKilled: 20,
        jungleMinionsKilled: 3,
        position: { x: 100, y: 200 },
        championStats,
        damageStats: { totalDamageDoneToChampions: 2000, totalDamageTaken: 900 }
      },
      '2': {
        participantId: 2,
        currentGold: 100,
        totalGold: 600,
        goldPerSecond: 1,
        level: 3,
        xp: 500,
        minionsKilled: 15,
        jungleMinionsKilled: 2,
        position: { x: 300, y: 400 }
      }
    }
  }
]

/** 对局时间线（details）：注入 { frames } 触发真实渲染路径 */
const details: MatchCardGameDetails = { frames }

/** 测试挂载壳：提供 match-card context（含 details）后渲染 TimelineTab */
function makeHarness(summary: MatchDetail) {
  return defineComponent({
    setup() {
      provideMatchCard({ summary, puuid: 'blue-p1', details })
      return () => h(MatchCardTimelineTab)
    }
  })
}

/** 挂载 TimelineTab：Line 以模块 mock 替换（jsdom 无 canvas），naive-ui 用 NConfigProvider 包裹 */
async function mountTimelineTab(summary: MatchDetail) {
  const wrapper = mount(
    () =>
      h(NConfigProvider, null, {
        default: () => h(makeHarness(summary))
      }),
    { global: { stubs: { 'n-scrollbar': false } } }
  )
  await flushPromises()
  return wrapper
}

describe('MatchCardTimelineTab', () => {
  it('lcU 数据源：渲染差距线图表，Line 收到 labels 与玩家/队伍平均数据集', async () => {
    const wrapper = await mountTimelineTab(makeSummary('lcu'))

    // lcU 无「属性时间线」子 Tab（stats-line 仅 sgp 支持）
    expect(wrapper.text()).not.toContain('属性时间线')

    // Line mock 收到图表数据 prop（时间点标签 + 玩家/队伍数据集）
    const line = wrapper.findComponent({ name: 'Line' })
    expect(line.exists()).toBe(true)
    const data = line.props('data') as {
      labels: string[]
      datasets: { label: string; data: number[]; hidden: boolean }[]
    }

    // 时间点标签：每帧一个（60000ms → 1min / 120000ms → 2min）
    expect(data.labels).toEqual(['1min', '2min'])

    // 数据集：2 名玩家 + 2 支队伍平均 = 4 条
    expect(data.datasets).toHaveLength(4)

    // 玩家 1 金币曲线（participantFrames 经济字段消费）
    expect(data.datasets[0].label).toBe('BlueOne #CN1')
    expect(data.datasets[0].data).toEqual([500, 800])
    // 玩家默认未选中 → hidden（原版默认行为：全选由「全选」勾选控制）
    expect(data.datasets[0].hidden).toBe(true)

    // 队伍平均：蓝队仅 1 名选手（TEAM-100），均值即其金币 [500, 800]，默认全选可见
    expect(data.datasets[2].label).toBe('蓝队平均')
    expect(data.datasets[2].data).toEqual([500, 800])
    expect(data.datasets[2].hidden).toBe(false)
  })

  it('sgp 数据源：渲染差距线/属性时间线子 Tab，切换后渲染选手属性网格', async () => {
    const wrapper = await mountTimelineTab(makeSummary('sgp'))

    // 子 Tab 出现（差距线图表 + 属性时间线）
    expect(wrapper.text()).toContain('差距线图表')
    expect(wrapper.text()).toContain('属性时间线')

    // 切换到属性时间线：选手属性网格渲染（championStats 消费 + 数据源提示文案）
    const statsTab = wrapper.findAll('.n-tabs-tab').find((t) => t.text().includes('属性时间线'))
    expect(statsTab).toBeTruthy()
    await statsTab!.trigger('click')
    await flushPromises()

    const text = wrapper.text()
    expect(text).toContain('生命值')
    expect(text).toContain('1000 / 1000')
    expect(text).toContain('攻击力')
    expect(text).toContain('此为服务器返回之数据')
  })
})
