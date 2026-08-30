/**
 * 车队周报 adapter 单元测试：周偏移、时长格式化、分享图文案行构建
 */
import { describe, expect, it } from 'vitest'

import type { TeamWeeklyReport } from '@/api/team'

import { buildShareLines, formatDuration, weekShift } from '../adapter'

/** 最小周报夹具：总览 + MVP/战犯榜各一条 + 五杀名场面 + AI 锐评 */
function reportFixture(): TeamWeeklyReport {
  return {
    weekStartMs: 0,
    weekEndMs: 1,
    weekLabel: '2026-08-24 ~ 2026-08-30',
    overview: {
      gameCount: 3,
      memberGameCount: 6,
      winCount: 4,
      lossCount: 2,
      totalDurationSeconds: 5400,
      busiestDay: '2026-08-26',
      busiestDayGames: 2,
      activeMembers: ['A#tw2', 'B#tw2']
    },
    mvpBoard: [{ puuid: 'p1', riotId: 'A#tw2', value: 2, detail: 'MVP×1 SVP×1' }],
    criminalBoard: [{ puuid: 'p2', riotId: 'B#tw2', value: 4.5, detail: '2场' }],
    feederBoard: null,
    carryBoard: null,
    signatureBoard: null,
    attendanceBoard: null,
    highlights: {
      biggestComeback: null,
      worstStreak: null,
      multiKillMoment: { gameId: 1, title: '五杀时刻', detail: 'B#tw2 拿下五杀', value: 5 },
      mostKillsGame: null
    },
    aiComment: '本周A封神，B战犯实锤'
  }
}

describe('weekShift', () => {
  it('向后偏移一周', () => {
    expect(weekShift('2026-08-26', 1)).toBe('2026-09-02')
  })

  it('向前偏移一周（跨月）', () => {
    expect(weekShift('2026-09-02', -1)).toBe('2026-08-26')
  })
})

describe('formatDuration', () => {
  it('超过 1 小时显示"小时+分"', () => {
    expect(formatDuration(5400)).toBe('1小时30分')
  })

  it('不足 1 小时只显示分钟', () => {
    expect(formatDuration(300)).toBe('5分')
  })
})

describe('buildShareLines', () => {
  it('包含总览行、上榜行、名场面行与 AI 锐评行', () => {
    const lines = buildShareLines(reportFixture())

    expect(lines[0]).toContain('车队对局 3 场')
    expect(lines[0]).toContain('4胜2负')
    // MVP 榜条目
    expect(lines.filter((l) => l.includes('A#tw2') && l.includes('MVP×1'))).toHaveLength(1)
    // 战犯榜条目（小数值保留两位小数）
    expect(lines.filter((l) => l.includes('4.50'))).toHaveLength(1)
    // 名场面 + AI 锐评
    expect(lines.filter((l) => l.includes('五杀时刻'))).toHaveLength(1)
    expect(lines[lines.length - 1]).toContain('本周A封神')
  })

  it('空榜单与空字段全部跳过，不产生空行', () => {
    const report = reportFixture()
    report.mvpBoard = null
    report.criminalBoard = null
    report.highlights = null
    report.aiComment = null

    const lines = buildShareLines(report)

    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('车队对局 3 场')
  })
})
