<!-- CDN 图片组件：替换原版 LcuImage（akari:// 协议）
     path 与 LcuImage 的 src 语义一致——接受 LCU 资源路径（/lol-game-data/...，经 resolveAssetUrl 转 CDN URL），
     也接受已解析的完整 URL（如 game-resource 的 iconUrl / gtimg 直链，直接透传）；
     图片加载失败的降级链路：可选 fallback（兜底源）重试一次 → 仍失败渲染灰色占位
     （无 fallback 时保持旧行为：失败直接灰占位，对齐 LcuImage 的 placeholder） -->
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
  defineProps<{
    /** 主源图片地址（LCU 路径或完整 URL） */
    path: string
    /** 兜底源地址（可选）：主源加载失败时换用重试一次，如装备图标的 CDragon 资源地址 */
    fallback?: string
    class?: ClassValue
    alt?: string
  }>(),
  { fallback: undefined, class: undefined, alt: '' }
)

// 非法路径（不以 / 开头）时 resolveAssetUrl 返回 null，回退原值（此时为已解析的完整 URL）
const src = computed(() => resolveAssetUrl(props.path) ?? props.path)

// 主源加载失败标记（如 ddragon 版本交界期缺新装备图标）
const failed = ref(false)
// 兜底源加载失败标记：主源与兜底源均失败后才渲染灰占位
const fallbackFailed = ref(false)
// path 变化时重置两级失败标记，避免组件复用时残留旧的失败状态
watch(
  () => props.path,
  () => {
    failed.value = false
    fallbackFailed.value = false
  }
)
</script>

<template>
  <!-- 第一级：主源 -->
  <img
    v-if="!failed"
    :src="src"
    :class="props.class"
    :alt="props.alt"
    loading="lazy"
    @dragstart.prevent
    @error="failed = true"
  />
  <!-- 第二级：兜底源（未配置 fallback 或兜底也已失败时跳过，直接灰占位） -->
  <img
    v-else-if="fallback && !fallbackFailed"
    :src="fallback"
    :class="props.class"
    :alt="props.alt"
    loading="lazy"
    @dragstart.prevent
    @error="fallbackFailed = true"
  />
  <!-- 最终占位：与 LcuImage 的 .lcu-image-placeholder 一致（灰底圆角，暗色模式加深） -->
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
