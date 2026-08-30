<!--
  海克斯魔典页面壳（ADR 0002）：深蓝底 + 魔典字体 + 居中窄容器 + 上下符文分隔线。
  车队周报与榜单中心共用，保证两页的卷轴式版式一致。
-->
<script setup lang="ts">
import RuneDivider from './RuneDivider.vue'

withDefaults(
  defineProps<{
    /** 内容最大宽度（Tailwind 断点名） */
    maxWidth?: '4xl' | '5xl' | '6xl'
  }>(),
  { maxWidth: '4xl' }
)
</script>

<template>
  <div class="min-h-screen bg-hex-blue px-6 pb-24 pt-8 font-hex">
    <div class="mx-auto" :class="maxWidth === '6xl' ? 'max-w-6xl' : maxWidth === '5xl' ? 'max-w-5xl' : 'max-w-4xl'">
      <RuneDivider />
      <slot />
      <RuneDivider class="mt-10" />
    </div>
  </div>
</template>
