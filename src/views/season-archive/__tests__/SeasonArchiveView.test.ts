/**
 * SeasonArchiveView 组件测试（工单 #53：赛季资料）：
 * 覆盖装载与默认选中（最新版本/第一个英雄）、覆盖率口径行、版本切换重拉、
 * 排序切换、小样本沉底降透明、悬停走势卡（SVG 曲线 + 当前版本标记）、
 * 空数据降级、错误提示、互跳入口。
 * AugmentDisplay/ChampionIcon 为资源加载组件，stub 掉（断言聚焦本页数据/交互）。
 */
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import type { SeasonArchive } from '@/api/team'
import SeasonArchiveView from '../SeasonArchiveView.vue'

// mock 数据层
vi.mock('@/api/team', () => ({
  getSeasonArchive: vi.fn(),
  apiErrorMessage: (error: unknown, fallback: string) =>
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
}))

// mock 路由
const routerPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush })
}))

// 资源组件 stub（外部依赖不进本测试面）
vi.mock('@/components/widgets/AugmentDisplay.vue', () => ({
  default: { name: 'AugmentDisplay', props: ['augmentId', 'size'], template: '<span class="aug-stub" />' }
}))
vi.mock('@/components/widgets/ChampionIcon.vue', () => ({
  default: { name: 'ChampionIcon', props: ['championId', 'stretched'], template: '<span class="champ-stub" />' }
}))

import { getSeasonArchive } from '@/api/team'

/** 夹具：两个版本 + 悟空（含小样本强化/多版本序列）+ 锐雯 */
function fixture(): SeasonArchive {
  return {
    versions: ['16.14', '16.15'],
    selectedVersion: '16.15',
    coverage: { includedGames: 10, kiwiNoAugmentGames: 2, outsideQueueAugmentRows: 1 },
    champions: [
      {
        championId: 62,
        championName: '孙悟空',
        games: 8,
        augments: [
          {
            augmentId: 777,
            games: 6,
            wins: 4,
            winRate: 4 / 6,
            appearanceRate: 6 / 8,
            byVersion: { '16.14': [4, 3], '16.15': [6, 4] }
          },
          {
            augmentId: 888,
            games: 2,
            wins: 2,
            winRate: 1.0,
            appearanceRate: 2 / 8,
            byVersion: { '16.15': [2, 2] }
          }
        ]
      },
      {
        championId: 92,
        championName: '锐雯',
        games: 2,
        augments: [
          {
            augmentId: 999,
            games: 2,
            wins: 1,
            winRate: 0.5,
            appearanceRate: 1.0,
            byVersion: { '16.15': [2, 1] }
          }
        ]
      }
    ]
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  routerPush.mockClear()
})

describe('SeasonArchiveView', () => {
  it('挂载即拉取并渲染：默认选中最新版本与首个英雄，覆盖率行可见', async () => {
    vi.mocked(getSeasonArchive).mockResolvedValue(fixture())
    const wrapper = mount(SeasonArchiveView)
    await flushPromises()

    // 请求一次，version 参数缺省（后端默认最新）
    expect(getSeasonArchive).toHaveBeenCalledTimes(1)
    expect(getSeasonArchive).toHaveBeenCalledWith(undefined)

    // 覆盖率口径行
    expect(wrapper.find('[data-testid="archive-coverage"]').text()).toContain('纳入 10 局')
    expect(wrapper.find('[data-testid="archive-coverage"]').text()).toContain('无强化数据 2 局')
    // 标题：悟空 · 16.15（默认选中第一个英雄 + 最新版本）
    expect(wrapper.find('h2').text()).toContain('孙悟空')
    expect(wrapper.find('h2').text()).toContain('16.15')
    // 版本 pills 两个选项
    expect(wrapper.find('[data-testid="version-16.14"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="version-16.15"]').exists()).toBe(true)
  })

  it('点击版本 pill 重拉该版本截面', async () => {
    vi.mocked(getSeasonArchive).mockResolvedValue(fixture())
    const wrapper = mount(SeasonArchiveView)
    await flushPromises()

    await wrapper.find('[data-testid="version-16.14"]').trigger('click')
    await flushPromises()
    // 第二次请求携带 16.14
    expect(getSeasonArchive).toHaveBeenLastCalledWith('16.14')
  })

  it('小样本行（局数<3）降透明度并沉底；默认按出场次数降序', async () => {
    vi.mocked(getSeasonArchive).mockResolvedValue(fixture())
    const wrapper = mount(SeasonArchiveView)
    await flushPromises()

    const rows = wrapper.findAll('[data-testid^="aug-row-"]')
    expect(rows).toHaveLength(2)
    // 777（6 局）在前，888（2 局小样本）沉底
    expect(rows[0].attributes('data-testid')).toBe('aug-row-777')
    expect(rows[1].attributes('data-testid')).toBe('aug-row-888')
    // 小样本行带降透明度类
    expect(rows[1].classes()).toContain('opacity-45')
    expect(rows[0].classes()).not.toContain('opacity-45')
  })

  it('悬停强化行弹出走势卡：含平滑曲线 SVG 与当前版本金色虚线标记', async () => {
    vi.mocked(getSeasonArchive).mockResolvedValue(fixture())
    const wrapper = mount(SeasonArchiveView)
    await flushPromises()

    // 悬停前无走势卡
    expect(wrapper.find('[data-testid="trend-popover"]').exists()).toBe(false)
    // 悬停 777 行（两版本全有数据 → 贝塞尔曲线 + 每点胜率数字）
    await wrapper.find('[data-testid="aug-row-777"]').trigger('mouseenter', {
      clientX: 400,
      clientY: 300
    })
    const popover = wrapper.find('[data-testid="trend-popover"]')
    expect(popover.exists()).toBe(true)
    const svg = popover.find('svg')
    expect(svg.exists()).toBe(true)
    // 平滑曲线：path 含 C 指令（Catmull-Rom 转 Bezier）
    const pathD = svg.find('path').attributes('d') || ''
    expect(pathD).toContain(' C ')
    // 每点胜率数字：777 两个版本 75%（16.14 3/4）与 67%（16.15 4/6）
    const texts = svg.findAll('text').map((t) => t.text())
    expect(texts).toContain('75%')
    expect(texts).toContain('67%')
    // 当前版本（16.15）金色虚线标记
    const marker = svg.findAll('line').find((l) => (l.attributes('stroke') || '').includes('#c8aa6e'))
    expect(marker).toBeDefined()
    // 离开行收起
    await wrapper.find('[data-testid="aug-row-777"]').trigger('mouseleave')
    expect(wrapper.find('[data-testid="trend-popover"]').exists()).toBe(false)
  })

  it('切换英雄：右侧强化榜切换为该英雄条目', async () => {
    vi.mocked(getSeasonArchive).mockResolvedValue(fixture())
    const wrapper = mount(SeasonArchiveView)
    await flushPromises()

    await wrapper.find('[data-testid="champ-92"]').trigger('click')
    expect(wrapper.find('h2').text()).toContain('锐雯')
    // 锐雯只有 999 一个强化
    expect(wrapper.find('[data-testid="aug-row-999"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="aug-row-777"]').exists()).toBe(false)
  })

  it('表头切换排序：按胜率排序时高胜率前置（小样本仍沉底）', async () => {
    vi.mocked(getSeasonArchive).mockResolvedValue(fixture())
    const wrapper = mount(SeasonArchiveView)
    await flushPromises()

    // 默认 games：777 在前；切 winRate：888 是 100% 但 2 局小样本仍沉底 → 顺序不变
    // 夹具特意如此（验证小样本沉底优先于排序键）
    const heads = wrapper.findAll('th')
    await heads[2].trigger('click')   // 胜率表头
    const rows = wrapper.findAll('[data-testid^="aug-row-"]')
    expect(rows[0].attributes('data-testid')).toBe('aug-row-777')
    expect(rows[1].attributes('data-testid')).toBe('aug-row-888')
  })

  it('空数据：展示空态而非报错', async () => {
    vi.mocked(getSeasonArchive).mockResolvedValue({
      versions: [],
      selectedVersion: null,
      coverage: { includedGames: 0, kiwiNoAugmentGames: 0, outsideQueueAugmentRows: 0 },
      champions: []
    })
    const wrapper = mount(SeasonArchiveView)
    await flushPromises()

    expect(wrapper.find('[data-testid="archive-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="archive-error"]').exists()).toBe(false)
  })

  it('装载失败：展示错误信息', async () => {
    vi.mocked(getSeasonArchive).mockRejectedValue({
      response: { data: { message: '统计失败' } }
    })
    const wrapper = mount(SeasonArchiveView)
    await flushPromises()

    expect(wrapper.find('[data-testid="archive-error"]').text()).toContain('统计失败')
  })

  it('互跳入口：赛季报告与主页按钮触发路由跳转', async () => {
    vi.mocked(getSeasonArchive).mockResolvedValue(fixture())
    const wrapper = mount(SeasonArchiveView)
    await flushPromises()

    await wrapper.find('[data-testid="go-season-report"]').trigger('click')
    expect(routerPush).toHaveBeenCalledWith('/season-report')
    await wrapper.find('[data-testid="go-home"]').trigger('click')
    expect(routerPush).toHaveBeenCalledWith('/')
  })
})
