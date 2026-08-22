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

/** 模块级活动请求闸门：同一缓存键跨 composable 实例只允许一条分析流。 */
const activeRequests = new Map<string, symbol>()

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
  /** 网络请求 reject 时通知页面层展示 Toast；流内 onError 不触发该回调。 */
  onNetworkError?: (message: string) => void
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
  // 缓存键是页面入口之间共享结果的唯一边界，身份不完整时宁可禁用也不能猜测归属。
  // gameId 采用正整数约束，避免把占位值、默认值或错误路由参数写入持久化空间。
  const normalizedPuuid = puuid.trim()
  if (!Number.isInteger(gameId) || gameId <= 0 || !normalizedPuuid) {
    return undefined
  }

  // 编码玩家身份，防止 puuid 中的特殊字符改变键的层级或与其他身份发生碰撞。
  try {
    return `${CACHE_NAMESPACE}:${encodeURIComponent(String(gameId))}:${encodeURIComponent(normalizedPuuid)}`
  } catch {
    // 极端情况下编码失败时禁用本实例，避免缓存键异常或请求副作用。
    logger.warn('对局分析缓存键编码失败', {
      gameId,
      puuid: normalizedPuuid,
      requestId: 0,
      resultLength: 0,
      reasoningLength: 0,
      messageLength: 0
    })
    return undefined
  }
}

/** 防御性校验 localStorage 中的历史数据，避免坏数据污染页面状态。 */
function parseSnapshot(raw: string): MatchAnalysisSnapshot | undefined {
  // JSON.parse 只负责语法解析，字段校验仍必须逐项执行，避免旧版本或手工数据混入状态机。
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

  // 只有四个成功字段均通过校验，才允许快照进入公开 refs 和失败回退基线。
  return value as MatchAnalysisSnapshot
}

/** localStorage 不可用时静默降级，分析流程仍以内存状态为准。 */
function readSnapshot(
  key: string | undefined,
  options?: UseMatchAnalysisOptions
): MatchAnalysisSnapshot | undefined {
  if (!key) {
    return undefined
  }

  try {
    const raw = localStorage.getItem(key)
    // 空条目代表尚未成功分析，按无缓存处理并保持初始空状态。
    if (!raw) {
      return undefined
    }

    const snapshot = parseSnapshot(raw)
    if (!snapshot) {
      logger.warn('忽略无效的对局分析缓存', {
        gameId: options?.gameId ?? 0,
        puuid: options?.puuid.trim() ?? '',
        requestId: 0,
        resultLength: 0,
        reasoningLength: 0,
        messageLength: 0,
        rawLength: raw.length
      })
      return undefined
    }
    // 缓存命中只记录元数据与正文长度，不记录任何模型正文。
    logger.info('读取对局分析缓存成功', {
      gameId: options?.gameId ?? 0,
      puuid: options?.puuid.trim() ?? '',
      requestId: 0,
      resultLength: snapshot.result.length,
      reasoningLength: snapshot.reasoning.length,
      messageLength: 0,
      truncatedTipLength: snapshot.truncatedTip.length
    })
    return snapshot
  } catch {
    // 存储被隐私模式禁用或数据损坏时不阻塞本次页面初始化。
    logger.warn('读取对局分析缓存失败', {
      gameId: options?.gameId ?? 0,
      puuid: options?.puuid.trim() ?? '',
      requestId: 0,
      resultLength: 0,
      reasoningLength: 0,
      messageLength: 0,
      rawLength: 0
    })
    return undefined
  }
}

/** 成功快照写入失败只影响跨刷新恢复，不影响当前已完成的分析。 */
function writeSnapshot(
  key: string | undefined,
  snapshot: MatchAnalysisSnapshot,
  options?: UseMatchAnalysisOptions,
  requestId = 0
): void {
  if (!key) {
    return
  }

  try {
    localStorage.setItem(key, JSON.stringify(snapshot))
    // 缓存日志只记录身份、请求和长度元数据，严禁记录正文内容。
    logger.info('写入对局分析缓存成功', {
      gameId: options?.gameId ?? 0,
      puuid: options?.puuid.trim() ?? '',
      requestId,
      resultLength: snapshot.result.length,
      reasoningLength: snapshot.reasoning.length,
      messageLength: 0,
      truncatedTipLength: snapshot.truncatedTip.length
    })
  } catch {
    logger.warn('写入对局分析缓存失败', {
      gameId: options?.gameId ?? 0,
      puuid: options?.puuid.trim() ?? '',
      requestId,
      resultLength: snapshot.result.length,
      reasoningLength: snapshot.reasoning.length,
      messageLength: 0,
      truncatedTipLength: snapshot.truncatedTip.length
    })
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
  const cachedSnapshot = readSnapshot(cacheKey, options)
  const analyzing = ref(false)
  const result = ref(cachedSnapshot?.result ?? '')
  const reasoning = ref(cachedSnapshot?.reasoning ?? '')
  const reasoningCollapsed = ref(true)
  const fromCache = ref(cachedSnapshot?.fromCache ?? false)
  const errorMsg = ref('')
  const truncatedTip = ref(cachedSnapshot?.truncatedTip ?? '')
  // 这是整个实例唯一的失败回退基线，只接受初始化缓存或当前请求 onDone 的完整快照。
  // 公开 refs 会被流式临时内容覆盖，因此不能在 analyze() 开始时从 refs 反向取基线。
  let latestSuccessfulSnapshot: MatchAnalysisSnapshot = cachedSnapshot ?? {
    result: '',
    reasoning: '',
    truncatedTip: '',
    fromCache: false
  }
  let latestRequestId = 0
  let activeRequest = false

  /** 用户主动切换思考过程的可见性，不改变已缓存的业务结果。 */
  function toggleReasoning(): void {
    // 折叠状态只服务当前组件展示，故意不写入 latestSuccessfulSnapshot 或 localStorage。
    reasoningCollapsed.value = !reasoningCollapsed.value
  }

  /**
   * 发起分析并在 done 事件处提交完整快照。
   * HTTP、网络及流内错误全部由此处吸收，调用方始终获得 resolve 的 Promise。
   */
  async function analyze(): Promise<void> {
    // 没有稳定身份时直接返回，保证初始化阶段不会产生无法恢复的读写或网络副作用。
    if (!cacheKey) {
      logger.warn('对局分析因身份信息不完整而跳过', {
        gameId: options.gameId,
        puuid: options.puuid.trim(),
        requestId: 0,
        resultLength: 0,
        reasoningLength: 0,
        messageLength: 0
      })
      return
    }

    // 同一 composable/cache key 只允许一个活动请求，重复点击不应使原请求失去完成机会。
    if (activeRequest || activeRequests.has(cacheKey)) {
      logger.warn('对局分析请求已在进行中，跳过重复请求', {
        gameId: options.gameId,
        puuid: options.puuid.trim(),
        requestId: 0,
        resultLength: 0,
        reasoningLength: 0,
        messageLength: 0
      })
      return
    }

    // 每次调用都递增序列；即使旧 SSE 仍在运行，它的回调也会因 id 过期而失去提交资格。
    const requestId = ++latestRequestId
    // 失败回退必须使用最近一次完整成功快照，不能读取可能已被其他请求临时覆盖的公开 refs。
    const previousSnapshot = latestSuccessfulSnapshot
    let temporaryResult = ''
    let temporaryReasoning = ''
    let temporaryFromCache = false
    let hasPublishedFirstChunk = false
    let streamFailed = false
    let completed = false
    const requestToken = Symbol('match-analysis-request')
    activeRequests.set(cacheKey, requestToken)

    // previousSnapshot 是失败回退基线；临时 refs 可以被覆盖，但它永远不参与缓存写入。
    // 临时缓冲按请求局部维护，避免并发请求把彼此的 chunk 拼成一份不存在的结果。
    errorMsg.value = ''
    reasoningCollapsed.value = true
    activeRequest = true
    analyzing.value = true
    logger.info('对局分析请求开始', {
      gameId: options.gameId,
      puuid: options.puuid.trim(),
      requestId,
      resultLength: 0,
      reasoningLength: 0,
      messageLength: 0
    })

    /** 仅当前请求可修改状态；失败路径总是恢复本次开始前的成功快照。 */
    const fail = (message: string): void => {
      // 旧请求的错误也必须丢弃，否则它可能覆盖新请求的成功结果或错误提示。
      if (requestId !== latestRequestId || streamFailed) {
        return
      }

      // 先锁定失败态再恢复快照，防止同一流重复发 error 时反复改写页面并重复记录。
      streamFailed = true
      applySnapshot({ result, reasoning, truncatedTip, fromCache }, previousSnapshot)
      errorMsg.value = message || 'AI 分析失败，请稍后重试'
      logger.warn('对局分析请求失败', {
        gameId: options.gameId,
        puuid: options.puuid.trim(),
        requestId,
        resultLength: 0,
        reasoningLength: 0,
        messageLength: errorMsg.value.length
      })
    }

    try {
      await analyzeMatch(options.gameId, {
        onStart: (hitCache) => {
          // onStart 只能标记当前流的临时来源；未完成的缓存命中不能提前成为可恢复快照。
          if (requestId === latestRequestId && !streamFailed) {
            temporaryFromCache = hitCache
            // 后端缓存标记只进入临时缓冲；首个正文 chunk 前公开状态保持旧快照。
            if (hasPublishedFirstChunk) fromCache.value = hitCache
          }
        },
        onReasoning: (content) => {
          // reasoning 与正文共享同一 request id 校验，避免旧流晚到造成思考过程错配。
          if (requestId === latestRequestId && !streamFailed) {
            temporaryReasoning += content
            // 首个正文 chunk 前只累积 reasoning；失败时由 fail() 恢复旧快照。
            if (hasPublishedFirstChunk) reasoning.value = temporaryReasoning
          }
        },
        onChunk: (content) => {
          // 每个 chunk 到达时都重新确认请求归属，因为回调可能在新请求启动后才执行。
          if (requestId === latestRequestId && !streamFailed) {
            temporaryResult += content
            if (!hasPublishedFirstChunk) {
              // 首个正文 chunk 是临时缓冲提交到公开 refs 的唯一边界。
              hasPublishedFirstChunk = true
              result.value = temporaryResult
              reasoning.value = temporaryReasoning
              fromCache.value = temporaryFromCache
            }
            // 首块日志只记录长度，不记录模型正文，便于定位流式链路而不泄露内容。
            if (temporaryResult === content) {
              logger.info('对局分析首个正文片段已收到', {
                gameId: options.gameId,
                puuid: options.puuid.trim(),
                requestId,
                resultLength: content.length,
                reasoningLength: 0,
                messageLength: 0,
                chunkLength: content.length
              })
            }
            // 公开正文跟随每个 chunk 更新，形成打字机效果；这里严禁写 localStorage。
            result.value = temporaryResult
          }
        },
        onDone: (truncated) => {
          // 过期流和已失败流都不能提交，即使它们随后收到了完整 done 事件。
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
          // 只有当前请求收到完整 done 才能推进基线和缓存，半截流内容永远没有提交资格。
          latestSuccessfulSnapshot = snapshot
          writeSnapshot(cacheKey, snapshot, options, requestId)
          completed = true
          logger.info('对局分析请求已提交', {
            gameId: options.gameId,
            puuid: options.puuid.trim(),
            requestId,
            resultLength: snapshot.result.length,
            reasoningLength: snapshot.reasoning.length,
            messageLength: 0,
            truncated
          })
        },
        onError: (message) => fail(message)
      })

      // API 正常 resolve 但没有 done，仍视为失败；否则半截缓冲会绕过唯一提交边界。
      if (requestId === latestRequestId && !streamFailed && !completed) {
        fail('AI 分析未正常完成，请稍后重试')
      }
    } catch (error) {
      // 网络异常与流内 onError 统一进入 fail，保证调用方可重试且不会收到未处理 reject。
      const message = error instanceof Error ? error.message : 'AI 分析失败，请稍后重试'
      fail(message)
      // 仅 catch 的网络 reject 通知页面层，流内 onError 不会进入此分支。
      options.onNetworkError?.(message)
    } finally {
      // 只有最新请求可以结束 loading；旧请求收尾不能让新请求提前恢复可点击状态。
      if (requestId === latestRequestId) {
        activeRequest = false
        analyzing.value = false
      }
      if (activeRequests.get(cacheKey) === requestToken) {
        activeRequests.delete(cacheKey)
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
