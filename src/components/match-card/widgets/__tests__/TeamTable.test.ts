/**
 * TeamTable 组件冒烟测试（任务 9）
 * 覆盖：表头（队伍名/队 KDA/野怪目标/禁用列表）+ 玩家行渲染数量 + KDA 列文本，
 * 数据用任务 5 的 LCU fixture（lcuParticipantFixture）+ 自造最小 teamsJson；
 * naive-ui 组件统一用 NConfigProvider 包裹挂载
 */
import { mount } from '@vue/test-utils'
import { NConfigProvider } from 'naive-ui'
import { defineComponent, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { MatchDetail } from '@/api/types'
import { lcuParticipantFixture } from '@/views/match-detail/adapter/__tests__/fixtures'
import { provideMatchCard } from '../../context'
import TeamTable from '../TeamTable.vue'

// 局部 mock 数据层：展示函数全部返回空壳，避免测试触发 CDragon 网络请求
vi.mock('@/utils/game-resource', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/game-resource')>()
  return {
    ...actual,
    augmentDisplay: vi.fn().mockResolvedValue({ name: '', iconUrl: '' }),
    itemDisplay: vi
      .fn()
      .mockResolvedValue({
        id: 0,
        name: '',
        iconUrl: '',
        descriptionHtml: '',
        price: 0,
        totalPrice: 0
      }),
    perkDisplay: vi.fn().mockResolvedValue({ name: '', iconUrl: '' }),
    perkstyleDisplay: vi.fn().mockResolvedValue({ name: '', iconUrl: '' }),
    spellDisplay: vi.fn().mockResolvedValue(null)
  }
})

/** 最小对局详情：LCU 参与者 fixture + 两队 teamsJson（含禁用与野怪目标） */
const summary: MatchDetail = {
  gameId: 1,
  gameCreation: 0,
  gameDuration: 1800,
  gameMode: 'CLASSIC',
  gameType: 'MATCHED_GAME',
  queueId: 420,
  mapId: 11,
  gameVersion: '14.10.1',
  region: 'CN',
  rsoPlatformId: 'CN1',
  dataSource: 'lcu',
  winnerTeamId: 100,
  selfPuuid: 'lcu-p1',
  teamsJson: JSON.stringify([
    {
      teamId: 100,
      win: 'Win',
      towerKills: 11,
      inhibitorKills: 2,
      dragonKills: 3,
      baronKills: 1,
      riftHeraldKills: 1,
      voidGrubKills: 4,
      atakhanKills: 0,
      firstBlood: true,
      bans: [
        { championId: 1, pickTurn: 1 },
        { championId: 2, pickTurn: 2 }
      ]
    },
    {
      teamId: 200,
      win: 'Fail',
      towerKills: 3,
      inhibitorKills: 0,
      dragonKills: 2,
      baronKills: 0,
      riftHeraldKills: 0,
      voidGrubKills: 2,
      atakhanKills: 0,
      firstBlood: false,
      bans: []
    }
  ]),
  participants: lcuParticipantFixture
}

/** 测试挂载壳：提供 match-card context 后渲染 TeamTable（NConfigProvider 包裹） */
const Harness = defineComponent({
  setup() {
    provideMatchCard({
      summary,
      puuid: 'lcu-p1',
      hidePrivacy: false,
      navigateToSummonerByPuuid: vi.fn()
    })
    return () => h(TeamTable, { teamIdentifier: 'TEAM-100' })
  }
})

/** 挂载 TeamTable：NConfigProvider 包裹（naive-ui 依赖）+ RadarChart 打桩（chart.js 需 canvas，jsdom 无） */
function mountTeamTable() {
  return mount(() =>
    h(NConfigProvider, null, {
      default: () => h(Harness)
    }),
    { global: { stubs: { RadarChart: true } } }
  )
}

describe('TeamTable', () => {
  it('渲染 5 行玩家（TEAM-100 的 LCU fixture 5 名参赛者）', () => {
    const wrapper = mountTeamTable()

    // 玩家行 class 为 h-12（表头为 h-8），仅玩家行使用该高度
    const playerRows = wrapper.findAll('div.h-12')
    expect(playerRows).toHaveLength(5)
  })

  it('KDA 列渲染 击杀/死亡/助攻 与击杀参与率文本', () => {
    const wrapper = mountTeamTable()
    const text = wrapper.text()

    // 首名玩家（fixture 击杀 7/3/12，队总击杀 25 → 参团率 76%）
    expect(text).toContain('7/3/12 (76%)')
    expect(text).toContain('6.33 KDA')
    // 队友（击杀 6/1/2 → 参团率 32%）
    expect(text).toContain('6/1/2 (32%)')
  })

  it('表头渲染队伍名/队 KDA/野怪目标与禁用列表', () => {
    const wrapper = mountTeamTable()
    const text = wrapper.text()

    // 队伍名（teams.TEAM-100 → 蓝队）与队总 KDA（7+6+5+4+3 / 3+1×4 / 12+2×4）
    expect(text).toContain('蓝队')
    expect(text).toContain('25/7/20')
    // 野怪目标：标签在 title 属性（原版 1:1），数量在紧随的 span（塔 11/水晶 2/龙 3/男爵 1/巢虫 4/先锋 1）
    expect(wrapper.find('[title="防御塔"]').exists()).toBe(true)
    expect(wrapper.find('[title="防御塔"] span').text()).toBe('11')
    expect(wrapper.find('[title="水晶"] span').text()).toBe('2')
    expect(wrapper.find('[title="巨龙"] span').text()).toBe('3')
    expect(wrapper.find('[title="纳什男爵"] span').text()).toBe('1')
    expect(wrapper.find('[title="虚空巢虫"] span').text()).toBe('4')
    expect(wrapper.find('[title="峡谷先锋"] span').text()).toBe('1')
    // 禁用列表（bans 标签 + 2 个禁用英雄）
    expect(text).toContain('禁用')
    // 对线位置（matchCard.position.TOP → 上路）
    expect(text).toContain('上路')
  })

  it('点击玩家名触发 navigateToSummonerByPuuid 导航', async () => {
    const navigateToSummonerByPuuid = vi.fn()
    const HarnessWithNav = defineComponent({
      setup() {
        provideMatchCard({
          summary,
          puuid: 'lcu-p1',
          hidePrivacy: false,
          navigateToSummonerByPuuid
        })
        return () => h(TeamTable, { teamIdentifier: 'TEAM-100' })
      }
    })
    const wrapper = mount(
      () =>
        h(NConfigProvider, null, {
          default: () => h(HarnessWithNav)
        }),
      { global: { stubs: { RadarChart: true } } }
    )

    // 玩家名（PlayerOne）触发点击 → 导航到对应 puuid
    const nameEls = wrapper.findAll('.truncate')
    expect(nameEls.length).toBeGreaterThan(0)
    await nameEls[0].trigger('click')
    expect(navigateToSummonerByPuuid).toHaveBeenCalledWith('lcu-p1')
  })
})

describe('TeamTable MVP/ACE 徽章', () => {
  /** 构造带称号的对局详情：在基础 summary 上叠加 mvp/ace（按 puuid 指定持有者） */
  const summaryWithAwards = (mvpPuuid: string | null, acePuuid: string | null): MatchDetail => ({
    ...summary,
    mvp: mvpPuuid
      ? { participantId: 1, puuid: mvpPuuid, summonerName: 'MvpHolder', championId: 22, score: 92.5, opScore: 9.2, grade: '卓越' }
      : null,
    ace: acePuuid
      ? { participantId: 2, puuid: acePuuid, summonerName: 'AceHolder', championId: 57, score: 85.0, opScore: 8.5, grade: '优秀' }
      : null
  })

  /** 挂载指定称号组合的 TeamTable（TEAM-100 表格） */
  function mountWithAwards(mvpPuuid: string | null, acePuuid: string | null) {
    const harness = defineComponent({
      setup() {
        provideMatchCard({
          summary: summaryWithAwards(mvpPuuid, acePuuid),
          puuid: 'lcu-p1',
          hidePrivacy: false,
          navigateToSummonerByPuuid: vi.fn()
        })
        return () => h(TeamTable, { teamIdentifier: 'TEAM-100' })
      }
    })
    return mount(() => h(NConfigProvider, null, { default: () => h(harness) }), {
      global: { stubs: { RadarChart: true } }
    })
  }

  it('MVP 徽章渲染在称号持有者的玩家行（金色，唯一）', () => {
    // MVP 挂在第二名玩家（lcu-p2）
    const wrapper = mountWithAwards('lcu-p2', null)

    // 徽章唯一且文本正确
    const badge = wrapper.find('.mvp-badge')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('MVP')
    expect(wrapper.findAll('.mvp-badge')).toHaveLength(1)

    // 徽章在 lcu-p2（PlayerTwo）的名字行内，而非 self（PlayerOne）行
    const rowOfBadge = badge.element.closest('div.h-12')
    expect(rowOfBadge?.textContent).toContain('PlayerTwo')
    expect(rowOfBadge?.textContent).not.toContain('PlayerOne')
  })

  it('ACE 徽章渲染在称号持有者的玩家行（银色，与 MVP 不冲突）', () => {
    // ACE 挂在第三名玩家（lcu-p3），MVP 挂在第二名
    const wrapper = mountWithAwards('lcu-p2', 'lcu-p3')

    const aceBadge = wrapper.find('.ace-badge')
    expect(aceBadge.exists()).toBe(true)
    expect(aceBadge.text()).toBe('ACE')
    // ACE 在 lcu-p3 行内
    const rowOfAce = aceBadge.element.closest('div.h-12')
    expect(rowOfAce?.textContent).toContain('PlayerThree')
    // 同一玩家行只挂一个徽章：ACE 行内不应再出现 MVP 徽章
    expect(rowOfAce?.querySelector('.mvp-badge')).toBeNull()
  })

  it('mvp/ace 为 null（未评选老对局）时不渲染任何徽章', () => {
    const wrapper = mountWithAwards(null, null)

    expect(wrapper.find('.mvp-badge').exists()).toBe(false)
    expect(wrapper.find('.ace-badge').exists()).toBe(false)
  })
})

describe('TeamTable 评分列', () => {
  /** 构造带全员评分的 summary（playerScores 按 puuid 索引，opScore 版本） */
  const summaryWithScores = (
    scores: Record<string, { opScore: number; grade: string; dimensions?: Record<string, { raw: number; score: number }> }>
  ): MatchDetail => ({
    ...summary,
    mvp: { participantId: 1, puuid: 'lcu-p2', summonerName: 'P2', championId: 22, score: 92.5, opScore: 9.2, grade: '卓越' },
    playerScores: scores
  })

  /** 挂载指定 playerScores 的 TeamTable（TEAM-100） */
  function mountWithScores(
    scores: Record<string, { opScore: number; grade: string; dimensions?: Record<string, { raw: number; score: number }> }> | undefined
  ) {
    const harnessSummary = scores === undefined ? summary : summaryWithScores(scores)
    const harness = defineComponent({
      setup() {
        provideMatchCard({
          summary: harnessSummary,
          puuid: 'lcu-p1',
          hidePrivacy: false,
          navigateToSummonerByPuuid: vi.fn()
        })
        return () => h(TeamTable, { teamIdentifier: 'TEAM-100' })
      }
    })
    return mount(() => h(NConfigProvider, null, { default: () => h(harness) }), {
      global: { stubs: { RadarChart: true } }
    })
  }

  it('全员评分列渲染每人分数', () => {
    const wrapper = mountWithScores({
      'lcu-p1': { opScore: 5.5, grade: '一般' },
      'lcu-p2': { opScore: 9.2, grade: '卓越', dimensions: { damage: { raw: 30000, score: 100 }, tank: { raw: 8000, score: 0 } } },
      'lcu-p3': { opScore: 7.1, grade: '优秀' },
      'lcu-p4': { opScore: 3.3, grade: '偏低' },
      'lcu-p5': { opScore: 6.0, grade: '良好' }
    })

    // 5 名玩家各一个评分单元格，数值按 puuid 对应（opScore 保留一位小数）
    const cells = wrapper.findAll('.score-cell')
    expect(cells).toHaveLength(5)
    expect(cells.map((c) => c.text())).toEqual(['5.5', '9.2', '7.1', '3.3', '6.0'])
  })

  it('MVP 持有者的分数金色高亮，其余不高亮', () => {
    const wrapper = mountWithScores({
      'lcu-p1': { opScore: 5.5, grade: '一般' },
      'lcu-p2': { opScore: 9.2, grade: '卓越' },
      'lcu-p3': { opScore: 7.1, grade: '优秀' },
      'lcu-p4': { opScore: 3.3, grade: '偏低' },
      'lcu-p5': { opScore: 6.0, grade: '良好' }
    })

    // MVP 持有者（lcu-p2）的评分带高亮 class，其余 4 人不带
    const highlighted = wrapper.findAll('.score-cell.score-highlight-mvp')
    expect(highlighted).toHaveLength(1)
    expect(highlighted[0].text()).toBe('9.2')
  })

  it('playerScores 缺失时评分列显示占位（列结构稳定）', () => {
    const wrapper = mountWithScores(undefined)

    // 无评分数据：每人显示 '-' 占位，不渲染数值
    const cells = wrapper.findAll('.score-cell')
    expect(cells).toHaveLength(5)
    cells.forEach((c) => expect(c.text()).toBe('-'))
  })
})
