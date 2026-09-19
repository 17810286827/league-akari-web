<script setup lang="ts">
/**
 * 赛季资料页（/season-archive，工单 #53 / spec：英雄×海克斯强化按版本统计）：
 * 左列英雄列表（按纳入对局数降序）→ 右侧所选版本强化榜（局数/胜率/出场率），
 * 版本 pills 切换（选项动态取自后端、默认最新），悬停强化行弹出跨版本胜率走势卡
 * （Catmull-Rom 平滑曲线 + 每点胜率数字 + 当前版本金色虚线标记，空档断线）。
 * 口径（ADR 0013/0014）：全库参与者行；胜率分母=持有局数；出场率分母=英雄对局数。
 * 视觉：海克斯魔典（ADR 0002），复用 hex 共享组件与 AugmentDisplay/ChampionIcon。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { apiErrorMessage, getSeasonArchive } from '@/api/team'
import type { SeasonArchive, SeasonAugmentEntry } from '@/api/team'
import AugmentDisplay from '@/components/widgets/AugmentDisplay.vue'
import ChampionIcon from '@/components/widgets/ChampionIcon.vue'
import GoldText from '@/components/hex/GoldText.vue'
import HexPageShell from '@/components/hex/HexPageShell.vue'
import HexPanel from '@/components/hex/HexPanel.vue'

const router = useRouter()

/** 跳转回搜索主页 */
function goHome(): void {
  router.push('/')
}

/** 跳转姊妹页：赛季报告（版本→胜率轴，与英雄×强化轴互补） */
function goSeasonReport(): void {
  router.push('/season-report')
}

// ---- 数据装载 ----

const archive = ref<SeasonArchive | null>(null)
const loading = ref(false)
const errorMsg = ref('')

/** 当前选中英雄（championId）；null = 未选（默认选第一个） */
const selectedChampionId = ref<number | null>(null)

/** 当前版本 pills 选中值（归一主版本）；响应驱动，不本地默认 */
const selectedVersion = ref<string>('')

/** 表头排序键：games=出场次数（默认）/ winRate / appearanceRate */
const sortKey = ref<'games' | 'winRate' | 'appearanceRate'>('games')

/** 挂载即拉取（version 省略 → 后端默认最新有数据版本） */
onMounted(load)

async function load(version?: string): Promise<void> {
  loading.value = true
  errorMsg.value = ''
  try {
    archive.value = await getSeasonArchive(version)
    selectedVersion.value = archive.value.selectedVersion ?? ''
    // 选中英雄兜底：英雄列表为空时保持 null（空态视图）
    const champs = archive.value.champions
    if (selectedChampionId.value === null || !champs.some((c) => c.championId === selectedChampionId.value)) {
      selectedChampionId.value = champs.length > 0 ? champs[0].championId : null
    }
  } catch (error) {
    errorMsg.value = apiErrorMessage(error, '赛季资料加载失败')
  } finally {
    loading.value = false
  }
}

/** 切换版本（重拉该版本截面；选中英雄保持） */
async function switchVersion(version: string): Promise<void> {
  if (version === selectedVersion.value) {
    return
  }
  await load(version)
}

// ---- 派生视图 ----

/** 当前选中英雄条目（未选/无数据时 null） */
const selectedChampion = computed(() => {
  if (!archive.value || selectedChampionId.value === null) {
    return null
  }
  return (
    archive.value.champions.find((c) => c.championId === selectedChampionId.value) ?? null
  )
})

/** 排序后的强化条目：小样本（<3 局）沉底；组内按当前排序键降序 */
const sortedAugments = computed<SeasonAugmentEntry[]>(() => {
  const augments = selectedChampion.value?.augments ?? []
  const key = sortKey.value
  return [...augments].sort((a, b) => {
    // 小样本沉底：非小样本组在前
    const smallA = a.games < SMALL_SAMPLE_GAMES ? 1 : 0
    const smallB = b.games < SMALL_SAMPLE_GAMES ? 1 : 0
    if (smallA !== smallB) {
      return smallA - smallB
    }
    return b[key] - a[key]
  })
})

/** 小样本门槛：局数 < 3 降透明度并沉底（CONTEXT 词条「强化小样本」） */
const SMALL_SAMPLE_GAMES = 3

/** 百分比展示（0-1 → "63%"；0 局显示 "—"） */
function pct(rate: number, games: number): string {
  return games > 0 ? Math.round(rate * 100) + '%' : '—'
}

// ---- 悬停走势卡（SVG 平滑曲线） ----

/** 走势卡状态：悬停中的强化条目与跟随坐标 */
const hoverAugment = ref<SeasonAugmentEntry | null>(null)
const hoverX = ref(0)
const hoverY = ref(0)

/** 走势卡 SVG 尺寸与内边距 */
const TREND_W = 340
const TREND_H = 150
const TREND_PAD = { l: 34, r: 14, t: 18, b: 24 }

/** 悬停行：打开走势卡并记录坐标 */
function onRowEnter(augment: SeasonAugmentEntry, event: MouseEvent): void {
  hoverAugment.value = augment
  onRowMove(event)
}

/** 悬停行：卡片跟随鼠标（右/下缘出界翻转方向） */
function onRowMove(event: MouseEvent): void {
  const cardW = TREND_W + 24
  const cardH = TREND_H + 60
  let x = event.clientX + 16
  let y = event.clientY + 14
  if (x + cardW > window.innerWidth) {
    x = event.clientX - cardW - 12
  }
  if (y + cardH > window.innerHeight) {
    y = Math.max(8, event.clientY - cardH - 8)
  }
  hoverX.value = x
  hoverY.value = y
}

/** 离开行：收起走势卡 */
function onRowLeave(): void {
  hoverAugment.value = null
}

/** 走势卡的版本序列（升序取全集版本列表，无数据版本断开） */
const hoverSeries = computed(() => {
  const versions = archive.value?.versions ?? []
  const byVersion = hoverAugment.value?.byVersion ?? {}
  return versions.map((v) => {
    const cell = byVersion[v]
    return { version: v, games: cell?.[0] ?? 0, wins: cell?.[1] ?? 0, has: !!cell }
  })
})

/** 走势卡 SVG 字符串（网格 + 金色虚线当前版本标记 + 平滑曲线 + 每点胜率数字） */
const hoverSvg = computed(() => {
  const series = hoverSeries.value
  if (series.length === 0 || !hoverAugment.value) {
    return ''
  }
  const { l, r, t, b } = TREND_PAD
  const W = TREND_W
  const H = TREND_H
  const n = series.length
  const x = (i: number): number => l + (n <= 1 ? 0 : (i * (W - l - r)) / (n - 1))
  const y = (v: number): number => t + (1 - v) * (H - t - b)
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`
  // 横向网格 + y 轴刻度（0/50/100%）
  for (const g of [0, 0.5, 1]) {
    s += `<line x1="${l}" y1="${y(g)}" x2="${W - r}" y2="${y(g)}" stroke="#3c2f14" opacity="${g === 0.5 ? 0.9 : 0.5}"/>`
    s += `<text x="${l - 6}" y="${y(g) + 4}" fill="#6d7c92" font-size="10" text-anchor="end">${g * 100}%</text>`
  }
  // 当前所选版本：金色虚线竖标
  const markerIdx = series.findIndex((p) => p.version === selectedVersion.value)
  if (markerIdx >= 0) {
    s += `<line x1="${x(markerIdx)}" y1="${t}" x2="${x(markerIdx)}" y2="${H - b}" stroke="#c8aa6e" stroke-width="1.2" stroke-dasharray="4 3" opacity="0.8"/>`
  }
  // x 轴版本标签（轻微旋转防重叠）
  series.forEach((p, i) => {
    s += `<text x="${x(i)}" y="${H - 8}" fill="${p.has ? '#6d7c92' : '#4a5568'}" font-size="10" text-anchor="middle" transform="rotate(-18 ${x(i)} ${H - 8})">${p.version}</text>`
  })
  // 平滑曲线：连续有数据的版本一段（Catmull-Rom 转 Bezier，张力 1/6）；空档断开
  const segs: Array<Array<{ idx: number; rate: number }>> = []
  let cur: Array<{ idx: number; rate: number }> = []
  series.forEach((p, i) => {
    if (!p.has || p.games === 0) {
      if (cur.length > 0) {
        segs.push(cur)
        cur = []
      }
      return
    }
    cur.push({ idx: i, rate: p.wins / p.games })
  })
  if (cur.length > 0) {
    segs.push(cur)
  }
  for (const seg of segs) {
    let d = ` M ${x(seg[0].idx)} ${y(seg[0].rate)}`
    for (let i = 0; i < seg.length - 1; i++) {
      const p0 = seg[Math.max(0, i - 1)]
      const p1 = seg[i]
      const p2 = seg[i + 1]
      const p3 = seg[Math.min(seg.length - 1, i + 2)]
      const x0 = x(p0.idx)
      const x1 = x(p1.idx)
      const x2 = x(p2.idx)
      const x3 = x(p3.idx)
      const c1x = x1 + (x2 - x0) / 6
      const c1y = y(p1.rate) + (y(p2.rate) - y(p0.rate)) / 6
      const c2x = x2 - (x3 - x1) / 6
      const c2y = y(p2.rate) - (y(p3.rate) - y(p1.rate)) / 6
      d += ` C ${c1x} ${c1y} ${c2x} ${c2y} ${x2} ${y(p2.rate)}`
    }
    s += `<path d="${d}" fill="none" stroke="#0ac8b9" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`
    // 数据点 + 每点胜率数字
    for (const point of seg) {
      s += `<circle cx="${x(point.idx)}" cy="${y(point.rate)}" r="3.5" fill="#0ac8b9" stroke="#0a1428" stroke-width="1.5"><title>${series[point.idx].version}：${Math.round(point.rate * 100)}%（${series[point.idx].games} 局 ${series[point.idx].wins} 胜）</title></circle>`
      s += `<text x="${x(point.idx)}" y="${y(point.rate) - 9}" fill="#0ac8b9" font-size="11" font-weight="bold" text-anchor="middle">${Math.round(point.rate * 100)}%</text>`
    }
  }
  s += '</svg>'
  return s
})

/** 组件卸载前兜底清理（走势卡是 fixed 定位，防泄漏） */
onBeforeUnmount(() => {
  hoverAugment.value = null
})
</script>

<template>
  <HexPageShell max-width="6xl">
    <!-- 页头：标题 + 口径行（覆盖率可观测性：白名单选错时看得见） -->
    <div class="pt-2 text-center">
      <div class="text-sm font-semibold uppercase tracking-[0.35em] text-hex-teal">Season Archive</div>
      <h1 class="mt-2 text-4xl font-black tracking-wider">
        <GoldText>赛季资料</GoldText>
      </h1>
      <p v-if="archive" class="mt-3 text-sm text-slate-400" data-testid="archive-coverage">
        样本：2400/2410/2450 队列 · 纳入 {{ archive.coverage.includedGames }} 局 ·
        队列命中但无强化数据 {{ archive.coverage.kiwiNoAugmentGames }} 局 ·
        队列外强化 {{ archive.coverage.outsideQueueAugmentRows }} 行 · 全库参与者行
      </p>
      <p class="mt-1 text-xs text-slate-500">
        出场率 = 持有次数 ÷ 该英雄对局数（一局最多 6 强化，同页之和远大于 100%，非选取率）
      </p>
      <div class="mt-3 flex items-center justify-center gap-3">
        <button
          class="border border-hex-line px-3 py-1 text-xs text-hex-gold transition hover:border-hex-gold"
          data-testid="go-season-report"
          @click="goSeasonReport"
        >
          → 赛季报告
        </button>
        <button
          class="border border-hex-line px-3 py-1 text-xs text-hex-gold transition hover:border-hex-gold"
          data-testid="go-home"
          @click="goHome"
        >
          → 主页
        </button>
      </div>
    </div>

    <!-- 错误 / 加载 / 空态 -->
    <div v-if="errorMsg" class="mt-8 border border-hex-line bg-hex-blue-2 p-6 text-center text-slate-300">
      <p data-testid="archive-error">{{ errorMsg }}</p>
    </div>
    <div v-else-if="loading" class="mt-8 border border-hex-line bg-hex-blue-2 p-6 text-center text-slate-300">
      <p data-testid="archive-loading">统计计算中…</p>
    </div>
    <div v-else-if="!archive || archive.champions.length === 0" class="mt-8 border border-hex-line bg-hex-blue-2 p-6 text-center text-slate-300">
      <p data-testid="archive-empty">暂无海克斯乱斗对局数据（需要至少一局带强化的 2400/2410/2450 队列对局）</p>
    </div>

    <!-- 主体：左英雄列表 + 右强化榜 -->
    <div v-else class="mt-6 flex items-start gap-4">
      <!-- 左列：英雄选择（按纳入对局数降序，来自后端） -->
      <HexPanel class="w-56 shrink-0 p-3">
        <div class="mb-2 text-sm font-bold text-hex-gold">选择英雄</div>
        <div class="flex flex-col gap-1">
          <button
            v-for="champ in archive.champions"
            :key="champ.championId"
            class="flex items-center gap-2 border px-2 py-1.5 text-left transition"
            :class="
              champ.championId === selectedChampionId
                ? 'border-hex-gold bg-hex-gold/15'
                : 'border-hex-line hover:border-hex-gold-3'
            "
            :data-testid="`champ-${champ.championId}`"
            @click="selectedChampionId = champ.championId"
          >
            <ChampionIcon :champion-id="champ.championId" :stretched="false" />
            <span class="min-w-0">
              <span class="block truncate text-[13px] text-slate-200">{{ champ.championName }}</span>
              <span class="block text-[11px] text-slate-500">{{ champ.games }} 局</span>
            </span>
          </button>
        </div>
      </HexPanel>

      <!-- 右列：版本切换 + 强化榜 -->
      <HexPanel class="min-w-0 flex-1 p-4" data-testid="augment-table-panel">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="text-lg font-bold">
            <GoldText>{{ selectedChampion?.championName }} · {{ selectedVersion }} 强化榜</GoldText>
          </h2>
          <!-- 版本 pills：选项动态取自后端（不硬编码），默认最新 -->
          <div class="flex flex-wrap gap-1.5" data-testid="version-pills">
            <button
              v-for="v in archive.versions"
              :key="v"
              class="rounded-full border px-2.5 py-0.5 text-xs transition"
              :class="
                v === selectedVersion
                  ? 'border-hex-gold bg-hex-gold/15 text-hex-gold-2'
                  : 'border-hex-line text-hex-gold/80 hover:border-hex-gold-3'
              "
              :data-testid="`version-${v}`"
              @click="switchVersion(v)"
            >
              {{ v }}
            </button>
          </div>
        </div>

        <table class="mt-3 w-full text-[15px]" data-testid="augment-table">
          <thead>
            <tr class="border-b border-hex-line text-left text-xs text-hex-gold">
              <th class="py-2 pl-1">强化</th>
              <th class="cursor-pointer select-none py-2" @click="sortKey = 'games'">
                局数{{ sortKey === 'games' ? ' ▼' : '' }}
              </th>
              <th class="cursor-pointer select-none py-2" @click="sortKey = 'winRate'">
                胜率{{ sortKey === 'winRate' ? ' ▼' : '' }}
              </th>
              <th class="cursor-pointer select-none py-2" @click="sortKey = 'appearanceRate'">
                出场率{{ sortKey === 'appearanceRate' ? ' ▼' : '' }}
              </th>
              <th class="py-2 pr-1 text-right">走势</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="aug in sortedAugments"
              :key="aug.augmentId"
              class="border-b border-hex-line/40 transition"
              :class="[
                aug.games < SMALL_SAMPLE_GAMES ? 'opacity-45' : '',
                hoverAugment?.augmentId === aug.augmentId ? 'bg-hex-gold/5' : 'hover:bg-hex-gold/5'
              ]"
              :data-testid="`aug-row-${aug.augmentId}`"
              @mouseenter="onRowEnter(aug, $event)"
              @mousemove="onRowMove"
              @mouseleave="onRowLeave"
            >
              <td class="py-2 pl-1">
                <span class="flex items-center gap-2">
                  <AugmentDisplay :augment-id="aug.augmentId" :size="28" />
                  <span class="min-w-0">{{ aug.augmentId }}</span>
                </span>
              </td>
              <td class="py-2 tabular-nums">
                {{ aug.games > 0 ? aug.games : '—' }}
                <span v-if="aug.games > 0" class="text-xs text-slate-500">{{ aug.wins }} 胜</span>
              </td>
              <td class="py-2 tabular-nums">
                <span class="text-hex-teal">{{ pct(aug.winRate, aug.games) }}</span>
              </td>
              <td class="py-2 tabular-nums">{{ pct(aug.appearanceRate, aug.games) }}</td>
              <td class="py-2 pr-1 text-right text-xs text-slate-500">◍ 悬停</td>
            </tr>
          </tbody>
        </table>
        <p class="mt-2 text-xs text-slate-500">
          局数 &lt; 3 的行降透明度并沉底 · 胜率 = 持有胜场 ÷ 持有局数 · 悬停行查看跨版本走势（金色虚线=当前版本）
        </p>
      </HexPanel>
    </div>

    <!-- 悬停走势卡（fixed 跟随鼠标；空档版本断线，当前版本金色虚线标记） -->
    <div
      v-if="hoverAugment"
      class="pointer-events-none fixed z-50 border border-hex-gold-3 bg-hex-blue-2 p-3 shadow-xl"
      :style="{ left: hoverX + 'px', top: hoverY + 'px' }"
      data-testid="trend-popover"
    >
      <div class="mb-1 text-xs text-hex-gold">
        强化 #{{ hoverAugment.augmentId }} · 跨版本胜率走势
      </div>
      <!-- eslint-disable-next-line vue/no-v-html —— SVG 由本组件纯函数生成（无外部输入注入面） -->
      <div v-html="hoverSvg"></div>
    </div>
  </HexPageShell>
</template>
