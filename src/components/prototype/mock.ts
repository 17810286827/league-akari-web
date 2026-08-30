/**
 * 【原型】内置示例数据：周报接口含同步 AI 锐评（最坏 90s+），评审设计不能干等；
 * 真实接口 4s 内未响应即回退本文件的数据，保证无后端也能评审五方案的字体/图标/布局。
 * 所有成员与数值均为虚构，页面会通过切换条的"示例数据"标注区分。
 */
import dayjs from 'dayjs'

import type {
  TeamBoardEntry,
  TeamLeaderboard,
  TeamMemberCard,
  TeamWeeklyReport
} from '@/api/team'

/** 示例成员名单（riotId 格式与后端一致："昵称#tag"，虚构） */
const MEMBERS = ['莽夫一诺#tw', '草丛蹲神#tw', '补刀机器人#tw', '光速送头#tw', '躺赢圣手#tw', '野区巡游者#tw']

/** puuid 与 riotId 的映射（成员卡联动按 puuid 查询，示例数据用假 puuid） */
const PUUID_OF = new Map(MEMBERS.map((name, index) => [`mock-puuid-${index}`, name]))

/** 周一为一周起点：dateIso 所在周的周一（yyyy-MM-dd） */
function mondayOf(dateIso: string): string {
  const date = dayjs(dateIso)
  // day() 周日为 0，折算成"距离周一的天数"
  return date.subtract((date.day() + 6) % 7, 'day').format('YYYY-MM-DD')
}

/** 周标签："2026-08-24 ~ 2026-08-30"（周一 ~ 周日，与后端口径一致） */
export function weekLabelOf(dateIso: string): string {
  const monday = dayjs(mondayOf(dateIso))
  return `${monday.format('YYYY-MM-DD')} ~ ${monday.add(6, 'day').format('YYYY-MM-DD')}`
}

/** 构造榜单条目（快速批量生成用） */
function entry(puuid: string, value: number, detail: string): TeamBoardEntry {
  return { puuid, riotId: PUUID_OF.get(puuid) ?? '未知成员#tw', value, detail }
}

/** 绝活榜条目：额外携带英雄字段（按英雄分组展示用） */
function signatureEntry(
  puuid: string,
  value: number,
  championId: number,
  championName: string,
  games: number,
  wins: number
): TeamBoardEntry {
  return {
    puuid,
    riotId: PUUID_OF.get(puuid) ?? '未知成员#tw',
    value,
    detail: `${games}场`,
    championId,
    championName,
    games,
    wins
  }
}

/**
 * 生成完整周报示例：七个榜单全部填充、四个名场面齐全、AI 锐评就位，
 * 让评审能看到每个板块排满时的密度与层次（空态在真实数据下自然出现）
 */
export function mockWeeklyReport(dateIso: string): TeamWeeklyReport {
  const weekLabel = weekLabelOf(dateIso)
  const report: TeamWeeklyReport = {
    weekStartMs: dayjs(mondayOf(dateIso)).valueOf(),
    weekEndMs: dayjs(mondayOf(dateIso)).add(7, 'day').valueOf(),
    weekLabel,
    teamName: '夜幕车队',
    overview: {
      gameCount: 23,
      memberGameCount: 87,
      winCount: 51,
      lossCount: 36,
      totalDurationSeconds: 41_400,
      busiestDay: weekLabel.slice(13, 23),
      busiestDayGames: 7,
      activeMembers: [...MEMBERS]
    },
    mvpBoard: [
      entry('mock-puuid-0', 5, 'MVP×3 SVP×2'),
      entry('mock-puuid-2', 4, 'MVP×2 SVP×2'),
      entry('mock-puuid-5', 3, 'MVP×1 SVP×2'),
      entry('mock-puuid-1', 2, 'MVP×1 SVP×1'),
      entry('mock-puuid-4', 1, 'SVP×1')
    ],
    opScoreBoard: [
      entry('mock-puuid-0', 7.88, '23场均分'),
      entry('mock-puuid-2', 7.31, '21场均分'),
      entry('mock-puuid-5', 6.94, '18场均分'),
      entry('mock-puuid-4', 6.42, '16场均分'),
      entry('mock-puuid-1', 5.87, '20场均分'),
      entry('mock-puuid-3', 4.95, '22场均分')
    ],
    criminalBoard: [
      entry('mock-puuid-3', 6, '6次全场最低评分'),
      entry('mock-puuid-1', 4, '4次全场最低评分'),
      entry('mock-puuid-4', 3, '3次全场最低评分'),
      entry('mock-puuid-5', 2, '2次全场最低评分')
    ],
    feederBoard: [
      entry('mock-puuid-3', 7.6, '场均 7.6 死'),
      entry('mock-puuid-1', 6.8, '场均 6.8 死'),
      entry('mock-puuid-4', 6.1, '场均 6.1 死'),
      entry('mock-puuid-2', 5.4, '场均 5.4 死')
    ],
    carryBoard: [
      entry('mock-puuid-0', 918, '分均伤害'),
      entry('mock-puuid-2', 847, '分均伤害'),
      entry('mock-puuid-5', 782, '分均伤害'),
      entry('mock-puuid-4', 703, '分均伤害'),
      entry('mock-puuid-1', 655, '分均伤害')
    ],
    signatureBoard: [
      signatureEntry('mock-puuid-0', 8.62, 157, '劫', 9, 7),
      signatureEntry('mock-puuid-2', 8.15, 412, '卢锡安', 7, 5),
      signatureEntry('mock-puuid-5', 7.9, 64, '李青', 8, 5),
      signatureEntry('mock-puuid-1', 7.44, 23, '亚索', 11, 5),
      signatureEntry('mock-puuid-4', 7.02, 222, '金克丝', 6, 4)
    ],
    attendanceBoard: [
      entry('mock-puuid-3', 22, '22场'),
      entry('mock-puuid-0', 23, '23场'),
      entry('mock-puuid-1', 20, '20场'),
      entry('mock-puuid-2', 21, '21场'),
      entry('mock-puuid-4', 16, '16场'),
      entry('mock-puuid-5', 18, '18场')
    ],
    highlights: {
      biggestComeback: {
        gameId: 8_100_001,
        title: '绝地翻盘',
        detail: '经济落后 9k 拖到大后期，一波龙魂团翻盘',
        value: 9_000
      },
      worstStreak: {
        gameId: 8_100_002,
        title: '黑暗一周',
        detail: '光速送头#tw 连吃四连败，心态稳住',
        value: 4
      },
      multiKillMoment: {
        gameId: 8_100_003,
        title: '五杀时刻',
        detail: '莽夫一诺#tw 的劫在大龙坑拿下五杀',
        value: 5
      },
      mostKillsGame: {
        gameId: 8_100_003,
        title: '屠杀之夜',
        detail: '莽夫一诺#tw 单局 22 杀 3 死 8 助攻',
        value: 22
      },
      missingTimelineCount: 0
    },
    aiComment:
      '本周车队整体节奏偏热：夜幕车队合计开黑 23 场，周三单日 7 场堪称"爆肝之夜"。' +
      '莽夫一诺#tw 以场均 7.88 的评分和一发五杀领跑 MVP 榜，但出勤王却是光速送头#tw——' +
      '22 场的坚持配上 7.6 的场均阵亡，属于"用生命在探草"。下周建议：让战犯们多看小地图，' +
      '让 Carry 们少抢蓝 buff。'
  }
  // 周报页按 `${key}Board` 取值（key=opscore → opscoreBoard），与接口字段 opScoreBoard（大写 S）
  // 不一致（现有页面的取值 bug）——示例数据补一个别名，保证评审时该榜单有数据
  ;(report as unknown as Record<string, unknown>).opscoreBoard = report.opScoreBoard
  return report
}

/**
 * 生成榜单中心示例：按维度返回对应条目；
 * 绝活榜一人多英雄（触发按英雄分组视图），其余维度平铺
 */
export function mockLeaderboard(dimension: string): TeamLeaderboard {
  const entriesByDimension: Record<string, TeamBoardEntry[]> = {
    attendance: [
      entry('mock-puuid-0', 23, '23场'),
      entry('mock-puuid-3', 22, '22场'),
      entry('mock-puuid-2', 21, '21场'),
      entry('mock-puuid-1', 20, '20场'),
      entry('mock-puuid-5', 18, '18场'),
      entry('mock-puuid-4', 16, '16场')
    ],
    mvp: [
      entry('mock-puuid-0', 5, 'MVP×3 SVP×2'),
      entry('mock-puuid-2', 4, 'MVP×2 SVP×2'),
      entry('mock-puuid-5', 3, 'MVP×1 SVP×2'),
      entry('mock-puuid-1', 2, 'MVP×1 SVP×1')
    ],
    opscore: [
      entry('mock-puuid-0', 7.88, '23场均分'),
      entry('mock-puuid-2', 7.31, '21场均分'),
      entry('mock-puuid-5', 6.94, '18场均分'),
      entry('mock-puuid-4', 6.42, '16场均分'),
      entry('mock-puuid-1', 5.87, '20场均分')
    ],
    criminal: [
      entry('mock-puuid-3', 6, '6次全场最低评分'),
      entry('mock-puuid-1', 4, '4次全场最低评分'),
      entry('mock-puuid-4', 3, '3次全场最低评分')
    ],
    feeder: [
      entry('mock-puuid-3', 7.6, '场均 7.6 死'),
      entry('mock-puuid-1', 6.8, '场均 6.8 死'),
      entry('mock-puuid-4', 6.1, '场均 6.1 死')
    ],
    carry: [
      entry('mock-puuid-0', 918, '分均伤害'),
      entry('mock-puuid-2', 847, '分均伤害'),
      entry('mock-puuid-5', 782, '分均伤害')
    ],
    signature: [
      signatureEntry('mock-puuid-0', 8.62, 157, '劫', 9, 7),
      signatureEntry('mock-puuid-2', 8.15, 412, '卢锡安', 7, 5),
      signatureEntry('mock-puuid-0', 7.9, 64, '李青', 6, 4),
      signatureEntry('mock-puuid-5', 7.9, 64, '李青', 8, 5),
      signatureEntry('mock-puuid-1', 7.44, 23, '亚索', 11, 5),
      signatureEntry('mock-puuid-4', 7.02, 222, '金克丝', 6, 4)
    ]
  }
  return {
    dimension,
    startMs: null,
    endMs: null,
    gameMode: null,
    entries: entriesByDimension[dimension] ?? []
  }
}

/** 生成成员卡示例：近 8 周成长曲线 + 英雄基线对比（puuid 仅用于反查昵称） */
export function mockMemberCard(puuid: string): TeamMemberCard {
  const riotId = PUUID_OF.get(puuid) ?? '未知成员#tw'
  return {
    puuid,
    riotId,
    trend: [
      { weekLabel: '2026-07-13', games: 12, winRate: 0.42, avgOpScore: 5.9 },
      { weekLabel: '2026-07-20', games: 15, winRate: 0.53, avgOpScore: 6.2 },
      { weekLabel: '2026-07-27', games: 9, winRate: 0.44, avgOpScore: 5.7 },
      { weekLabel: '2026-08-03', games: 18, winRate: 0.61, avgOpScore: 6.8 },
      { weekLabel: '2026-08-10', games: 21, winRate: 0.57, avgOpScore: 7.1 },
      { weekLabel: '2026-08-17', games: 14, winRate: 0.64, avgOpScore: 7.4 },
      { weekLabel: '2026-08-24', games: 23, winRate: 0.66, avgOpScore: 7.88 },
      { weekLabel: '2026-08-31', games: 0, winRate: null, avgOpScore: null }
    ],
    champions: [
      { championId: 157, championName: '劫', games: 9, wins: 7, avgOpScore: 8.62, avgDamagePerMin: 918, baselineDamagePerMin: 742 },
      { championId: 64, championName: '李青', games: 6, wins: 4, avgOpScore: 7.9, avgDamagePerMin: 702, baselineDamagePerMin: 615 },
      { championId: 23, championName: '亚索', games: 4, wins: 2, avgOpScore: 6.4, avgDamagePerMin: 688, baselineDamagePerMin: 640 },
      { championId: 412, championName: '卢锡安', games: 4, wins: 3, avgOpScore: 7.75, avgDamagePerMin: 830, baselineDamagePerMin: 705 }
    ]
  }
}
