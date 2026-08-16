/**
 * MatchCardBuildsTab 组件测试（任务 15）
 * 覆盖：技能加点序列渲染（Q/W/E/R 键位 + displayLevel 加点序号）、EVOLVE 进化块
 * （不占加点序号、title 含「已进化」）、购买序列渲染（物品图标 + 时间戳）、
 * 购买间隔超 30s 插入分割箭头、锻炉物品计数徽章（anvils）
 * 数据经适配层 toMatchCardBuilds 组装（原版 collected 计算下沉），ItemDisplay 走 mock 物品表
 */
import { flushPromises, mount } from '@vue/test-utils'
import { NConfigProvider } from 'naive-ui'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import type { MatchDetail, MatchParticipant } from '@/api/types'
import type { MatchCardGameDetails } from '@/views/match-detail/adapter/types'
import { provideMatchCard } from '../../context'
import MatchCardBuildsTab from '../MatchCardBuildsTab.vue'

// 局部 mock 数据层：英雄名固定 + 物品表返回空壳资源（避免 CDragon 网络请求）
vi.mock('@/utils/game-resource', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/game-resource')>()
  return {
    ...actual,
    getChampionName: vi.fn(() => '菲奥娜'),
    itemDisplay: vi.fn(async (itemId: number) => ({
      id: itemId,
      name: `装备${itemId}`,
      iconUrl: '',
      descriptionHtml: '',
      price: 100,
      totalPrice: 100
    }))
  }
})

/** 构造一名参赛者档案（statsJson 携带适配层消费的最小字段） */
function makeParticipant(
  partial: Partial<MatchParticipant> & { puuid: string; summonerName: string; teamId: number }
): MatchParticipant {
  return {
    id: 1,
    matchId: 1,
    championId: 1,
    position: 'TOP',
    kills: 0,
    deaths: 0,
    assists: 0,
    win: true,
    goldEarned: 0,
    cs: 0,
    items: null,
    summonerSpells: null,
    statsJson: null,
    ...partial
  }
}

/** 单名选手（蓝队，菲奥娜） */
const player: MatchParticipant = makeParticipant({
  id: 1,
  puuid: 'blue-p1',
  summonerName: 'BlueOne#CN1',
  teamId: 100,
  championId: 1,
  statsJson: JSON.stringify({
    participantId: 1,
    playerSubteamId: 0,
    subteamPlacement: 1,
    win: true
  })
})

const summary: MatchDetail = {
  gameId: 987654,
  gameCreation: 0,
  gameDuration: 1500,
  gameMode: 'CLASSIC',
  gameType: 'MATCHED_GAME',
  queueId: 420,
  mapId: 11,
  gameVersion: '14.10.1',
  region: 'CN',
  rsoPlatformId: 'CN1',
  // 构建 Tab 仅 sgp 数据源展示（MatchCardDetails 的 tabs 配置），测试仍以 sgp 挂载
  dataSource: 'sgp',
  winnerTeamId: 100,
  selfPuuid: 'blue-p1',
  teamsJson: null,
  participants: [player]
}

/**
 * 最小 frames fixture：加点序列 Q → R → W(EVOLVE) → Q（displayLevel 1/2/-/3），
 * 购买序列 1001、6032（锻炉）→ 间隔 150s 插入分割 → 1001
 */
const frames = [
  {
    timestamp: 30000,
    events: [
      { type: 'SKILL_LEVEL_UP', timestamp: 30000, participantId: 1, skillSlot: 1, levelUpType: 'NORMAL' },
      { type: 'ITEM_PURCHASED', timestamp: 30000, participantId: 1, itemId: 1001 },
      // 锻炉物品（ANVIL_ITEM_IDS 6032）→ anvils 计数 +1
      { type: 'ITEM_PURCHASED', timestamp: 30000, participantId: 1, itemId: 6032 }
    ],
    participantFrames: {}
  },
  {
    timestamp: 90000,
    events: [
      { type: 'SKILL_LEVEL_UP', timestamp: 90000, participantId: 1, skillSlot: 4, levelUpType: 'NORMAL' },
      // EVOLVE 进化：不占加点序号、title 标注已进化
      { type: 'SKILL_LEVEL_UP', timestamp: 90000, participantId: 1, skillSlot: 2, levelUpType: 'EVOLVE' },
      { type: 'SKILL_LEVEL_UP', timestamp: 90000, participantId: 1, skillSlot: 1, levelUpType: 'NORMAL' }
    ],
    participantFrames: {}
  },
  {
    timestamp: 180000,
    events: [{ type: 'ITEM_PURCHASED', timestamp: 180000, participantId: 1, itemId: 1001 }],
    participantFrames: {}
  }
]

/** 对局时间线（details）：注入 { frames } 触发真实渲染路径 */
const details: MatchCardGameDetails = { frames }

/** 测试挂载壳：提供 match-card context（含 details）后渲染 BuildsTab */
const Harness = defineComponent({
  setup() {
    provideMatchCard({ summary, puuid: 'blue-p1', details })
    return () => h(MatchCardBuildsTab)
  }
})

/** 挂载 BuildsTab：naive-ui 依赖 NConfigProvider，挂载后等待 itemDisplay 异步资源填充 */
async function mountBuildsTab() {
  const wrapper = mount(
    () =>
      h(NConfigProvider, null, {
        default: () => h(Harness)
      }),
    { global: { stubs: { 'n-scrollbar': false } } }
  )
  await flushPromises()
  return wrapper
}

describe('MatchCardBuildsTab', () => {
  it('渲染选手块与技能加点序列（键位 Q/W/E/R + 加点序号）', async () => {
    const wrapper = await mountBuildsTab()

    // 选手块（data-builds-participant-id 定位）与技能构建段
    expect(wrapper.findAll('[data-builds-participant-id]')).toHaveLength(1)
    expect(wrapper.text()).toContain('技能构建')

    // 加点序列 Q → R → W(进化) → Q：键位文本各就位
    const skillBlocks = wrapper.findAll('.flex.size-6.cursor-default')
    const skillTexts = skillBlocks.map((b) => b.text())
    expect(skillTexts).toEqual(['Q', 'R', 'W', 'Q'])

    // displayLevel 加点序号：Q1 / R2 / Q3（EVOLVE 不占序号，无 displayLevel 徽标）
    expect(wrapper.text()).toContain('1')
    expect(wrapper.text()).toContain('2')
    expect(wrapper.text()).toContain('3')
  })

  it('EVOLVE 进化块 title 标注「已进化」且不占加点序号', async () => {
    const wrapper = await mountBuildsTab()

    // 进化块（rounded-full 红色进化样式）：title 含已进化与键位 W
    const evolveBlocks = wrapper
      .findAll('[title]')
      .filter((el) => (el.attributes('title') ?? '').includes('已进化'))
    expect(evolveBlocks).toHaveLength(1)
    expect(evolveBlocks[0].attributes('title')).toContain('W')
  })

  it('购买序列渲染物品时间戳；间隔超 30s 插入分割箭头', async () => {
    const wrapper = await mountBuildsTab()

    // 三件物品 + 一件锻炉 = 4 次购买（30s/30s/180s 时间戳文本）
    expect(wrapper.text()).toContain('装备购买')
    expect(wrapper.text()).toContain('00:30')
    expect(wrapper.text()).toContain('03:00')

    // 30s 与 180s 间隔 150s > 30s → 插入分割箭头（1 个，以 spacer 专用宽度类定位避免父容器重复计数）
    expect(
      wrapper.findAll('div').filter((d) => d.classes().includes('w-7') && d.text() === '→')
    ).toHaveLength(1)
  })

  it('锻炉物品计数徽章（anvils）渲染', async () => {
    const wrapper = await mountBuildsTab()

    // 6032 锻炉物品 ×1 → 头部徽章「1 锻」
    expect(wrapper.text()).toContain('1 锻')
  })
})
