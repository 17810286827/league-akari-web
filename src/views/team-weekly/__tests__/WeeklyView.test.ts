/**
 * WeeklyView 组件测试（车队周报页）：
 * 覆盖挂载自动加载周报并渲染六榜单/名场面/AI 锐评、上一周按钮触发重查、
 * 后端错误消息透出（400 名单未配置等）、分享图按钮调用下载适配函数。
 * mock @/api/team 的 getWeeklyReport 与 adapter 的 downloadShareImage（canvas 在 jsdom 不可用）。
 */
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getWeeklyReport } from '@/api/team'
import type { TeamWeeklyReport } from '@/api/team'

import WeeklyView from '../WeeklyView.vue'

// mock 数据层：仅替换接口函数，apiErrorMessage 等工具保持真实实现（错误透出用例依赖）
vi.mock('@/api/team', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/team')>()
  return {
    ...actual,
    getWeeklyReport: vi.fn()
  }
})

// mock 分享图下载（jsdom 无 canvas 2d 上下文），其余 adapter 函数保持真实实现
vi.mock('../adapter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../adapter')>()
  return {
    ...actual,
    downloadShareImage: vi.fn()
  }
})

import { downloadShareImage } from '../adapter'

/** 构造最小周报夹具：两个榜单有数据，其余为空 */
function reportFixture(): TeamWeeklyReport {
  return {
    weekStartMs: 0,
    weekEndMs: 1,
    weekLabel: '2026-08-24 ~ 2026-08-30',
    overview: {
      gameCount: 2,
      memberGameCount: 4,
      winCount: 3,
      lossCount: 1,
      totalDurationSeconds: 3000,
      busiestDay: '2026-08-26',
      busiestDayGames: 2,
      activeMembers: ['A#tw2', 'B#tw2']
    },
    mvpBoard: [{ puuid: 'p1', riotId: 'A#tw2', value: 2, detail: 'MVP×2' }],
    criminalBoard: [{ puuid: 'p2', riotId: 'B#tw2', value: 4, detail: '2场' }],
    feederBoard: null,
    carryBoard: null,
    signatureBoard: null,
    attendanceBoard: null,
    highlights: {
      biggestComeback: null,
      worstStreak: null,
      multiKillMoment: { gameId: 100, title: '五杀时刻', detail: 'B#tw2 拿下五杀', value: 5 },
      mostKillsGame: null
    },
    aiComment: '本周A封神'
  }
}

/** 挂载组件并等待首次加载完成 */
async function mountView() {
  const wrapper = mount(WeeklyView)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.mocked(getWeeklyReport).mockReset()
  vi.mocked(downloadShareImage).mockReset()
})

describe('WeeklyView', () => {
  it('挂载后加载周报并渲染总览/榜单/名场面/锐评', async () => {
    vi.mocked(getWeeklyReport).mockResolvedValue(reportFixture())

    const wrapper = await mountView()

    // 周标签 + 总览统计
    expect(wrapper.find('[data-testid="week-label"]').text()).toContain('2026-08-24')
    const overview = wrapper.find('[data-testid="overview"]').text()
    expect(overview).toContain('2') // 车队对局
    expect(overview).toContain('3 胜')
    // MVP 榜与战犯榜条目
    expect(wrapper.find('[data-testid="board-mvp"]').text()).toContain('A#tw2')
    expect(wrapper.find('[data-testid="board-criminal"]').text()).toContain('B#tw2')
    // 名场面与 AI 锐评
    expect(wrapper.find('[data-testid="highlights"]').text()).toContain('五杀时刻')
    expect(wrapper.find('[data-testid="ai-comment"]').text()).toContain('本周A封神')
  })

  it('点击"上一周"以偏移后的日期重新查询', async () => {
    vi.mocked(getWeeklyReport).mockResolvedValue(reportFixture())

    const wrapper = await mountView()
    vi.mocked(getWeeklyReport).mockClear()
    await wrapper.find('[data-testid="week-prev"]').trigger('click')
    await flushPromises()

    expect(getWeeklyReport).toHaveBeenCalledTimes(1)
    expect(vi.mocked(getWeeklyReport).mock.calls[0]?.[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('后端错误（如名单未配置）透出 message 并隐藏周报主体', async () => {
    vi.mocked(getWeeklyReport).mockRejectedValue({
      response: { data: { message: '车队名单未配置：请先在服务端配置 team.roster 成员名单' } }
    })

    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="weekly-error"]').text()).toContain('车队名单未配置')
    expect(wrapper.find('[data-testid="overview"]').exists()).toBe(false)
  })

  it('点击"生成分享图"调用下载适配函数', async () => {
    vi.mocked(getWeeklyReport).mockResolvedValue(reportFixture())

    const wrapper = await mountView()
    await wrapper.find('[data-testid="share-button"]').trigger('click')

    expect(downloadShareImage).toHaveBeenCalledTimes(1)
    expect(vi.mocked(downloadShareImage).mock.calls[0]?.[0].weekLabel).toBe('2026-08-24 ~ 2026-08-30')
  })
})
