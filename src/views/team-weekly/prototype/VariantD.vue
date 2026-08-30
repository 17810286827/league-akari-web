<!--
  【原型 · 方案 D】终端密度（车队周报）：
  - 字体：全等宽（JetBrains Mono/Consolas），13px 高密度小字号 + 等宽数字；
  - 图标：零图形图标——ASCII/字符语言（● ○ ▓ ░ [BRACKET] :: >_ //）；
  - 布局：状态栏 → 周导航行 → 六格 key:value 总览 → 双列密集表格（点线引导 + ASCII 比例条）→
    日志行名场面 → 块注释式 AI 锐评；CRT 扫描线背景；
  - 配色：纯黑底 + 磷光绿 + 琥珀事件色。
-->
<script setup lang="ts">
import { computed } from 'vue'

import type { TeamBoardEntry, TeamWeeklyReport } from '@/api/team'
import { format2 } from '@/utils/format'

import { BOARD_META } from '../adapter'
import type { WeeklyCtx } from './ctx'

const props = defineProps<{ ctx: WeeklyCtx }>()

/** 值展示：整数不带小数位，小数保留两位 */
function fmtValue(value: number): string {
  return Number.isInteger(value) ? String(value) : format2(value)
}

/** ASCII 比例条：相对峰值归一到 10 格（▓ 填充 / ░ 空槽） */
function bar(value: number, max: number): string {
  const filled = Math.max(0, Math.min(10, Math.round((Math.abs(value) / max) * 10)))
  return '▓'.repeat(filled) + '░'.repeat(10 - filled)
}

/** 总时长 → "11H30M"（等宽紧凑格式） */
function durationCompact(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? `${h}H${String(m).padStart(2, '0')}M` : `${m}M`
}

/** 榜单渲染模型：元信息 + 条目 + 峰值 */
const boards = computed(() =>
  BOARD_META.map((meta) => {
    const entries =
      (props.ctx.report[`${meta.key}Board` as keyof TeamWeeklyReport] as TeamBoardEntry[] | null) ?? []
    const max = Math.max(...entries.map((item) => Math.abs(item.value)), 1)
    return { ...meta, entries, max }
  })
)

/** 总览 key:value 行（终端状态摘要） */
const overviewStats = computed(() => {
  const overview = props.ctx.report.overview
  if (!overview) {
    return []
  }
  const total = overview.winCount + overview.lossCount
  return [
    { label: 'GAMES', value: String(overview.gameCount) },
    { label: 'WIN/LOSS', value: `${overview.winCount}/${overview.lossCount}` },
    { label: 'WIN_RATE', value: total > 0 ? `${((overview.winCount / total) * 100).toFixed(1)}%` : '--' },
    { label: 'TIME', value: durationCompact(overview.totalDurationSeconds) },
    { label: 'PEAK_DAY', value: overview.busiestDay?.slice(5) ?? '--' },
    { label: 'PEAK_GMS', value: String(overview.busiestDayGames) }
  ]
})

/** 非空名场面列表（过滤 null 维度） */
const highlights = computed(() => {
  const items = props.ctx.report.highlights
  if (!items) {
    return []
  }
  return [items.multiKillMoment, items.biggestComeback, items.worstStreak, items.mostKillsGame].filter(
    (item) => item != null
  )
})
</script>

<template>
  <div class="scanlines min-h-screen bg-[#050a07] px-4 pb-24 pt-0 font-term text-[13px] leading-relaxed text-[#7ef0a6]">
    <div class="mx-auto max-w-6xl">
      <!-- 状态栏 -->
      <header class="flex flex-wrap items-center justify-between gap-2 border-b border-[#123820] py-3">
        <div class="flex items-center gap-3">
          <span class="font-bold text-emerald-300">&gt;_ 车队周报 // FLEET_WEEKLY</span>
          <span class="text-[#3e7a55]">{{ ctx.report.teamName ?? 'UNNAMED_TEAM' }}</span>
        </div>
        <nav class="flex items-center gap-2 text-xs">
          <button
            class="px-2 py-0.5 text-emerald-300 hover:bg-[#0f2a1a]"
            data-testid="home-button"
            @click="ctx.goHome"
          >
            [HOME]
          </button>
          <button
            class="px-2 py-0.5 text-emerald-300 hover:bg-[#0f2a1a]"
            data-testid="share-button"
            @click="ctx.share"
          >
            [EXPORT.PNG]
          </button>
        </nav>
      </header>

      <!-- 周导航行 -->
      <div class="flex flex-wrap items-center justify-between gap-2 border-b border-[#123820] py-2 text-xs">
        <button class="px-2 py-0.5 hover:bg-[#0f2a1a]" data-testid="week-prev" @click="ctx.shiftWeek(-1)">
          [&lt;&lt; PREV_WEEK]
        </button>
        <span class="text-emerald-200">WEEK: {{ ctx.report.weekLabel }}</span>
        <button class="px-2 py-0.5 hover:bg-[#0f2a1a]" data-testid="week-next" @click="ctx.shiftWeek(1)">
          [NEXT_WEEK &gt;&gt;]
        </button>
      </div>

      <!-- 总览：六格 key:value -->
      <section
        v-if="overviewStats.length"
        class="mb-4 mt-4 grid grid-cols-2 gap-x-8 gap-y-1 border border-[#123820] p-3 md:grid-cols-6"
        data-testid="overview"
      >
        <div v-for="stat in overviewStats" :key="stat.label" class="whitespace-nowrap">
          <span class="text-[#3e7a55]">{{ stat.label }}</span>
          <span class="font-bold text-emerald-200">: {{ stat.value }}</span>
        </div>
      </section>

      <!-- 榜单：双列密集表格（点线引导 + ASCII 比例条） -->
      <section class="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div v-for="board in boards" :key="board.key" class="border border-[#123820] p-3" :data-testid="`board-${board.key}`">
          <div class="mb-2 flex items-baseline gap-2 border-b border-[#123820] pb-1.5">
            <span class="font-bold text-emerald-300">[{{ board.title }}]</span>
            <span class="text-[#3e7a55]">rank={{ board.entries.length }}</span>
          </div>
          <ol v-if="board.entries.length" class="space-y-0.5">
            <li v-for="(entry, index) in board.entries" :key="entry.puuid" class="flex items-baseline gap-2 whitespace-nowrap">
              <span
                class="w-8 shrink-0 font-bold tabular-nums"
                :class="index < 3 ? 'text-amber-300' : 'text-[#3e7a55]'"
              >
                {{ index < 3 ? '●' : '○' }}{{ String(index + 1).padStart(2, '0') }}
              </span>
              <span class="truncate text-emerald-100">{{ entry.riotId }}</span>
              <!-- 点线引导：名字与数值之间的填充线 -->
              <span class="dot-leader" aria-hidden="true" />
              <span class="shrink-0 font-bold text-emerald-300 tabular-nums">{{ fmtValue(entry.value) }}</span>
              <span class="hidden shrink-0 text-[#3e7a55] lg:inline">{{ entry.detail }}</span>
              <span class="hidden shrink-0 text-[#2c5e3f] xl:inline">{{ bar(entry.value, board.max) }}</span>
            </li>
          </ol>
          <p v-else class="text-[#3e7a55]">// 本周暂无数据</p>
        </div>
      </section>

      <!-- 名场面：事件日志行 -->
      <section v-if="highlights.length" class="mb-4 border border-[#123820] p-3" data-testid="highlights">
        <div class="mb-1.5 text-[#3e7a55]">// HIGHLIGHTS_LOG</div>
        <div v-for="item in highlights" :key="`${item.gameId}-${item.title}`" class="whitespace-normal">
          <span class="font-bold text-amber-300">[EVENT]</span>
          <span class="text-emerald-200">{{ item.title }}</span>
          <span class="text-[#3e7a55]"> :: </span>
          <span class="text-emerald-100">{{ item.detail }}</span>
        </div>
      </section>

      <!-- AI 锐评：块注释 -->
      <section v-if="ctx.report.aiComment" class="border border-[#123820] p-3" data-testid="ai-comment">
        <div class="mb-1.5 text-[#3e7a55]">/* AI_COMMENT */</div>
        <p class="italic text-emerald-200">{{ ctx.report.aiComment }}</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* 终端等宽：JetBrains Mono（评审注入）→ Consolas（Windows 内置）→ 等宽兜底；中文回退雅黑 */
.font-term {
  font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace, 'Microsoft YaHei';
}

/* CRT 扫描线：2px 周期的横向细纹 */
.scanlines {
  background-image: repeating-linear-gradient(
    0deg,
    rgba(74, 222, 128, 0.05) 0px,
    rgba(74, 222, 128, 0.05) 1px,
    transparent 1px,
    transparent 4px
  );
}

/* 点线引导：名字与数值之间的填充（表格签名元素） */
.dot-leader {
  flex: 1 1 auto;
  min-width: 10px;
  height: 0.75em;
  border-bottom: 1px dotted #1e4d30;
}
</style>
