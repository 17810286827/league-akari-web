<template>
  <!-- 霓虹能量雷达图：玻璃终端背景 + 中心紫光晕 + 内边距；shrink-0 防止被 popover flex 压缩，
       画布加宽让轴外标签（数值/差值/轴名三行）不溢出 -->
  <div class="glass-card radar-glow w-[384px] shrink-0 rounded-xl p-2">
    <div class="h-[340px] w-[340px]">
      <!-- :plugins 注册轴外标签插件（options.plugins 仅传配置，插件逻辑需在此注册） -->
      <Radar :data="data" :options="options" :plugins="[radarValueLabelsPlugin]" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameResourceProvider } from '@/utils/match-card-resource'
import { formatExtremeNumber, noZero } from '@/utils/numbers'
import { t } from '@/utils/match-card-i18n'
import {
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type TooltipItem
} from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import { computed } from 'vue'
import { Radar } from 'vue-chartjs'

import { useMatchCard } from '../context'

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  ChartDataLabels
)

const { puuid } = defineProps<{
  puuid?: string
}>()

const { teams, participants, hidePrivacy } = useMatchCard()

const resources = useGameResourceProvider()

// 可被替换
const isDark = computed(() => resources.runtime.colorMode === 'dark')

const participant = computed(() => {
  return participants.value.find((p) => p.puuid === puuid)
})

const selfName = computed(() => {
  if (!participant.value) return null

  if (hidePrivacy.value) return resources.champions.name(participant.value.championId)

  return `${participant.value.gameName} #${participant.value.tagLine}`
})

const team = computed(() => {
  if (!participant.value) return null
  return teams.value.teamStatMap[participant.value.teamIdentifier]
})

const teamSize = computed(() => {
  if (!team.value) return 0
  return participants.value.filter((p) => p.teamIdentifier === team.value!.teamIdentifier).length
})

const percentage = computed(() => {
  if (!participant.value || !team.value) {
    return {
      damageDealtToChampions: 0,
      damageTaken: 0,
      goldEarned: 0,
      cs: 0,
      kda: 0,
      killParticipation: 0,
      totalHeal: 0,

      damageDealtToChampionsRatioToMax: 0,
      damageTakenRatioToMax: 0,
      goldEarnedRatioToMax: 0,
      csRatioToMax: 0,
      kdaRatioToMax: 0,
      killParticipationRatioToMax: 0,
      totalHealRatioToMax: 0,

      teamAvgDamageDealtToChampionsRatioToMax: 0,
      teamAvgDamageTakenRatioToMax: 0,
      teamAvgGoldEarnedRatioToMax: 0,
      teamAvgCsRatioToMax: 0,
      teamAvgKdaRatioToMax: 0,
      teamAvgKillParticipationRatioToMax: 0,
      teamAvgTotalHealRatioToMax: 0
    }
  }

  const damageDealtToChampionsRatioToMax =
    participant.value.totalDamageDealtToChampions /
    noZero(teams.value.allTeamStats.maxDamageDealtToChampions)
  const damageTakenRatioToMax =
    participant.value.totalDamageTaken / noZero(teams.value.allTeamStats.maxDamageTaken)
  const goldEarnedRatioToMax =
    participant.value.goldEarned / noZero(teams.value.allTeamStats.maxGoldEarned)
  const csRatioToMax = participant.value.cs / noZero(teams.value.allTeamStats.maxCs)
  const kdaRatioToMax = participant.value.kda / noZero(teams.value.allTeamStats.maxKda)
  const killParticipationRatioToMax =
    participant.value.killParticipation / noZero(teams.value.allTeamStats.maxKillParticipation)
  const totalHealRatioToMax = participant.value.totalHeal / noZero(teams.value.allTeamStats.maxHeal)

  const teamAvgDamageDealtToChampionsRatioToMax =
    team.value.totalDamageDealtToChampions /
    teamSize.value /
    noZero(teams.value.allTeamStats.maxDamageDealtToChampions)
  const teamAvgDamageTakenRatioToMax =
    team.value.totalDamageTaken / teamSize.value / noZero(teams.value.allTeamStats.maxDamageTaken)
  const teamAvgGoldEarnedRatioToMax =
    team.value.totalGoldEarned / teamSize.value / noZero(teams.value.allTeamStats.maxGoldEarned)
  const teamAvgCsRatioToMax = team.value.totalCs / teamSize.value / teams.value.allTeamStats.maxCs
  const teamAvgKdaRatioToMax =
    team.value.totalKda / teamSize.value / noZero(teams.value.allTeamStats.maxKda)
  const teamAvgKillParticipationRatioToMax =
    team.value.totalKillParticipation /
    teamSize.value /
    noZero(teams.value.allTeamStats.maxKillParticipation)
  const teamAvgTotalHealRatioToMax =
    team.value.totalHeal / teamSize.value / noZero(teams.value.allTeamStats.maxHeal)

  return {
    damageDealtToChampions: participant.value.totalDamageDealtToChampions,
    damageTaken: participant.value.totalDamageTaken,
    goldEarned: participant.value.goldEarned,
    cs: participant.value.cs,
    kda: participant.value.kda,
    killParticipation: participant.value.killParticipation,
    totalHeal: participant.value.totalHeal,

    damageDealtToChampionsRatioToMax,
    damageTakenRatioToMax,
    goldEarnedRatioToMax,
    csRatioToMax,
    kdaRatioToMax,
    killParticipationRatioToMax,
    totalHealRatioToMax,

    teamAvgDamageDealtToChampionsRatioToMax,
    teamAvgDamageTakenRatioToMax,
    teamAvgGoldEarnedRatioToMax,
    teamAvgCsRatioToMax,
    teamAvgKdaRatioToMax,
    teamAvgKillParticipationRatioToMax,
    teamAvgTotalHealRatioToMax
  }
})

/** 轴名（不含数值，由轴外标签插件绘制） */
const axisNames = computed(() => {
  // i18n 文案为 "伤害 ({{value}})"，去掉数值占位即得轴名
  const clean = (key: string) => t(key, { value: '' }).replace(/\(\)/g, '').trim()
  return [
    clean('matchCard.radar.damage'),
    clean('matchCard.radar.taken'),
    clean('matchCard.radar.gold'),
    clean('matchCard.radar.cs'),
    clean('matchCard.radar.kda'),
    clean('matchCard.radar.kp'),
    clean('matchCard.radar.heal')
  ]
})

/** 玩家各轴原始数值（大字标注） */
const playerValues = computed(() => {
  const p = percentage.value
  return [
    formatExtremeNumber(p.damageDealtToChampions),
    formatExtremeNumber(p.damageTaken),
    formatExtremeNumber(p.goldEarned),
    String(p.cs),
    p.kda.toFixed(2),
    `${(p.killParticipation * 100).toFixed(0)}%`,
    formatExtremeNumber(p.totalHeal)
  ]
})

/** 玩家 vs 队均的差值（百分点，正 = 高于队均） */
const diffs = computed(() => {
  const p = percentage.value
  return [
    (p.damageDealtToChampionsRatioToMax - p.teamAvgDamageDealtToChampionsRatioToMax) * 100,
    (p.damageTakenRatioToMax - p.teamAvgDamageTakenRatioToMax) * 100,
    (p.goldEarnedRatioToMax - p.teamAvgGoldEarnedRatioToMax) * 100,
    (p.csRatioToMax - p.teamAvgCsRatioToMax) * 100,
    (p.kdaRatioToMax - p.teamAvgKdaRatioToMax) * 100,
    (p.killParticipationRatioToMax - p.teamAvgKillParticipationRatioToMax) * 100,
    (p.totalHealRatioToMax - p.teamAvgTotalHealRatioToMax) * 100
  ]
})

/**
 * 轴外标签插件（方案 A 形态 + D 差值标注）：
 * 每个轴的最大半径外侧绘制三行文本——玩家数值（大字白）、
 * 差值（▲绿高于队均 / ▼红低于队均）、轴名（小字灰）；
 * 左上角绘制竖排左对齐图例（玩家 / 队伍平均）
 */
const radarValueLabelsPlugin = {
  id: 'radarValueLabels',
  afterDatasetsDraw(chart: ChartJS<'radar'>) {
    const meta = chart.getDatasetMeta(0)
    const points = meta.data
    if (!points.length) return
    const labels = (chart.options.plugins.radarValueLabels ?? {}) as {
      names?: string[]
      values?: string[]
      diffs?: number[]
      legend?: { player: string; team: string }
    }
    if (!labels.names?.length) return

    const rScale = chart.scales.r
    const center = { x: rScale.xCenter, y: rScale.yCenter }
    // 标签基准：固定在最大半径外侧（不受数据值大小影响，避免小数值时标签挤到中心）
    const maxDist = rScale.getDistanceFromCenterForValue(rScale.max)
    const { ctx } = chart
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    labels.names.forEach((name, i) => {
      const pos = rScale.getPointPosition(i, maxDist + 18)
      // 玩家数值：大字加粗
      ctx.font = '600 17px "Russo One", Consolas, sans-serif'
      ctx.fillStyle = '#f4f2fa'
      ctx.fillText(labels.values?.[i] ?? '', pos.x, pos.y)
      // 差值：▲绿 / ▼红（与中心方向一致的外侧第二行）
      const diff = labels.diffs?.[i] ?? 0
      if (diff !== 0) {
        ctx.font = '13px "Russo One", Consolas, sans-serif'
        ctx.fillStyle = diff > 0 ? '#4ade80' : '#f87171'
        const arrow = diff > 0 ? '▲' : '▼'
        ctx.fillText(`${arrow}${Math.abs(Math.round(diff))}%`, pos.x, pos.y + 17)
      }
      // 轴名：小字灰
      ctx.font = '13px "Segoe UI", "PingFang SC", sans-serif'
      ctx.fillStyle = '#a6acbf'
      ctx.fillText(name, pos.x, pos.y + 32)
      // 轴线（淡化，指向中心）
      ctx.strokeStyle = 'rgba(167,139,250,0.18)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(center.x, center.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
    })
    // 图例：整个画布（含 padding）的左上角，竖排两行左对齐；
    // 玩家名超宽截断（顶部 padding 区内容，避免遮挡雷达图形）
    if (labels.legend) {
      let lx = 8
      let ly = 8
      ctx.textAlign = 'left'
      const drawLegendRow = (color: string, label: string, maxWidth: number) => {
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(lx + 4, ly + 6, 4.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.font = '14px "Segoe UI", "PingFang SC", sans-serif'
        ctx.fillStyle = '#e9e6f2'
        let text = label
        // 超宽截断：仅当文字超出 maxWidth 时加省略号
        if (ctx.measureText(text).width > maxWidth) {
          while (text.length > 1 && ctx.measureText(text + '…').width > maxWidth) {
            text = text.slice(0, -1)
          }
          text += '…'
        }
        ctx.fillText(text, lx + 14, ly + 6)
        ly += 21
      }
      drawLegendRow('#a78bfa', labels.legend.player, 120)
      drawLegendRow('rgba(203,213,225,0.8)', labels.legend.team, 120)
    }
    ctx.restore()
  }
}

const data = computed<ChartData<'radar'>>(() => {
  return {
    // 纯轴名：数值/差值由轴外标签插件绘制
    labels: axisNames.value,
    datasets: [
      {
        label: selfName.value ?? puuid,
        // 玩家：紫→玫红线性渐变填充（霓虹能量签名）
        backgroundColor(context) {
          const area = context.chart.chartArea
          if (!area) return 'rgba(124,58,237,0.2)'
          const g = context.chart.ctx.createLinearGradient(
            area.left,
            area.top,
            area.right,
            area.bottom
          )
          g.addColorStop(0, 'rgba(167,139,250,0.55)')
          g.addColorStop(1, 'rgba(244,63,94,0.35)')
          return g
        },
        borderColor: '#a78bfa',
        borderWidth: 2.5,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#a78bfa',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#f43f5e',
        data: [
          percentage.value.damageDealtToChampionsRatioToMax,
          percentage.value.damageTakenRatioToMax,
          percentage.value.goldEarnedRatioToMax,
          percentage.value.csRatioToMax,
          percentage.value.kdaRatioToMax,
          percentage.value.killParticipationRatioToMax,
          percentage.value.totalHealRatioToMax
        ]
      },
      {
        label: t('matchCard.radar.teamAvg'),
        // 队均：灰色半透明填充 + 虚线描边（基准对比层）
        backgroundColor: 'rgba(148,163,184,0.15)',
        borderColor: 'rgba(203,213,225,0.8)',
        borderWidth: 1.5,
        borderDash: [5, 3],
        pointBackgroundColor: 'rgba(203,213,225,0.9)',
        pointBorderColor: 'transparent',
        pointRadius: 2.5,
        data: [
          percentage.value.teamAvgDamageDealtToChampionsRatioToMax,
          percentage.value.teamAvgDamageTakenRatioToMax,
          percentage.value.teamAvgGoldEarnedRatioToMax,
          percentage.value.teamAvgCsRatioToMax,
          percentage.value.teamAvgKdaRatioToMax,
          percentage.value.teamAvgKillParticipationRatioToMax,
          percentage.value.teamAvgTotalHealRatioToMax
        ]
      }
    ]
  }
})

const options = computed<ChartOptions<'radar'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  devicePixelRatio: Math.max(window.devicePixelRatio, 2),
  // 轴外标签三行文本的绘制空间 + 左上角图例区（顶部 40 / 左右 56 / 底部 34）
  layout: {
    padding: { top: 40, bottom: 34, left: 56, right: 56 }
  },
  animation: {
    duration: 500
  },
  scales: {
    r: {
      min: 0,
      max: 1,
      ticks: {
        display: false
      },
      // 网格/轴线提亮紫调（与主题一致）
      grid: { color: 'rgba(167,139,250,0.20)', lineWidth: 1.2 },
      angleLines: { color: 'rgba(167,139,250,0.26)', lineWidth: 1.2 },
      // 轴名由自定义插件绘制（数值/差值/轴名三行）
      pointLabels: {
        display: false
      }
    }
  },
  plugins: {
    datalabels: {
      display: false
    },
    radarValueLabels: {
      names: axisNames.value,
      values: playerValues.value,
      diffs: diffs.value,
      // 图例数据（左上角竖排绘制）：玩家名 + 队伍平均
      legend: {
        player: selfName.value ?? puuid ?? '',
        team: t('matchCard.radar.teamAvg')
      }
    },
    // 图例由自定义插件绘制在左上角（竖排左对齐），关闭 Chart.js 内置 legend
    legend: {
      display: false
    },
    tooltip: {
      backgroundColor: 'rgba(18,16,28,0.92)',
      borderColor: 'rgba(124,58,237,0.4)',
      borderWidth: 1,
      titleColor: '#f8fafc',
      bodyColor: '#e2e8f0',
      callbacks: {
        label(context: TooltipItem<'radar'>) {
          const label = context.dataset.label ? `${context.dataset.label}: ` : ''
          const value = typeof context.parsed.r === 'number' ? context.parsed.r : 0
          return `${label}${(value * 100).toFixed(1)}%`
        }
      }
    }
  }
}))
</script>

<style scoped>
/* 中心紫光晕（霓虹能量）：叠加在玻璃卡片背景上，营造从中心向外发散的层次 */
.radar-glow {
  background:
    radial-gradient(circle at 50% 50%, rgba(124, 58, 237, 0.24), transparent 62%),
    rgba(18, 16, 28, 0.88);
}
</style>
