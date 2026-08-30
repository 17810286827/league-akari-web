<!--
  【原型】榜单中心五方案评审宿主（/leaderboards?variant=A~E，仅 dev 构建生效）：
  - 数据：榜单/成员卡真实接口 4 秒竞速，超时/失败回退内置示例数据；
  - 状态：维度/模式/时间筛选与选中成员联动，与原页面同口径（复用 adapter 的 rangeToParams）；
  - 渲染：整体交给对应方案组件，宿主统一处理加载遮罩与悬浮切换条。
  自定义时间范围（custom）在原型中省略——评审重点是字体/图标/布局而非筛选完备性。
-->
<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'

import { getMemberCard, getTeamLeaderboard, LEADERBOARD_DIMENSIONS } from '@/api/team'
import type { TeamBoardEntry, TeamLeaderboard, TeamMemberCard } from '@/api/team'

import { rangeToParams } from '../adapter'
import type { TimeRangeKey } from '../adapter'
import { mockLeaderboard, mockMemberCard } from '@/components/prototype/mock'
import { injectPrototypeFonts } from '@/components/prototype/fonts'
import PrototypeSwitcher from '@/components/prototype/PrototypeSwitcher.vue'

import VariantA from './VariantA.vue'
import VariantB from './VariantB.vue'
import VariantC from './VariantC.vue'
import VariantD from './VariantD.vue'
import VariantE from './VariantE.vue'
import type { LeaderboardCtx } from './ctx'

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

/** 筛选状态（与原页面同口径；原型不提供 custom 自定义范围） */
const dimension = ref('attendance')
const mode = ref<string | null>(null)
const rangeKey = ref<TimeRangeKey>('all')

/** 榜单数据与来源标记 */
const leaderboard = shallowRef<TeamLeaderboard | null>(null)
const usingMock = ref(false)
const loading = ref(false)

/** 成员卡联动状态 */
const selectedEntry = ref<TeamBoardEntry | null>(null)
const memberCard = shallowRef<TeamMemberCard | null>(null)
const cardLoading = ref(false)

/** 当前维度中文名 */
const dimensionLabel = computed(
  () => LEADERBOARD_DIMENSIONS.find((item) => item.key === dimension.value)?.label ?? dimension.value
)

/** 绝活榜按英雄分组：{ 英雄名, 组内条目 }[]（其他维度返回 null，平铺展示） */
const signatureGroups = computed<{ champion: string; items: TeamBoardEntry[] }[] | null>(() => {
  if (dimension.value !== 'signature' || !leaderboard.value) {
    return null
  }
  const groups = new Map<string, TeamBoardEntry[]>()
  for (const entry of leaderboard.value.entries) {
    // 英雄名优先取结构化字段；旧数据缺失时从 detail 前缀兜底解析
    const name = entry.championName ?? (entry.detail ? entry.detail.split(' ')[0] : '未知英雄')
    const group = groups.get(name)
    if (group) {
      group.push(entry)
    } else {
      groups.set(name, [entry])
    }
  }
  return [...groups.entries()].map(([champion, items]) => ({ champion, items }))
})

/**
 * 真实接口 4 秒竞速包装：超时/失败返回 null（由调用方决定兜底行为）。
 * 泛型 T 支持榜单与成员卡两个接口复用。
 */
async function raceReal<T>(task: Promise<T>): Promise<T | null> {
  try {
    return await Promise.race([
      task,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000))
    ])
  } catch (error) {
    console.info('[prototype] leaderboards: 真实接口失败', error)
    return null
  }
}

/** 加载当前筛选下的榜单；成功后自动选中第一名（成员卡立即有内容） */
async function load(): Promise<void> {
  loading.value = true
  const { start, end } = rangeToParams(rangeKey.value)
  const real = await raceReal(
    getTeamLeaderboard({ dimension: dimension.value, mode: mode.value ?? undefined, start, end })
  )
  if (real) {
    leaderboard.value = real
    usingMock.value = false
    console.info('[prototype] leaderboards: 使用真实数据', dimension.value)
  } else {
    leaderboard.value = mockLeaderboard(dimension.value)
    usingMock.value = true
    console.info('[prototype] leaderboards: 后端 4s 未响应，使用示例数据', dimension.value)
  }
  loading.value = false

  // 联动体验：榜单刷新后默认选中第一名
  const first = leaderboard.value?.entries?.[0]
  if (first) {
    await selectMember(first)
  } else {
    selectedEntry.value = null
    memberCard.value = null
  }
}

/** 选中成员并刷新成员卡（真实接口竞速 + 示例兜底） */
async function selectMember(entry: TeamBoardEntry): Promise<void> {
  selectedEntry.value = entry
  cardLoading.value = true
  const real = await raceReal(getMemberCard(entry.puuid))
  memberCard.value = real ?? mockMemberCard(entry.puuid)
  cardLoading.value = false
}

/** 筛选切换动作（传给方案组件） */
function setDimension(key: string): void {
  dimension.value = key
}
function setMode(value: string | null): void {
  mode.value = value
}
function setRange(key: TimeRangeKey): void {
  rangeKey.value = key
}

/** 跳转回主页 */
function goHome(): void {
  router.push('/')
}

// 筛选变化自动重查
watch([dimension, mode, rangeKey], load)
onMounted(load)

/** 传给方案组件的展示上下文（数据 + 状态 + 动作） */
const ctx = computed<LeaderboardCtx | null>(() =>
  leaderboard.value
    ? {
        dimension: dimension.value,
        setDimension,
        mode: mode.value,
        setMode,
        rangeKey: rangeKey.value,
        setRange,
        leaderboard: leaderboard.value,
        dimensionLabel: dimensionLabel.value,
        signatureGroups: signatureGroups.value,
        selectedEntry: selectedEntry.value,
        selectMember,
        memberCard: memberCard.value,
        cardLoading: cardLoading.value,
        goHome
      }
    : null
)
</script>

<template>
  <!-- 数据未就绪：居中准备提示 -->
  <div v-if="!ctx" class="flex min-h-screen items-center justify-center text-sm text-slate-400">
    正在准备评审数据…
  </div>

  <!-- 方案渲染：筛选重查时半透明禁点 -->
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
