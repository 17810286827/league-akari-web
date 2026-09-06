/**
 * SeasonReportView 组件测试（工单 #42：赛季报告）：
 * 覆盖入口选择日期生成（请求携带起止毫秒）、报告主体渲染
 * （版本胜率曲线/高光/英雄池漂移）、重新生成回入口。
 * Chart.js Line 模块级 mock（jsdom 无 canvas）。
 */
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import type { SeasonReport } from '@/api/team'
import SeasonReportView from '../SeasonReportView.vue'

// mock 数据层
vi.mock('@/api/team', () => ({
  getSeasonReport: vi.fn(),
  apiErrorMessage: (error: unknown, fallback: string) =>
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
}))

// vue-chartjs mock（断言聚焦数据/渲染结构）
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

import { getSeasonReport } from '@/api/team'

// mock 路由
const routerPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush })
}))

/** 报告夹具：两个版本 + 两名成员漂移 + 高光 */
function reportFixture(): SeasonReport {
  return {
    totalGames: 12,
    totalWinRate: 0.583,
    versionStats: [
      { version: '16.14', games: 5, wins: 8, losses: 2, winRate: 0.8 },
      { version: '16.15', games: 7, wins: 9, losses: 5, winRate: 0.643 }
    ],
    memberDrifts: [
      {
        riotId: 'A#tw2',
        versions: [
          { version: '16.14', champions: [{ champion: '阿狸', games: 5 }] },
          { version: '16.15', champions: [{ champion: '锐雯', games: 7 }] }
        ]
      },
      {
        riotId: 'B#tw2',
        versions: [
          { version: '16.14', champions: [{ champion: '盲僧', games: 5 }] },
          { version: '16.15', champions: [{ champion: '盲僧', games: 7 }] }
        ]
      }
    ],
    mostKills: { gameId: 100, title: '单局最高击杀', detail: 'A#tw2 单局 18 杀（锐雯）' }
  }
}

describe('SeasonReportView', () => {
  it('入口选择日期生成：请求携带起止毫秒时间戳', async () => {
    vi.mocked(getSeasonReport).mockResolvedValue(reportFixture())

    const wrapper = mount(SeasonReportView)
    await wrapper.find('[data-testid="season-start"]').setValue('2026-06-01')
    await wrapper.find('[data-testid="season-end"]').setValue('2026-08-31')
    await wrapper.find('[data-testid="season-generate"]').trigger('click')
    await flushPromises()

    const [start, end] = vi.mocked(getSeasonReport).mock.calls[0]
    // 2026-06-01 00:00 +08:00 的毫秒
    expect(start).toBe(new Date('2026-06-01T00:00:00+08:00').getTime())
    expect(end).toBeGreaterThan(start)
  })

  it('报告主体：总览/版本曲线/高光/英雄池漂移渲染', async () => {
    vi.mocked(getSeasonReport).mockResolvedValue(reportFixture());

    const wrapper = mount(SeasonReportView)
    await wrapper.find('[data-testid="season-generate"]').trigger('click')
    await flushPromises()

    // 总览
    expect(wrapper.find('[data-testid="season-summary"]').text()).toContain('12 局')
    expect(wrapper.find('[data-testid="season-summary"]').text()).toContain('58%')
    // 版本曲线与高光
    expect(wrapper.find('[data-testid="season-versions"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="season-highlights"]').text()).toContain('18 杀')
    // 英雄池漂移：A 换英雄、B 本命
    expect(wrapper.find('[data-testid="drift-A#tw2"]').text()).toContain('阿狸×5')
    expect(wrapper.find('[data-testid="drift-A#tw2"]').text()).toContain('锐雯×7')
    expect(wrapper.find('[data-testid="drift-B#tw2"]').text()).toContain('盲僧×5')
    expect(wrapper.find('[data-testid="drift-B#tw2"]').text()).toContain('盲僧×7')
  })

  it('重新生成：回入口重新选日期', async () => {
    vi.mocked(getSeasonReport).mockResolvedValue(reportFixture())

    const wrapper = mount(SeasonReportView)
    await wrapper.find('[data-testid="season-generate"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="season-regenerate"]').trigger('click')

    expect(wrapper.find('[data-testid="season-entry"]').exists()).toBe(true)
  })
})
