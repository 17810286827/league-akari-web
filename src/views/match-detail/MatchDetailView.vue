<script setup lang="ts">
/**
 * 对局详情页（任务 13：MatchCard 展开态，替换旧三段式布局）：
 * getMatchDetail 加载对局详情 → 作为 summary 传给 MatchCard（isExpanded=true），
 * 卡片内部经适配层（toBasicInfo/toParticipants/toMatchCardTeams）组装 basicInfo/participants/teams；
 * 展开详情已精简为"总览"（时间线 Tab 已移除），不再请求 /timeline 接口
 */
import { NEmpty, NSpin, useMessage } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { getMatchDetail } from '@/api/matches'
import type { MatchDetail } from '@/api/types'
import MatchCard from '@/components/match-card/MatchCard.vue'
import { createLogger } from '@/utils/logger'

const logger = createLogger('MatchDetail')
const message = useMessage()
const route = useRoute()

// 路由参数中的对局 ID
const gameId = Number(route.params.gameId)

const loading = ref(false)
/** 对局详情：加载成功后作为 MatchCard 的 summary 传入 */
const summary = ref<MatchDetail | null>(null)

onMounted(async () => {
  loading.value = true

  try {
    summary.value = await getMatchDetail(gameId)
    logger.info('Match detail loaded', {
      gameId,
      participants: summary.value.participants.length
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
        <!-- 对局卡片：展开态展示详情面板（总览：队伍表格） -->
        <MatchCard
          v-if="summary"
          :summary="summary"
          :details="null"
          :puuid="summary.selfPuuid"
          is-expanded
        />

        <!-- 加载失败空态 -->
        <n-empty v-else-if="!loading" description="对局不存在" />
      </n-spin>
    </main>
  </div>
</template>
