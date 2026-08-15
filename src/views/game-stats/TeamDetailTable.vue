<script setup lang="ts">
/**
 * 单局详情的队伍数据表：队伍汇总行（总KDA/经济/推塔）+ 5 名玩家明细
 * 玩家行：头像昵称 / KDA / 经济 / 每分钟输出 / 召唤师技能 / 出装 6 格 / 输出承伤进度条
 * 技能与装备图标均走 game-resource（CommunityDragon game-data JSON，对齐主仓库机制）
 */
import ItemIcon from '@/components/widgets/ItemIcon.vue'
import SummonerSpellDisplay from '@/components/widgets/SummonerSpellDisplay.vue'
import { championIconUrl } from '@/utils/icon-url'

import type { TeamDetail } from './types'

const props = defineProps<{ team: TeamDetail }>()

/** 出装 6 槽：不足 6 件用 0 补位（模板渲染空槽占位） */
function slotsOf(items: number[]): number[] {
  const slots = [...items]
  while (slots.length < 6) {
    slots.push(0)
  }
  return slots.slice(0, 6)
}
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
      <!-- 召唤师技能（对齐主仓库 SummonerSpellDisplay：图标 + 名称/冷却/描述） -->
      <div class="player-cell player-cell-spells">
        <SummonerSpellDisplay
          v-for="(spellId, index) in player.summonerSpells"
          :key="`${spellId}-${index}`"
          :spell-id="spellId"
          :size="18"
        />
      </div>
      <!-- 出装 6 格（对齐主仓库 game-resource 机制：图标 + 名称/价格/描述；含空槽占位） -->
      <div class="player-cell player-cell-items">
        <ItemIcon
          v-for="(itemId, index) in slotsOf(player.items)"
          :key="`${itemId}-${index}`"
          :item-id="itemId"
          :size="20"
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
/* 队伍表格：汇总行 + 玩家行，固定列；最小宽度保证 7 列不被压缩裁剪 */
.team-table {
  flex: 1;
  min-width: 360px;
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

/* 玩家行：网格固定列（名字/KDA/经济/每分钟输出/技能/出装/进度条） */
.player-row {
  display: grid;
  grid-template-columns: 1.3fr 0.8fr 0.7fr 0.7fr 0.5fr 2fr 1.5fr;
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

/* 召唤师技能列：图标横向排列 */
.player-cell-spells {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
}

/* 出装列：6 格可换行，避免溢出被裁剪 */
.player-cell-items {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
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
