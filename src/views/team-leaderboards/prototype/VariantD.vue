<!--
  【原型 · 方案 D】终端密度（榜单中心）：
  - 字体：全等宽（JetBrains Mono/Consolas）13px 高密度（与周报方案 D 同语言）；
  - 图标：ASCII/字符语言——[BRACKET] 筛选 chips、● ○ 名次、▓░ 胜率条、点线引导；
  - 布局：状态栏 → DIM/MODE/RANGE 三行括号筛选 → 主表（绝活榜按英雄分段）→
    右侧 "> INSPECT" 检视面板；CRT 扫描线。
-->
<script setup lang="ts">
import { computed } from 'vue'

import { LEADERBOARD_DIMENSIONS } from '@/api/team'
import { format2 } from '@/utils/format'

import { MODE_OPTIONS, TIME_RANGE_OPTIONS } from '../adapter'
import type { TimeRangeKey } from '../adapter'
import type { LeaderboardCtx } from './ctx'

const props = defineProps<{ ctx: LeaderboardCtx }>()

/** 时间范围选项（原型省略自定义范围） */
const rangeOptions = TIME_RANGE_OPTIONS.filter((item) => item.key !== 'custom')

/** 值展示：整数不带小数位，小数保留两位 */
function fmtValue(value: number): string {
  return Number.isInteger(value) ? String(value) : format2(value)
}

/** ASCII 胜率条：0~1 → 10 格 ▓/░ */
function trendBar(winRate: number | null): string {
  const filled = Math.max(0, Math.min(10, Math.round((winRate ?? 0) * 10)))
  return '▓'.repeat(filled) + '░'.repeat(10 - filled)
}

/** 平铺条目 */
const entries = computed(() => props.ctx.leaderboard.entries)
</script>

<template>
  <div class="scanlines min-h-screen bg-[#050a07] px-4 pb-24 font-term text-[13px] leading-relaxed text-[#7ef0a6]">
    <div class="mx-auto max-w-6xl">
      <!-- 状态栏 -->
      <header class="flex flex-wrap items-center justify-between gap-2 border-b border-[#123820] py-3">
        <div class="flex items-center gap-3">
          <span class="font-bold text-emerald-300">&gt;_ 榜单中心 // LEADERBOARD</span>
          <span class="text-[#3e7a55]">dim={{ ctx.dimension }}</span>
        </div>
        <button
          class="px-2 py-0.5 text-xs text-emerald-300 hover:bg-[#0f2a1a]"
          data-testid="home-button"
          @click="ctx.goHome"
        >
          [HOME]
        </button>
      </header>

      <!-- DIM 筛选行 -->
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[#123820] py-2 text-xs" data-testid="dimension-tabs">
        <span class="text-[#3e7a55]">DIM:</span>
        <button
          v-for="item in LEADERBOARD_DIMENSIONS"
          :key="item.key"
          class="px-1.5 py-0.5 transition-colors"
          :class="ctx.dimension === item.key ? 'bg-[#0f2a1a] font-bold text-amber-300' : 'text-[#7ef0a6] hover:bg-[#0f2a1a]'"
          :data-testid="`dim-${item.key}`"
          @click="ctx.setDimension(item.key)"
        >
          [{{ item.label }}]
        </button>
      </div>

      <!-- MODE/RANGE 筛选行 -->
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[#123820] py-2 text-xs">
        <span class="text-[#3e7a55]">MODE:</span>
        <button
          v-for="item in MODE_OPTIONS"
          :key="item.label"
          class="px-1.5 py-0.5 transition-colors"
          :class="(ctx.mode ?? '') === (item.value ?? '') ? 'bg-[#0f2a1a] font-bold text-amber-300' : 'text-[#7ef0a6] hover:bg-[#0f2a1a]'"
          data-testid="mode-select"
          @click="ctx.setMode(item.value)"
        >
          [{{ item.label }}]
        </button>
        <span class="ml-3 text-[#3e7a55]">RANGE:</span>
        <button
          v-for="item in rangeOptions"
          :key="item.key"
          class="px-1.5 py-0.5 transition-colors"
          :class="ctx.rangeKey === item.key ? 'bg-[#0f2a1a] font-bold text-amber-300' : 'text-[#7ef0a6] hover:bg-[#0f2a1a]'"
          data-testid="range-select"
          @click="ctx.setRange(item.key)"
        >
          [{{ item.label }}]
        </button>
      </div>

      <div class="mt-4 flex flex-col gap-4 lg:flex-row">
        <!-- 左：主表 -->
        <main class="min-w-0 flex-1 border border-[#123820] p-3" data-testid="leaderboard-table">
          <!-- 绝活榜：英雄分段 -->
          <template v-if="ctx.signatureGroups">
            <div v-for="group in ctx.signatureGroups" :key="group.champion" class="mb-4 last:mb-0" :data-testid="`champion-group-${group.champion}`">
              <div class="mb-1 font-bold text-amber-300">── {{ group.champion }} ({{ group.items.length }}人) ──</div>
              <button
                v-for="(entry, index) in group.items"
                :key="entry.puuid + entry.championId"
                class="flex w-full items-baseline gap-2 whitespace-nowrap py-1 text-left transition-colors hover:bg-[#0f2a1a]"
                :class="ctx.selectedEntry?.puuid === entry.puuid ? 'bg-[#0f2a1a]' : ''"
                @click="ctx.selectMember(entry)"
              >
                <span class="w-8 shrink-0 font-bold tabular-nums" :class="index < 3 ? 'text-amber-300' : 'text-[#3e7a55]'">
                  {{ index < 3 ? '●' : '○' }}{{ String(index + 1).padStart(2, '0') }}
                </span>
                <span class="min-w-0 flex-1 truncate text-emerald-100">{{ entry.riotId }}</span>
                <span class="dot-leader" aria-hidden="true" />
                <span class="shrink-0 font-bold text-emerald-300 tabular-nums">{{ fmtValue(entry.value) }}</span>
                <span class="hidden shrink-0 text-[#3e7a55] sm:inline">
                  {{ entry.games }}场/胜{{ Math.round(((entry.wins ?? 0) / (entry.games || 1)) * 100) }}%
                </span>
              </button>
            </div>
          </template>

          <!-- 其他维度：平铺主表 -->
          <template v-else>
            <div class="mb-1 text-[#3e7a55]">// {{ ctx.dimensionLabel }} RANKING</div>
            <div class="flex gap-2 border-b border-[#123820] pb-1 text-[#3e7a55]">
              <span class="w-8 shrink-0">RANK</span>
              <span class="min-w-0 flex-1">PLAYER</span>
              <span class="shrink-0">VALUE</span>
              <span class="hidden w-28 shrink-0 text-right sm:inline">DETAIL</span>
            </div>
            <button
              v-for="(entry, index) in entries"
              :key="entry.puuid"
              class="flex w-full items-baseline gap-2 whitespace-nowrap border-b border-[#0c1f12] py-1.5 text-left transition-colors last:border-0 hover:bg-[#0f2a1a]"
              :class="ctx.selectedEntry?.puuid === entry.puuid ? 'bg-[#0f2a1a]' : ''"
              @click="ctx.selectMember(entry)"
            >
              <span class="w-8 shrink-0 font-bold tabular-nums" :class="index < 3 ? 'text-amber-300' : 'text-[#3e7a55]'">
                {{ index < 3 ? '●' : '○' }}{{ String(index + 1).padStart(2, '0') }}
              </span>
              <span class="min-w-0 flex-1 truncate text-emerald-100">{{ entry.riotId }}</span>
              <span class="dot-leader" aria-hidden="true" />
              <span class="shrink-0 font-bold text-emerald-300 tabular-nums">{{ fmtValue(entry.value) }}</span>
              <span class="hidden w-28 shrink-0 text-right text-[#3e7a55] sm:inline">{{ entry.detail }}</span>
            </button>
            <p v-if="entries.length === 0" class="py-8 text-center text-[#3e7a55]">// 该筛选条件下暂无数据</p>
            <p v-else class="mt-2 text-[10px] text-[#3e7a55]">// 点击行检视成员 (click to inspect)</p>
          </template>
        </main>

        <!-- 右：检视面板 -->
        <aside class="w-full shrink-0 lg:w-80" data-testid="member-panel">
          <div class="border border-[#123820] p-3 lg:sticky lg:top-4">
            <div class="text-[#3e7a55]">&gt; INSPECT</div>
            <div v-if="!ctx.selectedEntry" class="py-8 text-[#3e7a55]">// 点击左侧任意行</div>
            <template v-else>
              <div class="mt-1 font-bold text-emerald-200">{{ ctx.memberCard?.riotId ?? ctx.selectedEntry.riotId }}</div>

              <div v-if="ctx.cardLoading" class="py-8 text-[#3e7a55]" data-testid="panel-loading">// loading…</div>
              <template v-else-if="ctx.memberCard">
                <!-- 成长曲线 -->
                <div class="mt-3 text-[#3e7a55]">// TRENDS 近 8 周</div>
                <div class="mt-1 space-y-0.5" data-testid="panel-trend">
                  <div v-for="point in ctx.memberCard.trend" :key="point.weekLabel" class="flex items-baseline gap-2 whitespace-nowrap">
                    <span class="w-11 shrink-0 text-[#3e7a55] tabular-nums">{{ point.weekLabel.slice(5) }}</span>
                    <span class="text-emerald-400">{{ trendBar(point.winRate) }}</span>
                    <span class="text-emerald-200 tabular-nums">{{ point.games }}场</span>
                    <span class="text-[#3e7a55] tabular-nums">
                      op:{{ point.avgOpScore != null ? format2(point.avgOpScore) : '--' }}
                    </span>
                  </div>
                </div>

                <!-- 英雄基线 -->
                <div class="mt-3 text-[#3e7a55]">// CHAMPIONS vs BASELINE</div>
                <table class="mt-1 w-full text-left" data-testid="panel-champions">
                  <thead class="text-[#3e7a55]">
                    <tr>
                      <th class="pb-0.5">英雄</th>
                      <th>场次</th>
                      <th>胜率</th>
                      <th>op</th>
                      <th class="text-right">dmg/基线</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="champ in ctx.memberCard.champions" :key="champ.championId" class="border-t border-[#0c1f12]">
                      <td class="py-1 text-emerald-100">{{ champ.championName }}</td>
                      <td class="tabular-nums">{{ champ.games }}</td>
                      <td class="tabular-nums">{{ Math.round((champ.wins / champ.games) * 100) }}%</td>
                      <td class="text-emerald-300 tabular-nums">{{ format2(champ.avgOpScore) }}</td>
                      <td class="text-right text-[#3e7a55] tabular-nums">
                        {{ format2(champ.avgDamagePerMin) }}/{{ format2(champ.baselineDamagePerMin) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </template>
            </template>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 终端等宽（与周报方案 D 一致） */
.font-term {
  font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace, 'Microsoft YaHei';
}

/* CRT 扫描线 */
.scanlines {
  background-image: repeating-linear-gradient(
    0deg,
    rgba(74, 222, 128, 0.05) 0px,
    rgba(74, 222, 128, 0.05) 1px,
    transparent 1px,
    transparent 4px
  );
}

/* 点线引导 */
.dot-leader {
  flex: 1 1 auto;
  min-width: 10px;
  height: 0.75em;
  border-bottom: 1px dotted #1e4d30;
}
</style>
