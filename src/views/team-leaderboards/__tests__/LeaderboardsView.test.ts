/**
 * LeaderboardsView 组件测试（榜单中心页）：
 * 覆盖挂载自动加载默认维度榜单、维度切换重查（携带新 dimension）、
 * 点击成员行打开成员卡抽屉（渲染成长曲线与英雄基线对比）、错误消息透出。
 * mock @/api/team 的 getTeamLeaderboard / getMemberCard。
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

/** 最小榜单夹具 */
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
  // teleport stub：成员卡抽屉 Teleport 到 body，测试环境内联渲染便于断言
  const wrapper = mount(LeaderboardsView, { global: { stubs: { teleport: true } } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.mocked(getTeamLeaderboard).mockReset().mockResolvedValue(leaderboardFixture())
  vi.mocked(getMemberCard).mockReset().mockResolvedValue(memberCardFixture())
})

describe('LeaderboardsView', () => {
  it('挂载后加载默认维度（出勤榜）榜单', async () => {
    const wrapper = await mountView()

    expect(getTeamLeaderboard).toHaveBeenCalledWith({ dimension: 'attendance' })
    const table = wrapper.find('[data-testid="leaderboard-table"]').text()
    expect(table).toContain('A#tw2')
    expect(table).toContain('3场 胜率67%')
  })

  it('切换维度携带新 dimension 重查', async () => {
    const wrapper = await mountView()
    vi.mocked(getTeamLeaderboard).mockClear()

    await wrapper.find('[data-testid="dim-mvp"]').trigger('click')
    await flushPromises()

    expect(getTeamLeaderboard).toHaveBeenCalledWith({ dimension: 'mvp' })
  })

  it('点击成员行打开成员卡抽屉并渲染趋势与基线对比', async () => {
    const wrapper = await mountView()
    // 点击榜单第一行
    await wrapper.find('[data-testid="leaderboard-table"] .cursor-pointer').trigger('click')
    await flushPromises()

    expect(getMemberCard).toHaveBeenCalledWith('p1')
    const drawer = wrapper.find('[data-testid="member-card-drawer"]').text()
    expect(drawer).toContain('A#tw2')
    expect(drawer).toContain('阿狸')
    expect(drawer).toContain('900')
    expect(drawer).toContain('820')
  })

  it('榜单接口失败透出后端 message', async () => {
    vi.mocked(getTeamLeaderboard).mockRejectedValue({
      response: { data: { message: '车队名单未配置：请先在服务端配置 team.roster 成员名单' } }
    })

    const wrapper = await mountView()

    expect(wrapper.find('[data-testid="leaderboard-error"]').text()).toContain('车队名单未配置')
  })
})
