<!--
  【原型 · 方案 C】海克斯魔典（榜单中心）：
  - 字体：Cinzel 碑刻体 + 楷体中文，金色渐变标题（与周报方案 C 同语言）；
  - 图标：Unicode 符文（❖ ⚔ ✦ ◈）+ 金银铜名次徽记 + 双线金边面板；
  - 布局：居中符文维度按钮环 → 卡槽式排行面板（绝活榜按英雄分卷）→
    右侧"符文页"成员卡；深蓝底 + LoL 海克斯金。
-->
<script setup lang="ts">
import { computed } from 'vue'

import { LEADERBOARD_DIMENSIONS } from '@/api/team'

import { MODE_OPTIONS, TIME_RANGE_OPTIONS } from '../adapter'
import type { TimeRangeKey } from '../adapter'
import type { LeaderboardCtx } from './ctx'

const props = defineProps<{ ctx: LeaderboardCtx }>()

/** 时间范围选项（原型省略自定义范围） */
const rangeOptions = TIME_RANGE_OPTIONS.filter((item) => item.key !== 'custom')

/** 值展示：整数不带小数位，小数保留两位 */
function fmtValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

/** 金银铜名次徽记（与周报方案 C 一致） */
const MEDAL_CLASSES = [
  'border-[#f0d9a6]/80 text-[#f0d9a6]',
  'border-[#cfd8e3]/60 text-[#cfd8e3]',
  'border-[#cd8f52]/70 text-[#cd8f52]'
]

/** 平铺条目 */
const entries = computed(() => props.ctx.leaderboard.entries)
</script>

<template>
  <div class="min-h-screen bg-[#081120] px-6 pb-24 pt-8 font-hex">
    <div class="mx-auto max-w-5xl">
      <!-- 顶部符文线 -->
      <div class="ornament" aria-hidden="true">
        <span class="ornament-line" /><span class="text-[#c8aa6e]/80">✦</span><span class="ornament-line" />
      </div>

      <!-- 标题区 -->
      <header class="mt-6 text-center">
        <div class="text-[17px] font-semibold text-[#c8aa6e]/90">
          <button class="hover:text-[#f0d9a6]" data-testid="home-button" @click="ctx.goHome">❖ 主页</button>
        </div>
        <div class="mt-3 text-sm font-semibold uppercase tracking-[0.35em] text-[#0ac8b9]">Hall of Legends</div>
        <h1 class="gold-text mt-2 text-6xl font-black tracking-[0.12em]">榜单中心</h1>

        <!-- 维度：符文按钮环 -->
        <nav class="mt-6 flex flex-wrap justify-center gap-2" data-testid="dimension-tabs">
          <button
            v-for="item in LEADERBOARD_DIMENSIONS"
            :key="item.key"
            class="rounded-full border px-5 py-2.5 text-lg font-semibold tracking-wide transition-colors"
            :class="
              ctx.dimension === item.key
                ? 'border-[#c8aa6e] bg-[#c8aa6e]/15 text-[#f0d9a6]'
                : 'border-[#3c2f14] text-[#c8aa6e]/80 hover:text-[#f0d9a6]'
            "
            :data-testid="`dim-${item.key}`"
            @click="ctx.setDimension(item.key)"
          >
            ❖ {{ item.label }}
          </button>
        </nav>

        <!-- 模式/时间：金边下拉 -->
        <div class="mt-4 flex flex-wrap justify-center gap-3">
          <select
            class="border border-[#3c2f14] bg-[#0d1b30] px-4 py-2 text-[17px] font-semibold tracking-wider text-[#c8aa6e] focus:outline-none"
            data-testid="mode-select"
            :value="ctx.mode ?? ''"
            @change="ctx.setMode(($event.target as HTMLSelectElement).value || null)"
          >
            <option v-for="item in MODE_OPTIONS" :key="item.label" :value="item.value ?? ''">{{ item.label }}</option>
          </select>
          <select
            class="border border-[#3c2f14] bg-[#0d1b30] px-4 py-2 text-[17px] font-semibold tracking-wider text-[#c8aa6e] focus:outline-none"
            data-testid="range-select"
            :value="ctx.rangeKey"
            @change="ctx.setRange(($event.target as HTMLSelectElement).value as TimeRangeKey)"
          >
            <option v-for="item in rangeOptions" :key="item.key" :value="item.key">{{ item.label }}</option>
          </select>
        </div>
      </header>

      <div class="ornament mt-8" aria-hidden="true">
        <span class="ornament-line" /><span class="text-[#c8aa6e]/80">✦</span><span class="ornament-line" />
      </div>

      <div class="mt-8 flex flex-col gap-6 lg:flex-row">
        <!-- 左：排行 -->
        <main class="min-w-0 flex-1">
          <!-- 绝活榜：按英雄分卷 -->
          <template v-if="ctx.signatureGroups">
            <section
              v-for="group in ctx.signatureGroups"
              :key="group.champion"
              class="hex-panel mb-5 p-5"
              :data-testid="`champion-group-${group.champion}`"
            >
              <h2 class="mb-4 flex items-center gap-2 text-lg font-bold tracking-[0.1em] text-[#c8aa6e]">
                <span>⚔</span>{{ group.champion }}
                <span class="ml-auto text-sm font-normal tracking-normal text-slate-400">{{ group.items.length }} 人使用</span>
              </h2>
              <button
                v-for="(entry, index) in group.items"
                :key="entry.puuid + entry.championId"
                class="flex w-full items-center gap-3 border-b border-[#3c2f14]/40 py-2.5 text-left transition-colors last:border-0"
                :class="ctx.selectedEntry?.puuid === entry.puuid ? 'bg-[#c8aa6e]/[0.07]' : ''"
                @click="ctx.selectMember(entry)"
              >
                <span
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[17px] font-bold tabular-nums"
                  :class="index < 3 ? MEDAL_CLASSES[index] : 'border-slate-600/50 text-slate-500'"
                >
                  {{ index + 1 }}
                </span>
                <span class="min-w-0 flex-1 truncate text-lg font-semibold text-slate-100">{{ entry.riotId }}</span>
                <span class="text-sm text-slate-400">
                  {{ entry.games }}场 胜率{{ Math.round(((entry.wins ?? 0) / (entry.games || 1)) * 100) }}%
                </span>
                <span class="gold-text w-24 text-right text-2xl font-bold tabular-nums">{{ fmtValue(entry.value) }}</span>
              </button>
            </section>
          </template>

          <!-- 其他维度：单卷排行 -->
          <section v-else class="hex-panel p-5" data-testid="leaderboard-table">
            <h2 class="mb-4 flex items-center gap-2 text-lg font-bold tracking-[0.1em] text-[#c8aa6e]">
              <span>❖</span>{{ ctx.dimensionLabel }}
              <span class="ml-auto text-sm font-normal tracking-normal text-slate-400">{{ entries.length }} 人登榜</span>
            </h2>
            <template v-if="entries.length">
              <button
                v-for="(entry, index) in entries"
                :key="entry.puuid"
                class="flex w-full items-center gap-3 border-b border-[#3c2f14]/40 py-2.5 text-left transition-colors last:border-0"
                :class="ctx.selectedEntry?.puuid === entry.puuid ? 'bg-[#c8aa6e]/[0.07]' : ''"
                @click="ctx.selectMember(entry)"
              >
                <span
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[17px] font-bold tabular-nums"
                  :class="index < 3 ? MEDAL_CLASSES[index] : 'border-slate-600/50 text-slate-500'"
                >
                  {{ index + 1 }}
                </span>
                <span class="min-w-0 flex-1 truncate text-lg font-semibold text-slate-100">{{ entry.riotId }}</span>
                <span class="text-sm text-slate-400">{{ entry.detail }}</span>
                <span class="gold-text w-24 text-right text-2xl font-bold tabular-nums">{{ fmtValue(entry.value) }}</span>
              </button>
              <p class="mt-3 text-sm tracking-widest text-slate-400">点击条目翻开符文页 / Inspect</p>
            </template>
            <p v-else class="py-8 text-center text-[17px] font-semibold tracking-[0.25em] text-slate-400">—— 本卷暂无人登榜 ——</p>
          </section>
        </main>

        <!-- 右：符文页成员卡 -->
        <aside class="w-full shrink-0 lg:w-80" data-testid="member-panel">
          <div class="hex-panel p-5 lg:sticky lg:top-4">
            <div v-if="!ctx.selectedEntry" class="py-10 text-center text-[17px] font-semibold tracking-[0.25em] text-slate-400">
              点击左侧条目
            </div>
            <template v-else>
              <div class="border-b border-[#3c2f14] pb-3">
                <div class="text-sm font-semibold uppercase tracking-[0.2em] text-[#0ac8b9]">Rune Page · 符文页</div>
                <h2 class="gold-text mt-1 text-3xl font-black tracking-wider">
                  {{ ctx.memberCard?.riotId ?? ctx.selectedEntry.riotId }}
                </h2>
              </div>

              <div v-if="ctx.cardLoading" class="py-10 text-center text-[17px] font-semibold tracking-[0.25em] text-slate-400" data-testid="panel-loading">
                翻页中…
              </div>
              <template v-else-if="ctx.memberCard">
                <!-- 成长曲线 -->
                <h3 class="mb-2 mt-4 text-sm font-bold tracking-[0.15em] text-[#c8aa6e]">成长曲线 · 近 8 周</h3>
                <div class="space-y-1.5" data-testid="panel-trend">
                  <div v-for="point in ctx.memberCard.trend" :key="point.weekLabel" class="flex items-center gap-2 text-sm font-semibold">
                    <span class="w-12 shrink-0 text-slate-400 tabular-nums">{{ point.weekLabel.slice(5) }}</span>
                    <div class="h-1.5 flex-1 bg-slate-700/40">
                      <div
                        class="h-full bg-gradient-to-r from-[#8a6a35] to-[#f0d9a6]"
                        :style="{ width: `${((point.winRate ?? 0) * 100).toFixed(0)}%` }"
                      />
                    </div>
                    <span class="w-28 shrink-0 text-right text-slate-300 tabular-nums">
                      {{ point.games }}场
                      {{ point.avgOpScore != null ? point.avgOpScore.toFixed(2) : '—' }}
                    </span>
                  </div>
                </div>

                <!-- 英雄基线 -->
                <h3 class="mb-2 mt-5 text-sm font-bold tracking-[0.15em] text-[#c8aa6e]">英雄基线 · 全时段</h3>
                <table class="w-full text-left text-sm font-semibold text-slate-200" data-testid="panel-champions">
                  <thead class="text-xs font-semibold tracking-wider text-slate-400">
                    <tr>
                      <th class="pb-1">英雄</th>
                      <th>场次</th>
                      <th>胜率</th>
                      <th>op</th>
                      <th class="text-right">伤害/基线</th>
                    </tr>
                  </thead>
                  <tbody class="tabular-nums">
                    <tr v-for="champ in ctx.memberCard.champions" :key="champ.championId" class="border-t border-[#3c2f14]/50">
                      <td class="py-2 text-[#f0d9a6]">{{ champ.championName }}</td>
                      <td>{{ champ.games }}</td>
                      <td>{{ Math.round((champ.wins / champ.games) * 100) }}%</td>
                      <td class="text-[#0ac8b9]">{{ champ.avgOpScore?.toFixed(2) ?? '—' }}</td>
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
    </div>
  </div>
</template>

<style scoped>
/* 魔典字体（与周报方案 C 一致） */
.font-hex {
  font-family: Cinzel, Georgia, KaiTi, '楷体', serif;
}

/* 金色渐变文字 */
.gold-text {
  background: linear-gradient(180deg, #f0d9a6 0%, #c8aa6e 55%, #8a6a35 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

/* 双线金边面板 */
.hex-panel {
  border: 1px solid #3c2f14;
  outline: 1px solid #3c2f14;
  outline-offset: 3px;
  background: linear-gradient(180deg, #0d1b30 0%, #0a1428 100%);
}

/* 符文分隔线 */
.ornament {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.ornament-line {
  height: 1px;
  flex: 1;
}
.ornament-line:first-child {
  background: linear-gradient(90deg, transparent, rgba(200, 170, 110, 0.5));
}
.ornament-line:last-child {
  background: linear-gradient(90deg, rgba(200, 170, 110, 0.5), transparent);
}
</style>
