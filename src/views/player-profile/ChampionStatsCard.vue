<script setup lang="ts">
/**
 * 英雄胜率卡片：英雄头像 + 场次 + KDA + 胜率圆环图（SVG 实现）
 */
import { computed } from 'vue'

import { championIconUrl } from './mockData'
import type { ChampionStat } from './types'

const props = defineProps<{ champions: ChampionStat[] }>()

/** 圆环周长（半径 16 的圆），用于计算胜率弧长 */
const CIRCUMFERENCE = 2 * Math.PI * 16

/** 计算胜率弧长偏移量（stroke-dashoffset） */
function dashOffset(winRate: number): number {
  return CIRCUMFERENCE * (1 - winRate / 100)
}

/** 胜率文字颜色：按胜率高低取色（>=55 金，>=50 蓝，否则红） */
function winRateColor(winRate: number): string {
  if (winRate >= 55) return 'text-gold'
  if (winRate >= 50) return 'text-win'
  return 'text-loss'
}

/** 胜率数字（保留一位小数） */
const winRateText = (winRate: number) => winRate.toFixed(1)

// 用于模板的辅助引用（computed 包装避免模板内联函数调用开销）
const list = computed(() => props.champions)
</script>

<template>
  <section class="rounded-lg bg-surface">
    <h3 class="border-b border-hairline px-5 py-3 text-sm font-semibold text-ink">英雄胜率</h3>
    <ul>
      <li
        v-for="champion in list"
        :key="champion.championId"
        class="flex items-center gap-3 border-t border-hairline px-5 py-3 transition-colors first:border-t-0 hover:bg-surface-hover"
      >
        <!-- 英雄头像 -->
        <img
          :src="championIconUrl(champion.championId)"
          :alt="champion.championName"
          class="size-10 shrink-0 rounded-full border border-hairline bg-surface"
        />
        <!-- 英雄名与场次 -->
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold text-ink">{{ champion.championName }}</p>
          <p class="text-xs text-ink-muted tabular-nums">
            {{ champion.games }}场 · {{ champion.wins }}胜 {{ champion.losses }}负
          </p>
        </div>
        <!-- KDA -->
        <div class="shrink-0 text-right">
          <p class="text-sm font-semibold text-ink tabular-nums">{{ champion.kda }} KDA</p>
          <p class="text-xs text-ink-muted tabular-nums">
            {{ champion.kills }}/{{ champion.deaths }}/{{ champion.assists }}
          </p>
        </div>
        <!-- 胜率圆环：SVG 背景环 + 前景弧 -->
        <div class="relative size-11 shrink-0">
          <svg viewBox="0 0 40 40" class="size-11 -rotate-90">
            <circle cx="20" cy="20" r="16" fill="none" stroke="var(--color-surface-hover)" stroke-width="4" />
            <circle
              cx="20"
              cy="20"
              r="16"
              fill="none"
              :stroke="champion.winRate >= 50 ? 'var(--color-win)' : 'var(--color-loss)'"
              stroke-width="4"
              stroke-linecap="round"
              :stroke-dasharray="CIRCUMFERENCE"
              :stroke-dashoffset="dashOffset(champion.winRate)"
            />
          </svg>
          <span class="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums" :class="winRateColor(champion.winRate)">
            {{ winRateText(champion.winRate) }}
          </span>
        </div>
      </li>
    </ul>
  </section>
</template>
