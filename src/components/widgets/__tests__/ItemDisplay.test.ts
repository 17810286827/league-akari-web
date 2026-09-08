/**
 * ItemDisplay 组件测试（合成路径回归）
 * 覆盖：from 合成小件渲染、to 为空（CDragon 老格式数字 0 已归一）时不渲染去向行且不抛错、
 * from 为空时不渲染合成行
 */
import { flushPromises, mount } from '@vue/test-utils'
import { NConfigProvider } from 'naive-ui'
import { h } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// mock 数据层：from/to 由 game-resource 归一化后必为数组（数字 0 已归一为 []）
vi.mock('@/utils/game-resource', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/game-resource')>()
  return {
    ...actual,
    itemDisplay: vi.fn()
  }
})

import { itemDisplay } from '@/utils/game-resource'
import ItemDisplay from '../ItemDisplay.vue'

describe('ItemDisplay 合成路径', () => {
  // NPopover teleport 到 body：每个用例后清理，避免上个用例的 popover 残留影响断言
  afterEach(() => {
    document.body.innerHTML = ''
  })

  beforeEach(() => {
    vi.mocked(itemDisplay).mockResolvedValue({
      id: 3089,
      name: '灭世者的死亡之帽',
      iconUrl: '',
      iconSources: ['/icons/item/3089.png', 'https://ddragon.example/img/item/3089.png'],
      descriptionHtml: '大幅提升法术强度',
      price: 1200,
      totalPrice: 3600,
      from: [
        { id: 1058, name: '灭世法典', iconPath: '/lol-game-data/assets/ASSETS/Items/Icons2D/1058_mage_t1_amplifyingtome.png' },
        { id: 1058, name: '灭世法典', iconPath: '/lol-game-data/assets/ASSETS/Items/Icons2D/1058_mage_t1_amplifyingtome.png' }
      ],
      to: []
    })
  })

  it('悬浮后渲染 from 合成小件图标（2 个），to 为空数组时不渲染去向行', async () => {
    const wrapper = mount(() =>
      h(NConfigProvider, null, { default: () => h(ItemDisplay, { itemId: 3089, size: 24 }) })
    )
    await flushPromises()

    // 触发 popover 显示（NPopover 惰性渲染，teleport 到 body）
    await wrapper.get('img').trigger('mouseenter')
    await vi.waitFor(() => {
      // from 行渲染 2 个小件图标（iconPath 经 CdnImage 转换）
      const fromImgs = document.body.querySelectorAll('.from img')
      expect(fromImgs.length).toBe(2)
      expect((fromImgs[0] as HTMLImageElement).src).toContain('1058_mage_t1_amplifyingtome.png')
    })

    // to 为空数组：不渲染 to 行
    expect(document.body.querySelectorAll('.to')).toHaveLength(0)

    // 弹窗主体（名称/总价）正常渲染
    expect(document.body.textContent).toContain('灭世者的死亡之帽')
    expect(document.body.textContent).toContain('3600')
  })

  it('from 为空时不渲染 from 行（不报错）', async () => {
    vi.mocked(itemDisplay).mockResolvedValueOnce({
      id: 1001,
      name: '鞋子',
      iconUrl: '',
      iconSources: ['/icons/item/1001.png'],
      descriptionHtml: '移动速度',
      price: 300,
      totalPrice: 300,
      from: [],
      to: []
    })
    const wrapper = mount(() =>
      h(NConfigProvider, null, { default: () => h(ItemDisplay, { itemId: 1001, size: 24 }) })
    )
    await flushPromises()

    await wrapper.get('img').trigger('mouseenter')
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('鞋子')
    })

    expect(document.body.querySelectorAll('.from')).toHaveLength(0)
    expect(document.body.querySelectorAll('.to')).toHaveLength(0)
  })

  it('本地镜像缺失时逐级回退：本地 → DDragon → CDragon（ADR 0004 三级链）', async () => {
    // 新装备场景：本地未同步（新版本装备）+ ddragon 图标 404，逐级回退到 CDragon 兜底
    vi.mocked(itemDisplay).mockResolvedValueOnce({
      id: 226668,
      name: '终极九头蛇',
      iconUrl: 'https://ddragon.leagueoflegends.com/cdn/16.16.1/img/item/226668.png',
      fallbackIconUrl:
        'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/items/icons2d/kiwi/aram_ultimatehydra_64.png',
      iconSources: [
        '/icons/item/226668.png',
        'https://ddragon.leagueoflegends.com/cdn/16.16.1/img/item/226668.png',
        'https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/items/icons2d/kiwi/aram_ultimatehydra_64.png'
      ],
      descriptionHtml: '',
      price: 0,
      totalPrice: 2500,
      from: [],
      to: []
    })
    const wrapper = mount(() =>
      h(NConfigProvider, null, { default: () => h(ItemDisplay, { itemId: 226668, size: 24 }) })
    )
    await flushPromises()

    // 第一级（本地）失败：回退 DDragon
    await wrapper.get('img').trigger('error')
    expect(wrapper.get('img').attributes('src')).toContain('/16.16.1/img/item/226668.png')
    // 第二级（DDragon）失败：回退 CDragon 兜底地址
    await wrapper.get('img').trigger('error')
    expect(wrapper.get('img').attributes('src')).toContain('aram_ultimatehydra_64.png')
  })
})
