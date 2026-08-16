/**
 * CdnImage 组件测试：验证 LCU 资源路径经 resolveAssetUrl
 * 转换为 CDN URL 后正确渲染到 img 的 src；
 * 已解析的完整 URL 直接透传（game-resource 的 iconUrl / gtimg 直链），
 * 图片加载失败时回退灰色占位（对齐原版 LcuImage 的 placeholder）
 */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CdnImage from '../CdnImage.vue'

describe('CdnImage', () => {
  it('把 LCU 资源路径转换为 CDN URL 并渲染 img', () => {
    // 断言依据：resolveAssetUrl 去前缀 + 小写化后，URL 仍包含路径末段文件名
    const wrapper = mount(CdnImage, {
      props: { path: '/lol-game-data/assets/v1/champion-icons/103.png' }
    })
    const img = wrapper.get('img')
    // 转换结果应为完整 CDN 地址（https 协议），而非 akari:// 协议
    expect(img.attributes('src')).toContain('champion-icons/103.png')
    expect(img.attributes('src')).toMatch(/^https?:/)
  })

  it('已解析的完整 URL 直接透传（不重复拼接 CDragon 根）', () => {
    // game-resource 的 iconUrl 已是完整 CDN 地址，path 语义与 LcuImage 的 src 一致
    const wrapper = mount(CdnImage, {
      props: { path: 'https://game.gtimg.cn/images/lol/act/img/rune/adapt_large.png' }
    })
    expect(wrapper.get('img').attributes('src')).toBe(
      'https://game.gtimg.cn/images/lol/act/img/rune/adapt_large.png'
    )
  })

  it('图片加载失败时回退灰色占位（同 LcuImage 的 placeholder）', async () => {
    // 失败后不再渲染 img，而是渲染占位 div
    const wrapper = mount(CdnImage, {
      props: { path: '/lol-game-data/assets/v1/champion-icons/103.png' }
    })
    // await trigger：等待 Vue 响应式更新完成后再断言
    await wrapper.get('img').trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('.cdn-image-placeholder').exists()).toBe(true)
  })
})
