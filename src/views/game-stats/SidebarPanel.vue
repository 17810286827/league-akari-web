<script setup lang="ts">
/**
 * 左侧边栏：队列筛选区 + 英雄筛选区（实时匹配磁贴墙）+ 总览统计区 + 最近队友区 + 最近对手区
 * 队列/英雄筛选（真实 queueId / championId）与父组件同步；数据均来自父组件聚合结果
 * （召唤师查询已移至页面顶部居中搜索栏，分页已移至战绩列表底部）
 */
import { onMounted, ref, computed } from 'vue'

import { championIconUrl } from '@/utils/icon-url'
import { listChampionOptions, type ChampionOption } from '@/utils/game-resource'
import { createLogger } from '@/utils/logger'

import { QUEUE_OPTIONS } from './adapter'
import type { GameStatsData, OverviewStats, RecentPlayer } from './types'

const logger = createLogger('SidebarPanel')

// 页面数据（props 注入）与后端总条数；具名引用供模板函数使用
const props = defineProps<{ data: GameStatsData; total: number }>()

// 队列筛选（下拉框，值为后端 queueId，null 为所有模式）
const queue = defineModel<number | null>('queue', { default: null })
// 英雄筛选（磁贴墙点选，值为后端 championId，null 为所有英雄）：过滤该玩家本局使用此英雄的对局
const champion = defineModel<number | null>('champion', { default: null })

// ---- 英雄筛选磁贴墙数据源 ----

/** 全量英雄选项（CDragon champion-summary 加载，已按本名去重，id 升序） */
const championOptions = ref<ChampionOption[]>([])
/** 英雄搜索框输入（称号/本名双字段实时匹配过滤磁贴） */
const championSearch = ref('')

/**
 * 过滤后的英雄选项：关键字与称号 OR 本名任一"包含"即命中（不区分大小写）——
 * "剑魔"命中称号"暗裔剑魔"，"亚托克斯"命中本名，指向同一英雄；无输入时展示全量
 */
const filteredChampionOptions = computed(() => {
  const keyword = championSearch.value.trim().toLowerCase()
  if (!keyword) return championOptions.value
  return championOptions.value.filter(
    (option) => option.label.toLowerCase().includes(keyword) || option.title.toLowerCase().includes(keyword)
  )
})

// 挂载时加载英雄选项（失败静默：磁贴区空态，不影响其它筛选）
onMounted(async () => {
  championOptions.value = await listChampionOptions()
  logger.info('英雄筛选选项加载完成', { count: championOptions.value.length })
})

/**
 * 点选英雄磁贴：选中新英雄或取消已选中（再点同一磁贴 = 回到"所有英雄"）
 * 关键交互节点打点追踪
 */
function toggleChampion(option: ChampionOption): void {
  const next = champion.value === option.id ? null : option.id
  champion.value = next
  logger.info('英雄筛选切换', { championId: next })
}

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
        <!-- 队列下拉：去原生外观 + 自绘主题绿箭头（暗色主题下原生样式突兀） -->
        <select v-model="queue" class="queue-select">
          <option v-for="option in QUEUE_OPTIONS" :key="option.label" :value="option.queueId">
            {{ option.label }}
          </option>
        </select>
      </div>
      <div class="filter-row">
        <!-- 英雄搜索框：输入称号片段或本名实时过滤下方磁贴（如"剑魔"/"亚托克斯"均命中暗裔剑魔） -->
        <input
          v-model="championSearch"
          type="text"
          class="champion-search"
          placeholder="搜索英雄名筛选对局"
        />
      </div>
      <!-- 英雄磁贴墙：4 列头像网格,常驻"所有英雄"占位;点选选中/再点取消 -->
      <div v-if="championOptions.length > 0" class="filter-row">
        <div class="tile-grid">
          <button
            type="button"
            class="tile"
            :class="{ selected: champion === null }"
            title="所有英雄"
            @click="champion = null"
          >
            <span class="tile-all">ALL</span>
            <span class="tile-label">所有英雄</span>
          </button>
          <button
            v-for="option in filteredChampionOptions"
            :key="option.id"
            type="button"
            class="tile"
            :class="{ selected: champion === option.id }"
            :title="`${option.title}（${option.label}）`"
            @click="toggleChampion(option)"
          >
            <img :src="championIconUrl(option.id)" :alt="option.label" class="tile-icon" />
            <span class="tile-label">{{ option.label }}</span>
          </button>
          <p v-if="filteredChampionOptions.length === 0" class="tile-empty">无匹配英雄</p>
        </div>
        <!-- 实时匹配计数：让用户确认过滤已生效与结果规模 -->
        <p class="match-count">实时匹配：{{ filteredChampionOptions.length }} / {{ championOptions.length }} 个英雄</p>
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
  padding: 6px 30px 6px 8px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface-hover);
  color: var(--text);
  font-size: 16px;
  cursor: pointer;
  /* 去原生外观 + 自绘主题绿箭头（暗色主题下原生样式突兀） */
  appearance: none;
  -webkit-appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%234ade80' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;

  /* 下拉展开的选项面板：跟随暗色主题 */
  option {
    background: var(--surface-active);
    color: var(--text);
  }
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

/* 英雄磁贴墙：4 列头像网格，仅纵向滚动（长英雄名截断而非横向溢出） */
.tile-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  width: 100%;
  max-height: 300px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 2px;
}

/* 磁贴：图标 + 本名标签；min-width 归零防长文本撑宽列 */
.tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding: 6px 2px;
  border: 1px solid transparent;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;

  &:hover {
    background: var(--surface-hover);
  }

  /* 选中磁贴：绿描边 + 亮色文字标识当前筛选 */
  &.selected {
    border-color: var(--primary);
    color: var(--primary-2);
    background: var(--surface-active);
  }
}

.tile-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

/* "所有英雄"占位磁贴：无头像,虚线圆圈 + ALL 字样 */
.tile-all {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px dashed var(--border-strong);
  font-size: 12px;
}

.tile-label {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 无匹配空态 */
.tile-empty {
  grid-column: 1 / -1;
  padding: 12px 0;
  text-align: center;
  font-size: 14px;
  color: var(--text-muted);
}

/* 实时匹配计数 */
.match-count {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--text-muted);
}

/* 磁贴墙滚动条：暗色主题自定义样式（透明轨道 + 暗绿圆角滑块，hover 提亮） */
.tile-grid {
  scrollbar-width: thin;
  scrollbar-color: var(--border-strong) transparent;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--border-strong);
    border-radius: 4px;

    &:hover {
      background: var(--primary);
    }
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
