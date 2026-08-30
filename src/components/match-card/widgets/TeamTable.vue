<template>
  <div class="@container overflow-hidden rounded border border-solid" :class="tone.borderClass">
    <!-- header -->
    <div class="box-border flex h-8 items-center gap-4 p-2 text-xs" :class="tone.headerClass">
      <!-- team name -->
      <div class="flex items-center gap-1">
        <div
          class="text-xs font-bold"
          :class="{
            'text-blue-700 dark:text-blue-300': team.winResult === 'win',
            'text-red-700 dark:text-red-300': team.winResult === 'loss',
            'text-black/80 dark:text-white/80':
              team.winResult === 'remake' || team.winResult === 'abort'
          }"
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
        <div>{{ teamName(teamIdentifier) }}</div>
      </div>

      <!-- team kda -->
      <div class="text-xs text-black/80 dark:text-white/80">
        {{ team.totalKills }}/{{ team.totalDeaths }}/{{ team.totalAssists }}
      </div>

      <div class="text-xs text-black/80 dark:text-white/80">
        {{ (team.totalGoldEarned / 1000).toFixed(2) }}k
      </div>

      <!-- objective -->
      <div v-if="team.teamInfo" class="flex gap-2">
        <div
          class="flex items-center gap-1 text-black/60 dark:text-white/60"
          :title="t('matchCard.teamTable.objectives.tower')"
        >
          <Tower class="size-3.5" />
          <span>{{ team.teamInfo.objectives.tower.kills }}</span>
        </div>
        <div
          class="flex items-center gap-1 text-black/60 dark:text-white/60"
          :title="t('matchCard.teamTable.objectives.inhibitor')"
        >
          <Inhibitor class="size-3.5" />
          <span>{{ team.teamInfo.objectives.inhibitor.kills }}</span>
        </div>
        <div
          class="flex items-center gap-1 text-black/60 dark:text-white/60"
          :title="t('matchCard.teamTable.objectives.dragon')"
        >
          <Dragon class="size-3.5" />
          <span>{{ team.teamInfo.objectives.dragon.kills }}</span>
        </div>
        <div
          class="flex items-center gap-1 text-black/60 dark:text-white/60"
          :title="t('matchCard.teamTable.objectives.baron')"
        >
          <Baron class="size-3.5" />
          <span>{{ team.teamInfo.objectives.baron.kills }}</span>
        </div>
        <div
          class="flex items-center gap-1 text-black/60 dark:text-white/60"
          :title="t('matchCard.teamTable.objectives.voidGrub')"
        >
          <VoidGrub class="size-3.5" />
          <span>{{ team.teamInfo.objectives.horde.kills }}</span>
        </div>
        <div
          class="flex items-center gap-1 text-black/60 dark:text-white/60"
          :title="t('matchCard.teamTable.objectives.riftHerald')"
        >
          <RiftHerald class="size-3.5" />
          <span>{{ team.teamInfo.objectives.riftHerald.kills }}</span>
        </div>
        <div
          class="flex items-center gap-1 text-black/60 dark:text-white/60"
          :title="t('matchCard.teamTable.objectives.atakhan')"
          v-if="someTeamHasAtakhan && team.teamInfo.objectives.atakhan"
        >
          <Atakhan class="size-3.5" />
          <span>{{ team.teamInfo.objectives.atakhan.kills }}</span>
        </div>
      </div>

      <!-- bans -->
      <div class="ml-auto flex" v-if="team.teamInfo && team.teamInfo.bans.length > 0">
        <div class="mr-1 text-xs text-black/60 dark:text-white/60">
          {{ t('matchCard.teamTable.bans') }}
        </div>
        <div class="flex gap-0.5">
          <ChampionIcon
            v-for="ban in team.teamInfo.bans.slice(0, 5)"
            :key="ban.championId"
            :champion-id="ban.championId"
            class="size-4 rounded-xs"
          />
          <NPopover v-if="team.teamInfo.bans.length > 5">
            <template #trigger>
              <div class="text-xs text-black/60 dark:text-white/60">
                +{{ team.teamInfo.bans.length - 5 }}
              </div>
            </template>
            <div class="flex gap-0.5">
              <ChampionIcon
                v-for="ban in team.teamInfo.bans.slice(5)"
                :key="ban.championId"
                :champion-id="ban.championId"
                class="size-4 rounded-xs"
              />
            </div>
          </NPopover>
        </div>
      </div>
    </div>

    <!-- players -->
    <div
      v-for="participant in teamParticipants"
      :key="participant.puuid"
      :class="{
        // self 行：柔和绿高亮（淡绿终端，区别于胜负底色）
        'bg-green-500/10 bg-clip-padding dark:bg-green-500/10': participant.puuid === puuid
      }"
      class="box-border flex h-12 items-center border-t border-r-0 border-b-0 border-l-0 border-solid border-t-black/5 px-2 py-1 dark:border-t-white/5"
    >
      <!-- name line -->
      <div class="flex min-w-0 flex-1 items-center gap-1">
        <!-- left champion icon -->
        <NPopover placement="right" :content-style="{ maxWidth: '420px' }">
          <template #trigger>
            <div class="relative size-8 cursor-pointer">
              <ChampionIcon :champion-id="participant.championId" class="size-full!" round />

              <div
                class="absolute right-0 -bottom-1 rounded-full bg-black/70 p-0.5 text-[10px] leading-none text-white/80 dark:bg-black/50"
              >
                {{ participant.level }}
              </div>
            </div>
          </template>
          <RadarChart :puuid="participant.puuid" />
        </NPopover>

        <!-- spells -->
        <div v-if="participant.spells[0] || participant.spells[1]" class="flex flex-col gap-0.5">
          <SummonerSpellDisplay
            v-for="spell in participant.spells"
            :key="spell"
            :spell-id="spell"
            :size="16"
          />
        </div>

        <!-- runes (if exists, ml -0.5rem) -->
        <!-- 符文：web 适配层 perks 为 { perkIds, perkStyle, perkSubStyle } 形状（任务 5），
             对应原版 styles[0].selections[0].perk → perkIds[0]、styles[1].selections[0].perk → perkIds[4]、styles[1].style → perkSubStyle -->
        <div
          v-if="
            participant.perks.perkIds[0] ||
            participant.perks.perkIds[4]
          "
          class="-ml-0.5 flex flex-col gap-0.5"
        >
          <PerkDisplay :perk-id="participant.perks.perkIds[0] ?? undefined" :size="16" />
          <PerkstyleDisplay
            :perkstyle-id="participant.perks.perkSubStyle ?? undefined"
            :size="16"
          />
        </div>

        <!-- name & position -->
        <div class="flex min-w-0 flex-1 flex-col">
          <NTooltip>
            <template #trigger>
              <div
                class="flex cursor-pointer items-center gap-1 text-xs"
                @click="navigateToSummonerByPuuid(participant.puuid)"
                @mousedown="handleMouseDown"
                @mouseup="handleMouseUp($event, participant.puuid)"
                :class="{ 'font-bold text-black dark:text-white': participant.puuid === puuid }"
              >
                <NIcon
                  class="text-black/80 dark:text-white/80"
                  v-if="!participant.puuid || participant.puuid === EMPTY_PUUID"
                >
                  <Robot />
                </NIcon>

                <div class="truncate">
                  <template v-if="hidePrivacy">
                    {{ resources.champions.name(participant.championId) }}
                  </template>
                  <template v-else>
                    {{ participant.gameName }}
                    <template v-if="participant.tagLine">#{{ participant.tagLine }}</template>
                  </template>
                </div>

                <!-- MVP/ACE 称号徽章（海克斯菱徽）：按 puuid 匹配称号持有者，纯展示无交互；
                     六边形双线金/银边 + 周期扫光 + 入场弹出，未评选（null）不渲染 -->
                <span
                  v-if="mvpAward && participant.puuid === mvpAward.puuid"
                  class="award-hex award-hex--mvp mvp-badge shrink-0"
                >
                  <span class="award-hex-face">{{ t('matchCard.tags.mvp.label') }}<i class="award-hex-shine" /></span>
                </span>
                <span
                  v-else-if="aceAward && participant.puuid === aceAward.puuid"
                  class="award-hex award-hex--ace ace-badge shrink-0"
                >
                  <span class="award-hex-face">ACE<i class="award-hex-shine" /></span>
                </span>
              </div>
            </template>
            <div class="flex items-center gap-1 text-xs" v-if="!hidePrivacy">
              <span class="font-bold">{{ participant.gameName }}</span>
              <span v-if="participant.tagLine" class="text-white/80"
                >#{{ participant.tagLine }}</span
              >
            </div>
            <div class="flex items-center gap-1 text-xs" v-else>
              <span class="font-bold">{{ resources.champions.name(participant.championId) }}</span>
            </div>
          </NTooltip>
          <div
            v-if="participant.position && participant.position.toLowerCase() !== 'invalid'"
            class="flex items-center gap-1 text-[11px] text-black/60 dark:text-white/60"
          >
            <span>{{ position(participant.position) }}</span>
          </div>
        </div>
      </div>

      <template v-for="column in extraColumns" :key="column.name">
        <!-- score（全员实时评分：查询时计算，与 MVP/SVP 口径一致） -->
        <div v-if="column.name === 'score'" :class="column.class">
          <NPopover v-if="scoreOf(participant)" trigger="hover" placement="top">
            <template #trigger>
              <span
                class="score-cell cursor-default text-[13px] tabular-nums"
                :class="scoreClass(participant)"
              >
                {{ scoreOf(participant) }}
              </span>
            </template>
            <!-- 维度明细：该分怎么来的（各维度同队归一化分） -->
            <div class="min-w-28 text-xs">
              <div
                v-for="(ds, dim) in scoreDimensions(participant)"
                :key="dim"
                class="flex items-center justify-between gap-4"
              >
                <span>{{ dimensionLabel(dim as string) }}</span>
                <span class="tabular-nums">{{ Math.round(ds.score) }}</span>
              </div>
            </div>
          </NPopover>
          <!-- 无评分数据（异常兜底）：占位保持列结构稳定 -->
          <span v-else class="score-cell text-[13px] text-black/30 dark:text-white/30">-</span>
        </div>

        <!-- kda -->
        <div v-if="column.name === 'kda'" :class="column.class">
          <div class="text-[14px] tabular-nums">
            {{ participant.kills }}/{{ participant.deaths }}/{{ participant.assists }} ({{
              (participant.killParticipation * 100).toFixed(0)
            }}%)
          </div>
          <div class="text-[13px] text-black/60 dark:text-white/60 tabular-nums">
            {{ participant.kda.toFixed(2) }} KDA
          </div>
        </div>

        <!-- augments (5) -->
        <div v-else-if="column.name === 'augments' && participant.augments" :class="column.class">
          <AugmentDisplay
            v-for="(aug, index) in participant.augments.slice(0, someoneHas6Augments ? 6 : 5)"
            :key="index"
            :augment-id="aug ?? undefined"
            :size="20"
          />
        </div>

        <!-- dmg dealt / dmg taken -->
        <div v-else-if="column.name === 'damage'" :class="column.class">
          <DamageBarWithPopover
            :total-damage="participant.totalDamageDealtToChampions"
            :physical-damage="participant.physicalDamageDealtToChampions"
            :magic-damage="participant.magicDamageDealtToChampions"
            :true-damage="participant.trueDamageDealtToChampions"
            :baseline-damage="teams.allTeamStats.maxDamageDealtToChampions"
          />
          <DamageBarWithPopover
            :total-damage="participant.totalDamageTaken"
            :physical-damage="participant.physicalDamageTaken"
            :magic-damage="participant.magicDamageTaken"
            :true-damage="participant.trueDamageTaken"
            :baseline-damage="teams.allTeamStats.maxDamageTaken"
          />
        </div>

        <!-- cs -->
        <div v-else-if="column.name === 'cs'" :class="column.class">
          <div class="text-[14px] tabular-nums">{{ participant.cs }} {{ t('matchCard.teamTable.cs') }}</div>
          <div class="text-[13px] text-black/60 dark:text-white/60 tabular-nums">
            {{ (participant.cs / (basicInfo.gameDuration / 60)).toFixed(1) }}
            {{ t('matchCard.teamTable.perMinuteSuffix') }}
          </div>
        </div>

        <!-- gold -->
        <div v-else-if="column.name === 'gold'" :class="column.class">
          <div class="text-[14px] tabular-nums">{{ (participant.goldEarned / 1000).toFixed(2) }}k</div>
          <div class="text-[13px] text-black/60 dark:text-white/60 tabular-nums">
            {{ (participant.goldEarned / (basicInfo.gameDuration / 60)).toFixed(1) }}
            {{ t('matchCard.teamTable.perMinuteSuffix') }}
          </div>
        </div>

        <!-- items -->
        <div v-else-if="column.name === 'items'" :class="column.class">
          <ItemDisplay
            :item-id="item"
            :size="20"
            v-for="(item, index) in participant.items.slice(0, 7)"
            :is-trinket="index === participant.items.length - 1"
            :key="item"
          />

          <ItemDisplay
            v-if="hasRoleBoundItems"
            :item-id="participant.roleBoundItem"
            :size="20"
            :key="participant.roleBoundItem"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import AugmentDisplay from '@/components/widgets/AugmentDisplay.vue'
import ChampionIcon from '@/components/widgets/ChampionIcon.vue'
import ItemDisplay from '@/components/widgets/ItemDisplay.vue'
import PerkDisplay from '@/components/widgets/PerkDisplay.vue'
import PerkstyleDisplay from '@/components/widgets/PerkstyleDisplay.vue'
import SummonerSpellDisplay from '@/components/widgets/SummonerSpellDisplay.vue'
import { EMPTY_PUUID } from '@/utils/constants'
import { useGameResourceProvider } from '@/utils/match-card-resource'
import { t } from '@/utils/match-card-i18n'
import { Robot } from '@vicons/fa'
import { NIcon, NPopover, NTooltip } from 'naive-ui'
import { computed } from 'vue'

import { useMatchCard } from '../context'
import Atakhan from '../icons/Atakhan.vue'
import Baron from '../icons/Baron.vue'
import Dragon from '../icons/Dragon.vue'
import Inhibitor from '../icons/Inhibitor.vue'
import RiftHerald from '../icons/RiftHerald.vue'
import Tower from '../icons/Tower.vue'
import VoidGrub from '../icons/VoidGrub.vue'
import { useGameResultName, usePosition, useTeamName } from '../utils/text'
import DamageBarWithPopover from './DamageBarWithPopover.vue'
import RadarChart from './RadarChart.vue'

interface ColumnConfig {
  name: string
  class: string
}

const hasRoleBoundItems = computed(() => {
  return teamParticipants.value.some((p) => p.roleBoundItem)
})

const someoneHas6Augments = computed(() => {
  // 0 或 undefined 都算没有
  return teamParticipants.value.some((p) => p.augments[5])
})

const extraColumns = computed<ColumnConfig[]>(() => {
  // 数字列统一 min-w 与 text-center（等宽数字由元素级 tabular-nums 保证列对齐）
  // score 列置首：全员实时评分（MVP/SVP 行高亮），窄列纯数字
  const scoreColumn: ColumnConfig = { name: 'score', class: 'min-w-[3.5rem] text-center' }
  switch (basicInfo.value.gameMode) {
    case 'CHERRY':
      return [
        scoreColumn,
        { name: 'kda', class: 'min-w-[7rem] text-center' },
        { name: 'augments', class: 'min-w-[7.5rem] flex gap-0.5 justify-center' },
        { name: 'damage', class: 'min-w-[7.5rem] flex gap-2 justify-center' },
        { name: 'cs', class: 'hidden @[740px]:block min-w-[5rem] text-center' },
        { name: 'gold', class: 'hidden @[700px]:block min-w-[5rem] text-center' },
        { name: 'items', class: 'w-40 flex gap-0.5 justify-center' }
      ]
    case 'KIWI':
      return [
        scoreColumn,
        { name: 'kda', class: 'min-w-[7rem] text-center' },
        { name: 'augments', class: 'min-w-[7.25rem] flex gap-0.5 justify-center' },
        { name: 'damage', class: 'min-w-[7.5rem] flex gap-2 justify-center' },
        { name: 'cs', class: 'hidden @[740px]:block min-w-[5rem] text-center' },
        { name: 'gold', class: 'hidden @[700px]:block min-w-[5rem] text-center' },
        { name: 'items', class: 'min-w-40 flex gap-0.5 justify-center' }
      ]
    default:
      return [
        scoreColumn,
        { name: 'kda', class: 'min-w-[7rem] text-center' },
        { name: 'damage', class: 'min-w-[7.5rem] flex gap-2 justify-center' },
        { name: 'cs', class: 'hidden @[700px]:block min-w-[5rem] text-center' },
        { name: 'gold', class: 'min-w-[5rem] text-center' },
        {
          name: 'items',
          class: `${hasRoleBoundItems ? 'min-w-45' : 'min-w-40'} flex gap-0.5 justify-center`
        }
      ]
  }
})

const resources = useGameResourceProvider()

const tone = computed(() => {
  const k = team.value.winResult
  const borderClass = {
    win: 'dark:border-blue-200/10 border-blue-600/10',
    loss: 'dark:border-red-300/10 border-red-700/10',
    remake: 'dark:border-white/10 border-black/10',
    abort: 'dark:border-white/10 border-black/10'
  }[k]

  const headerClass = {
    win: 'dark:bg-blue-200/10 bg-blue-600/10',
    loss: 'dark:bg-red-300/10 bg-red-700/10',
    remake: 'dark:bg-white/10 bg-black/10',
    abort: 'dark:bg-white/10 bg-black/10'
  }[k]

  return { borderClass, headerClass }
})

const { teamIdentifier } = defineProps<{
  teamIdentifier: string
}>()

const { basicInfo, teams, participants, puuid, hidePrivacy, navigateToSummonerByPuuid, summary } =
  useMatchCard()

// MVP/ACE 称号持有者（详情接口评选结果；未评选/列表页伪造详情时为 null，不渲染徽章）
const mvpAward = computed(() => summary.value?.mvp ?? null)
const aceAward = computed(() => summary.value?.ace ?? null)

// 评分维度名 → 中文名（悬浮明细展示用；opScore 版本：support→healShield，新增 turret）
const DIMENSION_LABELS: Record<string, string> = {
  damage: '输出',
  kda: 'KDA',
  gold: '经济',
  tank: '承伤',
  vision: '视野',
  healShield: '治疗/护盾',
  cc: '控制',
  turret: '拆塔'
}

/** 玩家的评分视图（playerScores 按 puuid 索引；缺失时 null） */
function scoreEntry(p: { puuid: string }) {
  return summary.value?.playerScores?.[p.puuid] ?? null
}

/** 评分总分文本（保留 1 位小数；无数据返回 null 走占位） */
function scoreOf(p: { puuid: string }): string | null {
  const entry = scoreEntry(p)
  return entry ? Number(entry.opScore ?? 0).toFixed(1) : null
}

/** 评分单元格配色：MVP/ACE 持有者高亮（与徽章色彩呼应），其余常规 */
function scoreClass(p: { puuid: string }): string {
  if (mvpAward.value && p.puuid === mvpAward.value.puuid) {
    return 'score-highlight-mvp font-bold text-amber-600 dark:text-amber-400'
  }
  if (aceAward.value && p.puuid === aceAward.value.puuid) {
    return 'score-highlight-ace font-bold text-slate-500 dark:text-slate-300'
  }
  return 'text-black/80 dark:text-white/80'
}

/** 维度明细（悬浮展示；无数据返回空对象不渲染条目） */
function scoreDimensions(p: { puuid: string }) {
  return scoreEntry(p)?.dimensions ?? {}
}

/** 维度中文名（未知维度回退英文 key） */
function dimensionLabel(dim: string): string {
  return DIMENSION_LABELS[dim] ?? dim
}

const team = computed(() => {
  return teams.value.teamStatMap[teamIdentifier]
})

// 版本更新后，这个野怪被移除了
const someTeamHasAtakhan = computed(() => {
  return teams.value.teamStatsArr.some(
    (t) => t.teamInfo?.objectives.atakhan && (t.teamInfo.objectives.atakhan.kills || 0) > 0
  )
})

const teamParticipants = computed(() => {
  return participants.value.filter((p) => p.teamIdentifier === teamIdentifier)
})

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

const teamName = useTeamName()
const gameResultName = useGameResultName()
const position = usePosition()
</script>

<style scoped>
/* MVP/ACE 六角徽章（海克斯菱徽）：双线六边形金/银边 + 周期扫光 + 入场弹出 */
.award-hex {
  width: 30px;
  height: 34px;
  padding: 2px;
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
  background: linear-gradient(160deg, #fde68a, #92400e);
  display: inline-flex;
  animation: award-hex-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

/* ACE 银徽：银白渐变边 */
.award-hex--ace {
  background: linear-gradient(160deg, #e2e8f0, #475569);
}

/* 内层同形六边：深底承载文字；overflow hidden 配合扫光裁剪 */
.award-hex-face {
  position: relative;
  width: 100%;
  height: 100%;
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
  background: #101613;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-size: 9px;
  font-weight: 900;
  font-style: normal;
  letter-spacing: 0.05em;
}

.award-hex--mvp .award-hex-face {
  color: #fbbf24;
}

.award-hex--ace .award-hex-face {
  color: #e2e8f0;
}

/* 扫光：高光斜带周期掠过（clip-path 已裁出六边形状） */
.award-hex-shine {
  position: absolute;
  top: -20%;
  left: -70%;
  width: 45%;
  height: 140%;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, 0.55), transparent);
  transform: skewX(-18deg);
  animation: award-hex-shine 2.8s ease-in-out infinite;
  pointer-events: none;
}

@keyframes award-hex-shine {
  0%,
  55% {
    left: -70%;
  }
  85%,
  100% {
    left: 130%;
  }
}

@keyframes award-hex-pop {
  0% {
    transform: scale(0.4);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>

