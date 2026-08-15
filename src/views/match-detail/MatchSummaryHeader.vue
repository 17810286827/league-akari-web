<script setup lang="ts">
/**
 * 顶部摘要区：英雄头像（等级角标）+ 装备 6 个 | KDA 大号 + Perfect 标签 + 参与率/CS/评分 | 队友列表 | 模式与时间
 */
import { computed } from 'vue'

import { championIconUrl } from '@/utils/icon-url'

import ItemIcon from './ItemIcon.vue'
import type { MatchSummaryView } from './adapter'

const props = defineProps<{ summary: MatchSummaryView }>()

/** 结果文案与颜色：胜利绿 / 失败红 */
const resultText = computed(() => (props.summary.result === 'victory' ? '胜利' : '失败'))
const resultClass = computed(() => (props.summary.result === 'victory' ? 'text-emerald-400' : 'text-loss'))

/** 出装 6 槽：不足补空槽 */
const itemSlots = computed(() => {
  const slots = [...props.summary.items]
  while (slots.length < 6) {
    slots.push(0)
  }
  return slots
})
</script>

<template>
  <section
    class="rounded-lg border border-hairline p-5"
    :class="summary.result === 'victory' ? 'bg-win/10' : 'bg-loss/10'"
  >
    <!-- 模式与相对时间 -->
    <div class="mb-4 flex items-center justify-between">
      <p class="text-sm text-ink-muted">
        <span class="font-semibold text-ink">{{ summary.mode }}</span> · {{ summary.timeAgo }}
      </p>
      <p class="text-sm tabular-nums text-ink-muted">
        时长 {{ summary.duration }}
        <span class="ml-3 font-bold" :class="resultClass">{{ resultText }}</span>
      </p>
    </div>

    <div class="flex flex-col gap-5 lg:flex-row lg:items-center">
      <!-- 左侧：英雄头像 + 装备 -->
      <div class="flex shrink-0 items-center gap-4">
        <img
          :src="championIconUrl(summary.championId)"
          alt="本局英雄"
          class="size-16 rounded-lg border-2 border-surface bg-surface"
        />
        <!-- 装备 6 槽 -->
        <div class="grid grid-cols-3 gap-1">
          <ItemIcon v-for="(itemId, index) in itemSlots" :key="`${itemId}-${index}`" :item-id="itemId" />
        </div>
      </div>

      <!-- 中间：KDA 大号 + Perfect + 参与率/CS/评分 -->
      <div class="flex-1 text-center lg:text-left">
        <div class="flex items-center justify-center gap-3 lg:justify-start">
          <p class="text-3xl font-extrabold tabular-nums text-ink">{{ summary.kda }}</p>
          <!-- Perfect 标签：零死亡对局 -->
          <span
            v-if="summary.isPerfect"
            class="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-400"
          >
            Perfect
          </span>
        </div>
        <div class="mt-2 flex justify-center gap-5 text-sm text-ink-muted lg:justify-start">
          <span>击杀参与率 <b class="text-ink tabular-nums">{{ summary.participation }}%</b></span>
          <span>CS <b class="text-ink tabular-nums">{{ summary.cs }}</b></span>
          <span>评分 <b class="text-ink">{{ summary.score }}</b></span>
        </div>
      </div>

      <!-- 右侧：队友列表（5 人：头像 + ID + 段位占位） -->
      <div class="shrink-0">
        <p class="mb-2 text-xs font-semibold text-ink-muted">队友</p>
        <ul class="flex gap-3">
          <li v-for="teammate in summary.teammates" :key="teammate.puuid" class="text-center">
            <img
              :src="championIconUrl(teammate.championId)"
              :alt="teammate.name"
              class="mx-auto size-9 rounded-full border border-hairline bg-surface"
              :title="teammate.name"
            />
            <p class="mt-1 max-w-14 truncate text-[11px] text-ink-muted">{{ teammate.name }}</p>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
