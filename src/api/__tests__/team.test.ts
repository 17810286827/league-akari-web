/**
 * 车队 API 层测试：
 * 1. 慢接口按请求放宽超时（榜单/成员/成员卡实时重算评分）；
 *    周报统计接口已不含 AI 锐评（锐评拆分到独立 SSE 端点，工单 #33），回到全局超时。
 * 2. streamWeeklyComment（周报 AI 锐评 SSE）：开流前失败抛 ApiError、
 *    正常 event-stream 事件按到达顺序分发（与单局分析同一事件契约）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// mock axios 实例：记录每次调用的 url 与 config，返回可解包的响应结构
// （路径 ../http 对应 team.ts 里的 './http'，按解析后的模块 id 匹配）；
// ApiError 用真实实现（streamWeeklyComment 抛它，断言依赖其 code 字段）
const httpGet = vi.fn()
const httpPost = vi.fn()
vi.mock('../http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../http')>()
  return {
    default: { get: (...args: unknown[]) => httpGet(...args), post: (...args: unknown[]) => httpPost(...args) },
    ApiError: actual.ApiError
  }
})

import { getMemberCard, getTeamLeaderboard, getTeamMembers, getWeeklyReport, streamWeeklyComment, triggerTeamBackfill } from '../team'

beforeEach(() => {
  httpGet.mockReset().mockResolvedValue({ data: { data: {} } })
  httpPost.mockReset().mockResolvedValue({ data: { code: 0, data: { started: true } } })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('team api timeouts', () => {
  it('周报统计接口不再放宽超时（AI 锐评已拆分到 SSE 端点），携带 date 参数', async () => {
    await getWeeklyReport('2026-08-26')

    expect(httpGet).toHaveBeenCalledWith('/api/team/weekly', {
      params: { date: '2026-08-26' }
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

describe('streamWeeklyComment SSE（工单 #33：周报 AI 锐评流式）', () => {
  it('开流前失败（HTTP 200 + JSON 错误信封，如 4101 Key 未配置）→ 抛 ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ code: 4101, message: 'AI API Key 未配置，无法生成周报锐评' })
    }))

    await expect(streamWeeklyComment('2026-08-26')).rejects.toMatchObject({
      code: 4101,
      message: 'AI API Key 未配置，无法生成周报锐评'
    })
  })

  it('正常 event-stream：start/chunk/reasoning/done 事件按到达顺序分发，正文拼接完整', async () => {
    const sse = [
      'data: {"type":"start","fromCache":false}',
      '',
      'data: {"type":"reasoning","content":"正在锐评"}',
      '',
      'data: {"type":"chunk","content":"本周赌书封神"}',
      '',
      'data: {"type":"chunk","content":"，鬼子战犯实锤"}',
      '',
      'data: {"type":"done"}',
      ''
    ].join('\n')
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sse))
        controller.close()
      }
    })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/event-stream' },
      body: stream
    })
    vi.stubGlobal('fetch', fetchMock)

    const events: string[] = []
    let chunkText = ''
    await streamWeeklyComment('2026-08-26', {
      onStart: () => events.push('start'),
      onChunk: (content) => {
        events.push('chunk')
        chunkText += content
      },
      onReasoning: (content) => events.push('reasoning:' + content),
      onDone: () => events.push('done')
    })

    expect(events).toEqual(['start', 'reasoning:正在锐评', 'chunk', 'chunk', 'done'])
    expect(chunkText).toBe('本周赌书封神，鬼子战犯实锤')
    // 请求指向独立 SSE 端点且携带 date 参数（GET）
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/team/weekly/ai-comment?date=2026-08-26'),
      expect.objectContaining({ headers: { Accept: 'text/event-stream' } })
    )
  })

  it('流中途 error 事件：分发 onError 回调（页面层展示降级提示）', async () => {
    const sse = [
      'data: {"type":"start","fromCache":false}',
      '',
      'data: {"type":"error","message":"AI 接口调用失败（HTTP 502）"}',
      ''
    ].join('\n')
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sse))
        controller.close()
      }
    })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/event-stream' },
      body: stream
    }))

    const errors: string[] = []
    await streamWeeklyComment(undefined, { onError: (message) => errors.push(message) })

    expect(errors).toEqual(['AI 接口调用失败（HTTP 502）'])
  })
})
