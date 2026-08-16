<template>
  <div
    v-if="participant && team"
    class="overview-card glass-card transition-width @container relative box-border flex h-[150px] w-full overflow-hidden rounded-xl border border-solid select-none"
    :class="cardBorderClass"
    :style="winLossBackground"
    @click="$emit('toggle-expand')"
  >
    <!-- main content -->
    <div class="z-1 flex min-w-0 flex-1 gap-2.5 px-4 py-1.5">
      <!-- stats content -->
      <div class="z-2 my-1.5 flex min-w-0 flex-1 flex-col justify-between">
        <!-- 上半部分：英雄头像 + stats line -->
        <div class="flex h-14 gap-3">
          <!-- champion icon -->
          <div class="flex w-17.5 shrink-0 items-center">
            <div class="relative" :class="{ contents: !shouldShowCrown && !participant.position }">
              <ChampionIcon
                :champion-id="participant.championId"
                class="champion-glow relative -left-0.5 box-border size-11 rounded-lg border-2 border-solid"
                :class="{
                  'border-blue-600/80 dark:border-blue-300/80': winStyleType === 'win',
                  'border-red-600/80 dark:border-red-300/80': winStyleType === 'loss',
                  'border-black/80 dark:border-white/80': winStyleType === 'neutral'
                }"
              />

              <!-- top1 头顶上方的皇冠 -->
              <div
                v-if="shouldShowCrown"
                class="absolute top-0 left-[calc(50%-2px)] -translate-x-1/2 -translate-y-1/2"
              >
                <NIcon class="text-orange-600 dark:text-yellow-500">
                  <Crown />
                </NIcon>
              </div>

              <!-- position：无效位置（Invalid 等）不显示，避免回退成"全部位置"星形图标 -->
              <div
                v-if="participant.position && participant.position.toLowerCase() !== 'invalid'"
                class="absolute right-0 bottom-0 rounded-sm bg-black/60 p-0.5 dark:bg-black/80"
              >
                <PositionIcon
                  :position="participant.position"
                  class="text-[23px] block! text-white/80"
                />
              </div>
            </div>
          </div>

          <!-- stats line -->
          <div class="flex min-w-0 flex-1 items-center gap-2">
            <!-- spells + runes -->
            <div v-if="displayParts.spells || displayParts.runes" class="flex gap-0.5">
              <!-- spells -->
              <div
                v-if="displayParts.spells && (participant.spells[0] || participant.spells[1])"
                class="flex flex-col gap-0.5"
              >
                <SummonerSpellDisplay :spell-id="participant.spells[0]" :size="23" />
                <SummonerSpellDisplay :spell-id="participant.spells[1]" :size="23" />
              </div>

              <!-- runes / styles -->
              <div v-if="displayParts.runes && perks" class="flex flex-col gap-0.5">
                <PerkDisplay :perk-id="perks.primaryPerkId" :size="23" />
                <PerkstyleDisplay :perkstyle-id="perks.subPerkStyleId" :size="23" />
              </div>
            </div>

            <!-- augments -->
            <div v-if="displayParts.augments" class="hidden grid-cols-3 gap-0.5 @[680px]:grid">
              <AugmentDisplay
                v-for="(augment, index) of participant.augments"
                :key="index"
                :augment-id="augment ?? undefined"
                :size="23"
              />
            </div>

            <!-- spacer -->
            <div class="w-0"></div>

            <!-- KDA + DMG -->
            <NPopover :delay="300" :content-style="{ maxWidth: '420px' }">
              <template #trigger>
                <div class="flex gap-2">
                  <!-- KDA -->
                  <div class="min-w-22">
                    <div class="flex items-center justify-center gap-0.5">
                      <div class="text-[21px] font-bold text-black dark:text-white">
                        {{ participant.kills }}
                      </div>
                      <div class="mx-px text-sm text-black/60 dark:text-white/60">/</div>
                      <div class="text-[21px] font-bold text-red-600 dark:text-red-300">
                        {{ participant.deaths }}
                      </div>
                      <div class="mx-px text-sm text-black/60 dark:text-white/60">/</div>
                      <div class="text-[21px] font-bold text-black dark:text-white">
                        {{ participant.assists }}
                      </div>
                    </div>

                    <!-- KDA value -->
                    <div
                      class="flex justify-center text-[16px] text-yellow-700 dark:text-yellow-200"
                      v-if="
                        participant.deaths === 0 &&
                        (participant.kills > 0 || participant.assists > 0)
                      "
                    >
                      {{ t('matchCard.overview.perfect') }}
                      ({{ (participant.killParticipation * 100).toFixed(0) }}%)
                    </div>

                    <div class="flex justify-center gap-1" v-else>
                      <div class="text-[16px] text-black/80 dark:text-white/80">
                        {{ participant.kda.toFixed(2) }}
                      </div>
                      <div class="text-[16px] text-black/80 dark:text-white/80">
                        ({{ (participant.killParticipation * 100).toFixed(0) }}%)
                      </div>
                    </div>
                  </div>

          <!-- dmg -->
          <div class="min-w-22">
            <div class="text-center text-[20px] font-bold">
              {{ dmgPercentage }}%
            </div>

            <!-- 玻璃终端签名：伤害占比荧光渐变数据条 -->
            <div class="dmg-bar">
              <div class="dmg-bar-fill" :style="{ width: `${dmgPercentage}%` }"></div>
            </div>

            <div class="flex justify-center gap-1">
              <div class="text-[16px] text-black/80 dark:text-white/80">
                {{ formatExtremeNumber(participant.totalDamageDealtToChampions) }}
              </div>
              <div class="text-[16px] text-black/60 dark:text-white/60">
                {{ t('matchCard.overview.damage') }}
              </div>
            </div>
          </div>

          <!-- dmg taken：承伤占比，与伤害占比同风格（百分比 + 荧光数据条 + 数值） -->
          <div class="min-w-22">
            <div class="text-center text-[20px] font-bold">
              {{ dmgTakenPercentage }}%
            </div>

            <div class="dmg-bar">
              <div class="dmg-bar-fill" :style="{ width: `${dmgTakenPercentage}%` }"></div>
            </div>

            <div class="flex justify-center gap-1">
              <div class="text-[16px] text-black/80 dark:text-white/80">
                {{ formatExtremeNumber(participant.totalDamageTaken) }}
              </div>
              <div class="text-[16px] text-black/60 dark:text-white/60">
                {{ t('matchCard.overview.stats.damageTaken') }}
              </div>
            </div>
          </div>

          <!-- gold：经济占比，与伤害/承伤占比同风格（百分比 + 荧光数据条 + 数值） -->
          <div class="min-w-22">
            <div class="text-center text-[20px] font-bold">
              {{ goldPercentage }}%
            </div>

            <div class="dmg-bar">
              <div class="dmg-bar-fill" :style="{ width: `${goldPercentage}%` }"></div>
            </div>

            <div class="flex justify-center gap-1">
              <div class="text-[16px] text-black/80 dark:text-white/80">
                {{ formatExtremeNumber(participant.goldEarned) }}
              </div>
              <div class="text-[16px] text-black/60 dark:text-white/60">
                {{ t('matchCard.overview.stats.gold') }}
              </div>
            </div>
          </div>

          <!-- 伤转：伤害转化率（对英雄伤害 ÷ 金币），数据条 = 玩家/队均（队均 100% 基准） -->
          <div class="min-w-22" :title="t('matchCard.overview.dgeTip')">
            <div class="text-center text-[20px] font-bold tabular-nums">
              {{ dge.toFixed(2) }}
            </div>

            <div class="dmg-bar">
              <div class="dmg-bar-fill" :style="{ width: `${dgeRatio}%` }"></div>
            </div>

            <div class="flex justify-center gap-1">
              <div class="text-[16px] text-black/60 dark:text-white/60">
                {{ t('matchCard.tags.damageGoldEfficiency.teamLabel') }}
              </div>
            </div>
          </div>

                  <!-- cs -->
                  <div class="hidden min-w-22 @min-[700px]:block" v-if="displayParts.cs">
                    <div class="text-center text-[21px] font-bold">
                      {{ formatExtremeNumber(participant.cs) }}
                      <span class="text-[14px] font-normal text-black/60 dark:text-white/60">{{
                        t('matchCard.overview.cs')
                      }}</span>
                    </div>

                    <div class="flex justify-center gap-1">
                      <div class="text-[16px] text-black/80 dark:text-white/80">
                        {{ (participant.cs / (basicInfo.gameDuration / 60)).toFixed(1) }}
                      </div>
                      <div class="text-[16px] text-black/60 dark:text-white/60">
                        {{ t('matchCard.overview.csPerMin') }}
                      </div>
                    </div>
                  </div>
                </div>
              </template>
              <RadarChart :puuid="puuid" />
            </NPopover>
          </div>
        </div>

        <!-- 下半部分：胜利结果 + tags -->
        <div class="flex items-center gap-3">
          <!-- result -->
          <div class="min-w-17.5 shrink-0">
            <div
              :class="{
                'text-blue-600 dark:text-blue-300': winStyleType === 'win',
                'text-red-700 dark:text-red-300': winStyleType === 'loss',
                'text-black/80 dark:text-white': winStyleType === 'neutral'
              }"
              class="text-sm leading-none font-bold"
            >
              {{
                gameResultName(
                  team.subteamPlacement,
                  team.winResult,
                  team.isSurrender,
                  resources.runtime.locale
                )
              }}
            </div>
          </div>

          <!-- items -->
          <div class="flex gap-0.5">
            <ItemDisplay
              v-for="item of participant.items.slice(0, 6)"
              :key="item"
              :item-id="item"
              :size="23"
            />

            <ItemDisplay :item-id="participant.items[6]" :size="23" is-trinket />
            <ItemDisplay
              v-if="participant.roleBoundItem"
              :item-id="participant.roleBoundItem"
              :size="23"
            />
          </div>

          <!-- tags line -->
          <div class="min-w-0 flex-1">
            <ManyTags />
          </div>
        </div>

        <!-- info line -->
        <div class="flex">
          <!-- queue name -->
          <div class="text-[16px] text-black dark:text-white/85">
            {{ resources.queues.name(basicInfo.queueId) }}
          </div>
          <div class="mx-1 text-[16px] text-black/40 dark:text-white/40">·</div>

          <!-- duration hh:mm:ss (pad 0) -->
          <!-- advanced: from -> to -->
          <div class="text-[16px] text-black/80 dark:text-white/70">
            {{ formatSeconds(basicInfo.gameDuration) }}
          </div>
          <div class="mx-1 text-[16px] text-black/60 dark:text-white/40">·</div>

          <!-- should show the specific time if hover -->
          <div class="text-[16px] text-black/80 dark:text-white/70" :title="gameCreationTitle">
            {{ formattedRelativeTime }}
          </div>
          <div class="mx-1 text-[16px] text-black/60 dark:text-white/40">·</div>
          <div class="flex-1 truncate text-[16px] text-black/80 dark:text-white/70">
            {{ mapName }}
          </div>
        </div>
      </div>

      <!-- player list (5x5 team only) -->
      <div v-if="basicInfo.isTwoTeam" class="z-2 my-1.5 flex w-42 max-w-42 gap-2">
        <!-- teams -->
        <div
          v-for="team of twoTeams"
          :key="team[0].teamIdentifier"
          class="flex min-w-0 flex-1 flex-col justify-between gap-0.5"
        >
          <!-- team players -->
          <div
            v-for="player in team"
            :key="player.puuid"
            class="group flex cursor-pointer items-center gap-1"
          >
            <!-- player champion avatar -->
            <ChampionIcon :champion-id="player.championId" class="size-4 shrink-0 rounded" />

            <!-- maybe a bot player -->
            <NIcon
              class="text-black/80 dark:text-white/80"
              v-if="!player.puuid || player.puuid === EMPTY_PUUID"
            >
              <Robot />
            </NIcon>

            <NTooltip :keep-alive-on-hover="false">
              <template #trigger>
                <div
                  class="truncate text-xs transition-colors group-hover:text-black dark:group-hover:text-white"
                  :class="{
                    'font-bold text-black/90 dark:text-white/90': player.puuid === puuid,
                    'text-black/80 dark:text-white/80': player.puuid !== puuid
                  }"
                  @click.stop="navigateToSummonerByPuuid(player.puuid)"
                  @mousedown="handleMouseDown"
                  @mouseup="handleMouseUp($event, player.puuid)"
                >
                  {{ hidePrivacy ? resources.champions.name(player.championId) : player.gameName }}
                </div>
              </template>
              <div class="flex items-center gap-1 text-xs" v-if="!hidePrivacy">
                <span class="font-bold">{{ player.gameName }}</span>
                <span v-if="player.tagLine" class="text-white/80">#{{ player.tagLine }}</span>
              </div>
              <div class="flex items-center gap-1 text-xs" v-else>
                <span class="font-bold">{{ resources.champions.name(player.championId) }}</span>
              </div>
            </NTooltip>
          </div>

          <!-- spacer -->
          <div v-for="i in 5 - team.length" :key="i" class="h-4"></div>
        </div>
      </div>

      <div
        v-else-if="basicInfo.isCherrySubteam && !isThreePlayerCherryMode"
        class="z-2 my-1.5 grid w-42 max-w-42 grid-flow-col grid-cols-2 grid-rows-2 gap-x-2"
      >
        <!-- teams -->
        <div
          v-for="team of cherryWinningTeams"
          :key="team[0].teamIdentifier"
          class="flex min-w-0 flex-col justify-center gap-1"
        >
          <!-- team players -->
          <div
            v-for="player in team"
            :key="player.puuid"
            class="group flex cursor-pointer items-center gap-1"
          >
            <!-- placement -->
            <div
              class="size-4 shrink-0 rounded-full bg-black/10 text-center text-[11px] leading-4 text-black/80 dark:bg-white/10 dark:text-white/80"
            >
              {{ player.subteamPlacement }}
            </div>

            <!-- player champion avatar -->
            <ChampionIcon :champion-id="player.championId" class="size-4 shrink-0 rounded" />

            <NIcon
              class="text-black/80 dark:text-white/80"
              v-if="!player.puuid || player.puuid === EMPTY_PUUID"
            >
              <Robot />
            </NIcon>

            <NTooltip :keep-alive-on-hover="false">
              <template #trigger>
                <div
                  class="truncate text-xs transition-colors group-hover:text-black dark:group-hover:text-white"
                  :class="{
                    'font-bold text-black/90 dark:text-white/90': player.puuid === puuid,
                    'text-black/80 dark:text-white/80': player.puuid !== puuid
                  }"
                  @click.stop="navigateToSummonerByPuuid(player.puuid)"
                  @mousedown="handleMouseDown"
                  @mouseup="handleMouseUp($event, player.puuid)"
                >
                  {{ hidePrivacy ? resources.champions.name(player.championId) : player.gameName }}
                </div>
              </template>
              <div class="flex items-center gap-1 text-xs" v-if="!hidePrivacy">
                <span class="font-bold">{{ player.gameName }}</span>
                <span v-if="player.tagLine" class="text-white/80">#{{ player.tagLine }}</span>
              </div>
              <div class="flex items-center gap-1 text-xs" v-else>
                <span class="font-bold">{{ resources.champions.name(player.championId) }}</span>
              </div>
            </NTooltip>
          </div>
        </div>
      </div>

      <div
        v-else-if="basicInfo.isCherrySubteam"
        class="z-2 my-3 grid w-42 max-w-42 grid-flow-col grid-cols-2 grid-rows-3 content-center gap-x-2 gap-y-1"
      >
        <!-- teams -->
        <div
          v-for="team of cherryTeams"
          :key="team[0].teamIdentifier"
          class="flex min-w-0 items-center gap-1"
        >
          <!-- placement -->
          <div
            class="size-4 shrink-0 rounded-full bg-black/10 text-center text-[11px] leading-4 text-black/80 dark:bg-white/10 dark:text-white/80"
          >
            {{ team[0].subteamPlacement }}
          </div>

          <!-- team players -->
          <NTooltip v-for="player in team" :key="player.participantId" :keep-alive-on-hover="false">
            <template #trigger>
              <div
                class="relative cursor-pointer transition-[filter] hover:brightness-110"
                @click.stop="navigateToSummonerByPuuid(player.puuid)"
                @mousedown="handleMouseDown"
                @mouseup="handleMouseUp($event, player.puuid)"
              >
                <ChampionIcon
                  :champion-id="player.championId"
                  class="size-4 shrink-0 rounded"
                  :class="{ 'ring-1 ring-black/60 dark:ring-white/70': player.puuid === puuid }"
                />
                <NIcon
                  class="absolute -right-1 -bottom-1 text-[10px] text-black/80 dark:text-white/80"
                  v-if="!player.puuid || player.puuid === EMPTY_PUUID"
                >
                  <Robot />
                </NIcon>
              </div>
            </template>
            <div class="flex items-center gap-1 text-xs" v-if="!hidePrivacy">
              <span class="font-bold">{{ player.gameName }}</span>
              <span v-if="player.tagLine" class="text-white/80">#{{ player.tagLine }}</span>
            </div>
            <div class="flex items-center gap-1 text-xs" v-else>
              <span class="font-bold">{{ resources.champions.name(player.championId) }}</span>
            </div>
          </NTooltip>
        </div>
      </div>
    </div>

    <!-- right-end expand icon：.stop 防止冒泡到根元素的 toggle-expand（重复触发收起） -->
    <div
      @click.stop="$emit('toggle-expand')"
      class="z-1 flex w-8 cursor-pointer items-center justify-center border-t-0 border-r-0 border-b-0 border-l border-solid border-l-black/10 bg-white/20 transition-colors hover:bg-black/5 active:bg-black/5 dark:border-l-white/10 dark:bg-white/5 hover:dark:bg-white/10 active:dark:bg-white/5"
    >
      <NIcon
        class="text-base text-black/60 dark:text-white/60"
        :class="{ '-rotate-90': !isExpanded, 'rotate-90': isExpanded }"
      >
        <ArrowBackIosFilled />
      </NIcon>
    </div>

    <!-- 签名元素：左缘胜负色带（淡绿终端设计，3px 语义色条） -->
    <div
      class="result-stripe absolute top-0 left-0 z-0 h-full w-1"
      :class="{
        'bg-blue-500/90 dark:bg-blue-400/80': winStyleType === 'win',
        'bg-red-500/90 dark:bg-red-500/80': winStyleType === 'loss',
        'bg-gray-500/70 dark:bg-gray-400/60': winStyleType === 'neutral'
      }"
    />
  </div>
</template>

<script lang="ts" setup>
import PositionIcon from '@/components/match-card/icons/position-icons/PositionIcon.vue'
import AugmentDisplay from '@/components/widgets/AugmentDisplay.vue'
import ChampionIcon from '@/components/widgets/ChampionIcon.vue'
import ItemDisplay from '@/components/widgets/ItemDisplay.vue'
import PerkDisplay from '@/components/widgets/PerkDisplay.vue'
import PerkstyleDisplay from '@/components/widgets/PerkstyleDisplay.vue'
import SummonerSpellDisplay from '@/components/widgets/SummonerSpellDisplay.vue'
import { EMPTY_PUUID } from '@/utils/constants'
import { useGameResourceProvider } from '@/utils/match-card-resource'
import { t } from '@/utils/match-card-i18n'
import { noZero, useNumberFormatter } from '@/utils/numbers'
import { getCherryWinningTeamCount } from '@/views/match-detail/adapter/match-card-cherry'
import { Crown, Robot } from '@vicons/fa'
import { ArrowBackIosFilled } from '@vicons/material'
import { useIntervalFn } from '@vueuse/core'
// web 无全局 dayjs 配置，此处自包含注册相对时间插件与中文 locale（对齐原版 bootstrap）
import 'dayjs/locale/zh-cn'
import relativeTime from 'dayjs/plugin/relativeTime'
import dayjs from 'dayjs'
import { NIcon, NPopover, NTooltip } from 'naive-ui'
import { computed, ref } from 'vue'

dayjs.extend(relativeTime)

import { useMatchCard } from './context'
import { useGameResultName } from './utils/text'
import { useCardBorderClass, useWinResultStyleType } from './utils/theme'
import { formatSeconds } from './utils/time'
import ManyTags from './widgets/ManyTags.vue'
import RadarChart from './widgets/RadarChart.vue'

defineEmits<{
  'toggle-expand': []
}>()

const {
  puuid,
  basicInfo,
  teams,
  participants,
  isExpanded,
  hidePrivacy,
  navigateToSummonerByPuuid
} = useMatchCard()

const { formatExtremeNumber } = useNumberFormatter()

const gameResultName = useGameResultName()

const resources = useGameResourceProvider()

// 典型的 100 / 200 红蓝队方法
const twoTeams = computed(() => {
  if (!basicInfo.value.isTwoTeam) return []

  const teamIdentifiers = teams.value.teamStatsArr.map((t) => t.teamIdentifier).slice(0, 2)
  return teamIdentifiers.map((i) => {
    return participants.value.filter((s) => s.teamIdentifier === i).slice(0, 5) // 5 是战绩卡片的最大容纳量
  })
})

const cherryTeams = computed(() => {
  if (!basicInfo.value.isCherrySubteam) return []

  const teamIdentifiers = teams.value.teamStatsArr
    .toSorted((a, b) => a.subteamPlacement - b.subteamPlacement)
    .map((t) => t.teamIdentifier)

  return teamIdentifiers.map((i) => {
    return participants.value
      .filter((s) => s.teamIdentifier === i)
      .toSorted((a, b) => a.participantId - b.participantId)
  })
})

const cherryWinningTeams = computed(() => {
  if (!basicInfo.value.isCherrySubteam) return []

  const winningTeamCount = getCherryWinningTeamCount(teams.value.teamStatsArr.length)

  return cherryTeams.value
    .filter((team) => team[0]?.subteamPlacement <= winningTeamCount)
    .slice(0, winningTeamCount)
})

const isThreePlayerCherryMode = computed(() => {
  return cherryTeams.value.some((team) => team.length === 3)
})

const shouldShowCrown = computed(() => {
  return participant.value?.subteamPlacement === 1
})

// 自己相关的数据
const participant = computed(() => {
  return participants.value.find((s) => s.puuid === puuid.value)
})

const team = computed(() => {
  if (!participant.value) return null

  return teams.value.teamStatMap[participant.value.teamIdentifier]
})

// 符文：web 适配层 perks 为 { perkIds, perkStyle, perkSubStyle } 形状（任务 5），
// 对应原版 styles[0].selections[0].perk → perkIds[0]、styles[1].style → perkSubStyle
const perks = computed(() => {
  if (!participant.value) return null

  const { perkIds, perkSubStyle } = participant.value.perks

  // no id 0, no null
  if (!perkIds[0] || !perkSubStyle) {
    return null
  }

  return {
    primaryPerkId: perkIds[0],
    subPerkStyleId: perkSubStyle
  }
})

// UI 有些地方可以不用展示
const displayParts = computed(() => {
  return {
    spells: true,
    augments: basicInfo.value.gameMode === 'CHERRY' || basicInfo.value.gameMode === 'KIWI',
    runes: basicInfo.value.gameMode !== 'CHERRY' && basicInfo.value.gameMode !== 'KIWI',
    items: true,
    cs: basicInfo.value.gameMode === 'CLASSIC'
  }
})

// web 的 basicInfo 无 gameModeMutators 数据（任务 5 适配层），省略原版第二参
const mapName = computed(() => {
  return resources.maps.name(basicInfo.value.mapId)
})

const winStyleType = useWinResultStyleType()
const cardBorderClass = useCardBorderClass()

/**
 * 胜负背景微染（替代原 absolute 遮罩层）：
 * 原 shadow-win/loss 为全卡独立半透明合成层，快速滚动时 GPU 重绘有概率闪烁成
 * 明显的红/蓝遮罩；改为把胜负微染直接合成进玻璃背景（background 多层叠加），
 * 与卡片同层绘制，彻底消除闪烁
 */
const winLossBackground = computed(() => {
  // 玻璃底 + 中心柔和绿光晕（与 glass-card 一致，inline 覆盖以叠加胜负微染）
  const base =
    'radial-gradient(circle at 50% 50%, rgba(74,222,128,0.10), transparent 62%), rgba(17,22,17,0.88)'
  if (winStyleType.value === 'win') {
    // 胜利：极淡蓝微染（保留胜负语义但不抢内容）
    return { background: `linear-gradient(rgba(75,123,229,0.05), rgba(75,123,229,0.05)), ${base}` }
  }
  if (winStyleType.value === 'loss') {
    // 失败：极淡红微染
    return { background: `linear-gradient(rgba(224,62,82,0.05), rgba(224,62,82,0.05)), ${base}` }
  }
  return { background: base }
})

/** 伤害占比（0-100，四舍五入）：玻璃终端荧光数据条与百分比文字共用 */
const dmgPercentage = computed(() => {
  const teamTotal = teams.value.teamStatMap[participant.value!.teamIdentifier]
    .totalDamageDealtToChampions
  return Math.round(
    (participant.value!.totalDamageDealtToChampions / (teamTotal || 1)) * 100
  )
})

/** 承伤占比（0-100，四舍五入）：与伤害占比同风格展示（百分比 + 荧光数据条） */
const dmgTakenPercentage = computed(() => {
  const teamTotal = teams.value.teamStatMap[participant.value!.teamIdentifier].totalDamageTaken
  return Math.round((participant.value!.totalDamageTaken / (teamTotal || 1)) * 100)
})

/** 经济占比（0-100，四舍五入）：金币占队伍总收入比例，同伤害/承伤风格 */
const goldPercentage = computed(() => {
  const teamTotal = teams.value.teamStatMap[participant.value!.teamIdentifier].totalGoldEarned
  return Math.round((participant.value!.goldEarned / (teamTotal || 1)) * 100)
})

/**
 * 伤害转化率（伤转率）：对英雄总伤害 ÷ 获得金币（每 1 金币换来的伤害）
 * 数据条宽度 = 玩家伤转率 / 队均伤转率（队均 = 100% 基准，上限截断）
 */
const dge = computed(() => {
  return participant.value!.totalDamageDealtToChampions / noZero(participant.value!.goldEarned)
})

const dgeRatio = computed(() => {
  const team = teams.value.teamStatMap[participant.value!.teamIdentifier]
  const teamAvg = team.totalDamageDealtToChampions / noZero(team.totalGoldEarned)
  return Math.min(100, Math.round((dge.value / noZero(teamAvg)) * 100))
})

const formattedRelativeTime = ref('')
const gameCreationTitle = computed(() => {
  return dayjs(basicInfo.value.gameCreation).format('YYYY-MM-DD HH:mm:ss:SSS')
})

useIntervalFn(
  () => {
    const date = dayjs(basicInfo.value.gameCreation).locale(resources.runtime.locale.toLowerCase())
    if (dayjs().diff(date, 'day', true) > 3) {
      formattedRelativeTime.value = date.format('YYYY-MM-DD HH:mm')
    } else {
      formattedRelativeTime.value = date.fromNow()
    }
  },
  60000,
  { immediateCallback: true, immediate: true }
)

const handleMouseDown = (event: MouseEvent) => {
  if (event.button === 1) {
    event.preventDefault()
  }
}

const handleMouseUp = (event: MouseEvent, puuid: string) => {
  if (event.button === 1) {
    navigateToSummonerByPuuid(puuid, false)
  }
}
</script>

<style scoped>
@import './match-card.css';
</style>
