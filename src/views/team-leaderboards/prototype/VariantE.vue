<!--
  【原型 · 方案 E】轻卡圆角（榜单中心）：
  - 字体：Nunito 圆体数字 + 系统黑体中文（与周报方案 E 同语言）；
  - 图标：material 圆润实心图标 + 彩色圆角 chip 底座（维度胶囊内嵌图标）；
  - 布局：悬浮白胶囊头 → 横滚维度胶囊 + 圆角下拉 → 白卡排行列表（圆形名次徽章）→
    右侧白卡成员卡（圆头进度条 + 软表格）；浅灰底 SaaS 气质。
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'

import {
  BoltFilled,
  EmojiEventsFilled,
  EventAvailableFilled,
  HomeFilled,
  InsightsFilled,
  PersonOffFilled,
  StarFilled,
  ThumbDownFilled
} from '@vicons/material'

import { LEADERBOARD_DIMENSIONS } from '@/api/team'

import { MODE_OPTIONS, TIME_RANGE_OPTIONS } from '../adapter'
import type { TimeRangeKey } from '../adapter'
import type { LeaderboardCtx } from './ctx'

const props = defineProps<{ ctx: LeaderboardCtx }>()

/** 维度 key → 圆润 material 图标（与周报方案 E 一致） */
const DIM_ICONS: Record<string, Component> = {
  attendance: EventAvailableFilled,
  mvp: EmojiEventsFilled,
  opscore: InsightsFilled,
  criminal: ThumbDownFilled,
  feeder: PersonOffFilled,
  carry: BoltFilled,
  signature: StarFilled
}

/** 时间范围选项（原型省略自定义范围） */
const rangeOptions = TIME_RANGE_OPTIONS.filter((item) => item.key !== 'custom')

/** 值展示：整数不带小数位，小数保留两位 */
function fmtValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

/** 名次徽章配色：金/银/铜圆底，其余浅灰（与周报方案 E 一致） */
const RANK_BADGES = [
  'bg-amber-100 text-amber-600',
  'bg-slate-200 text-slate-600',
  'bg-orange-100 text-orange-600'
]

/** 平铺条目 */
const entries = computed(() => props.ctx.leaderboard.entries)
</script>

<template>
  <div class="min-h-screen bg-[#f4f5f7] pb-24 font-round text-slate-800">
    <!-- 悬浮白胶囊头 -->
    <header class="sticky top-3 z-10 mx-auto max-w-6xl px-4">
      <div class="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
        <button
          class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200"
          data-testid="home-button"
          aria-label="主页"
          @click="ctx.goHome"
        >
          <HomeFilled :width="18" :height="18" />
        </button>
        <div class="text-center">
          <div class="text-[16px] font-extrabold">榜单中心</div>
          <div class="text-[11px] text-slate-400">{{ ctx.dimensionLabel }}</div>
        </div>
        <span class="w-9" aria-hidden="true" />
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-4 pt-5">
      <!-- 维度胶囊（横滚） -->
      <div class="mb-3 flex gap-1.5 overflow-x-auto rounded-2xl bg-white p-2 shadow-sm" data-testid="dimension-tabs">
        <button
          v-for="item in LEADERBOARD_DIMENSIONS"
          :key="item.key"
          class="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-colors"
          :class="ctx.dimension === item.key ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'"
          :data-testid="`dim-${item.key}`"
          @click="ctx.setDimension(item.key)"
        >
          <component :is="DIM_ICONS[item.key]" :width="13" :height="13" />
          {{ item.label }}
        </button>
      </div>

      <!-- 模式/时间：圆角下拉 -->
      <div class="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <select
          class="rounded-full bg-white px-3.5 py-2 font-bold text-slate-600 shadow-sm focus:outline-none"
          data-testid="mode-select"
          :value="ctx.mode ?? ''"
          @change="ctx.setMode(($event.target as HTMLSelectElement).value || null)"
        >
          <option v-for="item in MODE_OPTIONS" :key="item.label" :value="item.value ?? ''">{{ item.label }}</option>
        </select>
        <select
          class="rounded-full bg-white px-3.5 py-2 font-bold text-slate-600 shadow-sm focus:outline-none"
          data-testid="range-select"
          :value="ctx.rangeKey"
          @change="ctx.setRange(($event.target as HTMLSelectElement).value as TimeRangeKey)"
        >
          <option v-for="item in rangeOptions" :key="item.key" :value="item.key">{{ item.label }}</option>
        </select>
      </div>

      <div class="flex flex-col gap-4 lg:flex-row">
        <!-- 左：排行列表 -->
        <main class="min-w-0 flex-1 rounded-2xl bg-white p-3 shadow-sm" data-testid="leaderboard-table">
          <!-- 绝活榜：英雄分节 -->
          <template v-if="ctx.signatureGroups">
            <section v-for="group in ctx.signatureGroups" :key="group.champion" class="mb-4 last:mb-0" :data-testid="`champion-group-${group.champion}`">
              <h2 class="flex items-center gap-2 px-2 py-1.5">
                <span class="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-600">{{ group.champion }}</span>
                <span class="text-[11px] text-slate-400">{{ group.items.length }} 人使用</span>
              </h2>
              <button
                v-for="(entry, index) in group.items"
                :key="entry.puuid + entry.championId"
                class="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-slate-50"
                :class="ctx.selectedEntry?.puuid === entry.puuid ? 'bg-indigo-50' : ''"
                @click="ctx.selectMember(entry)"
              >
                <span
                  class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold tabular-nums"
                  :class="index < 3 ? RANK_BADGES[index] : 'bg-slate-100 text-slate-400'"
                >
                  {{ index + 1 }}
                </span>
                <span class="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{{ entry.riotId }}</span>
                <span class="hidden shrink-0 text-[11px] text-slate-400 sm:inline">
                  {{ entry.games }}场 胜率{{ Math.round(((entry.wins ?? 0) / (entry.games || 1)) * 100) }}%
                </span>
                <span class="inline-block shrink-0 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-600 tabular-nums">
                  {{ fmtValue(entry.value) }}
                </span>
              </button>
            </section>
          </template>

          <!-- 其他维度：平铺列表 -->
          <template v-else>
            <button
              v-for="(entry, index) in entries"
              :key="entry.puuid"
              class="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-slate-50"
              :class="ctx.selectedEntry?.puuid === entry.puuid ? 'bg-indigo-50' : ''"
              @click="ctx.selectMember(entry)"
            >
              <span
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold tabular-nums"
                :class="index < 3 ? RANK_BADGES[index] : 'bg-slate-100 text-slate-400'"
              >
                {{ index + 1 }}
              </span>
              <span class="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{{ entry.riotId }}</span>
              <span class="hidden shrink-0 text-[11px] text-slate-400 sm:inline">{{ entry.detail }}</span>
              <span class="inline-block shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600 tabular-nums">
                {{ fmtValue(entry.value) }}
              </span>
            </button>
            <p v-if="entries.length === 0" class="py-10 text-center text-sm text-slate-400">该筛选条件下暂无数据</p>
            <p v-else class="px-2.5 pb-1 pt-2 text-[11px] text-slate-400">点击行查看成员卡 →</p>
          </template>
        </main>

        <!-- 右：成员卡 -->
        <aside class="w-full shrink-0 lg:w-80" data-testid="member-panel">
          <div class="rounded-2xl bg-white p-5 shadow-sm lg:sticky lg:top-28">
            <div v-if="!ctx.selectedEntry" class="py-10 text-center text-sm text-slate-400">点击左侧任意成员查看个人数据</div>
            <template v-else>
              <div class="flex items-center gap-3">
                <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-lg font-extrabold text-indigo-600">
                  {{ (ctx.memberCard?.riotId ?? ctx.selectedEntry.riotId)[0] }}
                </span>
                <div class="min-w-0">
                  <h2 class="truncate text-lg font-extrabold text-slate-800">
                    {{ ctx.memberCard?.riotId ?? ctx.selectedEntry.riotId }}
                  </h2>
                  <div class="text-[11px] text-slate-400">成员卡</div>
                </div>
              </div>

              <div v-if="ctx.cardLoading" class="py-10 text-center text-sm text-slate-400" data-testid="panel-loading">
                加载中…
              </div>
              <template v-else-if="ctx.memberCard">
                <!-- 成长曲线：圆头进度条 -->
                <h3 class="mb-2 mt-5 text-sm font-bold text-slate-600">📈 成长曲线 · 近 8 周</h3>
                <div class="space-y-2" data-testid="panel-trend">
                  <div v-for="point in ctx.memberCard.trend" :key="point.weekLabel" class="flex items-center gap-2 text-xs">
                    <span class="w-11 shrink-0 text-slate-400 tabular-nums">{{ point.weekLabel.slice(5) }}</span>
                    <div class="h-2 flex-1 rounded-full bg-slate-100">
                      <div
                        class="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-400"
                        :style="{ width: `${((point.winRate ?? 0) * 100).toFixed(0)}%` }"
                      />
                    </div>
                    <span class="w-20 shrink-0 text-right text-slate-500 tabular-nums">
                      {{ point.games }}场
                      {{ point.avgOpScore != null ? point.avgOpScore.toFixed(2) : '—' }}
                    </span>
                  </div>
                </div>

                <!-- 英雄基线：软表格 -->
                <h3 class="mb-2 mt-5 text-sm font-bold text-slate-600">🎯 英雄基线 · 全时段</h3>
                <table class="w-full text-left text-xs text-slate-600" data-testid="panel-champions">
                  <thead class="text-[10px] text-slate-400">
                    <tr>
                      <th class="pb-1">英雄</th>
                      <th>场次</th>
                      <th>胜率</th>
                      <th>op</th>
                      <th class="text-right">伤害/基线</th>
                    </tr>
                  </thead>
                  <tbody class="tabular-nums">
                    <tr v-for="champ in ctx.memberCard.champions" :key="champ.championId" class="border-t border-slate-100">
                      <td class="py-1.5 font-bold text-slate-700">{{ champ.championName }}</td>
                      <td>{{ champ.games }}</td>
                      <td>{{ Math.round((champ.wins / champ.games) * 100) }}%</td>
                      <td class="font-bold text-indigo-500">{{ champ.avgOpScore?.toFixed(2) ?? '—' }}</td>
                      <td class="text-right text-slate-400">
                        {{ champ.avgDamagePerMin?.toFixed(2) ?? '—' }}/{{ champ.baselineDamagePerMin?.toFixed(2) ?? '—' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </template>
            </template>
          </div>
        </aside>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* 圆体数值（与周报方案 E 一致） */
.font-round {
  font-family: Nunito, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
</style>
