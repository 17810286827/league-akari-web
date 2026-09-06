<script setup lang="ts">
/**
 * 时间线复盘面板（工单 #35 / spec #29）：
 * 经济差曲线（Chart.js，正 = 我方领先）+ 击杀事件散点标记（敌我分色）+
 * 关键转折点高亮（散点 + 时间轴列表，规则引擎确定性提取）。
 * 无时间线对局（available=false）降级显示提示，不渲染空白曲线。
 * 数据经 getMatchReplay（GET /api/matches/{gameId}/replay），不依赖 AI。
 */
import { computed, onMounted, ref } from 'vue'
import MarkdownIt from 'markdown-it'
import { NEmpty, NSpin } from 'naive-ui'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  ScatterController,
  Tooltip,
  type ChartData,
  type ChartOptions
} from 'chart.js'
import { Line } from 'vue-chartjs'

import { getMatchReplay, streamReplayComment } from '@/api/matches'
import type { MatchReplay, ReplayTurningPoint } from '@/api/types'
import { createLogger } from '@/utils/logger'

const logger = createLogger('ReplayPanel')

// Chart.js 模块注册（项目惯例：各图表组件模块级注册一次，全局生效）
// Filler：fill:'origin' 填充必需；ScatterController：击杀/转折点散点数据集必需
// （未注册时运行时抛 "scatter" is not a registered controller，面板渲染崩溃）
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ScatterController, Tooltip, Legend, Filler)

const props = defineProps<{
  /** 对局 ID（LCU） */
  gameId: number
  /** 对局时长（秒，降级分支的 stats 简要信息用） */
  durationSeconds?: number
}>()

/** 复盘数据（null = 加载中或失败） */
const replay = ref<MatchReplay | null>(null)
const loading = ref(false)
const errorMsg = ref('')

/** 转折点类型 → 徽标文案与配色（与后端引擎常量一一对应） */
const TURNING_POINT_META: Record<string, { label: string; color: string }> = {
  FIRST_BLOOD: { label: '一血', color: '#e0554d' },
  TEAM_WIPE: { label: '团灭', color: '#d4a017' },
  BARON: { label: '大龙', color: '#9b59b6' },
  GOLD_DIFF_EXTREME: { label: '经济极值', color: '#3d8bfd' },
  GOLD_LEAD_CHANGE: { label: '经济反超', color: '#18a058' }
}

/** 未知类型的兜底展示 */
const UNKNOWN_META = { label: '转折点', color: '#8a8a8a' }

/** 事件时间戳 → 最近的帧索引（散点定位到曲线 x 轴） */
function nearestFrameIndex(timestampMs: number): number {
  const series = replay.value?.goldDiffSeries ?? []
  let index = 0
  let bestGap = Number.POSITIVE_INFINITY
  for (let i = 0; i < series.length; i++) {
    const gap = Math.abs(series[i].timestampMs - timestampMs)
    if (gap < bestGap) {
      bestGap = gap
      index = i
    }
  }
  return index
}

/** 帧时间戳 → 分钟标签（x 轴刻度） */
function minuteLabel(timestampMs: number): string {
  return `${Math.floor(timestampMs / 60000)}分`
}

/** 对局内时间 → mm:ss 展示 */
function formatTime(timestampMs: number): string {
  const totalSeconds = Math.floor(timestampMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}

/** 曲线 x 轴标签（帧分钟） */
const labels = computed(() => (replay.value?.goldDiffSeries ?? []).map((p) => minuteLabel(p.timestampMs)))

/** 击杀散点数据（定位到最近帧，取该帧经济差为 y 值；直接携带敌我标记供分组过滤） */
const killPoints = computed(() => {
  const series = replay.value?.goldDiffSeries ?? []
  return (replay.value?.killEvents ?? []).map((kill) => {
    const index = nearestFrameIndex(kill.timestampMs)
    return {
      x: index,
      y: series[index]?.goldDiff ?? 0,
      // 敌我标记：数据集分组过滤用（不依赖与 killEvents 的下标对齐）
      _perspective: kill.killerIsPerspective,
      // 自定义字段：tooltip 回调读取（敌我 + 击杀者/被击杀者）
      _info: `${kill.killerIsPerspective ? '我方' : '敌方'} ${kill.killerChampion}（${kill.killerName}）击杀 ${kill.victimChampion}（${kill.victimName}）`
    }
  })
})

/** 转折点散点数据（定位到最近帧） */
const turningPoints = computed(() => replay.value?.turningPoints ?? [])

const turningPointScatter = computed(() => {
  const series = replay.value?.goldDiffSeries ?? []
  return turningPoints.value.map((point) => {
    const index = nearestFrameIndex(point.timestampMs)
    return {
      x: index,
      y: series[index]?.goldDiff ?? 0,
      _info: `${point.title} · ${point.detail}`
    }
  })
})

/**
 * Chart.js 数据集：经济差折线 + 击杀散点（敌我分色）+ 转折点散点。
 * Line 组件泛型为 "line" 而数据集混入 scatter 类型（Chart.js 运行时支持
 * 混合图表控制器的数据集），以 as 收窄类型——散点数据形状与线数据点兼容
 */
const chartData = computed(() => ({
  labels: labels.value,
  datasets: [
    {
      type: 'line' as const,
      label: '经济差（正 = 我方领先）',
      data: (replay.value?.goldDiffSeries ?? []).map((p) => p.goldDiff),
      borderColor: '#3d8bfd',
      backgroundColor: 'rgba(61, 139, 253, 0.15)',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0,
      fill: 'origin'
    },
    {
      type: 'scatter' as const,
      label: '我方击杀',
      data: killPoints.value.filter((p) => p._perspective),
      pointStyle: 'triangle' as const,
      radius: 6,
      hoverRadius: 8,
      backgroundColor: '#18a058'
    },
    {
      type: 'scatter' as const,
      label: '敌方击杀',
      data: killPoints.value.filter((p) => !p._perspective),
      pointStyle: 'crossRot' as const,
      radius: 6,
      hoverRadius: 8,
      backgroundColor: '#e0554d'
    },
    {
      type: 'scatter' as const,
      label: '关键转折点',
      data: turningPointScatter.value,
      pointStyle: 'rectRot' as const,
      radius: 7,
      hoverRadius: 9,
      backgroundColor: '#d4a017'
    }
  ]
}) as unknown as ChartData<'line'>)

/** Chart.js 配置：tooltip 展示散点自定义信息（击杀/转折点详情） */
const chartOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 300 },
  interaction: { mode: 'nearest' as const, axis: 'x' as const, intersect: false },
  scales: {
    x: { ticks: { maxTicksLimit: 12 } },
    y: { title: { display: true, text: '经济差' } }
  },
  plugins: {
    tooltip: {
      callbacks: {
        // 散点（击杀/转折点）携带 _info 自定义文案；折线走默认 label
        label: (context: { dataset: { data: unknown }; dataIndex: number }) => {
          const point = (context.dataset.data as Array<{ _info?: string }>)[context.dataIndex]
          // 折线数据点无 _info：返回 void（tooltip 回调允许无返回值跳过该行）
          if (!point?._info) {
            return
          }
          return point._info
        }
      }
    }
  }
}

/** AI 复盘叙述状态（工单 #40）：手动按钮触发，打字机流式 */
const aiNarration = ref('')
const aiReasoning = ref('')
const aiStreaming = ref(false)
const aiError = ref('')
/** 思维链折叠状态（与"战犯出列"同款交互：默认折叠，点击展开/收起） */
const aiReasoningCollapsed = ref(true)

// markdown 渲染器：关闭内联 HTML（模型输出转义，防 XSS），与战犯出列同款配置
const markdown = new MarkdownIt({ html: false, linkify: false })

/** 叙述正文的 markdown 渲染结果（打字机逐块追加时自动重算） */
const renderedNarration = computed(() => markdown.render(aiNarration.value))

/** 触发 AI 复盘叙述（转折点驱动，SSE 流式打字机） */
async function narrate(): Promise<void> {
  if (aiStreaming.value) {
    return
  }
  aiStreaming.value = true
  aiNarration.value = ''
  aiReasoning.value = ''
  aiError.value = ''
  try {
    await streamReplayComment(props.gameId, {
      onChunk: (content) => {
        aiNarration.value += content
      },
      onReasoning: (content) => {
        aiReasoning.value += content
      },
      onReasoningReset: () => {
        aiReasoning.value = ''
      }
    })
  } catch (error) {
    // 开流前失败（4101 无 Key / 2002 无时间线）：锐评区降级提示
    aiError.value = error instanceof Error ? error.message : 'AI 复盘生成失败，请稍后重试'
  } finally {
    aiStreaming.value = false
  }
}

/** 当前选中的转折点索引（点击列表项高亮，再次点击取消） */
const selectedTurningPoint = ref<number | null>(null)

/** 点击转折点列表项：切换选中高亮 */
function toggleTurningPoint(index: number): void {
  selectedTurningPoint.value = selectedTurningPoint.value === index ? null : index
}

/** 对局时长 → "X 分 X 秒"（降级分支的 stats 简要信息） */
function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) {
    return ''
  }
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return minutes > 0 ? `${minutes} 分 ${secs} 秒` : `${secs} 秒`
}

/** 转折点元信息（类型 → 文案/配色），未知类型兜底 */
function metaOf(point: ReplayTurningPoint) {
  return TURNING_POINT_META[point.type] ?? UNKNOWN_META
}

onMounted(async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    replay.value = await getMatchReplay(props.gameId)
    logger.info('Replay loaded', {
      gameId: props.gameId,
      available: replay.value.available,
      turningPoints: replay.value.turningPoints.length
    })
  } catch (error) {
    // 加载失败：面板整体降级提示（不影响上方的对局卡片）
    errorMsg.value = error instanceof Error ? error.message : '复盘数据加载失败'
    logger.error('Replay load failed', { gameId: props.gameId, error })
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <!-- 复盘面板：挂在详情卡片下方，独立加载独立降级 -->
  <section class="replay-panel" data-testid="replay-panel">
    <header class="mb-3 flex items-center gap-2">
      <span class="text-base font-bold">⏱ 时间线复盘</span>
      <span class="text-xs opacity-60">正 = 我方领先 · 规则引擎确定性提取，非 AI</span>
    </header>

    <!-- 加载中 -->
    <n-spin v-if="loading" :show="loading" data-testid="replay-loading" />

    <!-- 加载失败 -->
    <n-empty
      v-else-if="errorMsg"
      description="复盘数据加载失败，请稍后重试"
      data-testid="replay-error"
      class="py-6"
    />

    <!-- 无时间线降级：提示 + 不渲染空白曲线 -->
    <div v-else-if="!replay?.available" class="py-6 text-center text-sm opacity-70" data-testid="replay-unavailable">
      该对局没有时间线数据（历史回填的对局普遍缺失），无法生成复盘曲线。
      <br />时间线由桌面端实时采集，之后的对局会自动支持复盘。
      <!-- stats 简要信息：时长 + 结果/KDA 等详细统计见上方对局卡片 -->
      <p v-if="formatDuration(durationSeconds)" class="mt-2 text-xs">
        本局时长 {{ formatDuration(durationSeconds) }} · 详细统计见上方对局卡片
      </p>
    </div>

    <!-- 复盘主体：曲线 + 转折点列表 -->
    <template v-else>
      <div class="replay-chart" data-testid="replay-chart">
        <Line :data="chartData" :options="chartOptions" />
      </div>

      <!-- 转折点时间轴：曲线下方按时间排列，与散点一一对应 -->
      <ol v-if="turningPoints.length" class="mt-4 space-y-2" data-testid="replay-turning-points">
        <li
          v-for="(point, index) in turningPoints"
          :key="`${point.type}-${point.timestampMs}-${index}`"
          class="flex cursor-pointer items-start gap-3 border-l-2 pl-3 transition-opacity"
          :class="selectedTurningPoint === index ? 'opacity-100 bg-black/5 rounded-r' : 'opacity-80 hover:opacity-100'"
          :style="{ borderColor: metaOf(point).color }"
          :data-testid="`replay-turning-point-${index}`"
          @click="toggleTurningPoint(index)"
        >
          <span
            class="shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold text-white"
            :style="{ backgroundColor: metaOf(point).color }"
          >
            {{ metaOf(point).label }}
          </span>
          <span class="text-xs opacity-60 tabular-nums">{{ formatTime(point.timestampMs) }}</span>
          <span class="text-sm">{{ point.detail }}</span>
        </li>
      </ol>
      <p v-else class="mt-3 text-center text-xs opacity-50">本局未提取到关键转折点</p>

      <!-- AI 复盘叙述（工单 #40）：手动按钮触发，只消费转折点做解读 -->
      <div class="mt-4 border-t border-gray-300/20 pt-3" data-testid="replay-ai">
        <button
          class="rounded border border-current px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
          :disabled="aiStreaming"
          data-testid="replay-ai-button"
          @click="narrate"
        >
          {{ aiStreaming ? '教练正在复盘……' : aiNarration ? '重新复盘' : '✦ AI 复盘叙述' }}
        </button>
        <!-- 思维链折叠（与"战犯出列"同款交互与视觉：默认折叠，虚线框灰字，主题化滚动条） -->
        <button
          v-if="aiReasoning"
          type="button"
          class="ai-reasoning-toggle"
          data-testid="replay-ai-reasoning-toggle"
          @click="aiReasoningCollapsed = !aiReasoningCollapsed"
        >
          {{ aiReasoningCollapsed ? '🧠 模型思考过程（点击展开）' : '🧠 模型思考过程（点击收起）' }}
        </button>
        <div v-if="aiReasoning && !aiReasoningCollapsed" class="ai-reasoning">{{ aiReasoning }}</div>
        <!-- 叙述正文（markdown 渲染：## 小节 / - 列表 / **加粗**，打字机逐块追加自动重算） -->
        <div v-if="aiNarration" class="ai-narration" data-testid="replay-ai-text" v-html="renderedNarration"></div>
        <!-- 失败降级（仅影响本区块） -->
        <p v-if="aiError" class="mt-2 text-sm" style="color: #d03050" data-testid="replay-ai-error">
          ⚠ {{ aiError }}
        </p>
      </div>
    </template>
  </section>
</template>

<style scoped>
/* 复盘面板容器：与详情卡片同宽，浅色描边区分 */
.replay-panel {
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 8px;
  padding: 16px;
}

/* 图表固定高度（Chart.js responsive 模式需要显式容器高度） */
.replay-chart {
  position: relative;
  height: 320px;
}

/* 思维链折叠条（战犯出列同款：小字灰虚线框，hover 提亮） */
.ai-reasoning-toggle {
  margin-top: 10px;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px dashed rgba(74, 222, 128, 0.2);
  background: rgba(17, 22, 17, 0.5);
  color: #8b9a8f;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}

.ai-reasoning-toggle:hover {
  border-color: rgba(74, 222, 128, 0.45);
  color: #a7f3d0;
}

/* 模型思考过程（战犯出列同款：灰字小号 + 虚线框 + 限高滚动 + 主题化滚动条） */
.ai-reasoning {
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
  /* 滚动条主题化：透明轨道 + 暗绿圆角滑块（hover 提亮），与侧栏/战犯出列统一 */
  scrollbar-width: thin;
  scrollbar-color: rgba(139, 154, 143, 0.4) transparent;
}

.ai-reasoning::-webkit-scrollbar {
  width: 8px;
}

.ai-reasoning::-webkit-scrollbar-track {
  background: transparent;
}

.ai-reasoning::-webkit-scrollbar-thumb {
  background: rgba(139, 154, 143, 0.4);
  border-radius: 4px;
}

.ai-reasoning::-webkit-scrollbar-thumb:hover {
  background: #4ade80;
}

/* 叙述正文：markdown 渲染区（v-html 内容用 :deep 命中内部元素） */
.ai-narration {
  margin-top: 8px;
  font-size: 14px;
  line-height: 1.8;
}

.ai-narration :deep(h2),
.ai-narration :deep(h3) {
  margin: 12px 0 6px;
  font-size: 15px;
  font-weight: 700;
}

.ai-narration :deep(ul),
.ai-narration :deep(ol) {
  margin: 6px 0;
  padding-left: 20px;
}

.ai-narration :deep(p) {
  margin: 6px 0;
}
</style>
