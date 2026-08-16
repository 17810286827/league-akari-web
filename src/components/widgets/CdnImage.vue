<!-- CDN 图片组件：替换原版 LcuImage（akari:// 协议）
     path 与 LcuImage 的 src 语义一致——接受 LCU 资源路径（/lol-game-data/...，经 resolveAssetUrl 转 CDN URL），
     也接受已解析的完整 URL（如 game-resource 的 iconUrl / gtimg 直链，直接透传）；
     图片加载失败时回退灰色占位（同 LcuImage 的 placeholder 行为） -->
<script setup lang="ts">
/**
 * 组件用途：替代原版 LcuImage（akari:// 协议），
 * 任务 7 照搬组件统一用它加载 CDN 图片
 */
import { computed, ref, watch } from 'vue'

import { resolveAssetUrl } from '@/utils/game-resource'

/** class 接受与原生元素一致的形态（字符串/对象/数组，透传给 img） */
type ClassValue = string | Record<string, boolean> | Array<string | Record<string, boolean>>

const props = withDefaults(
  defineProps<{ path: string; class?: ClassValue; alt?: string }>(),
  { class: undefined, alt: '' }
)

// 非法路径（不以 / 开头）时 resolveAssetUrl 返回 null，回退原值（此时为已解析的完整 URL）
const src = computed(() => resolveAssetUrl(props.path) ?? props.path)

// 图片加载失败标记（如未知英雄 -1 的图标缺失），失败后渲染灰色占位（对齐 LcuImage 的 placeholder）
const failed = ref(false)
// path 变化时重置失败标记，避免组件复用时残留旧的失败状态
watch(
  () => props.path,
  () => {
    failed.value = false
  }
)
</script>

<template>
  <img
    v-if="!failed"
    :src="src"
    :class="props.class"
    :alt="props.alt"
    loading="lazy"
    @dragstart.prevent
    @error="failed = true"
  />
  <!-- 加载失败占位：与 LcuImage 的 .lcu-image-placeholder 一致（灰底圆角，暗色模式加深） -->
  <div v-else class="cdn-image-placeholder" :class="props.class" />
</template>

<style scoped>
/* 失败占位底色：gray-500/40，暗色模式 black/20（对齐原版 @apply 语义） */
.cdn-image-placeholder {
  box-sizing: border-box;
  border-radius: 0.25rem;
  background-color: rgb(128 128 128 / 0.4);
}

@media (prefers-color-scheme: dark) {
  .cdn-image-placeholder {
    background-color: rgb(0 0 0 / 0.2);
  }
}
</style>
