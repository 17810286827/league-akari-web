<template>
  <div>
    <div
      class="mb-2 flex justify-end rounded-xs bg-neutral-200 px-2 py-1 dark:bg-neutral-800"
      v-if="basicInfo.isCherrySubteam"
    >
      <!-- bans 一行最多 32 个图标（≈512px）：flex-wrap 允许窄屏（手机）换行，不横向溢出 -->
      <div class="flex min-w-0 flex-wrap justify-end gap-0.5">
        <div class="mr-1 text-xs text-black/60 dark:text-white/60">
          {{ t('matchCard.teamTable.bans') }}
        </div>
        <ChampionIcon
          v-for="ban in teams.allTeamStats.bans.slice(0, 32)"
          :key="ban.championId"
          :champion-id="ban.championId"
          class="size-4 rounded-xs"
        />
      </div>
    </div>
    <TeamTable
      v-for="team of sortedTeams"
      :key="team.teamIdentifier"
      :team-identifier="team.teamIdentifier"
      class="not-last:mb-2"
    />
  </div>
</template>

<script lang="ts" setup>
import ChampionIcon from '@/components/widgets/ChampionIcon.vue'
import { t } from '@/utils/match-card-i18n'
import { computed } from 'vue'

import { useMatchCard } from '../context'
import TeamTable from '../widgets/TeamTable.vue'

const { teams, basicInfo } = useMatchCard()

const sortedTeams = computed(() => {
  if (basicInfo.value.isCherrySubteam) {
    return teams.value.teamStatsArr.toSorted((a, b) => {
      return a.subteamPlacement - b.subteamPlacement
    })
  }

  return teams.value.teamStatsArr.toSorted((a, b) => {
    return a.teamIdentifier.localeCompare(b.teamIdentifier)
  })
})
</script>
