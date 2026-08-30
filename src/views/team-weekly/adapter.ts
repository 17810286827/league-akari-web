/**
 * 车队周报页数据适配层：
 * 1. 纯函数部分（周偏移、分享图文案行、时长格式化）—— 单元测试覆盖；
 * 2. 分享图 canvas 绘制 —— 视觉验收为主，不强行单测。
 */
import type { TeamBoardEntry, TeamWeeklyReport } from '@/api/team'

/** 榜单展示元信息：维度 key → 标题与图标 */
export const BOARD_META: { key: string; title: string; icon: string }[] = [
  { key: 'mvp', title: 'MVP 榜', icon: '👑' },
  { key: 'opscore', title: 'op_score 榜', icon: '⭐' },
  { key: 'criminal', title: '战犯榜', icon: '🗡️' },
  { key: 'feeder', title: '送头王', icon: '⚰️' },
  { key: 'carry', title: 'Carry 王', icon: '⚡' },
  { key: 'signature', title: '绝活榜', icon: '🎯' },
  { key: 'attendance', title: '出勤榜', icon: '📅' }
]

/**
 * ISO 日期偏移 N 周（周切换按钮用）：返回 yyyy-MM-dd
 * @param dateIso 基准日期，如 "2026-08-26"
 * @param weeks   偏移周数（-1 上一周 / 1 下一周）
 */
export function weekShift(dateIso: string, weeks: number): string {
  const date = new Date(`${dateIso}T00:00:00`)
  date.setDate(date.getDate() + weeks * 7)
  // 本地日期回填（避免 toISOString 的 UTC 偏移踩到前一天）
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 秒数 → "X小时Y分" / "Y分"（不足 1 分钟显示 "0分"） */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? `${h}小时${m}分` : `${m}分`
}

/** 从榜单中取前 N 条的文案行："昵称 值（说明）" */
function boardLines(board: TeamBoardEntry[] | null | undefined, topN: number): string[] {
  return (board ?? []).slice(0, topN).map((entry, index) => {
    const value = Number.isInteger(entry.value) ? entry.value : entry.value.toFixed(2)
    return `${index + 1}. ${entry.riotId} ${value}（${entry.detail}）`
  })
}

/**
 * 构建分享图的全部文案行（纯函数，分享图绘制的唯一数据来源）：
 * 标题 + 总览 + 六榜单前 3 + 名场面 + AI 锐评；空榜单/空字段跳过
 */
export function buildShareLines(report: TeamWeeklyReport): string[] {
  const lines: string[] = []
  const overview = report.overview
  if (overview) {
    lines.push(
      `车队对局 ${overview.gameCount} 场 · 人次 ${overview.winCount}胜${overview.lossCount}负 · ` +
        `总时长 ${formatDuration(overview.totalDurationSeconds)}`
    )
  }
  for (const meta of BOARD_META) {
    const board = report[`${meta.key}Board` as keyof TeamWeeklyReport] as TeamBoardEntry[] | null
    const boardTexts = boardLines(board, 3)
    if (boardTexts.length > 0) {
      lines.push(`【${meta.title}】`, ...boardTexts)
    }
  }
  const highlights = report.highlights
  if (highlights) {
    for (const item of [
      highlights.multiKillMoment,
      highlights.biggestComeback,
      highlights.worstStreak,
      highlights.mostKillsGame
    ]) {
      if (item) {
        lines.push(`🏆 ${item.title}：${item.detail}`)
      }
    }
  }
  if (report.aiComment) {
    lines.push(`🤖 ${report.aiComment}`)
  }
  return lines
}

/**
 * 绘制周报分享图（canvas，发群用）：海克斯魔典风（ADR 0002）——
 * 深蓝渐变底 + 双线金边框 + 金渐变标题 + 符文分隔线；文案行由 buildShareLines 唯一产出。
 * 注意：canvas 不走 CSS 令牌，色值内联但与 tailwind.css 的 --color-hex-* 保持一致。
 * @returns 绘制完成的画布元素（调用方负责触发下载）
 */
export function renderShareImage(report: TeamWeeklyReport): HTMLCanvasElement {
  const lines = buildShareLines(report)
  const width = 900
  const lineHeight = 44
  const padding = 48
  const height = padding * 2 + 104 + lines.length * lineHeight
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return canvas
  }

  // 背景：深蓝垂直渐变（面板亮端 → 页面底色）
  const background = ctx.createLinearGradient(0, 0, 0, height)
  background.addColorStop(0, '#0d1b30')
  background.addColorStop(1, '#0a1428')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)

  // 双线金边框（内外两圈，卡槽签名元素）
  ctx.strokeStyle = '#3c2f14'
  ctx.lineWidth = 2
  ctx.strokeRect(14, 14, width - 28, height - 28)
  ctx.lineWidth = 1
  ctx.strokeRect(24, 24, width - 48, height - 48)

  // 标题：车队名周报（金渐变，Cinzel 加载失败回退衬线）+ 周标签（青色）
  const gold = ctx.createLinearGradient(0, padding - 10, 0, padding + 34)
  gold.addColorStop(0, '#f0d9a6')
  gold.addColorStop(0.55, '#c8aa6e')
  gold.addColorStop(1, '#8a6a35')
  ctx.fillStyle = gold
  ctx.font = '900 42px Cinzel, Georgia, KaiTi, serif'
  ctx.fillText(`${report.teamName ?? '车队'} · 周报`, padding, padding + 22)
  ctx.fillStyle = '#0ac8b9'
  ctx.font = '600 22px Georgia, KaiTi, serif'
  ctx.fillText(report.weekLabel, padding, padding + 58)

  // 标题下符文分隔线：渐隐金线 + 中央 ✦
  const dividerY = padding + 82
  ctx.strokeStyle = 'rgba(200, 170, 110, 0.5)'
  ctx.beginPath()
  ctx.moveTo(padding, dividerY)
  ctx.lineTo(width - padding, dividerY)
  ctx.stroke()
  ctx.fillStyle = 'rgba(200, 170, 110, 0.8)'
  ctx.font = '16px serif'
  ctx.fillText('✦', width / 2 - 8, dividerY + 6)

  // 正文逐行绘制：小节标题（【 】）金色、名场面（🏆）铜色、AI 锐评（🤖）青色、其余浅色；
  // 超出宽度的行截断，避免溢出画布
  ctx.font = '26px KaiTi, "Microsoft YaHei", serif'
  let y = padding + 128
  for (const line of lines) {
    ctx.fillStyle = line.startsWith('【')
      ? '#c8aa6e'
      : line.startsWith('🏆')
        ? '#cd8f52'
        : line.startsWith('🤖')
          ? '#0ac8b9'
          : '#e8eefc'
    ctx.fillText(line.length > 36 ? `${line.slice(0, 35)}…` : line, padding, y)
    y += lineHeight
  }
  return canvas
}

/** 触发浏览器下载分享图 PNG */
export function downloadShareImage(report: TeamWeeklyReport): void {
  const canvas = renderShareImage(report)
  const link = document.createElement('a')
  link.download = `车队周报_${report.weekLabel.replace(/[~ ]/g, '')}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}
