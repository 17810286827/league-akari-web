<template>
  <!-- 悬浮卡片：仅当物品存在（web 空壳判空约定：未知物品 name 为空串）时展示 -->
  <NPopover v-if="itemDisplay && itemDisplay.name" :delay="50" :scrollable="true" style="max-height: 50vh">
    <template #trigger>
      <CdnImage
        :path="itemDisplay.iconUrl"
        :style="{ width: `${size}px`, height: `${size}px` }"
        class="item"
        :class="{ trinket: isTrinket, item: !isTrinket }"
      />
    </template>

    <div class="info item-display-popover">
      <CdnImage class="image" :path="itemDisplay.iconUrl" />
      <div class="right-side">
        <div class="name">
          {{ itemDisplay.name }}
          <span class="font-normal text-black/50 dark:text-white/50">({{ itemDisplay.id }})</span>
        </div>
        <div class="price">
          {{ itemDisplay.totalPrice }} G
          {{
            itemDisplay.price !== itemDisplay.totalPrice
              ? `(${t('gameAssets.item.combinePrice', {
                  gold: itemDisplay.price
                })})`
              : ''
          }}
        </div>
      </div>
    </div>

    <!-- 合成组件（from）：web 数据层仅返回 id 数组，图标路径本地按 CDragon 约定组装 -->
    <div class="from" v-if="fromItems.length !== 0">
      <CdnImage
        class="image"
        :title="componentItem.name"
        :path="componentItem.iconPath"
        v-for="componentItem of fromItems"
        :key="componentItem.id"
      />
    </div>

    <!-- 升级去向（to）：结构与原版一致 -->
    <div class="to" v-if="toItems.length !== 0">
      <CdnImage
        class="image"
        :title="componentItem.name"
        :path="componentItem.iconPath"
        v-for="componentItem of toItems"
        :key="componentItem.id"
      />
    </div>

    <div
      :style="{ maxWidth: `${maxWidth}px` }"
      class="item-display-description text-xs"
      lol-view
      v-html="itemDisplay.descriptionHtml"
    />
  </NPopover>

  <!-- 空槽占位：itemId 为空或未知物品时渲染 -->
  <div
    v-else
    :style="{ width: `${size}px`, height: `${size}px` }"
    :class="{ trinket: isTrinket, item: !isTrinket }"
    v-bind="$attrs"
    class="empty"
  />
</template>

<script setup lang="ts">
import { NPopover } from 'naive-ui'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import CdnImage from './CdnImage.vue'
import { t } from '@/utils/match-card-i18n'
import { itemDisplay as fetchItemDisplay, type ItemDisplayResource } from '@/utils/game-resource'

const { itemId, isTrinket = false, size = 20, maxWidth = 400 } = defineProps<{
  itemId?: number
  isTrinket?: boolean
  maxWidth?: number
  size?: number
}>()

/** 物品展示资源（异步加载；web 数据层为空壳非空契约，未知物品 name 为空串） */
const itemDisplay = ref<ItemDisplayResource | null>(null)

// 查询序号：防止快速切换物品时旧响应覆盖新内容
let requestSeq = 0

/** 加载物品信息（itemId 变化时重新加载；0/undefined 视为空槽） */
async function load(): Promise<void> {
  const seq = ++requestSeq
  if (!itemId) {
    itemDisplay.value = null
    return
  }
  itemDisplay.value = await fetchItemDisplay(itemId)
  // 仅在仍是最新请求时保留结果
  if (seq !== requestSeq) {
    itemDisplay.value = null
  }
}

watch(() => itemId, load, { immediate: true })

// 组件卸载时使在途请求失效
onBeforeUnmount(() => {
  requestSeq += 1
})

/**
 * 合成路径内联项（原版 provider 返回 itemInline 对象数组 { id, name, iconPath }，
 * web 数据层 itemDisplay 已按同一结构返回组件资源，此处直接消费）
 */
/** 合成组件图标列表（from） */
const fromItems = computed(() => itemDisplay.value?.from ?? [])
/** 升级去向图标列表（to） */
const toItems = computed(() => itemDisplay.value?.to ?? [])
</script>

<style scoped>
@reference '../../styles/tailwind.css';

@layer components {
  .info {
    @apply mb-2 flex items-center;

    .image {
      @apply size-7 rounded-xs;
    }

    .right-side {
      @apply ml-2;

      .name {
        @apply mb-1 text-xs leading-none font-bold;
      }

      .price {
        @apply text-xs leading-none;
      }
    }
  }

  .from {
    @apply mb-1 before:content-['='];
  }

  .to {
    @apply mb-2 before:content-['⇒'];
  }

  .from,
  .to {
    @apply flex max-w-[460px] flex-wrap items-center gap-0.5 before:mr-1 before:text-xs before:text-black/50 before:italic before:dark:text-white/50;

    .image {
      @apply size-5 rounded-xs;
    }
  }

  .item-display-popover,
  .item-display-description {
    color: var(--la-color-text-primary);
  }

  .item.trinket,
  .trinket.empty {
    @apply rounded-full;
  }

  .item,
  .item.empty {
    @apply shrink-0 rounded-xs;
  }

  .empty {
    @apply bg-gray-500/40 dark:bg-black/20;
  }
}
</style>
