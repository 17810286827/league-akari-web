<script setup lang="ts">
/**
 * 资源统计横幅：蓝队总击杀（蓝底）+ 总金币（深蓝底） | 地图资源（龙魂/先锋/男爵）| 红队总击杀（红底）+ 总金币（深红底）
 * 小屏折叠为可展开面板
 */
import { ref } from 'vue'

import type { ResourcesView, TeamView } from './adapter'

const props = defineProps<{ teams: TeamView[]; resources: ResourcesView[] }>()

/** 小屏折叠状态（默认展开） */
const expanded = ref(true)

/** 按队伍 ID 取队伍视图（100 蓝 / 200 红） */
function teamOf(teamId: number): TeamView | undefined {
  return props.teams.find((team) => team.teamId === teamId)
}

/** 按顺序取队伍资源（teams_json 与队伍顺序一致；缺省补零） */
function resourcesOf(index: number): ResourcesView {
  return props.resources[index] ?? { dragons: 0, heralds: 0, barons: 0 }
}

/** 地图资源图标（SVG 占位：龙/先锋/男爵） */
const objectiveIcons = [
  { key: 'dragons', label: '龙魂', icon: '🐉' },
  { key: 'heralds', label: '先锋', icon: '🗿' },
  { key: 'barons', label: '男爵', icon: '👑' }
] as const
</script>

<template>
  <section class="rounded-lg border border-hairline bg-surface">
    <!-- 折叠切换头（小屏也显示，点击展开/收起） -->
    <button
      type="button"
      class="flex w-full items-center justify-between px-4 py-2.5 text-sm font-semibold text-ink"
      @click="expanded = !expanded"
    >
      <span>资源统计</span>
      <span class="text-xs text-ink-muted transition-transform" :class="{ 'rotate-180': expanded }">▼</span>
    </button>

    <!-- 统计内容：大屏三栏并排，小屏纵向堆叠 -->
    <div v-if="expanded" class="grid grid-cols-1 gap-3 border-t border-hairline p-4 md:grid-cols-[1fr_1.2fr_1fr]">
      <!-- 蓝队：总击杀（蓝底）+ 总金币（深蓝底） -->
      <div class="space-y-2">
        <div class="rounded-md bg-win/20 px-4 py-3 text-center">
          <p class="text-xs text-ink-muted">蓝队总击杀</p>
          <p class="text-2xl font-extrabold text-win tabular-nums">{{ teamOf(100)?.totalKills ?? 0 }}</p>
        </div>
        <div class="rounded-md bg-win/35 px-4 py-3 text-center">
          <p class="text-xs text-ink-muted">蓝队总金币</p>
          <p class="text-2xl font-extrabold text-ink tabular-nums">{{ (teamOf(100)?.totalGold ?? 0).toLocaleString() }}</p>
        </div>
      </div>

      <!-- 中间：地图资源 -->
      <div class="flex flex-col items-center justify-center gap-2">
        <p class="text-xs font-semibold text-ink-muted">地图资源</p>
        <div class="flex gap-6">
          <div v-for="objective in objectiveIcons" :key="objective.key" class="text-center">
            <p class="text-2xl" aria-hidden="true">{{ objective.icon }}</p>
            <p class="text-xs text-ink-muted">{{ objective.label }}</p>
            <p class="text-sm font-bold text-ink tabular-nums">
              {{ resourcesOf(0)[objective.key] }} : {{ resourcesOf(1)[objective.key] }}
            </p>
          </div>
        </div>
      </div>

      <!-- 红队：总击杀（红底）+ 总金币（深红底） -->
      <div class="space-y-2">
        <div class="rounded-md bg-loss/20 px-4 py-3 text-center">
          <p class="text-xs text-ink-muted">红队总击杀</p>
          <p class="text-2xl font-extrabold text-loss tabular-nums">{{ teamOf(200)?.totalKills ?? 0 }}</p>
        </div>
        <div class="rounded-md bg-loss/35 px-4 py-3 text-center">
          <p class="text-xs text-ink-muted">红队总金币</p>
          <p class="text-2xl font-extrabold text-ink tabular-nums">{{ (teamOf(200)?.totalGold ?? 0).toLocaleString() }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
