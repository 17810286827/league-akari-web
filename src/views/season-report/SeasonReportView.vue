<script setup lang="ts">
/**
 * 赛季报告页（/season-report，工单 #42 / spec #32）：
 * 赛季维度的车队总结大页面——版本胜率曲线（Chart.js 折线）+ 成员英雄池随版本漂移
 * + 高光时刻（复用名场面口径）。赛季起止人工指定（日期选择，不做自动判定）；
 * 纯数据聚合即时返回（无 AI、无异步生成），手动"生成报告"触发查询。
 * 海克斯魔典风，视觉元素复用 src/components/hex/ 共享组件。
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
} from 'chart.js'
import { Line } from 'vue-chartjs'

import { apiErrorMessage, getSeasonReport } from '@/api/team'
import { championIconUrl } from '@/utils/icon-url'
import type { SeasonReport } from '@/api/team'

import GoldText from '@/components/hex/GoldText.vue'
import HexPanel from '@/components/hex/HexPanel.vue'
import HexPageShell from '@/components/hex/HexPageShell.vue'
import RankBadge from '@/components/hex/RankBadge.vue'
import SectionTitle from '@/components/hex/SectionTitle.vue'

// Chart.js 模块注册（项目惯例：各图表组件模块级注册一次）
// Filler：fill:'origin' 填充必需
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const router = useRouter()

/** 跳转回搜索主页 */
function goHome(): void {
  router.push('/')
}

/** 赛季起止（ISO 日期，人工指定——默认覆盖近半年） */
const startDate = ref(defaultStart())
const endDate = ref(today())
const report = ref<SeasonReport | null>(null)
const loading = ref(false)
const errorMsg = ref('')

/** 默认赛季起点：半年前 */
function defaultStart(): string {
  const date = new Date()
  date.setMonth(date.getMonth() - 6)
  return toIso(date)
}

/** 今天（ISO） */
function today(): string {
  return toIso(new Date())
}

/** Date → yyyy-MM-dd */
function toIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 生成报告（手动触发；起止转毫秒时间戳） */
async function generate(): Promise<void> {
  loading.value = true
  errorMsg.value = ''
  try {
    const start = new Date(`${startDate.value}T00:00:00+08:00`).getTime()
    const end = new Date(`${endDate.value}T23:59:59+08:00`).getTime() + 1
    report.value = await getSeasonReport(start, end)
  } catch (error) {
    errorMsg.value = apiErrorMessage(error, '赛季报告生成失败，请稍后重试')
    report.value = null
  } finally {
    loading.value = false
  }
}

/** 版本胜率曲线数据集（胜率百分比） */
const chartData = computed(() => ({
  labels: (report.value?.versionStats ?? []).map((v) => v.version),
  datasets: [
    {
      label: '版本胜率（%）',
      data: (report.value?.versionStats ?? []).map((v) => Math.round(v.winRate * 100)),
      borderColor: '#3d8bfd',
      backgroundColor: 'rgba(61, 139, 253, 0.15)',
      borderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
      tension: 0,
      fill: 'origin'
    }
  ]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 300 },
  scales: {
    y: { min: 0, max: 100, title: { display: true, text: '胜率 %' } }
  }
}
</script>

<template>
  <div class="min-h-screen bg-hex-blue font-hex">
    <!-- 生成前：赛季边界选择（仪式感入口） -->
    <div v-if="!report" class="mx-auto max-w-lg px-6 pt-24">
      <div class="border border-hex-line bg-hex-blue-2 p-8 text-center" data-testid="season-entry">
        <div class="text-sm font-semibold uppercase tracking-[0.35em] text-hex-teal">Season Chronicle</div>
        <h1 class="mt-2 text-5xl font-black tracking-[0.12em]">
          <GoldText>赛季报告</GoldText>
        </h1>
        <p class="mt-4 text-[15px] text-slate-300">指定赛季起止（台服赛季边界请自行确认），生成车队赛季总结。</p>
        <div class="mt-6 space-y-3 text-left">
          <label class="block">
            <span class="text-sm font-semibold text-hex-gold">赛季起点</span>
            <input
              v-model="startDate"
              type="date"
              class="mt-1 w-full border border-hex-line bg-hex-blue px-3 py-2 text-[17px] text-hex-gold focus:outline-none"
              data-testid="season-start"
            >
          </label>
          <label class="block">
            <span class="text-sm font-semibold text-hex-gold">赛季终点</span>
            <input
              v-model="endDate"
              type="date"
              class="mt-1 w-full border border-hex-line bg-hex-blue px-3 py-2 text-[17px] text-hex-gold focus:outline-none"
              data-testid="season-end"
            >
          </label>
        </div>
        <button
          class="mt-6 w-full border border-hex-gold/60 bg-hex-gold/10 px-6 py-3 text-lg font-bold tracking-[0.2em] text-hex-gold hover:bg-hex-gold/20 disabled:opacity-50"
          :disabled="loading"
          data-testid="season-generate"
          @click="generate"
        >
          {{ loading ? '正在编纂战功簿…' : '✦ 生成赛季报告' }}
        </button>
        <p v-if="errorMsg" class="mt-3 text-sm text-[#e8a79a]" data-testid="season-error">{{ errorMsg }}</p>
        <button class="mt-6 text-[17px] font-semibold text-hex-gold/90 hover:text-hex-gold-2" data-testid="home-button" @click="goHome">❖ 主页</button>
      </div>
    </div>

    <!-- 报告主体 -->
    <HexPageShell v-else max-width="5xl">
      <header class="mt-6 text-center">
        <div class="flex items-start justify-between text-[17px] font-semibold text-hex-gold/90">
          <button class="hover:text-hex-gold-2" data-testid="home-button" @click="goHome">❖ 主页</button>
          <button class="hover:text-hex-gold-2" data-testid="season-regenerate" @click="report = null">❖ 重新生成</button>
        </div>
        <div class="mt-3 text-sm font-semibold uppercase tracking-[0.35em] text-hex-teal">Season Chronicle</div>
        <h1 class="mt-2 text-6xl font-black tracking-[0.12em]">
          <GoldText>赛季报告</GoldText>
        </h1>
        <p class="mt-3 text-lg font-semibold tracking-[0.2em] text-hex-teal" data-testid="season-summary">
          {{ startDate }} ~ {{ endDate }} · {{ report.totalGames }} 局 · 总胜率 {{ Math.round(report.totalWinRate * 100) }}%
        </p>
      </header>

      <!-- 版本胜率曲线 -->
      <HexPanel v-if="report.versionStats.length" class="mt-10" data-testid="season-versions">
        <div class="p-5">
          <SectionTitle title="版本胜率曲线" meta="车队胜率随版本走势" symbol="📈" />
          <div class="relative h-72">
            <Line :data="chartData" :options="chartOptions" />
          </div>
        </div>
      </HexPanel>

      <!-- 高光时刻 -->
      <HexPanel v-if="report.mostKills" gold class="mt-5" data-testid="season-highlights">
        <div class="p-5">
          <SectionTitle title="赛季高光 · 战功簿" symbol="⚔" />
          <div class="border-l-2 border-hex-gold/50 pl-3">
            <div class="text-lg font-bold tracking-wider">
              <GoldText>{{ report.mostKills.title }}</GoldText>
            </div>
            <div class="mt-1 text-[17px] font-medium text-slate-200">{{ report.mostKills.detail }}</div>
          </div>
        </div>
      </HexPanel>

      <!-- 英雄池漂移 -->
      <HexPanel class="mt-5" data-testid="season-drift">
        <div class="p-5">
          <SectionTitle title="英雄池漂移" meta="谁一直玩本命，谁每版换爹" symbol="🧬" />
          <div class="space-y-4">
            <div v-for="drift in report.memberDrifts" :key="drift.riotId" :data-testid="`drift-${drift.riotId}`">
              <div class="font-semibold text-slate-100">{{ drift.riotId }}</div>
              <div class="mt-1 flex flex-wrap gap-2">
                <div v-for="v in drift.versions" :key="v.version" class="border border-hex-line/50 px-3 py-1.5 text-sm">
                  <span class="font-semibold text-hex-teal">{{ v.version }}</span>
                  <span class="ml-2 flex flex-wrap items-center gap-1 text-slate-300">
                    <template v-if="v.champions.length">
                      <span
                        v-for="c in v.champions"
                        :key="c.champion"
                        class="inline-flex items-center gap-1"
                      >
                        <!-- 英雄头像（spec #44）：缺失 ID 的旧数据不渲染，回退文字 -->
                        <img
                          v-if="c.championId != null"
                          :src="championIconUrl(c.championId)"
                          :alt="c.champion"
                          :data-testid="`champion-avatar-${c.champion}`"
                          class="h-4 w-4 rounded object-cover"
                        />
                        <span>{{ c.champion }}×{{ c.games }}</span>
                      </span>
                    </template>
                    <template v-else>未出战</template>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </HexPanel>
    </HexPageShell>
  </div>
</template>
