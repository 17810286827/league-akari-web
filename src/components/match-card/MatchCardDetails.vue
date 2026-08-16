<template>
  <!-- expanded details：玻璃终端面板（半透明毛玻璃 + 紫描边 + 柔和投影）
       精简版：只保留"总览"（队伍表格），其余 Tab（详尽/符文/事件/构建/时间线）按需求移除 -->
  <div
    class="glass-card transition-width @container relative mt-1 box-border w-full overflow-hidden rounded-xl border border-solid p-2"
    :class="cardBorderClass"
  >
    <MatchCardSummaryTab />
  </div>
</template>

<script lang="ts" setup>
import { useCardBorderClass } from './utils/theme'
import MatchCardSummaryTab from './tabs/MatchCardSummaryTab.vue'

const cardBorderClass = useCardBorderClass()
</script>

<style scoped>
@import './match-card.css';
</style>
