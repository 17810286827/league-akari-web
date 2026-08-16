/**
 * 时间线适配层测试（任务 6）
 * 覆盖：frames 数组原样透传（LCU 与 SGP 结构一致）、非数组输入返回空数组
 */
import { describe, expect, it } from 'vitest'
import { toMatchCardFrames } from '../match-card-timeline'

describe('toMatchCardFrames', () => {
  it('frames 数组原样透传（LCU 与 SGP 结构一致）', () => {
    const frames = [{ timestamp: 1000, events: [], participantFrames: {} }]
    expect(toMatchCardFrames(frames)).toEqual(frames)
  })

  it('非数组输入返回空数组（防御后端异常数据）', () => {
    expect(toMatchCardFrames(null)).toEqual([])
    expect(toMatchCardFrames({})).toEqual([])
  })
})
