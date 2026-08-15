<script setup lang="ts">
/**
 * 对局详情页（三段式布局）：
 * 顶部摘要区（模式/时长/KDA/参与率/CS/评分/装备/队友）→ 中部队伍数据区（双队表格）→ 底部资源统计区
 * 数据来自后端接口（getMatchDetail），经 adapter 转换为展示结构
 */
import { NEmpty, NSpin, useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { getMatchDetail } from '@/api/matches'
import { createLogger } from '@/utils/logger'

import { toMatchDetailView, type MatchDetailView } from './adapter'
import MatchSummaryHeader from './MatchSummaryHeader.vue'
import ResourceStatsBanner from './ResourceStatsBanner.vue'
import TeamStatsTable from './TeamStatsTable.vue'

const logger = createLogger('MatchDetail')
const message = useMessage()
const route = useRoute()

// 路由参数中的对局 ID
const gameId = Number(route.params.gameId)

const loading = ref(false)
const view = ref<MatchDetailView | null>(null)

/** 队伍列表：蓝队（100）在前 */
const teams = computed(() => view.value?.teams ?? [])

onMounted(async () => {
  loading.value = true
  try {
    const detail = await getMatchDetail(gameId)
    view.value = toMatchDetailView(detail)
    logger.info('Match detail loaded', { gameId, teams: detail.participants.length })
  } catch (error) {
    logger.error('Failed to load match detail', { gameId, error })
    message.error('对局详情加载失败：对局不存在或后端未启动')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-base text-ink">
    <main class="mx-auto max-w-6xl space-y-5 px-4 py-6 lg:px-8">
      <n-spin :show="loading">
        <template v-if="view">
          <!-- 一、顶部摘要区 -->
          <MatchSummaryHeader :summary="view.summary" />

          <!-- 二、中部队伍数据区：宽屏左右两列，窄屏垂直堆叠 -->
          <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <TeamStatsTable v-for="team in teams" :key="team.teamId" :team="team" />
          </div>

          <!-- 三、底部资源统计区 -->
          <ResourceStatsBanner :teams="teams" :resources="view.resources" />
        </template>

        <!-- 加载失败空态 -->
        <n-empty v-else-if="!loading" description="对局不存在" />
      </n-spin>
    </main>
  </div>
</template>
