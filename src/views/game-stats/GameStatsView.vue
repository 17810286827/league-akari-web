<script setup lang="ts">
/**
 * 玩家战绩页（/players/:puuid）：
 * 顶部导航（段位板块+刷新）→ 左侧边栏（召唤师查询/队列筛选/总览/最近队友对手）+ 右侧战绩列表
 * 数据流：路由参数 puuid（+query name/tag）初始化查询玩家 → listMatches({ puuid }) 加载该玩家对局；
 *         侧栏查询框可切换玩家（搜索成功后跳转到新玩家的战绩页）；
 *         点击卡片 → getMatchDetail 懒加载 → 注入展开态（组件内缓存已加载详情）
 */
import { computed, onMounted, ref, watch } from 'vue'
import { NSpin, useMessage } from 'naive-ui'
import { useRoute, useRouter } from 'vue-router'

import { getMatchDetail, listMatches, searchRiotAccount } from '@/api/matches'
import type { MatchDetail, MatchSummary, RecentOpponent, RiotAccount } from '@/api/types'
import { createLogger } from '@/utils/logger'
import { useMatchAnalysis } from '@/composables/useMatchAnalysis'
import type { MatchAnalysisState } from '@/composables/useMatchAnalysis'

import { computeOverview, computeRecentTeammates, mapRecentOpponents } from './adapter'
import GameCardItem from './GameCardItem.vue'
import SidebarPanel from './SidebarPanel.vue'
import TopNavBar from './TopNavBar.vue'
import type { GameListItem, GameStatsData, RankSection } from './types'

const logger = createLogger('GameStats')
// 全局消息提示（App.vue 已注册 NMessageProvider）
const message = useMessage()
const route = useRoute()
const router = useRouter()

/** 每页条数（分页控件可选 5/10/20，默认 20） */
const pageSize = ref(20)

/** 可选的每页条数（契约支持 5/10/20） */
const PAGE_SIZE_OPTIONS = [5, 10, 20]

/** 是否还能翻下一页：当前页已满且未到总条数（分页栏箭头禁用判定） */
const hasNextPage = computed(() => page.value * pageSize.value < total.value)

/** 总页数（至少 1 页，页码按钮渲染用） */
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

/**
 * 页码列表：首尾页 + 当前页前后各 1 页，中间用省略号（'ellipsis'）占位。
 * 如 20 页当前第 8 页 → [1, …, 7, 8, 9, …, 20]
 */
const pageItems = computed<(number | 'ellipsis')[]>(() => {
  const pages: (number | 'ellipsis')[] = []
  const last = totalPages.value
  const current = page.value
  for (let i = 1; i <= last; i++) {
    if (i === 1 || i === last || Math.abs(i - current) <= 1) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== 'ellipsis') {
      pages.push('ellipsis')
    }
  }
  return pages
})

/**
 * 每页条数切换：回到第一页并立即重新查询
 * （不能只靠 watch(page)——若当前已在第 1 页，page 赋值前后不变不触发 watcher）
 */
function handlePageSizeChange(): void {
  page.value = 1
  loadMatches()
}

/** 顶部段位板块：无数据源，保持"未定级"展示（契约第 5 节） */
const rankSections: RankSection[] = [
  { queue: '单双排位', tier: '未定级', highestTier: '最高 未定级' },
  { queue: '灵活排位', tier: '未定级', highestTier: '最高 未定级' }
]

// 列表状态：本页原始摘要、总条数、加载中、错误提示
const matches = ref<MatchSummary[]>([])
const total = ref(0)
const loading = ref(false)
const errorMsg = ref('')

// 交互状态：当前查询玩家、当前队列（null 为所有模式）、当前页、展开的对局、侧栏折叠
// 查询玩家：由路由参数初始化（/players/:puuid?name=&tag=）
const queryPlayer = ref<RiotAccount | null>(null)
/** 顶部搜索框输入内容（"昵称#tag"） */
const summonerInput = ref('')
const activeQueueId = ref<number | null>(null)
const page = ref(1)
// 展开对局 ID：同一时刻至多展开一局（与详情页单局语义一致）
const expandedGameId = ref<number | null>(null)
// 侧栏折叠态：小屏默认收起，由折叠按钮切换
const sidebarCollapsed = ref(false)
// 最近对手：后端列表接口聚合结果（列表查询时即返回，不依赖展开详情）
const recentOpponents = ref<RecentOpponent[]>([])

/** 详情懒加载缓存项：真实详情（时间线 Tab 已移除，不再加载 /timeline） */
interface DetailCacheEntry {
  detail: MatchDetail
}

// 详情懒加载：转换结果缓存（避免重复请求）
// 缓存以 gameId 为键：展开过的对局再次展开直接命中，不再请求后端
const detailCache = ref(new Map<number, DetailCacheEntry>())
// 展开态加载中标记：首次展开时置 true，详情面板就绪前保留折叠卡
const detailLoading = ref(false)

/**
 * AI 分析状态缓存：以 gameId + selfPuuid 为键保存所有对局的分析 composable 实例。
 * 实例存活于列表页，与 MatchCardDetails 的生命周期解耦：
 * 折叠销毁展示组件后请求仍在后台，重新展开时直接从同一实例恢复展示。
 * localStorage 中的成功快照不随玩家路由切换清理，跨刷新仍然可恢复。
 */
const analysisByKey = new Map<string, MatchAnalysisState>()

/** 获取/创建对局分析状态：同一对局同一玩家共享同一实例，保证折叠/展开不丢状态 */
function getAnalysisState(gameId: number, puuid: string): MatchAnalysisState | null {
  const key = `${gameId}:${puuid}`
  if (!Number.isInteger(gameId) || gameId <= 0 || !puuid) {
    return null
  }
  let state = analysisByKey.get(key)
  if (!state) {
    state = useMatchAnalysis({ gameId, puuid })
    analysisByKey.set(key, state)
    logger.info('Match analysis state created', { gameId })
  }
  return state
}

/**
 * 卡片列表：摘要直传折叠卡（不重复适配，MatchCardOverview 内部消费轻量 participants）；
 * 后端未升级（participants 缺失）的对局被过滤，避免渲染空卡；
 * 已加载的详情按 gameId 注入列表项，展开态直接展示；
 * 同时注入 AI 分析状态，保证折叠/展开后分析结果不丢失。
 */
const games = computed<GameListItem[]>(() =>
  matches.value
    .filter((summary) => (summary.participants ?? []).length > 0)
    .map((summary) => ({
      summary,
      detail: detailCache.value.get(summary.gameId)?.detail ?? null,
      details: null,
      analysisState: getAnalysisState(summary.gameId, summary.selfPuuid)
    }))
)

/**
 * 查询玩家展示信息（顶部导航左侧）：从最近一局对局数据提取
 * 召唤师头像（profileIcon）与召唤师等级（summonerLevel，后端列表接口提供）；
 * 无对局数据时头像/等级缺失（前端占位）
 */
const playerProfile = computed(() => {
  const qp = queryPlayer.value
  if (!qp) return null
  const target = `${qp.gameName}#${qp.tagLine}`
  const me = games.value
    .map((g) => g.summary.participants?.find((p) => p.summonerName === target))
    .find(Boolean)
  return {
    name: target,
    profileIconId: me?.profileIcon,
    summonerLevel: me?.summonerLevel
  }
})

/**
 * 侧栏数据：总览/最近队友/最近对手均从当前页数据实时聚合；
 * 英雄点数无数据源为空列表；渲染由 SidebarPanel 独立完成，与列表改造解耦
 */
const sidebarData = computed<GameStatsData>(() => ({
  rankSections,
  overview: computeOverview(matches.value),
  recentTeammates: computeRecentTeammates(matches.value),
  recentOpponents: mapRecentOpponents(recentOpponents.value)
}))

/**
 * 加载当前页对局列表（分页 + 队列过滤均在后端完成）
 * 失败时清空列表并给出错误提示，页面展示空态（不降级到 mock 数据）
 * @returns Promise<void>：加载完成后由 loading 状态驱动 UI 切换
 */
async function loadMatches(): Promise<void> {
  // 每次加载前重置加载态与错误信息，避免上一次的失败提示残留
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await listMatches({
      page: page.value,
      pageSize: pageSize.value,
      queueId: activeQueueId.value ?? undefined,
      // 只查询当前玩家的对局：按召唤师名（含 #tag）匹配本地对局数据
      // （Riot puuid 与本地 SGP 对局的 ID 体系不一致，按名称匹配才能命中）
      summonerName: queryPlayer.value
        ? `${queryPlayer.value.gameName}#${queryPlayer.value.tagLine}`
        : undefined
    })
    matches.value = res.data
    total.value = res.total
    // 最近对手：后端列表接口聚合结果（列表查询时即返回）
    recentOpponents.value = res.recentOpponents ?? []
    logger.info('Loaded match list', { page: page.value, total: res.total, count: res.data.length })
  } catch (error) {
    // 列表加载失败：记录日志并提示用户，列表置空展示空态
    logger.error('Failed to load match list', error)
    matches.value = []
    total.value = 0
    errorMsg.value = '对局列表加载失败，请确认后端服务已启动'
    message.error(errorMsg.value)
  } finally {
    loading.value = false
  }
}

/**
 * 顶部搜索框提交：输入"昵称#tag" → Riot Account 搜索（后端 JVM 缓存）→
 * 成功后 router 跳转新玩家战绩页（携带昵称/尾号 query）；失败提示后端返回的明确原因
 */
async function handleSearchSummoner(): Promise<void> {
  const riotName = summonerInput.value.trim()
  if (!riotName) {
    return
  }
  try {
    const account = await searchRiotAccount(riotName)
    logger.info('Summoner searched, navigate to matches', { riotName, puuid: account.puuid })
    await router.push({
      path: `/players/${account.puuid}`,
      query: { name: account.gameName, tag: account.tagLine }
    })
  } catch (error) {
    // 搜索失败：优先取后端返回的 message（如"Riot API Key 未配置"/"召唤师不存在"）
    const detail = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
    const reason = detail ?? (error instanceof Error ? error.message : '未知错误')
    logger.error('Failed to search summoner', { riotName, error })
    message.error(`召唤师查询失败：${reason}`)
  }
}

/**
 * 点击卡片：展开/收起该局详情
 * 首次展开时懒加载 getMatchDetail（展开详情已精简为"总览"，时间线 Tab 移除，
 * 不再请求 /timeline 接口），转换结果缓存复用；详情失败则收起并提示
 */
async function toggleGame(gameId: number): Promise<void> {
  // 已展开的对局再次点击 → 收起
  if (expandedGameId.value === gameId) {
    expandedGameId.value = null
    return
  }
  expandedGameId.value = gameId
  // 命中缓存直接展示，不再请求后端（同时清理竞态可能残留的过期 loading）
  if (detailCache.value.has(gameId)) {
    detailLoading.value = false
    return
  }
  detailLoading.value = true
  try {
    const detail = await getMatchDetail(gameId)
    // 归属校验：await 期间用户可能已切换展开目标（点 A 后立即点 B），
    // 过期响应不得再改动展开状态（误收起新目标）或复位新目标的 loading
    if (expandedGameId.value !== gameId) {
      return
    }
    // 写入缓存：折叠卡/展开态共用，收起再展开零请求
    detailCache.value.set(gameId, { detail })
    logger.info('Loaded match detail', { gameId })
  } catch (error) {
    // 详情失败：展开态无数据可展示，收起卡片并弹出错误提示
    if (expandedGameId.value !== gameId) {
      return
    }
    logger.error('Failed to load match detail', { gameId, error })
    message.error(`对局 ${gameId} 详情加载失败`)
    expandedGameId.value = null
    detailLoading.value = false
  } finally {
    // 归属校验：仅当本请求仍是当前展开目标时复位 loading（过期请求不得复位新目标的 loading）
    if (expandedGameId.value === gameId) {
      detailLoading.value = false
    }
  }
}

/** 刷新按钮：重新加载当前页列表 */
function handleRefresh(): void {
  logger.info('Refresh clicked')
  loadMatches()
}

// 队列切换：回到第一页并重新加载（后端按 queueId 过滤）
watch(activeQueueId, () => {
  page.value = 1
  loadMatches()
})

// 分页变化：重新加载对应页（查询玩家变化时已由 handleSearchSummoner 重置）
watch(page, (next, prev) => {
  if (next !== prev) {
    loadMatches()
  }
})

// 页面挂载：从路由参数初始化查询玩家（/players/:puuid?name=&tag=）并加载其战绩
onMounted(() => {
  const puuid = route.params.puuid as string | undefined
  const name = route.query.name as string | undefined
  const tag = route.query.tag as string | undefined
  queryPlayer.value = puuid
    ? { puuid, gameName: name ?? '', tagLine: tag ?? '' }
    : null
  logger.info('GameStats mounted for summoner', { puuid, name, tag })
  loadMatches()
})

// 路由 puuid 变化（侧栏切换玩家/直接改 URL）：重新初始化并加载新玩家的战绩
watch(
  () => route.params.puuid,
  (puuid, prev) => {
    if (!puuid || puuid === prev) return
    // 重置分页/展开态/缓存/AI 分析状态，按新玩家重新加载
    queryPlayer.value = {
      puuid: puuid as string,
      gameName: (route.query.name as string) ?? '',
      tagLine: (route.query.tag as string) ?? ''
    }
    page.value = 1
    expandedGameId.value = null
    detailCache.value.clear()
    analysisByKey.clear()
    logger.info('Summoner route changed', { puuid })
    loadMatches()
  }
)
</script>

<template>
  <div class="game-stats">
    <!-- 页面最顶层：居中召唤师查询栏（位于段位导航之上） -->
    <div class="top-search">
      <div class="top-search-box">
        <input
          v-model="summonerInput"
          class="top-search-input"
          placeholder="输入召唤师名（昵称#tag）查询战绩"
          @keyup.enter="handleSearchSummoner"
        />
        <button type="button" class="top-search-button" @click="handleSearchSummoner">
          查询
        </button>
      </div>
    </div>

    <!-- 顶部导航：查询玩家信息（左）+ 段位板块（中）+ 刷新按钮（右） -->
    <TopNavBar :sections="rankSections" :player="playerProfile" @refresh="handleRefresh" />

    <div class="body">
      <!-- 侧栏折叠按钮：小屏可见，点击展开/收起侧栏 -->
      <button
        type="button"
        class="collapse-btn"
        :class="{ 'collapse-btn-open': sidebarCollapsed }"
        @click="sidebarCollapsed = !sidebarCollapsed"
      >
        {{ sidebarCollapsed ? '展开侧栏' : '收起侧栏' }}
      </button>

      <!-- 左侧边栏：小屏可折叠（队列筛选/总览/最近队友对手） -->
      <div v-show="!sidebarCollapsed" class="sidebar-wrap">
        <SidebarPanel
          :data="sidebarData"
          :total="total"
          v-model:queue="activeQueueId"
        />
      </div>

      <!-- 右侧主内容区：原版折叠卡列表（加载中显示 n-spin 遮罩；展开详情懒加载） -->
      <main class="main">
        <n-spin :show="loading">
          <div class="game-list">
            <GameCardItem
              v-for="game in games"
              :key="game.summary.gameId"
              :game="game"
              :expanded="expandedGameId === game.summary.gameId"
              :detail-loading="detailLoading && expandedGameId === game.summary.gameId"
              :analyzing="game.analysisState?.analyzing?.value"
              :result="game.analysisState?.result?.value"
              :reasoning="game.analysisState?.reasoning?.value"
              :reasoning-collapsed="game.analysisState?.reasoningCollapsed?.value"
              :from-cache="game.analysisState?.fromCache?.value"
              :error-msg="game.analysisState?.errorMsg?.value"
              :truncated-tip="game.analysisState?.truncatedTip?.value"
              @toggle="toggleGame"
              @analyze="game.analysisState?.analyze()"
            />
            <!-- 空态：加载失败显示错误；查询后无数据显示暂无对局 -->
            <p v-if="!loading && games.length === 0" class="empty">
              {{ errorMsg || '该玩家暂无对局记录' }}
            </p>
          </div>

          <!-- 分页栏：位于战绩列表底部（每页条数 5/10/20 + 总条数 + 翻页箭头，切换即查询） -->
          <div class="pagination" v-if="queryPlayer">
            <select v-model="pageSize" class="page-size-select" @change="handlePageSizeChange">
              <option v-for="size in PAGE_SIZE_OPTIONS" :key="size" :value="size">
                {{ size }}条/页
              </option>
            </select>
            <span class="pager-count">共 {{ total }} 场</span>
            <button
              type="button"
              class="pager-btn"
              :disabled="page <= 1"
              @click="page -= 1"
            >‹</button>
            <button
              type="button"
              class="pager-btn"
              :disabled="!hasNextPage"
              @click="page += 1"
            >›</button>

            <!-- 页码跳转：1 2 3 …（当前页绿色高亮，点击直达对应页并立即查询） -->
            <div class="page-numbers">
              <template v-for="(item, index) in pageItems" :key="index">
                <button
                  v-if="item === 'ellipsis'"
                  type="button"
                  class="page-ellipsis"
                  disabled
                >…</button>
                <button
                  v-else
                  type="button"
                  class="page-num"
                  :class="{ 'page-num-active': item === page }"
                  @click="page = item"
                >{{ item }}</button>
              </template>
            </div>
          </div>
        </n-spin>
      </main>
    </div>
  </div>
</template>

<style lang="scss">
/* 淡绿终端主题变量（用户选定 B 方案：近黑底 + 柔和绿主色 + 柔和珊瑚强调，
   与全局 tailwind/opgg 令牌一致） */
.game-stats {
  --bg: #0b0f0c;
  --surface: #111611;
  --surface-hover: #18201a;
  --surface-active: #1f2a22;
  --border: #243127;
  --border-strong: #33503c;
  --text: #ecfdf5;
  --text-muted: #9ca3af;
  --primary: #4ade80;
  --primary-2: #86efac;
  --accent: #f87171;
  --win: #4b7be5;
  --loss: #e03e52;
  --gold: #c8aa6e;
  --radius: 8px;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.4);

  min-height: 100vh;
  /* 近黑底 + 顶部柔和绿光晕（夜晚竞技场氛围，不抢数据内容） */
  background:
    radial-gradient(1200px 500px at 50% -10%, rgba(74, 222, 128, 0.14), transparent 65%),
    var(--bg);
  color: var(--text);
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
}
</style>

<style lang="scss" scoped>
/* 顶部查询栏：整行居中（搜索框 + 查询按钮，淡绿终端风格） */
.top-search {
  display: flex;
  justify-content: center;
  padding: 14px 20px 4px;
}

.top-search-box {
  display: flex;
  gap: 8px;
  width: min(560px, 90vw);
}

.top-search-input {
  flex: 1;
  padding: 10px 16px;
  font-size: 15px;
  border-radius: 10px;
  border: 1px solid rgba(74, 222, 128, 0.35);
  background: rgba(17, 22, 17, 0.85);
  backdrop-filter: blur(8px);
  color: var(--text);
  transition: border-color 0.15s, box-shadow 0.15s;

  &::placeholder {
    color: var(--text-muted);
  }

  &:focus {
    outline: none;
    border-color: var(--primary-2);
    box-shadow: 0 0 14px rgba(74, 222, 128, 0.35);
  }
}

.top-search-button {
  flex-shrink: 0;
  padding: 10px 22px;
  font-size: 15px;
  font-weight: 600;
  border-radius: 10px;
  background: linear-gradient(90deg, var(--primary), var(--primary-2));
  color: #fff;
  box-shadow: 0 4px 16px rgba(74, 222, 128, 0.3);
  transition: filter 0.15s;

  &:hover {
    filter: brightness(1.12);
  }
}

/* 页面主体：侧栏 + 主内容区（宽屏并排，小屏侧栏默认隐藏） */
.body {
  display: flex;
  align-items: flex-start;
  /* 加宽至 1400px：详情表格列与卡片数据留足空间（原 1152px 在加列后偏挤） */
  max-width: 1400px;
  margin: 0 auto;
}

/* 侧栏折叠按钮：小屏可见，宽屏隐藏 */
.collapse-btn {
  display: none;
  margin: 12px;
  padding: 6px 12px;
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
}

/* 侧栏容器：不参与弹性收缩，保持 300px 固定宽度 */
.sidebar-wrap {
  flex-shrink: 0;
}

/* 主内容区：战绩列表纵向排列，宽度自适应剩余空间 */
.main {
  flex: 1;
  min-width: 0;
  padding: 12px;
}

/* 列表容器：折叠卡纵向排列，卡片间距 14px（卡片加高后保持呼吸感） */
.game-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* 分页栏：列表底部居中（每页条数下拉 + 总条数 + 翻页箭头，淡绿终端风格） */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 18px 0 6px;
}

.page-size-select {
  padding: 5px 8px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface-hover);
  color: var(--text);
  font-size: 13px;
}

.pager-count {
  font-size: 14px;
  color: var(--text-muted);
}

.pager-btn {
  width: 28px;
  height: 28px;
  border-radius: var(--radius);
  background: var(--surface-hover);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 15px;
  transition: background-color 0.15s, border-color 0.15s;

  &:hover:not(:disabled) {
    background: var(--surface-active);
    border-color: var(--border-strong);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

/* 页码跳转：1 2 3 …（当前页绿色高亮） */
.page-numbers {
  display: flex;
  align-items: center;
  gap: 6px;
}

.page-num {
  min-width: 28px;
  height: 28px;
  padding: 0 6px;
  border-radius: var(--radius);
  background: var(--surface-hover);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;

  &:hover:not(.page-num-active) {
    background: var(--surface-active);
    border-color: var(--border-strong);
  }
}

/* 当前页：柔和绿渐变高亮 */
.page-num-active {
  background: linear-gradient(90deg, var(--primary), var(--primary-2));
  border-color: transparent;
  color: #0b0f0c;
  font-weight: 700;
}

.page-ellipsis {
  min-width: 20px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  cursor: default;
}

/* 空态提示：加载失败错误信息或无数据占位文案 */
.empty {
  padding: 40px 0;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

/* 小屏：侧栏默认隐藏，通过按钮展开 */
@media (max-width: 900px) {
  .collapse-btn {
    display: block;
  }

  .sidebar-wrap {
    display: none;

    /* 侧栏展开时覆盖在列表上方 */
    .sidebar {
      position: fixed;
      top: 60px;
      bottom: 0;
      left: 0;
      z-index: 10;
      overflow-y: auto;
      background: var(--bg);
    }
  }
}
</style>
