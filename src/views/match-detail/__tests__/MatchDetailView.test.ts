/**
 * MatchDetailView 组件测试（任务 13）
 * 覆盖：详情加载成功渲染 MatchCard 展开态（KDA/玩家行/Tab 面板/时间线注入 details）、
 * 详情接口失败显示错误空态、时间线接口失败仅 warn 不阻塞卡片展示；
 * mock src/api/matches.ts 的 getMatchDetail/getMatchTimeline 与 vue-router 的 useRoute，
 * 数据复用任务 5 的 LCU fixture + 红队副本（对齐 MatchCardOverview 测试）；
 * naive-ui 组件用 NConfigProvider + NMessageProvider 包裹，RadarChart/StatsBarChart 打桩
 * （chart.js 需 canvas，jsdom 无）
 */
import { flushPromises, mount } from '@vue/test-utils'
import { NConfigProvider, NMessageProvider } from 'naive-ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'

import { getMatchDetail, getMatchTimeline } from '@/api/matches'
import type { MatchDetail } from '@/api/types'
import MatchCard from '@/components/match-card/MatchCard.vue'

import { lcuParticipantFixture } from '../adapter/__tests__/fixtures'
import MatchDetailView from '../MatchDetailView.vue'

// 局部 mock 数据层：展示函数返回空壳 + 英雄名固定值，避免测试触发 CDragon 网络请求
vi.mock('@/utils/game-resource', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/game-resource')>()
  return {
    ...actual,
    // 英雄名固定返回值（fixture 全部 championId=1），供 hidePrivacy 等文案断言
    getChampionName: vi.fn(() => '菲奥娜'),
    augmentDisplay: vi
      .fn()
      .mockResolvedValue({ name: '海克斯强化', iconUrl: '', rarity: 'kSilver' }),
    itemDisplay: vi.fn().mockResolvedValue({
      id: 1,
      name: '装备',
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

// mock API 层：getMatchDetail/getMatchTimeline 由各用例经 beforeEach 注入返回值
vi.mock('@/api/matches', () => ({
  getMatchDetail: vi.fn(),
  getMatchTimeline: vi.fn()
}))

// mock 路由：详情页只消费 useRoute().params.gameId，固定返回 '123' 即可
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { gameId: '123' } })
}))

/** 常规 5v5 对局详情：LCU fixture + 红队副本（statsJson 无 teamId，回退顶层 teamId=200）+ 两队 teamsJson */
const classicSummary: MatchDetail = {
  gameId: 123,
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
    { teamId: 100, win: 'Win', towerKills: 11, inhibitorKills: 2, dragonKills: 3, baronKills: 1, riftHeraldKills: 1, voidGrubKills: 4, atakhanKills: 0, firstBlood: true, bans: [] },
    { teamId: 200, win: 'Fail', towerKills: 3, inhibitorKills: 0, dragonKills: 2, baronKills: 0, riftHeraldKills: 0, voidGrubKills: 2, atakhanKills: 0, firstBlood: false, bans: [] }
  ]),
  participants: [
    ...lcuParticipantFixture,
    // 红队副本：仅改顶层身份字段（LCU stats 无 teamId，分组回退顶层 teamId=200）
    ...lcuParticipantFixture.map((p) => ({
      ...p,
      id: p.id + 100,
      puuid: `red-${p.puuid}`,
      summonerName: p.summonerName.replace('Player', 'Rival'),
      teamId: 200
    }))
  ]
}

/** 时间线帧（结构透传 unknown，任意形状即可） */
const timelineFrames = [{ frameNumber: 1 }, { frameNumber: 2 }]

/** 挂载 MatchDetailView：NConfigProvider + NMessageProvider 包裹（naive-ui 依赖），图表打桩 */
function mountView() {
  return mount(
    () =>
      h(NConfigProvider, null, {
        default: () => h(NMessageProvider, null, { default: () => h(MatchDetailView) })
      }),
    { global: { stubs: { RadarChart: true, StatsBarChart: true } } }
  )
}

describe('MatchDetailView', () => {
  beforeEach(() => {
    // 默认：详情与时间线均成功返回（失败用例按需覆盖）
    vi.mocked(getMatchDetail).mockResolvedValue(classicSummary)
    vi.mocked(getMatchTimeline).mockResolvedValue(timelineFrames)
  })

  it('加载成功渲染 MatchCard 展开态：两个接口按 gameId 调用、KDA/玩家行/Tab 面板/时间线注入', async () => {
    const wrapper = mountView()
    await flushPromises()

    // 两个接口均以路由参数解析出的 gameId 调用
    expect(getMatchDetail).toHaveBeenCalledWith(123)
    expect(getMatchTimeline).toHaveBeenCalledWith(123)

    // 卡片总览：聚焦玩家 KDA 与参团率（fixture 7/3/12 → 6.33 / (76%)）
    expect(wrapper.text()).toContain('7/3/12')
    expect(wrapper.text()).toContain('6.33')

    // 玩家列表：蓝红两队共 10 行
    expect(wrapper.findAll('.group')).toHaveLength(10)

    // 展开态详情面板：Tab 渲染（lcu 数据源无“构建”Tab）
    expect(wrapper.text()).toContain('总览')
    expect(wrapper.text()).toContain('详尽表格')
    expect(wrapper.text()).toContain('符文')
    expect(wrapper.text()).toContain('事件')
    expect(wrapper.text()).toContain('时间线')
    expect(wrapper.text()).not.toContain('构建')

    // 时间线成功注入 details（归一化后的 { frames }），卡片处于展开态
    const card = wrapper.findComponent(MatchCard)
    expect(card.props('details')).toEqual({ frames: timelineFrames })
    expect(card.props('isExpanded')).toBe(true)
  })

  it('详情接口失败显示错误态且不渲染卡片', async () => {
    vi.mocked(getMatchDetail).mockRejectedValue(new Error('404 Not Found'))
    const wrapper = mountView()
    await flushPromises()

    // 错误空态（n-empty）展示，卡片 Tab 不出现
    expect(wrapper.text()).toContain('对局不存在')
    expect(wrapper.text()).not.toContain('总览')
    expect(wrapper.findComponent(MatchCard).exists()).toBe(false)
  })

  it('时间线接口失败仅 warn 不阻塞卡片展示', async () => {
    vi.mocked(getMatchTimeline).mockRejectedValue(new Error('timeline 500'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mountView()
    await flushPromises()

    // 卡片正常渲染（详情不受时间线失败影响）
    expect(wrapper.text()).toContain('7/3/12')
    expect(wrapper.text()).toContain('总览')

    // 仅 warn 日志（不弹错误消息），details 保持 null（时间线 Tab 空态）
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to load match timeline'),
      expect.anything()
    )
    expect(wrapper.findComponent(MatchCard).props('details')).toBeNull()
  })
})
