<template>
  <!-- 悬浮卡片：展示技能名称/冷却/等级要求/描述（与原版结构一致） -->
  <NPopover
    v-if="spellDisplay"
    :delay="delay"
    :disabled="disablePopover"
    :keep-alive-on-hover="keepAliveOnHover"
  >
    <template #trigger>
      <CdnImage
        :path="spellDisplay.iconUrl"
        v-bind="$attrs"
        :style="{ width: `${size}px`, height: `${size}px` }"
        class="spell"
      />
    </template>
    <div style="max-width: 240px">
      <div class="name">{{ spellDisplay.name }}</div>
      <div class="cooldown">
        {{
          t('gameAssets.summonerSpell.cooldown', {
            time: spellDisplay.cooldown
          })
        }}
      </div>
      <div class="level">
        {{
          t('gameAssets.summonerSpell.levelRequirement', {
            level: spellDisplay.summonerLevel
          })
        }}
      </div>
      <div class="description">{{ spellDisplay.description }}</div>
    </div>
  </NPopover>
  <!-- 空槽占位：spellId 为空或未知技能时渲染 -->
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
import { spellDisplay as fetchSpellDisplay, type SpellDisplayResource } from '@/utils/game-resource'

const { spellId, size = 20, delay = 50 } = defineProps<{
  disablePopover?: boolean
  spellId?: number
  size?: number
  keepAliveOnHover?: boolean
  delay?: number
}>()

/** 技能展示资源（异步加载；web 数据层未知技能返回 null） */
const spellDisplay = ref<SpellDisplayResource | null>(null)

// 查询序号：防止快速切换技能时旧响应覆盖新内容
let requestSeq = 0

/** 加载技能信息（spellId 变化时重新加载；0/undefined 视为空槽） */
async function load(): Promise<void> {
  const seq = ++requestSeq
  if (!spellId) {
    spellDisplay.value = null
    return
  }
  spellDisplay.value = await fetchSpellDisplay(spellId)
  // 仅在仍是最新请求时保留结果
  if (seq !== requestSeq) {
    spellDisplay.value = null
  }
}

watch(() => spellId, load, { immediate: true })

// 组件卸载时使在途请求失效
onBeforeUnmount(() => {
  requestSeq += 1
})
</script>

<style scoped>
@reference '../../styles/tailwind.css';

@layer components {
  .cooldown,
  .description,
  .level {
    font-size: 12px;
  }

  .cooldown,
  .level {
    font-style: italic;
  }

  .level {
    margin-bottom: 2px;
  }

  .name {
    font-size: 14px;
    font-weight: bold;
    margin-bottom: 2px;
  }

  .spell {
    border-radius: 2px;
  }

  .empty {
    @apply rounded-xs bg-gray-500/40 dark:bg-black/20;
  }
}
</style>
