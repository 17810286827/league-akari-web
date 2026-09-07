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
  getMatchReplay: vi.fn(),
  streamReplayComment: vi.fn()
}))

// vue-chartjs 整体 mock（jsdom 无 canvas 2d 上下文，断言聚焦 data/options prop 传入）
vi.mock('vue-chartjs', async () => {
  const vue = await import('vue')
  return {
    Line: vue.defineComponent({
      name: 'Line',
      props: ['data', 'options'],
      // 暴露数据点与轴类型属性：供断言散点时间戳定位与线性时间轴配置
      template: `<div class="line-stub"
        :data-datasets="data.datasets.length"
        :data-line-points="JSON.stringify(data.datasets[0].data)"
        :data-kill-points="JSON.stringify(data.datasets[1].data)"
        :data-turning-points="JSON.stringify(data.datasets[3].data)"
        :data-x-axis-type="options.scales.x.type"
        :data-x-axis-max="options.scales.x.max"
      />`
    })
  }
})

import { getMatchReplay, streamReplayComment } from '@/api/matches'

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
        killerChampionId: 103,
        victimName: '玩家二',
        victimChampion: '锐雯',
        victimChampionId: 92,
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
        involved: [
          { name: '玩家一', championName: '阿狸', championId: 103, perspective: true },
          { name: '玩家二', championName: '锐雯', perspective: false }
        ]
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

  it('x 轴为线性时间轴：折线与散点均以 timestampMs 定位，不再有重复分类标签', async () => {
    // 渲染修复（2026-09-07）：原实现 x 轴为分类轴（"N分"标签重复）且散点用帧索引，
    // 触发 tooltip 泄露原始 x/y/_info 与坐标错位。改为 linear 时间轴后：
    // 折线/散点统一用 timestampMs 定位，刻度回调格式化为 mm:ss
    vi.mocked(getMatchReplay).mockResolvedValue(availableFixture())

    const wrapper = mount(ReplayPanel, { props: { gameId: 123 } })
    await flushPromises()

    const chart = wrapper.find('.line-stub')
    // x 轴类型：linear（时间毫秒数值轴）
    expect(chart.attributes('data-x-axis-type')).toBe('linear')
    // 异步加载完成后，x 轴范围必须跟随末帧（不能在初始 replay=null 时固定为 0）
    expect(chart.attributes('data-x-axis-max')).toBe('120000')
    // 折线数据点：{x: timestampMs, y: goldDiff}（不再是纯数字数组配分类标签）
    const linePoints = JSON.parse(chart.attributes('data-line-points')!)
    expect(linePoints).toEqual([
      { x: 60_000, y: 2000 },
      { x: 120_000, y: -1000 }
    ])
    // 击杀散点：x 直接用事件 timestampMs（65s 的击杀定位在 65s，不是帧索引）
    const killPoints = JSON.parse(chart.attributes('data-kill-points')!)
    expect(killPoints[0].x).toBe(65_000)
    expect(killPoints[0].y).toBe(2000)
    // 转折点散点：同样 timestampMs 定位（65s 一血 / 120s 反超）
    const turningPoints = JSON.parse(chart.attributes('data-turning-points')!)
    expect(turningPoints[0].x).toBe(65_000)
    expect(turningPoints[1].x).toBe(120_000)
  })

  it('转折点涉及成员渲染英雄头像，缺失 ID 回退文字', async () => {
    vi.mocked(getMatchReplay).mockResolvedValue(availableFixture())

    const wrapper = mount(ReplayPanel, { props: { gameId: 123 } })
    await flushPromises()

    // 一血 involved：玩家一带 championId → 头像；玩家二缺失 → 回退文字（中文名仍在）
    expect(wrapper.find('[data-testid="champion-avatar-玩家一"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="champion-avatar-玩家一"]').attributes('src')).toContain('103')
    expect(wrapper.find('[data-testid="champion-avatar-玩家二"]').exists()).toBe(false)
    const firstBlood = wrapper.find('[data-testid="replay-turning-point-0"]')
    expect(firstBlood.text()).toContain('玩家二')
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
    expect(wrapper.find('[data-testid="replay-unavailable"]').text()).toContain('暂未采集到时间线数据')
    // 文案修正（2026-09-07）：不再断言"历史回填的对局普遍缺失"——新对局也可能因
    // 桌面端推送失败而暂时缺失（自动补推机制已上线），旧文案对新对局有误导性
    expect(wrapper.find('[data-testid="replay-unavailable"]').text()).not.toContain('历史回填')
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

  /** 用例（工单 #40）：AI 复盘按钮——点击触发 SSE，叙述打字机渲染，失败降级 */
  it('AI 复盘叙述：点击按钮流式渲染正文，开流前失败降级提示', async () => {
    vi.mocked(getMatchReplay).mockResolvedValue(availableFixture())
    // SSE 回放：start 后两个 chunk
    vi.mocked(streamReplayComment).mockImplementation(async (_gameId, handlers = {}) => {
      handlers.onChunk?.('这局胜负手在')
      handlers.onChunk?.('中期被反超')
    })

    const wrapper = mount(ReplayPanel, { props: { gameId: 123 } })
    await flushPromises()

    await wrapper.find('[data-testid="replay-ai-button"]').trigger('click')
    await flushPromises()

    expect(streamReplayComment).toHaveBeenCalledWith(123, expect.anything())
    // markdown 渲染：正文经 markdown-it 渲染（纯文本段落仍完整呈现）
    expect(wrapper.find('[data-testid="replay-ai-text"]').text()).toContain('这局胜负手在中期被反超')

    // 开流前失败（如 4101）：降级提示
    vi.mocked(streamReplayComment).mockRejectedValue(
      Object.assign(new Error('AI API Key 未配置，无法生成复盘叙述'), { code: 4101 })
    )
    await wrapper.find('[data-testid="replay-ai-button"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="replay-ai-error"]').text()).toContain('AI API Key 未配置')
  })

  /** 用例（回归：思考过程折叠交互）：默认折叠，点击展开/收起（战犯出列同款） */
  it('AI 思考过程默认折叠，点击展开再收起', async () => {
    vi.mocked(getMatchReplay).mockResolvedValue(availableFixture())
    vi.mocked(streamReplayComment).mockImplementation(async (_gameId, handlers = {}) => {
      handlers.onReasoning?.('正在复盘')
      handlers.onChunk?.('正文')
    })

    const wrapper = mount(ReplayPanel, { props: { gameId: 123 } })
    await flushPromises()
    await wrapper.find('[data-testid="replay-ai-button"]').trigger('click')
    await flushPromises()

    // 默认折叠：思考内容不可见
    const toggle = wrapper.find('[data-testid="replay-ai-reasoning-toggle"]')
    expect(toggle.text()).toContain('点击展开')
    expect(wrapper.find('.ai-reasoning').exists()).toBe(false)
    // 展开
    await toggle.trigger('click')
    expect(wrapper.find('.ai-reasoning').text()).toContain('正在复盘')
    expect(toggle.text()).toContain('点击收起')
    // 收起
    await toggle.trigger('click')
    expect(wrapper.find('.ai-reasoning').exists()).toBe(false)
  })
})
