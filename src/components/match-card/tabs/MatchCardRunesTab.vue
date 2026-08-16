<template>
  <!-- 符文 Tab：每名玩家一个块（头像/位置/统计符文 + 6 枚天赋树符文及其对局内统计） -->
  <div class="relative">
    <NScrollbar ref="scrollbarRef" x-scrollable class="max-h-142">
      <div ref="contentRef">
        <!-- Players -->
        <div
          v-for="p of sortedParticipants"
          :key="p.puuid"
          :data-runes-participant-id="p.participantId"
          class="rounded-lg bg-black/3 p-3 pr-12 not-last:mb-2 dark:bg-white/3"
        >
          <!-- Player Header -->
          <div class="mb-1 flex items-center gap-2">
            <ChampionIcon
              :champion-id="p.championId"
              class="size-7! shrink-0 border-2 border-solid"
              :style="{
                borderColor: getTeamColor(p.teamIdentifier)
              }"
              round
            />
            <div class="min-w-0 truncate text-sm font-medium">{{ participantName(p) }}</div>
            <div v-if="p.position && p.position.toLowerCase() !== 'invalid'" :class="tagTheme">
              {{ position(p.position) }}
            </div>

            <!-- 对局内统计符文（仅 SGP 提供；灰色环，与天赋树环色区分） -->
            <div v-if="playerPerks[p.participantId].statPerks" class="ml-2 flex gap-2">
              <PerkDisplay
                v-for="statPerkId of playerPerks[p.participantId].statPerks"
                class="rounded-full ring-2"
                :class="getPerkStyleRingColor(-1)"
                :perk-id="statPerkId"
                :size="16"
              />
            </div>
          </div>

          <!-- divider -->
          <div class="my-3 h-px bg-black/10 dark:bg-white/10"></div>

          <!-- perks：主系 4 枚 + 副系 2 枚，按对局内选择顺序平铺 -->
          <div
            v-for="perk of playerPerks[p.participantId].perks"
            :key="perk.perkId"
            class="not-last:mb-4"
          >
            <div class="flex gap-4">
              <PerkDisplay
                :perk-id="perk.perkId"
                :size="24"
                class="rounded-full ring-2"
                :class="getPerkStyleRingColor(perk.styleId)"
              />

              <div>
                <div class="mb-2 text-sm font-bold text-black dark:text-white">
                  {{ perk.name }}
                </div>

                <!-- 对局内统计描述：@eogvarN@ 占位符已替换为该选手的实际数值 -->
                <div
                  v-for="desc of perk.descriptions"
                  :key="desc"
                  class="flex flex-wrap items-center text-sm text-black/80 not-last:mb-1 dark:text-white/80"
                >
                  <div
                    class="mr-2 size-2 rotate-45 rounded-sm"
                    :class="getPerkStyleIndicatorColor(perk.styleId)"
                  ></div>
                  <div class="text-sm!" lol-view v-html="desc" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </NScrollbar>

    <!-- 选手导航器：折叠时仅显示头像，展开后显示名字并支持点击滚动定位 -->
    <div
      class="absolute top-2 right-2 z-10 box-border flex max-h-[calc(100%-1rem)] flex-col overflow-hidden rounded border border-black/10 bg-neutral-100/95 p-1 opacity-45 shadow-lg shadow-black/10 transition-[width,opacity] focus-within:opacity-100 hover:opacity-100 dark:border-white/10 dark:bg-neutral-900/95 dark:shadow-black/30"
      :class="isNavigatorExpanded ? 'w-40' : 'w-11'"
    >
      <NButton
        class="mb-2! self-center"
        circle
        secondary
        size="tiny"
        :focusable="false"
        @click="isNavigatorExpanded = !isNavigatorExpanded"
      >
        <template #icon>
          <NIcon>
            <ChevronRight20Regular v-if="isNavigatorExpanded" />
            <ChevronLeft20Regular v-else />
          </NIcon>
        </template>
      </NButton>

      <div
        class="match-card-participant-navigator-list min-h-0 space-y-1 overflow-x-hidden overflow-y-auto"
      >
        <NTooltip
          v-for="p of sortedParticipants"
          :key="p.puuid"
          placement="left"
          :disabled="isNavigatorExpanded"
        >
          <template #trigger>
            <button
              type="button"
              class="box-border flex h-7 w-full cursor-pointer items-center gap-2 rounded border-0 p-0 text-left text-black/80 transition-colors dark:text-white/80"
              :class="[
                isNavigatorExpanded ? 'justify-start px-1' : 'justify-center',
                'bg-transparent hover:bg-black/8 dark:hover:bg-white/10'
              ]"
              @click="scrollToParticipant(p.participantId)"
            >
              <ChampionIcon
                :champion-id="p.championId"
                class="size-6! shrink-0 border-2 border-solid"
                :style="{
                  borderColor: getTeamColor(p.teamIdentifier)
                }"
                round
              />
              <span v-if="isNavigatorExpanded" class="min-w-0 flex-1 truncate text-xs">
                {{ participantName(p) }}
              </span>
            </button>
          </template>
          {{ participantName(p) }}
        </NTooltip>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
/**
 * 符文 Tab（任务 12 全量移植原版 MatchCardRunesTab）：
 * 数据经任务 5 适配层 participant.perks（{ perkIds, perkStyle, perkSubStyle, perkVars, statPerks }）
 * 消费——perkIds 平铺 6 枚选中符文（索引 0-3 主系、4-5 副系），对应原版 styles 的 selections；
 * 符文名称/图标/对局内统计描述经任务 4 的 perkDisplay（CDragon）异步加载并缓存；
 * 原版 @eogvarN@ 占位符替换逻辑保留：描述内占位符替换为该选手对局内的 var1-3 实际数值
 */
import ChampionIcon from '@/components/widgets/ChampionIcon.vue'
import PerkDisplay from '@/components/widgets/PerkDisplay.vue'
import { useGameResourceProvider } from '@/utils/match-card-resource'
import { perkDisplay as fetchPerkDisplay, type PerkDisplayResource } from '@/utils/game-resource'
import { ChevronLeft20Regular, ChevronRight20Regular } from '@vicons/fluent'
import { NButton, NIcon, NScrollbar, NTooltip } from 'naive-ui'
import { computed, reactive, ref, watch } from 'vue'

import { useMatchCard } from '../context'
import { usePosition } from '../utils/text'
import { getTeamColor, useWinResultTagClass } from '../utils/theme'

const { basicInfo, participants, team, hidePrivacy } = useMatchCard()

// 游戏资源（英雄名等）与位置文案、胜负标签主题
const resources = useGameResourceProvider()
const position = usePosition()
const tagTheme = useWinResultTagClass(() => team.value?.winResult)

// 导航器滚动定位引用：scrollbarRef 滚动容器、contentRef 内容区、isNavigatorExpanded 展开态
const scrollbarRef = ref<InstanceType<typeof NScrollbar> | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const isNavigatorExpanded = ref(false)

/** 对局内统计描述里的占位符（原版特性）：@eogvarN@ → 对应 varN 实际数值 */
const EOG_PLACEHOLDER_PATTERN = /@eogvar(\d+)@/g

/** 单枚选中符文的展示块（名称 + 填充数值后的对局内统计描述） */
interface PlayerPerkDisplay {
  perkId: number
  name: string
  descriptions: string[]
  styleId: number
}

/** 单名玩家的符文展示数据（perks 按对局内选择顺序平铺，statPerks 为 [进攻, 灵活, 防御]） */
interface PlayerPerkStats {
  perks: PlayerPerkDisplay[]
  statPerks: number[] | null
}

/** 需要加载展示资源的符文 ID 集合（去重；0/null 视为空槽跳过） */
const requestedPerkIds = computed(() => {
  const ids = new Set<number>()
  for (const p of participants.value) {
    for (const perkId of p.perks.perkIds) {
      if (perkId) {
        ids.add(perkId)
      }
    }
  }
  return Array.from(ids)
})

/**
 * 符文展示资源缓存（perkId → 资源；加载中为 null，完成填充后驱动重渲染）
 * 符文表为静态数据，一次性缓存避免重复请求
 */
const perkDisplayCache = reactive<Record<number, PerkDisplayResource | null>>({})

// 监听新增符文 ID 并加载缺失资源（已加载/加载中跳过；perkDisplay 内部兜底不会 reject）
watch(
  requestedPerkIds,
  (ids) => {
    for (const perkId of ids) {
      if (!(perkId in perkDisplayCache)) {
        perkDisplayCache[perkId] = null
        fetchPerkDisplay(perkId).then((resource) => {
          perkDisplayCache[perkId] = resource
        })
      }
    }
  },
  { immediate: true }
)

/** 组装每名玩家的符文展示块：perkIds 索引 0-3 归主系（perkStyle）、4-5 归副系（perkSubStyle） */
const playerPerks = computed(() => {
  const perkStats: Record<number, PlayerPerkStats> = {}

  for (const p of participants.value) {
    const { perkIds, perkStyle, perkSubStyle, perkVars, statPerks } = p.perks

    const mapped = perkIds
      .map((perkId, index) => {
        // 空槽（0/null）跳过；展示资源缺失（未知符文/数据未就绪）时按原版语义隐藏该块
        if (!perkId) {
          return null
        }
        const resource = perkDisplayCache[perkId]
        if (!resource?.name) {
          return null
        }
        // 对局内变量缺失时补 0（防御性兜底；真实 LCU/SGP 双源数据均携带）
        const vars = perkVars?.[index] ?? { var1: 0, var2: 0, var3: 0 }
        const descriptions = (resource.endOfGameStatDescriptions ?? []).map((desc) => {
          // @eogvarN@ → varN：占位符替换为该选手该局的实际数值（原版特性，逐位兜底）
          return desc.replace(EOG_PLACEHOLDER_PATTERN, (_, varIndex) => {
            switch (varIndex) {
              case '1':
                return vars.var1.toString()
              case '2':
                return vars.var2.toString()
              case '3':
                return vars.var3.toString()
              default:
                // 未知占位符编号：保留原文不替换
                return _
            }
          })
        })

        return {
          perkId,
          name: resource.name,
          descriptions,
          // 主系 4 枚用主系样式环色，副系 2 枚用副系样式环色（缺失时 -1 走灰色默认）
          styleId: index < 4 ? (perkStyle ?? -1) : (perkSubStyle ?? -1)
        }
      })
      .filter((v): v is PlayerPerkDisplay => v !== null)

    perkStats[p.participantId] = {
      perks: mapped,
      // 统计符文平铺为 [进攻, 灵活, 防御]（仅 SGP 提供，LCU 为 null 不渲染）
      statPerks: statPerks ? [statPerks.offense, statPerks.flex, statPerks.defense] : null
    }
  }

  return perkStats
})

type Participant = (typeof participants.value)[number]

/** 玩家名：隐私模式（hidePrivacy）下用英雄名代替召唤师名 */
const participantName = (participant: Participant) => {
  if (hidePrivacy.value) {
    return resources.champions.name(participant.championId)
  }

  return participant.tagLine
    ? `${participant.gameName} #${participant.tagLine}`
    : participant.gameName
}

/** 导航器点击：滚动内容区到指定玩家块（data-runes-participant-id 定位） */
const scrollToParticipant = (participantId: number) => {
  const target = contentRef.value?.querySelector<HTMLElement>(
    `[data-runes-participant-id="${participantId}"]`
  )

  if (!target) {
    return
  }

  scrollbarRef.value?.scrollTo({
    top: Math.max(target.offsetTop - 8, 0),
    behavior: 'smooth'
  })
}

/** 符文环色：按主/副系样式 ID 取主题色（未知样式回退灰色） */
const getPerkStyleRingColor = (styleId: number) => {
  switch (styleId) {
    case 8000: // Precision
      return 'ring-amber-700/60 dark:ring-amber-500/60'
    case 8100: // Domination
      return 'ring-red-700/60 dark:ring-red-500/60'
    case 8200: // Sorcery
      return 'ring-violet-700/60 dark:ring-violet-500/60'
    case 8300: // Inspiration
      return 'ring-cyan-700/60 dark:ring-cyan-500/60'
    case 8400: // Resolve
      return 'ring-emerald-700/60 dark:ring-emerald-500/60'
    default:
      return 'ring-gray-500/80'
  }
}

/** 描述行前的指示方块色：与符文环色同一套主题色映射 */
const getPerkStyleIndicatorColor = (styleId: number) => {
  switch (styleId) {
    case 8000: // Precision
      return 'bg-amber-700/80 dark:bg-amber-500/80'
    case 8100: // Domination
      return 'bg-red-700/80 dark:bg-red-500/80'
    case 8200: // Sorcery
      return 'bg-violet-700/80 dark:bg-violet-500/80'
    case 8300: // Inspiration
      return 'bg-cyan-700/80 dark:bg-cyan-500/80'
    case 8400: // Resolve
      return 'bg-emerald-700/80 dark:bg-emerald-500/80'
    default:
      return 'bg-gray-500/80'
  }
}

/** 选手排序：CHERRY 按子队名次，普通对局按队伍标识（蓝队靠左） */
const sortedParticipants = computed(() => {
  if (basicInfo.value.isCherrySubteam) {
    return participants.value.toSorted((a, b) => {
      return a.subteamPlacement - b.subteamPlacement
    })
  }

  return participants.value.toSorted((a, b) => {
    return a.teamIdentifier.localeCompare(b.teamIdentifier)
  })
})
</script>

<style scoped>
/* 导航器滚动条：浅色模式黑半透明细滚动条 */
.match-card-participant-navigator-list {
  scrollbar-color: rgba(0, 0, 0, 0.24) transparent;
  scrollbar-width: thin;
}

.match-card-participant-navigator-list::-webkit-scrollbar {
  width: 4px;
}

.match-card-participant-navigator-list::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background-color: rgba(0, 0, 0, 0.24);
}

.match-card-participant-navigator-list::-webkit-scrollbar-track {
  background-color: transparent;
}

/* 暗色模式：滚动条换白半透明 */
:global([data-theme='dark'] .match-card-participant-navigator-list) {
  scrollbar-color: rgba(255, 255, 255, 0.24) transparent;
}

:global([data-theme='dark'] .match-card-participant-navigator-list::-webkit-scrollbar-thumb) {
  background-color: rgba(255, 255, 255, 0.24);
}
</style>
