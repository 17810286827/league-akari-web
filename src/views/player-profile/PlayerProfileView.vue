<script setup lang="ts">
/**
 * 玩家数据详情页（OP.GG 风格）：
 * Header 玩家信息 → 导航 Tabs + 队列 Pill 筛选 → 双栏内容（左 30% 段位/历史/英雄胜率，右 70% 统计卡/对局列表）
 * 数据暂用 mockData，后续可替换为后端玩家聚合接口
 */
import { computed, ref } from 'vue'

import ChampionStatsCard from './ChampionStatsCard.vue'
import MatchListItem from './MatchListItem.vue'
import { mockPlayerProfile } from './mockData'
import PlayerProfileHeader from './PlayerProfileHeader.vue'
import ProfileNavBar, { type ProfileTab, type QueueFilter } from './ProfileNavBar.vue'
import RankCard from './RankCard.vue'
import SeasonHistoryTable from './SeasonHistoryTable.vue'
import SummaryStatCards from './SummaryStatCards.vue'
import type { MatchHistoryItem } from './types'

// 页面数据（mock；后续接入接口后改为异步加载）
const profile = mockPlayerProfile

// 一级 Tab 与队列筛选状态（与导航栏 v-model 同步）
const activeTab = ref<ProfileTab>('overview')
const activeQueue = ref<QueueFilter>('all')

/** 按队列筛选后的对局列表（'all' 不过滤） */
const filteredMatches = computed<MatchHistoryItem[]>(() => {
  if (activeQueue.value === 'all') {
    return profile.matches
  }
  return profile.matches.filter((match) => match.queueType === activeQueue.value)
})
</script>

<template>
  <div class="min-h-screen bg-base text-ink">
    <!-- 顶部：Banner + 玩家信息 -->
    <PlayerProfileHeader :profile="profile" />

    <!-- 导航：Tabs + 队列 Pill -->
    <ProfileNavBar v-model:tab="activeTab" v-model:queue="activeQueue" />

    <!-- 主内容区 -->
    <main class="mx-auto max-w-7xl px-10 py-6">
      <!-- 概要页：双栏布局 -->
      <div v-if="activeTab === 'overview'" class="grid grid-cols-1 gap-5 lg:grid-cols-[30%_70%]">
        <!-- 左栏：段位卡 + 赛季历史 + 英雄胜率 -->
        <aside class="space-y-5">
          <RankCard :rank="profile.ranked" />
          <SeasonHistoryTable :records="profile.seasonHistory" />
          <ChampionStatsCard :champions="profile.championStats" />
        </aside>

        <!-- 右栏：综合统计 + 对局列表 -->
        <div class="space-y-5">
          <SummaryStatCards :summary="profile.summary" />
          <!-- 对局列表：队列筛选结果 -->
          <div class="space-y-2.5">
            <MatchListItem v-for="match in filteredMatches" :key="match.gameId" :match="match" />
            <!-- 筛选后无对局时的空态 -->
            <p v-if="filteredMatches.length === 0" class="py-10 text-center text-sm text-ink-muted">
              该队列暂无对局记录
            </p>
          </div>
        </div>
      </div>

      <!-- 英雄页：全宽英雄胜率列表 -->
      <div v-else-if="activeTab === 'champions'" class="mx-auto max-w-3xl">
        <ChampionStatsCard :champions="profile.championStats" />
      </div>

      <!-- 风格/熟练度页：占位空态 -->
      <div v-else class="py-20 text-center text-sm text-ink-muted">该模块开发中，敬请期待</div>
    </main>
  </div>
</template>
