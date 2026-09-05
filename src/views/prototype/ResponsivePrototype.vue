<!--
  【原型】响应式设计评审页(/prototype/responsive,一次性原型)

  问题:375px 视口下折叠卡数据列截断/叠压(浏览器实测复现)。
  形态:按用户要求"按现在的真实画面绘制"——画布内渲染项目真实组件
  (TopNavBar + GameCardItem → MatchCardOverview/MatchCardDetails → TeamTable),
  仅数据为 mock(契约形状与后端 DTO 一比一,见 ./mock.ts)。
  尺寸:画布 375/768/1440 三档,?w= 可分享;卡片层容器查询按画布宽度真实生效
  (顶部导航为视口媒体查询,在画布中不随画布宽度切换,以真实浏览器窗口为准)。
  生命周期:仅 dev 构建注册路由(import.meta.env.DEV),方案定稿后本页整体移除。
-->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import TopNavBar from '@/views/game-stats/TopNavBar.vue'
import GameCardItem from '@/views/game-stats/GameCardItem.vue'
import type { GameListItem } from '@/views/game-stats/types'

import { MOCK_RANK_SECTIONS, MOCK_PLAYER, MOCK_SUMMARIES, getMockDetail } from './mock'

/** 设备尺寸预设:手机 / 平板 / 桌面(画布宽 × 高) */
const SIZES = [
  { w: 375, h: 812, label: '手机 375' },
  { w: 768, h: 1024, label: '平板 768' },
  { w: 1440, h: 900, label: '桌面 1440' }
]

const route = useRoute()
const router = useRouter()

/** 当前画布尺寸(来自 ?w=,默认 375;非法值回退 375) */
const canvasW = computed(() => {
  const w = Number(route.query.w ?? 375)
  return SIZES.some((s) => s.w === w) ? w : 375
})
const canvasH = computed(() => SIZES.find((s) => s.w === canvasW.value)?.h ?? 812)

/** 切换画布尺寸:?w= 写回(可分享、刷新稳定) */
function setSize(w: number): void {
  router.replace({ query: { ...route.query, w } })
}

/** 浮动条循环切换尺寸(箭头/键盘调用) */
function cycle(step: number): void {
  const index = SIZES.findIndex((s) => s.w === canvasW.value)
  const next = (index + step + SIZES.length) % SIZES.length
  setSize(SIZES[next].w)
}

/**
 * 列表项数据:契约形状 GameListItem,详情全部预构造(原型无后端,点击即展开),
 * AI 分析状态置 null(分析按钮走"无状态"分支,不影响布局评审)
 */
const gameItems: GameListItem[] = MOCK_SUMMARIES.map((summary) => ({
  summary,
  detail: getMockDetail(summary.gameId) ?? null,
  details: null,
  analysisState: null
}))

/** 当前展开的对局 ID:与生产语义一致,同一时刻至多展开一局 */
const expandedGameId = ref<number | null>(null)

/** 点击卡片切换展开(详情已预构造,直接切换,无懒加载) */
function toggleGame(gameId: number): void {
  expandedGameId.value = expandedGameId.value === gameId ? null : gameId
}

/** 画布缩放:视口放不下时等比缩小(1440 桌面画布在窄视口可整体预览) */
const scale = ref(1)

function updateScale(): void {
  // 预留 32px 页边距;外层容器高度同步收缩,避免缩放后底部留白
  scale.value = Math.min(1, (window.innerWidth - 32) / canvasW.value)
}

watch(canvasW, updateScale)

onMounted(() => {
  updateScale()
  window.addEventListener('resize', updateScale)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateScale)
  window.removeEventListener('keydown', onKeydown)
})

/** 键盘 ←/→ 循环切换尺寸(输入框聚焦时跳过,避免干扰输入) */
function onKeydown(e: KeyboardEvent): void {
  const target = e.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    return
  }
  if (e.key === 'ArrowLeft') cycle(-1)
  if (e.key === 'ArrowRight') cycle(1)
}
</script>

<template>
  <div class="min-h-screen bg-[#060906] text-[#ecfdf5]">
    <!-- 顶部工具条:页面说明 + 尺寸切换 -->
    <div class="border-b border-[#243127] bg-[#0b0f0c] px-4 py-3">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2">
        <span class="shrink-0 rounded-sm bg-[#243127] px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-[#c8aa6e]">原型</span>
        <p class="min-w-0 flex-1 truncate text-sm">
          <b>真实画面 · 各尺寸预览</b>
          <!-- 窄视口隐藏长说明,避免工具条逐字换行 -->
          <span class="ml-2 hidden text-xs text-[#9ca3af] md:inline">项目真实组件渲染(mock 数据);卡片断点按画布宽度生效,顶部导航按浏览器窗口宽度生效</span>
        </p>
        <div class="flex shrink-0 gap-1">
          <button
            v-for="size in SIZES"
            :key="size.w"
            class="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
            :class="canvasW === size.w ? 'border-[#4ade80] bg-[#18201a] text-[#86efac]' : 'border-[#243127] bg-[#111611] text-[#9ca3af]'"
            @click="setSize(size.w)"
          >
            {{ size.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- 画布区:固定设备宽度 + @container,内部为真实组件树 -->
    <div class="flex justify-center overflow-hidden px-4 py-6">
      <div :style="{ height: canvasH * scale + 'px' }">
        <div
          class="@container overflow-y-auto rounded-2xl shadow-[0_0_60px_rgba(74,222,128,0.08)] ring-2 ring-[#243127]"
          :style="{
            width: canvasW + 'px',
            height: canvasH + 'px',
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            background: 'radial-gradient(1200px 500px at 50% -10%, rgba(74, 222, 128, 0.14), transparent 65%), #0b0f0c'
          }"
        >
          <!-- 顶部导航:真实组件(段位板块/玩家信息/刷新) -->
          <TopNavBar :sections="MOCK_RANK_SECTIONS" :player="MOCK_PLAYER" @refresh="() => {}" />

          <!-- 战绩列表:真实 GameCardItem(折叠卡 MatchCardOverview / 展开态 MatchCard 均为生产组件) -->
          <main class="flex flex-col gap-3.5 p-3">
            <GameCardItem
              v-for="game in gameItems"
              :key="game.summary.gameId"
              :game="game"
              :expanded="expandedGameId === game.summary.gameId"
              :reasoning-collapsed="true"
              @toggle="toggleGame"
            />
          </main>
        </div>
      </div>
    </div>

    <!-- 浮动切换条:高对比胶囊,循环切换画布尺寸(与被评审页面明确区分) -->
    <div class="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#33503c] bg-[#0b0f0c]/95 py-2 pl-2 pr-4 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur">
      <button
        class="flex size-8 items-center justify-center rounded-full bg-[#18201a] text-lg text-[#86efac] transition-colors hover:bg-[#1f2a22]"
        aria-label="上一个尺寸"
        @click="cycle(-1)"
      >‹</button>
      <button
        class="flex size-8 items-center justify-center rounded-full bg-[#18201a] text-lg text-[#86efac] transition-colors hover:bg-[#1f2a22]"
        aria-label="下一个尺寸"
        @click="cycle(1)"
      >›</button>
      <span class="text-sm font-bold">{{ canvasW }}px</span>
      <span class="hidden text-xs text-[#9ca3af]/60 sm:inline">(← / → 切换)</span>
    </div>
  </div>
</template>
