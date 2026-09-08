<script setup lang="ts">
/**
 * 对局诊断面板（工单 #36 / spec #30）：
 * 用闲置 stats 字段（视野/控制/伤害转化/资源伤害/经济占比）回答"这局短板在哪"。
 * 败局末位维度红色高亮（weak 标记由后端判定，含辅助职业豁免）；
 * 纯数据不依赖 AI，与时间线复盘面板各自独立（诊断看结果归因，复盘看过程曲线）。
 */
import { computed, onMounted, ref } from 'vue'
import { NEmpty, NSpin } from 'naive-ui'

import { getMatchDiagnosis } from '@/api/matches'
import type { DiagnosisPlayer, MatchDiagnosis } from '@/api/types'
import { championIconSources } from '@/utils/icon-url'
import CdnImage from '@/components/widgets/CdnImage.vue'
import { createLogger } from '@/utils/logger'

const logger = createLogger('DiagnosePanel')

const props = defineProps<{
  /** 对局 ID（LCU） */
  gameId: number
}>()

/** 诊断数据（null = 加载中或失败） */
const diagnosis = ref<MatchDiagnosis | null>(null)
const loading = ref(false)
const errorMsg = ref('')

/** 维度键 → 单位后缀（raw 展示用） */
const DIMENSION_UNIT: Record<string, string> = {
  vision: '分',
  ccTime: '秒',
  damageConversion: '',
  objectiveDamage: '',
  goldShare: ''
}

/** 我方视角玩家（视角队伍过滤；后端返回全员） */
const perspectivePlayers = computed(() =>
  (diagnosis.value?.players ?? []).filter((p) => p.teamId === diagnosis.value?.perspectiveTeamId)
)

/** 是否败局（高亮语境） */
const isLoss = computed(() => diagnosis.value != null && !diagnosis.value.win)

/** 维度原始值格式化：经济占比转百分比，其余按原值 */
function formatRaw(key: string, value: number): string {
  if (key === 'goldShare') {
    return `${(value * 100).toFixed(1)}%`
  }
  if (key === 'damageConversion') {
    return value.toFixed(2)
  }
  return `${value}${DIMENSION_UNIT[key] ?? ''}`
}

/** 玩家的薄弱维度（排序前置展示） */
function weakDimensions(player: DiagnosisPlayer) {
  return player.dimensions.filter((d) => d.weak)
}

onMounted(async () => {
  loading.value = true
  errorMsg.value = ''
  try {
    diagnosis.value = await getMatchDiagnosis(props.gameId)
    logger.info('Diagnosis loaded', {
      gameId: props.gameId,
      players: diagnosis.value.players.length
    })
  } catch (error) {
    errorMsg.value = error instanceof Error ? error.message : '诊断数据加载失败'
    logger.error('Diagnosis load failed', { gameId: props.gameId, error })
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <!-- 诊断面板：与复盘面板并列，独立加载独立降级 -->
  <section class="diagnose-panel" data-testid="diagnose-panel">
    <header class="mb-3 flex items-center gap-2">
      <span class="text-base font-bold">🔍 对局诊断</span>
      <span class="text-xs opacity-60">
        {{ isLoss ? '败局短板高亮——输在哪' : '维度表现（胜局不做短板判定）' }}
      </span>
    </header>

    <n-spin v-if="loading" data-testid="diagnose-loading" />

    <n-empty
      v-else-if="errorMsg"
      description="诊断数据加载失败，请稍后重试"
      data-testid="diagnose-error"
      class="py-6"
    />

    <template v-else>
      <!-- 我方每人的维度表格 -->
      <div class="overflow-x-auto" data-testid="diagnose-table">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-300/30 text-left">
              <th class="py-2 pr-4 font-semibold">玩家</th>
              <th
                v-for="dim in perspectivePlayers[0]?.dimensions ?? []"
                :key="dim.key"
                class="py-2 pr-4 font-semibold"
              >
                {{ dim.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="player in perspectivePlayers"
              :key="player.name"
              class="border-b border-gray-300/15"
            >
              <td class="py-2 pr-4">
                <div class="flex items-center gap-1.5 font-medium">
                  <!-- 英雄头像（spec #44）：缺失 ID 的旧数据不渲染，回退下方文字；
                       降级链：本地镜像 → CDragon（ADR 0004） -->
                  <CdnImage
                    v-if="player.championId != null"
                    :sources="championIconSources(player.championId)"
                    :alt="player.championName"
                    :data-testid="`champion-avatar-${player.name}`"
                    class="h-5 w-5 shrink-0 rounded-md object-cover"
                  />
                  <span>{{ player.name }}</span>
                </div>
                <div class="text-xs opacity-60">{{ player.championName }}</div>
              </td>
              <td
                v-for="dim in player.dimensions"
                :key="dim.key"
                class="py-2 pr-4"
                :class="dim.weak ? 'weak-dim font-bold' : ''"
                :data-testid="`dim-${player.name}-${dim.key}`"
              >
                {{ formatRaw(dim.key, dim.rawValue) }}
                <span class="ml-1 text-xs opacity-50">#{{ dim.teamRank }}</span>
                <!-- 短板徽标（败局末位且显著低于队均） -->
                <span v-if="dim.weak" class="ml-1" title="队内末位且显著低于均值">⚠</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="mt-2 text-xs opacity-50">
        #n 为队内位次（1 = 本队最高）；
        <template v-if="isLoss">⚠ = 败局短板维度（队内末位且显著低于均值，辅助职业豁免视野/控制）</template>
        <template v-else>胜局不做短板判定</template>
      </p>
    </template>
  </section>
</template>

<style scoped>
/* 诊断面板容器：与复盘面板同宽，浅色描边 */
.diagnose-panel {
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 8px;
  padding: 16px;
}

/* 短板维度高亮（败局） */
.weak-dim {
  color: #d03050;
}
</style>
