<script setup lang="ts">
/**
 * 对局详情页
 * 展示单局对局的概要信息与双方玩家卡片（KDA / 伤害 / 承伤 / 视野统计）
 * 数据来源：后端 /api/matches/{gameId}，stats_json 解析失败不阻塞页面展示
 */
import { getMatchDetail } from '@/api/matches'
import type { MatchDetail, ParsedStats } from '@/api/types'
import { createLogger } from '@/utils/logger'
import { NDescriptions, NDescriptionsItem, NEmpty, NSpin, useMessage } from 'naive-ui'
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

/** 解析 stats_json；解析失败返回空对象并记 warn 日志（不阻塞展示） */
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

/** 按队伍分组（100/200），组内按击杀排序 */
const teams = computed(() => {
  if (!detail.value) {
    return []
  }
  // 以 teamId 为键分组，同一队伍的所有玩家归入一个列表
  const groups = new Map<number, typeof detail.value.participants>()
  for (const p of detail.value.participants) {
    const list = groups.get(p.teamId) ?? []
    list.push(p)
    groups.set(p.teamId, list)
  }
  // 队伍按 ID 升序展示（蓝方 100 在前），组内玩家按击杀数降序排列
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([teamId, participants]) => ({
      teamId,
      participants: [...participants].sort((a, b) => b.kills - a.kills)
    }))
})

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
      <!-- 顶部：对局概要 -->
      <n-descriptions bordered title="对局概要">
        <n-descriptions-item label="对局 ID">{{ detail.gameId }}</n-descriptions-item>
        <n-descriptions-item label="模式">{{ detail.gameMode }}</n-descriptions-item>
        <!-- 时长：由秒数转换为 分 + 秒 的人类可读格式 -->
        <n-descriptions-item label="时长"
          >{{ Math.floor(detail.gameDuration / 60) }} 分
          {{ detail.gameDuration % 60 }} 秒</n-descriptions-item
        >
        <n-descriptions-item label="版本">{{ detail.gameVersion }}</n-descriptions-item>
        <n-descriptions-item label="地区">{{ detail.region }}</n-descriptions-item>
      </n-descriptions>

      <!-- 双方队伍玩家卡片 -->
      <div v-for="team in teams" :key="team.teamId" class="team-block">
        <!-- 队伍标题：100 为蓝方，200 为红方 -->
        <h3>{{ team.teamId === 100 ? '蓝方' : '红方' }}</h3>
        <div class="player-grid">
          <!-- 玩家卡片：获胜方玩家带 winner 高亮样式 -->
          <div
            v-for="p in team.participants"
            :key="p.puuid"
            class="player-card"
            :class="{ winner: p.win }"
          >
            <div class="player-name">{{ p.summonerName }}</div>
            <div class="player-kda">KDA {{ p.kills }} / {{ p.deaths }} / {{ p.assists }}</div>
            <!-- 战斗统计行：字段缺失时显示 -，来自 stats_json 解析 -->
            <div class="player-stats">
              伤害 {{ parseStats(p.statsJson).totalDamageDealtToChampions ?? '-' }} · 承伤
              {{ parseStats(p.statsJson).totalDamageTaken ?? '-' }} · 视野
              {{ parseStats(p.statsJson).visionScore ?? '-' }}
            </div>
          </div>
        </div>
      </div>
    </template>
    <!-- 空态：请求完成且无数据（如无效 gameId 导致 404）时展示 -->
    <n-empty v-else-if="!loading" description="对局不存在" />
  </n-spin>
</template>

<style scoped>
/* 队伍区块：上下留白，与对局概要分隔 */
.team-block {
  margin-top: 24px;
}

/* 玩家卡片网格：响应式排布，窄屏自动换行 */
.player-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

/* 玩家卡片：默认白底圆角，获胜方加绿色描边突出 */
.player-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
}
.player-card.winner {
  border-color: #18a058;
}

/* 玩家名：加粗展示，突出身份 */
.player-name {
  font-weight: 600;
}

/* 战斗统计行：次要文字颜色，弱于 KDA 的视觉层级 */
.player-stats {
  color: #666;
  font-size: 12px;
  margin-top: 4px;
}
</style>
