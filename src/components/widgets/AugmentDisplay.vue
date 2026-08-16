<template>
  <!-- 悬浮卡片：仅当海克斯强化存在（web 空壳判空约定：未知名称空串）时展示 -->
  <NPopover v-if="augmentDisplay && augmentDisplay.name" :delay="50">
    <template #trigger>
      <CdnImage
        :path="augmentDisplay.iconUrl"
        v-bind="$attrs"
        :style="{ width: `${size}px`, height: `${size}px` }"
        class="augment"
        :class="{
          prismatic: augmentDisplay.rarity === 'kPrismatic',
          gold: augmentDisplay.rarity === 'kGold',
          silver: augmentDisplay.rarity === 'kSilver',
          bronze: augmentDisplay.rarity === 'kBronze'
        }"
      />
    </template>

    <div class="info max-w-45">
      <CdnImage class="image" :path="augmentDisplay.iconUrl" />
      <div class="right-side">{{ augmentDisplay.name }}</div>
    </div>

    <div class="rarity max-w-45 text-xs">
      <span
        :class="{
          prismatic: augmentDisplay.rarity === 'kPrismatic',
          gold: augmentDisplay.rarity === 'kGold',
          silver: augmentDisplay.rarity === 'kSilver' || augmentDisplay.rarity === 'kEventChoice',
          bronze: augmentDisplay.rarity === 'kBronze'
        }"
        class="rarity-indicator"
      ></span>
      {{ formatRarity(augmentDisplay.rarity ?? '') }}
    </div>

    <!-- for gtimg source：中文描述（含 HTML 标签） -->
    <template v-if="augmentDisplay.descriptionHtml">
      <div class="my-2 h-px bg-black/10 dark:bg-white/10" />
      <div class="max-w-100" v-html="augmentDisplay.descriptionHtml" />
    </template>
  </NPopover>
  <!-- 空槽占位：augmentId 为空或未知海克斯时渲染 -->
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
import { t } from '@/utils/match-card-i18n'
import { augmentDisplay as fetchAugmentDisplay, type AugmentDisplayResource } from '@/utils/game-resource'

const { augmentId, size = 20 } = defineProps<{
  augmentId?: number
  size?: number
}>()

/** 海克斯强化展示资源（异步加载；web 数据层为空壳非空契约，未知名称空串） */
const augmentDisplay = ref<AugmentDisplayResource | null>(null)

// 查询序号：防止快速切换强化时旧响应覆盖新内容
let requestSeq = 0

/** 加载海克斯信息（augmentId 变化时重新加载；0/undefined 视为空槽） */
async function load(): Promise<void> {
  const seq = ++requestSeq
  if (!augmentId) {
    augmentDisplay.value = null
    return
  }
  augmentDisplay.value = await fetchAugmentDisplay(augmentId)
  // 仅在仍是最新请求时保留结果
  if (seq !== requestSeq) {
    augmentDisplay.value = null
  }
}

watch(() => augmentId, load, { immediate: true })

// 组件卸载时使在途请求失效
onBeforeUnmount(() => {
  requestSeq += 1
})

/** 稀有度中文文案（key 与原版 i18n 一致；未知稀有度回退 key 插值） */
const formatRarity = (r: string) => {
  switch (r) {
    case 'kBronze':
      return t('gameAssets.augment.bronze')

    case 'kSilver':
      return t('gameAssets.augment.silver')

    case 'kEventChoice':
      return t('gameAssets.augment.eventChoice')

    case 'kGold':
      return t('gameAssets.augment.gold')

    case 'kPrismatic':
      return t('gameAssets.augment.prismatic')

    default:
      return t('gameAssets.augment.rarity', { rarity: r })
  }
}
</script>

<style scoped>
@reference '../../styles/tailwind.css';

@layer components {
  .augment,
  .empty {
    border-radius: 2px;
  }

  .augment {
    box-sizing: border-box;
  }

  /* 稀有度边框与底色：prismatic/gold/silver/bronze 四档（1:1 还原原版） */
  .augment.prismatic {
    border: 1px solid transparent;
    border-image: linear-gradient(135deg, #e78fff, #8b05b0) 1;
    background-color: rgb(72, 59, 104);

    [data-theme='dark'] & {
      background-color: rgb(45, 37, 66);
    }
  }

  .augment.gold {
    border: 1px solid rgb(255, 183, 0);
    background-color: hsl(43, 82%, 20%);

    [data-theme='dark'] & {
      background-color: rgb(50, 37, 5);
    }
  }

  .augment.silver {
    border: 1px solid rgb(180, 180, 180);
    background-color: rgb(65, 77, 88);

    [data-theme='dark'] & {
      background-color: rgb(35, 35, 34);
    }
  }

  .augment.bronze {
    border: 1px solid rgb(205, 127, 50);
    background-color: rgb(80, 50, 25);

    [data-theme='dark'] & {
      background-color: rgb(50, 30, 15);
    }
  }

  .info {
    display: flex;
    align-items: center;
    margin-bottom: 8px;

    .image {
      border-radius: 4px;
      height: 28px;

      [data-theme='light'] & {
        filter: invert(100%);
      }
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

  .rarity-indicator {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin-right: 2px;
    background-color: rgb(0, 0, 0);
  }

  .rarity-indicator.silver {
    background-color: rgb(247, 247, 247);
  }

  .rarity-indicator.gold {
    background-color: rgb(255, 183, 0);
  }

  .rarity-indicator.prismatic {
    background-image: linear-gradient(135deg, #f6d7ff, #b453cf);
  }

  .rarity-indicator.bronze {
    background-color: rgb(205, 127, 50);
  }
}
</style>
