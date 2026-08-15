<script setup lang="ts">
/**
 * 队伍数据表：玩家/KDA/伤害/守卫/CS/装备 固定列宽表格
 * - KDA 用颜色区分表现（高 KDA 绿色），伤害用进度条可视化（队内占比）
 * - 表头点击按 KDA/伤害/CS 排序（循环切换升降序）
 * - 点击玩家行展开详细统计（视野/治疗/控制/伤害细分等，来自 statsJson）
 * - 蓝队浅蓝背景、红队浅红背景，当前玩家行高亮
 */
import { computed, ref } from 'vue'

import { championIconUrl } from '@/utils/icon-url'

import ItemIcon from './ItemIcon.vue'
import type { PlayerRow, TeamView } from './adapter'

const props = defineProps<{ team: TeamView }>()

/** 排序字段 */
type SortKey = 'kdaRatio' | 'damage' | 'cs'
/** 排序方向 */
type SortOrder = 'asc' | 'desc'

// 当前排序字段与方向（默认按伤害降序）
const sortKey = ref<SortKey>('damage')
const sortOrder = ref<SortOrder>('desc')
/** 展开详情的玩家 puuid（点击行切换） */
const expandedPuuid = ref<string | null>(null)

/** 排序后的玩家列表 */
const sortedPlayers = computed(() => {
  const players = [...props.team.players]
  players.sort((a, b) => {
    const diff = a[sortKey.value] - b[sortKey.value]
    return sortOrder.value === 'desc' ? -diff : diff
  })
  return players
})

/** 表头列配置：字段键 → 展示名（点击循环切换排序） */
const columns: { key: SortKey; label: string }[] = [
  { key: 'kdaRatio', label: 'KDA' },
  { key: 'damage', label: '伤害' },
  { key: 'cs', label: 'CS' }
]

/** 点击表头：同字段切换方向，不同字段重置为降序 */
function toggleSort(key: SortKey): void {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortKey.value = key
    sortOrder.value = 'desc'
  }
}

/** KDA 表现颜色：>= 4 绿（高胜率表现），>= 2 白，否则红 */
function kdaColor(kdaRatio: number): string {
  if (kdaRatio >= 4) return 'text-emerald-400'
  if (kdaRatio >= 2) return 'text-ink'
  return 'text-loss'
}

/** 伤害进度条宽度：队内最大伤害为 100% 基准 */
function damagePercent(player: PlayerRow): number {
  const maxDamage = Math.max(...props.team.players.map((p) => p.damage), 1)
  return Math.min(100, Math.round((player.damage / maxDamage) * 100))
}

/** 切换行展开状态 */
function toggleExpand(puuid: string): void {
  expandedPuuid.value = expandedPuuid.value === puuid ? null : puuid
}
</script>

<template>
  <section
    class="overflow-hidden rounded-lg border border-hairline"
    :class="team.teamId === 100 ? 'bg-win/5' : 'bg-loss/5'"
  >
    <!-- 队首：蓝/红标识 + 胜负 -->
    <div class="flex items-center justify-between border-b border-hairline px-4 py-2.5">
      <p class="text-sm font-bold" :class="team.win ? 'text-win' : 'text-loss'">
        {{ team.teamId === 100 ? '蓝队' : '红队' }} {{ team.win ? '胜利' : '失败' }}
      </p>
      <p class="text-xs text-ink-muted tabular-nums">总击杀 {{ team.totalKills }} · 总金币 {{ team.totalGold.toLocaleString() }}</p>
    </div>

    <!-- 表头：固定列宽，可点击排序 -->
    <div class="grid grid-cols-[1.2fr_0.9fr_1fr_0.7fr_0.6fr_1.4fr] items-center gap-2 border-b border-hairline px-4 py-2 text-xs font-semibold text-ink-muted">
      <span>玩家</span>
      <button type="button" class="text-left tabular-nums hover:text-ink" @click="toggleSort('kdaRatio')">
        KDA {{ sortKey === 'kdaRatio' ? (sortOrder === 'desc' ? '↓' : '↑') : '' }}
      </button>
      <button type="button" class="text-left tabular-nums hover:text-ink" @click="toggleSort('damage')">
        伤害 {{ sortKey === 'damage' ? (sortOrder === 'desc' ? '↓' : '↑') : '' }}
      </button>
      <span class="tabular-nums">守卫</span>
      <button type="button" class="text-left tabular-nums hover:text-ink" @click="toggleSort('cs')">
        CS {{ sortKey === 'cs' ? (sortOrder === 'desc' ? '↓' : '↑') : '' }}
      </button>
      <span>装备</span>
    </div>

    <!-- 玩家行 -->
    <div
      v-for="player in sortedPlayers"
      :key="player.puuid"
      class="cursor-pointer border-b border-hairline transition-colors last:border-b-0"
      :class="[
        player.isSelf ? 'bg-surface-hover' : 'hover:bg-surface-hover/60',
        expandedPuuid === player.puuid ? 'bg-surface-hover' : ''
      ]"
      @click="toggleExpand(player.puuid)"
    >
      <div class="grid grid-cols-[1.2fr_0.9fr_1fr_0.7fr_0.6fr_1.4fr] items-center gap-2 px-4 py-2">
        <!-- 玩家：头像 + 名字 + MVP 标记 -->
        <div class="flex min-w-0 items-center gap-2">
          <img
            :src="championIconUrl(player.championId)"
            :alt="player.name"
            class="size-8 shrink-0 rounded-full border border-hairline bg-surface"
          />
          <div class="min-w-0">
            <p class="truncate text-sm font-semibold text-ink">
              {{ player.name }}
              <span v-if="player.isMVP" class="ml-1 rounded bg-gold/20 px-1 text-[10px] font-bold text-gold">MVP</span>
            </p>
            <p v-if="player.isSelf" class="text-[10px] text-win">我</p>
          </div>
        </div>
        <!-- KDA：数值 + 颜色区分表现 -->
        <div class="tabular-nums">
          <p class="text-sm font-bold" :class="kdaColor(player.kdaRatio)">
            {{ player.kills }}/{{ player.deaths }}/{{ player.assists }}
          </p>
          <p class="text-[10px] text-ink-muted">{{ player.kdaRatio }} KDA</p>
        </div>
        <!-- 伤害：进度条可视化 -->
        <div class="pr-3">
          <div class="h-1.5 overflow-hidden rounded-full bg-surface-hover">
            <div
              class="h-full rounded-full"
              :class="team.teamId === 100 ? 'bg-win' : 'bg-loss'"
              :style="{ width: `${damagePercent(player)}%` }"
            />
          </div>
          <p class="mt-1 text-xs tabular-nums text-ink">{{ player.damage.toLocaleString() }}</p>
        </div>
        <!-- 守卫（插眼） -->
        <p class="text-sm tabular-nums text-ink">{{ player.ward }}</p>
        <!-- CS -->
        <div class="tabular-nums">
          <p class="text-sm text-ink">{{ player.cs }}</p>
          <p class="text-[10px] text-ink-muted">{{ player.csPerMin }}/分</p>
        </div>
        <!-- 装备 6 格 -->
        <div class="flex gap-0.5">
          <ItemIcon v-for="(itemId, index) in player.items" :key="`${itemId}-${index}`" :item-id="itemId" />
        </div>
      </div>

      <!-- 展开详情：statsJson 的扩展统计 -->
      <div v-if="expandedPuuid === player.puuid" class="border-t border-hairline bg-base/40 px-4 py-3">
        <div class="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-ink-muted sm:grid-cols-4">
          <span>视野得分 <b class="text-ink tabular-nums">{{ player.visionScore }}</b></span>
          <span>插眼 <b class="text-ink tabular-nums">{{ player.stats.wardsPlaced ?? 0 }}</b></span>
          <span>排眼 <b class="text-ink tabular-nums">{{ player.stats.wardsKilled ?? 0 }}</b></span>
          <span>治疗量 <b class="text-ink tabular-nums">{{ Number(player.stats.totalHeal ?? 0).toLocaleString() }}</b></span>
          <span>承伤 <b class="text-ink tabular-nums">{{ Number(player.stats.totalDamageTaken ?? 0).toLocaleString() }}</b></span>
          <span>控制时长 <b class="text-ink tabular-nums">{{ player.stats.timeCCingOthers ?? 0 }}s</b></span>
          <span>金币 <b class="text-ink tabular-nums">{{ player.gold.toLocaleString() }}</b></span>
          <span>英雄等级 <b class="text-ink tabular-nums">{{ player.stats.champLevel ?? '-' }}</b></span>
        </div>
      </div>
    </div>
  </section>
</template>
