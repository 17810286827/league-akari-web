<!--
  【原型 · 方案 A】电竞 HUD（榜单中心）：
  - 字体：Rajdhani/Bahnschrift 压缩体数字 + 全大写宽字距标签（与周报方案 A 同语言）；
  - 图标：ionicons 线性图标嵌切角方块；维度用左侧图标竖轨承载（布局签名元素）；
  - 布局：HUD 头 → 左维度轨（移动端横向 chips）→ 前三领奖台 + 密集排行行 →
    右侧 sticky HUD 成员卡（成长曲线条 + 英雄基线小表）。
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'

import {
  CalendarOutline,
  FlashOutline,
  HomeOutline,
  PulseOutline,
  RibbonOutline,
  SkullOutline,
  StatsChartOutline,
  TrophyOutline
} from '@vicons/ionicons5'

import { LEADERBOARD_DIMENSIONS } from '@/api/team'
import type { TeamBoardEntry } from '@/api/team'
import { format2 } from '@/utils/format'

import { MODE_OPTIONS, TIME_RANGE_OPTIONS } from '../adapter'
import type { TimeRangeKey } from '../adapter'
import type { LeaderboardCtx } from './ctx'

const props = defineProps<{ ctx: LeaderboardCtx }>()

/** 维度 key → HUD 图标 + 轨道短标签 */
const DIM_ICONS: Record<string, Component> = {
  attendance: CalendarOutline,
  mvp: TrophyOutline,
  opscore: StatsChartOutline,
  criminal: SkullOutline,
  feeder: PulseOutline,
  carry: FlashOutline,
  signature: RibbonOutline
}
const DIM_SHORT: Record<string, string> = {
  attendance: '出勤',
  mvp: 'MVP',
  opscore: 'OP',
  criminal: '战犯',
  feeder: '送头',
  carry: 'Carry',
  signature: '绝活'
}

/** 时间范围选项（原型省略自定义范围） */
const rangeOptions = TIME_RANGE_OPTIONS.filter((item) => item.key !== 'custom')

/** 值展示：整数不带小数位，小数保留两位 */
function fmtValue(value: number): string {
  return Number.isInteger(value) ? String(value) : format2(value)
}

/** 前三领奖台 + 第四名起的密集排行行 */
const entries = computed(() => props.ctx.leaderboard.entries)
const podium = computed(() => entries.value.slice(0, 3))
const restRows = computed(() => entries.value.slice(3))

/** 领奖台名次配色 */
const PODIUM_COLORS = ['text-amber-300', 'text-slate-300', 'text-orange-400']

/** 成员卡胜率条形宽 */
function trendWidth(winRate: number | null): string {
  return `${((winRate ?? 0) * 100).toFixed(0)}%`
}
</script>

<template>
  <div class="min-h-screen bg-[#060a12] px-4 pb-24 pt-5 font-hud text-slate-200">
    <div class="mx-auto max-w-7xl">
      <!-- HUD 头：主页 | 标题 | 筛选 -->
      <header class="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-cyan-400/20 pb-4">
        <div class="flex items-center gap-4">
          <button
            class="clip-corner flex h-10 w-10 items-center justify-center bg-slate-800/80 text-slate-300 transition-colors hover:bg-cyan-400/20 hover:text-cyan-300"
            data-testid="home-button"
            aria-label="主页"
            @click="ctx.goHome"
          >
            <HomeOutline :width="16" :height="16" />
          </button>
          <div>
            <div class="text-[10px] font-semibold uppercase tracking-[0.45em] text-emerald-300/80">Leaderboard</div>
            <div class="text-2xl font-bold tracking-wider text-slate-100">{{ ctx.dimensionLabel }}</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <!-- 模式筛选（HUD 切角下拉） -->
          <select
            class="clip-corner bg-slate-800/80 px-3 py-2 text-xs uppercase tracking-wider text-slate-200 focus:outline-none"
            data-testid="mode-select"
            :value="ctx.mode ?? ''"
            @change="ctx.setMode(($event.target as HTMLSelectElement).value || null)"
          >
            <option v-for="item in MODE_OPTIONS" :key="item.label" :value="item.value ?? ''">{{ item.label }}</option>
          </select>
          <!-- 时间范围 -->
          <select
            class="clip-corner bg-slate-800/80 px-3 py-2 text-xs uppercase tracking-wider text-slate-200 focus:outline-none"
            data-testid="range-select"
            :value="ctx.rangeKey"
            @change="ctx.setRange(($event.target as HTMLSelectElement).value as TimeRangeKey)"
          >
            <option v-for="item in rangeOptions" :key="item.key" :value="item.key">{{ item.label }}</option>
          </select>
        </div>
      </header>

      <div class="flex gap-5">
        <!-- 左侧维度竖轨（桌面） -->
        <aside class="hidden w-16 shrink-0 flex-col gap-1.5 md:flex" data-testid="dimension-tabs">
          <button
            v-for="item in LEADERBOARD_DIMENSIONS"
            :key="item.key"
            class="clip-corner flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold tracking-widest transition-colors"
            :class="
              ctx.dimension === item.key
                ? 'bg-emerald-400/15 text-emerald-300'
                : 'bg-slate-800/60 text-slate-400 hover:text-slate-200'
            "
            :data-testid="`dim-${item.key}`"
            @click="ctx.setDimension(item.key)"
          >
            <component :is="DIM_ICONS[item.key]" :width="15" :height="15" />
            {{ DIM_SHORT[item.key] }}
          </button>
        </aside>

        <main class="min-w-0 flex-1">
          <!-- 移动端维度横排 -->
          <div class="mb-4 flex flex-wrap gap-1.5 md:hidden" data-testid="dimension-tabs-mobile">
            <button
              v-for="item in LEADERBOARD_DIMENSIONS"
              :key="item.key"
              class="clip-corner px-3 py-1.5 text-[11px] font-semibold tracking-wider"
              :class="ctx.dimension === item.key ? 'bg-emerald-400/15 text-emerald-300' : 'bg-slate-800/60 text-slate-400'"
              :data-testid="`dim-mobile-${item.key}`"
              @click="ctx.setDimension(item.key)"
            >
              {{ DIM_SHORT[item.key] }}
            </button>
          </div>

          <!-- 前三领奖台 -->
          <section v-if="!ctx.signatureGroups && podium.length" class="clip-corner mb-4 bg-emerald-400/[0.06] p-4" data-testid="leaderboard-table">
            <div class="grid grid-cols-3 gap-3">
              <div
                v-for="(entry, index) in podium"
                :key="entry.puuid"
                class="clip-corner cursor-pointer bg-[#0b1220]/80 p-3.5 text-center transition-colors hover:bg-[#0b1220]"
                :class="ctx.selectedEntry?.puuid === entry.puuid ? 'ring-1 ring-emerald-400/70' : ''"
                @click="ctx.selectMember(entry)"
              >
                <div class="text-3xl font-bold tabular-nums" :class="PODIUM_COLORS[index]">{{ index + 1 }}</div>
                <div class="mt-0.5 truncate text-sm text-slate-200">{{ entry.riotId }}</div>
                <div class="text-xl font-bold text-emerald-300 tabular-nums">{{ fmtValue(entry.value) }}</div>
                <div class="mt-0.5 text-[10px] uppercase tracking-widest text-slate-500">{{ entry.detail }}</div>
              </div>
            </div>
          </section>

          <!-- 绝活榜：按英雄分组 -->
          <template v-if="ctx.signatureGroups">
            <section v-for="group in ctx.signatureGroups" :key="group.champion" class="mb-4" :data-testid="`champion-group-${group.champion}`">
              <h2 class="mb-2 flex items-baseline gap-2 text-lg font-bold tracking-wider text-amber-300">
                {{ group.champion }}
                <span class="text-[10px] font-normal tracking-widest text-slate-500">{{ group.items.length }} 人使用</span>
              </h2>
              <button
                v-for="(entry, index) in group.items"
                :key="entry.puuid + entry.championId"
                class="mb-1.5 flex w-full items-center gap-3 bg-[#0b1220]/60 px-4 py-3 text-left transition-colors hover:bg-slate-800/70"
                :class="ctx.selectedEntry?.puuid === entry.puuid ? 'ring-1 ring-emerald-400/70' : ''"
                @click="ctx.selectMember(entry)"
              >
                <span class="w-6 text-right text-sm font-bold tabular-nums" :class="index === 0 ? 'text-amber-300' : 'text-slate-500'">
                  {{ index + 1 }}
                </span>
                <span class="min-w-0 flex-1 truncate text-sm text-slate-200">{{ entry.riotId }}</span>
                <span class="hidden text-[10px] uppercase tracking-wider text-slate-500 sm:inline">
                  {{ entry.games }}场 胜率{{ Math.round(((entry.wins ?? 0) / (entry.games || 1)) * 100) }}%
                </span>
                <span class="font-bold text-emerald-300 tabular-nums">{{ fmtValue(entry.value) }}</span>
              </button>
            </section>
          </template>

          <!-- 第四名起的密集排行 -->
          <template v-else>
            <div v-if="restRows.length" class="space-y-1.5" data-testid="leaderboard-table-rest">
              <button
                v-for="(entry, index) in restRows"
                :key="entry.puuid"
                class="flex w-full items-center gap-3 bg-[#0b1220]/60 px-4 py-2.5 text-left transition-colors hover:bg-slate-800/70"
                :class="ctx.selectedEntry?.puuid === entry.puuid ? 'ring-1 ring-emerald-400/70' : ''"
                @click="ctx.selectMember(entry)"
              >
                <span class="w-7 text-right text-sm font-bold tabular-nums text-slate-500">{{ index + 4 }}</span>
                <span class="min-w-0 flex-1 truncate text-sm text-slate-200">{{ entry.riotId }}</span>
                <span class="hidden text-[10px] uppercase tracking-wider text-slate-500 sm:inline">{{ entry.detail }}</span>
                <span class="font-bold text-emerald-300 tabular-nums">{{ fmtValue(entry.value) }}</span>
              </button>
            </div>
            <p v-if="entries.length === 0" class="py-10 text-center text-xs uppercase tracking-widest text-slate-500">
              -- 暂无数据 --
            </p>
          </template>
          <p v-if="entries.length > 0" class="mt-3 text-[10px] uppercase tracking-widest text-slate-500">
            点击条目查看成员卡 / Click to inspect
          </p>
        </main>

        <!-- 成员卡（HUD 面板） -->
        <aside class="w-full shrink-0 lg:w-80" data-testid="member-panel">
          <div class="clip-corner bg-[#0b1220]/60 p-4 lg:sticky lg:top-4">
            <div v-if="!ctx.selectedEntry" class="py-10 text-center text-xs uppercase tracking-widest text-slate-500">
              点击左侧任意成员
            </div>
            <template v-else>
              <div class="flex items-center justify-between gap-2 border-b border-slate-700/50 pb-3">
                <h2 class="min-w-0 truncate text-lg font-bold text-slate-100">
                  {{ ctx.memberCard?.riotId ?? ctx.selectedEntry.riotId }}
                </h2>
                <span class="shrink-0 text-[9px] font-semibold uppercase tracking-[0.3em] text-cyan-300/80">Inspect</span>
              </div>

              <div v-if="ctx.cardLoading" class="py-10 text-center text-xs uppercase tracking-widest text-slate-500" data-testid="panel-loading">
                Loading…
              </div>
              <template v-else-if="ctx.memberCard">
                <!-- 成长曲线 -->
                <h3 class="mb-2 mt-4 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">成长曲线 / 近 8 周</h3>
                <div class="space-y-1.5" data-testid="panel-trend">
                  <div v-for="point in ctx.memberCard.trend" :key="point.weekLabel" class="flex items-center gap-2 text-[11px]">
                    <span class="w-11 shrink-0 text-slate-500 tabular-nums">{{ point.weekLabel.slice(5) }}</span>
                    <div class="h-1.5 flex-1 bg-slate-700/50">
                      <div class="h-full bg-gradient-to-r from-cyan-400 to-emerald-400" :style="{ width: trendWidth(point.winRate) }" />
                    </div>
                    <span class="w-20 shrink-0 text-right text-slate-400 tabular-nums">
                      {{ point.games }}场 {{ point.avgOpScore != null ? format2(point.avgOpScore) : '—' }}
                    </span>
                  </div>
                </div>

                <!-- 英雄基线 -->
                <h3 class="mb-2 mt-5 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400">英雄基线</h3>
                <table class="w-full text-left text-[11px] text-slate-300" data-testid="panel-champions">
                  <thead class="text-[9px] uppercase tracking-wider text-slate-500">
                    <tr>
                      <th class="pb-1">英雄</th>
                      <th>场次</th>
                      <th>胜率</th>
                      <th>op</th>
                      <th class="text-right">伤害/基线</th>
                    </tr>
                  </thead>
                  <tbody class="tabular-nums">
                    <tr v-for="champ in ctx.memberCard.champions" :key="champ.championId" class="border-t border-slate-700/40">
                      <td class="py-1.5">{{ champ.championName }}</td>
                      <td>{{ champ.games }}</td>
                      <td>{{ Math.round((champ.wins / champ.games) * 100) }}%</td>
                      <td class="text-emerald-300">{{ format2(champ.avgOpScore) }}</td>
                      <td class="text-right text-slate-400">
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
/* HUD 数字/英文：Rajdhani → Bahnschrift → 系统兜底（与周报方案 A 一致） */
.font-hud {
  font-family: Rajdhani, Bahnschrift, 'Segoe UI', 'Microsoft YaHei', sans-serif;
}

/* 切角模块 */
.clip-corner {
  clip-path: polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px);
}
</style>
