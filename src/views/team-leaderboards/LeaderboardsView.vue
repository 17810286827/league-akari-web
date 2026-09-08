<!--
  榜单中心页（/leaderboards）：海克斯魔典风（ADR 0002）。
  符文维度按钮 + 模式/时间筛选 + 排行卡槽面板（绝活榜按英雄分卷）；点击行选中成员，
  右栏"符文页"成员卡联动刷新（成长曲线 + 英雄基线对比），手机端折叠到下方。
  榜单口径与周报共享（后端 TeamStatsService），视觉元素复用 src/components/hex/ 共享组件。
-->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { getDuoExtended, getDuoMatrix, getMemberCard, getTeamLeaderboard, apiErrorMessage, LEADERBOARD_DIMENSIONS } from '@/api/team'
import type { DuoExtended, DuoMatrix, LineupStats, TeamBoardEntry, TeamLeaderboard, TeamMemberCard } from '@/api/team'
import { format2, formatInt, formatStat } from '@/utils/format'
import { championIconSources } from '@/utils/icon-url'
import CdnImage from '@/components/widgets/CdnImage.vue'

import GoldText from '@/components/hex/GoldText.vue'
import HexPanel from '@/components/hex/HexPanel.vue'
import HexPageShell from '@/components/hex/HexPageShell.vue'
import RankBadge from '@/components/hex/RankBadge.vue'
import SectionTitle from '@/components/hex/SectionTitle.vue'

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
/** 版本筛选（工单 #38）：主版本（如 "16.15"）；null = 全部版本 */
const version = ref<string | null>(null)
/** 可选版本列表（静态常见主版本，按新到旧；后端按归一口径精确匹配） */
const VERSION_OPTIONS = ['16.16', '16.15', '16.14', '16.13', '16.12', '16.11', '16.10']

const leaderboard = ref<TeamLeaderboard | null>(null)
/** 搭档胜率矩阵（组合 tab，工单 #37） */
const duoMatrix = ref<DuoMatrix | null>(null)
/** 组合扩展统计（工单 #41）：时段胜率 + 常用阵容 */
const duoExtended = ref<DuoExtended | null>(null)
const loading = ref(false)
const errorMsg = ref('')

/** 组合 tab 维度键（与七榜并列的第八个 tab，走矩阵端点而非榜单引擎） */
const DUO_DIMENSION = 'duo'

/** 全部维度（七榜 + 组合 tab） */
const ALL_DIMENSIONS = [...LEADERBOARD_DIMENSIONS, { key: DUO_DIMENSION, label: '组合' }]

/** 当前选中的成员条目（右栏成员卡联动） */
const selectedEntry = ref<TeamBoardEntry | null>(null)
const cardLoading = ref(false)
const cardError = ref('')
const memberCard = ref<TeamMemberCard | null>(null)

/** 维度中文名（面板标题用） */
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

/** 阵容成员的常用英雄（spec #44）：memberChampions 按 riotId 查找，旧数据缺失返回 undefined */
function lineupChampionOf(lineup: LineupStats, riotId: string) {
  return lineup.memberChampions?.find((mc) => mc.riotId === riotId)
}


/** 加载当前筛选下的榜单，并自动选中榜首（右栏立即有内容） */
async function load(): Promise<void> {
  loading.value = true
  errorMsg.value = ''
  try {
    const { start, end } = rangeToParams(rangeKey.value, customStart.value, customEnd.value)
    if (dimension.value === DUO_DIMENSION) {
      // 组合 tab：搭档胜率矩阵（无右栏成员卡联动）
      duoMatrix.value = await getDuoMatrix({
        mode: mode.value ?? undefined,
        start,
        end,
        version: version.value ?? undefined
      })
      duoExtended.value = await getDuoExtended({
        mode: mode.value ?? undefined,
        start,
        end,
        version: version.value ?? undefined
      })
      leaderboard.value = null
      selectedEntry.value = null
      memberCard.value = null
      return
    }
    duoMatrix.value = null
    duoExtended.value = null
    leaderboard.value = await getTeamLeaderboard({
      dimension: dimension.value,
      mode: mode.value ?? undefined,
      start,
      end,
      version: version.value ?? undefined
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
watch([dimension, mode, rangeKey, version], load)
onMounted(load)
</script>

<template>
  <!-- 加载态：居中提示 -->
  <div
    v-if="loading"
    class="flex min-h-screen items-center justify-center bg-hex-blue font-hex text-sm font-semibold tracking-[0.3em] text-hex-gold"
    data-testid="leaderboard-loading"
  >
    正在统计…
  </div>

  <!-- 错误态：赤铜边面板透出后端原因 -->
  <div v-else-if="errorMsg" class="min-h-screen bg-hex-blue px-6 pt-24 font-hex">
    <div class="error-panel mx-auto max-w-lg p-6 text-center text-[17px] text-[#e8a79a]" data-testid="leaderboard-error">
      {{ errorMsg }}
    </div>
  </div>

  <!-- 榜单主体：海克斯魔典版式（榜单或组合矩阵） -->
  <HexPageShell v-else-if="leaderboard || duoMatrix" max-width="5xl">
    <!-- 标题区：主页 + 眉题 + 金渐变大标题 -->
    <header class="mt-6 text-center">
      <div class="text-[17px] font-semibold text-hex-gold/90">
        <button class="hover:text-hex-gold-2" data-testid="home-button" @click="goHome">❖ 主页</button>
      </div>
      <div class="mt-3 text-sm font-semibold uppercase tracking-[0.35em] text-hex-teal">Hall of Legends</div>
      <h1 class="mt-2 text-6xl font-black tracking-[0.12em]">
        <GoldText>榜单中心</GoldText>
      </h1>

      <!-- 维度：符文按钮环 -->
      <nav class="mt-6 flex flex-wrap justify-center gap-2" data-testid="dimension-tabs">
        <button
          v-for="d in ALL_DIMENSIONS"
          :key="d.key"
          class="rounded-full border px-5 py-2.5 text-lg font-semibold tracking-wide transition-colors"
          :class="
            dimension === d.key
              ? 'border-hex-gold bg-hex-gold/15 text-hex-gold-2'
              : 'border-hex-line text-hex-gold/80 hover:text-hex-gold-2'
          "
          :data-testid="`dim-${d.key}`"
          @click="dimension = d.key"
        >
          ❖ {{ d.label }}
        </button>
      </nav>

      <!-- 模式/时间：金边下拉 -->
      <div class="mt-4 flex flex-wrap justify-center gap-3">
        <select
          v-model="mode"
          class="border border-hex-line bg-hex-blue-2 px-4 py-2 text-[17px] font-semibold tracking-wider text-hex-gold focus:outline-none"
          data-testid="mode-select"
        >
          <option v-for="m in MODE_OPTIONS" :key="m.label" :value="m.value">{{ m.label }}</option>
        </select>
        <!-- 版本筛选（工单 #38）：主版本，与模式/时间叠加生效 -->
        <select
          v-model="version"
          class="border border-hex-line bg-hex-blue-2 px-4 py-2 text-[17px] font-semibold tracking-wider text-hex-gold focus:outline-none"
          data-testid="version-select"
        >
          <option :value="null">全部版本</option>
          <option v-for="v in VERSION_OPTIONS" :key="v" :value="v">{{ v }}</option>
        </select>
        <select
          v-model="rangeKey"
          class="border border-hex-line bg-hex-blue-2 px-4 py-2 text-[17px] font-semibold tracking-wider text-hex-gold focus:outline-none"
          data-testid="range-select"
        >
          <option v-for="r in TIME_RANGE_OPTIONS" :key="r.key" :value="r.key">{{ r.label }}</option>
        </select>
      </div>

      <!-- 自定义范围：日期起止 + 查询 -->
      <div v-if="rangeKey === 'custom'" class="mt-3 flex items-center justify-center gap-2 text-sm text-hex-gold">
        <input
          v-model="customStart"
          type="date"
          class="input-date"
          data-testid="custom-start"
        />
        <span class="text-hex-gold/60">至</span>
        <input
          v-model="customEnd"
          type="date"
          class="input-date"
          data-testid="custom-end"
        />
        <button class="border border-hex-line px-4 py-1.5 font-semibold hover:text-hex-gold-2" data-testid="custom-apply" @click="load">
          查询
        </button>
      </div>
    </header>

    <div class="mt-8 flex flex-col gap-6 lg:flex-row">
      <!-- 左：排行（绝活榜按英雄分卷，其余平铺） -->
      <main class="min-w-0 flex-1" data-testid="leaderboard-table">
        <!-- 绝活榜：英雄分卷 -->
        <!-- 组合 tab：搭档胜率矩阵（工单 #37）——小样本格子以局数标注弱化 -->
        <HexPanel v-if="duoMatrix" data-testid="duo-matrix-panel">
          <div class="p-5">
            <SectionTitle title="搭档胜率矩阵" meta="只统计车队对局 · 胜负按人次" symbol="⚔" />
            <div class="overflow-x-auto" data-testid="duo-matrix">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-hex-line/40 text-left">
                    <th class="py-2 pr-4 font-semibold text-slate-300">搭档</th>
                    <th
                      v-for="member in duoMatrix.members"
                      :key="member"
                      class="py-2 pr-4 font-semibold text-slate-300"
                    >
                      {{ member.split('#')[0] }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, rowIndex) in duoMatrix.matrix"
                    :key="duoMatrix.members[rowIndex]"
                    class="border-b border-hex-line/20"
                  >
                    <td class="py-2 pr-4 font-medium text-slate-100">
                      {{ duoMatrix.members[rowIndex].split('#')[0] }}
                    </td>
                    <td
                      v-for="(cell, colIndex) in row"
                      :key="duoMatrix.members[colIndex]"
                      class="py-2 pr-4"
                      :class="cell.games < 5 && rowIndex !== colIndex ? 'opacity-40' : ''"
                      :data-testid="`duo-cell-${rowIndex}-${colIndex}`"
                    >
                      <template v-if="cell.games === 0">—</template>
                      <template v-else>
                        <span class="font-bold tabular-nums">
                          <GoldText>{{ Math.round((cell.winRate ?? 0) * 100) }}%</GoldText>
                        </span>
                        <span class="ml-1 text-xs text-slate-400">{{ cell.games }}局</span>
                      </template>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p class="mt-3 text-xs tracking-wide text-slate-400">
              对角线为个人车队局；格子淡显 = 样本不足 5 局（胜率参考性有限）；胜率按成员人次计。
            </p>
          </div>
        </HexPanel>

        <!-- 组合扩展（工单 #41）：时段胜率 + 常用阵容 -->
        <template v-if="duoExtended">
          <HexPanel data-testid="time-slots-panel">
            <div class="p-5">
              <SectionTitle title="时段胜率" meta="几点开黑状态最好" symbol="🕐" />
              <div class="space-y-2" data-testid="time-slots">
                <div
                  v-for="slot in duoExtended.timeSlots"
                  :key="slot.key"
                  class="flex items-center gap-3 border-b border-hex-line/30 py-2 last:border-0"
                  :class="slot.games === 0 ? 'opacity-40' : ''"
                  :data-testid="`slot-${slot.key}`"
                >
                  <span class="w-28 font-semibold text-slate-100">{{ slot.label }}</span>
                  <span class="flex-1 text-sm text-slate-400">{{ slot.games }}局</span>
                  <span class="w-20 text-right text-xl font-bold tabular-nums">
                    <GoldText>{{ slot.winRate != null ? Math.round(slot.winRate * 100) + '%' : '—' }}</GoldText>
                  </span>
                </div>
              </div>
            </div>
          </HexPanel>
          <HexPanel v-if="duoExtended.lineups.length" class="mt-5" data-testid="lineups-panel">
            <div class="p-5">
              <SectionTitle title="常用阵容" meta="同局成员组合 · 按局数排序" symbol="⚔" />
              <div class="space-y-2" data-testid="lineups">
                <div
                  v-for="(lineup, index) in duoExtended.lineups"
                  :key="lineup.members.join(',')"
                  class="flex items-center gap-3 border-b border-hex-line/30 py-2 last:border-0"
                >
                  <RankBadge :rank="index + 1" />
                  <span class="min-w-0 flex-1 truncate text-lg font-semibold text-slate-100">
                    <template v-for="(m, memberIndex) in lineup.members" :key="m">
                      <!-- 成员间 " + " 分隔（既有展示契约） -->
                      <span v-if="memberIndex > 0" class="opacity-60"> + </span>
                      <!-- 成员常用英雄头像（spec #44）：memberChampions 缺失的旧数据不渲染；
                           降级链：本地镜像 → CDragon（ADR 0004） -->
                      <CdnImage
                        v-if="lineupChampionOf(lineup, m)?.championId != null"
                        :sources="championIconSources(lineupChampionOf(lineup, m)!.championId!)"
                        :alt="m.split('#')[0]"
                        :data-testid="`champion-avatar-${m}`"
                        class="mr-1 inline-block h-5 w-5 rounded-md object-cover align-text-bottom"
                      />
                      <span class="mr-1">{{ m.split('#')[0] }}</span>
                    </template>
                  </span>
                  <span class="text-sm text-slate-400">{{ lineup.games }}局</span>
                  <span class="w-20 text-right text-xl font-bold tabular-nums">
                    <GoldText>{{ Math.round(lineup.winRate * 100) }}%</GoldText>
                  </span>
                </div>
              </div>
            </div>
          </HexPanel>
        </template>

        <template v-else-if="signatureGroups">
          <HexPanel
            v-for="group in signatureGroups"
            :key="group.champion"
            class="mb-5"
            :data-testid="`champion-group-${group.champion}`"
          >
            <div class="p-5">
              <!-- 分组标题头像（spec #44）：组内首条目的英雄；
                   降级链：本地镜像 → CDragon（ADR 0004） -->
              <CdnImage
                v-if="group.items[0]?.championId != null"
                :sources="championIconSources(group.items[0]!.championId!)"
                :alt="group.champion"
                :data-testid="`champion-avatar-${group.champion}`"
                class="mb-1 h-6 w-6 rounded-md object-cover"
              />
              <SectionTitle :title="group.champion" :meta="`${group.items.length} 人使用`" symbol="⚔" />
              <button
                v-for="(entry, index) in group.items"
                :key="entry.puuid + entry.championId"
                class="flex w-full cursor-pointer items-center gap-3 border-b border-hex-line/40 py-2.5 text-left transition-colors last:border-0"
                :class="selectedEntry?.puuid === entry.puuid ? 'bg-hex-gold/[0.07]' : ''"
                @click="selectMember(entry)"
              >
                <RankBadge :rank="index + 1" />
                <span class="min-w-0 flex-1 truncate text-lg font-semibold text-slate-100">{{ entry.riotId }}</span>
                <!-- 辅助文案：<768px（手机）隐藏，榜单行仅保留名次/昵称/数值 -->
                <span class="hidden text-sm text-slate-400 md:inline">
                  {{ entry.games }}场 胜率{{ Math.round(((entry.wins ?? 0) / (entry.games || 1)) * 100) }}%
                </span>
                <span class="w-24 text-right text-2xl font-bold tabular-nums">
                  <GoldText>{{ formatStat(entry.value) }}</GoldText>
                </span>
              </button>
            </div>
          </HexPanel>
        </template>

        <!-- 其他维度：单卷排行（组合 tab 时 leaderboard 为 null，v-else 链兜底不渲染） -->
        <HexPanel v-else-if="leaderboard">
          <div class="p-5">
            <SectionTitle :title="dimensionLabel" :meta="`${leaderboard.entries.length} 人登榜`" />
            <template v-if="leaderboard.entries.length">
              <button
                v-for="(entry, index) in leaderboard.entries"
                :key="entry.puuid"
                class="flex w-full cursor-pointer items-center gap-3 border-b border-hex-line/40 py-2.5 text-left transition-colors last:border-0"
                :class="selectedEntry?.puuid === entry.puuid ? 'bg-hex-gold/[0.07]' : ''"
                @click="selectMember(entry)"
              >
                <RankBadge :rank="index + 1" />
                <span class="min-w-0 flex-1 truncate text-lg font-semibold text-slate-100">{{ entry.riotId }}</span>
                <span class="hidden text-sm text-slate-400 md:inline">{{ entry.detail }}</span>
                <span class="w-24 text-right text-2xl font-bold tabular-nums">
                  <GoldText>{{ formatStat(entry.value) }}</GoldText>
                </span>
              </button>
              <p class="mt-3 text-sm tracking-widest text-slate-400">点击条目翻开符文页 / Inspect</p>
            </template>
            <p v-else class="py-8 text-center text-[17px] font-semibold tracking-[0.25em] text-slate-400">
              —— 本卷暂无人登榜 ——
            </p>
          </div>
        </HexPanel>
      </main>

      <!-- 右：符文页成员卡（点行联动；桌面 sticky 且内容超高时面板内独立滚动，手机端堆叠到下方） -->
      <aside class="w-full shrink-0 lg:w-96" data-testid="member-panel">
        <HexPanel class="lg:sticky lg:top-4">
          <!-- 独立滚动容器：鼠标悬浮在右栏时滚轮只滚符文页（内容未超高时不拦截，
               右栏滚到边界后由浏览器 scroll chaining 自然过渡到页面滚动左侧榜单） -->
          <div class="panel-scroll p-5 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto" data-testid="panel-scroll">
            <div v-if="!selectedEntry" class="py-10 text-center text-[17px] font-semibold tracking-[0.25em] text-slate-400">
              点击左侧条目
            </div>
            <template v-else>
              <div class="border-b border-hex-line pb-3">
                <div class="text-sm font-semibold uppercase tracking-[0.2em] text-hex-teal">Rune Page · 符文页</div>
                <h2 class="mt-1 text-3xl font-black tracking-wider">
                  <GoldText>{{ memberCard?.riotId ?? selectedEntry.riotId }}</GoldText>
                </h2>
              </div>

              <div
                v-if="cardLoading"
                class="py-10 text-center text-[17px] font-semibold tracking-[0.25em] text-slate-400"
                data-testid="panel-loading"
              >
                翻页中…
              </div>
              <div v-else-if="cardError" class="error-panel p-4 text-sm text-[#e8a79a]">{{ cardError }}</div>

              <template v-else-if="memberCard">
                <!-- 成长曲线：周场次 + 胜率金条 + 场均 op_score -->
                <h3 class="mb-2 mt-4 text-sm font-bold tracking-[0.15em] text-hex-gold">成长曲线 · 近 8 周</h3>
                <div class="space-y-1.5" data-testid="panel-trend">
                  <div v-for="point in memberCard.trend" :key="point.weekLabel" class="flex items-center gap-2 text-sm font-semibold">
                    <span class="w-12 shrink-0 text-slate-400 tabular-nums">{{ point.weekLabel.slice(5) }}</span>
                    <div class="h-1.5 flex-1 bg-slate-700/40">
                      <div
                        class="h-full bg-gradient-to-r from-hex-gold-3 to-hex-gold-2"
                        :style="{ width: `${(point.games ? (point.winRate ?? 0) : 0) * 100}%` }"
                      />
                    </div>
                    <span class="w-28 shrink-0 text-right text-slate-300 tabular-nums">
                      {{ point.games }}场 · {{ format2(point.avgOpScore) }}
                    </span>
                  </div>
                </div>

                <!-- 英雄基线对比：表格禁止折行 + 列间距，避免窄列数字互相挤压；
                     外层 overflow-x-auto：极窄屏（<360px）下表格横向滚动兜底，不撑破面板 -->
                <h3 class="mb-2 mt-5 text-sm font-bold tracking-[0.15em] text-hex-gold">英雄基线 · 全时段</h3>
                <div class="overflow-x-auto">
                  <table class="w-full whitespace-nowrap text-left text-sm font-semibold text-slate-200" data-testid="panel-champions">
                  <thead class="text-xs font-semibold tracking-wider text-slate-400">
                    <tr>
                      <th class="px-1.5 pb-1">英雄</th>
                      <th class="px-1.5 pb-1">场次</th>
                      <th class="px-1.5 pb-1">胜率</th>
                      <th class="px-1.5 pb-1">op</th>
                      <th class="px-1.5 pb-1 text-right">伤害/基线</th>
                    </tr>
                  </thead>
                  <tbody class="tabular-nums">
                    <tr v-for="champ in memberCard.champions" :key="champ.championId" class="border-t border-hex-line/50">
                      <td class="px-1.5 py-2 text-hex-gold-2">{{ champ.championName }}</td>
                      <td class="px-1.5 py-2">{{ champ.games }}</td>
                      <td class="px-1.5 py-2">{{ Math.round((champ.wins / champ.games) * 100) }}%</td>
                      <td class="px-1.5 py-2 text-hex-teal">{{ format2(champ.avgOpScore) }}</td>
                      <td class="px-1.5 py-2 text-right text-slate-400">
                        {{ formatInt(champ.avgDamagePerMin) }}/{{ formatInt(champ.baselineDamagePerMin) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
                </div>
              </template>
            </template>
          </div>
        </HexPanel>
      </aside>
    </div>
  </HexPageShell>
</template>

<style scoped>
/* 日期输入：金边深底（原生控件的海克斯化） */
.input-date {
  border: 1px solid var(--color-hex-line);
  background: var(--color-hex-blue-2);
  padding: 0.375rem 0.75rem;
  color-scheme: dark;
  color: var(--color-hex-gold);
}

/* 右栏符文页滚动条：细窄金边，贴合魔典质感（内容超高出现滚动时才可见） */
.panel-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(212, 175, 55, 0.45) transparent;
}

.panel-scroll::-webkit-scrollbar {
  width: 6px;
}

.panel-scroll::-webkit-scrollbar-thumb {
  background: rgba(212, 175, 55, 0.45);
}

.panel-scroll::-webkit-scrollbar-track {
  background: transparent;
}

/* 错误面板：赤铜双线边（错误语义保留红色系，但走魔典质感） */
.error-panel {
  border: 1px solid #6b3325;
  outline: 1px solid #6b3325;
  outline-offset: 3px;
  background: linear-gradient(180deg, #1c0f0c 0%, #140a08 100%);
}
</style>
