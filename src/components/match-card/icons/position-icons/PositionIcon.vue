<template>
  <NIcon>
    <component :is="POSITIONS[position.toUpperCase()] || POSITIONS['ALL']" />
  </NIcon>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { NIcon } from 'naive-ui'

import PositionAll from './PositionAll.vue'
import PositionBottom from './PositionBottom.vue'
import PositionJungle from './PositionJungle.vue'
import PositionMiddle from './PositionMiddle.vue'
import PositionSupport from './PositionSupport.vue'
import PositionTop from './PositionTop.vue'

/** 位置映射表：位置别名 → 图标组件（未知位置回退 ALL） */
const POSITIONS: Record<string, Component> = {
  ALL: PositionAll,
  FILL: PositionAll,
  BOTTOM: PositionBottom,
  BOT: PositionBottom,
  JUNGLE: PositionJungle,
  JUG: PositionJungle,
  MID: PositionMiddle,
  MIDDLE: PositionMiddle,
  TOP: PositionTop,
  UTILITY: PositionSupport,
  ADC: PositionBottom,
  SUPPORT: PositionSupport
}

const { position = 'ALL' } = defineProps<{
  position?: string
}>()
</script>

<style scoped>
.icon {
  display: inline-block;
  width: 1em;
  height: 1em;
}
</style>
