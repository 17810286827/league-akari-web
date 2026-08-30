<!--
  【原型 · 方案 C】海克斯魔典（车队周报）：
  - 字体：Cinzel 罗马碑刻体标题 + 金色渐变字；数字用衬线；中文回退楷体（魔典手抄感）；
  - 图标：Unicode 装饰符文（✦ ❖ ⚔ ☾ ◈），金银铜名次徽记，双线金边框面板；
  - 布局：居中卷轴式窄容器 → 符文圆盘总览 → 卡槽式榜单面板（金银铜徽记）→
    鎏金名场面 → 青铜"神谕"AI 锐评；
  - 配色：LoL 官方海克斯色板（深蓝 #0a1428 + 金 #c8aa6e + 青 #0ac8b9）。
-->
<script setup lang="ts">
import { computed } from 'vue'

import type { TeamBoardEntry, TeamWeeklyReport } from '@/api/team'

import { BOARD_META } from '../adapter'
import type { WeeklyCtx } from './ctx'

const props = defineProps<{ ctx: WeeklyCtx }>()

/** 值展示：整数不带小数位，小数保留两位 */
function fmtValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

/** 金银铜名次徽记配色（边框 + 文字同色，圆形徽章） */
const MEDAL_CLASSES = [
  'border-[#f0d9a6]/80 text-[#f0d9a6]',
  'border-[#cfd8e3]/60 text-[#cfd8e3]',
  'border-[#cd8f52]/70 text-[#cd8f52]'
]

/** 榜单渲染模型：元信息 + 条目 */
const boards = computed(() =>
  BOARD_META.map((meta) => ({
    ...meta,
    entries:
      (props.ctx.report[`${meta.key}Board` as keyof TeamWeeklyReport] as TeamBoardEntry[] | null) ?? []
  }))
)

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

/** 总览符文盘（圆形符文盘四枚） */
const overview = computed(() => props.ctx.report.overview)

/** 总时长拆成小时/分钟（圆盘内分两行展示） */
function durationParts(seconds: number): { value: string; unit: string } {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? { value: String(h), unit: `小时${m}分` } : { value: String(m), unit: '分钟' }
}
</script>

<template>
  <div class="min-h-screen bg-[#081120] px-6 pb-24 pt-8 font-hex">
    <div class="mx-auto max-w-4xl">
      <!-- 顶部符文分隔线 -->
      <div class="ornament" aria-hidden="true">
        <span class="ornament-line" /><span class="text-[#c8aa6e]/80">✦</span><span class="ornament-line" />
      </div>

      <!-- 魔典标题区 -->
      <header class="mt-6 text-center">
        <div class="flex items-start justify-between text-[17px] font-semibold text-[#c8aa6e]/90">
          <button class="hover:text-[#f0d9a6]" data-testid="home-button" @click="ctx.goHome">❖ 主页</button>
          <button class="hover:text-[#f0d9a6]" data-testid="share-button" @click="ctx.share">❖ 分享图</button>
        </div>
        <div class="mt-3 text-sm font-semibold uppercase tracking-[0.35em] text-[#0ac8b9]">Weekly Chronicle</div>
        <h1 class="gold-text mt-2 text-6xl font-black tracking-[0.12em]">
          {{ ctx.report.teamName ?? '车队' }} · 周报
        </h1>
        <p class="mt-3 text-lg font-semibold tracking-[0.2em] text-[#0ac8b9]">{{ ctx.report.weekLabel }}</p>

        <!-- 周导航：符文箭头 -->
        <nav class="mt-4 flex items-center justify-center gap-6 text-lg font-semibold text-[#c8aa6e]">
          <button class="hover:text-[#f0d9a6]" data-testid="week-prev" @click="ctx.shiftWeek(-1)">‹ 上周</button>
          <span class="text-[#c8aa6e]/40">✦</span>
          <button class="hover:text-[#f0d9a6]" data-testid="week-next" @click="ctx.shiftWeek(1)">下周 ›</button>
        </nav>
      </header>

      <!-- 总览：四枚符文圆盘 -->
      <section v-if="overview" class="mt-8 flex flex-wrap items-center justify-center gap-7" data-testid="overview">
        <div class="rune-disc">
          <div class="gold-text text-4xl font-bold tabular-nums">{{ overview.gameCount }}</div>
          <div class="mt-1 text-sm font-semibold tracking-[0.15em] text-slate-200">车队对局</div>
        </div>
        <div class="rune-disc">
          <div class="text-4xl font-bold tabular-nums">
            <span class="text-[#0ac8b9]">{{ overview.winCount }}</span>
            <span class="mx-0.5 text-lg font-semibold text-slate-300">胜</span>
            <span class="text-[#cd6a5a]">{{ overview.lossCount }}</span>
            <span class="text-lg font-semibold text-slate-300">负</span>
          </div>
          <div class="mt-1 text-sm font-semibold tracking-[0.15em] text-slate-200">人次胜负</div>
        </div>
        <div class="rune-disc">
          <div class="gold-text text-4xl font-bold tabular-nums">{{ durationParts(overview.totalDurationSeconds).value }}</div>
          <div class="mt-1 text-sm font-semibold tracking-[0.15em] text-slate-200">
            {{ durationParts(overview.totalDurationSeconds).unit }}
          </div>
        </div>
        <div class="rune-disc">
          <div class="gold-text text-4xl font-bold tabular-nums">{{ overview.busiestDayGames }}</div>
          <div class="mt-1 text-sm font-semibold tracking-[0.15em] text-slate-200">
            {{ overview.busiestDay ? `${overview.busiestDay.slice(5)} 最疯狂` : '最疯狂之日' }}
          </div>
        </div>
      </section>

      <!-- 榜单：卡槽面板（双线金边 + 符文标题） -->
      <section class="mt-10 space-y-5">
        <div
          v-for="board in boards"
          :key="board.key"
          class="hex-panel p-5"
          :data-testid="`board-${board.key}`"
        >
          <h2 class="mb-4 flex items-center gap-2 text-lg font-bold tracking-[0.1em] text-[#c8aa6e]">
            <span class="text-[#c8aa6e]/70">❖</span>{{ board.title }}
            <span class="ml-auto text-sm font-normal tracking-normal text-slate-400">{{ board.entries.length }} 人登榜</span>
          </h2>
          <ol v-if="board.entries.length" class="space-y-1">
            <li
              v-for="(entry, index) in board.entries"
              :key="entry.puuid"
              class="flex items-center gap-3 border-b border-[#3c2f14]/40 py-2.5 last:border-0"
            >
              <!-- 名次徽记：金银铜圆形徽章 -->
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[17px] font-bold tabular-nums"
                :class="index < 3 ? MEDAL_CLASSES[index] : 'border-slate-600/50 text-slate-500'"
              >
                {{ index + 1 }}
              </span>
              <span class="min-w-0 flex-1 truncate text-lg font-semibold text-slate-100">{{ entry.riotId }}</span>
              <span class="text-sm text-slate-400">{{ entry.detail }}</span>
              <span class="gold-text w-24 text-right text-2xl font-bold tabular-nums">{{ fmtValue(entry.value) }}</span>
            </li>
          </ol>
          <p v-else class="py-2 text-[17px] font-semibold tracking-widest text-slate-400">—— 本周无人登榜 ——</p>
        </div>
      </section>

      <!-- 名场面：鎏金战功簿 -->
      <section v-if="highlights.length" class="hex-panel gold-dim mt-10 p-5" data-testid="highlights">
        <h2 class="mb-4 flex items-center gap-2 text-lg font-bold tracking-[0.15em] text-[#c8aa6e]">
          <span>⚔</span> 名场面 · 战功簿
        </h2>
        <div class="grid gap-4 md:grid-cols-2">
          <div v-for="item in highlights" :key="`${item.gameId}-${item.title}`" class="border-l-2 border-[#c8aa6e]/50 pl-3">
            <div class="gold-text text-lg font-bold tracking-wider">{{ item.title }}</div>
            <div class="mt-1 text-[17px] font-medium text-slate-200">{{ item.detail }}</div>
          </div>
        </div>
      </section>

      <!-- AI 锐评：青铜神谕 -->
      <section
        v-if="ctx.report.aiComment"
        class="mt-10 border border-[#0ac8b9]/40 bg-[#0ac8b9]/[0.05] p-5"
        data-testid="ai-comment"
      >
        <div class="flex items-center gap-2 text-[17px] font-bold tracking-[0.2em] text-[#0ac8b9]">
          <span>☾</span> 神谕 · AI 锐评
        </div>
        <p class="mt-2 text-lg leading-9 text-slate-200">{{ ctx.report.aiComment }}</p>
      </section>

      <!-- 底部符文分隔线 -->
      <div class="ornament mt-10" aria-hidden="true">
        <span class="ornament-line" /><span class="text-[#c8aa6e]/80">✦</span><span class="ornament-line" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 魔典字体：Cinzel 碑刻体（评审注入）+ 楷体中文（Windows 内置） */
.font-hex {
  font-family: Cinzel, Georgia, KaiTi, '楷体', serif;
}

/* 金色渐变文字（标题/数值的鎏金效果） */
.gold-text {
  background: linear-gradient(180deg, #f0d9a6 0%, #c8aa6e 55%, #8a6a35 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

/* 卡槽面板：双线金边框（border + outline 错位形成内外双线） */
.hex-panel {
  border: 1px solid #3c2f14;
  outline: 1px solid #3c2f14;
  outline-offset: 3px;
  background: linear-gradient(180deg, #0d1b30 0%, #0a1428 100%);
}

/* 战功簿的鎏金底色变体 */
.gold-dim {
  background: linear-gradient(180deg, #171208 0%, #12100a 100%);
  border-color: #7a5c2e;
  outline-color: #7a5c2e;
}

/* 符文圆盘：双圈金边（border + outline） */
.rune-disc {
  width: 9.5rem;
  height: 9.5rem;
  border-radius: 9999px;
  border: 1px solid rgba(200, 170, 110, 0.55);
  outline: 1px solid rgba(200, 170, 110, 0.2);
  outline-offset: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* 符文分隔线：中间符文 + 两侧渐隐线 */
.ornament {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.ornament-line {
  height: 1px;
  flex: 1;
}
.ornament-line:first-child {
  background: linear-gradient(90deg, transparent, rgba(200, 170, 110, 0.5));
}
.ornament-line:last-child {
  background: linear-gradient(90deg, rgba(200, 170, 110, 0.5), transparent);
}
</style>
