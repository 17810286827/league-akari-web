<script setup lang="ts">
/**
 * 召唤师技能图标 + 描述（对齐主仓库 SummonerSpellDisplay.vue）：
 * 图标（CDN）触发 NPopover，展示技能名称 / 冷却 / 等级要求 / 描述
 * 数据来自 game-resource（CommunityDragon game-data JSON），未知技能显示空占位
 */
import { NPopover } from 'naive-ui'
import { onBeforeUnmount, ref, watch } from 'vue'

import { spellDisplay, type SpellDisplayResource } from '@/utils/game-resource'

const props = withDefaults(
  defineProps<{
    /** 技能 ID，如 4（闪现）/ 32（标记） */
    spellId?: number
    /** 图标尺寸（px） */
    size?: number
  }>(),
  { size: 20 }
)

/** 技能展示资源（异步加载） */
const display = ref<SpellDisplayResource | null>(null)

// 查询序号：防止快速切换技能时旧响应覆盖新内容
let requestSeq = 0

/** 加载技能信息（spellId 变化时重新加载） */
async function load(): Promise<void> {
  const seq = ++requestSeq
  if (!props.spellId) {
    display.value = null
    return
  }
  display.value = await spellDisplay(props.spellId)
  // 仅在仍是最新请求时保留结果
  if (seq !== requestSeq) {
    display.value = null
  }
}

watch(() => props.spellId, load, { immediate: true })

// 组件卸载时使在途请求失效
onBeforeUnmount(() => {
  requestSeq += 1
})
</script>

<template>
  <!-- 技能信息就绪：图标 + 弹出描述 -->
  <NPopover v-if="display" :delay="50" placement="top">
    <template #trigger>
      <img
        :src="display.iconUrl"
        :alt="display.name"
        class="spell-icon"
        :style="{ width: `${size}px`, height: `${size}px` }"
      />
    </template>
    <div class="max-w-60">
      <div class="spell-name">{{ display.name }}</div>
      <div class="spell-meta">
        {{ display.cooldown }} 秒冷却 · {{ display.summonerLevel }} 级解锁
      </div>
      <div class="spell-desc">{{ display.description }}</div>
    </div>
  </NPopover>
  <!-- 未知技能：空占位 -->
  <span
    v-else
    class="spell-icon spell-icon-empty"
    :style="{ width: `${size}px`, height: `${size}px` }"
    aria-hidden="true"
  />
</template>

<style lang="scss" scoped>
/* 技能图标：圆角小方块 */
.spell-icon {
  display: inline-block;
  border-radius: 3px;
  border: 1px solid var(--border);
  flex-shrink: 0;
  background: var(--surface-hover);
}

/* 未知技能的暗色占位 */
.spell-icon-empty {
  opacity: 0.4;
}

.spell-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 2px;
}

.spell-meta {
  font-size: 12px;
  font-style: italic;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.spell-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--text);
}
</style>
