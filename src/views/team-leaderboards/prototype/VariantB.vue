<!--
  【原型 · 方案 B】战报杂志（榜单中心）：
  - 字体：全衬线（Georgia/宋体），超大衬线排名数字；中文回退宋体（与周报方案 B 同语言）；
  - 图标：零图形图标——维度筛选为文字下划线 tab，排名用衬线数字 + 点线；
  - 布局：报头 → 文字 tab 维度行 + 细线筛选行 → 窄栏大数字排名列表（绝活榜按英雄分小节）→
    右侧"人物志"栏（左竖线锚定，细线表格）；米白纸底。
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

/** 平铺条目（绝活榜时为 null，走分组小节） */
const entries = computed(() => props.ctx.leaderboard.entries)

/** 成员卡成长曲线条宽（按胜率） */
function trendWidth(winRate: number | null): string {
  return `${((winRate ?? 0) * 100).toFixed(0)}%`
}
</script>

<template>
  <div class="min-h-screen bg-[#f6f2e9] px-6 pb-20 pt-7 font-editorial text-[#211d16]">
    <div class="mx-auto max-w-5xl">
      <!-- 报头 -->
      <header>
        <div class="flex items-center justify-between text-[11px] uppercase tracking-[0.3em] text-[#8a8375]">
          <button
            class="underline-offset-4 transition-colors hover:text-[#b3402a] hover:underline"
            data-testid="home-button"
            @click="ctx.goHome"
          >
            ← 返回首页
          </button>
          <span>Hall of Records</span>
          <span>{{ ctx.dimensionLabel }}</span>
        </div>
        <div class="mt-4 border-t-4 border-double border-[#211d16]" />
        <h1 class="mt-5 text-4xl font-bold tracking-[0.15em]">榜单中心</h1>

        <!-- 维度：文字 tab（下划线式） -->
        <nav class="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm" data-testid="dimension-tabs">
          <button
            v-for="item in LEADERBOARD_DIMENSIONS"
            :key="item.key"
            class="underline-offset-8 transition-colors"
            :class="
              ctx.dimension === item.key
                ? 'font-bold text-[#b3402a] underline'
                : 'text-[#6b6355] hover:text-[#211d16]'
            "
            :data-testid="`dim-${item.key}`"
            @click="ctx.setDimension(item.key)"
          >
            {{ item.label }}
          </button>
        </nav>

        <!-- 模式/时间：细线下拉 -->
        <div class="mt-2 flex items-center gap-5 border-b border-[#211d16]/40 pb-2.5 text-xs text-[#8a8375]">
          <label class="flex items-baseline gap-2">
            模式
            <select
              class="border-b border-[#211d16]/40 bg-transparent pb-0.5 text-[#211d16] focus:outline-none"
              data-testid="mode-select"
              :value="ctx.mode ?? ''"
              @change="ctx.setMode(($event.target as HTMLSelectElement).value || null)"
            >
              <option v-for="item in MODE_OPTIONS" :key="item.label" :value="item.value ?? ''">{{ item.label }}</option>
            </select>
          </label>
          <label class="flex items-baseline gap-2">
            时间
            <select
              class="border-b border-[#211d16]/40 bg-transparent pb-0.5 text-[#211d16] focus:outline-none"
              data-testid="range-select"
              :value="ctx.rangeKey"
              @change="ctx.setRange(($event.target as HTMLSelectElement).value as TimeRangeKey)"
            >
              <option v-for="item in rangeOptions" :key="item.key" :value="item.key">{{ item.label }}</option>
            </select>
          </label>
        </div>
      </header>

      <div class="mt-7 flex flex-col gap-8 lg:flex-row">
        <!-- 左：排名列表 -->
        <main class="min-w-0 flex-1">
          <!-- 绝活榜：英雄小节 -->
          <template v-if="ctx.signatureGroups">
            <section
              v-for="group in ctx.signatureGroups"
              :key="group.champion"
              class="mb-8"
              :data-testid="`champion-group-${group.champion}`"
            >
              <h2 class="border-b border-[#211d16] pb-1.5 text-lg font-bold">
                关于「{{ group.champion }}」
                <span class="ml-1 text-xs font-normal text-[#8a8375]">· {{ group.items.length }} 人使用</span>
              </h2>
              <button
                v-for="(entry, index) in group.items"
                :key="entry.puuid + entry.championId"
                class="flex w-full items-baseline justify-between gap-3 border-b border-dotted border-[#211d16]/30 py-2.5 text-left transition-colors"
                :class="ctx.selectedEntry?.puuid === entry.puuid ? 'bg-[#eee7d8]' : ''"
                @click="ctx.selectMember(entry)"
              >
                <span class="flex min-w-0 items-baseline gap-2.5">
                  <span class="rank-num" :class="index === 0 ? 'text-[#b3402a]' : 'text-[#8a8375]'">{{ index + 1 }}.</span>
                  <span class="truncate">{{ entry.riotId }}</span>
                </span>
                <span class="shrink-0 text-right">
                  <span class="font-bold tabular-nums">{{ fmtValue(entry.value) }}</span>
                  <span class="ml-1.5 text-xs text-[#8a8375]">
                    {{ entry.games }}场 胜率{{ Math.round(((entry.wins ?? 0) / (entry.games || 1)) * 100) }}%
                  </span>
                </span>
              </button>
            </section>
          </template>

          <!-- 其他维度：平铺大数字排名 -->
          <template v-else>
            <h2 class="border-b border-[#211d16] pb-1.5 text-sm font-bold tracking-[0.25em]" data-testid="leaderboard-table">
              {{ ctx.dimensionLabel }}
            </h2>
            <div v-if="entries.length">
              <button
                v-for="(entry, index) in entries"
                :key="entry.puuid"
                class="flex w-full items-baseline justify-between gap-3 border-b border-dotted border-[#211d16]/30 py-3 text-left transition-colors"
                :class="ctx.selectedEntry?.puuid === entry.puuid ? 'bg-[#eee7d8]' : ''"
                @click="ctx.selectMember(entry)"
              >
                <span class="flex min-w-0 items-baseline gap-3">
                  <span class="rank-num" :class="index === 0 ? 'text-[#b3402a]' : 'text-[#8a8375]'">{{ index + 1 }}.</span>
                  <span class="truncate">{{ entry.riotId }}</span>
                </span>
                <span class="shrink-0 text-right">
                  <span class="font-bold tabular-nums">{{ fmtValue(entry.value) }}</span>
                  <span class="ml-1.5 text-xs text-[#8a8375]">{{ entry.detail }}</span>
                </span>
              </button>
            </div>
            <p v-else class="py-10 text-center text-sm text-[#8a8375]">该筛选条件下暂无数据。</p>
            <p v-if="entries.length" class="mt-3 text-xs text-[#8a8375]">点击条目，右侧查阅成员志 →</p>
          </template>
        </main>

        <!-- 右：人物志 -->
        <aside class="w-full shrink-0 lg:w-72" data-testid="member-panel">
          <div class="border-l-2 border-[#211d16] pl-5 lg:sticky lg:top-6">
            <div v-if="!ctx.selectedEntry" class="py-10 text-sm text-[#8a8375]">点击左侧任意成员，查阅其成员志。</div>
            <template v-else>
              <div class="text-[10px] uppercase tracking-[0.35em] text-[#b3402a]">Profile · 成员志</div>
              <h2 class="mt-1 text-2xl font-bold">{{ ctx.memberCard?.riotId ?? ctx.selectedEntry.riotId }}</h2>

              <div v-if="ctx.cardLoading" class="py-10 text-sm text-[#8a8375]" data-testid="panel-loading">查阅中…</div>
              <template v-else-if="ctx.memberCard">
                <!-- 成长曲线 -->
                <h3 class="mt-5 border-b border-[#211d16] pb-1 text-xs font-bold tracking-[0.2em]">成长曲线 · 近 8 周</h3>
                <div class="mt-2 space-y-1.5" data-testid="panel-trend">
                  <div v-for="point in ctx.memberCard.trend" :key="point.weekLabel" class="flex items-center gap-2 text-xs">
                    <span class="w-12 shrink-0 text-[#8a8375] tabular-nums">{{ point.weekLabel.slice(5) }}</span>
                    <div class="h-1 flex-1 bg-[#211d16]/15">
                      <div class="h-full bg-[#b3402a]" :style="{ width: trendWidth(point.winRate) }" />
                    </div>
                    <span class="w-20 shrink-0 text-right text-[#6b6355] tabular-nums">
                      {{ point.games }}场
                      {{ point.avgOpScore != null ? `· ${point.avgOpScore.toFixed(2)}` : '' }}
                    </span>
                  </div>
                </div>

                <!-- 英雄基线 -->
                <h3 class="mt-6 border-b border-[#211d16] pb-1 text-xs font-bold tracking-[0.2em]">英雄基线 · 全时段</h3>
                <table class="mt-2 w-full text-left text-xs" data-testid="panel-champions">
                  <thead class="text-[10px] uppercase tracking-wider text-[#8a8375]">
                    <tr>
                      <th class="pb-1">英雄</th>
                      <th>场次</th>
                      <th>胜率</th>
                      <th>op</th>
                      <th class="text-right">伤害/基线</th>
                    </tr>
                  </thead>
                  <tbody class="tabular-nums">
                    <tr v-for="champ in ctx.memberCard.champions" :key="champ.championId" class="border-t border-dotted border-[#211d16]/30">
                      <td class="py-1.5">{{ champ.championName }}</td>
                      <td>{{ champ.games }}</td>
                      <td>{{ Math.round((champ.wins / champ.games) * 100) }}%</td>
                      <td class="text-[#b3402a]">{{ champ.avgOpScore?.toFixed(2) ?? '—' }}</td>
                      <td class="text-right text-[#6b6355]">
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
/* 报刊衬线（与周报方案 B 一致） */
.font-editorial {
  font-family: Georgia, 'Times New Roman', SimSun, '宋体', serif;
}

/* 超大衬线排名数字（第 1 名朱红由模板类控制） */
.rank-num {
  font-size: 1.5rem;
  font-weight: 700;
  min-width: 2rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
