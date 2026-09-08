<!-- CDN 图片组件：替换原版 LcuImage（akari:// 协议）
     path 与 LcuImage 的 src 语义一致——接受 LCU 资源路径（/lol-game-data/...，经 resolveAssetUrl 转 CDN URL），
     也接受已解析的完整 URL（如 game-resource 的 iconUrl / gtimg 直链，直接透传）；
     图片加载失败的降级链路有两套接口（新接口优先）：
     - sources（多级降级链，ADR 0004）：源数组逐级回退，全失败渲染灰色占位
     - path + fallback（旧接口，装备双源 ADR 0003）：主源失败换兜底重试一次 → 仍失败灰占位 -->
<script setup lang="ts">
/**
 * 组件用途：替代原版 LcuImage（akari:// 协议），
 * 任务 7 照搬组件统一用它加载 CDN 图片
 */
import { computed, ref, watch } from 'vue'

import { resolveAssetUrl } from '@/utils/game-resource'
import { isLocalIconUrl } from '@/utils/icon-url'

/** class 接受与原生元素一致的形态（字符串/对象/数组，透传给 img） */
type ClassValue = string | Record<string, boolean> | Array<string | Record<string, boolean>>

const props = withDefaults(
  defineProps<{
    /** 主源图片地址（LCU 路径或完整 URL）——旧接口，sources 存在时被忽略 */
    path?: string
    /** 兜底源地址（可选）：主源加载失败时换用重试一次，如装备图标的 CDragon 资源地址 */
    fallback?: string
    /**
     * 多级降级链（ADR 0004 图标本地化）：源数组按序逐级回退，如装备的
     * 本地 → DDragon → CDragon；传本属性时忽略 path/fallback。
     * 数组元素语义与 path 一致（LCU 路径或完整 URL）
     */
    sources?: string[]
    class?: ClassValue
    alt?: string
  }>(),
  { path: undefined, fallback: undefined, sources: undefined, class: undefined, alt: '' }
)

/** 新接口（sources）生效标志：未传时走旧接口（path + fallback），保持向后兼容 */
const useSources = computed(() => Array.isArray(props.sources))

/**
 * 归一化为多级降级链：
 * - 新接口：sources 原样使用
 * - 旧接口：path 为主源，fallback 存在时追加为次源（无 fallback 时仅主源，失败直接灰占位）
 */
const chain = computed<string[]>(() => {
  if (useSources.value) {
    return props.sources ?? []
  }
  const legacy: string[] = []
  if (props.path !== undefined) {
    legacy.push(props.path)
  }
  if (props.fallback !== undefined) {
    legacy.push(props.fallback)
  }
  return legacy
})

// 当前源在链中的索引（@error 时递增；越界即链耗尽，渲染灰占位）
const sourceIndex = ref(0)

// 当前源的渲染地址：本地化图标直接透传；LCU 路径经 resolveAssetUrl 转 CDN URL；完整 URL 透传
const src = computed(() => {
  const current = chain.value[sourceIndex.value]
  if (current === undefined) {
    return ''
  }
  // 本地化图标（/icons/...）是站点相对路径，禁止拼接 CDN 前缀
  if (isLocalIconUrl(current)) {
    return current
  }
  // 非法路径（不以 / 开头）时 resolveAssetUrl 返回 null，回退原值（此时为已解析的完整 URL）
  return resolveAssetUrl(current) ?? current
})

// 链变化时重置失败索引，避免组件复用时残留旧的降级状态（如列表虚拟滚动复用）
watch(
  () => chain.value,
  () => {
    sourceIndex.value = 0
  }
)
</script>

<template>
  <!-- 链未耗尽：渲染当前源，失败推进到下一级 -->
  <img
    v-if="sourceIndex < chain.length"
    :src="src"
    :class="props.class"
    :alt="props.alt"
    loading="lazy"
    @dragstart.prevent
    @error="sourceIndex += 1"
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
