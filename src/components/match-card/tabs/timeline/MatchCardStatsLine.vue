<template>
  <!-- 属性时间线（任务 15 全量移植原版 MatchCardStatsLine，仅 SGP 数据有属性值）：
       左侧选手属性网格 + 帧滑动条 + 地图位置，右侧选手选择 -->
  <div class="flex size-full gap-4">
    <!-- 图表区域 -->
    <div v-if="selectedParticipant" class="box-border flex min-w-0 flex-1 flex-col px-2">
      <div class="mb-3 flex items-center gap-2">
        <ChampionIcon
          :champion-id="selectedParticipant.championId"
          class="size-7! shrink-0 border-2 border-solid"
          :style="{
            borderColor: getTeamColor(selectedParticipant.teamIdentifier)
          }"
          round
        />
        <div class="min-w-0 truncate text-sm font-medium text-black dark:text-white">
          <template v-if="hidePrivacy">
            {{ resources.champions.name(selectedParticipant.championId) }}
          </template>
          <template v-else>
            {{ selectedParticipant.gameName }} #{{ selectedParticipant.tagLine }}
          </template>
        </div>
        <div
          v-if="
            selectedParticipant.position && selectedParticipant.position.toLowerCase() !== 'invalid'
          "
          :class="tagTheme"
        >
          {{ position(selectedParticipant.position) }}
        </div>
      </div>

      <NSlider
        v-model:value="currentFrameIndex"
        :min="0"
        :max="series.length - 1"
        :format-tooltip="formatTooltip"
      />

      <!-- hint -->
      <div class="my-4 text-xs text-black/60 italic dark:text-white/60">
        {{ t('matchCard.statsLine.hint') }}
      </div>

      <!-- items -->
      <NScrollbar class="min-h-0 flex-1">
        <div class="grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-x-2 gap-y-4">
          <div class="flex flex-col" v-for="item of displayedItems">
            <div class="text-xs text-black/60 dark:text-white/60">{{ item.name }}</div>
            <div class="text-base font-bold text-black dark:text-white">
              {{ item.formattedValue }}
            </div>
          </div>
        </div>
      </NScrollbar>
    </div>

    <div class="flex w-52 flex-col">
      <template v-if="selectedFrameParticipant && isSupportedMap(basicInfo.mapId)">
        <MapPosition
          :size="180"
          transition
          :mapId="basicInfo.mapId"
          :points="[selectedFrameParticipant.position]"
        />

        <div class="my-3 h-px bg-black/10 dark:bg-white/10"></div>
      </template>

      <!-- 右侧控制面板 -->
      <NScrollbar class="min-h-0 flex-1">
        <div class="flex flex-col gap-3">
          <!-- 玩家选择 -->
          <div class="flex w-full flex-col gap-2">
            <div class="text-xs font-semibold text-black/60 dark:text-white/60">
              {{ t('matchCard.statsLine.participant') }}
            </div>

            <NRadioGroup v-model:value="selectedPlayer">
              <div class="flex flex-col gap-1.5">
                <NRadio
                  v-for="player in sortedPlayerOptions"
                  :key="player.value"
                  :value="player.value"
                >
                  <template #default>
                    <div class="flex w-48 items-center gap-2">
                      <!-- 颜色方块 -->
                      <div
                        class="h-3 w-3 shrink-0 rounded-sm"
                        :style="{ backgroundColor: player.color }"
                      ></div>
                      <span class="truncate">{{ player.label }}</span>
                    </div>
                  </template>
                </NRadio>
              </div>
            </NRadioGroup>
          </div>
        </div>
      </NScrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 属性时间线（任务 15）：移植原版 MatchCardStatsLine；
 * frames 经 toMatchCardTimelineSeries 归一化，championStats 仅 SGP 数据携带，
 * 非 SGP 数据时属性网格为空（对齐原版 isSgpDetailedParticipantFrame 判定）
 */
import ChampionIcon from '@/components/widgets/ChampionIcon.vue'
import { t } from '@/utils/match-card-i18n'
import { useGameResourceProvider } from '@/utils/match-card-resource'
import {
  isMatchCardDetailedParticipantFrame,
  toMatchCardTimelineSeries
} from '@/views/match-detail/adapter/match-card-timeline'
import { NRadio, NRadioGroup, NScrollbar, NSlider } from 'naive-ui'
import { computed, ref, watch } from 'vue'

import { useMatchCard } from '../../context'
import { isSupportedMap } from '../../utils/game-map'
import { usePosition } from '../../utils/text'
import { getTeamColor, playerColors, useWinResultTagClass } from '../../utils/theme'
import { formatMilliseconds } from '../../utils/time'
import MapPosition from '../../widgets/MapPosition.vue'

const resources = useGameResourceProvider()

const { basicInfo, frames, participants, team, hidePrivacy } = useMatchCard()

const currentFrameIndex = ref(0)
const selectedPlayer = ref(0)

const position = usePosition()
const tagTheme = useWinResultTagClass(() => team.value?.winResult)

/** 归一化后的时间线序列（滑动条 max 与选手帧查询共用） */
const series = computed(() => toMatchCardTimelineSeries(frames.value))

const formatTooltip = (index: number) => {
  return formatMilliseconds(series.value[index]?.timestamp || 0)
}

const sortedPlayerOptions = computed(() => {
  return participants.value
    .toSorted((a, b) => {
      if (basicInfo.value.isCherrySubteam) {
        return a.subteamPlacement - b.subteamPlacement
      }

      return a.teamIdentifier.localeCompare(b.teamIdentifier)
    })
    .map((p) => {
      return {
        value: p.participantId,
        label: `${resources.champions.name(p.championId)}`,
        color: playerColors[(p.participantId - 1) % playerColors.length]
      }
    })
})

const selectedParticipant = computed(() => {
  return participants.value.find((p) => p.participantId === selectedPlayer.value)
})

/** 当前帧所选选手的参与者帧（地图位置展示用） */
const selectedFrameParticipant = computed(() => {
  return series.value[currentFrameIndex.value]?.participantFrames[selectedPlayer.value]
})

/** 属性展示项：仅 SGP 详细帧有 championStats，其余数据源为空数组（对齐原版判定） */
const displayedItems = computed(() => {
  if (!isMatchCardDetailedParticipantFrame(selectedFrameParticipant.value)) {
    return []
  }

  const stats = selectedFrameParticipant.value.championStats

  // 顺序：生命/资源 → 攻击 → 法术与冷却 → 防御 → 穿透 → 移速与吸血 → 控制减免
  return [
    {
      name: t('matchCard.statsLine.stats.health'),
      formattedValue: `${stats.health.toString()} / ${stats.healthMax.toString()}`
    },
    {
      name: t('matchCard.statsLine.stats.healthRegen'),
      formattedValue: stats.healthRegen.toString()
    },
    {
      name: t('matchCard.statsLine.stats.power'),
      formattedValue: `${stats.power.toString()} / ${stats.powerMax.toString()}`
    },
    {
      name: t('matchCard.statsLine.stats.powerRegen'),
      formattedValue: stats.powerRegen.toString()
    },
    {
      name: t('matchCard.statsLine.stats.attackDamage'),
      formattedValue: stats.attackDamage.toString()
    },
    {
      name: t('matchCard.statsLine.stats.attackSpeed'),
      formattedValue: `${stats.attackSpeed.toString()}%`
    },
    {
      name: t('matchCard.statsLine.stats.abilityPower'),
      formattedValue: stats.abilityPower.toString()
    },
    {
      name: t('matchCard.statsLine.stats.abilityHaste'),
      formattedValue: stats.abilityHaste.toString()
    },
    {
      name: t('matchCard.statsLine.stats.cooldownReduction'),
      formattedValue: `${stats.cooldownReduction.toString()}%`
    },
    { name: t('matchCard.statsLine.stats.armor'), formattedValue: stats.armor.toString() },
    {
      name: t('matchCard.statsLine.stats.magicResist'),
      formattedValue: stats.magicResist.toString()
    },
    { name: t('matchCard.statsLine.stats.armorPen'), formattedValue: stats.armorPen.toString() },
    {
      name: t('matchCard.statsLine.stats.armorPenPercent'),
      formattedValue: `${stats.armorPenPercent.toString()}%`
    },
    {
      name: t('matchCard.statsLine.stats.bonusArmorPenPercent'),
      formattedValue: `${stats.bonusArmorPenPercent.toString()}%`
    },
    { name: t('matchCard.statsLine.stats.magicPen'), formattedValue: stats.magicPen.toString() },
    {
      name: t('matchCard.statsLine.stats.magicPenPercent'),
      formattedValue: `${stats.magicPenPercent.toString()}%`
    },
    {
      name: t('matchCard.statsLine.stats.bonusMagicPenPercent'),
      formattedValue: `${stats.bonusMagicPenPercent.toString()}%`
    },
    {
      name: t('matchCard.statsLine.stats.movementSpeed'),
      formattedValue: stats.movementSpeed.toString()
    },
    {
      name: t('matchCard.statsLine.stats.lifesteal'),
      formattedValue: `${stats.lifesteal.toString()}%`
    },
    {
      name: t('matchCard.statsLine.stats.physicalVamp'),
      formattedValue: `${stats.physicalVamp.toString()}%`
    },
    {
      name: t('matchCard.statsLine.stats.spellVamp'),
      formattedValue: `${stats.spellVamp.toString()}%`
    },
    {
      name: t('matchCard.statsLine.stats.omnivamp'),
      formattedValue: `${stats.omnivamp.toString()}%`
    },
    {
      name: t('matchCard.statsLine.stats.ccReduction'),
      formattedValue: `${stats.ccReduction.toString()}%`
    }
  ]
})

watch(
  () => sortedPlayerOptions.value,
  (options) => {
    if (options.length > 0) {
      selectedPlayer.value = options[0].value
    }
  },
  { immediate: true }
)
</script>

<style scoped></style>
