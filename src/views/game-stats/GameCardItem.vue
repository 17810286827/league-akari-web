<script setup lang="ts">
/**
 * 战绩卡片：结果标签（胜利蓝/失败红/投降灰）+ 核心数据 + 特殊标记 + 队友列表
 * 点击展开/收起该局的双队详细数据表格（带动画过渡）
 */
import { championIconUrl } from '@/utils/icon-url'

import TeamDetailTable from './TeamDetailTable.vue'
import type { GameCard } from './types'

defineProps<{
  game: GameCard
  /** 是否展开详情 */
  expanded: boolean
  /** 详情是否正在懒加载（首次展开时由父组件发起请求） */
  detailLoading?: boolean
}>()

// 点击卡片切换展开状态
const emit = defineEmits<{ toggle: [gameId: number] }>()

/** 结果标签配置：胜利蓝 / 失败红 / 投降灰 */
const RESULT_META: Record<GameCard['result'], { label: string; className: string }> = {
  victory: { label: '胜利', className: 'tag-victory' },
  defeat: { label: '失败', className: 'tag-defeat' },
  surrender: { label: '投降', className: 'tag-surrender' }
}

/** 特殊标记配色：四杀金 / 击杀蓝 / 拆塔紫 / 金币黄 */
const TAG_META: Record<string, string> = {
  quadra: 'tag-quadra',
  kill: 'tag-kill',
  tower: 'tag-tower',
  gold: 'tag-gold'
}
</script>

<template>
  <article
    class="game-card"
    :class="{ 'game-card-expanded': expanded }"
    @click="emit('toggle', game.gameId)"
  >
    <!-- 卡片主体：横向信息行 -->
    <div class="card-row">
      <!-- 结果标签 -->
      <span class="result-tag" :class="RESULT_META[game.result].className">
        {{ RESULT_META[game.result].label }}
      </span>

      <!-- 英雄头像 -->
      <img :src="championIconUrl(game.championId)" alt="本局英雄" class="hero-avatar" />

      <!-- KDA 与伤害 -->
      <div class="core-stats">
        <p class="kda">{{ game.kills }}/{{ game.deaths }}/{{ game.assists }}</p>
        <p class="damage">
          <span class="damage-share">{{ game.damageShare }}%</span>
          <span class="damage-total">{{ game.totalDamage.toLocaleString() }}</span>
        </p>
      </div>

      <!-- 时长 / 日期 / 地图 -->
      <div class="meta-stats">
        <p class="meta-line">{{ game.duration }}</p>
        <p class="meta-line meta-date">{{ game.date }}</p>
        <p class="meta-line meta-map">{{ game.mapName }}</p>
      </div>

      <!-- 特殊标记 -->
      <div class="tags">
        <span v-for="tag in game.tags" :key="tag.label" class="game-tag" :class="TAG_META[tag.type]">
          {{ tag.label }}
        </span>
      </div>

      <!-- 队友列表：头像 + 昵称 + 本局英雄 -->
      <div class="teammates">
        <div v-for="teammate in game.teammates" :key="teammate.puuid" class="teammate">
          <img :src="championIconUrl(teammate.championId)" :alt="teammate.name" class="teammate-avatar" />
          <div class="teammate-info">
            <p class="teammate-name">{{ teammate.name }}</p>
            <!-- 常用英雄为可选副展示：无数据源时不渲染 -->
            <p v-if="teammate.mainChampionId" class="teammate-main">常用 {{ teammate.mainChampionId }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 展开详情：蓝队 / 红队表格（grid-rows 高度过渡动画）
         内容常驻渲染（缓存后），折叠时由 0fr 行高 + overflow hidden 隐藏，保证展开/收起高度一致 -->
    <div class="detail-wrap" :class="{ 'detail-open': expanded }">
      <div class="detail-inner">
        <div v-if="game.detail" class="detail-grid">
          <TeamDetailTable :team="game.detail.blue" />
          <TeamDetailTable :team="game.detail.red" />
        </div>
        <!-- 详情未就绪：显示加载中或失败占位 -->
        <p v-else-if="expanded" class="detail-placeholder">
          {{ detailLoading ? '详情加载中...' : '暂无详情数据' }}
        </p>
      </div>
    </div>
  </article>
</template>

<style lang="scss" scoped>
/* 战绩卡片：圆角 + 阴影 + hover 提亮 */
.game-card {
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow);
  cursor: pointer;
  transition: background-color 0.15s;

  &:hover {
    background: var(--surface-hover);
  }
}

/* 卡片主体：横向信息行 */
.card-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
}

/* 结果标签 */
.result-tag {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
}

.tag-victory {
  background: var(--win);
}

.tag-defeat {
  background: var(--loss);
}

.tag-surrender {
  background: var(--surrender);
}

/* 英雄头像 */
.hero-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 2px solid var(--border);
  flex-shrink: 0;
}

/* KDA 与伤害 */
.core-stats {
  min-width: 120px;
}

.kda {
  font-size: 16px;
  font-weight: 800;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.damage {
  font-size: 12px;
  color: var(--text-muted);
}

.damage-share {
  color: var(--win);
  font-weight: 600;
  margin-right: 6px;
}

.damage-total {
  font-variant-numeric: tabular-nums;
}

/* 时长 / 日期 / 地图 */
.meta-stats {
  min-width: 96px;
}

.meta-line {
  font-size: 12px;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.meta-date,
.meta-map {
  font-size: 11px;
  color: var(--text-muted);
}

/* 特殊标记 */
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: 120px;
}

.game-tag {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.tag-quadra {
  background: color-mix(in srgb, var(--gold) 25%, transparent);
  color: var(--gold);
}

.tag-kill {
  background: color-mix(in srgb, var(--win) 25%, transparent);
  color: var(--win);
}

.tag-tower {
  background: color-mix(in srgb, #a78bfa 25%, transparent);
  color: #a78bfa;
}

.tag-gold {
  background: color-mix(in srgb, #fbbf24 25%, transparent);
  color: #fbbf24;
}

/* 队友列表：右侧横向排列 */
.teammates {
  display: flex;
  flex: 1;
  gap: 10px;
  min-width: 0;
  justify-content: flex-end;
}

.teammate {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.teammate-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  flex-shrink: 0;
}

.teammate-name {
  font-size: 12px;
  color: var(--text);
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.teammate-main {
  font-size: 10px;
  color: var(--text-muted);
}

/* 展开详情：grid 行高过渡动画（0fr → 1fr），结束状态高度精确一致 */
.detail-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s ease;
}

.detail-open {
  grid-template-rows: 1fr;
}

/* 内容容器：min-height 0 允许 grid 行高收缩；overflow hidden 裁剪隐藏 */
.detail-inner {
  min-height: 0;
  overflow: hidden;
  padding: 0 16px 14px;
}

/* 详情占位：加载中 / 无数据提示 */
.detail-placeholder {
  padding: 16px 0;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}

/* 蓝红双队表格并排（窄屏堆叠） */
.detail-grid {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;

  .team-table {
    flex: 1;
    min-width: 320px;
  }
}
</style>
