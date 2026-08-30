<!--
  【原型 · 方案 B】战报杂志（车队周报）：
  - 字体：全衬线（Georgia/宋体），报头超大衬线字 + 衬线数字；摘要行衬线大数字；中文回退宋体；
  - 图标：零图形图标——全部用排版符号（№ ‹ › 「」· 双细线/点线）；
  - 布局：报纸报头（双细线压顶）→ 居中摘要行 → CSS 多栏榜单（无卡片，纯排版）→
    "本周特稿"名场面 → 双线框社论式 AI 锐评；
  - 米白纸底 + 墨色文字 + 朱红点缀：五方案中唯一的浅色方案，刻意与全站深色形成对比。
-->
<script setup lang="ts">
import { computed } from 'vue'

import type { TeamBoardEntry, TeamWeeklyReport } from '@/api/team'

import { BOARD_META, formatDuration } from '../adapter'
import type { WeeklyCtx } from './ctx'

const props = defineProps<{ ctx: WeeklyCtx }>()

/** 值展示：整数不带小数位，小数保留两位 */
function fmtValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

/** ISO 日期 → "8月26日"（报纸日期写法） */
function fmtDateCn(iso: string): string {
  const [, month, day] = iso.split('-')
  return `${Number(month)}月${Number(day)}日`
}

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

/** 总览摘要（拼成一句报纸导语） */
const overview = computed(() => props.ctx.report.overview)
</script>

<template>
  <div class="min-h-screen bg-[#f6f2e9] px-6 pb-20 pt-7 font-editorial text-[#211d16]">
    <div class="mx-auto max-w-5xl">
      <!-- 报头：眉线行 + 双细线 + 居中大标题 -->
      <header class="text-center">
        <div class="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-[#8a8375]">
          <button
            class="underline-offset-4 transition-colors hover:text-[#b3402a] hover:underline"
            data-testid="home-button"
            @click="ctx.goHome"
          >
            ← 返回首页
          </button>
          <span>{{ ctx.report.teamName ?? '车队' }} · Weekly Dispatch</span>
          <button
            class="underline-offset-4 transition-colors hover:text-[#b3402a] hover:underline"
            data-testid="share-button"
            @click="ctx.share"
          >
            生成分享图 →
          </button>
        </div>

        <div class="mt-4 border-t-4 border-double border-[#211d16]" />
        <h1 class="mt-5 text-5xl font-bold tracking-[0.15em]">车队周报</h1>
        <p class="mt-2 text-sm italic text-[#6b6355]">{{ ctx.report.weekLabel }}</p>

        <!-- 周导航：文字链接式 -->
        <nav class="mt-3 flex items-center justify-center gap-8 text-sm">
          <button
            class="text-[#b3402a] underline-offset-4 hover:underline"
            data-testid="week-prev"
            @click="ctx.shiftWeek(-1)"
          >
            ‹ 上一周
          </button>
          <span class="text-[#8a8375]">§</span>
          <button
            class="text-[#b3402a] underline-offset-4 hover:underline"
            data-testid="week-next"
            @click="ctx.shiftWeek(1)"
          >
            下一周 ›
          </button>
        </nav>
        <div class="mt-4 border-t border-[#211d16]" />
      </header>

      <!-- 摘要行：衬线大数字串成一句导语 -->
      <section
        v-if="overview"
        class="border-b border-[#211d16]/50 py-5 text-center text-lg leading-9"
        data-testid="overview"
      >
        本周共 <span class="numeral">{{ overview.gameCount }}</span> 场对局，
        人次 <span class="numeral">{{ overview.winCount }}</span> 胜
        <span class="numeral">{{ overview.lossCount }}</span> 负，
        合计 <span class="numeral">{{ formatDuration(overview.totalDurationSeconds) }}</span>，
        最疯狂的一天是
        <span class="numeral">{{ overview.busiestDay ? fmtDateCn(overview.busiestDay) : '——' }}</span>
        （<span class="numeral">{{ overview.busiestDayGames }}</span> 场）
      </section>

      <!-- 榜单：报纸多栏排版（无卡片无底色，纯排版 + 点线分隔） -->
      <section class="columns-1 gap-10 py-7 md:columns-2 lg:columns-3">
        <div v-for="board in boards" :key="board.key" class="mb-8 break-inside-avoid" :data-testid="`board-${board.key}`">
          <h2 class="flex items-baseline gap-1.5 border-b border-[#211d16] pb-1.5 text-sm font-bold tracking-[0.2em]">
            <span class="text-[#b3402a]">№</span>{{ board.title }}
          </h2>
          <ol v-if="board.entries.length">
            <li
              v-for="(entry, index) in board.entries"
              :key="entry.puuid"
              class="flex items-baseline justify-between gap-3 border-b border-dotted border-[#211d16]/30 py-2"
            >
              <span class="flex items-baseline gap-2.5">
                <span class="rank-num" :class="index === 0 ? 'text-[#b3402a]' : 'text-[#8a8375]'">
                  {{ index + 1 }}.
                </span>
                <span>{{ entry.riotId }}</span>
              </span>
              <span class="shrink-0 text-right">
                <span class="font-bold tabular-nums">{{ fmtValue(entry.value) }}</span>
                <span class="ml-1 text-xs text-[#8a8375]">{{ entry.detail }}</span>
              </span>
            </li>
          </ol>
          <p v-else class="pt-2 text-xs text-[#8a8375]">本周暂无记录。</p>
        </div>
      </section>

      <!-- 名场面：本周特稿（双细线开栏） -->
      <section v-if="highlights.length" class="border-t-4 border-double border-[#211d16] py-7" data-testid="highlights">
        <h2 class="text-center text-sm font-bold tracking-[0.45em]">本 周 特 稿</h2>
        <div class="mt-5 grid gap-x-10 gap-y-6 md:grid-cols-2">
          <article v-for="item in highlights" :key="`${item.gameId}-${item.title}`">
            <h3 class="text-xl font-bold">「{{ item.title }}」</h3>
            <p class="mt-1 text-sm leading-6 text-[#4a4438]">{{ item.detail }}</p>
          </article>
        </div>
      </section>

      <!-- AI 锐评：社论框（双细线收栏，斜体，朱红栏目名） -->
      <section
        v-if="ctx.report.aiComment"
        class="border-y-4 border-double border-[#211d16] py-7 text-center"
        data-testid="ai-comment"
      >
        <div class="text-[11px] font-bold uppercase tracking-[0.4em] text-[#b3402a]">Editor's Note · AI 锐评</div>
        <p class="mx-auto mt-3 max-w-2xl text-[16px] italic leading-8">{{ ctx.report.aiComment }}</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* 报刊衬线：Georgia 英文数字 + 宋体中文（Windows 内置，纸感最强） */
.font-editorial {
  font-family: Georgia, 'Times New Roman', SimSun, '宋体', serif;
}

/* 摘要行大数字：放大约 1.5 倍的衬线数字（报纸导语签名元素） */
.numeral {
  font-size: 1.5em;
  font-weight: 700;
  padding: 0 0.1em;
  font-variant-numeric: tabular-nums;
}

/* 排名数字：大号衬线，第 1 名由朱红强调 */
.rank-num {
  font-size: 1.35rem;
  font-weight: 700;
  min-width: 1.9rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
