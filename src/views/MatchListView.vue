<script setup lang="ts">
/**
 * 对局列表页（OP.GG 风格卡片流）
 * 展示后端对局分页数据：支持队列筛选、日期范围筛选与分页浏览；
 * 每局渲染为一行式卡片，左侧竖向色条标识胜方颜色，整卡点击跳转详情。
 * 注意：列表摘要接口（MatchSummary）不含英雄头像 / KDA / 出装，
 * 卡片内容仅使用摘要可用字段渲染（见 api/types.ts 注释）。
 */
import { listMatches } from '@/api/matches'
import type { MatchSummary } from '@/api/types'
import { createLogger } from '@/utils/logger'
import { NButton, NDatePicker, NSelect, NPagination, useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

// 日志器：来源标签固定为 MatchList，便于在 DevTools 中按标签过滤日志
const logger = createLogger('MatchList')
// 全局消息提示：列表加载失败时向用户展示错误原因
const message = useMessage()
// 路由实例：点击对局卡片时跳转到详情页 /matches/:gameId
const router = useRouter()

// 列表加载状态：为 true 时展示加载提示
const loading = ref(false)
// 当前页对局数据：来自后端分页响应的 data 字段
const rows = ref<MatchSummary[]>([])
// 符合筛选条件的总条数：用于分页组件计算总页数
const total = ref(0)
// 当前页码：从 1 开始，切换页码时重新请求
const page = ref(1)
// 每页条数：与后端默认分页大小保持一致
const pageSize = ref(20)
// 当前选中的队列 ID：null 表示不过滤任何队列
const queueId = ref<number | null>(null)
// 加载失败标记：为 true 时空态展示错误文案与重试按钮
const loadFailed = ref(false)

// 队列筛选：常用队列 ID -> 名称（展示用；未知队列显示 "队列 {ID}"）
const queueOptions = [
  { label: '单双排位 420', value: 420 },
  { label: '灵活排位 440', value: 440 },
  { label: '匹配 430', value: 430 },
  { label: '极地大乱斗 450', value: 450 }
]

// 队列 ID -> 中文名映射（用于卡片右侧元信息展示）
const queueNames: Record<number, string> = {
  420: '单双排位',
  440: '灵活排位',
  430: '匹配',
  450: '极地大乱斗'
}

// 游戏模式 -> 中文名映射（未知模式原样展示后端值）
const modeNames: Record<string, string> = {
  CLASSIC: '经典模式',
  ARAM: '极地大乱斗',
  CHERRY: '特殊模式'
}

// 日期范围：[起始, 结束] 毫秒时间戳，null 表示不过滤
const dateRange = ref<[number, number] | null>(null)

/** 把秒数格式化为 mm:ss，供卡片时长展示（等宽数字保证对齐） */
function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

/** 队列 ID -> 中文名；未知队列回退为 "队列 {ID}" */
function queueName(id: number): string {
  return queueNames[id] ?? `队列 ${id}`
}

/** 游戏模式 -> 中文名；未知模式回退为后端原始值 */
function modeLabel(mode: string): string {
  return modeNames[mode] ?? mode
}

/** 胜方徽章信息：蓝方胜（蓝）/ 红方胜（红）；CHERRY 等特殊模式或未知胜方显示 - */
function winnerInfo(summary: MatchSummary): { text: string; tone: 'win' | 'loss' | 'tie' } {
  if (summary.gameMode === 'CHERRY' || summary.winnerTeamId == null) {
    return { text: '-', tone: 'tie' }
  }
  return summary.winnerTeamId === 100
    ? { text: '蓝方胜', tone: 'win' }
    : { text: '红方胜', tone: 'loss' }
}

/**
 * 卡片展示数据：为每行预计算胜方徽章文案与色调，
 * 模板只消费预计算结果，避免每张卡片重复调用 winnerInfo
 */
const cards = computed(() =>
  rows.value.map((row) => {
    const winner = winnerInfo(row)
    return { ...row, winnerText: winner.text, winnerTone: winner.tone }
  })
)

/**
 * 加载对局列表：按当前筛选条件与分页参数请求后端
 * 成功后刷新卡片与总数并记录日志；失败时提示用户后端未启动等错误
 */
async function load() {
  loading.value = true
  loadFailed.value = false
  try {
    const params = {
      page: page.value,
      pageSize: pageSize.value,
      queueId: queueId.value ?? undefined,
      startTime: dateRange.value?.[0],
      endTime: dateRange.value?.[1]
    }
    const result = await listMatches(params)
    rows.value = result.data
    total.value = result.total
    logger.info('Match list loaded', { page: page.value, total: result.total })
  } catch (error) {
    loadFailed.value = true
    logger.error('Failed to load match list', error)
    message.error('对局列表加载失败，请确认后端服务已启动')
  } finally {
    loading.value = false
  }
}

/** 整卡点击跳转详情页；gameId 为后端唯一标识 */
function goDetail(gameId: number) {
  router.push(`/matches/${gameId}`)
}

// 组件挂载后立即加载第一页数据
onMounted(load)
</script>

<template>
  <div class="match-list">
    <!-- 筛选区：队列下拉 + 日期范围 + 刷新按钮，筛选变更后自动重新加载 -->
    <div class="filters">
      <n-select
        v-model:value="queueId"
        :options="queueOptions"
        clearable
        placeholder="队列"
        style="width: 170px"
        @update:value="load"
      />
      <n-date-picker
        v-model:value="dateRange"
        type="daterange"
        style="width: 270px"
        @update:value="load"
      />
      <n-button :loading="loading" @click="load">刷新</n-button>
    </div>

    <!-- 加载提示：首次请求或切换筛选期间展示 -->
    <div v-if="loading" class="loading-tip">对局加载中…</div>

    <!-- 对局卡片流：每张卡片一行式布局，左侧竖向色条标识胜方颜色 -->
    <ul v-else-if="cards.length > 0" class="match-cards">
      <li v-for="row in cards" :key="row.gameId">
        <!-- 整卡为按钮：hover 提亮 + 点击跳转详情，替代原表格的操作列 -->
        <button class="match-card" type="button" @click="goDetail(row.gameId)">
          <!-- 竖向色条：蓝方胜为蓝、红方胜为红、特殊模式/未知为灰色 -->
          <span class="bar" :class="row.winnerTone" aria-hidden="true" />
          <span class="card-main">
            <!-- 模式徽章 + 时长 + 对局时间（等宽数字保证列对齐） -->
            <span class="mode-badge">{{ modeLabel(row.gameMode) }}</span>
            <span class="duration tabular-nums">{{ formatDuration(row.gameDuration) }}</span>
            <span class="time">{{ new Date(row.gameCreation).toLocaleString() }}</span>
          </span>
          <span class="card-side">
            <!-- 右侧元信息：大区 + 队列名，以及胜方徽章 -->
            <span class="meta">{{ row.region.toUpperCase() }} · {{ queueName(row.queueId) }}</span>
            <span class="winner-badge" :class="row.winnerTone">{{ row.winnerText }}</span>
          </span>
        </button>
      </li>
    </ul>

    <!-- 空态：加载失败展示错误文案与重试按钮，无数据展示引导文案 -->
    <div v-else class="empty-state">
      <template v-if="loadFailed">
        <p>对局列表加载失败，请确认后端服务已启动</p>
        <n-button @click="load">重试</n-button>
      </template>
      <p v-else>还没有对局数据，先在 League Akari 中打完一局并同步</p>
    </div>

    <!-- 分页：有数据时才展示，切换页码重新请求 -->
    <n-pagination
      v-if="total > 0"
      v-model:page="page"
      :page-size="pageSize"
      :item-count="total"
      @update:page="load"
      style="margin-top: 16px"
    />
  </div>
</template>

<style scoped>
/* 页面容器：居中限定最大宽度，上下留白与筛选区对齐 */
.match-list {
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px 16px 40px;
}

/* 筛选区：横向排列，窄屏自动换行 */
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

/* 加载提示：次要文字，弱于卡片内容的视觉层级 */
.loading-tip {
  color: var(--text-secondary);
  padding: 32px 0;
  text-align: center;
}

/* 卡片列表：去掉默认列表样式，卡片间 8px 间距 */
.match-cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 对局卡片：一行式布局，默认深蓝黑卡片背景，hover 提亮 */
.match-card {
  display: flex;
  align-items: stretch;
  width: 100%;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-card);
  padding: 0;
  cursor: pointer;
  text-align: left;
  color: var(--text-primary);
  font: inherit;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.match-card:hover {
  background: var(--bg-card-hover);
  border-color: rgba(139, 147, 167, 0.32);
}

/* 竖向色条：4px 宽、左侧圆角贴合卡片轮廓，颜色随胜方变化 */
.bar {
  flex: 0 0 4px;
  border-radius: 8px 0 0 8px;
}
.bar.win {
  background: var(--win-color);
}
.bar.loss {
  background: var(--loss-color);
}
.bar.tie {
  background: var(--border-subtle);
}

/* 卡片主体：模式徽章 / 时长 / 时间横排，窄屏换行堆叠 */
.card-main {
  flex: 1 1 auto;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 14px;
  padding: 14px 16px;
}

/* 模式徽章：加粗主文本，作为卡片的第一信息层级 */
.mode-badge {
  font-weight: 600;
  font-size: 15px;
}

/* 时长：等宽数字，与时间区分层次 */
.duration {
  font-size: 14px;
  color: var(--text-primary);
}

/* 对局时间：次要文本色 */
.time {
  font-size: 13px;
  color: var(--text-secondary);
}

/* 卡片右侧：元信息与胜方徽章右对齐排列 */
.card-side {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 6px;
  padding: 14px 16px;
}

/* 大区与队列名：次要小字 */
.meta {
  font-size: 12px;
  color: var(--text-secondary);
}

/* 胜方徽章：色块 + 对应颜色文字，蓝胜蓝底、红胜红底、未知灰底 */
.winner-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 4px;
}
.winner-badge.win {
  color: var(--win-color);
  background: var(--bg-win);
}
.winner-badge.loss {
  color: var(--loss-color);
  background: var(--bg-loss);
}
.winner-badge.tie {
  color: var(--text-secondary);
  background: rgba(139, 147, 167, 0.1);
}

/* 空态：居中引导文案，次要文本色 */
.empty-state {
  padding: 48px 0;
  text-align: center;
  color: var(--text-secondary);
}
.empty-state p {
  margin: 0 0 12px;
}

/* 窄屏：卡片右侧信息堆叠到主体下方，保持可读性 */
@media (max-width: 640px) {
  .match-card {
    flex-wrap: wrap;
  }
  .card-side {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    border-top: 1px solid var(--border-subtle);
  }
}
</style>
