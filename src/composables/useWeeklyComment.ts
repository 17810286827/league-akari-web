/**
 * 周报 AI 锐评流式状态（工单 #33 / ADR 0007）：
 * 周报页先渲染统计，锐评经 streamWeeklyComment 打字机逐字推送。
 *
 * - onChunk 追加到公开 ref（打字机效果，与 useMatchAnalysis 同手法）；
 * - reasoning 实时发布不等正文首块（思考阶段本身就需要实时反馈）；
 * - onReasoningReset 清空思维链缓冲（后端重试信号，见 server docs/adr/0006）；
 * - 不做 localStorage 快照：周报锐评后端有 10 分钟 JVM 缓存（命中 fromCache=true
 *   全文秒推），刷新后重新拉流的成本可接受，无需前端持久化。
 *
 * 竞态防护（双闸门，缺一不可）：
 * - 全局最新请求序号 latestRequest：快速切周时只有最后发起的流生效——
 *   旧流回调全部丢弃（防止两个周的 chunk 交错串台到同一 comment ref），
 *   旧流 finally 不复位 streaming（那是新流的状态）；
 * - 按周活动流表 activeByDate：同一周的流正在进行且仍是最新流时不重复发起
 *   （防重复请求）；若同周旧流已被别的周取代（回调已废），允许重新发起。
 * 网络层 reject（开流前失败，如 4101 Key 未配置）转为 errorMsg 状态，由页面层展示。
 */
import { ref, type Ref } from 'vue'
import { streamWeeklyComment } from '@/api/team'

const TRUNCATED_TIP = '锐评可能因长度限制被截断。'

/** 模块级最新请求序号：跨周串台防护（最后发起的流独占状态写入权） */
let latestRequest: symbol | null = null

/** 模块级按周活动流表：周键 → 该周进行中流的请求序号（同周去重用） */
const activeByDate = new Map<string, symbol>()

/** 暴露给组件的响应式状态和操作。 */
export interface WeeklyCommentState {
  /** 锐评流进行中（含思维链阶段） */
  streaming: Ref<boolean>
  /** 锐评正文（打字机逐字累积；空串=尚未开始/无内容） */
  comment: Ref<string>
  /** 模型思考过程（灰字折叠区；仅思考模式模型才有内容） */
  reasoning: Ref<string>
  /** 思维链折叠状态 */
  reasoningCollapsed: Ref<boolean>
  /** 命中后端缓存（start 事件 fromCache=true，全文一次性到达） */
  fromCache: Ref<boolean>
  /** 错误提示（开流前 reject 或流内 error 事件；空串=无错误） */
  errorMsg: Ref<string>
  /** 输出被长度预算截断的提示 */
  truncatedTip: Ref<string>
  /** 拉取指定周的锐评流（切周时调用，旧流结果自动丢弃） */
  load: (date: string | undefined) => Promise<void>
  /** 切换思维链折叠 */
  toggleReasoning: () => void
}

/**
 * 创建周报锐评流式状态（页面层持有，load 时传入当前周锚点）
 */
export function useWeeklyComment(): WeeklyCommentState {
  const streaming = ref(false)
  const comment = ref('')
  const reasoning = ref('')
  const reasoningCollapsed = ref(true)
  const fromCache = ref(false)
  const errorMsg = ref('')
  const truncatedTip = ref('')

  /** 拉取指定周的锐评流：快速切周时以最后发起的流为准（序号闸门丢弃过期结果） */
  async function load(date: string | undefined): Promise<void> {
    // 周键：undefined（上一周）与具体日期统一为字符串键
    const key = date ?? ''
    // 同周的流正在进行且仍是最新流：不重复发起（防双击/重入重复请求）
    const existing = activeByDate.get(key)
    if (existing != null && latestRequest === existing) {
      return
    }
    if (existing != null) {
      // 同周旧流已被其他周取代（其回调已被丢弃）：清掉废键允许重新发起
      activeByDate.delete(key)
    }
    const requestId = Symbol('weekly-comment')
    activeByDate.set(key, requestId)
    // 本流成为最新流：夺取状态写入权（旧流回调从此全部失效）
    latestRequest = requestId
    // 重置状态：新的一周从空开始（旧周的半截内容不残留）
    streaming.value = true
    comment.value = ''
    reasoning.value = ''
    fromCache.value = false
    errorMsg.value = ''
    truncatedTip.value = ''
    try {
      await streamWeeklyComment(date, {
        onStart: (cached) => {
          if (latestRequest !== requestId) {
            return
          }
          fromCache.value = cached
        },
        onChunk: (content) => {
          if (latestRequest !== requestId) {
            return
          }
          comment.value += content
        },
        onReasoning: (content) => {
          if (latestRequest !== requestId) {
            return
          }
          reasoning.value += content
        },
        onReasoningReset: () => {
          if (latestRequest !== requestId) {
            return
          }
          reasoning.value = ''
        },
        onDone: (truncated) => {
          if (latestRequest !== requestId) {
            return
          }
          truncatedTip.value = truncated ? TRUNCATED_TIP : ''
        },
        onError: (message) => {
          if (latestRequest !== requestId) {
            return
          }
          errorMsg.value = message
        }
      })
    } catch (error) {
      // 开流前失败（如 4101 Key 未配置）：转为页面可展示的错误状态
      if (latestRequest === requestId) {
        errorMsg.value = error instanceof Error ? error.message : '周报锐评加载失败，请稍后重试'
      }
    } finally {
      // 清理本周活动键（仅当仍是自己，防止误删后来者）
      if (activeByDate.get(key) === requestId) {
        activeByDate.delete(key)
      }
      // 只有最新流才复位 streaming（旧流的 finally 不动新流的状态）
      if (latestRequest === requestId) {
        streaming.value = false
        latestRequest = null
      }
    }
  }

  /** 切换思维链折叠（有 reasoning 时页面渲染折叠按钮） */
  function toggleReasoning(): void {
    reasoningCollapsed.value = !reasoningCollapsed.value
  }

  return {
    streaming,
    comment,
    reasoning,
    reasoningCollapsed,
    fromCache,
    errorMsg,
    truncatedTip,
    load,
    toggleReasoning
  }
}
