<template>
  <!-- 差距线图表（任务 15 全量移植原版 MatchCardDiffLineChart）：
       左侧 Line 折线图（玩家个人 + 队伍平均），右侧控制面板（数据类型/队伍/玩家选择） -->
  <div class="flex size-full gap-4">
    <!-- 图表区域 -->
    <div class="min-w-0 flex-1">
      <Line :data="chartData" :options="chartOptions" />
    </div>

    <!-- 右侧控制面板 -->
    <NScrollbar class="w-52!">
      <div class="flex flex-col gap-3">
        <!-- 数据类型选择器 -->
        <div class="flex flex-col gap-2">
          <div class="text-xs font-semibold text-black/60 dark:text-white/60">
            {{ t('matchCard.diffLineChart.dataType') }}
          </div>
          <NRadioGroup v-model:value="selectedMetric">
            <div class="flex flex-col gap-1.5">
              <NRadio value="gold" :label="t('matchCard.diffLineChart.gold')" />
              <NRadio value="cs" :label="t('matchCard.diffLineChart.cs')" />
              <NRadio value="exp" :label="t('matchCard.diffLineChart.exp')" />
              <NRadio value="damageDealt" :label="t('matchCard.diffLineChart.damageDealt')" />
              <NRadio value="damageTaken" :label="t('matchCard.diffLineChart.damageTaken')" />
            </div>
          </NRadioGroup>
        </div>

        <!-- 分隔线 -->
        <div class="h-px bg-black/10 dark:bg-white/10"></div>

        <!-- 队伍平均选择 -->
        <div class="flex flex-col gap-2">
          <div class="text-xs font-semibold text-black/60 dark:text-white/60">
            {{ t('matchCard.diffLineChart.teamAverage') }}
          </div>
          <NCheckboxGroup v-model:value="selectedTeams">
            <div class="flex flex-col gap-1.5">
              <NCheckbox
                v-for="team in teamOptions"
                :key="team.value"
                :value="team.value"
                :label="team.label"
              />
            </div>
          </NCheckboxGroup>
        </div>

        <!-- 分隔线 -->
        <div class="h-px bg-black/10 dark:bg-white/10"></div>

        <!-- 玩家选择 -->
        <div class="flex w-full flex-col gap-2">
          <div class="text-xs font-semibold text-black/60 dark:text-white/60">
            {{ t('matchCard.diffLineChart.players') }}
          </div>
          <!-- 全选 / 半选 / 全不选 -->
          <NCheckbox
            :checked="allPlayersChecked"
            :indeterminate="somePlayersChecked"
            @update:checked="toggleAllPlayers"
          >
            <template #default>
              <div class="flex items-center gap-2">
                <span>{{ t('matchCard.diffLineChart.selectAll') }}</span>
              </div>
            </template>
          </NCheckbox>
          <NCheckboxGroup v-model:value="selectedPlayers">
            <div class="flex flex-col gap-1.5">
              <NCheckbox
                v-for="player in sortedPlayerOptions"
                :key="player.value"
                :value="player.value"
              >
                <template #default>
                  <div class="flex w-48 items-center gap-2">
                    <!-- 颜色方块 -->
                    <div
                      class="h-3 w-3 shrink-0 rounded-sm"
                      :style="{ backgroundColor: player.color }"
                    ></div>
                    <span class="truncate">{{ player.label }}</span>
                  </div>
                </template>
              </NCheckbox>
            </div>
          </NCheckboxGroup>
        </div>
      </div>
    </NScrollbar>
  </div>
</template>

<script setup lang="ts">
/**
 * 差距线图表（任务 15）：移植原版 MatchCardDiffLineChart；
 * chart.js 注册与 chartjs-plugin-datalabels 插件逻辑保留，frames 经
 * toMatchCardTimelineSeries 归一化（数值字段兜底 0），damageStats 仅 SGP 数据有值。
 * 交互：右侧控制面板切换数据类型/队伍平均/玩家曲线，曲线隐藏不删数据（对齐原版），
 * 悬停按 x 轴联动显示同一时刻全部数据集数值
 */
import { useGameResourceProvider } from '@/utils/match-card-resource'
import { t } from '@/utils/match-card-i18n'
import {
  isMatchCardDetailedParticipantFrame,
  toMatchCardTimelineSeries
} from '@/views/match-detail/adapter/match-card-timeline'
import type { MatchCardParticipant } from '@/views/match-detail/adapter/types'
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip
} from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { NCheckbox, NCheckboxGroup, NRadio, NRadioGroup, NScrollbar } from 'naive-ui'
import { computed, ref, watch, watchEffect } from 'vue'
import { Line } from 'vue-chartjs'

import { useMatchCard } from '../../context'
import { useTeamName } from '../../utils/text'
import { getTeamColor, playerColors } from '../../utils/theme'

// chart.js 注册：折线图所需的坐标系/图元/交互插件 + datalabels（原版注册逻辑保留，
// 模块加载时注册一次，全局生效）
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Title,
  ChartDataLabels
)

// 游戏资源提供者（英雄名/明暗模式探测）与队伍名文案工厂
const resources = useGameResourceProvider()

// 队伍名文案工厂：TEAM-100 → 蓝队（队伍平均曲线的数据集标签用）
const teamName = useTeamName()

// context 消费：basicInfo（地图/数据源判定）、frames（曲线数据源）、participants（选手/队伍映射）、teams（队伍聚合）、hidePrivacy（选手名隐私）
const { basicInfo, frames, participants, teams, hidePrivacy } = useMatchCard()

// damageDealt 和 damageTaken 只在 sgp 中可用（官方 API/LCU 无伤害明细帧数据）
type Metric = 'gold' | 'cs' | 'exp' | 'damageDealt' | 'damageTaken'

/** 当前选中的指标（右侧数据类型单选），初始为金币曲线 */
const selectedMetric = ref<Metric>('gold')

// 检测当前主题（响应式）：网格线/坐标轴颜色随明暗模式切换
const isDark = computed(() => resources.runtime.colorMode === 'dark')

// selectedTeams：显示队伍平均曲线的队伍集合（默认全选）；selectedPlayers：显示个人曲线的选手集合（默认全不选，需手动勾选）
const selectedTeams = ref<string[]>([])
const selectedPlayers = ref<number[]>([])

// 队伍平均曲线默认全选：队伍列表就绪后把全部队伍加入选中集合
watchEffect(() => {
  selectedTeams.value = teams.value.teamStatsArr.map((team) => team.teamIdentifier)
})

/**
 * 各指标的标题/坐标轴/单位文案（原版 metricConfigs）：
 * 图表标题与 y 轴随指标切换，tooltip 数值带单位后缀。
 * 五个指标为固定集合，文案全部来自 i18n 表
 */
const metricConfigs = computed(() => ({
  // 金币曲线：总金币（经济差的直观对比）
  gold: {
    title: t('matchCard.diffLineChart.metric.gold.title'),
    yAxisLabel: t('matchCard.diffLineChart.metric.gold.yAxis'),
    unit: t('matchCard.diffLineChart.metric.gold.unit')
  },
  // 补刀曲线：小兵 + 野怪
  cs: {
    title: t('matchCard.diffLineChart.metric.cs.title'),
    yAxisLabel: t('matchCard.diffLineChart.metric.cs.yAxis'),
    unit: t('matchCard.diffLineChart.metric.cs.unit')
  },
  // 经验曲线：累计经验值
  exp: {
    title: t('matchCard.diffLineChart.metric.exp.title'),
    yAxisLabel: t('matchCard.diffLineChart.metric.exp.yAxis'),
    unit: t('matchCard.diffLineChart.metric.exp.unit')
  },
  // 已造成伤害曲线：SGP 专属
  damageDealt: {
    title: t('matchCard.diffLineChart.metric.damageDealt.title'),
    yAxisLabel: t('matchCard.diffLineChart.metric.damageDealt.yAxis'),
    unit: t('matchCard.diffLineChart.metric.damageDealt.unit')
  },
  // 已承受伤害曲线：SGP 专属
  damageTaken: {
    title: t('matchCard.diffLineChart.metric.damageTaken.title'),
    yAxisLabel: t('matchCard.diffLineChart.metric.damageTaken.yAxis'),
    unit: t('matchCard.diffLineChart.metric.damageTaken.unit')
  }
}))

/** 归一化后的时间线序列：适配层已校验帧结构并把数值字段兜底为 0，图表数据不产生 undefined */
const series = computed(() => toMatchCardTimelineSeries(frames.value))

/**
 * 提取选手个人指标数据：逐帧按指标取参与者帧对应字段。
 * cs = 小兵 + 野怪；damageDealt/damageTaken 仅 SGP 详细帧有值，
 * 非 SGP 帧跳过（数据点缺失时该数据集不产生长度错位的填充值）
 */
const extractMetricData = (participantId: number, metric: Metric) => {
  const data: number[] = []

  series.value.forEach((frame) => {
    const participantFrame = frame.participantFrames[participantId.toString()]
    if (participantFrame) {
      switch (metric) {
        // 金币：直接取总金币（与对局结算的经济口径一致）
        case 'gold':
          data.push(participantFrame.totalGold)
          break
        // 补刀：小兵 + 野怪（jungleMinionsKilled 老数据可能缺失，|| 0 兜底）
        case 'cs':
          data.push(participantFrame.minionsKilled + (participantFrame.jungleMinionsKilled || 0))
          break
        // 经验：累计经验值
        case 'exp':
          data.push(participantFrame.xp || 0)
          break
        // 对英雄伤害：仅 SGP 详细帧有值，其余跳过（数据集长度随之变化，对齐原版）
        case 'damageDealt':
          if (isMatchCardDetailedParticipantFrame(participantFrame)) {
            data.push(participantFrame.damageStats.totalDamageDoneToChampions)
          }
          break
        // 承伤：同 damageDealt 的 SGP 判定
        case 'damageTaken':
          if (isMatchCardDetailedParticipantFrame(participantFrame)) {
            data.push(participantFrame.damageStats.totalDamageTaken)
          }
          break
      }
    }
  })

  return data
}

/**
 * 计算队伍平均数据：每帧对该队全部选手的指标求和后取整均值。
 * 与个人曲线不同，这里始终返回与帧数等长的数组（无选手数据的帧按 0 处理），
 * 保证队伍平均曲线不会因个别帧缺数据而断线
 */
const extractTeamAverageData = (teamIdentifier: string, metric: Metric) => {
  // 先取该队全部选手的 participantId（按 teamIdentifier 归属，CHERRY 子队同样适用）
  const teamParticipants = participants.value
    .filter((p) => p.teamIdentifier === teamIdentifier)
    .map((p) => p.participantId)

  const data: number[] = []

  series.value.forEach((frame) => {
    let sum = 0
    let count = 0

    teamParticipants.forEach((participantId) => {
      const participantFrame = frame.participantFrames[participantId.toString()]
      if (participantFrame) {
        switch (metric) {
          case 'gold':
            sum += participantFrame.totalGold
            break
          case 'cs':
            sum += participantFrame.minionsKilled + participantFrame.jungleMinionsKilled
            break
          case 'exp':
            sum += participantFrame.xp
            break
          case 'damageDealt':
            if (isMatchCardDetailedParticipantFrame(participantFrame)) {
              sum += participantFrame.damageStats.totalDamageDoneToChampions
            }
            break
          case 'damageTaken':
            if (isMatchCardDetailedParticipantFrame(participantFrame)) {
              sum += participantFrame.damageStats.totalDamageTaken
            }
            break
        }
        count++
      }
    })

    // 无选手数据的帧按 0 处理：与个人曲线不同，队伍平均始终返回与帧数等长的数组
    data.push(count > 0 ? Math.round(sum / count) : 0)
  })

  return data
}

// 生成时间点标签（根据实际 frames 数量）：每帧一个「Nmin」标签，与数据点一一对应；
// 分钟取整（60000ms → 1min），帧间隔较密时会出现重复标签，由 x 轴刻度上限收敛显示
const timeLabels = computed(() => {
  return series.value.map((frame) => {
    const minutes = Math.floor(frame.timestamp / 60000)
    return `${minutes}min`
  })
})

/**
 * 队伍选项（右侧队伍平均选择）：队伍名 + 主题色。
 * 队伍名经 useTeamName 翻译（TEAM-100 → 蓝队），颜色与图表曲线一致
 */
const teamOptions = computed(() => {
  return teams.value.teamStatsArr.map((team) => {
    const name = teamName(team.teamIdentifier)
    return {
      value: team.teamIdentifier,
      label: t('matchCard.diffLineChart.teamAverageSuffix', { name }),
      color: getTeamColor(team.teamIdentifier)
    }
  })
})

/**
 * 选手选项（右侧玩家选择）：排序与 Builds Tab 一致（CHERRY 子队/队伍标识），
 * 颜色按 participantId - 1 轮询 playerColors（与数据集取色同源，保证色块与曲线对应）
 */
const sortedPlayerOptions = computed(() => {
  return participants.value
    .toSorted((a, b) => {
      if (basicInfo.value.isCherrySubteam) {
        return a.subteamPlacement - b.subteamPlacement
      }

      return a.teamIdentifier.localeCompare(b.teamIdentifier)
    })
    .map((p) => {
      return {
        value: p.participantId,
        label: `${resources.champions.name(p.championId)}`,
        color: playerColors[(p.participantId - 1) % playerColors.length]
      }
    })
})

// 玩家全选 / 半选 / 全不选状态：全选 = 全部选手都被选中；半选 = 选中一部分。
// 三态以选手选项列表为准（选手列表变化时状态自动重算）
const allPlayerValues = computed(() => sortedPlayerOptions.value.map((p) => p.value))
const allPlayersChecked = computed(
  () =>
    selectedPlayers.value.length > 0 &&
    selectedPlayers.value.length === allPlayerValues.value.length
)
const somePlayersChecked = computed(
  () =>
    selectedPlayers.value.length > 0 && selectedPlayers.value.length < allPlayerValues.value.length
)
// 全选/全不选切换：直接整体替换选中集合
const toggleAllPlayers = (checked: boolean) => {
  selectedPlayers.value = checked ? [...allPlayerValues.value] : []
}

// 构建图表数据（响应式）：labels + 玩家个人数据集 + 队伍平均数据集
const chartData = computed(() => {
  // 如果 timeline 为空，返回空数据（图表渲染空坐标轴，不报错、不渲染任何曲线）
  if (series.value.length === 0) {
    return {
      labels: [],
      datasets: []
    }
  }

  /**
   * 数据集标签：选手名（隐私模式用英雄名），
   * 未在 participants 中命中的 participantId 回退「玩家 N」
   */
  const getName = (
    participantId: number,
    participant?: MatchCardParticipant,
    hidePrivacy: boolean = false
  ) => {
    if (!participant) return t('matchCard.diffLineChart.playerLabel', { id: participantId })

    if (hidePrivacy) return resources.champions.name(participant.championId)

    return `${participant.gameName} #${participant.tagLine}`
  }

  // 玩家个人数据：按 participants 顺序生成 1..N 号选手的数据集，
  // 未选中（selectedPlayers 不含）的选手曲线隐藏但不删除数据（隐藏 = 图例/悬浮仍可检索）
  const playerDatasets = Array.from({ length: participants.value.length }, (_, i) => {
    const participantId = i + 1 // participantId 从 1 开始
    const participant = participants.value.find((p) => p.participantId === participantId)

    return {
      label: getName(participantId, participant, hidePrivacy.value),
      data: extractMetricData(participantId, selectedMetric.value),
      borderColor: playerColors[i % playerColors.length],
      backgroundColor: playerColors[i % playerColors.length] + '40', // 添加透明度
      borderWidth: 2,
      tension: 0, // 无平滑，严格按照数据点绘制
      pointRadius: 0, // 隐藏数据点
      pointHoverRadius: 4, // 悬停时显示数据点
      hidden: !selectedPlayers.value.includes(participantId) // 根据选中状态控制
    }
  })

  // 队伍平均数据：每队一条虚线数据集（borderDash 点划线），未选中队伍隐藏；
  // 曲线颜色与 TeamTable/事件页的队伍色一致（getTeamColor 同一套映射）
  const teamAverageDatasets = teams.value.teamStatsArr.map((team) => {
    const name = teamName(team.teamIdentifier)
    const color = getTeamColor(team.teamIdentifier)

    return {
      label: t('matchCard.diffLineChart.teamAverageSuffix', { name }),
      data: extractTeamAverageData(team.teamIdentifier, selectedMetric.value),
      borderColor: color,
      backgroundColor: color + '40',
      borderWidth: 3,
      borderDash: [10, 2, 2, 2], // 点划线样式（长线-短间隔-点-短间隔）
      tension: 0,
      pointRadius: 0,
      pointHoverRadius: 5,
      hidden: !selectedTeams.value.includes(team.teamIdentifier) // 根据选中状态控制
    }
  })

  return {
    labels: timeLabels.value,
    // 数据集顺序：玩家个人在前、队伍平均在后（右侧控制面板的勾选顺序与之一致）
    datasets: [...playerDatasets, ...teamAverageDatasets]
  }
})

// 图表配置选项（响应式）：交互/坐标轴/主题色随指标与明暗模式联动
const chartOptions = computed(() => {
  // 当前指标的标题/坐标轴/单位文案：切换数据类型时图表标题与 y 轴同步更新
  const config = metricConfigs.value[selectedMetric.value]

  return {
    responsive: true,
    maintainAspectRatio: false, // 图表撑满容器（父级 flex-1 控制高度，切换 Tab 时自适应）
    animation: {
      duration: 300 // 动画时长（毫秒），默认为 1000
    },
    plugins: {
      // datalabels 插件已注册但默认关闭（仅保留注册以兼容原版配置）
      datalabels: {
        display: false
      },
      legend: {
        display: false // 禁用内置图例，使用外部控制器
      },
      title: {
        display: false // 标题同样交给外部面板（右侧控制面板即数据选择器）
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        // 悬停提示：数据集名 + 数值 + 指标单位（如「菲奥娜：500 金币」）
        callbacks: {
          label: (context: any) => {
            return `${context.dataset.label}: ${context.parsed.y.toLocaleString()} ${config.unit}`
          }
        }
      }
    },
    scales: {
      // x 轴：游戏时间（帧时间戳换算的分钟数），最多 10 个刻度避免拥挤
      x: {
        display: true,
        title: {
          display: true,
          text: t('matchCard.diffLineChart.gameTime')
        },
        ticks: {
          maxTicksLimit: 10
        },
        grid: {
          display: true,
          color: isDark.value ? 'rgba(200, 200, 200, 0.2)' : 'rgba(100, 100, 100, 0.2)',
          drawOnChartArea: true
        }
      },
      // y 轴：当前指标数值，从 0 开始并带千分位刻度
      y: {
        display: true,
        title: {
          display: true,
          text: config.yAxisLabel
        },
        beginAtZero: true,
        ticks: {
          callback: (value: any) => value.toLocaleString()
        },
        grid: {
          display: true,
          color: isDark.value ? 'rgba(200, 200, 200, 0.3)' : 'rgba(100, 100, 100, 0.3)',
          drawOnChartArea: true
        }
      }
    },
    interaction: {
      // 悬停交互：按 x 轴最近点联动（同一时刻的所有数据集一起高亮）
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false
    }
  }
})

/**
 * 指标回退守卫：lcU（官方 API）数据无伤害明细帧，
 * 切到 damageDealt/damageTaken 指标时自动回退金币曲线，避免空曲线误导
 */
watch(
  () => basicInfo.value.dataSource,
  (source) => {
    if (
      source === 'lcu' &&
      (selectedMetric.value === 'damageDealt' || selectedMetric.value === 'damageTaken')
    ) {
      selectedMetric.value = 'gold'
    }
  }
)
</script>

<style scoped></style>
