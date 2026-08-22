/**
 * useMatchAnalysis composable 失败测试。
 * 覆盖缓存隔离、流式临时状态、成功提交、失败回退、存储降级、身份校验与请求竞态。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    // 每个用例清理缓存和 mock，避免分析快照或调用历史互相污染。
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('按 gameId 和 puuid 隔离缓存，并默认收起 reasoning', () => {
    // 缓存键必须同时包含对局和玩家身份；同一局的不同玩家不能看到彼此的分析。
    // 这项隔离也保证列表入口与详情入口共享结果时，不会因当前玩家切换而串数据。
    // reasoningCollapsed 是展示层状态，不属于持久化快照，因此每次恢复都应重新收起。
    // 测试必须先清空缓存，才能把隔离结论归因于当前实例的 puuid，而非历史数据残留。
    // 该准备步骤也模拟玩家切换入口后的干净状态，防止跨用例污染缓存契约。
    localStorage.setItem(cacheKey, JSON.stringify(oldSnapshot))
    // 错误和 analyzing 状态不应跨实例或跨刷新持久化，只恢复最近一次成功快照。
    // 首个实例命中 puuid-a，第二个实例使用 puuid-b，正好验证键空间的最小隔离单位。
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

  it('特殊字符 puuid 与不同 gameId 组合保持缓存和结果隔离', async () => {
    const specialPuuid = 'puuid:a/%?&=+';
    const sameGameDifferentPuuid = useMatchAnalysis({ gameId: 123, puuid: specialPuuid })
    const differentGameSamePuuid = useMatchAnalysis({ gameId: 124, puuid: specialPuuid })

    vi.mocked(analyzeMatch).mockImplementation(async (gameId, handlers) => {
      handlers?.onChunk?.(`结果-${gameId}`)
      handlers?.onDone?.(false)
    })

    await sameGameDifferentPuuid.analyze()
    await differentGameSamePuuid.analyze()

    expect(sameGameDifferentPuuid.result.value).toBe('结果-123')
    expect(differentGameSamePuuid.result.value).toBe('结果-124')
    expect(localStorage.length).toBe(2)
    expect(localStorage.getItem('league-akari:ai-analysis:123:puuid%3Aa%2F%25%3F%26%3D%2B')).toContain('结果-123')
    expect(localStorage.getItem('league-akari:ai-analysis:124:puuid%3Aa%2F%25%3F%26%3D%2B')).toContain('结果-124')
  })

  it('成功流式请求首个正文片段后展示临时结果，但只在完成后持久化快照', async () => {
    // 流式正文需要立即反映到公开状态，保证用户能够看到连续的打字机效果。
    // 缓存仍只保存完整成功快照，因此刷新或失败回退不会恢复半截内容。
    let resolveRequest!: () => void
    vi.mocked(analyzeMatch).mockImplementation(
      async (_gameId, handlers) =>
        new Promise<void>((resolve) => {
          // deferred 让测试能观察“已收到片段但尚未完成”的窗口，约束旧结果不得闪空。
          // onDone(true) 还必须把截断提示纳入同一次成功提交，而不是只更新正文。
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

    const request = state.analyze()
    await settle()
    // 收到正文片段后，页面应展示当前临时缓冲，但缓存必须仍保留上次完整成功结果。
    // reasoning 同样来自当前流，截断提示和后端缓存标记仍等待 done 事件统一确认。
    expect(state.analyzing.value).toBe(true)
    expect(state.result.value).toBe('新正文-1新正文-2')
    expect(state.reasoning.value).toBe('新思考')
    expect(state.truncatedTip.value).toBe('')
    expect(state.fromCache.value).toBe(true)
    expect(JSON.parse(localStorage.getItem(cacheKey) as string)).toEqual(oldSnapshot)

    // 完成事件是事务边界：四个字段必须来自同一轮请求，不能留下旧 reasoning 或旧提示。
    // fromCache 也属于成功快照，后续重建组件时应和正文一起恢复。
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
    // 失败流可能已经产生思考过程和正文片段，但这些内容没有成功提交资格。
    // 测试保留旧快照作为用户可见基线，确保错误只增加提示，不破坏最近一次成功结果。
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

    // 错误提示属于当前内存请求，不写入快照，清除后即可再次提交成功结果。
    // analyzing=false 是重试入口的必要终态；否则 UI 会一直禁用分析操作。
    // 错误提示只服务当前交互，不应替代旧正文或被写进成功快照。
    // 用户既能继续看到最近一次成功结果，也能知道本次请求失败并立即重试。
    expect(state.result.value).toBe('旧正文')
    expect(state.reasoning.value).toBe('旧思考')
    expect(state.errorMsg.value).toContain('网络暂时不可用')
    expect(JSON.parse(localStorage.getItem(cacheKey) as string)).toEqual(oldSnapshot)

    // 重试从全新的临时缓冲开始，成功后才允许替换旧快照并清除错误提示。
    await state.analyze()
    expect(state.errorMsg.value).toBe('')
    expect(JSON.parse(localStorage.getItem(cacheKey) as string).result).toBe('重试成功')
  })

  it('活动请求完成前重复调用不改变原请求状态', async () => {
    // 单活动请求策略下，重复调用必须被忽略，原请求仍可完成并提交结果。
    let resolveFirst!: () => void
    vi.mocked(analyzeMatch).mockImplementationOnce(async (_gameId, handlers) => {
      handlers?.onReasoning?.('请求 A 临时思考')
      handlers?.onChunk?.('请求 A 临时正文')
      await new Promise<void>((resolve) => {
        resolveFirst = resolve
      })
      handlers?.onDone?.(false)
    })
    localStorage.setItem(cacheKey, JSON.stringify(oldSnapshot))
    const state = useMatchAnalysis({ gameId: 123, puuid: 'puuid-a' })
    const firstRequest = state.analyze()
    await settle()

    await state.analyze()
    expect(analyzeMatch).toHaveBeenCalledTimes(1)
    expect(state.result.value).toBe('请求 A 临时正文')

    resolveFirst()
    await firstRequest
    expect(state.result.value).toBe('请求 A 临时正文')
    expect(JSON.parse(localStorage.getItem(cacheKey) as string).result).toBe('请求 A 临时正文')
  })

  it('存储读写异常时不抛错，仍可在内存中展示结果', async () => {
    // localStorage 是可选持久化层，浏览器隐私模式或配额限制不应阻塞内存中的分析体验。
    // 这里让读写都抛异常，要求实现分别捕获并继续完成请求，而不是把存储错误当作分析失败。
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

    // 读写异常都应被隔离在存储适配层；业务状态仍以 ref 为准，结果不能因为持久化失败而丢失。
    expect(state.result.value).toBe('内存结果')
    expect(state.errorMsg.value).toBe('')
  })

  it('流内 onError 回退旧快照并允许再次重试', async () => {
    // SSE 流内错误仍由 composable 展示，不触发网络 Toast 回调。
    const onNetworkError = vi.fn()
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
    const state = useMatchAnalysis({ gameId: 123, puuid: 'puuid-a', onNetworkError })

    await state.analyze()
    expect(state.errorMsg.value).toContain('模型服务失败')
    expect(onNetworkError).not.toHaveBeenCalled()
    await state.analyze()
    expect(state.result.value).toBe('恢复结果')
  })

  it.each([
    // 三类坏快照分别模拟解析失败、结构缺失和类型不兼容，均不能污染正常初始状态。
    ['非法 JSON', '{bad-json'],
    ['缺少字段', JSON.stringify({ result: '正文' })],
    ['字段类型错误', JSON.stringify({ result: 1, reasoning: '', truncatedTip: '', fromCache: false })]
  ])('忽略%s缓存并记录 warning', (_label, raw) => {
    localStorage.setItem(cacheKey, raw)

    // 只有结构完整且类型正确的快照才可恢复；损坏数据必须降级为空状态并记录 warning。
    // 这是向后兼容和数据防御的边界，不能让一次手工改写 localStorage 破坏页面初始化。
    const state = useMatchAnalysis({ gameId: 123, puuid: 'puuid-a' })

    expect(state.result.value).toBe('')
    expect(state.reasoning.value).toBe('')
    expect(loggerWarn).toHaveBeenCalled()
  })

  it('缺少 puuid 时不读写缓存且不发起分析请求', async () => {
    // puuid 是缓存命名空间的一部分，缺失时无法证明结果属于当前玩家。
    // 因此该状态按未启用处理：既不读取旧条目，也不写入新结果或发起网络请求。
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const state = useMatchAnalysis({ gameId: 123, puuid: '' })

    // 空 puuid 的断言同时覆盖缓存 API 和网络 API，确保身份校验发生在所有副作用之前。
    // 这避免组件尚未完成身份解析时误触发分析，或把结果写入不可恢复的模糊键。
    await state.analyze()

    expect(state.result.value).toBe('')
    expect(getItem).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
    expect(analyzeMatch).not.toHaveBeenCalled()
  })

  it.each([0, -1])('非正 gameId=%s 时不读写缓存且不发起分析请求', async (gameId) => {
    // 对局 ID 必须是正整数；无效值不能形成缓存键，也不能发送无意义请求。
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    const state = useMatchAnalysis({ gameId, puuid: 'puuid-a' })

    await state.analyze()

    expect(getItem).not.toHaveBeenCalled()
    expect(setItem).not.toHaveBeenCalled()
    expect(analyzeMatch).not.toHaveBeenCalled()
  })

  it('活动请求期间重复调用保留 request id 和原请求结果', async () => {
    // 单活动请求策略不再启动第二条 SSE；原请求的 request id 和提交边界保持完整。
    let resolveRequest!: () => void
    vi.mocked(analyzeMatch).mockImplementation(async (_gameId, handlers) => {
      handlers?.onChunk?.('原请求')
      await new Promise<void>((resolve) => {
        resolveRequest = resolve
      })
      handlers?.onDone?.(false)
    })
    const state = useMatchAnalysis({ gameId: 123, puuid: 'puuid-a' })
    const first = state.analyze()
    await settle()
    await state.analyze()
    expect(analyzeMatch).toHaveBeenCalledTimes(1)
    resolveRequest()
    await first
    expect(state.result.value).toBe('原请求')
  })

  it('新请求开始时立即收起已展开的 reasoning', async () => {
    // 用户展开思考过程后再次点击重试，新的分析流开始就应回到默认折叠状态。
    let resolveRequest!: () => void
    vi.mocked(analyzeMatch).mockImplementation(
      async (_gameId, handlers) =>
        new Promise<void>((resolve) => {
          resolveRequest = resolve
          handlers?.onReasoning?.('新思考')
          handlers?.onChunk?.('新正文')
        })
    )
    const state = useMatchAnalysis({ gameId: 123, puuid: 'puuid-a' })
    state.toggleReasoning()
    expect(state.reasoningCollapsed.value).toBe(false)

    const request = state.analyze()
    await settle()

    expect(state.reasoningCollapsed.value).toBe(true)
    resolveRequest()
    await request
  })

  it('重复调用时只保留一个活动请求且原请求仍可完成', async () => {
    // 同一 composable/cache key 只能有一个活动请求，重复点击不得取消或覆盖原请求。
    let resolveRequest!: () => void
    vi.mocked(analyzeMatch).mockImplementation(
      async (_gameId, handlers) =>
        new Promise<void>((resolve) => {
          resolveRequest = resolve
          handlers?.onChunk?.('原请求结果')
          handlers?.onDone?.(false)
        })
    )
    const state = useMatchAnalysis({ gameId: 123, puuid: 'puuid-a' })

    const firstRequest = state.analyze()
    await settle()
    const duplicateRequest = state.analyze()
    await duplicateRequest

    expect(analyzeMatch).toHaveBeenCalledTimes(1)
    resolveRequest()
    await firstRequest
    expect(state.analyzing.value).toBe(false)
    expect(state.result.value).toBe('原请求结果')
  })

  it('网络 reject 时调用 onNetworkError，但流内 onError 不调用', async () => {
    // 网络层 reject 需要由页面 Toast 展示；SSE 流内错误已经通过 errorMsg 展示，避免重复提示。
    const onNetworkError = vi.fn()
    vi.mocked(analyzeMatch)
      .mockRejectedValueOnce(new Error('网络暂时不可用'))
      .mockImplementationOnce(async (_gameId, handlers) => {
        handlers?.onError?.('模型服务失败')
      })
    const state = useMatchAnalysis({ gameId: 123, puuid: 'puuid-a', onNetworkError })

    await state.analyze()
    expect(onNetworkError).toHaveBeenCalledWith('网络暂时不可用')
    await state.analyze()
    expect(onNetworkError).toHaveBeenCalledTimes(1)
  })

  it('空白 puuid 不产生缓存和网络副作用', async () => {
    // 只有 trim 后仍有内容的 puuid 才能形成稳定身份，空白输入必须在所有副作用前返回。
    const getItem = vi.spyOn(Storage.prototype, 'getItem')
    const state = useMatchAnalysis({ gameId: 123, puuid: '   ' })

    await state.analyze()

    expect(getItem).not.toHaveBeenCalled()
    expect(analyzeMatch).not.toHaveBeenCalled()
  })
})
