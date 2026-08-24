/**
 * MatchCard / MatchCardOverview 冒烟测试（任务 10）
 * 覆盖：KDA 文本/装备图标数/玩家列表数/队列与地图名/hidePrivacy 英雄名/CHERRY 海克斯数/展开按钮切换，
 * 数据复用任务 5 的 LCU fixture（lcuParticipantFixture）+ 自造最小 teamsJson 与红队副本；
 * naive-ui 组件统一用 NConfigProvider 包裹挂载，RadarChart 打桩（chart.js 需 canvas，jsdom 无）
 */
import { flushPromises, mount } from '@vue/test-utils'
import { NConfigProvider, NMessageProvider } from 'naive-ui'
import { h } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import type { MatchDetail } from '@/api/types'
import { lcuParticipantFixture } from '@/views/match-detail/adapter/__tests__/fixtures'
import MatchCard from '../MatchCard.vue'

// 局部 mock 数据层：展示函数返回空壳 + 英雄名固定值，避免测试触发 CDragon 网络请求
vi.mock('@/utils/game-resource', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/game-resource')>()
  return {
    ...actual,
    // 英雄名固定返回值（fixture 全部 championId=1），供 hidePrivacy 断言
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

/** 常规 5v5 对局详情：LCU fixture + 红队副本（statsJson 无 teamId，回退顶层 teamId=200）+ 两队 teamsJson */
const classicSummary: MatchDetail = {
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

/** CHERRY 竞技场对局详情：聚焦玩家带全量海克斯（playerAugment1-6），复用 LCU fixture 其余字段 */
const cherrySummary: MatchDetail = {
  ...classicSummary,
  gameId: 2,
  gameMode: 'CHERRY',
  // CHERRY 无 LCU Team 记录，teamsJson 传空
  teamsJson: null,
  participants: lcuParticipantFixture
}

/** 挂载 MatchCard（默认 isExpanded=false）：NConfigProvider + NMessageProvider 包裹
 *  （naive-ui 依赖，MatchCardDetails 的 AI 分析按钮 useMessage 需要）+ RadarChart 打桩 */
function mountMatchCard(summary: MatchDetail, extraProps: Record<string, unknown> = {}) {
  return mount(
    () =>
      h(NConfigProvider, null, {
        default: () =>
          h(NMessageProvider, null, {
            default: () => h(MatchCard, { summary, puuid: 'lcu-p1', ...extraProps })
          })
      }),
    { global: { stubs: { RadarChart: true } } }
  )
}

describe('MatchCardOverview（CLASSIC）', () => {
  it('渲染聚焦玩家 KDA 与参团率文本', async () => {
    const wrapper = mountMatchCard(classicSummary)
    const text = wrapper.text()

    // 击杀 7/死亡 3/助攻 12（fixture），KDA = 19/3 = 6.33，参团率 = 19/25 = 76%
    expect(text).toContain('7/3/12')
    expect(text).toContain('6.33')
    expect(text).toContain('(76%)')
  })

  it('渲染 7 个装备图标（6 装备 + 1 真眼槽）', async () => {
    const wrapper = mountMatchCard(classicSummary)
    // 等待 itemDisplay 异步加载（mock 微任务）完成后 DOM 才出现图标
    await flushPromises()

    // 聚焦玩家 item0-5 → class=item，item6（真眼 3340）→ 额外 trinket 类
    expect(wrapper.findAll('img.item')).toHaveLength(7)
    expect(wrapper.findAll('img.trinket')).toHaveLength(1)
  })

  it('玩家列表渲染两队共 10 行', async () => {
    const wrapper = mountMatchCard(classicSummary)

    // 玩家行 class 为 group（蓝红两队各 5 人）
    expect(wrapper.findAll('.group')).toHaveLength(10)
  })

  it('信息行渲染队列名与地图名', async () => {
    const wrapper = mountMatchCard(classicSummary)
    const text = wrapper.text()

    // queueId 420 → 单排/双排；mapId 11 → 召唤师峡谷
    expect(text).toContain('单排/双排')
    expect(text).toContain('召唤师峡谷')
  })

  it('hidePrivacy 时玩家列表显示英雄名（替代召唤师名）', async () => {
    const wrapper = mountMatchCard(classicSummary, { hidePrivacy: true })
    const text = wrapper.text()

    // 10 名玩家全部显示英雄名（mock 固定返回菲奥娜），且不出现召唤师名
    expect(text).toContain('菲奥娜')
    expect(text).not.toContain('PlayerOne')
  })
})

describe('MatchCardOverview（CHERRY）', () => {
  it('渲染聚焦玩家 6 个海克斯强化图标', async () => {
    const wrapper = mountMatchCard(cherrySummary)
    // 等待 augmentDisplay 异步加载（mock 微任务）完成后 DOM 才出现图标
    await flushPromises()

    // fixture 聚焦玩家 playerAugment1-6 全量 → 6 个海克斯图标
    expect(wrapper.findAll('img.augment')).toHaveLength(6)
  })
})

describe('MatchCard 展开按钮', () => {
  it('默认收起（-rotate-90），点击切换为展开（rotate-90）', async () => {
    const wrapper = mountMatchCard(classicSummary)

    // 展开按钮为卡片右侧 w-8 区域（原版 1:1）
    const expandBtn = wrapper.find('.w-8')
    expect(expandBtn.exists()).toBe(true)
    expect(expandBtn.find('.rotate-90').exists()).toBe(false)

    await expandBtn.trigger('click')
    expect(expandBtn.find('.rotate-90').exists()).toBe(true)
  })
})

describe('折叠卡 MVP/ACE 奖杯图标', () => {
  /** 构造带称号的对局：聚焦玩家（lcu-p1）或他人持有 MVP/ACE */
  function summaryWithAwards(mvpPuuid: string | null, acePuuid: string | null): MatchDetail {
    return {
      ...classicSummary,
      mvp: mvpPuuid
        ? { participantId: 1, puuid: mvpPuuid, summonerName: 'MvpHolder', championId: 22, score: 92.5 }
        : null,
      ace: acePuuid
        ? { participantId: 2, puuid: acePuuid, summonerName: 'AceHolder', championId: 57, score: 85 }
        : null
    }
  }

  it('聚焦玩家是 MVP 持有者：头像右侧渲染金色奖杯', async () => {
    const wrapper = mountMatchCard(summaryWithAwards('lcu-p1', null))

    const icon = wrapper.find('.award-icon')
    expect(icon.exists()).toBe(true)
    expect(icon.classes()).toContain('award-icon-mvp')
  })

  it('聚焦玩家是 ACE 持有者：渲染银色奖杯', async () => {
    const wrapper = mountMatchCard(summaryWithAwards(null, 'lcu-p1'))

    const icon = wrapper.find('.award-icon')
    expect(icon.exists()).toBe(true)
    expect(icon.classes()).toContain('award-icon-ace')
  })

  it('称号持有者是别人：聚焦玩家不渲染奖杯', async () => {
    const wrapper = mountMatchCard(summaryWithAwards('lcu-p2', null))

    expect(wrapper.find('.award-icon').exists()).toBe(false)
  })

  it('未评选（null）：不渲染奖杯', async () => {
    const wrapper = mountMatchCard(summaryWithAwards(null, null))

    expect(wrapper.find('.award-icon').exists()).toBe(false)
  })
})
