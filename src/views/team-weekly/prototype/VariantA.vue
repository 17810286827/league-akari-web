<!--
  【原型 · 方案 A】电竞 HUD（车队周报）：
  - 字体：Rajdhani/Bahnschrift 压缩体数字 + 全大写宽字距英文标签（中文回退微软雅黑），
    数值统一 tabular-nums 保证列对齐；
  - 图标：ionicons 线性图标，嵌进切角小方块（HUD 触控件语言）；
  - 布局：HUD 状态头 → 切角总览模块 → MVP 领奖台（全宽）→ 双列榜单（带峰值迷你条）→
    横滚名场面 → 播报条式 AI 锐评。
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'

import {
  CalendarOutline,
  ChatbubblesOutline,
  ChevronBackOutline,
  ChevronForwardOutline,
  FilmOutline,
  FlameOutline,
  FlashOutline,
  HomeOutline,
  PulseOutline,
  RibbonOutline,
  ShareSocialOutline,
  SkullOutline,
  StatsChartOutline,
  TimeOutline,
  TrophyOutline
} from '@vicons/ionicons5'

import type { TeamBoardEntry, TeamWeeklyReport } from '@/api/team'
import { format2 } from '@/utils/format'

import { BOARD_META, formatDuration } from '../adapter'
import type { WeeklyCtx } from './ctx'

const props = defineProps<{ ctx: WeeklyCtx }>()

/** 榜单维度 → HUD 图标（与榜单中心方案 A 共用同一套映射语言） */
const BOARD_ICONS: Record<string, Component> = {
  mvp: TrophyOutline,
  opscore: StatsChartOutline,
  criminal: SkullOutline,
  feeder: PulseOutline,
  carry: FlashOutline,
  signature: RibbonOutline,
  attendance: CalendarOutline
}

/** 值展示：整数不带小数位，小数保留两位（HUD 大字号下更干净） */
function fmtValue(value: number): string {
  return Number.isInteger(value) ? String(value) : format2(value)
}

/** 榜单渲染模型：元信息 + 条目 + 峰值（迷你条形按峰值归一） */
const boards = computed(() =>
  BOARD_META.map((meta) => {
    const entries =
      (props.ctx.report[`${meta.key}Board` as keyof TeamWeeklyReport] as TeamBoardEntry[] | null) ??
      []
    const max = Math.max(...entries.map((item) => Math.abs(item.value)), 1)
    return { ...meta, entries, max }
  })
)

/** MVP 榜前三（领奖台展示），其余六个榜单进入双列区 */
const podium = computed(() => boards.value.find((board) => board.key === 'mvp')?.entries.slice(0, 3) ?? [])
const otherBoards = computed(() => boards.value.filter((board) => board.key !== 'mvp'))

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

/** 最疯狂的一天：ISO 日期缩写为 MM-DD（HUD 风格短标签） */
const busiestDayShort = computed(() => props.ctx.report.overview?.busiestDay?.slice(5) ?? '--')
</script>

<template>
  <div class="min-h-screen bg-[#060a12] px-5 pb-24 pt-5 font-hud text-slate-200">
    <div class="mx-auto max-w-6xl">
      <!-- HUD 状态头：主页 | 周导航+大字周标签 | 分享 -->
      <header class="mb-7 flex items-center justify-between gap-4 border-b border-cyan-400/20 pb-5">
        <button
          class="clip-corner flex h-10 w-10 items-center justify-center bg-slate-800/80 text-slate-300 transition-colors hover:bg-cyan-400/20 hover:text-cyan-300"
          data-testid="home-button"
          aria-label="主页"
          @click="ctx.goHome"
        >
          <HomeOutline :width="16" :height="16" />
        </button>
        <div class="flex items-center gap-4">
          <button
            class="clip-corner flex h-8 w-8 items-center justify-center bg-slate-800/80 text-slate-400 hover:bg-cyan-400/20 hover:text-cyan-300"
            data-testid="week-prev"
            aria-label="上一周"
            @click="ctx.shiftWeek(-1)"
          >
            <ChevronBackOutline :width="14" :height="14" />
          </button>
          <div class="text-center">
            <div class="text-[10px] font-semibold uppercase tracking-[0.45em] text-emerald-300/80">
              Fleet Weekly Report
            </div>
            <div class="text-3xl font-bold tracking-wider text-slate-100 tabular-nums">
              {{ ctx.report.weekLabel }}
            </div>
          </div>
          <button
            class="clip-corner flex h-8 w-8 items-center justify-center bg-slate-800/80 text-slate-400 hover:bg-cyan-400/20 hover:text-cyan-300"
            data-testid="week-next"
            aria-label="下一周"
            @click="ctx.shiftWeek(1)"
          >
            <ChevronForwardOutline :width="14" :height="14" />
          </button>
        </div>
        <button
          class="clip-corner flex items-center gap-2 bg-emerald-400/15 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-300 transition-colors hover:bg-emerald-400/25"
          data-testid="share-button"
          @click="ctx.share"
        >
          <ShareSocialOutline :width="13" :height="13" /> 分享图
        </button>
      </header>

      <!-- 总览：切角数据模块 -->
      <section v-if="ctx.report.overview" class="mb-7 grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="overview">
        <div class="clip-corner bg-gradient-to-b from-cyan-400/12 to-cyan-400/[0.03] p-4">
          <div class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">
            <StatsChartOutline :width="12" :height="12" /> 车队对局
          </div>
          <div class="mt-1.5 text-4xl font-bold text-cyan-300 tabular-nums">{{ ctx.report.overview.gameCount }}</div>
        </div>
        <div class="clip-corner bg-gradient-to-b from-emerald-400/12 to-emerald-400/[0.03] p-4">
          <div class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">
            <TrophyOutline :width="12" :height="12" /> 人次胜负
          </div>
          <div class="mt-1.5 text-4xl font-bold tabular-nums">
            <span class="text-emerald-300">{{ ctx.report.overview.winCount }}</span>
            <span class="mx-1 text-[16px] text-slate-500">/</span>
            <span class="text-rose-400">{{ ctx.report.overview.lossCount }}</span>
          </div>
        </div>
        <div class="clip-corner bg-gradient-to-b from-cyan-400/12 to-cyan-400/[0.03] p-4">
          <div class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">
            <TimeOutline :width="12" :height="12" /> 总时长
          </div>
          <div class="mt-1.5 text-4xl font-bold text-cyan-300 tabular-nums">
            {{ formatDuration(ctx.report.overview.totalDurationSeconds) }}
          </div>
        </div>
        <div class="clip-corner bg-gradient-to-b from-amber-400/12 to-amber-400/[0.03] p-4">
          <div class="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400">
            <FlameOutline :width="12" :height="12" /> 最疯狂
          </div>
          <div class="mt-1.5 text-4xl font-bold text-amber-300 tabular-nums">
            {{ busiestDayShort }}
            <span class="text-[16px] text-slate-400">{{ ctx.report.overview.busiestDayGames }}场</span>
          </div>
        </div>
      </section>

      <!-- MVP 领奖台：全宽切角面板 -->
      <section v-if="podium.length" class="clip-corner mb-6 bg-emerald-400/[0.06] p-5" data-testid="board-mvp">
        <h2 class="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.35em] text-emerald-300">
          <TrophyOutline :width="14" :height="14" /> MVP 领奖台
        </h2>
        <div class="grid grid-cols-3 gap-3">
          <div
            v-for="(entry, index) in podium"
            :key="entry.puuid"
            class="clip-corner bg-[#0b1220]/80 p-4 text-center"
            :class="index === 0 ? 'ring-1 ring-emerald-400/60' : ''"
          >
            <div class="text-4xl font-bold tabular-nums" :class="['text-amber-300', 'text-slate-300', 'text-orange-400'][index]">
              {{ index + 1 }}
            </div>
            <div class="mt-1 truncate text-sm text-slate-200">{{ entry.riotId }}</div>
            <div class="text-2xl font-bold text-emerald-300 tabular-nums">{{ fmtValue(entry.value) }}</div>
            <div class="mt-0.5 text-[10px] uppercase tracking-widest text-slate-500">{{ entry.detail }}</div>
          </div>
        </div>
      </section>

      <!-- 六榜单：双列切角面板 + 峰值迷你条 -->
      <section class="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div
          v-for="board in otherBoards"
          :key="board.key"
          class="border border-slate-700/50 bg-[#0b1220]/60 p-4"
          :data-testid="`board-${board.key}`"
        >
          <h2 class="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.25em] text-slate-300">
            <span class="clip-corner flex h-6 w-6 items-center justify-center bg-cyan-400/15 text-cyan-300">
              <component :is="BOARD_ICONS[board.key]" :width="12" :height="12" />
            </span>
            {{ board.title }}
            <span class="ml-auto text-[10px] font-normal tracking-normal text-slate-500">{{ board.entries.length }} 人</span>
          </h2>
          <ol v-if="board.entries.length" class="space-y-2">
            <li v-for="(entry, index) in board.entries" :key="entry.puuid">
              <div class="flex items-baseline justify-between gap-2 text-sm">
                <span class="flex min-w-0 items-baseline gap-2">
                  <span
                    class="w-6 text-right text-xs font-bold tabular-nums"
                    :class="index < 3 ? 'text-emerald-300' : 'text-slate-500'"
                  >
                    {{ String(index + 1).padStart(2, '0') }}
                  </span>
                  <span class="truncate text-slate-200">{{ entry.riotId }}</span>
                </span>
                <span class="shrink-0 text-right">
                  <span class="font-bold text-slate-100 tabular-nums">{{ fmtValue(entry.value) }}</span>
                  <span class="ml-1 text-[10px] text-slate-500">{{ entry.detail }}</span>
                </span>
              </div>
              <!-- 相对峰值的迷你条（HUD 数据条） -->
              <div class="ml-8 mt-1 h-0.5 bg-slate-700/40">
                <div
                  class="h-full bg-gradient-to-r from-cyan-400 to-emerald-400"
                  :style="{ width: `${(Math.abs(entry.value) / board.max) * 100}%` }"
                />
              </div>
            </li>
          </ol>
          <p v-else class="py-2 text-xs text-slate-500">本周暂无数据</p>
        </div>
      </section>

      <!-- 名场面：横向滚动卡片 -->
      <section v-if="highlights.length" class="mb-6" data-testid="highlights">
        <h2 class="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.35em] text-amber-300">
          <FilmOutline :width="14" :height="14" /> 名场面 / Highlights
        </h2>
        <div class="flex gap-3 overflow-x-auto pb-1">
          <div
            v-for="item in highlights"
            :key="`${item.gameId}-${item.title}`"
            class="clip-corner min-w-72 flex-1 border-l-4 border-amber-400 bg-amber-400/[0.07] p-4"
          >
            <div class="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-300">{{ item.title }}</div>
            <div class="mt-2 text-sm text-slate-200">{{ item.detail }}</div>
          </div>
        </div>
      </section>

      <!-- AI 锐评：播报条 -->
      <section
        v-if="ctx.report.aiComment"
        class="clip-corner flex gap-4 bg-[#0b1220]/80 p-5"
        data-testid="ai-comment"
      >
        <div class="flex h-10 w-10 shrink-0 items-center justify-center bg-emerald-400/15 text-emerald-300">
          <ChatbubblesOutline :width="18" :height="18" />
        </div>
        <div>
          <div class="text-[10px] font-bold uppercase tracking-[0.4em] text-emerald-300">AI Comment · 锐评</div>
          <p class="mt-1.5 text-sm leading-6 text-slate-300">{{ ctx.report.aiComment }}</p>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* HUD 数字/英文：Rajdhani（评审注入）→ Bahnschrift（Windows 内置 DIN 风格）→ 系统兜底 */
.font-hud {
  font-family: Rajdhani, Bahnschrift, 'Segoe UI', 'Microsoft YaHei', sans-serif;
}

/* 切角面板：左上/右下 45° 切角（HUD 模块签名元素） */
.clip-corner {
  clip-path: polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px);
}
</style>
