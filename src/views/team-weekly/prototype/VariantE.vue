<!--
  【原型 · 方案 E】轻卡圆角（车队周报）：
  - 字体：Nunito 圆体数字 + 系统黑体中文，超粗字重数值；
  - 图标：material 圆润实心图标 + 彩色圆角 chip 底座；
  - 布局：悬浮白胶囊头部（粘顶）→ 胶囊周切换分段 → 彩色总览卡 →
    白卡榜单（圆形名次徽章 + 值 pill）→ 琥珀名场面 → 渐变 AI 横幅；
  - 配色：浅灰底 + 白卡 + 靛蓝主色，五方案中唯一的 SaaS 仪表盘气质。
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'

import {
  AutoAwesomeFilled,
  BoltFilled,
  ChevronLeftFilled,
  ChevronRightFilled,
  EmojiEventsFilled,
  EventAvailableFilled,
  HomeFilled,
  InsightsFilled,
  LocalFireDepartmentFilled,
  PersonOffFilled,
  ScheduleFilled,
  SportsEsportsFilled,
  StarFilled,
  ThumbDownFilled,
  ThumbUpFilled
} from '@vicons/material'

import type { TeamBoardEntry, TeamWeeklyReport } from '@/api/team'

import { BOARD_META, formatDuration } from '../adapter'
import type { WeeklyCtx } from './ctx'

const props = defineProps<{ ctx: WeeklyCtx }>()

/** 榜单维度 → 圆润 material 图标 */
const BOARD_ICONS: Record<string, Component> = {
  mvp: EmojiEventsFilled,
  opscore: InsightsFilled,
  criminal: ThumbDownFilled,
  feeder: PersonOffFilled,
  carry: BoltFilled,
  signature: StarFilled,
  attendance: EventAvailableFilled
}

/** 总览卡片渲染模型（图标 + 彩色 chip + 数值 + 标签） */
const overviewCards = computed(() => {
  const overview = props.ctx.report.overview
  if (!overview) {
    return []
  }
  return [
    {
      icon: SportsEsportsFilled,
      chip: 'bg-indigo-100 text-indigo-600',
      value: String(overview.gameCount),
      label: '车队对局'
    },
    {
      icon: ThumbUpFilled,
      chip: 'bg-emerald-100 text-emerald-600',
      value: `${overview.winCount}胜${overview.lossCount}负`,
      label: '人次胜负'
    },
    {
      icon: ScheduleFilled,
      chip: 'bg-sky-100 text-sky-600',
      value: formatDuration(overview.totalDurationSeconds),
      label: '总时长'
    },
    {
      icon: LocalFireDepartmentFilled,
      chip: 'bg-rose-100 text-rose-600',
      value: overview.busiestDay ? `${overview.busiestDay.slice(5)} · ${overview.busiestDayGames}场` : '—',
      label: '最疯狂的一天'
    }
  ]
})

/** 榜单渲染模型：元信息 + 条目 */
const boards = computed(() =>
  BOARD_META.map((meta) => ({
    ...meta,
    entries:
      (props.ctx.report[`${meta.key}Board` as keyof TeamWeeklyReport] as TeamBoardEntry[] | null) ?? []
  }))
)

/** 名次徽章配色：金/银/铜圆底，其余浅灰 */
const RANK_BADGES = [
  'bg-amber-100 text-amber-600',
  'bg-slate-200 text-slate-600',
  'bg-orange-100 text-orange-600'
]

/** 值展示：整数不带小数位，小数保留两位 */
function fmtValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

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

/** 周标签短格式："08-24 ~ 08-30"（胶囊里放不下年份） */
const weekLabelShort = computed(() => {
  const parts = props.ctx.report.weekLabel.split(' ~ ')
  return parts.map((part) => part.slice(5)).join(' ~ ')
})
</script>

<template>
  <div class="min-h-screen bg-[#f4f5f7] pb-24 font-round text-slate-800">
    <!-- 悬浮白胶囊头部（粘顶） -->
    <header class="sticky top-3 z-10 mx-auto max-w-5xl px-4">
      <div class="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
        <button
          class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200"
          data-testid="home-button"
          aria-label="主页"
          @click="ctx.goHome"
        >
          <HomeFilled :width="18" :height="18" />
        </button>
        <div class="text-center">
          <div class="text-[16px] font-extrabold">{{ ctx.report.teamName ?? '车队' }} · 车队周报</div>
          <div class="text-[11px] text-slate-400">{{ ctx.report.weekLabel }}</div>
        </div>
        <button
          class="rounded-full bg-indigo-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-indigo-600"
          data-testid="share-button"
          @click="ctx.share"
        >
          分享图
        </button>
      </div>

      <!-- 周切换：胶囊分段控件 -->
      <div class="mx-auto mt-3 flex w-fit items-center gap-1 rounded-full bg-white p-1 shadow-sm">
        <button
          class="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100"
          data-testid="week-prev"
          aria-label="上一周"
          @click="ctx.shiftWeek(-1)"
        >
          <ChevronLeftFilled :width="18" :height="18" />
        </button>
        <span class="px-2 text-xs font-bold tabular-nums text-slate-600">{{ weekLabelShort }}</span>
        <button
          class="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100"
          data-testid="week-next"
          aria-label="下一周"
          @click="ctx.shiftWeek(1)"
        >
          <ChevronRightFilled :width="18" :height="18" />
        </button>
      </div>
    </header>

    <main class="mx-auto max-w-5xl px-4 pt-6">
      <!-- 总览：彩色统计卡 -->
      <section v-if="overviewCards.length" class="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="overview">
        <div v-for="card in overviewCards" :key="card.label" class="rounded-2xl bg-white p-4 shadow-sm">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl" :class="card.chip">
            <component :is="card.icon" :width="18" :height="18" />
          </div>
          <div class="mt-2.5 text-2xl font-extrabold tabular-nums">{{ card.value }}</div>
          <div class="mt-0.5 text-xs text-slate-400">{{ card.label }}</div>
        </div>
      </section>

      <!-- 榜单：白卡 + 圆形名次徽章 + 值 pill -->
      <section class="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div v-for="board in boards" :key="board.key" class="rounded-2xl bg-white p-5 shadow-sm" :data-testid="`board-${board.key}`">
          <h2 class="mb-3 flex items-center gap-2.5 text-sm font-bold text-slate-700">
            <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-500">
              <component :is="BOARD_ICONS[board.key]" :width="15" :height="15" />
            </span>
            {{ board.title }}
            <span class="ml-auto text-[11px] font-normal text-slate-400">{{ board.entries.length }} 人</span>
          </h2>
          <ol v-if="board.entries.length" class="space-y-1">
            <li
              v-for="(entry, index) in board.entries"
              :key="entry.puuid"
              class="flex items-center gap-3 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-slate-50"
            >
              <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold tabular-nums"
                :class="index < 3 ? RANK_BADGES[index] : 'bg-slate-100 text-slate-400'"
              >
                {{ index + 1 }}
              </span>
              <span class="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{{ entry.riotId }}</span>
              <span class="shrink-0 text-right">
                <span class="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700 tabular-nums">
                  {{ fmtValue(entry.value) }}
                </span>
                <span class="ml-1.5 text-[10px] text-slate-400">{{ entry.detail }}</span>
              </span>
            </li>
          </ol>
          <p v-else class="py-3 text-center text-xs text-slate-400">本周暂无数据</p>
        </div>
      </section>

      <!-- 名场面：琥珀圆角卡 -->
      <section v-if="highlights.length" class="mb-4" data-testid="highlights">
        <h2 class="mb-2 px-1 text-sm font-bold text-slate-700">✨ 名场面</h2>
        <div class="grid gap-3 md:grid-cols-2">
          <div
            v-for="item in highlights"
            :key="`${item.gameId}-${item.title}`"
            class="flex items-start gap-3 rounded-2xl bg-amber-50 p-4"
          >
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-500">
              <BoltFilled :width="16" :height="16" />
            </span>
            <div>
              <div class="text-xs font-bold text-amber-600">{{ item.title }}</div>
              <div class="mt-0.5 text-sm text-slate-600">{{ item.detail }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- AI 锐评：渐变横幅 -->
      <section
        v-if="ctx.report.aiComment"
        class="rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 p-5 text-white shadow-sm"
        data-testid="ai-comment"
      >
        <div class="flex items-center gap-2 text-xs font-bold tracking-widest text-indigo-100">
          <AutoAwesomeFilled :width="15" :height="15" /> AI 锐评
        </div>
        <p class="mt-2 text-sm leading-6">{{ ctx.report.aiComment }}</p>
      </section>
    </main>
  </div>
</template>

<style scoped>
/* 圆体数值：Nunito（评审注入）+ 系统圆黑体兜底 */
.font-round {
  font-family: Nunito, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
</style>
