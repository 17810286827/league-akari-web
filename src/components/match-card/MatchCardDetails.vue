<template>
  <!-- expanded details：淡绿终端面板（半透明毛玻璃 + 绿调描边 + 柔和投影）
       精简版：只保留"总览"（队伍表格），其余 Tab（详尽/符文/事件/构建/时间线）按需求移除；
       表格下方为 AI 对局表现分析（调用 opencode go 模型） -->
  <div
    class="glass-card transition-width @container relative mt-1 box-border w-full overflow-hidden rounded-xl border border-solid p-2"
    :class="cardBorderClass"
  >
    <MatchCardSummaryTab />

    <!-- AI 对局表现分析：按钮 + 结果区域 -->
    <div class="ai-analysis">
      <button
        type="button"
        class="ai-analysis-button"
        :disabled="analyzing"
        @click="handleAnalyze"
      >
        {{ analyzing ? '点名中...' : result ? '战犯再点名！' : '战犯出列！' }}
      </button>

      <!-- 缓存命中提示：2 分钟内已分析过，展示缓存结果 -->
      <p v-if="fromCache" class="ai-analysis-cache-tip">（2 分钟内已点名过，展示缓存结果）</p>

      <!-- 模型思考过程（思维链可能极长，默认折叠；点击展开/收起） -->
      <button
        v-if="reasoning"
        type="button"
        class="ai-analysis-reasoning-toggle"
        @click="reasoningCollapsed = !reasoningCollapsed"
      >
        {{ reasoningCollapsed ? '🧠 模型思考过程（点击展开）' : '🧠 模型思考过程（点击收起）' }}
      </button>
      <div v-if="reasoning && !reasoningCollapsed" class="ai-analysis-reasoning">{{ reasoning }}</div>

      <!-- 分析结果（markdown 渲染：## 小节 / - 列表 / **加粗**） -->
      <div v-if="result" class="ai-analysis-result" v-html="renderedResult"></div>

      <!-- 输出被长度预算截断的提示（正文不完整，建议调大 ai.max-tokens） -->
      <p v-if="truncatedTip" class="ai-analysis-truncated-tip">{{ truncatedTip }}</p>
      <p v-if="errorMsg" class="ai-analysis-error">{{ errorMsg }}</p>
    </div>
  </div>
</template>

<script lang="ts" setup>
/**
 * 展开详情面板：总览队伍表格 + AI 对局表现分析（SSE 流式，打字机效果）
 * AI 分析：调后端 /api/matches/{gameId}/ai-analysis（SSE 流，后端取详情组装数据摘要
 * 流式调用 opencode go 模型，逐块推送；结果 JVM 缓存；无 API Key 时后端返回 503）
 */
import { computed, ref } from 'vue'
import MarkdownIt from 'markdown-it'
import { useMessage } from 'naive-ui'

import { analyzeMatch } from '@/api/matches'
import { createLogger } from '@/utils/logger'

import { useMatchCard } from './context'
import { useCardBorderClass } from './utils/theme'
import MatchCardSummaryTab from './tabs/MatchCardSummaryTab.vue'

const logger = createLogger('MatchCardDetails')
const message = useMessage()
const cardBorderClass = useCardBorderClass()

// markdown 渲染器：关闭内联 HTML（模型输出转义，防 XSS），只渲染标准 markdown 语法
const markdown = new MarkdownIt({ html: false, linkify: false })

// 对局上下文：gameId 用于调分析接口
const { summary } = useMatchCard()

/** 分析请求中标记（防止重复点击） */
const analyzing = ref(false)
/** 分析结果（markdown 文本，流式逐块累积） */
const result = ref('')
/** 模型思考过程（reasoning_content 思维链，灰字展示；推理模式先思考后输出正文） */
const reasoning = ref('')
/** 思考过程是否折叠（思维链极长，默认折叠，点击展开） */
const reasoningCollapsed = ref(true)
/** 是否命中后端缓存（2 分钟内已分析过，start 事件携带） */
const fromCache = ref(false)
/** 分析失败提示 */
const errorMsg = ref('')
/** 输出被长度预算截断的提示（done 事件 truncated=true） */
const truncatedTip = ref('')

/** 结果区 markdown 渲染（流式逐块追加时自动重算；html:false 保证输出安全） */
const renderedResult = computed(() => markdown.render(result.value))

/**
 * 触发 AI 分析：发起 SSE 流式请求，onChunk 逐块追加渲染（打字机效果）；
 * 命中缓存时 start 事件置 fromCache（提示"2 分钟内已点名过"）；
 * 流中途错误走 onError，HTTP 错误（404/503）走 catch
 */
async function handleAnalyze(): Promise<void> {
  const gameId = summary.value?.gameId
  if (!gameId || analyzing.value) {
    return
  }
  analyzing.value = true
  errorMsg.value = ''
  result.value = ''
  reasoning.value = ''
  truncatedTip.value = ''
  // 新一轮分析：思考过程默认收起（思维链太长，避免刷屏）
  reasoningCollapsed.value = true
  try {
    await analyzeMatch(gameId, {
      // 流开始：携带后端缓存标记（命中则下方提示"2 分钟内已点名过"）
      onStart: (hitCache) => {
        fromCache.value = hitCache
        logger.info('AI analysis stream started', { gameId, fromCache: hitCache })
      },
      // 增量片段：逐块追加到结果区，实现打字机效果
      onChunk: (chunk) => {
        result.value += chunk
      },
      // 模型思考过程：灰字逐块追加（推理模式先输出思维链，让用户看到"正在思考"而非无响应）
      onReasoning: (chunk) => {
        reasoning.value += chunk
      },
      onDone: (truncated) => {
        logger.info('AI analysis stream done', { gameId, length: result.value.length, truncated })
        // 输出被长度预算截断：正文不完整，提示用户（对应后端 ai.max-tokens 配置）
        if (truncated) {
          truncatedTip.value = '⚠️ 内容因长度限制被截断（可调大 ai.max-tokens 后重试）'
        }
      },
      // 流中途失败（如模型接口异常）：后端推送 error 事件后关闭连接
      onError: (reason) => {
        logger.error('AI analysis stream error event', { gameId, reason })
        errorMsg.value = `AI 分析失败：${reason}`
      }
    })
  } catch (error) {
    // HTTP 错误（404 对局不存在 / 503 无 API Key / 网络错误）：message 为明确原因
    const reason = error instanceof Error ? error.message : '未知错误'
    logger.error('Failed to analyze match', { gameId, error })
    // 错误提示先写入结果区（保证可见），toast 为增强提示（异常时不影响 errorMsg 渲染）
    errorMsg.value = `AI 分析失败：${reason}`
    try {
      message.error(errorMsg.value)
    } catch (toastError) {
      logger.warn('AI analysis toast failed', { gameId, toastError })
    }
  } finally {
    analyzing.value = false
  }
}
</script>

<style scoped>
@import './match-card.css';

/* AI 分析区：按钮 + 结果（表格下方） */
.ai-analysis {
  margin-top: 10px;
  padding: 0 4px;
}

.ai-analysis-button {
  padding: 8px 18px;
  border-radius: 10px;
  background: linear-gradient(90deg, #4ade80, #86efac);
  color: #0b0f0c;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(74, 222, 128, 0.25);
  transition: filter 0.15s, opacity 0.15s;

  &:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

/* 思考过程折叠条：小字灰，可点击展开/收起（思维链太长，默认折叠） */
.ai-analysis-reasoning-toggle {
  margin-top: 10px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px dashed rgba(74, 222, 128, 0.2);
  background: rgba(17, 22, 17, 0.5);
  color: #8b9a8f;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;

  &:hover {
    border-color: rgba(74, 222, 128, 0.45);
    color: #a7f3d0;
  }
}

/* 模型思考过程：灰字小号 + 虚线边框（与正文区分；打字机逐块追加） */
.ai-analysis-reasoning {
  margin-top: 8px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px dashed rgba(74, 222, 128, 0.18);
  background: rgba(17, 22, 17, 0.5);
  color: #8b9a8f;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 260px;
  overflow-y: auto;
}

/* 分析结果：markdown 渲染区（绿调分隔；v-html 内容用 :deep 命中内部元素） */
.ai-analysis-result {
  margin-top: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(74, 222, 128, 0.25);
  background: rgba(17, 22, 17, 0.7);
  color: #ecfdf5;
  font-size: 14px;
  line-height: 1.7;
  word-break: break-word;

  /* markdown 元素：小节标题绿调描边，列表/段落收紧间距 */
  :deep(h2) {
    margin: 10px 0 6px;
    padding-bottom: 4px;
    border-bottom: 1px solid rgba(74, 222, 128, 0.2);
    color: #a7f3d0;
    font-size: 15px;
  }

  :deep(h2:first-child) {
    margin-top: 0;
  }

  :deep(p) {
    margin: 4px 0;
  }

  :deep(ul) {
    margin: 4px 0;
    padding-left: 18px;
    list-style: disc;
  }

  :deep(li) {
    margin: 3px 0;
  }

  :deep(strong) {
    color: #a7f3d0;
    font-weight: 600;
  }
}

/* 缓存命中提示：小字灰 */
.ai-analysis-cache-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #9ca3af;
}

/* 输出截断提示：琥珀色小字（正文不完整时显示） */
.ai-analysis-truncated-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #fbbf24;
}

/* 分析失败提示 */
.ai-analysis-error {
  margin-top: 8px;
  font-size: 13px;
  color: #f87171;
}
</style>
