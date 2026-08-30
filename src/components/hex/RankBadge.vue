<!--
  名次徽章：金银铜圆形徽记（1 金 / 2 银 / 3 铜，其余石灰色），
  边框与文字同色，榜单排行的签名元素。
-->
<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  /** 名次（1 起始） */
  rank: number
}>()

/** 名次 → 徽章配色（金银铜/石灰） */
const badgeClass = computed(() => {
  if (props.rank === 1) {
    return 'border-hex-gold-2/80 text-hex-gold-2'
  }
  if (props.rank === 2) {
    return 'border-hex-silver/60 text-hex-silver'
  }
  if (props.rank === 3) {
    return 'border-hex-bronze/70 text-hex-bronze'
  }
  return 'border-slate-600/50 text-slate-500'
})
</script>

<template>
  <span
    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[17px] font-bold tabular-nums"
    :class="badgeClass"
  >
    <slot>{{ rank }}</slot>
  </span>
</template>
