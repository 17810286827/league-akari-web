<!--
  榜单中心页（/leaderboards）：维度/模式/时间三组筛选 + 榜单表格 + 成员卡抽屉。
  榜单口径与周报共享（后端 TeamStatsService），点击成员行打开成员卡看成长曲线与英雄基线对比。
-->
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import { getMemberCard, getTeamLeaderboard, apiErrorMessage, LEADERBOARD_DIMENSIONS } from '@/api/team'
import type { TeamBoardEntry, TeamLeaderboard, TeamMemberCard } from '@/api/team'

import { MODE_OPTIONS, rangeToParams, TIME_RANGE_OPTIONS } from './adapter'
import type { TimeRangeKey } from './adapter'

/** 当前维度（默认出勤榜） */
const dimension = ref<string>('attendance')
/** 当前模式过滤（null = 全部） */
const mode = ref<string | null>(null)
/** 当前时间范围 */
const rangeKey = ref<TimeRangeKey>('all')
/** 自定义起止（rangeKey=custom 时生效） */
const customStart = ref('')
const customEnd = ref('')

const leaderboard = ref<TeamLeaderboard | null>(null)
const loading = ref(false)
const errorMsg = ref('')

/** 成员卡抽屉状态 */
const cardOpen = ref(false)
const cardLoading = ref(false)
const cardError = ref('')
const memberCard = ref<TeamMemberCard | null>(null)

/** 维度中文名（表格列头用） */
const dimensionLabel = () =>
  LEADERBOARD_DIMENSIONS.find((d) => d.key === dimension.value)?.label ?? dimension.value

/** 加载当前筛选下的榜单 */
async function load(): Promise<void> {
  loading.value = true
  errorMsg.value = ''
  try {
    const { start, end } = rangeToParams(rangeKey.value, customStart.value, customEnd.value)
    leaderboard.value = await getTeamLeaderboard({
      dimension: dimension.value,
      mode: mode.value ?? undefined,
      start,
      end
    })
  } catch (error) {
    errorMsg.value = apiErrorMessage(error, '榜单加载失败，请稍后重试')
    leaderboard.value = null
  } finally {
    loading.value = false
  }
}

/** 打开成员卡抽屉并拉取数据 */
async function openMemberCard(entry: TeamBoardEntry): Promise<void> {
  cardOpen.value = true
  cardLoading.value = true
  cardError.value = ''
  memberCard.value = null
  try {
    memberCard.value = await getMemberCard(entry.puuid)
  } catch (error) {
    cardError.value = apiErrorMessage(error, '成员卡加载失败')
  } finally {
    cardLoading.value = false
  }
}

/** 筛选变化自动重查 */
watch([dimension, mode, rangeKey], load)
onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-6">
    <header class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold text-emerald-300">榜单中心</h1>
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <!-- 维度切换 -->
        <div class="flex gap-1" data-testid="dimension-tabs">
          <button
            v-for="d in LEADERBOARD_DIMENSIONS"
            :key="d.key"
            class="rounded px-3 py-1"
            :class="
              dimension === d.key
                ? 'bg-emerald-500/25 text-emerald-300'
                : 'border border-slate-600 text-slate-300 hover:border-emerald-400'
            "
            :data-testid="`dim-${d.key}`"
            @click="dimension = d.key"
          >
            {{ d.label }}
          </button>
        </div>
        <!-- 模式筛选 -->
        <select
          v-model="mode"
          class="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-200"
          data-testid="mode-select"
        >
          <option v-for="m in MODE_OPTIONS" :key="m.label" :value="m.value">{{ m.label }}</option>
        </select>
        <!-- 时间范围 -->
        <select
          v-model="rangeKey"
          class="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-200"
          data-testid="range-select"
        >
          <option v-for="r in TIME_RANGE_OPTIONS" :key="r.key" :value="r.key">{{ r.label }}</option>
        </select>
      </div>
    </header>

    <!-- 自定义范围输入 -->
    <div v-if="rangeKey === 'custom'" class="mb-4 flex items-center gap-2 text-sm text-slate-300">
      <input v-model="customStart" type="date" data-testid="custom-start" />
      <span>至</span>
      <input v-model="customEnd" type="date" data-testid="custom-end" />
      <button
        class="rounded border border-slate-600 px-3 py-1 hover:border-emerald-400"
        data-testid="custom-apply"
        @click="load"
      >
        查询
      </button>
    </div>

    <!-- 加载与错误态 -->
    <div v-if="loading" class="py-16 text-center text-slate-400" data-testid="leaderboard-loading">
      正在统计…
    </div>
    <div
      v-else-if="errorMsg"
      class="rounded border border-red-500/40 bg-red-500/10 p-6 text-center text-red-300"
      data-testid="leaderboard-error"
    >
      {{ errorMsg }}
    </div>

    <!-- 榜单表格 -->
    <div v-else-if="leaderboard" data-testid="leaderboard-table">
      <div
        v-for="(entry, index) in leaderboard.entries"
        :key="entry.puuid"
        class="mb-2 flex cursor-pointer items-baseline justify-between rounded bg-slate-800/50 px-4 py-3 hover:bg-slate-800"
        @click="openMemberCard(entry)"
      >
        <span class="text-slate-200">
          <span class="mr-3 text-lg font-bold" :class="index < 3 ? 'text-amber-400' : 'text-slate-500'">
            {{ index + 1 }}
          </span>
          {{ entry.riotId }}
        </span>
        <span class="text-sm">
          <span class="text-emerald-300">{{ entry.value }}</span>
          <span class="ml-2 text-xs text-slate-500">{{ entry.detail }}</span>
        </span>
      </div>
      <p v-if="leaderboard.entries.length === 0" class="py-10 text-center text-sm text-slate-500">
        该筛选条件下暂无数据
      </p>
    </div>

    <!-- 成员卡抽屉 -->
    <Teleport to="body">
      <div
        v-if="cardOpen"
        class="fixed inset-0 z-50 flex justify-end bg-black/50"
        data-testid="member-card-drawer"
        @click.self="cardOpen = false"
      >
        <aside class="h-full w-full max-w-md overflow-y-auto bg-slate-900 p-6">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-lg font-bold text-slate-100">
              {{ memberCard?.riotId ?? '成员卡' }}
            </h2>
            <button class="text-slate-400 hover:text-slate-200" data-testid="drawer-close" @click="cardOpen = false">
              ✕
            </button>
          </div>

          <div v-if="cardLoading" class="py-10 text-center text-slate-400">加载中…</div>
          <div v-else-if="cardError" class="rounded border border-red-500/40 bg-red-500/10 p-4 text-red-300">
            {{ cardError }}
          </div>

          <template v-else-if="memberCard">
            <!-- 成长曲线 -->
            <h3 class="mb-2 text-sm font-semibold text-slate-300">📈 成长曲线（近 8 周）</h3>
            <table class="mb-6 w-full text-left text-xs text-slate-300">
              <thead class="text-slate-500">
                <tr>
                  <th class="py-1">周</th>
                  <th>场次</th>
                  <th>胜率</th>
                  <th>场均 op_score</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="point in memberCard.trend" :key="point.weekLabel">
                  <td class="py-1">{{ point.weekLabel }}</td>
                  <td>{{ point.games }}</td>
                  <td>{{ point.winRate == null ? '—' : `${Math.round(point.winRate * 100)}%` }}</td>
                  <td>{{ point.avgOpScore == null ? '—' : point.avgOpScore.toFixed(1) }}</td>
                </tr>
              </tbody>
            </table>

            <!-- 英雄基线对比 -->
            <h3 class="mb-2 text-sm font-semibold text-slate-300">🎯 英雄基线对比（全时段）</h3>
            <table class="w-full text-left text-xs text-slate-300">
              <thead class="text-slate-500">
                <tr>
                  <th class="py-1">英雄</th>
                  <th>场次</th>
                  <th>胜率</th>
                  <th>场均 op_score</th>
                  <th>分均伤害 / 基线</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="champ in memberCard.champions" :key="champ.championId">
                  <td class="py-1">{{ champ.championName }}</td>
                  <td>{{ champ.games }}</td>
                  <td>{{ Math.round((champ.wins / champ.games) * 100) }}%</td>
                  <td>{{ champ.avgOpScore == null ? '—' : champ.avgOpScore.toFixed(1) }}</td>
                  <td>
                    {{ champ.avgDamagePerMin?.toFixed(0) ?? '—' }}
                    /
                    {{ champ.baselineDamagePerMin?.toFixed(0) ?? '—' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </template>
        </aside>
      </div>
    </Teleport>
  </div>
</template>
