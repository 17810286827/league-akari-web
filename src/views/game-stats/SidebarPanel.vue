<script setup lang="ts">
/**
 * 左侧边栏：队列筛选区 + 英雄筛选区 + 总览统计区 + 最近队友区 + 最近对手区
 * 队列/英雄筛选（真实 queueId / championId）与父组件同步；数据均来自父组件聚合结果
 * （召唤师查询已移至页面顶部居中搜索栏，分页已移至战绩列表底部）
 */
import { onMounted, ref, computed } from 'vue'

import { championIconUrl } from '@/utils/icon-url'
import { listChampionOptions, type ChampionOption } from '@/utils/game-resource'

import { QUEUE_OPTIONS } from './adapter'
import type { GameStatsData, OverviewStats, RecentPlayer } from './types'

// 页面数据（props 注入）与后端总条数；具名引用供模板函数使用
const props = defineProps<{ data: GameStatsData; total: number }>()

// 队列筛选（下拉框，值为后端 queueId，null 为所有模式）
const queue = defineModel<number | null>('queue', { default: null })
// 英雄筛选（下拉框，值为后端 championId，null 为所有英雄）：过滤该玩家本局使用此英雄的对局
const champion = defineModel<number | null>('champion', { default: null })

// ---- 英雄筛选下拉数据源 ----

/** 全量英雄选项（CDragon champion-summary 加载，id 升序） */
const championOptions = ref<ChampionOption[]>([])
/** 英雄搜索框输入（按中文名过滤下拉选项，避免 160+ 选项长列表滚动） */
const championSearch = ref('')

/** 过滤后的英雄选项：按本名/称号包含匹配（不区分大小写），无输入时展示全量 */
const filteredChampionOptions = computed(() => {
  const keyword = championSearch.value.trim().toLowerCase()
  if (!keyword) return championOptions.value
  return championOptions.value.filter((option) => option.label.toLowerCase().includes(keyword))
})

// 挂载时加载英雄选项（失败静默：下拉仅剩"所有英雄"单项，不影响其它筛选）
onMounted(async () => {
  championOptions.value = await listChampionOptions()
})

/** 总览统计字段配置：标签 + 取值函数 + 是否百分比；百分比项渲染 mini 渐变进度条 */
const overviewItems: {
  label: string
  value: (o: OverviewStats) => string
  percent?: boolean
  /** 进度条数值（0-100），仅百分比项使用 */
  progress?: (o: OverviewStats) => number
}[] = [
  { label: 'Akari Score', value: (o) => (o.akariScore === null ? '-' : String(o.akariScore)) },
  { label: '平均KDA', value: (o) => o.avgKda.toFixed(2) },
  {
    label: '参团率',
    value: (o) => `${o.participation}%`,
    percent: true,
    progress: (o) => o.participation
  },
  {
    label: '伤害比',
    value: (o) => `${o.damageShare}%`,
    percent: true,
    progress: (o) => o.damageShare
  },
  {
    label: '承伤比',
    value: (o) => `${o.damageTakenShare}%`,
    percent: true,
    progress: (o) => o.damageTakenShare
  },
  {
    label: '经济比',
    value: (o) => `${o.goldShare}%`,
    percent: true,
    progress: (o) => o.goldShare
  },
  { label: '补刀/分', value: (o) => o.csPerMin.toFixed(1) },
  { label: '胜负', value: (o) => `${o.wins}胜${o.losses}负` }
]
</script>

<template>
  <aside class="sidebar">
    <!-- 一、筛选区：队列 + 英雄（两者叠加生效，切换由父组件触发重新加载） -->
    <section class="panel">
      <div class="filter-row">
        <select v-model="queue" class="queue-select">
          <option v-for="option in QUEUE_OPTIONS" :key="option.label" :value="option.queueId">
            {{ option.label }}
          </option>
        </select>
      </div>
      <div class="filter-row">
        <!-- 英雄搜索框：输入中文名过滤下拉选项（英雄 160+，无搜索的长列表不可用） -->
        <input
          v-model="championSearch"
          type="text"
          class="champion-search"
          placeholder="搜索英雄名筛选对局"
        />
      </div>
      <div class="filter-row">
        <select v-model="champion" class="queue-select">
          <!-- null 显式选中"所有英雄"（点击已选中的选项不触发 change，需占位项兜底） -->
          <option :value="null">所有英雄</option>
          <option v-for="option in filteredChampionOptions" :key="option.id" :value="option.id">
            {{ option.label }}
          </option>
        </select>
      </div>
    </section>

    <!-- 二、总览统计区 -->
    <section class="panel">
      <h3 class="panel-title">总览统计</h3>
      <div class="overview-grid">
        <div v-for="item in overviewItems" :key="item.label" class="overview-item">
          <p class="overview-label">{{ item.label }}</p>
          <!-- 百分比项：紫→亮紫渐变 mini 进度条（数据可视化） -->
          <template v-if="item.progress">
            <div class="mini-bar">
              <div class="mini-bar-fill" :style="{ width: `${item.progress(data.overview)}%` }"></div>
            </div>
          </template>
          <p class="overview-value" :class="{ 'overview-value-accent': item.percent }">
            {{ item.value(data.overview) }}
          </p>
        </div>
      </div>
      <!-- 阵容分布：常用英雄头像小网格（top5，无数据时不渲染） -->
      <div v-if="data.overview.lineupChampionIds.length > 0" class="lineup">
        <img
          v-for="championId in data.overview.lineupChampionIds"
          :key="championId"
          :src="championIconUrl(championId)"
          alt="常用英雄"
          class="lineup-icon"
        />
      </div>
    </section>

    <!-- 三、最近队友区（从本页对局 teammates 聚合） -->
    <section class="panel">
      <h3 class="panel-title">最近队友</h3>
      <ul v-if="data.recentTeammates.length > 0" class="recent-list">
        <li v-for="player in data.recentTeammates" :key="player.puuid" class="recent-item">
          <img :src="championIconUrl(player.championId)" :alt="player.name" class="recent-avatar" />
          <div class="recent-info">
            <p class="recent-name">{{ player.name }} <span class="recent-tag">#{{ player.tagLine }}</span></p>
            <p class="recent-record">{{ player.wins }}胜{{ player.losses }}负</p>
          </div>
        </li>
      </ul>
      <p v-else class="empty-tip">暂无数据</p>
    </section>

    <!-- 五、最近对手区（从已展开的详情聚合，随展开对局增多而完善） -->
    <section class="panel">
      <h3 class="panel-title">最近对手</h3>
      <ul v-if="data.recentOpponents.length > 0" class="recent-list">
        <li v-for="player in data.recentOpponents" :key="player.puuid" class="recent-item">
          <img :src="championIconUrl(player.championId)" :alt="player.name" class="recent-avatar" />
          <div class="recent-info">
            <p class="recent-name">{{ player.name }} <span class="recent-tag">#{{ player.tagLine }}</span></p>
            <p class="recent-record">{{ player.wins }}胜{{ player.losses }}负</p>
          </div>
        </li>
      </ul>
      <p v-else class="empty-tip">暂无数据</p>
    </section>
  </aside>
</template>

<style lang="scss" scoped>
/* 左侧边栏：垂直功能块，卡片风格 */
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 310px;
  padding: 12px;
}

/* 通用面板卡片：绿调描边，hover 提亮 */
.panel {
  padding: 12px;
  border-radius: var(--radius);
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  transition: border-color 0.15s, background-color 0.15s;

  &:hover {
    border-color: var(--border-strong);
  }
}

/* 面板标题：左侧 3px 柔和绿标记（签名元素延伸） */
.panel-title {
  margin-bottom: 10px;
  padding-left: 8px;
  border-left: 3px solid var(--primary);
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
}

/* 无数据空态提示 */
.empty-tip {
  padding: 10px 0;
  text-align: center;
  font-size: 15px;
  color: var(--text-muted);
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
  font-size: 16px;
}

/* 英雄搜索框：与队列下拉同规格（宽度 100%，与筛选行对齐） */
.champion-search {
  flex: 1;
  padding: 6px 8px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface-hover);
  color: var(--text);
  font-size: 15px;

  &::placeholder {
    color: var(--text-muted);
  }
}

.filter-btn {
  width: 100%;
  padding: 6px 0;
  border-radius: var(--radius);
  background: var(--surface-hover);
  color: var(--text);
  font-size: 16px;
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
  font-size: 14px;
  color: var(--text-muted);
}

/* mini 进度条：紫→亮紫渐变（数据可视化，百分比项专用） */
.mini-bar {
  height: 3px;
  margin: 4px auto 2px;
  width: 80%;
  border-radius: 2px;
  background: var(--surface-active);
  overflow: hidden;
}

.mini-bar-fill {
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--primary), var(--primary-2));
  transition: width 0.3s ease;
}

.overview-value {
  font-size: 19px;
  font-weight: 700;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

/* 百分比字段用柔和绿强调 */
.overview-value-accent {
  color: var(--primary-2);
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

/* 三、四、最近队友/对手 */
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
  font-size: 16px;
  color: var(--text);
}

.recent-tag {
  font-size: 14px;
  color: var(--text-muted);
}

.recent-record {
  font-size: 14px;
  color: var(--text-muted);
}
</style>
