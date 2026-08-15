<script setup lang="ts">
/**
 * 段位卡片：当前赛季段位图标 + 段位名称 + LP 分数 + 胜负进度条
 */
import { computed } from 'vue'

import type { RankInfo } from './types'

const props = defineProps<{ rank: RankInfo }>()

/** 胜率百分比（保留一位小数） */
const winRateText = computed(() => `${props.rank.winRate.toFixed(1)}%`)

/** 胜场占比（进度条蓝色段宽度，0-100%） */
const winBarPercent = computed(() => {
  const total = props.rank.wins + props.rank.losses
  return total === 0 ? 0 : (props.rank.wins / total) * 100
})
</script>

<template>
  <section class="rounded-lg bg-surface p-5">
    <!-- 段位名称与 LP -->
    <div class="flex items-center gap-4">
      <!-- 段位图标：Challenger 皇冠风格 SVG 占位 -->
      <div class="flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-gold/40 to-surface">
        <svg viewBox="0 0 24 24" class="size-8 fill-gold" aria-hidden="true">
          <path
            d="M12 2 15 8l6 .5-4.5 4L18 19l-6-3.5L6 19l1.5-6.5L3 8.5 9 8z"
          />
        </svg>
      </div>
      <div>
        <h3 class="text-lg font-bold text-ink">{{ rank.tier }}{{ rank.division ? ' ' + rank.division : '' }}</h3>
        <p class="text-sm text-ink-muted tabular-nums">{{ rank.lp }} LP</p>
      </div>
    </div>

    <!-- 胜负统计 -->
    <div class="mt-4">
      <p class="mb-1.5 text-xs text-ink-muted tabular-nums">
        {{ rank.wins }}W / {{ rank.losses }}L
        <span class="ml-2 text-gold">{{ winRateText }}</span>
      </p>
      <!-- 胜率进度条：蓝色胜场段 + 红色负场段 -->
      <div class="flex h-2 overflow-hidden rounded-full bg-surface-hover">
        <div class="h-full bg-win" :style="{ width: `${winBarPercent}%` }" />
        <div class="h-full bg-loss" :style="{ width: `${100 - winBarPercent}%` }" />
      </div>
    </div>
  </section>
</template>
