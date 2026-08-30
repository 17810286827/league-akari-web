/**
 * HomeView 组件测试（首页搜索框）
 * 覆盖：输入"昵称#tag"搜索成功后跳转到玩家战绩页、搜索失败提示后端原因、
 * 车队名单预置下拉框（聚焦展示/输入过滤/点击直达搜索/名单拉取失败静默降级）；
 * mock src/api/matches.ts 的 searchRiotAccount、src/api/team.ts 的 getTeamMembers 与 vue-router，
 * naive-ui 组件用 NConfigProvider + NMessageProvider 包裹
 */
import { flushPromises, mount } from '@vue/test-utils'
import { NConfigProvider, NMessageProvider } from 'naive-ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'

import { searchRiotAccount } from '@/api/matches'
import { getTeamMembers } from '@/api/team'

import HomeView from '../HomeView.vue'

// mock 路由：push 使用共享 mock，供跳转断言
const routerPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush })
}))

// mock API 层：搜索接口由各用例注入返回值
vi.mock('@/api/matches', () => ({
  searchRiotAccount: vi.fn()
}))

// mock 车队接口：名单预置下拉用
vi.mock('@/api/team', () => ({
  getTeamMembers: vi.fn()
}))

/** 车队名单夹具：三名成员 */
function rosterFixture() {
  return [
    { puuid: 'p1', riotId: '莽夫一诺#tw', games: 23, wins: 15, winRate: 0.65 },
    { puuid: 'p2', riotId: '草丛蹲神#tw', games: 20, wins: 9, winRate: 0.45 },
    { puuid: 'p3', riotId: '补刀机器人#tw', games: 21, wins: 13, winRate: 0.62 }
  ]
}

/** 挂载 HomeView：NConfigProvider + NMessageProvider 包裹（naive-ui 依赖） */
function mountView() {
  return mount(
    () =>
      h(NConfigProvider, null, {
        default: () => h(NMessageProvider, null, { default: () => h(HomeView) })
      }),
    {}
  )
}

describe('HomeView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 默认：搜索成功返回固定账号，车队名单返回三名成员
    vi.mocked(searchRiotAccount).mockResolvedValue({
      puuid: 'lcu-p1',
      gameName: 'PlayerOne',
      tagLine: 'CN1'
    })
    vi.mocked(getTeamMembers).mockResolvedValue(rosterFixture())
  })

  it('渲染居中搜索框（输入框 + 查询按钮）', () => {
    const wrapper = mountView()

    expect(wrapper.find('.search-input').exists()).toBe(true)
    expect(wrapper.find('.search-button').exists()).toBe(true)
    expect(wrapper.text()).toContain('LEAGUE')
  })

  it('输入"昵称#tag"搜索成功：跳转到玩家战绩页（携带昵称/尾号 query）', async () => {
    const wrapper = mountView()

    await wrapper.find('.search-input').setValue('赌书消得泼茶香#iKun')
    await wrapper.find('.search-button').trigger('click')
    await flushPromises()

    // 搜索接口按输入调用，成功后跳转战绩页路由
    expect(searchRiotAccount).toHaveBeenCalledWith('赌书消得泼茶香#iKun')
    expect(routerPush).toHaveBeenCalledWith({
      path: '/players/lcu-p1',
      query: { name: 'PlayerOne', tag: 'CN1' }
    })
  })

  it('搜索失败：提示后端返回的明确原因，不跳转', async () => {
    // 模拟后端 503（如 Riot API Key 未配置）与 404（召唤师不存在）
    vi.mocked(searchRiotAccount).mockRejectedValue({
      response: { data: { message: '召唤师不存在: Test#Tag' } }
    } as never)
    const wrapper = mountView()

    await wrapper.find('.search-input').setValue('Test#Tag')
    await wrapper.find('.search-button').trigger('click')
    await flushPromises()

    expect(routerPush).not.toHaveBeenCalled()
    // 错误提示经 NMessageProvider teleport 到 body，从 body 断言
    expect(document.body.textContent).toContain('召唤师不存在: Test#Tag')
  })

  it('聚焦输入框：下拉预置车队成员昵称', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.search-input').trigger('focus')

    const items = wrapper.findAll('[data-testid="roster-item"]')
    expect(items).toHaveLength(3)
    expect(items[0].text()).toContain('莽夫一诺#tw')
    expect(items[1].text()).toContain('草丛蹲神#tw')
  })

  it('点击下拉成员：填充输入框并直接发起搜索跳转', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.search-input').trigger('focus')
    await wrapper.findAll('[data-testid="roster-item"]')[1].trigger('click')
    await flushPromises()

    // 点击成员 = 以该成员昵称直接搜索
    expect(searchRiotAccount).toHaveBeenCalledWith('草丛蹲神#tw')
    expect(routerPush).toHaveBeenCalled()
  })

  it('输入过滤：下拉只显示匹配子串的成员', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.search-input').setValue('补刀')
    await wrapper.find('.search-input').trigger('focus')

    const items = wrapper.findAll('[data-testid="roster-item"]')
    expect(items).toHaveLength(1)
    expect(items[0].text()).toContain('补刀机器人#tw')
  })

  it('车队名单拉取失败：静默降级不渲染下拉，搜索功能不受影响', async () => {
    vi.mocked(getTeamMembers).mockRejectedValue(new Error('后端未启动'))
    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('.search-input').trigger('focus')
    expect(wrapper.find('[data-testid="roster-suggestions"]').exists()).toBe(false)

    // 搜索链路完好
    await wrapper.find('.search-input').setValue('Test#Tag')
    await wrapper.find('.search-button').trigger('click')
    await flushPromises()
    expect(searchRiotAccount).toHaveBeenCalledWith('Test#Tag')
  })
})
