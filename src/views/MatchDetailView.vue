<script setup lang="ts">
/**
 * 对局详情页（OP.GG 两队对比布局）
 * 顶部概要条展示模式/时长/版本/日期/获胜方；
 * 下方蓝红两队并排对比（宽屏两栏、窄屏堆叠），
 * 每行玩家展示英雄头像、召唤师名（自我金色徽章）、KDA、出装与统计。
 * 数据来源：后端 /api/matches/{gameId}，stats_json 解析失败不阻塞页面展示。
 */
import { getMatchDetail } from '@/api/matches'
import type { MatchDetail, MatchParticipant, ParsedStats } from '@/api/types'
import { createLogger } from '@/utils/logger'
import { parseIdArray } from '@/utils/parse-json'
import { championIconUrl, itemIconFallbackUrl, itemIconUrl } from '@/utils/icon-url'
import { NEmpty, NSpin, useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

// 日志器：来源标签固定为 MatchDetail，便于在 DevTools 中按标签过滤日志
const logger = createLogger('MatchDetail')
// 全局消息提示：详情加载失败时向用户展示错误原因
const message = useMessage()
// 路由实例：从路由参数中读取对局 ID
const route = useRoute()

// 对局 ID：由路由参数转换而来，用于请求后端详情接口
const gameId = Number(route.params.gameId)
// 详情加载状态：为 true 时展示全局加载动画
const loading = ref(false)
// 对局详情数据：加载成功后填充，404 时保持 null 并展示空态
const detail = ref<MatchDetail | null>(null)

// 出装槽位数：OP.GG 展示风格固定 6 格，不足补占位、多余截断
const ITEM_SLOTS = 6

// 游戏模式 -> 中文名映射（未知模式原样展示后端值）
const modeNames: Record<string, string> = {
  CLASSIC: '经典模式',
  ARAM: '极地大乱斗',
  CHERRY: '特殊模式'
}

// 队列 ID -> 中文名映射（用于概要条补充展示）
const queueNames: Record<number, string> = {
  420: '单双排位',
  440: '灵活排位',
  430: '匹配',
  450: '极地大乱斗'
}

/** 队伍玩家：在参与者基础上预处理统计与出装，模板不再重复解析 */
interface TeamPlayer extends MatchParticipant {
  /** 预解析的 stats_json：模板只读该字段，避免多次 JSON.parse */
  stats: ParsedStats
  /** 预解析的出装物品 ID 数组（最多取前 6 个） */
  itemIds: number[]
}

/** 队伍分组结果：包含队伍 ID、是否获胜与预处理后的玩家列表 */
interface TeamGroup {
  teamId: number
  /** 该队是否为获胜方（详情接口 winnerTeamId 与 teamId 一致） */
  isWinner: boolean
  players: TeamPlayer[]
}

/**
 * 解析 stats_json；解析失败返回空对象并记 warn 日志（不阻塞展示）
 * 注意：仅在 teams computed 中调用，保证每个玩家只解析一次
 */
function parseStats(statsJson: string | null): ParsedStats {
  if (!statsJson) {
    return {}
  }
  try {
    return JSON.parse(statsJson) as ParsedStats
  } catch (error) {
    // 单条记录解析失败只影响该玩家的统计行，页面其余部分继续渲染
    logger.warn('Failed to parse statsJson', { gameId, statsJson, error })
    return {}
  }
}

/** 把秒数格式化为 mm:ss，供概要条与列表统一展示 */
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

/** 游戏模式 -> 中文名；未知模式回退为后端原始值 */
function modeLabel(mode: string): string {
  return modeNames[mode] ?? mode
}

/** 队列 ID -> 中文名；未知队列回退为 "队列 {ID}" */
function queueName(id: number): string {
  return queueNames[id] ?? `队列 ${id}`
}

/**
 * 按队伍分组（100/200），组内按击杀排序；
 * 分组同时预解析每个玩家的 stats 与出装，修正任务 4 中模板内重复 JSON.parse 的问题
 */
const teams = computed<TeamGroup[]>(() => {
  if (!detail.value) {
    return []
  }
  // 以 teamId 为键分组，同一队伍的所有玩家归入一个列表
  const groups = new Map<number, TeamPlayer[]>()
  for (const p of detail.value.participants) {
    // 预处理：统计解析 + 出装解析各执行一次，结果供模板直接消费
    const player: TeamPlayer = {
      ...p,
      stats: parseStats(p.statsJson),
      itemIds: parseIdArray(p.items).slice(0, ITEM_SLOTS)
    }
    const list = groups.get(p.teamId) ?? []
    list.push(player)
    groups.set(p.teamId, list)
  }
  // 队伍按 ID 升序展示（蓝方 100 在前），组内玩家按击杀数降序排列
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([teamId, players]) => ({
      teamId,
      isWinner: detail.value?.winnerTeamId === teamId,
      players: [...players].sort((a, b) => b.kills - a.kills)
    }))
})

/** 出装图标加载失败：降级到 Data Dragon（CommunityDragon items 路径当前已失效） */
function onItemError(event: Event, itemId: number) {
  const img = event.target as HTMLImageElement
  // 已降级过一次则不再处理，避免失败后反复触发死循环
  if (img.dataset.fallback === 'true') {
    return
  }
  img.dataset.fallback = 'true'
  img.src = itemIconFallbackUrl(itemId)
}

/** 英雄头像加载失败：隐藏图片，露出容器占位底色 */
function onChampionError(event: Event) {
  const img = event.target as HTMLImageElement
  img.style.visibility = 'hidden'
}

// 组件挂载后请求详情：失败时提示用户对局不存在或后端未启动
onMounted(async () => {
  loading.value = true
  try {
    detail.value = await getMatchDetail(gameId)
    logger.info('Match detail loaded', { gameId, participants: detail.value.participants.length })
  } catch (error) {
    // 404 或网络错误统一走这里：记录日志并向用户提示，页面展示空态
    logger.error('Failed to load match detail', { gameId, error })
    message.error('对局详情加载失败：对局不存在或后端未启动')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <!-- 加载动画包裹整个详情区域，请求期间展示转圈 -->
  <n-spin :show="loading">
    <template v-if="detail">
      <div class="match-detail">
        <!-- 顶部概要条：模式 · 时长 · 版本 · 日期 · 获胜方 -->
        <div class="summary-bar">
          <div class="summary-item">
            <span class="summary-label">模式</span>
            <span class="summary-value">{{ modeLabel(detail.gameMode) }} · {{ queueName(detail.queueId) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">时长</span>
            <span class="summary-value tabular-nums">{{ formatDuration(detail.gameDuration) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">版本</span>
            <span class="summary-value">{{ detail.gameVersion }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">日期</span>
            <span class="summary-value tabular-nums">{{ new Date(detail.gameCreation).toLocaleString() }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">获胜方</span>
            <!-- 胜方徽章：蓝方蓝 / 红方红 / 未知灰色 -->
            <span
              class="winner-badge"
              :class="detail.winnerTeamId === 100 ? 'win' : detail.winnerTeamId === 200 ? 'loss' : 'tie'"
            >
              {{ detail.winnerTeamId === 100 ? '蓝方' : detail.winnerTeamId === 200 ? '红方' : '未知' }}
            </span>
          </div>
        </div>

        <!-- 两队对比：宽屏两栏并排，窄屏上下堆叠 -->
        <div class="teams">
          <section v-for="team in teams" :key="team.teamId" class="team-panel">
            <!-- 队首：蓝/红色条 + 队名 + 获胜队伍金色标记 -->
            <header class="team-title">
              <span class="team-bar" :class="team.teamId === 100 ? 'blue' : 'red'" aria-hidden="true" />
              <span class="team-name">
                {{ team.teamId === 100 ? '蓝方' : '红方' }} · {{ team.teamId }}
              </span>
              <span v-if="team.isWinner" class="team-winner-tag">胜</span>
            </header>

            <!-- 玩家行列表：胜者行背景 --bg-win / --bg-loss，逐行对比展示 -->
            <ul class="player-list">
              <li
                v-for="p in team.players"
                :key="p.puuid"
                class="player-row"
                :class="p.win ? 'win' : 'loss'"
              >
                <!-- 英雄头像：CDN 48px 圆角，加载失败露出占位底色 -->
                <img
                  class="avatar"
                  :src="championIconUrl(p.championId)"
                  :alt="`英雄 ${p.championId}`"
                  @error="onChampionError"
                />
                <!-- 玩家信息列：召唤师名 + 自我徽章 + 统计行 -->
                <div class="player-info">
                  <div class="name-line">
                    <span class="summoner-name">{{ p.summonerName }}</span>
                    <!-- 自我标记：selfPuuid 匹配的玩家加金色"我"徽章 -->
                    <span v-if="p.puuid === detail.selfPuuid" class="me-badge">我</span>
                    <span class="position">{{ p.position ?? '-' }}</span>
                  </div>
                  <!-- 统计行：伤害/承伤/视野/CS/金币，等宽数字表格化对齐，缺失显示 - -->
                  <div class="stat-line tabular-nums">
                    <div class="stat-item">
                      <span class="stat-label">伤害</span>
                      <span class="stat-value">{{ p.stats.totalDamageDealtToChampions ?? '-' }}</span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-label">承伤</span>
                      <span class="stat-value">{{ p.stats.totalDamageTaken ?? '-' }}</span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-label">视野</span>
                      <span class="stat-value">{{ p.stats.visionScore ?? '-' }}</span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-label">CS</span>
                      <span class="stat-value">{{ p.cs ?? '-' }}</span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-label">金币</span>
                      <span class="stat-value">{{ p.goldEarned ?? '-' }}</span>
                    </div>
                  </div>
                </div>
                <!-- KDA 与出装列：死亡数红色，出装 6 槽位不足显示占位 -->
                <div class="kda-items">
                  <div class="kda tabular-nums">
                    <span class="kda-num">{{ p.kills }}</span>
                    <span class="kda-sep">/</span>
                    <span class="kda-num kda-death">{{ p.deaths }}</span>
                    <span class="kda-sep">/</span>
                    <span class="kda-num">{{ p.assists }}</span>
                  </div>
                  <div class="items">
                    <!-- 出装槽位：固定 6 格，有物品显示图标，空槽位显示占位 -->
                    <template v-for="slot in ITEM_SLOTS" :key="slot">
                      <img
                        v-if="p.itemIds[slot - 1] != null"
                        class="item-icon"
                        :src="itemIconUrl(p.itemIds[slot - 1])"
                        :alt="`物品 ${p.itemIds[slot - 1]}`"
                        @error="onItemError($event, p.itemIds[slot - 1])"
                      />
                      <span v-else class="item-slot-empty" aria-hidden="true" />
                    </template>
                  </div>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </template>
    <!-- 空态：请求完成且无数据（如无效 gameId 导致 404）时展示 -->
    <n-empty v-else-if="!loading" description="对局不存在" />
  </n-spin>
</template>

<style scoped>
/* 页面容器：居中限定最大宽度，与列表页容器宽度保持一致 */
.match-detail {
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px 16px 40px;
}

/* 顶部概要条：横向排列信息项，窄屏自动换行 */
.summary-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px 32px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 14px 20px;
}

/* 概要信息项：小标签在上、数值在下 */
.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.summary-label {
  font-size: 11px;
  color: var(--text-secondary);
}
.summary-value {
  font-size: 14px;
}

/* 胜方徽章：与列表页徽章一致的色块风格 */
.winner-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 4px;
  align-self: flex-start;
}
.winner-badge.win {
  color: var(--win-color);
  background: var(--bg-win);
}
.winner-badge.loss {
  color: var(--loss-color);
  background: var(--bg-loss);
}
.winner-badge.tie {
  color: var(--text-secondary);
  background: rgba(139, 147, 167, 0.1);
}

/* 两队对比容器：宽屏两栏并排 */
.teams {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
}

/* 队伍面板：卡片背景，容纳标题与玩家行列表 */
.team-panel {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 12px;
}

/* 队首标题行：色条 + 队名 + 获胜标记横排 */
.team-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 4px 10px;
}
/* 队首色条：蓝方蓝 / 红方红，标识队伍阵营 */
.team-bar {
  width: 4px;
  height: 18px;
  border-radius: 2px;
}
.team-bar.blue {
  background: var(--win-color);
}
.team-bar.red {
  background: var(--loss-color);
}
.team-name {
  font-weight: 600;
  font-size: 15px;
}
/* 获胜队伍标记：LOL 金点缀，用于签名元素 */
.team-winner-tag {
  color: var(--gold-accent);
  font-size: 12px;
  font-weight: 600;
  border: 1px solid var(--gold-accent);
  border-radius: 4px;
  padding: 0 6px;
}

/* 玩家列表：去除默认列表样式，行间 8px 间距 */
.player-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 玩家行：头像 | 信息统计 | KDA与出装 三列布局 */
.player-row {
  display: grid;
  grid-template-columns: 48px 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 6px;
}
/* 胜者行底色：胜利蓝 / 失败红（半透明），队伍对比一目了然 */
.player-row.win {
  background: var(--bg-win);
}
.player-row.loss {
  background: var(--bg-loss);
}

/* 英雄头像：48px 圆角，深色占位底在加载失败时可见 */
.avatar {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: rgba(139, 147, 167, 0.12);
}

/* 玩家信息列：名称行 + 统计行 纵向排列 */
.player-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

/* 名称行：召唤师名（可截断）+ 自我徽章 + 位置 */
.name-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.summoner-name {
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* 自我徽章：LOL 金色描边，标识当前用户 */
.me-badge {
  flex: 0 0 auto;
  color: var(--gold-accent);
  font-size: 11px;
  font-weight: 600;
  border: 1px solid var(--gold-accent);
  border-radius: 4px;
  padding: 0 5px;
}
/* 对线位置：次要小字 */
.position {
  flex: 0 0 auto;
  font-size: 11px;
  color: var(--text-secondary);
}

/* 统计行：五列等宽，数字等宽对齐 */
.stat-line {
  display: grid;
  grid-template-columns: repeat(5, minmax(52px, 1fr));
  gap: 4px;
}
/* 统计项：标签在上、数值在下 */
.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.stat-label {
  font-size: 10px;
  color: var(--text-secondary);
}
.stat-value {
  font-size: 12px;
}

/* KDA 与出装列：右对齐纵向排列 */
.kda-items {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

/* KDA 数字：击杀/助攻主色，死亡数字红色，等宽对齐 */
.kda {
  font-size: 16px;
  font-weight: 600;
}
.kda-num {
  display: inline-block;
  min-width: 1.1em;
  text-align: center;
}
.kda-death {
  color: var(--loss-color);
}
.kda-sep {
  color: var(--text-secondary);
  font-weight: 400;
}

/* 出装图标行：6 槽位横排 */
.items {
  display: flex;
  gap: 4px;
}
/* 出装图标：28px 圆角小图标 */
.item-icon {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: rgba(139, 147, 167, 0.12);
}
/* 空出装槽位：浅色占位块，保持 6 槽位对齐 */
.item-slot-empty {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: rgba(139, 147, 167, 0.1);
}

/* 窄屏：两队上下堆叠，统计行允许换行 */
@media (max-width: 900px) {
  .teams {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 560px) {
  /* 极窄屏：头像与信息列保持，KDA/出装列换行到下一行 */
  .player-row {
    grid-template-columns: 48px 1fr;
  }
  .kda-items {
    grid-column: 1 / -1;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }
}
</style>
