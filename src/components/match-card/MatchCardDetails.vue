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
 * 展开详情面板：总览队伍表格 + AI 对局表现分析（受控展示组件）。
 * AI 分析状态由页面层持有并通过 props 注入；组件只负责渲染和事件通知。
 * 按钮文案、禁用、markdown 渲染、reasoning 折叠、缓存/截断/错误提示语义保持不变。
 */
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'

import { useMatchCard } from './context'
import { useCardBorderClass } from './utils/theme'
import MatchCardSummaryTab from './tabs/MatchCardSummaryTab.vue'

const cardBorderClass = useCardBorderClass()

// markdown 渲染器：关闭内联 HTML（模型输出转义，防 XSS），只渲染标准 markdown 语法
const markdown = new MarkdownIt({ html: false, linkify: false })

// 对局上下文：gameId 用于触发分析时通知父层
const { summary } = useMatchCard()

/** AI 分析是否进行中，由父层控制 */
const analyzing = defineModel<boolean>('analyzing', { required: true })
/** 分析结果 markdown 正文 */
const result = defineModel<string>('result', { required: true })
/** 模型思考过程（思维链） */
const reasoning = defineModel<string>('reasoning', { required: true })
/** 思考过程折叠状态，双向绑定由父层同步 */
const reasoningCollapsed = defineModel<boolean>('reasoningCollapsed', { required: true })
/** 是否命中后端缓存 */
const fromCache = defineModel<boolean>('fromCache', { required: true })
/** 分析失败错误提示 */
const errorMsg = defineModel<string>('errorMsg', { required: true })
/** 输出被截断提示 */
const truncatedTip = defineModel<string>('truncatedTip', { required: true })

/** 通知父层发起分析 */
const emit = defineEmits<{
  analyze: []
}>()

/** 结果区 markdown 渲染（流式逐块追加时自动重算；html:false 保证输出安全） */
const renderedResult = computed(() => markdown.render(result.value))

/** 点击分析按钮，通知父层触发 AI 分析请求 */
function handleAnalyze(): void {
  if (analyzing.value) return
  emit('analyze')
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
