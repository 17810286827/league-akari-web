<script setup lang="ts">
/**
 * 战绩分析页面（League Akari 风格，接入真实后端数据）：
 * 顶部导航（段位板块+刷新）→ 左侧边栏（队列筛选/总览/英雄点数/最近队友对手）+ 右侧战绩列表
 * （原版折叠卡：轻量摘要渲染 MatchCardOverview，点击展开懒加载详情+时间线渲染 MatchCard 展开态）
 * 数据流：onMounted → listMatches 加载本页 → summary 直接传给 GameCardItem 渲染折叠卡；
 *         点击卡片 → getMatchDetail + getMatchTimeline 并行懒加载 → 注入展开态（组件内缓存已加载详情）
 */
import { computed, onMounted, ref, watch } from 'vue'
import { NSpin, useMessage } from 'naive-ui'

import { getMatchDetail, listMatches } from '@/api/matches'
import type { MatchDetail, MatchSummary, RecentOpponent } from '@/api/types'
import { createLogger } from '@/utils/logger'

import { computeOverview, computeRecentTeammates, mapRecentOpponents } from './adapter'
import GameCardItem from './GameCardItem.vue'
import SidebarPanel from './SidebarPanel.vue'
import TopNavBar from './TopNavBar.vue'
import type { GameListItem, GameStatsData, RankSection } from './types'

const logger = createLogger('GameStats')
// 全局消息提示（App.vue 已注册 NMessageProvider）
const message = useMessage()

/** 每页条数（契约固定 20） */
const PAGE_SIZE = 20

/** 顶部段位板块：无数据源，保持"未定级"展示（契约第 5 节） */
const rankSections: RankSection[] = [
  { queue: '单双排位', tier: '未定级', highestTier: '最高 未定级' },
  { queue: '灵活排位', tier: '未定级', highestTier: '最高 未定级' }
]

// 列表状态：本页原始摘要、总条数、加载中、错误提示
const matches = ref<MatchSummary[]>([])
const total = ref(0)
const loading = ref(false)
const errorMsg = ref('')

// 交互状态：当前队列（null 为所有模式）、当前页、展开的对局、侧栏折叠
const activeQueueId = ref<number | null>(null)
const page = ref(1)
// 展开对局 ID：同一时刻至多展开一局（与详情页单局语义一致）
const expandedGameId = ref<number | null>(null)
// 侧栏折叠态：小屏默认收起，由折叠按钮切换
const sidebarCollapsed = ref(false)
// 最近对手：后端列表接口聚合结果（列表查询时即返回，不依赖展开详情）
const recentOpponents = ref<RecentOpponent[]>([])

/** 详情懒加载缓存项：真实详情（时间线 Tab 已移除，不再加载 /timeline） */
interface DetailCacheEntry {
  detail: MatchDetail
}

// 详情懒加载：转换结果缓存（避免重复请求）
// 缓存以 gameId 为键：展开过的对局再次展开直接命中，不再请求后端
const detailCache = ref(new Map<number, DetailCacheEntry>())
// 展开态加载中标记：首次展开时置 true，详情面板就绪前保留折叠卡
const detailLoading = ref(false)

/**
 * 卡片列表：摘要直传折叠卡（不重复适配，MatchCardOverview 内部消费轻量 participants）；
 * 后端未升级（participants 缺失）的对局被过滤，避免渲染空卡；
 * 已加载的详情按 gameId 注入列表项，展开态直接展示
 */
const games = computed<GameListItem[]>(() =>
  matches.value
    .filter((summary) => (summary.participants ?? []).length > 0)
    .map((summary) => ({
      summary,
      detail: detailCache.value.get(summary.gameId)?.detail ?? null,
      details: null
    }))
)

/**
 * 侧栏数据：总览/最近队友/最近对手均从当前页数据实时聚合；
 * 英雄点数无数据源为空列表；渲染由 SidebarPanel 独立完成，与列表改造解耦
 */
const sidebarData = computed<GameStatsData>(() => ({
  rankSections,
  overview: computeOverview(matches.value),
  recentTeammates: computeRecentTeammates(matches.value),
  recentOpponents: mapRecentOpponents(recentOpponents.value)
}))

/**
 * 加载当前页对局列表（分页 + 队列过滤均在后端完成）
 * 失败时清空列表并给出错误提示，页面展示空态（不降级到 mock 数据）
 * @returns Promise<void>：加载完成后由 loading 状态驱动 UI 切换
 */
async function loadMatches(): Promise<void> {
  // 每次加载前重置加载态与错误信息，避免上一次的失败提示残留
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await listMatches({
      page: page.value,
      pageSize: PAGE_SIZE,
      queueId: activeQueueId.value ?? undefined
    })
    matches.value = res.data
    total.value = res.total
    // 最近对手：后端列表接口聚合结果（列表查询时即返回）
    recentOpponents.value = res.recentOpponents ?? []
    logger.info('Loaded match list', { page: page.value, total: res.total, count: res.data.length })
  } catch (error) {
    // 列表加载失败：记录日志并提示用户，列表置空展示空态
    logger.error('Failed to load match list', error)
    matches.value = []
    total.value = 0
    errorMsg.value = '对局列表加载失败，请确认后端服务已启动'
    message.error(errorMsg.value)
  } finally {
    loading.value = false
  }
}

/**
 * 点击卡片：展开/收起该局详情
 * 首次展开时懒加载 getMatchDetail（展开详情已精简为"总览"，时间线 Tab 移除，
 * 不再请求 /timeline 接口），转换结果缓存复用；详情失败则收起并提示
 */
async function toggleGame(gameId: number): Promise<void> {
  // 已展开的对局再次点击 → 收起
  if (expandedGameId.value === gameId) {
    expandedGameId.value = null
    return
  }
  expandedGameId.value = gameId
  // 命中缓存直接展示，不再请求后端（同时清理竞态可能残留的过期 loading）
  if (detailCache.value.has(gameId)) {
    detailLoading.value = false
    return
  }
  detailLoading.value = true
  try {
    const detail = await getMatchDetail(gameId)
    // 归属校验：await 期间用户可能已切换展开目标（点 A 后立即点 B），
    // 过期响应不得再改动展开状态（误收起新目标）或复位新目标的 loading
    if (expandedGameId.value !== gameId) {
      return
    }
    // 写入缓存：折叠卡/展开态共用，收起再展开零请求
    detailCache.value.set(gameId, { detail })
    logger.info('Loaded match detail', { gameId })
  } catch (error) {
    // 详情失败：展开态无数据可展示，收起卡片并弹出错误提示
    if (expandedGameId.value !== gameId) {
      return
    }
    logger.error('Failed to load match detail', { gameId, error })
    message.error(`对局 ${gameId} 详情加载失败`)
    expandedGameId.value = null
    detailLoading.value = false
  } finally {
    // 归属校验：仅当本请求仍是当前展开目标时复位 loading（过期请求不得复位新目标的 loading）
    if (expandedGameId.value === gameId) {
      detailLoading.value = false
    }
  }
}

/** 刷新按钮：重新加载当前页列表 */
function handleRefresh(): void {
  logger.info('Refresh clicked')
  loadMatches()
}

// 队列切换：回到第一页并重新加载（后端按 queueId 过滤）
watch(activeQueueId, () => {
  page.value = 1
  loadMatches()
})

// 分页变化：重新加载对应页（初始 onMounted 已加载，无需 immediate）
watch(page, (next, prev) => {
  if (next !== prev) {
    loadMatches()
  }
})

// 页面挂载后加载第一页真实数据
onMounted(() => {
  loadMatches()
})
</script>

<template>
  <div class="game-stats">
    <!-- 顶部导航：段位板块 + 刷新按钮（数据源缺失时保持"未定级"） -->
    <TopNavBar :sections="rankSections" @refresh="handleRefresh" />

    <div class="body">
      <!-- 侧栏折叠按钮：小屏可见，点击展开/收起侧栏 -->
      <button
        type="button"
        class="collapse-btn"
        :class="{ 'collapse-btn-open': sidebarCollapsed }"
        @click="sidebarCollapsed = !sidebarCollapsed"
      >
        {{ sidebarCollapsed ? '展开侧栏' : '收起侧栏' }}
      </button>

      <!-- 左侧边栏：小屏可折叠（队列筛选/总览/英雄点数/最近队友对手） -->
      <div v-show="!sidebarCollapsed" class="sidebar-wrap">
        <SidebarPanel
          :data="sidebarData"
          :total="total"
          v-model:queue="activeQueueId"
          v-model:page="page"
        />
      </div>

      <!-- 右侧主内容区：原版折叠卡列表（加载中显示 n-spin 遮罩；展开详情懒加载） -->
      <main class="main">
        <n-spin :show="loading">
          <div class="game-list">
            <GameCardItem
              v-for="game in games"
              :key="game.summary.gameId"
              :game="game"
              :expanded="expandedGameId === game.summary.gameId"
              :detail-loading="detailLoading && expandedGameId === game.summary.gameId"
              @toggle="toggleGame"
            />
            <!-- 空态：加载失败显示错误提示，否则为无数据提示 -->
            <p v-if="!loading && games.length === 0" class="empty">
              {{ errorMsg || '该队列下暂无对局记录' }}
            </p>
          </div>
        </n-spin>
      </main>
    </div>
  </div>
</template>

<style lang="scss">
/* 电竞终端主题变量（用户选定 B 方案：近黑底 + 霓虹紫主色 + 玫红强调，
   与全局 tailwind/opgg 令牌一致） */
.game-stats {
  --bg: #09090b;
  --surface: #0e0e13;
  --surface-hover: #16151d;
  --surface-active: #1d1c26;
  --border: #2e2440;
  --border-strong: #3e2f5c;
  --text: #f4f2fa;
  --text-muted: #a6acbf;
  --primary: #7c3aed;
  --primary-2: #a78bfa;
  --accent: #f43f5e;
  --win: #4b7be5;
  --loss: #e03e52;
  --gold: #c8aa6e;
  --radius: 8px;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.4);

  min-height: 100vh;
  /* 近黑底 + 顶部微紫光晕（夜晚竞技场氛围，不抢数据内容） */
  background:
    radial-gradient(1200px 500px at 50% -10%, rgba(124, 58, 237, 0.14), transparent 65%),
    var(--bg);
  color: var(--text);
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
}
</style>

<style lang="scss" scoped>
/* 页面主体：侧栏 + 主内容区（宽屏并排，小屏侧栏默认隐藏） */
.body {
  display: flex;
  align-items: flex-start;
  /* 加宽至 1400px：详情表格列与卡片数据留足空间（原 1152px 在加列后偏挤） */
  max-width: 1400px;
  margin: 0 auto;
}

/* 侧栏折叠按钮：小屏可见，宽屏隐藏 */
.collapse-btn {
  display: none;
  margin: 12px;
  padding: 6px 12px;
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
}

/* 侧栏容器：不参与弹性收缩，保持 300px 固定宽度 */
.sidebar-wrap {
  flex-shrink: 0;
}

/* 主内容区：战绩列表纵向排列，宽度自适应剩余空间 */
.main {
  flex: 1;
  min-width: 0;
  padding: 12px;
}

/* 列表容器：折叠卡纵向排列，卡片间距 14px（卡片加高后保持呼吸感） */
.game-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* 空态提示：加载失败错误信息或无数据占位文案 */
.empty {
  padding: 40px 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

/* 小屏：侧栏默认隐藏，通过按钮展开 */
@media (max-width: 900px) {
  .collapse-btn {
    display: block;
  }

  .sidebar-wrap {
    display: none;

    /* 侧栏展开时覆盖在列表上方 */
    .sidebar {
      position: fixed;
      top: 60px;
      bottom: 0;
      left: 0;
      z-index: 10;
      overflow-y: auto;
      background: var(--bg);
    }
  }
}
</style>
