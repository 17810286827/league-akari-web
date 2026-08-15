<script setup lang="ts">
/**
 * 左侧边栏：队列筛选区 + 总览统计区 + 英雄点数区 + 最近队友区 + 最近对手区
 * 队列筛选与分页通过 v-model 与父组件同步；"查看更多"为占位跳转
 */
import { championIconUrl } from '@/utils/icon-url'

import { queueFilterOptions } from './mockData'
import type { ChampionPoint, GameStatsData, OverviewStats, RecentPlayer } from './types'

// 页面数据（props 注入）
defineProps<{ data: GameStatsData }>()

// 队列筛选（下拉框）与当前页（分页控件）
const queue = defineModel<string>('queue', { default: '所有模式' })
const page = defineModel<number>('page', { default: 1 })

// 事件：查看更多（英雄点数占位跳转）
const emit = defineEmits<{ viewMore: [] }>()

/** 每页条数（参考图固定 20） */
const PAGE_SIZE = 20

/** 总览统计字段配置：标签 + 取值函数 + 是否百分比 */
const overviewItems: { label: string; value: (o: OverviewStats) => string; percent?: boolean }[] = [
  { label: 'Akari Score', value: (o) => String(o.akariScore) },
  { label: '平均KDA', value: (o) => o.avgKda.toFixed(2) },
  { label: '参团率', value: (o) => `${o.participation}%`, percent: true },
  { label: '伤害比', value: (o) => `${o.damageShare}%`, percent: true },
  { label: '承伤比', value: (o) => `${o.damageTakenShare}%`, percent: true },
  { label: '经济比', value: (o) => `${o.goldShare}%`, percent: true },
  { label: '补刀/分', value: (o) => o.csPerMin.toFixed(1) },
  { label: '胜负', value: (o) => `${o.wins}胜${o.losses}负` }
]

/** 英雄点数千分位格式化 */
function formatPoints(points: number): string {
  return points.toLocaleString()
}
</script>

<template>
  <aside class="sidebar">
    <!-- 一、队列筛选区 -->
    <section class="panel">
      <div class="filter-row">
        <select v-model="queue" class="queue-select">
          <option v-for="option in queueFilterOptions" :key="option" :value="option">
            {{ option }}
          </option>
        </select>
        <!-- 分页控件：条数 + 左右箭头 -->
        <div class="pager">
          <span class="pager-count">{{ data.games.length }}项</span>
          <button type="button" class="pager-btn" :disabled="page <= 1" @click="page -= 1">‹</button>
          <button type="button" class="pager-btn" :disabled="page * PAGE_SIZE >= data.games.length" @click="page += 1">›</button>
        </div>
      </div>
      <button type="button" class="filter-btn">页内筛选</button>
    </section>

    <!-- 二、总览统计区 -->
    <section class="panel">
      <h3 class="panel-title">总览统计</h3>
      <div class="overview-grid">
        <div v-for="item in overviewItems" :key="item.label" class="overview-item">
          <p class="overview-label">{{ item.label }}</p>
          <p class="overview-value" :class="{ 'overview-value-accent': item.percent }">
            {{ item.value(data.overview) }}
          </p>
        </div>
      </div>
      <!-- 阵容分布：常用英雄头像小网格 -->
      <div class="lineup">
        <img
          v-for="championId in data.overview.lineupChampionIds"
          :key="championId"
          :src="championIconUrl(championId)"
          alt="常用英雄"
          class="lineup-icon"
        />
      </div>
    </section>

    <!-- 三、英雄点数区 -->
    <section class="panel">
      <div class="panel-header">
        <h3 class="panel-title">英雄点数</h3>
        <button type="button" class="more-btn" @click="emit('viewMore')">查看更多</button>
      </div>
      <ul class="champion-list">
        <li v-for="champion in data.championPoints" :key="champion.championId" class="champion-item">
          <img
            :src="championIconUrl(champion.championId)"
            :alt="champion.name"
            class="champion-avatar"
          />
          <div class="champion-info">
            <p class="champion-name">{{ champion.name }}</p>
            <p class="champion-level">{{ champion.level }}级</p>
          </div>
          <p class="champion-points">{{ formatPoints(champion.points) }}点</p>
        </li>
      </ul>
    </section>

    <!-- 四、最近队友区 -->
    <section class="panel">
      <h3 class="panel-title">最近队友</h3>
      <ul class="recent-list">
        <li v-for="player in data.recentTeammates" :key="player.puuid" class="recent-item">
          <img :src="championIconUrl(player.championId)" :alt="player.name" class="recent-avatar" />
          <div class="recent-info">
            <p class="recent-name">{{ player.name }} <span class="recent-tag">#{{ player.tagLine }}</span></p>
            <p class="recent-record">{{ player.wins }}胜{{ player.losses }}负</p>
          </div>
        </li>
      </ul>
    </section>

    <!-- 五、最近对手区 -->
    <section class="panel">
      <h3 class="panel-title">最近对手</h3>
      <ul class="recent-list">
        <li v-for="player in data.recentOpponents" :key="player.puuid" class="recent-item">
          <img :src="championIconUrl(player.championId)" :alt="player.name" class="recent-avatar" />
          <div class="recent-info">
            <p class="recent-name">{{ player.name }} <span class="recent-tag">#{{ player.tagLine }}</span></p>
            <p class="recent-record">{{ player.wins }}胜{{ player.losses }}负</p>
          </div>
        </li>
      </ul>
    </section>
  </aside>
</template>

<style lang="scss" scoped>
/* 左侧边栏：垂直功能块，卡片风格 */
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 300px;
  padding: 12px;
}

/* 通用面板卡片 */
.panel {
  padding: 12px;
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow);
}

.panel-title {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* 一、队列筛选 */
.filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.queue-select {
  flex: 1;
  padding: 6px 8px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface-hover);
  color: var(--text);
  font-size: 13px;
}

.pager {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pager-count {
  font-size: 12px;
  color: var(--text-muted);
}

.pager-btn {
  width: 24px;
  height: 24px;
  border-radius: var(--radius);
  background: var(--surface-hover);
  color: var(--text);
  transition: background-color 0.15s;

  &:hover:not(:disabled) {
    background: var(--surface-active);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.filter-btn {
  width: 100%;
  padding: 6px 0;
  border-radius: var(--radius);
  background: var(--surface-hover);
  color: var(--text);
  font-size: 13px;
  transition: background-color 0.15s;

  &:hover {
    background: var(--surface-active);
  }
}

/* 二、总览统计 */
.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.overview-item {
  text-align: center;
}

.overview-label {
  font-size: 11px;
  color: var(--text-muted);
}

.overview-value {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}

/* 百分比字段用蓝色强调 */
.overview-value-accent {
  color: var(--win);
}

.lineup {
  display: flex;
  gap: 4px;
  margin-top: 10px;
}

.lineup-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--border);
}

/* 三、英雄点数 */
.more-btn {
  font-size: 12px;
  color: var(--win);

  &:hover {
    text-decoration: underline;
  }
}

.champion-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.champion-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.champion-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
}

.champion-info {
  flex: 1;
}

.champion-name {
  font-size: 13px;
  color: var(--text);
}

.champion-level {
  font-size: 11px;
  color: var(--text-muted);
}

.champion-points {
  font-size: 12px;
  color: var(--gold);
  font-weight: 600;
}

/* 四、五、最近队友/对手 */
.recent-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recent-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.recent-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
}

.recent-name {
  font-size: 13px;
  color: var(--text);
}

.recent-tag {
  font-size: 11px;
  color: var(--text-muted);
}

.recent-record {
  font-size: 11px;
  color: var(--text-muted);
}
</style>
