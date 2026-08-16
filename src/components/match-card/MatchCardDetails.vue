<template>
  <!-- expanded details -->
  <div
    class="transition-width @container relative mt-1 box-border w-full overflow-hidden rounded border border-solid bg-neutral-100/95 p-2 dark:bg-neutral-950"
    :class="cardBorderClass"
  >
    <!-- header -->
    <div class="mb-2 flex items-center gap-1">
      <TabSwitch
        class="flex-1"
        v-model:selected-tab="selectedTab"
        :tabs="tabs"
        :win-result="team?.winResult"
      />
    </div>

    <!-- tab content -->
    <KeepAlive>
      <MatchCardSummaryTab v-if="selectedTab === 'summary'" />
      <MatchCardDetailsTab v-else-if="selectedTab === 'details'" />
      <MatchCardRunesTab v-else-if="selectedTab === 'runes'" />
      <MatchCardEventsTab v-else-if="selectedTab === 'events'" />
      <MatchCardTimelineTab v-else-if="selectedTab === 'timeline'" />
      <MatchCardBuildsTab v-else-if="selectedTab === 'builds'" />
    </KeepAlive>
  </div>
</template>

<script lang="ts" setup>
import { t } from '@/utils/match-card-i18n'
import { computed, ref, watchEffect } from 'vue'

import { useMatchCard } from './context'
import MatchCardBuildsTab from './tabs/MatchCardBuildsTab.vue'
import MatchCardDetailsTab from './tabs/MatchCardDetailsTab.vue'
import MatchCardEventsTab from './tabs/MatchCardEventsTab.vue'
import MatchCardRunesTab from './tabs/MatchCardRunesTab.vue'
import MatchCardSummaryTab from './tabs/MatchCardSummaryTab.vue'
import MatchCardTimelineTab from './tabs/timeline/MatchCardTimelineTab.vue'
import { useCardBorderClass } from './utils/theme'
import TabSwitch from './widgets/TabSwitch.vue'

const { basicInfo, teams, participants, puuid } = useMatchCard()

const selfStats = computed(() => {
  return participants.value.find((s) => s.puuid === puuid.value)
})

const team = computed(() => {
  if (!selfStats.value) return null

  return teams.value.teamStatMap[selfStats.value.teamIdentifier]
})

// 符文是否可用：web 适配层 perks 为 { perkIds, perkStyle, perkSubStyle } 形状（任务 5），
// 对应原版 styles[0].selections[0].perk 等平铺判断——任一玩家存在非 0 符文即展示符文 Tab
const perksAvailable = computed(() => {
  return participants.value.some((p) => p.perks.perkIds.some((perk) => perk !== 0 && perk !== null))
})

const selectedTab = ref('summary')
const tabs = computed(() => {
  return [
    {
      label: t('matchCard.tabs.summary'),
      value: 'summary'
    },
    {
      label: t('matchCard.tabs.details'),
      value: 'details'
    },
    {
      label: t('matchCard.tabs.runes'),
      value: 'runes',
      show: perksAvailable.value
    },
    {
      label: t('matchCard.tabs.events'),
      value: 'events'
    },
    {
      label: t('matchCard.tabs.builds'),
      value: 'builds',
      show: basicInfo.value.dataSource === 'sgp'
    },
    {
      label: t('matchCard.tabs.timeline'),
      value: 'timeline'
    }
  ].filter((tab) => tab.show ?? true)
})

watchEffect(() => {
  if (basicInfo.value.dataSource !== 'sgp' && selectedTab.value === 'builds') {
    selectedTab.value = 'summary'
  }
})

const cardBorderClass = useCardBorderClass()
</script>

<style scoped>
@import './match-card.css';
</style>
