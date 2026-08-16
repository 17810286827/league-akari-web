/**
 * HomeView 组件测试（首页搜索框）
 * 覆盖：输入"昵称#tag"搜索成功后跳转到玩家战绩页、搜索失败提示后端原因；
 * mock src/api/matches.ts 的 searchRiotAccount 与 vue-router，
 * naive-ui 组件用 NConfigProvider + NMessageProvider 包裹
 */
import { flushPromises, mount } from '@vue/test-utils'
import { NConfigProvider, NMessageProvider } from 'naive-ui'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'

import { searchRiotAccount } from '@/api/matches'

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
    // 默认：搜索成功返回固定账号
    vi.mocked(searchRiotAccount).mockResolvedValue({
      puuid: 'lcu-p1',
      gameName: 'PlayerOne',
      tagLine: 'CN1'
    })
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
})
