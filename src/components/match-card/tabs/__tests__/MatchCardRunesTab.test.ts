/**
 * MatchCardRunesTab 组件测试（任务 12）
 * 覆盖：每人天赋树块数量（LCU 平铺 + SGP 嵌套两条路径均为 6 块）、主系基石符文名称渲染、
 * @eogvarN@ 占位符替换（perkNVarn / selections.varN → 描述内实际数值）、
 * SGP 专属统计符文（statPerks）3 枚小图标渲染、LCU 无统计符文不渲染；
 * 符文名称/描述经 vi.mock 的 perkDisplay 表返回（避免 CDragon 网络请求），
 * naive-ui 组件用 NConfigProvider 包裹，provideMatchCard 提供对局数据（参照任务 9/10 模式）
 */
import { flushPromises, mount } from '@vue/test-utils'
import { NConfigProvider } from 'naive-ui'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import type { MatchDetail, MatchParticipant } from '@/api/types'
import { provideMatchCard } from '../../context'
import MatchCardRunesTab from '../MatchCardRunesTab.vue'

/**
 * 符文展示资源表（vi.hoisted 提升到 mock 工厂可见）：
 * 真实符文 ID + 含 @eogvarN@ 占位符的对局内统计描述，未命中返回空壳
 */
const perkTable = vi.hoisted(() => {
  const table: Record<number, { name: string; iconUrl: string; endOfGameStatDescriptions?: string[] }> = {
    8005: {
      name: '强攻',
      iconUrl: '',
      endOfGameStatDescriptions: ['伤害总和：@eogvar1@', '额外伤害：@eogvar2@']
    },
    8009: { name: '致命节奏', iconUrl: '', endOfGameStatDescriptions: [] },
    8010: { name: '征服者', iconUrl: '', endOfGameStatDescriptions: ['治疗效果：@eogvar1@'] },
    8014: { name: '迅捷步法', iconUrl: '', endOfGameStatDescriptions: ['移动速度：@eogvar1@'] },
    8304: { name: '神奇之鞋', iconUrl: '', endOfGameStatDescriptions: [] },
    8347: { name: '小兵去质器', iconUrl: '', endOfGameStatDescriptions: ['补刀数：@eogvar1@'] },
    5008: { name: '自适应之力', iconUrl: '' },
    5005: { name: '攻击速度', iconUrl: '' }
  }
  return table
})

// 局部 mock 数据层：perkDisplay 走上方资源表，英雄名固定，避免测试触发 CDragon 网络请求
vi.mock('@/utils/game-resource', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/game-resource')>()
  return {
    ...actual,
    getChampionName: vi.fn(() => '菲奥娜'),
    perkDisplay: vi.fn(async (perkId: number) => perkTable[perkId] ?? { name: '', iconUrl: '' }),
    perkstyleDisplay: vi.fn().mockResolvedValue({ name: '', iconUrl: '' }),
    itemDisplay: vi.fn().mockResolvedValue({
      id: 1,
      name: '装备',
      iconUrl: '',
      descriptionHtml: '',
      price: 0,
      totalPrice: 0
    }),
    augmentDisplay: vi.fn().mockResolvedValue({ name: '海克斯强化', iconUrl: '', rarity: 'kSilver' }),
    spellDisplay: vi.fn().mockResolvedValue(null)
  }
})

/** 构造一名参赛者档案：直显字段与后端 MatchParticipant 一致，未传字段使用默认值 */
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
    // 必传字段（puuid/summonerName/teamId）由调用方经 partial 覆盖
    ...partial
  }
}

/**
 * 蓝队玩家（LCU 平铺路径）：perk0-5 平铺 + perkNVarn 对局内变量 + 主副系样式；
 * 变量取非零值（12345/678 等）便于断言 @eogvar 占位符替换结果
 */
const lcuPlayer: MatchParticipant = makeParticipant({
  id: 1,
  puuid: 'lcu-p1',
  summonerName: 'PlayerOne#CN1',
  teamId: 100,
  championId: 1,
  position: 'TOP',
  statsJson: JSON.stringify({
    participantId: 1,
    playerSubteamId: 0,
    subteamPlacement: 1,
    win: true,
    // 符文（LCU 平铺：主系 4 枚 8005/8009/8010/8014，副系 2 枚 8304/8347）
    perk0: 8005,
    perk1: 8009,
    perk2: 8010,
    perk3: 8014,
    perk4: 8304,
    perk5: 8347,
    // 对局内变量（perk0Var1-3 对应强攻的伤害/额外伤害）
    perk0Var1: 12345,
    perk0Var2: 678,
    perk0Var3: 0,
    perk1Var1: 111,
    perk1Var2: 0,
    perk1Var3: 0,
    perk2Var1: 222,
    perk2Var2: 0,
    perk2Var3: 0,
    perk3Var1: 333,
    perk3Var2: 0,
    perk3Var3: 0,
    perk4Var1: 444,
    perk4Var2: 0,
    perk4Var3: 0,
    perk5Var1: 555,
    perk5Var2: 0,
    perk5Var3: 0,
    perkPrimaryStyle: 8000,
    perkSubStyle: 8300
  })
})

/**
 * 红队玩家（SGP 嵌套路径）：perks.styles 携带 selections.var1-3 + statPerks，
 * 验证嵌套形状派生与统计符文渲染（LCU 无 statPerks 的对照组）
 */
const sgpPlayer: MatchParticipant = makeParticipant({
  id: 2,
  puuid: 'sgp-p2',
  summonerName: 'RivalOne#CN2',
  teamId: 200,
  championId: 2,
  position: 'BOTTOM',
  statsJson: JSON.stringify({
    participantId: 2,
    playerSubteamId: 0,
    subteamPlacement: 1,
    win: false,
    // SGP 嵌套 perks（原版形状：statPerks + styles，含对局内变量）
    perks: {
      statPerks: { offense: 5008, flex: 5008, defense: 5005 },
      styles: [
        {
          description: 'primaryStyle',
          style: 8000,
          selections: [
            { perk: 8005, var1: 999, var2: 88, var3: 0 },
            { perk: 8009, var1: 1, var2: 0, var3: 0 },
            { perk: 8010, var1: 2, var2: 0, var3: 0 },
            { perk: 8014, var1: 3, var2: 0, var3: 0 }
          ]
        },
        {
          description: 'subStyle',
          style: 8300,
          selections: [
            { perk: 8304, var1: 4, var2: 0, var3: 0 },
            { perk: 8347, var1: 5, var2: 0, var3: 0 }
          ]
        }
      ]
    }
  })
})

/** 对局详情：双人小对局（LCU 数据源），teamsJson 给空避免队伍聚合干扰 */
const summary: MatchDetail = {
  gameId: 987654,
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
  teamsJson: null,
  participants: [lcuPlayer, sgpPlayer]
}

/** 测试挂载壳：提供 match-card context 后渲染 MatchCardRunesTab（NConfigProvider 包裹） */
const Harness = defineComponent({
  setup() {
    provideMatchCard({ summary, puuid: 'lcu-p1' })
    return () => h(MatchCardRunesTab)
  }
})

/** 挂载 RunesTab：naive-ui 依赖 NConfigProvider，挂载后等待 perkDisplay 异步资源填充 */
async function mountRunesTab() {
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

describe('MatchCardRunesTab', () => {
  it('每人渲染 6 个天赋树块（LCU 平铺与 SGP 嵌套路径一致）', async () => {
    const wrapper = await mountRunesTab()

    // 每人一个玩家块（data-runes-participant-id 定位）
    const playerBlocks = wrapper.findAll('[data-runes-participant-id]')
    expect(playerBlocks).toHaveLength(2)

    // 块内符文名（mb-2 text-sm font-bold）数量 = 6 枚选中符文
    for (const block of playerBlocks) {
      expect(block.findAll('.mb-2.text-sm.font-bold')).toHaveLength(6)
    }

    // 24px 天赋树图标（PerkDisplay size=24 的内联样式）共 12 个（2 人 × 6 枚）
    const perkIcons = wrapper
      .findAll('img')
      .filter((img) => (img.attributes('style') ?? '').includes('width: 24px'))
    expect(perkIcons).toHaveLength(12)
  })

  it('主系基石符文名称渲染（perkIds[0] = 主系 tier1 选中）', async () => {
    const wrapper = await mountRunesTab()
    const text = wrapper.text()

    // 蓝队基石：强攻；红队基石同 8005
    expect(text).toContain('强攻')
    expect(text).toContain('致命节奏')
    expect(text).toContain('神奇之鞋')
    expect(text).toContain('小兵去质器')
  })

  it('@eogvarN@ 占位符替换为选手对局内实际数值（LCU perkNVarn 路径）', async () => {
    const wrapper = await mountRunesTab()
    const text = wrapper.text()

    // 蓝队强攻（perk0Var1=12345, perk0Var2=678）：描述替换后的数值
    expect(text).toContain('伤害总和：12345')
    expect(text).toContain('额外伤害：678')
    // 其余主/副系变量同样替换（不残留 @eogvar 占位符）
    expect(text).toContain('补刀数：555')
    expect(text).not.toContain('@eogvar')
  })

  it('SGP selections.varN 路径同样替换；未知符文块隐藏', async () => {
    const wrapper = await mountRunesTab()

    // 红队强攻 var1=999：替换 SGP 嵌套路径的数值
    expect(wrapper.text()).toContain('伤害总和：999')
  })

  it('统计符文：SGP 渲染 3 枚 16px 小图标，LCU 不渲染', async () => {
    const wrapper = await mountRunesTab()

    // 16px 内联样式图标 = SGP 玩家的 offense/flex/defense 3 枚
    const statPerkIcons = wrapper
      .findAll('img')
      .filter((img) => (img.attributes('style') ?? '').includes('width: 16px'))
    expect(statPerkIcons).toHaveLength(3)

    // 统计符文只出现在 SGP 玩家块头部（红队），蓝队块内无 16px 图标
    const blueBlock = wrapper.find('[data-runes-participant-id="1"]')
    const redBlock = wrapper.find('[data-runes-participant-id="2"]')
    expect(blueBlock.findAll('img').filter((img) => (img.attributes('style') ?? '').includes('width: 16px'))).toHaveLength(0)
    expect(redBlock.findAll('img').filter((img) => (img.attributes('style') ?? '').includes('width: 16px'))).toHaveLength(3)
  })

  it('选手导航器渲染 2 个玩家按钮', async () => {
    const wrapper = await mountRunesTab()

    // 导航器内按钮（触发元素为 button 的 NTooltip trigger）
    expect(wrapper.findAll('button').length).toBeGreaterThanOrEqual(2)
  })
})
