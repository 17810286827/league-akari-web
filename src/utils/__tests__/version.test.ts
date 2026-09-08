/**
 * 版本号语义比较测试（英雄池漂移排序用）：
 * 覆盖数字补丁（"16.15"）、2025 三赛季分段（"25.S1/S2/S3"）、
 * 历史遗留数字格式（"25.4"）与兜底（"未知版本"）的升序比较，
 * 确保漂移池"最新版本在顶上"的降序排序语义正确。
 */
import { describe, expect, it } from 'vitest'

import { compareVersions, sortVersionsDescending } from '../version'

describe('compareVersions（升序：旧 → 新）', () => {
  it('同一年内数字补丁按数值排序，避免字典序陷阱', () => {
    // "16.2" 应早于 "16.10"（2 < 10），字典序会把 "16.10" 排到 "16.2" 前面
    expect(compareVersions('16.2', '16.10')).toBeLessThan(0)
    expect(compareVersions('16.10', '16.2')).toBeGreaterThan(0)
    expect(compareVersions('16.14', '16.15')).toBeLessThan(0)
  })

  it('不同年份/赛季按主版本号升序', () => {
    expect(compareVersions('14.23', '16.1')).toBeLessThan(0)
    expect(compareVersions('16.15', '25.S1')).toBeLessThan(0)
    expect(compareVersions('25.S1', '16.15')).toBeGreaterThan(0)
  })

  it('2025 三赛季分段 S1 < S2 < S3', () => {
    expect(compareVersions('25.S1', '25.S2')).toBeLessThan(0)
    expect(compareVersions('25.S2', '25.S3')).toBeLessThan(0)
    expect(compareVersions('25.S1', '25.S3')).toBeLessThan(0)
  })

  it('同年内历史遗留数字格式（25.4）早于分段格式（25.S1）', () => {
    // "25.4" 为旧数字编码的异常数据，排在正式分段之前，保证不污染分段顺序
    expect(compareVersions('25.4', '25.S1')).toBeLessThan(0)
  })

  it('相同版本相等；未知版本兜底排最旧', () => {
    expect(compareVersions('16.15', '16.15')).toBe(0)
    expect(compareVersions('未知版本', '16.15')).toBeLessThan(0)
    expect(compareVersions('未知版本', '25.S1')).toBeLessThan(0)
  })
})

describe('sortVersionsDescending（最新在顶上）', () => {
  it('混合格式降序：最新分段在最前，未知版本沉底', () => {
    const sorted = sortVersionsDescending([
      '25.4',
      '16.15',
      '25.S1',
      '未知版本',
      '25.S3',
      '25.S2'
    ])
    expect(sorted).toEqual(['25.S3', '25.S2', '25.S1', '25.4', '16.15', '未知版本'])
  })
})
