import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CdnImage from '../CdnImage.vue'

describe('CdnImage', () => {
  it('把 LCU 资源路径转换为 CDN URL 并渲染 img', () => {
    const wrapper = mount(CdnImage, {
      props: { path: '/lol-game-data/assets/v1/champion-icons/103.png' }
    })
    const img = wrapper.get('img')
    expect(img.attributes('src')).toContain('champion-icons/103.png')
    expect(img.attributes('src')).toMatch(/^https?:/)
  })
})
