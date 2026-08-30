<!--
  榜单中心页（/leaderboards）：双栏联动布局。
  左栏：维度/模式/时间筛选 + 榜单排名（绝活榜按英雄分小节）；点击行选中成员。
  右栏：常驻成员卡（成长曲线条形图 + 英雄基线对比），点行联动刷新；手机端折叠到下方。
  榜单口径与周报共享（后端 TeamStatsService）。
-->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { getMemberCard, getTeamLeaderboard, apiErrorMessage, LEADERBOARD_DIMENSIONS } from '@/api/team'
import type { TeamBoardEntry, TeamLeaderboard, TeamMemberCard } from '@/api/team'
import { format2 } from '@/utils/format'

import { MODE_OPTIONS, rangeToParams, TIME_RANGE_OPTIONS } from './adapter'
import type { TimeRangeKey } from './adapter'

// 返回主页（所有页面统一提供主页入口）
const router = useRouter()

/** 跳转回搜索主页 */
function goHome(): void {
  router.push('/')
}

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

/** 当前选中的成员条目（右栏成员卡联动） */
const selectedEntry = ref<TeamBoardEntry | null>(null)
const cardLoading = ref(false)
const cardError = ref('')
const memberCard = ref<TeamMemberCard | null>(null)

/** 维度中文名（列表标题用） */
const dimensionLabel = computed(
  () => LEADERBOARD_DIMENSIONS.find((d) => d.key === dimension.value)?.label ?? dimension.value
)

/** 绝活榜按英雄分组：{ 英雄名, 组内条目 }[]（条目已按分数降序，组间按组内最高分降序）；
 *  其他维度返回 null（使用平铺列表） */
const signatureGroups = computed<{ champion: string; items: TeamBoardEntry[] }[] | null>(() => {
  if (dimension.value !== 'signature' || !leaderboard.value) {
    return null
  }
  const groups = new Map<string, TeamBoardEntry[]>()
  for (const entry of leaderboard.value.entries) {
    // 英雄名优先取结构化字段；旧数据缺失时从 detail 前缀兜底解析
    const name = entry.championName ?? (entry.detail ? entry.detail.split(' ')[0] : '未知英雄')
    const group = groups.get(name)
    if (group) {
      group.push(entry)
    } else {
      groups.set(name, [entry])
    }
  }
  return [...groups.entries()].map(([champion, items]) => ({ champion, items }))
})

/** 加载当前筛选下的榜单，并自动选中榜首（右栏立即有内容） */
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
    // 联动体验：榜单刷新后默认选中第一名
    const first = leaderboard.value?.entries?.[0]
    if (first) {
      await selectMember(first)
    } else {
      selectedEntry.value = null
      memberCard.value = null
    }
  } catch (error) {
    errorMsg.value = apiErrorMessage(error, '榜单加载失败，请稍后重试')
    leaderboard.value = null
    selectedEntry.value = null
  } finally {
    loading.value = false
  }
}

/** 选中成员并拉取其成员卡 */
async function selectMember(entry: TeamBoardEntry): Promise<void> {
  selectedEntry.value = entry
  cardLoading.value = true
  cardError.value = ''
  try {
    memberCard.value = await getMemberCard(entry.puuid)
  } catch (error) {
    cardError.value = apiErrorMessage(error, '成员卡加载失败')
    memberCard.value = null
  } finally {
    cardLoading.value = false
  }
}

/** 筛选变化自动重查 */
watch([dimension, mode, rangeKey], load)
onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-6">
    <!-- 顶部：主页 + 标题 + 维度/模式/时间筛选 -->
    <header class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <button
          class="rounded border border-slate-600 px-3 py-1 text-sm text-slate-300 hover:border-emerald-400"
          data-testid="home-button"
          @click="goHome"
        >
          🏠 主页
        </button>
        <h1 class="text-2xl font-bold text-emerald-300">榜单中心</h1>
      </div>
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <!-- 维度切换 -->
        <div class="flex flex-wrap gap-1" data-testid="dimension-tabs">
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

    <!-- 双栏：左榜单 + 右常驻成员卡（手机端上下堆叠） -->
    <div v-else-if="leaderboard" class="grid items-start gap-4 lg:grid-cols-[1fr,360px]">
      <!-- 左栏：榜单 -->
      <div data-testid="leaderboard-table">
        <h2 class="mb-2 text-sm font-semibold text-slate-300">
          {{ dimensionLabel }}
          <span class="ml-2 text-xs font-normal text-slate-500">点击行查看成员卡</span>
        </h2>

        <!-- 绝活榜：英雄分组小节 -->
        <template v-if="signatureGroups">
          <section
            v-for="group in signatureGroups"
            :key="group.champion"
            class="mb-4"
            :data-testid="`champion-group-${group.champion}`"
          >
            <h3 class="mb-2 text-sm font-semibold text-amber-300">
              🎯 {{ group.champion }}
              <span class="ml-2 text-xs text-slate-500">{{ group.items.length }} 人使用</span>
            </h3>
            <div
              v-for="(entry, index) in group.items"
              :key="entry.puuid + entry.championId"
              class="mb-1 flex cursor-pointer items-baseline justify-between rounded px-4 py-2.5 transition-colors"
              :class="
                selectedEntry?.puuid === entry.puuid
                  ? 'bg-slate-800 ring-1 ring-emerald-400/60'
                  : 'bg-slate-800/50 hover:bg-slate-800'
              "
              @click="selectMember(entry)"
            >
              <span class="text-slate-200">
                <span
                  class="mr-3 text-sm font-bold"
                  :class="index === 0 ? 'text-amber-400' : 'text-slate-500'"
                >
                  {{ index + 1 }}
                </span>
                {{ entry.riotId }}
              </span>
              <span class="text-sm">
                <span class="text-emerald-300">{{ format2(entry.value) }}</span>
                <span class="ml-2 text-xs text-slate-500">
                  {{ entry.games }}场 胜率{{ Math.round(((entry.wins ?? 0) / (entry.games || 1)) * 100) }}%
                </span>
              </span>
            </div>
          </section>
        </template>

        <!-- 其他维度：平铺排名 -->
        <template v-else>
          <div
            v-for="(entry, index) in leaderboard.entries"
            :key="entry.puuid"
            class="mb-2 flex cursor-pointer items-baseline justify-between rounded px-4 py-3 transition-colors"
            :class="
              selectedEntry?.puuid === entry.puuid
                ? 'bg-slate-800 ring-1 ring-emerald-400/60'
                : 'bg-slate-800/50 hover:bg-slate-800'
            "
            @click="selectMember(entry)"
          >
            <span class="text-slate-200">
              <span
                class="mr-3 text-lg font-bold"
                :class="index < 3 ? ['text-amber-300', 'text-slate-300', 'text-orange-400'][index] : 'text-slate-500'"
              >
                {{ index + 1 }}
              </span>
              {{ entry.riotId }}
            </span>
            <span class="text-sm">
              <span class="text-emerald-300">{{ format2(entry.value) }}</span>
              <span class="ml-2 text-xs text-slate-500">{{ entry.detail }}</span>
            </span>
          </div>
        </template>
        <p v-if="leaderboard.entries.length === 0" class="py-10 text-center text-sm text-slate-500">
          该筛选条件下暂无数据
        </p>
      </div>

      <!-- 右栏：常驻成员卡（点行联动；桌面 sticky，手机端堆叠到下方） -->
      <aside
        class="rounded border border-slate-700/60 bg-slate-800/40 p-4 lg:sticky lg:top-4"
        data-testid="member-panel"
      >
        <div v-if="!selectedEntry" class="py-10 text-center text-sm text-slate-500">
          点击左侧任意成员查看个人数据
        </div>
        <template v-else>
          <h2 class="mb-4 text-lg font-bold text-slate-100">{{ memberCard?.riotId ?? selectedEntry.riotId }}</h2>

          <div v-if="cardLoading" class="py-10 text-center text-sm text-slate-400" data-testid="panel-loading">
            加载中…
          </div>
          <div v-else-if="cardError" class="rounded border border-red-500/40 bg-red-500/10 p-4 text-red-300">
            {{ cardError }}
          </div>

          <template v-else-if="memberCard">
            <!-- 成长曲线：周场次条形 + 场均 op_score -->
            <h3 class="mb-2 text-sm font-semibold text-slate-300">📈 成长曲线（近 8 周）</h3>
            <div class="mb-6 space-y-1.5" data-testid="panel-trend">
              <div v-for="point in memberCard.trend" :key="point.weekLabel" class="flex items-center gap-2 text-xs">
                <span class="w-20 shrink-0 text-slate-500">{{ point.weekLabel }}</span>
                <div class="h-2.5 flex-1 overflow-hidden rounded bg-slate-700/60">
                  <div
                    class="h-full rounded bg-emerald-400/80"
                    :style="{ width: `${(point.games ? (point.winRate ?? 0) : 0) * 100}%` }"
                  />
                </div>
                <span class="w-28 shrink-0 text-right text-slate-400">
                  {{ point.games }}场 · {{ format2(point.avgOpScore) }}
                </span>
              </div>
            </div>

            <!-- 英雄基线对比 -->
            <h3 class="mb-2 text-sm font-semibold text-slate-300">🎯 英雄基线对比（全时段）</h3>
            <table class="w-full text-left text-xs text-slate-300" data-testid="panel-champions">
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
                  <td>{{ format2(champ.avgOpScore) }}</td>
                  <td>
                    {{ format2(champ.avgDamagePerMin) }}
                    /
                    {{ format2(champ.baselineDamagePerMin) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </template>
        </template>
      </aside>
    </div>
  </div>
</template>
