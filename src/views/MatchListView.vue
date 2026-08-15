<script setup lang="ts">
/**
 * 对局列表页
 * 展示后端对局分页数据，支持队列筛选、日期范围筛选与分页浏览
 */
import { listMatches } from '@/api/matches'
import type { MatchSummary } from '@/api/types'
import { createLogger } from '@/utils/logger'
import {
  type DataTableColumns,
  NButton,
  NDataTable,
  NDatePicker,
  NSelect,
  useMessage
} from 'naive-ui'
import { h, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

// 日志器：来源标签固定为 MatchList，便于在 DevTools 中按标签过滤日志
const logger = createLogger('MatchList')
// 全局消息提示：列表加载失败时向用户展示错误原因
const message = useMessage()
// 路由实例：点击"详情"按钮时跳转到对局详情页 /matches/:gameId
const router = useRouter()

// 列表加载状态：为 true 时数据表格与刷新按钮展示 loading 效果
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

// 队列筛选：常用队列 ID -> 名称（展示用；未知队列显示 ID）
const queueOptions = [
  { label: '单双排位 420', value: 420 },
  { label: '灵活排位 440', value: 440 },
  { label: '匹配 430', value: 430 },
  { label: '极地大乱斗 450', value: 450 }
]

// 日期范围：[起始, 结束] 毫秒时间戳，null 表示不过滤
const dateRange = ref<[number, number] | null>(null)

// 表格列定义：时间/模式/时长/结果/操作五列，操作列渲染跳转详情页按钮
const columns: DataTableColumns<MatchSummary> = [
  {
    title: '时间',
    key: 'gameCreation',
    render: (row) => new Date(row.gameCreation).toLocaleString()
  },
  { title: '模式', key: 'gameMode' },
  {
    title: '时长',
    key: 'gameDuration',
    render: (row) =>
      `${Math.floor(row.gameDuration / 60)}:${String(row.gameDuration % 60).padStart(2, '0')}`
  },
  {
    title: '结果',
    key: 'winnerTeamId',
    render: (row) =>
      row.winnerTeamId === 100 ? '蓝方胜' : row.winnerTeamId === 200 ? '红方胜' : '-'
  },
  {
    title: '操作',
    key: 'actions',
    render: (row) =>
      h(
        NButton,
        { size: 'small', onClick: () => router.push(`/matches/${row.gameId}`) },
        { default: () => '详情' }
      )
  }
]

/**
 * 加载对局列表：按当前筛选条件与分页参数请求后端
 * 成功后刷新表格与总数并记录日志；失败时提示用户后端未启动等错误
 */
async function load() {
  loading.value = true
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
    logger.error('Failed to load match list', error)
    message.error('对局列表加载失败，请确认后端服务已启动')
  } finally {
    loading.value = false
  }
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
        style="width: 160px"
        @update:value="load"
      />
      <n-date-picker
        v-model:value="dateRange"
        type="daterange"
        style="width: 260px"
        @update:value="load"
      />
      <n-button :loading="loading" @click="load">刷新</n-button>
    </div>
    <!-- 数据表格：loading 与空态由 Naive UI 内置处理，分页独立交给下方组件 -->
    <n-data-table :columns="columns" :data="rows" :loading="loading" :pagination="false" />
    <n-pagination
      v-model:page="page"
      :page-size="pageSize"
      :item-count="total"
      @update:page="load"
      style="margin-top: 12px"
    />
  </div>
</template>
