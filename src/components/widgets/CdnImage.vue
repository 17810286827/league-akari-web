<!-- CDN 图片组件：替换原版 LcuImage（akari:// 协议），LCU 资源路径经 resolveAssetUrl 转 CDN URL -->
<script setup lang="ts">
import { computed } from 'vue'

import { resolveAssetUrl } from '@/utils/game-resource'

const props = withDefaults(
  defineProps<{ path: string; class?: string; alt?: string }>(),
  { class: undefined, alt: '' }
)

// 非法路径（不以 / 开头）时 resolveAssetUrl 返回 null，兜底为空串避免 src 失效
const src = computed(() => resolveAssetUrl(props.path) ?? '')
</script>

<template>
  <img :src="src" :class="props.class" :alt="props.alt" loading="lazy" />
</template>
