/**
 * ReplayPanel 组件测试（工单 #35：时间线复盘）：
 * 覆盖正常路径（曲线数据集组装：折线 + 敌我击杀散点 + 转折点散点/列表）、
 * 无时间线降级（available=false 显示提示不渲染曲线）、加载失败空态。
 * chart.js 的 Line 组件以模块级 mock 替换（jsdom 无 canvas，断言聚焦 data prop）。
 */
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import type { MatchReplay } from '@/api/types'
import ReplayPanel from '../ReplayPanel.vue'

// mock 数据层：只替换 getMatchReplay
vi.mock('@/api/matches', () => ({
  getMatchReplay: vi.fn()
}))

// vue-chartjs 整体 mock（jsdom 无 canvas 2d 上下文，断言聚焦数据 prop 传入）
vi.mock('vue-chartjs', async () => {
  const vue = await import('vue')
  return {
    Line: vue.defineComponent({
      name: 'Line',
      props: ['data', 'options'],
      template: '<div class="line-stub" :data-datasets="data.datasets.length" />'
    })
  }
})

import { getMatchReplay } from '@/api/matches'

/** 构造可用复盘夹具：两帧曲线 + 敌我各一次击杀 + 一血/反超两个转折点 */
function availableFixture(): MatchReplay {
  return {
    available: true,
    perspectiveTeamId: 100,
    goldDiffSeries: [
      { timestampMs: 60_000, goldDiff: 2000 },
      { timestampMs: 120_000, goldDiff: -1000 }
    ],
    killEvents: [
      {
        timestampMs: 65_000,
        killerName: '玩家一',
        killerChampion: '阿狸',
        victimName: '玩家二',
        victimChampion: '锐雯',
        killerIsPerspective: true
      },
      {
        timestampMs: 125_000,
        killerName: '玩家二',
        killerChampion: '锐雯',
        victimName: '玩家一',
        victimChampion: '阿狸',
        killerIsPerspective: false
      }
    ],
    turningPoints: [
      {
        type: 'FIRST_BLOOD',
        timestampMs: 65_000,
        goldDiff: 2000,
        title: '一血',
        detail: '我方 阿狸 击杀 玩家二',
        involved: []
      },
      {
        type: 'GOLD_LEAD_CHANGE',
        timestampMs: 120_000,
        goldDiff: -1000,
        title: '经济反超',
        detail: '我方被反超，落后 1000 金币',
        involved: []
      }
    ]
  }
}

describe('ReplayPanel', () => {
  it('正常路径：渲染曲线与转折点列表，数据集含折线/敌我击杀/转折点', async () => {
    vi.mocked(getMatchReplay).mockResolvedValue(availableFixture())

    const wrapper = mount(ReplayPanel, { props: { gameId: 123 } })
    await flushPromises()

    // 请求打到复盘端点
    expect(getMatchReplay).toHaveBeenCalledWith(123)
    // 曲线与列表渲染
    expect(wrapper.find('[data-testid="replay-chart"]').exists()).toBe(true)
    const points = wrapper.findAll('[data-testid^="replay-turning-point-"]')
    expect(points).toHaveLength(2)
    expect(points[0].text()).toContain('一血')
    expect(points[0].text()).toContain('我方 阿狸 击杀 玩家二')
    expect(points[1].text()).toContain('经济反超')
    expect(points[1].text()).toContain('被反超')
  })

  it('无时间线降级：available=false 显示提示与时长简要信息，不渲染曲线', async () => {
    vi.mocked(getMatchReplay).mockResolvedValue({
      available: false,
      perspectiveTeamId: 100,
      goldDiffSeries: [],
      killEvents: [],
      turningPoints: []
    })

    const wrapper = mount(ReplayPanel, {
      props: { gameId: 123, durationSeconds: 1830 }
    })
    await flushPromises()

    expect(wrapper.find('[data-testid="replay-unavailable"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="replay-unavailable"]').text()).toContain('没有时间线数据')
    // stats 简要信息：对局时长（spec 要求降级分支带简要统计）
    expect(wrapper.find('[data-testid="replay-unavailable"]').text()).toContain('30 分 30 秒')
    expect(wrapper.find('[data-testid="replay-chart"]').exists()).toBe(false)
  })

  it('点击转折点列表项：切换选中高亮（再次点击取消）', async () => {
    vi.mocked(getMatchReplay).mockResolvedValue(availableFixture())

    const wrapper = mount(ReplayPanel, { props: { gameId: 123 } })
    await flushPromises()

    const first = wrapper.find('[data-testid="replay-turning-point-0"]')
    await first.trigger('click')
    expect(first.classes()).toContain('opacity-100')
    // 再次点击取消选中
    await first.trigger('click')
    expect(first.classes()).not.toContain('opacity-100')
  })

  it('加载失败：显示失败空态，不影响面板框架', async () => {
    vi.mocked(getMatchReplay).mockRejectedValue(new Error('后端未启动'))

    const wrapper = mount(ReplayPanel, { props: { gameId: 123 } })
    await flushPromises()

    expect(wrapper.find('[data-testid="replay-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="replay-chart"]').exists()).toBe(false)
  })
})
