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

/**
 * 兜底降级链路测试（装备图标双源策略）：
 * 主源（Data Dragon）404（如写死版本落后缺新装备图标）→ 换 fallback 重试一次 →
 * 兜底也失败才渲染灰占位。覆盖三级语义与 path 变化时的状态重置。
 */
describe('CdnImage 兜底降级', () => {
  /** 触发当前渲染的 img 的 @error 事件（模拟主源/兜底源加载失败） */
  async function failCurrentImage(wrapper: ReturnType<typeof mount>) {
    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    await img.trigger('error')
    await wrapper.vm.$nextTick()
  }

  it('无 fallback 属性：加载失败直接渲染灰占位（向后兼容旧行为）', async () => {
    const wrapper = mount(CdnImage, { props: { path: 'https://cdn.example/a.png' } })
    await failCurrentImage(wrapper)
    // 失败后无 img，仅剩占位 div
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('.cdn-image-placeholder').exists()).toBe(true)
  })

  it('有 fallback：主源失败换兜底源重试，兜底也失败才渲染灰占位', async () => {
    const wrapper = mount(CdnImage, {
      props: {
        path: 'https://ddragon.example/img/item/226668.png',
        fallback: 'https://cdragon.example/assets/items/aram_ultimatehydra_64.png'
      }
    })
    // 第一级：主源失败 → 换兜底源（img 仍在，src 切换为 fallback）
    await failCurrentImage(wrapper)
    expect(wrapper.find('.cdn-image-placeholder').exists()).toBe(false)
    expect(wrapper.find('img').attributes('src')).toBe(
      'https://cdragon.example/assets/items/aram_ultimatehydra_64.png'
    )
    // 第二级：兜底源也失败 → 灰占位
    await failCurrentImage(wrapper)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('.cdn-image-placeholder').exists()).toBe(true)
  })

  it('path 变化时重置失败状态：切回新主源重新加载', async () => {
    const wrapper = mount(CdnImage, {
      props: { path: 'https://cdn.example/a.png', fallback: 'https://cdn.example/a-fb.png' }
    })
    await failCurrentImage(wrapper)
    // 已处于兜底态
    expect(wrapper.find('img').attributes('src')).toBe('https://cdn.example/a-fb.png')
    // path 更新 → 失败状态重置，img 回到主源
    await wrapper.setProps({ path: 'https://cdn.example/b.png' })
    expect(wrapper.find('img').attributes('src')).toBe('https://cdn.example/b.png')
  })
})
