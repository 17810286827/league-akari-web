/**
 * useWeeklyComment composable 测试（工单 #33：周报 AI 锐评流式）。
 * 覆盖：流式打字机累积、reasoning/reset、fromCache、开流前 reject 转 errorMsg、
 * 流内 error 事件、同周去重闸门、切周重置。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SseStreamHandlers } from '@/api/sse'
import { useWeeklyComment } from '@/composables/useWeeklyComment'

// mock 锐评 API：由用例手动驱动 SSE handlers，保持测试只关注 composable 契约
vi.mock('@/api/team', () => ({
  streamWeeklyComment: vi.fn()
}))

import { streamWeeklyComment } from '@/api/team'

/** 读取最近一次调用保存的 handler，便于模拟 API 的流式回调 */
function lastHandlers(): SseStreamHandlers {
  const calls = vi.mocked(streamWeeklyComment).mock.calls
  return calls[calls.length - 1]?.[1] as SseStreamHandlers
}

/** 等待 composable 的 async 请求 finally 完成 */
async function settle(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('useWeeklyComment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('流式打字机：chunk 按到达顺序累积为完整锐评，done 复位 streaming', async () => {
    vi.mocked(streamWeeklyComment).mockResolvedValue(undefined)
    const state = useWeeklyComment()

    const pending = state.load('2026-08-26')
    const handlers = lastHandlers()
    handlers.onStart?.(false)
    handlers.onChunk?.('本周赌书封神')
    handlers.onChunk?.('，鬼子战犯实锤')
    handlers.onDone?.(false)
    await pending
    await settle()

    expect(state.comment.value).toBe('本周赌书封神，鬼子战犯实锤')
    expect(state.streaming.value).toBe(false)
    expect(state.fromCache.value).toBe(false)
    expect(state.errorMsg.value).toBe('')
  })

  it('reasoning 实时累积，reset 清空缓冲（后端重试信号）', async () => {
    vi.mocked(streamWeeklyComment).mockResolvedValue(undefined)
    const state = useWeeklyComment()

    const pending = state.load('2026-08-26')
    const handlers = lastHandlers()
    handlers.onStart?.(false)
    handlers.onReasoning?.('第一轮思考')
    handlers.onReasoningReset?.()
    handlers.onReasoning?.('第二轮思考')
    handlers.onChunk?.('正文')
    handlers.onDone?.(false)
    await pending

    // reset 后只保留第二轮思维链
    expect(state.reasoning.value).toBe('第二轮思考')
  })

  it('开流前失败（reject，如 4101）转为 errorMsg 状态', async () => {
    vi.mocked(streamWeeklyComment).mockRejectedValue(new Error('AI API Key 未配置，无法生成周报锐评'))
    const state = useWeeklyComment()

    await state.load('2026-08-26')
    await settle()

    expect(state.errorMsg.value).toContain('AI API Key 未配置')
    expect(state.streaming.value).toBe(false)
    expect(state.comment.value).toBe('')
  })

  it('流内 error 事件：写入 errorMsg，正文保留已推送部分', async () => {
    vi.mocked(streamWeeklyComment).mockResolvedValue(undefined)
    const state = useWeeklyComment()

    const pending = state.load('2026-08-26')
    const handlers = lastHandlers()
    handlers.onStart?.(false)
    handlers.onChunk?.('半截正文')
    handlers.onError?.('AI 接口调用失败（HTTP 502）')
    await pending

    expect(state.errorMsg.value).toBe('AI 接口调用失败（HTTP 502）')
    expect(state.comment.value).toBe('半截正文')
  })

  it('同一周并发 load 去重：流未结束时第二条不发起（防重复请求）', async () => {
    // 用未决 Promise 模拟进行中的流：第一条 resolve 前发起第二条 load
    let releaseFirst: () => void = () => {}
    const firstPending = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    vi.mocked(streamWeeklyComment).mockReturnValueOnce(firstPending)
    const state = useWeeklyComment()

    // 第一条流挂起期间发起第二条：应被闸门拦截
    const first = state.load('2026-08-26')
    await state.load('2026-08-26')
    expect(streamWeeklyComment).toHaveBeenCalledTimes(1)

    // 放行第一条流，状态正常收尾
    releaseFirst()
    await first
    await settle()
    expect(state.streaming.value).toBe(false)

    // 流结束后再 load 同一周：重新发起（串行二次调用不去重，允许手动刷新）
    vi.mocked(streamWeeklyComment).mockResolvedValue(undefined)
    await state.load('2026-08-26')
    expect(streamWeeklyComment).toHaveBeenCalledTimes(2)
  })

  it('切周重新拉流并重置状态（旧周半截内容不残留）', async () => {
    vi.mocked(streamWeeklyComment).mockResolvedValue(undefined)
    const state = useWeeklyComment()

    // 第一周：推到一半
    const first = state.load('2026-08-26')
    lastHandlers().onChunk?.('第一周的半截')
    await first
    // 第二周：全新状态
    const second = state.load('2026-09-02')
    const handlers = lastHandlers()
    handlers.onStart?.(true)
    handlers.onChunk?.('第二周的锐评')
    handlers.onDone?.(false)
    await second

    expect(state.comment.value).toBe('第二周的锐评')
    expect(state.fromCache.value).toBe(true)
  })

  it('快速切周（两流并发）：旧流回调全部丢弃，新流独占状态不串台', async () => {
    // 两流同时进行中：第一周流挂起未决，期间发起第二周流
    let releaseFirst: () => void = () => {}
    const firstPending = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    vi.mocked(streamWeeklyComment).mockImplementationOnce(() => firstPending)
    vi.mocked(streamWeeklyComment).mockResolvedValueOnce(undefined)
    const state = useWeeklyComment()

    // 第一周流挂起期间发起第二周流（最新流夺取状态写入权）
    const first = state.load('2026-08-26')
    const second = state.load('2026-09-02')

    // 新流的 chunk 正常追加
    const secondHandlers = lastHandlers()
    secondHandlers.onStart?.(false)
    secondHandlers.onChunk?.('第二周正文')
    secondHandlers.onDone?.(false)
    await second

    // 旧流（第一周）此刻才推数据/结束：回调必须全部丢弃
    const firstHandlers = vi.mocked(streamWeeklyComment).mock.calls[0]?.[1] as SseStreamHandlers
    firstHandlers.onChunk?.('第一周迟到内容')
    firstHandlers.onError?.('第一周迟到的错误')
    releaseFirst()
    await first
    await settle()

    // 状态完全归属第二周：无串台内容、无迟到错误、streaming 已复位
    expect(state.comment.value).toBe('第二周正文')
    expect(state.errorMsg.value).toBe('')
    expect(state.streaming.value).toBe(false)
  })
})
