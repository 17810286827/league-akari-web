<script setup lang="ts">
/**
 * 综合统计卡片组：KDA / 场均击杀 / 场均死亡 / 场均助攻 / 视野得分 / 每分钟补刀 / 胜率 / 场次
 * 每个卡片：大数字 + 小标签，数据网格排列
 */
import type { PlayerSummary } from './types'

const props = defineProps<{ summary: PlayerSummary }>()

/** 统计项配置：字段键 → 展示标签（数字格式化规则各异） */
const statItems: {
  key: keyof PlayerSummary
  label: string
  /** 数字格式化函数，缺省保留一位小数 */
  format?: (value: number) => string
}[] = [
  { key: 'kda', label: 'KDA' },
  { key: 'avgKills', label: '场均击杀' },
  { key: 'avgDeaths', label: '场均死亡' },
  { key: 'avgAssists', label: '场均助攻' },
  { key: 'visionScore', label: '视野得分', format: (v) => v.toFixed(0) },
  { key: 'csPerMin', label: '补刀/分' },
  { key: 'winRate', label: '胜率', format: (v) => `${v.toFixed(1)}%` },
  { key: 'games', label: '场次', format: (v) => v.toFixed(0) }
]

/** 读取统计项数值并格式化 */
function formatValue(key: keyof PlayerSummary, format?: (v: number) => string): string {
  const value = props.summary[key]
  return format ? format(value) : value.toFixed(1)
}
</script>

<template>
  <!-- 统计卡片网格：8 个等宽卡片 -->
  <div class="grid grid-cols-4 gap-3">
    <div
      v-for="item in statItems"
      :key="item.key"
      class="rounded-lg bg-surface px-4 py-3 text-center"
    >
      <!-- 大数字：KDA 用金色强调，其余用主文本色 -->
      <p
        class="text-xl font-bold tabular-nums"
        :class="item.key === 'kda' ? 'text-gold' : 'text-ink'"
      >
        {{ formatValue(item.key, item.format) }}
      </p>
      <p class="mt-0.5 text-xs text-ink-muted">{{ item.label }}</p>
    </div>
  </div>
</template>
