/**
 * AugmentDisplay 组件冒烟测试：
 * 验证海克斯强化图标按稀有度渲染边框 class（1:1 还原原版稀有度视觉），
 * 以及悬浮弹出卡片中的名称渲染
 */
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 局部 mock 数据层：仅替换 augmentDisplay，保留 resolveAssetUrl 等其余导出（CdnImage 依赖）
vi.mock('@/utils/game-resource', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/game-resource')>()
  return {
    ...actual,
    augmentDisplay: vi.fn()
  }
})

import { augmentDisplay } from '@/utils/game-resource'
import AugmentDisplay from '../AugmentDisplay.vue'

describe('AugmentDisplay', () => {
  beforeEach(() => {
    vi.mocked(augmentDisplay).mockResolvedValue({
      name: '全凭身手',
      iconUrl: 'https://example.com/augment/30.png',
      rarity: 'kGold',
      descriptionHtml: '<p>击杀后回复生命</p>'
    })
  })

  it('kGold 稀有度渲染 gold 边框 class，悬浮后展示名称', async () => {
    const wrapper = mount(AugmentDisplay, { props: { augmentId: 30 } })
    await flushPromises()

    // 稀有度边框：kGold → .augment.gold（边框与底色样式由 .augment.gold 提供）
    const img = wrapper.get('img')
    expect(img.classes()).toContain('augment')
    expect(img.classes()).toContain('gold')
    expect(img.classes()).not.toContain('silver')

    // 名称渲染：悬浮触发 popover 后，teleport 到 body 的卡片内容包含强化名称
    await img.trigger('mouseenter')
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('全凭身手')
    })
  })

  it('augmentId 为空时渲染空槽占位（无图标与弹窗）', async () => {
    const wrapper = mount(AugmentDisplay, { props: { augmentId: 0 } })
    await flushPromises()
    // 空槽：渲染 .empty 占位 div，不渲染触发图标
    expect(wrapper.find('.empty').exists()).toBe(true)
    expect(wrapper.find('img').exists()).toBe(false)
  })
})
