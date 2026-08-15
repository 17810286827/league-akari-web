/**
 * CdnImage 组件测试：验证 LCU 资源路径经 resolveAssetUrl
 * 转换为 CDN URL 后正确渲染到 img 的 src
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
})
