/**
 * 数值格式化工具测试：format2（统一两位小数）与 formatStat（整数口径不带小数位）
 */
import { describe, expect, it } from 'vitest'

import { format2, formatStat } from '../format'

describe('format2', () => {
  it('数值保留两位小数；空值返回占位符', () => {
    expect(format2(7.88)).toBe('7.88')
    expect(format2(3)).toBe('3.00')
    expect(format2(null)).toBe('—')
    expect(format2(undefined, 'N/A')).toBe('N/A')
  })
})

describe('formatStat', () => {
  it('整数值（场数/次数类口径）不带小数位', () => {
    expect(formatStat(23)).toBe('23')
    expect(formatStat(3)).toBe('3')
    expect(formatStat(0)).toBe('0')
  })

  it('小数值（场均值/比率类口径）保留两位小数', () => {
    expect(formatStat(7.88)).toBe('7.88')
    expect(formatStat(7.5)).toBe('7.50')
    expect(formatStat(0.72)).toBe('0.72')
  })

  it('空值返回占位符', () => {
    expect(formatStat(null)).toBe('—')
    expect(formatStat(undefined)).toBe('—')
    expect(formatStat(Number.NaN)).toBe('—')
    expect(formatStat(null, 'N/A')).toBe('N/A')
  })
})
