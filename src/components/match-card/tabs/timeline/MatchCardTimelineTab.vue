<template>
  <!-- 时间线 Tab（任务 15 全量移植原版 MatchCardTimelineTab）：
       sgp 数据源显示「差距线图表 / 属性时间线」子 Tab 切换，其余数据源仅差距线图表 -->
  <div class="flex h-142 min-h-0 w-full flex-col">
    <!-- sub tab -->
    <div class="mb-2 box-border w-full px-2" v-if="basicInfo.dataSource === 'sgp'">
      <NTabs size="small" type="line" v-model:value="currentSection">
        <NTab name="diff-line-chart">{{ t('matchCard.timelineTab.diffLineChart') }}</NTab>
        <NTab name="stats-line">{{ t('matchCard.timelineTab.statsLine') }}</NTab>
      </NTabs>
    </div>

    <MatchCardDiffLineChart v-if="currentSection === 'diff-line-chart'" class="min-h-0 flex-1" />
    <MatchCardStatsLine v-if="currentSection === 'stats-line'" class="min-h-0 flex-1" />
  </div>
</template>

<script setup lang="ts">
/**
 * 时间线 Tab（任务 15）：移植原版 MatchCardTimelineTab；
 * 原版以 details.source 判定 sgp（子 Tab 可见），web 的 details 无 source 字段，
 * 以 basicInfo.dataSource 等价判定（数据源语义一致）
 */
import { t } from '@/utils/match-card-i18n'
import { NTab, NTabs } from 'naive-ui'
import { ref, watch } from 'vue'

import { useMatchCard } from '../../context'
import MatchCardDiffLineChart from './MatchCardDiffLineChart.vue'
import MatchCardStatsLine from './MatchCardStatsLine.vue'

const { basicInfo } = useMatchCard()

const currentSection = ref<'diff-line-chart' | 'stats-line'>('diff-line-chart')

// lcu 不支持 stats-line（属性数据仅 SGP 提供），切回差距线图表
watch(
  () => basicInfo.value.dataSource,
  (source) => {
    if (source === 'lcu' && currentSection.value === 'stats-line') {
      currentSection.value = 'diff-line-chart'
    }
  }
)
</script>
