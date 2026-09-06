/**
 * DiagnosePanel 组件测试（工单 #36：对局诊断）：
 * 覆盖败局短板高亮（weak 维度红标 + ⚠）、胜局无短板标记、
 * 视角队伍过滤（敌方不展示）、维度格式化（经济占比百分比）。
 */
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import type { MatchDiagnosis } from '@/api/types'
import DiagnosePanel from '../DiagnosePanel.vue'

// mock 数据层：只替换 getMatchDiagnosis
vi.mock('@/api/matches', () => ({
  getMatchDiagnosis: vi.fn()
}))

import { getMatchDiagnosis } from '@/api/matches'

/** 构造败局诊断夹具：我方两人（玩家一视野垫底），敌方一人（视角过滤不展示） */
function lossFixture(): MatchDiagnosis {
  return {
    win: false,
    perspectiveTeamId: 100,
    players: [
      {
        name: '玩家一',
        championName: '阿狸',
        championId: 103,
        championClass: 'MAGE',
        teamId: 100,
        dimensions: [
          { key: 'vision', label: '视野得分', rawValue: 8, teamRank: 2, teamAverage: 19, weak: true },
          { key: 'ccTime', label: '控制时长', rawValue: 25, teamRank: 2, teamAverage: 32.5, weak: false },
          { key: 'goldShare', label: '团队经济占比', rawValue: 0.43, teamRank: 1, teamAverage: 0.5, weak: false }
        ]
      },
      {
        name: '玩家二',
        championName: '盲僧',
        championClass: 'FIGHTER',
        teamId: 100,
        dimensions: [
          { key: 'vision', label: '视野得分', rawValue: 30, teamRank: 1, teamAverage: 19, weak: false },
          { key: 'ccTime', label: '控制时长', rawValue: 40, teamRank: 1, teamAverage: 32.5, weak: false },
          { key: 'goldShare', label: '团队经济占比', rawValue: 0.57, teamRank: 2, teamAverage: 0.5, weak: false }
        ]
      },
      {
        name: '敌人甲',
        championName: '锐雯',
        championClass: 'FIGHTER',
        teamId: 200,
        dimensions: []
      }
    ]
  }
}

describe('DiagnosePanel', () => {
  it('败局：短板维度高亮（⚠ 徽标），正常维度无标记', async () => {
    vi.mocked(getMatchDiagnosis).mockResolvedValue(lossFixture())

    const wrapper = mount(DiagnosePanel, { props: { gameId: 123 } })
    await flushPromises()

    expect(getMatchDiagnosis).toHaveBeenCalledWith(123)
    // 败局语境文案
    expect(wrapper.find('[data-testid="diagnose-panel"]').text()).toContain('败局短板高亮')
    // 玩家一视野是短板：带 ⚠
    const weakCell = wrapper.find('[data-testid="dim-玩家一-vision"]')
    expect(weakCell.text()).toContain('⚠')
    expect(weakCell.classes()).toContain('weak-dim')
    // 玩家二视野非短板：无 ⚠
    const normalCell = wrapper.find('[data-testid="dim-玩家二-vision"]')
    expect(normalCell.text()).not.toContain('⚠')
    expect(normalCell.classes()).not.toContain('weak-dim')
  })

  it('视角队伍过滤：敌方玩家不展示', async () => {
    vi.mocked(getMatchDiagnosis).mockResolvedValue(lossFixture())

    const wrapper = mount(DiagnosePanel, { props: { gameId: 123 } })
    await flushPromises()

    const table = wrapper.find('[data-testid="diagnose-table"]').text()
    expect(table).toContain('玩家一')
    expect(table).toContain('玩家二')
    expect(table).not.toContain('敌人甲')
  })

  it('维度格式化：经济占比转百分比，视野带单位与位次', async () => {
    vi.mocked(getMatchDiagnosis).mockResolvedValue(lossFixture())

    const wrapper = mount(DiagnosePanel, { props: { gameId: 123 } })
    await flushPromises()

    // 经济占比 0.43 → 43.0%
    expect(wrapper.find('[data-testid="dim-玩家一-goldShare"]').text()).toContain('43.0%')
    // 视野 8 分 + 位次 #2
    expect(wrapper.find('[data-testid="dim-玩家一-vision"]').text()).toContain('8分')
    expect(wrapper.find('[data-testid="dim-玩家一-vision"]').text()).toContain('#2')
  })

  it('胜局：不做短板判定（无 ⚠，语境文案切换）', async () => {
    const fixture = lossFixture()
    fixture.win = true
    // 后端语义：weak 只在败局置 true（胜局夹具同步置 false）
    fixture.players.forEach((p) => p.dimensions.forEach((d) => (d.weak = false)))
    vi.mocked(getMatchDiagnosis).mockResolvedValue(fixture)

    const wrapper = mount(DiagnosePanel, { props: { gameId: 123 } })
    await flushPromises()

    expect(wrapper.find('[data-testid="diagnose-panel"]').text()).toContain('胜局不做短板判定')
    expect(wrapper.find('[data-testid="dim-玩家一-vision"]').text()).not.toContain('⚠')
  })

  it('玩家行渲染英雄头像（championId 存在时），缺失时回退文字', async () => {
    vi.mocked(getMatchDiagnosis).mockResolvedValue(lossFixture())

    const wrapper = mount(DiagnosePanel, { props: { gameId: 123 } })
    await flushPromises()

    // 玩家一（championId=103）：渲染头像 img（Data Dragon URL 由 championIconUrl 生成）
    const avatar = wrapper.find('[data-testid="champion-avatar-玩家一"]')
    expect(avatar.exists()).toBe(true)
    expect(avatar.attributes('src')).toContain('103')
    // 玩家二（夹具无 championId）：回退文字，不渲染头像
    expect(wrapper.find('[data-testid="champion-avatar-玩家二"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="diagnose-table"]').text()).toContain('盲僧')
  })

  it('加载失败：独立空态不影响面板框架', async () => {
    vi.mocked(getMatchDiagnosis).mockRejectedValue(new Error('后端未启动'))

    const wrapper = mount(DiagnosePanel, { props: { gameId: 123 } })
    await flushPromises()

    expect(wrapper.find('[data-testid="diagnose-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="diagnose-table"]').exists()).toBe(false)
  })
})
