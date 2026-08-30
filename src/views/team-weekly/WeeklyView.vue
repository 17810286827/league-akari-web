<!--
  车队周报页（/weekly）：默认展示上一周车队战报，可切换任意周；
  八栏目（总览/六榜单/名场面/AI 锐评）+ 一键生成分享图（发群用）。
  数据层走 getWeeklyReport（/api/team/weekly），AI 失败时后端已降级为 null，页面空态展示。
-->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { getWeeklyReport, apiErrorMessage } from '@/api/team'
import type { TeamBoardEntry, TeamWeeklyReport } from '@/api/team'

import { BOARD_META, downloadShareImage, formatDuration, weekShift } from './adapter'

/** 周锚点（该周内任意一天）：默认今天回退 7 天（即"上一周"） */
const weekDate = ref(defaultWeekDate())
/** 周报数据 */
const report = ref<TeamWeeklyReport | null>(null)
const loading = ref(false)
const errorMsg = ref('')

/** 默认周锚点：今天回退 7 天的 ISO 日期 */
function defaultWeekDate(): string {
  const date = new Date()
  date.setDate(date.getDate() - 7)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 榜单展示模型：元信息 + 条目（空数组 = 本周无数据） */
const boards = computed(() =>
  BOARD_META.map((meta) => ({
    ...meta,
    entries:
      (report.value?.[`${meta.key}Board` as keyof TeamWeeklyReport] as TeamBoardEntry[] | null) ?? []
  }))
)

/** 非空名场面列表（过滤 null 维度） */
const highlightItems = computed(() => {
  const highlights = report.value?.highlights
  if (!highlights) {
    return []
  }
  return [
    highlights.multiKillMoment,
    highlights.biggestComeback,
    highlights.worstStreak,
    highlights.mostKillsGame
  ].filter((item) => item != null)
})

/** 加载指定周的周报 */
async function load(): Promise<void> {
  loading.value = true
  errorMsg.value = ''
  try {
    report.value = await getWeeklyReport(weekDate.value)
  } catch (error) {
    // 后端 400（名单未配置）/503（成员解析失败）等：展示后端返回的明确原因
    errorMsg.value = apiErrorMessage(error, '周报加载失败，请稍后重试')
    report.value = null
  } finally {
    loading.value = false
  }
}

/** 周切换（上一周/下一周） */
function shiftWeek(weeks: number): void {
  weekDate.value = weekShift(weekDate.value, weeks)
}

// 周锚点变化（含切换）自动重查
watch(weekDate, load)

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-6">
    <!-- 顶部：标题 + 周切换 + 分享图 -->
    <header class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold text-emerald-300">车队周报</h1>
      <div class="flex items-center gap-2">
        <button
          class="rounded border border-slate-600 px-3 py-1 text-sm text-slate-300 hover:border-emerald-400"
          data-testid="week-prev"
          @click="shiftWeek(-1)"
        >
          ← 上一周
        </button>
        <span class="min-w-56 text-center text-sm text-slate-400" data-testid="week-label">
          {{ report?.weekLabel ?? '加载中…' }}
        </span>
        <button
          class="rounded border border-slate-600 px-3 py-1 text-sm text-slate-300 hover:border-emerald-400"
          data-testid="week-next"
          @click="shiftWeek(1)"
        >
          下一周 →
        </button>
        <button
          class="rounded bg-emerald-500/20 px-3 py-1 text-sm text-emerald-300 hover:bg-emerald-500/30"
          data-testid="share-button"
          @click="report && downloadShareImage(report)"
        >
          生成分享图
        </button>
      </div>
    </header>

    <!-- 加载与错误态 -->
    <div v-if="loading" class="py-20 text-center text-slate-400" data-testid="weekly-loading">
      正在聚合本周车队数据…
    </div>
    <div
      v-else-if="errorMsg"
      class="mx-auto max-w-lg rounded border border-red-500/40 bg-red-500/10 p-6 text-center text-red-300"
      data-testid="weekly-error"
    >
      {{ errorMsg }}
    </div>

    <!-- 周报主体 -->
    <template v-else-if="report">
      <!-- 总览 -->
      <section v-if="report.overview" class="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="overview">
        <div class="rounded bg-slate-800/60 p-4">
          <div class="text-xs text-slate-400">车队对局</div>
          <div class="text-2xl font-bold text-slate-100">{{ report.overview.gameCount }}</div>
        </div>
        <div class="rounded bg-slate-800/60 p-4">
          <div class="text-xs text-slate-400">人次胜负</div>
          <div class="text-2xl font-bold text-slate-100">
            {{ report.overview.winCount }} 胜 {{ report.overview.lossCount }} 负
          </div>
        </div>
        <div class="rounded bg-slate-800/60 p-4">
          <div class="text-xs text-slate-400">总时长</div>
          <div class="text-2xl font-bold text-slate-100">
            {{ formatDuration(report.overview.totalDurationSeconds) }}
          </div>
        </div>
        <div class="rounded bg-slate-800/60 p-4">
          <div class="text-xs text-slate-400">最疯狂的一天</div>
          <div class="text-2xl font-bold text-slate-100">{{ report.overview.busiestDay ?? '—' }}</div>
          <div class="text-xs text-slate-500">{{ report.overview.busiestDayGames }} 场</div>
        </div>
      </section>

      <!-- 六榜单：2 列卡片栅格 -->
      <section class="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div
          v-for="board in boards"
          :key="board.key"
          class="rounded border border-slate-700/60 bg-slate-800/40 p-4"
          :data-testid="`board-${board.key}`"
        >
          <h2 class="mb-2 text-sm font-semibold text-slate-300">{{ board.icon }} {{ board.title }}</h2>
          <ol v-if="board.entries.length">
            <li
              v-for="(entry, index) in board.entries"
              :key="entry.puuid"
              class="flex items-baseline justify-between border-b border-slate-700/40 py-1.5 last:border-0"
            >
              <span class="text-sm text-slate-200">
                <span class="mr-2 text-slate-500">{{ index + 1 }}.</span>{{ entry.riotId }}
              </span>
              <span class="text-sm text-emerald-300">
                {{ entry.value }}
                <span class="ml-1 text-xs text-slate-500">{{ entry.detail }}</span>
              </span>
            </li>
          </ol>
          <p v-else class="text-xs text-slate-500">本周暂无数据</p>
        </div>
      </section>

      <!-- 名场面 -->
      <section v-if="highlightItems.length" class="mb-6" data-testid="highlights">
        <h2 class="mb-2 text-sm font-semibold text-slate-300">🎬 名场面</h2>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div
            v-for="item in highlightItems"
            :key="`${item.gameId}-${item.title}`"
            class="rounded border border-amber-500/30 bg-amber-500/10 p-3"
          >
            <span class="mr-2 text-xs text-amber-400">{{ item.title }}</span>
            <span class="text-sm text-slate-200">{{ item.detail }}</span>
          </div>
        </div>
      </section>

      <!-- AI 锐评 -->
      <section
        v-if="report.aiComment"
        class="rounded border border-emerald-500/30 bg-emerald-500/10 p-4"
        data-testid="ai-comment"
      >
        <h2 class="mb-1 text-xs font-semibold text-emerald-400">🤖 AI 锐评</h2>
        <p class="text-sm leading-6 text-slate-200">{{ report.aiComment }}</p>
      </section>
    </template>
  </div>
</template>
