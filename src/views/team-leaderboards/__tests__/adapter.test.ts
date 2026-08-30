/**
 * 榜单中心 adapter 单元测试：时间范围 → 查询参数的纯函数转换
 */
import { describe, expect, it } from 'vitest'

import { rangeToParams } from '../adapter'

describe('rangeToParams', () => {
  it('all → 不带时间参数', () => {
    expect(rangeToParams('all')).toEqual({})
  })

  it('season → 本自然年 1 月 1 日起', () => {
    const { start, end } = rangeToParams('season')
    expect(end).toBeUndefined()
    expect(new Date(start as number).getMonth()).toBe(0)
    expect(new Date(start as number).getDate()).toBe(1)
  })

  it('last30d → 起点距今约 30 天', () => {
    const { start } = rangeToParams('last30d')
    const diffDays = (Date.now() - (start as number)) / 86_400_000
    expect(diffDays).toBeGreaterThan(29.9)
    expect(diffDays).toBeLessThan(30.1)
  })

  it('custom → 自定义起止毫秒（本地时区当天 00:00）', () => {
    const { start, end } = rangeToParams('custom', '2026-08-01', '2026-08-31')
    expect(new Date(start as number).getDate()).toBe(1)
    expect(new Date(end as number).getDate()).toBe(31)
  })

  it('custom 缺省起止 → 均不限', () => {
    expect(rangeToParams('custom')).toEqual({})
  })
})
