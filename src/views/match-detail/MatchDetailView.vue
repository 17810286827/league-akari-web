<script setup lang="ts">
/**
 * 对局详情页（任务 13：MatchCard 展开态，替换旧三段式布局）：
 * getMatchDetail 加载对局详情 → 作为 summary 传给 MatchCard（isExpanded=true），
 * 卡片内部经适配层（toBasicInfo/toParticipants/toMatchCardTeams）组装 basicInfo/participants/teams；
 * getMatchTimeline 并行加载时间线，成功后归一化为 details（{ frames }）注入时间线 Tab，
 * 失败仅 warn 日志，不阻塞折叠卡展示（时间线 Tab 显示空态）
 */
import { NEmpty, NSpin, useMessage } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { getMatchDetail, getMatchTimeline } from '@/api/matches'
import type { MatchDetail } from '@/api/types'
import MatchCard from '@/components/match-card/MatchCard.vue'
import { createLogger } from '@/utils/logger'

import { toMatchCardFrames } from './adapter/match-card-timeline'
import type { MatchCardGameDetails } from './adapter/types'

const logger = createLogger('MatchDetail')
const message = useMessage()
const route = useRoute()

// 路由参数中的对局 ID
const gameId = Number(route.params.gameId)

const loading = ref(false)
/** 对局详情：加载成功后作为 MatchCard 的 summary 传入 */
const summary = ref<MatchDetail | null>(null)
/** 对局时间线（details）：加载成功后归一化为 { frames } 注入，失败保持 null（时间线 Tab 空态） */
const details = ref<MatchCardGameDetails | null>(null)

onMounted(async () => {
  loading.value = true

  // 详情与时间线并行加载：任一失败互不阻塞（详情失败显示错误态，时间线失败仅 warn）
  const [detailResult, timelineResult] = await Promise.allSettled([
    getMatchDetail(gameId),
    getMatchTimeline(gameId)
  ])

  if (detailResult.status === 'fulfilled') {
    summary.value = detailResult.value
    logger.info('Match detail loaded', {
      gameId,
      participants: detailResult.value.participants.length
    })
  } else {
    logger.error('Failed to load match detail', { gameId, error: detailResult.reason })
    message.error('对局详情加载失败：对局不存在或后端未启动')
  }

  if (timelineResult.status === 'fulfilled') {
    details.value = { frames: toMatchCardFrames(timelineResult.value) }
    logger.info('Match timeline loaded', { gameId, frames: timelineResult.value.length })
  } else {
    logger.warn('Failed to load match timeline', { gameId, error: timelineResult.reason })
  }

  loading.value = false
})
</script>

<template>
  <div class="min-h-screen bg-base text-ink">
    <main class="mx-auto max-w-6xl space-y-5 px-4 py-6 lg:px-8">
      <n-spin :show="loading">
        <!-- 对局卡片：展开态展示详情面板（总览/详尽表格/符文/事件/时间线 Tab） -->
        <MatchCard
          v-if="summary"
          :summary="summary"
          :details="details"
          :puuid="summary.selfPuuid"
          is-expanded
        />

        <!-- 加载失败空态 -->
        <n-empty v-else-if="!loading" description="对局不存在" />
      </n-spin>
    </main>
  </div>
</template>
