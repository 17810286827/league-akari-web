<script setup lang="ts">
/**
 * 战绩分析页面（League Akari 风格，接入真实后端数据）：
 * 顶部导航（段位板块+刷新）→ 左侧边栏（队列筛选/总览/英雄点数/最近队友对手）+ 右侧战绩列表（卡片可展开双队详情）
 * 数据流：onMounted → listMatches 加载本页 → adapter 转 GameCard 渲染；
 *         点击卡片 → getMatchDetail 懒加载详情 → adapter 转 TeamDetail 展开（组件内缓存已加载详情）
 */
import { computed, onMounted, ref, watch } from 'vue'
import { NSpin, useMessage } from 'naive-ui'

import { getMatchDetail, listMatches } from '@/api/matches'
import type { MatchDetail, MatchSummary } from '@/api/types'
import { createLogger } from '@/utils/logger'

import {
  computeOverview,
  computeRecentOpponents,
  computeRecentTeammates,
  detailToGameDetail,
  QUEUE_OPTIONS,
  summaryToCard
} from './adapter'
import GameCardItem from './GameCardItem.vue'
import SidebarPanel from './SidebarPanel.vue'
import TopNavBar from './TopNavBar.vue'
import type { GameDetail, GameStatsData, RankSection } from './types'

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
const expandedGameId = ref<number | null>(null)
const sidebarCollapsed = ref(false)

// 详情懒加载：转换结果缓存（避免重复请求）与原始详情列表（供最近对手聚合）
const detailCache = ref(new Map<number, GameDetail>())
const detailLoading = ref(false)
const loadedDetails = ref<MatchDetail[]>([])

/** 当前页用户 PUUID（每局一致，取第一局用于对手聚合定位本队） */
const selfPuuid = computed(() => matches.value[0]?.selfPuuid ?? '')

/** 卡片列表：摘要转卡片；契约增强字段缺失的对局被过滤；已加载详情注入卡片 */
const games = computed(() =>
  matches.value
    .map(summaryToCard)
    .filter((card): card is NonNullable<typeof card> => card !== null)
    .map((card) => ({ ...card, detail: detailCache.value.get(card.gameId) ?? null }))
)

/** 侧栏数据：总览/最近队友/最近对手均从当前页数据实时聚合；英雄点数无数据源为空列表 */
const sidebarData = computed<GameStatsData>(() => ({
  rankSections,
  overview: computeOverview(matches.value),
  championPoints: [],
  recentTeammates: computeRecentTeammates(matches.value),
  recentOpponents: computeRecentOpponents(loadedDetails.value, selfPuuid.value),
  games: games.value
}))

/**
 * 加载当前页对局列表（分页 + 队列过滤均在后端完成）
 * 失败时清空列表并给出错误提示，页面展示空态（不降级到 mock 数据）
 */
async function loadMatches(): Promise<void> {
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
 * 首次展开时调用 getMatchDetail 懒加载，转换结果缓存复用；加载失败则收起并提示
 */
async function toggleGame(gameId: number): Promise<void> {
  // 已展开的对局再次点击 → 收起
  if (expandedGameId.value === gameId) {
    expandedGameId.value = null
    return
  }
  expandedGameId.value = gameId
  // 命中缓存直接展示，不再请求后端
  if (detailCache.value.has(gameId)) {
    return
  }
  detailLoading.value = true
  try {
    const detail = await getMatchDetail(gameId)
    detailCache.value.set(gameId, detailToGameDetail(detail))
    // 记录原始详情，供"最近对手"聚合逐步完善
    loadedDetails.value = [...loadedDetails.value, detail]
    logger.info('Loaded match detail', { gameId })
  } catch (error) {
    logger.error('Failed to load match detail', { gameId, error })
    message.error(`对局 ${gameId} 详情加载失败`)
    expandedGameId.value = null
  } finally {
    detailLoading.value = false
  }
}

/** 刷新按钮：重新加载当前页列表 */
function handleRefresh(): void {
  logger.info('Refresh clicked')
  loadMatches()
}

/** 查看更多（英雄点数占位：当前无数据源） */
function handleViewMore(): void {
  logger.info('View more champion points clicked (placeholder)')
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
    <!-- 顶部导航 -->
    <TopNavBar :sections="rankSections" @refresh="handleRefresh" />

    <div class="body">
      <!-- 侧栏折叠按钮（小屏） -->
      <button
        type="button"
        class="collapse-btn"
        :class="{ 'collapse-btn-open': sidebarCollapsed }"
        @click="sidebarCollapsed = !sidebarCollapsed"
      >
        {{ sidebarCollapsed ? '展开侧栏' : '收起侧栏' }}
      </button>

      <!-- 左侧边栏：小屏可折叠 -->
      <div v-show="!sidebarCollapsed" class="sidebar-wrap">
        <SidebarPanel
          :data="sidebarData"
          :total="total"
          v-model:queue="activeQueueId"
          v-model:page="page"
          @view-more="handleViewMore"
        />
      </div>

      <!-- 右侧主内容区：战绩列表（加载中显示 n-spin 遮罩） -->
      <main class="main">
        <n-spin :show="loading">
          <div class="game-list">
            <GameCardItem
              v-for="game in games"
              :key="game.gameId"
              :game="game"
              :expanded="expandedGameId === game.gameId"
              :detail-loading="detailLoading && expandedGameId === game.gameId"
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
/* 深色主题变量（League Akari 风格：近 #1e1e1e 背景） */
.game-stats {
  --bg: #1e1e1e;
  --surface: #262626;
  --surface-hover: #2e2e2e;
  --surface-active: #3a3a3a;
  --border: #3a3a3a;
  --text: #f0f0f0;
  --text-muted: #9a9a9a;
  --win: #3b82f6;
  --loss: #ef4444;
  --surrender: #6b7280;
  --gold: #f59e0b;
  --radius: 8px;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.4);

  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
}
</style>

<style lang="scss" scoped>
/* 页面主体：侧栏 + 主内容区 */
.body {
  display: flex;
  align-items: flex-start;
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

.sidebar-wrap {
  flex-shrink: 0;
}

/* 主内容区：战绩列表纵向排列 */
.main {
  flex: 1;
  min-width: 0;
  padding: 12px;
}

.game-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

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
