<script setup lang="ts">
/**
 * 装备图标 + 描述（对齐主仓库 game-resource 机制）：
 * 图标（CommunityDragon CDN）点击/悬浮弹出名称、价格与属性描述
 * 数据来自 game-resource（items.json），未知物品显示空槽占位
 */
import { NPopover } from 'naive-ui'
import { onBeforeUnmount, ref, watch } from 'vue'

import { itemDisplay, type ItemDisplayResource } from '@/utils/game-resource'

const props = withDefaults(
  defineProps<{
    /** 物品 ID（0 或空表示空槽） */
    itemId: number
    /** 图标尺寸（px） */
    size?: number
  }>(),
  { size: 24 }
)

/** 物品展示资源（异步加载） */
const display = ref<ItemDisplayResource | null>(null)
/** 是否请求过（空槽或已加载则不再请求） */
const requested = ref(false)

// 查询序号：防止快速切换物品时旧响应覆盖新内容
let requestSeq = 0

/** 加载物品信息（点击时触发，仅加载一次） */
async function load(): Promise<void> {
  if (requested.value || props.itemId <= 0) {
    return
  }
  requested.value = true
  const seq = ++requestSeq
  display.value = await itemDisplay(props.itemId)
  // 仅在仍是最新请求时保留结果
  if (seq !== requestSeq) {
    display.value = null
  }
}

// 物品 ID 变化时重置状态（列表复用场景）
watch(
  () => props.itemId,
  () => {
    requested.value = false
    display.value = null
  }
)

// 组件卸载时使在途请求失效
onBeforeUnmount(() => {
  requestSeq += 1
})
</script>

<template>
  <!-- 空槽：暗色占位 -->
  <span
    v-if="itemId <= 0"
    class="item-icon item-icon-empty"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
  />
  <!-- 有效物品：图标 + 点击弹出名称/价格/描述 -->
  <NPopover v-else trigger="click" placement="top">
    <template #trigger>
      <img
        :src="display?.iconUrl"
        :alt="display?.name ?? `物品 ${itemId}`"
        class="item-icon"
        :style="{ width: `${size}px`, height: `${size}px` }"
        @click="load"
      />
    </template>
    <div class="max-w-56">
      <p class="item-name">{{ display?.name ?? '加载中…' }}</p>
      <p v-if="display" class="item-price">{{ display.totalPrice }} 金币</p>
      <p v-if="display" class="item-desc">{{ display.descriptionHtml }}</p>
    </div>
  </NPopover>
</template>

<style lang="scss" scoped>
/* 装备图标：圆角小方块 */
.item-icon {
  display: inline-block;
  border-radius: 3px;
  border: 1px solid var(--border);
  flex-shrink: 0;
  background: var(--surface-hover);
}

/* 空槽占位 */
.item-icon-empty {
  opacity: 0.4;
}

.item-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 2px;
}

.item-price {
  font-size: 12px;
  font-style: italic;
  color: var(--gold);
  margin-bottom: 4px;
}

.item-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text);
}
</style>
