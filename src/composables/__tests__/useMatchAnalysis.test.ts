/**
 * useMatchAnalysis composable 失败测试。
 * 覆盖缓存隔离、流式临时状态、成功提交、失败回退、存储降级、身份校验与请求竞态。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AnalyzeStreamHandlers } from '@/api/matches'
import { useMatchAnalysis } from '@/composables/useMatchAnalysis'

// mock 分析 API：由用例手动驱动 SSE handlers，保持测试只关注 composable 契约。
vi.mock('@/api/matches', () => ({
  analyzeMatch: vi.fn()
}))

// mock 日志器：状态必须在 vi.hoisted 中创建，因为 vi.mock 工厂会被提升到导入语句之前。
const { loggerWarn } = vi.hoisted(() => ({ loggerWarn: vi.fn() }))
vi.mock('@/utils/logger', () => ({
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: loggerWarn,
    error: vi.fn()
  }))
}))

import { analyzeMatch } from '@/api/matches'

const cacheKey = 'league-akari:ai-analysis:123:puuid-a'
const oldSnapshot = {
  result: '旧正文',
  reasoning: '旧思考',
  truncatedTip: '',
  fromCache: true
}

/** 等待 composable 的 async 请求 finally 和 Vue ref 更新完成。 */
async function settle(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

/** 读取指定请求保存的 handler，便于模拟 API 的流式回调。 */
function handlersAt(index: number): AnalyzeStreamHandlers {
  const call = vi.mocked(analyzeMatch).mock.calls[index]
  return call?.[1] as AnalyzeStreamHandlers
}

describe('useMatchAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('按 gameId 和 puuid 隔离缓存，并默认收起 reasoning', () => {
    localStorage.setItem(cacheKey, JSON.stringify(oldSnapshot))

    const first = useMatchAnalysis({ gameId: 123, puuid: 'puuid-a' })
    const second = useMatchAnalysis({ gameId: 123, puuid: 'puuid-b' })

    expect(first.result.value).toBe('旧正文')
    expect(first.reasoning.value).toBe('旧思考')
    expect(first.truncatedTip.value).toBe('')
    expect(first.fromCache.value).toBe(true)
    expect(first.errorMsg.value).toBe('')
    expect(first.reasoningCollapsed.value).toBe(true)
    expect(second.result.value).toBe('')
    expect(second.reasoning.value).toBe('')
  })

  it('成功流式请求在完成前保留旧结果，完成后整体提交四个字段', async () => {
    let resolveRequest!: () => void
    vi.mocked(analyzeMatch).mockImplementation(
      async (_gameId, handlers) =>
        new Promise<void>((resolve) => {
          resolveRequest = resolve
          handlers?.onStart?.(true)
          handlers?.onReasoning?.('新思考')
          handlers?.onChunk?.('新正文-1')
          handlers?.onChunk?.('新正文-2')
          // 模拟首块已到但 SSE 尚未 done 的中间状态。
        })
    )
    localStorage.setItem(cacheKey, JSON.stringify(oldSnapshot))
    const state = useMatchAnalysis({ gameId: 123, puuid: 'puuid-a' })

    // 初始化快照代表用户仍在看的最近一次成功结果，新流不能因首块到达而提前污染它。
    const request = state.analyze()
    await settle()
    expect(state.analyzing.value).toBe(true)
    expect(state.result.value).toBe('旧正文')
    expect(state.reasoning.value).toBe('旧思考')
    expect(JSON.parse(localStorage.getItem(cacheKey) as string)).toEqual(oldSnapshot)

    handlersAt(0).onDone?.(true)
    resolveRequest()
    await request

    expect(state.analyzing.value).toBe(false)
    expect(state.result.value).toBe('新正文-1新正文-2')
    expect(state.reasoning.value).toBe('新思考')
    expect(state.truncatedTip.value).not.toBe('')
    expect(state.fromCache.value).toBe(true)
    expect(JSON.parse(localStorage.getItem(cacheKey) as string)).toEqual({
      result: '新正文-1新正文-2',
      reasoning: '新思考',
      truncatedTip: expect.any(String),
      fromCache: true
    })
  })

  it('请求失败时回退旧快照，缓存不变并允许重试', async () => {
    let rejectRequest!: (reason: Error) => void
    vi.mocked(analyzeMatch)
      .mockImplementationOnce(async (_gameId, handlers) => {
        handlers?.onReasoning?.('临时思考')
        handlers?.onChunk?.('临时正文')
        return new Promise<void>((_resolve, reject) => {
          rejectRequest = reject
        })
      })
      .mockImplementationOnce(async (_gameId, handlers) => {
        handlers?.onStart?.(false)
        handlers?.onChunk?.('重试成功')
        handlers?.onDone?.(false)
      })
    localStorage.setItem(cacheKey, JSON.stringify(oldSnapshot))
    const state = useMatchAnalysis({ gameId: 123, puuid: 'puuid-a' })

    // 网络失败必须回到成功快照，否则半截模型输出会在页面和缓存中留下不可重试的脏状态。
    const failedRequest = state.analyze()
    await settle()
    rejectRequest(new Error('网络暂时不可用'))
    // 契约约束：请求异常由 composable 吞掉并转成可重试的 UI 错误，不向调用方 reject。
    await expect(failedRequest).resolves.toBeUndefined()

    expect(state.analyzing.value).toBe(false)
    expect(state.result.value).toBe('旧正文')
    expect(state.reasoning.value).toBe('旧思考')
    expect(state.errorMsg.value).toContain('网络暂时不可用')
    expect(JSON.parse(localStorage.getItem(cacheKey) as string)).toEqual(oldSnapshot)

    await state.analyze()
    expect(state.result.value).toBe('重试成功')
    expect(state.errorMsg.value).toBe('')
    expect(JSON.parse(localStorage.getItem(cacheKey) as string).result).toBe('重试成功')
  })

  it('存储读写异常时不抛错，仍可在内存中展示结果', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('读取失败')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('写入失败')
    })
    vi.mocked(analyzeMatch).mockImplementation(async (_gameId, handlers) => {
      handlers?.onChunk?.('内存结果')
      handlers?.onDone?.(false)
    })

    expect(() => useMatchAnalysis({ gameId: 123, puuid: 'puuid-a' })).not.toThrow()
    const state = useMatchAnalysis({ gameId: 123, puuid: 'puuid-a' })
    await state.analyze()

    expect(state.result.value).toBe('内存结果')
    expect(state.errorMsg.value).toBe('')
  })

  it.each([
    ['非法 JSON', '{bad-json'],
    ['缺少字段', JSON.stringify({ result: '正文' })],
    ['字段类型错误', JSON.stringify({ result: 1, reasoning: '', truncatedTip: '', fromCache: false })]
  ])('忽略%s缓存并记录 warning', (_label, raw) => {
    localStorage.setItem(cacheKey, raw)

    const state = useMatchAnalysis({ gameId: 123, puuid: 'puuid-a' })

    expect(state.result.value).toBe('')
    expect(state.reasoning.value).toBe('')
    expect(loggerWarn).toHaveBeenCalled()
  })

  it('缺少 puuid 时不读写缓存且不发起分析请求', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const state = useMatchAnalysis({ gameId: 123, puuid: '' })

    await state.analyze()

    expect(state.result.value).toBe('')
    expect(getItem).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
    expect(analyzeMatch).not.toHaveBeenCalled()
  })

  it('旧请求晚到时不能覆盖新请求的状态', async () => {
    const resolvers: Array<() => void> = []
    vi.mocked(analyzeMatch).mockImplementation(async (_gameId, handlers) => {
      handlers?.onChunk?.(vi.mocked(analyzeMatch).mock.calls.length === 1 ? '旧请求' : '新请求')
      await new Promise<void>((resolve) => resolvers.push(resolve))
      handlers?.onDone?.(false)
    })
    const state = useMatchAnalysis({ gameId: 123, puuid: 'puuid-a' })

    const first = state.analyze()
    await settle()
    // 第二次请求拥有更新的 request id，旧流即使晚完成也只能被丢弃。
    const second = state.analyze()
    await settle()
    resolvers[1]?.()
    await second
    resolvers[0]?.()
    await first

    expect(state.result.value).toBe('新请求')
  })

  it('流内 onError 回退旧快照并允许再次重试', async () => {
    vi.mocked(analyzeMatch)
      .mockImplementationOnce(async (_gameId, handlers) => {
        handlers?.onChunk?.('失败片段')
        handlers?.onError?.('模型服务失败')
      })
      .mockImplementationOnce(async (_gameId, handlers) => {
        handlers?.onChunk?.('恢复结果')
        handlers?.onDone?.(false)
      })
    localStorage.setItem(cacheKey, JSON.stringify(oldSnapshot))
    const state = useMatchAnalysis({ gameId: 123, puuid: 'puuid-a' })

    // 流内错误与网络 reject 采用同一回退策略，并保留再次点击重试的能力。
    await expect(state.analyze()).resolves.toBeUndefined()
    expect(state.analyzing.value).toBe(false)
    expect(state.result.value).toBe('旧正文')
    expect(state.errorMsg.value).toContain('模型服务失败')
    expect(JSON.parse(localStorage.getItem(cacheKey) as string)).toEqual(oldSnapshot)

    await state.analyze()
    expect(state.result.value).toBe('恢复结果')
    expect(state.errorMsg.value).toBe('')
  })
})
