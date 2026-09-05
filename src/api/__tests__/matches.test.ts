/**
 * 对局 API 层测试：统一信封解包（对齐后端 #26）与 AI 分析 SSE 的开流前失败分支
 * - listMatches：data 内为 { items, page, pageSize, total }（原字段 data 更名 items）
 * - searchRiotAccount / getMatchDetail / getMatchTimeline：信封 data 解包
 * - analyzeMatch：开流前失败（HTTP 200 + JSON 错误体）→ 抛 ApiError；
 *   正常 event-stream → 事件按到达顺序分发
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// mock axios 实例：记录调用并返回可解包的响应结构（与 team.test.ts 同款风格）；
// ApiError 用真实实现（matches.ts 抛它，断言依赖其 code 字段）
const httpGet = vi.fn()
vi.mock('../http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../http')>()
  return {
    default: { get: (...args: unknown[]) => httpGet(...args), post: vi.fn() },
    ApiError: actual.ApiError
  }
})

import { analyzeMatch, getMatchDetail, getMatchTimeline, listMatches, searchRiotAccount } from '../matches'

beforeEach(() => {
  httpGet.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('统一信封解包', () => {
  it('listMatches：解包 data 内的 items 分页结构（字段 data 已更名 items）', async () => {
    const page = {
      items: [{ gameId: 1, self: { summonerName: '手裂鬼子' } }],
      page: 1,
      pageSize: 20,
      total: 1,
      recentOpponents: []
    }
    httpGet.mockResolvedValue({ data: { code: 0, message: 'ok', data: page } })

    const result = (await listMatches({ puuid: 'puuid-1' })) as unknown as {
      items: Array<{ gameId: number }>
      total: number
    }

    expect(httpGet).toHaveBeenCalledWith('/api/matches', { params: { puuid: 'puuid-1' } })
    expect(result.items).toHaveLength(1)
    expect(result.items[0].gameId).toBe(1)
    expect(result.total).toBe(1)
  })

  it('searchRiotAccount：解包信封 data 内的账号信息', async () => {
    httpGet.mockResolvedValue({
      data: { code: 0, message: 'ok', data: { puuid: 'riot-puuid', gameName: '赌书消得泼茶香', tagLine: 'iKun' } }
    })

    const account = await searchRiotAccount('赌书消得泼茶香#iKun')

    expect(account.puuid).toBe('riot-puuid')
    expect(account.gameName).toBe('赌书消得泼茶香')
  })

  it('getMatchDetail：解包信封 data 内的详情（取值路径 data.data 与旧契约一致）', async () => {
    httpGet.mockResolvedValue({ data: { code: 0, message: 'ok', data: { gameId: 123 } } })

    const detail = await getMatchDetail(123)

    expect(detail.gameId).toBe(123)
  })

  it('getMatchTimeline：解包信封 data 内的帧数组', async () => {
    httpGet.mockResolvedValue({
      data: { code: 0, message: 'ok', data: [{ timestamp: 1000, events: [] }] }
    })

    const frames = await getMatchTimeline(123)

    expect(frames).toHaveLength(1)
    // MatchTimelineFrame 为 unknown（帧结构未建模），断言前先收窄
    expect((frames[0] as { timestamp: number }).timestamp).toBe(1000)
  })
})

describe('analyzeMatch SSE 开流前失败（对齐后端 #26：HTTP 200 + JSON 错误体）', () => {
  it('content-type 非 event-stream（业务失败）：解析信封后抛 ApiError', async () => {
    // 后端开流前失败（如对局不存在 2001）：HTTP 200 + application/json 错误体
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ code: 2001, message: '对局不存在: gameId=123' })
    }))

    await expect(analyzeMatch(123)).rejects.toMatchObject({
      code: 2001,
      message: '对局不存在: gameId=123'
    })
  })

  it('HTTP 非 200（未达业务）：解析 message 后抛 Error（保留旧行为）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => 'application/json' },
      json: async () => ({ message: '资源不存在' })
    }))

    await expect(analyzeMatch(123)).rejects.toThrow('资源不存在')
  })

  it('正常 event-stream：start/chunk/done 事件按到达顺序分发', async () => {
    // 用 SSE 文本流构造响应体（data: 前缀行 + 空行分隔）
    const sse = [
      'data: {"type":"start","fromCache":false}',
      '',
      'data: {"type":"chunk","content":"你好"}',
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
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/event-stream' },
      body: stream
    }))

    const events: string[] = []
    let chunkText = ''
    await analyzeMatch(123, {
      onStart: () => events.push('start'),
      onChunk: (content) => {
        events.push('chunk')
        chunkText += content
      },
      onDone: () => events.push('done')
    })

    expect(events).toEqual(['start', 'chunk', 'done'])
    expect(chunkText).toBe('你好')
  })
})
