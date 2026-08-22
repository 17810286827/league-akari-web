/**
 * 对局 AI 分析状态：分离“正在展示的流式缓冲”与“可跨刷新恢复的成功快照”。
 * 网络和存储均为可选能力，异常统一转换为可重试的页面状态。
 *
 * 约束说明：正文首块抵达后必须立即更新公开 refs，以保留打字机体验；
 * localStorage 只接收 done 后的完整快照，避免任何半截模型输出被持久化。
 */
import { ref, type Ref } from 'vue'
import { analyzeMatch } from '@/api/matches'
import { createLogger } from '@/utils/logger'

const logger = createLogger('MatchAnalysis')
const CACHE_NAMESPACE = 'league-akari:ai-analysis'
const TRUNCATED_TIP = '分析结果可能因长度限制被截断。'

/** 可持久化的完整成功分析；展示折叠状态不参与缓存。 */
export interface MatchAnalysisSnapshot {
  result: string
  reasoning: string
  truncatedTip: string
  fromCache: boolean
}

/** 创建 composable 所需的身份信息。 */
export interface UseMatchAnalysisOptions {
  gameId: number
  puuid: string
}

/** 暴露给组件的响应式状态和操作。 */
export interface MatchAnalysisState {
  analyzing: Ref<boolean>
  result: Ref<string>
  reasoning: Ref<string>
  reasoningCollapsed: Ref<boolean>
  fromCache: Ref<boolean>
  errorMsg: Ref<string>
  truncatedTip: Ref<string>
  analyze: () => Promise<void>
  toggleReasoning: () => void
}

/**
 * 生成按对局和玩家身份隔离的稳定缓存键。
 * 非正整数对局 ID 不具备业务语义，必须在创建实例时阻断全部缓存与网络副作用。
 */
function createCacheKey({ gameId, puuid }: UseMatchAnalysisOptions): string | undefined {
  if (!Number.isInteger(gameId) || gameId <= 0 || !puuid) {
    return undefined
  }

  return `${CACHE_NAMESPACE}:${encodeURIComponent(String(gameId))}:${encodeURIComponent(puuid)}`
}

/** 防御性校验 localStorage 中的历史数据，避免坏数据污染页面状态。 */
function parseSnapshot(raw: string): MatchAnalysisSnapshot | undefined {
  const value: unknown = JSON.parse(raw)
  if (
    !value ||
    typeof value !== 'object' ||
    typeof (value as MatchAnalysisSnapshot).result !== 'string' ||
    typeof (value as MatchAnalysisSnapshot).reasoning !== 'string' ||
    typeof (value as MatchAnalysisSnapshot).truncatedTip !== 'string' ||
    typeof (value as MatchAnalysisSnapshot).fromCache !== 'boolean'
  ) {
    return undefined
  }

  return value as MatchAnalysisSnapshot
}

/** localStorage 不可用时静默降级，分析流程仍以内存状态为准。 */
function readSnapshot(key: string | undefined): MatchAnalysisSnapshot | undefined {
  if (!key) {
    return undefined
  }

  try {
    const raw = localStorage.getItem(key)
    if (!raw) {
      return undefined
    }

    const snapshot = parseSnapshot(raw)
    if (!snapshot) {
      logger.warn('Ignoring invalid match analysis cache entry')
    }
    return snapshot
  } catch {
    // 存储被隐私模式禁用或数据损坏时不阻塞本次页面初始化。
    logger.warn('Unable to read match analysis cache')
    return undefined
  }
}

/** 成功快照写入失败只影响跨刷新恢复，不影响当前已完成的分析。 */
function writeSnapshot(key: string | undefined, snapshot: MatchAnalysisSnapshot): void {
  if (!key) {
    return
  }

  try {
    localStorage.setItem(key, JSON.stringify(snapshot))
  } catch {
    logger.warn('Unable to write match analysis cache')
  }
}

/** 将快照整体应用到公开 refs，维持四个成功字段的一致性。 */
function applySnapshot(
  target: {
    result: Ref<string>
    reasoning: Ref<string>
    truncatedTip: Ref<string>
    fromCache: Ref<boolean>
  },
  snapshot: MatchAnalysisSnapshot
): void {
  target.result.value = snapshot.result
  target.reasoning.value = snapshot.reasoning
  target.truncatedTip.value = snapshot.truncatedTip
  target.fromCache.value = snapshot.fromCache
}

/**
 * 创建一份对局分析状态实例。
 * 每个实例维护独立请求序列，使过期 SSE 回调无法覆盖最新请求。
 */
export function useMatchAnalysis(options: UseMatchAnalysisOptions): MatchAnalysisState {
  const cacheKey = createCacheKey(options)
  const cachedSnapshot = readSnapshot(cacheKey)
  const analyzing = ref(false)
  const result = ref(cachedSnapshot?.result ?? '')
  const reasoning = ref(cachedSnapshot?.reasoning ?? '')
  const reasoningCollapsed = ref(true)
  const fromCache = ref(cachedSnapshot?.fromCache ?? false)
  const errorMsg = ref('')
  const truncatedTip = ref(cachedSnapshot?.truncatedTip ?? '')
  let latestRequestId = 0

  /** 用户主动切换思考过程的可见性，不改变已缓存的业务结果。 */
  function toggleReasoning(): void {
    reasoningCollapsed.value = !reasoningCollapsed.value
  }

  /**
   * 发起分析并在 done 事件处提交完整快照。
   * HTTP、网络及流内错误全部由此处吸收，调用方始终获得 resolve 的 Promise。
   */
  async function analyze(): Promise<void> {
    if (!cacheKey) {
      logger.warn('Match analysis skipped because identity is incomplete')
      return
    }

    const requestId = ++latestRequestId
    const previousSnapshot: MatchAnalysisSnapshot = {
      result: result.value,
      reasoning: reasoning.value,
      truncatedTip: truncatedTip.value,
      fromCache: fromCache.value
    }
    let temporaryResult = ''
    let temporaryReasoning = ''
    let temporaryFromCache = false
    let temporaryTruncatedTip = ''
    let streamFailed = false
    let completed = false

    // previousSnapshot 是失败回退基线；临时 refs 可以被覆盖，但它永远不参与缓存写入。
    errorMsg.value = ''
    analyzing.value = true
    logger.info('Match analysis request started', { gameId: options.gameId })

    /** 仅当前请求可修改状态；失败路径总是恢复本次开始前的成功快照。 */
    const fail = (message: string): void => {
      if (requestId !== latestRequestId || streamFailed) {
        return
      }

      streamFailed = true
      applySnapshot({ result, reasoning, truncatedTip, fromCache }, previousSnapshot)
      errorMsg.value = message || 'AI 分析失败，请稍后重试'
      logger.warn('Match analysis request failed', { gameId: options.gameId })
    }

    try {
      await analyzeMatch(options.gameId, {
        onStart: (hitCache) => {
          if (requestId === latestRequestId && !streamFailed) {
            temporaryFromCache = hitCache
            // 后端缓存标记属于本轮临时展示，直到 done 才和正文一起成为成功快照。
            fromCache.value = hitCache
          }
        },
        onReasoning: (content) => {
          if (requestId === latestRequestId && !streamFailed) {
            temporaryReasoning += content
            // 思考过程也实时展示；失败时由 fail() 用 previousSnapshot 一次性恢复。
            reasoning.value = temporaryReasoning
          }
        },
        onChunk: (content) => {
          if (requestId === latestRequestId && !streamFailed) {
            temporaryResult += content
            // 公开正文跟随每个 chunk 更新，形成打字机效果；这里严禁写 localStorage。
            result.value = temporaryResult
          }
        },
        onDone: (truncated) => {
          if (requestId !== latestRequestId || streamFailed) {
            return
          }

          const snapshot: MatchAnalysisSnapshot = {
            result: temporaryResult,
            reasoning: temporaryReasoning,
            truncatedTip: truncated ? TRUNCATED_TIP : '',
            fromCache: temporaryFromCache
          }
          applySnapshot({ result, reasoning, truncatedTip, fromCache }, snapshot)
          writeSnapshot(cacheKey, snapshot)
          completed = true
          logger.info('Match analysis request committed', { gameId: options.gameId, truncated })
        },
        onError: (message) => fail(message)
      })

      // API 在未收到 done 时意外结束，不能提交半截缓冲。
      if (requestId === latestRequestId && !streamFailed && !completed) {
        fail('AI 分析未正常完成，请稍后重试')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 分析失败，请稍后重试'
      fail(message)
    } finally {
      if (requestId === latestRequestId) {
        analyzing.value = false
      }
    }
  }

  return {
    analyzing,
    result,
    reasoning,
    reasoningCollapsed,
    fromCache,
    errorMsg,
    truncatedTip,
    analyze,
    toggleReasoning
  }
}
