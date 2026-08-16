<script setup lang="ts">
/**
 * 战绩列表项（任务 14 改为原版折叠卡）：
 * - 折叠态：渲染 MatchCardOverview（轻量摘要经 summaryToDetail 归一为 MatchDetail 形状，
 *   由本组件 provideMatchCard 提供 context，toParticipants/toMatchCardTeams 零改动消费）；
 *   点击整卡 emit toggle(gameId)，由父组件懒加载详情
 * - 展开态：详情（+时间线）就绪后渲染 MatchCard 展开态（isExpanded=true），
 *   卡片内箭头收起经 v-model 双向同步回父组件（expandedGameId 置空）
 */
import MatchCard from '@/components/match-card/MatchCard.vue'
import MatchCardOverview from '@/components/match-card/MatchCardOverview.vue'
import { provideMatchCard } from '@/components/match-card/context'
import { computed } from 'vue'

import { summaryToDetail } from './adapter'
import type { GameListItem } from './types'

const props = defineProps<{
  /** 列表项：轻量摘要 + 父组件注入的懒加载详情 */
  game: GameListItem
  /** 是否展开详情 */
  expanded: boolean
  /** 详情是否正在懒加载（首次展开时由父组件发起请求） */
  detailLoading?: boolean
}>()

// 点击卡片切换展开状态（gameId 由父组件维护 expandedGameId 与详情缓存）
const emit = defineEmits<{ toggle: [gameId: number] }>()

/** 折叠态 context 数据：轻量摘要 → MatchDetail 形状（participants 已归一 statsJson） */
const lightDetail = computed(() => summaryToDetail(props.game.summary))

/**
 * 折叠态展示数据源：详情已加载（展开过）时优先用真实详情，未加载回退轻量摘要。
 * 原因：列表摘要与详情是两个接口，参与者顺序/字段口径存在差异，
 * 若折叠卡恒用摘要，展开→收起后会出现玩家顺序与统计错位；统一数据源后两态渲染完全一致。
 */
const overviewDetail = computed(() => props.game.detail ?? lightDetail.value)

// 折叠态卡片上下文：isExpanded 恒 false（详情面板仅展开态渲染），puuid 高亮 self 行
provideMatchCard({
  summary: overviewDetail,
  puuid: computed(() => props.game.summary.selfPuuid),
  isExpanded: false
})

/**
 * 展开态 model：与父组件 expandedGameId 双向同步
 * 用户在展开卡片内点箭头收起时，MatchCard 内部置 isExpanded=false 并经 v-model 回调本 setter，
 * 转发 toggle 让父组件收起整行（详情已缓存，再次展开无需重新请求）
 */
const expandedModel = computed({
  get: () => props.expanded,
  set: (value: boolean) => {
    if (!value) {
      emit('toggle', props.game.summary.gameId)
    }
  }
})
</script>

<template>
  <article class="game-card">
    <!-- 折叠态：原版折叠卡（点击整卡展开；箭头点击冒泡至整卡，不重复触发） -->
    <div v-if="!expanded" class="collapsed" @click="emit('toggle', game.summary.gameId)">
      <MatchCardOverview />
    </div>

    <!-- 展开态：详情（+时间线）加载完成 → 原版 MatchCard 展开态（卡片内箭头收起联动父组件） -->
    <MatchCard
      v-else-if="game.detail"
      :summary="game.detail"
      :details="game.details"
      :puuid="game.summary.selfPuuid"
      v-model:is-expanded="expandedModel"
      :loading-details="detailLoading"
    />

    <!-- 展开态加载中：详情就绪前不渲染详情面板，展示占位 -->
    <p v-else class="detail-placeholder">
      {{ detailLoading ? '详情加载中...' : '暂无详情数据' }}
    </p>
  </article>
</template>

<style lang="scss" scoped>
/* 列表项容器：折叠/展开态共用纵向间距（game-list 已有 gap，此处仅占位） */
.game-card {
  min-width: 0;
}

/* 折叠态：整卡可点击，hover 提亮背景（折叠卡本体自带圆角/边框） */
.collapsed {
  cursor: pointer;
  border-radius: var(--radius);
  transition: background-color 0.15s;

  &:hover {
    background: var(--surface);
  }
}

/* 展开态加载中占位：高度与折叠卡（h-29 = 116px）一致，避免首次展开时
   116px → 60px 占位 → 详情就绪后 734px 的两次高度突变造成卡片跳动 */
.detail-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 116px;
  font-size: 13px;
  color: var(--text-muted);
  border-radius: var(--radius);
  background: var(--surface);
}
</style>
