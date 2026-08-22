<script setup lang="ts">
/**
 * 对局详情页（任务 13：MatchCard 展开态，替换旧三段式布局）：
 * getMatchDetail 加载对局详情 → 作为 summary 传给 MatchCard（isExpanded=true），
 * 卡片内部经适配层（toBasicInfo/toParticipants/toMatchCardTeams）组装 basicInfo/participants/teams；
 * 展开详情已精简为"总览"（时间线 Tab 已移除），不再请求 /timeline 接口。
 * AI 分析：详情加载成功后以 gameId + selfPuuid 创建/更新 composable 状态，
 * 与战绩列表共享同一份 localStorage 缓存键，两个入口恢复完全相同的成功快照。
 */
import { NEmpty, NSpin, useMessage } from 'naive-ui'
import { isRef, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { getMatchDetail } from '@/api/matches'
import type { MatchDetail } from '@/api/types'
import MatchCard from '@/components/match-card/MatchCard.vue'
import { createLogger } from '@/utils/logger'
import { useMatchAnalysis } from '@/composables/useMatchAnalysis'
import type { MatchAnalysisState } from '@/composables/useMatchAnalysis'

const logger = createLogger('MatchDetail')
const message = useMessage()
const route = useRoute()

// 路由参数中的对局 ID
const gameId = Number(route.params.gameId)

const loading = ref(false)
/** 对局详情：加载成功后作为 MatchCard 的 summary 传入 */
const summary = ref<MatchDetail | null>(null)
/** AI 分析状态：详情加载成功后创建（加载前不读写任何无效缓存键） */
const analysisState = ref<MatchAnalysisState | null>(null)

/** 显式同步 reasoning 折叠状态，保证详情页父层状态是唯一来源。 */
function handleReasoningCollapsed(collapsed: boolean): void {
  const state = analysisState.value
  if (!state) return
  // MatchCard props 会自动解包 Ref，使用 composable 的切换操作避免直接写入布尔值。
  const current = isRef(state.reasoningCollapsed)
    ? state.reasoningCollapsed.value
    : state.reasoningCollapsed
  if (current !== collapsed) state.toggleReasoning()
}

onMounted(async () => {
  loading.value = true

  try {
    summary.value = await getMatchDetail(gameId)
    logger.info('Match detail loaded', {
      gameId,
      participants: summary.value.participants.length
    })
    // 详情就绪后才允许创建分析状态：gameId + selfPuuid 与列表页完全一致，
    // 列表页生成过的成功快照会直接恢复（reasoning 默认折叠）。
    analysisState.value = useMatchAnalysis({
      gameId,
      puuid: summary.value.selfPuuid,
      onNetworkError: (messageText) => message.error(messageText)
    })
  } catch (error) {
    logger.error('Failed to load match detail', { gameId, error })
    message.error('对局详情加载失败：对局不存在或后端未启动')
  }

  loading.value = false
})
</script>

<template>
  <div class="min-h-screen bg-base text-ink">
    <main class="mx-auto max-w-6xl space-y-5 px-4 py-6 lg:px-8">
      <n-spin :show="loading">
        <!-- 对局卡片：展开态展示详情面板（总览：队伍表格）；AI 状态受控制于页面层 -->
        <MatchCard
          v-if="summary"
          :summary="summary"
          :details="null"
          :puuid="summary.selfPuuid"
          is-expanded
          :analyzing="analysisState?.analyzing"
          :result="analysisState?.result"
          :reasoning="analysisState?.reasoning"
          :reasoning-collapsed="analysisState?.reasoningCollapsed"
          :from-cache="analysisState?.fromCache"
          :error-msg="analysisState?.errorMsg"
          :truncated-tip="analysisState?.truncatedTip"
          @analyze="analysisState?.analyze()"
          @update:reasoning-collapsed="handleReasoningCollapsed"
        />

        <!-- 加载失败空态 -->
        <n-empty v-else-if="!loading" description="对局不存在" />
      </n-spin>
    </main>
  </div>
</template>
