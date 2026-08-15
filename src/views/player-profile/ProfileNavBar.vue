<script setup lang="ts">
/**
 * 导航栏：一级 Tabs（概要/风格/英雄/熟练度）+ 二级队列筛选 Pill（全部/单双排/灵活排位/极地大乱斗）
 * 均支持点击切换，通过 v-model 与父组件同步状态
 */

/** 一级 Tab 标识 */
export type ProfileTab = 'overview' | 'styles' | 'champions' | 'mastery'

/** 队列筛选标识（'all' 表示全部） */
export type QueueFilter = 'all' | 'RANKED_SOLO_5x5' | 'RANKED_FLEX_SR' | 'ARAM'

// 一级 Tab 列表（展示名与标识）
const tabs: { key: ProfileTab; label: string }[] = [
  { key: 'overview', label: '概要' },
  { key: 'styles', label: '风格' },
  { key: 'champions', label: '英雄' },
  { key: 'mastery', label: '熟练度' }
]

// 二级队列筛选 Pill 列表
const queueFilters: { key: QueueFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'RANKED_SOLO_5x5', label: '单排/双排' },
  { key: 'RANKED_FLEX_SR', label: '灵活排位' },
  { key: 'ARAM', label: '极地大乱斗' }
]

// 当前选中的 Tab 与队列（父组件 v-model 双向绑定）
const activeTab = defineModel<ProfileTab>('tab', { default: 'overview' })
const activeQueue = defineModel<QueueFilter>('queue', { default: 'all' })
</script>

<template>
  <nav class="sticky top-0 z-20 border-b border-hairline bg-base/95 backdrop-blur">
    <div class="mx-auto flex max-w-7xl items-center gap-8 px-10">
      <!-- 一级 Tabs -->
      <div class="flex gap-1">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="relative px-4 py-3.5 text-sm font-semibold transition-colors"
          :class="activeTab === tab.key ? 'text-ink' : 'text-ink-muted hover:text-ink'"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
          <!-- 激活下划线 -->
          <span
            v-if="activeTab === tab.key"
            class="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-win"
          />
        </button>
      </div>

      <!-- 二级队列筛选 Pill -->
      <div class="flex items-center gap-1.5">
        <button
          v-for="filter in queueFilters"
          :key="filter.key"
          type="button"
          class="rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors"
          :class="
            activeQueue === filter.key
              ? 'bg-win text-white'
              : 'text-ink-muted hover:bg-surface-hover hover:text-ink'
          "
          @click="activeQueue = filter.key"
        >
          {{ filter.label }}
        </button>
      </div>
    </div>
  </nav>
</template>
