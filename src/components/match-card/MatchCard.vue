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
  <!-- min-w-0：不设最小宽度，窄视口（手机）下卡片随容器收缩，
       内部 @[680px]/@[700px] 等容器查询才能按真实宽度生效（原实现固定 700px 最小宽度
       会把战绩列表/详情页整体撑出横向滚动条，是移动端溢出的根因） -->
  <div class="relative w-full min-w-0">
    <MatchCardOverview @toggle-expand="isExpanded = !isExpanded" />

    <KeepAlive>
      <MatchCardDetails
        v-if="!props.puuid || isExpanded"
        :analyzing="props.analyzing"
        :result="props.result"
        :reasoning="props.reasoning"
        :reasoning-collapsed="props.reasoningCollapsed"
        :from-cache="props.fromCache"
        :error-msg="props.errorMsg"
        :truncated-tip="props.truncatedTip"
        @analyze="emits('analyze')"
        @update:reasoning-collapsed="(v: boolean) => emits('update:reasoningCollapsed', v)"
      />
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

const props = withDefaults(
  defineProps<{
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
    /** 以下为 AI 分析受控状态：由页面层持有，读入后透传给 MatchCardDetails */
    analyzing?: boolean
    result?: string
    reasoning?: string
    reasoningCollapsed?: boolean
    fromCache?: boolean
    errorMsg?: string
    truncatedTip?: string
  }>(),
  {
    details: null,
    hidePrivacy: false,
    loadingDetails: false,
    analyzing: false,
    result: '',
    reasoning: '',
    reasoningCollapsed: true,
    fromCache: false,
    errorMsg: '',
    truncatedTip: ''
  }
)

const emits = defineEmits<{
  loadDetails: [gameId: number]
  navigateToSummonerByPuuid: [puuid: string, setCurrent?: boolean]
  /** 分析触发通知（由 MatchCardDetails 转发至页面层） */
  analyze: []
  'update:reasoningCollapsed': [collapsed: boolean]
}>()

const isExpanded = defineModel<boolean>('isExpanded', {
  required: false,
  default: false
})

provideMatchCard({
  isExpanded: () => isExpanded.value,
  summary: () => props.summary,
  puuid: () => props.puuid,
  details: () => props.details,
  hidePrivacy: () => props.hidePrivacy,
  loadingDetails: () => props.loadingDetails,

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
