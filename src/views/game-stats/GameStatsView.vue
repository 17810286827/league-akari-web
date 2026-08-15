<script setup lang="ts">
/**
 * 战绩分析页面（League Akari 风格）：
 * 顶部导航（段位板块+刷新）→ 左侧边栏（队列筛选/总览/英雄点数/最近队友对手）+ 右侧战绩列表（卡片可展开双队详情）
 * 交互：队列下拉过滤、分页（每页 20 项）、卡片展开收起（动画）、侧栏小屏折叠、"查看更多"占位
 */
import { computed, ref } from 'vue'

import { createLogger } from '@/utils/logger'

import GameCardItem from './GameCardItem.vue'
import { mockGameStats } from './mockData'
import SidebarPanel from './SidebarPanel.vue'
import TopNavBar from './TopNavBar.vue'

const logger = createLogger('GameStats')

// 页面数据（mock；后续接入后端时替换为异步加载）
const data = mockGameStats

// 交互状态：队列筛选、当前页、展开的对局、侧栏折叠
const activeQueue = ref<string>('所有模式')
const page = ref(1)
const expandedGameId = ref<number | null>(null)
const sidebarCollapsed = ref(false)

/** 每页条数（参考图固定 20） */
const PAGE_SIZE = 20

/** 按队列过滤后的对局列表（'所有模式' 不过滤） */
const filteredGames = computed(() => {
  if (activeQueue.value === '所有模式') {
    return data.games
  }
  return data.games.filter((game) => game.queueMode === activeQueue.value)
})

/** 当前页切片 */
const pagedGames = computed(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filteredGames.value.slice(start, start + PAGE_SIZE)
})

/** 点击卡片：展开/收起该局详情 */
function toggleGame(gameId: number): void {
  expandedGameId.value = expandedGameId.value === gameId ? null : gameId
}

/** 刷新按钮（占位：重新加载数据） */
function handleRefresh(): void {
  logger.info('Refresh clicked (placeholder)')
}

/** 查看更多（英雄点数详情页占位） */
function handleViewMore(): void {
  logger.info('View more champion points clicked (placeholder)')
}
</script>

<template>
  <div class="game-stats">
    <!-- 顶部导航 -->
    <TopNavBar :sections="data.rankSections" @refresh="handleRefresh" />

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
          :data="data"
          v-model:queue="activeQueue"
          v-model:page="page"
          @view-more="handleViewMore"
        />
      </div>

      <!-- 右侧主内容区：战绩列表 -->
      <main class="main">
        <div class="game-list">
          <GameCardItem
            v-for="game in pagedGames"
            :key="game.gameId"
            :game="game"
            :expanded="expandedGameId === game.gameId"
            @toggle="toggleGame"
          />
          <!-- 筛选后无对局空态 -->
          <p v-if="pagedGames.length === 0" class="empty">该模式下暂无对局记录</p>
        </div>
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
