<script setup lang="ts">
/**
 * 对局历史行：胜负背景（蓝/红）+ 模式/时长 + 英雄/技能 + KDA + 战绩 + 出装 6 格 + 队友/对手展开列表
 */
import { computed, ref } from 'vue'

import { championIconUrl, CHAMPION_NAMES, itemIconUrl } from './mockData'
import type { MatchHistoryItem, MatchParticipant } from './types'

const props = defineProps<{ match: MatchHistoryItem }>()

/** 是否展开队友/对手列表 */
const expanded = ref(false)

/** 胜负文案（战绩标记） */
const resultText = computed(() => (props.match.win ? 'WIN' : 'LOSS'))

/** 对局时长格式化：mm:ss */
const durationText = computed(() => {
  const minutes = Math.floor(props.match.gameDuration / 60)
  const seconds = props.match.gameDuration % 60
  return `${minutes}分 ${String(seconds).padStart(2, '0')}秒`
})

/** 对局时间格式化：月/日 时:分 */
const timeText = computed(() => {
  const date = new Date(props.match.gameCreation)
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
})

/** 按队伍分组（100 蓝方 / 200 红方），组内按 KDA 降序 */
const teams = computed(() => {
  const groups = new Map<number, MatchParticipant[]>()
  for (const participant of props.match.participants) {
    const list = groups.get(participant.teamId) ?? []
    list.push(participant)
    groups.set(participant.teamId, list)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([teamId, participants]) => ({
      teamId,
      win: participants[0]?.win ?? false,
      participants: [...participants].sort((a, b) => b.kills - a.kills)
    }))
})

/** 出装 6 格：不足 6 件用空槽补位 */
const itemSlots = computed(() => {
  const slots = [...props.match.items]
  while (slots.length < 6) {
    slots.push(0)
  }
  return slots
})

/** 英雄展示名（优先取类型表，未知用 ID） */
function championName(championId: number): string {
  return CHAMPION_NAMES[championId] ?? `英雄 ${championId}`
}
</script>

<template>
  <article
    class="overflow-hidden rounded-lg border border-hairline transition-colors"
    :class="match.win ? 'bg-win/10 hover:bg-win/15' : 'bg-loss/10 hover:bg-loss/15'"
  >
    <!-- 主行：点击切换展开详情 -->
    <button type="button" class="flex w-full items-center gap-4 px-4 py-3 text-left" @click="expanded = !expanded">
      <!-- 模式与时间 -->
      <div class="w-28 shrink-0">
        <p class="text-sm font-semibold text-ink">{{ match.queueName }}</p>
        <p class="text-xs text-ink-muted tabular-nums">{{ durationText }}</p>
        <p class="text-xs text-ink-muted tabular-nums">{{ timeText }}</p>
      </div>

      <!-- 英雄头像与召唤师技能 -->
      <div class="flex shrink-0 items-center gap-1.5">
        <img
          :src="championIconUrl(match.championId)"
          :alt="match.championName"
          class="size-11 rounded-full border border-hairline bg-surface"
        />
        <div class="flex flex-col gap-0.5">
          <img
            v-for="spellId in match.summonerSpells"
            :key="spellId"
            :src="itemIconUrl(spellId)"
            :alt="`技能 ${spellId}`"
            class="size-4 rounded-sm"
          />
        </div>
      </div>

      <!-- KDA 大数字 -->
      <div class="w-24 shrink-0 text-center">
        <p class="text-lg font-bold text-ink tabular-nums">
          {{ match.kills }} / <span class="text-loss">{{ match.deaths }}</span> / {{ match.assists }}
        </p>
        <p class="text-xs text-ink-muted tabular-nums">{{ match.kda }} KDA</p>
      </div>

      <!-- 战绩标记 -->
      <p
        class="w-14 shrink-0 text-center text-sm font-bold"
        :class="match.win ? 'text-win' : 'text-loss'"
      >
        {{ resultText }}
      </p>

      <!-- 出装 6 格 -->
      <div class="flex min-w-0 flex-1 items-center gap-1">
        <img
          v-for="(itemId, index) in itemSlots"
          :key="`${itemId}-${index}`"
          :src="itemId > 0 ? itemIconUrl(itemId) : undefined"
          :alt="itemId > 0 ? `装备 ${itemId}` : '空槽'"
          class="size-7 rounded-sm border border-hairline bg-surface"
          :class="{ 'opacity-30': itemId === 0 }"
        />
      </div>

      <!-- 金币与补刀 -->
      <div class="w-20 shrink-0 text-right">
        <p class="text-sm text-ink tabular-nums">{{ match.goldEarned.toLocaleString() }}G</p>
        <p class="text-xs text-ink-muted tabular-nums">{{ match.cs }} CS</p>
      </div>

      <!-- 展开指示 -->
      <span class="shrink-0 text-xs text-ink-muted transition-transform" :class="{ 'rotate-180': expanded }">
        ▼
      </span>
    </button>

    <!-- 展开区：两队 10 人列表 -->
    <div v-if="expanded" class="border-t border-hairline bg-base/40">
      <div class="grid grid-cols-2 gap-4 px-4 py-3">
        <div v-for="team in teams" :key="team.teamId">
          <!-- 队首：蓝/红标识与胜负 -->
          <p class="mb-1.5 text-xs font-semibold" :class="team.win ? 'text-win' : 'text-loss'">
            {{ team.teamId === 100 ? '蓝方' : '红方' }} {{ team.win ? 'WIN' : 'LOSS' }}
          </p>
          <ul class="space-y-1">
            <li
              v-for="participant in team.participants"
              :key="participant.puuid"
              class="flex items-center gap-2 text-xs"
            >
              <img
                :src="championIconUrl(participant.championId)"
                :alt="championName(participant.championId)"
                class="size-5 rounded-full bg-surface"
              />
              <span class="w-24 truncate text-ink-muted">{{ participant.summonerName }}</span>
              <span class="tabular-nums text-ink">
                {{ participant.kills }}/{{ participant.deaths }}/{{ participant.assists }}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </article>
</template>
