<template>
  <!-- 英雄头像容器：round 时圆形裁剪；stretched 时去除黑边（图标放大 112%） -->
  <div class="champion-icon-container" :class="{ round: round }">
    <img class="plain-img" v-if="imageSource?.source === 'url'" :src="imageSource.iconPath" />
    <CdnImage
      v-else
      class="champion-icon"
      :class="{ 'champion-icon-stretched': stretched }"
      :path="imageSource?.iconPath"
    />
    <!-- ring 系列（历史遗留属性，后续逐步移除） -->
    <div
      v-if="ring"
      class="champion-icon-ring"
      :class="{ round: round }"
      :style="{
        borderColor: ringColor || '#2a947d',
        borderWidth: `${ringWidth}px` || '2px'
      }"
    ></div>
  </div>
</template>

<script lang="ts" setup>
/**
 * 英雄头像：数据源替换说明——
 * 原版调用 resources.champions.icon(id)（LCU gameData），web 端无 LCU，
 * 此处本地构造等价的 imageSource（lcu 分支的 LCU 路径由 CdnImage 转 CDN URL）
 */
import { computed } from 'vue'

import CdnImage from './CdnImage.vue'
import braveryIcon from '@/assets/champions/bravery-circle.png'

const { championId = -1, stretched = true } = defineProps<{
  championId?: number
  round?: boolean
  stretched?: boolean // to remove the black border

  // ring 系列属性可以 deprecated 了，未来将逐渐取代
  ring?: boolean
  ringColor?: string
  ringWidth?: number
}>()

/** 头像数据源：-3（随机/Bravery）用本地图标直链，其余按 CDragon 约定组装 LCU 路径 */
const imageSource = computed(() => {
  if (championId === -3) {
    return { source: 'url', iconPath: braveryIcon }
  }

  return {
    source: 'lcu',
    iconPath: `/lol-game-data/assets/v1/champion-icons/${championId}.png`
  }
})
</script>

<style scoped>
@reference '../../styles/tailwind.css';

@layer components {
  .champion-icon-container {
    position: relative;
    overflow: hidden;

    .plain-img {
      display: block;
      width: 100%;
      height: 100%;
    }

    /*  default size */
    width: 64px;
    height: 64px;

    &.round {
      border-radius: 50%;
    }

    .champion-icon {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      max-width: none;
    }

    .champion-icon-stretched {
      width: 112%;
      height: 112%;
    }

    .champion-icon-ring {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border-style: solid;
      box-sizing: border-box;

      &.round {
        border-radius: 50%;
      }
    }
  }
}
</style>
