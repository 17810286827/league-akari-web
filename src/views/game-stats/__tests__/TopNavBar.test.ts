/**
 * TopNavBar 组件测试（玩家详情页顶部导航）：
 * 覆盖"主页"按钮点击后 SPA 跳转回首页（router.push('/')）、刷新按钮向父组件发事件。
 * mock vue-router（与 GameStatsView.test 同一 mock 形态），玩家信息用最小 fixture。
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import TopNavBar from '../TopNavBar.vue'

// mock 路由：仅用到 useRouter().push
const routerPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush })
}))

/** 挂载组件：带一名查询玩家与一个段位板块 */
function mountNav() {
  return mount(TopNavBar, {
    props: {
      sections: [{ queue: '排位', tier: '黄金 IV', highestTier: '黄金 II' }],
      player: { name: '赌书消得泼茶香#iKun', profileIconId: 0, summonerLevel: 120 }
    }
  })
}

describe('TopNavBar', () => {
  it('点击"主页"按钮跳转回首页', async () => {
    const wrapper = mountNav()

    await wrapper.find('[data-testid="home-button"]').trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/')
  })

  it('点击刷新按钮向父组件发出 refresh 事件', async () => {
    const wrapper = mountNav()

    await wrapper.find('.refresh-btn').trigger('click')

    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })
})
