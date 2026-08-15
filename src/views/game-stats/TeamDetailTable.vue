<script setup lang="ts">
/**
 * 单局详情的队伍数据表：队伍汇总行（总KDA/经济/推塔）+ 5 名玩家明细（KDA/经济/每分钟输出/装备/输出承伤进度条）
 */
import { championIconUrl, itemIconUrl } from '@/utils/icon-url'

import type { TeamDetail } from './types'

const props = defineProps<{ team: TeamDetail }>()
</script>

<template>
  <div class="team-table" :class="`team-table-${team.side}`">
    <!-- 队伍汇总行 -->
    <div class="team-summary">
      <span class="team-side">{{ team.side === 'blue' ? '蓝队' : '红队' }}</span>
      <span class="summary-item">K/D/A {{ team.totalKills }}/{{ team.totalDeaths }}/{{ team.totalAssists }}</span>
      <span class="summary-item">经济 {{ team.totalGold.toLocaleString() }}</span>
      <span class="summary-item">推塔 {{ team.towers }}</span>
    </div>

    <!-- 玩家明细行 -->
    <div
      v-for="player in team.players"
      :key="player.name"
      class="player-row"
    >
      <!-- 头像 + 昵称 -->
      <div class="player-cell player-cell-name">
        <img
          :src="championIconUrl(player.championId)"
          :alt="player.name"
          class="player-avatar"
        />
        <span class="player-name">{{ player.name }}</span>
      </div>
      <!-- KDA -->
      <div class="player-cell player-cell-kda">
        {{ player.kills }}/{{ player.deaths }}/{{ player.assists }}
      </div>
      <!-- 经济 -->
      <div class="player-cell player-cell-gold">{{ player.gold.toLocaleString() }}</div>
      <!-- 每分钟输出 -->
      <div class="player-cell player-cell-dpm">{{ player.damagePerMin }}</div>
      <!-- 装备 6 格 -->
      <div class="player-cell player-cell-items">
        <img
          v-for="(itemId, index) in player.items"
          :key="`${itemId}-${index}`"
          :src="itemIconUrl(itemId)"
          :alt="`装备 ${itemId}`"
          class="item-icon"
        />
      </div>
      <!-- 输出/承伤进度条 -->
      <div class="player-cell player-cell-bars">
        <div class="bar-row">
          <span class="bar-label">输出</span>
          <div class="bar">
            <div
              class="bar-fill bar-fill-damage"
              :style="{ width: `${player.damagePercent}%` }"
            />
          </div>
          <span class="bar-value">{{ player.damagePercent }}%</span>
        </div>
        <div class="bar-row">
          <span class="bar-label">承伤</span>
          <div class="bar">
            <div
              class="bar-fill bar-fill-taken"
              :style="{ width: `${player.damageTakenPercent}%` }"
            />
          </div>
          <span class="bar-value">{{ player.damageTakenPercent }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* 队伍表格：汇总行 + 玩家行，固定列 */
.team-table {
  flex: 1;
  min-width: 0;
  border-radius: var(--radius);
  overflow: hidden;
}

/* 蓝队浅蓝边框、红队浅红边框 */
.team-table-blue {
  border: 1px solid color-mix(in srgb, var(--win) 35%, transparent);
}

.team-table-red {
  border: 1px solid color-mix(in srgb, var(--loss) 35%, transparent);
}

/* 汇总行 */
.team-summary {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text);
}

.team-table-blue .team-summary {
  background: color-mix(in srgb, var(--win) 15%, transparent);
}

.team-table-red .team-summary {
  background: color-mix(in srgb, var(--loss) 15%, transparent);
}

.team-side {
  font-weight: 700;
}

.summary-item {
  color: var(--text-muted);
}

/* 玩家行：网格固定列 */
.player-row {
  display: grid;
  grid-template-columns: 1.4fr 0.8fr 0.7fr 0.8fr 1.5fr 1.6fr;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  color: var(--text);

  &:hover {
    background: var(--surface-hover);
  }
}

.player-cell-name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.player-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  flex-shrink: 0;
}

.player-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-cell-kda {
  font-weight: 600;
}

.player-cell-gold,
.player-cell-dpm {
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.player-cell-items {
  display: flex;
  gap: 2px;
}

.item-icon {
  width: 20px;
  height: 20px;
  border-radius: 3px;
  border: 1px solid var(--border);
}

.player-cell-bars {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.bar-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.bar-label {
  width: 24px;
  font-size: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.bar {
  flex: 1;
  height: 5px;
  border-radius: 3px;
  background: var(--surface-hover);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 3px;
}

.bar-fill-damage {
  background: var(--win);
}

.bar-fill-taken {
  background: var(--loss);
}

.bar-value {
  width: 30px;
  text-align: right;
  font-size: 10px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
</style>
