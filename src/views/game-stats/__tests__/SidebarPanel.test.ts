/**
 * SidebarPanel 组件测试（左侧边栏：筛选区 + 总览 + 最近队友/对手）
 * 覆盖英雄筛选磁贴墙（issue #1 实时匹配方案）：
 * - 称号片段/本名/英文大小写关键字实时过滤磁贴
 * - 点选磁贴 → champion model 更新为该英雄 id；再点取消回到 null
 * - "所有英雄"磁贴常驻首位，点击置 null
 * - 无匹配时空态文案
 * mock @/utils/game-resource 的 listChampionOptions（避免 CDragon 网络请求），
 * 队列/总览/队友数据用最小 fixture；championIconUrl 走真实实现（仅拼 URL 无网络）
 */
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { listChampionOptions } from '@/utils/game-resource'

import SidebarPanel from '../SidebarPanel.vue'

// mock 英雄选项数据源：固定 3 个英雄，供称号/本名/大小写匹配断言
vi.mock('@/utils/game-resource', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/game-resource')>()
  return {
    ...actual,
    listChampionOptions: vi.fn()
  }
})

/** 最小页面数据 fixture：总览全零 + 空队友/对手（本测试只关注英雄筛选区） */
const DATA_FIXTURE = {
  rankSections: [],
  overview: {
    akariScore: null,
    avgKda: 0,
    participation: 0,
    damageShare: 0,
    damageTakenShare: 0,
    goldShare: 0,
    csPerMin: 0,
    wins: 0,
    losses: 0,
    lineupChampionIds: []
  },
  recentTeammates: [],
  recentOpponents: []
}

/** 挂载侧栏：注入页面数据与总条数，v-model:champion 双向绑定由 defineModel 提供 */
function mountPanel() {
  return mount(SidebarPanel, {
    props: {
      data: DATA_FIXTURE,
      total: 0
    }
  })
}

/** 读取英雄搜索输入框（磁贴墙过滤关键字） */
function getSearchInput(wrapper: ReturnType<typeof mountPanel>) {
  const input = wrapper.find('input.champion-search')
  if (!input.exists()) throw new Error('英雄搜索输入框未渲染')
  return input
}

describe('SidebarPanel 英雄筛选磁贴墙', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 默认 3 个英雄：称号/本名各异，覆盖三种关键字路径
    vi.mocked(listChampionOptions).mockResolvedValue([
      { id: 266, label: '亚托克斯', title: '暗裔剑魔' },
      { id: 13, label: '瑞兹', title: '符文法师' },
      { id: 157, label: '亚索', title: '疾风剑豪' }
    ])
  })

  it('初始渲染：磁贴墙含"所有英雄"占位与全部英雄磁贴（按选项升序）', async () => {
    const wrapper = mountPanel()
    await flushPromises()
    const labels = wrapper.findAll('.tile-label').map((n) => n.text())
    expect(labels).toEqual(['所有英雄', '亚托克斯', '瑞兹', '亚索'])
  })

  it('输入称号片段（剑魔）实时过滤出唯一目标英雄（"所有英雄"占位常驻）', async () => {
    const wrapper = mountPanel()
    await flushPromises()
    await getSearchInput(wrapper).setValue('剑魔')
    const labels = wrapper.findAll('.tile-label').map((n) => n.text())
    expect(labels).toEqual(['所有英雄', '亚托克斯'])
  })

  it('输入本名（亚托克斯）同样命中该英雄', async () => {
    const wrapper = mountPanel()
    await flushPromises()
    await getSearchInput(wrapper).setValue('亚托克斯')
    const labels = wrapper.findAll('.tile-label').map((n) => n.text())
    expect(labels).toEqual(['所有英雄', '亚托克斯'])
  })

  it('输入英文不区分大小写匹配（RYZE→瑞兹）', async () => {
    // 选项 label/title 均为中文时英文不命中——此处验证大小写不敏感规则本身：
    // 构造一条含英文的称号，确保大写输入可命中小写数据
    vi.mocked(listChampionOptions).mockResolvedValue([
      { id: 13, label: '瑞兹', title: 'Ryze' }
    ])
    const wrapper = mountPanel()
    await flushPromises()
    await getSearchInput(wrapper).setValue('RYZE')
    const labels = wrapper.findAll('.tile-label').map((n) => n.text())
    expect(labels).toEqual(['所有英雄', '瑞兹'])
  })

  it('清空输入恢复展示全部英雄', async () => {
    const wrapper = mountPanel()
    await flushPromises()
    await getSearchInput(wrapper).setValue('剑魔')
    await getSearchInput(wrapper).setValue('')
    const labels = wrapper.findAll('.tile-label').map((n) => n.text())
    expect(labels).toEqual(['所有英雄', '亚托克斯', '瑞兹', '亚索'])
  })

  it('点选磁贴 → champion model 更新为该英雄 id；再点同一磁贴取消回到 null', async () => {
    const wrapper = mountPanel()
    await flushPromises()
    // 点"亚托克斯"磁贴（含匹配计数区,先定位含该文本的磁贴按钮）
    await wrapper.findAll('.tile').find((n) => n.text().includes('亚托克斯'))!.trigger('click')
    expect(wrapper.emitted('update:champion')?.at(-1)).toEqual([266])
    // 再点同一磁贴 = 取消筛选
    await wrapper.findAll('.tile').find((n) => n.text().includes('亚托克斯'))!.trigger('click')
    expect(wrapper.emitted('update:champion')?.at(-1)).toEqual([null])
  })

  it('已选中英雄时点"所有英雄"磁贴 → champion 置 null', async () => {
    const wrapper = mountPanel()
    await flushPromises()
    // 先选中一个英雄，再点"所有英雄"取消（已是 null 时再点不触发 update，Vue 无变化不 emit）
    await wrapper.findAll('.tile').find((n) => n.text().includes('亚托克斯'))!.trigger('click')
    expect(wrapper.emitted('update:champion')?.at(-1)).toEqual([266])
    await wrapper.findAll('.tile').find((n) => n.text().includes('所有英雄'))!.trigger('click')
    expect(wrapper.emitted('update:champion')?.at(-1)).toEqual([null])
  })

  it('选中英雄后磁贴出现选中态（绿描边 class）', async () => {
    const wrapper = mountPanel()
    await flushPromises()
    const tile = wrapper.findAll('.tile').find((n) => n.text().includes('亚托克斯'))!
    await tile.trigger('click')
    // v-model 双向绑定:emitted 后组件内部 champion 已更新(等下一次渲染)
    await flushPromises()
    expect(wrapper.findAll('.tile').find((n) => n.text().includes('亚托克斯'))!.classes()).toContain('selected')
  })

  it('无匹配关键字显示空态文案', async () => {
    const wrapper = mountPanel()
    await flushPromises()
    await getSearchInput(wrapper).setValue('不存在的英雄')
    expect(wrapper.text()).toContain('无匹配英雄')
  })

  it('英雄数据加载失败：不渲染磁贴（空态），不抛错', async () => {
    vi.mocked(listChampionOptions).mockResolvedValue([])
    const wrapper = mountPanel()
    await flushPromises()
    // 数据为空时磁贴区不渲染英雄项（不阻断侧栏其它区块）
    expect(wrapper.findAll('.tile').length).toBe(0)
  })
})
