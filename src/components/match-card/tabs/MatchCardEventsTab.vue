<template>
  <!-- 事件 Tab（任务 15 全量移植原版 MatchCardEventsTab）：
       左侧 NTimeline 时间线（击杀/一血多杀/拆塔/镀层），右侧控制面板（事件筛选/按英雄筛选/镀层统计）
       窄容器（手机，<640px）下左右双栏纵向堆叠：容器高度放开为自适应，
       时间线区域固定 h-96 保证内部 NScrollbar 可滚 -->
  <div class="flex h-142 w-full gap-4 @max-[640px]:flex-col @max-[640px]:h-auto">
    <!-- 左侧：时间线区域 -->
    <div class="min-h-0 flex-1 @max-[640px]:h-96 @max-[640px]:flex-none">
      <NScrollbar class="h-full w-full">
        <div class="pt-2 pl-4">
          <NTimeline>
            <NTimelineItem
              :title="t('matchCard.eventsTab.start')"
              :time="formatDuration(firstAndEndTime.firstTime)"
            />

            <template v-for="e of filteredEvents">
              <NTimelineItem
                v-if="e.type === 'CHAMPION_KILL' && selectedFilters.includes('CHAMPION_KILL')"
                type="success"
                :time="formatDuration(e.timestamp)"
              >
                <template #header>
                  <div class="flex items-center gap-2">
                    <div>{{ frameEventType(e.type) }}</div>

                    <!-- view map position -->
                    <NPopover
                      v-if="isSupportedMap(basicInfo.mapId)"
                      :show-arrow="false"
                      placement="right"
                    >
                      <template #trigger>
                        <div :class="tagTheme">{{ t('matchCard.eventsTab.viewPosition') }}</div>
                      </template>
                      <MapPosition :mapId="basicInfo.mapId" :points="[e.position]" />
                    </NPopover>

                    <!-- view victim damage details -->
                    <NPopover
                      v-if="isMatchCardChampionKillEvent(e)"
                      :show-arrow="false"
                      placement="right"
                    >
                      <template #trigger>
                        <div :class="tagTheme">
                          {{ t('matchCard.eventsTab.viewVictimDamageDetails') }}
                        </div>
                      </template>
                      <VictimDamageDetails :event="e" />
                    </NPopover>
                  </div>
                </template>
                <div class="flex w-fit items-center gap-2">
                  <div class="flex items-end">
                    <ChampionIcon
                      :champion-id="participantMap[e.killerId]?.championId"
                      class="size-5 rounded not-last:mr-1"
                    />
                    <ChampionIcon
                      v-for="a of e.assistingParticipantIds"
                      :key="a"
                      :champion-id="participantMap[a].championId"
                      class="size-3.5 rounded not-last:mr-0.5"
                    />
                  </div>
                  <div class="text-sm text-black/80 dark:text-white/80">
                    {{ t('matchCard.eventsTab.kill') }}
                  </div>
                  <ChampionIcon
                    :champion-id="participantMap[e.victimId].championId"
                    class="size-5 rounded"
                  />
                </div>
              </NTimelineItem>

              <NTimelineItem
                v-if="
                  e.type === 'CHAMPION_SPECIAL_KILL' &&
                  selectedFilters.includes('CHAMPION_SPECIAL_KILL')
                "
                :title="`${e.killType}`"
                type="success"
                :time="formatDuration(e.timestamp)"
              >
                <template #header>
                  <div class="flex w-fit cursor-pointer items-center gap-2">
                    <ChampionIcon
                      :champion-id="participantMap[e.killerId]?.championId"
                      class="size-5 rounded"
                    />
                    <div v-if="e.killType === 'KILL_FIRST_BLOOD'">
                      {{ t('matchCard.eventsTab.firstBlood') }}
                    </div>
                    <div v-else-if="e.killType === 'KILL_MULTI'">
                      {{ t('matchCard.eventsTab.multiKill', { count: e.multiKillLength ?? 0 }) }}
                    </div>
                    <div v-else-if="e.killType === 'KILL_ACE'">
                      {{ t('matchCard.eventsTab.ace') }}
                    </div>
                    <NPopover
                      v-if="isSupportedMap(basicInfo.mapId)"
                      :show-arrow="false"
                      placement="right"
                    >
                      <template #trigger>
                        <div :class="tagTheme">{{ t('matchCard.eventsTab.viewPosition') }}</div>
                      </template>
                      <MapPosition :mapId="basicInfo.mapId" :points="[e.position]" />
                    </NPopover>
                  </div>
                </template>
              </NTimelineItem>

              <NTimelineItem
                v-if="e.type === 'BUILDING_KILL' && selectedFilters.includes('BUILDING_KILL')"
                :title="t('matchCard.eventsTab.destroyBuilding')"
                type="warning"
                :time="formatDuration(e.timestamp)"
              >
                <NPopover :show-arrow="false" placement="right">
                  <template #trigger>
                    <div class="flex w-fit cursor-pointer items-center gap-2">
                      <ChampionIcon
                        :champion-id="participantMap[e.killerId]?.championId"
                        class="size-5 rounded"
                      />
                      <div class="text-black/60 dark:text-white/60">
                        {{ t('matchCard.eventsTab.destroyed') }}
                      </div>
                      <template v-if="e.buildingType === 'TOWER_BUILDING'">
                        <Tower class="size-4" />
                        <div class="font-bold">
                          {{ e.laneType ? laneType(e.laneType) : '' }}
                          {{ e.towerType ? towerType(e.towerType) : buildingType(e.buildingType) }}
                        </div>
                      </template>
                      <template v-else-if="e.buildingType === 'INHIBITOR_BUILDING'">
                        <Inhibitor class="size-4" />
                        <div class="font-bold">
                          {{ buildingType(e.buildingType) }}
                        </div>
                      </template>
                    </div>
                  </template>
                  <MapPosition :mapId="basicInfo.mapId" :points="[e.position]" />
                </NPopover>
              </NTimelineItem>

              <NTimelineItem
                v-if="
                  e.type === 'TURRET_PLATE_DESTROYED' &&
                  e.killerId !== 0 &&
                  selectedFilters.includes('TURRET_PLATE_DESTROYED')
                "
                :title="t('matchCard.eventsTab.destroyPlateTitle')"
                type="warning"
                :time="formatDuration(e.timestamp)"
              >
                <div class="flex w-fit cursor-pointer items-center gap-2">
                  <ChampionIcon
                    :champion-id="participantMap[e.killerId]?.championId"
                    class="size-5 rounded"
                  />
                  <div class="text-black/60 dark:text-white/60">
                    {{ t('matchCard.eventsTab.destroyed') }}
                  </div>
                  <div class="font-bold">
                    {{
                      e.laneType
                        ? t('matchCard.eventsTab.plateLane', { lane: laneType(e.laneType) })
                        : t('matchCard.eventsTab.plate')
                    }}
                  </div>
                </div>
              </NTimelineItem>
            </template>

            <NTimelineItem
              :title="t('matchCard.eventsTab.end')"
              :time="formatDuration(firstAndEndTime.endTime)"
            />
          </NTimeline>
        </div>
      </NScrollbar>
    </div>

    <!-- 右侧：控制面板（与 DiffLineChart 风格一致） -->
    <!-- 右侧控制面板：窄容器下占满行宽（堆叠到时间线下方） -->
    <NScrollbar class="w-52! @max-[640px]:w-full!">
      <div class="flex flex-col gap-3">
        <!-- 筛选器 -->
        <div class="flex w-full flex-col gap-2">
          <div class="text-xs font-semibold text-black/60 dark:text-white/60">
            {{ t('matchCard.eventsTab.filters') }}
          </div>
          <NCheckboxGroup v-model:value="selectedFilters">
            <div class="flex flex-col gap-1.5">
              <NCheckbox
                v-for="type of eventTypes"
                :key="type"
                :value="type"
                :label="frameEventType(type)"
              />
            </div>
          </NCheckboxGroup>
        </div>

        <div class="h-px bg-black/10 dark:bg-white/10"></div>

        <!-- 按英雄筛选 -->
        <div class="flex w-full flex-col gap-2">
          <div class="text-xs font-semibold text-black/60 dark:text-white/60">
            {{ t('matchCard.eventsTab.filterByChampion') }}
          </div>
          <NCheckboxGroup v-model:value="selectedChampionIds">
            <div class="flex flex-col gap-1.5">
              <NCheckbox
                v-for="opt of championFilterOptions"
                :key="opt.championId"
                :value="opt.championId"
              >
                <template #default>
                  <div class="flex items-center gap-1.5">
                    <ChampionIcon :champion-id="opt.championId" class="size-4 rounded" />
                    <span class="text-sm">{{ opt.label }}</span>
                  </div>
                </template>
              </NCheckbox>
            </div>
          </NCheckboxGroup>
        </div>

        <!-- 展示防御塔镀层每人数量 -->
        <template v-if="platesTakeParticipants">
          <div class="h-px bg-black/10 dark:bg-white/10"></div>

          <div class="text-xs font-semibold text-black/60 dark:text-white/60">
            {{ t('matchCard.eventsTab.plateStats') }}
          </div>

          <div class="flex flex-col gap-1">
            <div v-for="k of platesTakeParticipants">
              <div class="flex items-center gap-2">
                <ChampionIcon :champion-id="k.championId" class="size-5 rounded" />
                <div class="text-sm text-black/80 dark:text-white/80">
                  {{ resources.champions.name(k.championId) }}
                </div>
                <div :class="tagTheme">
                  {{ t('matchCard.eventsTab.plateCount', { count: k.platesTake }) }}
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </NScrollbar>
  </div>
</template>

<script setup lang="ts">
/**
 * 事件 Tab（任务 15）：移植原版 MatchCardEventsTab，数据经适配层 toMatchCardEvents/
 * toMatchCardTimelineSeries 消费（缺失字段事件已跳过）；NTimeline 时间线与右侧筛选面板保留
 */
import ChampionIcon from '@/components/widgets/ChampionIcon.vue'
import { t } from '@/utils/match-card-i18n'
import { useGameResourceProvider } from '@/utils/match-card-resource'
import {
  isMatchCardChampionKillEvent,
  toMatchCardEvents,
  toMatchCardTimelineSeries
} from '@/views/match-detail/adapter/match-card-timeline'
import type { MatchCardTimelineEvent } from '@/views/match-detail/adapter/types'
import dayjs from 'dayjs'
// web 无全局 dayjs 配置，此处自包含注册 duration 插件（对齐原版 MatchCardOverview 的注册模式）
import duration from 'dayjs/plugin/duration'
dayjs.extend(duration)
import {
  NCheckbox,
  NCheckboxGroup,
  NPopover,
  NScrollbar,
  NTimeline,
  NTimelineItem
} from 'naive-ui'
import { computed, ref } from 'vue'

import { useMatchCard } from '../context'
import Inhibitor from '../icons/Inhibitor.vue'
import Tower from '../icons/Tower.vue'
import { isSupportedMap } from '../utils/game-map'
import { useBuildingType, useFrameEventType, useLaneType, useTowerType } from '../utils/text'
import { useWinResultTagClass } from '../utils/theme'
import MapPosition from '../widgets/MapPosition.vue'
import VictimDamageDetails from '../widgets/VictimDamageDetails.vue'

const { participants, basicInfo, frames, team } = useMatchCard()

// 游戏资源提供者（英雄名等静态资源查询，web 版无网络依赖）
const resources = useGameResourceProvider()

/** 事件类型白名单：Events Tab 仅渲染这四类事件（对齐原版 SUPPORTED_EVENT_TYPES） */
const SUPPORTED_EVENT_TYPES = [
  'CHAMPION_KILL',
  'CHAMPION_SPECIAL_KILL',
  'BUILDING_KILL',
  'TURRET_PLATE_DESTROYED'
]
/**
 * 事件类型筛选：勾选的事件类型才在时间线中渲染（原版默认勾选击杀与拆塔，
 * 一血/镀层事件默认折叠，可在右侧筛选面板手动开启）
 */
const selectedFilters = ref<(typeof SUPPORTED_EVENT_TYPES)[number][]>([
  'CHAMPION_KILL',
  'BUILDING_KILL'
])

/** 按英雄筛选：为空表示不过滤，否则只显示与所选英雄相关的事件 */
const selectedChampionIds = ref<number[]>([])

/**
 * 时间戳格式化：超过一小时带小时位（mm:ss:SSS / HH:mm:ss:SSS），
 * 与时间线事件时间的展示口径一致（毫秒级精度，便于定位到具体时刻）
 */
const formatDuration = (timestamp: number) => {
  if (timestamp > 60 * 60 * 1000) {
    return dayjs.duration(timestamp).format('HH:mm:ss:SSS')
  }

  return dayjs.duration(timestamp).format('mm:ss:SSS')
}

/**
 * 事件类型（去重），用于筛选器勾选项：取本局实际出现的受支持类型，
 * 未出现的事件类型不展示勾选框（避免无效筛选项）
 */
const eventTypes = computed(() => {
  return [
    ...new Set(
      events.value
        .map((event) => event.type)
        .filter((type) => SUPPORTED_EVENT_TYPES.includes(type))
    )
  ]
})

/** 全部事件（适配层已跳过字段缺失事件，仅含 Events Tab 渲染的四类） */
const events = computed(() => toMatchCardEvents(frames.value))

/**
 * 获取事件涉及的 participantId 列表（击杀者、助攻、被击杀者等）：
 * 按事件类型存在性判断字段（in 收窄），用于按英雄筛选时判定事件归属
 */
const getEventParticipantIds = (e: MatchCardTimelineEvent): number[] => {
  const ids: number[] = []
  if ('killerId' in e && e.killerId) ids.push(e.killerId)
  if ('victimId' in e && e.victimId) ids.push(e.victimId)
  if ('assistingParticipantIds' in e && Array.isArray(e.assistingParticipantIds)) {
    ids.push(...e.assistingParticipantIds)
  }
  return ids
}

/**
 * 按英雄筛选后的事件（未选任何英雄时全量返回）：
 * 事件涉及的参与者英雄 ID 与所选英雄集合有交集即保留
 */
const filteredEvents = computed(() => {
  const championIds = selectedChampionIds.value
  if (championIds.length === 0) return events.value
  const map = participantMap.value
  return events.value.filter((e) => {
    const pids = getEventParticipantIds(e)
    const involvedChampionIds = pids
      .map((pid) => map[pid]?.championId)
      .filter((id): id is number => id != null)
    return involvedChampionIds.some((cid) => championIds.includes(cid))
  })
})

/**
 * 本局出现的英雄列表（按 championId 去重），用于按英雄筛选：
 * 同名英雄（镜像/克隆）只出现一次，按英雄名排序便于查找
 */
const championFilterOptions = computed(() => {
  const seen = new Set<number>()
  return participants.value
    .filter((p) => {
      if (seen.has(p.championId)) return false
      seen.add(p.championId)
      return true
    })
    .map((p) => ({
      championId: p.championId,
      label: resources.champions.name(p.championId)
    }))
    .toSorted((a, b) => a.label.localeCompare(b.label))
})

/**
 * 镀层统计：每位选手摧毁的镀层数。
 * killerId 为 0 表示镀层自行掉落（非选手摧毁），不计入；无镀层事件时返回 null 隐藏面板；
 * 结果按摧毁数降序，并关联到参与者以取英雄 ID 与名称
 */
const platesTakeParticipants = computed(() => {
  const plateEvents = events.value
    .filter((e) => e.type === 'TURRET_PLATE_DESTROYED')
    .filter((e) => e.killerId !== 0)

  if (plateEvents.length === 0) return null

  // 按击杀者（participantId）累加镀层数
  const map = plateEvents.reduce(
    (acc, event) => {
      acc[event.killerId] = (acc[event.killerId] || 0) + 1
      return acc
    },
    {} as Record<number, number>
  )

  return Object.entries(map)
    .toSorted((a, b) => b[1] - a[1])
    .map(([k, v]) => {
      const participant = participants.value.find((p) => p.participantId === Number(k))

      if (!participant) return null

      return {
        championId: participant.championId,
        platesTake: v
      }
    })
    .filter((p) => p !== null)
})

/**
 * 参与者编号 → 参与者索引：击杀/助攻/被击杀者英雄图标查询用，
 * 未命中（如野怪击杀）返回 undefined，模板以 ?. 兜底
 */
const participantMap = computed(() => {
  return participants.value.reduce(
    (acc, participant) => {
      acc[participant.participantId] = participant
      return acc
    },
    {} as Record<number, (typeof participants.value)[number]>
  )
})

/**
 * 首帧与末帧时间（时间线起止节点展示）：
 * sgp source 会记录真正时间，所以有数据就直接用——末帧存在 GAME_END 事件时
 * 以该事件时间为准（更精确），否则退化为末帧自身时间戳
 */
const firstAndEndTime = computed(() => {
  const series = toMatchCardTimelineSeries(frames.value)
  if (series.length === 0) return { firstTime: 0, endTime: 0 }

  const lastFrame = series[series.length - 1]
  const lastEvent = lastFrame?.events?.[lastFrame.events.length - 1]

  let endTime = 0
  if (lastEvent && lastEvent.type === 'GAME_END') {
    endTime = lastEvent.timestamp
  } else {
    endTime = lastFrame.timestamp
  }

  return {
    firstTime: series[0].timestamp,
    endTime
  }
})

// 事件/建筑/塔/分路类型文案工厂（缺失 key 回显原值，与文本工具口径一致）
const frameEventType = useFrameEventType()
const buildingType = useBuildingType()
const towerType = useTowerType()
const laneType = useLaneType()

// 胜负标签主题（win 蓝 / loss 红），击杀头部标签与镀层统计徽章共用
const tagTheme = useWinResultTagClass(() => team.value?.winResult)
</script>

<style scoped>
@import '../match-card.css';
</style>
