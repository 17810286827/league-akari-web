<!--
  区块标题：符文符号 + 金色标题 + 右侧补充信息（人数等），
  用于榜单面板/名场面/AI 锐评等区块的标题行。
-->
<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 标题文案 */
    title: string
    /** 右侧补充信息（如 "5 人登榜"），缺省不显示 */
    meta?: string
    /** 标题前的符文符号 */
    symbol?: string
  }>(),
  { symbol: '❖' }
)
</script>

<template>
  <h2 class="mb-4 flex items-center gap-2 text-lg font-bold tracking-[0.1em] text-hex-gold">
    <span class="text-hex-gold/70">{{ symbol }}</span>{{ title }}
    <span v-if="meta" class="ml-auto text-sm font-normal tracking-normal text-slate-400">{{ meta }}</span>
  </h2>
</template>
