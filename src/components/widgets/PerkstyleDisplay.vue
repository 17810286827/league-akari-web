<template>
  <!-- 悬浮卡片：展示符文页样式名称与说明 -->
  <NPopover v-if="perkStyleDisplay && perkStyleDisplay.name" :delay="50">
    <template #trigger>
      <CdnImage
        :path="perkStyleDisplay.iconUrl"
        v-bind="$attrs"
        :style="{ width: `${size}px`, height: `${size}px` }"
        class="perkstyle"
      />
    </template>
    <div style="width: 180px" class="info">
      <CdnImage class="image" :path="perkStyleDisplay.iconUrl" />
      <div class="right-side">{{ perkStyleDisplay.name }}</div>
    </div>
    <div style="max-width: 180px; font-size: 12px">
      {{ perkStyleDisplay.tooltip }}
    </div>
  </NPopover>
  <!-- 空槽占位：perkstyleId 为空或未知样式时渲染 -->
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
import {
  perkstyleDisplay as fetchPerkstyleDisplay,
  type PerkstyleDisplayResource
} from '@/utils/game-resource'

const { perkstyleId, size = 20 } = defineProps<{
  perkstyleId?: number
  size?: number
}>()

/** 符文页样式展示资源（异步加载；web 数据层为空壳非空契约，未知名称空串） */
const perkStyleDisplay = ref<PerkstyleDisplayResource | null>(null)

// 查询序号：防止快速切换样式时旧响应覆盖新内容
let requestSeq = 0

/** 加载符文页样式信息（perkstyleId 变化时重新加载；0/undefined 视为空槽） */
async function load(): Promise<void> {
  const seq = ++requestSeq
  if (!perkstyleId) {
    perkStyleDisplay.value = null
    return
  }
  perkStyleDisplay.value = await fetchPerkstyleDisplay(perkstyleId)
  // 仅在仍是最新请求时保留结果
  if (seq !== requestSeq) {
    perkStyleDisplay.value = null
  }
}

watch(() => perkstyleId, load, { immediate: true })

// 组件卸载时使在途请求失效
onBeforeUnmount(() => {
  requestSeq += 1
})
</script>

<style scoped>
@reference '../../styles/tailwind.css';

@layer components {
  .perkstyle,
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
