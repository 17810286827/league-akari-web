<template>
  <!-- 构建 Tab（任务 15 全量移植原版 MatchCardBuildsTab）：
       每人一块（技能加点序列 + 购买序列），右上角选手导航器 -->
  <div class="relative">
    <NScrollbar ref="scrollbarRef" x-scrollable class="max-h-142">
      <div ref="contentRef">
        <!-- Players -->
        <div
          v-for="p of sortedParticipants"
          :key="p.puuid"
          :data-builds-participant-id="p.participantId"
          class="rounded-lg bg-black/3 p-3 pr-12 not-last:mb-2 dark:bg-white/3"
        >
          <!-- Player Header -->
          <div class="mb-1 flex items-center gap-2 select-none">
            <ChampionIcon
              :champion-id="p.championId"
              class="size-7! shrink-0 border-2 border-solid"
              :style="{
                borderColor: getTeamColor(p.teamIdentifier)
              }"
              round
            />
            <div class="min-w-0 truncate text-sm font-medium text-black dark:text-white">
              {{ participantName(p) }}
            </div>
            <div v-if="p.position && p.position.toLowerCase() !== 'invalid'" :class="tagTheme">
              {{ position(p.position) }}
            </div>

            <!-- anvil -->
            <div
              v-if="collected.anvils[p.participantId] && collected.anvils[p.participantId] > 0"
              class="rounded bg-black/20 px-1 py-0.5 text-xs text-black/80 dark:bg-white/10 dark:text-white"
            >
              {{ t('matchCard.buildsTab.anvils', { count: collected.anvils[p.participantId] }) }}
            </div>
          </div>

          <!-- divider -->
          <div class="my-3 h-px bg-black/10 dark:bg-white/10"></div>

          <!-- Skills Section -->
          <div class="mb-3">
            <div class="mb-1.5 text-xs text-black/80 dark:text-white/50">
              {{ t('matchCard.buildsTab.skillBuild') }}
            </div>
            <div class="flex flex-wrap items-center gap-1">
              <div
                v-for="(sk, idx) of collected.skillLevelUpEvents[p.participantId]"
                :key="idx"
                class="relative"
              >
                <div
                  v-if="sk.levelUpType === 'EVOLVE'"
                  class="relative flex size-6 cursor-default items-center justify-center rounded-full border border-solid border-rose-500 bg-rose-500/60 text-xs font-bold dark:border-rose-400/60 dark:bg-rose-400/60"
                  :title="`${sk.displayLevel ? sk.displayLevel + ' - ' : ''}${SKILL_SLOT_TRANSLATIONS[sk.skillSlot as keyof typeof SKILL_SLOT_TRANSLATIONS]} (${t('matchCard.buildsTab.evolved')}) - ${formatMilliseconds(sk.timestamp)}`"
                >
                  {{
                    SKILL_SLOT_TRANSLATIONS[sk.skillSlot as keyof typeof SKILL_SLOT_TRANSLATIONS] ||
                    'U'
                  }}
                  <div
                    class="absolute -top-1 -right-1 flex size-3 items-center justify-center rounded-full border border-solid border-white bg-amber-400 text-black shadow-sm dark:border-neutral-900 dark:bg-amber-500"
                  >
                    <NIcon size="10"><ArrowUp /></NIcon>
                  </div>
                </div>
                <div
                  v-else
                  class="flex size-6 cursor-default items-center justify-center rounded text-xs font-bold"
                  :class="getClassBySkillSlot(sk.skillSlot)"
                  :title="`${sk.displayLevel} - ${SKILL_SLOT_TRANSLATIONS[sk.skillSlot as keyof typeof SKILL_SLOT_TRANSLATIONS]} - ${formatMilliseconds(sk.timestamp)}`"
                >
                  {{
                    SKILL_SLOT_TRANSLATIONS[sk.skillSlot as keyof typeof SKILL_SLOT_TRANSLATIONS] ||
                    'U'
                  }}
                </div>

                <div
                  v-if="sk.displayLevel"
                  class="absolute -right-1 -bottom-1 z-1 min-w-3 rounded bg-black/60 py-0.5 text-center text-[8px] leading-none text-white"
                >
                  {{ sk.displayLevel }}
                </div>
              </div>

              <!-- Empty state -->
              <div
                v-if="!collected.skillLevelUpEvents[p.participantId]?.length"
                class="py-1 text-xs text-black/30 italic dark:text-white/30"
              >
                {{ t('matchCard.buildsTab.noSkillUpgrades') }}
              </div>
            </div>
          </div>

          <!-- Items Section -->
          <div>
            <div class="mb-1.5 text-xs text-black/80 dark:text-white/50">
              {{ t('matchCard.buildsTab.itemPurchases') }}
            </div>
            <div class="flex flex-wrap items-start gap-1">
              <div
                v-for="(item, idx) of collected.itemPurchaseEvents[p.participantId]?.filter(
                  (x) => x.type === 'ITEM_PURCHASED' || x.type === 'LEAGUE_AKARI_ITEM_SPACER'
                )"
                :key="idx"
                class="flex flex-col items-center gap-0.5"
              >
                <template v-if="item.type === 'ITEM_PURCHASED'">
                  <!-- Item icon -->
                  <ItemDisplay :item-id="item.itemId" :size="28" />

                  <!-- Timestamp -->
                  <div class="text-[9px] whitespace-nowrap text-black/80 dark:text-white/50">
                    {{ formatMilliseconds(item.timestamp) }}
                  </div>
                </template>

                <div
                  v-else-if="item.type === 'LEAGUE_AKARI_ITEM_SPACER'"
                  class="flex size-8 w-7 items-center justify-center text-black/50 dark:text-white/30"
                >
                  →
                </div>
              </div>

              <!-- Empty state -->
              <div
                v-if="
                  !collected.itemPurchaseEvents[p.participantId]?.filter(
                    (x) => x.type === 'ITEM_PURCHASED'
                  ).length
                "
                class="py-1 text-xs text-black/30 italic dark:text-white/30"
              >
                {{ t('matchCard.buildsTab.noItemPurchases') }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </NScrollbar>

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
 * 构建 Tab（任务 15）：移植原版 MatchCardBuildsTab，数据经适配层 toMatchCardBuilds
 * 消费（技能加点序列 + 购买序列 + 锻炉计数），原版 collected 计算逻辑下沉到适配层
 */
import ChampionIcon from '@/components/widgets/ChampionIcon.vue'
import ItemDisplay from '@/components/widgets/ItemDisplay.vue'
import { t } from '@/utils/match-card-i18n'
import { useGameResourceProvider } from '@/utils/match-card-resource'
import { toMatchCardBuilds } from '@/views/match-detail/adapter/match-card-timeline'
import type { MatchCardBuildsResult } from '@/views/match-detail/adapter/types'
import { ChevronLeft20Regular, ChevronRight20Regular } from '@vicons/fluent'
import { ArrowUp } from '@vicons/ionicons5'
import { NButton, NIcon, NScrollbar, NTooltip } from 'naive-ui'
import { computed, ref } from 'vue'

import { useMatchCard } from '../context'
import { usePosition } from '../utils/text'
import { getClassBySkillSlot, getTeamColor, useWinResultTagClass } from '../utils/theme'
import { formatMilliseconds } from '../utils/time'

const { basicInfo, frames, participants, team, hidePrivacy } = useMatchCard()

// 游戏资源提供者（英雄名等静态资源查询）与导航器滚动定位引用
const resources = useGameResourceProvider()
// scrollbarRef：滚动容器；contentRef：内容区（目标选手块定位）；isNavigatorExpanded：导航器展开态
const scrollbarRef = ref<InstanceType<typeof NScrollbar> | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const isNavigatorExpanded = ref(false)

/** 技能键位映射（原版常量：槽位 1-4 → Q/W/E/R），未知槽位在模板中回退显示 'U' */
const SKILL_SLOT_TRANSLATIONS = {
  1: 'Q',
  2: 'W',
  3: 'E',
  4: 'R'
}

/**
 * 选手排序：CHERRY 竞技场按子队名次分组展示，普通对局按队伍标识排序
 * （蓝队 TEAM-100 靠左，与卡片头部队伍布局一致）
 */
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

/**
 * 加点/购买序列与锻炉计数：适配层组装（原版 collected 计算下沉，字段缺失事件已跳过），
 * 模板直接按参与者编号索引消费
 */
const collected = computed<MatchCardBuildsResult>(() => toMatchCardBuilds(frames.value))

// 位置文案与胜负标签主题（选手头部位置徽章用）
const position = usePosition()
const tagTheme = useWinResultTagClass(() => team.value?.winResult)

/** 选手类型别名：与 participants 的元素类型绑定，避免重复书写长类型 */
type Participant = (typeof participants.value)[number]

/**
 * 选手名：隐私模式下用英雄名代替（对齐原版 hidePrivacy 语义），
 * 否则显示「游戏名 #TAG」，无 tagLine 时仅显示游戏名
 */
const participantName = (participant: Participant) => {
  if (hidePrivacy.value) {
    return resources.champions.name(participant.championId)
  }

  return participant.tagLine
    ? `${participant.gameName} #${participant.tagLine}`
    : participant.gameName
}

/**
 * 导航器滚动定位：按 data-builds-participant-id 找到目标玩家块并平滑滚动。
 * offsetTop 相对内容区顶部，减 8px 留出呼吸边距；目标块未找到时静默返回
 */
const scrollToParticipant = (participantId: number) => {
  const target = contentRef.value?.querySelector<HTMLElement>(
    `[data-builds-participant-id="${participantId}"]`
  )

  if (!target) {
    return
  }

  scrollbarRef.value?.scrollTo({
    top: Math.max(target.offsetTop - 8, 0),
    behavior: 'smooth'
  })
}
</script>

<style scoped>
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

:global([data-theme='dark'] .match-card-participant-navigator-list) {
  scrollbar-color: rgba(255, 255, 255, 0.24) transparent;
}

:global([data-theme='dark'] .match-card-participant-navigator-list::-webkit-scrollbar-thumb) {
  background-color: rgba(255, 255, 255, 0.24);
}
</style>
