<script setup lang="ts">
/**
 * 赛季历史表格：展示过去几个赛季的段位记录（紧凑型）
 */
import type { SeasonRecord } from './types'

defineProps<{ records: SeasonRecord[] }>()
</script>

<template>
  <section class="rounded-lg bg-surface">
    <h3 class="border-b border-hairline px-5 py-3 text-sm font-semibold text-ink">历史段位</h3>
    <table class="w-full text-sm">
      <thead>
        <!-- 表头：赛季 / 段位 / LP -->
        <tr class="text-xs text-ink-muted">
          <th class="px-5 py-2 text-left font-medium">赛季</th>
          <th class="px-2 py-2 text-left font-medium">段位</th>
          <th class="px-5 py-2 text-right font-medium tabular-nums">LP</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="record in records"
          :key="record.season"
          class="border-t border-hairline transition-colors hover:bg-surface-hover"
        >
          <td class="px-5 py-2.5 text-ink-muted">{{ record.season }}</td>
          <td class="px-2 py-2.5 font-semibold text-ink">
            {{ record.tier }}{{ record.division ? ' ' + record.division : '' }}
          </td>
          <td class="px-5 py-2.5 text-right tabular-nums text-ink">{{ record.lp }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
