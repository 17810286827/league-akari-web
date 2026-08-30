<!--
  【原型】榜单中心路由闸门（挂载在既有 /leaderboards 路由上）：
  dev 构建 + ?variant=A~E 时渲染五方案评审宿主，否则渲染原页面 LeaderboardsView。
  生产构建 import.meta.env.DEV 恒为 false，评审宿主不会挂载；
  评审完成后：胜出方案回填 LeaderboardsView.vue，本目录与路由改动一并移除。
-->
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import LeaderboardsView from '../LeaderboardsView.vue'
import PrototypeLeaderboardsHost from './PrototypeLeaderboardsHost.vue'
import { PROTOTYPE_VARIANTS } from '@/components/prototype/variants'

const route = useRoute()

/** 命中的原型方案 key：非 dev 构建恒为 null；非法取值也按原页面处理 */
const variant = computed(() => {
  if (!import.meta.env.DEV) {
    return null
  }
  const value = route.query.variant
  const valid = typeof value === 'string' && PROTOTYPE_VARIANTS.some((item) => item.key === value)
  return valid ? (value as string) : null
})
</script>

<template>
  <PrototypeLeaderboardsHost v-if="variant" :variant-key="variant" />
  <LeaderboardsView v-else />
</template>
