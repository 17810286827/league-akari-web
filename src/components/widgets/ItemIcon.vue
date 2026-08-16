<script setup lang="ts">
/**
 * 装备图标薄包装：内部复用 ItemDisplay 的图标 + 悬浮卡片能力（1:1 对齐原版 widgets/ItemDisplay）
 * props 保持既有契约 { itemId: number; size?: number }，兼容 game-stats/player-profile 调用点
 */
import ItemDisplay from './ItemDisplay.vue'

const { itemId, size = 24 } = defineProps<{
  /** 物品 ID（0 或空表示空槽） */
  itemId: number
  /** 图标尺寸（px） */
  size?: number
}>()
</script>

<template>
  <!-- itemId 为 0 时 ItemDisplay 内部渲染空槽占位 -->
  <ItemDisplay :item-id="itemId" :size="size" />
</template>
