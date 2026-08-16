<!--
  对局卡片入口：折叠卡总览 + 详情面板（任务 11 接入）
  原版结构：<KeepAlive><MatchCardDetails v-if="!puuid || isExpanded" /></KeepAlive>
-->
<template>
  <!--
    web 版移除原版 content-visibility 优化（[contain-intrinsic-size:116px] [content-visibility:auto]）：
    展开态容器实际高度 = 折叠卡 116px + 详情面板（数百 px），估算高度仅 116px，
    首次展开/滚动回视口时会按估算高度布局再突变到实际高度，造成卡片跳动；
    web 列表折叠卡本就直接渲染 MatchCardOverview（无此优化），移除后行为一致
  -->
  <div class="relative w-full min-w-175">
    <MatchCardOverview @toggle-expand="isExpanded = !isExpanded" />

    <KeepAlive>
      <MatchCardDetails v-if="!puuid || isExpanded" />
    </KeepAlive>
  </div>
</template>

<script lang="ts" setup>
import { onErrorCaptured } from 'vue'

import type { MatchDetail } from '@/api/types'
import type { MatchCardGameDetails } from '@/views/match-detail/adapter/types'

import MatchCardDetails from './MatchCardDetails.vue'
import MatchCardOverview from './MatchCardOverview.vue'
import { provideMatchCard } from './context'

const {
  summary,
  puuid,
  details = null,
  hidePrivacy = false,
  loadingDetails = false
} = defineProps<{
  /** 对局详情（web 的 summary 即完整 MatchDetail，参与者/队伍快照均在内） */
  summary: MatchDetail
  /** 对局详情（时间线）数据：未加载为 null（挂载方负责调用 loadDetails 装载） */
  details?: MatchCardGameDetails | null
  /** 当前聚焦玩家 PUUID（高亮所在行） */
  puuid?: string
  /** 隐私模式：隐藏召唤师名，用英雄名代替 */
  hidePrivacy?: boolean
  /** 详情（时间线）加载中标记（任务 11 详情面板消费） */
  loadingDetails?: boolean
}>()

const emits = defineEmits<{
  loadDetails: [gameId: number]
  navigateToSummonerByPuuid: [puuid: string, setCurrent?: boolean]
}>()

const isExpanded = defineModel<boolean>('isExpanded', {
  required: false,
  default: false
})

provideMatchCard({
  isExpanded: () => isExpanded.value,
  summary: () => summary,
  puuid: () => puuid,
  details: () => details,
  hidePrivacy: () => hidePrivacy,
  loadingDetails: () => loadingDetails,

  navigateToSummonerByPuuid: (puuid: string, setCurrent?: boolean) => {
    emits('navigateToSummonerByPuuid', puuid, setCurrent)
  },
  loadDetails: (gameId: number) => {
    emits('loadDetails', gameId)
  }
})

onErrorCaptured((error) => {
  console.error(error)
})

defineExpose({
  setExpanded: (expanded: boolean) => {
    isExpanded.value = expanded
  }
})
</script>
