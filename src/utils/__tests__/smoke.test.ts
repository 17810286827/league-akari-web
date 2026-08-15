import { describe, expect, it } from 'vitest'

describe('测试基础设施', () => {
  it('vitest + jsdom 正常工作', () => {
    const el = document.createElement('div')
    el.textContent = 'ok'
    expect(el.textContent).toBe('ok')
  })
})
