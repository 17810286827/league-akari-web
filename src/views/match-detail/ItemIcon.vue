<script setup lang="ts">
/**
 * 装备图标组件：点击弹出装备名称与属性（ddragon 物品数据懒加载 + 内存缓存）
 * 数据未就绪时显示"加载中"，失败时仅显示名称占位
 */
import { NPopover } from 'naive-ui'
import { onBeforeUnmount, ref, watch } from 'vue'

import { itemIconUrl } from '@/utils/icon-url'

import { getItemDescription, getItemName } from './use-item-info'

const props = defineProps<{ itemId: number }>()

/** 装备名称（异步加载） */
const name = ref('')
/** 装备属性描述（异步加载） */
const description = ref('')
/** 是否已请求过数据（避免重复请求） */
const loaded = ref(false)

// 当前查询的请求序号：防止快速切换物品时旧响应覆盖新内容
let requestSeq = 0

/** 点击时异步加载装备信息（仅加载一次） */
async function loadItemInfo(): Promise<void> {
  if (loaded.value) {
    return
  }
  const seq = ++requestSeq
  name.value = ''
  description.value = ''
  const [loadedName, loadedDescription] = await Promise.all([
    getItemName(props.itemId),
    getItemDescription(props.itemId)
  ])
  // 仅在仍是最新请求时写入（避免异步竞态）
  if (seq === requestSeq) {
    name.value = loadedName
    description.value = loadedDescription
    loaded.value = true
  }
}

// 物品 ID 变化时重置状态（列表复用场景）
watch(
  () => props.itemId,
  () => {
    loaded.value = false
    name.value = ''
    description.value = ''
  }
)

// 组件卸载时使在途请求失效
onBeforeUnmount(() => {
  requestSeq += 1
})
</script>

<template>
  <!-- 点击触发弹出层，展示装备名称与属性 -->
  <NPopover trigger="click" placement="top" :show-arrow="true">
    <template #trigger>
      <img
        :src="itemIconUrl(itemId)"
        :alt="`装备 ${itemId}`"
        class="size-8 cursor-pointer rounded-sm border border-hairline bg-surface transition-transform hover:scale-110"
        @click="loadItemInfo"
      />
    </template>
    <div class="max-w-56">
      <p class="mb-1 text-sm font-bold text-ink">{{ name || '加载中…' }}</p>
      <p v-if="description" class="text-xs leading-relaxed text-ink-muted">{{ description }}</p>
    </div>
  </NPopover>
</template>
