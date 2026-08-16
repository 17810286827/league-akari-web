<template>
  <!-- 悬浮卡片：展示符文名称与描述（描述为填充数值后的 HTML） -->
  <NPopover v-if="perkDisplay && perkDisplay.name" :delay="50">
    <template #trigger>
      <CdnImage
        :path="perkDisplay.iconUrl"
        v-bind="$attrs"
        :style="{ width: `${size}px`, height: `${size}px` }"
        class="perk"
      />
    </template>
    <div :style="{ 'max-width': `${maxWidth}px` }" class="info">
      <CdnImage class="image" :path="perkDisplay.iconUrl" />
      <div class="right-side">{{ perkDisplay.name }}</div>
    </div>
    <div
      :style="{ 'max-width': `${maxWidth}px` }"
      style="font-size: 12px"
      lol-view
      v-html="perkDisplay.descriptionHtml"
    ></div>
  </NPopover>
  <!-- 空槽占位：perkId 为空或未知符文时渲染 -->
  <div
    v-else
    :style="{ width: `${size}px`, height: `${size}px` }"
    v-bind="$attrs"
    class="empty"
  ></div>
</template>

<script setup lang="ts">
import { NPopover } from 'naive-ui'
import { onBeforeUnmount, ref, watch } from 'vue'

import CdnImage from './CdnImage.vue'
import { perkDisplay as fetchPerkDisplay, type PerkDisplayResource } from '@/utils/game-resource'

const { perkId, size = 20, maxWidth = 400 } = defineProps<{
  perkId?: number
  size?: number
  maxWidth?: number
}>()

/** 符文展示资源（异步加载；web 数据层为空壳非空契约，未知名称空串） */
const perkDisplay = ref<PerkDisplayResource | null>(null)

// 查询序号：防止快速切换符文时旧响应覆盖新内容
let requestSeq = 0

/** 加载符文信息（perkId 变化时重新加载；0/undefined 视为空槽） */
async function load(): Promise<void> {
  const seq = ++requestSeq
  if (!perkId) {
    perkDisplay.value = null
    return
  }
  perkDisplay.value = await fetchPerkDisplay(perkId)
  // 仅在仍是最新请求时保留结果
  if (seq !== requestSeq) {
    perkDisplay.value = null
  }
}

watch(() => perkId, load, { immediate: true })

// 组件卸载时使在途请求失效
onBeforeUnmount(() => {
  requestSeq += 1
})
</script>

<style scoped>
@reference '../../styles/tailwind.css';

@layer components {
  .perk,
  .empty {
    border-radius: 2px;
  }

  .info {
    display: flex;
    align-items: center;
    margin-bottom: 8px;

    .image {
      border-radius: 2px;
      height: 28px;
    }

    .right-side {
      margin-left: 8px;
      font-size: 12px;
      font-weight: bold;
    }
  }

  .empty {
    @apply bg-gray-500/40 dark:bg-black/20;
  }
}
</style>
