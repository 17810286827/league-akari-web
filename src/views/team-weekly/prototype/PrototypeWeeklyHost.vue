<!--
  【原型】车队周报五方案评审宿主（/weekly?variant=A~E，仅 dev 构建生效）：
  - 数据：真实接口 4 秒竞速，超时/失败回退内置示例数据（周报含同步 AI 锐评，最坏 90s+）；
  - 状态：周锚点与切换逻辑与原页面同口径（复用 adapter 的 weekShift）；
  - 渲染：整体交给对应方案组件，宿主只在数据未就绪时显示准备提示，
    并在周切换重查期间对方案内容加半透明遮罩（统一加载反馈）。
  方案组件不写任何请求逻辑，保证"只换呈现、不换口径"。
-->
<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'

import { getWeeklyReport } from '@/api/team'
import type { TeamWeeklyReport } from '@/api/team'

import { downloadShareImage, weekShift } from '../adapter'
import { mockWeeklyReport } from '@/components/prototype/mock'
import { injectPrototypeFonts } from '@/components/prototype/fonts'
import PrototypeSwitcher from '@/components/prototype/PrototypeSwitcher.vue'

import VariantA from './VariantA.vue'
import VariantB from './VariantB.vue'
import VariantC from './VariantC.vue'
import VariantD from './VariantD.vue'
import VariantE from './VariantE.vue'
import type { WeeklyCtx } from './ctx'

const props = defineProps<{ variantKey: string }>()

const router = useRouter()

// 挂载即注入评审字体（幂等，两个宿主共享）
injectPrototypeFonts()

/** 方案 key → 组件映射（静态导入，保持简单直接） */
const VARIANT_COMPONENTS = {
  A: VariantA,
  B: VariantB,
  C: VariantC,
  D: VariantD,
  E: VariantE
} as const

/** 当前方案对应的渲染组件 */
const variantComponent = computed(
  () => VARIANT_COMPONENTS[props.variantKey as keyof typeof VARIANT_COMPONENTS]
)

/** 周锚点：默认上一周（与原页面 defaultWeekDate 同口径） */
const weekDate = ref(defaultWeekDate())
/** 周报数据（真实或示例） */
const report = shallowRef<TeamWeeklyReport | null>(null)
/** 是否示例数据 */
const usingMock = ref(false)
/** 首次加载 / 周切换重查中 */
const loading = ref(false)

/** 默认周锚点：今天回退 7 天的 ISO 日期（即"上一周"） */
function defaultWeekDate(): string {
  const date = new Date()
  date.setDate(date.getDate() - 7)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 原型模式数据加载：真实接口 4 秒竞速，超时或失败即回退示例数据并打标记。
 * 竞速落败的真实响应不会写状态（只有 race 结果允许 set），无晚到覆盖问题。
 */
async function load(): Promise<void> {
  loading.value = true
  let real: TeamWeeklyReport | null = null
  try {
    real = await Promise.race([
      getWeeklyReport(weekDate.value),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))
    ])
  } catch (error) {
    console.info('[prototype] weekly: 真实接口失败，回退示例数据', error)
    real = null
  }
  if (real) {
    // 兼容现有页面取值 bug：页面按 opscoreBoard 取值，接口字段是 opScoreBoard（大写 S），
    // 真实数据补别名，避免评审时 op_score 榜误显示"暂无数据"
    ;(real as unknown as Record<string, unknown>).opscoreBoard = real.opScoreBoard
    report.value = real
    usingMock.value = false
    console.info('[prototype] weekly: 使用真实数据', weekDate.value)
  } else {
    report.value = mockWeeklyReport(weekDate.value)
    usingMock.value = true
    console.info('[prototype] weekly: 后端 4s 未响应，使用示例数据', weekDate.value)
  }
  loading.value = false
}

/** 周切换（上一周/下一周），触发自动重查 */
function shiftWeek(weeks: number): void {
  weekDate.value = weekShift(weekDate.value, weeks)
}

/** 跳转回主页 */
function goHome(): void {
  router.push('/')
}

/** 生成分享图（沿用现有 canvas 生成器，原型不重做导出） */
function share(): void {
  if (report.value) {
    downloadShareImage(report.value)
  }
}

// 周锚点变化（含切换）自动重查
watch(weekDate, load)
onMounted(load)

/** 传给方案组件的展示上下文（数据 + 动作） */
const ctx = computed<WeeklyCtx | null>(() =>
  report.value
    ? {
        report: report.value,
        weekDate: weekDate.value,
        usingMock: usingMock.value,
        shiftWeek,
        goHome,
        share
      }
    : null
)
</script>

<template>
  <!-- 数据未就绪：居中准备提示（方案组件需要 report 才能渲染） -->
  <div v-if="!ctx" class="flex min-h-screen items-center justify-center text-sm text-slate-400">
    正在准备评审数据…
  </div>

  <!-- 方案渲染：周切换重查时半透明禁点，统一加载反馈 -->
  <div
    v-else
    class="transition-opacity duration-200"
    :class="loading ? 'pointer-events-none opacity-40' : 'opacity-100'"
  >
    <component :is="variantComponent" :ctx="ctx" />
  </div>

  <!-- 评审悬浮切换条：右侧标注数据来源 -->
  <PrototypeSwitcher :current="variantKey" :note="usingMock ? '示例数据' : '真实数据'" />
</template>
