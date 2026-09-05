<!--
  车队周报页（/weekly）：海克斯魔典风（ADR 0002）。
  默认展示上一周车队战报，可切换任意周；八栏目（总览/七榜单/名场面/AI 锐评）+ 一键生成分享图。
  数据层走 getWeeklyReport（/api/team/weekly），AI 失败时后端已降级为 null，页面空态展示。
  视觉元素复用 src/components/hex/ 共享组件。
-->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { getWeeklyReport, apiErrorMessage } from '@/api/team'
import type { TeamBoardEntry, TeamWeeklyReport } from '@/api/team'
import { formatStat } from '@/utils/format'

import GoldText from '@/components/hex/GoldText.vue'
import HexPanel from '@/components/hex/HexPanel.vue'
import HexPageShell from '@/components/hex/HexPageShell.vue'
import RankBadge from '@/components/hex/RankBadge.vue'
import SectionTitle from '@/components/hex/SectionTitle.vue'

import { BOARD_META, downloadShareImage, formatDuration, weekShift } from './adapter'

// 返回主页（所有页面统一提供主页入口）
const router = useRouter()

/** 跳转回搜索主页 */
function goHome(): void {
  router.push('/')
}

/** 周锚点（该周内任意一天）：默认今天回退 7 天（即"上一周"） */
const weekDate = ref(defaultWeekDate())
/** 周报数据 */
const report = ref<TeamWeeklyReport | null>(null)
const loading = ref(false)
const errorMsg = ref('')

/** 默认周锚点：今天回退 7 天的 ISO 日期 */
function defaultWeekDate(): string {
  const date = new Date()
  date.setDate(date.getDate() - 7)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 榜单维度 → 接口字段名（后端 op_score 榜字段为驼峰 opScoreBoard，其余为 `${key}Board`） */
function boardField(key: string): keyof TeamWeeklyReport {
  return (key === 'opscore' ? 'opScoreBoard' : `${key}Board`) as keyof TeamWeeklyReport
}

/** 榜单展示模型：元信息 + 条目（空数组 = 本周无数据） */
const boards = computed(() =>
  BOARD_META.map((meta) => ({
    ...meta,
    entries: (report.value?.[boardField(meta.key)] as TeamBoardEntry[] | null) ?? []
  }))
)

/** 非空名场面列表（过滤 null 维度） */
const highlightItems = computed(() => {
  const highlights = report.value?.highlights
  if (!highlights) {
    return []
  }
  return [
    highlights.multiKillMoment,
    highlights.biggestComeback,
    highlights.worstStreak,
    highlights.mostKillsGame
  ].filter((item) => item != null)
})

/** 总览（short 别名，模板简洁） */
const overview = computed(() => report.value?.overview ?? null)

/** 总时长拆成小时/分钟（符文圆盘内分两行展示） */
function durationParts(seconds: number): { value: string; unit: string } {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? { value: String(h), unit: `小时${m}分` } : { value: String(m), unit: '分钟' }
}

/** 加载指定周的周报 */
async function load(): Promise<void> {
  loading.value = true
  errorMsg.value = ''
  try {
    report.value = await getWeeklyReport(weekDate.value)
  } catch (error) {
    // 后端 400（名单未配置）/503（成员解析失败）等：展示后端返回的明确原因
    errorMsg.value = apiErrorMessage(error, '周报加载失败，请稍后重试')
    report.value = null
  } finally {
    loading.value = false
  }
}

/** 周切换（上一周/下一周） */
function shiftWeek(weeks: number): void {
  weekDate.value = weekShift(weekDate.value, weeks)
}

// 周锚点变化（含切换）自动重查
watch(weekDate, load)

onMounted(load)
</script>

<template>
  <!-- 加载态：居中提示（数据就绪前无法渲染魔典版式） -->
  <div
    v-if="loading"
    class="flex min-h-screen items-center justify-center bg-hex-blue font-hex text-sm font-semibold tracking-[0.3em] text-hex-gold"
    data-testid="weekly-loading"
  >
    正在聚合本周车队数据…
  </div>

  <!-- 错误态：赤铜边面板透出后端原因 -->
  <div v-else-if="errorMsg" class="min-h-screen bg-hex-blue px-6 pt-24 font-hex">
    <div class="error-panel mx-auto max-w-lg p-6 text-center text-[17px] text-[#e8a79a]" data-testid="weekly-error">
      {{ errorMsg }}
    </div>
  </div>

  <!-- 周报主体：海克斯魔典版式 -->
  <HexPageShell v-else-if="report">
    <!-- 魔典标题区：主页/分享图 + 眉题 + 金渐变大标题 + 周标签 + 周导航 -->
    <header class="mt-6 text-center">
      <div class="flex items-start justify-between text-[17px] font-semibold text-hex-gold/90">
        <button class="hover:text-hex-gold-2" data-testid="home-button" @click="goHome">❖ 主页</button>
        <button class="hover:text-hex-gold-2" data-testid="share-button" @click="downloadShareImage(report)">
          ❖ 分享图
        </button>
      </div>
      <div class="mt-3 text-sm font-semibold uppercase tracking-[0.35em] text-hex-teal">Weekly Chronicle</div>
      <h1 class="mt-2 text-6xl font-black tracking-[0.12em]">
        <GoldText>{{ report.teamName ?? '车队' }} · 周报</GoldText>
      </h1>
      <p class="mt-3 text-lg font-semibold tracking-[0.2em] text-hex-teal" data-testid="week-label">
        {{ report.weekLabel }}
      </p>

      <!-- 周导航：符文箭头 -->
      <nav class="mt-4 flex items-center justify-center gap-6 text-lg font-semibold text-hex-gold">
        <button class="hover:text-hex-gold-2" data-testid="week-prev" @click="shiftWeek(-1)">‹ 上周</button>
        <span class="text-hex-gold/40">✦</span>
        <button class="hover:text-hex-gold-2" data-testid="week-next" @click="shiftWeek(1)">下周 ›</button>
      </nav>
    </header>

    <!-- 总览：四枚符文圆盘 -->
    <section v-if="overview" class="mt-8 flex flex-wrap items-center justify-center gap-7" data-testid="overview">
      <div class="rune-disc">
        <div class="text-4xl font-bold tabular-nums">
          <GoldText>{{ overview.gameCount }}</GoldText>
        </div>
        <div class="mt-1 text-sm font-semibold tracking-[0.15em] text-slate-200">车队对局</div>
      </div>
      <div class="rune-disc">
        <div class="text-4xl font-bold tabular-nums">
          <span class="text-hex-teal">{{ overview.winCount }}</span>
          <span class="mx-0.5 text-lg font-semibold text-slate-300"> 胜 </span>
          <span class="text-[#cd6a5a]">{{ overview.lossCount }}</span>
          <span class="text-lg font-semibold text-slate-300"> 负 </span>
        </div>
        <div class="mt-1 text-sm font-semibold tracking-[0.15em] text-slate-200">人次胜负</div>
      </div>
      <div class="rune-disc">
        <div class="text-4xl font-bold tabular-nums">
          <GoldText>{{ durationParts(overview.totalDurationSeconds).value }}</GoldText>
        </div>
        <div class="mt-1 text-sm font-semibold tracking-[0.15em] text-slate-200">
          {{ durationParts(overview.totalDurationSeconds).unit }}
        </div>
      </div>
      <div class="rune-disc">
        <div class="text-4xl font-bold tabular-nums">
          <GoldText>{{ overview.busiestDayGames }}</GoldText>
        </div>
        <div class="mt-1 text-sm font-semibold tracking-[0.15em] text-slate-200">
          {{ overview.busiestDay ? `${overview.busiestDay.slice(5)} 最疯狂` : '最疯狂之日' }}
        </div>
      </div>
    </section>

    <!-- 七榜单：卡槽面板（双线金边 + 金银铜徽记） -->
    <section class="mt-10 space-y-5">
      <HexPanel v-for="board in boards" :key="board.key" :data-testid="`board-${board.key}`">
        <div class="p-5">
          <SectionTitle :title="board.title" :meta="`${board.entries.length} 人登榜`" />
          <ol v-if="board.entries.length" class="space-y-1">
            <li
              v-for="(entry, index) in board.entries"
              :key="entry.puuid"
              class="flex items-center gap-3 border-b border-hex-line/40 py-2.5 last:border-0"
            >
              <RankBadge :rank="index + 1" />
              <span class="min-w-0 flex-1 truncate text-lg font-semibold text-slate-100">{{ entry.riotId }}</span>
              <!-- detail 辅助文案：<768px（手机）隐藏——榜单行仅保留名次/昵称/核心数值，
                   避免"22.5% 胜率 · 300 场"等长文案在窄行挤压昵称 -->
              <span class="hidden text-sm text-slate-400 md:inline">{{ entry.detail }}</span>
              <span class="w-24 text-right text-2xl font-bold tabular-nums">
                <GoldText>{{ formatStat(entry.value) }}</GoldText>
              </span>
            </li>
          </ol>
          <p v-else class="py-2 text-[17px] font-semibold tracking-widest text-slate-400">—— 本周无人登榜 ——</p>
        </div>
      </HexPanel>
    </section>

    <!-- 名场面：鎏金战功簿 -->
    <HexPanel v-if="highlightItems.length" gold class="mt-10" data-testid="highlights">
      <div class="p-5">
        <SectionTitle title="名场面 · 战功簿" symbol="⚔" />
        <div class="grid gap-4 md:grid-cols-2">
          <div
            v-for="item in highlightItems"
            :key="`${item.gameId}-${item.title}`"
            class="border-l-2 border-hex-gold/50 pl-3"
          >
            <div class="text-lg font-bold tracking-wider">
              <GoldText>{{ item.title }}</GoldText>
            </div>
            <div class="mt-1 text-[17px] font-medium text-slate-200">{{ item.detail }}</div>
          </div>
        </div>
      </div>
    </HexPanel>

    <!-- AI 锐评：青铜神谕 -->
    <section
      v-if="report.aiComment"
      class="mt-10 border border-hex-teal/40 bg-hex-teal/[0.05] p-5"
      data-testid="ai-comment"
    >
      <div class="flex items-center gap-2 text-[17px] font-bold tracking-[0.2em] text-hex-teal">
        <span>☾</span> 神谕 · AI 锐评
      </div>
      <p class="mt-2 text-lg leading-9 text-slate-200">{{ report.aiComment }}</p>
    </section>
  </HexPageShell>
</template>

<style scoped>
/* 符文圆盘：双圈金边（border + outline 错位），总览统计的魔典签名元素 */
.rune-disc {
  width: 9.5rem;
  height: 9.5rem;
  border-radius: 9999px;
  border: 1px solid color-mix(in srgb, var(--color-hex-gold) 55%, transparent);
  outline: 1px solid color-mix(in srgb, var(--color-hex-gold) 20%, transparent);
  outline-offset: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* 错误面板：赤铜双线边（错误语义保留红色系，但走魔典质感） */
.error-panel {
  border: 1px solid #6b3325;
  outline: 1px solid #6b3325;
  outline-offset: 3px;
  background: linear-gradient(180deg, #1c0f0c 0%, #140a08 100%);
}
</style>
