/**
 * 车队 API 层测试：验证周报/榜单等慢接口按请求放宽超时
 * （全局 axios 超时 10s，AI 锐评同步生成 25~90s，必须按请求覆盖，否则前端表现为切换周无效）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// mock axios 实例：记录每次调用的 url 与 config，返回可解包的响应结构
// （路径 ../http 对应 team.ts 里的 './http'，按解析后的模块 id 匹配）
const httpGet = vi.fn()
const httpPost = vi.fn()
vi.mock('../http', () => ({
  default: { get: (...args: unknown[]) => httpGet(...args), post: (...args: unknown[]) => httpPost(...args) }
}))

import { getMemberCard, getTeamLeaderboard, getTeamMembers, getWeeklyReport, triggerTeamBackfill } from '../team'

beforeEach(() => {
  httpGet.mockReset().mockResolvedValue({ data: { data: {} } })
  httpPost.mockReset().mockResolvedValue({ data: { code: 0, data: { started: true } } })
})

describe('team api timeouts', () => {
  it('周报接口超时放宽到 180s（AI 锐评同步生成）且携带 date 参数', async () => {
    await getWeeklyReport('2026-08-26')

    expect(httpGet).toHaveBeenCalledWith('/api/team/weekly', {
      params: { date: '2026-08-26' },
      timeout: 180_000
    })
  })

  it('榜单/成员/成员卡接口超时放宽到 90s（实时重算评分）', async () => {
    await getTeamLeaderboard({ dimension: 'attendance' })
    await getTeamMembers()
    await getMemberCard('puuid-1')

    for (const call of httpGet.mock.calls) {
      expect(call[1].timeout).toBe(90_000)
    }
  })

  it('回填触发为异步任务，不放宽超时（沿用全局 10s）', async () => {
    await triggerTeamBackfill()

    expect(httpPost.mock.calls[0]?.[1]?.timeout).toBeUndefined()
  })
})
