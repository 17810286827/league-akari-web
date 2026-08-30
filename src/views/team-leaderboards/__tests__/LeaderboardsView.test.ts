/**
 * LeaderboardsView 组件测试（榜单中心·双栏联动布局）：
 * 覆盖挂载自动加载默认维度榜单并自动选中榜首（右栏成员卡联动）、
 * 维度切换重查（携带新 dimension）、点击行切换选中成员（面板刷新 + 选中高亮）、
 * 绝活榜按英雄分组展示、主页按钮、错误消息透出。
 * mock @/api/team 的 getTeamLeaderboard / getMemberCard 与 vue-router。
 */
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getMemberCard, getTeamLeaderboard } from '@/api/team'
import type { TeamLeaderboard, TeamMemberCard } from '@/api/team'

import LeaderboardsView from '../LeaderboardsView.vue'

// mock 数据层：仅替换接口函数，apiErrorMessage 等工具保持真实实现
vi.mock('@/api/team', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/team')>()
  return {
    ...actual,
    getTeamLeaderboard: vi.fn(),
    getMemberCard: vi.fn()
  }
})

// mock 路由：主页按钮跳转断言用
const routerPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush })
}))

/** 最小榜单夹具（出勤榜） */
function leaderboardFixture(): TeamLeaderboard {
  return {
    dimension: 'attendance',
    startMs: null,
    endMs: null,
    gameMode: null,
    entries: [
      { puuid: 'p1', riotId: 'A#tw2', value: 3, detail: '3场 胜率67%' },
      { puuid: 'p2', riotId: 'B#tw2', value: 2, detail: '2场 胜率50%' }
    ]
  }
}

/** 绝活榜夹具：两名成员玩同一英雄 + 一名成员玩另一英雄（value 已是两位小数） */
function signatureFixture(): TeamLeaderboard {
  return {
    dimension: 'signature',
    startMs: null,
    endMs: null,
    gameMode: null,
    entries: [
      { puuid: 'p1', riotId: 'A#tw2', value: 9.2, detail: '卡莎 2场 胜率0%', championId: 1, championName: '卡莎', games: 2, wins: 0 },
      { puuid: 'p2', riotId: 'B#tw2', value: 7.05, detail: '卡莎 2场 胜率50%', championId: 1, championName: '卡莎', games: 2, wins: 1 },
      { puuid: 'p3', riotId: 'C#tw2', value: 8.3, detail: '河流之王 2场 胜率50%', championId: 2, championName: '河流之王', games: 2, wins: 1 }
    ]
  }
}

/** 最小成员卡夹具：两周趋势 + 单英雄基线对比 */
function memberCardFixture(): TeamMemberCard {
  return {
    puuid: 'p1',
    riotId: 'A#tw2',
    trend: [
      { weekLabel: '2026-08-17', games: 1, winRate: 0, avgOpScore: 4.2 },
      { weekLabel: '2026-08-24', games: 2, winRate: 1, avgOpScore: 7.8 }
    ],
    champions: [
      {
        championId: 103,
        championName: '阿狸',
        games: 3,
        wins: 2,
        avgOpScore: 7.1,
        avgDamagePerMin: 900,
        baselineDamagePerMin: 820
      }
    ]
  }
}

async function mountView() {
  const wrapper = mount(LeaderboardsView)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.mocked(getTeamLeaderboard).mockReset().mockResolvedValue(leaderboardFixture())
  vi.mocked(getMemberCard).mockReset().mockResolvedValue(memberCardFixture())
  routerPush.mockReset()
})

describe('LeaderboardsView', () => {
  it('点击"主页"按钮跳转回首页', async () => {
    const wrapper = await mountView()
    await wrapper.find('[data-testid="home-button"]').trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/')
  })

  it('挂载后加载默认维度榜单，并自动选中榜首联动右栏成员卡', async () => {
    const wrapper = await mountView()

    expect(getTeamLeaderboard).toHaveBeenCalledWith({ dimension: 'attendance' })
    // 榜单渲染：整数口径（场数）不带小数位，小数口径（场均值）保留两位
    const table = wrapper.find('[data-testid="leaderboard-table"]').text()
    expect(table).toContain('A#tw2')
    expect(table).not.toContain('3.00')
    // 自动选中榜首：成员卡请求 + 右栏面板渲染
    expect(getMemberCard).toHaveBeenCalledWith('p1')
    expect(wrapper.find('[data-testid="member-panel"]').text()).toContain('A#tw2')
    // 趋势条形与英雄基线对比（两位小数）
    expect(wrapper.find('[data-testid="panel-trend"]').text()).toContain('7.80')
    expect(wrapper.find('[data-testid="panel-champions"]').text()).toContain('900.00')
    expect(wrapper.find('[data-testid="panel-champions"]').text()).toContain('820.00')
  })

  it('维度切换携带新 dimension 重查', async () => {
    const wrapper = await mountView()
    vi.mocked(getTeamLeaderboard).mockClear()

    await wrapper.find('[data-testid="dim-mvp"]').trigger('click')
    await flushPromises()

    expect(getTeamLeaderboard).toHaveBeenCalledWith({ dimension: 'mvp' })
  })

  it('点击其他行切换选中成员，右栏成员卡随之刷新', async () => {
    const wrapper = await mountView()
    vi.mocked(getMemberCard).mockClear()

    // 点击第二行（B）
    const rows = wrapper.findAll('[data-testid="leaderboard-table"] .cursor-pointer')
    await rows[1].trigger('click')
    await flushPromises()

    expect(getMemberCard).toHaveBeenCalledWith('p2')
    expect(wrapper.find('[data-testid="member-panel"]').text()).toContain('A#tw2')
  })

  it('绝活榜按英雄分组展示各玩家数据（组内两位小数）', async () => {
    vi.mocked(getTeamLeaderboard).mockResolvedValue(signatureFixture())

    const wrapper = await mountView()
    await wrapper.find('[data-testid="dim-signature"]').trigger('click')
    await flushPromises()

    const table = wrapper.find('[data-testid="leaderboard-table"]').text()
    // 每个英雄一个分组标题，组内是该英雄的玩家排行
    expect(wrapper.find('[data-testid="champion-group-卡莎"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="champion-group-河流之王"]').exists()).toBe(true)
    expect(table).toContain('9.20')
    expect(table).toContain('8.30')
    // 卡莎组内含两名成员
    expect(wrapper.find('[data-testid="champion-group-卡莎"]').text()).toContain('A#tw2')
    expect(wrapper.find('[data-testid="champion-group-卡莎"]').text()).toContain('B#tw2')
  })

  it('榜单接口失败透出后端 message', async () => {
    vi.mocked(getTeamLeaderboard).mockRejectedValue({
      response: { data: { message: '车队名单未配置：请先在服务端配置 team.roster 成员名单' } }
    })

    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="leaderboard-error"]').text()).toContain('车队名单未配置')
  })
})
